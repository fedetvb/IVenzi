/*
  # Fix policy UPDATE su schede_clienti_da_confermare per righe con user_id NULL

  ## Problema
  La policy "Users can update own schede da confermare" usa USING (auth.uid() = user_id).
  Le schede inviate dal form pubblico hanno user_id = NULL, quindi
  auth.uid() = NULL valuta a NULL (non TRUE), bloccando silenziosamente la convalida.

  ## Soluzione
  Sostituire la policy UPDATE per permettere agli utenti autenticati di aggiornare
  sia le righe di loro proprieta' (user_id = auth.uid()) sia le righe pubbliche
  senza account (user_id IS NULL).
*/

DROP POLICY IF EXISTS "Users can update own schede da confermare" ON public.schede_clienti_da_confermare;

CREATE POLICY "Users can update schede own or public"
  ON public.schede_clienti_da_confermare
  FOR UPDATE
  TO authenticated
  USING (
    (user_id = auth.uid()) OR (user_id IS NULL)
  )
  WITH CHECK (
    (user_id = auth.uid()) OR (user_id IS NULL)
  );
