import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ShoppingBag, Plus, Trash2, X, ChevronDown, TrendingUp,
  Euro, Package, BarChart2, Check, Download, GitCompare, Scissors,
} from 'lucide-react';
import { supabase, localDateStr } from '../lib/supabase';
import { dbSelect, dbInsert, dbUpdate, dbDelete } from '../lib/localDb';
import { useAuth } from '../lib/AuthContext';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { saveFile } from '../lib/fileSaver';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Parrucchiere { id: string; nome: string; colore: string; }

interface Vendita {
  id: string;
  parrucchiere_id: string;
  nome_prodotto: string;
  quantita: number;
  prezzo_unitario: number;
  costo_unitario: number;
  totale: number;
  data_vendita: string;
  note: string;
  created_at: string;
}

interface Trattamento {
  id: string;
  parrucchiere_id: string;
  nome_trattamento: string;
  prezzo: number;
  data_esecuzione: string;
  note: string;
  created_at: string;
}

type PeriodoKey = 'corrente' | 'sempre' | string;

// ─── Helpers ─────────────────────────────────────────────────────────────────

const now = new Date();
const annoCorrente = now.getFullYear();
const pad = (n: number) => String(n).padStart(2, '0');
const fmt = (n: number) => n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const NOMI_MESI_LUNGHI = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];

function isMese(p: PeriodoKey): boolean { return /^\d{4}-\d{2}$/.test(p); }
function isIntervallo(p: PeriodoKey): boolean { return p.startsWith('da:'); }
function parseIntervallo(p: PeriodoKey): { da: string; a: string } {
  const parts = p.split(':');
  return { da: parts[1], a: parts[3] };
}
function mkIntervallo(da: string, a: string): PeriodoKey { return `da:${da}:a:${a}`; }

function intervalloStartDate(da: string): string {
  return da.length === 7 ? `${da}-01` : da;
}
function intervalloEndDate(a: string): string {
  if (a.length === 7) {
    const [y, m] = a.split('-').map(Number);
    return `${a}-${pad(new Date(y, m, 0).getDate())}`;
  }
  return a;
}

function labelPeriodo(p: PeriodoKey): string {
  if (p === 'corrente') return `Anno ${annoCorrente}`;
  if (p === 'sempre') return 'Tutto lo storico';
  if (isIntervallo(p)) {
    const { da, a } = parseIntervallo(p);
    const daP = da.split('-');
    const aP = a.split('-');
    const daLabel = da.length > 7 ? `${Number(daP[2])} ${NOMI_MESI_LUNGHI[Number(daP[1]) - 1]} ${daP[0]}` : `${NOMI_MESI_LUNGHI[Number(daP[1]) - 1]} ${daP[0]}`;
    const aLabel = a.length > 7 ? `${Number(aP[2])} ${NOMI_MESI_LUNGHI[Number(aP[1]) - 1]} ${aP[0]}` : `${NOMI_MESI_LUNGHI[Number(aP[1]) - 1]} ${aP[0]}`;
    return `${daLabel} — ${aLabel}`;
  }
  if (isMese(p)) {
    const [y, m] = p.split('-');
    return `${NOMI_MESI_LUNGHI[Number(m) - 1]} ${y}`;
  }
  return String(p);
}

function filtraPerPeriodo(items: Vendita[], periodo: PeriodoKey): Vendita[] {
  return items.filter(v => {
    const dateStr = v.data_vendita; // YYYY-MM-DD
    const y = Number(dateStr.split('-')[0]);
    if (periodo === 'corrente') return y === annoCorrente;
    if (periodo === 'sempre') return true;
    if (isMese(periodo)) {
      const [py, pm] = periodo.split('-');
      const vm = dateStr.slice(0, 7);
      return vm === `${py}-${pm}`;
    }
    if (isIntervallo(periodo)) {
      const { da, a } = parseIntervallo(periodo);
      const start = intervalloStartDate(da);
      const end = intervalloEndDate(a);
      return dateStr >= start && dateStr <= end;
    }
    return y === Number(periodo);
  });
}

// ─── Periodo Selector ─────────────────────────────────────────────────────────

function PeriodoSelector({ valore, onChange, anni }: {
  valore: PeriodoKey;
  onChange: (v: PeriodoKey) => void;
  anni: number[];
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'preset' | 'intervallo'>(isIntervallo(valore) ? 'intervallo' : 'preset');
  const [annoEspanso, setAnnoEspanso] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const anniDisp = anni.length > 0 ? anni : [annoCorrente];

  function parseInitDa() {
    if (isIntervallo(valore)) {
      const { da } = parseIntervallo(valore);
      const p = da.split('-');
      return { anno: Number(p[0]), mese: Number(p[1]), giorno: p.length > 2 ? Number(p[2]) : 1 };
    }
    return { anno: anniDisp[0], mese: 1, giorno: 1 };
  }
  function parseInitA() {
    if (isIntervallo(valore)) {
      const { a } = parseIntervallo(valore);
      const p = a.split('-');
      return { anno: Number(p[0]), mese: Number(p[1]), giorno: p.length > 2 ? Number(p[2]) : new Date(Number(p[0]), Number(p[1]), 0).getDate() };
    }
    return { anno: anniDisp[anniDisp.length - 1], mese: now.getMonth() + 1, giorno: now.getDate() };
  }

  const initDa = parseInitDa();
  const initA = parseInitA();
  const [intDaAnno, setIntDaAnno] = useState(initDa.anno);
  const [intDaMese, setIntDaMese] = useState(initDa.mese);
  const [intDaGiorno, setIntDaGiorno] = useState(initDa.giorno);
  const [intAAnno, setIntAAnno] = useState(initA.anno);
  const [intAMese, setIntAMese] = useState(initA.mese);
  const [intAGiorno, setIntAGiorno] = useState(initA.giorno);

  useEffect(() => {
    function onOut(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onOut);
    return () => document.removeEventListener('mousedown', onOut);
  }, []);

  function pick(key: PeriodoKey) { onChange(key); setOpen(false); setAnnoEspanso(null); }

  function applyIntervallo() {
    const da = `${intDaAnno}-${pad(intDaMese)}-${pad(intDaGiorno)}`;
    const a = `${intAAnno}-${pad(intAMese)}-${pad(intAGiorno)}`;
    pick(mkIntervallo(da <= a ? da : a, da <= a ? a : da));
  }

  function DataSelect({ label, anno, mese, giorno, onAnno, onMese, onGiorno }: {
    label: string; anno: number; mese: number; giorno: number;
    onAnno: (v: number) => void; onMese: (v: number) => void; onGiorno: (v: number) => void;
  }) {
    const lastDay = new Date(anno, mese, 0).getDate();
    return (
      <div>
        <span className="block text-[10px] font-semibold text-stone-400 uppercase tracking-wide mb-1">{label}</span>
        <div className="flex gap-1.5">
          <select value={giorno} onChange={e => onGiorno(Number(e.target.value))}
            className="w-14 text-sm border border-stone-200 rounded-lg px-1.5 py-1.5 bg-white text-stone-700 focus:outline-none focus:border-amber-400">
            {Array.from({ length: lastDay }, (_, i) => i + 1).map(g => <option key={g} value={g}>{g}</option>)}
          </select>
          <select value={mese} onChange={e => { const m = Number(e.target.value); onMese(m); onGiorno(Math.min(giorno, new Date(anno, m, 0).getDate())); }}
            className="flex-1 text-sm border border-stone-200 rounded-lg px-1.5 py-1.5 bg-white text-stone-700 focus:outline-none focus:border-amber-400">
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => <option key={m} value={m}>{NOMI_MESI_LUNGHI[m - 1].slice(0, 3)}</option>)}
          </select>
          <select value={anno} onChange={e => { const y = Number(e.target.value); onAnno(y); onGiorno(Math.min(giorno, new Date(y, mese, 0).getDate())); }}
            className="w-20 text-sm border border-stone-200 rounded-lg px-1.5 py-1.5 bg-white text-stone-700 focus:outline-none focus:border-amber-400">
            {anniDisp.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>
    );
  }

  const mesiPerAnno: Record<number, number[]> = {};
  for (const y of anniDisp) {
    mesiPerAnno[y] = y === annoCorrente ? Array.from({ length: now.getMonth() + 1 }, (_, i) => i + 1) : Array.from({ length: 12 }, (_, i) => i + 1);
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => { setOpen(o => !o); if (!open) setTab(isIntervallo(valore) ? 'intervallo' : 'preset'); }}
        className={`flex items-center gap-2 px-4 py-2 rounded-xl border bg-white text-sm font-medium transition-colors shadow-sm ${isIntervallo(valore) ? 'border-amber-300 text-amber-700' : 'border-stone-200 text-stone-700 hover:border-stone-300'}`}
      >
        <span className="max-w-[200px] truncate">{labelPeriodo(valore)}</span>
        <ChevronDown size={14} className={`text-stone-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute right-0 mt-1 bg-white border border-stone-200 rounded-xl shadow-lg z-20 w-[280px] overflow-hidden">
          <div className="flex border-b border-stone-100">
            <button onClick={() => setTab('preset')} className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${tab === 'preset' ? 'text-amber-700 border-b-2 border-amber-500' : 'text-stone-500 hover:text-stone-700'}`}>Periodo</button>
            <button onClick={() => setTab('intervallo')} className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${tab === 'intervallo' ? 'text-amber-700 border-b-2 border-amber-500' : 'text-stone-500 hover:text-stone-700'}`}>Intervallo date</button>
          </div>
          {tab === 'preset' ? (
            <div className="max-h-[320px] overflow-y-auto">
              <button onClick={() => pick('corrente')} className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${valore === 'corrente' ? 'bg-amber-50 text-amber-700 font-semibold' : 'text-stone-700 hover:bg-stone-50'}`}>Anno corrente ({annoCorrente})</button>
              <button onClick={() => pick('sempre')} className={`w-full text-left px-4 py-2.5 text-sm transition-colors border-b border-stone-100 ${valore === 'sempre' ? 'bg-amber-50 text-amber-700 font-semibold' : 'text-stone-700 hover:bg-stone-50'}`}>Tutto lo storico</button>
              {anniDisp.map(anno => (
                <div key={anno}>
                  <button onClick={() => setAnnoEspanso(v => v === anno ? null : anno)}
                    className={`w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium transition-colors ${valore === String(anno) ? 'text-amber-700' : 'text-stone-700 hover:bg-stone-50'}`}>
                    <span>{anno}{anno === annoCorrente ? ' (corrente)' : ''}</span>
                    <ChevronDown size={13} className={`text-stone-400 transition-transform ${annoEspanso === anno ? 'rotate-180' : ''}`} />
                  </button>
                  {annoEspanso === anno && (
                    <div className="bg-stone-50 border-t border-stone-100">
                      <button onClick={() => pick(String(anno))} className={`w-full text-left px-6 py-2 text-sm transition-colors ${valore === String(anno) ? 'text-amber-700 font-semibold' : 'text-stone-600 hover:bg-stone-100'}`}>Tutto l&apos;anno</button>
                      {(mesiPerAnno[anno] || []).map(m => {
                        const key = `${anno}-${pad(m)}` as PeriodoKey;
                        return <button key={m} onClick={() => pick(key)} className={`w-full text-left px-6 py-2 text-sm transition-colors ${valore === key ? 'text-amber-700 font-semibold' : 'text-stone-600 hover:bg-stone-100'}`}>{NOMI_MESI_LUNGHI[m - 1]}</button>;
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 space-y-3">
              <p className="text-xs text-stone-400">Seleziona data di inizio e di fine.</p>
              <DataSelect label="Dal" anno={intDaAnno} mese={intDaMese} giorno={intDaGiorno} onAnno={setIntDaAnno} onMese={setIntDaMese} onGiorno={setIntDaGiorno} />
              <DataSelect label="Al" anno={intAAnno} mese={intAMese} giorno={intAGiorno} onAnno={setIntAAnno} onMese={setIntAMese} onGiorno={setIntAGiorno} />
              <button onClick={applyIntervallo} className="w-full py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold transition-colors">Applica intervallo</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Confronto periodi personalizzato ─────────────────────────────────────────

interface ConfrRow { label: string; corrente: number; precedente: number; fmt: (v: number) => string; }

function fmtData(d: string) {
  if (!d) return '';
  const [y, m, g] = d.split('-');
  return `${Number(g)} ${['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'][Number(m)-1]} ${y}`;
}

function PannelloConfronto({ righe, labelA, labelB, colore }: {
  righe: ConfrRow[]; labelA: string; labelB: string; colore: string;
}) {
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
                <span className="text-xs font-bold text-stone-700 w-20 text-right tabular-nums">{r.fmt(r.corrente)}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-4 bg-stone-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500 bg-stone-300"
                    style={{ width: `${Math.max((r.precedente / maxVal) * 100, r.precedente > 0 ? 2 : 0)}%` }} />
                </div>
                <span className="text-xs text-stone-400 w-20 text-right tabular-nums">{r.fmt(r.precedente)}</span>
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
          className="flex-1 min-w-0 px-2.5 py-1.5 text-xs border border-stone-200 rounded-lg bg-white text-stone-700 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-teal-400" />
        <span className="text-xs text-stone-400 flex-shrink-0">—</span>
        <input type="date" value={a} min={da} onChange={e => onA(e.target.value)}
          className="flex-1 min-w-0 px-2.5 py-1.5 text-xs border border-stone-200 rounded-lg bg-white text-stone-700 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-teal-400" />
      </div>
    </div>
  );
}

// ─── PDF export ──────────────────────────────────────────────────────────────

interface PdfConfrRiv {
  labelA: string;
  labelB: string;
  righe: { label: string; valA: string; valB: string; pct: number | null }[];
}

function pdfSezConfronto(doc: jsPDF, c: PdfConfrRiv, startY: number) {
  let y = startY + 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(28, 25, 23);
  doc.text('Confronto periodi', 14, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(120, 113, 108);
  doc.text(`Periodo A: ${c.labelA}`, 14, y); y += 4;
  doc.text(`Periodo B: ${c.labelB}`, 14, y); y += 3;

  const body = c.righe.map(r => {
    const pctStr = r.pct === null ? '—'
      : Math.abs(r.pct) < 0.5 ? '='
      : r.pct > 0 ? `+${r.pct.toFixed(1)}%`
      : `${r.pct.toFixed(1)}%`;
    return [r.label, r.valA, r.valB, pctStr];
  });

  autoTable(doc, {
    startY: y + 2,
    head: [['Metrica', 'Periodo A', 'Periodo B', 'Variazione']],
    body,
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [20, 184, 166], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [240, 253, 250] },
    didParseCell: (data) => {
      if (data.column.index === 3 && data.section === 'body') {
        const txt = String(data.cell.raw ?? '');
        if (txt.startsWith('+')) data.cell.styles.textColor = [5, 150, 105];
        else if (txt.startsWith('-')) data.cell.styles.textColor = [220, 38, 38];
        data.cell.styles.fontStyle = 'bold';
      }
    },
  });

  const finalY = (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? y + 20;
  const righeValide = c.righe.filter(r => r.pct !== null);
  if (righeValide.length > 0) {
    const media = righeValide.map(r => r.pct!).reduce((a, b) => a + b, 0) / righeValide.length;
    const msg = Math.abs(media) < 0.5
      ? 'I due periodi sono sostanzialmente equivalenti.'
      : media > 0
        ? `Incremento medio del +${media.toFixed(1)}% nel periodo A rispetto al periodo B.`
        : `Decremento medio del ${media.toFixed(1)}% nel periodo A rispetto al periodo B.`;
    const col: [number, number, number] = Math.abs(media) < 0.5 ? [120, 113, 108] : media > 0 ? [5, 150, 105] : [220, 38, 38];
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...col);
    doc.text(msg, 14, finalY + 5);
  }
}

function mkRivConfronto(
  righe: { label: string; corrente: number; precedente: number; fmtFn: (v: number) => string }[],
  labelA: string, labelB: string,
): PdfConfrRiv {
  return {
    labelA, labelB,
    righe: righe.map(r => ({
      label: r.label,
      valA: r.fmtFn(r.corrente),
      valB: r.fmtFn(r.precedente),
      pct: r.precedente > 0 ? ((r.corrente - r.precedente) / r.precedente) * 100 : null,
    })),
  };
}

async function esportaRivenditaPDF(parr: Parrucchiere, vendite: Vendita[], periodoLabel: string, confronto?: PdfConfrRiv) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(28, 25, 23);
  doc.text('Rivendita — ' + parr.nome, 14, 18);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(120, 113, 108);
  doc.text('Periodo: ' + periodoLabel, 14, 25);
  doc.text('Generato il ' + new Date().toLocaleDateString('it-IT'), 14, 30);
  doc.setDrawColor(231, 229, 228);
  doc.line(14, 33, doc.internal.pageSize.width - 14, 33);

  const totale = vendite.reduce((s, v) => s + v.totale, 0);
  const nVendite = vendite.length;

  let y = 40;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(28, 25, 23);
  const riepilogo: [string, string][] = [
    ['Numero vendite', String(nVendite)],
    ['Totale incassato', '€' + totale.toLocaleString('it-IT', { minimumFractionDigits: 2 })],
  ];
  riepilogo.forEach(([label, val]) => {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120, 113, 108);
    doc.text(label + ':', 14, y);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(28, 25, 23);
    doc.text(val, 70, y);
    y += 6;
  });

  if (vendite.length > 0) {
    const sorted = [...vendite].sort((a, b) => b.data_vendita.localeCompare(a.data_vendita) || b.created_at.localeCompare(a.created_at));
    autoTable(doc, {
      startY: y + 4,
      head: [['Data', 'Prodotto', 'Qtà', 'Prezzo unit. (€)', 'Totale (€)', 'Note']],
      body: sorted.map(v => [
        new Date(v.data_vendita).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' }),
        v.nome_prodotto,
        String(v.quantita),
        v.prezzo_unitario.toFixed(2),
        v.totale.toFixed(2),
        v.note || '',
      ]),
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [20, 184, 166], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [240, 253, 250] },
      columnStyles: { 0: { cellWidth: 28 }, 1: { cellWidth: 55 }, 5: { cellWidth: 30 } },
    });
  }

  if (confronto) {
    const afterTable = (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? y + 10;
    pdfSezConfronto(doc, confronto, afterTable);
  }

  await saveFile('rivendita', `rivendita-${parr.nome.toLowerCase().replace(/\s/g, '-')}-${periodoLabel.replace(/\s/g, '-')}.pdf`, doc.output('blob'));
}

async function esportaTrattamentiPDF(parr: Parrucchiere, trattamenti: Trattamento[], periodoLabel: string) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(28, 25, 23);
  doc.text('Trattamenti — ' + parr.nome, 14, 18);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(120, 113, 108);
  doc.text('Periodo: ' + periodoLabel, 14, 25);
  doc.text('Generato il ' + new Date().toLocaleDateString('it-IT'), 14, 30);
  doc.setDrawColor(231, 229, 228);
  doc.line(14, 33, doc.internal.pageSize.width - 14, 33);

  const totale = trattamenti.reduce((s, t) => s + t.prezzo, 0);
  let y = 40;
  const riepilogo: [string, string][] = [
    ['Numero trattamenti', String(trattamenti.length)],
    ['Totale incassato', '€' + totale.toLocaleString('it-IT', { minimumFractionDigits: 2 })],
  ];
  riepilogo.forEach(([label, val]) => {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120, 113, 108);
    doc.text(label + ':', 14, y);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(28, 25, 23);
    doc.text(val, 70, y);
    y += 6;
  });

  if (trattamenti.length > 0) {
    const sorted = [...trattamenti].sort((a, b) => b.data_esecuzione.localeCompare(a.data_esecuzione) || b.created_at.localeCompare(a.created_at));
    autoTable(doc, {
      startY: y + 4,
      head: [['Data', 'Trattamento', 'N°', 'Prezzo (€)', 'Note']],
      body: sorted.map(t => [
        new Date(t.data_esecuzione).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' }),
        t.nome_trattamento,
        '1',
        t.prezzo.toFixed(2),
        t.note || '',
      ]),
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [20, 184, 166], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [240, 253, 250] },
      columnStyles: { 0: { cellWidth: 28 }, 1: { cellWidth: 65 }, 2: { cellWidth: 10 }, 4: { cellWidth: 30 } },
    });

    // Top trattamenti
    const afterTable = (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? y + 10;
    let yTop = afterTable + 8;
    if (yTop > 260) { doc.addPage(); yTop = 20; }
    const nomiMap: Record<string, { count: number; totale: number }> = {};
    trattamenti.forEach(t => {
      if (!nomiMap[t.nome_trattamento]) nomiMap[t.nome_trattamento] = { count: 0, totale: 0 };
      nomiMap[t.nome_trattamento].count += 1;
      nomiMap[t.nome_trattamento].totale += t.prezzo;
    });
    const topTr = Object.entries(nomiMap).sort((a, b) => b[1].count - a[1].count).slice(0, 15);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(28, 25, 23);
    doc.text('Riepilogo per tipo', 14, yTop);
    autoTable(doc, {
      startY: yTop + 4,
      head: [['Trattamento', 'N° eseguiti', 'Incasso (€)']],
      body: topTr.map(([nome, d]) => [nome, String(d.count), d.totale.toFixed(2)]),
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [20, 184, 166], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [240, 253, 250] },
      columnStyles: { 0: { cellWidth: 90 } },
    });
  }

  await saveFile('rivendita', `trattamenti-${parr.nome.toLowerCase().replace(/\s/g, '-')}-${periodoLabel.replace(/\s/g, '-')}.pdf`, doc.output('blob'));
}

async function esportaTrattamentiExcel(parr: Parrucchiere, trattamenti: Trattamento[], periodoLabel: string) {
  const sep = ';';
  const esc = (s: string | number) => { const str = String(s); return str.includes(sep) || str.includes('"') || str.includes('\n') ? `"${str.replace(/"/g, '""')}"` : str; };
  const fmtItL = (n: number) => n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const rows: string[] = [];
  rows.push(`TRATTAMENTI — ${parr.nome}`);
  rows.push(`Periodo: ${periodoLabel}`);
  rows.push('');
  rows.push(['Data', 'Trattamento', 'Prezzo', 'Note'].map(esc).join(sep));

  const sorted = [...trattamenti].sort((a, b) => a.data_esecuzione.localeCompare(b.data_esecuzione));
  for (const t of sorted) {
    rows.push([
      new Date(t.data_esecuzione).toLocaleDateString('it-IT'),
      t.nome_trattamento,
      fmtItL(t.prezzo),
      t.note || '',
    ].map(esc).join(sep));
  }

  rows.push('');
  rows.push(['Totale trattamenti', String(trattamenti.length)].map(esc).join(sep));
  rows.push(['Totale incassato', fmtItL(trattamenti.reduce((s, t) => s + t.prezzo, 0))].map(esc).join(sep));

  rows.push('');
  rows.push('RIEPILOGO PER TIPO');
  rows.push(['Trattamento', 'N° eseguiti', 'Incasso totale'].map(esc).join(sep));
  const nomiMap: Record<string, { count: number; totale: number }> = {};
  trattamenti.forEach(t => {
    if (!nomiMap[t.nome_trattamento]) nomiMap[t.nome_trattamento] = { count: 0, totale: 0 };
    nomiMap[t.nome_trattamento].count += 1;
    nomiMap[t.nome_trattamento].totale += t.prezzo;
  });
  Object.entries(nomiMap).sort((a, b) => b[1].count - a[1].count).forEach(([nome, d]) => {
    rows.push([nome, String(d.count), fmtItL(d.totale)].map(esc).join(sep));
  });

  const csv = '\uFEFF' + rows.join('\r\n');
  await saveFile('rivendita', `trattamenti-${parr.nome.toLowerCase().replace(/\s/g, '-')}-${periodoLabel.replace(/\s/g, '-')}.csv`, csv, 'utf8');
}

async function esportaTotaleParrPDF(parr: Parrucchiere, vendite: Vendita[], trattamenti: Trattamento[], periodoLabel: string) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(28, 25, 23);
  doc.text('Rivendita e trattamenti — ' + parr.nome, 14, 18);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(120, 113, 108);
  doc.text('Periodo: ' + periodoLabel, 14, 25);
  doc.text('Generato il ' + new Date().toLocaleDateString('it-IT'), 14, 30);
  doc.setDrawColor(231, 229, 228);
  doc.line(14, 33, doc.internal.pageSize.width - 14, 33);

  const totRiv = vendite.reduce((s, v) => s + v.totale, 0);
  const totTr = trattamenti.reduce((s, t) => s + t.prezzo, 0);
  let y = 40;
  [
    ['Vendite', String(vendite.length)],
    ['Totale rivendita', '€' + totRiv.toLocaleString('it-IT', { minimumFractionDigits: 2 })],
    ['Trattamenti', String(trattamenti.length)],
    ['Totale trattamenti', '€' + totTr.toLocaleString('it-IT', { minimumFractionDigits: 2 })],
    ['TOTALE COMBINATO', '€' + (totRiv + totTr).toLocaleString('it-IT', { minimumFractionDigits: 2 })],
  ].forEach(([label, val]) => {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120, 113, 108);
    doc.text(label + ':', 14, y);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(28, 25, 23);
    doc.text(val, 80, y);
    y += 6;
  });

  if (vendite.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Rivendita', 14, y + 4);
    const sortedV = [...vendite].sort((a, b) => b.data_vendita.localeCompare(a.data_vendita));
    autoTable(doc, {
      startY: y + 8,
      head: [['Data', 'Prodotto', 'Qtà', 'Prezzo (€)', 'Totale (€)', 'Note']],
      body: sortedV.map(v => [
        new Date(v.data_vendita).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' }),
        v.nome_prodotto, String(v.quantita), v.prezzo_unitario.toFixed(2), v.totale.toFixed(2), v.note || '',
      ]),
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [20, 184, 166], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [240, 253, 250] },
    });
  }

  if (trattamenti.length > 0) {
    const afterV = (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? y + 10;
    let yT = afterV + 8;
    if (yT > 260) { doc.addPage(); yT = 20; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(28, 25, 23);
    doc.text('Trattamenti', 14, yT);
    const sortedT = [...trattamenti].sort((a, b) => b.data_esecuzione.localeCompare(a.data_esecuzione));
    autoTable(doc, {
      startY: yT + 4,
      head: [['Data', 'Trattamento', 'Prezzo (€)', 'Note']],
      body: sortedT.map(t => [
        new Date(t.data_esecuzione).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' }),
        t.nome_trattamento, t.prezzo.toFixed(2), t.note || '',
      ]),
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [20, 184, 166], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [240, 253, 250] },
    });
  }

  await saveFile('rivendita', `totale-${parr.nome.toLowerCase().replace(/\s/g, '-')}-${periodoLabel.replace(/\s/g, '-')}.pdf`, doc.output('blob'));
}

async function esportaTotaleParrExcel(parr: Parrucchiere, vendite: Vendita[], trattamenti: Trattamento[], periodoLabel: string) {
  const sep = ';';
  const esc = (s: string | number) => { const str = String(s); return str.includes(sep) || str.includes('"') || str.includes('\n') ? `"${str.replace(/"/g, '""')}"` : str; };
  const fmtItL = (n: number) => n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const rows: string[] = [];
  rows.push(`RIVENDITA E TRATTAMENTI — ${parr.nome}`);
  rows.push(`Periodo: ${periodoLabel}`);
  rows.push('');

  rows.push('RIVENDITA');
  rows.push(['Data', 'Prodotto', 'Quantità', 'Prezzo unitario', 'Totale', 'Note'].map(esc).join(sep));
  [...vendite].sort((a, b) => a.data_vendita.localeCompare(b.data_vendita)).forEach(v => {
    rows.push([
      new Date(v.data_vendita).toLocaleDateString('it-IT'),
      v.nome_prodotto, v.quantita, fmtItL(v.prezzo_unitario), fmtItL(v.totale), v.note || '',
    ].map(esc).join(sep));
  });
  rows.push(['Totale rivendita', fmtItL(vendite.reduce((s, v) => s + v.totale, 0))].map(esc).join(sep));

  rows.push('');
  rows.push('');

  rows.push('TRATTAMENTI');
  rows.push(['Data', 'Trattamento', 'Prezzo', 'Note'].map(esc).join(sep));
  [...trattamenti].sort((a, b) => a.data_esecuzione.localeCompare(b.data_esecuzione)).forEach(t => {
    rows.push([
      new Date(t.data_esecuzione).toLocaleDateString('it-IT'),
      t.nome_trattamento, fmtItL(t.prezzo), t.note || '',
    ].map(esc).join(sep));
  });
  rows.push(['Totale trattamenti', fmtItL(trattamenti.reduce((s, t) => s + t.prezzo, 0))].map(esc).join(sep));

  rows.push('');
  rows.push(['TOTALE COMBINATO', fmtItL(vendite.reduce((s, v) => s + v.totale, 0) + trattamenti.reduce((s, t) => s + t.prezzo, 0))].map(esc).join(sep));

  const csv = '\uFEFF' + rows.join('\r\n');
  await saveFile('rivendita', `totale-${parr.nome.toLowerCase().replace(/\s/g, '-')}-${periodoLabel.replace(/\s/g, '-')}.csv`, csv, 'utf8');
}

async function esportaTotaleRivenditaPDF(vendite: Vendita[], trattamenti: Trattamento[], confronto?: PdfConfrRiv) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const annoCorrente = new Date().getFullYear();

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(28, 25, 23);
  doc.text('Rivendita — Riepilogo totale', 14, 18);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(120, 113, 108);
  doc.text(`Anno ${annoCorrente} + storico completo`, 14, 25);
  doc.text('Generato il ' + new Date().toLocaleDateString('it-IT'), 14, 30);
  doc.setDrawColor(231, 229, 228);
  doc.line(14, 33, doc.internal.pageSize.width - 14, 33);

  const venditeCorrente = vendite.filter(v => new Date(v.data_vendita).getFullYear() === annoCorrente);
  const totaleCorrente = venditeCorrente.reduce((s, v) => s + v.totale, 0);
  const totaleGlobale = vendite.reduce((s, v) => s + v.totale, 0);

  let y = 40;
  const riepilogo: [string, string][] = [
    [`Vendite ${annoCorrente}`, String(venditeCorrente.length)],
    [`Incasso ${annoCorrente}`, '€' + totaleCorrente.toLocaleString('it-IT', { minimumFractionDigits: 2 })],
    ['Totale storico vendite', String(vendite.length)],
    ['Totale storico incassato', '€' + totaleGlobale.toLocaleString('it-IT', { minimumFractionDigits: 2 })],
  ];
  riepilogo.forEach(([label, val]) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(120, 113, 108);
    doc.text(label + ':', 14, y);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(28, 25, 23);
    doc.text(val, 90, y);
    y += 6;
  });

  // Top prodotti per ricavo
  const prodMap: Record<string, { quantita: number; totale: number }> = {};
  vendite.forEach(v => {
    if (!prodMap[v.nome_prodotto]) prodMap[v.nome_prodotto] = { quantita: 0, totale: 0 };
    prodMap[v.nome_prodotto].quantita += v.quantita;
    prodMap[v.nome_prodotto].totale += v.totale;
  });
  const topProd = Object.entries(prodMap)
    .sort((a, b) => b[1].totale - a[1].totale)
    .slice(0, 20);

  if (topProd.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(28, 25, 23);
    doc.text('Top prodotti (storico)', 14, y + 4);
    autoTable(doc, {
      startY: y + 8,
      head: [['Prodotto', 'Quantità venduta', 'Ricavo totale (€)']],
      body: topProd.map(([nome, d]) => [nome, String(d.quantita), d.totale.toFixed(2)]),
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [20, 184, 166], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [240, 253, 250] },
      columnStyles: { 0: { cellWidth: 90 } },
    });
  }

  if (confronto) {
    const afterTable = (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? y + 10;
    pdfSezConfronto(doc, confronto, afterTable);
  }

  // Trattamenti nel PDF
  if (trattamenti.length > 0) {
    const afterRiv = (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? y + 10;
    let yT = afterRiv + 8;
    if (yT > 260) { doc.addPage(); yT = 20; }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(28, 25, 23);
    doc.text('Trattamenti (storico)', 14, yT);

    const trattCorr = trattamenti.filter(t => new Date(t.data_esecuzione).getFullYear() === annoCorrente);
    const totTrComp = trattamenti.reduce((s, t) => s + t.prezzo, 0);
    const totTrCorr = trattCorr.reduce((s, t) => s + t.prezzo, 0);

    const riepilogoTr: [string, string][] = [
      [`Trattamenti ${annoCorrente}`, String(trattCorr.length)],
      [`Incasso trattamenti ${annoCorrente}`, '€' + totTrCorr.toLocaleString('it-IT', { minimumFractionDigits: 2 })],
      ['Totale storico trattamenti', String(trattamenti.length)],
      ['Totale storico incassato', '€' + totTrComp.toLocaleString('it-IT', { minimumFractionDigits: 2 })],
    ];
    yT += 5;
    riepilogoTr.forEach(([label, val]) => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(120, 113, 108);
      doc.text(label + ':', 14, yT);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(28, 25, 23);
      doc.text(val, 90, yT);
      yT += 6;
    });

    const nomiMap: Record<string, { count: number; totale: number }> = {};
    trattamenti.forEach(t => {
      if (!nomiMap[t.nome_trattamento]) nomiMap[t.nome_trattamento] = { count: 0, totale: 0 };
      nomiMap[t.nome_trattamento].count += 1;
      nomiMap[t.nome_trattamento].totale += t.prezzo;
    });
    const topTr = Object.entries(nomiMap).sort((a, b) => b[1].totale - a[1].totale).slice(0, 20);
    if (topTr.length > 0) {
      autoTable(doc, {
        startY: yT + 2,
        head: [['Trattamento', 'N° eseguiti', 'Incasso totale (€)']],
        body: topTr.map(([nome, d]) => [nome, String(d.count), d.totale.toFixed(2)]),
        styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: [20, 184, 166], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [240, 253, 250] },
        columnStyles: { 0: { cellWidth: 90 } },
      });
    }
  }

  if (confronto) {
    const afterTable = (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? y + 10;
    pdfSezConfronto(doc, confronto, afterTable);
  }

  await saveFile('rivendita', `rivendita-totale-${annoCorrente}.pdf`, doc.output('blob'));
}

// ─── Excel (CSV italiano) export totale ───────────────────────────────────────

function fmtIt(n: number): string {
  return n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function esportaTotaleExcel(vendite: Vendita[], trattamenti: Trattamento[]) {
  const annoCorrente = new Date().getFullYear();
  const sep = ';';
  const rows: string[] = [];

  const esc = (s: string | number) => {
    const str = String(s);
    return str.includes(sep) || str.includes('"') || str.includes('\n') ? `"${str.replace(/"/g, '""')}"` : str;
  };

  // ── Sezione Rivendita ──
  rows.push('RIVENDITA');
  rows.push(['Data', 'Prodotto', 'Quantità', 'Prezzo unitario', 'Totale', 'Note'].map(esc).join(sep));
  const sorted = [...vendite].sort((a, b) => a.data_vendita.localeCompare(b.data_vendita));
  for (const v of sorted) {
    rows.push([
      new Date(v.data_vendita).toLocaleDateString('it-IT'),
      v.nome_prodotto,
      v.quantita,
      fmtIt(v.prezzo_unitario),
      fmtIt(v.totale),
      v.note || '',
    ].map(esc).join(sep));
  }

  // Riepilogo rivendita
  rows.push('');
  const totRiv = vendite.reduce((s, v) => s + v.totale, 0);
  const totRivCorr = vendite.filter(v => new Date(v.data_vendita).getFullYear() === annoCorrente).reduce((s, v) => s + v.totale, 0);
  rows.push(['Totale storico rivendita', fmtIt(totRiv)].map(esc).join(sep));
  rows.push([`Totale rivendita ${annoCorrente}`, fmtIt(totRivCorr)].map(esc).join(sep));

  rows.push('');
  rows.push('');

  // ── Sezione Trattamenti ──
  rows.push('TRATTAMENTI');
  rows.push(['Data', 'Trattamento', 'Prezzo', 'Note'].map(esc).join(sep));
  const sortedTr = [...trattamenti].sort((a, b) => a.data_esecuzione.localeCompare(b.data_esecuzione));
  for (const t of sortedTr) {
    rows.push([
      new Date(t.data_esecuzione).toLocaleDateString('it-IT'),
      t.nome_trattamento,
      fmtIt(t.prezzo),
      t.note || '',
    ].map(esc).join(sep));
  }

  // Riepilogo trattamenti
  rows.push('');
  const totTr = trattamenti.reduce((s, t) => s + t.prezzo, 0);
  const totTrCorr = trattamenti.filter(t => new Date(t.data_esecuzione).getFullYear() === annoCorrente).reduce((s, t) => s + t.prezzo, 0);
  rows.push(['Totale storico trattamenti', fmtIt(totTr)].map(esc).join(sep));
  rows.push([`Totale trattamenti ${annoCorrente}`, fmtIt(totTrCorr)].map(esc).join(sep));

  rows.push('');
  rows.push(['TOTALE COMBINATO (storico)', fmtIt(totRiv + totTr)].map(esc).join(sep));
  rows.push([`TOTALE COMBINATO ${annoCorrente}`, fmtIt(totRivCorr + totTrCorr)].map(esc).join(sep));

  // BOM UTF-8 per Excel italiano
  const bom = '\uFEFF';
  const csv = bom + rows.join('\r\n');
  await saveFile('rivendita', `rivendita-trattamenti-${annoCorrente}.csv`, csv, 'utf8');
}

// ─── Grafico barre orizzontali ────────────────────────────────────────────────

function BarChart({ data, color }: { data: { label: string; value: number; pezzi?: number }[]; color: string }) {
  const max = Math.max(...data.map(d => d.value), 0.01);
  if (data.length === 0) return <p className="text-xs text-stone-400 text-center py-6">Nessun dato nel periodo</p>;
  return (
    <div className="space-y-2">
      {data.map(d => (
        <div key={d.label} className="flex items-center gap-2">
          <span className="text-xs text-stone-500 w-28 truncate flex-shrink-0">{d.label}</span>
          <div className="flex-1 h-5 bg-stone-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.max((d.value / max) * 100, d.value > 0 ? 4 : 0)}%`, backgroundColor: color }}
            />
          </div>
          {d.pezzi !== undefined && (
            <span className="text-xs text-stone-400 w-10 text-right flex-shrink-0">{d.pezzi}pz</span>
          )}
          <span className="text-xs font-semibold text-stone-700 w-16 text-right flex-shrink-0">€{fmt(d.value)}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Modal Nuova Vendita ──────────────────────────────────────────────────────

interface ProdottoCatalogo {
  id: string;
  nome: string;
  marca: string;
  categoria: string;
  prezzo_acquisto: number;
  prezzo_vendita: number;
}

function NuovaVenditaModal({ parrucchieri, parrucchierePreselezionato, onClose, onSaved }: {
  parrucchieri: Parrucchiere[];
  parrucchierePreselezionato?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const [form, setForm] = useState({
    parrucchiere_id: parrucchierePreselezionato || (parrucchieri[0]?.id ?? ''),
    nome_prodotto: '',
    quantita: 1,
    prezzo_unitario: 0,
    costo_unitario: 0,
    data_vendita: localDateStr(),
    note: '',
  });
  const [saving, setSaving] = useState(false);
  const [catalogo, setCatalogo] = useState<ProdottoCatalogo[]>([]);
  const [search, setSearch] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    dbSelect<ProdottoCatalogo>({
      table: 'prodotti_rivendita_catalogo',
      columns: ['id', 'nome', 'marca', 'categoria', 'prezzo_acquisto', 'prezzo_vendita'],
      filters: [{ col: 'attivo', op: 'eq', val: true }],
      orderBy: [{ col: 'categoria' }, { col: 'nome' }],
    }).then(({ data }) => setCatalogo((data || []) as ProdottoCatalogo[]));
  }, []);

  useEffect(() => {
    function onOut(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowSuggestions(false);
    }
    document.addEventListener('mousedown', onOut);
    return () => document.removeEventListener('mousedown', onOut);
  }, []);

  const suggerimenti = search.length >= 1
    ? catalogo.filter(p =>
        p.nome.toLowerCase().includes(search.toLowerCase()) ||
        (p.marca ?? '').toLowerCase().includes(search.toLowerCase())
      ).slice(0, 8)
    : catalogo.slice(0, 8);

  function selezionaProdotto(p: ProdottoCatalogo) {
    setForm(f => ({
      ...f,
      nome_prodotto: p.nome,
      prezzo_unitario: p.prezzo_vendita,
      costo_unitario: p.prezzo_acquisto,
    }));
    setSearch(p.nome);
    setShowSuggestions(false);
  }

  async function save() {
    if (!form.nome_prodotto || !form.parrucchiere_id) return;
    setSaving(true);
    dbInsert({
      table: 'rivendita_prodotti',
      data: {
        parrucchiere_id: form.parrucchiere_id,
        nome_prodotto: form.nome_prodotto,
        quantita: form.quantita,
        prezzo_unitario: form.prezzo_unitario,
        costo_unitario: form.costo_unitario,
        data_vendita: form.data_vendita,
        note: form.note,
        user_id: user?.id,
      },
    });
    setSaving(false);
    onSaved();
  }

  const totale = form.quantita * form.prezzo_unitario;
  const margine = form.quantita * (form.prezzo_unitario - form.costo_unitario);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-teal-100 rounded-lg flex items-center justify-center">
              <Package size={15} className="text-teal-600" />
            </div>
            <h2 className="font-bold text-stone-800">Registra vendita prodotto</h2>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-stone-100 rounded-lg transition-colors"><X size={16} /></button>
        </div>
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          <div>
            <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1.5">Parrucchiere</label>
            <select value={form.parrucchiere_id} onChange={e => setForm(f => ({ ...f, parrucchiere_id: e.target.value }))}
              className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-400">
              {parrucchieri.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </div>

          {/* Ricerca prodotto con autocomplete dal catalogo */}
          <div ref={searchRef} className="relative">
            <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1.5">
              Prodotto <span className="text-red-500">*</span>
            </label>
            <input
              value={search}
              onChange={e => {
                setSearch(e.target.value);
                setForm(f => ({ ...f, nome_prodotto: e.target.value }));
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              placeholder="Cerca nel catalogo o scrivi un nome..."
              className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-400"
            />
            {showSuggestions && suggerimenti.length > 0 && (
              <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-stone-200 rounded-xl shadow-lg overflow-hidden max-h-52 overflow-y-auto">
                {suggerimenti.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onMouseDown={() => selezionaProdotto(p)}
                    className="w-full flex items-center justify-between px-3 py-2.5 text-sm hover:bg-teal-50 transition-colors text-left gap-2"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-stone-800 truncate">{p.nome}</p>
                      <p className="text-xs text-stone-400 truncate">{p.marca}{p.categoria ? ` · ${p.categoria}` : ''}</p>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <p className="text-xs font-semibold text-teal-600">€{fmt(p.prezzo_vendita)}</p>
                      <p className="text-[10px] text-stone-400">costo €{fmt(p.prezzo_acquisto)}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1.5">Quantità</label>
              <input type="number" onInput={e => { const t = e.currentTarget; if (t.value.length > 1 && t.value.startsWith('0') && !t.value.startsWith('0.')) t.value = String(Number(t.value)); }} min={1} step={1} value={form.quantita} onChange={e => setForm(f => ({ ...f, quantita: Math.max(1, Number(e.target.value)) }))}
                onFocus={e => e.target.select()}
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-400" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1.5">Prezzo vendita (€)</label>
              <input type="number" onInput={e => { const t = e.currentTarget; if (t.value.length > 1 && t.value.startsWith('0') && !t.value.startsWith('0.')) t.value = String(Number(t.value)); }} min={0} step={0.5} value={form.prezzo_unitario} onChange={e => setForm(f => ({ ...f, prezzo_unitario: Number(e.target.value) }))}
                onFocus={e => e.target.select()}
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-400" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1.5">Costo acquisto (€)</label>
              <input type="number" onInput={e => { const t = e.currentTarget; if (t.value.length > 1 && t.value.startsWith('0') && !t.value.startsWith('0.')) t.value = String(Number(t.value)); }} min={0} step={0.5} value={form.costo_unitario} onChange={e => setForm(f => ({ ...f, costo_unitario: Number(e.target.value) }))}
                onFocus={e => e.target.select()}
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-400" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1.5">Data vendita</label>
            <input type="date" value={form.data_vendita} onChange={e => setForm(f => ({ ...f, data_vendita: e.target.value }))}
              className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-400" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1.5">Note</label>
            <input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder="Opzionali..."
              className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-400" />
          </div>
          {totale > 0 && (
            <div className="bg-teal-50 rounded-xl p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-teal-700 font-medium">Totale vendita</span>
                <span className="text-lg font-bold text-teal-700">€{fmt(totale)}</span>
              </div>
              {form.costo_unitario > 0 && (
                <div className="flex items-center justify-between border-t border-teal-100 pt-1.5">
                  <span className="text-xs text-teal-600">Margine</span>
                  <span className={`text-sm font-bold ${margine >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    €{fmt(margine)} ({totale > 0 ? Math.round((margine / totale) * 100) : 0}%)
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="flex gap-3 px-6 pb-6 flex-shrink-0">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-stone-200 text-sm font-medium text-stone-600 hover:bg-stone-50 transition-colors">Annulla</button>
          <button onClick={save} disabled={saving || !form.nome_prodotto || !form.parrucchiere_id} className="flex-1 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-sm font-semibold transition-colors disabled:opacity-50">
            {saving ? 'Salvataggio...' : 'Registra vendita'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Cassetto Parrucchiere ─────────────────────────────────────────────────────

function CassettoParrucchiere({ parr, venditeAll, periodo, anni, onPeriodoChange, onNuova, onDelete, vistaValore }: {
  parr: Parrucchiere;
  venditeAll: Vendita[];
  periodo: PeriodoKey;
  anni: number[];
  onPeriodoChange: (v: PeriodoKey) => void;
  onNuova: () => void;
  onDelete: (id: string) => void;
  vistaValore: 'fatturato' | 'margine';
}) {
  const [expanded, setExpanded] = useState(true);
  const [showConfronto, setShowConfronto] = useState(false);
  const todayRiv = new Date().toISOString().slice(0, 10);
  const [confA1, setConfA1] = useState(todayRiv);
  const [confA2, setConfA2] = useState(todayRiv);
  const [confB1, setConfB1] = useState(todayRiv);
  const [confB2, setConfB2] = useState(todayRiv);

  const vendite = filtraPerPeriodo(
    venditeAll.filter(v => v.parrucchiere_id === parr.id),
    periodo
  );

  const valoreVendita = (v: Vendita) => vistaValore === 'margine' ? v.totale - (v.costo_unitario ?? 0) * v.quantita : v.totale;

  const totaleVendite = vendite.reduce((s, v) => s + valoreVendita(v), 0);
  const nVendite = vendite.length;

  const pA = `da:${confA1}:a:${confA2 >= confA1 ? confA2 : confA1}` as PeriodoKey;
  const pB = `da:${confB1}:a:${confB2 >= confB1 ? confB2 : confB1}` as PeriodoKey;
  const tutte = venditeAll.filter(v => v.parrucchiere_id === parr.id);
  const venditeA = filtraPerPeriodo(tutte, pA);
  const venditeB = filtraPerPeriodo(tutte, pB);
  const nA = venditeA.length, nB = venditeB.length;
  const totA = venditeA.reduce((s, v) => s + valoreVendita(v), 0);
  const totB = venditeB.reduce((s, v) => s + valoreVendita(v), 0);

  // Grafico per prodotto
  const perProdotto: Record<string, { value: number; pezzi: number }> = {};
  for (const v of vendite) {
    if (!perProdotto[v.nome_prodotto]) perProdotto[v.nome_prodotto] = { value: 0, pezzi: 0 };
    perProdotto[v.nome_prodotto].value += valoreVendita(v);
    perProdotto[v.nome_prodotto].pezzi += v.quantita;
  }
  const prodottiData = Object.entries(perProdotto)
    .map(([label, { value, pezzi }]) => ({ label, value, pezzi }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  return (
    <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
      {/* Header cassetto */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-stone-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
            style={{ backgroundColor: parr.colore }}>
            {parr.nome.slice(0, 1).toUpperCase()}
          </div>
          <div className="text-left">
            <p className="font-bold text-stone-800">{parr.nome}</p>
            <p className="text-xs text-stone-400">{nVendite} {nVendite === 1 ? 'vendita' : 'vendite'} · {vistaValore === 'margine' ? 'Margine ' : ''}€{fmt(totaleVendite)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={e => { e.stopPropagation(); onNuova(); }}
            className="flex items-center gap-1.5 bg-teal-500 hover:bg-teal-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
          >
            <Plus size={12} />
            Vendita
          </button>
          <ChevronDown size={16} className={`text-stone-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {expanded && (
        <div className="border-t border-stone-100">
          {/* Periodo selector */}
          <div className="px-5 py-3 flex items-center justify-between border-b border-stone-50">
            <div className="flex items-center gap-2">
              <BarChart2 size={14} className="text-stone-400" />
              <span className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Periodo</span>
            </div>
            <div className="flex items-center gap-2">
              <PeriodoSelector valore={periodo} onChange={onPeriodoChange} anni={anni} />
              <button
                onClick={() => setShowConfronto(s => !s)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-medium shadow-sm transition-colors ${showConfronto ? 'bg-teal-500 border-teal-500 text-white' : 'border-stone-200 bg-white hover:bg-stone-50 text-stone-600'}`}
                title="Confronta due periodi"
              >
                <GitCompare size={14} />
                <span className="hidden sm:inline">Confronta</span>
              </button>
              {vendite.length > 0 && (
                <button
                  onClick={() => esportaRivenditaPDF(
                    parr, vendite, labelPeriodo(periodo),
                    showConfronto ? mkRivConfronto([
                      { label: 'Numero vendite', corrente: nA, precedente: nB, fmtFn: v => String(Math.round(v)) },
                      { label: 'Totale incassato', corrente: totA, precedente: totB, fmtFn: v => `€${fmt(v)}` },
                    ], `${fmtData(confA1)} — ${fmtData(confA2 >= confA1 ? confA2 : confA1)}`, `${fmtData(confB1)} — ${fmtData(confB2 >= confB1 ? confB2 : confB1)}`) : undefined
                  )}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-600 text-sm font-medium shadow-sm transition-colors"
                  title="Esporta PDF"
                >
                  <Download size={14} />
                  <span className="hidden sm:inline">PDF</span>
                </button>
              )}
            </div>
          </div>

          <div className="p-5 grid lg:grid-cols-2 gap-6">
            {/* Stats */}
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-stone-50 rounded-xl p-3 text-center">
                  <p className="text-xl font-bold text-stone-800">{nVendite}</p>
                  <p className="text-xs text-stone-400">Vendite</p>
                </div>
                <div className="bg-stone-50 rounded-xl p-3 text-center">
                  <p className="text-lg font-bold text-teal-600">€{fmt(totaleVendite)}</p>
                  <p className="text-xs text-stone-400">{vistaValore === 'margine' ? 'Margine' : 'Totale'}</p>
                </div>
              </div>

              {showConfronto && (
                <div className="rounded-2xl border border-stone-200 overflow-hidden">
                  <div className="px-4 py-3 bg-stone-50 border-b border-stone-100">
                    <p className="text-xs font-semibold text-stone-600">Confronto periodi personalizzato</p>
                    <p className="text-xs text-stone-400 mt-0.5">Scegli due intervalli di date per confrontarli</p>
                  </div>
                  <div className="p-4 space-y-4">
                    <div className="flex flex-col sm:flex-row gap-4">
                      <DateRangeInput label="Periodo A" da={confA1} a={confA2} onDa={setConfA1} onA={setConfA2} colore={parr.colore} />
                      <DateRangeInput label="Periodo B" da={confB1} a={confB2} onDa={setConfB1} onA={setConfB2} colore="#a8a29e" />
                    </div>
                    <PannelloConfronto
                      colore={parr.colore}
                      labelA={`${fmtData(confA1)} — ${fmtData(confA2 >= confA1 ? confA2 : confA1)}`}
                      labelB={`${fmtData(confB1)} — ${fmtData(confB2 >= confB1 ? confB2 : confB1)}`}
                      righe={[
                        { label: 'Numero vendite', corrente: nA, precedente: nB, fmt: v => String(Math.round(v)) },
                        { label: vistaValore === 'margine' ? 'Margine' : 'Totale incassato', corrente: totA, precedente: totB, fmt: v => `€${fmt(v)}` },
                      ]}
                    />
                  </div>
                </div>
              )}

              {/* Grafico per prodotto */}
              <div>
                <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-3">Top prodotti {vistaValore === 'margine' ? '(per margine)' : ''}</p>
                <BarChart data={prodottiData} color={parr.colore} />
              </div>
            </div>

            {/* Lista vendite */}
            <div>
              <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-3">Ultime vendite</p>
              {vendite.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Package size={24} className="text-stone-200 mb-2" />
                  <p className="text-sm text-stone-400">Nessuna vendita nel periodo</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {[...vendite].sort((a, b) => b.data_vendita.localeCompare(a.data_vendita) || b.created_at.localeCompare(a.created_at)).map(v => (
                    <div key={v.id} className="flex items-center justify-between p-2.5 rounded-xl bg-stone-50 group hover:bg-stone-100 transition-colors">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-stone-700 truncate">{v.nome_prodotto}</p>
                        <p className="text-xs text-stone-400">
                          {new Date(v.data_vendita).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })}
                          {v.quantita > 1 && ` · x${v.quantita}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="text-right">
                          <span className="text-sm font-bold text-teal-600">€{fmt(valoreVendita(v))}</span>
                          {vistaValore === 'margine' && v.costo_unitario > 0 && (
                            <p className="text-[10px] text-stone-400 leading-none">su €{fmt(v.totale)}</p>
                          )}
                        </div>
                        <button onClick={() => onDelete(v.id)} className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-red-100 text-red-500">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Cassetto Trattamenti ─────────────────────────────────────────────────────

function filtraTrattamentiPerPeriodo(items: Trattamento[], periodo: PeriodoKey): Trattamento[] {
  return items.filter(t => {
    const dateStr = t.data_esecuzione;
    const y = Number(dateStr.split('-')[0]);
    if (periodo === 'corrente') return y === annoCorrente;
    if (periodo === 'sempre') return true;
    if (isMese(periodo)) {
      const [py, pm] = periodo.split('-');
      return dateStr.slice(0, 7) === `${py}-${pm}`;
    }
    if (isIntervallo(periodo)) {
      const { da, a } = parseIntervallo(periodo);
      return dateStr >= intervalloStartDate(da) && dateStr <= intervalloEndDate(a);
    }
    return y === Number(periodo);
  });
}

function CassettoTrattamenti({ parr, trattamentiAll, periodo, anni, onPeriodoChange }: {
  parr: Parrucchiere;
  trattamentiAll: Trattamento[];
  periodo: PeriodoKey;
  anni: number[];
  onPeriodoChange: (v: PeriodoKey) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [showConfronto, setShowConfronto] = useState(false);
  const todayT = new Date().toISOString().slice(0, 10);
  const [confA1, setConfA1] = useState(todayT);
  const [confA2, setConfA2] = useState(todayT);
  const [confB1, setConfB1] = useState(todayT);
  const [confB2, setConfB2] = useState(todayT);

  const tuttiParr = trattamentiAll.filter(t => t.parrucchiere_id === parr.id);
  const trattamenti = filtraTrattamentiPerPeriodo(tuttiParr, periodo);

  const totale = trattamenti.reduce((s, t) => s + t.prezzo, 0);
  const nTrattamenti = trattamenti.length;

  const pA = `da:${confA1}:a:${confA2 >= confA1 ? confA2 : confA1}` as PeriodoKey;
  const pB = `da:${confB1}:a:${confB2 >= confB1 ? confB2 : confB1}` as PeriodoKey;
  const trattA = filtraTrattamentiPerPeriodo(tuttiParr, pA);
  const trattB = filtraTrattamentiPerPeriodo(tuttiParr, pB);
  const nA = trattA.length, nB = trattB.length;
  const totA = trattA.reduce((s, t) => s + t.prezzo, 0);
  const totB = trattB.reduce((s, t) => s + t.prezzo, 0);

  const perNome: Record<string, { value: number; pezzi: number }> = {};
  for (const t of trattamenti) {
    if (!perNome[t.nome_trattamento]) perNome[t.nome_trattamento] = { value: 0, pezzi: 0 };
    perNome[t.nome_trattamento].value += t.prezzo;
    perNome[t.nome_trattamento].pezzi += 1;
  }
  const nomiData = Object.entries(perNome)
    .map(([label, { value, pezzi }]) => ({ label, value, pezzi }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  return (
    <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-stone-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
            style={{ backgroundColor: parr.colore }}>
            {parr.nome.slice(0, 1).toUpperCase()}
          </div>
          <div className="text-left">
            <p className="font-bold text-stone-800">{parr.nome}</p>
            <p className="text-xs text-stone-400">{nTrattamenti} {nTrattamenti === 1 ? 'trattamento' : 'trattamenti'} · €{fmt(totale)}</p>
          </div>
        </div>
        <ChevronDown size={16} className={`text-stone-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {expanded && (
        <div className="border-t border-stone-100">
          <div className="px-5 py-3 flex items-center justify-between border-b border-stone-50">
            <div className="flex items-center gap-2">
              <BarChart2 size={14} className="text-stone-400" />
              <span className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Periodo</span>
            </div>
            <div className="flex items-center gap-2">
              <PeriodoSelector valore={periodo} onChange={onPeriodoChange} anni={anni} />
              <button
                onClick={() => setShowConfronto(s => !s)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-medium shadow-sm transition-colors ${showConfronto ? 'bg-teal-500 border-teal-500 text-white' : 'border-stone-200 bg-white hover:bg-stone-50 text-stone-600'}`}
                title="Confronta due periodi"
              >
                <GitCompare size={14} />
                <span className="hidden sm:inline">Confronta</span>
              </button>
              {trattamenti.length > 0 && (
                <>
                  <button
                    onClick={() => esportaTrattamentiPDF(parr, trattamenti, labelPeriodo(periodo))}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-600 text-sm font-medium shadow-sm transition-colors"
                    title="Esporta PDF trattamenti"
                  >
                    <Download size={14} />
                    <span className="hidden sm:inline">PDF</span>
                  </button>
                  <button
                    onClick={() => esportaTrattamentiExcel(parr, trattamenti, labelPeriodo(periodo))}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-600 text-sm font-medium shadow-sm transition-colors"
                    title="Esporta Excel trattamenti"
                  >
                    <Download size={14} />
                    <span className="hidden sm:inline">Excel</span>
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="p-5 grid lg:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-stone-50 rounded-xl p-3 text-center">
                  <p className="text-xl font-bold text-stone-800">{nTrattamenti}</p>
                  <p className="text-xs text-stone-400">Trattamenti</p>
                </div>
                <div className="bg-stone-50 rounded-xl p-3 text-center">
                  <p className="text-lg font-bold" style={{ color: parr.colore }}>€{fmt(totale)}</p>
                  <p className="text-xs text-stone-400">Totale</p>
                </div>
              </div>

              {showConfronto && (
                <div className="rounded-2xl border border-stone-200 overflow-hidden">
                  <div className="px-4 py-3 bg-stone-50 border-b border-stone-100">
                    <p className="text-xs font-semibold text-stone-600">Confronto periodi personalizzato</p>
                    <p className="text-xs text-stone-400 mt-0.5">Scegli due intervalli di date per confrontarli</p>
                  </div>
                  <div className="p-4 space-y-4">
                    <div className="flex flex-col sm:flex-row gap-4">
                      <DateRangeInput label="Periodo A" da={confA1} a={confA2} onDa={setConfA1} onA={setConfA2} colore={parr.colore} />
                      <DateRangeInput label="Periodo B" da={confB1} a={confB2} onDa={setConfB1} onA={setConfB2} colore="#a8a29e" />
                    </div>
                    <PannelloConfronto
                      colore={parr.colore}
                      labelA={`${fmtData(confA1)} — ${fmtData(confA2 >= confA1 ? confA2 : confA1)}`}
                      labelB={`${fmtData(confB1)} — ${fmtData(confB2 >= confB1 ? confB2 : confB1)}`}
                      righe={[
                        { label: 'Numero trattamenti', corrente: nA, precedente: nB, fmt: v => String(Math.round(v)) },
                        { label: 'Totale incassato', corrente: totA, precedente: totB, fmt: v => `€${fmt(v)}` },
                      ]}
                    />
                  </div>
                </div>
              )}

              <div>
                <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-3">Top trattamenti</p>
                <BarChart data={nomiData} color={parr.colore} />
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-3">Ultimi trattamenti</p>
              {trattamenti.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Scissors size={24} className="text-stone-200 mb-2" />
                  <p className="text-sm text-stone-400">Nessun trattamento nel periodo</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {[...trattamenti].sort((a, b) => b.data_esecuzione.localeCompare(a.data_esecuzione) || b.created_at.localeCompare(a.created_at)).map(t => (
                    <div key={t.id} className="flex items-center justify-between p-2.5 rounded-xl bg-stone-50 hover:bg-stone-100 transition-colors">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-stone-700 truncate">{t.nome_trattamento}</p>
                        <p className="text-xs text-stone-400">
                          {new Date(t.data_esecuzione).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                      <span className="text-sm font-bold flex-shrink-0" style={{ color: parr.colore }}>€{fmt(t.prezzo)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Cassetto Totale (Rivendita + Trattamenti) ────────────────────────────────

function CassettoTotale({ parr, venditeAll, trattamentiAll, periodo, anni, onPeriodoChange }: {
  parr: Parrucchiere;
  venditeAll: Vendita[];
  trattamentiAll: Trattamento[];
  periodo: PeriodoKey;
  anni: number[];
  onPeriodoChange: (v: PeriodoKey) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [showConfronto, setShowConfronto] = useState(false);
  const todayT = new Date().toISOString().slice(0, 10);
  const [confA1, setConfA1] = useState(todayT);
  const [confA2, setConfA2] = useState(todayT);
  const [confB1, setConfB1] = useState(todayT);
  const [confB2, setConfB2] = useState(todayT);

  const tutteVendite = venditeAll.filter(v => v.parrucchiere_id === parr.id);
  const tuttiTratt = trattamentiAll.filter(t => t.parrucchiere_id === parr.id);

  const vendite = filtraPerPeriodo(tutteVendite, periodo);
  const trattamenti = filtraTrattamentiPerPeriodo(tuttiTratt, periodo);

  const totaleVendite = vendite.reduce((s, v) => s + v.totale, 0);
  const totaleTrattamenti = trattamenti.reduce((s, t) => s + t.prezzo, 0);
  const totale = totaleVendite + totaleTrattamenti;

  const pA = `da:${confA1}:a:${confA2 >= confA1 ? confA2 : confA1}` as PeriodoKey;
  const pB = `da:${confB1}:a:${confB2 >= confB1 ? confB2 : confB1}` as PeriodoKey;
  const vendA = filtraPerPeriodo(tutteVendite, pA);
  const vendB = filtraPerPeriodo(tutteVendite, pB);
  const trattA = filtraTrattamentiPerPeriodo(tuttiTratt, pA);
  const trattB = filtraTrattamentiPerPeriodo(tuttiTratt, pB);
  const totA = vendA.reduce((s, v) => s + v.totale, 0) + trattA.reduce((s, t) => s + t.prezzo, 0);
  const totB = vendB.reduce((s, v) => s + v.totale, 0) + trattB.reduce((s, t) => s + t.prezzo, 0);
  const nA = vendA.length + trattA.length;
  const nB = vendB.length + trattB.length;

  // Unifica voci per grafico
  const perVoce: Record<string, number> = {};
  for (const v of vendite) perVoce[v.nome_prodotto] = (perVoce[v.nome_prodotto] || 0) + v.totale;
  for (const t of trattamenti) perVoce[t.nome_trattamento] = (perVoce[t.nome_trattamento] || 0) + t.prezzo;
  const vociData = Object.entries(perVoce)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  // Lista unificata
  type VoceUnificata = { id: string; nome: string; importo: number; data: string; tipo: 'rivendita' | 'trattamento' };
  const listaUnificata: VoceUnificata[] = [
    ...vendite.map(v => ({ id: v.id, nome: v.nome_prodotto, importo: v.totale, data: v.data_vendita, tipo: 'rivendita' as const })),
    ...trattamenti.map(t => ({ id: t.id, nome: t.nome_trattamento, importo: t.prezzo, data: t.data_esecuzione, tipo: 'trattamento' as const })),
  ].sort((a, b) => b.data.localeCompare(a.data));

  return (
    <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-stone-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
            style={{ backgroundColor: parr.colore }}>
            {parr.nome.slice(0, 1).toUpperCase()}
          </div>
          <div className="text-left">
            <p className="font-bold text-stone-800">{parr.nome}</p>
            <p className="text-xs text-stone-400">
              {vendite.length} {vendite.length === 1 ? 'vendita' : 'vendite'} · {trattamenti.length} {trattamenti.length === 1 ? 'trattamento' : 'trattamenti'} · €{fmt(totale)}
            </p>
          </div>
        </div>
        <ChevronDown size={16} className={`text-stone-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {expanded && (
        <div className="border-t border-stone-100">
          <div className="px-5 py-3 flex items-center justify-between border-b border-stone-50">
            <div className="flex items-center gap-2">
              <BarChart2 size={14} className="text-stone-400" />
              <span className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Periodo</span>
            </div>
            <div className="flex items-center gap-2">
              <PeriodoSelector valore={periodo} onChange={onPeriodoChange} anni={anni} />
              <button
                onClick={() => setShowConfronto(s => !s)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-medium shadow-sm transition-colors ${showConfronto ? 'bg-teal-500 border-teal-500 text-white' : 'border-stone-200 bg-white hover:bg-stone-50 text-stone-600'}`}
                title="Confronta due periodi"
              >
                <GitCompare size={14} />
                <span className="hidden sm:inline">Confronta</span>
              </button>
              {(vendite.length > 0 || trattamenti.length > 0) && (
                <>
                  <button
                    onClick={() => esportaTotaleParrPDF(parr, vendite, trattamenti, labelPeriodo(periodo))}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-600 text-sm font-medium shadow-sm transition-colors"
                    title="Esporta PDF totale"
                  >
                    <Download size={14} />
                    <span className="hidden sm:inline">PDF</span>
                  </button>
                  <button
                    onClick={() => esportaTotaleParrExcel(parr, vendite, trattamenti, labelPeriodo(periodo))}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-600 text-sm font-medium shadow-sm transition-colors"
                    title="Esporta Excel totale"
                  >
                    <Download size={14} />
                    <span className="hidden sm:inline">Excel</span>
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="p-5 grid lg:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-stone-50 rounded-xl p-3 text-center">
                  <p className="text-lg font-bold text-teal-600">€{fmt(totaleVendite)}</p>
                  <p className="text-xs text-stone-400">Rivendita</p>
                </div>
                <div className="bg-stone-50 rounded-xl p-3 text-center">
                  <p className="text-lg font-bold text-amber-600">€{fmt(totaleTrattamenti)}</p>
                  <p className="text-xs text-stone-400">Trattamenti</p>
                </div>
                <div className="bg-stone-50 rounded-xl p-3 text-center">
                  <p className="text-lg font-bold" style={{ color: parr.colore }}>€{fmt(totale)}</p>
                  <p className="text-xs text-stone-400">Totale</p>
                </div>
              </div>

              {showConfronto && (
                <div className="rounded-2xl border border-stone-200 overflow-hidden">
                  <div className="px-4 py-3 bg-stone-50 border-b border-stone-100">
                    <p className="text-xs font-semibold text-stone-600">Confronto periodi personalizzato</p>
                    <p className="text-xs text-stone-400 mt-0.5">Scegli due intervalli di date per confrontarli</p>
                  </div>
                  <div className="p-4 space-y-4">
                    <div className="flex flex-col sm:flex-row gap-4">
                      <DateRangeInput label="Periodo A" da={confA1} a={confA2} onDa={setConfA1} onA={setConfA2} colore={parr.colore} />
                      <DateRangeInput label="Periodo B" da={confB1} a={confB2} onDa={setConfB1} onA={setConfB2} colore="#a8a29e" />
                    </div>
                    <PannelloConfronto
                      colore={parr.colore}
                      labelA={`${fmtData(confA1)} — ${fmtData(confA2 >= confA1 ? confA2 : confA1)}`}
                      labelB={`${fmtData(confB1)} — ${fmtData(confB2 >= confB1 ? confB2 : confB1)}`}
                      righe={[
                        { label: 'Numero voci totali', corrente: nA, precedente: nB, fmt: v => String(Math.round(v)) },
                        { label: 'Rivendita', corrente: vendA.reduce((s, v) => s + v.totale, 0), precedente: vendB.reduce((s, v) => s + v.totale, 0), fmt: v => `€${fmt(v)}` },
                        { label: 'Trattamenti', corrente: trattA.reduce((s, t) => s + t.prezzo, 0), precedente: trattB.reduce((s, t) => s + t.prezzo, 0), fmt: v => `€${fmt(v)}` },
                        { label: 'Totale incassato', corrente: totA, precedente: totB, fmt: v => `€${fmt(v)}` },
                      ]}
                    />
                  </div>
                </div>
              )}

              <div>
                <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-3">Top voci</p>
                <BarChart data={vociData} color={parr.colore} />
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-3">Ultime voci</p>
              {listaUnificata.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <BarChart2 size={24} className="text-stone-200 mb-2" />
                  <p className="text-sm text-stone-400">Nessuna voce nel periodo</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {listaUnificata.map(v => (
                    <div key={`${v.tipo}-${v.id}`} className="flex items-center justify-between p-2.5 rounded-xl bg-stone-50 hover:bg-stone-100 transition-colors">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${v.tipo === 'rivendita' ? 'bg-teal-500' : 'bg-amber-500'}`} />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-stone-700 truncate">{v.nome}</p>
                          <p className="text-xs text-stone-400">
                            {new Date(v.data).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })}
                            {' · '}
                            <span className={v.tipo === 'rivendita' ? 'text-teal-600' : 'text-amber-600'}>{v.tipo === 'rivendita' ? 'Rivendita' : 'Trattamento'}</span>
                          </p>
                        </div>
                      </div>
                      <span className="text-sm font-bold flex-shrink-0" style={{ color: parr.colore }}>€{fmt(v.importo)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type MainTab = 'rivendita' | 'trattamenti' | 'totale';

export default function Rivendita() {
  const [activeTab, setActiveTab] = useState<MainTab>('rivendita');
  const [parrucchieri, setParrucchieri] = useState<Parrucchiere[]>([]);
  const [vendite, setVendite] = useState<Vendita[]>([]);
  const [trattamenti, setTrattamenti] = useState<Trattamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodi, setPeriodi] = useState<Record<string, PeriodoKey>>({});
  const [periodiTratt, setPeriodiTratt] = useState<Record<string, PeriodoKey>>({});
  const [periodiTotale, setPeriodiTotale] = useState<Record<string, PeriodoKey>>({});
  const [anniDisp, setAnniDisp] = useState<number[]>([annoCorrente]);
  const [anniDispTratt, setAnniDispTratt] = useState<number[]>([annoCorrente]);
  const [anniDispTotale, setAnniDispTotale] = useState<number[]>([annoCorrente]);
  const [nuovaVenditaParr, setNuovaVenditaParr] = useState<string | null>(null);
  const [vistaValore, setVistaValore] = useState<'fatturato' | 'margine'>('fatturato');
  const todayGlob = new Date().toISOString().slice(0, 10);
  const [showConfrontoGlob, setShowConfrontoGlob] = useState(false);
  const [globA1, setGlobA1] = useState(todayGlob);
  const [globA2, setGlobA2] = useState(todayGlob);
  const [globB1, setGlobB1] = useState(todayGlob);
  const [globB2, setGlobB2] = useState(todayGlob);
  const [showConfrontoTrattGlob, setShowConfrontoTrattGlob] = useState(false);
  const [trattGlobA1, setTrattGlobA1] = useState(todayGlob);
  const [trattGlobA2, setTrattGlobA2] = useState(todayGlob);
  const [trattGlobB1, setTrattGlobB1] = useState(todayGlob);
  const [trattGlobB2, setTrattGlobB2] = useState(todayGlob);
  const [showConfrontoTotGlob, setShowConfrontoTotGlob] = useState(false);
  const [totGlobA1, setTotGlobA1] = useState(todayGlob);
  const [totGlobA2, setTotGlobA2] = useState(todayGlob);
  const [totGlobB1, setTotGlobB1] = useState(todayGlob);
  const [totGlobB2, setTotGlobB2] = useState(todayGlob);

  const load = useCallback(async () => {
    setLoading(true);
    const [parrRes, vendRes, trattRes] = await Promise.all([
      dbSelect<Parrucchiere>({ table: 'parrucchieri', filters: [{ col: 'attivo', op: 'eq', val: true }], orderBy: [{ col: 'nome' }] }),
      dbSelect<Vendita>({ table: 'rivendita_prodotti', filters: [{ col: 'deleted_at', op: 'is_null' }], orderBy: [{ col: 'data_vendita', asc: false }, { col: 'created_at', asc: false }] }),
      dbSelect<Trattamento>({ table: 'trattamenti_eseguiti', orderBy: [{ col: 'data_esecuzione', asc: false }, { col: 'created_at', asc: false }] }),
    ]);
    const parr = parrRes.data;
    const vend = vendRes.data;
    const tratt = trattRes.data;
    const parrList = (parr || []) as Parrucchiere[];
    const vendList = (vend || []) as Vendita[];
    const trattList = (tratt || []) as Trattamento[];
    setParrucchieri(parrList);
    setVendite(vendList);
    setTrattamenti(trattList);

    // Calcola anni disponibili rivendita
    const anniSet = new Set<number>([annoCorrente]);
    for (const v of vendList) anniSet.add(Number(v.data_vendita.split('-')[0]));
    setAnniDisp([...anniSet].sort((a, b) => a - b));

    // Calcola anni disponibili trattamenti
    const anniSetTratt = new Set<number>([annoCorrente]);
    for (const t of trattList) anniSetTratt.add(Number(t.data_esecuzione.split('-')[0]));
    setAnniDispTratt([...anniSetTratt].sort((a, b) => a - b));

    // Calcola anni disponibili totale (unione rivendita + trattamenti)
    const anniSetTot = new Set<number>([annoCorrente]);
    for (const v of vendList) anniSetTot.add(Number(v.data_vendita.split('-')[0]));
    for (const t of trattList) anniSetTot.add(Number(t.data_esecuzione.split('-')[0]));
    setAnniDispTotale([...anniSetTot].sort((a, b) => a - b));

    // Inizializza periodi per ogni parrucchiere
    setPeriodi(prev => {
      const next = { ...prev };
      for (const p of parrList) {
        if (!next[p.id]) next[p.id] = 'corrente';
      }
      return next;
    });
    setPeriodiTratt(prev => {
      const next = { ...prev };
      for (const p of parrList) {
        if (!next[p.id]) next[p.id] = 'corrente';
      }
      return next;
    });
    setPeriodiTotale(prev => {
      const next = { ...prev };
      for (const p of parrList) {
        if (!next[p.id]) next[p.id] = 'corrente';
      }
      return next;
    });

    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function deleteVendita(id: string) {
    if (!confirm('Eliminare questa vendita?')) return;
    dbUpdate({
      table: 'rivendita_prodotti',
      id,
      data: { deleted_at: new Date().toISOString() },
    });
    load();
  }

  // Stats globali
  const valoreV = (v: Vendita) => vistaValore === 'margine' ? v.totale - (v.costo_unitario ?? 0) * v.quantita : v.totale;
  const totaleGlobale = vendite.reduce((s, v) => s + valoreV(v), 0);
  const venditeCorrente = vendite.filter(v => Number(v.data_vendita.split('-')[0]) === annoCorrente);
  const totaleCorrente = venditeCorrente.reduce((s, v) => s + valoreV(v), 0);

  // Confronto globale
  function venditeInIntervallo(da: string, a: string) {
    const fine = a >= da ? a : da;
    return vendite.filter(v => v.data_vendita >= da && v.data_vendita <= fine);
  }
  const vendGlobA = venditeInIntervallo(globA1, globA2);
  const vendGlobB = venditeInIntervallo(globB1, globB2);
  const totGlobA = vendGlobA.reduce((s, v) => s + valoreV(v), 0);
  const totGlobB = vendGlobB.reduce((s, v) => s + valoreV(v), 0);

  // Top prodotti globali
  const perProdottoGlobale: Record<string, { value: number; pezzi: number }> = {};
  for (const v of venditeCorrente) {
    if (!perProdottoGlobale[v.nome_prodotto]) perProdottoGlobale[v.nome_prodotto] = { value: 0, pezzi: 0 };
    perProdottoGlobale[v.nome_prodotto].value += valoreV(v);
    perProdottoGlobale[v.nome_prodotto].pezzi += v.quantita;
  }
  const topProdotti = Object.entries(perProdottoGlobale)
    .map(([label, { value, pezzi }]) => ({ label, value, pezzi }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-7 h-7 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-teal-100 rounded-xl flex items-center justify-center">
            <ShoppingBag size={20} className="text-teal-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-stone-800">Rivendita & Trattamenti</h1>
            <p className="text-sm text-stone-400">Statistiche per parrucchiere</p>
          </div>
        </div>
        {activeTab === 'rivendita' && (
          <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-xl">
            <button
              onClick={() => setVistaValore('fatturato')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${vistaValore === 'fatturato' ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
            >
              <Euro size={12} />
              Fatturato
            </button>
            <button
              onClick={() => setVistaValore('margine')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${vistaValore === 'margine' ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
            >
              <TrendingUp size={12} />
              Margine
            </button>
          </div>
        )}
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 bg-stone-100 p-1 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab('rivendita')}
          className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'rivendita' ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
        >
          <ShoppingBag size={14} />
          Rivendita
        </button>
        <button
          onClick={() => setActiveTab('trattamenti')}
          className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'trattamenti' ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
        >
          <Scissors size={14} />
          Trattamenti
        </button>
        <button
          onClick={() => setActiveTab('totale')}
          className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'totale' ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
        >
          <BarChart2 size={14} />
          Rivendita e trattamenti
        </button>
      </div>

      {activeTab === 'rivendita' && (
        <>
          {/* Pannello riassunto anno corrente */}
          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
            <div className="p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Euro size={16} className="text-teal-600" />
                  <span className="text-xs font-semibold text-stone-500 uppercase tracking-wide">{vistaValore === 'margine' ? 'Margine' : 'Incasso'} {annoCorrente}</span>
                </div>
                <p className="text-3xl font-bold text-teal-600">€{fmt(totaleCorrente)}</p>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Package size={16} className="text-stone-500" />
                  <span className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Vendite {annoCorrente}</span>
                </div>
                <p className="text-3xl font-bold text-stone-800">{venditeCorrente.length}</p>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp size={16} className="text-stone-500" />
                  <span className="text-xs font-semibold text-stone-500 uppercase tracking-wide">{vistaValore === 'margine' ? 'Margine storico' : 'Totale storico'}</span>
                </div>
                <p className="text-3xl font-bold text-stone-800">€{fmt(totaleGlobale)}</p>
              </div>
            </div>
            <div className="px-5 pb-5 flex flex-wrap items-center gap-2">
              <button
                onClick={() => setShowConfrontoGlob(s => !s)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-medium shadow-sm transition-colors ${showConfrontoGlob ? 'bg-teal-500 border-teal-500 text-white' : 'border-stone-200 bg-white hover:bg-stone-50 text-stone-600'}`}
              >
                <GitCompare size={14} />
                Confronta periodi — Rivendita totale
              </button>
              {(vendite.length > 0 || trattamenti.length > 0) && (
                <>
                  <button
                    onClick={() => esportaTotaleRivenditaPDF(
                      vendite,
                      trattamenti,
                      showConfrontoGlob ? mkRivConfronto([
                        { label: 'Numero vendite', corrente: vendGlobA.length, precedente: vendGlobB.length, fmtFn: v => String(Math.round(v)) },
                        { label: 'Totale incassato', corrente: totGlobA, precedente: totGlobB, fmtFn: v => `€${fmt(v)}` },
                      ], `${fmtData(globA1)} — ${fmtData(globA2 >= globA1 ? globA2 : globA1)}`, `${fmtData(globB1)} — ${fmtData(globB2 >= globB1 ? globB2 : globB1)}`) : undefined
                    )}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-600 text-sm font-medium shadow-sm transition-colors"
                    title="Esporta PDF rivendita + trattamenti"
                  >
                    <Download size={14} />
                    PDF Totale
                  </button>
                  <button
                    onClick={() => esportaTotaleExcel(vendite, trattamenti)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-600 text-sm font-medium shadow-sm transition-colors"
                    title="Esporta Excel (CSV italiano) rivendita + trattamenti"
                  >
                    <Download size={14} />
                    Excel Totale
                  </button>
                </>
              )}
            </div>
            {showConfrontoGlob && (
              <div className="border-t border-stone-100 p-5 space-y-4">
                <div className="flex flex-col sm:flex-row gap-4">
                  <DateRangeInput label="Periodo A" da={globA1} a={globA2} onDa={setGlobA1} onA={setGlobA2} colore="#14b8a6" />
                  <DateRangeInput label="Periodo B" da={globB1} a={globB2} onDa={setGlobB1} onA={setGlobB2} colore="#a8a29e" />
                </div>
                <PannelloConfronto
                  colore="#14b8a6"
                  labelA={`${fmtData(globA1)} — ${fmtData(globA2 >= globA1 ? globA2 : globA1)}`}
                  labelB={`${fmtData(globB1)} — ${fmtData(globB2 >= globB1 ? globB2 : globB1)}`}
                  righe={[
                    { label: 'Numero vendite', corrente: vendGlobA.length, precedente: vendGlobB.length, fmt: v => String(Math.round(v)) },
                    { label: vistaValore === 'margine' ? 'Margine' : 'Totale incassato', corrente: totGlobA, precedente: totGlobB, fmt: v => `€${fmt(v)}` },
                  ]}
                />
              </div>
            )}
          </div>

          {/* Top prodotti anno corrente */}
          {topProdotti.length > 0 && (
            <div className="bg-white rounded-2xl border border-stone-200 p-5">
              <div className="flex items-center gap-2 mb-4">
                <BarChart2 size={16} className="text-stone-500" />
                <h2 className="text-sm font-bold text-stone-700">Top prodotti {annoCorrente}</h2>
              </div>
              <BarChart data={topProdotti} color="#14b8a6" />
            </div>
          )}

          {/* Cassetti parrucchieri */}
          {parrucchieri.length === 0 ? (
            <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center">
              <ShoppingBag size={32} className="text-stone-300 mx-auto mb-3" />
              <p className="text-stone-500 font-medium">Nessun parrucchiere attivo</p>
              <p className="text-xs text-stone-400 mt-1">Aggiungi parrucchieri nelle impostazioni</p>
            </div>
          ) : (
            <div className="space-y-4">
              {parrucchieri.map(parr => (
                <CassettoParrucchiere
                  key={parr.id}
                  parr={parr}
                  venditeAll={vendite}
                  periodo={periodi[parr.id] ?? 'corrente'}
                  anni={anniDisp}
                  onPeriodoChange={v => setPeriodi(prev => ({ ...prev, [parr.id]: v }))}
                  onNuova={() => setNuovaVenditaParr(parr.id)}
                  onDelete={deleteVendita}
                  vistaValore={vistaValore}
                />
              ))}
            </div>
          )}
        </>
      )}

      {activeTab === 'trattamenti' && (
        <>
          {/* Riepilogo trattamenti anno corrente */}
          {(() => {
            const trattCorr = trattamenti.filter(t => Number(t.data_esecuzione.split('-')[0]) === annoCorrente);
            const totTrattCorr = trattCorr.reduce((s, t) => s + t.prezzo, 0);
            const totTrattGlob = trattamenti.reduce((s, t) => s + t.prezzo, 0);
            function trattInIntervallo(da: string, a: string) {
              const fine = a >= da ? a : da;
              return trattamenti.filter(t => t.data_esecuzione >= da && t.data_esecuzione <= fine);
            }
            const trattGA = trattInIntervallo(trattGlobA1, trattGlobA2);
            const trattGB = trattInIntervallo(trattGlobB1, trattGlobB2);
            const totTGA = trattGA.reduce((s, t) => s + t.prezzo, 0);
            const totTGB = trattGB.reduce((s, t) => s + t.prezzo, 0);
            return (
              <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
                <div className="p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Euro size={16} className="text-amber-600" />
                      <span className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Incasso {annoCorrente}</span>
                    </div>
                    <p className="text-3xl font-bold text-amber-600">€{fmt(totTrattCorr)}</p>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Scissors size={16} className="text-stone-500" />
                      <span className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Trattamenti {annoCorrente}</span>
                    </div>
                    <p className="text-3xl font-bold text-stone-800">{trattCorr.length}</p>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp size={16} className="text-stone-500" />
                      <span className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Totale storico</span>
                    </div>
                    <p className="text-3xl font-bold text-stone-800">€{fmt(totTrattGlob)}</p>
                  </div>
                </div>
                <div className="px-5 pb-5">
                  <button
                    onClick={() => setShowConfrontoTrattGlob(s => !s)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-medium shadow-sm transition-colors ${showConfrontoTrattGlob ? 'bg-teal-500 border-teal-500 text-white' : 'border-stone-200 bg-white hover:bg-stone-50 text-stone-600'}`}
                  >
                    <GitCompare size={14} />
                    Confronta periodi — Trattamenti totale
                  </button>
                </div>
                {showConfrontoTrattGlob && (
                  <div className="border-t border-stone-100 p-5 space-y-4">
                    <div className="flex flex-col sm:flex-row gap-4">
                      <DateRangeInput label="Periodo A" da={trattGlobA1} a={trattGlobA2} onDa={setTrattGlobA1} onA={setTrattGlobA2} colore="#f59e0b" />
                      <DateRangeInput label="Periodo B" da={trattGlobB1} a={trattGlobB2} onDa={setTrattGlobB1} onA={setTrattGlobB2} colore="#a8a29e" />
                    </div>
                    <PannelloConfronto
                      colore="#f59e0b"
                      labelA={`${fmtData(trattGlobA1)} — ${fmtData(trattGlobA2 >= trattGlobA1 ? trattGlobA2 : trattGlobA1)}`}
                      labelB={`${fmtData(trattGlobB1)} — ${fmtData(trattGlobB2 >= trattGlobB1 ? trattGlobB2 : trattGlobB1)}`}
                      righe={[
                        { label: 'Numero trattamenti', corrente: trattGA.length, precedente: trattGB.length, fmt: v => String(Math.round(v)) },
                        { label: 'Totale incassato', corrente: totTGA, precedente: totTGB, fmt: v => `€${fmt(v)}` },
                      ]}
                    />
                  </div>
                )}
              </div>
            );
          })()}

          {/* Cassetti trattamenti per parrucchiere */}
          {parrucchieri.length === 0 ? (
            <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center">
              <Scissors size={32} className="text-stone-300 mx-auto mb-3" />
              <p className="text-stone-500 font-medium">Nessun parrucchiere attivo</p>
              <p className="text-xs text-stone-400 mt-1">Aggiungi parrucchieri nelle impostazioni</p>
            </div>
          ) : (
            <div className="space-y-4">
              {parrucchieri.map(parr => (
                <CassettoTrattamenti
                  key={parr.id}
                  parr={parr}
                  trattamentiAll={trattamenti}
                  periodo={periodiTratt[parr.id] ?? 'corrente'}
                  anni={anniDispTratt}
                  onPeriodoChange={v => setPeriodiTratt(prev => ({ ...prev, [parr.id]: v }))}
                />
              ))}
            </div>
          )}
        </>
      )}

      {activeTab === 'totale' && (
        <>
          {(() => {
            const vendCorr = vendite.filter(v => Number(v.data_vendita.split('-')[0]) === annoCorrente);
            const trattCorr = trattamenti.filter(t => Number(t.data_esecuzione.split('-')[0]) === annoCorrente);
            const totCorr = vendCorr.reduce((s, v) => s + v.totale, 0) + trattCorr.reduce((s, t) => s + t.prezzo, 0);
            const totGlob = vendite.reduce((s, v) => s + v.totale, 0) + trattamenti.reduce((s, t) => s + t.prezzo, 0);
            function inIntervallo(da: string, a: string) {
              const fine = a >= da ? a : da;
              const vend = vendite.filter(v => v.data_vendita >= da && v.data_vendita <= fine);
              const tratt = trattamenti.filter(t => t.data_esecuzione >= da && t.data_esecuzione <= fine);
              return { vend, tratt, tot: vend.reduce((s, v) => s + v.totale, 0) + tratt.reduce((s, t) => s + t.prezzo, 0) };
            }
            const resA = inIntervallo(totGlobA1, totGlobA2);
            const resB = inIntervallo(totGlobB1, totGlobB2);
            return (
              <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
                <div className="p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Euro size={16} className="text-stone-600" />
                      <span className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Incasso totale {annoCorrente}</span>
                    </div>
                    <p className="text-3xl font-bold text-stone-800">€{fmt(totCorr)}</p>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Package size={16} className="text-teal-500" />
                      <span className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Rivendita {annoCorrente}</span>
                    </div>
                    <p className="text-3xl font-bold text-teal-600">€{fmt(vendCorr.reduce((s, v) => s + v.totale, 0))}</p>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Scissors size={16} className="text-amber-500" />
                      <span className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Trattamenti {annoCorrente}</span>
                    </div>
                    <p className="text-3xl font-bold text-amber-600">€{fmt(trattCorr.reduce((s, t) => s + t.prezzo, 0))}</p>
                  </div>
                  <div className="sm:col-span-3 pt-2 border-t border-stone-100 flex items-center gap-2">
                    <TrendingUp size={14} className="text-stone-400" />
                    <span className="text-xs text-stone-400">Totale storico combinato:</span>
                    <span className="text-sm font-bold text-stone-700">€{fmt(totGlob)}</span>
                  </div>
                </div>
                <div className="px-5 pb-5">
                  <button
                    onClick={() => setShowConfrontoTotGlob(s => !s)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-medium shadow-sm transition-colors ${showConfrontoTotGlob ? 'bg-teal-500 border-teal-500 text-white' : 'border-stone-200 bg-white hover:bg-stone-50 text-stone-600'}`}
                  >
                    <GitCompare size={14} />
                    Confronta periodi — Totale combinato
                  </button>
                </div>
                {showConfrontoTotGlob && (
                  <div className="border-t border-stone-100 p-5 space-y-4">
                    <div className="flex flex-col sm:flex-row gap-4">
                      <DateRangeInput label="Periodo A" da={totGlobA1} a={totGlobA2} onDa={setTotGlobA1} onA={setTotGlobA2} colore="#78716c" />
                      <DateRangeInput label="Periodo B" da={totGlobB1} a={totGlobB2} onDa={setTotGlobB1} onA={setTotGlobB2} colore="#a8a29e" />
                    </div>
                    <PannelloConfronto
                      colore="#78716c"
                      labelA={`${fmtData(totGlobA1)} — ${fmtData(totGlobA2 >= totGlobA1 ? totGlobA2 : totGlobA1)}`}
                      labelB={`${fmtData(totGlobB1)} — ${fmtData(totGlobB2 >= totGlobB1 ? totGlobB2 : totGlobB1)}`}
                      righe={[
                        { label: 'Rivendita', corrente: resA.vend.reduce((s, v) => s + v.totale, 0), precedente: resB.vend.reduce((s, v) => s + v.totale, 0), fmt: v => `€${fmt(v)}` },
                        { label: 'Trattamenti', corrente: resA.tratt.reduce((s, t) => s + t.prezzo, 0), precedente: resB.tratt.reduce((s, t) => s + t.prezzo, 0), fmt: v => `€${fmt(v)}` },
                        { label: 'Totale combinato', corrente: resA.tot, precedente: resB.tot, fmt: v => `€${fmt(v)}` },
                      ]}
                    />
                  </div>
                )}
              </div>
            );
          })()}

          {parrucchieri.length === 0 ? (
            <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center">
              <BarChart2 size={32} className="text-stone-300 mx-auto mb-3" />
              <p className="text-stone-500 font-medium">Nessun parrucchiere attivo</p>
              <p className="text-xs text-stone-400 mt-1">Aggiungi parrucchieri nelle impostazioni</p>
            </div>
          ) : (
            <div className="space-y-4">
              {parrucchieri.map(parr => (
                <CassettoTotale
                  key={parr.id}
                  parr={parr}
                  venditeAll={vendite}
                  trattamentiAll={trattamenti}
                  periodo={periodiTotale[parr.id] ?? 'corrente'}
                  anni={anniDispTotale}
                  onPeriodoChange={v => setPeriodiTotale(prev => ({ ...prev, [parr.id]: v }))}
                />
              ))}
            </div>
          )}
        </>
      )}

      {nuovaVenditaParr && (
        <NuovaVenditaModal
          parrucchieri={parrucchieri}
          parrucchierePreselezionato={nuovaVenditaParr}
          onClose={() => setNuovaVenditaParr(null)}
          onSaved={() => { setNuovaVenditaParr(null); load(); }}
        />
      )}
    </div>
  );
}
