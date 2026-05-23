/*
  # Fix policy aggiornamento schede da confermare

  La policy UPDATE era limitata al ruolo authenticated,
  ma il gestionale usa il client anon. Estesa a anon + authenticated.
*/

DROP POLICY IF EXISTS "Solo autenticati possono aggiornare le schede" ON schede_clienti_da_confermare;

CREATE POLICY "Anon e autenticati possono aggiornare le schede"
  ON schede_clienti_da_confermare
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);
