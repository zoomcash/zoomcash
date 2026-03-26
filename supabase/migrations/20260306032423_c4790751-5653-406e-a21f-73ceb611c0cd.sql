
-- Advisory lock function for financial operations
-- Uses pg_advisory_xact_lock which auto-releases at transaction end
CREATE OR REPLACE FUNCTION public.acquire_processing_lock(_lock_key text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  _hash bigint;
BEGIN
  -- Convert text key to bigint hash for pg_advisory_xact_lock
  _hash := ('x' || left(md5(_lock_key), 15))::bit(64)::bigint;
  PERFORM pg_advisory_xact_lock(_hash);
  RETURN true;
END;
$$;

-- Processing locks table for distributed lock tracking
CREATE TABLE IF NOT EXISTS public.processing_locks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lock_key text NOT NULL,
  locked_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '5 minutes'),
  locked_by text NOT NULL DEFAULT 'system',
  released_at timestamptz,
  CONSTRAINT unique_active_lock UNIQUE (lock_key)
);

ALTER TABLE public.processing_locks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No client access to processing_locks"
ON public.processing_locks FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);

-- Function to acquire a distributed lock (returns false if already locked)
CREATE OR REPLACE FUNCTION public.try_acquire_lock(_lock_key text, _locked_by text DEFAULT 'system', _ttl_seconds int DEFAULT 300)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Clean expired locks first
  DELETE FROM public.processing_locks WHERE expires_at < now();
  
  -- Try to insert (unique constraint prevents duplicates)
  BEGIN
    INSERT INTO public.processing_locks (lock_key, locked_by, expires_at)
    VALUES (_lock_key, _locked_by, now() + (_ttl_seconds || ' seconds')::interval);
    RETURN true;
  EXCEPTION WHEN unique_violation THEN
    RETURN false;
  END;
END;
$$;

-- Function to release a lock
CREATE OR REPLACE FUNCTION public.release_lock(_lock_key text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  DELETE FROM public.processing_locks WHERE lock_key = _lock_key;
END;
$$;

-- Idempotent deposit processing function
-- Atomically checks deposit status + updates + credits wallet
CREATE OR REPLACE FUNCTION public.process_deposit_payment(
  _deposit_id uuid,
  _fee_amount numeric,
  _credit_amount numeric
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  _deposit RECORD;
BEGIN
  -- Lock the deposit row
  SELECT * INTO _deposit FROM public.deposits
  WHERE id = _deposit_id FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Deposit not found';
  END IF;
  
  -- Idempotency: if already processed, return false (no error)
  IF _deposit.status != 'pending' THEN
    RETURN false;
  END IF;
  
  -- Update deposit status atomically
  UPDATE public.deposits SET status = 'completed' WHERE id = _deposit_id;
  
  -- Credit wallet
  PERFORM public.update_wallet_balance(
    _deposit.user_id,
    _credit_amount,
    'deposit',
    format('Depósito PIX - R$ %s (taxa: R$ %s, creditado: R$ %s)',
      _deposit.amount::text, _fee_amount::text, _credit_amount::text)
  );
  
  RETURN true;
END;
$$;

-- Idempotent withdrawal failure refund function
CREATE OR REPLACE FUNCTION public.process_withdrawal_failure(
  _withdrawal_id uuid,
  _failure_reason text DEFAULT 'Falha no gateway'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  _withdrawal RECORD;
BEGIN
  -- Lock the withdrawal row
  SELECT * INTO _withdrawal FROM public.withdrawals
  WHERE id = _withdrawal_id FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  -- Only process if still in processing state
  IF _withdrawal.status != 'processing' THEN
    RETURN false;
  END IF;
  
  -- Refund wallet
  PERFORM public.update_wallet_balance(
    _withdrawal.user_id,
    _withdrawal.amount,
    'bonus',
    format('Estorno saque falho - R$ %s', _withdrawal.amount::text)
  );
  
  -- Update withdrawal status
  UPDATE public.withdrawals 
  SET status = 'failed', 
      admin_note = COALESCE(admin_note, '') || ' | ' || _failure_reason,
      updated_at = now()
  WHERE id = _withdrawal_id;
  
  RETURN true;
END;
$$;
