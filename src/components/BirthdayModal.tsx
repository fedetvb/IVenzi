import { useState, useEffect } from 'react';
import { X, Gift, Send, CreditCard, ChevronDown, Check, Loader, Euro, Percent, Save } from 'lucide-react';
import { supabase } from '../lib/supabase';
import SmsCartaModal from './SmsCartaModal';
import { useAuth } from '../lib/AuthContext';
import { apriWhatsApp } from '../lib/waUtils';

interface ClienteCompleanno {
  id: string;
  nome: string;
  cognome: string;
  telefono: string | null;
}

interface TemplateCom {
  id: string;
  nome: string;
  testo: string;
  is_default: boolean;
  ordine: number;
}

interface CartaCreata {
  clienteId: string;
  codice: string;
  tipoSconto: 'percentuale' | 'fisso';
  valoreSconto: number;
  telefono: string;
  nominativo: string;
  messaggioAuguri: string;
}

interface Props {
  clienti: ClienteCompleanno[];
  onClose: () => void;
}

function normalizePhone(tel: string): string {
  const cleaned = tel.replace(/\s+/g, '').replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+')) return cleaned.replace('+', '');
  if (cleaned.startsWith('00')) return cleaned.slice(2);
  return `39${cleaned}`;
}

function genCodice(): string {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

// Pannello inline per scegliere tipo/valore sconto prima di creare la carta
function SceltaScontoPanel({
  cliente,
  messaggioAuguri,
  onConferma,
  onAnnulla,
}: {
  cliente: ClienteCompleanno;
  messaggioAuguri: string;
  onConferma: (tipoSconto: 'percentuale' | 'fisso', valore: number) => void;
  onAnnulla: () => void;
}) {
  const [tipoSconto, setTipoSconto] = useState<'percentuale' | 'fisso'>('percentuale');
  const [valore, setValore] = useState('');

  const valoreNum = parseFloat(valore.replace(',', '.'));
  const valido = !isNaN(valoreNum) && valoreNum > 0;

  const scontoLabel = valido
    ? tipoSconto === 'percentuale'
      ? `${valoreNum}%`
      : `€${valoreNum.toFixed(2)}`
    : '...';

  const anteprima = valido
    ? `${messaggioAuguri}\n\nPer festeggiare insieme questo giorno speciale ti regaliamo un buono del ${scontoLabel} da usare quando vuoi!`
    : null;

  return (
    <div className="border border-rose-200 bg-rose-50 rounded-xl p-4 space-y-3">
      <p className="text-xs font-bold text-rose-700 uppercase tracking-wide">
        Nuova carta sconto per {cliente.nome}
      </p>

      {/* Tipo sconto */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setTipoSconto('percentuale')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold border transition-colors ${
            tipoSconto === 'percentuale'
              ? 'bg-rose-500 border-rose-500 text-white'
              : 'border-stone-200 bg-white text-stone-600 hover:border-rose-300'
          }`}
        >
          <Percent size={12} />
          Percentuale
        </button>
        <button
          type="button"
          onClick={() => setTipoSconto('fisso')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold border transition-colors ${
            tipoSconto === 'fisso'
              ? 'bg-rose-500 border-rose-500 text-white'
              : 'border-stone-200 bg-white text-stone-600 hover:border-rose-300'
          }`}
        >
          <Euro size={12} />
          Cifra fissa
        </button>
      </div>

      {/* Valore */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <input
            type="number"
            min="0"
            step="0.01"
            value={valore}
            onChange={e => setValore(e.target.value)}
            placeholder={tipoSconto === 'percentuale' ? 'es. 10' : 'es. 15.00'}
            className="w-full border border-stone-200 bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-rose-400 focus:ring-1 focus:ring-rose-200 pr-8"
          />
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 text-xs font-semibold pointer-events-none">
            {tipoSconto === 'percentuale' ? '%' : '€'}
          </span>
        </div>
      </div>

      {/* Anteprima frase */}
      {anteprima && (
        <div className="bg-white border border-rose-100 rounded-lg px-3 py-2 text-xs text-stone-500 leading-relaxed whitespace-pre-wrap">
          {anteprima}
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onAnnulla}
          className="flex-1 py-2 rounded-lg border border-stone-200 bg-white text-xs font-medium text-stone-600 hover:bg-stone-50 transition-colors"
        >
          Annulla
        </button>
        <button
          type="button"
          disabled={!valido}
          onClick={() => onConferma(tipoSconto, valoreNum)}
          className="flex-1 py-2 rounded-lg bg-rose-500 hover:bg-rose-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold transition-colors"
        >
          Crea e invia
        </button>
      </div>
    </div>
  );
}

export default function BirthdayModal({ clienti, onClose }: Props) {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<TemplateCom[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [templateRaw, setTemplateRaw] = useState('');
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [showTemplateDropdown, setShowTemplateDropdown] = useState(false);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [savedTemplate, setSavedTemplate] = useState(false);
  // id del cliente per cui si sta scegliendo lo sconto
  const [sceltaScontoId, setSceltaScontoId] = useState<string | null>(null);
  const [creatingCarta, setCreatingCarta] = useState<string | null>(null);
  const [cartaCreata, setCartaCreata] = useState<CartaCreata | null>(null);

  useEffect(() => {
    supabase
      .from('template_messaggi_comunicazioni')
      .select('id, nome, testo, is_default, ordine')
      .order('ordine')
      .then(({ data }) => {
        const list = (data || []) as TemplateCom[];
        setTemplates(list);
        const def = list.find(t => t.is_default) ?? list[0];
        if (def) { setSelectedTemplateId(def.id); setTemplateRaw(def.testo); }
        setLoadingTemplates(false);
      });
  }, []);

  const selectedTemplate = templates.find(t => t.id === selectedTemplateId);

  function genderSaluto(nome: string): string {
    const n = nome.trim().toLowerCase();
    const maschiliEccezioni = ['luca', 'andrea', 'nicola', 'mattia', 'enea', 'elia', 'beniamina', 'tobia', 'battista'];
    if (maschiliEccezioni.includes(n)) return 'Caro';
    if (n.endsWith('a') || n.endsWith('e')) return 'Cara';
    return 'Caro';
  }

  function buildMessaggio(c: ClienteCompleanno): string {
    if (!templateRaw) return '';
    const saluto = genderSaluto(c.nome);
    return templateRaw
      .replace(/\{nome\}/g, c.nome)
      .replace(/\{cara\/caro\}/gi, saluto)
      .replace(/\{caro\/cara\}/gi, saluto)
      .replace(/cara\/a/gi, saluto)
      .replace(/\bCara\/o\b/g, saluto)
      .replace(/\bCaro\/a\b/g, saluto);
  }

  async function salvaTemplate() {
    if (!selectedTemplateId) return;
    setSavingTemplate(true);
    await supabase.from('template_messaggi_comunicazioni').update({ testo: templateRaw }).eq('id', selectedTemplateId);
    setTemplates(prev => prev.map(t => t.id === selectedTemplateId ? { ...t, testo: templateRaw } : t));
    setSavingTemplate(false);
    setSavedTemplate(true);
    setTimeout(() => setSavedTemplate(false), 2000);
  }

  function sendAuguri(c: ClienteCompleanno) {
    if (!c.telefono) return;
    apriWhatsApp(c.telefono, buildMessaggio(c));
    setSentIds(prev => new Set([...prev, c.id]));
    const todayKey = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' });
    supabase.from('clienti').update({ auguri_inviati_il: todayKey }).eq('id', c.id).then(() => {});
  }

  function sendTutti() {
    const daInviare = clienti.filter(c => c.telefono && !sentIds.has(c.id));
    const todayKey = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' });
    for (const c of daInviare) {
      apriWhatsApp(c.telefono!, buildMessaggio(c));
      supabase.from('clienti').update({ auguri_inviati_il: todayKey }).eq('id', c.id).then(() => {});
    }
    setSentIds(prev => new Set([...prev, ...daInviare.map(c => c.id)]));
  }

  async function handleConfermaSconto(
    cliente: ClienteCompleanno,
    tipoSconto: 'percentuale' | 'fisso',
    valore: number,
  ) {
    setSceltaScontoId(null);
    setCreatingCarta(cliente.id);

    const codice = genCodice();
    const scontoLabel = tipoSconto === 'percentuale' ? `${valore}%` : `€${valore.toFixed(2)}`;
    const msgAuguri = buildMessaggio(cliente);
    const descCarta = `Buono compleanno ${new Date().getFullYear()} — ${cliente.nome} ${cliente.cognome}`;

    await supabase.from('carte_sconto').insert({
      codice,
      descrizione: descCarta,
      tipo_sconto: tipoSconto,
      valore_sconto: valore,
      attiva: true,
      usa_e_getta: true,
      nominativa: true,
      cliente_id: cliente.id,
      telefono_override: cliente.telefono ?? '',
      user_id: user?.id,
    });

    const todayKey = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' });
    supabase.from('clienti').update({ auguri_inviati_il: todayKey }).eq('id', cliente.id).then(() => {});

    setCreatingCarta(null);
    setCartaCreata({
      clienteId: cliente.id,
      codice,
      tipoSconto,
      valoreSconto: valore,
      telefono: cliente.telefono ?? '',
      nominativo: `${cliente.nome} ${cliente.cognome}`,
      messaggioAuguri: `${msgAuguri}\n\nPer festeggiare insieme questo giorno speciale ti regaliamo un buono del ${scontoLabel} da usare quando vuoi!\n\nCodice carta: ${codice}\nSconto: ${scontoLabel}\nValida: nominativa, usa e getta`,
    });
  }

  const tuttiHaveTel = clienti.every(c => c.telefono);

  // Mostra SmsCartaModal dopo la creazione della carta
  if (cartaCreata) {
    return (
      <SmsCartaModal
        nominativo={cartaCreata.nominativo}
        codice={cartaCreata.codice}
        telefono={cartaCreata.telefono}
        azione={{
          tipo: 'sconto_creazione',
          tipoSconto: cartaCreata.tipoSconto,
          valoreSconto: cartaCreata.valoreSconto,
        }}
        messaggioOverride={cartaCreata.messaggioAuguri}
        onClose={() => {
          setSentIds(prev => new Set([...prev, cartaCreata.clienteId]));
          setCartaCreata(null);
        }}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="relative bg-gradient-to-r from-rose-50 to-amber-50 px-6 py-5 border-b border-stone-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center flex-shrink-0">
              <Gift size={18} className="text-rose-500" />
            </div>
            <div>
              <h2 className="text-base font-bold text-stone-800">
                {clienti.length === 1
                  ? `Oggi e' il compleanno di ${clienti[0].nome}!`
                  : `Oggi ${clienti.length} clienti compiono gli anni!`}
              </h2>
              <p className="text-xs text-stone-500 mt-0.5">Vuoi inviare gli auguri?</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 hover:bg-white/70 rounded-lg transition-colors text-stone-400 hover:text-stone-600"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5 overflow-y-auto flex-1">
          {/* Selezione template */}
          {loadingTemplates ? (
            <div className="flex items-center justify-center py-4">
              <Loader size={18} className="text-amber-500 animate-spin" />
            </div>
          ) : templates.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1.5">
                Messaggio di auguri
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowTemplateDropdown(s => !s)}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2.5 border border-stone-200 rounded-xl text-sm text-stone-700 bg-white hover:border-amber-400 transition-colors"
                >
                  <span className="font-medium">{selectedTemplate?.nome ?? 'Seleziona template...'}</span>
                  <ChevronDown size={14} className={`text-stone-400 transition-transform ${showTemplateDropdown ? 'rotate-180' : ''}`} />
                </button>
                {showTemplateDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-stone-200 rounded-xl shadow-xl z-10 overflow-hidden">
                    {templates.map(t => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => { setSelectedTemplateId(t.id); setTemplateRaw(t.testo); setSavedTemplate(false); setShowTemplateDropdown(false); }}
                        className={`w-full text-left px-4 py-3 text-sm transition-colors border-b border-stone-50 last:border-0 ${
                          t.id === selectedTemplateId ? 'bg-amber-50 text-amber-700 font-semibold' : 'hover:bg-stone-50 text-stone-700'
                        }`}
                      >
                        {t.nome}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Modifica testo template */}
          {!loadingTemplates && selectedTemplateId && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide">Testo messaggio</label>
                <span className="text-[10px] text-stone-400">Usa {'{nome}'}, {'{cara/caro}'}</span>
              </div>
              <textarea
                value={templateRaw}
                onChange={e => { setTemplateRaw(e.target.value); setSavedTemplate(false); }}
                rows={3}
                className="w-full text-xs border border-stone-200 rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-400 text-stone-700 font-mono transition-colors"
              />
              <button
                onClick={salvaTemplate}
                disabled={savingTemplate || templateRaw === (templates.find(t => t.id === selectedTemplateId)?.testo ?? '')}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold transition-colors"
              >
                {savedTemplate ? <Check size={12} /> : <Save size={12} />}
                {savingTemplate ? 'Salvataggio...' : savedTemplate ? 'Salvato!' : 'Salva messaggio'}
              </button>
            </div>
          )}

          {/* Lista clienti */}
          <div className="space-y-3">
            {clienti.map(c => {
              const sent = sentIds.has(c.id);
              const showingScelta = sceltaScontoId === c.id;
              const isCreating = creatingCarta === c.id;
              return (
                <div key={c.id} className={`rounded-xl border p-4 space-y-3 transition-colors ${sent ? 'border-green-200 bg-green-50' : 'border-stone-200 bg-white'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-bold text-stone-800">{c.nome} {c.cognome}</p>
                      {c.telefono ? (
                        <p className="text-xs text-stone-400 mt-0.5">{c.telefono}</p>
                      ) : (
                        <p className="text-xs text-red-400 mt-0.5">Nessun numero</p>
                      )}
                    </div>
                    {sent && (
                      <div className="flex items-center gap-1 text-xs text-green-600 font-semibold">
                        <Check size={13} />
                        Inviato
                      </div>
                    )}
                  </div>

                  {selectedTemplate && (
                    <div className="bg-stone-50 rounded-lg px-3 py-2 text-xs text-stone-500 leading-relaxed whitespace-pre-wrap font-mono">
                      {buildMessaggio(c)}
                    </div>
                  )}

                  {/* Pannello selezione sconto */}
                  {showingScelta && (
                    <SceltaScontoPanel
                      cliente={c}
                      messaggioAuguri={buildMessaggio(c)}
                      onConferma={(tipo, val) => handleConfermaSconto(c, tipo, val)}
                      onAnnulla={() => setSceltaScontoId(null)}
                    />
                  )}

                  {!showingScelta && !sent && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => sendAuguri(c)}
                        disabled={!c.telefono || !selectedTemplate}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-colors bg-[#25D366] hover:bg-[#1ebe5d] text-white disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <WhatsAppIcon />
                        Invia auguri
                      </button>

                      <button
                        onClick={() => setSceltaScontoId(c.id)}
                        disabled={isCreating}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 text-xs font-semibold transition-colors disabled:opacity-50"
                        title="Crea e invia una carta sconto compleanno"
                      >
                        {isCreating ? (
                          <Loader size={13} className="animate-spin" />
                        ) : (
                          <CreditCard size={13} />
                        )}
                        Carta sconto
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-stone-100 flex gap-3 flex-shrink-0">
          {clienti.length > 1 && tuttiHaveTel && (
            <button
              onClick={sendTutti}
              disabled={!selectedTemplate || clienti.filter(c => c.telefono && !sentIds.has(c.id)).length === 0}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#25D366] hover:bg-[#1ebe5d] disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
            >
              <Send size={14} />
              {clienti.some(c => sentIds.has(c.id))
                ? `Invia ai restanti (${clienti.filter(c => c.telefono && !sentIds.has(c.id)).length})`
                : 'Invia a tutti'}
            </button>
          )}
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-stone-200 text-sm font-semibold text-stone-600 hover:bg-stone-50 transition-colors"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
}

function WhatsAppIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  );
}
