/*
  # Abilita REPLICA IDENTITY FULL su schede_clienti_da_confermare

  ## Problema
  Supabase Realtime con `postgres_changes` valuta RLS row-per-row
  solo se la tabella ha REPLICA IDENTITY FULL. Senza di esso, i subscriber
  autenticati non ricevono eventi INSERT per righe con user_id = NULL,
  impedendo la visualizzazione del banner rosa nella app.

  ## Soluzione
  - Imposta REPLICA IDENTITY FULL sulla tabella
  - Questo permette a Realtime di valutare correttamente le policy RLS
    "(user_id = auth.uid()) OR (user_id IS NULL)" per ogni riga
*/

ALTER TABLE public.schede_clienti_da_confermare REPLICA IDENTITY FULL;
