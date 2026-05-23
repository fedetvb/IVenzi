/*
  # Add IVA fields to spese table

  Allows tracking the VAT component of each expense separately,
  so the user can enter the net amount + VAT rate and have the
  gross total calculated automatically.

  ## Changes to `spese`
  - `aliquota_iva` (numeric, default 0) — VAT rate in percent (e.g. 22). 0 = no VAT
  - `importo_netto` (numeric, default 0) — net amount before VAT
  - `importo_iva` (numeric, default 0) — VAT amount (computed and stored for display)

  The existing `importo` column continues to hold the gross total (netto + IVA).
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'spese' AND column_name = 'aliquota_iva'
  ) THEN
    ALTER TABLE spese ADD COLUMN aliquota_iva numeric(5,2) NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'spese' AND column_name = 'importo_netto'
  ) THEN
    ALTER TABLE spese ADD COLUMN importo_netto numeric(10,2) NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'spese' AND column_name = 'importo_iva'
  ) THEN
    ALTER TABLE spese ADD COLUMN importo_iva numeric(10,2) NOT NULL DEFAULT 0;
  END IF;
END $$;
