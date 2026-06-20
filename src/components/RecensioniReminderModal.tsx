import { useState, useEffect } from 'react';
import { X, Send, Star, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { analizzaVociWithMap, getTestoKey, getDefaultTesto } from '../lib/recensioniUtils';
import { apriWhatsApp } from '../lib/waUtils';

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

export default function RecensioniReminderModal({ userId, onClose }: Props) {
  const [clienti, setClienti] = useState<ClienteRecensione[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [siteOrigin, setSiteOrigin] = useState('');

  useEffect(() => {
    setSiteOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    loadClienti();
  }, [userId]);

  async function loadClienti() {
    setLoading(true);
    try {
      // Range: da ieri 00:00 ora di Roma fino ad adesso
      // Questo include convalidazioni notturne (es. 01:00 di oggi = fine serata di ieri)
      const now = new Date();
      const romeNow = now.toLocaleString('sv-SE', { timeZone: 'Europe/Rome' });
      const todayKey = romeNow.split(' ')[0]; // "2026-06-20"
      // Calcola ieri come chiave YYYY-MM-DD
      const yesterdayKey = (() => {
        const d = new Date(`${todayKey}T12:00:00Z`);
        d.setUTCDate(d.getUTCDate() - 1);
        return d.toISOString().split('T')[0];
      })();
      // Converti mezzanotte di ieri ora Roma → UTC
      // Tecnica: crea il timestamp come se fosse UTC, poi trova l'offset effettivo di Roma
      const romeToUtc = (dateKey: string): string => {
        const naive = new Date(`${dateKey}T00:00:00Z`);
        const romeStr = naive.toLocaleString('sv-SE', { timeZone: 'Europe/Rome' });
        const naiveRome = new Date(romeStr.replace(' ', 'T') + 'Z');
        const offsetMs = naive.getTime() - naiveRome.getTime();
        return new Date(naive.getTime() - offsetMs).toISOString();
      };
      const yesterdayStart = romeToUtc(yesterdayKey);
      // Fine range = mezzanotte di oggi ora Roma (fine della giornata di ieri)
      const yesterdayEnd = romeToUtc(todayKey);

      // Carica fiches convalidate ieri (incluse convalidazioni notturne di oggi)
      const { data: fiches } = await supabase
        .from('fiches')
        .select('id, cliente_id, clienti(id, nome, cognome, telefono, recensione_lasciata, data_blocco_recensione)')
        .eq('user_id', userId)
        .eq('convalidata', true)
        .gte('convalidata_at', yesterdayStart)
        .lte('convalidata_at', yesterdayEnd)
        .is('deleted_at', null)
        .order('convalidata_at', { ascending: false });

      if (!fiches || fiches.length === 0) {
        setLoading(false);
        return;
      }

      // Carica varianti testi personalizzati (categorie standard)
      const { data: variantiDb } = await supabase
        .from('testi_recensioni_dinamici')
        .select('categoria_principale,has_taglio,testo_completo')
        .eq('user_id', userId);
      const variantiMap: Record<string, string> = {};
      for (const v of (variantiDb ?? []) as { categoria_principale: string; has_taglio: boolean; testo_completo: string }[]) {
        variantiMap[getTestoKey(v.categoria_principale as any, v.has_taglio)] = v.testo_completo;
      }

      // Carica mappa DB: nome servizio → categoria_recensione
      const { data: trattamentiDb } = await supabase
        .from('trattamenti_catalogo')
        .select('nome,categoria_recensione')
        .eq('user_id', userId);
      const serviceMap: Record<string, string> = {};
      for (const t of (trattamentiDb ?? []) as { nome: string; categoria_recensione: string | null }[]) {
        if (t.categoria_recensione) serviceMap[t.nome.toLowerCase()] = t.categoria_recensione;
      }

      // Carica testi categorie personalizzate
      const { data: customCatsDb } = await supabase
        .from('recensioni_categorie')
        .select('slug,testo_con_taglio,testo_senza_taglio')
        .eq('user_id', userId);
      const customCatMap: Record<string, { con: string; senza: string }> = {};
      for (const c of (customCatsDb ?? []) as { slug: string; testo_con_taglio: string | null; testo_senza_taglio: string | null }[]) {
        customCatMap[c.slug] = { con: c.testo_con_taglio ?? '', senza: c.testo_senza_taglio ?? '' };
      }

      // Deduplica per cliente_id, prendi l'ultima fiche
      const seen = new Set<string>();
      const uniqueFiches: typeof fiches = [];
      for (const f of fiches) {
        const cid = (f as any).cliente_id;
        if (!seen.has(cid)) { seen.add(cid); uniqueFiches.push(f); }
      }

      // Per ogni fiche, carica le voci
      const result: ClienteRecensione[] = [];
      for (const f of uniqueFiches) {
        const clienteRaw = (f as any).clienti as {
          id: string; nome: string; cognome: string; telefono: string | null;
          recensione_lasciata: boolean; data_blocco_recensione: string | null;
        } | null;
        if (!clienteRaw) continue;

        const recLasciata = clienteRaw.recensione_lasciata ?? false;
        const bloccataFino = clienteRaw.data_blocco_recensione
          ? new Date(clienteRaw.data_blocco_recensione)
          : null;

        // Salta chi ha già recensito o è in blocco
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

        // Cerca testo: prima varianti custom standard, poi categorie personalizzate, poi default
        let testo = variantiMap[key];
        if (!testo && customCatMap[categoria]) {
          const entry = customCatMap[categoria];
          testo = hasTaglio ? (entry.con || entry.senza) : (entry.senza || entry.con);
        }
        if (!testo) testo = getDefaultTesto(categoria as any, hasTaglio);

        result.push({
          clienteId: clienteRaw.id,
          nome: clienteRaw.nome,
          cognome: clienteRaw.cognome,
          telefono: clienteRaw.telefono,
          testo,
          categoria,
          hasTaglio,
          recensioneLasciata: recLasciata,
          bloccataFino,
        });
      }

      setClienti(result);
      const draftsInit: Record<string, string> = {};
      for (const c of result) draftsInit[c.clienteId] = c.testo;
      setDrafts(draftsInit);
    } finally {
      setLoading(false);
    }
  }

  async function handleInvia(clienteId: string) {
    const cliente = clienti.find(c => c.clienteId === clienteId);
    if (!cliente?.telefono) return;

    const link = `${siteOrigin}/recensioni?id=${clienteId}`;
    const testo = (drafts[clienteId] ?? cliente.testo) + `\n\n${link}`;
    apriWhatsApp(cliente.telefono, testo);

    // Traccia solo la data di invio, senza bloccare la cliente
    await supabase.rpc('segna_invio_recensione', { p_cliente_id: clienteId });

    // Rimuove il cliente dalla lista; chiude il modal se era l'ultimo
    setClienti(prev => {
      const next = prev.filter(c => c.clienteId !== clienteId);
      if (next.length === 0) onClose();
      return next;
    });
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">

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

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {loading && (
            <div className="flex items-center justify-center h-32">
              <div className="w-7 h-7 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {!loading && clienti.length === 0 && (
            <div className="text-center py-12 space-y-2">
              <div className="text-3xl">⭐</div>
              <p className="text-sm font-semibold text-stone-600">Nessuna cliente da contattare</p>
              <p className="text-xs text-stone-400">Tutte le clienti di ieri hanno già recensito o sono in periodo di cortesia</p>
            </div>
          )}

          {clienti.map(c => (
            <div
              key={c.clienteId}
              className="rounded-2xl border border-stone-200 bg-white shadow-sm transition-all"
            >
              {/* Cliente row */}
              <div className="flex items-center gap-3 px-4 py-3.5">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 font-semibold text-sm bg-stone-100 text-stone-600">
                  {(c.nome.charAt(0) + c.cognome.charAt(0)).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-stone-800 truncate">{c.nome} {c.cognome}</p>
                  <p className="text-xs text-stone-400 truncate">{c.telefono ?? 'Nessun telefono'}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => setExpanded(expanded === c.clienteId ? null : c.clienteId)}
                    className="p-1.5 hover:bg-stone-100 rounded-lg transition-colors text-stone-400"
                    title="Anteprima testo"
                  >
                    {expanded === c.clienteId ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                  {c.telefono ? (
                    <button
                      onClick={() => handleInvia(c.clienteId)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-semibold transition-colors"
                    >
                      <Send size={11} /> Invia WA
                    </button>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-stone-400">
                      <AlertCircle size={11} /> No tel
                    </span>
                  )}
                </div>
              </div>

              {/* Anteprima testo */}
              {expanded === c.clienteId && (
                <div className="px-4 pb-4 border-t border-stone-100 space-y-2">
                  <div className="flex items-center justify-between pt-3">
                    <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Testo del messaggio</p>
                    {editingId !== c.clienteId ? (
                      <button
                        onClick={() => setEditingId(c.clienteId)}
                        className="text-xs text-blue-600 hover:text-blue-700 font-semibold"
                      >
                        Modifica
                      </button>
                    ) : (
                      <button
                        onClick={() => setEditingId(null)}
                        className="text-xs text-stone-400 hover:text-stone-600"
                      >
                        Chiudi
                      </button>
                    )}
                  </div>
                  {editingId === c.clienteId ? (
                    <textarea
                      value={drafts[c.clienteId] ?? c.testo}
                      onChange={e => setDrafts(prev => ({ ...prev, [c.clienteId]: e.target.value }))}
                      rows={8}
                      className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-xs text-stone-700 focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none leading-relaxed"
                    />
                  ) : (
                    <div className="bg-stone-50 rounded-xl px-3 py-2.5 max-h-32 overflow-y-auto">
                      <p className="text-xs text-stone-600 leading-relaxed whitespace-pre-line">{drafts[c.clienteId] ?? c.testo}</p>
                    </div>
                  )}
                  <p className="text-xs text-stone-400">
                    Link inviato: <span className="text-blue-500 font-mono">{siteOrigin}/recensioni?id={c.clienteId.slice(0, 8)}...</span>
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-stone-100 flex-shrink-0">
          <button
            onClick={onClose}
            className="w-full py-3 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-2xl text-sm font-semibold transition-colors"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
}
