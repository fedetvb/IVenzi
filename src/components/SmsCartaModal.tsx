import { Copy, Check, X, MessageSquare, Send, ChevronDown, Loader, Save, Pencil, MapPin } from 'lucide-react';
import { useState, useEffect } from 'react';
import { dbSelect, getImpostazione } from '../lib/localDb';
import { supabase } from '../lib/supabase';
import { apriWhatsAppMode, type WaMode } from '../lib/waUtils';

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

const CORNICE_CARTE = '🌟👑💎🎀💎🎀💎👑🌟';

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

// ─── Shared green header ──────────────────────────────────────────────────────

function ModalShell({ titoloAzione, nominativo, onClose, children }: {
  titoloAzione: string;
  nominativo: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div
        className="rounded-2xl shadow-2xl w-full max-w-sm max-h-[90vh] flex flex-col overflow-hidden"
        style={{ background: 'linear-gradient(160deg, #f0fdf4 0%, #dcfce7 40%, #bbf7d0 100%)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header verde sfumato */}
        <div
          className="flex items-center justify-between px-5 py-4 flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #16a34a 0%, #22c55e 60%, #4ade80 100%)' }}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
              <MessageSquare size={15} className="text-white" />
            </div>
            <div>
              <p className="font-bold text-white text-sm">Notifica cliente</p>
              <p className="text-xs text-green-100">{titoloAzione} · {nominativo}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors">
            <X size={15} className="text-white" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── WA bubble preview (shared) ───────────────────────────────────────────────

function WaBubble({ testo, mapUrl, editingBubble, setEditingBubble, onTextChange, onSave, saving, saved, savedRef }: {
  testo: string;
  mapUrl?: string;
  editingBubble: boolean;
  setEditingBubble: (v: boolean) => void;
  onTextChange: (v: string) => void;
  onSave: () => void;
  saving: boolean;
  saved: boolean;
  savedRef: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold text-green-700 uppercase tracking-wide">Anteprima messaggio</p>
        <button
          onClick={() => setEditingBubble(!editingBubble)}
          className="text-[10px] font-semibold text-green-600 hover:text-green-800 bg-green-100 hover:bg-green-200 px-2 py-0.5 rounded-full transition-colors flex items-center gap-1"
        >
          <Pencil size={10} />
          {editingBubble ? 'Chiudi' : 'Modifica'}
        </button>
      </div>
      <div className="rounded-2xl overflow-hidden shadow-md" style={{ background: 'linear-gradient(180deg, #e5ddd5 0%, #d4c5b5 100%)' }}>
        <div className="px-3 py-3">
          {editingBubble ? (
            <div className="bg-[#e7ffd4] rounded-2xl rounded-tl-sm px-3 py-2.5 shadow-sm">
              <p className="text-[10px] text-green-600 font-semibold mb-1.5 flex items-center gap-1"><Pencil size={9} /> Modifica testo</p>
              <textarea
                value={testo}
                onChange={e => onTextChange(e.target.value)}
                rows={7}
                className="w-full text-xs bg-transparent border-0 resize-none focus:outline-none text-stone-800 leading-relaxed"
                autoFocus
              />
              {mapUrl && <p className="text-[10px] text-stone-400 mt-1 truncate">{mapUrl}</p>}
              <div className="flex justify-end mt-2">
                <button
                  onClick={onSave}
                  disabled={saving || testo === savedRef}
                  className="flex items-center gap-1 px-3 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-white text-xs font-semibold transition-colors"
                >
                  {saved ? <Check size={11} /> : <Save size={11} />}
                  {saving ? 'Salvo...' : saved ? 'Salvato!' : 'Salva'}
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-[#e7ffd4] rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
              <p className="text-xs text-stone-800 leading-relaxed whitespace-pre-wrap">
                {testo}
                {mapUrl && <span className="text-stone-500">{'\n\n'}{mapUrl}</span>}
              </p>
              <p className="text-[10px] text-stone-400 text-right mt-1">anteprima</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
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
  const [templateRaw, setTemplateRaw] = useState('');
  const [messaggioOverrideEdit, setMessaggioOverrideEdit] = useState(messaggioOverride ?? '');
  const [copied, setCopied] = useState(false);
  const [showSelect, setShowSelect] = useState(false);
  const [includiMappa, setIncludiMappa] = useState(!messaggioOverride);
  const [indirizzoMappa, setIndirizzoMappa] = useState('via Palermo 15, Roma');
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [savedTemplate, setSavedTemplate] = useState(false);
  const [editingBubble, setEditingBubble] = useState(false);

  const scontoLabel = azione.tipoSconto === 'percentuale'
    ? `${azione.valoreSconto}%`
    : `€${azione.valoreSconto.toFixed(2)}`;

  const nomeBreve = nominativo.split(' ')[0] || nominativo;
  const mapUrl = includiMappa && indirizzoMappa.trim()
    ? `https://maps.google.com/?q=${encodeURIComponent(indirizzoMappa.trim())}`
    : '';

  useEffect(() => {
    if (messaggioOverride) {
      dbSelect<{ valore: string }>({
        table: 'impostazioni',
        filters: [{ col: 'chiave', op: 'eq', val: 'avviso_appuntamento_indirizzo' }],
        limit: 1,
      }).then(({ data }) => {
        if (data?.[0]?.valore) setIndirizzoMappa(data[0].valore);
        setLoadingTemplates(false);
      });
      return;
    }
    Promise.all([
      dbSelect<Template>({
        table: 'template_messaggi_carta_sconto',
        orderBy: [{ col: 'ordine', asc: true }],
      }),
      dbSelect<{ valore: string }>({
        table: 'impostazioni',
        filters: [{ col: 'chiave', op: 'eq', val: 'avviso_appuntamento_indirizzo' }],
        limit: 1,
      }),
    ]).then(([templ, ind]) => {
      const list = (templ.data || []) as Template[];
      setTemplates(list);
      const def = list.find(t => t.is_default) ?? list[0];
      if (def) { setSelectedId(def.id); setTemplateRaw(def.testo); }
      if (ind.data?.[0]?.valore) setIndirizzoMappa(ind.data[0].valore);
      setLoadingTemplates(false);
    });
  }, []);

  function selectTemplate(id: string) {
    setSelectedId(id);
    setShowSelect(false);
    const tmpl = templates.find(t => t.id === id);
    if (!tmpl) return;
    setTemplateRaw(tmpl.testo);
    setSavedTemplate(false);
  }

  async function salvaTemplate() {
    if (!selectedId) return;
    setSavingTemplate(true);
    await supabase.from('template_messaggi_carta_sconto').update({ testo: templateRaw }).eq('id', selectedId);
    setTemplates(prev => prev.map(t => t.id === selectedId ? { ...t, testo: templateRaw } : t));
    setSavingTemplate(false);
    setSavedTemplate(true);
    setTimeout(() => setSavedTemplate(false), 2000);
  }

  const selectedTemplate = templates.find(t => t.id === selectedId);
  const needsDa = hasDaVar(templateRaw);

  const messaggioBuilt = messaggioOverride
    ? conCornice(messaggioOverrideEdit)
    : conCornice(applyTemplate(templateRaw, { nome: nomeBreve, codice, sconto: scontoLabel, da: daValue }));

  const messaggioCompleto = mapUrl ? `${messaggioBuilt}\n\n${mapUrl}` : messaggioBuilt;

  if (loadingTemplates) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader size={20} className="text-emerald-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-5 pt-4 pb-0 space-y-3">
        {/* Selezione occasione */}
        {!messaggioOverride && (
          <div>
            <label className="block text-xs font-semibold text-green-700 uppercase tracking-wide mb-1.5">Occasione</label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowSelect(s => !s)}
                className="w-full flex items-center justify-between gap-2 px-3 py-2.5 border border-green-200 rounded-xl text-sm text-stone-700 bg-white/70 hover:border-green-400 transition-colors"
              >
                <span className="font-medium">{selectedTemplate?.nome ?? 'Seleziona...'}</span>
                <ChevronDown size={14} className={`text-stone-400 transition-transform ${showSelect ? 'rotate-180' : ''}`} />
              </button>
              {showSelect && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-green-200 rounded-xl shadow-lg z-10 overflow-hidden">
                  {templates.map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => selectTemplate(t.id)}
                      className={`w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-green-50 ${selectedId === t.id ? 'bg-green-50 text-green-700 font-semibold' : 'text-stone-700'}`}
                    >
                      {t.nome}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Campo "da parte di" */}
        {needsDa && (
          <div>
            <label className="block text-xs font-semibold text-green-700 uppercase tracking-wide mb-1.5">
              Da parte di <span className="text-green-500 normal-case font-normal">(nome del mittente)</span>
            </label>
            <input
              type="text"
              value={daValue}
              onChange={e => setDaValue(e.target.value)}
              placeholder="es. Marco"
              className="w-full border border-green-200 rounded-xl px-3 py-2.5 text-sm bg-white/70 focus:outline-none focus:border-green-400 focus:ring-1 focus:ring-green-200 transition-colors"
            />
          </div>
        )}

        {/* Toggle mappa */}
        <label className={`flex items-center gap-3 cursor-pointer px-3 py-2.5 rounded-xl border transition-colors ${includiMappa ? 'bg-green-50 border-green-200' : 'border-green-100 hover:bg-green-50/50'}`}>
          <div
            className={`w-9 h-5 rounded-full transition-colors relative flex-shrink-0 ${includiMappa ? 'bg-emerald-500' : 'bg-stone-200'}`}
            onClick={() => setIncludiMappa(v => !v)}
          >
            <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${includiMappa ? 'translate-x-4' : 'translate-x-0.5'}`} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-green-800 flex items-center gap-1"><MapPin size={11} /> Condividi posizione</p>
            {includiMappa && mapUrl ? (
              <p className="text-[10px] text-green-600/70 font-mono truncate mt-0.5">{mapUrl}</p>
            ) : (
              <p className="text-[10px] text-green-600/50 mt-0.5">Il link alla mappa non verrà incluso</p>
            )}
          </div>
        </label>

        {/* Bolla WA editabile */}
        <WaBubble
          testo={messaggioBuilt}
          mapUrl={mapUrl}
          editingBubble={editingBubble}
          setEditingBubble={setEditingBubble}
          onTextChange={v => {
            if (messaggioOverride) setMessaggioOverrideEdit(v.replace(/^🌟.*\n/, '').replace(/\n🌟.*$/, ''));
            else { setTemplateRaw(v); setSavedTemplate(false); }
          }}
          onSave={async () => { await salvaTemplate(); setEditingBubble(false); }}
          saving={savingTemplate}
          saved={savedTemplate}
          savedRef={messaggioBuilt}
        />
      </div>

      {!hasPhone && (
        <p className="mx-5 mt-3 text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
          Nessun numero di telefono registrato per questa cliente.
        </p>
      )}

      {/* Azioni */}
      <div className="flex gap-2 px-5 py-4">
        <button
          onClick={() => {
            navigator.clipboard.writeText(messaggioCompleto).catch(() => {});
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
            onCopy(messaggioCompleto);
          }}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-green-200 text-sm font-medium text-green-700 hover:bg-green-100/60 transition-colors"
        >
          {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
          {copied ? 'Copiato!' : 'Copia testo'}
        </button>
        {hasPhone && (
          <button
            onClick={() => onSend(messaggioCompleto)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-[#25D366] hover:bg-[#1ebe5d] text-white text-sm font-semibold transition-colors"
          >
            <Send size={14} />
            Invia WhatsApp
          </button>
        )}
      </div>

      <div className="px-5 pb-4">
        <button onClick={onClose} className="w-full py-2 text-xs text-green-600 hover:text-green-800 transition-colors">
          Salta notifica
        </button>
      </div>
    </div>
  );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────

export default function SmsCartaModal({ nominativo, codice, telefono, azione, onClose, messaggioOverride }: Props) {
  const [copied, setCopied] = useState(false);
  const [ready, setReady] = useState(false);
  const [editingBubble, setEditingBubble] = useState(false);
  const [messaggioEdit, setMessaggioEdit] = useState('');
  const [waMode, setWaMode] = useState<WaMode>('desktop');
  const hasPhone = telefono.trim().length > 0;

  useEffect(() => {
    getImpostazione('whatsapp_avviso_disabilitato').then(v => {
      if (v === 'true') { onClose(); } else { setReady(true); }
    });
    getImpostazione('wa_modalita').then(v => { if (v === 'web') setWaMode('web'); });
  }, []);

  if (!ready) return null;

  const titoloAzione =
    azione.tipo === 'creazione' ? 'Carta Premium creata' :
    azione.tipo === 'ricarica' ? 'Ricarica effettuata' :
    azione.tipo === 'ricarica_gratuita' ? 'Credito bonus aggiunto' :
    azione.tipo === 'ripristino_credito' ? 'Credito ripristinato' :
    azione.tipo === 'sconto_creazione' ? 'Carta Sconto creata' :
    azione.tipo === 'sconto_utilizzo' ? 'Sconto applicato' : 'Utilizzo registrato';

  function openWhatsapp(messaggio: string) {
    apriWhatsAppMode(telefono, messaggio, waMode);
    onClose();
  }

  if (azione.tipo === 'sconto_creazione') {
    return (
      <ModalShell titoloAzione={titoloAzione} nominativo={nominativo} onClose={onClose}>
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
      </ModalShell>
    );
  }

  // Tutti gli altri tipi
  const messaggioBase = buildMessaggioStandard(nominativo, codice, azione);
  const testoAttivo = messaggioEdit || messaggioBase;

  return (
    <ModalShell titoloAzione={titoloAzione} nominativo={nominativo} onClose={onClose}>
      <div className="flex-1 overflow-y-auto">
        <div className="px-5 pt-4 pb-0 space-y-3">
          <WaBubble
            testo={testoAttivo}
            editingBubble={editingBubble}
            setEditingBubble={setEditingBubble}
            onTextChange={v => setMessaggioEdit(v)}
            onSave={async () => { setEditingBubble(false); }}
            saving={false}
            saved={false}
            savedRef={messaggioBase}
          />
        </div>

        {!hasPhone && (
          <p className="mx-5 mt-3 text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
            Nessun numero di telefono registrato per questa cliente.
          </p>
        )}

        <div className="flex gap-2 px-5 py-4">
          <button
            onClick={() => {
              navigator.clipboard.writeText(testoAttivo).catch(() => {});
              setCopied(true);
              setTimeout(() => setCopied(false), 1800);
            }}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-green-200 text-sm font-medium text-green-700 hover:bg-green-100/60 transition-colors"
          >
            {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
            {copied ? 'Copiato!' : 'Copia testo'}
          </button>
          {hasPhone && (
            <button
              onClick={() => openWhatsapp(testoAttivo)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-[#25D366] hover:bg-[#1ebe5d] text-white text-sm font-semibold transition-colors"
            >
              <Send size={14} />
              Invia WhatsApp
            </button>
          )}
        </div>

        <div className="px-5 pb-4">
          <button onClick={onClose} className="w-full py-2 text-xs text-green-600 hover:text-green-800 transition-colors">
            Salta notifica
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
