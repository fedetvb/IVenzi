import { useEffect, useState, useCallback, useRef } from 'react';
import { Calendar, Clock, ChevronRight, ChevronLeft, Check, X, Scissors, User, Users, Phone, Download, Share, MessageCircle, CalendarPlus, Image, Trash2, Star, Inbox, ChevronDown, ChevronUp, ZoomIn, Reply, Bell, BellOff, CreditCard, Gift, TrendingUp, ArrowUpCircle, ArrowDownCircle, Mail, FileText, Camera, MapPin, Globe, ExternalLink } from 'lucide-react';
import AnnuncioModal, { COMPLEANNO_DEFAULT_TESTO } from '../components/AnnuncioModal';
import BenvenutoModal, { type BenvenutoConfig } from '../components/BenvenutoModal';
import { applyWaTemplate, DEFAULT_WA_CS_DONA, DEFAULT_WA_GP_CLIENTE } from '../lib/waUtils';
import { supabase } from '../lib/supabase';

// Timezone helpers (Italian local time)
function toItalianMinutes(date: Date): number {
  const parts = new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(date);
  return parseInt(parts.find(p => p.type === 'hour')!.value) * 60 + parseInt(parts.find(p => p.type === 'minute')!.value);
}
function toItalianDateStr(date: Date): string {
  const parts = new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const y = parts.find(p => p.type === 'year')!.value;
  const mo = parts.find(p => p.type === 'month')!.value;
  const d2 = parts.find(p => p.type === 'day')!.value;
  return `${y}-${mo}-${d2}`;
}
function italianDayBounds(data: string) {
  return { dayStart: `${data}T00:00:00+02:00`, dayEnd: `${data}T23:59:59+01:00` };
}
function normPhone(t: string): string {
  let s = (t ?? '').replace(/\D/g, '');
  if (s.startsWith('0039')) s = s.slice(4);
  else if (s.startsWith('39') && s.length > 10) s = s.slice(2);
  return s.slice(-9);
}

// Inserts a scheda da confermare only if:
//   1. the client does NOT already exist in 'clienti' (rubrica)
//   2. there is NO existing row with stato='in_attesa' for the same phone number
// Silently ignores duplicate-key errors (23505) as a last-resort guard.
async function insertSchedaSafe(payload: Record<string, unknown>): Promise<void> {
  const userId = payload.user_id as string | undefined;
  const tel = (payload.telefono as string | undefined)?.trim() ?? '';
  const telNorm = normPhone(tel);

  if (userId && telNorm) {
    // Guard 1: client already confirmed in rubrica → never create a new request
    // Tries cliente_esiste_in_rubrica first; falls back to cliente_ha_fiches if not deployed.
    try {
      const { data: esiste } = await supabase.rpc('cliente_esiste_in_rubrica', {
        p_user_id: userId,
        p_telefono: tel,
      });
      if (esiste) return;
    } catch { /* RPC not deployed yet — fall back */ }
    try {
      const { data: haFiches } = await supabase.rpc('cliente_ha_fiches', {
        p_user_id: userId,
        p_telefono: tel,
      });
      if (haFiches) return;
    } catch { /* non bloccante */ }

    // Guard 2: scheda already in_attesa for this phone → block duplicate
    try {
      const { data: pending } = await supabase
        .from('schede_clienti_da_confermare')
        .select('id, telefono')
        .eq('user_id', userId)
        .eq('stato', 'in_attesa');
      const hasPending = (pending ?? []).some(
        (r: { telefono: string }) => normPhone(r.telefono ?? '') === telNorm
      );
      if (hasPending) return;
    } catch { /* non bloccante */ }
  }

  const { error } = await supabase.from('schede_clienti_da_confermare').insert(payload);
  if (error && error.code !== '23505') {
    console.warn('insertSchedaSafe:', error.message);
  }
}

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
  portaleNascosto: boolean;
  nomeSalone: string;
  logoUrl: string | null;
  parrucchieri: Parrucchiere[];
  servizi: Servizio[];
  serviziAbbinati: ServizioAbbinato[];
  social?: Record<string, string>;
  annuncio?: {
    attivo: boolean;
    sfondo: string;
    testo: string;
    id: string;
    compleannoTesto: string;
  };
  contatti?: {
    telefono: string;
    email: string;
    pec: string;
    indirizzo: string;
    googleMaps: string;
    sitoWeb: string;
    note: string;
    orariJson: string | null;
    orariNota: string;
    ferieInizio?: string;
    ferieFine?: string;
  };
  benvenutoAttivo?: boolean;
  benvenutoConfig?: BenvenutoConfig | null;
}

type Step = 'dati' | 'scelta' | 'parrucchiere' | 'data' | 'ora' | 'servizio' | 'abbinato' | 'riepilogo' | 'successo' | 'scrivici' | 'successo_messaggio' | 'miei_messaggi' | 'mie_carte' | 'profilo' | 'miei_appuntamenti' | 'miei_servizi' | 'nostri_prodotti' | 'contatti' | 'quiz_capelli' | 'routine_risultato';

interface Seduta {
  fiche_id: string;
  data: string;
  voci: { tipo: string; nome: string; parrucchiere: string | null }[];
  prodotti: { nome: string; quantita: number; parrucchiere: string | null }[];
}

interface AppuntamentoCliente {
  id: string;
  data_ora: string;
  stato: string;
  parrucchiere: { id: string; nome: string; colore: string } | null;
  servizi: string[];
  tipo: 'appuntamento' | 'richiesta';
}

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
  valore: number | null;
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
  const [isNuovaScheda, setIsNuovaScheda] = useState(true);

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

  // I miei appuntamenti
  const [mieiServizi, setMieiServizi] = useState<Seduta[]>([]);
  const [loadingMieiServizi, setLoadingMieiServizi] = useState(false);
  const [mieiServiziError, setMieiServiziError] = useState('');
  const [serviziPeriodo, setServiziPeriodo] = useState<'1m' | '3m' | '1y' | 'all'>('all');
  const [serviziNomeFiltro, setServiziNomeFiltro] = useState('');

  interface ProdottoCatalogo { id: string; nome: string; marca: string | null; categoria: string | null; prezzo_vendita: number | null; note: string | null; quiz_tags: string[] | null; foto_url: string | null; best_seller: boolean; }
  const [nostralProdotti, setNostralProdotti] = useState<ProdottoCatalogo[]>([]);
  const [loadingNostralProdotti, setLoadingNostralProdotti] = useState(false);
  const [nostralProdottiError, setNostralProdottiError] = useState('');

  // Quiz capelli state
  interface QuizDomanda { id: string; domanda: string; emoji: string; opzioni: { label: string; tag: string }[] }
  const QUIZ_DOMANDE: QuizDomanda[] = [
    { id: 'tipo', domanda: 'Come descriveresti la struttura dei tuoi capelli al naturale?', emoji: '💇', opzioni: [
      { label: 'Perfettamente lisci e tendenti ad appiattirsi', tag: 'lisci' },
      { label: 'Mossi, ma tendono a perdere la forma facilmente', tag: 'mossi' },
      { label: 'Ricci, da quelli morbidi a quelli più stretti', tag: 'ricci' },
      { label: 'Molto ricci, texturizzati o afro', tag: 'afro' },
    ]},
    { id: 'sensazione', domanda: 'Se passi le dita tra le lunghezze, che sensazione provi?', emoji: '✨', opzioni: [
      { label: 'Sono morbidi e scivolano via lisci', tag: 'normali' },
      { label: 'Li sento un po\' ruvidi e secchi sulle punte', tag: 'secchi' },
      { label: 'Si annodano facilmente e sembrano fragili', tag: 'danneggiati' },
      { label: 'Li sento pesanti e si sporcano molto in fretta', tag: 'pesanti' },
    ]},
    { id: 'crespo', domanda: 'Parliamo di "effetto crespo": qual è il tuo livello di sfida quotidiano?', emoji: '🌊', opzioni: [
      { label: 'Praticamente inesistente, restano sempre disciplinati', tag: 'no_crespo' },
      { label: "Compare solo quando c'è molta umidità nell'aria", tag: 'crespo_umidita' },
      { label: 'È una costante: sono spesso gonfi e difficili da domare', tag: 'alta_esigenza' },
      { label: 'Sono crespi solo sulle punte perché molto sfruttati', tag: 'punte_rovinate' },
    ]},
    { id: 'cute', domanda: 'Concentriamoci sulla cute: come si comporta nei giorni successivi allo shampoo?', emoji: '🌿', opzioni: [
      { label: 'Produce sebo velocemente e devo lavarli spesso', tag: 'cute_grassa' },
      { label: 'La sento secca, tesa e a volte avverto un leggero prurito', tag: 'cute_secca' },
      { label: 'È molto sensibile e si arrossa facilmente', tag: 'cute_sensibile' },
      { label: 'È equilibrata, non mi dà particolari problemi', tag: 'cute_normale' },
    ]},
    { id: 'obiettivo', domanda: 'Qual è l\'obiettivo principale che vorresti raggiungere con i nuovi prodotti?', emoji: '🎯', opzioni: [
      { label: 'Vorrei un\'idratazione profonda e tanta morbidezza', tag: 'idratazione' },
      { label: 'Cerco volume, leggerezza e sostegno alle radici', tag: 'volume' },
      { label: 'Desidero riparare i danni e rinforzare la fibra', tag: 'riparazione' },
      { label: 'Voglio definire lo styling (ricci elastici o liscio perfetto)', tag: 'definizione' },
    ]},
    { id: 'stress', domanda: 'Sottoponi spesso i tuoi capelli a trattamenti tecnici o calore?', emoji: '🔥', opzioni: [
      { label: 'Sì, faccio regolarmente tinte, schiariture o permanenti', tag: 'colorati_trattati' },
      { label: 'Uso piastra o ferro arricciacapelli quasi a ogni lavaggio', tag: 'calore_frequente' },
      { label: 'Uso solo il phon a temperature medie e prodotti protettivi', tag: 'basso_stress' },
      { label: 'No, preferisco l\'asciugatura naturale o molto delicata', tag: 'naturali' },
    ]},
    { id: 'piega', domanda: 'Quando fai la piega a casa, qual è la tua difficoltà maggiore?', emoji: '💨', opzioni: [
      { label: 'La piega non dura e i capelli perdono subito forma', tag: 'durata_styling' },
      { label: 'Ci metto tantissimo tempo perché sono difficili da districare', tag: 'difficili_gestione' },
      { label: 'Mancano totalmente di lucentezza, restano opachi', tag: 'opachi' },
      { label: 'Non ho grosse difficoltà, cerco solo di mantenerli sani', tag: 'mantenimento' },
    ]},
    { id: 'routine', domanda: 'Quanto tempo riesci a dedicare alla tua Hair Care Routine?', emoji: '⏱️', opzioni: [
      { label: 'Pochi minuti: cerco una soluzione veloce (shampoo + conditioner)', tag: 'fast_routine' },
      { label: 'Il giusto: amo applicare una maschera e lasciarla in posa', tag: 'standard_routine' },
      { label: 'È il mio rituale: uso termoprotettori, sieri e prodotti leave-in', tag: 'premium_routine' },
      { label: 'Ho bisogno di prodotti mirati per risolvere un problema specifico', tag: 'problema_specifico' },
    ]},
  ];
  const [quizStep, setQuizStep] = useState(0);
  const [quizRisposte, setQuizRisposte] = useState<string[]>([]);
  interface RisultatoRoutine { shampoo: ProdottoCatalogo | null; maschera: ProdottoCatalogo | null; finish: ProdottoCatalogo | null }
  const [routineRisultato, setRoutineRisultato] = useState<RisultatoRoutine>({ shampoo: null, maschera: null, finish: null });
  const [salvandoMappa, setSalvandoMappa] = useState(false);
  const [mappaSalvata, setMappaSalvata] = useState(false);
  const [mappaBellezza, setMappaBellezza] = useState<RisultatoRoutine | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [categoriaAperta, setCategoriaAperta] = useState<'shampoo' | 'maschera' | 'finish' | null>(null);
  const [quizAnalizzando, setQuizAnalizzando] = useState(false);

  // Mapping categorie reali del Magazzino → 3 step quiz
  // Shampoo esatto → step 1; Maschera/Balsamo/Crema → step 2; tutto il resto → step 3 (catch-all)
  function getMacroGruppo(categoria: string | null): 'shampoo' | 'maschera' | 'finish' {
    const c = (categoria ?? '').trim();
    if (c === 'Shampoo') return 'shampoo';
    if (['Maschera', 'Balsamo', 'Crema'].includes(c)) return 'maschera';
    return 'finish';
  }

  function calcolaRoutine(tags: string[]): RisultatoRoutine {
    const score = (p: ProdottoCatalogo) => (p.quiz_tags ?? []).filter(t => tags.includes(t)).length;
    const best = (gruppo: 'shampoo' | 'maschera' | 'finish'): ProdottoCatalogo | null => {
      const conTag = nostralProdotti.filter(p => getMacroGruppo(p.categoria) === gruppo && (p.quiz_tags ?? []).length > 0);
      const top = [...conTag].sort((a, b) => score(b) - score(a))[0];
      if (top && score(top) > 0) return top;
      // jolly fallback: best_seller del gruppo, poi qualsiasi del gruppo
      return nostralProdotti.find(p => getMacroGruppo(p.categoria) === gruppo && p.best_seller)
        ?? nostralProdotti.find(p => getMacroGruppo(p.categoria) === gruppo)
        ?? null;
    };
    return { shampoo: best('shampoo'), maschera: best('maschera'), finish: best('finish') };
  }

  async function salvaMappaBellezza(risultato: RisultatoRoutine, risposte: string[]) {
    setSalvandoMappa(true);
    setMappaSalvata(false);
    try {
      const tel = telefono.trim();
      await supabase.from('mappa_bellezza').delete().eq('telefono', tel);
      await supabase.from('mappa_bellezza').insert({
        telefono: tel,
        shampoo_id: risultato.shampoo?.id ?? null,
        shampoo_nome: risultato.shampoo?.nome ?? null,
        shampoo_marca: risultato.shampoo?.marca ?? null,
        shampoo_categoria: risultato.shampoo?.categoria ?? null,
        shampoo_prezzo: risultato.shampoo?.prezzo_vendita ?? null,
        maschera_id: risultato.maschera?.id ?? null,
        maschera_nome: risultato.maschera?.nome ?? null,
        maschera_marca: risultato.maschera?.marca ?? null,
        maschera_categoria: risultato.maschera?.categoria ?? null,
        maschera_prezzo: risultato.maschera?.prezzo_vendita ?? null,
        finish_id: risultato.finish?.id ?? null,
        finish_nome: risultato.finish?.nome ?? null,
        finish_marca: risultato.finish?.marca ?? null,
        finish_categoria: risultato.finish?.categoria ?? null,
        finish_prezzo: risultato.finish?.prezzo_vendita ?? null,
        quiz_risposte: risposte,
      });
      setMappaBellezza(risultato);
      setMappaSalvata(true);
    } catch { /* ignore — non bloccante */ }
    finally { setSalvandoMappa(false); }
  }

  async function loadMappaBellezza() {
    const tel = telefono.trim();
    if (!tel) return;
    try {
      const { data } = await supabase.from('mappa_bellezza').select('*').eq('telefono', tel).limit(1);
      if (data && data.length > 0) {
        const r = data[0];
        const toP = (id: string | null, nome: string | null, marca: string | null, categoria: string | null, prezzo: number | null): ProdottoCatalogo | null =>
          nome ? { id: id ?? '', nome, marca, categoria, prezzo_vendita: prezzo, note: null, quiz_tags: null, best_seller: false } : null;
        setMappaBellezza({
          shampoo: toP(r.shampoo_id, r.shampoo_nome, r.shampoo_marca, r.shampoo_categoria, r.shampoo_prezzo),
          maschera: toP(r.maschera_id, r.maschera_nome, r.maschera_marca, r.maschera_categoria, r.maschera_prezzo),
          finish: toP(r.finish_id, r.finish_nome, r.finish_marca, r.finish_categoria, r.finish_prezzo),
        });
      }
    } catch { /* ignore */ }
  }

  const [mieiAppuntamenti, setMieiAppuntamenti] = useState<AppuntamentoCliente[]>([]);
  const [mieiRichiestePendenti, setMieiRichiestePendenti] = useState<AppuntamentoCliente[]>([]);
  const [loadingMieiAppuntamenti, setLoadingMieiAppuntamenti] = useState(false);
  const [mieiAppuntamentiError, setMieiAppuntamentiError] = useState('');
  const [bannerDismissed, setBannerDismissed] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem('appt_banners_v1') ?? '{}'); } catch { return {}; }
  });

  // Annuncio / compleanno
  const [showAnnuncio, setShowAnnuncio] = useState<null | 'annuncio' | 'compleanno'>(null);
  const [clienteDataNascita, setClienteDataNascita] = useState('');
  const [showBenvenuto, setShowBenvenuto] = useState(false);

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
    if (installed || localStorage.getItem('pwa_installata')) {
      setShowInstallBanner(false);
    } else {
      setShowInstallBanner(true);
    }
    // Recover prompt captured before React mounted
    const w = window as Window & { __pwaInstallPrompt?: Event | null };
    if (w.__pwaInstallPrompt) {
      setInstallPrompt(w.__pwaInstallPrompt);
    }
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
      (window as Window & { __pwaInstallPrompt?: Event | null }).__pwaInstallPrompt = e;
      if (!localStorage.getItem('pwa_installata')) setShowInstallBanner(true);
    };
    const onInstalled = () => {
      markAsInstalled();
    };
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', onInstalled);
    };
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
        (window as Window & { __pwaInstallPrompt?: Event | null }).__pwaInstallPrompt = null;
      }
    } else if (deviceType === 'ios') {
      setShowIosModal(true);
    } else {
      setShowAndroidModal(true);
    }
  }

  // Tieni stepRef sincronizzato
  useEffect(() => { stepRef.current = step; }, [step]);

  // Scroll to top on every step change
  useEffect(() => { window.scrollTo(0, 0); }, [step]);

  // Mostra benvenuto / annuncio / compleanno al passaggio a 'scelta'
  useEffect(() => {
    if (step !== 'scelta') return;

    // Benvenuto prima-volta per nuove clienti
    if (isNuovaScheda && info?.benvenutoAttivo !== false) {
      const benvKey = `benvenuto_visto_${userId}_${telefono.trim()}`;
      if (localStorage.getItem(benvKey) !== '1') {
        setShowBenvenuto(true);
        return;
      }
    }

    const today = new Date();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const todayMmDd = `${mm}-${dd}`;
    const year = today.getFullYear();

    // Annuncio periodico automatico (ferie / stagionali): ha priorità sul normale
    const ann = info?.annuncio;
    if (ann?.attivo && ann.testo) {
      // --- FERIE: mostra ad ogni accesso durante il periodo ---
      if (ann.sfondo === 'ferie') {
        const fi = info.contatti?.ferieInizio;
        const ff = info.contatti?.ferieFine;
        if (fi && ff) {
          const todayStr = `${year}-${mm}-${dd}`;
          if (todayStr >= fi && todayStr <= ff) {
            setShowAnnuncio('annuncio');
            return;
          }
        }
      }

      // --- SAN VALENTINO: 14 febbraio, una volta per anno ---
      if (ann.sfondo === 'san_valentino') {
        if (mm === '02' && dd === '14') {
          const key = `ann_valentino_${userId}_${year}`;
          if (localStorage.getItem(key) !== '1') {
            setShowAnnuncio('annuncio');
            return;
          }
        }
      }

      // --- NATALE: 20-29 dicembre, una volta per anno ---
      if (ann.sfondo === 'natale') {
        if (mm === '12' && parseInt(dd) >= 20 && parseInt(dd) <= 29) {
          const key = `ann_natale_${userId}_${year}`;
          if (localStorage.getItem(key) !== '1') {
            setShowAnnuncio('annuncio');
            return;
          }
        }
      }

      // --- CAPODANNO: 30-31 dic (anno X) oppure 1-6 gen (anno X+1), chiave anno del 30 dic ---
      if (ann.sfondo === 'capodanno') {
        let capodannoYear: number | null = null;
        if (mm === '12' && (dd === '30' || dd === '31')) capodannoYear = year;
        if (mm === '01' && parseInt(dd) >= 1 && parseInt(dd) <= 6) capodannoYear = year - 1;
        if (capodannoYear !== null) {
          const key = `ann_capodanno_${userId}_${capodannoYear}`;
          if (localStorage.getItem(key) !== '1') {
            setShowAnnuncio('annuncio');
            return;
          }
        }
      }

      // --- HALLOWEEN: 29-31 ottobre, una volta per anno ---
      if (ann.sfondo === 'halloween') {
        if (mm === '10' && parseInt(dd) >= 29 && parseInt(dd) <= 31) {
          const key = `ann_halloween_${userId}_${year}`;
          if (localStorage.getItem(key) !== '1') {
            setShowAnnuncio('annuncio');
            return;
          }
        }
      }

      // --- ALTRI (generico, estate, autunno, primavera, pasqua): una volta per ID annuncio ---
      const nonPeriodici = ['generico', 'estate', 'autunno', 'primavera', 'pasqua'];
      if (nonPeriodici.includes(ann.sfondo) && ann.id) {
        const annKey = `ann_seen_${userId}_${ann.id}`;
        if (localStorage.getItem(annKey) !== '1') {
          setShowAnnuncio('annuncio');
          return;
        }
      }
    }

    // Compleanno (dopo annunci periodici)
    if (clienteDataNascita && clienteDataNascita.length >= 5) {
      const nascitaMmDd = clienteDataNascita.substring(5); // "MM-DD"
      const birthdayKey = `birthday_ann_${userId}_${year}`;
      if (nascitaMmDd === todayMmDd && localStorage.getItem(birthdayKey) !== '1') {
        setShowAnnuncio('compleanno');
      }
    }
  }, [step, clienteDataNascita, isNuovaScheda]);

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

  // Polling miei servizi (ogni 30s quando step === 'miei_servizi')
  useEffect(() => {
    const tel = telefono.trim();
    if (!tel || !userId) return;
    let active = true;
    const poll = async () => {
      if (!active || stepRef.current !== 'miei_servizi') return;
      try {
        const telN = normPhone(tel);
        const { data: clientiAll } = await supabase.from('clienti').select('id,telefono').eq('user_id', userId).is('deleted_at', null);
        const cliente = ((clientiAll ?? []) as { id: string; telefono: string }[]).find(c => normPhone(c.telefono ?? '') === telN);
        if (!cliente) return;
        const { data: fichesD } = await supabase.from('fiches').select('id,data_riferimento,appuntamento_id').eq('user_id', userId).eq('cliente_id', cliente.id).eq('convalidata', true).is('deleted_at', null);
        const { data: apptR } = await supabase.from('appuntamenti').select('id,data_ora').eq('user_id', userId).eq('cliente_id', cliente.id).is('deleted_at', null);
        const appIds2 = (apptR ?? []).map((a: { id: string }) => a.id);
        const appDataMap2 = new Map<string, string>((apptR ?? []).map((a: { id: string; data_ora: string }) => [a.id, a.data_ora]));
        const { data: fichesA } = appIds2.length > 0
          ? await supabase.from('fiches').select('id,data_riferimento,appuntamento_id').eq('user_id', userId).in('appuntamento_id', appIds2).eq('convalidata', true).is('deleted_at', null)
          : { data: [] };
        type FR = { id: string; data_riferimento: string | null; appuntamento_id: string | null };
        const fm = new Map<string, string>();
        for (const f of ([...(fichesD ?? []), ...(fichesA ?? [])] as FR[])) {
          if (fm.has(f.id)) continue;
          const d = f.data_riferimento ?? (f.appuntamento_id ? appDataMap2.get(f.appuntamento_id) : undefined) ?? null;
          if (d) fm.set(f.id, d);
        }
        if (fm.size === 0) { if (active && stepRef.current === 'miei_servizi') setMieiServizi([]); return; }
        const fids = Array.from(fm.keys());
        const [{ data: vR }, { data: pR }] = await Promise.all([
          supabase.from('fiche_voci').select('fiche_id,tipo,nome_voce,parrucchieri(nome)').in('fiche_id', fids),
          supabase.from('rivendita_prodotti').select('fiche_id,nome_prodotto,quantita,parrucchieri(nome)').in('fiche_id', fids),
        ]);
        type VR = { fiche_id: string; tipo: string; nome_voce: string; parrucchieri: { nome: string } | null };
        type PR = { fiche_id: string; nome_prodotto: string; quantita: number; parrucchieri: { nome: string } | null };
        const vbf = new Map<string, VR[]>(); for (const v of (vR ?? []) as VR[]) { if (!vbf.has(v.fiche_id)) vbf.set(v.fiche_id, []); vbf.get(v.fiche_id)!.push(v); }
        const pbf = new Map<string, PR[]>(); for (const p of (pR ?? []) as PR[]) { if (!p.fiche_id) continue; if (!pbf.has(p.fiche_id)) pbf.set(p.fiche_id, []); pbf.get(p.fiche_id)!.push(p); }
        const sedute = Array.from(fm.entries()).map(([fid, d]) => ({
          fiche_id: fid, data: d,
          voci: (vbf.get(fid) ?? []).map(v => ({ tipo: v.tipo, nome: v.nome_voce, parrucchiere: v.parrucchieri?.nome ?? null })),
          prodotti: (pbf.get(fid) ?? []).map(p => ({ nome: p.nome_prodotto, quantita: p.quantita ?? 1, parrucchiere: p.parrucchieri?.nome ?? null })),
        })).filter(s => s.voci.length > 0 || s.prodotti.length > 0).sort((a, b) => b.data.localeCompare(a.data));
        if (active && stepRef.current === 'miei_servizi') setMieiServizi(sedute);
      } catch { /* ignora errori di rete */ }
    };
    const id2 = setInterval(poll, 30000);
    return () => { active = false; clearInterval(id2); };
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


  // Inject dynamic PWA manifest + apple-touch-icon for the booking portal
  useEffect(() => {
    if (!userId) return;

    let manifestLink = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (!manifestLink) {
      manifestLink = document.createElement('link');
      manifestLink.rel = 'manifest';
      document.head.appendChild(manifestLink);
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
    const pwaManifestUrl = `${supabaseUrl}/functions/v1/pwa-manifest?uid=${userId}`;
    if (manifestLink) manifestLink.href = pwaManifestUrl;

    supabase.from('impostazioni')
      .select('valore')
      .eq('chiave', 'icona_pwa_url')
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data }) => {
        const iconUrl = data?.valore;
        if (!iconUrl) return;
        document.querySelectorAll('link[rel="apple-touch-icon"]').forEach(el => el.remove());
        const atLink = document.createElement('link');
        atLink.rel = 'apple-touch-icon';
        atLink.href = iconUrl;
        document.head.appendChild(atLink);
        const favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
        if (favicon) favicon.href = iconUrl;
      })
      .catch(() => {});

    return () => { if (manifestLink) manifestLink.href = '/manifest.json'; };
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    async function loadInfo() {
      setLoadingInfo(true);
      try {
        const SOCIAL_KEYS = ['social_instagram','social_facebook','social_tiktok','social_youtube','social_whatsapp','social_x','social_threads','social_google_business','social_tripadvisor','social_altro'];
        const ALL_KEYS = [
          'nome_salone','logo_salone_url','prenotazioni_online_attive','portale_nascosto',
          'annuncio_attivo','annuncio_sfondo','annuncio_testo','annuncio_id','annuncio_compleanno_testo',
          'azienda_telefono','azienda_email','azienda_pec','azienda_indirizzo','azienda_google_maps',
          'azienda_sito_prenotazioni','azienda_note','orari_salone_json','orari_salone_nota',
          'ferie_inizio','ferie_fine','benvenuto_attivo','benvenuto_config_json',
          'icona_pwa_url',
          ...SOCIAL_KEYS,
        ];

        const [impRes, parrRes, servRes] = await Promise.all([
          supabase.from('impostazioni').select('chiave,valore').eq('user_id', userId).in('chiave', ALL_KEYS),
          supabase.from('parrucchieri').select('id,nome,colore').eq('user_id', userId).eq('attivo', true).order('nome'),
          supabase.from('trattamenti_catalogo')
            .select('id,nome,durata_minuti,prezzo,colore,servizio_abbinato_online_id')
            .eq('user_id', userId)
            .eq('prenotazione_online_abilitata', true)
            .eq('attivo', true),
        ]);

        const imp: Record<string, string> = {};
        for (const r of impRes.data ?? []) imp[r.chiave] = r.valore;

        const prenotazioniAttive = imp['prenotazioni_online_attive'] !== 'false';
        const portaleNascosto = imp['portale_nascosto'] === 'true';

        const serviziAbilitati = (servRes.data ?? []) as Servizio[];
        const abbinatiIds = [...new Set(
          serviziAbilitati.filter(s => s.servizio_abbinato_online_id).map(s => s.servizio_abbinato_online_id)
        )] as string[];

        let serviziAbbinatiRaw: ServizioAbbinato[] = [];
        if (abbinatiIds.length > 0) {
          const { data: abbRes } = await supabase.from('trattamenti_catalogo')
            .select('id,nome,durata_minuti,prezzo,colore')
            .in('id', abbinatiIds);
          serviziAbbinatiRaw = (abbRes ?? []) as ServizioAbbinato[];
        }

        const abbinatiNotAlready = serviziAbbinatiRaw.filter(a => !serviziAbilitati.some(s => s.id === a.id));
        const serviziConAbbinati: Servizio[] = [
          ...serviziAbilitati,
          ...abbinatiNotAlready.map(a => ({ ...a, servizio_abbinato_online_id: null })),
        ];

        const social: Record<string, string> = {};
        for (const k of SOCIAL_KEYS) { if (imp[k]) social[k] = imp[k]; }

        setInfo({
          prenotazioniAttive,
          portaleNascosto,
          nomeSalone: imp['nome_salone'] ?? '',
          logoUrl: imp['logo_salone_url'] ?? null,
          parrucchieri: (parrRes.data ?? []) as Parrucchiere[],
          servizi: serviziConAbbinati,
          serviziAbbinati: serviziAbbinatiRaw,
          social,
          annuncio: {
            attivo: imp['annuncio_attivo'] === 'true',
            sfondo: imp['annuncio_sfondo'] ?? 'generico',
            testo: imp['annuncio_testo'] ?? '',
            id: imp['annuncio_id'] ?? '',
            compleannoTesto: imp['annuncio_compleanno_testo'] ?? '',
          },
          contatti: {
            telefono: imp['azienda_telefono'] ?? '',
            email: imp['azienda_email'] ?? '',
            pec: imp['azienda_pec'] ?? '',
            indirizzo: imp['azienda_indirizzo'] ?? '',
            googleMaps: imp['azienda_google_maps'] ?? '',
            sitoWeb: imp['azienda_sito_prenotazioni'] ?? '',
            note: imp['azienda_note'] ?? '',
            orariJson: imp['orari_salone_json'] ?? null,
            orariNota: imp['orari_salone_nota'] ?? '',
            ferieInizio: imp['ferie_inizio'] ?? '',
            ferieFine: imp['ferie_fine'] ?? '',
          },
          benvenutoAttivo: imp['benvenuto_attivo'] !== 'false',
          benvenutoConfig: imp['benvenuto_config_json'] ? JSON.parse(imp['benvenuto_config_json']) : null,
        });
      } catch {
        setInfo({ prenotazioniAttive: true, portaleNascosto: false, nomeSalone: '', logoUrl: null, parrucchieri: [], servizi: [], serviziAbbinati: [] });
      } finally {
        setLoadingInfo(false);
      }
    }
    loadInfo();
  }, [userId]);

  const loadSlots = useCallback(async (parrId: string, data: string, durata: number) => {
    setLoadingSlot(true);
    setSlotDisponibili([]);
    try {
      const { dayStart, dayEnd } = italianDayBounds(data);
      const [appRes, assenzeRes, richiesteRes] = await Promise.all([
        supabase.from('appuntamenti').select('data_ora,durata_minuti').eq('parrucchiere_id', parrId).gte('data_ora', dayStart).lte('data_ora', dayEnd).neq('stato', 'cancellato'),
        supabase.from('assenze_parrucchieri').select('ora_inizio,data_inizio,data_fine').eq('parrucchiere_id', parrId).lte('data_inizio', data).gte('data_fine', data),
        supabase.from('richieste_appuntamento').select('data_ora,data_ora2,parrucchiere2_id').eq('user_id', userId).eq('stato', 'in_attesa').gte('data_ora', dayStart).lte('data_ora', dayEnd),
      ]);
      const busy: { start: number; end: number }[] = [];
      for (const a of appRes.data ?? []) {
        const t = new Date(a.data_ora);
        if (toItalianDateStr(t) !== data) continue;
        const s = toItalianMinutes(t);
        busy.push({ start: s, end: s + (a.durata_minuti ?? 30) });
      }
      for (const r of (richiesteRes.data ?? []) as { data_ora: string; data_ora2: string | null; parrucchiere2_id: string | null }[]) {
        const t = new Date(r.data_ora);
        if (toItalianDateStr(t) === data) { const s = toItalianMinutes(t); busy.push({ start: s, end: s + 90 }); }
        if (r.parrucchiere2_id === parrId && r.data_ora2) {
          const t2 = new Date(r.data_ora2);
          if (toItalianDateStr(t2) === data) { const s = toItalianMinutes(t2); busy.push({ start: s, end: s + 90 }); }
        }
      }
      const fullDayAbsent = (assenzeRes.data ?? []).some((a: { ora_inizio: string | null }) => !a.ora_inizio);
      if (fullDayAbsent) { setSlotDisponibili([]); return; }
      const slots: string[] = [];
      for (let m = 9 * 60; m + durata <= 18 * 60; m += 15) {
        if (!busy.some(b => m < b.end && m + durata > b.start)) {
          slots.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);
        }
      }
      setSlotDisponibili(slots);
    } catch { setSlotDisponibili([]); }
    finally { setLoadingSlot(false); }
  }, [userId]);

  async function loadSlotsChiunque(data: string, durata: number) {
    setLoadingSlot(true);
    setSlotDisponibili([]);
    setParrucchieriPerSlot({});
    try {
      const { dayStart, dayEnd } = italianDayBounds(data);
      const [parrRes, appRes, assenzeRes, richiesteRes] = await Promise.all([
        supabase.from('parrucchieri').select('id,nome,colore').eq('user_id', userId).eq('attivo', true).order('nome'),
        supabase.from('appuntamenti').select('parrucchiere_id,data_ora,durata_minuti').eq('user_id', userId).gte('data_ora', dayStart).lte('data_ora', dayEnd).neq('stato', 'cancellato'),
        supabase.from('assenze_parrucchieri').select('parrucchiere_id,ora_inizio,data_inizio,data_fine').eq('user_id', userId).lte('data_inizio', data).gte('data_fine', data),
        supabase.from('richieste_appuntamento').select('parrucchiere_id,data_ora,parrucchiere2_id,data_ora2,chiunque,parrucchieri_candidati').eq('user_id', userId).eq('stato', 'in_attesa').gte('data_ora', dayStart).lte('data_ora', dayEnd),
      ]);
      const allParr = (parrRes.data ?? []) as Parrucchiere[];
      const busyByParr: Record<string, { start: number; end: number }[]> = {};
      for (const a of (appRes.data ?? []) as { parrucchiere_id: string | null; data_ora: string; durata_minuti: number | null }[]) {
        if (!a.parrucchiere_id) continue;
        const t = new Date(a.data_ora);
        if (toItalianDateStr(t) !== data) continue;
        const s = toItalianMinutes(t);
        if (!busyByParr[a.parrucchiere_id]) busyByParr[a.parrucchiere_id] = [];
        busyByParr[a.parrucchiere_id].push({ start: s, end: s + (a.durata_minuti ?? 30) });
      }
      for (const r of (richiesteRes.data ?? []) as { parrucchiere_id: string | null; data_ora: string; parrucchiere2_id: string | null; data_ora2: string | null; chiunque: boolean; parrucchieri_candidati: string[] | null }[]) {
        if (r.chiunque && Array.isArray(r.parrucchieri_candidati)) {
          const t = new Date(r.data_ora);
          if (toItalianDateStr(t) === data) {
            const s = toItalianMinutes(t);
            for (const pid of r.parrucchieri_candidati) {
              if (!busyByParr[pid]) busyByParr[pid] = [];
              busyByParr[pid].push({ start: s, end: s + 90 });
            }
          }
        } else {
          if (r.parrucchiere_id) {
            const t = new Date(r.data_ora);
            if (toItalianDateStr(t) === data) { const s = toItalianMinutes(t); if (!busyByParr[r.parrucchiere_id]) busyByParr[r.parrucchiere_id] = []; busyByParr[r.parrucchiere_id].push({ start: s, end: s + 90 }); }
          }
          if (r.parrucchiere2_id && r.data_ora2) {
            const t = new Date(r.data_ora2);
            if (toItalianDateStr(t) === data) { const s = toItalianMinutes(t); if (!busyByParr[r.parrucchiere2_id]) busyByParr[r.parrucchiere2_id] = []; busyByParr[r.parrucchiere2_id].push({ start: s, end: s + 90 }); }
          }
        }
      }
      const fullDayAbsent = new Set<string>();
      const partialAbsences: Record<string, number> = {};
      for (const a of (assenzeRes.data ?? []) as { parrucchiere_id: string; ora_inizio: string | null }[]) {
        if (!a.ora_inizio) fullDayAbsent.add(a.parrucchiere_id);
        else { const [ah, am] = a.ora_inizio.substring(0, 5).split(':').map(Number); partialAbsences[a.parrucchiere_id] = ah * 60 + am; }
      }
      const availableParr = allParr.filter(p => !fullDayAbsent.has(p.id));
      const parrucchieriPerSlot: Record<string, string[]> = {};
      const slotDisponibili: string[] = [];
      for (let m = 9 * 60; m + durata <= 18 * 60; m += 15) {
        const freeParr = availableParr.filter(p => {
          if (partialAbsences[p.id] !== undefined && m >= partialAbsences[p.id]) return false;
          return !(busyByParr[p.id] ?? []).some(b => m < b.end && m + durata > b.start);
        });
        if (freeParr.length > 0) {
          const slotKey = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
          slotDisponibili.push(slotKey);
          parrucchieriPerSlot[slotKey] = freeParr.map(p => p.id);
        }
      }
      setSlotDisponibili(slotDisponibili);
      setParrucchieriPerSlot(parrucchieriPerSlot);
    } catch { setSlotDisponibili([]); setParrucchieriPerSlot({}); }
    finally { setLoadingSlot(false); }
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
      const [h, m] = firstServiceStartOra.split(':').map(Number);
      const abbinatoStartMin = h * 60 + m + firstServiceDurata;
      const abbinatoOra = `${pad(Math.floor(abbinatoStartMin / 60))}:${pad(abbinatoStartMin % 60)}`;
      const { dayStart, dayEnd } = italianDayBounds(data);
      const [parrRes, appRes, richiesteRes] = await Promise.all([
        supabase.from('parrucchieri').select('id,nome,colore').eq('user_id', userId).eq('attivo', true).order('nome'),
        supabase.from('appuntamenti').select('parrucchiere_id,data_ora,durata_minuti').eq('user_id', userId).gte('data_ora', dayStart).lte('data_ora', dayEnd).neq('stato', 'cancellato'),
        supabase.from('richieste_appuntamento').select('parrucchiere_id,data_ora,parrucchiere2_id,data_ora2').eq('user_id', userId).eq('stato', 'in_attesa').gte('data_ora', dayStart).lte('data_ora', dayEnd),
      ]);
      const [startH, startM2] = abbinatoOra.split(':').map(Number);
      const startMin = startH * 60 + startM2;
      const endMin = startMin + abbinato_durata;
      const busyByParr: Record<string, { start: number; end: number }[]> = {};
      for (const a of (appRes.data ?? []) as { parrucchiere_id: string | null; data_ora: string; durata_minuti: number | null }[]) {
        if (!a.parrucchiere_id) continue;
        const t = new Date(a.data_ora);
        if (toItalianDateStr(t) !== data) continue;
        const s = toItalianMinutes(t);
        if (!busyByParr[a.parrucchiere_id]) busyByParr[a.parrucchiere_id] = [];
        busyByParr[a.parrucchiere_id].push({ start: s, end: s + (a.durata_minuti ?? 30) });
      }
      for (const r of (richiesteRes.data ?? []) as { parrucchiere_id: string | null; data_ora: string; parrucchiere2_id: string | null; data_ora2: string | null }[]) {
        if (r.parrucchiere_id) { const t = new Date(r.data_ora); if (toItalianDateStr(t) === data) { const s = toItalianMinutes(t); if (!busyByParr[r.parrucchiere_id]) busyByParr[r.parrucchiere_id] = []; busyByParr[r.parrucchiere_id].push({ start: s, end: s + 90 }); } }
        if (r.parrucchiere2_id && r.data_ora2) { const t = new Date(r.data_ora2); if (toItalianDateStr(t) === data) { const s = toItalianMinutes(t); if (!busyByParr[r.parrucchiere2_id]) busyByParr[r.parrucchiere2_id] = []; busyByParr[r.parrucchiere2_id].push({ start: s, end: s + 90 }); } }
      }
      const tuttiLiberi = ((parrRes.data ?? []) as Parrucchiere[]).filter(p => {
        return !(busyByParr[p.id] ?? []).some(b => startMin < b.end && endMin > b.start);
      });
      const primarioLibero = !!tuttiLiberi.find(p => p.id === parrucchierePrimario.id);
      setParrLiberi(tuttiLiberi);
      setParrPrimarioOccupato(!primarioLibero);
      return 'scegli';
    } catch {
      setParrLiberi([]);
      setParrPrimarioOccupato(true);
      return 'scegli';
    } finally { setLoadingParr2(false); }
  }

  async function loadMieCarte() {
    setLoadingMieCarte(true);
    setMieCarteError('');
    try {
      // Lookup cliente with priority: codice_cliente > telefono > nome+cognome
      let cliente: { id: string; nome: string; cognome: string; telefono: string } | null = null;
      const codice = codiceCliente.trim().toUpperCase();
      if (codice) {
        const { data } = await supabase.from('clienti').select('id,nome,cognome,telefono').eq('user_id', userId).eq('codice_cliente', codice).is('deleted_at', null).maybeSingle();
        cliente = data ?? null;
      }
      if (!cliente && telefono.trim()) {
        const telN = normPhone(telefono.trim());
        const { data: all } = await supabase.from('clienti').select('id,nome,cognome,telefono').eq('user_id', userId).is('deleted_at', null);
        cliente = (all ?? []).find((c: { telefono: string }) => normPhone(c.telefono ?? '') === telN) ?? null;
      }
      if (!cliente && nome.trim() && cognome.trim()) {
        const { data } = await supabase.from('clienti').select('id,nome,cognome,telefono').eq('user_id', userId).ilike('nome', nome.trim()).ilike('cognome', cognome.trim()).is('deleted_at', null).maybeSingle();
        cliente = data ?? null;
      }

      // Impostazioni salone
      const { data: impRows } = await supabase.from('impostazioni').select('chiave,valore').eq('user_id', userId).in('chiave', ['azienda_telefono','azienda_google_maps','azienda_sito_prenotazioni','nome_salone','wa_template_cs_dona','wa_template_gp_cliente','wa_includi_mappa']);
      const imp: Record<string, string> = {};
      for (const r of impRows ?? []) imp[r.chiave] = r.valore;

      if (!cliente) {
        setMieCarteData({ cliente: null, cartePremium: [], carteInfinity: [], carteUsaEGetta: [], giftPassDonatore: [], giftPassRicevente: [], salone: imp });
        return;
      }

      const telNorm = normPhone(cliente.telefono ?? '');

      // Carte Premium
      const { data: cpRaw } = await supabase.from('carte_premium').select('id,codice,saldo,attiva,created_at').eq('cliente_id', cliente.id).eq('user_id', userId).eq('attiva', true);
      const cartePremium = await Promise.all((cpRaw ?? []).map(async (cp: { id: string; codice: string; saldo: number; attiva: boolean; created_at: string }) => {
        const [{ data: ricariche }, { data: utilizzi }] = await Promise.all([
          supabase.from('ricariche_carta_premium').select('id,importo,importo_pagato,note,tipo_ricarica,created_at').eq('carta_premium_id', cp.id).order('created_at', { ascending: true }),
          supabase.from('utilizzi_carta_premium').select('id,importo_detratto,note,created_at').eq('carta_premium_id', cp.id).order('created_at', { ascending: true }),
        ]);
        const risparmioTotale = Math.round((ricariche ?? []).reduce((acc: number, r: { importo: number | null; importo_pagato: number | null }) => acc + Math.max(0, (r.importo ?? 0) - (r.importo_pagato ?? 0)), 0) * 100) / 100;
        return { ...cp, tipo: 'premium' as const, ricariche: ricariche ?? [], utilizzi: utilizzi ?? [], risparmioTotale };
      }));

      // Carte Sconto
      const { data: ciRaw } = await supabase.from('carte_sconto').select('id,codice,descrizione,tipo_sconto,valore_sconto,attiva,created_at').eq('cliente_id', cliente.id).eq('user_id', userId).eq('usa_e_getta', false).eq('attiva', true);
      const carteInfinity = (ciRaw ?? []).map((c: Record<string, unknown>) => ({ ...c, tipo: 'infinity' as const }));

      const { data: cuRaw } = await supabase.from('carte_sconto').select('id,codice,descrizione,tipo_sconto,valore_sconto,attiva,created_at').eq('cliente_id', cliente.id).eq('user_id', userId).eq('usa_e_getta', true).eq('regalata', false).eq('attiva', true);
      const carteUsaEGetta = (cuRaw ?? []).map((c: Record<string, unknown>) => ({ ...c, tipo: 'usa_e_getta' as const }));

      // Gift Pass donatore
      const gpSelect = 'id,codice,tipo,valore,prodotto_nome,occasione,attivata_at,scadenza_uso,scadenza_uso_giorni,scadenza_ritiro_giorni,created_at,destinataria_nome,destinataria_telefono,utilizzata,donata';
      const { data: gpById } = await supabase.from('gift_pass').select(gpSelect).eq('cliente_id', cliente.id).eq('user_id', userId).eq('utilizzata', false).eq('attivo', true).is('attivata_at', null);
      const { data: fichesGP } = await supabase.from('fiches').select('id').eq('cliente_id', cliente.id).eq('user_id', userId).eq('tipo_fiche', 'gift_pass').is('deleted_at', null);
      const ficheGPIds = (fichesGP ?? []).map((f: { id: string }) => f.id);
      let gpByFiche: Record<string, unknown>[] = [];
      if (ficheGPIds.length > 0) {
        const { data } = await supabase.from('gift_pass').select(gpSelect).in('fiche_acquisto_id', ficheGPIds).eq('user_id', userId).eq('utilizzata', false).eq('attivo', true).is('attivata_at', null);
        gpByFiche = (data ?? []) as Record<string, unknown>[];
      }
      const seenDon = new Set<string>((gpById ?? []).map((g: { id: string }) => g.id));
      const giftPassDonatore = [...((gpById ?? []) as Record<string, unknown>[]), ...gpByFiche.filter(g => !seenDon.has(g.id as string))].map(g => ({ ...g, tipo_carta: 'gift_pass_donatore' as const }));

      // Gift Pass ricevente
      const gpSelRic = 'id,codice,tipo,valore,prodotto_nome,occasione,attivata_at,scadenza_uso,destinataria_nome,destinataria_telefono,utilizzata';
      const { data: gpRicById } = await supabase.from('gift_pass').select(gpSelRic).eq('destinataria_cliente_id', cliente.id).eq('user_id', userId).eq('utilizzata', false).eq('attivo', true);
      const { data: gpRicByPhoneRaw } = await supabase.from('gift_pass').select(gpSelRic).eq('user_id', userId).eq('utilizzata', false).eq('attivo', true).is('destinataria_cliente_id', null);
      const gpRicByPhone = ((gpRicByPhoneRaw ?? []) as Record<string, unknown>[]).filter(g => { const n = normPhone(String(g.destinataria_telefono ?? '')); return n && telNorm && n === telNorm; });
      const seenRic = new Set<string>((gpRicById ?? []).map((g: { id: string }) => g.id));
      const now = new Date();
      const giftPassRicevente = [...((gpRicById ?? []) as Record<string, unknown>[]), ...gpRicByPhone.filter(g => !seenRic.has(g.id as string))]
        .filter(g => !((g.tipo !== 'valore') && g.scadenza_uso && new Date(g.scadenza_uso as string) < now))
        .map(g => ({ ...g, tipo_carta: 'gift_pass_ricevente' as const }));

      setMieCarteData({ cliente: { id: cliente.id, nome: cliente.nome, cognome: cliente.cognome }, cartePremium, carteInfinity, carteUsaEGetta, giftPassDonatore, giftPassRicevente, salone: imp });
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
      // Lookup with same priority: codice_cliente > telefono > nome+cognome
      let c: { nome: string; cognome: string; telefono: string; email: string | null; data_nascita: string | null; note: string | null; foto_url: string | null } | null = null;
      const codice = codiceCliente.trim().toUpperCase();
      if (codice) {
        const { data } = await supabase.from('clienti').select('nome,cognome,telefono,email,data_nascita,note,foto_url').eq('user_id', userId).eq('codice_cliente', codice).is('deleted_at', null).maybeSingle();
        c = data ?? null;
      }
      if (!c && telefono.trim()) {
        const telN = normPhone(telefono.trim());
        const { data: all } = await supabase.from('clienti').select('nome,cognome,telefono,email,data_nascita,note,foto_url').eq('user_id', userId).is('deleted_at', null);
        c = (all ?? []).find((r: { telefono: string }) => normPhone(r.telefono ?? '') === telN) ?? null;
      }
      if (!c && nome.trim() && cognome.trim()) {
        const { data } = await supabase.from('clienti').select('nome,cognome,telefono,email,data_nascita,note,foto_url').eq('user_id', userId).ilike('nome', nome.trim()).ilike('cognome', cognome.trim()).is('deleted_at', null).maybeSingle();
        c = data ?? null;
      }
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
        setProfiloNome(nome);
        setProfiloCognome(cognome);
        setProfiloTelefono(telefono);
      }
    } catch {
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
      // Lookup cliente with same priority as loadProfilo
      let clienteId: string | null = null;
      const codice = codiceCliente.trim().toUpperCase();
      if (codice) {
        const { data } = await supabase.from('clienti').select('id').eq('user_id', userId).eq('codice_cliente', codice).is('deleted_at', null).maybeSingle();
        clienteId = data?.id ?? null;
      }
      if (!clienteId && telefono.trim()) {
        const telN = normPhone(telefono.trim());
        const { data: all } = await supabase.from('clienti').select('id,telefono').eq('user_id', userId).is('deleted_at', null);
        clienteId = (all ?? []).find((r: { telefono: string }) => normPhone(r.telefono ?? '') === telN)?.id ?? null;
      }
      if (!clienteId && nome.trim() && cognome.trim()) {
        const { data } = await supabase.from('clienti').select('id').eq('user_id', userId).ilike('nome', nome.trim()).ilike('cognome', cognome.trim()).is('deleted_at', null).maybeSingle();
        clienteId = data?.id ?? null;
      }

      const schedaPayload = {
        nome: profiloNome.trim(),
        cognome: profiloCognome.trim(),
        email: profiloEmail.trim() || null,
        data_nascita: profiloDataNascita || null,
        note: profiloNote.trim() || null,
      };

      if (!clienteId) {
        const tel = (telefono || profiloTelefono).trim();
        const { error } = await supabase.from('schede_clienti_da_confermare').insert(
          { user_id: userId, telefono: tel, stato: 'in_attesa', ...schedaPayload }
        );
        if (error && error.code !== '23505') throw new Error('Errore durante l\'invio della scheda.');
        setProfiloSchedaInviata(true);
        setProfiloFotoBase64('');
        setTimeout(() => setProfiloSchedaInviata(false), 5000);
        return;
      }

      const updateData: Record<string, unknown> = {
        ...schedaPayload,
        updated_at: new Date().toISOString(),
      };
      if (codice && telefono.trim()) updateData.telefono = telefono.trim();

      // Upload foto se presente
      if (profiloFotoBase64 && profiloFotoMime) {
        const mimeType = profiloFotoMime.startsWith('image/') ? profiloFotoMime : 'image/jpeg';
        const ext = mimeType.split('/')[1]?.replace('jpeg', 'jpg') ?? 'jpg';
        const filename = `clienti/${clienteId}_${Date.now()}.${ext}`;
        const binaryStr = atob(profiloFotoBase64);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
        const { error: uploadErr } = await supabase.storage.from('foto-clienti').upload(filename, bytes, { contentType: mimeType, upsert: true });
        if (!uploadErr) {
          const { data: urlData } = supabase.storage.from('foto-clienti').getPublicUrl(filename);
          updateData.foto_url = urlData.publicUrl;
        }
      }

      const { error: updateErr } = await supabase.from('clienti').update(updateData).eq('id', clienteId);
      if (updateErr) throw new Error(updateErr.message);

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
      const { data: gp } = await supabase.from('gift_pass').select('id,tipo,scadenza_uso_giorni,cliente_id,fiche_acquisto_id,donata').eq('id', giftPassId).eq('user_id', userId).maybeSingle();
      if (!gp) throw new Error('Gift pass non trovato');
      if (gp.donata) { await loadMieCarte(); return true; }
      const patch: Record<string, unknown> = { donata: true };
      if (gp.tipo !== 'valore' && gp.scadenza_uso_giorni) {
        const d = new Date();
        d.setDate(d.getDate() + gp.scadenza_uso_giorni);
        patch.scadenza_uso = d.toISOString();
      }
      const { error } = await supabase.from('gift_pass').update(patch).eq('id', giftPassId);
      if (error) throw new Error(error.message);
      await loadMieCarte();
      return true;
    } catch {
      return false;
    }
  }

  async function handleRegalaCartaSconto(cartaId: string): Promise<boolean> {
    try {
      const telNorm = normPhone(telefono.trim());
      // Verify the card belongs to this cliente
      const { data: clienti } = await supabase.from('clienti').select('id').eq('user_id', userId).is('deleted_at', null);
      const clienteId = ((clienti ?? []) as { id: string; telefono: string }[]).find((c: { telefono: string }) => normPhone(c.telefono ?? '') === telNorm)?.id ?? null;
      if (!clienteId) throw new Error('Cliente non trovata');
      const { data: carta } = await supabase.from('carte_sconto').select('id,cliente_id,usa_e_getta,regalata,ex_proprietaria_nome').eq('id', cartaId).eq('user_id', userId).maybeSingle();
      if (!carta) throw new Error('Carta non trovata');
      if (carta.cliente_id !== clienteId) throw new Error('Non autorizzata');
      if (!carta.usa_e_getta) throw new Error('Non è una carta usa e getta');
      if (carta.regalata) throw new Error('Carta già regalata');
      // Lookup nome for ex_proprietaria_nome
      const { data: cli } = await supabase.from('clienti').select('nome,cognome').eq('id', clienteId).maybeSingle();
      const exNome = cli ? `${cli.nome} ${cli.cognome}` : '';
      const { error } = await supabase.from('carte_sconto').update({ regalata: true, ex_proprietaria_nome: exNome, cliente_id: null, regalata_da_cliente_id: clienteId }).eq('id', cartaId);
      if (error) throw new Error(error.message);
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

    const saved: Record<string, string> = { nome: nome.trim(), cognome: cognome.trim(), telefono: tel };
    if (codiceCliente.trim()) saved.codiceCliente = codiceCliente.trim().toUpperCase();
    if (cartaScontoCode.trim()) saved.cartaScontoCode = cartaScontoCode.trim();
    if (giftPassCode.trim()) saved.giftPassCode = giftPassCode.trim();
    localStorage.setItem(LS_CLIENTE_KEY, JSON.stringify(saved));

    // Verifica se la cliente esiste già in rubrica (confermata) — blocca la creazione di
    // schede_da_confermare per evitare duplicati su clienti già registrati.
    let clienteGiaEsiste = knownExisting;
    try {
      const { data: esiste } = await supabase.rpc('cliente_esiste_in_rubrica', {
        p_user_id: userId,
        p_telefono: tel,
      });
      if (esiste) clienteGiaEsiste = true;
    } catch { /* non bloccante */ }

    // Verifica se la cliente ha fiches convalidate — determina quali servizi può prenotare.
    // Usa RPC con SECURITY DEFINER: non richiede edge function, funziona con anon key.
    try {
      const { data: haFiches } = await supabase.rpc('cliente_ha_fiches', {
        p_user_id: userId,
        p_telefono: tel,
      });
      setIsNuovaScheda(!haFiches);
      if (haFiches) clienteGiaEsiste = true;
    } catch { /* non bloccante — default true (restrittivo) */ }

    // Crea scheda da confermare solo se la cliente NON è già registrata in rubrica.
    // Se esiste già, non serve alcuna conferma — evita schede duplicate.
    if (!clienteGiaEsiste) {
      try {
        await insertSchedaSafe({
          user_id: userId,
          nome: nome.trim(),
          cognome: cognome.trim(),
          telefono: tel,
          stato: 'in_attesa',
          ...(giftPassCode.trim() ? { codice_gift_pass: giftPassCode.trim().toUpperCase() } : {}),
        });
      } catch { /* non bloccante */ }
    }

    if (cartaScontoCode.trim()) {
      try {
        const codiceUpper = cartaScontoCode.trim().toUpperCase();
        const { data: carta } = await supabase.from('carte_sconto').select('id,regalata,cliente_id,usa_e_getta,attiva,ex_proprietaria_nome,regalata_da_cliente_id').eq('user_id', userId).eq('codice', codiceUpper).maybeSingle();
        if (carta && carta.regalata && carta.attiva) {
          const telN = normPhone(tel);
          const { data: clientiAll } = await supabase.from('clienti').select('id,telefono').eq('user_id', userId).is('deleted_at', null);
          const cliente = ((clientiAll ?? []) as { id: string; telefono: string }[]).find((c: { telefono: string }) => normPhone(c.telefono ?? '') === telN);
          if (cliente) {
            await supabase.from('carte_sconto').update({ cliente_id: cliente.id, regalata: false, regalata_da_cliente_id: carta.regalata_da_cliente_id ?? null }).eq('id', carta.id);
          } else {
            await insertSchedaSafe(
              { user_id: userId, nome: nome.trim(), cognome: cognome.trim(), telefono: tel.trim(), codice_carta_sconto: codiceUpper, presentata_da_nome: carta.ex_proprietaria_nome ?? null, stato: 'in_attesa' }
            );
          }
        }
      } catch { /* non bloccante */ }
    }

    if (giftPassCode.trim()) {
      try {
        const codiceUpper = giftPassCode.trim().toUpperCase();
        const { data: gp } = await supabase.from('gift_pass').select('id,tipo,scadenza_uso_giorni,scadenza_uso,cliente_id,fiche_acquisto_id').eq('user_id', userId).eq('codice', codiceUpper).is('attivata_at', null).eq('utilizzata', false).maybeSingle();
        if (gp) {
          const telN = normPhone(tel);
          const { data: clientiAll } = await supabase.from('clienti').select('id,nome,cognome,telefono').eq('user_id', userId).is('deleted_at', null);
          const cliente = ((clientiAll ?? []) as { id: string; nome: string; cognome: string; telefono: string }[]).find((c: { telefono: string }) => normPhone(c.telefono ?? '') === telN);
          // Find donator name
          let donatoreId: string | null = gp.cliente_id ?? null;
          if (!donatoreId && gp.fiche_acquisto_id) {
            const { data: fiche } = await supabase.from('fiches').select('cliente_id').eq('id', gp.fiche_acquisto_id).maybeSingle();
            donatoreId = fiche?.cliente_id ?? null;
          }
          let presentataDaNome: string | null = null;
          if (donatoreId) {
            const donatore = ((clientiAll ?? []) as { id: string; nome: string; cognome: string }[]).find((c: { id: string }) => c.id === donatoreId);
            if (donatore) presentataDaNome = `${donatore.nome} ${donatore.cognome}`.trim();
          }
          const now2 = new Date().toISOString();
          const scadenzaUsoAt = !gp.scadenza_uso && gp.tipo !== 'valore' && gp.scadenza_uso_giorni
            ? (() => { const d = new Date(); d.setDate(d.getDate() + gp.scadenza_uso_giorni); return d.toISOString(); })()
            : null;
          await supabase.from('gift_pass').update({ attivata_at: now2, updated_at: now2, ...(scadenzaUsoAt ? { scadenza_uso: scadenzaUsoAt } : {}), ...(cliente ? { destinataria_cliente_id: cliente.id } : {}) }).eq('id', gp.id);
          if (!cliente) {
            await insertSchedaSafe(
              { user_id: userId, nome: nome.trim(), cognome: cognome.trim(), telefono: tel.trim(), stato: 'in_attesa', codice_gift_pass: codiceUpper, ...(presentataDaNome ? { presentata_da_nome: presentataDaNome } : {}) }
            );
          }
        }
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

    // Validazione locale codici carte/gift (block self-use)
    if (giftPassCode.trim() || cartaScontoCode.trim()) {
      try {
        const telN = normPhone(telefono.trim());
        if (giftPassCode.trim()) {
          const { data: gp } = await supabase.from('gift_pass').select('destinataria_telefono').eq('codice', giftPassCode.trim().toUpperCase()).is('attivata_at', null).eq('utilizzata', false).maybeSingle();
          if (gp?.destinataria_telefono) {
            const destN = normPhone(gp.destinataria_telefono);
            if (destN && telN && destN === telN) { setDatiError('Questo Gift Pass è destinato a essere regalato a qualcun altro. Non puoi usarlo tu stessa.'); return; }
          }
        }
        if (cartaScontoCode.trim()) {
          const { data: carta } = await supabase.from('carte_sconto').select('regalata,regalata_da_cliente_id').eq('user_id', userId).eq('codice', cartaScontoCode.trim().toUpperCase()).eq('regalata', true).eq('attiva', true).maybeSingle();
          if (carta?.regalata_da_cliente_id) {
            const { data: mitt } = await supabase.from('clienti').select('telefono').eq('id', carta.regalata_da_cliente_id).maybeSingle();
            if (mitt?.telefono) {
              const mittN = normPhone(mitt.telefono);
              if (mittN && telN && mittN === telN) { setDatiError("Questa carta sconto è stata regalata a un'amica. Non puoi usarla tu stessa."); return; }
            }
          }
        }
      } catch { /* non bloccante */ }
    }

    setDatiError('');

    // Conflict check: nome+cognome found in DB but with a different telefono?
    try {
      setDatiChecking(true);
      const telN = normPhone(telefono.trim());
      const { data: matches } = await supabase.from('clienti').select('telefono').eq('user_id', userId).ilike('nome', nome.trim()).ilike('cognome', cognome.trim()).is('deleted_at', null);
      if (matches && matches.length > 0) {
        const exactMatch = (matches as { telefono: string }[]).some(c => normPhone(c.telefono ?? '') === telN);
        if (!exactMatch) {
          setConflittoSubStep('choice');
          setConflittoVecchioTel('');
          setConflittoNuovoTelConferma('');
          setConflittoError('');
          setDatiChecking(false);
          setStep('conflitto_numero');
          return;
        }
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
      const vecchioNorm = normPhone(vecchio);
      const { data: candidates } = await supabase.from('clienti').select('id,telefono').eq('user_id', userId).ilike('nome', nome.trim()).ilike('cognome', cognome.trim()).is('deleted_at', null);
      const match = ((candidates ?? []) as { id: string; telefono: string }[]).find((c: { telefono: string }) => normPhone(c.telefono ?? '') === vecchioNorm);
      if (!match) throw new Error('Il vecchio numero non corrisponde ai dati presenti nel sistema.');
      const { error } = await supabase.from('clienti').update({ telefono: nuovo, updated_at: new Date().toISOString() }).eq('id', match.id);
      if (error) throw new Error(error.message);
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
    try {
      // Upload photos to storage
      async function uploadMsgFoto(base64: string, mime: string): Promise<string> {
        const mimeType = mime.startsWith('image/') ? mime : 'image/jpeg';
        const ext = mimeType.split('/')[1]?.replace('jpeg', 'jpg') ?? 'jpg';
        const filename = `messaggi/${userId}/${crypto.randomUUID()}.${ext}`;
        const binaryStr = atob(base64);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
        const { error } = await supabase.storage.from('foto-clienti').upload(filename, bytes, { contentType: mimeType, upsert: false });
        if (error) throw new Error(`Upload foto fallito: ${error.message}`);
        return supabase.storage.from('foto-clienti').getPublicUrl(filename).data.publicUrl;
      }

      const [foto_url_1, foto_url_2, foto_url_3] = await Promise.all([
        msgFotos[0] ? uploadMsgFoto(msgFotos[0].base64, msgFotos[0].mime) : Promise.resolve(''),
        msgFotos[1] ? uploadMsgFoto(msgFotos[1].base64, msgFotos[1].mime) : Promise.resolve(''),
        msgFotos[2] ? uploadMsgFoto(msgFotos[2].base64, msgFotos[2].mime) : Promise.resolve(''),
      ]);

      // Cerca cliente per telefono
      const telNorm = telefono.trim().replace(/\s/g, '');
      const { data: clienteRows } = await supabase.from('clienti').select('id').eq('user_id', userId).or(`telefono.eq.${telNorm},telefono.eq.${telefono.trim()}`).limit(1);
      const cliente_id = clienteRows?.[0]?.id ?? null;

      // Crea scheda da confermare se la cliente non è già registrata
      if (!cliente_id) {
        await insertSchedaSafe(
          { user_id: userId, nome: nome.trim(), cognome: cognome.trim(), telefono: telefono.trim(), stato: 'in_attesa' }
        );
      }

      const { error: insertErr } = await supabase.from('messaggi_clienti').insert({
        user_id: userId,
        cliente_id,
        nome: nome.trim(),
        cognome: cognome.trim(),
        telefono: telefono.trim(),
        testo: msgTesto.trim(),
        foto_url_1,
        foto_url_2,
        foto_url_3,
        letto: false,
      });
      if (insertErr) throw new Error(insertErr.message);

      setStep('successo_messaggio');
    } catch (err) {
      setMsgError(err instanceof Error ? err.message : 'Errore di rete. Riprova.');
    } finally {
      setMsgSubmitting(false);
    }
  }

  async function fetchMieiMessaggi(playSound: boolean): Promise<MioMessaggio[]> {
    // Resolve telefono via lookup priority
    let resolvedTel = telefono.trim();
    if (!resolvedTel) {
      const codice = codiceCliente.trim().toUpperCase();
      if (codice) {
        const { data } = await supabase.from('clienti').select('telefono').eq('user_id', userId).eq('codice_cliente', codice).is('deleted_at', null).maybeSingle();
        if (data?.telefono) resolvedTel = data.telefono;
      }
      if (!resolvedTel && nome.trim() && cognome.trim()) {
        const { data } = await supabase.from('clienti').select('telefono').eq('user_id', userId).ilike('nome', nome.trim()).ilike('cognome', cognome.trim()).is('deleted_at', null).maybeSingle();
        if (data?.telefono) resolvedTel = data.telefono;
      }
    }

    const { data, error } = await supabase.from('messaggi_clienti').select('id,testo,foto_url_1,foto_url_2,foto_url_3,preferito,risposta_testo,risposta_at,risposta_foto_url_1,risposta_foto_url_2,risposta_foto_url_3,created_at,telefono').eq('user_id', userId).order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    const telN = normPhone(resolvedTel);
    const messaggi: MioMessaggio[] = ((data ?? []) as (MioMessaggio & { telefono: string })[]).filter(m => telN && normPhone(m.telefono ?? '') === telN).map(({ telefono: _t, ...rest }) => rest as MioMessaggio);

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

  async function loadMieiServizi() {
    setLoadingMieiServizi(true);
    setMieiServiziError('');
    try {
      const tel = telefono.trim();
      if (!tel) throw new Error('Nessun numero di telefono');
      const telN = normPhone(tel);
      const { data: clientiAll } = await supabase.from('clienti').select('id,telefono').eq('user_id', userId).is('deleted_at', null);
      const cliente = ((clientiAll ?? []) as { id: string; telefono: string }[]).find(c => normPhone(c.telefono ?? '') === telN);
      if (!cliente) { setMieiServizi([]); return; }

      const { data: fichesD } = await supabase.from('fiches').select('id,data_riferimento,appuntamento_id').eq('user_id', userId).eq('cliente_id', cliente.id).eq('convalidata', true).is('deleted_at', null);
      const { data: apptRaw } = await supabase.from('appuntamenti').select('id,data_ora').eq('user_id', userId).eq('cliente_id', cliente.id).is('deleted_at', null);
      const appIds = (apptRaw ?? []).map((a: { id: string }) => a.id);
      const appDataMap = new Map<string, string>((apptRaw ?? []).map((a: { id: string; data_ora: string }) => [a.id, a.data_ora]));
      const { data: fichesA } = appIds.length > 0
        ? await supabase.from('fiches').select('id,data_riferimento,appuntamento_id').eq('user_id', userId).in('appuntamento_id', appIds).eq('convalidata', true).is('deleted_at', null)
        : { data: [] };

      type FicheRaw = { id: string; data_riferimento: string | null; appuntamento_id: string | null };
      const ficheMap = new Map<string, string>();
      for (const f of ([...(fichesD ?? []), ...(fichesA ?? [])] as FicheRaw[])) {
        if (ficheMap.has(f.id)) continue;
        const d = f.data_riferimento ?? (f.appuntamento_id ? appDataMap.get(f.appuntamento_id) : undefined) ?? null;
        if (d) ficheMap.set(f.id, d);
      }
      if (ficheMap.size === 0) { setMieiServizi([]); return; }

      const ficheIds = Array.from(ficheMap.keys());
      const { data: vociRaw } = await supabase.from('fiche_voci').select('fiche_id,tipo,nome_voce,parrucchiere_id,parrucchieri(nome)').in('fiche_id', ficheIds);
      const { data: prodottiRaw } = await supabase.from('rivendita_prodotti').select('fiche_id,nome_prodotto,quantita,parrucchiere_id,parrucchieri(nome)').in('fiche_id', ficheIds);

      type Voce = { fiche_id: string; tipo: string; nome_voce: string; parrucchieri: { nome: string } | null };
      type Prod = { fiche_id: string; nome_prodotto: string; quantita: number; parrucchieri: { nome: string } | null };
      const vociByFiche = new Map<string, Voce[]>();
      for (const v of (vociRaw ?? []) as Voce[]) { if (!vociByFiche.has(v.fiche_id)) vociByFiche.set(v.fiche_id, []); vociByFiche.get(v.fiche_id)!.push(v); }
      const prodByFiche = new Map<string, Prod[]>();
      for (const p of (prodottiRaw ?? []) as Prod[]) { if (!p.fiche_id) continue; if (!prodByFiche.has(p.fiche_id)) prodByFiche.set(p.fiche_id, []); prodByFiche.get(p.fiche_id)!.push(p); }

      const sedute = Array.from(ficheMap.entries())
        .map(([ficheId, data]) => ({
          fiche_id: ficheId,
          data,
          voci: (vociByFiche.get(ficheId) ?? []).map(v => ({ tipo: v.tipo, nome: v.nome_voce, parrucchiere: v.parrucchieri?.nome ?? null })),
          prodotti: (prodByFiche.get(ficheId) ?? []).map(p => ({ nome: p.nome_prodotto, quantita: p.quantita ?? 1, parrucchiere: p.parrucchieri?.nome ?? null })),
        }))
        .filter(s => s.voci.length > 0 || s.prodotti.length > 0)
        .sort((a, b) => b.data.localeCompare(a.data));

      setMieiServizi(sedute);
    } catch {
      setMieiServiziError('Impossibile caricare i servizi. Riprova.');
    } finally {
      setLoadingMieiServizi(false);
    }
  }

  async function loadNovstralProdotti() {
    setLoadingNostralProdotti(true);
    setNostralProdottiError('');
    try {
      const { data, error } = await supabase.from('prodotti_rivendita_catalogo').select('id,nome,marca,categoria,prezzo_vendita,note,quiz_tags,foto_url,best_seller').eq('attivo', true).eq('user_id', userId).order('categoria', { ascending: true }).order('nome', { ascending: true });
      if (error) throw new Error(error.message);
      setNostralProdotti(Array.isArray(data) ? data : []);
    } catch {
      setNostralProdottiError('Impossibile caricare i prodotti. Riprova.');
    } finally {
      setLoadingNostralProdotti(false);
    }
  }

  async function loadMieiAppuntamenti() {
    setLoadingMieiAppuntamenti(true);
    setMieiAppuntamentiError('');
    try {
      const tel = telefono.trim();
      if (!tel) throw new Error('Nessun numero di telefono');
      const telNorm = tel.replace(/\s/g, '');

      const { data: clienteRow } = await supabase.from('clienti').select('id').eq('user_id', userId).ilike('telefono', telNorm).is('deleted_at', null).maybeSingle();

      let appuntamentiRaw: { id: string; data_ora: string; stato: string; parrucchiere_id: string | null }[] = [];
      if (clienteRow?.id) {
        const { data } = await supabase.from('appuntamenti').select('id,data_ora,stato,parrucchiere_id').eq('user_id', userId).eq('cliente_id', clienteRow.id).neq('stato', 'cancellato').is('deleted_at', null).order('data_ora', { ascending: false });
        appuntamentiRaw = (data ?? []) as typeof appuntamentiRaw;
      }

      const appIds = appuntamentiRaw.map(a => a.id);
      let trattamentiRaw: { appuntamento_id: string; nome_trattamento: string }[] = [];
      if (appIds.length > 0) {
        const { data } = await supabase.from('appuntamento_trattamenti').select('appuntamento_id,nome_trattamento').in('appuntamento_id', appIds);
        trattamentiRaw = (data ?? []) as typeof trattamentiRaw;
      }

      const { data: richiesteRaw } = await supabase.from('richieste_appuntamento').select('id,data_ora,parrucchiere_id,servizio_id,chiunque').eq('user_id', userId).ilike('telefono', telNorm).eq('stato', 'in_attesa').gte('data_ora', new Date().toISOString()).order('data_ora', { ascending: true });

      const parrIds = [...new Set([
        ...appuntamentiRaw.map(a => a.parrucchiere_id),
        ...((richiesteRaw ?? []) as { parrucchiere_id: string | null }[]).map(r => r.parrucchiere_id),
      ].filter(Boolean) as string[])];
      let parrucchieriRaw: { id: string; nome: string; colore: string }[] = [];
      if (parrIds.length > 0) {
        const { data } = await supabase.from('parrucchieri').select('id,nome,colore').in('id', parrIds);
        parrucchieriRaw = (data ?? []) as typeof parrucchieriRaw;
      }

      const servizioIds = [...new Set(((richiesteRaw ?? []) as { servizio_id: string }[]).map(r => r.servizio_id).filter(Boolean))];
      let serviziRaw: { id: string; nome: string }[] = [];
      if (servizioIds.length > 0) {
        const { data } = await supabase.from('trattamenti_catalogo').select('id,nome').in('id', servizioIds);
        serviziRaw = (data ?? []) as typeof serviziRaw;
      }

      const parrMap = Object.fromEntries(parrucchieriRaw.map(p => [p.id, p]));
      const servMap = Object.fromEntries(serviziRaw.map(s => [s.id, s.nome]));
      const trattByApp: Record<string, string[]> = {};
      for (const t of trattamentiRaw) { if (!trattByApp[t.appuntamento_id]) trattByApp[t.appuntamento_id] = []; if (t.nome_trattamento) trattByApp[t.appuntamento_id].push(t.nome_trattamento); }

      const appuntamenti = appuntamentiRaw.map(a => ({
        id: a.id, data_ora: a.data_ora, stato: a.stato,
        parrucchiere: a.parrucchiere_id ? (parrMap[a.parrucchiere_id] ?? null) : null,
        servizi: trattByApp[a.id] ?? [], tipo: 'appuntamento' as const,
      }));
      const richieste = ((richiesteRaw ?? []) as { id: string; data_ora: string; parrucchiere_id: string | null; servizio_id: string; chiunque: boolean }[]).map(r => ({
        id: r.id, data_ora: r.data_ora, stato: 'in_attesa' as const,
        parrucchiere: (r.chiunque || !r.parrucchiere_id) ? null : (parrMap[r.parrucchiere_id] ?? null),
        servizi: r.servizio_id && servMap[r.servizio_id] ? [servMap[r.servizio_id]] : [], tipo: 'richiesta' as const,
      }));

      setMieiAppuntamenti(appuntamenti);
      setMieiRichiestePendenti(richieste);
    } catch {
      setMieiAppuntamentiError('Impossibile caricare gli appuntamenti. Riprova.');
    } finally {
      setLoadingMieiAppuntamenti(false);
    }
  }

  function dismissBanner(key: string) {
    const next = { ...bannerDismissed, [key]: true };
    setBannerDismissed(next);
    localStorage.setItem('appt_banners_v1', JSON.stringify(next));
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
      const { error } = await supabase.from('messaggi_clienti').update({ preferito: val }).eq('id', id).eq('user_id', userId);
      if (error) throw error;
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

    try {
      // Blacklist check
      const { data: clienteRow } = await supabase.from('clienti').select('id,in_blacklist').eq('user_id', userId).ilike('telefono', telefono.trim().replace(/\s/g, '')).maybeSingle();
      if (clienteRow?.in_blacklist) {
        setSubmitError('Non siamo in grado di accettare la tua richiesta al momento.');
        setSubmitting(false);
        return;
      }

      // Check prenotazioni online are active
      const { data: impRow } = await supabase.from('impostazioni').select('valore').eq('user_id', userId).eq('chiave', 'prenotazioni_online_attive').maybeSingle();
      if (impRow?.valore === 'false') {
        setSubmitError('Il servizio di prenotazione online è momentaneamente sospeso.');
        setSubmitting(false);
        return;
      }

      const { error: insertErr } = await supabase.from('richieste_appuntamento').insert({
        user_id: userId,
        nome: nome.trim(),
        cognome: cognome.trim(),
        telefono: telefono.trim(),
        cliente_id: clienteRow?.id ?? null,
        parrucchiere_id: chiunque ? null : parrucchiere!.id,
        servizio_id: servizio.id,
        data_ora: dataOraBase.toISOString(),
        parrucchiere2_id: (!chiunque && parrucchiere2?.id) ? parrucchiere2.id : null,
        servizio2_id: (!chiunque && servizio.servizio_abbinato_online_id) ? servizio.servizio_abbinato_online_id : null,
        data_ora2: dataOra2,
        chiunque: chiunque || false,
        parrucchieri_candidati: chiunque && parrucchieriCandidati.length > 0 ? parrucchieriCandidati : null,
        ...(giftPassCode.trim() ? { gift_pass_codice: giftPassCode.trim().toUpperCase() } : {}),
      });
      if (insertErr) { setSubmitError('Errore nel salvataggio della richiesta.'); setSubmitting(false); return; }

      // Crea scheda da confermare se non è in rubrica (non bloccante)
      if (!clienteRow) {
        insertSchedaSafe(
          { user_id: userId, nome: nome.trim(), cognome: cognome.trim(), telefono: telefono.trim(), stato: 'in_attesa' }
        ).then(() => {});
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

  if (info.portaleNascosto) {
    return (
      <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-6">
        <SalonHeader info={info} />
        <div className="mt-10 bg-white rounded-2xl border border-stone-200 p-8 text-center max-w-sm w-full shadow-sm">
          <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <X size={24} className="text-amber-400" />
          </div>
          <p className="font-semibold text-stone-800 text-lg mb-3">Portale temporaneamente non disponibile</p>
          <p className="text-stone-500 text-sm leading-relaxed">
            Ci scusiamo per il disagio. Il portale online è momentaneamente sospeso.
          </p>
          <p className="text-stone-500 text-sm leading-relaxed mt-3">
            <span className="font-medium text-stone-700">Non preoccuparti</span> — tutte le tue carte e promozioni sono al sicuro e registrate nel nostro sistema. Non perderai nulla.
          </p>
          <p className="text-stone-400 text-xs mt-4">Contattaci direttamente per qualsiasi necessità.</p>
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
      {/* Lightbox Modal */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(10,10,10,0.85)', backdropFilter: 'blur(6px)' }}
          onClick={() => setLightboxUrl(null)}
          onKeyDown={e => { if (e.key === 'Escape') setLightboxUrl(null); }}
          tabIndex={-1}
        >
          <div
            className="relative max-w-sm w-full mx-auto"
            onClick={e => e.stopPropagation()}
          >
            <img
              src={lightboxUrl}
              alt="Anteprima prodotto"
              className="w-full rounded-2xl shadow-2xl object-contain max-h-[80vh]"
              style={{ animation: 'lightboxIn 0.22s cubic-bezier(0.34,1.56,0.64,1) both' }}
            />
            <button
              onClick={() => setLightboxUrl(null)}
              className="absolute -top-3 -right-3 w-9 h-9 bg-white rounded-full shadow-lg flex items-center justify-center text-stone-600 hover:text-stone-900 hover:scale-110 transition-all"
              aria-label="Chiudi"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Benvenuto prima-volta */}
      {showBenvenuto && (
        <BenvenutoModal
          nome={nome}
          config={info?.benvenutoConfig ?? undefined}
          onClose={() => {
            localStorage.setItem(`benvenuto_visto_${userId}_${telefono.trim()}`, '1');
            // Aggiorna il flag nel DB (non bloccante)
            supabase.from('schede_clienti_da_confermare').update({ benvenuto_visto: true }).eq('user_id', userId).eq('telefono', telefono.trim()).then(() => {});
            setShowBenvenuto(false);
          }}
        />
      )}

      {/* Annuncio / Birthday modal */}
      {showAnnuncio === 'compleanno' && (
        <AnnuncioModal
          sfondo="compleanno"
          testo={info.annuncio?.compleannoTesto || COMPLEANNO_DEFAULT_TESTO}
          nome={nome}
          isCompleanno
          onClose={() => {
            const year = new Date().getFullYear();
            localStorage.setItem(`birthday_ann_${userId}_${year}`, '1');
            setShowAnnuncio(null);
          }}
        />
      )}
      {showAnnuncio === 'annuncio' && info.annuncio && (
        <AnnuncioModal
          sfondo={info.annuncio.sfondo}
          testo={(() => {
            let t = info.annuncio!.testo;
            const fi = info.contatti?.ferieInizio;
            const ff = info.contatti?.ferieFine;
            if (fi) t = t.replace(/\[DATA INIZIO\]/gi, new Date(fi + 'T00:00:00').toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' }));
            if (ff) t = t.replace(/\[DATA FINE\]/gi, new Date(ff + 'T00:00:00').toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' }));
            return t;
          })()}
          nome={nome}
          onClose={() => {
            const sfondo = info.annuncio!.sfondo;
            const today = new Date();
            const year = today.getFullYear();
            const mm = String(today.getMonth() + 1).padStart(2, '0');
            const dd = String(today.getDate()).padStart(2, '0');
            if (sfondo === 'san_valentino') {
              localStorage.setItem(`ann_valentino_${userId}_${year}`, '1');
            } else if (sfondo === 'natale') {
              localStorage.setItem(`ann_natale_${userId}_${year}`, '1');
            } else if (sfondo === 'halloween') {
              localStorage.setItem(`ann_halloween_${userId}_${year}`, '1');
            } else if (sfondo === 'capodanno') {
              const capodannoYear = (mm === '01' && parseInt(dd) <= 6) ? year - 1 : year;
              localStorage.setItem(`ann_capodanno_${userId}_${capodannoYear}`, '1');
            } else if (sfondo !== 'ferie') {
              // generico, estate, autunno, primavera, pasqua: usa ID annuncio
              localStorage.setItem(`ann_seen_${userId}_${info.annuncio!.id}`, '1');
            }
            // ferie: non salva nulla — ricompare ad ogni apertura
            setShowAnnuncio(null);
          }}
        />
      )}

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
        {step !== 'successo' && step !== 'scelta' && step !== 'scrivici' && step !== 'successo_messaggio' && step !== 'miei_messaggi' && step !== 'mie_carte' && step !== 'profilo' && step !== 'miei_appuntamenti' && step !== 'miei_servizi' && (
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
              <p className="text-3xl font-bold text-stone-800">Ciao, {nome}!</p>
              <p className="text-base text-stone-400 mt-1">Cosa vuoi fare oggi?</p>
            </div>

            {/* Banner promemoria appuntamenti oggi/domani */}
            {(() => {
              const now = new Date();
              const todayStr = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`;
              const tomorrowStr = addDays(todayStr, 1);
              const candidates = mieiAppuntamenti.filter(a => {
                if (a.tipo !== 'appuntamento') return false;
                const dataStr = new Date(a.data_ora).toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' });
                return (dataStr === todayStr || dataStr === tomorrowStr) && new Date(a.data_ora) >= now;
              });
              if (candidates.length === 0) return null;
              return (
                <>
                  {candidates.map(a => {
                    const dataStr = new Date(a.data_ora).toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' });
                    const isOggi = dataStr === todayStr;
                    const bannerKey = `${a.id}_${isOggi ? 'oggi' : 'domani'}`;
                    if (bannerDismissed[bannerKey]) return null;
                    const ora = new Date(a.data_ora).toLocaleTimeString('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit' });
                    return (
                      <div key={bannerKey} className="bg-pink-100 border border-pink-300 rounded-2xl px-5 py-4 flex items-start gap-3">
                        <Bell size={20} className="text-pink-600 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-pink-800 text-sm">
                            {isOggi ? 'Oggi' : 'Domani'} hai un appuntamento alle {ora}
                          </p>
                          {a.servizi.length > 0 && (
                            <p className="text-xs text-pink-600 mt-0.5">{a.servizi.join(' + ')}</p>
                          )}
                        </div>
                        <button onClick={() => dismissBanner(bannerKey)} className="text-pink-400 hover:text-pink-700 transition-colors flex-shrink-0">
                          <X size={16} />
                        </button>
                      </div>
                    );
                  })}
                </>
              );
            })()}

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

            {info.prenotazioniAttive ? (
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
            ) : (
              <div className="w-full flex items-center gap-5 bg-stone-50 border-2 border-stone-200 rounded-3xl p-6 text-left opacity-70">
                <div className="w-14 h-14 bg-stone-100 rounded-2xl flex items-center justify-center flex-shrink-0">
                  <CalendarPlus size={26} className="text-stone-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-stone-500 text-lg">Richiedi un appuntamento</p>
                  <p className="text-sm text-stone-400 mt-0.5">Le prenotazioni online sono momentaneamente sospese. Contattaci direttamente.</p>
                </div>
                <X size={20} className="text-stone-300 flex-shrink-0" />
              </div>
            )}

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

            <button
              onClick={() => { loadMieiAppuntamenti(); setStep('miei_appuntamenti'); }}
              className="w-full flex items-center gap-5 bg-white border-2 border-stone-200 rounded-3xl p-6 hover:border-teal-400 hover:shadow-md transition-all text-left group"
            >
              <div className="w-14 h-14 bg-teal-50 rounded-2xl flex items-center justify-center flex-shrink-0 group-hover:bg-teal-100 transition-colors">
                <Calendar size={26} className="text-teal-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-stone-800 text-lg">I miei appuntamenti</p>
                <p className="text-sm text-stone-400 mt-0.5">Storico e prossimi appuntamenti</p>
              </div>
              <ChevronRight size={20} className="text-stone-300 group-hover:text-teal-500 transition-colors flex-shrink-0" />
            </button>

            <button
              onClick={() => { loadMieiServizi(); loadMappaBellezza(); setStep('miei_servizi'); }}
              className="w-full flex items-center gap-5 bg-white border-2 border-stone-200 rounded-3xl p-6 hover:border-orange-400 hover:shadow-md transition-all text-left group"
            >
              <div className="w-14 h-14 bg-orange-50 rounded-2xl flex items-center justify-center flex-shrink-0 group-hover:bg-orange-100 transition-colors">
                <Scissors size={26} className="text-orange-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-stone-800 text-lg">I miei servizi</p>
                <p className="text-sm text-stone-400 mt-0.5">Storico trattamenti e acquisti</p>
              </div>
              <ChevronRight size={20} className="text-stone-300 group-hover:text-orange-500 transition-colors flex-shrink-0" />
            </button>

            <button
              onClick={() => {
                loadNovstralProdotti();
                setQuizStep(0);
                setQuizRisposte([]);
                setMappaSalvata(false);
                setStep('quiz_capelli');
              }}
              className="w-full flex items-center gap-5 bg-gradient-to-r from-emerald-50 to-teal-50 border-2 border-emerald-300 rounded-3xl p-6 hover:border-emerald-500 hover:shadow-md transition-all text-left group"
            >
              <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center flex-shrink-0 group-hover:bg-emerald-200 transition-colors">
                <span className="text-2xl">💆</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-stone-800 text-lg leading-tight">Il Codice della tua Bellezza</p>
                <p className="text-sm text-emerald-600 font-medium mt-1 leading-snug">Rivela la formula ideale per la tua chioma ed evoca il tuo rituale su misura.</p>
              </div>
              <ChevronRight size={20} className="text-stone-300 group-hover:text-emerald-500 transition-colors flex-shrink-0" />
            </button>

            <button
              onClick={() => { loadNovstralProdotti(); setStep('nostri_prodotti'); }}
              className="w-full flex items-center gap-5 bg-white border-2 border-stone-200 rounded-3xl p-6 hover:border-emerald-400 hover:shadow-md transition-all text-left group"
            >
              <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center flex-shrink-0 group-hover:bg-emerald-100 transition-colors">
                <TrendingUp size={26} className="text-emerald-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-stone-800 text-lg">I nostri prodotti</p>
                <p className="text-sm text-stone-400 mt-0.5">Scopri i prodotti del salone</p>
              </div>
              <ChevronRight size={20} className="text-stone-300 group-hover:text-emerald-500 transition-colors flex-shrink-0" />
            </button>

            <button
              onClick={() => setStep('contatti')}
              className="w-full flex items-center gap-5 bg-white border-2 border-stone-200 rounded-3xl p-6 hover:border-teal-400 hover:shadow-md transition-all text-left group"
            >
              <div className="w-14 h-14 bg-teal-50 rounded-2xl flex items-center justify-center flex-shrink-0 group-hover:bg-teal-100 transition-colors">
                <MapPin size={26} className="text-teal-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-stone-800 text-lg">Contatti</p>
                <p className="text-sm text-stone-400 mt-0.5">Indirizzo, telefono, email e come trovarci</p>
              </div>
              <ChevronRight size={20} className="text-stone-300 group-hover:text-teal-500 transition-colors flex-shrink-0" />
            </button>

            <div className="mt-2 bg-sky-50 border border-sky-200 rounded-2xl px-5 py-4 text-center">
              <p className="text-sm text-sky-700 leading-relaxed">
                <span className="font-semibold">Hai un'idea in testa ma non sai come spiegarla?</span><br />
                Mandaci le foto che ti ispirano — un taglio, un colore, uno stile. Ti aiuteremo a trasformare il tuo sogno in realtà. ✨
              </p>
            </div>

            <SocialStrip social={info?.social} />

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

        {/* STEP: I miei appuntamenti */}
        {step === 'miei_appuntamenti' && (() => {
          const now = new Date();
          const todayDateStr = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`;
          const tomorrowDateStr = addDays(todayDateStr, 1);

          const allItems = [...mieiAppuntamenti, ...mieiRichiestePendenti];
          const futuri = allItems
            .filter(a => new Date(a.data_ora) >= now)
            .sort((a, b) => new Date(a.data_ora).getTime() - new Date(b.data_ora).getTime());
          const passati = mieiAppuntamenti
            .filter(a => new Date(a.data_ora) < now)
            .sort((a, b) => new Date(b.data_ora).getTime() - new Date(a.data_ora).getTime());

          // Banners: find confirmed future appointments today or tomorrow
          const bannersToShow = futuri.filter(a => {
            if (a.tipo !== 'appuntamento') return false;
            const dataStr = new Date(a.data_ora).toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' });
            return (dataStr === todayDateStr || dataStr === tomorrowDateStr);
          });

          function formatOra(isoStr: string) {
            return new Date(isoStr).toLocaleTimeString('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit' });
          }
          function formatDataLunga(isoStr: string) {
            return new Date(isoStr).toLocaleDateString('it-IT', { timeZone: 'Europe/Rome', day: 'numeric', month: 'long', year: 'numeric' });
          }

          return (
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <button onClick={() => setStep('scelta')} className="w-9 h-9 flex items-center justify-center rounded-xl border border-stone-200 text-stone-500 hover:bg-stone-100 transition-colors flex-shrink-0">
                  <ChevronLeft size={18} />
                </button>
                <div>
                  <p className="text-xl font-bold text-stone-800">I miei appuntamenti</p>
                  <p className="text-sm text-stone-400">{nome} {cognome}</p>
                </div>
              </div>

              {/* Banners oggi/domani */}
              {bannersToShow.map(a => {
                const dataStr = new Date(a.data_ora).toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' });
                const isOggi = dataStr === todayDateStr;
                const bannerKey = `${a.id}_${isOggi ? 'oggi' : 'domani'}`;
                if (bannerDismissed[bannerKey]) return null;
                return (
                  <div key={bannerKey} className="bg-pink-100 border border-pink-300 rounded-2xl px-5 py-4 flex items-start gap-3">
                    <Bell size={20} className="text-pink-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-pink-800 text-sm">
                        {isOggi ? 'Oggi' : 'Domani'} hai un appuntamento alle {formatOra(a.data_ora)}
                      </p>
                      {a.servizi.length > 0 && (
                        <p className="text-xs text-pink-600 mt-0.5">{a.servizi.join(' + ')}</p>
                      )}
                    </div>
                    <button onClick={() => dismissBanner(bannerKey)} className="text-pink-400 hover:text-pink-700 transition-colors flex-shrink-0">
                      <X size={16} />
                    </button>
                  </div>
                );
              })}

              {loadingMieiAppuntamenti && (
                <div className="flex justify-center py-10">
                  <div className="w-7 h-7 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
                </div>
              )}

              {mieiAppuntamentiError && (
                <div className="bg-red-50 border border-red-200 rounded-2xl px-5 py-4 text-center">
                  <p className="text-sm text-red-600 mb-3">{mieiAppuntamentiError}</p>
                  <button onClick={loadMieiAppuntamenti} className="text-sm font-semibold text-red-700 underline">Riprova</button>
                </div>
              )}

              {!loadingMieiAppuntamenti && !mieiAppuntamentiError && (
                <>
                  {/* Richieste pendenti */}
                  {mieiRichiestePendenti.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-bold text-stone-400 uppercase tracking-widest px-1">In attesa di conferma</p>
                      {mieiRichiestePendenti.map(r => (
                        <div key={r.id} className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-stone-800 text-sm">
                                {new Date(r.data_ora).toLocaleDateString('it-IT', { timeZone: 'Europe/Rome', weekday: 'long', day: 'numeric', month: 'long' })}
                              </p>
                              <p className="text-stone-600 text-sm mt-0.5">{formatOra(r.data_ora)}{r.parrucchiere ? ` · ${r.parrucchiere.nome}` : ''}</p>
                              {r.servizi.length > 0 && (
                                <p className="text-xs text-stone-400 mt-1">{r.servizi.join(' + ')}</p>
                              )}
                            </div>
                            <span className="flex-shrink-0 bg-amber-200 text-amber-800 text-xs font-bold px-2.5 py-1 rounded-full">In attesa</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Prossimi appuntamenti */}
                  {futuri.filter(a => a.tipo === 'appuntamento').length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-bold text-stone-400 uppercase tracking-widest px-1">Prossimi</p>
                      {futuri.filter(a => a.tipo === 'appuntamento').map(a => (
                        <div key={a.id} className="bg-white border border-stone-200 rounded-2xl px-5 py-4 shadow-sm">
                          <div className="flex items-start gap-3">
                            {a.parrucchiere && (
                              <div className="w-3 h-3 rounded-full flex-shrink-0 mt-1.5" style={{ backgroundColor: a.parrucchiere.colore }} />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-stone-800">
                                {new Date(a.data_ora).toLocaleDateString('it-IT', { timeZone: 'Europe/Rome', weekday: 'long', day: 'numeric', month: 'long' })}
                              </p>
                              <p className="text-teal-700 font-bold text-lg leading-tight">{formatOra(a.data_ora)}</p>
                              {a.parrucchiere && <p className="text-sm text-stone-500 mt-0.5">{a.parrucchiere.nome}</p>}
                              {a.servizi.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mt-2">
                                  {a.servizi.map((s, i) => (
                                    <span key={i} className="bg-teal-50 text-teal-700 text-xs font-medium px-2.5 py-1 rounded-full border border-teal-200">{s}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Passati */}
                  {passati.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-bold text-stone-400 uppercase tracking-widest px-1">Precedenti</p>
                      {passati.map(a => (
                        <div key={a.id} className="bg-stone-50 border border-stone-200 rounded-2xl px-5 py-3.5">
                          <p className="text-sm text-stone-500">{formatDataLunga(a.data_ora)}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {mieiAppuntamenti.length === 0 && mieiRichiestePendenti.length === 0 && (
                    <div className="text-center py-12">
                      <div className="w-16 h-16 bg-stone-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <Calendar size={28} className="text-stone-300" />
                      </div>
                      <p className="font-semibold text-stone-600">Nessun appuntamento trovato</p>
                      <p className="text-sm text-stone-400 mt-1">I tuoi prossimi appuntamenti compariranno qui</p>
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })()}

        {/* STEP: I miei servizi */}
        {step === 'miei_servizi' && (() => {
          const now = new Date();
          const cutoffMap: Record<string, Date> = {
            '1m': new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()),
            '3m': new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()),
            '1y': new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()),
            'all': new Date(0),
          };
          const cutoff = cutoffMap[serviziPeriodo];

          const filtered = mieiServizi.filter(s => {
            if (!s.data) return false;
            const d = new Date(s.data + 'T12:00:00');
            if (d < cutoff) return false;
            if (serviziNomeFiltro) {
              const q = serviziNomeFiltro.toLowerCase();
              const matchVoci = s.voci.some(v => v.nome.toLowerCase().includes(q));
              const matchProd = s.prodotti.some(p => p.nome.toLowerCase().includes(q));
              if (!matchVoci && !matchProd) return false;
            }
            return true;
          });

          const periodoLabels: Record<string, string> = { '1m': 'Ultimo mese', '3m': '3 mesi', '1y': 'Anno', 'all': 'Tutto' };

          function formatDataSeduta(dateStr: string) {
            const d = new Date(dateStr + 'T12:00:00');
            return d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
          }

          return (
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <button onClick={() => setStep('scelta')} className="w-9 h-9 flex items-center justify-center rounded-xl border border-stone-200 text-stone-500 hover:bg-stone-100 transition-colors flex-shrink-0">
                  <ChevronLeft size={18} />
                </button>
                <div>
                  <p className="text-xl font-bold text-stone-800">I miei servizi</p>
                  <p className="text-sm text-stone-400">{nome} {cognome}</p>
                </div>
              </div>

              {/* Filtri periodo */}
              <div className="flex gap-2 flex-wrap">
                {(['1m', '3m', '1y', 'all'] as const).map(p => (
                  <button
                    key={p}
                    onClick={() => setServiziPeriodo(p)}
                    className={`px-3.5 py-1.5 rounded-full text-sm font-semibold transition-all ${serviziPeriodo === p ? 'bg-orange-500 text-white shadow-sm' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
                  >
                    {periodoLabels[p]}
                  </button>
                ))}
              </div>

              {/* Filtro per nome */}
              <div className="relative">
                <Scissors size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                <input
                  type="text"
                  value={serviziNomeFiltro}
                  onChange={e => setServiziNomeFiltro(e.target.value)}
                  placeholder="Filtra per servizio o prodotto..."
                  className="w-full border border-stone-200 rounded-xl pl-8 pr-8 py-2.5 text-sm text-stone-800 bg-white focus:outline-none focus:ring-2 focus:ring-orange-400 placeholder:text-stone-400"
                />
                {serviziNomeFiltro && (
                  <button onClick={() => setServiziNomeFiltro('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700">
                    <X size={14} />
                  </button>
                )}
              </div>

              {loadingMieiServizi && (
                <div className="flex justify-center py-10">
                  <div className="w-7 h-7 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
                </div>
              )}

              {mieiServiziError && (
                <div className="bg-red-50 border border-red-200 rounded-2xl px-5 py-4 text-center">
                  <p className="text-sm text-red-600 mb-3">{mieiServiziError}</p>
                  <button onClick={loadMieiServizi} className="text-sm font-semibold text-red-700 underline">Riprova</button>
                </div>
              )}

              {!loadingMieiServizi && !mieiServiziError && (
                <>
                  {filtered.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="w-16 h-16 bg-stone-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <Scissors size={28} className="text-stone-300" />
                      </div>
                      <p className="font-semibold text-stone-600">Nessuna seduta trovata</p>
                      <p className="text-sm text-stone-400 mt-1">
                        {serviziNomeFiltro || serviziPeriodo !== 'all' ? 'Prova a modificare i filtri' : 'Le tue sedute compariranno qui dopo la prima visita'}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filtered.map(s => (
                        <div key={s.fiche_id} className="bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-sm">
                          <div className="bg-orange-50 border-b border-orange-100 px-5 py-3">
                            <p className="text-sm font-bold text-orange-800 capitalize">{formatDataSeduta(s.data)}</p>
                          </div>
                          <div className="px-5 py-4 space-y-3">
                            {s.voci.filter(v => v.tipo === 'servizio').length > 0 && (
                              <div>
                                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-2">Servizi</p>
                                <div className="space-y-1.5">
                                  {s.voci.filter(v => v.tipo === 'servizio').map((v, i) => (
                                    <div key={i} className="flex items-center justify-between gap-3">
                                      <span className="text-sm font-medium text-stone-800">{v.nome}</span>
                                      {v.parrucchiere && (
                                        <span className="text-xs text-stone-500 bg-stone-100 px-2 py-0.5 rounded-full flex-shrink-0">{v.parrucchiere}</span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            {s.voci.filter(v => v.tipo === 'extra').length > 0 && (
                              <div>
                                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-2">Extra</p>
                                <div className="space-y-1.5">
                                  {s.voci.filter(v => v.tipo === 'extra').map((v, i) => (
                                    <div key={i} className="flex items-center justify-between gap-3">
                                      <span className="text-sm text-stone-600">{v.nome}</span>
                                      {v.parrucchiere && (
                                        <span className="text-xs text-stone-400 flex-shrink-0">{v.parrucchiere}</span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            {s.prodotti.length > 0 && (
                              <div className="pt-1 border-t border-stone-100">
                                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-2">Acquistato</p>
                                <div className="space-y-1.5">
                                  {s.prodotti.map((p, i) => (
                                    <div key={i} className="flex items-center justify-between gap-3">
                                      <div className="flex items-center gap-2 min-w-0">
                                        <span className="text-sm text-stone-700">{p.nome}</span>
                                        {p.quantita > 1 && (
                                          <span className="text-xs bg-stone-100 text-stone-500 px-1.5 py-0.5 rounded-full flex-shrink-0">x{p.quantita}</span>
                                        )}
                                      </div>
                                      {p.parrucchiere && (
                                        <span className="text-xs text-stone-400 flex-shrink-0">{p.parrucchiere}</span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* La tua Mappa di Bellezza */}
              {mappaBellezza && (mappaBellezza.shampoo || mappaBellezza.maschera || mappaBellezza.finish) && (
                <div className="mt-6 border-t border-stone-100 pt-6">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 bg-amber-100 rounded-md flex items-center justify-center">
                      <Star size={13} className="text-amber-600" />
                    </div>
                    <p className="text-sm font-bold text-stone-800">La tua Mappa di Bellezza</p>
                  </div>
                  <div className="bg-gradient-to-br from-stone-900 to-stone-800 rounded-2xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-stone-700">
                      <p className="text-xs font-semibold text-amber-400">Routine personalizzata salvata</p>
                      <p className="text-xs text-stone-400 mt-0.5">I prodotti selezionati dal tuo quiz capelli</p>
                    </div>
                    <div className="divide-y divide-stone-700">
                      {[
                        { label: 'STEP 1 — Detergi', emoji: '🚿', p: mappaBellezza.shampoo },
                        { label: 'STEP 2 — Nutri', emoji: '💚', p: mappaBellezza.maschera },
                        { label: 'STEP 3 — Proteggi', emoji: '✨', p: mappaBellezza.finish },
                      ].filter(s => s.p).map((s, i) => (
                        <div key={i} className="flex items-center gap-3 px-4 py-3">
                          {s.p!.foto_url ? (
                            <img src={s.p!.foto_url} alt={s.p!.nome} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                          ) : (
                            <span className="text-lg flex-shrink-0">{s.emoji}</span>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">{s.label}</p>
                            <p className="text-sm font-semibold text-white leading-tight truncate">{s.p!.nome}</p>
                            {s.p!.marca && <p className="text-xs text-stone-400">{s.p!.marca}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="px-4 py-3">
                      <button
                        onClick={() => { loadNovstralProdotti(); setStep('nostri_prodotti'); }}
                        className="w-full py-2.5 rounded-xl text-sm font-semibold text-white bg-amber-500 hover:bg-amber-400 transition-colors"
                      >
                        Aggiorna la mia Mappa
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

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

        {/* STEP: Quiz Capelli */}
        {step === 'quiz_capelli' && quizAnalizzando && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] gap-8 py-16 text-center px-4">
            <div className="relative">
              <div className="w-20 h-20 rounded-full border-4 border-stone-100 border-t-emerald-500 animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center text-3xl">✨</div>
            </div>
            <p className="text-base font-medium text-stone-700 leading-relaxed max-w-xs">
              ✨ Stiamo analizzando le tue risposte e combinando i principi attivi dei nostri prodotti... Il tuo rituale di bellezza personalizzato è quasi pronto!
            </p>
          </div>
        )}

        {step === 'quiz_capelli' && !quizAnalizzando && (() => {
          const domanda = QUIZ_DOMANDE[quizStep];
          const progress = (quizStep / QUIZ_DOMANDE.length) * 100;
          return (
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => { if (quizStep === 0) setStep('scelta'); else setQuizStep(q => q - 1); }}
                  className="w-9 h-9 flex items-center justify-center rounded-xl border border-stone-200 text-stone-500 hover:bg-stone-100 transition-colors flex-shrink-0"
                >
                  <ChevronLeft size={18} />
                </button>
                <div className="flex-1">
                  <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Quiz Capelli</p>
                  <p className="text-xs text-stone-400">{quizStep + 1} di {QUIZ_DOMANDE.length}</p>
                </div>
              </div>

              <div className="w-full h-1.5 bg-stone-100 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
              </div>

              <div className="text-center py-2">
                <span className="text-5xl">{domanda.emoji}</span>
                <h2 className="text-xl font-bold text-stone-800 mt-4 leading-snug">{domanda.domanda}</h2>
                <p className="text-sm text-stone-400 mt-1">Seleziona l'opzione più adatta</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {domanda.opzioni.map(opzione => (
                  <button
                    key={opzione.tag}
                    onClick={() => {
                      const nuoveRisposte = [...quizRisposte, opzione.tag];
                      if (quizStep < QUIZ_DOMANDE.length - 1) {
                        setQuizRisposte(nuoveRisposte);
                        setQuizStep(q => q + 1);
                      } else {
                        setQuizRisposte(nuoveRisposte);
                        setMappaSalvata(false);
                        setQuizAnalizzando(true);
                        setTimeout(() => {
                          const risultato = calcolaRoutine(nuoveRisposte);
                          setRoutineRisultato(risultato);
                          setQuizAnalizzando(false);
                          setStep('routine_risultato');
                        }, 2500);
                      }
                    }}
                    className="flex items-center justify-center bg-white border-2 border-stone-200 rounded-2xl p-4 hover:border-emerald-400 hover:bg-emerald-50 active:scale-95 transition-all text-center group"
                  >
                    <span className="text-sm font-semibold text-stone-700 group-hover:text-emerald-700 leading-tight">{opzione.label}</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })()}

        {/* STEP: Routine Risultato */}
        {step === 'routine_risultato' && (() => {
          const { shampoo, maschera, finish } = routineRisultato;
          const stepsRoutine: { label: string; subLabel: string; emoji: string; prodotto: typeof shampoo }[] = [
            { label: 'STEP 1 — Detergi', subLabel: 'Shampoo', emoji: '🚿', prodotto: shampoo },
            { label: 'STEP 2 — Nutri', subLabel: 'Maschera', emoji: '💚', prodotto: maschera },
            { label: 'STEP 3 — Proteggi & Illumina', subLabel: 'Finish', emoji: '✨', prodotto: finish },
          ];

          return (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => { setQuizStep(QUIZ_DOMANDE.length - 1); setStep('quiz_capelli'); }}
                  className="w-9 h-9 flex items-center justify-center rounded-xl border border-stone-200 text-stone-500 hover:bg-stone-100 transition-colors flex-shrink-0"
                >
                  <ChevronLeft size={18} />
                </button>
                <div>
                  <p className="text-xl font-bold text-stone-800">La tua routine</p>
                  <p className="text-sm text-stone-400">Selezionata su misura per te</p>
                </div>
              </div>

              <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl px-5 py-4 text-center">
                <p className="text-sm font-semibold text-emerald-800">Il tuo rituale in 3 passi</p>
                <p className="text-xs text-emerald-600 mt-1">Prodotti selezionati in base al tuo profilo capelli</p>
              </div>

              <div className="space-y-4">
                {stepsRoutine.map((s, i) => (
                  <div key={i} className="bg-white rounded-2xl border-2 border-stone-200 overflow-hidden">
                    <div className="flex items-center gap-3 px-4 py-3 bg-stone-50 border-b border-stone-100">
                      <span className="text-xl">{s.emoji}</span>
                      <div>
                        <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider">{s.label}</p>
                        <p className="text-xs text-stone-400">{s.subLabel}</p>
                      </div>
                    </div>
                    <div className="px-4 py-4">
                      {s.prodotto ? (
                        <div className="flex items-start gap-3">
                          {s.prodotto.foto_url ? (
                            <button
                              onClick={() => setLightboxUrl(s.prodotto!.foto_url)}
                              className="flex-shrink-0 rounded-xl overflow-hidden border border-stone-100 focus:outline-none"
                              title="Tocca per ingrandire"
                              style={{ transition: 'transform 0.2s ease' }}
                              onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.06)')}
                              onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
                            >
                              <img src={s.prodotto.foto_url} alt={s.prodotto.nome} className="w-14 h-14 object-cover cursor-zoom-in" />
                            </button>
                          ) : (
                            <div className="w-14 h-14 bg-emerald-50 rounded-xl flex items-center justify-center flex-shrink-0">
                              <span className="text-2xl">{s.emoji}</span>
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-stone-800 text-sm leading-tight">{s.prodotto.nome}</p>
                            {s.prodotto.marca && <p className="text-xs text-stone-400 mt-0.5">{s.prodotto.marca}</p>}
                            {s.prodotto.note && <p className="text-xs text-stone-500 mt-1 leading-relaxed line-clamp-2">{s.prodotto.note}</p>}
                            {(s.prodotto.quiz_tags ?? []).filter(t => quizRisposte.includes(t)).length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {(s.prodotto.quiz_tags ?? []).filter(t => quizRisposte.includes(t)).map(t => (
                                  <span key={t} className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700">{t.replace(/_/g, ' ')}</span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3 py-1">
                          <div className="w-10 h-10 bg-stone-100 rounded-xl flex items-center justify-center flex-shrink-0">
                            <span className="text-lg">🔍</span>
                          </div>
                          <p className="text-sm text-stone-400 italic">Nessun prodotto disponibile per questa categoria.</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Brand copy finale */}
              <div className="bg-stone-900 rounded-2xl px-5 py-5 space-y-4">
                <p className="text-sm text-stone-300 leading-relaxed text-center">
                  ✨ I tuoi capelli hanno parlato: questi sono i prodotti del nostro Brand che più si avvicinano alle tue esigenze.
                  Il sistema ha individuato la combinazione ideale in base alle tue risposte, ma la Hair Care è una consulenza su misura. Trattandosi di formule professionali ad alta concentrazione, per darti la certezza assoluta abbiamo bisogno di guardare e toccare con mano le tue lunghezze e la tua cute. Passa a trovarci per una consulenza approfondita in salone: confermeremo insieme questa selezione e la personalizzeremo per garantirti un risultato impeccabile. Metti la tua bellezza in mani sicure.
                </p>

                {/* Prenota */}
                <button
                  onClick={() => setStep('parrucchiere')}
                  className="w-full py-3.5 rounded-xl font-bold text-sm bg-amber-500 text-white hover:bg-amber-400 transition-all"
                >
                  Prenota la tua consulenza o il tuo servizio
                </button>

                {/* Salva Mappa di Bellezza */}
                <div>
                  <button
                    onClick={() => salvaMappaBellezza(routineRisultato, quizRisposte)}
                    disabled={salvandoMappa || mappaSalvata}
                    className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold text-sm transition-all border ${
                      mappaSalvata
                        ? 'bg-emerald-600 border-emerald-600 text-white cursor-default'
                        : 'bg-transparent border-stone-600 text-stone-300 hover:border-stone-400 hover:text-white disabled:opacity-60'
                    }`}
                  >
                    {salvandoMappa ? (
                      <><div className="w-4 h-4 border-2 border-stone-400 border-t-transparent rounded-full animate-spin" /> Salvataggio...</>
                    ) : mappaSalvata ? (
                      <>✓ Salvato nel tuo Diario di Bellezza!</>
                    ) : (
                      <>Salva nel mio Diario di Bellezza</>
                    )}
                  </button>
                  {mappaSalvata && (
                    <p className="text-xs text-emerald-400 text-center mt-2">
                      Troverai sempre questa mappa nella tua Area Personale. Mostrala alla tua Stylist durante il prossimo appuntamento in salone!
                    </p>
                  )}
                </div>
              </div>

              <button
                onClick={() => { setQuizStep(0); setQuizRisposte([]); setMappaSalvata(false); setStep('quiz_capelli'); }}
                className="w-full py-3 text-sm text-stone-400 hover:text-stone-600 underline transition-colors"
              >
                Indietro — Rifai il quiz
              </button>
            </div>
          );
        })()}

        {/* STEP: I nostri prodotti */}
        {step === 'nostri_prodotti' && (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <button onClick={() => setStep('scelta')} className="w-9 h-9 flex items-center justify-center rounded-xl border border-stone-200 text-stone-500 hover:bg-stone-100 transition-colors flex-shrink-0">
                <ChevronLeft size={18} />
              </button>
              <div>
                <p className="text-xl font-bold text-stone-800">I Nostri Prodotti</p>
                <p className="text-sm text-stone-400">Catalogo e routine personalizzata</p>
              </div>
            </div>

            {/* ── SEZIONE A: 3 PULSANTI CATALOGO PREMIUM ── */}
            {loadingNostralProdotti ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-2 border-stone-300 border-t-stone-700 rounded-full animate-spin" />
              </div>
            ) : nostralProdottiError ? (
              <div className="bg-red-50 border border-red-200 rounded-2xl px-5 py-4 text-center">
                <p className="text-sm text-red-600 mb-3">{nostralProdottiError}</p>
                <button onClick={loadNovstralProdotti} className="text-sm font-semibold text-red-700 underline">Riprova</button>
              </div>
            ) : (
              <div className="space-y-3">
                {([
                  {
                    key: 'shampoo' as const,
                    titolo: 'I Nostri Shampoo',
                    sottotitolo: 'Come detergere la cute e i capelli al meglio, rispettando il loro equilibrio naturale.',
                    icona: '🚿',
                    accent: 'from-sky-50 to-blue-50',
                    border: 'border-sky-200',
                    badgeColor: 'bg-sky-100 text-sky-700',
                    stepLabel: 'Step 1 — Detergi',
                  },
                  {
                    key: 'maschera' as const,
                    titolo: 'Le Nostre Maschere',
                    sottotitolo: 'Come nutrire profondamente la chioma, riparando le lunghezze e donando morbidezza.',
                    icona: '💚',
                    accent: 'from-emerald-50 to-teal-50',
                    border: 'border-emerald-200',
                    badgeColor: 'bg-emerald-100 text-emerald-700',
                    stepLabel: 'Step 2 — Nutri',
                  },
                  {
                    key: 'finish' as const,
                    titolo: 'I Nostri Finish',
                    sottotitolo: 'Come esaltare la bellezza, proteggere dal calore e proteggere lo styling quotidiano.',
                    icona: '✨',
                    accent: 'from-amber-50 to-yellow-50',
                    border: 'border-amber-200',
                    badgeColor: 'bg-amber-100 text-amber-700',
                    stepLabel: 'Step 3 — Illumina',
                  },
                ] as const).map(cat => {
                  const prodottiCat = nostralProdotti.filter(p => getMacroGruppo(p.categoria) === cat.key);
                  const aperto = categoriaAperta === cat.key;
                  return (
                    <div key={cat.key} className={`rounded-2xl border overflow-hidden transition-all duration-300 ${cat.border} ${aperto ? `bg-gradient-to-br ${cat.accent}` : 'bg-white'}`}>
                      {/* Pulsante intestazione */}
                      <button
                        onClick={() => { setCategoriaAperta(aperto ? null : cat.key); }}
                        className="w-full flex items-center gap-4 px-5 py-5 text-left group"
                      >
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 bg-gradient-to-br ${cat.accent} border ${cat.border} shadow-sm group-active:scale-95 transition-transform`}>
                          {cat.icona}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-bold text-stone-800 text-base leading-tight">{cat.titolo}</p>
                            {prodottiCat.length > 0 && (
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${cat.badgeColor}`}>
                                {prodottiCat.length}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-stone-500 mt-1 leading-relaxed pr-4">{cat.sottotitolo}</p>
                        </div>
                        <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center border transition-all ${aperto ? `${cat.border} bg-white` : 'border-stone-200 bg-stone-50'}`}>
                          <ChevronDown size={14} className={`text-stone-500 transition-transform duration-300 ${aperto ? 'rotate-180' : ''}`} />
                        </div>
                      </button>

                      {/* Accordion espandibile */}
                      {aperto && (
                        <div className="border-t border-stone-100 divide-y divide-stone-100">
                          {prodottiCat.length === 0 ? (
                            <div className="px-5 py-6 text-center">
                              <p className="text-sm text-stone-400 italic">Nessun prodotto disponibile in questa categoria.</p>
                            </div>
                          ) : (
                            prodottiCat.map(p => (
                              <div key={p.id} className="flex items-center gap-4 px-5 py-4 bg-white/70 backdrop-blur-sm">
                                {/* Thumbnail cliccabile */}
                                {p.foto_url ? (
                                  <button
                                    onClick={() => setLightboxUrl(p.foto_url)}
                                    className="flex-shrink-0 rounded-xl overflow-hidden border border-stone-200 shadow-sm focus:outline-none"
                                    title="Tocca per ingrandire"
                                    style={{ transition: 'transform 0.2s ease' }}
                                    onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.03)')}
                                    onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
                                  >
                                    <img src={p.foto_url} alt={p.nome} className="w-14 h-14 object-cover cursor-zoom-in" />
                                  </button>
                                ) : (
                                  <div className={`w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 bg-gradient-to-br ${cat.accent} border ${cat.border} text-2xl`}>
                                    {cat.icona}
                                  </div>
                                )}
                                {/* Nome prodotto cliccabile per lightbox se ha foto */}
                                <div className="flex-1 min-w-0">
                                  {p.foto_url ? (
                                    <button
                                      onClick={() => setLightboxUrl(p.foto_url)}
                                      className="text-left focus:outline-none group/nome"
                                    >
                                      <p className="font-semibold text-stone-800 text-sm leading-tight group-hover/nome:text-stone-600 transition-colors">{p.nome}</p>
                                    </button>
                                  ) : (
                                    <p className="font-semibold text-stone-800 text-sm leading-tight">{p.nome}</p>
                                  )}
                                  {p.marca && <p className="text-xs text-stone-400 mt-0.5">{p.marca}</p>}
                                  {p.note && <p className="text-xs text-stone-500 mt-1 leading-relaxed line-clamp-2">{p.note}</p>}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── SEZIONE B: HAIR QUIZ ── */}
            <div className="border-t border-stone-100 pt-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-6 h-6 bg-amber-100 rounded-md flex items-center justify-center">
                  <Star size={13} className="text-amber-600" />
                </div>
                <p className="text-sm font-bold text-stone-700 uppercase tracking-wide">Hair Quiz</p>
              </div>

              {mappaBellezza && (mappaBellezza.shampoo || mappaBellezza.maschera || mappaBellezza.finish) ? (
                <div className="bg-gradient-to-br from-stone-900 to-stone-800 rounded-2xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-stone-700">
                    <p className="text-sm font-bold text-white">Il tuo Diario di Bellezza</p>
                    <p className="text-xs text-stone-400 mt-0.5">La tua routine personalizzata salvata</p>
                  </div>
                  <div className="divide-y divide-stone-700">
                    {[
                      { label: 'STEP 1 — Detergi', emoji: '🚿', p: mappaBellezza.shampoo },
                      { label: 'STEP 2 — Nutri', emoji: '💚', p: mappaBellezza.maschera },
                      { label: 'STEP 3 — Illumina', emoji: '✨', p: mappaBellezza.finish },
                    ].filter(s => s.p).map((s, i) => (
                      <div key={i} className="flex items-center gap-3 px-4 py-3">
                        {s.p!.foto_url ? (
                          <button onClick={() => setLightboxUrl(s.p!.foto_url)} className="flex-shrink-0 focus:outline-none" style={{ transition: 'transform 0.2s' }} onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.03)')} onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}>
                            <img src={s.p!.foto_url} alt={s.p!.nome} className="w-10 h-10 rounded-lg object-cover" />
                          </button>
                        ) : (
                          <span className="text-lg flex-shrink-0">{s.emoji}</span>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">{s.label}</p>
                          <p className="text-sm font-semibold text-white leading-tight truncate">{s.p!.nome}</p>
                          {s.p!.marca && <p className="text-xs text-stone-400">{s.p!.marca}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="px-5 py-4">
                    <button
                      onClick={() => { loadNovstralProdotti(); setQuizStep(0); setQuizRisposte([]); setMappaSalvata(false); setStep('quiz_capelli'); }}
                      className="w-full py-3 rounded-xl text-sm font-semibold text-white bg-amber-500 hover:bg-amber-400 transition-colors"
                    >
                      Aggiorna la mia Mappa
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-gradient-to-br from-stone-900 to-stone-800 rounded-2xl px-5 py-6 text-center space-y-4">
                  <div className="w-14 h-14 bg-amber-500/20 rounded-2xl flex items-center justify-center mx-auto text-2xl">💆</div>
                  <div>
                    <p className="font-bold text-white text-base">Scopri la tua routine Hair Care</p>
                    <p className="text-sm text-stone-400 mt-1">8 domande per una routine professionale su misura</p>
                  </div>
                  <button
                    onClick={() => { loadNovstralProdotti(); setQuizStep(0); setQuizRisposte([]); setMappaSalvata(false); setStep('quiz_capelli'); }}
                    className="w-full py-3.5 rounded-xl text-sm font-bold text-white bg-amber-500 hover:bg-amber-400 transition-colors"
                  >
                    Inizia il Quiz Capelli — è gratis
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP: Contatti */}
        {step === 'contatti' && (
          <div className="space-y-5">
            <div className="flex items-center gap-3 mb-2">
              <button onClick={() => setStep('scelta')} className="w-9 h-9 flex items-center justify-center rounded-xl border border-stone-200 text-stone-500 hover:bg-stone-100 transition-colors flex-shrink-0">
                <ChevronLeft size={18} />
              </button>
              <div>
                <p className="text-xl font-bold text-stone-800">Contatti</p>
                <p className="text-sm text-stone-400 mt-0.5">{info.nomeSalone}</p>
              </div>
            </div>

            <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden divide-y divide-stone-100">
              {info.contatti?.indirizzo && (
                <div className="flex items-start gap-4 px-6 py-4">
                  <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <MapPin size={18} className="text-teal-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-0.5">Indirizzo</p>
                    <p className="text-sm text-stone-800 leading-snug">{info.contatti.indirizzo}</p>
                    {info.contatti.googleMaps && (
                      <a href={info.contatti.googleMaps} target="_blank" rel="noopener noreferrer"
                        className="mt-1.5 inline-flex items-center gap-1 text-xs text-teal-600 font-semibold hover:text-teal-700 transition-colors">
                        <ExternalLink size={11} />
                        Apri in Google Maps
                      </a>
                    )}
                  </div>
                </div>
              )}

              {info.contatti?.telefono && (
                <a href={`tel:${info.contatti.telefono.replace(/\s/g, '')}`}
                  className="flex items-center gap-4 px-6 py-4 hover:bg-stone-50 transition-colors group">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0 group-hover:bg-emerald-100 transition-colors">
                    <Phone size={18} className="text-emerald-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-0.5">Telefono</p>
                    <p className="text-sm font-semibold text-stone-800">{info.contatti.telefono}</p>
                  </div>
                  <ExternalLink size={14} className="text-stone-300 group-hover:text-emerald-500 transition-colors flex-shrink-0" />
                </a>
              )}

              {info.contatti?.email && (
                <a href={`mailto:${info.contatti.email}`}
                  className="flex items-center gap-4 px-6 py-4 hover:bg-stone-50 transition-colors group">
                  <div className="w-10 h-10 rounded-xl bg-sky-50 flex items-center justify-center flex-shrink-0 group-hover:bg-sky-100 transition-colors">
                    <Mail size={18} className="text-sky-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-0.5">Email</p>
                    <p className="text-sm font-semibold text-stone-800 truncate">{info.contatti.email}</p>
                  </div>
                  <ExternalLink size={14} className="text-stone-300 group-hover:text-sky-500 transition-colors flex-shrink-0" />
                </a>
              )}

              {info.contatti?.pec && (
                <a href={`mailto:${info.contatti.pec}`}
                  className="flex items-center gap-4 px-6 py-4 hover:bg-stone-50 transition-colors group">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
                    <FileText size={18} className="text-indigo-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-0.5">PEC</p>
                    <p className="text-sm font-semibold text-stone-800 truncate">{info.contatti.pec}</p>
                  </div>
                  <ExternalLink size={14} className="text-stone-300 flex-shrink-0" />
                </a>
              )}

              {info.contatti?.sitoWeb && (
                <a href={info.contatti.sitoWeb} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-4 px-6 py-4 hover:bg-stone-50 transition-colors group">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0 group-hover:bg-amber-100 transition-colors">
                    <Globe size={18} className="text-amber-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-0.5">Sito web</p>
                    <p className="text-sm font-semibold text-stone-800 truncate">{info.contatti.sitoWeb}</p>
                  </div>
                  <ExternalLink size={14} className="text-stone-300 group-hover:text-amber-500 transition-colors flex-shrink-0" />
                </a>
              )}
            </div>

            {info.contatti?.orariJson && (() => {
              const GIORNI_LABEL = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];
              let orari: { aperto: boolean; apertura: string; chiusura: string; pausa_inizio: string; pausa_fine: string; pausa_attiva: boolean }[] = [];
              try { orari = JSON.parse(info.contatti!.orariJson!); } catch { return null; }
              if (!orari.length) return null;
              const dowJs = new Date().getDay();
              const idxOggi = dowJs === 0 ? 6 : dowJs - 1;
              return (
                <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
                  <div className="flex items-center gap-3 px-5 py-4 border-b border-stone-100">
                    <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
                      <Clock size={18} className="text-amber-500" />
                    </div>
                    <p className="font-semibold text-stone-800 text-sm">Orari di apertura</p>
                  </div>
                  <div className="divide-y divide-stone-50">
                    {orari.map((g, i) => {
                      const isOggi = i === idxOggi;
                      return (
                        <div key={i} className={`flex items-center justify-between px-5 py-3 ${isOggi ? 'bg-amber-50/60' : ''}`}>
                          <div className="flex items-center gap-2">
                            {isOggi && <div className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />}
                            <p className={`text-sm ${isOggi ? 'font-bold text-stone-800' : 'font-medium text-stone-600'}`}>{GIORNI_LABEL[i]}</p>
                          </div>
                          {g.aperto ? (
                            <div className="text-right">
                              <p className={`text-sm ${isOggi ? 'font-bold text-amber-700' : 'text-stone-600'}`}>{g.apertura} – {g.chiusura}</p>
                              {g.pausa_attiva && <p className="text-xs text-stone-400">pausa {g.pausa_inizio}–{g.pausa_fine}</p>}
                            </div>
                          ) : (
                            <p className="text-sm text-stone-400 italic">Chiuso</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {info.contatti!.orariNota && (
                    <div className="px-5 py-3 border-t border-stone-100 bg-stone-50/50">
                      <p className="text-xs text-stone-500 italic leading-relaxed">{info.contatti!.orariNota}</p>
                    </div>
                  )}
                </div>
              );
            })()}

            {info.contatti?.note && (
              <div className="bg-stone-50 border border-stone-200 rounded-2xl px-5 py-4">
                <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-1.5">Note</p>
                <p className="text-sm text-stone-600 leading-relaxed whitespace-pre-line">{info.contatti.note}</p>
              </div>
            )}

            {(!info.contatti?.telefono && !info.contatti?.email && !info.contatti?.indirizzo && !info.contatti?.sitoWeb) && (
              <div className="text-center py-8 text-stone-400">
                <MapPin size={28} className="mx-auto mb-2 opacity-40" />
                <p className="text-sm">Nessun contatto disponibile al momento.</p>
              </div>
            )}

            <SocialStrip social={info?.social} />
          </div>
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
              <button
                onClick={() => setStep('scelta')}
                className="px-8 py-3 bg-stone-100 text-stone-500 font-medium rounded-2xl hover:bg-stone-200 transition-colors flex items-center justify-center gap-2"
              >
                <ChevronLeft size={16} />
                Torna alla home
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
  const saldoEsaurito = carta.saldo <= 0;

  const movimenti = [
    ...carta.ricariche.map(r => ({ ...r, tipo: 'ricarica' as const, importo: r.importo })),
    ...carta.utilizzi.map(u => ({ ...u, tipo: 'utilizzo' as const, importo: u.importo_detratto })),
  ].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  return (
    <div className="space-y-3">
      {/* Card grafica premium */}
      <div
        className="relative w-full rounded-3xl overflow-hidden shadow-xl"
        style={{
          background: saldoEsaurito
            ? 'linear-gradient(135deg, #3d0000 0%, #6b0f0f 25%, #4a0808 50%, #7a1010 75%, #2d0000 100%)'
            : 'linear-gradient(135deg, #111008 0%, #2a2000 25%, #1a1500 50%, #2d2200 75%, #0d0a00 100%)',
          minHeight: 210,
        }}
      >
        {/* Striscia in alto */}
        <div className="absolute top-0 left-0 right-0 h-1" style={{
          background: saldoEsaurito
            ? 'linear-gradient(90deg, #8b0000, #e05252, #c0392b, #e05252, #8b0000)'
            : 'linear-gradient(90deg, #b8860b, #f5e17a, #d4af37, #f5e17a, #b8860b)',
        }} />
        {/* Pattern decorativo diagonale */}
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: saldoEsaurito
            ? 'repeating-linear-gradient(45deg, #c0392b 0px, #c0392b 1px, transparent 0px, transparent 28px)'
            : 'repeating-linear-gradient(45deg, #d4af37 0px, #d4af37 1px, transparent 0px, transparent 28px)',
          backgroundSize: '28px 28px',
        }} />
        {/* Alone grande in alto a destra */}
        <div className="absolute -right-6 -top-6 w-52 h-52 rounded-full" style={{
          background: saldoEsaurito
            ? 'radial-gradient(circle, rgba(192,57,43,0.35) 0%, transparent 70%)'
            : 'radial-gradient(circle, rgba(212,175,55,0.35) 0%, transparent 70%)',
        }} />
        {/* Alone piccolo in basso a sinistra */}
        <div className="absolute -left-4 -bottom-4 w-32 h-32 rounded-full" style={{
          background: saldoEsaurito
            ? 'radial-gradient(circle, rgba(192,57,43,0.2) 0%, transparent 70%)'
            : 'radial-gradient(circle, rgba(212,175,55,0.2) 0%, transparent 70%)',
        }} />

        <div className="relative p-6 flex flex-col h-full" style={{ minHeight: 210 }}>
          {/* Header */}
          <div className="flex items-start justify-between mb-auto">
            <div>
              <p className="text-xs font-bold tracking-[0.25em] uppercase" style={{
                color: saldoEsaurito ? '#f9a8a8' : '#f5e17a',
                textShadow: saldoEsaurito ? '0 0 8px rgba(192,57,43,0.6)' : '0 0 8px rgba(212,175,55,0.6)',
              }}>Carta Premium</p>
            </div>
            {/* Chip */}
            <div className="w-12 h-9 rounded-lg flex items-center justify-center" style={{
              background: saldoEsaurito
                ? 'linear-gradient(135deg, #8b1a1a 0%, #e05252 40%, #c0392b 60%, #7a0c0c 100%)'
                : 'linear-gradient(135deg, #b8860b 0%, #f5e17a 40%, #d4af37 60%, #8b6914 100%)',
              boxShadow: '0 2px 6px rgba(0,0,0,0.5)',
            }}>
              <div className="w-7 h-5 rounded-sm border" style={{
                borderColor: saldoEsaurito ? 'rgba(139,26,26,0.6)' : 'rgba(139,105,20,0.6)',
                background: saldoEsaurito
                  ? 'linear-gradient(135deg, #c0392b 0%, #e05252 50%, #8b1a1a 100%)'
                  : 'linear-gradient(135deg, #d4af37 0%, #f5e17a 50%, #b8860b 100%)',
              }} />
            </div>
          </div>

          {/* Dati cliente */}
          <div className="mt-8 mb-4">
            <p className="text-white font-bold text-lg tracking-wide" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>
              {cliente ? `${cliente.nome} ${cliente.cognome}` : '—'}
            </p>
            <p className="text-xs mt-1 font-mono tracking-[0.15em]" style={{ color: saldoEsaurito ? '#f9a8a8' : '#f5e17a' }}>
              {carta.codice}
            </p>
          </div>

          {/* Saldo */}
          <div className="flex items-end justify-between">
            <div>
              <p className="text-xs font-medium" style={{ color: saldoEsaurito ? 'rgba(249,168,168,0.7)' : 'rgba(245,225,122,0.7)' }}>Saldo disponibile</p>
              <p className="text-3xl font-bold" style={{
                color: saldoEsaurito ? '#f9a8a8' : '#f5e17a',
                textShadow: saldoEsaurito ? '0 0 12px rgba(192,57,43,0.5)' : '0 0 12px rgba(212,175,55,0.5)',
              }}>€ {carta.saldo.toFixed(2)}</p>
            </div>
            {saldoEsaurito && (
              <div className="text-xs font-semibold px-3 py-1 rounded-full" style={{ color: '#f9a8a8', background: 'rgba(192,57,43,0.25)', border: '1px solid rgba(192,57,43,0.4)' }}>
                Credito esaurito
              </div>
            )}
          </div>
        </div>
        {/* Striscia in basso */}
        <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{
          background: saldoEsaurito
            ? 'linear-gradient(90deg, transparent, #c0392b, #e05252, #c0392b, transparent)'
            : 'linear-gradient(90deg, transparent, #d4af37, #f5e17a, #d4af37, transparent)',
        }} />
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
  const includiMappa = salone['wa_includi_mappa'] === 'true';

  const scontoDesc = carta.tipo_sconto === 'percentuale'
    ? `${carta.valore_sconto}%`
    : `€ ${carta.valore_sconto?.toFixed(2)}`;

  const tplCs = salone['wa_template_cs_dona'] || DEFAULT_WA_CS_DONA;
  const msgBase = (() => {
    let msg = applyWaTemplate(tplCs, {
      nome_salone: nomeSalone,
      codice: carta.codice,
      telefono,
      sito,
      sconto: scontoDesc,
      valore: '',
      destinataria: '',
      donante: '',
    });
    if (includiMappa && maps) msg = msg.trimEnd() + `\n\n${maps}`;
    return msg;
  })();

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
    ? `${gp.prodotto_nome ?? 'Prodotto omaggio'}`
    : `€${gp.valore ?? 0}`;

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
  const includiMappaGp = salone['wa_includi_mappa'] === 'true';
  const tplGpCliente = salone['wa_template_gp_cliente'] || DEFAULT_WA_GP_CLIENTE;

  const msgBase = (() => {
    let msg = applyWaTemplate(tplGpCliente, {
      nome_salone: nomeSalone || 'il salone',
      codice: gp.codice,
      telefono,
      sito,
      valore: String(gp.valore ?? 0),
      sconto: '',
      destinataria: '',
      donante: compratore_nome || '',
    });
    if (includiMappaGp && maps) msg = msg.trimEnd() + `\n\n${maps}`;
    return msg;
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

const SOCIAL_META: Array<{
  key: string;
  label: string;
  bg: string;
  icon: JSX.Element;
}> = [
  {
    key: 'social_instagram',
    label: 'Instagram',
    bg: 'linear-gradient(135deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)',
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="white">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
      </svg>
    ),
  },
  {
    key: 'social_facebook',
    label: 'Facebook',
    bg: '#1877f2',
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="white">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
      </svg>
    ),
  },
  {
    key: 'social_tiktok',
    label: 'TikTok',
    bg: '#010101',
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="white">
        <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.27 8.27 0 004.83 1.55V6.79a4.85 4.85 0 01-1.06-.1z"/>
      </svg>
    ),
  },
  {
    key: 'social_youtube',
    label: 'YouTube',
    bg: '#ff0000',
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="white">
        <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
      </svg>
    ),
  },
  {
    key: 'social_whatsapp',
    label: 'WhatsApp',
    bg: '#25d366',
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="white">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
      </svg>
    ),
  },
  {
    key: 'social_x',
    label: 'X',
    bg: '#000000',
    icon: (
      <svg viewBox="0 0 24 24" width="16" height="16" fill="white">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.26 5.632zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
      </svg>
    ),
  },
  {
    key: 'social_threads',
    label: 'Threads',
    bg: '#101010',
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="white">
        <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.964-.065-1.19.408-2.285 1.33-3.082.88-.76 2.119-1.207 3.583-1.291a13.853 13.853 0 013.02.142c-.126-.742-.375-1.332-.75-1.757-.513-.586-1.308-.883-2.359-.89h-.029c-.844 0-1.992.232-2.721 1.32L7.734 7.847c.98-1.454 2.568-2.256 4.478-2.256h.044c3.194.02 5.097 1.975 5.287 5.388.108.005.216.01.321.016 1.49.09 2.759.55 3.75 1.35 1.143.914 1.788 2.22 1.868 3.743.143 2.714-.822 5.196-2.713 6.98C19.033 23.29 16.507 24 12.186 24z"/>
      </svg>
    ),
  },
  {
    key: 'social_google_business',
    label: 'Google',
    bg: 'linear-gradient(135deg, #4285f4, #34a853, #fbbc05, #ea4335)',
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="white">
        <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"/>
      </svg>
    ),
  },
  {
    key: 'social_tripadvisor',
    label: 'TripAdvisor',
    bg: '#34e0a1',
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="white">
        <path d="M12 1C5.925 1 1 5.925 1 12s4.925 11 11 11 11-4.925 11-11S18.075 1 12 1zm0 3.5c1.8 0 3.46.56 4.82 1.5H7.18C8.54 5.06 10.2 4.5 12 4.5zm-6.5 4h13a6.5 6.5 0 010 13 6.5 6.5 0 010-13zm0 2a4.5 4.5 0 100 9 4.5 4.5 0 000-9zm13 0a4.5 4.5 0 100 9 4.5 4.5 0 000-9zm-13 1.5a3 3 0 110 6 3 3 0 010-6zm13 0a3 3 0 110 6 3 3 0 010-6zm-13 1a2 2 0 100 4 2 2 0 000-4zm13 0a2 2 0 100 4 2 2 0 000-4z"/>
      </svg>
    ),
  },
  {
    key: 'social_altro',
    label: 'Link',
    bg: '#6b7280',
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/>
        <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
      </svg>
    ),
  },
];

function buildSocialHref(key: string, value: string): string {
  if (key === 'social_whatsapp') {
    if (value.startsWith('http://') || value.startsWith('https://') || value.startsWith('wa.me')) {
      return value;
    }
    // Plain number: strip non-digits (except leading +)
    const digits = value.replace(/[^\d+]/g, '').replace(/^\+/, '');
    return `https://wa.me/${digits}`;
  }
  return value;
}

function SocialStrip({ social }: { social?: Record<string, string> }) {
  if (!social) return null;
  const attivi = SOCIAL_META.filter(s => social[s.key]);
  if (attivi.length === 0) return null;

  return (
    <div className="mt-2 pt-4 border-t border-stone-100">
      <p className="text-xs text-stone-400 text-center mb-3 uppercase tracking-wider font-medium">Seguici</p>
      <div className="flex items-center justify-center gap-3 flex-wrap">
        {attivi.map(s => (
          <a
            key={s.key}
            href={buildSocialHref(s.key, social[s.key])}
            target="_blank"
            rel="noopener noreferrer"
            title={s.label}
            className="w-11 h-11 rounded-2xl flex items-center justify-center shadow-sm hover:scale-110 active:scale-95 transition-transform"
            style={{ background: s.bg, opacity: 0.88 }}
          >
            {s.icon}
          </a>
        ))}
      </div>
    </div>
  );
}

function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full py-3 text-stone-400 text-sm font-medium flex items-center justify-center gap-1 hover:text-stone-600 transition-colors mt-1">
      <ChevronLeft size={15} /> Indietro
    </button>
  );
}


