-- Add unique partial index so concurrent inserts for same (user_id, telefono, stato=in_attesa) are idempotent
CREATE UNIQUE INDEX IF NOT EXISTS schede_da_confermare_user_tel_attesa_idx
  ON public.schede_clienti_da_confermare (user_id, telefono)
  WHERE stato = 'in_attesa';
