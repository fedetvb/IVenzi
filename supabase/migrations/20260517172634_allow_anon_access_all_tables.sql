/*
  # Aggiorna le policy per consentire accesso agli utenti anonimi

  Questo gestionale funziona come app desktop locale senza sistema di autenticazione.
  Le policy vengono aggiornate per consentire accesso a tutti gli utenti (autenticati e anonimi).

  Tabelle aggiornate:
  - clienti
  - trattamenti_catalogo
  - appuntamenti
  - appuntamento_trattamenti
  - schede_colore
  - parrucchieri
  - giorni_parrucchieri
*/

-- clienti
DROP POLICY IF EXISTS "Authenticated users can select clienti" ON clienti;
DROP POLICY IF EXISTS "Authenticated users can insert clienti" ON clienti;
DROP POLICY IF EXISTS "Authenticated users can update clienti" ON clienti;
DROP POLICY IF EXISTS "Authenticated users can delete clienti" ON clienti;

CREATE POLICY "Allow all select clienti" ON clienti FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow all insert clienti" ON clienti FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Allow all update clienti" ON clienti FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all delete clienti" ON clienti FOR DELETE TO anon, authenticated USING (true);

-- trattamenti_catalogo
DROP POLICY IF EXISTS "Authenticated users can select trattamenti_catalogo" ON trattamenti_catalogo;
DROP POLICY IF EXISTS "Authenticated users can insert trattamenti_catalogo" ON trattamenti_catalogo;
DROP POLICY IF EXISTS "Authenticated users can update trattamenti_catalogo" ON trattamenti_catalogo;
DROP POLICY IF EXISTS "Authenticated users can delete trattamenti_catalogo" ON trattamenti_catalogo;

CREATE POLICY "Allow all select trattamenti_catalogo" ON trattamenti_catalogo FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow all insert trattamenti_catalogo" ON trattamenti_catalogo FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Allow all update trattamenti_catalogo" ON trattamenti_catalogo FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all delete trattamenti_catalogo" ON trattamenti_catalogo FOR DELETE TO anon, authenticated USING (true);

-- appuntamenti
DROP POLICY IF EXISTS "Authenticated users can select appuntamenti" ON appuntamenti;
DROP POLICY IF EXISTS "Authenticated users can insert appuntamenti" ON appuntamenti;
DROP POLICY IF EXISTS "Authenticated users can update appuntamenti" ON appuntamenti;
DROP POLICY IF EXISTS "Authenticated users can delete appuntamenti" ON appuntamenti;

CREATE POLICY "Allow all select appuntamenti" ON appuntamenti FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow all insert appuntamenti" ON appuntamenti FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Allow all update appuntamenti" ON appuntamenti FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all delete appuntamenti" ON appuntamenti FOR DELETE TO anon, authenticated USING (true);

-- appuntamento_trattamenti
DROP POLICY IF EXISTS "Authenticated users can select appuntamento_trattamenti" ON appuntamento_trattamenti;
DROP POLICY IF EXISTS "Authenticated users can insert appuntamento_trattamenti" ON appuntamento_trattamenti;
DROP POLICY IF EXISTS "Authenticated users can update appuntamento_trattamenti" ON appuntamento_trattamenti;
DROP POLICY IF EXISTS "Authenticated users can delete appuntamento_trattamenti" ON appuntamento_trattamenti;

CREATE POLICY "Allow all select appuntamento_trattamenti" ON appuntamento_trattamenti FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow all insert appuntamento_trattamenti" ON appuntamento_trattamenti FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Allow all update appuntamento_trattamenti" ON appuntamento_trattamenti FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all delete appuntamento_trattamenti" ON appuntamento_trattamenti FOR DELETE TO anon, authenticated USING (true);

-- schede_colore
DROP POLICY IF EXISTS "Authenticated users can select schede_colore" ON schede_colore;
DROP POLICY IF EXISTS "Authenticated users can insert schede_colore" ON schede_colore;
DROP POLICY IF EXISTS "Authenticated users can update schede_colore" ON schede_colore;
DROP POLICY IF EXISTS "Authenticated users can delete schede_colore" ON schede_colore;

CREATE POLICY "Allow all select schede_colore" ON schede_colore FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow all insert schede_colore" ON schede_colore FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Allow all update schede_colore" ON schede_colore FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all delete schede_colore" ON schede_colore FOR DELETE TO anon, authenticated USING (true);

-- parrucchieri
DROP POLICY IF EXISTS "Authenticated users can select parrucchieri" ON parrucchieri;
DROP POLICY IF EXISTS "Authenticated users can insert parrucchieri" ON parrucchieri;
DROP POLICY IF EXISTS "Authenticated users can update parrucchieri" ON parrucchieri;
DROP POLICY IF EXISTS "Authenticated users can delete parrucchieri" ON parrucchieri;

CREATE POLICY "Allow all select parrucchieri" ON parrucchieri FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow all insert parrucchieri" ON parrucchieri FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Allow all update parrucchieri" ON parrucchieri FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all delete parrucchieri" ON parrucchieri FOR DELETE TO anon, authenticated USING (true);

-- giorni_parrucchieri
DROP POLICY IF EXISTS "Authenticated users can select giorni_parrucchieri" ON giorni_parrucchieri;
DROP POLICY IF EXISTS "Authenticated users can insert giorni_parrucchieri" ON giorni_parrucchieri;
DROP POLICY IF EXISTS "Authenticated users can update giorni_parrucchieri" ON giorni_parrucchieri;
DROP POLICY IF EXISTS "Authenticated users can delete giorni_parrucchieri" ON giorni_parrucchieri;

CREATE POLICY "Allow all select giorni_parrucchieri" ON giorni_parrucchieri FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow all insert giorni_parrucchieri" ON giorni_parrucchieri FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Allow all update giorni_parrucchieri" ON giorni_parrucchieri FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all delete giorni_parrucchieri" ON giorni_parrucchieri FOR DELETE TO anon, authenticated USING (true);
