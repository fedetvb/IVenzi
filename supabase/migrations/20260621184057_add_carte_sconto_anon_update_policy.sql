-- Permette agli utenti anonimi (portale online) di aggiornare una carta sconto
-- per il flusso di donazione, specularmente alla policy gift_pass_anon_donate
CREATE POLICY "carte_sconto_anon_donate"
  ON carte_sconto
  FOR UPDATE
  TO anon
  USING (regalata = false)
  WITH CHECK (regalata = true);
