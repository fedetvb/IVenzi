import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const WEB_PUSH_URL = `${SUPABASE_URL}/functions/v1/web-push/notify`;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function uploadFoto(base64: string, mime: string, folder: string): Promise<string> {
  const mimeType = String(mime).startsWith("image/") ? String(mime) : "image/jpeg";
  const ext = mimeType.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";
  const filename = `${folder}/${crypto.randomUUID()}.${ext}`;

  const binaryStr = atob(String(base64));
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }

  const { error } = await admin.storage
    .from("foto-clienti")
    .upload(filename, bytes, { contentType: mimeType, upsert: false });

  if (error) throw new Error(`Upload foto fallito: ${error.message}`);

  const { data } = admin.storage.from("foto-clienti").getPublicUrl(filename);
  return data.publicUrl;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const {
      user_id,
      nome,
      cognome,
      telefono,
      testo,
      foto1_base64, foto1_mime,
      foto2_base64, foto2_mime,
      foto3_base64, foto3_mime,
    } = body;

    if (!user_id || !nome || !cognome || !telefono) {
      return new Response(JSON.stringify({ error: "Dati obbligatori mancanti" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cerca cliente per telefono normalizzato
    const telNorm = String(telefono).replace(/\s/g, "");
    const { data: clienteRows } = await admin
      .from("clienti")
      .select("id")
      .eq("user_id", user_id)
      .or(`telefono.eq.${telNorm},telefono.eq.${telefono}`)
      .limit(1);

    const cliente_id = clienteRows?.[0]?.id ?? null;

    // Crea scheda da confermare se la cliente non è già registrata
    if (!cliente_id) {
      const { data: esistente } = await admin
        .from("schede_clienti_da_confermare")
        .select("id")
        .eq("user_id", user_id)
        .eq("telefono", String(telefono).trim())
        .eq("stato", "in_attesa")
        .maybeSingle();

      if (!esistente) {
        await admin.from("schede_clienti_da_confermare").insert({
          user_id,
          nome: String(nome).trim(),
          cognome: String(cognome).trim(),
          telefono: String(telefono).trim(),
          stato: "in_attesa",
        });
      }
    }

    // Upload foto
    const folder = `messaggi/${user_id}`;
    let foto_url_1 = "";
    let foto_url_2 = "";
    let foto_url_3 = "";

    if (foto1_base64 && foto1_mime) {
      foto_url_1 = await uploadFoto(foto1_base64, foto1_mime, folder);
    }
    if (foto2_base64 && foto2_mime) {
      foto_url_2 = await uploadFoto(foto2_base64, foto2_mime, folder);
    }
    if (foto3_base64 && foto3_mime) {
      foto_url_3 = await uploadFoto(foto3_base64, foto3_mime, folder);
    }

    // Inserisce messaggio
    const { error: insertErr } = await admin
      .from("messaggi_clienti")
      .insert({
        user_id,
        cliente_id,
        nome: String(nome).trim(),
        cognome: String(cognome).trim(),
        telefono: String(telefono).trim(),
        testo: String(testo ?? "").trim(),
        foto_url_1,
        foto_url_2,
        foto_url_3,
        letto: false,
      });

    if (insertErr) throw new Error(insertErr.message);

    // Invia web push (fire-and-forget, non blocca la risposta)
    fetch(WEB_PUSH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        user_id,
        title: `Nuovo messaggio da ${nome} ${cognome}`,
        message: testo ? String(testo).slice(0, 100) : "Ha inviato foto e/o un messaggio dal portale.",
        data: { type: "messaggio", cliente_id },
      }),
    }).catch(() => {/* ignore push errors */});

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
});
