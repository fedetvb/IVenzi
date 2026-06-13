ALTER TABLE prodotti_rivendita_catalogo
ADD COLUMN IF NOT EXISTS quiz_tags text[] DEFAULT '{}';
