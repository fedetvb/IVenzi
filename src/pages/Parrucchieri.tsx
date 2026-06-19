import { useEffect, useState, useCallback } from 'react';
import { Plus, CreditCard as Edit2, Trash2, X, Check, Calendar, UserX } from 'lucide-react';
import { supabase, type Parrucchiere } from '../lib/supabase';
import { dbSelect, dbInsert, dbUpdate, dbDelete } from '../lib/localDb';
import PasswordGateModal from '../components/PasswordGateModal';
import { useAuth } from '../lib/AuthContext';

interface ParrForm {
  nome: string;
  colore: string;
}

interface Assenza {
  id: string;
  parrucchiere_id: string;
  data_inizio: string;
  data_fine: string;
  ora_inizio: string | null;
  note: string;
}

const PRESET_COLORS = ['#EC4899', '#3B82F6', '#F59E0B', '#EF4444', '#10B981', '#F97316', '#06B6D4', '#6B7280'];

export default function Parrucchieri() {
  const { user } = useAuth();
  const [parrucchieri, setParrucchieri] = useState<Parrucchiere[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ open: boolean; id?: string }>({ open: false });
  const [form, setForm] = useState<ParrForm>({ nome: '', colore: '#3B82F6' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [eliminaParrGate, setEliminaParrGate] = useState<string | null>(null);

  // Assenze
  const [assenze, setAssenze] = useState<Assenza[]>([]);
  const [assenzeLoading, setAssenzeLoading] = useState(true);
  const [showAssenzaForm, setShowAssenzaForm] = useState(false);
  const [assenzaForm, setAssenzaForm] = useState({ parrucchiere_id: '', data_inizio: '', data_fine: '', ora_inizio: '', note: '' });
  const [savingAssenza, setSavingAssenza] = useState(false);
  const [assenzaError, setAssenzaError] = useState('');

  const loadParrucchieri = useCallback(async () => {
    setLoading(true);
    const res = await dbSelect({ table: 'parrucchieri', columns: '*', filters: [{col:'deleted_at', op:'is_null'}], orderBy: [{col:'nome'}] });
    setParrucchieri((res.data || []) as Parrucchiere[]);
    setLoading(false);
  }, []);

  async function loadAssenze() {
    setAssenzeLoading(true);
    const res = await dbSelect({ table: 'assenze_parrucchieri', columns: '*', orderBy: [{col:'data_inizio', asc:false}] });
    setAssenze((res.data || []) as Assenza[]);
    setAssenzeLoading(false);
  }

  useEffect(() => {
    loadParrucchieri();
    loadAssenze();
  }, [loadParrucchieri]);

  function openNew() {
    setForm({ nome: '', colore: '#3B82F6' });
    setError('');
    setModal({ open: true });
  }

  async function openEdit(p: Parrucchiere) {
    setForm({ nome: p.nome, colore: p.colore });
    setError('');
    setModal({ open: true, id: p.id });
  }

  async function handleSave() {
    if (!form.nome.trim()) { setError('Il nome è obbligatorio'); return; }
    setSaving(true);
    setError('');
    const payload = { nome: form.nome.trim(), colore: form.colore };
    if (modal.id) {
      await dbUpdate({ table: 'parrucchieri', id: modal.id, data: payload });
    } else {
      await dbInsert({ table: 'parrucchieri', data: { ...payload, attivo: true, user_id: user?.id } });
    }
    setSaving(false);
    setModal({ open: false });
    loadParrucchieri();
  }

  async function toggleAttivo(p: Parrucchiere) {
    await dbUpdate({ table: 'parrucchieri', id: p.id, data: { attivo: !p.attivo } });
    loadParrucchieri();
  }

  function deleteParr(id: string) {
    setEliminaParrGate(id);
  }

  async function eseguiEliminaParr(id: string) {
    await dbUpdate({ table: 'parrucchieri', id, data: { deleted_at: new Date().toISOString() } });
    setEliminaParrGate(null);
    loadParrucchieri();
  }

  async function salvaAssenza() {
    setAssenzaError('');
    if (!assenzaForm.parrucchiere_id || !assenzaForm.data_inizio || !assenzaForm.data_fine) {
      setAssenzaError('Compila parrucchiere, data inizio e data fine.');
      return;
    }
    if (assenzaForm.data_fine < assenzaForm.data_inizio) {
      setAssenzaError('La data fine deve essere uguale o successiva alla data inizio.');
      return;
    }
    setSavingAssenza(true);
    const res = await dbInsert({
      table: 'assenze_parrucchieri',
      data: {
        parrucchiere_id: assenzaForm.parrucchiere_id,
        data_inizio: assenzaForm.data_inizio,
        data_fine: assenzaForm.data_fine,
        ora_inizio: assenzaForm.ora_inizio || null,
        note: assenzaForm.note,
        user_id: user?.id,
      }
    });
    setSavingAssenza(false);
    if (res.error) { setAssenzaError(res.error); return; }
    setShowAssenzaForm(false);
    setAssenzaForm({ parrucchiere_id: '', data_inizio: '', data_fine: '', ora_inizio: '', note: '' });
    loadAssenze();
  }

  async function eliminaAssenza(id: string) {
    if (!confirm('Eliminare questa assenza?')) return;
    await dbDelete({ table: 'assenze_parrucchieri', filters: [{col:'id', op:'eq', val:id}] });
    loadAssenze();
  }

  const parrMap = new Map(parrucchieri.map(p => [p.id, p]));

  function formatPeriodo(a: Assenza) {
    if (a.data_inizio === a.data_fine) {
      return new Date(a.data_inizio + 'T12:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
    }
    const start = new Date(a.data_inizio + 'T12:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
    const end = new Date(a.data_fine + 'T12:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });
    return `${start} – ${end}`;
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-8">

      {/* ── Sezione parrucchieri ── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-stone-800">Parrucchieri</h2>
            <p className="text-xs text-stone-400 mt-0.5">{parrucchieri.length} registrati — i parrucchieri attivi compaiono come colonne nell'agenda</p>
          </div>
          <button
            onClick={openNew}
            className="flex items-center gap-2 bg-amber-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-amber-600 transition-colors"
          >
            <Plus size={16} /> Nuovo
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="w-7 h-7 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : parrucchieri.length === 0 ? (
            <div className="text-center py-12 text-stone-400 text-sm">Nessun parrucchiere registrato</div>
          ) : (
            <div className="divide-y divide-stone-100">
              {parrucchieri.map(p => (
                <div key={p.id} className="flex items-center gap-4 px-5 py-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0" style={{ backgroundColor: p.colore }}>
                    {p.nome[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-stone-800">{p.nome}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: p.colore }} />
                      <span className="text-xs text-stone-400">{p.colore}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleAttivo(p)}
                    className={`text-xs font-medium px-2.5 py-1 rounded-full transition-colors ${
                      p.attivo ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
                    }`}
                  >
                    {p.attivo ? 'Attivo' : 'Inattivo'}
                  </button>
                  <button onClick={() => openEdit(p)} className="p-1.5 text-stone-400 hover:text-amber-600 transition-colors">
                    <Edit2 size={14} />
                  </button>
                  <button onClick={() => deleteParr(p.id)} className="p-1.5 text-stone-400 hover:text-red-500 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Sezione assenze ── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-stone-800">Assenze</h2>
            <p className="text-xs text-stone-400 mt-0.5">Giornata intera: colonna nascosta dall'agenda. Uscita anticipata: colonna grigia dall'ora indicata.</p>
          </div>
          <button
            onClick={() => {
              setShowAssenzaForm(s => !s);
              setAssenzaError('');
              if (!showAssenzaForm) setAssenzaForm({ parrucchiere_id: '', data_inizio: '', data_fine: '', ora_inizio: '', note: '' });
            }}
            className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
          >
            <Plus size={16} /> Aggiungi
          </button>
        </div>

        {showAssenzaForm && (
          <div className="bg-white border border-stone-200 rounded-2xl shadow-sm p-5 space-y-4 mb-4">
            <p className="text-sm font-bold text-stone-700">Nuova assenza</p>

            <div>
              <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1.5">Parrucchiere</label>
              <select
                value={assenzaForm.parrucchiere_id}
                onChange={e => setAssenzaForm(f => ({ ...f, parrucchiere_id: e.target.value }))}
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
              >
                <option value="">Seleziona...</option>
                {parrucchieri.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1.5">Data inizio</label>
                <input type="date" value={assenzaForm.data_inizio}
                  onChange={e => setAssenzaForm(f => ({ ...f, data_inizio: e.target.value, data_fine: f.data_fine || e.target.value }))}
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1.5">Data fine</label>
                <input type="date" value={assenzaForm.data_fine}
                  onChange={e => setAssenzaForm(f => ({ ...f, data_fine: e.target.value }))}
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1.5">
                Ora di uscita anticipata <span className="normal-case font-normal text-stone-400">(lascia vuoto = assente tutta la giornata)</span>
              </label>
              <input type="time" value={assenzaForm.ora_inizio}
                onChange={e => setAssenzaForm(f => ({ ...f, ora_inizio: e.target.value }))}
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400" />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1.5">Note (opzionale)</label>
              <input type="text" value={assenzaForm.note}
                onChange={e => setAssenzaForm(f => ({ ...f, note: e.target.value }))}
                placeholder="Es. ferie estive, malattia..."
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400" />
            </div>

            {assenzaError && <p className="text-xs text-red-600 font-medium">{assenzaError}</p>}

            <div className="flex gap-3 justify-end pt-1">
              <button onClick={() => { setShowAssenzaForm(false); setAssenzaError(''); setAssenzaForm({ parrucchiere_id: '', data_inizio: '', data_fine: '', ora_inizio: '', note: '' }); }}
                className="px-4 py-2 text-sm font-medium text-stone-600 border border-stone-200 rounded-lg hover:bg-stone-50">
                Annulla
              </button>
              <button onClick={salvaAssenza} disabled={savingAssenza}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white rounded-lg transition-colors">
                <Check size={14} />
                {savingAssenza ? 'Salvataggio...' : 'Salva'}
              </button>
            </div>
          </div>
        )}

        {assenzeLoading ? (
          <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-red-400 border-t-transparent rounded-full animate-spin" /></div>
        ) : assenze.length === 0 ? (
          <div className="text-center py-10 text-stone-400">
            <UserX size={28} className="mx-auto mb-2 opacity-40" />
            <p className="text-sm">Nessuna assenza registrata</p>
          </div>
        ) : (
          <div className="space-y-2">
            {assenze.map(a => {
              const parr = parrMap.get(a.parrucchiere_id);
              const tuttoIlGiorno = !a.ora_inizio;
              return (
                <div key={a.id} className="bg-white border border-stone-200 rounded-xl px-4 py-3 flex items-center gap-3 shadow-sm">
                  {parr && <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: parr.colore }} />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-stone-800 text-sm">{parr?.nome ?? '—'}</span>
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${tuttoIlGiorno ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                        {tuttoIlGiorno ? 'Tutto il giorno' : `Dalle ${a.ora_inizio!.substring(0, 5)}`}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Calendar size={11} className="text-stone-400 flex-shrink-0" />
                      <span className="text-xs text-stone-500">{formatPeriodo(a)}</span>
                      {a.note && <span className="text-xs text-stone-400 italic">— {a.note}</span>}
                    </div>
                  </div>
                  <button onClick={() => eliminaAssenza(a.id)} className="p-1.5 rounded-lg text-stone-300 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0">
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {eliminaParrGate && (
        <PasswordGateModal
          titolo="Elimina parrucchiere"
          descrizione="Inserisci la password per eliminare definitivamente questo parrucchiere."
          chiavePassword="password_elimina_parrucchieri"
          onSuccess={() => eseguiEliminaParr(eliminaParrGate)}
          onClose={() => setEliminaParrGate(null)}
        />
      )}

      {/* Modal parrucchiere */}
      {modal.open && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 flex-shrink-0">
              <h2 className="font-bold text-stone-800 text-lg">
                {modal.id ? 'Modifica Parrucchiere' : 'Nuovo Parrucchiere'}
              </h2>
              <button onClick={() => setModal({ open: false })} className="text-stone-400 hover:text-stone-700">
                <X size={20} />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
              {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wide">Nome *</label>
                <input
                  autoFocus
                  value={form.nome}
                  onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  placeholder="es. Marco"
                  onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wide">Colore colonna</label>
                <div className="flex gap-2 flex-wrap">
                  {PRESET_COLORS.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, colore: c }))}
                      className="w-8 h-8 rounded-full transition-transform hover:scale-110"
                      style={{ backgroundColor: c, outline: form.colore === c ? `3px solid ${c}` : 'none', outlineOffset: '2px' }}
                    />
                  ))}
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full flex-shrink-0" style={{ backgroundColor: form.colore }} />
                  <input
                    type="color"
                    value={form.colore}
                    onChange={e => setForm(f => ({ ...f, colore: e.target.value }))}
                    className="h-8 w-20 border border-stone-200 rounded-lg cursor-pointer"
                    title="Colore personalizzato"
                  />
                  <span className="text-xs text-stone-400">Colore personalizzato</span>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-stone-100 flex gap-3 justify-end flex-shrink-0">
              <button onClick={() => setModal({ open: false })} className="px-5 py-2 text-sm font-medium text-stone-600 border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors">
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
      )}
    </div>
  );
}
