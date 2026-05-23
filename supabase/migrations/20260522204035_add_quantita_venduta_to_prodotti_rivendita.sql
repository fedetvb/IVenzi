/*
  # Aggiunge quantita_venduta a prodotti_rivendita_catalogo

  Traccia il numero di pezzi venduti per calcolare il margine realizzato.
  Il campo si incrementa ogni volta che si clicca il pulsante "-".
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'prodotti_rivendita_catalogo' AND column_name = 'quantita_venduta'
  ) THEN
    ALTER TABLE prodotti_rivendita_catalogo ADD COLUMN quantita_venduta integer NOT NULL DEFAULT 0;
  END IF;
END $$;
