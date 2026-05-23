import { useCallback, useEffect, useRef, useState } from 'react';
import { TrendingUp, Calendar, ShieldCheck, ChevronDown, ChevronUp, Trash2, Euro, GitCompare } from 'lucide-react';
import { supabase, localDateStr } from '../lib/supabase';
import { MonthlyBarChart } from './Statistiche';
import SmsCartaModal, { type AzioneCarta } from '../components/SmsCartaModal';

// ─── Types ───────────────────────────────────────────────────────────────────

interface IncassoVoce {
  id: string;
  data: string;
  fiche_id: string | null;
  cliente_nome: string;
  importo: number;
  note: string;
  created_at: string;
}

interface GiornoIncasso {
  data: string;
  voci: IncassoVoce[];
  totale: number;
}

// ─── Period helpers ───────────────────────────────────────────────────────────

type FiltroTipo = 'oggi' | 'settimana' | 'mese_corrente' | 'anno_corrente' | 'sempre' | 'anno' | 'mese' | 'intervallo';

interface FiltroStato {
  tipo: FiltroTipo;
  anno?: number;
  mese?: number;       // 1-12
  daAnno?: number;
  daMese?: number;
  daGiorno?: number;
  aAnno?: number;
  aMese?: number;
  aGiorno?: number;
}

const annoCorrente = new Date().getFullYear();

const NOMI_MESI = [
  'Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
  'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre',
];

function filtroToRange(f: FiltroStato): { start: string; end: string } {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const todayStr = localDateStr(now);

  if (f.tipo === 'oggi') return { start: todayStr, end: todayStr };

  if (f.tipo === 'settimana') {
    const d = new Date(now);
    d.setDate(d.getDate() - 6);
    return { start: localDateStr(d), end: todayStr };
  }

  if (f.tipo === 'mese_corrente') {
    return {
      start: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`,
      end: todayStr,
    };
  }

  if (f.tipo === 'anno_corrente') {
    return { start: `${now.getFullYear()}-01-01`, end: todayStr };
  }

  if (f.tipo === 'sempre') {
    return { start: '2000-01-01', end: todayStr };
  }

  if (f.tipo === 'anno' && f.anno) {
    const isCurrentYear = f.anno === now.getFullYear();
    return {
      start: `${f.anno}-01-01`,
      end: isCurrentYear ? todayStr : `${f.anno}-12-31`,
    };
  }

  if (f.tipo === 'mese' && f.anno && f.mese) {
    const lastDay = new Date(f.anno, f.mese, 0).getDate();
    const end = `${f.anno}-${pad(f.mese)}-${pad(lastDay)}`;
    const isCurrentOrFuture = new Date(end) > now;
    return {
      start: `${f.anno}-${pad(f.mese)}-01`,
      end: isCurrentOrFuture ? todayStr : end,
    };
  }

  if (f.tipo === 'intervallo' && f.daAnno && f.daMese && f.aAnno && f.aMese) {
    const daGg = f.daGiorno ?? 1;
    const lastDayOfEndMonth = new Date(f.aAnno, f.aMese, 0).getDate();
    const aGg = f.aGiorno ?? lastDayOfEndMonth;
    const endRaw = `${f.aAnno}-${pad(f.aMese)}-${pad(aGg)}`;
    return {
      start: `${f.daAnno}-${pad(f.daMese)}-${pad(daGg)}`,
      end: endRaw > todayStr ? todayStr : endRaw,
    };
  }

  // fallback: ultimi 30 giorni
  const d = new Date(now);
  d.setDate(d.getDate() - 29);
  return { start: localDateStr(d), end: todayStr };
}

function labelFiltro(f: FiltroStato): string {
  if (f.tipo === 'oggi') return 'Oggi';
  if (f.tipo === 'settimana') return 'Ultimi 7 giorni';
  if (f.tipo === 'mese_corrente') return `${NOMI_MESI[new Date().getMonth()]} ${new Date().getFullYear()}`;
  if (f.tipo === 'anno_corrente') return `Anno ${annoCorrente}`;
  if (f.tipo === 'sempre') return 'Tutto lo storico';
  if (f.tipo === 'anno' && f.anno) return `Anno ${f.anno}`;
  if (f.tipo === 'mese' && f.anno && f.mese) return `${NOMI_MESI[f.mese - 1]} ${f.anno}`;
  if (f.tipo === 'intervallo' && f.daAnno && f.daMese && f.aAnno && f.aMese) {
    const pad = (n: number) => String(n).padStart(2, '0');
    const da = f.daGiorno ? `${pad(f.daGiorno)} ${NOMI_MESI[f.daMese - 1]} ${f.daAnno}` : `${NOMI_MESI[f.daMese - 1]} ${f.daAnno}`;
    const a = f.aGiorno ? `${pad(f.aGiorno)} ${NOMI_MESI[f.aMese - 1]} ${f.aAnno}` : `${NOMI_MESI[f.aMese - 1]} ${f.aAnno}`;
    return `${da} — ${a}`;
  }
  return 'Periodo';
}

// ─── Confronto periodi ────────────────────────────────────────────────────────

function fmtDataLabel(d: string) {
  if (!d) return '';
  const [y, m, g] = d.split('-');
  const mesi = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'];
  return `${Number(g)} ${mesi[Number(m)-1]} ${y}`;
}

interface ConfrRow { label: string; corrente: number; precedente: number; fmt: (v: number) => string; }

function PannelloConfronto({ righe, labelA, labelB }: {
  righe: ConfrRow[]; labelA: string; labelB: string;
}) {
  const colore = '#10b981';
  const maxVal = Math.max(...righe.flatMap(r => [r.corrente, r.precedente]), 0.01);
  const righeValide = righe.filter(r => r.precedente > 0);
  const sommarioPct = righeValide.length > 0
    ? righeValide.map(r => ((r.corrente - r.precedente) / r.precedente) * 100).reduce((a, b) => a + b, 0) / righeValide.length
    : null;

  return (
    <div className="rounded-2xl border border-stone-200 overflow-hidden">
      <div className="px-4 py-3 bg-stone-50 border-b border-stone-100 flex items-center gap-5 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: colore }} />
          <span className="text-xs font-semibold text-stone-700">Periodo A: {labelA}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0 bg-stone-300" />
          <span className="text-xs font-semibold text-stone-500">Periodo B: {labelB}</span>
        </div>
      </div>
      <div className="p-4 space-y-4 bg-white">
        {righe.map(r => {
          const pct = r.precedente > 0 ? ((r.corrente - r.precedente) / r.precedente) * 100 : null;
          const positivo = pct !== null && pct > 0;
          const zero = pct !== null && Math.abs(pct) < 0.5;
          return (
            <div key={r.label}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-stone-600">{r.label}</span>
                {pct !== null ? (
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${zero ? 'bg-stone-100 text-stone-400' : positivo ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                    {zero ? '—' : positivo ? `▲ +${pct.toFixed(1)}%` : `▼ ${pct.toFixed(1)}%`}
                  </span>
                ) : (
                  <span className="text-[11px] text-stone-300 italic">nessun dato base</span>
                )}
              </div>
              <div className="flex items-center gap-2 mb-1">
                <div className="flex-1 h-5 bg-stone-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.max((r.corrente / maxVal) * 100, r.corrente > 0 ? 2 : 0)}%`, backgroundColor: colore }} />
                </div>
                <span className="text-xs font-bold text-stone-700 w-24 text-right tabular-nums">{r.fmt(r.corrente)}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-4 bg-stone-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500 bg-stone-300"
                    style={{ width: `${Math.max((r.precedente / maxVal) * 100, r.precedente > 0 ? 2 : 0)}%` }} />
                </div>
                <span className="text-xs text-stone-400 w-24 text-right tabular-nums">{r.fmt(r.precedente)}</span>
              </div>
            </div>
          );
        })}
      </div>
      {sommarioPct !== null && (
        <div className={`px-4 py-3 border-t text-sm font-semibold text-center ${Math.abs(sommarioPct) < 0.5 ? 'bg-stone-50 text-stone-500 border-stone-100' : sommarioPct > 0 ? 'bg-emerald-50 text-emerald-800 border-emerald-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
          {Math.abs(sommarioPct) < 0.5
            ? 'I due periodi sono sostanzialmente equivalenti'
            : sommarioPct > 0
              ? `Hai un incremento medio del +${sommarioPct.toFixed(1)}% nel periodo A rispetto al periodo B`
              : `Hai un decremento medio del ${sommarioPct.toFixed(1)}% nel periodo A rispetto al periodo B`}
        </div>
      )}
    </div>
  );
}

function DateRangeInput({ label, da, a, onDa, onA, colore }: {
  label: string; da: string; a: string; onDa: (v: string) => void; onA: (v: string) => void; colore: string;
}) {
  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-1.5 mb-1.5">
        <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: colore }} />
        <span className="text-xs font-semibold text-stone-600">{label}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <input type="date" value={da} onChange={e => onDa(e.target.value)}
          className="flex-1 min-w-0 px-2.5 py-1.5 text-xs border border-stone-200 rounded-lg bg-white text-stone-700 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400" />
        <span className="text-xs text-stone-400 flex-shrink-0">—</span>
        <input type="date" value={a} min={da} onChange={e => onA(e.target.value)}
          className="flex-1 min-w-0 px-2.5 py-1.5 text-xs border border-stone-200 rounded-lg bg-white text-stone-700 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400" />
      </div>
    </div>
  );
}

// ─── PeriodoDropdown ──────────────────────────────────────────────────────────

interface MesiDisponibili { anni: number[]; mesiPerAnno: Record<number, number[]> }

function PeriodoDropdown({
  filtro, onChange, mesiDisponibili,
}: {
  filtro: FiltroStato;
  onChange: (f: FiltroStato) => void;
  mesiDisponibili: MesiDisponibili;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'preset' | 'intervallo'>('preset');
  const [annoEspanso, setAnnoEspanso] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // Intervallo state
  const anni = mesiDisponibili.anni.length > 0 ? mesiDisponibili.anni : [annoCorrente];
  const [intDaAnno, setIntDaAnno] = useState(anni[0]);
  const [intDaMese, setIntDaMese] = useState(1);
  const [intDaGiorno, setIntDaGiorno] = useState(1);
  const [intAAnno, setIntAAnno] = useState(anni[anni.length - 1]);
  const [intAMese, setIntAMese] = useState(new Date().getMonth() + 1);
  const [intAGiorno, setIntAGiorno] = useState(new Date().getDate());

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  function pick(f: FiltroStato) { onChange(f); setOpen(false); setAnnoEspanso(null); }

  function applyIntervallo() {
    const pad = (n: number) => String(n).padStart(2, '0');
    const daKey = `${intDaAnno}-${pad(intDaMese)}-${pad(intDaGiorno)}`;
    const aKey = `${intAAnno}-${pad(intAMese)}-${pad(intAGiorno)}`;
    if (daKey <= aKey) {
      pick({ tipo: 'intervallo', daAnno: intDaAnno, daMese: intDaMese, daGiorno: intDaGiorno, aAnno: intAAnno, aMese: intAMese, aGiorno: intAGiorno });
    } else {
      pick({ tipo: 'intervallo', daAnno: intAAnno, daMese: intAMese, daGiorno: intAGiorno, aAnno: intDaAnno, aMese: intDaMese, aGiorno: intDaGiorno });
    }
  }

  const anniSorted = [...mesiDisponibili.anni].sort((a, b) => b - a);

  function DataSelectDropdown({ label, anno, mese, giorno, onChangeAnno, onChangeMese, onChangeGiorno }: {
    label: string; anno: number; mese: number; giorno: number;
    onChangeAnno: (a: number) => void; onChangeMese: (m: number) => void; onChangeGiorno: (g: number) => void;
  }) {
    const lastDay = new Date(anno, mese, 0).getDate();
    const giorni = Array.from({ length: lastDay }, (_, i) => i + 1);
    return (
      <div>
        <span className="block text-[10px] font-semibold text-stone-400 uppercase tracking-wide mb-1">{label}</span>
        <div className="flex gap-1.5">
          <select value={giorno} onChange={e => onChangeGiorno(Number(e.target.value))}
            className="w-16 text-sm border border-stone-200 rounded-lg px-2 py-1.5 bg-white text-stone-700 focus:outline-none focus:border-emerald-400">
            {giorni.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
          <select value={mese} onChange={e => { const m = Number(e.target.value); onChangeMese(m); onChangeGiorno(Math.min(giorno, new Date(anno, m, 0).getDate())); }}
            className="flex-1 text-sm border border-stone-200 rounded-lg px-2 py-1.5 bg-white text-stone-700 focus:outline-none focus:border-emerald-400">
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => <option key={m} value={m}>{NOMI_MESI[m - 1].slice(0, 3)}</option>)}
          </select>
          <select value={anno} onChange={e => { const y = Number(e.target.value); onChangeAnno(y); onChangeGiorno(Math.min(giorno, new Date(y, mese, 0).getDate())); }}
            className="w-20 text-sm border border-stone-200 rounded-lg px-2 py-1.5 bg-white text-stone-700 focus:outline-none focus:border-emerald-400">
            {anni.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-4 py-2 rounded-xl border bg-white text-sm font-medium transition-colors shadow-sm border-stone-200 text-stone-700 hover:border-stone-300"
      >
        <Calendar size={14} className="text-stone-400 flex-shrink-0" />
        <span className="max-w-[200px] truncate">{labelFiltro(filtro)}</span>
        <ChevronDown size={14} className={`text-stone-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 mt-1 bg-white border border-stone-200 rounded-xl shadow-xl z-30 w-[270px] overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-stone-100">
            <button onClick={() => setTab('preset')}
              className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${tab === 'preset' ? 'text-emerald-700 border-b-2 border-emerald-500' : 'text-stone-500 hover:text-stone-700'}`}>
              Periodo
            </button>
            <button onClick={() => setTab('intervallo')}
              className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${tab === 'intervallo' ? 'text-emerald-700 border-b-2 border-emerald-500' : 'text-stone-500 hover:text-stone-700'}`}>
              Intervallo date
            </button>
          </div>

          {tab === 'preset' ? (
            <div className="max-h-[360px] overflow-y-auto">
              {/* Quick presets */}
              {[
                { tipo: 'oggi' as FiltroTipo, label: 'Oggi' },
                { tipo: 'settimana' as FiltroTipo, label: 'Ultimi 7 giorni' },
                { tipo: 'mese_corrente' as FiltroTipo, label: `${NOMI_MESI[new Date().getMonth()]} ${new Date().getFullYear()} (mese corrente)` },
                { tipo: 'anno_corrente' as FiltroTipo, label: `Anno ${annoCorrente} (corrente)` },
              ].map(({ tipo, label }) => (
                <button key={tipo} onClick={() => pick({ tipo })}
                  className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${filtro.tipo === tipo ? 'bg-emerald-50 text-emerald-700 font-semibold' : 'text-stone-700 hover:bg-stone-50'}`}>
                  {label}
                </button>
              ))}
              <button onClick={() => pick({ tipo: 'sempre' })}
                className={`w-full text-left px-4 py-2.5 text-sm transition-colors border-b border-stone-100 ${filtro.tipo === 'sempre' ? 'bg-emerald-50 text-emerald-700 font-semibold' : 'text-stone-700 hover:bg-stone-50'}`}>
                Tutto lo storico
              </button>

              {/* Anno/mese drill-down */}
              {anniSorted.map(anno => (
                <div key={anno}>
                  <button
                    onClick={() => setAnnoEspanso(v => v === anno ? null : anno)}
                    className={`w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium transition-colors ${filtro.anno === anno ? 'text-emerald-700' : 'text-stone-700 hover:bg-stone-50'}`}
                  >
                    <span>{anno}</span>
                    <ChevronDown size={13} className={`text-stone-400 transition-transform ${annoEspanso === anno ? 'rotate-180' : ''}`} />
                  </button>
                  {annoEspanso === anno && (
                    <div className="bg-stone-50 border-t border-stone-100">
                      <button onClick={() => pick({ tipo: 'anno', anno })}
                        className={`w-full text-left px-6 py-2 text-sm transition-colors ${filtro.tipo === 'anno' && filtro.anno === anno ? 'text-emerald-700 font-semibold' : 'text-stone-600 hover:bg-stone-100'}`}>
                        Tutto il {anno}
                      </button>
                      {(mesiDisponibili.mesiPerAnno[anno] ?? Array.from({ length: 12 }, (_, i) => i + 1)).map(m => (
                        <button key={m} onClick={() => pick({ tipo: 'mese', anno, mese: m })}
                          className={`w-full text-left px-6 py-2 text-sm transition-colors ${filtro.tipo === 'mese' && filtro.anno === anno && filtro.mese === m ? 'text-emerald-700 font-semibold' : 'text-stone-600 hover:bg-stone-100'}`}>
                          {NOMI_MESI[m - 1]}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 space-y-3">
              <p className="text-xs text-stone-400">Seleziona data di inizio e di fine.</p>
              <DataSelectDropdown
                label="Dal"
                anno={intDaAnno} mese={intDaMese} giorno={intDaGiorno}
                onChangeAnno={setIntDaAnno} onChangeMese={setIntDaMese} onChangeGiorno={setIntDaGiorno}
              />
              <DataSelectDropdown
                label="Al"
                anno={intAAnno} mese={intAMese} giorno={intAGiorno}
                onChangeAnno={setIntAAnno} onChangeMese={setIntAMese} onChangeGiorno={setIntAGiorno}
              />
              <button onClick={applyIntervallo}
                className="w-full py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold transition-colors">
                Applica intervallo
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Finanze() {
  const todayStr = localDateStr(new Date());
  const [giorni, setGiorni] = useState<GiornoIncasso[]>([]);
  const [loading, setLoading] = useState(true);
  const [openGiorno, setOpenGiorno] = useState<string | null>(todayStr);
  const [filtro, setFiltro] = useState<FiltroStato>({ tipo: 'mese_corrente' });
  const [showConfronto, setShowConfronto] = useState(false);
  const [smsRipristino, setSmsRipristino] = useState<{ nominativo: string; codice: string; telefono: string; azione: AzioneCarta } | null>(null);
  const [confA1, setConfA1] = useState(todayStr);
  const [confA2, setConfA2] = useState(todayStr);
  const [confB1, setConfB1] = useState(todayStr);
  const [confB2, setConfB2] = useState(todayStr);

  // Compute actual date range from filtro
  const { start: rangeStart, end: rangeEnd } = filtroToRange(filtro);

  // Available months/years for the dropdown — fetched once
  const [mesiDisponibili, setMesiDisponibili] = useState<MesiDisponibili>({ anni: [], mesiPerAnno: {} });

  useEffect(() => {
    async function loadMesi() {
      const { data } = await supabase
        .from('incassi_giornalieri')
        .select('data')
        .order('data', { ascending: true });
      if (!data) return;
      const anni = new Set<number>();
      const mesiPerAnno: Record<number, number[]> = {};
      for (const row of data) {
        const d = new Date(row.data + 'T12:00:00');
        const y = d.getFullYear();
        const m = d.getMonth() + 1;
        anni.add(y);
        if (!mesiPerAnno[y]) mesiPerAnno[y] = [];
        if (!mesiPerAnno[y].includes(m)) mesiPerAnno[y].push(m);
      }
      for (const y of Object.keys(mesiPerAnno)) mesiPerAnno[Number(y)].sort((a, b) => a - b);
      setMesiDisponibili({ anni: [...anni].sort((a, b) => a - b), mesiPerAnno });
    }
    loadMesi();
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('incassi_giornalieri')
      .select('*')
      .gte('data', rangeStart)
      .lte('data', rangeEnd)
      .order('data', { ascending: false })
      .order('created_at', { ascending: false });

    const voci = (data || []) as IncassoVoce[];
    const map: Record<string, GiornoIncasso> = {};
    for (const v of voci) {
      if (!map[v.data]) map[v.data] = { data: v.data, voci: [], totale: 0 };
      map[v.data].voci.push(v);
      map[v.data].totale += v.importo;
    }
    setGiorni(Object.values(map).sort((a, b) => b.data.localeCompare(a.data)));
    setLoading(false);
  }, [rangeStart, rangeEnd]);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(id: string, ficheId: string | null) {
    if (!confirm('Eliminare questo incasso?\nVerrà annullata anche la convalidazione della fiche collegata.')) return;

    let smsPayload: { nominativo: string; codice: string; telefono: string; azione: AzioneCarta } | null = null;

    if (ficheId) {
      // Ripristina credito carta premium
      const { data: prUsi } = await supabase
        .from('utilizzi_carta_premium')
        .select('carta_premium_id, importo_detratto')
        .eq('fiche_id', ficheId);
      for (const uso of (prUsi || [])) {
        const { data: cp } = await supabase
          .from('carte_premium')
          .select('id, codice, saldo, cliente_id')
          .eq('id', uso.carta_premium_id)
          .maybeSingle();
        if (cp) {
          const nuovoSaldo = cp.saldo + uso.importo_detratto;
          await supabase.from('carte_premium').update({ saldo: nuovoSaldo, attiva: true }).eq('id', cp.id);

          // Recupera dati cliente per il messaggio WhatsApp
          const { data: fiche } = await supabase.from('fiches').select('cliente_id').eq('id', ficheId).maybeSingle();
          const clienteId = fiche?.cliente_id ?? cp.cliente_id;
          if (clienteId) {
            const { data: cliente } = await supabase
              .from('clienti')
              .select('nome, cognome, telefono')
              .eq('id', clienteId)
              .maybeSingle();
            if (cliente) {
              smsPayload = {
                nominativo: `${cliente.nome} ${cliente.cognome}`.trim(),
                codice: cp.codice,
                telefono: cliente.telefono ?? '',
                azione: { tipo: 'ripristino_credito', importoRipristinato: uso.importo_detratto, nuovoSaldo },
              };
            }
          }
        }
      }
      await supabase.from('utilizzi_carta_premium').delete().eq('fiche_id', ficheId);

      // Ripristina carta sconto (riattiva se usa-e-getta)
      const { data: scUsi } = await supabase
        .from('utilizzi_carta_sconto')
        .select('carta_sconto_id')
        .eq('fiche_id', ficheId);
      for (const uso of (scUsi || [])) {
        const { data: cs } = await supabase.from('carte_sconto').select('usa_e_getta, attiva').eq('id', uso.carta_sconto_id).maybeSingle();
        if (cs?.usa_e_getta && !cs.attiva) {
          await supabase.from('carte_sconto').update({ attiva: true }).eq('id', uso.carta_sconto_id);
        }
      }
      await supabase.from('utilizzi_carta_sconto').delete().eq('fiche_id', ficheId);

      // Rimuovi voci rivendita collegate
      await supabase.from('rivendita_prodotti').delete().eq('fiche_id', ficheId);

      await supabase
        .from('fiches')
        .update({ convalidata: false, convalidata_at: null, importo_convalidato: 0 })
        .eq('id', ficheId);
    }
    await supabase.from('incassi_giornalieri').delete().eq('id', id);
    load();

    if (smsPayload) {
      setSmsRipristino(smsPayload);
    }
  }

  const totaleRange = giorni.reduce((s, g) => s + g.totale, 0);
  const oggiGiorno = giorni.find(g => g.data === todayStr);
  const incassoOggi = oggiGiorno?.totale ?? 0;

  // Raggruppa per mese per il grafico
  const meseMap: Record<string, number> = {};
  for (const g of giorni) {
    const mese = g.data.slice(0, 7);
    meseMap[mese] = (meseMap[mese] ?? 0) + g.totale;
  }
  const incassiMensili = Object.keys(meseMap).sort().map(mese => ({ mese, incasso: meseMap[mese] }));

  // Calcola valori per confronto periodi personalizzato (usa tutte le voci caricate da DB)
  const [tutteVoci, setTutteVoci] = useState<{ data: string; importo: number }[]>([]);
  useEffect(() => {
    supabase.from('incassi_giornalieri').select('data, importo').then(({ data }) => {
      setTutteVoci((data || []) as { data: string; importo: number }[]);
    });
  }, []);

  function totalePerIntervallo(da: string, a: string) {
    if (!da || !a) return 0;
    const fine = a >= da ? a : da;
    return tutteVoci.filter(v => v.data >= da && v.data <= fine).reduce((s, v) => s + v.importo, 0);
  }
  function conteggioPerIntervallo(da: string, a: string) {
    if (!da || !a) return 0;
    const fine = a >= da ? a : da;
    const giorniSet = new Set(tutteVoci.filter(v => v.data >= da && v.data <= fine).map(v => v.data));
    return giorniSet.size;
  }

  const totA = totalePerIntervallo(confA1, confA2);
  const totB = totalePerIntervallo(confB1, confB2);
  const giorniA = conteggioPerIntervallo(confA1, confA2);
  const giorniB = conteggioPerIntervallo(confB1, confB2);

  function formatDate(d: string) {
    return new Date(d + 'T12:00:00').toLocaleDateString('it-IT', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-7 h-7 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <>
    <div className="p-6 space-y-6">
      {/* Hero row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Incasso oggi */}
        <div className="sm:col-span-1 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-5 text-white shadow-lg">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
              <ShieldCheck size={18} className="text-white" />
            </div>
            <span className="text-sm font-medium text-emerald-100">Incasso di oggi</span>
          </div>
          <p className="text-3xl font-bold tracking-tight">€{incassoOggi.toFixed(2)}</p>
          {oggiGiorno && (
            <p className="text-xs text-emerald-200 mt-1">
              {oggiGiorno.voci.length} fiche convalidat{oggiGiorno.voci.length === 1 ? 'a' : 'e'}
            </p>
          )}
        </div>

        {/* Totale periodo + selettore */}
        <div className="sm:col-span-2 bg-white rounded-2xl border border-stone-200 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <div className="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center flex-shrink-0">
              <TrendingUp size={18} className="text-emerald-600" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-stone-800">Incassi totali</p>
              <p className="text-xs text-stone-400 truncate">Fiches + incassi manuali · {labelFiltro(filtro)}</p>
            </div>
            <p className="ml-auto text-2xl font-bold text-stone-800">€{totaleRange.toFixed(2)}</p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <PeriodoDropdown filtro={filtro} onChange={setFiltro} mesiDisponibili={mesiDisponibili} />
            <button
              onClick={() => setShowConfronto(s => !s)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-medium shadow-sm transition-colors ${showConfronto ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-stone-200 bg-white hover:bg-stone-50 text-stone-600'}`}
              title="Confronta due periodi"
            >
              <GitCompare size={14} />
              <span className="hidden sm:inline">Confronta</span>
            </button>
            <span className="text-xs text-stone-400">{giorni.length} giorn{giorni.length === 1 ? 'o' : 'i'} con incasso</span>
          </div>
        </div>
      </div>

      {/* Grafico andamento mensile */}
      {incassiMensili.length > 0 && (
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-stone-100">
            <p className="text-sm font-semibold text-stone-700">Andamento incassi mensili</p>
            <p className="text-xs text-stone-400 mt-0.5">{labelFiltro(filtro)}</p>
          </div>
          <div className="p-5">
            <MonthlyBarChart
              data={incassiMensili}
              valueKey="incasso"
              color="#10b981"
              fmt={v => `€${v.toFixed(0)}`}
            />
          </div>
        </div>
      )}

      {/* Confronto periodi personalizzato */}
      {showConfronto && (
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-stone-100">
            <p className="text-sm font-semibold text-stone-700">Confronto periodi personalizzato</p>
            <p className="text-xs text-stone-400 mt-0.5">Scegli due intervalli di date per confrontare gli incassi</p>
          </div>
          <div className="p-5 space-y-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <DateRangeInput label="Periodo A" da={confA1} a={confA2} onDa={setConfA1} onA={setConfA2} colore="#10b981" />
              <DateRangeInput label="Periodo B" da={confB1} a={confB2} onDa={setConfB1} onA={setConfB2} colore="#a8a29e" />
            </div>
            <PannelloConfronto
              labelA={`${fmtDataLabel(confA1)} — ${fmtDataLabel(confA2 >= confA1 ? confA2 : confA1)}`}
              labelB={`${fmtDataLabel(confB1)} — ${fmtDataLabel(confB2 >= confB1 ? confB2 : confB1)}`}
              righe={[
                { label: 'Incasso totale', corrente: totA, precedente: totB, fmt: v => `€${v.toFixed(2)}` },
                { label: 'Giorni con incasso', corrente: giorniA, precedente: giorniB, fmt: v => String(Math.round(v)) },
              ]}
            />
          </div>
        </div>
      )}

      {/* Lista giorni */}
      <div>
        <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wide mb-3">Storico incassi</h2>

        {giorni.length === 0 ? (
          <div className="bg-white rounded-xl border border-stone-200 px-6 py-16 text-center text-stone-400">
            Nessun incasso nel periodo selezionato.<br />
            <span className="text-sm">Convalida le fiches dalla sezione Fiches per registrare gli incassi.</span>
          </div>
        ) : (
          <div className="space-y-2">
            {giorni.map(g => (
              <GiornoCard
                key={g.data}
                giorno={g}
                isOpen={openGiorno === g.data}
                isToday={g.data === todayStr}
                formatDate={formatDate}
                onToggle={() => setOpenGiorno(prev => prev === g.data ? null : g.data)}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>

    </div>

    {smsRipristino && (
      <SmsCartaModal
        nominativo={smsRipristino.nominativo}
        codice={smsRipristino.codice}
        telefono={smsRipristino.telefono}
        azione={smsRipristino.azione}
        onClose={() => setSmsRipristino(null)}
      />
    )}
    </>
  );
}

// ─── GiornoCard ───────────────────────────────────────────────────────────────

interface GiornoCardProps {
  giorno: GiornoIncasso;
  isOpen: boolean;
  isToday: boolean;
  formatDate: (d: string) => string;
  onToggle: () => void;
  onDelete: (id: string, ficheId: string | null) => void;
}

function GiornoCard({ giorno, isOpen, isToday, formatDate, onToggle, onDelete }: GiornoCardProps) {
  return (
    <div className={`bg-white rounded-xl border shadow-sm transition-all ${isOpen ? 'border-emerald-300 shadow-md' : isToday ? 'border-emerald-200' : 'border-stone-200'}`}>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-stone-50/60 transition-colors rounded-xl"
      >
        <div className="flex-shrink-0">
          {isToday ? (
            <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center">
              <ShieldCheck size={18} className="text-white" />
            </div>
          ) : (
            <div className="w-10 h-10 bg-stone-100 rounded-xl flex items-center justify-center">
              <Calendar size={16} className="text-stone-500" />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className={`font-semibold capitalize ${isToday ? 'text-emerald-700' : 'text-stone-800'}`}>
            {isToday ? 'Oggi — ' : ''}{formatDate(giorno.data)}
          </p>
          <p className="text-xs text-stone-400 mt-0.5">
            {giorno.voci.length} fiche · {giorno.voci.map(v => v.cliente_nome).join(', ')}
          </p>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          <span className={`text-lg font-bold ${isToday ? 'text-emerald-700' : 'text-stone-800'}`}>
            €{giorno.totale.toFixed(2)}
          </span>
          {isOpen ? <ChevronUp size={16} className="text-stone-400" /> : <ChevronDown size={16} className="text-stone-400" />}
        </div>
      </button>

      {isOpen && (
        <div className="border-t border-stone-100 px-5 py-4">
          <div className="rounded-xl border border-stone-100 overflow-hidden">
            {giorno.voci.map((v, i) => (
              <div key={v.id} className={`flex items-center gap-4 px-4 py-3 ${i < giorno.voci.length - 1 ? 'border-b border-stone-50' : ''}`}>
                <div className="w-7 h-7 bg-emerald-50 rounded-lg flex items-center justify-center flex-shrink-0">
                  <ShieldCheck size={13} className="text-emerald-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-stone-800 truncate">{v.cliente_nome}</p>
                  {v.note && <p className="text-xs text-stone-400 truncate mt-0.5">{v.note}</p>}
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="flex items-center gap-1 text-sm font-bold text-stone-700">
                    <Euro size={12} className="text-stone-400" />
                    {v.importo.toFixed(2)}
                  </span>
                  <button onClick={() => onDelete(v.id, v.fiche_id)} className="text-stone-300 hover:text-red-400 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-between items-center mt-3 px-4 py-2.5 bg-stone-50 rounded-xl">
            <span className="text-sm font-semibold text-stone-600">Totale {formatDate(giorno.data).split(',')[0]}</span>
            <span className="text-base font-bold text-stone-800">€{giorno.totale.toFixed(2)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
