
-- Create storage bucket for scratch card images
INSERT INTO storage.buckets (id, name, public) VALUES ('scratch-images', 'scratch-images', true);

-- Public read access
CREATE POLICY "Public read scratch images"
ON storage.objects FOR SELECT
USING (bucket_id = 'scratch-images');

-- Admin upload/update/delete
CREATE POLICY "Admins manage scratch images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'scratch-images' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update scratch images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'scratch-images' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete scratch images"
ON storage.objects FOR DELETE
USING (bucket_id = 'scratch-images' AND public.has_role(auth.uid(), 'admin'));
