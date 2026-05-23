/*
  # Aggiunge fiche_id a rivendita_prodotti

  Permette di collegare una vendita rivendita alla fiche da cui è stata generata
  automaticamente in fase di convalida. Serve anche per cancellare i record
  rivendita in caso di annullamento convalida.

  1. Modifiche
    - `rivendita_prodotti`: aggiunta colonna `fiche_id` (uuid, nullable, FK verso fiches)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rivendita_prodotti' AND column_name = 'fiche_id'
  ) THEN
    ALTER TABLE rivendita_prodotti ADD COLUMN fiche_id uuid REFERENCES fiches(id) ON DELETE SET NULL;
  END IF;
END $$;
