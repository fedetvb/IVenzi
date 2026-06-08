
-- Tabella messaggi inviati dalle clienti dal portale online
CREATE TABLE IF NOT EXISTS messaggi_clienti (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  cliente_id UUID REFERENCES clienti(id) ON DELETE SET NULL,
  nome TEXT NOT NULL DEFAULT '',
  cognome TEXT NOT NULL DEFAULT '',
  telefono TEXT NOT NULL DEFAULT '',
  testo TEXT NOT NULL DEFAULT '',
  foto_url_1 TEXT DEFAULT '',
  foto_url_2 TEXT DEFAULT '',
  foto_url_3 TEXT DEFAULT '',
  letto BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indice per recuperare messaggi per cliente
CREATE INDEX IF NOT EXISTS idx_messaggi_clienti_cliente_id ON messaggi_clienti(cliente_id);
CREATE INDEX IF NOT EXISTS idx_messaggi_clienti_user_id ON messaggi_clienti(user_id);
CREATE INDEX IF NOT EXISTS idx_messaggi_clienti_letto ON messaggi_clienti(letto);

ALTER TABLE messaggi_clienti ENABLE ROW LEVEL SECURITY;

-- Autenticati: full control sui propri messaggi
CREATE POLICY "select_own_messaggi" ON messaggi_clienti FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_messaggi" ON messaggi_clienti FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_messaggi" ON messaggi_clienti FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_messaggi" ON messaggi_clienti FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Anon: può solo inserire (per il portale prenotazioni)
CREATE POLICY "anon_insert_messaggi" ON messaggi_clienti FOR INSERT
  TO anon WITH CHECK (true);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE messaggi_clienti;
ALTER TABLE messaggi_clienti REPLICA IDENTITY FULL;

-- Bucket per le foto dei messaggi clienti (usa stesso bucket foto-clienti già esistente)
-- Il bucket foto-clienti è già pubblico e con le policy necessarie dalla migrazione precedente
