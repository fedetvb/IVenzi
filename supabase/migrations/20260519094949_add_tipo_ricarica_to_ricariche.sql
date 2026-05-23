/*
  # Aggiungi tipo_ricarica a ricariche_carta_premium

  1. Modifiche
    - `ricariche_carta_premium`: nuova colonna `tipo_ricarica` (text, default 'standard')
      - 'standard': ricarica normale, registra il 80% nell'incasso giornaliero
      - 'gratuito': credito extra bonus, nessun incasso registrato

  2. Note
    - Valore default 'standard' garantisce compatibilità con le ricariche esistenti
    - Colonna fiche_id in incassi_giornalieri resa nullable per supportare ricariche
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ricariche_carta_premium' AND column_name = 'tipo_ricarica'
  ) THEN
    ALTER TABLE ricariche_carta_premium ADD COLUMN tipo_ricarica text DEFAULT 'standard';
  END IF;
END $$;

-- Assicura che fiche_id in incassi_giornalieri sia nullable
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'incassi_giornalieri' AND column_name = 'fiche_id'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE incassi_giornalieri ALTER COLUMN fiche_id DROP NOT NULL;
  END IF;
END $$;
