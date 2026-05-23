/*
  # Schema Gestionale Parrucchieri

  ## Nuove Tabelle
  - `clienti` - Anagrafica clienti con dati personali
  - `appuntamenti` - Agenda appuntamenti
  - `trattamenti_catalogo` - Catalogo servizi/trattamenti offerti
  - `schede_colore` - Storico trattamenti colore per cliente
  - `appuntamento_trattamenti` - Trattamenti associati ad ogni appuntamento

  ## Sicurezza
  - RLS abilitato su tutte le tabelle
  - Accesso consentito solo a utenti autenticati
*/

-- Tabella clienti
CREATE TABLE IF NOT EXISTS clienti (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL DEFAULT '',
  cognome text NOT NULL DEFAULT '',
  telefono text NOT NULL DEFAULT '',
  email text DEFAULT '',
  data_nascita date,
  note text DEFAULT '',
  foto_url text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE clienti ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can select clienti"
  ON clienti FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert clienti"
  ON clienti FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update clienti"
  ON clienti FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete clienti"
  ON clienti FOR DELETE
  TO authenticated
  USING (true);

-- Tabella catalogo trattamenti
CREATE TABLE IF NOT EXISTS trattamenti_catalogo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL DEFAULT '',
  descrizione text DEFAULT '',
  durata_minuti integer NOT NULL DEFAULT 30,
  prezzo numeric(10,2) NOT NULL DEFAULT 0,
  colore text NOT NULL DEFAULT '#3B82F6',
  attivo boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE trattamenti_catalogo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can select trattamenti_catalogo"
  ON trattamenti_catalogo FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert trattamenti_catalogo"
  ON trattamenti_catalogo FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update trattamenti_catalogo"
  ON trattamenti_catalogo FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete trattamenti_catalogo"
  ON trattamenti_catalogo FOR DELETE
  TO authenticated
  USING (true);

-- Tabella appuntamenti
CREATE TABLE IF NOT EXISTS appuntamenti (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid REFERENCES clienti(id) ON DELETE SET NULL,
  data_ora timestamptz NOT NULL,
  durata_minuti integer NOT NULL DEFAULT 60,
  stato text NOT NULL DEFAULT 'confermato' CHECK (stato IN ('confermato', 'in_attesa', 'completato', 'cancellato')),
  note text DEFAULT '',
  prezzo_totale numeric(10,2) DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE appuntamenti ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can select appuntamenti"
  ON appuntamenti FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert appuntamenti"
  ON appuntamenti FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update appuntamenti"
  ON appuntamenti FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete appuntamenti"
  ON appuntamenti FOR DELETE
  TO authenticated
  USING (true);

-- Tabella trattamenti per appuntamento
CREATE TABLE IF NOT EXISTS appuntamento_trattamenti (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appuntamento_id uuid NOT NULL REFERENCES appuntamenti(id) ON DELETE CASCADE,
  trattamento_id uuid REFERENCES trattamenti_catalogo(id) ON DELETE SET NULL,
  nome_trattamento text NOT NULL DEFAULT '',
  prezzo numeric(10,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE appuntamento_trattamenti ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can select appuntamento_trattamenti"
  ON appuntamento_trattamenti FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert appuntamento_trattamenti"
  ON appuntamento_trattamenti FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update appuntamento_trattamenti"
  ON appuntamento_trattamenti FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete appuntamento_trattamenti"
  ON appuntamento_trattamenti FOR DELETE
  TO authenticated
  USING (true);

-- Tabella schede colore
CREATE TABLE IF NOT EXISTS schede_colore (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES clienti(id) ON DELETE CASCADE,
  data_trattamento date NOT NULL DEFAULT CURRENT_DATE,
  formula_colore text DEFAULT '',
  ossidante text DEFAULT '',
  tempo_posa integer DEFAULT 0,
  note text DEFAULT '',
  colore_base text DEFAULT '',
  colore_target text DEFAULT '',
  tecnica text DEFAULT '',
  foto_prima_url text DEFAULT '',
  foto_dopo_url text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE schede_colore ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can select schede_colore"
  ON schede_colore FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert schede_colore"
  ON schede_colore FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update schede_colore"
  ON schede_colore FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete schede_colore"
  ON schede_colore FOR DELETE
  TO authenticated
  USING (true);

-- Indici per performance
CREATE INDEX IF NOT EXISTS idx_appuntamenti_data_ora ON appuntamenti(data_ora);
CREATE INDEX IF NOT EXISTS idx_appuntamenti_cliente_id ON appuntamenti(cliente_id);
CREATE INDEX IF NOT EXISTS idx_schede_colore_cliente_id ON schede_colore(cliente_id);
CREATE INDEX IF NOT EXISTS idx_appuntamento_trattamenti_appuntamento_id ON appuntamento_trattamenti(appuntamento_id);

-- Dati di esempio: trattamenti catalogo
INSERT INTO trattamenti_catalogo (nome, descrizione, durata_minuti, prezzo, colore) VALUES
  ('Taglio Donna', 'Taglio e piega per donna', 60, 35.00, '#EC4899'),
  ('Taglio Uomo', 'Taglio capelli uomo', 30, 18.00, '#3B82F6'),
  ('Colorazione', 'Colorazione completa capelli', 90, 65.00, '#F59E0B'),
  ('Meches', 'Meches e colpi di sole', 120, 80.00, '#EF4444'),
  ('Piega', 'Piega capelli', 45, 25.00, '#10B981'),
  ('Trattamento Cheratina', 'Lisciatura alla cheratina', 180, 120.00, '#8B5CF6'),
  ('Permanente', 'Permanente capelli', 120, 75.00, '#F97316'),
  ('Trattamento Idratante', 'Maschera idratante professionale', 30, 20.00, '#06B6D4')
ON CONFLICT DO NOTHING;
