-- Aggiunge colonne per il cassetto carte regalate
ALTER TABLE carte_sconto
  ADD COLUMN IF NOT EXISTS regalata boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ex_proprietaria_nome text;

-- Aggiunge campo carta sconto opzionale nelle schede da confermare
ALTER TABLE schede_clienti_da_confermare
  ADD COLUMN IF NOT EXISTS codice_carta_sconto text;
