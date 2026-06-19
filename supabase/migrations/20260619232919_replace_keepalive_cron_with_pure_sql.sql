-- Rimuovi tutti i vecchi cron che chiamavano l'edge function
SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname LIKE 'keep-alive%' OR command LIKE '%keep-alive%';

-- Funzione che legge l'intervallo configurato da impostazioni e fa il ping se necessario
CREATE OR REPLACE FUNCTION auto_keep_alive_ping()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_interval_days int;
  v_interval_text text;
  v_last_ping timestamptz;
BEGIN
  -- Legge l'intervallo configurato (default 2 giorni, max 6 per sicurezza)
  SELECT valore INTO v_interval_text
  FROM impostazioni
  WHERE chiave = 'keep_alive_interval_days'
  ORDER BY updated_at DESC NULLS LAST
  LIMIT 1;

  v_interval_days := COALESCE(v_interval_text::int, 2);
  IF v_interval_days < 1 THEN v_interval_days := 1; END IF;
  IF v_interval_days > 6 THEN v_interval_days := 6; END IF;

  -- Controlla l'ultimo ping automatico
  SELECT eseguito_at INTO v_last_ping
  FROM keep_alive_ping_log
  WHERE tipo = 'automatico'
  ORDER BY eseguito_at DESC
  LIMIT 1;

  -- Inserisce solo se l'intervallo è trascorso o non c'è mai stato un ping
  IF v_last_ping IS NULL OR v_last_ping < NOW() - (v_interval_days || ' days')::interval THEN
    INSERT INTO keep_alive_ping_log (eseguito_at, tipo) VALUES (NOW(), 'automatico');
  END IF;
END;
$$;

-- Cron giornaliero alle 15:00 UTC (17:00 ora italiana).
-- La funzione decide internamente se pingare in base all'intervallo configurato.
SELECT cron.schedule(
  'keep-alive-ping',
  '0 15 * * *',
  $$ SELECT auto_keep_alive_ping(); $$
);
