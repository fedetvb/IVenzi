/*
  # Backfill costo_unitario in rivendita_prodotti dal catalogo

  Aggiorna il costo_unitario delle vendite esistenti usando il prezzo_acquisto
  del catalogo (prodotti_rivendita_catalogo), facendo match per nome prodotto.
  Solo le righe con costo_unitario = 0 vengono aggiornate.
*/

UPDATE rivendita_prodotti rp
SET costo_unitario = prc.prezzo_acquisto
FROM prodotti_rivendita_catalogo prc
WHERE lower(trim(rp.nome_prodotto)) = lower(trim(prc.nome))
  AND rp.costo_unitario = 0
  AND rp.deleted_at IS NULL;
