/*
  # Fix definitivo RLS: aggiunge policy authenticated per tutte le tabelle

  ## Problema
  L'app usa Supabase Auth (signInWithPassword) — quando l'utente è loggato
  il suo ruolo è "authenticated", NON "anon". Le policy "anon" non si applicano
  agli utenti autenticati (sono ruoli separati in PostgreSQL).

  Molte tabelle avevano policy solo per "anon" (fiches, fiche_voci, carte_sconto,
  carte_premium, ecc.), quindi qualsiasi operazione con utente loggato fallisce
  con errore 403.

  ## Soluzione
  Aggiunge policy per il ruolo "authenticated" su tutte le tabelle che ne erano
  prive, in modo che l'app funzioni sia con che senza sessione attiva.
*/

DO $$
BEGIN
  -- fiches
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='fiches' AND policyname='authenticated can select fiches') THEN
    CREATE POLICY "authenticated can select fiches" ON fiches FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='fiches' AND policyname='authenticated can insert fiches') THEN
    CREATE POLICY "authenticated can insert fiches" ON fiches FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='fiches' AND policyname='authenticated can update fiches') THEN
    CREATE POLICY "authenticated can update fiches" ON fiches FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='fiches' AND policyname='authenticated can delete fiches') THEN
    CREATE POLICY "authenticated can delete fiches" ON fiches FOR DELETE TO authenticated USING (true);
  END IF;

  -- fiche_voci
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='fiche_voci' AND policyname='authenticated can select fiche_voci') THEN
    CREATE POLICY "authenticated can select fiche_voci" ON fiche_voci FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='fiche_voci' AND policyname='authenticated can insert fiche_voci') THEN
    CREATE POLICY "authenticated can insert fiche_voci" ON fiche_voci FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='fiche_voci' AND policyname='authenticated can update fiche_voci') THEN
    CREATE POLICY "authenticated can update fiche_voci" ON fiche_voci FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='fiche_voci' AND policyname='authenticated can delete fiche_voci') THEN
    CREATE POLICY "authenticated can delete fiche_voci" ON fiche_voci FOR DELETE TO authenticated USING (true);
  END IF;

  -- carte_sconto
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='carte_sconto' AND policyname='authenticated can select carte_sconto') THEN
    CREATE POLICY "authenticated can select carte_sconto" ON carte_sconto FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='carte_sconto' AND policyname='authenticated can insert carte_sconto') THEN
    CREATE POLICY "authenticated can insert carte_sconto" ON carte_sconto FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='carte_sconto' AND policyname='authenticated can update carte_sconto') THEN
    CREATE POLICY "authenticated can update carte_sconto" ON carte_sconto FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='carte_sconto' AND policyname='authenticated can delete carte_sconto') THEN
    CREATE POLICY "authenticated can delete carte_sconto" ON carte_sconto FOR DELETE TO authenticated USING (true);
  END IF;

  -- carte_premium
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='carte_premium' AND policyname='authenticated can select carte_premium') THEN
    CREATE POLICY "authenticated can select carte_premium" ON carte_premium FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='carte_premium' AND policyname='authenticated can insert carte_premium') THEN
    CREATE POLICY "authenticated can insert carte_premium" ON carte_premium FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='carte_premium' AND policyname='authenticated can update carte_premium') THEN
    CREATE POLICY "authenticated can update carte_premium" ON carte_premium FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='carte_premium' AND policyname='authenticated can delete carte_premium') THEN
    CREATE POLICY "authenticated can delete carte_premium" ON carte_premium FOR DELETE TO authenticated USING (true);
  END IF;

  -- incassi_giornalieri
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='incassi_giornalieri' AND policyname='authenticated can select incassi_giornalieri') THEN
    CREATE POLICY "authenticated can select incassi_giornalieri" ON incassi_giornalieri FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='incassi_giornalieri' AND policyname='authenticated can insert incassi_giornalieri') THEN
    CREATE POLICY "authenticated can insert incassi_giornalieri" ON incassi_giornalieri FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='incassi_giornalieri' AND policyname='authenticated can update incassi_giornalieri') THEN
    CREATE POLICY "authenticated can update incassi_giornalieri" ON incassi_giornalieri FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='incassi_giornalieri' AND policyname='authenticated can delete incassi_giornalieri') THEN
    CREATE POLICY "authenticated can delete incassi_giornalieri" ON incassi_giornalieri FOR DELETE TO authenticated USING (true);
  END IF;

  -- utilizzi_carta_sconto
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='utilizzi_carta_sconto' AND policyname='authenticated can select utilizzi_carta_sconto') THEN
    CREATE POLICY "authenticated can select utilizzi_carta_sconto" ON utilizzi_carta_sconto FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='utilizzi_carta_sconto' AND policyname='authenticated can insert utilizzi_carta_sconto') THEN
    CREATE POLICY "authenticated can insert utilizzi_carta_sconto" ON utilizzi_carta_sconto FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='utilizzi_carta_sconto' AND policyname='authenticated can update utilizzi_carta_sconto') THEN
    CREATE POLICY "authenticated can update utilizzi_carta_sconto" ON utilizzi_carta_sconto FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='utilizzi_carta_sconto' AND policyname='authenticated can delete utilizzi_carta_sconto') THEN
    CREATE POLICY "authenticated can delete utilizzi_carta_sconto" ON utilizzi_carta_sconto FOR DELETE TO authenticated USING (true);
  END IF;

  -- utilizzi_carta_premium
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='utilizzi_carta_premium' AND policyname='authenticated can select utilizzi_carta_premium') THEN
    CREATE POLICY "authenticated can select utilizzi_carta_premium" ON utilizzi_carta_premium FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='utilizzi_carta_premium' AND policyname='authenticated can insert utilizzi_carta_premium') THEN
    CREATE POLICY "authenticated can insert utilizzi_carta_premium" ON utilizzi_carta_premium FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='utilizzi_carta_premium' AND policyname='authenticated can update utilizzi_carta_premium') THEN
    CREATE POLICY "authenticated can update utilizzi_carta_premium" ON utilizzi_carta_premium FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='utilizzi_carta_premium' AND policyname='authenticated can delete utilizzi_carta_premium') THEN
    CREATE POLICY "authenticated can delete utilizzi_carta_premium" ON utilizzi_carta_premium FOR DELETE TO authenticated USING (true);
  END IF;

  -- ricariche_carta_premium
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ricariche_carta_premium' AND policyname='authenticated can select ricariche_carta_premium') THEN
    CREATE POLICY "authenticated can select ricariche_carta_premium" ON ricariche_carta_premium FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ricariche_carta_premium' AND policyname='authenticated can insert ricariche_carta_premium') THEN
    CREATE POLICY "authenticated can insert ricariche_carta_premium" ON ricariche_carta_premium FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ricariche_carta_premium' AND policyname='authenticated can update ricariche_carta_premium') THEN
    CREATE POLICY "authenticated can update ricariche_carta_premium" ON ricariche_carta_premium FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ricariche_carta_premium' AND policyname='authenticated can delete ricariche_carta_premium') THEN
    CREATE POLICY "authenticated can delete ricariche_carta_premium" ON ricariche_carta_premium FOR DELETE TO authenticated USING (true);
  END IF;

  -- rivendita_prodotti
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='rivendita_prodotti' AND policyname='authenticated can select rivendita_prodotti') THEN
    CREATE POLICY "authenticated can select rivendita_prodotti" ON rivendita_prodotti FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='rivendita_prodotti' AND policyname='authenticated can insert rivendita_prodotti') THEN
    CREATE POLICY "authenticated can insert rivendita_prodotti" ON rivendita_prodotti FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='rivendita_prodotti' AND policyname='authenticated can update rivendita_prodotti') THEN
    CREATE POLICY "authenticated can update rivendita_prodotti" ON rivendita_prodotti FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='rivendita_prodotti' AND policyname='authenticated can delete rivendita_prodotti') THEN
    CREATE POLICY "authenticated can delete rivendita_prodotti" ON rivendita_prodotti FOR DELETE TO authenticated USING (true);
  END IF;

  -- voci_extra_catalogo
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='voci_extra_catalogo' AND policyname='authenticated can select voci_extra_catalogo') THEN
    CREATE POLICY "authenticated can select voci_extra_catalogo" ON voci_extra_catalogo FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='voci_extra_catalogo' AND policyname='authenticated can insert voci_extra_catalogo') THEN
    CREATE POLICY "authenticated can insert voci_extra_catalogo" ON voci_extra_catalogo FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='voci_extra_catalogo' AND policyname='authenticated can update voci_extra_catalogo') THEN
    CREATE POLICY "authenticated can update voci_extra_catalogo" ON voci_extra_catalogo FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='voci_extra_catalogo' AND policyname='authenticated can delete voci_extra_catalogo') THEN
    CREATE POLICY "authenticated can delete voci_extra_catalogo" ON voci_extra_catalogo FOR DELETE TO authenticated USING (true);
  END IF;

  -- prodotti_rivendita_catalogo
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='prodotti_rivendita_catalogo' AND policyname='authenticated can select prodotti_rivendita_catalogo') THEN
    CREATE POLICY "authenticated can select prodotti_rivendita_catalogo" ON prodotti_rivendita_catalogo FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='prodotti_rivendita_catalogo' AND policyname='authenticated can insert prodotti_rivendita_catalogo') THEN
    CREATE POLICY "authenticated can insert prodotti_rivendita_catalogo" ON prodotti_rivendita_catalogo FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='prodotti_rivendita_catalogo' AND policyname='authenticated can update prodotti_rivendita_catalogo') THEN
    CREATE POLICY "authenticated can update prodotti_rivendita_catalogo" ON prodotti_rivendita_catalogo FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='prodotti_rivendita_catalogo' AND policyname='authenticated can delete prodotti_rivendita_catalogo') THEN
    CREATE POLICY "authenticated can delete prodotti_rivendita_catalogo" ON prodotti_rivendita_catalogo FOR DELETE TO authenticated USING (true);
  END IF;

  -- impostazioni
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='impostazioni' AND policyname='authenticated can select impostazioni') THEN
    CREATE POLICY "authenticated can select impostazioni" ON impostazioni FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='impostazioni' AND policyname='authenticated can insert impostazioni') THEN
    CREATE POLICY "authenticated can insert impostazioni" ON impostazioni FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='impostazioni' AND policyname='authenticated can update impostazioni') THEN
    CREATE POLICY "authenticated can update impostazioni" ON impostazioni FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  END IF;

  -- impostazioni_tasse
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='impostazioni_tasse' AND policyname='authenticated can select impostazioni_tasse') THEN
    CREATE POLICY "authenticated can select impostazioni_tasse" ON impostazioni_tasse FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='impostazioni_tasse' AND policyname='authenticated can insert impostazioni_tasse') THEN
    CREATE POLICY "authenticated can insert impostazioni_tasse" ON impostazioni_tasse FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='impostazioni_tasse' AND policyname='authenticated can update impostazioni_tasse') THEN
    CREATE POLICY "authenticated can update impostazioni_tasse" ON impostazioni_tasse FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  END IF;

  -- template_messaggi_carta_sconto
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='template_messaggi_carta_sconto' AND policyname='authenticated can select template_messaggi_carta_sconto') THEN
    CREATE POLICY "authenticated can select template_messaggi_carta_sconto" ON template_messaggi_carta_sconto FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='template_messaggi_carta_sconto' AND policyname='authenticated can insert template_messaggi_carta_sconto') THEN
    CREATE POLICY "authenticated can insert template_messaggi_carta_sconto" ON template_messaggi_carta_sconto FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='template_messaggi_carta_sconto' AND policyname='authenticated can update template_messaggi_carta_sconto') THEN
    CREATE POLICY "authenticated can update template_messaggi_carta_sconto" ON template_messaggi_carta_sconto FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='template_messaggi_carta_sconto' AND policyname='authenticated can delete template_messaggi_carta_sconto') THEN
    CREATE POLICY "authenticated can delete template_messaggi_carta_sconto" ON template_messaggi_carta_sconto FOR DELETE TO authenticated USING (true);
  END IF;

  -- template_messaggi_comunicazioni
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='template_messaggi_comunicazioni' AND policyname='authenticated can select template_messaggi_comunicazioni') THEN
    CREATE POLICY "authenticated can select template_messaggi_comunicazioni" ON template_messaggi_comunicazioni FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='template_messaggi_comunicazioni' AND policyname='authenticated can insert template_messaggi_comunicazioni') THEN
    CREATE POLICY "authenticated can insert template_messaggi_comunicazioni" ON template_messaggi_comunicazioni FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='template_messaggi_comunicazioni' AND policyname='authenticated can update template_messaggi_comunicazioni') THEN
    CREATE POLICY "authenticated can update template_messaggi_comunicazioni" ON template_messaggi_comunicazioni FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='template_messaggi_comunicazioni' AND policyname='authenticated can delete template_messaggi_comunicazioni') THEN
    CREATE POLICY "authenticated can delete template_messaggi_comunicazioni" ON template_messaggi_comunicazioni FOR DELETE TO authenticated USING (true);
  END IF;

  -- assenze_parrucchieri
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='assenze_parrucchieri' AND policyname='authenticated can select assenze_parrucchieri') THEN
    CREATE POLICY "authenticated can select assenze_parrucchieri" ON assenze_parrucchieri FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='assenze_parrucchieri' AND policyname='authenticated can insert assenze_parrucchieri') THEN
    CREATE POLICY "authenticated can insert assenze_parrucchieri" ON assenze_parrucchieri FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='assenze_parrucchieri' AND policyname='authenticated can update assenze_parrucchieri') THEN
    CREATE POLICY "authenticated can update assenze_parrucchieri" ON assenze_parrucchieri FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='assenze_parrucchieri' AND policyname='authenticated can delete assenze_parrucchieri') THEN
    CREATE POLICY "authenticated can delete assenze_parrucchieri" ON assenze_parrucchieri FOR DELETE TO authenticated USING (true);
  END IF;

  -- magazzino_categorie
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='magazzino_categorie' AND policyname='authenticated can select magazzino_categorie') THEN
    CREATE POLICY "authenticated can select magazzino_categorie" ON magazzino_categorie FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='magazzino_categorie' AND policyname='authenticated can insert magazzino_categorie') THEN
    CREATE POLICY "authenticated can insert magazzino_categorie" ON magazzino_categorie FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='magazzino_categorie' AND policyname='authenticated can update magazzino_categorie') THEN
    CREATE POLICY "authenticated can update magazzino_categorie" ON magazzino_categorie FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='magazzino_categorie' AND policyname='authenticated can delete magazzino_categorie') THEN
    CREATE POLICY "authenticated can delete magazzino_categorie" ON magazzino_categorie FOR DELETE TO authenticated USING (true);
  END IF;

  -- magazzino_prodotti
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='magazzino_prodotti' AND policyname='authenticated can select magazzino_prodotti') THEN
    CREATE POLICY "authenticated can select magazzino_prodotti" ON magazzino_prodotti FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='magazzino_prodotti' AND policyname='authenticated can insert magazzino_prodotti') THEN
    CREATE POLICY "authenticated can insert magazzino_prodotti" ON magazzino_prodotti FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='magazzino_prodotti' AND policyname='authenticated can update magazzino_prodotti') THEN
    CREATE POLICY "authenticated can update magazzino_prodotti" ON magazzino_prodotti FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='magazzino_prodotti' AND policyname='authenticated can delete magazzino_prodotti') THEN
    CREATE POLICY "authenticated can delete magazzino_prodotti" ON magazzino_prodotti FOR DELETE TO authenticated USING (true);
  END IF;

  -- magazzino_schede_salvate
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='magazzino_schede_salvate' AND policyname='authenticated can select magazzino_schede_salvate') THEN
    CREATE POLICY "authenticated can select magazzino_schede_salvate" ON magazzino_schede_salvate FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='magazzino_schede_salvate' AND policyname='authenticated can insert magazzino_schede_salvate') THEN
    CREATE POLICY "authenticated can insert magazzino_schede_salvate" ON magazzino_schede_salvate FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='magazzino_schede_salvate' AND policyname='authenticated can update magazzino_schede_salvate') THEN
    CREATE POLICY "authenticated can update magazzino_schede_salvate" ON magazzino_schede_salvate FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='magazzino_schede_salvate' AND policyname='authenticated can delete magazzino_schede_salvate') THEN
    CREATE POLICY "authenticated can delete magazzino_schede_salvate" ON magazzino_schede_salvate FOR DELETE TO authenticated USING (true);
  END IF;

  -- spese
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='spese' AND policyname='authenticated can select spese') THEN
    CREATE POLICY "authenticated can select spese" ON spese FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='spese' AND policyname='authenticated can insert spese') THEN
    CREATE POLICY "authenticated can insert spese" ON spese FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='spese' AND policyname='authenticated can update spese') THEN
    CREATE POLICY "authenticated can update spese" ON spese FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='spese' AND policyname='authenticated can delete spese') THEN
    CREATE POLICY "authenticated can delete spese" ON spese FOR DELETE TO authenticated USING (true);
  END IF;

  -- schede_clienti_da_confermare
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='schede_clienti_da_confermare' AND policyname='authenticated can select schede_clienti_da_confermare') THEN
    CREATE POLICY "authenticated can select schede_clienti_da_confermare" ON schede_clienti_da_confermare FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='schede_clienti_da_confermare' AND policyname='authenticated can insert schede_clienti_da_confermare') THEN
    CREATE POLICY "authenticated can insert schede_clienti_da_confermare" ON schede_clienti_da_confermare FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='schede_clienti_da_confermare' AND policyname='authenticated can update schede_clienti_da_confermare') THEN
    CREATE POLICY "authenticated can update schede_clienti_da_confermare" ON schede_clienti_da_confermare FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='schede_clienti_da_confermare' AND policyname='authenticated can delete schede_clienti_da_confermare') THEN
    CREATE POLICY "authenticated can delete schede_clienti_da_confermare" ON schede_clienti_da_confermare FOR DELETE TO authenticated USING (true);
  END IF;

END $$;
