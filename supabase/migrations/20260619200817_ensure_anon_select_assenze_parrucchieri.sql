
-- Garantisce che il ruolo anonimo (portale prenotazioni) possa leggere le assenze
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'assenze_parrucchieri'
      AND roles @> '{anon}'
      AND cmd = 'SELECT'
  ) THEN
    CREATE POLICY "anon_select_assenze"
      ON assenze_parrucchieri FOR SELECT
      TO anon
      USING (true);
  END IF;
END $$;
