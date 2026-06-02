/*
  # Aggiorna cron keep-alive a ogni 2 giorni

  Sostituisce il cron job precedente (ogni 6 giorni) con uno che
  gira ogni 2 giorni alle 09:00 UTC. Questo fornisce un margine
  molto più ampio rispetto alla soglia di inattività di 7 giorni.
*/

SELECT cron.unschedule('keep-alive-ping')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'keep-alive-ping'
);

SELECT cron.schedule(
  'keep-alive-ping',
  '0 9 */2 * *',
  $$
    SELECT net.http_get(
      url := 'https://cfsourwsjhhriytkdnuw.supabase.co/functions/v1/keep-alive'
    );
  $$
);
