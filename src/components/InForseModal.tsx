import { AlertCircle, ExternalLink, HelpCircle, MessageCircle, X } from 'lucide-react';
import { dbSelectWithRelated } from '../lib/localDb';
import { apriWhatsApp } from '../lib/waUtils';

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

function buildInForseMessaggio(nome: string, appImmediato: { data: string; ora: string }, altriApp: { data: string; ora: string }[]): string {
  if (altriApp.length === 0) {
    return DEFAULT_IN_FORSE_TEMPLATE
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

export function InForseModal({ clienti, onClose }: InForseModalProps) {
  const dopodomani = addDays(new Date(), 2);
  const dopodomaniLabel = dopodomani.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center">
              <HelpCircle size={16} className="text-amber-600" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-stone-800">Conferma appuntamenti in forse</h2>
              <p className="text-xs text-stone-400 capitalize">{dopodomaniLabel}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-stone-100 rounded-lg transition-colors">
            <X size={16} className="text-stone-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
          {clienti.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-12 h-12 rounded-2xl bg-stone-100 flex items-center justify-center mb-3">
                <AlertCircle size={20} className="text-stone-400" />
              </div>
              <p className="text-sm font-medium text-stone-600">Nessun appuntamento in forse tra 2 giorni</p>
            </div>
          ) : (
            <>
              <p className="text-xs text-stone-500 pb-1">
                {clienti.length} client{clienti.length === 1 ? 'e' : 'i'} con appuntamento in forse tra 2 giorni. Clicca WhatsApp per chiedere conferma.
              </p>
              {clienti.map((c, i) => {
                const testo = buildInForseMessaggio(c.nome, c.appImmediato, c.altriApp);
                return (
                  <div key={i} className="bg-stone-50 border border-stone-200 rounded-xl overflow-hidden">
                    <div className="flex items-center gap-3 px-4 py-3">
                      <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0 text-sm font-bold text-amber-700">
                        {c.nome[0]?.toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-stone-800">{c.nome}</p>
                        <p className="text-xs text-stone-400">
                          {c.telefono} · {c.appImmediato.data} alle {c.appImmediato.ora}
                          {c.altriApp.length > 0 && <span className="ml-1 text-amber-500">+{c.altriApp.length} altri</span>}
                        </p>
                      </div>
                      <button
                        onClick={() => { apriWhatsApp(c.telefono, testo); onClose(); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold rounded-lg transition-colors flex-shrink-0"
                      >
                        <MessageCircle size={13} />
                        WhatsApp
                        <ExternalLink size={10} className="opacity-70" />
                      </button>
                    </div>
                    <div className="px-4 pb-3">
                      <p className="text-[11px] text-stone-400 whitespace-pre-wrap leading-relaxed bg-white border border-stone-100 rounded-lg px-3 py-2">{testo}</p>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t border-stone-100 flex-shrink-0">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl border border-stone-200 text-sm font-medium text-stone-600 hover:bg-stone-50 transition-colors"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
}
