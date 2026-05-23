/*
  # Aggiunta user_id a tutte le tabelle principali

  ## Obiettivo
  Isolare i dati per utente: ogni record appartiene a uno specifico account.
  Un nuovo utente che si registra partira' con un gestionale completamente vuoto.

  ## Modifiche
  - Aggiunta colonna `user_id` (uuid, riferimento a auth.users) a tutte le tabelle principali
  - Assegnazione di tutti i dati esistenti all'utente fede_tvb@hotmail.com
  - Aggiunta colonna NOT NULL con default = auth.uid() per i nuovi inserimenti

  ## Tabelle modificate
  1. clienti
  2. appuntamenti
  3. appuntamento_trattamenti
  4. schede_colore
  5. parrucchieri
  6. giorni_parrucchieri
  7. impostazioni
  8. voci_extra_catalogo
  9. fiches
  10. fiche_voci
  11. incassi_giornalieri
  12. carte_sconto
  13. utilizzi_carta_sconto
  14. carte_premium
  15. ricariche_carta_premium
  16. utilizzi_carta_premium
  17. rivendita_prodotti
  18. template_messaggi_carta_sconto
  19. template_messaggi_comunicazioni
  20. schede_clienti_da_confermare
  21. magazzino_categorie
  22. magazzino_prodotti
  23. magazzino_schede_salvate
  24. assenze_parrucchieri
  25. spese
  26. impostazioni_tasse
  27. prodotti_rivendita_catalogo
  28. trattamenti_catalogo

  ## Note
  - user_id inizialmente nullable per permettere l'assegnazione dei dati esistenti
  - Dopo l'assegnazione viene impostato NOT NULL
*/

-- =============================================
-- STEP 1: Aggiunta colonna user_id (nullable)
-- =============================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clienti' AND column_name = 'user_id') THEN
    ALTER TABLE clienti ADD COLUMN user_id uuid REFERENCES auth.users(id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'appuntamenti' AND column_name = 'user_id') THEN
    ALTER TABLE appuntamenti ADD COLUMN user_id uuid REFERENCES auth.users(id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'appuntamento_trattamenti' AND column_name = 'user_id') THEN
    ALTER TABLE appuntamento_trattamenti ADD COLUMN user_id uuid REFERENCES auth.users(id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'schede_colore' AND column_name = 'user_id') THEN
    ALTER TABLE schede_colore ADD COLUMN user_id uuid REFERENCES auth.users(id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'parrucchieri' AND column_name = 'user_id') THEN
    ALTER TABLE parrucchieri ADD COLUMN user_id uuid REFERENCES auth.users(id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'giorni_parrucchieri' AND column_name = 'user_id') THEN
    ALTER TABLE giorni_parrucchieri ADD COLUMN user_id uuid REFERENCES auth.users(id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'impostazioni' AND column_name = 'user_id') THEN
    ALTER TABLE impostazioni ADD COLUMN user_id uuid REFERENCES auth.users(id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'voci_extra_catalogo' AND column_name = 'user_id') THEN
    ALTER TABLE voci_extra_catalogo ADD COLUMN user_id uuid REFERENCES auth.users(id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fiches' AND column_name = 'user_id') THEN
    ALTER TABLE fiches ADD COLUMN user_id uuid REFERENCES auth.users(id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fiche_voci' AND column_name = 'user_id') THEN
    ALTER TABLE fiche_voci ADD COLUMN user_id uuid REFERENCES auth.users(id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'incassi_giornalieri' AND column_name = 'user_id') THEN
    ALTER TABLE incassi_giornalieri ADD COLUMN user_id uuid REFERENCES auth.users(id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'carte_sconto' AND column_name = 'user_id') THEN
    ALTER TABLE carte_sconto ADD COLUMN user_id uuid REFERENCES auth.users(id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'utilizzi_carta_sconto' AND column_name = 'user_id') THEN
    ALTER TABLE utilizzi_carta_sconto ADD COLUMN user_id uuid REFERENCES auth.users(id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'carte_premium' AND column_name = 'user_id') THEN
    ALTER TABLE carte_premium ADD COLUMN user_id uuid REFERENCES auth.users(id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ricariche_carta_premium' AND column_name = 'user_id') THEN
    ALTER TABLE ricariche_carta_premium ADD COLUMN user_id uuid REFERENCES auth.users(id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'utilizzi_carta_premium' AND column_name = 'user_id') THEN
    ALTER TABLE utilizzi_carta_premium ADD COLUMN user_id uuid REFERENCES auth.users(id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'rivendita_prodotti' AND column_name = 'user_id') THEN
    ALTER TABLE rivendita_prodotti ADD COLUMN user_id uuid REFERENCES auth.users(id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'template_messaggi_carta_sconto' AND column_name = 'user_id') THEN
    ALTER TABLE template_messaggi_carta_sconto ADD COLUMN user_id uuid REFERENCES auth.users(id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'template_messaggi_comunicazioni' AND column_name = 'user_id') THEN
    ALTER TABLE template_messaggi_comunicazioni ADD COLUMN user_id uuid REFERENCES auth.users(id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'schede_clienti_da_confermare' AND column_name = 'user_id') THEN
    ALTER TABLE schede_clienti_da_confermare ADD COLUMN user_id uuid REFERENCES auth.users(id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'magazzino_categorie' AND column_name = 'user_id') THEN
    ALTER TABLE magazzino_categorie ADD COLUMN user_id uuid REFERENCES auth.users(id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'magazzino_prodotti' AND column_name = 'user_id') THEN
    ALTER TABLE magazzino_prodotti ADD COLUMN user_id uuid REFERENCES auth.users(id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'magazzino_schede_salvate' AND column_name = 'user_id') THEN
    ALTER TABLE magazzino_schede_salvate ADD COLUMN user_id uuid REFERENCES auth.users(id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assenze_parrucchieri' AND column_name = 'user_id') THEN
    ALTER TABLE assenze_parrucchieri ADD COLUMN user_id uuid REFERENCES auth.users(id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'spese' AND column_name = 'user_id') THEN
    ALTER TABLE spese ADD COLUMN user_id uuid REFERENCES auth.users(id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'impostazioni_tasse' AND column_name = 'user_id') THEN
    ALTER TABLE impostazioni_tasse ADD COLUMN user_id uuid REFERENCES auth.users(id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prodotti_rivendita_catalogo' AND column_name = 'user_id') THEN
    ALTER TABLE prodotti_rivendita_catalogo ADD COLUMN user_id uuid REFERENCES auth.users(id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trattamenti_catalogo' AND column_name = 'user_id') THEN
    ALTER TABLE trattamenti_catalogo ADD COLUMN user_id uuid REFERENCES auth.users(id);
  END IF;
END $$;

-- =============================================
-- STEP 2: Assegna tutti i dati esistenti a fede_tvb@hotmail.com
-- =============================================

UPDATE clienti SET user_id = '1c7bb67b-523f-4f7a-aab2-166022a91be2' WHERE user_id IS NULL;
UPDATE appuntamenti SET user_id = '1c7bb67b-523f-4f7a-aab2-166022a91be2' WHERE user_id IS NULL;
UPDATE appuntamento_trattamenti SET user_id = '1c7bb67b-523f-4f7a-aab2-166022a91be2' WHERE user_id IS NULL;
UPDATE schede_colore SET user_id = '1c7bb67b-523f-4f7a-aab2-166022a91be2' WHERE user_id IS NULL;
UPDATE parrucchieri SET user_id = '1c7bb67b-523f-4f7a-aab2-166022a91be2' WHERE user_id IS NULL;
UPDATE giorni_parrucchieri SET user_id = '1c7bb67b-523f-4f7a-aab2-166022a91be2' WHERE user_id IS NULL;
UPDATE impostazioni SET user_id = '1c7bb67b-523f-4f7a-aab2-166022a91be2' WHERE user_id IS NULL;
UPDATE voci_extra_catalogo SET user_id = '1c7bb67b-523f-4f7a-aab2-166022a91be2' WHERE user_id IS NULL;
UPDATE fiches SET user_id = '1c7bb67b-523f-4f7a-aab2-166022a91be2' WHERE user_id IS NULL;
UPDATE fiche_voci SET user_id = '1c7bb67b-523f-4f7a-aab2-166022a91be2' WHERE user_id IS NULL;
UPDATE incassi_giornalieri SET user_id = '1c7bb67b-523f-4f7a-aab2-166022a91be2' WHERE user_id IS NULL;
UPDATE carte_sconto SET user_id = '1c7bb67b-523f-4f7a-aab2-166022a91be2' WHERE user_id IS NULL;
UPDATE utilizzi_carta_sconto SET user_id = '1c7bb67b-523f-4f7a-aab2-166022a91be2' WHERE user_id IS NULL;
UPDATE carte_premium SET user_id = '1c7bb67b-523f-4f7a-aab2-166022a91be2' WHERE user_id IS NULL;
UPDATE ricariche_carta_premium SET user_id = '1c7bb67b-523f-4f7a-aab2-166022a91be2' WHERE user_id IS NULL;
UPDATE utilizzi_carta_premium SET user_id = '1c7bb67b-523f-4f7a-aab2-166022a91be2' WHERE user_id IS NULL;
UPDATE rivendita_prodotti SET user_id = '1c7bb67b-523f-4f7a-aab2-166022a91be2' WHERE user_id IS NULL;
UPDATE template_messaggi_carta_sconto SET user_id = '1c7bb67b-523f-4f7a-aab2-166022a91be2' WHERE user_id IS NULL;
UPDATE template_messaggi_comunicazioni SET user_id = '1c7bb67b-523f-4f7a-aab2-166022a91be2' WHERE user_id IS NULL;
UPDATE schede_clienti_da_confermare SET user_id = '1c7bb67b-523f-4f7a-aab2-166022a91be2' WHERE user_id IS NULL;
UPDATE magazzino_categorie SET user_id = '1c7bb67b-523f-4f7a-aab2-166022a91be2' WHERE user_id IS NULL;
UPDATE magazzino_prodotti SET user_id = '1c7bb67b-523f-4f7a-aab2-166022a91be2' WHERE user_id IS NULL;
UPDATE magazzino_schede_salvate SET user_id = '1c7bb67b-523f-4f7a-aab2-166022a91be2' WHERE user_id IS NULL;
UPDATE assenze_parrucchieri SET user_id = '1c7bb67b-523f-4f7a-aab2-166022a91be2' WHERE user_id IS NULL;
UPDATE spese SET user_id = '1c7bb67b-523f-4f7a-aab2-166022a91be2' WHERE user_id IS NULL;
UPDATE impostazioni_tasse SET user_id = '1c7bb67b-523f-4f7a-aab2-166022a91be2' WHERE user_id IS NULL;
UPDATE prodotti_rivendita_catalogo SET user_id = '1c7bb67b-523f-4f7a-aab2-166022a91be2' WHERE user_id IS NULL;
UPDATE trattamenti_catalogo SET user_id = '1c7bb67b-523f-4f7a-aab2-166022a91be2' WHERE user_id IS NULL;
