
-- API Keys table for credentials management
CREATE TABLE public.api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'API Key',
  key_prefix text NOT NULL,
  key_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own api keys" ON public.api_keys
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own api keys" ON public.api_keys
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own api keys" ON public.api_keys
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Platform fees table
CREATE TABLE public.platform_fees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pix_fee_percent numeric NOT NULL DEFAULT 0.60,
  pix_fee_fixed numeric NOT NULL DEFAULT 0.35,
  withdrawal_fee_percent numeric NOT NULL DEFAULT 0,
  withdrawal_fee_fixed numeric NOT NULL DEFAULT 1.50,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_fees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view fees" ON public.platform_fees
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can update fees" ON public.platform_fees
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Insert default fees
INSERT INTO public.platform_fees (pix_fee_percent, pix_fee_fixed, withdrawal_fee_percent, withdrawal_fee_fixed)
VALUES (0.60, 0.35, 0, 1.50);

-- Add per-transaction affiliate columns to existing affiliate_settings
ALTER TABLE public.affiliate_settings 
  ADD COLUMN IF NOT EXISTS commission_per_transaction numeric NOT NULL DEFAULT 0.05,
  ADD COLUMN IF NOT EXISTS bonus_threshold integer NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS bonus_amount numeric NOT NULL DEFAULT 5.00;

-- Function to generate API key
CREATE OR REPLACE FUNCTION public.generate_api_key()
RETURNS text
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  _key text;
BEGIN
  _key := 'sk_live_' || encode(gen_random_bytes(32), 'base64');
  _key := replace(replace(_key, '+', ''), '/', '');
  RETURN _key;
END;
$$;
