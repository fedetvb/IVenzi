ALTER TABLE fiches ADD COLUMN IF NOT EXISTS tipo_pagamento TEXT CHECK (tipo_pagamento IN ('cc_bancomat', 'contanti_verde', 'contanti_nero')) DEFAULT NULL;
