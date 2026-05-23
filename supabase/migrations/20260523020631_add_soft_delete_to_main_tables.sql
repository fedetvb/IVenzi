/*
  # Soft Delete — Cestino

  Aggiunge la colonna `deleted_at` (timestamp nullable) alle tabelle principali
  per abilitare il "cestino": invece di cancellare fisicamente i record, viene
  impostata la data di eliminazione. I record possono essere ripristinati
  azzerando `deleted_at`.

  ## Tabelle modificate
  - clienti
  - appuntamenti
  - parrucchieri
  - schede_colore
  - carte_sconto
  - carte_premium
  - fiches
  - rivendita_prodotti
  - spese

  ## Note
  - Tutte le colonne sono nullable (NULL = non eliminato)
  - Nessun dato esistente viene modificato
  - Le RLS policies esistenti rimangono invariate; il filtro deleted_at
    è gestito lato applicazione
*/

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clienti' AND column_name='deleted_at') THEN
    ALTER TABLE clienti ADD COLUMN deleted_at timestamptz DEFAULT NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='appuntamenti' AND column_name='deleted_at') THEN
    ALTER TABLE appuntamenti ADD COLUMN deleted_at timestamptz DEFAULT NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='parrucchieri' AND column_name='deleted_at') THEN
    ALTER TABLE parrucchieri ADD COLUMN deleted_at timestamptz DEFAULT NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='schede_colore' AND column_name='deleted_at') THEN
    ALTER TABLE schede_colore ADD COLUMN deleted_at timestamptz DEFAULT NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='carte_sconto' AND column_name='deleted_at') THEN
    ALTER TABLE carte_sconto ADD COLUMN deleted_at timestamptz DEFAULT NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='carte_premium' AND column_name='deleted_at') THEN
    ALTER TABLE carte_premium ADD COLUMN deleted_at timestamptz DEFAULT NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='fiches' AND column_name='deleted_at') THEN
    ALTER TABLE fiches ADD COLUMN deleted_at timestamptz DEFAULT NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='rivendita_prodotti' AND column_name='deleted_at') THEN
    ALTER TABLE rivendita_prodotti ADD COLUMN deleted_at timestamptz DEFAULT NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='spese' AND column_name='deleted_at') THEN
    ALTER TABLE spese ADD COLUMN deleted_at timestamptz DEFAULT NULL;
  END IF;
END $$;
