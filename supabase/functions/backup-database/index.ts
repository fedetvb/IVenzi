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
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    if (req.method === "GET") {
      // EXPORT backup
      const backup: Record<string, unknown[]> = {};

      for (const table of TABLE_ORDER) {
        const { data, error } = await supabase.from(table).select("*");
        if (error) {
          console.error(`Error reading ${table}:`, error.message);
          backup[table] = [];
        } else {
          backup[table] = data ?? [];
        }
      }

      const exportData = {
        version: 1,
        created_at: new Date().toISOString(),
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

      const results: Record<string, { ok: boolean; count: number; error?: string }> = {};

      // Delete in reverse order to respect FK constraints
      const reversedTables = [...TABLE_ORDER].reverse();
      for (const table of reversedTables) {
        if (body.data[table] !== undefined) {
          await supabase.from(table).delete().neq("id", "00000000-0000-0000-0000-000000000000");
          // For impostazioni (PK is text 'chiave', not uuid)
          if (table === "impostazioni") {
            await supabase.from(table).delete().neq("chiave", "__never__");
          }
        }
      }

      // Insert in correct order
      for (const table of TABLE_ORDER) {
        const rows = body.data[table];
        if (!rows || rows.length === 0) {
          results[table] = { ok: true, count: 0 };
          continue;
        }

        // Remove generated columns
        const cleanRows = rows.map((row: Record<string, unknown>) => {
          const clean = { ...row };
          if (table === "rivendita_prodotti") delete clean.totale;
          return clean;
        });

        const { error } = await supabase.from(table).insert(cleanRows);
        if (error) {
          results[table] = { ok: false, count: 0, error: error.message };
        } else {
          results[table] = { ok: true, count: cleanRows.length };
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
