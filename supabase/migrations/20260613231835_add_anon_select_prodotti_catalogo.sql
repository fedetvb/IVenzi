-- Permette al portale clienti (anon) di leggere i prodotti del catalogo
-- filtrati per user_id specifico passato nella query
CREATE POLICY "anon_select_prodotti_catalogo"
  ON prodotti_rivendita_catalogo
  FOR SELECT
  TO anon
  USING (true);
