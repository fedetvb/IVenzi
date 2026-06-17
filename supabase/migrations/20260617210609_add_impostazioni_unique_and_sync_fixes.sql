
-- 1. Unique constraint su impostazioni(user_id, chiave) per prevenire duplicati multi-device
ALTER TABLE impostazioni
  ADD CONSTRAINT impostazioni_user_id_chiave_key UNIQUE (user_id, chiave);

-- 2. Deduplicazione preventiva (nel caso esistano duplicati prima del vincolo)
-- (se ci fossero duplicati, ALTER TABLE fallirebbe — il DB è attualmente vuoto quindi è sicuro)
