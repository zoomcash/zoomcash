
-- Fix 1: Hide prize weights from public access
-- Drop the overly permissive public SELECT policy
DROP POLICY "Anyone can view prizes" ON public.scratch_card_prizes;

-- Create a new policy that only exposes non-sensitive columns via RLS
-- Since RLS can't filter columns, we create a view instead
CREATE VIEW public.scratch_card_prizes_public AS
SELECT id, card_id, symbol, label, value, sort_order
FROM public.scratch_card_prizes;

-- Allow authenticated users to select from the view (no weight exposed)
GRANT SELECT ON public.scratch_card_prizes_public TO anon, authenticated;

-- Re-add a restricted SELECT policy for authenticated users only (without weight filtering - view handles that)
CREATE POLICY "Authenticated users can view prizes"
ON public.scratch_card_prizes
FOR SELECT
TO authenticated
USING (true);

-- Fix 2: Add PIX key length constraint on withdrawals
ALTER TABLE public.withdrawals
ADD CONSTRAINT pix_key_length CHECK (length(pix_key) >= 3 AND length(pix_key) <= 100);
