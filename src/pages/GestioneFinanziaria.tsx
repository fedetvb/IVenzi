import { useCallback, useEffect, useState } from 'react';
import {
  Plus, X, Settings, ArrowDownCircle, ArrowUpCircle,
  PieChart, Receipt, AlertCircle, ChevronDown, ChevronUp,
  ChevronLeft, ChevronRight,
  Trash2, Pencil, TrendingDown, TrendingUp, Clock, Target, Info,
} from 'lucide-react';
import { supabase, localDateStr } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';

// ─── Types ───────────────────────────────────────────────────────────────────

type Ricorrenza = 'una_tantum' | 'mensile' | 'bimestrale' | 'trimestrale' | 'quadrimestrale' | 'quinquemestrale' | 'semestrale' | 'annuale';

interface Spesa {
  id: string;
  data: string;
  categoria: string;
  descrizione: string;
  importo: number;        // gross total (netto + iva)
  importo_netto: number;  // net before VAT
  importo_iva: number;    // VAT amount
  aliquota_iva: number;   // VAT rate %
  ricorrente: boolean;
  ricorrenza: Ricorrenza;
  tipo: 'uscita' | 'entrata_extra';
  periodo_da?: string | null;
  periodo_a?: string | null;
  data_inizio?: string | null;
  data_fine?: string | null;
  created_at: string;
}

const RICORRENZE: { value: Ricorrenza; label: string; mesi: number }[] = [
  { value: 'una_tantum',       label: 'Una tantum',   mesi: 0  },
  { value: 'mensile',          label: 'Mensile',      mesi: 1  },
  { value: 'bimestrale',       label: 'Ogni 2 mesi',  mesi: 2  },
  { value: 'trimestrale',      label: 'Trimestrale',  mesi: 3  },
  { value: 'quadrimestrale',   label: 'Ogni 4 mesi',  mesi: 4  },
  { value: 'quinquemestrale',  label: 'Ogni 5 mesi',  mesi: 5  },
  { value: 'semestrale',       label: 'Semestrale',   mesi: 6  },
  { value: 'annuale',          label: 'Annuale',      mesi: 12 },
];

type FormaGiuridica = 'partita_iva' | 'srl' | 'srls' | 'snc';

interface ImpostazioneTasse {
  id: string;
  forma_giuridica: FormaGiuridica;
  aliquota_iva: number;
  aliquota_irpef: number;
  regime_fiscale: 'ordinario' | 'forfettario';
  percentuale_forfettario: number;
  imposta_sostitutiva: number;
}

const FORME_GIURIDICHE: { value: FormaGiuridica; label: string; desc: string }[] = [
  { value: 'partita_iva', label: 'Partita IVA', desc: 'Ditta individuale / libero professionista' },
  { value: 'srl',         label: 'S.r.l.',      desc: 'Società a responsabilità limitata' },
  { value: 'srls',        label: 'S.r.l.s.',    desc: 'SRL semplificata (capitale < €10k)' },
  { value: 'snc',         label: 'S.n.c.',      desc: 'Società in nome collettivo' },
];

// IVA note per forma giuridica (tutte applicano IVA ordinaria 22% sui servizi di parrucchiere)
// Il regime forfettario è esente IVA — non la espone né la versa
export const IVA_INFO: Record<FormaGiuridica, { aliquota: number; nota: string }> = {
  partita_iva: {
    aliquota: 22,
    nota: 'IVA 22% in regime ordinario. In regime forfettario sei esente: non addebiti né versi IVA.',
  },
  srl: {
    aliquota: 22,
    nota: 'SRL soggetta a IVA ordinaria 22% sui servizi. Liquidazione trimestrale o mensile.',
  },
  srls: {
    aliquota: 22,
    nota: 'SRLS: stessa disciplina IVA della SRL, aliquota ordinaria 22%.',
  },
  snc: {
    aliquota: 22,
    nota: 'SNC soggetta a IVA ordinaria 22%. Il reddito netto IVA è poi tassato IRPEF in capo ai soci.',
  },
};

// Pro-rata detraibilità IVA per categoria di uscita (art. 19-bis DPR 633/72)
// 1.0 = 100% detraibile, 0.5 = 50%, ecc.
const IVA_DETRAIBILITA: Record<string, number> = {
  'Acquisto prodotti (rivendita)':    1.0,  // beni destinati alla rivendita — piena detrazione
  'Acquisto materiali salon':          1.0,  // materiali di consumo inerenti — piena detrazione
  'Manutenzione attrezzature':         1.0,  // inerente all'attività — piena detrazione
  'Formazione / Corsi':                1.0,  // inerente — piena detrazione
  'Affitto':                           1.0,  // affitto locale commerciale — piena detrazione
  'Bollette (luce/gas/acqua)':         1.0,  // utenze locali commerciali — piena detrazione
  'Condominio':                        1.0,  // spese condominiali — piena detrazione
  'Marketing / Pubblicità':            1.0,  // pubblicità inerente — piena detrazione
  'Software / Abbonamenti':            1.0,  // strumenti professionali — piena detrazione
  'Assicurazione':                     0.0,  // premi assicurativi esenti IVA ex art. 10 n.2
  'Internet / Telefono':               0.5,  // telefonia: 50% detraibile (art. 19-bis1 lett. b)
  'Commercialista':                    1.0,  // prestazione professionale — piena detrazione
  'INPS artigiani':                    0.0,  // contributi previdenziali: fuori campo IVA
  'IVA trimestrale':                   0.0,  // versamento IVA: fuori campo IVA
  'IRPEF / Acconto':                   0.0,  // imposta diretta: fuori campo IVA
  'Imposta sostitutiva':               0.0,  // imposta diretta: fuori campo IVA
  'TARI / IMU':                        0.0,  // tributi locali: fuori campo IVA
  'Stipendi / Collaboratori':          0.0,  // lavoro dipendente: fuori campo IVA
  'Altro':                             1.0,  // default piena detrazione (utente valuta)
};

// Default tax parameters per forma giuridica
function defaultsForForma(f: FormaGiuridica): Partial<ImpostazioneTasse> {
  const ivaAliq = IVA_INFO[f]?.aliquota ?? 22;
  switch (f) {
    case 'srl':
    case 'srls':
      // IRES 24% + IRAP 3.9%; ordinario, no forfettario
      return { regime_fiscale: 'ordinario', aliquota_iva: ivaAliq, aliquota_irpef: 24, percentuale_forfettario: 0, imposta_sostitutiva: 0 };
    case 'snc':
      // Redditi attribuiti ai soci → IRPEF ordinaria, IVA 22%
      return { regime_fiscale: 'ordinario', aliquota_iva: ivaAliq, aliquota_irpef: 23, percentuale_forfettario: 0, imposta_sostitutiva: 0 };
    default: // partita_iva
      return { regime_fiscale: 'forfettario', aliquota_iva: ivaAliq, aliquota_irpef: 23, percentuale_forfettario: 67, imposta_sostitutiva: 15 };
  }
}

type ModalitaFiltro = 'periodo' | 'anno' | 'sempre';
type DurataPeriodo = 1 | 2 | 3 | 4 | 6 | 12; // mesi

interface FiltroGestionale {
  modalita: ModalitaFiltro;
  // per modalita='periodo': mese (1-12) e anno di inizio + durata in mesi
  mesePeriodo: number;    // 1-12
  annoPeriodo: number;
  durata: DurataPeriodo;
  // per modalita='anno'
  annoAnno: number;
}

const DURATE: { value: DurataPeriodo; label: string }[] = [
  { value: 1,  label: 'Mensile' },
  { value: 2,  label: 'Bimestrale' },
  { value: 3,  label: 'Trimestrale' },
  { value: 4,  label: 'Quadrimestrale' },
  { value: 6,  label: 'Semestrale' },
  { value: 12, label: 'Annuale' },
];

const MESI_LABELS = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'];

function filtroDefault(): FiltroGestionale {
  const now = new Date();
  return {
    modalita: 'periodo',
    mesePeriodo: now.getMonth() + 1,
    annoPeriodo: now.getFullYear(),
    durata: 1,
    annoAnno: now.getFullYear(),
  };
}

function filtroLabel(f: FiltroGestionale): string {
  if (f.modalita === 'sempre') return 'Sempre';
  if (f.modalita === 'anno') return `Anno ${f.annoAnno}`;
  if (f.durata === 1) return `${MESI_LABELS[f.mesePeriodo - 1]} ${f.annoPeriodo}`;
  // Calcola mese finale del periodo
  const endDate = new Date(f.annoPeriodo, f.mesePeriodo - 1 + f.durata - 1, 1);
  const meseEnd = MESI_LABELS[endDate.getMonth()];
  const annoEnd = endDate.getFullYear();
  const meseStart = MESI_LABELS[f.mesePeriodo - 1];
  if (annoEnd === f.annoPeriodo) {
    return `${meseStart} – ${meseEnd} ${f.annoPeriodo}`;
  }
  return `${meseStart} ${f.annoPeriodo} – ${meseEnd} ${annoEnd}`;
}

function filtroRange(f: FiltroGestionale): { start: string; end: string } {
  if (f.modalita === 'sempre') return { start: '2000-01-01', end: '2099-12-31' };
  if (f.modalita === 'anno') {
    return { start: `${f.annoAnno}-01-01`, end: `${f.annoAnno}-12-31` };
  }
  // periodo: f.mesePeriodo + f.durata mesi
  const startDate = new Date(f.annoPeriodo, f.mesePeriodo - 1, 1);
  const endDate = new Date(f.annoPeriodo, f.mesePeriodo - 1 + f.durata, 0); // last day of last month
  const pad = (n: number) => String(n).padStart(2, '0');
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return { start: fmt(startDate), end: fmt(endDate) };
}

function filtroMesi(f: FiltroGestionale): number {
  if (f.modalita === 'sempre') return 0;
  if (f.modalita === 'anno') return 12;
  return f.durata;
}

const CATEGORIE_USCITE = [
  'Affitto', 'Bollette (luce/gas/acqua)', 'Internet / Telefono',
  'Commercialista', 'INPS artigiani', 'IVA trimestrale',
  'IRPEF / Acconto', 'Imposta sostitutiva', 'TARI / IMU',
  'Condominio', 'Assicurazione', 'Manutenzione attrezzature',
  'Acquisto prodotti (rivendita)', 'Acquisto materiali salon',
  'Stipendi / Collaboratori', 'Formazione / Corsi',
  'Marketing / Pubblicità', 'Software / Abbonamenti', 'Altro',
];

const CATEGORIE_ENTRATE = [
  'Entrata extra', 'Rimborso', 'Vendita attrezzatura', 'Contributo statale', 'Altro',
];

// ─── SpesaModal ──────────────────────────────────────────────────────────────

const ALIQUOTE_IVA = [0, 4, 5, 10, 22];

function SpesaModal({ spesa, onSave, onClose, defaultIva = 0 }: {
  spesa: Partial<Spesa> | null;
  onSave: (s: Omit<Spesa, 'id' | 'created_at'>) => Promise<void>;
  onClose: () => void;
  defaultIva?: number;
}) {
  const today = localDateStr(new Date());
  const [data, setData] = useState(spesa?.data ?? today);
  const [tipo, setTipo] = useState<'uscita' | 'entrata_extra'>(spesa?.tipo ?? 'uscita');
  const cats0 = (spesa?.tipo ?? 'uscita') === 'uscita' ? CATEGORIE_USCITE : CATEGORIE_ENTRATE;
  const isCustomInit = !!spesa?.categoria && !cats0.includes(spesa.categoria);
  const [categoria, setCategoria] = useState(isCustomInit ? 'Altro' : (spesa?.categoria ?? ''));
  const [categoriaCustom, setCategoriaCustom] = useState(isCustomInit ? (spesa?.categoria ?? '') : '');
  const [descrizione, setDescrizione] = useState(spesa?.descrizione ?? '');
  const [modalitaImporto, setModalitaImporto] = useState<'netto' | 'lordo'>(
    spesa?.importo_netto && spesa.importo_netto > 0 ? 'netto' : 'lordo'
  );
  const [importoNetto, setImportoNetto] = useState(
    spesa?.importo_netto ? spesa.importo_netto.toString() : ''
  );
  const [importoLordo, setImportoLordo] = useState(
    spesa?.importo ? spesa.importo.toString() : ''
  );
  // Se è una nuova voce usa defaultIva (dall'aliquota configurata), altrimenti mantieni quella salvata
  const [aliquotaIva, setAliquotaIva] = useState<number>(spesa?.aliquota_iva ?? defaultIva);
  const [ricorrenza, setRicorrenza] = useState<Ricorrenza>(spesa?.ricorrenza ?? 'una_tantum');
  const [periodoDa, setPeriodoDa] = useState(spesa?.periodo_da ?? '');
  const [periodoA, setPeriodoA] = useState(spesa?.periodo_a ?? '');
  const [dataInizio, setDataInizio] = useState(spesa?.data_inizio ?? '');
  const [dataFine, setDataFine] = useState(spesa?.data_fine ?? '');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const cats = tipo === 'uscita' ? CATEGORIE_USCITE : CATEGORIE_ENTRATE;
  const categoriaFinale = categoria === 'Altro' ? categoriaCustom.trim() : categoria;

  // Derived values
  const nettoNum = parseFloat(importoNetto.replace(',', '.'));
  const lordoNum = parseFloat(importoLordo.replace(',', '.'));

  const ivaCalcolata = modalitaImporto === 'netto' && !isNaN(nettoNum)
    ? nettoNum * (aliquotaIva / 100)
    : aliquotaIva > 0 && !isNaN(lordoNum)
      ? lordoNum - lordoNum / (1 + aliquotaIva / 100)
      : 0;

  const nettoFinale = modalitaImporto === 'netto'
    ? (isNaN(nettoNum) ? 0 : nettoNum)
    : aliquotaIva > 0 && !isNaN(lordoNum)
      ? lordoNum / (1 + aliquotaIva / 100)
      : (isNaN(lordoNum) ? 0 : lordoNum);

  const lordoFinale = modalitaImporto === 'netto'
    ? nettoFinale + ivaCalcolata
    : (isNaN(lordoNum) ? 0 : lordoNum);

  async function handleSave() {
    if (!categoriaFinale) { setErr(categoria === 'Altro' ? 'Inserisci il nome della categoria' : 'Seleziona una categoria'); return; }
    if (lordoFinale <= 0 || isNaN(lordoFinale)) { setErr('Importo non valido'); return; }
    setSaving(true);
    await onSave({
      data, tipo, categoria: categoriaFinale, descrizione,
      ricorrente: ricorrenza !== 'una_tantum',
      ricorrenza,
      importo: Math.round(lordoFinale * 100) / 100,
      importo_netto: Math.round(nettoFinale * 100) / 100,
      importo_iva: Math.round(ivaCalcolata * 100) / 100,
      aliquota_iva: aliquotaIva,
      periodo_da: periodoDa || null,
      periodo_a: periodoA || null,
      data_inizio: dataInizio || null,
      data_fine: dataFine || null,
    });
    setSaving(false);
  }

  const inputCls = 'w-full border border-stone-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.45)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-200 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 flex-shrink-0">
          <h2 className="font-semibold text-stone-800">{spesa?.id ? 'Modifica voce' : 'Nuova voce'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-stone-100 transition-colors text-stone-400"><X size={16} /></button>
        </div>
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* tipo */}
          <div className="grid grid-cols-2 gap-2">
            {(['uscita', 'entrata_extra'] as const).map(t => (
              <button key={t} onClick={() => { setTipo(t); setCategoria(''); setCategoriaCustom(''); }}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-medium transition-all ${tipo === t ? (t === 'uscita' ? 'bg-red-500 border-red-500 text-white' : 'bg-emerald-500 border-emerald-500 text-white') : 'border-stone-200 text-stone-600 hover:bg-stone-50'}`}>
                {t === 'uscita' ? <ArrowUpCircle size={15} /> : <ArrowDownCircle size={15} />}
                {t === 'uscita' ? 'Uscita' : 'Entrata extra'}
              </button>
            ))}
          </div>
          {/* data */}
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1">Data</label>
            <input type="date" value={data} onChange={e => setData(e.target.value)} className={inputCls} />
          </div>
          {/* categoria */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-stone-500">Categoria</label>
            <select
              value={categoria}
              onChange={e => { setCategoria(e.target.value); if (e.target.value !== 'Altro') setCategoriaCustom(''); }}
              className={`${inputCls} bg-white`}
            >
              <option value="">— seleziona —</option>
              {cats.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            {categoria === 'Altro' && (
              <input
                type="text"
                autoFocus
                value={categoriaCustom}
                onChange={e => setCategoriaCustom(e.target.value)}
                placeholder="Nome categoria personalizzata"
                className={`${inputCls} mt-1`}
              />
            )}
          </div>

          {/* IVA */}
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-2">IVA</label>
            <div className="flex gap-1.5 flex-wrap">
              {ALIQUOTE_IVA.map(a => (
                <button key={a} onClick={() => setAliquotaIva(a)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${aliquotaIva === a ? 'bg-teal-600 border-teal-600 text-white' : 'border-stone-200 text-stone-500 hover:border-teal-400 hover:text-teal-600'}`}>
                  {a === 0 ? 'Esente' : `${a}%`}
                </button>
              ))}
              <button
                onClick={() => {
                  const v = prompt('Inserisci aliquota IVA personalizzata (%)');
                  const n = parseFloat(v ?? '');
                  if (!isNaN(n) && n >= 0) setAliquotaIva(n);
                }}
                className="px-3 py-1.5 rounded-lg border border-dashed border-stone-300 text-xs font-medium text-stone-400 hover:border-teal-400 hover:text-teal-600 transition-all">
                Altra %
              </button>
            </div>
          </div>

          {/* Importo */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-medium text-stone-500">Importo</label>
              {aliquotaIva > 0 && (
                <div className="flex bg-stone-100 rounded-lg p-0.5 gap-0.5 text-xs font-medium">
                  {(['netto', 'lordo'] as const).map(m => (
                    <button key={m} onClick={() => setModalitaImporto(m)}
                      className={`px-2.5 py-1 rounded-md transition-all ${modalitaImporto === m ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-400 hover:text-stone-600'}`}>
                      {m === 'netto' ? 'Inserisci netto' : 'Inserisci lordo'}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {aliquotaIva > 0 ? (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-[11px] text-stone-400 mb-1">{modalitaImporto === 'netto' ? 'Netto (digita)' : 'Lordo (digita)'}</p>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-sm">€</span>
                      <input
                        type="number" onInput={e => { const t = e.currentTarget; if (t.value.length > 1 && t.value.startsWith('0') && !t.value.startsWith('0.')) t.value = String(Number(t.value)); }} min="0" step="0.01"
                        value={modalitaImporto === 'netto' ? importoNetto : importoLordo}
                        onChange={e => modalitaImporto === 'netto' ? setImportoNetto(e.target.value) : setImportoLordo(e.target.value)}
                        placeholder="0.00"
                        className={`${inputCls} pl-7`} />
                    </div>
                  </div>
                  <div>
                    <p className="text-[11px] text-stone-400 mb-1">{modalitaImporto === 'netto' ? `IVA ${aliquotaIva}% (calcolata)` : 'Netto (calcolato)'}</p>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-sm">€</span>
                      <input type="text" readOnly
                        value={modalitaImporto === 'netto'
                          ? (isNaN(ivaCalcolata) || ivaCalcolata === 0 ? '' : ivaCalcolata.toFixed(2))
                          : (nettoFinale > 0 ? nettoFinale.toFixed(2) : '')}
                        className={`${inputCls} pl-7 bg-stone-50 text-stone-400 cursor-default`} />
                    </div>
                  </div>
                </div>
                {lordoFinale > 0 && (
                  <div className="mt-2 px-3 py-2 bg-teal-50 rounded-xl border border-teal-100 flex items-center justify-between">
                    <span className="text-xs text-teal-700 font-medium">Totale lordo da pagare</span>
                    <span className="text-sm font-bold text-teal-700">€{lordoFinale.toFixed(2)}</span>
                  </div>
                )}
              </>
            ) : (
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-sm">€</span>
                <input type="number" onInput={e => { const t = e.currentTarget; if (t.value.length > 1 && t.value.startsWith('0') && !t.value.startsWith('0.')) t.value = String(Number(t.value)); }} min="0" step="0.01" value={importoLordo} onChange={e => setImportoLordo(e.target.value)}
                  placeholder="0.00" className={`${inputCls} pl-7`} />
              </div>
            )}
          </div>

          {/* note */}
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1">Note (opzionale)</label>
            <input type="text" value={descrizione} onChange={e => setDescrizione(e.target.value)}
              placeholder="es. Affitto luglio 2026" className={inputCls} />
          </div>
          {/* periodo di riferimento (solo uscite) */}
          {tipo === 'uscita' && (
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1">Periodo di riferimento (opzionale)</label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-[11px] text-stone-400 mb-1">Dal</p>
                  <input type="date" value={periodoDa} onChange={e => setPeriodoDa(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <p className="text-[11px] text-stone-400 mb-1">Al</p>
                  <input type="date" value={periodoA} onChange={e => setPeriodoA(e.target.value)} className={inputCls} />
                </div>
              </div>
            </div>
          )}
          {/* ricorrenza */}
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-2">Frequenza</label>
            <div className="grid grid-cols-2 gap-1.5">
              {RICORRENZE.map(r => (
                <button key={r.value} type="button" onClick={() => setRicorrenza(r.value)}
                  className={`py-2 px-3 rounded-xl border text-xs font-medium text-left transition-all ${ricorrenza === r.value ? 'bg-teal-600 border-teal-600 text-white' : 'border-stone-200 text-stone-600 hover:border-teal-300 hover:text-teal-700'}`}>
                  {r.label}
                </button>
              ))}
            </div>
          </div>
          {/* data inizio / data fine — sempre visibili */}
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1">Decorrenza</label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-[11px] text-stone-400 mb-1">Inizio validità</p>
                <input type="date" value={dataInizio} onChange={e => setDataInizio(e.target.value)} className={inputCls} />
              </div>
              <div>
                <p className="text-[11px] text-stone-400 mb-1">Scadenza {ricorrenza === 'una_tantum' ? '(opzionale)' : '(opzionale)'}</p>
                <input type="date" value={dataFine} onChange={e => setDataFine(e.target.value)} className={inputCls} />
              </div>
            </div>
            <p className="text-[11px] text-stone-400 mt-1.5">
              {ricorrenza !== 'una_tantum'
                ? 'La voce compare solo nei periodi compresi tra inizio e scadenza.'
                : 'La voce compare solo nei periodi a partire dalla data di inizio.'}
            </p>
          </div>
          {err && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle size={13} />{err}</p>}
        </div>
        <div className="px-6 pb-6 flex gap-2 flex-shrink-0">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-stone-200 text-sm font-medium text-stone-600 hover:bg-stone-50 transition-colors">Annulla</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 transition-colors disabled:opacity-50">
            {saving ? 'Salvataggio…' : 'Salva'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── TasseModal ───────────────────────────────────────────────────────────────

function TasseModal({ cfg, onSave, onClose }: {
  cfg: ImpostazioneTasse;
  onSave: (c: Omit<ImpostazioneTasse, 'id'>) => Promise<void>;
  onClose: () => void;
}) {
  const [forma, setForma] = useState<FormaGiuridica>(cfg.forma_giuridica ?? 'partita_iva');
  const [regime, setRegime] = useState<'ordinario' | 'forfettario'>(cfg.regime_fiscale);
  const [iva, setIva] = useState(cfg.aliquota_iva.toString());
  const [irpef, setIrpef] = useState(cfg.aliquota_irpef.toString());
  const [percForf, setPercForf] = useState(cfg.percentuale_forfettario.toString());
  const [impSost, setImpSost] = useState(cfg.imposta_sostitutiva.toString());
  const [saving, setSaving] = useState(false);

  const isSocietà = forma === 'srl' || forma === 'srls';

  function handleFormaChange(f: FormaGiuridica) {
    setForma(f);
    const d = defaultsForForma(f);
    if (d.regime_fiscale) setRegime(d.regime_fiscale);
    if (d.aliquota_iva != null) setIva(d.aliquota_iva.toString());
    if (d.aliquota_irpef != null) setIrpef(d.aliquota_irpef.toString());
    if (d.percentuale_forfettario != null) setPercForf(d.percentuale_forfettario.toString());
    if (d.imposta_sostitutiva != null) setImpSost(d.imposta_sostitutiva.toString());
  }

  async function save() {
    setSaving(true);
    await onSave({
      forma_giuridica: forma,
      regime_fiscale: regime,
      aliquota_iva: parseFloat(iva) || 22,
      aliquota_irpef: parseFloat(irpef) || 23,
      percentuale_forfettario: parseFloat(percForf) || 0,
      imposta_sostitutiva: parseFloat(impSost) || 0,
    });
    setSaving(false);
  }

  const inputCls = 'w-full border border-stone-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.45)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 flex-shrink-0">
          <h2 className="font-semibold text-stone-800">Impostazioni fiscali</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-stone-100 transition-colors text-stone-400"><X size={16} /></button>
        </div>
        <div className="p-6 space-y-5 overflow-y-auto flex-1">

          {/* Forma giuridica */}
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-2">Forma giuridica</label>
            <div className="grid grid-cols-2 gap-2">
              {FORME_GIURIDICHE.map(f => (
                <button key={f.value} onClick={() => handleFormaChange(f.value)}
                  className={`py-2.5 px-3 rounded-xl border text-left transition-all ${forma === f.value ? 'bg-stone-800 border-stone-800 text-white' : 'border-stone-200 text-stone-600 hover:bg-stone-50'}`}>
                  <p className={`text-sm font-semibold ${forma === f.value ? 'text-white' : 'text-stone-800'}`}>{f.label}</p>
                  <p className={`text-[11px] mt-0.5 leading-tight ${forma === f.value ? 'text-stone-300' : 'text-stone-400'}`}>{f.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Regime fiscale — solo per P.IVA e SNC */}
          {!isSocietà && (
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-2">Regime fiscale</label>
              <div className="grid grid-cols-2 gap-2">
                {(['forfettario', 'ordinario'] as const).map(r => (
                  <button key={r} onClick={() => setRegime(r)}
                    className={`py-2.5 rounded-xl border text-sm font-medium transition-all ${regime === r ? 'bg-teal-600 border-teal-600 text-white' : 'border-stone-200 text-stone-600 hover:bg-stone-50'}`}>
                    {r === 'forfettario' ? 'Forfettario' : 'Ordinario'}
                  </button>
                ))}
              </div>
              <p className="text-xs text-stone-400 mt-2">
                {regime === 'forfettario'
                  ? 'Parrucchieri: coeff. 67% — imposta sostitutiva 15% (5% start-up)'
                  : 'Regime ordinario: IVA + IRPEF scaglioni progressivi'}
              </p>
            </div>
          )}

          {/* SRL / SRLS info */}
          {isSocietà && (
            <div className="p-3 bg-sky-50 rounded-xl border border-sky-100">
              <p className="text-xs text-sky-700 font-semibold">Regime societario</p>
              <p className="text-xs text-sky-600 mt-1">
                IRES 24% sul reddito d'impresa + IRAP 3,9% sul valore della produzione.<br />
                IVA ordinaria 22%. Nessun forfettario disponibile.
              </p>
            </div>
          )}

          {/* SNC info */}
          {forma === 'snc' && (
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-100">
              <p className="text-xs text-amber-700 font-semibold">S.n.c. — trasparenza fiscale</p>
              <p className="text-xs text-amber-600 mt-1">
                Il reddito è attribuito direttamente ai soci e tassato con IRPEF progressiva.<br />
                Aliquota applicata = scaglione IRPEF del socio (default 23%).
              </p>
            </div>
          )}

          {/* Parametri forfettario */}
          {!isSocietà && regime === 'forfettario' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-stone-500 mb-1">Coeff. redditività (%)</label>
                  <input type="number" onInput={e => { const t = e.currentTarget; if (t.value.length > 1 && t.value.startsWith('0') && !t.value.startsWith('0.')) t.value = String(Number(t.value)); }} value={percForf} onChange={e => setPercForf(e.target.value)} className={inputCls} />
                  <p className="text-[11px] text-stone-400 mt-1">67% parrucchieri</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-500 mb-1">Imposta sostitutiva (%)</label>
                  <input type="number" onInput={e => { const t = e.currentTarget; if (t.value.length > 1 && t.value.startsWith('0') && !t.value.startsWith('0.')) t.value = String(Number(t.value)); }} value={impSost} onChange={e => setImpSost(e.target.value)} className={inputCls} />
                  <p className="text-[11px] text-stone-400 mt-1">15% std · 5% start-up</p>
                </div>
              </div>
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-100">
                <p className="text-xs text-amber-700 font-medium">Formula</p>
                <p className="text-xs text-amber-600 mt-1">Imponibile = Fatturato × {percForf}% → Imposta = Imponibile × {impSost}%<br />Nessuna IVA. INPS ~26% calcolata separatamente.</p>
              </div>
            </>
          )}

          {/* Parametri ordinario / società */}
          {(isSocietà || regime === 'ordinario') && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-stone-500 mb-1">Aliquota IVA (%)</label>
                  <input type="number" onInput={e => { const t = e.currentTarget; if (t.value.length > 1 && t.value.startsWith('0') && !t.value.startsWith('0.')) t.value = String(Number(t.value)); }} value={iva} onChange={e => setIva(e.target.value)} className={inputCls} />
                  <p className="text-[11px] text-stone-400 mt-1">22% ordinaria · 10% ridotta · 4% superridotta</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-500 mb-1">{isSocietà ? 'Aliquota IRES (%)' : 'Aliquota IRPEF (%)'}</label>
                  <input type="number" onInput={e => { const t = e.currentTarget; if (t.value.length > 1 && t.value.startsWith('0') && !t.value.startsWith('0.')) t.value = String(Number(t.value)); }} value={irpef} onChange={e => setIrpef(e.target.value)} className={inputCls} />
                  <p className="text-[11px] text-stone-400 mt-1">{isSocietà ? '24% standard' : '1° sc. 23% fino €28k'}</p>
                </div>
              </div>
              {!isSocietà && (
                <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
                  <p className="text-xs text-blue-700 font-medium">Scaglioni IRPEF 2024</p>
                  <p className="text-xs text-blue-600 mt-1">23% fino €28.000 · 35% €28k–€50k · 43% oltre €50k</p>
                </div>
              )}
              {isSocietà && (
                <div className="p-3 bg-sky-50 rounded-xl border border-sky-100">
                  <p className="text-xs text-sky-700 font-medium">IRAP</p>
                  <p className="text-xs text-sky-600 mt-1">Aliquota ordinaria 3,9% sul valore della produzione netta.<br />Calcolata separatamente dalla stima.</p>
                </div>
              )}
              {/* Nota IVA specifica per forma giuridica */}
              <div className="p-3 bg-teal-50 rounded-xl border border-teal-100">
                <p className="text-xs text-teal-700 font-medium">IVA — {FORME_GIURIDICHE.find(f2 => f2.value === forma)?.label}</p>
                <p className="text-xs text-teal-600 mt-1">{IVA_INFO[forma]?.nota}</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {[4, 5, 10, 22].map(a => (
                    <button key={a} onClick={() => setIva(a.toString())}
                      className={`text-[11px] px-2 py-0.5 rounded-full border font-medium transition-all ${parseFloat(iva) === a ? 'bg-teal-600 border-teal-600 text-white' : 'border-teal-200 text-teal-600 hover:bg-teal-100'}`}>
                      {a}%{a === 22 ? ' ordinaria' : a === 10 ? ' ridotta' : a === 4 ? ' superridotta' : ''}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

        </div>
        <div className="px-6 pb-6 flex gap-2 flex-shrink-0">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-stone-200 text-sm font-medium text-stone-600 hover:bg-stone-50 transition-colors">Annulla</button>
          <button onClick={save} disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-stone-800 text-white text-sm font-semibold hover:bg-stone-900 transition-colors disabled:opacity-50">
            {saving ? 'Salvataggio…' : 'Salva'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function GestioneFinanziaria() {
  const { user } = useAuth();
  const [spese, setSpese] = useState<Spesa[]>([]);
  const [tasse, setTasse] = useState<ImpostazioneTasse | null>(null);
  const [showSpesaModal, setShowSpesaModal] = useState(false);
  const [editSpesa, setEditSpesa] = useState<Partial<Spesa> | null>(null);
  const [showTasseModal, setShowTasseModal] = useState(false);
  const [filtroGest, setFiltroGest] = useState<FiltroGestionale>(filtroDefault);
  const [showFiltroDropdown, setShowFiltroDropdown] = useState<ModalitaFiltro | null>(null);
  const [mostraNettoLordo, setMostraNettoLordo] = useState<'lordo' | 'netto'>('lordo');
  const [loading, setLoading] = useState(true);
  const [openCat, setOpenCat] = useState<string | null>(null);
  const [tutteVoci, setTutteVoci] = useState<{ data: string; importo: number }[]>([]);
  const [oreSettimana, setOreSettimana] = useState(40);
  const [settimaneAnno, setSettimaneAnno] = useState(48);
  const [mostraOrarioNetto, setMostraOrarioNetto] = useState<'lordo' | 'netto'>('lordo');

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: sp }, { data: tx }, { data: fiches }, { data: riv }] = await Promise.all([
      supabase.from('spese').select('*').is('deleted_at', null).order('data', { ascending: false }),
      supabase.from('impostazioni_tasse').select('*').limit(1),
      supabase.from('fiches').select('data_riferimento, importo_convalidato').eq('convalidata', true),
      supabase.from('rivendita_prodotti').select('data_vendita, totale'),
    ]);
    setSpese((sp || []) as Spesa[]);
    if (tx && tx.length > 0) setTasse(tx[0] as ImpostazioneTasse);

    const vociFinali: { data: string; importo: number }[] = [
      ...((fiches || []).map(f => ({ data: f.data_riferimento as string, importo: f.importo_convalidato as number }))),
      ...((riv || []).map(r => ({ data: r.data_vendita as string, importo: r.totale as number }))),
    ].filter(v => v.data && v.importo > 0);

    setTutteVoci(vociFinali);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function salvaSpesa(s: Omit<Spesa, 'id' | 'created_at'>) {
    if (editSpesa?.id) {
      await supabase.from('spese').update(s).eq('id', editSpesa.id);
    } else {
      await supabase.from('spese').insert({ ...s, user_id: user?.id });
    }
    await load();
    setShowSpesaModal(false);
    setEditSpesa(null);
  }

  async function eliminaSpesa(id: string) {
    if (!confirm('Eliminare questa voce?')) return;
    await supabase.from('spese').update({ deleted_at: new Date().toISOString() }).eq('id', id);
    await load();
  }

  async function salvaTasse(c: Omit<ImpostazioneTasse, 'id'>) {
    if (tasse?.id) {
      await supabase.from('impostazioni_tasse').update({ ...c, updated_at: new Date().toISOString() }).eq('id', tasse.id);
    } else {
      await supabase.from('impostazioni_tasse').insert({ ...c, user_id: user?.id });
    }
    await load();
    setShowTasseModal(false);
  }

  const { start: gStart, end: gEnd } = filtroRange(filtroGest);

  function mesiPeriodo(): number {
    return filtroMesi(filtroGest);
  }

  // Returns the prorated importo for a recurring entry over the selected period.
  // If the entry falls inside the range it counts as-is; if it's outside but
  // recurring, we include the fraction of its cycle that falls in the period.
  function importoPeriodo(s: Spesa): number {
    const mesi = mesiPeriodo();
    const r = RICORRENZE.find(r => r.value === s.ricorrenza);
    const cicloMesi = r?.mesi ?? 0;

    const inRange = s.data >= gStart && s.data <= gEnd;

    if (cicloMesi === 0) {
      // Una tantum: count only if the entry date is in range
      return inRange ? s.importo : 0;
    }

    if (filtroGest.modalita === 'sempre') {
      return inRange ? s.importo : 0;
    }

    // Recurring: how many times does this cycle fire in the period?
    // occorrenze = periodoMesi / cicloMesi (can be fractional for partial cycles)
    const occorrenze = mesi / cicloMesi;
    return s.importo * occorrenze;
  }

  // Returns true if the entry is active in the selected period, considering data_inizio and data_fine.
  function isActiveInPeriod(s: Spesa): boolean {
    // data_inizio: the entry doesn't exist before this date
    const inizio = s.data_inizio ?? s.data;
    // data_fine: the entry expires after this date
    const fine = s.data_fine ?? null;
    // Active if: inizio <= gEnd  AND  (no fine OR fine >= gStart)
    return inizio <= gEnd && (fine === null || fine >= gStart);
  }

  // Build virtual entries for display: recurring items outside range get a
  // synthetic prorated version; in-range items are shown as-is.
  const speseConProroga: (Spesa & { importoEffettivo: number })[] = spese
    .filter(s => {
      const r = RICORRENZE.find(r => r.value === s.ricorrenza);
      const cicloMesi = r?.mesi ?? 0;
      // Always check data_inizio / data_fine first
      if (!isActiveInPeriod(s)) return false;
      if (filtroGest.modalita === 'sempre') return s.data >= gStart && s.data <= gEnd;
      // Una tantum: only if date falls within range
      if (cicloMesi === 0) return s.data >= gStart && s.data <= gEnd;
      // Recurring: include if active in the period (handled above)
      return true;
    })
    // Deduplicate: for recurring items outside range, keep only one instance
    .reduce<(Spesa & { importoEffettivo: number })[]>((acc, s) => {
      const r = RICORRENZE.find(r => r.value === s.ricorrenza);
      const cicloMesi = r?.mesi ?? 0;
      const inRange = s.data >= gStart && s.data <= gEnd;

      if (cicloMesi === 0 || filtroGest.modalita === 'sempre') {
        if (inRange) acc.push({ ...s, importoEffettivo: s.importo });
        return acc;
      }

      // For recurring, only add if not already represented (use latest entry per categoria+tipo+ricorrenza)
      const key = `${s.categoria}||${s.tipo}||${s.ricorrenza}`;
      const existing = acc.find(a => `${a.categoria}||${a.tipo}||${a.ricorrenza}` === key);
      const imp = importoPeriodo(s);
      if (!existing) {
        acc.push({ ...s, importoEffettivo: imp });
      } else if (s.data > existing.data) {
        // Replace with the more recent entry
        const idx = acc.indexOf(existing);
        acc[idx] = { ...s, importoEffettivo: imp };
      }
      return acc;
    }, []);

  const speseFiltrate = speseConProroga;
  const uscite = speseFiltrate.filter(s => s.tipo === 'uscita');
  const entrateExtra = speseFiltrate.filter(s => s.tipo === 'entrata_extra');
  const totUscite = uscite.reduce((acc, s) => acc + s.importoEffettivo, 0);
  const totEntrateExtra = entrateExtra.reduce((acc, s) => acc + s.importoEffettivo, 0);

  const fatturatoLordo = tutteVoci
    .filter(v => v.data >= gStart && v.data <= gEnd)
    .reduce((s, v) => s + v.importo, 0) + totEntrateExtra;

  function calcolaStimaTasse(lordo: number): { iva: number; irpef: number; inps: number; totale: number; netto: number; label: string } {
    if (!tasse) return { iva: 0, irpef: 0, inps: 0, totale: 0, netto: lordo, label: 'IRPEF' };

    const forma = tasse.forma_giuridica ?? 'partita_iva';

    // SRL / SRLS — IRES 24% + IRAP 3.9% (approssimata su lordo)
    if (forma === 'srl' || forma === 'srls') {
      const iva = lordo * (tasse.aliquota_iva / 100);
      const reddito = Math.max(lordo - totUscite, 0);
      const ires = reddito * (tasse.aliquota_irpef / 100); // aliquota_irpef = IRES
      const irap = reddito * 0.039;
      const totale = iva + ires + irap;
      const netto = Math.max(lordo - totale, 0);
      return { iva, irpef: ires + irap, inps: 0, totale, netto, label: 'IRES+IRAP' };
    }

    if (tasse.regime_fiscale === 'forfettario') {
      const imponibile = lordo * (tasse.percentuale_forfettario / 100);
      const imposta = imponibile * (tasse.imposta_sostitutiva / 100);
      const inps = imponibile * 0.2607;
      return { iva: 0, irpef: 0, inps, totale: imposta + inps, netto: lordo - imposta - inps, label: 'Imp. sost.' };
    }

    // Ordinario — P.IVA o SNC
    const iva = lordo * (tasse.aliquota_iva / 100);
    const reddito = Math.max(lordo - totUscite, 0);
    let irpef = 0;
    if (reddito <= 28000) irpef = reddito * (tasse.aliquota_irpef / 100);
    else if (reddito <= 50000) irpef = 28000 * 0.23 + (reddito - 28000) * 0.35;
    else irpef = 28000 * 0.23 + 22000 * 0.35 + (reddito - 50000) * 0.43;
    const inps = reddito * 0.2607;
    const netto = Math.max(Math.min(lordo - iva - irpef - inps, lordo), 0);
    return { iva, irpef, inps, totale: iva + irpef + inps, netto, label: 'IRPEF' };
  }

  const stimaTasse = calcolaStimaTasse(fatturatoLordo);
  const fatturatoMostrato = mostraNettoLordo === 'lordo' ? fatturatoLordo : stimaTasse.netto;
  const saldoFinale = fatturatoMostrato - totUscite;

  // IVA liquidazione: IVA a debito (su entrate extra con IVA) - IVA a credito (su uscite con IVA)
  // La detraibilità IVA sulle uscite varia per categoria (pro-rata art. 19-bis DPR 633/72)
  const ivaDebito = entrateExtra.reduce((acc, s) => acc + (s.importo_iva ?? 0), 0);
  const ivaCreditoLordo = uscite.reduce((acc, s) => acc + (s.importo_iva ?? 0), 0);
  const ivaCredito = uscite.reduce((acc, s) => {
    const proRata = IVA_DETRAIBILITA[s.categoria] ?? 1.0;
    return acc + (s.importo_iva ?? 0) * proRata;
  }, 0);
  const ivaCreditoNonDetraibile = ivaCreditoLordo - ivaCredito;
  const ivaNettaDovuta = Math.max(ivaDebito - ivaCredito, 0);
  const ivaRimborso = ivaCredito > ivaDebito ? ivaCredito - ivaDebito : 0;
  const hasIvaVoci = ivaDebito > 0 || ivaCreditoLordo > 0;

  const filtroLabelAttuale = filtroLabel(filtroGest);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-7 h-7 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-stone-800">Entrate &amp; Uscite</h1>
          <p className="text-sm text-stone-400 mt-0.5">Gestione costi, ricavi e situazione fiscale — {filtroLabelAttuale}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Filtro periodo */}
          <div className="relative flex bg-white border border-stone-200 rounded-xl p-1 gap-1 shadow-sm text-xs font-medium">
            {/* Bottone periodo (mese/bimestre/ecc.) */}
            <div className="relative">
              <button
                onClick={() => setShowFiltroDropdown(showFiltroDropdown === 'periodo' ? null : 'periodo')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg transition-all ${filtroGest.modalita === 'periodo' ? 'bg-stone-800 text-white shadow-sm' : 'text-stone-500 hover:text-stone-800'}`}>
                {filtroGest.modalita === 'periodo' ? filtroLabelAttuale : 'Periodo'}
                <ChevronDown size={11} className={`transition-transform ${showFiltroDropdown === 'periodo' ? 'rotate-180' : ''}`} />
              </button>
              {showFiltroDropdown === 'periodo' && (
                <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-stone-200 rounded-xl shadow-xl p-3 w-64">
                  {/* Selezione durata */}
                  <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide mb-2">Periodo</p>
                  <div className="grid grid-cols-3 gap-1 mb-3">
                    {DURATE.map(d => (
                      <button key={d.value} onClick={() => setFiltroGest(f => ({ ...f, modalita: 'periodo', durata: d.value }))}
                        className={`py-1 rounded-lg text-[11px] font-medium transition-all ${filtroGest.durata === d.value && filtroGest.modalita === 'periodo' ? 'bg-stone-800 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}>
                        {d.label}
                      </button>
                    ))}
                  </div>
                  {/* Selezione anno */}
                  <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide mb-2">Anno</p>
                  <div className="flex items-center gap-2 mb-3">
                    <button onClick={() => setFiltroGest(f => ({ ...f, annoPeriodo: f.annoPeriodo - 1 }))}
                      className="p-1 rounded-lg hover:bg-stone-100 text-stone-500"><ChevronLeft size={13} /></button>
                    <span className="flex-1 text-center text-sm font-semibold text-stone-700">{filtroGest.annoPeriodo}</span>
                    <button onClick={() => setFiltroGest(f => ({ ...f, annoPeriodo: f.annoPeriodo + 1 }))}
                      className="p-1 rounded-lg hover:bg-stone-100 text-stone-500"><ChevronRight size={13} /></button>
                  </div>
                  {/* Selezione mese di inizio */}
                  <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide mb-2">Mese di inizio</p>
                  <div className="grid grid-cols-4 gap-1">
                    {MESI_LABELS.map((m, i) => (
                      <button key={i} onClick={() => { setFiltroGest(f => ({ ...f, modalita: 'periodo', mesePeriodo: i + 1 })); setShowFiltroDropdown(null); }}
                        className={`py-1 rounded-lg text-[11px] font-medium transition-all ${filtroGest.mesePeriodo === i + 1 && filtroGest.modalita === 'periodo' ? 'bg-stone-800 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}>
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {/* Bottone anno */}
            <div className="relative">
              <button
                onClick={() => setShowFiltroDropdown(showFiltroDropdown === 'anno' ? null : 'anno')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg transition-all ${filtroGest.modalita === 'anno' ? 'bg-stone-800 text-white shadow-sm' : 'text-stone-500 hover:text-stone-800'}`}>
                {filtroGest.modalita === 'anno' ? `${filtroGest.annoAnno}` : 'Quest\'anno'}
                <ChevronDown size={11} className={`transition-transform ${showFiltroDropdown === 'anno' ? 'rotate-180' : ''}`} />
              </button>
              {showFiltroDropdown === 'anno' && (
                <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-stone-200 rounded-xl shadow-xl p-3 w-48">
                  <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide mb-2">Anno</p>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setFiltroGest(f => ({ ...f, annoAnno: f.annoAnno - 1 }))}
                      className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-500"><ChevronLeft size={14} /></button>
                    <span className="flex-1 text-center text-base font-bold text-stone-800">{filtroGest.annoAnno}</span>
                    <button onClick={() => setFiltroGest(f => ({ ...f, annoAnno: f.annoAnno + 1 }))}
                      className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-500"><ChevronRight size={14} /></button>
                  </div>
                  <button onClick={() => { setFiltroGest(f => ({ ...f, modalita: 'anno' })); setShowFiltroDropdown(null); }}
                    className="mt-3 w-full py-1.5 rounded-lg bg-stone-800 text-white text-xs font-semibold hover:bg-stone-900 transition-colors">
                    Applica
                  </button>
                </div>
              )}
            </div>
            {/* Bottone sempre */}
            <button onClick={() => { setFiltroGest(f => ({ ...f, modalita: 'sempre' })); setShowFiltroDropdown(null); }}
              className={`px-3 py-1.5 rounded-lg transition-all ${filtroGest.modalita === 'sempre' ? 'bg-stone-800 text-white shadow-sm' : 'text-stone-500 hover:text-stone-800'}`}>
              Sempre
            </button>
          </div>
          {/* Overlay per chiudere i dropdown */}
          {showFiltroDropdown && (
            <div className="fixed inset-0 z-40" onClick={() => setShowFiltroDropdown(null)} />
          )}
          {/* Netto / Lordo */}
          <div className="flex bg-white border border-stone-200 rounded-xl p-1 gap-1 shadow-sm text-xs font-medium">
            {(['lordo', 'netto'] as const).map(v => (
              <button key={v} onClick={() => setMostraNettoLordo(v)}
                className={`px-3 py-1.5 rounded-lg transition-all ${mostraNettoLordo === v ? 'bg-teal-500 text-white shadow-sm' : 'text-stone-500 hover:text-stone-800'}`}>
                {v === 'lordo' ? 'Lordo' : 'Netto stimato'}
              </button>
            ))}
          </div>
          <button onClick={() => setShowTasseModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-600 text-sm font-medium shadow-sm transition-colors">
            <Settings size={14} />
            <span className="hidden sm:inline">Impost. fiscali</span>
          </button>
          <button onClick={() => { setEditSpesa(null); setShowSpesaModal(true); }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-teal-600 text-white text-sm font-semibold shadow-sm hover:bg-teal-700 transition-colors">
            <Plus size={14} />
            Aggiungi voce
          </button>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-gradient-to-br from-teal-500 to-teal-600 rounded-2xl p-5 text-white shadow-md">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center">
              <TrendingUp size={16} className="text-white" />
            </div>
            <span className="text-xs font-medium text-teal-100 uppercase tracking-wide">Fatturato</span>
          </div>
          <p className="text-3xl font-bold tracking-tight">€{fatturatoMostrato.toFixed(2)}</p>
          <p className="text-xs text-teal-200 mt-1">{mostraNettoLordo === 'netto' ? 'al netto tasse stimate' : 'lordo tasse'}</p>
        </div>

        <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-red-50 rounded-xl flex items-center justify-center">
              <TrendingDown size={16} className="text-red-400" />
            </div>
            <span className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Uscite</span>
          </div>
          <p className="text-3xl font-bold text-red-500">€{totUscite.toFixed(2)}</p>
          <p className="text-xs text-stone-400 mt-1">{uscite.length} voci registrate</p>
        </div>

        <div className={`rounded-2xl border p-5 shadow-sm ${saldoFinale >= 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
          <div className="flex items-center gap-2 mb-3">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${saldoFinale >= 0 ? 'bg-emerald-100' : 'bg-red-100'}`}>
              <PieChart size={16} className={saldoFinale >= 0 ? 'text-emerald-600' : 'text-red-400'} />
            </div>
            <span className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Saldo</span>
          </div>
          <p className={`text-3xl font-bold ${saldoFinale >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
            {saldoFinale >= 0 ? '+' : ''}€{saldoFinale.toFixed(2)}
          </p>
          <p className="text-xs text-stone-400 mt-1">fatturato – uscite</p>
        </div>

        <div className="bg-amber-50 rounded-2xl border border-amber-100 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-amber-100 rounded-xl flex items-center justify-center">
              <Receipt size={16} className="text-amber-600" />
            </div>
            <span className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Tasse stimate</span>
          </div>
          <p className="text-3xl font-bold text-amber-600">€{stimaTasse.totale.toFixed(2)}</p>
          <p className="text-xs text-stone-400 mt-1">
            {tasse?.regime_fiscale === 'forfettario' ? `sost. ${tasse.imposta_sostitutiva}% + INPS 26%` : 'IVA + IRPEF + INPS'}
          </p>
        </div>
      </div>

      {/* Barra visiva entrate vs uscite */}
      {fatturatoLordo > 0 && (
        <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-stone-700">Ripartizione fatturato</p>
            <p className="text-xs text-stone-400">{filtroLabelAttuale}</p>
          </div>
          <div className="flex h-4 rounded-full overflow-hidden gap-0.5">
            {totUscite > 0 && (
              <div className="bg-red-400 transition-all duration-500"
                style={{ width: `${Math.min((totUscite / fatturatoLordo) * 100, 100)}%` }} />
            )}
            {stimaTasse.totale > 0 && (
              <div className="bg-amber-400 transition-all duration-500"
                style={{ width: `${Math.min((stimaTasse.totale / fatturatoLordo) * 100, 100)}%` }} />
            )}
            <div className="bg-teal-400 flex-1 min-w-0 transition-all duration-500" />
          </div>
          <div className="flex flex-wrap gap-4 mt-3 text-xs text-stone-500">
            <span className="flex items-center gap-1.5"><span className="w-3 h-1.5 rounded-full bg-red-400 inline-block" />Uscite {fatturatoLordo > 0 ? ((totUscite / fatturatoLordo) * 100).toFixed(1) : 0}%</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-1.5 rounded-full bg-amber-400 inline-block" />Tasse {fatturatoLordo > 0 ? ((stimaTasse.totale / fatturatoLordo) * 100).toFixed(1) : 0}%</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-1.5 rounded-full bg-teal-400 inline-block" />Netto disponibile {fatturatoLordo > 0 ? (Math.max(fatturatoLordo - totUscite - stimaTasse.totale, 0) / fatturatoLordo * 100).toFixed(1) : 0}%</span>
          </div>
        </div>
      )}

      {/* Dettaglio fiscale */}
      {tasse && fatturatoLordo > 0 && (
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-stone-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Receipt size={15} className="text-amber-500" />
              <span className="text-sm font-semibold text-stone-700">
                Dettaglio fiscale — {tasse.regime_fiscale === 'forfettario' ? 'Regime forfettario' : 'Regime ordinario'}
              </span>
            </div>
            <button onClick={() => setShowTasseModal(true)}
              className="text-xs text-stone-400 hover:text-stone-600 flex items-center gap-1 transition-colors">
              <Settings size={12} /> modifica
            </button>
          </div>
          <div className="p-5 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-xs text-stone-400 mb-0.5">Fatturato lordo</p>
              <p className="font-semibold text-stone-800">€{fatturatoLordo.toFixed(2)}</p>
            </div>
            {tasse.regime_fiscale === 'forfettario' ? (
              <>
                <div>
                  <p className="text-xs text-stone-400 mb-0.5">Imponibile ({tasse.percentuale_forfettario}%)</p>
                  <p className="font-semibold text-stone-800">€{(fatturatoLordo * tasse.percentuale_forfettario / 100).toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-stone-400 mb-0.5">Imposta sostitutiva ({tasse.imposta_sostitutiva}%)</p>
                  <p className="font-semibold text-amber-600">€{(fatturatoLordo * tasse.percentuale_forfettario / 100 * tasse.imposta_sostitutiva / 100).toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-stone-400 mb-0.5">INPS artigiani (~26%)</p>
                  <p className="font-semibold text-amber-600">€{stimaTasse.inps.toFixed(2)}</p>
                </div>
              </>
            ) : (
              <>
                <div>
                  <p className="text-xs text-stone-400 mb-0.5">IVA ({tasse.aliquota_iva}%)</p>
                  <p className="font-semibold text-amber-600">€{stimaTasse.iva.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-stone-400 mb-0.5">IRPEF stimata</p>
                  <p className="font-semibold text-amber-600">€{stimaTasse.irpef.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-stone-400 mb-0.5">INPS (~26%)</p>
                  <p className="font-semibold text-amber-600">€{stimaTasse.inps.toFixed(2)}</p>
                </div>
              </>
            )}
            <div>
              <p className="text-xs text-stone-400 mb-0.5">Netto stimato</p>
              <p className="font-bold text-teal-600 text-base">€{stimaTasse.netto.toFixed(2)}</p>
            </div>
          </div>
          {/* Liquidazione IVA — solo per regimi con IVA e se ci sono voci con IVA */}
          {tasse.regime_fiscale !== 'forfettario' && hasIvaVoci && (
            <div className="mx-5 mb-5 rounded-xl border border-amber-100 bg-amber-50 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-amber-100 flex items-center justify-between">
                <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Liquidazione IVA periodica</span>
                <span className="text-[11px] text-amber-500">{filtroLabelAttuale}</span>
              </div>
              <div className="px-4 py-3 grid grid-cols-3 gap-3">
                <div>
                  <p className="text-[11px] text-amber-600 mb-0.5">IVA a debito</p>
                  <p className="text-sm font-semibold text-stone-700">€{ivaDebito.toFixed(2)}</p>
                  <p className="text-[10px] text-stone-400 mt-0.5">da entrate extra</p>
                </div>
                <div>
                  <p className="text-[11px] text-amber-600 mb-0.5">IVA a credito</p>
                  <p className="text-sm font-semibold text-stone-700">€{ivaCredito.toFixed(2)}</p>
                  {ivaCreditoNonDetraibile > 0 ? (
                    <p className="text-[10px] text-stone-400 mt-0.5">
                      lordo €{ivaCreditoLordo.toFixed(2)} · indetraibile €{ivaCreditoNonDetraibile.toFixed(2)}
                    </p>
                  ) : (
                    <p className="text-[10px] text-stone-400 mt-0.5">da uscite deducibili</p>
                  )}
                </div>
                <div>
                  <p className={`text-[11px] font-semibold mb-0.5 ${ivaNettaDovuta > 0 ? 'text-red-600' : 'text-teal-600'}`}>
                    {ivaNettaDovuta > 0 ? 'Da versare' : 'A credito'}
                  </p>
                  <p className={`text-base font-bold ${ivaNettaDovuta > 0 ? 'text-red-600' : 'text-teal-600'}`}>
                    €{(ivaNettaDovuta > 0 ? ivaNettaDovuta : ivaRimborso).toFixed(2)}
                  </p>
                  <p className="text-[10px] text-stone-400 mt-0.5">
                    {ivaNettaDovuta > 0 ? 'debito − credito netto' : 'credito − debito'}
                  </p>
                </div>
              </div>
              {ivaCreditoNonDetraibile > 0 && (
                <div className="px-4 pb-3">
                  <div className="flex flex-wrap gap-1.5">
                    {uscite.filter(s => {
                      const pr = IVA_DETRAIBILITA[s.categoria] ?? 1.0;
                      return (s.importo_iva ?? 0) > 0 && pr < 1.0;
                    }).map(s => {
                      const pr = IVA_DETRAIBILITA[s.categoria] ?? 1.0;
                      return (
                        <span key={s.id} className="text-[10px] bg-amber-100 text-amber-700 rounded-full px-2 py-0.5">
                          {s.categoria}: {(pr * 100).toFixed(0)}% detr. · −€{((s.importo_iva ?? 0) * (1 - pr)).toFixed(2)} indetr.
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
              {ivaNettaDovuta > 0 && (
                <div className="px-4 pb-3">
                  <div className="w-full bg-amber-100 rounded-full h-1.5">
                    <div
                      className="bg-red-400 h-1.5 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min((ivaCredito / (ivaDebito || 1)) * 100, 100)}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-stone-400 mt-1">
                    Credito netto copre il {ivaDebito > 0 ? ((ivaCredito / ivaDebito) * 100).toFixed(0) : 0}% del debito
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="px-5 pb-4">
            <p className="text-[11px] text-stone-400 flex items-center gap-1">
              <AlertCircle size={11} /> Stima indicativa. Consulta il tuo commercialista per i dati ufficiali.
            </p>
          </div>
        </div>
      )}

      {/* Calcolatore costo orario */}
      {(() => {
        const mesi = filtroMesi(filtroGest) || 12;
        // Ore lavorate nel periodo selezionato (proporzionale all'anno)
        const oreAnno = oreSettimana * settimaneAnno;
        const orePeriodo = oreAnno * (mesi / 12);
        const orePeriodoMin = Math.max(orePeriodo, 1);

        // Costo orario basato sulle spese del periodo
        const costoOrarioSpese = totUscite / orePeriodoMin;

        // Incasso orario necessario per pareggio (spese incluse, tasse escluse)
        const breakEvenLordo = totUscite / orePeriodoMin;

        // Incasso orario necessario per pareggio con tasse
        // Calcola quante tasse si pagherebbe su ogni euro incassato
        const fatturatoTest = 1000;
        const tasseTest = calcolaStimaTasse(fatturatoTest);
        const aliquotaEffettivaTasse = fatturatoTest > 0 ? tasseTest.totale / fatturatoTest : 0;
        // Per coprire le spese + tasse, devo incassare: spese / (1 - aliquota_effettiva)
        const breakEvenConTasse = totUscite > 0
          ? totUscite / Math.max(1 - aliquotaEffettivaTasse, 0.01) / orePeriodoMin
          : 0;

        // Incasso orario attuale lordo e netto (il netto può essere negativo)
        const incassoOrarioLordo = fatturatoLordo / orePeriodoMin;
        const nettoRaw = fatturatoLordo - totUscite - stimaTasse.totale;
        const nettoDisponibile = nettoRaw; // non clampato: mostriamo anche i negativi
        const incassoOrarioNetto = nettoRaw / orePeriodoMin;
        const incassoOrarioAttuale = mostraOrarioNetto === 'netto' ? incassoOrarioNetto : incassoOrarioLordo;

        // Costo orario e break-even
        const costoOrarioDisplay = mostraOrarioNetto === 'netto'
          ? (totUscite + stimaTasse.totale) / orePeriodoMin
          : costoOrarioSpese;
        const breakEvenDisplay = mostraOrarioNetto === 'netto' ? breakEvenConTasse : breakEvenLordo;

        // Margine % (può essere negativo)
        const margineNetto = fatturatoLordo > 0 ? (nettoRaw / fatturatoLordo) * 100 : (nettoRaw < 0 ? -100 : 0);
        const margineLordo = fatturatoLordo > 0 ? ((fatturatoLordo - totUscite) / fatturatoLordo) * 100 : ((fatturatoLordo - totUscite) < 0 ? -100 : 0);
        const margineDisplay = mostraOrarioNetto === 'netto' ? margineNetto : margineLordo;

        const inPari = fatturatoLordo >= totUscite;
        const superaTasse = fatturatoLordo >= (totUscite + stimaTasse.totale);

        return (
          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-stone-100 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Clock size={15} className="text-blue-500" />
                <span className="text-sm font-semibold text-stone-700">Costo orario &amp; punto di pareggio</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex bg-stone-100 rounded-lg p-0.5 gap-0.5 text-xs font-medium">
                  {(['lordo', 'netto'] as const).map(v => (
                    <button key={v} onClick={() => setMostraOrarioNetto(v)}
                      className={`px-3 py-1 rounded-md transition-all ${mostraOrarioNetto === v ? 'bg-white shadow-sm text-stone-800' : 'text-stone-400 hover:text-stone-600'}`}>
                      {v === 'lordo' ? 'Lordo' : 'Netto'}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-1 text-[11px] text-stone-400">
                  <Info size={11} />
                  <span className="hidden sm:inline">Basato sulle uscite del periodo</span>
                </div>
              </div>
            </div>

            {/* Configurazione ore */}
            <div className="px-5 py-4 border-b border-stone-100 bg-stone-50/60">
              <p className="text-[11px] font-semibold text-stone-400 uppercase tracking-wide mb-3">Ore lavorate (configura)</p>
              <div className="flex flex-wrap gap-6">
                <div>
                  <label className="text-xs text-stone-500 mb-1 block">Ore/settimana</label>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setOreSettimana(v => Math.max(1, v - 1))}
                      className="w-7 h-7 rounded-lg bg-stone-200 hover:bg-stone-300 text-stone-600 font-bold flex items-center justify-center text-sm transition-colors">−</button>
                    <span className="w-8 text-center text-sm font-bold text-stone-800">{oreSettimana}</span>
                    <button onClick={() => setOreSettimana(v => Math.min(80, v + 1))}
                      className="w-7 h-7 rounded-lg bg-stone-200 hover:bg-stone-300 text-stone-600 font-bold flex items-center justify-center text-sm transition-colors">+</button>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-stone-500 mb-1 block">Settimane lavorate/anno</label>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setSettimaneAnno(v => Math.max(1, v - 1))}
                      className="w-7 h-7 rounded-lg bg-stone-200 hover:bg-stone-300 text-stone-600 font-bold flex items-center justify-center text-sm transition-colors">−</button>
                    <span className="w-8 text-center text-sm font-bold text-stone-800">{settimaneAnno}</span>
                    <button onClick={() => setSettimaneAnno(v => Math.min(52, v + 1))}
                      className="w-7 h-7 rounded-lg bg-stone-200 hover:bg-stone-300 text-stone-600 font-bold flex items-center justify-center text-sm transition-colors">+</button>
                  </div>
                </div>
                <div className="flex items-end">
                  <div className="text-xs text-stone-400">
                    <span className="font-semibold text-stone-600">{Math.round(orePeriodo)} ore</span> nel periodo · <span className="font-semibold text-stone-600">{oreAnno} ore/anno</span>
                  </div>
                </div>
              </div>
            </div>

            {/* KPI orari */}
            <div className="p-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
              {/* Costo per ora di lavoro */}
              <div className="bg-red-50 rounded-xl p-3.5 border border-red-100">
                <p className="text-[11px] font-semibold text-red-500 uppercase tracking-wide mb-1">
                  {mostraOrarioNetto === 'netto' ? 'Costo/ora (spese+tasse)' : 'Costo/ora (spese)'}
                </p>
                <p className="text-2xl font-bold text-red-600">€{costoOrarioDisplay.toFixed(2)}</p>
                <p className="text-[10px] text-stone-400 mt-0.5">
                  {mostraOrarioNetto === 'netto' ? 'quanto ti costa ogni ora lavorata' : 'solo le spese fisse, senza tasse'}
                </p>
              </div>

              {/* Soglia minima da incassare per ora */}
              <div className="bg-amber-50 rounded-xl p-3.5 border border-amber-100">
                <p className="text-[11px] font-semibold text-amber-600 uppercase tracking-wide mb-1">
                  {mostraOrarioNetto === 'netto' ? 'Minimo/ora (con tasse)' : 'Minimo/ora (senza tasse)'}
                </p>
                <p className="text-2xl font-bold text-amber-700">€{breakEvenDisplay.toFixed(2)}</p>
                <p className="text-[10px] text-stone-400 mt-0.5">
                  {mostraOrarioNetto === 'netto' ? 'devi incassare almeno questa cifra/ora' : 'devi incassare almeno questa cifra/ora'}
                </p>
              </div>

              {/* Incassi medi per ora */}
              <div className={`rounded-xl p-3.5 border ${incassoOrarioAttuale >= breakEvenDisplay ? 'bg-teal-50 border-teal-100' : 'bg-red-50 border-red-100'}`}>
                <p className="text-[11px] font-semibold text-stone-500 uppercase tracking-wide mb-1">
                  {mostraOrarioNetto === 'netto' ? 'Guadagno netto/ora' : 'Incassi medi/ora'}
                </p>
                <p className={`text-2xl font-bold ${incassoOrarioAttuale >= breakEvenDisplay ? 'text-teal-600' : 'text-red-600'}`}>
                  {incassoOrarioAttuale < 0 ? '−' : ''}€{Math.abs(incassoOrarioAttuale).toFixed(2)}
                </p>
                <p className="text-[10px] text-stone-400 mt-0.5">
                  {mostraOrarioNetto === 'netto'
                    ? (incassoOrarioAttuale < 0 ? 'in perdita per ogni ora lavorata' : incassoOrarioAttuale >= breakEvenDisplay ? 'in attivo' : 'sotto il minimo')
                    : (fatturatoLordo > 0 ? (incassoOrarioAttuale >= breakEvenDisplay ? 'sopra il minimo' : 'sotto il minimo') : 'nessun incasso')}
                </p>
              </div>

              {/* Margine */}
              <div className="bg-stone-50 rounded-xl p-3.5 border border-stone-100">
                <p className="text-[11px] font-semibold text-stone-500 uppercase tracking-wide mb-1">
                  {mostraOrarioNetto === 'netto' ? 'Margine netto' : 'Margine lordo'}
                </p>
                <p className={`text-2xl font-bold ${margineDisplay > 20 ? 'text-teal-600' : margineDisplay > 0 ? 'text-amber-600' : 'text-red-500'}`}>
                  {margineDisplay >= 0 ? '' : '−'}{Math.abs(margineDisplay).toFixed(1)}%
                </p>
                <p className="text-[10px] text-stone-400 mt-0.5">
                  {mostraOrarioNetto === 'netto'
                    ? `lordo: ${margineLordo >= 0 ? '' : '−'}${Math.abs(margineLordo).toFixed(1)}%`
                    : `netto: ${margineNetto >= 0 ? '' : '−'}${Math.abs(margineNetto).toFixed(1)}%`}
                </p>
              </div>
            </div>

            {/* Semaforo situazione */}
            <div className="px-5 pb-5">
              <div className={`rounded-xl px-4 py-3 flex items-center gap-3 ${superaTasse ? 'bg-teal-50 border border-teal-100' : inPari ? 'bg-amber-50 border border-amber-100' : 'bg-red-50 border border-red-100'}`}>
                <Target size={16} className={superaTasse ? 'text-teal-600' : inPari ? 'text-amber-600' : 'text-red-500'} />
                <div className="flex-1 min-w-0">
                  {superaTasse ? (
                    <p className="text-sm font-semibold text-teal-700">
                      Stai incassando abbastanza — rimane €{nettoDisponibile.toFixed(2)} dopo spese e tasse stimate
                    </p>
                  ) : inPari ? (
                    <p className="text-sm font-semibold text-amber-700">
                      Copri le spese ma non le tasse — ti mancano €{(stimaTasse.totale - (fatturatoLordo - totUscite)).toFixed(2)} per il fisco
                    </p>
                  ) : (
                    <p className="text-sm font-semibold text-red-700">
                      Sotto il punto di pareggio — ti mancano €{(totUscite - fatturatoLordo).toFixed(2)} solo per coprire le spese
                    </p>
                  )}
                  {fatturatoLordo > 0 && (
                    <p className="text-[11px] text-stone-400 mt-0.5">
                      Devi incassare almeno <strong>€{breakEvenConTasse.toFixed(2)}/ora</strong> per stare a paro con spese + tasse incluse
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Lista voci per categoria */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wide">Voci registrate</h2>
          <span className="text-xs text-stone-400">{speseFiltrate.length} voci · {filtroLabelAttuale}</span>
        </div>

        {speseFiltrate.length === 0 ? (
          <div className="bg-white rounded-2xl border border-stone-200 px-6 py-16 text-center">
            <div className="w-12 h-12 bg-stone-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Receipt size={20} className="text-stone-300" />
            </div>
            <p className="text-stone-400 text-sm">Nessuna voce nel periodo.</p>
            <button onClick={() => { setEditSpesa(null); setShowSpesaModal(true); }}
              className="mt-3 text-sm text-teal-600 font-medium hover:underline">
              Aggiungi la prima voce
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Colonna Entrate */}
            {(() => {
              const perCatEntrate: Record<string, typeof speseFiltrate> = {};
              for (const s of entrateExtra) {
                if (!perCatEntrate[s.categoria]) perCatEntrate[s.categoria] = [];
                perCatEntrate[s.categoria].push(s);
              }
              return (
                <div className="space-y-2">
                  <div className="flex items-center justify-between pb-1">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-teal-400" />
                      <span className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Entrate extra</span>
                    </div>
                    <span className="text-sm font-bold text-teal-600">+€{totEntrateExtra.toFixed(2)}</span>
                  </div>
                  {entrateExtra.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-stone-200 border-dashed px-4 py-8 text-center">
                      <p className="text-xs text-stone-400">Nessuna entrata extra</p>
                      <button onClick={() => { setEditSpesa(null); setShowSpesaModal(true); }}
                        className="mt-2 text-xs text-teal-600 font-medium hover:underline">Aggiungi</button>
                    </div>
                  ) : (
                    Object.entries(perCatEntrate)
                      .sort(([, a], [, b]) => b.reduce((s, x) => s + x.importoEffettivo, 0) - a.reduce((s, x) => s + x.importoEffettivo, 0))
                      .map(([cat, voci]) => {
                        const totCat = voci.reduce((s, v) => s + v.importoEffettivo, 0);
                        const isOpen = openCat === `e_${cat}`;
                        return (
                          <div key={cat} className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-sm">
                            <button onClick={() => setOpenCat(isOpen ? null : `e_${cat}`)}
                              className="w-full flex items-center gap-3 px-5 py-4 hover:bg-stone-50 transition-colors text-left">
                              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 bg-teal-400" />
                              <div className="flex-1 min-w-0">
                                <span className="text-sm font-medium text-stone-700">{cat}</span>
                                {voci.some(v => v.ricorrente) && (
                                  <span className="ml-2 text-[11px] bg-stone-100 text-stone-500 rounded-full px-2 py-0.5">ricorrente</span>
                                )}
                              </div>
                              <span className="text-xs text-stone-400 flex-shrink-0">{voci.length} voc{voci.length === 1 ? 'e' : 'i'}</span>
                              <span className="text-sm font-bold flex-shrink-0 text-teal-600">+€{totCat.toFixed(2)}</span>
                              {isOpen ? <ChevronUp size={14} className="text-stone-300 flex-shrink-0" /> : <ChevronDown size={14} className="text-stone-300 flex-shrink-0" />}
                            </button>
                            {isOpen && (
                              <div className="border-t border-stone-100 divide-y divide-stone-50">
                                {voci.map(v => (
                                  <div key={v.id} className="flex items-center gap-3 px-5 py-3 hover:bg-stone-50/60 group">
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm text-stone-700 truncate">{v.descrizione || v.categoria}</p>
                                      <p className="text-xs text-stone-400 flex items-center flex-wrap gap-x-2">
                                        {new Date(v.data + 'T12:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })}
                                        {v.aliquota_iva > 0 && (
                                          <span className="text-[11px] bg-amber-50 text-amber-600 border border-amber-100 rounded-full px-2 py-0.5">
                                            IVA {v.aliquota_iva}%
                                          </span>
                                        )}
                                        {v.ricorrenza && v.ricorrenza !== 'una_tantum' && (
                                          <span className="text-[11px] bg-sky-50 text-sky-600 border border-sky-100 rounded-full px-2 py-0.5">
                                            {RICORRENZE.find(r => r.value === v.ricorrenza)?.label ?? v.ricorrenza}
                                          </span>
                                        )}
                                        {v.data_inizio && (
                                          <span className="text-[11px] bg-teal-50 text-teal-600 border border-teal-100 rounded-full px-2 py-0.5">
                                            dal {new Date(v.data_inizio + 'T12:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })}
                                          </span>
                                        )}
                                        {v.data_fine && (
                                          <span className="text-[11px] bg-orange-50 text-orange-600 border border-orange-100 rounded-full px-2 py-0.5">
                                            scade {new Date(v.data_fine + 'T12:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })}
                                          </span>
                                        )}
                                      </p>
                                    </div>
                                    <div className="text-right flex-shrink-0">
                                      <p className="text-sm font-semibold text-teal-600">+€{v.importoEffettivo.toFixed(2)}</p>
                                      {v.importoEffettivo !== v.importo && (
                                        <p className="text-[11px] text-stone-400">orig. €{v.importo.toFixed(2)}</p>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                      <button onClick={() => { setEditSpesa(v); setShowSpesaModal(true); }}
                                        className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-400 hover:text-stone-600 transition-colors">
                                        <Pencil size={13} />
                                      </button>
                                      <button onClick={() => eliminaSpesa(v.id)}
                                        className="p-1.5 rounded-lg hover:bg-red-50 text-stone-400 hover:text-red-400 transition-colors">
                                        <Trash2 size={13} />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })
                  )}
                </div>
              );
            })()}

            {/* Colonna Uscite */}
            {(() => {
              const perCatUscite: Record<string, typeof speseFiltrate> = {};
              for (const s of uscite) {
                if (!perCatUscite[s.categoria]) perCatUscite[s.categoria] = [];
                perCatUscite[s.categoria].push(s);
              }
              return (
                <div className="space-y-2">
                  <div className="flex items-center justify-between pb-1">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-red-400" />
                      <span className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Uscite</span>
                    </div>
                    <span className="text-sm font-bold text-red-500">−€{totUscite.toFixed(2)}</span>
                  </div>
                  {uscite.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-stone-200 border-dashed px-4 py-8 text-center">
                      <p className="text-xs text-stone-400">Nessuna uscita</p>
                      <button onClick={() => { setEditSpesa(null); setShowSpesaModal(true); }}
                        className="mt-2 text-xs text-teal-600 font-medium hover:underline">Aggiungi</button>
                    </div>
                  ) : (
                    Object.entries(perCatUscite)
                      .sort(([, a], [, b]) => b.reduce((s, x) => s + x.importoEffettivo, 0) - a.reduce((s, x) => s + x.importoEffettivo, 0))
                      .map(([cat, voci]) => {
                        const totCat = voci.reduce((s, v) => s + v.importoEffettivo, 0);
                        const isOpen = openCat === `u_${cat}`;
                        return (
                          <div key={cat} className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-sm">
                            <button onClick={() => setOpenCat(isOpen ? null : `u_${cat}`)}
                              className="w-full flex items-center gap-3 px-5 py-4 hover:bg-stone-50 transition-colors text-left">
                              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 bg-red-400" />
                              <div className="flex-1 min-w-0">
                                <span className="text-sm font-medium text-stone-700">{cat}</span>
                                {voci.some(v => v.ricorrente) && (
                                  <span className="ml-2 text-[11px] bg-stone-100 text-stone-500 rounded-full px-2 py-0.5">ricorrente</span>
                                )}
                              </div>
                              <span className="text-xs text-stone-400 flex-shrink-0">{voci.length} voc{voci.length === 1 ? 'e' : 'i'}</span>
                              <span className="text-sm font-bold flex-shrink-0 text-red-500">−€{totCat.toFixed(2)}</span>
                              {isOpen ? <ChevronUp size={14} className="text-stone-300 flex-shrink-0" /> : <ChevronDown size={14} className="text-stone-300 flex-shrink-0" />}
                            </button>
                            {isOpen && (
                              <div className="border-t border-stone-100 divide-y divide-stone-50">
                                {voci.map(v => (
                                  <div key={v.id} className="flex items-center gap-3 px-5 py-3 hover:bg-stone-50/60 group">
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm text-stone-700 truncate">{v.descrizione || v.categoria}</p>
                                      <p className="text-xs text-stone-400 flex items-center flex-wrap gap-x-2">
                                        {new Date(v.data + 'T12:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })}
                                        {v.periodo_da && (
                                          <span className="text-[11px] bg-stone-100 text-stone-500 border border-stone-200 rounded-full px-2 py-0.5">
                                            {new Date(v.periodo_da + 'T12:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })}
                                            {v.periodo_a ? ` – ${new Date(v.periodo_a + 'T12:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}
                                          </span>
                                        )}
                                        {v.aliquota_iva > 0 && (
                                          <span className="text-[11px] bg-amber-50 text-amber-600 border border-amber-100 rounded-full px-2 py-0.5">
                                            IVA {v.aliquota_iva}%
                                          </span>
                                        )}
                                        {v.ricorrenza && v.ricorrenza !== 'una_tantum' && (
                                          <span className="text-[11px] bg-sky-50 text-sky-600 border border-sky-100 rounded-full px-2 py-0.5">
                                            {RICORRENZE.find(r => r.value === v.ricorrenza)?.label ?? v.ricorrenza}
                                          </span>
                                        )}
                                        {v.data_inizio && (
                                          <span className="text-[11px] bg-teal-50 text-teal-600 border border-teal-100 rounded-full px-2 py-0.5">
                                            dal {new Date(v.data_inizio + 'T12:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })}
                                          </span>
                                        )}
                                        {v.data_fine && (
                                          <span className="text-[11px] bg-orange-50 text-orange-600 border border-orange-100 rounded-full px-2 py-0.5">
                                            scade {new Date(v.data_fine + 'T12:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })}
                                          </span>
                                        )}
                                      </p>
                                    </div>
                                    <div className="text-right flex-shrink-0">
                                      <p className="text-sm font-semibold text-red-500">−€{v.importoEffettivo.toFixed(2)}</p>
                                      {v.importoEffettivo !== v.importo && (
                                        <p className="text-[11px] text-stone-400">orig. €{v.importo.toFixed(2)}</p>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                      <button onClick={() => { setEditSpesa(v); setShowSpesaModal(true); }}
                                        className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-400 hover:text-stone-600 transition-colors">
                                        <Pencil size={13} />
                                      </button>
                                      <button onClick={() => eliminaSpesa(v.id)}
                                        className="p-1.5 rounded-lg hover:bg-red-50 text-stone-400 hover:text-red-400 transition-colors">
                                        <Trash2 size={13} />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })
                  )}
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* Modali */}
      {showSpesaModal && (
        <SpesaModal
          spesa={editSpesa}
          onSave={salvaSpesa}
          onClose={() => { setShowSpesaModal(false); setEditSpesa(null); }}
          defaultIva={tasse?.regime_fiscale === 'forfettario' ? 0 : (tasse?.aliquota_iva ?? 22)}
        />
      )}
      {showTasseModal && (
        <TasseModal
          cfg={tasse ?? { id: '', forma_giuridica: 'partita_iva', regime_fiscale: 'forfettario', aliquota_iva: 22, aliquota_irpef: 23, percentuale_forfettario: 67, imposta_sostitutiva: 15 }}
          onSave={salvaTasse}
          onClose={() => setShowTasseModal(false)}
        />
      )}
    </div>
  );
}
