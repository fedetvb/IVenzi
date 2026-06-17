/*
  # Fix keep-alive cron job with explicit URL

  Replaces the previous cron job with one that uses the hardcoded project URL,
  avoiding reliance on the app.supabase_url setting which may not be configured.
*/

-- Remove previous job
SELECT cron.unschedule('keep-alive-ping')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'keep-alive-ping'
);

-- Schedule with explicit URL every 6 days at 09:00 UTC
SELECT cron.schedule(
  'keep-alive-ping',
  '0 9 */6 * *',
  $$
    SELECT net.http_get(
      url := 'https://qfpeffzdszdanebmgafb.supabase.co/functions/v1/keep-alive'
    );
  $$
);
