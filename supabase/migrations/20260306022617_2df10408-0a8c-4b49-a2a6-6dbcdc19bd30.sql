
-- ══════════════════════════════════════════════════════
-- 1. IDEMPOTENCY KEYS TABLE
-- ══════════════════════════════════════════════════════

CREATE TABLE public.idempotency_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL,
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  request_hash text,
  response_status integer NOT NULL DEFAULT 200,
  response_body jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '24 hours'),
  UNIQUE (key, merchant_id, endpoint)
);

CREATE INDEX idx_idempotency_keys_lookup ON public.idempotency_keys (merchant_id, key, endpoint);
CREATE INDEX idx_idempotency_keys_expires ON public.idempotency_keys (expires_at);

ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;

-- Only service role can access (edge functions use service role)
CREATE POLICY "No client access to idempotency_keys"
  ON public.idempotency_keys FOR ALL TO authenticated
  USING (false) WITH CHECK (false);

-- ══════════════════════════════════════════════════════
-- 2. FINANCIAL ALERTS TABLE
-- ══════════════════════════════════════════════════════

CREATE TABLE public.financial_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type text NOT NULL,
  severity text NOT NULL DEFAULT 'warning',
  merchant_id uuid REFERENCES public.merchants(id),
  transaction_id uuid REFERENCES public.gateway_transactions(id),
  description text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  resolved boolean NOT NULL DEFAULT false,
  resolved_at timestamp with time zone,
  resolved_by text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_financial_alerts_unresolved ON public.financial_alerts (resolved, created_at DESC);
CREATE INDEX idx_financial_alerts_merchant ON public.financial_alerts (merchant_id, created_at DESC);

ALTER TABLE public.financial_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view financial alerts"
  ON public.financial_alerts FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "No client mutations on financial alerts"
  ON public.financial_alerts FOR INSERT TO authenticated
  WITH CHECK (false);

CREATE POLICY "No client update on financial alerts"
  ON public.financial_alerts FOR UPDATE TO authenticated
  USING (false);

CREATE POLICY "No client delete on financial alerts"
  ON public.financial_alerts FOR DELETE TO authenticated
  USING (false);

-- ══════════════════════════════════════════════════════
-- 3. DOUBLE-ENTRY VALIDATION FUNCTION
-- ══════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.validate_ledger_balance(_merchant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _computed_balance numeric;
  _last_balance numeric;
  _credit_total numeric;
  _debit_total numeric;
  _fee_total numeric;
  _refund_total numeric;
  _is_consistent boolean;
BEGIN
  SELECT
    COALESCE(SUM(CASE WHEN entry_type = 'credit' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN entry_type = 'debit' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN entry_type = 'fee' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN entry_type = 'refund' THEN amount ELSE 0 END), 0)
  INTO _credit_total, _debit_total, _fee_total, _refund_total
  FROM public.ledger_entries
  WHERE merchant_id = _merchant_id;

  _computed_balance := _credit_total - _debit_total - _fee_total - _refund_total;

  -- Get last recorded balance_after
  SELECT balance_after INTO _last_balance
  FROM public.ledger_entries
  WHERE merchant_id = _merchant_id
  ORDER BY created_at DESC
  LIMIT 1;

  _is_consistent := (_last_balance IS NULL AND _computed_balance = 0)
    OR (_last_balance IS NOT NULL AND ABS(_last_balance - _computed_balance) < 0.01);

  -- If inconsistent, create financial alert
  IF NOT _is_consistent THEN
    INSERT INTO public.financial_alerts (
      alert_type, severity, merchant_id, description, metadata
    ) VALUES (
      'ledger_inconsistency', 'critical', _merchant_id,
      'Ledger balance mismatch detected',
      jsonb_build_object(
        'computed_balance', _computed_balance,
        'last_recorded_balance', _last_balance,
        'difference', ABS(COALESCE(_last_balance, 0) - _computed_balance),
        'credits', _credit_total,
        'debits', _debit_total,
        'fees', _fee_total,
        'refunds', _refund_total
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'consistent', _is_consistent,
    'computed_balance', _computed_balance,
    'last_recorded_balance', _last_balance,
    'credits', _credit_total,
    'debits', _debit_total,
    'fees', _fee_total,
    'refunds', _refund_total
  );
END;
$$;

-- ══════════════════════════════════════════════════════
-- 4. ENHANCED update_gateway_tx_status WITH BALANCE VALIDATION
-- ══════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.update_gateway_tx_status(_tx_id uuid, _new_status gateway_tx_status, _provider_tx_id text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _tx RECORD;
  _merchant_balance NUMERIC;
  _new_balance NUMERIC;
  _validation jsonb;
BEGIN
  -- Lock and get transaction (prevents race conditions)
  SELECT * INTO _tx FROM public.gateway_transactions WHERE id = _tx_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaction not found';
  END IF;

  -- Validate transition
  IF NOT public.gateway_valid_transition(_tx.status, _new_status) THEN
    RAISE EXCEPTION 'Invalid status transition from % to %', _tx.status, _new_status;
  END IF;

  -- Duplicate payment check: prevent paying an already paid transaction
  IF _new_status = 'paid' AND _tx.status = 'paid' THEN
    INSERT INTO public.financial_alerts (
      alert_type, severity, merchant_id, transaction_id, description, metadata
    ) VALUES (
      'duplicate_payment', 'critical', _tx.merchant_id, _tx_id,
      'Attempted duplicate payment on transaction',
      jsonb_build_object('current_status', _tx.status, 'attempted_status', _new_status)
    );
    RAISE EXCEPTION 'Transaction already paid - duplicate blocked';
  END IF;

  -- Update transaction
  UPDATE public.gateway_transactions
  SET status = _new_status,
      provider_transaction_id = COALESCE(_provider_tx_id, provider_transaction_id),
      paid_at = CASE WHEN _new_status = 'paid' THEN now() ELSE paid_at END,
      failed_at = CASE WHEN _new_status = 'failed' THEN now() ELSE failed_at END,
      refunded_at = CASE WHEN _new_status = 'refunded' THEN now() ELSE refunded_at END
  WHERE id = _tx_id;

  -- If paid, create ledger entries atomically
  IF _new_status = 'paid' THEN
    -- Calculate current balance from ledger (double-entry)
    SELECT COALESCE(SUM(CASE WHEN entry_type = 'credit' THEN amount
                            WHEN entry_type IN ('debit', 'fee', 'refund') THEN -amount
                            ELSE 0 END), 0)
    INTO _merchant_balance
    FROM public.ledger_entries WHERE merchant_id = _tx.merchant_id;

    _new_balance := _merchant_balance + _tx.amount;

    -- Credit the transaction amount
    INSERT INTO public.ledger_entries (merchant_id, transaction_id, entry_type, amount, balance_after, description)
    VALUES (_tx.merchant_id, _tx_id, 'credit', _tx.amount, _new_balance, 'Payment received');

    -- Debit the platform fee (1%)
    INSERT INTO public.ledger_entries (merchant_id, transaction_id, entry_type, amount, balance_after, description)
    VALUES (_tx.merchant_id, _tx_id, 'fee', _tx.amount * 0.01, _new_balance - (_tx.amount * 0.01), 'Platform fee');

    -- Post-operation balance validation
    _validation := public.validate_ledger_balance(_tx.merchant_id);
    IF NOT (_validation->>'consistent')::boolean THEN
      -- Log alert but don't rollback (already inserted alert in validate function)
      RAISE WARNING 'Ledger inconsistency detected for merchant %: %', _tx.merchant_id, _validation;
    END IF;
  END IF;

  -- If refunded, create refund entry with balance check
  IF _new_status = 'refunded' THEN
    SELECT COALESCE(SUM(CASE WHEN entry_type = 'credit' THEN amount
                            WHEN entry_type IN ('debit', 'fee', 'refund') THEN -amount
                            ELSE 0 END), 0)
    INTO _merchant_balance
    FROM public.ledger_entries WHERE merchant_id = _tx.merchant_id;

    _new_balance := _merchant_balance - _tx.amount;

    -- Prevent negative merchant balance
    IF _new_balance < 0 THEN
      INSERT INTO public.financial_alerts (
        alert_type, severity, merchant_id, transaction_id, description, metadata
      ) VALUES (
        'negative_balance_attempt', 'critical', _tx.merchant_id, _tx_id,
        'Refund would cause negative merchant balance',
        jsonb_build_object('current_balance', _merchant_balance, 'refund_amount', _tx.amount, 'resulting_balance', _new_balance)
      );
      RAISE EXCEPTION 'Refund blocked: would cause negative merchant balance (current: %, refund: %)', _merchant_balance, _tx.amount;
    END IF;

    INSERT INTO public.ledger_entries (merchant_id, transaction_id, entry_type, amount, balance_after, description)
    VALUES (_tx.merchant_id, _tx_id, 'refund', _tx.amount, _new_balance, 'Refund processed');

    -- Post-refund validation
    _validation := public.validate_ledger_balance(_tx.merchant_id);
  END IF;

  RETURN true;
END;
$$;

-- ══════════════════════════════════════════════════════
-- 5. ENHANCED update_wallet_balance WITH ALERT ON ANOMALY
-- ══════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.update_wallet_balance(_user_id uuid, _amount numeric, _type transaction_type, _description text DEFAULT NULL)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _current_balance NUMERIC;
  _new_balance NUMERIC;
BEGIN
  -- Get current balance with row lock (prevents race conditions)
  SELECT balance INTO _current_balance
  FROM public.wallets
  WHERE user_id = _user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Wallet not found for user';
  END IF;

  -- Calculate new balance
  IF _type IN ('bet', 'withdrawal') THEN
    _new_balance := _current_balance - _amount;
  ELSE
    _new_balance := _current_balance + _amount;
  END IF;

  -- Prevent negative balance
  IF _new_balance < 0 THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

  -- Anomaly detection: large single operation
  IF _amount > 10000 THEN
    INSERT INTO public.financial_alerts (
      alert_type, severity, description, metadata
    ) VALUES (
      'large_wallet_operation', 'warning',
      'Large wallet operation detected',
      jsonb_build_object('user_id', _user_id, 'amount', _amount, 'type', _type, 'description', _description)
    );
  END IF;

  -- Update wallet
  UPDATE public.wallets SET balance = _new_balance, updated_at = now() WHERE user_id = _user_id;

  -- Record transaction
  INSERT INTO public.transactions (user_id, type, amount, description)
  VALUES (_user_id, _type, _amount, _description);

  RETURN _new_balance;
END;
$$;
