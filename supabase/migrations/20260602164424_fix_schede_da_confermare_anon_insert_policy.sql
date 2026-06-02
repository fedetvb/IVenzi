
/*
  # Fix schede_clienti_da_confermare anon INSERT policy

  The previous policy allowed anon INSERT with WITH CHECK (true), which is
  flagged as always-true. The form public registration always sends a user_id
  (the salon owner's ID) in the payload, so we restrict inserts to rows
  where user_id IS NOT NULL. This prevents completely anonymous/empty inserts
  while still allowing the public registration form to work.
*/

DROP POLICY IF EXISTS "Anon can insert schede da confermare" ON schede_clienti_da_confermare;

CREATE POLICY "Anon can insert schede da confermare"
  ON schede_clienti_da_confermare FOR INSERT TO anon
  WITH CHECK (user_id IS NOT NULL);
