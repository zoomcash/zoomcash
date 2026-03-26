
-- ══════════════════════════════════════════
-- 1) PAYMENT INTENTS TABLE
-- ══════════════════════════════════════════

CREATE TYPE public.payment_intent_status AS ENUM (
  'requires_payment', 'processing', 'succeeded', 'failed', 'cancelled'
);

CREATE TABLE public.payment_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES public.merchants(id),
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'BRL',
  status payment_intent_status NOT NULL DEFAULT 'requires_payment',
  payment_method text NOT NULL DEFAULT 'pix',
  provider text NOT NULL DEFAULT 'misticpay',
  idempotency_key text NOT NULL,
  description text,
  customer_email text,
  customer_document text,
  metadata jsonb DEFAULT '{}'::jsonb,
  gateway_transaction_id uuid REFERENCES public.gateway_transactions(id),
  risk_score integer NOT NULL DEFAULT 0,
  succeeded_at timestamptz,
  failed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (merchant_id, idempotency_key)
);

-- Trigger for updated_at
CREATE TRIGGER update_payment_intents_updated_at
  BEFORE UPDATE ON public.payment_intents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.payment_intents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.payment_intents FROM anon;

CREATE POLICY "Merchant owner views intents" ON public.payment_intents
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM merchants WHERE merchants.id = payment_intents.merchant_id AND merchants.user_id = auth.uid()));

CREATE POLICY "Admins view all intents" ON public.payment_intents
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Indexes
CREATE INDEX idx_pi_merchant ON public.payment_intents(merchant_id);
CREATE INDEX idx_pi_status ON public.payment_intents(status);
CREATE INDEX idx_pi_idempotency ON public.payment_intents(merchant_id, idempotency_key);

-- ══════════════════════════════════════════
-- 2) FRAUD SCORES TABLE
-- ══════════════════════════════════════════

CREATE TABLE public.fraud_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid REFERENCES public.gateway_transactions(id),
  payment_intent_id uuid REFERENCES public.payment_intents(id),
  merchant_id uuid NOT NULL REFERENCES public.merchants(id),
  risk_score integer NOT NULL DEFAULT 0,
  flags jsonb NOT NULL DEFAULT '[]'::jsonb,
  ip_address text,
  user_agent text,
  decision text NOT NULL DEFAULT 'allow',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.fraud_scores ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.fraud_scores FROM anon;

CREATE POLICY "Admins view fraud scores" ON public.fraud_scores
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Merchant owner views own fraud scores" ON public.fraud_scores
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM merchants WHERE merchants.id = fraud_scores.merchant_id AND merchants.user_id = auth.uid()));

CREATE INDEX idx_fraud_tx ON public.fraud_scores(transaction_id);
CREATE INDEX idx_fraud_pi ON public.fraud_scores(payment_intent_id);
CREATE INDEX idx_fraud_high ON public.fraud_scores(risk_score) WHERE risk_score >= 70;

-- ══════════════════════════════════════════
-- 3) AUDIT LOG TABLE (immutable)
-- ══════════════════════════════════════════

CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  action text NOT NULL,
  actor_type text NOT NULL DEFAULT 'system',
  actor_id text,
  old_state jsonb,
  new_state jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.audit_log FROM anon;

CREATE POLICY "Admins view audit log" ON public.audit_log
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "No client mutations" ON public.audit_log
  FOR INSERT TO authenticated WITH CHECK (false);

CREATE POLICY "No client update" ON public.audit_log
  FOR UPDATE TO authenticated USING (false);

CREATE POLICY "No client delete" ON public.audit_log
  FOR DELETE TO authenticated USING (false);

CREATE INDEX idx_audit_entity ON public.audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_action ON public.audit_log(action);
CREATE INDEX idx_audit_created ON public.audit_log(created_at);

-- ══════════════════════════════════════════
-- 4) PROCESSING QUEUE TABLE
-- ══════════════════════════════════════════

CREATE TABLE public.processing_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_name text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  priority integer NOT NULL DEFAULT 0,
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 5,
  last_error text,
  locked_at timestamptz,
  locked_by text,
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.processing_queue ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.processing_queue FROM anon;

CREATE POLICY "Admins view queue" ON public.processing_queue
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_queue_pending ON public.processing_queue(queue_name, status, scheduled_at)
  WHERE status = 'pending';

-- ══════════════════════════════════════════
-- 5) RPC: Create Payment Intent (idempotent)
-- ══════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.create_payment_intent(
  _merchant_id uuid,
  _amount numeric,
  _idempotency_key text,
  _payment_method text DEFAULT 'pix',
  _description text DEFAULT NULL,
  _customer_email text DEFAULT NULL,
  _customer_document text DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  _pi_id UUID;
  _existing_id UUID;
  _merchant RECORD;
BEGIN
  SELECT * INTO _merchant FROM public.merchants WHERE id = _merchant_id AND status = 'active';
  IF NOT FOUND THEN RAISE EXCEPTION 'Merchant not found or inactive'; END IF;
  IF _amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;

  -- Idempotency check
  SELECT id INTO _existing_id FROM public.payment_intents
    WHERE merchant_id = _merchant_id AND idempotency_key = _idempotency_key;
  IF FOUND THEN RETURN _existing_id; END IF;

  INSERT INTO public.payment_intents (
    merchant_id, amount, payment_method, idempotency_key,
    description, customer_email, customer_document, metadata
  ) VALUES (
    _merchant_id, _amount, _payment_method, _idempotency_key,
    _description, _customer_email, _customer_document, _metadata
  ) RETURNING id INTO _pi_id;

  RETURN _pi_id;
END;
$$;

-- ══════════════════════════════════════════
-- 6) RPC: Update Payment Intent Status
-- ══════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.update_payment_intent_status(
  _pi_id uuid,
  _new_status payment_intent_status,
  _gateway_tx_id uuid DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  _pi RECORD;
BEGIN
  SELECT * INTO _pi FROM public.payment_intents WHERE id = _pi_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payment intent not found'; END IF;

  -- Validate transitions
  IF _pi.status = 'succeeded' OR _pi.status = 'cancelled' THEN
    RAISE EXCEPTION 'Cannot transition from terminal state %', _pi.status;
  END IF;
  IF _pi.status = 'failed' AND _new_status NOT IN ('requires_payment') THEN
    RAISE EXCEPTION 'Failed intents can only retry to requires_payment';
  END IF;

  UPDATE public.payment_intents SET
    status = _new_status,
    gateway_transaction_id = COALESCE(_gateway_tx_id, gateway_transaction_id),
    succeeded_at = CASE WHEN _new_status = 'succeeded' THEN now() ELSE succeeded_at END,
    failed_at = CASE WHEN _new_status = 'failed' THEN now() ELSE failed_at END,
    cancelled_at = CASE WHEN _new_status = 'cancelled' THEN now() ELSE cancelled_at END
  WHERE id = _pi_id;

  RETURN true;
END;
$$;

-- ══════════════════════════════════════════
-- 7) Enhanced risk scoring with flags
-- ══════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.calculate_enhanced_risk(
  _merchant_id uuid,
  _amount numeric,
  _customer_document text DEFAULT NULL,
  _ip_address text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  _score INTEGER := 0;
  _flags jsonb := '[]'::jsonb;
  _recent_count INTEGER;
  _avg_amount NUMERIC;
  _ip_count INTEGER;
  _decision TEXT := 'allow';
BEGIN
  -- Frequency check (5 min window)
  SELECT COUNT(*) INTO _recent_count FROM public.gateway_transactions
    WHERE merchant_id = _merchant_id AND created_at > now() - interval '5 minutes';
  IF _recent_count > 10 THEN _score := _score + 30; _flags := _flags || '["high_frequency"]'::jsonb; END IF;
  IF _recent_count > 20 THEN _score := _score + 20; _flags := _flags || '["very_high_frequency"]'::jsonb; END IF;

  -- Amount anomaly
  SELECT AVG(amount) INTO _avg_amount FROM public.gateway_transactions
    WHERE merchant_id = _merchant_id AND status = 'paid' AND created_at > now() - interval '30 days';
  IF _avg_amount IS NOT NULL AND _amount > _avg_amount * 5 THEN
    _score := _score + 25; _flags := _flags || '["unusual_amount"]'::jsonb;
  END IF;

  -- Document velocity
  IF _customer_document IS NOT NULL THEN
    SELECT COUNT(*) INTO _recent_count FROM public.gateway_transactions
      WHERE merchant_id = _merchant_id AND customer_document = _customer_document
      AND created_at > now() - interval '1 hour';
    IF _recent_count > 3 THEN _score := _score + 20; _flags := _flags || '["document_velocity"]'::jsonb; END IF;
  END IF;

  -- IP velocity
  IF _ip_address IS NOT NULL THEN
    SELECT COUNT(*) INTO _ip_count FROM public.fraud_scores
      WHERE merchant_id = _merchant_id AND ip_address = _ip_address
      AND created_at > now() - interval '10 minutes';
    IF _ip_count > 5 THEN _score := _score + 15; _flags := _flags || '["ip_velocity"]'::jsonb; END IF;
  END IF;

  _score := LEAST(_score, 100);
  IF _score >= 70 THEN _decision := 'review'; END IF;
  IF _score >= 90 THEN _decision := 'block'; END IF;

  RETURN jsonb_build_object('score', _score, 'flags', _flags, 'decision', _decision);
END;
$$;
