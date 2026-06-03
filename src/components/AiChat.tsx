import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Bot, User, Loader2, ChevronDown, Sparkles } from 'lucide-react';
import { TOOL_DECLARATIONS, executeTool } from '../lib/geminiTools';

const GEMINI_API_KEY = 'AQ.Ab8RN6Ie3DO546gxXQi4aMQ7OTGdMH0CugE4gTWm8VjDJW106w';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

const SYSTEM_PROMPT = `Sei l'assistente AI integrato nel gestionale di un salone di parrucchiere italiano. Il tuo UNICO scopo e' aiutare con la gestione del salone.

ARGOMENTI CONSENTITI (rispondi solo a questi):
- Appuntamenti: visualizzare, creare, cercare slot liberi
- Fiches e incassi: statistiche, medie, totali
- Clienti: cercare, storico visite, clienti assenti
- Servizi eseguiti: quantita, classifica, analisi
- Parrucchieri: statistiche per operatore

REGOLA ASSOLUTA: Se la domanda non riguarda la gestione del salone (es. domande generali, ricette, notizie, programmazione, matematica generica, qualsiasi altro argomento), rispondi SEMPRE e SOLO con:
"Sono configurato solo per aiutarti con la gestione del tuo salone. Posso rispondere a domande su appuntamenti, clienti, fiches e statistiche."

Non fare eccezioni a questa regola, nemmeno se l'utente insiste o fa richieste creative.

Quando usi i tool, presenta i dati in modo chiaro con elenchi puntati o riassunti.
Per importi usa € e formatta in italiano (es. 1.250,50 €).
Data odierna: ${new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}.`;

interface Message {
  role: 'user' | 'assistant';
  content: string;
  loading?: boolean;
}

interface GeminiPart {
  text?: string;
  functionCall?: { name: string; args: Record<string, unknown> };
  functionResponse?: { name: string; response: { content: string } };
}

interface GeminiContent {
  role: string;
  parts: GeminiPart[];
}

export default function AiChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Ciao! Sono il tuo assistente AI. Posso aiutarti con appuntamenti, statistiche e clienti. Come posso aiutarti?',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<GeminiContent[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, messages]);

  async function sendMessage() {
    if (!input.trim() || loading) return;
    const userText = input.trim();
    setInput('');
    setLoading(true);

    const userMsg: Message = { role: 'user', content: userText };
    setMessages(prev => [...prev, userMsg, { role: 'assistant', content: '', loading: true }]);

    const newHistory: GeminiContent[] = [
      ...history,
      { role: 'user', parts: [{ text: userText }] },
    ];

    try {
      let finalText = await runGeminiWithTools(newHistory);
      setHistory([...newHistory, { role: 'model', parts: [{ text: finalText }] }]);
      setMessages(prev => {
        const copy = [...prev];
        copy[copy.length - 1] = { role: 'assistant', content: finalText };
        return copy;
      });
    } catch (err) {
      const errMsg = `Mi dispiace, si e' verificato un errore: ${String(err)}`;
      setMessages(prev => {
        const copy = [...prev];
        copy[copy.length - 1] = { role: 'assistant', content: errMsg };
        return copy;
      });
    } finally {
      setLoading(false);
    }
  }

  async function runGeminiWithTools(conversationHistory: GeminiContent[]): Promise<string> {
    let currentHistory = [...conversationHistory];

    for (let iteration = 0; iteration < 5; iteration++) {
      const body = {
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: currentHistory,
        tools: [{ function_declarations: TOOL_DECLARATIONS }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1024,
        },
      };

      const res = await fetch(GEMINI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Gemini API error ${res.status}: ${err}`);
      }

      const json = await res.json();
      const candidate = json.candidates?.[0];
      if (!candidate) throw new Error('Nessuna risposta da Gemini');

      const parts: GeminiPart[] = candidate.content?.parts || [];
      const finishReason = candidate.finishReason;

      // Check for function calls
      const funcCalls = parts.filter((p: GeminiPart) => p.functionCall);
      if (funcCalls.length > 0) {
        // Add model's response with function calls to history
        currentHistory = [...currentHistory, { role: 'model', parts }];

        // Execute all function calls
        const toolResults: GeminiPart[] = await Promise.all(
          funcCalls.map(async (p: GeminiPart) => {
            const result = await executeTool(p.functionCall!.name, p.functionCall!.args);
            return {
              functionResponse: {
                name: p.functionCall!.name,
                response: { content: result },
              },
            };
          })
        );

        // Add tool results to history
        currentHistory = [...currentHistory, { role: 'user', parts: toolResults }];
        continue;
      }

      // No function calls — extract text response
      const text = parts
        .filter((p: GeminiPart) => p.text)
        .map((p: GeminiPart) => p.text)
        .join('');

      if (text) return text;
      if (finishReason === 'STOP') return 'Ho completato l\'operazione.';
    }

    return 'Mi dispiace, non sono riuscito a completare la richiesta. Riprova.';
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function formatMessage(text: string) {
    // Convert markdown-like formatting to readable text
    return text
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/`(.*?)`/g, '$1');
  }

  const suggestions = [
    'Chi ha appuntamento oggi?',
    'Media fiches questo mese',
    'Servizi piu eseguiti',
    'Clienti assenti da 60 giorni',
  ];

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(true)}
        className={`fixed bottom-6 right-6 z-50 w-14 h-14 bg-amber-500 hover:bg-amber-600 text-white rounded-full shadow-xl flex items-center justify-center transition-all duration-200 hover:scale-110 ${open ? 'opacity-0 pointer-events-none scale-90' : 'opacity-100 scale-100'}`}
        title="Assistente AI"
      >
        <Sparkles size={22} />
      </button>

      {/* Chat panel */}
      <div
        className={`fixed bottom-6 right-6 z-50 w-96 max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-2xl flex flex-col transition-all duration-300 origin-bottom-right ${
          open ? 'opacity-100 scale-100' : 'opacity-0 scale-90 pointer-events-none'
        }`}
        style={{ height: '560px', maxHeight: 'calc(100vh - 3rem)' }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 bg-amber-500 rounded-t-2xl flex-shrink-0">
          <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
            <Sparkles size={16} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white">Assistente AI</p>
            <p className="text-xs text-amber-100">Powered by Gemini</p>
          </div>
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
              <div
                className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-stone-900 text-white rounded-tr-sm'
                    : 'bg-stone-100 text-stone-800 rounded-tl-sm'
                }`}
              >
                {msg.loading ? (
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 bg-stone-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-1.5 h-1.5 bg-stone-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-1.5 h-1.5 bg-stone-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap">{formatMessage(msg.content)}</p>
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Suggestions (only when first message shown) */}
        {messages.length === 1 && (
          <div className="px-4 pb-2 flex flex-wrap gap-1.5 flex-shrink-0">
            {suggestions.map(s => (
              <button
                key={s}
                onClick={() => { setInput(s); setTimeout(() => inputRef.current?.focus(), 50); }}
                className="text-xs bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-full px-2.5 py-1 transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="px-4 pb-4 pt-2 flex-shrink-0 border-t border-stone-100">
          <div className="flex items-end gap-2 bg-stone-100 rounded-xl px-3 py-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Scrivi un messaggio..."
              rows={1}
              disabled={loading}
              className="flex-1 bg-transparent text-sm text-stone-800 placeholder:text-stone-400 resize-none outline-none min-h-[24px] max-h-[96px] leading-6 disabled:opacity-50"
              style={{ height: 'auto' }}
              onInput={e => {
                const t = e.target as HTMLTextAreaElement;
                t.style.height = 'auto';
                t.style.height = `${Math.min(t.scrollHeight, 96)}px`;
              }}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || loading}
              className="w-8 h-8 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg flex items-center justify-center flex-shrink-0 transition-colors"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            </button>
          </div>
          <p className="text-center text-[10px] text-stone-300 mt-1.5">Invio con Invio &bull; A capo con Shift+Invio</p>
        </div>
      </div>
    </>
  );
}
