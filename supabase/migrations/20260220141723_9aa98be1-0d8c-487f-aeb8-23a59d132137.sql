
-- Fix permissive UPDATE policy - only allow service role updates via webhook
DROP POLICY "Service role can update deposits" ON public.deposits;

-- No user-facing update policy needed; webhook uses service role key which bypasses RLS
