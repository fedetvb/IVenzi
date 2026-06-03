import { localDateStr } from './supabase';

export interface ParsedIntent {
  tool: string;
  args: Record<string, unknown>;
  displayQuestion: string;
}

// ─── Date helpers ────────────────────────────────────────────────────────────

function oggi() { return localDateStr(); }

function domani() {
  const d = new Date(); d.setDate(d.getDate() + 1); return localDateStr(d);
}

function dopodomani() {
  const d = new Date(); d.setDate(d.getDate() + 2); return localDateStr(d);
}

function ieri() {
  const d = new Date(); d.setDate(d.getDate() - 1); return localDateStr(d);
}

function lunediCorrente() {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const mon = new Date(now);
  mon.setDate(now.getDate() + diff);
  return localDateStr(mon);
}

function prossimeLunedi() {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? 1 : 8 - day;
  const mon = new Date(now);
  mon.setDate(now.getDate() + diff);
  return localDateStr(mon);
}

// Parsa "lunedi", "martedi", ecc. -> data del giorno corrente o prossimo
const GIORNI_SETTIMANA: Record<string, number> = {
  lunedi: 1, lunedì: 1,
  martedi: 2, martedì: 2,
  mercoledi: 3, mercoledì: 3,
  giovedi: 4, giovedì: 4,
  venerdi: 5, venerdì: 5,
  sabato: 6,
  domenica: 0,
};

function dateFromGiorno(nomeGiorno: string, prossimo: boolean): string {
  const target = GIORNI_SETTIMANA[nomeGiorno.toLowerCase()];
  if (target === undefined) return oggi();
  const now = new Date();
  const current = now.getDay();
  let diff = target - current;
  if (diff <= 0 || prossimo) diff += 7;
  const d = new Date(now);
  d.setDate(now.getDate() + diff);
  return localDateStr(d);
}

// Parsa "3 giugno", "15 luglio 2025", ecc.
const MESI: Record<string, number> = {
  gennaio: 1, febbraio: 2, marzo: 3, aprile: 4, maggio: 5, giugno: 6,
  luglio: 7, agosto: 8, settembre: 9, ottobre: 10, novembre: 11, dicembre: 12,
};

function parseDataItaliana(testo: string): string | null {
  const m = testo.match(/(\d{1,2})\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)(?:\s+(\d{4}))?/i);
  if (!m) return null;
  const day = m[1].padStart(2, '0');
  const month = String(MESI[m[2].toLowerCase()]).padStart(2, '0');
  const year = m[3] || String(new Date().getFullYear());
  return `${year}-${month}-${day}`;
}

// ─── Keyword helpers ──────────────────────────────────────────────────────────

function has(text: string, ...words: string[]): boolean {
  return words.some(w => text.includes(w));
}

function extractGiorniAssenza(text: string, def = 60): number {
  const m = text.match(/(\d+)\s*giorni/);
  return m ? parseInt(m[1], 10) : def;
}

function extractNomeCliente(text: string): string | null {
  // "cerca Mario Rossi" | "informazioni su Maria" | "chi e' Maria Rossi"
  const patterns = [
    /cerca\s+([a-zA-ZÀ-ÿ]+(?:\s+[a-zA-ZÀ-ÿ]+)*)/i,
    /(?:informazioni|info|scheda|storico|dati)\s+(?:su|di|per)?\s*([a-zA-ZÀ-ÿ]+(?:\s+[a-zA-ZÀ-ÿ]+)?)/i,
    /chi\s+[eèe']+\s+([a-zA-ZÀ-ÿ]+(?:\s+[a-zA-ZÀ-ÿ]+)?)/i,
    /(?:cliente|clienta)\s+([a-zA-ZÀ-ÿ]+(?:\s+[a-zA-ZÀ-ÿ]+)?)/i,
    /(?:appuntament[oi])\s+(?:di|per)\s+([a-zA-ZÀ-ÿ]+(?:\s+[a-zA-ZÀ-ÿ]+)?)/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[1].trim();
  }
  return null;
}

function extractPeriodo(text: string): 'oggi' | 'settimana' | 'mese' | 'anno' {
  if (has(text, 'oggi', 'odiern', 'giornata')) return 'oggi';
  if (has(text, 'settiman', 'questa settimana', 'settimana corrente')) return 'settimana';
  if (has(text, 'anno', 'annuale', "quest'anno", 'anno corrente')) return 'anno';
  return 'mese';
}

function extractPeriodoParr(text: string): 'settimana' | 'mese' | 'anno' {
  if (has(text, 'settiman')) return 'settimana';
  if (has(text, 'anno', "quest'anno")) return 'anno';
  return 'mese';
}

// ─── Main parser ──────────────────────────────────────────────────────────────

export function parseQuery(raw: string): ParsedIntent | null {
  const text = raw.toLowerCase().trim();

  // ── Appuntamenti per data specifica ────────────────────────────────────────

  const dataEsplicita = parseDataItaliana(text);
  if (dataEsplicita && has(text, 'appuntament', 'agenda', 'prenotat', 'chi viene', 'chi ha')) {
    return { tool: 'get_appuntamenti_oggi', args: { data: dataEsplicita }, displayQuestion: raw };
  }

  // Giorno della settimana specifico
  const prossimo = has(text, 'prossim');
  for (const [nomeGiorno] of Object.entries(GIORNI_SETTIMANA)) {
    if (text.includes(nomeGiorno)) {
      const data = dateFromGiorno(nomeGiorno, prossimo);
      if (has(text, 'appuntament', 'agenda', 'chi viene', 'chi ha', 'prenotat', 'libero', 'slot', 'disponibil')) {
        if (has(text, 'libero', 'slot', 'disponibil', 'liberi', 'quando')) {
          return { tool: 'get_slot_liberi', args: { data }, displayQuestion: raw };
        }
        return { tool: 'get_appuntamenti_oggi', args: { data }, displayQuestion: raw };
      }
    }
  }

  // Oggi
  if (has(text, 'oggi', 'odiern', 'giornata di oggi')) {
    if (has(text, 'incasso', 'incassat', 'guadagn', 'fatt', 'soldi', 'euro')) {
      return { tool: 'get_statistiche_incassi', args: { periodo: 'oggi' }, displayQuestion: raw };
    }
    if (has(text, 'libero', 'slot', 'disponibil', 'quando posso', 'orari liberi')) {
      return { tool: 'get_slot_liberi', args: { data: oggi() }, displayQuestion: raw };
    }
    if (has(text, 'servizi', 'trattament', 'cosa', 'eseguiti')) {
      return { tool: 'get_statistiche_servizi', args: { periodo: 'oggi' }, displayQuestion: raw };
    }
    if (has(text, 'appuntament', 'chi viene', 'chi ha', 'prenotat', 'agenda', 'clienti')) {
      return { tool: 'get_appuntamenti_oggi', args: { data: oggi() }, displayQuestion: raw };
    }
  }

  // Domani
  if (has(text, 'domani')) {
    if (has(text, 'libero', 'slot', 'disponibil', 'quando posso', 'orari liberi')) {
      return { tool: 'get_slot_liberi', args: { data: domani() }, displayQuestion: raw };
    }
    return { tool: 'get_appuntamenti_oggi', args: { data: domani() }, displayQuestion: raw };
  }

  // Dopodomani
  if (has(text, 'dopodomani')) {
    return { tool: 'get_appuntamenti_oggi', args: { data: dopodomani() }, displayQuestion: raw };
  }

  // Ieri
  if (has(text, 'ieri')) {
    if (has(text, 'incasso', 'incassat', 'guadagn', 'fatt', 'soldi')) {
      return { tool: 'get_statistiche_incassi', args: { periodo: 'oggi' }, displayQuestion: raw };
    }
    return { tool: 'get_appuntamenti_oggi', args: { data: ieri() }, displayQuestion: raw };
  }

  // Settimana
  if (has(text, 'settiman')) {
    const pross = has(text, 'prossim', 'prossima settimana');
    const dataInizio = pross ? prossimeLunedi() : lunediCorrente();
    if (has(text, 'incasso', 'incassat', 'guadagn', 'fatt', 'soldi', 'euro')) {
      return { tool: 'get_statistiche_incassi', args: { periodo: 'settimana' }, displayQuestion: raw };
    }
    if (has(text, 'servizi', 'trattament', 'eseguiti')) {
      return { tool: 'get_statistiche_servizi', args: { periodo: 'settimana' }, displayQuestion: raw };
    }
    if (has(text, 'parrucchier', 'operatori', 'dipendenti', 'staff')) {
      return { tool: 'get_statistiche_parrucchieri', args: { periodo: 'settimana' }, displayQuestion: raw };
    }
    return { tool: 'get_appuntamenti_settimana', args: { data_inizio: dataInizio }, displayQuestion: raw };
  }

  // ── Slot liberi ─────────────────────────────────────────────────────────────

  if (has(text, 'slot liberi', 'orari liberi', 'quando posso', 'disponibil', 'liberi oggi', 'posto libero')) {
    return { tool: 'get_slot_liberi', args: { data: oggi() }, displayQuestion: raw };
  }

  // ── Cerca cliente ──────────────────────────────────────────────────────────

  const nomeCliente = extractNomeCliente(text);
  if (nomeCliente && has(text, 'cerca', 'info', 'informazioni', 'scheda', 'storico', 'chi e', 'cliente', 'clienta', 'trova', 'dati', 'appuntament')) {
    return { tool: 'cerca_cliente', args: { query: nomeCliente }, displayQuestion: raw };
  }

  // ── Clienti assenti ────────────────────────────────────────────────────────

  if (has(text, 'assent', 'non vengo', 'non vengono', 'mancant', 'persi', 'non si vedono', 'non si vede')) {
    const giorni = extractGiorniAssenza(text, 60);
    return { tool: 'get_clienti_assenti', args: { giorni }, displayQuestion: raw };
  }

  if (has(text, 'clienti che non', 'non tornano', 'non rivengo')) {
    const giorni = extractGiorniAssenza(text, 60);
    return { tool: 'get_clienti_assenti', args: { giorni }, displayQuestion: raw };
  }

  // ── Incassi ────────────────────────────────────────────────────────────────

  if (has(text, 'incasso', 'incassat', 'guadagn', 'fatturato', 'soldi', 'euro', 'ricavi', 'entrate', 'fiches', 'fiche')) {
    const periodo = extractPeriodo(text);
    return { tool: 'get_statistiche_incassi', args: { periodo }, displayQuestion: raw };
  }

  if (has(text, 'media fich', 'media append', 'scontrino medio', 'ticket medio')) {
    const periodo = extractPeriodo(text);
    return { tool: 'get_statistiche_incassi', args: { periodo }, displayQuestion: raw };
  }

  // ── Servizi ────────────────────────────────────────────────────────────────

  if (has(text, 'servizi', 'trattament', 'taglio', 'colore', 'piastra', 'piega', 'eseguiti', 'più richiesti', 'piu richiesti', 'piu eseguiti', 'più eseguiti', 'classifica')) {
    const periodo = extractPeriodo(text);
    return { tool: 'get_statistiche_servizi', args: { periodo }, displayQuestion: raw };
  }

  // ── Parrucchieri ───────────────────────────────────────────────────────────

  if (has(text, 'parrucchier', 'operatori', 'dipendenti', 'staff', 'collaboratori', 'chi guadagna di piu', 'chi lavora di piu')) {
    const periodo = extractPeriodoParr(text);
    return { tool: 'get_statistiche_parrucchieri', args: { periodo }, displayQuestion: raw };
  }

  // ── Appuntamenti generici ──────────────────────────────────────────────────

  if (has(text, 'appuntament', 'agenda', 'prenotazion', 'chi viene', 'chi ha appuntamento', 'clienti di oggi', 'clienti oggi')) {
    return { tool: 'get_appuntamenti_oggi', args: { data: oggi() }, displayQuestion: raw };
  }

  return null;
}

// ─── Format helpers (mirror quelli di AiChat ma standalone) ──────────────────

function fmtEuro(n: number) {
  return n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

export interface FormatResult {
  text: string;
  table?: { headers: string[]; rows: string[][] };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function formatToolResult(tool: string, parsed: any): FormatResult {
  if (parsed.errore) return { text: `Non ho trovato risultati: ${parsed.errore}` };

  switch (tool) {
    case 'get_appuntamenti_oggi': {
      if (!parsed.appuntamenti?.length) return { text: `Nessun appuntamento per ${parsed.data || 'questa data'}.` };
      return {
        text: `${parsed.totale} appuntament${parsed.totale === 1 ? 'o' : 'i'} per il ${parsed.data}:`,
        table: {
          headers: ['Ora', 'Cliente', 'Parrucchiere', 'Durata', 'Stato'],
          rows: parsed.appuntamenti.map((a: { ora: string; cliente: string; parrucchiere: string | null; durata_minuti: number; stato: string }) => [
            a.ora, a.cliente, a.parrucchiere || '—', `${a.durata_minuti} min`, a.stato,
          ]),
        },
      };
    }
    case 'get_appuntamenti_settimana': {
      if (!parsed.totale) return { text: 'Nessun appuntamento questa settimana.' };
      const rows: string[][] = [];
      Object.entries(parsed.per_giorno as Record<string, { ora: string; cliente: string; parrucchiere: string | null; stato: string }[]>).forEach(([g, apps]) => {
        apps.forEach(a => rows.push([g, a.ora, a.cliente, a.parrucchiere || '—', a.stato]));
      });
      return { text: `${parsed.totale} appuntament${parsed.totale === 1 ? 'o' : 'i'} questa settimana:`, table: { headers: ['Giorno', 'Ora', 'Cliente', 'Parrucchiere', 'Stato'], rows } };
    }
    case 'get_slot_liberi': {
      if (!parsed.totale_slot_liberi) return { text: `Nessuno slot libero per il ${parsed.data}.` };
      return { text: `${parsed.totale_slot_liberi} slot liberi per il ${parsed.data}:\n${(parsed.slot_liberi as string[]).join('  •  ')}` };
    }
    case 'get_statistiche_incassi': {
      const totale = parseFloat(parsed.totale_incassato);
      const media = parseFloat(parsed.media_fiche);
      return { text: `Incasso ${parsed.periodo} (${parsed.dal} → ${parsed.al}):\n\nTotale: ${fmtEuro(totale)}\nFiches: ${parsed.numero_fiches_convalidate}\nMedia fiche: ${fmtEuro(media)}` };
    }
    case 'get_statistiche_servizi': {
      if (!parsed.servizi_piu_eseguiti?.length) return { text: 'Nessun servizio registrato in questo periodo.' };
      return {
        text: `Servizi ${parsed.periodo} (${parsed.dal} → ${parsed.al}):`,
        table: {
          headers: ['Servizio', 'Quantita', 'Totale'],
          rows: parsed.servizi_piu_eseguiti.map((s: { nome: string; quantita: number; totale_euro: string }) => [s.nome, String(s.quantita), fmtEuro(parseFloat(s.totale_euro))]),
        },
      };
    }
    case 'get_statistiche_parrucchieri': {
      if (!parsed.parrucchieri?.length) return { text: 'Nessun dato parrucchieri in questo periodo.' };
      return {
        text: `Parrucchieri ${parsed.periodo} (${parsed.dal} → ${parsed.al}):`,
        table: {
          headers: ['Parrucchiere', 'Appuntamenti', 'Incasso', 'Media'],
          rows: parsed.parrucchieri.map((p: { parrucchiere: string; appuntamenti: number; incasso_totale: string; media_appuntamento: string }) => [p.parrucchiere, String(p.appuntamenti), fmtEuro(parseFloat(p.incasso_totale)), fmtEuro(parseFloat(p.media_appuntamento))]),
        },
      };
    }
    case 'cerca_cliente': {
      if (!parsed.trovati) return { text: `Nessun cliente trovato.` };
      return {
        text: `${parsed.trovati} cliente/i trovati:`,
        table: {
          headers: ['Nome', 'Telefono', 'Ultima visita', 'Tot. appuntamenti'],
          rows: parsed.clienti.map((c: { nome: string; telefono: string | null; ultima_visita: string; totale_appuntamenti: number }) => [c.nome, c.telefono || '—', c.ultima_visita, String(c.totale_appuntamenti)]),
        },
      };
    }
    case 'get_clienti_assenti': {
      if (!parsed.totale_assenti) return { text: `Nessun cliente assente da ${parsed.soglia_giorni}+ giorni.` };
      return {
        text: `${parsed.totale_assenti} clienti assenti da ${parsed.soglia_giorni}+ giorni:`,
        table: {
          headers: ['Cliente', 'Telefono', 'Ultima visita', 'Giorni'],
          rows: parsed.clienti.map((c: { nome: string; telefono: string | null; ultima_visita: string; giorni_assenza: number | null }) => [c.nome, c.telefono || '—', c.ultima_visita, c.giorni_assenza ? `${c.giorni_assenza} gg` : 'Mai venuto']),
        },
      };
    }
    default:
      return { text: JSON.stringify(parsed, null, 2) };
  }
}
