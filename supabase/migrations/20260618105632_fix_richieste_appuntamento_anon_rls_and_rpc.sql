
-- 1. Garantisce che anon possa INSERT su richieste_appuntamento (portal pubblico)
DROP POLICY IF EXISTS "anon_insert_richieste_appuntamento" ON richieste_appuntamento;
CREATE POLICY "anon_insert_richieste_appuntamento" ON richieste_appuntamento
  FOR INSERT TO anon WITH CHECK (true);

-- Anon deve anche poter leggere le proprie richieste dopo l'insert (per feedback UI)
DROP POLICY IF EXISTS "anon_select_richieste_appuntamento" ON richieste_appuntamento;
CREATE POLICY "anon_select_richieste_appuntamento" ON richieste_appuntamento
  FOR SELECT TO anon USING (true);

-- 2. Anon deve poter leggere i parrucchieri per mostrarli nel portale
DROP POLICY IF EXISTS "anon_select_parrucchieri" ON parrucchieri;
CREATE POLICY "anon_select_parrucchieri" ON parrucchieri
  FOR SELECT TO anon USING (attivo = true);

-- 3. Ricrea la funzione RPC cliente_ha_fiches (era 404 perché mancava nel PostgREST cache)
CREATE OR REPLACE FUNCTION public.cliente_ha_fiches(p_telefono text, p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM fiches f
    JOIN clienti c ON c.id = f.cliente_id
    WHERE c.telefono = p_telefono
      AND f.user_id = p_user_id
      AND f.deleted_at IS NULL
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.cliente_ha_fiches(text, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.cliente_ha_fiches(text, uuid) TO authenticated;

-- Notifica PostgREST di ricaricare lo schema
NOTIFY pgrst, 'reload schema';
