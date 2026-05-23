/*
  # Fix RLS: aggiunge policy anon per tutte le tabelle che ne erano sprovviste

  ## Problema
  Le tabelle appuntamenti, clienti, parrucchieri, trattamenti_catalogo,
  appuntamento_trattamenti, giorni_parrucchieri e schede_colore avevano solo
  policy per il ruolo "authenticated". Quando la sessione Supabase Auth non è
  attiva (es. token scaduto, primo caricamento, logout), tutte le query
  falliscono con errore 403.

  Il gestionale usa internamente la propria autenticazione (password localStorage),
  non Supabase Auth — quindi il ruolo "anon" deve avere pieno accesso alle stesse
  tabelle.

  ## Soluzione
  Aggiunge policy SELECT/INSERT/UPDATE/DELETE per il ruolo anon su tutte le
  tabelle mancanti, usando blocchi DO per evitare errori se esistono già.
*/

DO $$
BEGIN
  -- appuntamenti
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='appuntamenti' AND policyname='anon can select appuntamenti') THEN
    CREATE POLICY "anon can select appuntamenti" ON appuntamenti FOR SELECT TO anon USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='appuntamenti' AND policyname='anon can insert appuntamenti') THEN
    CREATE POLICY "anon can insert appuntamenti" ON appuntamenti FOR INSERT TO anon WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='appuntamenti' AND policyname='anon can update appuntamenti') THEN
    CREATE POLICY "anon can update appuntamenti" ON appuntamenti FOR UPDATE TO anon USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='appuntamenti' AND policyname='anon can delete appuntamenti') THEN
    CREATE POLICY "anon can delete appuntamenti" ON appuntamenti FOR DELETE TO anon USING (true);
  END IF;

  -- appuntamento_trattamenti
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='appuntamento_trattamenti' AND policyname='anon can select appuntamento_trattamenti') THEN
    CREATE POLICY "anon can select appuntamento_trattamenti" ON appuntamento_trattamenti FOR SELECT TO anon USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='appuntamento_trattamenti' AND policyname='anon can insert appuntamento_trattamenti') THEN
    CREATE POLICY "anon can insert appuntamento_trattamenti" ON appuntamento_trattamenti FOR INSERT TO anon WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='appuntamento_trattamenti' AND policyname='anon can update appuntamento_trattamenti') THEN
    CREATE POLICY "anon can update appuntamento_trattamenti" ON appuntamento_trattamenti FOR UPDATE TO anon USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='appuntamento_trattamenti' AND policyname='anon can delete appuntamento_trattamenti') THEN
    CREATE POLICY "anon can delete appuntamento_trattamenti" ON appuntamento_trattamenti FOR DELETE TO anon USING (true);
  END IF;

  -- clienti
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='clienti' AND policyname='anon can select clienti') THEN
    CREATE POLICY "anon can select clienti" ON clienti FOR SELECT TO anon USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='clienti' AND policyname='anon can insert clienti') THEN
    CREATE POLICY "anon can insert clienti" ON clienti FOR INSERT TO anon WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='clienti' AND policyname='anon can update clienti') THEN
    CREATE POLICY "anon can update clienti" ON clienti FOR UPDATE TO anon USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='clienti' AND policyname='anon can delete clienti') THEN
    CREATE POLICY "anon can delete clienti" ON clienti FOR DELETE TO anon USING (true);
  END IF;

  -- parrucchieri
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='parrucchieri' AND policyname='anon can select parrucchieri') THEN
    CREATE POLICY "anon can select parrucchieri" ON parrucchieri FOR SELECT TO anon USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='parrucchieri' AND policyname='anon can insert parrucchieri') THEN
    CREATE POLICY "anon can insert parrucchieri" ON parrucchieri FOR INSERT TO anon WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='parrucchieri' AND policyname='anon can update parrucchieri') THEN
    CREATE POLICY "anon can update parrucchieri" ON parrucchieri FOR UPDATE TO anon USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='parrucchieri' AND policyname='anon can delete parrucchieri') THEN
    CREATE POLICY "anon can delete parrucchieri" ON parrucchieri FOR DELETE TO anon USING (true);
  END IF;

  -- trattamenti_catalogo
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='trattamenti_catalogo' AND policyname='anon can select trattamenti_catalogo') THEN
    CREATE POLICY "anon can select trattamenti_catalogo" ON trattamenti_catalogo FOR SELECT TO anon USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='trattamenti_catalogo' AND policyname='anon can insert trattamenti_catalogo') THEN
    CREATE POLICY "anon can insert trattamenti_catalogo" ON trattamenti_catalogo FOR INSERT TO anon WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='trattamenti_catalogo' AND policyname='anon can update trattamenti_catalogo') THEN
    CREATE POLICY "anon can update trattamenti_catalogo" ON trattamenti_catalogo FOR UPDATE TO anon USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='trattamenti_catalogo' AND policyname='anon can delete trattamenti_catalogo') THEN
    CREATE POLICY "anon can delete trattamenti_catalogo" ON trattamenti_catalogo FOR DELETE TO anon USING (true);
  END IF;

  -- giorni_parrucchieri
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='giorni_parrucchieri' AND policyname='anon can select giorni_parrucchieri') THEN
    CREATE POLICY "anon can select giorni_parrucchieri" ON giorni_parrucchieri FOR SELECT TO anon USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='giorni_parrucchieri' AND policyname='anon can insert giorni_parrucchieri') THEN
    CREATE POLICY "anon can insert giorni_parrucchieri" ON giorni_parrucchieri FOR INSERT TO anon WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='giorni_parrucchieri' AND policyname='anon can update giorni_parrucchieri') THEN
    CREATE POLICY "anon can update giorni_parrucchieri" ON giorni_parrucchieri FOR UPDATE TO anon USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='giorni_parrucchieri' AND policyname='anon can delete giorni_parrucchieri') THEN
    CREATE POLICY "anon can delete giorni_parrucchieri" ON giorni_parrucchieri FOR DELETE TO anon USING (true);
  END IF;

  -- schede_colore
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='schede_colore' AND policyname='anon can select schede_colore') THEN
    CREATE POLICY "anon can select schede_colore" ON schede_colore FOR SELECT TO anon USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='schede_colore' AND policyname='anon can insert schede_colore') THEN
    CREATE POLICY "anon can insert schede_colore" ON schede_colore FOR INSERT TO anon WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='schede_colore' AND policyname='anon can update schede_colore') THEN
    CREATE POLICY "anon can update schede_colore" ON schede_colore FOR UPDATE TO anon USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='schede_colore' AND policyname='anon can delete schede_colore') THEN
    CREATE POLICY "anon can delete schede_colore" ON schede_colore FOR DELETE TO anon USING (true);
  END IF;
END $$;
