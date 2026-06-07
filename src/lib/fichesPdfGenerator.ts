import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { dbSelect, dbSelectWithRelated } from './localDb';

export interface FicheAutoRow {
  clienteNome: string;
  clienteCognome: string;
  orari: string;
  voci: { nome: string; prezzo: number }[];
  totale: number;
  tipoPagamento: 'cc_bancomat' | 'contanti_verde' | 'contanti_nero' | null;
}

export interface FichesForDate {
  tutte: FicheAutoRow[];
  dichiarate: FicheAutoRow[];
  nonDichiarate: FicheAutoRow[];
}

export async function fetchFichesForDate(dateStr: string): Promise<FichesForDate> {
  const start = new Date(`${dateStr}T00:00:00`).toISOString();
  const end = new Date(`${dateStr}T23:59:59`).toISOString();

  const appsRes = await dbSelectWithRelated<any>({
    table: 'appuntamenti',
    filters: [
      { col: 'data_ora', op: 'gte', val: start },
      { col: 'data_ora', op: 'lte', val: end },
      { col: 'stato', op: 'neq', val: 'cancellato' },
    ],
    orderBy: [{ col: 'data_ora', asc: true }],
    relations: [
      { key: 'clienti', table: 'clienti', fk: 'cliente_id', many: false },
      { key: 'appuntamento_trattamenti', table: 'appuntamento_trattamenti', manyFk: 'appuntamento_id', many: true },
    ],
    supabaseSelect: '*, clienti(id, nome, cognome), appuntamento_trattamenti(nome_trattamento, prezzo)',
  });

  const appList = (appsRes.data || []) as any[];
  const appIds = appList.map((a: any) => a.id);

  const ficheMap: Record<string, any> = {};
  if (appIds.length > 0) {
    const { data: ficheData } = await dbSelect({
      table: 'fiches',
      filters: [
        { col: 'appuntamento_id', op: 'in', val: appIds },
        { col: 'convalidata', op: 'eq', val: true },
      ],
    });
    for (const f of ficheData || []) {
      const { data: voci } = await dbSelect({
        table: 'fiche_voci',
        filters: [{ col: 'fiche_id', op: 'eq', val: (f as any).id }],
        orderBy: [{ col: 'ordine', asc: true }],
      });
      ficheMap[(f as any).appuntamento_id] = { ...f, voci: voci || [] };
    }
  }

  type GruppoMap = Record<string, {
    nome: string; cognome: string; orari: string[];
    voci: { nome: string; prezzo: number }[];
    tipoPagamento: any;
  }>;
  const gruppoMap: GruppoMap = {};

  for (const app of appList) {
    const fiche = ficheMap[app.id];
    if (!fiche) continue;
    const cid = app.clienti?.id ?? `__unknown__${app.id}`;
    const nome = app.clienti?.nome ?? '—';
    const cognome = app.clienti?.cognome ?? '';
    const orario = new Date(app.data_ora).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

    if (!gruppoMap[cid]) {
      gruppoMap[cid] = { nome, cognome, orari: [], voci: [], tipoPagamento: fiche.tipo_pagamento };
    }
    gruppoMap[cid].orari.push(orario);
    if (fiche.tipo_pagamento) gruppoMap[cid].tipoPagamento = fiche.tipo_pagamento;

    const voci = fiche.voci.length > 0
      ? fiche.voci.map((v: any) => ({ nome: v.nome_voce || '—', prezzo: Number(v.prezzo) || 0 }))
      : (app.appuntamento_trattamenti || []).map((t: any) => ({ nome: t.nome_trattamento || '—', prezzo: Number(t.prezzo) || 0 }));
    gruppoMap[cid].voci.push(...voci);
  }

  // Manual fiches
  const { data: ficheManuali } = await dbSelect({
    table: 'fiches',
    filters: [
      { col: 'manuale', op: 'eq', val: true },
      { col: 'data_riferimento', op: 'eq', val: dateStr },
      { col: 'convalidata', op: 'eq', val: true },
    ],
  });
  for (const f of ficheManuali || []) {
    const fAny = f as any;
    const [{ data: voci }, { data: clientData }] = await Promise.all([
      dbSelect({ table: 'fiche_voci', filters: [{ col: 'fiche_id', op: 'eq', val: fAny.id }] }),
      dbSelect({ table: 'clienti', filters: [{ col: 'id', op: 'eq', val: fAny.cliente_id }] }),
    ]);
    const cliente = clientData?.[0] as any ?? null;
    const key = `__manuale__${fAny.id}`;
    gruppoMap[key] = {
      nome: cliente?.nome ?? '—',
      cognome: cliente?.cognome ?? '',
      orari: [],
      voci: (voci || []).map((v: any) => ({ nome: v.nome_voce || '—', prezzo: Number(v.prezzo) || 0 })),
      tipoPagamento: fAny.tipo_pagamento,
    };
  }

  const rows: FicheAutoRow[] = Object.values(gruppoMap).map(g => ({
    clienteNome: g.nome,
    clienteCognome: g.cognome,
    orari: g.orari.join(', '),
    voci: g.voci,
    totale: g.voci.reduce((s, v) => s + v.prezzo, 0),
    tipoPagamento: g.tipoPagamento,
  }));

  return {
    tutte: rows,
    dichiarate: rows.filter(r => r.tipoPagamento !== 'contanti_nero'),
    nonDichiarate: rows.filter(r => r.tipoPagamento === 'contanti_nero'),
  };
}

export function generateFichesPdf(rows: FicheAutoRow[], dateLabel: string, title: string): Blob {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(28, 25, 23);
  doc.text(title, 14, 20);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(120, 113, 108);
  doc.text(dateLabel, 14, 28);

  if (rows.length === 0) {
    doc.setFontSize(11);
    doc.setTextColor(120, 113, 108);
    doc.text('Nessuna fiche convalidata per questa data.', 14, 42);
    return doc.output('blob');
  }

  const tableBody: string[][] = rows.map(row => {
    const nome = `${row.clienteNome} ${row.clienteCognome}`.trim() || 'Sconosciuto';
    const vociStr = row.voci.map(v => `${v.nome}  \u20AC${v.prezzo.toFixed(2)}`).join('\n') || '—';
    const pag = row.tipoPagamento === 'cc_bancomat' ? 'Bancomat/CC'
      : row.tipoPagamento === 'contanti_verde' ? 'Contanti'
      : row.tipoPagamento === 'contanti_nero' ? 'Contanti (non dich.)'
      : '—';
    return [nome, row.orari || '—', vociStr, pag, `\u20AC${row.totale.toFixed(2)}`];
  });

  autoTable(doc, {
    head: [['Cliente', 'Orario', 'Servizi', 'Pagamento', 'Totale']],
    body: tableBody,
    startY: 35,
    styles: { fontSize: 8, cellPadding: 2.5, lineColor: [231, 229, 228] as [number, number, number] },
    headStyles: { fillColor: [28, 25, 23] as [number, number, number], textColor: [255, 255, 255] as [number, number, number], fontStyle: 'bold', fontSize: 8 },
    alternateRowStyles: { fillColor: [250, 250, 249] as [number, number, number] },
    columnStyles: {
      0: { cellWidth: 42 },
      1: { cellWidth: 18 },
      2: { cellWidth: 78 },
      3: { cellWidth: 30 },
      4: { cellWidth: 22, halign: 'right' as const },
    },
  });

  // Riepilogo
  const totale = rows.reduce((s, r) => s + r.totale, 0);
  doc.addPage();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(28, 25, 23);
  doc.text('Riepilogo incasso', 14, 24);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(120, 113, 108);
  doc.text(dateLabel, 14, 31);
  doc.setDrawColor(231, 229, 228);
  doc.line(14, 34, 196, 34);
  let y = 42;
  doc.setFontSize(9);
  for (const row of rows) {
    const nome = `${row.clienteNome} ${row.clienteCognome}`.trim() || 'Sconosciuto';
    doc.setTextColor(28, 25, 23);
    doc.text(nome, 14, y);
    doc.setTextColor(22, 163, 74);
    doc.text(`\u20AC${row.totale.toFixed(2)}`, 180, y, { align: 'right' });
    y += 6;
    if (y > 270) { doc.addPage(); y = 20; }
  }
  doc.setDrawColor(231, 229, 228);
  doc.line(14, y, 196, y);
  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(28, 25, 23);
  doc.text('Totale incasso', 14, y);
  doc.setTextColor(22, 163, 74);
  doc.text(`\u20AC${totale.toFixed(2)}`, 180, y, { align: 'right' });

  return doc.output('blob');
}
