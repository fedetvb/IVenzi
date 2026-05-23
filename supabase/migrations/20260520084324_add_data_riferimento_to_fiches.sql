/*
  # Aggiunge colonna data_riferimento alle fiches manuali

  Le fiche manuali non hanno un appuntamento associato, quindi non hanno una data
  di riferimento esplicita. Finora si usava created_at ma il timezone causava
  filtri errati. Questa migrazione aggiunge:

  1. Colonna data_riferimento (date) su fiches
  2. Default: data di created_at (per retrocompatibilità con le fiche esistenti)
  3. Le nuove fiche manuali la valorizzano esplicitamente con la data selezionata dall'utente
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'fiches' AND column_name = 'data_riferimento'
  ) THEN
    ALTER TABLE fiches ADD COLUMN data_riferimento date;
    -- Retrocompatibilità: imposta la data dalle fiche manuali esistenti
    UPDATE fiches SET data_riferimento = created_at::date WHERE manuale = true;
  END IF;
END $$;
