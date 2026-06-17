
-- Backfill user_id per le tabelle magazzino (dati storici con user_id = NULL)
-- Non c'è una relazione diretta, quindi backfilliamo usando il primo utente autenticato
-- che ha dati in tabelle già migrate (es. clienti)

DO $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Trova il primo user_id non null da una tabella già migrata
  SELECT user_id INTO v_user_id
  FROM clienti
  WHERE user_id IS NOT NULL
  LIMIT 1;

  IF v_user_id IS NOT NULL THEN
    UPDATE magazzino_prodotti   SET user_id = v_user_id WHERE user_id IS NULL;
    UPDATE magazzino_categorie  SET user_id = v_user_id WHERE user_id IS NULL;
    UPDATE magazzino_schede_salvate SET user_id = v_user_id WHERE user_id IS NULL;
    UPDATE rivendita_prodotti   SET user_id = v_user_id WHERE user_id IS NULL;
    UPDATE impostazioni_tasse   SET user_id = v_user_id WHERE user_id IS NULL;
    UPDATE assenze_parrucchieri SET user_id = v_user_id WHERE user_id IS NULL;
    UPDATE voci_extra_catalogo  SET user_id = v_user_id WHERE user_id IS NULL;
    UPDATE spese                SET user_id = v_user_id WHERE user_id IS NULL;
    -- Aggiorna anche le carte rimaste senza user_id (sconto non nominative)
    UPDATE carte_sconto         SET user_id = v_user_id WHERE user_id IS NULL;
    UPDATE carte_premium        SET user_id = v_user_id WHERE user_id IS NULL;
    UPDATE ricariche_carta_premium SET user_id = v_user_id WHERE user_id IS NULL;
    UPDATE utilizzi_carta_sconto   SET user_id = v_user_id WHERE user_id IS NULL;
    UPDATE utilizzi_carta_premium  SET user_id = v_user_id WHERE user_id IS NULL;
  END IF;
END $$;

-- Aggiorna le policy SELECT/UPDATE per magazzino per accettare anche user_id IS NULL
-- come safety net per eventuali dati che non hanno trovato un user_id da backfillare

DROP POLICY IF EXISTS "select_own_magazzino_prodotti" ON magazzino_prodotti;
CREATE POLICY "select_own_magazzino_prodotti" ON magazzino_prodotti FOR SELECT
  TO authenticated USING (auth.uid() = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "update_own_magazzino_prodotti" ON magazzino_prodotti;
CREATE POLICY "update_own_magazzino_prodotti" ON magazzino_prodotti FOR UPDATE
  TO authenticated USING (auth.uid() = user_id OR user_id IS NULL)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "select_own_magazzino_categorie" ON magazzino_categorie;
CREATE POLICY "select_own_magazzino_categorie" ON magazzino_categorie FOR SELECT
  TO authenticated USING (auth.uid() = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "update_own_magazzino_categorie" ON magazzino_categorie;
CREATE POLICY "update_own_magazzino_categorie" ON magazzino_categorie FOR UPDATE
  TO authenticated USING (auth.uid() = user_id OR user_id IS NULL)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "select_own_magazzino_schede_salvate" ON magazzino_schede_salvate;
CREATE POLICY "select_own_magazzino_schede_salvate" ON magazzino_schede_salvate FOR SELECT
  TO authenticated USING (auth.uid() = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "update_own_magazzino_schede_salvate" ON magazzino_schede_salvate;
CREATE POLICY "update_own_magazzino_schede_salvate" ON magazzino_schede_salvate FOR UPDATE
  TO authenticated USING (auth.uid() = user_id OR user_id IS NULL)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "select_own_rivendita_prodotti" ON rivendita_prodotti;
CREATE POLICY "select_own_rivendita_prodotti" ON rivendita_prodotti FOR SELECT
  TO authenticated USING (auth.uid() = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "update_own_rivendita_prodotti" ON rivendita_prodotti;
CREATE POLICY "update_own_rivendita_prodotti" ON rivendita_prodotti FOR UPDATE
  TO authenticated USING (auth.uid() = user_id OR user_id IS NULL)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "select_own_impostazioni_tasse" ON impostazioni_tasse;
CREATE POLICY "select_own_impostazioni_tasse" ON impostazioni_tasse FOR SELECT
  TO authenticated USING (auth.uid() = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "update_own_impostazioni_tasse" ON impostazioni_tasse;
CREATE POLICY "update_own_impostazioni_tasse" ON impostazioni_tasse FOR UPDATE
  TO authenticated USING (auth.uid() = user_id OR user_id IS NULL)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "select_own_assenze_parrucchieri" ON assenze_parrucchieri;
CREATE POLICY "select_own_assenze_parrucchieri" ON assenze_parrucchieri FOR SELECT
  TO authenticated USING (auth.uid() = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "update_own_assenze_parrucchieri" ON assenze_parrucchieri;
CREATE POLICY "update_own_assenze_parrucchieri" ON assenze_parrucchieri FOR UPDATE
  TO authenticated USING (auth.uid() = user_id OR user_id IS NULL)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "select_own_voci_extra_catalogo" ON voci_extra_catalogo;
CREATE POLICY "select_own_voci_extra_catalogo" ON voci_extra_catalogo FOR SELECT
  TO authenticated USING (auth.uid() = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "update_own_voci_extra_catalogo" ON voci_extra_catalogo;
CREATE POLICY "update_own_voci_extra_catalogo" ON voci_extra_catalogo FOR UPDATE
  TO authenticated USING (auth.uid() = user_id OR user_id IS NULL)
  WITH CHECK (auth.uid() = user_id);
