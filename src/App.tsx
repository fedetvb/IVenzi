import { useState, useEffect, useRef } from 'react';
import LicenseWall from './components/LicenseWall';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Agenda from './pages/Agenda';
import Clienti from './pages/Clienti';
import SchedaCliente from './pages/SchedaCliente';
import Servizi from './pages/Servizi';
import Fiches from './pages/Fiches';
import Carte from './pages/Carte';
import Rivendita from './pages/Rivendita';
import Finanze from './pages/Finanze';
import GestioneFinanziaria from './pages/GestioneFinanziaria';
import Statistiche from './pages/Statistiche';
import Comunicazioni from './pages/Comunicazioni';
import Impostazioni from './pages/Impostazioni';
import Magazzino from './pages/Magazzino';
import Parrucchieri from './pages/Parrucchieri';
import Cestino from './pages/Cestino';
import Guida from './pages/Guida';
import ProdottiOnline from './pages/ProdottiOnline';
import StatisticheGate from './components/StatisticheGate';
import BirthdayModal from './components/BirthdayModal';
import Login from './pages/Login';
import ResetPassword from './pages/ResetPassword';
import { fetchFinanzeReportData, generateFinanzeReportPdf } from './lib/finanzeReportPdfGenerator';
import type { FinanzePeriodo } from './electron.d';
import { supabase } from './lib/supabase';
import { useAuth } from './lib/AuthContext';
import { Bell, X, MessageSquare, Scissors, Wifi, ClipboardList, CalendarClock, BellRing, Star, Gift, HelpCircle } from 'lucide-react';
import { isPushSupported, getPushPermission, requestPushPermission, subscribePush } from './lib/webPush';
import RecensioniReminderModal from './components/RecensioniReminderModal';
import AiChat from './components/AiChat';
import { InForseModal, loadAvvisoInForse, type ClienteInForseEntry } from './components/InForseModal';
import { isElectron, setCurrentUserId, registerPushRowNow, setElectronDbReady, getImpostazione, setImpostazione, registerBrowserLocalOps } from './lib/localDb';
import { isOwnerBuild, getLicenseState } from './lib/license';
import { syncLocalToRemote, syncRemoteToLocal, pushRowNow, browserLocalWrite, browserLocalDelete, prefetchToIndexedDb } from './lib/sync';
import { markAllRowsDirty, getTableCache } from './lib/indexedDb';
import { flushPendingSync } from './lib/offlineFetch';

// Registra il push immediato e le operazioni locali browser una volta sola
registerPushRowNow(pushRowNow);
registerBrowserLocalOps(browserLocalWrite, browserLocalDelete);

type Page = 'dashboard' | 'agenda' | 'clienti' | 'servizi' | 'fiches' | 'finanze' | 'gestione_finanziaria' | 'statistiche' | 'comunicazioni' | 'impostazioni' | 'carte' | 'rivendita' | 'magazzino' | 'parrucchieri' | 'cestino' | 'guida' | 'prodotti_online';

interface ClienteCompleanno {
  id: string;
  nome: string;
  cognome: string;
  telefono: string | null;
}

interface HistoryEntry {
  page: Page;
  selectedCliente: string | null;
  selectedClienteTab?: 'info' | 'colore' | 'appuntamenti' | 'storico' | 'carte' | 'messaggi';
}

export default function App() {
  const { user, loading, isOfflineSession } = useAuth();
  const [page, setPage] = useState<Page>('dashboard');
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [selectedCliente, setSelectedCliente] = useState<string | null>(null);
  const [selectedClienteTab, setSelectedClienteTab] = useState<'info' | 'colore' | 'appuntamenti' | 'storico' | 'carte' | 'messaggi' | undefined>(undefined);
  const [agendaSelectedDay, setAgendaSelectedDay] = useState<Date | null>(null);
  const pageHistoryRef = useRef<HistoryEntry[]>([]);

  function handleSetAgendaDay(d: Date | null) {
    setAgendaSelectedDay(d);
  }

  // Quando si naviga su agenda, azzera il giorno se non è oggi
  function navigateTo(p: Page) {
    if (p === 'agenda' && agendaSelectedDay) {
      const today = new Date();
      const isToday =
        agendaSelectedDay.getFullYear() === today.getFullYear() &&
        agendaSelectedDay.getMonth() === today.getMonth() &&
        agendaSelectedDay.getDate() === today.getDate();
      if (!isToday) setAgendaSelectedDay(null);
    }
    // Salva lo stato corrente nella history prima di navigare
    pageHistoryRef.current = [...pageHistoryRef.current, { page, selectedCliente }];
    history.pushState({ appNav: true }, '');
    setPage(p);
    if (p !== 'clienti') setSelectedCliente(null);
  }

  // Intercetta il tasto indietro del dispositivo/browser nella PWA
  useEffect(() => {
    // Aggiunge una voce iniziale alla history del browser all'avvio
    history.pushState({ appNav: true }, '');

    function handlePopState() {
      const prev = pageHistoryRef.current;
      if (prev.length > 0) {
        const last = prev[prev.length - 1];
        pageHistoryRef.current = prev.slice(0, -1);
        setPage(last.page);
        setSelectedCliente(last.selectedCliente);
        setSelectedClienteTab(last.selectedClienteTab);
        // Rimette una voce in history per intercettare il prossimo back
        history.pushState({ appNav: true }, '');
      } else {
        // Nessuna history interna: torna alla dashboard
        setPage('dashboard');
        setSelectedCliente(null);
        history.pushState({ appNav: true }, '');
      }
    }

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Banner promemoria fiches (orario configurato)
  const [showReminderBanner, setShowReminderBanner] = useState(false);

  // Banner promemoria invio messaggi appuntamento (all'avvio)
  const [showAppBanner, setShowAppBanner] = useState(false);

  // Modal promemoria recensioni Google
  const [showRecensioniModal, setShowRecensioniModal] = useState(false);
  // Banner sottile promemoria recensioni (alternativo al modal)
  const [showRecensioniBannerSottile, setShowRecensioniBannerSottile] = useState(false);

  // Banner appuntamenti in forse
  const [showInForseBanner, setShowInForseBanner] = useState(false);
  const [inForseCount, setInForseCount] = useState(0);
  const [inForseNome, setInForseNome] = useState('');
  const [showInForseModal, setShowInForseModal] = useState(false);
  const [inForseModalClienti, setInForseModalClienti] = useState<ClienteInForseEntry[]>([]);

  // Modal compleanni
  const [birthdayClienti, setBirthdayClienti] = useState<ClienteCompleanno[]>([]);
  const [showBirthdayModal, setShowBirthdayModal] = useState(false);

  // Banner nuova scheda cliente da confermare
  const [showNuovaSchedaBanner, setShowNuovaSchedaBanner] = useState(false);
  const [nuovaSchedaNome, setNuovaSchedaNome] = useState('');
  const [nuovaSchedaCurrentId, setNuovaSchedaCurrentId] = useState<string | null>(null);
  const [nuovaSchedaFoto, setNuovaSchedaFoto] = useState<string | null>(null);
  const [schedaIdToOpen, setSchedaIdToOpen] = useState<string | null>(null);
  const [schedeBannersVisteSet, setSchedeBannersVisteSet] = useState<Set<string>>(new Set());

  // Banner nuova richiesta prenotazione online
  const [showRichiestaPrenotaBanner, setShowRichiestaPrenotaBanner] = useState(false);
  const [richiestaPrenotaNome, setRichiestaPrenotaNome] = useState('');
  const [richiestaPrenotaData, setRichiestaPrenotaData] = useState<Date | null>(null);
  const [richiestaPrenotaId, setRichiestaPrenotaId] = useState<string | null>(null);
  const [richiestaPrenotaFoto, setRichiestaPrenotaFoto] = useState<string | null>(null);

  // Badge messaggi clienti non letti — coda ordinata per navigazione
  const [messaggiNonLetti, setMessaggiNonLetti] = useState<Array<{ id: string; cliente_id: string | null; nome: string; cognome: string }>>([]);

  // Popup notifica nuovo messaggio cliente
  const [messaggioPopup, setMessaggioPopup] = useState<{ nome: string; fotoUrl: string | null; clienteId: string | null } | null>(null);
  const [messaggioPopupFading, setMessaggioPopupFading] = useState(false);
  const msgPopupFadeRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const msgPopupRemoveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPingedRichiestaRef = useRef<string | null>(null);
  const richiestaPrenotaIdRef = useRef<string | null>(null);
  const ringIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recensioniIsTestRef = useRef(false);
  richiestaPrenotaIdRef.current = richiestaPrenotaId;
  const [suonoRichiesta, setSuonoRichiesta] = useState<'ping' | 'squillo'>('ping');
  const [volumeNotifiche, setVolumeNotifiche] = useState(70);

  // Popup referral: "ha presentato"
  interface ReferralPopup { donatrice: string; nuovaCliente: string; tipoCarta: string }
  const [referralPopups, setReferralPopups] = useState<ReferralPopup[]>([]);

  // Popup referral: "ha donato" (vecchio — mantenuto per compatibilità evento locale)
  interface DonazionePopup { donatrice: string }
  const [donazionePopups, setDonazionePopups] = useState<DonazionePopup[]>([]);

  // Report finanze automatico da Electron scheduler
  useEffect(() => {
    if (!window.electronAPI?.onTriggerAutoFinanze) return;
    const unsub = window.electronAPI.onTriggerAutoFinanze(async ({ periods }) => {
      for (const p of periods) {
        try {
          const rows = await fetchFinanzeReportData(p.startDate, p.endDate);
          const base64 = generateFinanzeReportPdf(rows, p.tipo as FinanzePeriodo, p.startDate, p.endDate);
          const s = (d: string) => d.replace(/-/g, '');
          const filename = `report-finanze-${p.tipo}-${s(p.startDate)}-${s(p.endDate)}.pdf`;
          await window.electronAPI!.saveFinanzeReport(p.tipo as FinanzePeriodo, filename, base64);
          await window.electronAPI!.markFinanzeDone(p.tipo as FinanzePeriodo, p.endDate);
        } catch (err) {
          console.error('[auto-finanze]', p.tipo, err);
          await window.electronAPI!.markFinanzeDone(p.tipo as FinanzePeriodo, p.endDate).catch(() => {});
        }
      }
    });
    return unsub;
  }, []);

  // Popup Gift Pass Realtime
  interface GpBannerPopup {
    eventId: string;
    codice: string;
    donatoreName: string;
    donatriceFotoUrl: string | null;
    tipo: 'donata' | 'attivata_nuova' | 'attivata_esistente';
    riceventeName?: string;
    riceventeFotoUrl?: string | null;
  }
  const [gpPopups, setGpPopups] = useState<GpBannerPopup[]>([]);
  const [gpBannersVistiSet, setGpBannersVistiSet] = useState<Set<string>>(new Set());

  // Popup record ambasciatori
  interface RecordPopup { donatrice: string; count: number; isFirst: boolean }
  const [recordPopups, setRecordPopups] = useState<RecordPopup[]>([]);

  // Banner richiesta permesso notifiche push
  const [showPushBanner, setShowPushBanner] = useState(false);

  const [electronDbReady, setElectronDbReadyState] = useState(false);
  const [dbReadyKey, setDbReadyKey] = useState(0);
  const [licenseActivated, setLicenseActivated] = useState<boolean | null>(null);
  const hasFicheNonConvalidateRef = { current: false };

  // License check: solo per build utente. Owner build Electron è sempre sbloccato.
  // Browser owner e qualsiasi user build passano dal LicenseWall.
  useEffect(() => {
    if (isOwnerBuild() && isElectron()) {
      setLicenseActivated(true);
      return;
    }
    getLicenseState().then(state => {
      setLicenseActivated(state.localActivated && state.cloudActivated);
    });
  }, []);

  function getReminderKey(todayKey: string, orario: string) {
    return `promemoria_shown_${todayKey}_${orario}`;
  }

  async function checkHasClientiRecensioni(userId: string): Promise<boolean> {
    const romeNow = new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Rome' });
    const todayKey = romeNow.split(' ')[0];
    const yesterdayKey = (() => {
      const d = new Date(`${todayKey}T12:00:00Z`);
      d.setUTCDate(d.getUTCDate() - 1);
      return d.toISOString().split('T')[0];
    })();
    const romeToUtc = (dateKey: string): string => {
      const naive = new Date(`${dateKey}T00:00:00Z`);
      const romeStr = naive.toLocaleString('sv-SE', { timeZone: 'Europe/Rome' });
      const naiveRome = new Date(romeStr.replace(' ', 'T') + 'Z');
      const offsetMs = naive.getTime() - naiveRome.getTime();
      return new Date(naive.getTime() - offsetMs).toISOString();
    };
    const { data } = await supabase
      .from('fiches')
      .select('id, clienti(recensione_lasciata, data_blocco_recensione)')
      .eq('user_id', userId)
      .eq('convalidata', true)
      .gte('convalidata_at', romeToUtc(yesterdayKey))
      .lte('convalidata_at', romeToUtc(todayKey))
      .is('deleted_at', null);
    if (!data || data.length === 0) return false;
    const now = new Date();
    const seen = new Set<string>();
    return (data as any[]).some(f => {
      if (seen.has(f.id)) return false;
      seen.add(f.id);
      const c = f.clienti as any;
      if (!c || c.recensione_lasciata) return false;
      const blocco = c.data_blocco_recensione ? new Date(c.data_blocco_recensione) : null;
      return !blocco || blocco <= now;
    });
  }

  function triggerReminderTest() {
    setShowReminderBanner(true);
  }

  function triggerRecensioniTest() {
    recensioniIsTestRef.current = true;
    const stile = localStorage.getItem('stile_promemoria_local') ?? 'schermo_intero';
    if (stile === 'sottile') {
      setShowRecensioniBannerSottile(true);
    } else {
      setShowRecensioniModal(true);
    }
  }

  function dismissRecensioniReminder() {
    setShowRecensioniBannerSottile(false);
    setShowRecensioniModal(false);
    if (recensioniIsTestRef.current) return;
    if (!user) return;
    const todayKey = new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Rome' }).split(' ')[0];
    localStorage.setItem(`recensioni_banner_dismissed_${todayKey}`, '1');
    setImpostazione('promemoria_recensioni_chiuso_il', todayKey, user.id).catch(() => {});
  }

  async function triggerInForseTest() {
    const dopodomani = new Date(Date.now() + 2 * 86400000);
    const ddKey = dopodomani.toLocaleString('sv-SE', { timeZone: 'Europe/Rome' }).split(' ')[0];
    const start = new Date(ddKey + 'T00:00:00').toISOString();
    const end = new Date(ddKey + 'T23:59:59').toISOString();
    const { data } = await supabase
      .from('appuntamenti')
      .select('id, clienti(nome)')
      .eq('stato', 'in_forse')
      .gte('data_ora', start)
      .lte('data_ora', end)
      .is('deleted_at', null);
    if (data && data.length > 0) {
      setInForseCount(data.length);
      const first = data[0] as { clienti?: { nome?: string } | null };
      setInForseNome(first?.clienti?.nome ?? '');
    } else {
      setInForseCount(1);
      setInForseNome('Esempio Cliente');
    }
    setShowInForseBanner(true);
  }

  function triggerPromAppTest() {
    setShowAppBanner(true);
  }

  function triggerCompleannoTest() {
    if (birthdayClienti.length === 0) {
      setBirthdayClienti([{ id: 'test', nome: 'Esempio', cognome: 'Cliente', telefono: null }]);
    }
    setShowBirthdayModal(true);
  }

  function handleSelectCliente(id: string, tab?: 'info' | 'colore' | 'appuntamenti' | 'storico' | 'carte' | 'messaggi') {
    pageHistoryRef.current = [...pageHistoryRef.current, { page, selectedCliente, selectedClienteTab }];
    history.pushState({ appNav: true }, '');
    setSelectedCliente(id);
    setSelectedClienteTab(tab);
    setPage('clienti');
  }

  // Carica impostazioni suono notifica richiesta appuntamento
  useEffect(() => {
    if (!user) return;
    Promise.all([
      getImpostazione('suono_richiesta_appuntamento'),
      getImpostazione('volume_notifiche'),
    ]).then(([suono, vol]) => {
      setSuonoRichiesta(suono === 'squillo' ? 'squillo' : 'ping');
      if (vol !== null) setVolumeNotifiche(Math.max(0, Math.min(100, parseInt(vol) || 70)));
    });

    // Carica bannersVisti dal DB
    supabase
      .from('impostazioni')
      .select('valore')
      .eq('user_id', user.id)
      .eq('chiave', 'gift_pass_banners_visti')
      .maybeSingle()
      .then(({ data }) => {
        try {
          const arr: string[] = JSON.parse(data?.valore ?? '[]');
          setGpBannersVistiSet(new Set(arr));
        } catch { /* noop */ }
      });

    // Carica schede_banners_viste dal DB
    supabase
      .from('impostazioni')
      .select('valore')
      .eq('user_id', user.id)
      .eq('chiave', 'schede_banners_viste')
      .maybeSingle()
      .then(({ data }) => {
        try {
          const arr: string[] = JSON.parse(data?.valore ?? '[]');
          setSchedeBannersVisteSet(new Set(arr));
        } catch { /* noop */ }
      });
  }, [user]);

  async function dismissGpBanner(eventId: string) {
    setGpPopups(prev => prev.filter(p => p.eventId !== eventId));
    setGpBannersVistiSet(prev => {
      const next = new Set(prev);
      next.add(eventId);
      return next;
    });
    if (!user) return;
    const { data: existing } = await supabase
      .from('impostazioni')
      .select('valore')
      .eq('user_id', user.id)
      .eq('chiave', 'gift_pass_banners_visti')
      .maybeSingle();
    const current: string[] = (() => { try { return JSON.parse(existing?.valore ?? '[]'); } catch { return []; } })();
    if (!current.includes(eventId)) {
      current.push(eventId);
      await supabase.from('impostazioni').upsert(
        { user_id: user.id, chiave: 'gift_pass_banners_visti', valore: JSON.stringify(current) },
        { onConflict: 'user_id,chiave' }
      );
    }
  }

  async function dismissSchedaBannerDb(schedaId: string) {
    setShowNuovaSchedaBanner(false);
    setNuovaSchedaCurrentId(null);
    setNuovaSchedaFoto(null);
    setSchedeBannersVisteSet(prev => {
      const next = new Set(prev);
      next.add(schedaId);
      return next;
    });
    if (!user) return;
    const { data: existing } = await supabase
      .from('impostazioni')
      .select('valore')
      .eq('user_id', user.id)
      .eq('chiave', 'schede_banners_viste')
      .maybeSingle();
    const current: string[] = (() => { try { return JSON.parse(existing?.valore ?? '[]'); } catch { return []; } })();
    if (!current.includes(schedaId)) {
      current.push(schedaId);
      await supabase.from('impostazioni').upsert(
        { user_id: user.id, chiave: 'schede_banners_viste', valore: JSON.stringify(current) },
        { onConflict: 'user_id,chiave' }
      );
    }
    setTimeout(checkAndShowPendingScheda, 400);
  }

  // Avviso invio appuntamenti e compleanni — eseguito una volta al caricamento
  useEffect(() => {
    async function checkStartupAlerts() {
      const now = new Date();
      const romeStr = now.toLocaleString('sv-SE', { timeZone: 'Europe/Rome' });
      const todayKey = romeStr.split(' ')[0]; // yyyy-mm-dd

      // 1. Banner "ricorda di inviare i messaggi appuntamento" — orario configurabile (localStorage)
      const appBannerAttivo = localStorage.getItem('loc_banner_promapp_attivo') ?? 'true';
      const appBannerDa = localStorage.getItem('loc_banner_promapp_da') ?? '07:00';
      const appBannerA = localStorage.getItem('loc_banner_promapp_a') ?? '11:00';
      if (appBannerAttivo !== 'false') {
        const nowTime = romeStr.split(' ')[1].slice(0, 5); // HH:mm
        if (nowTime >= appBannerDa && nowTime <= appBannerA) {
          setShowAppBanner(true);
        }
      }

      // 2. Compleanni del giorno — mostrati con debounce giornaliero
      const birthdayShownKey = `compleanno_shown_${todayKey}`;
      const compleannoAttivo = localStorage.getItem('loc_banner_compleanno_attivo') ?? 'true';
      if (compleannoAttivo !== 'false' && !localStorage.getItem(birthdayShownKey)) {
        const [month, day] = todayKey.split('-').slice(1).map(Number);
        const { data } = await supabase
          .from('clienti')
          .select('id, nome, cognome, telefono, data_nascita, auguri_inviati_il')
          .not('data_nascita', 'is', null);

      const compleanni = ((data || []) as { id: string; nome: string; cognome: string; telefono: string | null; data_nascita: string; auguri_inviati_il: string | null }[])
        .filter(c => {
          const parts = c.data_nascita.split('-');
          if (parseInt(parts[1], 10) !== month || parseInt(parts[2], 10) !== day) return false;
          if (c.auguri_inviati_il === todayKey) return false; // gia' gestito oggi da un altro dispositivo
          return true;
        })
        .map(c => ({ id: c.id, nome: c.nome, cognome: c.cognome, telefono: c.telefono }));

      if (compleanni.length > 0) {
        localStorage.setItem(birthdayShownKey, '1');
        setBirthdayClienti(compleanni);
        setTimeout(() => setShowBirthdayModal(true), 800);
      }
      } // end if compleannoAttivo
    }

    checkStartupAlerts();
  }, []);

  // Inject dynamic PWA manifest with custom gestionale icon
  useEffect(() => {
    if (!user) return;
    supabase.from('impostazioni')
      .select('chiave,valore')
      .eq('user_id', user.id)
      .in('chiave', ['icona_pwa_gestionale_url', 'nome_salone'])
      .then(({ data }) => {
        const rows = (data ?? []) as { chiave: string; valore: string }[];
        const iconUrl = rows.find(r => r.chiave === 'icona_pwa_gestionale_url')?.valore;
        const nomeSalone = rows.find(r => r.chiave === 'nome_salone')?.valore;
        const nome = nomeSalone || 'Gestionale';
        const icons = iconUrl
          ? [
              { src: iconUrl, sizes: '192x192', type: 'image/jpeg', purpose: 'any' },
              { src: iconUrl, sizes: '512x512', type: 'image/jpeg', purpose: 'any' },
              { src: iconUrl, sizes: '192x192', type: 'image/jpeg', purpose: 'maskable' },
            ]
          : [
              { src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
              { src: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
              { src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
            ];
        const manifest = {
          name: nome,
          short_name: nome,
          description: 'Gestionale completo per salone di parrucchieri',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          display_override: ['window-controls-overlay', 'standalone'],
          background_color: '#0f172a',
          theme_color: '#0f172a',
          orientation: 'any',
          lang: 'it',
          icons,
          categories: ['business', 'productivity'],
          prefer_related_applications: false,
        };
        try {
          const blob = new Blob([JSON.stringify(manifest)], { type: 'application/manifest+json' });
          const blobUrl = URL.createObjectURL(blob);
          let link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
          if (!link) {
            link = document.createElement('link');
            link.rel = 'manifest';
            document.head.appendChild(link);
          }
          link.href = blobUrl;
        } catch { /* non-blocking */ }
      })
      .catch(() => {});
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // Banner appuntamenti in forse — check ogni 20 secondi, spara una volta per minuto configurato
  useEffect(() => {
    const fmt = new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit' });
    let lastFiredMinute = '';
    const check = async () => {
      const attivo = localStorage.getItem('loc_banner_in_forse_attivo') ?? 'true';
      if (attivo === 'false') return;
      const orario = localStorage.getItem('loc_orario_in_forse') ?? '18:00';
      const nowIt = fmt.format(new Date());
      if (nowIt !== orario) return;
      if (lastFiredMinute === nowIt) return; // already fired this minute
      lastFiredMinute = nowIt;
      const dopodomani = new Date(Date.now() + 2 * 86400000);
      const ddKey = dopodomani.toLocaleString('sv-SE', { timeZone: 'Europe/Rome' }).split(' ')[0];
      const lsKey = `avviso_in_forse_shown_${ddKey}_${orario.replace(':', '')}`;
      if (localStorage.getItem(lsKey)) return;
      const start = new Date(ddKey + 'T00:00:00').toISOString();
      const end = new Date(ddKey + 'T23:59:59').toISOString();
      const { data } = await supabase
        .from('appuntamenti')
        .select('id, cliente_id, clienti(nome)')
        .eq('stato', 'in_forse')
        .gte('data_ora', start)
        .lte('data_ora', end)
        .is('deleted_at', null);
      if (!data || data.length === 0) return;
      localStorage.setItem(lsKey, '1');
      setInForseCount(data.length);
      const first = data[0] as { clienti?: { nome?: string } | null };
      setInForseNome(first?.clienti?.nome ?? '');
      setShowInForseBanner(true);
    };
    check();
    const id = setInterval(check, 20_000);
    return () => clearInterval(id);
  }, []);

  // Banner promemoria recensioni — controlla ogni 30 secondi, spara una volta all'orario configurato
  useEffect(() => {
    if (!user) return;
    const fmt = new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit' });
    let lastFiredMinuteRec = '';
    const checkRec = async () => {
      const attivo = localStorage.getItem('loc_banner_recensioni_attivo') ?? 'false';
      if (attivo !== 'true') return;
      const orario = localStorage.getItem('loc_orario_recensioni') ?? '19:00';
      const nowIt = fmt.format(new Date());
      if (nowIt !== orario) return;
      if (lastFiredMinuteRec === nowIt) return;
      lastFiredMinuteRec = nowIt;
      const todayKey = new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Rome' }).split(' ')[0];
      const lsKey = `recensioni_banner_shown_${todayKey}_${orario.replace(':', '')}`;
      const dismissKey = `recensioni_banner_dismissed_${todayKey}`;
      if (localStorage.getItem(lsKey) || localStorage.getItem(dismissKey)) return;
      // Pre-check silenzioso: se nessuna cliente da contattare, non mostrare nulla
      const hasClienti = await checkHasClientiRecensioni(user.id);
      if (!hasClienti) return;
      recensioniIsTestRef.current = false;
      localStorage.setItem(lsKey, '1');
      const stile = localStorage.getItem('stile_promemoria_local') ?? 'schermo_intero';
      if (stile === 'sottile') {
        setShowRecensioniBannerSottile(true);
      } else {
        setShowRecensioniModal(true);
      }
    };
    checkRec();
    const id = setInterval(checkRec, 30_000);
    return () => clearInterval(id);
  }, [user]);

  // Realtime: quando un altro dispositivo chiude il promemoria recensioni, nascondi anche qui
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`recensioni-dismiss-sync-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'impostazioni',
          filter: 'chiave=eq.promemoria_recensioni_chiuso_il',
        },
        (payload) => {
          const newVal = (payload.new as any)?.valore;
          if (!newVal) return;
          const todayKey = new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Rome' }).split(' ')[0];
          if (newVal === todayKey) {
            localStorage.setItem(`recensioni_banner_dismissed_${todayKey}`, '1');
            setShowRecensioniBannerSottile(false);
            setShowRecensioniModal(false);
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // Controlla se SQLite e' pronto in Electron; se non lo e', si usa Supabase direttamente
  useEffect(() => {
    if (!window.electronAPI?.db) return;
    window.electronAPI.db.isReady().then((ready: boolean) => {
      setElectronDbReady(ready);
      setElectronDbReadyState(ready);
    });
    return window.electronAPI.db.onReady((ready: boolean) => {
      setElectronDbReady(ready);
      setElectronDbReadyState(ready);
      if (ready) setDbReadyKey(k => k + 1);
    });
  }, []);

  // Imposta userId corrente per il push immediato in localDb.
  // In Electron, riapre il database SQLite nella sottocartella dell'utente
  // cosi' due account diversi non condividono mai lo stesso file .db.
  useEffect(() => {
    setCurrentUserId(user?.id ?? null);
    if (!user || !window.electronAPI?.db?.setUserProfile) return;
    // Segnala che il DB non e' ancora pronto finche' non si completa il cambio profilo
    setElectronDbReady(false);
    setElectronDbReadyState(false);
    window.electronAPI.db.setUserProfile(user.id).catch(() => {
      // Se fallisce (es. better-sqlite3 non disponibile), lascia il DB nello stato corrente
    });
    // La risposta arriva tramite l'evento 'db:ready' gia' ascoltato nell'effect sopra
  }, [user]);

  // Quando l'utente e' in sessione offline e la connessione torna,
  // mostra un banner discreto che invita a fare login per sincronizzare.
  const [showReconnectBanner, setShowReconnectBanner] = useState(false);
  useEffect(() => {
    if (!isOfflineSession) return;

    function handleOnlineForReconnect() {
      if (navigator.onLine) setShowReconnectBanner(true);
    }

    // Se gia' online al momento dell'attivazione della sessione offline, mostra subito
    if (navigator.onLine) setShowReconnectBanner(true);

    window.addEventListener('online', handleOnlineForReconnect);
    return () => window.removeEventListener('online', handleOnlineForReconnect);
  }, [isOfflineSession]);

  // Registrazione cloud in sospeso: se l'utente si è registrato offline, riprova la
  // creazione dell'account Supabase non appena è disponibile la connessione.
  useEffect(() => {
    if (!isOfflineSession || !user?.email) return;

    async function tryPendingCloudReg() {
      if (!navigator.onLine || !user?.email) return;
      const pendingKey = `pending_cloud_reg:${user.email.toLowerCase()}`;
      const pendingPassword = localStorage.getItem(pendingKey);
      if (!pendingPassword) return;

      try {
        const { data } = await supabase.auth.signUp({ email: user.email, password: pendingPassword });
        if (data?.user) {
          localStorage.removeItem(pendingKey);
          // Salva il profilo con il nuovo UUID Supabase — triggera la migrazione SQLite
          await window.electronAPI?.auth?.saveProfile(data.user.id, user.email, pendingPassword);
          // Dopo la migrazione, forza il login Supabase per ottenere la sessione reale.
          // onAuthStateChange aggiornerà automaticamente user.id e il sync ripartirà.
          await supabase.auth.signInWithPassword({ email: user.email, password: pendingPassword });
        }
      } catch { /* silenzioso, riproverà al prossimo avvio */ }
    }

    if (navigator.onLine) tryPendingCloudReg();
    window.addEventListener('online', tryPendingCloudReg);
    return () => window.removeEventListener('online', tryPendingCloudReg);
  }, [isOfflineSession, user?.email]);

  // Prefetch dati in IndexedDB — garantisce disponibilita' offline
  // Funziona anche senza SQLite. Si avvia subito dopo login e ogni 3 minuti.
  // Si riavvia immediatamente quando la connessione torna.
  useEffect(() => {
    if (!user) return;
    const userId = user.id;
    let cancelled = false;

    async function doPrefetch() {
      if (!navigator.onLine || cancelled) return;
      try {
        await prefetchToIndexedDb(userId);
      } catch (e) {
        console.warn('[Prefetch] Errore:', e);
      }
    }

    async function init() {
      // Invalida la cache delle tabelle colpite dalle migrazioni RLS del 17/06
      // (le vecchie cache potevano essere vuote a causa di dati con user_id = NULL)
      const { deleteTableCache } = await import('./lib/indexedDb');
      const STALE_TABLES = [
        'carte_sconto', 'carte_premium', 'ricariche_carta_premium',
        'utilizzi_carta_sconto', 'utilizzi_carta_premium',
        'magazzino_prodotti', 'magazzino_categorie', 'magazzino_schede_salvate',
        'rivendita_prodotti', 'impostazioni_tasse', 'assenze_parrucchieri',
        'voci_extra_catalogo', 'spese',
      ];
      await Promise.all(STALE_TABLES.map(t => deleteTableCache(t, userId)));
      if (!cancelled && navigator.onLine) doPrefetch();
    }

    init();

    const interval = setInterval(doPrefetch, 3 * 60 * 1000);

    const handleOnline = () => {
      // Al ritorno online: aspetta che le mutazioni pending siano sincronizzate, poi aggiorna la cache
      flushPendingSync().then(() => doPrefetch()).catch(() => doPrefetch());
    };
    window.addEventListener('online', handleOnline);

    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
    };
  }, [user]);

  // Sync bidirezionale unificato: locale → Supabase, poi Supabase → locale.
  // Attivo su entrambe le piattaforme: Electron (SQLite) e browser (IndexedDB).
  // In Electron aspetta che il DB sia pronto; nel browser inizia subito dopo il login.
  const syncBootstrapped = useRef(false);
  useEffect(() => {
    if (!user) return;
    if (isElectron() && !electronDbReady) return;
    const userId = user.id;
    let cancelled = false;
    syncBootstrapped.current = false;

    async function doSync() {
      if (!navigator.onLine || cancelled) return;
      try {
        // Rileva cambio progetto Supabase: forza upload completo se URL cambiata
        if (!isElectron()) {
          const LAST_URL_KEY = 'gestionale_last_supabase_url';
          const currentUrl = localStorage.getItem('sb_custom_url') || 'https://qfpeffzdszdanebmgafb.supabase.co';
          const lastUrl = localStorage.getItem(LAST_URL_KEY);
          if (lastUrl && lastUrl !== currentUrl) {
            await markAllRowsDirty(userId);
          }
          localStorage.setItem(LAST_URL_KEY, currentUrl);

          // Bootstrap check: se il remoto è vuoto ma l'IndexedDB ha dati, forza upload completo.
          // Gestisce il caso di migrazione a nuovo progetto Supabase senza lastUrl impostata.
          if (!syncBootstrapped.current) {
            syncBootstrapped.current = true;
            try {
              const { count: remoteCount } = await supabase
                .from('parrucchieri')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', userId);
              const localParr = await getTableCache('parrucchieri', userId);
              if ((remoteCount ?? 0) === 0 && (localParr ?? []).length > 0) {
                await markAllRowsDirty(userId);
              }
            } catch { /* non bloccante */ }
          }
        }
        // 1. Carica prima le modifiche locali (locale vince su remote più vecchio)
        await syncLocalToRemote(userId);
        if (cancelled) return;
        // 2. Scarica le modifiche remote più recenti del locale
        await syncRemoteToLocal(userId);
      } catch (e) {
        console.warn('[Sync] Errore sync:', e);
      }
    }

    doSync();
    const interval = setInterval(() => { doSync(); }, 5 * 60 * 1000);
    const handleOnline = () => { doSync(); };
    window.addEventListener('online', handleOnline);

    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
    };
  }, [user, electronDbReady]);

  // Promemoria convalida fiches (controllato ogni 30s in base all'orario configurato)
  useEffect(() => {
    function getRomeDateInfo() {
      const now = new Date();
      const romeStr = now.toLocaleString('sv-SE', { timeZone: 'Europe/Rome' });
      const [datePart, timePart] = romeStr.split(' ');
      const [hStr, mStr] = timePart.split(':');
      const nowMinutes = parseInt(hStr, 10) * 60 + parseInt(mStr, 10);
      const [yr, mo, dy] = datePart.split('-').map(Number);
      const dayOfWeek = new Date(yr, mo - 1, dy).getDay();
      return { todayKey: datePart, dayOfWeek, nowMinutes };
    }

    async function checkFicheNonConvalidate(todayKey: string) {
      const start = todayKey + 'T00:00:00';
      const end = todayKey + 'T23:59:59';
      const { data: apps } = await supabase
        .from('appuntamenti')
        .select('id')
        .gte('data_ora', new Date(start).toISOString())
        .lte('data_ora', new Date(end).toISOString())
        .neq('stato', 'cancellato');

      const appIds = (apps || []).map((a: { id: string }) => a.id);

      let nonConvalidate = false;

      if (appIds.length > 0) {
        const { data: fiches } = await supabase
          .from('fiches')
          .select('convalidata')
          .in('appuntamento_id', appIds);
        nonConvalidate = (fiches || []).some((f: { convalidata: boolean }) => !f.convalidata);
      }

      if (!nonConvalidate) {
        const { data: manuali } = await supabase
          .from('fiches')
          .select('convalidata')
          .eq('manuale', true)
          .eq('data_riferimento', todayKey);
        nonConvalidate = (manuali || []).some((f: { convalidata: boolean }) => !f.convalidata);
      }

      hasFicheNonConvalidateRef.current = nonConvalidate;
    }

    async function checkAndFire() {
      const giorniRaw = localStorage.getItem('loc_promemoria_convalida_giorni');
      const orario = localStorage.getItem('loc_promemoria_convalida_orario') ?? '20:00';

      let giorni: number[] = [1, 2, 3, 4, 5, 6];
      try { if (giorniRaw) giorni = JSON.parse(giorniRaw); } catch { /* keep default */ }

      const [targetH, targetM] = orario.split(':').map(Number);
      const targMinutes = targetH * 60 + targetM;

      const { todayKey, dayOfWeek, nowMinutes } = getRomeDateInfo();

      const inGiorni = giorni.includes(dayOfWeek);
      const oraPassed = nowMinutes >= targMinutes;
      const lsKey = getReminderKey(todayKey, orario);
      const notShown = !localStorage.getItem(lsKey);

      if (inGiorni && oraPassed && notShown) {
        localStorage.setItem(lsKey, '1');
        setShowReminderBanner(true);
      }

      await checkFicheNonConvalidate(todayKey);
    }

    checkAndFire();
    const interval = setInterval(checkAndFire, 30000);

    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (hasFicheNonConvalidateRef.current) {
        e.preventDefault();
        e.returnValue = 'Ci sono fiches non convalidate per oggi. Sei sicuro di voler chiudere?';
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  // Helpers DB per schede già mostrate (sostituisce localStorage)
  function isSchedaVista(id: string): boolean {
    return schedeBannersVisteSet.has(id);
  }

  function mostraSchedaBanner(id: string, nome: string, cognome: string, fotoUrl?: string | null) {
    if (isSchedaVista(id)) return;
    const n = [nome, cognome].filter(Boolean).join(' ') || 'Una cliente';
    setNuovaSchedaCurrentId(id);
    setNuovaSchedaNome(n);
    setNuovaSchedaFoto(fotoUrl ?? null);
    setShowNuovaSchedaBanner(true);
  }

  async function checkAndShowPendingScheda() {
    const { data } = await supabase
      .from('schede_clienti_da_confermare')
      .select('id, nome, cognome, foto_url')
      .eq('stato', 'in_attesa')
      .order('created_at', { ascending: false });
    const unseen = (data || []).find(r => !schedeBannersVisteSet.has(r.id));
    if (unseen) mostraSchedaBanner(unseen.id, unseen.nome, unseen.cognome, unseen.foto_url);
  }

  function dismissSchedaBanner() {
    if (nuovaSchedaCurrentId) dismissSchedaBannerDb(nuovaSchedaCurrentId);
    else { setShowNuovaSchedaBanner(false); }
  }

  function apriSchedaDalBanner() {
    if (!nuovaSchedaCurrentId) return;
    const id = nuovaSchedaCurrentId;
    dismissSchedaBannerDb(id);
    setSchedaIdToOpen(id);
    navigateTo('clienti');
  }

  // Prenotazione online helpers
  function getRichiesteDismissed(): Set<string> {
    try { return new Set(JSON.parse(localStorage.getItem('richiesta_prenota_dismissed') || '[]')); }
    catch { return new Set(); }
  }
  function markRichiestaDismissed(id: string) {
    const s = getRichiesteDismissed();
    s.add(id);
    localStorage.setItem('richiesta_prenota_dismissed', JSON.stringify([...s]));
  }

  function mostraRichiestaBanner(id: string, nome: string, cognome: string, dataOra: string, fotoUrl?: string | null) {
    const n = [nome, cognome].filter(Boolean).join(' ') || 'Una cliente';
    setRichiestaPrenotaId(id);
    setRichiestaPrenotaNome(n);
    setRichiestaPrenotaData(new Date(dataOra));
    setRichiestaPrenotaFoto(fotoUrl ?? null);
    setShowRichiestaPrenotaBanner(true);
    // Suona solo se è un appuntamento diverso dall'ultimo già segnalato
    if (lastPingedRichiestaRef.current !== id) {
      lastPingedRichiestaRef.current = id;
      if (suonoRichiesta === 'squillo') {
        startRing();
      } else {
        playPing();
      }
    }
  }

  function playPing() {
    if (volumeNotifiche === 0) return;
    try {
      const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.15);
      const v = 0.35 * (volumeNotifiche / 100);
      gain.gain.setValueAtTime(v, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.5);
    } catch (_) {}
  }

  function playSquillo() {
    if (volumeNotifiche === 0) return;
    // Squillo telefono classico: coppia di toni 480+620Hz (standard PSTN), onda triangolare per più presenza
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      const vol = 0.52 * (volumeNotifiche / 100);
      // Una "trillata" = due oscillatori sovrapposti per ricchezza armonica
      const burst = (start: number, dur: number) => {
        [480, 620].forEach(freq => {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination);
          o.type = 'triangle';
          o.frequency.setValueAtTime(freq, ctx.currentTime + start);
          g.gain.setValueAtTime(0, ctx.currentTime + start);
          g.gain.linearRampToValueAtTime(vol, ctx.currentTime + start + 0.025);
          g.gain.setValueAtTime(vol, ctx.currentTime + start + dur - 0.04);
          g.gain.linearRampToValueAtTime(0, ctx.currentTime + start + dur);
          o.start(ctx.currentTime + start);
          o.stop(ctx.currentTime + start + dur);
        });
      };
      // Squillo 1: brrrr (0.0–0.38s)
      burst(0.00, 0.18);
      burst(0.20, 0.18);
      // Pausa (0.38–0.60s)
      // Squillo 2: brrrr (0.60–0.98s)
      burst(0.60, 0.18);
      burst(0.80, 0.18);
    } catch (_) {}
  }

  function stopRing() {
    if (ringIntervalRef.current) {
      clearInterval(ringIntervalRef.current);
      ringIntervalRef.current = null;
    }
  }

  function startRing() {
    stopRing();
    playSquillo();
    ringIntervalRef.current = setInterval(playSquillo, 3500);
  }

  function playPingMessaggio() {
    if (volumeNotifiche === 0) return;
    try {
      const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const vol = 0.4 * (volumeNotifiche / 100);
      const note = (freq: number, start: number, dur: number) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.type = 'triangle';
        o.frequency.setValueAtTime(freq, ctx.currentTime + start);
        g.gain.setValueAtTime(vol, ctx.currentTime + start);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
        o.start(ctx.currentTime + start);
        o.stop(ctx.currentTime + start + dur);
      };
      note(1046, 0, 0.18);
      note(784, 0.2, 0.22);
    } catch (_) {}
  }

  function mostraMessaggioPopup(nome: string, cognome: string, fotoUrl: string | null, clienteId: string | null) {
    const n = [nome, cognome].filter(Boolean).join(' ') || 'Una cliente';
    if (msgPopupFadeRef.current) clearTimeout(msgPopupFadeRef.current);
    if (msgPopupRemoveRef.current) clearTimeout(msgPopupRemoveRef.current);
    setMessaggioPopupFading(false);
    setMessaggioPopup({ nome: n, fotoUrl, clienteId });
    playPingMessaggio();
    msgPopupFadeRef.current = setTimeout(() => setMessaggioPopupFading(true), 5000);
    msgPopupRemoveRef.current = setTimeout(() => { setMessaggioPopup(null); setMessaggioPopupFading(false); }, 7000);
  }

  async function checkAndShowPendingRichiesta() {
    const dismissed = getRichiesteDismissed();
    const { data } = await supabase
      .from('richieste_appuntamento')
      .select('id, nome, cognome, data_ora, clienti(foto_url)')
      .eq('stato', 'in_attesa')
      .order('created_at', { ascending: false });
    const pendingIds = new Set((data || []).map((r: { id: string }) => r.id));
    // Se il banner e' aperto ma la richiesta e' gia' stata gestita da un altro dispositivo, chiudi
    const currentId = richiestaPrenotaIdRef.current;
    if (currentId && !pendingIds.has(currentId)) {
      stopRing();
      markRichiestaDismissed(currentId);
      setShowRichiestaPrenotaBanner(false);
      setRichiestaPrenotaId(null);
    }
    const unseen = (data || []).find((r: { id: string }) => !dismissed.has(r.id));
    if (unseen) {
      const foto = (unseen.clienti as { foto_url?: string } | null)?.foto_url ?? null;
      mostraRichiestaBanner(unseen.id, unseen.nome, unseen.cognome, unseen.data_ora, foto);
    }
  }

  function dismissRichiestaBanner() {
    stopRing();
    if (richiestaPrenotaId) markRichiestaDismissed(richiestaPrenotaId);
    setShowRichiestaPrenotaBanner(false);
    setRichiestaPrenotaId(null);
    setTimeout(checkAndShowPendingRichiesta, 400);
  }

  function apriRichiestaDalBanner() {
    if (!richiestaPrenotaId || !richiestaPrenotaData) return;
    stopRing();
    markRichiestaDismissed(richiestaPrenotaId);
    setShowRichiestaPrenotaBanner(false);
    setRichiestaPrenotaId(null);
    // Imposta il giorno PRIMA di navigare, poi setPage direttamente
    // per evitare che navigateTo() resetti agendaSelectedDay
    setAgendaSelectedDay(richiestaPrenotaData);
    setPage('agenda');
  }

  // Realtime + polling: avviso nuova scheda cliente da confermare
  useEffect(() => {
    if (!user) return;

    let channelRef: ReturnType<typeof supabase.channel> | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let destroyed = false;

    function setupChannel() {
      if (destroyed) return;
      if (channelRef) {
        supabase.removeChannel(channelRef);
        channelRef = null;
      }

      channelRef = supabase
        .channel(`nuova_scheda_${Date.now()}`) // nome univoco per evitare conflitti
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'schede_clienti_da_confermare',
        }, (payload) => {
          const row = payload.new as { id?: string; nome?: string; cognome?: string; foto_url?: string | null; stato?: string };
          if (row.id && row.stato === 'in_attesa') {
            mostraSchedaBanner(row.id, row.nome ?? '', row.cognome ?? '', row.foto_url ?? null);
          }
        })
        .on('system', {}, (status) => {
          // Se il canale si chiude inaspettatamente, riconnetti dopo 5 secondi
          if ((status as unknown as { status: string })?.status === 'CHANNEL_ERROR' ||
              (status as unknown as { status: string })?.status === 'TIMED_OUT') {
            if (!destroyed) {
              reconnectTimer = setTimeout(setupChannel, 5000);
            }
          }
        })
        .subscribe((status) => {
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            if (!destroyed) reconnectTimer = setTimeout(setupChannel, 5000);
          }
        });
    }

    // All'avvio: mostra subito eventuali schede pendenti non ancora viste
    checkAndShowPendingScheda();

    // Avvia il canale realtime
    setupChannel();

    // Polling ogni 10 secondi — piu' aggressivo per non perdere nulla
    const interval = setInterval(checkAndShowPendingScheda, 10_000);

    return () => {
      destroyed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (channelRef) supabase.removeChannel(channelRef);
      clearInterval(interval);
    };
  }, [user]);

  // Realtime: popup "ha presentato" quando una scheda con carta donata arriva
  useEffect(() => {
    if (!user) return;

    let channelRef: ReturnType<typeof supabase.channel> | null = null;
    let destroyed = false;

    async function getReferralCount(donatoreId: string): Promise<number> {
      // Conta le presentate da gift_pass (destinatarie confermate)
      const [gpRes, csRes] = await Promise.all([
        supabase.from('gift_pass').select('id', { count: 'exact', head: true })
          .eq('cliente_id', donatoreId)
          .not('destinataria_cliente_id', 'is', null),
        supabase.from('carte_sconto').select('id', { count: 'exact', head: true })
          .eq('regalata_da_cliente_id', donatoreId)
          .not('cliente_id', 'is', null),
      ]);
      return (gpRes.count ?? 0) + (csRes.count ?? 0);
    }

    function addReferralPopup(donatrice: string, nuovaCliente: string, tipoCarta: string) {
      setReferralPopups(prev => [...prev, { donatrice, nuovaCliente, tipoCarta }]);
    }

    async function handleNuovaScheda(row: Record<string, unknown>) {
      const codiceGp = row.codice_gift_pass as string | null;
      const codiceCs = row.codice_carta_sconto as string | null;
      const presentataDaNome = (row.presentata_da_nome as string | null)?.trim() || null;

      const nuovaCliente = [row.nome, row.cognome].filter(Boolean).join(' ') || 'Nuova cliente';

      if (codiceGp) {
        const { data: gp } = await supabase.from('gift_pass')
          .select('cliente_id, clienti(nome, cognome)')
          .eq('codice', codiceGp)
          .maybeSingle();
        if (gp?.cliente_id && gp.clienti) {
          const cl = gp.clienti as { nome: string; cognome: string };
          const donatrice = [cl.nome, cl.cognome].filter(Boolean).join(' ');
          addReferralPopup(donatrice, nuovaCliente, 'Gift Pass');
          // Check record
          const count = await getReferralCount(gp.cliente_id as string);
          if (count > 0 && count % 5 === 0) {
            setRecordPopups(prev => [...prev, { donatrice, count, isFirst: count === 5 }]);
          }
        }
      } else if (codiceCs) {
        const { data: cs } = await supabase.from('carte_sconto')
          .select('regalata_da_cliente_id, clienti:regalata_da_cliente_id(nome, cognome)')
          .eq('codice', codiceCs)
          .maybeSingle();
        if (cs?.regalata_da_cliente_id && cs.clienti) {
          const cl = cs.clienti as { nome: string; cognome: string };
          const donatrice = [cl.nome, cl.cognome].filter(Boolean).join(' ');
          addReferralPopup(donatrice, nuovaCliente, 'Carta Sconto');
          const count = await getReferralCount(cs.regalata_da_cliente_id as string);
          if (count > 0 && count % 5 === 0) {
            setRecordPopups(prev => [...prev, { donatrice, count, isFirst: count === 5 }]);
          }
        }
      } else if (presentataDaNome && !/^ignot/i.test(presentataDaNome)) {
        // Segnalazione manuale senza codice carta
        addReferralPopup(presentataDaNome, nuovaCliente, 'Passaparola');
      }
    }

    channelRef = supabase
      .channel(`referral_schede_${Date.now()}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'schede_clienti_da_confermare',
      }, (payload) => {
        if (destroyed) return;
        const row = payload.new as Record<string, unknown>;
        handleNuovaScheda(row);
      })
      .subscribe();

    // Listener per evento "carta donata" lanciato da Carte.tsx
    function handleCartaDonata(e: Event) {
      const { donatrice } = (e as CustomEvent).detail as { donatrice: string };
      setDonazionePopups(prev => [...prev, { donatrice }]);
    }
    window.addEventListener('carta_donata', handleCartaDonata);

    return () => {
      destroyed = true;
      if (channelRef) supabase.removeChannel(channelRef);
      window.removeEventListener('carta_donata', handleCartaDonata);
    };
  }, [user]);

  // Realtime: banner Gift Pass (donata + attivata)
  useEffect(() => {
    if (!user) return;
    let channelGp: ReturnType<typeof supabase.channel> | null = null;
    let channelSync: ReturnType<typeof supabase.channel> | null = null;
    let destroyed = false;

    async function handleGpUpdate(payload: { new: Record<string, unknown>; old: Record<string, unknown> }) {
      if (destroyed) return;
      const n = payload.new;
      const o = payload.old;

      // Banner 1: donata appena impostata a true
      if (n.donata === true && o.donata !== true && !n.attivata_at) {
        const eventId = `${n.id}_donata`;
        if (gpBannersVistiSet.has(eventId)) return;
        const { data: don } = await supabase.from('clienti').select('nome, cognome, foto_url').eq('id', n.cliente_id as string).maybeSingle();
        const donatoreName = don ? `${don.nome ?? ''} ${don.cognome ?? ''}`.trim() : (n.destinataria_nome as string ?? '');
        if (!destroyed) {
          setGpPopups(prev => [...prev, {
            eventId,
            codice: n.codice as string,
            donatoreName,
            donatriceFotoUrl: don?.foto_url ?? null,
            tipo: 'donata',
          }]);
        }
        return;
      }

      // Banner 2 & 3: attivata_at appena impostata (riscatto online)
      if (n.attivata_at && !o.attivata_at) {
        const eventId = `${n.id}_attivata`;
        if (gpBannersVistiSet.has(eventId)) return;
        const [donRes, riceventeRes] = await Promise.all([
          n.cliente_id
            ? supabase.from('clienti').select('nome, cognome, foto_url').eq('id', n.cliente_id as string).maybeSingle()
            : Promise.resolve({ data: null }),
          n.destinataria_cliente_id
            ? supabase.from('clienti').select('nome, cognome, foto_url').eq('id', n.destinataria_cliente_id as string).maybeSingle()
            : supabase.from('schede_clienti_da_confermare').select('nome, cognome, foto_url').eq('codice_gift_pass', n.codice as string).maybeSingle(),
        ]);
        const don = (donRes as { data: { nome?: string; cognome?: string; foto_url?: string } | null }).data;
        const ric = (riceventeRes as { data: { nome?: string; cognome?: string; foto_url?: string } | null }).data;
        const donatoreName = don ? `${don.nome ?? ''} ${don.cognome ?? ''}`.trim() : '';
        const riceventeName = ric ? `${ric.nome ?? ''} ${ric.cognome ?? ''}`.trim() : '';
        const tipo = n.destinataria_cliente_id ? 'attivata_esistente' : 'attivata_nuova';
        if (!destroyed) {
          setGpPopups(prev => [...prev, {
            eventId,
            codice: n.codice as string,
            donatoreName,
            donatriceFotoUrl: don?.foto_url ?? null,
            tipo,
            riceventeName,
            riceventeFotoUrl: ric?.foto_url ?? null,
          }]);
        }
      }
    }

    channelGp = supabase
      .channel(`gp_realtime_${Date.now()}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'gift_pass' }, (payload) => {
        handleGpUpdate(payload as unknown as { new: Record<string, unknown>; old: Record<string, unknown> });
      })
      .subscribe();

    // Sync cross-dispositivo: aggiorna bannersVisti quando un altro device chiude un banner
    channelSync = supabase
      .channel(`gp_banners_sync_${Date.now()}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'impostazioni' }, (payload) => {
        if (destroyed) return;
        const row = payload.new as { chiave?: string; valore?: string; user_id?: string };
        if (row.user_id !== user.id) return;
        if (row.chiave === 'gift_pass_banners_visti') {
          try {
            const arr: string[] = JSON.parse(row.valore ?? '[]');
            const set = new Set(arr);
            setGpBannersVistiSet(set);
            setGpPopups(prev => prev.filter(p => !set.has(p.eventId)));
          } catch { /* noop */ }
        }
        if (row.chiave === 'schede_banners_viste') {
          try {
            const arr: string[] = JSON.parse(row.valore ?? '[]');
            const set = new Set(arr);
            setSchedeBannersVisteSet(set);
            // Se il banner attivo e' nella lista visti, nascondilo
            setNuovaSchedaCurrentId(prev => {
              if (prev && set.has(prev)) {
                setShowNuovaSchedaBanner(false);
                setNuovaSchedaFoto(null);
                return null;
              }
              return prev;
            });
          } catch { /* noop */ }
        }
      })
      .subscribe();

    return () => {
      destroyed = true;
      if (channelGp) supabase.removeChannel(channelGp);
      if (channelSync) supabase.removeChannel(channelSync);
    };
  }, [user, gpBannersVistiSet]);

  // Realtime + polling: avviso nuova richiesta prenotazione online
  useEffect(() => {
    if (!user) return;

    let channelRef: ReturnType<typeof supabase.channel> | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let destroyed = false;

    function setupChannel() {
      if (destroyed) return;
      if (channelRef) { supabase.removeChannel(channelRef); channelRef = null; }

      channelRef = supabase
        .channel(`richiesta_prenota_${Date.now()}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'richieste_appuntamento',
        }, async (payload) => {
          const row = payload.new as { id?: string; nome?: string; cognome?: string; data_ora?: string; cliente_id?: string };
          if (row.id) {
            const dismissed = getRichiesteDismissed();
            if (!dismissed.has(row.id)) {
              let foto: string | null = null;
              if (row.cliente_id) {
                const { data: cl } = await supabase.from('clienti').select('foto_url').eq('id', row.cliente_id).maybeSingle();
                foto = cl?.foto_url ?? null;
              }
              mostraRichiestaBanner(row.id, row.nome ?? '', row.cognome ?? '', row.data_ora ?? new Date().toISOString(), foto);
            }
          }
        })
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'richieste_appuntamento',
        }, (payload) => {
          const row = payload.new as { id?: string; stato?: string };
          // Se la richiesta mostrata e' stata gestita da un altro dispositivo, chiudi subito
          if (row.id && row.id === richiestaPrenotaIdRef.current && row.stato !== 'in_attesa') {
            stopRing();
            markRichiestaDismissed(row.id);
            setShowRichiestaPrenotaBanner(false);
            setRichiestaPrenotaId(null);
          }
        })
        .on('system', {}, (status) => {
          if ((status as unknown as { status: string })?.status === 'CHANNEL_ERROR' ||
              (status as unknown as { status: string })?.status === 'TIMED_OUT') {
            if (!destroyed) reconnectTimer = setTimeout(setupChannel, 5000);
          }
        })
        .subscribe((status) => {
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            if (!destroyed) reconnectTimer = setTimeout(setupChannel, 5000);
          }
        });
    }

    checkAndShowPendingRichiesta();
    setupChannel();
    const interval = setInterval(checkAndShowPendingRichiesta, 15_000);

    return () => {
      destroyed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (channelRef) supabase.removeChannel(channelRef);
      clearInterval(interval);
    };
  }, [user]);

  // Polling + Realtime: badge e popup messaggi clienti non letti
  useEffect(() => {
    if (!user) return;

    const seenIds = new Set<string>();
    let firstLoad = true;
    let destroyed = false;

    async function pollNonLetti() {
      if (destroyed) return;
      const { data } = await supabase
        .from('messaggi_clienti')
        .select('id, cliente_id, nome, cognome')
        .eq('letto', false)
        .order('created_at', { ascending: true });
      const rows = (data ?? []) as Array<{ id: string; cliente_id: string | null; nome: string; cognome: string }>;
      setMessaggiNonLetti(rows);

      if (firstLoad) {
        // Primo caricamento: popola seenIds senza mostrare popup
        rows.forEach(r => seenIds.add(r.id));
        firstLoad = false;
      } else {
        // Caricamenti successivi: mostra popup per righe nuove
        for (const row of rows) {
          if (!seenIds.has(row.id)) {
            seenIds.add(row.id);
            let fotoUrl: string | null = null;
            if (row.cliente_id) {
              const { data: cl } = await supabase.from('clienti').select('foto_url').eq('id', row.cliente_id).maybeSingle();
              fotoUrl = cl?.foto_url ?? null;
            }
            mostraMessaggioPopup(row.nome, row.cognome, fotoUrl, row.cliente_id);
          }
        }
      }
    }

    pollNonLetti();
    const interval = setInterval(pollNonLetti, 4_000);

    // Realtime come trigger aggiuntivo (riduce latenza)
    let channelRef: ReturnType<typeof supabase.channel> | null = null;
    channelRef = supabase
      .channel(`messaggi_clienti_rt_${Date.now()}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messaggi_clienti' }, () => {
        pollNonLetti();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messaggi_clienti' }, () => {
        pollNonLetti();
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messaggi_clienti' }, () => {
        pollNonLetti();
      })
      .subscribe();

    return () => {
      destroyed = true;
      if (channelRef) supabase.removeChannel(channelRef);
      clearInterval(interval);
    };
  }, [user]);

  function handleMessaggioBadgeClick() {
    if (messaggiNonLetti.length === 0) return;
    const first = messaggiNonLetti[0];
    if (first.cliente_id) {
      handleSelectCliente(first.cliente_id, 'messaggi');
    } else {
      navigateTo('clienti');
    }
    // Segna come letto il primo della coda
    supabase.from('messaggi_clienti').update({ letto: true }).eq('id', first.id).then(() => {
      setMessaggiNonLetti(prev => prev.filter(m => m.id !== first.id));
    });
  }

  // Push notification setup
  useEffect(() => {
    if (!user || !isPushSupported()) return;

    const perm = getPushPermission();

    if (perm === 'granted') {
      // Already granted — ensure subscription is active and re-saved (catches expired subs)
      subscribePush().catch(() => {});
    } else if (perm === 'default') {
      // Show banner only if not already dismissed within the last 30 days
      const lastDismissed = localStorage.getItem('push_banner_dismissed');
      const thirtyDays = 30 * 24 * 60 * 60 * 1000;
      if (!lastDismissed || Date.now() - parseInt(lastDismissed) > thirtyDays) {
        const t = setTimeout(() => setShowPushBanner(true), 3000);
        return () => clearTimeout(t);
      }
    }
    // perm === 'denied' — respect the user's choice, do nothing
  }, [user]);

  // Listen for service worker messages (push notification click → open agenda)
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    function handleMessage(event: MessageEvent) {
      if (event.data?.type === 'OPEN_AGENDA') {
        navigateTo('agenda');
      }
    }

    navigator.serviceWorker.addEventListener('message', handleMessage);
    return () => navigator.serviceWorker.removeEventListener('message', handleMessage);
  }, []);

  async function handleEnablePush() {
    setShowPushBanner(false);
    localStorage.setItem('push_banner_dismissed', Date.now().toString());
    const perm = await requestPushPermission();
    if (perm === 'granted') {
      await subscribePush();
    }
  }

  // Deep link handler per reset password (Electron)
  useEffect(() => {
    if (!window.electronAPI?.onDeepLink) return;
    const cleanup = window.electronAPI.onDeepLink(async (url) => {
      if (!url.startsWith('gestionale-salone://reset-password')) return;
      // Estrai access_token e refresh_token dal fragment dell'URL
      const hash = url.split('#')[1] ?? url.split('?')[1] ?? '';
      const params = new URLSearchParams(hash);
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      if (accessToken && refreshToken) {
        await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
      }
      setShowResetPassword(true);
    });
    return cleanup;
  }, []);

  // Mostra la licenza wall solo in build utente e finché non è attivata
  if (licenseActivated === null) {
    return (
      <div className="min-h-screen bg-stone-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!licenseActivated) {
    return <LicenseWall onActivated={() => setLicenseActivated(true)} />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 bg-amber-500 rounded-xl flex items-center justify-center shadow-lg">
            <Scissors size={22} className="text-white" />
          </div>
          <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (showResetPassword) {
    return <ResetPassword onDone={() => setShowResetPassword(false)} />;
  }

  if (!user) {
    return <Login />;
  }

  return (
    <>
      {/* Container unico per tutti i banner/popup top-center — si impilano automaticamente */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[105] w-full max-w-md px-4 flex flex-col gap-2 pointer-events-none">

        {/* Banner riconnessione: sessione offline attiva ma internet disponibile */}
        {showReconnectBanner && isOfflineSession && (
          <div className="pointer-events-auto bg-blue-50 border border-blue-300 rounded-2xl shadow-xl px-5 py-4 flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Wifi size={16} className="text-blue-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-blue-900">Internet disponibile</p>
              <p className="text-xs text-blue-700 mt-0.5">
                Sei in modalita' offline. Esci e accedi di nuovo per sincronizzare i dati con il cloud.
              </p>
            </div>
            <button
              onClick={() => setShowReconnectBanner(false)}
              className="p-1 hover:bg-blue-100 rounded-lg transition-colors text-blue-400 hover:text-blue-600 flex-shrink-0"
            >
              <X size={15} />
            </button>
          </div>
        )}

        {/* Banner promemoria convalida fiches */}
        {showReminderBanner && (
          <div className="pointer-events-auto bg-amber-50 border border-amber-300 rounded-2xl shadow-xl px-5 py-4 flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Bell size={16} className="text-amber-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-amber-900">Promemoria: convalida le fiches</p>
              <p className="text-xs text-amber-700 mt-0.5">Ricordati di convalidare le fiches della giornata prima di chiudere.</p>
            </div>
            <button
              onClick={() => setShowReminderBanner(false)}
              className="p-1 hover:bg-amber-100 rounded-lg transition-colors text-amber-500 hover:text-amber-700 flex-shrink-0"
            >
              <X size={15} />
            </button>
          </div>
        )}

        {/* Banner sottile promemoria recensioni Google */}
        {showRecensioniBannerSottile && (
          <div className="pointer-events-auto bg-blue-50 border border-blue-300 rounded-2xl shadow-xl px-5 py-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
              <Star size={16} className="text-blue-600" />
            </div>
            <button
              className="flex-1 text-left"
              onClick={() => { setShowRecensioniBannerSottile(false); setShowRecensioniModal(true); }}
            >
              <p className="text-sm font-bold text-blue-900">Promemoria Recensioni</p>
              <p className="text-xs text-blue-700 mt-0.5">Clienti di ieri — tocca per aprire la lista</p>
            </button>
            <button
              onClick={dismissRecensioniReminder}
              className="p-1 hover:bg-blue-100 rounded-lg transition-colors text-blue-400 hover:text-blue-600 flex-shrink-0"
            >
              <X size={15} />
            </button>
          </div>
        )}

        {/* Banner nuova scheda cliente da confermare */}
        {showNuovaSchedaBanner && (
          <div className="pointer-events-auto bg-pink-50 border border-pink-300 rounded-2xl shadow-xl px-4 py-3.5 flex items-center gap-3 animate-bounce-once">
            <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-pink-200 flex-shrink-0">
              {nuovaSchedaFoto
                ? <img src={nuovaSchedaFoto} alt={nuovaSchedaNome} className="w-full h-full object-cover" />
                : <div className="w-full h-full bg-pink-100 flex items-center justify-center text-pink-500 font-bold text-sm">
                    {nuovaSchedaNome.charAt(0).toUpperCase() || <ClipboardList size={15} />}
                  </div>}
            </div>
            <button className="flex-1 text-left" onClick={apriSchedaDalBanner}>
              <p className="text-sm font-bold text-pink-900">Nuova scheda da confermare!</p>
              <p className="text-xs text-pink-700 mt-0.5">
                <span className="font-semibold">{nuovaSchedaNome}</span> ha inviato i suoi dati.{' '}
                <span className="underline font-semibold">Tocca per aprirla.</span>
              </p>
            </button>
            <button
              onClick={dismissSchedaBanner}
              className="p-1 hover:bg-pink-100 rounded-lg transition-colors text-pink-400 hover:text-pink-600 flex-shrink-0"
            >
              <X size={15} />
            </button>
          </div>
        )}

        {/* Banner richiesta permesso notifiche push */}
        {showPushBanner && (
          <div className="pointer-events-auto bg-white border border-stone-200 rounded-2xl shadow-2xl px-5 py-4 flex items-start gap-3 animate-bounce-once">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0 mt-0.5">
              <BellRing size={16} className="text-emerald-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-stone-900">Attiva le notifiche push</p>
              <p className="text-xs text-stone-500 mt-0.5">
                Ricevi una notifica sul telefono anche quando l'app è chiusa, ogni volta che arriva una prenotazione online.
              </p>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={handleEnablePush}
                  className="px-4 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700 transition-colors"
                >
                  Attiva
                </button>
                <button
                  onClick={() => {
                    setShowPushBanner(false);
                    localStorage.setItem('push_banner_dismissed', Date.now().toString());
                  }}
                  className="px-4 py-1.5 bg-stone-100 text-stone-600 text-xs font-medium rounded-lg hover:bg-stone-200 transition-colors"
                >
                  Non ora
                </button>
              </div>
            </div>
            <button
              onClick={() => setShowPushBanner(false)}
              className="p-1 hover:bg-stone-100 rounded-lg transition-colors text-stone-300 hover:text-stone-500 flex-shrink-0"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Banner nuova richiesta prenotazione online */}
        {showRichiestaPrenotaBanner && (
          <button className="pointer-events-auto w-full bg-emerald-50 border border-emerald-300 rounded-2xl shadow-xl px-5 py-4 flex items-center gap-3 animate-bounce-once text-left" onClick={apriRichiestaDalBanner}>
            {richiestaPrenotaFoto ? (
              <img src={richiestaPrenotaFoto} alt="" className="w-10 h-10 rounded-xl object-cover flex-shrink-0" />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <CalendarClock size={17} className="text-emerald-600" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-emerald-900">Nuova richiesta di prenotazione!</p>
              <p className="text-xs text-emerald-700 mt-0.5">
                <span className="font-semibold">{richiestaPrenotaNome}</span> ha richiesto un appuntamento.{' '}
                <span className="underline font-semibold">Tocca per aprire l'agenda.</span>
              </p>
            </div>
          </button>
        )}

        {/* Popup notifica nuovo messaggio cliente */}
        {messaggioPopup && (
          <div
            className="pointer-events-auto bg-red-600 rounded-2xl shadow-2xl px-5 py-4 flex items-center gap-3"
            style={{
              opacity: messaggioPopupFading ? 0 : 1,
              transition: 'opacity 2000ms ease',
              pointerEvents: messaggioPopupFading ? 'none' : 'auto',
            }}
          >
            {messaggioPopup.fotoUrl ? (
              <img src={messaggioPopup.fotoUrl} alt="" className="w-11 h-11 rounded-xl object-cover flex-shrink-0 border-2 border-red-400" />
            ) : (
              <div className="w-11 h-11 rounded-xl bg-red-500 flex items-center justify-center flex-shrink-0 border-2 border-red-400">
                <MessageSquare size={18} className="text-white" />
              </div>
            )}
            <button
              className="flex-1 min-w-0 text-left"
              onClick={() => {
                if (msgPopupFadeRef.current) clearTimeout(msgPopupFadeRef.current);
                if (msgPopupRemoveRef.current) clearTimeout(msgPopupRemoveRef.current);
                if (messaggioPopup.clienteId) handleSelectCliente(messaggioPopup.clienteId, 'messaggi');
                else navigateTo('clienti');
                setMessaggioPopup(null);
              }}
            >
              <p className="text-sm font-bold text-white">Nuovo messaggio!</p>
              <p className="text-xs text-red-100 mt-0.5">
                <span className="font-semibold">{messaggioPopup.nome}</span> ha inviato un messaggio.{' '}
                <span className="underline font-semibold">Tocca per aprire.</span>
              </p>
            </button>
            <button
              onClick={() => {
                if (msgPopupFadeRef.current) clearTimeout(msgPopupFadeRef.current);
                if (msgPopupRemoveRef.current) clearTimeout(msgPopupRemoveRef.current);
                setMessaggioPopup(null);
              }}
              className="p-1.5 hover:bg-red-500 rounded-lg transition-colors text-red-200 hover:text-white flex-shrink-0"
            >
              <X size={15} />
            </button>
          </div>
        )}

        {/* Banner promemoria invio messaggi appuntamento (all'avvio) */}
        {showAppBanner && (
          <div className="pointer-events-auto bg-sky-50 border border-sky-300 rounded-2xl shadow-xl px-5 py-4 flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-sky-100 flex items-center justify-center flex-shrink-0 mt-0.5">
              <MessageSquare size={16} className="text-sky-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-sky-900">Ricorda di inviare i messaggi</p>
              <p className="text-xs text-sky-700 mt-0.5">Hai inviato i promemoria appuntamento alle clienti di oggi?</p>
            </div>
            <button
              onClick={() => setShowAppBanner(false)}
              className="p-1 hover:bg-sky-100 rounded-lg transition-colors text-sky-500 hover:text-sky-700 flex-shrink-0"
            >
              <X size={15} />
            </button>
          </div>
        )}

        {/* Banner appuntamenti in forse */}
        {showInForseBanner && (
          <div className="pointer-events-auto bg-orange-50 border border-orange-300 rounded-2xl shadow-xl px-5 py-4 flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-orange-100 flex items-center justify-center flex-shrink-0 mt-0.5">
              <HelpCircle size={16} className="text-orange-600" />
            </div>
            <button
              className="flex-1 text-left"
              onClick={async () => {
                setShowInForseBanner(false);
                const entries = await loadAvvisoInForse();
                setInForseModalClienti(entries);
                setShowInForseModal(true);
              }}
            >
              <p className="text-sm font-bold text-orange-900">Appuntamenti "in forse" tra 2 giorni</p>
              <p className="text-xs text-orange-700 mt-0.5">
                {inForseCount === 1
                  ? `Chiedi conferma a ${inForseNome} per l'appuntamento di dopodomani`
                  : `${inForseCount} clienti con appuntamento incerto — chiedi conferma`}
              </p>
            </button>
            <button
              onClick={() => setShowInForseBanner(false)}
              className="p-1 hover:bg-orange-100 rounded-lg transition-colors text-orange-500 hover:text-orange-700 flex-shrink-0"
            >
              <X size={15} />
            </button>
          </div>
        )}

      </div>

      {/* Popup referral: ha presentato */}
      {referralPopups.length > 0 && (
        <div className="fixed right-4 top-4 z-[110] flex flex-col gap-2 max-w-sm">
          {referralPopups.map((p, i) => (
            <div key={i} className="bg-emerald-600 rounded-2xl shadow-2xl px-5 py-4 flex items-start gap-3 animate-bounce-once">
              <div className="w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Star size={16} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white">Nuova cliente presentata!</p>
                <p className="text-xs text-emerald-100 mt-0.5 leading-relaxed">
                  <span className="font-semibold">{p.donatrice}</span> ha presentato{' '}
                  <span className="font-semibold">{p.nuovaCliente}</span> tramite {p.tipoCarta}.
                </p>
              </div>
              <button
                onClick={() => setReferralPopups(prev => prev.filter((_, j) => j !== i))}
                className="p-1 hover:bg-emerald-500 rounded-lg transition-colors text-emerald-200 hover:text-white flex-shrink-0"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Popup referral: ha donato */}
      {donazionePopups.length > 0 && (
        <div className="fixed right-4 bottom-4 z-[110] flex flex-col gap-2 max-w-sm">
          {donazionePopups.map((p, i) => (
            <div key={i} className="bg-violet-600 rounded-2xl shadow-2xl px-5 py-4 flex items-start gap-3 animate-bounce-once">
              <div className="w-9 h-9 rounded-xl bg-violet-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Gift size={16} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white">Carta donata!</p>
                <p className="text-xs text-violet-100 mt-0.5">
                  <span className="font-semibold">{p.donatrice}</span> ha donato la sua carta!
                </p>
              </div>
              <button
                onClick={() => setDonazionePopups(prev => prev.filter((_, j) => j !== i))}
                className="p-1 hover:bg-violet-500 rounded-lg transition-colors text-violet-200 hover:text-white flex-shrink-0"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Popup Gift Pass Realtime (donata / attivata nuova / attivata esistente) */}
      {gpPopups.length > 0 && (
        <div className="fixed right-4 bottom-20 z-[111] flex flex-col-reverse gap-2 max-w-xs w-full">
          {gpPopups.map((p) => {
            const isBlu = p.tipo === 'attivata_esistente';
            const isTeal = p.tipo === 'attivata_nuova';
            const bg = isBlu ? 'bg-blue-700' : isTeal ? 'bg-teal-700' : 'bg-violet-700';
            const bgIcon = isBlu ? 'bg-blue-600' : isTeal ? 'bg-teal-600' : 'bg-violet-600';
            const textSub = isBlu ? 'text-blue-100' : isTeal ? 'text-teal-100' : 'text-violet-100';
            const hoverBtn = isBlu ? 'hover:bg-blue-600' : isTeal ? 'hover:bg-teal-600' : 'hover:bg-violet-600';
            const title = p.tipo === 'donata' ? 'Gift Pass donata!' : 'Gift Pass riscattata!';

            function Avatar({ url, name, badge }: { url?: string | null; name?: string; badge?: string }) {
              return (
                <div className="relative flex-shrink-0">
                  <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-white/30">
                    {url
                      ? <img src={url} alt={name} className="w-full h-full object-cover" />
                      : <div className={`w-full h-full ${bgIcon} flex items-center justify-center text-white text-sm font-bold`}>
                          {name?.charAt(0)?.toUpperCase() ?? <Gift size={14} />}
                        </div>}
                  </div>
                  {badge && (
                    <span className="absolute -bottom-1 -right-1 text-[8px] font-bold bg-white text-stone-700 px-1 rounded-full whitespace-nowrap leading-tight py-0.5">
                      {badge}
                    </span>
                  )}
                </div>
              );
            }

            return (
              <div key={p.eventId} className={`${bg} rounded-2xl shadow-2xl px-4 py-3.5 flex items-start gap-3 animate-bounce-once`}>
                {/* Avatar(s) */}
                <div className="flex gap-1 flex-shrink-0 mt-0.5">
                  <Avatar url={p.donatriceFotoUrl} name={p.donatoreName} />
                  {(p.tipo === 'attivata_nuova' || p.tipo === 'attivata_esistente') && (
                    <Avatar
                      url={p.riceventeFotoUrl}
                      name={p.riceventeName}
                      badge={p.tipo === 'attivata_nuova' ? 'Nuova' : 'Già qui'}
                    />
                  )}
                </div>
                {/* Testo */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white">{title}</p>
                  {p.tipo === 'donata' && (
                    <p className={`text-xs ${textSub} mt-0.5 leading-snug`}>
                      <span className="font-semibold">{p.donatoreName}</span> ha donato la Gift Pass{' '}
                      <span className="font-mono font-bold">{p.codice}</span>!
                    </p>
                  )}
                  {(p.tipo === 'attivata_nuova' || p.tipo === 'attivata_esistente') && (
                    <p className={`text-xs ${textSub} mt-0.5 leading-snug`}>
                      <span className="font-semibold">{p.riceventeName || 'Una cliente'}</span>
                      {p.tipo === 'attivata_nuova' ? ' (Nuova Cliente)' : ' (Già Cliente)'}
                      {' '}ha registrato la Gift Pass ricevuta da{' '}
                      <span className="font-semibold">{p.donatoreName}</span>
                    </p>
                  )}
                </div>
                {/* X */}
                <button
                  onClick={() => dismissGpBanner(p.eventId)}
                  className={`p-1 ${hoverBtn} rounded-lg transition-colors text-white/60 hover:text-white flex-shrink-0`}
                >
                  <X size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Popup record ambasciatori */}
      {recordPopups.length > 0 && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-4 z-[112] flex flex-col gap-2 max-w-sm w-full px-4">
          {recordPopups.map((p, i) => (
            <div key={i} className="bg-amber-500 rounded-2xl shadow-2xl px-5 py-4 flex items-start gap-3 animate-bounce-once">
              <div className="w-9 h-9 rounded-xl bg-amber-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Star size={16} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white">
                  {p.isFirst ? 'Nuovo record!' : 'Record superato!'}
                </p>
                <p className="text-xs text-amber-100 mt-0.5 leading-relaxed">
                  {p.isFirst
                    ? <><span className="font-semibold">{p.donatrice}</span> ha raggiunto il record di {p.count} clienti!</>
                    : <><span className="font-semibold">{p.donatrice}</span> ha raggiunto un nuovo record! {p.count} clienti</>}
                </p>
              </div>
              <button
                onClick={() => setRecordPopups(prev => prev.filter((_, j) => j !== i))}
                className="p-1 hover:bg-amber-400 rounded-lg transition-colors text-amber-200 hover:text-white flex-shrink-0"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Modal compleanni */}
      {showBirthdayModal && birthdayClienti.length > 0 && (
        <BirthdayModal
          clienti={birthdayClienti}
          onClose={() => setShowBirthdayModal(false)}
        />
      )}

      {/* Modal promemoria recensioni Google */}
      {showRecensioniModal && user && (
        <RecensioniReminderModal
          userId={user.id}
          onClose={dismissRecensioniReminder}
        />
      )}

      {/* Modal appuntamenti in forse */}
      {showInForseModal && (
        <InForseModal
          clienti={inForseModalClienti}
          onClose={() => setShowInForseModal(false)}
        />
      )}

      <AiChat />

      <Layout key={dbReadyKey} currentPage={page} onNavigate={p => navigateTo(p as Page)} user={user} messaggiBadge={messaggiNonLetti.length} onMessaggioBadgeClick={handleMessaggioBadgeClick}>
        {page === 'dashboard' && (
          <Dashboard onNavigate={p => navigateTo(p as Page)} />
        )}
        {page === 'agenda' && <Agenda selectedDay={agendaSelectedDay} setSelectedDay={handleSetAgendaDay} />}
        {page === 'clienti' && !selectedCliente && (
          <Clienti
            onSelectCliente={handleSelectCliente}
            openSchedaId={schedaIdToOpen}
            onSchedaOpened={() => setSchedaIdToOpen(null)}
          />
        )}
        {page === 'clienti' && selectedCliente && (
          <SchedaCliente
            clienteId={selectedCliente}
            onBack={() => { setSelectedCliente(null); setSelectedClienteTab(undefined); }}
            initialTab={selectedClienteTab}
          />
        )}
        {page === 'servizi' && <Servizi />}
        {page === 'fiches' && <Fiches />}
        {page === 'carte' && <Carte />}
        {page === 'rivendita' && <Rivendita />}
        {page === 'finanze' && (
          <StatisticheGate isActive={page === 'finanze'} chiave="password_finanze" sezione="finanze" sessionKey="fin_unlocked">
            <Finanze />
          </StatisticheGate>
        )}
        {page === 'gestione_finanziaria' && (
          <StatisticheGate isActive={page === 'gestione_finanziaria'} chiave="password_entrate_uscite" sezione="entrate e uscite" sessionKey="entrate_uscite_unlocked">
            <GestioneFinanziaria />
          </StatisticheGate>
        )}
        {page === 'statistiche' && (
          <StatisticheGate isActive={page === 'statistiche'} chiave="password_statistiche" sezione="statistiche" sessionKey="stat_unlocked">
            <Statistiche onSelectCliente={handleSelectCliente} />
          </StatisticheGate>
        )}
        {page === 'comunicazioni' && <Comunicazioni />}
        {page === 'magazzino' && <Magazzino />}
        {page === 'prodotti_online' && <ProdottiOnline />}
        {page === 'parrucchieri' && <Parrucchieri />}
        {page === 'impostazioni' && <Impostazioni onTestReminder={triggerReminderTest} onTestInForse={triggerInForseTest} onTestPromApp={triggerPromAppTest} onTestCompleanno={triggerCompleannoTest} onTestRecensioni={triggerRecensioniTest} />}
        {page === 'cestino' && <Cestino />}
        {page === 'guida' && <Guida />}
      </Layout>
    </>
  );
}
