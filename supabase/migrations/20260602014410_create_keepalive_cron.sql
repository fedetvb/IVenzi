/*
  # Keep-alive cron job

  Enables pg_cron and pg_net extensions, then schedules a job that calls
  the keep-alive Edge Function every 6 days. This prevents the Supabase
  project from being paused due to inactivity (7-day inactivity threshold).

  - Installs: pg_cron, pg_net
  - Creates cron job: every 6 days at 09:00 UTC -> GET /functions/v1/keep-alive
*/

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove existing job if re-running migration
SELECT cron.unschedule('keep-alive-ping')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'keep-alive-ping'
);

-- Schedule keep-alive ping every 6 days at 09:00 UTC
SELECT cron.schedule(
  'keep-alive-ping',
  '0 9 */6 * *',
  $$
    SELECT net.http_get(
      url := current_setting('app.supabase_url', true) || '/functions/v1/keep-alive'
    );
  $$
);
