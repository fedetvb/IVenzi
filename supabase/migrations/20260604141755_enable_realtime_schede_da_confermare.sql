/*
  # Abilita Realtime sulla tabella schede_clienti_da_confermare

  Aggiunge la tabella alla publication di Supabase Realtime
  in modo che gli INSERT inviati dal form pubblico arrivino
  in tempo reale all'app (per mostrare il banner rosa).
*/

ALTER PUBLICATION supabase_realtime ADD TABLE public.schede_clienti_da_confermare;
