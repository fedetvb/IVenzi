-- Gift pass nominativi: il compratore è anche la destinataria.
-- Backfill dei record esistenti dove destinataria_cliente_id è rimasto NULL
-- anche se il compratore (cliente_id) è noto.
UPDATE gift_pass
SET destinataria_cliente_id = cliente_id
WHERE nominativa = true
  AND destinataria_cliente_id IS NULL
  AND cliente_id IS NOT NULL;
