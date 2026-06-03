import { localDateStr } from './supabase';

export interface ParsedIntent {
  tool: string;
  args: Record<string, unknown>;
  displayQuestion: string;
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function oggi() { return localDateStr(); }
function domani() { const d = new Date(); d.setDate(d.getDate() + 1); return localDateStr(d); }
function dopodomani() { const d = new Date(); d.setDate(d.getDate() + 2); return localDateStr(d); }
function ieri() { const d = new Date(); d.setDate(d.getDate() - 1); return localDateStr(d); }

function lunediCorrente() {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const d = new Date(now); d.setDate(now.getDate() + diff); return localDateStr(d);
}
function prossimeLunedi() {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? 1 : 8 - day;
  const d = new Date(now); d.setDate(now.getDate() + diff); return localDateStr(d);
}

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
  if (diff < 0 || (diff === 0 && !prossimo)) diff += 7;
  if (diff === 0 && prossimo) diff += 7;
  const d = new Date(now); d.setDate(now.getDate() + diff); return localDateStr(d);
}

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

/** Controlla se il testo contiene almeno una delle parole/frasi */
function has(text: string, ...words: string[]): boolean {
  return words.some(w => text.includes(w));
}

/** Controlla se il testo contiene tutte le parole (AND) */
function hasAll(text: string, ...words: string[]): boolean {
  return words.every(w => text.includes(w));
}

function extractNome(text: string): string | null {
  const patterns = [
    /cerca\s+([a-zA-ZÀ-ÿ']+(?:\s+[a-zA-ZÀ-ÿ']+)?)/i,
    /(?:trova|cerco|cerchi|cerchiamo)\s+([a-zA-ZÀ-ÿ']+(?:\s+[a-zA-ZÀ-ÿ']+)?)/i,
    /(?:info|informazioni|scheda|storico|dati|storia)\s+(?:su|di|per|del|della)?\s*([a-zA-ZÀ-ÿ']+(?:\s+[a-zA-ZÀ-ÿ']+)?)/i,
    /chi\s+[eèé']+\s+([a-zA-ZÀ-ÿ']+(?:\s+[a-zA-ZÀ-ÿ']+)?)/i,
    /(?:cliente|clienta)\s+(?:di nome\s+)?([a-zA-ZÀ-ÿ']+(?:\s+[a-zA-ZÀ-ÿ']+)?)/i,
    /(?:appuntament[oi])\s+(?:di|per)\s+([a-zA-ZÀ-ÿ']+(?:\s+[a-zA-ZÀ-ÿ']+)?)/i,
    /(?:visite|storico)\s+(?:di|per)\s+([a-zA-ZÀ-ÿ']+(?:\s+[a-zA-ZÀ-ÿ']+)?)/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[1].trim();
  }
  return null;
}

function extractGiorni(text: string, def = 60): number {
  const m = text.match(/(\d+)\s*(?:giorni?|gg)/);
  return m ? parseInt(m[1], 10) : def;
}

function extractOra(text: string): string | null {
  // "alle 10", "alle 10:30", "10:30", "ore 10"
  const m = text.match(/(?:alle?|ore?)\s*(\d{1,2})(?::(\d{2}))?/) || text.match(/\b(\d{1,2}):(\d{2})\b/);
  if (!m) return null;
  const h = m[1].padStart(2, '0');
  const min = (m[2] || '00').padStart(2, '0');
  return `${h}:${min}`;
}

function resolveDateText(text: string): string {
  const dataEsplicita = parseDataItaliana(text);
  if (dataEsplicita) return dataEsplicita;
  if (has(text, 'dopodomani')) return dopodomani();
  if (has(text, 'domani')) return domani();
  if (has(text, 'oggi')) return oggi();
  for (const [nome] of Object.entries(GIORNI_SETTIMANA)) {
    if (text.includes(nome)) return dateFromGiorno(nome, has(text, 'prossim'));
  }
  return oggi();
}

// Parole "stop" che terminano il nome cliente/parrucchiere
const STOP_WORDS = /\b(per|con|alle?|ore?|domani|oggi|dopodomani|lunedi|martedi|mercoledi|giovedi|venerdi|sabato|domenica|alle|ore|fissa|fissiamo|prenota|prendi|crea|segna|metti|nuovo|appuntamento|\d)\b/i;

function parseFissaAppuntamento(raw: string, text: string): ParsedIntent | null {
  // Trigger: deve contenere un verbo di prenotazione
  const KW_VERBI = /\b(fissa|fissiamo|prenota|prenotare|prendi|metti|segna|crea)\b/i;
  // E deve contenere "appuntamento" oppure essere "prenota/prendi" senza "appuntamento" (basta il verbo + nome + ora)
  const hasVerbo = KW_VERBI.test(text);
  const hasAppuntamento = text.includes('appuntamento');
  if (!hasVerbo) return null;
  // Se c'è il verbo ma non "appuntamento", richiedi almeno "prenota" o "prendi" + ora
  if (!hasAppuntamento && !/\b(prenota|prendi|fissa)\b/.test(text)) return null;

  // Estrai ora — obbligatoria
  const ora = extractOra(text);
  if (!ora) return null;

  // Estrai data
  const data = resolveDateText(text);

  // Estrai nome cliente: la parola/e DOPO il verbo+appuntamento (o solo verbo) e PRIMA delle stop words
  let nomeCliente: string | null = null;

  // Pattern 1: "... appuntamento [a/per/di]? NOME [stop]"
  const m1 = text.match(/appuntamento\s+(?:[a-z]{1,3}\s+)?([a-zA-ZÀ-ÿ']+(?:\s+[a-zA-ZÀ-ÿ']+)?)\s+(?:per|con|alle?|ore?|domani|oggi|dopodomani|lunedi|martedi|mercoledi|giovedi|venerdi|sabato|domenica|\d)/i);
  if (m1) {
    // escludi preposizioni singole come "a", "per", "di"
    const candidate = m1[1].trim();
    if (candidate.length > 2 && !/^(per|con|di|da|a|in|su|il|la|lo|le|un|una)$/i.test(candidate)) {
      nomeCliente = candidate;
    }
  }

  // Pattern 2: "prendi/prenota/fissa [appuntamento] NOME [stop]" — nome senza preposizione
  if (!nomeCliente) {
    const m2 = text.match(/(?:fissa|prenota|prendi|crea|segna|metti)\s+(?:appuntamento\s+)?([a-zA-ZÀ-ÿ']+(?:\s+[a-zA-ZÀ-ÿ']+)?)\s+(?:per|con|alle?|ore?|domani|oggi|dopodomani|lunedi|martedi|mercoledi|giovedi|venerdi|sabato|domenica|\d)/i);
    if (m2) {
      const candidate = m2[1].trim();
      if (candidate.length > 2 && !/^(appuntamento|per|con|di|da|a|in|su|il|la|lo|le|un|una)$/i.test(candidate)) {
        nomeCliente = candidate;
      }
    }
  }

  // Pattern 3: verbo + appuntamento + nome alla fine, con "con" come separatore
  if (!nomeCliente) {
    const m3 = text.match(/(?:fissa|prenota|prendi|crea|segna|metti)\s+(?:appuntamento\s+)?(?:a\s+|per\s+)?([a-zA-ZÀ-ÿ']+(?:\s+[a-zA-ZÀ-ÿ']+)?)/i);
    if (m3) {
      const candidate = m3[1].trim().split(STOP_WORDS)[0].trim();
      if (candidate.length > 2 && !/^(appuntamento|per|con|di|da|a|in|su)$/i.test(candidate)) {
        nomeCliente = candidate;
      }
    }
  }

  if (!nomeCliente) return null;

  // Estrai parrucchiere: "con [nome]" — solo il nome proprio (1-2 parole), prima dei servizi/fine frase
  // I servizi comuni non sono nomi di persona
  const SERVIZI_RE = /\b(colore|colorazione|taglio|piega|piastra|shampoo|cheratina|meche|balayage|riflessante|permanente|trattamento)\b/i;
  let nomeParrucchiere: string | undefined;
  const mParr = text.match(/\bcon\s+([a-zA-ZÀ-ÿ']+(?:\s+[a-zA-ZÀ-ÿ']+)?)(?:\s+(?:alle?|ore?|\d))/i)
    || text.match(/\bcon\s+([a-zA-ZÀ-ÿ']+)(?:\s+\w+)?$/i);
  if (mParr) {
    // Prendi solo la prima parola dopo "con" come nome parrucchiere (esclude servizi)
    const firstWord = mParr[1].trim().split(/\s+/)[0];
    if (
      firstWord.length > 2
      && firstWord.toLowerCase() !== nomeCliente.toLowerCase().split(/\s+/)[0]
      && !SERVIZI_RE.test(firstWord)
    ) {
      nomeParrucchiere = firstWord;
    }
  }

  // Estrai note: parole dopo l'ora che non siano connettivi né il parrucchiere
  const CONNETTIVI_RE = /^(e|il|la|lo|le|un|una|con|per|alle?|ore?|di|da|del|della)$/i;
  const oraIndex = text.search(/(?:alle?|ore?)\s*\d{1,2}(?::\d{2})?/);
  let afterOra = oraIndex >= 0 ? text.slice(oraIndex).replace(/(?:alle?|ore?)\s*\d{1,2}(?::\d{2})?/, '').trim() : '';
  // rimuovi il nome del parrucchiere dalle note
  if (nomeParrucchiere) afterOra = afterOra.replace(new RegExp(`\\bcon\\s+${nomeParrucchiere}\\b`, 'i'), '').trim();
  const noteParts = afterOra.split(/\s+/).filter(w => w.length > 2 && !CONNETTIVI_RE.test(w));
  const note = noteParts.join(' ').trim() || undefined;

  return {
    tool: 'crea_appuntamento',
    args: {
      nome_cliente: nomeCliente,
      data,
      ora,
      ...(nomeParrucchiere ? { nome_parrucchiere: nomeParrucchiere } : {}),
      ...(note ? { note } : {}),
    },
    displayQuestion: raw,
  };
}

// ─── Contiene parole chiave "agenda/appuntamenti" ─────────────────────────────

const KW_AGENDA = ['appuntament', 'agenda', 'prenotat', 'chi viene', 'chi ha', 'occupato', 'chi c\'è', 'clienti di', 'booking'];
const KW_INCASSI = ['incasso', 'incassat', 'guadagn', 'fatturato', 'soldi', 'euro', 'ricavi', 'entrate', 'denaro', 'media fich', 'scontrino', 'ticket medio'];
const KW_SERVIZI = ['servizi', 'trattament', 'taglio', 'colore', 'piastra', 'piega', 'shampoo', 'eseguiti', 'richiesti', 'piu fatti', 'più fatti', 'classifica', 'populari', 'frequenti'];
const KW_PARR = ['parrucchier', 'operatori', 'dipendenti', 'staff', 'collaboratori', 'stylist'];
const KW_SLOT = ['slot', 'libero', 'libera', 'disponibil', 'orari liberi', 'quando posso', 'posto libero', 'quando c\'è posto', 'spazio'];
const KW_ASSENTI = ['assent', 'non vengono', 'non viene', 'non si vede', 'non si vedono', 'mancant', 'persi', 'non tornano', 'non ritornano', 'spariti', 'latitant', 'che non vengo'];

function hasKw(text: string, kws: string[]): boolean {
  return kws.some(k => text.includes(k));
}

// ─── Risolvi periodo per incassi/servizi/parrucchieri ─────────────────────────

type PeriodoBase = 'oggi' | 'ieri' | 'settimana' | 'mese' | 'anno';

function resolvePeriodo(text: string): PeriodoBase {
  if (has(text, 'ieri', 'ieri sera', 'di ieri')) return 'ieri';
  if (has(text, 'oggi', 'odiern', 'giornata')) return 'oggi';
  if (has(text, 'settiman', 'questa settimana', 'settimana corrente', 'questa sett')) return 'settimana';
  if (has(text, 'quest\'anno', "quest'anno", 'questo anno', 'anno corrente', 'anno in corso', 'annuale', 'dell\'anno', "dell'anno")) return 'anno';
  // "questo mese", "del mese", "mensile", "mese corrente", default
  return 'mese';
}

// ─── Main parser ──────────────────────────────────────────────────────────────

export function parseQuery(raw: string): ParsedIntent | null {
  // normalizza: minuscolo, rimuovi punteggiatura superflua
  const text = raw
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // rimuovi accenti per confronto
    .replace(/[?!,;]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // ── 0. Fissa / prendi appuntamento (massima priorità) ────────────────────
  const intentFissa = parseFissaAppuntamento(raw, text);
  if (intentFissa) return intentFissa;

  // ── 1. Cerca cliente (alta priorità) ──────────────────────────────────────
  const nomeCliente = extractNome(text);
  if (nomeCliente) {
    return { tool: 'cerca_cliente', args: { query: nomeCliente }, displayQuestion: raw };
  }

  // ── 2. Clienti assenti ────────────────────────────────────────────────────
  if (hasKw(text, KW_ASSENTI) || hasAll(text, 'clienti', 'non')) {
    const giorni = extractGiorni(text, 60);
    return { tool: 'get_clienti_assenti', args: { giorni }, displayQuestion: raw };
  }

  // ── 3. Slot liberi ────────────────────────────────────────────────────────
  if (hasKw(text, KW_SLOT)) {
    // estrai data se presente
    const dataEsplicita = parseDataItaliana(text);
    if (dataEsplicita) return { tool: 'get_slot_liberi', args: { data: dataEsplicita }, displayQuestion: raw };
    if (has(text, 'domani')) return { tool: 'get_slot_liberi', args: { data: domani() }, displayQuestion: raw };
    if (has(text, 'dopodomani')) return { tool: 'get_slot_liberi', args: { data: dopodomani() }, displayQuestion: raw };
    for (const [nome] of Object.entries(GIORNI_SETTIMANA)) {
      if (text.includes(nome)) {
        return { tool: 'get_slot_liberi', args: { data: dateFromGiorno(nome, has(text, 'prossim')) }, displayQuestion: raw };
      }
    }
    return { tool: 'get_slot_liberi', args: { data: oggi() }, displayQuestion: raw };
  }

  // ── 4. Incassi ────────────────────────────────────────────────────────────
  if (hasKw(text, KW_INCASSI)) {
    // Controlla data esplicita prima (es. "incasso del 5 giugno")
    const dataEsplicita = parseDataItaliana(text);
    if (dataEsplicita) {
      return { tool: 'get_statistiche_incassi', args: { periodo: 'oggi', _data_override: dataEsplicita }, displayQuestion: raw };
    }
    const periodo = resolvePeriodo(text);
    return { tool: 'get_statistiche_incassi', args: { periodo }, displayQuestion: raw };
  }

  // ── 5. Servizi ────────────────────────────────────────────────────────────
  if (hasKw(text, KW_SERVIZI)) {
    const periodo = resolvePeriodo(text);
    return { tool: 'get_statistiche_servizi', args: { periodo }, displayQuestion: raw };
  }

  // ── 6. Parrucchieri ───────────────────────────────────────────────────────
  if (hasKw(text, KW_PARR)) {
    const periodo = resolvePeriodo(text);
    const p = periodo === 'oggi' || periodo === 'ieri' ? 'mese' : periodo;
    return { tool: 'get_statistiche_parrucchieri', args: { periodo: p }, displayQuestion: raw };
  }

  // ── 7. Agenda / appuntamenti con data ─────────────────────────────────────
  const dataEsplicita = parseDataItaliana(text);
  if (dataEsplicita) {
    return { tool: 'get_appuntamenti_oggi', args: { data: dataEsplicita }, displayQuestion: raw };
  }

  if (has(text, 'ieri')) {
    // "chi c'era ieri" → appuntamenti di ieri
    return { tool: 'get_appuntamenti_oggi', args: { data: ieri() }, displayQuestion: raw };
  }
  if (has(text, 'dopodomani')) {
    return { tool: 'get_appuntamenti_oggi', args: { data: dopodomani() }, displayQuestion: raw };
  }
  if (has(text, 'domani')) {
    return { tool: 'get_appuntamenti_oggi', args: { data: domani() }, displayQuestion: raw };
  }
  if (has(text, 'oggi', 'odiern', 'giornata')) {
    return { tool: 'get_appuntamenti_oggi', args: { data: oggi() }, displayQuestion: raw };
  }

  // Settimana
  if (has(text, 'settiman')) {
    const pross = has(text, 'prossim', 'prossima settimana');
    // Incassi settimana già catturati sopra; qui siamo in agenda
    return { tool: 'get_appuntamenti_settimana', args: { data_inizio: pross ? prossimeLunedi() : lunediCorrente() }, displayQuestion: raw };
  }

  // Giorno della settimana
  const prossimo = has(text, 'prossim');
  for (const [nome] of Object.entries(GIORNI_SETTIMANA)) {
    if (text.includes(nome)) {
      return { tool: 'get_appuntamenti_oggi', args: { data: dateFromGiorno(nome, prossimo) }, displayQuestion: raw };
    }
  }

  // ── 8. Parole chiave agenda generica (senza data = oggi) ──────────────────
  if (hasKw(text, KW_AGENDA)) {
    return { tool: 'get_appuntamenti_oggi', args: { data: oggi() }, displayQuestion: raw };
  }

  // ── 9. Domande corte/numeri/stats generiche ───────────────────────────────
  // "quanti clienti", "totale clienti"
  if (has(text, 'quanti clienti', 'numero clienti', 'totale clienti', 'clienti in totale', 'clienti registrati')) {
    return { tool: 'cerca_cliente', args: { query: '' }, displayQuestion: raw };
  }

  return null;
}

// ─── Format helpers ───────────────────────────────────────────────────────────

function fmtEuro(n: number) {
  return n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

export interface FormatResult {
  text: string;
  table?: { headers: string[]; rows: string[][] };
}

const PERIODO_LABEL: Record<string, string> = {
  oggi: 'di oggi',
  ieri: 'di ieri',
  settimana: 'di questa settimana',
  mese: 'di questo mese',
  anno: "di quest'anno",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function formatToolResult(tool: string, parsed: any): FormatResult {
  if (parsed.errore) return { text: `Nessun risultato: ${parsed.errore}` };

  switch (tool) {
    case 'get_appuntamenti_oggi': {
      const label = parsed.data
        ? new Date(parsed.data + 'T12:00:00').toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })
        : 'questa data';
      if (!parsed.appuntamenti?.length) return { text: `Nessun appuntamento per ${label}.` };
      return {
        text: `${parsed.totale} appuntament${parsed.totale === 1 ? 'o' : 'i'} per ${label}:`,
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
        const giorno = new Date(g + 'T12:00:00').toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });
        apps.forEach(a => rows.push([giorno, a.ora, a.cliente, a.parrucchiere || '—', a.stato]));
      });
      return { text: `${parsed.totale} appuntament${parsed.totale === 1 ? 'o' : 'i'} questa settimana:`, table: { headers: ['Giorno', 'Ora', 'Cliente', 'Parrucchiere', 'Stato'], rows } };
    }
    case 'get_slot_liberi': {
      const label = parsed.data
        ? new Date(parsed.data + 'T12:00:00').toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })
        : 'questa data';
      const chi = parsed.parrucchiere ? ` — ${parsed.parrucchiere}` : '';
      if (!parsed.totale_slot_liberi) return { text: `Nessuno slot libero per ${label}${chi}.` };
      return { text: `${parsed.totale_slot_liberi} slot liberi per ${label}${chi}:\n${(parsed.slot_liberi as string[]).join('  •  ')}` };
    }
    case 'get_statistiche_incassi': {
      const totale = parseFloat(parsed.totale_incassato);
      const media = parseFloat(parsed.media_fiche);
      const label = PERIODO_LABEL[parsed.periodo] || parsed.periodo;
      return {
        text: `Incasso ${label} (${parsed.dal} → ${parsed.al}):\n\nTotale: ${fmtEuro(totale)}\nFiches convalidate: ${parsed.numero_fiches_convalidate}\nMedia per fiche: ${fmtEuro(media)}`,
      };
    }
    case 'get_statistiche_servizi': {
      const label = PERIODO_LABEL[parsed.periodo] || parsed.periodo;
      if (!parsed.servizi_piu_eseguiti?.length) return { text: `Nessun servizio registrato ${label}.` };
      return {
        text: `Servizi ${label} (${parsed.dal} → ${parsed.al}):`,
        table: {
          headers: ['Servizio', 'Quantita', 'Totale'],
          rows: parsed.servizi_piu_eseguiti.map((s: { nome: string; quantita: number; totale_euro: string }) => [
            s.nome, String(s.quantita), fmtEuro(parseFloat(s.totale_euro)),
          ]),
        },
      };
    }
    case 'get_statistiche_parrucchieri': {
      const label = PERIODO_LABEL[parsed.periodo] || parsed.periodo;
      if (!parsed.parrucchieri?.length) return { text: `Nessun dato parrucchieri ${label}.` };
      return {
        text: `Parrucchieri ${label} (${parsed.dal} → ${parsed.al}):`,
        table: {
          headers: ['Parrucchiere', 'Appuntamenti', 'Incasso', 'Media'],
          rows: parsed.parrucchieri.map((p: { parrucchiere: string; appuntamenti: number; incasso_totale: string; media_appuntamento: string }) => [
            p.parrucchiere, String(p.appuntamenti), fmtEuro(parseFloat(p.incasso_totale)), fmtEuro(parseFloat(p.media_appuntamento)),
          ]),
        },
      };
    }
    case 'cerca_cliente': {
      if (!parsed.trovati) return { text: 'Nessun cliente trovato.' };
      return {
        text: `${parsed.trovati} cliente${parsed.trovati === 1 ? '' : '/i'} trovato${parsed.trovati === 1 ? '' : '/i'}:`,
        table: {
          headers: ['Nome', 'Telefono', 'Ultima visita', 'Tot. appuntamenti'],
          rows: parsed.clienti.map((c: { nome: string; telefono: string | null; ultimo_appuntamento: string; totale_appuntamenti: number }) => [
            c.nome, c.telefono || '—', c.ultimo_appuntamento, String(c.totale_appuntamenti),
          ]),
        },
      };
    }
    case 'get_clienti_assenti': {
      if (!parsed.totale_assenti) return { text: `Nessun cliente assente da ${parsed.soglia_giorni}+ giorni.` };
      return {
        text: `${parsed.totale_assenti} client${parsed.totale_assenti === 1 ? 'e' : 'i'} assent${parsed.totale_assenti === 1 ? 'e' : 'i'} da ${parsed.soglia_giorni}+ giorni:`,
        table: {
          headers: ['Cliente', 'Telefono', 'Ultima visita', 'Giorni'],
          rows: parsed.clienti.map((c: { nome: string; telefono: string | null; ultima_visita: string; giorni_assenza: number | null }) => [
            c.nome, c.telefono || '—', c.ultima_visita, c.giorni_assenza ? `${c.giorni_assenza} gg` : 'Mai venuto',
          ]),
        },
      };
    }
    default:
      return { text: JSON.stringify(parsed, null, 2) };
  }
}
