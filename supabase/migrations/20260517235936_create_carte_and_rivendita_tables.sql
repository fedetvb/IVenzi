/*
  # Carte sconto, carte premium e rivendita prodotti

  ## Nuove tabelle

  ### 1. `carte_sconto`
  - Carte con codice univoco che applicano uno sconto percentuale o fisso sulle fiches
  - `codice`: codice univoco generato (es. SCONTO-XXXX)
  - `tipo_sconto`: 'percentuale' | 'fisso'
  - `valore_sconto`: percentuale (0-100) o importo fisso in €
  - `descrizione`: descrizione della carta
  - `attiva`: se la carta è ancora utilizzabile
  - `cliente_id`: assegnata a un cliente specifico (nullable = non assegnata)
  - `usa_e_getta`: se true, si disattiva dopo il primo uso

  ### 2. `utilizzi_carta_sconto`
  - Storico degli utilizzi di ogni carta sconto
  - Collega carta → fiche e registra lo sconto applicato

  ### 3. `carte_premium`
  - Carte nominative ricaricabili con credito prepagato
  - `cliente_id`: sempre nominativa
  - `saldo`: credito disponibile
  - `codice`: codice univoco della carta

  ### 4. `ricariche_carta_premium`
  - Storico ricariche per ogni carta premium

  ### 5. `utilizzi_carta_premium`
  - Storico utilizzi (detrazioni) per ogni carta premium, collegato alle fiches

  ### 6. `rivendita_prodotti`
  - Registro vendite prodotti per parrucchiere
  - `parrucchiere_id`: il parrucchiere che ha effettuato la vendita
  - `nome_prodotto`: nome del prodotto venduto
  - `quantita`: quantità venduta
  - `prezzo_unitario`: prezzo per unità
  - `totale`: totale ricavo (calcolato)
  - `data_vendita`: data della vendita

  ## Sicurezza
  - RLS abilitato su tutte le tabelle
  - Accesso anonimo permesso (coerente con il resto dell'app)
*/

-- ─── Carte Sconto ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS carte_sconto (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codice text UNIQUE NOT NULL,
  descrizione text NOT NULL DEFAULT '',
  tipo_sconto text NOT NULL DEFAULT 'percentuale' CHECK (tipo_sconto IN ('percentuale', 'fisso')),
  valore_sconto numeric(10,2) NOT NULL DEFAULT 0,
  attiva boolean NOT NULL DEFAULT true,
  usa_e_getta boolean NOT NULL DEFAULT false,
  cliente_id uuid REFERENCES clienti(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE carte_sconto ENABLE ROW LEVEL SECURITY;

CREATE POLICY "carte_sconto anon select"
  ON carte_sconto FOR SELECT TO anon USING (true);
CREATE POLICY "carte_sconto anon insert"
  ON carte_sconto FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "carte_sconto anon update"
  ON carte_sconto FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "carte_sconto anon delete"
  ON carte_sconto FOR DELETE TO anon USING (true);

-- ─── Utilizzi Carta Sconto ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS utilizzi_carta_sconto (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  carta_sconto_id uuid NOT NULL REFERENCES carte_sconto(id) ON DELETE CASCADE,
  fiche_id uuid REFERENCES fiches(id) ON DELETE SET NULL,
  importo_originale numeric(10,2) NOT NULL DEFAULT 0,
  sconto_applicato numeric(10,2) NOT NULL DEFAULT 0,
  importo_finale numeric(10,2) NOT NULL DEFAULT 0,
  cliente_id uuid REFERENCES clienti(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE utilizzi_carta_sconto ENABLE ROW LEVEL SECURITY;

CREATE POLICY "utilizzi_carta_sconto anon select"
  ON utilizzi_carta_sconto FOR SELECT TO anon USING (true);
CREATE POLICY "utilizzi_carta_sconto anon insert"
  ON utilizzi_carta_sconto FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "utilizzi_carta_sconto anon update"
  ON utilizzi_carta_sconto FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "utilizzi_carta_sconto anon delete"
  ON utilizzi_carta_sconto FOR DELETE TO anon USING (true);

-- ─── Carte Premium ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS carte_premium (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codice text UNIQUE NOT NULL,
  cliente_id uuid NOT NULL REFERENCES clienti(id) ON DELETE CASCADE,
  saldo numeric(10,2) NOT NULL DEFAULT 0,
  note text NOT NULL DEFAULT '',
  attiva boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE carte_premium ENABLE ROW LEVEL SECURITY;

CREATE POLICY "carte_premium anon select"
  ON carte_premium FOR SELECT TO anon USING (true);
CREATE POLICY "carte_premium anon insert"
  ON carte_premium FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "carte_premium anon update"
  ON carte_premium FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "carte_premium anon delete"
  ON carte_premium FOR DELETE TO anon USING (true);

-- ─── Ricariche Carta Premium ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ricariche_carta_premium (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  carta_premium_id uuid NOT NULL REFERENCES carte_premium(id) ON DELETE CASCADE,
  importo numeric(10,2) NOT NULL DEFAULT 0,
  note text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE ricariche_carta_premium ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ricariche_carta_premium anon select"
  ON ricariche_carta_premium FOR SELECT TO anon USING (true);
CREATE POLICY "ricariche_carta_premium anon insert"
  ON ricariche_carta_premium FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "ricariche_carta_premium anon update"
  ON ricariche_carta_premium FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "ricariche_carta_premium anon delete"
  ON ricariche_carta_premium FOR DELETE TO anon USING (true);

-- ─── Utilizzi Carta Premium ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS utilizzi_carta_premium (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  carta_premium_id uuid NOT NULL REFERENCES carte_premium(id) ON DELETE CASCADE,
  fiche_id uuid REFERENCES fiches(id) ON DELETE SET NULL,
  importo_detratto numeric(10,2) NOT NULL DEFAULT 0,
  note text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE utilizzi_carta_premium ENABLE ROW LEVEL SECURITY;

CREATE POLICY "utilizzi_carta_premium anon select"
  ON utilizzi_carta_premium FOR SELECT TO anon USING (true);
CREATE POLICY "utilizzi_carta_premium anon insert"
  ON utilizzi_carta_premium FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "utilizzi_carta_premium anon update"
  ON utilizzi_carta_premium FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "utilizzi_carta_premium anon delete"
  ON utilizzi_carta_premium FOR DELETE TO anon USING (true);

-- ─── Rivendita Prodotti ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS rivendita_prodotti (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parrucchiere_id uuid NOT NULL REFERENCES parrucchieri(id) ON DELETE CASCADE,
  nome_prodotto text NOT NULL DEFAULT '',
  quantita integer NOT NULL DEFAULT 1,
  prezzo_unitario numeric(10,2) NOT NULL DEFAULT 0,
  totale numeric(10,2) GENERATED ALWAYS AS (quantita * prezzo_unitario) STORED,
  data_vendita date NOT NULL DEFAULT CURRENT_DATE,
  note text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE rivendita_prodotti ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rivendita_prodotti anon select"
  ON rivendita_prodotti FOR SELECT TO anon USING (true);
CREATE POLICY "rivendita_prodotti anon insert"
  ON rivendita_prodotti FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "rivendita_prodotti anon update"
  ON rivendita_prodotti FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "rivendita_prodotti anon delete"
  ON rivendita_prodotti FOR DELETE TO anon USING (true);
