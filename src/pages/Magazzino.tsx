import { useState, useEffect } from 'react';
import { Plus, Trash2, CreditCard as Edit2, Check, X, ChevronDown, ChevronRight, AlertTriangle, Download, Printer, Package, Tag, Search, ArrowUpDown, FileText, Save, BookOpen, Clock, Euro, ShoppingBag, TrendingUp } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { dbSelect, dbInsert, dbUpdate, dbDelete } from '../lib/localDb';
import { useAuth } from '../lib/AuthContext';
import { saveFile as saveFileToPath } from '../lib/fileSaver';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Categoria {
  id: string;
  nome: string;
  colore: string;
  ordine: number;
}

interface Prodotto {
  id: string;
  categoria_id: string;
  nome: string;
  marca: string;
  unita: string;
  quantita: number;
  quantita_minima: number;
  prezzo_acquisto: number;
  note: string;
  ordine: number;
  updated_at: string;
}

const COLORI_PRESET = [
  '#F59E0B', '#EF4444', '#3B82F6', '#10B981', '#8B5CF6',
  '#F97316', '#EC4899', '#14B8A6', '#6366F1', '#84CC16',
];

const UNITA_OPTIONS = ['pz', 'lt', 'ml', 'kg', 'g', 'flacone', 'tubo', 'conf', 'kit', 'sacca'];

const fmt = (n: number) => n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtQ = (n: number) => n % 1 === 0 ? String(n) : n.toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 2 });

// ─── Main component ───────────────────────────────────────────────────────────

type SubView = 'inventario' | 'magazzino' | 'schede' | 'rivendita';

const TAB_LABELS: Record<SubView, string> = {
  inventario: 'Inventario',
  magazzino: 'Magazzino',
  schede: 'Schede Salvate',
  rivendita: 'Prodotti rivendita',
};

export default function Magazzino() {
  const [view, setView] = useState<SubView>('inventario');

  return (
    <div className="h-full flex flex-col">
      {/* Tab bar */}
      <div className="bg-white border-b border-stone-200 px-6 pt-4 flex gap-1 flex-shrink-0">
        {(Object.keys(TAB_LABELS) as SubView[]).map(v => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`px-5 py-2.5 text-sm font-semibold rounded-t-xl border-b-2 transition-colors ${
              view === v
                ? 'border-amber-500 text-amber-700 bg-amber-50'
                : 'border-transparent text-stone-500 hover:text-stone-800 hover:bg-stone-50'
            }`}
          >
            {TAB_LABELS[v]}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto">
        {view === 'inventario' && <InventarioView />}
        {view === 'magazzino' && <MagazzinoView />}
        {view === 'schede' && <SchedeSalvateView />}
        {view === 'rivendita' && <ProdottiRivenditaView />}
      </div>
    </div>
  );
}

// ─── Inventario view ──────────────────────────────────────────────────────────

function InventarioView() {
  const { user } = useAuth();
  const [categorie, setCategorie] = useState<Categoria[]>([]);
  const [prodotti, setProdotti] = useState<Prodotto[]>([]);
  const [rivendita, setRivendita] = useState<ProdottoRivendita[]>([]);
  const [expandedRiv, setExpandedRiv] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'nome' | 'quantita' | 'prezzo'>('nome');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Edit states
  const [editingProd, setEditingProd] = useState<Partial<Prodotto> & { isNew?: boolean } | null>(null);
  const [editingCat, setEditingCat] = useState<Partial<Categoria> & { isNew?: boolean } | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    const [catsRes, prodsRes, rivRes] = await Promise.all([
      dbSelect<Categoria>({ table: 'magazzino_categorie', orderBy: [{ col: 'ordine' }] }),
      dbSelect<Prodotto>({ table: 'magazzino_prodotti', orderBy: [{ col: 'ordine' }] }),
      dbSelect<ProdottoRivendita>({ table: 'prodotti_rivendita_catalogo', filters: [{ col: 'attivo', op: 'eq', val: true }], orderBy: [{ col: 'categoria' }, { col: 'nome' }] }),
    ]);
    setCategorie((catsRes.data || []) as Categoria[]);
    setProdotti((prodsRes.data || []) as Prodotto[]);
    setRivendita((rivRes.data || []) as ProdottoRivendita[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function expandAll() {
    setExpanded(new Set(categorie.map(c => c.id)));
  }

  function collapseAll() {
    setExpanded(new Set());
  }

  // ── Category CRUD ──
  async function saveCategoria() {
    if (!editingCat?.nome?.trim()) return;
    setSaving(true);
    if (editingCat.isNew) {
      const maxOrd = categorie.reduce((m, c) => Math.max(m, c.ordine), 0);
      dbInsert({
        table: 'magazzino_categorie',
        data: {
          nome: editingCat.nome.trim(),
          colore: editingCat.colore ?? '#F59E0B',
          ordine: maxOrd + 1,
          user_id: user?.id,
        },
      });
    } else {
      dbUpdate({
        table: 'magazzino_categorie',
        id: editingCat.id!,
        data: {
          nome: editingCat.nome.trim(),
          colore: editingCat.colore,
        },
      });
    }
    setSaving(false);
    setEditingCat(null);
    load();
  }

  async function deleteCategoria(id: string) {
    const count = prodotti.filter(p => p.categoria_id === id).length;
    if (!confirm(`Eliminare questa categoria e tutti i ${count} prodotti al suo interno?`)) return;
    dbDelete({
      table: 'magazzino_categorie',
      filters: [{ col: 'id', op: 'eq', val: id }],
    });
    load();
  }

  // ── Product CRUD ──
  async function saveProdotto() {
    if (!editingProd?.nome?.trim() || !editingProd.categoria_id) return;
    setSaving(true);
    const payload = {
      categoria_id: editingProd.categoria_id,
      nome: editingProd.nome.trim(),
      marca: editingProd.marca?.trim() ?? '',
      unita: editingProd.unita ?? 'pz',
      quantita: Number(editingProd.quantita ?? 0),
      quantita_minima: Number(editingProd.quantita_minima ?? 0),
      prezzo_acquisto: Number(editingProd.prezzo_acquisto ?? 0),
      note: editingProd.note?.trim() ?? '',
      updated_at: new Date().toISOString(),
    };
    if (editingProd.isNew) {
      const maxOrd = prodotti.filter(p => p.categoria_id === payload.categoria_id).reduce((m, p) => Math.max(m, p.ordine), 0);
      dbInsert({
        table: 'magazzino_prodotti',
        data: { ...payload, ordine: maxOrd + 1, user_id: user?.id },
      });
    } else {
      dbUpdate({
        table: 'magazzino_prodotti',
        id: editingProd.id!,
        data: payload,
      });
    }
    setSaving(false);
    setEditingProd(null);
    load();
  }

  async function deleteProdotto(id: string) {
    if (!confirm('Eliminare questo prodotto?')) return;
    dbDelete({
      table: 'magazzino_prodotti',
      filters: [{ col: 'id', op: 'eq', val: id }],
    });
    load();
  }

  // ── Sort & filter ──
  function sortedProdotti(catId: string) {
    let list = prodotti.filter(p => p.categoria_id === catId);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(p => p.nome.toLowerCase().includes(q) || p.marca.toLowerCase().includes(q));
    }
    list = [...list].sort((a, b) => {
      let av: string | number, bv: string | number;
      if (sortBy === 'nome') { av = a.nome.toLowerCase(); bv = b.nome.toLowerCase(); }
      else if (sortBy === 'quantita') { av = a.quantita; bv = b.quantita; }
      else { av = a.prezzo_acquisto; bv = b.prezzo_acquisto; }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }

  function toggleSort(col: typeof sortBy) {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('asc'); }
  }

  const totaleProdotti = prodotti.length;
  const totaleValore = prodotti.reduce((s, p) => s + p.quantita * p.prezzo_acquisto, 0);
  const scorteScarse = prodotti.filter(p => p.quantita_minima > 0 && p.quantita <= p.quantita_minima).length;

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-7 h-7 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-6 space-y-5 max-w-5xl mx-auto">
      {/* Header stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm px-5 py-4">
          <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1">Prodotti totali</p>
          <p className="text-2xl font-bold text-stone-800">{totaleProdotti}</p>
        </div>
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm px-5 py-4">
          <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1">Valore inventario</p>
          <p className="text-2xl font-bold text-stone-800">€ {fmt(totaleValore)}</p>
        </div>
        <div className={`rounded-2xl border shadow-sm px-5 py-4 ${scorteScarse > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-stone-200'}`}>
          <p className={`text-xs font-semibold uppercase tracking-wide mb-1 ${scorteScarse > 0 ? 'text-red-500' : 'text-stone-500'}`}>Scorte in esaurimento</p>
          <p className={`text-2xl font-bold ${scorteScarse > 0 ? 'text-red-600' : 'text-stone-800'}`}>{scorteScarse}</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Cerca prodotto o marca..."
            className="w-full pl-9 pr-4 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-400 bg-white"
          />
        </div>
        <div className="flex items-center gap-2">
          <button onClick={expandAll} className="px-3 py-2 text-xs font-semibold text-stone-600 bg-white border border-stone-200 rounded-xl hover:bg-stone-50 transition-colors">Espandi tutto</button>
          <button onClick={collapseAll} className="px-3 py-2 text-xs font-semibold text-stone-600 bg-white border border-stone-200 rounded-xl hover:bg-stone-50 transition-colors">Comprimi tutto</button>
        </div>
        <button
          onClick={() => setEditingCat({ isNew: true, colore: '#F59E0B' })}
          className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-semibold text-sm rounded-xl transition-colors shadow-sm"
        >
          <Plus size={14} />
          Nuova categoria
        </button>
      </div>

      {/* Modal nuova/modifica categoria */}
      {editingCat && (
        <CategoriaModal
          cat={editingCat}
          onSave={saveCategoria}
          onClose={() => setEditingCat(null)}
          onChange={setEditingCat}
          saving={saving}
        />
      )}

      {/* Modal prodotto */}
      {editingProd && (
        <ProdottoModal
          prod={editingProd}
          categorie={categorie}
          onSave={saveProdotto}
          onClose={() => setEditingProd(null)}
          onChange={setEditingProd}
          saving={saving}
        />
      )}

      {/* Categorie e prodotti */}
      {categorie.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 bg-stone-100 rounded-2xl flex items-center justify-center mb-4">
            <Package size={28} className="text-stone-400" />
          </div>
          <p className="text-stone-600 font-semibold text-lg mb-1">Nessuna categoria</p>
          <p className="text-stone-400 text-sm">Crea la prima categoria per iniziare a gestire l'inventario</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rivendita.length > 0 && (() => {
            const categRiv = [...new Set(rivendita.map(p => p.categoria))].sort();
            return (
              <div className="bg-white rounded-2xl border border-amber-200 shadow-sm overflow-hidden">
                <div className="flex items-center gap-3 px-5 py-3 bg-amber-50 border-b border-amber-100">
                  <ShoppingBag size={15} className="text-amber-600 flex-shrink-0" />
                  <p className="text-sm font-bold text-amber-800 flex-1">Prodotti Rivendita</p>
                  <span className="text-xs text-amber-600 font-medium">{rivendita.length} prodotti</span>
                  <span className="text-xs text-stone-400 ml-1">— sincronizzato da catalogo</span>
                </div>
                {categRiv.map(cat => {
                  const items = rivendita.filter(p => p.categoria === cat);
                  const isOpen = expandedRiv.has(cat);
                  return (
                    <div key={cat} className="border-b border-stone-100 last:border-b-0">
                      <div
                        className="flex items-center gap-3 px-5 py-3 cursor-pointer hover:bg-stone-50 transition-colors"
                        onClick={() => setExpandedRiv(prev => { const next = new Set(prev); next.has(cat) ? next.delete(cat) : next.add(cat); return next; })}
                      >
                        {isOpen ? <ChevronDown size={14} className="text-stone-400" /> : <ChevronRight size={14} className="text-stone-400" />}
                        <p className="text-sm font-semibold text-stone-700 flex-1">{cat}</p>
                        <span className="text-xs text-stone-400">{items.length} prodotti</span>
                        <span className="text-xs font-semibold text-stone-600 ml-2">€ {fmt(items.reduce((s, p) => s + p.quantita_stock * p.prezzo_acquisto, 0))}</span>
                      </div>
                      {isOpen && (
                        <div className="overflow-x-auto border-t border-stone-50">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-stone-50 border-b border-stone-100">
                                <th className="text-left px-5 py-2.5 text-xs font-semibold text-stone-500 uppercase tracking-wide">Prodotto</th>
                                <th className="text-left px-3 py-2.5 text-xs font-semibold text-stone-500 uppercase tracking-wide">Marca</th>
                                <th className="text-center px-3 py-2.5 text-xs font-semibold text-stone-500 uppercase tracking-wide">Stock</th>
                                <th className="text-center px-3 py-2.5 text-xs font-semibold text-stone-500 uppercase tracking-wide">Min.</th>
                                <th className="text-right px-3 py-2.5 text-xs font-semibold text-stone-500 uppercase tracking-wide">Prezzo acq.</th>
                                <th className="text-right px-3 py-2.5 text-xs font-semibold text-stone-500 uppercase tracking-wide">Prezzo vend.</th>
                                <th className="text-right px-3 py-2.5 text-xs font-semibold text-stone-500 uppercase tracking-wide">Totale</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-50">
                              {items.map(p => {
                                const esaurito = p.quantita_stock === 0;
                                const scarso = p.quantita_minima > 0 && p.quantita_stock <= p.quantita_minima && !esaurito;
                                return (
                                  <tr key={p.id} className={`transition-colors ${esaurito ? 'bg-red-50/40' : scarso ? 'bg-amber-50/40' : 'hover:bg-stone-50'}`}>
                                    <td className="px-5 py-3">
                                      <div className="flex items-center gap-2">
                                        {(esaurito || scarso) && <AlertTriangle size={13} className={esaurito ? 'text-red-500' : 'text-amber-500'} />}
                                        <span className="font-medium text-stone-800">{p.nome}</span>
                                        {esaurito && <span className="text-[10px] px-1.5 py-0.5 bg-red-100 text-red-600 rounded-full font-bold">Esaurito</span>}
                                      </div>
                                    </td>
                                    <td className="px-3 py-3 text-stone-500 text-xs">{p.marca || '—'}</td>
                                    <td className={`px-3 py-3 text-center font-semibold ${esaurito ? 'text-red-600' : scarso ? 'text-amber-600' : 'text-stone-800'}`}>
                                      {p.quantita_stock}
                                      {p.quantita_minima > 0 && <span className="text-stone-300 text-xs ml-1">/ {p.quantita_minima}</span>}
                                    </td>
                                    <td className="px-3 py-3 text-center text-xs text-stone-500">{p.quantita_minima || '—'}</td>
                                    <td className="px-3 py-3 text-right text-stone-700">€ {fmt(p.prezzo_acquisto)}</td>
                                    <td className="px-3 py-3 text-right text-emerald-600 font-medium">€ {fmt(p.prezzo_vendita)}</td>
                                    <td className="px-3 py-3 text-right font-semibold text-stone-800">€ {fmt(p.quantita_stock * p.prezzo_acquisto)}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {categorie.map(cat => {
            const catProdotti = sortedProdotti(cat.id);
            const isOpen = expanded.has(cat.id);
            const totCat = prodotti.filter(p => p.categoria_id === cat.id).reduce((s, p) => s + p.quantita * p.prezzo_acquisto, 0);

            return (
              <div key={cat.id} className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
                {/* Category header */}
                <div
                  className="flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-stone-50 transition-colors"
                  onClick={() => toggleExpand(cat.id)}
                >
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: cat.colore }} />
                  {isOpen ? <ChevronDown size={16} className="text-stone-400 flex-shrink-0" /> : <ChevronRight size={16} className="text-stone-400 flex-shrink-0" />}
                  <p className="text-sm font-bold text-stone-800 flex-1">{cat.nome}</p>
                  <span className="text-xs text-stone-400">{prodotti.filter(p => p.categoria_id === cat.id).length} prodotti</span>
                  <span className="text-xs font-semibold text-stone-600 ml-2">€ {fmt(totCat)}</span>
                  <button
                    onClick={e => { e.stopPropagation(); setEditingCat({ ...cat }); }}
                    className="p-1.5 rounded-lg hover:bg-stone-200 text-stone-400 hover:text-stone-600 transition-colors ml-1"
                  >
                    <Edit2 size={13} />
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); deleteCategoria(cat.id); }}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-stone-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>

                {/* Products table */}
                {isOpen && (
                  <div className="border-t border-stone-100">
                    {catProdotti.length > 0 && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-stone-50 border-b border-stone-100">
                              <th className="text-left px-5 py-2.5 text-xs font-semibold text-stone-500 uppercase tracking-wide">
                                <button onClick={() => toggleSort('nome')} className="flex items-center gap-1 hover:text-stone-800 transition-colors">
                                  Prodotto <ArrowUpDown size={11} />
                                </button>
                              </th>
                              <th className="text-left px-3 py-2.5 text-xs font-semibold text-stone-500 uppercase tracking-wide">Marca</th>
                              <th className="text-center px-3 py-2.5 text-xs font-semibold text-stone-500 uppercase tracking-wide">
                                <button onClick={() => toggleSort('quantita')} className="flex items-center gap-1 hover:text-stone-800 transition-colors mx-auto">
                                  Qtà <ArrowUpDown size={11} />
                                </button>
                              </th>
                              <th className="text-center px-3 py-2.5 text-xs font-semibold text-stone-500 uppercase tracking-wide">U.M.</th>
                              <th className="text-right px-3 py-2.5 text-xs font-semibold text-stone-500 uppercase tracking-wide">
                                <button onClick={() => toggleSort('prezzo')} className="flex items-center gap-1 hover:text-stone-800 transition-colors ml-auto">
                                  Prezzo acq. <ArrowUpDown size={11} />
                                </button>
                              </th>
                              <th className="text-right px-3 py-2.5 text-xs font-semibold text-stone-500 uppercase tracking-wide">Totale</th>
                              <th className="text-left px-3 py-2.5 text-xs font-semibold text-stone-500 uppercase tracking-wide">Note</th>
                              <th className="px-3 py-2.5" />
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-stone-50">
                            {catProdotti.map(p => {
                              const scorta = p.quantita_minima > 0 && p.quantita <= p.quantita_minima;
                              return (
                                <tr key={p.id} className={`hover:bg-stone-50 transition-colors ${scorta ? 'bg-red-50/40' : ''}`}>
                                  <td className="px-5 py-3">
                                    <div className="flex items-center gap-2">
                                      {scorta && <AlertTriangle size={13} className="text-red-500 flex-shrink-0" />}
                                      <span className="font-medium text-stone-800">{p.nome}</span>
                                    </div>
                                  </td>
                                  <td className="px-3 py-3 text-stone-500 text-xs">{p.marca || '—'}</td>
                                  <td className={`px-3 py-3 text-center font-semibold ${scorta ? 'text-red-600' : 'text-stone-800'}`}>
                                    {fmtQ(p.quantita)}
                                    {p.quantita_minima > 0 && (
                                      <span className="text-stone-300 text-xs ml-1">/ {fmtQ(p.quantita_minima)}</span>
                                    )}
                                  </td>
                                  <td className="px-3 py-3 text-center text-xs text-stone-500">{p.unita}</td>
                                  <td className="px-3 py-3 text-right text-stone-700">€ {fmt(p.prezzo_acquisto)}</td>
                                  <td className="px-3 py-3 text-right font-semibold text-stone-800">€ {fmt(p.quantita * p.prezzo_acquisto)}</td>
                                  <td className="px-3 py-3 text-xs text-stone-400 max-w-32 truncate">{p.note || '—'}</td>
                                  <td className="px-3 py-3">
                                    <div className="flex items-center gap-1 justify-end">
                                      <button
                                        onClick={() => setEditingProd({ ...p })}
                                        className="p-1.5 rounded-lg hover:bg-stone-200 text-stone-400 hover:text-stone-600 transition-colors"
                                      >
                                        <Edit2 size={13} />
                                      </button>
                                      <button
                                        onClick={() => deleteProdotto(p.id)}
                                        className="p-1.5 rounded-lg hover:bg-red-50 text-stone-400 hover:text-red-500 transition-colors"
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Add product button */}
                    <div className="px-5 py-3 border-t border-stone-50">
                      <button
                        onClick={() => setEditingProd({ isNew: true, categoria_id: cat.id, unita: 'pz', quantita: 0, quantita_minima: 0, prezzo_acquisto: 0 })}
                        className="flex items-center gap-2 text-xs font-semibold text-stone-500 hover:text-amber-600 transition-colors"
                      >
                        <Plus size={13} />
                        Aggiungi prodotto
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Magazzino view (stampa/export) ───────────────────────────────────────────

interface SchedaSalvata {
  id: string;
  nome: string;
  data_creazione: string;
  filtro_categoria: string | null;
  solo_scarse: boolean;
  snapshot: Prodotto[];
  totale_valore: number;
  num_prodotti: number;
}

const RIVENDITA_CAT_ID = '__rivendita__';

function MagazzinoView() {
  const { user } = useAuth();
  const [categorie, setCategorie] = useState<Categoria[]>([]);
  const [prodotti, setProdotti] = useState<Prodotto[]>([]);
  const [rivendita, setRivendita] = useState<ProdottoRivendita[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCat, setFilterCat] = useState<string>('all');
  const [onlyScarse, setOnlyScarse] = useState(false);
  const [includiRivendita, setIncludiRivendita] = useState(true);
  const [savingScheda, setSavingScheda] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);
  const [savedError, setSavedError] = useState('');

  async function load() {
    const [catsRes, prodsRes, rivRes] = await Promise.all([
      dbSelect<Categoria>({ table: 'magazzino_categorie', orderBy: [{ col: 'ordine' }] }),
      dbSelect<Prodotto>({ table: 'magazzino_prodotti', orderBy: [{ col: 'ordine' }] }),
      dbSelect<ProdottoRivendita>({ table: 'prodotti_rivendita_catalogo', filters: [{ col: 'attivo', op: 'eq', val: true }], orderBy: [{ col: 'categoria' }, { col: 'nome' }] }),
    ]);
    setCategorie((catsRes.data || []) as Categoria[]);
    setProdotti((prodsRes.data || []) as Prodotto[]);
    setRivendita((rivRes.data || []) as ProdottoRivendita[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const dataStr = new Date().toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' });

  function rivAsInventario(): Prodotto[] {
    return rivendita.map(p => ({
      id: p.id,
      categoria_id: RIVENDITA_CAT_ID,
      nome: p.nome,
      marca: p.marca,
      unita: 'pz',
      quantita: p.quantita_stock,
      quantita_minima: p.quantita_minima,
      prezzo_acquisto: p.prezzo_acquisto,
      note: p.marca ? `Marca: ${p.marca}` : '',
      ordine: 0,
      updated_at: p.updated_at,
    }));
  }

  function filteredProdotti() {
    const base = includiRivendita ? [...prodotti, ...rivAsInventario()] : prodotti;
    let list = base;
    if (filterCat !== 'all') {
      list = list.filter(p => p.categoria_id === filterCat);
    }
    if (onlyScarse) list = list.filter(p => p.quantita_minima > 0 && p.quantita <= p.quantita_minima);
    return list;
  }

  const prodottiFiltrati = filteredProdotti();
  const totaleValore = prodottiFiltrati.reduce((s, p) => s + p.quantita * p.prezzo_acquisto, 0);

  function catNome(id: string) {
    if (id === RIVENDITA_CAT_ID) return 'Prodotti Rivendita';
    return categorie.find(c => c.id === id)?.nome ?? '—';
  }

  async function handleSalvaScheda() {
    setSavingScheda(true);
    setSavedMsg(false);
    setSavedError('');
    const nome = `Inventario ${dataStr}${filterCat !== 'all' ? ` — ${catNome(filterCat)}` : ''}${onlyScarse ? ' — Scorte scarse' : ''}`;
    const { error } = await dbInsert({
      table: 'magazzino_schede_salvate',
      data: {
        nome,
        filtro_categoria: filterCat !== 'all' ? filterCat : null,
        solo_scarse: onlyScarse,
        snapshot: prodottiFiltrati,
        totale_valore: totaleValore,
        num_prodotti: prodottiFiltrati.length,
        user_id: user?.id,
      },
    });
    setSavingScheda(false);
    if (!error) {
      setSavedMsg(true);
      setTimeout(() => setSavedMsg(false), 2500);
    } else {
      setSavedError('Errore nel salvataggio. Riprova.');
      setTimeout(() => setSavedError(''), 3000);
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-7 h-7 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      {/* Filters & actions */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-48">
          <Tag size={14} className="text-stone-400 flex-shrink-0" />
          <select
            value={filterCat}
            onChange={e => setFilterCat(e.target.value)}
            className="flex-1 border border-stone-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-300"
          >
            <option value="all">Tutte le categorie</option>
            {categorie.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            {includiRivendita && <option value={RIVENDITA_CAT_ID}>Prodotti Rivendita</option>}
          </select>
        </div>

        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={onlyScarse}
            onChange={e => setOnlyScarse(e.target.checked)}
            className="w-4 h-4 accent-amber-500 rounded"
          />
          <span className="text-sm text-stone-600 font-medium">Solo scorte scarse</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={includiRivendita}
            onChange={e => { setIncludiRivendita(e.target.checked); if (!e.target.checked && filterCat === RIVENDITA_CAT_ID) setFilterCat('all'); }}
            className="w-4 h-4 accent-amber-500 rounded"
          />
          <span className="text-sm text-stone-600 font-medium flex items-center gap-1.5">
            <ShoppingBag size={13} className="text-amber-500" />
            Prodotti rivendita
          </span>
        </label>

        <div className="flex items-center gap-2 ml-auto flex-wrap">
          {savedError && (
            <span className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">{savedError}</span>
          )}
          <button onClick={handleSalvaScheda} disabled={savingScheda} className={`flex items-center gap-2 px-4 py-2.5 font-semibold text-sm rounded-xl transition-colors shadow-sm border ${savedMsg ? 'bg-emerald-50 border-emerald-400 text-emerald-700' : savedError ? 'bg-red-50 border-red-300 text-red-600' : 'bg-white border-stone-200 hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-700 text-stone-600'}`}>
            {savedMsg ? <Check size={14} /> : <Save size={14} />}
            {savedMsg ? 'Salvata!' : savingScheda ? 'Salvataggio…' : 'Salva Scheda'}
          </button>
        </div>
      </div>

      {/* Summary bar */}
      <div className="bg-stone-50 border border-stone-200 rounded-xl px-5 py-3 flex items-center justify-between">
        <p className="text-sm text-stone-600">
          <span className="font-bold text-stone-800">{prodottiFiltrati.length}</span> prodotti
          {filterCat !== 'all' && <span className="text-stone-400 ml-1">in {catNome(filterCat)}</span>}
        </p>
        <p className="text-sm font-bold text-stone-800">Totale: € {fmt(totaleValore)}</p>
      </div>

      {/* Print preview table */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-stone-800">Inventario Magazzino</p>
            <p className="text-xs text-stone-500 mt-0.5">{dataStr}</p>
          </div>
        </div>

        {prodottiFiltrati.length === 0 ? (
          <div className="py-16 text-center">
            <Package size={32} className="text-stone-300 mx-auto mb-3" />
            <p className="text-stone-500 text-sm">Nessun prodotto trovato con i filtri selezionati</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-200">
                  <th className="text-left px-5 py-3 text-xs font-bold text-stone-500 uppercase tracking-wide">Categoria</th>
                  <th className="text-left px-3 py-3 text-xs font-bold text-stone-500 uppercase tracking-wide">Prodotto</th>
                  <th className="text-left px-3 py-3 text-xs font-bold text-stone-500 uppercase tracking-wide">Marca</th>
                  <th className="text-center px-3 py-3 text-xs font-bold text-stone-500 uppercase tracking-wide">Qtà</th>
                  <th className="text-center px-3 py-3 text-xs font-bold text-stone-500 uppercase tracking-wide">U.M.</th>
                  <th className="text-right px-3 py-3 text-xs font-bold text-stone-500 uppercase tracking-wide">Prezzo acq.</th>
                  <th className="text-right px-3 py-3 text-xs font-bold text-stone-500 uppercase tracking-wide">Totale</th>
                  <th className="text-left px-3 py-3 text-xs font-bold text-stone-500 uppercase tracking-wide">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-50">
                {prodottiFiltrati.map(p => {
                  const scorta = p.quantita_minima > 0 && p.quantita <= p.quantita_minima;
                  const isRiv = p.categoria_id === RIVENDITA_CAT_ID;
                  return (
                    <tr key={p.id} className={`hover:bg-stone-50 transition-colors ${scorta ? 'bg-red-50/40' : isRiv ? 'bg-amber-50/30' : ''}`}>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          {isRiv
                            ? <ShoppingBag size={11} className="text-amber-500 flex-shrink-0" />
                            : <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: categorie.find(c => c.id === p.categoria_id)?.colore ?? '#ccc' }} />
                          }
                          <span className="text-xs text-stone-500">{catNome(p.categoria_id)}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1.5">
                          {scorta && <AlertTriangle size={12} className="text-red-500 flex-shrink-0" />}
                          <span className="font-medium text-stone-800">{p.nome}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-xs text-stone-500">{p.marca || '—'}</td>
                      <td className={`px-3 py-3 text-center font-semibold ${scorta ? 'text-red-600' : 'text-stone-800'}`}>{fmtQ(p.quantita)}</td>
                      <td className="px-3 py-3 text-center text-xs text-stone-500">{p.unita}</td>
                      <td className="px-3 py-3 text-right text-stone-700">€ {fmt(p.prezzo_acquisto)}</td>
                      <td className="px-3 py-3 text-right font-semibold text-stone-800">€ {fmt(p.quantita * p.prezzo_acquisto)}</td>
                      <td className="px-3 py-3 text-xs text-stone-400 max-w-32 truncate">{p.note || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-stone-50 border-t-2 border-stone-200">
                  <td colSpan={6} className="px-5 py-3 text-sm font-bold text-stone-800 text-right">Totale inventario</td>
                  <td className="px-3 py-3 text-right font-bold text-stone-900">€ {fmt(totaleValore)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── SchedeSalvate view ────────────────────────────────────────────────────────

function SchedeSalvateView() {
  const { user } = useAuth();
  const [schede, setSchede] = useState<SchedaSalvata[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SchedaSalvata | null>(null);

  async function load() {
    if (!user?.id) return;
    const { data } = await supabase
      .from('magazzino_schede_salvate')
      .select('*')
      .eq('user_id', user.id)
      .order('data_creazione', { ascending: false });
    setSchede((data || []) as SchedaSalvata[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Realtime: aggiorna automaticamente su tutti i dispositivi quando una scheda viene salvata o eliminata
  useEffect(() => {
    if (!user?.id) return;
    const ch = supabase
      .channel(`magazzino_schede_${user.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'magazzino_schede_salvate',
        filter: `user_id=eq.${user.id}`,
      }, () => { load(); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleDelete(id: string) {
    if (!confirm('Eliminare questa scheda salvata?')) return;
    await dbDelete({
      table: 'magazzino_schede_salvate',
      filters: [{ col: 'id', op: 'eq', val: id }],
    });
    if (selected?.id === id) setSelected(null);
    load();
  }

  // ── Download helpers for a given snapshot ───────────────────────────────────

  function snapshotDateStr(s: SchedaSalvata) {
    return new Date(s.data_creazione).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' });
  }

  function snapshotFileslug(s: SchedaSalvata) {
    return s.data_creazione.slice(0, 10);
  }

  async function downloadCSV(s: SchedaSalvata) {
    const header = ['Categoria', 'Prodotto', 'Marca', 'Quantità', 'U.M.', 'Prezzo acquisto', 'Totale', 'Note'];
    const rows = s.snapshot.map(p => [
      p.categoria_id, p.nome, p.marca ?? '', fmtQ(p.quantita), p.unita,
      fmt(p.prezzo_acquisto), fmt(p.quantita * p.prezzo_acquisto), p.note ?? '',
    ]);
    const csv = [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\r\n');
    const filename = `inventario-${snapshotFileslug(s)}.csv`;
    await saveFile('\uFEFF' + csv, filename);
  }

  async function downloadCSVEn(s: SchedaSalvata) {
    const header = ['Product', 'Brand', 'Quantity', 'Unit', 'Purchase Price', 'Total', 'Notes'];
    const rows = s.snapshot.map(p => [
      p.nome, p.marca ?? '', p.quantita, p.unita,
      p.prezzo_acquisto, p.quantita * p.prezzo_acquisto, p.note ?? '',
    ]);
    const csv = [header, ...rows].map(r => r.map(v => {
      const sv = String(v ?? '');
      return sv.includes(',') || sv.includes('"') ? `"${sv.replace(/"/g, '""')}"` : sv;
    }).join(',')).join('\r\n');
    const filename = `inventory-${snapshotFileslug(s)}.csv`;
    await saveFile(csv, filename);
  }

  async function downloadPDF(s: SchedaSalvata) {
    const { jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('Inventario Magazzino', 14, 16);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(120, 113, 108);
    doc.text(`${s.nome}  —  ${snapshotDateStr(s)}`, 14, 22);
    autoTable(doc, {
      startY: 27,
      head: [['Prodotto', 'Marca', 'Qtà', 'U.M.', 'Prezzo acq.', 'Totale', 'Note']],
      body: [
        ...s.snapshot.map(p => [
          p.nome, p.marca || '—', fmtQ(p.quantita), p.unita,
          `€ ${fmt(p.prezzo_acquisto)}`, `€ ${fmt(p.quantita * p.prezzo_acquisto)}`, p.note || '—',
        ]),
        ['', '', '', '', { content: 'Totale', styles: { fontStyle: 'bold', halign: 'right' } },
          { content: `€ ${fmt(s.totale_valore)}`, styles: { fontStyle: 'bold' } }, ''],
      ],
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [41, 37, 36], textColor: 255, fontStyle: 'bold', fontSize: 8 },
      alternateRowStyles: { fillColor: [250, 250, 249] },
      columnStyles: { 2: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right', fontStyle: 'bold' } },
      margin: { left: 14, right: 14 },
    });
    const pageCount = (doc as jsPDF & { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages();
    doc.setFontSize(8);
    doc.setTextColor(168, 162, 158);
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.text(`Pagina ${i} di ${pageCount}  —  ${s.num_prodotti} prodotti  —  Generato il ${snapshotDateStr(s)}`, 14, doc.internal.pageSize.getHeight() - 8);
    }
    const blob = doc.output('blob');
    await saveFile(blob, `inventario-${snapshotFileslug(s)}.pdf`);
  }

  function buildHtml(s: SchedaSalvata) {
    const rows = s.snapshot.map(p => `
      <tr>
        <td>${p.nome}</td><td>${p.marca || '—'}</td>
        <td class="num">${fmtQ(p.quantita)}</td><td>${p.unita}</td>
        <td class="num">€ ${fmt(p.prezzo_acquisto)}</td>
        <td class="num">€ ${fmt(p.quantita * p.prezzo_acquisto)}</td>
        <td>${p.note || '—'}</td>
      </tr>`).join('');
    return `<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"/>
<title>${s.nome}</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;font-size:11px;color:#1c1917;padding:24px}
h1{font-size:18px;font-weight:700;margin-bottom:4px}.subtitle{font-size:12px;color:#78716c;margin-bottom:20px}
table{width:100%;border-collapse:collapse;margin-bottom:24px}thead tr{background:#f5f5f4;border-bottom:2px solid #d6d3d1}
th{text-align:left;padding:8px 10px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#57534e}
td{padding:7px 10px;border-bottom:1px solid #f0ece8}.num{text-align:right}
.total-row td{font-weight:700;background:#fafaf9;border-top:2px solid #d6d3d1}
.footer{font-size:10px;color:#a8a29e;text-align:right;margin-top:8px}</style></head>
<body><h1>${s.nome}</h1><p class="subtitle">Salvato il: ${new Date(s.data_creazione).toLocaleString('it-IT')}</p>
<table><thead><tr><th>Prodotto</th><th>Marca</th><th class="num">Qtà</th><th>U.M.</th><th class="num">Prezzo acq.</th><th class="num">Totale</th><th>Note</th></tr></thead>
<tbody>${rows}
<tr class="total-row"><td colspan="5" style="text-align:right;padding-right:10px">Totale inventario</td><td class="num">€ ${fmt(s.totale_valore)}</td><td></td></tr>
</tbody></table>
<p class="footer">${s.num_prodotti} prodotti</p></body></html>`;
  }

  async function downloadHtml(s: SchedaSalvata) {
    const html = buildHtml(s);
    await saveFile(html, `inventario-${snapshotFileslug(s)}.html`);
  }

  function printScheda(s: SchedaSalvata) {
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(buildHtml(s));
    win.document.close();
    setTimeout(() => win.print(), 250);
  }

  async function saveFile(content: string | Blob, filename: string) {
    const blob = typeof content === 'string' ? new Blob([content]) : content;
    await saveFileToPath('magazzino', filename, blob);
  }

  // ────────────────────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-7 h-7 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (selected) {
    return (
      <div className="p-6 max-w-5xl mx-auto space-y-5">
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={() => setSelected(null)} className="flex items-center gap-2 px-3 py-2 bg-white border border-stone-200 hover:bg-stone-50 text-stone-600 text-sm font-medium rounded-xl transition-colors">
            <ChevronRight size={14} className="rotate-180" />
            Indietro
          </button>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-stone-800 text-lg truncate">{selected.nome}</p>
            <p className="text-xs text-stone-400 mt-0.5">
              {new Date(selected.data_creazione).toLocaleString('it-IT')} — {selected.num_prodotti} prodotti
            </p>
          </div>
          <p className="text-base font-bold text-stone-800">€ {fmt(selected.totale_valore)}</p>
        </div>

        {/* Download toolbar */}
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => downloadCSV(selected)} className="flex items-center gap-2 px-4 py-2.5 bg-white border border-stone-200 hover:border-teal-400 hover:bg-teal-50 hover:text-teal-700 text-stone-600 font-semibold text-sm rounded-xl transition-colors shadow-sm">
            <Download size={14} />
            Scarica CSV
          </button>
          <button onClick={() => downloadPDF(selected)} className="flex items-center gap-2 px-4 py-2.5 bg-white border border-stone-200 hover:border-red-400 hover:bg-red-50 hover:text-red-700 text-stone-600 font-semibold text-sm rounded-xl transition-colors shadow-sm">
            <FileText size={14} />
            Scarica PDF
          </button>
          <button onClick={() => downloadHtml(selected)} className="flex items-center gap-2 px-4 py-2.5 bg-white border border-stone-200 hover:border-amber-400 hover:bg-amber-50 hover:text-amber-700 text-stone-600 font-semibold text-sm rounded-xl transition-colors shadow-sm">
            <Download size={14} />
            Scarica HTML
          </button>
          <button onClick={() => downloadCSVEn(selected)} className="flex items-center gap-2 px-4 py-2.5 bg-white border border-stone-200 hover:border-teal-400 hover:bg-teal-50 hover:text-teal-700 text-stone-600 font-semibold text-sm rounded-xl transition-colors shadow-sm">
            <Download size={14} />
            Scarica CSV EN
          </button>
          <button onClick={() => printScheda(selected)} className="flex items-center gap-2 px-4 py-2.5 bg-stone-800 hover:bg-stone-900 text-white font-semibold text-sm rounded-xl transition-colors shadow-sm">
            <Printer size={14} />
            Stampa
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-200">
                  <th className="text-left px-5 py-3 text-xs font-bold text-stone-500 uppercase tracking-wide">Prodotto</th>
                  <th className="text-left px-3 py-3 text-xs font-bold text-stone-500 uppercase tracking-wide">Marca</th>
                  <th className="text-center px-3 py-3 text-xs font-bold text-stone-500 uppercase tracking-wide">Qtà</th>
                  <th className="text-center px-3 py-3 text-xs font-bold text-stone-500 uppercase tracking-wide">U.M.</th>
                  <th className="text-right px-3 py-3 text-xs font-bold text-stone-500 uppercase tracking-wide">Prezzo acq.</th>
                  <th className="text-right px-3 py-3 text-xs font-bold text-stone-500 uppercase tracking-wide">Totale</th>
                  <th className="text-left px-3 py-3 text-xs font-bold text-stone-500 uppercase tracking-wide">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-50">
                {selected.snapshot.map((p, i) => (
                  <tr key={i} className="hover:bg-stone-50 transition-colors">
                    <td className="px-5 py-3 font-medium text-stone-800">{p.nome}</td>
                    <td className="px-3 py-3 text-stone-500">{p.marca || '—'}</td>
                    <td className="px-3 py-3 text-center text-stone-700">{fmtQ(p.quantita)}</td>
                    <td className="px-3 py-3 text-center text-stone-500">{p.unita}</td>
                    <td className="px-3 py-3 text-right text-stone-700">€ {fmt(p.prezzo_acquisto)}</td>
                    <td className="px-3 py-3 text-right font-semibold text-stone-800">€ {fmt(p.quantita * p.prezzo_acquisto)}</td>
                    <td className="px-3 py-3 text-xs text-stone-400 max-w-32 truncate">{p.note || '—'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-stone-50 border-t-2 border-stone-200">
                  <td colSpan={5} className="px-5 py-3 text-sm font-bold text-stone-800 text-right">Totale inventario</td>
                  <td className="px-3 py-3 text-right font-bold text-stone-900">€ {fmt(selected.totale_valore)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <BookOpen size={18} className="text-stone-400" />
        <h2 className="text-lg font-bold text-stone-800">Schede Inventario Salvate</h2>
        <span className="ml-auto text-sm text-stone-400">{schede.length} {schede.length === 1 ? 'scheda' : 'schede'}</span>
      </div>

      {schede.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 bg-stone-100 rounded-2xl flex items-center justify-center mb-4">
            <BookOpen size={28} className="text-stone-400" />
          </div>
          <p className="text-stone-600 font-semibold text-lg mb-1">Nessuna scheda salvata</p>
          <p className="text-stone-400 text-sm">Vai nella tab Magazzino e premi "Salva Scheda" per creare uno snapshot dell'inventario</p>
        </div>
      ) : (
        <div className="space-y-3">
          {schede.map(s => (
            <div key={s.id} className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5 flex items-center gap-4 hover:border-amber-300 transition-colors group">
              <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center flex-shrink-0">
                <BookOpen size={18} className="text-amber-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-stone-800 truncate">{s.nome}</p>
                <div className="flex items-center gap-3 mt-1 text-xs text-stone-400">
                  <span className="flex items-center gap-1"><Clock size={11} />{new Date(s.data_creazione).toLocaleString('it-IT')}</span>
                  <span className="flex items-center gap-1"><Package size={11} />{s.num_prodotti} prodotti</span>
                  <span className="flex items-center gap-1"><Euro size={11} />{fmt(s.totale_valore)}</span>
                  {s.solo_scarse && <span className="px-1.5 py-0.5 bg-red-50 text-red-600 rounded font-medium">scorte scarse</span>}
                </div>
              </div>
              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => setSelected(s)} className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-100 hover:bg-amber-50 hover:text-amber-700 text-stone-600 text-xs font-semibold rounded-lg transition-colors">
                  <ChevronRight size={13} />
                  Apri
                </button>
                <button onClick={() => handleDelete(s.id)} className="p-1.5 text-stone-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Prodotti Rivendita view ──────────────────────────────────────────────────

const CATEGORIE_RIVENDITA = ['Shampoo', 'Balsamo', 'Maschera', 'Lacca', 'Spray', 'Crema', 'Siero', 'Olio', 'Colorante', 'Altro'];

interface ProdottoRivendita {
  id: string;
  categoria: string;
  nome: string;
  marca: string;
  prezzo_acquisto: number;
  prezzo_vendita: number;
  quantita_stock: number;
  quantita_minima: number;
  quantita_venduta: number;
  note: string;
  attivo: boolean;
  ordine: number;
  created_at: string;
  updated_at: string;
}

type EditingProdRivendita = Partial<ProdottoRivendita> & { isNew?: boolean };

function ProdottiRivenditaView() {
  const { user } = useAuth();
  const [prodotti, setProdotti] = useState<ProdottoRivendita[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<EditingProdRivendita | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState<string>('all');
  const [expandedCat, setExpandedCat] = useState<Set<string>>(new Set(CATEGORIE_RIVENDITA));
  const [adjusting, setAdjusting] = useState<Set<string>>(new Set());

  async function load() {
    const { data } = await dbSelect<ProdottoRivendita>({
      table: 'prodotti_rivendita_catalogo',
      orderBy: [{ col: 'categoria' }, { col: 'ordine' }, { col: 'nome' }],
    });
    setProdotti((data || []) as ProdottoRivendita[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleSave() {
    if (!editing?.nome?.trim()) return;
    setSaving(true);
    const payload = {
      categoria: editing.categoria ?? 'Altro',
      nome: editing.nome.trim(),
      marca: editing.marca?.trim() ?? '',
      prezzo_acquisto: Number(editing.prezzo_acquisto ?? 0),
      prezzo_vendita: Number(editing.prezzo_vendita ?? 0),
      quantita_stock: Number(editing.quantita_stock ?? 0),
      quantita_minima: Number(editing.quantita_minima ?? 0),
      note: editing.note?.trim() ?? '',
      attivo: editing.attivo ?? true,
      updated_at: new Date().toISOString(),
    };
    if (editing.isNew) {
      const maxOrd = prodotti.filter(p => p.categoria === payload.categoria).reduce((m, p) => Math.max(m, p.ordine), 0);
      dbInsert({
        table: 'prodotti_rivendita_catalogo',
        data: { ...payload, ordine: maxOrd + 1, user_id: user?.id },
      });
    } else {
      dbUpdate({
        table: 'prodotti_rivendita_catalogo',
        id: editing.id!,
        data: payload,
      });
    }
    setSaving(false);
    setEditing(null);
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm('Eliminare questo prodotto?')) return;
    dbDelete({
      table: 'prodotti_rivendita_catalogo',
      filters: [{ col: 'id', op: 'eq', val: id }],
    });
    load();
  }

  async function adjustStock(p: ProdottoRivendita, delta: number) {
    const nuova = Math.max(0, p.quantita_stock + delta);
    if (nuova === p.quantita_stock) return;
    const nuovaVenduta = delta < 0 ? (p.quantita_venduta || 0) + Math.abs(delta) : (p.quantita_venduta || 0);
    setAdjusting(prev => new Set(prev).add(p.id));
    setProdotti(prev => prev.map(x => x.id === p.id ? { ...x, quantita_stock: nuova, quantita_venduta: nuovaVenduta } : x));
    dbUpdate({
      table: 'prodotti_rivendita_catalogo',
      id: p.id,
      data: { quantita_stock: nuova, quantita_venduta: nuovaVenduta, updated_at: new Date().toISOString() },
    });
    setAdjusting(prev => { const s = new Set(prev); s.delete(p.id); return s; });
  }

  function toggleCat(cat: string) {
    setExpandedCat(prev => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  }

  const filteredProdotti = prodotti.filter(p => {
    if (filterCat !== 'all' && p.categoria !== filterCat) return false;
    if (search) {
      const q = search.toLowerCase();
      return p.nome.toLowerCase().includes(q) || p.marca.toLowerCase().includes(q);
    }
    return true;
  });

  const categoriePresenti = filterCat === 'all'
    ? [...new Set(prodotti.map(p => p.categoria))].sort()
    : [filterCat];

  const totaleAcquisto = filteredProdotti.reduce((s, p) => s + p.prezzo_acquisto * p.quantita_stock, 0);
  const totaleVendita = filteredProdotti.reduce((s, p) => s + p.prezzo_vendita * p.quantita_stock, 0);
  const margine = totaleVendita - totaleAcquisto;
  const marginePerc = totaleAcquisto > 0 ? (margine / totaleAcquisto) * 100 : 0;
  const margineRealizzato = filteredProdotti.reduce((s, p) => s + (p.prezzo_vendita - p.prezzo_acquisto) * (p.quantita_venduta || 0), 0);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-7 h-7 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-6 space-y-5 max-w-5xl mx-auto">

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm px-5 py-4">
          <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1">Prodotti</p>
          <p className="text-2xl font-bold text-stone-800">{filteredProdotti.length}</p>
        </div>
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm px-5 py-4">
          <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1">Costo stock</p>
          <p className="text-2xl font-bold text-stone-800">€ {fmt(totaleAcquisto)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm px-5 py-4">
          <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1">Valore vendita</p>
          <p className="text-2xl font-bold text-emerald-600">€ {fmt(totaleVendita)}</p>
        </div>
        <div className={`rounded-2xl border shadow-sm px-5 py-4 ${margineRealizzato > 0 ? 'bg-teal-50 border-teal-200' : 'bg-white border-stone-200'}`}>
          <p className={`text-xs font-semibold uppercase tracking-wide mb-1 ${margineRealizzato > 0 ? 'text-teal-600' : 'text-stone-500'}`}>Margine realizzato</p>
          <p className={`text-2xl font-bold ${margineRealizzato > 0 ? 'text-teal-700' : 'text-stone-800'}`}>
            € {fmt(margineRealizzato)}
          </p>
        </div>
        <div className={`rounded-2xl border shadow-sm px-5 py-4 ${margine >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
          <p className={`text-xs font-semibold uppercase tracking-wide mb-1 ${margine >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>Margine potenziale</p>
          <p className={`text-2xl font-bold ${margine >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
            € {fmt(margine)}
            <span className="text-sm font-semibold ml-1.5 opacity-70">{marginePerc.toFixed(0)}%</span>
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-44">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Cerca prodotto o marca..."
            className="w-full pl-9 pr-4 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-400 bg-white"
          />
        </div>
        <select
          value={filterCat}
          onChange={e => setFilterCat(e.target.value)}
          className="border border-stone-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-300"
        >
          <option value="all">Tutte le categorie</option>
          {CATEGORIE_RIVENDITA.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <button
          onClick={() => setEditing({ isNew: true, categoria: 'Shampoo', prezzo_acquisto: 0, prezzo_vendita: 0, quantita_stock: 0, quantita_minima: 0, attivo: true })}
          className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-semibold text-sm rounded-xl transition-colors shadow-sm"
        >
          <Plus size={14} />
          Nuovo prodotto
        </button>
      </div>

      {/* Modal */}
      {editing && (
        <ProdottoRivenditaModal
          prod={editing}
          onChange={setEditing}
          onSave={handleSave}
          onClose={() => setEditing(null)}
          saving={saving}
        />
      )}

      {/* Categorie */}
      {categoriePresenti.length === 0 || filteredProdotti.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 bg-stone-100 rounded-2xl flex items-center justify-center mb-4">
            <ShoppingBag size={28} className="text-stone-400" />
          </div>
          <p className="text-stone-600 font-semibold text-lg mb-1">
            {prodotti.length === 0 ? 'Nessun prodotto' : 'Nessun risultato'}
          </p>
          <p className="text-stone-400 text-sm">
            {prodotti.length === 0 ? 'Aggiungi il primo prodotto di rivendita' : 'Prova a modificare i filtri di ricerca'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {categoriePresenti.map(cat => {
            const catProd = filteredProdotti.filter(p => p.categoria === cat);
            if (catProd.length === 0) return null;
            const isOpen = expandedCat.has(cat);
            const catMarg = catProd.reduce((s, p) => s + (p.prezzo_vendita - p.prezzo_acquisto) * p.quantita_stock, 0);

            return (
              <div key={cat} className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
                {/* Category header */}
                <div
                  className="flex items-center gap-3 px-5 py-3.5 cursor-pointer hover:bg-stone-50 transition-colors select-none"
                  onClick={() => toggleCat(cat)}
                >
                  {isOpen ? <ChevronDown size={15} className="text-stone-400 flex-shrink-0" /> : <ChevronRight size={15} className="text-stone-400 flex-shrink-0" />}
                  <p className="text-sm font-bold text-stone-800 flex-1">{cat}</p>
                  <span className="text-xs text-stone-400">{catProd.length} prodotti</span>
                  <span className={`text-xs font-bold ml-3 ${catMarg >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {catMarg >= 0 ? '+' : ''}€ {fmt(catMarg)}
                  </span>
                  <button
                    onClick={e => { e.stopPropagation(); setEditing({ isNew: true, categoria: cat, prezzo_acquisto: 0, prezzo_vendita: 0, quantita_stock: 0, quantita_minima: 0, attivo: true }); }}
                    className="ml-3 p-1.5 rounded-lg hover:bg-amber-50 text-stone-400 hover:text-amber-600 transition-colors"
                    title="Aggiungi prodotto"
                  >
                    <Plus size={14} />
                  </button>
                </div>

                {/* Product rows */}
                {isOpen && (
                  <div className="border-t border-stone-100 divide-y divide-stone-50">
                    {catProd.map(p => {
                      const margineU = p.prezzo_vendita - p.prezzo_acquisto;
                      const margineRealP = margineU * (p.quantita_venduta || 0);
                      const scarso = p.quantita_minima > 0 && p.quantita_stock <= p.quantita_minima;
                      const esaurito = p.quantita_stock === 0;
                      const isAdj = adjusting.has(p.id);

                      return (
                        <div
                          key={p.id}
                          className={`flex items-center gap-3 px-5 py-3.5 transition-colors
                            ${esaurito ? 'bg-stone-50/60 opacity-60' : scarso ? 'bg-red-50/40' : 'hover:bg-stone-50/50'}
                            ${!p.attivo ? 'opacity-40' : ''}`}
                        >
                          {/* Nome + marca */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              {scarso && !esaurito && <AlertTriangle size={12} className="text-amber-500 flex-shrink-0" />}
                              {esaurito && <AlertTriangle size={12} className="text-red-500 flex-shrink-0" />}
                              <span className="font-semibold text-stone-800 text-sm">{p.nome}</span>
                              {p.marca && <span className="text-xs text-stone-400">{p.marca}</span>}
                              {esaurito && <span className="text-[10px] px-1.5 py-0.5 bg-red-100 text-red-600 rounded font-bold">Esaurito</span>}
                              {!p.attivo && <span className="text-[10px] px-1.5 py-0.5 bg-stone-100 text-stone-400 rounded font-medium">Inattivo</span>}
                            </div>
                            <div className="flex items-center gap-3 mt-0.5 text-xs text-stone-400 flex-wrap">
                              <span>Acq: <span className="text-stone-500 font-medium">€{fmt(p.prezzo_acquisto)}</span></span>
                              <span>Vend: <span className="text-emerald-600 font-semibold">€{fmt(p.prezzo_vendita)}</span></span>
                              <span className={`font-semibold ${margineU >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                margine {margineU >= 0 ? '+' : ''}€{fmt(margineU)}
                              </span>
                              {(p.quantita_venduta || 0) > 0 && (
                                <span className="flex items-center gap-1 text-teal-600 font-bold">
                                  <TrendingUp size={10} />
                                  realizzato +€{fmt(margineRealP)}
                                  <span className="font-normal text-teal-500">({p.quantita_venduta} vend.)</span>
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Controlli stock */}
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {/* Bottone - (vendita) */}
                            <button
                              onClick={() => adjustStock(p, -1)}
                              disabled={isAdj || esaurito}
                              className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-lg transition-all select-none
                                ${esaurito
                                  ? 'bg-stone-100 text-stone-300 cursor-not-allowed'
                                  : 'bg-red-50 text-red-500 hover:bg-red-500 hover:text-white active:scale-95 shadow-sm border border-red-200 hover:border-red-500'
                                }`}
                              title="Venduto 1 pezzo"
                            >
                              −
                            </button>

                            {/* Quantità */}
                            <div className={`w-12 text-center transition-all ${isAdj ? 'opacity-40' : ''}`}>
                              <span className={`text-lg font-bold tabular-nums ${esaurito ? 'text-stone-300' : scarso ? 'text-amber-600' : 'text-stone-800'}`}>
                                {p.quantita_stock}
                              </span>
                              {p.quantita_minima > 0 && (
                                <p className="text-[10px] text-stone-300 leading-none">min {p.quantita_minima}</p>
                              )}
                            </div>

                            {/* Bottone + (carico) */}
                            <button
                              onClick={() => adjustStock(p, +1)}
                              disabled={isAdj}
                              className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white active:scale-95 flex items-center justify-center font-bold text-lg transition-all select-none shadow-sm border border-emerald-200 hover:border-emerald-500"
                              title="Aggiungi 1 pezzo"
                            >
                              +
                            </button>
                          </div>

                          {/* Azioni modifica/elimina */}
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button onClick={() => setEditing({ ...p })} className="p-1.5 rounded-lg hover:bg-stone-200 text-stone-300 hover:text-stone-600 transition-colors">
                              <Edit2 size={14} />
                            </button>
                            <button onClick={() => handleDelete(p.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-stone-300 hover:text-red-500 transition-colors">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {/* Totale generale */}
          {categoriePresenti.length > 1 && (
            <div className="bg-stone-800 rounded-2xl px-5 py-4 flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2 flex-shrink-0">
                <TrendingUp size={16} className="text-amber-400" />
                <span className="text-sm font-bold text-white">Riepilogo totale</span>
              </div>
              <div className="flex items-center gap-6 ml-auto flex-wrap text-sm">
                <div>
                  <span className="text-stone-400 text-xs">Costo totale</span>
                  <p className="font-bold text-white">€ {fmt(totaleAcquisto)}</p>
                </div>
                <div>
                  <span className="text-stone-400 text-xs">Ricavo potenziale</span>
                  <p className="font-bold text-emerald-400">€ {fmt(totaleVendita)}</p>
                </div>
                <div>
                  <span className="text-stone-400 text-xs">Margine</span>
                  <p className={`font-bold ${margine >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {margine >= 0 ? '+' : ''}€ {fmt(margine)} <span className="text-xs opacity-70">({marginePerc.toFixed(0)}%)</span>
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ProdottoRivenditaModal({
  prod, onChange, onSave, onClose, saving,
}: {
  prod: EditingProdRivendita;
  onChange: (p: EditingProdRivendita) => void;
  onSave: () => void;
  onClose: () => void;
  saving: boolean;
}) {
  const margineU = (prod.prezzo_vendita ?? 0) - (prod.prezzo_acquisto ?? 0);
  const marginePerc = (prod.prezzo_acquisto ?? 0) > 0 ? (margineU / (prod.prezzo_acquisto ?? 1)) * 100 : 0;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[92vh] flex flex-col">
        <div className="px-6 py-5 border-b border-stone-100 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-amber-50 rounded-xl flex items-center justify-center">
              <ShoppingBag size={16} className="text-amber-600" />
            </div>
            <h3 className="text-base font-bold text-stone-800">{prod.isNew ? 'Nuovo prodotto rivendita' : 'Modifica prodotto'}</h3>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-stone-100 rounded-lg transition-colors text-stone-400"><X size={16} /></button>
        </div>

        <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
          {/* Categoria */}
          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wide">Categoria</label>
            <select
              value={prod.categoria ?? 'Shampoo'}
              onChange={e => onChange({ ...prod, categoria: e.target.value })}
              className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-300"
            >
              {CATEGORIE_RIVENDITA.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Nome */}
          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wide">Nome prodotto <span className="text-red-400">*</span></label>
            <input
              autoFocus
              value={prod.nome ?? ''}
              onChange={e => onChange({ ...prod, nome: e.target.value })}
              placeholder="es. Shampoo nutriente 500ml"
              className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-400"
            />
          </div>

          {/* Marca */}
          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wide">Marca</label>
            <input
              value={prod.marca ?? ''}
              onChange={e => onChange({ ...prod, marca: e.target.value })}
              placeholder="es. Wella, L'Oreal, Schwarzkopf..."
              className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-400"
            />
          </div>

          {/* Prezzi */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wide">Prezzo acquisto (€)</label>
              <input
                type="number" onInput={e => { const t = e.currentTarget; if (t.value.length > 1 && t.value.startsWith('0') && !t.value.startsWith('0.')) t.value = String(Number(t.value)); }} min={0} step="0.01"
                value={prod.prezzo_acquisto ?? 0}
                onChange={e => onChange({ ...prod, prezzo_acquisto: parseFloat(e.target.value) || 0 })}
                onFocus={e => e.target.select()}
                className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-400"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wide">Prezzo vendita (€)</label>
              <input
                type="number" onInput={e => { const t = e.currentTarget; if (t.value.length > 1 && t.value.startsWith('0') && !t.value.startsWith('0.')) t.value = String(Number(t.value)); }} min={0} step="0.01"
                value={prod.prezzo_vendita ?? 0}
                onChange={e => onChange({ ...prod, prezzo_vendita: parseFloat(e.target.value) || 0 })}
                onFocus={e => e.target.select()}
                className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-400"
              />
            </div>
          </div>

          {/* Margine preview */}
          {((prod.prezzo_acquisto ?? 0) > 0 || (prod.prezzo_vendita ?? 0) > 0) && (
            <div className={`rounded-xl px-4 py-3 flex items-center justify-between ${margineU >= 0 ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'}`}>
              <div className="flex items-center gap-2">
                <TrendingUp size={14} className={margineU >= 0 ? 'text-emerald-600' : 'text-red-500'} />
                <span className="text-xs font-semibold text-stone-600">Margine unitario</span>
              </div>
              <span className={`text-sm font-bold ${margineU >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                {margineU >= 0 ? '+' : ''}€ {fmt(margineU)}
                {(prod.prezzo_acquisto ?? 0) > 0 && <span className="text-xs font-normal ml-1.5 opacity-70">({marginePerc.toFixed(0)}%)</span>}
              </span>
            </div>
          )}

          {/* Stock */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wide">Pezzi in stock</label>
              <input
                type="number" onInput={e => { const t = e.currentTarget; if (t.value.length > 1 && t.value.startsWith('0') && !t.value.startsWith('0.')) t.value = String(Number(t.value)); }} min={0} step="1"
                value={prod.quantita_stock ?? 0}
                onChange={e => onChange({ ...prod, quantita_stock: parseInt(e.target.value) || 0 })}
                onFocus={e => e.target.select()}
                className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-400"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wide">Scorta minima</label>
              <input
                type="number" onInput={e => { const t = e.currentTarget; if (t.value.length > 1 && t.value.startsWith('0') && !t.value.startsWith('0.')) t.value = String(Number(t.value)); }} min={0} step="1"
                value={prod.quantita_minima ?? 0}
                onChange={e => onChange({ ...prod, quantita_minima: parseInt(e.target.value) || 0 })}
                onFocus={e => e.target.select()}
                placeholder="0 = nessun avviso"
                className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-400"
              />
            </div>
          </div>

          {/* Note */}
          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wide">Note</label>
            <textarea
              value={prod.note ?? ''}
              onChange={e => onChange({ ...prod, note: e.target.value })}
              rows={2}
              placeholder="Note aggiuntive..."
              className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-400 resize-none"
            />
          </div>

          {/* Attivo toggle */}
          <label className={`flex items-center gap-3 cursor-pointer px-4 py-3 rounded-xl border transition-colors ${prod.attivo !== false ? 'bg-emerald-50 border-emerald-200' : 'border-stone-200 hover:bg-stone-50'}`}>
            <div
              className={`w-10 h-5 rounded-full transition-colors relative flex-shrink-0 ${prod.attivo !== false ? 'bg-emerald-500' : 'bg-stone-200'}`}
              onClick={() => onChange({ ...prod, attivo: !(prod.attivo !== false) })}
            >
              <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${prod.attivo !== false ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </div>
            <div>
              <p className="text-sm font-semibold text-stone-700">Prodotto attivo</p>
              <p className="text-xs text-stone-400">I prodotti inattivi non vengono mostrati nelle vendite</p>
            </div>
          </label>
        </div>

        <div className="px-6 py-4 border-t border-stone-100 flex gap-3 flex-shrink-0">
          <button onClick={onClose} className="flex-1 py-2.5 border border-stone-200 rounded-xl text-sm font-semibold text-stone-600 hover:bg-stone-50 transition-colors">Annulla</button>
          <button onClick={onSave} disabled={saving || !prod.nome?.trim()} className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2">
            <Check size={13} />
            {saving ? 'Salvo...' : 'Salva prodotto'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── CategoriaModal ────────────────────────────────────────────────────────────

function CategoriaModal({
  cat, onSave, onClose, onChange, saving,
}: {
  cat: Partial<Categoria> & { isNew?: boolean };
  onSave: () => void;
  onClose: () => void;
  onChange: (c: Partial<Categoria> & { isNew?: boolean }) => void;
  saving: boolean;
}) {
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden max-h-[90vh] flex flex-col">
        <div className="px-6 py-5 border-b border-stone-100 flex items-center justify-between flex-shrink-0">
          <h3 className="text-base font-bold text-stone-800">{cat.isNew ? 'Nuova categoria' : 'Modifica categoria'}</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-stone-100 rounded-lg transition-colors text-stone-400"><X size={16} /></button>
        </div>
        <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wide">Nome categoria</label>
            <input
              autoFocus
              value={cat.nome ?? ''}
              onChange={e => onChange({ ...cat, nome: e.target.value })}
              onKeyDown={e => e.key === 'Enter' && onSave()}
              placeholder="es. Shampoo lavaggio"
              className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-400"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-2 uppercase tracking-wide">Colore</label>
            <div className="flex gap-2 flex-wrap">
              {COLORI_PRESET.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => onChange({ ...cat, colore: c })}
                  className={`w-8 h-8 rounded-full transition-transform hover:scale-110 ${cat.colore === c ? 'ring-2 ring-offset-2 ring-stone-400 scale-110' : ''}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-stone-100 flex gap-3 flex-shrink-0">
          <button onClick={onClose} className="flex-1 py-2.5 border border-stone-200 rounded-xl text-sm font-semibold text-stone-600 hover:bg-stone-50 transition-colors">Annulla</button>
          <button onClick={onSave} disabled={saving || !cat.nome?.trim()} className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2">
            <Check size={13} />
            {saving ? 'Salvo...' : 'Salva'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── ProdottoModal ─────────────────────────────────────────────────────────────

function ProdottoModal({
  prod, categorie, onSave, onClose, onChange, saving,
}: {
  prod: Partial<Prodotto> & { isNew?: boolean };
  categorie: Categoria[];
  onSave: () => void;
  onClose: () => void;
  onChange: (p: Partial<Prodotto> & { isNew?: boolean }) => void;
  saving: boolean;
}) {
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col">
        <div className="px-6 py-5 border-b border-stone-100 flex items-center justify-between flex-shrink-0">
          <h3 className="text-base font-bold text-stone-800">{prod.isNew ? 'Nuovo prodotto' : 'Modifica prodotto'}</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-stone-100 rounded-lg transition-colors text-stone-400"><X size={16} /></button>
        </div>
        <div className="px-6 py-5 grid grid-cols-2 gap-4 overflow-y-auto flex-1">
          {/* Categoria */}
          <div className="col-span-2">
            <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wide">Categoria</label>
            <select
              value={prod.categoria_id ?? ''}
              onChange={e => onChange({ ...prod, categoria_id: e.target.value })}
              className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-300"
            >
              {categorie.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>

          {/* Nome */}
          <div className="col-span-2">
            <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wide">Nome prodotto <span className="text-red-400">*</span></label>
            <input
              autoFocus
              value={prod.nome ?? ''}
              onChange={e => onChange({ ...prod, nome: e.target.value })}
              placeholder="es. Shampoo nutriente 500ml"
              className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-400"
            />
          </div>

          {/* Marca */}
          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wide">Marca</label>
            <input
              value={prod.marca ?? ''}
              onChange={e => onChange({ ...prod, marca: e.target.value })}
              placeholder="es. Wella, L'Oreal..."
              className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-400"
            />
          </div>

          {/* Unità */}
          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wide">Unità di misura</label>
            <select
              value={prod.unita ?? 'pz'}
              onChange={e => onChange({ ...prod, unita: e.target.value })}
              className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-300"
            >
              {UNITA_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>

          {/* Quantità */}
          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wide">Quantità in stock</label>
            <input
              type="number"
              onInput={e => { const t = e.currentTarget; if (t.value.length > 1 && t.value.startsWith('0') && !t.value.startsWith('0.')) t.value = String(Number(t.value)); }}
              min={0}
              step="0.5"
              value={prod.quantita ?? 0}
              onChange={e => onChange({ ...prod, quantita: parseFloat(e.target.value) || 0 })}
              onFocus={e => e.target.select()}
              className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-400"
            />
          </div>

          {/* Quantità minima */}
          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wide">Scorta minima</label>
            <input
              type="number"
              onInput={e => { const t = e.currentTarget; if (t.value.length > 1 && t.value.startsWith('0') && !t.value.startsWith('0.')) t.value = String(Number(t.value)); }}
              min={0}
              step="0.5"
              value={prod.quantita_minima ?? 0}
              onChange={e => onChange({ ...prod, quantita_minima: parseFloat(e.target.value) || 0 })}
              onFocus={e => e.target.select()}
              placeholder="0 = nessun avviso"
              className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-400"
            />
          </div>

          {/* Prezzo acquisto */}
          <div className="col-span-2">
            <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wide">Prezzo di acquisto (€)</label>
            <input
              type="number"
              onInput={e => { const t = e.currentTarget; if (t.value.length > 1 && t.value.startsWith('0') && !t.value.startsWith('0.')) t.value = String(Number(t.value)); }}
              min={0}
              step="0.01"
              value={prod.prezzo_acquisto ?? 0}
              onChange={e => onChange({ ...prod, prezzo_acquisto: parseFloat(e.target.value) || 0 })}
              onFocus={e => e.target.select()}
              className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-400"
            />
          </div>

          {/* Note */}
          <div className="col-span-2">
            <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wide">Note</label>
            <textarea
              value={prod.note ?? ''}
              onChange={e => onChange({ ...prod, note: e.target.value })}
              rows={2}
              placeholder="Note aggiuntive..."
              className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-400 resize-none"
            />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-stone-100 flex gap-3 flex-shrink-0">
          <button onClick={onClose} className="flex-1 py-2.5 border border-stone-200 rounded-xl text-sm font-semibold text-stone-600 hover:bg-stone-50 transition-colors">Annulla</button>
          <button onClick={onSave} disabled={saving || !prod.nome?.trim()} className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2">
            <Check size={13} />
            {saving ? 'Salvo...' : 'Salva prodotto'}
          </button>
        </div>
      </div>
    </div>
  );
}
