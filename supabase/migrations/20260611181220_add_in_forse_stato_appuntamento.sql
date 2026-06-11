-- Extend the stato check constraint to include 'in_forse'
ALTER TABLE appuntamenti DROP CONSTRAINT IF EXISTS appuntamenti_stato_check;
ALTER TABLE appuntamenti ADD CONSTRAINT appuntamenti_stato_check
  CHECK (stato IN ('confermato', 'in_attesa', 'completato', 'cancellato', 'in_forse'));
