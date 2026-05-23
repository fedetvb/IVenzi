import { useEffect, useState } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { supabase, localDateStr, type Cliente, type TrattamentoCatalogo, type StatoAppuntamento, type Parrucchiere } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';

interface AppuntamentoForm {
  cliente_id: string;
  parrucchiere_id: string;
  data: string;
  ora: string;
  durata_minuti: number;
  stato: StatoAppuntamento;
  note: string;
  trattamenti: { trattamento_id: string; nome_trattamento: string; prezzo: number }[];
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

function toDateInput(d: Date) {
  return localDateStr(d);
}
function toTimeInput(d: Date) {
  return d.toTimeString().slice(0, 5);
}

export default function AppuntamentoModal({ appuntamentoId, dataIniziale, parrucchiereId, onClose, onSaved }: Props) {
  const { user } = useAuth();
  const [clienti, setClienti] = useState<Cliente[]>([]);
  const [catalogo, setCatalogo] = useState<TrattamentoCatalogo[]>([]);
  const [parrucchieri, setParrucchieri] = useState<Parrucchiere[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const now = dataIniziale ?? new Date();
  const [form, setForm] = useState<AppuntamentoForm>({
    cliente_id: '',
    parrucchiere_id: parrucchiereId ?? '',
    data: toDateInput(now),
    ora: toTimeInput(now),
    durata_minuti: 60,
    stato: 'confermato',
    note: '',
    trattamenti: [],
  });

  useEffect(() => {
    loadOptions();
    if (appuntamentoId) loadAppuntamento();
  }, [appuntamentoId]);

  async function loadOptions() {
    const [{ data: cl }, { data: cat }, { data: parr }] = await Promise.all([
      supabase.from('clienti').select('id, nome, cognome').order('cognome'),
      supabase.from('trattamenti_catalogo').select('*').eq('attivo', true).order('nome'),
      supabase.from('parrucchieri').select('*').eq('attivo', true).order('nome'),
    ]);
    setClienti((cl || []) as Cliente[]);
    setCatalogo((cat || []) as TrattamentoCatalogo[]);
    setParrucchieri((parr || []) as Parrucchiere[]);
  }

  async function loadAppuntamento() {
    const { data } = await supabase
      .from('appuntamenti')
      .select('*, appuntamento_trattamenti(*)')
      .eq('id', appuntamentoId)
      .maybeSingle();
    if (!data) return;
    const d = new Date(data.data_ora);
    setForm({
      cliente_id: data.cliente_id ?? '',
      parrucchiere_id: data.parrucchiere_id ?? '',
      data: toDateInput(d),
      ora: toTimeInput(d),
      durata_minuti: data.durata_minuti,
      stato: data.stato,
      note: data.note ?? '',
      trattamenti: (data.appuntamento_trattamenti || []).map((t: { trattamento_id: string; nome_trattamento: string; prezzo: number }) => ({
        trattamento_id: t.trattamento_id ?? '',
        nome_trattamento: t.nome_trattamento,
        prezzo: t.prezzo,
      })),
    });
  }

  function addTrattamento(cat: TrattamentoCatalogo) {
    if (form.trattamenti.find(t => t.trattamento_id === cat.id)) return;
    setForm(f => ({
      ...f,
      trattamenti: [...f.trattamenti, { trattamento_id: cat.id, nome_trattamento: cat.nome, prezzo: cat.prezzo }],
    }));
  }

  function removeTrattamento(idx: number) {
    setForm(f => ({ ...f, trattamenti: f.trattamenti.filter((_, i) => i !== idx) }));
  }

  function prezzoTotale() {
    return form.trattamenti.reduce((s, t) => s + t.prezzo, 0);
  }

  async function handleSave() {
    if (!form.cliente_id) { setError('Seleziona un cliente'); return; }
    if (!form.data || !form.ora) { setError('Inserisci data e ora'); return; }
    setSaving(true);
    setError('');

    const data_ora = new Date(`${form.data}T${form.ora}:00`).toISOString();
    const payload = {
      cliente_id: form.cliente_id,
      parrucchiere_id: form.parrucchiere_id || null,
      data_ora,
      durata_minuti: form.durata_minuti,
      stato: form.stato,
      note: form.note,
      prezzo_totale: prezzoTotale(),
      updated_at: new Date().toISOString(),
    };

    let appId = appuntamentoId;
    if (appId) {
      await supabase.from('appuntamenti').update(payload).eq('id', appId);
      await supabase.from('appuntamento_trattamenti').delete().eq('appuntamento_id', appId);
    } else {
      const { data } = await supabase.from('appuntamenti').insert({ ...payload, user_id: user?.id }).select('id').single();
      appId = data?.id;
    }

    if (appId && form.trattamenti.length > 0) {
      await supabase.from('appuntamento_trattamenti').insert(
        form.trattamenti.map(t => ({
          appuntamento_id: appId,
          trattamento_id: t.trattamento_id || null,
          nome_trattamento: t.nome_trattamento,
          prezzo: t.prezzo,
          user_id: user?.id,
        }))
      );
    }

    setSaving(false);
    onSaved();
  }

  const selectedParr = parrucchieri.find(p => p.id === form.parrucchiere_id);

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100">
          <div className="flex items-center gap-3">
            {selectedParr && (
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: selectedParr.colore }} />
            )}
            <h2 className="font-bold text-stone-800 text-lg">
              {appuntamentoId ? 'Modifica Appuntamento' : 'Nuovo Appuntamento'}
            </h2>
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-700 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="overflow-auto px-6 py-5 space-y-4 flex-1">
          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          {/* Parrucchiere */}
          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wide">Parrucchiere</label>
            <div className="flex flex-wrap gap-2">
              {parrucchieri.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, parrucchiere_id: f.parrucchiere_id === p.id ? '' : p.id }))}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-medium transition-all"
                  style={{
                    borderColor: form.parrucchiere_id === p.id ? p.colore : '#e7e5e4',
                    backgroundColor: form.parrucchiere_id === p.id ? `${p.colore}20` : 'transparent',
                    color: form.parrucchiere_id === p.id ? p.colore : '#78716c',
                  }}
                >
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.colore }} />
                  {p.nome}
                </button>
              ))}
            </div>
          </div>

          {/* Cliente */}
          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wide">Cliente *</label>
            <select
              value={form.cliente_id}
              onChange={e => setForm(f => ({ ...f, cliente_id: e.target.value }))}
              className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
            >
              <option value="">Seleziona cliente...</option>
              {clienti.map(c => (
                <option key={c.id} value={c.id}>{c.cognome} {c.nome}</option>
              ))}
            </select>
          </div>

          {/* Data e Ora */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wide">Data *</label>
              <input
                type="date"
                value={form.data}
                onChange={e => setForm(f => ({ ...f, data: e.target.value }))}
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wide">Ora *</label>
              <input
                type="time"
                value={form.ora}
                onChange={e => setForm(f => ({ ...f, ora: e.target.value }))}
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
          </div>

          {/* Durata e Stato */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wide">Durata (min)</label>
              <input
                type="number"
                onInput={e => { const t = e.currentTarget; if (t.value.length > 1 && t.value.startsWith('0') && !t.value.startsWith('0.')) t.value = String(Number(t.value)); }}
                min={15}
                step={15}
                value={form.durata_minuti}
                onChange={e => setForm(f => ({ ...f, durata_minuti: parseInt(e.target.value) || 60 }))}
                onFocus={e => e.target.select()}
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wide">Stato</label>
              <select
                value={form.stato}
                onChange={e => setForm(f => ({ ...f, stato: e.target.value as StatoAppuntamento }))}
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
              >
                {statoOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          {/* Trattamenti */}
          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wide">Servizi</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {catalogo.map(cat => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => addTrattamento(cat)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors"
                  style={{
                    borderColor: form.trattamenti.find(t => t.trattamento_id === cat.id) ? cat.colore : '#e7e5e4',
                    backgroundColor: form.trattamenti.find(t => t.trattamento_id === cat.id) ? `${cat.colore}18` : 'transparent',
                  }}
                >
                  <Plus size={10} />
                  {cat.nome}
                </button>
              ))}
            </div>
            {form.trattamenti.length > 0 && (
              <div className="space-y-1.5">
                {form.trattamenti.map((t, i) => (
                  <div key={i} className="flex items-center justify-between bg-stone-50 rounded-lg px-3 py-2">
                    <span className="text-sm text-stone-700">{t.nome_trattamento}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-stone-700">€{t.prezzo.toFixed(2)}</span>
                      <button onClick={() => removeTrattamento(i)} className="text-stone-400 hover:text-red-500 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
                <div className="flex justify-end pt-1">
                  <span className="text-sm font-bold text-stone-800">Totale: €{prezzoTotale().toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Note */}
          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wide">Note</label>
            <textarea
              value={form.note}
              onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
              rows={2}
              className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
            />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-stone-100 flex gap-3 justify-end">
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
            {saving ? 'Salvataggio...' : 'Salva'}
          </button>
        </div>
      </div>
    </div>
  );
}
