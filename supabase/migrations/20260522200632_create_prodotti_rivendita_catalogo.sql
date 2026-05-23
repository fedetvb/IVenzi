/*
  # Crea tabella catalogo prodotti rivendita

  Questa tabella gestisce il catalogo dei prodotti che il salone acquista
  per rivenderli ai clienti (shampoo, lacca, spray, creme, maschere, ecc.).

  ## Nuove tabelle
  - `prodotti_rivendita_catalogo`
    - `id` (uuid, pk)
    - `categoria` (text) — es. Shampoo, Lacca, Spray, Crema, Maschera, Altro
    - `nome` (text) — nome del prodotto
    - `marca` (text) — marca
    - `prezzo_acquisto` (numeric) — prezzo pagato dal salone per ogni unità
    - `prezzo_vendita` (numeric) — prezzo di vendita al cliente
    - `quantita_stock` (integer) — pezzi disponibili in magazzino
    - `quantita_minima` (integer) — soglia scorta minima
    - `note` (text)
    - `attivo` (boolean) — se mostrare il prodotto
    - `ordine` (integer)
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)

  ## Sicurezza
  - RLS abilitato
  - Policy anon per le operazioni standard (in linea con le altre tabelle del progetto)
*/

CREATE TABLE IF NOT EXISTS prodotti_rivendita_catalogo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria text NOT NULL DEFAULT 'Altro',
  nome text NOT NULL DEFAULT '',
  marca text NOT NULL DEFAULT '',
  prezzo_acquisto numeric(10,2) NOT NULL DEFAULT 0,
  prezzo_vendita numeric(10,2) NOT NULL DEFAULT 0,
  quantita_stock integer NOT NULL DEFAULT 0,
  quantita_minima integer NOT NULL DEFAULT 0,
  note text NOT NULL DEFAULT '',
  attivo boolean NOT NULL DEFAULT true,
  ordine integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE prodotti_rivendita_catalogo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon can select prodotti_rivendita_catalogo"
  ON prodotti_rivendita_catalogo FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "anon can insert prodotti_rivendita_catalogo"
  ON prodotti_rivendita_catalogo FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "anon can update prodotti_rivendita_catalogo"
  ON prodotti_rivendita_catalogo FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "anon can delete prodotti_rivendita_catalogo"
  ON prodotti_rivendita_catalogo FOR DELETE
  TO anon
  USING (true);
