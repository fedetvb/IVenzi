-- Allow anon to read gift_pass by codice (for activation lookup)
CREATE POLICY "gift_pass_anon_select" ON gift_pass
  FOR SELECT TO anon
  USING (true);

-- Allow anon to activate (PATCH attivata_at) only passes not yet activated
CREATE POLICY "gift_pass_anon_activate" ON gift_pass
  FOR UPDATE TO anon
  USING (attivata_at IS NULL AND utilizzata = false)
  WITH CHECK (attivata_at IS NOT NULL);
