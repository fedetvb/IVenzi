/*
  # Add ricorrenza (recurrence frequency) to spese table

  Replaces the simple boolean `ricorrente` with a more granular
  `ricorrenza` field that describes how often the expense/income recurs.

  ## Changes to `spese`
  - `ricorrenza` (text, default 'una_tantum') — recurrence frequency:
      'una_tantum'   → one-off (no recurrence)
      'mensile'      → every month
      'bimestrale'   → every 2 months
      'trimestrale'  → every 3 months
      'quadrimestrale' → every 4 months
      'quindicinale' → every 5 months (custom)
      'semestrale'   → every 6 months
      'annuale'      → every year

  The existing `ricorrente` boolean is preserved for backwards compatibility.
  New saves will set both fields; filtering logic uses `ricorrenza`.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'spese' AND column_name = 'ricorrenza'
  ) THEN
    ALTER TABLE spese ADD COLUMN ricorrenza text NOT NULL DEFAULT 'una_tantum';
  END IF;
END $$;

-- Back-fill existing recurring rows
UPDATE spese SET ricorrenza = 'mensile' WHERE ricorrente = true AND ricorrenza = 'una_tantum';
