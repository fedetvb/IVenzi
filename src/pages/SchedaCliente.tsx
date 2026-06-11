import { useEffect, useState, useCallback, useRef } from 'react';
import { ArrowLeft, Phone, Mail, CreditCard as Edit2, Plus, Trash2, Calendar, Palette, TrendingUp, X, ChevronDown, CreditCard, Star, Tag, Wallet, History, BarChart2, Lock, ZoomIn, MessageCircle, Image, Send, ChevronUp, Gift } from 'lucide-react';
import { localDateStr, type Cliente, type SchedaColore, type Appuntamento, supabase } from '../lib/supabase';
import { dbSelect, dbInsert, dbUpdate, dbSelectWithRelated, getImpostazione } from '../lib/localDb';
import { apriWhatsApp as apriWA } from '../lib/waUtils';
import SmsCartaModal, { type AzioneCarta } from '../components/SmsCartaModal';
import ClienteModal from '../components/ClienteModal';
import { useAuth } from '../lib/AuthContext';
import SchedaColoreModal from '../components/SchedaColoreModal';
import MultiBookModal from '../components/MultiBookModal';
import PasswordGateModal from '../components/PasswordGateModal';

interface Props {
  clienteId: string;
  onBack: () => void;
  initialTab?: Tab;
}

type Tab = 'info' | 'colore' | 'appuntamenti' | 'storico' | 'carte' | 'messaggi';

interface MessaggioCliente {
  id: string;
  nome: string;
  cognome: string;
  telefono: string;
  testo: string;
  foto_url_1: string;
  foto_url_2: string;
  foto_url_3: string;
  letto: boolean;
  preferito: boolean;
  risposta_testo: string | null;
  risposta_at: string | null;
  risposta_foto_url_1: string | null;
  risposta_foto_url_2: string | null;
  risposta_foto_url_3: string | null;
  created_at: string;
}

interface FicheVoceCliente {
  fiche_id: string;
  nome_voce: string;
  tipo: string;
  prezzo: number;
  data_ora: string;
}

interface CartaScontoCliente {
  id: string; codice: string; descrizione: string;
  tipo_sconto: 'percentuale' | 'fisso'; valore_sconto: number;
  attiva: boolean; usa_e_getta: boolean;
}
interface CartaPremiumCliente {
  id: string; codice: string; saldo: number; note: string; attiva: boolean;
}
interface GiftPassCliente {
  id: string; codice: string; tipo: 'valore' | 'prodotto';
  valore_euro: number | null; prodotto_nome: string | null;
  occasione: string; attivata_at: string | null; utilizzata: boolean;
  destinataria_nome: string; destinataria_cliente_id: string | null;
}
interface RicaricaRecord {
  id: string; carta_premium_id: string; importo: number; note: string; created_at: string;
}

const STATO_LABEL: Record<string, string> = {
  confermato: 'Confermato',
  in_attesa: 'In attesa',
  completato: 'Completato',
  cancellato: 'Cancellato',
};
const STATO_CLASS: Record<string, string> = {
  confermato: 'bg-sky-100 text-sky-700',
  in_attesa: 'bg-amber-100 text-amber-700',
  completato: 'bg-emerald-100 text-emerald-700',
  cancellato: 'bg-red-100 text-red-700',
};

// ─── RicaricaCartaModal ───────────────────────────────────────────────────────

function calcolaPrezzoRicarica(credito: number): number {
  return Math.floor(credito * (250 / 300) / 10) * 10;
}

function RicaricaCartaModal({ carta, onClose, onSaved }: {
  carta: { id: string; codice: string; saldo: number };
  onClose: () => void;
  onSaved: (info: { importo: number; prezzoCliente: number; nuovoSaldo: number; tipo: string }) => void;
}) {
  const { user } = useAuth();
  const [importo, setImporto] = useState(100);
  const [note, setNote] = useState('');
  const [tipo, setTipo] = useState<'standard' | 'gratuito'>('standard');
  const [saving, setSaving] = useState(false);
  const IMPORTI_RAPIDI = [100, 150, 200, 300, 400, 500];

  const prezzoCliente = tipo === 'standard' ? calcolaPrezzoRicarica(importo) : 0;

  async function save() {
    setSaving(true);
    const oggi = localDateStr();
    await dbInsert({
      table: 'ricariche_carta_premium',
      data: {
        carta_premium_id: carta.id,
        importo,
        note,
        tipo_ricarica: tipo,
        user_id: user?.id,
      },
    });
    await dbUpdate({
      table: 'carte_premium',
      id: carta.id,
      data: { saldo: carta.saldo + importo },
    });
    if (tipo === 'standard') {
      await dbInsert({
        table: 'incassi_giornalieri',
        data: {
          data: oggi,
          fiche_id: null,
          cliente_nome: `Ricarica carta ${carta.codice}`,
          importo: prezzoCliente,
          note: `Ricarica carta premium: credito €${importo}, pagato €${prezzoCliente}`,
          user_id: user?.id,
        },
      });
    }
    setSaving(false);
    onSaved({ importo, prezzoCliente, nuovoSaldo: carta.saldo + importo, tipo });
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
              <Wallet size={15} className="text-emerald-600" />
            </div>
            <div>
              <p className="font-bold text-stone-800 text-sm">Ricarica carta</p>
              <p className="text-xs text-stone-400 font-mono">{carta.codice}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-stone-100 rounded-lg transition-colors">
            <X size={15} className="text-stone-500" />
          </button>
        </div>
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setTipo('standard')}
              className={`flex flex-col items-center gap-1 px-3 py-2.5 rounded-xl border text-sm font-semibold transition-colors ${tipo === 'standard' ? 'bg-emerald-500 text-white border-emerald-500' : 'border-stone-200 text-stone-600 hover:bg-stone-50'}`}>
              <Wallet size={14} />
              Ricarica standard
            </button>
            <button onClick={() => setTipo('gratuito')}
              className={`flex flex-col items-center gap-1 px-3 py-2.5 rounded-xl border text-sm font-semibold transition-colors ${tipo === 'gratuito' ? 'bg-sky-500 text-white border-sky-500' : 'border-stone-200 text-stone-600 hover:bg-stone-50'}`}>
              <Plus size={14} />
              Credito extra gratuito
            </button>
          </div>
          {tipo === 'gratuito' && (
            <p className="text-xs text-sky-600 bg-sky-50 rounded-lg px-3 py-2">
              Credito bonus: nessun incasso registrato e nessuna detrazione applicata.
            </p>
          )}
          <div className="bg-emerald-50 rounded-xl p-3 flex items-center justify-between">
            <span className="text-sm text-emerald-700 font-medium">Saldo attuale</span>
            <span className="text-lg font-bold text-emerald-700">€{carta.saldo.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          <div>
            <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">Credito da aggiungere alla carta (€)</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {IMPORTI_RAPIDI.map(imp => (
                <button key={imp} onClick={() => setImporto(imp)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${importo === imp ? 'bg-emerald-500 text-white border-emerald-500' : 'border-stone-200 text-stone-600 hover:bg-stone-50'}`}>
                  +€{imp}
                </button>
              ))}
            </div>
            <input type="number" onInput={e => { const t = e.currentTarget; if (t.value.length > 1 && t.value.startsWith('0') && !t.value.startsWith('0.')) t.value = String(Number(t.value)); }} min={1} step={10} value={importo} onChange={e => setImporto(Number(e.target.value))}
              onFocus={e => e.target.select()}
              className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-400" />
          </div>
          <div className="space-y-1.5">
            <div className="bg-stone-50 rounded-xl p-3 flex items-center justify-between">
              <span className="text-sm text-stone-600">Nuovo saldo carta</span>
              <span className="text-lg font-bold text-stone-800">€{(carta.saldo + importo).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            {tipo === 'standard' && (
              <div className="bg-amber-50 rounded-xl p-3 border border-amber-100">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-amber-700 font-medium">La cliente paga</span>
                  <span className="text-xl font-bold text-amber-700">€{prezzoCliente}</span>
                </div>
                <p className="text-xs text-amber-500 mt-1">Credito carta: €{importo} · Incasso registrato: €{prezzoCliente}</p>
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1.5">Note (opzionale)</label>
            <input value={note} onChange={e => setNote(e.target.value)} placeholder="Motivazione ricarica..."
              className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-400" />
          </div>
        </div>
        <div className="flex gap-3 px-6 pb-6 flex-shrink-0">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-stone-200 text-sm font-medium text-stone-600 hover:bg-stone-50 transition-colors">Annulla</button>
          <button onClick={save} disabled={saving || importo <= 0}
            className={`flex-1 py-2.5 rounded-xl text-white text-sm font-semibold transition-colors disabled:opacity-50 ${tipo === 'gratuito' ? 'bg-sky-500 hover:bg-sky-600' : 'bg-emerald-500 hover:bg-emerald-600'}`}>
            {saving ? 'Ricarica...' : tipo === 'gratuito' ? `Aggiungi credito +€${importo}` : `Ricarica · paga €${prezzoCliente}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── GraficoServiziModal ─────────────────────────────────────────────────────

const NOMI_MESI_SHORT = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'];
const NOMI_MESI_FULL = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
const SERVIZIO_COLORS = ['#10b981','#f59e0b','#0ea5e9','#f97316','#ec4899','#14b8a6','#84cc16','#ef4444','#d97706','#64748b'];

// Normalizza nome voce: trim + prima lettera maiuscola, resto come scritto → confronto lowercase
function normalizzaNome(s: string): string {
  const t = s.trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}
function chiaveNome(s: string): string {
  return s.trim().toLowerCase();
}

function GraficoServiziModal({ voci, onClose }: { voci: FicheVoceCliente[]; onClose: () => void }) {
  const now = new Date();
  const anniDisponibili = [...new Set(voci.map(v => v.data_ora.slice(0, 4)))].sort((a, b) => b.localeCompare(a));
  const [viewMode, setViewMode] = useState<'anno' | 'mese'>('anno');
  const [annoSel, setAnnoSel] = useState<string>(anniDisponibili[0] ?? String(now.getFullYear()));
  const [meseSel, setMeseSel] = useState<string>(String(now.getMonth() + 1).padStart(2, '0'));
  const [chartMode, setChartMode] = useState<'occorrenze' | 'ricavo'>('occorrenze');
  const [servizioSelezionato, setServizioSelezionato] = useState<string | null>(null);

  // Voci filtrate per il periodo selezionato
  const vociFiltrate = voci.filter(v => {
    if (viewMode === 'anno') return v.data_ora.startsWith(annoSel);
    return v.data_ora.startsWith(`${annoSel}-${meseSel}`);
  });

  // Accorpa per chiave case-insensitive, usa il nome normalizzato come label
  const serviziMap: Record<string, { label: string; occorrenze: number; ricavoTotale: number; voci: FicheVoceCliente[] }> = {};
  for (const v of vociFiltrate) {
    const key = chiaveNome(v.nome_voce);
    if (!key) continue;
    if (!serviziMap[key]) serviziMap[key] = { label: normalizzaNome(v.nome_voce), occorrenze: 0, ricavoTotale: 0, voci: [] };
    serviziMap[key].occorrenze++;
    serviziMap[key].ricavoTotale += v.prezzo;
    serviziMap[key].voci.push(v);
  }
  const servizi = Object.entries(serviziMap).sort((a, b) => b[1].occorrenze - a[1].occorrenze);

  // Grafico di dettaglio: per anno → barre per mese; per mese → barre per giorno (o solo riepilogo)
  function buildStorico(key: string) {
    const all = voci.filter(v => chiaveNome(v.nome_voce) === key);
    if (viewMode === 'anno') {
      // 12 mesi dell'anno selezionato
      return Array.from({ length: 12 }, (_, i) => {
        const m = String(i + 1).padStart(2, '0');
        const prefix = `${annoSel}-${m}`;
        const vm = all.filter(v => v.data_ora.startsWith(prefix));
        return { label: NOMI_MESI_SHORT[i], occorrenze: vm.length, ricavo: vm.reduce((s, v) => s + v.prezzo, 0) };
      });
    } else {
      // confronto anno per anno per quel mese
      return anniDisponibili.slice().reverse().map(anno => {
        const prefix = `${anno}-${meseSel}`;
        const vm = all.filter(v => v.data_ora.startsWith(prefix));
        return { label: `'${anno.slice(2)}`, occorrenze: vm.length, ricavo: vm.reduce((s, v) => s + v.prezzo, 0) };
      });
    }
  }

  const storico = servizioSelezionato ? buildStorico(servizioSelezionato) : null;
  const maxOcc = storico ? Math.max(...storico.map(d => d.occorrenze), 1) : 1;
  const maxRic = storico ? Math.max(...storico.map(d => d.ricavo), 1) : 1;

  const periodoLabel = viewMode === 'anno'
    ? annoSel
    : `${NOMI_MESI_FULL[Number(meseSel) - 1]} ${annoSel}`;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col z-10">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
              <BarChart2 size={15} className="text-emerald-600" />
            </div>
            <div>
              <p className="font-bold text-stone-800 text-sm">Servizi dalla cliente</p>
              <p className="text-xs text-stone-400">Fiches convalidate · {periodoLabel}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-stone-100 rounded-lg transition-colors">
            <X size={15} className="text-stone-500" />
          </button>
        </div>

        {/* Filtri periodo */}
        <div className="flex items-center gap-2 px-5 py-3 border-b border-stone-100 flex-wrap">
          <div className="flex gap-1">
            <button onClick={() => setViewMode('anno')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${viewMode === 'anno' ? 'bg-stone-800 text-white' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'}`}>
              Anno
            </button>
            <button onClick={() => setViewMode('mese')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${viewMode === 'mese' ? 'bg-stone-800 text-white' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'}`}>
              Mese
            </button>
          </div>
          <select value={annoSel} onChange={e => { setAnnoSel(e.target.value); setServizioSelezionato(null); }}
            className="px-2.5 py-1.5 rounded-lg border border-stone-200 text-xs font-medium text-stone-700 bg-white focus:outline-none focus:border-stone-400">
            {anniDisponibili.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          {viewMode === 'mese' && (
            <select value={meseSel} onChange={e => { setMeseSel(e.target.value); setServizioSelezionato(null); }}
              className="px-2.5 py-1.5 rounded-lg border border-stone-200 text-xs font-medium text-stone-700 bg-white focus:outline-none focus:border-stone-400">
              {Array.from({ length: 12 }, (_, i) => {
                const m = String(i + 1).padStart(2, '0');
                return <option key={m} value={m}>{NOMI_MESI_FULL[i]}</option>;
              })}
            </select>
          )}
          <div className="flex gap-1 ml-auto">
            <button onClick={() => setChartMode('occorrenze')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${chartMode === 'occorrenze' ? 'bg-emerald-500 text-white' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'}`}>
              Occ.
            </button>
            <button onClick={() => setChartMode('ricavo')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${chartMode === 'ricavo' ? 'bg-amber-500 text-white' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'}`}>
              Ricavo
            </button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-3">
          {servizi.length === 0 ? (
            <div className="text-center py-10 text-stone-400 text-sm">
              <BarChart2 size={32} className="mx-auto mb-2 text-stone-200" />
              Nessun servizio nel periodo selezionato
            </div>
          ) : (
            <>
              {/* Lista servizi */}
              <div className="space-y-2">
                {servizi.map(([key, s], i) => {
                  const color = SERVIZIO_COLORS[i % SERVIZIO_COLORS.length];
                  const maxOccAll = servizi[0][1].occorrenze;
                  const maxRicAll = servizi[0][1].ricavoTotale;
                  const barPct = chartMode === 'occorrenze'
                    ? (s.occorrenze / maxOccAll) * 100
                    : (s.ricavoTotale / maxRicAll) * 100;
                  const isSelected = servizioSelezionato === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setServizioSelezionato(isSelected ? null : key)}
                      className={`w-full text-left rounded-xl border px-4 py-3 transition-all ${isSelected ? 'border-stone-300 bg-stone-50 shadow-sm' : 'border-stone-100 hover:border-stone-200 hover:bg-stone-50/50'}`}
                    >
                      <div className="flex items-center justify-between gap-3 mb-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                          <span className="text-sm font-semibold text-stone-800 truncate">{s.label}</span>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0 text-xs">
                          <span className="text-stone-500 font-medium">{s.occorrenze}x</span>
                          <span className="text-emerald-600 font-bold">€{s.ricavoTotale.toFixed(0)}</span>
                          <ChevronDown size={13} className={`text-stone-400 transition-transform ${isSelected ? 'rotate-180' : ''}`} />
                        </div>
                      </div>
                      <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${barPct}%`, backgroundColor: color }} />
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Grafico dettaglio */}
              {servizioSelezionato && storico && (
                <div className="rounded-xl border border-stone-200 bg-stone-50/80 p-4">
                  <div className="flex items-center justify-between gap-2 mb-4">
                    <span className="text-xs font-bold text-stone-700">
                      {serviziMap[servizioSelezionato]?.label}
                      <span className="text-stone-400 font-normal ml-1">
                        — {viewMode === 'anno' ? `mesi ${annoSel}` : `confronto annuale (${NOMI_MESI_FULL[Number(meseSel) - 1]})`}
                      </span>
                    </span>
                  </div>
                  {storico.every(d => (chartMode === 'occorrenze' ? d.occorrenze : d.ricavo) === 0) ? (
                    <p className="text-xs text-stone-400 text-center py-3">Nessun dato</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <div className="flex items-end gap-2 px-1" style={{ minWidth: `${Math.max(storico.length * 44, 280)}px` }}>
                        {storico.map((d, idx) => {
                          const val = chartMode === 'occorrenze' ? d.occorrenze : d.ricavo;
                          const maxV = chartMode === 'occorrenze' ? maxOcc : maxRic;
                          const pct = maxV > 0 ? val / maxV : 0;
                          const barPx = Math.max(pct * 88, val > 0 ? 6 : 0);
                          const color = chartMode === 'occorrenze' ? '#10b981' : '#f59e0b';
                          const fmt = chartMode === 'occorrenze' ? `${val}x` : `€${val.toFixed(0)}`;
                          return (
                            <div key={idx} className="flex flex-col items-center gap-1 flex-1" style={{ minWidth: '32px' }}>
                              <span className="text-[10px] font-bold leading-none" style={{ color: val > 0 ? color : 'transparent', minHeight: '13px' }}>
                                {val > 0 ? fmt : '-'}
                              </span>
                              <div className="relative w-full rounded-sm overflow-hidden" style={{ height: '88px', backgroundColor: '#e7e5e4' }}>
                                <div className="absolute bottom-0 left-0 right-0 rounded-sm transition-all duration-500"
                                  style={{ height: `${barPx}px`, backgroundColor: color, opacity: 0.85 }} />
                              </div>
                              <span className="text-[10px] text-stone-500 font-medium leading-none mt-0.5 whitespace-nowrap">{d.label}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SchedaCliente({ clienteId, onBack, initialTab }: Props) {
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [schede, setSchede] = useState<SchedaColore[]>([]);
  const [appuntamenti, setAppuntamenti] = useState<Appuntamento[]>([]);
  const [tab, setTab] = useState<Tab>(initialTab ?? 'info');
  const [editCliente, setEditCliente] = useState(false);
  const [schedaModal, setSchedaModal] = useState<{ open: boolean; id?: string }>({ open: false });
  const [appModal, setAppModal] = useState<{ open: boolean; id?: string }>({ open: false });
  const [carteSconto, setCarteSconto] = useState<CartaScontoCliente[]>([]);
  const [cartePremium, setCartePremium] = useState<CartaPremiumCliente[]>([]);
  const [giftPassList, setGiftPassList] = useState<GiftPassCliente[]>([]);
  const [ricaricheStorico, setRicaricheStorico] = useState<RicaricaRecord[]>([]);
  const [ricaricaModal, setRicaricaModal] = useState<CartaPremiumCliente | null>(null);
  const [passwordGatePending, setPasswordGatePending] = useState<CartaPremiumCliente | null>(null);
  const [smsModal, setSmsModal] = useState<{ codice: string; azione: AzioneCarta } | null>(null);
  const [ficheVoci, setFicheVoci] = useState<FicheVoceCliente[]>([]);
  const [showGraficoGate, setShowGraficoGate] = useState(false);
  const [showGrafico, setShowGrafico] = useState(false);
  const [fotoZoom, setFotoZoom] = useState(false);
  const [messaggi, setMessaggi] = useState<MessaggioCliente[]>([]);
  const [msgFotoZoom, setMsgFotoZoom] = useState<string | null>(null);
  const [deletePasswordInput, setDeletePasswordInput] = useState('');
  const [deletePasswordError, setDeletePasswordError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<'single' | 'all' | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [presentataDa, setPresentataDa] = useState<string | null>(null);
  const [haPortato, setHaPortato] = useState<string[]>([]);

  const load = useCallback(async () => {
    const [clRes, scRes, appRes, cscRes, cprRes] = await Promise.all([
      dbSelect<Cliente>({
        table: 'clienti',
        filters: [{ col: 'id', op: 'eq', val: clienteId }],
        limit: 1,
      }),
      dbSelect<SchedaColore>({
        table: 'schede_colore',
        filters: [
          { col: 'cliente_id', op: 'eq', val: clienteId },
          { col: 'deleted_at', op: 'is_null', val: true },
        ],
        orderBy: [{ col: 'data_trattamento', asc: false }],
      }),
      dbSelectWithRelated<Appuntamento>({
        table: 'appuntamenti',
        filters: [
          { col: 'cliente_id', op: 'eq', val: clienteId },
          { col: 'deleted_at', op: 'is_null', val: true },
        ],
        orderBy: [{ col: 'data_ora', asc: false }],
        relations: [
          { key: 'appuntamento_trattamenti', table: 'appuntamento_trattamenti', fk: 'appuntamento_id', many: true },
        ],
        supabaseSelect: '*, appuntamento_trattamenti(nome_trattamento, prezzo)',
      }),
      dbSelect<CartaScontoCliente>({
        table: 'carte_sconto',
        columns: 'id, codice, descrizione, tipo_sconto, valore_sconto, attiva, usa_e_getta',
        filters: [
          { col: 'cliente_id', op: 'eq', val: clienteId },
          { col: 'deleted_at', op: 'is_null', val: true },
        ],
        orderBy: [{ col: 'created_at', asc: false }],
      }),
      dbSelect<CartaPremiumCliente>({
        table: 'carte_premium',
        columns: 'id, codice, saldo, note, attiva',
        filters: [
          { col: 'cliente_id', op: 'eq', val: clienteId },
          { col: 'deleted_at', op: 'is_null', val: true },
        ],
        orderBy: [{ col: 'created_at', asc: false }],
      }),
    ]);
    if (clRes.data?.[0]) setCliente(clRes.data[0]);
    setSchede(scRes.data || []);
    setAppuntamenti(appRes.data || []);
    setCarteSconto(cscRes.data || []);
    const premiumList = cprRes.data || [];
    setCartePremium(premiumList);

    // Carica gift pass acquistate da questa cliente (lei è la donatrice)
    const { data: gpData } = await dbSelect<GiftPassCliente>({
      table: 'gift_pass',
      columns: 'id, codice, tipo, valore_euro, prodotto_nome, occasione, attivata_at, utilizzata, destinataria_nome, destinataria_cliente_id',
      filters: [
        { col: 'cliente_id', op: 'eq', val: clienteId },
        { col: 'utilizzata', op: 'eq', val: false },
      ],
      orderBy: [{ col: 'created_at', asc: false }],
    });
    setGiftPassList(gpData || []);

    // Carica voci fiche del cliente:
    // Caso 1 – fiches legate ad appuntamento del cliente (cliente_id su appuntamenti)
    // Caso 2 – fiches manuali con cliente_id direttamente su fiches
    const appIds = (appRes.data || []).map(a => a.id);
    const [vociViaAppRes, vociManualiRes] = await Promise.all([
      appIds.length > 0
        ? dbSelectWithRelated<any>({
            table: 'fiche_voci',
            filters: [{ col: 'fiches.appuntamento_id', op: 'in', val: appIds }],
            relations: [
              { key: 'fiches', table: 'fiches', fk: 'fiche_id' },
            ],
            supabaseSelect: 'fiche_id, nome_voce, tipo, prezzo, fiches!inner(convalidata, appuntamento_id, appuntamenti!inner(data_ora, cliente_id))',
          })
        : Promise.resolve({ data: [] } as any),
      dbSelectWithRelated<any>({
        table: 'fiche_voci',
        filters: [
          { col: 'fiches.convalidata', op: 'eq', val: true },
          { col: 'fiches.cliente_id', op: 'eq', val: clienteId },
        ],
        relations: [
          { key: 'fiches', table: 'fiches', fk: 'fiche_id' },
        ],
        supabaseSelect: 'fiche_id, nome_voce, tipo, prezzo, fiches!inner(convalidata, cliente_id, data_riferimento)',
      }),
    ]);

    const vociFlat: FicheVoceCliente[] = [];

    for (const v of (vociViaAppRes.data || []) as Array<{
      fiche_id: string; nome_voce: string; tipo: string; prezzo: number;
      fiches: { convalidata: boolean; appuntamento_id: string; appuntamenti: { data_ora: string; cliente_id: string } | null } | null;
    }>) {
      const dataOra = v.fiches?.appuntamenti?.data_ora;
      if (!dataOra) continue;
      vociFlat.push({ fiche_id: v.fiche_id, nome_voce: v.nome_voce ?? '', tipo: v.tipo ?? 'servizio', prezzo: v.prezzo, data_ora: dataOra });
    }

    for (const v of (vociManualiRes.data || []) as Array<{
      fiche_id: string; nome_voce: string; tipo: string; prezzo: number;
      fiches: { convalidata: boolean; cliente_id: string | null; data_riferimento: string | null } | null;
    }>) {
      const dataOra = v.fiches?.data_riferimento;
      if (!dataOra) continue;
      // evita duplicati (una fiche manuale potrebbe rientrare in entrambe le query se ha anche appuntamento_id)
      if (vociFlat.some(x => x.fiche_id === v.fiche_id && x.nome_voce === v.nome_voce)) continue;
      vociFlat.push({ fiche_id: v.fiche_id, nome_voce: v.nome_voce ?? '', tipo: v.tipo ?? 'servizio', prezzo: v.prezzo, data_ora: dataOra });
    }

    setFicheVoci(vociFlat);

    // Carica messaggi del cliente
    const { data: msgData } = await supabase
      .from('messaggi_clienti')
      .select('*')
      .eq('cliente_id', clienteId)
      .order('created_at', { ascending: false });
    setMessaggi((msgData ?? []) as MessaggioCliente[]);

    // Carica storico ricariche per tutte le carte premium del cliente
    if (premiumList.length > 0) {
      const ids = premiumList.map(c => c.id);
      const ricRes = await dbSelect<RicaricaRecord>({
        table: 'ricariche_carta_premium',
        filters: [{ col: 'carta_premium_id', op: 'in', val: ids }],
        orderBy: [{ col: 'created_at', asc: false }],
      });
      setRicaricheStorico(ricRes.data || []);
    } else {
      setRicaricheStorico([]);
    }
  }, [clienteId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    async function loadReferral() {
      // Chi ha presentato questo cliente (ha una carta con regalata_da_cliente_id che punta ad un altro cliente)
      const { data: cartaRicevuta } = await supabase
        .from('carte_sconto')
        .select('regalata_da_cliente_id')
        .eq('cliente_id', clienteId)
        .not('regalata_da_cliente_id', 'is', null)
        .limit(1)
        .maybeSingle();

      if (cartaRicevuta?.regalata_da_cliente_id) {
        const { data: gifter } = await supabase
          .from('clienti')
          .select('nome, cognome')
          .eq('id', cartaRicevuta.regalata_da_cliente_id)
          .maybeSingle();
        if (gifter) setPresentataDa(`${gifter.nome} ${gifter.cognome}`);
      } else {
        setPresentataDa(null);
      }

      // Chi ha portato in salone (clienti che hanno ricevuto una carta regalata da questo cliente)
      const { data: carteRegalate } = await supabase
        .from('carte_sconto')
        .select('cliente_id')
        .eq('regalata_da_cliente_id', clienteId)
        .not('cliente_id', 'is', null);

      if (carteRegalate && carteRegalate.length > 0) {
        const ids = carteRegalate.map((c: { cliente_id: string }) => c.cliente_id);
        const { data: portate } = await supabase
          .from('clienti')
          .select('nome, cognome')
          .in('id', ids)
          .is('deleted_at', null);
        setHaPortato((portate ?? []).map((c: { nome: string; cognome: string }) => `${c.nome} ${c.cognome}`));
      } else {
        setHaPortato([]);
      }
    }
    loadReferral();
  }, [clienteId]);

  async function deleteScheda(id: string) {
    if (!confirm('Eliminare questa scheda colore?')) return;
    await dbUpdate({
      table: 'schede_colore',
      id,
      data: { deleted_at: new Date().toISOString() },
    });
    load();
  }

  async function deleteApp(id: string) {
    if (!confirm('Eliminare questo appuntamento?')) return;
    await dbUpdate({
      table: 'appuntamenti',
      id,
      data: { deleted_at: new Date().toISOString() },
    });
    load();
  }

  if (!cliente) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-7 h-7 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const initials = `${cliente.nome[0] ?? ''}${cliente.cognome[0] ?? ''}`.toUpperCase();
  const eta = cliente.data_nascita
    ? Math.floor((Date.now() - new Date(cliente.data_nascita).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : null;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Back */}
      <button onClick={onBack} className="flex items-center gap-2 text-stone-500 hover:text-stone-800 text-sm mb-5 transition-colors">
        <ArrowLeft size={16} /> Torna ai clienti
      </button>

      {/* Header card */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6 mb-5">
        <div className="flex items-start gap-5">
          {(() => {
            const fotoSrc = ((cliente as Record<string, unknown>).foto_base64 as string) || cliente.foto_url;
            return fotoSrc ? (
              <button
                onClick={() => setFotoZoom(true)}
                className="w-16 h-16 rounded-2xl flex-shrink-0 overflow-hidden relative group focus:outline-none"
                title="Ingrandisci foto"
              >
                <img src={fotoSrc} alt={`${cliente.nome} ${cliente.cognome}`} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
                  <ZoomIn size={18} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </button>
            ) : (
              <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center flex-shrink-0">
                <span className="text-xl font-bold text-amber-700">{initials}</span>
              </div>
            );
          })()}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold text-stone-800">{cliente.nome} {cliente.cognome}</h1>
                {eta !== null && <p className="text-sm text-stone-400 mt-0.5">{eta} anni</p>}
              </div>
              <button
                onClick={() => setEditCliente(true)}
                className="flex items-center gap-1.5 text-sm text-amber-600 hover:text-amber-700 font-medium border border-amber-200 rounded-lg px-3 py-1.5 hover:bg-amber-50 transition-colors flex-shrink-0"
              >
                <Edit2 size={14} /> Modifica
              </button>
            </div>
            <div className="flex flex-wrap gap-4 mt-3">
              {cliente.telefono && (
                <a href={`tel:${cliente.telefono}`} className="flex items-center gap-1.5 text-sm text-stone-600 hover:text-amber-600 transition-colors">
                  <Phone size={14} /> {cliente.telefono}
                </a>
              )}
              {cliente.email && (
                <a href={`mailto:${cliente.email}`} className="flex items-center gap-1.5 text-sm text-stone-600 hover:text-amber-600 transition-colors">
                  <Mail size={14} /> {cliente.email}
                </a>
              )}
            </div>
            {cliente.note && (
              <p className="mt-3 text-sm text-stone-500 bg-stone-50 rounded-lg px-3 py-2">{cliente.note}</p>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-stone-100 p-1 rounded-xl mb-5 flex-wrap">
        {([
          { id: 'info', label: 'Dati personali', icon: <Phone size={14} /> },
          { id: 'colore', label: 'Schede colore', icon: <Palette size={14} /> },
          { id: 'appuntamenti', label: 'Appuntamenti', icon: <Calendar size={14} /> },
          { id: 'storico', label: 'Storico', icon: <TrendingUp size={14} /> },
          { id: 'carte', label: 'Carte', icon: <CreditCard size={14} />, badge: carteSconto.length + cartePremium.length },
          { id: 'messaggi', label: 'Messaggi', icon: <MessageCircle size={14} />, badge: messaggi.filter(m => !m.letto).length },
        ] as { id: Tab; label: string; icon: React.ReactNode; badge?: number }[]).map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t.id ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500 hover:text-stone-700'
            }`}
          >
            {t.icon} {t.label}
            {t.badge != null && t.badge > 0 && (
              <span className="ml-0.5 w-4 h-4 rounded-full bg-amber-500 text-white text-[9px] font-bold flex items-center justify-center leading-none">
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'info' && (
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6">
          <h3 className="font-semibold text-stone-700 mb-4">Informazioni personali</h3>
          <div className="grid grid-cols-2 gap-4">
            <InfoRow label="Nome" value={cliente.nome} />
            <InfoRow label="Cognome" value={cliente.cognome} />
            <InfoRow label="Telefono" value={cliente.telefono || '—'} />
            <InfoRow label="Email" value={cliente.email || '—'} />
            <InfoRow label="Data di nascita" value={cliente.data_nascita ? new Date(cliente.data_nascita).toLocaleDateString('it-IT') : '—'} />
            <InfoRow label="Eta" value={eta !== null ? `${eta} anni` : '—'} />
          </div>
          {cliente.note && (
            <div className="mt-4 pt-4 border-t border-stone-100">
              <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1">Note</p>
              <p className="text-sm text-stone-700">{cliente.note}</p>
            </div>
          )}
          {(presentataDa || haPortato.length > 0) && (
            <div className="mt-4 pt-4 border-t border-stone-100 space-y-3">
              {presentataDa && (
                <div className="bg-emerald-50 rounded-xl px-4 py-3 border border-emerald-100">
                  <p className="text-xs font-bold text-emerald-600 uppercase tracking-wide mb-0.5">Presentata da</p>
                  <p className="text-sm text-emerald-800 font-semibold">La cliente è stata presentata da: {presentataDa}</p>
                </div>
              )}
              {haPortato.length > 0 && (
                <div className="bg-sky-50 rounded-xl px-4 py-3 border border-sky-100">
                  <p className="text-xs font-bold text-sky-600 uppercase tracking-wide mb-0.5">Ha presentato al salone</p>
                  <p className="text-sm text-sky-800">{haPortato.join(', ')}</p>
                </div>
              )}
            </div>
          )}
          <p className="text-xs text-stone-400 mt-4 pt-4 border-t border-stone-100">
            Cliente dal {new Date(cliente.created_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
      )}

      {tab === 'colore' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setSchedaModal({ open: true })}
              className="flex items-center gap-2 bg-amber-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-600 transition-colors"
            >
              <Plus size={15} /> Nuova scheda colore
            </button>
          </div>
          {schede.length === 0 ? (
            <div className="bg-white rounded-2xl border border-stone-200 p-10 text-center text-stone-400 text-sm">
              Nessuna scheda colore per questo cliente
            </div>
          ) : (
            schede.map(s => (
              <div key={s.id} className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <p className="font-semibold text-stone-800">{new Date(s.data_trattamento).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                    {s.tecnica && <p className="text-sm text-amber-600 font-medium">{s.tecnica}</p>}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setSchedaModal({ open: true, id: s.id })} className="p-1.5 text-stone-400 hover:text-amber-600 transition-colors">
                      <Edit2 size={14} />
                    </button>
                    <button onClick={() => deleteScheda(s.id)} className="p-1.5 text-stone-400 hover:text-red-500 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {s.colore_base && <InfoRow label="Colore base" value={s.colore_base} />}
                  {s.colore_target && <InfoRow label="Colore target" value={s.colore_target} />}
                  {s.formula_colore && <InfoRow label="Formula" value={s.formula_colore} />}
                  {s.ossidante && <InfoRow label="Ossidante" value={s.ossidante} />}
                  {s.tempo_posa > 0 && <InfoRow label="Tempo posa" value={`${s.tempo_posa} min`} />}
                </div>
                {s.note && <p className="mt-3 text-sm text-stone-500 bg-stone-50 rounded-lg px-3 py-2">{s.note}</p>}
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'appuntamenti' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setAppModal({ open: true })}
              className="flex items-center gap-2 bg-amber-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-600 transition-colors"
            >
              <Plus size={15} /> Nuovo appuntamento
            </button>
          </div>
          {appuntamenti.length === 0 ? (
            <div className="bg-white rounded-2xl border border-stone-200 p-10 text-center text-stone-400 text-sm">
              Nessun appuntamento per questo cliente
            </div>
          ) : (
            appuntamenti.map(app => {
              const stLabel = STATO_LABEL[app.stato] ?? app.stato;
              const stClass = STATO_CLASS[app.stato] ?? STATO_CLASS.confermato;
              const trattamenti = (app as Appuntamento & { appuntamento_trattamenti?: { nome_trattamento: string; prezzo: number }[] }).appuntamento_trattamenti;
              return (
                <div key={app.id} className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-stone-800">
                        {new Date(app.data_ora).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                        {' · '}
                        {new Date(app.data_ora).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                      <p className="text-sm text-stone-400 mt-0.5">{app.durata_minuti} minuti</p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {(app as any).nuova_cliente && (
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-orange-100 text-orange-600">Nuova cliente</span>
                      )}
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${stClass}`}>{stLabel}</span>
                      <button onClick={() => setAppModal({ open: true, id: app.id })} className="p-1.5 text-stone-400 hover:text-amber-600 transition-colors">
                        <Edit2 size={14} />
                      </button>
                      <button onClick={() => deleteApp(app.id)} className="p-1.5 text-stone-400 hover:text-red-500 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  {trattamenti && trattamenti.length > 0 && (
                    <div className="mt-3 space-y-1">
                      {trattamenti.map((t, i) => (
                        <div key={i} className="flex justify-between text-sm">
                          <span className="text-stone-600">{t.nome_trattamento}</span>
                          <span className="text-stone-700 font-medium">€{t.prezzo.toFixed(2)}</span>
                        </div>
                      ))}
                      {app.prezzo_totale > 0 && (
                        <div className="flex justify-between text-sm font-bold text-stone-800 pt-1 border-t border-stone-100 mt-1">
                          <span>Totale</span>
                          <span>€{app.prezzo_totale.toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                  )}
                  {app.note && <p className="mt-2 text-sm text-stone-400">{app.note}</p>}
                </div>
              );
            })
          )}
        </div>
      )}

      {tab === 'storico' && (
        <StoricoTab
          appuntamenti={appuntamenti}
          clienteCreatedAt={cliente.created_at}
          onOpenGrafico={() => setShowGraficoGate(true)}
        />
      )}

      {tab === 'carte' && (
        <div className="space-y-5">
          {/* Carte sconto */}
          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 bg-amber-100 rounded-lg flex items-center justify-center">
                <Tag size={14} className="text-amber-600" />
              </div>
              <h3 className="font-semibold text-stone-700">Carte sconto</h3>
              {carteSconto.length > 0 && (
                <span className="text-xs bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full">{carteSconto.length}</span>
              )}
            </div>
            {carteSconto.length === 0 ? (
              <p className="text-sm text-stone-400 text-center py-4">Nessuna carta sconto assegnata</p>
            ) : (
              <div className="space-y-2">
                {carteSconto.map(c => (
                  <div key={c.id} className={`flex items-center justify-between p-3 rounded-xl border ${c.attiva ? 'border-amber-100 bg-amber-50/40' : 'border-stone-100 bg-stone-50 opacity-60'}`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${c.attiva ? 'bg-amber-100' : 'bg-stone-100'}`}>
                        {c.tipo_sconto === 'percentuale'
                          ? <span className={`text-xs font-bold ${c.attiva ? 'text-amber-600' : 'text-stone-400'}`}>%</span>
                          : <span className={`text-xs font-bold ${c.attiva ? 'text-amber-600' : 'text-stone-400'}`}>€</span>}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-mono font-bold text-stone-800">{c.codice}</p>
                          {!c.attiva && <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-semibold">Disattiva</span>}
                          {c.usa_e_getta && <span className="text-[10px] bg-stone-100 text-stone-500 px-1.5 py-0.5 rounded-full font-semibold">Usa e getta</span>}
                        </div>
                        {c.descrizione && <p className="text-xs text-stone-400">{c.descrizione}</p>}
                      </div>
                    </div>
                    <span className={`text-sm font-bold ${c.attiva ? 'text-amber-600' : 'text-stone-400'}`}>
                      {c.tipo_sconto === 'percentuale' ? `${c.valore_sconto}%` : `€${c.valore_sconto.toFixed(2)}`} off
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Carte premium */}
          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 bg-emerald-100 rounded-lg flex items-center justify-center">
                <Star size={14} className="text-emerald-600" />
              </div>
              <h3 className="font-semibold text-stone-700">Carte premium</h3>
              {cartePremium.length > 0 && (
                <span className="text-xs bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full">{cartePremium.length}</span>
              )}
            </div>
            {cartePremium.length === 0 ? (
              <p className="text-sm text-stone-400 text-center py-4">Nessuna carta premium associata</p>
            ) : (
              <div className="space-y-4">
                {cartePremium.map(c => {
                  const saldoBasso = c.saldo < 20 && c.saldo > 0;
                  const saldoEsaurito = c.saldo <= 0;
                  const storicoCarta = ricaricheStorico.filter(r => r.carta_premium_id === c.id);
                  return (
                    <div key={c.id} className={`rounded-xl border overflow-hidden ${!c.attiva ? 'border-stone-100 opacity-60' : saldoEsaurito ? 'border-red-200' : saldoBasso ? 'border-amber-200' : 'border-emerald-200'}`}>
                      {/* Riga principale carta */}
                      <div className={`flex items-center justify-between p-3 ${!c.attiva ? 'bg-stone-50' : saldoEsaurito ? 'bg-red-50/40' : saldoBasso ? 'bg-amber-50/40' : 'bg-emerald-50/40'}`}>
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${!c.attiva ? 'bg-stone-100' : saldoEsaurito ? 'bg-red-100' : 'bg-emerald-100'}`}>
                            <Wallet size={14} className={!c.attiva ? 'text-stone-400' : saldoEsaurito ? 'text-red-500' : 'text-emerald-600'} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-mono font-bold text-stone-800">{c.codice}</p>
                              {!c.attiva && <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-semibold">Disattiva</span>}
                              {saldoEsaurito && c.attiva && <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-semibold">Esaurita</span>}
                              {saldoBasso && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-semibold">Saldo basso</span>}
                            </div>
                            {c.note && <p className="text-xs text-stone-400">{c.note}</p>}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className={`text-base font-bold ${saldoEsaurito ? 'text-red-500' : saldoBasso ? 'text-amber-600' : 'text-emerald-600'}`}>
                              €{c.saldo.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                            <p className="text-[10px] text-stone-400">saldo</p>
                          </div>
                          {c.attiva && (
                            <button
                              onClick={() => setPasswordGatePending(c)}
                              className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                            >
                              <Plus size={11} />
                              Ricarica
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Storico ricariche per questa carta */}
                      {storicoCarta.length > 0 && (
                        <div className="border-t border-stone-100 px-3 py-2">
                          <div className="flex items-center gap-1.5 mb-2">
                            <History size={12} className="text-stone-400" />
                            <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide">Storico ricariche</span>
                          </div>
                          <div className="space-y-1 max-h-36 overflow-y-auto">
                            {storicoCarta.map(r => (
                              <div key={r.id} className="flex items-center justify-between py-1 px-2 rounded-lg hover:bg-stone-50 transition-colors">
                                <div>
                                  <p className="text-xs text-stone-500">
                                    {new Date(r.created_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })}
                                    {' · '}
                                    {new Date(r.created_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                                  </p>
                                  {r.note && <p className="text-[10px] text-stone-400">{r.note}</p>}
                                </div>
                                <span className="text-sm font-bold text-emerald-600">+€{r.importo.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Gift Pass acquistate (da donare) */}
      {giftPassList.length > 0 && (
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: '#fdf0eb' }}>
              <Gift size={14} style={{ color: '#c9897a' }} />
            </div>
            <h3 className="font-semibold text-stone-700">Gift Pass</h3>
            <span className="text-xs bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full">{giftPassList.length}</span>
          </div>
          <div className="space-y-2">
            {giftPassList.map(gp => {
              const valore = gp.tipo === 'prodotto' ? (gp.prodotto_nome ?? 'Prodotto') : `€${gp.valore_euro ?? 0}`;
              const stato = gp.attivata_at ? 'Attivata' : 'Da donare';
              const statoColor = gp.attivata_at ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700';
              return (
                <div key={gp.id} className="flex items-center justify-between p-3 rounded-xl border" style={{ borderColor: '#f2d5c8', background: '#fdf8f5' }}>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#f2d5c8' }}>
                      <Gift size={14} style={{ color: '#c9897a' }} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-mono font-bold text-stone-800">{gp.codice}</p>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${statoColor}`}>{stato}</span>
                      </div>
                      {gp.destinataria_nome && (
                        <p className="text-xs text-stone-400">Per: {gp.destinataria_nome}</p>
                      )}
                    </div>
                  </div>
                  <span className="text-sm font-bold" style={{ color: '#8b4a3a' }}>{valore}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Password gate per grafico servizi */}
      {showGraficoGate && (
        <PasswordGateModal
          titolo="Grafico servizi"
          descrizione="Inserisci la password per visualizzare il grafico dei servizi."
          chiavePassword="password_grafico_servizi"
          onSuccess={() => { setShowGraficoGate(false); setShowGrafico(true); }}
          onClose={() => setShowGraficoGate(false)}
        />
      )}

      {showGrafico && (
        <GraficoServiziModal voci={ficheVoci} onClose={() => setShowGrafico(false)} />
      )}

      {/* Password gate per ricarica */}
      {passwordGatePending && (
        <PasswordGateModal
          titolo="Ricarica carta premium"
          descrizione={`Inserisci la password per ricaricare la carta ${passwordGatePending.codice}.`}
          onSuccess={() => { setRicaricaModal(passwordGatePending); setPasswordGatePending(null); }}
          onClose={() => setPasswordGatePending(null)}
        />
      )}

      {/* Modal ricarica inline */}
      {ricaricaModal && (
        <RicaricaCartaModal
          carta={ricaricaModal}
          onClose={() => setRicaricaModal(null)}
          onSaved={({ importo, prezzoCliente, nuovoSaldo, tipo }) => {
            const carta = ricaricaModal!;
            setRicaricaModal(null);
            load();
            if (tipo === 'standard') {
              setSmsModal({ codice: carta.codice, azione: { tipo: 'ricarica', credito: importo, prezzoClientePagato: prezzoCliente, nuovoSaldo } });
            } else {
              setSmsModal({ codice: carta.codice, azione: { tipo: 'ricarica_gratuita', credito: importo, nuovoSaldo } });
            }
          }}
        />
      )}

      {smsModal && cliente && (
        <SmsCartaModal
          nominativo={`${cliente.nome} ${cliente.cognome}`.trim()}
          codice={smsModal.codice}
          telefono={cliente.telefono ?? ''}
          azione={smsModal.azione}
          onClose={() => setSmsModal(null)}
        />
      )}

      {editCliente && (
        <ClienteModal
          clienteId={clienteId}
          onClose={() => setEditCliente(false)}
          onSaved={() => { setEditCliente(false); load(); }}
        />
      )}

      {schedaModal.open && (
        <SchedaColoreModal
          clienteId={clienteId}
          schedaId={schedaModal.id}
          onClose={() => setSchedaModal({ open: false })}
          onSaved={() => { setSchedaModal({ open: false }); load(); }}
        />
      )}

      {appModal.open && (
        <MultiBookModal
          appuntamentoId={appModal.id}
          dataIniziale={new Date()}
          onClose={() => setAppModal({ open: false })}
          onSaved={() => { setAppModal({ open: false }); load(); }}
        />
      )}

      {/* Tab: Messaggi */}
      {tab === 'messaggi' && (
        <MessaggiTab
          messaggi={messaggi}
          onMarkRead={async (id) => {
            await supabase.from('messaggi_clienti').update({ letto: true }).eq('id', id);
            setMessaggi(prev => prev.map(m => m.id === id ? { ...m, letto: true } : m));
          }}
          onTogglePreferito={async (id, val) => {
            await supabase.from('messaggi_clienti').update({ preferito: val }).eq('id', id);
            setMessaggi(prev => prev.map(m => m.id === id ? { ...m, preferito: val } : m));
          }}
          onInviaRisposta={async (id, testo, fotos) => {
            const now = new Date().toISOString();
            const fotoUrls: (string | null)[] = [null, null, null];
            for (let i = 0; i < Math.min(fotos.length, 3); i++) {
              const file = fotos[i];
              const path = `risposte/${id}_${i}_${Date.now()}`;
              const { data: up } = await supabase.storage.from('foto_clienti').upload(path, file, { upsert: true });
              if (up) {
                const { data: { publicUrl } } = supabase.storage.from('foto_clienti').getPublicUrl(up.path);
                fotoUrls[i] = publicUrl;
              }
            }
            const update = {
              risposta_testo: testo,
              risposta_at: now,
              risposta_foto_url_1: fotoUrls[0],
              risposta_foto_url_2: fotoUrls[1],
              risposta_foto_url_3: fotoUrls[2],
            };
            await supabase.from('messaggi_clienti').update(update).eq('id', id);
            setMessaggi(prev => prev.map(m => m.id === id ? { ...m, ...update } : m));
          }}
          onDelete={(id) => {
            setDeleteTarget('single');
            setDeleteTargetId(id);
            setDeletePasswordInput('');
            setDeletePasswordError('');
          }}
          onDeleteAll={() => {
            setDeleteTarget('all');
            setDeleteTargetId(null);
            setDeletePasswordInput('');
            setDeletePasswordError('');
          }}
          onFotoZoom={setMsgFotoZoom}
        />
      )}

      {/* Lightbox foto messaggio */}
      {msgFotoZoom && (
        <div className="fixed inset-0 z-[200] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setMsgFotoZoom(null)}>
          <button onClick={() => setMsgFotoZoom(null)} className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors">
            <X size={20} className="text-white" />
          </button>
          <img src={msgFotoZoom} className="max-w-full max-h-full rounded-2xl shadow-2xl object-contain" style={{ maxHeight: '90vh', maxWidth: '90vw' }} onClick={e => e.stopPropagation()} />
        </div>
      )}

      {/* Modal conferma eliminazione con password */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setDeleteTarget(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                <Trash2 size={18} className="text-red-500" />
              </div>
              <div>
                <p className="font-bold text-stone-800">Conferma eliminazione</p>
                <p className="text-xs text-stone-400">{deleteTarget === 'all' ? 'Tutti i messaggi di questa cliente' : 'Questo messaggio'}</p>
              </div>
            </div>
            <p className="text-sm text-stone-600 mb-4">Inserisci la password per procedere. L'operazione non è reversibile.</p>
            <input
              type="password"
              value={deletePasswordInput}
              onChange={e => setDeletePasswordInput(e.target.value)}
              placeholder="Password..."
              className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-red-400 mb-2"
              autoFocus
            />
            {deletePasswordError && <p className="text-xs text-red-500 mb-3">{deletePasswordError}</p>}
            <div className="flex gap-3 mt-4">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 py-2.5 rounded-xl border border-stone-200 text-sm font-medium text-stone-600 hover:bg-stone-50 transition-colors">Annulla</button>
              <button
                onClick={async () => {
                  const pwd = await getImpostazione('password_messaggi_clienti');
                  const correct = pwd || '1234';
                  if (deletePasswordInput !== correct) {
                    setDeletePasswordError('Password non corretta');
                    return;
                  }
                  if (deleteTarget === 'single' && deleteTargetId) {
                    await supabase.from('messaggi_clienti').delete().eq('id', deleteTargetId);
                    setMessaggi(prev => prev.filter(m => m.id !== deleteTargetId));
                  } else if (deleteTarget === 'all') {
                    await supabase.from('messaggi_clienti').delete().eq('cliente_id', clienteId);
                    setMessaggi([]);
                  }
                  setDeleteTarget(null);
                }}
                className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors"
              >
                Elimina
              </button>
            </div>
          </div>
        </div>
      )}

      {fotoZoom && (() => {
        const fotoSrc = ((cliente as Record<string, unknown>).foto_base64 as string) || cliente.foto_url;
        return (
          <div
            className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setFotoZoom(false)}
          >
            <button
              onClick={() => setFotoZoom(false)}
              className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            >
              <X size={20} className="text-white" />
            </button>
            <img
              src={fotoSrc!}
              alt={`${cliente.nome} ${cliente.cognome}`}
              className="max-w-full max-h-full rounded-2xl shadow-2xl object-contain"
              style={{ maxHeight: '90vh', maxWidth: '90vw' }}
              onClick={e => e.stopPropagation()}
            />
          </div>
        );
      })()}
    </div>
  );
}

function MessaggiTab({ messaggi, onMarkRead, onTogglePreferito, onInviaRisposta, onDelete, onDeleteAll, onFotoZoom }: {
  messaggi: MessaggioCliente[];
  onMarkRead: (id: string) => void;
  onTogglePreferito: (id: string, val: boolean) => void;
  onInviaRisposta: (id: string, testo: string, fotos: File[]) => Promise<void>;
  onDelete: (id: string) => void;
  onDeleteAll: () => void;
  onFotoZoom: (url: string) => void;
}) {
  const [aperti, setAperti] = useState<Set<string>>(new Set());
  const [rispostaAperta, setRispostaAperta] = useState<string | null>(null);
  const [testiRisposta, setTestiRisposta] = useState<Record<string, string>>({});
  const [fotoRispostaFiles, setFotoRispostaFiles] = useState<Record<string, File[]>>({});
  const [fotoRispostaPreviews, setFotoRispostaPreviews] = useState<Record<string, string[]>>({});
  const fotoInputRef = useRef<HTMLInputElement>(null);
  const [loadingPos, setLoadingPos] = useState(false);
  const [salvandoRisposta, setSalvandoRisposta] = useState<string | null>(null);
  const [soloPreferiti, setSoloPreferiti] = useState(false);

  function toggleMessaggio(m: MessaggioCliente) {
    setAperti(prev => {
      const next = new Set(prev);
      if (next.has(m.id)) { next.delete(m.id); }
      else {
        next.add(m.id);
        if (!m.letto) onMarkRead(m.id);
      }
      return next;
    });
  }

  function formatTel(telefono: string) {
    const tel = telefono.replace(/\D/g, '');
    return tel.startsWith('0') ? `39${tel.slice(1)}` : tel.startsWith('39') ? tel : `39${tel}`;
  }

  function apriWhatsApp(telefono: string, testo: string) {
    apriWA(telefono, testo);
  }

  function inviaPosizioneWhatsApp(telefono: string) {
    if (!navigator.geolocation) return;
    setLoadingPos(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLoadingPos(false);
        const { latitude, longitude } = pos.coords;
        const testo = `https://maps.google.com/?q=${latitude},${longitude}`;
        apriWhatsApp(telefono, testo);
      },
      () => {
        setLoadingPos(false);
        alert('Impossibile ottenere la posizione. Controlla i permessi del browser.');
      },
      { timeout: 10000 }
    );
  }

  if (messaggi.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-10 text-center">
        <div className="w-14 h-14 bg-stone-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <MessageCircle size={24} className="text-stone-300" />
        </div>
        <p className="font-semibold text-stone-500">Nessun messaggio</p>
        <p className="text-sm text-stone-400 mt-1">Questa cliente non ha ancora inviato messaggi dal portale.</p>
      </div>
    );
  }

  const msgFiltrati = soloPreferiti ? messaggi.filter(m => m.preferito) : messaggi;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => setSoloPreferiti(v => !v)}
          className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
            soloPreferiti
              ? 'bg-amber-50 border-amber-300 text-amber-700'
              : 'border-stone-200 text-stone-500 hover:border-amber-300 hover:text-amber-600 hover:bg-amber-50'
          }`}
        >
          <Star size={12} className={soloPreferiti ? 'fill-amber-400 text-amber-400' : ''} />
          {soloPreferiti ? 'Tutti i messaggi' : 'Solo preferiti'}
        </button>
        <button
          onClick={onDeleteAll}
          className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 border border-red-200 rounded-lg px-3 py-1.5 hover:bg-red-50 transition-colors"
        >
          <Trash2 size={12} /> Elimina tutti i messaggi
        </button>
      </div>

      {soloPreferiti && msgFiltrati.length === 0 && (
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-8 text-center">
          <Star size={24} className="text-stone-300 mx-auto mb-3" />
          <p className="text-sm text-stone-400">Nessun messaggio preferito</p>
        </div>
      )}

      {msgFiltrati.map(m => (
        <div
          key={m.id}
          className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${m.letto ? 'border-stone-200' : 'border-sky-300 bg-sky-50/30'}`}
        >
          {/* Header messaggio – cliccabile per aprire */}
          <button
            onClick={() => toggleMessaggio(m)}
            className="w-full flex items-center justify-between gap-3 px-5 py-4 hover:bg-stone-50 transition-colors text-left"
          >
            <div className="flex items-center gap-2 min-w-0">
              {!m.letto && <span className="w-2 h-2 rounded-full bg-sky-500 flex-shrink-0" />}
              <div className="min-w-0">
                <span className="text-xs font-semibold text-stone-600">{m.nome} {m.cognome}</span>
                {m.telefono && <span className="text-xs text-stone-400 ml-2">· {m.telefono}</span>}
                <span className="text-[10px] text-stone-400 ml-2">
                  {new Date(m.created_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {!aperti.has(m.id) && [m.foto_url_1, m.foto_url_2, m.foto_url_3].filter(Boolean).length > 0 && (
                <div className="flex items-center gap-1">
                  {[m.foto_url_1, m.foto_url_2, m.foto_url_3].filter(Boolean).map((url, i) => (
                    <img key={i} src={url} className="w-7 h-7 rounded-md object-cover border border-stone-200 flex-shrink-0" />
                  ))}
                </div>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); onTogglePreferito(m.id, !m.preferito); }}
                className="p-1.5 rounded-lg transition-colors hover:bg-amber-50"
                title={m.preferito ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti'}
              >
                <Star size={14} className={m.preferito ? 'fill-amber-400 text-amber-400' : 'text-stone-300 hover:text-amber-400'} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(m.id); }}
                className="p-1.5 text-stone-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              >
                <Trash2 size={14} />
              </button>
              <ChevronDown size={15} className={`text-stone-400 transition-transform duration-200 ${aperti.has(m.id) ? 'rotate-180' : ''}`} />
            </div>
          </button>

          {/* Corpo messaggio – visibile solo se aperto */}
          {aperti.has(m.id) && (
          <div className="px-5 pb-5 border-t border-stone-100">
            {m.testo && (
              <p className="text-sm text-stone-700 leading-relaxed mt-4 mb-4 bg-stone-50 rounded-xl px-4 py-3">{m.testo}</p>
            )}

            {(m.foto_url_1 || m.foto_url_2 || m.foto_url_3) && (
              <div className="flex gap-3 flex-wrap mb-4">
                {[m.foto_url_1, m.foto_url_2, m.foto_url_3].filter(Boolean).map((url, i) => (
                  <button
                    key={i}
                    onClick={() => onFotoZoom(url)}
                    className="w-24 h-24 rounded-xl overflow-hidden border border-stone-200 flex-shrink-0 hover:border-sky-400 transition-colors group relative"
                  >
                    <img src={url} className="w-full h-full object-cover" alt={`foto ${i+1}`} />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
                      <Image size={18} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Risposta già inviata */}
            {(m.risposta_testo || m.risposta_foto_url_1) && rispostaAperta !== m.id && (
              <div className="mt-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1.5">
                    <Send size={11} /> Risposta inviata
                  </span>
                  {m.risposta_at && (
                    <span className="text-[10px] text-emerald-500">
                      {new Date(m.risposta_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
                {m.risposta_testo && (
                  <p className="text-sm text-emerald-800 leading-relaxed mb-2">{m.risposta_testo}</p>
                )}
                {[m.risposta_foto_url_1, m.risposta_foto_url_2, m.risposta_foto_url_3].some(Boolean) && (
                  <div className="flex gap-2 flex-wrap">
                    {[m.risposta_foto_url_1, m.risposta_foto_url_2, m.risposta_foto_url_3].filter(Boolean).map((url, i) => (
                      <button key={i} onClick={() => onFotoZoom(url!)} className="w-14 h-14 rounded-lg overflow-hidden border border-emerald-200 hover:border-emerald-400 transition-colors flex-shrink-0">
                        <img src={url!} className="w-full h-full object-cover" alt={`risposta foto ${i+1}`} />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Pulsante Rispondi */}
            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={() => {
                  const isOpen = rispostaAperta === m.id;
                  setRispostaAperta(isOpen ? null : m.id);
                  if (!isOpen) {
                    setTestiRisposta(prev => ({ ...prev, [m.id]: m.risposta_testo ?? '' }));
                  }
                }}
                className={`flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-xl border transition-all ${
                  rispostaAperta === m.id
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                    : 'border-stone-200 text-stone-600 hover:border-emerald-300 hover:text-emerald-600 hover:bg-emerald-50'
                }`}
              >
                {rispostaAperta === m.id ? <ChevronUp size={15} /> : <Send size={15} />}
                {rispostaAperta === m.id ? 'Chiudi' : m.risposta_testo ? 'Modifica risposta' : 'Rispondi'}
              </button>
            </div>

          {/* Pannello risposta */}
          {rispostaAperta === m.id && (
            <div className="mt-3 border border-stone-200 rounded-2xl overflow-hidden">
              {/* Header */}
              <div className="bg-stone-50 border-b border-stone-200 px-4 py-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-emerald-700 text-sm font-bold">{m.nome?.[0]?.toUpperCase() ?? '?'}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-stone-700 truncate">{m.nome} {m.cognome}</p>
                  {m.telefono
                    ? <p className="text-xs text-stone-400 truncate">{m.telefono}</p>
                    : <p className="text-xs text-amber-500">Nessun numero disponibile</p>
                  }
                </div>
              </div>

              {/* Textarea */}
              <div className="px-4 pt-3 pb-2">
                <textarea
                  value={testiRisposta[m.id] ?? ''}
                  onChange={e => setTestiRisposta(prev => ({ ...prev, [m.id]: e.target.value }))}
                  placeholder="Scrivi la tua risposta..."
                  rows={3}
                  style={{ maxHeight: '160px' }}
                  className="w-full text-sm text-stone-800 placeholder:text-stone-300 focus:outline-none bg-transparent resize-none leading-relaxed"
                  autoFocus
                />
              </div>

              {/* Foto risposta */}
              <div className="px-4 pb-3">
                <div className="flex gap-2 flex-wrap">
                  {(fotoRispostaPreviews[m.id] ?? []).map((prev, i) => (
                    <div key={i} className="relative w-16 h-16 rounded-xl overflow-hidden border border-stone-200 flex-shrink-0">
                      <img src={prev} className="w-full h-full object-cover" alt={`foto ${i+1}`} />
                      <button
                        onClick={() => {
                          URL.revokeObjectURL(prev);
                          setFotoRispostaFiles(s => ({ ...s, [m.id]: (s[m.id] ?? []).filter((_, idx) => idx !== i) }));
                          setFotoRispostaPreviews(s => ({ ...s, [m.id]: (s[m.id] ?? []).filter((_, idx) => idx !== i) }));
                        }}
                        className="absolute top-0.5 right-0.5 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center"
                      >
                        <X size={9} />
                      </button>
                    </div>
                  ))}
                  {(fotoRispostaPreviews[m.id] ?? []).length < 3 && (
                    <button
                      onClick={() => fotoInputRef.current?.click()}
                      className="w-16 h-16 rounded-xl border-2 border-dashed border-stone-300 flex flex-col items-center justify-center gap-1 text-stone-400 hover:border-emerald-400 hover:text-emerald-500 hover:bg-emerald-50 transition-all flex-shrink-0"
                    >
                      <Image size={16} />
                      <span className="text-[9px] font-semibold">Foto</span>
                    </button>
                  )}
                  <input
                    ref={fotoInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={e => {
                      const files = Array.from(e.target.files ?? []);
                      if (!files.length) return;
                      const existing = fotoRispostaPreviews[m.id] ?? [];
                      const remaining = 3 - existing.length;
                      const toAdd = files.slice(0, remaining);
                      setFotoRispostaFiles(s => ({ ...s, [m.id]: [...(s[m.id] ?? []), ...toAdd] }));
                      setFotoRispostaPreviews(s => ({ ...s, [m.id]: [...(s[m.id] ?? []), ...toAdd.map(f => URL.createObjectURL(f))] }));
                      e.target.value = '';
                    }}
                  />
                </div>
              </div>

              {/* Azioni */}
              <div className="px-4 pb-3 flex items-center gap-2 flex-wrap border-t border-stone-100 pt-3">
                {/* Primario: salva nel gestionale */}
                <button
                  onClick={async () => {
                    const testo = (testiRisposta[m.id] ?? '').trim();
                    const fotos = fotoRispostaFiles[m.id] ?? [];
                    if (!testo && fotos.length === 0) return;
                    setSalvandoRisposta(m.id);
                    await onInviaRisposta(m.id, testo, fotos);
                    setSalvandoRisposta(null);
                    setRispostaAperta(null);
                    // Cleanup previews
                    (fotoRispostaPreviews[m.id] ?? []).forEach(u => URL.revokeObjectURL(u));
                    setFotoRispostaFiles(s => ({ ...s, [m.id]: [] }));
                    setFotoRispostaPreviews(s => ({ ...s, [m.id]: [] }));
                  }}
                  disabled={(!(testiRisposta[m.id] ?? '').trim() && (fotoRispostaFiles[m.id] ?? []).length === 0) || salvandoRisposta === m.id}
                  className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {salvandoRisposta === m.id
                    ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    : <Send size={14} />
                  }
                  Salva risposta
                </button>

                {/* Secondario: apri WhatsApp */}
                <button
                  onClick={() => {
                    if (!m.telefono) return;
                    apriWhatsApp(m.telefono, testiRisposta[m.id] ?? '');
                  }}
                  disabled={!m.telefono || !(testiRisposta[m.id] ?? '').trim()}
                  className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 border border-[#25D366] text-[#128C7E] rounded-xl hover:bg-[#f0fdf4] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  title={m.telefono ? '' : 'Nessun numero disponibile'}
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-[#25D366]" xmlns="http://www.w3.org/2000/svg">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  Apri WhatsApp
                </button>

                {/* Invia posizione (solo WA) */}
                {m.telefono && (
                  <button
                    onClick={() => inviaPosizioneWhatsApp(m.telefono)}
                    disabled={loadingPos}
                    className="flex items-center gap-1 text-xs text-stone-400 hover:text-stone-600 disabled:opacity-50 transition-colors ml-auto"
                  >
                    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                    </svg>
                    {loadingPos ? 'Ricerca...' : 'Invia posizione WA'}
                  </button>
                )}
              </div>
            </div>
          )}
          </div>
          )}
        </div>

      ))}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-0.5">{label}</p>
      <p className="text-sm text-stone-700">{value}</p>
    </div>
  );
}

function StoricoTab({ appuntamenti, clienteCreatedAt, onOpenGrafico }: { appuntamenti: Appuntamento[]; clienteCreatedAt: string; onOpenGrafico: () => void }) {
  type AppExt = Appuntamento & { appuntamento_trattamenti?: { nome_trattamento: string; prezzo: number }[] };

  const tutti = appuntamenti as AppExt[];
  const completati = tutti.filter(a => a.stato !== 'cancellato');
  const now = new Date();

  // Raggruppa per giorno (YYYY-MM-DD) — accorpa appuntamenti dello stesso giorno (tutti, inclusi cancellati)
  const perGiorno: Record<string, AppExt[]> = {};
  for (const a of tutti) {
    const d = new Date(a.data_ora);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (!perGiorno[key]) perGiorno[key] = [];
    perGiorno[key].push(a);
  }

  // Giorni con almeno un appuntamento non cancellato (per statistiche visite)
  const giorniUnici = Object.keys(perGiorno).filter(k => perGiorno[k].some(a => a.stato !== 'cancellato'));
  // Tutti i giorni (inclusi solo-cancellati) per la timeline
  const tuttiGiorni = Object.keys(perGiorno);
  const nGiorni = giorniUnici.length;

  // Giorni-cancellazione: giorni in cui TUTTI gli appuntamenti sono cancellati
  const giorniCancellati = tuttiGiorni.filter(k => perGiorno[k].every(a => a.stato === 'cancellato'));

  // Cancellazioni anno solare corrente (1 gen – oggi)
  const annoCorrente = now.getFullYear();
  const nCancellazioniAnno = giorniCancellati.filter(k => Number(k.split('-')[0]) === annoCorrente).length;

  // Cancellazioni per anno solare (per il pannello dettaglio)
  const cancellazioniPerAnno: Record<number, string[]> = {};
  for (const dayKey of giorniCancellati) {
    const anno = Number(dayKey.split('-')[0]);
    if (!cancellazioniPerAnno[anno]) cancellazioniPerAnno[anno] = [];
    cancellazioniPerAnno[anno].push(dayKey);
  }
  const anniConCancellazioni = Object.keys(cancellazioniPerAnno).map(Number).sort((a, b) => b - a);

  const [showCancellazioni, setShowCancellazioni] = useState(false);
  const [annoAperto, setAnnoAperto] = useState<number | null>(annoCorrente);
  const [showVisite, setShowVisite] = useState(false);
  const [annoApertoVisite, setAnnoApertoVisite] = useState<number | null>(annoCorrente);
  const [showFrequenza, setShowFrequenza] = useState(false);
  const [annoApertoFrequenza, setAnnoApertoFrequenza] = useState<number | null>(annoCorrente);
  const [showSpesa, setShowSpesa] = useState(false);
  const [annoApertoSpesa, setAnnoApertoSpesa] = useState<number | null>(annoCorrente);
  const [showMedia, setShowMedia] = useState(false);
  const [annoApertoMedia, setAnnoApertoMedia] = useState<number | null>(annoCorrente);

  // Dati per anno solare: visite (giorni unici), spesa, frequenza mensile
  const visitiPerAnno: Record<number, string[]> = {};
  for (const dayKey of giorniUnici) {
    const anno = Number(dayKey.split('-')[0]);
    if (!visitiPerAnno[anno]) visitiPerAnno[anno] = [];
    visitiPerAnno[anno].push(dayKey);
  }
  const anniVisite = Object.keys(visitiPerAnno).map(Number).sort((a, b) => b - a);

  // Spesa per anno solare (solo completati/confermati)
  const spesaPerAnno: Record<number, number> = {};
  for (const a of completati) {
    const anno = new Date(a.data_ora).getFullYear();
    spesaPerAnno[anno] = (spesaPerAnno[anno] || 0) + (a.prezzo_totale || 0);
  }

  // Media fiches per anno (spesa / visite di quel anno)
  const mediaFichePerAnno: Record<number, number> = {};
  for (const anno of anniVisite) {
    const visite = (visitiPerAnno[anno] || []).length;
    const spesa = spesaPerAnno[anno] || 0;
    mediaFichePerAnno[anno] = visite > 0 ? spesa / visite : 0;
  }

  // Valori anno corrente per le card
  const visiteAnnoCorrente = (visitiPerAnno[annoCorrente] || []).length;
  const spesaAnnoCorrente = spesaPerAnno[annoCorrente] || 0;
  const mesiPassatiAnnoCorrente = now.getMonth() + 1;
  const freqAnnoCorrente = visiteAnnoCorrente / mesiPassatiAnnoCorrente;
  const mediaFicheAnnoCorrente = mediaFichePerAnno[annoCorrente] || 0;
  const startOfYear = new Date(annoCorrente, 0, 1);
  const settimanePassate = Math.max(1, Math.ceil((now.getTime() - startOfYear.getTime()) / (7 * 24 * 60 * 60 * 1000)));
  const freqSettimanaleAnnoCorrente = visiteAnnoCorrente / settimanePassate;

  // Conteggio giorni unici per mese per bar chart
  const conteggioMesi: Record<string, number> = {};
  for (const dayKey of giorniUnici) {
    const [y, m] = dayKey.split('-');
    const meseKey = new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
    conteggioMesi[meseKey] = (conteggioMesi[meseKey] || 0) + 1;
  }

  // Frequenza mensile (giorni unici ultimi 12 mesi / 12)
  const twelveMonthsAgo = new Date(now);
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
  const giorniUltimi12 = giorniUnici.filter(k => new Date(k) >= twelveMonthsAgo).length;
  const freqMensile = giorniUltimi12 / 12;

  // Spesa totale (somma tutti gli appuntamenti, non i giorni)
  const spesaTotale = completati.reduce((s, a) => s + (a.prezzo_totale || 0), 0);
  const mediaFicheTotale = nGiorni > 0 ? spesaTotale / nGiorni : 0;
  const spesaMediaGiorno = nGiorni > 0 ? spesaTotale / nGiorni : 0;

  // Intervallo medio tra giorni di visita
  let intervallioMedio: number | null = null;
  if (nGiorni >= 2) {
    const sorted = giorniUnici.sort();
    let totalDays = 0;
    for (let i = 1; i < sorted.length; i++) {
      totalDays += (new Date(sorted[i]).getTime() - new Date(sorted[i - 1]).getTime()) / (1000 * 60 * 60 * 24);
    }
    intervallioMedio = totalDays / (sorted.length - 1);
  }

  // Raggruppa giorni per mese per la timeline (tutti, inclusi cancellati)
  const perMese: Record<string, string[]> = {};
  for (const dayKey of tuttiGiorni) {
    const [y, m] = dayKey.split('-');
    const meseKey = new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
    if (!perMese[meseKey]) perMese[meseKey] = [];
    perMese[meseKey].push(dayKey);
  }

  const mesiOrdinati = Object.keys(perMese).sort((a, b) => {
    return new Date(perMese[b][0]).getTime() - new Date(perMese[a][0]).getTime();
  });

  // Bar chart (ultimi 12 mesi, per giorni unici)
  const barMesi: { label: string; count: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now);
    d.setMonth(d.getMonth() - i);
    const label = d.toLocaleDateString('it-IT', { month: 'short' });
    const key = d.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
    barMesi.push({ label, count: conteggioMesi[key] || 0 });
  }
  const maxBar = Math.max(...barMesi.map(b => b.count), 1);

  if (tutti.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-stone-200 p-10 text-center text-stone-400 text-sm">
        Nessun appuntamento nello storico
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Stats cards + bottone grafico */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <button className="text-left w-full" onClick={() => setShowVisite(true)}>
          <StatCard label="Visite totali" value={String(visiteAnnoCorrente)} sub={`${annoCorrente} · clicca per storico`} clickable />
        </button>
        <button className="text-left w-full" onClick={() => setShowFrequenza(true)}>
          <StatCard label="Frequenza mensile" value={freqAnnoCorrente.toFixed(1)} desc="quante volte viene in un mese" sub={`${annoCorrente} · clicca per storico`} highlight clickable />
        </button>
        <div>
          <StatCard label="Frequenza settimanale" value={freqSettimanaleAnnoCorrente.toFixed(1)} desc="quante volte viene a settimana" sub={`${annoCorrente}`} />
        </div>
        <button className="text-left w-full" onClick={() => setShowSpesa(true)}>
          <StatCard label="Spesa totale" value={`€${spesaAnnoCorrente.toFixed(0)}`} sub={`${annoCorrente} · clicca per storico`} clickable />
        </button>
        <button className="text-left w-full" onClick={() => setShowMedia(true)}>
          <StatCard label="Media fiches" value={`€${mediaFicheAnnoCorrente.toFixed(0)}`} sub={`${annoCorrente} · clicca per storico`} clickable />
        </button>
        <button className="text-left w-full" onClick={() => setShowCancellazioni(true)}>
          <StatCard
            label="Cancellazioni"
            value={String(nCancellazioniAnno)}
            sub={`anno ${annoCorrente}${giorniCancellati.length > 0 ? ' · clicca per storico' : ''}`}
            warn={nCancellazioniAnno > 0}
            clickable
          />
        </button>
      </div>

      {/* Bottone grafico servizi protetto da password */}
      <div className="flex justify-end">
        <button
          onClick={onOpenGrafico}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-stone-200 bg-white text-sm font-medium text-stone-600 hover:bg-stone-50 hover:border-stone-300 shadow-sm transition-all"
        >
          <BarChart2 size={15} className="text-emerald-500" />
          Grafico servizi
          <Lock size={12} className="text-stone-400 ml-0.5" />
        </button>
      </div>

      {/* Pannello visite per anno */}
      {showVisite && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4" onClick={() => setShowVisite(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100">
              <h3 className="font-bold text-stone-800">Visite per anno</h3>
              <button onClick={() => setShowVisite(false)} className="text-stone-400 hover:text-stone-700 transition-colors"><X size={18} /></button>
            </div>
            <div className="overflow-auto flex-1 px-5 py-4 space-y-2">
              {anniVisite.length === 0 ? (
                <p className="text-sm text-stone-400 text-center py-6">Nessuna visita registrata</p>
              ) : (
              <>
              {/* Totale di sempre */}
              <div className="rounded-xl border-2 border-stone-300 bg-stone-50 overflow-hidden mb-1">
                <button className="w-full flex items-center justify-between px-4 py-3 hover:bg-stone-100 transition-colors" onClick={() => setAnnoApertoVisite(annoApertoVisite === -1 ? null : -1)}>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-stone-700">Tutti gli anni</span>
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-stone-200 text-stone-600">
                      {nGiorni} {nGiorni === 1 ? 'visita' : 'visite'} totali
                    </span>
                  </div>
                  <ChevronDown size={15} className={`text-stone-400 transition-transform ${annoApertoVisite === -1 ? 'rotate-180' : ''}`} />
                </button>
                {annoApertoVisite === -1 && (
                  <div className="border-t border-stone-200 divide-y divide-stone-100">
                    {giorniUnici.slice().sort((a, b) => b.localeCompare(a)).map(dayKey => {
                      const apps = perGiorno[dayKey].filter(a => a.stato !== 'cancellato');
                      const trattamenti: string[] = [];
                      for (const a of apps) for (const t of (a.appuntamento_trattamenti || [])) trattamenti.push(t.nome_trattamento);
                      const prezzo = apps.reduce((s, a) => s + (a.prezzo_totale || 0), 0);
                      return (
                        <div key={dayKey} className="px-4 py-2.5 flex items-start gap-3">
                          <div className="w-1.5 h-1.5 rounded-full bg-stone-400 mt-1.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-medium text-stone-700">
                                {new Date(dayKey).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}
                              </p>
                              {prezzo > 0 && <span className="text-xs font-semibold text-stone-500 flex-shrink-0">€{prezzo.toFixed(0)}</span>}
                            </div>
                            {trattamenti.length > 0 && <p className="text-xs text-stone-400 mt-0.5">{trattamenti.join(' · ')}</p>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              {anniVisite.map(anno => {
                const giorni = visitiPerAnno[anno].sort((a, b) => b.localeCompare(a));
                const isOpen = annoApertoVisite === anno;
                return (
                  <div key={anno} className="rounded-xl border border-stone-200 overflow-hidden">
                    <button className="w-full flex items-center justify-between px-4 py-3 hover:bg-stone-50 transition-colors" onClick={() => setAnnoApertoVisite(isOpen ? null : anno)}>
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-stone-800">{anno}</span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${anno === annoCorrente ? 'bg-amber-100 text-amber-700' : 'bg-stone-100 text-stone-500'}`}>
                          {giorni.length} {giorni.length === 1 ? 'visita' : 'visite'}
                        </span>
                      </div>
                      <ChevronDown size={15} className={`text-stone-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {isOpen && (
                      <div className="border-t border-stone-100 divide-y divide-stone-50">
                        {giorni.map(dayKey => {
                          const apps = perGiorno[dayKey].filter(a => a.stato !== 'cancellato');
                          const trattamenti: string[] = [];
                          for (const a of apps) for (const t of (a.appuntamento_trattamenti || [])) trattamenti.push(t.nome_trattamento);
                          const prezzo = apps.reduce((s, a) => s + (a.prezzo_totale || 0), 0);
                          return (
                            <div key={dayKey} className="px-4 py-2.5 flex items-start gap-3">
                              <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-sm font-medium text-stone-700">
                                    {new Date(dayKey).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'long' })}
                                  </p>
                                  {prezzo > 0 && <span className="text-xs font-semibold text-stone-500 flex-shrink-0">€{prezzo.toFixed(0)}</span>}
                                </div>
                                {trattamenti.length > 0 && <p className="text-xs text-stone-400 mt-0.5">{trattamenti.join(' · ')}</p>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
              </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Pannello frequenza per anno */}
      {showFrequenza && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4" onClick={() => setShowFrequenza(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100">
              <h3 className="font-bold text-stone-800">Frequenza per anno</h3>
              <button onClick={() => setShowFrequenza(false)} className="text-stone-400 hover:text-stone-700 transition-colors"><X size={18} /></button>
            </div>
            <div className="overflow-auto flex-1 px-5 py-4 space-y-2">
              {anniVisite.length === 0 ? (
                <p className="text-sm text-stone-400 text-center py-6">Nessuna visita registrata</p>
              ) : (
              <>
              {/* Totale di sempre */}
              <div className="rounded-xl border-2 border-stone-300 bg-stone-50 overflow-hidden mb-1">
                <button className="w-full flex items-center justify-between px-4 py-3 hover:bg-stone-100 transition-colors" onClick={() => setAnnoApertoFrequenza(annoApertoFrequenza === -1 ? null : -1)}>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-stone-700">Tutti gli anni</span>
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-stone-200 text-stone-600">
                      {freqMensile.toFixed(1)} visite/mese (media)
                    </span>
                  </div>
                  <ChevronDown size={15} className={`text-stone-400 transition-transform ${annoApertoFrequenza === -1 ? 'rotate-180' : ''}`} />
                </button>
                {annoApertoFrequenza === -1 && (
                  <div className="border-t border-stone-200 px-4 py-3">
                    <div className="flex items-end gap-1 h-16">
                      {anniVisite.slice().reverse().map(anno => {
                        const g = visitiPerAnno[anno] || [];
                        const mA = anno === annoCorrente ? (now.getMonth() + 1) : 12;
                        const f = g.length / mA;
                        const maxF = Math.max(...anniVisite.map(a => (visitiPerAnno[a] || []).length / (a === annoCorrente ? (now.getMonth() + 1) : 12)), 1);
                        return (
                          <div key={anno} className="flex-1 flex flex-col items-center gap-0.5">
                            <div className="w-full rounded-t-sm" style={{ height: `${Math.max((f / maxF) * 48, f > 0 ? 6 : 0)}px`, backgroundColor: anno === annoCorrente ? '#f59e0b' : '#d1d5db' }} />
                            <span className="text-[8px] text-stone-400 leading-none">{anno}</span>
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-xs text-stone-400 mt-2 text-center">{nGiorni} visite totali · {anniVisite.length} anni</p>
                  </div>
                )}
              </div>
              {anniVisite.map(anno => {
                const giorni = visitiPerAnno[anno];
                const mesiAnno = anno === annoCorrente ? (now.getMonth() + 1) : 12;
                const freq = giorni.length / mesiAnno;
                // Distribuzione mese per mese
                const perMeseAnno: Record<number, number> = {};
                for (const d of giorni) { const m = Number(d.split('-')[1]); perMeseAnno[m] = (perMeseAnno[m] || 0) + 1; }
                const isOpen = annoApertoFrequenza === anno;
                return (
                  <div key={anno} className="rounded-xl border border-stone-200 overflow-hidden">
                    <button className="w-full flex items-center justify-between px-4 py-3 hover:bg-amber-50 transition-colors" onClick={() => setAnnoApertoFrequenza(isOpen ? null : anno)}>
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-stone-800">{anno}</span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${anno === annoCorrente ? 'bg-amber-100 text-amber-700' : 'bg-stone-100 text-stone-500'}`}>
                          {freq.toFixed(1)} visite/mese
                        </span>
                      </div>
                      <ChevronDown size={15} className={`text-stone-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {isOpen && (
                      <div className="border-t border-stone-100 px-4 py-3">
                        <div className="flex items-end gap-1 h-16">
                          {Array.from({ length: mesiAnno }, (_, i) => {
                            const m = i + 1;
                            const cnt = perMeseAnno[m] || 0;
                            const maxM = Math.max(...Object.values(perMeseAnno), 1);
                            const label = new Date(anno, i, 1).toLocaleDateString('it-IT', { month: 'short' });
                            return (
                              <div key={m} className="flex-1 flex flex-col items-center gap-0.5">
                                <div className="w-full rounded-t-sm transition-all" style={{ height: `${Math.max((cnt / maxM) * 48, cnt > 0 ? 6 : 0)}px`, backgroundColor: cnt > 0 ? '#f59e0b' : '#f5f5f4' }} />
                                <span className="text-[8px] text-stone-400 leading-none">{label}</span>
                              </div>
                            );
                          })}
                        </div>
                        <p className="text-xs text-stone-400 mt-2 text-center">{giorni.length} visite in {mesiAnno} mesi</p>
                      </div>
                    )}
                  </div>
                );
              })}
              </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Pannello spesa per anno */}
      {showSpesa && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4" onClick={() => setShowSpesa(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100">
              <h3 className="font-bold text-stone-800">Spesa per anno</h3>
              <button onClick={() => setShowSpesa(false)} className="text-stone-400 hover:text-stone-700 transition-colors"><X size={18} /></button>
            </div>
            <div className="overflow-auto flex-1 px-5 py-4 space-y-2">
              {anniVisite.length === 0 ? (
                <p className="text-sm text-stone-400 text-center py-6">Nessuna spesa registrata</p>
              ) : (
              <>
              {/* Totale di sempre */}
              <div className="rounded-xl border-2 border-stone-300 bg-stone-50 overflow-hidden mb-1">
                <button className="w-full flex items-center justify-between px-4 py-3 hover:bg-stone-100 transition-colors" onClick={() => setAnnoApertoSpesa(annoApertoSpesa === -1 ? null : -1)}>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-stone-700">Tutti gli anni</span>
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-stone-200 text-stone-600">
                      €{spesaTotale.toFixed(0)} totali
                    </span>
                  </div>
                  <ChevronDown size={15} className={`text-stone-400 transition-transform ${annoApertoSpesa === -1 ? 'rotate-180' : ''}`} />
                </button>
                {annoApertoSpesa === -1 && (
                  <div className="border-t border-stone-200 px-4 py-3 space-y-3">
                    <div className="flex items-end gap-1 h-16">
                      {anniVisite.slice().reverse().map(anno => {
                        const s = spesaPerAnno[anno] || 0;
                        const maxS = Math.max(...anniVisite.map(a => spesaPerAnno[a] || 0), 1);
                        return (
                          <div key={anno} className="flex-1 flex flex-col items-center gap-0.5">
                            <div className="w-full rounded-t-sm" style={{ height: `${Math.max((s / maxS) * 48, s > 0 ? 6 : 0)}px`, backgroundColor: anno === annoCorrente ? '#10b981' : '#d1d5db' }} />
                            <span className="text-[8px] text-stone-400 leading-none">{anno}</span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex justify-between text-xs text-stone-500 pt-1 border-t border-stone-50">
                      <span>{nGiorni} visite totali</span>
                      <span>media €{spesaMediaGiorno.toFixed(0)}/visita</span>
                    </div>
                  </div>
                )}
              </div>
              {anniVisite.map(anno => {
                const spesa = spesaPerAnno[anno] || 0;
                const giorni = visitiPerAnno[anno] || [];
                const mediaVisita = giorni.length > 0 ? spesa / giorni.length : 0;
                const isOpen = annoApertoSpesa === anno;
                // Spesa per mese
                const spesaMese: Record<number, number> = {};
                for (const a of completati) {
                  if (new Date(a.data_ora).getFullYear() === anno) {
                    const m = new Date(a.data_ora).getMonth() + 1;
                    spesaMese[m] = (spesaMese[m] || 0) + (a.prezzo_totale || 0);
                  }
                }
                const mesiAnno = anno === annoCorrente ? (now.getMonth() + 1) : 12;
                return (
                  <div key={anno} className="rounded-xl border border-stone-200 overflow-hidden">
                    <button className="w-full flex items-center justify-between px-4 py-3 hover:bg-stone-50 transition-colors" onClick={() => setAnnoApertoSpesa(isOpen ? null : anno)}>
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-stone-800">{anno}</span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${anno === annoCorrente ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-100 text-stone-500'}`}>
                          €{spesa.toFixed(0)}
                        </span>
                      </div>
                      <ChevronDown size={15} className={`text-stone-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {isOpen && (
                      <div className="border-t border-stone-100 px-4 py-3 space-y-3">
                        <div className="flex items-end gap-1 h-16">
                          {Array.from({ length: mesiAnno }, (_, i) => {
                            const m = i + 1;
                            const val = spesaMese[m] || 0;
                            const maxV = Math.max(...Object.values(spesaMese), 1);
                            const label = new Date(anno, i, 1).toLocaleDateString('it-IT', { month: 'short' });
                            return (
                              <div key={m} className="flex-1 flex flex-col items-center gap-0.5">
                                <div className="w-full rounded-t-sm" style={{ height: `${Math.max((val / maxV) * 48, val > 0 ? 6 : 0)}px`, backgroundColor: val > 0 ? '#10b981' : '#f5f5f4' }} />
                                <span className="text-[8px] text-stone-400 leading-none">{label}</span>
                              </div>
                            );
                          })}
                        </div>
                        <div className="flex justify-between text-xs text-stone-500 pt-1 border-t border-stone-50">
                          <span>{giorni.length} visite</span>
                          <span>media €{mediaVisita.toFixed(0)}/visita</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Pannello media fiches per anno */}
      {showMedia && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4" onClick={() => setShowMedia(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100">
              <h3 className="font-bold text-stone-800">Media fiches per anno</h3>
              <button onClick={() => setShowMedia(false)} className="text-stone-400 hover:text-stone-700 transition-colors"><X size={18} /></button>
            </div>
            <div className="overflow-auto flex-1 px-5 py-4 space-y-2">
              {anniVisite.length === 0 ? (
                <p className="text-sm text-stone-400 text-center py-6">Nessuna visita registrata</p>
              ) : (
              <>
              {/* Totale di sempre */}
              <div className="rounded-xl border-2 border-stone-300 bg-stone-50 overflow-hidden mb-1">
                <button className="w-full flex items-center justify-between px-4 py-3 hover:bg-stone-100 transition-colors" onClick={() => setAnnoApertoMedia(annoApertoMedia === -1 ? null : -1)}>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-stone-700">Tutti gli anni</span>
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-stone-200 text-stone-600">
                      €{mediaFicheTotale.toFixed(0)} media
                    </span>
                  </div>
                  <ChevronDown size={15} className={`text-stone-400 transition-transform ${annoApertoMedia === -1 ? 'rotate-180' : ''}`} />
                </button>
                {annoApertoMedia === -1 && (
                  <div className="border-t border-stone-200 px-4 py-3 space-y-3">
                    <div className="flex items-end gap-1 h-16">
                      {anniVisite.slice().reverse().map(anno => {
                        const media = mediaFichePerAnno[anno] || 0;
                        const maxM = Math.max(...anniVisite.map(a => mediaFichePerAnno[a] || 0), 1);
                        return (
                          <div key={anno} className="flex-1 flex flex-col items-center gap-0.5">
                            <div className="w-full rounded-t-sm" style={{ height: `${Math.max((media / maxM) * 48, media > 0 ? 6 : 0)}px`, backgroundColor: anno === annoCorrente ? '#0ea5e9' : '#d1d5db' }} />
                            <span className="text-[8px] text-stone-400 leading-none">{anno}</span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex justify-between text-xs text-stone-500 pt-1 border-t border-stone-50">
                      <span>{nGiorni} visite totali</span>
                      <span>€{mediaFicheTotale.toFixed(2)}/visita (media)</span>
                    </div>
                  </div>
                )}
              </div>
              {anniVisite.map(anno => {
                const media = mediaFichePerAnno[anno] || 0;
                const visite = (visitiPerAnno[anno] || []).length;
                const spesa = spesaPerAnno[anno] || 0;
                const isOpen = annoApertoMedia === anno;
                // Dettaglio giornate con prezzo medio
                const giorniAnno = (visitiPerAnno[anno] || []).slice().sort((a, b) => b.localeCompare(a));
                return (
                  <div key={anno} className="rounded-xl border border-stone-200 overflow-hidden">
                    <button className="w-full flex items-center justify-between px-4 py-3 hover:bg-stone-50 transition-colors" onClick={() => setAnnoApertoMedia(isOpen ? null : anno)}>
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-stone-800">{anno}</span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${anno === annoCorrente ? 'bg-sky-100 text-sky-700' : 'bg-stone-100 text-stone-500'}`}>
                          €{media.toFixed(0)}/visita
                        </span>
                      </div>
                      <ChevronDown size={15} className={`text-stone-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {isOpen && (
                      <div className="border-t border-stone-100 divide-y divide-stone-50">
                        {giorniAnno.map(dayKey => {
                          const apps = perGiorno[dayKey].filter(a => a.stato !== 'cancellato');
                          const prezzo = apps.reduce((s, a) => s + (a.prezzo_totale || 0), 0);
                          const trattamenti: string[] = [];
                          for (const a of apps) for (const t of (a.appuntamento_trattamenti || [])) trattamenti.push(t.nome_trattamento);
                          return (
                            <div key={dayKey} className="px-4 py-2.5 flex items-start gap-3">
                              <div className="w-1.5 h-1.5 rounded-full bg-sky-400 mt-1.5 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-sm font-medium text-stone-700">
                                    {new Date(dayKey).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'long' })}
                                  </p>
                                  <span className="text-sm font-bold text-stone-700 flex-shrink-0">€{prezzo.toFixed(0)}</span>
                                </div>
                                {trattamenti.length > 0 && <p className="text-xs text-stone-400 mt-0.5">{trattamenti.join(' · ')}</p>}
                              </div>
                            </div>
                          );
                        })}
                        <div className="px-4 py-2 bg-stone-50 flex justify-between text-xs font-semibold text-stone-600">
                          <span>{visite} visite</span>
                          <span>totale €{spesa.toFixed(0)} · media €{media.toFixed(0)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Pannello storico cancellazioni */}
      {showCancellazioni && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4" onClick={() => setShowCancellazioni(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100">
              <h3 className="font-bold text-stone-800">Storico cancellazioni</h3>
              <button onClick={() => setShowCancellazioni(false)} className="text-stone-400 hover:text-stone-700 transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="overflow-auto flex-1 px-5 py-4">
              {anniConCancellazioni.length === 0 ? (
                <p className="text-sm text-stone-400 text-center py-6">Nessuna cancellazione registrata</p>
              ) : (
                <div className="space-y-2">
                  {anniConCancellazioni.map(anno => {
                    const giorni = cancellazioniPerAnno[anno].sort((a, b) => b.localeCompare(a));
                    const isOpen = annoAperto === anno;
                    return (
                      <div key={anno} className="rounded-xl border border-stone-200 overflow-hidden">
                        <button
                          className="w-full flex items-center justify-between px-4 py-3 hover:bg-stone-50 transition-colors"
                          onClick={() => setAnnoAperto(isOpen ? null : anno)}
                        >
                          <div className="flex items-center gap-3">
                            <span className="font-semibold text-stone-800">{anno}</span>
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${anno === annoCorrente ? 'bg-red-100 text-red-700' : 'bg-stone-100 text-stone-500'}`}>
                              {giorni.length} {giorni.length === 1 ? 'cancellazione' : 'cancellazioni'}
                            </span>
                          </div>
                          <ChevronDown size={15} className={`text-stone-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                        </button>
                        {isOpen && (
                          <div className="border-t border-stone-100 divide-y divide-stone-50">
                            {giorni.map(dayKey => {
                              const apps = perGiorno[dayKey];
                              const trattamenti: string[] = [];
                              for (const a of apps) {
                                for (const t of (a.appuntamento_trattamenti || [])) trattamenti.push(t.nome_trattamento);
                              }
                              const d = new Date(dayKey);
                              return (
                                <div key={dayKey} className="px-4 py-2.5 flex items-start gap-3 bg-red-50/40">
                                  <div className="w-1.5 h-1.5 rounded-full bg-red-400 mt-1.5 flex-shrink-0" />
                                  <div>
                                    <p className="text-sm font-medium text-stone-700">
                                      {d.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'long' })}
                                    </p>
                                    {trattamenti.length > 0 && (
                                      <p className="text-xs text-stone-400 mt-0.5 line-through">{trattamenti.join(' · ')}</p>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {intervallioMedio !== null && (
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm px-5 py-4 flex items-center gap-4">
          <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <TrendingUp size={18} className="text-amber-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-stone-700">
              Torna ogni <span className="text-amber-600">{Math.round(intervallioMedio)} giorni</span> in media
            </p>
            <p className="text-xs text-stone-400 mt-0.5">
              Calcolato su {nGiorni} visite · cliente dal {new Date(clienteCreatedAt).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}
            </p>
          </div>
        </div>
      )}

      {/* Bar chart presenze mensili */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5">
        <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-4">Presenze ultimi 12 mesi</p>
        <div className="flex items-end gap-1.5 h-24">
          {barMesi.map(({ label, count }) => (
            <div key={label} className="flex-1 flex flex-col items-center gap-1">
              <div
                className="w-full rounded-t-md transition-all"
                style={{
                  height: `${Math.max((count / maxBar) * 80, count > 0 ? 8 : 0)}px`,
                  backgroundColor: count > 0 ? '#f59e0b' : '#f5f5f4',
                }}
              />
              <span className="text-[9px] text-stone-400 leading-none">{label}</span>
            </div>
          ))}
        </div>
        <div className="flex justify-between text-[10px] text-stone-400 mt-1">
          <span>0</span>
          <span>{maxBar} visita/mese max</span>
        </div>
      </div>

      {/* Timeline raggruppata per giorno */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5">
        <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-4">Cronologia visite</p>
        <div className="space-y-5">
          {mesiOrdinati.map(mese => {
            const giorniMese = perMese[mese].sort((a, b) => b.localeCompare(a));
            return (
              <div key={mese}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-bold text-stone-700 capitalize">{mese}</span>
                  <div className="flex-1 h-px bg-stone-100" />
                  <span className="text-[10px] text-stone-400">
                    {giorniMese.filter(k => perGiorno[k].some(a => a.stato !== 'cancellato')).length} visita{giorniMese.filter(k => perGiorno[k].some(a => a.stato !== 'cancellato')).length !== 1 ? 'e' : ''}
                    {giorniMese.some(k => perGiorno[k].every(a => a.stato === 'cancellato')) && (
                      <span className="ml-1 text-stone-300">· {giorniMese.filter(k => perGiorno[k].every(a => a.stato === 'cancellato')).length} canc.</span>
                    )}
                  </span>
                </div>
                <div className="space-y-2 pl-2">
                  {giorniMese.map(dayKey => {
                    const apps = perGiorno[dayKey].sort((a, b) => new Date(a.data_ora).getTime() - new Date(b.data_ora).getTime());
                    const firstApp = apps[0];

                    const isTuttoCancellato = apps.every(a => a.stato === 'cancellato');

                    // Solo appuntamenti non cancellati per prezzo e trattamenti
                    const appsAttivi = apps.filter(a => a.stato !== 'cancellato');
                    const giornoPrezzoTotale = appsAttivi.reduce((s, a) => s + (a.prezzo_totale || 0), 0);

                    const tuttiTrattamenti: string[] = [];
                    for (const app of apps) {
                      const tt = app.appuntamento_trattamenti;
                      if (tt && tt.length > 0) {
                        for (const t of tt) tuttiTrattamenti.push(t.nome_trattamento);
                      }
                    }

                    // Stato predominante
                    const stato = isTuttoCancellato ? 'cancellato'
                      : apps.every(a => a.stato === 'completato') ? 'completato'
                      : apps.find(a => a.stato === 'confermato') ? 'confermato'
                      : firstApp.stato;
                    const statoClass = STATO_CLASS[stato] ?? STATO_CLASS.confermato;

                    const orarioInizio = new Date(firstApp.data_ora).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
                    const lastApp = apps[apps.length - 1];
                    const fineMs = new Date(lastApp.data_ora).getTime() + lastApp.durata_minuti * 60000;
                    const orarioFine = new Date(fineMs).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

                    return (
                      <div key={dayKey} className={`flex items-start gap-3 py-2.5 border-b border-stone-50 last:border-0 ${isTuttoCancellato ? 'opacity-50' : ''}`}>
                        <div className="flex flex-col items-center flex-shrink-0 mt-0.5">
                          <div className={`w-2 h-2 rounded-full ${isTuttoCancellato ? 'bg-stone-300' : 'bg-amber-400'}`} />
                          <div className="w-px flex-1 bg-stone-100 mt-1" style={{ minHeight: 16 }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-sm font-semibold ${isTuttoCancellato ? 'line-through text-stone-400' : 'text-stone-800'}`}>
                              {new Date(firstApp.data_ora).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric' })}
                              {' · '}
                              {orarioInizio}{apps.length > 1 ? ` → ${orarioFine}` : ''}
                            </span>
                            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${statoClass}`}>
                              {STATO_LABEL[stato] ?? stato}
                            </span>
                            {apps.length > 1 && (
                              <span className="text-[10px] text-stone-400">{apps.length} servizi</span>
                            )}
                          </div>
                          {tuttiTrattamenti.length > 0 && (
                            <p className={`text-xs mt-0.5 ${isTuttoCancellato ? 'line-through text-stone-300' : 'text-stone-500'}`}>
                              {tuttiTrattamenti.join(' · ')}
                            </p>
                          )}
                          {!isTuttoCancellato && giornoPrezzoTotale > 0 && (
                            <p className="text-xs font-semibold text-stone-600 mt-0.5">€{giornoPrezzoTotale.toFixed(2)}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, desc, highlight, warn, clickable }: { label: string; value: string; sub: string; desc?: string; highlight?: boolean; warn?: boolean; clickable?: boolean }) {
  const isWarn = warn && !highlight;
  return (
    <div className={`rounded-2xl border p-4 transition-all ${highlight ? 'border-amber-200 bg-amber-50' : isWarn ? 'border-red-200 bg-red-50' : 'border-stone-200 bg-white shadow-sm'} ${clickable ? 'cursor-pointer hover:shadow-md hover:scale-[1.02]' : ''}`}>
      <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: highlight ? '#92400e' : isWarn ? '#991b1b' : '#a8a29e' }}>{label}</p>
      <p className={`text-2xl font-bold leading-none ${highlight ? 'text-amber-600' : isWarn ? 'text-red-600' : 'text-stone-800'}`}>{value}</p>
      {desc && <p className="text-[10px] mt-1 italic" style={{ color: highlight ? '#b45309' : isWarn ? '#b91c1c' : '#a8a29e' }}>{desc}</p>}
      <p className="text-[10px] mt-0.5" style={{ color: highlight ? '#b45309' : isWarn ? '#b91c1c' : '#a8a29e' }}>{sub}</p>
    </div>
  );
}
