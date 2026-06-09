import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function normTel(t: string): string {
  return t.replace(/\D/g, '').replace(/^0039/, '39').replace(/^00/, '');
}

function telMatch(a: string, b: string): boolean {
  const na = normTel(a), nb = normTel(b);
  // Match on last 9 digits
  return na.slice(-9) === nb.slice(-9);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const url = new URL(req.url);

  // GET: list messages for this phone
  if (req.method === "GET") {
    const user_id = url.searchParams.get("user_id");
    const telefono = url.searchParams.get("telefono");

    if (!user_id || !telefono) {
      return new Response(JSON.stringify({ error: "user_id e telefono obbligatori" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data, error } = await supabase
      .from("messaggi_clienti")
      .select("id, testo, foto_url_1, foto_url_2, foto_url_3, preferito, risposta_testo, risposta_at, risposta_foto_url_1, risposta_foto_url_2, risposta_foto_url_3, created_at, telefono")
      .eq("user_id", user_id)
      .order("created_at", { ascending: false });

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Filter by phone server-side (last 9 digits match)
    const filtered = (data ?? []).filter(m => telMatch(m.telefono ?? '', telefono));
    // Remove telefono from response
    const sanitized = filtered.map(({ telefono: _tel, ...rest }) => rest);

    return new Response(JSON.stringify({ messaggi: sanitized }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // POST: toggle preferito
  if (req.method === "POST") {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Body JSON non valido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { user_id, telefono, messaggio_id, preferito } = body as {
      user_id?: string; telefono?: string; messaggio_id?: string; preferito?: boolean;
    };

    if (!user_id || !telefono || !messaggio_id || preferito === undefined) {
      return new Response(JSON.stringify({ error: "Parametri mancanti" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify message belongs to this phone + user
    const { data: msg } = await supabase
      .from("messaggi_clienti")
      .select("id, telefono")
      .eq("id", messaggio_id)
      .eq("user_id", user_id)
      .maybeSingle();

    if (!msg || !telMatch(msg.telefono ?? '', telefono as string)) {
      return new Response(JSON.stringify({ error: "Non autorizzato" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error } = await supabase
      .from("messaggi_clienti")
      .update({ preferito })
      .eq("id", messaggio_id);

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
