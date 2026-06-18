-- RPC accessibile ad anon: restituisce true se la cliente esiste già nella tabella clienti.
-- Usata dal portale per bloccare la creazione di schede_da_confermare per clienti già confermati.
CREATE OR REPLACE FUNCTION public.cliente_esiste_in_rubrica(p_user_id uuid, p_telefono text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tel_norm text;
BEGIN
  v_tel_norm := right(regexp_replace(p_telefono, '\D', '', 'g'), 9);

  RETURN EXISTS (
    SELECT 1 FROM clienti
    WHERE user_id = p_user_id
      AND deleted_at IS NULL
      AND right(regexp_replace(coalesce(telefono, ''), '\D', '', 'g'), 9) = v_tel_norm
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.cliente_esiste_in_rubrica(uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION public.cliente_esiste_in_rubrica(uuid, text) TO authenticated;
