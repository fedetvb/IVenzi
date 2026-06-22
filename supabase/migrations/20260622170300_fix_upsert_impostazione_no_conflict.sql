CREATE OR REPLACE FUNCTION upsert_impostazione(
  p_chiave text,
  p_valore text,
  p_user_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM impostazioni WHERE chiave = p_chiave AND user_id = p_user_id) THEN
    UPDATE impostazioni
    SET valore = p_valore,
        updated_at = now()
    WHERE chiave = p_chiave AND user_id = p_user_id;
  ELSE
    INSERT INTO impostazioni (chiave, valore, user_id, updated_at)
    VALUES (p_chiave, p_valore, p_user_id, now());
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION upsert_impostazione(text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION upsert_impostazione(text, text, uuid) TO anon;