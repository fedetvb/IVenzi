import { useState, useEffect, useCallback } from 'react';
import { Search, Save, CheckCircle, Package, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';

interface Prodotto {
  id: string;
  nome: string;
  marca: string | null;
  categoria: string | null;
  prezzo_vendita: number | null;
  attivo: boolean;
  quiz_tags: string[];
}

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error';
}

const QUIZ_GRUPPI: { label: string; emoji: string; tags: string[] }[] = [
  {
    label: 'Tipo Capello',
    emoji: '💇',
    tags: ['lisci', 'mossi', 'ricci', 'afro'],
  },
  {
    label: 'Sensazione',
    emoji: '✨',
    tags: ['normali', 'secchi', 'danneggiati', 'pesanti'],
  },
  {
    label: 'Effetto Crespo',
    emoji: '🌊',
    tags: ['no_crespo', 'crespo_umidita', 'alta_esigenza', 'punte_rovinate'],
  },
  {
    label: 'Stato Cute',
    emoji: '🌿',
    tags: ['cute_grassa', 'cute_secca', 'cute_sensibile', 'cute_normale'],
  },
  {
    label: 'Obiettivo',
    emoji: '🎯',
    tags: ['idratazione', 'volume', 'riparazione', 'definizione'],
  },
  {
    label: 'Stress / Trattamenti',
    emoji: '🔥',
    tags: ['colorati_trattati', 'calore_frequente', 'basso_stress', 'naturali'],
  },
  {
    label: 'Difficoltà Piega',
    emoji: '💨',
    tags: ['durata_styling', 'difficili_gestione', 'opachi', 'mantenimento'],
  },
  {
    label: 'Stile di Vita',
    emoji: '⏱️',
    tags: ['fast_routine', 'standard_routine', 'premium_routine', 'curativa'],
  },
];

const TAG_LABELS: Record<string, string> = {
  lisci: 'Lisci', mossi: 'Mossi', ricci: 'Ricci', afro: 'Afro',
  normali: 'Normali', secchi: 'Secchi', danneggiati: 'Danneggiati', pesanti: 'Pesanti',
  no_crespo: 'No Crespo', crespo_umidita: 'Crespo Umidità', alta_esigenza: 'Alta Esigenza', punte_rovinate: 'Punte Rovinate',
  cute_grassa: 'Cute Grassa', cute_secca: 'Cute Secca', cute_sensibile: 'Cute Sensibile', cute_normale: 'Cute Normale',
  idratazione: 'Idratazione', volume: 'Volume', riparazione: 'Riparazione', definizione: 'Definizione',
  colorati_trattati: 'Colorati/Trattati', calore_frequente: 'Calore Frequente', basso_stress: 'Basso Stress', naturali: 'Naturali',
  durata_styling: 'Durata Styling', difficili_gestione: 'Difficili da Gestire', opachi: 'Opachi', mantenimento: 'Mantenimento',
  fast_routine: 'Fast Routine', standard_routine: 'Standard Routine', premium_routine: 'Premium Routine', curativa: 'Curativa',
};

export default function ProdottiOnline() {
  const { user } = useAuth();
  const [prodotti, setProdotti] = useState<Prodotto[]>([]);
  const [localTags, setLocalTags] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [savingRow, setSavingRow] = useState<Record<string, boolean>>({});
  const [savingAll, setSavingAll] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [search, setSearch] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  function addToast(message: string, type: 'success' | 'error') {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('prodotti_rivendita_catalogo')
      .select('id, nome, marca, categoria, prezzo_vendita, attivo, quiz_tags')
      .eq('user_id', user.id)
      .eq('attivo', true)
      .order('categoria', { ascending: true })
      .order('nome', { ascending: true });

    if (error) {
      addToast('Errore nel caricamento dei prodotti.', 'error');
    } else {
      const rows = (data ?? []) as Prodotto[];
      setProdotti(rows);
      const init: Record<string, string[]> = {};
      rows.forEach(p => { init[p.id] = p.quiz_tags ?? []; });
      setLocalTags(init);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  function toggleTag(prodottoId: string, tag: string) {
    setLocalTags(prev => {
      const current = prev[prodottoId] ?? [];
      const next = current.includes(tag)
        ? current.filter(t => t !== tag)
        : [...current, tag];
      return { ...prev, [prodottoId]: next };
    });
  }

  async function saveRow(prodottoId: string) {
    setSavingRow(prev => ({ ...prev, [prodottoId]: true }));
    const tags = localTags[prodottoId] ?? [];
    const { error } = await supabase
      .from('prodotti_rivendita_catalogo')
      .update({ quiz_tags: tags })
      .eq('id', prodottoId);
    setSavingRow(prev => ({ ...prev, [prodottoId]: false }));
    if (error) {
      addToast('Errore nel salvataggio. Riprova.', 'error');
    } else {
      setProdotti(prev => prev.map(p => p.id === prodottoId ? { ...p, quiz_tags: tags } : p));
      addToast('Mappatura salvata!', 'success');
    }
  }

  async function saveAll() {
    setSavingAll(true);
    const filtered = prodottiFiltrati;
    let errori = 0;
    await Promise.all(filtered.map(async p => {
      const tags = localTags[p.id] ?? [];
      const { error } = await supabase
        .from('prodotti_rivendita_catalogo')
        .update({ quiz_tags: tags })
        .eq('id', p.id);
      if (error) errori++;
      else setProdotti(prev => prev.map(r => r.id === p.id ? { ...r, quiz_tags: tags } : r));
    }));
    setSavingAll(false);
    if (errori > 0) {
      addToast(`${errori} prodotti non salvati. Riprova.`, 'error');
    } else {
      addToast('Tutte le modifiche salvate!', 'success');
    }
  }

  function toggleGroup(prodottoId: string, groupLabel: string) {
    const key = `${prodottoId}__${groupLabel}`;
    setExpandedGroups(prev => ({ ...prev, [key]: !prev[key] }));
  }

  function isGroupExpanded(prodottoId: string, groupLabel: string) {
    const key = `${prodottoId}__${groupLabel}`;
    return !!expandedGroups[key];
  }

  const q = search.toLowerCase();
  const prodottiFiltrati = prodotti.filter(p =>
    !q || p.nome.toLowerCase().includes(q) || (p.categoria ?? '').toLowerCase().includes(q) || (p.marca ?? '').toLowerCase().includes(q)
  );

  function hasChanges(prodottoId: string): boolean {
    const original = prodotti.find(p => p.id === prodottoId)?.quiz_tags ?? [];
    const current = localTags[prodottoId] ?? [];
    if (original.length !== current.length) return true;
    return original.some(t => !current.includes(t)) || current.some(t => !original.includes(t));
  }

  const totalModifiche = prodottiFiltrati.filter(p => hasChanges(p.id)).length;

  return (
    <div className="p-4 sm:p-6 lg:p-8 min-h-full bg-stone-50">
      {/* Toast notifications */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`flex items-center gap-3 px-4 py-3 rounded-2xl shadow-lg text-sm font-medium pointer-events-auto transition-all ${
              t.type === 'success'
                ? 'bg-emerald-600 text-white'
                : 'bg-red-600 text-white'
            }`}
          >
            {t.type === 'success' ? <CheckCircle size={16} /> : <Package size={16} />}
            {t.message}
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 tracking-tight">Prodotti Online</h1>
          <p className="text-sm text-stone-500 mt-1">
            Assegna i tag del quiz capelli a ogni prodotto del catalogo.
            {totalModifiche > 0 && (
              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
                {totalModifiche} {totalModifiche === 1 ? 'modifica non salvata' : 'modifiche non salvate'}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={saveAll}
          disabled={savingAll || totalModifiche === 0}
          className="flex items-center gap-2 px-5 py-2.5 bg-stone-900 text-white text-sm font-semibold rounded-xl hover:bg-stone-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
        >
          {savingAll ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Salva Tutte le Modifiche
        </button>
      </div>

      {/* Search bar */}
      <div className="relative mb-6 max-w-md">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
        <input
          type="text"
          placeholder="Cerca per nome, marca o categoria..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-stone-200 rounded-xl text-sm text-stone-700 placeholder-stone-400 outline-none focus:ring-2 focus:ring-stone-300 shadow-sm"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="flex flex-col items-center gap-4">
            <Loader2 size={32} className="text-stone-400 animate-spin" />
            <p className="text-sm text-stone-400">Caricamento prodotti...</p>
          </div>
        </div>
      ) : prodottiFiltrati.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <div className="w-14 h-14 bg-stone-100 rounded-2xl flex items-center justify-center">
            <Package size={24} className="text-stone-400" />
          </div>
          <p className="text-stone-500 text-sm">
            {search ? 'Nessun prodotto trovato per questa ricerca.' : 'Nessun prodotto attivo nel catalogo.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {prodottiFiltrati.map(prodotto => {
            const tags = localTags[prodotto.id] ?? [];
            const changed = hasChanges(prodotto.id);
            const saving = savingRow[prodotto.id] ?? false;

            return (
              <div
                key={prodotto.id}
                className={`bg-white rounded-2xl border transition-all shadow-sm ${
                  changed ? 'border-amber-300 ring-1 ring-amber-200' : 'border-stone-200'
                }`}
              >
                {/* Product header row */}
                <div className="flex items-center gap-4 p-4 sm:p-5">
                  {/* Image placeholder */}
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-stone-100 to-stone-200 flex items-center justify-center flex-shrink-0">
                    <Package size={20} className="text-stone-400" />
                  </div>

                  {/* Name / category */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-stone-800 text-sm leading-tight truncate">{prodotto.nome}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {prodotto.marca && (
                        <span className="text-xs text-stone-400">{prodotto.marca}</span>
                      )}
                      {prodotto.categoria && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-stone-100 text-stone-600">
                          {prodotto.categoria}
                        </span>
                      )}
                      {prodotto.prezzo_vendita != null && (
                        <span className="text-xs font-semibold text-stone-600">€{prodotto.prezzo_vendita.toFixed(2)}</span>
                      )}
                    </div>
                  </div>

                  {/* Tag count badge */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {tags.length > 0 && (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {tags.length} tag
                      </span>
                    )}
                    <button
                      onClick={() => saveRow(prodotto.id)}
                      disabled={saving || !changed}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-stone-900 text-white hover:bg-stone-700"
                    >
                      {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                      Salva
                    </button>
                  </div>
                </div>

                {/* Quiz groups */}
                <div className="border-t border-stone-100 px-4 sm:px-5 py-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {QUIZ_GRUPPI.map(gruppo => {
                    const selectedInGroup = gruppo.tags.filter(t => tags.includes(t));
                    const expanded = isGroupExpanded(prodotto.id, gruppo.label);

                    return (
                      <div key={gruppo.label} className="border border-stone-100 rounded-xl overflow-hidden bg-stone-50">
                        <button
                          onClick={() => toggleGroup(prodotto.id, gruppo.label)}
                          className="w-full flex items-center justify-between px-3 py-2 hover:bg-stone-100 transition-colors"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-sm">{gruppo.emoji}</span>
                            <span className="text-xs font-semibold text-stone-700 truncate">{gruppo.label}</span>
                            {selectedInGroup.length > 0 && (
                              <span className="flex-shrink-0 inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold rounded-full bg-emerald-500 text-white">
                                {selectedInGroup.length}
                              </span>
                            )}
                          </div>
                          {expanded ? <ChevronUp size={13} className="text-stone-400 flex-shrink-0" /> : <ChevronDown size={13} className="text-stone-400 flex-shrink-0" />}
                        </button>

                        {expanded && (
                          <div className="px-3 pb-2.5 pt-1 flex flex-col gap-1.5">
                            {gruppo.tags.map(tag => {
                              const checked = tags.includes(tag);
                              return (
                                <label
                                  key={tag}
                                  className={`flex items-center gap-2 cursor-pointer rounded-lg px-2 py-1.5 transition-colors select-none ${
                                    checked ? 'bg-emerald-50' : 'hover:bg-stone-100'
                                  }`}
                                >
                                  <div
                                    className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border transition-all ${
                                      checked
                                        ? 'bg-emerald-500 border-emerald-500'
                                        : 'border-stone-300 bg-white'
                                    }`}
                                    onClick={() => toggleTag(prodotto.id, tag)}
                                  >
                                    {checked && (
                                      <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                                        <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                      </svg>
                                    )}
                                  </div>
                                  <span
                                    className={`text-xs ${checked ? 'font-semibold text-emerald-700' : 'text-stone-600'}`}
                                    onClick={() => toggleTag(prodotto.id, tag)}
                                  >
                                    {TAG_LABELS[tag] ?? tag}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        )}

                        {/* Collapsed summary of selected tags */}
                        {!expanded && selectedInGroup.length > 0 && (
                          <div className="px-3 pb-2.5 flex flex-wrap gap-1">
                            {selectedInGroup.map(t => (
                              <span key={t} className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-emerald-100 text-emerald-700">
                                {TAG_LABELS[t] ?? t}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Bottom summary bar */}
      {prodottiFiltrati.length > 0 && (
        <div className="mt-6 flex items-center justify-between text-xs text-stone-400">
          <span>{prodottiFiltrati.length} prodotti</span>
          <span>{prodottiFiltrati.reduce((acc, p) => acc + (localTags[p.id]?.length ?? 0), 0)} tag totali assegnati</span>
        </div>
      )}
    </div>
  );
}
