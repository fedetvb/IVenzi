/*
  # Aggiungi parrucchiere_id alla tabella appuntamenti

  Ogni appuntamento è ora associato a un parrucchiere specifico.
  Questo consente di visualizzare gli appuntamenti nella colonna corretta
  nell'agenda giornaliera.

  1. Modifiche
    - `appuntamenti`: aggiunta colonna `parrucchiere_id` (uuid, nullable FK a parrucchieri)
    - Aggiunto indice su parrucchiere_id per query veloci
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'appuntamenti' AND column_name = 'parrucchiere_id'
  ) THEN
    ALTER TABLE appuntamenti ADD COLUMN parrucchiere_id uuid REFERENCES parrucchieri(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_appuntamenti_parrucchiere ON appuntamenti(parrucchiere_id);
