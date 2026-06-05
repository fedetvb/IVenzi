-- Aggiunge foto_url alla tabella schede_clienti_da_confermare
ALTER TABLE schede_clienti_da_confermare ADD COLUMN IF NOT EXISTS foto_url TEXT DEFAULT '';

-- Crea bucket Storage per le foto clienti (se non esiste)
INSERT INTO storage.buckets (id, name, public)
VALUES ('foto-clienti', 'foto-clienti', true)
ON CONFLICT (id) DO NOTHING;

-- Policy: chiunque (anon) può caricare foto nel bucket (solo insert)
DROP POLICY IF EXISTS "anon_upload_foto_clienti" ON storage.objects;
CREATE POLICY "anon_upload_foto_clienti" ON storage.objects
  FOR INSERT TO anon
  WITH CHECK (bucket_id = 'foto-clienti');

-- Policy: tutti possono leggere le foto (bucket pubblico)
DROP POLICY IF EXISTS "public_read_foto_clienti" ON storage.objects;
CREATE POLICY "public_read_foto_clienti" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'foto-clienti');

-- Policy: utenti autenticati possono gestire le foto
DROP POLICY IF EXISTS "authenticated_manage_foto_clienti" ON storage.objects;
CREATE POLICY "authenticated_manage_foto_clienti" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'foto-clienti')
  WITH CHECK (bucket_id = 'foto-clienti');
