/*
  # Magazzino e Inventario

  ## Nuove tabelle

  ### `magazzino_categorie`
  Categorie di prodotti del magazzino (es. Shampoo lavaggio, Tubi colore, Flaconi ossigeno...)
  - `id` uuid PK
  - `nome` text - nome della categoria
  - `colore` text - colore identificativo per la UI
  - `ordine` int - ordine di visualizzazione
  - `created_at` timestamptz

  ### `magazzino_prodotti`
  Prodotti all'interno di una categoria
  - `id` uuid PK
  - `categoria_id` uuid FK -> magazzino_categorie
  - `nome` text - nome del prodotto
  - `marca` text - marca del prodotto (opzionale)
  - `unita` text - unità di misura (pz, lt, kg, ml, g...)
  - `quantita` numeric - quantità in magazzino
  - `quantita_minima` numeric - soglia minima per avviso scorte basse
  - `prezzo_acquisto` numeric - prezzo di acquisto (per commercialista)
  - `note` text
  - `ordine` int
  - `created_at` / `updated_at` timestamptz

  ## Sicurezza
  - RLS abilitato su entrambe le tabelle
  - Accesso anonimo consentito (come per le altre tabelle del progetto)
*/

CREATE TABLE IF NOT EXISTS magazzino_categorie (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL DEFAULT '',
  colore text NOT NULL DEFAULT '#F59E0B',
  ordine integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE magazzino_categorie ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon can select magazzino_categorie"
  ON magazzino_categorie FOR SELECT TO anon USING (true);

CREATE POLICY "anon can insert magazzino_categorie"
  ON magazzino_categorie FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "anon can update magazzino_categorie"
  ON magazzino_categorie FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "anon can delete magazzino_categorie"
  ON magazzino_categorie FOR DELETE TO anon USING (true);


CREATE TABLE IF NOT EXISTS magazzino_prodotti (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria_id uuid NOT NULL REFERENCES magazzino_categorie(id) ON DELETE CASCADE,
  nome text NOT NULL DEFAULT '',
  marca text NOT NULL DEFAULT '',
  unita text NOT NULL DEFAULT 'pz',
  quantita numeric NOT NULL DEFAULT 0,
  quantita_minima numeric NOT NULL DEFAULT 0,
  prezzo_acquisto numeric NOT NULL DEFAULT 0,
  note text NOT NULL DEFAULT '',
  ordine integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE magazzino_prodotti ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon can select magazzino_prodotti"
  ON magazzino_prodotti FOR SELECT TO anon USING (true);

CREATE POLICY "anon can insert magazzino_prodotti"
  ON magazzino_prodotti FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "anon can update magazzino_prodotti"
  ON magazzino_prodotti FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "anon can delete magazzino_prodotti"
  ON magazzino_prodotti FOR DELETE TO anon USING (true);
