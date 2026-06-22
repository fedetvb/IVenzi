-- ============================================================
--  SCRIPT AGGIORNAMENTO CUMULATIVO — SALONI NON-ADMIN
--  Da incollare nel SQL Editor di Supabase (una sola volta,
--  in ordine, dall'alto verso il basso).
--  Aggiornato al: 2026-06-22
-- ============================================================


-- ─────────────────────────────────────────────────────────────
--  1. SOFT DELETE (cestino) su tutte le tabelle principali
-- ─────────────────────────────────────────────────────────────
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clienti' AND column_name='deleted_at') THEN ALTER TABLE clienti ADD COLUMN deleted_at timestamptz DEFAULT NULL; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='appuntamenti' AND column_name='deleted_at') THEN ALTER TABLE appuntamenti ADD COLUMN deleted_at timestamptz DEFAULT NULL; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='parrucchieri' AND column_name='deleted_at') THEN ALTER TABLE parrucchieri ADD COLUMN deleted_at timestamptz DEFAULT NULL; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='schede_colore' AND column_name='deleted_at') THEN ALTER TABLE schede_colore ADD COLUMN deleted_at timestamptz DEFAULT NULL; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='carte_sconto' AND column_name='deleted_at') THEN ALTER TABLE carte_sconto ADD COLUMN deleted_at timestamptz DEFAULT NULL; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='carte_premium' AND column_name='deleted_at') THEN ALTER TABLE carte_premium ADD COLUMN deleted_at timestamptz DEFAULT NULL; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='fiches' AND column_name='deleted_at') THEN ALTER TABLE fiches ADD COLUMN deleted_at timestamptz DEFAULT NULL; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='rivendita_prodotti' AND column_name='deleted_at') THEN ALTER TABLE rivendita_prodotti ADD COLUMN deleted_at timestamptz DEFAULT NULL; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='spese' AND column_name='deleted_at') THEN ALTER TABLE spese ADD COLUMN deleted_at timestamptz DEFAULT NULL; END IF; END $$;


-- ─────────────────────────────────────────────────────────────
--  2. COLONNE AGGIUNTIVE — CLIENTI
-- ─────────────────────────────────────────────────────────────
ALTER TABLE clienti ADD COLUMN IF NOT EXISTS in_blacklist        BOOLEAN   NOT NULL DEFAULT false;
ALTER TABLE clienti ADD COLUMN IF NOT EXISTS motivo_blacklist     TEXT      DEFAULT '';
ALTER TABLE clienti ADD COLUMN IF NOT EXISTS auguri_inviati_il   DATE      DEFAULT NULL;
ALTER TABLE clienti ADD COLUMN IF NOT EXISTS presentata_da_cliente_id uuid REFERENCES clienti(id) ON DELETE SET NULL;


-- ─────────────────────────────────────────────────────────────
--  3. COLONNE AGGIUNTIVE — APPUNTAMENTI
-- ─────────────────────────────────────────────────────────────
ALTER TABLE appuntamenti ADD COLUMN IF NOT EXISTS nuova_cliente         BOOLEAN   NOT NULL DEFAULT false;
ALTER TABLE appuntamenti ADD COLUMN IF NOT EXISTS promemoria_inviato_at timestamptz DEFAULT NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel='in_forse' AND enumtypid=(SELECT oid FROM pg_type WHERE typname='stato_appuntamento')) THEN
    ALTER TYPE stato_appuntamento ADD VALUE IF NOT EXISTS 'in_forse';
  END IF;
EXCEPTION WHEN others THEN NULL; END $$;


-- ─────────────────────────────────────────────────────────────
--  4. COLONNE AGGIUNTIVE — SCHEDE CLIENTI DA CONFERMARE
-- ─────────────────────────────────────────────────────────────
ALTER TABLE schede_clienti_da_confermare ADD COLUMN IF NOT EXISTS presentata_da_nome    TEXT    DEFAULT NULL;
ALTER TABLE schede_clienti_da_confermare ADD COLUMN IF NOT EXISTS codice_carta_sconto   TEXT    DEFAULT NULL;
ALTER TABLE schede_clienti_da_confermare ADD COLUMN IF NOT EXISTS codice_gift_pass      TEXT    DEFAULT NULL;
ALTER TABLE schede_clienti_da_confermare ADD COLUMN IF NOT EXISTS benvenuto_visto       BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE schede_clienti_da_confermare ADD COLUMN IF NOT EXISTS foto_url              TEXT    DEFAULT NULL;
ALTER TABLE schede_clienti_da_confermare ADD COLUMN IF NOT EXISTS carta_regalata        BOOLEAN NOT NULL DEFAULT false;


-- ─────────────────────────────────────────────────────────────
--  5. COLONNE AGGIUNTIVE — CARTE SCONTO
-- ─────────────────────────────────────────────────────────────
ALTER TABLE carte_sconto ADD COLUMN IF NOT EXISTS regalata_da_cliente_id uuid REFERENCES clienti(id) ON DELETE SET NULL;
ALTER TABLE carte_sconto ADD COLUMN IF NOT EXISTS listino_categorie       TEXT[]  DEFAULT '{}';
ALTER TABLE carte_sconto ADD COLUMN IF NOT EXISTS user_id                 uuid    REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE carte_sconto ADD COLUMN IF NOT EXISTS updated_at              timestamptz NOT NULL DEFAULT now();


-- ─────────────────────────────────────────────────────────────
--  6. COLONNE AGGIUNTIVE — GIFT PASS
-- ─────────────────────────────────────────────────────────────
ALTER TABLE gift_pass ADD COLUMN IF NOT EXISTS destinataria_cliente_id uuid REFERENCES clienti(id) ON DELETE SET NULL;
ALTER TABLE gift_pass ADD COLUMN IF NOT EXISTS cliente_id               uuid REFERENCES clienti(id) ON DELETE SET NULL;
ALTER TABLE gift_pass ADD COLUMN IF NOT EXISTS fiche_acquisto_id        uuid REFERENCES fiches(id)  ON DELETE SET NULL;
ALTER TABLE gift_pass ADD COLUMN IF NOT EXISTS donata                   BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE gift_pass ADD COLUMN IF NOT EXISTS nominativa               BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE gift_pass ADD COLUMN IF NOT EXISTS deleted_at               timestamptz DEFAULT NULL;
ALTER TABLE gift_pass ADD COLUMN IF NOT EXISTS updated_at               timestamptz NOT NULL DEFAULT now();


-- ─────────────────────────────────────────────────────────────
--  7. COLONNE AGGIUNTIVE — FICHES
-- ─────────────────────────────────────────────────────────────
ALTER TABLE fiches ADD COLUMN IF NOT EXISTS tipo_fiche       TEXT DEFAULT 'servizio';
ALTER TABLE fiches ADD COLUMN IF NOT EXISTS tipo_pagamento   TEXT DEFAULT 'contanti';


-- ─────────────────────────────────────────────────────────────
--  8. COLONNE AGGIUNTIVE — RICARICHE PREMIUM
-- ─────────────────────────────────────────────────────────────
ALTER TABLE ricariche_premium ADD COLUMN IF NOT EXISTS importo_pagato numeric DEFAULT NULL;


-- ─────────────────────────────────────────────────────────────
--  9. COLONNE AGGIUNTIVE — MAGAZZINO SCHEDE SALVATE
-- ─────────────────────────────────────────────────────────────
ALTER TABLE magazzino_schede_salvate ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE magazzino_schede_salvate ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE magazzino_schede_salvate ADD COLUMN IF NOT EXISTS user_id    uuid REFERENCES auth.users(id) ON DELETE CASCADE;


-- ─────────────────────────────────────────────────────────────
-- 10. COLONNE AGGIUNTIVE — PRODOTTI CATALOGO RIVENDITA
-- ─────────────────────────────────────────────────────────────
ALTER TABLE prodotti_rivendita_catalogo ADD COLUMN IF NOT EXISTS quiz_tags   TEXT[]  DEFAULT '{}';
ALTER TABLE prodotti_rivendita_catalogo ADD COLUMN IF NOT EXISTS foto_url    TEXT    DEFAULT NULL;
ALTER TABLE prodotti_rivendita_catalogo ADD COLUMN IF NOT EXISTS best_seller BOOLEAN NOT NULL DEFAULT false;


-- ─────────────────────────────────────────────────────────────
-- 11. COLONNE AGGIUNTIVE — TRATTAMENTI CATALOGO
-- ─────────────────────────────────────────────────────────────
ALTER TABLE trattamenti_catalogo ADD COLUMN IF NOT EXISTS tipo TEXT DEFAULT 'servizio';
ALTER TABLE trattamenti_catalogo ADD COLUMN IF NOT EXISTS posa BOOLEAN NOT NULL DEFAULT false;


-- ─────────────────────────────────────────────────────────────
-- 12. NUOVA TABELLA — MESSAGGI CLIENTI
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messaggi_clienti (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  cliente_id  uuid REFERENCES clienti(id) ON DELETE SET NULL,
  telefono    text,
  testo       text NOT NULL,
  direzione   text NOT NULL DEFAULT 'uscita',
  letto       boolean NOT NULL DEFAULT false,
  preferito   boolean NOT NULL DEFAULT false,
  risposta    text DEFAULT NULL,
  risposta_foto_url text DEFAULT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE messaggi_clienti ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "messaggi_clienti_own" ON messaggi_clienti;
CREATE POLICY "messaggi_clienti_own" ON messaggi_clienti FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);


-- ─────────────────────────────────────────────────────────────
-- 13. NUOVA TABELLA — MAPPA BELLEZZA
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mappa_bellezza (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  cliente_id  uuid REFERENCES clienti(id) ON DELETE CASCADE NOT NULL,
  categoria   text NOT NULL,
  note        text DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE mappa_bellezza ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "mappa_bellezza_own" ON mappa_bellezza;
CREATE POLICY "mappa_bellezza_own" ON mappa_bellezza FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);


-- ─────────────────────────────────────────────────────────────
-- 14. NUOVA TABELLA — RECENSIONI
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS recensioni (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  cliente_id   uuid REFERENCES clienti(id) ON DELETE SET NULL,
  nome_display text NOT NULL,
  testo        text NOT NULL,
  voto         int  NOT NULL CHECK (voto BETWEEN 1 AND 5),
  categoria    text DEFAULT 'generale',
  approvata    boolean NOT NULL DEFAULT false,
  piattaforma  text DEFAULT 'interno',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE recensioni ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "recensioni_authenticated_all"  ON recensioni;
DROP POLICY IF EXISTS "recensioni_anon_select"         ON recensioni;
DROP POLICY IF EXISTS "recensioni_anon_insert"         ON recensioni;
CREATE POLICY "recensioni_authenticated_all" ON recensioni FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "recensioni_anon_select"        ON recensioni FOR SELECT TO anon USING (approvata = true);
CREATE POLICY "recensioni_anon_insert"        ON recensioni FOR INSERT TO anon WITH CHECK (true);


-- ─────────────────────────────────────────────────────────────
-- 15. RPC — cliente_ha_fiches
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION cliente_ha_fiches(p_cliente_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM fiches
    WHERE cliente_id = p_cliente_id
      AND deleted_at IS NULL
  );
$$;


-- ─────────────────────────────────────────────────────────────
-- 16. RPC — cliente_esiste_in_rubrica
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION cliente_esiste_in_rubrica(
  p_salon_user_id uuid,
  p_telefono      text
)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM clienti
    WHERE user_id = p_salon_user_id
      AND telefono = p_telefono
      AND deleted_at IS NULL
  );
$$;


-- ─────────────────────────────────────────────────────────────
-- 17. RPC — get_salon_user_id
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_salon_user_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT id FROM auth.users LIMIT 1;
$$;


-- ─────────────────────────────────────────────────────────────
-- 18. RPC — decrementa_stock_prodotto (atomic)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION decrementa_stock_prodotto(
  p_prodotto_id uuid,
  p_quantita    int DEFAULT 1
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  UPDATE magazzino_prodotti
  SET quantita = GREATEST(0, quantita - p_quantita),
      updated_at = now()
  WHERE id = p_prodotto_id;
END;
$$;


-- ─────────────────────────────────────────────────────────────
-- 19. RLS POLICIES — SBLOCCO ANONIMO
-- ─────────────────────────────────────────────────────────────

-- Carte sconto: lettura e aggiornamento anon (flusso donazione portale)
DROP POLICY IF EXISTS "carte_sconto_anon_select"  ON carte_sconto;
DROP POLICY IF EXISTS "carte_sconto_anon_donate"  ON carte_sconto;
CREATE POLICY "carte_sconto_anon_select" ON carte_sconto FOR SELECT TO anon USING (true);
CREATE POLICY "carte_sconto_anon_donate" ON carte_sconto FOR UPDATE TO anon
  USING  (regalata = false)
  WITH CHECK (regalata = true);

-- Gift pass: lettura, attivazione e donazione anon
DROP POLICY IF EXISTS "gift_pass_anon_select"   ON gift_pass;
DROP POLICY IF EXISTS "gift_pass_anon_activate" ON gift_pass;
DROP POLICY IF EXISTS "gift_pass_anon_donate"   ON gift_pass;
CREATE POLICY "gift_pass_anon_select"   ON gift_pass FOR SELECT TO anon USING (true);
CREATE POLICY "gift_pass_anon_activate" ON gift_pass FOR UPDATE TO anon
  USING  (attivata_at IS NULL AND utilizzata = false)
  WITH CHECK (attivata_at IS NOT NULL);
CREATE POLICY "gift_pass_anon_donate"   ON gift_pass FOR UPDATE TO anon
  USING  (true) WITH CHECK (true);

-- Assenze parrucchieri: lettura anon (necessaria per il portale prenotazioni)
DROP POLICY IF EXISTS "assenze_parrucchieri_anon_select" ON assenze_parrucchieri;
CREATE POLICY "assenze_parrucchieri_anon_select" ON assenze_parrucchieri FOR SELECT TO anon USING (true);
GRANT SELECT ON assenze_parrucchieri TO anon;

-- Prodotti catalogo rivendita: lettura anon (portale prodotti online)
DROP POLICY IF EXISTS "prodotti_catalogo_anon_select" ON prodotti_rivendita_catalogo;
CREATE POLICY "prodotti_catalogo_anon_select" ON prodotti_rivendita_catalogo FOR SELECT TO anon USING (true);

-- Schede da confermare: accesso anon completo (inserimento da form QR)
DROP POLICY IF EXISTS "schede_da_confermare_anon_all" ON schede_clienti_da_confermare;
CREATE POLICY "schede_da_confermare_anon_all" ON schede_clienti_da_confermare FOR ALL TO anon USING (true) WITH CHECK (true);

-- Logo salone: lettura anon (portale prenotazioni)
DROP POLICY IF EXISTS "impostazioni_anon_logo" ON impostazioni;
CREATE POLICY "impostazioni_anon_logo" ON impostazioni FOR SELECT TO anon
  USING (chiave IN ('logo_salone_url', 'nome_salone', 'slogan_salone',
                    'abilita_recensioni', 'mostra_stelle_homepage'));

-- Recensioni: lettura anon (homepage pubblica)
DROP POLICY IF EXISTS "recensioni_anon_select" ON recensioni;
CREATE POLICY "recensioni_anon_select" ON recensioni FOR SELECT TO anon USING (approvata = true);


-- ─────────────────────────────────────────────────────────────
-- 20. REALTIME — abilita su schede_clienti_da_confermare
-- ─────────────────────────────────────────────────────────────
ALTER TABLE schede_clienti_da_confermare REPLICA IDENTITY FULL;
DO $$
BEGIN
  PERFORM pg_catalog.set_config('search_path', 'public', false);
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename  = 'schede_clienti_da_confermare'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE schede_clienti_da_confermare;
  END IF;
END $$;


-- ─────────────────────────────────────────────────────────────
-- 22. RPC — assegna_ambasciatore
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION assegna_ambasciatore(
  p_user_id uuid,
  p_telefono text,
  p_presentata_da_nome text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cliente_id uuid;
  v_ambasciatore_id uuid;
  v_nome text;
  v_cognome text;
  v_tel_norm text;
  v_amb_count int;
BEGIN
  v_tel_norm := RIGHT(REGEXP_REPLACE(p_telefono, '[^0-9]', '', 'g'), 9);
  IF length(v_tel_norm) < 7 THEN RETURN; END IF;
  SELECT id INTO v_cliente_id FROM clienti
  WHERE user_id = p_user_id AND deleted_at IS NULL
    AND RIGHT(REGEXP_REPLACE(telefono, '[^0-9]', '', 'g'), 9) = v_tel_norm
  LIMIT 1;
  IF v_cliente_id IS NULL THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM clienti WHERE id = v_cliente_id AND presentata_da_cliente_id IS NOT NULL) THEN RETURN; END IF;
  v_nome    := split_part(trim(p_presentata_da_nome), ' ', 1);
  v_cognome := trim(substring(trim(p_presentata_da_nome) FROM length(v_nome) + 2));
  IF v_nome = '' THEN RETURN; END IF;
  IF v_cognome = '' THEN
    SELECT COUNT(*) INTO v_amb_count FROM clienti
    WHERE user_id = p_user_id AND deleted_at IS NULL AND id <> v_cliente_id
      AND (lower(nome) = lower(v_nome) OR lower(cognome) = lower(v_nome));
    IF v_amb_count <> 1 THEN RETURN; END IF;
    SELECT id INTO v_ambasciatore_id FROM clienti
    WHERE user_id = p_user_id AND deleted_at IS NULL AND id <> v_cliente_id
      AND (lower(nome) = lower(v_nome) OR lower(cognome) = lower(v_nome))
    LIMIT 1;
  ELSE
    SELECT COUNT(*) INTO v_amb_count FROM clienti
    WHERE user_id = p_user_id AND deleted_at IS NULL AND id <> v_cliente_id
      AND lower(nome) = lower(v_nome) AND lower(cognome) = lower(v_cognome);
    IF v_amb_count <> 1 THEN RETURN; END IF;
    SELECT id INTO v_ambasciatore_id FROM clienti
    WHERE user_id = p_user_id AND deleted_at IS NULL AND id <> v_cliente_id
      AND lower(nome) = lower(v_nome) AND lower(cognome) = lower(v_cognome)
    LIMIT 1;
  END IF;
  IF v_ambasciatore_id IS NULL THEN RETURN; END IF;
  UPDATE clienti SET presentata_da_cliente_id = v_ambasciatore_id, updated_at = now()
  WHERE id = v_cliente_id;
END;
$$;
GRANT EXECUTE ON FUNCTION assegna_ambasciatore(uuid, text, text) TO anon;
GRANT EXECUTE ON FUNCTION assegna_ambasciatore(uuid, text, text) TO authenticated;


-- ─────────────────────────────────────────────────────────────
-- 23. RLS — lettura anon chiavi portale prenotazioni
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "anon_read_portale_prenotazioni" ON impostazioni;
CREATE POLICY "anon_read_portale_prenotazioni" ON impostazioni
  FOR SELECT TO anon
  USING (chiave IN (
    'prenotazioni_online_attive','portale_nascosto','hair_quiz_attivo',
    'fasce_orarie_online_json','annuncio_attivo','annuncio_sfondo',
    'annuncio_testo','annuncio_id','annuncio_compleanno_testo',
    'azienda_telefono','azienda_email','azienda_pec','azienda_indirizzo',
    'azienda_google_maps','azienda_sito_prenotazioni','azienda_note',
    'orari_salone_json','orari_salone_nota','ferie_inizio','ferie_fine',
    'benvenuto_attivo','benvenuto_config_json','icona_pwa_url',
    'mostra_carta_premium_sbiadita','social_instagram','social_facebook',
    'social_tiktok','social_youtube','social_whatsapp','social_x',
    'social_threads','social_google_business','social_tripadvisor','social_altro'
  ));


-- ─────────────────────────────────────────────────────────────
-- 24. RPC — upsert_impostazione
-- ─────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS upsert_impostazione(text, text, uuid);
CREATE OR REPLACE FUNCTION upsert_impostazione(
  p_chiave text,
  p_valore text,
  p_user_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM impostazioni WHERE chiave = p_chiave AND user_id = p_user_id) THEN
    UPDATE impostazioni SET valore = p_valore, updated_at = now()
    WHERE chiave = p_chiave AND user_id = p_user_id;
  ELSE
    INSERT INTO impostazioni (chiave, valore, user_id, updated_at)
    VALUES (p_chiave, p_valore, p_user_id, now());
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION upsert_impostazione(text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION upsert_impostazione(text, text, uuid) TO anon;


-- ─────────────────────────────────────────────────────────────
-- 25. RELOAD CACHE POSTGREST
-- ─────────────────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
