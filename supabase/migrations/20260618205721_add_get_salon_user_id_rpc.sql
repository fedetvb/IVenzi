
-- RPC accessibile ad anon per ottenere il user_id del titolare del salone
CREATE OR REPLACE FUNCTION get_salon_user_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT user_id FROM impostazioni 
  WHERE user_id IS NOT NULL 
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION get_salon_user_id() TO anon;
GRANT EXECUTE ON FUNCTION get_salon_user_id() TO authenticated;
