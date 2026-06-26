import { useState, useEffect } from 'react';
import { X, Gift, CreditCard, ChevronDown, Check, Loader, Euro, Percent, Save, MapPin, ChevronRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import SmsCartaModal from './SmsCartaModal';
import { useAuth } from '../lib/AuthContext';
import { getImpostazione, setImpostazione } from '../lib/localDb';
import { apriWhatsApp, apriWhatsAppWeb, type WaMode } from '../lib/waUtils';

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

function WaIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  );
}

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
    ? tipoSconto === 'percentuale' ? `${valoreNum}%` : `€${valoreNum.toFixed(2)}`
    : '...';

  const anteprima = valido
    ? `${messaggioAuguri}\n\nPer festeggiare insieme questo giorno speciale ti regaliamo un buono del ${scontoLabel} da usare quando vuoi!`
    : null;

  return (
    <div className="border border-rose-200 bg-rose-50 rounded-xl p-3 space-y-3">
      <p className="text-xs font-bold text-rose-700 uppercase tracking-wide">
        Carta sconto per {cliente.nome}
      </p>
      <div className="flex gap-2">
        <button type="button" onClick={() => setTipoSconto('percentuale')}
          className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
            tipoSconto === 'percentuale' ? 'bg-rose-500 border-rose-500 text-white' : 'border-stone-200 bg-white text-stone-600 hover:border-rose-300'
          }`}>
          <Percent size={11} /> Percentuale
        </button>
        <button type="button" onClick={() => setTipoSconto('fisso')}
          className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
            tipoSconto === 'fisso' ? 'bg-rose-500 border-rose-500 text-white' : 'border-stone-200 bg-white text-stone-600 hover:border-rose-300'
          }`}>
          <Euro size={11} /> Cifra fissa
        </button>
      </div>
      <div className="relative">
        <input type="number" min="0" step="0.01" value={valore}
          onChange={e => setValore(e.target.value)}
          placeholder={tipoSconto === 'percentuale' ? 'es. 10' : 'es. 15.00'}
          className="w-full border border-stone-200 bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-rose-400 focus:ring-1 focus:ring-rose-200 pr-8"
        />
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 text-xs font-semibold pointer-events-none">
          {tipoSconto === 'percentuale' ? '%' : '€'}
        </span>
      </div>
      {anteprima && (
        <div className="bg-white border border-rose-100 rounded-lg px-3 py-2 text-xs text-stone-500 leading-relaxed whitespace-pre-wrap">
          {anteprima}
        </div>
      )}
      <div className="flex gap-2">
        <button type="button" onClick={onAnnulla}
          className="flex-1 py-2 rounded-lg border border-stone-200 bg-white text-xs font-medium text-stone-600 hover:bg-stone-50 transition-colors">
          Annulla
        </button>
        <button type="button" disabled={!valido} onClick={() => onConferma(tipoSconto, valoreNum)}
          className="flex-1 py-2 rounded-lg bg-rose-500 hover:bg-rose-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold transition-colors">
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
  const [sceltaScontoId, setSceltaScontoId] = useState<string | null>(null);
  const [creatingCarta, setCreatingCarta] = useState<string | null>(null);
  const [cartaCreata, setCartaCreata] = useState<CartaCreata | null>(null);
  const [waMode, setWaMode] = useState<WaMode>('desktop');
  const [includiPosizione, setIncludiPosizione] = useState(false);
  const [queueIdx, setQueueIdx] = useState<number | null>(null);

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

  useEffect(() => {
    async function loadWaSettings() {
      const [mod, pos] = await Promise.all([
        getImpostazione('wa_modalita'),
        getImpostazione('wa_pos_compleanno'),
      ]);
      setWaMode(mod === 'web' ? 'web' : 'desktop');
      if (pos !== null) setIncludiPosizione(pos === 'true');
    }
    loadWaSettings();
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

  async function handleTogglePosizione() {
    const next = !includiPosizione;
    setIncludiPosizione(next);
    await setImpostazione('wa_pos_compleanno', String(next));
  }

  function openWa(telefono: string, testo: string) {
    if (waMode === 'web') apriWhatsAppWeb(telefono, testo);
    else apriWhatsApp(telefono, testo);
  }

  function sendAuguri(c: ClienteCompleanno) {
    if (!c.telefono) return;
    openWa(c.telefono, buildMessaggio(c));
    setSentIds(prev => new Set([...prev, c.id]));
    const todayKey = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' });
    supabase.from('clienti').update({ auguri_inviati_il: todayKey }).eq('id', c.id).then(() => {});
  }

  const daInviare = clienti.filter(c => c.telefono && !sentIds.has(c.id));

  function startQueue() {
    if (daInviare.length === 0) return;
    openWa(daInviare[0].telefono!, buildMessaggio(daInviare[0]));
    setSentIds(prev => new Set([...prev, daInviare[0].id]));
    const todayKey = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' });
    supabase.from('clienti').update({ auguri_inviati_il: todayKey }).eq('id', daInviare[0].id).then(() => {});
    setQueueIdx(1);
  }

  function nextQueue() {
    if (queueIdx === null) return;
    const remaining = clienti.filter(c => c.telefono && !sentIds.has(c.id));
    if (remaining.length === 0) { setQueueIdx(null); return; }
    const c = remaining[0];
    openWa(c.telefono!, buildMessaggio(c));
    setSentIds(prev => new Set([...prev, c.id]));
    const todayKey = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' });
    supabase.from('clienti').update({ auguri_inviati_il: todayKey }).eq('id', c.id).then(() => {});
    const newRemaining = remaining.slice(1);
    if (newRemaining.length === 0) setQueueIdx(null);
    else setQueueIdx((queueIdx ?? 0) + 1);
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

  const previewCliente = clienti[0];
  const previewTesto = previewCliente ? buildMessaggio(previewCliente) : '';
  const remainingForQueue = clienti.filter(c => c.telefono && !sentIds.has(c.id));

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="relative bg-gradient-to-r from-rose-50 to-amber-50 px-6 py-4 border-b border-stone-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white shadow-sm flex items-center justify-center flex-shrink-0">
              <Gift size={17} className="text-rose-500" />
            </div>
            <div>
              <h2 className="text-base font-bold text-stone-800">
                {clienti.length === 1
                  ? `Oggi e' il compleanno di ${clienti[0].nome}!`
                  : `Oggi ${clienti.length} clienti compiono gli anni!`}
              </h2>
              <p className="text-xs text-stone-500 mt-0.5">Invia gli auguri tramite WhatsApp</p>
            </div>
          </div>
          <button onClick={onClose}
            className="absolute top-4 right-4 p-1.5 hover:bg-white/70 rounded-lg transition-colors text-stone-400 hover:text-stone-600">
            <X size={16} />
          </button>
        </div>

        {/* Body: two-column */}
        <div className="flex flex-col sm:flex-row overflow-hidden flex-1 min-h-0">

          {/* Left: preview + settings */}
          <div className="sm:w-80 border-b sm:border-b-0 sm:border-r border-stone-100 flex flex-col p-5 gap-4 overflow-y-auto flex-shrink-0">

            {/* Template selector */}
            {loadingTemplates ? (
              <div className="flex items-center justify-center py-3">
                <Loader size={16} className="text-amber-500 animate-spin" />
              </div>
            ) : templates.length > 0 && (
              <div>
                <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1.5">
                  Template auguri
                </label>
                <div className="relative">
                  <button type="button" onClick={() => setShowTemplateDropdown(s => !s)}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2 border border-stone-200 rounded-xl text-xs text-stone-700 bg-white hover:border-amber-400 transition-colors">
                    <span className="font-medium truncate">{selectedTemplate?.nome ?? 'Seleziona...'}</span>
                    <ChevronDown size={13} className={`text-stone-400 flex-shrink-0 transition-transform ${showTemplateDropdown ? 'rotate-180' : ''}`} />
                  </button>
                  {showTemplateDropdown && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-stone-200 rounded-xl shadow-xl z-10 overflow-hidden">
                      {templates.map(t => (
                        <button key={t.id} type="button"
                          onClick={() => { setSelectedTemplateId(t.id); setTemplateRaw(t.testo); setSavedTemplate(false); setShowTemplateDropdown(false); }}
                          className={`w-full text-left px-3 py-2.5 text-xs transition-colors border-b border-stone-50 last:border-0 ${
                            t.id === selectedTemplateId ? 'bg-amber-50 text-amber-700 font-semibold' : 'hover:bg-stone-50 text-stone-700'
                          }`}>
                          {t.nome}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Preview bubble */}
            {!loadingTemplates && previewTesto && (
              <div>
                <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1.5">
                  Anteprima
                </label>
                <div className="rounded-2xl overflow-hidden shadow-md" style={{ background: 'linear-gradient(180deg, #e5ddd5 0%, #d4c5b5 100%)' }}>
                  <div className="px-3 py-3">
                    <div className="bg-[#e7ffd4] rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                      <p className="text-xs text-stone-800 whitespace-pre-wrap leading-relaxed">{previewTesto}</p>
                      <p className="text-[10px] text-stone-400 text-right mt-1">anteprima</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Textarea modifica */}
            {!loadingTemplates && selectedTemplateId && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-wider">Modifica testo</label>
                  <span className="text-[9px] text-stone-400">{'{nome}'} {'{cara/caro}'}</span>
                </div>
                <textarea
                  value={templateRaw}
                  onChange={e => { setTemplateRaw(e.target.value); setSavedTemplate(false); }}
                  rows={3}
                  className="w-full text-xs border border-stone-200 rounded-xl px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-400 text-stone-700 leading-relaxed transition-colors"
                />
                <button onClick={salvaTemplate}
                  disabled={savingTemplate || templateRaw === (templates.find(t => t.id === selectedTemplateId)?.testo ?? '')}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold transition-colors">
                  {savedTemplate ? <Check size={11} /> : <Save size={11} />}
                  {savingTemplate ? 'Salvataggio...' : savedTemplate ? 'Salvato!' : 'Salva messaggio'}
                </button>
              </div>
            )}

            {/* Flag posizione */}
            <button type="button" onClick={handleTogglePosizione}
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

            {/* Queue progress */}
            {queueIdx !== null && remainingForQueue.length > 0 && (
              <div className="bg-[#25D366]/10 border border-[#25D366]/30 rounded-xl p-3 space-y-2">
                <p className="text-xs font-semibold text-stone-700">
                  Invio in corso — {remainingForQueue.length} {remainingForQueue.length === 1 ? 'rimasta' : 'rimaste'}
                </p>
                <div className="w-full bg-stone-200 rounded-full h-1.5">
                  <div className="bg-[#25D366] h-1.5 rounded-full transition-all"
                    style={{ width: `${((clienti.length - remainingForQueue.length) / clienti.length) * 100}%` }} />
                </div>
                <button onClick={nextQueue}
                  className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-[#25D366] hover:bg-[#1ebe5d] text-white text-xs font-semibold transition-colors">
                  <ChevronRight size={13} />
                  Apri prossima chat
                </button>
              </div>
            )}
          </div>

          {/* Right: client list */}
          <div className="flex-1 overflow-y-auto p-5 space-y-2">
            <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-3">
              Clienti — {clienti.length}
            </label>

            {clienti.map(c => {
              const sent = sentIds.has(c.id);
              const showingScelta = sceltaScontoId === c.id;
              const isCreating = creatingCarta === c.id;
              return (
                <div key={c.id} className={`rounded-xl border p-3 transition-colors ${sent ? 'border-green-200 bg-green-50' : 'border-stone-100 bg-stone-50/50'}`}>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div>
                      <p className="text-sm font-semibold text-stone-800">{c.nome} {c.cognome}</p>
                      {c.telefono
                        ? <p className="text-[10px] text-stone-400">{c.telefono}</p>
                        : <p className="text-[10px] text-red-400">Nessun numero</p>}
                    </div>
                    {sent && (
                      <div className="flex items-center gap-1 text-xs text-green-600 font-semibold flex-shrink-0">
                        <Check size={12} /> Inviato
                      </div>
                    )}
                  </div>

                  {showingScelta && (
                    <SceltaScontoPanel
                      cliente={c}
                      messaggioAuguri={buildMessaggio(c)}
                      onConferma={(tipo, val) => handleConfermaSconto(c, tipo, val)}
                      onAnnulla={() => setSceltaScontoId(null)}
                    />
                  )}

                  {!showingScelta && !sent && (
                    <div className="flex gap-1.5">
                      <button onClick={() => sendAuguri(c)}
                        disabled={!c.telefono || !selectedTemplate}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-colors bg-[#25D366] hover:bg-[#1ebe5d] text-white disabled:opacity-40 disabled:cursor-not-allowed">
                        <WaIcon /> Invia auguri
                      </button>
                      <button onClick={() => setSceltaScontoId(c.id)}
                        disabled={isCreating}
                        className="flex items-center gap-1 px-2.5 py-2 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 text-xs font-semibold transition-colors disabled:opacity-50"
                        title="Crea carta sconto compleanno">
                        {isCreating ? <Loader size={12} className="animate-spin" /> : <CreditCard size={12} />}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Invia a tutti — only when wa=web and queue not active */}
            {waMode === 'web' && daInviare.length > 1 && queueIdx === null && (
              <button onClick={startQueue}
                disabled={!selectedTemplate}
                className="w-full mt-2 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#25D366] hover:bg-[#1ebe5d] disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors">
                <WaIcon />
                Invia a tutti ({daInviare.length})
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-stone-100 flex-shrink-0">
          <button onClick={onClose}
            className="w-full py-2.5 rounded-xl border border-stone-200 text-sm font-semibold text-stone-600 hover:bg-stone-50 transition-colors">
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
}
