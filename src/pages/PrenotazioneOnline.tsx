import { useEffect, useState, useCallback } from 'react';
import { Calendar, Clock, ChevronRight, ChevronLeft, Check, X, Scissors, User, Phone, Download, Share } from 'lucide-react';

const EDGE_URL = `${import.meta.env.VITE_SUPABASE_URL ?? 'https://cfsourwsjhhriytkdnuw.supabase.co'}/functions/v1/prenota-online`;

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

type Step = 'dati' | 'parrucchiere' | 'data' | 'ora' | 'servizio' | 'abbinato' | 'riepilogo' | 'successo';

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

  // Calendar nav
  const [calMonth, setCalMonth] = useState(new Date());

  // Submit
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

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

  async function loadParrLiberi(data: string, ora: string, durata: number, escludiId: string) {
    setLoadingParr2(true);
    setParrLiberi([]);
    try {
      const startMin = parseInt(ora.split(':')[0]) * 60 + parseInt(ora.split(':')[1]);
      const endTime = `${pad(Math.floor((startMin + durata) / 60))}:${pad((startMin + durata) % 60)}`;
      const res = await fetch(`${EDGE_URL}/parrucchieri-liberi?user_id=${userId}&data=${data}&ora=${endTime}&durata_minuti=${durata}&escludi_id=${escludiId}`);
      const d = await res.json();
      setParrLiberi(d.parrucchieri ?? []);
    } catch {
      setParrLiberi([]);
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
    setStep('parrucchiere');
  }

  function handleParrucchiereSelect(p: Parrucchiere) {
    setParrucchiere(p);
    setDataSelezionata('');
    setOraSelezionata('');
    setServizio(null);
    setParrucchiere2(null);
    setCalMonth(new Date());
    setStep('data');
  }

  function handleDataSelect(d: string) {
    if (d < todayStr()) return;
    setDataSelezionata(d);
    setOraSelezionata('');
    setServizio(null);
    setParrucchiere2(null);
    setStep('ora_servizio');
    // We go to servizio selection first, then load slots
    setStep('servizio');
  }

  function handleServizioSelect(s: Servizio) {
    setServizio(s);
    setOraSelezionata('');
    setParrucchiere2(null);
    if (parrucchiere && dataSelezionata) {
      loadSlots(parrucchiere.id, dataSelezionata, s.durata_minuti);
    }
    setStep('ora');
  }

  async function handleOraSelect(ora: string) {
    setOraSelezionata(ora);
    if (!servizio) return;

    if (servizio.servizio_abbinato_online_id) {
      // Look in both main servizi and serviziAbbinati (abbinati may not be booking-enabled)
      const servAbbinato =
        info?.servizi.find(s => s.id === servizio!.servizio_abbinato_online_id) ??
        info?.serviziAbbinati?.find(s => s.id === servizio!.servizio_abbinato_online_id);
      if (servAbbinato && parrucchiere && dataSelezionata) {
        // Pass abbinato duration so second hairdresser is checked for the right slot length
        await loadParrLiberi(dataSelezionata, ora, servAbbinato.durata_minuti, parrucchiere.id);
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
        {step !== 'successo' && (
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
                      <span>€ {s.prezzo.toFixed(2)}</span>
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
            subtitle={`Inizia alle ${
              (() => {
                const [h,m] = oraSelezionata.split(':').map(Number);
                const tot = h*60 + m + servizio!.durata_minuti;
                return `${pad(Math.floor(tot/60))}:${pad(tot%60)}`;
              })()
            }`}
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
            <button
              onClick={() => {
                setStep('dati');
                setParrucchiere(null);
                setDataSelezionata('');
                setOraSelezionata('');
                setServizio(null);
                setParrucchiere2(null);
              }}
              className="px-8 py-3 bg-stone-800 text-white font-medium rounded-2xl hover:bg-stone-900 transition-colors"
            >
              Nuova prenotazione
            </button>
          </div>
        )}
      </div>
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


