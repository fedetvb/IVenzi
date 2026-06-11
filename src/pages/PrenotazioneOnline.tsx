import { useEffect, useState, useCallback, useRef } from 'react';
import { Calendar, Clock, ChevronRight, ChevronLeft, Check, X, Scissors, User, Users, Phone, Download, Share, MessageCircle, CalendarPlus, Image, Trash2, Star, Inbox, ChevronDown, ChevronUp, ZoomIn, Reply, Bell, BellOff, CreditCard, Gift, TrendingUp, ArrowUpCircle, ArrowDownCircle, Mail, FileText, Camera } from 'lucide-react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? 'https://cfsourwsjhhriytkdnuw.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';
const EDGE_URL = `${SUPABASE_URL}/functions/v1/prenota-online`;
const MIEI_MSG_URL = `${SUPABASE_URL}/functions/v1/miei-messaggi`;
const MIE_CARTE_URL = `${SUPABASE_URL}/functions/v1/mie-carte`;
const AGGIORNA_PROFILO_URL = `${SUPABASE_URL}/functions/v1/aggiorna-profilo`;

interface Parrucchiere {
  id: string;
  nome: string;
  colore: string;
}

interface Servizio {
  id: string;
  nome: string;
  durata_minuti: number;
  prezzo: number;
  colore: string;
  servizio_abbinato_online_id: string | null;
}

interface ServizioAbbinato {
  id: string;
  nome: string;
  durata_minuti: number;
  prezzo: number;
  colore: string;
}

interface SalonInfo {
  prenotazioniAttive: boolean;
  nomeSalone: string;
  logoUrl: string | null;
  parrucchieri: Parrucchiere[];
  servizi: Servizio[];
  serviziAbbinati: ServizioAbbinato[];
}

type Step = 'dati' | 'scelta' | 'parrucchiere' | 'data' | 'ora' | 'servizio' | 'abbinato' | 'riepilogo' | 'successo' | 'scrivici' | 'successo_messaggio' | 'miei_messaggi' | 'mie_carte' | 'profilo';

interface MioMessaggio {
  id: string;
  testo: string;
  foto_url_1: string;
  foto_url_2: string;
  foto_url_3: string;
  preferito: boolean;
  risposta_testo: string | null;
  risposta_at: string | null;
  risposta_foto_url_1: string | null;
  risposta_foto_url_2: string | null;
  risposta_foto_url_3: string | null;
  created_at: string;
}

interface CartaPremium {
  id: string;
  codice: string;
  saldo: number;
  attiva: boolean;
  created_at: string;
  tipo: 'premium';
  ricariche: { id: string; importo: number; note: string; created_at: string }[];
  utilizzi: { id: string; importo_detratto: number; note: string; created_at: string }[];
  risparmioTotale: number;
}

interface CartaInfinity {
  id: string;
  codice: string;
  descrizione: string;
  tipo_sconto: string;
  valore_sconto: number;
  attiva: boolean;
  created_at: string;
  tipo: 'infinity';
}

interface CartaUsaEGetta {
  id: string;
  codice: string;
  descrizione: string;
  tipo_sconto: string;
  valore_sconto: number;
  attiva: boolean;
  created_at: string;
  tipo: 'usa_e_getta';
}

interface GiftPass {
  id: string;
  codice: string;
  tipo: 'valore' | 'prodotto';
  valore_euro: number | null;
  prodotto_nome: string | null;
  prodotti_rivendita_catalogo: { categoria: string } | null;
  occasione: string;
  attivata_at: string | null;
  scadenza_uso: string | null;
  scadenza_uso_giorni: number | null;
  scadenza_ritiro_giorni: number | null;
  created_at: string;
  destinataria_nome: string;
  destinataria_telefono: string;
  utilizzata: boolean;
  donata: boolean;
  tipo_carta: 'gift_pass_donatore' | 'gift_pass_ricevente';
}

interface MieCarteData {
  cliente: { id: string; nome: string; cognome: string } | null;
  cartePremium: CartaPremium[];
  carteInfinity: CartaInfinity[];
  carteUsaEGetta: CartaUsaEGetta[];
  giftPassDonatore: GiftPass[];
  giftPassRicevente: GiftPass[];
  salone: Record<string, string>;
}

const LS_CLIENTE_KEY = 'prenota_online_cliente_v1';
const MONTHS_IT = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
const DAYS_IT = ['Dom','Lun','Mar','Mer','Gio','Ven','Sab'];

function pad(n: number) { return String(n).padStart(2, '0'); }
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}
function addDays(dateStr: string, n: number) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}
function dateLabel(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00');
  return `${DAYS_IT[d.getDay()]} ${d.getDate()} ${MONTHS_IT[d.getMonth()]}`;
}

// Generates 42 days starting from today grouped by week (7 days)
function buildCalendar(baseDate: Date) {
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = Array(firstDay === 0 ? 6 : firstDay - 1).fill(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${year}-${pad(month+1)}-${pad(d)}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function buildLookupParams(nome: string, cognome: string, telefono: string, codiceCliente: string): string {
  const nomeEnc = `&nome=${encodeURIComponent(nome.trim())}&cognome=${encodeURIComponent(cognome.trim())}`;
  const codice = codiceCliente.trim().toUpperCase();
  if (codice) return `codice_cliente=${encodeURIComponent(codice)}${nomeEnc}`;
  if (telefono.trim()) return `telefono=${encodeURIComponent(telefono.trim())}${nomeEnc}`;
  return `nome=${encodeURIComponent(nome.trim())}&cognome=${encodeURIComponent(cognome.trim())}`;
}

export default function PrenotazioneOnline({ userId }: { userId: string }) {
  const [info, setInfo] = useState<SalonInfo | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(true);
  const [step, setStep] = useState<Step>('dati');
  const [isNuovaScheda, setIsNuovaScheda] = useState(false);

  // Cliente dati
  const [nome, setNome] = useState('');
  const [cognome, setCognome] = useState('');
  const [telefono, setTelefono] = useState('');
  const [codiceCliente, setCodiceCliente] = useState('');
  const [cartaScontoCode, setCartaScontoCode] = useState('');
  const [giftPassCode, setGiftPassCode] = useState('');
  const [datiError, setDatiError] = useState('');
  const [datiChecking, setDatiChecking] = useState(false);

  // Conflitto numero (nome+cognome trovati ma telefono diverso)
  const [conflittoSubStep, setConflittoSubStep] = useState<'choice' | 'cambio'>('choice');
  const [conflittoVecchioTel, setConflittoVecchioTel] = useState('');
  const [conflittoNuovoTel, setConflittoNuovoTel] = useState('');
  const [conflittoNuovoTelConferma, setConflittoNuovoTelConferma] = useState('');
  const [conflittoError, setConflittoError] = useState('');
  const [conflittoLoading, setConflittoLoading] = useState(false);

  // Le mie carte
  const [mieCarteData, setMieCarteData] = useState<MieCarteData | null>(null);
  const [loadingMieCarte, setLoadingMieCarte] = useState(false);
  const [mieCarteError, setMieCarteError] = useState('');

  // Il mio profilo
  const [profiloNome, setProfiloNome] = useState('');
  const [profiloCognome, setProfiloCognome] = useState('');
  const [profiloTelefono, setProfiloTelefono] = useState('');
  const [profiloEmail, setProfiloEmail] = useState('');
  const [profiloDataNascita, setProfiloDataNascita] = useState('');
  const [profiloNote, setProfiloNote] = useState('');
  const [profiloFotoUrl, setProfiloFotoUrl] = useState('');
  const [profiloFotoBase64, setProfiloFotoBase64] = useState('');
  const [profiloFotoMime, setProfiloFotoMime] = useState('');
  const [profiloFotoPreview, setProfiloFotoPreview] = useState('');
  const [loadingProfilo, setLoadingProfilo] = useState(false);
  const [profiloSaving, setProfiloSaving] = useState(false);
  const [profiloError, setProfiloError] = useState('');
  const [profiloSaved, setProfiloSaved] = useState(false);
  const [profiloSchedaInviata, setProfiloSchedaInviata] = useState(false);
  const profiloFotoRef = useRef<HTMLInputElement>(null);
  const profiloFotoCameraRef = useRef<HTMLInputElement>(null);

  // Selections
  const [parrucchiere, setParrucchiere] = useState<Parrucchiere | null>(null);
  const [chiunque, setChiunque] = useState(false);
  const [dataSelezionata, setDataSelezionata] = useState<string>('');
  const [oraSelezionata, setOraSelezionata] = useState<string>('');
  const [servizio, setServizio] = useState<Servizio | null>(null);
  const [parrucchiere2, setParrucchiere2] = useState<Parrucchiere | null>(null);

  // Availability
  const [slotDisponibili, setSlotDisponibili] = useState<string[]>([]);
  const [loadingSlot, setLoadingSlot] = useState(false);
  const [parrLiberi, setParrLiberi] = useState<Parrucchiere[]>([]);
  const [loadingParr2, setLoadingParr2] = useState(false);
  const [parrPrimarioOccupato, setParrPrimarioOccupato] = useState(false);
  const [parrucchieriPerSlot, setParrucchieriPerSlot] = useState<Record<string, string[]>>({});
  const [parrucchieriCandidati, setParrucchieriCandidati] = useState<string[]>([]);

  // Calendar nav
  const [calMonth, setCalMonth] = useState(new Date());

  // Submit prenotazione
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Scrivici form
  const [msgTesto, setMsgTesto] = useState('');
  const [msgFotos, setMsgFotos] = useState<Array<{ base64: string; mime: string; preview: string }>>([]);
  const [msgSubmitting, setMsgSubmitting] = useState(false);
  const [msgError, setMsgError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // I miei messaggi
  const [mieiMsg, setMieiMsg] = useState<MioMessaggio[]>([]);
  const [loadingMieiMsg, setLoadingMieiMsg] = useState(false);
  const [mieiMsgError, setMieiMsgError] = useState('');
  const [msgZoomUrl, setMsgZoomUrl] = useState<string | null>(null);
  const [suonoAttivo, setSuonoAttivoState] = useState(() => localStorage.getItem('prenota_suono_v1') !== 'off');
  const suonoAttivoRef = useRef(suonoAttivo);
  const stepRef = useRef<Step>('dati');
  const risposteConosciute = useRef<Map<string, string | null>>(new Map());

  function setSuonoAttivo(val: boolean) {
    suonoAttivoRef.current = val;
    setSuonoAttivoState(val);
    localStorage.setItem('prenota_suono_v1', val ? 'on' : 'off');
  }

  function playPing() {
    try {
      const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1047, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 1.2);
    } catch { /* ignora se AudioContext non disponibile */ }
  }

  // PWA install prompt
  const [installPrompt, setInstallPrompt] = useState<Event | null>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [showIosModal, setShowIosModal] = useState(false);
  const [showAndroidModal, setShowAndroidModal] = useState(false);
  const [deviceType, setDeviceType] = useState<'ios' | 'android' | 'other'>('other');
  const [isSamsungBrowser, setIsSamsungBrowser] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    const ios = /iphone|ipad|ipod/i.test(ua);
    const android = /android/i.test(ua);
    const samsung = /SamsungBrowser/i.test(ua);
    const installed = window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    setDeviceType(ios ? 'ios' : android ? 'android' : 'other');
    setIsSamsungBrowser(samsung);
    // Show banner if not installed AND not permanently dismissed via "Ho installato"
    if (!installed && !localStorage.getItem('pwa_installata')) {
      setShowInstallBanner(true);
    }
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  function dismissInstallBanner() {
    // Temporary dismiss — no localStorage, banner returns on next reload
    setShowInstallBanner(false);
  }

  function markAsInstalled() {
    localStorage.setItem('pwa_installata', '1');
    setShowInstallBanner(false);
    setShowIosModal(false);
    setShowAndroidModal(false);
  }

  async function handleInstall() {
    if (installPrompt) {
      const prompt = installPrompt as Event & { prompt: () => void; userChoice: Promise<{ outcome: string }> };
      prompt.prompt();
      const { outcome } = await prompt.userChoice;
      if (outcome === 'accepted') {
        markAsInstalled();
      } else {
        setInstallPrompt(null);
        // Show manual instructions as fallback
        setShowAndroidModal(true);
      }
    } else {
      // Browser doesn't support beforeinstallprompt (Samsung Internet, Firefox, etc.)
      setShowAndroidModal(true);
    }
  }

  // Tieni stepRef sincronizzato
  useEffect(() => { stepRef.current = step; }, [step]);

  // Polling risposte in background (ogni 30s, dopo che l'utente ha inserito i dati)
  useEffect(() => {
    const tel = telefono.trim();
    if (!tel || !userId) return;

    let active = true;
    const poll = async () => {
      if (!active) return;
      try {
        const messaggi = await fetchMieiMessaggi(true);
        if (active && stepRef.current === 'miei_messaggi') {
          setMieiMsg(messaggi);
        }
      } catch { /* ignora errori di rete */ }
    };

    const id = setInterval(poll, 30000);
    return () => { active = false; clearInterval(id); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [telefono, userId]);

  // Pre-fill from localStorage
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(LS_CLIENTE_KEY) ?? '{}');
      if (saved.nome) setNome(saved.nome.charAt(0).toUpperCase() + saved.nome.slice(1));
      if (saved.cognome) setCognome(saved.cognome.charAt(0).toUpperCase() + saved.cognome.slice(1));
      if (saved.telefono) setTelefono(saved.telefono);
      if (saved.codiceCliente) setCodiceCliente(saved.codiceCliente.toUpperCase());
    } catch { /* ignore */ }
  }, []);


  useEffect(() => {
    async function loadInfo() {
      setLoadingInfo(true);
      const res = await fetch(`${EDGE_URL}/info?user_id=${userId}`);
      const data = await res.json();
      setInfo(data);
      setLoadingInfo(false);
    }
    loadInfo();
  }, [userId]);

  const loadSlots = useCallback(async (parrId: string, data: string, durata: number) => {
    setLoadingSlot(true);
    setSlotDisponibili([]);
    try {
      const res = await fetch(`${EDGE_URL}/disponibilita?user_id=${userId}&parrucchiere_id=${parrId}&data=${data}&durata_minuti=${durata}`);
      const d = await res.json();
      setSlotDisponibili(d.slot_disponibili ?? []);
    } catch {
      setSlotDisponibili([]);
    } finally {
      setLoadingSlot(false);
    }
  }, [userId]);

  async function loadSlotsChiunque(data: string, durata: number) {
    setLoadingSlot(true);
    setSlotDisponibili([]);
    setParrucchieriPerSlot({});
    try {
      const res = await fetch(`${EDGE_URL}/disponibilita-chiunque?user_id=${userId}&data=${data}&durata_minuti=${durata}`);
      const d = await res.json();
      setSlotDisponibili(d.slot_disponibili ?? []);
      setParrucchieriPerSlot(d.parrucchieri_per_slot ?? {});
    } catch {
      setSlotDisponibili([]);
      setParrucchieriPerSlot({});
    } finally {
      setLoadingSlot(false);
    }
  }

  async function loadParrLiberiPerAbbinato(
    data: string,
    firstServiceStartOra: string,
    firstServiceDurata: number,
    abbinato_durata: number,
    parrucchierePrimario: Parrucchiere,
  ) {
    setLoadingParr2(true);
    setParrLiberi([]);
    setParrPrimarioOccupato(false);
    try {
      // Abbinato starts exactly when first service ends
      const [h, m] = firstServiceStartOra.split(':').map(Number);
      const abbinatoStartMin = h * 60 + m + firstServiceDurata;
      const abbinatoOra = `${pad(Math.floor(abbinatoStartMin / 60))}:${pad(abbinatoStartMin % 60)}`;

      // Fetch ALL free hairdressers (no escludi_id) so we can check if primary is also free
      const res = await fetch(
        `${EDGE_URL}/parrucchieri-liberi?user_id=${userId}&data=${data}&ora=${abbinatoOra}&durata_minuti=${abbinato_durata}`
      );
      const d = await res.json();
      const tuttiLiberi: Parrucchiere[] = d.parrucchieri ?? [];
      const primarioLibero = !!tuttiLiberi.find(p => p.id === parrucchierePrimario.id);
      setParrLiberi(tuttiLiberi);
      setParrPrimarioOccupato(!primarioLibero);
      return 'scegli';
    } catch {
      setParrLiberi([]);
      setParrPrimarioOccupato(true);
      return 'scegli';
    } finally {
      setLoadingParr2(false);
    }
  }

  async function loadMieCarte() {
    setLoadingMieCarte(true);
    setMieCarteError('');
    try {
      const params = buildLookupParams(nome, cognome, telefono, codiceCliente);
      const res = await fetch(`${MIE_CARTE_URL}/info?user_id=${userId}&${params}`);
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? 'Errore');
      setMieCarteData(data);
    } catch {
      setMieCarteError('Impossibile caricare le carte. Riprova.');
    } finally {
      setLoadingMieCarte(false);
    }
  }

  async function loadProfilo() {
    setLoadingProfilo(true);
    setProfiloError('');
    try {
      const res = await fetch(`${AGGIORNA_PROFILO_URL}?user_id=${userId}&${buildLookupParams(nome, cognome, telefono, codiceCliente)}`);
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? 'Errore');
      const c = data.cliente;
      if (c) {
        setProfiloNome(c.nome ?? '');
        setProfiloCognome(c.cognome ?? '');
        setProfiloTelefono(c.telefono ?? '');
        setProfiloEmail(c.email ?? '');
        setProfiloDataNascita(c.data_nascita ?? '');
        setProfiloNote(c.note ?? '');
        setProfiloFotoUrl(c.foto_url ?? '');
        setProfiloFotoPreview(c.foto_url ?? '');
      } else {
        // Cliente non ancora registrata: precompila con i dati inseriti al primo step
        setProfiloNome(nome);
        setProfiloCognome(cognome);
        setProfiloTelefono(telefono);
      }
    } catch {
      // Anche in caso di errore, precompila con i dati del primo step
      setProfiloNome(nome);
      setProfiloCognome(cognome);
      setProfiloTelefono(telefono);
      setProfiloError('Impossibile caricare i dati dal database.');
    } finally {
      setLoadingProfilo(false);
    }
  }

  async function handleProfiloSave() {
    if (!profiloNome.trim() || !profiloCognome.trim()) {
      setProfiloError('Nome e cognome sono obbligatori.');
      return;
    }
    setProfiloSaving(true);
    setProfiloError('');
    setProfiloSaved(false);
    setProfiloSchedaInviata(false);
    try {
      const body: Record<string, string> = {
        user_id: userId,
        nome: profiloNome.trim(),
        cognome: profiloCognome.trim(),
        email: profiloEmail.trim(),
        data_nascita: profiloDataNascita,
        note: profiloNote.trim(),
      };
      // Lookup identity: codice_cliente preferred, then telefono, then nome+cognome (already in body)
      const codice = codiceCliente.trim().toUpperCase();
      if (codice) {
        body.codice_cliente = codice;
        if (telefono.trim()) body.telefono = telefono.trim();
      } else if (telefono.trim()) {
        body.telefono = telefono.trim();
      }
      if (profiloFotoBase64) {
        body.foto_base64 = profiloFotoBase64;
        body.foto_mime = profiloFotoMime;
      }
      const res = await fetch(AGGIORNA_PROFILO_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      // Cliente non ancora registrata: crea scheda da confermare
      if (res.status === 404 || data.error === 'Cliente non trovata') {
        const anonHeaders = {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        };
        const tel = (telefono || profiloTelefono).trim();
        // Controlla se esiste già una scheda in attesa
        const checkRes = await fetch(
          `${SUPABASE_URL}/rest/v1/schede_clienti_da_confermare?user_id=eq.${userId}&telefono=eq.${encodeURIComponent(tel)}&stato=eq.in_attesa&select=id`,
          { headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` } }
        );
        const existing = await checkRes.json();
        if (!Array.isArray(existing) || existing.length === 0) {
          const schedaRes = await fetch(`${SUPABASE_URL}/rest/v1/schede_clienti_da_confermare`, {
            method: 'POST',
            headers: anonHeaders,
            body: JSON.stringify({
              user_id: userId,
              nome: profiloNome.trim(),
              cognome: profiloCognome.trim(),
              telefono: tel,
              email: profiloEmail.trim() || null,
              data_nascita: profiloDataNascita || null,
              note: profiloNote.trim() || null,
              stato: 'in_attesa',
            }),
          });
          if (!schedaRes.ok) throw new Error('Errore durante l\'invio della scheda.');
        }
        setProfiloSchedaInviata(true);
        setProfiloFotoBase64('');
        setTimeout(() => setProfiloSchedaInviata(false), 5000);
        return;
      }

      if (!res.ok || data.error) throw new Error(data.error ?? 'Errore');
      setProfiloSaved(true);
      setProfiloFotoBase64('');
      setTimeout(() => setProfiloSaved(false), 3000);
    } catch (err) {
      setProfiloError(err instanceof Error ? err.message : 'Errore durante il salvataggio. Riprova.');
    } finally {
      setProfiloSaving(false);
    }
  }

  function handleProfiloFoto(file: File) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setProfiloError('La foto non deve superare 5 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = ev => {
      const data = ev.target?.result as string;
      setProfiloFotoBase64(data.split(',')[1]);
      setProfiloFotoMime(file.type || 'image/jpeg');
      setProfiloFotoPreview(data);
    };
    reader.readAsDataURL(file);
  }

  async function handleSegnaGiftPassDonata(giftPassId: string): Promise<boolean> {
    try {
      const anonHeaders = {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      };
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/gift_pass?id=eq.${encodeURIComponent(giftPassId)}`,
        { method: 'PATCH', headers: anonHeaders, body: JSON.stringify({ donata: true }) },
      );
      if (!res.ok) throw new Error('Errore aggiornamento');
      await loadMieCarte();
      return true;
    } catch {
      return false;
    }
  }

  async function handleRegalaCartaSconto(cartaId: string): Promise<boolean> {
    try {
      const res = await fetch(`${MIE_CARTE_URL}/regala`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, telefono: telefono.trim(), carta_id: cartaId }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? 'Errore');
      // Ricarica carte dopo regalo
      await loadMieCarte();
      return true;
    } catch {
      return false;
    }
  }

  // Core "proceed" logic — called after conflict resolution or directly when no conflict
  // knownExisting=true means we already verified this is a confirmed client (skip isNuovaScheda)
  async function proceedAfterDati(telOverride?: string, knownExisting = false) {
    const tel = (telOverride ?? telefono).trim();
    const anonHeaders = { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` };

    const saved: Record<string, string> = { nome: nome.trim(), cognome: cognome.trim(), telefono: tel };
    if (codiceCliente.trim()) saved.codiceCliente = codiceCliente.trim().toUpperCase();
    if (cartaScontoCode.trim()) saved.cartaScontoCode = cartaScontoCode.trim();
    if (giftPassCode.trim()) saved.giftPassCode = giftPassCode.trim();
    localStorage.setItem(LS_CLIENTE_KEY, JSON.stringify(saved));

    // Crea scheda da confermare nel gestionale (se non esiste già una in attesa per questo numero)
    try {
      // Use aggiorna-profilo (service role) to check if the client exists — anon REST call blocked by RLS
      let isClienteConfermata = knownExisting;
      if (!knownExisting) {
        try {
          const profRes = await fetch(
            `${AGGIORNA_PROFILO_URL}?user_id=${userId}&telefono=${encodeURIComponent(tel)}`
          );
          const profData = await profRes.json();
          isClienteConfermata = !!(profData.cliente);
        } catch { /* non bloccante */ }
      }

      const checkRes = await fetch(
        `${SUPABASE_URL}/rest/v1/schede_clienti_da_confermare?user_id=eq.${userId}&telefono=eq.${encodeURIComponent(tel)}&stato=eq.in_attesa&select=id`,
        { headers: anonHeaders }
      );
      const existing = await checkRes.json();
      if (!Array.isArray(existing) || existing.length === 0) {
        if (!isClienteConfermata) setIsNuovaScheda(true);
        await fetch(`${SUPABASE_URL}/rest/v1/schede_clienti_da_confermare`, {
          method: 'POST',
          headers: { ...anonHeaders, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
          body: JSON.stringify({
            user_id: userId,
            nome: nome.trim(),
            cognome: cognome.trim(),
            telefono: tel,
            stato: 'in_attesa',
            ...(giftPassCode.trim() ? { codice_gift_pass: giftPassCode.trim().toUpperCase() } : {}),
          }),
        });
      }
    } catch { /* non bloccante */ }

    if (cartaScontoCode.trim()) {
      try {
        await fetch(`${MIE_CARTE_URL}/associa-carta`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: userId, nome: nome.trim(), cognome: cognome.trim(), telefono: tel, codice_carta: cartaScontoCode.trim() }),
        });
      } catch { /* non bloccante */ }
    }

    if (giftPassCode.trim()) {
      try {
        await fetch(`${MIE_CARTE_URL}/attiva-gift-pass`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: userId, telefono: tel, nome: nome.trim(), cognome: cognome.trim(), codice: giftPassCode.trim().toUpperCase() }),
        });
      } catch { /* non bloccante */ }
    }

    setStep('scelta');
  }

  async function handleDatiNext() {
    if (!nome.trim() || !cognome.trim() || !telefono.trim()) {
      setDatiError('Tutti i campi sono obbligatori');
      return;
    }
    if (!/^\+?[\d\s\-()]{7,}$/.test(telefono.trim())) {
      setDatiError('Inserisci un numero di telefono valido');
      return;
    }

    // Validazione server-side codici carte/gift
    if (giftPassCode.trim() || cartaScontoCode.trim()) {
      try {
        const verRes = await fetch(`${MIE_CARTE_URL}/verifica-codici`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: userId,
            telefono: telefono.trim(),
            gift_pass_codice: giftPassCode.trim() || null,
            carta_sconto_codice: cartaScontoCode.trim() || null,
          }),
        });
        const verData = await verRes.json();
        if (verData.gift_pass_error) { setDatiError(verData.gift_pass_error); return; }
        if (verData.carta_sconto_error) { setDatiError(verData.carta_sconto_error); return; }
      } catch { /* non bloccante */ }
    }

    setDatiError('');

    // Conflict check: nome+cognome found in DB but with a different telefono?
    try {
      setDatiChecking(true);
      const res = await fetch(
        `${AGGIORNA_PROFILO_URL}?action=check_conflict&user_id=${userId}&telefono=${encodeURIComponent(telefono.trim())}&nome=${encodeURIComponent(nome.trim())}&cognome=${encodeURIComponent(cognome.trim())}`
      );
      const data = await res.json();
      if (data.conflitto === true) {
        setConflittoSubStep('choice');
        setConflittoVecchioTel('');
        setConflittoNuovoTelConferma('');
        setConflittoError('');
        setDatiChecking(false);
        setStep('conflitto_numero');
        return;
      }
    } catch { /* non bloccante — se fallisce procedi normalmente */ }

    setDatiChecking(false);
    await proceedAfterDati();
  }

  async function handleCambiaNumero() {
    const vecchio = conflittoVecchioTel.trim();
    const nuovo = conflittoNuovoTel.trim();
    const conferma = conflittoNuovoTelConferma.trim();

    if (!vecchio) { setConflittoError('Inserisci il tuo vecchio numero.'); return; }
    if (!nuovo) { setConflittoError('Inserisci il nuovo numero.'); return; }
    if (!/^\+?[\d\s\-()]{7,}$/.test(nuovo)) { setConflittoError('Inserisci un numero di telefono valido.'); return; }
    if (!conferma) { setConflittoError('Riscrivi il nuovo numero per confermare.'); return; }
    if (nuovo !== conferma) { setConflittoError('I due numeri nuovi non coincidono. Ricontrolla.'); return; }

    setConflittoLoading(true);
    setConflittoError('');
    try {
      const res = await fetch(AGGIORNA_PROFILO_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'cambia_numero',
          user_id: userId,
          vecchio_telefono: vecchio,
          nuovo_telefono: nuovo,
          nome: nome.trim(),
          cognome: cognome.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? 'Errore durante l\'aggiornamento.');
    } catch (err) {
      setConflittoError(err instanceof Error ? err.message : 'Errore. Riprova.');
      setConflittoLoading(false);
      return;
    }
    setConflittoLoading(false);
    setTelefono(nuovo);
    await proceedAfterDati(nuovo, true);
  }

  function handleFotoAdd(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    const remaining = 3 - msgFotos.length;
    files.slice(0, remaining).forEach(file => {
      const reader = new FileReader();
      reader.onload = ev => {
        const data = ev.target?.result as string;
        setMsgFotos(prev => [...prev, {
          base64: data.split(',')[1],
          mime: file.type || 'image/jpeg',
          preview: data,
        }]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  }

  async function handleMsgSubmit() {
    if (!msgTesto.trim() && msgFotos.length === 0) {
      setMsgError('Scrivi un messaggio o allega almeno una foto.');
      return;
    }
    setMsgSubmitting(true);
    setMsgError('');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
      const SCRIVICI_URL = `${import.meta.env.VITE_SUPABASE_URL ?? 'https://cfsourwsjhhriytkdnuw.supabase.co'}/functions/v1/scrivici`;
      const body: Record<string, string> = {
        user_id: userId,
        nome: nome.trim(),
        cognome: cognome.trim(),
        telefono: telefono.trim(),
        testo: msgTesto.trim(),
      };
      if (msgFotos[0]) { body.foto1_base64 = msgFotos[0].base64; body.foto1_mime = msgFotos[0].mime; }
      if (msgFotos[1]) { body.foto2_base64 = msgFotos[1].base64; body.foto2_mime = msgFotos[1].mime; }
      if (msgFotos[2]) { body.foto3_base64 = msgFotos[2].base64; body.foto3_mime = msgFotos[2].mime; }
      const res = await fetch(SCRIVICI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? 'Errore durante l\'invio');
      setStep('successo_messaggio');
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setMsgError('Connessione lenta o timeout. Controlla la rete e riprova.');
      } else {
        setMsgError(err instanceof Error ? err.message : 'Errore di rete. Riprova.');
      }
    } finally {
      clearTimeout(timeout);
      setMsgSubmitting(false);
    }
  }

  async function fetchMieiMessaggi(playSound: boolean): Promise<MioMessaggio[]> {
    const res = await fetch(`${MIEI_MSG_URL}?user_id=${userId}&${buildLookupParams(nome, cognome, telefono, codiceCliente)}`);
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error ?? 'Errore');
    const messaggi: MioMessaggio[] = data.messaggi ?? [];

    let nuovaRisposta = false;
    for (const m of messaggi) {
      const prev = risposteConosciute.current.get(m.id);
      if (playSound && m.risposta_testo && prev === null && risposteConosciute.current.has(m.id)) {
        nuovaRisposta = true;
      }
      risposteConosciute.current.set(m.id, m.risposta_testo);
    }
    if (nuovaRisposta && suonoAttivoRef.current) playPing();

    return messaggi;
  }

  async function loadMieiMessaggi() {
    setLoadingMieiMsg(true);
    setMieiMsgError('');
    try {
      const messaggi = await fetchMieiMessaggi(false);
      setMieiMsg(messaggi);
    } catch {
      setMieiMsgError('Impossibile caricare i messaggi. Riprova.');
    } finally {
      setLoadingMieiMsg(false);
    }
  }

  async function toggleMioPreferito(id: string, val: boolean) {
    setMieiMsg(prev => prev.map(m => m.id === id ? { ...m, preferito: val } : m));
    try {
      await fetch(MIEI_MSG_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, telefono: telefono.trim(), messaggio_id: id, preferito: val }),
      });
    } catch {
      setMieiMsg(prev => prev.map(m => m.id === id ? { ...m, preferito: !val } : m));
    }
  }

  function handleParrucchiereSelect(p: Parrucchiere) {
    setParrucchiere(p);
    setChiunque(false);
    setDataSelezionata('');
    setOraSelezionata('');
    setServizio(null);
    setParrucchiere2(null);
    setParrPrimarioOccupato(false);
    setParrucchieriPerSlot({});
    setParrucchieriCandidati([]);
    setCalMonth(new Date());
    setStep('data');
  }

  function handleChiunqueSelect() {
    setParrucchiere(null);
    setChiunque(true);
    setDataSelezionata('');
    setOraSelezionata('');
    setServizio(null);
    setParrucchiere2(null);
    setParrPrimarioOccupato(false);
    setParrucchieriPerSlot({});
    setParrucchieriCandidati([]);
    setCalMonth(new Date());
    setStep('data');
  }

  function handleDataSelect(d: string) {
    if (d < todayStr()) return;
    setDataSelezionata(d);
    setOraSelezionata('');
    setServizio(null);
    setParrucchiere2(null);
    setParrPrimarioOccupato(false);
    setStep('ora_servizio');
    // We go to servizio selection first, then load slots
    setStep('servizio');
  }

  function handleServizioSelect(s: Servizio) {
    setServizio(s);
    setOraSelezionata('');
    setParrucchiere2(null);
    setParrPrimarioOccupato(false);
    if (chiunque && dataSelezionata) {
      loadSlotsChiunque(dataSelezionata, s.durata_minuti);
    } else if (parrucchiere && dataSelezionata) {
      loadSlots(parrucchiere.id, dataSelezionata, s.durata_minuti);
    }
    setStep('ora');
  }

  async function handleOraSelect(ora: string) {
    setOraSelezionata(ora);
    if (!servizio) return;

    if (chiunque) {
      setParrucchieriCandidati(parrucchieriPerSlot[ora] ?? []);
      setStep('riepilogo');
      return;
    }

    if (servizio.servizio_abbinato_online_id) {
      const servAbbinato =
        info?.servizi.find(s => s.id === servizio!.servizio_abbinato_online_id) ??
        info?.serviziAbbinati?.find(s => s.id === servizio!.servizio_abbinato_online_id);
      if (servAbbinato && parrucchiere && dataSelezionata) {
        await loadParrLiberiPerAbbinato(
          dataSelezionata,
          ora,
          servizio.durata_minuti,
          servAbbinato.durata_minuti,
          parrucchiere,
        );
        setStep('abbinato');
        return;
      }
    }
    setStep('riepilogo');
  }

  async function handleSubmit() {
    if (!servizio || !dataSelezionata || !oraSelezionata) return;
    if (!chiunque && !parrucchiere) return;
    setSubmitting(true);
    setSubmitError('');

    // Build data_ora in ISO format
    const [h, m] = oraSelezionata.split(':').map(Number);
    const dataOraBase = new Date(`${dataSelezionata}T${pad(h)}:${pad(m)}:00`);

    // data_ora2: after first service ends (only for non-chiunque abbinato)
    let dataOra2: string | null = null;
    if (!chiunque && parrucchiere2 && servizio.servizio_abbinato_online_id) {
      const endMs = dataOraBase.getTime() + servizio.durata_minuti * 60000;
      dataOra2 = new Date(endMs).toISOString();
    }

    const body: Record<string, unknown> = {
      user_id: userId,
      nome: nome.trim(),
      cognome: cognome.trim(),
      telefono: telefono.trim(),
      parrucchiere_id: chiunque ? null : parrucchiere!.id,
      servizio_id: servizio.id,
      data_ora: dataOraBase.toISOString(),
      parrucchiere2_id: (!chiunque && parrucchiere2?.id) ? parrucchiere2.id : null,
      servizio2_id: (!chiunque && servizio.servizio_abbinato_online_id) ? servizio.servizio_abbinato_online_id : null,
      data_ora2: dataOra2,
      chiunque: chiunque || false,
      parrucchieri_candidati: chiunque ? parrucchieriCandidati : null,
      ...(giftPassCode.trim() ? { gift_pass_codice: giftPassCode.trim().toUpperCase() } : {}),
    };

    try {
      const res = await fetch(`${EDGE_URL}/richiesta`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        setSubmitError(data.error ?? 'Errore durante l\'invio. Riprova.');
        setSubmitting(false);
        return;
      }

      setStep('successo');
    } catch {
      setSubmitError('Errore di rete. Controlla la connessione e riprova.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loadingInfo) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!info) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-6">
        <p className="text-stone-500 text-center">Impossibile caricare la pagina. Riprova.</p>
      </div>
    );
  }

  if (!info.prenotazioniAttive) {
    return (
      <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-6">
        <SalonHeader info={info} />
        <div className="mt-10 bg-white rounded-2xl border border-stone-200 p-8 text-center max-w-sm w-full shadow-sm">
          <div className="w-14 h-14 bg-stone-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <X size={24} className="text-stone-400" />
          </div>
          <p className="font-semibold text-stone-800 text-lg mb-2">Prenotazioni sospese</p>
          <p className="text-stone-500 text-sm">Il servizio di prenotazione online non è attivo al momento. Contattaci direttamente.</p>
        </div>
      </div>
    );
  }

  const servizioAbbinato = servizio?.servizio_abbinato_online_id
    ? (info.servizi.find(s => s.id === servizio.servizio_abbinato_online_id) ??
       info.serviziAbbinati?.find(s => s.id === servizio.servizio_abbinato_online_id) ??
       null)
    : null;

  return (
    <div className="min-h-screen bg-stone-50">
      <SalonHeader info={info} />

      {/* PWA install banner */}
      {showInstallBanner && (
        <div className="bg-gradient-to-r from-emerald-700 to-emerald-600 text-white">
          <div className="max-w-lg mx-auto px-4 py-3.5 flex items-start gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center flex-shrink-0">
              {deviceType === 'ios' ? <Share size={20} /> : <Download size={20} />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm leading-snug">Aggiungila alla schermata home!</p>
              <p className="text-xs text-emerald-100 mt-0.5 leading-snug">
                {deviceType === 'ios'
                  ? 'Accedi con un tap, senza aprire il browser ogni volta.'
                  : 'Prenota con un tap, sempre a portata di mano.'
                }
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                {deviceType === 'ios' && (
                  <button
                    onClick={() => setShowIosModal(true)}
                    className="animate-pulse-glow px-3 py-1.5 bg-white text-emerald-700 text-xs font-bold rounded-lg hover:bg-emerald-50 transition-colors"
                  >
                    Come si fa?
                  </button>
                )}
                {(deviceType === 'android' || deviceType === 'other') && (
                  <button
                    onClick={handleInstall}
                    className="animate-pulse-glow px-3 py-1.5 bg-white text-emerald-700 text-xs font-bold rounded-lg hover:bg-emerald-50 transition-colors"
                  >
                    Installa ora
                  </button>
                )}
              </div>
            </div>
            <button onClick={dismissInstallBanner} className="text-emerald-200 hover:text-white transition-colors flex-shrink-0 pt-0.5">
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      {/* iOS install instructions modal */}
      {showIosModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="bg-emerald-600 px-6 pt-6 pb-4 text-white text-center">
              <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Share size={26} />
              </div>
              <p className="font-bold text-lg">Aggiungi alla schermata Home</p>
              <p className="text-emerald-100 text-sm mt-1">Segui questi 3 semplici passi su Safari</p>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 font-bold text-sm flex items-center justify-center flex-shrink-0">1</div>
                <div>
                  <p className="font-semibold text-stone-800 text-sm">Tocca il pulsante di condivisione</p>
                  <p className="text-xs text-stone-500 mt-0.5">Il quadratino con la freccia verso l'alto <span className="font-bold text-stone-700">⬆</span> in basso al centro dello schermo</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 font-bold text-sm flex items-center justify-center flex-shrink-0">2</div>
                <div>
                  <p className="font-semibold text-stone-800 text-sm">Scorri e tocca "Aggiungi alla schermata Home"</p>
                  <p className="text-xs text-stone-500 mt-0.5">Cerca l'icona con il <span className="font-bold text-stone-700">+</span> nel menu che si apre</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 font-bold text-sm flex items-center justify-center flex-shrink-0">3</div>
                <div>
                  <p className="font-semibold text-stone-800 text-sm">Tocca "Aggiungi" in alto a destra</p>
                  <p className="text-xs text-stone-500 mt-0.5">L'icona del salone apparirà sulla tua schermata home</p>
                </div>
              </div>
              <div className="pt-2 space-y-2">
                <button
                  onClick={markAsInstalled}
                  className="w-full py-3.5 bg-emerald-600 text-white font-semibold rounded-2xl hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2 text-sm"
                >
                  <Check size={16} /> Ho installato, non mostrare piu'
                </button>
                <button
                  onClick={() => setShowIosModal(false)}
                  className="w-full py-3 text-stone-500 text-sm font-medium hover:text-stone-700 transition-colors"
                >
                  Chiudi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Android manual install instructions modal */}
      {showAndroidModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="bg-emerald-600 px-6 pt-6 pb-4 text-white text-center">
              <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Download size={26} />
              </div>
              <p className="font-bold text-lg">Aggiungi alla schermata Home</p>
              <p className="text-emerald-100 text-sm mt-1">Segui questi passi nel tuo browser Android</p>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 font-bold text-sm flex items-center justify-center flex-shrink-0">1</div>
                <div>
                  <p className="font-semibold text-stone-800 text-sm">Tocca il menu del browser</p>
                  <p className="text-xs text-stone-500 mt-0.5">
                    I tre puntini <span className="font-bold text-stone-700">⋮</span>{' '}
                    {isSamsungBrowser
                      ? 'in basso a destra dello schermo'
                      : 'in alto a destra dello schermo'
                    }
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 font-bold text-sm flex items-center justify-center flex-shrink-0">2</div>
                <div>
                  <p className="font-semibold text-stone-800 text-sm">Seleziona "Aggiungi a schermata Home"</p>
                  <p className="text-xs text-stone-500 mt-0.5">Su Samsung Internet potrebbe chiamarsi <span className="font-bold text-stone-700">"Aggiungi pagina a"</span> oppure <span className="font-bold text-stone-700">"Schermata Home"</span></p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 font-bold text-sm flex items-center justify-center flex-shrink-0">3</div>
                <div>
                  <p className="font-semibold text-stone-800 text-sm">Tocca "Aggiungi" per confermare</p>
                  <p className="text-xs text-stone-500 mt-0.5">L'icona del salone apparirà sulla tua schermata home</p>
                </div>
              </div>
              <div className="pt-2 space-y-2">
                <button
                  onClick={markAsInstalled}
                  className="w-full py-3.5 bg-emerald-600 text-white font-semibold rounded-2xl hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2 text-sm"
                >
                  <Check size={16} /> Ho installato, non mostrare piu'
                </button>
                <button
                  onClick={() => setShowAndroidModal(false)}
                  className="w-full py-3 text-stone-500 text-sm font-medium hover:text-stone-700 transition-colors"
                >
                  Chiudi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-lg mx-auto px-4 py-6 pb-24">
        {/* Progress indicator */}
        {step !== 'successo' && step !== 'scelta' && step !== 'scrivici' && step !== 'successo_messaggio' && step !== 'miei_messaggi' && step !== 'mie_carte' && step !== 'profilo' && (
          <StepProgress step={step} />
        )}

        {/* STEP: Dati cliente */}
        {step === 'dati' && (
          <Card title="I tuoi dati" subtitle="Li salveremo per la prossima volta">
            <div className="space-y-4">
              {datiError && (
                <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{datiError}</p>
              )}
              <Field label="Nome *">
                <input
                  value={nome}
                  onChange={e => { const v = e.target.value; setNome(v.length > 0 ? v.charAt(0).toUpperCase() + v.slice(1) : v); }}
                  placeholder="Giulia"
                  className="input"
                />
              </Field>
              <Field label="Cognome *">
                <input
                  value={cognome}
                  onChange={e => { const v = e.target.value; setCognome(v.length > 0 ? v.charAt(0).toUpperCase() + v.slice(1) : v); }}
                  placeholder="Rossi"
                  className="input"
                />
              </Field>
              <Field label="Numero WhatsApp *">
                <div className="relative">
                  <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                  <input
                    value={telefono}
                    onChange={e => setTelefono(e.target.value)}
                    placeholder="+39 333 000 0000"
                    type="tel"
                    className="input pl-9"
                  />
                </div>
              </Field>
              <Field label="Il tuo codice cliente (opzionale)">
                <div className="relative">
                  <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                  <input
                    value={codiceCliente}
                    onChange={e => setCodiceCliente(e.target.value.toUpperCase())}
                    placeholder="Es. AB3X7K"
                    className="input pl-9 font-mono tracking-widest"
                    maxLength={8}
                  />
                </div>
                <p className="text-[11px] text-stone-400 mt-1">Il codice personale assegnato dal salone — ti permette di accedere al tuo profilo anche se cambi numero</p>
              </Field>
              <Field label="Codice carta sconto (opzionale)">
                <div className="relative">
                  <CreditCard size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                  <input
                    value={cartaScontoCode}
                    onChange={e => setCartaScontoCode(e.target.value.toUpperCase())}
                    placeholder="Es. SCONTO-XXXX"
                    className="input pl-9 font-mono"
                  />
                </div>
                <p className="text-[11px] text-stone-400 mt-1">Se hai ricevuto una carta sconto, inserisci il codice qui</p>
              </Field>
              <Field label="Codice Gift Pass (opzionale)">
                <div className="relative">
                  <Gift size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                  <input
                    value={giftPassCode}
                    onChange={e => setGiftPassCode(e.target.value.toUpperCase())}
                    placeholder="Es. 12345"
                    className="input pl-9 font-mono"
                  />
                </div>
                <p className="text-[11px] text-stone-400 mt-1">Se hai ricevuto un Gift Pass, inserisci il codice numerico qui</p>
              </Field>
              <p className="text-xs text-stone-400 bg-stone-50 rounded-xl p-3">
                La prenotazione è una <strong>richiesta</strong> e deve essere confermata dal salone via WhatsApp. Non è garantita finché non ricevi conferma.
              </p>
              <NextBtn onClick={handleDatiNext} disabled={datiChecking}>
                {datiChecking ? 'Controllo in corso…' : 'Avanti'}
              </NextBtn>
            </div>
          </Card>
        )}

        {/* STEP: Conflitto numero */}
        {step === 'conflitto_numero' && (
          <Card
            title="Abbiamo trovato il tuo nome"
            subtitle={`${nome} ${cognome} è già registrata, ma con un numero diverso`}
          >
            {conflittoSubStep === 'choice' && (
              <div className="space-y-4">
                <p className="text-sm text-stone-500 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
                  Il numero che hai inserito non corrisponde a quello che abbiamo in archivio per <strong>{nome} {cognome}</strong>. Sei tu?
                </p>

                <button
                  onClick={() => { setConflittoSubStep('cambio'); setConflittoError(''); setConflittoVecchioTel(''); setConflittoNuovoTel(''); setConflittoNuovoTelConferma(''); }}
                  className="w-full flex items-center gap-5 bg-white border-2 border-stone-200 rounded-3xl p-6 hover:border-emerald-400 hover:shadow-md transition-all text-left group"
                >
                  <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center flex-shrink-0 group-hover:bg-emerald-100 transition-colors">
                    <Phone size={26} className="text-emerald-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-stone-800 text-lg">Sì, ho cambiato numero</p>
                    <p className="text-sm text-stone-400 mt-0.5">Clicca per aggiornare il tuo numero di telefono</p>
                  </div>
                  <ChevronRight size={20} className="text-stone-300 group-hover:text-emerald-500 transition-colors flex-shrink-0" />
                </button>

                <button
                  onClick={() => proceedAfterDati()}
                  className="w-full flex items-center gap-5 bg-white border-2 border-stone-200 rounded-3xl p-6 hover:border-sky-400 hover:shadow-md transition-all text-left group"
                >
                  <div className="w-14 h-14 bg-sky-50 rounded-2xl flex items-center justify-center flex-shrink-0 group-hover:bg-sky-100 transition-colors">
                    <Users size={26} className="text-sky-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-stone-800 text-lg">No, sono una nuova cliente</p>
                    <p className="text-sm text-stone-400 mt-0.5">Clicca per continuare come nuova registrazione</p>
                  </div>
                  <ChevronRight size={20} className="text-stone-300 group-hover:text-sky-400 transition-colors flex-shrink-0" />
                </button>

                <BackBtn onClick={() => setStep('dati')} />
              </div>
            )}

            {conflittoSubStep === 'cambio' && (
              <div className="space-y-4">
                {conflittoError && (
                  <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{conflittoError}</p>
                )}

                <div className="space-y-1">
                  <label className="text-sm font-semibold text-stone-700">Vecchio numero *</label>
                  <div className="relative">
                    <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                    <input
                      value={conflittoVecchioTel}
                      onChange={e => setConflittoVecchioTel(e.target.value)}
                      placeholder="+39 333 111 2222"
                      type="tel"
                      className="input pl-9"
                    />
                  </div>
                  <p className="text-[11px] text-stone-400">Il numero con cui eri registrata in precedenza</p>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-semibold text-stone-700">Nuovo numero *</label>
                  <div className="relative">
                    <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                    <input
                      value={conflittoNuovoTel}
                      onChange={e => setConflittoNuovoTel(e.target.value)}
                      placeholder="+39 333 000 0000"
                      type="tel"
                      className="input pl-9"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-semibold text-stone-700">Riscrivi il nuovo numero *</label>
                  <div className="relative">
                    <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                    <input
                      value={conflittoNuovoTelConferma}
                      onChange={e => setConflittoNuovoTelConferma(e.target.value)}
                      placeholder="+39 333 000 0000"
                      type="tel"
                      className="input pl-9"
                    />
                  </div>
                  <p className="text-[11px] text-stone-400">Riscrivilo per evitare errori di battitura</p>
                </div>

                <button
                  onClick={handleCambiaNumero}
                  disabled={conflittoLoading}
                  className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-2xl transition-colors"
                >
                  {conflittoLoading ? 'Verifica in corso…' : 'Aggiorna il mio numero'}
                </button>

                <BackBtn onClick={() => { setConflittoSubStep('choice'); setConflittoError(''); }} />
              </div>
            )}
          </Card>
        )}

        {/* STEP: Scelta azione */}
        {step === 'scelta' && (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <p className="text-xl font-bold text-stone-800">Ciao, {nome}!</p>
              <p className="text-sm text-stone-400 mt-1">Cosa vuoi fare oggi?</p>
            </div>

            <button
              onClick={() => { loadProfilo(); setStep('profilo'); }}
              className="w-full flex items-center gap-5 bg-white border-2 border-stone-200 rounded-3xl p-6 hover:border-violet-400 hover:shadow-md transition-all text-left group"
            >
              <div className="w-14 h-14 bg-violet-50 rounded-2xl flex items-center justify-center flex-shrink-0 group-hover:bg-violet-100 transition-colors">
                <User size={26} className="text-violet-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-stone-800 text-lg">Il mio profilo</p>
                <p className="text-sm text-stone-400 mt-0.5">I tuoi dati personali</p>
              </div>
              <ChevronRight size={20} className="text-stone-300 group-hover:text-violet-500 transition-colors flex-shrink-0" />
            </button>

            <button
              onClick={() => setStep('parrucchiere')}
              className="w-full flex items-center gap-5 bg-white border-2 border-stone-200 rounded-3xl p-6 hover:border-emerald-400 hover:shadow-md transition-all text-left group"
            >
              <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center flex-shrink-0 group-hover:bg-emerald-200 transition-colors">
                <CalendarPlus size={26} className="text-emerald-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-stone-800 text-lg">Richiedi un appuntamento</p>
                <p className="text-sm text-stone-400 mt-0.5">Scegli data, orario e servizio</p>
              </div>
              <ChevronRight size={20} className="text-stone-300 group-hover:text-emerald-500 transition-colors flex-shrink-0" />
            </button>

            <button
              onClick={() => setStep('scrivici')}
              className="w-full flex items-center gap-5 bg-white border-2 border-stone-200 rounded-3xl p-6 hover:border-sky-400 hover:shadow-md transition-all text-left group"
            >
              <div className="w-14 h-14 bg-sky-100 rounded-2xl flex items-center justify-center flex-shrink-0 group-hover:bg-sky-200 transition-colors">
                <MessageCircle size={26} className="text-sky-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-stone-800 text-lg">Scrivici</p>
                <p className="text-sm text-stone-400 mt-0.5">Invia foto e una richiesta speciale</p>
              </div>
              <ChevronRight size={20} className="text-stone-300 group-hover:text-sky-400 transition-colors flex-shrink-0" />
            </button>

            <button
              onClick={() => { loadMieiMessaggi(); setStep('miei_messaggi'); }}
              className="w-full flex items-center gap-5 bg-white border-2 border-stone-200 rounded-3xl p-6 hover:border-amber-400 hover:shadow-md transition-all text-left group"
            >
              <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center flex-shrink-0 group-hover:bg-amber-100 transition-colors">
                <Inbox size={26} className="text-amber-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-stone-800 text-lg">I miei messaggi</p>
                <p className="text-sm text-stone-400 mt-0.5">Archivio delle tue richieste inviate</p>
              </div>
              <ChevronRight size={20} className="text-stone-300 group-hover:text-amber-500 transition-colors flex-shrink-0" />
            </button>

            <button
              onClick={() => { loadMieCarte(); setStep('mie_carte'); }}
              className="w-full flex items-center gap-5 bg-white border-2 border-stone-200 rounded-3xl p-6 hover:border-rose-400 hover:shadow-md transition-all text-left group"
            >
              <div className="w-14 h-14 bg-rose-50 rounded-2xl flex items-center justify-center flex-shrink-0 group-hover:bg-rose-100 transition-colors">
                <CreditCard size={26} className="text-rose-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-stone-800 text-lg">Le mie carte</p>
                <p className="text-sm text-stone-400 mt-0.5">Carte premium, sconti e movimenti</p>
              </div>
              <ChevronRight size={20} className="text-stone-300 group-hover:text-rose-500 transition-colors flex-shrink-0" />
            </button>

            <div className="mt-2 bg-sky-50 border border-sky-200 rounded-2xl px-5 py-4 text-center">
              <p className="text-sm text-sky-700 leading-relaxed">
                <span className="font-semibold">Hai un'idea in testa ma non sai come spiegarla?</span><br />
                Mandaci le foto che ti ispirano — un taglio, un colore, uno stile. Ti aiuteremo a trasformare il tuo sogno in realtà. ✨
              </p>
            </div>

            <BackBtn onClick={() => setStep('dati')} />
          </div>
        )}

        {/* STEP: Scrivici */}
        {step === 'scrivici' && (
          <Card title="Scrivici" subtitle={`${nome} ${cognome}`}>
            <div className="space-y-4">
              {msgError && (
                <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{msgError}</p>
              )}

              <div className="bg-sky-50 border border-sky-200 rounded-2xl px-4 py-3.5">
                <p className="text-sm text-sky-700 leading-relaxed">
                  <span className="font-semibold">Hai un'ispirazione? Condividila con noi!</span><br />
                  Allega fino a 3 foto — un look che ami, un colore che ti ha colpita, uno stile che ti rappresenta. Aggiungi un messaggio e ti risponderemo al piu presto.
                </p>
              </div>

              {/* Foto */}
              <div>
                <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-3">
                  Foto <span className="text-stone-300 font-normal normal-case">(max 3)</span>
                </label>
                <div className="flex gap-3 flex-wrap">
                  {msgFotos.map((f, i) => (
                    <div key={i} className="relative w-24 h-24 rounded-2xl overflow-hidden border border-stone-200 flex-shrink-0">
                      <img src={f.preview} className="w-full h-full object-cover" alt={`foto ${i+1}`} />
                      <button
                        onClick={() => setMsgFotos(prev => prev.filter((_, idx) => idx !== i))}
                        className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                  {msgFotos.length < 3 && (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-24 h-24 rounded-2xl border-2 border-dashed border-stone-300 flex flex-col items-center justify-center gap-1.5 text-stone-400 hover:border-sky-400 hover:text-sky-500 hover:bg-sky-50 transition-all flex-shrink-0"
                    >
                      <Image size={22} />
                      <span className="text-[10px] font-semibold">Aggiungi</span>
                    </button>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleFotoAdd}
                  />
                </div>
              </div>

              {/* Testo */}
              <div>
                <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1.5">
                  Messaggio <span className="text-stone-300 font-normal normal-case">(opzionale se invii foto)</span>
                </label>
                <textarea
                  value={msgTesto}
                  onChange={e => setMsgTesto(e.target.value)}
                  placeholder="Scrivi qui la tua richiesta o descrivi il look che desideri..."
                  rows={4}
                  className="w-full border border-stone-200 rounded-2xl px-4 py-3 text-sm text-stone-800 placeholder:text-stone-300 focus:outline-none focus:border-sky-400 resize-none"
                />
              </div>

              <button
                onClick={handleMsgSubmit}
                disabled={msgSubmitting}
                className="w-full py-4 bg-sky-500 text-white font-semibold rounded-2xl hover:bg-sky-600 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {msgSubmitting ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <><MessageCircle size={18} />Invia messaggio</>
                )}
              </button>

              <BackBtn onClick={() => setStep('scelta')} />
            </div>
          </Card>
        )}

        {/* STEP: Successo messaggio */}
        {step === 'successo_messaggio' && (
          <div className="text-center py-12">
            <div className="w-20 h-20 bg-sky-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Check size={36} className="text-sky-500" />
            </div>
            <h2 className="text-2xl font-bold text-stone-800 mb-3">Messaggio inviato!</h2>
            <p className="text-stone-500 max-w-xs mx-auto mb-8">
              Abbiamo ricevuto il tuo messaggio{msgFotos.length > 0 ? ' e le tue foto' : ''}. Ti risponderemo al piu presto.
            </p>
            <div className="flex flex-col gap-3 max-w-xs mx-auto">
              <button
                onClick={() => {
                  setMsgTesto('');
                  setMsgFotos([]);
                  setMsgError('');
                  setStep('scelta');
                }}
                className="px-8 py-3 bg-sky-500 text-white font-medium rounded-2xl hover:bg-sky-600 transition-colors flex items-center justify-center gap-2"
              >
                <MessageCircle size={16} />
                Scrivi di nuovo
              </button>
              <button
                onClick={() => {
                  setMsgTesto('');
                  setMsgFotos([]);
                  setMsgError('');
                  setParrucchiere(null);
                  setDataSelezionata('');
                  setOraSelezionata('');
                  setServizio(null);
                  setParrucchiere2(null);
                  setParrPrimarioOccupato(false);
                  setStep('parrucchiere');
                }}
                className="px-8 py-3 bg-stone-800 text-white font-medium rounded-2xl hover:bg-stone-900 transition-colors flex items-center justify-center gap-2"
              >
                <CalendarPlus size={16} />
                Richiedi appuntamento
              </button>
            </div>
          </div>
        )}

        {/* STEP: I miei messaggi */}
        {step === 'miei_messaggi' && (
          <MieiMessaggiStep
            messaggi={mieiMsg}
            loading={loadingMieiMsg}
            error={mieiMsgError}
            onTogglePreferito={toggleMioPreferito}
            onFotoZoom={setMsgZoomUrl}
            onBack={() => setStep('scelta')}
            onRetry={loadMieiMessaggi}
            suonoAttivo={suonoAttivo}
            onToggleSuono={() => setSuonoAttivo(!suonoAttivo)}
          />
        )}

        {/* STEP: Le mie carte */}
        {step === 'mie_carte' && (
          <MieCarteStep
            data={mieCarteData}
            loading={loadingMieCarte}
            error={mieCarteError}
            onBack={() => setStep('scelta')}
            onRetry={loadMieCarte}
            onRegala={handleRegalaCartaSconto}
            onSegnaGiftPassDonata={handleSegnaGiftPassDonata}
            nomeSalone={info?.nomeSalone ?? ''}
          />
        )}

        {/* STEP: Il mio profilo */}
        {step === 'profilo' && (
          <ProfiloStep
            nome={profiloNome} setNome={setProfiloNome}
            cognome={profiloCognome} setCognome={setProfiloCognome}
            telefono={profiloTelefono} setTelefono={setProfiloTelefono}
            email={profiloEmail} setEmail={setProfiloEmail}
            dataNascita={profiloDataNascita} setDataNascita={setProfiloDataNascita}
            note={profiloNote} setNote={setProfiloNote}
            fotoUrl={profiloFotoUrl}
            fotoPreview={profiloFotoPreview}
            fotoRef={profiloFotoRef}
            fotoCameraRef={profiloFotoCameraRef}
            onFotoChange={handleProfiloFoto}
            onFotoRemove={() => { setProfiloFotoBase64(''); setProfiloFotoMime(''); setProfiloFotoPreview(profiloFotoUrl); }}
            loading={loadingProfilo}
            saving={profiloSaving}
            error={profiloError}
            saved={profiloSaved}
            schedaInviata={profiloSchedaInviata}
            onSave={handleProfiloSave}
            onBack={() => setStep('scelta')}
          />
        )}

        {/* STEP: Parrucchiere */}
        {step === 'parrucchiere' && (
          <Card title="Scegli il parrucchiere" subtitle="Chi preferisci?">
            <div className="space-y-3">
              {info.parrucchieri.map(p => (
                <button
                  key={p.id}
                  onClick={() => handleParrucchiereSelect(p)}
                  className="w-full flex items-center gap-4 bg-white border border-stone-200 rounded-2xl p-4 hover:border-stone-300 hover:shadow-sm transition-all text-left"
                >
                  <div className="w-10 h-10 rounded-full flex-shrink-0" style={{ backgroundColor: p.colore }} />
                  <span className="font-medium text-stone-800">{p.nome}</span>
                  <ChevronRight size={16} className="ml-auto text-stone-400" />
                </button>
              ))}
              <button
                onClick={handleChiunqueSelect}
                className="w-full flex items-center gap-4 bg-amber-50 border-2 border-amber-200 rounded-2xl p-4 hover:border-amber-400 hover:shadow-sm transition-all text-left"
              >
                <div className="w-10 h-10 rounded-full bg-amber-200 flex items-center justify-center flex-shrink-0">
                  <Users size={20} className="text-amber-700" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="font-semibold text-amber-800">Chiunque di noi</span>
                  <p className="text-xs text-amber-600 mt-0.5">Vedremo noi chi è disponibile</p>
                </div>
                <ChevronRight size={16} className="ml-auto text-amber-500" />
              </button>
              <BackBtn onClick={() => setStep('scelta')} />
            </div>
          </Card>
        )}

        {/* STEP: Data */}
        {step === 'data' && (
          <Card title="Scegli la data" subtitle={chiunque ? 'Chiunque di noi' : parrucchiere?.nome}>
            <div>
              {/* Calendar header */}
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={() => setCalMonth(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
                  className="p-2 hover:bg-stone-100 rounded-xl transition-colors"
                  disabled={calMonth <= new Date(new Date().getFullYear(), new Date().getMonth(), 1)}
                >
                  <ChevronLeft size={18} className="text-stone-500" />
                </button>
                <span className="font-semibold text-stone-800">{MONTHS_IT[calMonth.getMonth()]} {calMonth.getFullYear()}</span>
                <button
                  onClick={() => setCalMonth(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
                  className="p-2 hover:bg-stone-100 rounded-xl transition-colors"
                >
                  <ChevronRight size={18} className="text-stone-500" />
                </button>
              </div>
              {/* Days header */}
              <div className="grid grid-cols-7 mb-2">
                {['Lun','Mar','Mer','Gio','Ven','Sab','Dom'].map(d => (
                  <div key={d} className="text-center text-xs font-semibold text-stone-400 py-1">{d}</div>
                ))}
              </div>
              {/* Calendar grid */}
              <div className="grid grid-cols-7 gap-1">
                {buildCalendar(calMonth).map((cell, i) => {
                  if (!cell) return <div key={i} />;
                  const isPast = cell < todayStr();
                  const isSelected = cell === dataSelezionata;
                  const isToday = cell === todayStr();
                  return (
                    <button
                      key={cell}
                      onClick={() => handleDataSelect(cell)}
                      disabled={isPast}
                      className={`aspect-square rounded-xl text-sm font-medium transition-all flex items-center justify-center
                        ${isPast ? 'text-stone-300 cursor-not-allowed' : 'hover:bg-emerald-50 text-stone-700 cursor-pointer'}
                        ${isSelected ? 'bg-emerald-600 text-white hover:bg-emerald-700' : ''}
                        ${isToday && !isSelected ? 'ring-2 ring-emerald-400' : ''}
                      `}
                    >
                      {parseInt(cell.split('-')[2])}
                    </button>
                  );
                })}
              </div>
              <div className="mt-4">
                <BackBtn onClick={() => setStep('parrucchiere')} />
              </div>
            </div>
          </Card>
        )}

        {/* STEP: Servizio */}
        {step === 'servizio' && (
          <Card title="Scegli il servizio" subtitle={`${chiunque ? 'Chiunque di noi' : parrucchiere?.nome} · ${dataSelezionata ? dateLabel(dataSelezionata) : ''}`}>
            <div className="space-y-3">
              {isNuovaScheda && (
                <div className="mb-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
                  Per il tuo primo appuntamento puoi prenotare solo <strong>Piega</strong> o <strong>Consulenza</strong>.
                </div>
              )}
              {(() => {
                const abbinatiIds = new Set((info.serviziAbbinati ?? []).map(a => a.id));
                let serviziSelezionabili: typeof info.servizi;
                if (isNuovaScheda) {
                  // For first-time clients show Piega/Consulenza from ALL services (including abbinati)
                  serviziSelezionabili = info.servizi.filter(s => /piega|consulenza/i.test(s.nome));
                } else {
                  serviziSelezionabili = info.servizi.filter(s => !abbinatiIds.has(s.id));
                }
                return serviziSelezionabili.length === 0 ? (
                  <p className="text-sm text-stone-500 text-center py-6">Nessun servizio disponibile online al momento.</p>
                ) : serviziSelezionabili.map(s => (
                <button
                  key={s.id}
                  onClick={() => handleServizioSelect(s)}
                  className="w-full flex items-center gap-4 bg-white border border-stone-200 rounded-2xl p-4 hover:border-stone-300 hover:shadow-sm transition-all text-left"
                >
                  <div className="w-2 self-stretch rounded-full flex-shrink-0" style={{ backgroundColor: s.colore }} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-stone-800">{s.nome}</p>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-stone-400">
                      <span className="flex items-center gap-1"><Clock size={11} /> {s.durata_minuti} min</span>
                      {s.servizio_abbinato_online_id && (
                        <span className="text-emerald-600 flex items-center gap-1">
                          <Scissors size={10} /> + {(info.servizi.find(x => x.id === s.servizio_abbinato_online_id) ?? info.serviziAbbinati?.find(x => x.id === s.servizio_abbinato_online_id))?.nome ?? 'abbinato'}
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-stone-400 flex-shrink-0" />
                </button>
              ));
              })()}
              <BackBtn onClick={() => setStep('data')} />
            </div>
          </Card>
        )}

        {/* STEP: Ora */}
        {step === 'ora' && (
          <Card title="Scegli l'orario" subtitle={`${chiunque ? 'Chiunque di noi' : parrucchiere?.nome} · ${dateLabel(dataSelezionata)}`}>
            {loadingSlot ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-7 h-7 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : slotDisponibili.length === 0 ? (
              <div className="text-center py-10">
                <p className="text-stone-500 text-sm mb-4">Nessun orario disponibile in questa data per {servizio?.nome}.</p>
                <button onClick={() => setStep('data')} className="text-emerald-600 text-sm font-medium underline">
                  Scegli un'altra data
                </button>
              </div>
            ) : (
              <div>
                <div className="grid grid-cols-4 gap-2">
                  {slotDisponibili.map(slot => (
                    <button
                      key={slot}
                      onClick={() => handleOraSelect(slot)}
                      className="py-3 rounded-xl border border-stone-200 bg-white text-sm font-medium text-stone-700 hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-700 transition-all"
                    >
                      {slot}
                    </button>
                  ))}
                </div>
                <div className="mt-4">
                  <BackBtn onClick={() => setStep('servizio')} />
                </div>
              </div>
            )}
          </Card>
        )}

        {/* STEP: Parrucchiere abbinato */}
        {step === 'abbinato' && servizioAbbinato && (
          <Card
            title={`Chi fa la ${servizioAbbinato.nome}?`}
            subtitle={parrPrimarioOccupato
              ? `${parrucchiere?.nome} sarà lieto di servirti per ${servizio?.nome}, purtroppo dopo è occupato con un altro appuntamento e non potrà farti la ${servizioAbbinato.nome}. Scegli il parrucchiere per la tua ${servizioAbbinato.nome}.`
              : `Inizia alle ${
                  (() => {
                    const [h,m] = oraSelezionata.split(':').map(Number);
                    const tot = h*60 + m + servizio!.durata_minuti;
                    return `${pad(Math.floor(tot/60))}:${pad(tot%60)}`;
                  })()
                }`
            }
          >
            {loadingParr2 ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-7 h-7 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : parrLiberi.length === 0 ? (
              <div className="text-center py-10">
                <p className="text-stone-500 text-sm mb-4">Nessun parrucchiere disponibile per la {servizioAbbinato.nome} subito dopo. Scegli un altro orario.</p>
                <button onClick={() => setStep('ora')} className="text-emerald-600 text-sm font-medium underline">
                  Cambia orario
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {parrLiberi.map(p => (
                  <button
                    key={p.id}
                    onClick={() => { setParrucchiere2(p); setStep('riepilogo'); }}
                    className="w-full flex items-center gap-4 bg-white border border-stone-200 rounded-2xl p-4 hover:border-stone-300 hover:shadow-sm transition-all text-left"
                  >
                    <div className="w-10 h-10 rounded-full flex-shrink-0" style={{ backgroundColor: p.colore }} />
                    <span className="font-medium text-stone-800">{p.nome}</span>
                    <ChevronRight size={16} className="ml-auto text-stone-400" />
                  </button>
                ))}
                <BackBtn onClick={() => setStep('ora')} />
              </div>
            )}
          </Card>
        )}

        {/* STEP: Riepilogo */}
        {step === 'riepilogo' && (
          <Card title="Riepilogo" subtitle="Conferma la tua richiesta">
            <div className="space-y-4">
              {submitError && (
                <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{submitError}</p>
              )}

              {/* Client */}
              <div className="bg-stone-50 rounded-2xl p-4 space-y-2">
                <div className="flex items-center gap-2 text-stone-500 mb-2">
                  <User size={14} />
                  <span className="text-xs font-semibold uppercase tracking-wide">Cliente</span>
                </div>
                <p className="font-semibold text-stone-800">{nome} {cognome}</p>
                <p className="text-sm text-stone-500 flex items-center gap-1.5"><Phone size={12} />{telefono}</p>
              </div>

              {/* Appointment 1 */}
              <div className="bg-stone-50 rounded-2xl p-4 space-y-2">
                <div className="flex items-center gap-2 text-stone-500 mb-2">
                  <Calendar size={14} />
                  <span className="text-xs font-semibold uppercase tracking-wide">Appuntamento</span>
                </div>
                {chiunque ? (
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-amber-400 flex-shrink-0" />
                    <span className="font-medium text-amber-800">Chiunque di noi</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: parrucchiere?.colore }} />
                    <span className="font-medium text-stone-800">{parrucchiere?.nome}</span>
                  </div>
                )}
                <p className="text-sm text-stone-600">{servizio?.nome}</p>
                <p className="text-sm text-stone-500 flex items-center gap-1.5">
                  <Clock size={12} />
                  {dateLabel(dataSelezionata)} alle {oraSelezionata}
                  {' · '}{servizio?.durata_minuti} min
                </p>
              </div>

              {/* Appointment 2 (abbinato) */}
              {parrucchiere2 && servizioAbbinato && (
                <div className="bg-emerald-50 rounded-2xl p-4 space-y-2 border border-emerald-200">
                  <div className="flex items-center gap-2 text-emerald-600 mb-2">
                    <Scissors size={14} />
                    <span className="text-xs font-semibold uppercase tracking-wide">Servizio abbinato</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: parrucchiere2.colore }} />
                    <span className="font-medium text-stone-800">{parrucchiere2.nome}</span>
                  </div>
                  <p className="text-sm text-stone-600">{servizioAbbinato.nome}</p>
                  <p className="text-sm text-stone-500 flex items-center gap-1.5">
                    <Clock size={12} />
                    {(() => {
                      const [h,m] = oraSelezionata.split(':').map(Number);
                      const tot = h*60 + m + servizio!.durata_minuti;
                      return `${pad(Math.floor(tot/60))}:${pad(tot%60)}`;
                    })()}
                    {' · '}{servizioAbbinato.durata_minuti} min
                  </p>
                </div>
              )}

              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                <p className="text-xs text-amber-800">
                  Questa è una <strong>richiesta di prenotazione</strong>. Non è confermata finché non ricevi un messaggio WhatsApp di conferma dal salone.
                </p>
              </div>

              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full py-4 bg-emerald-600 text-white font-semibold rounded-2xl hover:bg-emerald-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>Invia richiesta<ChevronRight size={18} /></>
                )}
              </button>
              <BackBtn onClick={() => setStep(chiunque ? 'ora' : (servizioAbbinato ? 'abbinato' : 'ora'))} />
            </div>
          </Card>
        )}

        {/* STEP: Successo */}
        {step === 'successo' && (
          <div className="text-center py-12">
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Check size={36} className="text-emerald-600" />
            </div>
            <h2 className="text-2xl font-bold text-stone-800 mb-3">Richiesta inviata!</h2>
            <p className="text-stone-500 max-w-xs mx-auto mb-8">
              La tua richiesta per {servizio?.nome} il {dateLabel(dataSelezionata)} alle {oraSelezionata} è stata inviata. Attendi la conferma via WhatsApp.
            </p>
            <div className="flex flex-col gap-3 max-w-xs mx-auto">
              <button
                onClick={() => {
                  setParrucchiere(null);
                  setDataSelezionata('');
                  setOraSelezionata('');
                  setServizio(null);
                  setParrucchiere2(null);
                  setParrPrimarioOccupato(false);
                  setStep('parrucchiere');
                }}
                className="px-8 py-3 bg-stone-800 text-white font-medium rounded-2xl hover:bg-stone-900 transition-colors flex items-center justify-center gap-2"
              >
                <CalendarPlus size={16} />
                Nuova prenotazione
              </button>
              <button
                onClick={() => {
                  setMsgTesto('');
                  setMsgFotos([]);
                  setMsgError('');
                  setStep('scrivici');
                }}
                className="px-8 py-3 bg-sky-500 text-white font-medium rounded-2xl hover:bg-sky-600 transition-colors flex items-center justify-center gap-2"
              >
                <MessageCircle size={16} />
                Scrivici
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Lightbox foto */}
      {msgZoomUrl && (
        <div
          className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setMsgZoomUrl(null)}
        >
          <button
            onClick={() => setMsgZoomUrl(null)}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          >
            <X size={22} className="text-white" />
          </button>
          <img
            src={msgZoomUrl}
            className="max-w-full max-h-full rounded-2xl object-contain"
            style={{ maxHeight: '90vh', maxWidth: '90vw' }}
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

// ─── Le mie carte ─────────────────────────────────────────────────────────────

function MieCarteStep({
  data, loading, error, onBack, onRetry, onRegala, onSegnaGiftPassDonata, nomeSalone,
}: {
  data: MieCarteData | null;
  loading: boolean;
  error: string;
  onBack: () => void;
  onRetry: () => void;
  onRegala: (cartaId: string) => Promise<boolean>;
  onSegnaGiftPassDonata: (giftPassId: string) => Promise<boolean>;
  nomeSalone: string;
}) {
  if (loading) return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-4">
        <p className="text-xl font-bold text-stone-800">Le mie carte</p>
      </div>
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
      </div>
      <BackBtn onClick={onBack} />
    </div>
  );

  if (error) return (
    <div className="space-y-4">
      <p className="text-xl font-bold text-stone-800">Le mie carte</p>
      <div className="bg-red-50 border border-red-200 rounded-2xl p-5 text-center">
        <p className="text-sm text-red-600 mb-3">{error}</p>
        <button onClick={onRetry} className="text-sm font-medium text-red-600 underline">Riprova</button>
      </div>
      <BackBtn onClick={onBack} />
    </div>
  );

  const hasCarte = data && (
    (data.cartePremium?.length ?? 0) > 0 ||
    (data.carteInfinity?.length ?? 0) > 0 ||
    (data.carteUsaEGetta?.length ?? 0) > 0 ||
    (data.giftPassDonatore?.length ?? 0) > 0 ||
    (data.giftPassRicevente?.length ?? 0) > 0
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <p className="text-xl font-bold text-stone-800">Le mie carte</p>
      </div>

      {!hasCarte && (
        <div className="bg-white rounded-3xl border border-stone-200 shadow-sm p-10 text-center">
          <div className="w-14 h-14 bg-stone-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <CreditCard size={24} className="text-stone-300" />
          </div>
          <p className="font-semibold text-stone-500">Nessuna carta associata</p>
          <p className="text-sm text-stone-400 mt-1">Non hai carte associate a questo numero di telefono.</p>
        </div>
      )}

      {(data?.cartePremium ?? []).map(carta => (
        <CartaPremiumCard key={carta.id} carta={carta} cliente={data?.cliente} />
      ))}

      {(data?.carteInfinity ?? []).map(carta => (
        <CartaInfinityCard key={carta.id} carta={carta} cliente={data?.cliente} />
      ))}

      {(data?.carteUsaEGetta ?? []).map(carta => (
        <CartaUsaEGettaCard
          key={carta.id}
          carta={carta}
          salone={data?.salone ?? {}}
          nomeSalone={nomeSalone}
          onRegala={onRegala}
        />
      ))}

      {(data?.giftPassDonatore ?? []).map(gp => (
        <GiftPassCard key={gp.id} gp={gp} salone={data?.salone ?? {}} nomeSalone={nomeSalone} compratore_nome={`${data?.cliente?.nome ?? ''} ${data?.cliente?.cognome ?? ''}`.trim()} onSegnaGiftPassDonata={onSegnaGiftPassDonata} />
      ))}

      {(data?.giftPassRicevente ?? []).map(gp => (
        <GiftPassCard key={gp.id} gp={gp} salone={data?.salone ?? {}} nomeSalone={nomeSalone} compratore_nome="" onSegnaGiftPassDonata={onSegnaGiftPassDonata} />
      ))}

      <BackBtn onClick={onBack} />
    </div>
  );
}

function CartaPremiumCard({ carta, cliente }: { carta: CartaPremium; cliente: MieCarteData['cliente'] }) {
  const [showMovimenti, setShowMovimenti] = useState(false);

  const movimenti = [
    ...carta.ricariche.map(r => ({ ...r, tipo: 'ricarica' as const, importo: r.importo })),
    ...carta.utilizzi.map(u => ({ ...u, tipo: 'utilizzo' as const, importo: u.importo_detratto })),
  ].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  return (
    <div className="space-y-3">
      {/* Card grafica nero/oro */}
      <div
        className="relative w-full rounded-3xl overflow-hidden shadow-xl"
        style={{
          background: 'linear-gradient(135deg, #111008 0%, #2a2000 25%, #1a1500 50%, #2d2200 75%, #0d0a00 100%)',
          minHeight: 210,
        }}
      >
        {/* Striscia oro orizzontale in alto */}
        <div className="absolute top-0 left-0 right-0 h-1" style={{ background: 'linear-gradient(90deg, #b8860b, #f5e17a, #d4af37, #f5e17a, #b8860b)' }} />
        {/* Pattern decorativo oro — più visibile */}
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: 'repeating-linear-gradient(45deg, #d4af37 0px, #d4af37 1px, transparent 0px, transparent 28px)',
          backgroundSize: '28px 28px',
        }} />
        {/* Alone oro grande in alto a destra */}
        <div className="absolute -right-6 -top-6 w-52 h-52 rounded-full" style={{ background: 'radial-gradient(circle, rgba(212,175,55,0.35) 0%, transparent 70%)' }} />
        {/* Alone oro piccolo in basso a sinistra */}
        <div className="absolute -left-4 -bottom-4 w-32 h-32 rounded-full" style={{ background: 'radial-gradient(circle, rgba(212,175,55,0.2) 0%, transparent 70%)' }} />

        <div className="relative p-6 flex flex-col h-full" style={{ minHeight: 210 }}>
          {/* Header */}
          <div className="flex items-start justify-between mb-auto">
            <div>
              <p className="text-xs font-bold tracking-[0.25em] uppercase" style={{ color: '#f5e17a', textShadow: '0 0 8px rgba(212,175,55,0.6)' }}>Carta Premium</p>
            </div>
            {/* Chip oro realistico */}
            <div className="w-12 h-9 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #b8860b 0%, #f5e17a 40%, #d4af37 60%, #8b6914 100%)', boxShadow: '0 2px 6px rgba(0,0,0,0.5)' }}>
              <div className="w-7 h-5 rounded-sm border" style={{ borderColor: 'rgba(139,105,20,0.6)', background: 'linear-gradient(135deg, #d4af37 0%, #f5e17a 50%, #b8860b 100%)' }} />
            </div>
          </div>

          {/* Dati cliente */}
          <div className="mt-8 mb-4">
            <p className="text-white font-bold text-lg tracking-wide" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>
              {cliente ? `${cliente.nome} ${cliente.cognome}` : '—'}
            </p>
            <p className="text-xs mt-1 font-mono tracking-[0.15em]" style={{ color: '#f5e17a' }}>
              {carta.codice}
            </p>
          </div>

          {/* Saldo */}
          <div className="flex items-end justify-between">
            <div>
              <p className="text-xs font-medium" style={{ color: 'rgba(245,225,122,0.7)' }}>Saldo disponibile</p>
              <p className="text-3xl font-bold" style={{ color: '#f5e17a', textShadow: '0 0 12px rgba(212,175,55,0.5)' }}>€ {carta.saldo.toFixed(2)}</p>
            </div>
          </div>
        </div>
        {/* Striscia oro in basso */}
        <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: 'linear-gradient(90deg, transparent, #d4af37, #f5e17a, #d4af37, transparent)' }} />
      </div>

      {/* Frase risparmio */}
      <div className="px-1">
        <p className="text-xs text-stone-500 italic leading-relaxed">
          La tua fiducia è il nostro privilegio. Grazie alla tua Carta Premium, finora hai già risparmiato:{' '}
          <span className="text-emerald-600 font-bold text-sm not-italic">€ {carta.risparmioTotale.toFixed(2)}</span>
        </p>
      </div>

      {/* Pulsante movimenti */}
      <button
        onClick={() => setShowMovimenti(v => !v)}
        className="w-full flex items-center justify-between bg-white border border-stone-200 rounded-2xl px-5 py-3.5 hover:border-stone-300 transition-all"
      >
        <div className="flex items-center gap-2">
          <TrendingUp size={16} className="text-stone-500" />
          <span className="font-semibold text-stone-700 text-sm">Movimenti</span>
          {movimenti.length > 0 && (
            <span className="text-xs bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full">{movimenti.length}</span>
          )}
        </div>
        {showMovimenti ? <ChevronUp size={16} className="text-stone-400" /> : <ChevronDown size={16} className="text-stone-400" />}
      </button>

      {showMovimenti && (
        <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden">
          {movimenti.length === 0 ? (
            <p className="text-sm text-stone-400 text-center py-8">Nessun movimento</p>
          ) : (
            <div className="divide-y divide-stone-100">
              {movimenti.map((m, i) => {
                const isFirst = i === 0 && m.tipo === 'ricarica';
                const nota = isFirst
                  ? null
                  : m.note && m.note.toLowerCase() !== 'carica iniziale' ? m.note : null;
                return (
                  <div key={i} className="flex items-center gap-3 px-5 py-3.5">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      m.tipo === 'ricarica' ? 'bg-green-100' : 'bg-stone-100'
                    }`}>
                      {m.tipo === 'ricarica'
                        ? <ArrowUpCircle size={16} className="text-green-500" />
                        : <ArrowDownCircle size={16} className="text-stone-400" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      {isFirst ? (
                        <p className="text-[11px] text-stone-400 font-medium">
                          Data attivazione della carta:{' '}
                          <span className="text-stone-600">
                            {new Date(m.created_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' })}
                          </span>
                        </p>
                      ) : (
                        <>
                          <p className={`text-sm font-bold ${m.tipo === 'ricarica' ? '' : 'text-stone-500'}`}
                            style={m.tipo === 'ricarica' ? { color: '#16a34a', textShadow: '0 0 6px rgba(34,197,94,0.25)' } : {}}>
                            {m.tipo === 'ricarica' ? '+' : '-'} € {m.importo.toFixed(2)}
                          </p>
                          <p className="text-[11px] text-stone-400">
                            {new Date(m.created_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })}
                            {nota ? ` · ${nota}` : ''}
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CartaInfinityCard({ carta, cliente }: { carta: CartaInfinity; cliente: MieCarteData['cliente'] }) {
  const sconto = carta.tipo_sconto === 'percentuale'
    ? `${carta.valore_sconto}%`
    : `€ ${carta.valore_sconto.toFixed(2)}`;

  return (
    <div className="space-y-3">
      {/* Card grafica bianca/argento */}
      <div
        className="relative w-full rounded-3xl overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #ffffff 0%, #f0f0f0 30%, #fafafa 60%, #e8e8e8 100%)',
          minHeight: 210,
          boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08)',
          border: '1px solid rgba(180,180,180,0.4)',
        }}
      >
        {/* Striscia argento in alto */}
        <div className="absolute top-0 left-0 right-0 h-1" style={{ background: 'linear-gradient(90deg, #c0c0c0, #e8e8e8, #f5f5f5, #e8e8e8, #c0c0c0)' }} />
        {/* Pattern decorativo diagonale sottile */}
        <div className="absolute inset-0" style={{
          backgroundImage: 'repeating-linear-gradient(45deg, rgba(160,160,160,0.07) 0px, rgba(160,160,160,0.07) 1px, transparent 0px, transparent 28px)',
          backgroundSize: '28px 28px',
        }} />
        {/* Alone argentato grande in alto a destra */}
        <div className="absolute -right-6 -top-6 w-52 h-52 rounded-full" style={{ background: 'radial-gradient(circle, rgba(192,192,192,0.3) 0%, transparent 70%)' }} />
        {/* Riflesso bianco in basso a sinistra */}
        <div className="absolute -left-4 -bottom-4 w-36 h-36 rounded-full" style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.8) 0%, transparent 70%)' }} />

        <div className="relative p-6 flex flex-col" style={{ minHeight: 210 }}>
          {/* Header */}
          <div className="flex items-start justify-between mb-auto">
            <div>
              <p className="text-xs font-bold tracking-[0.25em] uppercase" style={{ color: '#888888' }}>Carta Sconto Infinity</p>
            </div>
            {/* Chip argento realistico */}
            <div className="w-12 h-9 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #b0b0b0 0%, #e8e8e8 40%, #c8c8c8 60%, #989898 100%)', boxShadow: '0 2px 6px rgba(0,0,0,0.2), inset 0 1px 1px rgba(255,255,255,0.6)' }}>
              <div className="w-7 h-5 rounded-sm border" style={{ borderColor: 'rgba(140,140,140,0.5)', background: 'linear-gradient(135deg, #d0d0d0 0%, #f0f0f0 50%, #b8b8b8 100%)' }} />
            </div>
          </div>

          {/* Dati cliente */}
          <div className="mt-8 mb-4">
            <p className="font-bold text-lg tracking-wide" style={{ color: '#2a2a2a' }}>
              {cliente ? `${cliente.nome} ${cliente.cognome}` : '—'}
            </p>
            <p className="text-xs mt-1 font-mono tracking-[0.15em]" style={{ color: '#888888' }}>
              {carta.codice}
            </p>
          </div>

          {/* Sconto */}
          <div className="flex items-end justify-between">
            <div>
              <p className="text-xs font-medium" style={{ color: '#999999' }}>Sconto applicato</p>
              <p className="text-3xl font-bold" style={{ color: '#3a3a3a' }}>{sconto}</p>
            </div>
            <div className="text-xs italic px-3 py-1 rounded-full" style={{ color: '#888888', background: 'rgba(0,0,0,0.05)', border: '1px solid rgba(0,0,0,0.1)' }}>Non scade</div>
          </div>
        </div>
        {/* Striscia argento in basso */}
        <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: 'linear-gradient(90deg, transparent, #c8c8c8, #e0e0e0, #c8c8c8, transparent)' }} />
      </div>

      {/* Frase motivazionale */}
      <div className="px-1">
        <p className="text-xs text-stone-500 italic leading-relaxed">
          Il salone ti ha riservato uno sconto esclusivo su ogni visita.{' '}
          <span className="text-stone-700 font-semibold not-italic">{sconto} di sconto</span> ad ogni appuntamento, senza limiti di utilizzo.
        </p>
      </div>
    </div>
  );
}

function CartaUsaEGettaCard({
  carta, salone, nomeSalone, onRegala,
}: {
  carta: CartaUsaEGetta;
  salone: Record<string, string>;
  nomeSalone: string;
  onRegala: (cartaId: string) => Promise<boolean>;
}) {
  const [showRegala, setShowRegala] = useState(false);
  const [msgRegala, setMsgRegala] = useState('');
  const [regalando, setRegalando] = useState(false);
  const [regalato, setRegalato] = useState(false);
  const [erroreRegala, setErroreRegala] = useState('');

  const telefono = salone['azienda_telefono'] ?? '';
  const maps = salone['azienda_google_maps'] ?? '';
  const sito = salone['azienda_sito_prenotazioni'] ?? '';

  const scontoDesc = carta.tipo_sconto === 'percentuale'
    ? `${carta.valore_sconto}%`
    : `€ ${carta.valore_sconto?.toFixed(2)}`;

  const msgBase = `Ciao 😊 Stefano e Federico del salone "${nomeSalone}", mi hanno dato la possibilità di dedicare un invito a una persona cara, per farle provare l'entusiasmo e la cura con cui ascoltano me e si prendono cura dei miei capelli, quindi ho pensato che ti facesse piacere ricevere il loro invito di benvenuto insieme alla mia carta sconto monouso per il tuo primo appuntamento.\n\nQuesto è il codice da comunicare al momento del pagamento: ${carta.codice}\nLa carta include uno sconto del ${scontoDesc} sul tuo primo appuntamento.\n\nPer fissare il tuo appuntamento e dedicarti il tempo corretto, telefona in salone al ${telefono} oppure richiedi una consulenza direttamente online su ${sito}. I ragazzi saranno davvero lieti di conoscerti!\n\nEcco dove si trova il salone sulla mappa: ${maps}\n\nSpero che ti concederai questo momento di totale relax.`;

  useEffect(() => {
    if (showRegala) setMsgRegala(msgBase);
  }, [showRegala, msgBase]);

  async function handleConfermaRegala() {
    setRegalando(true);
    setErroreRegala('');
    const ok = await onRegala(carta.id);
    if (ok) {
      const waText = encodeURIComponent(msgRegala);
      window.location.href = `whatsapp://send?text=${waText}`;
      setRegalato(true);
      setShowRegala(false);
    } else {
      setErroreRegala('Errore nel trasferimento. Riprova.');
    }
    setRegalando(false);
  }

  if (regalato) return (
    <div className="bg-stone-50 border border-stone-200 rounded-3xl p-6 text-center">
      <Check size={24} className="text-emerald-500 mx-auto mb-2" />
      <p className="text-sm font-semibold text-stone-700">Carta regalata con successo!</p>
    </div>
  );

  return (
    <div className="space-y-3">
      {/* Card grafica tiffany/verde bosco */}
      <div
        className="relative w-full rounded-3xl overflow-hidden shadow-xl"
        style={{
          background: 'linear-gradient(135deg, #0abfbf 0%, #81d8d0 50%, #2e8b57 100%)',
          minHeight: 180,
        }}
      >
        <div className="absolute -right-8 -bottom-8 w-40 h-40 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }} />
        <div className="absolute -left-4 -top-4 w-24 h-24 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }} />

        <div className="relative p-6 flex flex-col" style={{ minHeight: 180 }}>
          <div className="flex items-start justify-between mb-auto">
            <p className="text-xs font-semibold tracking-[0.2em] uppercase text-white/80">Carta Sconto</p>
            <Gift size={20} className="text-white/70" />
          </div>
          <div className="mt-6">
            <p className="text-xs text-white/60 mb-1">Codice carta</p>
            <p className="text-white font-bold text-xl font-mono tracking-widest">{carta.codice}</p>
            <div className="flex flex-wrap gap-1.5 mt-3">
              <span className="text-xs bg-white/20 text-white px-2.5 py-0.5 rounded-full font-medium">Monouso</span>
              {carta.tipo_sconto === 'percentuale'
                ? <span className="text-xs bg-white/20 text-white px-2.5 py-0.5 rounded-full font-medium">Sconto {carta.valore_sconto}%</span>
                : <span className="text-xs bg-white/20 text-white px-2.5 py-0.5 rounded-full font-medium">Sconto € {carta.valore_sconto?.toFixed(2)}</span>
              }
            </div>
          </div>
        </div>
      </div>

      {/* Pulsante regala */}
      <button
        onClick={() => setShowRegala(true)}
        className="w-full flex items-center justify-center gap-2 bg-white border-2 border-teal-300 text-teal-700 font-semibold rounded-2xl px-5 py-3.5 hover:bg-teal-50 hover:border-teal-400 transition-all"
      >
        <Gift size={17} />
        Regala a un'amica/o
      </button>

      {/* Modale regala */}
      {showRegala && (
        <div className="fixed inset-0 z-[200] bg-black/60 flex items-end sm:items-center justify-center p-4" onClick={() => setShowRegala(false)}>
          <div
            className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <p className="font-bold text-stone-800 text-lg">Regala la carta sconto</p>
                <button onClick={() => setShowRegala(false)} className="p-1.5 rounded-xl hover:bg-stone-100 transition-colors">
                  <X size={18} className="text-stone-400" />
                </button>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
                <p className="text-xs text-amber-800 leading-relaxed">
                  <strong>Attenzione:</strong> dopo aver confermato, la carta sconto non sarà più tua. Se dovessi esserti sbagliata/o, contattaci e ti riassegneremo una nuova carta sconto.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1.5">Anteprima messaggio (modificabile)</label>
                <textarea
                  value={msgRegala}
                  onChange={e => setMsgRegala(e.target.value)}
                  rows={10}
                  className="w-full border border-stone-200 rounded-2xl px-4 py-3 text-sm text-stone-700 focus:outline-none focus:border-teal-400 resize-none leading-relaxed"
                />
              </div>

              {erroreRegala && (
                <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-2">{erroreRegala}</p>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setShowRegala(false)}
                  className="flex-1 py-3 border border-stone-200 text-stone-600 font-semibold rounded-2xl hover:bg-stone-50 transition-colors"
                >
                  Annulla
                </button>
                <button
                  onClick={handleConfermaRegala}
                  disabled={regalando}
                  className="flex-1 py-3 bg-teal-500 text-white font-semibold rounded-2xl hover:bg-teal-600 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {regalando
                    ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    : <><Gift size={15} /> Sì, regala</>
                  }
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function GiftPassCard({
  gp, salone, nomeSalone, compratore_nome, onSegnaGiftPassDonata,
}: {
  gp: GiftPass;
  salone: Record<string, string>;
  nomeSalone: string;
  compratore_nome: string;
  onSegnaGiftPassDonata: (giftPassId: string) => Promise<boolean>;
}) {
  const [showDona, setShowDona] = useState(false);
  const [msgDona, setMsgDona] = useState('');

  const isDonatore = gp.tipo_carta === 'gift_pass_donatore';
  const valore = gp.tipo === 'prodotto'
    ? `${gp.prodotti_rivendita_catalogo?.categoria ? gp.prodotti_rivendita_catalogo.categoria + ' · ' : ''}${gp.prodotto_nome ?? 'Prodotto omaggio'}`
    : `€${gp.valore_euro ?? 0}`;

  const scadenzaLabel = (() => {
    const fmt = (d: Date) => d.toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' });
    if (isDonatore) {
      if (gp.donata) return 'Codice inviato';
      if (!gp.scadenza_ritiro_giorni || gp.scadenza_ritiro_giorni <= 0) return 'Nessuna scadenza';
      const d = new Date(gp.created_at);
      d.setDate(d.getDate() + gp.scadenza_ritiro_giorni);
      return `Da donare entro il ${fmt(d)}`;
    }
    if (!gp.scadenza_uso) return 'Nessuna scadenza';
    return `Da riscattare entro il ${fmt(new Date(gp.scadenza_uso))}`;
  })();

  const telefono = salone['azienda_telefono'] ?? '';
  const sito = salone['azienda_sito_prenotazioni'] ?? '';
  const maps = salone['azienda_google_maps'] ?? '';

  const msgBase = (() => {
    const sn = nomeSalone || 'il salone';
    const codice = gp.codice;
    const tel = telefono;
    const link = sito;
    const mapLink = maps;
    if (gp.tipo === 'prodotto') {
      return `Ciao 😊 Stefano e Federico del salone "${sn}", mi hanno dato la possibilità di dedicare un invito a una persona cara, per farle provare l'entusiasmo e la cura con cui ascoltano me e si prendono cura dei miei capelli, quindi ho pensato che ti facesse piacere ricevere il loro invito di benvenuto insieme al mio Gift Pass per ricevere un prodotto speciale in omaggio durante il tuo primo appuntamento.\n\nQuesto è il codice da comunicare in salone: ${codice}\n(Il pass è valido abbinato a un qualsiasi servizio effettuato in salone)\n\nPer fissare il tuo appuntamento e dedicarti il tempo corretto, telefona in salone al ${tel} oppure richiedi una consulenza direttamente online su ${link}. I ragazzi saranno davvero lieti di conoscerti!\n\nEcco dove si trova il salone sulla mappa: ${mapLink}\n\nSpero che ti concederai questo momento di totale relax!`;
    } else if (gp.occasione === 'compleanno') {
      return `Ciao 😊 Per il tuo compleanno ho voluto regalarti un'esperienza speciale da Stefano e Federico del salone "${sn}". Sono i ragazzi che si prendono cura dei miei capelli e volevo farti provare lo stesso entusiasmo, l'ascolto e la cura che dedicano a me ogni volta.\n\nTi lascio questo invito di benvenuto insieme al tuo Gift Pass con un bonus di €${gp.valore_euro ?? 0} in regalo, da spendere come vuoi nel salone per festeggiare il tuo giorno speciale.\n\nQuesto è il codice da comunicare al momento del pagamento: ${codice}\n\nPer fissare il tuo appuntamento e dedicarti il tempo corretto, telefona in salone al ${tel} oppure richiedi una consulenza direttamente online su ${link}. I ragazzi saranno davvero lieti di conoscerti e festeggiarti!\n\nEcco dove si trova il salone sulla mappa: ${mapLink}\n\nSpero che ti concederai questo momento di totale relax!`;
    } else if (gp.occasione === 'regalo') {
      return `Ciao 😊 Ho pensato di dedicare un pensiero speciale a te che sei una persona importante, per farti provare l'entusiasmo e la cura con cui Stefano e Federico del salone "${sn}" ascoltano me e si prendono cura dei miei capelli, quindi ho pensato che ti facesse piacere ricevere questo benvenuto insieme al tuo Gift Pass con un bonus di €${gp.valore_euro ?? 0} in regalo, da spendere come vuoi nel salone per dedicarti un momento tutto tuo.\n\nQuesto è il codice da comunicare al momento del pagamento: ${codice}\n\nPer fissare il tuo appuntamento e dedicarti il tempo corretto, telefona in salone al ${tel} oppure richiedi una consulenza direttamente online su ${link}. I ragazzi saranno davvero lieti di conoscerti!\n\nEcco dove si trova il salone sulla mappa: ${mapLink}\n\nSpero che ti concederai questo momento di totale relax.`;
    } else {
      return `Ciao 😊 Stefano e Federico del salone "${sn}", mi hanno dato la possibilità di dedicare un invito a una persona cara, per farle provare l'entusiasmo e la cura con cui ascoltano me e si prendono cura dei miei capelli, quindi ho pensato che ti facesse piacere ricevere il loro invito di benvenuto insieme al mio Gift Pass con un bonus di €${gp.valore_euro ?? 0} in regalo da spendere come vuoi nel salone per il tuo primo appuntamento.\n\nQuesto è il codice da comunicare al momento del pagamento: ${codice}\n\nPer fissare il tuo appuntamento e dedicarti il tempo corretto, telefona in salone al ${tel} oppure richiedi una consulenza direttamente online su ${link}. I ragazzi saranno davvero lieti di conoscerti!\n\nEcco dove si trova il salone sulla mappa: ${mapLink}\n\nSpero che ti concederai questo momento di totale relax!`;
    }
  })();

  function openDona() {
    setMsgDona(msgBase);
    setShowDona(true);
  }

  async function handleInviaDona() {
    await onSegnaGiftPassDonata(gp.id);
    const waText = encodeURIComponent(msgDona);
    window.location.href = `whatsapp://send?text=${waText}`;
    setShowDona(false);
  }

  // Oro rosa palette
  const roseGold = {
    base: 'linear-gradient(135deg, #f9e8e0 0%, #f2d5c8 25%, #f7e0d4 50%, #eddac9 75%, #f5e4d8 100%)',
    stripe: 'linear-gradient(90deg, #c9897a, #e8b4a0, #d4a090, #e8b4a0, #c9897a)',
    chip: 'linear-gradient(135deg, #c9897a 0%, #e8b4a0 40%, #d4966a 60%, #b8705a 100%)',
    chipInner: 'linear-gradient(135deg, #e8b4a0 0%, #f5d0be 50%, #c9897a 100%)',
    glow1: 'radial-gradient(circle, rgba(201,137,122,0.25) 0%, transparent 70%)',
    glow2: 'radial-gradient(circle, rgba(232,180,160,0.18) 0%, transparent 70%)',
    pattern: 'repeating-linear-gradient(45deg, rgba(180,100,80,0.06) 0px, rgba(180,100,80,0.06) 1px, transparent 0px, transparent 28px)',
    title: '#8b4a3a',
    code: '#7a3a2a',
    body: '#5a3028',
    accent: '#c9897a',
    badge: 'rgba(139,74,58,0.12)',
    badgeBorder: 'rgba(139,74,58,0.25)',
  };

  return (
    <div className="space-y-3">
      {/* Card grafica cipria/oro rosa */}
      <div
        className="relative w-full rounded-3xl overflow-hidden shadow-xl"
        style={{
          background: roseGold.base,
          minHeight: 210,
          boxShadow: '0 8px 32px rgba(180,100,80,0.18), 0 2px 8px rgba(180,100,80,0.1)',
          border: '1px solid rgba(201,137,122,0.35)',
        }}
      >
        {/* Striscia oro rosa in alto */}
        <div className="absolute top-0 left-0 right-0 h-1" style={{ background: roseGold.stripe }} />
        {/* Pattern diagonale sottile */}
        <div className="absolute inset-0" style={{ backgroundImage: roseGold.pattern, backgroundSize: '28px 28px' }} />
        {/* Alone grande in alto a destra */}
        <div className="absolute -right-6 -top-6 w-52 h-52 rounded-full" style={{ background: roseGold.glow1 }} />
        {/* Alone piccolo in basso a sinistra */}
        <div className="absolute -left-4 -bottom-4 w-36 h-36 rounded-full" style={{ background: roseGold.glow2 }} />

        <div className="relative p-6 flex flex-col" style={{ minHeight: 210 }}>
          {/* Header */}
          <div className="flex items-start justify-between mb-auto">
            <div>
              <p className="text-xs font-bold tracking-[0.25em] uppercase" style={{ color: roseGold.title }}>
                Gift Pass
              </p>
              <p className="text-xs mt-0.5 font-medium" style={{ color: roseGold.accent }}>
                {isDonatore
                  ? (gp.donata ? `Donata da ${compratore_nome}` : 'Da regalare')
                  : 'Ricevuta'}
              </p>
            </div>
            {/* Chip oro rosa */}
            <div className="w-12 h-9 rounded-lg flex items-center justify-center" style={{ background: roseGold.chip, boxShadow: '0 2px 6px rgba(139,74,58,0.3), inset 0 1px 1px rgba(255,255,255,0.4)' }}>
              <div className="w-7 h-5 rounded-sm border" style={{ borderColor: 'rgba(139,74,58,0.4)', background: roseGold.chipInner }} />
            </div>
          </div>

          {/* Dati */}
          <div className="mt-6 mb-3">
            {isDonatore && gp.destinataria_nome && (
              <p className="text-xs font-medium mb-1" style={{ color: roseGold.accent }}>
                Per: {gp.destinataria_nome}
              </p>
            )}
            <p className="text-xs mb-1 font-mono tracking-[0.15em]" style={{ color: roseGold.code }}>
              {gp.codice}
            </p>
          </div>

          {/* Footer: valore + scadenza */}
          <div className="flex items-end justify-between">
            <div>
              <p className="text-xs font-medium mb-0.5" style={{ color: roseGold.accent }}>Valore</p>
              <p className="text-2xl font-bold" style={{ color: roseGold.body }}>{valore}</p>
            </div>
            <div className="text-xs italic px-3 py-1 rounded-full" style={{ color: roseGold.title, background: roseGold.badge, border: `1px solid ${roseGold.badgeBorder}` }}>
              {scadenzaLabel}
            </div>
          </div>
        </div>

        {/* Striscia oro rosa in basso */}
        <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: 'linear-gradient(90deg, transparent, #d4a090, #e8b4a0, #d4a090, transparent)' }} />
      </div>

      {/* Messaggio descrittivo */}
      <div className="px-1">
        {isDonatore ? (
          gp.donata ? (
            <p className="text-xs text-stone-500 italic leading-relaxed">
              Hai già inviato questo Gift Pass. La destinataria potrà usarlo in salone mostrando il codice <span className="font-mono font-semibold not-italic text-stone-700">{gp.codice}</span> al momento del pagamento.
            </p>
          ) : (
            <p className="text-xs text-stone-500 italic leading-relaxed">
              Hai acquistato questa Gift Pass da <span className="text-stone-700 font-semibold not-italic">{valore}</span> da regalare.
              Condividi il codice con chi vuoi per permetterle di usarla in salone.
            </p>
          )
        ) : (
          <p className="text-xs text-stone-500 italic leading-relaxed">
            Hai ricevuto questa Gift Pass da <span className="text-stone-700 font-semibold not-italic">{valore}</span>.
            Mostra il codice <span className="font-mono font-semibold not-italic text-stone-700">{gp.codice}</span> al momento del pagamento in salone.
          </p>
        )}
      </div>

      {/* Bottone dona (solo se donatore e non ancora donata) */}
      {isDonatore && !gp.donata && (
        <button
          onClick={openDona}
          className="w-full flex items-center justify-center gap-2 font-semibold rounded-2xl px-5 py-3.5 transition-all"
          style={{ background: 'white', border: '2px solid #e8b4a0', color: '#8b4a3a' }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#fdf0eb'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'white'; }}
        >
          <Gift size={17} />
          Invia il codice via WhatsApp
        </button>
      )}

      {/* Modale dona */}
      {showDona && (
        <div className="fixed inset-0 z-[200] bg-black/60 flex items-end sm:items-center justify-center p-4" onClick={() => setShowDona(false)}>
          <div
            className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <p className="font-bold text-stone-800 text-lg">Invia il Gift Pass</p>
                <button onClick={() => setShowDona(false)} className="p-1.5 rounded-xl hover:bg-stone-100 transition-colors">
                  <X size={18} className="text-stone-400" />
                </button>
              </div>

              <div className="rounded-2xl px-4 py-3" style={{ background: '#fdf0eb', border: '1px solid #e8b4a0' }}>
                <p className="text-xs leading-relaxed" style={{ color: '#7a3a2a' }}>
                  Il codice <strong>{gp.codice}</strong> sarà incluso nel messaggio. La persona a cui lo invii potrà usarlo in salone al momento del pagamento.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1.5">Anteprima messaggio (modificabile)</label>
                <textarea
                  value={msgDona}
                  onChange={e => setMsgDona(e.target.value)}
                  rows={10}
                  className="w-full border border-stone-200 rounded-2xl px-4 py-3 text-sm text-stone-700 focus:outline-none resize-none leading-relaxed"
                  style={{ outlineColor: '#e8b4a0' }}
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowDona(false)}
                  className="flex-1 py-3 border border-stone-200 text-stone-600 font-semibold rounded-2xl hover:bg-stone-50 transition-colors"
                >
                  Annulla
                </button>
                <button
                  onClick={handleInviaDona}
                  className="flex-1 py-3 text-white font-semibold rounded-2xl transition-colors flex items-center justify-center gap-2"
                  style={{ background: '#c9897a' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#b8705a'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#c9897a'; }}
                >
                  <Gift size={15} />
                  Apri WhatsApp
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MieiMessaggiStep({
  messaggi, loading, error, onTogglePreferito, onFotoZoom, onBack, onRetry, suonoAttivo, onToggleSuono,
}: {
  messaggi: MioMessaggio[];
  loading: boolean;
  error: string;
  onTogglePreferito: (id: string, val: boolean) => void;
  onFotoZoom: (url: string) => void;
  onBack: () => void;
  onRetry: () => void;
  suonoAttivo: boolean;
  onToggleSuono: () => void;
}) {
  const [aperti, setAperti] = useState<Set<string>>(new Set());
  const [soloPreferiti, setSoloPreferiti] = useState(false);

  function toggle(id: string) {
    setAperti(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const lista = soloPreferiti ? messaggi.filter(m => m.preferito) : messaggi;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="text-xl font-bold text-stone-800">I miei messaggi</p>
          <p className="text-sm text-stone-400 mt-0.5">Le tue richieste inviate al salone</p>
        </div>
        <button
          onClick={onToggleSuono}
          className={`flex flex-col items-center gap-0.5 p-2 rounded-xl border transition-all ${
            suonoAttivo
              ? 'border-emerald-200 bg-emerald-50 text-emerald-600'
              : 'border-stone-200 bg-stone-50 text-stone-400'
          }`}
          title={suonoAttivo ? 'Avviso sonoro attivo — tocca per disattivare' : 'Avviso sonoro disattivato — tocca per attivare'}
        >
          {suonoAttivo ? <Bell size={18} /> : <BellOff size={18} />}
          <span className="text-[9px] font-medium leading-none">{suonoAttivo ? 'Suono on' : 'Suono off'}</span>
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!loading && error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5 text-center">
          <p className="text-sm text-red-600 mb-3">{error}</p>
          <button onClick={onRetry} className="text-sm font-medium text-red-600 underline">Riprova</button>
        </div>
      )}

      {!loading && !error && (
        <>
          {messaggi.length > 0 && (
            <div className="flex justify-end">
              <button
                onClick={() => setSoloPreferiti(v => !v)}
                className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-xl border transition-colors ${
                  soloPreferiti
                    ? 'bg-amber-50 border-amber-300 text-amber-700'
                    : 'border-stone-200 text-stone-500 hover:border-amber-300 hover:text-amber-600'
                }`}
              >
                <Star size={12} className={soloPreferiti ? 'fill-amber-400 text-amber-400' : ''} />
                {soloPreferiti ? 'Tutti' : 'Solo preferiti'}
              </button>
            </div>
          )}

          {lista.length === 0 && (
            <div className="bg-white rounded-3xl border border-stone-200 shadow-sm p-10 text-center">
              <div className="w-14 h-14 bg-stone-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                {soloPreferiti
                  ? <Star size={24} className="text-stone-300" />
                  : <Inbox size={24} className="text-stone-300" />
                }
              </div>
              <p className="font-semibold text-stone-500">
                {soloPreferiti ? 'Nessun messaggio preferito' : 'Nessun messaggio'}
              </p>
              <p className="text-sm text-stone-400 mt-1">
                {soloPreferiti ? 'Tocca la stella su un messaggio per aggiungerlo ai preferiti.' : 'Non hai ancora inviato messaggi al salone.'}
              </p>
            </div>
          )}

          <div className="space-y-3">
            {lista.map(m => (
              <div
                key={m.id}
                className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden"
              >
                {/* Header */}
                <div className="flex items-center gap-2 px-4 py-3.5">
                  <button
                    onClick={() => toggle(m.id)}
                    className="flex-1 flex items-center gap-3 text-left min-w-0"
                  >
                    <div className="w-9 h-9 rounded-xl bg-sky-100 flex items-center justify-center flex-shrink-0">
                      <MessageCircle size={16} className="text-sky-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-stone-700 truncate">
                        {m.testo ? m.testo.slice(0, 50) + (m.testo.length > 50 ? '…' : '') : 'Solo foto'}
                      </p>
                      <p className="text-[10px] text-stone-400 mt-0.5">
                        {new Date(m.created_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </button>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {(m.risposta_testo || m.risposta_foto_url_1) && (
                      <span className="w-2 h-2 rounded-full bg-emerald-500" title="Risposta ricevuta" />
                    )}
                    <button
                      onClick={() => onTogglePreferito(m.id, !m.preferito)}
                      className="p-1.5 rounded-lg hover:bg-amber-50 transition-colors"
                    >
                      <Star size={15} className={m.preferito ? 'fill-amber-400 text-amber-400' : 'text-stone-300'} />
                    </button>
                    <button onClick={() => toggle(m.id)} className="p-1.5 text-stone-300">
                      {aperti.has(m.id)
                        ? <ChevronUp size={15} />
                        : <ChevronDown size={15} />
                      }
                    </button>
                  </div>
                </div>

                {/* Body */}
                {aperti.has(m.id) && (
                  <div className="px-4 pb-4 border-t border-stone-100 pt-3 space-y-3">
                    {m.testo && (
                      <div className="bg-stone-50 rounded-xl px-4 py-3">
                        <p className="text-sm text-stone-700 leading-relaxed">{m.testo}</p>
                      </div>
                    )}

                    {[m.foto_url_1, m.foto_url_2, m.foto_url_3].some(Boolean) && (
                      <div className="flex gap-3 flex-wrap">
                        {[m.foto_url_1, m.foto_url_2, m.foto_url_3].filter(Boolean).map((url, i) => (
                          <button
                            key={i}
                            onClick={() => onFotoZoom(url)}
                            className="w-24 h-24 rounded-xl overflow-hidden border border-stone-200 flex-shrink-0 hover:border-sky-400 transition-colors group relative"
                          >
                            <img src={url} className="w-full h-full object-cover" alt={`foto ${i + 1}`} />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
                              <ZoomIn size={18} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          </button>
                        ))}
                      </div>
                    )}

                    {(m.risposta_testo || m.risposta_foto_url_1) && (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                        <div className="flex items-center gap-1.5 mb-2">
                          <Reply size={13} className="text-emerald-600" />
                          <span className="text-xs font-semibold text-emerald-700">Risposta del salone</span>
                          {m.risposta_at && (
                            <span className="text-[10px] text-emerald-500 ml-auto">
                              {new Date(m.risposta_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>
                        {m.risposta_testo && (
                          <p className="text-sm text-emerald-800 leading-relaxed mb-2">{m.risposta_testo}</p>
                        )}
                        {[m.risposta_foto_url_1, m.risposta_foto_url_2, m.risposta_foto_url_3].some(Boolean) && (
                          <div className="flex gap-2 flex-wrap mt-1">
                            {[m.risposta_foto_url_1, m.risposta_foto_url_2, m.risposta_foto_url_3].filter(Boolean).map((url, i) => (
                              <button
                                key={i}
                                onClick={() => onFotoZoom(url!)}
                                className="w-20 h-20 rounded-xl overflow-hidden border border-emerald-200 hover:border-emerald-400 transition-colors flex-shrink-0 group relative"
                              >
                                <img src={url!} className="w-full h-full object-cover" alt={`risposta foto ${i+1}`} />
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
                                  <ZoomIn size={16} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      <BackBtn onClick={onBack} />
    </div>
  );
}

function ProfiloStep({
  nome, setNome, cognome, setCognome, telefono, setTelefono,
  email, setEmail, dataNascita, setDataNascita, note, setNote,
  fotoUrl, fotoPreview, fotoRef, fotoCameraRef, onFotoChange, onFotoRemove,
  loading, saving, error, saved, schedaInviata, onSave, onBack,
}: {
  nome: string; setNome: (v: string) => void;
  cognome: string; setCognome: (v: string) => void;
  telefono: string; setTelefono: (v: string) => void;
  email: string; setEmail: (v: string) => void;
  dataNascita: string; setDataNascita: (v: string) => void;
  note: string; setNote: (v: string) => void;
  fotoUrl: string; fotoPreview: string;
  fotoRef: React.RefObject<HTMLInputElement>;
  fotoCameraRef: React.RefObject<HTMLInputElement>;
  onFotoChange: (f: File) => void;
  onFotoRemove: () => void;
  loading: boolean; saving: boolean; error: string; saved: boolean; schedaInviata: boolean;
  onSave: () => void; onBack: () => void;
}) {
  const hasFoto = !!fotoPreview;

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <p className="text-xl font-bold text-stone-800">Il mio profilo</p>
        <p className="text-sm text-stone-400 mt-0.5">Aggiorna i tuoi dati personali</p>
      </div>

      {/* Foto */}
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          {hasFoto ? (
            <img
              src={fotoPreview}
              alt="Foto profilo"
              className="w-28 h-28 rounded-full object-cover border-4 border-violet-200 shadow-lg"
            />
          ) : (
            <div className="w-28 h-28 rounded-full bg-violet-50 border-2 border-dashed border-violet-300 flex flex-col items-center justify-center gap-1">
              <User size={32} className="text-violet-300" />
              <span className="text-[10px] text-violet-400 font-medium">Nessuna foto</span>
            </div>
          )}
        </div>
        <div className="flex gap-2 flex-wrap justify-center">
          <button
            type="button"
            onClick={() => fotoCameraRef.current?.click()}
            className="flex items-center gap-1.5 px-4 py-2 bg-white border border-stone-200 rounded-xl text-sm font-medium text-stone-600 hover:border-violet-400 hover:text-violet-600 hover:bg-violet-50 transition-all"
          >
            <Camera size={14} /> Selfie
          </button>
          <button
            type="button"
            onClick={() => fotoRef.current?.click()}
            className="flex items-center gap-1.5 px-4 py-2 bg-white border border-stone-200 rounded-xl text-sm font-medium text-stone-600 hover:border-violet-400 hover:text-violet-600 hover:bg-violet-50 transition-all"
          >
            <Image size={14} /> Galleria
          </button>
          {hasFoto && (
            <button
              type="button"
              onClick={onFotoRemove}
              className="flex items-center gap-1.5 px-4 py-2 bg-white border border-red-200 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 transition-all"
            >
              <Trash2 size={14} /> Rimuovi
            </button>
          )}
        </div>
        <input
          ref={fotoCameraRef}
          type="file"
          accept="image/*"
          capture="user"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) onFotoChange(f); e.target.value = ''; }}
        />
        <input
          ref={fotoRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) onFotoChange(f); e.target.value = ''; }}
        />
      </div>

      {/* Form */}
      <div className="bg-white rounded-3xl border border-stone-200 shadow-sm p-6 space-y-5">
        {/* Dati personali */}
        <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Dati personali</p>

        <Field label="Nome *">
          <div className="relative">
            <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              value={nome}
              onChange={e => { const v = e.target.value; setNome(v.length > 0 ? v.charAt(0).toUpperCase() + v.slice(1) : v); }}
              placeholder="Il tuo nome"
              className="input pl-9"
            />
          </div>
        </Field>

        <Field label="Cognome *">
          <div className="relative">
            <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              value={cognome}
              onChange={e => { const v = e.target.value; setCognome(v.length > 0 ? v.charAt(0).toUpperCase() + v.slice(1) : v); }}
              placeholder="Il tuo cognome"
              className="input pl-9"
            />
          </div>
        </Field>

        <Field label="Data di nascita">
          <div className="relative">
            <Calendar size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="date"
              value={dataNascita}
              onChange={e => setDataNascita(e.target.value)}
              className="input pl-9"
            />
          </div>
        </Field>

        <div className="h-px bg-stone-100" />
        <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Contatti</p>

        <Field label="Telefono">
          <div className="relative">
            <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              value={telefono}
              onChange={e => setTelefono(e.target.value)}
              placeholder="+39 333 000 0000"
              type="tel"
              className="input pl-9"
              readOnly
            />
          </div>
          <p className="text-[11px] text-stone-400 mt-1">Il numero non può essere modificato da qui</p>
        </Field>

        <Field label="Email">
          <div className="relative">
            <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="nome@esempio.it"
              type="email"
              className="input pl-9"
            />
          </div>
        </Field>

        <div className="h-px bg-stone-100" />
        <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Note aggiuntive</p>

        <Field label="Allergie / Preferenze">
          <div className="relative">
            <FileText size={15} className="absolute left-3 top-3.5 text-stone-400" />
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Allergie, preferenze, informazioni utili..."
              rows={3}
              className="w-full border border-stone-200 rounded-2xl pl-9 pr-4 py-3 text-sm text-stone-800 placeholder:text-stone-300 focus:outline-none focus:border-violet-400 resize-none"
            />
          </div>
        </Field>
      </div>

      {/* Errore */}
      {error && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
          <X size={15} className="text-red-500 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Salvato */}
      {saved && (
        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3">
          <Check size={15} className="text-emerald-600 flex-shrink-0" />
          <p className="text-sm text-emerald-700 font-medium">Profilo aggiornato!</p>
        </div>
      )}

      {/* Scheda inviata (cliente non ancora registrata) */}
      {schedaInviata && (
        <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3">
          <Check size={15} className="text-emerald-600 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-emerald-700 font-medium">Scheda inviata! Lo staff la confermerà al piu presto.</p>
        </div>
      )}

      {/* Salva */}
      <button
        onClick={onSave}
        disabled={saving}
        className="w-full py-4 bg-violet-600 text-white font-semibold rounded-2xl hover:bg-violet-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
      >
        {saving ? (
          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <><Check size={18} />Salva modifiche</>
        )}
      </button>

      <BackBtn onClick={onBack} />
    </div>
  );
}

function SalonHeader({ info }: { info: SalonInfo }) {
  return (
    <div className="bg-white border-b border-stone-200 px-6 py-4 text-center sticky top-0 z-10">
      <div className="flex items-center justify-center gap-3">
        {info.logoUrl ? (
          <img src={info.logoUrl} alt="Logo" className="w-9 h-9 rounded-xl object-cover" />
        ) : (
          <div className="w-9 h-9 bg-emerald-700 rounded-xl flex items-center justify-center">
            <Scissors size={18} className="text-white" />
          </div>
        )}
        {info.nomeSalone && <span className="font-bold text-stone-800 text-lg">{info.nomeSalone}</span>}
      </div>
    </div>
  );
}

function StepProgress({ step }: { step: Step }) {
  const steps: Step[] = ['dati', 'parrucchiere', 'data', 'servizio', 'ora', 'abbinato', 'riepilogo'];
  const idx = steps.indexOf(step);
  const total = steps.length;
  return (
    <div className="flex items-center gap-1 mb-6 px-1">
      {steps.map((_, i) => (
        <div
          key={i}
          className={`h-1 rounded-full flex-1 transition-all ${i <= idx ? 'bg-emerald-600' : 'bg-stone-200'}`}
        />
      ))}
    </div>
  );
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-3xl border border-stone-200 shadow-sm p-6">
      <div className="mb-5">
        <h2 className="text-xl font-bold text-stone-800">{title}</h2>
        {subtitle && <p className="text-sm text-stone-400 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function NextBtn({ onClick, children, disabled }: { onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full py-4 bg-emerald-600 text-white font-semibold rounded-2xl hover:bg-emerald-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 mt-2"
    >
      {children}<ChevronRight size={18} />
    </button>
  );
}

function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full py-3 text-stone-400 text-sm font-medium flex items-center justify-center gap-1 hover:text-stone-600 transition-colors mt-1">
      <ChevronLeft size={15} /> Indietro
    </button>
  );
}


