/*
  # Create magazzino_schede_salvate table

  Stores snapshots of magazzino inventory exports so they can be browsed later.

  1. New Tables
    - `magazzino_schede_salvate`
      - `id` (uuid, primary key)
      - `nome` (text) — user-provided label, defaults to the date
      - `data_creazione` (timestamptz)
      - `filtro_categoria` (text, nullable) — category id or null for all
      - `solo_scarse` (boolean) — whether only low-stock items were included
      - `snapshot` (jsonb) — full array of prodotto rows at save time
      - `totale_valore` (numeric) — total inventory value at save time
      - `num_prodotti` (integer) — count of products in snapshot

  2. Security
    - RLS enabled; anon role can insert, select, delete (same policy as all other tables in this project)
*/

CREATE TABLE IF NOT EXISTS magazzino_schede_salvate (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome             text NOT NULL DEFAULT '',
  data_creazione   timestamptz NOT NULL DEFAULT now(),
  filtro_categoria text,
  solo_scarse      boolean NOT NULL DEFAULT false,
  snapshot         jsonb NOT NULL DEFAULT '[]',
  totale_valore    numeric(10,2) NOT NULL DEFAULT 0,
  num_prodotti     integer NOT NULL DEFAULT 0
);

ALTER TABLE magazzino_schede_salvate ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon can select magazzino_schede_salvate"
  ON magazzino_schede_salvate FOR SELECT TO anon USING (true);

CREATE POLICY "anon can insert magazzino_schede_salvate"
  ON magazzino_schede_salvate FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "anon can delete magazzino_schede_salvate"
  ON magazzino_schede_salvate FOR DELETE TO anon USING (true);
