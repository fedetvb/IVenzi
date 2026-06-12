import { useEffect, useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Plus, CreditCard as Edit2, Trash2, CreditCard, Clock, Bell, MessageCircle, X, ExternalLink, AlertCircle, Gift, HelpCircle, Check } from 'lucide-react';
import { supabase, type Appuntamento } from '../lib/supabase';
import { dbSelect, dbSelectWithRelated, dbDelete, getImpostazione, setImpostazione } from '../lib/localDb';
import MultiBookModal from '../components/MultiBookModal';
import AgendaGiorno from './AgendaGiorno';
import BirthdayModal from '../components/BirthdayModal';
import { apriWhatsApp } from '../lib/waUtils';
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
  const [avvisoClienti, setAvvisoClienti] = useState<{ nome: string; telefono: string; ora: string; data: string }[]>([]);
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
    const fmt = new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit' });
    const checkAvviso = async () => {
      const disab = await getImpostazione('whatsapp_avviso_disabilitato');
      if (disab === 'true') { setAvvisoAppuntamentiVisibile(false); return; }
      const orario = await getImpostazione('avviso_appuntamenti_orario') ?? '17:00';
      const nowIt = fmt.format(new Date());
      setAvvisoAppuntamentiVisibile(nowIt >= orario);
    };
    checkAvviso();
    const id = setInterval(checkAvviso, 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const fmt = new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit' });
    const check = async () => {
      const attivo = await getImpostazione('banner_in_forse_attivo');
      if (attivo === 'false') return;
      const orario = await getImpostazione('orario_avviso_in_forse') ?? '18:00';
      const nowIt = fmt.format(new Date());
      if (nowIt !== orario) return;
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
    const id = setInterval(check, 60_000);
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
        columns: 'id, data_ora, stato, cliente_id, deleted_at',
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
        supabaseSelect: 'data_ora, stato, clienti(id, nome, telefono)'
      }),
      dbSelect({ table: 'impostazioni', columns: 'valore', filters: [{ col: 'chiave', op: 'eq', val: 'messaggio_avviso_appuntamento' }] }),
      dbSelect({ table: 'impostazioni', columns: 'valore', filters: [{ col: 'chiave', op: 'eq', val: 'avviso_appuntamento_indirizzo' }] })
    ]);

    const template = tmplRes.data?.[0]?.valore ?? `Ciao {nome} ti ricordiamo l'appuntamento di domani {data} alle ore {ora} presso il nostro salone in via Palermo 15 Roma, ti aspettiamo!\n\nI Venzi.`;
    const indirizzo = indirizzoRes.data?.[0]?.valore ?? 'via Palermo 15, Roma';

    const clientiMap: Record<string, { nome: string; telefono: string; ora: string; data: string }> = {};
    for (const app of (appRes.data || []).filter((a: { stato?: string }) => a.stato !== 'in_forse')) {
      const c = app.clienti as { id: string; nome: string; telefono?: string } | null;
      if (!c || !c.telefono?.trim()) continue;
      if (clientiMap[c.id]) continue;
      const ora = new Date(app.data_ora).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' });
      clientiMap[c.id] = { nome: c.nome, telefono: c.telefono.trim(), ora, data: dataLabel };
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
  clienti: { nome: string; telefono: string; ora: string; data: string }[];
  template: string;
  indirizzo: string;
  onClose: () => void;
}

function AvvisoModal({ clienti, template, indirizzo, onClose }: AvvisoModalProps) {
  const domani = addDays(new Date(), 1);
  const domaniLabel = domani.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
  const [includiMappa, setIncludiMappa] = useState(true);
  const rawMapUrl = indirizzo.trim() ? `https://maps.google.com/?q=${encodeURIComponent(indirizzo)}` : '';
  const mapUrl = includiMappa ? rawMapUrl : '';
  const [templateEdit, setTemplateEdit] = useState(template);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function salvaTemplate() {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) await setImpostazione('messaggio_avviso_appuntamento', templateEdit, user.id);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center">
              <Bell size={16} className="text-emerald-600" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-stone-800">Avviso appuntamento clienti</h2>
              <p className="text-xs text-stone-400 capitalize">{domaniLabel}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-stone-100 rounded-lg transition-colors">
            <X size={16} className="text-stone-500" />
          </button>
        </div>

        {/* Toggle mappa */}
        {rawMapUrl && (
          <div className="px-6 py-3 border-b border-stone-100 flex-shrink-0">
            <label className={`flex items-center gap-3 cursor-pointer px-3 py-2.5 rounded-xl border transition-colors ${includiMappa ? 'bg-emerald-50 border-emerald-200' : 'border-stone-200 hover:bg-stone-50'}`}>
              <div
                className={`w-10 h-5 rounded-full transition-colors relative flex-shrink-0 ${includiMappa ? 'bg-emerald-500' : 'bg-stone-200'}`}
                onClick={() => setIncludiMappa(v => !v)}
              >
                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${includiMappa ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-stone-700">Allega posizione Google Maps</p>
                {includiMappa
                  ? <p className="text-[10px] text-emerald-600 font-mono truncate mt-0.5">{rawMapUrl}</p>
                  : <p className="text-[10px] text-stone-400 mt-0.5">Il link alla mappa non verrà incluso</p>
                }
              </div>
            </label>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
          {clienti.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-12 h-12 rounded-2xl bg-stone-100 flex items-center justify-center mb-3">
                <AlertCircle size={20} className="text-stone-400" />
              </div>
              <p className="text-sm font-medium text-stone-600">Nessun cliente con numero di telefono</p>
              <p className="text-xs text-stone-400 mt-1">Nessun appuntamento domani ha un cliente con telefono salvato</p>
            </div>
          ) : (
            <>
              <p className="text-xs text-stone-500 pb-1">
                {clienti.length} client{clienti.length === 1 ? 'e' : 'i'} con appuntamento domani. Clicca il pulsante per aprire WhatsApp con il messaggio precompilato.
              </p>
              {clienti.map((c, i) => {
                const testo = applyTemplate(templateEdit, { nome: c.nome, data: c.data, ora: c.ora });
                const testoCompleto = buildWhatsAppTesto(testo, mapUrl);
                return (
                  <div key={i} className="bg-stone-50 border border-stone-200 rounded-xl overflow-hidden">
                    <div className="flex items-center gap-3 px-4 py-3">
                      <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0 text-sm font-bold text-emerald-700">
                        {c.nome[0]?.toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-stone-800">{c.nome}</p>
                        <p className="text-xs text-stone-400">{c.telefono} · ore {c.ora}</p>
                      </div>
                      <button
                        onClick={() => apriWhatsApp(c.telefono, testoCompleto)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold rounded-lg transition-colors flex-shrink-0"
                      >
                        <MessageCircle size={13} />
                        WhatsApp
                        <ExternalLink size={10} className="opacity-70" />
                      </button>
                    </div>
                    {/* Anteprima messaggio */}
                    <div className="px-4 pb-3">
                      <p className="text-[11px] text-stone-400 whitespace-pre-wrap leading-relaxed bg-white border border-stone-100 rounded-lg px-3 py-2">{testo}{mapUrl ? `\n\n${mapUrl}` : ''}</p>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>

        {/* Modifica template */}
        <div className="px-6 py-4 border-t border-stone-100 flex-shrink-0 space-y-2">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Modifica template messaggio</p>
            <span className="text-[10px] text-stone-400">Usa {'{nome}'}, {'{data}'}, {'{ora}'}</span>
          </div>
          <textarea
            value={templateEdit}
            onChange={e => setTemplateEdit(e.target.value)}
            rows={3}
            className="w-full text-xs border border-stone-200 rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-400 text-stone-700 font-mono transition-colors"
          />
          <button
            onClick={salvaTemplate}
            disabled={saving || templateEdit === template}
            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold transition-colors"
          >
            {saved ? <Check size={13} /> : null}
            {saving ? 'Salvataggio...' : saved ? 'Salvato!' : 'Salva messaggio'}
          </button>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-stone-100 flex-shrink-0">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl border border-stone-200 text-sm font-medium text-stone-600 hover:bg-stone-50 transition-colors"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
}

