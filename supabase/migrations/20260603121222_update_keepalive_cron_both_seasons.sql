/*
  # Aggiorna cron keep-alive per funzionare sia in ora legale che solare

  Poiche' il cron di Postgres non supporta fusi orari dinamici,
  si creano due job: uno alle 15:00 UTC (= 17:00 ora legale)
  e uno alle 16:00 UTC (= 17:00 ora solare).
  In questo modo il ping arriva sempre alle 17:00 italiane in ogni stagione.
*/

SELECT cron.unschedule('keep-alive-ping');

SELECT cron.schedule(
  'keep-alive-ping-legale',
  '0 15 */2 * *',
  $$
    SELECT net.http_get(
      url := 'https://qfpeffzdszdanebmgafb.supabase.co/functions/v1/keep-alive'
    );
  $$
);

SELECT cron.schedule(
  'keep-alive-ping-solare',
  '0 16 */2 * *',
  $$
    SELECT net.http_get(
      url := 'https://qfpeffzdszdanebmgafb.supabase.co/functions/v1/keep-alive'
    );
  $$
);
