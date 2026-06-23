import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { supabase } from './supabase';
import type { FinanzePeriodo } from '../electron.d';

export interface FinanzeReportRow {
  nome_voce: string;
  count: number;
  totale: number;
}

const PERIODO_LABELS: Record<FinanzePeriodo, string> = {
  settimana: 'Settimana',
  mese: 'Mese',
  '3mesi': 'Trimestre',
  '6mesi': 'Semestre',
  anno: 'Anno',
};

function fmt(d: string) { return d.split('-').reverse().join('/'); }

export function generateFinanzeReportPdf(
  rows: FinanzeReportRow[],
  periodo: FinanzePeriodo,
  startDate: string,
  endDate: string
): string {
  const doc = new jsPDF('p', 'mm', 'a4');

  const totCount = rows.reduce((s, r) => s + r.count, 0);
  const totAmount = rows.reduce((s, r) => s + r.totale, 0);
  const periodoLabel = PERIODO_LABELS[periodo] ?? periodo;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('REPORT FINANZE', 105, 22, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(`${periodoLabel}: ${fmt(startDate)} → ${fmt(endDate)}`, 105, 32, { align: 'center' });
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text('Solo pagamenti dichiarati (contanti + bancomat)', 105, 39, { align: 'center' });
  doc.setTextColor(0, 0, 0);

  const body = rows.map(r => [
    r.nome_voce,
    String(r.count),
    `€ ${r.totale.toFixed(2).replace('.', ',')}`,
  ]);

  (doc as any).autoTable({
    head: [['Servizio / Prodotto', 'N. eseguiti', 'Totale']],
    body,
    foot: [['TOTALE', String(totCount), `€ ${totAmount.toFixed(2).replace('.', ',')}`]],
    startY: 46,
    styles: { fontSize: 10, cellPadding: 3 },
    headStyles: { fillColor: [87, 83, 78], textColor: 255, fontStyle: 'bold' },
    footStyles: { fillColor: [245, 245, 244], textColor: [28, 25, 23], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [250, 250, 249] },
    columnStyles: {
      0: { cellWidth: 110 },
      1: { cellWidth: 35, halign: 'center' as const },
      2: { cellWidth: 45, halign: 'right' as const },
    },
  });

  return doc.output('datauristring').split(',')[1];
}

export async function fetchFinanzeReportData(
  startDate: string,
  endDate: string
): Promise<FinanzeReportRow[]> {
  const el = (window as any).electronAPI;

  if (el?.db) {
    // Electron: query SQLite
    const fichesRes = await el.db.select({
      table: 'fiches',
      columns: 'id',
      filters: [
        { col: 'convalidata', op: '=', val: 1 },
        { col: 'tipo_pagamento', op: 'in', val: ['contanti', 'bancomat'] },
        { col: 'data_riferimento', op: 'gte', val: startDate },
        { col: 'data_riferimento', op: 'lte', val: endDate },
        { col: 'deleted_at', op: 'is_null' },
      ],
    });
    if (!fichesRes?.ok) return [];
    const ids: string[] = (fichesRes.data ?? []).map((r: any) => r.id);
    if (ids.length === 0) return [];

    const vociRes = await el.db.select({
      table: 'fiche_voci',
      columns: 'nome_voce, prezzo',
      filters: [{ col: 'fiche_id', op: 'in', val: ids }],
    });
    if (!vociRes?.ok) return [];
    return aggregateVoci(vociRes.data ?? []);
  }

  // Web: Supabase
  const { data: fichesData } = await supabase
    .from('fiches')
    .select('id')
    .eq('convalidata', true)
    .in('tipo_pagamento', ['contanti', 'bancomat'])
    .gte('data_riferimento', startDate)
    .lte('data_riferimento', endDate)
    .is('deleted_at', null);

  const ids = (fichesData ?? []).map((r: any) => r.id);
  if (ids.length === 0) return [];

  const { data: vociData } = await supabase
    .from('fiche_voci')
    .select('nome_voce, prezzo')
    .in('fiche_id', ids);

  return aggregateVoci(vociData ?? []);
}

function aggregateVoci(voci: Array<{ nome_voce: string; prezzo: number }>): FinanzeReportRow[] {
  const map = new Map<string, { count: number; totale: number }>();
  for (const v of voci) {
    const nome = v.nome_voce?.trim() || '(senza nome)';
    const existing = map.get(nome) ?? { count: 0, totale: 0 };
    map.set(nome, { count: existing.count + 1, totale: existing.totale + Number(v.prezzo ?? 0) });
  }
  return Array.from(map.entries())
    .map(([nome_voce, { count, totale }]) => ({ nome_voce, count, totale }))
    .sort((a, b) => b.totale - a.totale);
}
