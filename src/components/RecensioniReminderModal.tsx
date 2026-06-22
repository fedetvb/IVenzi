import { useState, useEffect, useRef } from 'react';
import { X, Star, AlertCircle, MapPin, Save, Check, MessageCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getImpostazione, setImpostazione } from '../lib/localDb';
import { analizzaVociWithMap, getTestoKey, getDefaultTesto } from '../lib/recensioniUtils';
import { apriWhatsApp, apriWhatsAppWeb, type WaMode } from '../lib/waUtils';

interface ClienteRecensione {
  clienteId: string;
  nome: string;
  cognome: string;
  telefono: string | null;
  testo: string;
  categoria: string;
  hasTaglio: boolean;
  recensioneLasciata: boolean;
  bloccataFino: Date | null;
}

interface Props {
  userId: string;
  onClose: () => void;
}

function WaIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className ?? 'w-4 h-4 fill-current'}><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
  );
}

export default function RecensioniReminderModal({ userId, onClose }: Props) {
  const [clienti, setClienti] = useState<ClienteRecensione[]>([]);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [siteOrigin, setSiteOrigin] = useState('');
  const [includiPosizione, setIncludiPosizione] = useState(false);
  const [waMode, setWaMode] = useState<WaMode>('desktop');
  const [inviati, setInviati] = useState<Set<string>>(new Set());
  const [queueClienteId, setQueueClienteId] = useState<string | null>(null);
  const [templateGlobale, setTemplateGlobale] = useState('');
  const [savedTemplate, setSavedTemplate] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState(false);
  const userIdRef = useRef<string | null>(null);

  useEffect(() => {
    setSiteOrigin(window.location.origin);
    async function loadSettings() {
      const { data: { user } } = await supabase.auth.getUser();
      userIdRef.current = user?.id ?? null;
      const [mod, pos, tpl] = await Promise.all([
        getImpostazione('wa_modalita'),
        getImpostazione('wa_pos_recensioni'),
        getImpostazione('messaggio_recensione'),
      ]);
      setWaMode(mod === 'web' ? 'web' : 'desktop');
      setIncludiPosizione(pos === 'true');
      if (tpl) { setTemplateGlobale(tpl); setSavedTemplate(tpl); }
    }
    loadSettings();
  }, []);

  useEffect(() => {
    loadClienti();
  }, [userId]);

  async function loadClienti() {
    setLoading(true);
    try {
      const now = new Date();
      const romeNow = now.toLocaleString('sv-SE', { timeZone: 'Europe/Rome' });
      const todayKey = romeNow.split(' ')[0];
      const yesterdayKey = (() => {
        const d = new Date(`${todayKey}T12:00:00Z`);
        d.setUTCDate(d.getUTCDate() - 1);
        return d.toISOString().split('T')[0];
      })();
      const romeToUtc = (dateKey: string): string => {
        const naive = new Date(`${dateKey}T00:00:00Z`);
        const romeStr = naive.toLocaleString('sv-SE', { timeZone: 'Europe/Rome' });
        const naiveRome = new Date(romeStr.replace(' ', 'T') + 'Z');
        const offsetMs = naive.getTime() - naiveRome.getTime();
        return new Date(naive.getTime() - offsetMs).toISOString();
      };
      const yesterdayStart = romeToUtc(yesterdayKey);
      const yesterdayEnd = romeToUtc(todayKey);

      const { data: fiches } = await supabase
        .from('fiches')
        .select('id, cliente_id, clienti(id, nome, cognome, telefono, recensione_lasciata, data_blocco_recensione)')
        .eq('user_id', userId)
        .eq('convalidata', true)
        .gte('convalidata_at', yesterdayStart)
        .lte('convalidata_at', yesterdayEnd)
        .is('deleted_at', null)
        .order('convalidata_at', { ascending: false });

      if (!fiches || fiches.length === 0) { setLoading(false); return; }

      const { data: variantiDb } = await supabase
        .from('testi_recensioni_dinamici')
        .select('categoria_principale,has_taglio,testo_completo')
        .eq('user_id', userId);
      const variantiMap: Record<string, string> = {};
      for (const v of (variantiDb ?? []) as { categoria_principale: string; has_taglio: boolean; testo_completo: string }[]) {
        variantiMap[getTestoKey(v.categoria_principale as any, v.has_taglio)] = v.testo_completo;
      }

      const { data: trattamentiDb } = await supabase
        .from('trattamenti_catalogo')
        .select('nome,categoria_recensione')
        .eq('user_id', userId);
      const serviceMap: Record<string, string> = {};
      for (const t of (trattamentiDb ?? []) as { nome: string; categoria_recensione: string | null }[]) {
        if (t.categoria_recensione) serviceMap[t.nome.toLowerCase()] = t.categoria_recensione;
      }

      const { data: customCatsDb } = await supabase
        .from('recensioni_categorie')
        .select('slug,testo_con_taglio,testo_senza_taglio')
        .eq('user_id', userId);
      const customCatMap: Record<string, { con: string; senza: string }> = {};
      for (const c of (customCatsDb ?? []) as { slug: string; testo_con_taglio: string | null; testo_senza_taglio: string | null }[]) {
        customCatMap[c.slug] = { con: c.testo_con_taglio ?? '', senza: c.testo_senza_taglio ?? '' };
      }

      const seen = new Set<string>();
      const uniqueFiches: typeof fiches = [];
      for (const f of fiches) {
        const cid = (f as any).cliente_id;
        if (!seen.has(cid)) { seen.add(cid); uniqueFiches.push(f); }
      }

      const result: ClienteRecensione[] = [];
      for (const f of uniqueFiches) {
        const clienteRaw = (f as any).clienti as {
          id: string; nome: string; cognome: string; telefono: string | null;
          recensione_lasciata: boolean; data_blocco_recensione: string | null;
        } | null;
        if (!clienteRaw) continue;
        const recLasciata = clienteRaw.recensione_lasciata ?? false;
        const bloccataFino = clienteRaw.data_blocco_recensione ? new Date(clienteRaw.data_blocco_recensione) : null;
        if (recLasciata) continue;
        if (bloccataFino && bloccataFino > new Date()) continue;

        const { data: voci } = await supabase
          .from('fiche_voci')
          .select('nome_voce, tipo')
          .eq('fiche_id', (f as any).id);

        const { categoria, hasTaglio } = analizzaVociWithMap(
          (voci ?? []) as { nome_voce: string; tipo: string }[],
          serviceMap
        );
        const key = `${categoria}|${hasTaglio}`;
        let testo = variantiMap[key];
        if (!testo && customCatMap[categoria]) {
          const entry = customCatMap[categoria];
          testo = hasTaglio ? (entry.con || entry.senza) : (entry.senza || entry.con);
        }
        if (!testo) testo = getDefaultTesto(categoria as any, hasTaglio);

        result.push({ clienteId: clienteRaw.id, nome: clienteRaw.nome, cognome: clienteRaw.cognome, telefono: clienteRaw.telefono, testo, categoria, hasTaglio, recensioneLasciata: recLasciata, bloccataFino });
      }

      setClienti(result);
      const draftsInit: Record<string, string> = {};
      for (const c of result) draftsInit[c.clienteId] = c.testo;
      setDrafts(draftsInit);
    } finally {
      setLoading(false);
    }
  }

  async function handleTogglePosizione(val: boolean) {
    setIncludiPosizione(val);
    if (userIdRef.current) await setImpostazione('wa_pos_recensioni', val ? 'true' : 'false', userIdRef.current);
  }

  async function salvaTemplateGlobale() {
    if (!userIdRef.current || !templateGlobale.trim()) return;
    setSavingTemplate(true);
    await setImpostazione('messaggio_recensione', templateGlobale, userIdRef.current);
    setSavedTemplate(templateGlobale);
    setSavingTemplate(false);
    setSavedFeedback(true);
    setTimeout(() => setSavedFeedback(false), 2000);
  }

  function buildTesto(c: ClienteRecensione, origin: string): string {
    const draft = drafts[c.clienteId] ?? c.testo;
    const link = `${origin}/recensioni?id=${c.clienteId}`;
    return `${draft}\n\n${link}`;
  }

  async function handleInvia(clienteId: string) {
    const cliente = clienti.find(c => c.clienteId === clienteId);
    if (!cliente?.telefono) return;
    const testo = buildTesto(cliente, siteOrigin);
    if (waMode === 'web') apriWhatsAppWeb(cliente.telefono, testo);
    else apriWhatsApp(cliente.telefono, testo);
    await supabase.rpc('segna_invio_recensione', { p_cliente_id: clienteId });
    setInviati(prev => new Set(prev).add(clienteId));
  }

  function startQueue() {
    const first = clienti.find(c => c.telefono && !inviati.has(c.clienteId));
    if (!first) return;
    handleInvia(first.clienteId);
    setQueueClienteId(first.clienteId);
  }

  function nextQueue() {
    if (!queueClienteId) return;
    const currIdx = clienti.findIndex(c => c.clienteId === queueClienteId);
    const next = clienti.find((c, i) => i > currIdx && c.telefono && !inviati.has(c.clienteId));
    if (!next) { setQueueClienteId(null); return; }
    handleInvia(next.clienteId);
    setQueueClienteId(next.clienteId);
  }

  const rimanenti = clienti.filter(c => c.telefono && !inviati.has(c.clienteId));
  const hasMultiRimanenti = rimanenti.length > 1;
  const previewTesto = clienti[0] ? (drafts[clienti[0].clienteId] ?? clienti[0].testo) : 'Il tuo messaggio di invito alla recensione apparirà qui.';

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-3xl rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[92vh]">

        {/* Header */}
        <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-stone-100 flex-shrink-0">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
            <Star size={18} className="text-blue-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-stone-800">Promemoria Recensioni</h3>
            <p className="text-xs text-stone-400">Clienti di ieri — invia il link Google</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-stone-100 rounded-xl transition-colors text-stone-400">
            <X size={18} />
          </button>
        </div>

        {/* Body a due colonne */}
        <div className="flex-1 overflow-hidden flex flex-col sm:flex-row min-h-0">

          {/* Colonna sinistra: anteprima + impostazioni */}
          <div className="sm:w-80 flex-shrink-0 border-b sm:border-b-0 sm:border-r border-stone-100 overflow-y-auto flex flex-col">
            <div className="p-4 space-y-3">
              <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide">Anteprima messaggio</p>

              {/* Bolla anteprima */}
              <div className="bg-[#e7ffd4] rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                <p className="text-sm text-stone-800 leading-relaxed whitespace-pre-wrap">
                  {previewTesto}
                  <span className="text-stone-400">{'\n\n'}{siteOrigin}/recensioni?id=...</span>
                </p>
              </div>

              {/* Template globale (per testo base) */}
              {!loading && clienti.length > 0 && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-stone-500 uppercase tracking-wide">Testo base (primo cliente)</label>
                  <textarea
                    value={drafts[clienti[0]?.clienteId ?? ''] ?? ''}
                    onChange={e => {
                      const id = clienti[0]?.clienteId;
                      if (id) setDrafts(prev => ({ ...prev, [id]: e.target.value }));
                      setSavedFeedback(false);
                    }}
                    rows={4}
                    className="w-full text-xs border border-stone-200 rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 text-stone-700 transition-colors"
                  />
                  <button
                    onClick={async () => {
                      const id = clienti[0]?.clienteId;
                      if (!id || !userIdRef.current) return;
                      setSavingTemplate(true);
                      await setImpostazione('messaggio_recensione', drafts[id] ?? '', userIdRef.current);
                      setSavingTemplate(false);
                      setSavedFeedback(true);
                      setTimeout(() => setSavedFeedback(false), 2000);
                    }}
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 disabled:opacity-40 text-white text-xs font-semibold transition-colors"
                  >
                    {savedFeedback ? <Check size={12} /> : <Save size={12} />}
                    {savingTemplate ? 'Salvataggio...' : savedFeedback ? 'Salvato!' : 'Salva messaggio'}
                  </button>
                </div>
              )}

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
            {loading && (
              <div className="flex items-center justify-center h-32">
                <div className="w-7 h-7 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
              </div>
            )}

            {!loading && clienti.length === 0 && (
              <div className="text-center py-12 px-6 space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-stone-100 flex items-center justify-center mx-auto">
                  <AlertCircle size={20} className="text-stone-400" />
                </div>
                <p className="text-sm font-semibold text-stone-600">Nessuna cliente da contattare</p>
                <p className="text-xs text-stone-400">Tutte le clienti di ieri hanno già recensito o sono in periodo di cortesia</p>
              </div>
            )}

            {!loading && clienti.length > 0 && (
              <div className="flex-1 p-4 space-y-2">
                <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide mb-1">Elenco clienti</p>
                {clienti.map(c => {
                  const inviato = inviati.has(c.clienteId);
                  return (
                    <div key={c.clienteId} className={`rounded-xl border overflow-hidden transition-colors ${inviato ? 'border-emerald-200 bg-emerald-50' : 'border-stone-200 bg-white hover:border-stone-300'}`}>
                      <div className="flex items-center gap-3 px-3 py-2.5">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${inviato ? 'bg-emerald-200 text-emerald-800' : 'bg-blue-100 text-blue-700'}`}>
                          {inviato ? <Check size={14} /> : (c.nome.charAt(0) + c.cognome.charAt(0)).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-semibold text-stone-800 truncate">{c.nome} {c.cognome}</p>
                            {inviato && <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded-full flex-shrink-0">Inviato</span>}
                          </div>
                          <p className="text-[11px] text-stone-400 truncate">{c.telefono ?? 'Nessun telefono'}</p>
                        </div>
                        {c.telefono ? (
                          <button
                            onClick={() => handleInvia(c.clienteId)}
                            className={`flex items-center gap-1 px-2.5 py-1.5 text-white text-xs font-semibold rounded-lg transition-colors flex-shrink-0 ${inviato ? 'bg-emerald-400 hover:bg-emerald-500' : 'bg-[#25D366] hover:bg-[#1ebe5d]'}`}
                          >
                            <WaIcon className="w-3.5 h-3.5 fill-white" />
                            {inviato ? 'Reinvia' : 'Invia'}
                          </button>
                        ) : (
                          <span className="text-xs text-stone-400 flex-shrink-0">No tel</span>
                        )}
                      </div>
                      {/* Testo editabile per questa cliente */}
                      <div className="px-3 pb-3">
                        <textarea
                          value={drafts[c.clienteId] ?? c.testo}
                          onChange={e => setDrafts(prev => ({ ...prev, [c.clienteId]: e.target.value }))}
                          rows={3}
                          className="w-full text-[11px] text-stone-600 bg-stone-50 border border-stone-100 rounded-lg px-2.5 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-blue-200 transition-colors"
                        />
                        <p className="text-[10px] text-stone-400 mt-1">
                          Link: <span className="font-mono text-blue-400">{siteOrigin}/recensioni?id={c.clienteId.slice(0, 8)}...</span>
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Invia a tutti (solo wa web) */}
            {waMode === 'web' && hasMultiRimanenti && (
              <div className="p-4 border-t border-stone-100 flex-shrink-0 space-y-2">
                {queueClienteId ? (
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-stone-500">
                      <span>Inviati {inviati.size} di {clienti.filter(c => c.telefono).length}</span>
                      <span>{Math.round((inviati.size / clienti.filter(c => c.telefono).length) * 100)}%</span>
                    </div>
                    <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
                      <div className="h-full bg-[#25D366] rounded-full transition-all" style={{ width: `${(inviati.size / clienti.filter(c => c.telefono).length) * 100}%` }} />
                    </div>
                    {clienti.find((c, i) => {
                      const currIdx = clienti.findIndex(x => x.clienteId === queueClienteId);
                      return i > currIdx && c.telefono && !inviati.has(c.clienteId);
                    }) ? (
                      <button onClick={nextQueue} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#25D366] hover:bg-[#1ebe5d] text-white text-sm font-semibold transition-colors">
                        <WaIcon className="w-4 h-4 fill-white" />
                        Apri prossima chat
                      </button>
                    ) : (
                      <button onClick={() => setQueueClienteId(null)} className="w-full py-2.5 rounded-xl bg-stone-100 text-stone-600 text-sm font-semibold">
                        <Check size={14} className="inline mr-2" />Completato
                      </button>
                    )}
                  </div>
                ) : (
                  <button onClick={startQueue} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#25D366] hover:bg-[#1ebe5d] text-white text-sm font-semibold transition-colors shadow-sm">
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
          <button onClick={onClose} className="w-full py-3 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-2xl text-sm font-semibold transition-colors">
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
}
