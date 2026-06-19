-- Testi recensioni dinamici: varianti per categoria + has_taglio, modificabili dal gestionale
CREATE TABLE IF NOT EXISTS testi_recensioni_dinamici (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  categoria_principale text NOT NULL,
  has_taglio boolean NOT NULL DEFAULT false,
  nome_variante text NOT NULL DEFAULT '',
  testo_completo text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, categoria_principale, has_taglio)
);

ALTER TABLE testi_recensioni_dinamici ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_testi_rec" ON testi_recensioni_dinamici FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_testi_rec" ON testi_recensioni_dinamici FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_testi_rec" ON testi_recensioni_dinamici FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_testi_rec" ON testi_recensioni_dinamici FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Anon can read (needed for public /recensioni page)
CREATE POLICY "anon_select_testi_rec" ON testi_recensioni_dinamici FOR SELECT
  TO anon USING (true);

-- Add recensione tracking columns to clienti
ALTER TABLE clienti
  ADD COLUMN IF NOT EXISTS recensione_lasciata boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS data_ultimo_invio_recensione timestamptz,
  ADD COLUMN IF NOT EXISTS data_blocco_recensione timestamptz;

-- RPC: get full data for public recensioni page (called by anon with cliente_id)
CREATE OR REPLACE FUNCTION get_recensione_page_data(p_cliente_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_google_link text;
  v_logo_url text;
  v_nome_salone text;
  v_telefono text;
  v_nome text;
  v_cognome text;
  v_rec_lasciata boolean;
  v_data_blocco timestamptz;
  v_ultimo_invio timestamptz;
  v_fiche_id uuid;
  v_voci jsonb;
BEGIN
  -- 1. Load client
  SELECT user_id, nome, cognome, recensione_lasciata, data_blocco_recensione, data_ultimo_invio_recensione
  INTO v_user_id, v_nome, v_cognome, v_rec_lasciata, v_data_blocco, v_ultimo_invio
  FROM clienti
  WHERE id = p_cliente_id AND deleted_at IS NULL;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('errore', 'cliente_non_trovato');
  END IF;

  -- 2. Load salon settings
  SELECT valore INTO v_google_link FROM impostazioni
  WHERE user_id = v_user_id AND chiave = 'link_recensioni_google' LIMIT 1;

  SELECT valore INTO v_logo_url FROM impostazioni
  WHERE user_id = v_user_id AND chiave = 'logo_recensioni_google_url' LIMIT 1;

  SELECT valore INTO v_nome_salone FROM impostazioni
  WHERE user_id = v_user_id AND chiave = 'nome_salone' LIMIT 1;

  SELECT valore INTO v_telefono FROM impostazioni
  WHERE user_id = v_user_id AND chiave = 'telefono_salone' LIMIT 1;

  -- 3. Get last closed fiche voci for this client
  SELECT f.id INTO v_fiche_id
  FROM fiches f
  WHERE f.user_id = v_user_id AND f.cliente_id = p_cliente_id
    AND f.convalidata = true AND f.deleted_at IS NULL
  ORDER BY f.convalidata_at DESC NULLS LAST, f.created_at DESC
  LIMIT 1;

  IF v_fiche_id IS NOT NULL THEN
    SELECT jsonb_agg(jsonb_build_object('nome_voce', fv.nome_voce, 'tipo', fv.tipo))
    INTO v_voci
    FROM fiche_voci fv
    WHERE fv.fiche_id = v_fiche_id;
  END IF;

  RETURN jsonb_build_object(
    'user_id', v_user_id,
    'cliente_id', p_cliente_id,
    'nome', v_nome,
    'cognome', v_cognome,
    'google_link', COALESCE(v_google_link, ''),
    'logo_url', COALESCE(v_logo_url, ''),
    'nome_salone', COALESCE(v_nome_salone, ''),
    'telefono', COALESCE(v_telefono, ''),
    'recensione_lasciata', COALESCE(v_rec_lasciata, false),
    'data_blocco_recensione', v_data_blocco,
    'data_ultimo_invio_recensione', v_ultimo_invio,
    'voci', COALESCE(v_voci, '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_recensione_page_data(uuid) TO anon;
GRANT EXECUTE ON FUNCTION get_recensione_page_data(uuid) TO authenticated;

-- RPC: segna recensione lasciata (callable by anon with secret cliente_id)
CREATE OR REPLACE FUNCTION segna_recensione_lasciata(p_cliente_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE clienti
  SET recensione_lasciata = true
  WHERE id = p_cliente_id AND deleted_at IS NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION segna_recensione_lasciata(uuid) TO anon;
GRANT EXECUTE ON FUNCTION segna_recensione_lasciata(uuid) TO authenticated;

-- RPC: segna invio recensione (imposta data_ultimo_invio_recensione)
CREATE OR REPLACE FUNCTION segna_invio_recensione(p_cliente_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE clienti
  SET data_ultimo_invio_recensione = now(),
      data_blocco_recensione = now() + interval '365 days'
  WHERE id = p_cliente_id AND deleted_at IS NULL AND recensione_lasciata = false;
END;
$$;

GRANT EXECUTE ON FUNCTION segna_invio_recensione(uuid) TO authenticated;
