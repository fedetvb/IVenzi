/*
  # Fix impostazioni: chiave univoca per utente

  ## Problema
  La primary key era solo su `chiave`, causando conflitti quando due utenti
  diversi provavano a salvare la stessa impostazione (es. promemoria_convalida_orario).
  L'upsert trovava la riga dell'altro utente, tentava di aggiornarla, e la RLS bloccava.

  ## Modifiche
  1. Rimozione della PK su `chiave`
  2. Aggiunta colonna `id` uuid come nuova primary key
  3. Creazione unique index su `(chiave, user_id)` con NULLS NOT DISTINCT
     (le righe di sistema con user_id NULL sono ancora univoche per chiave)
  4. Aggiornamento degli upsert in codice per usare onConflict: 'chiave,user_id'
*/

-- 1. Aggiungi colonna id (se non esiste)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'impostazioni' AND column_name = 'id'
  ) THEN
    ALTER TABLE impostazioni ADD COLUMN id uuid DEFAULT gen_random_uuid();
    UPDATE impostazioni SET id = gen_random_uuid() WHERE id IS NULL;
  END IF;
END $$;

-- 2. Rimuovi la vecchia PK su chiave
ALTER TABLE impostazioni DROP CONSTRAINT IF EXISTS impostazioni_pkey;

-- 3. Imposta id come nuova PK
ALTER TABLE impostazioni ADD PRIMARY KEY (id);

-- 4. Unique index su (chiave, user_id) — NULLS NOT DISTINCT garantisce che
--    due righe di sistema (user_id NULL) con la stessa chiave siano ancora in conflitto
CREATE UNIQUE INDEX IF NOT EXISTS impostazioni_chiave_user_unique
  ON impostazioni (chiave, user_id) NULLS NOT DISTINCT;
