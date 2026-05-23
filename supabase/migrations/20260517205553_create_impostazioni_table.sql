/*
  # Create impostazioni table

  1. New Tables
    - `impostazioni`
      - `chiave` (text, primary key) - setting key
      - `valore` (text) - setting value
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS
    - Anon can read and upsert (single-salon app, no auth)
*/

CREATE TABLE IF NOT EXISTS impostazioni (
  chiave text PRIMARY KEY,
  valore text NOT NULL DEFAULT '',
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE impostazioni ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can read impostazioni"
  ON impostazioni FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anon can insert impostazioni"
  ON impostazioni FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anon can update impostazioni"
  ON impostazioni FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

INSERT INTO impostazioni (chiave, valore) VALUES
  ('messaggio_auguri', 'Ciao {nome}! Ti auguriamo un felice compleanno! Tanti auguri da tutto il team!')
ON CONFLICT (chiave) DO NOTHING;
