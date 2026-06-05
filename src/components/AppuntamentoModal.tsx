import { useEffect, useState, useRef, useCallback } from 'react';
import { X, Plus, Trash2, ShieldOff, AlertTriangle } from 'lucide-react';
import { localDateStr, type Cliente, type TrattamentoCatalogo, type StatoAppuntamento, type Parrucchiere } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { dbSelect, dbInsert, dbUpdate, dbDelete } from '../lib/localDb';

interface ServizioRow {
  parrucchiere_id: string;
  trattamento_id: string;
  nome_trattamento: string;
  durata_minuti: number;
  prezzo: number;
}

interface AppuntamentoForm {
  cliente_id: string;
  data: string;
  ora: string;
  stato: StatoAppuntamento;
  note: string;
  servizi: ServizioRow[];
}

interface Props {
  appuntamentoId?: string | null;
  dataIniziale?: Date;
  parrucchiereId?: string;
  onClose: () => void;
  onSaved: () => void;
}

const statoOptions: { value: StatoAppuntamento; label: string }[] = [
  { value: 'in_attesa', label: 'In attesa' },
  { value: 'confermato', label: 'Confermato' },
  { value: 'completato', label: 'Completato' },
  { value: 'cancellato', label: 'Cancellato' },
];

function toDateInput(d: Date) { return localDateStr(d); }
function toTimeInput(d: Date) { return d.toTimeString().slice(0, 5); }

function addMinutes(time: string, mins: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + mins;
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function emptyServizio(parrucchiereId = ''): ServizioRow {
  return { parrucchiere_id: parrucchiereId, trattamento_id: '', nome_trattamento: '', durata_minuti: 30, prezzo: 0 };
}

export default function AppuntamentoModal({ appuntamentoId, dataIniziale, parrucchiereId, onClose, onSaved }: Props) {
  const { user } = useAuth();
  const [clienti, setClienti] = useState<Cliente[]>([]);
  const [catalogo, setCatalogo] = useState<TrattamentoCatalogo[]>([]);
  const [parrucchieri, setParrucchieri] = useState<Parrucchiere[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [blacklistWarning, setBlacklistWarning] = useState<{ motivo: string } | null>(null);

  const [clienteSearch, setClienteSearch] = useState('');
  const [clienteDropdown, setClienteDropdown] = useState(false);
  const clienteRef = useRef<HTMLDivElement>(null);
  const [parrDropdownIdx, setParrDropdownIdx] = useState<number | null>(null);
  const parrDropdownRef = useRef<HTMLDivElement>(null);

  const now = dataIniziale ?? new Date();
  const [form, setForm] = useState<AppuntamentoForm>({
    cliente_id: '',
    data: toDateInput(now),
    ora: toTimeInput(now),
    stato: 'confermato',
    note: '',
    servizi: [emptyServizio(parrucchiereId ?? '')],
  });

  useEffect(() => {
    loadOptions();
    if (appuntamentoId) loadAppuntamento();
  }, [appuntamentoId]);

  // Close dropdowns on outside click
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (clienteRef.current && !clienteRef.current.contains(e.target as Node)) {
        setClienteDropdown(false);
      }
      if (parrDropdownRef.current && !parrDropdownRef.current.contains(e.target as Node)) {
        setParrDropdownIdx(null);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  async function loadOptions() {
    const [clRes, catRes, parrRes] = await Promise.all([
      dbSelect({ table: 'clienti', orderBy: [{ col: 'cognome', asc: true }], columns: 'id, nome, cognome, in_blacklist, motivo_blacklist' }),
      dbSelect({ table: 'trattamenti_catalogo', filters: [{ col: 'attivo', op: 'eq', val: true }], orderBy: [{ col: 'nome', asc: true }] }),
      dbSelect({ table: 'parrucchieri', filters: [{ col: 'attivo', op: 'eq', val: true }], orderBy: [{ col: 'nome', asc: true }] }),
    ]);
    setClienti((clRes.data || []) as Cliente[]);
    setCatalogo((catRes.data || []) as TrattamentoCatalogo[]);
    setParrucchieri((parrRes.data || []) as Parrucchiere[]);
  }

  async function loadAppuntamento() {
    const { data: appRes } = await dbSelect({ table: 'appuntamenti', filters: [{ col: 'id', op: 'eq', val: appuntamentoId }] });
    const appData = appRes?.[0] as any;
    if (!appData) return;
    const d = new Date(appData.data_ora);

    // find cliente name for search field
    const cl = clienti.find(c => c.id === appData.cliente_id);
    if (cl) setClienteSearch(`${cl.cognome} ${cl.nome}`);

    const { data: trattRes } = await dbSelect({ table: 'appuntamento_trattamenti', filters: [{ col: 'appuntamento_id', op: 'eq', val: appuntamentoId }] });
    const trattamenti = (trattRes || []) as { trattamento_id: string; nome_trattamento: string; prezzo: number }[];
    const parrId = appData.parrucchiere_id ?? '';

    setForm({
      cliente_id: appData.cliente_id ?? '',
      data: toDateInput(d),
      ora: toTimeInput(d),
      stato: appData.stato,
      note: appData.note ?? '',
      servizi: trattamenti.length > 0
        ? trattamenti.map(t => ({
            parrucchiere_id: parrId,
            trattamento_id: t.trattamento_id ?? '',
            nome_trattamento: t.nome_trattamento,
            durata_minuti: 30,
            prezzo: t.prezzo,
          }))
        : [emptyServizio(parrId)],
    });
  }

  // Re-populate cliente search when clienti load after loadAppuntamento
  useEffect(() => {
    if (form.cliente_id && clienti.length > 0 && !clienteSearch) {
      const cl = clienti.find(c => c.id === form.cliente_id);
      if (cl) setClienteSearch(`${cl.cognome} ${cl.nome}`);
    }
  }, [clienti]);

  async function selectCliente(c: Cliente) {
    setForm(f => ({ ...f, cliente_id: c.id }));
    setClienteSearch(`${c.cognome} ${c.nome}`);
    setClienteDropdown(false);
    // Verifica blacklist fresca dal DB (SQLite in Electron, Supabase in browser).
    // Se offline su browser, data sarà null e si usa il dato già in memoria.
    const { data } = await dbSelect<Cliente>({
      table: 'clienti',
      columns: 'in_blacklist, motivo_blacklist',
      filters: [{ col: 'id', op: 'eq', val: c.id }],
      limit: 1,
    });
    const checked = data?.[0] ?? c;
    if (checked.in_blacklist) {
      setBlacklistWarning({ motivo: checked.motivo_blacklist || '' });
    } else {
      setBlacklistWarning(null);
    }
  }

  const clientiFiltrati = clienteSearch.trim().length > 0
    ? clienti.filter(c => `${c.cognome} ${c.nome}`.toLowerCase().includes(clienteSearch.toLowerCase()))
    : clienti.slice(0, 20);

  function updateServizio(idx: number, patch: Partial<ServizioRow>) {
    setForm(f => {
      const servizi = f.servizi.map((s, i) => i === idx ? { ...s, ...patch } : s);
      return { ...f, servizi };
    });
  }

  function addServizio() {
    const lastParr = form.servizi[form.servizi.length - 1]?.parrucchiere_id ?? '';
    setForm(f => ({ ...f, servizi: [...f.servizi, emptyServizio(lastParr)] }));
  }

  function removeServizio(idx: number) {
    setForm(f => ({ ...f, servizi: f.servizi.filter((_, i) => i !== idx) }));
  }

  function onServizioChange(idx: number, trattamentoId: string) {
    const cat = catalogo.find(c => c.id === trattamentoId);
    if (cat) {
      updateServizio(idx, { trattamento_id: cat.id, nome_trattamento: cat.nome, prezzo: cat.prezzo });
    } else {
      updateServizio(idx, { trattamento_id: '', nome_trattamento: '', prezzo: 0 });
    }
  }

  function getSlotTimes(): { start: string; end: string }[] {
    const times: { start: string; end: string }[] = [];
    let cursor = form.ora;
    for (const s of form.servizi) {
      const end = addMinutes(cursor, s.durata_minuti);
      times.push({ start: cursor, end });
      cursor = end;
    }
    return times;
  }

  function prezzoTotale() {
    return form.servizi.reduce((s, t) => s + t.prezzo, 0);
  }

  async function handleSave() {
    if (!form.cliente_id) { setError('Seleziona un cliente'); return; }
    if (!form.data || !form.ora) { setError('Inserisci data e ora'); return; }
    setSaving(true);
    setError('');

    const durataTotale = form.servizi.reduce((s, sv) => s + sv.durata_minuti, 0);
    const parrucchiereId = form.servizi[0]?.parrucchiere_id || null;
    const data_ora = new Date(`${form.data}T${form.ora}:00`).toISOString();

    const payload = {
      cliente_id: form.cliente_id,
      parrucchiere_id: parrucchiereId,
      data_ora,
      durata_minuti: durataTotale || 30,
      stato: form.stato,
      note: form.note,
      prezzo_totale: prezzoTotale(),
      updated_at: new Date().toISOString(),
    };

    let appId = appuntamentoId;
    if (appId) {
      await dbUpdate({ table: 'appuntamenti', id: appId as string, data: payload });
      await dbDelete({ table: 'appuntamento_trattamenti', filters: [{ col: 'appuntamento_id', op: 'eq', val: appId }] });
    } else {
      const { data } = await dbInsert({ table: 'appuntamenti', data: { ...payload, user_id: user?.id } });
      if (data) appId = (data as any).id;
    }

    const serviziConNome = form.servizi.filter(s => s.nome_trattamento);
    if (appId && serviziConNome.length > 0) {
      for (const s of serviziConNome) {
        await dbInsert({ table: 'appuntamento_trattamenti', data: {
          appuntamento_id: appId,
          trattamento_id: s.trattamento_id || null,
          nome_trattamento: s.nome_trattamento,
          prezzo: s.prezzo,
          user_id: user?.id,
        } });
      }
    }

    setSaving(false);
    onSaved();
  }

  const slotTimes = getSlotTimes();

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 flex-shrink-0">
          <h2 className="font-bold text-stone-800 text-lg">
            {appuntamentoId ? 'Modifica Appuntamento' : 'Nuovo Appuntamento'}
          </h2>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-700 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Date/time row */}
        <div className="px-6 pt-4 pb-2 flex items-center gap-3 flex-shrink-0">
          <input
            type="date"
            value={form.data}
            onChange={e => setForm(f => ({ ...f, data: e.target.value }))}
            className="border border-stone-200 rounded-lg px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
          <span className="text-stone-300 font-medium">·</span>
          <input
            type="time"
            value={form.ora}
            onChange={e => setForm(f => ({ ...f, ora: e.target.value }))}
            className="border border-stone-200 rounded-lg px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </div>

        <div className="overflow-auto px-6 py-4 space-y-5 flex-1 min-h-0">
          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          {/* Avviso blacklist */}
          {blacklistWarning && (
            <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 flex gap-3">
              <ShieldOff size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-red-700">Cliente in lista nera</p>
                {blacklistWarning.motivo && (
                  <p className="text-xs text-red-600 mt-0.5">{blacklistWarning.motivo}</p>
                )}
                <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                  <AlertTriangle size={11} /> Puoi comunque procedere con la prenotazione.
                </p>
              </div>
            </div>
          )}

          {/* Cliente */}
          <div>
            <label className="block text-xs font-semibold text-stone-500 mb-1.5 uppercase tracking-wide">Cliente *</label>
            <div ref={clienteRef} className="relative">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-300">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
                </span>
                <input
                  type="text"
                  value={clienteSearch}
                  onChange={e => { setClienteSearch(e.target.value); setClienteDropdown(true); if (!e.target.value) setForm(f => ({ ...f, cliente_id: '' })); }}
                  onFocus={() => setClienteDropdown(true)}
                  placeholder="Scrivi nome o cognome..."
                  className="w-full border border-stone-200 rounded-xl pl-9 pr-3 py-2.5 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-400 placeholder:text-stone-400"
                />
              </div>
              {clienteDropdown && clientiFiltrati.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-stone-200 rounded-xl shadow-lg z-10 max-h-48 overflow-y-auto">
                  {clientiFiltrati.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onMouseDown={e => { e.preventDefault(); selectCliente(c); }}
                      className={`w-full text-left px-3 py-2 text-sm transition-colors first:rounded-t-xl last:rounded-b-xl flex items-center gap-2 ${c.in_blacklist ? 'text-red-700 hover:bg-red-50' : 'text-stone-700 hover:bg-amber-50 hover:text-amber-700'}`}
                    >
                      <span className="flex-1">{c.cognome} {c.nome}</span>
                      {c.in_blacklist && <ShieldOff size={12} className="text-red-500 flex-shrink-0" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Servizi */}
          <div>
            <label className="block text-xs font-semibold text-stone-500 mb-2 uppercase tracking-wide">Servizi</label>
            <div className="space-y-3">
              {form.servizi.map((s, idx) => (
                <div key={idx} className="border border-stone-200 rounded-xl overflow-hidden">
                  {/* Slot header */}
                  {(() => {
                    const pSel = parrucchieri.find(p => p.id === s.parrucchiere_id);
                    return (
                      <div className="flex items-center justify-between px-3 py-2 bg-stone-50 border-b border-stone-200">
                        <div className="flex items-center gap-2">
                          {pSel && <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: pSel.colore }} />}
                          <span className="text-xs font-bold text-stone-500">{idx + 1}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-stone-400 font-medium">
                            {slotTimes[idx].start} → {slotTimes[idx].end}
                          </span>
                          {form.servizi.length > 1 && (
                            <button onClick={() => removeServizio(idx)} className="text-stone-300 hover:text-red-400 transition-colors ml-1">
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Service fields */}
                  <div className="p-3 grid grid-cols-2 gap-3">
                    {/* Parrucchiere custom dropdown */}
                    <div ref={parrDropdownIdx === idx ? parrDropdownRef : undefined}>
                      <label className="block text-[10px] font-semibold text-stone-400 mb-1 uppercase tracking-wide">Parrucchiere</label>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setParrDropdownIdx(parrDropdownIdx === idx ? null : idx)}
                          className="w-full flex items-center gap-2 border border-stone-200 rounded-lg px-2.5 py-1.5 text-xs text-stone-800 bg-white hover:border-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-400 text-left"
                        >
                          {(() => {
                            const p = parrucchieri.find(p => p.id === s.parrucchiere_id);
                            return p ? (
                              <>
                                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.colore }} />
                                <span className="flex-1 truncate">{p.nome}</span>
                              </>
                            ) : (
                              <span className="flex-1 text-stone-400">Scegli...</span>
                            );
                          })()}
                          <svg className="w-3 h-3 text-stone-400 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd"/></svg>
                        </button>
                        {parrDropdownIdx === idx && (
                          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-stone-200 rounded-lg shadow-lg z-20">
                            <button
                              type="button"
                              onMouseDown={e => { e.preventDefault(); updateServizio(idx, { parrucchiere_id: '' }); setParrDropdownIdx(null); }}
                              className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-stone-400 hover:bg-stone-50 first:rounded-t-lg"
                            >
                              Scegli...
                            </button>
                            {parrucchieri.map(p => (
                              <button
                                key={p.id}
                                type="button"
                                onMouseDown={e => { e.preventDefault(); updateServizio(idx, { parrucchiere_id: p.id }); setParrDropdownIdx(null); }}
                                className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-stone-800 hover:bg-amber-50 hover:text-amber-700 last:rounded-b-lg transition-colors"
                              >
                                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.colore }} />
                                {p.nome}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Servizio */}
                    <div>
                      <label className="block text-[10px] font-semibold text-stone-400 mb-1 uppercase tracking-wide">Servizio</label>
                      <select
                        value={s.trattamento_id}
                        onChange={e => onServizioChange(idx, e.target.value)}
                        className="w-full border border-stone-200 rounded-lg px-2.5 py-1.5 text-xs text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                      >
                        <option value="">Scegli...</option>
                        {catalogo.map(c => (
                          <option key={c.id} value={c.id}>{c.nome}</option>
                        ))}
                      </select>
                    </div>

                    {/* Durata */}
                    <div>
                      <label className="block text-[10px] font-semibold text-stone-400 mb-1 uppercase tracking-wide">Durata (min)</label>
                      <input
                        type="number"
                        min={5}
                        step={5}
                        value={s.durata_minuti}
                        onChange={e => updateServizio(idx, { durata_minuti: parseInt(e.target.value) || 30 })}
                        onFocus={e => e.target.select()}
                        className="w-full border border-stone-200 rounded-lg px-2.5 py-1.5 text-xs text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
                      />
                    </div>

                    {/* Prezzo */}
                    <div>
                      <label className="block text-[10px] font-semibold text-stone-400 mb-1 uppercase tracking-wide">Prezzo (€)</label>
                      <input
                        type="number"
                        min={0}
                        step={0.5}
                        value={s.prezzo}
                        onChange={e => updateServizio(idx, { prezzo: parseFloat(e.target.value) || 0 })}
                        onFocus={e => e.target.select()}
                        className="w-full border border-stone-200 rounded-lg px-2.5 py-1.5 text-xs text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Add service */}
            <button
              type="button"
              onClick={addServizio}
              className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-stone-300 text-stone-500 hover:border-amber-400 hover:text-amber-600 hover:bg-amber-50 text-sm font-medium transition-all"
            >
              <Plus size={15} />
              Aggiungi servizio
            </button>

            {form.servizi.filter(s => s.nome_trattamento).length > 1 && (
              <div className="flex justify-end mt-2 pr-1">
                <span className="text-sm font-bold text-stone-700">Totale: €{prezzoTotale().toFixed(2)}</span>
              </div>
            )}
          </div>

          {/* Stato e Note */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-500 mb-1.5 uppercase tracking-wide">Stato</label>
              <select
                value={form.stato}
                onChange={e => setForm(f => ({ ...f, stato: e.target.value as StatoAppuntamento }))}
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
              >
                {statoOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-500 mb-1.5 uppercase tracking-wide">Note</label>
              <input
                type="text"
                value={form.note}
                onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-stone-100 flex gap-3 justify-end flex-shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 text-sm font-medium text-stone-600 border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors"
          >
            Annulla
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 text-sm font-medium bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-50"
          >
            {saving ? 'Salvataggio...' : 'Salva appuntamento'}
          </button>
        </div>
      </div>
    </div>
  );
}
