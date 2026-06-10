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

    return json({
      prenotazioniAttive,
      nomeSalone: impostazioni["nome_salone"] ?? "",
      logoUrl: impostazioni["logo_salone_url"] ?? null,
      parrucchieri: pRes.data ?? [],
      servizi: serviziConAbbinati,
      serviziAbbinati,
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

  return json({ error: "Not found" }, 404);
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
