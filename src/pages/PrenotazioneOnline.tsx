import { useEffect, useState, useCallback, useRef } from 'react';
import { Calendar, Clock, ChevronRight, ChevronLeft, Check, X, Scissors, User, Phone, Download, Share, MessageCircle, CalendarPlus, Image, Trash2, Star, Inbox, ChevronDown, ChevronUp, ZoomIn, Reply, Bell, BellOff } from 'lucide-react';

const EDGE_URL = `${import.meta.env.VITE_SUPABASE_URL ?? 'https://cfsourwsjhhriytkdnuw.supabase.co'}/functions/v1/prenota-online`;
const MIEI_MSG_URL = `${import.meta.env.VITE_SUPABASE_URL ?? 'https://cfsourwsjhhriytkdnuw.supabase.co'}/functions/v1/miei-messaggi`;

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

type Step = 'dati' | 'scelta' | 'parrucchiere' | 'data' | 'ora' | 'servizio' | 'abbinato' | 'riepilogo' | 'successo' | 'scrivici' | 'successo_messaggio' | 'miei_messaggi';

interface MioMessaggio {
  id: string;
  testo: string;
  foto_url_1: string;
  foto_url_2: string;
  foto_url_3: string;
  preferito: boolean;
  risposta_testo: string | null;
  risposta_at: string | null;
  created_at: string;
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

export default function PrenotazioneOnline({ userId }: { userId: string }) {
  const [info, setInfo] = useState<SalonInfo | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(true);
  const [step, setStep] = useState<Step>('dati');

  // Cliente dati
  const [nome, setNome] = useState('');
  const [cognome, setCognome] = useState('');
  const [telefono, setTelefono] = useState('');
  const [datiError, setDatiError] = useState('');

  // Selections
  const [parrucchiere, setParrucchiere] = useState<Parrucchiere | null>(null);
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
  const [deviceType, setDeviceType] = useState<'ios' | 'android' | 'other'>('other');

  useEffect(() => {
    const ua = navigator.userAgent;
    const ios = /iphone|ipad|ipod/i.test(ua);
    const android = /android/i.test(ua);
    const installed = window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    setDeviceType(ios ? 'ios' : android ? 'android' : 'other');
    if (!installed && !localStorage.getItem('pwa_banner_dismissed_v2')) {
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
    localStorage.setItem('pwa_banner_dismissed_v2', '1');
    setShowInstallBanner(false);
  }

  async function handleInstall() {
    if (!installPrompt) return;
    const prompt = installPrompt as Event & { prompt: () => void; userChoice: Promise<{ outcome: string }> };
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') dismissInstallBanner();
    else setInstallPrompt(null);
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
      if (saved.nome) setNome(saved.nome);
      if (saved.cognome) setCognome(saved.cognome);
      if (saved.telefono) setTelefono(saved.telefono);
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

  function handleDatiNext() {
    if (!nome.trim() || !cognome.trim() || !telefono.trim()) {
      setDatiError('Tutti i campi sono obbligatori');
      return;
    }
    if (!/^\+?[\d\s\-()]{7,}$/.test(telefono.trim())) {
      setDatiError('Inserisci un numero di telefono valido');
      return;
    }
    localStorage.setItem(LS_CLIENTE_KEY, JSON.stringify({ nome: nome.trim(), cognome: cognome.trim(), telefono: telefono.trim() }));
    setDatiError('');
    setStep('scelta');
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
    const res = await fetch(`${MIEI_MSG_URL}?user_id=${userId}&telefono=${encodeURIComponent(telefono.trim())}`);
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
    setDataSelezionata('');
    setOraSelezionata('');
    setServizio(null);
    setParrucchiere2(null);
    setParrPrimarioOccupato(false);
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
    if (parrucchiere && dataSelezionata) {
      loadSlots(parrucchiere.id, dataSelezionata, s.durata_minuti);
    }
    setStep('ora');
  }

  async function handleOraSelect(ora: string) {
    setOraSelezionata(ora);
    if (!servizio) return;

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
    if (!parrucchiere || !servizio || !dataSelezionata || !oraSelezionata) return;
    setSubmitting(true);
    setSubmitError('');

    // Build data_ora in ISO format
    const [h, m] = oraSelezionata.split(':').map(Number);
    const dataOraBase = new Date(`${dataSelezionata}T${pad(h)}:${pad(m)}:00`);

    // data_ora2: after first service ends
    let dataOra2: string | null = null;
    if (parrucchiere2 && servizio.servizio_abbinato_online_id) {
      const endMs = dataOraBase.getTime() + servizio.durata_minuti * 60000;
      dataOra2 = new Date(endMs).toISOString();
    }

    const body = {
      user_id: userId,
      nome: nome.trim(),
      cognome: cognome.trim(),
      telefono: telefono.trim(),
      parrucchiere_id: parrucchiere.id,
      servizio_id: servizio.id,
      data_ora: dataOraBase.toISOString(),
      parrucchiere2_id: parrucchiere2?.id ?? null,
      servizio2_id: servizio.servizio_abbinato_online_id ?? null,
      data_ora2: dataOra2,
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
                  ? <>Tocca <span className="font-bold">{'↑'} Condividi</span> in basso, poi <span className="font-bold">"Aggiungi a schermata Home"</span>. Prenota con un tap, senza aprire il browser!</>
                  : deviceType === 'android'
                  ? <>Tocca il menu del browser e scegli <span className="font-bold">"Aggiungi a schermata Home"</span>. Prenota con un tap, sempre a portata di mano!</>
                  : <>Aggiungi questa pagina ai segnalibri o salvala sulla schermata home. Prenota con un click, senza cercarla ogni volta!</>
                }
              </p>
              {installPrompt && (
                <button
                  onClick={handleInstall}
                  className="mt-2 px-3 py-1.5 bg-white text-emerald-700 text-xs font-bold rounded-lg hover:bg-emerald-50 transition-colors"
                >
                  Installa ora
                </button>
              )}
            </div>
            <button onClick={dismissInstallBanner} className="text-emerald-200 hover:text-white transition-colors flex-shrink-0 pt-0.5">
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      <div className="max-w-lg mx-auto px-4 py-6 pb-24">
        {/* Progress indicator */}
        {step !== 'successo' && step !== 'scelta' && step !== 'scrivici' && step !== 'successo_messaggio' && step !== 'miei_messaggi' && (
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
                  onChange={e => setNome(e.target.value)}
                  placeholder="Giulia"
                  className="input"
                />
              </Field>
              <Field label="Cognome *">
                <input
                  value={cognome}
                  onChange={e => setCognome(e.target.value)}
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
              <p className="text-xs text-stone-400 bg-stone-50 rounded-xl p-3">
                La prenotazione è una <strong>richiesta</strong> e deve essere confermata dal salone via WhatsApp. Non è garantita finché non ricevi conferma.
              </p>
              <NextBtn onClick={handleDatiNext}>Avanti</NextBtn>
            </div>
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
              <BackBtn onClick={() => setStep('dati')} />
            </div>
          </Card>
        )}

        {/* STEP: Data */}
        {step === 'data' && (
          <Card title="Scegli la data" subtitle={parrucchiere?.nome}>
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
          <Card title="Scegli il servizio" subtitle={`${parrucchiere?.nome} · ${dataSelezionata ? dateLabel(dataSelezionata) : ''}`}>
            <div className="space-y-3">
              {(() => {
                const abbinatiIds = new Set((info.serviziAbbinati ?? []).map(a => a.id));
                const serviziSelezionabili = info.servizi.filter(s => !abbinatiIds.has(s.id));
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
          <Card title="Scegli l'orario" subtitle={`${parrucchiere?.nome} · ${dateLabel(dataSelezionata)}`}>
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
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: parrucchiere?.colore }} />
                  <span className="font-medium text-stone-800">{parrucchiere?.nome}</span>
                </div>
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
              <BackBtn onClick={() => setStep(servizioAbbinato ? 'abbinato' : 'ora')} />
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
                    {m.risposta_testo && (
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

                    {m.risposta_testo && (
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
                        <p className="text-sm text-emerald-800 leading-relaxed">{m.risposta_testo}</p>
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

function NextBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="w-full py-4 bg-emerald-600 text-white font-semibold rounded-2xl hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2 mt-2"
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


