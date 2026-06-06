-- Allow authenticated users to delete their own logo from foto-clienti bucket
DROP POLICY IF EXISTS "authenticated_delete_foto_clienti" ON storage.objects;
CREATE POLICY "authenticated_delete_foto_clienti" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'foto-clienti');
