
-- Create sponsors storage bucket (public read)
INSERT INTO storage.buckets (id, name, public)
VALUES ('sponsors', 'sponsors', true)
ON CONFLICT (id) DO NOTHING;

-- Public read
DROP POLICY IF EXISTS "sponsors_public_read" ON storage.objects;
CREATE POLICY "sponsors_public_read"
ON storage.objects FOR SELECT
USING (bucket_id = 'sponsors');

-- Authenticated users can upload (RLS in arena_sponsors gates who can write metadata)
DROP POLICY IF EXISTS "sponsors_auth_insert" ON storage.objects;
CREATE POLICY "sponsors_auth_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'sponsors');

DROP POLICY IF EXISTS "sponsors_auth_update" ON storage.objects;
CREATE POLICY "sponsors_auth_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'sponsors');

DROP POLICY IF EXISTS "sponsors_auth_delete" ON storage.objects;
CREATE POLICY "sponsors_auth_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'sponsors');
