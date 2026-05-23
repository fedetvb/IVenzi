/*
  # Create spese (expenses) table for financial management

  ## Purpose
  Allows the salon to track recurring and one-off expenses against income,
  with a built-in tax preset system and net/gross toggle.

  ## New Tables

  ### `spese`
  - `id` (uuid, PK)
  - `data` (date) — expense date
  - `categoria` (text) — e.g. "Affitto", "INPS", "IVA", etc.
  - `descrizione` (text) — optional free-text note
  - `importo` (numeric) — amount in euros
  - `ricorrente` (boolean) — true = repeats monthly
  - `tipo` (text) — 'uscita' | 'entrata_extra' to allow non-fiche income entries
  - `created_at` (timestamptz)

  ### `impostazioni_tasse`
  - `id` (uuid, PK)
  - `aliquota_iva` (numeric) — default 22
  - `aliquota_irpef` (numeric) — default 23 (primo scaglione)
  - `regime_fiscale` (text) — 'ordinario' | 'forfettario'
  - `percentuale_forfettario` (numeric) — coefficiente redditività forfettario (default 67 per parrucchieri)
  - `imposta_sostitutiva` (numeric) — aliquota forfettario (default 15, 5 per primi 5 anni)
  - `updated_at` (timestamptz)

  ## Security
  - RLS enabled on both tables
  - Anon access allowed (consistent with existing tables in this project)
*/

CREATE TABLE IF NOT EXISTS spese (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data date NOT NULL DEFAULT CURRENT_DATE,
  categoria text NOT NULL DEFAULT '',
  descrizione text NOT NULL DEFAULT '',
  importo numeric(10,2) NOT NULL DEFAULT 0,
  ricorrente boolean NOT NULL DEFAULT false,
  tipo text NOT NULL DEFAULT 'uscita',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE spese ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon select spese"
  ON spese FOR SELECT TO anon USING (true);

CREATE POLICY "Allow anon insert spese"
  ON spese FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Allow anon update spese"
  ON spese FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Allow anon delete spese"
  ON spese FOR DELETE TO anon USING (true);


CREATE TABLE IF NOT EXISTS impostazioni_tasse (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aliquota_iva numeric(5,2) NOT NULL DEFAULT 22,
  aliquota_irpef numeric(5,2) NOT NULL DEFAULT 23,
  regime_fiscale text NOT NULL DEFAULT 'forfettario',
  percentuale_forfettario numeric(5,2) NOT NULL DEFAULT 67,
  imposta_sostitutiva numeric(5,2) NOT NULL DEFAULT 15,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE impostazioni_tasse ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon select impostazioni_tasse"
  ON impostazioni_tasse FOR SELECT TO anon USING (true);

CREATE POLICY "Allow anon insert impostazioni_tasse"
  ON impostazioni_tasse FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Allow anon update impostazioni_tasse"
  ON impostazioni_tasse FOR UPDATE TO anon USING (true) WITH CHECK (true);

INSERT INTO impostazioni_tasse (aliquota_iva, aliquota_irpef, regime_fiscale, percentuale_forfettario, imposta_sostitutiva)
VALUES (22, 23, 'forfettario', 67, 15)
ON CONFLICT DO NOTHING;
