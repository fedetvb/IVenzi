/*
  # Allow authenticated users to read system impostazioni rows

  The keep-alive cron writes rows with user_id = NULL (service role).
  Existing RLS SELECT policies only allow reading rows where user_id = auth.uid(),
  making system rows invisible to authenticated users.

  This migration adds a SELECT policy so authenticated users can also read
  rows where user_id IS NULL (system/global settings like keep_alive_last_ping).
*/

CREATE POLICY "Users can read system impostazioni"
  ON impostazioni
  FOR SELECT
  TO authenticated
  USING (user_id IS NULL);
