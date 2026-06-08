-- Sistema config table (VAPID keys, no RLS - accessed via service role only)
CREATE TABLE IF NOT EXISTS sistema_config (
  chiave TEXT PRIMARY KEY,
  valore TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Web push subscriptions
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_select_push_sub" ON push_subscriptions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "auth_insert_push_sub" ON push_subscriptions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "auth_delete_push_sub" ON push_subscriptions FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Trigger: when a booking request is inserted, call the web-push edge function via pg_net
CREATE OR REPLACE FUNCTION notify_nuova_richiesta_prenotazione()
RETURNS TRIGGER AS $$
DECLARE
  edge_url TEXT;
  service_role_key TEXT;
BEGIN
  -- Get Supabase URL and service role key from config
  edge_url := current_setting('app.settings.supabase_url', true) || '/functions/v1/web-push/notify';
  service_role_key := current_setting('app.settings.service_role_key', true);

  -- Only notify for new in_attesa records
  IF NEW.stato = 'in_attesa' THEN
    PERFORM net.http_post(
      url := edge_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_role_key
      ),
      body := jsonb_build_object(
        'user_id', NEW.user_id,
        'nome', NEW.nome,
        'cognome', NEW.cognome,
        'servizio_id', NEW.servizio_id,
        'data_ora', NEW.data_ora
      )
    );
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block the insert if notification fails
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_notify_richiesta ON richieste_appuntamento;
CREATE TRIGGER trigger_notify_richiesta
  AFTER INSERT ON richieste_appuntamento
  FOR EACH ROW EXECUTE FUNCTION notify_nuova_richiesta_prenotazione();
