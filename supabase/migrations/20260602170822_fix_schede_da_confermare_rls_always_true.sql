/*
  # Fix RLS policies for schede_clienti_da_confermare

  ## Problem
  Two policies allowed unrestricted access:
  1. "Anon can insert schede da confermare" had WITH CHECK = true (no restrictions)
  2. "Anon e autenticati possono leggere le schede" had USING = true (anyone could read all rows)

  ## Changes
  - Drop and replace the unrestricted INSERT policy:
    - Anon users can only insert rows where user_id IS NULL and stato = 'in_attesa'
    - This matches the legitimate use case (public client registration form)
  - Drop the unrestricted SELECT policy for anon/authenticated:
    - Authenticated users already have their own SELECT policies (user_id = auth.uid())
    - Anon users do not need to read any rows from this table
*/

-- Drop the always-true INSERT policy
DROP POLICY IF EXISTS "Anon can insert schede da confermare" ON public.schede_clienti_da_confermare;

-- Replace with a restricted INSERT policy:
-- anon can only insert with user_id = NULL and stato = 'in_attesa'
CREATE POLICY "Anon can insert pending schede senza account"
  ON public.schede_clienti_da_confermare
  FOR INSERT
  TO anon
  WITH CHECK (
    user_id IS NULL
    AND stato = 'in_attesa'
  );

-- Drop the always-true SELECT policy (all legitimate reads are covered by other policies)
DROP POLICY IF EXISTS "Anon e autenticati possono leggere le schede" ON public.schede_clienti_da_confermare;
