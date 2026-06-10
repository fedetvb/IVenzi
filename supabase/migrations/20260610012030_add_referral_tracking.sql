-- Traccia chi ha regalato la carta (prima che venisse trasferita)
ALTER TABLE carte_sconto
  ADD COLUMN IF NOT EXISTS regalata_da_cliente_id uuid REFERENCES clienti(id) ON DELETE SET NULL;

-- Traccia il nome di chi ha presentato la cliente nella scheda da confermare
ALTER TABLE schede_clienti_da_confermare
  ADD COLUMN IF NOT EXISTS presentata_da_nome text;
