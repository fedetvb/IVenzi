-- Categorie listino prezzi per carte sconto
CREATE TABLE carte_sconto_listino_categorie (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descrizione text NOT NULL DEFAULT '',
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE carte_sconto_listino_categorie ENABLE ROW LEVEL SECURITY;

CREATE POLICY "listino_categorie authenticated select"
  ON carte_sconto_listino_categorie FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "listino_categorie authenticated insert"
  ON carte_sconto_listino_categorie FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "listino_categorie authenticated update"
  ON carte_sconto_listino_categorie FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "listino_categorie authenticated delete"
  ON carte_sconto_listino_categorie FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Prezzi per servizio per ogni categoria listino
CREATE TABLE carte_sconto_listino_prezzi (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria_id uuid NOT NULL REFERENCES carte_sconto_listino_categorie(id) ON DELETE CASCADE,
  nome_servizio text NOT NULL,
  prezzo numeric(10,2) NOT NULL DEFAULT 0,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(categoria_id, nome_servizio)
);

ALTER TABLE carte_sconto_listino_prezzi ENABLE ROW LEVEL SECURITY;

CREATE POLICY "listino_prezzi authenticated select"
  ON carte_sconto_listino_prezzi FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "listino_prezzi authenticated insert"
  ON carte_sconto_listino_prezzi FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "listino_prezzi authenticated update"
  ON carte_sconto_listino_prezzi FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "listino_prezzi authenticated delete"
  ON carte_sconto_listino_prezzi FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Aggiungi colonna listino_categoria_id a carte_sconto
ALTER TABLE carte_sconto
  ADD COLUMN IF NOT EXISTS listino_categoria_id uuid REFERENCES carte_sconto_listino_categorie(id) ON DELETE SET NULL;

-- Aggiorna il check constraint per supportare il nuovo tipo 'listino'
ALTER TABLE carte_sconto DROP CONSTRAINT IF EXISTS carte_sconto_tipo_sconto_check;
ALTER TABLE carte_sconto ADD CONSTRAINT carte_sconto_tipo_sconto_check
  CHECK (tipo_sconto IN ('percentuale', 'fisso', 'listino'));
