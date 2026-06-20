-- Traccia la data di invio auguri di compleanno per sincronizzazione multi-dispositivo.
-- Se auguri_inviati_il = data odierna, il cliente viene escluso dal banner su tutti i dispositivi.
ALTER TABLE clienti
  ADD COLUMN IF NOT EXISTS auguri_inviati_il DATE;
