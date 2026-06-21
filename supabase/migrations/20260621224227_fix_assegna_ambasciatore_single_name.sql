
CREATE OR REPLACE FUNCTION assegna_ambasciatore(
  p_user_id uuid,
  p_telefono text,
  p_presentata_da_nome text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cliente_id uuid;
  v_ambasciatore_id uuid;
  v_nome text;
  v_cognome text;
  v_tel_norm text;
  v_amb_count int;
BEGIN
  -- Normalize phone: keep last 9 digits
  v_tel_norm := RIGHT(REGEXP_REPLACE(p_telefono, '[^0-9]', '', 'g'), 9);
  IF length(v_tel_norm) < 7 THEN RETURN; END IF;

  -- Find target client by phone
  SELECT id INTO v_cliente_id
  FROM clienti
  WHERE user_id = p_user_id
    AND deleted_at IS NULL
    AND RIGHT(REGEXP_REPLACE(telefono, '[^0-9]', '', 'g'), 9) = v_tel_norm
  LIMIT 1;

  IF v_cliente_id IS NULL THEN RETURN; END IF;

  -- Abort if ambassador already assigned
  IF EXISTS (
    SELECT 1 FROM clienti
    WHERE id = v_cliente_id AND presentata_da_cliente_id IS NOT NULL
  ) THEN RETURN; END IF;

  -- Parse nome and cognome from input
  v_nome := split_part(trim(p_presentata_da_nome), ' ', 1);
  v_cognome := trim(substring(trim(p_presentata_da_nome) FROM length(v_nome) + 2));

  IF v_nome = '' THEN RETURN; END IF;

  IF v_cognome = '' THEN
    -- Single-word name: match by nome OR cognome (only if exactly one result)
    SELECT COUNT(*) INTO v_amb_count
    FROM clienti
    WHERE user_id = p_user_id
      AND deleted_at IS NULL
      AND id <> v_cliente_id
      AND (lower(nome) = lower(v_nome) OR lower(cognome) = lower(v_nome));

    IF v_amb_count <> 1 THEN RETURN; END IF;

    SELECT id INTO v_ambasciatore_id
    FROM clienti
    WHERE user_id = p_user_id
      AND deleted_at IS NULL
      AND id <> v_cliente_id
      AND (lower(nome) = lower(v_nome) OR lower(cognome) = lower(v_nome))
    LIMIT 1;
  ELSE
    -- Full name: match by nome + cognome
    SELECT COUNT(*) INTO v_amb_count
    FROM clienti
    WHERE user_id = p_user_id
      AND deleted_at IS NULL
      AND id <> v_cliente_id
      AND lower(nome) = lower(v_nome)
      AND lower(cognome) = lower(v_cognome);

    IF v_amb_count <> 1 THEN RETURN; END IF;

    SELECT id INTO v_ambasciatore_id
    FROM clienti
    WHERE user_id = p_user_id
      AND deleted_at IS NULL
      AND id <> v_cliente_id
      AND lower(nome) = lower(v_nome)
      AND lower(cognome) = lower(v_cognome)
    LIMIT 1;
  END IF;

  IF v_ambasciatore_id IS NULL THEN RETURN; END IF;

  UPDATE clienti
  SET presentata_da_cliente_id = v_ambasciatore_id,
      updated_at = now()
  WHERE id = v_cliente_id;
END;
$$;

GRANT EXECUTE ON FUNCTION assegna_ambasciatore(uuid, text, text) TO anon;
GRANT EXECUTE ON FUNCTION assegna_ambasciatore(uuid, text, text) TO authenticated;
