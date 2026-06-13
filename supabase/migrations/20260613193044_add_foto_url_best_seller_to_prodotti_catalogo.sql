ALTER TABLE prodotti_rivendita_catalogo
  ADD COLUMN IF NOT EXISTS foto_url text,
  ADD COLUMN IF NOT EXISTS best_seller boolean NOT NULL DEFAULT false;
