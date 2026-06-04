import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const MIN_HOURS_BETWEEN_PINGS = 40;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const authHeader = req.headers.get("authorization") || "";
    const url = new URL(req.url);
    const force = url.searchParams.get("force") === "true";
    const isCron = !authHeader || authHeader.includes(serviceKey);
    const tipo = isCron ? "automatico" : "manuale";

    // Per chiamate automatiche del cron, controlla se il ping e' gia' stato fatto di recente
    // Il ping manuale (force=true) bypassa sempre questo controllo
    if (tipo === "automatico" && !force) {
      const { data: lastPingRow } = await supabase
        .from("impostazioni")
        .select("valore")
        .eq("chiave", "keep_alive_last_ping")
        .is("user_id", null)
        .maybeSingle();

      if (lastPingRow?.valore) {
        const lastPingTime = new Date(lastPingRow.valore).getTime();
        const hoursSince = (Date.now() - lastPingTime) / (1000 * 60 * 60);
        if (hoursSince < MIN_HOURS_BETWEEN_PINGS) {
          return new Response(
            JSON.stringify({ ok: true, skipped: true, reason: `last ping was ${hoursSince.toFixed(1)}h ago, minimum is ${MIN_HOURS_BETWEEN_PINGS}h` }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    const now = new Date().toISOString();

    const updates = [
      supabase.from("impostazioni").upsert(
        { chiave: "keep_alive_last_ping", valore: now, updated_at: now, user_id: null },
        { onConflict: "chiave,user_id" }
      ),
      supabase.from("impostazioni").upsert(
        { chiave: "keep_alive_last_ping_tipo", valore: tipo, updated_at: now, user_id: null },
        { onConflict: "chiave,user_id" }
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
