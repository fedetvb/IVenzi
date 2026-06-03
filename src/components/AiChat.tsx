import { useState, useRef, useEffect } from 'react';
import { ChevronDown, MessageSquare, User, Bot, Calendar, Users, TrendingUp, Scissors, Package, ChevronRight, RotateCcw } from 'lucide-react';
import { executeTool } from '../lib/geminiTools';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  table?: TableData;
  loading?: boolean;
}

interface TableData {
  headers: string[];
  rows: string[][];
}

interface QuickQuestion {
  label: string;
  tool: string;
  args: Record<string, unknown>;
  format: (data: unknown) => { text: string; table?: TableData };
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

const CATEGORIES: Category[] = [
  {
    id: 'agenda',
    label: 'Agenda',
    icon: <Calendar size={15} />,
    questions: [
      {
        label: 'Appuntamenti di oggi',
        tool: 'get_appuntamenti_oggi',
        args: {},
        format: (d) => {
          const data = d as { totale: number; appuntamenti: { ora: string; cliente: string; parrucchiere: string | null; durata_minuti: number; stato: string }[] };
          if (!data.appuntamenti?.length) return { text: 'Nessun appuntamento oggi.' };
          return {
            text: `${data.totale} appuntament${data.totale === 1 ? 'o' : 'i'} oggi:`,
            table: {
              headers: ['Ora', 'Cliente', 'Parrucchiere', 'Durata', 'Stato'],
              rows: data.appuntamenti.map(a => [
                a.ora,
                a.cliente,
                a.parrucchiere || '—',
                `${a.durata_minuti} min`,
                a.stato,
              ]),
            },
          };
        },
      },
      {
        label: 'Appuntamenti questa settimana',
        tool: 'get_appuntamenti_settimana',
        args: {},
        format: (d) => {
          const data = d as { totale: number; per_giorno: Record<string, { ora: string; cliente: string; parrucchiere: string | null; stato: string }[]> };
          if (!data.totale) return { text: 'Nessun appuntamento questa settimana.' };
          const rows: string[][] = [];
          Object.entries(data.per_giorno).forEach(([giorno, apps]) => {
            apps.forEach(a => rows.push([giorno, a.ora, a.cliente, a.parrucchiere || '—', a.stato]));
          });
          return {
            text: `${data.totale} appuntament${data.totale === 1 ? 'o' : 'i'} questa settimana:`,
            table: { headers: ['Giorno', 'Ora', 'Cliente', 'Parrucchiere', 'Stato'], rows },
          };
        },
      },
      {
        label: 'Slot liberi oggi',
        tool: 'get_slot_liberi',
        args: { data: new Date().toISOString().split('T')[0] },
        format: (d) => {
          const data = d as { slot_liberi: string[]; totale_slot_liberi: number };
          if (!data.totale_slot_liberi) return { text: 'Nessuno slot libero oggi.' };
          return { text: `${data.totale_slot_liberi} slot liberi oggi: ${data.slot_liberi.join(', ')}` };
        },
      },
    ],
  },
  {
    id: 'clienti',
    label: 'Clienti',
    icon: <Users size={15} />,
    questions: [
      {
        label: 'Clienti assenti da 60 giorni',
        tool: 'get_clienti_assenti',
        args: { giorni: 60 },
        format: (d) => {
          const data = d as { totale_assenti: number; clienti: { nome: string; telefono: string | null; ultima_visita: string; giorni_assenza: number | null }[] };
          if (!data.totale_assenti) return { text: 'Nessun cliente assente da 60+ giorni.' };
          return {
            text: `${data.totale_assenti} clienti assenti da oltre 60 giorni:`,
            table: {
              headers: ['Cliente', 'Telefono', 'Ultima visita', 'Giorni assenza'],
              rows: data.clienti.map(c => [c.nome, c.telefono || '—', c.ultima_visita, c.giorni_assenza ? `${c.giorni_assenza} gg` : 'Mai venuto']),
            },
          };
        },
      },
      {
        label: 'Clienti assenti da 90 giorni',
        tool: 'get_clienti_assenti',
        args: { giorni: 90 },
        format: (d) => {
          const data = d as { totale_assenti: number; clienti: { nome: string; telefono: string | null; ultima_visita: string; giorni_assenza: number | null }[] };
          if (!data.totale_assenti) return { text: 'Nessun cliente assente da 90+ giorni.' };
          return {
            text: `${data.totale_assenti} clienti assenti da oltre 90 giorni:`,
            table: {
              headers: ['Cliente', 'Telefono', 'Ultima visita', 'Giorni assenza'],
              rows: data.clienti.map(c => [c.nome, c.telefono || '—', c.ultima_visita, c.giorni_assenza ? `${c.giorni_assenza} gg` : 'Mai venuto']),
            },
          };
        },
      },
    ],
  },
  {
    id: 'incassi',
    label: 'Incassi',
    icon: <TrendingUp size={15} />,
    questions: [
      {
        label: 'Incasso di oggi',
        tool: 'get_statistiche_incassi',
        args: { periodo: 'oggi' },
        format: (d) => {
          const data = d as { totale_incassato: string; numero_fiches_convalidate: number; media_fiche: string };
          return { text: `Incasso oggi: ${fmt(parseFloat(data.totale_incassato))}\n${data.numero_fiches_convalidate} fiches convalidate — Media: ${fmt(parseFloat(data.media_fiche))}` };
        },
      },
      {
        label: 'Incasso questa settimana',
        tool: 'get_statistiche_incassi',
        args: { periodo: 'settimana' },
        format: (d) => {
          const data = d as { totale_incassato: string; numero_fiches_convalidate: number; media_fiche: string };
          return { text: `Incasso questa settimana: ${fmt(parseFloat(data.totale_incassato))}\n${data.numero_fiches_convalidate} fiches convalidate — Media: ${fmt(parseFloat(data.media_fiche))}` };
        },
      },
      {
        label: 'Incasso questo mese',
        tool: 'get_statistiche_incassi',
        args: { periodo: 'mese' },
        format: (d) => {
          const data = d as { totale_incassato: string; numero_fiches_convalidate: number; media_fiche: string };
          return { text: `Incasso questo mese: ${fmt(parseFloat(data.totale_incassato))}\n${data.numero_fiches_convalidate} fiches convalidate — Media: ${fmt(parseFloat(data.media_fiche))}` };
        },
      },
      {
        label: "Incasso quest'anno",
        tool: 'get_statistiche_incassi',
        args: { periodo: 'anno' },
        format: (d) => {
          const data = d as { totale_incassato: string; numero_fiches_convalidate: number; media_fiche: string };
          return { text: `Incasso quest'anno: ${fmt(parseFloat(data.totale_incassato))}\n${data.numero_fiches_convalidate} fiches convalidate — Media: ${fmt(parseFloat(data.media_fiche))}` };
        },
      },
    ],
  },
  {
    id: 'servizi',
    label: 'Servizi',
    icon: <Scissors size={15} />,
    questions: [
      {
        label: 'Servizi piu eseguiti questo mese',
        tool: 'get_statistiche_servizi',
        args: { periodo: 'mese' },
        format: (d) => {
          const data = d as { servizi_piu_eseguiti: { nome: string; quantita: number; totale_euro: string }[] };
          if (!data.servizi_piu_eseguiti?.length) return { text: 'Nessun servizio registrato questo mese.' };
          return {
            text: `Servizi piu eseguiti questo mese:`,
            table: {
              headers: ['Servizio', 'Quantita', 'Totale'],
              rows: data.servizi_piu_eseguiti.map(s => [s.nome, String(s.quantita), fmt(parseFloat(s.totale_euro))]),
            },
          };
        },
      },
      {
        label: "Servizi piu eseguiti quest'anno",
        tool: 'get_statistiche_servizi',
        args: { periodo: 'anno' },
        format: (d) => {
          const data = d as { servizi_piu_eseguiti: { nome: string; quantita: number; totale_euro: string }[] };
          if (!data.servizi_piu_eseguiti?.length) return { text: "Nessun servizio registrato quest'anno." };
          return {
            text: `Servizi piu eseguiti quest'anno:`,
            table: {
              headers: ['Servizio', 'Quantita', 'Totale'],
              rows: data.servizi_piu_eseguiti.map(s => [s.nome, String(s.quantita), fmt(parseFloat(s.totale_euro))]),
            },
          };
        },
      },
    ],
  },
  {
    id: 'parrucchieri',
    label: 'Parrucchieri',
    icon: <Package size={15} />,
    questions: [
      {
        label: 'Statistiche parrucchieri questo mese',
        tool: 'get_statistiche_parrucchieri',
        args: { periodo: 'mese' },
        format: (d) => {
          const data = d as { parrucchieri: { parrucchiere: string; appuntamenti: number; incasso_totale: string; media_appuntamento: string }[] };
          if (!data.parrucchieri?.length) return { text: 'Nessun dato parrucchieri questo mese.' };
          return {
            text: `Statistiche parrucchieri questo mese:`,
            table: {
              headers: ['Parrucchiere', 'Appuntamenti', 'Incasso', 'Media'],
              rows: data.parrucchieri.map(p => [p.parrucchiere, String(p.appuntamenti), fmt(parseFloat(p.incasso_totale)), fmt(parseFloat(p.media_appuntamento))]),
            },
          };
        },
      },
      {
        label: "Statistiche parrucchieri quest'anno",
        tool: 'get_statistiche_parrucchieri',
        args: { periodo: 'anno' },
        format: (d) => {
          const data = d as { parrucchieri: { parrucchiere: string; appuntamenti: number; incasso_totale: string; media_appuntamento: string }[] };
          if (!data.parrucchieri?.length) return { text: "Nessun dato parrucchieri quest'anno." };
          return {
            text: `Statistiche parrucchieri quest'anno:`,
            table: {
              headers: ['Parrucchiere', 'Appuntamenti', 'Incasso', 'Media'],
              rows: data.parrucchieri.map(p => [p.parrucchiere, String(p.appuntamenti), fmt(parseFloat(p.incasso_totale)), fmt(parseFloat(p.media_appuntamento))]),
            },
          };
        },
      },
    ],
  },
];

export default function AiChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Ciao! Seleziona una categoria e scegli una domanda per consultare i dati del salone.',
    },
  ]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [open, messages]);

  async function askQuestion(q: QuickQuestion) {
    if (loading) return;
    setLoading(true);
    setActiveCategory(null);

    const userMsg: Message = { role: 'user', content: q.label };
    setMessages(prev => [...prev, userMsg, { role: 'assistant', content: '', loading: true }]);

    try {
      const raw = await executeTool(q.tool, q.args);
      const parsed = JSON.parse(raw);

      if (parsed.errore) {
        setMessages(prev => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: 'assistant', content: `Errore: ${parsed.errore}` };
          return copy;
        });
        return;
      }

      const { text, table } = q.format(parsed);
      setMessages(prev => {
        const copy = [...prev];
        copy[copy.length - 1] = { role: 'assistant', content: text, table };
        return copy;
      });
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

  function resetChat() {
    setMessages([{ role: 'assistant', content: 'Ciao! Seleziona una categoria e scegli una domanda per consultare i dati del salone.' }]);
    setActiveCategory(null);
  }

  return (
    <>
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
        className={`fixed bottom-6 right-6 z-50 w-[420px] max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-2xl flex flex-col transition-all duration-300 origin-bottom-right ${
          open ? 'opacity-100 scale-100' : 'opacity-0 scale-90 pointer-events-none'
        }`}
        style={{ height: '600px', maxHeight: 'calc(100vh - 3rem)' }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 bg-amber-500 rounded-t-2xl flex-shrink-0">
          <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
            <MessageSquare size={16} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white">Consulta Dati Salone</p>
            <p className="text-xs text-amber-100">Domande rapide sul tuo gestionale</p>
          </div>
          <button
            onClick={resetChat}
            className="p-1.5 hover:bg-white/20 rounded-lg transition-colors text-white"
            title="Nuova conversazione"
          >
            <RotateCcw size={14} />
          </button>
          <button
            onClick={() => setOpen(false)}
            className="p-1.5 hover:bg-white/20 rounded-lg transition-colors text-white"
          >
            <ChevronDown size={16} />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                  msg.role === 'user' ? 'bg-stone-800' : 'bg-amber-100'
                }`}
              >
                {msg.role === 'user'
                  ? <User size={13} className="text-white" />
                  : <Bot size={13} className="text-amber-600" />
                }
              </div>
              <div className={`max-w-[90%] ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                <div
                  className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-stone-900 text-white rounded-tr-sm'
                      : 'bg-stone-100 text-stone-800 rounded-tl-sm'
                  }`}
                >
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
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Category picker / Questions */}
        <div className="flex-shrink-0 border-t border-stone-100 px-4 py-3 space-y-2">
          {activeCategory === null ? (
            <>
              <p className="text-[11px] font-semibold text-stone-400 uppercase tracking-wide">Scegli categoria</p>
              <div className="grid grid-cols-3 gap-2">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    disabled={loading}
                    className="flex flex-col items-center gap-1.5 px-2 py-2.5 rounded-xl bg-stone-50 hover:bg-amber-50 hover:text-amber-700 border border-stone-200 hover:border-amber-300 text-stone-600 transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <span className="text-current">{cat.icon}</span>
                    <span className="text-[11px] font-medium leading-tight text-center">{cat.label}</span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveCategory(null)}
                  className="flex items-center gap-1 text-[11px] font-semibold text-amber-600 hover:text-amber-700 transition-colors"
                >
                  <ChevronRight size={12} className="rotate-180" />
                  Categorie
                </button>
                <span className="text-[11px] text-stone-400">/</span>
                <span className="text-[11px] font-semibold text-stone-600">
                  {CATEGORIES.find(c => c.id === activeCategory)?.label}
                </span>
              </div>
              <div className="space-y-1.5">
                {CATEGORIES.find(c => c.id === activeCategory)?.questions.map((q, qi) => (
                  <button
                    key={qi}
                    onClick={() => askQuestion(q)}
                    disabled={loading}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-stone-50 hover:bg-amber-50 hover:text-amber-700 border border-stone-200 hover:border-amber-300 text-stone-700 text-xs font-medium transition-all duration-150 text-left disabled:opacity-40 disabled:cursor-not-allowed"
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
