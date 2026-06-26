CREATE TABLE IF NOT EXISTS system_settings (
  setting_key  VARCHAR(255) PRIMARY KEY,
  setting_value TEXT NOT NULL
);

ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_select_system_settings" ON system_settings
  FOR SELECT TO anon, authenticated USING (true);

-- Seed the default unlock password
INSERT INTO system_settings (setting_key, setting_value)
VALUES ('app_unlock_password', 'Venzi2026')
ON CONFLICT (setting_key) DO NOTHING;
