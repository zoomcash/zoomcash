
-- Fix the security definer view issue
ALTER VIEW public.scratch_card_prizes_public SET (security_invoker = on);
