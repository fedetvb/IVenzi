
-- Rimuove il vincolo UNIQUE duplicato che causa 409 sugli upsert di impostazioni.
-- Il vincolo (user_id, chiave) e' equivalente a (chiave, user_id) ma ha ordine colonne diverso,
-- quindi PostgREST sceglie l'uno o l'altro a seconda della query, causando conflitti inattesi.
-- Manteniamo solo impostazioni_chiave_user_unique (chiave, user_id) che coincide con onConflict usato nel codice.

ALTER TABLE impostazioni
  DROP CONSTRAINT IF EXISTS impostazioni_user_id_chiave_key;
