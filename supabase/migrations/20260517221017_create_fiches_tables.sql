/*
  # Fiches — voci extra catalogo e righe fiche

  ## Nuove tabelle

  ### voci_extra_catalogo
  Catalogo delle voci aggiuntive personalizzate (es. tonalizzante, prodotti, trattamenti extra)
  che possono essere aggiunte con un click a una fiche.
  - id (uuid, pk)
  - nome (text) — etichetta visibile
  - descrizione (text) — note opzionali
  - prezzo (numeric) — prezzo di default
  - colore (text) — colore badge
  - attivo (boolean)
  - created_at

  ### fiches
  Una fiche per appuntamento. Riassume i servizi da agenda e le voci extra aggiunte.
  - id (uuid, pk)
  - appuntamento_id (uuid FK → appuntamenti.id) — UNIQUE, una fiche per appuntamento
  - note (text)
  - created_at / updated_at

  ### fiche_voci
  Righe della fiche: sia servizi da agenda (tipo 'servizio') sia voci extra (tipo 'extra').
  - id (uuid, pk)
  - fiche_id (uuid FK → fiches.id)
  - tipo ('servizio' | 'extra')
  - nome_voce (text)
  - parrucchiere_id (uuid FK → parrucchieri.id, nullable)
  - nome_parrucchiere (text, nullable) — snapshot al momento del salvataggio
  - prezzo (numeric)
  - note (text)
  - created_at

  ## Sicurezza
  RLS abilitato su tutte e tre le tabelle con policy per accesso anonimo
  (coerente con le altre tabelle del progetto che usano allow_anon).
*/

-- voci_extra_catalogo
CREATE TABLE IF NOT EXISTS voci_extra_catalogo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL DEFAULT '',
  descrizione text NOT NULL DEFAULT '',
  prezzo numeric(10,2) NOT NULL DEFAULT 0,
  colore text NOT NULL DEFAULT '#F59E0B',
  attivo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE voci_extra_catalogo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon can select voci_extra_catalogo"
  ON voci_extra_catalogo FOR SELECT TO anon USING (true);

CREATE POLICY "anon can insert voci_extra_catalogo"
  ON voci_extra_catalogo FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "anon can update voci_extra_catalogo"
  ON voci_extra_catalogo FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "anon can delete voci_extra_catalogo"
  ON voci_extra_catalogo FOR DELETE TO anon USING (true);

-- fiches
CREATE TABLE IF NOT EXISTS fiches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appuntamento_id uuid NOT NULL REFERENCES appuntamenti(id) ON DELETE CASCADE,
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fiches_appuntamento_unique UNIQUE (appuntamento_id)
);

ALTER TABLE fiches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon can select fiches"
  ON fiches FOR SELECT TO anon USING (true);

CREATE POLICY "anon can insert fiches"
  ON fiches FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "anon can update fiches"
  ON fiches FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "anon can delete fiches"
  ON fiches FOR DELETE TO anon USING (true);

-- fiche_voci
CREATE TABLE IF NOT EXISTS fiche_voci (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fiche_id uuid NOT NULL REFERENCES fiches(id) ON DELETE CASCADE,
  tipo text NOT NULL DEFAULT 'servizio',
  nome_voce text NOT NULL DEFAULT '',
  parrucchiere_id uuid REFERENCES parrucchieri(id) ON DELETE SET NULL,
  nome_parrucchiere text NOT NULL DEFAULT '',
  prezzo numeric(10,2) NOT NULL DEFAULT 0,
  note text NOT NULL DEFAULT '',
  ordine integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE fiche_voci ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon can select fiche_voci"
  ON fiche_voci FOR SELECT TO anon USING (true);

CREATE POLICY "anon can insert fiche_voci"
  ON fiche_voci FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "anon can update fiche_voci"
  ON fiche_voci FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "anon can delete fiche_voci"
  ON fiche_voci FOR DELETE TO anon USING (true);

-- Indici
CREATE INDEX IF NOT EXISTS fiche_voci_fiche_id_idx ON fiche_voci(fiche_id);
CREATE INDEX IF NOT EXISTS fiches_appuntamento_id_idx ON fiches(appuntamento_id);

-- Dati di esempio voci extra
INSERT INTO voci_extra_catalogo (nome, descrizione, prezzo, colore) VALUES
  ('Tonalizzante', 'Trattamento tonalizzante', 15.00, '#EC4899'),
  ('Prodotto styling', 'Prodotto per styling professionale', 10.00, '#3B82F6'),
  ('Trattamento cheratina', 'Trattamento lisciante alla cheratina', 40.00, '#10B981'),
  ('Balsamo intensivo', 'Balsamo nutriente professionale', 8.00, '#F97316'),
  ('Siero riparatore', 'Siero ristrutturante per capelli danneggiati', 12.00, '#06B6D4')
ON CONFLICT DO NOTHING;
