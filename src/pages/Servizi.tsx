import { useEffect, useState, useCallback } from 'react';
import { Plus, CreditCard as Edit2, Trash2, X, Clock, Euro, BookOpen, Pencil, ShoppingBag, Check } from 'lucide-react';
import { supabase, localDateStr, type TrattamentoCatalogo } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';

interface ServiceForm {
  nome: string;
  descrizione: string;
  durata_minuti: number;
  prezzo: number;
  colore: string;
  attivo: boolean;
}

interface VoceExtra {
  id: string;
  nome: string;
  descrizione: string;
  prezzo: number;
  colore: string;
  attivo: boolean;
}

interface VoceExtraForm {
  nome: string;
  descrizione: string;
  prezzo: number;
  colore: string;
  attivo: boolean;
}

const PRESET_COLORS = ['#EC4899', '#3B82F6', '#F59E0B', '#EF4444', '#10B981', '#F97316', '#06B6D4', '#6B7280'];

type TabView = 'servizi' | 'voci_extra' | 'prodotti_rivendita';

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

interface ParrucchiereSimple {
  id: string;
  nome: string;
  colore: string;
}

export default function Servizi() {
  const [tab, setTab] = useState<TabView>('servizi');

  return (
    <div className="p-6">
      <div className="flex gap-1 bg-stone-100 p-1 rounded-xl mb-6 w-fit">
        <button
          onClick={() => setTab('servizi')}
          className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${tab === 'servizi' ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
        >
          Servizi
        </button>
        <button
          onClick={() => setTab('voci_extra')}
          className={`px-5 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${tab === 'voci_extra' ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
        >
          <BookOpen size={14} />
          Voci Extra
        </button>
        <button
          onClick={() => setTab('prodotti_rivendita')}
          className={`px-5 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${tab === 'prodotti_rivendita' ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
        >
          <ShoppingBag size={14} />
          Prodotti Rivendita
        </button>
      </div>

      {tab === 'servizi' && <ServiziTab />}
      {tab === 'voci_extra' && <VociExtraTab />}
      {tab === 'prodotti_rivendita' && <ProdottiRivenditaTab />}
    </div>
  );
}

function ServiziTab() {
  const { user } = useAuth();
  const [servizi, setServizi] = useState<TrattamentoCatalogo[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ open: boolean; id?: string }>({ open: false });
  const [form, setForm] = useState<ServiceForm>({ nome: '', descrizione: '', durata_minuti: 30, prezzo: 0, colore: '#F59E0B', attivo: true });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('trattamenti_catalogo').select('*').order('nome');
    setServizi((data || []) as TrattamentoCatalogo[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function openNew() {
    setForm({ nome: '', descrizione: '', durata_minuti: 30, prezzo: 0, colore: '#F59E0B', attivo: true });
    setError('');
    setModal({ open: true });
  }

  async function openEdit(id: string) {
    const { data } = await supabase.from('trattamenti_catalogo').select('*').eq('id', id).maybeSingle();
    if (!data) return;
    const s = data as TrattamentoCatalogo;
    setForm({ nome: s.nome, descrizione: s.descrizione ?? '', durata_minuti: s.durata_minuti, prezzo: s.prezzo, colore: s.colore, attivo: s.attivo });
    setError('');
    setModal({ open: true, id });
  }

  async function handleSave() {
    if (!form.nome.trim()) { setError('Il nome del servizio è obbligatorio'); return; }
    setSaving(true);
    setError('');
    const payload = { nome: form.nome.trim(), descrizione: form.descrizione.trim(), durata_minuti: form.durata_minuti, prezzo: form.prezzo, colore: form.colore, attivo: form.attivo };
    if (modal.id) {
      await supabase.from('trattamenti_catalogo').update(payload).eq('id', modal.id);
    } else {
      await supabase.from('trattamenti_catalogo').insert({ ...payload, user_id: user?.id });
    }
    setSaving(false);
    setModal({ open: false });
    load();
  }

  async function deleteServizio(id: string) {
    if (!confirm('Eliminare questo servizio?')) return;
    await supabase.from('trattamenti_catalogo').delete().eq('id', id);
    load();
  }

  async function toggleAttivo(s: TrattamentoCatalogo) {
    await supabase.from('trattamenti_catalogo').update({ attivo: !s.attivo }).eq('id', s.id);
    load();
  }

  return (
    <>
      <div className="flex items-center justify-between mb-5">
        <p className="text-sm text-stone-500">{servizi.length} servizi nel catalogo</p>
        <button
          onClick={openNew}
          className="flex items-center gap-2 bg-amber-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-amber-600 transition-colors"
        >
          <Plus size={16} /> Nuovo servizio
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-7 h-7 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {servizi.map(s => (
            <div key={s.id} className={`bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden ${!s.attivo ? 'opacity-60' : ''}`}>
              <div className="h-2" style={{ backgroundColor: s.colore }} />
              <div className="p-5">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <p className="font-semibold text-stone-800">{s.nome}</p>
                    {s.descrizione && <p className="text-xs text-stone-400 mt-0.5">{s.descrizione}</p>}
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => openEdit(s.id)} className="p-1.5 text-stone-400 hover:text-amber-600 transition-colors">
                      <Edit2 size={14} />
                    </button>
                    <button onClick={() => deleteServizio(s.id)} className="p-1.5 text-stone-400 hover:text-red-500 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 text-sm text-stone-500">
                    <span className="flex items-center gap-1"><Clock size={12} /> {s.durata_minuti} min</span>
                    <span className="flex items-center gap-1"><Euro size={12} /> {s.prezzo.toFixed(2)}</span>
                  </div>
                  <button
                    onClick={() => toggleAttivo(s)}
                    className={`text-xs font-medium px-2.5 py-1 rounded-full transition-colors ${
                      s.attivo ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
                    }`}
                  >
                    {s.attivo ? 'Attivo' : 'Inattivo'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal.open && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100">
              <h2 className="font-bold text-stone-800 text-lg">
                {modal.id ? 'Modifica Servizio' : 'Nuovo Servizio'}
              </h2>
              <button onClick={() => setModal({ open: false })} className="text-stone-400 hover:text-stone-700">
                <X size={20} />
              </button>
            </div>
            <div className="overflow-auto px-6 py-5 space-y-4 flex-1">
              {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wide">Nome servizio *</label>
                <input
                  value={form.nome}
                  onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  placeholder="es. Taglio donna"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wide">Descrizione</label>
                <input
                  value={form.descrizione}
                  onChange={e => setForm(f => ({ ...f, descrizione: e.target.value }))}
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wide">Durata (min)</label>
                  <input
                    type="number" onInput={e => { const t = e.currentTarget; if (t.value.length > 1 && t.value.startsWith('0') && !t.value.startsWith('0.')) t.value = String(Number(t.value)); }} min={5} step={5}
                    value={form.durata_minuti}
                    onChange={e => setForm(f => ({ ...f, durata_minuti: parseInt(e.target.value) || 30 }))}
                    onFocus={e => e.target.select()}
                    className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wide">Prezzo (€)</label>
                  <input
                    type="number" onInput={e => { const t = e.currentTarget; if (t.value.length > 1 && t.value.startsWith('0') && !t.value.startsWith('0.')) t.value = String(Number(t.value)); }} min={0} step={0.5}
                    value={form.prezzo}
                    onChange={e => setForm(f => ({ ...f, prezzo: parseFloat(e.target.value) || 0 }))}
                    onFocus={e => e.target.select()}
                    className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wide">Colore etichetta</label>
                <div className="flex gap-2 flex-wrap">
                  {PRESET_COLORS.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, colore: c }))}
                      className="w-7 h-7 rounded-full transition-transform hover:scale-110"
                      style={{ backgroundColor: c, outline: form.colore === c ? `3px solid ${c}` : 'none', outlineOffset: '2px' }}
                    />
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="attivo-s"
                  checked={form.attivo}
                  onChange={e => setForm(f => ({ ...f, attivo: e.target.checked }))}
                  className="w-4 h-4 accent-amber-500"
                />
                <label htmlFor="attivo-s" className="text-sm text-stone-700">Servizio attivo (visibile nella prenotazione)</label>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-stone-100 flex gap-3 justify-end">
              <button onClick={() => setModal({ open: false })} className="px-5 py-2 text-sm font-medium text-stone-600 border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors">
                Annulla
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2 text-sm font-medium bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-50"
              >
                {saving ? 'Salvataggio...' : 'Salva'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

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
    const { data } = await supabase.from('voci_extra_catalogo').select('*').order('nome');
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
      await supabase.from('voci_extra_catalogo').update(payload).eq('id', modal.id);
    } else {
      await supabase.from('voci_extra_catalogo').insert({ ...payload, user_id: user?.id });
    }
    setSaving(false);
    setModal({ open: false });
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm('Eliminare questa voce?')) return;
    await supabase.from('voci_extra_catalogo').delete().eq('id', id);
    load();
  }

  async function toggleAttivo(v: VoceExtra) {
    await supabase.from('voci_extra_catalogo').update({ attivo: !v.attivo }).eq('id', v.id);
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
        <button onClick={openNew} className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-xl transition-colors">
          <Plus size={15} /> Nuova voce
        </button>
      </div>

      {voci.length === 0 ? (
        <div className="bg-white rounded-xl border border-stone-200 px-6 py-16 text-center text-stone-400">
          Nessuna voce extra — creane una con il pulsante sopra
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {voci.map(v => (
            <div key={v.id} className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-opacity ${v.attivo ? '' : 'opacity-50'}`} style={{ borderColor: `${v.colore}40` }}>
              <div className="h-2 w-full" style={{ backgroundColor: v.colore }} />
              <div className="p-5">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div>
                    <p className="font-semibold text-stone-800">{v.nome}</p>
                    {v.descrizione && <p className="text-xs text-stone-400 mt-0.5 line-clamp-2">{v.descrizione}</p>}
                  </div>
                  {v.nome.toLowerCase() !== 'rivendita prodotto' && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => openEdit(v)} className="p-1.5 text-stone-400 hover:text-amber-600 transition-colors">
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => handleDelete(v.id)} className="p-1.5 text-stone-400 hover:text-red-500 transition-colors">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between mt-3">
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
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100">
              <h2 className="font-bold text-stone-800 text-lg">{modal.id ? 'Modifica voce' : 'Nuova voce extra'}</h2>
              <button onClick={() => setModal({ open: false })} className="text-stone-400 hover:text-stone-700"><X size={20} /></button>
            </div>
            <div className="overflow-auto px-6 py-5 space-y-4 flex-1">
              {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wide">Nome *</label>
                <input autoFocus value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  placeholder="es. Tonalizzante" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wide">Descrizione</label>
                <textarea value={form.descrizione} onChange={e => setForm(f => ({ ...f, descrizione: e.target.value }))} rows={2}
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
                  placeholder="Descrizione opzionale…" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wide">Prezzo (€)</label>
                  <input type="number" onInput={e => { const t = e.currentTarget; if (t.value.length > 1 && t.value.startsWith('0') && !t.value.startsWith('0.')) t.value = String(Number(t.value)); }} min={0} step={0.5} value={form.prezzo}
                    onChange={e => setForm(f => ({ ...f, prezzo: parseFloat(e.target.value) || 0 }))}
                    onFocus={e => e.target.select()}
                    className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wide">Stato</label>
                  <select value={form.attivo ? 'si' : 'no'} onChange={e => setForm(f => ({ ...f, attivo: e.target.value === 'si' }))}
                    className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
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
                      className="w-7 h-7 rounded-full transition-transform hover:scale-110"
                      style={{ backgroundColor: c, outline: form.colore === c ? `3px solid ${c}` : 'none', outlineOffset: '2px' }} />
                  ))}
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-stone-100 flex gap-3 justify-end">
              <button onClick={() => setModal({ open: false })} className="px-5 py-2 text-sm font-medium text-stone-600 border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors">Annulla</button>
              <button onClick={handleSave} disabled={saving} className="px-5 py-2 text-sm font-medium bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-50">
                {saving ? 'Salvataggio...' : 'Salva'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
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
    const [{ data: prod }, { data: parr }] = await Promise.all([
      supabase.from('prodotti_rivendita_catalogo').select('*').eq('attivo', true).order('categoria').order('nome'),
      supabase.from('parrucchieri').select('id, nome, colore').eq('attivo', true).order('nome'),
    ]);
    setProdotti((prod || []) as ProdottoRivenditaCatalogo[]);
    setParrucchieri((parr || []) as ParrucchiereSimple[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function openVendita(p: ProdottoRivenditaCatalogo) {
    setVendita({ prodotto: p, parrId: parrucchieri[0]?.id ?? '', quantita: 1, prezzoUnitario: p.prezzo_vendita, data: localDateStr() });
  }

  async function confermaVendita() {
    if (!vendita) return;
    setSaving(true);
    const parr = parrucchieri.find(p => p.id === vendita.parrId);
    await supabase.from('rivendita_prodotti').insert({
      parrucchiere_id: vendita.parrId,
      nome_prodotto: vendita.prodotto.nome,
      quantita: vendita.quantita,
      prezzo_unitario: vendita.prezzoUnitario,
      data_vendita: vendita.data,
      note: vendita.prodotto.marca ? `Marca: ${vendita.prodotto.marca}` : '',
      user_id: user?.id,
    });
    const nuovoStock = Math.max(0, vendita.prodotto.quantita_stock - vendita.quantita);
    const nuovaVenduta = (vendita.prodotto.quantita_venduta || 0) + vendita.quantita;
    await supabase.from('prodotti_rivendita_catalogo').update({
      quantita_stock: nuovoStock,
      quantita_venduta: nuovaVenduta,
      updated_at: new Date().toISOString(),
    }).eq('id', vendita.prodotto.id);
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
      return p.nome.toLowerCase().includes(q) || p.marca.toLowerCase().includes(q);
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
                      ${esaurito ? 'bg-stone-100 text-stone-300 cursor-not-allowed' : 'bg-amber-500 hover:bg-amber-600 text-white shadow-sm active:scale-95'}`}
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

