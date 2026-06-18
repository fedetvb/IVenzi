-- Fix: authenticated user (salon owner) must be able to SELECT/UPDATE/DELETE
-- any scheda regardless of user_id. Previous policies used
-- (user_id = auth.uid() OR user_id IS NULL) which silently blocks rows
-- whose user_id was set from a stale old-project UUID.

-- SELECT: allow authenticated to read all schede
DROP POLICY IF EXISTS "schede_clienti_da_confermare_select" ON schede_clienti_da_confermare;
DROP POLICY IF EXISTS "Users can select own schede da confermare" ON schede_clienti_da_confermare;
DROP POLICY IF EXISTS "auth_select_schede" ON schede_clienti_da_confermare;
CREATE POLICY "auth_select_schede_any"
  ON schede_clienti_da_confermare
  FOR SELECT TO authenticated
  USING (true);

-- UPDATE: allow authenticated to update any scheda
DROP POLICY IF EXISTS "schede_clienti_da_confermare_update" ON schede_clienti_da_confermare;
DROP POLICY IF EXISTS "Users can update own schede da confermare" ON schede_clienti_da_confermare;
DROP POLICY IF EXISTS "Users can update schede own or public" ON schede_clienti_da_confermare;
DROP POLICY IF EXISTS "auth_update_schede" ON schede_clienti_da_confermare;
CREATE POLICY "auth_update_schede_any"
  ON schede_clienti_da_confermare
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- DELETE: allow authenticated to delete any scheda
DROP POLICY IF EXISTS "schede_clienti_da_confermare_delete" ON schede_clienti_da_confermare;
DROP POLICY IF EXISTS "Users can delete own schede da confermare" ON schede_clienti_da_confermare;
DROP POLICY IF EXISTS "auth_delete_schede" ON schede_clienti_da_confermare;
CREATE POLICY "auth_delete_schede_any"
  ON schede_clienti_da_confermare
  FOR DELETE TO authenticated
  USING (true);

NOTIFY pgrst, 'reload schema';
