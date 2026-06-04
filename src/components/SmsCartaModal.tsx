import { Copy, Check, X, MessageSquare, Send, ChevronDown, CreditCard as Edit3, Loader } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export type AzioneCarta =
  | { tipo: 'creazione'; credito: number }
  | { tipo: 'ricarica'; credito: number; prezzoClientePagato: number; nuovoSaldo: number }
  | { tipo: 'ricarica_gratuita'; credito: number; nuovoSaldo: number }
  | { tipo: 'detrazione'; importoDetratto: number; nuovoSaldo: number }
  | { tipo: 'ripristino_credito'; importoRipristinato: number; nuovoSaldo: number }
  | { tipo: 'sconto_creazione'; tipoSconto: 'percentuale' | 'fisso'; valoreSconto: number }
  | { tipo: 'sconto_utilizzo'; tipoSconto: 'percentuale' | 'fisso'; valoreSconto: number; importoOriginale: number; scontoApplicato: number; importoFinale: number };

interface Template {
  id: string;
  nome: string;
  testo: string;
  is_default: boolean;
  ordine: number;
}

interface Props {
  nominativo: string;
  codice: string;
  telefono: string;
  azione: AzioneCarta;
  onClose: () => void;
  messaggioOverride?: string;
}

function normalizePhone(tel: string): string {
  const cleaned = tel.replace(/\s+/g, '').replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+')) return cleaned.replace('+', '');
  if (cleaned.startsWith('00')) return cleaned.slice(2);
  return `39${cleaned}`;
}

const CORNICE_CARTE = '🌟👑💎🎀💎👑🌟';

function conCornice(testo: string): string {
  return `${CORNICE_CARTE}\n${testo}\n${CORNICE_CARTE}`;
}

function buildMessaggioStandard(nominativo: string, codice: string, azione: AzioneCarta): string {
  const header = `Gentile ${nominativo},`;
  const footer = `Per info: contattaci in salone.\nGrazie`;

  let corpo: string;
  if (azione.tipo === 'creazione') {
    corpo = `${header}\nla tua nuova Carta Premium è stata creata!\n\nCodice: ${codice}\nCredito iniziale: €${azione.credito.toFixed(2)}\n\n${footer}`;
  } else if (azione.tipo === 'ricarica') {
    corpo = `${header}\nla tua Carta Premium è stata ricaricata.\n\nCodice: ${codice}\nCredito aggiunto: €${azione.credito.toFixed(2)}\nHai pagato: €${azione.prezzoClientePagato}\nSaldo aggiornato: €${azione.nuovoSaldo.toFixed(2)}\n\n${footer}`;
  } else if (azione.tipo === 'ricarica_gratuita') {
    corpo = `${header}\nhai ricevuto un credito bonus sulla tua Carta Premium!\n\nCodice: ${codice}\nBonus aggiunto: €${azione.credito.toFixed(2)}\nSaldo aggiornato: €${azione.nuovoSaldo.toFixed(2)}\n\n${footer}`;
  } else if (azione.tipo === 'ripristino_credito') {
    corpo = `${header}\nè stato ripristinato del credito sulla tua Carta Premium.\n\nCodice: ${codice}\nCredito ripristinato: €${azione.importoRipristinato.toFixed(2)}\nSaldo aggiornato: €${azione.nuovoSaldo.toFixed(2)}\n\n${footer}`;
  } else if (azione.tipo === 'sconto_utilizzo') {
    const desc = azione.tipoSconto === 'percentuale' ? `${azione.valoreSconto}%` : `€${azione.valoreSconto.toFixed(2)}`;
    corpo = `${header}\nla tua Carta Sconto è stata utilizzata.\n\nCodice: ${codice}\nSconto applicato: ${desc} (−€${azione.scontoApplicato.toFixed(2)})\nTotale pagato: €${azione.importoFinale.toFixed(2)}\n\n${footer}`;
  } else {
    // detrazione premium
    corpo = `${header}\nla tua Carta Premium è stata utilizzata.\n\nCodice: ${codice}\nImporto detratto: €${(azione as { importoDetratto: number }).importoDetratto.toFixed(2)}\nSaldo rimanente: €${(azione as { nuovoSaldo: number }).nuovoSaldo.toFixed(2)}\n\n${footer}`;
  }
  return conCornice(corpo);
}

function applyTemplate(testo: string, vars: { nome: string; codice: string; sconto: string; da: string }) {
  return testo
    .replace(/\{nome\}/g, vars.nome)
    .replace(/\{codice\}/g, vars.codice)
    .replace(/\{sconto\}/g, vars.sconto)
    .replace(/\{da\}/g, vars.da);
}

function hasDaVar(testo: string) {
  return /\{da\}/.test(testo);
}

// ─── Subcomponent per sconto_creazione con template ───────────────────────────

function ScontoCreazionePart({
  nominativo, codice, azione, hasPhone, onSend, onCopy, onClose, messaggioOverride,
}: {
  nominativo: string;
  codice: string;
  azione: Extract<AzioneCarta, { tipo: 'sconto_creazione' }>;
  hasPhone: boolean;
  onSend: (messaggio: string) => void;
  onCopy: (messaggio: string) => void;
  onClose: () => void;
  messaggioOverride?: string;
}) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [selectedId, setSelectedId] = useState<string>('');
  const [daValue, setDaValue] = useState('');
  const [messaggio, setMessaggio] = useState(messaggioOverride ? conCornice(messaggioOverride) : '');
  const [copied, setCopied] = useState(false);
  const [showSelect, setShowSelect] = useState(false);
  const [includiMappa, setIncludiMappa] = useState(!messaggioOverride);
  const [indirizzoMappa, setIndirizzoMappa] = useState('via Palermo 15, Roma');

  const scontoLabel = azione.tipoSconto === 'percentuale'
    ? `${azione.valoreSconto}%`
    : `€${azione.valoreSconto.toFixed(2)}`;

  const nomeBreve = nominativo.split(' ')[0] || nominativo;
  const mapUrl = indirizzoMappa.trim()
    ? `https://maps.google.com/?q=${encodeURIComponent(indirizzoMappa.trim())}`
    : '';

  useEffect(() => {
    // Se c'e' un override dal flusso compleanno, non carichiamo il template ma solo l'indirizzo
    if (messaggioOverride) {
      supabase.from('impostazioni').select('valore').eq('chiave', 'avviso_appuntamento_indirizzo').maybeSingle()
        .then(({ data: ind }) => {
          if (ind?.valore) setIndirizzoMappa(ind.valore);
          setLoadingTemplates(false);
        });
      return;
    }
    Promise.all([
      supabase.from('template_messaggi_carta_sconto').select('id, nome, testo, is_default, ordine').order('ordine'),
      supabase.from('impostazioni').select('valore').eq('chiave', 'avviso_appuntamento_indirizzo').maybeSingle(),
    ]).then(([{ data }, { data: ind }]) => {
      const list = (data || []) as Template[];
      setTemplates(list);
      const def = list.find(t => t.is_default) ?? list[0];
      if (def) {
        setSelectedId(def.id);
        setMessaggio(conCornice(applyTemplate(def.testo, { nome: nomeBreve, codice, sconto: scontoLabel, da: '' })));
      }
      if (ind?.valore) setIndirizzoMappa(ind.valore);
      setLoadingTemplates(false);
    });
  }, []);

  function selectTemplate(id: string) {
    setSelectedId(id);
    setShowSelect(false);
    const tmpl = templates.find(t => t.id === id);
    if (!tmpl) return;
    setMessaggio(conCornice(applyTemplate(tmpl.testo, { nome: nomeBreve, codice, sconto: scontoLabel, da: daValue })));
  }

  function handleDaChange(val: string) {
    setDaValue(val);
    const tmpl = templates.find(t => t.id === selectedId);
    if (!tmpl) return;
    setMessaggio(conCornice(applyTemplate(tmpl.testo, { nome: nomeBreve, codice, sconto: scontoLabel, da: val })));
  }

  const selectedTemplate = templates.find(t => t.id === selectedId);
  const needsDa = selectedTemplate ? hasDaVar(selectedTemplate.testo) : false;

  if (loadingTemplates) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader size={20} className="text-amber-500 animate-spin" />
      </div>
    );
  }

  return (
    <>
      {/* Selezione occasione (nascosta se c'e' un override dal flusso compleanno) */}
      <div className="px-5 pt-4 pb-0 space-y-3">
        {!messaggioOverride && (
          <div>
            <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1.5">Occasione</label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowSelect(s => !s)}
                className="w-full flex items-center justify-between gap-2 px-3 py-2.5 border border-stone-200 rounded-xl text-sm text-stone-700 bg-white hover:border-amber-400 transition-colors"
              >
                <span className="font-medium">{selectedTemplate?.nome ?? 'Seleziona...'}</span>
                <ChevronDown size={14} className={`text-stone-400 transition-transform ${showSelect ? 'rotate-180' : ''}`} />
              </button>
              {showSelect && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-stone-200 rounded-xl shadow-lg z-10 overflow-hidden">
                  {templates.map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => selectTemplate(t.id)}
                      className={`w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-stone-50 ${selectedId === t.id ? 'bg-amber-50 text-amber-700 font-semibold' : 'text-stone-700'}`}
                    >
                      {t.nome}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Campo "da parte di" se il template lo usa */}
        {needsDa && (
          <div>
            <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1.5">
              Da parte di <span className="text-stone-400 normal-case font-normal">(nome del mittente)</span>
            </label>
            <input
              type="text"
              value={daValue}
              onChange={e => handleDaChange(e.target.value)}
              placeholder="es. Marco"
              className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-200 transition-colors"
            />
          </div>
        )}

        {/* Toggle mappa */}
        <label className={`flex items-center gap-3 cursor-pointer px-3 py-2.5 rounded-xl border transition-colors ${includiMappa ? 'bg-emerald-50 border-emerald-200' : 'border-stone-200 hover:bg-stone-50'}`}>
          <div
            className={`w-10 h-5 rounded-full transition-colors relative flex-shrink-0 ${includiMappa ? 'bg-emerald-500' : 'bg-stone-200'}`}
            onClick={() => setIncludiMappa(v => !v)}
          >
            <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${includiMappa ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-stone-700">Allega posizione Google Maps</p>
            {includiMappa && mapUrl ? (
              <p className="text-[10px] text-emerald-600 font-mono truncate mt-0.5">{mapUrl}</p>
            ) : (
              <p className="text-[10px] text-stone-400 mt-0.5">Il link alla mappa non verrà incluso</p>
            )}
          </div>
        </label>

        {/* Testo editabile */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide">Messaggio</label>
            <span className="flex items-center gap-1 text-[10px] text-stone-400">
              <Edit3 size={9} />
              Modificabile
            </span>
          </div>
          <textarea
            value={messaggio}
            onChange={e => setMessaggio(e.target.value)}
            rows={7}
            className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-xs text-stone-700 leading-relaxed focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-200 resize-none font-mono transition-colors"
          />
          {includiMappa && mapUrl && (
            <p className="text-[10px] text-emerald-600 font-mono mt-1 px-1 truncate">{mapUrl}</p>
          )}
        </div>
      </div>

      {!hasPhone && (
        <p className="mx-5 mt-2 text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
          Nessun numero di telefono registrato per questa cliente.
        </p>
      )}

      {/* Azioni */}
      {(() => {
        const messaggioCompleto = includiMappa && mapUrl ? `${messaggio}\n\n${mapUrl}` : messaggio;
        return (
          <div className="flex gap-2 px-5 py-4">
            <button
              onClick={() => {
                navigator.clipboard.writeText(messaggioCompleto).catch(() => {});
                setCopied(true);
                setTimeout(() => setCopied(false), 1800);
                onCopy(messaggioCompleto);
              }}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-stone-200 text-sm font-medium text-stone-600 hover:bg-stone-50 transition-colors"
            >
              {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
              {copied ? 'Copiato!' : 'Copia testo'}
            </button>
            {hasPhone && (
              <button
                onClick={() => onSend(messaggioCompleto)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-green-500 hover:bg-green-600 text-white text-sm font-semibold transition-colors"
              >
                <Send size={14} />
                Invia WhatsApp
              </button>
            )}
          </div>
        );
      })()}

      <div className="px-5 pb-4">
        <button onClick={onClose} className="w-full py-2 text-xs text-stone-400 hover:text-stone-600 transition-colors">
          Salta notifica
        </button>
      </div>
    </>
  );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────

export default function SmsCartaModal({ nominativo, codice, telefono, azione, onClose, messaggioOverride }: Props) {
  const [copied, setCopied] = useState(false);
  const hasPhone = telefono.trim().length > 0;

  const titoloAzione =
    azione.tipo === 'creazione' ? 'Carta Premium creata' :
    azione.tipo === 'ricarica' ? 'Ricarica effettuata' :
    azione.tipo === 'ricarica_gratuita' ? 'Credito bonus aggiunto' :
    azione.tipo === 'ripristino_credito' ? 'Credito ripristinato' :
    azione.tipo === 'sconto_creazione' ? 'Carta Sconto creata' :
    azione.tipo === 'sconto_utilizzo' ? 'Sconto applicato' : 'Utilizzo registrato';

  function openWhatsapp(messaggio: string) {
    const testo = encodeURIComponent(messaggio);
    window.open(`https://wa.me/${normalizePhone(telefono)}?text=${testo}`, '_blank');
  }

  // Per sconto_creazione usiamo il subcomponent con template
  if (azione.tipo === 'sconto_creazione') {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100 flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-green-100 rounded-lg flex items-center justify-center">
                <MessageSquare size={14} className="text-green-600" />
              </div>
              <div>
                <p className="font-bold text-stone-800 text-sm">Notifica cliente</p>
                <p className="text-xs text-stone-400">{titoloAzione} · {nominativo}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 hover:bg-stone-100 rounded-lg transition-colors">
              <X size={15} className="text-stone-500" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            <ScontoCreazionePart
              nominativo={nominativo}
              codice={codice}
              azione={azione}
              hasPhone={hasPhone}
              onSend={openWhatsapp}
              onCopy={() => {}}
              onClose={onClose}
              messaggioOverride={messaggioOverride}
            />
          </div>
        </div>
      </div>
    );
  }

  // Per tutti gli altri tipi di azione
  const messaggio = buildMessaggioStandard(nominativo, codice, azione);

  function copyText() {
    navigator.clipboard.writeText(messaggio).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-green-100 rounded-lg flex items-center justify-center">
              <MessageSquare size={14} className="text-green-600" />
            </div>
            <div>
              <p className="font-bold text-stone-800 text-sm">Notifica cliente</p>
              <p className="text-xs text-stone-400">{titoloAzione} · {nominativo}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-stone-100 rounded-lg transition-colors">
            <X size={15} className="text-stone-500" />
          </button>
        </div>

        <div className="px-5 pt-4 pb-2 overflow-y-auto flex-1">
          <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">
            Messaggio da inviare
          </label>
          <div className="bg-stone-50 rounded-xl p-3 border border-stone-200 text-sm text-stone-700 whitespace-pre-wrap leading-relaxed font-mono text-xs">
            {messaggio}
          </div>
        </div>

        {!hasPhone && (
          <p className="mx-5 mt-2 text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
            Nessun numero di telefono registrato per questa cliente.
          </p>
        )}

        <div className="flex gap-2 px-5 py-4 flex-shrink-0">
          <button
            onClick={copyText}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-stone-200 text-sm font-medium text-stone-600 hover:bg-stone-50 transition-colors"
          >
            {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
            {copied ? 'Copiato!' : 'Copia testo'}
          </button>
          {hasPhone && (
            <button
              onClick={() => openWhatsapp(messaggio)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-green-500 hover:bg-green-600 text-white text-sm font-semibold transition-colors"
            >
              <Send size={14} />
              Invia WhatsApp
            </button>
          )}
        </div>

        <div className="px-5 pb-4 flex-shrink-0">
          <button onClick={onClose} className="w-full py-2 text-xs text-stone-400 hover:text-stone-600 transition-colors">
            Salta notifica
          </button>
        </div>
      </div>
    </div>
  );
}
