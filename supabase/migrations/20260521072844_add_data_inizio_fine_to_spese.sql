/*
  # Add data_inizio and data_fine to spese

  Adds two optional date columns to control the active period of a recurring entry:
  - data_inizio: date from which the entry is active (defaults to data if not set).
    A recurring entry will not appear in periods before this date.
  - data_fine: optional expiry date. A recurring entry will not appear in periods
    after this date. If null, the entry is open-ended.

  These two fields make it possible to backdate recurring entries (e.g. a monthly
  rent that started in January should appear even if you created the record later)
  and to terminate them (e.g. a subscription that ends in December).
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'spese' AND column_name = 'data_inizio'
  ) THEN
    ALTER TABLE spese ADD COLUMN data_inizio date;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'spese' AND column_name = 'data_fine'
  ) THEN
    ALTER TABLE spese ADD COLUMN data_fine date;
  END IF;
END $$;
