
-- Backfill user_id sulle carte che non ce l'hanno ancora.
-- Usa il user_id del cliente associato come proxy, oppure il primo user autenticato.
-- Questo permette alle policy authenticated di funzionare correttamente.

-- carte_sconto: backfill user_id dal cliente se disponibile
UPDATE carte_sconto cs
SET user_id = (
  SELECT c.user_id FROM clienti c WHERE c.id = cs.cliente_id LIMIT 1
)
WHERE cs.user_id IS NULL AND cs.cliente_id IS NOT NULL;

-- carte_premium: backfill user_id dal cliente
UPDATE carte_premium cp
SET user_id = (
  SELECT c.user_id FROM clienti c WHERE c.id = cp.cliente_id LIMIT 1
)
WHERE cp.user_id IS NULL AND cp.cliente_id IS NOT NULL;

-- ricariche_carta_premium: backfill user_id dalla carta premium
UPDATE ricariche_carta_premium r
SET user_id = (
  SELECT cp.user_id FROM carte_premium cp WHERE cp.id = r.carta_premium_id LIMIT 1
)
WHERE r.user_id IS NULL;

-- utilizzi_carta_sconto: backfill user_id dalla carta sconto
UPDATE utilizzi_carta_sconto u
SET user_id = (
  SELECT cs.user_id FROM carte_sconto cs WHERE cs.id = u.carta_sconto_id LIMIT 1
)
WHERE u.user_id IS NULL;

-- utilizzi_carta_premium: backfill user_id dalla carta premium
UPDATE utilizzi_carta_premium u
SET user_id = (
  SELECT cp.user_id FROM carte_premium cp WHERE cp.id = u.carta_premium_id LIMIT 1
)
WHERE u.user_id IS NULL;

-- Aggiungi policy di lettura/scrittura anon per le carte ancora senza user_id
-- (carte vecchie pre-migrazione che non hanno un cliente linkato con user_id)
-- Queste policy permettono l'upsert durante la sync senza bloccare la RLS

-- Per carte_sconto: permetti upsert quando user_id coincide O quando user_id era NULL (migrazione)
DROP POLICY IF EXISTS "insert_own_carte_sconto" ON carte_sconto;
CREATE POLICY "insert_own_carte_sconto" ON carte_sconto FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_carte_sconto" ON carte_sconto;
CREATE POLICY "update_own_carte_sconto" ON carte_sconto FOR UPDATE
  TO authenticated USING (auth.uid() = user_id OR user_id IS NULL)
  WITH CHECK (auth.uid() = user_id);

-- Per carte_premium: stessa cosa
DROP POLICY IF EXISTS "insert_own_carte_premium" ON carte_premium;
CREATE POLICY "insert_own_carte_premium" ON carte_premium FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_carte_premium" ON carte_premium;
CREATE POLICY "update_own_carte_premium" ON carte_premium FOR UPDATE
  TO authenticated USING (auth.uid() = user_id OR user_id IS NULL)
  WITH CHECK (auth.uid() = user_id);

-- Per ricariche_carta_premium
DROP POLICY IF EXISTS "update_own_ricariche_carta_premium" ON ricariche_carta_premium;
CREATE POLICY "update_own_ricariche_carta_premium" ON ricariche_carta_premium FOR UPDATE
  TO authenticated USING (auth.uid() = user_id OR user_id IS NULL)
  WITH CHECK (auth.uid() = user_id);

-- Per utilizzi_carta_sconto
DROP POLICY IF EXISTS "update_own_utilizzi_carta_sconto" ON utilizzi_carta_sconto;
CREATE POLICY "update_own_utilizzi_carta_sconto" ON utilizzi_carta_sconto FOR UPDATE
  TO authenticated USING (auth.uid() = user_id OR user_id IS NULL)
  WITH CHECK (auth.uid() = user_id);

-- Per utilizzi_carta_premium
DROP POLICY IF EXISTS "update_own_utilizzi_carta_premium" ON utilizzi_carta_premium;
CREATE POLICY "update_own_utilizzi_carta_premium" ON utilizzi_carta_premium FOR UPDATE
  TO authenticated USING (auth.uid() = user_id OR user_id IS NULL)
  WITH CHECK (auth.uid() = user_id);

-- SELECT: permetti lettura anche delle righe senza user_id (per non perdere dati storici)
DROP POLICY IF EXISTS "select_own_carte_sconto" ON carte_sconto;
CREATE POLICY "select_own_carte_sconto" ON carte_sconto FOR SELECT
  TO authenticated USING (auth.uid() = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "select_own_carte_premium" ON carte_premium;
CREATE POLICY "select_own_carte_premium" ON carte_premium FOR SELECT
  TO authenticated USING (auth.uid() = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "select_own_ricariche_carta_premium" ON ricariche_carta_premium;
CREATE POLICY "select_own_ricariche_carta_premium" ON ricariche_carta_premium FOR SELECT
  TO authenticated USING (auth.uid() = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "select_own_utilizzi_carta_sconto" ON utilizzi_carta_sconto;
CREATE POLICY "select_own_utilizzi_carta_sconto" ON utilizzi_carta_sconto FOR SELECT
  TO authenticated USING (auth.uid() = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "select_own_utilizzi_carta_premium" ON utilizzi_carta_premium;
CREATE POLICY "select_own_utilizzi_carta_premium" ON utilizzi_carta_premium FOR SELECT
  TO authenticated USING (auth.uid() = user_id OR user_id IS NULL);
