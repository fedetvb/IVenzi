CREATE POLICY "anon_read_recensioni_keys" ON impostazioni
  FOR SELECT TO anon
  USING (chiave IN (
    'link_recensioni_google',
    'testo_recensioni_google',
    'logo_recensioni_google_url',
    'nome_salone'
  ));
