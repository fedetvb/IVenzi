/*
  # Add forma_giuridica to impostazioni_tasse

  Adds the legal entity type field so the app can pre-populate
  the correct fiscal regime and tax rates automatically.

  ## Changes to `impostazioni_tasse`
  - `forma_giuridica` (text, default 'partita_iva') — one of:
      'partita_iva'  → Partita IVA (ditta individuale / libero professionista)
      'srl'          → S.r.l. (IRES 24% + IRAP 3.9%)
      'srls'         → S.r.l.s. (same as SRL, simplified)
      'snc'          → S.n.c. (redditi attribuiti ai soci, IRPEF progressiva)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'impostazioni_tasse' AND column_name = 'forma_giuridica'
  ) THEN
    ALTER TABLE impostazioni_tasse ADD COLUMN forma_giuridica text NOT NULL DEFAULT 'partita_iva';
  END IF;
END $$;
