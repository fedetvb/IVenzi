/*
  # Supporto fiche manuali

  1. Modifiche tabella `fiches`
     - `appuntamento_id`: diventa nullable (le fiche manuali non hanno un appuntamento)
     - `cliente_id`: nuova colonna nullable, FK verso clienti (per fiche manuali)
     - `manuale`: flag booleano, default false

  2. Note
     - Le fiche esistenti non vengono toccate
     - Le fiche manuali hanno appuntamento_id = NULL e cliente_id valorizzato (o NULL se cliente sconosciuto)
*/

ALTER TABLE fiches
  ALTER COLUMN appuntamento_id DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'fiches' AND column_name = 'cliente_id'
  ) THEN
    ALTER TABLE fiches ADD COLUMN cliente_id uuid REFERENCES clienti(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'fiches' AND column_name = 'manuale'
  ) THEN
    ALTER TABLE fiches ADD COLUMN manuale boolean NOT NULL DEFAULT false;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_fiches_cliente_id ON fiches(cliente_id);
CREATE INDEX IF NOT EXISTS idx_fiches_manuale ON fiches(manuale);
