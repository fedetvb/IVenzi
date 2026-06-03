/*
  # Tabella OTP per recupero password

  Crea una tabella per salvare i codici OTP temporanei usati nel flusso di recupero password.

  1. Nuove tabelle
    - `password_reset_otp`
      - `id` (uuid, primary key)
      - `user_id` (uuid, riferimento a auth.users)
      - `email` (text, email dell'utente)
      - `code` (text, codice OTP a 6 cifre)
      - `expires_at` (timestamptz, scadenza 30 minuti)
      - `used` (boolean, se il codice è già stato usato)
      - `created_at` (timestamptz)

  2. Sicurezza
    - RLS abilitato
    - Nessun accesso diretto da client (solo service role tramite edge function)
*/

CREATE TABLE IF NOT EXISTS password_reset_otp (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  code text NOT NULL,
  expires_at timestamptz NOT NULL,
  used boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE password_reset_otp ENABLE ROW LEVEL SECURITY;

-- Nessun accesso diretto da client — solo service role via edge function
-- Le policy sono volutamente restrittive: nessuno può leggere/scrivere direttamente
CREATE POLICY "No direct client access select"
  ON password_reset_otp FOR SELECT
  TO authenticated
  USING (false);

CREATE POLICY "No direct client access insert"
  ON password_reset_otp FOR INSERT
  TO authenticated
  WITH CHECK (false);

CREATE POLICY "No direct client access update"
  ON password_reset_otp FOR UPDATE
  TO authenticated
  USING (false)
  WITH CHECK (false);

CREATE POLICY "No direct client access delete"
  ON password_reset_otp FOR DELETE
  TO authenticated
  USING (false);
