import { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Trash2, Check, ChevronDown, Pencil } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';

interface Trattamento {
  id: string;
  nome: string;
  categoria_recensione: string | null;
}

interface CategoriaCustom {
  id: string;
  slug: string;
  nome_display: string;
  testo_con_taglio: string | null;
  testo_senza_taglio: string | null;
}

const CATEGORIE_STANDARD = [
  { slug: 'schiariture', label: 'Schiariture / Balayage / Colpi di Sole' },
  { slug: 'colore_organico', label: 'Colore Organico / Henné' },
  { slug: 'colore', label: 'Colore' },
  { slug: 'taglio_solo', label: 'Solo Taglio' },
  { slug: 'hairtouch', label: 'Color Gloss / Hairtouch' },
  { slug: 'stiraggio_permanente', label: 'Stiraggio Permanente / X-Tenso' },
  { slug: 'trattamento_keratina', label: 'Cheratina / Biotryx' },
  { slug: 'extension', label: 'Extension' },
  { slug: 'olaplex', label: 'Olaplex' },
  { slug: 'trattamento_rigenerante', label: 'Trattamento Rigenerante' },
  { slug: 'default', label: 'Default / Generico' },
];

export default function RecensioniMappingPanel({ onBack }: { onBack: () => void }) {
  const { user } = useAuth();
  const [trattamenti, setTrattamenti] = useState<Trattamento[]>([]);
  const [categorie, setCategorie] = useState<CategoriaCustom[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const [showNewCat, setShowNewCat] = useState(false);
  const [newNome, setNewNome] = useState('');
  const [newTestoCon, setNewTestoCon] = useState('');
  const [newTestoSenza, setNewTestoSenza] = useState('');
  const [savingCat, setSavingCat] = useState(false);

  const [editingCat, setEditingCat] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<CategoriaCustom>>({});

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user]);

  async function loadData() {
    const [{ data: t }, { data: c }] = await Promise.all([
      supabase
        .from('trattamenti_catalogo')
        .select('id,nome,categoria_recensione')
        .eq('user_id', user!.id)
        .eq('attivo', true)
        .is('deleted_at', null)
        .order('nome'),
      supabase
        .from('recensioni_categorie')
        .select('id,slug,nome_display,testo_con_taglio,testo_senza_taglio')
        .eq('user_id', user!.id)
        .order('nome_display'),
    ]);
    setTrattamenti((t ?? []) as Trattamento[]);
    setCategorie((c ?? []) as CategoriaCustom[]);
  }

  function showFeedback(msg: string) {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 2000);
  }

  async function handleChangeCategory(id: string, cat: string) {
    setSavingId(id);
    await supabase.from('trattamenti_catalogo').update({ categoria_recensione: cat }).eq('id', id);
    setTrattamenti(prev => prev.map(t => t.id === id ? { ...t, categoria_recensione: cat } : t));
    setSavingId(null);
    showFeedback('Salvato');
  }

  async function handleAddCategory() {
    if (!newNome.trim() || !user) return;
    setSavingCat(true);
    const slug = newNome.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '').replace(/^_+|_+$/g, '');
    const { error } = await supabase.from('recensioni_categorie').insert({
      user_id: user.id,
      slug,
      nome_display: newNome.trim(),
      testo_con_taglio: newTestoCon.trim() || null,
      testo_senza_taglio: newTestoSenza.trim() || null,
    });
    if (!error) {
      await loadData();
      setShowNewCat(false);
      setNewNome('');
      setNewTestoCon('');
      setNewTestoSenza('');
      showFeedback('Categoria aggiunta');
    }
    setSavingCat(false);
  }

  async function handleSaveEdit(id: string) {
    if (!editDraft.nome_display?.trim()) return;
    await supabase.from('recensioni_categorie').update({
      nome_display: editDraft.nome_display,
      testo_con_taglio: editDraft.testo_con_taglio || null,
      testo_senza_taglio: editDraft.testo_senza_taglio || null,
    }).eq('id', id);
    await loadData();
    setEditingCat(null);
    showFeedback('Salvato');
  }

  async function handleDeleteCat(id: string) {
    await supabase.from('recensioni_categorie').delete().eq('id', id);
    setCategorie(prev => prev.filter(c => c.id !== id));
  }

  const allCategorie = [
    ...CATEGORIE_STANDARD,
    ...categorie.map(c => ({ slug: c.slug, label: `${c.nome_display} (personalizzata)` })),
  ];

  const labelFor = (slug: string) =>
    allCategorie.find(c => c.slug === slug)?.label ?? slug;

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-2 hover:bg-stone-100 rounded-xl transition-colors text-stone-500 hover:text-stone-800"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h2 className="text-xl font-bold text-stone-800">Mappatura Servizi</h2>
          <p className="text-sm text-stone-500 mt-0.5">
            Associa ogni servizio del listino a una categoria di recensione
          </p>
        </div>
      </div>

      {feedback && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700">
          <Check size={14} /> {feedback}
        </div>
      )}

      {/* Section 1: Service mapping */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-stone-100">
          <h3 className="font-semibold text-stone-800 text-sm">Servizi del Listino</h3>
          <p className="text-xs text-stone-400 mt-0.5">
            Assegna la categoria messaggi a ciascun servizio — ha la precedenza sul riconoscimento automatico
          </p>
        </div>

        {trattamenti.length === 0 ? (
          <div className="px-5 py-8 text-center text-stone-400 text-sm">
            Nessun servizio attivo nel listino
          </div>
        ) : (
          <div className="divide-y divide-stone-100">
            {trattamenti.map(t => (
              <div key={t.id} className="flex items-center gap-3 px-5 py-3">
                <span className="flex-1 text-sm text-stone-700 font-medium truncate">{t.nome}</span>
                <div className="relative flex-shrink-0">
                  <select
                    value={t.categoria_recensione ?? 'default'}
                    onChange={e => handleChangeCategory(t.id, e.target.value)}
                    disabled={savingId === t.id}
                    className="text-xs border border-stone-200 rounded-lg px-3 py-1.5 pr-7 bg-white text-stone-700 focus:outline-none focus:ring-2 focus:ring-blue-300 appearance-none cursor-pointer min-w-[160px]"
                  >
                    {allCategorie.map(c => (
                      <option key={c.slug} value={c.slug}>{c.label}</option>
                    ))}
                  </select>
                  <ChevronDown size={11} className="absolute right-2 top-2.5 text-stone-400 pointer-events-none" />
                </div>
                {savingId === t.id && (
                  <div className="w-3.5 h-3.5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Section 2: Custom categories */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-stone-800 text-sm">Categorie Personalizzate</h3>
            <p className="text-xs text-stone-400 mt-0.5">
              Crea nuove categorie con messaggi su misura
            </p>
          </div>
          {!showNewCat && (
            <button
              onClick={() => setShowNewCat(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition-colors"
            >
              <Plus size={13} /> Aggiungi Categoria
            </button>
          )}
        </div>

        {/* New category form */}
        {showNewCat && (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 space-y-4">
            <h4 className="font-semibold text-blue-800 text-sm">Nuova Categoria</h4>

            <div>
              <label className="text-xs font-semibold text-stone-600 block mb-1">
                Nome categoria <span className="text-red-400">*</span>
              </label>
              <input
                value={newNome}
                onChange={e => setNewNome(e.target.value)}
                placeholder="es. Sposa, Piega, Colore Fantasia..."
                className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
              {newNome && (
                <p className="text-xs text-stone-400 mt-1">
                  Slug: <span className="font-mono">{newNome.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '').replace(/^_+|_+$/g, '')}</span>
                </p>
              )}
            </div>

            <div>
              <label className="text-xs font-semibold text-stone-600 block mb-1">Messaggio con taglio</label>
              <textarea
                value={newTestoCon}
                onChange={e => setNewTestoCon(e.target.value)}
                rows={5}
                placeholder="Testo WhatsApp quando il servizio include anche il taglio..."
                className="w-full border border-stone-200 rounded-xl px-3 py-2 text-xs leading-relaxed bg-white focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-stone-600 block mb-1">Messaggio senza taglio</label>
              <textarea
                value={newTestoSenza}
                onChange={e => setNewTestoSenza(e.target.value)}
                rows={5}
                placeholder="Testo WhatsApp quando il servizio non include il taglio..."
                className="w-full border border-stone-200 rounded-xl px-3 py-2 text-xs leading-relaxed bg-white focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleAddCategory}
                disabled={!newNome.trim() || savingCat}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-colors"
              >
                {savingCat
                  ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <Check size={12} />
                }
                Salva Categoria
              </button>
              <button
                onClick={() => { setShowNewCat(false); setNewNome(''); setNewTestoCon(''); setNewTestoSenza(''); }}
                className="px-4 py-2 text-stone-500 text-xs font-medium hover:text-stone-700 transition-colors"
              >
                Annulla
              </button>
            </div>
          </div>
        )}

        {categorie.length === 0 && !showNewCat && (
          <div className="bg-stone-50 border border-stone-200 rounded-2xl px-5 py-8 text-center">
            <p className="text-sm text-stone-500">Nessuna categoria personalizzata</p>
            <p className="text-xs text-stone-400 mt-1">
              Crea una categoria per messaggi completamente su misura per i tuoi servizi
            </p>
          </div>
        )}

        {categorie.map(cat => (
          <div key={cat.id} className="bg-white border border-stone-200 rounded-2xl shadow-sm overflow-hidden">
            {/* Category header */}
            <div className="flex items-center gap-3 px-5 py-3.5 border-b border-stone-100">
              <div className="flex-1 min-w-0">
                <span className="text-sm font-semibold text-stone-800">{cat.nome_display}</span>
                <span className="ml-2 text-xs text-stone-400 font-mono bg-stone-50 px-1.5 py-0.5 rounded">
                  {cat.slug}
                </span>
                <div className="text-xs text-stone-400 mt-0.5">
                  Usata da: {trattamenti.filter(t => t.categoria_recensione === cat.slug).map(t => t.nome).join(', ') || 'nessun servizio mappato'}
                </div>
              </div>
              <div className="flex gap-1.5 flex-shrink-0">
                <button
                  onClick={() => { setEditingCat(cat.id); setEditDraft({ ...cat }); }}
                  className="p-1.5 hover:bg-stone-100 rounded-lg text-stone-400 hover:text-stone-700 transition-colors"
                  title="Modifica"
                >
                  <Pencil size={13} />
                </button>
                <button
                  onClick={() => handleDeleteCat(cat.id)}
                  className="p-1.5 hover:bg-red-50 rounded-lg text-stone-400 hover:text-red-500 transition-colors"
                  title="Elimina"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>

            {/* Edit form or preview */}
            {editingCat === cat.id ? (
              <div className="px-5 py-4 space-y-3">
                <div>
                  <label className="text-xs font-semibold text-stone-500 block mb-1">Nome</label>
                  <input
                    value={editDraft.nome_display ?? ''}
                    onChange={e => setEditDraft(p => ({ ...p, nome_display: e.target.value }))}
                    className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-stone-500 block mb-1">Messaggio con taglio</label>
                  <textarea
                    rows={5}
                    value={editDraft.testo_con_taglio ?? ''}
                    onChange={e => setEditDraft(p => ({ ...p, testo_con_taglio: e.target.value }))}
                    className="w-full border border-stone-200 rounded-xl px-3 py-2 text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-stone-500 block mb-1">Messaggio senza taglio</label>
                  <textarea
                    rows={5}
                    value={editDraft.testo_senza_taglio ?? ''}
                    onChange={e => setEditDraft(p => ({ ...p, testo_senza_taglio: e.target.value }))}
                    className="w-full border border-stone-200 rounded-xl px-3 py-2 text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleSaveEdit(cat.id)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition-colors"
                  >
                    <Check size={12} /> Salva
                  </button>
                  <button
                    onClick={() => setEditingCat(null)}
                    className="px-4 py-2 text-stone-500 text-xs hover:text-stone-700 transition-colors"
                  >
                    Annulla
                  </button>
                </div>
              </div>
            ) : (
              <div className="px-5 py-3 space-y-2">
                {cat.testo_con_taglio ? (
                  <div>
                    <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-0.5">Con taglio</p>
                    <p className="text-xs text-stone-600 leading-relaxed line-clamp-2 whitespace-pre-line">
                      {cat.testo_con_taglio}
                    </p>
                  </div>
                ) : null}
                {cat.testo_senza_taglio ? (
                  <div>
                    <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-0.5">Senza taglio</p>
                    <p className="text-xs text-stone-600 leading-relaxed line-clamp-2 whitespace-pre-line">
                      {cat.testo_senza_taglio}
                    </p>
                  </div>
                ) : null}
                {!cat.testo_con_taglio && !cat.testo_senza_taglio && (
                  <p className="text-xs text-stone-400 italic py-1">Nessun testo configurato — verrà usato il testo default</p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Info box */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
        <p className="text-xs text-amber-700 leading-relaxed">
          <span className="font-semibold">Come funziona:</span> quando viene inviato il promemoria, il sistema controlla prima la mappatura manuale. Se un servizio e' mappato, usa quella categoria. Altrimenti usa il riconoscimento automatico basato sul nome del servizio.
          La categoria determina quale testo WhatsApp viene usato nel modal "Promemoria Recensioni".
        </p>
      </div>
    </div>
  );
}
