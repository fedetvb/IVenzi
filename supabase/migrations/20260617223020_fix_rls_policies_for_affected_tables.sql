
-- ─── carte_sconto ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "carte_sconto anon select"  ON carte_sconto;
DROP POLICY IF EXISTS "carte_sconto anon insert"  ON carte_sconto;
DROP POLICY IF EXISTS "carte_sconto anon update"  ON carte_sconto;
DROP POLICY IF EXISTS "carte_sconto anon delete"  ON carte_sconto;
DROP POLICY IF EXISTS "select_own_carte_sconto"   ON carte_sconto;
DROP POLICY IF EXISTS "insert_own_carte_sconto"   ON carte_sconto;
DROP POLICY IF EXISTS "update_own_carte_sconto"   ON carte_sconto;
DROP POLICY IF EXISTS "delete_own_carte_sconto"   ON carte_sconto;

CREATE POLICY "select_own_carte_sconto" ON carte_sconto FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_carte_sconto" ON carte_sconto FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_carte_sconto" ON carte_sconto FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_carte_sconto" ON carte_sconto FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ─── utilizzi_carta_sconto ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "utilizzi_carta_sconto anon select"  ON utilizzi_carta_sconto;
DROP POLICY IF EXISTS "utilizzi_carta_sconto anon insert"  ON utilizzi_carta_sconto;
DROP POLICY IF EXISTS "utilizzi_carta_sconto anon update"  ON utilizzi_carta_sconto;
DROP POLICY IF EXISTS "utilizzi_carta_sconto anon delete"  ON utilizzi_carta_sconto;
DROP POLICY IF EXISTS "select_own_utilizzi_carta_sconto"   ON utilizzi_carta_sconto;
DROP POLICY IF EXISTS "insert_own_utilizzi_carta_sconto"   ON utilizzi_carta_sconto;
DROP POLICY IF EXISTS "update_own_utilizzi_carta_sconto"   ON utilizzi_carta_sconto;
DROP POLICY IF EXISTS "delete_own_utilizzi_carta_sconto"   ON utilizzi_carta_sconto;

CREATE POLICY "select_own_utilizzi_carta_sconto" ON utilizzi_carta_sconto FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_utilizzi_carta_sconto" ON utilizzi_carta_sconto FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_utilizzi_carta_sconto" ON utilizzi_carta_sconto FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_utilizzi_carta_sconto" ON utilizzi_carta_sconto FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ─── carte_premium ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "carte_premium anon select"  ON carte_premium;
DROP POLICY IF EXISTS "carte_premium anon insert"  ON carte_premium;
DROP POLICY IF EXISTS "carte_premium anon update"  ON carte_premium;
DROP POLICY IF EXISTS "carte_premium anon delete"  ON carte_premium;
DROP POLICY IF EXISTS "select_own_carte_premium"   ON carte_premium;
DROP POLICY IF EXISTS "insert_own_carte_premium"   ON carte_premium;
DROP POLICY IF EXISTS "update_own_carte_premium"   ON carte_premium;
DROP POLICY IF EXISTS "delete_own_carte_premium"   ON carte_premium;

CREATE POLICY "select_own_carte_premium" ON carte_premium FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_carte_premium" ON carte_premium FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_carte_premium" ON carte_premium FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_carte_premium" ON carte_premium FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ─── ricariche_carta_premium ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "ricariche_carta_premium anon select"  ON ricariche_carta_premium;
DROP POLICY IF EXISTS "ricariche_carta_premium anon insert"  ON ricariche_carta_premium;
DROP POLICY IF EXISTS "ricariche_carta_premium anon update"  ON ricariche_carta_premium;
DROP POLICY IF EXISTS "ricariche_carta_premium anon delete"  ON ricariche_carta_premium;
DROP POLICY IF EXISTS "select_own_ricariche_carta_premium"   ON ricariche_carta_premium;
DROP POLICY IF EXISTS "insert_own_ricariche_carta_premium"   ON ricariche_carta_premium;
DROP POLICY IF EXISTS "update_own_ricariche_carta_premium"   ON ricariche_carta_premium;
DROP POLICY IF EXISTS "delete_own_ricariche_carta_premium"   ON ricariche_carta_premium;

CREATE POLICY "select_own_ricariche_carta_premium" ON ricariche_carta_premium FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_ricariche_carta_premium" ON ricariche_carta_premium FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_ricariche_carta_premium" ON ricariche_carta_premium FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_ricariche_carta_premium" ON ricariche_carta_premium FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ─── utilizzi_carta_premium ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "utilizzi_carta_premium anon select"  ON utilizzi_carta_premium;
DROP POLICY IF EXISTS "utilizzi_carta_premium anon insert"  ON utilizzi_carta_premium;
DROP POLICY IF EXISTS "utilizzi_carta_premium anon update"  ON utilizzi_carta_premium;
DROP POLICY IF EXISTS "utilizzi_carta_premium anon delete"  ON utilizzi_carta_premium;
DROP POLICY IF EXISTS "select_own_utilizzi_carta_premium"   ON utilizzi_carta_premium;
DROP POLICY IF EXISTS "insert_own_utilizzi_carta_premium"   ON utilizzi_carta_premium;
DROP POLICY IF EXISTS "update_own_utilizzi_carta_premium"   ON utilizzi_carta_premium;
DROP POLICY IF EXISTS "delete_own_utilizzi_carta_premium"   ON utilizzi_carta_premium;

CREATE POLICY "select_own_utilizzi_carta_premium" ON utilizzi_carta_premium FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_utilizzi_carta_premium" ON utilizzi_carta_premium FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_utilizzi_carta_premium" ON utilizzi_carta_premium FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_utilizzi_carta_premium" ON utilizzi_carta_premium FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ─── rivendita_prodotti ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "rivendita_prodotti anon select"  ON rivendita_prodotti;
DROP POLICY IF EXISTS "rivendita_prodotti anon insert"  ON rivendita_prodotti;
DROP POLICY IF EXISTS "rivendita_prodotti anon update"  ON rivendita_prodotti;
DROP POLICY IF EXISTS "rivendita_prodotti anon delete"  ON rivendita_prodotti;
DROP POLICY IF EXISTS "select_own_rivendita_prodotti"   ON rivendita_prodotti;
DROP POLICY IF EXISTS "insert_own_rivendita_prodotti"   ON rivendita_prodotti;
DROP POLICY IF EXISTS "update_own_rivendita_prodotti"   ON rivendita_prodotti;
DROP POLICY IF EXISTS "delete_own_rivendita_prodotti"   ON rivendita_prodotti;

CREATE POLICY "select_own_rivendita_prodotti" ON rivendita_prodotti FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_rivendita_prodotti" ON rivendita_prodotti FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_rivendita_prodotti" ON rivendita_prodotti FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_rivendita_prodotti" ON rivendita_prodotti FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ─── impostazioni_tasse ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "impostazioni_tasse anon select"  ON impostazioni_tasse;
DROP POLICY IF EXISTS "impostazioni_tasse anon insert"  ON impostazioni_tasse;
DROP POLICY IF EXISTS "impostazioni_tasse anon update"  ON impostazioni_tasse;
DROP POLICY IF EXISTS "impostazioni_tasse anon delete"  ON impostazioni_tasse;
DROP POLICY IF EXISTS "select_own_impostazioni_tasse"   ON impostazioni_tasse;
DROP POLICY IF EXISTS "insert_own_impostazioni_tasse"   ON impostazioni_tasse;
DROP POLICY IF EXISTS "update_own_impostazioni_tasse"   ON impostazioni_tasse;
DROP POLICY IF EXISTS "delete_own_impostazioni_tasse"   ON impostazioni_tasse;

CREATE POLICY "select_own_impostazioni_tasse" ON impostazioni_tasse FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_impostazioni_tasse" ON impostazioni_tasse FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_impostazioni_tasse" ON impostazioni_tasse FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_impostazioni_tasse" ON impostazioni_tasse FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ─── assenze_parrucchieri ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "assenze_parrucchieri anon select"  ON assenze_parrucchieri;
DROP POLICY IF EXISTS "assenze_parrucchieri anon insert"  ON assenze_parrucchieri;
DROP POLICY IF EXISTS "assenze_parrucchieri anon update"  ON assenze_parrucchieri;
DROP POLICY IF EXISTS "assenze_parrucchieri anon delete"  ON assenze_parrucchieri;
DROP POLICY IF EXISTS "select_own_assenze_parrucchieri"   ON assenze_parrucchieri;
DROP POLICY IF EXISTS "insert_own_assenze_parrucchieri"   ON assenze_parrucchieri;
DROP POLICY IF EXISTS "update_own_assenze_parrucchieri"   ON assenze_parrucchieri;
DROP POLICY IF EXISTS "delete_own_assenze_parrucchieri"   ON assenze_parrucchieri;

CREATE POLICY "select_own_assenze_parrucchieri" ON assenze_parrucchieri FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_assenze_parrucchieri" ON assenze_parrucchieri FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_assenze_parrucchieri" ON assenze_parrucchieri FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_assenze_parrucchieri" ON assenze_parrucchieri FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ─── magazzino_prodotti ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "magazzino_prodotti anon select"  ON magazzino_prodotti;
DROP POLICY IF EXISTS "magazzino_prodotti anon insert"  ON magazzino_prodotti;
DROP POLICY IF EXISTS "magazzino_prodotti anon update"  ON magazzino_prodotti;
DROP POLICY IF EXISTS "magazzino_prodotti anon delete"  ON magazzino_prodotti;
DROP POLICY IF EXISTS "select_own_magazzino_prodotti"   ON magazzino_prodotti;
DROP POLICY IF EXISTS "insert_own_magazzino_prodotti"   ON magazzino_prodotti;
DROP POLICY IF EXISTS "update_own_magazzino_prodotti"   ON magazzino_prodotti;
DROP POLICY IF EXISTS "delete_own_magazzino_prodotti"   ON magazzino_prodotti;

CREATE POLICY "select_own_magazzino_prodotti" ON magazzino_prodotti FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_magazzino_prodotti" ON magazzino_prodotti FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_magazzino_prodotti" ON magazzino_prodotti FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_magazzino_prodotti" ON magazzino_prodotti FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ─── magazzino_categorie ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "magazzino_categorie anon select"  ON magazzino_categorie;
DROP POLICY IF EXISTS "magazzino_categorie anon insert"  ON magazzino_categorie;
DROP POLICY IF EXISTS "magazzino_categorie anon update"  ON magazzino_categorie;
DROP POLICY IF EXISTS "magazzino_categorie anon delete"  ON magazzino_categorie;
DROP POLICY IF EXISTS "select_own_magazzino_categorie"   ON magazzino_categorie;
DROP POLICY IF EXISTS "insert_own_magazzino_categorie"   ON magazzino_categorie;
DROP POLICY IF EXISTS "update_own_magazzino_categorie"   ON magazzino_categorie;
DROP POLICY IF EXISTS "delete_own_magazzino_categorie"   ON magazzino_categorie;

CREATE POLICY "select_own_magazzino_categorie" ON magazzino_categorie FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_magazzino_categorie" ON magazzino_categorie FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_magazzino_categorie" ON magazzino_categorie FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_magazzino_categorie" ON magazzino_categorie FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ─── magazzino_schede_salvate ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "magazzino_schede_salvate anon select"  ON magazzino_schede_salvate;
DROP POLICY IF EXISTS "magazzino_schede_salvate anon insert"  ON magazzino_schede_salvate;
DROP POLICY IF EXISTS "magazzino_schede_salvate anon update"  ON magazzino_schede_salvate;
DROP POLICY IF EXISTS "magazzino_schede_salvate anon delete"  ON magazzino_schede_salvate;
DROP POLICY IF EXISTS "select_own_magazzino_schede_salvate"   ON magazzino_schede_salvate;
DROP POLICY IF EXISTS "insert_own_magazzino_schede_salvate"   ON magazzino_schede_salvate;
DROP POLICY IF EXISTS "update_own_magazzino_schede_salvate"   ON magazzino_schede_salvate;
DROP POLICY IF EXISTS "delete_own_magazzino_schede_salvate"   ON magazzino_schede_salvate;

CREATE POLICY "select_own_magazzino_schede_salvate" ON magazzino_schede_salvate FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_magazzino_schede_salvate" ON magazzino_schede_salvate FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_magazzino_schede_salvate" ON magazzino_schede_salvate FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_magazzino_schede_salvate" ON magazzino_schede_salvate FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ─── voci_extra_catalogo ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "voci_extra_catalogo anon select"  ON voci_extra_catalogo;
DROP POLICY IF EXISTS "voci_extra_catalogo anon insert"  ON voci_extra_catalogo;
DROP POLICY IF EXISTS "voci_extra_catalogo anon update"  ON voci_extra_catalogo;
DROP POLICY IF EXISTS "voci_extra_catalogo anon delete"  ON voci_extra_catalogo;
DROP POLICY IF EXISTS "select_own_voci_extra_catalogo"   ON voci_extra_catalogo;
DROP POLICY IF EXISTS "insert_own_voci_extra_catalogo"   ON voci_extra_catalogo;
DROP POLICY IF EXISTS "update_own_voci_extra_catalogo"   ON voci_extra_catalogo;
DROP POLICY IF EXISTS "delete_own_voci_extra_catalogo"   ON voci_extra_catalogo;

CREATE POLICY "select_own_voci_extra_catalogo" ON voci_extra_catalogo FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_voci_extra_catalogo" ON voci_extra_catalogo FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_voci_extra_catalogo" ON voci_extra_catalogo FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_voci_extra_catalogo" ON voci_extra_catalogo FOR DELETE
  TO authenticated USING (auth.uid() = user_id);
