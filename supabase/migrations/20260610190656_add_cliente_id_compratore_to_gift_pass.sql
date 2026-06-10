-- Aggiunge cliente_id per tracciare chi ha acquistato/donato il gift pass
ALTER TABLE gift_pass
  ADD COLUMN IF NOT EXISTS cliente_id UUID REFERENCES clienti(id) ON DELETE SET NULL;

-- Indice per query veloci per donatore
CREATE INDEX IF NOT EXISTS idx_gift_pass_cliente_id ON gift_pass(cliente_id);

-- RLS: estendi le policy esistenti se necessario (la tabella usa già user_id per isolamento)
-- Nessuna policy separata necessaria: la tabella è protetta da user_id