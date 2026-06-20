ALTER TABLE appuntamenti
  ADD COLUMN IF NOT EXISTS promemoria_inviato_at TIMESTAMPTZ;
