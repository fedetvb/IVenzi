
-- Adatta gift_pass allo schema completo necessario per il sistema Gift Pass

-- Aggiungi colonne mancanti
ALTER TABLE gift_pass
  ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'valore',
  ADD COLUMN IF NOT EXISTS valore_euro numeric(10,2),
  ADD COLUMN IF NOT EXISTS prodotto_id uuid REFERENCES prodotti_rivendita_catalogo(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS prodotto_nome text,
  ADD COLUMN IF NOT EXISTS occasione text NOT NULL DEFAULT 'invito',
  ADD COLUMN IF NOT EXISTS scadenza_ritiro_giorni integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS scadenza_uso_giorni integer NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS destinataria_nome text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS destinataria_telefono text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS fiche_id uuid REFERENCES fiches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Backfill da colonne vecchie dove esistono
UPDATE gift_pass SET
  tipo = COALESCE(tipo_regalo, 'valore'),
  valore_euro = valore,
  destinataria_nome = COALESCE(destinataria, ''),
  destinataria_telefono = COALESCE(telefono_destinataria, '');

-- Aggiungi colonna gift_pass_codice a richieste_appuntamento
ALTER TABLE richieste_appuntamento
  ADD COLUMN IF NOT EXISTS gift_pass_codice text;
