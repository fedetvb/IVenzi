
-- ============================================================
-- 1. Fix segna_invio_recensione: solo traccia data invio, NON blocca
-- ============================================================
CREATE OR REPLACE FUNCTION segna_invio_recensione(p_cliente_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE clienti
  SET data_ultimo_invio_recensione = now()
  WHERE id = p_cliente_id AND deleted_at IS NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION segna_invio_recensione(uuid) TO authenticated;

-- ============================================================
-- 2. Nuovo: segna_visualizzazione_recensione
--    Chiamato quando la cliente APRE la pagina /recensioni
--    Imposta blocco 365 giorni (ha "visto" la richiesta)
-- ============================================================
CREATE OR REPLACE FUNCTION segna_visualizzazione_recensione(p_cliente_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE clienti
  SET data_blocco_recensione = now() + interval '365 days'
  WHERE id = p_cliente_id
    AND deleted_at IS NULL
    AND recensione_lasciata = false
    AND (data_blocco_recensione IS NULL OR data_blocco_recensione < now());
END;
$$;

GRANT EXECUTE ON FUNCTION segna_visualizzazione_recensione(uuid) TO anon;
GRANT EXECUTE ON FUNCTION segna_visualizzazione_recensione(uuid) TO authenticated;

-- ============================================================
-- 3. Aggiungi categoria_recensione a trattamenti_catalogo
--    Permette di mappare ogni servizio del listino a una categoria
-- ============================================================
ALTER TABLE trattamenti_catalogo
  ADD COLUMN IF NOT EXISTS categoria_recensione TEXT DEFAULT 'default';

-- ============================================================
-- 4. Tabella recensioni_categorie: categorie personalizzate per salone
-- ============================================================
CREATE TABLE IF NOT EXISTS recensioni_categorie (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slug        TEXT        NOT NULL,
  nome_display TEXT       NOT NULL,
  testo_con_taglio    TEXT,
  testo_senza_taglio  TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, slug)
);

ALTER TABLE recensioni_categorie ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_categorie_rec" ON recensioni_categorie
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "insert_own_categorie_rec" ON recensioni_categorie
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "update_own_categorie_rec" ON recensioni_categorie
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "delete_own_categorie_rec" ON recensioni_categorie
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- 5. testi_recensioni_dinamici: assicura colonna user_id + updated_at
--    (già creata dalla migrazione precedente, aggiungiamo solo
--     le colonne custom category se mancanti)
-- ============================================================
ALTER TABLE testi_recensioni_dinamici
  ADD COLUMN IF NOT EXISTS is_custom_category BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS custom_category_slug TEXT;
