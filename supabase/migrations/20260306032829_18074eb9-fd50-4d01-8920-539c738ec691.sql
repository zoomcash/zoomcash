
-- Table to store gateway test run results (sandbox only)
CREATE TABLE public.gateway_test_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_name text NOT NULL,
  test_category text NOT NULL DEFAULT 'general',
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'passed', 'failed', 'error')),
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text,
  executed_by text,
  duration_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.gateway_test_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view test runs" ON public.gateway_test_runs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "No client insert on test runs" ON public.gateway_test_runs
  FOR INSERT TO authenticated
  WITH CHECK (false);

CREATE POLICY "No client update on test runs" ON public.gateway_test_runs
  FOR UPDATE TO authenticated
  USING (false);

CREATE POLICY "No client delete on test runs" ON public.gateway_test_runs
  FOR DELETE TO authenticated
  USING (false);

-- Index for fast lookups
CREATE INDEX idx_gateway_test_runs_created ON public.gateway_test_runs(created_at DESC);
CREATE INDEX idx_gateway_test_runs_status ON public.gateway_test_runs(status);
