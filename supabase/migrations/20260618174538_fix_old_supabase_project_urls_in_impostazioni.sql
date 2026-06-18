-- Aggiorna tutte le URL impostazioni che puntano al vecchio progetto Supabase
UPDATE impostazioni
SET valore = replace(
  valore,
  'https://cfsourwsjhhriytkdnuw.supabase.co',
  'https://qfpeffzdszdanebmgafb.supabase.co'
)
WHERE valore LIKE 'https://cfsourwsjhhriytkdnuw.supabase.co%';
