import { useEffect, useState, useCallback, useRef } from 'react';
import { ChevronLeft, Plus, CreditCard as Edit2, Trash2, X, Cake, Pencil, Check, Settings, ZoomIn, ZoomOut, Type, CalendarClock, Phone, User } from 'lucide-react';
import { supabase, type Appuntamento, type Parrucchiere } from '../lib/supabase';
import { dbSelect, dbSelectWithRelated, dbInsert, dbUpdate, dbDelete, dbUpsert, getImpostazione, setImpostazione } from '../lib/localDb';
import MultiBookModal from '../components/MultiBookModal';
import { apriWhatsApp } from '../lib/waUtils';

interface RichiestaAppuntamento {
  id: string;
  nome: string;
  cognome: string;
  telefono: string;
  parrucchiere_id: string | null;
  servizio_id: string;
  data_ora: string;
  parrucchiere2_id: string | null;
  servizio2_id: string | null;
  data_ora2: string | null;
  stato: 'in_attesa' | 'confermata' | 'rifiutata';
  cliente_id: string | null;
  chiunque: boolean;
  parrucchieri_candidati: string[] | null;
  servizio_nome?: string;
  servizio2_nome?: string;
  durata_minuti?: number;
  durata2_minuti?: number;
}

const SLOT_DURATION = 15;
const SLOT_HEIGHT_DEFAULT = 28;
const SLOT_HEIGHT_MIN = 8;
const SLOT_HEIGHT_MAX = 72;
const FONT_SIZE_DEFAULT = 100;
const FONT_SIZE_MIN = 60;
const FONT_SIZE_MAX = 160;
const LONG_PRESS_MS = 500;

function getSlots(startHour: number, endHour: number) {
  const slots: string[] = [];
  const startMin = Math.round(startHour * 60);
  const endMin = endHour * 60;
  for (let m = startMin; m < endMin; m += SLOT_DURATION) {
    const h = Math.floor(m / 60);
    const min = m % 60;
    slots.push(`${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`);
  }
  return slots;
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean;
  const num = parseInt(full, 16);
  return `rgba(${(num >> 16) & 0xff},${(num >> 8) & 0xff},${num & 0xff},${alpha})`;
}

function darkenColor(hex: string, amount = 0.38): string {
  const clean = hex.replace('#', '');
  const num = parseInt(clean.length === 3
    ? clean.split('').map(c => c + c).join('')
    : clean, 16);
  const r = Math.max(0, Math.round(((num >> 16) & 0xff) * (1 - amount)));
  const g = Math.max(0, Math.round(((num >> 8) & 0xff) * (1 - amount)));
  const b = Math.max(0, Math.round((num & 0xff) * (1 - amount)));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

interface PositionedApp extends Appuntamento {
  topPx: number;
  heightPx: number;
  layer: number;
  totalLayers: number;
}

interface Assenza {
  parrucchiere_id: string;
  data_inizio: string;
  data_fine: string;
  ora_inizio: string | null;
}

interface DragState {
  appId: string;
  parrId: string;
  offsetY: number; // px from top of appointment where user grabbed
  currentTop: number; // current ghost top in px relative to grid
  currentParrId: string;
  active: boolean;
}

interface Props {
  date: Date;
  onBack: () => void;
}

const PRESET_COLORS = ['#EC4899', '#3B82F6', '#F59E0B', '#EF4444', '#10B981', '#F97316', '#06B6D4', '#6B7280'];

export default function AgendaGiorno({ date, onBack }: Props) {
  const [parrucchieri, setParrucchieri] = useState<Parrucchiere[]>([]);
  const [appuntamenti, setAppuntamenti] = useState<Appuntamento[]>([]);
  const [clientiCarte, setClientiCarte] = useState<Map<string, Set<string>>>(new Map());
  const [compleanni, setCompleanni] = useState<{ nome: string; cognome: string; telefono?: string }[]>([]);
  const [messaggioAuguri, setMessaggioAuguri] = useState('Ciao {nome}! Ti auguriamo un felice compleanno! Tanti auguri da tutto il team!');
  const [editingMsg, setEditingMsg] = useState(false);
  const [msgDraft, setMsgDraft] = useState('');
  const [savingMsg, setSavingMsg] = useState(false);
  const compleanniKey = `compleanniDismissed_${date.toISOString().slice(0, 10)}`;
  const [compleanniDismissed, setCompleanniDismissed] = useState(() => sessionStorage.getItem(compleanniKey) === '1');
  const msgInputRef = useRef<HTMLTextAreaElement>(null);
  const [loading, setLoading] = useState(true);
  const [assenzeMap, setAssenzeMap] = useState<Map<string, string | null>>(new Map());
  const [catalogoPosa, setCatalogoPosa] = useState<Map<string, { inizio_posa: number; durata_posa: number }>>(new Map());
  const [clientiConFicheConvalidate, setClientiConFicheConvalidate] = useState<Set<string>>(new Set());

  const [richieste, setRichieste] = useState<RichiestaAppuntamento[]>([]);
  const [richiestaModal, setRichiestaModal] = useState<{ open: boolean; r: RichiestaAppuntamento | null; parrucchiereAssegnatoId?: string }>({ open: false, r: null });
  const [processingRichiesta, setProcessingRichiesta] = useState(false);
  const [whatsappPreview, setWhatsappPreview] = useState<{ open: boolean; testo: string; telefono: string } | null>(null);
  const [wpInviaPosizione, setWpInviaPosizione] = useState(false);
  const [wpLoadingPos, setWpLoadingPos] = useState(false);

  const [appModal, setAppModal] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });
  const [inForsePanel, setInForsePanel] = useState<{ open: boolean; appId: string | null }>({ open: false, appId: null });
  const [altriInForsePanel, setAltriInForsePanel] = useState<{ open: boolean; clienteNome: string; apps: Appuntamento[] }>({ open: false, clienteNome: '', apps: [] });
  const [multiModal, setMultiModal] = useState<{ open: boolean; date?: Date }>({ open: false });
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [hiddenParr, setHiddenParr] = useState<Set<string>>(new Set());
  const [editingParr, setEditingParr] = useState<{ open: boolean; id?: string; nome: string; colore: string }>({ open: false, nome: '', colore: '' });
  const [showSettings, setShowSettings] = useState(false);
  const [slotHeight, setSlotHeight] = useState(() => {
    const saved = localStorage.getItem('agenda_slotHeight');
    return saved ? Number(saved) : SLOT_HEIGHT_DEFAULT;
  });
  const [fontSize, setFontSize] = useState(() => {
    const saved = localStorage.getItem('agenda_fontSize');
    return saved ? Number(saved) : FONT_SIZE_DEFAULT;
  });
  const [startHour, setStartHour] = useState(() => {
    const saved = localStorage.getItem('agenda_startHour');
    return saved ? Number(saved) : 8;
  });
  const [endHour, setEndHour] = useState(() => {
    const saved = localStorage.getItem('agenda_endHour');
    return saved ? Number(saved) : 20;
  });
  const [clienteBold, setClienteBold] = useState(() => localStorage.getItem('agenda_cliente_bold') !== 'false');
  const [clienteItalic, setClienteItalic] = useState(() => localStorage.getItem('agenda_cliente_italic') === 'true');
  const [serviziBold, setServiziBold] = useState(() => localStorage.getItem('agenda_servizi_bold') === 'true');
  const [serviziItalic, setServiziItalic] = useState(() => localStorage.getItem('agenda_servizi_italic') === 'true');
  const [clienteSizeMul, setClienteSizeMul] = useState(() => {
    const saved = localStorage.getItem('agenda_cliente_size');
    return saved ? Number(saved) : 1.0;
  });
  const [serviziSizeMul, setServiziSizeMul] = useState(() => {
    const saved = localStorage.getItem('agenda_servizi_size');
    return saved ? Number(saved) : 1.0;
  });

  // Drag & drop state
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressModalOpen = useRef(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const pointerStartPos = useRef<{ x: number; y: number } | null>(null);
  const savingDrag = useRef(false);
  const visibleParrRef = useRef<Parrucchiere[]>([]);
  const lastTapRef = useRef<{ id: string; time: number } | null>(null);

  useEffect(() => { localStorage.setItem('agenda_slotHeight', String(slotHeight)); }, [slotHeight]);
  useEffect(() => { localStorage.setItem('agenda_fontSize', String(fontSize)); }, [fontSize]);
  useEffect(() => { localStorage.setItem('agenda_startHour', String(startHour)); }, [startHour]);
  useEffect(() => { localStorage.setItem('agenda_endHour', String(endHour)); }, [endHour]);
  useEffect(() => { localStorage.setItem('agenda_cliente_bold', String(clienteBold)); }, [clienteBold]);
  useEffect(() => { localStorage.setItem('agenda_cliente_italic', String(clienteItalic)); }, [clienteItalic]);
  useEffect(() => { localStorage.setItem('agenda_servizi_bold', String(serviziBold)); }, [serviziBold]);
  useEffect(() => { localStorage.setItem('agenda_servizi_italic', String(serviziItalic)); }, [serviziItalic]);
  useEffect(() => { localStorage.setItem('agenda_cliente_size', String(clienteSizeMul)); }, [clienteSizeMul]);
  useEffect(() => { localStorage.setItem('agenda_servizi_size', String(serviziSizeMul)); }, [serviziSizeMul]);

  const slots = getSlots(startHour, endHour);

  const load = useCallback(async () => {
    setLoading(true);
    const startOfDay = new Date(date); startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date); endOfDay.setHours(23, 59, 59, 999);
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

    const [parrRes, appRes, impostRes, scRes, prRes, assRes, catPosaRes] = await Promise.all([
      dbSelect({ table: 'parrucchieri', filters: [{ col: 'attivo', op: 'eq', val: true }], orderBy: [{ col: 'nome' }] }),
      dbSelectWithRelated({
        table: 'appuntamenti',
        columns: '*',
        filters: [
          { col: 'data_ora', op: 'gte', val: startOfDay.toISOString() },
          { col: 'data_ora', op: 'lte', val: endOfDay.toISOString() },
          { col: 'deleted_at', op: 'is_null' }
        ],
        orderBy: [{ col: 'data_ora' }],
        relations: [
          { key: 'clienti', table: 'clienti', fk: 'cliente_id', columns: 'id, nome, cognome, data_nascita, telefono' },
          { key: 'parrucchieri', table: 'parrucchieri', fk: 'parrucchiere_id', columns: '*' },
          { key: 'appuntamento_trattamenti', table: 'appuntamento_trattamenti', fk: 'id', many: true, manyFk: 'appuntamento_id', columns: 'nome_trattamento, prezzo, trattamento_id' }
        ],
        supabaseSelect: '*, clienti(id, nome, cognome, data_nascita, telefono), parrucchieri(*), appuntamento_trattamenti(nome_trattamento, prezzo, trattamento_id)'
      }),
      getImpostazione('messaggio_auguri'),
      dbSelect({ table: 'carte_sconto', columns: 'cliente_id, usa_e_getta, attiva', filters: [{ col: 'cliente_id', op: 'not_null' }, { col: 'attiva', op: 'eq', val: true }, { col: 'deleted_at', op: 'is_null' }] }),
      dbSelect({ table: 'carte_premium', columns: 'cliente_id, saldo, attiva', filters: [{ col: 'deleted_at', op: 'is_null' }, { col: 'attiva', op: 'eq', val: true }] }),
      dbSelect({ table: 'assenze_parrucchieri', columns: 'parrucchiere_id, data_inizio, data_fine, ora_inizio', filters: [{ col: 'data_inizio', op: 'lte', val: dateStr }, { col: 'data_fine', op: 'gte', val: dateStr }] }),
      dbSelect({ table: 'trattamenti_catalogo', columns: 'id, inizio_posa, durata_posa', filters: [{ col: 'inizio_posa', op: 'not_null' }, { col: 'durata_posa', op: 'not_null' }] })
    ]);

    if (impostRes) setMessaggioAuguri(impostRes);
    setParrucchieri((parrRes.data || []) as Parrucchiere[]);
    setAppuntamenti((appRes.data || []) as Appuntamento[]);

    const posaMap = new Map<string, { inizio_posa: number; durata_posa: number }>();
    for (const r of (catPosaRes.data || []) as { id: string; inizio_posa: number; durata_posa: number }[]) {
      if (r.inizio_posa != null && r.durata_posa != null) posaMap.set(r.id, { inizio_posa: r.inizio_posa, durata_posa: r.durata_posa });
    }
    setCatalogoPosa(posaMap);

    const carteMap = new Map<string, Set<string>>();
    const addCarta = (clienteId: string, tipo: string) => {
      if (!carteMap.has(clienteId)) carteMap.set(clienteId, new Set());
      carteMap.get(clienteId)!.add(tipo);
    };
    for (const r of (scRes.data || []) as { cliente_id: string; usa_e_getta: boolean }[]) {
      if (r.cliente_id) addCarta(r.cliente_id, r.usa_e_getta ? 'sconto_ueg' : 'sconto_normale');
    }
    for (const r of (prRes.data || []) as { cliente_id: string; saldo: number; attiva: boolean }[]) {
      if (r.cliente_id) addCarta(r.cliente_id, (r.saldo <= 0 || !r.attiva) ? 'premium_vuota' : 'premium');
    }
    setClientiCarte(carteMap);

    const aMap = new Map<string, string | null>();
    for (const a of (assRes.data || []) as Assenza[]) {
      const ora = a.ora_inizio ? a.ora_inizio.substring(0, 5) : null;
      if (!aMap.has(a.parrucchiere_id) || aMap.get(a.parrucchiere_id) !== null) {
        aMap.set(a.parrucchiere_id, ora);
      }
    }
    setAssenzeMap(aMap);

    const dayMM = String(date.getMonth() + 1).padStart(2, '0');
    const dayDD = String(date.getDate()).padStart(2, '0');
    const tuttiClientiRes = await dbSelect({
      table: 'clienti',
      columns: 'id, nome, cognome, telefono, data_nascita',
      filters: [{ col: 'data_nascita', op: 'not_null' }]
    });
    const uniciBirthday = new Map<string, { nome: string; cognome: string; telefono?: string }>();
    for (const c of (tuttiClientiRes.data || []) as { id: string; nome: string; cognome: string; telefono?: string; data_nascita: string }[]) {
      const [, mm, dd] = c.data_nascita.split('-');
      if (mm === dayMM && dd === dayDD) uniciBirthday.set(c.id, { nome: c.nome, cognome: c.cognome, telefono: c.telefono || undefined });
    }
    setCompleanni(Array.from(uniciBirthday.values()));

    const { data: ficheConv } = await dbSelect({ table: 'fiches', columns: 'appuntamento_id', filters: [{ col: 'convalidata', op: 'eq', val: true }] });
    const appIdsConFiche = ((ficheConv || []) as { appuntamento_id: string }[]).map(f => f.appuntamento_id).filter(Boolean);
    const clientiConFiche = new Set<string>();
    if (appIdsConFiche.length > 0) {
      const { data: appsConFiche } = await dbSelect({ table: 'appuntamenti', columns: 'cliente_id', filters: [{ col: 'id', op: 'in', val: appIdsConFiche }] });
      for (const a of (appsConFiche || []) as { cliente_id: string | null }[]) {
        if (a.cliente_id) clientiConFiche.add(a.cliente_id);
      }
    }
    setClientiConFicheConvalidate(clientiConFiche);

    setLoading(false);
  }, [date]);

  const loadRichieste = useCallback(async () => {
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const dayStart = new Date(date); dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date); dayEnd.setHours(23, 59, 59, 999);

    const { data } = await supabase
      .from('richieste_appuntamento')
      .select('*, trattamenti_catalogo_main:servizio_id(nome,durata_minuti), trattamenti_catalogo_2:servizio2_id(nome,durata_minuti)')
      .eq('stato', 'in_attesa')
      .gte('data_ora', dayStart.toISOString())
      .lte('data_ora', dayEnd.toISOString());

    const mapped: RichiestaAppuntamento[] = (data || []).map((r: Record<string, unknown>) => ({
      id: r.id as string,
      nome: r.nome as string,
      cognome: r.cognome as string,
      telefono: r.telefono as string,
      parrucchiere_id: r.parrucchiere_id as string | null,
      servizio_id: r.servizio_id as string,
      data_ora: r.data_ora as string,
      parrucchiere2_id: r.parrucchiere2_id as string | null,
      servizio2_id: r.servizio2_id as string | null,
      data_ora2: r.data_ora2 as string | null,
      stato: r.stato as 'in_attesa',
      cliente_id: r.cliente_id as string | null,
      chiunque: (r.chiunque as boolean) ?? false,
      parrucchieri_candidati: (r.parrucchieri_candidati as string[] | null) ?? null,
      servizio_nome: (r.trattamenti_catalogo_main as { nome?: string } | null)?.nome,
      servizio2_nome: (r.trattamenti_catalogo_2 as { nome?: string } | null)?.nome,
      durata_minuti: (r.trattamenti_catalogo_main as { durata_minuti?: number } | null)?.durata_minuti ?? 60,
      durata2_minuti: (r.trattamenti_catalogo_2 as { durata_minuti?: number } | null)?.durata_minuti ?? 30,
    }));
    setRichieste(mapped);
  }, [date]);

  useEffect(() => { load(); loadRichieste(); }, [load, loadRichieste]);

  async function saveMessaggio() {
    setSavingMsg(true);
    const { data: { user } } = await supabase.auth.getUser();
    await setImpostazione('messaggio_auguri', msgDraft, user?.id);
    setMessaggioAuguri(msgDraft);
    setSavingMsg(false);
    setEditingMsg(false);
  }

  function openEditMsg() {
    setMsgDraft(messaggioAuguri);
    setEditingMsg(true);
    setTimeout(() => msgInputRef.current?.focus(), 50);
  }

  function appToMinutes(app: Appuntamento): { start: number; end: number } {
    const t = new Date(app.data_ora);
    const start = t.getHours() * 60 + t.getMinutes();
    return { start, end: start + app.durata_minuti };
  }

  function positionAppsForParr(parrId: string): PositionedApp[] {
    const filtered = appuntamenti
      .filter(a => a.parrucchiere_id === parrId)
      .map(a => {
        const t = new Date(a.data_ora);
        const startMin = t.getHours() * 60 + t.getMinutes();
        const dayStart = startHour * 60;
        const topPx = ((startMin - dayStart) / SLOT_DURATION) * slotHeight;
        const heightPx = Math.max((a.durata_minuti / SLOT_DURATION) * slotHeight, slotHeight);
        return { ...a, topPx, heightPx, layer: 0, totalLayers: 1 };
      })
      .sort((a, b) => new Date(a.data_ora).getTime() - new Date(b.data_ora).getTime());

    const groups: PositionedApp[][] = [];
    for (const app of filtered) {
      const { start: aStart, end: aEnd } = appToMinutes(app);
      let placed = false;
      for (const group of groups) {
        const overlaps = group.some(g => {
          const { start: gStart, end: gEnd } = appToMinutes(g);
          return aStart < gEnd && aEnd > gStart;
        });
        if (overlaps) {
          app.layer = group.length;
          group.push(app);
          placed = true;
          break;
        }
      }
      if (!placed) {
        app.layer = 0;
        groups.push([app]);
      }
    }

    for (const group of groups) {
      const max = group.length;
      for (const app of group) app.totalLayers = max;
    }

    return filtered;
  }

  async function confermaRichiesta(r: RichiestaAppuntamento, parrucchiereAssegnatoId?: string) {
    setProcessingRichiesta(true);

    // Get message templates from impostazioni
    const { data: { user } } = await supabase.auth.getUser();
    const { data: msgData } = await supabase
      .from('impostazioni')
      .select('chiave,valore')
      .in('chiave', ['msg_conferma_appuntamento_online', 'msg_rifiuto_appuntamento_online', 'indirizzo_salone'])
      .eq('user_id', user?.id ?? '');

    const templates: Record<string, string> = {};
    for (const row of msgData ?? []) templates[row.chiave] = row.valore;

    const msgTemplate = templates['msg_conferma_appuntamento_online'] ||
      'Ciao {nome}! La tua prenotazione per {servizio} il {data} alle {ora} è confermata. Ti aspettiamo!';

    const dataFmt = new Date(r.data_ora).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
    const oraFmt = new Date(r.data_ora).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    const posizione = templates['indirizzo_salone'] ?? '';
    const msg = msgTemplate
      .replace(/\{nome\}/g, r.nome)
      .replace(/\{cognome\}/g, r.cognome)
      .replace(/\{servizio\}/g, r.servizio_nome ?? 'appuntamento')
      .replace(/\{data\}/g, dataFmt)
      .replace(/\{ora\}/g, oraFmt)
      .replace(/\{posizione\}/g, posizione);

    // Risolvi il cliente_id locale: verifica che esista in SQLite,
    // perché l'UUID Supabase potrebbe non corrispondere a quello locale se la sync è incompleta
    const stripPhone = (t: string) => t.replace(/\D/g, '').replace(/^39/, '');
    let clienteId: string | null = r.cliente_id ?? null;

    // Se abbiamo un cliente_id da Supabase, verifica che esista anche localmente
    let clienteLocaleVerificato = false;
    if (clienteId) {
      const { data: check } = await dbSelect({
        table: 'clienti',
        filters: [{ col: 'id', op: 'eq', val: clienteId }],
        limit: 1,
      });
      clienteLocaleVerificato = !!check?.[0];
      if (!clienteLocaleVerificato) clienteId = null; // UUID non trovato localmente, cerca per altri criteri
    }

    // Se non abbiamo un cliente_id valido localmente, cerca per telefono o nome+cognome
    if (!clienteLocaleVerificato && (r.nome || r.telefono)) {
      const telKey = r.telefono ? stripPhone(r.telefono) : '';

      const { data: tuttiClienti } = await dbSelect({
        table: 'clienti',
        filters: [{ col: 'deleted_at', op: 'is_null' }],
      });
      const clienti = (tuttiClienti ?? []) as Record<string, unknown>[];

      // 1. Match per telefono (ultimi 9 cifre normalizzate)
      let trovato: Record<string, unknown> | undefined;
      if (telKey.length >= 6) {
        const telSuffix = telKey.slice(-9);
        trovato = clienti.find(c => {
          const ct = stripPhone(String(c.telefono ?? '')).slice(-9);
          return ct.length >= 6 && ct === telSuffix;
        });
      }
      // 2. Fallback: match per nome + cognome (case-insensitive)
      if (!trovato && r.nome) {
        const nNorm = r.nome.trim().toLowerCase();
        const cNorm = (r.cognome ?? '').trim().toLowerCase();
        trovato = clienti.find(c =>
          String(c.nome ?? '').toLowerCase() === nNorm &&
          String(c.cognome ?? '').toLowerCase() === cNorm
        );
      }

      if (trovato) {
        clienteId = trovato.id as string;
      } else if (!clienteId) {
        // Crea nuovo cliente solo se non trovato in nessun modo
        const { data: newCliente } = await dbInsert({
          table: 'clienti',
          data: {
            nome: (r.nome ?? '').trim(),
            cognome: (r.cognome ?? '').trim(),
            telefono: r.telefono?.replace(/\s/g, '') ?? '',
            user_id: user?.id,
          },
        });
        clienteId = (newCliente as Record<string, unknown> | null)?.id as string | null ?? null;
      }
    }

    // Per richieste "chiunque", usa il parrucchiere della colonna cliccata
    const effectiveParrId = r.chiunque ? (parrucchiereAssegnatoId ?? r.parrucchiere_id) : r.parrucchiere_id;

    // Determina se il cliente è nuovo (0 fiches convalidate)
    let nuovaCliente = false;
    if (clienteId) {
      const { data: prevApps } = await dbSelect({
        table: 'appuntamenti',
        columns: 'id',
        filters: [{ col: 'cliente_id', op: 'eq', val: clienteId }],
      });
      const prevAppIds = ((prevApps || []) as { id: string }[]).map(a => a.id);
      if (prevAppIds.length === 0) {
        nuovaCliente = true;
      } else {
        const { data: fichesConvalidate } = await dbSelect({
          table: 'fiches',
          columns: 'id',
          filters: [
            { col: 'appuntamento_id', op: 'in', val: prevAppIds },
            { col: 'convalidata', op: 'eq', val: true },
          ],
        });
        nuovaCliente = (fichesConvalidate || []).length === 0;
      }
    } else {
      nuovaCliente = true;
    }

    // Crea appuntamento con lo stesso flusso di AppuntamentoModal.handleSave
    // (dbInsert gestisce sia SQLite/Electron che IndexedDB+Supabase/browser)
    const { data: app1Data } = await dbInsert({
      table: 'appuntamenti',
      data: {
        cliente_id: clienteId,
        parrucchiere_id: effectiveParrId,
        data_ora: r.data_ora,
        durata_minuti: r.durata_minuti ?? 60,
        stato: 'confermato',
        note: `Prenotazione online — ${r.nome} ${r.cognome} (${r.telefono})`,
        prezzo_totale: 0,
        user_id: user?.id,
        updated_at: new Date().toISOString(),
        nuova_cliente: nuovaCliente,
      },
    });

    const app1Id = (app1Data as Record<string, unknown> | null)?.id as string | undefined;
    if (app1Id && r.servizio_nome) {
      let prezzo1 = 0;
      if (r.servizio_id) {
        const { data: cat1 } = await dbSelect({ table: 'trattamenti_catalogo', filters: [{ col: 'id', op: 'eq', val: r.servizio_id }], limit: 1 });
        prezzo1 = (cat1?.[0] as Record<string, unknown> | undefined)?.prezzo as number ?? 0;
      }
      await dbInsert({
        table: 'appuntamento_trattamenti',
        data: {
          appuntamento_id: app1Id,
          trattamento_id: r.servizio_id || null,
          nome_trattamento: r.servizio_nome,
          prezzo: prezzo1,
          user_id: user?.id,
        },
      });
    }

    if (r.parrucchiere2_id && r.data_ora2) {
      const { data: app2Data } = await dbInsert({
        table: 'appuntamenti',
        data: {
          cliente_id: clienteId,
          parrucchiere_id: r.parrucchiere2_id,
          data_ora: r.data_ora2,
          durata_minuti: r.durata2_minuti ?? 30,
          stato: 'confermato',
          note: `Prenotazione online (abbinato) — ${r.nome} ${r.cognome}`,
          prezzo_totale: 0,
          user_id: user?.id,
          updated_at: new Date().toISOString(),
          nuova_cliente: nuovaCliente,
        },
      });

      const app2Id = (app2Data as Record<string, unknown> | null)?.id as string | undefined;
      if (app2Id && r.servizio2_nome) {
        let prezzo2 = 0;
        if (r.servizio2_id) {
          const { data: cat2 } = await dbSelect({ table: 'trattamenti_catalogo', filters: [{ col: 'id', op: 'eq', val: r.servizio2_id }], limit: 1 });
          prezzo2 = (cat2?.[0] as Record<string, unknown> | undefined)?.prezzo as number ?? 0;
        }
        await dbInsert({
          table: 'appuntamento_trattamenti',
          data: {
            appuntamento_id: app2Id,
            trattamento_id: r.servizio2_id || null,
            nome_trattamento: r.servizio2_nome,
            prezzo: prezzo2,
            user_id: user?.id,
          },
        });
      }
    }

    // Segna richiesta come confermata
    await supabase.from('richieste_appuntamento').update({ stato: 'confermata' }).eq('id', r.id);

    setProcessingRichiesta(false);
    setRichiestaModal({ open: false, r: null });
    loadRichieste();
    load();

    setWhatsappPreview({ open: true, testo: msg, telefono: r.telefono });
  }

  async function rifiutaRichiesta(r: RichiestaAppuntamento) {
    setProcessingRichiesta(true);

    const { data: { user } } = await supabase.auth.getUser();
    const { data: msgData } = await supabase
      .from('impostazioni')
      .select('chiave,valore')
      .in('chiave', ['msg_rifiuto_appuntamento_online'])
      .eq('user_id', user?.id ?? '');

    const templates: Record<string, string> = {};
    for (const row of msgData ?? []) templates[row.chiave] = row.valore;

    const msgTemplate = templates['msg_rifiuto_appuntamento_online'] ||
      'Ciao {nome}, purtroppo non possiamo confermare la prenotazione richiesta. Ti chiediamo di contattarci per trovare un orario alternativo.';

    const msg = msgTemplate
      .replace(/\{nome\}/g, r.nome)
      .replace(/\{cognome\}/g, r.cognome)
      .replace(/\{servizio\}/g, r.servizio_nome ?? 'appuntamento');

    await supabase.from('richieste_appuntamento').update({ stato: 'rifiutata' }).eq('id', r.id);

    setProcessingRichiesta(false);
    setRichiestaModal({ open: false, r: null });
    loadRichieste();

    setWhatsappPreview({ open: true, testo: msg, telefono: r.telefono });
  }

  async function deleteAppuntamento(id: string) {
    await dbDelete({ table: 'appuntamenti', filters: [{ col: 'id', op: 'eq', val: id }] });
    setConfirmDelete(null);
    load();
  }

  async function checkAltriInForse(clienteId: string, clienteNome: string, excludeId: string) {
    const { data } = await dbSelect({
      table: 'appuntamenti',
      columns: 'id, cliente_id, data_ora, durata_minuti, stato, note, prezzo_totale, created_at, updated_at',
      filters: [
        { col: 'cliente_id', op: 'eq', val: clienteId },
        { col: 'stato', op: 'eq', val: 'in_forse' },
        { col: 'deleted_at', op: 'is_null' },
      ],
      orderBy: [{ col: 'data_ora' }],
    });
    const others = ((data || []) as Appuntamento[]).filter(a => a.id !== excludeId);
    if (others.length > 0) {
      setAltriInForsePanel({ open: true, clienteNome, apps: others });
    }
  }

  async function fissaAppuntamento(id: string) {
    const app = appuntamenti.find(a => a.id === id);
    const clienteId = app?.cliente_id;
    const cliente = app?.clienti;
    const clienteNome = cliente ? `${cliente.nome} ${cliente.cognome}` : '';
    await dbUpdate({ table: 'appuntamenti', id, data: { stato: 'confermato' } });
    setInForsePanel({ open: false, appId: null });
    load();
    if (clienteId) await checkAltriInForse(clienteId, clienteNome, id);
  }

  async function cancellaInForse(id: string) {
    const app = appuntamenti.find(a => a.id === id);
    const clienteId = app?.cliente_id;
    const cliente = app?.clienti;
    const clienteNome = cliente ? `${cliente.nome} ${cliente.cognome}` : '';
    await dbDelete({ table: 'appuntamenti', filters: [{ col: 'id', op: 'eq', val: id }] });
    setInForsePanel({ open: false, appId: null });
    load();
    if (clienteId) await checkAltriInForse(clienteId, clienteNome, id);
  }

  async function fissaInForseFromPanel(appId: string) {
    await dbUpdate({ table: 'appuntamenti', id: appId, data: { stato: 'confermato' } });
    setAltriInForsePanel(prev => ({ ...prev, apps: prev.apps.filter(a => a.id !== appId) }));
    load();
  }

  async function cancellaInForseFromPanel(appId: string) {
    await dbDelete({ table: 'appuntamenti', filters: [{ col: 'id', op: 'eq', val: appId }] });
    setAltriInForsePanel(prev => ({ ...prev, apps: prev.apps.filter(a => a.id !== appId) }));
    load();
  }

  function modificaInForseFromPanel(appId: string) {
    setAltriInForsePanel({ open: false, clienteNome: '', apps: [] });
    setAppModal({ open: true, id: appId });
  }

  async function updateParrName() {
    if (!editingParr.id || !editingParr.nome.trim()) return;
    await dbUpdate({ table: 'parrucchieri', id: editingParr.id, data: { nome: editingParr.nome.trim(), colore: editingParr.colore } });
    setEditingParr({ open: false, nome: '', colore: '' });
    load();
  }

  // ── Drag & Drop ──────────────────────────────────────────────────────────

  function getGridTopForPointer(clientY: number): number {
    if (!gridRef.current) return 0;
    const rect = gridRef.current.getBoundingClientRect();
    return clientY - rect.top + gridRef.current.scrollTop;
  }

  function getParrIndexForPointer(clientX: number, parrCount: number): number {
    if (!gridRef.current || parrCount === 0) return -1;
    const rect = gridRef.current.getBoundingClientRect();
    const x = clientX - rect.left + gridRef.current.scrollLeft - 64;
    const available = gridRef.current.scrollWidth - 64;
    const idx = Math.floor(x / (available / parrCount));
    return Math.max(0, Math.min(parrCount - 1, idx));
  }

  function snapTopToSlot(topPx: number): number {
    const slotIndex = Math.round(topPx / slotHeight);
    return slotIndex * slotHeight;
  }

  function topPxToTime(topPx: number): Date {
    const totalMinutes = startHour * 60 + Math.round(topPx / slotHeight) * SLOT_DURATION;
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    const d = new Date(date);
    d.setHours(Math.min(23, Math.max(0, h)), Math.min(59, Math.max(0, m)), 0, 0);
    return d;
  }

  function startLongPress(
    e: React.PointerEvent,
    app: PositionedApp,
    parrId: string
  ) {
    if (drag) return;
    if (navigator.maxTouchPoints > 0 || 'ontouchstart' in window) return;
    pointerStartPos.current = { x: e.clientX, y: e.clientY };

    longPressTimer.current = setTimeout(() => {
      isDragging.current = true;
      const gridTop = getGridTopForPointer(e.clientY);
      const offsetY = gridTop - app.topPx;
      const state: DragState = {
        appId: app.id,
        parrId,
        offsetY,
        currentTop: app.topPx,
        currentParrId: parrId,
        active: true,
      };
      dragRef.current = state;
      setDrag({ ...state });
      // vibrate if supported
      if (navigator.vibrate) navigator.vibrate(60);
    }, LONG_PRESS_MS);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!isDragging.current || !dragRef.current) return;

    // Cancel long press if still pending and pointer moved significantly
    if (longPressTimer.current && pointerStartPos.current) {
      const dx = Math.abs(e.clientX - pointerStartPos.current.x);
      const dy = Math.abs(e.clientY - pointerStartPos.current.y);
      if (dx > 8 || dy > 8) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
    }

    if (!isDragging.current) return;

    const vp = visibleParrRef.current;
    const gridTop = getGridTopForPointer(e.clientY);
    const newTop = Math.max(0, gridTop - dragRef.current.offsetY);
    const parrIdx = getParrIndexForPointer(e.clientX, vp.length);
    const newParrId = vp[parrIdx]?.id ?? dragRef.current.currentParrId;

    dragRef.current = { ...dragRef.current, currentTop: newTop, currentParrId: newParrId };
    setDrag({ ...dragRef.current });
  }

  function cancelDrag() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    isDragging.current = false;
    dragRef.current = null;
    setDrag(null);
  }

  async function commitDrag() {
    if (!dragRef.current || savingDrag.current) { cancelDrag(); return; }
    savingDrag.current = true;

    const { appId, currentTop, currentParrId } = dragRef.current;
    const snapped = snapTopToSlot(currentTop);
    const newTime = topPxToTime(snapped);

    cancelDrag();

    await dbUpdate({
      table: 'appuntamenti',
      id: appId,
      data: {
        data_ora: newTime.toISOString(),
        parrucchiere_id: currentParrId
      }
    });

    savingDrag.current = false;
    load();
  }

  function onPointerUp() {
    if (isDragging.current && dragRef.current) {
      commitDrag();
    } else {
      cancelDrag();
    }
  }

  // ─────────────────────────────────────────────────────────────────────────

  const visibleParr = parrucchieri.filter(p =>
    !hiddenParr.has(p.id) && !(assenzeMap.has(p.id) && assenzeMap.get(p.id) === null)
  );
  visibleParrRef.current = visibleParr;
  const gridHeight = slots.length * slotHeight;

  // Ghost appointment data
  const dragApp = drag ? appuntamenti.find(a => a.id === drag.appId) : null;
  const dragParr = drag ? parrucchieri.find(p => p.id === drag.currentParrId) : null;
  const dragParrIdx = drag && dragParr ? visibleParr.findIndex(p => p.id === drag.currentParrId) : -1;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-7 h-7 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-px md:px-4 md:py-px bg-white border-b border-stone-200 flex-shrink-0">
        {compleanni.length > 0 && !compleanniDismissed && (
          <div className="mb-2 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Cake size={14} className="text-rose-500 flex-shrink-0" />
                <p className="text-sm text-rose-700 font-semibold">Oggi è il compleanno di:</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={openEditMsg}
                  className="flex items-center gap-1 text-xs text-rose-400 hover:text-rose-600 transition-colors"
                >
                  <Pencil size={11} />
                  <span>Modifica messaggio</span>
                </button>
                <button
                  onClick={() => { sessionStorage.setItem(compleanniKey, '1'); setCompleanniDismissed(true); }}
                  className="p-0.5 rounded text-rose-300 hover:text-rose-600 hover:bg-rose-100 transition-colors"
                  title="Chiudi"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {compleanni.map((c, i) => {
                const tel = c.telefono?.replace(/\s+/g, '').replace(/^00/, '+').replace(/^0/, '+39');
                const waNum = tel?.startsWith('+') ? tel.replace('+', '') : tel ? `39${tel}` : null;
                const testo = messaggioAuguri.replace(/\{nome\}/g, c.nome).replace(/\{cognome\}/g, c.cognome).replace(/\{nome_cognome\}/g, `${c.nome} ${c.cognome}`);
                const hasTel = !!waNum;
                return (
                  <div key={i} className="flex items-center gap-2 bg-white border border-rose-200 rounded-lg px-3 py-1.5">
                    <span className="text-sm font-medium text-rose-800">{c.nome} {c.cognome}</span>
                    {hasTel ? (
                      <button
                        onClick={() => apriWhatsApp(c.telefono!, testo)}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#25D366] hover:bg-[#1ebe5d] text-white text-xs font-semibold transition-colors"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                        </svg>
                        Auguri
                      </button>
                    ) : (
                      <span className="text-xs text-rose-400 italic">nessun numero</span>
                    )}
                  </div>
                );
              })}
            </div>

            {editingMsg && (
              <div className="bg-white border border-rose-200 rounded-xl p-3 space-y-2 mt-1">
                <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide">
                  Messaggio di auguri — usa <code className="bg-stone-100 px-1 rounded">{'{nome}'}</code> per il nome della cliente
                </p>
                <textarea
                  ref={msgInputRef}
                  value={msgDraft}
                  onChange={e => setMsgDraft(e.target.value)}
                  rows={3}
                  className="w-full text-sm border border-stone-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-400 text-stone-700"
                />
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setEditingMsg(false)}
                    className="px-3 py-1.5 text-xs font-medium text-stone-600 border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors"
                  >
                    Annulla
                  </button>
                  <button
                    onClick={saveMessaggio}
                    disabled={savingMsg || !msgDraft.trim()}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-lg transition-colors"
                  >
                    <Check size={12} />
                    {savingMsg ? 'Salvataggio...' : 'Salva'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-1.5 flex-wrap">
          <button onClick={onBack} className="p-1 rounded-lg hover:bg-stone-100 transition-colors flex-shrink-0">
            <ChevronLeft size={18} />
          </button>
          <h1 className="font-bold text-stone-800 capitalize text-sm flex-shrink-0">
            {date.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
          </h1>
          <div className="w-px h-4 bg-stone-200 flex-shrink-0" />
          {/* bottoni parrucchieri */}
          <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-0">
            {parrucchieri.map(p => {
              const assenteOggi = assenzeMap.has(p.id) && assenzeMap.get(p.id) === null;
              const assenteDopo = assenzeMap.has(p.id) && assenzeMap.get(p.id) !== null;
              return (
                <button
                  key={p.id}
                  onClick={() => {
                    if (assenteOggi) return;
                    setHiddenParr(prev => {
                      const next = new Set(prev);
                      next.has(p.id) ? next.delete(p.id) : next.add(p.id);
                      return next;
                    });
                  }}
                  title={assenteOggi ? 'Assente oggi' : assenteDopo ? `Assente dalle ${assenzeMap.get(p.id)}` : undefined}
                  className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-xs font-medium transition-all"
                  style={{
                    borderColor: assenteOggi ? '#fca5a5' : hiddenParr.has(p.id) ? '#d1d5db' : p.colore,
                    backgroundColor: assenteOggi ? '#fef2f2' : hiddenParr.has(p.id) ? '#f9fafb' : `${p.colore}18`,
                    color: assenteOggi ? '#ef4444' : hiddenParr.has(p.id) ? '#9ca3af' : p.colore,
                    cursor: assenteOggi ? 'default' : 'pointer',
                  }}
                >
                  <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: assenteOggi ? '#ef4444' : hiddenParr.has(p.id) ? '#d1d5db' : p.colore }} />
                  {p.nome}
                  {assenteOggi && <span className="text-[9px] font-bold uppercase tracking-wide opacity-70">Assente</span>}
                  {assenteDopo && <span className="text-[9px] font-semibold opacity-60">dalle {assenzeMap.get(p.id)}</span>}
                </button>
              );
            })}
          </div>
          <button
            onClick={() => setShowSettings(s => !s)}
            className={`p-1.5 rounded-lg border transition-all flex-shrink-0 ${showSettings ? 'bg-amber-50 border-amber-300 text-amber-600' : 'border-stone-200 text-stone-400 hover:text-stone-700 hover:bg-stone-50'}`}
            title="Impostazioni visualizzazione"
          >
            <Settings size={14} />
          </button>
        </div>

        {showSettings && (
          <div className="mt-3 bg-stone-50 border border-stone-200 rounded-xl px-4 py-4 space-y-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-stone-500 uppercase tracking-wide">Visualizzazione agenda</span>
              <button
                onClick={() => {
                  setSlotHeight(SLOT_HEIGHT_DEFAULT);
                  setFontSize(FONT_SIZE_DEFAULT);
                  setStartHour(8);
                  setEndHour(20);
                  setClienteBold(true);
                  setClienteItalic(false);
                  setServiziBold(false);
                  setServiziItalic(false);
                  setClienteSizeMul(1.0);
                  setServiziSizeMul(1.0);
                }}
                className="text-xs text-stone-400 hover:text-amber-600 transition-colors font-medium"
              >
                Ripristina
              </button>
            </div>

            {/* Ore visibili */}
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <CalendarClock size={13} className="text-stone-500" />
                <span className="text-xs font-semibold text-stone-700">Ore visibili in agenda</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-stone-500">Dalle</span>
                <select
                  value={startHour}
                  onChange={e => { const v = Number(e.target.value); if (v < endHour) setStartHour(v); }}
                  className="text-xs border border-stone-200 bg-white rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-200 text-stone-700"
                >
                  {(() => {
                    const opts: Array<{ value: number; label: string }> = [];
                    for (let h = 0; h < 24; h++) {
                      opts.push({ value: h, label: `${String(h).padStart(2, '0')}:00` });
                      if (h === 8) opts.push({ value: 8.5, label: '08:30' });
                    }
                    return opts.filter(o => o.value < endHour).map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ));
                  })()}
                </select>
                <span className="text-xs text-stone-500">alle</span>
                <select
                  value={endHour}
                  onChange={e => { const v = Number(e.target.value); if (v > startHour) setEndHour(v); }}
                  className="text-xs border border-stone-200 bg-white rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-200 text-stone-700"
                >
                  {Array.from({ length: 24 }, (_, i) => i + 1).filter(h => h > startHour).map(h => (
                    <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Zoom */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <ZoomIn size={13} className="text-stone-500" />
                  <span className="text-xs font-semibold text-stone-700">Zoom agenda</span>
                </div>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={Math.round((SLOT_HEIGHT_MIN / SLOT_HEIGHT_DEFAULT) * 100)}
                    max={Math.round((SLOT_HEIGHT_MAX / SLOT_HEIGHT_DEFAULT) * 100)}
                    value={Math.round((slotHeight / SLOT_HEIGHT_DEFAULT) * 100)}
                    onChange={e => {
                      const pct = Math.max(Math.round((SLOT_HEIGHT_MIN / SLOT_HEIGHT_DEFAULT) * 100), Math.min(Math.round((SLOT_HEIGHT_MAX / SLOT_HEIGHT_DEFAULT) * 100), Number(e.target.value)));
                      setSlotHeight(Math.round((pct / 100) * SLOT_HEIGHT_DEFAULT));
                    }}
                    className="w-14 text-xs font-mono text-stone-500 bg-white border border-stone-200 px-1.5 py-0.5 rounded-md text-center focus:outline-none focus:ring-2 focus:ring-amber-200"
                  />
                  <span className="text-xs text-stone-400">%</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => setSlotHeight(h => Math.max(SLOT_HEIGHT_MIN, h - 4))} disabled={slotHeight <= SLOT_HEIGHT_MIN} className="p-1.5 rounded-lg border border-stone-200 bg-white text-stone-600 hover:bg-stone-100 disabled:opacity-30 transition-colors flex-shrink-0">
                  <ZoomOut size={14} />
                </button>
                <input type="range" min={SLOT_HEIGHT_MIN} max={SLOT_HEIGHT_MAX} step={1} value={slotHeight} onChange={e => setSlotHeight(Number(e.target.value))} className="flex-1 accent-amber-500" />
                <button onClick={() => setSlotHeight(h => Math.min(SLOT_HEIGHT_MAX, h + 4))} disabled={slotHeight >= SLOT_HEIGHT_MAX} className="p-1.5 rounded-lg border border-stone-200 bg-white text-stone-600 hover:bg-stone-100 disabled:opacity-30 transition-colors flex-shrink-0">
                  <ZoomIn size={14} />
                </button>
              </div>
            </div>

            {/* Dimensione testo globale */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <Type size={13} className="text-stone-500" />
                  <span className="text-xs font-semibold text-stone-700">Dimensione testo globale</span>
                </div>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={FONT_SIZE_MIN}
                    max={FONT_SIZE_MAX}
                    value={fontSize}
                    onChange={e => setFontSize(Math.max(FONT_SIZE_MIN, Math.min(FONT_SIZE_MAX, Number(e.target.value))))}
                    className="w-14 text-xs font-mono text-stone-500 bg-white border border-stone-200 px-1.5 py-0.5 rounded-md text-center focus:outline-none focus:ring-2 focus:ring-amber-200"
                  />
                  <span className="text-xs text-stone-400">%</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => setFontSize(f => Math.max(FONT_SIZE_MIN, f - 5))} disabled={fontSize <= FONT_SIZE_MIN} className="p-1.5 rounded-lg border border-stone-200 bg-white text-stone-500 hover:bg-stone-100 disabled:opacity-30 transition-colors flex-shrink-0 font-bold text-xs">A-</button>
                <input type="range" min={FONT_SIZE_MIN} max={FONT_SIZE_MAX} step={5} value={fontSize} onChange={e => setFontSize(Number(e.target.value))} className="flex-1 accent-amber-500" />
                <button onClick={() => setFontSize(f => Math.min(FONT_SIZE_MAX, f + 5))} disabled={fontSize >= FONT_SIZE_MAX} className="p-1.5 rounded-lg border border-stone-200 bg-white text-stone-600 hover:bg-stone-100 disabled:opacity-30 transition-colors flex-shrink-0 font-bold text-xs">A+</button>
              </div>
            </div>

            {/* Stile nome cliente */}
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <User size={13} className="text-stone-500" />
                <span className="text-xs font-semibold text-stone-700">Nome cliente</span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button onClick={() => setClienteBold(b => !b)} className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors ${clienteBold ? 'bg-amber-50 border-amber-400 text-amber-700' : 'bg-white border-stone-200 text-stone-500'}`}>B</button>
                <button onClick={() => setClienteItalic(b => !b)} className={`px-2.5 py-1 rounded-lg text-xs italic border transition-colors ${clienteItalic ? 'bg-amber-50 border-amber-400 text-amber-700' : 'bg-white border-stone-200 text-stone-500'}`}>I</button>
                <input
                  type="range" min={0.7} max={1.5} step={0.05}
                  value={clienteSizeMul}
                  onChange={e => setClienteSizeMul(Number(e.target.value))}
                  className="flex-1 accent-amber-500 min-w-[80px]"
                />
                <span className="text-xs font-mono text-stone-400 w-10 text-right">{Math.round(clienteSizeMul * 100)}%</span>
              </div>
            </div>

            {/* Stile servizi */}
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Type size={13} className="text-stone-500" />
                <span className="text-xs font-semibold text-stone-700">Servizi</span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button onClick={() => setServiziBold(b => !b)} className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors ${serviziBold ? 'bg-amber-50 border-amber-400 text-amber-700' : 'bg-white border-stone-200 text-stone-500'}`}>B</button>
                <button onClick={() => setServiziItalic(b => !b)} className={`px-2.5 py-1 rounded-lg text-xs italic border transition-colors ${serviziItalic ? 'bg-amber-50 border-amber-400 text-amber-700' : 'bg-white border-stone-200 text-stone-500'}`}>I</button>
                <input
                  type="range" min={0.7} max={1.5} step={0.05}
                  value={serviziSizeMul}
                  onChange={e => setServiziSizeMul(Number(e.target.value))}
                  className="flex-1 accent-amber-500 min-w-[80px]"
                />
                <span className="text-xs font-mono text-stone-400 w-10 text-right">{Math.round(serviziSizeMul * 100)}%</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Grid */}
      <div
        ref={gridRef}
        className="flex-1 overflow-auto bg-white select-none"
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        style={{ cursor: drag ? 'grabbing' : 'default', touchAction: drag ? 'none' : 'auto' }}
      >
        {visibleParr.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-stone-400">
            <p>Tutti i parrucchieri sono nascosti</p>
          </div>
        ) : (
          <div style={{ minWidth: `${64 + visibleParr.length * 200}px`, position: 'relative' }}>
            {/* Column headers */}
            <div className="sticky top-0 bg-white z-20 border-b border-stone-200 flex">
              <div className="w-16 flex-shrink-0" />
              {visibleParr.map(p => (
                <div
                  key={p.id}
                  className="flex-1 text-center py-1 border-l-2 group"
                  style={{ borderColor: p.colore }}
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: p.colore }} />
                    <span className="font-semibold text-stone-800 text-sm">{p.nome}</span>
                    <button
                      onClick={() => setEditingParr({ open: true, id: p.id, nome: p.nome, colore: p.colore })}
                      className="text-stone-300 hover:text-amber-600 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Edit2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Time + columns */}
            <div className="flex" style={{ height: gridHeight, position: 'relative' }}>
              {/* Time labels */}
              <div className="w-16 flex-shrink-0 relative border-r border-stone-100">
                {slots.map((time, i) => {
                  const isHour = time.endsWith(':00');
                  const isHalf = time.endsWith(':30');
                  const isQuarter = time.endsWith(':15') || time.endsWith(':45');
                  return (
                    <div
                      key={time}
                      className="absolute w-full flex items-start justify-end pr-2 cursor-pointer hover:bg-amber-50 transition-colors group/timeslot"
                      style={{ top: i * slotHeight, height: slotHeight, backgroundColor: isHour ? 'rgba(0,0,0,0.07)' : undefined }}
                      onClick={() => {
                        if (drag) return;
                        const [h, m] = time.split(':').map(Number);
                        const d = new Date(date);
                        d.setHours(h, m, 0, 0);
                        setMultiModal({ open: true, date: d });
                      }}
                    >
                      {isHour && (
                        <span className="text-xs font-semibold text-stone-600 -translate-y-[0.4em]">{time}</span>
                      )}
                      {isHalf && (
                        <span className="text-[10px] font-semibold text-stone-600 -translate-y-[0.4em]">:30</span>
                      )}
                      {isQuarter && (
                        <span className="text-[9px] font-semibold text-stone-500 -translate-y-[0.4em]">{time.split(':')[1]}</span>
                      )}
                    </div>
                  );
                })}
                {slots.map((time, i) => (
                  <div
                    key={`tl-${time}`}
                    className="absolute left-0 right-0 pointer-events-none"
                    style={{
                      top: i * slotHeight,
                      height: 1,
                      backgroundColor: time.endsWith(':00') ? '#c5c0ba' : time.endsWith(':30') ? '#e0dbd4' : '#eeebe7',
                    }}
                  />
                ))}
              </div>

              {/* Parrucchiere columns */}
              {visibleParr.map(p => {
                const apps = positionAppsForParr(p.id);
                const assenzaOra = assenzeMap.has(p.id) ? assenzeMap.get(p.id) : undefined;
                const assenzaParziale = assenzaOra !== undefined && assenzaOra !== null ? assenzaOra : null;
                const absenceTopPx = assenzaParziale ? (() => {
                  const [h, m] = assenzaParziale.split(':').map(Number);
                  const absMin = h * 60 + m;
                  const dayStartMin = startHour * 60;
                  return Math.max(0, ((absMin - dayStartMin) / SLOT_DURATION) * slotHeight);
                })() : null;

                return (
                  <div
                    key={p.id}
                    className="flex-1 relative border-l border-stone-100"
                    style={{ height: gridHeight }}
                  >
                    {/* Grid lines + hour band */}
                    {slots.map((time, i) => (
                      <div key={`gl-${time}`} className="absolute left-0 right-0 pointer-events-none" style={{ top: i * slotHeight, height: slotHeight }}>
                        {time.endsWith(':00') && (
                          <div className="absolute inset-0" style={{ backgroundColor: 'rgba(0,0,0,0.07)' }} />
                        )}
                        <div className="absolute left-0 right-0" style={{
                          top: 0,
                          height: 1,
                          backgroundColor: time.endsWith(':00') ? '#c5c0ba' : time.endsWith(':30') ? '#e0dbd4' : '#eeebe7',
                        }} />
                      </div>
                    ))}

                    <div className="absolute top-0 left-0 right-0 h-0.5" style={{ backgroundColor: p.colore }} />

                    {absenceTopPx !== null && (
                      <div
                        className="absolute left-0 right-0 pointer-events-none z-[5]"
                        style={{
                          top: absenceTopPx,
                          bottom: 0,
                          background: 'repeating-linear-gradient(45deg, #f5f4f2, #f5f4f2 6px, #ece9e4 6px, #ece9e4 12px)',
                          opacity: 0.85,
                        }}
                      >
                        <div className="sticky top-0 flex items-center justify-center gap-1 py-1 px-2">
                          <span className="text-[10px] font-semibold text-stone-400 bg-white/80 rounded px-1.5 py-0.5 whitespace-nowrap">
                            Assente dalle {assenzaParziale}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Click zones */}
                    {slots.map((time, i) => (
                      <div
                        key={`cz-${time}`}
                        className="absolute left-0 right-0 group hover:bg-stone-50/80 cursor-pointer transition-colors z-0"
                        style={{ top: i * slotHeight, height: slotHeight }}
                        onClick={() => {
                          if (drag) return;
                          const [h, m] = time.split(':').map(Number);
                          const d = new Date(date);
                          d.setHours(h, m, 0, 0);
                          setMultiModal({ open: true, date: d });
                        }}
                      >
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-40 transition-opacity">
                          <Plus size={11} className="text-stone-500" />
                        </div>
                      </div>
                    ))}

                    {/* Drop target highlight when dragging over this column */}
                    {drag && drag.currentParrId === p.id && (
                      <div
                        className="absolute left-0 right-0 pointer-events-none z-[8] rounded"
                        style={{
                          top: snapTopToSlot(drag.currentTop),
                          height: (() => {
                            const a = appuntamenti.find(x => x.id === drag.appId);
                            return a ? Math.max((a.durata_minuti / SLOT_DURATION) * slotHeight, slotHeight) : slotHeight;
                          })(),
                          border: `2px dashed ${p.colore}`,
                          backgroundColor: `${p.colore}15`,
                        }}
                      />
                    )}

                    {/* Pending booking request blocks (blinking) */}
                    {richieste.flatMap(r => {
                      if (r.chiunque) {
                        // "Chiunque di noi": render yellow block in each candidate parrucchiere column
                        if (!r.parrucchieri_candidati?.includes(p.id)) return [];
                        const t = new Date(r.data_ora);
                        const startMin = t.getHours() * 60 + t.getMinutes();
                        const dayStart = startHour * 60;
                        const topPx = Math.max(0, ((startMin - dayStart) / SLOT_DURATION) * slotHeight);
                        const heightPx = Math.max(((r.durata_minuti ?? 60) / SLOT_DURATION) * slotHeight, slotHeight * 2);
                        return [(
                          <div
                            key={`r-${r.id}-chiunque-${p.id}`}
                            className="absolute left-1 right-1 rounded-lg overflow-hidden cursor-pointer z-20 border-2 border-dashed border-amber-400"
                            style={{
                              top: topPx + 1,
                              height: heightPx - 2,
                              background: 'rgba(251,191,36,0.15)',
                              animation: 'richiestaBlinking 1.5s ease-in-out infinite',
                            }}
                            onClick={() => setRichiestaModal({ open: true, r, parrucchiereAssegnatoId: p.id })}
                          >
                            <div className="px-2 py-1 h-full flex flex-col justify-between overflow-hidden">
                              <div>
                                <p className="font-bold text-amber-900 leading-tight truncate" style={{ fontSize: `${0.72 * (fontSize / 100)}rem` }}>
                                  {r.nome} {r.cognome}
                                </p>
                                {r.servizio_nome && (
                                  <p className="text-amber-700 truncate" style={{ fontSize: `${0.62 * (fontSize / 100)}rem` }}>{r.servizio_nome}</p>
                                )}
                              </div>
                              <p className="text-amber-600 font-semibold" style={{ fontSize: `${0.6 * (fontSize / 100)}rem` }}>
                                {t.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })} · Chiunque
                              </p>
                            </div>
                          </div>
                        )];
                      }
                      const slots: { isPrimary: boolean }[] = [];
                      if (r.parrucchiere_id === p.id) slots.push({ isPrimary: true });
                      if (r.parrucchiere2_id === p.id && r.data_ora2) slots.push({ isPrimary: false });
                      return slots.map(({ isPrimary }) => {
                        const dataOra = isPrimary ? r.data_ora : r.data_ora2!;
                        const durata = isPrimary ? (r.durata_minuti ?? 60) : (r.durata2_minuti ?? 30);
                        const servNome = isPrimary ? r.servizio_nome : r.servizio2_nome;
                        const t = new Date(dataOra);
                        const startMin = t.getHours() * 60 + t.getMinutes();
                        const dayStart = startHour * 60;
                        const topPx = Math.max(0, ((startMin - dayStart) / SLOT_DURATION) * slotHeight);
                        const heightPx = Math.max((durata / SLOT_DURATION) * slotHeight, slotHeight * 2);
                        return (
                          <div
                            key={`r-${r.id}-${isPrimary ? '1' : '2'}`}
                            className="absolute left-1 right-1 rounded-lg overflow-hidden cursor-pointer z-20 border-2 border-dashed border-emerald-500"
                            style={{
                              top: topPx + 1,
                              height: heightPx - 2,
                              background: 'rgba(16,185,129,0.15)',
                              animation: 'richiestaBlinking 1.5s ease-in-out infinite',
                            }}
                            onClick={() => setRichiestaModal({ open: true, r })}
                          >
                            <div className="px-2 py-1 h-full flex flex-col justify-between overflow-hidden">
                              <div>
                                <p className="font-bold text-emerald-800 leading-tight truncate" style={{ fontSize: `${0.72 * (fontSize / 100)}rem` }}>
                                  {r.nome} {r.cognome}
                                </p>
                                {servNome && (
                                  <p className="text-emerald-700 truncate" style={{ fontSize: `${0.62 * (fontSize / 100)}rem` }}>{servNome}</p>
                                )}
                              </div>
                              <p className="text-emerald-600 font-semibold" style={{ fontSize: `${0.6 * (fontSize / 100)}rem` }}>
                                {t.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })} · Richiesta
                              </p>
                            </div>
                          </div>
                        );
                      });
                    })}

                    {/* Appointment blocks */}
                    {apps.map(app => {
                      const isDragged = drag?.appId === app.id;
                      const isCancellato = app.stato === 'cancellato';
                      const isOverlap = app.totalLayers > 1;
                      const isSecondary = app.layer > 0;
                      const baseColor = isCancellato
                        ? '#a8a29e'
                        : isSecondary ? darkenColor(p.colore, 0.35) : p.colore;
                      const width = isOverlap ? `${100 / app.totalLayers}%` : '100%';
                      const leftPct = isOverlap ? `${(app.layer / app.totalLayers) * 100}%` : '0%';
                      const cliente = app.clienti;
                      const carteTipi = cliente?.id ? clientiCarte.get(cliente.id) : undefined;
                      const tratt = app.appuntamento_trattamenti || [];
                      const shortBlock = app.heightPx < slotHeight * 2;

                      // Posa gradient: find first trattamento with posa config
                      const posaCfg = tratt
                        .map(t => (t as { trattamento_id?: string }).trattamento_id ? catalogoPosa.get((t as { trattamento_id: string }).trattamento_id) : undefined)
                        .find(Boolean);
                      const pxPerMin = slotHeight / SLOT_DURATION;
                      const blockBg = (() => {
                        if (!posaCfg) return baseColor;
                        const pt = posaCfg.inizio_posa * pxPerMin;
                        const pe = (posaCfg.inizio_posa + posaCfg.durata_posa) * pxPerMin;
                        const h = app.heightPx - 2;
                        const safeStart = Math.max(0, Math.min(pt, h));
                        const safeEnd = Math.max(safeStart, Math.min(pe, h));
                        if (safeStart >= safeEnd) return baseColor;
                        return `linear-gradient(to bottom, ${baseColor} ${safeStart}px, ${hexToRgba(baseColor, 0.28)} ${safeStart}px, ${hexToRgba(baseColor, 0.28)} ${safeEnd}px, ${baseColor} ${safeEnd}px)`;
                      })();

                      return (
                        <div
                          key={app.id}
                          className="absolute rounded-md overflow-hidden cursor-grab group/app shadow-sm z-10 border border-white/30 transition-opacity"
                          style={{
                            top: app.topPx + 1,
                            height: app.heightPx - 2,
                            left: `calc(${leftPct} + 2px)`,
                            width: `calc(${width} - 4px)`,
                            background: blockBg,
                            opacity: isDragged ? 0.35 : isCancellato ? 0.7 : 1,
                            touchAction: 'none',
                          }}
                          onPointerDown={e => {
                            e.stopPropagation();
                            startLongPress(e, app, p.id);
                          }}
                          onPointerUp={e => {
                            e.stopPropagation();
                            if (!isDragging.current) {
                              cancelDrag();
                              if (suppressModalOpen.current) {
                                suppressModalOpen.current = false;
                              } else if (e.pointerType === 'touch') {
                                // Mobile: require double-tap to open modal
                                const now = Date.now();
                                const last = lastTapRef.current;
                                if (last && last.id === app.id && now - last.time < 450) {
                                  lastTapRef.current = null;
                                  if (app.stato === 'in_forse') {
                                    setInForsePanel({ open: true, appId: app.id });
                                  } else {
                                    setAppModal({ open: true, id: app.id });
                                  }
                                } else {
                                  lastTapRef.current = { id: app.id, time: now };
                                  if (app.stato === 'in_forse') {
                                    setInForsePanel({ open: true, appId: app.id });
                                  }
                                }
                              } else {
                                if (app.stato === 'in_forse') {
                                  setInForsePanel({ open: true, appId: app.id });
                                } else {
                                  setAppModal({ open: true, id: app.id });
                                }
                              }
                            } else {
                              onPointerUp();
                            }
                          }}
                        >
                          {isCancellato && (
                            <div
                              className="absolute inset-0 pointer-events-none opacity-30"
                              style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(0,0,0,0.4) 5px, rgba(0,0,0,0.4) 7px)' }}
                            />
                          )}
                          {!isCancellato && isSecondary && (
                            <div
                              className="absolute inset-0 pointer-events-none opacity-25"
                              style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(0,0,0,0.5) 4px, rgba(0,0,0,0.5) 6px)' }}
                            />
                          )}
                          {app.stato === 'in_forse' && (
                            <div
                              className="absolute inset-0 pointer-events-none"
                              style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.55) 1.5px, transparent 1.5px)', backgroundSize: '7px 7px' }}
                            />
                          )}

                          {/* Long press indicator ring */}
                          {!isDragged && (
                            <div className="absolute inset-0 pointer-events-none opacity-0 group-hover/app:opacity-100 transition-opacity" style={{ boxShadow: 'inset 0 0 0 2px rgba(255,255,255,0.5)' }} />
                          )}

                          <div className="relative z-10 px-2 py-1 h-full flex flex-col justify-between overflow-hidden">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-1 min-w-0">
                                <p className={`leading-tight truncate ${isCancellato ? 'line-through text-white/80' : 'text-white'}`} style={{ fontSize: `${(shortBlock ? 0.68 : 0.76) * (fontSize / 100) * clienteSizeMul}rem`, fontWeight: clienteBold ? '700' : '400', fontStyle: clienteItalic ? 'italic' : 'normal', textShadow: '0 0 3px rgba(0,0,0,0.9), 0 1px 8px rgba(0,0,0,0.85), 0 2px 12px rgba(0,0,0,0.7)' }}>
                                  {cliente ? `${cliente.nome} ${cliente.cognome}` : '—'}
                                </p>
                                {!shortBlock && (
                                  <div className="flex flex-wrap gap-x-1.5 gap-y-0">
                                    {app.cliente_id && !clientiConFicheConvalidate.has(app.cliente_id) && (
                                      <p className="text-white/90 font-semibold leading-tight mt-0.5" style={{ fontSize: `${0.6 * (fontSize / 100)}rem`, textShadow: '0 0 3px rgba(0,0,0,0.8)' }}>
                                        Nuova cliente
                                      </p>
                                    )}
                                    {app.stato === 'in_forse' && (
                                      <p className="text-white/90 font-semibold leading-tight mt-0.5" style={{ fontSize: `${0.6 * (fontSize / 100)}rem`, textShadow: '0 0 3px rgba(0,0,0,0.8)' }}>
                                        In forse
                                      </p>
                                    )}
                                  </div>
                                )}
                                {carteTipi && carteTipi.size > 0 && (
                                  <div className="flex items-center gap-0.5 flex-shrink-0 mt-px">
                                    {(carteTipi.has('premium') || carteTipi.has('premium_vuota')) && (
                                      <svg width="18" height="12" viewBox="0 0 18 12" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ filter: carteTipi.has('premium') ? 'drop-shadow(0 0 2px rgba(0,0,0,0.5))' : 'drop-shadow(0 0 2px rgba(239,68,68,0.7))' }}>
                                        <rect x="0.5" y="0.5" width="17" height="11" rx="1.5" fill={carteTipi.has('premium') ? '#1c1917' : '#EF4444'} stroke={carteTipi.has('premium') ? '#44403c' : '#DC2626'} strokeWidth="0.5"/>
                                        <rect x="0.5" y="3" width="17" height="2.5" fill={carteTipi.has('premium') ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.15)'}/>
                                        <rect x="2" y="7" width="5" height="3" rx="0.8" fill={carteTipi.has('premium') ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.45)'}/>
                                      </svg>
                                    )}
                                    {carteTipi.has('sconto_ueg') && (
                                      <svg width="18" height="12" viewBox="0 0 18 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <rect x="0.5" y="0.5" width="17" height="11" rx="1.5" fill="#1c1917" stroke="#44403c" strokeWidth="0.5"/>
                                        <rect x="0.5" y="3" width="17" height="2.5" fill="rgba(255,255,255,0.1)"/>
                                        <rect x="2" y="7" width="5" height="3" rx="0.8" fill="rgba(255,255,255,0.2)"/>
                                      </svg>
                                    )}
                                    {carteTipi.has('sconto_normale') && (
                                      <svg width="18" height="12" viewBox="0 0 18 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <rect x="0.5" y="0.5" width="17" height="11" rx="1.5" fill="white" stroke="rgba(255,255,255,0.8)" strokeWidth="0.5"/>
                                        <rect x="0.5" y="3" width="17" height="2.5" fill="rgba(100,100,100,0.12)"/>
                                        <rect x="2" y="7" width="5" height="3" rx="0.8" fill="rgba(100,100,100,0.18)"/>
                                      </svg>
                                    )}
                                  </div>
                                )}
                              </div>
                              {!shortBlock && tratt.length > 0 && (
                                <p className="truncate leading-tight mt-0.5" style={{ fontSize: `${0.64 * (fontSize / 100) * serviziSizeMul}rem`, color: 'rgba(255,255,255,0.9)', fontWeight: serviziBold ? '700' : '400', fontStyle: serviziItalic ? 'italic' : 'normal', textShadow: posaCfg ? '0 0 3px rgba(0,0,0,0.9), 0 1px 8px rgba(0,0,0,0.85), 0 2px 12px rgba(0,0,0,0.7)' : undefined }}>
                                  {tratt.map(t => t.nome_trattamento).join(', ')}
                                </p>
                              )}
                            </div>
                            {!shortBlock && (
                              <p className="text-white/60 leading-none" style={{ fontSize: `${0.62 * (fontSize / 100)}rem`, textShadow: posaCfg ? '0 1px 3px rgba(0,0,0,0.45)' : undefined }}>
                                {new Date(app.data_ora).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })} · {app.durata_minuti}min
                              </p>
                            )}
                          </div>

                          <div className="absolute top-0.5 right-0.5 flex gap-0.5 opacity-0 group-hover/app:opacity-100 transition-opacity z-20">
                            {confirmDelete === app.id ? (
                              <>
                                <button
                                  onPointerDown={e => { e.stopPropagation(); suppressModalOpen.current = true; }}
                                  onClick={e => { e.stopPropagation(); deleteAppuntamento(app.id); }}
                                  className="bg-red-600 hover:bg-red-700 rounded px-1.5 py-0.5 text-white text-[9px] font-bold"
                                >
                                  Si
                                </button>
                                <button
                                  onPointerDown={e => { e.stopPropagation(); suppressModalOpen.current = true; }}
                                  onClick={e => { e.stopPropagation(); setConfirmDelete(null); }}
                                  className="bg-black/30 hover:bg-black/50 rounded px-1.5 py-0.5 text-white text-[9px] font-bold"
                                >
                                  No
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onPointerDown={e => { e.stopPropagation(); suppressModalOpen.current = true; }}
                                  onClick={e => { e.stopPropagation(); if (app.stato === 'in_forse') { setInForsePanel({ open: true, appId: app.id }); } else { setAppModal({ open: true, id: app.id }); } }}
                                  className="bg-black/20 hover:bg-black/40 rounded p-0.5 text-white"
                                >
                                  <Edit2 size={9} />
                                </button>
                                <button
                                  onPointerDown={e => { e.stopPropagation(); suppressModalOpen.current = true; }}
                                  onClick={e => { e.stopPropagation(); setConfirmDelete(app.id); }}
                                  className="bg-black/20 hover:bg-black/40 rounded p-0.5 text-white"
                                >
                                  <Trash2 size={9} />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}

              {/* Drag ghost — floats over entire grid */}
              {drag && dragApp && dragParr && dragParrIdx >= 0 && (() => {
                const snapped = snapTopToSlot(drag.currentTop);
                const ghostTime = topPxToTime(snapped);
                const heightPx = Math.max((dragApp.durata_minuti / SLOT_DURATION) * slotHeight, slotHeight);
                const colWidth = `calc((100% - 64px) / ${visibleParr.length})`;
                const colLeft = `calc(64px + ${dragParrIdx} * (100% - 64px) / ${visibleParr.length})`;
                return (
                  <div
                    className="absolute pointer-events-none z-50 rounded-md shadow-2xl border-2 border-white/60"
                    style={{
                      top: snapped + 1,
                      left: colLeft,
                      width: colWidth,
                      height: heightPx - 2,
                      backgroundColor: dragParr.colore,
                      opacity: 0.92,
                      transform: 'scale(1.03)',
                      transition: 'transform 0.1s',
                    }}
                  >
                    <div className="px-2 py-1 h-full flex flex-col justify-between overflow-hidden">
                      <p className="font-semibold text-white leading-tight truncate" style={{ fontSize: `${0.76 * (fontSize / 100)}rem` }}>
                        {dragApp.clienti ? `${dragApp.clienti.nome} ${dragApp.clienti.cognome}` : '—'}
                      </p>
                      <p className="text-white/80 leading-none font-medium" style={{ fontSize: `${0.68 * (fontSize / 100)}rem` }}>
                        {ghostTime.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })} · {dragApp.durata_minuti}min
                      </p>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}
      </div>

      {/* Legenda carte */}
      <div className="hidden sm:flex flex-shrink-0 border-t border-stone-100 bg-stone-50 px-3 py-1 items-center gap-3 flex-wrap">
        <span className="text-[9px] font-bold text-stone-400 uppercase tracking-wide">Legenda</span>
        <div className="flex items-center gap-1">
          <svg width="16" height="10" viewBox="0 0 18 12" fill="none"><rect x="0.5" y="0.5" width="17" height="11" rx="1.5" fill="#1c1917" stroke="#44403c" strokeWidth="0.5"/><rect x="0.5" y="3" width="17" height="2.5" fill="rgba(255,255,255,0.12)"/><rect x="2" y="7" width="5" height="3" rx="0.8" fill="rgba(255,255,255,0.3)"/></svg>
          <span className="text-[10px] text-stone-500">Premium</span>
        </div>
        <div className="flex items-center gap-1">
          <svg width="16" height="10" viewBox="0 0 18 12" fill="none"><rect x="0.5" y="0.5" width="17" height="11" rx="1.5" fill="#EF4444" stroke="#DC2626" strokeWidth="0.5"/><rect x="0.5" y="3" width="17" height="2.5" fill="rgba(0,0,0,0.15)"/><rect x="2" y="7" width="5" height="3" rx="0.8" fill="rgba(255,255,255,0.45)"/></svg>
          <span className="text-[10px] text-stone-500">Da ricaricare</span>
        </div>
        <div className="flex items-center gap-1">
          <svg width="16" height="10" viewBox="0 0 18 12" fill="none"><rect x="0.5" y="0.5" width="17" height="11" rx="1.5" fill="#1c1917" stroke="#44403c" strokeWidth="0.5"/><rect x="0.5" y="3" width="17" height="2.5" fill="rgba(255,255,255,0.1)"/><rect x="2" y="7" width="5" height="3" rx="0.8" fill="rgba(255,255,255,0.2)"/></svg>
          <span className="text-[10px] text-stone-500">Usa e Getta</span>
        </div>
        <div className="flex items-center gap-1">
          <svg width="16" height="10" viewBox="0 0 18 12" fill="none"><rect x="0.5" y="0.5" width="17" height="11" rx="1.5" fill="white" stroke="#d6d3d1" strokeWidth="0.5"/><rect x="0.5" y="3" width="17" height="2.5" fill="rgba(100,100,100,0.12)"/><rect x="2" y="7" width="5" height="3" rx="0.8" fill="rgba(100,100,100,0.18)"/></svg>
          <span className="text-[10px] text-stone-500">Sconto</span>
        </div>
        <span className="ml-auto text-[9px] text-stone-400 italic hidden sm:block">Tieni premuto per spostare · Doppio tap per modificare (mobile)</span>
      </div>

      {/* Edit parrucchiere modal */}
      {editingParr.open && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 flex-shrink-0">
              <h2 className="font-bold text-stone-800">Modifica parrucchiere</h2>
              <button onClick={() => setEditingParr({ open: false, nome: '', colore: '' })} className="text-stone-400 hover:text-stone-700">
                <X size={20} />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wide">Nome</label>
                <input
                  autoFocus
                  value={editingParr.nome}
                  onChange={e => setEditingParr(s => ({ ...s, nome: e.target.value }))}
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  onKeyDown={e => { if (e.key === 'Enter') updateParrName(); }}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wide">Colore</label>
                <div className="flex gap-2 flex-wrap">
                  {PRESET_COLORS.map(c => (
                    <button key={c} type="button" onClick={() => setEditingParr(s => ({ ...s, colore: c }))}
                      className="w-7 h-7 rounded-full transition-transform hover:scale-110"
                      style={{ backgroundColor: c, outline: editingParr.colore === c ? `3px solid ${c}` : 'none', outlineOffset: '2px' }}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-stone-100 flex gap-3 justify-end flex-shrink-0">
              <button onClick={() => setEditingParr({ open: false, nome: '', colore: '' })} className="px-4 py-2 text-sm font-medium text-stone-600 border border-stone-200 rounded-lg hover:bg-stone-50">Annulla</button>
              <button onClick={updateParrName} className="px-4 py-2 text-sm font-medium bg-amber-500 text-white rounded-lg hover:bg-amber-600">Salva</button>
            </div>
          </div>
        </div>
      )}

      {multiModal.open && multiModal.date && (
        <MultiBookModal
          dataIniziale={multiModal.date}
          onClose={() => setMultiModal({ open: false })}
          onSaved={() => { setMultiModal({ open: false }); load(); }}
        />
      )}

      {appModal.open && appModal.id && (
        <MultiBookModal
          dataIniziale={date}
          appuntamentoId={appModal.id}
          onClose={() => setAppModal({ open: false, id: null })}
          onSaved={() => { setAppModal({ open: false, id: null }); load(); }}
        />
      )}

      {/* Pannello appuntamento in forse */}
      {inForsePanel.open && inForsePanel.appId && (() => {
        const app = appuntamenti.find(a => a.id === inForsePanel.appId);
        const cliente = app?.clienti;
        const nomeCliente = cliente ? `${cliente.nome} ${cliente.cognome}` : 'Appuntamento senza cliente';
        const ora = app ? new Date(app.data_ora).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : '';
        return (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setInForsePanel({ open: false, appId: null })} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm z-10 overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100">
                <div>
                  <p className="text-xs font-semibold text-amber-500 uppercase tracking-wide mb-0.5">Appuntamento in forse</p>
                  <p className="font-bold text-stone-800 text-base leading-tight">{nomeCliente}</p>
                  <p className="text-sm text-stone-400 mt-0.5">Ore {ora} · {app?.durata_minuti} min</p>
                </div>
                <button onClick={() => setInForsePanel({ open: false, appId: null })} className="p-1.5 hover:bg-stone-100 rounded-lg transition-colors">
                  <X size={16} className="text-stone-400" />
                </button>
              </div>
              {/* Actions */}
              <div className="p-4 flex flex-col gap-3">
                <button
                  onClick={() => fissaAppuntamento(inForsePanel.appId!)}
                  className="flex items-center gap-3 w-full px-4 py-3.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-semibold transition-colors text-sm"
                >
                  <Check size={18} />
                  Fissa appuntamento
                </button>
                <button
                  onClick={() => { setInForsePanel({ open: false, appId: null }); setAppModal({ open: true, id: inForsePanel.appId }); }}
                  className="flex items-center gap-3 w-full px-4 py-3.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl font-semibold transition-colors text-sm"
                >
                  <Pencil size={18} />
                  Modifica appuntamento
                </button>
                <button
                  onClick={() => cancellaInForse(inForsePanel.appId!)}
                  className="flex items-center gap-3 w-full px-4 py-3.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl font-semibold transition-colors text-sm"
                >
                  <Trash2 size={18} />
                  Cancella appuntamento
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Pannello altri appuntamenti in forse */}
      {altriInForsePanel.open && altriInForsePanel.apps.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setAltriInForsePanel({ open: false, clienteNome: '', apps: [] })} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm z-10 overflow-hidden max-h-[85vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100 flex-shrink-0">
              <div>
                <p className="text-xs font-semibold text-amber-500 uppercase tracking-wide mb-0.5">Altri appuntamenti in forse</p>
                <p className="font-bold text-stone-800 text-base leading-tight">{altriInForsePanel.clienteNome}</p>
              </div>
              <button onClick={() => setAltriInForsePanel({ open: false, clienteNome: '', apps: [] })} className="p-1.5 hover:bg-stone-100 rounded-lg transition-colors">
                <X size={16} className="text-stone-400" />
              </button>
            </div>
            {/* List */}
            <div className="overflow-y-auto flex-1 divide-y divide-stone-100">
              {altriInForsePanel.apps.length === 0 && (
                <div className="flex flex-col items-center justify-center py-10 px-5 text-center">
                  <Check size={32} className="text-emerald-400 mb-3" />
                  <p className="font-semibold text-stone-700 text-sm">Nessun appuntamento in forse rimasto</p>
                  <p className="text-xs text-stone-400 mt-1">Tutti gli appuntamenti sono stati gestiti</p>
                </div>
              )}
              {altriInForsePanel.apps.map(app => {
                const dataFmt = new Date(app.data_ora).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
                const oraFmt = new Date(app.data_ora).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
                return (
                  <div key={app.id} className="px-5 py-3.5">
                    <div className="flex items-start justify-between gap-3 mb-2.5">
                      <div>
                        <p className="font-semibold text-stone-800 text-sm capitalize">{dataFmt}</p>
                        <p className="text-xs text-stone-400 mt-0.5">Ore {oraFmt} · {app.durata_minuti} min</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => fissaInForseFromPanel(app.id)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-semibold transition-colors"
                      >
                        <Check size={13} />
                        Fissa
                      </button>
                      <button
                        onClick={() => modificaInForseFromPanel(app.id)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-semibold transition-colors"
                      >
                        <Pencil size={13} />
                        Modifica
                      </button>
                      <button
                        onClick={() => cancellaInForseFromPanel(app.id)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs font-semibold transition-colors"
                      >
                        <Trash2 size={13} />
                        Cancella
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Richiesta prenotazione online modal */}
      {richiestaModal.open && richiestaModal.r && (() => {
        const r = richiestaModal.r;
        const parrAssegnatoId = richiestaModal.parrucchiereAssegnatoId;
        const parrPrimario = r.chiunque
          ? parrucchieri.find(p => p.id === parrAssegnatoId)
          : parrucchieri.find(p => p.id === r.parrucchiere_id);
        const parrSecondario = r.parrucchiere2_id ? parrucchieri.find(p => p.id === r.parrucchiere2_id) : null;
        const dataFmt = new Date(r.data_ora).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
        const oraFmt = new Date(r.data_ora).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
        const ora2Fmt = r.data_ora2 ? new Date(r.data_ora2).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : null;
        return (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm flex flex-col overflow-hidden">
              {/* Header */}
              <div className={`${r.chiunque ? 'bg-amber-50 border-b border-amber-200' : 'bg-emerald-50 border-b border-emerald-200'} px-6 py-4 flex items-center gap-3`}>
                <div className={`w-10 h-10 rounded-2xl ${r.chiunque ? 'bg-amber-100' : 'bg-emerald-100'} flex items-center justify-center flex-shrink-0`}>
                  <CalendarClock size={18} className={r.chiunque ? 'text-amber-600' : 'text-emerald-600'} />
                </div>
                <div className="flex-1">
                  <p className={`font-bold ${r.chiunque ? 'text-amber-900' : 'text-emerald-900'}`}>
                    {r.chiunque ? 'Richiesta — Chiunque di noi' : 'Richiesta di prenotazione'}
                  </p>
                  <p className={`text-xs ${r.chiunque ? 'text-amber-600' : 'text-emerald-600'}`}>{dataFmt} alle {oraFmt}</p>
                </div>
                <button onClick={() => setRichiestaModal({ open: false, r: null })} className={r.chiunque ? 'text-amber-400 hover:text-amber-700' : 'text-emerald-400 hover:text-emerald-700'}>
                  <X size={18} />
                </button>
              </div>

              <div className="px-6 py-5 space-y-4">
                {/* Client info */}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-stone-100 flex items-center justify-center flex-shrink-0">
                    <User size={16} className="text-stone-500" />
                  </div>
                  <div>
                    <p className="font-semibold text-stone-800">{r.nome} {r.cognome}</p>
                    <p className="text-sm text-stone-500 flex items-center gap-1"><Phone size={11} />{r.telefono}</p>
                  </div>
                  {r.cliente_id && (
                    <span className="ml-auto text-xs bg-emerald-100 text-emerald-700 font-medium px-2 py-0.5 rounded-full">Cliente registrata</span>
                  )}
                </div>

                {/* Appointment 1 */}
                <div className={`${r.chiunque ? 'bg-amber-50 border border-amber-200' : 'bg-stone-50'} rounded-2xl p-4 space-y-1.5`}>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: parrPrimario?.colore ?? (r.chiunque ? '#F59E0B' : '#ccc') }} />
                    <span className="font-medium text-stone-700 text-sm">
                      {r.chiunque ? `Assegna a ${parrPrimario?.nome ?? '...'}` : parrPrimario?.nome}
                    </span>
                    {r.chiunque && <span className="text-xs bg-amber-200 text-amber-800 font-medium px-2 py-0.5 rounded-full ml-auto">Chiunque</span>}
                  </div>
                  <p className="text-sm text-stone-600 font-medium">{r.servizio_nome}</p>
                  <p className="text-xs text-stone-400">{oraFmt} · {r.durata_minuti} min</p>
                </div>

                {/* Appointment 2 (abbinato) */}
                {parrSecondario && r.data_ora2 && (
                  <div className="bg-emerald-50 rounded-2xl p-4 space-y-1.5 border border-emerald-200">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: parrSecondario.colore }} />
                      <span className="font-medium text-stone-700 text-sm">{parrSecondario.nome}</span>
                      <span className="text-xs text-emerald-600 font-medium">abbinato</span>
                    </div>
                    <p className="text-sm text-stone-600 font-medium">{r.servizio2_nome}</p>
                    <p className="text-xs text-stone-400">{ora2Fmt} · {r.durata2_minuti} min</p>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="px-6 pb-6 grid grid-cols-2 gap-3">
                <button
                  onClick={() => rifiutaRichiesta(r)}
                  disabled={processingRichiesta}
                  className="py-3.5 rounded-2xl border-2 border-red-200 bg-red-50 text-red-700 font-semibold text-sm hover:bg-red-100 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <X size={16} /> Rifiuta
                </button>
                <button
                  onClick={() => confermaRichiesta(r, parrAssegnatoId)}
                  disabled={processingRichiesta}
                  className={`py-3.5 rounded-2xl ${r.chiunque ? 'bg-amber-500 hover:bg-amber-600' : 'bg-emerald-600 hover:bg-emerald-700'} text-white font-semibold text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2`}
                >
                  {processingRichiesta ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <><Check size={16} /> Conferma</>
                  )}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* WhatsApp message preview modal */}
      {whatsappPreview?.open && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm flex flex-col overflow-hidden">
            <div className="bg-green-50 border-b border-green-200 px-6 py-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-green-100 flex items-center justify-center flex-shrink-0">
                <svg viewBox="0 0 24 24" className="w-5 h-5 fill-green-600"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              </div>
              <div className="flex-1">
                <p className="font-bold text-green-900">Anteprima messaggio WhatsApp</p>
                <p className="text-xs text-green-600">Modifica il testo se necessario, poi invia</p>
              </div>
              <button onClick={() => setWhatsappPreview(null)} className="text-green-400 hover:text-green-700">
                <X size={18} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <textarea
                value={whatsappPreview.testo}
                onChange={e => setWhatsappPreview(prev => prev ? { ...prev, testo: e.target.value } : null)}
                rows={6}
                className="w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-800 resize-none focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent leading-relaxed"
              />

              {/* Toggle posizione */}
              <label className="flex items-center gap-3 cursor-pointer select-none group">
                <div
                  onClick={() => setWpInviaPosizione(v => !v)}
                  className={`relative w-10 h-6 rounded-full transition-colors flex-shrink-0 ${wpInviaPosizione ? 'bg-green-500' : 'bg-stone-200'}`}
                >
                  <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${wpInviaPosizione ? 'translate-x-4' : ''}`} />
                </div>
                <div>
                  <p className="text-sm font-medium text-stone-700">Includi la posizione nel messaggio</p>
                  <p className="text-xs text-stone-400">Il link Google Maps verrà aggiunto in fondo al messaggio</p>
                </div>
              </label>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => { setWhatsappPreview(null); setWpInviaPosizione(false); }}
                  className="py-3 rounded-2xl border border-stone-200 text-stone-600 font-semibold text-sm hover:bg-stone-50 transition-colors"
                >
                  Annulla
                </button>
                <button
                  disabled={wpLoadingPos}
                  onClick={() => {
                    const sendMsg = (testo: string) => {
                      apriWhatsApp(whatsappPreview.telefono, testo);
                      setWhatsappPreview(null);
                      setWpInviaPosizione(false);
                    };
                    if (wpInviaPosizione && navigator.geolocation) {
                      setWpLoadingPos(true);
                      navigator.geolocation.getCurrentPosition(
                        (pos) => {
                          setWpLoadingPos(false);
                          const locUrl = `https://maps.google.com/?q=${pos.coords.latitude},${pos.coords.longitude}`;
                          sendMsg(`${whatsappPreview.testo}\n\n📍 ${locUrl}`);
                        },
                        () => { setWpLoadingPos(false); sendMsg(whatsappPreview.testo); },
                        { timeout: 8000 }
                      );
                    } else {
                      sendMsg(whatsappPreview.testo);
                    }
                  }}
                  className="py-3 rounded-2xl bg-green-600 text-white font-semibold text-sm hover:bg-green-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white flex-shrink-0"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  {wpLoadingPos ? 'Posizione...' : 'Apri WhatsApp'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
