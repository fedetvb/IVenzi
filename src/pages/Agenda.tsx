import { useEffect, useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Plus, CreditCard as Edit2, Trash2, CreditCard, Clock, Bell, MessageCircle, X, AlertCircle, Gift, HelpCircle, Check, MapPin, Save } from 'lucide-react';
import { supabase, type Appuntamento } from '../lib/supabase';
import { dbSelect, dbSelectWithRelated, dbDelete, getImpostazione, setImpostazione } from '../lib/localDb';
import MultiBookModal from '../components/MultiBookModal';
import AgendaGiorno from './AgendaGiorno';
import BirthdayModal from '../components/BirthdayModal';
import { apriWhatsApp, apriWhatsAppWeb, type WaMode } from '../lib/waUtils';
import { type ClienteInForseEntry, loadAvvisoInForse, InForseModal } from '../components/InForseModal';

function useItalianTime() {
  const fmt = new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const [time, setTime] = useState(() => fmt.format(new Date()));
  useEffect(() => {
    const id = setInterval(() => setTime(fmt.format(new Date())), 1000);
    return () => clearInterval(id);
  }, []);
  return time;
}

const HOURS = Array.from({ length: 13 }, (_, i) => i + 8); // 8-20

const STATO_COLORS: Record<string, string> = {
  confermato: 'bg-blue-500',
  in_attesa: 'bg-amber-400',
  completato: 'bg-emerald-500',
  cancellato: 'bg-stone-400',
  in_forse: 'bg-slate-400',
};

const STATO_LABEL: Record<string, string> = {
  confermato: 'Confermato',
  in_attesa: 'In attesa',
  completato: 'Completato',
  cancellato: 'Cancellato',
  in_forse: 'In forse',
};

function startOfWeek(d: Date) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

interface AgendaProps {
  selectedDay: Date | null;
  setSelectedDay: (d: Date | null) => void;
}

export default function Agenda({ selectedDay, setSelectedDay }: AgendaProps) {
  const oraItaliana = useItalianTime();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [appuntamenti, setAppuntamenti] = useState<Appuntamento[]>([]);
  const [clientiConCarte, setClientiConCarte] = useState<Set<string>>(new Set());
  const [clientiConFicheConvalidate, setClientiConFicheConvalidate] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [clickedDate, setClickedDate] = useState<Date | undefined>();
  const [multiModal, setMultiModal] = useState(false);
  const [avvisoModal, setAvvisoModal] = useState(false);
  const [avvisoClienti, setAvvisoClienti] = useState<{ nome: string; telefono: string; ora: string; data: string; appuntamento_id: string; promemoria_inviato_at: string | null }[]>([]);
  const [avvisoTemplate, setAvvisoTemplate] = useState('');
  const [avvisoIndirizzo, setAvvisoIndirizzo] = useState('');
  const [avvisoLoading, setAvvisoLoading] = useState(false);
  const [birthdayClienti, setBirthdayClienti] = useState<{ id: string; nome: string; cognome: string; telefono: string | null }[]>([]);
  const [showBirthdayModal, setShowBirthdayModal] = useState(false);
  const [whatsappDisabilitato, setWhatsappDisabilitato] = useState(false);
  const [avvisoAppuntamentiVisibile, setAvvisoAppuntamentiVisibile] = useState(false);
  const [inForseClienti, setInForseClienti] = useState<ClienteInForseEntry[]>([]);
  const [showInForseBanner, setShowInForseBanner] = useState(false);
  const [showInForseModal, setShowInForseModal] = useState(false);

  useEffect(() => {
    const checkAvviso = () => {
      const disab = localStorage.getItem('loc_avviso_wa_disabilitato');
      if (disab === 'true') { setAvvisoAppuntamentiVisibile(false); return; }
      const orario = localStorage.getItem('loc_avviso_appuntamenti_orario') ?? '17:00';
      const now = new Date();
      const hh = String(now.toLocaleString('en-GB', { timeZone: 'Europe/Rome', hour: '2-digit', hour12: false })).padStart(2, '0');
      const mm = String(now.toLocaleString('en-GB', { timeZone: 'Europe/Rome', minute: '2-digit' })).padStart(2, '0');
      const nowIt = `${hh}:${mm}`;
      setAvvisoAppuntamentiVisibile(nowIt >= orario);
    };
    checkAvviso();
    const id = setInterval(checkAvviso, 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const fmt = new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit' });
    let lastFiredMinute = '';
    const check = async () => {
      const attivo = await getImpostazione('banner_in_forse_attivo');
      if (attivo === 'false') return;
      const orario = await getImpostazione('orario_avviso_in_forse') ?? '18:00';
      const nowIt = fmt.format(new Date());
      if (nowIt !== orario) return;
      if (lastFiredMinute === nowIt) return;
      lastFiredMinute = nowIt;
      const dopodomani = addDays(new Date(), 2);
      const ddKey = dopodomani.toLocaleString('sv-SE', { timeZone: 'Europe/Rome' }).split(' ')[0];
      const lsKey = `avviso_in_forse_shown_${ddKey}`;
      if (localStorage.getItem(lsKey)) return;
      const entries = await loadAvvisoInForse();
      if (entries.length === 0) return;
      localStorage.setItem(lsKey, '1');
      setInForseClienti(entries);
      setShowInForseBanner(true);
    };
    check();
    const id = setInterval(check, 20_000);
    return () => clearInterval(id);
  }, []);

  async function loadAvvisoClienti() {
    setAvvisoLoading(true);
    const domani = addDays(new Date(), 1);
    const romeStr = domani.toLocaleString('sv-SE', { timeZone: 'Europe/Rome' });
    const domaniKey = romeStr.split(' ')[0];
    const start = new Date(domaniKey + 'T00:00:00').toISOString();
    const end = new Date(domaniKey + 'T23:59:59').toISOString();
    const dataLabel = domani.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Rome' });

    const [appRes, tmplRes, indirizzoRes] = await Promise.all([
      dbSelectWithRelated({
        table: 'appuntamenti',
        columns: 'id, data_ora, stato, cliente_id, deleted_at, promemoria_inviato_at',
        filters: [
          { col: 'data_ora', op: 'gte', val: start },
          { col: 'data_ora', op: 'lte', val: end },
          { col: 'stato', op: 'neq', val: 'cancellato' },
          { col: 'deleted_at', op: 'is_null' }
        ],
        orderBy: [{ col: 'data_ora' }],
        relations: [
          { key: 'clienti', table: 'clienti', fk: 'cliente_id', columns: 'id, nome, telefono' }
        ],
        supabaseSelect: 'id, data_ora, stato, promemoria_inviato_at, clienti(id, nome, telefono)'
      }),
      dbSelect({ table: 'impostazioni', columns: 'valore', filters: [{ col: 'chiave', op: 'eq', val: 'messaggio_avviso_appuntamento' }] }),
      dbSelect({ table: 'impostazioni', columns: 'valore', filters: [{ col: 'chiave', op: 'eq', val: 'avviso_appuntamento_indirizzo' }] })
    ]);

    const template = tmplRes.data?.[0]?.valore ?? `Ciao {nome} ti ricordiamo l'appuntamento di domani {data} alle ore {ora} presso il nostro salone in via Palermo 15 Roma, ti aspettiamo!\n\nI Venzi.`;
    const indirizzo = indirizzoRes.data?.[0]?.valore ?? 'via Palermo 15, Roma';

    const clientiMap: Record<string, { nome: string; telefono: string; ora: string; data: string; appuntamento_id: string; promemoria_inviato_at: string | null }> = {};
    for (const app of (appRes.data || []).filter((a: { stato?: string }) => a.stato !== 'in_forse')) {
      const c = app.clienti as { id: string; nome: string; telefono?: string } | null;
      if (!c || !c.telefono?.trim()) continue;
      if (clientiMap[c.id]) continue;
      const ora = new Date(app.data_ora).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' });
      clientiMap[c.id] = { nome: c.nome, telefono: c.telefono.trim(), ora, data: dataLabel, appuntamento_id: app.id, promemoria_inviato_at: app.promemoria_inviato_at ?? null };
    }

    setAvvisoTemplate(template);
    setAvvisoIndirizzo(indirizzo);
    setAvvisoClienti(Object.values(clientiMap));
    setAvvisoLoading(false);
    setAvvisoModal(true);
  }

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const loadAppuntamenti = useCallback(async () => {
    setLoading(true);
    const from = weekStart.toISOString();
    const to = addDays(weekStart, 7).toISOString();
    const [appRes, scRes, prRes] = await Promise.all([
      dbSelectWithRelated({
        table: 'appuntamenti',
        columns: '*',
        filters: [
          { col: 'data_ora', op: 'gte', val: from },
          { col: 'data_ora', op: '<', val: to },
          { col: 'deleted_at', op: 'is_null' }
        ],
        orderBy: [{ col: 'data_ora' }],
        relations: [
          { key: 'clienti', table: 'clienti', fk: 'cliente_id', columns: 'id, nome, cognome' }
        ],
        supabaseSelect: '*, clienti(nome, cognome, id)'
      }),
      dbSelect({ table: 'carte_sconto', columns: 'cliente_id', filters: [{ col: 'cliente_id', op: 'not_null' }, { col: 'attiva', op: 'eq', val: true }, { col: 'deleted_at', op: 'is_null' }] }),
      dbSelect({ table: 'carte_premium', columns: 'cliente_id', filters: [{ col: 'deleted_at', op: 'is_null' }, { col: 'attiva', op: 'eq', val: true }] })
    ]);
    setAppuntamenti((appRes.data || []) as Appuntamento[]);
    const ids = new Set<string>();
    for (const r of [...(scRes.data || []), ...(prRes.data || [])]) {
      if (r.cliente_id) ids.add(r.cliente_id);
    }
    setClientiConCarte(ids);

    const { data: ficheConv } = await dbSelect({ table: 'fiches', columns: 'appuntamento_id, cliente_id', filters: [{ col: 'convalidata', op: 'eq', val: true }] });
    const ficheList = (ficheConv || []) as { appuntamento_id: string | null; cliente_id: string | null }[];
    const clientiConFiche = new Set<string>();
    // fiches manuali: hanno cliente_id diretto
    for (const f of ficheList) {
      if (f.cliente_id) clientiConFiche.add(f.cliente_id);
    }
    // fiches collegate ad appuntamento: risali al cliente tramite appuntamento_id
    const appIdsConFiche = ficheList.map(f => f.appuntamento_id).filter(Boolean) as string[];
    if (appIdsConFiche.length > 0) {
      const { data: appsConFiche } = await dbSelect({ table: 'appuntamenti', columns: 'cliente_id', filters: [{ col: 'id', op: 'in', val: appIdsConFiche }] });
      for (const a of (appsConFiche || []) as { cliente_id: string | null }[]) {
        if (a.cliente_id) clientiConFiche.add(a.cliente_id);
      }
    }
    setClientiConFicheConvalidate(clientiConFiche);

    setLoading(false);
  }, [weekStart]);

  useEffect(() => { loadAppuntamenti(); }, [loadAppuntamenti]);

  useEffect(() => {
    const fmt = new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit' });
    const today = new Date();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');

    const checkBirthdays = async () => {
      const attivo = await getImpostazione('banner_compleanno_attivo');
      if (attivo === 'false') return;
      const orario = await getImpostazione('banner_compleanno_orario') ?? '09:00';
      const nowIt = fmt.format(new Date());
      if (nowIt < orario) return;
      dbSelect({
        table: 'clienti',
        columns: 'id, nome, cognome, telefono, data_nascita',
        filters: [{ col: 'data_nascita', op: 'not_null' }]
      }).then((res) => {
        const nati = ((res.data || []) as { id: string; nome: string; cognome: string; telefono: string | null; data_nascita: string }[])
          .filter(c => {
            const [, m, d] = c.data_nascita.split('-');
            return m === mm && d === dd;
          });
        setBirthdayClienti(nati);
      });
    };
    checkBirthdays();
    const id = setInterval(checkBirthdays, 60_000);
    return () => clearInterval(id);
  }, []);

  async function deleteAppuntamento(id: string) {
    await dbDelete({ table: 'appuntamenti', filters: [{ col: 'id', op: 'eq', val: id }] });
    setConfirmDelete(null);
    loadAppuntamenti();
  }

  function openNew(day: Date, hour: number) {
    const d = new Date(day);
    d.setHours(hour, 0, 0, 0);
    setClickedDate(d);
    setEditId(null);
    setShowModal(true);
  }

  function openEdit(id: string) {
    setEditId(id);
    setClickedDate(undefined);
    setShowModal(true);
  }

  function getAppForSlot(day: Date, hour: number) {
    return appuntamenti.filter(app => {
      const d = new Date(app.data_ora);
      return isSameDay(d, day) && d.getHours() === hour;
    });
  }

  const oggi = new Date();

  if (selectedDay) {
    return <AgendaGiorno date={selectedDay} onBack={() => setSelectedDay(null)} />;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 sm:px-6 py-1.5 sm:py-2 bg-white border-b border-stone-200 flex-shrink-0 gap-2">
        <div className="flex items-center gap-1.5 sm:gap-3">
          <button onClick={() => setWeekStart(w => startOfWeek(addDays(w, -7)))} className="p-1.5 rounded-lg hover:bg-stone-100 transition-colors">
            <ChevronLeft size={18} />
          </button>
          <span className="text-xs sm:text-sm font-semibold text-stone-700 text-center hidden sm:inline min-w-[180px]">
            {weekStart.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })} –{' '}
            {addDays(weekStart, 6).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })}
          </span>
          <span className="text-xs font-semibold text-stone-700 text-center sm:hidden">
            {weekStart.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })} –{' '}
            {addDays(weekStart, 6).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}
          </span>
          <button onClick={() => setWeekStart(w => startOfWeek(addDays(w, 7)))} className="p-1.5 rounded-lg hover:bg-stone-100 transition-colors">
            <ChevronRight size={18} />
          </button>
          <button onClick={() => setWeekStart(startOfWeek(new Date()))} className="text-xs px-2.5 py-1.5 bg-stone-100 rounded-lg hover:bg-stone-200 transition-colors font-medium">
            Oggi
          </button>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-4">
          <div className="hidden sm:flex items-center gap-1.5 text-stone-500">
            <Clock size={14} />
            <span className="text-sm font-semibold tabular-nums">{oraItaliana}</span>
          </div>
          {avvisoAppuntamentiVisibile && (
            <button
              onClick={loadAvvisoClienti}
              disabled={avvisoLoading}
              className="flex items-center gap-2 bg-emerald-600 text-white px-2.5 sm:px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-60"
            >
              <Bell size={15} />
              <span className="hidden sm:inline">Avviso appuntamento clienti</span>
            </button>
          )}
          <button
            onClick={() => setMultiModal(true)}
            className="flex items-center gap-2 bg-amber-500 text-white px-2.5 sm:px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-600 transition-colors"
          >
            <Plus size={16} />
            <span className="hidden sm:inline">Nuovo appuntamento</span>
          </button>
        </div>
      </div>

      {/* Banner appuntamenti in forse */}
      {showInForseBanner && inForseClienti.length > 0 && (
        <div className="px-6 py-2.5 bg-amber-50 border-b border-amber-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <HelpCircle size={14} className="text-amber-500 flex-shrink-0" />
            <p className="text-sm text-amber-700 font-semibold truncate">
              {inForseClienti.length === 1
                ? `1 appuntamento in forse tra 2 giorni — chiedi conferma a ${inForseClienti[0].nome}`
                : `${inForseClienti.length} clienti con appuntamento in forse tra 2 giorni`}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={async () => {
                if (inForseClienti.length === 0) {
                  const entries = await loadAvvisoInForse();
                  setInForseClienti(entries);
                }
                setShowInForseModal(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold transition-colors"
            >
              <MessageCircle size={12} />
              Invia conferma
            </button>
            <button onClick={() => setShowInForseBanner(false)} className="p-1 hover:bg-amber-100 rounded-lg transition-colors">
              <X size={14} className="text-amber-500" />
            </button>
          </div>
        </div>
      )}

      {/* Banner compleanni */}
      {birthdayClienti.length > 0 && (
        <div className="px-6 py-2.5 bg-rose-50 border-b border-rose-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Gift size={14} className="text-rose-500 flex-shrink-0" />
            <p className="text-sm text-rose-700 font-semibold truncate">
              {birthdayClienti.length === 1
                ? `Oggi è il compleanno di ${birthdayClienti[0].nome} ${birthdayClienti[0].cognome}!`
                : `Oggi ${birthdayClienti.length} clienti compiono gli anni: ${birthdayClienti.map(c => c.nome).join(', ')}`}
            </p>
          </div>
          <button
            onClick={() => setShowBirthdayModal(true)}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-600 text-white text-xs font-semibold transition-colors"
          >
            <Gift size={12} />
            Invia auguri
          </button>
        </div>
      )}

      {/* Calendar grid */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-7 h-7 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="min-w-[800px]">
            {/* Day headers */}
            <div className="grid sticky top-0 bg-white z-10 border-b border-stone-200" style={{ gridTemplateColumns: '60px repeat(7, 1fr)' }}>
              <div />
              {weekDays.map((day, i) => {
                const isToday = isSameDay(day, oggi);
                return (
                  <button
                    key={i}
                    onClick={() => setSelectedDay(day)}
                    className={`text-center py-3 border-l border-stone-100 hover:bg-stone-50 transition-colors cursor-pointer group ${isToday ? 'bg-amber-50' : ''}`}
                  >
                    <p className="text-xs text-stone-400 font-medium uppercase">
                      {day.toLocaleDateString('it-IT', { weekday: 'short' })}
                    </p>
                    <p className={`text-lg font-bold mt-0.5 ${isToday ? 'text-amber-600' : 'text-stone-700'}`}>
                      {day.getDate()}
                    </p>
                    <p className="text-xs text-stone-300 group-hover:text-amber-500 transition-colors">Visualizza</p>
                  </button>
                );
              })}
            </div>

            {/* Time slots */}
            {HOURS.map(hour => (
              <div key={hour} className="grid border-b border-stone-100" style={{ gridTemplateColumns: '60px repeat(7, 1fr)', minHeight: '64px' }}>
                <div className="flex items-start justify-end pr-3 pt-1.5">
                  <span className="text-xs text-stone-400">{hour}:00</span>
                </div>
                {weekDays.map((day, di) => {
                  const apps = getAppForSlot(day, hour);
                  const isToday = isSameDay(day, oggi);
                  return (
                    <div
                      key={di}
                      className={`border-l border-stone-100 p-1 group relative cursor-pointer hover:bg-stone-50 transition-colors ${isToday ? 'bg-amber-50/40' : ''}`}
                      onClick={() => apps.length === 0 && openNew(day, hour)}
                    >
                      {apps.length === 0 && (
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <Plus size={14} className="text-stone-300" />
                        </div>
                      )}
                      {apps.map(app => {
                        const cliente = (app as Appuntamento & { clienti?: { nome: string; cognome: string; id?: string } }).clienti;
                        const isCancellato = app.stato === 'cancellato';
                        const isInForse = app.stato === 'in_forse';
                        const colorClass = STATO_COLORS[app.stato] ?? STATO_COLORS.confermato;
                        const hasCarta = cliente && (cliente as { id?: string }).id && clientiConCarte.has((cliente as { id: string }).id);
                        return (
                          <div
                            key={app.id}
                            onClick={e => { e.stopPropagation(); if (confirmDelete === app.id) { setConfirmDelete(null); } else { openEdit(app.id); } }}
                            className={`${colorClass} text-white rounded-md px-2 py-1 text-xs mb-1 cursor-pointer group/app relative overflow-hidden ${isCancellato ? 'opacity-70' : ''}`}
                            style={isCancellato ? { backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(0,0,0,0.15) 5px, rgba(0,0,0,0.15) 7px)' } : undefined}
                          >
                            {isInForse && (
                              <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.45) 1.5px, transparent 1.5px)', backgroundSize: '7px 7px' }} />
                            )}
                            <div className="relative flex items-start justify-between gap-1">
                              <div className="min-w-0">
                                <p className={`font-semibold truncate flex items-center gap-1 ${isCancellato ? 'line-through opacity-80' : ''}`}>
                                  {cliente ? `${cliente.nome} ${cliente.cognome}` : '—'}
                                  {hasCarta && <CreditCard size={9} className="opacity-80 flex-shrink-0 inline" />}
                                  {app.cliente_id && !clientiConFicheConvalidate.has(app.cliente_id) && <span className="text-[8px] font-bold bg-white/25 rounded px-1 flex-shrink-0 leading-tight">Nuova</span>}
                                  {isInForse && <span className="text-[8px] font-bold bg-white/25 rounded px-1 flex-shrink-0 leading-tight">In forse</span>}
                                </p>
                                <p className="opacity-80">{new Date(app.data_ora).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })} · {app.durata_minuti}min</p>
                              </div>
                              <div className="flex gap-0.5 opacity-0 group-hover/app:opacity-100 transition-opacity flex-shrink-0">
                                {confirmDelete === app.id ? (
                                  <>
                                    <button
                                      onClick={e => { e.stopPropagation(); deleteAppuntamento(app.id); }}
                                      className="bg-red-600 hover:bg-red-700 rounded px-1.5 py-0.5 text-white text-[9px] font-bold"
                                    >
                                      Si
                                    </button>
                                    <button
                                      onClick={e => { e.stopPropagation(); setConfirmDelete(null); }}
                                      className="hover:bg-white/20 rounded px-1.5 py-0.5 text-[9px] font-bold"
                                    >
                                      No
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      onClick={e => { e.stopPropagation(); openEdit(app.id); }}
                                      className="hover:bg-white/20 rounded p-0.5"
                                    >
                                      <Edit2 size={10} />
                                    </button>
                                    <button
                                      onClick={e => { e.stopPropagation(); setConfirmDelete(app.id); }}
                                      className="hover:bg-white/20 rounded p-0.5"
                                    >
                                      <Trash2 size={10} />
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="hidden sm:flex items-center gap-4 px-6 py-2 bg-white border-t border-stone-200 flex-shrink-0">
        {Object.entries(STATO_COLORS).map(([stato, cls]) => (
          <div key={stato} className="flex items-center gap-1.5">
            <div className={`w-3 h-3 rounded-full ${cls}`} />
            <span className="text-xs text-stone-500">{STATO_LABEL[stato]}</span>
          </div>
        ))}
      </div>

      {showModal && (
        <MultiBookModal
          appuntamentoId={editId}
          dataIniziale={clickedDate ?? new Date()}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); loadAppuntamenti(); }}
        />
      )}
      {multiModal && (
        <MultiBookModal
          dataIniziale={new Date()}
          onClose={() => setMultiModal(false)}
          onSaved={() => { setMultiModal(false); loadAppuntamenti(); }}
        />
      )}
      {avvisoModal && (
        <AvvisoModal
          clienti={avvisoClienti}
          template={avvisoTemplate}
          indirizzo={avvisoIndirizzo}
          onClose={() => setAvvisoModal(false)}
        />
      )}
      {showBirthdayModal && birthdayClienti.length > 0 && (
        <BirthdayModal
          clienti={birthdayClienti}
          onClose={() => setShowBirthdayModal(false)}
        />
      )}
      {showInForseModal && (
        <InForseModal
          clienti={inForseClienti}
          onClose={() => setShowInForseModal(false)}
        />
      )}
    </div>
  );
}

// ─── AvvisoModal ──────────────────────────────────────────────────────────────

function applyTemplate(template: string, vars: { nome: string; data: string; ora: string }) {
  return template
    .replace(/\{nome\}/g, vars.nome)
    .replace(/\{data\}/g, vars.data)
    .replace(/\{ora\}/g, vars.ora);
}

function buildWhatsAppTesto(testo: string, mapUrl: string): string {
  return mapUrl ? `${testo}\n\n${mapUrl}` : testo;
}

interface AvvisoModalProps {
  clienti: { nome: string; telefono: string; ora: string; data: string; appuntamento_id: string; promemoria_inviato_at: string | null }[];
  template: string;
  indirizzo: string;
  onClose: () => void;
}

function WaIconAvviso({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className ?? 'w-4 h-4 fill-current'}><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
  );
}

function AvvisoModal({ clienti, template, indirizzo, onClose }: AvvisoModalProps) {
  const domani = addDays(new Date(), 1);
  const domaniLabel = domani.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
  const rawMapUrl = indirizzo.trim() ? `https://maps.google.com/?q=${encodeURIComponent(indirizzo)}` : '';

  const [includiMappa, setIncludiMappa] = useState(true);
  const [templateEdit, setTemplateEdit] = useState(template);
  const [savedTemplate, setSavedTemplate] = useState(template);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [waMode, setWaMode] = useState<WaMode>('desktop');
  const [inviati, setInviati] = useState<Set<string>>(() =>
    new Set(clienti.filter(c => c.promemoria_inviato_at != null).map(c => c.appuntamento_id))
  );
  const [queueIdx, setQueueIdx] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([
      getImpostazione('wa_modalita'),
      getImpostazione('wa_pos_promemoria'),
    ]).then(([mod, pos]) => {
      setWaMode(mod === 'web' ? 'web' : 'desktop');
      if (pos !== null) setIncludiMappa(pos === 'true');
    });
  }, []);

  async function handleToggleMappa(val: boolean) {
    setIncludiMappa(val);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) await setImpostazione('wa_pos_promemoria', val ? 'true' : 'false', user.id);
  }

  async function segnaInviato(appuntamentoId: string) {
    setInviati(prev => new Set(prev).add(appuntamentoId));
    await supabase.from('appuntamenti').update({ promemoria_inviato_at: new Date().toISOString() }).eq('id', appuntamentoId);
  }

  async function salvaTemplate() {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) await setImpostazione('messaggio_avviso_appuntamento', templateEdit, user.id);
    setSavedTemplate(templateEdit);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function buildTesto(c: typeof clienti[0]): string {
    const base = applyTemplate(templateEdit, { nome: c.nome, data: c.data, ora: c.ora });
    const mapUrl = includiMappa ? rawMapUrl : '';
    return buildWhatsAppTesto(base, mapUrl);
  }

  function openWa(c: typeof clienti[0]) {
    const testo = buildTesto(c);
    if (waMode === 'web') apriWhatsAppWeb(c.telefono, testo);
    else apriWhatsApp(c.telefono, testo);
    segnaInviato(c.appuntamento_id);
  }

  function startQueue() {
    const firstIdx = clienti.findIndex(c => !inviati.has(c.appuntamento_id));
    if (firstIdx < 0) return;
    openWa(clienti[firstIdx]);
    setQueueIdx(firstIdx);
  }

  function nextQueue() {
    if (queueIdx === null) return;
    const nextIdx = clienti.findIndex((c, i) => i > queueIdx && !inviati.has(c.appuntamento_id));
    if (nextIdx < 0) { setQueueIdx(null); return; }
    openWa(clienti[nextIdx]);
    setQueueIdx(nextIdx);
  }

  const rimanenti = clienti.filter(c => !inviati.has(c.appuntamento_id));
  const hasMultiRimanenti = rimanenti.length > 1;
  const previewTesto = applyTemplate(templateEdit, { nome: clienti[0]?.nome ?? 'Mario', data: clienti[0]?.data ?? domaniLabel, ora: clienti[0]?.ora ?? '10:00' });

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center">
              <Bell size={16} className="text-emerald-600" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-stone-800">Avviso appuntamento clienti</h2>
              <p className="text-xs text-stone-400 capitalize">{domaniLabel} · {clienti.length} client{clienti.length === 1 ? 'e' : 'i'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-stone-100 rounded-lg transition-colors">
            <X size={16} className="text-stone-500" />
          </button>
        </div>

        {/* Body a due colonne */}
        <div className="flex-1 overflow-hidden flex flex-col sm:flex-row min-h-0">

          {/* Colonna sinistra */}
          <div className="sm:w-80 flex-shrink-0 border-b sm:border-b-0 sm:border-r border-stone-100 overflow-y-auto flex flex-col">
            <div className="p-4 space-y-3">
              <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide">Anteprima messaggio</p>

              {/* Bolla WhatsApp */}
              <div className="bg-[#e7ffd4] rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                <p className="text-sm text-stone-800 leading-relaxed whitespace-pre-wrap">
                  {previewTesto}
                  {includiMappa && rawMapUrl && <span className="text-stone-500">{'\n\n'}{rawMapUrl}</span>}
                </p>
              </div>

              {/* Textarea template */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-stone-500 uppercase tracking-wide">Testo template</label>
                <p className="text-[10px] text-stone-400">Usa <span className="font-mono bg-stone-100 px-1 rounded">{'{nome}'}</span>, <span className="font-mono bg-stone-100 px-1 rounded">{'{data}'}</span>, <span className="font-mono bg-stone-100 px-1 rounded">{'{ora}'}</span></p>
                <textarea
                  value={templateEdit}
                  onChange={e => { setTemplateEdit(e.target.value); setSaved(false); }}
                  rows={4}
                  className="w-full text-xs border border-stone-200 rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-300 text-stone-700 transition-colors"
                />
                <button
                  onClick={salvaTemplate}
                  disabled={saving || templateEdit === savedTemplate}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold transition-colors"
                >
                  {saved ? <Check size={12} /> : <Save size={12} />}
                  {saving ? 'Salvataggio...' : saved ? 'Salvato!' : 'Salva messaggio'}
                </button>
              </div>

              {/* Toggle posizione */}
              {rawMapUrl && (
                <label className={`flex items-center gap-3 cursor-pointer px-3 py-2.5 rounded-xl border transition-colors ${includiMappa ? 'bg-emerald-50 border-emerald-200' : 'border-stone-200 hover:bg-stone-50'}`}>
                  <div
                    onClick={() => handleToggleMappa(!includiMappa)}
                    className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${includiMappa ? 'bg-emerald-500' : 'bg-stone-200'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${includiMappa ? 'translate-x-4' : ''}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-stone-700 flex items-center gap-1"><MapPin size={11} /> Condividi posizione</p>
                    <p className="text-[10px] text-stone-400 truncate mt-0.5">{includiMappa ? rawMapUrl : 'Link mappa non incluso'}</p>
                  </div>
                </label>
              )}
            </div>
          </div>

          {/* Colonna destra: lista */}
          <div className="flex-1 overflow-y-auto min-h-0 flex flex-col">
            {clienti.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center px-6">
                <div className="w-12 h-12 rounded-2xl bg-stone-100 flex items-center justify-center mb-3">
                  <AlertCircle size={20} className="text-stone-400" />
                </div>
                <p className="text-sm font-medium text-stone-600">Nessun cliente con numero di telefono</p>
              </div>
            ) : (
              <div className="flex-1 p-4 space-y-2">
                <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide mb-1">Elenco clienti</p>
                {clienti.map((c, i) => {
                  const inviato = inviati.has(c.appuntamento_id);
                  return (
                    <div key={i} className={`rounded-xl border overflow-hidden transition-colors ${inviato ? 'border-emerald-200 bg-emerald-50' : 'border-stone-200 bg-white hover:border-stone-300'}`}>
                      <div className="flex items-center gap-3 px-3 py-2.5">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${inviato ? 'bg-emerald-200 text-emerald-800' : 'bg-emerald-100 text-emerald-700'}`}>
                          {inviato ? <Check size={14} /> : c.nome[0]?.toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-semibold text-stone-800">{c.nome}</p>
                            {inviato && <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded-full">Inviato</span>}
                          </div>
                          <p className="text-[11px] text-stone-400">{c.telefono} · ore {c.ora}</p>
                        </div>
                        <button
                          onClick={() => openWa(c)}
                          className={`flex items-center gap-1 px-2.5 py-1.5 text-white text-xs font-semibold rounded-lg transition-colors flex-shrink-0 ${inviato ? 'bg-emerald-400 hover:bg-emerald-500' : 'bg-[#25D366] hover:bg-[#1ebe5d]'}`}
                        >
                          <WaIconAvviso className="w-3.5 h-3.5 fill-white" />
                          {inviato ? 'Reinvia' : 'Invia'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Invia a tutti (solo wa web) */}
            {waMode === 'web' && hasMultiRimanenti && (
              <div className="p-4 border-t border-stone-100 flex-shrink-0 space-y-2">
                {queueIdx !== null ? (
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-stone-500">
                      <span>Inviati {inviati.size} di {clienti.length}</span>
                      <span>{Math.round((inviati.size / clienti.length) * 100)}%</span>
                    </div>
                    <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
                      <div className="h-full bg-[#25D366] rounded-full transition-all" style={{ width: `${(inviati.size / clienti.length) * 100}%` }} />
                    </div>
                    {clienti.findIndex((c, i) => i > queueIdx && !inviati.has(c.appuntamento_id)) >= 0 ? (
                      <button onClick={nextQueue} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#25D366] hover:bg-[#1ebe5d] text-white text-sm font-semibold transition-colors">
                        <WaIconAvviso className="w-4 h-4 fill-white" />
                        Apri prossima chat
                      </button>
                    ) : (
                      <button onClick={() => setQueueIdx(null)} className="w-full py-2.5 rounded-xl bg-stone-100 text-stone-600 text-sm font-semibold">
                        <Check size={14} className="inline mr-2" />Completato
                      </button>
                    )}
                  </div>
                ) : (
                  <button onClick={startQueue} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#25D366] hover:bg-[#1ebe5d] text-white text-sm font-semibold transition-colors shadow-sm">
                    <WaIconAvviso className="w-4 h-4 fill-white" />
                    <MessageCircle size={14} />
                    Invia a tutti ({rimanenti.length})
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="px-5 py-3 border-t border-stone-100 flex-shrink-0">
          <button onClick={onClose} className="w-full py-2.5 rounded-xl border border-stone-200 text-sm font-medium text-stone-600 hover:bg-stone-50 transition-colors">
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
}

