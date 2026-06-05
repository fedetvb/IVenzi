import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { localDateStr, type SchedaColore } from '../lib/supabase';
import { dbSelect, dbInsert, dbUpdate } from '../lib/localDb';
import { useAuth } from '../lib/AuthContext';

interface Props {
  clienteId: string;
  schedaId?: string | null;
  onClose: () => void;
  onSaved: () => void;
}

interface SchedaForm {
  data_trattamento: string;
  colore_base: string;
  colore_target: string;
  tecnica: string;
  formula_colore: string;
  ossidante: string;
  tempo_posa: number;
  note: string;
}

const TECNICHE = [
  'Colorazione piena', 'Meches', 'Balayage', 'Shatush', 'Colpi di sole',
  'Tinta radici', 'Schiariture', 'Riflessante', 'Colore fantasia', 'Altro'
];

export default function SchedaColoreModal({ clienteId, schedaId, onClose, onSaved }: Props) {
  const { user } = useAuth();
  const [form, setForm] = useState<SchedaForm>({
    data_trattamento: localDateStr(),
    colore_base: '',
    colore_target: '',
    tecnica: '',
    formula_colore: '',
    ossidante: '',
    tempo_posa: 30,
    note: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (schedaId) loadScheda();
  }, [schedaId]);

  async function loadScheda() {
    const { data } = await dbSelect<SchedaColore>({
      table: 'schede_colore',
      filters: [{ col: 'id', op: 'eq', val: schedaId }],
      limit: 1,
    });
    const s = data?.[0];
    if (!s) return;
    setForm({
      data_trattamento: s.data_trattamento,
      colore_base: s.colore_base ?? '',
      colore_target: s.colore_target ?? '',
      tecnica: s.tecnica ?? '',
      formula_colore: s.formula_colore ?? '',
      ossidante: s.ossidante ?? '',
      tempo_posa: s.tempo_posa ?? 30,
      note: s.note ?? '',
    });
  }

  function setField<K extends keyof SchedaForm>(k: K, v: SchedaForm[K]) {
    setForm(f => ({ ...f, [k]: v }));
  }

  async function handleSave() {
    if (!form.data_trattamento) { setError('Inserisci la data del trattamento'); return; }
    setSaving(true);
    setError('');

    const payload = {
      cliente_id: clienteId,
      data_trattamento: form.data_trattamento,
      colore_base: form.colore_base,
      colore_target: form.colore_target,
      tecnica: form.tecnica,
      formula_colore: form.formula_colore,
      ossidante: form.ossidante,
      tempo_posa: form.tempo_posa,
      note: form.note,
      updated_at: new Date().toISOString(),
    };

    if (schedaId) {
      await dbUpdate({
        table: 'schede_colore',
        id: schedaId,
        data: payload,
      });
    } else {
      await dbInsert({
        table: 'schede_colore',
        data: { ...payload, user_id: user?.id },
      });
    }

    setSaving(false);
    onSaved();
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100">
          <h2 className="font-bold text-stone-800 text-lg">
            {schedaId ? 'Modifica Scheda Colore' : 'Nuova Scheda Colore'}
          </h2>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-700 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="overflow-auto px-6 py-5 space-y-4 flex-1">
          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wide">Data Trattamento *</label>
            <input
              type="date"
              value={form.data_trattamento}
              onChange={e => setField('data_trattamento', e.target.value)}
              className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wide">Tecnica</label>
            <select
              value={form.tecnica}
              onChange={e => setField('tecnica', e.target.value)}
              className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            >
              <option value="">Seleziona tecnica...</option>
              {TECNICHE.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wide">Colore di partenza</label>
              <input
                value={form.colore_base}
                onChange={e => setField('colore_base', e.target.value)}
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                placeholder="es. 5 castano chiaro"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wide">Colore desiderato</label>
              <input
                value={form.colore_target}
                onChange={e => setField('colore_target', e.target.value)}
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                placeholder="es. 7.3 biondo dorato"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wide">Formula colore</label>
            <textarea
              value={form.formula_colore}
              onChange={e => setField('formula_colore', e.target.value)}
              rows={2}
              className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
              placeholder="es. Wella 7/0 60g + 9% 60ml"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wide">Ossidante</label>
              <input
                value={form.ossidante}
                onChange={e => setField('ossidante', e.target.value)}
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                placeholder="es. 20 vol / 6%"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wide">Tempo di posa (min)</label>
              <input
                type="number"
                onInput={e => { const t = e.currentTarget; if (t.value.length > 1 && t.value.startsWith('0') && !t.value.startsWith('0.')) t.value = String(Number(t.value)); }}
                min={0}
                value={form.tempo_posa}
                onChange={e => setField('tempo_posa', parseInt(e.target.value) || 0)}
                onFocus={e => e.target.select()}
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wide">Note</label>
            <textarea
              value={form.note}
              onChange={e => setField('note', e.target.value)}
              rows={2}
              className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
              placeholder="Osservazioni, risultato, reazioni..."
            />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-stone-100 flex gap-3 justify-end">
          <button onClick={onClose} className="px-5 py-2 text-sm font-medium text-stone-600 border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors">
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
