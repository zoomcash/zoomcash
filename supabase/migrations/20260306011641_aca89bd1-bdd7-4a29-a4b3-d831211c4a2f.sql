
-- Add 'reconciliation' to security_event_type enum
ALTER TYPE public.security_event_type ADD VALUE IF NOT EXISTS 'duplicate_payment';
ALTER TYPE public.security_event_type ADD VALUE IF NOT EXISTS 'critical_financial_mismatch';
ALTER TYPE public.security_event_type ADD VALUE IF NOT EXISTS 'auto_reconciled';

-- Create reconciliation_checks table
CREATE TABLE public.reconciliation_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid REFERENCES public.gateway_transactions(id) NOT NULL,
  provider_transaction_id text,
  expected_status text NOT NULL,
  provider_status text,
  mismatch_type text NOT NULL DEFAULT 'status_mismatch',
  mismatch_detected boolean NOT NULL DEFAULT true,
  resolved boolean NOT NULL DEFAULT false,
  resolved_at timestamptz,
  resolution_method text,
  resolution_details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.reconciliation_checks ENABLE ROW LEVEL SECURITY;

-- Only admins can view
CREATE POLICY "Admins view reconciliation" ON public.reconciliation_checks
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- No client insert/update/delete
CREATE POLICY "No client insert" ON public.reconciliation_checks
  FOR INSERT TO authenticated
  WITH CHECK (false);

CREATE POLICY "No client update" ON public.reconciliation_checks
  FOR UPDATE TO authenticated
  USING (false);

CREATE POLICY "No client delete" ON public.reconciliation_checks
  FOR DELETE TO authenticated
  USING (false);

-- Revoke anon access
REVOKE ALL ON public.reconciliation_checks FROM anon;

-- Index for fast lookups
CREATE INDEX idx_reconciliation_transaction ON public.reconciliation_checks(transaction_id);
CREATE INDEX idx_reconciliation_unresolved ON public.reconciliation_checks(resolved) WHERE resolved = false;
