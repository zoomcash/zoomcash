
-- 1) Revoke anon access on ALL sensitive tables
REVOKE ALL ON public.profiles FROM anon;
REVOKE ALL ON public.wallets FROM anon;
REVOKE ALL ON public.withdrawals FROM anon;
REVOKE ALL ON public.api_keys FROM anon;
REVOKE ALL ON public.transactions FROM anon;
REVOKE ALL ON public.ledger_entries FROM anon;
REVOKE ALL ON public.merchants FROM anon;
REVOKE ALL ON public.gateway_transactions FROM anon;
REVOKE ALL ON public.security_events FROM anon;
REVOKE ALL ON public.webhook_events FROM anon;
REVOKE ALL ON public.webhook_deliveries FROM anon;
REVOKE ALL ON public.payment_attempts FROM anon;
REVOKE ALL ON public.deposits FROM anon;
REVOKE ALL ON public.bets FROM anon;
REVOKE ALL ON public.referral_commissions FROM anon;
REVOKE ALL ON public.referrals FROM anon;
REVOKE ALL ON public.referral_codes FROM anon;
REVOKE ALL ON public.user_roles FROM anon;

-- 2) Create secure view for merchants (hides api_key_hash and webhook_secret)
CREATE OR REPLACE VIEW public.merchants_safe
WITH (security_invoker = on) AS
SELECT id, name, user_id, webhook_url, status, api_key_prefix, rate_limit_per_minute, created_at, updated_at
FROM public.merchants;

-- 3) Create secure view for api_keys (hides key_hash)
CREATE OR REPLACE VIEW public.api_keys_safe
WITH (security_invoker = on) AS
SELECT id, user_id, name, key_prefix, last_used_at, created_at
FROM public.api_keys;
