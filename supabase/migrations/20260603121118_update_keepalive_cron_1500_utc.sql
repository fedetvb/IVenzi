/*
  # Aggiorna orario cron keep-alive alle 15:00 UTC (17:00 ora italiana)

  Sostituisce il cron job precedente (09:00 UTC) con uno che
  gira ogni 2 giorni alle 15:00 UTC = 17:00 ora italiana (UTC+2 ora legale).
*/

SELECT cron.unschedule('keep-alive-ping')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'keep-alive-ping'
);

SELECT cron.schedule(
  'keep-alive-ping',
  '0 15 */2 * *',
  $$
    SELECT net.http_get(
      url := 'https://cfsourwsjhhriytkdnuw.supabase.co/functions/v1/keep-alive'
    );
  $$
);
