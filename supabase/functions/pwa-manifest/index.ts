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
  let customIconUrl: string | null = null;

  if (userId) {
    const [nameRow, iconRow] = await Promise.all([
      sb.from("impostazioni").select("valore")
        .eq("chiave", "nome_pwa_prenotazione").eq("user_id", userId).maybeSingle(),
      sb.from("impostazioni").select("valore")
        .eq("chiave", "icona_pwa_url").eq("user_id", userId).maybeSingle(),
    ]);

    if (nameRow.data?.valore) {
      appName = nameRow.data.valore;
      shortName = appName.length > 12 ? appName.slice(0, 12) : appName;
    }
    if (iconRow.data?.valore) {
      customIconUrl = iconRow.data.valore;
    }
  }

  const defaultIcons = [
    { src: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
    { src: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
  ];

  const icons = customIconUrl
    ? [
        { src: customIconUrl, sizes: "512x512", type: "image/png", purpose: "any" },
        { src: customIconUrl, sizes: "192x192", type: "image/png", purpose: "maskable" },
      ]
    : defaultIcons;

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
    icons,
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
      "Cache-Control": "public, max-age=60",
    },
  });
});
