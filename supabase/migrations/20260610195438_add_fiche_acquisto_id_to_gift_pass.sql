-- Collega il gift pass alla fiche di acquisto (buyer's purchase fiche)
-- Distinto da fiche_id che è la fiche di utilizzo (quando la destinataria usa il pass)
ALTER TABLE gift_pass
  ADD COLUMN IF NOT EXISTS fiche_acquisto_id UUID REFERENCES fiches(id) ON DELETE SET NULL;