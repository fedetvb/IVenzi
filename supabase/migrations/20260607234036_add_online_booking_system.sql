-- Add online booking field to services catalog
ALTER TABLE trattamenti_catalogo
  ADD COLUMN IF NOT EXISTS prenotazione_online_abilitata BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS servizio_abbinato_online_id UUID REFERENCES trattamenti_catalogo(id) ON DELETE SET NULL;

-- Table for online booking requests
CREATE TABLE IF NOT EXISTS richieste_appuntamento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Client info
  nome TEXT NOT NULL,
  cognome TEXT NOT NULL,
  telefono TEXT NOT NULL,
  cliente_id UUID REFERENCES clienti(id) ON DELETE SET NULL,
  -- Primary appointment
  parrucchiere_id UUID NOT NULL REFERENCES parrucchieri(id),
  servizio_id UUID NOT NULL REFERENCES trattamenti_catalogo(id),
  data_ora TIMESTAMPTZ NOT NULL,
  -- Secondary appointment (abbinato)
  parrucchiere2_id UUID REFERENCES parrucchieri(id),
  servizio2_id UUID REFERENCES trattamenti_catalogo(id),
  data_ora2 TIMESTAMPTZ,
  -- Status
  stato TEXT NOT NULL DEFAULT 'in_attesa' CHECK (stato IN ('in_attesa', 'confermata', 'rifiutata')),
  note TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE richieste_appuntamento ENABLE ROW LEVEL SECURITY;

-- Anon can insert (public booking page)
CREATE POLICY "anon_insert_richieste" ON richieste_appuntamento FOR INSERT TO anon WITH CHECK (true);

-- Authenticated (salon owner) can do everything on their own records
CREATE POLICY "auth_select_richieste" ON richieste_appuntamento FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "auth_update_richieste" ON richieste_appuntamento FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "auth_delete_richieste" ON richieste_appuntamento FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Enable realtime for instant notifications
ALTER PUBLICATION supabase_realtime ADD TABLE richieste_appuntamento;
ALTER TABLE richieste_appuntamento REPLICA IDENTITY FULL;

-- Add online booking toggle to impostazioni (no table change needed, uses existing key-value store)
-- Key: prenotazioni_online_attive (values: 'true'/'false')
-- Key: msg_conferma_appuntamento_online
-- Key: msg_rifiuto_appuntamento_online
