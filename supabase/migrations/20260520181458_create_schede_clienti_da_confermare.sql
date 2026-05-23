/*
  # Crea tabella schede_clienti_da_confermare

  ## Descrizione
  Tabella per raccogliere i dati inviati dalle nuove clienti tramite il form pubblico (QR code).
  I dati restano in attesa di conferma da parte del salone prima di essere trasferiti in clienti.

  ## Tabelle
  - `schede_clienti_da_confermare`
    - id (uuid, pk)
    - nome (text, obbligatorio)
    - cognome (text, obbligatorio)
    - telefono (text)
    - email (text)
    - data_nascita (date)
    - note (text)
    - stato (text): 'in_attesa' | 'confermato' | 'rifiutato'
    - created_at (timestamptz)

  ## Sicurezza
  - RLS abilitato
  - Chiunque (anon) può inserire (form pubblico)
  - Solo authenticated può leggere/aggiornare/eliminare
*/

CREATE TABLE IF NOT EXISTS schede_clienti_da_confermare (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  cognome text NOT NULL,
  telefono text DEFAULT '',
  email text DEFAULT '',
  data_nascita date,
  note text DEFAULT '',
  stato text NOT NULL DEFAULT 'in_attesa',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE schede_clienti_da_confermare ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Chiunque puo inserire una scheda"
  ON schede_clienti_da_confermare
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Solo autenticati possono leggere le schede"
  ON schede_clienti_da_confermare
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Solo autenticati possono aggiornare le schede"
  ON schede_clienti_da_confermare
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Solo autenticati possono eliminare le schede"
  ON schede_clienti_da_confermare
  FOR DELETE
  TO authenticated
  USING (true);
