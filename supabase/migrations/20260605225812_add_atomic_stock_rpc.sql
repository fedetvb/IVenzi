-- Funzione atomica per aggiornare lo stock del catalogo rivendita.
-- Usa aritmetica server-side: sicura anche con piu' dispositivi offline contemporanei.
-- p_stock_delta  < 0 = decremento (vendita),  > 0 = ripristino (annullamento)
-- p_venduta_delta > 0 = incremento (vendita), < 0 = ripristino
CREATE OR REPLACE FUNCTION aggiorna_stock_catalogo(
  p_id            uuid,
  p_stock_delta   integer,
  p_venduta_delta integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE prodotti_rivendita_catalogo
  SET
    quantita_stock  = GREATEST(0, quantita_stock  + p_stock_delta),
    quantita_venduta = GREATEST(0, quantita_venduta + p_venduta_delta),
    updated_at      = now()
  WHERE id = p_id
    AND (user_id = auth.uid() OR auth.uid() IS NULL);
END;
$$;

GRANT EXECUTE ON FUNCTION aggiorna_stock_catalogo(uuid, integer, integer) TO authenticated, anon;
