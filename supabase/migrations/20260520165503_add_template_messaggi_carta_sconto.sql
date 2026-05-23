/*
  # Template messaggi carta sconto usa e getta

  Aggiunge una tabella per i template dei messaggi WhatsApp inviati alla creazione
  di una carta sconto usa e getta.

  1. Nuova tabella `template_messaggi_carta_sconto`
     - `id` (uuid, pk)
     - `nome` (text) — etichetta visibile es. "Standard", "Natale", "Compleanno"
     - `testo` (text) — corpo del messaggio con variabili {nome}, {codice}, {sconto}
     - `is_default` (boolean) — indica il template selezionato di default
     - `ordine` (int) — per ordinare la lista
     - `created_at`

  Variabili disponibili nel template:
    {nome}   → nome di battesimo del cliente
    {codice} → codice della carta
    {sconto} → valore sconto es. "10%" oppure "€15"
    {da}     → nome del mittente regalo (usato nei template regalo)

  2. RLS abilitato — accesso solo a utenti autenticati e anonimi (stessa policy permissiva
     già usata in tutto il progetto per le impostazioni)

  3. Dati iniziali: 5 template predefiniti
*/

CREATE TABLE IF NOT EXISTS template_messaggi_carta_sconto (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL DEFAULT '',
  testo text NOT NULL DEFAULT '',
  is_default boolean NOT NULL DEFAULT false,
  ordine integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE template_messaggi_carta_sconto ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can select template_messaggi_carta_sconto"
  ON template_messaggi_carta_sconto FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anon can insert template_messaggi_carta_sconto"
  ON template_messaggi_carta_sconto FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anon can update template_messaggi_carta_sconto"
  ON template_messaggi_carta_sconto FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anon can delete template_messaggi_carta_sconto"
  ON template_messaggi_carta_sconto FOR DELETE
  TO anon
  USING (true);

-- Template predefiniti
INSERT INTO template_messaggi_carta_sconto (nome, testo, is_default, ordine) VALUES
(
  'Standard',
  'Ciao {nome}!
Abbiamo creato per te una carta sconto esclusiva presso il nostro salone.

Codice: {codice}
Sconto: {sconto}

Presentala alla tua prossima visita per ottenere il tuo sconto.
Ti aspettiamo!

I Venzi.',
  true,
  1
),
(
  'Natale',
  'Ciao {nome}!
In occasione delle Feste ti facciamo un regalo speciale:
una carta sconto tutta per te!

Codice: {codice}
Sconto: {sconto}

Buon Natale e Felice Anno Nuovo!
Ti aspettiamo in salone.

I Venzi.',
  false,
  2
),
(
  'Compleanno',
  'Ciao {nome}!
Tanti auguri di buon compleanno!
Per festeggiare insieme abbiamo creato per te una carta sconto speciale.

Codice: {codice}
Sconto: {sconto}

Vieni a trovarci e usala per coccolarti ancora di più!

I Venzi.',
  false,
  3
),
(
  'Regalo da parte di...',
  'Ciao {nome}!
{da} ti ha fatto un regalo: una carta sconto esclusiva presso il nostro salone!

Codice: {codice}
Sconto: {sconto}

Presentala alla tua prossima visita.
Ti aspettiamo!

I Venzi.',
  false,
  4
),
(
  'Benvenuto',
  'Ciao {nome}!
Benvenuta nel mondo I Venzi!
Per festeggiare il tuo primo appuntamento con noi, ecco una carta sconto riservata a te.

Codice: {codice}
Sconto: {sconto}

Ci vediamo presto!

I Venzi.',
  false,
  5
);
