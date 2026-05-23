/*
  # Aggiungi tabella parrucchieri e giorni_parrucchieri

  1. Nuove Tabelle
    - `parrucchieri` - Elenco parrucchieri/operatori
    - `giorni_parrucchieri` - Assegnazione parrucchieri ai giorni della settimana

  2. Sicurezza
    - RLS abilitato su entrambe le tabelle
    - Accesso consentito solo a utenti autenticati
*/

-- Tabella parrucchieri
CREATE TABLE IF NOT EXISTS parrucchieri (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL DEFAULT '',
  colore text NOT NULL DEFAULT '#3B82F6',
  attivo boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE parrucchieri ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can select parrucchieri"
  ON parrucchieri FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert parrucchieri"
  ON parrucchieri FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update parrucchieri"
  ON parrucchieri FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete parrucchieri"
  ON parrucchieri FOR DELETE
  TO authenticated
  USING (true);

-- Tabella giorni_parrucchieri (assegnazione per giorno della settimana)
CREATE TABLE IF NOT EXISTS giorni_parrucchieri (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data_specifica date NOT NULL,
  parrucchiere_id uuid NOT NULL REFERENCES parrucchieri(id) ON DELETE CASCADE,
  ordine integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(data_specifica, parrucchiere_id)
);

ALTER TABLE giorni_parrucchieri ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can select giorni_parrucchieri"
  ON giorni_parrucchieri FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert giorni_parrucchieri"
  ON giorni_parrucchieri FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update giorni_parrucchieri"
  ON giorni_parrucchieri FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete giorni_parrucchieri"
  ON giorni_parrucchieri FOR DELETE
  TO authenticated
  USING (true);

-- Indici
CREATE INDEX IF NOT EXISTS idx_giorni_parrucchieri_data ON giorni_parrucchieri(data_specifica);
CREATE INDEX IF NOT EXISTS idx_giorni_parrucchieri_parrucchiere ON giorni_parrucchieri(parrucchiere_id);

-- Dati di esempio
INSERT INTO parrucchieri (nome, colore, attivo) VALUES
  ('Marco', '#EC4899', true),
  ('Francesca', '#3B82F6', true),
  ('Giulia', '#10B981', true),
  ('Andrea', '#F59E0B', true)
ON CONFLICT DO NOTHING;
