/*
  # Aggiornamento RLS policies per isolamento per utente

  ## Obiettivo
  Ogni utente vede e modifica solo i propri dati (filtro su user_id = auth.uid()).

  ## Modifiche
  - Rimozione di tutte le vecchie policy permissive (anon/authenticated senza filtro user_id)
  - Aggiunta di nuove policy che filtrano per user_id = auth.uid()
  - Copertura completa: SELECT, INSERT, UPDATE, DELETE per ogni tabella
*/

-- =============================================
-- clienti
-- =============================================
DROP POLICY IF EXISTS "Allow all for anon" ON clienti;
DROP POLICY IF EXISTS "Allow all for authenticated" ON clienti;
DROP POLICY IF EXISTS "anon_select" ON clienti;
DROP POLICY IF EXISTS "anon_insert" ON clienti;
DROP POLICY IF EXISTS "anon_update" ON clienti;
DROP POLICY IF EXISTS "anon_delete" ON clienti;
DROP POLICY IF EXISTS "authenticated_all" ON clienti;
DROP POLICY IF EXISTS "Enable read access for all users" ON clienti;
DROP POLICY IF EXISTS "clienti_select" ON clienti;
DROP POLICY IF EXISTS "clienti_insert" ON clienti;
DROP POLICY IF EXISTS "clienti_update" ON clienti;
DROP POLICY IF EXISTS "clienti_delete" ON clienti;

CREATE POLICY "clienti_select" ON clienti FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "clienti_insert" ON clienti FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "clienti_update" ON clienti FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "clienti_delete" ON clienti FOR DELETE TO authenticated USING (user_id = auth.uid());

-- =============================================
-- appuntamenti
-- =============================================
DROP POLICY IF EXISTS "Allow all for anon" ON appuntamenti;
DROP POLICY IF EXISTS "Allow all for authenticated" ON appuntamenti;
DROP POLICY IF EXISTS "anon_select" ON appuntamenti;
DROP POLICY IF EXISTS "anon_insert" ON appuntamenti;
DROP POLICY IF EXISTS "anon_update" ON appuntamenti;
DROP POLICY IF EXISTS "anon_delete" ON appuntamenti;
DROP POLICY IF EXISTS "authenticated_all" ON appuntamenti;
DROP POLICY IF EXISTS "appuntamenti_select" ON appuntamenti;
DROP POLICY IF EXISTS "appuntamenti_insert" ON appuntamenti;
DROP POLICY IF EXISTS "appuntamenti_update" ON appuntamenti;
DROP POLICY IF EXISTS "appuntamenti_delete" ON appuntamenti;

CREATE POLICY "appuntamenti_select" ON appuntamenti FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "appuntamenti_insert" ON appuntamenti FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "appuntamenti_update" ON appuntamenti FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "appuntamenti_delete" ON appuntamenti FOR DELETE TO authenticated USING (user_id = auth.uid());

-- =============================================
-- appuntamento_trattamenti
-- =============================================
DROP POLICY IF EXISTS "Allow all for anon" ON appuntamento_trattamenti;
DROP POLICY IF EXISTS "Allow all for authenticated" ON appuntamento_trattamenti;
DROP POLICY IF EXISTS "anon_select" ON appuntamento_trattamenti;
DROP POLICY IF EXISTS "anon_insert" ON appuntamento_trattamenti;
DROP POLICY IF EXISTS "anon_update" ON appuntamento_trattamenti;
DROP POLICY IF EXISTS "anon_delete" ON appuntamento_trattamenti;
DROP POLICY IF EXISTS "authenticated_all" ON appuntamento_trattamenti;
DROP POLICY IF EXISTS "appuntamento_trattamenti_select" ON appuntamento_trattamenti;
DROP POLICY IF EXISTS "appuntamento_trattamenti_insert" ON appuntamento_trattamenti;
DROP POLICY IF EXISTS "appuntamento_trattamenti_update" ON appuntamento_trattamenti;
DROP POLICY IF EXISTS "appuntamento_trattamenti_delete" ON appuntamento_trattamenti;

CREATE POLICY "appuntamento_trattamenti_select" ON appuntamento_trattamenti FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "appuntamento_trattamenti_insert" ON appuntamento_trattamenti FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "appuntamento_trattamenti_update" ON appuntamento_trattamenti FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "appuntamento_trattamenti_delete" ON appuntamento_trattamenti FOR DELETE TO authenticated USING (user_id = auth.uid());

-- =============================================
-- schede_colore
-- =============================================
DROP POLICY IF EXISTS "Allow all for anon" ON schede_colore;
DROP POLICY IF EXISTS "Allow all for authenticated" ON schede_colore;
DROP POLICY IF EXISTS "anon_select" ON schede_colore;
DROP POLICY IF EXISTS "anon_insert" ON schede_colore;
DROP POLICY IF EXISTS "anon_update" ON schede_colore;
DROP POLICY IF EXISTS "anon_delete" ON schede_colore;
DROP POLICY IF EXISTS "authenticated_all" ON schede_colore;
DROP POLICY IF EXISTS "schede_colore_select" ON schede_colore;
DROP POLICY IF EXISTS "schede_colore_insert" ON schede_colore;
DROP POLICY IF EXISTS "schede_colore_update" ON schede_colore;
DROP POLICY IF EXISTS "schede_colore_delete" ON schede_colore;

CREATE POLICY "schede_colore_select" ON schede_colore FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "schede_colore_insert" ON schede_colore FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "schede_colore_update" ON schede_colore FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "schede_colore_delete" ON schede_colore FOR DELETE TO authenticated USING (user_id = auth.uid());

-- =============================================
-- parrucchieri
-- =============================================
DROP POLICY IF EXISTS "Allow all for anon" ON parrucchieri;
DROP POLICY IF EXISTS "Allow all for authenticated" ON parrucchieri;
DROP POLICY IF EXISTS "anon_select" ON parrucchieri;
DROP POLICY IF EXISTS "anon_insert" ON parrucchieri;
DROP POLICY IF EXISTS "anon_update" ON parrucchieri;
DROP POLICY IF EXISTS "anon_delete" ON parrucchieri;
DROP POLICY IF EXISTS "authenticated_all" ON parrucchieri;
DROP POLICY IF EXISTS "parrucchieri_select" ON parrucchieri;
DROP POLICY IF EXISTS "parrucchieri_insert" ON parrucchieri;
DROP POLICY IF EXISTS "parrucchieri_update" ON parrucchieri;
DROP POLICY IF EXISTS "parrucchieri_delete" ON parrucchieri;

CREATE POLICY "parrucchieri_select" ON parrucchieri FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "parrucchieri_insert" ON parrucchieri FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "parrucchieri_update" ON parrucchieri FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "parrucchieri_delete" ON parrucchieri FOR DELETE TO authenticated USING (user_id = auth.uid());

-- =============================================
-- giorni_parrucchieri
-- =============================================
DROP POLICY IF EXISTS "Allow all for anon" ON giorni_parrucchieri;
DROP POLICY IF EXISTS "Allow all for authenticated" ON giorni_parrucchieri;
DROP POLICY IF EXISTS "anon_select" ON giorni_parrucchieri;
DROP POLICY IF EXISTS "anon_insert" ON giorni_parrucchieri;
DROP POLICY IF EXISTS "anon_update" ON giorni_parrucchieri;
DROP POLICY IF EXISTS "anon_delete" ON giorni_parrucchieri;
DROP POLICY IF EXISTS "authenticated_all" ON giorni_parrucchieri;
DROP POLICY IF EXISTS "giorni_parrucchieri_select" ON giorni_parrucchieri;
DROP POLICY IF EXISTS "giorni_parrucchieri_insert" ON giorni_parrucchieri;
DROP POLICY IF EXISTS "giorni_parrucchieri_update" ON giorni_parrucchieri;
DROP POLICY IF EXISTS "giorni_parrucchieri_delete" ON giorni_parrucchieri;

CREATE POLICY "giorni_parrucchieri_select" ON giorni_parrucchieri FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "giorni_parrucchieri_insert" ON giorni_parrucchieri FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "giorni_parrucchieri_update" ON giorni_parrucchieri FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "giorni_parrucchieri_delete" ON giorni_parrucchieri FOR DELETE TO authenticated USING (user_id = auth.uid());

-- =============================================
-- impostazioni
-- =============================================
DROP POLICY IF EXISTS "Allow all for anon" ON impostazioni;
DROP POLICY IF EXISTS "Allow all for authenticated" ON impostazioni;
DROP POLICY IF EXISTS "anon_select" ON impostazioni;
DROP POLICY IF EXISTS "anon_insert" ON impostazioni;
DROP POLICY IF EXISTS "anon_update" ON impostazioni;
DROP POLICY IF EXISTS "anon_delete" ON impostazioni;
DROP POLICY IF EXISTS "authenticated_all" ON impostazioni;
DROP POLICY IF EXISTS "impostazioni_select" ON impostazioni;
DROP POLICY IF EXISTS "impostazioni_insert" ON impostazioni;
DROP POLICY IF EXISTS "impostazioni_update" ON impostazioni;
DROP POLICY IF EXISTS "impostazioni_delete" ON impostazioni;

CREATE POLICY "impostazioni_select" ON impostazioni FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "impostazioni_insert" ON impostazioni FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "impostazioni_update" ON impostazioni FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "impostazioni_delete" ON impostazioni FOR DELETE TO authenticated USING (user_id = auth.uid());

-- =============================================
-- voci_extra_catalogo
-- =============================================
DROP POLICY IF EXISTS "Allow all for anon" ON voci_extra_catalogo;
DROP POLICY IF EXISTS "Allow all for authenticated" ON voci_extra_catalogo;
DROP POLICY IF EXISTS "anon_select" ON voci_extra_catalogo;
DROP POLICY IF EXISTS "anon_insert" ON voci_extra_catalogo;
DROP POLICY IF EXISTS "anon_update" ON voci_extra_catalogo;
DROP POLICY IF EXISTS "anon_delete" ON voci_extra_catalogo;
DROP POLICY IF EXISTS "authenticated_all" ON voci_extra_catalogo;
DROP POLICY IF EXISTS "voci_extra_catalogo_select" ON voci_extra_catalogo;
DROP POLICY IF EXISTS "voci_extra_catalogo_insert" ON voci_extra_catalogo;
DROP POLICY IF EXISTS "voci_extra_catalogo_update" ON voci_extra_catalogo;
DROP POLICY IF EXISTS "voci_extra_catalogo_delete" ON voci_extra_catalogo;

CREATE POLICY "voci_extra_catalogo_select" ON voci_extra_catalogo FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "voci_extra_catalogo_insert" ON voci_extra_catalogo FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "voci_extra_catalogo_update" ON voci_extra_catalogo FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "voci_extra_catalogo_delete" ON voci_extra_catalogo FOR DELETE TO authenticated USING (user_id = auth.uid());

-- =============================================
-- fiches
-- =============================================
DROP POLICY IF EXISTS "Allow all for anon" ON fiches;
DROP POLICY IF EXISTS "Allow all for authenticated" ON fiches;
DROP POLICY IF EXISTS "anon_select" ON fiches;
DROP POLICY IF EXISTS "anon_insert" ON fiches;
DROP POLICY IF EXISTS "anon_update" ON fiches;
DROP POLICY IF EXISTS "anon_delete" ON fiches;
DROP POLICY IF EXISTS "authenticated_all" ON fiches;
DROP POLICY IF EXISTS "fiches_select" ON fiches;
DROP POLICY IF EXISTS "fiches_insert" ON fiches;
DROP POLICY IF EXISTS "fiches_update" ON fiches;
DROP POLICY IF EXISTS "fiches_delete" ON fiches;

CREATE POLICY "fiches_select" ON fiches FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "fiches_insert" ON fiches FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "fiches_update" ON fiches FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "fiches_delete" ON fiches FOR DELETE TO authenticated USING (user_id = auth.uid());

-- =============================================
-- fiche_voci
-- =============================================
DROP POLICY IF EXISTS "Allow all for anon" ON fiche_voci;
DROP POLICY IF EXISTS "Allow all for authenticated" ON fiche_voci;
DROP POLICY IF EXISTS "anon_select" ON fiche_voci;
DROP POLICY IF EXISTS "anon_insert" ON fiche_voci;
DROP POLICY IF EXISTS "anon_update" ON fiche_voci;
DROP POLICY IF EXISTS "anon_delete" ON fiche_voci;
DROP POLICY IF EXISTS "authenticated_all" ON fiche_voci;
DROP POLICY IF EXISTS "fiche_voci_select" ON fiche_voci;
DROP POLICY IF EXISTS "fiche_voci_insert" ON fiche_voci;
DROP POLICY IF EXISTS "fiche_voci_update" ON fiche_voci;
DROP POLICY IF EXISTS "fiche_voci_delete" ON fiche_voci;

CREATE POLICY "fiche_voci_select" ON fiche_voci FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "fiche_voci_insert" ON fiche_voci FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "fiche_voci_update" ON fiche_voci FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "fiche_voci_delete" ON fiche_voci FOR DELETE TO authenticated USING (user_id = auth.uid());

-- =============================================
-- incassi_giornalieri
-- =============================================
DROP POLICY IF EXISTS "Allow all for anon" ON incassi_giornalieri;
DROP POLICY IF EXISTS "Allow all for authenticated" ON incassi_giornalieri;
DROP POLICY IF EXISTS "anon_select" ON incassi_giornalieri;
DROP POLICY IF EXISTS "anon_insert" ON incassi_giornalieri;
DROP POLICY IF EXISTS "anon_update" ON incassi_giornalieri;
DROP POLICY IF EXISTS "anon_delete" ON incassi_giornalieri;
DROP POLICY IF EXISTS "authenticated_all" ON incassi_giornalieri;
DROP POLICY IF EXISTS "incassi_giornalieri_select" ON incassi_giornalieri;
DROP POLICY IF EXISTS "incassi_giornalieri_insert" ON incassi_giornalieri;
DROP POLICY IF EXISTS "incassi_giornalieri_update" ON incassi_giornalieri;
DROP POLICY IF EXISTS "incassi_giornalieri_delete" ON incassi_giornalieri;

CREATE POLICY "incassi_giornalieri_select" ON incassi_giornalieri FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "incassi_giornalieri_insert" ON incassi_giornalieri FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "incassi_giornalieri_update" ON incassi_giornalieri FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "incassi_giornalieri_delete" ON incassi_giornalieri FOR DELETE TO authenticated USING (user_id = auth.uid());

-- =============================================
-- carte_sconto
-- =============================================
DROP POLICY IF EXISTS "Allow all for anon" ON carte_sconto;
DROP POLICY IF EXISTS "Allow all for authenticated" ON carte_sconto;
DROP POLICY IF EXISTS "anon_select" ON carte_sconto;
DROP POLICY IF EXISTS "anon_insert" ON carte_sconto;
DROP POLICY IF EXISTS "anon_update" ON carte_sconto;
DROP POLICY IF EXISTS "anon_delete" ON carte_sconto;
DROP POLICY IF EXISTS "authenticated_all" ON carte_sconto;
DROP POLICY IF EXISTS "carte_sconto_select" ON carte_sconto;
DROP POLICY IF EXISTS "carte_sconto_insert" ON carte_sconto;
DROP POLICY IF EXISTS "carte_sconto_update" ON carte_sconto;
DROP POLICY IF EXISTS "carte_sconto_delete" ON carte_sconto;

CREATE POLICY "carte_sconto_select" ON carte_sconto FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "carte_sconto_insert" ON carte_sconto FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "carte_sconto_update" ON carte_sconto FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "carte_sconto_delete" ON carte_sconto FOR DELETE TO authenticated USING (user_id = auth.uid());

-- =============================================
-- utilizzi_carta_sconto
-- =============================================
DROP POLICY IF EXISTS "Allow all for anon" ON utilizzi_carta_sconto;
DROP POLICY IF EXISTS "Allow all for authenticated" ON utilizzi_carta_sconto;
DROP POLICY IF EXISTS "anon_select" ON utilizzi_carta_sconto;
DROP POLICY IF EXISTS "anon_insert" ON utilizzi_carta_sconto;
DROP POLICY IF EXISTS "anon_update" ON utilizzi_carta_sconto;
DROP POLICY IF EXISTS "anon_delete" ON utilizzi_carta_sconto;
DROP POLICY IF EXISTS "authenticated_all" ON utilizzi_carta_sconto;
DROP POLICY IF EXISTS "utilizzi_carta_sconto_select" ON utilizzi_carta_sconto;
DROP POLICY IF EXISTS "utilizzi_carta_sconto_insert" ON utilizzi_carta_sconto;
DROP POLICY IF EXISTS "utilizzi_carta_sconto_update" ON utilizzi_carta_sconto;
DROP POLICY IF EXISTS "utilizzi_carta_sconto_delete" ON utilizzi_carta_sconto;

CREATE POLICY "utilizzi_carta_sconto_select" ON utilizzi_carta_sconto FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "utilizzi_carta_sconto_insert" ON utilizzi_carta_sconto FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "utilizzi_carta_sconto_update" ON utilizzi_carta_sconto FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "utilizzi_carta_sconto_delete" ON utilizzi_carta_sconto FOR DELETE TO authenticated USING (user_id = auth.uid());

-- =============================================
-- carte_premium
-- =============================================
DROP POLICY IF EXISTS "Allow all for anon" ON carte_premium;
DROP POLICY IF EXISTS "Allow all for authenticated" ON carte_premium;
DROP POLICY IF EXISTS "anon_select" ON carte_premium;
DROP POLICY IF EXISTS "anon_insert" ON carte_premium;
DROP POLICY IF EXISTS "anon_update" ON carte_premium;
DROP POLICY IF EXISTS "anon_delete" ON carte_premium;
DROP POLICY IF EXISTS "authenticated_all" ON carte_premium;
DROP POLICY IF EXISTS "carte_premium_select" ON carte_premium;
DROP POLICY IF EXISTS "carte_premium_insert" ON carte_premium;
DROP POLICY IF EXISTS "carte_premium_update" ON carte_premium;
DROP POLICY IF EXISTS "carte_premium_delete" ON carte_premium;

CREATE POLICY "carte_premium_select" ON carte_premium FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "carte_premium_insert" ON carte_premium FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "carte_premium_update" ON carte_premium FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "carte_premium_delete" ON carte_premium FOR DELETE TO authenticated USING (user_id = auth.uid());

-- =============================================
-- ricariche_carta_premium
-- =============================================
DROP POLICY IF EXISTS "Allow all for anon" ON ricariche_carta_premium;
DROP POLICY IF EXISTS "Allow all for authenticated" ON ricariche_carta_premium;
DROP POLICY IF EXISTS "anon_select" ON ricariche_carta_premium;
DROP POLICY IF EXISTS "anon_insert" ON ricariche_carta_premium;
DROP POLICY IF EXISTS "anon_update" ON ricariche_carta_premium;
DROP POLICY IF EXISTS "anon_delete" ON ricariche_carta_premium;
DROP POLICY IF EXISTS "authenticated_all" ON ricariche_carta_premium;
DROP POLICY IF EXISTS "ricariche_carta_premium_select" ON ricariche_carta_premium;
DROP POLICY IF EXISTS "ricariche_carta_premium_insert" ON ricariche_carta_premium;
DROP POLICY IF EXISTS "ricariche_carta_premium_update" ON ricariche_carta_premium;
DROP POLICY IF EXISTS "ricariche_carta_premium_delete" ON ricariche_carta_premium;

CREATE POLICY "ricariche_carta_premium_select" ON ricariche_carta_premium FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "ricariche_carta_premium_insert" ON ricariche_carta_premium FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "ricariche_carta_premium_update" ON ricariche_carta_premium FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "ricariche_carta_premium_delete" ON ricariche_carta_premium FOR DELETE TO authenticated USING (user_id = auth.uid());

-- =============================================
-- utilizzi_carta_premium
-- =============================================
DROP POLICY IF EXISTS "Allow all for anon" ON utilizzi_carta_premium;
DROP POLICY IF EXISTS "Allow all for authenticated" ON utilizzi_carta_premium;
DROP POLICY IF EXISTS "anon_select" ON utilizzi_carta_premium;
DROP POLICY IF EXISTS "anon_insert" ON utilizzi_carta_premium;
DROP POLICY IF EXISTS "anon_update" ON utilizzi_carta_premium;
DROP POLICY IF EXISTS "anon_delete" ON utilizzi_carta_premium;
DROP POLICY IF EXISTS "authenticated_all" ON utilizzi_carta_premium;
DROP POLICY IF EXISTS "utilizzi_carta_premium_select" ON utilizzi_carta_premium;
DROP POLICY IF EXISTS "utilizzi_carta_premium_insert" ON utilizzi_carta_premium;
DROP POLICY IF EXISTS "utilizzi_carta_premium_update" ON utilizzi_carta_premium;
DROP POLICY IF EXISTS "utilizzi_carta_premium_delete" ON utilizzi_carta_premium;

CREATE POLICY "utilizzi_carta_premium_select" ON utilizzi_carta_premium FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "utilizzi_carta_premium_insert" ON utilizzi_carta_premium FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "utilizzi_carta_premium_update" ON utilizzi_carta_premium FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "utilizzi_carta_premium_delete" ON utilizzi_carta_premium FOR DELETE TO authenticated USING (user_id = auth.uid());

-- =============================================
-- rivendita_prodotti
-- =============================================
DROP POLICY IF EXISTS "Allow all for anon" ON rivendita_prodotti;
DROP POLICY IF EXISTS "Allow all for authenticated" ON rivendita_prodotti;
DROP POLICY IF EXISTS "anon_select" ON rivendita_prodotti;
DROP POLICY IF EXISTS "anon_insert" ON rivendita_prodotti;
DROP POLICY IF EXISTS "anon_update" ON rivendita_prodotti;
DROP POLICY IF EXISTS "anon_delete" ON rivendita_prodotti;
DROP POLICY IF EXISTS "authenticated_all" ON rivendita_prodotti;
DROP POLICY IF EXISTS "rivendita_prodotti_select" ON rivendita_prodotti;
DROP POLICY IF EXISTS "rivendita_prodotti_insert" ON rivendita_prodotti;
DROP POLICY IF EXISTS "rivendita_prodotti_update" ON rivendita_prodotti;
DROP POLICY IF EXISTS "rivendita_prodotti_delete" ON rivendita_prodotti;

CREATE POLICY "rivendita_prodotti_select" ON rivendita_prodotti FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "rivendita_prodotti_insert" ON rivendita_prodotti FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "rivendita_prodotti_update" ON rivendita_prodotti FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "rivendita_prodotti_delete" ON rivendita_prodotti FOR DELETE TO authenticated USING (user_id = auth.uid());

-- =============================================
-- template_messaggi_carta_sconto
-- =============================================
DROP POLICY IF EXISTS "Allow all for anon" ON template_messaggi_carta_sconto;
DROP POLICY IF EXISTS "Allow all for authenticated" ON template_messaggi_carta_sconto;
DROP POLICY IF EXISTS "anon_select" ON template_messaggi_carta_sconto;
DROP POLICY IF EXISTS "anon_insert" ON template_messaggi_carta_sconto;
DROP POLICY IF EXISTS "anon_update" ON template_messaggi_carta_sconto;
DROP POLICY IF EXISTS "anon_delete" ON template_messaggi_carta_sconto;
DROP POLICY IF EXISTS "authenticated_all" ON template_messaggi_carta_sconto;
DROP POLICY IF EXISTS "template_messaggi_carta_sconto_select" ON template_messaggi_carta_sconto;
DROP POLICY IF EXISTS "template_messaggi_carta_sconto_insert" ON template_messaggi_carta_sconto;
DROP POLICY IF EXISTS "template_messaggi_carta_sconto_update" ON template_messaggi_carta_sconto;
DROP POLICY IF EXISTS "template_messaggi_carta_sconto_delete" ON template_messaggi_carta_sconto;

CREATE POLICY "template_messaggi_carta_sconto_select" ON template_messaggi_carta_sconto FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "template_messaggi_carta_sconto_insert" ON template_messaggi_carta_sconto FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "template_messaggi_carta_sconto_update" ON template_messaggi_carta_sconto FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "template_messaggi_carta_sconto_delete" ON template_messaggi_carta_sconto FOR DELETE TO authenticated USING (user_id = auth.uid());

-- =============================================
-- template_messaggi_comunicazioni
-- =============================================
DROP POLICY IF EXISTS "Allow all for anon" ON template_messaggi_comunicazioni;
DROP POLICY IF EXISTS "Allow all for authenticated" ON template_messaggi_comunicazioni;
DROP POLICY IF EXISTS "anon_select" ON template_messaggi_comunicazioni;
DROP POLICY IF EXISTS "anon_insert" ON template_messaggi_comunicazioni;
DROP POLICY IF EXISTS "anon_update" ON template_messaggi_comunicazioni;
DROP POLICY IF EXISTS "anon_delete" ON template_messaggi_comunicazioni;
DROP POLICY IF EXISTS "authenticated_all" ON template_messaggi_comunicazioni;
DROP POLICY IF EXISTS "template_messaggi_comunicazioni_select" ON template_messaggi_comunicazioni;
DROP POLICY IF EXISTS "template_messaggi_comunicazioni_insert" ON template_messaggi_comunicazioni;
DROP POLICY IF EXISTS "template_messaggi_comunicazioni_update" ON template_messaggi_comunicazioni;
DROP POLICY IF EXISTS "template_messaggi_comunicazioni_delete" ON template_messaggi_comunicazioni;

CREATE POLICY "template_messaggi_comunicazioni_select" ON template_messaggi_comunicazioni FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "template_messaggi_comunicazioni_insert" ON template_messaggi_comunicazioni FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "template_messaggi_comunicazioni_update" ON template_messaggi_comunicazioni FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "template_messaggi_comunicazioni_delete" ON template_messaggi_comunicazioni FOR DELETE TO authenticated USING (user_id = auth.uid());

-- =============================================
-- schede_clienti_da_confermare
-- =============================================
DROP POLICY IF EXISTS "Allow anon select" ON schede_clienti_da_confermare;
DROP POLICY IF EXISTS "Allow anon insert" ON schede_clienti_da_confermare;
DROP POLICY IF EXISTS "Allow authenticated select" ON schede_clienti_da_confermare;
DROP POLICY IF EXISTS "Allow authenticated update" ON schede_clienti_da_confermare;
DROP POLICY IF EXISTS "Allow authenticated delete" ON schede_clienti_da_confermare;
DROP POLICY IF EXISTS "Allow all for anon" ON schede_clienti_da_confermare;
DROP POLICY IF EXISTS "Allow all for authenticated" ON schede_clienti_da_confermare;
DROP POLICY IF EXISTS "anon_select" ON schede_clienti_da_confermare;
DROP POLICY IF EXISTS "anon_insert" ON schede_clienti_da_confermare;
DROP POLICY IF EXISTS "anon_update" ON schede_clienti_da_confermare;
DROP POLICY IF EXISTS "anon_delete" ON schede_clienti_da_confermare;
DROP POLICY IF EXISTS "authenticated_all" ON schede_clienti_da_confermare;
DROP POLICY IF EXISTS "schede_clienti_da_confermare_select" ON schede_clienti_da_confermare;
DROP POLICY IF EXISTS "schede_clienti_da_confermare_insert" ON schede_clienti_da_confermare;
DROP POLICY IF EXISTS "schede_clienti_da_confermare_update" ON schede_clienti_da_confermare;
DROP POLICY IF EXISTS "schede_clienti_da_confermare_delete" ON schede_clienti_da_confermare;

-- La pagina pubblica di registrazione usa anon, quindi manteniamo insert per anon
-- ma select/update/delete solo per authenticated con user_id
CREATE POLICY "schede_clienti_da_confermare_anon_insert" ON schede_clienti_da_confermare FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "schede_clienti_da_confermare_select" ON schede_clienti_da_confermare FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "schede_clienti_da_confermare_update" ON schede_clienti_da_confermare FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "schede_clienti_da_confermare_delete" ON schede_clienti_da_confermare FOR DELETE TO authenticated USING (user_id = auth.uid());

-- =============================================
-- magazzino_categorie
-- =============================================
DROP POLICY IF EXISTS "Allow all for anon" ON magazzino_categorie;
DROP POLICY IF EXISTS "Allow all for authenticated" ON magazzino_categorie;
DROP POLICY IF EXISTS "anon_select" ON magazzino_categorie;
DROP POLICY IF EXISTS "anon_insert" ON magazzino_categorie;
DROP POLICY IF EXISTS "anon_update" ON magazzino_categorie;
DROP POLICY IF EXISTS "anon_delete" ON magazzino_categorie;
DROP POLICY IF EXISTS "authenticated_all" ON magazzino_categorie;
DROP POLICY IF EXISTS "magazzino_categorie_select" ON magazzino_categorie;
DROP POLICY IF EXISTS "magazzino_categorie_insert" ON magazzino_categorie;
DROP POLICY IF EXISTS "magazzino_categorie_update" ON magazzino_categorie;
DROP POLICY IF EXISTS "magazzino_categorie_delete" ON magazzino_categorie;

CREATE POLICY "magazzino_categorie_select" ON magazzino_categorie FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "magazzino_categorie_insert" ON magazzino_categorie FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "magazzino_categorie_update" ON magazzino_categorie FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "magazzino_categorie_delete" ON magazzino_categorie FOR DELETE TO authenticated USING (user_id = auth.uid());

-- =============================================
-- magazzino_prodotti
-- =============================================
DROP POLICY IF EXISTS "Allow all for anon" ON magazzino_prodotti;
DROP POLICY IF EXISTS "Allow all for authenticated" ON magazzino_prodotti;
DROP POLICY IF EXISTS "anon_select" ON magazzino_prodotti;
DROP POLICY IF EXISTS "anon_insert" ON magazzino_prodotti;
DROP POLICY IF EXISTS "anon_update" ON magazzino_prodotti;
DROP POLICY IF EXISTS "anon_delete" ON magazzino_prodotti;
DROP POLICY IF EXISTS "authenticated_all" ON magazzino_prodotti;
DROP POLICY IF EXISTS "magazzino_prodotti_select" ON magazzino_prodotti;
DROP POLICY IF EXISTS "magazzino_prodotti_insert" ON magazzino_prodotti;
DROP POLICY IF EXISTS "magazzino_prodotti_update" ON magazzino_prodotti;
DROP POLICY IF EXISTS "magazzino_prodotti_delete" ON magazzino_prodotti;

CREATE POLICY "magazzino_prodotti_select" ON magazzino_prodotti FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "magazzino_prodotti_insert" ON magazzino_prodotti FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "magazzino_prodotti_update" ON magazzino_prodotti FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "magazzino_prodotti_delete" ON magazzino_prodotti FOR DELETE TO authenticated USING (user_id = auth.uid());

-- =============================================
-- magazzino_schede_salvate
-- =============================================
DROP POLICY IF EXISTS "Allow all for anon" ON magazzino_schede_salvate;
DROP POLICY IF EXISTS "Allow all for authenticated" ON magazzino_schede_salvate;
DROP POLICY IF EXISTS "anon_select" ON magazzino_schede_salvate;
DROP POLICY IF EXISTS "anon_insert" ON magazzino_schede_salvate;
DROP POLICY IF EXISTS "anon_update" ON magazzino_schede_salvate;
DROP POLICY IF EXISTS "anon_delete" ON magazzino_schede_salvate;
DROP POLICY IF EXISTS "authenticated_all" ON magazzino_schede_salvate;
DROP POLICY IF EXISTS "magazzino_schede_salvate_select" ON magazzino_schede_salvate;
DROP POLICY IF EXISTS "magazzino_schede_salvate_insert" ON magazzino_schede_salvate;
DROP POLICY IF EXISTS "magazzino_schede_salvate_update" ON magazzino_schede_salvate;
DROP POLICY IF EXISTS "magazzino_schede_salvate_delete" ON magazzino_schede_salvate;

CREATE POLICY "magazzino_schede_salvate_select" ON magazzino_schede_salvate FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "magazzino_schede_salvate_insert" ON magazzino_schede_salvate FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "magazzino_schede_salvate_update" ON magazzino_schede_salvate FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "magazzino_schede_salvate_delete" ON magazzino_schede_salvate FOR DELETE TO authenticated USING (user_id = auth.uid());

-- =============================================
-- assenze_parrucchieri
-- =============================================
DROP POLICY IF EXISTS "Allow all for anon" ON assenze_parrucchieri;
DROP POLICY IF EXISTS "Allow all for authenticated" ON assenze_parrucchieri;
DROP POLICY IF EXISTS "anon_select" ON assenze_parrucchieri;
DROP POLICY IF EXISTS "anon_insert" ON assenze_parrucchieri;
DROP POLICY IF EXISTS "anon_update" ON assenze_parrucchieri;
DROP POLICY IF EXISTS "anon_delete" ON assenze_parrucchieri;
DROP POLICY IF EXISTS "authenticated_all" ON assenze_parrucchieri;
DROP POLICY IF EXISTS "assenze_parrucchieri_select" ON assenze_parrucchieri;
DROP POLICY IF EXISTS "assenze_parrucchieri_insert" ON assenze_parrucchieri;
DROP POLICY IF EXISTS "assenze_parrucchieri_update" ON assenze_parrucchieri;
DROP POLICY IF EXISTS "assenze_parrucchieri_delete" ON assenze_parrucchieri;

CREATE POLICY "assenze_parrucchieri_select" ON assenze_parrucchieri FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "assenze_parrucchieri_insert" ON assenze_parrucchieri FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "assenze_parrucchieri_update" ON assenze_parrucchieri FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "assenze_parrucchieri_delete" ON assenze_parrucchieri FOR DELETE TO authenticated USING (user_id = auth.uid());

-- =============================================
-- spese
-- =============================================
DROP POLICY IF EXISTS "Allow all for anon" ON spese;
DROP POLICY IF EXISTS "Allow all for authenticated" ON spese;
DROP POLICY IF EXISTS "anon_select" ON spese;
DROP POLICY IF EXISTS "anon_insert" ON spese;
DROP POLICY IF EXISTS "anon_update" ON spese;
DROP POLICY IF EXISTS "anon_delete" ON spese;
DROP POLICY IF EXISTS "authenticated_all" ON spese;
DROP POLICY IF EXISTS "spese_select" ON spese;
DROP POLICY IF EXISTS "spese_insert" ON spese;
DROP POLICY IF EXISTS "spese_update" ON spese;
DROP POLICY IF EXISTS "spese_delete" ON spese;

CREATE POLICY "spese_select" ON spese FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "spese_insert" ON spese FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "spese_update" ON spese FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "spese_delete" ON spese FOR DELETE TO authenticated USING (user_id = auth.uid());

-- =============================================
-- impostazioni_tasse
-- =============================================
DROP POLICY IF EXISTS "Allow all for anon" ON impostazioni_tasse;
DROP POLICY IF EXISTS "Allow all for authenticated" ON impostazioni_tasse;
DROP POLICY IF EXISTS "anon_select" ON impostazioni_tasse;
DROP POLICY IF EXISTS "anon_insert" ON impostazioni_tasse;
DROP POLICY IF EXISTS "anon_update" ON impostazioni_tasse;
DROP POLICY IF EXISTS "anon_delete" ON impostazioni_tasse;
DROP POLICY IF EXISTS "authenticated_all" ON impostazioni_tasse;
DROP POLICY IF EXISTS "impostazioni_tasse_select" ON impostazioni_tasse;
DROP POLICY IF EXISTS "impostazioni_tasse_insert" ON impostazioni_tasse;
DROP POLICY IF EXISTS "impostazioni_tasse_update" ON impostazioni_tasse;
DROP POLICY IF EXISTS "impostazioni_tasse_delete" ON impostazioni_tasse;

CREATE POLICY "impostazioni_tasse_select" ON impostazioni_tasse FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "impostazioni_tasse_insert" ON impostazioni_tasse FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "impostazioni_tasse_update" ON impostazioni_tasse FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "impostazioni_tasse_delete" ON impostazioni_tasse FOR DELETE TO authenticated USING (user_id = auth.uid());

-- =============================================
-- prodotti_rivendita_catalogo
-- =============================================
DROP POLICY IF EXISTS "Allow all for anon" ON prodotti_rivendita_catalogo;
DROP POLICY IF EXISTS "Allow all for authenticated" ON prodotti_rivendita_catalogo;
DROP POLICY IF EXISTS "anon_select" ON prodotti_rivendita_catalogo;
DROP POLICY IF EXISTS "anon_insert" ON prodotti_rivendita_catalogo;
DROP POLICY IF EXISTS "anon_update" ON prodotti_rivendita_catalogo;
DROP POLICY IF EXISTS "anon_delete" ON prodotti_rivendita_catalogo;
DROP POLICY IF EXISTS "authenticated_all" ON prodotti_rivendita_catalogo;
DROP POLICY IF EXISTS "prodotti_rivendita_catalogo_select" ON prodotti_rivendita_catalogo;
DROP POLICY IF EXISTS "prodotti_rivendita_catalogo_insert" ON prodotti_rivendita_catalogo;
DROP POLICY IF EXISTS "prodotti_rivendita_catalogo_update" ON prodotti_rivendita_catalogo;
DROP POLICY IF EXISTS "prodotti_rivendita_catalogo_delete" ON prodotti_rivendita_catalogo;

CREATE POLICY "prodotti_rivendita_catalogo_select" ON prodotti_rivendita_catalogo FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "prodotti_rivendita_catalogo_insert" ON prodotti_rivendita_catalogo FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "prodotti_rivendita_catalogo_update" ON prodotti_rivendita_catalogo FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "prodotti_rivendita_catalogo_delete" ON prodotti_rivendita_catalogo FOR DELETE TO authenticated USING (user_id = auth.uid());

-- =============================================
-- trattamenti_catalogo
-- =============================================
DROP POLICY IF EXISTS "Allow all for anon" ON trattamenti_catalogo;
DROP POLICY IF EXISTS "Allow all for authenticated" ON trattamenti_catalogo;
DROP POLICY IF EXISTS "anon_select" ON trattamenti_catalogo;
DROP POLICY IF EXISTS "anon_insert" ON trattamenti_catalogo;
DROP POLICY IF EXISTS "anon_update" ON trattamenti_catalogo;
DROP POLICY IF EXISTS "anon_delete" ON trattamenti_catalogo;
DROP POLICY IF EXISTS "authenticated_all" ON trattamenti_catalogo;
DROP POLICY IF EXISTS "trattamenti_catalogo_select" ON trattamenti_catalogo;
DROP POLICY IF EXISTS "trattamenti_catalogo_insert" ON trattamenti_catalogo;
DROP POLICY IF EXISTS "trattamenti_catalogo_update" ON trattamenti_catalogo;
DROP POLICY IF EXISTS "trattamenti_catalogo_delete" ON trattamenti_catalogo;

CREATE POLICY "trattamenti_catalogo_select" ON trattamenti_catalogo FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "trattamenti_catalogo_insert" ON trattamenti_catalogo FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "trattamenti_catalogo_update" ON trattamenti_catalogo FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "trattamenti_catalogo_delete" ON trattamenti_catalogo FOR DELETE TO authenticated USING (user_id = auth.uid());
