-- RPC accessibile ad anon per verificare se una cliente ha fiches convalidate.
-- Usata dal portale di prenotazione per determinare quali servizi mostrare.
CREATE OR REPLACE FUNCTION public.cliente_ha_fiches(p_user_id uuid, p_telefono text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tel_norm text;
  v_cliente_id uuid;
  v_ha_fiches boolean;
BEGIN
  -- Normalizza: solo cifre, ultimi 9 caratteri
  v_tel_norm := right(regexp_replace(p_telefono, '\D', '', 'g'), 9);

  -- Cerca la cliente per telefono normalizzato
  SELECT id INTO v_cliente_id
  FROM clienti
  WHERE user_id = p_user_id
    AND deleted_at IS NULL
    AND right(regexp_replace(coalesce(telefono, ''), '\D', '', 'g'), 9) = v_tel_norm
  LIMIT 1;

  IF v_cliente_id IS NULL THEN
    RETURN false;
  END IF;

  -- Controlla fiches convalidate collegate direttamente alla cliente
  SELECT EXISTS(
    SELECT 1 FROM fiches
    WHERE user_id = p_user_id
      AND cliente_id = v_cliente_id
      AND convalidata = true
      AND deleted_at IS NULL
  ) INTO v_ha_fiches;

  IF v_ha_fiches THEN
    RETURN true;
  END IF;

  -- Controlla fiches convalidate collegate tramite appuntamento della cliente
  SELECT EXISTS(
    SELECT 1 FROM fiches f
    JOIN appuntamenti a ON a.id = f.appuntamento_id
    WHERE f.user_id = p_user_id
      AND a.cliente_id = v_cliente_id
      AND f.convalidata = true
      AND f.deleted_at IS NULL
      AND a.deleted_at IS NULL
  ) INTO v_ha_fiches;

  RETURN v_ha_fiches;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cliente_ha_fiches(uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION public.cliente_ha_fiches(uuid, text) TO authenticated;
