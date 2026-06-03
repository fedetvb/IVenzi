import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const now = new Date().toISOString();

    const authHeader = req.headers.get("authorization") || "";
    const isCron = !authHeader || authHeader.includes(serviceKey);
    const tipo = isCron ? "automatico" : "manuale";

    const updates = [
      supabase.from("impostazioni").upsert(
        { chiave: "keep_alive_last_ping", valore: now, updated_at: now },
        { onConflict: "chiave" }
      ),
      supabase.from("impostazioni").upsert(
        { chiave: "keep_alive_last_ping_tipo", valore: tipo, updated_at: now },
        { onConflict: "chiave" }
      ),
    ];

    const results = await Promise.all(updates);
    const err = results.find(r => r.error)?.error;
    if (err) throw err;

    return new Response(
      JSON.stringify({ ok: true, ts: now, tipo }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
