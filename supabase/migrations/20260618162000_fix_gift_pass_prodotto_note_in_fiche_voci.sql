-- Aggiorna le note delle fiche_voci che sono Gift Pass PRODOTTO
-- in modo che prezzoEffettivo() le riconosca e le mostri a €0
UPDATE fiche_voci fv
SET note = '__gift_prodotto__'
WHERE fv.nome_voce LIKE 'Gift Pass #%'
  AND fv.note = ''
  AND EXISTS (
    SELECT 1 FROM gift_pass gp
    WHERE gp.codice = substring(fv.nome_voce FROM 12)  -- rimuove 'Gift Pass #'
      AND gp.tipo = 'prodotto'
  );
