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

  // Priority 1: codice_cliente
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

  // Priority 3: nome + cognome fallback
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
  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  // ─── GET ───────────────────────────────────────────────────────────────────
  if (req.method === "GET") {
    const url = new URL(req.url);
    const userId = url.searchParams.get("user_id");
    const action = url.searchParams.get("action");
    const telefono = url.searchParams.get("telefono");
    const codiceCliente = url.searchParams.get("codice_cliente");
    const nome = url.searchParams.get("nome");
    const cognome = url.searchParams.get("cognome");

    if (!userId) return json({ error: "user_id mancante" }, 400);

    // ── action=check_conflict ──────────────────────────────────────────────
    // Returns { conflitto: boolean } — true if nome+cognome match a record
    // with a DIFFERENT telefono than the one provided.
    if (action === "check_conflict") {
      if (!telefono || !nome || !cognome) return json({ error: "telefono, nome e cognome richiesti" }, 400);
      try {
        const admin = createClient(su, serviceKey);
        const telNorm = normalizePhone(telefono);

        // Fetch all clients matching nome+cognome
        const { data: matches, error } = await admin
          .from("clienti")
          .select("telefono")
          .eq("user_id", userId)
          .ilike("nome", nome.trim())
          .ilike("cognome", cognome.trim())
          .is("deleted_at", null);

        if (error) throw error;

        if (!matches || matches.length === 0) {
          return json({ conflitto: false });
        }

        // Check if any of these have an EXACT phone match
        const exactMatch = (matches as { telefono: string }[]).some(
          (c) => normalizePhone(c.telefono ?? "") === telNorm,
        );

        // Conflict = nome+cognome found, but none match the provided phone
        return json({ conflitto: !exactMatch });
      } catch (err: unknown) {
        return json({ error: err instanceof Error ? err.message : String(err) }, 500);
      }
    }

    // ── default: fetch cliente data ────────────────────────────────────────
    if (!telefono && !codiceCliente && (!nome || !cognome)) {
      return json({ error: "Parametri mancanti" }, 400);
    }
    try {
      const admin = createClient(su, serviceKey);
      const cliente = await findCliente(admin, userId, { codiceCliente, telefono, nome, cognome });
      return json({ cliente: cliente ?? null });
    } catch (err: unknown) {
      return json({ error: err instanceof Error ? err.message : String(err) }, 500);
    }
  }

  // ─── POST ──────────────────────────────────────────────────────────────────
  if (req.method === "POST") {
    try {
      const body = await req.json();

      // ── action=cambia_numero ─────────────────────────────────────────────
      // Verifies (nome+cognome+vecchio_telefono) then updates telefono.
      if (body.action === "cambia_numero") {
        const { user_id, vecchio_telefono, nuovo_telefono, nome, cognome } = body;
        if (!user_id || !vecchio_telefono || !nuovo_telefono || !nome || !cognome) {
          return json({ error: "Parametri mancanti" }, 400);
        }

        const admin = createClient(su, serviceKey);
        const vecchioNorm = normalizePhone(vecchio_telefono);

        // Find all clients matching nome+cognome
        const { data: candidates, error: findErr } = await admin
          .from("clienti")
          .select("id, telefono")
          .eq("user_id", user_id)
          .ilike("nome", String(nome).trim())
          .ilike("cognome", String(cognome).trim())
          .is("deleted_at", null);

        if (findErr) throw findErr;

        const match = (candidates ?? []).find(
          (c: { telefono: string }) => normalizePhone(c.telefono ?? "") === vecchioNorm,
        );

        if (!match) {
          return json({ error: "Il vecchio numero non corrisponde ai dati presenti nel sistema." }, 404);
        }

        const { error: updateErr } = await admin
          .from("clienti")
          .update({ telefono: String(nuovo_telefono).trim(), updated_at: new Date().toISOString() })
          .eq("id", match.id);

        if (updateErr) throw updateErr;
        return json({ ok: true });
      }

      // ── default: aggiorna profilo ────────────────────────────────────────
      const { user_id, telefono, codice_cliente, nome, cognome, email, data_nascita, note, foto_base64, foto_mime } = body;

      if (!user_id || (!telefono && !codice_cliente && (!nome || !cognome))) {
        return json({ error: "Parametri mancanti" }, 400);
      }

      const admin = createClient(su, serviceKey);
      const cliente = await findCliente(admin, user_id, { codiceCliente: codice_cliente, telefono, nome, cognome }, "id, foto_url");

      if (!cliente) {
        return json({ error: "Cliente non trovata" }, 404);
      }

      const capitalize = (s: string) => {
        const t = String(s ?? "").trim();
        return t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
      };

      const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };

      if (nome !== undefined) updateData.nome = capitalize(nome);
      if (cognome !== undefined) updateData.cognome = capitalize(cognome);
      if (email !== undefined) updateData.email = String(email ?? "").trim() || null;
      if (data_nascita !== undefined) updateData.data_nascita = data_nascita || null;
      if (note !== undefined) updateData.note = String(note ?? "").trim() || null;
      if (codice_cliente && telefono !== undefined) updateData.telefono = String(telefono).trim();

      if (foto_base64 && foto_mime) {
        const mimeType = String(foto_mime).startsWith("image/") ? String(foto_mime) : "image/jpeg";
        const ext = mimeType.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";
        const filename = `clienti/${cliente.id}_${Date.now()}.${ext}`;

        const binaryStr = atob(String(foto_base64));
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);

        const { error: uploadErr } = await admin.storage
          .from("foto-clienti")
          .upload(filename, bytes, { contentType: mimeType, upsert: true });

        if (!uploadErr) {
          const { data: urlData } = admin.storage.from("foto-clienti").getPublicUrl(filename);
          updateData.foto_url = urlData.publicUrl;
        }
      }

      const { error: updateErr } = await admin.from("clienti").update(updateData).eq("id", cliente.id);
      if (updateErr) throw updateErr;

      return json({ ok: true });
    } catch (err: unknown) {
      return json({ error: err instanceof Error ? err.message : String(err) }, 500);
    }
  }

  return new Response("Method not allowed", { status: 405, headers: corsHeaders });
});
