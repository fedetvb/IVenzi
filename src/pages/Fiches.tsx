import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  Plus, Trash2, X, Euro, ChevronDown, ChevronUp, FileText,
  Pencil, Check, BookOpen, Printer, Download, ShieldCheck, AlertCircle, UserPlus, Scissors, Eye, EyeOff, ShoppingBag, Search,
  Banknote, CreditCard, Gift,
} from 'lucide-react';
import { localDateStr } from '../lib/supabase';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import PasswordGateModal from '../components/PasswordGateModal';
import SmsCartaModal, { type AzioneCarta } from '../components/SmsCartaModal';
import { useAuth } from '../lib/AuthContext';
import { dbSelect, dbInsert, dbUpdate, dbDelete, dbSelectWithRelated, dbRpc } from '../lib/localDb';
import { saveFile } from '../lib/fileSaver';

// ─── Types ───────────────────────────────────────────────────────────────────

interface VoceExtra {
  id: string;
  nome: string;
  descrizione: string;
  prezzo: number;
  colore: string;
  attivo: boolean;
}

interface RawAppuntamento {
  id: string;
  data_ora: string;
  durata_minuti: number;
  stato: string;
  note: string;
  prezzo_totale: number;
  clienti: { id: string; nome: string; cognome: string } | null;
  parrucchieri: { id: string; nome: string; colore: string } | null;
  appuntamento_trattamenti: { nome_trattamento: string; prezzo: number }[];
}

interface FicheVoce {
  id: string;
  tipo: 'servizio' | 'extra';
  nome_voce: string;
  parrucchiere_id: string | null;
  nome_parrucchiere: string;
  prezzo: number;
  note: string;
  ordine: number;
}

type TipoPagamento = 'cc_bancomat' | 'contanti_verde' | 'contanti_nero' | null;

interface FicheData {
  id: string;
  appuntamento_id: string;
  note: string;
  convalidata: boolean;
  importo_convalidato: number;
  tipo_pagamento: TipoPagamento;
  voci: FicheVoce[];
  created_at: string;
}

interface ClienteGruppo {
  clienteId: string;
  clienteUuid?: string; // real client UUID for carteMap lookups (used for __premium__ groups)
  clienteNome: string;
  clienteCognome: string;
  appuntamenti: RawAppuntamento[];
  ficheIds: string[];
  ficheConvalidata: boolean;
  importoConvalidato: number;
  convalidataAt: string | null;
  tipoPagamento: TipoPagamento;
  voci: FicheVoce[];
  noteEsistenti: string;
  createdAt: string;
}

interface ParrucchiereSimple {
  id: string;
  nome: string;
  colore: string;
}

interface VoceExtraForm {
  nome: string;
  descrizione: string;
  prezzo: number;
  colore: string;
  attivo: boolean;
}

interface ServizioSemplice {
  id: string;
  nome: string;
  prezzo: number;
  colore: string;
}

const PRESET_COLORS = ['#EC4899', '#3B82F6', '#F59E0B', '#EF4444', '#10B981', '#F97316', '#06B6D4', '#6B7280'];

// ─── Main page ────────────────────────────────────────────────────────────────

type TabView = 'fiches' | 'voci_extra' | 'prodotti_rivendita';

export default function Fiches() {
  const [tab, setTab] = useState<TabView>('fiches');

  return (
    <div className="p-6">
      <div className="flex gap-1 bg-stone-100 p-1 rounded-xl mb-6 w-fit">
        <button
          onClick={() => setTab('fiches')}
          className={`px-5 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${tab === 'fiches' ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
        >
          <FileText size={14} />
          Fiches
        </button>
        <button
          onClick={() => setTab('voci_extra')}
          className={`px-5 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${tab === 'voci_extra' ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
        >
          <BookOpen size={14} />
          Voci Extra
        </button>
      </div>

      {tab === 'fiches' && <FichesTab />}
      {tab === 'voci_extra' && <VociExtraTab />}
    </div>
  );
}

// ─── FichesTab ────────────────────────────────────────────────────────────────

function FichesTab() {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(() => localDateStr());
  const [gruppi, setGruppi] = useState<ClienteGruppo[]>([]);
  const [voceExtraCatalogo, setVoceExtraCatalogo] = useState<VoceExtra[]>([]);
  const [serviziCatalogo, setServiziCatalogo] = useState<ServizioSemplice[]>([]);
  const [trattamentiCatalogo, setTrattamentiCatalogo] = useState<ServizioSemplice[]>([]);
  const [parrucchieri, setParrucchieri] = useState<ParrucchiereSimple[]>([]);
  const [loading, setLoading] = useState(true);
  const [openCard, setOpenCard] = useState<string | null>(null);
  const [clientiCarte, setClientiCarte] = useState<Map<string, { hasPremium: boolean; hasSconto: boolean }>>(new Map());
  const [showPrint, setShowPrint] = useState(false);
  const [autoExportDate, setAutoExportDate] = useState<string | null>(null);
  const [showNuovaFiche, setShowNuovaFiche] = useState(false);
  const [showStampaGate, setShowStampaGate] = useState(false);
  const [showBulkPagamentoModal, setShowBulkPagamentoModal] = useState(false);
  const [showBulkGate, setShowBulkGate] = useState(false);
  const [bulkTipoPagamento, setBulkTipoPagamento] = useState<'cc_bancomat' | 'contanti_verde' | 'contanti_nero' | null>(null);
  const [bulkConvalidando, setBulkConvalidando] = useState(false);
  const [incassoVisible, setIncassoVisible] = useState(() => !!sessionStorage.getItem('incasso_unlocked'));
  const [showIncassoGate, setShowIncassoGate] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    // Use UTC ISO strings so SQLite string comparison works correctly with stored timestamps.
    const startLocal = new Date(`${selectedDate}T00:00:00`);
    const endLocal = new Date(`${selectedDate}T23:59:59`);
    const start = startLocal.toISOString();
    const end   = endLocal.toISOString();

    const [appsRes, voceExtraRes, parrRes, serviziRes, trattamentiRes] = await Promise.all([
      dbSelectWithRelated<RawAppuntamento>({
        table: 'appuntamenti',
        filters: [
          { col: 'data_ora', op: 'gte', val: start },
          { col: 'data_ora', op: 'lte', val: end },
          { col: 'stato', op: 'neq', val: 'cancellato' },
        ],
        orderBy: [{ col: 'data_ora', asc: true }],
        relations: [
          { key: 'clienti', table: 'clienti', fk: 'cliente_id', many: false },
          { key: 'parrucchieri', table: 'parrucchieri', fk: 'parrucchiere_id', many: false },
          { key: 'appuntamento_trattamenti', table: 'appuntamento_trattamenti', manyFk: 'appuntamento_id', many: true },
        ],
        supabaseSelect: '*, clienti(id, nome, cognome), parrucchieri(id, nome, colore), appuntamento_trattamenti(nome_trattamento, prezzo)',
      }),
      dbSelect({ table: 'voci_extra_catalogo', filters: [{ col: 'attivo', op: 'eq', val: true }], orderBy: [{ col: 'nome', asc: true }] }),
      dbSelect({ table: 'parrucchieri', filters: [{ col: 'attivo', op: 'eq', val: true }], orderBy: [{ col: 'nome', asc: true }] }),
      dbSelect({ table: 'trattamenti_catalogo', filters: [{ col: 'attivo', op: 'eq', val: true }, { col: 'tipo', op: 'eq', val: 'servizio' }], orderBy: [{ col: 'nome', asc: true }] }),
      dbSelect({ table: 'trattamenti_catalogo', filters: [{ col: 'attivo', op: 'eq', val: true }, { col: 'tipo', op: 'eq', val: 'trattamento' }], orderBy: [{ col: 'nome', asc: true }] }),
    ]);
    const apps = appsRes.data;
    const voceExtra = voceExtraRes.data;
    const parr = parrRes.data;
    const servizi = serviziRes.data;
    const trattamenti = trattamentiRes.data;

    const appList = (apps || []) as RawAppuntamento[];
    const appIds = appList.map(a => a.id);

    let ficheMap: Record<string, FicheData> = {};
    if (appIds.length > 0) {
      const { data: ficheData } = await dbSelect({ table: 'fiches', filters: [{ col: 'appuntamento_id', op: 'in', val: appIds }] });
      for (const f of ficheData || []) {
        const appId = (f as any).appuntamento_id;
        const { data: voceData } = await dbSelect({ table: 'fiche_voci', filters: [{ col: 'fiche_id', op: 'eq', val: (f as any).id }], orderBy: [{ col: 'ordine', asc: true }] });
        ficheMap[appId] = {
          id: (f as any).id,
          appuntamento_id: appId,
          note: (f as any).note,
          convalidata: (f as any).convalidata,
          importo_convalidato: (f as any).importo_convalidato,
          tipo_pagamento: ((f as any).tipo_pagamento ?? null) as TipoPagamento,
          created_at: (f as any).created_at,
          voci: ((voceData || []) as FicheVoce[]).sort((a: FicheVoce, b: FicheVoce) => a.ordine - b.ordine),
        };
      }
    }

    const gruppoMap: Record<string, ClienteGruppo> = {};
    for (const app of appList) {
      const cid = app.clienti?.id ?? '__sconosciuto__';
      const nome = app.clienti?.nome ?? '—';
      const cognome = app.clienti?.cognome ?? '';
      if (!gruppoMap[cid]) {
        gruppoMap[cid] = {
          clienteId: cid, clienteNome: nome, clienteCognome: cognome,
          appuntamenti: [], ficheIds: [], ficheConvalidata: false,
          importoConvalidato: 0, convalidataAt: null, tipoPagamento: null, voci: [], noteEsistenti: '', createdAt: '',
        };
      }
      gruppoMap[cid].appuntamenti.push(app);
      const fiche = ficheMap[app.id];
      if (fiche) {
        gruppoMap[cid].ficheIds.push(fiche.id);
        gruppoMap[cid].voci.push(...fiche.voci);
        if (fiche.tipo_pagamento) gruppoMap[cid].tipoPagamento = fiche.tipo_pagamento;
        if (fiche.convalidata) {
          gruppoMap[cid].ficheConvalidata = true;
          gruppoMap[cid].importoConvalidato = fiche.importo_convalidato;
          if (fiche.convalidata_at) gruppoMap[cid].convalidataAt = fiche.convalidata_at;
        }
        if (fiche.note) gruppoMap[cid].noteEsistenti += (gruppoMap[cid].noteEsistenti ? '\n' : '') + fiche.note;
        if (!gruppoMap[cid].createdAt || fiche.created_at > gruppoMap[cid].createdAt) {
          gruppoMap[cid].createdAt = fiche.created_at;
        }
      }
    }

    // Carica fiche manuali per questa data (filtro diretto su data_riferimento, nessun problema di timezone)
    const { data: ficheManualiRaw } = await dbSelect({ table: 'fiches', filters: [
      { col: 'manuale', op: 'eq', val: true },
      { col: 'data_riferimento', op: 'eq', val: selectedDate },
    ] });
    const ficheManuali: any[] = [];
    for (const f of ficheManualiRaw || []) {
      const { data: voceData } = await dbSelect({ table: 'fiche_voci', filters: [{ col: 'fiche_id', op: 'eq', val: (f as any).id }] });
      const { data: clientData } = await dbSelect({ table: 'clienti', filters: [{ col: 'id', op: 'eq', val: (f as any).cliente_id }] });
      ficheManuali.push({
        ...f,
        fiche_voci: voceData || [],
        clienti: clientData && clientData.length > 0 ? clientData[0] : null,
      });
    }

    for (const f of (ficheManuali || []) as Array<{
      id: string; cliente_id: string | null; note: string; convalidata: boolean; importo_convalidato: number;
      created_at: string; convalidata_at?: string | null; tipo_fiche?: string; fiche_voci: FicheVoce[]; clienti: { id: string; nome: string; cognome: string } | null;
    }>) {
      // Carta premium fiches always get their own card (separate even for same client)
      const isCartaPremium = f.tipo_fiche === 'carta_premium';
      const cid = isCartaPremium
        ? `__premium__${f.id}`
        : (f.clienti?.id ? `__manuale__${f.clienti.id}` : `__manuale__${f.id}`);
      const voci = (f.fiche_voci || []).sort((a: FicheVoce, b: FicheVoce) => a.ordine - b.ordine);
      if (!gruppoMap[cid]) {
        gruppoMap[cid] = {
          clienteId: cid,
          clienteUuid: f.clienti?.id ?? undefined,
          clienteNome: f.clienti?.nome ?? '—',
          clienteCognome: f.clienti?.cognome ?? '',
          appuntamenti: [],
          ficheIds: [],
          ficheConvalidata: false,
          importoConvalidato: 0,
          convalidataAt: null,
          tipoPagamento: null,
          voci: [],
          noteEsistenti: '',
          createdAt: '',
        };
      }
      const g = gruppoMap[cid];
      g.ficheIds.push(f.id);
      g.voci.push(...voci);
      if ((f as any).tipo_pagamento) g.tipoPagamento = (f as any).tipo_pagamento as TipoPagamento;
      if (f.convalidata) {
        g.ficheConvalidata = true;
        g.importoConvalidato += f.importo_convalidato;
        if (f.convalidata_at) g.convalidataAt = f.convalidata_at;
      }
      if (f.note) g.noteEsistenti += (g.noteEsistenti ? '\n' : '') + f.note;
      if (!g.createdAt || f.created_at > g.createdAt) g.createdAt = f.created_at;
    }

    setGruppi(Object.values(gruppoMap).sort((a, b) => {
      const aIsManualePending = a.clienteId.startsWith('__manuale__') && !a.ficheConvalidata;
      const bIsManualePending = b.clienteId.startsWith('__manuale__') && !b.ficheConvalidata;
      if (aIsManualePending && !bIsManualePending) return -1;
      if (!aIsManualePending && bIsManualePending) return 1;
      const ta = a.createdAt || (a.appuntamenti[0]?.data_ora ?? '');
      const tb = b.createdAt || (b.appuntamenti[0]?.data_ora ?? '');
      return ta.localeCompare(tb);
    }));
    setVoceExtraCatalogo((voceExtra || []) as VoceExtra[]);
    setServiziCatalogo((servizi || []) as ServizioSemplice[]);
    setTrattamentiCatalogo((trattamenti || []) as ServizioSemplice[]);
    setParrucchieri((parr || []) as ParrucchiereSimple[]);

    // Carica mappa carte per i clienti del giorno
    const clienteIds = Object.keys(gruppoMap).filter(id =>
      id !== '__sconosciuto__' && !id.startsWith('__manuale__') && !id.startsWith('__premium__')
    );
    const manualeIds = Object.keys(gruppoMap)
      .filter(id => id.startsWith('__manuale__'))
      .map(id => id.replace('__manuale__', ''))
      .filter(id => /^[0-9a-f-]{36}$/i.test(id));
    const premiumIds = Object.values(gruppoMap)
      .filter(g => g.clienteId.startsWith('__premium__') && g.clienteUuid)
      .map(g => g.clienteUuid as string);
    const allClienteIds = [...new Set([...clienteIds, ...manualeIds, ...premiumIds])];

    const carteMap = new Map<string, { hasPremium: boolean; hasPremiumEsaurita: boolean; hasSconto: boolean }>();
    if (allClienteIds.length > 0) {
      const [scRes, prRes] = await Promise.all([
        dbSelect({ table: 'carte_sconto', filters: [{ col: 'cliente_id', op: 'in', val: allClienteIds }] }),
        dbSelect({ table: 'carte_premium', filters: [
          { col: 'cliente_id', op: 'in', val: allClienteIds },
          { col: 'deleted_at', op: 'is_null' },
        ] }),
      ]);
      const scData = scRes.data || [];
      const prData = prRes.data || [];
      for (const id of allClienteIds) {
        carteMap.set(id, { hasPremium: false, hasPremiumEsaurita: false, hasSconto: false });
      }
      for (const r of scData) {
        const cid = (r as any).cliente_id;
        if (cid) {
          const e = carteMap.get(cid);
          if (e) e.hasSconto = true;
        }
      }
      for (const r of prData) {
        const cid = (r as any).cliente_id;
        if (cid) {
          const e = carteMap.get(cid);
          if (e) {
            e.hasPremium = true;
            if ((r as any).saldo <= 0 || !(r as any).attiva) e.hasPremiumEsaurita = true;
          }
        }
      }
    }
    setClientiCarte(carteMap);

    setLoading(false);
  }, [selectedDate]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!window.electronAPI?.onTriggerAutoFiches) return;
    const unsub = window.electronAPI.onTriggerAutoFiches(({ dateStr, todayStr }: { dateStr: string; todayStr: string }) => {
      setSelectedDate(dateStr);
      setAutoExportDate(dateStr);
      if (window.electronAPI?.markFichesDone) window.electronAPI.markFichesDone(todayStr);
    });
    return unsub;
  }, []);

  // Riepilogo incasso del giorno (solo convalidate)
  const incassoConvalidato = gruppi
    .filter(g => g.ficheConvalidata)
    .reduce((s, g) => s + g.importoConvalidato, 0);
  const convalidate = gruppi.filter(g => g.ficheConvalidata).length;
  const daConvalidare = gruppi.filter(g => !g.ficheConvalidata && g.ficheIds.length > 0);

  async function handleBulkConvalida() {
    if (!bulkTipoPagamento) return;
    setBulkConvalidando(true);
    setShowBulkGate(false);
    const now = new Date().toISOString();
    for (const g of daConvalidare) {
      const totale = g.voci.reduce((s, v) => s + v.prezzo, 0);
      const clienteNome = `${g.clienteNome} ${g.clienteCognome}`.trim();
      const tipoPag = bulkTipoPagamento;
      for (const ficheId of g.ficheIds) {
        await dbUpdate({ table: 'fiches', id: ficheId, data: {
          convalidata: true,
          convalidata_at: now,
          importo_convalidato: totale,
          tipo_pagamento: tipoPag,
        } });
        await dbDelete({ table: 'incassi_giornalieri', filters: [{ col: 'fiche_id', op: 'eq', val: ficheId }] });
        if (tipoPag !== 'contanti_nero') {
          await dbInsert({ table: 'incassi_giornalieri', data: {
            data: selectedDate,
            fiche_id: ficheId,
            cliente_nome: clienteNome,
            importo: totale,
            note: '',
            user_id: user?.id,
          } });
        }

        // Registra voci rivendita e scala stock catalogo
        const vociRivendita = g.voci.filter(v => v.nome_voce.toLowerCase().includes('rivendita'));
        for (const v of vociRivendita) {
          const catalogoMatch = v.note?.match(/^__catalogo_id__:([0-9a-f-]{36})$/i);
          const catalogoId = catalogoMatch ? catalogoMatch[1] : null;

          let costoUnitario = 0;
          if (catalogoId) {
            const { data: catRow } = await dbSelect<{ prezzo_acquisto: number }>({
              table: 'prodotti_rivendita_catalogo',
              filters: [{ col: 'id', op: 'eq', val: catalogoId }],
              limit: 1,
            });
            costoUnitario = catRow?.[0]?.prezzo_acquisto ?? 0;
          }

          if (v.parrucchiere_id) {
            await dbInsert({ table: 'rivendita_prodotti', data: {
              fiche_id: ficheId,
              parrucchiere_id: v.parrucchiere_id,
              nome_prodotto: v.nome_voce,
              quantita: 1,
              prezzo_unitario: v.prezzo,
              costo_unitario: costoUnitario,
              data_vendita: selectedDate,
              note: catalogoId ? '' : (v.note || ''),
              user_id: user?.id,
            } });
          }

          // Scala lo stock atomicamente (safe multi-device)
          if (catalogoId) {
            const { error: rpcErr } = await dbRpc('aggiorna_stock_catalogo', { p_id: catalogoId, p_stock_delta: -1, p_venduta_delta: 1 });
            if (rpcErr) console.error('[bulkConvalida] scala stock fallito:', catalogoId, rpcErr);
          }
        }

        // Registra voci trattamenti (servizi non-rivendita)
        const vociTrattamenti = g.voci.filter(v => !v.nome_voce.toLowerCase().includes('rivendita'));
        for (const v of vociTrattamenti) {
          if (v.parrucchiere_id) {
            await dbInsert({ table: 'trattamenti_eseguiti', data: {
              fiche_id: ficheId,
              parrucchiere_id: v.parrucchiere_id,
              nome_trattamento: v.nome_voce,
              prezzo: v.prezzo,
              data_esecuzione: selectedDate,
              note: '',
              user_id: user?.id,
            } });
          }
        }
      }
    }
    setBulkConvalidando(false);
    load();
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-7 h-7 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <label className="text-sm font-medium text-stone-600">Data:</label>
        <input
          type="date"
          value={selectedDate}
          onChange={e => setSelectedDate(e.target.value)}
          className="border border-stone-200 rounded-lg px-3 py-1.5 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
        />
        <span className="text-sm text-stone-400">{gruppi.length} client{gruppi.length === 1 ? 'e' : 'i'}</span>

        {/* Incasso live */}
        {convalidate > 0 && (
          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5">
            <ShieldCheck size={14} className="text-emerald-600" />
            <span className="text-sm font-semibold text-emerald-700">
              Incasso convalidato:
            </span>
            {incassoVisible ? (
              <span className="text-sm font-bold text-emerald-800">€{incassoConvalidato.toFixed(2)}</span>
            ) : (
              <span className="text-sm font-bold text-emerald-800 tracking-widest">€•••••</span>
            )}
            <span className="text-xs text-emerald-500">({convalidate}/{gruppi.length})</span>
            <button
              onClick={() => {
                if (incassoVisible) {
                  sessionStorage.removeItem('incasso_unlocked');
                  setIncassoVisible(false);
                } else {
                  setShowIncassoGate(true);
                }
              }}
              className="p-0.5 hover:bg-emerald-100 rounded transition-colors text-emerald-500 hover:text-emerald-700"
            >
              {incassoVisible ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
          {daConvalidare.length > 0 && (
            <button
              onClick={() => { setBulkTipoPagamento(null); setShowBulkPagamentoModal(true); }}
              disabled={bulkConvalidando}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
            >
              <ShieldCheck size={14} />
              {bulkConvalidando ? 'Convalida in corso...' : `Convalida tutte (${daConvalidare.length})`}
            </button>
          )}
          <button
            onClick={() => setShowNuovaFiche(true)}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
          >
            <Plus size={14} />
            Nuova Fiche
          </button>
          <button
            onClick={() => setShowStampaGate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-stone-800 hover:bg-stone-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
          >
            <Printer size={14} />
            Stampa fiches
          </button>
        </div>
      </div>

      {gruppi.length === 0 ? (
        <div className="bg-white rounded-xl border border-stone-200 px-6 py-16 text-center">
          <FileText size={32} className="mx-auto text-stone-300 mb-3" />
          <p className="text-stone-400 text-sm">Nessun appuntamento per questa data</p>
          <button onClick={() => setShowNuovaFiche(true)}
            className="mt-3 flex items-center gap-1.5 mx-auto px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-lg transition-colors">
            <Plus size={13} />
            Crea fiche manuale
          </button>
        </div>
      ) : (() => {
        const daCon = gruppi.filter(g => !g.ficheConvalidata);
        const convalidate = gruppi.filter(g => g.ficheConvalidata);
        const renderCard = (g: ClienteGruppo) => {
          const realId = g.clienteId.startsWith('__manuale__')
            ? g.clienteId.replace('__manuale__', '')
            : g.clienteId.startsWith('__premium__')
              ? (g.clienteUuid ?? '')
              : g.clienteId;
          const carteTipi = clientiCarte.get(realId);
          return (
          <FicheCard
            key={g.clienteId}
            gruppo={g}
            selectedDate={selectedDate}
            voceExtraCatalogo={voceExtraCatalogo}
            serviziCatalogo={serviziCatalogo}
            trattamentiCatalogo={trattamentiCatalogo}
            parrucchieri={parrucchieri}
            isOpen={openCard === g.clienteId}
            onToggle={() => setOpenCard(prev => prev === g.clienteId ? null : g.clienteId)}
            onSaved={load}
            onEliminato={() => { setGruppi(prev => prev.filter(p => p.clienteId !== g.clienteId)); setOpenCard(null); load(); }}
            onConvalidata={() => { setOpenCard(null); load(); }}
            showImporti={incassoVisible}
            carteTipi={carteTipi}
          />
          );
        };
        return (
          <div className="space-y-3">
            {daCon.map(renderCard)}
            {convalidate.length > 0 && (
              <>
                <div className="flex items-center gap-3 pt-1">
                  <div className="flex-1 h-px bg-stone-200" />
                  <span className="text-xs font-semibold text-stone-400 uppercase tracking-widest">Convalidate</span>
                  <div className="flex-1 h-px bg-stone-200" />
                </div>
                {convalidate.map(renderCard)}
              </>
            )}
          </div>
        );
      })()}

      {showIncassoGate && createPortal(
        <PasswordGateModal
          titolo="Visualizza incasso"
          descrizione="Inserisci la password per visualizzare le cifre dell'incasso convalidato."
          chiavePassword="password_incasso"
          onSuccess={() => {
            sessionStorage.setItem('incasso_unlocked', '1');
            setIncassoVisible(true);
            setShowIncassoGate(false);
          }}
          onClose={() => setShowIncassoGate(false)}
        />,
        document.body
      )}
      {showStampaGate && createPortal(
        <PasswordGateModal
          titolo="Stampa fiches"
          descrizione="Inserisci la password per accedere alla stampa delle fiches."
          chiavePassword="password_stampa_fiches"
          onSuccess={() => { setShowStampaGate(false); setShowPrint(true); }}
          onClose={() => setShowStampaGate(false)}
        />,
        document.body
      )}
      {showBulkPagamentoModal && createPortal(
        <BulkPagamentoModal
          count={daConvalidare.length}
          selectedDate={selectedDate}
          selected={bulkTipoPagamento}
          onSelect={tip => setBulkTipoPagamento(tip)}
          onNext={() => { setShowBulkPagamentoModal(false); setShowBulkGate(true); }}
          onClose={() => setShowBulkPagamentoModal(false)}
        />,
        document.body
      )}
      {showBulkGate && createPortal(
        <PasswordGateModal
          titolo="Convalida tutte le fiches"
          descrizione={`Convalida ${daConvalidare.length} fiche con metodo "${bulkTipoPagamento === 'cc_bancomat' ? 'CC/Bancomat' : bulkTipoPagamento === 'contanti_verde' ? 'Contanti (dichiarati)' : 'Contanti (non dichiarati)'}". Le carte sconto/premium non verranno applicate.`}
          chiavePassword="password_carte"
          onSuccess={handleBulkConvalida}
          onClose={() => setShowBulkGate(false)}
        />,
        document.body
      )}
      {(showPrint || autoExportDate !== null) && createPortal(
        <PrintModal
          gruppi={gruppi.filter(g => g.ficheConvalidata)}
          onClose={() => { setShowPrint(false); setAutoExportDate(null); }}
          autoExportDate={autoExportDate}
        />,
        document.body
      )}
      {showNuovaFiche && createPortal(
        <NuovaFicheModal
          selectedDate={selectedDate}
          parrucchieri={parrucchieri}
          onClose={() => setShowNuovaFiche(false)}
          onCreated={async (nuovoGruppo) => {
            setShowNuovaFiche(false);
            await load();
            setOpenCard(nuovoGruppo.clienteId);
          }}
        />,
        document.body
      )}
    </div>
  );
}

// ─── NuovaFicheModal ─────────────────────────────────────────────────────────

interface NuovaFicheModalProps {
  selectedDate: string;
  parrucchieri: ParrucchiereSimple[];
  onClose: () => void;
  onCreated: (gruppo: ClienteGruppo) => void;
}

function NuovaFicheModal({ selectedDate, onClose, onCreated }: NuovaFicheModalProps) {
  const { user } = useAuth();
  const [clienti, setClienti] = useState<{ id: string; nome: string; cognome: string }[]>([]);
  const [clienteInput, setClienteInput] = useState('');
  const [clienteId, setClienteId] = useState('');
  const [suggerimenti, setSuggerimenti] = useState<{ id: string; nome: string; cognome: string }[]>([]);
  const [dropOpen, setDropOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    dbSelect({ table: 'clienti', filters: [{ col: 'deleted_at', op: 'is_null', val: null }], orderBy: [{ col: 'cognome', asc: true }], columns: 'id, nome, cognome' }).then(({ data }) => {
      setClienti((data || []) as { id: string; nome: string; cognome: string }[]);
    });
  }, []);

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setDropOpen(false);
    }
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, []);

  function onInput(val: string) {
    setClienteInput(val);
    setClienteId('');
    if (!val.trim()) { setSuggerimenti([]); setDropOpen(false); return; }
    const q = val.toLowerCase();
    const found = clienti.filter(c =>
      `${c.nome} ${c.cognome}`.toLowerCase().includes(q) ||
      `${c.cognome} ${c.nome}`.toLowerCase().includes(q)
    ).sort((a, b) => {
      const aS = a.nome.toLowerCase().startsWith(q) || a.cognome.toLowerCase().startsWith(q);
      const bS = b.nome.toLowerCase().startsWith(q) || b.cognome.toLowerCase().startsWith(q);
      return aS === bS ? 0 : aS ? -1 : 1;
    }).slice(0, 6);
    setSuggerimenti(found);
    setDropOpen(true);
  }

  function selectCliente(c: { id: string; nome: string; cognome: string }) {
    setClienteId(c.id);
    setClienteInput(`${c.nome} ${c.cognome}`);
    setDropOpen(false);
    setSuggerimenti([]);
  }

  async function handleCrea() {
    setSaving(true);
    let resolvedId: string | null = clienteId || null;
    let clienteNome = '—';
    let clienteCognome = '';

    if (!resolvedId && clienteInput.trim()) {
      // Stesso parsing di MultiBookModal: "Nome Cognome Telefono"
      const parts = clienteInput.trim().split(/\s+/);
      const cap = (s: string) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
      const nome = cap(parts[0] ?? '');
      const lastPart = parts[parts.length - 1] ?? '';
      const isPhone = parts.length >= 3 && /^[+\d]{6,15}$/.test(lastPart);
      const cognome = cap(isPhone ? parts.slice(1, -1).join(' ') : parts.slice(1).join(' '));
      const telefono = isPhone ? lastPart : undefined;
      const { data: nc } = await dbInsert({ table: 'clienti', data: { nome, cognome, ...(telefono ? { telefono } : {}), user_id: user?.id } });
      if (nc) { resolvedId = (nc as any).id; clienteNome = (nc as any).nome; clienteCognome = (nc as any).cognome; }
    } else if (clienteId) {
      const c = clienti.find(x => x.id === clienteId);
      if (c) { clienteNome = c.nome; clienteCognome = c.cognome; }
    }

    const { data: newFiche } = await dbInsert({ table: 'fiches', data: { manuale: true, cliente_id: resolvedId, note: '', data_riferimento: selectedDate, user_id: user?.id } });
    setSaving(false);
    if (!newFiche) return;

    const cid = resolvedId ? `__manuale__${resolvedId}` : `__manuale__${(newFiche as any).id}`;
    onCreated({
      clienteId: cid,
      clienteNome,
      clienteCognome,
      appuntamenti: [],
      ficheIds: [(newFiche as any).id],
      ficheConvalidata: false,
      importoConvalidato: 0,
      convalidataAt: null,
      tipoPagamento: null,
      voci: [],
      noteEsistenti: '',
      createdAt: (newFiche as any).created_at ?? '',
    });
  }

  const isNew = clienteInput.trim() && !clienteId;
  const parts = clienteInput.trim().split(/\s+/);
  const lastPart = parts[parts.length - 1] ?? '';
  const hasPhone = parts.length >= 3 && /^[+\d]{6,15}$/.test(lastPart);

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 flex-shrink-0">
          <div className="flex items-center gap-2">
            <FileText size={18} className="text-amber-500" />
            <h2 className="text-base font-semibold text-stone-800">Nuova fiche manuale</h2>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-stone-100 rounded-lg transition-colors">
            <X size={16} className="text-stone-500" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
          <p className="text-sm text-stone-500">
            Data: <span className="font-medium text-stone-700">{new Date(selectedDate + 'T12:00:00').toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
          </p>
          <div ref={dropRef}>
            <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1.5">Cliente (opzionale)</label>
            <div className="relative">
              <input
                type="text"
                value={clienteInput}
                onChange={e => onInput(e.target.value)}
                onFocus={() => { if (suggerimenti.length > 0) setDropOpen(true); }}
                placeholder="Nome Cognome oppure Nome Cognome Telefono"
                className={`w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 transition-colors ${clienteId ? 'border-amber-300 bg-amber-50 focus:ring-amber-400' : isNew ? 'border-sky-300 bg-sky-50 focus:ring-sky-400' : 'border-stone-200 focus:ring-amber-400'}`}
              />
              {clienteId && (
                <button onClick={() => { setClienteId(''); setClienteInput(''); setSuggerimenti([]); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 transition-colors">
                  <X size={14} />
                </button>
              )}
              {dropOpen && suggerimenti.length > 0 && (
                <div className="absolute top-full mt-1 left-0 right-0 bg-white border border-stone-200 rounded-xl shadow-lg z-10 overflow-hidden">
                  {suggerimenti.map(c => (
                    <button key={c.id} type="button"
                      onClick={() => selectCliente(c)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-stone-50 text-left transition-colors">
                      <div className="w-7 h-7 rounded-full bg-stone-100 flex items-center justify-center text-stone-600 font-bold text-xs flex-shrink-0">
                        {c.nome[0]}{c.cognome[0]}
                      </div>
                      <span className="text-sm text-stone-800">{c.nome} {c.cognome}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {isNew ? (
              <p className="text-[11px] mt-1.5 text-sky-600 flex items-center gap-1">
                <UserPlus size={11} />
                {hasPhone
                  ? `Nuovo cliente: ${parts.slice(0, -1).join(' ')} · tel. ${lastPart}`
                  : `Nuovo cliente: "${clienteInput.trim()}" — verrà creata la scheda`}
              </p>
            ) : !clienteId ? (
              <p className="text-xs text-stone-400 mt-1.5">Lascia vuoto per una fiche anonima · es. "Mario Rossi" o "Mario Rossi 3471234567"</p>
            ) : null}
          </div>
        </div>
        <div className="flex gap-3 px-6 pb-6 flex-shrink-0">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-stone-200 text-sm font-medium text-stone-600 hover:bg-stone-50 transition-colors">
            Annulla
          </button>
          <button onClick={handleCrea} disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            <Plus size={14} />
            {saving ? 'Creazione…' : 'Crea fiche'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── FicheCard ────────────────────────────────────────────────────────────────

interface FicheCardProps {
  gruppo: ClienteGruppo;
  selectedDate: string;
  voceExtraCatalogo: VoceExtra[];
  serviziCatalogo: ServizioSemplice[];
  trattamentiCatalogo: ServizioSemplice[];
  parrucchieri: ParrucchiereSimple[];
  isOpen: boolean;
  showImporti: boolean;
  onToggle: () => void;
  onSaved: () => void;
  onEliminato: () => void;
  onConvalidata: () => void;
  carteTipi?: { hasPremium: boolean; hasPremiumEsaurita: boolean; hasSconto: boolean };
}

interface CartaScontoSimple {
  id: string; codice: string; descrizione: string;
  tipo_sconto: 'percentuale' | 'fisso' | 'listino'; valore_sconto: number;
  nominativa?: boolean; cliente_id?: string | null;
  listino_categoria_id?: string | null;
}
interface CartaPremiumSimple {
  id: string; codice: string; saldo: number; attiva?: boolean;
}
interface GiftPassSimple {
  id: string; codice: string; tipo: 'valore' | 'prodotto';
  valore_euro: number | null; prodotto_id: string | null; prodotto_nome: string | null;
  occasione: string; attivata_at: string | null; scadenza_uso_at: string | null;
  fiche_id: string | null; destinataria_cliente_id: string | null;
  cliente_id?: string | null;
  _ruolo?: 'ricevente' | 'donatore';
  _donatore_nome?: string;
}

function FicheCard({ gruppo, selectedDate, voceExtraCatalogo, serviziCatalogo, trattamentiCatalogo, parrucchieri, isOpen, onToggle, onSaved, onEliminato, onConvalidata, showImporti, carteTipi }: FicheCardProps) {
  const { user } = useAuth();
  const [voci, setVoci] = useState<FicheVoce[]>([]);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [convalidando, setConvalidando] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [showConvalidaConfirm, setShowConvalidaConfirm] = useState(false);
  const [showEliminaConfirm, setShowEliminaConfirm] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [eliminaError, setEliminaError] = useState<string | null>(null);
  const [tipoPagamento, setTipoPagamento] = useState<TipoPagamento>(null);
  const [showPagamentoModal, setShowPagamentoModal] = useState(false);

  // Carte
  const [carteSconto, setCarteSconto] = useState<CartaScontoSimple[]>([]);
  const [cartePremium, setCartePremium] = useState<CartaPremiumSimple[]>([]);
  const [cartaScontoId, setCartaScontoId] = useState('');
  const [cartaPremiumId, setCartaPremiumId] = useState('');
  const [showRicaricaAlert, setShowRicaricaAlert] = useState(false);
  const [showRicaricaModal, setShowRicaricaModal] = useState(false);
  const [showPasswordGate, setShowPasswordGate] = useState(false);
  const [ricaricaImporto, setRicaricaImporto] = useState(0);
  const [clienteTelefono, setClienteTelefono] = useState('');
  const [smsModal, setSmsModal] = useState<{ azione: AzioneCarta; codiceOverride?: string } | null>(null);
  // Gift Pass
  const [giftPasses, setGiftPasses] = useState<GiftPassSimple[]>([]);
  const [giftPassId, setGiftPassId] = useState('');
  const [pendingExtra, setPendingExtra] = useState<{ voce: VoceExtra; parrId: string } | null>(null);
  const [pendingServizio, setPendingServizio] = useState<{ servizio: ServizioSemplice; parrId: string } | null>(null);
  const [showRivenditaPicker, setShowRivenditaPicker] = useState(false);
  const [prodottiRivendita, setProdottiRivendita] = useState<ProdottoRivenditaCatalogo[]>([]);
  const [loadingProdotti, setLoadingProdotti] = useState(false);
  const [cercaProdotto, setCercaProdotto] = useState('');
  const [showAltroForm, setShowAltroForm] = useState(false);
  const [altroNome, setAltroNome] = useState('');
  const [altroPrezzo, setAltroPrezzo] = useState('');
  const [showServiziPicker, setShowServiziPicker] = useState(false);
  const [cercaServizio, setCercaServizio] = useState('');

  // Cassetto carte sconto regalate + gift pass orfani
  const [showCassetto, setShowCassetto] = useState(false);
  const [cassettoCarte, setCassettoCarte] = useState<CartaScontoSimple[]>([]);
  const [cassettoGiftPasses, setCassettoGiftPasses] = useState<GiftPassSimple[]>([]);
  const [cassettoSearch, setCassettoSearch] = useState('');
  const [cassettoLoading, setCassettoLoading] = useState(false);

  // Listino prezzi (per carte di tipo 'listino')
  const [listinoPrezziMap, setListinoPrezziMap] = useState<Map<string, number>>(new Map());

  const totaleBase = voci.reduce((s, v) => s + v.prezzo, 0);

  const cartaSconto = carteSconto.find(c => c.id === cartaScontoId);

  // Calcolo con listino: somma dei prezzi listino per i servizi trovati + prezzi originali per gli altri
  const totaleConListino = cartaSconto?.tipo_sconto === 'listino' && listinoPrezziMap.size > 0
    ? voci.reduce((s, v) => {
        if (v.tipo === 'servizio') {
          const lpx = listinoPrezziMap.get(v.nome_voce);
          return s + (lpx !== undefined ? lpx : v.prezzo);
        }
        return s + v.prezzo;
      }, 0)
    : null;

  const scontoAmt = cartaSconto
    ? cartaSconto.tipo_sconto === 'percentuale'
      ? totaleBase * (cartaSconto.valore_sconto / 100)
      : cartaSconto.tipo_sconto === 'fisso'
      ? Math.min(cartaSconto.valore_sconto, totaleBase)
      : cartaSconto.tipo_sconto === 'listino' && totaleConListino !== null
      ? Math.max(0, totaleBase - totaleConListino)
      : 0
    : 0;
  const totaleDopoSconto = Math.max(0, totaleBase - scontoAmt);

  const cartaPremium = cartePremium.find(c => c.id === cartaPremiumId);
  // credito usato: min(saldo disponibile, importo da coprire)
  const creditoPremium = cartaPremium ? Math.min(cartaPremium.saldo, totaleDopoSconto) : 0;
  const totale = Math.max(0, totaleDopoSconto - creditoPremium);
  // true se la carta è selezionata ma il saldo non basta a coprire il totale
  const saldoInsufficient = !!(cartaPremium && cartaPremium.saldo < totaleDopoSconto);

  const isConvalidata = gruppo.ficheConvalidata;

  async function openCassetto() {
    setShowCassetto(true);
    setCassettoLoading(true);
    const [carteRes, gpRes] = await Promise.all([
      dbSelect({ table: 'carte_sconto', filters: [{ col: 'regalata', op: 'eq', val: true }, { col: 'attiva', op: 'eq', val: true }], orderBy: [{ col: 'codice', asc: true }] }),
      dbSelect({ table: 'gift_pass', filters: [{ col: 'utilizzata', op: 'eq', val: false }, { col: 'attiva', op: 'eq', val: true }], orderBy: [{ col: 'codice', asc: true }] }),
    ]);
    setCassettoCarte((carteRes.data ?? []) as CartaScontoSimple[]);
    // Gift pass orfani: non ancora associati a un cliente, non ancora attivati oppure già attivati ma senza fiche
    const now = new Date();
    const gpOrfani = ((gpRes.data ?? []) as GiftPassSimple[]).filter(gp => {
      if (gp.destinataria_cliente_id) return false; // già ha un proprietario
      if (gp.tipo !== 'valore' && gp.scadenza_uso_at && new Date(gp.scadenza_uso_at) < now) return false;
      return true;
    });
    setCassettoGiftPasses(gpOrfani);
    setCassettoLoading(false);
  }

  function selectCassettoCarta(carta: CartaScontoSimple & { ex_proprietaria_nome?: string }) {
    setCarteSconto(prev => {
      const exists = prev.find(c => c.id === carta.id);
      if (!exists) return [...prev, carta];
      return prev;
    });
    setCartaScontoId(carta.id);
    setShowCassetto(false);
    setCassettoSearch('');
  }

  function selectCassettoGiftPass(gp: GiftPassSimple) {
    setGiftPasses(prev => {
      const exists = prev.find(g => g.id === gp.id);
      if (!exists) return [...prev, gp];
      return prev;
    });
    setGiftPassId(gp.id);
    setShowCassetto(false);
    setCassettoSearch('');
  }

  // Carica prezzi listino quando cambia la carta sconto selezionata
  useEffect(() => {
    const carta = carteSconto.find(c => c.id === cartaScontoId);
    if (carta?.tipo_sconto === 'listino' && carta.listino_categoria_id) {
      dbSelect({ table: 'carte_sconto_listino_prezzi', filters: [{ col: 'categoria_id', op: 'eq', val: carta.listino_categoria_id }] }).then(({ data }) => {
        const map = new Map<string, number>();
        for (const row of (data || []) as { nome_servizio: string; prezzo: number }[]) {
          map.set(row.nome_servizio, row.prezzo);
        }
        setListinoPrezziMap(map);
      });
    } else {
      setListinoPrezziMap(new Map());
    }
  }, [cartaScontoId, carteSconto]);

  useEffect(() => {
    if (!isOpen || initialized) return;
    setTipoPagamento(gruppo.tipoPagamento ?? null);
    setNote(gruppo.noteEsistenti);
    if (gruppo.voci.length > 0) {
      // Merge voci salvate con eventuali trattamenti in agenda non ancora presenti
      const merged = [...gruppo.voci];
      const claimed = new Set<string>();
      for (const app of gruppo.appuntamenti) {
        const parr = app.parrucchieri;
        for (const t of app.appuntamento_trattamenti || []) {
          const match = merged.find(v =>
            !claimed.has(v.id) &&
            v.tipo === 'servizio' &&
            v.nome_voce.toLowerCase() === t.nome_trattamento.toLowerCase() &&
            v.parrucchiere_id === (parr?.id ?? null)
          );
          if (match) {
            claimed.add(match.id);
          } else {
            merged.push({
              id: crypto.randomUUID(), tipo: 'servizio',
              nome_voce: t.nome_trattamento,
              parrucchiere_id: parr?.id ?? null, nome_parrucchiere: parr?.nome ?? '',
              prezzo: t.prezzo, note: '', ordine: merged.length,
            });
          }
        }
      }
      setVoci(merged);
    } else {
      const initVoci: FicheVoce[] = [];
      let ordine = 0;
      for (const app of gruppo.appuntamenti) {
        const parr = app.parrucchieri;
        for (const t of app.appuntamento_trattamenti || []) {
          initVoci.push({
            id: crypto.randomUUID(), tipo: 'servizio',
            nome_voce: t.nome_trattamento,
            parrucchiere_id: parr?.id ?? null, nome_parrucchiere: parr?.nome ?? '',
            prezzo: t.prezzo, note: '', ordine: ordine++,
          });
        }
      }
      setVoci(initVoci);
    }
    // Carica telefono cliente
    const rawId = gruppo.clienteId;
    const clienteId = rawId === '__sconosciuto__' ? null
      : rawId.startsWith('__manuale__') ? rawId.replace('__manuale__', '') : rawId;
    // Per fiche manuali il clienteId estratto potrebbe essere un ficheId (caso anonimo) — verifica uuid format
    const isValidUuid = clienteId ? /^[0-9a-f-]{36}$/i.test(clienteId) : false;
    const realClienteId = isValidUuid ? clienteId : null;
    if (realClienteId) {
      dbSelect({ table: 'clienti', filters: [{ col: 'id', op: 'eq', val: realClienteId }], orderBy: [], columns: 'telefono' }).then(({ data }) => { if (data?.[0]?.telefono) setClienteTelefono((data[0] as any).telefono); });
    }

    // Carica carte disponibili per questo cliente (solo quelle intestate a lui)
    (async () => {
      if (realClienteId) {
        const { data: sc } = await dbSelect({ table: 'carte_sconto', filters: [{ col: 'cliente_id', op: 'eq', val: realClienteId }, { col: 'attiva', op: 'eq', val: true }] });
        const scontoList = (sc || []) as CartaScontoSimple[];
        setCarteSconto(scontoList);
        if (scontoList.length > 0) setCartaScontoId(scontoList[0].id);
      }

      if (realClienteId) {
        const { data: pr } = await dbSelect({ table: 'carte_premium', filters: [{ col: 'cliente_id', op: 'eq', val: realClienteId }, { col: 'deleted_at', op: 'is_null' }] });
        const premiumList = (pr || []) as CartaPremiumSimple[];
        setCartePremium(premiumList);
        // Auto-seleziona la prima carta premium attiva con saldo disponibile
        const attiva = premiumList.find(c => c.attiva && c.saldo > 0);
        if (attiva) setCartaPremiumId(attiva.id);
      }

      // Carica Gift Pass associati a questo cliente (attivati o da ritirare, non utilizzati)
      if (realClienteId) {
        const now = new Date();

        // Pass ricevuti: la cliente è la destinataria
        const { data: gpRicevutiData } = await dbSelect({
          table: 'gift_pass',
          filters: [
            { col: 'destinataria_cliente_id', op: 'eq', val: realClienteId },
            { col: 'utilizzata', op: 'eq', val: false },
            { col: 'attiva', op: 'eq', val: true },
          ],
        });
        const gpRicevuti = ((gpRicevutiData || []) as GiftPassSimple[])
          .filter(gp => !(gp.tipo !== 'valore' && gp.scadenza_uso_at && new Date(gp.scadenza_uso_at) < now))
          .map(gp => ({ ...gp, _ruolo: 'ricevente' as const }));

        // Pass donati: la cliente è l'acquirente, attiva ma non ancora attivata dalla destinataria
        const { data: gpDonatiData } = await dbSelect({
          table: 'gift_pass',
          filters: [
            { col: 'cliente_id', op: 'eq', val: realClienteId },
            { col: 'utilizzata', op: 'eq', val: false },
            { col: 'attiva', op: 'eq', val: true },
            { col: 'attivata_at', op: 'is_null', val: null },
          ],
        });
        const gpDonati = ((gpDonatiData || []) as GiftPassSimple[])
          .map(gp => ({ ...gp, _ruolo: 'donatore' as const }));

        // Unisci evitando duplicati (un pass potrebbe avere stesso cliente_id e destinataria_cliente_id)
        const gpTutti = [...gpRicevuti];
        for (const gp of gpDonati) {
          if (!gpTutti.find(g => g.id === gp.id)) gpTutti.push(gp);
        }
        setGiftPasses(gpTutti);
      }
    })();
    setInitialized(true);
  }, [isOpen, initialized, gruppo]);

  useEffect(() => { if (!isOpen) setInitialized(false); }, [isOpen]);

  function addVoceServizio(s: ServizioSemplice) {
    if (parrucchieri.length > 1) {
      setPendingServizio({ servizio: s, parrId: parrucchieri[0]?.id ?? '' });
    } else {
      const parr = parrucchieri[0] ?? null;
      setVoci(prev => [...prev, {
        id: crypto.randomUUID(), tipo: 'servizio', nome_voce: s.nome,
        parrucchiere_id: parr?.id ?? null, nome_parrucchiere: parr?.nome ?? '', prezzo: s.prezzo, note: '', ordine: prev.length,
      }]);
    }
  }

  function confirmPendingServizio() {
    if (!pendingServizio) return;
    const parr = parrucchieri.find(p => p.id === pendingServizio.parrId) ?? null;
    setVoci(prev => [...prev, {
      id: crypto.randomUUID(), tipo: 'servizio', nome_voce: pendingServizio.servizio.nome,
      parrucchiere_id: parr?.id ?? null, nome_parrucchiere: parr?.nome ?? '', prezzo: pendingServizio.servizio.prezzo, note: '', ordine: prev.length,
    }]);
    setPendingServizio(null);
  }

  async function openRivenditaPicker() {
    setShowRivenditaPicker(true);
    setLoadingProdotti(true);
    const { data } = await dbSelect({ table: 'prodotti_rivendita_catalogo', filters: [{ col: 'attivo', op: 'eq', val: true }], orderBy: [{ col: 'categoria', asc: true }, { col: 'nome', asc: true }] });
    setProdottiRivendita((data || []) as ProdottoRivenditaCatalogo[]);
    setLoadingProdotti(false);
  }

  function addProdottoAltro() {
    const nome = altroNome.trim();
    const prezzo = parseFloat(altroPrezzo.replace(',', '.'));
    if (!nome || isNaN(prezzo) || prezzo < 0) return;
    const nomevoce = `${nome} - rivendita`;
    const fakeVoce: VoceExtra = { id: crypto.randomUUID(), nome: nomevoce, descrizione: '', prezzo, colore: '#F97316', attivo: true };
    setShowRivenditaPicker(false);
    setShowAltroForm(false);
    setAltroNome('');
    setAltroPrezzo('');
    setCercaProdotto('');
    if (parrucchieri.length > 1) {
      setPendingExtra({ voce: fakeVoce, parrId: parrucchieri[0]?.id ?? '' });
    } else {
      const parr = parrucchieri[0] ?? null;
      setVoci(prev => [...prev, {
        id: crypto.randomUUID(), tipo: 'extra', nome_voce: nomevoce,
        parrucchiere_id: parr?.id ?? null, nome_parrucchiere: parr?.nome ?? '', prezzo, note: '', ordine: prev.length,
      }]);
    }
  }

  function addProdottoRivendita(p: ProdottoRivenditaCatalogo) {
    const nomevoce = `${p.nome}${p.marca ? ` (${p.marca})` : ''} - rivendita`;
    // Store catalog ID in note with prefix so convalida can find it and decrement stock
    const noteConId = `__catalogo_id__:${p.id}`;
    const fakeVoce: VoceExtra = { id: p.id, nome: nomevoce, descrizione: noteConId, prezzo: p.prezzo_vendita, colore: '#F97316', attivo: true };
    setShowRivenditaPicker(false);
    setCercaProdotto('');
    if (parrucchieri.length > 1) {
      setPendingExtra({ voce: fakeVoce, parrId: parrucchieri[0]?.id ?? '' });
    } else {
      const parr = parrucchieri[0] ?? null;
      setVoci(prev => [...prev, {
        id: crypto.randomUUID(), tipo: 'extra', nome_voce: nomevoce,
        parrucchiere_id: parr?.id ?? null, nome_parrucchiere: parr?.nome ?? '', prezzo: p.prezzo_vendita, note: noteConId, ordine: prev.length,
      }]);
    }
  }

  function addVoceExtra(v: VoceExtra) {
    if (parrucchieri.length > 1) {
      setPendingExtra({ voce: v, parrId: parrucchieri[0]?.id ?? '' });
    } else {
      const parr = parrucchieri[0] ?? null;
      setVoci(prev => [...prev, {
        id: crypto.randomUUID(), tipo: 'extra', nome_voce: v.nome,
        parrucchiere_id: parr?.id ?? null, nome_parrucchiere: parr?.nome ?? '', prezzo: v.prezzo, note: '', ordine: prev.length,
      }]);
    }
  }

  function confirmPendingExtra() {
    if (!pendingExtra) return;
    const parr = parrucchieri.find(p => p.id === pendingExtra.parrId) ?? null;
    // Preserve the note from the pending voce (may contain __catalogo_id__ for rivendita products)
    const noteToUse = pendingExtra.voce.descrizione?.startsWith('__catalogo_id__')
      ? pendingExtra.voce.descrizione
      : pendingExtra.voce.nome.includes('rivendita')
        ? (pendingExtra.voce.id && /^[0-9a-f-]{36}$/i.test(pendingExtra.voce.id) ? `__catalogo_id__:${pendingExtra.voce.id}` : '')
        : '';
    setVoci(prev => [...prev, {
      id: crypto.randomUUID(), tipo: 'extra', nome_voce: pendingExtra.voce.nome,
      parrucchiere_id: parr?.id ?? null, nome_parrucchiere: parr?.nome ?? '', prezzo: pendingExtra.voce.prezzo, note: noteToUse, ordine: prev.length,
    }]);
    setPendingExtra(null);
  }

  function removeVoce(id: string) { setVoci(prev => prev.filter(v => v.id !== id)); }
  function updateVoce(id: string, patch: Partial<FicheVoce>) { setVoci(prev => prev.map(v => v.id === id ? { ...v, ...patch } : v)); }

  async function persistFiche(extraFields?: Record<string, unknown>): Promise<string | null> {
    const isManuale = gruppo.appuntamenti.length === 0;
    const rawId = gruppo.clienteId;
    const strippedId = rawId.startsWith('__manuale__') ? rawId.replace('__manuale__', '') : rawId === '__sconosciuto__' ? null : rawId;
    const realClienteId = strippedId && /^[0-9a-f-]{36}$/i.test(strippedId) && gruppo.ficheIds[0] !== strippedId
      ? strippedId
      : null;

    const ficheFields: Record<string, unknown> = { note, tipo_pagamento: tipoPagamento, updated_at: new Date().toISOString(), ...extraFields };
    if (isManuale) {
      ficheFields.manuale = true;
      ficheFields.cliente_id = realClienteId;
      ficheFields.data_riferimento = selectedDate;
    } else {
      ficheFields.appuntamento_id = gruppo.appuntamenti[0].id;
    }

    let ficheId: string | null = gruppo.ficheIds[0] ?? null;

    if (ficheId) {
      // Aggiorna la fiche esistente preservando l'ID e tutti i riferimenti FK
      await dbUpdate({ table: 'fiches', id: ficheId, data: ficheFields });
      // Elimina le voci esistenti e reinserisce quelle aggiornate
      await dbDelete({ table: 'fiche_voci', filters: [{ col: 'fiche_id', op: 'eq', val: ficheId }] });
      // Elimina le fiche extra se ce ne sono più di una (raro, ma possibile)
      for (const fid of gruppo.ficheIds.slice(1)) {
        await dbDelete({ table: 'fiches', filters: [{ col: 'id', op: 'eq', val: fid }] });
      }
    } else {
      // Crea una nuova fiche (primo salvataggio)
      const { data: newFiche } = await dbInsert({ table: 'fiches', data: { ...ficheFields, user_id: user?.id } });
      ficheId = (newFiche as any)?.id ?? null;
    }

    if (ficheId && voci.length > 0) {
      for (const [i, v] of voci.entries()) {
        await dbInsert({ table: 'fiche_voci', data: {
          fiche_id: ficheId, tipo: v.tipo, nome_voce: v.nome_voce,
          parrucchiere_id: v.parrucchiere_id, nome_parrucchiere: v.nome_parrucchiere,
          prezzo: v.prezzo, note: v.note, ordine: i, user_id: user?.id,
        } });
      }
    }
    return ficheId;
  }

  async function handleSave() {
    setSaving(true);
    await persistFiche();
    setSaving(false);
    onSaved();
  }

  async function handleChangeTipoPagamento(nuovoTipo: TipoPagamento) {
    setTipoPagamento(nuovoTipo);
    for (const ficheId of gruppo.ficheIds) {
      await dbUpdate({ table: 'fiches', id: ficheId, data: { tipo_pagamento: nuovoTipo } });
    }
    // If fiche is already validated, adjust incassi accordingly
    if (gruppo.ficheConvalidata) {
      for (const ficheId of gruppo.ficheIds) {
        if (nuovoTipo === 'contanti_nero') {
          await dbDelete({ table: 'incassi_giornalieri', filters: [{ col: 'fiche_id', op: 'eq', val: ficheId }] });
        } else {
          const clienteNome = `${gruppo.clienteNome} ${gruppo.clienteCognome}`.trim();
          await dbDelete({ table: 'incassi_giornalieri', filters: [{ col: 'fiche_id', op: 'eq', val: ficheId }] });
          await dbInsert({ table: 'incassi_giornalieri', data: {
            data: selectedDate,
            fiche_id: ficheId,
            cliente_nome: clienteNome,
            importo: gruppo.importoConvalidato,
            note: '',
            user_id: user?.id,
          } });
        }
      }
    }
  }

  async function handleConvalida() {
    setConvalidando(true);
    setShowConvalidaConfirm(false);
    // Ricalcola il totale direttamente dalle voci correnti per evitare race condition
    const totaleCalcolato = Math.max(0,
      voci.reduce((s, v) => s + v.prezzo, 0) - scontoAmt - creditoPremium
    );
    const ficheId = await persistFiche({
      convalidata: true,
      convalidata_at: new Date().toISOString(),
      importo_convalidato: totaleCalcolato,
    });

    const rawGruppoId = gruppo.clienteId;
    const clienteGruppoId = rawGruppoId === '__sconosciuto__' ? null
      : rawGruppoId.startsWith('__manuale__') ? rawGruppoId.replace('__manuale__', '')
      : rawGruppoId.startsWith('__premium__') ? (gruppo.clienteUuid ?? null)
      : rawGruppoId;
    const clienteGruppoIdValid = clienteGruppoId && /^[0-9a-f-]{36}$/i.test(clienteGruppoId) ? clienteGruppoId : null;
    const scontoValido = cartaSconto && scontoAmt > 0 &&
      (!cartaSconto.nominativa || cartaSconto.cliente_id === clienteGruppoIdValid);

    if (ficheId) {
      const clienteNome = `${gruppo.clienteNome} ${gruppo.clienteCognome}`.trim();
      // Registra incasso solo se NON è contanti_nero
      if (tipoPagamento !== 'contanti_nero') {
        await dbDelete({ table: 'incassi_giornalieri', filters: [{ col: 'fiche_id', op: 'eq', val: ficheId }] });
        await dbInsert({ table: 'incassi_giornalieri', data: {
          data: selectedDate,
          fiche_id: ficheId,
          cliente_nome: clienteNome,
          importo: totale,
          note: note || '',
          user_id: user?.id,
        } });
      }

      // Registra utilizzo carta sconto (skip se nominativa e cliente non corrisponde)
      if (scontoValido && cartaSconto) {
        await dbInsert({ table: 'utilizzi_carta_sconto', data: {
          carta_sconto_id: cartaSconto.id,
          fiche_id: ficheId,
          importo_originale: totaleBase,
          sconto_applicato: scontoAmt,
          importo_finale: totaleDopoSconto,
          cliente_id: clienteGruppoIdValid,
          user_id: user?.id,
        } });
        const { data: full } = await dbSelect({ table: 'carte_sconto', filters: [{ col: 'id', op: 'eq', val: cartaSconto.id }] });
        if (full && full.length > 0 && (full[0] as any)?.usa_e_getta) {
          await dbUpdate({ table: 'carte_sconto', id: cartaSconto.id, data: { attiva: false, deleted_at: new Date().toISOString() } });
        }
      }

      // Registra voci rivendita
      const vociRivendita = voci.filter(v => v.nome_voce.toLowerCase().includes('rivendita'));
      for (const v of vociRivendita) {
        const catalogoMatch = v.note?.match(/^__catalogo_id__:([0-9a-f-]{36})$/i);
        const catalogoId = catalogoMatch ? catalogoMatch[1] : null;

        let costoUnitario = 0;
        if (catalogoId) {
          const { data: catRow } = await dbSelect<{ prezzo_acquisto: number }>({
            table: 'prodotti_rivendita_catalogo',
            filters: [{ col: 'id', op: 'eq', val: catalogoId }],
            limit: 1,
          });
          costoUnitario = catRow?.[0]?.prezzo_acquisto ?? 0;
        }

        if (v.parrucchiere_id) {
          await dbInsert({ table: 'rivendita_prodotti', data: {
            fiche_id: ficheId,
            parrucchiere_id: v.parrucchiere_id,
            nome_prodotto: v.nome_voce,
            quantita: 1,
            prezzo_unitario: v.prezzo,
            costo_unitario: costoUnitario,
            data_vendita: selectedDate,
            note: catalogoId ? '' : (v.note || ''),
            user_id: user?.id,
          } });
        }

        // Scala lo stock atomicamente (safe multi-device)
        if (catalogoId) {
          const { error: rpcErr } = await dbRpc('aggiorna_stock_catalogo', { p_id: catalogoId, p_stock_delta: -1, p_venduta_delta: 1 });
          if (rpcErr) console.error('[handleConvalida] scala stock fallito:', catalogoId, rpcErr);
        }
      }

      // Registra voci trattamenti (solo se il nome contiene "trattamento")
      const vociTrattamenti = voci.filter(v => v.nome_voce.toLowerCase().includes('trattamento'));
      for (const v of vociTrattamenti) {
        if (v.parrucchiere_id) {
          await dbInsert({ table: 'trattamenti_eseguiti', data: {
            fiche_id: ficheId,
            parrucchiere_id: v.parrucchiere_id,
            nome_trattamento: v.nome_voce,
            prezzo: v.prezzo,
            data_esecuzione: selectedDate,
            note: v.note || '',
            user_id: user?.id,
          } });
        }
      }

      // Registra utilizzo e scala saldo carta premium
      if (cartaPremium && creditoPremium > 0) {
        await dbInsert({ table: 'utilizzi_carta_premium', data: {
          carta_premium_id: cartaPremium.id,
          fiche_id: ficheId,
          importo_detratto: creditoPremium,
          user_id: user?.id,
        } });
        const nuovoSaldoPremium = cartaPremium.saldo - creditoPremium;
        await dbUpdate({ table: 'carte_premium', id: cartaPremium.id, data: {
          saldo: nuovoSaldoPremium,
          ...(nuovoSaldoPremium <= 0 ? { attiva: false } : {}),
        } });
      }

      // Registra utilizzo Gift Pass
      const giftPass = giftPasses.find(gp => gp.id === giftPassId);
      if (ficheId && giftPass) {
        // Se tipo=prodotto, aggiungi voce a €0 se non già presente
        if (giftPass.tipo === 'prodotto' && giftPass.prodotto_id) {
          const nomevoce = `${giftPass.prodotto_nome ?? 'Prodotto'} - Gift Pass (${giftPass.codice})`;
          const noteConId = `__catalogo_id__:${giftPass.prodotto_id}`;
          const alreadyAdded = voci.some(v => v.note === noteConId || v.nome_voce.includes(giftPass.codice));
          if (!alreadyAdded) {
            await dbInsert({ table: 'fiche_voci', data: {
              fiche_id: ficheId, tipo: 'extra', nome_voce: nomevoce,
              parrucchiere_id: null, nome_parrucchiere: '', prezzo: 0,
              note: noteConId, ordine: voci.length, user_id: user?.id,
            } });
            // Scala stock
            const { error: rpcErr } = await dbRpc('aggiorna_stock_catalogo', { p_id: giftPass.prodotto_id, p_stock_delta: -1, p_venduta_delta: 1 });
            if (rpcErr) console.error('[handleConvalida] scala stock gift pass fallito:', giftPass.prodotto_id, rpcErr);
          }
        }
        await dbUpdate({ table: 'gift_pass', id: giftPass.id, data: {
          utilizzata: true, fiche_id: ficheId, updated_at: new Date().toISOString(),
          // Se il pass era orfano, associalo alla cliente ora
          ...(clienteGruppoIdValid && !giftPass.destinataria_cliente_id ? { destinataria_cliente_id: clienteGruppoIdValid } : {}),
          // Attiva se non ancora attivato
          ...(!giftPass.attivata_at ? { attivata_at: new Date().toISOString() } : {}),
        } });
      }
    }

    setConvalidando(false);
    if (scontoValido && cartaSconto) {
      setSmsModal({
        codiceOverride: cartaSconto.codice,
        azione: {
          tipo: 'sconto_utilizzo',
          tipoSconto: cartaSconto.tipo_sconto,
          valoreSconto: cartaSconto.valore_sconto,
          importoOriginale: totaleBase,
          scontoApplicato: scontoAmt,
          importoFinale: totaleDopoSconto,
        },
      });
    } else if (cartaPremium && creditoPremium > 0) {
      setSmsModal({
        codiceOverride: cartaPremium.codice,
        azione: { tipo: 'detrazione', importoDetratto: creditoPremium, nuovoSaldo: cartaPremium.saldo - creditoPremium },
      });
    } else {
      onConvalidata();
    }
  }

  async function handleAnnullaConvalida() {
    if (!confirm('Annullare la convalida di questa fiche? I crediti delle carte verranno ripristinati.')) return;
    setConvalidando(true);

    let smsRipristino: { azione: AzioneCarta; codiceOverride: string } | null = null;

    for (const ficheId of gruppo.ficheIds) {
      // Ripristina utilizzi carta sconto
      const { data: scUsi } = await dbSelect({ table: 'utilizzi_carta_sconto', filters: [{ col: 'fiche_id', op: 'eq', val: ficheId }] });
      for (const uso of scUsi || []) {
        const { data: cs } = await dbSelect({ table: 'carte_sconto', filters: [{ col: 'id', op: 'eq', val: (uso as any).carta_sconto_id }] });
        if (cs && cs.length > 0) {
          const csData = cs[0] as any;
          if (csData?.usa_e_getta && !csData.attiva) {
            await dbUpdate({ table: 'carte_sconto', id: csData.id, data: { attiva: true, deleted_at: null } });
          }
        }
        await dbDelete({ table: 'utilizzi_carta_sconto', filters: [{ col: 'fiche_id', op: 'eq', val: ficheId }] });
      }

      // Ripristina utilizzi carta premium
      const { data: prUsi } = await dbSelect({ table: 'utilizzi_carta_premium', filters: [{ col: 'fiche_id', op: 'eq', val: ficheId }] });
      for (const uso of prUsi || []) {
        const { data: cp } = await dbSelect({ table: 'carte_premium', filters: [{ col: 'id', op: 'eq', val: (uso as any).carta_premium_id }] });
        if (cp && cp.length > 0) {
          const cpData = cp[0] as any;
          const nuovoSaldo = cpData.saldo + (uso as any).importo_detratto;
          await dbUpdate({ table: 'carte_premium', id: cpData.id, data: { saldo: nuovoSaldo, attiva: true } });
          smsRipristino = {
            codiceOverride: cpData.codice,
            azione: { tipo: 'ripristino_credito', importoRipristinato: (uso as any).importo_detratto, nuovoSaldo },
          };
        }
        await dbDelete({ table: 'utilizzi_carta_premium', filters: [{ col: 'fiche_id', op: 'eq', val: ficheId }] });
      }

      // Ripristina stock catalogo per ogni voce con __catalogo_id__ nel note (atomico)
      const { data: vociFiche } = await dbSelect({ table: 'fiche_voci', filters: [{ col: 'fiche_id', op: 'eq', val: ficheId }] });
      for (const vf of vociFiche || []) {
        const catalogoMatch = (vf as any).note?.match(/^__catalogo_id__:([0-9a-f-]{36})$/i);
        if (!catalogoMatch) continue;
        await dbRpc('aggiorna_stock_catalogo', { p_id: catalogoMatch[1], p_stock_delta: 1, p_venduta_delta: -1 });
      }

      // Rimuovi voci rivendita generate dalla fiche (per id per sicurezza cache)
      const { data: rivVoci } = await dbSelect({ table: 'rivendita_prodotti', filters: [{ col: 'fiche_id', op: 'eq', val: ficheId }] });
      for (const rv of rivVoci || []) {
        await dbDelete({ table: 'rivendita_prodotti', filters: [{ col: 'id', op: 'eq', val: (rv as any).id }] });
      }

      // Rimuovi trattamenti generati dalla fiche
      const { data: trattVoci } = await dbSelect({ table: 'trattamenti_eseguiti', filters: [{ col: 'fiche_id', op: 'eq', val: ficheId }] });
      for (const tv of trattVoci || []) {
        await dbDelete({ table: 'trattamenti_eseguiti', filters: [{ col: 'id', op: 'eq', val: (tv as any).id }] });
      }

      // Rimuovi incasso giornaliero (per id per garantire rimozione dalla cache)
      const { data: incassi } = await dbSelect({ table: 'incassi_giornalieri', filters: [{ col: 'fiche_id', op: 'eq', val: ficheId }] });
      for (const inc of incassi || []) {
        await dbDelete({ table: 'incassi_giornalieri', filters: [{ col: 'id', op: 'eq', val: (inc as any).id }] });
      }

      // Ripristina Gift Pass collegato a questa fiche
      const { data: gpRows } = await dbSelect({ table: 'gift_pass', filters: [{ col: 'fiche_id', op: 'eq', val: ficheId }] });
      for (const gp of gpRows || []) {
        const gpData = gp as GiftPassSimple & { prodotto_id: string | null; scadenza_uso_at: string | null };
        // Calcola nuovo scadenza_uso_at: ripristina il tempo residuo basandosi su attivata_at
        await dbUpdate({ table: 'gift_pass', id: gpData.id, data: {
          utilizzata: false, fiche_id: null, updated_at: new Date().toISOString(),
        } });
        // Ripristina stock se tipo=prodotto
        if (gpData.prodotto_id) {
          const voceGp = vociFiche?.find((vf: any) => (vf.note ?? '').includes(gpData.prodotto_id!));
          if (voceGp) {
            await dbRpc('aggiorna_stock_catalogo', { p_id: gpData.prodotto_id, p_stock_delta: 1, p_venduta_delta: -1 });
          }
        }
      }

      // Riporta fiche a non-convalidata
      await dbUpdate({ table: 'fiches', id: ficheId, data: { convalidata: false, convalidata_at: null, importo_convalidato: 0 } });
    }

    setConvalidando(false);

    if (smsRipristino) {
      setSmsModal(smsRipristino);
    } else {
      onSaved();
    }
  }

  async function handleElimina() {
    setEliminando(true);
    setEliminaError(null);
    setShowEliminaConfirm(false);

    try {
      for (const ficheId of gruppo.ficheIds) {
        // Se convalidata, esegui l'iter completo di annullamento prima di eliminare
        if (gruppo.ficheConvalidata) {
          // Ripristina utilizzi carta sconto
          const { data: scUsi } = await dbSelect({ table: 'utilizzi_carta_sconto', filters: [{ col: 'fiche_id', op: 'eq', val: ficheId }] });
          for (const uso of scUsi || []) {
            const { data: cs } = await dbSelect({ table: 'carte_sconto', filters: [{ col: 'id', op: 'eq', val: (uso as any).carta_sconto_id }] });
            if (cs && cs.length > 0) {
              const csData = cs[0] as any;
              if (csData?.usa_e_getta && !csData.attiva) {
                await dbUpdate({ table: 'carte_sconto', id: csData.id, data: { attiva: true } });
              }
            }
            await dbDelete({ table: 'utilizzi_carta_sconto', filters: [{ col: 'fiche_id', op: 'eq', val: ficheId }] });
          }

          // Ripristina utilizzi carta premium
          const { data: prUsi } = await dbSelect({ table: 'utilizzi_carta_premium', filters: [{ col: 'fiche_id', op: 'eq', val: ficheId }] });
          for (const uso of prUsi || []) {
            const { data: cp } = await dbSelect({ table: 'carte_premium', filters: [{ col: 'id', op: 'eq', val: (uso as any).carta_premium_id }] });
            if (cp && cp.length > 0) {
              const cpData = cp[0] as any;
              await dbUpdate({ table: 'carte_premium', id: cpData.id, data: { saldo: cpData.saldo + (uso as any).importo_detratto, attiva: true } });
            }
            await dbDelete({ table: 'utilizzi_carta_premium', filters: [{ col: 'fiche_id', op: 'eq', val: ficheId }] });
          }

          // Ripristina stock catalogo per voci con __catalogo_id__ nel note (atomico)
          const { data: vociFiche } = await dbSelect({ table: 'fiche_voci', filters: [{ col: 'fiche_id', op: 'eq', val: ficheId }] });
          for (const vf of vociFiche || []) {
            const catalogoMatch = (vf as any).note?.match(/^__catalogo_id__:([0-9a-f-]{36})$/i);
            if (!catalogoMatch) continue;
            const { error: rpcErr } = await dbRpc('aggiorna_stock_catalogo', { p_id: catalogoMatch[1], p_stock_delta: 1, p_venduta_delta: -1 });
            if (rpcErr) console.error('[handleElimina] ripristino stock fallito:', catalogoMatch[1], rpcErr);
          }

          // Rimuovi voci rivendita (per id per garantire rimozione dalla cache)
          const { data: rivVociE } = await dbSelect({ table: 'rivendita_prodotti', filters: [{ col: 'fiche_id', op: 'eq', val: ficheId }] });
          for (const rv of rivVociE || []) {
            const r = await dbDelete({ table: 'rivendita_prodotti', filters: [{ col: 'id', op: 'eq', val: (rv as any).id }] });
            if (r.error) console.error('[handleElimina] delete rivendita_prodotti:', r.error);
          }

          // Rimuovi trattamenti generati
          const { data: trattVociE } = await dbSelect({ table: 'trattamenti_eseguiti', filters: [{ col: 'fiche_id', op: 'eq', val: ficheId }] });
          for (const tv of trattVociE || []) {
            await dbDelete({ table: 'trattamenti_eseguiti', filters: [{ col: 'id', op: 'eq', val: (tv as any).id }] });
          }

          // Rimuovi incasso giornaliero (per id per garantire rimozione dalla cache)
          const { data: incassiE } = await dbSelect({ table: 'incassi_giornalieri', filters: [{ col: 'fiche_id', op: 'eq', val: ficheId }] });
          for (const inc of incassiE || []) {
            await dbDelete({ table: 'incassi_giornalieri', filters: [{ col: 'id', op: 'eq', val: (inc as any).id }] });
          }

          // Ripristina Gift Pass collegato a questa fiche
          const { data: gpRowsE } = await dbSelect({ table: 'gift_pass', filters: [{ col: 'fiche_id', op: 'eq', val: ficheId }] });
          for (const gp of gpRowsE || []) {
            const gpData = gp as any;
            await dbUpdate({ table: 'gift_pass', id: gpData.id, data: {
              utilizzata: false, fiche_id: null, updated_at: new Date().toISOString(),
            } });
            if (gpData.prodotto_id) {
              await dbRpc('aggiorna_stock_catalogo', { p_id: gpData.prodotto_id, p_stock_delta: 1, p_venduta_delta: -1 });
            }
          }
        }

        // Elimina fiche_voci prima (per sicurezza) poi la fiche
        await dbDelete({ table: 'fiche_voci', filters: [{ col: 'fiche_id', op: 'eq', val: ficheId }] });
        const delRes = await dbDelete({ table: 'fiches', filters: [{ col: 'id', op: 'eq', val: ficheId }] });
        if (delRes.error) throw new Error(`Errore eliminazione fiche: ${delRes.error}`);
      }

      onEliminato();
    } catch (err) {
      console.error('[handleElimina]', err);
      setEliminaError(err instanceof Error ? err.message : 'Errore sconosciuto durante l\'eliminazione.');
    } finally {
      setEliminando(false);
    }
  }

  const statoColor: Record<string, string> = {
    confermato: 'bg-blue-100 text-blue-700',
    in_attesa: 'bg-amber-100 text-amber-700',
    completato: 'bg-emerald-100 text-emerald-700',
  };

  const isManuale = gruppo.appuntamenti.length === 0;
  const isCartaPremium = gruppo.clienteId.startsWith('__premium__');

  const parrucchieriUnici = Array.from(
    new Map(
      gruppo.appuntamenti.filter(a => a.parrucchieri).map(a => [a.parrucchieri!.id, a.parrucchieri!])
    ).values()
  );

  const orari = gruppo.appuntamenti
    .map(a => new Date(a.data_ora).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }))
    .join(', ');

  return (
    <div className={`bg-white rounded-xl border transition-all ${isConvalidata ? 'border-emerald-300 shadow-sm' : isOpen ? 'border-amber-300 shadow-md' : 'border-stone-200 shadow-sm'}`}>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-stone-50/60 transition-colors rounded-xl"
      >
        <div className="flex-shrink-0 w-20 text-center">
          {isCartaPremium
            ? <span className="text-[10px] font-bold text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded-full uppercase tracking-wide">Carta Premium</span>
            : isManuale
              ? <span className="text-[10px] font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full uppercase tracking-wide">Manuale</span>
              : <span className="text-xs font-semibold text-stone-500">{orari}</span>
          }
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {parrucchieriUnici.map(p => (
            <div key={p.id} title={p.nome} className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.colore }} />
          ))}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {isCartaPremium
              ? <p className="font-semibold text-yellow-700">Fiche automatica carta premium</p>
              : <p className="font-semibold text-stone-800">{gruppo.clienteNome} {gruppo.clienteCognome}</p>
            }
            {carteTipi?.hasPremium && (
              <svg width="18" height="12" viewBox="0 0 18 12" fill="none" xmlns="http://www.w3.org/2000/svg" title={carteTipi.hasPremiumEsaurita ? 'Carta Premium esaurita' : 'Carta Premium'}>
                {!carteTipi.hasPremiumEsaurita && <defs><linearGradient id="pgold-fiche" x1="0" y1="0" x2="18" y2="12" gradientUnits="userSpaceOnUse"><stop stopColor="#F59E0B"/><stop offset="1" stopColor="#D97706"/></linearGradient></defs>}
                <rect x="0.5" y="0.5" width="17" height="11" rx="1.5" fill={carteTipi.hasPremiumEsaurita ? '#EF4444' : 'url(#pgold-fiche)'} stroke={carteTipi.hasPremiumEsaurita ? '#DC2626' : '#D97706'} strokeWidth="0.5"/>
                <rect x="0.5" y="3" width="17" height="2.5" fill="rgba(0,0,0,0.18)"/>
                <rect x="2" y="7" width="5" height="3" rx="0.8" fill={carteTipi.hasPremiumEsaurita ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.55)'}/>
              </svg>
            )}
            {carteTipi?.hasSconto && (
              <svg width="18" height="12" viewBox="0 0 18 12" fill="none" xmlns="http://www.w3.org/2000/svg" title="Carta Sconto">
                <rect x="0.5" y="0.5" width="17" height="11" rx="1.5" fill="white" stroke="#d6d3d1" strokeWidth="0.5"/>
                <rect x="0.5" y="3" width="17" height="2.5" fill="rgba(100,100,100,0.12)"/>
                <rect x="2" y="7" width="5" height="3" rx="0.8" fill="rgba(100,100,100,0.18)"/>
              </svg>
            )}
          </div>
          <p className="text-xs text-stone-400 truncate">
            {isCartaPremium
              ? `${gruppo.clienteNome} ${gruppo.clienteCognome}`.trim()
              : isManuale
                ? 'Fiche manuale'
                : <>
                    {parrucchieriUnici.map(p => p.nome).join(', ')}
                    {' · '}
                    {gruppo.appuntamenti.flatMap(a => a.appuntamento_trattamenti?.map(t => t.nome_trattamento) || []).join(', ') || 'Nessun servizio'}
                  </>
            }
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {gruppo.appuntamenti.length > 1 && (
            <span className="text-xs bg-stone-100 text-stone-600 font-medium px-2 py-0.5 rounded-full">{gruppo.appuntamenti.length} servizi</span>
          )}
          {isConvalidata ? (
            <div className="flex items-center gap-1.5">
              <span className="flex items-center gap-1 text-xs bg-emerald-100 text-emerald-700 font-medium px-2 py-0.5 rounded-full">
                <ShieldCheck size={11} />
                {showImporti ? `€${gruppo.importoConvalidato.toFixed(2)}` : '€•••'}
              </span>
              {gruppo.tipoPagamento === 'cc_bancomat' && <span className="text-[10px] bg-blue-50 text-blue-600 border border-blue-200 font-medium px-1.5 py-0.5 rounded-full">CC</span>}
              {gruppo.tipoPagamento === 'contanti_verde' && <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: '#22c55e' }} title="Contanti" />}
              {gruppo.tipoPagamento === 'contanti_nero' && <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 ring-1 ring-stone-300" style={{ backgroundColor: '#1c1917' }} title="Contanti (non registrati)" />}
            </div>
          ) : gruppo.ficheIds.length > 0 ? (
            <span className="text-xs bg-amber-100 text-amber-700 font-medium px-2 py-0.5 rounded-full">Fiche</span>
          ) : null}
          {!isManuale && gruppo.appuntamenti[0] && (
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statoColor[gruppo.appuntamenti[0].stato] ?? 'bg-stone-100 text-stone-600'}`}>
              {gruppo.appuntamenti[0].stato === 'confermato' ? 'Confermato' : gruppo.appuntamenti[0].stato === 'in_attesa' ? 'In attesa' : 'Completato'}
            </span>
          )}
          {isOpen ? <ChevronUp size={16} className="text-stone-400" /> : <ChevronDown size={16} className="text-stone-400" />}
        </div>
      </button>

      {isOpen && (
        <div className="border-t border-stone-100 px-5 py-5 space-y-5">
          {isConvalidata && (
            <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
              <ShieldCheck size={18} className="text-emerald-600 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-emerald-800">Fiche convalidata</p>
                <p className="text-xs text-emerald-600">Importo registrato: {showImporti ? `€${gruppo.importoConvalidato.toFixed(2)}` : '€•••'}</p>
              </div>
              <button
                onClick={() => setShowConvalidaConfirm(true)}
                className="text-xs text-emerald-600 hover:text-emerald-800 underline"
              >
                Riconvalida
              </button>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Riepilogo servizi</p>
              {parrucchieri.length > 0 && voci.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <Scissors size={11} className="text-stone-400" />
                  <span className="text-[11px] text-stone-400">Assegna tutti a:</span>
                  <select
                    defaultValue=""
                    onChange={e => {
                      const pid = e.target.value;
                      const parr = pid === '__nessuno__' ? null : parrucchieri.find(p => p.id === pid) ?? null;
                      setVoci(prev => prev.map(v => ({
                        ...v,
                        parrucchiere_id: parr?.id ?? null,
                        nome_parrucchiere: parr?.nome ?? '',
                      })));
                      e.target.value = '';
                    }}
                    className="text-[11px] border border-stone-200 rounded-lg px-2 py-1 bg-white text-stone-700 focus:outline-none focus:border-amber-400"
                  >
                    <option value="" disabled>scegli…</option>
                    {parrucchieri.map(p => (
                      <option key={p.id} value={p.id}>{p.nome}</option>
                    ))}
                    <option value="__nessuno__">— Nessuno</option>
                  </select>
                </div>
              )}
            </div>
            <div className="rounded-xl border border-stone-100 overflow-hidden">
              {voci.length === 0 && (
                <div className="px-4 py-6 text-center text-sm text-stone-400">Nessun servizio — aggiungi voci dal catalogo sotto</div>
              )}
              {voci.map(v => {
                const lpx = v.tipo === 'servizio' && cartaSconto?.tipo_sconto === 'listino' ? listinoPrezziMap.get(v.nome_voce) : undefined;
                return (
                  <VoceRow
                    key={v.id}
                    voce={v}
                    parrucchieri={parrucchieri}
                    onChange={patch => updateVoce(v.id, patch)}
                    onRemove={() => removeVoce(v.id)}
                    listinoPrezzoOverride={lpx}
                  />
                );
              })}
              {voci.length > 0 && (
                <div className="flex justify-end items-center gap-3 px-4 py-2.5 bg-stone-50 border-t border-stone-100">
                  {cartaSconto?.tipo_sconto === 'listino' && scontoAmt > 0 && (
                    <span className="text-xs text-stone-400 line-through">€{totaleBase.toFixed(2)}</span>
                  )}
                  <span className={`text-sm font-bold ${cartaSconto?.tipo_sconto === 'listino' && scontoAmt > 0 ? 'text-orange-600' : 'text-stone-800'}`}>
                    Totale: €{totale.toFixed(2)}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Aggiungi al conto</p>

            {/* Servizi e Prodotti */}
            <div className="space-y-2">
              {/* Servizi inline */}
              {serviziCatalogo.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide mb-1.5">Servizi</p>
                  <div className="flex flex-wrap gap-2">
                    {serviziCatalogo.map(s => {
                      const listinoPxBtn = cartaSconto?.tipo_sconto === 'listino' ? listinoPrezziMap.get(s.nome) : undefined;
                      return (
                        <button key={s.id} type="button" onClick={() => addVoceServizio(s)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all hover:shadow-sm active:scale-95"
                          style={{ borderColor: s.colore, backgroundColor: `${s.colore}15`, color: s.colore }}
                        >
                          <Plus size={10} />
                          {s.nome}
                          {listinoPxBtn !== undefined ? (
                            <span className="flex items-center gap-1">
                              <span className="font-bold opacity-90"> €{listinoPxBtn.toFixed(0)}</span>
                              {s.prezzo !== listinoPxBtn && <span className="opacity-40 line-through text-[10px]">€{s.prezzo.toFixed(0)}</span>}
                            </span>
                          ) : (
                            s.prezzo > 0 && <span className="opacity-70"> €{s.prezzo.toFixed(0)}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              {/* Trattamenti e Prodotti → modale */}
              <div>
                <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide mb-1.5">Trattamenti e prodotti</p>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => { setShowServiziPicker(true); setCercaServizio(''); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-stone-300 bg-stone-50 text-stone-700 hover:bg-stone-100 hover:border-stone-400 transition-all hover:shadow-sm active:scale-95"
                  >
                    <Scissors size={10} />
                    Trattamenti
                  </button>
                  <button type="button" onClick={() => openRivenditaPicker()}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-orange-300 bg-orange-50 text-orange-600 hover:bg-orange-100 hover:border-orange-400 transition-all hover:shadow-sm active:scale-95"
                  >
                    <ShoppingBag size={10} />
                    Prodotti Rivendita
                  </button>
                </div>
              </div>
            </div>

            {/* Voci extra */}
            <div>
              <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide mb-1.5">Voci extra</p>
              <div className="flex flex-wrap gap-2">
                {voceExtraCatalogo.map(v => {
                  const isRivenditaBtn = v.nome.toLowerCase().includes('rivendita');
                  return (
                    <button key={v.id} type="button"
                      onClick={() => isRivenditaBtn ? openRivenditaPicker() : addVoceExtra(v)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all hover:shadow-sm active:scale-95"
                      style={{ borderColor: v.colore, backgroundColor: `${v.colore}15`, color: v.colore }}
                    >
                      {isRivenditaBtn ? <ShoppingBag size={10} /> : <Plus size={10} />}
                      {v.nome} {!isRivenditaBtn && v.prezzo > 0 && <span className="opacity-70">€{v.prezzo.toFixed(0)}</span>}
                    </button>
                  );
                })}
                {voceExtraCatalogo.length === 0 && <p className="text-xs text-stone-400 italic">Nessuna voce nel catalogo</p>}
              </div>
            </div>

            {/* Selezione parrucchiere per servizio in sospeso */}
            {pendingServizio && createPortal(
              <SelezioneParrucchiereModal
                titolo={<>Seleziona parrucchiere per <span className="font-bold">{pendingServizio.servizio.nome}</span></>}
                parrucchieri={parrucchieri}
                selectedParrId={pendingServizio.parrId}
                onSelectParr={id => setPendingServizio(prev => prev ? { ...prev, parrId: id } : null)}
                onAnnulla={() => setPendingServizio(null)}
                onConferma={confirmPendingServizio}
                labelConferma="Aggiungi servizio"
                accentColor="stone"
              />,
              document.body
            )}
            {pendingExtra && createPortal(
              <SelezioneParrucchiereModal
                titolo={<>Seleziona parrucchiere per <span className="font-bold">{pendingExtra.voce.nome}</span></>}
                parrucchieri={parrucchieri}
                selectedParrId={pendingExtra.parrId}
                onSelectParr={id => setPendingExtra(prev => prev ? { ...prev, parrId: id } : null)}
                onAnnulla={() => setPendingExtra(null)}
                onConferma={confirmPendingExtra}
                labelConferma="Aggiungi voce"
                accentColor="amber"
              />,
              document.body
            )}

            {/* Modal trattamenti */}
            {showServiziPicker && createPortal(
              <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setShowServiziPicker(false)}>
                <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg border border-stone-100 max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center justify-between px-5 pt-5 pb-3 flex-shrink-0">
                    <p className="text-sm font-semibold text-stone-800">Seleziona trattamento</p>
                    <button type="button" onClick={() => setShowServiziPicker(false)} className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-400 transition-colors">
                      <X size={14} />
                    </button>
                  </div>
                  <div className="px-5 pb-3 flex-shrink-0">
                    <div className="relative">
                      <input
                        type="text"
                        value={cercaServizio}
                        onChange={e => setCercaServizio(e.target.value)}
                        placeholder="Cerca trattamento..."
                        className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400 bg-stone-50 pl-8"
                        autoFocus
                      />
                      <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
                      {cercaServizio && (
                        <button type="button" onClick={() => setCercaServizio('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-300 hover:text-stone-500 transition-colors">
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="px-5 pb-5 overflow-y-auto">
                    <div className="flex flex-wrap gap-2">
                      {trattamentiCatalogo.filter(s => {
                        if (!cercaServizio.trim()) return true;
                        return s.nome.toLowerCase().includes(cercaServizio.toLowerCase());
                      }).map(s => (
                        <button key={s.id} type="button"
                          onClick={() => { addVoceServizio(s); setShowServiziPicker(false); setCercaServizio(''); }}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium border transition-all hover:shadow-sm active:scale-95"
                          style={{ borderColor: s.colore, backgroundColor: `${s.colore}15`, color: s.colore }}
                        >
                          <Plus size={11} />
                          {s.nome}
                          {s.prezzo > 0 && <span className="opacity-70 font-bold">€{s.prezzo.toFixed(0)}</span>}
                        </button>
                      ))}
                      {trattamentiCatalogo.filter(s => !cercaServizio.trim() || s.nome.toLowerCase().includes(cercaServizio.toLowerCase())).length === 0 && (
                        <p className="text-sm text-stone-400 italic py-2">Nessun trattamento trovato</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>,
              document.body
            )}

            {/* Modal prodotti rivendita */}
            {showRivenditaPicker && createPortal(
              <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => { setShowRivenditaPicker(false); setShowAltroForm(false); setAltroNome(''); setAltroPrezzo(''); setCercaProdotto(''); }}>
                <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg border border-stone-100 max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center justify-between px-5 pt-5 pb-3 flex-shrink-0">
                    <p className="text-sm font-semibold text-stone-800">Seleziona prodotto da aggiungere</p>
                    <button type="button" onClick={() => { setShowRivenditaPicker(false); setShowAltroForm(false); setAltroNome(''); setAltroPrezzo(''); setCercaProdotto(''); }} className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-400 transition-colors">
                      <X size={14} />
                    </button>
                  </div>
                  <div className="px-5 pb-3 flex-shrink-0">
                    <div className="relative">
                      <input
                        type="text"
                        value={cercaProdotto}
                        onChange={e => setCercaProdotto(e.target.value)}
                        placeholder="Cerca prodotto..."
                        className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-stone-50 pl-8"
                        autoFocus
                      />
                      <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
                      {cercaProdotto && (
                        <button type="button" onClick={() => setCercaProdotto('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-300 hover:text-stone-500 transition-colors">
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="px-5 pb-5 overflow-y-auto">
                    {loadingProdotti ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {[...prodottiRivendita].filter(p => {
                          if (!cercaProdotto.trim()) return true;
                          const q = cercaProdotto.toLowerCase();
                          return `${p.categoria} ${p.nome} ${p.marca}`.toLowerCase().includes(q);
                        }).sort((a, b) => `${a.categoria} ${a.nome}`.toLowerCase().localeCompare(`${b.categoria} ${b.nome}`.toLowerCase())).map(p => {
                          const esaurito = p.quantita_stock <= 0;
                          const scorta = !esaurito && p.quantita_stock <= 2;
                          const btnCls = esaurito
                            ? 'border-red-300 bg-red-50 text-red-700 hover:bg-red-100 hover:border-red-400'
                            : scorta
                              ? 'border-orange-300 bg-orange-50 text-orange-700 hover:bg-orange-100 hover:border-orange-400'
                              : 'border-amber-300 bg-white text-stone-700 hover:bg-amber-50 hover:border-amber-400';
                          const iconCls = esaurito ? 'text-red-400' : scorta ? 'text-orange-400' : 'text-amber-500';
                          const stockCls = esaurito ? 'text-red-400 font-semibold' : scorta ? 'text-orange-400 font-semibold' : 'text-stone-400';
                          return (
                            <button key={p.id} type="button"
                              onClick={() => addProdottoRivendita(p)}
                              className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium border transition-all hover:shadow-sm active:scale-95 ${btnCls}`}
                            >
                              <Plus size={11} className={iconCls} />
                              <span className="font-semibold">{p.categoria ? `${p.categoria.toLowerCase()} ${p.nome}` : p.nome}</span>
                              {p.marca && <span className="opacity-60 text-xs">{p.marca}</span>}
                              <span className="text-emerald-600 font-bold">€{p.prezzo_vendita.toFixed(0)}</span>
                              <span className="opacity-30">·</span>
                              <span className={`text-xs ${stockCls}`}>stock {p.quantita_stock}</span>
                            </button>
                          );
                        })}
                        {prodottiRivendita.length === 0 && (
                          <p className="text-sm text-stone-400 italic py-2">Nessun prodotto disponibile in stock</p>
                        )}
                        <button type="button"
                          onClick={() => setShowAltroForm(v => !v)}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium border border-stone-300 bg-white text-stone-600 hover:bg-stone-100 hover:border-stone-400 transition-all hover:shadow-sm active:scale-95"
                        >
                          <Plus size={11} />
                          Altro
                        </button>
                      </div>
                    )}
                    {showAltroForm && (
                      <div className="flex items-center gap-2 pt-3">
                        <input
                          type="text"
                          value={altroNome}
                          onChange={e => setAltroNome(e.target.value)}
                          placeholder="Nome prodotto"
                          className="flex-1 border border-stone-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-stone-50"
                        />
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-sm">€</span>
                          <input
                            type="number"
                            value={altroPrezzo}
                            onChange={e => setAltroPrezzo(e.target.value)}
                            placeholder="0"
                            min="0"
                            step="0.5"
                            className="w-24 border border-stone-200 rounded-xl pl-6 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-stone-50"
                          />
                        </div>
                        <button type="button"
                          onClick={() => addProdottoAltro()}
                          disabled={!altroNome.trim() || !altroPrezzo}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <Plus size={13} />
                          Aggiungi
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>,
              document.body
            )}
          </div>

          {/* Carte sconto e premium */}
          {(carteSconto.length > 0 || cartePremium.length > 0 || giftPasses.length > 0) && (
            <div className="rounded-xl border border-stone-100 bg-stone-50/50 px-4 py-4 space-y-3">
              <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Carte cliente</p>
              {carteSconto.length > 0 && (
                <div>
                  <label className="block text-xs text-stone-500 mb-1">Carta sconto</label>
                  <select value={cartaScontoId} onChange={e => setCartaScontoId(e.target.value)}
                    className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-amber-400">
                    <option value="">— Nessuna carta sconto —</option>
                    {carteSconto.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.codice} · {c.tipo_sconto === 'percentuale' ? `${c.valore_sconto}%` : c.tipo_sconto === 'fisso' ? `€${c.valore_sconto}` : 'Listino'} off{c.descrizione ? ` · ${c.descrizione}` : ''}{c.nominativa ? ' · nominativa' : ''}
                      </option>
                    ))}
                  </select>
                  {cartaSconto?.tipo_sconto === 'listino' && listinoPrezziMap.size > 0 && (
                    <p className="text-xs text-orange-600 mt-1 font-medium flex items-center gap-1.5">
                      <Check size={11} /> Listino attivo · {listinoPrezziMap.size} prezzi personalizzati
                      {scontoAmt > 0 && <span> · risparmio €{scontoAmt.toFixed(2)}</span>}
                    </p>
                  )}
                  {cartaSconto?.tipo_sconto !== 'listino' && cartaSconto && scontoAmt > 0 && (
                    <p className="text-xs text-amber-600 mt-1 font-medium">Sconto applicato: -€{scontoAmt.toFixed(2)}</p>
                  )}
                </div>
              )}
              {cartePremium.length > 0 && (
                <div>
                  <label className="block text-xs text-stone-500 mb-1">Carta premium</label>
                  <select value={cartaPremiumId} onChange={e => setCartaPremiumId(e.target.value)}
                    className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-emerald-400">
                    <option value="">— Nessuna carta premium —</option>
                    {cartePremium.map(c => {
                      const esaurita = c.saldo <= 0;
                      const disattiva = !c.attiva && !esaurita;
                      const label = esaurita ? ' (esaurita)' : disattiva ? ' (disattiva)' : '';
                      return (
                        <option key={c.id} value={c.id}>
                          {c.codice} · Saldo €{c.saldo.toFixed(2)}{label}
                        </option>
                      );
                    })}
                  </select>
                  {cartaPremium && cartaPremium.saldo <= 0 && (
                    <div className="mt-2 flex items-center justify-between bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                      <p className="text-xs text-red-600 font-medium flex items-center gap-1.5">
                        <AlertCircle size={12} /> Carta esaurita — ricaricala per usarla
                      </p>
                      <button
                        onClick={() => setShowPasswordGate(true)}
                        className="flex items-center gap-1 px-3 py-1 text-xs font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                      >
                        <Plus size={11} /> Ricarica
                      </button>
                    </div>
                  )}
                  {cartaPremium && cartaPremium.saldo > 0 && creditoPremium > 0 && (
                    <p className="text-xs text-emerald-600 mt-1 font-medium">Credito utilizzato: -€{creditoPremium.toFixed(2)}</p>
                  )}
                  {saldoInsufficient && (
                    <p className="text-xs text-amber-600 mt-1 font-medium flex items-center gap-1">
                      <AlertCircle size={11} /> Saldo insufficiente — verrà richiesta conferma alla convalida
                    </p>
                  )}
                </div>
              )}
              {giftPasses.length > 0 && (
                <div>
                  <label className="block text-xs text-stone-500 mb-1">Gift Pass</label>
                  <select value={giftPassId} onChange={e => setGiftPassId(e.target.value)}
                    className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-violet-400">
                    <option value="">— Nessun Gift Pass —</option>
                    {giftPasses.map(gp => {
                      const valore = gp.tipo === 'prodotto' ? `Prodotto: ${gp.prodotto_nome ?? '?'}` : `Valore €${gp.valore_euro}`;
                      const ruoloLabel = gp._ruolo === 'donatore' ? '[Da donare] ' : '';
                      return (
                        <option key={gp.id} value={gp.id}>
                          {ruoloLabel}{gp.codice} · {valore} · {gp.occasione}
                        </option>
                      );
                    })}
                  </select>
                  {(() => {
                    const gp = giftPasses.find(g => g.id === giftPassId);
                    if (!gp) return null;
                    if (gp._ruolo === 'donatore') return (
                      <p className="text-xs text-violet-600 mt-1 font-medium flex items-center gap-1">
                        <Gift size={11} /> Gift Pass acquistato da regalare — verrà attivato alla convalida
                      </p>
                    );
                    return null;
                  })()}
                </div>
              )}
              {(scontoAmt > 0 || creditoPremium > 0) && (
                <div className="flex items-center justify-between pt-1 border-t border-stone-200">
                  <span className="text-xs text-stone-500">Totale da pagare</span>
                  <span className="text-base font-bold text-emerald-700">€{totale.toFixed(2)}</span>
                </div>
              )}
            </div>
          )}

          {/* Cassetto carte / gift pass orfani */}
          {!isConvalidata && (
            <button
              onClick={openCassetto}
              className="w-full flex items-center justify-center gap-2 border border-dashed border-stone-300 text-stone-500 rounded-xl py-2.5 text-sm hover:border-amber-400 hover:text-amber-600 hover:bg-amber-50 transition-all"
            >
              <CreditCard size={14} />
              Assegna carta / Gift Pass per codice
            </button>
          )}

          {/* Modale cassetto */}
          {showCassetto && createPortal(
            <div className="fixed inset-0 z-[300] bg-black/50 flex items-end sm:items-center justify-center p-4" onClick={() => setShowCassetto(false)}>
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-5 pt-5 pb-3">
                  <div>
                    <p className="font-bold text-stone-800">Assegna carta o Gift Pass</p>
                    <p className="text-xs text-stone-400">Cerca per codice e assegna a questa cliente</p>
                  </div>
                  <button onClick={() => { setShowCassetto(false); setCassettoSearch(''); }} className="p-1.5 rounded-xl hover:bg-stone-100 transition-colors">
                    <X size={18} className="text-stone-400" />
                  </button>
                </div>
                <div className="px-5 pb-3">
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                    <input
                      value={cassettoSearch}
                      onChange={e => setCassettoSearch(e.target.value)}
                      placeholder="Digita il codice ricevuto..."
                      className="w-full border border-stone-200 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:border-amber-400"
                      autoFocus
                    />
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-2">
                  {cassettoLoading ? (
                    <div className="flex items-center justify-center py-10">
                      <div className="w-6 h-6 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : (() => {
                    const q = cassettoSearch.toLowerCase();
                    const filteredCarte = cassettoCarte.filter(c => c.codice.toLowerCase().includes(q));
                    const filteredGp = cassettoGiftPasses.filter(g => g.codice.toLowerCase().includes(q));
                    const hasResults = filteredCarte.length > 0 || filteredGp.length > 0;

                    if (!hasResults) return (
                      <p className="text-sm text-stone-400 text-center py-8">
                        {cassettoSearch ? 'Nessun codice trovato' : 'Nessuna carta o Gift Pass disponibile'}
                      </p>
                    );

                    return (
                      <>
                        {filteredCarte.length > 0 && (
                          <>
                            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider pt-1">Carte sconto</p>
                            {filteredCarte.map(c => {
                              const ex = (c as any).ex_proprietaria_nome;
                              return (
                                <button
                                  key={c.id}
                                  onClick={() => selectCassettoCarta(c as CartaScontoSimple & { ex_proprietaria_nome?: string })}
                                  className="w-full flex items-start gap-3 bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3.5 hover:border-amber-400 hover:bg-amber-50 transition-all text-left"
                                >
                                  <div className="w-8 h-8 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <CreditCard size={14} className="text-amber-600" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-mono font-semibold text-stone-800 text-sm">{c.codice}</p>
                                    <p className="text-xs text-stone-500 mt-0.5">
                                      {c.tipo_sconto === 'percentuale' ? `${c.valore_sconto}%` : `€${c.valore_sconto}`} di sconto
                                      {ex ? <span className="text-stone-400"> · regalata da {ex}</span> : ''}
                                    </p>
                                    {c.descrizione && <p className="text-xs text-stone-400 mt-0.5">{c.descrizione}</p>}
                                  </div>
                                </button>
                              );
                            })}
                          </>
                        )}
                        {filteredGp.length > 0 && (
                          <>
                            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider pt-2">Gift Pass</p>
                            {filteredGp.map(gp => (
                              <button
                                key={gp.id}
                                onClick={() => selectCassettoGiftPass(gp)}
                                className="w-full flex items-start gap-3 bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3.5 hover:border-violet-400 hover:bg-violet-50 transition-all text-left"
                              >
                                <div className="w-8 h-8 bg-violet-100 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
                                  <Gift size={14} className="text-violet-600" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-mono font-semibold text-stone-800 text-sm tracking-widest">{gp.codice}</p>
                                  <p className="text-xs text-stone-500 mt-0.5">
                                    {gp.tipo === 'prodotto' ? `Prodotto: ${gp.prodotto_nome ?? '?'}` : `Valore €${gp.valore_euro}`}
                                    <span className="text-stone-400"> · {gp.occasione}</span>
                                    {gp.destinataria_nome ? <span className="text-stone-400"> · per {(gp as any).destinataria_nome}</span> : ''}
                                  </p>
                                </div>
                              </button>
                            ))}
                          </>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>,
            document.body
          )}

          {/* Tipo pagamento */}
          <div>
            <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">Metodo di pagamento</label>
            <div className="flex gap-2 flex-wrap">
              {([
                { val: 'cc_bancomat' as TipoPagamento, label: 'CC / Bancomat', dot: null },
                { val: 'contanti_verde' as TipoPagamento, label: 'Contanti', dot: '#22c55e' },
                { val: 'contanti_nero' as TipoPagamento, label: 'Contanti', dot: '#1c1917' },
              ] as { val: TipoPagamento; label: string; dot: string | null }[]).map(opt => {
                const selected = tipoPagamento === opt.val;
                return (
                  <button key={opt.val!} type="button"
                    onClick={() => isConvalidata ? handleChangeTipoPagamento(opt.val) : setTipoPagamento(opt.val)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium transition-all ${selected ? 'border-amber-400 bg-amber-50 text-stone-800 shadow-sm' : 'border-stone-200 text-stone-500 hover:border-stone-300 hover:text-stone-700'}`}
                  >
                    {opt.dot
                      ? <span className="w-3 h-3 rounded-full flex-shrink-0 border border-stone-300/50" style={{ backgroundColor: opt.dot }} />
                      : <span className="text-base leading-none">💳</span>
                    }
                    {opt.label}
                    {selected && <Check size={12} className="text-amber-600 ml-0.5" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1.5">Note fiche</label>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
              placeholder="Note aggiuntive…"
              className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
            />
          </div>

          {/* Dialogo saldo insufficiente */}
          {showRicaricaAlert && cartaPremium && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-4 space-y-3">
              <div className="flex items-start gap-3">
                <AlertCircle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-amber-800">Saldo carta insufficiente</p>
                  <p className="text-xs text-amber-700 mt-1">
                    La carta <span className="font-mono font-bold">{cartaPremium.codice}</span> ha un saldo di{' '}
                    <strong>€{cartaPremium.saldo.toFixed(2)}</strong>, non sufficiente a coprire{' '}
                    <strong>€{totaleDopoSconto.toFixed(2)}</strong>.
                  </p>
                  <p className="text-xs text-amber-600 mt-1">
                    Vuoi ricaricarla adesso? Se scegli No, verrà usato il saldo residuo (€{cartaPremium.saldo.toFixed(2)}) e il resto (€{(totaleDopoSconto - cartaPremium.saldo).toFixed(2)}) sarà addebitato al cliente.
                  </p>
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => {
                    // No ricarica: usa saldo disponibile e vai a convalida
                    setShowRicaricaAlert(false);
                    setShowConvalidaConfirm(true);
                  }}
                  className="px-4 py-1.5 text-xs font-medium text-stone-600 border border-stone-200 rounded-lg hover:bg-stone-50"
                >
                  No, usa saldo disponibile
                </button>
                <button
                  onClick={() => {
                    setShowRicaricaAlert(false);
                    setShowPasswordGate(true);
                  }}
                  className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                >
                  <Plus size={11} />
                  Sì, ricarica ora
                </button>
              </div>
            </div>
          )}

          {/* Seleziona tipo pagamento (obbligatorio prima della convalida) */}
          {showPagamentoModal && (
            <div className="bg-white border-2 border-amber-300 rounded-xl px-4 py-4 space-y-3 shadow-sm">
              <div className="flex items-start gap-3">
                <AlertCircle size={18} className="text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-stone-800">Seleziona il metodo di pagamento</p>
                  <p className="text-xs text-stone-500 mt-0.5">Necessario prima di convalidare la fiche.</p>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                {([
                  { val: 'cc_bancomat' as TipoPagamento, label: 'CC / Bancomat', dot: null },
                  { val: 'contanti_verde' as TipoPagamento, label: 'Contanti', dot: '#22c55e' },
                  { val: 'contanti_nero' as TipoPagamento, label: 'Contanti', dot: '#1c1917' },
                ] as { val: TipoPagamento; label: string; dot: string | null }[]).map(opt => (
                  <button key={opt.val!} type="button"
                    onClick={() => {
                      setTipoPagamento(opt.val);
                      setShowPagamentoModal(false);
                      if (saldoInsufficient) setShowRicaricaAlert(true);
                      else setShowConvalidaConfirm(true);
                    }}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg border border-stone-200 hover:border-amber-400 hover:bg-amber-50 text-sm font-medium text-stone-700 transition-all"
                  >
                    {opt.dot ? <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: opt.dot }} /> : <span className="text-xs">💳</span>}
                    {opt.label}
                  </button>
                ))}
              </div>
              <button onClick={() => setShowPagamentoModal(false)} className="text-xs text-stone-400 hover:text-stone-600 transition-colors">Annulla</button>
            </div>
          )}

          {/* Convalida confirm inline */}
          {showConvalidaConfirm && (
            <div className={`border rounded-xl px-4 py-4 space-y-3 ${tipoPagamento === 'contanti_nero' ? 'bg-stone-50 border-stone-300' : 'bg-amber-50 border-amber-200'}`}>
              <div className="flex items-start gap-3">
                <AlertCircle size={18} className={`flex-shrink-0 mt-0.5 ${tipoPagamento === 'contanti_nero' ? 'text-stone-500' : 'text-amber-600'}`} />
                <div>
                  <p className={`text-sm font-semibold ${tipoPagamento === 'contanti_nero' ? 'text-stone-700' : 'text-amber-800'}`}>Convalidare la fiche?</p>
                  {tipoPagamento === 'contanti_nero' ? (
                    <p className="text-xs text-stone-600 mt-0.5">
                      <strong>Contanti (non registrati):</strong> l'incasso di €{totale.toFixed(2)} <strong>NON</strong> verrà registrato in Finanze.
                      I prodotti rivendita verranno scalati dal magazzino e i dati inviati alle statistiche normalmente.
                    </p>
                  ) : (
                    <p className="text-xs text-amber-700 mt-0.5">
                      Verrà registrato un incasso di <strong>€{totale.toFixed(2)}</strong> nella sezione Finanze per la data {selectedDate}.
                      {scontoAmt > 0 && <span className="block mt-0.5">Sconto carta applicato: -€{scontoAmt.toFixed(2)}</span>}
                      {creditoPremium > 0 && <span className="block mt-0.5">Credito premium scalato: -€{creditoPremium.toFixed(2)}</span>}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowConvalidaConfirm(false)}
                  className="px-4 py-1.5 text-xs font-medium text-stone-600 border border-stone-200 rounded-lg hover:bg-stone-50">
                  Annulla
                </button>
                <button onClick={handleConvalida} disabled={convalidando}
                  className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50">
                  <ShieldCheck size={12} />
                  {convalidando ? 'Convalida…' : 'Conferma e registra'}
                </button>
              </div>
            </div>
          )}

          {/* Dialogo conferma eliminazione */}
          {showEliminaConfirm && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-4 space-y-3">
              <div className="flex items-start gap-3">
                <AlertCircle size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-red-800">Eliminare questa fiche?</p>
                  <p className="text-xs text-red-700 mt-0.5">
                    {gruppo.ficheConvalidata
                      ? 'La fiche è convalidata. L\'incasso verrà rimosso, le carte ripristinate e lo stock aggiornato.'
                      : 'La fiche verrà eliminata definitivamente.'}
                    {' '}Questa azione non è reversibile.
                  </p>
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowEliminaConfirm(false)}
                  className="px-4 py-1.5 text-xs font-medium text-stone-600 border border-stone-200 rounded-lg hover:bg-stone-50">
                  Annulla
                </button>
                <button onClick={handleElimina} disabled={eliminando}
                  className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50">
                  <Trash2 size={12} />
                  {eliminando ? 'Eliminazione…' : 'Elimina definitivamente'}
                </button>
              </div>
            </div>
          )}

          {eliminaError && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-2">
              <AlertCircle size={15} className="text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-700">{eliminaError}</p>
            </div>
          )}

          <div className="flex justify-between gap-2 pt-1 flex-wrap">
            <button
              onClick={() => { setShowEliminaConfirm(true); setEliminaError(null); }}
              disabled={eliminando}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-red-500 border border-red-200 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              <Trash2 size={14} />
              Elimina
            </button>
            <div className="flex gap-2 flex-wrap justify-end">
              <button onClick={onToggle}
                className="px-4 py-2 text-sm font-medium text-stone-600 border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors">
                Chiudi
              </button>
              {isConvalidata ? (
                <button
                  onClick={handleAnnullaConvalida}
                  disabled={convalidando}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                >
                  <X size={14} />
                  {convalidando ? 'Annullamento…' : 'Annulla convalida'}
                </button>
              ) : (
                <>
                  <button onClick={handleSave} disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-stone-300 text-stone-700 rounded-lg hover:bg-stone-50 transition-colors disabled:opacity-50">
                    <Check size={14} />
                    {saving ? 'Salvataggio…' : 'Salva bozza'}
                  </button>
                  {!showConvalidaConfirm && !showRicaricaAlert && !showRicaricaModal && !showPasswordGate && !showPagamentoModal && (
                    <button
                      onClick={() => {
                        if (!tipoPagamento) {
                          setShowPagamentoModal(true);
                        } else if (saldoInsufficient) {
                          setShowRicaricaAlert(true);
                        } else {
                          setShowConvalidaConfirm(true);
                        }
                      }}
                      disabled={voci.length === 0}
                      className="flex items-center gap-2 px-5 py-2 text-sm font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-40"
                    >
                      <ShieldCheck size={14} />
                      Convalida fiche
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Password gate ricarica */}
      {showPasswordGate && cartaPremium && (
        <PasswordGateModal
          titolo="Ricarica carta premium"
          descrizione={`Inserisci la password per ricaricare la carta ${cartaPremium.codice}.`}
          onSuccess={() => { setShowPasswordGate(false); setRicaricaImporto(100); setShowRicaricaModal(true); }}
          onClose={() => { setShowPasswordGate(false); }}
        />
      )}

      {/* Modal ricarica inline */}
      {showRicaricaModal && cartaPremium && (
        <FicheRicaricaModal
          carta={cartaPremium}
          selectedDate={selectedDate}
          onClose={() => setShowRicaricaModal(false)}
          onSaved={(nuovoSaldo, importo, prezzoClientePagato, tipo) => {
            setCartePremium(prev => prev.map(c => c.id === cartaPremium.id ? { ...c, saldo: nuovoSaldo } : c));
            setRicaricaImporto(0);
            setShowRicaricaModal(false);
            setShowConvalidaConfirm(true);
            if (tipo === 'standard') {
              setSmsModal({ azione: { tipo: 'ricarica', credito: importo, prezzoClientePagato, nuovoSaldo } });
            } else {
              setSmsModal({ azione: { tipo: 'ricarica_gratuita', credito: importo, nuovoSaldo } });
            }
          }}
        />
      )}
      {smsModal && (
        <SmsCartaModal
          nominativo={`${gruppo.clienteNome} ${gruppo.clienteCognome}`.trim()}
          codice={smsModal.codiceOverride ?? cartaPremium?.codice ?? ''}
          telefono={clienteTelefono}
          azione={smsModal.azione}
          onClose={() => { setSmsModal(null); onConvalidata(); }}
        />
      )}
    </div>
  );
}

// ─── FicheRicaricaModal ───────────────────────────────────────────────────────

function FicheRicaricaModal({ carta, selectedDate, onClose, onSaved }: {
  carta: CartaPremiumSimple;
  selectedDate: string;
  onClose: () => void;
  onSaved: (nuovoSaldo: number, importo: number, prezzoCliente: number, tipo: string) => void;
}) {
  const { user } = useAuth();
  const IMPORTI_RAPIDI = [100, 150, 200, 300, 400, 500];
  const [importo, setImporto] = useState(100);
  const [noteR, setNoteR] = useState('');
  const [tipo, setTipo] = useState<'standard' | 'gratuito'>('standard');
  const [tipoPagamento, setTipoPagamento] = useState<TipoPagamento>(null);
  const [saving, setSaving] = useState(false);

  const prezzoCliente = tipo === 'standard' ? Math.floor(importo * (250 / 300) / 10) * 10 : 0;

  async function save() {
    setSaving(true);
    const nuovoSaldo = carta.saldo + importo;
    await dbInsert({ table: 'ricariche_carta_premium', data: {
      carta_premium_id: carta.id, importo, note: noteR, tipo_ricarica: tipo, user_id: user?.id,
    } });
    await dbUpdate({ table: 'carte_premium', id: carta.id, data: { saldo: nuovoSaldo, attiva: true } });
    if (tipo === 'standard' && tipoPagamento !== 'contanti_nero') {
      await dbInsert({ table: 'incassi_giornalieri', data: {
        data: selectedDate,
        fiche_id: null,
        cliente_nome: `Ricarica carta ${carta.codice}`,
        importo: prezzoCliente,
        note: `Ricarica carta premium: credito €${importo}, pagato €${prezzoCliente}`,
        user_id: user?.id,
      } });
    }
    setSaving(false);
    onSaved(nuovoSaldo, importo, prezzoCliente, tipo);
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-emerald-100 rounded-lg flex items-center justify-center">
              <Euro size={13} className="text-emerald-600" />
            </div>
            <div>
              <p className="font-bold text-stone-800 text-sm">Ricarica carta premium</p>
              <p className="text-xs text-stone-400 font-mono">{carta.codice} · saldo attuale €{carta.saldo.toFixed(2)}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-stone-100 rounded-lg transition-colors">
            <X size={15} className="text-stone-500" />
          </button>
        </div>
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Tipo ricarica */}
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setTipo('standard')}
              className={`flex flex-col items-center gap-1 px-3 py-2.5 rounded-xl border text-sm font-semibold transition-colors ${tipo === 'standard' ? 'bg-emerald-500 text-white border-emerald-500' : 'border-stone-200 text-stone-600 hover:bg-stone-50'}`}>
              <Euro size={13} />
              Ricarica standard
            </button>
            <button onClick={() => setTipo('gratuito')}
              className={`flex flex-col items-center gap-1 px-3 py-2.5 rounded-xl border text-sm font-semibold transition-colors ${tipo === 'gratuito' ? 'bg-sky-500 text-white border-sky-500' : 'border-stone-200 text-stone-600 hover:bg-stone-50'}`}>
              <Plus size={13} />
              Credito extra gratuito
            </button>
          </div>
          {tipo === 'gratuito' && (
            <p className="text-xs text-sky-600 bg-sky-50 rounded-lg px-3 py-2">
              Credito bonus: nessun incasso registrato e nessuna detrazione applicata.
            </p>
          )}
          {tipo === 'standard' && (
            <div>
              <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">Metodo di pagamento</label>
              <div className="grid grid-cols-3 gap-1.5">
                <button onClick={() => setTipoPagamento('cc_bancomat')}
                  className={`flex flex-col items-center gap-1 px-2 py-2 rounded-xl border text-xs font-semibold transition-colors ${tipoPagamento === 'cc_bancomat' ? 'bg-blue-500 text-white border-blue-500' : 'border-stone-200 text-stone-600 hover:bg-stone-50'}`}>
                  <CreditCard size={12} />
                  CC/Bancomat
                </button>
                <button onClick={() => setTipoPagamento('contanti_verde')}
                  className={`flex flex-col items-center gap-1 px-2 py-2 rounded-xl border text-xs font-semibold transition-colors ${tipoPagamento === 'contanti_verde' ? 'bg-emerald-500 text-white border-emerald-500' : 'border-stone-200 text-stone-600 hover:bg-stone-50'}`}>
                  <span className={`w-2.5 h-2.5 rounded-full ${tipoPagamento === 'contanti_verde' ? 'bg-white' : 'bg-emerald-500'}`} />
                  Contanti
                </button>
                <button onClick={() => setTipoPagamento('contanti_nero')}
                  className={`flex flex-col items-center gap-1 px-2 py-2 rounded-xl border text-xs font-semibold transition-colors ${tipoPagamento === 'contanti_nero' ? 'bg-stone-800 text-white border-stone-800' : 'border-stone-200 text-stone-600 hover:bg-stone-50'}`}>
                  <span className={`w-2.5 h-2.5 rounded-full ${tipoPagamento === 'contanti_nero' ? 'bg-white' : 'bg-stone-800'}`} />
                  Contanti
                </button>
              </div>
            </div>
          )}
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
            <div className="bg-emerald-50 rounded-xl p-3 flex justify-between text-sm">
              <span className="text-emerald-700">Nuovo saldo dopo ricarica</span>
              <span className="font-bold text-emerald-700">€{(carta.saldo + importo).toFixed(2)}</span>
            </div>
            {tipo === 'standard' && (
              <div className="bg-amber-50 rounded-xl p-3 border border-amber-100">
                <div className="flex justify-between text-sm">
                  <span className="text-amber-700 font-medium">La cliente paga</span>
                  <span className="font-bold text-amber-700 text-base">€{prezzoCliente}</span>
                </div>
                <p className="text-xs text-amber-500 mt-1">Credito carta: €{importo} · Incasso: €{prezzoCliente}</p>
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1.5">Note (opzionale)</label>
            <input value={noteR} onChange={e => setNoteR(e.target.value)} placeholder="Motivazione…"
              className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-400" />
          </div>
        </div>
        <div className="flex gap-3 px-5 pb-5 flex-shrink-0">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-stone-200 text-sm font-medium text-stone-600 hover:bg-stone-50">Annulla</button>
          <button onClick={save} disabled={saving || importo <= 0 || (tipo === 'standard' && !tipoPagamento)}
            className={`flex-1 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50 ${tipo === 'gratuito' ? 'bg-sky-500 hover:bg-sky-600' : 'bg-emerald-500 hover:bg-emerald-600'}`}>
            {saving ? 'Ricarica…' : tipo === 'gratuito' ? `Aggiungi credito +€${importo}` : tipoPagamento ? `Ricarica · paga €${prezzoCliente}` : 'Seleziona pagamento'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── VoceRow ──────────────────────────────────────────────────────────────────

interface VoceRowProps {
  voce: FicheVoce;
  parrucchieri: ParrucchiereSimple[];
  onChange: (patch: Partial<FicheVoce>) => void;
  onRemove: () => void;
  listinoPrezzoOverride?: number;
}

function VoceRow({ voce, parrucchieri, onChange, onRemove, listinoPrezzoOverride }: VoceRowProps) {
  const [editing, setEditing] = useState(false);
  const [nomeStr, setNomeStr] = useState(voce.nome_voce);
  const [prezzoStr, setPrezzoStr] = useState(voce.prezzo.toFixed(2));
  const [parrId, setParrId] = useState(voce.parrucchiere_id ?? '');
  const [editingPrezzo, setEditingPrezzo] = useState(false);
  const [inlinePrezzoStr, setInlinePrezzoStr] = useState(voce.prezzo.toFixed(2));

  function openEdit() {
    setNomeStr(voce.nome_voce);
    setPrezzoStr(voce.prezzo.toFixed(2));
    setParrId(voce.parrucchiere_id ?? '');
    setEditing(true);
  }

  function commitEdit() {
    const prezzo = parseFloat(prezzoStr);
    const parr = parrucchieri.find(p => p.id === parrId);
    onChange({
      nome_voce: nomeStr.trim() || voce.nome_voce,
      prezzo: isNaN(prezzo) ? voce.prezzo : prezzo,
      parrucchiere_id: parrId || null,
      nome_parrucchiere: parr?.nome ?? '',
    });
    setEditing(false);
  }

  function cancelEdit() { setEditing(false); }

  if (editing) {
    return (
      <div className={`px-4 py-3 border-b border-stone-100 last:border-0 space-y-2 ${voce.tipo === 'extra' ? 'bg-amber-50/40' : 'bg-stone-50/60'}`}>
        <div className="flex items-center gap-2 mb-1">
          {voce.tipo === 'extra' && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 uppercase tracking-wide">extra</span>
          )}
          <span className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Modifica voce</span>
        </div>

        {/* Nome servizio */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-stone-500 w-20 flex-shrink-0">Servizio</label>
          <input
            autoFocus
            type="text"
            value={nomeStr}
            onChange={e => setNomeStr(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') cancelEdit(); }}
            className="flex-1 border border-stone-200 rounded-lg px-2.5 py-1.5 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </div>

        {/* Parrucchiere */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-stone-500 w-20 flex-shrink-0">Parrucchiere</label>
          <select
            value={parrId}
            onChange={e => setParrId(e.target.value)}
            className="flex-1 border border-stone-200 rounded-lg px-2.5 py-1.5 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
          >
            <option value="">— nessuno —</option>
            {parrucchieri.map(p => (
              <option key={p.id} value={p.id}>{p.nome}</option>
            ))}
          </select>
        </div>

        {/* Prezzo */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-stone-500 w-20 flex-shrink-0">Prezzo (€)</label>
          <input
            type="number"
            onInput={e => { const t = e.currentTarget; if (t.value.length > 1 && t.value.startsWith('0') && !t.value.startsWith('0.')) t.value = String(Number(t.value)); }}
            min={0}
            step={0.5}
            value={prezzoStr}
            onChange={e => setPrezzoStr(e.target.value)}
            onFocus={e => e.target.select()}
            onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') cancelEdit(); }}
            className="w-28 border border-stone-200 rounded-lg px-2.5 py-1.5 text-sm text-right text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </div>

        <div className="flex gap-2 justify-end pt-1">
          <button onClick={cancelEdit} className="px-3 py-1.5 text-xs font-medium text-stone-500 border border-stone-200 rounded-lg hover:bg-stone-100 transition-colors">
            Annulla
          </button>
          <button onClick={commitEdit} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors">
            <Check size={11} />
            Applica
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-3 px-4 py-2.5 border-b border-stone-50 last:border-0 group ${voce.tipo === 'extra' ? 'bg-amber-50/40' : ''}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {voce.tipo === 'extra' && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 uppercase tracking-wide flex-shrink-0">extra</span>
          )}
          <span className="text-sm font-medium text-stone-800 truncate">{voce.nome_voce}</span>
        </div>
        {voce.nome_parrucchiere && <p className="text-xs text-stone-400 mt-0.5">{voce.nome_parrucchiere}</p>}
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {editingPrezzo ? (
          <input
            autoFocus
            type="number"
            onInput={e => { const t = e.currentTarget; if (t.value.length > 1 && t.value.startsWith('0') && !t.value.startsWith('0.')) t.value = String(Number(t.value)); }}
            min={0}
            step={0.5}
            value={inlinePrezzoStr}
            onChange={e => setInlinePrezzoStr(e.target.value)}
            onFocus={e => e.target.select()}
            onBlur={() => {
              const p = parseFloat(inlinePrezzoStr);
              onChange({ prezzo: isNaN(p) ? voce.prezzo : p });
              setEditingPrezzo(false);
            }}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                const p = parseFloat(inlinePrezzoStr);
                onChange({ prezzo: isNaN(p) ? voce.prezzo : p });
                setEditingPrezzo(false);
              }
              if (e.key === 'Escape') {
                setInlinePrezzoStr(voce.prezzo.toFixed(2));
                setEditingPrezzo(false);
              }
            }}
            className="w-20 border border-amber-300 rounded-lg px-2 py-0.5 text-sm text-right font-semibold text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
          />
        ) : listinoPrezzoOverride !== undefined ? (
          <span className="flex items-center gap-1.5">
            <span className="text-sm font-bold text-orange-600">€{listinoPrezzoOverride.toFixed(2)}</span>
            {voce.prezzo !== listinoPrezzoOverride && (
              <span className="text-xs text-stone-400 line-through">€{voce.prezzo.toFixed(2)}</span>
            )}
          </span>
        ) : (
          <span
            onClick={() => {
              setInlinePrezzoStr(voce.prezzo.toFixed(2));
              setEditingPrezzo(true);
            }}
            title="Clicca per modificare il prezzo"
            className="text-sm font-semibold text-stone-700 cursor-pointer hover:text-amber-600 hover:underline decoration-dotted underline-offset-2 transition-colors"
          >
            €{voce.prezzo.toFixed(2)}
          </span>
        )}
        <button
          onClick={openEdit}
          title="Modifica voce"
          className="p-1 text-stone-300 hover:text-amber-500 transition-colors rounded opacity-0 group-hover:opacity-100"
        >
          <Pencil size={12} />
        </button>
      </div>
      <button onClick={onRemove} className="text-stone-300 hover:text-red-400 transition-colors flex-shrink-0">
        <Trash2 size={14} />
      </button>
    </div>
  );
}

// ─── Layout configs ───────────────────────────────────────────────────────────

const LAYOUT_OPTIONS = [
  { value: 1, label: '1 per pagina', cols: 1, rows: 1 },
  { value: 2, label: '2 per pagina', cols: 1, rows: 2 },
  { value: 4, label: '4 per pagina', cols: 2, rows: 2 },
  { value: 6, label: '6 per pagina', cols: 2, rows: 3 },
  { value: 9, label: '9 per pagina', cols: 3, rows: 3 },
] as const;

type LayoutOption = typeof LAYOUT_OPTIONS[number];

// ─── Selezione Parrucchiere Modal ─────────────────────────────────────────────

interface SelezioneParrucchiereModalProps {
  titolo: ReactNode;
  parrucchieri: ParrucchiereSimple[];
  selectedParrId: string;
  onSelectParr: (id: string) => void;
  onAnnulla: () => void;
  onConferma: () => void;
  labelConferma: string;
  accentColor: 'stone' | 'amber';
}

function SelezioneParrucchiereModal({ titolo, parrucchieri, selectedParrId, onSelectParr, onAnnulla, onConferma, labelConferma, accentColor }: SelezioneParrucchiereModalProps) {
  const confirmCls = accentColor === 'amber'
    ? 'bg-amber-500 hover:bg-amber-600 text-white'
    : 'bg-stone-700 hover:bg-stone-800 text-white';

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[70] flex items-center justify-center p-4" onClick={onAnnulla}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm border border-stone-100"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-5 pt-5 pb-4 space-y-4">
          <p className="text-sm text-stone-700">{titolo}</p>

          <div className="flex flex-wrap gap-2">
            {parrucchieri.map(p => (
              <button key={p.id} type="button"
                onClick={() => onSelectParr(p.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium border transition-all ${selectedParrId === p.id ? 'text-white border-transparent' : 'text-stone-700 border-stone-200 hover:bg-stone-50'}`}
                style={selectedParrId === p.id ? { backgroundColor: p.colore, borderColor: p.colore } : {}}
              >
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: p.colore }} />
                {p.nome}
              </button>
            ))}
            <button type="button"
              onClick={() => onSelectParr('')}
              className={`px-3 py-2 rounded-full text-sm font-medium border transition-all ${selectedParrId === '' ? 'bg-stone-700 text-white border-stone-700' : 'text-stone-500 border-stone-200 hover:bg-stone-50'}`}
            >
              Nessuno
            </button>
          </div>

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onAnnulla}
              className="flex-1 py-2.5 rounded-xl border border-stone-200 text-sm font-medium text-stone-600 hover:bg-stone-50 transition-colors">
              Annulla
            </button>
            <button type="button" onClick={onConferma}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold transition-colors ${confirmCls}`}>
              <Check size={13} />
              {labelConferma}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Bulk Pagamento Modal ─────────────────────────────────────────────────────

interface BulkPagamentoModalProps {
  count: number;
  selectedDate: string;
  selected: 'cc_bancomat' | 'contanti_verde' | 'contanti_nero' | null;
  onSelect: (tip: 'cc_bancomat' | 'contanti_verde' | 'contanti_nero') => void;
  onNext: () => void;
  onClose: () => void;
}

function BulkPagamentoModal({ count, selectedDate, selected, onSelect, onNext, onClose }: BulkPagamentoModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
              <ShieldCheck size={15} className="text-emerald-600" />
            </div>
            <div>
              <p className="font-bold text-stone-800 text-sm">Convalida tutte le fiches</p>
              <p className="text-xs text-stone-400">{count} fiche · {selectedDate}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-stone-100 rounded-lg transition-colors">
            <X size={15} className="text-stone-500" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-stone-500">
            Seleziona il metodo di pagamento che verrà applicato a tutte le fiches non ancora convalidate.
          </p>

          <div className="space-y-2">
            <button
              onClick={() => onSelect('cc_bancomat')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all text-left ${selected === 'cc_bancomat' ? 'border-blue-500 bg-blue-50' : 'border-stone-200 hover:border-stone-300 hover:bg-stone-50'}`}
            >
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${selected === 'cc_bancomat' ? 'bg-blue-100' : 'bg-stone-100'}`}>
                <CreditCard size={16} className={selected === 'cc_bancomat' ? 'text-blue-600' : 'text-stone-500'} />
              </div>
              <div>
                <p className={`text-sm font-semibold ${selected === 'cc_bancomat' ? 'text-blue-700' : 'text-stone-700'}`}>CC / Bancomat</p>
                <p className="text-xs text-stone-400">Pagamento elettronico — registrato in Finanze</p>
              </div>
              {selected === 'cc_bancomat' && <div className="ml-auto w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center"><div className="w-2 h-2 rounded-full bg-white" /></div>}
            </button>

            <button
              onClick={() => onSelect('contanti_verde')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all text-left ${selected === 'contanti_verde' ? 'border-emerald-500 bg-emerald-50' : 'border-stone-200 hover:border-stone-300 hover:bg-stone-50'}`}
            >
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${selected === 'contanti_verde' ? 'bg-emerald-100' : 'bg-stone-100'}`}>
                <Banknote size={16} className={selected === 'contanti_verde' ? 'text-emerald-600' : 'text-stone-500'} />
              </div>
              <div>
                <p className={`text-sm font-semibold ${selected === 'contanti_verde' ? 'text-emerald-700' : 'text-stone-700'}`}>Contanti dichiarati</p>
                <p className="text-xs text-stone-400">Contanti regolari — registrati in Finanze</p>
              </div>
              {selected === 'contanti_verde' && <div className="ml-auto w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center"><div className="w-2 h-2 rounded-full bg-white" /></div>}
            </button>

            <button
              onClick={() => onSelect('contanti_nero')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all text-left ${selected === 'contanti_nero' ? 'border-stone-700 bg-stone-800' : 'border-stone-200 hover:border-stone-400 hover:bg-stone-50'}`}
            >
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${selected === 'contanti_nero' ? 'bg-stone-600' : 'bg-stone-100'}`}>
                <Banknote size={16} className={selected === 'contanti_nero' ? 'text-stone-200' : 'text-stone-500'} />
              </div>
              <div>
                <p className={`text-sm font-semibold ${selected === 'contanti_nero' ? 'text-stone-100' : 'text-stone-700'}`}>Contanti non dichiarati</p>
                <p className={`text-xs ${selected === 'contanti_nero' ? 'text-stone-400' : 'text-stone-400'}`}>Non registrati in Finanze</p>
              </div>
              {selected === 'contanti_nero' && <div className="ml-auto w-4 h-4 rounded-full bg-stone-400 flex items-center justify-center"><div className="w-2 h-2 rounded-full bg-stone-800" /></div>}
            </button>
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-stone-200 text-sm font-medium text-stone-600 hover:bg-stone-50 transition-colors">
              Annulla
            </button>
            <button
              onClick={onNext}
              disabled={!selected}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-sm font-semibold transition-colors"
            >
              <ShieldCheck size={14} />
              Continua
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Print Modal ──────────────────────────────────────────────────────────────

interface PrintModalProps {
  gruppi: ClienteGruppo[];
  onClose: () => void;
  autoExportDate?: string | null;
}

type PrintFilter = 'tutte' | 'normali' | 'nero';

function PrintModal({ gruppi, onClose, autoExportDate }: PrintModalProps) {
  const printPagesRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<LayoutOption>(() => {
    const saved = localStorage.getItem('fiches_print_layout');
    return LAYOUT_OPTIONS.find(o => o.value === Number(saved)) ?? LAYOUT_OPTIONS[4];
  });
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [printFilter, setPrintFilter] = useState<PrintFilter>('tutte');

  function buildFichePreview(g: ClienteGruppo) {
    const voci = g.voci.length > 0 ? g.voci : g.appuntamenti.flatMap(app => {
      const parr = app.parrucchieri;
      return (app.appuntamento_trattamenti || []).map(t => ({
        nome_voce: t.nome_trattamento, nome_parrucchiere: parr?.nome ?? '',
        prezzo: t.prezzo, tipo: 'servizio' as const,
      }));
    });
    const totale = voci.reduce((s, v) => s + v.prezzo, 0);
    const orari = g.appuntamenti.map(a => new Date(a.data_ora).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })).join(', ');
    const parrNomi = Array.from(new Set(voci.filter(v => v.nome_parrucchiere).map(v => v.nome_parrucchiere))).join(', ');
    return { g, voci, totale, orari, parrNomi };
  }

  const allPreviews = gruppi.map(buildFichePreview);
  const previews = printFilter === 'normali'
    ? allPreviews.filter(p => p.g.tipoPagamento !== 'contanti_nero')
    : printFilter === 'nero'
    ? allPreviews.filter(p => p.g.tipoPagamento === 'contanti_nero')
    : allPreviews;
  const countNero = allPreviews.filter(p => p.g.tipoPagamento === 'contanti_nero').length;
  const countNormali = allPreviews.filter(p => p.g.tipoPagamento !== 'contanti_nero').length;
  const perPage = layout.value;
  const pages: (typeof previews)[] = [];
  for (let i = 0; i < previews.length; i += perPage) pages.push(previews.slice(i, i + perPage));

  useEffect(() => {
    if (!autoExportDate) return;
    const timer = setTimeout(async () => {
      if (!printPagesRef.current) { onClose(); return; }
      setGeneratingPdf(true);
      try {
        const dateLabel = autoExportDate;
        const normali = previews.filter(p => p.g.tipoPagamento !== 'contanti_nero');
        const neri = previews.filter(p => p.g.tipoPagamento === 'contanti_nero');

        // Helper: build PDF from a subset of previews using a fresh jsPDF
        const buildSplitPdf = async (subset: typeof previews) => {
          const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
          const pageImgs = await capturePagesFromRoot();
          for (let i = 0; i < pageImgs.length; i++) {
            if (i > 0) pdf.addPage();
            pdf.addImage(pageImgs[i], 'JPEG', 0, 0, 210, 297);
          }
          const incassoTotale = subset.reduce((sum, p) => sum + p.totale, 0);
          pdf.addPage();
          pdf.setFont('helvetica', 'bold'); pdf.setFontSize(16); pdf.setTextColor(28, 25, 23);
          pdf.text('Riepilogo incasso', 14, 24);
          pdf.setFont('helvetica', 'normal'); pdf.setFontSize(10); pdf.setTextColor(120, 113, 108);
          pdf.text(dateLabel, 14, 31);
          pdf.setDrawColor(231, 229, 228); pdf.line(14, 34, 196, 34);
          let y = 42; pdf.setFontSize(9);
          for (const p of subset) {
            const nome = p.g.clienteId.startsWith('__premium__')
              ? `Carta Premium — ${`${p.g.clienteNome} ${p.g.clienteCognome}`.trim()}`
              : `${p.g.clienteNome} ${p.g.clienteCognome}`.trim() || 'Sconosciuto';
            pdf.setTextColor(28, 25, 23); pdf.text(nome, 14, y);
            pdf.setTextColor(28, 100, 58); pdf.text(`€${p.totale.toFixed(2)}`, 180, y, { align: 'right' });
            y += 6; if (y > 270) { pdf.addPage(); y = 20; }
          }
          pdf.setDrawColor(231, 229, 228); pdf.line(14, y, 196, y); y += 6;
          pdf.setFont('helvetica', 'bold'); pdf.setFontSize(11); pdf.setTextColor(28, 25, 23);
          pdf.text('Totale incasso', 14, y);
          pdf.setTextColor(22, 163, 74); pdf.text(`€${incassoTotale.toFixed(2)}`, 180, y, { align: 'right' });
          return pdf;
        };

        if (normali.length > 0) {
          const pdf = await buildSplitPdf(normali);
          const filename = `fiches_${dateLabel.replace(/\s/g, '-')}.pdf`;
          await saveFile('fiches', filename, pdf.output('blob'));
        }
        if (neri.length > 0) {
          const pdf = await buildSplitPdf(neri);
          const filename = `fiches_contanti_${dateLabel.replace(/\s/g, '-')}.pdf`;
          await saveFile('fiches_nero', filename, pdf.output('blob'));
        }
        if (normali.length === 0 && neri.length === 0) {
          // No fiches — save empty to mark done
          const pdf = await buildSplitPdf(previews);
          const filename = `fiches_${dateLabel.replace(/\s/g, '-')}.pdf`;
          await saveFile('fiches', filename, pdf.output('blob'));
        }
      } finally {
        setGeneratingPdf(false);
        onClose();
      }
    }, 800);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoExportDate]);

  function gridStyle(): React.CSSProperties {
    return { display: 'grid', gridTemplateColumns: `repeat(${layout.cols}, 1fr)`, gridTemplateRows: `repeat(${layout.rows}, 1fr)`, gap: '3mm', height: '277mm' };
  }

  async function capturePagesFromRoot(): Promise<string[]> {
    const A4_W = 794;  // 210mm at 96dpi
    const A4_H = 1123; // 297mm at 96dpi
    const root = document.getElementById('__fiches_print_root__');
    if (!root) return [];

    const rAF = () => new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r())));

    // Move root off-screen (above viewport) with exact A4 pixel width
    const origRootStyle = root.style.cssText;
    root.style.cssText = `position:absolute;top:-${A4_H * 10}px;left:0;width:${A4_W}px;background:white;`;
    await rAF();

    const pageEls = Array.from(root.children) as HTMLElement[];
    const results: string[] = [];

    for (const pageEl of pageEls) {
      const origPageStyle = pageEl.style.cssText;
      pageEl.style.cssText = `width:${A4_W}px;min-height:${A4_H}px;padding:8mm;box-sizing:border-box;background:white;`;
      await rAF();

      const canvas = await html2canvas(pageEl, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        width: A4_W,
        height: A4_H,
        windowWidth: 1920,
      });
      results.push(canvas.toDataURL('image/jpeg', 0.92));
      pageEl.style.cssText = origPageStyle;
    }

    root.style.cssText = origRootStyle;
    return results;
  }

  function doPrint() {
    const styleEl = document.createElement('style');
    styleEl.innerHTML = `@media print { body > *:not(#__fiches_print_root__) { display: none !important; } #__fiches_print_root__ { display: block !important; } @page { size: A4 portrait; margin: 8mm; } }`;
    document.head.appendChild(styleEl);
    const root = document.getElementById('__fiches_print_root__');
    if (root) root.style.display = 'block';
    window.print();
    document.head.removeChild(styleEl);
    if (root) root.style.display = 'none';
  }

  async function doSavePdf(dateLabel?: string) {
    setGeneratingPdf(true);
    try {
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageImgs = await capturePagesFromRoot();
      for (let i = 0; i < pageImgs.length; i++) {
        if (i > 0) pdf.addPage();
        pdf.addImage(pageImgs[i], 'JPEG', 0, 0, 210, 297);
      }

      // Pagina riepilogo incasso
      const incassoTotale = previews.reduce((sum, p) => sum + p.totale, 0);
      pdf.addPage();
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(16);
      pdf.setTextColor(28, 25, 23);
      pdf.text('Riepilogo incasso', 14, 24);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.setTextColor(120, 113, 108);
      pdf.text(dateLabel ?? localDateStr(), 14, 31);
      pdf.setDrawColor(231, 229, 228);
      pdf.line(14, 34, 196, 34);
      let y = 42;
      pdf.setFontSize(9);
      for (const p of previews) {
        const nome = p.g.clienteId.startsWith('__premium__')
          ? `Carta Premium — ${`${p.g.clienteNome} ${p.g.clienteCognome}`.trim()}`
          : `${p.g.clienteNome} ${p.g.clienteCognome}`.trim() || 'Sconosciuto';
        pdf.setTextColor(28, 25, 23);
        pdf.text(nome, 14, y);
        pdf.setTextColor(28, 100, 58);
        pdf.text(`€${p.totale.toFixed(2)}`, 180, y, { align: 'right' });
        y += 6;
        if (y > 270) { pdf.addPage(); y = 20; }
      }
      pdf.setDrawColor(231, 229, 228);
      pdf.line(14, y, 196, y);
      y += 6;
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(11);
      pdf.setTextColor(28, 25, 23);
      pdf.text('Totale incasso', 14, y);
      pdf.setTextColor(22, 163, 74);
      pdf.text(`€${incassoTotale.toFixed(2)}`, 180, y, { align: 'right' });

      const isNero = printFilter === 'nero';
      const filename = isNero
        ? `fiches_contanti_${(dateLabel ?? localDateStr()).replace(/\s/g, '-')}.pdf`
        : `fiches_${(dateLabel ?? localDateStr()).replace(/\s/g, '-')}.pdf`;
      await saveFile(isNero ? 'fiches_nero' : 'fiches', filename, pdf.output('blob'));
    } finally { setGeneratingPdf(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex flex-col">
      <div className="flex-shrink-0 bg-white border-b border-stone-200 px-6 py-3 flex items-center gap-4 shadow-sm">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <h2 className="font-bold text-stone-800 whitespace-nowrap">Anteprima stampa</h2>
          <span className="text-sm text-stone-400 whitespace-nowrap">{previews.length} convalidat{previews.length === 1 ? 'a' : 'e'} · {pages.length} pag.</span>
          <span className="text-sm font-semibold text-emerald-600 whitespace-nowrap">Totale: €{previews.reduce((s, p) => s + p.totale, 0).toFixed(2)}</span>
        </div>
        {/* Filtro tipo pagamento */}
        <div className="flex gap-1 bg-stone-100 p-0.5 rounded-lg flex-shrink-0">
          <button onClick={() => setPrintFilter('tutte')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all whitespace-nowrap ${printFilter === 'tutte' ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}>
            Tutte ({allPreviews.length})
          </button>
          <button onClick={() => setPrintFilter('normali')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all whitespace-nowrap ${printFilter === 'normali' ? 'bg-white text-emerald-700 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}>
            Dichiarate ({countNormali})
          </button>
          {countNero > 0 && (
            <button onClick={() => setPrintFilter('nero')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all whitespace-nowrap ${printFilter === 'nero' ? 'bg-stone-800 text-white shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}>
              Non dichiarate ({countNero})
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-stone-500 whitespace-nowrap">Per pagina:</span>
          <div className="flex gap-1 bg-stone-100 p-0.5 rounded-lg">
            {LAYOUT_OPTIONS.map(opt => (
              <button key={opt.value} onClick={() => { setLayout(opt); localStorage.setItem('fiches_print_layout', String(opt.value)); }}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${layout.value === opt.value ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}>
                {opt.value}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={doPrint} className="flex items-center gap-2 px-4 py-2 bg-stone-700 hover:bg-stone-600 text-white text-sm font-medium rounded-lg transition-colors">
            <Printer size={14} />Stampa
          </button>
          <button onClick={() => doSavePdf()} disabled={generatingPdf || previews.length === 0} className={`flex items-center gap-2 px-4 py-2 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors ${printFilter === 'nero' ? 'bg-stone-700 hover:bg-stone-600' : 'bg-amber-500 hover:bg-amber-600'}`}>
            <Download size={14} />{generatingPdf ? 'Generazione…' : 'Salva PDF'}
          </button>
          <button onClick={onClose} className="ml-1 text-stone-400 hover:text-stone-700 transition-colors p-1"><X size={20} /></button>
        </div>
      </div>

      <div className={`flex-1 overflow-auto p-6 ${printFilter === 'nero' ? 'bg-stone-800' : 'bg-stone-200'}`}>
        {printFilter === 'nero' && (
          <div className="text-center mb-3">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-stone-700 text-stone-200 text-xs font-semibold rounded-full">
              <span className="w-2 h-2 rounded-full bg-stone-400" />
              Fiches contanti non dichiarati — anteprima separata
            </span>
          </div>
        )}
        <div ref={printPagesRef} className="space-y-6">
          {previews.length === 0 ? (
            <div className="text-center py-20">
              <p className={`text-sm font-medium ${printFilter === 'nero' ? 'text-stone-400' : 'text-stone-500'}`}>
                Nessuna fiche {printFilter === 'nero' ? 'con contanti non dichiarati' : 'dichiarata'} per questa giornata.
              </p>
            </div>
          ) : pages.map((page, pi) => (
            <div key={pi} data-print-page className="bg-white shadow-lg mx-auto" style={{ width: '210mm', minHeight: '297mm', padding: '8mm', boxSizing: 'border-box', borderTop: printFilter === 'nero' ? '4px solid #1c1917' : undefined }}>
              <div style={gridStyle()}>
                {page.map((p, idx) => <PrintFiche key={idx} preview={p} />)}
                {Array.from({ length: perPage - page.length }).map((_, i) => (
                  <div key={`empty-${i}`} className="border border-dashed border-stone-200 rounded" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div id="__fiches_print_root__" style={{ display: 'none' }}>
        {pages.map((page, pi) => (
          <div key={pi} style={{ width: '100%', pageBreakAfter: pi < pages.length - 1 ? 'always' : 'auto', boxSizing: 'border-box' }}>
            <div style={gridStyle()}>
              {page.map((p, idx) => <PrintFiche key={idx} preview={p} forPrint />)}
              {Array.from({ length: perPage - page.length }).map((_, i) => (
                <div key={`empty-${i}`} style={{ border: '1px dashed #ccc', borderRadius: '4px' }} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface FichePreview {
  g: ClienteGruppo;
  voci: { nome_voce: string; nome_parrucchiere: string; prezzo: number; tipo: string }[];
  totale: number;
  orari: string;
  parrNomi: string;
}

function fmtConvalidataAt(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const data = d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const ora = d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  return `Convalidata il ${data} alle ${ora}`;
}

function PrintFiche({ preview, forPrint = false }: { preview: FichePreview; forPrint?: boolean }) {
  const { g, voci, totale, orari, parrNomi } = preview;
  const MAX_VOCI = 10;
  const visibleVoci = voci.slice(0, MAX_VOCI);
  const hidden = voci.length - visibleVoci.length;
  const convalidataLabel = fmtConvalidataAt(g.convalidataAt ?? null);

  const isCartaPremiumPrint = g.clienteId.startsWith('__premium__');

  if (forPrint) {
    return (
      <div style={{ border: '1px solid #333', borderRadius: '4px', padding: '4mm', fontSize: '8pt', fontFamily: 'Arial, sans-serif', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxSizing: 'border-box' }}>
        <div style={{ borderBottom: '1px solid #ddd', paddingBottom: '2mm', marginBottom: '2mm' }}>
          {isCartaPremiumPrint ? (
            <>
              <div style={{ fontWeight: 'bold', fontSize: '9pt', color: '#92400E' }}>Fiche automatica carta premium</div>
              <div style={{ color: '#666', fontSize: '7pt' }}>{g.clienteNome} {g.clienteCognome}</div>
            </>
          ) : (
            <>
              <div style={{ fontWeight: 'bold', fontSize: '9pt' }}>{g.clienteNome} {g.clienteCognome}</div>
              <div style={{ color: '#666', fontSize: '7pt' }}>{orari}{parrNomi ? ` · ${parrNomi}` : ''}</div>
            </>
          )}
        </div>
        <div style={{ flex: 1 }}>
          {visibleVoci.map((v, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '1mm 0', borderBottom: '0.5px solid #f0f0f0' }}>
              <div style={{ flex: 1, wordBreak: 'break-word', minWidth: 0 }}>
                <span style={{ fontSize: '7.5pt' }}>{v.nome_voce}</span>
                {v.nome_parrucchiere && <span style={{ color: '#888', fontSize: '6.5pt', marginLeft: '2mm' }}>{v.nome_parrucchiere}</span>}
              </div>
              <span style={{ fontWeight: '600', fontSize: '7.5pt', marginLeft: '2mm', flexShrink: 0 }}>€{v.prezzo.toFixed(2)}</span>
            </div>
          ))}
          {hidden > 0 && <div style={{ color: '#999', fontSize: '6.5pt', marginTop: '1mm' }}>+{hidden} altre voci</div>}
        </div>
        <div style={{ borderTop: '1px solid #333', paddingTop: '2mm', marginTop: 'auto', display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '9pt' }}>
          <span>TOTALE</span><span>€{totale.toFixed(2)}</span>
        </div>
        {g.tipoPagamento && (
          <div style={{ marginTop: '1mm', color: '#555', fontSize: '6.5pt', borderTop: '0.5px solid #eee', paddingTop: '1mm' }}>
            Pagamento: {g.tipoPagamento === 'cc_bancomat' ? 'CC/Bancomat' : 'Contanti'}
          </div>
        )}
        {g.noteEsistenti && (
          <div style={{ marginTop: '1mm', color: '#666', fontSize: '6.5pt', fontStyle: 'italic', borderTop: '0.5px solid #eee', paddingTop: '1mm' }}>{g.noteEsistenti}</div>
        )}
        {convalidataLabel && (
          <div style={{ marginTop: '1mm', color: '#888', fontSize: '6pt', borderTop: '0.5px solid #eee', paddingTop: '1mm' }}>{convalidataLabel}</div>
        )}
      </div>
    );
  }

  return (
    <div className="border border-stone-300 rounded p-2 flex flex-col overflow-hidden bg-white text-[10px]">
      <div className="border-b border-stone-200 pb-1.5 mb-1.5">
        {isCartaPremiumPrint ? (
          <>
            <div className="font-bold text-yellow-700 text-xs leading-tight">Fiche automatica carta premium</div>
            <div className="text-stone-500 text-[9px] truncate">{g.clienteNome} {g.clienteCognome}</div>
          </>
        ) : (
          <>
            <div className="font-bold text-stone-800 text-xs leading-tight">{g.clienteNome} {g.clienteCognome}</div>
            <div className="text-stone-400 text-[9px] truncate">{orari}{parrNomi ? ` · ${parrNomi}` : ''}</div>
          </>
        )}
      </div>
      <div className="flex-1 space-y-px overflow-hidden">
        {visibleVoci.map((v, i) => (
          <div key={i} className="flex justify-between items-center py-px border-b border-stone-50">
            <div className="flex-1 truncate mr-1">
              <span className="text-stone-700 text-[9px]">{v.nome_voce}</span>
              {v.nome_parrucchiere && <span className="text-stone-400 ml-1 text-[8px]">{v.nome_parrucchiere}</span>}
            </div>
            <span className="font-semibold text-stone-700 text-[9px] flex-shrink-0">€{v.prezzo.toFixed(2)}</span>
          </div>
        ))}
        {hidden > 0 && <div className="text-stone-400 text-[8px] italic">+{hidden} altre voci</div>}
      </div>
      <div className="border-t border-stone-800 pt-1 mt-1 flex justify-between font-bold text-stone-800 text-[10px]">
        <span>TOTALE</span><span>€{totale.toFixed(2)}</span>
      </div>
      {g.tipoPagamento && (
        <div className="mt-0.5 text-stone-500 text-[8px] border-t border-stone-100 pt-0.5">
          Pagamento: {g.tipoPagamento === 'cc_bancomat' ? 'CC/Bancomat' : 'Contanti'}
        </div>
      )}
      {g.noteEsistenti && (
        <div className="mt-0.5 text-stone-400 text-[8px] italic border-t border-stone-100 pt-0.5 truncate">{g.noteEsistenti}</div>
      )}
      {convalidataLabel && (
        <div className="mt-0.5 text-stone-300 text-[7px] border-t border-stone-100 pt-0.5 truncate">{convalidataLabel}</div>
      )}
    </div>
  );
}

// ─── Voci Extra Tab ───────────────────────────────────────────────────────────

function VociExtraTab() {
  const { user } = useAuth();
  const [voci, setVoci] = useState<VoceExtra[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ open: boolean; id?: string }>({ open: false });
  const [form, setForm] = useState<VoceExtraForm>({ nome: '', descrizione: '', prezzo: 0, colore: '#F59E0B', attivo: true });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await dbSelect({ table: 'voci_extra_catalogo', filters: [], orderBy: [{ col: 'nome', asc: true }] });
    setVoci((data || []) as VoceExtra[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function openNew() {
    setForm({ nome: '', descrizione: '', prezzo: 0, colore: '#F59E0B', attivo: true });
    setError('');
    setModal({ open: true });
  }

  function openEdit(v: VoceExtra) {
    setForm({ nome: v.nome, descrizione: v.descrizione, prezzo: v.prezzo, colore: v.colore, attivo: v.attivo });
    setError('');
    setModal({ open: true, id: v.id });
  }

  async function handleSave() {
    if (!form.nome.trim()) { setError('Il nome è obbligatorio'); return; }
    setSaving(true);
    setError('');
    const payload = { nome: form.nome.trim(), descrizione: form.descrizione.trim(), prezzo: form.prezzo, colore: form.colore, attivo: form.attivo };
    if (modal.id) {
      await dbUpdate({ table: 'voci_extra_catalogo', id: modal.id, data: payload });
    } else {
      await dbInsert({ table: 'voci_extra_catalogo', data: { ...payload, user_id: user?.id } });
    }
    setSaving(false);
    setModal({ open: false });
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm('Eliminare questa voce?')) return;
    await dbDelete({ table: 'voci_extra_catalogo', filters: [{ col: 'id', op: 'eq', val: id }] });
    load();
  }

  async function toggleAttivo(v: VoceExtra) {
    await dbUpdate({ table: 'voci_extra_catalogo', id: v.id, data: { attivo: !v.attivo } });
    load();
  }

  if (loading) return (
    <div className="flex items-center justify-center h-40">
      <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-stone-500">{voci.length} voci nel catalogo</p>
        <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-lg transition-colors shadow-sm">
          <Plus size={15} />Nuova voce
        </button>
      </div>

      {voci.length === 0 ? (
        <div className="bg-white rounded-xl border border-stone-200 px-6 py-16 text-center text-stone-400">
          Nessuna voce extra — creane una con il pulsante sopra
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {voci.map(v => (
            <div key={v.id} className={`bg-white rounded-xl border shadow-sm overflow-hidden transition-opacity ${v.attivo ? '' : 'opacity-50'}`} style={{ borderColor: `${v.colore}40` }}>
              <div className="h-1.5 w-full" style={{ backgroundColor: v.colore }} />
              <div className="p-4">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h3 className="font-semibold text-stone-800 text-sm leading-tight">{v.nome}</h3>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => openEdit(v)} className="p-1 text-stone-400 hover:text-amber-600 transition-colors rounded"><Pencil size={13} /></button>
                    <button onClick={() => handleDelete(v.id)} className="p-1 text-stone-400 hover:text-red-500 transition-colors rounded"><Trash2 size={13} /></button>
                  </div>
                </div>
                {v.descrizione && <p className="text-xs text-stone-400 mb-3 line-clamp-2">{v.descrizione}</p>}
                <div className="flex items-center justify-between mt-2">
                  <span className="flex items-center gap-1 text-sm font-bold text-stone-700">
                    <Euro size={13} className="text-stone-400" />{v.prezzo.toFixed(2)}
                  </span>
                  <button onClick={() => toggleAttivo(v)}
                    className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${v.attivo ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'}`}>
                    {v.attivo ? 'Attivo' : 'Non attivo'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal.open && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 flex-shrink-0">
              <h2 className="font-bold text-stone-800">{modal.id ? 'Modifica voce' : 'Nuova voce extra'}</h2>
              <button onClick={() => setModal({ open: false })} className="text-stone-400 hover:text-stone-700 transition-colors"><X size={20} /></button>
            </div>
            <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
              {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wide">Nome *</label>
                <input autoFocus value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  placeholder="es. Tonalizzante" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wide">Descrizione</label>
                <textarea value={form.descrizione} onChange={e => setForm(f => ({ ...f, descrizione: e.target.value }))} rows={2}
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
                  placeholder="Descrizione opzionale…" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wide">Prezzo (€)</label>
                  <input type="number" onInput={e => { const t = e.currentTarget; if (t.value.length > 1 && t.value.startsWith('0') && !t.value.startsWith('0.')) t.value = String(Number(t.value)); }} min={0} step={0.5} value={form.prezzo}
                    onChange={e => setForm(f => ({ ...f, prezzo: parseFloat(e.target.value) || 0 }))}
                    onFocus={e => e.target.select()}
                    className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-400" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wide">Stato</label>
                  <select value={form.attivo ? 'si' : 'no'} onChange={e => setForm(f => ({ ...f, attivo: e.target.value === 'si' }))}
                    className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-400">
                    <option value="si">Attivo</option>
                    <option value="no">Non attivo</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wide">Colore</label>
                <div className="flex gap-2 flex-wrap">
                  {PRESET_COLORS.map(c => (
                    <button key={c} type="button" onClick={() => setForm(f => ({ ...f, colore: c }))}
                      className="w-7 h-7 rounded-full transition-transform hover:scale-110 flex-shrink-0"
                      style={{ backgroundColor: c, outline: form.colore === c ? `3px solid ${c}` : 'none', outlineOffset: '2px' }} />
                  ))}
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-stone-100 flex gap-3 justify-end flex-shrink-0">
              <button onClick={() => setModal({ open: false })} className="px-5 py-2 text-sm font-medium text-stone-600 border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors">Annulla</button>
              <button onClick={handleSave} disabled={saving} className="px-5 py-2 text-sm font-medium bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-50">
                {saving ? 'Salvataggio…' : 'Salva'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ProdottiRivenditaTab ─────────────────────────────────────────────────────

interface ProdottoRivenditaCatalogo {
  id: string;
  categoria: string;
  nome: string;
  marca: string;
  prezzo_acquisto: number;
  prezzo_vendita: number;
  quantita_stock: number;
  quantita_venduta: number;
  quantita_minima: number;
  attivo: boolean;
}

function ProdottiRivenditaTab() {
  const { user } = useAuth();
  const [prodotti, setProdotti] = useState<ProdottoRivenditaCatalogo[]>([]);
  const [parrucchieri, setParrucchieri] = useState<ParrucchiereSimple[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('all');
  const [vendita, setVendita] = useState<{
    prodotto: ProdottoRivenditaCatalogo;
    parrId: string;
    quantita: number;
    prezzoUnitario: number;
    data: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [prodRes, parrRes] = await Promise.all([
      dbSelect({ table: 'prodotti_rivendita_catalogo', filters: [{ col: 'attivo', op: 'eq', val: true }], orderBy: [{ col: 'categoria', asc: true }, { col: 'nome', asc: true }] }),
      dbSelect({ table: 'parrucchieri', filters: [{ col: 'attivo', op: 'eq', val: true }], orderBy: [{ col: 'nome', asc: true }] }),
    ]);
    setProdotti((prodRes.data || []) as ProdottoRivenditaCatalogo[]);
    setParrucchieri((parrRes.data || []) as ParrucchiereSimple[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function openVendita(p: ProdottoRivenditaCatalogo) {
    setVendita({
      prodotto: p,
      parrId: parrucchieri[0]?.id ?? '',
      quantita: 1,
      prezzoUnitario: p.prezzo_vendita,
      data: localDateStr(),
    });
  }

  async function confermaVendita() {
    if (!vendita) return;
    setSaving(true);
    const parr = parrucchieri.find(p => p.id === vendita.parrId);
    await dbInsert({ table: 'rivendita_prodotti', data: {
      parrucchiere_id: vendita.parrId,
      nome_prodotto: vendita.prodotto.nome,
      quantita: vendita.quantita,
      prezzo_unitario: vendita.prezzoUnitario,
      data_vendita: vendita.data,
      note: vendita.prodotto.marca ? `Marca: ${vendita.prodotto.marca}` : '',
      user_id: user?.id,
    } });
    await dbRpc('aggiorna_stock_catalogo', { p_id: vendita.prodotto.id, p_stock_delta: -vendita.quantita, p_venduta_delta: vendita.quantita });
    setSaving(false);
    setVendita(null);
    setFlash(`Vendita registrata${parr ? ` per ${parr.nome}` : ''}`);
    setTimeout(() => setFlash(null), 3000);
    load();
  }

  const categorie = [...new Set(prodotti.map(p => p.categoria))].sort();
  const filtered = prodotti.filter(p => {
    if (filterCat !== 'all' && p.categoria !== filterCat) return false;
    if (search) {
      const q = search.toLowerCase();
      return p.nome.toLowerCase().includes(q) || (p.marca ?? '').toLowerCase().includes(q);
    }
    return true;
  });

  const fmtP = (n: number) => n.toFixed(2).replace('.', ',');

  if (loading) return (
    <div className="flex items-center justify-center h-48">
      <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-5">

      {flash && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-medium px-4 py-3 rounded-xl flex items-center gap-2">
          <Check size={15} />
          {flash}
        </div>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-40">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          </div>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Cerca prodotto o marca..."
            className="w-full pl-8 pr-4 py-2 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white"
          />
        </div>
        <select
          value={filterCat}
          onChange={e => setFilterCat(e.target.value)}
          className="border border-stone-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-300"
        >
          <option value="all">Tutte le categorie</option>
          {categorie.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <span className="text-xs text-stone-400">{filtered.length} prodotti</span>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-stone-400 text-sm">
          {prodotti.length === 0
            ? 'Nessun prodotto nel catalogo — aggiungili dalla sezione Magazzino'
            : 'Nessun risultato per la ricerca corrente'}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(p => {
            const esaurito = p.quantita_stock === 0;
            const scarso = p.quantita_minima > 0 && p.quantita_stock <= p.quantita_minima && !esaurito;
            return (
              <div
                key={p.id}
                className={`bg-white rounded-2xl border shadow-sm p-4 flex flex-col gap-3 transition-all
                  ${esaurito ? 'opacity-50 border-stone-200' : scarso ? 'border-amber-200' : 'border-stone-200 hover:shadow-md'}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-stone-800 text-sm leading-snug">{p.nome}</p>
                    {p.marca && <p className="text-xs text-stone-400 mt-0.5">{p.marca}</p>}
                    <p className="text-[10px] text-stone-400 mt-0.5 uppercase tracking-wide">{p.categoria}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-emerald-600 text-sm">€{fmtP(p.prezzo_vendita)}</p>
                    <p className="text-[10px] text-stone-400">acq. €{fmtP(p.prezzo_acquisto)}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    {esaurito ? (
                      <span className="text-[10px] px-2 py-0.5 bg-red-100 text-red-600 rounded-full font-bold">Esaurito</span>
                    ) : scarso ? (
                      <span className="text-[10px] px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full font-semibold">Scorta bassa: {p.quantita_stock}</span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 bg-stone-100 text-stone-500 rounded-full font-medium">Stock: {p.quantita_stock}</span>
                    )}
                  </div>
                  <button
                    onClick={() => !esaurito && openVendita(p)}
                    disabled={esaurito}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all
                      ${esaurito
                        ? 'bg-stone-100 text-stone-300 cursor-not-allowed'
                        : 'bg-amber-500 hover:bg-amber-600 text-white shadow-sm active:scale-95'}`}
                  >
                    <ShoppingBag size={11} />
                    Vendi
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {vendita && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between">
              <div>
                <p className="font-bold text-stone-800">{vendita.prodotto.nome}</p>
                {vendita.prodotto.marca && <p className="text-xs text-stone-400">{vendita.prodotto.marca}</p>}
              </div>
              <button onClick={() => setVendita(null)} className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-400 transition-colors">
                <X size={15} />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1.5">Data vendita</label>
                <input
                  type="date"
                  value={vendita.data}
                  onChange={e => setVendita(v => v ? { ...v, data: e.target.value } : null)}
                  className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
                />
              </div>
              {parrucchieri.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-stone-600 mb-1.5">Parrucchiere</label>
                  <div className="flex flex-wrap gap-2">
                    {parrucchieri.map(p => (
                      <button
                        key={p.id}
                        onClick={() => setVendita(v => v ? { ...v, parrId: p.id } : null)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all
                          ${vendita.parrId === p.id ? 'text-white border-transparent' : 'text-stone-700 border-stone-200 hover:bg-stone-50'}`}
                        style={vendita.parrId === p.id ? { backgroundColor: p.colore, borderColor: p.colore } : {}}
                      >
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.colore }} />
                        {p.nome}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1.5">Quantità</label>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setVendita(v => v ? { ...v, quantita: Math.max(1, v.quantita - 1) } : null)}
                    className="w-9 h-9 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-lg flex items-center justify-center transition-colors select-none"
                  >−</button>
                  <span className="text-xl font-bold text-stone-800 w-8 text-center tabular-nums">{vendita.quantita}</span>
                  <button
                    onClick={() => setVendita(v => v ? { ...v, quantita: Math.min(v.prodotto.quantita_stock, v.quantita + 1) } : null)}
                    className="w-9 h-9 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-lg flex items-center justify-center transition-colors select-none"
                  >+</button>
                  <span className="text-xs text-stone-400 ml-1">max {vendita.prodotto.quantita_stock}</span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1.5">Prezzo unitario (€)</label>
                <input
                  type="number"
                  onInput={e => { const t = e.currentTarget; if (t.value.length > 1 && t.value.startsWith('0') && !t.value.startsWith('0.')) t.value = String(Number(t.value)); }}
                  value={vendita.prezzoUnitario}
                  onChange={e => setVendita(v => v ? { ...v, prezzoUnitario: parseFloat(e.target.value) || 0 } : null)}
                  onFocus={e => e.target.select()}
                  step="0.01"
                  className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
                />
              </div>
              <div className="bg-stone-50 rounded-xl px-4 py-3 flex items-center justify-between">
                <span className="text-xs text-stone-500">Totale vendita</span>
                <span className="font-bold text-emerald-600">€{fmtP(vendita.prezzoUnitario * vendita.quantita)}</span>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-stone-100 flex gap-3 justify-end">
              <button onClick={() => setVendita(null)} className="px-4 py-2 text-sm font-medium text-stone-600 border border-stone-200 rounded-xl hover:bg-stone-50 transition-colors">
                Annulla
              </button>
              <button
                onClick={confermaVendita}
                disabled={saving || !vendita.parrId}
                className="px-5 py-2 text-sm font-semibold bg-amber-500 hover:bg-amber-600 text-white rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {saving
                  ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <Check size={14} />
                }
                Conferma vendita
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
