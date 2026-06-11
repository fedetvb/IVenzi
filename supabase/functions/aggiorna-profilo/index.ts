import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function normalizePhone(tel: string): string {
  let t = String(tel ?? "").replace(/\D/g, "");
  if (t.startsWith("0039")) t = t.slice(4);
  else if (t.startsWith("39") && t.length > 10) t = t.slice(2);
  return t.slice(-9);
}

type ClienteRow = { id: string; nome: string; cognome: string; telefono: string; email: string | null; data_nascita: string | null; note: string | null; foto_url: string | null; codice_cliente: string | null };

async function findCliente(
  admin: ReturnType<typeof createClient>,
  userId: string,
  params: { codiceCliente?: string | null; telefono?: string | null; nome?: string | null; cognome?: string | null },
  selectFields = "id, nome, cognome, telefono, email, data_nascita, note, foto_url, codice_cliente",
): Promise<ClienteRow | null> {
  const baseQuery = () =>
    admin.from("clienti").select(selectFields).eq("user_id", userId).is("deleted_at", null);

  // Priority 1: codice_cliente (esatto, univoco per salone)
  if (params.codiceCliente) {
    const { data } = await baseQuery().eq("codice_cliente", params.codiceCliente.toUpperCase()).maybeSingle();
    if (data) return data as ClienteRow;
  }

  // Priority 2: telefono normalizzato
  if (params.telefono) {
    const telNorm = normalizePhone(params.telefono);
    const { data: all } = await baseQuery();
    const found = (all ?? []).find((c: { telefono: string }) => normalizePhone(c.telefono ?? "") === telNorm);
    if (found) return found as ClienteRow;
  }

  // Priority 3: nome + cognome (case-insensitive, fallback)
  if (params.nome && params.cognome) {
    const { data } = await baseQuery()
      .ilike("nome", params.nome.trim())
      .ilike("cognome", params.cognome.trim())
      .maybeSingle();
    if (data) return data as ClienteRow;
  }

  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const su = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  // GET: fetch dati cliente
  if (req.method === "GET") {
    const url = new URL(req.url);
    const userId = url.searchParams.get("user_id");
    const telefono = url.searchParams.get("telefono");
    const codiceCliente = url.searchParams.get("codice_cliente");
    const nome = url.searchParams.get("nome");
    const cognome = url.searchParams.get("cognome");

    if (!userId || (!telefono && !codiceCliente && (!nome || !cognome))) {
      return new Response(JSON.stringify({ error: "Parametri mancanti" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    try {
      const admin = createClient(su, serviceKey);
      const cliente = await findCliente(admin, userId, { codiceCliente, telefono, nome, cognome });

      return new Response(JSON.stringify({ cliente: cliente ?? null }), {
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
      const { user_id, telefono, codice_cliente, nome, cognome, email, data_nascita, note, foto_base64, foto_mime } = body;

      if (!user_id || (!telefono && !codice_cliente && (!nome || !cognome))) {
        return new Response(JSON.stringify({ error: "Parametri mancanti" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const admin = createClient(su, serviceKey);

      const cliente = await findCliente(admin, user_id, { codiceCliente: codice_cliente, telefono, nome, cognome }, "id, foto_url");

      if (!cliente) {
        return new Response(JSON.stringify({ error: "Cliente non trovata" }), {
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
      // When lookup was by codice, allow updating telefono
      if (codice_cliente && telefono !== undefined) {
        updateData.telefono = String(telefono).trim();
      }

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
