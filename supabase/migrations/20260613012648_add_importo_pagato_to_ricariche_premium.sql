ALTER TABLE ricariche_carta_premium
  ADD COLUMN IF NOT EXISTS importo_pagato numeric(10,2) NOT NULL DEFAULT 0;
