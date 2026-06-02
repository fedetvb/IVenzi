/*
  # Aggiunge tipo ultimo ping keep-alive

  Aggiunge una riga in impostazioni per tracciare se l'ultimo ping
  è stato automatico (cron) o manuale (utente).
*/

INSERT INTO impostazioni (chiave, valore)
VALUES ('keep_alive_last_ping_tipo', 'manuale')
ON CONFLICT (chiave) DO NOTHING;
