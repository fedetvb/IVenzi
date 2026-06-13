ALTER TABLE schede_clienti_da_confermare
  ADD COLUMN IF NOT EXISTS benvenuto_visto boolean NOT NULL DEFAULT false;
