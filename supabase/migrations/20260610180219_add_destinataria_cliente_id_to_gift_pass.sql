-- Collega il gift pass direttamente alla scheda cliente della destinataria
ALTER TABLE gift_pass
  ADD COLUMN IF NOT EXISTS destinataria_cliente_id uuid REFERENCES clienti(id) ON DELETE SET NULL;
