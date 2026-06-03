/*
  Fix cron keep-alive: singolo job alle 17:00 ora italiana.

  Rimozione di tutti i job esistenti (incluso vecchio jobid 3 mai rimosso)
  e creazione di un singolo job giornaliero alle 15:00 UTC = 17:00 CEST.
  La cadenza effettiva di 2 giorni viene gestita nella edge function.
*/

SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname LIKE 'keep-alive%' OR command LIKE '%keep-alive%';

SELECT cron.schedule(
  'keep-alive-ping',
  '0 15 * * *',
  $$
    SELECT net.http_get(
      url := 'https://cfsourwsjhhriytkdnuw.supabase.co/functions/v1/keep-alive'
    );
  $$
);
