/*
  # Fix policy DELETE schede da confermare + password eliminazione

  1. La policy DELETE era limitata ad authenticated; estesa ad anon + authenticated
  2. Aggiunge la chiave impostazione per la password di eliminazione schede
*/

DROP POLICY IF EXISTS "Solo autenticati possono eliminare le schede" ON schede_clienti_da_confermare;

CREATE POLICY "Anon e autenticati possono eliminare le schede"
  ON schede_clienti_da_confermare
  FOR DELETE
  TO anon, authenticated
  USING (true);

INSERT INTO impostazioni (chiave, valore)
VALUES ('password_elimina_schede', '1234')
ON CONFLICT (chiave) DO NOTHING;
