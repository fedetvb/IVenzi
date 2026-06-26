-- Allow authenticated users (salon owners) to UPDATE system_settings directly
CREATE POLICY "authenticated_update_system_settings" ON system_settings
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Also allow INSERT in case the row doesn't exist
CREATE POLICY "authenticated_insert_system_settings" ON system_settings
  FOR INSERT TO authenticated WITH CHECK (true);
