import { AlertCircle, Check, HelpCircle, MapPin, MessageCircle, Save, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { dbSelectWithRelated } from '../lib/localDb';
import { getImpostazione, setImpostazione } from '../lib/localDb';
import { apriWhatsApp, apriWhatsAppWeb, type WaMode } from '../lib/waUtils';

export interface ClienteInForseEntry {
  nome: string;
  telefono: string;
  appImmediato: { data: string; ora: string };
  altriApp: { data: string; ora: string }[];
}

function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

const DEFAULT_IN_FORSE_TEMPLATE = `Ciao {nome}, ti scriviamo per chiederti di confermarci l'appuntamento di {giorno} alle ore {ora}. Puoi farcelo sapere? Grazie! I Venzi.`;

function buildInForseMessaggio(
  template: string,
  nome: string,
  appImmediato: { data: string; ora: string },
  altriApp: { data: string; ora: string }[],
): string {
  if (altriApp.length === 0) {
    return template
      .replace(/\{nome\}/g, nome)
      .replace(/\{giorno\}/g, appImmediato.data)
      .replace(/\{ora\}/g, appImmediato.ora);
  }
  const altriLista = altriApp
    .sort((a, b) => a.data.localeCompare(b.data))
    .map(a => `${a.data} ore ${a.ora}`)
    .join(' / ');
  return `Ciao ${nome}, hai più appuntamenti in forse in agenda. Mi confermi l'appuntamento più vicino del giorno ${appImmediato.data} alle ore ${appImmediato.ora}? Oppure preferisci confermare uno degli altri appuntamenti in forse del ${altriLista}? Restiamo in attesa di una tua risposta per organizzarci al meglio, a presto! ✨ I Venzi`;
}

export async function loadAvvisoInForse(): Promise<ClienteInForseEntry[]> {
  const now = new Date();
  const dopodomani = addDays(now, 2);
  const ddKey = dopodomani.toLocaleString('sv-SE', { timeZone: 'Europe/Rome' }).split(' ')[0];

  const res = await dbSelectWithRelated({
    table: 'appuntamenti',
    columns: 'id, data_ora, cliente_id, stato, deleted_at',
    filters: [
      { col: 'stato', op: 'eq', val: 'in_forse' },
      { col: 'data_ora', op: 'gte', val: now.toISOString() },
      { col: 'deleted_at', op: 'is_null' }
    ],
    orderBy: [{ col: 'data_ora' }],
    relations: [{ key: 'clienti', table: 'clienti', fk: 'cliente_id', columns: 'id, nome, telefono' }],
    supabaseSelect: 'id, data_ora, cliente_id, clienti(id, nome, telefono)'
  });

  type RawApp = { data_ora: string; cliente_id: string; clienti: { id: string; nome: string; telefono?: string } | null };
  const byCliente = new Map<string, { nome: string; telefono: string; apps: { data: string; ora: string; dateKey: string }[] }>();

  for (const app of (res.data || []) as RawApp[]) {
    const c = app.clienti;
    if (!c || !c.telefono?.trim()) continue;
    if (!byCliente.has(c.id)) byCliente.set(c.id, { nome: c.nome, telefono: c.telefono.trim(), apps: [] });
    const d = new Date(app.data_ora);
    const dateKey = d.toLocaleString('sv-SE', { timeZone: 'Europe/Rome' }).split(' ')[0];
    const ora = d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' });
    const data = d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Rome' });
    byCliente.get(c.id)!.apps.push({ data, ora, dateKey });
  }

  const entries: ClienteInForseEntry[] = [];
  for (const [, cliente] of byCliente) {
    const immediati = cliente.apps.filter(a => a.dateKey === ddKey);
    if (immediati.length === 0) continue;
    const altriApp = cliente.apps.filter(a => a.dateKey !== ddKey);
    entries.push({ nome: cliente.nome, telefono: cliente.telefono, appImmediato: immediati[0], altriApp });
  }
  return entries;
}

interface InForseModalProps {
  clienti: ClienteInForseEntry[];
  onClose: () => void;
}

function WaIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className ?? 'w-4 h-4 fill-current'}><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
  );
}

export function InForseModal({ clienti: clientiIniziali, onClose }: InForseModalProps) {
  const dopodomani = addDays(new Date(), 2);
  const dopodomaniLabel = dopodomani.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });

  const [lista, setLista] = useState(clientiIniziali);
  const [template, setTemplate] = useState(DEFAULT_IN_FORSE_TEMPLATE);
  const [templateEdit, setTemplateEdit] = useState(DEFAULT_IN_FORSE_TEMPLATE);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [includiPosizione, setIncludiPosizione] = useState(false);
  const [waMode, setWaMode] = useState<WaMode>('desktop');
  const [inviati, setInviati] = useState<Set<number>>(new Set());
  const [queueIdx, setQueueIdx] = useState<number | null>(null);
  const userId = useRef<string | null>(null);

  useEffect(() => {
    async function loadSettings() {
      const [modalita, posizione, tpl, user] = await Promise.all([
        getImpostazione('wa_modalita'),
        getImpostazione('wa_pos_in_forse'),
        getImpostazione('messaggio_in_forse'),
        supabase.auth.getUser(),
      ]);
      setWaMode(modalita === 'web' ? 'web' : 'desktop');
      setIncludiPosizione(posizione === 'true');
      if (tpl) { setTemplate(tpl); setTemplateEdit(tpl); }
      userId.current = user.data.user?.id ?? null;
    }
    loadSettings();
  }, []);

  async function handleTogglePosizione(val: boolean) {
    setIncludiPosizione(val);
    if (userId.current) {
      await setImpostazione('wa_pos_in_forse', val ? 'true' : 'false', userId.current);
    }
  }

  async function salvaTemplate() {
    if (!userId.current) return;
    setSaving(true);
    await setImpostazione('messaggio_in_forse', templateEdit, userId.current);
    setTemplate(templateEdit);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function buildMessaggio(c: ClienteInForseEntry, withPos?: string): string {
    const base = buildInForseMessaggio(templateEdit, c.nome, c.appImmediato, c.altriApp);
    return withPos ? `${base}\n\n📍 ${withPos}` : base;
  }

  function openWa(c: ClienteInForseEntry, idx: number, posUrl?: string) {
    const testo = buildMessaggio(c, posUrl);
    if (waMode === 'web') apriWhatsAppWeb(c.telefono, testo);
    else apriWhatsApp(c.telefono, testo);
    setInviati(prev => new Set(prev).add(idx));
  }

  function handleInvia(c: ClienteInForseEntry, idx: number) {
    if (includiPosizione && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => {
          const url = `https://maps.google.com/?q=${pos.coords.latitude},${pos.coords.longitude}`;
          openWa(c, idx, url);
        },
        () => openWa(c, idx),
        { timeout: 6000 },
      );
    } else {
      openWa(c, idx);
    }
  }

  function startQueue() {
    const firstIdx = lista.findIndex((_, i) => !inviati.has(i));
    if (firstIdx < 0) return;
    handleInvia(lista[firstIdx], firstIdx);
    setQueueIdx(firstIdx);
  }

  function nextQueue() {
    if (queueIdx === null) return;
    const nextIdx = lista.findIndex((_, i) => i > queueIdx && !inviati.has(i));
    if (nextIdx < 0) { setQueueIdx(null); return; }
    handleInvia(lista[nextIdx], nextIdx);
    setQueueIdx(nextIdx);
  }

  const rimanenti = lista.filter((_, i) => !inviati.has(i));
  const hasMultiRimanenti = rimanenti.length > 1;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[200] p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center">
              <HelpCircle size={16} className="text-amber-600" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-stone-800">Conferma appuntamenti in forse</h2>
              <p className="text-xs text-stone-400 capitalize">{dopodomaniLabel} · {lista.length} client{lista.length === 1 ? 'e' : 'i'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-stone-100 rounded-lg transition-colors">
            <X size={16} className="text-stone-500" />
          </button>
        </div>

        {/* Body a due colonne */}
        <div className="flex-1 overflow-hidden flex flex-col sm:flex-row min-h-0">

          {/* Colonna sinistra: anteprima + impostazioni */}
          <div className="sm:w-80 flex-shrink-0 border-b sm:border-b-0 sm:border-r border-stone-100 flex flex-col overflow-y-auto">
            <div className="p-4 space-y-3">
              <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide">Anteprima messaggio</p>

              {/* Bolla WhatsApp */}
              <div className="bg-[#e7ffd4] rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                <p className="text-sm text-stone-800 leading-relaxed whitespace-pre-wrap">
                  {buildInForseMessaggio(templateEdit, lista[0]?.nome ?? '{nome}', lista[0]?.appImmediato ?? { data: '{giorno}', ora: '{ora}' }, [])}
                  {includiPosizione && <span className="text-stone-500">{'\n\n'}📍 [posizione GPS]</span>}
                </p>
              </div>

              {/* Textarea template */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-stone-500 uppercase tracking-wide">Testo template</label>
                <p className="text-[10px] text-stone-400">Usa <span className="font-mono bg-stone-100 px-1 rounded">{'{nome}'}</span>, <span className="font-mono bg-stone-100 px-1 rounded">{'{giorno}'}</span>, <span className="font-mono bg-stone-100 px-1 rounded">{'{ora}'}</span></p>
                <textarea
                  value={templateEdit}
                  onChange={e => { setTemplateEdit(e.target.value); setSaved(false); }}
                  rows={4}
                  className="w-full text-xs border border-stone-200 rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-300 text-stone-700 transition-colors"
                />
                <button
                  onClick={salvaTemplate}
                  disabled={saving || templateEdit === template}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold transition-colors"
                >
                  {saved ? <Check size={12} /> : <Save size={12} />}
                  {saving ? 'Salvataggio...' : saved ? 'Salvato!' : 'Salva messaggio'}
                </button>
              </div>

              {/* Toggle posizione */}
              <label className={`flex items-center gap-3 cursor-pointer px-3 py-2.5 rounded-xl border transition-colors ${includiPosizione ? 'bg-emerald-50 border-emerald-200' : 'border-stone-200 hover:bg-stone-50'}`}>
                <div
                  onClick={() => handleTogglePosizione(!includiPosizione)}
                  className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${includiPosizione ? 'bg-emerald-500' : 'bg-stone-200'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${includiPosizione ? 'translate-x-4' : ''}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-stone-700 flex items-center gap-1"><MapPin size={11} /> Condividi posizione</p>
                  <p className="text-[10px] text-stone-400 mt-0.5">{includiPosizione ? 'Link GPS aggiunto in fondo' : 'Il link mappa non verrà incluso'}</p>
                </div>
              </label>
            </div>
          </div>

          {/* Colonna destra: lista clienti */}
          <div className="flex-1 overflow-y-auto min-h-0 flex flex-col">
            {lista.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center px-6">
                <div className="w-12 h-12 rounded-2xl bg-stone-100 flex items-center justify-center mb-3">
                  <AlertCircle size={20} className="text-stone-400" />
                </div>
                <p className="text-sm font-medium text-stone-600">Nessun appuntamento in forse tra 2 giorni</p>
              </div>
            ) : (
              <div className="flex-1 p-4 space-y-2">
                <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide mb-1">Elenco clienti</p>
                {lista.map((c, i) => {
                  const inviato = inviati.has(i);
                  return (
                    <div key={`${c.telefono}_${i}`} className={`rounded-xl border overflow-hidden transition-colors ${inviato ? 'border-emerald-200 bg-emerald-50' : 'border-stone-200 bg-white hover:border-stone-300'}`}>
                      <div className="flex items-center gap-3 px-3 py-2.5">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${inviato ? 'bg-emerald-200 text-emerald-800' : 'bg-amber-100 text-amber-700'}`}>
                          {inviato ? <Check size={14} /> : c.nome[0]?.toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-semibold text-stone-800">{c.nome}</p>
                            {inviato && <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded-full">Inviato</span>}
                          </div>
                          <p className="text-[11px] text-stone-400">{c.telefono} · {c.appImmediato.data} ore {c.appImmediato.ora}
                            {c.altriApp.length > 0 && <span className="ml-1 text-amber-500">+{c.altriApp.length} altri</span>}
                          </p>
                        </div>
                        <button
                          onClick={() => handleInvia(c, i)}
                          className={`flex items-center gap-1 px-2.5 py-1.5 text-white text-xs font-semibold rounded-lg transition-colors flex-shrink-0 ${inviato ? 'bg-emerald-400 hover:bg-emerald-500' : 'bg-[#25D366] hover:bg-[#1ebe5d]'}`}
                        >
                          <WaIcon className="w-3.5 h-3.5 fill-white" />
                          {inviato ? 'Reinvia' : 'Invia'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Invia a tutti (solo wa web) */}
            {waMode === 'web' && hasMultiRimanenti && (
              <div className="p-4 border-t border-stone-100 flex-shrink-0 space-y-2">
                {queueIdx !== null ? (
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-stone-500">
                      <span>Inviati {inviati.size} di {lista.length}</span>
                      <span>{Math.round((inviati.size / lista.length) * 100)}%</span>
                    </div>
                    <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
                      <div className="h-full bg-[#25D366] rounded-full transition-all" style={{ width: `${(inviati.size / lista.length) * 100}%` }} />
                    </div>
                    {lista.findIndex((_, i) => i > queueIdx && !inviati.has(i)) >= 0 ? (
                      <button
                        onClick={nextQueue}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#25D366] hover:bg-[#1ebe5d] text-white text-sm font-semibold transition-colors"
                      >
                        <WaIcon className="w-4 h-4 fill-white" />
                        Apri prossima chat
                      </button>
                    ) : (
                      <button onClick={() => setQueueIdx(null)} className="w-full py-2.5 rounded-xl bg-stone-100 text-stone-600 text-sm font-semibold">
                        <Check size={14} className="inline mr-2" />Completato
                      </button>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={startQueue}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#25D366] hover:bg-[#1ebe5d] text-white text-sm font-semibold transition-colors shadow-sm"
                  >
                    <WaIcon className="w-4 h-4 fill-white" />
                    <MessageCircle size={14} />
                    Invia a tutti ({rimanenti.length})
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-stone-100 flex-shrink-0">
          <button onClick={onClose} className="w-full py-2.5 rounded-xl border border-stone-200 text-sm font-medium text-stone-600 hover:bg-stone-50 transition-colors">
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
}
