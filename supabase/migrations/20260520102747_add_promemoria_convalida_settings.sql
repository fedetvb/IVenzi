/*
  # Add promemoria convalida settings

  Stores the reminder configuration for fiche validation reminders.

  ## New rows in impostazioni table
  - `promemoria_convalida_giorni`: JSON array of weekday numbers (0=Sun..6=Sat)
  - `promemoria_convalida_orario`: time string HH:MM

  No new tables needed — reuses the existing `impostazioni` key/value table.
*/

INSERT INTO impostazioni (chiave, valore)
VALUES
  ('promemoria_convalida_giorni', '[1,2,3,4,5,6]'),
  ('promemoria_convalida_orario', '20:00')
ON CONFLICT (chiave) DO NOTHING;
