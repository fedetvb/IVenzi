/*
  # Aggiunge costo_unitario a rivendita_prodotti

  Aggiunge la colonna costo_unitario alla tabella rivendita_prodotti,
  per permettere il calcolo del margine (prezzo_unitario - costo_unitario) per ogni vendita.
  Il valore di default è 0 per compatibilità con le vendite già esistenti.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rivendita_prodotti' AND column_name = 'costo_unitario'
  ) THEN
    ALTER TABLE rivendita_prodotti ADD COLUMN costo_unitario numeric(10,2) NOT NULL DEFAULT 0;
  END IF;
END $$;
