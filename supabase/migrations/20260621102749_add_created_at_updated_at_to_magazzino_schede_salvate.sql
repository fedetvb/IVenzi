-- Aggiunge 'created_at' richiesta da dbInsert che la inietta automaticamente
ALTER TABLE magazzino_schede_salvate
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

-- Aggiunge 'updated_at' (anch'essa iniettata automaticamente da dbInsert/dbUpdate)
ALTER TABLE magazzino_schede_salvate
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Forza il reload della schema cache di PostgREST
NOTIFY pgrst, 'reload schema';
