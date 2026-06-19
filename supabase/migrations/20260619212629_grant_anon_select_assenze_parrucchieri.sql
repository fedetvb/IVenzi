-- Permette al ruolo anon (portale clienti pubblico) di leggere le assenze
-- senza GRANT il ruolo anon ottiene 404 da PostgREST anche se la RLS policy esiste

GRANT SELECT ON TABLE assenze_parrucchieri TO anon;
GRANT SELECT ON TABLE assenze_parrucchieri TO authenticated;

-- Assicura che la policy anon SELECT esista (idempotente)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'assenze_parrucchieri' AND roles @> '{anon}' AND cmd = 'SELECT'
  ) THEN
    CREATE POLICY "anon_select_assenze_parrucchieri"
      ON assenze_parrucchieri FOR SELECT TO anon USING (true);
  END IF;
END $$;

-- Ricarica la cache dello schema PostgREST
NOTIFY pgrst, 'reload schema';
