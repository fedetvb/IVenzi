import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { dbUpdate } from '../lib/localDb';
import {
  Trash2, RotateCcw, Users, Calendar, CreditCard, Scissors, ShoppingBag,
  TrendingDown, AlertTriangle, ChevronDown, ChevronUp, Loader2, X, RefreshCw,
} from 'lucide-react';

type Sezione = 'clienti' | 'appuntamenti' | 'schede_colore' | 'parrucchieri' | 'carte_sconto' | 'carte_premium' | 'rivendita_prodotti' | 'spese';

interface ItemCestino {
  id: string;
  label: string;
  sublabel?: string;
  deleted_at: string;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('it-IT', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function fmtDataSemplice(s: string) {
  if (!s) return '';
  return new Date(s + 'T12:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtEuro(n: number) {
  return n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface SezioneConfig {
  id: Sezione;
  label: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  borderColor: string;
}

const sezioni: SezioneConfig[] = [
  { id: 'clienti', label: 'Clienti', icon: Users, color: 'text-amber-600', bgColor: 'bg-amber-50', borderColor: 'border-amber-200' },
  { id: 'appuntamenti', label: 'Appuntamenti', icon: Calendar, color: 'text-sky-600', bgColor: 'bg-sky-50', borderColor: 'border-sky-200' },
  { id: 'schede_colore', label: 'Schede Colore', icon: Scissors, color: 'text-rose-600', bgColor: 'bg-rose-50', borderColor: 'border-rose-200' },
  { id: 'parrucchieri', label: 'Parrucchieri', icon: Users, color: 'text-teal-600', bgColor: 'bg-teal-50', borderColor: 'border-teal-200' },
  { id: 'carte_sconto', label: 'Carte Sconto', icon: CreditCard, color: 'text-emerald-600', bgColor: 'bg-emerald-50', borderColor: 'border-emerald-200' },
  { id: 'carte_premium', label: 'Carte Premium', icon: CreditCard, color: 'text-violet-600', bgColor: 'bg-violet-50', borderColor: 'border-violet-200' },
  { id: 'rivendita_prodotti', label: 'Rivendita', icon: ShoppingBag, color: 'text-orange-600', bgColor: 'bg-orange-50', borderColor: 'border-orange-200' },
  { id: 'spese', label: 'Spese', icon: TrendingDown, color: 'text-red-600', bgColor: 'bg-red-50', borderColor: 'border-red-200' },
];

// Tutte le query leggono SEMPRE da Supabase (mai dalla cache locale)
// così tutti i dispositivi vedono lo stesso stato in tempo reale.
async function caricaSezione(id: Sezione): Promise<ItemCestino[]> {
  switch (id) {
    case 'clienti': {
      const { data } = await supabase
        .from('clienti')
        .select('id, nome, cognome, telefono, deleted_at')
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false });
      return (data || []).map((r: any) => ({
        id: r.id,
        label: `${r.nome} ${r.cognome}`,
        sublabel: r.telefono || undefined,
        deleted_at: r.deleted_at,
      }));
    }
    case 'appuntamenti': {
      const { data } = await supabase
        .from('appuntamenti')
        .select('id, data_ora, stato, deleted_at, clienti(nome, cognome)')
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false });
      return (data || []).map((r: any) => ({
        id: r.id,
        label: new Date(r.data_ora).toLocaleString('it-IT', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
        sublabel: r.clienti ? `${r.clienti.nome} ${r.clienti.cognome}` : undefined,
        deleted_at: r.deleted_at,
      }));
    }
    case 'schede_colore': {
      const { data } = await supabase
        .from('schede_colore')
        .select('id, data_trattamento, formula_colore, tecnica, deleted_at, clienti(nome, cognome)')
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false });
      return (data || []).map((r: any) => ({
        id: r.id,
        label: `Scheda colore ${fmtDataSemplice(r.data_trattamento)}`,
        sublabel: r.clienti ? `${r.clienti.nome} ${r.clienti.cognome}${r.tecnica ? ' · ' + r.tecnica : ''}` : (r.tecnica || undefined),
        deleted_at: r.deleted_at,
      }));
    }
    case 'parrucchieri': {
      const { data } = await supabase
        .from('parrucchieri')
        .select('id, nome, colore, deleted_at')
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false });
      return (data || []).map((r: any) => ({
        id: r.id,
        label: r.nome,
        deleted_at: r.deleted_at,
      }));
    }
    case 'carte_sconto': {
      const { data } = await supabase
        .from('carte_sconto')
        .select('id, codice, descrizione, tipo_sconto, valore_sconto, deleted_at')
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false });
      return (data || []).map((r: any) => ({
        id: r.id,
        label: r.codice,
        sublabel: r.descrizione || `${r.tipo_sconto === 'percentuale' ? r.valore_sconto + '%' : '€' + fmtEuro(r.valore_sconto)}`,
        deleted_at: r.deleted_at,
      }));
    }
    case 'carte_premium': {
      const { data } = await supabase
        .from('carte_premium')
        .select('id, codice, saldo, deleted_at, clienti(nome, cognome)')
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false });
      return (data || []).map((r: any) => ({
        id: r.id,
        label: r.codice,
        sublabel: r.clienti ? `${r.clienti.nome} ${r.clienti.cognome} · saldo €${fmtEuro(r.saldo)}` : `saldo €${fmtEuro(r.saldo)}`,
        deleted_at: r.deleted_at,
      }));
    }
    case 'rivendita_prodotti': {
      const { data } = await supabase
        .from('rivendita_prodotti')
        .select('id, nome_prodotto, totale, data_vendita, deleted_at, parrucchieri(nome)')
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false });
      return (data || []).map((r: any) => ({
        id: r.id,
        label: r.nome_prodotto,
        sublabel: `${fmtDataSemplice(r.data_vendita)} · €${fmtEuro(r.totale)}${r.parrucchieri ? ' · ' + r.parrucchieri.nome : ''}`,
        deleted_at: r.deleted_at,
      }));
    }
    case 'spese': {
      const { data } = await supabase
        .from('spese')
        .select('id, descrizione, categoria, importo, data, deleted_at')
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false });
      return (data || []).map((r: any) => ({
        id: r.id,
        label: r.descrizione || r.categoria,
        sublabel: `${fmtDataSemplice(r.data)} · €${fmtEuro(r.importo)}${r.categoria ? ' · ' + r.categoria : ''}`,
        deleted_at: r.deleted_at,
      }));
    }
    default:
      return [];
  }
}

async function ripristinaItem(sezione: Sezione, id: string) {
  await dbUpdate({
    table: sezione,
    id,
    data: { deleted_at: null },
  });
}

async function eliminaDefinitivamente(sezione: Sezione, id: string) {
  await supabase.from(sezione).delete().eq('id', id);
}

// Cancellazione batch diretta su Supabase: un solo round-trip, sincronizzato su tutti i dispositivi.
async function svuotaSezione(sezione: Sezione) {
  await supabase.from(sezione).delete().not('deleted_at', 'is', null);
}

interface CestinoSezioneProps {
  config: SezioneConfig;
  items: ItemCestino[];
  loading: boolean;
  onRipristina: (id: string) => Promise<void>;
  onElimina: (id: string) => Promise<void>;
  onSvuota: () => Promise<void>;
}

function CestinoSezione({ config, items, loading, onRipristina, onElimina, onSvuota }: CestinoSezioneProps) {
  const [expanded, setExpanded] = useState(false);
  const [confirmSvuota, setConfirmSvuota] = useState(false);
  const [svuotando, setSvuotando] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);

  const { icon: Icon, label, color, bgColor, borderColor } = config;

  async function handleRipristina(id: string) {
    setActionId(id);
    await onRipristina(id);
    setActionId(null);
  }

  async function handleElimina(id: string) {
    if (!confirm(`Eliminare definitivamente questo elemento? L'operazione non è reversibile.`)) return;
    setActionId(id);
    await onElimina(id);
    setActionId(null);
  }

  async function handleSvuota() {
    setSvuotando(true);
    await onSvuota();
    setSvuotando(false);
    setConfirmSvuota(false);
  }

  return (
    <div className={`bg-white rounded-2xl border ${borderColor} overflow-hidden`}>
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-stone-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl ${bgColor} flex items-center justify-center`}>
            <Icon size={16} className={color} />
          </div>
          <div className="text-left">
            <p className="font-bold text-stone-800">{label}</p>
            <p className="text-xs text-stone-400">
              {loading ? 'Caricamento...' : items.length === 0 ? 'Nessun elemento' : `${items.length} ${items.length === 1 ? 'elemento' : 'elementi'} nel cestino`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {items.length > 0 && (
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${bgColor} ${color}`}>{items.length}</span>
          )}
          {expanded ? <ChevronUp size={16} className="text-stone-400" /> : <ChevronDown size={16} className="text-stone-400" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-stone-100">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={20} className="text-stone-300 animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className={`w-12 h-12 rounded-2xl ${bgColor} flex items-center justify-center mb-3`}>
                <Icon size={20} className={`${color} opacity-40`} />
              </div>
              <p className="text-sm text-stone-400">Nessun elemento nel cestino</p>
            </div>
          ) : (
            <>
              <div className="px-5 py-3 flex items-center justify-between border-b border-stone-50">
                <p className="text-xs text-stone-400">{items.length} {items.length === 1 ? 'elemento eliminato' : 'elementi eliminati'}</p>
                {confirmSvuota ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-red-600 font-medium">Sei sicuro? Eliminazione definitiva</span>
                    <button
                      onClick={handleSvuota}
                      disabled={svuotando}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-500 text-white text-xs font-medium hover:bg-red-600 transition-colors disabled:opacity-50"
                    >
                      {svuotando ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                      Svuota
                    </button>
                    <button onClick={() => setConfirmSvuota(false)} className="p-1 text-stone-400 hover:text-stone-600 transition-colors"><X size={13} /></button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmSvuota(true)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 text-xs font-medium transition-colors"
                  >
                    <Trash2 size={11} />
                    Svuota sezione
                  </button>
                )}
              </div>
              <div className="divide-y divide-stone-50">
                {items.map(item => (
                  <div key={item.id} className="flex items-center gap-3 px-5 py-3 hover:bg-stone-50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-stone-700 truncate">{item.label}</p>
                      {item.sublabel && <p className="text-xs text-stone-400 truncate">{item.sublabel}</p>}
                      <p className="text-xs text-stone-300 mt-0.5">Eliminato il {fmtDate(item.deleted_at)}</p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => handleRipristina(item.id)}
                        disabled={actionId === item.id}
                        title="Ripristina"
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 text-xs font-medium transition-colors disabled:opacity-50"
                      >
                        {actionId === item.id ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
                        <span className="hidden sm:inline">Ripristina</span>
                      </button>
                      <button
                        onClick={() => handleElimina(item.id)}
                        disabled={actionId === item.id}
                        title="Elimina definitivamente"
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-red-200 bg-red-50 text-red-500 hover:bg-red-100 text-xs font-medium transition-colors disabled:opacity-50"
                      >
                        {actionId === item.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                        <span className="hidden sm:inline">Elimina</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function Cestino() {
  const [data, setData] = useState<Record<Sezione, ItemCestino[]>>({
    clienti: [], appuntamenti: [], schede_colore: [], parrucchieri: [],
    carte_sconto: [], carte_premium: [], rivendita_prodotti: [], spese: [],
  });
  const [loading, setLoading] = useState<Record<Sezione, boolean>>({
    clienti: true, appuntamenti: true, schede_colore: true, parrucchieri: true,
    carte_sconto: true, carte_premium: true, rivendita_prodotti: true, spese: true,
  });
  const [refreshing, setRefreshing] = useState(false);
  const lastRefreshRef = useRef<Date>(new Date());

  const load = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);
    const results = await Promise.all(sezioni.map(s => caricaSezione(s.id).then(items => ({ id: s.id, items }))));
    const newData = {} as Record<Sezione, ItemCestino[]>;
    const newLoading = {} as Record<Sezione, boolean>;
    for (const { id, items } of results) {
      newData[id] = items;
      newLoading[id] = false;
    }
    setData(newData);
    setLoading(newLoading);
    lastRefreshRef.current = new Date();
    if (showRefreshing) setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
    // Auto-refresh ogni 30 secondi: mantiene il cestino sincronizzato tra tutti i dispositivi
    const id = setInterval(() => load(), 30_000);
    return () => clearInterval(id);
  }, [load]);

  async function handleRipristina(sezione: Sezione, id: string) {
    await ripristinaItem(sezione, id);
    setData(prev => ({ ...prev, [sezione]: prev[sezione].filter(i => i.id !== id) }));
  }

  async function handleElimina(sezione: Sezione, id: string) {
    await eliminaDefinitivamente(sezione, id);
    setData(prev => ({ ...prev, [sezione]: prev[sezione].filter(i => i.id !== id) }));
  }

  async function handleSvuota(sezione: Sezione) {
    await svuotaSezione(sezione);
    setData(prev => ({ ...prev, [sezione]: [] }));
  }

  const totale = Object.values(data).reduce((s, arr) => s + arr.length, 0);

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">Cestino</h1>
          <p className="text-sm text-stone-500 mt-1">
            Gli elementi eliminati possono essere ripristinati da qui. La cancellazione definitiva è irreversibile.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {totale > 0 && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
              <Trash2 size={14} className="text-red-500" />
              <span className="text-sm font-bold text-red-600">{totale}</span>
            </div>
          )}
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            title="Aggiorna da cloud"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-stone-200 text-stone-500 hover:bg-stone-50 text-xs font-medium transition-colors disabled:opacity-50"
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Aggiorna</span>
          </button>
        </div>
      </div>

      {/* Avviso */}
      <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
        <AlertTriangle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-amber-700">
          Gli elementi nel cestino sono nascosti dall'applicazione ma non eliminati dal database. Puoi ripristinarli in qualsiasi momento.
          La cancellazione definitiva rimuove i dati permanentemente dal cloud e non può essere annullata.
          Il cestino si aggiorna automaticamente ogni 30 secondi su tutti i dispositivi.
        </p>
      </div>

      {/* Sezioni */}
      {sezioni.map(config => (
        <CestinoSezione
          key={config.id}
          config={config}
          items={data[config.id]}
          loading={loading[config.id]}
          onRipristina={id => handleRipristina(config.id, id)}
          onElimina={id => handleElimina(config.id, id)}
          onSvuota={() => handleSvuota(config.id)}
        />
      ))}
    </div>
  );
}
