
/*
  # Attempt to relocate pg_net to extensions schema

  pg_net does not support ALTER EXTENSION SET SCHEMA directly.
  The only workaround is to drop and recreate it in the target schema.
  We drop it from public and recreate in extensions schema.
*/

DROP EXTENSION IF EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA extensions;
