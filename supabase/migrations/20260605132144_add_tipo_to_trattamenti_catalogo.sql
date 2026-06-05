ALTER TABLE trattamenti_catalogo
  ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'servizio';
