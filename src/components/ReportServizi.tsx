import { useCallback, useEffect, useRef, useState } from 'react';
import { BarChart2, ChevronDown, CreditCard, Download, Gift, Scissors } from 'lucide-react';
import { localDateStr } from '../lib/supabase';
import { dbSelect } from '../lib/localDb';
import { saveFile } from '../lib/fileSaver';

// ─── Types ────────────────────────────────────────────────────────────────────

type Periodo = 'settimana' | 'mese' | 'trimestre' | 'semestre' | 'anno';

interface RigaReport {
  nome: string;
  conteggio: number;
  totale: number;
  categoria: 'servizio' | 'giftpass' | 'ricarica';
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const NOMI_MESI = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'];

function getPeriodRange(p: Periodo): { start: string; end: string } {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const today = localDateStr(now);
  const y = now.getFullYear();
  const m = now.getMonth() + 1;

  if (p === 'settimana') {
    const d = new Date(now);
    d.setDate(d.getDate() - 6);
    return { start: localDateStr(d), end: today };
  }
  if (p === 'mese') {
    const lastDay = new Date(y, m, 0).getDate();
    return { start: `${y}-${pad(m)}-01`, end: `${y}-${pad(m)}-${pad(lastDay)}` };
  }
  if (p === 'trimestre') {
    const q = Math.floor((m - 1) / 3);
    const startM = q * 3 + 1;
    const endM = startM + 2;
    const lastDay = new Date(y, endM, 0).getDate();
    return { start: `${y}-${pad(startM)}-01`, end: `${y}-${pad(endM)}-${pad(lastDay)}` };
  }
  if (p === 'semestre') {
    if (m <= 6) return { start: `${y}-01-01`, end: `${y}-06-30` };
    return { start: `${y}-07-01`, end: `${y}-12-31` };
  }
  return { start: `${y}-01-01`, end: `${y}-12-31` };
}

function labelPeriodo(p: Periodo): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  if (p === 'settimana') return 'Ultimi 7 giorni';
  if (p === 'mese') return `${NOMI_MESI[m - 1]} ${y}`;
  if (p === 'trimestre') {
    const q = Math.floor((m - 1) / 3) + 1;
    return `Q${q} ${y}`;
  }
  if (p === 'semestre') return `S${m <= 6 ? 1 : 2} ${y}`;
  return `Anno ${y}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

type FormatoExport = 'pdf' | 'xls' | 'csv';

function buildCsv(righe: RigaReport[], totale: number, label: string): string {
  const sep = ';';
  const lines: string[] = [
    `Report per servizio${sep}${label}`,
    '',
    `Servizio${sep}N. eseguiti${sep}Totale (€)`,
    ...righe.map(r => `${r.nome}${sep}${r.conteggio}${sep}${r.totale.toFixed(2).replace('.', ',')}`),
    '',
    `TOTALE${sep}${righe.reduce((s, r) => s + r.conteggio, 0)}${sep}${totale.toFixed(2).replace('.', ',')}`,
  ];
  return lines.join('\r\n');
}

async function buildXls(righe: RigaReport[], totale: number, label: string): Promise<Blob> {
  // Minimal BIFF8-compatible XLS via XML SpreadsheetML (works in Excel italiano)
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const numFmt = (n: number) => n.toFixed(2).replace('.', ',');

  const dataRows = righe.map(r => `
    <Row>
      <Cell><Data ss:Type="String">${esc(r.nome)}</Data></Cell>
      <Cell><Data ss:Type="Number">${r.conteggio}</Data></Cell>
      <Cell><Data ss:Type="String">${numFmt(r.totale)}</Data></Cell>
    </Row>`).join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Worksheet ss:Name="Report">
    <Table>
      <Row><Cell ss:MergeAcross="2"><Data ss:Type="String">Report per servizio — ${esc(label)}</Data></Cell></Row>
      <Row></Row>
      <Row>
        <Cell><Data ss:Type="String">Servizio</Data></Cell>
        <Cell><Data ss:Type="String">N. eseguiti</Data></Cell>
        <Cell><Data ss:Type="String">Totale (€)</Data></Cell>
      </Row>
      ${dataRows}
      <Row></Row>
      <Row>
        <Cell><Data ss:Type="String">TOTALE</Data></Cell>
        <Cell><Data ss:Type="Number">${righe.reduce((s, r) => s + r.conteggio, 0)}</Data></Cell>
        <Cell><Data ss:Type="String">${numFmt(totale)}</Data></Cell>
      </Row>
    </Table>
  </Worksheet>
</Workbook>`;

  return new Blob([xml], { type: 'application/vnd.ms-excel;charset=UTF-8' });
}

async function buildPdf(righe: RigaReport[], totale: number, label: string): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(28, 25, 23);
  doc.text('Report per Servizio', 14, 16);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(120, 113, 108);
  doc.text(`${label} · escluso nero`, 14, 23);

  autoTable(doc, {
    startY: 28,
    head: [['Servizio / Prodotto', 'N. eseguiti', 'Totale']],
    body: righe.map(r => [r.nome, String(r.conteggio), `€${r.totale.toFixed(2).replace('.', ',')}`]),
    foot: [['TOTALE', String(righe.reduce((s, r) => s + r.conteggio, 0)), `€${totale.toFixed(2).replace('.', ',')}`]],
    headStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: 'bold', fontSize: 9 },
    footStyles: { fillColor: [240, 253, 250], textColor: [22, 163, 74], fontStyle: 'bold', fontSize: 9 },
    bodyStyles: { fontSize: 8, textColor: [28, 25, 23] },
    alternateRowStyles: { fillColor: [250, 250, 249] },
    columnStyles: { 1: { halign: 'center' }, 2: { halign: 'right' } },
    margin: { left: 14, right: 14 },
  });

  return doc.output('blob');
}

export default function ReportServizi() {
  const [periodo, setPeriodo] = useState<Periodo>('mese');
  const [loading, setLoading] = useState(true);
  const [servizi, setServizi] = useState<RigaReport[]>([]);
  const [giftPass, setGiftPass] = useState<RigaReport[]>([]);
  const [ricariche, setRicariche] = useState<RigaReport[]>([]);
  const [formato, setFormato] = useState<FormatoExport>('pdf');
  const [showFormato, setShowFormato] = useState(false);
  const [saving, setSaving] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowFormato(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const load = useCallback(async () => {    setLoading(true);
    const { start, end } = getPeriodRange(periodo);

    const [ficheRes, appRes, ricaricheRes] = await Promise.all([
      dbSelect({
        table: 'fiches',
        columns: 'id, data_riferimento, appuntamento_id',
        filters: [
          { col: 'convalidata', op: 'eq', val: true },
          { col: 'tipo_pagamento', op: 'in', val: ['contanti_verde', 'cc_bancomat'] },
          { col: 'deleted_at', op: 'is_null' },
        ],
      }),
      dbSelect({ table: 'appuntamenti', columns: 'id, data_ora' }),
      dbSelect({
        table: 'ricariche_carta_premium',
        columns: 'importo_pagato, created_at',
        filters: [
          { col: 'tipo_ricarica', op: 'eq', val: 'standard' },
          { col: 'tipo_pagamento', op: 'in', val: ['contanti_verde', 'cc_bancomat'] },
        ],
      }),
    ]);

    // Build appointment date map
    const appMap: Record<string, string> = {};
    for (const a of (appRes.data || []) as any[]) {
      if (a.id && a.data_ora) appMap[a.id] = (a.data_ora as string).slice(0, 10);
    }

    // Filter fiches within range
    const ficheInRange: string[] = [];
    for (const f of (ficheRes.data || []) as any[]) {
      const data: string | null = f.data_riferimento ?? (f.appuntamento_id ? (appMap[f.appuntamento_id] ?? null) : null);
      if (data && data >= start && data <= end) ficheInRange.push(f.id);
    }

    // Load fiche_voci for matching fiches
    let voceRows: any[] = [];
    if (ficheInRange.length > 0) {
      const { data } = await dbSelect({
        table: 'fiche_voci',
        columns: 'nome_voce, prezzo, note',
        filters: [{ col: 'fiche_id', op: 'in', val: ficheInRange }],
      });
      voceRows = (data || []) as any[];
    }

    // Aggregate by service name
    const serviziMap: Record<string, { conteggio: number; totale: number }> = {};
    const gpMap: Record<string, { conteggio: number; totale: number }> = {};

    for (const v of voceRows) {
      if (v.note === '__gift_prodotto__') continue;
      const isGP = /^Gift Pass #/.test(v.nome_voce ?? '');
      const key = isGP ? 'Gift Pass (valore)' : (v.nome_voce || 'Servizio');
      const map = isGP ? gpMap : serviziMap;
      if (!map[key]) map[key] = { conteggio: 0, totale: 0 };
      map[key].conteggio++;
      map[key].totale += (v.prezzo as number) ?? 0;
    }

    // Filter ricariche within range (use created_at date slice)
    const ricaricheInRange = ((ricaricheRes.data || []) as any[]).filter(r => {
      const d = (r.created_at as string | null)?.slice(0, 10);
      return d && d >= start && d <= end;
    });
    const totRicariche = ricaricheInRange.reduce((s: number, r: any) => s + ((r.importo_pagato as number) ?? 0), 0);

    setServizi(
      Object.entries(serviziMap)
        .sort(([, a], [, b]) => b.totale - a.totale)
        .map(([nome, v]) => ({ nome, ...v, categoria: 'servizio' as const }))
    );
    setGiftPass(
      Object.entries(gpMap)
        .map(([nome, v]) => ({ nome, ...v, categoria: 'giftpass' as const }))
    );
    setRicariche(
      ricaricheInRange.length > 0
        ? [{ nome: 'Ricariche Carta Premium', conteggio: ricaricheInRange.length, totale: totRicariche, categoria: 'ricarica' as const }]
        : []
    );
    setLoading(false);
  }, [periodo]);

  useEffect(() => { load(); }, [load]);

  const totaleGenerale =
    servizi.reduce((s, r) => s + r.totale, 0) +
    giftPass.reduce((s, r) => s + r.totale, 0) +
    ricariche.reduce((s, r) => s + r.totale, 0);

  const hasData = servizi.length + giftPass.length + ricariche.length > 0;

  async function handleSave() {
    if (saving || !hasData) return;
    setSaving(true);
    const righe: RigaReport[] = [...servizi, ...giftPass, ...ricariche];
    const label = labelPeriodo(periodo);
    const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    try {
      if (formato === 'pdf') {
        const blob = await buildPdf(righe, totaleGenerale, label);
        await saveFile('finanze', `report-servizi-${slug}.pdf`, blob);
      } else if (formato === 'xls') {
        const blob = await buildXls(righe, totaleGenerale, label);
        await saveFile('finanze_xls', `report-servizi-${slug}.xls`, blob);
      } else {
        const csv = buildCsv(righe, totaleGenerale, label);
        await saveFile('finanze_csv', `report-servizi-${slug}.csv`, csv, 'utf8');
      }
    } finally {
      setSaving(false);
    }
  }

  const FORMATI: { value: FormatoExport; label: string }[] = [
    { value: 'pdf', label: 'PDF' },
    { value: 'xls', label: 'Excel (italiano)' },
    { value: 'csv', label: 'CSV' },
  ];

  const PERIODI: { value: Periodo; label: string }[] = [
    { value: 'settimana', label: 'Settimana' },
    { value: 'mese', label: 'Mese' },
    { value: 'trimestre', label: 'Trimestre' },
    { value: 'semestre', label: 'Semestre' },
    { value: 'anno', label: 'Anno' },
  ];

  return (
    <div className="space-y-5">
      {/* Period selector */}
      <div className="bg-white rounded-2xl border border-stone-200 p-4 shadow-sm">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex bg-stone-100 rounded-xl p-1 gap-0.5 flex-wrap">
            {PERIODI.map(p => (
              <button
                key={p.value}
                onClick={() => setPeriodo(p.value)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  periodo === p.value
                    ? 'bg-white shadow-sm text-stone-800'
                    : 'text-stone-400 hover:text-stone-600'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Save button with format selector */}
          <div className="flex items-center gap-1 ml-2" ref={dropdownRef}>
            <button
              onClick={handleSave}
              disabled={saving || !hasData || loading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-white rounded-l-xl text-xs font-semibold transition-colors"
              title={`Salva ${FORMATI.find(f => f.value === formato)?.label}`}
            >
              {saving
                ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <Download size={13} />}
              Salva
            </button>
            <div className="relative">
              <button
                onClick={() => setShowFormato(s => !s)}
                disabled={saving}
                className="flex items-center px-2 py-1.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-white rounded-r-xl text-xs transition-colors border-l border-emerald-400"
                title="Scegli formato"
              >
                <span className="text-[10px] font-medium mr-0.5 opacity-80">{formato.toUpperCase()}</span>
                <ChevronDown size={11} className={`transition-transform ${showFormato ? 'rotate-180' : ''}`} />
              </button>
              {showFormato && (
                <div className="absolute right-0 top-full mt-1 bg-white border border-stone-200 rounded-xl shadow-lg z-50 overflow-hidden min-w-[140px]">
                  {FORMATI.map(f => (
                    <button
                      key={f.value}
                      onClick={() => { setFormato(f.value); setShowFormato(false); }}
                      className={`w-full text-left px-4 py-2.5 text-xs font-medium transition-colors ${
                        formato === f.value
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'text-stone-700 hover:bg-stone-50'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="ml-auto text-right">
            <p className="text-xs text-stone-400">{labelPeriodo(periodo)} · escluso nero</p>
            {!loading && (
              <p className="text-xl font-bold text-stone-800">€{totaleGenerale.toFixed(2)}</p>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !hasData ? (
        <div className="bg-white rounded-2xl border border-stone-200 p-10 text-center">
          <BarChart2 size={28} className="text-stone-200 mx-auto mb-3" />
          <p className="text-sm text-stone-400">Nessun dato per {labelPeriodo(periodo)}</p>
          <p className="text-xs text-stone-300 mt-1">
            Solo incassi con metodo di pagamento registrato (non in nero)
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-stone-100">
            <p className="text-sm font-semibold text-stone-700">Dettaglio per servizio</p>
            <p className="text-xs text-stone-400 mt-0.5">
              Incassi non in nero · {labelPeriodo(periodo)}
            </p>
          </div>

          {/* Servizi */}
          {servizi.length > 0 && (
            <>
              <div className="px-5 py-2.5 bg-stone-50 border-t border-stone-100">
                <div className="flex items-center gap-1.5">
                  <Scissors size={11} className="text-stone-400" />
                  <span className="text-[11px] font-semibold text-stone-400 uppercase tracking-wide">
                    Servizi
                  </span>
                  <span className="ml-auto text-xs font-semibold text-stone-500">
                    €{servizi.reduce((s, r) => s + r.totale, 0).toFixed(2)}
                  </span>
                </div>
              </div>
              <div className="divide-y divide-stone-50">
                {servizi.map(r => (
                  <div
                    key={r.nome}
                    className="flex items-center gap-3 px-5 py-3.5 hover:bg-stone-50/60 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-stone-800 truncate">{r.nome}</p>
                      <p className="text-xs text-stone-400">{r.conteggio}×</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-stone-800">€{r.totale.toFixed(2)}</p>
                      {r.conteggio > 1 && (
                        <p className="text-[11px] text-stone-400">
                          ≈ €{(r.totale / r.conteggio).toFixed(2)}/cad.
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Gift Pass */}
          {giftPass.length > 0 && (
            <>
              <div className="px-5 py-2.5 bg-stone-50 border-t border-stone-100">
                <div className="flex items-center gap-1.5">
                  <Gift size={11} className="text-amber-500" />
                  <span className="text-[11px] font-semibold text-stone-400 uppercase tracking-wide">
                    Gift Pass
                  </span>
                  <span className="ml-auto text-xs font-semibold text-stone-500">
                    €{giftPass.reduce((s, r) => s + r.totale, 0).toFixed(2)}
                  </span>
                </div>
              </div>
              <div className="divide-y divide-stone-50">
                {giftPass.map(r => (
                  <div
                    key={r.nome}
                    className="flex items-center gap-3 px-5 py-3.5 hover:bg-stone-50/60 transition-colors"
                  >
                    <Gift size={15} className="text-amber-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-stone-800">{r.nome}</p>
                      <p className="text-xs text-stone-400">{r.conteggio} acquistati</p>
                    </div>
                    <span className="text-sm font-bold text-stone-800 flex-shrink-0">
                      €{r.totale.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Carte Premium */}
          {ricariche.length > 0 && (
            <>
              <div className="px-5 py-2.5 bg-stone-50 border-t border-stone-100">
                <div className="flex items-center gap-1.5">
                  <CreditCard size={11} className="text-emerald-500" />
                  <span className="text-[11px] font-semibold text-stone-400 uppercase tracking-wide">
                    Carte Premium
                  </span>
                  <span className="ml-auto text-xs font-semibold text-stone-500">
                    €{ricariche.reduce((s, r) => s + r.totale, 0).toFixed(2)}
                  </span>
                </div>
              </div>
              <div className="divide-y divide-stone-50">
                {ricariche.map(r => (
                  <div
                    key={r.nome}
                    className="flex items-center gap-3 px-5 py-3.5 hover:bg-stone-50/60 transition-colors"
                  >
                    <CreditCard size={15} className="text-emerald-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-stone-800">{r.nome}</p>
                      <p className="text-xs text-stone-400">{r.conteggio} ricariche</p>
                    </div>
                    <span className="text-sm font-bold text-stone-800 flex-shrink-0">
                      €{r.totale.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Total footer */}
          <div className="px-5 py-4 bg-emerald-50 border-t border-emerald-100 flex items-center justify-between">
            <span className="text-sm font-semibold text-emerald-800">
              Totale · {labelPeriodo(periodo)}
            </span>
            <span className="text-xl font-bold text-emerald-700">€{totaleGenerale.toFixed(2)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
