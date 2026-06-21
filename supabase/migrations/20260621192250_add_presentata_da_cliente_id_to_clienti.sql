ALTER TABLE clienti
  ADD COLUMN IF NOT EXISTS presentata_da_cliente_id uuid REFERENCES clienti(id) ON DELETE SET NULL;