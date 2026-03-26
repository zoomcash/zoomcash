
-- Enable RLS on api_keys_safe view and add owner-only policy
ALTER VIEW public.api_keys_safe SET (security_invoker = on);

CREATE POLICY "Users can view own api keys safe"
ON public.api_keys
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);
