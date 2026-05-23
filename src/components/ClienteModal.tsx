import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { supabase, type Cliente } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';

interface Props {
  clienteId?: string | null;
  onClose: () => void;
  onSaved: (id: string) => void;
}

interface ClienteForm {
  nome: string;
  cognome: string;
  telefono: string;
  email: string;
  data_nascita: string;
  note: string;
}

export default function ClienteModal({ clienteId, onClose, onSaved }: Props) {
  const { user } = useAuth();
  const [form, setForm] = useState<ClienteForm>({ nome: '', cognome: '', telefono: '', email: '', data_nascita: '', note: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (clienteId) loadCliente();
  }, [clienteId]);

  async function loadCliente() {
    const { data } = await supabase.from('clienti').select('*').eq('id', clienteId).maybeSingle();
    if (!data) return;
    const c = data as Cliente;
    setForm({
      nome: c.nome,
      cognome: c.cognome,
      telefono: c.telefono,
      email: c.email ?? '',
      data_nascita: c.data_nascita ?? '',
      note: c.note ?? '',
    });
  }

  function setField<K extends keyof ClienteForm>(k: K, v: ClienteForm[K]) {
    setForm(f => ({ ...f, [k]: v }));
  }

  async function handleSave() {
    if (!form.nome.trim() || !form.cognome.trim()) { setError('Nome e cognome sono obbligatori'); return; }
    setSaving(true);
    setError('');
    const payload = {
      nome: form.nome.trim(),
      cognome: form.cognome.trim(),
      telefono: form.telefono.trim(),
      email: form.email.trim(),
      data_nascita: form.data_nascita || null,
      note: form.note.trim(),
      updated_at: new Date().toISOString(),
    };

    let id = clienteId;
    if (id) {
      await supabase.from('clienti').update(payload).eq('id', id);
    } else {
      const { data } = await supabase.from('clienti').insert({ ...payload, user_id: user?.id }).select('id').single();
      id = data?.id;
    }
    setSaving(false);
    if (id) onSaved(id);
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100">
          <h2 className="font-bold text-stone-800 text-lg">
            {clienteId ? 'Modifica Cliente' : 'Nuovo Cliente'}
          </h2>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-700 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="overflow-auto px-6 py-5 space-y-4 flex-1">
          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wide">Nome *</label>
              <input
                value={form.nome}
                onChange={e => setField('nome', e.target.value)}
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                placeholder="Mario"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wide">Cognome *</label>
              <input
                value={form.cognome}
                onChange={e => setField('cognome', e.target.value)}
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                placeholder="Rossi"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wide">Telefono</label>
            <input
              value={form.telefono}
              onChange={e => setField('telefono', e.target.value)}
              type="tel"
              className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              placeholder="+39 333 1234567"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wide">Email</label>
            <input
              value={form.email}
              onChange={e => setField('email', e.target.value)}
              type="email"
              className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              placeholder="mario@email.it"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wide">Data di nascita</label>
            <input
              value={form.data_nascita}
              onChange={e => setField('data_nascita', e.target.value)}
              type="date"
              className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wide">Note</label>
            <textarea
              value={form.note}
              onChange={e => setField('note', e.target.value)}
              rows={3}
              className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
              placeholder="Allergie, preferenze, note generali..."
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
