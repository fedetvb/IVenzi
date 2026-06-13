SELECT nome, categoria, best_seller, quiz_tags
FROM prodotti_rivendita_catalogo
WHERE user_id = '1c7bb67b-523f-4f7a-aab2-166022a91be2'
  AND attivo = true
ORDER BY categoria, nome;