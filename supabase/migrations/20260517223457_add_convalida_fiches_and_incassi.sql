/*
  # Convalida fiches e incassi giornalieri

  ## Modifiche alla tabella fiches
  - `convalidata` (boolean, default false) — true quando la fiche viene confermata
  - `convalidata_at` (timestamptz, nullable) — quando è stata convalidata
  - `importo_convalidato` (numeric, default 0) — totale incassato al momento della convalida

  ## Nuova tabella: incassi_giornalieri
  Registra ogni convalida fiche come voce di incasso.
  Una riga per ogni fiche convalidata.
  - id (uuid, pk)
  - data (date) — giorno di riferimento
  - fiche_id (uuid FK → fiches.id, nullable ON DELETE SET NULL)
  - cliente_nome (text) — snapshot nome cliente
  - importo (numeric) — importo incassato
  - note (text)
  - created_at

  ## Sicurezza
  RLS abilitato con policy anon (coerente con il resto del progetto).
*/

-- Aggiungi colonne alla tabella fiches
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fiches' AND column_name = 'convalidata') THEN
    ALTER TABLE fiches ADD COLUMN convalidata boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fiches' AND column_name = 'convalidata_at') THEN
    ALTER TABLE fiches ADD COLUMN convalidata_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fiches' AND column_name = 'importo_convalidato') THEN
    ALTER TABLE fiches ADD COLUMN importo_convalidato numeric(10,2) NOT NULL DEFAULT 0;
  END IF;
END $$;

-- Nuova tabella incassi_giornalieri
CREATE TABLE IF NOT EXISTS incassi_giornalieri (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data date NOT NULL DEFAULT CURRENT_DATE,
  fiche_id uuid REFERENCES fiches(id) ON DELETE SET NULL,
  cliente_nome text NOT NULL DEFAULT '',
  importo numeric(10,2) NOT NULL DEFAULT 0,
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE incassi_giornalieri ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon can select incassi_giornalieri"
  ON incassi_giornalieri FOR SELECT TO anon USING (true);

CREATE POLICY "anon can insert incassi_giornalieri"
  ON incassi_giornalieri FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "anon can update incassi_giornalieri"
  ON incassi_giornalieri FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "anon can delete incassi_giornalieri"
  ON incassi_giornalieri FOR DELETE TO anon USING (true);

-- Indice per query per data
CREATE INDEX IF NOT EXISTS incassi_giornalieri_data_idx ON incassi_giornalieri(data);
CREATE INDEX IF NOT EXISTS incassi_giornalieri_fiche_id_idx ON incassi_giornalieri(fiche_id);
