import { useState, useEffect } from 'react';
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
import StatisticheGate from './components/StatisticheGate';
import BirthdayModal from './components/BirthdayModal';
import Login from './pages/Login';
import ResetPassword from './pages/ResetPassword';
import { supabase } from './lib/supabase';
import { useAuth } from './lib/AuthContext';
import { Bell, X, MessageSquare, Scissors, Wifi, RefreshCw, ClipboardList } from 'lucide-react';
import AiChat from './components/AiChat';
import { isElectron, setCurrentUserId, registerPushRowNow, setElectronDbReady } from './lib/localDb';
import { syncSupabaseToLocal, syncLocalToSupabase, pushRowNow, prefetchToIndexedDb } from './lib/sync';
import { flushPendingSync } from './lib/offlineFetch';

// Registra il push immediato una volta sola al caricamento del modulo
registerPushRowNow(pushRowNow);

type Page = 'dashboard' | 'agenda' | 'clienti' | 'servizi' | 'fiches' | 'finanze' | 'gestione_finanziaria' | 'statistiche' | 'comunicazioni' | 'impostazioni' | 'carte' | 'rivendita' | 'magazzino' | 'parrucchieri' | 'cestino' | 'guida';

interface ClienteCompleanno {
  id: string;
  nome: string;
  cognome: string;
  telefono: string | null;
}

export default function App() {
  const { user, loading } = useAuth();
  const [page, setPage] = useState<Page>('dashboard');
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [selectedCliente, setSelectedCliente] = useState<string | null>(null);
  const [agendaSelectedDay, setAgendaSelectedDay] = useState<Date | null>(null);

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
    setPage(p);
    if (p !== 'clienti') setSelectedCliente(null);
  }

  // Banner promemoria fiches (orario configurato)
  const [showReminderBanner, setShowReminderBanner] = useState(false);

  // Banner promemoria invio messaggi appuntamento (all'avvio)
  const [showAppBanner, setShowAppBanner] = useState(false);

  // Modal compleanni
  const [birthdayClienti, setBirthdayClienti] = useState<ClienteCompleanno[]>([]);
  const [showBirthdayModal, setShowBirthdayModal] = useState(false);

  // Banner nuova scheda cliente da confermare
  const [showNuovaSchedaBanner, setShowNuovaSchedaBanner] = useState(false);
  const [nuovaSchedaNome, setNuovaSchedaNome] = useState('');
  const [nuovaSchedaCurrentId, setNuovaSchedaCurrentId] = useState<string | null>(null);

  // Popup ping automatico keepalive
  const [showKeepAlivePopup, setShowKeepAlivePopup] = useState(false);
  const [keepAlivePopupTs, setKeepAlivePopupTs] = useState<string | null>(null);

  const [electronDbReady, setElectronDbReadyState] = useState(false);
  const hasFicheNonConvalidateRef = { current: false };

  function getReminderKey(todayKey: string, orario: string) {
    return `promemoria_shown_${todayKey}_${orario}`;
  }

  function triggerReminderTest() {
    setShowReminderBanner(true);
  }

  function handleSelectCliente(id: string) {
    setSelectedCliente(id);
    setPage('clienti');
  }

  // Avviso invio appuntamenti e compleanni — eseguito una volta al caricamento
  useEffect(() => {
    async function checkStartupAlerts() {
      const now = new Date();
      const romeStr = now.toLocaleString('sv-SE', { timeZone: 'Europe/Rome' });
      const todayKey = romeStr.split(' ')[0]; // yyyy-mm-dd

      // 1. Banner "ricorda di inviare i messaggi appuntamento" — solo prima delle 11:00 ora italiana
      const romeTimePart = romeStr.split(' ')[1]; // HH:mm:ss
      const romeHour = parseInt(romeTimePart.split(':')[0], 10);
      if (romeHour < 11) {
        setShowAppBanner(true);
      }

      // 2. Popup ping automatico keepalive (mostrato una volta per ping — chiave = timestamp del ping)
      const [{ data: kaPing }, { data: kaTipo }] = await Promise.all([
        supabase.from('impostazioni').select('valore').eq('chiave', 'keep_alive_last_ping').maybeSingle(),
        supabase.from('impostazioni').select('valore').eq('chiave', 'keep_alive_last_ping_tipo').maybeSingle(),
      ]);
      if (kaTipo?.valore === 'automatico' && kaPing?.valore) {
        const kaShownKey = `keepalive_popup_shown_${kaPing.valore}`;
        if (!localStorage.getItem(kaShownKey)) {
          localStorage.setItem(kaShownKey, '1');
          setKeepAlivePopupTs(kaPing.valore);
          setTimeout(() => setShowKeepAlivePopup(true), 1200);
        }
      }

      // 3. Compleanni del giorno — mostrato ad ogni apertura dell'app
      const [month, day] = todayKey.split('-').slice(1).map(Number);
      const { data } = await supabase
        .from('clienti')
        .select('id, nome, cognome, telefono, data_nascita')
        .not('data_nascita', 'is', null);

      const compleanni = ((data || []) as { id: string; nome: string; cognome: string; telefono: string | null; data_nascita: string }[])
        .filter(c => {
          const parts = c.data_nascita.split('-');
          return parseInt(parts[1], 10) === month && parseInt(parts[2], 10) === day;
        })
        .map(c => ({ id: c.id, nome: c.nome, cognome: c.cognome, telefono: c.telefono }));

      if (compleanni.length > 0) {
        setBirthdayClienti(compleanni);
        setTimeout(() => setShowBirthdayModal(true), 800);
      }
    }

    checkStartupAlerts();
  }, []);

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
    });
  }, []);

  // Imposta userId corrente per il push immediato in localDb
  useEffect(() => {
    setCurrentUserId(user?.id ?? null);
  }, [user]);

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

    if (navigator.onLine) doPrefetch();

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

  // Sync SQLite <-> Supabase all'avvio (solo se SQLite disponibile e DB pronto)
  useEffect(() => {
    if (!user || !electronDbReady || !isElectron()) return;
    const userId = user.id;
    let cancelled = false;

    async function doSync() {
      if (!navigator.onLine || cancelled) return;
      try {
        // Prima carica le modifiche locali su Supabase, poi scarica
        // (così Supabase ha già i dati aggiornati quando si tira giù)
        await syncLocalToSupabase(userId);
        if (cancelled) return;
        await syncSupabaseToLocal(userId);
      } catch (e) {
        console.warn('[Sync] Errore sync:', e);
      }
    }

    doSync();
    // Retry ogni 5 minuti per recuperare eventuali dirty rimaste
    const interval = setInterval(() => { doSync(); }, 5 * 60 * 1000);
    // Sync immediato al ritorno online (copre il caso app avviata offline)
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
      const [{ data: gData, error: gErr }, { data: oData, error: oErr }] = await Promise.all([
        supabase.from('impostazioni').select('valore').eq('chiave', 'promemoria_convalida_giorni').maybeSingle(),
        supabase.from('impostazioni').select('valore').eq('chiave', 'promemoria_convalida_orario').maybeSingle(),
      ]);

      if (gErr) console.error('[Promemoria] errore lettura giorni:', gErr);
      if (oErr) console.error('[Promemoria] errore lettura orario:', oErr);

      let giorni: number[] = [1, 2, 3, 4, 5, 6];
      let orario = '20:00';
      try { if (gData?.valore) giorni = JSON.parse(gData.valore); } catch { /* keep default */ }
      if (oData?.valore) orario = oData.valore;

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

  // Helpers localStorage per schede già mostrate
  function getSchedeDismissed(): Set<string> {
    try { return new Set(JSON.parse(localStorage.getItem('nuova_scheda_dismissed') || '[]')); }
    catch { return new Set(); }
  }
  function markSchedaDismissed(id: string) {
    const s = getSchedeDismissed();
    s.add(id);
    localStorage.setItem('nuova_scheda_dismissed', JSON.stringify([...s]));
  }

  function mostraSchedaBanner(id: string, nome: string, cognome: string) {
    const n = [nome, cognome].filter(Boolean).join(' ') || 'Una cliente';
    setNuovaSchedaCurrentId(id);
    setNuovaSchedaNome(n);
    setShowNuovaSchedaBanner(true);
  }

  async function checkAndShowPendingScheda() {
    const dismissed = getSchedeDismissed();
    const { data } = await supabase
      .from('schede_clienti_da_confermare')
      .select('id, nome, cognome')
      .eq('stato', 'in_attesa')
      .order('created_at', { ascending: false });
    const unseen = (data || []).find(r => !dismissed.has(r.id));
    if (unseen) mostraSchedaBanner(unseen.id, unseen.nome, unseen.cognome);
  }

  function dismissSchedaBanner() {
    if (nuovaSchedaCurrentId) markSchedaDismissed(nuovaSchedaCurrentId);
    setShowNuovaSchedaBanner(false);
    setNuovaSchedaCurrentId(null);
    // Controlla se ci sono altre schede pendenti non ancora viste
    setTimeout(checkAndShowPendingScheda, 400);
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
          const row = payload.new as { id?: string; nome?: string; cognome?: string };
          if (row.id) {
            const dismissed = getSchedeDismissed();
            if (!dismissed.has(row.id)) {
              mostraSchedaBanner(row.id, row.nome ?? '', row.cognome ?? '');
            }
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
      {/* Banner promemoria convalida fiches (orario configurato) */}
      {showReminderBanner && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] w-full max-w-md px-4">
          <div className="bg-amber-50 border border-amber-300 rounded-2xl shadow-xl px-5 py-4 flex items-start gap-3">
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
        </div>
      )}

      {/* Banner nuova scheda cliente da confermare */}
      {showNuovaSchedaBanner && (
        <div
          className="fixed left-1/2 -translate-x-1/2 z-[101] w-full max-w-md px-4 transition-all duration-300"
          style={{ top: showReminderBanner ? '6rem' : '1rem' }}
        >
          <div className="bg-pink-50 border border-pink-300 rounded-2xl shadow-xl px-5 py-4 flex items-start gap-3 animate-bounce-once">
            <div className="w-9 h-9 rounded-xl bg-pink-100 flex items-center justify-center flex-shrink-0 mt-0.5">
              <ClipboardList size={16} className="text-pink-500" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-pink-900">Nuova scheda da confermare!</p>
              <p className="text-xs text-pink-700 mt-0.5">
                <span className="font-semibold">{nuovaSchedaNome}</span> ha inviato i suoi dati tramite il form. Vai su Clienti per confermarla.
              </p>
            </div>
            <button
              onClick={dismissSchedaBanner}
              className="p-1 hover:bg-pink-100 rounded-lg transition-colors text-pink-400 hover:text-pink-600 flex-shrink-0"
            >
              <X size={15} />
            </button>
          </div>
        </div>
      )}

      {/* Banner promemoria invio messaggi appuntamento (all'avvio) */}
      {showAppBanner && (
        <div className={`fixed left-1/2 -translate-x-1/2 z-[99] w-full max-w-md px-4 transition-all duration-300 ${showReminderBanner ? 'top-24' : 'top-4'}`}>
          <div className="bg-sky-50 border border-sky-300 rounded-2xl shadow-xl px-5 py-4 flex items-start gap-3">
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
        </div>
      )}

      {/* Popup ping automatico keepalive */}
      {showKeepAlivePopup && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="bg-red-600 px-6 py-5 flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <RefreshCw size={20} className="text-white" />
              </div>
              <div>
                <p className="text-base font-bold text-white">Ping automatico eseguito</p>
                <p className="text-xs text-red-100 mt-0.5">Keep-alive Supabase</p>
              </div>
            </div>
            <div className="px-6 py-5 space-y-4">
              <p className="text-sm text-stone-600 leading-relaxed">
                Il sistema ha eseguito automaticamente un ping a Supabase per mantenere il database attivo.
              </p>
              {keepAlivePopupTs && (
                <div className="flex items-center gap-2 bg-stone-50 border border-stone-200 rounded-xl px-4 py-3">
                  <Wifi size={14} className="text-stone-400 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-stone-700">
                      {new Date(keepAlivePopupTs).toLocaleString('it-IT', {
                        day: '2-digit', month: 'long', year: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </p>
                    <p className="text-[11px] text-stone-400 mt-0.5">Orario dell'ultimo ping automatico</p>
                  </div>
                </div>
              )}
              <button
                onClick={() => setShowKeepAlivePopup(false)}
                className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold text-sm rounded-xl transition-colors"
              >
                Ho capito
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal compleanni */}
      {showBirthdayModal && birthdayClienti.length > 0 && (
        <BirthdayModal
          clienti={birthdayClienti}
          onClose={() => setShowBirthdayModal(false)}
        />
      )}

      <AiChat />

      <Layout currentPage={page} onNavigate={p => navigateTo(p as Page)} user={user}>
        {page === 'dashboard' && (
          <Dashboard onNavigate={p => navigateTo(p as Page)} />
        )}
        {page === 'agenda' && <Agenda selectedDay={agendaSelectedDay} setSelectedDay={handleSetAgendaDay} />}
        {page === 'clienti' && !selectedCliente && (
          <Clienti onSelectCliente={handleSelectCliente} />
        )}
        {page === 'clienti' && selectedCliente && (
          <SchedaCliente
            clienteId={selectedCliente}
            onBack={() => setSelectedCliente(null)}
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
        {page === 'parrucchieri' && <Parrucchieri />}
        {page === 'impostazioni' && <Impostazioni onTestReminder={triggerReminderTest} />}
        {page === 'cestino' && <Cestino />}
        {page === 'guida' && <Guida />}
      </Layout>
    </>
  );
}
