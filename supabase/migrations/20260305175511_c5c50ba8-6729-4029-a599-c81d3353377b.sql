
-- ==========================================
-- GATEWAY DB FUNCTIONS
-- ==========================================

-- 1) VALID STATUS TRANSITIONS
CREATE OR REPLACE FUNCTION public.gateway_valid_transition(_from gateway_tx_status, _to gateway_tx_status)
RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE
    WHEN _from = 'pending' AND _to IN ('processing', 'cancelled', 'review_required') THEN true
    WHEN _from = 'processing' AND _to IN ('paid', 'failed', 'review_required') THEN true
    WHEN _from = 'paid' AND _to = 'refunded' THEN true
    WHEN _from = 'review_required' AND _to IN ('processing', 'cancelled') THEN true
    ELSE false
  END
$$;

-- 2) CREATE GATEWAY TRANSACTION (with idempotency + ledger)
CREATE OR REPLACE FUNCTION public.create_gateway_transaction(
  _merchant_id UUID,
  _amount NUMERIC,
  _idempotency_key TEXT,
  _payment_method TEXT DEFAULT 'pix',
  _description TEXT DEFAULT NULL,
  _customer_email TEXT DEFAULT NULL,
  _customer_document TEXT DEFAULT NULL,
  _metadata JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _tx_id UUID;
  _existing_id UUID;
  _merchant RECORD;
BEGIN
  -- Validate merchant
  SELECT * INTO _merchant FROM public.merchants WHERE id = _merchant_id AND status = 'active';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Merchant not found or inactive';
  END IF;

  -- Validate amount
  IF _amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  -- Check idempotency
  SELECT id INTO _existing_id
  FROM public.gateway_transactions
  WHERE merchant_id = _merchant_id AND idempotency_key = _idempotency_key;

  IF FOUND THEN
    RETURN _existing_id; -- Return existing transaction (idempotent)
  END IF;

  -- Create transaction
  INSERT INTO public.gateway_transactions (
    merchant_id, amount, payment_method, idempotency_key,
    description, customer_email, customer_document, metadata
  ) VALUES (
    _merchant_id, _amount, _payment_method, _idempotency_key,
    _description, _customer_email, _customer_document, _metadata
  ) RETURNING id INTO _tx_id;

  RETURN _tx_id;
END;
$$;

-- 3) UPDATE GATEWAY TRANSACTION STATUS (with validation + ledger)
CREATE OR REPLACE FUNCTION public.update_gateway_tx_status(
  _tx_id UUID,
  _new_status gateway_tx_status,
  _provider_tx_id TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _tx RECORD;
  _merchant_balance NUMERIC;
BEGIN
  -- Lock and get transaction
  SELECT * INTO _tx FROM public.gateway_transactions WHERE id = _tx_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaction not found';
  END IF;

  -- Validate transition
  IF NOT public.gateway_valid_transition(_tx.status, _new_status) THEN
    RAISE EXCEPTION 'Invalid status transition from % to %', _tx.status, _new_status;
  END IF;

  -- Update transaction
  UPDATE public.gateway_transactions
  SET status = _new_status,
      provider_transaction_id = COALESCE(_provider_tx_id, provider_transaction_id),
      paid_at = CASE WHEN _new_status = 'paid' THEN now() ELSE paid_at END,
      failed_at = CASE WHEN _new_status = 'failed' THEN now() ELSE failed_at END,
      refunded_at = CASE WHEN _new_status = 'refunded' THEN now() ELSE refunded_at END
  WHERE id = _tx_id;

  -- If paid, create ledger entry (credit merchant)
  IF _new_status = 'paid' THEN
    -- Calculate current balance from ledger
    SELECT COALESCE(SUM(CASE WHEN entry_type IN ('credit') THEN amount
                            WHEN entry_type IN ('debit', 'fee', 'refund') THEN -amount
                            ELSE 0 END), 0)
    INTO _merchant_balance
    FROM public.ledger_entries WHERE merchant_id = _tx.merchant_id;

    -- Credit the transaction amount
    INSERT INTO public.ledger_entries (merchant_id, transaction_id, entry_type, amount, balance_after, description)
    VALUES (_tx.merchant_id, _tx_id, 'credit', _tx.amount, _merchant_balance + _tx.amount, 'Payment received');

    -- Debit the platform fee (1% example)
    INSERT INTO public.ledger_entries (merchant_id, transaction_id, entry_type, amount, balance_after, description)
    VALUES (_tx.merchant_id, _tx_id, 'fee', _tx.amount * 0.01, _merchant_balance + _tx.amount - (_tx.amount * 0.01), 'Platform fee');
  END IF;

  -- If refunded, create refund ledger entry
  IF _new_status = 'refunded' THEN
    SELECT COALESCE(SUM(CASE WHEN entry_type IN ('credit') THEN amount
                            WHEN entry_type IN ('debit', 'fee', 'refund') THEN -amount
                            ELSE 0 END), 0)
    INTO _merchant_balance
    FROM public.ledger_entries WHERE merchant_id = _tx.merchant_id;

    INSERT INTO public.ledger_entries (merchant_id, transaction_id, entry_type, amount, balance_after, description)
    VALUES (_tx.merchant_id, _tx_id, 'refund', _tx.amount, _merchant_balance - _tx.amount, 'Refund processed');
  END IF;

  RETURN true;
END;
$$;

-- 4) CALCULATE RISK SCORE
CREATE OR REPLACE FUNCTION public.calculate_risk_score(
  _merchant_id UUID,
  _amount NUMERIC,
  _customer_document TEXT DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _score INTEGER := 0;
  _recent_count INTEGER;
  _avg_amount NUMERIC;
BEGIN
  -- Check recent transaction frequency (last 5 min)
  SELECT COUNT(*) INTO _recent_count
  FROM public.gateway_transactions
  WHERE merchant_id = _merchant_id
    AND created_at > now() - interval '5 minutes';

  IF _recent_count > 10 THEN _score := _score + 30; END IF;
  IF _recent_count > 20 THEN _score := _score + 20; END IF;

  -- Check if amount is unusually high for this merchant
  SELECT AVG(amount) INTO _avg_amount
  FROM public.gateway_transactions
  WHERE merchant_id = _merchant_id
    AND status = 'paid'
    AND created_at > now() - interval '30 days';

  IF _avg_amount IS NOT NULL AND _amount > _avg_amount * 5 THEN
    _score := _score + 25;
  END IF;

  -- Check if same document has multiple recent transactions
  IF _customer_document IS NOT NULL THEN
    SELECT COUNT(*) INTO _recent_count
    FROM public.gateway_transactions
    WHERE merchant_id = _merchant_id
      AND customer_document = _customer_document
      AND created_at > now() - interval '1 hour';

    IF _recent_count > 3 THEN _score := _score + 20; END IF;
  END IF;

  RETURN LEAST(_score, 100);
END;
$$;

-- 5) GET MERCHANT BALANCE (from ledger)
CREATE OR REPLACE FUNCTION public.get_merchant_balance(_merchant_id UUID)
RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(SUM(
    CASE WHEN entry_type = 'credit' THEN amount
         WHEN entry_type IN ('debit', 'fee', 'refund') THEN -amount
         ELSE 0 END
  ), 0)
  FROM public.ledger_entries
  WHERE merchant_id = _merchant_id
$$;

-- 6) GENERATE MERCHANT API KEY
CREATE OR REPLACE FUNCTION public.generate_merchant_api_key()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  _key TEXT;
BEGIN
  _key := 'gw_live_' || encode(gen_random_bytes(32), 'base64');
  _key := replace(replace(replace(_key, '+', ''), '/', ''), '=', '');
  RETURN _key;
END;
$$;

-- 7) AUTHENTICATE MERCHANT BY API KEY
CREATE OR REPLACE FUNCTION public.authenticate_merchant(_api_key TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _prefix TEXT;
  _merchant_id UUID;
  _stored_hash TEXT;
BEGIN
  _prefix := substring(_api_key from 1 for 12);
  
  SELECT id, api_key_hash INTO _merchant_id, _stored_hash
  FROM public.merchants
  WHERE api_key_prefix = _prefix AND status = 'active';
  
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Verify hash (using pgcrypto crypt would be ideal, but for now SHA256 comparison)
  IF _stored_hash = encode(digest(_api_key, 'sha256'), 'hex') THEN
    RETURN _merchant_id;
  END IF;

  RETURN NULL;
END;
$$;
