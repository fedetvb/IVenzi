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

function normalizePhone(tel: string): string {
  let t = tel.replace(/\D/g, "");
  if (t.startsWith("0039")) t = t.slice(4);
  else if (t.startsWith("39") && t.length > 10) t = t.slice(2);
  return t.slice(-9);
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/mie-carte/, "");

  // GET /info?user_id=...&telefono=...
  // Restituisce tutte le carte associate alla cliente + dati salone
  if (req.method === "GET" && (path === "/info" || path === "")) {
    const userId = url.searchParams.get("user_id");
    const telefono = url.searchParams.get("telefono");
    if (!userId || !telefono) return json({ error: "user_id e telefono richiesti" }, 400);

    const telNorm = normalizePhone(telefono);

    // Trova cliente per numero di telefono
    const { data: clienti } = await sb
      .from("clienti")
      .select("id, nome, cognome, telefono")
      .eq("user_id", userId)
      .is("deleted_at", null);

    const cliente = (clienti ?? []).find((c: { telefono: string }) =>
      normalizePhone(c.telefono ?? "") === telNorm
    );

    // Dati salone dalle impostazioni
    const { data: impostazioni } = await sb
      .from("impostazioni")
      .select("chiave, valore")
      .eq("user_id", userId)
      .in("chiave", [
        "azienda_telefono",
        "azienda_google_maps",
        "azienda_sito_prenotazioni",
        "nome_salone",
      ]);

    const imp: Record<string, string> = {};
    for (const r of impostazioni ?? []) imp[r.chiave] = r.valore;

    if (!cliente) {
      return json({
        cliente: null,
        cartePremium: [],
        carteInfinity: [],
        carteUsaEGetta: [],
        salone: imp,
      });
    }

    // Carte Premium
    const { data: cartePremiumRaw } = await sb
      .from("carte_premium")
      .select("id, codice, saldo, attiva, created_at")
      .eq("cliente_id", cliente.id)
      .eq("user_id", userId)
      .eq("attiva", true);

    // Ricariche e utilizzi per ogni carta premium
    const cartePremium = await Promise.all(
      (cartePremiumRaw ?? []).map(async (cp: { id: string; codice: string; saldo: number; attiva: boolean; created_at: string }) => {
        const [ricaricheRes, utilizziRes, risparmioRes] = await Promise.all([
          sb.from("ricariche_carta_premium")
            .select("id, importo, note, created_at")
            .eq("carta_premium_id", cp.id)
            .order("created_at", { ascending: true }),
          sb.from("utilizzi_carta_premium")
            .select("id, importo_detratto, note, created_at")
            .eq("carta_premium_id", cp.id)
            .order("created_at", { ascending: true }),
          // Risparmio: somma (totale_listino - importo_convalidato) dalle fiches convalidate del cliente
          sb.from("fiches")
            .select("totale_listino, importo_convalidato")
            .eq("cliente_id", cliente.id)
            .eq("user_id", userId)
            .eq("convalidata", true)
            .is("deleted_at", null),
        ]);

        const risparmioTotale = (risparmioRes.data ?? []).reduce(
          (acc: number, f: { totale_listino: number | null; importo_convalidato: number | null }) => {
            const listino = f.totale_listino ?? 0;
            const pagato = f.importo_convalidato ?? 0;
            const delta = listino - pagato;
            return acc + (delta > 0 ? delta : 0);
          },
          0
        );

        return {
          ...cp,
          tipo: "premium" as const,
          ricariche: ricaricheRes.data ?? [],
          utilizzi: utilizziRes.data ?? [],
          risparmioTotale: Math.round(risparmioTotale * 100) / 100,
        };
      })
    );

    // Carte Sconto Infinity (usa_e_getta=false)
    const { data: carteInfinityRaw } = await sb
      .from("carte_sconto")
      .select("id, codice, descrizione, tipo_sconto, valore_sconto, attiva, created_at")
      .eq("cliente_id", cliente.id)
      .eq("user_id", userId)
      .eq("usa_e_getta", false)
      .eq("attiva", true);

    const carteInfinity = (carteInfinityRaw ?? []).map((c: Record<string, unknown>) => ({
      ...c,
      tipo: "infinity" as const,
    }));

    // Carte Sconto usa e getta (non regalate)
    const { data: carteUsaRaw } = await sb
      .from("carte_sconto")
      .select("id, codice, descrizione, tipo_sconto, valore_sconto, attiva, created_at")
      .eq("cliente_id", cliente.id)
      .eq("user_id", userId)
      .eq("usa_e_getta", true)
      .eq("regalata", false)
      .eq("attiva", true);

    const carteUsaEGetta = (carteUsaRaw ?? []).map((c: Record<string, unknown>) => ({
      ...c,
      tipo: "usa_e_getta" as const,
    }));

    // Gift Pass — acquistati dalla cliente (da donare: attivi, non ancora attivati)
    // Primary: by cliente_id (compratore)
    const { data: gpByClienteId } = await sb
      .from("gift_pass")
      .select("id, codice, tipo, valore_euro, prodotto_nome, occasione, attivata_at, scadenza_uso_at, destinataria_nome, destinataria_telefono, utilizzata")
      .eq("cliente_id", cliente.id)
      .eq("user_id", userId)
      .eq("utilizzata", false)
      .eq("attiva", true)
      .is("attivata_at", null);

    // Fallback: find via fiche di acquisto (handles records where cliente_id is null)
    const { data: fichesGiftPass } = await sb
      .from("fiches")
      .select("id")
      .eq("cliente_id", cliente.id)
      .eq("user_id", userId)
      .eq("tipo_fiche", "gift_pass")
      .is("deleted_at", null);

    const ficheIds = (fichesGiftPass ?? []).map((f: { id: string }) => f.id);
    let gpByFiche: Array<Record<string, unknown>> = [];
    if (ficheIds.length > 0) {
      const { data } = await sb
        .from("gift_pass")
        .select("id, codice, tipo, valore_euro, prodotto_nome, occasione, attivata_at, scadenza_uso_at, destinataria_nome, destinataria_telefono, utilizzata")
        .in("fiche_acquisto_id", ficheIds)
        .eq("user_id", userId)
        .eq("utilizzata", false)
        .eq("attiva", true)
        .is("attivata_at", null);
      gpByFiche = (data ?? []) as Array<Record<string, unknown>>;
    }

    const seenDonatoreIds = new Set<string>((gpByClienteId ?? []).map((gp: { id: string }) => gp.id));
    const gpDonatoreRaw = [
      ...((gpByClienteId ?? []) as Array<Record<string, unknown>>),
      ...gpByFiche.filter(gp => !seenDonatoreIds.has(gp.id as string)),
    ];

    // Gift Pass — ricevuti dalla cliente (destinataria, attivi, non utilizzati)
    // Primary: by destinataria_cliente_id
    const { data: gpRiceventeById } = await sb
      .from("gift_pass")
      .select("id, codice, tipo, valore_euro, prodotto_nome, occasione, attivata_at, scadenza_uso_at, destinataria_nome, destinataria_telefono, utilizzata")
      .eq("destinataria_cliente_id", cliente.id)
      .eq("user_id", userId)
      .eq("utilizzata", false)
      .eq("attiva", true);

    // Fallback: by destinataria_telefono when destinataria_cliente_id is null
    const { data: gpRiceventeByPhoneRaw } = await sb
      .from("gift_pass")
      .select("id, codice, tipo, valore_euro, prodotto_nome, occasione, attivata_at, scadenza_uso_at, destinataria_nome, destinataria_telefono, utilizzata")
      .eq("user_id", userId)
      .eq("utilizzata", false)
      .eq("attiva", true)
      .is("destinataria_cliente_id", null);

    const gpRiceventeByPhone = ((gpRiceventeByPhoneRaw ?? []) as Array<Record<string, unknown>>)
      .filter(gp => {
        const gpTelNorm = normalizePhone(String(gp.destinataria_telefono ?? ""));
        return gpTelNorm && telNorm && gpTelNorm === telNorm;
      });

    const seenRiceventeIds = new Set<string>((gpRiceventeById ?? []).map((gp: { id: string }) => gp.id));
    const gpRiceventeRaw = [
      ...((gpRiceventeById ?? []) as Array<Record<string, unknown>>),
      ...gpRiceventeByPhone.filter(gp => !seenRiceventeIds.has(gp.id as string)),
    ];

    const now = new Date();
    const giftPassDonatore = gpDonatoreRaw.map((gp: Record<string, unknown>) => ({
      ...gp,
      tipo_carta: "gift_pass_donatore" as const,
    }));
    const giftPassRicevente = (gpRiceventeRaw as Array<Record<string, unknown> & { scadenza_uso_at?: string | null; tipo?: string }>)
      .filter(gp => !(gp.tipo !== "valore" && gp.scadenza_uso_at && new Date(gp.scadenza_uso_at as string) < now))
      .map(gp => ({
        ...gp,
        tipo_carta: "gift_pass_ricevente" as const,
      }));

    return json({
      cliente: { id: cliente.id, nome: cliente.nome, cognome: cliente.cognome },
      cartePremium,
      carteInfinity,
      carteUsaEGetta,
      giftPassDonatore,
      giftPassRicevente,
      salone: imp,
    });
  }

  // POST /regala — segna una carta usa e getta come regalata
  if (req.method === "POST" && path === "/regala") {
    try {
      const body = await req.json().catch(() => null);
      if (!body) return json({ error: "Body non valido" }, 400);

      const { user_id, telefono, carta_id } = body;
      if (!user_id || !telefono || !carta_id) return json({ error: "Parametri mancanti" }, 400);

      const telNorm = normalizePhone(telefono);

      // Verifica che la carta appartenga effettivamente a questa cliente
      const { data: clienti } = await sb
        .from("clienti")
        .select("id, nome, cognome, telefono")
        .eq("user_id", user_id)
        .is("deleted_at", null);

      const cliente = (clienti ?? []).find((c: { telefono: string }) =>
        normalizePhone(c.telefono ?? "") === telNorm
      );

      if (!cliente) return json({ error: "Cliente non trovata" }, 404);

      const { data: carta } = await sb
        .from("carte_sconto")
        .select("id, cliente_id, usa_e_getta, regalata")
        .eq("id", carta_id)
        .eq("user_id", user_id)
        .maybeSingle();

      if (!carta) return json({ error: "Carta non trovata" }, 404);
      if (carta.cliente_id !== cliente.id) return json({ error: "Non autorizzata" }, 403);
      if (!carta.usa_e_getta) return json({ error: "Non è una carta usa e getta" }, 400);
      if (carta.regalata) return json({ error: "Carta già regalata" }, 400);

      const exNome = `${cliente.nome} ${cliente.cognome}`;

      const { error } = await sb
        .from("carte_sconto")
        .update({
          regalata: true,
          ex_proprietaria_nome: exNome,
          cliente_id: null,
          regalata_da_cliente_id: cliente.id,
        })
        .eq("id", carta_id);

      if (error) return json({ error: "Errore nel salvataggio" }, 500);

      return json({ success: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Errore interno";
      return json({ error: msg }, 500);
    }
  }

  // POST /associa-carta — associa una carta sconto regalata (dal cassetto) alla cliente
  // Usato quando la cliente inserisce il codice nella schermata dati
  if (req.method === "POST" && path === "/associa-carta") {
    try {
      const body = await req.json().catch(() => null);
      if (!body) return json({ error: "Body non valido" }, 400);

      const { user_id, nome, cognome, telefono, codice_carta } = body;
      if (!user_id || !telefono || !codice_carta) return json({ error: "Parametri mancanti" }, 400);

      const telNorm = normalizePhone(telefono);

      // Cerca la carta nel cassetto (regalata=true)
      const { data: carta } = await sb
        .from("carte_sconto")
        .select("id, regalata, cliente_id, usa_e_getta, attiva, ex_proprietaria_nome, regalata_da_cliente_id")
        .eq("user_id", user_id)
        .eq("codice", codice_carta.toUpperCase())
        .maybeSingle();

      if (!carta || !carta.regalata || !carta.attiva) {
        return json({ error: "Carta non trovata nel cassetto" }, 404);
      }

      const presentataDaNome = carta.ex_proprietaria_nome ?? null;

      // Cerca se la cliente esiste già
      const { data: clienti } = await sb
        .from("clienti")
        .select("id, nome, cognome, telefono")
        .eq("user_id", user_id)
        .is("deleted_at", null);

      const cliente = (clienti ?? []).find((c: { telefono?: string }) =>
        normalizePhone(c.telefono ?? "") === telNorm
      );

      if (cliente) {
        // Cliente esistente: assegna carta direttamente, salva il referente
        await sb.from("carte_sconto").update({
          cliente_id: cliente.id,
          regalata: false,
          regalata_da_cliente_id: carta.regalata_da_cliente_id ?? null,
        }).eq("id", carta.id);
      } else {
        // Cliente nuova: crea/aggiorna scheda da confermare con codice carta e nome referente
        const { data: existing } = await sb
          .from("schede_clienti_da_confermare")
          .select("id")
          .eq("telefono", telefono.trim())
          .eq("stato", "in_attesa")
          .maybeSingle();

        if (existing) {
          await sb.from("schede_clienti_da_confermare")
            .update({
              codice_carta_sconto: codice_carta.toUpperCase(),
              presentata_da_nome: presentataDaNome,
            })
            .eq("id", existing.id);
        } else {
          await sb.from("schede_clienti_da_confermare").insert({
            nome: nome ?? '',
            cognome: cognome ?? '',
            telefono: telefono.trim(),
            codice_carta_sconto: codice_carta.toUpperCase(),
            presentata_da_nome: presentataDaNome,
            stato: "in_attesa",
          });
        }
      }

      return json({ success: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Errore interno";
      return json({ error: msg }, 500);
    }
  }

  // POST /verifica-codici — verifica se il telefono è il mittente originale del codice (blocco auto-uso)
  // Restituisce { gift_pass_error, carta_sconto_error } se ci sono blocchi
  if (req.method === "POST" && path === "/verifica-codici") {
    try {
      const body = await req.json().catch(() => null);
      if (!body) return json({ error: "Body non valido" }, 400);

      const { user_id, telefono, gift_pass_codice, carta_sconto_codice } = body;
      if (!user_id || !telefono) return json({ error: "Parametri mancanti" }, 400);

      const telNorm = normalizePhone(telefono);
      let giftPassError: string | null = null;
      let cartaScontoError: string | null = null;

      // Controllo Gift Pass
      if (gift_pass_codice) {
        const { data: gp } = await sb
          .from("gift_pass")
          .select("id, destinataria_telefono")
          .eq("codice", String(gift_pass_codice).toUpperCase())
          .is("attivata_at", null)
          .eq("utilizzata", false)
          .maybeSingle();

        if (gp && gp.destinataria_telefono) {
          const telNormDest = normalizePhone(gp.destinataria_telefono);
          if (telNormDest && telNorm && telNorm === telNormDest) {
            giftPassError = "Questo Gift Pass è destinato a essere regalato a qualcun altro. Non puoi usarlo tu stessa.";
          }
        }
      }

      // Controllo Carta Sconto regalata
      if (carta_sconto_codice) {
        const { data: carta } = await sb
          .from("carte_sconto")
          .select("id, regalata, regalata_da_cliente_id")
          .eq("user_id", user_id)
          .eq("codice", String(carta_sconto_codice).toUpperCase())
          .eq("regalata", true)
          .eq("attiva", true)
          .maybeSingle();

        if (carta && carta.regalata_da_cliente_id) {
          const { data: mittente } = await sb
            .from("clienti")
            .select("telefono")
            .eq("id", carta.regalata_da_cliente_id)
            .maybeSingle();

          if (mittente && mittente.telefono) {
            const telNormMitt = normalizePhone(mittente.telefono);
            if (telNormMitt && telNorm && telNorm === telNormMitt) {
              cartaScontoError = "Questa carta sconto è stata regalata a un'amica. Non puoi usarla tu stessa.";
            }
          }
        }
      }

      return json({ gift_pass_error: giftPassError, carta_sconto_error: cartaScontoError });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Errore interno";
      return json({ error: msg }, 500);
    }
  }

  return json({ error: "Not found" }, 404);
});
