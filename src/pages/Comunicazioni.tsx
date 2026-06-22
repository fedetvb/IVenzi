import { useEffect, useState, useMemo, useRef } from 'react';
import { Search, Send, CheckSquare, Square, MessageSquare, Users, Phone, List, X, BookOpen, ChevronDown, Save, Check, MapPin } from 'lucide-react';
import { dbSelect, getImpostazione, setImpostazione } from '../lib/localDb';
import { supabase } from '../lib/supabase';
import { apriWhatsApp, apriWhatsAppWeb, type WaMode } from '../lib/waUtils';

interface Cliente {
  id: string;
  nome: string;
  cognome: string;
  telefono: string;
}

interface TemplateComunicazione {
  id: string;
  nome: string;
  testo: string;
  is_default: boolean;
  ordine: number;
}

function normalizePhone(tel: string): string {
  const cleaned = tel.replace(/\s+/g, '').replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+')) return cleaned.replace('+', '');
  if (cleaned.startsWith('00')) return cleaned.slice(2);
  return `39${cleaned}`;
}

export default function Comunicazioni() {
  const [clienti, setClienti] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [messaggio, setMessaggio] = useState('');
  const [showQueue, setShowQueue] = useState(false);
  const [queueIndex, setQueueIndex] = useState(0);
  const [templates, setTemplates] = useState<TemplateComunicazione[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [lastAppliedTemplateId, setLastAppliedTemplateId] = useState<string | null>(null);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [savedTemplate, setSavedTemplate] = useState(false);
  const [waMode, setWaMode] = useState<WaMode>('desktop');
  const [includiPosizione, setIncludiPosizione] = useState(false);
  const templatesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.all([
      dbSelect({
        table: 'clienti',
        columns: 'id, nome, cognome, telefono',
        filters: [
          { col: 'telefono', op: 'not_null' },
          { col: 'telefono', op: 'neq', val: '' }
        ],
        orderBy: [{ col: 'cognome', asc: true }],
      }),
      dbSelect({
        table: 'template_messaggi_comunicazioni',
        columns: 'id, nome, testo, is_default, ordine',
        orderBy: [{ col: 'ordine', asc: true }],
      }),
    ]).then(([{ data: c }, { data: t }]) => {
      setClienti((c || []) as Cliente[]);
      setTemplates((t || []) as TemplateComunicazione[]);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    async function loadWaSettings() {
      const [mod, pos] = await Promise.all([
        getImpostazione('wa_modalita'),
        getImpostazione('wa_pos_comunicazioni'),
      ]);
      setWaMode(mod === 'web' ? 'web' : 'desktop');
      if (pos !== null) setIncludiPosizione(pos === 'true');
    }
    loadWaSettings();
  }, []);

  useEffect(() => {
    if (!showTemplates) return;
    function handleClick(e: MouseEvent) {
      if (templatesRef.current && !templatesRef.current.contains(e.target as Node)) {
        setShowTemplates(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showTemplates]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return clienti;
    return clienti.filter(c =>
      `${c.nome} ${c.cognome}`.toLowerCase().includes(q) ||
      c.telefono.includes(q)
    );
  }, [clienti, search]);

  const targets = useMemo(
    () => filtered.filter(c => selected.has(c.id)),
    [filtered, selected]
  );

  function toggleOne(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (filtered.length > 0 && filtered.every(c => selected.has(c.id))) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map(c => c.id)));
    }
  }

  function sendAll() {
    for (const c of targets) {
      if (waMode === 'web') apriWhatsAppWeb(c.telefono, messaggio);
      else apriWhatsApp(c.telefono, messaggio);
    }
  }

  function startQueue() {
    setQueueIndex(0);
    setShowQueue(true);
  }

  function openCurrentAndAdvance() {
    const c = targets[queueIndex];
    if (waMode === 'web') apriWhatsAppWeb(c.telefono, messaggio);
    else apriWhatsApp(c.telefono, messaggio);
    if (queueIndex < targets.length - 1) {
      setQueueIndex(prev => prev + 1);
    } else {
      setShowQueue(false);
    }
  }

  async function salvaTemplate() {
    if (!lastAppliedTemplateId) return;
    setSavingTemplate(true);
    await supabase.from('template_messaggi_comunicazioni').update({ testo: messaggio }).eq('id', lastAppliedTemplateId);
    setTemplates(prev => prev.map(t => t.id === lastAppliedTemplateId ? { ...t, testo: messaggio } : t));
    setSavingTemplate(false);
    setSavedTemplate(true);
    setTimeout(() => setSavedTemplate(false), 2000);
  }

  function applyTemplate(t: TemplateComunicazione) {
    setShowTemplates(false);
    setLastAppliedTemplateId(t.id);
    setSavedTemplate(false);

    const selectedClients = clienti.filter(c => selected.has(c.id));

    if (selectedClients.length === 0) {
      // nessuna selezionata: carica il template con {nome} letterale
      setMessaggio(t.testo);
      return;
    }

    if (selectedClients.length === 1) {
      // una sola: sostituisce {nome} e carica nel textarea
      setMessaggio(t.testo.replace(/\{nome\}/g, selectedClients[0].nome));
      return;
    }

    // più clienti: apre WhatsApp per ognuna con nome personalizzato
    for (const c of selectedClients) {
      if (waMode === 'web') apriWhatsAppWeb(c.telefono, t.testo.replace(/\{nome\}/g, c.nome));
      else apriWhatsApp(c.telefono, t.testo.replace(/\{nome\}/g, c.nome));
    }
  }

  const allFilteredSelected =
    filtered.length > 0 && filtered.every(c => selected.has(c.id));
  const someSelected = selected.size > 0;
  const canSend = someSelected && messaggio.trim().length > 0;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-stone-800">Comunicazioni</h2>
        <p className="text-sm text-stone-500 mt-1">
          Invia messaggi promozionali via WhatsApp alle tue clienti
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
        {/* Left: client list */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-stone-100 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Users size={16} className="text-stone-400" />
              <span className="text-sm font-semibold text-stone-700">
                Clienti con numero di telefono
              </span>
              <span className="text-xs bg-stone-100 text-stone-500 rounded-full px-2 py-0.5 font-medium">
                {clienti.length}
              </span>
            </div>
          </div>

          <div className="px-4 py-3 border-b border-stone-100 flex items-center gap-3">
            <button
              onClick={toggleAll}
              className="flex items-center gap-1.5 text-xs text-stone-500 hover:text-amber-600 transition-colors flex-shrink-0"
            >
              {allFilteredSelected ? (
                <CheckSquare size={16} className="text-amber-500" />
              ) : (
                <Square size={16} />
              )}
              <span>{allFilteredSelected ? 'Deseleziona tutte' : 'Seleziona tutte'}</span>
            </button>
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                placeholder="Cerca per nome o numero..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-400"
              />
            </div>
          </div>

          <div className="divide-y divide-stone-50 max-h-[420px] overflow-y-auto">
            {loading ? (
              <div className="py-12 text-center text-sm text-stone-400">Caricamento...</div>
            ) : filtered.length === 0 ? (
              <div className="py-12 text-center text-sm text-stone-400">Nessuna cliente trovata</div>
            ) : (
              filtered.map(c => {
                const isSelected = selected.has(c.id);
                return (
                  <button
                    key={c.id}
                    onClick={() => toggleOne(c.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                      isSelected ? 'bg-amber-50' : 'hover:bg-stone-50'
                    }`}
                  >
                    {isSelected ? (
                      <CheckSquare size={16} className="text-amber-500 flex-shrink-0" />
                    ) : (
                      <Square size={16} className="text-stone-300 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${isSelected ? 'text-amber-800' : 'text-stone-700'}`}>
                        {c.nome} {c.cognome}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-stone-400 flex-shrink-0">
                      <Phone size={11} />
                      <span>{c.telefono}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {someSelected && (
            <div className="px-4 py-2.5 border-t border-stone-100 bg-amber-50 text-xs text-amber-700 font-medium">
              {selected.size} {selected.size === 1 ? 'cliente selezionata' : 'clienti selezionate'}
            </div>
          )}
        </div>

        {/* Right: message + actions */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <MessageSquare size={16} className="text-stone-400" />
                <h3 className="text-sm font-semibold text-stone-700">Messaggio</h3>
              </div>

              {/* Bottone messaggi predefiniti */}
              {templates.length > 0 && (
                <div className="relative" ref={templatesRef}>
                  <button
                    type="button"
                    onClick={() => setShowTemplates(s => !s)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors"
                  >
                    <BookOpen size={12} />
                    Predefiniti
                    <ChevronDown size={11} className={`transition-transform ${showTemplates ? 'rotate-180' : ''}`} />
                  </button>

                  {showTemplates && (
                    <div className="absolute right-0 top-full mt-1.5 w-64 bg-white border border-stone-200 rounded-xl shadow-xl z-20 overflow-hidden">
                      <div className="px-3 py-2 border-b border-stone-100">
                        <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Scegli occasione</p>
                      </div>
                      {templates.map(t => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => applyTemplate(t)}
                          className="w-full text-left px-4 py-3 hover:bg-stone-50 transition-colors border-b border-stone-50 last:border-0 group"
                        >
                          <p className="text-sm font-semibold text-stone-700 group-hover:text-amber-700 transition-colors">{t.nome}</p>
                          <p className="text-xs text-stone-400 mt-0.5 line-clamp-2 leading-relaxed">{t.testo}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <textarea
              value={messaggio}
              onChange={e => { setMessaggio(e.target.value); setSavedTemplate(false); }}
              placeholder="Scrivi qui il tuo messaggio promozionale o scegli un predefinito..."
              rows={7}
              className="w-full text-sm border border-stone-200 rounded-xl px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-400 text-stone-700 placeholder-stone-300"
            />
            <div className="flex items-center justify-between">
              {selected.size > 1 ? (
                <p className="text-xs text-amber-600 font-medium">
                  Con {selected.size} clienti selezionate, scegliendo un predefinito si apriranno {selected.size} chat separate con il nome personalizzato.
                </p>
              ) : (
                <span />
              )}
              <span className="text-xs text-stone-400 ml-auto">{messaggio.length} caratteri</span>
            </div>

            {lastAppliedTemplateId && messaggio.trim() && (
              <button
                onClick={salvaTemplate}
                disabled={savingTemplate || messaggio === (templates.find(t => t.id === lastAppliedTemplateId)?.testo ?? '')}
                className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold transition-colors"
              >
                {savedTemplate ? <Check size={13} /> : <Save size={13} />}
                {savingTemplate ? 'Salvataggio...' : savedTemplate ? 'Salvato!' : `Salva come "${templates.find(t => t.id === lastAppliedTemplateId)?.nome ?? 'template'}"`}
              </button>
            )}

            {/* Flag posizione */}
            <button type="button"
              onClick={async () => {
                const next = !includiPosizione;
                setIncludiPosizione(next);
                await setImpostazione('wa_pos_comunicazioni', String(next));
              }}
              className={`flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl border transition-colors text-left ${
                includiPosizione
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                  : 'border-stone-200 bg-white text-stone-500 hover:border-stone-300'
              }`}>
              <MapPin size={14} className={includiPosizione ? 'text-emerald-500' : 'text-stone-400'} />
              <span className="text-xs font-medium flex-1">Condividi posizione</span>
              <div className={`w-8 h-4 rounded-full transition-colors flex items-center ${includiPosizione ? 'bg-emerald-500' : 'bg-stone-200'}`}>
                <div className={`w-3 h-3 rounded-full bg-white shadow transition-transform mx-0.5 ${includiPosizione ? 'translate-x-4' : 'translate-x-0'}`} />
              </div>
            </button>

            {/* Opzione 1: apri tutto in una volta */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Opzione 1 — Apri tutto in una volta</p>
              <button
                onClick={sendAll}
                disabled={!canSend}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#25D366] hover:bg-[#1ebe5d] disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors shadow-sm"
              >
                <WhatsAppIcon />
                <Send size={13} />
                Apri {someSelected ? selected.size : ''} chat in una volta
              </button>
              <p className="text-xs text-stone-400">Si aprono tutte le chat contemporaneamente. Premi Invia in ciascuna.</p>
            </div>

            <div className="border-t border-stone-100" />

            {/* Opzione 2: una per volta con pulsante */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Opzione 2 — Una per volta guidata</p>
              <button
                onClick={startQueue}
                disabled={!canSend}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors shadow-sm"
              >
                <List size={14} />
                Avvia invio guidato
              </button>
              <p className="text-xs text-stone-400">Si apre una chat alla volta. Un solo pulsante per passare alla successiva.</p>
            </div>

            {!someSelected && (
              <p className="text-xs text-stone-400 text-center pt-1">Seleziona almeno una cliente</p>
            )}
          </div>
        </div>
      </div>

      {/* Queue modal */}
      {showQueue && targets.length > 0 && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-stone-800 text-lg">Invio guidato</h3>
              <button
                onClick={() => setShowQueue(false)}
                className="text-stone-400 hover:text-stone-600 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Progress */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-stone-500">
                <span>{queueIndex + 1} di {targets.length}</span>
                <span>{Math.round(((queueIndex) / targets.length) * 100)}% completato</span>
              </div>
              <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#25D366] rounded-full transition-all duration-300"
                  style={{ width: `${(queueIndex / targets.length) * 100}%` }}
                />
              </div>
            </div>

            {/* Current client */}
            <div className="bg-stone-50 rounded-xl p-4 space-y-1">
              <p className="text-xs text-stone-400 font-medium uppercase tracking-wide">Prossima cliente</p>
              <p className="font-bold text-stone-800 text-lg">
                {targets[queueIndex].nome} {targets[queueIndex].cognome}
              </p>
              <div className="flex items-center gap-1.5 text-sm text-stone-500">
                <Phone size={13} />
                <span>{targets[queueIndex].telefono}</span>
              </div>
            </div>

            {/* Message preview */}
            <div className="bg-[#dcf8c6] rounded-xl px-4 py-3 text-sm text-stone-700 max-h-28 overflow-y-auto whitespace-pre-wrap">
              {messaggio}
            </div>

            <button
              onClick={openCurrentAndAdvance}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#25D366] hover:bg-[#1ebe5d] text-white font-bold text-sm transition-colors shadow-sm"
            >
              <WhatsAppIcon />
              {queueIndex < targets.length - 1
                ? `Apri chat e vai alla prossima`
                : `Apri ultima chat e termina`}
            </button>

            {/* Remaining list */}
            {targets.length > 1 && (
              <div className="space-y-1">
                <p className="text-xs text-stone-400 font-medium">Rimanenti</p>
                <div className="max-h-24 overflow-y-auto space-y-1">
                  {targets.slice(queueIndex + 1).map(c => (
                    <div key={c.id} className="flex items-center gap-2 text-xs text-stone-500 py-0.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-stone-300 flex-shrink-0" />
                      {c.nome} {c.cognome}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function WhatsAppIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  );
}
