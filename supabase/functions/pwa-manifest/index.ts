import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const sb = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const userId = url.searchParams.get("uid");

  let appName = "Prenota Online";
  let shortName = "Prenota";

  if (userId) {
    const { data } = await sb
      .from("impostazioni")
      .select("valore")
      .eq("chiave", "nome_pwa_prenotazione")
      .eq("user_id", userId)
      .maybeSingle();

    if (data?.valore) {
      appName = data.valore;
      // short_name: tronca a 12 caratteri per leggibilita' sotto l'icona
      shortName = data.valore.length > 12 ? data.valore.slice(0, 12) : data.valore;
    }
  }

  const manifest = {
    name: appName,
    short_name: shortName,
    description: "Prenota il tuo appuntamento online",
    start_url: userId ? `/?prenota=1&uid=${userId}` : "/",
    scope: "/",
    display: "standalone",
    display_override: ["standalone"],
    background_color: "#ffffff",
    theme_color: "#0f172a",
    orientation: "any",
    icons: [
      { src: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
      { src: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
    ],
    categories: ["lifestyle", "health"],
    lang: "it",
    dir: "ltr",
    prefer_related_applications: false,
  };

  return new Response(JSON.stringify(manifest), {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/manifest+json",
      "Cache-Control": "public, max-age=300",
    },
  });
});
