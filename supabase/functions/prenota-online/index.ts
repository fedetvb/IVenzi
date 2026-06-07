import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const sb = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/prenota-online/, "");

  // GET /info?user_id=... — salon info, hairdressers, services for booking page
  if (req.method === "GET" && path === "/info") {
    const userId = url.searchParams.get("user_id");
    if (!userId) return json({ error: "user_id richiesto" }, 400);

    const [iRes, pRes, sRes] = await Promise.all([
      sb.from("impostazioni").select("chiave,valore").eq("user_id", userId),
      sb.from("parrucchieri").select("id,nome,colore").eq("user_id", userId).eq("attivo", true),
      sb.from("trattamenti_catalogo")
        .select("id,nome,durata_minuti,prezzo,colore,servizio_abbinato_online_id")
        .eq("user_id", userId)
        .eq("prenotazione_online_abilitata", true)
        .eq("attivo", true),
    ]);

    const impostazioni: Record<string, string> = {};
    for (const r of iRes.data ?? []) impostazioni[r.chiave] = r.valore;

    const prenotazioniAttive = impostazioni["prenotazioni_online_attive"] !== "false";

    return json({
      prenotazioniAttive,
      nomeSalone: impostazioni["nome_salone"] ?? "",
      logoUrl: impostazioni["logo_salone_url"] ?? null,
      parrucchieri: pRes.data ?? [],
      servizi: sRes.data ?? [],
    });
  }

  // GET /disponibilita?user_id=...&parrucchiere_id=...&data=YYYY-MM-DD&durata_minuti=...
  if (req.method === "GET" && path === "/disponibilita") {
    const userId = url.searchParams.get("user_id");
    const parrId = url.searchParams.get("parrucchiere_id");
    const data = url.searchParams.get("data");
    const durata = parseInt(url.searchParams.get("durata_minuti") ?? "30");

    if (!userId || !parrId || !data) return json({ error: "Parametri mancanti" }, 400);

    const dayStart = `${data}T00:00:00+00:00`;
    const dayEnd = `${data}T23:59:59+00:00`;

    const [appRes, assenzeRes, richiesteRes] = await Promise.all([
      sb.from("appuntamenti")
        .select("data_ora,durata_minuti")
        .eq("parrucchiere_id", parrId)
        .gte("data_ora", dayStart)
        .lte("data_ora", dayEnd)
        .neq("stato", "cancellato"),
      sb.from("assenze_parrucchieri")
        .select("ora_inizio,data_inizio,data_fine")
        .eq("parrucchiere_id", parrId)
        .lte("data_inizio", data)
        .gte("data_fine", data),
      sb.from("richieste_appuntamento")
        .select("data_ora,servizio_id,data_ora2,parrucchiere2_id")
        .eq("user_id", userId)
        .eq("stato", "in_attesa")
        .gte("data_ora", dayStart)
        .lte("data_ora", dayEnd),
    ]);

    // Collect busy intervals (in minutes from midnight)
    const busy: { start: number; end: number }[] = [];

    for (const a of appRes.data ?? []) {
      const t = new Date(a.data_ora);
      const startMin = t.getUTCHours() * 60 + t.getUTCMinutes();
      busy.push({ start: startMin, end: startMin + (a.durata_minuti ?? 30) });
    }

    // Pending booking requests for this hairdresser
    for (const r of richiesteRes.data ?? []) {
      // primary
      const t = new Date(r.data_ora);
      const startMin = t.getUTCHours() * 60 + t.getUTCMinutes();
      // We need service duration — but we only have service_id here, skip for simplicity
      // The slot overlap check below handles it
      busy.push({ start: startMin, end: startMin + 60 }); // conservative 60min block
    }

    // Also add slots for this hairdresser as parrucchiere2 in pending requests
    for (const r of richiesteRes.data ?? []) {
      if (r.parrucchiere2_id === parrId && r.data_ora2) {
        const t = new Date(r.data_ora2);
        const startMin = t.getUTCHours() * 60 + t.getUTCMinutes();
        busy.push({ start: startMin, end: startMin + 60 });
      }
    }

    // Full day absence?
    const fullDayAbsent = (assenzeRes.data ?? []).some((a) => !a.ora_inizio);
    if (fullDayAbsent) return json({ slot_disponibili: [] });

    // Build available 15-min slots 8:00–20:00
    const slots: string[] = [];
    for (let m = 8 * 60; m + durata <= 20 * 60; m += 15) {
      const overlaps = busy.some((b) => m < b.end && m + durata > b.start);
      if (!overlaps) {
        const hh = String(Math.floor(m / 60)).padStart(2, "0");
        const mm = String(m % 60).padStart(2, "0");
        slots.push(`${hh}:${mm}`);
      }
    }

    return json({ slot_disponibili: slots });
  }

  // GET /parrucchieri-liberi?user_id=...&data=YYYY-MM-DD&ora=HH:MM&durata_minuti=...&escludi_id=...
  // Returns hairdressers free at given time for given duration (for secondary service)
  if (req.method === "GET" && path === "/parrucchieri-liberi") {
    const userId = url.searchParams.get("user_id");
    const data = url.searchParams.get("data");
    const ora = url.searchParams.get("ora"); // HH:MM
    const durata = parseInt(url.searchParams.get("durata_minuti") ?? "30");
    const escludiId = url.searchParams.get("escludi_id");

    if (!userId || !data || !ora) return json({ error: "Parametri mancanti" }, 400);

    const [h, m2] = ora.split(":").map(Number);
    const startMin = h * 60 + m2;
    const endMin = startMin + durata;

    const dayStart = `${data}T00:00:00+00:00`;
    const dayEnd = `${data}T23:59:59+00:00`;

    const [parrRes, appRes, richiesteRes] = await Promise.all([
      sb.from("parrucchieri").select("id,nome,colore").eq("user_id", userId).eq("attivo", true),
      sb.from("appuntamenti")
        .select("parrucchiere_id,data_ora,durata_minuti")
        .eq("user_id", userId)
        .gte("data_ora", dayStart)
        .lte("data_ora", dayEnd)
        .neq("stato", "cancellato"),
      sb.from("richieste_appuntamento")
        .select("parrucchiere_id,data_ora,parrucchiere2_id,data_ora2")
        .eq("user_id", userId)
        .eq("stato", "in_attesa")
        .gte("data_ora", dayStart)
        .lte("data_ora", dayEnd),
    ]);

    const busyByParr: Record<string, { start: number; end: number }[]> = {};

    for (const a of appRes.data ?? []) {
      if (!a.parrucchiere_id) continue;
      const t = new Date(a.data_ora);
      const s = t.getUTCHours() * 60 + t.getUTCMinutes();
      if (!busyByParr[a.parrucchiere_id]) busyByParr[a.parrucchiere_id] = [];
      busyByParr[a.parrucchiere_id].push({ start: s, end: s + (a.durata_minuti ?? 30) });
    }

    for (const r of richiesteRes.data ?? []) {
      if (r.parrucchiere_id) {
        const t = new Date(r.data_ora);
        const s = t.getUTCHours() * 60 + t.getUTCMinutes();
        if (!busyByParr[r.parrucchiere_id]) busyByParr[r.parrucchiere_id] = [];
        busyByParr[r.parrucchiere_id].push({ start: s, end: s + 60 });
      }
      if (r.parrucchiere2_id && r.data_ora2) {
        const t = new Date(r.data_ora2);
        const s = t.getUTCHours() * 60 + t.getUTCMinutes();
        if (!busyByParr[r.parrucchiere2_id]) busyByParr[r.parrucchiere2_id] = [];
        busyByParr[r.parrucchiere2_id].push({ start: s, end: s + 60 });
      }
    }

    const liberi = (parrRes.data ?? []).filter((p) => {
      if (p.id === escludiId) return false;
      const busy = busyByParr[p.id] ?? [];
      return !busy.some((b) => startMin < b.end && endMin > b.start);
    });

    return json({ parrucchieri: liberi });
  }

  // POST /richiesta — submit booking request
  if (req.method === "POST" && path === "/richiesta") {
    const body = await req.json().catch(() => null);
    if (!body) return json({ error: "Body non valido" }, 400);

    const { user_id, nome, cognome, telefono, parrucchiere_id, servizio_id, data_ora, parrucchiere2_id, servizio2_id, data_ora2 } = body;
    if (!user_id || !nome || !cognome || !telefono || !parrucchiere_id || !servizio_id || !data_ora) {
      return json({ error: "Dati obbligatori mancanti" }, 400);
    }

    // Blacklist check
    const { data: cliente } = await sb
      .from("clienti")
      .select("id,in_blacklist")
      .eq("user_id", user_id)
      .ilike("telefono", telefono.replace(/\s/g, ""))
      .maybeSingle();

    if (cliente?.in_blacklist) {
      return json({ error: "Non siamo in grado di accettare la tua richiesta al momento." }, 403);
    }

    // Check prenotazioni online are active
    const { data: impostazione } = await sb
      .from("impostazioni")
      .select("valore")
      .eq("user_id", user_id)
      .eq("chiave", "prenotazioni_online_attive")
      .maybeSingle();

    if (impostazione?.valore === "false") {
      return json({ error: "Il servizio di prenotazione online è momentaneamente sospeso." }, 403);
    }

    const { error } = await sb.from("richieste_appuntamento").insert({
      user_id,
      nome: nome.trim(),
      cognome: cognome.trim(),
      telefono: telefono.trim(),
      cliente_id: cliente?.id ?? null,
      parrucchiere_id,
      servizio_id,
      data_ora,
      parrucchiere2_id: parrucchiere2_id ?? null,
      servizio2_id: servizio2_id ?? null,
      data_ora2: data_ora2 ?? null,
    });

    if (error) return json({ error: "Errore nel salvataggio della richiesta." }, 500);
    return json({ success: true });
  }

  return json({ error: "Not found" }, 404);
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
