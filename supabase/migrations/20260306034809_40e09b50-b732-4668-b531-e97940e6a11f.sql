
-- 1. Rate limit events table
CREATE TABLE public.rate_limit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_source text NOT NULL DEFAULT 'gateway-api',
  identifier_type text NOT NULL DEFAULT 'merchant_id',
  identifier_value text NOT NULL,
  ip_address text,
  endpoint text,
  limit_value integer NOT NULL DEFAULT 100,
  current_count integer NOT NULL DEFAULT 0,
  blocked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.rate_limit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view rate limit events" ON public.rate_limit_events
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "No client insert rate_limit_events" ON public.rate_limit_events
  FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "No client update rate_limit_events" ON public.rate_limit_events
  FOR UPDATE TO authenticated USING (false);
CREATE POLICY "No client delete rate_limit_events" ON public.rate_limit_events
  FOR DELETE TO authenticated USING (false);

CREATE INDEX idx_rate_limit_events_created ON public.rate_limit_events (created_at DESC);
CREATE INDEX idx_rate_limit_events_identifier ON public.rate_limit_events (identifier_type, identifier_value);

-- 2. System metrics table (time-series)
CREATE TABLE public.system_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_name text NOT NULL,
  metric_value numeric NOT NULL DEFAULT 0,
  tags jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.system_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view system metrics" ON public.system_metrics
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "No client insert system_metrics" ON public.system_metrics
  FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "No client update system_metrics" ON public.system_metrics
  FOR UPDATE TO authenticated USING (false);
CREATE POLICY "No client delete system_metrics" ON public.system_metrics
  FOR DELETE TO authenticated USING (false);

CREATE INDEX idx_system_metrics_name_created ON public.system_metrics (metric_name, created_at DESC);

-- 3. System alerts table
CREATE TABLE public.system_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type text NOT NULL,
  severity text NOT NULL DEFAULT 'warning',
  message text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}',
  source text NOT NULL DEFAULT 'system',
  resolved boolean NOT NULL DEFAULT false,
  resolved_at timestamptz,
  resolved_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.system_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view system alerts" ON public.system_alerts
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update system alerts" ON public.system_alerts
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "No client insert system_alerts" ON public.system_alerts
  FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "No client delete system_alerts" ON public.system_alerts
  FOR DELETE TO authenticated USING (false);

CREATE INDEX idx_system_alerts_resolved ON public.system_alerts (resolved, created_at DESC);
CREATE INDEX idx_system_alerts_severity ON public.system_alerts (severity, created_at DESC);
