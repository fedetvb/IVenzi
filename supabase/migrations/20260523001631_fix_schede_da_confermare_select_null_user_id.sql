/*
  # Fix policy schede_clienti_da_confermare

  Permette all'utente autenticato di vedere anche le schede con user_id IS NULL
  (inviate dal form pubblico prima dell'assegnazione).
*/

DROP POLICY IF EXISTS "schede_clienti_da_confermare_select" ON schede_clienti_da_confermare;

CREATE POLICY "schede_clienti_da_confermare_select" ON schede_clienti_da_confermare
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR user_id IS NULL);

DROP POLICY IF EXISTS "schede_clienti_da_confermare_update" ON schede_clienti_da_confermare;

CREATE POLICY "schede_clienti_da_confermare_update" ON schede_clienti_da_confermare
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR user_id IS NULL)
  WITH CHECK (true);

DROP POLICY IF EXISTS "schede_clienti_da_confermare_delete" ON schede_clienti_da_confermare;

CREATE POLICY "schede_clienti_da_confermare_delete" ON schede_clienti_da_confermare
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR user_id IS NULL);
