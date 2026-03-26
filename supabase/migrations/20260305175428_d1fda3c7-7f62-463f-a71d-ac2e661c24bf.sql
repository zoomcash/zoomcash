
-- ==========================================
-- GATEWAY PAYMENT SYSTEM - COMPLETE SCHEMA
-- ==========================================

-- 1) ENUMS
CREATE TYPE public.merchant_status AS ENUM ('active', 'suspended', 'pending_review');
CREATE TYPE public.gateway_tx_status AS ENUM ('pending', 'processing', 'paid', 'failed', 'refunded', 'cancelled', 'review_required');
CREATE TYPE public.payment_attempt_status AS ENUM ('pending', 'success', 'failed', 'timeout');
CREATE TYPE public.webhook_delivery_status AS ENUM ('pending', 'sent', 'failed', 'retrying');
CREATE TYPE public.ledger_entry_type AS ENUM ('credit', 'debit', 'fee', 'refund');
CREATE TYPE public.security_event_type AS ENUM ('api_key_created', 'api_key_rotated', 'rate_limit_hit', 'suspicious_transaction', 'webhook_signature_invalid', 'unauthorized_access', 'high_risk_transaction');

-- 2) MERCHANTS TABLE
CREATE TABLE public.merchants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  api_key_hash TEXT NOT NULL,
  api_key_prefix TEXT NOT NULL,
  webhook_url TEXT,
  webhook_secret TEXT NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  status public.merchant_status NOT NULL DEFAULT 'active',
  rate_limit_per_minute INTEGER NOT NULL DEFAULT 60,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id),
  UNIQUE(api_key_prefix)
);

-- 3) GATEWAY TRANSACTIONS TABLE
CREATE TABLE public.gateway_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE RESTRICT,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'BRL',
  payment_method TEXT NOT NULL DEFAULT 'pix',
  status public.gateway_tx_status NOT NULL DEFAULT 'pending',
  idempotency_key TEXT NOT NULL,
  description TEXT,
  customer_email TEXT,
  customer_document TEXT,
  risk_score INTEGER NOT NULL DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  provider_transaction_id TEXT,
  pix_qrcode_url TEXT,
  pix_copy_paste TEXT,
  paid_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(merchant_id, idempotency_key)
);

-- 4) PAYMENT ATTEMPTS TABLE
CREATE TABLE public.payment_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id UUID NOT NULL REFERENCES public.gateway_transactions(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'misticpay',
  status public.payment_attempt_status NOT NULL DEFAULT 'pending',
  provider_response JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5) WEBHOOK EVENTS (inbound from provider)
CREATE TABLE public.webhook_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id UUID REFERENCES public.gateway_transactions(id),
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  signature TEXT,
  signature_valid BOOLEAN DEFAULT false,
  processed BOOLEAN NOT NULL DEFAULT false,
  processed_at TIMESTAMPTZ,
  source_ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6) WEBHOOK DELIVERIES (outbound to merchant)
CREATE TABLE public.webhook_deliveries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  transaction_id UUID NOT NULL REFERENCES public.gateway_transactions(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  status public.webhook_delivery_status NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  next_retry_at TIMESTAMPTZ,
  last_response_code INTEGER,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7) LEDGER ENTRIES (immutable financial log)
CREATE TABLE public.ledger_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE RESTRICT,
  transaction_id UUID REFERENCES public.gateway_transactions(id),
  entry_type public.ledger_entry_type NOT NULL,
  amount NUMERIC NOT NULL,
  balance_after NUMERIC NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8) SECURITY EVENTS
CREATE TABLE public.security_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id UUID REFERENCES public.merchants(id),
  event_type public.security_event_type NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9) INDEXES
CREATE INDEX idx_gateway_transactions_merchant ON public.gateway_transactions(merchant_id);
CREATE INDEX idx_gateway_transactions_status ON public.gateway_transactions(status);
CREATE INDEX idx_gateway_transactions_idempotency ON public.gateway_transactions(merchant_id, idempotency_key);
CREATE INDEX idx_gateway_transactions_created ON public.gateway_transactions(created_at DESC);
CREATE INDEX idx_payment_attempts_transaction ON public.payment_attempts(transaction_id);
CREATE INDEX idx_webhook_events_transaction ON public.webhook_events(transaction_id);
CREATE INDEX idx_webhook_events_processed ON public.webhook_events(processed);
CREATE INDEX idx_webhook_deliveries_status ON public.webhook_deliveries(status);
CREATE INDEX idx_webhook_deliveries_next_retry ON public.webhook_deliveries(next_retry_at) WHERE status IN ('pending', 'retrying');
CREATE INDEX idx_ledger_entries_merchant ON public.ledger_entries(merchant_id);
CREATE INDEX idx_ledger_entries_transaction ON public.ledger_entries(transaction_id);
CREATE INDEX idx_security_events_merchant ON public.security_events(merchant_id);
CREATE INDEX idx_security_events_type ON public.security_events(event_type);
CREATE INDEX idx_merchants_api_key_prefix ON public.merchants(api_key_prefix);

-- 10) RLS POLICIES
ALTER TABLE public.merchants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gateway_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

-- Merchants: owners see their own, admins see all
CREATE POLICY "Merchants can view own" ON public.merchants FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Merchants can update own" ON public.merchants FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Authenticated can create merchant" ON public.merchants FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins view all merchants" ON public.merchants FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- Gateway Transactions: merchant owners only
CREATE POLICY "Merchant owner views transactions" ON public.gateway_transactions FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.merchants WHERE id = merchant_id AND user_id = auth.uid()));
CREATE POLICY "Admins view all gateway transactions" ON public.gateway_transactions FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Payment Attempts: via transaction ownership
CREATE POLICY "Merchant owner views attempts" ON public.payment_attempts FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.gateway_transactions gt
    JOIN public.merchants m ON m.id = gt.merchant_id
    WHERE gt.id = transaction_id AND m.user_id = auth.uid()
  ));
CREATE POLICY "Admins view all attempts" ON public.payment_attempts FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Webhook Events: admins only (sensitive)
CREATE POLICY "Admins view webhook events" ON public.webhook_events FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Webhook Deliveries: merchant owners
CREATE POLICY "Merchant owner views deliveries" ON public.webhook_deliveries FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.merchants WHERE id = merchant_id AND user_id = auth.uid()));
CREATE POLICY "Admins view all deliveries" ON public.webhook_deliveries FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Ledger Entries: merchant owners
CREATE POLICY "Merchant owner views ledger" ON public.ledger_entries FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.merchants WHERE id = merchant_id AND user_id = auth.uid()));
CREATE POLICY "Admins view all ledger" ON public.ledger_entries FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Security Events: admins only
CREATE POLICY "Admins view security events" ON public.security_events FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- 11) TRIGGERS for updated_at
CREATE TRIGGER update_merchants_updated_at BEFORE UPDATE ON public.merchants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_gateway_transactions_updated_at BEFORE UPDATE ON public.gateway_transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_webhook_deliveries_updated_at BEFORE UPDATE ON public.webhook_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 12) PREVENT LEDGER DELETION/UPDATE (immutability)
CREATE POLICY "No one can delete ledger entries" ON public.ledger_entries FOR DELETE USING (false);
CREATE POLICY "No one can update ledger entries" ON public.ledger_entries FOR UPDATE USING (false);
