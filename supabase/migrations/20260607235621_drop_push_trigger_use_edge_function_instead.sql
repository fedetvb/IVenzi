-- Remove the trigger approach (edge function will call push directly)
DROP TRIGGER IF EXISTS trigger_notify_richiesta ON richieste_appuntamento;
DROP FUNCTION IF EXISTS notify_nuova_richiesta_prenotazione();
