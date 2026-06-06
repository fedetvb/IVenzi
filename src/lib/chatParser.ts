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
  const m = text.match(/(?:alle?|ore?)\s*(\d{1,2})(?::(\d{2}))?/)
    || text.match(/\b(\d{1,2}):(\d{2})\b/)
    || text.match(/\b([89]|1\d|20)\b/); // numero standalone 8-20 = ora
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

const SERVIZI_LISTA = ['cheratina', 'colorazione', 'colore', 'meches', 'meche', 'balayage', 'riflessante', 'permanente', 'taglio', 'piega', 'piastra', 'shampoo', 'trattamento'];
const SERVIZI_SET = new Set(SERVIZI_LISTA);

const PAROLE_FUNZIONE = new Set([
  'appuntamento', 'appuntamenti',
  'fissa', 'fissiamo', 'prenota', 'prenotare', 'prendi', 'metti', 'segna', 'crea', 'nuovo',
  'con', 'per', 'alle', 'ale', 'ore', 'ore', 'a', 'da', 'di', 'del', 'della', 'in', 'su', 'un', 'una',
  'il', 'la', 'lo', 'le', 'e', 'o',
  'oggi', 'domani', 'dopodomani', 'ieri',
  'lunedi', 'martedi', 'mercoledi', 'giovedi', 'venerdi', 'sabato', 'domenica',
  'prossimo', 'prossima', 'questo', 'questa', 'che',
]);

function parseFissaAppuntamento(raw: string, text: string, parrucchieriNomi: string[] = []): ParsedIntent | null {
  const KW_VERBI = /\b(fissa|fissiamo|prenota|prenotare|prendi|prendimi|metti|mettimi|segna|segnami|crea|scrivi|scrivimi|inserisci|aggiungi|vorrei|voglio|posso|puoi)\b/i;
  const hasVerbo = KW_VERBI.test(text);
  const hasAppuntamento = /\bappuntament[oi]?\b/.test(text);
  if (!hasVerbo && !hasAppuntamento) return null;
  if (!hasVerbo) return null;

  // Estrai ora — se mancante mostra gli slot liberi per la data richiesta
  const ora = extractOra(text);
  if (!ora) {
    const data = resolveDateText(text);
    return { tool: 'get_slot_liberi', args: { data }, displayQuestion: raw };
  }

  // Estrai data
  const data = resolveDateText(text);

  // Estrai servizio: scansiona la lista in ordine di priorità
  let nomeServizio: string | undefined;
  for (const s of SERVIZI_LISTA) {
    if (text.includes(s)) { nomeServizio = s; break; }
  }

  // Estrai parrucchiere: prima cerca match con lista reale parrucchieri
  let nomeParrucchiere: string | undefined;

  // Normalizza nomi parrucchieri (rimuovi accenti per confronto)
  const parrNorm = parrucchieriNomi.map(n => ({
    original: n,
    norm: n.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''),
  }));

  // Cerca il match più lungo nel testo (es. "mario rossi" prima di "mario")
  const parrMatch = parrNorm
    .filter(p => text.includes(p.norm))
    .sort((a, b) => b.norm.length - a.norm.length)[0];

  if (parrMatch) {
    nomeParrucchiere = parrMatch.original;
  } else {
    // Fallback: parola immediatamente dopo "con" se non è un servizio
    const mCon = text.match(/\bcon\s+([a-zA-ZÀ-ÿ']+(?:\s+[a-zA-ZÀ-ÿ']+)?)/i);
    if (mCon) {
      const tokens = mCon[1].trim().split(/\s+/);
      const parrTokens: string[] = [];
      for (const tok of tokens) {
        const t = tok.toLowerCase();
        if (PAROLE_FUNZIONE.has(t) || SERVIZI_SET.has(t)) break;
        parrTokens.push(tok);
        if (parrTokens.length === 2) break;
      }
      if (parrTokens.length > 0) nomeParrucchiere = parrTokens.join(' ');
    }
  }

  // Costruisci un testo "pulito" rimuovendo tutto tranne i nomi propri
  let cleaned = text
    .replace(/\b(fissa|fissiamo|prenota|prenotare|prendi|prendimi|metti|mettimi|segna|segnami|crea|scrivi|scrivimi|inserisci|aggiungi|vorrei|voglio|posso|puoi)\b/gi, '')
    .replace(/\bappuntamento\b/gi, '')
    .replace(/(?:alle?|ore?)\s*\d{1,2}(?::\d{2})?/gi, '')
    .replace(/\b\d{1,2}:\d{2}\b/gi, '') // "10:30"
    .replace(/\b([89]|1\d|20)\b/gi, '') // numero ora standalone 8-20
    .replace(/\bdomani\b|\boggi\b|\bdopodomani\b|\bieri\b/gi, '')
    .replace(/\b(lunedi|martedi|mercoledi|giovedi|venerdi|sabato|domenica)\b/gi, '')
    .replace(/\bprossim[oa]\b/gi, '');

  if (nomeServizio) cleaned = cleaned.replace(new RegExp(`\\b${nomeServizio}\\b`, 'gi'), '');

  // Rimuovi il parrucchiere (con o senza "con") dal testo pulito
  if (nomeParrucchiere) {
    const parrNormForRemoval = nomeParrucchiere.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    cleaned = cleaned.replace(new RegExp(`\\bcon\\s+${parrNormForRemoval.replace(/\s+/g, '\\s+')}\\b`, 'gi'), '');
    cleaned = cleaned.replace(new RegExp(`\\b${parrNormForRemoval.replace(/\s+/g, '\\s+')}\\b`, 'gi'), '');
  } else {
    cleaned = cleaned.replace(/\bcon\b/gi, '');
  }

  cleaned = cleaned.replace(/\b(per|alle?|ore?|di|da|del|della|a|in|su|il|la|lo|le|un|una|e|o)\b/gi, '');
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  // I token rimasti sono il nome cliente
  const nameTokens = cleaned
    .split(/\s+/)
    .filter(t => t.length > 1 && !PAROLE_FUNZIONE.has(t.toLowerCase()) && !SERVIZI_SET.has(t.toLowerCase()) && !/^\d+$/.test(t));

  if (nameTokens.length === 0) return null;
  const nomeCliente = nameTokens.slice(0, 3).join(' ');

  return {
    tool: 'crea_appuntamento',
    args: {
      nome_cliente: nomeCliente,
      data,
      ora,
      ...(nomeParrucchiere ? { nome_parrucchiere: nomeParrucchiere } : {}),
      ...(nomeServizio ? { nome_servizio: nomeServizio } : {}),
    },
    displayQuestion: raw,
  };
}

// ─── Contiene parole chiave "agenda/appuntamenti" ─────────────────────────────

const KW_AGENDA = ['appuntament', 'agenda', 'prenotat', 'chi viene', 'chi ha', 'occupato', 'chi c\'è', 'clienti di', 'booking', 'visite', 'lavori'];
const KW_INCASSI = ['incasso', 'incassat', 'guadagn', 'fatturato', 'soldi', 'euro', 'ricavi', 'entrate', 'denaro', 'media fich', 'scontrino', 'ticket medio', 'quanto abbiamo fatto', 'quanti soldi', 'quanto ho guadagn'];
const KW_SERVIZI = ['servizi', 'trattament', 'taglio', 'colore', 'piastra', 'piega', 'shampoo', 'eseguiti', 'richiesti', 'piu fatti', 'più fatti', 'classifica', 'populari', 'frequenti', 'cosa si fa di piu', 'cosa facciamo di piu'];
const KW_PARR = ['parrucchier', 'operatori', 'dipendenti', 'staff', 'collaboratori', 'stylist'];
const KW_SLOT = ['slot', 'libero', 'libera', 'disponibil', 'orari liberi', 'quando posso', 'posto libero', 'quando c\'è posto', 'spazio', 'ore libere', 'quando sei libero', 'quando siete liberi'];
const KW_ASSENTI = ['assent', 'non vengono', 'non viene', 'non si vede', 'non si vedono', 'mancant', 'persi', 'non tornano', 'non ritornano', 'spariti', 'latitant', 'che non vengo', 'clienti persi', 'clienti mancanti'];

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

export function parseQuery(raw: string, parrucchieriNomi: string[] = []): ParsedIntent | null {
  // normalizza: minuscolo, rimuovi punteggiatura superflua
  const text = raw
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // rimuovi accenti per confronto
    .replace(/[?!,;]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // ── 0. Fissa / prendi appuntamento (massima priorità) ────────────────────
  const intentFissa = parseFissaAppuntamento(raw, text, parrucchieriNomi);
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
