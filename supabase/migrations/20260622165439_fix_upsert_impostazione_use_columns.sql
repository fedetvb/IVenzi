DROP FUNCTION IF EXISTS upsert_impostazione(text, text, uuid);

CREATE OR REPLACE FUNCTION upsert_impostazione(
  p_chiave text,
  p_valore text,
  p_user_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO impostazioni (chiave, valore, user_id, updated_at)
  VALUES (p_chiave, p_valore, p_user_id, now())
  ON CONFLICT (chiave, user_id) DO UPDATE
    SET valore = EXCLUDED.valore,
        updated_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION upsert_impostazione(text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION upsert_impostazione(text, text, uuid) TO anon;