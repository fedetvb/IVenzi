ALTER TABLE richieste_appuntamento
  ADD COLUMN IF NOT EXISTS chiunque BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS parrucchieri_candidati UUID[] DEFAULT NULL;
