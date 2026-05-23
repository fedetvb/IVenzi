/*
  # Crea tabella template_messaggi_comunicazioni

  1. Nuove tabelle
    - `template_messaggi_comunicazioni`
      - `id` (uuid, primary key)
      - `nome` (text) — nome visualizzato dell'occasione
      - `testo` (text) — corpo del messaggio
      - `is_default` (boolean) — template selezionato di default
      - `ordine` (integer) — ordine di visualizzazione
      - `created_at` (timestamp)

  2. Dati iniziali
    - Compleanno
    - Buone Feste / Natale
    - Buona Pasqua
    - Promo Stagionale
    - Auguri Generici

  3. Sicurezza
    - RLS abilitato
    - Policy accesso anonimo (coerente con il pattern del progetto)
*/

CREATE TABLE IF NOT EXISTS template_messaggi_comunicazioni (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  testo text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  ordine integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE template_messaggi_comunicazioni ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon select template comunicazioni"
  ON template_messaggi_comunicazioni FOR SELECT
  TO anon USING (true);

CREATE POLICY "Anon insert template comunicazioni"
  ON template_messaggi_comunicazioni FOR INSERT
  TO anon WITH CHECK (true);

CREATE POLICY "Anon update template comunicazioni"
  ON template_messaggi_comunicazioni FOR UPDATE
  TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Anon delete template comunicazioni"
  ON template_messaggi_comunicazioni FOR DELETE
  TO anon USING (true);

INSERT INTO template_messaggi_comunicazioni (nome, testo, is_default, ordine) VALUES
(
  'Compleanno',
  E'Caro/a {nome},\ntanto affetto e tanti auguri di buon compleanno da tutto il team!\n\nCi vediamo presto in salone.\n\nI Venzi.',
  true,
  1
),
(
  'Buone Feste / Natale',
  E'Caro/a {nome},\nti auguriamo un sereno Natale e un meraviglioso Anno Nuovo!\n\nGrazie per la tua fiducia, ci vediamo nel 2025.\n\nI Venzi.',
  false,
  2
),
(
  'Buona Pasqua',
  E'Caro/a {nome},\ntanti auguri di Buona Pasqua da tutto il team!\n\nSiamo aperti e pronti ad accoglierti.\n\nI Venzi.',
  false,
  3
),
(
  'Promozione Stagionale',
  E'Caro/a {nome},\nabbiamo una novità per te! Questo mese trovi offerte speciali sui nostri servizi.\n\nChiamaci o passa in salone per scoprirle.\n\nI Venzi.',
  false,
  4
),
(
  'Auguri Generici',
  E'Caro/a {nome},\nvolevamo farti arrivare un pensiero speciale da parte di tutto il team.\n\nGrazie per essere sempre con noi!\n\nI Venzi.',
  false,
  5
);
