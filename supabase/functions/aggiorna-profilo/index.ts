import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const su = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  // GET: fetch dati cliente by telefono + user_id
  if (req.method === "GET") {
    const url = new URL(req.url);
    const userId = url.searchParams.get("user_id");
    const telefono = url.searchParams.get("telefono");

    if (!userId || !telefono) {
      return new Response(JSON.stringify({ error: "Parametri mancanti" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    try {
      const admin = createClient(su, serviceKey);
      const { data, error } = await admin
        .from("clienti")
        .select("id, nome, cognome, telefono, email, data_nascita, note, foto_url")
        .eq("user_id", userId)
        .eq("telefono", telefono)
        .is("deleted_at", null)
        .maybeSingle();

      if (error) throw error;

      return new Response(JSON.stringify({ cliente: data ?? null }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return new Response(JSON.stringify({ error: msg }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  // POST: aggiorna dati cliente
  if (req.method === "POST") {
    try {
      const body = await req.json();
      const { user_id, telefono, nome, cognome, email, data_nascita, note, foto_base64, foto_mime } = body;

      if (!user_id || !telefono) {
        return new Response(JSON.stringify({ error: "Parametri mancanti" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const admin = createClient(su, serviceKey);

      // Trova il cliente
      const { data: cliente, error: findErr } = await admin
        .from("clienti")
        .select("id, foto_url")
        .eq("user_id", user_id)
        .eq("telefono", telefono)
        .is("deleted_at", null)
        .maybeSingle();

      if (findErr) throw findErr;
      if (!cliente) {
        return new Response(JSON.stringify({ error: "Cliente non trovato" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const capitalize = (s: string) => {
        const t = String(s ?? "").trim();
        return t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
      };

      const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      if (nome !== undefined) updateData.nome = capitalize(nome);
      if (cognome !== undefined) updateData.cognome = capitalize(cognome);
      if (email !== undefined) updateData.email = String(email ?? "").trim() || null;
      if (data_nascita !== undefined) updateData.data_nascita = data_nascita || null;
      if (note !== undefined) updateData.note = String(note ?? "").trim() || null;

      // Gestione foto
      if (foto_base64 && foto_mime) {
        const mimeType = String(foto_mime).startsWith("image/") ? String(foto_mime) : "image/jpeg";
        const ext = mimeType.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";
        const filename = `clienti/${cliente.id}_${Date.now()}.${ext}`;

        const binaryStr = atob(String(foto_base64));
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }

        const { error: uploadErr } = await admin.storage
          .from("foto-clienti")
          .upload(filename, bytes, { contentType: mimeType, upsert: true });

        if (!uploadErr) {
          const { data: urlData } = admin.storage.from("foto-clienti").getPublicUrl(filename);
          updateData.foto_url = urlData.publicUrl;
        }
      }

      const { error: updateErr } = await admin
        .from("clienti")
        .update(updateData)
        .eq("id", cliente.id);

      if (updateErr) throw updateErr;

      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return new Response(JSON.stringify({ error: msg }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  return new Response("Method not allowed", { status: 405, headers: corsHeaders });
});
