/*
  # Fix anon access to schede_clienti_da_confermare

  The public client form (PrenotazioneOnline) needs to:
  1. SELECT to check for an existing pending scheda by user_id + telefono
  2. INSERT a new scheda linked to the salon (user_id = salon owner's uuid)
  3. UPDATE an existing pending scheda to add email, data_nascita, note

  Previous policies blocked all three operations for anon.
*/

-- 1. Allow anon to read pending schede (needed for duplicate check by phone)
DROP POLICY IF EXISTS "Anon can read pending schede" ON public.schede_clienti_da_confermare;
CREATE POLICY "Anon can read pending schede"
  ON public.schede_clienti_da_confermare
  FOR SELECT
  TO anon
  USING (stato = 'in_attesa');

-- 2. Allow anon to insert with a salon user_id (not null) and stato in_attesa
DROP POLICY IF EXISTS "Anon can insert pending schede senza account" ON public.schede_clienti_da_confermare;
CREATE POLICY "Anon can insert pending schede"
  ON public.schede_clienti_da_confermare
  FOR INSERT
  TO anon
  WITH CHECK (
    user_id IS NOT NULL
    AND stato = 'in_attesa'
  );

-- 3. Allow anon to update pending schede (to add email, data_nascita, note)
DROP POLICY IF EXISTS "Anon can update pending schede" ON public.schede_clienti_da_confermare;
CREATE POLICY "Anon can update pending schede"
  ON public.schede_clienti_da_confermare
  FOR UPDATE
  TO anon
  USING (stato = 'in_attesa')
  WITH CHECK (stato = 'in_attesa');
