-- Imposta nuova_cliente = true per tutti gli appuntamenti di clienti
-- che non hanno ancora nessuna fiche convalidata (clienti mai venuti prima)
UPDATE appuntamenti a
SET nuova_cliente = true
WHERE a.nuova_cliente = false
  AND a.deleted_at IS NULL
  AND a.cliente_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM fiches f
    JOIN appuntamenti a2 ON f.appuntamento_id = a2.id
    WHERE a2.cliente_id = a.cliente_id
      AND f.convalidata = true
  );
