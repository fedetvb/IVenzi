/*
  # Tabella assenze_parrucchieri

  Gestisce le assenze dei parrucchieri nell'agenda giornaliera.

  ## Nuove tabelle
  - `assenze_parrucchieri`
    - `id` (uuid, pk)
    - `parrucchiere_id` (uuid, FK parrucchieri)
    - `data_inizio` (date) - primo giorno di assenza
    - `data_fine` (date) - ultimo giorno di assenza (incluso)
    - `ora_inizio` (time, nullable) - se NULL = assente tutta la giornata; se valorizzato = assente da quell'ora in poi
    - `note` (text)
    - `created_at`

  ## Logica
  - Se `ora_inizio` è NULL: la colonna del parrucchiere viene nascosta completamente
  - Se `ora_inizio` è valorizzato: la colonna viene mostrata ma grigiata dall'ora indicata in poi

  ## Sicurezza
  - RLS abilitato
  - Accesso anonimo (stesso pattern del resto dell'app)
*/

CREATE TABLE IF NOT EXISTS assenze_parrucchieri (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parrucchiere_id uuid NOT NULL REFERENCES parrucchieri(id) ON DELETE CASCADE,
  data_inizio date NOT NULL,
  data_fine date NOT NULL,
  ora_inizio time DEFAULT NULL,
  note text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  CONSTRAINT data_fine_gte_inizio CHECK (data_fine >= data_inizio)
);

CREATE INDEX IF NOT EXISTS idx_assenze_parrucchieri_parrucchiere ON assenze_parrucchieri(parrucchiere_id);
CREATE INDEX IF NOT EXISTS idx_assenze_parrucchieri_date ON assenze_parrucchieri(data_inizio, data_fine);

ALTER TABLE assenze_parrucchieri ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can select assenze_parrucchieri"
  ON assenze_parrucchieri FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anon can insert assenze_parrucchieri"
  ON assenze_parrucchieri FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anon can update assenze_parrucchieri"
  ON assenze_parrucchieri FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anon can delete assenze_parrucchieri"
  ON assenze_parrucchieri FOR DELETE
  TO anon
  USING (true);
