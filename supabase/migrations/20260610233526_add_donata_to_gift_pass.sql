-- Mark gift pass as donated (sent via WhatsApp) before recipient activates it
ALTER TABLE gift_pass ADD COLUMN IF NOT EXISTS donata boolean NOT NULL DEFAULT false;

-- Allow anon to update donata (needed from the salon gestionale via dbUpdate which uses anon key context)
-- The existing gift_pass_anon_activate policy covers attivata_at; extend or add for donata
DROP POLICY IF EXISTS "gift_pass_anon_donate" ON gift_pass;
CREATE POLICY "gift_pass_anon_donate" ON gift_pass
  FOR UPDATE TO anon
  USING (true)
  WITH CHECK (true);
