/*
  # Crea tabella keep_alive_ping_log

  Tiene uno storico di ogni ping eseguito (automatico o manuale) per mostrare
  il riepilogo settimanale del martedi.

  ## Nuove tabelle
  - `keep_alive_ping_log`
    - `id` (uuid, PK)
    - `eseguito_at` (timestamptz) — quando e' avvenuto il ping
    - `tipo` (text) — 'automatico' | 'manuale'

  ## Sicurezza
  - RLS abilitato
  - Lettura: utenti autenticati
  - Inserimento: service_role tramite edge function (nessuna policy needed con service key)
*/

CREATE TABLE IF NOT EXISTS keep_alive_ping_log (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  eseguito_at timestamptz NOT NULL DEFAULT now(),
  tipo       text NOT NULL DEFAULT 'automatico'
);

ALTER TABLE keep_alive_ping_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read ping log"
  ON keep_alive_ping_log FOR SELECT
  TO authenticated
  USING (true);
