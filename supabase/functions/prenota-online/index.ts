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

// Convert a UTC Date to minutes-from-midnight in Italian (Europe/Rome) local time
function toItalianMinutes(date: Date): number {
  const parts = new Intl.DateTimeFormat("it-IT", {
    timeZone: "Europe/Rome",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const hh = parseInt(parts.find((p) => p.type === "hour")!.value);
  const mm = parseInt(parts.find((p) => p.type === "minute")!.value);
  return hh * 60 + mm;
}

// Return the Italian calendar date string (YYYY-MM-DD) for a UTC Date
function toItalianDateStr(date: Date): string {
  const parts = new Intl.DateTimeFormat("it-IT", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const y = parts.find((p) => p.type === "year")!.value;
  const mo = parts.find((p) => p.type === "month")!.value;
  const d = parts.find((p) => p.type === "day")!.value;
  return `${y}-${mo}-${d}`;
}

// Broad UTC query window for an Italian calendar day (covers UTC-12 to UTC+14, overkill but safe)
function italianDayUtcBounds(data: string): { dayStart: string; dayEnd: string } {
  return {
    dayStart: `${data}T00:00:00+02:00`, // Italian midnight (UTC+2 summer, slightly off in winter but safe with 3h buffer)
    dayEnd: `${data}T23:59:59+01:00`,   // Italian end of day (UTC+1 winter)
  };
}

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
      sb.from("parrucchieri").select("id,nome,colore").eq("user_id", userId).eq("attivo", true).order("nome"),
      sb.from("trattamenti_catalogo")
        .select("id,nome,durata_minuti,prezzo,colore,servizio_abbinato_online_id")
        .eq("user_id", userId)
        .eq("prenotazione_online_abilitata", true)
        .eq("attivo", true),
    ]);

    const impostazioni: Record<string, string> = {};
    for (const r of iRes.data ?? []) impostazioni[r.chiave] = r.valore;

    const prenotazioniAttive = impostazioni["prenotazioni_online_attive"] !== "false";
    const portaleNascosto = impostazioni["portale_nascosto"] === "true";

    // Also fetch abbinati services (may not have prenotazione_online_abilitata=true)
    const serviziAbilitati = sRes.data ?? [];
    const abbinatiIds = [...new Set(
      serviziAbilitati
        .filter((s: { servizio_abbinato_online_id: string | null }) => s.servizio_abbinato_online_id)
        .map((s: { servizio_abbinato_online_id: string }) => s.servizio_abbinato_online_id)
    )];
    let serviziAbbinati: { id: string; nome: string; durata_minuti: number; prezzo: number; colore: string }[] = [];
    if (abbinatiIds.length > 0) {
      const { data: abbRes } = await sb.from("trattamenti_catalogo")
        .select("id,nome,durata_minuti,prezzo,colore")
        .in("id", abbinatiIds);
      serviziAbbinati = abbRes ?? [];
    }

    // Merge abbinati into servizi so old clients can find them via servizi.find()
    // The frontend uses serviziAbbinati to filter them out of the selection UI
    const abbinatiNotAlreadyInServizi = serviziAbbinati.filter(
      (a) => !serviziAbilitati.some((s: { id: string }) => s.id === a.id)
    );
    const serviziConAbbinati = [
      ...serviziAbilitati,
      ...abbinatiNotAlreadyInServizi.map((a) => ({ ...a, servizio_abbinato_online_id: null })),
    ];

    const SOCIAL_KEYS = [
      "social_instagram", "social_facebook", "social_tiktok", "social_youtube",
      "social_whatsapp", "social_x", "social_threads", "social_google_business",
      "social_tripadvisor", "social_altro",
    ];
    const social: Record<string, string> = {};
    for (const k of SOCIAL_KEYS) {
      if (impostazioni[k]) social[k] = impostazioni[k];
    }

    const annuncio = {
      attivo: impostazioni["annuncio_attivo"] === "true",
      sfondo: impostazioni["annuncio_sfondo"] ?? "generico",
      testo: impostazioni["annuncio_testo"] ?? "",
      id: impostazioni["annuncio_id"] ?? "",
      compleannoTesto: impostazioni["annuncio_compleanno_testo"] ?? "",
    };

    return json({
      prenotazioniAttive,
      portaleNascosto,
      nomeSalone: impostazioni["nome_salone"] ?? "",
      logoUrl: impostazioni["logo_salone_url"] ?? null,
      parrucchieri: pRes.data ?? [],
      servizi: serviziConAbbinati,
      serviziAbbinati,
      social,
      annuncio,
    });
  }

  // GET /disponibilita?user_id=...&parrucchiere_id=...&data=YYYY-MM-DD&durata_minuti=...
  if (req.method === "GET" && path === "/disponibilita") {
    try {
    const userId = url.searchParams.get("user_id");
    const parrId = url.searchParams.get("parrucchiere_id");
    const data = url.searchParams.get("data");
    const durata = parseInt(url.searchParams.get("durata_minuti") ?? "30");

    if (!userId || !parrId || !data) return json({ error: "Parametri mancanti" }, 400);

    const { dayStart, dayEnd } = italianDayUtcBounds(data);

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

    // Collect busy intervals in Italian local minutes from midnight
    const busy: { start: number; end: number }[] = [];

    for (const a of appRes.data ?? []) {
      const t = new Date(a.data_ora);
      // Only count if it falls on this Italian calendar day
      if (toItalianDateStr(t) !== data) continue;
      const startMin = toItalianMinutes(t);
      busy.push({ start: startMin, end: startMin + (a.durata_minuti ?? 30) });
    }

    // Pending booking requests for this hairdresser
    for (const r of richiesteRes.data ?? []) {
      const t = new Date(r.data_ora);
      if (toItalianDateStr(t) !== data) continue;
      const startMin = toItalianMinutes(t);
      busy.push({ start: startMin, end: startMin + 90 }); // conservative block
    }

    // Also block slots where this hairdresser is parrucchiere2
    for (const r of richiesteRes.data ?? []) {
      if (r.parrucchiere2_id === parrId && r.data_ora2) {
        const t = new Date(r.data_ora2);
        if (toItalianDateStr(t) !== data) continue;
        const startMin = toItalianMinutes(t);
        busy.push({ start: startMin, end: startMin + 90 });
      }
    }

    // Full day absence?
    const fullDayAbsent = (assenzeRes.data ?? []).some((a) => !a.ora_inizio);
    if (fullDayAbsent) return json({ slot_disponibili: [] });

    // Build available 15-min slots 9:00–18:00 Italian local time
    const slots: string[] = [];
    for (let m = 9 * 60; m + durata <= 18 * 60; m += 15) {
      const overlaps = busy.some((b) => m < b.end && m + durata > b.start);
      if (!overlaps) {
        const hh = String(Math.floor(m / 60)).padStart(2, "0");
        const mm = String(m % 60).padStart(2, "0");
        slots.push(`${hh}:${mm}`);
      }
    }

    return json({ slot_disponibili: slots });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Errore interno";
      return json({ error: msg, slot_disponibili: [] }, 500);
    }
  }

  // GET /parrucchieri-liberi?user_id=...&data=YYYY-MM-DD&ora=HH:MM&durata_minuti=...&escludi_id=...
  if (req.method === "GET" && path === "/parrucchieri-liberi") {
    try {
    const userId = url.searchParams.get("user_id");
    const data = url.searchParams.get("data");
    const ora = url.searchParams.get("ora"); // HH:MM Italian local
    const durata = parseInt(url.searchParams.get("durata_minuti") ?? "30");
    const escludiId = url.searchParams.get("escludi_id");

    if (!userId || !data || !ora) return json({ error: "Parametri mancanti" }, 400);

    const [h, m2] = ora.split(":").map(Number);
    const startMin = h * 60 + m2;
    const endMin = startMin + durata;

    const { dayStart, dayEnd } = italianDayUtcBounds(data);

    const [parrRes, appRes, richiesteRes] = await Promise.all([
      sb.from("parrucchieri").select("id,nome,colore").eq("user_id", userId).eq("attivo", true).order("nome"),
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
      if (toItalianDateStr(t) !== data) continue;
      const s = toItalianMinutes(t);
      if (!busyByParr[a.parrucchiere_id]) busyByParr[a.parrucchiere_id] = [];
      busyByParr[a.parrucchiere_id].push({ start: s, end: s + (a.durata_minuti ?? 30) });
    }

    for (const r of richiesteRes.data ?? []) {
      if (r.parrucchiere_id) {
        const t = new Date(r.data_ora);
        if (toItalianDateStr(t) !== data) continue;
        const s = toItalianMinutes(t);
        if (!busyByParr[r.parrucchiere_id]) busyByParr[r.parrucchiere_id] = [];
        busyByParr[r.parrucchiere_id].push({ start: s, end: s + 90 });
      }
      if (r.parrucchiere2_id && r.data_ora2) {
        const t = new Date(r.data_ora2);
        if (toItalianDateStr(t) !== data) continue;
        const s = toItalianMinutes(t);
        if (!busyByParr[r.parrucchiere2_id]) busyByParr[r.parrucchiere2_id] = [];
        busyByParr[r.parrucchiere2_id].push({ start: s, end: s + 90 });
      }
    }

    const liberi = (parrRes.data ?? []).filter((p) => {
      if (p.id === escludiId) return false;
      const busy = busyByParr[p.id] ?? [];
      return !busy.some((b) => startMin < b.end && endMin > b.start);
    });

    return json({ parrucchieri: liberi });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Errore interno";
      return json({ error: msg, parrucchieri: [] }, 500);
    }
  }

  // GET /disponibilita-chiunque?user_id=...&data=YYYY-MM-DD&durata_minuti=...
  // Returns union of free slots across all active hairdressers + map of slot → free parrucchiere IDs
  if (req.method === "GET" && path === "/disponibilita-chiunque") {
    try {
      const userId = url.searchParams.get("user_id");
      const data = url.searchParams.get("data");
      const durata = parseInt(url.searchParams.get("durata_minuti") ?? "30");

      if (!userId || !data) return json({ error: "Parametri mancanti" }, 400);

      const { dayStart, dayEnd } = italianDayUtcBounds(data);

      const [parrRes, appRes, assenzeRes, richiesteRes] = await Promise.all([
        sb.from("parrucchieri").select("id,nome,colore").eq("user_id", userId).eq("attivo", true).order("nome"),
        sb.from("appuntamenti")
          .select("parrucchiere_id,data_ora,durata_minuti")
          .eq("user_id", userId)
          .gte("data_ora", dayStart)
          .lte("data_ora", dayEnd)
          .neq("stato", "cancellato"),
        sb.from("assenze_parrucchieri")
          .select("parrucchiere_id,ora_inizio,data_inizio,data_fine")
          .eq("user_id", userId)
          .lte("data_inizio", data)
          .gte("data_fine", data),
        sb.from("richieste_appuntamento")
          .select("parrucchiere_id,data_ora,parrucchiere2_id,data_ora2,chiunque,parrucchieri_candidati")
          .eq("user_id", userId)
          .eq("stato", "in_attesa")
          .gte("data_ora", dayStart)
          .lte("data_ora", dayEnd),
      ]);

      const allParr: { id: string; nome: string; colore: string }[] = parrRes.data ?? [];

      // Build busy intervals per parrucchiere
      const busyByParr: Record<string, { start: number; end: number }[]> = {};

      for (const a of appRes.data ?? []) {
        if (!a.parrucchiere_id) continue;
        const t = new Date(a.data_ora);
        if (toItalianDateStr(t) !== data) continue;
        const s = toItalianMinutes(t);
        if (!busyByParr[a.parrucchiere_id]) busyByParr[a.parrucchiere_id] = [];
        busyByParr[a.parrucchiere_id].push({ start: s, end: s + (a.durata_minuti ?? 30) });
      }

      for (const r of richiesteRes.data ?? []) {
        if (r.chiunque && Array.isArray(r.parrucchieri_candidati)) {
          // Block the slot for each candidate parrucchiere
          const t = new Date(r.data_ora);
          if (toItalianDateStr(t) === data) {
            const s = toItalianMinutes(t);
            for (const pid of r.parrucchieri_candidati as string[]) {
              if (!busyByParr[pid]) busyByParr[pid] = [];
              busyByParr[pid].push({ start: s, end: s + 90 });
            }
          }
        } else {
          if (r.parrucchiere_id) {
            const t = new Date(r.data_ora);
            if (toItalianDateStr(t) === data) {
              const s = toItalianMinutes(t);
              if (!busyByParr[r.parrucchiere_id]) busyByParr[r.parrucchiere_id] = [];
              busyByParr[r.parrucchiere_id].push({ start: s, end: s + 90 });
            }
          }
          if (r.parrucchiere2_id && r.data_ora2) {
            const t = new Date(r.data_ora2);
            if (toItalianDateStr(t) === data) {
              const s = toItalianMinutes(t);
              if (!busyByParr[r.parrucchiere2_id]) busyByParr[r.parrucchiere2_id] = [];
              busyByParr[r.parrucchiere2_id].push({ start: s, end: s + 90 });
            }
          }
        }
      }

      // Full-day absences: exclude parrucchieri completely absent
      const fullDayAbsent = new Set<string>();
      const partialAbsences: Record<string, number> = {}; // parrId → minutes from when they're absent
      for (const a of assenzeRes.data ?? []) {
        if (!a.ora_inizio) {
          fullDayAbsent.add(a.parrucchiere_id);
        } else {
          const [ah, am] = a.ora_inizio.substring(0, 5).split(":").map(Number);
          partialAbsences[a.parrucchiere_id] = ah * 60 + am;
        }
      }

      const availableParr = allParr.filter(p => !fullDayAbsent.has(p.id));

      // For each 15-min slot, find which parrucchieri are free
      const parrucchieriPerSlot: Record<string, string[]> = {};
      const slotDisponibili: string[] = [];

      for (let m = 9 * 60; m + durata <= 18 * 60; m += 15) {
        const freeParr = availableParr.filter(p => {
          // Check partial absence
          if (partialAbsences[p.id] !== undefined && m >= partialAbsences[p.id]) return false;
          const busy = busyByParr[p.id] ?? [];
          return !busy.some((b) => m < b.end && m + durata > b.start);
        });
        if (freeParr.length > 0) {
          const hh = String(Math.floor(m / 60)).padStart(2, "0");
          const mm2 = String(m % 60).padStart(2, "0");
          const slotKey = `${hh}:${mm2}`;
          slotDisponibili.push(slotKey);
          parrucchieriPerSlot[slotKey] = freeParr.map(p => p.id);
        }
      }

      return json({ slot_disponibili: slotDisponibili, parrucchieri_per_slot: parrucchieriPerSlot });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Errore interno";
      return json({ error: msg, slot_disponibili: [], parrucchieri_per_slot: {} }, 500);
    }
  }

  // POST /richiesta — submit booking request
  if (req.method === "POST" && path === "/richiesta") {
    try {
      const body = await req.json().catch(() => null);
      if (!body) return json({ error: "Body non valido" }, 400);

      const { user_id, nome, cognome, telefono, parrucchiere_id, servizio_id, data_ora, parrucchiere2_id, servizio2_id, data_ora2, chiunque, parrucchieri_candidati } = body;
      if (!user_id || !nome || !cognome || !telefono || !servizio_id || !data_ora) {
        return json({ error: "Dati obbligatori mancanti" }, 400);
      }
      if (!chiunque && !parrucchiere_id) {
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

      const { error: insertErr } = await sb.from("richieste_appuntamento").insert({
        user_id,
        nome: nome.trim(),
        cognome: cognome.trim(),
        telefono: telefono.trim(),
        cliente_id: cliente?.id ?? null,
        parrucchiere_id: parrucchiere_id ?? null,
        servizio_id,
        data_ora,
        parrucchiere2_id: parrucchiere2_id ?? null,
        servizio2_id: servizio2_id ?? null,
        data_ora2: data_ora2 ?? null,
        chiunque: chiunque ? true : false,
        parrucchieri_candidati: chiunque && Array.isArray(parrucchieri_candidati) ? parrucchieri_candidati : null,
      });

      if (insertErr) return json({ error: "Errore nel salvataggio della richiesta." }, 500);

      // Se la cliente non è in rubrica, crea scheda da confermare (fire-and-forget)
      if (!cliente) {
        (async () => {
          try {
            const telTrim = telefono.trim();
            const { data: existingScheda } = await sb
              .from("schede_clienti_da_confermare")
              .select("id")
              .eq("user_id", user_id)
              .eq("telefono", telTrim)
              .eq("stato", "in_attesa")
              .maybeSingle();

            if (!existingScheda) {
              await sb.from("schede_clienti_da_confermare").insert({
                user_id,
                nome: nome.trim(),
                cognome: cognome.trim(),
                telefono: telTrim,
                stato: "in_attesa",
              });
            }
          } catch { /* non bloccante */ }
        })();
      }

      // Send push notification — truly fire-and-forget, must not block the response
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      try {
        const dataOraFmt = new Date(data_ora).toLocaleDateString("it-IT", {
          timeZone: "Europe/Rome",
          weekday: "short", day: "numeric", month: "short",
        });
        const oraFmt = new Date(data_ora).toLocaleTimeString("it-IT", {
          timeZone: "Europe/Rome",
          hour: "2-digit", minute: "2-digit",
        });
        fetch(`${supabaseUrl}/functions/v1/web-push/notify`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceRoleKey}` },
          body: JSON.stringify({
            user_id,
            title: "Nuova prenotazione!",
            message: `${nome.trim()} ${cognome.trim()} – ${dataOraFmt} alle ${oraFmt}`,
            data: { type: "richiesta_prenotazione" },
          }),
        }).catch(() => {});
      } catch {
        // push errors must never block the booking confirmation
      }

      return json({ success: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Errore interno";
      return json({ error: msg }, 500);
    }
  }

  // GET /miei-appuntamenti?user_id=...&telefono=...
  if (req.method === "GET" && path === "/miei-appuntamenti") {
    try {
      const userId = url.searchParams.get("user_id");
      const telefono = url.searchParams.get("telefono");
      if (!userId || !telefono) return json({ error: "Parametri mancanti" }, 400);

      const telNorm = telefono.replace(/\s/g, "");

      // Find cliente by phone
      const { data: cliente } = await sb
        .from("clienti")
        .select("id")
        .eq("user_id", userId)
        .ilike("telefono", telNorm)
        .is("deleted_at", null)
        .maybeSingle();

      // Fetch appuntamenti by cliente_id (all, past + future)
      let appuntamentiRaw: { id: string; data_ora: string; stato: string; parrucchiere_id: string | null }[] = [];
      if (cliente?.id) {
        const { data } = await sb
          .from("appuntamenti")
          .select("id, data_ora, stato, parrucchiere_id")
          .eq("user_id", userId)
          .eq("cliente_id", cliente.id)
          .neq("stato", "cancellato")
          .is("deleted_at", null)
          .order("data_ora", { ascending: false });
        appuntamentiRaw = (data ?? []) as typeof appuntamentiRaw;
      }

      // Fetch trattamenti for all appuntamenti
      const appIds = appuntamentiRaw.map((a) => a.id);
      let trattamentiRaw: { appuntamento_id: string; nome_trattamento: string }[] = [];
      if (appIds.length > 0) {
        const { data } = await sb
          .from("appuntamento_trattamenti")
          .select("appuntamento_id, nome_trattamento")
          .in("appuntamento_id", appIds);
        trattamentiRaw = (data ?? []) as typeof trattamentiRaw;
      }

      // Fetch pending richieste_appuntamento (only future, only in_attesa)
      const { data: richiesteRaw } = await sb
        .from("richieste_appuntamento")
        .select("id, data_ora, parrucchiere_id, servizio_id, chiunque")
        .eq("user_id", userId)
        .ilike("telefono", telNorm)
        .eq("stato", "in_attesa")
        .gte("data_ora", new Date().toISOString())
        .order("data_ora", { ascending: true });

      // Collect all parrucchiere IDs
      const parrIds = [...new Set([
        ...appuntamentiRaw.map((a) => a.parrucchiere_id),
        ...((richiesteRaw ?? []) as { parrucchiere_id: string | null }[]).map((r) => r.parrucchiere_id),
      ].filter(Boolean) as string[])];

      let parrucchieriRaw: { id: string; nome: string; colore: string }[] = [];
      if (parrIds.length > 0) {
        const { data } = await sb.from("parrucchieri").select("id, nome, colore").in("id", parrIds);
        parrucchieriRaw = (data ?? []) as typeof parrucchieriRaw;
      }

      // Collect all servizio IDs from richieste
      const servizioIds = [...new Set(
        ((richiesteRaw ?? []) as { servizio_id: string }[]).map((r) => r.servizio_id).filter(Boolean)
      )];
      let serviziRaw: { id: string; nome: string }[] = [];
      if (servizioIds.length > 0) {
        const { data } = await sb.from("trattamenti_catalogo").select("id, nome").in("id", servizioIds);
        serviziRaw = (data ?? []) as typeof serviziRaw;
      }

      // Build lookup maps
      const parrMap = Object.fromEntries(parrucchieriRaw.map((p) => [p.id, p]));
      const servMap = Object.fromEntries(serviziRaw.map((s) => [s.id, s.nome]));
      const trattByApp: Record<string, string[]> = {};
      for (const t of trattamentiRaw) {
        if (!trattByApp[t.appuntamento_id]) trattByApp[t.appuntamento_id] = [];
        if (t.nome_trattamento) trattByApp[t.appuntamento_id].push(t.nome_trattamento);
      }

      const appuntamenti = appuntamentiRaw.map((a) => ({
        id: a.id,
        data_ora: a.data_ora,
        stato: a.stato,
        parrucchiere: a.parrucchiere_id ? (parrMap[a.parrucchiere_id] ?? null) : null,
        servizi: trattByApp[a.id] ?? [],
        tipo: "appuntamento" as const,
      }));

      const richieste = ((richiesteRaw ?? []) as { id: string; data_ora: string; parrucchiere_id: string | null; servizio_id: string; chiunque: boolean }[]).map((r) => ({
        id: r.id,
        data_ora: r.data_ora,
        stato: "in_attesa" as const,
        parrucchiere: (r.chiunque || !r.parrucchiere_id) ? null : (parrMap[r.parrucchiere_id] ?? null),
        servizi: r.servizio_id && servMap[r.servizio_id] ? [servMap[r.servizio_id]] : [],
        tipo: "richiesta" as const,
      }));

      return json({ appuntamenti, richieste });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Errore interno";
      return json({ error: msg }, 500);
    }
  }

  // GET /miei-servizi?user_id=...&telefono=...
  if (req.method === "GET" && path === "/miei-servizi") {
    try {
      const userId = url.searchParams.get("user_id");
      const telefono = url.searchParams.get("telefono");
      if (!userId || !telefono) return json({ error: "Parametri mancanti" }, 400);

      const telNorm = telefono.replace(/\s/g, "");

      // Trova la cliente per telefono (match parziale per gestire prefissi diversi)
      const { data: clientiAll } = await sb
        .from("clienti")
        .select("id, telefono")
        .eq("user_id", userId)
        .is("deleted_at", null);

      function normPhone(t: string): string {
        let s = (t ?? "").replace(/\D/g, "");
        if (s.startsWith("0039")) s = s.slice(4);
        else if (s.startsWith("39") && s.length > 10) s = s.slice(2);
        return s.slice(-9);
      }

      const targetNorm = normPhone(telNorm);
      const cliente = ((clientiAll ?? []) as { id: string; telefono: string }[])
        .find((c) => normPhone(c.telefono ?? "") === targetNorm);

      if (!cliente) return json({ sedute: [] });

      // Fiches convalidate via cliente_id diretto
      const { data: fichesDirectRaw } = await sb
        .from("fiches")
        .select("id, data_riferimento, appuntamento_id")
        .eq("user_id", userId)
        .eq("cliente_id", cliente.id)
        .eq("convalidata", true)
        .is("deleted_at", null);

      // Fiches convalidate via appuntamento del cliente
      const { data: appuntamentiRaw } = await sb
        .from("appuntamenti")
        .select("id, data_ora")
        .eq("user_id", userId)
        .eq("cliente_id", cliente.id)
        .is("deleted_at", null);

      const appIds = (appuntamentiRaw ?? []).map((a: { id: string }) => a.id);
      const appDataMap = new Map<string, string>(
        (appuntamentiRaw ?? []).map((a: { id: string; data_ora: string }) => [a.id, a.data_ora])
      );

      const { data: fichesViaAppRaw } = appIds.length > 0
        ? await sb
            .from("fiches")
            .select("id, data_riferimento, appuntamento_id")
            .eq("user_id", userId)
            .in("appuntamento_id", appIds)
            .eq("convalidata", true)
            .is("deleted_at", null)
        : { data: [] };

      // Deduplica e costruisce mappa fiche_id -> data
      type FicheRaw = { id: string; data_riferimento: string | null; appuntamento_id: string | null };
      const ficheMap = new Map<string, string>();
      for (const f of ([...(fichesDirectRaw ?? []), ...(fichesViaAppRaw ?? [])] as FicheRaw[])) {
        if (ficheMap.has(f.id)) continue;
        const data = f.data_riferimento ?? (f.appuntamento_id ? appDataMap.get(f.appuntamento_id) : undefined) ?? null;
        if (data) ficheMap.set(f.id, data);
      }

      if (ficheMap.size === 0) return json({ sedute: [] });

      const ficheIds = Array.from(ficheMap.keys());

      // Voci della fiche (tutti i servizi e le voci extra — fonte canonica dello storico)
      const { data: vociRaw } = await sb
        .from("fiche_voci")
        .select("fiche_id, tipo, nome_voce, parrucchiere_id, parrucchieri(nome)")
        .in("fiche_id", ficheIds);

      // Prodotti venduti collegati alla fiche
      const { data: prodottiRaw } = await sb
        .from("rivendita_prodotti")
        .select("fiche_id, nome_prodotto, quantita, parrucchiere_id, parrucchieri(nome)")
        .in("fiche_id", ficheIds);

      type Voce = { fiche_id: string; tipo: string; nome_voce: string; parrucchieri: { nome: string } | null };
      type Prod = { fiche_id: string; nome_prodotto: string; quantita: number; parrucchieri: { nome: string } | null };

      const vociByFiche = new Map<string, Voce[]>();
      for (const v of (vociRaw ?? []) as Voce[]) {
        if (!vociByFiche.has(v.fiche_id)) vociByFiche.set(v.fiche_id, []);
        vociByFiche.get(v.fiche_id)!.push(v);
      }

      const prodByFiche = new Map<string, Prod[]>();
      for (const p of (prodottiRaw ?? []) as Prod[]) {
        if (!p.fiche_id) continue;
        if (!prodByFiche.has(p.fiche_id)) prodByFiche.set(p.fiche_id, []);
        prodByFiche.get(p.fiche_id)!.push(p);
      }

      const sedute = Array.from(ficheMap.entries())
        .map(([ficheId, data]) => {
          const voci = (vociByFiche.get(ficheId) ?? []).map((v) => ({
            tipo: v.tipo,
            nome: v.nome_voce,
            parrucchiere: v.parrucchieri?.nome ?? null,
          }));
          const prodotti = (prodByFiche.get(ficheId) ?? []).map((p) => ({
            nome: p.nome_prodotto,
            quantita: p.quantita ?? 1,
            parrucchiere: p.parrucchieri?.nome ?? null,
          }));
          return { fiche_id: ficheId, data, voci, prodotti };
        })
        .filter((s) => s.voci.length > 0 || s.prodotti.length > 0)
        .sort((a, b) => b.data.localeCompare(a.data));

      return json({ sedute });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Errore interno";
      return json({ error: msg }, 500);
    }
  }

  return json({ error: "Not found" }, 404);
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
