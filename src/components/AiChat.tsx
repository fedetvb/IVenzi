import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, MessageSquare, User, Bot, Calendar, Users, TrendingUp, Scissors, BarChart2, ChevronRight, RotateCcw, Send, Loader2, HelpCircle, CheckCircle2 } from 'lucide-react';
import { executeTool } from '../lib/geminiTools';
import { parseQuery, formatToolResult } from '../lib/chatParser';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import AppuntamentoModal from './AppuntamentoModal';

interface Parrucchiere {
  id: string;
  nome: string;
}

interface SlotMeta {
  data: string;
  parrucchiereId?: string;
  slots: string[];
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  table?: TableData;
  loading?: boolean;
  slotMeta?: SlotMeta;
  successAction?: boolean;
}

interface TableData {
  headers: string[];
  rows: string[][];
}

interface QuickQuestion {
  label: string;
  tool: string;
  args: Record<string, unknown>;
}

interface Category {
  id: string;
  label: string;
  icon: React.ReactNode;
  questions: QuickQuestion[];
}

function fmt(n: number) {
  return n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

// ─── Format functions per domande rapide ─────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatQuick(tool: string, parsed: any): { text: string; table?: TableData } {
  return formatToolResult(tool, parsed);
}

const CATEGORIES: Category[] = [
  {
    id: 'agenda',
    label: 'Agenda',
    icon: <Calendar size={15} />,
    questions: [
      { label: 'Appuntamenti di oggi', tool: 'get_appuntamenti_oggi', args: {} },
      { label: 'Appuntamenti questa settimana', tool: 'get_appuntamenti_settimana', args: {} },
      { label: 'Slot liberi oggi', tool: 'get_slot_liberi', args: {} },
    ],
  },
  {
    id: 'clienti',
    label: 'Clienti',
    icon: <Users size={15} />,
    questions: [
      { label: 'Clienti assenti da 30 giorni', tool: 'get_clienti_assenti', args: { giorni: 30 } },
      { label: 'Clienti assenti da 60 giorni', tool: 'get_clienti_assenti', args: { giorni: 60 } },
      { label: 'Clienti assenti da 90 giorni', tool: 'get_clienti_assenti', args: { giorni: 90 } },
      { label: 'Clienti assenti da 120 giorni', tool: 'get_clienti_assenti', args: { giorni: 120 } },
    ],
  },
  {
    id: 'incassi',
    label: 'Incassi',
    icon: <TrendingUp size={15} />,
    questions: [
      { label: 'Incasso di oggi', tool: 'get_statistiche_incassi', args: { periodo: 'oggi' } },
      { label: 'Incasso questa settimana', tool: 'get_statistiche_incassi', args: { periodo: 'settimana' } },
      { label: 'Incasso questo mese', tool: 'get_statistiche_incassi', args: { periodo: 'mese' } },
      { label: "Incasso quest'anno", tool: 'get_statistiche_incassi', args: { periodo: 'anno' } },
    ],
  },
  {
    id: 'servizi',
    label: 'Servizi',
    icon: <Scissors size={15} />,
    questions: [
      { label: 'Servizi piu eseguiti questo mese', tool: 'get_statistiche_servizi', args: { periodo: 'mese' } },
      { label: "Servizi piu eseguiti quest'anno", tool: 'get_statistiche_servizi', args: { periodo: 'anno' } },
    ],
  },
  {
    id: 'parrucchieri',
    label: 'Parrucchieri',
    icon: <BarChart2 size={15} />,
    questions: [
      { label: 'Statistiche parrucchieri questo mese', tool: 'get_statistiche_parrucchieri', args: { periodo: 'mese' } },
      { label: "Statistiche parrucchieri quest'anno", tool: 'get_statistiche_parrucchieri', args: { periodo: 'anno' } },
    ],
  },
];

const SUGGESTIONS = [
  'Quanti appuntamenti ho domani?',
  'Incasso di questo mese',
  'Clienti assenti da 90 giorni',
  'Servizi piu richiesti',
  'Cerca Mario Rossi',
  'Slot liberi oggi',
];

export default function AiChat() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Ciao! Scrivi una domanda in italiano oppure scegli una categoria qui sotto.',
    },
  ]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [awaitingGiorni, setAwaitingGiorni] = useState(false);
  const [awaitingParrucchiere, setAwaitingParrucchiere] = useState<{ data: string } | null>(null);
  const [parrucchieri, setParrucchieri] = useState<Parrucchiere[]>([]);
  const [appModal, setAppModal] = useState<{ data: string; ora: string; parrucchiereId?: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    supabase
      .from('parrucchieri')
      .select('id, nome')
      .eq('attivo', true)
      .order('nome')
      .then(({ data }) => { if (data) setParrucchieri(data as Parrucchiere[]); });
  }, []);

  useEffect(() => {
    if (open) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [open, messages]);

  async function runTool(tool: string, args: Record<string, unknown>, userLabel: string) {
    if (loading) return;
    setLoading(true);
    setActiveCategory(null);

    setMessages(prev => [
      ...prev,
      { role: 'user', content: userLabel },
      { role: 'assistant', content: '', loading: true },
    ]);

    try {
      // Slot liberi: inietta data di oggi se mancante
      if (tool === 'get_slot_liberi' && !args.data) {
        const today = new Date();
        args = { ...args, data: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}` };
      }

      const raw = await executeTool(tool, args, user?.id);
      const parsed = JSON.parse(raw);
      const { text, table } = formatQuick(tool, parsed);

      // Slot liberi: prepara metadati per bottoni cliccabili
      let slotMeta: SlotMeta | undefined;
      if (tool === 'get_slot_liberi' && parsed.slot_liberi?.length > 0) {
        slotMeta = {
          data: parsed.data as string,
          parrucchiereId: args.parrucchiere_id as string | undefined,
          slots: parsed.slot_liberi as string[],
        };
      }

      setMessages(prev => {
        const copy = [...prev];
        copy[copy.length - 1] = { role: 'assistant', content: text, table, slotMeta };
        return copy;
      });

      // Dopo slot liberi senza filtro parrucchiere, proponi la scelta
      if (tool === 'get_slot_liberi' && !args.parrucchiere_id && parrucchieri.length > 0) {
        setAwaitingParrucchiere({ data: args.data as string });
      }

      // Appuntamento creato con successo
      if (tool === 'crea_appuntamento' && parsed.successo) {
        setMessages(prev => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: 'assistant', content: parsed.messaggio, successAction: true };
          return copy;
        });
      }
    } catch (err) {
      setMessages(prev => {
        const copy = [...prev];
        copy[copy.length - 1] = { role: 'assistant', content: `Errore nel recupero dati: ${String(err)}` };
        return copy;
      });
    } finally {
      setLoading(false);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    setShowSuggestions(false);

    // Se stiamo aspettando un numero di giorni dall'utente
    if (awaitingGiorni) {
      const num = parseInt(text.replace(/[^\d]/g, ''), 10);
      if (!isNaN(num) && num > 0) {
        setAwaitingGiorni(false);
        await runTool('get_clienti_assenti', { giorni: num }, `Clienti assenti da ${num} giorni`);
      } else {
        setMessages(prev => [
          ...prev,
          { role: 'user', content: text },
          { role: 'assistant', content: 'Inserisci un numero valido di giorni (es. 45).' },
        ]);
      }
      return;
    }

    const intent = parseQuery(text);

    // Caso speciale: utente chiede clienti assenti senza specificare i giorni
    if (!intent && /assent|non vengo|non vengono|persi|mancant/i.test(text) && !/\d/.test(text)) {
      setAwaitingGiorni(true);
      setMessages(prev => [
        ...prev,
        { role: 'user', content: text },
        {
          role: 'assistant',
          content: 'Da quanti giorni? Scrivi il numero (es. 45) oppure scegli:',
          table: undefined,
        },
      ]);
      return;
    }

    if (!intent) {
      setMessages(prev => [
        ...prev,
        { role: 'user', content: text },
        {
          role: 'assistant',
          content: `Non ho capito la richiesta. Prova a scrivere qualcosa come:\n• "appuntamenti di domani"\n• "incasso di questo mese"\n• "clienti assenti da 60 giorni"\n• "cerca Maria Rossi"\n• "servizi piu eseguiti"`,
        },
      ]);
      return;
    }

    await runTool(intent.tool, intent.args, text);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function resetChat() {
    setMessages([{ role: 'assistant', content: 'Ciao! Scrivi una domanda in italiano oppure scegli una categoria qui sotto.' }]);
    setActiveCategory(null);
    setInput('');
    setShowSuggestions(false);
    setAwaitingGiorni(false);
    setAwaitingParrucchiere(null);
    setAppModal(null);
  }

  return (
    <>
      {appModal && createPortal(
        <AppuntamentoModal
          dataIniziale={new Date(`${appModal.data}T${appModal.ora}:00`)}
          parrucchiereId={appModal.parrucchiereId}
          onClose={() => setAppModal(null)}
          onSaved={() => {
            const savedData = appModal.data;
            const savedOra = appModal.ora;
            setAppModal(null);
            setMessages(prev => [
              ...prev,
              {
                role: 'assistant',
                content: `Appuntamento fissato per il ${new Date(savedData + 'T12:00:00').toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })} alle ${savedOra}.`,
                successAction: true,
              },
            ]);
          }}
        />,
        document.body
      )}
      {/* Floating button */}
      <button
        onClick={() => setOpen(true)}
        className={`fixed bottom-6 right-6 z-50 w-14 h-14 bg-amber-500 hover:bg-amber-600 text-white rounded-full shadow-xl flex items-center justify-center transition-all duration-200 hover:scale-110 ${open ? 'opacity-0 pointer-events-none scale-90' : 'opacity-100 scale-100'}`}
        title="Consulta dati salone"
      >
        <MessageSquare size={22} />
      </button>

      {/* Chat panel */}
      <div
        className={`fixed bottom-6 right-6 z-50 w-[440px] max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-2xl flex flex-col transition-all duration-300 origin-bottom-right ${
          open ? 'opacity-100 scale-100' : 'opacity-0 scale-90 pointer-events-none'
        }`}
        style={{ height: '640px', maxHeight: 'calc(100vh - 3rem)' }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 bg-amber-500 rounded-t-2xl flex-shrink-0">
          <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
            <MessageSquare size={16} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white">Assistente Salone</p>
            <p className="text-xs text-amber-100">Fai domande sui tuoi dati</p>
          </div>
          <button onClick={resetChat} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors text-white" title="Nuova conversazione">
            <RotateCcw size={14} />
          </button>
          <button onClick={() => setOpen(false)} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors text-white">
            <ChevronDown size={16} />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${msg.role === 'user' ? 'bg-stone-800' : 'bg-amber-100'}`}>
                {msg.role === 'user' ? <User size={13} className="text-white" /> : <Bot size={13} className="text-amber-600" />}
              </div>
              <div className={`max-w-[90%] flex flex-col gap-1.5 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${msg.role === 'user' ? 'bg-stone-900 text-white rounded-tr-sm' : 'bg-stone-100 text-stone-800 rounded-tl-sm'}`}>
                  {msg.loading ? (
                    <div className="flex items-center gap-1.5 py-0.5">
                      <div className="w-1.5 h-1.5 bg-stone-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-1.5 h-1.5 bg-stone-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-1.5 h-1.5 bg-stone-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  )}
                </div>
                {msg.table && (
                  <div className="w-full overflow-x-auto rounded-xl border border-stone-200 bg-white shadow-sm">
                    <table className="min-w-full text-xs">
                      <thead>
                        <tr className="bg-amber-50 border-b border-stone-200">
                          {msg.table.headers.map((h, hi) => (
                            <th key={hi} className="px-3 py-2 text-left font-semibold text-stone-700 whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {msg.table.rows.map((row, ri) => (
                          <tr key={ri} className={ri % 2 === 0 ? 'bg-white' : 'bg-stone-50'}>
                            {row.map((cell, ci) => (
                              <td key={ci} className="px-3 py-2 text-stone-700 whitespace-nowrap">{cell}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {msg.slotMeta && (
                  <div className="w-full mt-1">
                    <p className="text-[10px] text-stone-400 font-medium mb-1.5 uppercase tracking-wide">Tocca un orario per prenotare:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {msg.slotMeta.slots.map(ora => (
                        <button
                          key={ora}
                          onClick={() => setAppModal({
                            data: msg.slotMeta!.data,
                            ora,
                            parrucchiereId: msg.slotMeta!.parrucchiereId,
                          })}
                          className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold transition-colors shadow-sm"
                        >
                          {ora}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {msg.successAction && (
                  <div className="flex items-center gap-1.5 mt-1 text-emerald-600 text-xs font-semibold">
                    <CheckCircle2 size={14} />
                    Appuntamento salvato
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick giorni picker */}
        {awaitingGiorni && (
          <div className="mx-4 mb-1 flex flex-wrap gap-2 flex-shrink-0">
            {[15, 30, 45, 60, 90, 120, 180].map(g => (
              <button
                key={g}
                onClick={() => {
                  setAwaitingGiorni(false);
                  runTool('get_clienti_assenti', { giorni: g }, `Clienti assenti da ${g} giorni`);
                }}
                className="px-3 py-1.5 rounded-full bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 text-xs font-semibold transition-colors"
              >
                {g} giorni
              </button>
            ))}
          </div>
        )}

        {/* Parrucchiere picker per slot liberi */}
        {awaitingParrucchiere && parrucchieri.length > 0 && (
          <div className="mx-4 mb-1 flex-shrink-0">
            <p className="text-[10px] text-stone-400 font-medium mb-1.5 uppercase tracking-wide">Filtra per parrucchiere:</p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setAwaitingParrucchiere(null)}
                className="px-3 py-1.5 rounded-full bg-stone-100 hover:bg-stone-200 border border-stone-200 text-stone-600 text-xs font-semibold transition-colors"
              >
                Tutti
              </button>
              {parrucchieri.map(p => (
                <button
                  key={p.id}
                  onClick={() => {
                    const d = awaitingParrucchiere.data;
                    setAwaitingParrucchiere(null);
                    runTool('get_slot_liberi', { data: d, parrucchiere_id: p.id }, `Slot liberi di ${p.nome}`);
                  }}
                  className="px-3 py-1.5 rounded-full bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 text-xs font-semibold transition-colors"
                >
                  {p.nome}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Suggestions dropdown */}
        {showSuggestions && (
          <div className="mx-4 mb-1 bg-white border border-stone-200 rounded-xl shadow-lg overflow-hidden flex-shrink-0">
            <div className="px-3 py-1.5 border-b border-stone-100">
              <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide">Esempi di domande</p>
            </div>
            {SUGGESTIONS.map(s => (
              <button
                key={s}
                onMouseDown={e => { e.preventDefault(); setInput(s); setShowSuggestions(false); setTimeout(() => inputRef.current?.focus(), 50); }}
                className="w-full text-left px-3 py-2 text-xs text-stone-700 hover:bg-amber-50 hover:text-amber-700 transition-colors border-b border-stone-50 last:border-0"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="px-4 pb-3 pt-2 flex-shrink-0 border-t border-stone-100">
          <div className="flex items-end gap-2 bg-stone-100 rounded-xl px-3 py-2">
            <button
              onClick={() => setShowSuggestions(v => !v)}
              className={`p-1 rounded-lg transition-colors flex-shrink-0 mb-0.5 ${showSuggestions ? 'text-amber-600 bg-amber-100' : 'text-stone-400 hover:text-stone-600'}`}
              title="Esempi di domande"
            >
              <HelpCircle size={15} />
            </button>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => setShowSuggestions(false)}
              placeholder="Es: quanti appuntamenti ho domani?"
              rows={1}
              disabled={loading}
              className="flex-1 bg-transparent text-sm text-stone-800 placeholder:text-stone-400 resize-none outline-none min-h-[24px] max-h-[80px] leading-6 disabled:opacity-50"
              onInput={e => {
                const t = e.target as HTMLTextAreaElement;
                t.style.height = 'auto';
                t.style.height = `${Math.min(t.scrollHeight, 80)}px`;
              }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || loading}
              className="w-8 h-8 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg flex items-center justify-center flex-shrink-0 transition-colors"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            </button>
          </div>
          <p className="text-center text-[10px] text-stone-300 mt-1">Invio con Invio &bull; A capo con Shift+Invio</p>
        </div>

        {/* Category picker */}
        <div className="flex-shrink-0 border-t border-stone-100 px-4 pb-3 pt-2 space-y-2">
          {activeCategory === null ? (
            <>
              <p className="text-[11px] font-semibold text-stone-400 uppercase tracking-wide">Oppure scegli categoria</p>
              <div className="grid grid-cols-5 gap-1.5">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    disabled={loading}
                    className="flex flex-col items-center gap-1 px-1 py-2 rounded-xl bg-stone-50 hover:bg-amber-50 hover:text-amber-700 border border-stone-200 hover:border-amber-300 text-stone-600 transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <span className="text-current">{cat.icon}</span>
                    <span className="text-[10px] font-medium leading-tight text-center">{cat.label}</span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <button onClick={() => setActiveCategory(null)} className="flex items-center gap-1 text-[11px] font-semibold text-amber-600 hover:text-amber-700 transition-colors">
                  <ChevronRight size={12} className="rotate-180" />
                  Categorie
                </button>
                <span className="text-[11px] text-stone-400">/</span>
                <span className="text-[11px] font-semibold text-stone-600">{CATEGORIES.find(c => c.id === activeCategory)?.label}</span>
              </div>
              <div className="space-y-1">
                {CATEGORIES.find(c => c.id === activeCategory)?.questions.map((q, qi) => (
                  <button
                    key={qi}
                    onClick={() => runTool(q.tool, q.args, q.label)}
                    disabled={loading}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-stone-50 hover:bg-amber-50 hover:text-amber-700 border border-stone-200 hover:border-amber-300 text-stone-700 text-xs font-medium transition-all duration-150 text-left disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <span>{q.label}</span>
                    <ChevronRight size={13} className="flex-shrink-0 text-stone-400" />
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

// keep fmt in scope to avoid unused-import warning
void fmt;
