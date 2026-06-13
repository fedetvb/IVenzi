CREATE TABLE IF NOT EXISTS mappa_bellezza (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  telefono text NOT NULL,
  shampoo_id uuid REFERENCES prodotti_rivendita_catalogo(id) ON DELETE SET NULL,
  shampoo_nome text,
  shampoo_marca text,
  shampoo_categoria text,
  shampoo_prezzo numeric(10,2),
  maschera_id uuid REFERENCES prodotti_rivendita_catalogo(id) ON DELETE SET NULL,
  maschera_nome text,
  maschera_marca text,
  maschera_categoria text,
  maschera_prezzo numeric(10,2),
  finish_id uuid REFERENCES prodotti_rivendita_catalogo(id) ON DELETE SET NULL,
  finish_nome text,
  finish_marca text,
  finish_categoria text,
  finish_prezzo numeric(10,2),
  quiz_risposte text[] DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE mappa_bellezza ENABLE ROW LEVEL SECURITY;

-- Chiunque può leggere e scrivere la propria mappa (il portale usa anon key)
CREATE POLICY "anon_read_mappa_bellezza" ON mappa_bellezza
  FOR SELECT TO anon USING (true);

CREATE POLICY "anon_insert_mappa_bellezza" ON mappa_bellezza
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "anon_update_mappa_bellezza" ON mappa_bellezza
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "anon_delete_mappa_bellezza" ON mappa_bellezza
  FOR DELETE TO anon USING (true);

-- Autenticati (admin) possono leggere tutto
CREATE POLICY "auth_read_mappa_bellezza" ON mappa_bellezza
  FOR SELECT TO authenticated USING (true);
