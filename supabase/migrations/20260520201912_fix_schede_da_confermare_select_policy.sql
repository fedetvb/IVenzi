/*
  # Fix policy lettura schede da confermare

  Il gestionale usa il client anonimo (senza autenticazione),
  quindi la policy SELECT limitata a "authenticated" impedisce
  di vedere le schede in arrivo. La sostituiamo con una policy
  che include anche il ruolo anon.
*/

DROP POLICY IF EXISTS "Solo autenticati possono leggere le schede" ON schede_clienti_da_confermare;

CREATE POLICY "Anon e autenticati possono leggere le schede"
  ON schede_clienti_da_confermare
  FOR SELECT
  TO anon, authenticated
  USING (true);
