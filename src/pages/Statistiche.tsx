import { useEffect, useRef, useState } from 'react';
import { dbSelect } from '../lib/localDb';
import {
  BarChart2, TrendingUp, Euro, Trophy, ChevronDown, Scissors,
  ThumbsUp, ThumbsDown, Users, ArrowLeft, Calendar, Store, Hash, Star, X, UserX, Download, GitCompare,
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ─── Types ────────────────────────────────────────────────────────────────────

type Sezione = 'clienti' | 'parrucchieri' | 'negozio' | 'assenze';
type ModalitaClienti = 'combinata' | 'frequenza' | 'spesa' | 'fiches';
type ModalitaParr = 'combinata' | 'fiches' | 'spesa' | 'clienti_serviti' | 'appuntamenti';
type Classifica = 'migliori' | 'peggiori';
type PeriodoKey = 'corrente' | 'sempre' | string;

interface RawAppuntamento {
  id: string;
  data_ora: string;
  stato: string;
  cliente_id: string;
  parrucchiere_id: string | null;
}

interface FicheConvalidata {
  appuntamento_id: string;
  importo_convalidato: number;
  convalidata_at: string;
  cliente_id: string;
  parrucchiere_id: string | null;
  data_ora: string;
}

interface FicheVoceStats {
  fiche_id: string;
  parrucchiere_id: string | null;
  prezzo: number;
  data_ora: string;
  cliente_id: string;
  nome_voce: string;
  tipo: string;
}

interface Cliente { id: string; nome: string; cognome: string; }
interface Parrucchiere { id: string; nome: string; colore?: string; }

interface ClienteStats {
  id: string; nome: string; cognome: string;
  visite: number; spesa: number; freqMensile: number;
  mediaFiche: number; cancellazioni: number; score: number;
}

interface ParrStats {
  id: string; nome: string; colore?: string;
  appuntamenti: number; clientiUnici: number;
  spesaTotale: number; mediaFiche: number; score: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const now = new Date();
const annoCorrente = now.getFullYear();
const mesiPassati = now.getMonth() + 1;
const MEDAL_EMOJI = ['🥇', '🥈', '🥉'];
const PODIO_COLORS = ['#f59e0b', '#94a3b8', '#d97706'];
const AVATAR_COLORS = ['#f59e0b', '#10b981', '#0ea5e9', '#f97316', '#ec4899', '#14b8a6', '#84cc16', '#ef4444', '#64748b'];
function avatarColor(id: string) {
  return AVATAR_COLORS[Math.abs(id.charCodeAt(0) + id.charCodeAt(id.length - 1)) % AVATAR_COLORS.length];
}

const NOMI_MESI = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'];
const NOMI_MESI_LUNGHI = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];

// ─── PDF helpers ─────────────────────────────────────────────────────────────

function pdfHeader(doc: jsPDF, titolo: string, periodo: string) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(28, 25, 23);
  doc.text('Statistiche — ' + titolo, 14, 18);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(120, 113, 108);
  doc.text('Periodo: ' + periodo, 14, 25);
  doc.text('Generato il ' + new Date().toLocaleDateString('it-IT'), 14, 30);
  doc.setDrawColor(231, 229, 228);
  doc.line(14, 33, doc.internal.pageSize.width - 14, 33);
}

function esportaClientiPDF(ranked: ClienteStats[], modalita: ModalitaClienti, classifica: Classifica, periodoLabel: string, confronto?: PdfConfronto) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const modalitaLabel: Record<ModalitaClienti, string> = { combinata: 'Combinata', frequenza: 'Frequenza', spesa: 'Spesa', fiches: 'Media fiches' };
  pdfHeader(doc, `Clienti — ${modalitaLabel[modalita]} (${classifica === 'migliori' ? 'migliori' : 'peggiori'})`, periodoLabel);

  const rows = ranked.map((c, i) => [
    String(i + 1),
    `${c.nome} ${c.cognome}`,
    c.visite.toString(),
    c.freqMensile.toFixed(2) + '/mese',
    '€' + c.spesa.toFixed(2),
    '€' + c.mediaFiche.toFixed(2),
    c.cancellazioni.toString(),
    modalita === 'combinata' ? c.score.toFixed(0) + '/100' : '',
  ]);

  autoTable(doc, {
    startY: 38,
    head: [['#', 'Cliente', 'Visite', 'Frequenza', 'Spesa totale', 'Media fiches', 'Cancellazioni', 'Score']],
    body: rows,
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [28, 25, 23], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [250, 250, 249] },
    columnStyles: { 0: { cellWidth: 8 }, 1: { cellWidth: 40 } },
  });

  if (confronto) {
    const afterTable = (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? 80;
    pdfSezionConfronto(doc, confronto, afterTable);
  }

  doc.save(`statistiche-clienti-${periodoLabel.replace(/\s/g, '-')}.pdf`);
}

function esportaParrucchieriPDF(ranked: ParrStats[], modalita: ModalitaParr, classifica: Classifica, periodoLabel: string) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const modalitaLabel: Record<ModalitaParr, string> = { combinata: 'Combinata', fiches: 'Media fiches', spesa: 'Spesa', clienti_serviti: 'Clienti serviti', appuntamenti: 'Appuntamenti' };
  pdfHeader(doc, `Parrucchieri — ${modalitaLabel[modalita]} (${classifica === 'migliori' ? 'migliori' : 'peggiori'})`, periodoLabel);

  const rows = ranked.map((p, i) => [
    String(i + 1),
    p.nome,
    p.appuntamenti.toString(),
    p.clientiUnici.toString(),
    '€' + p.mediaFiche.toFixed(2),
    '€' + p.spesaTotale.toFixed(2),
    modalita === 'combinata' ? p.score.toFixed(0) + '/100' : '',
  ]);

  autoTable(doc, {
    startY: 38,
    head: [['#', 'Parrucchiere', 'Appuntamenti', 'Clienti serviti', 'Media fiches', 'Spesa generata', 'Score']],
    body: rows,
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [28, 25, 23], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [250, 250, 249] },
    columnStyles: { 0: { cellWidth: 8 }, 1: { cellWidth: 40 } },
  });

  doc.save(`statistiche-parrucchieri-${periodoLabel.replace(/\s/g, '-')}.pdf`);
}

interface PdfConfronto {
  labelA: string;
  labelB: string;
  righe: { label: string; valA: string; valB: string; pct: number | null }[];
}

function pdfSezionConfronto(doc: jsPDF, confronto: PdfConfronto, startY: number): number {
  let y = startY + 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(28, 25, 23);
  doc.text('Confronto periodi', 14, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(120, 113, 108);
  doc.text(`Periodo A: ${confronto.labelA}`, 14, y);
  y += 4;
  doc.text(`Periodo B: ${confronto.labelB}`, 14, y);
  y += 3;

  const body = confronto.righe.map(r => {
    const pctStr = r.pct === null
      ? '—'
      : Math.abs(r.pct) < 0.5
        ? '='
        : r.pct > 0
          ? `+${r.pct.toFixed(1)}%`
          : `${r.pct.toFixed(1)}%`;
    return [r.label, r.valA, r.valB, pctStr];
  });

  autoTable(doc, {
    startY: y + 2,
    head: [['Metrica', 'Periodo A', 'Periodo B', 'Variazione']],
    body,
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [41, 37, 36], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [250, 250, 249] },
    columnStyles: {
      3: {
        fontStyle: 'bold',
        textColor: [60, 60, 60],
      },
    },
    didParseCell: (data) => {
      if (data.column.index === 3 && data.section === 'body') {
        const txt = String(data.cell.raw ?? '');
        if (txt.startsWith('+')) data.cell.styles.textColor = [5, 150, 105];
        else if (txt.startsWith('-')) data.cell.styles.textColor = [220, 38, 38];
      }
    },
  });

  const finalY = (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? y + 20;

  // Sommario testuale
  const righeValide = confronto.righe.filter(r => r.pct !== null);
  if (righeValide.length > 0) {
    const media = righeValide.map(r => r.pct!).reduce((a, b) => a + b, 0) / righeValide.length;
    const fy = finalY + 5;
    const msg = Math.abs(media) < 0.5
      ? 'I due periodi sono sostanzialmente equivalenti.'
      : media > 0
        ? `Incremento medio del +${media.toFixed(1)}% nel periodo A rispetto al periodo B.`
        : `Decremento medio del ${media.toFixed(1)}% nel periodo A rispetto al periodo B.`;
    const col: [number, number, number] = Math.abs(media) < 0.5 ? [120, 113, 108] : media > 0 ? [5, 150, 105] : [220, 38, 38];
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...col);
    doc.text(msg, 14, fy);
    return fy + 6;
  }
  return finalY + 4;
}

function mkPdfConfronto(
  righe: { label: string; corrente: number; precedente: number; fmtFn: (v: number) => string }[],
  labelA: string,
  labelB: string,
): PdfConfronto {
  return {
    labelA,
    labelB,
    righe: righe.map(r => ({
      label: r.label,
      valA: r.fmtFn(r.corrente),
      valB: r.fmtFn(r.precedente),
      pct: r.precedente > 0 ? ((r.corrente - r.precedente) / r.precedente) * 100 : null,
    })),
  };
}

function esportaSchedaParrPDF(
  parr: Parrucchiere,
  stats: ParrStats,
  mensile: MensilePoint[],
  periodoLabel: string,
  confronto?: PdfConfronto,
) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  pdfHeader(doc, `Scheda parrucchiere — ${parr.nome}`, periodoLabel);

  // KPI block
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(28, 25, 23);
  let y = 40;
  const kpi = [
    ['Spesa generata', '€' + stats.spesaTotale.toFixed(2)],
    ['Media fiches', '€' + stats.mediaFiche.toFixed(2)],
    ['Clienti serviti', String(stats.clientiUnici)],
    ['Appuntamenti', String(stats.appuntamenti)],
    ['Score combinato', stats.score.toFixed(0) + '/100'],
  ];
  kpi.forEach(([label, val]) => {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120, 113, 108);
    doc.text(label + ':', 14, y);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(28, 25, 23);
    doc.text(val, 60, y);
    y += 6;
  });

  if (mensile.length > 0) {
    autoTable(doc, {
      startY: y + 4,
      head: [['Mese', 'Appuntamenti', 'Clienti', 'Spesa (€)', 'Media fiches (€)']],
      body: mensile.map(m => {
        const [yr, mo] = m.mese.split('-');
        return [
          NOMI_MESI_LUNGHI[Number(mo) - 1] + ' ' + yr,
          String(m.appuntamenti),
          String(m.clientiUnici),
          m.spesa.toFixed(2),
          m.mediaFiche.toFixed(2),
        ];
      }),
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [28, 25, 23], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [250, 250, 249] },
    });
  }

  if (confronto) {
    const afterTable = (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? y + 10;
    pdfSezionConfronto(doc, confronto, afterTable);
  }

  doc.save(`scheda-${parr.nome.toLowerCase().replace(/\s/g, '-')}-${periodoLabel.replace(/\s/g, '-')}.pdf`);
}

function esportaNegozioPDF(
  mediaFiche: { count: number; totale: number; media: number },
  serviziSorted: ServizioStats[],
  periodoLabel: string,
  confronto?: PdfConfronto,
) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  pdfHeader(doc, 'Negozio', periodoLabel);

  let y = 40;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(28, 25, 23);
  doc.text('Riepilogo fiches', 14, y);
  y += 6;

  const riepilogo = [
    ['Fiches convalidate', String(mediaFiche.count)],
    ['Ricavo totale', '€' + mediaFiche.totale.toFixed(2)],
    ['Media per fiche', '€' + mediaFiche.media.toFixed(2)],
  ];
  riepilogo.forEach(([label, val]) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(120, 113, 108);
    doc.text(label + ':', 14, y);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(28, 25, 23);
    doc.text(val, 70, y);
    y += 6;
  });

  if (serviziSorted.length > 0) {
    autoTable(doc, {
      startY: y + 4,
      head: [['Servizio', 'Occorrenze', 'Ricavo totale (€)', 'Prezzo medio (€)', 'Clienti unici']],
      body: serviziSorted.map(s => [
        s.nome,
        String(s.occorrenze),
        s.ricavoTotale.toFixed(2),
        s.prezzoMedio.toFixed(2),
        String(s.clientiUnici.size),
      ]),
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [28, 25, 23], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [250, 250, 249] },
      columnStyles: { 0: { cellWidth: 55 } },
    });
  }

  if (confronto) {
    const afterTable = (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? y + 10;
    pdfSezionConfronto(doc, confronto, afterTable);
  }

  doc.save(`statistiche-negozio-${periodoLabel.replace(/\s/g, '-')}.pdf`);
}

function esportaAssenzePDF(
  parrucchieri: Parrucchiere[],
  assenze: Assenza[],
  periodo: PeriodoKey,
  periodoLabel: string,
) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  pdfHeader(doc, 'Assenze parrucchieri', periodoLabel);

  const rows: string[][] = [];
  for (const p of parrucchieri) {
    const ass = filtraAssenzePerPeriodo(assenze.filter(a => a.parrucchiere_id === p.id), periodo)
      .sort((a, b) => b.data_inizio.localeCompare(a.data_inizio));
    for (const a of ass) {
      rows.push([
        p.nome,
        formatDataAssenza(a.data_inizio),
        formatDataAssenza(a.data_fine),
        a.ora_inizio ? 'Parziale (dalle ' + a.ora_inizio.slice(0, 5) + ')' : 'Tutto il giorno',
        String(giorniAssenza(a)),
        a.note || '',
      ]);
    }
  }

  if (rows.length > 0) {
    autoTable(doc, {
      startY: 38,
      head: [['Parrucchiere', 'Dal', 'Al', 'Tipo', 'Giorni', 'Note']],
      body: rows,
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [28, 25, 23], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [250, 250, 249] },
      columnStyles: { 0: { cellWidth: 35 }, 5: { cellWidth: 40 } },
    });
  } else {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(120, 113, 108);
    doc.text('Nessuna assenza nel periodo selezionato.', 14, 42);
  }

  doc.save(`assenze-parrucchieri-${periodoLabel.replace(/\s/g, '-')}.pdf`);
}

// ─── Confronto periodi personalizzato ─────────────────────────────────────────

interface StatConfrRow { label: string; corrente: number; precedente: number; fmt: (v: number) => string; invertito?: boolean; }

function fmtData(d: string) {
  if (!d) return '';
  const [y, m, g] = d.split('-');
  return `${Number(g)} ${['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'][Number(m)-1]} ${y}`;
}

function mkIntervalloPeriodo(da: string, a: string): PeriodoKey { return `da:${da}:a:${a}`; }

function calcolaRighe<T extends { data_ora: string }>(
  items: T[],
  getPeriodo: (items: T[]) => number,
  p1: PeriodoKey,
  p2: PeriodoKey,
): { corrente: number; precedente: number } {
  const f1 = items.filter(i => {
    const d = i.data_ora.slice(0, 10);
    if (p1.startsWith('da:')) {
      const parts = p1.split(':');
      return d >= parts[1] && d <= parts[3];
    }
    return false;
  });
  const f2 = items.filter(i => {
    const d = i.data_ora.slice(0, 10);
    if (p2.startsWith('da:')) {
      const parts = p2.split(':');
      return d >= parts[1] && d <= parts[3];
    }
    return false;
  });
  return { corrente: getPeriodo(f1), precedente: getPeriodo(f2) };
}

function PannelloConfronto({ righe, labelA, labelB, colore }: {
  righe: StatConfrRow[]; labelA: string; labelB: string; colore: string;
}) {
  const maxVal = Math.max(...righe.flatMap(r => [r.corrente, r.precedente]), 0.01);

  // Calcola percentuale media pesata sulle prime righe significative
  const righeValide = righe.filter(r => r.precedente > 0);
  let sommarioPct: number | null = null;
  if (righeValide.length > 0) {
    const pctsValide = righeValide.map(r => ((r.corrente - r.precedente) / r.precedente) * 100);
    sommarioPct = pctsValide.reduce((a, b) => a + b, 0) / pctsValide.length;
  }

  return (
    <div className="mt-4 rounded-2xl border border-stone-200 overflow-hidden">
      {/* Legenda */}
      <div className="px-4 py-3 bg-stone-50 border-b border-stone-100 flex items-center gap-5 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: colore }} />
          <span className="text-xs font-semibold text-stone-700">Periodo A: {labelA}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm flex-shrink-0 bg-stone-300" />
          <span className="text-xs font-semibold text-stone-500">Periodo B: {labelB}</span>
        </div>
      </div>

      {/* Barre */}
      <div className="p-4 space-y-4 bg-white">
        {righe.map(r => {
          const pct = r.precedente > 0 ? ((r.corrente - r.precedente) / r.precedente) * 100 : null;
          const positivo = pct !== null && (r.invertito ? pct < 0 : pct > 0);
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
              {/* Periodo A */}
              <div className="flex items-center gap-2 mb-1">
                <div className="flex-1 h-5 bg-stone-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.max((r.corrente / maxVal) * 100, r.corrente > 0 ? 2 : 0)}%`, backgroundColor: colore }} />
                </div>
                <span className="text-xs font-bold text-stone-700 w-24 text-right tabular-nums">{r.fmt(r.corrente)}</span>
              </div>
              {/* Periodo B */}
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

      {/* Sommario */}
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

const pad = (n: number) => String(n).padStart(2, '0');

function isMese(p: PeriodoKey): boolean { return /^\d{4}-\d{2}$/.test(p); }
function isIntervallo(p: PeriodoKey): boolean { return p.startsWith('da:'); }
function parseIntervallo(p: PeriodoKey): { da: string; a: string } {
  const parts = p.split(':');
  return { da: parts[1], a: parts[3] };
}
function mkIntervallo(da: string, a: string): PeriodoKey { return `da:${da}:a:${a}`; }

// da/a can be YYYY-MM or YYYY-MM-DD; returns month strings YYYY-MM
function mesiInRange(da: string, a: string): string[] {
  const result: string[] = [];
  const daParts = da.split('-').map(Number);
  const aParts = a.split('-').map(Number);
  let y = daParts[0], m = daParts[1];
  const ay = aParts[0], am = aParts[1];
  while (y < ay || (y === ay && m <= am)) {
    result.push(`${y}-${pad(m)}`);
    m++; if (m > 12) { m = 1; y++; }
    if (result.length > 120) break;
  }
  return result;
}

// Normalize YYYY-MM to YYYY-MM-01, pass YYYY-MM-DD as-is
function intervalloStartDate(da: string): string {
  return da.length === 7 ? `${da}-01` : da;
}
function intervalloEndDate(a: string): string {
  if (a.length === 7) {
    const [y, m] = a.split('-').map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    return `${a}-${pad(lastDay)}`;
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
    const daLabel = da.length > 7
      ? `${Number(daP[2])} ${NOMI_MESI_LUNGHI[Number(daP[1]) - 1]} ${daP[0]}`
      : `${NOMI_MESI_LUNGHI[Number(daP[1]) - 1]} ${daP[0]}`;
    const aLabel = a.length > 7
      ? `${Number(aP[2])} ${NOMI_MESI_LUNGHI[Number(aP[1]) - 1]} ${aP[0]}`
      : `${NOMI_MESI_LUNGHI[Number(aP[1]) - 1]} ${aP[0]}`;
    return `${daLabel} — ${aLabel}`;
  }
  if (isMese(p)) {
    const [y, m] = p.split('-');
    return `${NOMI_MESI_LUNGHI[Number(m) - 1]} ${y}`;
  }
  return String(p);
}

function calcMesi(periodo: PeriodoKey, appuntamenti: RawAppuntamento[]): number {
  if (periodo === 'corrente') return mesiPassati;
  if (periodo === 'sempre') {
    if (appuntamenti.length === 0) return 1;
    const minDate = appuntamenti.reduce((min, a) => (a.data_ora < min ? a.data_ora : min), appuntamenti[0].data_ora);
    const diffMs = now.getTime() - new Date(minDate).getTime();
    return Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24 * 30)));
  }
  if (isMese(periodo)) return 1;
  if (isIntervallo(periodo)) {
    const { da, a } = parseIntervallo(periodo);
    return Math.max(1, mesiInRange(da, a).length);
  }
  return 12;
}

function filtraPerPeriodo<T extends { data_ora: string }>(items: T[], periodo: PeriodoKey): T[] {
  return items.filter(a => {
    const d = new Date(a.data_ora);
    const y = d.getFullYear();
    if (periodo === 'corrente') return y === annoCorrente;
    if (periodo === 'sempre') return true;
    if (isMese(periodo)) {
      const [py, pm] = periodo.split('-');
      return y === Number(py) && d.getMonth() + 1 === Number(pm);
    }
    if (isIntervallo(periodo)) {
      const { da, a: fine } = parseIntervallo(periodo);
      const dateStr = `${y}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      const startStr = intervalloStartDate(da);
      const endStr = intervalloEndDate(fine);
      return dateStr >= startStr && dateStr <= endStr;
    }
    return y === Number(periodo);
  });
}

function buildClientiStats(
  clienti: Cliente[],
  appuntamenti: RawAppuntamento[],
  fiches: FicheConvalidata[],
  periodo: PeriodoKey,
): ClienteStats[] {
  const mesi = calcMesi(periodo, appuntamenti.filter(a => a.stato !== 'cancellato'));

  const visiteMappa: Record<string, { giorni: Set<string>; cancellazioni: number }> = {};
  for (const c of clienti) visiteMappa[c.id] = { giorni: new Set(), cancellazioni: 0 };
  for (const a of filtraPerPeriodo(appuntamenti, periodo)) {
    if (!visiteMappa[a.cliente_id]) continue;
    if (a.stato === 'cancellato') visiteMappa[a.cliente_id].cancellazioni++;
    else visiteMappa[a.cliente_id].giorni.add(a.data_ora.slice(0, 10));
  }

  const spesaMappa: Record<string, { importo: number; count: number }> = {};
  for (const c of clienti) spesaMappa[c.id] = { importo: 0, count: 0 };
  for (const f of filtraPerPeriodo(fiches, periodo)) {
    if (!spesaMappa[f.cliente_id]) continue;
    spesaMappa[f.cliente_id].importo += f.importo_convalidato;
    spesaMappa[f.cliente_id].count++;
  }

  return clienti.map(c => {
    const v = visiteMappa[c.id] || { giorni: new Set(), cancellazioni: 0 };
    const s = spesaMappa[c.id] || { importo: 0, count: 0 };
    const visite = v.giorni.size;
    const spesa = s.importo;
    const freqMensile = visite / mesi;
    const mediaFiche = s.count > 0 ? spesa / s.count : 0;
    return { id: c.id, nome: c.nome, cognome: c.cognome, visite, spesa, freqMensile, mediaFiche, cancellazioni: v.cancellazioni, score: 0 };
  });
}

function rankClienti(stats: ClienteStats[], modalita: ModalitaClienti, classifica: Classifica): ClienteStats[] {
  let sorted: ClienteStats[];
  if (modalita === 'frequenza') sorted = [...stats].sort((a, b) => b.freqMensile - a.freqMensile);
  else if (modalita === 'spesa') sorted = [...stats].sort((a, b) => b.spesa - a.spesa);
  else if (modalita === 'fiches') sorted = [...stats].sort((a, b) => b.mediaFiche - a.mediaFiche);
  else {
    const maxFreq = Math.max(...stats.map(s => s.freqMensile), 0.001);
    const maxSpesa = Math.max(...stats.map(s => s.spesa), 0.001);
    const maxFiche = Math.max(...stats.map(s => s.mediaFiche), 0.001);
    const maxCanc = Math.max(...stats.map(s => s.cancellazioni), 1);
    sorted = stats.map(s => ({
      ...s,
      score: Math.max(0,
        (s.freqMensile / maxFreq) * 33.3 +
        (s.spesa / maxSpesa) * 33.3 +
        (s.mediaFiche / maxFiche) * 33.3 -
        (s.cancellazioni / maxCanc) * 10,
      ),
    })).sort((a, b) => b.score - a.score);
  }
  return classifica === 'migliori' ? sorted : [...sorted].reverse();
}

function buildParrStats(
  parrucchieri: Parrucchiere[],
  appuntamenti: RawAppuntamento[],
  fiches: FicheConvalidata[],
  periodo: PeriodoKey,
  ficheVoci: FicheVoceStats[] = [],
): ParrStats[] {
  const apptFiltrati = filtraPerPeriodo(appuntamenti, periodo).filter(a => a.stato !== 'cancellato');
  const apptMappa: Record<string, { appuntamenti: number; clientiUnici: Set<string> }> = {};
  for (const p of parrucchieri) apptMappa[p.id] = { appuntamenti: 0, clientiUnici: new Set() };
  for (const a of apptFiltrati) {
    if (!a.parrucchiere_id || !apptMappa[a.parrucchiere_id]) continue;
    apptMappa[a.parrucchiere_id].appuntamenti++;
    apptMappa[a.parrucchiere_id].clientiUnici.add(a.cliente_id);
  }

  const ficheMappa: Record<string, { importo: number; count: number; clientiUnici: Set<string> }> = {};
  for (const p of parrucchieri) ficheMappa[p.id] = { importo: 0, count: 0, clientiUnici: new Set() };

  // Se abbiamo le voci dettagliate, calcoliamo la spesa per parrucchiere dalle singole voci
  if (ficheVoci.length > 0) {
    const vociFiltrate = filtraPerPeriodo(ficheVoci, periodo);
    // Count fiche distinte per parrucchiere: ogni fiche in cui il parrucchiere ha almeno una voce conta 1
    const fichePerParr: Record<string, Set<string>> = {};
    for (const p of parrucchieri) fichePerParr[p.id] = new Set();
    for (const v of vociFiltrate) {
      if (!v.parrucchiere_id || !ficheMappa[v.parrucchiere_id]) continue;
      fichePerParr[v.parrucchiere_id].add(v.fiche_id);
      ficheMappa[v.parrucchiere_id].importo += v.prezzo;
      ficheMappa[v.parrucchiere_id].clientiUnici.add(v.cliente_id);
    }
    for (const p of parrucchieri) {
      ficheMappa[p.id].count = fichePerParr[p.id].size;
    }
  } else {
    for (const f of filtraPerPeriodo(fiches, periodo)) {
      if (!f.parrucchiere_id || !ficheMappa[f.parrucchiere_id]) continue;
      ficheMappa[f.parrucchiere_id].importo += f.importo_convalidato;
      ficheMappa[f.parrucchiere_id].count++;
      ficheMappa[f.parrucchiere_id].clientiUnici.add(f.cliente_id);
    }
  }

  return parrucchieri.map(p => {
    const am = apptMappa[p.id] || { appuntamenti: 0, clientiUnici: new Set() };
    const fm = ficheMappa[p.id] || { importo: 0, count: 0, clientiUnici: new Set() };
    const clientiUnici = fm.clientiUnici.size;
    const spesaTotale = fm.importo;
    const mediaFiche = fm.count > 0 ? spesaTotale / fm.count : 0;
    return {
      id: p.id, nome: p.nome, colore: p.colore,
      appuntamenti: am.appuntamenti, clientiUnici, spesaTotale, mediaFiche, score: 0,
    };
  });
}

function rankParr(stats: ParrStats[], modalita: ModalitaParr, classifica: Classifica): ParrStats[] {
  let sorted: ParrStats[];
  if (modalita === 'fiches') sorted = [...stats].sort((a, b) => b.mediaFiche - a.mediaFiche);
  else if (modalita === 'spesa') sorted = [...stats].sort((a, b) => b.spesaTotale - a.spesaTotale);
  else if (modalita === 'clienti_serviti') sorted = [...stats].sort((a, b) => b.clientiUnici - a.clientiUnici);
  else if (modalita === 'appuntamenti') sorted = [...stats].sort((a, b) => b.appuntamenti - a.appuntamenti);
  else {
    const maxFiche = Math.max(...stats.map(s => s.mediaFiche), 0.001);
    const maxSpesa = Math.max(...stats.map(s => s.spesaTotale), 0.001);
    const maxClienti = Math.max(...stats.map(s => s.clientiUnici), 0.001);
    const maxAppt = Math.max(...stats.map(s => s.appuntamenti), 0.001);
    sorted = stats.map(s => ({
      ...s,
      score: Math.max(0,
        (s.mediaFiche / maxFiche) * 25 +
        (s.spesaTotale / maxSpesa) * 25 +
        (s.clientiUnici / maxClienti) * 25 +
        (s.appuntamenti / maxAppt) * 25,
      ),
    })).sort((a, b) => b.score - a.score);
  }
  return classifica === 'migliori' ? sorted : [...sorted].reverse();
}

// ─── Shared UI ────────────────────────────────────────────────────────────────

function tuttiIMesi(anni: number[], mesiPerAnno: Record<number, number[]>): string[] {
  const result: string[] = [];
  for (const y of [...anni].sort((a, b) => a - b)) {
    for (const m of (mesiPerAnno[y] || [])) {
      result.push(`${y}-${String(m).padStart(2, '0')}`);
    }
  }
  return result;
}

function MeseSelect({ label, valore, opzioni, onChange }: {
  label: string; valore: string; opzioni: string[]; onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold text-stone-400 uppercase tracking-wide">{label}</span>
      <select
        value={valore}
        onChange={e => onChange(e.target.value)}
        className="text-sm border border-stone-200 rounded-lg px-3 py-2 bg-white text-stone-700 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-200"
      >
        {opzioni.map(o => {
          const [y, m] = o.split('-');
          return <option key={o} value={o}>{NOMI_MESI_LUNGHI[Number(m) - 1]} {y}</option>;
        })}
      </select>
    </div>
  );
}

function PeriodoSelector({ anni, mesiPerAnno, valore, onChange }: {
  anni: number[]; mesiPerAnno: Record<number, number[]>; valore: PeriodoKey; onChange: (v: PeriodoKey) => void;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'preset' | 'intervallo'>(isIntervallo(valore) ? 'intervallo' : 'preset');
  const [annoEspanso, setAnnoEspanso] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const anniDisp = anni.length > 0 ? anni : [annoCorrente];

  // parse existing intervallo to initialise state
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
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
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
              {anni.map(anno => (
                <div key={anno}>
                  <button onClick={() => setAnnoEspanso(v => v === anno ? null : anno)} className={`w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium transition-colors ${valore === String(anno) || (isMese(valore) && valore.startsWith(String(anno))) ? 'text-amber-700' : 'text-stone-700 hover:bg-stone-50'}`}>
                    <span>{anno}{anno === annoCorrente ? ' (corrente)' : ''}</span>
                    <ChevronDown size={13} className={`text-stone-400 transition-transform ${annoEspanso === anno ? 'rotate-180' : ''}`} />
                  </button>
                  {annoEspanso === anno && (
                    <div className="bg-stone-50 border-t border-stone-100">
                      <button onClick={() => pick(String(anno))} className={`w-full text-left px-6 py-2 text-sm transition-colors ${valore === String(anno) ? 'text-amber-700 font-semibold' : 'text-stone-600 hover:bg-stone-100'}`}>Tutto l&apos;anno</button>
                      {(mesiPerAnno[anno] || []).map(m => {
                        const key = `${anno}-${String(m).padStart(2, '0')}` as PeriodoKey;
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

function BarIndicator({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.max((value / max) * 100, value > 0 ? 3 : 0) : 0;
  return (
    <div className="w-full h-1.5 bg-stone-100 rounded-full overflow-hidden">
      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
    </div>
  );
}

function AvatarCircle({ initials, size, bg }: { initials: string; size: 'sm' | 'md' | 'lg'; bg: string }) {
  const sz = size === 'lg' ? 'w-14 h-14 text-xl' : size === 'md' ? 'w-12 h-12 text-lg' : 'w-9 h-9 text-sm';
  return (
    <div className={`${sz} rounded-full flex items-center justify-center font-bold text-white flex-shrink-0`} style={{ backgroundColor: bg }}>
      {initials}
    </div>
  );
}

function MiglioriPeggioriToggle({ valore, onChange }: { valore: Classifica; onChange: (v: Classifica) => void }) {
  return (
    <div className="flex bg-white border border-stone-200 rounded-xl p-1 gap-1 shadow-sm">
      <button onClick={() => onChange('migliori')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${valore === 'migliori' ? 'bg-emerald-500 text-white shadow-sm' : 'text-stone-500 hover:text-stone-800'}`}>
        <ThumbsUp size={14} /><span className="hidden sm:inline">Migliori</span>
      </button>
      <button onClick={() => onChange('peggiori')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${valore === 'peggiori' ? 'bg-red-500 text-white shadow-sm' : 'text-stone-500 hover:text-stone-800'}`}>
        <ThumbsDown size={14} /><span className="hidden sm:inline">Peggiori</span>
      </button>
    </div>
  );
}

// ─── Chart ────────────────────────────────────────────────────────────────────

interface MensilePoint {
  mese: string; // YYYY-MM
  appuntamenti: number;
  clientiUnici: number;
  spesa: number;
  mediaFiche: number;
  ficheCount: number;
}

type ChartMetric = 'spesa' | 'clientiUnici' | 'appuntamenti' | 'mediaFiche';

const METRIC_CONFIG: Record<ChartMetric, { label: string; color: string; fmt: (v: number) => string }> = {
  spesa:       { label: 'Spesa generata', color: '#10b981', fmt: v => `€${v.toFixed(0)}` },
  clientiUnici:{ label: 'Clienti serviti', color: '#f59e0b', fmt: v => String(Math.round(v)) },
  appuntamenti:{ label: 'Appuntamenti',   color: '#3b82f6', fmt: v => String(Math.round(v)) },
  mediaFiche:  { label: 'Media fiches',   color: '#0ea5e9', fmt: v => `€${v.toFixed(0)}` },
};

export function MonthlyBarChart({
  data,
  valueKey,
  color,
  fmt,
}: {
  data: { mese: string; [key: string]: number | string }[];
  valueKey: string;
  color: string;
  fmt: (v: number) => string;
}) {
  const values = data.map(d => d[valueKey] as number);
  const maxVal = Math.max(...values, 0.001);
  const BAR_MIN_W = 36;
  const BAR_H = 140; // chart area height in px

  return (
    <div className="overflow-x-auto">
      <div
        className="flex items-end gap-2 min-w-max px-2 pb-0"
        style={{ minWidth: `${Math.max(data.length * (BAR_MIN_W + 16), 300)}px` }}
      >
        {data.map(d => {
          const val = d[valueKey] as number;
          const pct = maxVal > 0 ? (val / maxVal) : 0;
          const barPx = Math.max(pct * BAR_H, val > 0 ? 6 : 0);
          const [year, month] = (d.mese as string).split('-');
          const label = `${NOMI_MESI[Number(month) - 1]} '${year.slice(2)}`;

          return (
            <div key={d.mese as string} className="flex flex-col items-center gap-1" style={{ minWidth: `${BAR_MIN_W}px` }}>
              {/* value label */}
              <span
                className="text-[10px] font-semibold leading-none"
                style={{ color, minHeight: '14px' }}
              >
                {val > 0 ? fmt(val) : ''}
              </span>
              {/* bar + background track */}
              <div className="relative w-full rounded-md overflow-hidden" style={{ height: `${BAR_H}px`, backgroundColor: '#f5f5f4' }}>
                <div
                  className="absolute bottom-0 left-0 right-0 rounded-md transition-all duration-500"
                  style={{ height: `${barPx}px`, backgroundColor: color, opacity: 0.88 }}
                />
              </div>
              {/* month label */}
              <span className="text-[10px] text-stone-500 font-medium leading-none mt-1 whitespace-nowrap">{label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BarChart({ data, metric }: { data: MensilePoint[]; metric: ChartMetric }) {
  const cfg = METRIC_CONFIG[metric];
  return <MonthlyBarChart data={data} valueKey={metric} color={cfg.color} fmt={cfg.fmt} />;
}

// ─── Scheda dettaglio parrucchiere ────────────────────────────────────────────

function buildMensile(
  parrId: string,
  appuntamenti: RawAppuntamento[],
  fiches: FicheConvalidata[],
  periodo: PeriodoKey,
  ficheVoci: FicheVoceStats[] = [],
): MensilePoint[] {
  const apptFiltrati = filtraPerPeriodo(appuntamenti, periodo).filter(a => a.stato !== 'cancellato' && a.parrucchiere_id === parrId);

  const mesiSet = new Set<string>();
  for (const a of apptFiltrati) mesiSet.add(a.data_ora.slice(0, 7));

  // Usa le voci dettagliate se disponibili (come buildParrStats), altrimenti fallback su fiches
  if (ficheVoci.length > 0) {
    const vociFiltrate = filtraPerPeriodo(ficheVoci, periodo).filter(v => v.parrucchiere_id === parrId);
    for (const v of vociFiltrate) mesiSet.add(v.data_ora.slice(0, 7));
    const mesiSorted = [...mesiSet].sort();

    return mesiSorted.map(mese => {
      const apptMese = apptFiltrati.filter(a => a.data_ora.startsWith(mese));
      const vociMese = vociFiltrate.filter(v => v.data_ora.startsWith(mese));
      const ficheDistinte = new Set(vociMese.map(v => v.fiche_id));
      const clientiSet = new Set(vociMese.map(v => v.cliente_id));
      const spesa = vociMese.reduce((s, v) => s + v.prezzo, 0);
      const ficheCount = ficheDistinte.size;
      return {
        mese,
        appuntamenti: apptMese.length,
        clientiUnici: clientiSet.size,
        spesa,
        mediaFiche: ficheCount > 0 ? spesa / ficheCount : 0,
        ficheCount,
      };
    });
  }

  const ficheFiltrate = filtraPerPeriodo(fiches, periodo).filter(f => f.parrucchiere_id === parrId);
  for (const f of ficheFiltrate) mesiSet.add(f.data_ora.slice(0, 7));
  const mesiSorted = [...mesiSet].sort();

  return mesiSorted.map(mese => {
    const apptMese = apptFiltrati.filter(a => a.data_ora.startsWith(mese));
    const ficheMese = ficheFiltrate.filter(f => f.data_ora.startsWith(mese));
    const clientiSet = new Set(ficheMese.map(f => f.cliente_id));
    const spesa = ficheMese.reduce((s, f) => s + f.importo_convalidato, 0);
    const ficheCount = ficheMese.length;
    return {
      mese,
      appuntamenti: apptMese.length,
      clientiUnici: clientiSet.size,
      spesa,
      mediaFiche: ficheCount > 0 ? spesa / ficheCount : 0,
      ficheCount,
    };
  });
}

function SchedaParrucchiere({
  parrucchiere, appuntamenti, fiches, ficheVoci, anni, mesiPerAnno, onBack,
}: {
  parrucchiere: Parrucchiere;
  appuntamenti: RawAppuntamento[];
  fiches: FicheConvalidata[];
  ficheVoci: FicheVoceStats[];
  anni: number[];
  mesiPerAnno: Record<number, number[]>;
  onBack: () => void;
}) {
  const [periodo, setPeriodo] = useState<PeriodoKey>('corrente');
  const [chartMetric, setChartMetric] = useState<ChartMetric>('spesa');
  const [showConfronto, setShowConfronto] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const [confA1, setConfA1] = useState(today);
  const [confA2, setConfA2] = useState(today);
  const [confB1, setConfB1] = useState(today);
  const [confB2, setConfB2] = useState(today);

  const stats = buildParrStats([parrucchiere], appuntamenti, fiches, periodo, ficheVoci)[0];
  const mensile = buildMensile(parrucchiere.id, appuntamenti, fiches, periodo, ficheVoci);
  const color = parrucchiere.colore || avatarColor(parrucchiere.id);

  const combinata = buildParrStats([parrucchiere], appuntamenti, fiches, periodo, ficheVoci);
  const scored = rankParr(combinata, 'combinata', 'migliori');
  const scoreCorrente = scored[0]?.score ?? 0;

  const kpi = [
    { label: 'Spesa generata', value: `€${stats.spesaTotale.toFixed(2)}`, icon: Euro, color: '#10b981', bg: 'bg-emerald-50' },
    { label: 'Media fiches', value: `€${stats.mediaFiche.toFixed(2)}`, icon: Scissors, color: '#0ea5e9', bg: 'bg-sky-50' },
    { label: 'Clienti serviti', value: String(stats.clientiUnici), icon: Users, color: '#f59e0b', bg: 'bg-amber-50' },
    { label: 'Appuntamenti', value: String(stats.appuntamenti), icon: Calendar, color: '#3b82f6', bg: 'bg-blue-50' },
    { label: 'Combinata', value: `${scoreCorrente.toFixed(0)}/100`, icon: Trophy, color: '#d97706', bg: 'bg-amber-50' },
  ];

  const pA = mkIntervalloPeriodo(confA1, confA2 >= confA1 ? confA2 : confA1);
  const pB = mkIntervalloPeriodo(confB1, confB2 >= confB1 ? confB2 : confB1);
  const statsA = buildParrStats([parrucchiere], appuntamenti, fiches, pA, ficheVoci)[0];
  const statsB = buildParrStats([parrucchiere], appuntamenti, fiches, pB, ficheVoci)[0];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-800 transition-colors font-medium">
          <ArrowLeft size={16} /> Torna ai parrucchieri
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm px-6 py-5 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-xl font-bold flex-shrink-0"
            style={{ backgroundColor: color }}>
            {parrucchiere.nome.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <h3 className="text-xl font-bold text-stone-800">{parrucchiere.nome}</h3>
            <p className="text-sm text-stone-400 mt-0.5">{labelPeriodo(periodo)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <PeriodoSelector anni={anni} mesiPerAnno={mesiPerAnno} valore={periodo} onChange={setPeriodo} />
          <button
            onClick={() => setShowConfronto(s => !s)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-medium shadow-sm transition-colors ${showConfronto ? 'bg-amber-500 border-amber-500 text-white' : 'border-stone-200 bg-white hover:bg-stone-50 text-stone-600'}`}
            title="Confronta due periodi"
          >
            <GitCompare size={14} />
            <span className="hidden sm:inline">Confronta</span>
          </button>
          <button
            onClick={() => esportaSchedaParrPDF(
              parrucchiere, stats, mensile, labelPeriodo(periodo),
              showConfronto ? mkPdfConfronto([
                { label: 'Spesa generata', corrente: statsA.spesaTotale, precedente: statsB.spesaTotale, fmtFn: v => `€${v.toFixed(2)}` },
                { label: 'Media fiches', corrente: statsA.mediaFiche, precedente: statsB.mediaFiche, fmtFn: v => `€${v.toFixed(2)}` },
                { label: 'Clienti serviti', corrente: statsA.clientiUnici, precedente: statsB.clientiUnici, fmtFn: v => String(Math.round(v)) },
                { label: 'Appuntamenti', corrente: statsA.appuntamenti, precedente: statsB.appuntamenti, fmtFn: v => String(Math.round(v)) },
              ], `${fmtData(confA1)} — ${fmtData(confA2 >= confA1 ? confA2 : confA1)}`, `${fmtData(confB1)} — ${fmtData(confB2 >= confB1 ? confB2 : confB1)}`) : undefined
            )}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-600 text-sm font-medium shadow-sm transition-colors"
            title="Esporta PDF"
          >
            <Download size={14} />
            <span className="hidden sm:inline">PDF</span>
          </button>
        </div>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {kpi.map(k => {
          const Icon = k.icon;
          return (
            <div key={k.label} className="bg-white rounded-xl border border-stone-200 shadow-sm p-4">
              <div className={`w-8 h-8 rounded-lg ${k.bg} flex items-center justify-center mb-2`}>
                <Icon size={15} style={{ color: k.color }} />
              </div>
              <p className="text-lg font-bold text-stone-800 leading-tight">{k.value}</p>
              <p className="text-xs text-stone-400 mt-0.5">{k.label}</p>
            </div>
          );
        })}
      </div>

      {/* Confronto periodi personalizzato */}
      {showConfronto && (
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-stone-100">
            <p className="text-sm font-semibold text-stone-700">Confronto periodi personalizzato</p>
            <p className="text-xs text-stone-400 mt-0.5">Scegli due intervalli di date per confrontarli</p>
          </div>
          <div className="p-5 space-y-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <DateRangeInput label="Periodo A" da={confA1} a={confA2} onDa={setConfA1} onA={setConfA2} colore={color} />
              <DateRangeInput label="Periodo B" da={confB1} a={confB2} onDa={setConfB1} onA={setConfB2} colore="#a8a29e" />
            </div>
            <PannelloConfronto
              colore={color}
              labelA={`${fmtData(confA1)} — ${fmtData(confA2 >= confA1 ? confA2 : confA1)}`}
              labelB={`${fmtData(confB1)} — ${fmtData(confB2 >= confB1 ? confB2 : confB1)}`}
              righe={[
                { label: 'Spesa generata', corrente: statsA.spesaTotale, precedente: statsB.spesaTotale, fmt: v => `€${v.toFixed(2)}` },
                { label: 'Media fiches', corrente: statsA.mediaFiche, precedente: statsB.mediaFiche, fmt: v => `€${v.toFixed(2)}` },
                { label: 'Clienti serviti', corrente: statsA.clientiUnici, precedente: statsB.clientiUnici, fmt: v => String(Math.round(v)) },
                { label: 'Appuntamenti', corrente: statsA.appuntamenti, precedente: statsB.appuntamenti, fmt: v => String(Math.round(v)) },
              ]}
            />
          </div>
        </div>
      )}

      {/* Chart */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between gap-3 flex-wrap">
          <span className="text-sm font-semibold text-stone-700">Andamento mensile</span>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(METRIC_CONFIG) as ChartMetric[]).map(m => (
              <button key={m} onClick={() => setChartMetric(m)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${chartMetric === m ? 'text-white shadow-sm' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'}`}
                style={chartMetric === m ? { backgroundColor: METRIC_CONFIG[m].color } : {}}>
                {METRIC_CONFIG[m].label}
              </button>
            ))}
          </div>
        </div>
        <div className="p-5">
          {mensile.length === 0 ? (
            <div className="py-10 text-center">
              <BarChart2 size={32} className="text-stone-200 mx-auto mb-2" />
              <p className="text-sm text-stone-400">Nessun dato per questo periodo</p>
            </div>
          ) : (
            <BarChart data={mensile} metric={chartMetric} />
          )}
        </div>
      </div>

      {/* Tabella riepilogo mensile */}
      {mensile.length > 0 && (
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-stone-100">
            <span className="text-sm font-semibold text-stone-700">Dettaglio per mese</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-100 bg-stone-50/60">
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-stone-500 uppercase tracking-wide">Mese</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-stone-500 uppercase tracking-wide">Appunt.</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-stone-500 uppercase tracking-wide">Clienti</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-stone-500 uppercase tracking-wide">Fiches</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-stone-500 uppercase tracking-wide">Media fiche</th>
                  <th className="text-right px-5 py-2.5 text-xs font-semibold text-stone-500 uppercase tracking-wide">Spesa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-50">
                {[...mensile].reverse().map(d => {
                  const [y, m] = d.mese.split('-');
                  return (
                    <tr key={d.mese} className="hover:bg-stone-50 transition-colors">
                      <td className="px-5 py-3 font-medium text-stone-700">{NOMI_MESI_LUNGHI[Number(m) - 1]} {y}</td>
                      <td className="px-4 py-3 text-right text-stone-600">{d.appuntamenti}</td>
                      <td className="px-4 py-3 text-right text-stone-600">{d.clientiUnici}</td>
                      <td className="px-4 py-3 text-right text-stone-600">{d.ficheCount}</td>
                      <td className="px-4 py-3 text-right text-stone-600">€{d.mediaFiche.toFixed(2)}</td>
                      <td className="px-5 py-3 text-right font-semibold text-emerald-700">€{d.spesa.toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-stone-200 bg-stone-50">
                  <td className="px-5 py-3 font-bold text-stone-700">Totale</td>
                  <td className="px-4 py-3 text-right font-bold text-stone-700">{mensile.reduce((s, d) => s + d.appuntamenti, 0)}</td>
                  <td className="px-4 py-3 text-right font-bold text-stone-700">{stats.clientiUnici}</td>
                  <td className="px-4 py-3 text-right font-bold text-stone-700">{mensile.reduce((s, d) => s + d.ficheCount, 0)}</td>
                  <td className="px-4 py-3 text-right font-bold text-stone-700">€{stats.mediaFiche.toFixed(2)}</td>
                  <td className="px-5 py-3 text-right font-bold text-emerald-700">€{stats.spesaTotale.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Clienti section ──────────────────────────────────────────────────────────

function RigaCliente({ c, pos, modalita, classifica, onSelect, maxFreq, maxSpesa, maxFiche }: {
  c: ClienteStats; pos: number; modalita: ModalitaClienti; classifica: Classifica;
  onSelect: (id: string) => void; maxFreq: number; maxSpesa: number; maxFiche: number;
}) {
  const isPeggiori = classifica === 'peggiori';
  return (
    <button onClick={() => onSelect(c.id)} className={`w-full flex items-center gap-3 px-5 py-3.5 hover:bg-stone-50 transition-colors text-left group ${pos > 0 ? 'border-t border-stone-100' : ''}`}>
      {pos < 3 && !isPeggiori ? (
        <span className="text-lg leading-none w-7 text-center flex-shrink-0">{MEDAL_EMOJI[pos]}</span>
      ) : (
        <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${isPeggiori ? 'bg-red-50' : 'bg-stone-100'}`}>
          <span className={`text-xs font-bold ${isPeggiori ? 'text-red-400' : 'text-stone-500'}`}>{pos + 1}</span>
        </div>
      )}
      <AvatarCircle initials={`${c.nome[0]?.toUpperCase()}${c.cognome[0]?.toUpperCase()}`} size="sm" bg={avatarColor(c.id)} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="font-semibold text-stone-800 truncate group-hover:text-amber-600 transition-colors text-sm">{c.nome} {c.cognome}</span>
          <div className="flex items-center gap-2.5 flex-shrink-0 text-xs text-stone-400">
            {(modalita === 'combinata' || modalita === 'frequenza') && <span className="flex items-center gap-1"><TrendingUp size={10} className="text-amber-400" />{c.freqMensile.toFixed(1)}/m</span>}
            {(modalita === 'combinata' || modalita === 'spesa') && <span className="flex items-center gap-1"><Euro size={10} className="text-emerald-400" />€{c.spesa.toFixed(0)}</span>}
            {(modalita === 'combinata' || modalita === 'fiches') && <span className="flex items-center gap-1"><Scissors size={10} className="text-sky-400" />€{c.mediaFiche.toFixed(0)}</span>}
            {c.cancellazioni > 0 && <span className="text-red-400">✕{c.cancellazioni}</span>}
          </div>
        </div>
        <div className="space-y-0.5">
          {(modalita === 'combinata' || modalita === 'frequenza') && <BarIndicator value={c.freqMensile} max={maxFreq} color="#f59e0b" />}
          {(modalita === 'combinata' || modalita === 'spesa') && <BarIndicator value={c.spesa} max={maxSpesa} color="#10b981" />}
          {(modalita === 'combinata' || modalita === 'fiches') && <BarIndicator value={c.mediaFiche} max={maxFiche} color="#0ea5e9" />}
        </div>
        <div className="flex gap-2 mt-1 text-[11px] text-stone-400">
          <span>{c.visite} {c.visite === 1 ? 'visita' : 'visite'}</span>
          {modalita === 'combinata' && <><span>·</span><span>score {c.score.toFixed(0)}/100</span></>}
        </div>
      </div>
    </button>
  );
}

function SezioneClienti({ clienti, appuntamenti, fiches, anni, mesiPerAnno, onSelectCliente }: {
  clienti: Cliente[]; appuntamenti: RawAppuntamento[]; fiches: FicheConvalidata[];
  anni: number[]; mesiPerAnno: Record<number, number[]>; onSelectCliente: (id: string) => void;
}) {
  const [modalita, setModalita] = useState<ModalitaClienti>('combinata');
  const [classifica, setClassifica] = useState<Classifica>('migliori');
  const [periodo, setPeriodo] = useState<PeriodoKey>('corrente');
  const [showConfronto, setShowConfronto] = useState(false);
  const todayISO = new Date().toISOString().slice(0, 10);
  const [confA1, setConfA1] = useState(todayISO);
  const [confA2, setConfA2] = useState(todayISO);
  const [confB1, setConfB1] = useState(todayISO);
  const [confB2, setConfB2] = useState(todayISO);

  const stats = buildClientiStats(clienti, appuntamenti, fiches, periodo);
  const ranked = rankClienti(stats, modalita, classifica);
  const maxFreq = Math.max(...ranked.map(s => s.freqMensile), 0.001);
  const maxSpesa = Math.max(...ranked.map(s => s.spesa), 0.001);
  const maxFiche = Math.max(...ranked.map(s => s.mediaFiche), 0.001);
  const periodoLabel = labelPeriodo(periodo);

  // Aggregati confronto
  const statsA = buildClientiStats(clienti, appuntamenti, fiches, mkIntervallo(confA1, confA2 >= confA1 ? confA2 : confA1));
  const statsB = buildClientiStats(clienti, appuntamenti, fiches, mkIntervallo(confB1, confB2 >= confB1 ? confB2 : confB1));
  const aggA = {
    clientiAttivi: statsA.filter(s => s.visite > 0).length,
    visite: statsA.reduce((s, c) => s + c.visite, 0),
    spesa: statsA.reduce((s, c) => s + c.spesa, 0),
    mediaFiche: statsA.filter(s => s.visite > 0).reduce((s, c) => s + c.mediaFiche, 0) / Math.max(statsA.filter(s => s.visite > 0).length, 1),
    cancellazioni: statsA.reduce((s, c) => s + c.cancellazioni, 0),
  };
  const aggB = {
    clientiAttivi: statsB.filter(s => s.visite > 0).length,
    visite: statsB.reduce((s, c) => s + c.visite, 0),
    spesa: statsB.reduce((s, c) => s + c.spesa, 0),
    mediaFiche: statsB.filter(s => s.visite > 0).reduce((s, c) => s + c.mediaFiche, 0) / Math.max(statsB.filter(s => s.visite > 0).length, 1),
    cancellazioni: statsB.reduce((s, c) => s + c.cancellazioni, 0),
  };

  const MODALITA: { key: ModalitaClienti; label: string; icon: React.ElementType }[] = [
    { key: 'combinata', label: 'Combinata', icon: Trophy },
    { key: 'frequenza', label: 'Frequenza', icon: TrendingUp },
    { key: 'spesa', label: 'Spesa', icon: Euro },
    { key: 'fiches', label: 'Media fiches', icon: Scissors },
  ];

  const top3 = ranked.slice(0, 3);
  const podioOrder = ranked.length >= 3 ? [top3[1], top3[0], top3[2]] : [];
  const podioTopPad = ['pt-4', 'pt-0', 'pt-8'];
  const podioSizes: ('sm' | 'md' | 'lg')[] = ['md', 'lg', 'sm'];
  const podioMedal = [MEDAL_EMOJI[1], MEDAL_EMOJI[0], MEDAL_EMOJI[2]];
  const podioBg = [PODIO_COLORS[1], PODIO_COLORS[0], PODIO_COLORS[2]];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex bg-white border border-stone-200 rounded-xl p-1 gap-1 shadow-sm flex-wrap">
          {MODALITA.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setModalita(key)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${modalita === key ? 'bg-amber-500 text-white shadow-sm' : 'text-stone-500 hover:text-stone-800'}`}>
              <Icon size={14} /><span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>
        <MiglioriPeggioriToggle valore={classifica} onChange={setClassifica} />
        <div className="ml-auto flex items-center gap-2">
          <PeriodoSelector anni={anni} mesiPerAnno={mesiPerAnno} valore={periodo} onChange={setPeriodo} />
          <button
            onClick={() => setShowConfronto(s => !s)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-medium shadow-sm transition-colors ${showConfronto ? 'bg-amber-500 border-amber-500 text-white' : 'border-stone-200 bg-white hover:bg-stone-50 text-stone-600'}`}
            title="Confronta due periodi"
          >
            <GitCompare size={14} />
            <span className="hidden sm:inline">Confronta</span>
          </button>
          {ranked.length > 0 && (
            <button
              onClick={() => esportaClientiPDF(
                ranked, modalita, classifica, periodoLabel,
                showConfronto ? mkPdfConfronto([
                  { label: 'Clienti attivi', corrente: aggA.clientiAttivi, precedente: aggB.clientiAttivi, fmtFn: v => String(Math.round(v)) },
                  { label: 'Visite totali', corrente: aggA.visite, precedente: aggB.visite, fmtFn: v => String(Math.round(v)) },
                  { label: 'Spesa totale', corrente: aggA.spesa, precedente: aggB.spesa, fmtFn: v => `€${v.toFixed(2)}` },
                  { label: 'Media fiche', corrente: aggA.mediaFiche, precedente: aggB.mediaFiche, fmtFn: v => `€${v.toFixed(2)}` },
                  { label: 'Cancellazioni', corrente: aggA.cancellazioni, precedente: aggB.cancellazioni, fmtFn: v => String(Math.round(v)) },
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

      {showConfronto && (
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-stone-100">
            <p className="text-sm font-semibold text-stone-700">Confronto periodi — Clienti</p>
            <p className="text-xs text-stone-400 mt-0.5">Confronta metriche aggregate di tutti i clienti in due intervalli</p>
          </div>
          <div className="p-5 space-y-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <DateRangeInput label="Periodo A" da={confA1} a={confA2} onDa={setConfA1} onA={setConfA2} colore="#f59e0b" />
              <DateRangeInput label="Periodo B" da={confB1} a={confB2} onDa={setConfB1} onA={setConfB2} colore="#a8a29e" />
            </div>
            <PannelloConfronto
              colore="#f59e0b"
              labelA={`${fmtData(confA1)} — ${fmtData(confA2 >= confA1 ? confA2 : confA1)}`}
              labelB={`${fmtData(confB1)} — ${fmtData(confB2 >= confB1 ? confB2 : confB1)}`}
              righe={[
                { label: 'Clienti attivi', corrente: aggA.clientiAttivi, precedente: aggB.clientiAttivi, fmt: v => String(Math.round(v)) },
                { label: 'Visite totali', corrente: aggA.visite, precedente: aggB.visite, fmt: v => String(Math.round(v)) },
                { label: 'Spesa totale', corrente: aggA.spesa, precedente: aggB.spesa, fmt: v => `€${v.toFixed(2)}` },
                { label: 'Media fiche', corrente: aggA.mediaFiche, precedente: aggB.mediaFiche, fmt: v => `€${v.toFixed(2)}` },
                { label: 'Cancellazioni', corrente: aggA.cancellazioni, precedente: aggB.cancellazioni, fmt: v => String(Math.round(v)) },
              ]}
            />
          </div>
        </div>
      )}

      {modalita === 'combinata' && (
        <div className="flex flex-wrap items-center gap-4 text-xs text-stone-400">
          <span className="flex items-center gap-1.5"><span className="w-3 h-1.5 rounded-full bg-amber-400 inline-block" /> Frequenza</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-1.5 rounded-full bg-emerald-400 inline-block" /> Spesa</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-1.5 rounded-full bg-sky-400 inline-block" /> Media fiches</span>
          <span className="flex items-center gap-1.5"><span className="text-red-400 font-bold">✕</span> Cancellazioni (penalità)</span>
        </div>
      )}

      {ranked.length === 0 ? (
        <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center">
          <BarChart2 size={36} className="text-stone-200 mx-auto mb-3" />
          <p className="text-stone-400 text-sm">Nessun dato per {periodoLabel}</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-sm">
          <div className={`px-5 py-3.5 border-b flex items-center justify-between ${classifica === 'peggiori' ? 'border-red-100 bg-red-50/40' : 'border-stone-100'}`}>
            <div className="flex items-center gap-2">
              {classifica === 'migliori' ? <Trophy size={15} className="text-amber-500" /> : <ThumbsDown size={15} className="text-red-400" />}
              <span className="text-sm font-semibold text-stone-700">
                {classifica === 'migliori' ? 'Top' : 'Ultimi'} clienti — {periodoLabel}
              </span>
            </div>
            <span className="text-xs text-stone-400">{ranked.length} clienti</span>
          </div>
          {classifica === 'migliori' && ranked.length >= 3 && (
            <div className="grid grid-cols-3 gap-2 px-5 py-5 bg-gradient-to-b from-amber-50/50 to-white border-b border-stone-100">
              {podioOrder.map((c, i) => (
                <button key={c.id} onClick={() => onSelectCliente(c.id)} className={`flex flex-col items-center gap-1 ${podioTopPad[i]} hover:opacity-80 transition-opacity`}>
                  <AvatarCircle initials={`${c.nome[0]?.toUpperCase()}${c.cognome[0]?.toUpperCase()}`} size={podioSizes[i]} bg={podioBg[i]} />
                  <span className="text-base leading-none mt-0.5">{podioMedal[i]}</span>
                  <p className="text-xs font-semibold text-stone-700 text-center truncate w-full px-1">{c.nome}</p>
                  <p className="text-[11px] text-stone-400 text-center truncate w-full px-1">{c.cognome}</p>
                  <span className="text-[11px] font-bold text-stone-500">
                    {modalita === 'frequenza' ? `${c.freqMensile.toFixed(1)}/mese` :
                     modalita === 'spesa' ? `€${c.spesa.toFixed(0)}` :
                     modalita === 'fiches' ? `€${c.mediaFiche.toFixed(0)}` :
                     `${c.score.toFixed(0)}/100`}
                  </span>
                </button>
              ))}
            </div>
          )}
          <div>
            {ranked.map((c, i) => (
              <RigaCliente key={c.id} c={c} pos={i} modalita={modalita} classifica={classifica}
                onSelect={onSelectCliente} maxFreq={maxFreq} maxSpesa={maxSpesa} maxFiche={maxFiche} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Parrucchieri section ─────────────────────────────────────────────────────

function RigaParrucchiereWithMax({ p, pos, modalita, classifica, maxFiche, maxSpesa, maxClienti, maxAppt, onClick }: {
  p: ParrStats; pos: number; modalita: ModalitaParr; classifica: Classifica;
  maxFiche: number; maxSpesa: number; maxClienti: number; maxAppt: number;
  onClick: () => void;
}) {
  const isPeggiori = classifica === 'peggiori';
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-3 px-5 py-4 hover:bg-stone-50 transition-colors text-left group ${pos > 0 ? 'border-t border-stone-100' : ''}`}>
      {pos < 3 && !isPeggiori ? (
        <span className="text-lg leading-none w-7 text-center flex-shrink-0">{MEDAL_EMOJI[pos]}</span>
      ) : (
        <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${isPeggiori ? 'bg-red-50' : 'bg-stone-100'}`}>
          <span className={`text-xs font-bold ${isPeggiori ? 'text-red-400' : 'text-stone-500'}`}>{pos + 1}</span>
        </div>
      )}
      <AvatarCircle initials={p.nome.slice(0, 2).toUpperCase()} size="sm" bg={p.colore || avatarColor(p.id)} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <span className="font-semibold text-stone-800 text-sm group-hover:text-amber-700 transition-colors">{p.nome}</span>
          <div className="flex items-center gap-3 text-xs text-stone-400 flex-shrink-0">
            {(modalita === 'combinata' || modalita === 'fiches') && <span className="flex items-center gap-1"><Scissors size={10} className="text-sky-400" />€{p.mediaFiche.toFixed(0)}/fiche</span>}
            {(modalita === 'combinata' || modalita === 'spesa') && <span className="flex items-center gap-1"><Euro size={10} className="text-emerald-400" />€{p.spesaTotale.toFixed(0)}</span>}
            {(modalita === 'combinata' || modalita === 'clienti_serviti') && <span className="flex items-center gap-1"><Users size={10} className="text-amber-400" />{p.clientiUnici} clienti</span>}
            {modalita === 'appuntamenti' && <span className="flex items-center gap-1"><BarChart2 size={10} className="text-blue-400" />{p.appuntamenti} appt.</span>}
          </div>
        </div>
        <div className="grid grid-cols-4 gap-1 text-[11px] text-stone-400 mb-2">
          <span>{p.appuntamenti} appunt.</span>
          <span className="text-center">{p.clientiUnici} clienti</span>
          <span className="text-center">€{p.mediaFiche.toFixed(0)}/fiche</span>
          <span className="text-right">€{p.spesaTotale.toFixed(0)}</span>
        </div>
        <div className="space-y-0.5">
          {(modalita === 'combinata' || modalita === 'fiches') && <BarIndicator value={p.mediaFiche} max={maxFiche} color="#0ea5e9" />}
          {(modalita === 'combinata' || modalita === 'spesa') && <BarIndicator value={p.spesaTotale} max={maxSpesa} color="#10b981" />}
          {(modalita === 'combinata' || modalita === 'clienti_serviti') && <BarIndicator value={p.clientiUnici} max={maxClienti} color="#f59e0b" />}
          {(modalita === 'combinata' || modalita === 'appuntamenti') && <BarIndicator value={p.appuntamenti} max={maxAppt} color="#3b82f6" />}
        </div>
        {modalita === 'combinata' && <div className="text-[11px] text-stone-400 mt-1">score {p.score.toFixed(0)}/100</div>}
      </div>
    </button>
  );
}

function SezioneParrucchieri({ parrucchieri, appuntamenti, fiches, ficheVoci, anni, mesiPerAnno }: {
  parrucchieri: Parrucchiere[]; appuntamenti: RawAppuntamento[]; fiches: FicheConvalidata[];
  ficheVoci: FicheVoceStats[];
  anni: number[]; mesiPerAnno: Record<number, number[]>;
}) {
  const [modalita, setModalita] = useState<ModalitaParr>('combinata');
  const [classifica, setClassifica] = useState<Classifica>('migliori');
  const [periodo, setPeriodo] = useState<PeriodoKey>('corrente');
  const [schedaParrId, setSchedaParrId] = useState<string | null>(null);

  const schedaParr = schedaParrId ? parrucchieri.find(p => p.id === schedaParrId) ?? null : null;
  if (schedaParr) {
    return (
      <SchedaParrucchiere
        parrucchiere={schedaParr}
        appuntamenti={appuntamenti}
        fiches={fiches}
        ficheVoci={ficheVoci}
        anni={anni}
        mesiPerAnno={mesiPerAnno}
        onBack={() => setSchedaParrId(null)}
      />
    );
  }

  const stats = buildParrStats(parrucchieri, appuntamenti, fiches, periodo, ficheVoci);
  const ranked = rankParr(stats, modalita, classifica);
  const maxFiche = Math.max(...ranked.map(s => s.mediaFiche), 0.001);
  const maxSpesa = Math.max(...ranked.map(s => s.spesaTotale), 0.001);
  const maxClienti = Math.max(...ranked.map(s => s.clientiUnici), 0.001);
  const maxAppt = Math.max(...ranked.map(s => s.appuntamenti), 0.001);
  const periodoLabel = labelPeriodo(periodo);

  const MODALITA: { key: ModalitaParr; label: string; icon: React.ElementType }[] = [
    { key: 'combinata', label: 'Combinata', icon: Trophy },
    { key: 'fiches', label: 'Media fiches', icon: Scissors },
    { key: 'spesa', label: 'Spesa generata', icon: Euro },
    { key: 'clienti_serviti', label: 'Clienti serviti', icon: Users },
    { key: 'appuntamenti', label: 'Appuntamenti', icon: BarChart2 },
  ];

  const top3 = ranked.slice(0, 3);
  const podioOrder = ranked.length >= 3 ? [top3[1], top3[0], top3[2]] : [];
  const podioTopPad = ['pt-4', 'pt-0', 'pt-8'];
  const podioSizes: ('sm' | 'md' | 'lg')[] = ['md', 'lg', 'sm'];
  const podioMedal = [MEDAL_EMOJI[1], MEDAL_EMOJI[0], MEDAL_EMOJI[2]];
  const podioBg = [PODIO_COLORS[1], PODIO_COLORS[0], PODIO_COLORS[2]];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex bg-white border border-stone-200 rounded-xl p-1 gap-1 shadow-sm flex-wrap">
          {MODALITA.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setModalita(key)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${modalita === key ? 'bg-amber-500 text-white shadow-sm' : 'text-stone-500 hover:text-stone-800'}`}>
              <Icon size={14} /><span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>
        <MiglioriPeggioriToggle valore={classifica} onChange={setClassifica} />
        <div className="ml-auto flex items-center gap-2">
          <PeriodoSelector anni={anni} mesiPerAnno={mesiPerAnno} valore={periodo} onChange={setPeriodo} />
          {ranked.length > 0 && (
            <button
              onClick={() => esportaParrucchieriPDF(ranked, modalita, classifica, periodoLabel)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-600 text-sm font-medium shadow-sm transition-colors"
              title="Esporta PDF"
            >
              <Download size={14} />
              <span className="hidden sm:inline">PDF</span>
            </button>
          )}
        </div>
      </div>

      {modalita === 'combinata' && (
        <div className="flex flex-wrap items-center gap-4 text-xs text-stone-400">
          <span className="flex items-center gap-1.5"><span className="w-3 h-1.5 rounded-full bg-sky-400 inline-block" /> Media fiches</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-1.5 rounded-full bg-emerald-400 inline-block" /> Spesa generata</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-1.5 rounded-full bg-amber-400 inline-block" /> Clienti serviti</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-1.5 rounded-full bg-blue-400 inline-block" /> N. appuntamenti</span>
        </div>
      )}

      <p className="text-xs text-stone-400">Clicca su un parrucchiere per vedere la sua scheda dettagliata.</p>

      {ranked.length === 0 ? (
        <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center">
          <BarChart2 size={36} className="text-stone-200 mx-auto mb-3" />
          <p className="text-stone-400 text-sm">Nessun dato per {periodoLabel}</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-sm">
          <div className={`px-5 py-3.5 border-b flex items-center justify-between ${classifica === 'peggiori' ? 'border-red-100 bg-red-50/40' : 'border-stone-100'}`}>
            <div className="flex items-center gap-2">
              {classifica === 'migliori' ? <Trophy size={15} className="text-amber-500" /> : <ThumbsDown size={15} className="text-red-400" />}
              <span className="text-sm font-semibold text-stone-700">
                {classifica === 'migliori' ? 'Top' : 'Ultimi'} parrucchieri — {periodoLabel}
              </span>
            </div>
            <span className="text-xs text-stone-400">{ranked.length} parrucchieri</span>
          </div>

          {classifica === 'migliori' && ranked.length >= 3 && (
            <div className="grid grid-cols-3 gap-2 px-5 py-5 bg-gradient-to-b from-amber-50/50 to-white border-b border-stone-100">
              {podioOrder.map((p, i) => {
                const val = modalita === 'fiches' ? `€${p.mediaFiche.toFixed(0)}/fiche`
                  : modalita === 'spesa' ? `€${p.spesaTotale.toFixed(0)}`
                  : modalita === 'clienti_serviti' ? `${p.clientiUnici} clienti`
                  : modalita === 'appuntamenti' ? `${p.appuntamenti} appt.`
                  : `${p.score.toFixed(0)}/100`;
                return (
                  <button key={p.id} onClick={() => setSchedaParrId(p.id)} className={`flex flex-col items-center gap-1 ${podioTopPad[i]} hover:opacity-80 transition-opacity`}>
                    <AvatarCircle initials={p.nome.slice(0, 2).toUpperCase()} size={podioSizes[i]} bg={podioBg[i]} />
                    <span className="text-base leading-none mt-0.5">{podioMedal[i]}</span>
                    <p className="text-xs font-semibold text-stone-700 text-center">{p.nome}</p>
                    <span className="text-[11px] font-bold text-stone-500">{val}</span>
                  </button>
                );
              })}
            </div>
          )}

          <div>
            {ranked.map((p, i) => (
              <RigaParrucchiereWithMax
                key={p.id} p={p} pos={i} modalita={modalita} classifica={classifica}
                maxFiche={maxFiche} maxSpesa={maxSpesa} maxClienti={maxClienti} maxAppt={maxAppt}
                onClick={() => setSchedaParrId(p.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sezione Negozio ─────────────────────────────────────────────────────────

interface ServizioStats {
  nome: string;
  tipi: Set<string>;
  occorrenze: number;
  ricavoTotale: number;
  prezzoMedio: number;
  clientiUnici: Set<string>;
  ficheUnici: Set<string>;
}

// Merge voci con stesso nome_voce indipendentemente dal tipo
function buildServizioStats(voci: FicheVoceStats[], periodo: PeriodoKey): ServizioStats[] {
  const vociFiltrate = filtraPerPeriodo(voci, periodo);
  const mappa: Record<string, ServizioStats> = {};
  for (const v of vociFiltrate) {
    const key = v.nome_voce.trim().toLowerCase();
    if (!mappa[key]) mappa[key] = { nome: v.nome_voce, tipi: new Set(), occorrenze: 0, ricavoTotale: 0, prezzoMedio: 0, clientiUnici: new Set(), ficheUnici: new Set() };
    mappa[key].tipi.add(v.tipo);
    mappa[key].occorrenze++;
    mappa[key].ricavoTotale += v.prezzo;
    mappa[key].clientiUnici.add(v.cliente_id);
    mappa[key].ficheUnici.add(v.fiche_id);
  }
  return Object.values(mappa).map(s => ({ ...s, prezzoMedio: s.occorrenze > 0 ? s.ricavoTotale / s.occorrenze : 0 }));
}

function buildMediaFicheNegozio(fiches: FicheConvalidata[], periodo: PeriodoKey) {
  const fFiltrate = filtraPerPeriodo(fiches, periodo);
  const count = fFiltrate.length;
  const totale = fFiltrate.reduce((s, f) => s + f.importo_convalidato, 0);
  return { count, totale, media: count > 0 ? totale / count : 0 };
}

interface FicheMensilePoint { mese: string; ricavo: number; count: number; media: number; clienti: number; }
function buildFicheMensili(fiches: FicheConvalidata[]): FicheMensilePoint[] {
  const mesiSet = new Set(fiches.map(f => f.data_ora.slice(0, 7)));
  return [...mesiSet].sort().map(mese => {
    const fm = fiches.filter(f => f.data_ora.startsWith(mese));
    const ricavo = fm.reduce((s, f) => s + f.importo_convalidato, 0);
    const clientiSet = new Set(fm.map(f => f.cliente_id));
    return { mese, ricavo, count: fm.length, media: fm.length > 0 ? ricavo / fm.length : 0, clienti: clientiSet.size };
  });
}

type FicheNegozioMetric = 'ricavo' | 'count' | 'media' | 'clienti';
const FICHE_NEGOZIO_CFG: Record<FicheNegozioMetric, { label: string; color: string; fmt: (v: number) => string }> = {
  ricavo:  { label: 'Ricavo fiches', color: '#10b981', fmt: v => `€${v.toFixed(0)}` },
  count:   { label: 'N. fiches',     color: '#0ea5e9', fmt: v => String(Math.round(v)) },
  media:   { label: 'Media fiche',   color: '#f59e0b', fmt: v => `€${v.toFixed(0)}` },
  clienti: { label: 'Clienti',       color: '#f97316', fmt: v => String(Math.round(v)) },
};

// Storico mensile per un singolo servizio (tutto lo storico, ignora periodo)
interface ServizioMensile { mese: string; occorrenze: number; ricavo: number; clientiUnici: number; prezzoMedio: number; }
function buildServizioStorico(nome: string, voci: FicheVoceStats[]): ServizioMensile[] {
  const key = nome.trim().toLowerCase();
  const filtrate = voci.filter(v => v.nome_voce.trim().toLowerCase() === key);
  const mesiSet = new Set(filtrate.map(v => v.data_ora.slice(0, 7)));
  return [...mesiSet].sort().map(mese => {
    const vm = filtrate.filter(v => v.data_ora.startsWith(mese));
    const clientiSet = new Set(vm.map(v => v.cliente_id));
    const ricavo = vm.reduce((s, v) => s + v.prezzo, 0);
    return { mese, occorrenze: vm.length, ricavo, clientiUnici: clientiSet.size, prezzoMedio: vm.length > 0 ? ricavo / vm.length : 0 };
  });
}

type ServizioOrdinamento = 'occorrenze' | 'ricavo' | 'prezzo_medio' | 'clienti';
type ServizioChartMetric = 'occorrenze' | 'ricavo' | 'clientiUnici' | 'prezzoMedio';

const SERVIZIO_CHART_CONFIG: Record<ServizioChartMetric, { label: string; color: string; fmt: (v: number) => string }> = {
  occorrenze:  { label: 'Occorrenze',   color: '#10b981', fmt: v => `${Math.round(v)}x` },
  ricavo:      { label: 'Ricavo',        color: '#f59e0b', fmt: v => `€${v.toFixed(0)}` },
  clientiUnici:{ label: 'Clienti unici', color: '#0ea5e9', fmt: v => String(Math.round(v)) },
  prezzoMedio: { label: 'Prezzo medio',  color: '#f97316', fmt: v => `€${v.toFixed(0)}` },
};

const BAR_H_S = 120;
const BAR_MIN_W_S = 36;

function ClientiUniciModal({ nome, voci, clienti, onClose }: {
  nome: string; voci: FicheVoceStats[]; clienti: Cliente[]; onClose: () => void;
}) {
  const key = nome.trim().toLowerCase();
  const filtrate = voci.filter(v => v.nome_voce.trim().toLowerCase() === key);
  const clientiIdSet = new Set(filtrate.map(v => v.cliente_id));
  const clientiList = clienti.filter(c => clientiIdSet.has(c.id));
  const anonimi = clientiIdSet.size - clientiList.length;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm max-h-[80vh] flex flex-col z-10">
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100">
          <div>
            <h3 className="text-sm font-bold text-stone-800">Clienti unici</h3>
            <p className="text-xs text-stone-400 mt-0.5 truncate max-w-[220px]">{nome}</p>
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-700 transition-colors p-1 rounded-lg hover:bg-stone-100">
            <X size={16} />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 divide-y divide-stone-50">
          {clientiList.length === 0 && anonimi === 0 ? (
            <p className="text-sm text-stone-400 text-center py-8">Nessun cliente trovato</p>
          ) : (
            <>
              {clientiList.map(c => (
                <div key={c.id} className="flex items-center gap-3 px-5 py-3">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                    style={{ backgroundColor: avatarColor(c.id) }}
                  >
                    {c.nome[0]?.toUpperCase()}{c.cognome[0]?.toUpperCase()}
                  </div>
                  <span className="text-sm font-medium text-stone-800">{c.nome} {c.cognome}</span>
                </div>
              ))}
              {anonimi > 0 && (
                <div className="px-5 py-3 text-xs text-stone-400 italic">
                  + {anonimi} cliente{anonimi > 1 ? 'i' : ''} non identificato{anonimi > 1 ? 'i' : ''}
                </div>
              )}
            </>
          )}
        </div>
        <div className="px-5 py-3 border-t border-stone-100 text-xs text-stone-400">
          {clientiIdSet.size} client{clientiIdSet.size === 1 ? 'e' : 'i'} in totale (tutto lo storico)
        </div>
      </div>
    </div>
  );
}

function ServizioStorico({ nome, voci, clienti, onClose }: { nome: string; voci: FicheVoceStats[]; clienti: Cliente[]; onClose: () => void }) {
  const [metric, setMetric] = useState<ServizioChartMetric>('occorrenze');
  const [showClienti, setShowClienti] = useState(false);
  const storico = buildServizioStorico(nome, voci);
  const cfg = SERVIZIO_CHART_CONFIG[metric];
  const getValue = (d: ServizioMensile) => {
    if (metric === 'occorrenze') return d.occorrenze;
    if (metric === 'ricavo') return d.ricavo;
    if (metric === 'clientiUnici') return d.clientiUnici;
    return d.prezzoMedio;
  };
  const maxVal = Math.max(...storico.map(getValue), 1);

  const totalClientiUnici = new Set(
    voci.filter(v => v.nome_voce.trim().toLowerCase() === nome.trim().toLowerCase()).map(v => v.cliente_id)
  ).size;

  return (
    <>
      {showClienti && (
        <ClientiUniciModal nome={nome} voci={voci} clienti={clienti} onClose={() => setShowClienti(false)} />
      )}
      <div className="mx-6 mb-4 bg-stone-50 rounded-xl border border-stone-200 p-4">
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <span className="text-sm font-semibold text-stone-700">Storico — {nome}</span>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex flex-wrap gap-1">
              {(Object.keys(SERVIZIO_CHART_CONFIG) as ServizioChartMetric[]).filter(m => m !== 'clientiUnici').map(m => (
                <button key={m} onClick={() => setMetric(m)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${metric === m ? 'text-white shadow-sm' : 'bg-white text-stone-500 hover:bg-stone-100 border border-stone-200'}`}
                  style={metric === m ? { backgroundColor: SERVIZIO_CHART_CONFIG[m].color } : {}}>
                  {SERVIZIO_CHART_CONFIG[m].label}
                </button>
              ))}
              <button onClick={() => setMetric('clientiUnici')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${metric === 'clientiUnici' ? 'text-white shadow-sm' : 'bg-white text-stone-500 hover:bg-stone-100 border border-stone-200'}`}
                style={metric === 'clientiUnici' ? { backgroundColor: SERVIZIO_CHART_CONFIG['clientiUnici'].color } : {}}>
                {SERVIZIO_CHART_CONFIG['clientiUnici'].label}
              </button>
              <button
                onClick={() => setShowClienti(true)}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium bg-white border border-stone-200 text-stone-600 hover:bg-stone-100 hover:border-stone-300 transition-all"
                title="Vedi elenco clienti"
              >
                <Users size={12} />
                <span>{totalClientiUnici}</span>
              </button>
            </div>
            <button onClick={onClose} className="text-stone-400 hover:text-stone-600 transition-colors ml-1">
              <ArrowLeft size={14} />
            </button>
          </div>
        </div>
        {storico.length === 0 ? (
          <p className="text-xs text-stone-400 text-center py-6">Nessun dato disponibile</p>
        ) : (
          <div className="overflow-x-auto">
            <div className="flex items-end gap-2 min-w-max px-1 pb-0"
              style={{ minWidth: `${Math.max(storico.length * (BAR_MIN_W_S + 16), 280)}px` }}>
              {storico.map(d => {
                const val = getValue(d);
                const pct = maxVal > 0 ? val / maxVal : 0;
                const barPx = Math.max(pct * BAR_H_S, val > 0 ? 6 : 0);
                const [year, month] = d.mese.split('-');
                const label = `${NOMI_MESI[Number(month) - 1]} '${year.slice(2)}`;
                return (
                  <div key={d.mese} className="flex flex-col items-center gap-1" style={{ minWidth: `${BAR_MIN_W_S}px` }}>
                    <span className="text-[10px] font-semibold leading-none" style={{ color: cfg.color, minHeight: '14px' }}>
                      {val > 0 ? cfg.fmt(val) : ''}
                    </span>
                    <div className="relative w-full rounded-md overflow-hidden" style={{ height: `${BAR_H_S}px`, backgroundColor: '#e7e5e4' }}>
                      <div className="absolute bottom-0 left-0 right-0 rounded-md transition-all duration-500"
                        style={{ height: `${barPx}px`, backgroundColor: cfg.color, opacity: 0.88 }} />
                    </div>
                    <span className="text-[10px] text-stone-500 font-medium leading-none mt-1 whitespace-nowrap">{label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function SezioneNegozio({
  fiches, ficheVoci, clienti, anni, mesiPerAnno,
}: {
  fiches: FicheConvalidata[];
  ficheVoci: FicheVoceStats[];
  clienti: Cliente[];
  anni: number[];
  mesiPerAnno: Record<number, number[]>;
}) {
  const [periodo, setPeriodo] = useState<PeriodoKey>('corrente');
  const [ordinamento, setOrdinamento] = useState<ServizioOrdinamento>('occorrenze');
  const [tipoFiltro, setTipoFiltro] = useState<'tutti' | 'servizio' | 'extra'>('tutti');
  const [aperto, setAperto] = useState<string | null>(null);
  const [ficheMetric, setFicheMetric] = useState<FicheNegozioMetric>('ricavo');
  const [showConfronto, setShowConfronto] = useState(false);
  const todayNeg = new Date().toISOString().slice(0, 10);
  const [confA1, setConfA1] = useState(todayNeg);
  const [confA2, setConfA2] = useState(todayNeg);
  const [confB1, setConfB1] = useState(todayNeg);
  const [confB2, setConfB2] = useState(todayNeg);
  const ficheMensili = buildFicheMensili(fiches);

  const mediaFiche = buildMediaFicheNegozio(fiches, periodo);
  const pA = mkIntervalloPeriodo(confA1, confA2 >= confA1 ? confA2 : confA1);
  const pB = mkIntervalloPeriodo(confB1, confB2 >= confB1 ? confB2 : confB1);
  const mediaFicheA = buildMediaFicheNegozio(fiches, pA);
  const mediaFicheB = buildMediaFicheNegozio(fiches, pB);
  const servizi = buildServizioStats(ficheVoci, periodo);

  // Per il filtro tipo, un servizio è "servizio" se ha tipi con solo "servizio", "extra" se solo "extra", altrimenti "misto"
  const serviziFiltered = tipoFiltro === 'tutti' ? servizi : servizi.filter(s => {
    if (tipoFiltro === 'servizio') return s.tipi.has('servizio');
    if (tipoFiltro === 'extra') return s.tipi.has('extra') && !s.tipi.has('servizio');
    return true;
  });
  const serviziSorted = [...serviziFiltered].sort((a, b) => {
    if (ordinamento === 'occorrenze') return b.occorrenze - a.occorrenze;
    if (ordinamento === 'ricavo') return b.ricavoTotale - a.ricavoTotale;
    if (ordinamento === 'prezzo_medio') return b.prezzoMedio - a.prezzoMedio;
    return b.clientiUnici.size - a.clientiUnici.size;
  });

  const maxOccorrenze = Math.max(...serviziSorted.map(s => s.occorrenze), 1);
  const maxRicavo = Math.max(...serviziSorted.map(s => s.ricavoTotale), 1);

  function freqMensile(s: ServizioStats) {
    if (periodo === 'sempre') {
      const vociS = filtraPerPeriodo(ficheVoci, periodo).filter(v => v.nome_voce.trim().toLowerCase() === s.nome.trim().toLowerCase());
      const mesiSet = new Set(vociS.map(v => v.data_ora.slice(0, 7)));
      return s.occorrenze / Math.max(mesiSet.size, 1);
    }
    if (periodo === 'corrente') return s.occorrenze / Math.max(mesiPassati, 1);
    if (isMese(periodo)) return s.occorrenze;
    if (isIntervallo(periodo)) {
      const { da, a: fine } = parseIntervallo(periodo);
      const diffMs = new Date(intervalloEndDate(fine)).getTime() - new Date(intervalloStartDate(da)).getTime();
      const nMesi = Math.max(diffMs / (1000 * 60 * 60 * 24 * 30.44), 1);
      return s.occorrenze / nMesi;
    }
    return s.occorrenze / 12;
  }

  function badgeTipo(s: ServizioStats) {
    const hasSrv = s.tipi.has('servizio');
    const hasExt = s.tipi.has('extra');
    if (hasSrv && hasExt) return <div className="px-2 py-0.5 rounded-full text-[10px] font-semibold flex-shrink-0 bg-amber-50 text-amber-700">Misto</div>;
    if (hasSrv) return <div className="px-2 py-0.5 rounded-full text-[10px] font-semibold flex-shrink-0 bg-emerald-50 text-emerald-700">Servizio</div>;
    return <div className="px-2 py-0.5 rounded-full text-[10px] font-semibold flex-shrink-0 bg-sky-50 text-sky-600">Extra</div>;
  }

  const SORT_OPTS: { key: ServizioOrdinamento; label: string }[] = [
    { key: 'occorrenze', label: 'Piu svolto' },
    { key: 'ricavo', label: 'Piu produttivo' },
    { key: 'prezzo_medio', label: 'Prezzo medio' },
    { key: 'clienti', label: 'Clienti unici' },
  ];

  return (
    <div className="space-y-5">
      {/* Media fiches negozio */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6">
        <div className="flex items-center justify-between gap-4 flex-wrap mb-5">
          <div>
            <h3 className="text-base font-semibold text-stone-800">Media fiches negozio</h3>
            <p className="text-xs text-stone-400 mt-0.5">Valore medio per fiche convalidata</p>
          </div>
          <div className="flex items-center gap-2">
            <PeriodoSelector anni={anni} mesiPerAnno={mesiPerAnno} valore={periodo} onChange={setPeriodo} />
            <button
              onClick={() => setShowConfronto(s => !s)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-medium shadow-sm transition-colors ${showConfronto ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-stone-200 bg-white hover:bg-stone-50 text-stone-600'}`}
              title="Confronta due periodi"
            >
              <GitCompare size={14} />
              <span className="hidden sm:inline">Confronta</span>
            </button>
            <button
              onClick={() => esportaNegozioPDF(
                mediaFiche, serviziSorted, labelPeriodo(periodo),
                showConfronto ? mkPdfConfronto([
                  { label: 'Media per fiche', corrente: mediaFicheA.media, precedente: mediaFicheB.media, fmtFn: v => `€${v.toFixed(2)}` },
                  { label: 'Fiches convalidate', corrente: mediaFicheA.count, precedente: mediaFicheB.count, fmtFn: v => String(Math.round(v)) },
                  { label: 'Ricavo totale', corrente: mediaFicheA.totale, precedente: mediaFicheB.totale, fmtFn: v => `€${v.toFixed(2)}` },
                ], `${fmtData(confA1)} — ${fmtData(confA2 >= confA1 ? confA2 : confA1)}`, `${fmtData(confB1)} — ${fmtData(confB2 >= confB1 ? confB2 : confB1)}`) : undefined
              )}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-600 text-sm font-medium shadow-sm transition-colors"
              title="Esporta PDF"
            >
              <Download size={14} />
              <span className="hidden sm:inline">PDF</span>
            </button>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-stone-50 rounded-xl p-4 border border-stone-100">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center mb-2">
              <Euro size={15} className="text-emerald-600" />
            </div>
            <p className="text-2xl font-bold text-stone-800">€{mediaFiche.media.toFixed(2)}</p>
            <p className="text-xs text-stone-400 mt-0.5">Media per fiche</p>
          </div>
          <div className="bg-stone-50 rounded-xl p-4 border border-stone-100">
            <div className="w-8 h-8 rounded-lg bg-sky-50 flex items-center justify-center mb-2">
              <BarChart2 size={15} className="text-sky-600" />
            </div>
            <p className="text-2xl font-bold text-stone-800">{mediaFiche.count}</p>
            <p className="text-xs text-stone-400 mt-0.5">Fiches convalidate</p>
          </div>
          <div className="bg-stone-50 rounded-xl p-4 border border-stone-100">
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center mb-2">
              <TrendingUp size={15} className="text-amber-600" />
            </div>
            <p className="text-2xl font-bold text-stone-800">€{mediaFiche.totale.toFixed(2)}</p>
            <p className="text-xs text-stone-400 mt-0.5">Ricavo da fiches convalidate</p>
          </div>
        </div>

        {/* Confronto periodi personalizzato */}
        {showConfronto && (
          <div className="mt-4 rounded-2xl border border-stone-200 overflow-hidden">
            <div className="px-4 py-3 bg-stone-50 border-b border-stone-100">
              <p className="text-xs font-semibold text-stone-600">Confronto periodi personalizzato</p>
              <p className="text-xs text-stone-400 mt-0.5">Scegli due intervalli di date per confrontarli</p>
            </div>
            <div className="p-4 space-y-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <DateRangeInput label="Periodo A" da={confA1} a={confA2} onDa={setConfA1} onA={setConfA2} colore="#10b981" />
                <DateRangeInput label="Periodo B" da={confB1} a={confB2} onDa={setConfB1} onA={setConfB2} colore="#a8a29e" />
              </div>
              <PannelloConfronto
                colore="#10b981"
                labelA={`${fmtData(confA1)} — ${fmtData(confA2 >= confA1 ? confA2 : confA1)}`}
                labelB={`${fmtData(confB1)} — ${fmtData(confB2 >= confB1 ? confB2 : confB1)}`}
                righe={[
                  { label: 'Media per fiche', corrente: mediaFicheA.media, precedente: mediaFicheB.media, fmt: v => `€${v.toFixed(2)}` },
                  { label: 'Fiches convalidate', corrente: mediaFicheA.count, precedente: mediaFicheB.count, fmt: v => String(Math.round(v)) },
                  { label: 'Ricavo totale', corrente: mediaFicheA.totale, precedente: mediaFicheB.totale, fmt: v => `€${v.toFixed(2)}` },
                ]}
              />
            </div>
          </div>
        )}

        {ficheMensili.length > 0 && (
          <div className="mt-5 pt-5 border-t border-stone-100">
            <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
              <span className="text-sm font-semibold text-stone-700">Andamento mensile fiches</span>
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(FICHE_NEGOZIO_CFG) as FicheNegozioMetric[]).map(m => (
                  <button key={m} onClick={() => setFicheMetric(m)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${ficheMetric === m ? 'text-white shadow-sm' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'}`}
                    style={ficheMetric === m ? { backgroundColor: FICHE_NEGOZIO_CFG[m].color } : {}}>
                    {FICHE_NEGOZIO_CFG[m].label}
                  </button>
                ))}
              </div>
            </div>
            <MonthlyBarChart
              data={ficheMensili}
              valueKey={ficheMetric}
              color={FICHE_NEGOZIO_CFG[ficheMetric].color}
              fmt={FICHE_NEGOZIO_CFG[ficheMetric].fmt}
            />
          </div>
        )}
      </div>

      {/* Statistiche per servizio */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-stone-100">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h3 className="text-base font-semibold text-stone-800">Analisi per servizio</h3>
              <p className="text-xs text-stone-400 mt-0.5">Frequenza, produttivita e ricavo di ogni servizio</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex bg-stone-100 rounded-lg p-0.5 gap-0.5">
                {(['tutti', 'servizio', 'extra'] as const).map(t => (
                  <button key={t} onClick={() => setTipoFiltro(t)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${tipoFiltro === t ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}>
                    {t === 'tutti' ? 'Tutti' : t === 'servizio' ? 'Servizi' : 'Extra'}
                  </button>
                ))}
              </div>
              <div className="flex bg-stone-100 rounded-lg p-0.5 gap-0.5">
                {SORT_OPTS.map(o => (
                  <button key={o.key} onClick={() => setOrdinamento(o.key)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${ordinamento === o.key ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}>
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {serviziSorted.length === 0 ? (
          <div className="p-10 text-center text-sm text-stone-400">Nessun dato per il periodo selezionato</div>
        ) : (
          <div className="divide-y divide-stone-50">
            {serviziSorted.map((s, i) => {
              const barWidth = ordinamento === 'occorrenze'
                ? (s.occorrenze / maxOccorrenze) * 100
                : (s.ricavoTotale / maxRicavo) * 100;
              const freq = freqMensile(s);
              const isMeseP = isMese(periodo);
              const isAperto = aperto === s.nome;
              const barColor = s.tipi.has('servizio') ? '#10b981' : '#0ea5e9';
              return (
                <div key={s.nome}>
                  <div
                    className={`px-6 py-4 cursor-pointer transition-colors ${isAperto ? 'bg-stone-50' : 'hover:bg-stone-50'}`}
                    onClick={() => setAperto(isAperto ? null : s.nome)}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-6 text-center flex-shrink-0">
                        {i < 3 ? (
                          <Star size={14} className={i === 0 ? 'text-amber-500' : i === 1 ? 'text-stone-400' : 'text-amber-700'} fill="currentColor" />
                        ) : (
                          <span className="text-xs text-stone-300 font-medium">{i + 1}</span>
                        )}
                      </div>
                      {badgeTipo(s)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-sm font-semibold text-stone-800 truncate">{s.nome}</span>
                          <div className="flex items-center gap-3 flex-shrink-0 text-xs text-stone-500">
                            <span className="flex items-center gap-1"><Hash size={11} />{s.occorrenze}x</span>
                            <span className="text-emerald-600 font-semibold">€{s.ricavoTotale.toFixed(0)}</span>
                            <span className={`transition-transform duration-200 ${isAperto ? 'rotate-90' : ''}`}>
                              <ChevronDown size={13} className="text-stone-400" />
                            </span>
                          </div>
                        </div>
                        <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${barWidth}%`, backgroundColor: barColor }} />
                        </div>
                      </div>
                    </div>
                    <div className="mt-2.5 ml-10 grid grid-cols-4 gap-2">
                      <div className="text-center">
                        <p className="text-xs font-semibold text-stone-700">€{s.prezzoMedio.toFixed(2)}</p>
                        <p className="text-[10px] text-stone-400">Prezzo medio</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs font-semibold text-stone-700">{s.clientiUnici.size}</p>
                        <p className="text-[10px] text-stone-400">Clienti unici</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs font-semibold text-stone-700">{isMeseP ? `${s.occorrenze}x` : `${freq.toFixed(1)}x/mese`}</p>
                        <p className="text-[10px] text-stone-400">Frequenza</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs font-semibold text-stone-700">€{(s.ricavoTotale / Math.max(s.clientiUnici.size, 1)).toFixed(2)}</p>
                        <p className="text-[10px] text-stone-400">Ricavo/cliente</p>
                      </div>
                    </div>
                  </div>
                  {isAperto && (
                    <ServizioStorico nome={s.nome} voci={ficheVoci} clienti={clienti} onClose={() => setAperto(null)} />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Assenze Parrucchieri ────────────────────────────────────────────────────

interface Assenza {
  id: string;
  parrucchiere_id: string;
  data_inizio: string;
  data_fine: string;
  ora_inizio: string | null;
  note: string;
}

function giorniAssenza(a: Assenza): number {
  const start = new Date(a.data_inizio);
  const end = new Date(a.data_fine);
  const diff = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(1, diff);
}

function filtraAssenzePerPeriodo(assenze: Assenza[], periodo: PeriodoKey): Assenza[] {
  return assenze.filter(a => {
    const start = a.data_inizio;
    const end = a.data_fine;
    if (periodo === 'sempre') return true;
    if (periodo === 'corrente') {
      const y = String(annoCorrente);
      return start.startsWith(y) || end.startsWith(y) || (start < y && end >= y);
    }
    if (isMese(periodo)) {
      const [py, pm] = periodo.split('-').map(Number);
      const msStart = new Date(py, pm - 1, 1).toISOString().slice(0, 10);
      const msEnd = new Date(py, pm, 0).toISOString().slice(0, 10);
      return start <= msEnd && end >= msStart;
    }
    if (isIntervallo(periodo)) {
      const { da, a: fine } = parseIntervallo(periodo);
      const s = intervalloStartDate(da);
      const e = intervalloEndDate(fine);
      return start <= e && end >= s;
    }
    const y = periodo;
    return start.startsWith(y) || end.startsWith(y) || (start < y && end >= y);
  });
}

// Builds monthly breakdown of total absence days per hairdresser
function buildAssenzeMensili(parrId: string, assenze: Assenza[], periodo: PeriodoKey): { mese: string; giorni: number }[] {
  const filtrate = filtraAssenzePerPeriodo(assenze.filter(a => a.parrucchiere_id === parrId), periodo);
  const mesiMap: Record<string, number> = {};
  for (const a of filtrate) {
    const start = new Date(a.data_inizio);
    const end = new Date(a.data_fine);
    const cur = new Date(start);
    while (cur <= end) {
      const mese = `${cur.getFullYear()}-${pad(cur.getMonth() + 1)}`;
      mesiMap[mese] = (mesiMap[mese] || 0) + 1;
      cur.setDate(cur.getDate() + 1);
    }
  }
  return Object.entries(mesiMap).sort(([a], [b]) => a.localeCompare(b)).map(([mese, giorni]) => ({ mese, giorni }));
}

function formatDataAssenza(d: string) {
  const [y, m, g] = d.split('-').map(Number);
  return `${g} ${NOMI_MESI_LUNGHI[m - 1].slice(0, 3)} ${y}`;
}

function SezioneAssenze({
  parrucchieri,
  anni,
  mesiPerAnno,
  assenze,
}: {
  parrucchieri: Parrucchiere[];
  anni: number[];
  mesiPerAnno: Record<number, number[]>;
  assenze: Assenza[];
}) {
  const [periodo, setPeriodo] = useState<PeriodoKey>('corrente');
  const [parrSel, setParrSel] = useState<string | null>(null);

  const parrConAssenze = parrucchieri.filter(p => assenze.some(a => a.parrucchiere_id === p.id));

  function totGiorniParr(parrId: string) {
    return filtraAssenzePerPeriodo(assenze.filter(a => a.parrucchiere_id === parrId), periodo)
      .reduce((s, a) => s + giorniAssenza(a), 0);
  }

  if (parrSel) {
    const parr = parrucchieri.find(p => p.id === parrSel);
    if (!parr) return null;
    const mensili = buildAssenzeMensili(parrSel, assenze, periodo);
    const assenzeFiltrate = filtraAssenzePerPeriodo(assenze.filter(a => a.parrucchiere_id === parrSel), periodo)
      .sort((a, b) => b.data_inizio.localeCompare(a.data_inizio));
    const totGiorni = assenzeFiltrate.reduce((s, a) => s + giorniAssenza(a), 0);
    const colore = parr.colore || '#94a3b8';

    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setParrSel(null)}
              className="p-2 hover:bg-stone-100 rounded-xl transition-colors text-stone-500 hover:text-stone-800"
            >
              <ArrowLeft size={16} />
            </button>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0" style={{ backgroundColor: colore }}>
                {parr.nome.charAt(0).toUpperCase()}
              </div>
              <div>
                <h3 className="text-base font-bold text-stone-800">{parr.nome}</h3>
                <p className="text-xs text-stone-400">{totGiorni} giorn{totGiorni === 1 ? 'o' : 'i'} di assenza nel periodo</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <PeriodoSelector anni={anni} mesiPerAnno={mesiPerAnno} valore={periodo} onChange={setPeriodo} />
            <button
              onClick={() => esportaAssenzePDF(parrucchieri, assenze.filter(a => a.parrucchiere_id === parrSel), periodo, labelPeriodo(periodo))}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-600 text-sm font-medium shadow-sm transition-colors"
              title="Esporta PDF"
            >
              <Download size={14} />
              <span className="hidden sm:inline">PDF</span>
            </button>
          </div>
        </div>

        {/* Monthly chart */}
        {mensili.length > 0 ? (
          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5">
            <p className="text-sm font-semibold text-stone-700 mb-4">Giorni di assenza per mese</p>
            <MonthlyBarChart
              data={mensili}
              valueKey="giorni"
              color={colore}
              fmt={v => `${Math.round(v)}g`}
            />
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-stone-200 p-8 text-center">
            <p className="text-sm text-stone-400">Nessuna assenza nel periodo selezionato</p>
          </div>
        )}

        {/* Absence list */}
        {assenzeFiltrate.length > 0 && (
          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-stone-100">
              <p className="text-sm font-semibold text-stone-700">Storico assenze</p>
            </div>
            <div className="divide-y divide-stone-100">
              {assenzeFiltrate.map(a => {
                const giorni = giorniAssenza(a);
                const stessaData = a.data_inizio === a.data_fine;
                return (
                  <div key={a.id} className="px-5 py-3 flex items-center gap-4">
                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: colore }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-stone-800">
                        {stessaData ? formatDataAssenza(a.data_inizio) : `${formatDataAssenza(a.data_inizio)} – ${formatDataAssenza(a.data_fine)}`}
                      </p>
                      {a.ora_inizio && <p className="text-xs text-stone-400 mt-0.5">Dalle {a.ora_inizio.slice(0, 5)}</p>}
                      {a.note && <p className="text-xs text-stone-400 mt-0.5 italic">{a.note}</p>}
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-stone-100 text-stone-600">
                        {a.ora_inizio ? 'Parziale' : `${giorni}g`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-stone-500">Seleziona un parrucchiere per vedere lo storico dettagliato</p>
        </div>
        <div className="flex items-center gap-2">
          <PeriodoSelector anni={anni} mesiPerAnno={mesiPerAnno} valore={periodo} onChange={setPeriodo} />
          <button
            onClick={() => esportaAssenzePDF(parrucchieri, assenze, periodo, labelPeriodo(periodo))}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-600 text-sm font-medium shadow-sm transition-colors"
            title="Esporta PDF"
          >
            <Download size={14} />
            <span className="hidden sm:inline">PDF</span>
          </button>
        </div>
      </div>

      {parrConAssenze.length === 0 ? (
        <div className="bg-white rounded-2xl border border-stone-200 p-10 text-center">
          <UserX size={32} className="text-stone-300 mx-auto mb-3" />
          <p className="text-sm text-stone-400">Nessuna assenza registrata</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden divide-y divide-stone-100">
          {parrucchieri.map(p => {
            const tot = totGiorniParr(p.id);
            const nAssenze = filtraAssenzePerPeriodo(assenze.filter(a => a.parrucchiere_id === p.id), periodo).length;
            if (nAssenze === 0) return null;
            const colore = p.colore || '#94a3b8';
            return (
              <button
                key={p.id}
                onClick={() => setParrSel(p.id)}
                className="w-full flex items-center gap-4 px-5 py-4 hover:bg-stone-50 transition-colors text-left group"
              >
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0" style={{ backgroundColor: colore }}>
                  {p.nome.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-stone-800">{p.nome}</p>
                  <p className="text-xs text-stone-400">{nAssenze} assenz{nAssenze === 1 ? 'a' : 'e'}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-base font-bold text-stone-800">{tot}</p>
                  <p className="text-xs text-stone-400">giorni</p>
                </div>
                <ChevronDown size={14} className="text-stone-400 -rotate-90 group-hover:text-stone-600 transition-colors" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

interface Props { onSelectCliente: (id: string) => void; }

export default function Statistiche({ onSelectCliente }: Props) {
  const [sezione, setSezione] = useState<Sezione>('clienti');
  const [clienti, setClienti] = useState<Cliente[]>([]);
  const [parrucchieri, setParrucchieri] = useState<Parrucchiere[]>([]);
  const [appuntamenti, setAppuntamenti] = useState<RawAppuntamento[]>([]);
  const [ficheConvalidate, setFicheConvalidate] = useState<FicheConvalidata[]>([]);
  const [ficheVociStats, setFicheVociStats] = useState<FicheVoceStats[]>([]);
  const [assenze, setAssenze] = useState<Assenza[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [{ data: cl }, { data: parr }, { data: ap }, { data: fiche }, { data: voci }, { data: ass }] = await Promise.all([
        dbSelect({ table: 'clienti', columns: 'id, nome, cognome', orderBy: [{ col: 'cognome', asc: true }] }),
        dbSelect({ table: 'parrucchieri', columns: 'id, nome, colore', orderBy: [{ col: 'nome', asc: true }] }),
        dbSelect({ table: 'appuntamenti', columns: 'id, data_ora, stato, cliente_id, parrucchiere_id', orderBy: [{ col: 'data_ora', asc: false }] }),
        dbSelect({
          table: 'fiches',
          columns: 'id, importo_convalidato, convalidata_at, appuntamento_id, cliente_id, appuntamenti(id, data_ora, cliente_id, parrucchiere_id)',
          filters: [{ col: 'convalidata', op: 'eq', val: true }],
        }),
        dbSelect({
          table: 'fiche_voci',
          columns: 'parrucchiere_id, prezzo, fiche_id, nome_voce, tipo, fiches!inner(convalidata, convalidata_at, appuntamento_id, cliente_id, appuntamenti(data_ora, cliente_id, parrucchiere_id))',
          filters: [{ col: 'fiches.convalidata', op: 'eq', val: true }],
        }),
        dbSelect({ table: 'assenze_parrucchieri', columns: 'id, parrucchiere_id, data_inizio, data_fine, ora_inizio, note', orderBy: [{ col: 'data_inizio', asc: false }] }),
      ]);
      setClienti((cl as Cliente[]) || []);
      setParrucchieri((parr as Parrucchiere[]) || []);
      setAppuntamenti((ap as RawAppuntamento[]) || []);
      setAssenze((ass as Assenza[]) || []);

      // Mappa appuntamento_id -> appuntamento per join rapido in JS
      const appMap: Record<string, { cliente_id: string | null; parrucchiere_id: string | null; data_ora: string }> = {};
      for (const a of ap || []) appMap[a.id] = { cliente_id: a.cliente_id, parrucchiere_id: a.parrucchiere_id, data_ora: a.data_ora };

      const ficheFlat: FicheConvalidata[] = [];
      for (const f of fiche || []) {
        const appJoined = Array.isArray(f.appuntamenti) ? f.appuntamenti[0] : f.appuntamenti;
        // fallback: cerca nella mappa appuntamenti già caricata (gestisce casi dove il join non porta dati)
        const appFromMap = f.appuntamento_id ? appMap[f.appuntamento_id] : null;
        const dataOra = appJoined?.data_ora ?? appFromMap?.data_ora ?? f.convalidata_at;
        if (!dataOra) continue;
        const clienteId = appJoined?.cliente_id ?? appFromMap?.cliente_id ?? f.cliente_id ?? `__anonimo__${f.id}`;
        const parrucchiereId = appJoined?.parrucchiere_id ?? appFromMap?.parrucchiere_id ?? null;
        ficheFlat.push({
          appuntamento_id: f.appuntamento_id,
          importo_convalidato: f.importo_convalidato,
          convalidata_at: f.convalidata_at,
          cliente_id: clienteId,
          parrucchiere_id: parrucchiereId,
          data_ora: dataOra,
        });
      }
      setFicheConvalidate(ficheFlat);

      const vociFlatStats: FicheVoceStats[] = [];
      for (const v of (voci || []) as Array<{
        parrucchiere_id: string | null; prezzo: number; fiche_id: string; nome_voce: string; tipo: string;
        fiches: { convalidata: boolean; convalidata_at: string; appuntamento_id: string | null; cliente_id: string | null; appuntamenti: { data_ora: string; cliente_id: string; parrucchiere_id: string | null } | null } | null;
      }>) {
        const ficheRec = v.fiches;
        if (!ficheRec || !ficheRec.convalidata) continue;
        const appJoined = ficheRec.appuntamenti;
        const appFromMap = ficheRec.appuntamento_id ? appMap[ficheRec.appuntamento_id] : null;
        const dataOra = appJoined?.data_ora ?? appFromMap?.data_ora ?? ficheRec.convalidata_at;
        if (!dataOra) continue;
        const clienteId = appJoined?.cliente_id ?? appFromMap?.cliente_id ?? ficheRec.cliente_id ?? `__anonimo__${v.fiche_id}`;
        const parrucchiereId = v.parrucchiere_id
          ?? appJoined?.parrucchiere_id
          ?? appFromMap?.parrucchiere_id
          ?? null;
        if (!parrucchiereId) continue;
        vociFlatStats.push({
          fiche_id: v.fiche_id,
          parrucchiere_id: parrucchiereId,
          prezzo: v.prezzo,
          data_ora: dataOra,
          cliente_id: clienteId,
          nome_voce: v.nome_voce ?? '',
          tipo: v.tipo ?? 'servizio',
        });
      }
      setFicheVociStats(vociFlatStats);
      setLoading(false);
    }
    load();
  }, []);

  const completati = appuntamenti.filter(a => a.stato !== 'cancellato');
  const tutteDate = [
    ...completati.map(a => a.data_ora),
    ...ficheConvalidate.map(f => f.data_ora),
  ];
  const anni = [...new Set([
    ...tutteDate.map(d => new Date(d).getFullYear()),
    ...assenze.map(a => new Date(a.data_inizio).getFullYear()),
    ...assenze.map(a => new Date(a.data_fine).getFullYear()),
  ])].sort((a, b) => b - a);
  const mesiPerAnno: Record<number, number[]> = {};
  for (const d of tutteDate) {
    const dt = new Date(d);
    const y = dt.getFullYear();
    const m = dt.getMonth() + 1;
    if (!mesiPerAnno[y]) mesiPerAnno[y] = [];
    if (!mesiPerAnno[y].includes(m)) mesiPerAnno[y].push(m);
  }
  for (const a of assenze) {
    const y = new Date(a.data_inizio).getFullYear();
    const m = new Date(a.data_inizio).getMonth() + 1;
    if (!mesiPerAnno[y]) mesiPerAnno[y] = [];
    if (!mesiPerAnno[y].includes(m)) mesiPerAnno[y].push(m);
  }
  for (const y of Object.keys(mesiPerAnno)) mesiPerAnno[Number(y)].sort((a, b) => a - b);

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-stone-800">Statistiche</h2>
        <p className="text-sm text-stone-400 mt-0.5">Analisi performance — tutti i valori sono calcolati esclusivamente da fiches convalidate</p>
      </div>

      <div className="flex flex-wrap bg-white border border-stone-200 rounded-xl p-1 gap-1 shadow-sm w-fit">
        <button onClick={() => setSezione('clienti')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${sezione === 'clienti' ? 'bg-stone-800 text-white shadow-sm' : 'text-stone-500 hover:text-stone-800'}`}>
          <Users size={15} /> Clienti
        </button>
        <button onClick={() => setSezione('parrucchieri')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${sezione === 'parrucchieri' ? 'bg-stone-800 text-white shadow-sm' : 'text-stone-500 hover:text-stone-800'}`}>
          <Scissors size={15} /> Parrucchieri
        </button>
        <button onClick={() => setSezione('negozio')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${sezione === 'negozio' ? 'bg-stone-800 text-white shadow-sm' : 'text-stone-500 hover:text-stone-800'}`}>
          <Store size={15} /> Negozio
        </button>
        <button onClick={() => setSezione('assenze')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${sezione === 'assenze' ? 'bg-stone-800 text-white shadow-sm' : 'text-stone-500 hover:text-stone-800'}`}>
          <UserX size={15} /> Assenze
        </button>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl border border-stone-200 p-10 text-center">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-stone-400">Caricamento dati...</p>
        </div>
      ) : sezione === 'clienti' ? (
        <SezioneClienti clienti={clienti} appuntamenti={appuntamenti} fiches={ficheConvalidate} anni={anni} mesiPerAnno={mesiPerAnno} onSelectCliente={onSelectCliente} />
      ) : sezione === 'parrucchieri' ? (
        <SezioneParrucchieri parrucchieri={parrucchieri} appuntamenti={appuntamenti} fiches={ficheConvalidate} ficheVoci={ficheVociStats} anni={anni} mesiPerAnno={mesiPerAnno} />
      ) : sezione === 'assenze' ? (
        <SezioneAssenze parrucchieri={parrucchieri} anni={anni} mesiPerAnno={mesiPerAnno} assenze={assenze} />
      ) : (
        <SezioneNegozio fiches={ficheConvalidate} ficheVoci={ficheVociStats} clienti={clienti} anni={anni} mesiPerAnno={mesiPerAnno} />
      )}
    </div>
  );
}
