import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// Tables ordered respecting foreign key dependencies (parents before children)
const TABLE_ORDER = [
  "parrucchieri",
  "clienti",
  "trattamenti_catalogo",
  "voci_extra_catalogo",
  "impostazioni",
  "appuntamenti",
  "appuntamento_trattamenti",
  "schede_colore",
  "giorni_parrucchieri",
  "fiches",
  "fiche_voci",
  "incassi_giornalieri",
  "carte_sconto",
  "utilizzi_carta_sconto",
  "carte_premium",
  "ricariche_carta_premium",
  "utilizzi_carta_premium",
  "rivendita_prodotti",
  "template_messaggi_carta_sconto",
  "template_messaggi_comunicazioni",
  "schede_clienti_da_confermare",
  "magazzino_categorie",
  "magazzino_prodotti",
  "magazzino_schede_salvate",
  "assenze_parrucchieri",
];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // Extract and verify JWT — all operations are scoped to the authenticated user
    const authHeader = req.headers.get("Authorization");
    const jwt = authHeader?.replace("Bearer ", "").trim();
    if (!jwt) {
      return new Response(JSON.stringify({ error: "Non autenticato" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: { user }, error: authError } = await adminClient.auth.getUser(jwt);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Token non valido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = user.id;

    // User-scoped client: RLS applies automatically, reads/deletes only own data
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: `Bearer ${jwt}` } } }
    );

    if (req.method === "GET") {
      // EXPORT: user-scoped client ensures RLS filters to own data only
      const backup: Record<string, unknown[]> = {};

      for (const table of TABLE_ORDER) {
        const { data, error } = await userClient.from(table).select("*");
        if (error) {
          console.error(`Error reading ${table}:`, error.message);
          backup[table] = [];
        } else {
          backup[table] = data ?? [];
        }
      }

      const exportData = {
        version: 2,
        created_at: new Date().toISOString(),
        user_id: userId,
        tables: TABLE_ORDER,
        data: backup,
      };

      return new Response(JSON.stringify(exportData), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    }

    if (req.method === "POST") {
      // RESTORE backup
      const body = await req.json();

      if (!body?.data || !body?.tables) {
        return new Response(JSON.stringify({ error: "Formato backup non valido" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const results: Record<string, { ok: boolean; count: number; skipped?: number; error?: string }> = {};

      // Delete in reverse order using user-scoped client — RLS ensures only own rows are deleted
      const reversedTables = [...TABLE_ORDER].reverse();
      for (const table of reversedTables) {
        if (body.data[table] === undefined) continue;
        if (table === "impostazioni") {
          await userClient.from(table).delete().neq("chiave", "__never__");
        } else {
          await userClient.from(table).delete().neq("id", "00000000-0000-0000-0000-000000000000");
        }
      }

      // Insert in correct order — rows belonging to other users are discarded
      for (const table of TABLE_ORDER) {
        const rows: Record<string, unknown>[] = body.data[table];
        if (!rows || rows.length === 0) {
          results[table] = { ok: true, count: 0, skipped: 0 };
          continue;
        }

        // If a row has user_id and it doesn't match the authenticated user → discard it
        const ownRows: Record<string, unknown>[] = [];
        let skipped = 0;
        for (const row of rows) {
          if ("user_id" in row && row.user_id !== userId) {
            skipped++;
            continue;
          }
          ownRows.push(row);
        }

        if (ownRows.length === 0) {
          results[table] = { ok: true, count: 0, skipped };
          continue;
        }

        // Remove generated columns before insert
        const cleanRows = ownRows.map((row) => {
          const clean = { ...row };
          if (table === "rivendita_prodotti") delete clean.totale;
          return clean;
        });

        // Use admin client for insert (rows already verified as own)
        const { error } = await adminClient.from(table).insert(cleanRows);
        if (error) {
          results[table] = { ok: false, count: 0, skipped, error: error.message };
        } else {
          results[table] = { ok: true, count: cleanRows.length, skipped };
        }
      }

      const hasErrors = Object.values(results).some((r) => !r.ok);
      return new Response(JSON.stringify({ success: !hasErrors, results }), {
        status: hasErrors ? 207 : 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Metodo non supportato" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
