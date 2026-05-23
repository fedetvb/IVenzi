/*
  # Aggiunte a carte_sconto: telefono_override e flag nominativa

  1. Modifiche a `carte_sconto`
    - `telefono_override` (text): numero di telefono inserito manualmente in creazione,
      usato per la notifica WhatsApp quando la carta non è intestata a una scheda cliente
      o la scheda cliente è priva di numero.
    - `nominativa` (boolean, default false): se true, la carta è riservata esclusivamente
      al cliente intestatario (`cliente_id`). In convalida fiche viene verificato che il
      gruppo sia lo stesso cliente. Rilevante solo per carte non usa-e-getta.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'carte_sconto' AND column_name = 'telefono_override'
  ) THEN
    ALTER TABLE carte_sconto ADD COLUMN telefono_override text NOT NULL DEFAULT '';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'carte_sconto' AND column_name = 'nominativa'
  ) THEN
    ALTER TABLE carte_sconto ADD COLUMN nominativa boolean NOT NULL DEFAULT false;
  END IF;
END $$;
