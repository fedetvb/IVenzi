/*
  # Crea tabella trattamenti_eseguiti

  ## Scopo
  Traccia i trattamenti (servizi) eseguiti da ogni parrucchiere, registrati
  automaticamente alla convalida di una fiche, in modo analogo a rivendita_prodotti.

  ## Nuove tabelle
  - `trattamenti_eseguiti`
    - `id` (uuid, pk)
    - `fiche_id` (uuid, nullable, riferimento alla fiche sorgente)
    - `parrucchiere_id` (uuid, fk parrucchieri)
    - `nome_trattamento` (text) - nome del servizio eseguito
    - `prezzo` (numeric) - prezzo del trattamento
    - `data_esecuzione` (date) - data in cui è stato eseguito
    - `note` (text)
    - `user_id` (uuid, fk auth.users)
    - `created_at` (timestamptz)

  ## Sicurezza
  - RLS abilitato
  - Policy per utenti autenticati (solo dati propri)
*/

CREATE TABLE IF NOT EXISTS trattamenti_eseguiti (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fiche_id uuid,
  parrucchiere_id uuid REFERENCES parrucchieri(id) ON DELETE SET NULL,
  nome_trattamento text NOT NULL DEFAULT '',
  prezzo numeric(10,2) NOT NULL DEFAULT 0,
  data_esecuzione date NOT NULL DEFAULT CURRENT_DATE,
  note text NOT NULL DEFAULT '',
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE trattamenti_eseguiti ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own trattamenti_eseguiti"
  ON trattamenti_eseguiti FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own trattamenti_eseguiti"
  ON trattamenti_eseguiti FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own trattamenti_eseguiti"
  ON trattamenti_eseguiti FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own trattamenti_eseguiti"
  ON trattamenti_eseguiti FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Permessi anon per retrocompatibilità con politiche esistenti
CREATE POLICY "Anon can select trattamenti_eseguiti"
  ON trattamenti_eseguiti FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anon can insert trattamenti_eseguiti"
  ON trattamenti_eseguiti FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anon can delete trattamenti_eseguiti"
  ON trattamenti_eseguiti FOR DELETE
  TO anon
  USING (true);

CREATE INDEX IF NOT EXISTS trattamenti_eseguiti_parrucchiere_id_idx ON trattamenti_eseguiti(parrucchiere_id);
CREATE INDEX IF NOT EXISTS trattamenti_eseguiti_data_esecuzione_idx ON trattamenti_eseguiti(data_esecuzione);
CREATE INDEX IF NOT EXISTS trattamenti_eseguiti_fiche_id_idx ON trattamenti_eseguiti(fiche_id);
