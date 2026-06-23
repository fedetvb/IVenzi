import { useCallback, useEffect, useState } from 'react';
import { BarChart2, CreditCard, Gift, Scissors } from 'lucide-react';
import { localDateStr } from '../lib/supabase';
import { dbSelect } from '../lib/localDb';

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

export default function ReportServizi() {
  const [periodo, setPeriodo] = useState<Periodo>('mese');
  const [loading, setLoading] = useState(true);
  const [servizi, setServizi] = useState<RigaReport[]>([]);
  const [giftPass, setGiftPass] = useState<RigaReport[]>([]);
  const [ricariche, setRicariche] = useState<RigaReport[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
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
