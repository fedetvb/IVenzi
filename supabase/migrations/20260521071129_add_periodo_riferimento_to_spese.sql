/*
  # Add periodo_da / periodo_a to spese

  Adds two optional date columns to record the billing period a one-time
  expense (bolletta, ecc.) refers to:
  - periodo_da: start of billing period (date, nullable)
  - periodo_a:  end of billing period   (date, nullable)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'spese' AND column_name = 'periodo_da'
  ) THEN
    ALTER TABLE spese ADD COLUMN periodo_da date;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'spese' AND column_name = 'periodo_a'
  ) THEN
    ALTER TABLE spese ADD COLUMN periodo_a date;
  END IF;
END $$;
