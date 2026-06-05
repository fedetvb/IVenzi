import { useEffect, useRef, useState } from 'react';
import { X, Camera, Image as ImageIcon, Trash2, ShieldOff, ShieldCheck } from 'lucide-react';
import { type Cliente } from '../lib/supabase';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { dbSelect, dbInsert, dbUpdate, isElectron, compressImage } from '../lib/localDb';

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
  in_blacklist: boolean;
  motivo_blacklist: string;
}

export default function ClienteModal({ clienteId, onClose, onSaved }: Props) {
  const { user } = useAuth();
  const [form, setForm] = useState<ClienteForm>({ nome: '', cognome: '', telefono: '', email: '', data_nascita: '', note: '', in_blacklist: false, motivo_blacklist: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [fotoUrl, setFotoUrl] = useState('');
  const [fotoPreview, setFotoPreview] = useState('');
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (clienteId) loadCliente();
  }, [clienteId]);

  async function loadCliente() {
    const { data, error } = await dbSelect({ table: 'clienti', filters: [{ col: 'id', op: 'eq', val: clienteId }] });
    if (error || !data || data.length === 0) return;
    const c = (data[0] as Cliente & { foto_base64?: string });
    setForm({
      nome: c.nome,
      cognome: c.cognome,
      telefono: c.telefono,
      email: c.email ?? '',
      data_nascita: c.data_nascita ?? '',
      note: c.note ?? '',
      in_blacklist: !!c.in_blacklist,
      motivo_blacklist: c.motivo_blacklist ?? '',
    });
    // Prefer local base64 for preview (works offline)
    setFotoUrl(c.foto_base64 || c.foto_url || '');
  }

  async function handleFotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) { setError('La foto non deve superare 15 MB.'); return; }
    setError('');
    const compressed = await compressImage(file);
    setFotoFile(new File([compressed], 'foto.jpg', { type: 'image/jpeg' }));
    setFotoPreview(URL.createObjectURL(compressed));
  }

  function removeFoto() {
    setFotoFile(null);
    setFotoPreview('');
    setFotoUrl('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function uploadFoto(id: string): Promise<{ url: string; uploaded: boolean }> {
    if (!fotoFile) return { url: fotoUrl, uploaded: false };
    setUploadingFoto(true);
    const filename = `clienti/${id}.jpg`;
    const { error: uploadErr } = await supabase.storage
      .from('foto-clienti')
      .upload(filename, fotoFile, { contentType: 'image/jpeg', upsert: true });
    setUploadingFoto(false);
    if (uploadErr) return { url: fotoUrl, uploaded: false };
    const { data } = supabase.storage.from('foto-clienti').getPublicUrl(filename);
    return { url: data.publicUrl, uploaded: true };
  }

  function setField<K extends keyof ClienteForm>(k: K, v: ClienteForm[K]) {
    setForm(f => ({ ...f, [k]: v }));
  }

  async function handleSave() {
    if (!form.nome.trim() || !form.cognome.trim()) { setError('Nome e cognome sono obbligatori'); return; }
    setSaving(true);
    setError('');

    let id = clienteId;
    if (!id) {
      const { data, error } = await dbInsert({
        table: 'clienti',
        data: {
          nome: form.nome.trim(), cognome: form.cognome.trim(),
          telefono: form.telefono.trim(), email: form.email.trim(),
          data_nascita: form.data_nascita || null, note: form.note.trim(),
          foto_url: '', user_id: user?.id,
          in_blacklist: form.in_blacklist,
          motivo_blacklist: form.motivo_blacklist.trim(),
          updated_at: new Date().toISOString(),
        }
      });
      if (!error && data) id = (data as { id: string }).id;
    }

    if (!id) { setSaving(false); return; }

    const { url: newFotoUrl, uploaded: fotoUploaded } = await uploadFoto(id);

    // In Electron, store base64 locally for offline access
    let fotoBase64 = '';
    if (isElectron() && fotoFile) {
      fotoBase64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string) ?? '');
        reader.onerror = () => resolve('');
        reader.readAsDataURL(fotoFile!);
      });
    }

    const payload: Record<string, unknown> = {
      nome: form.nome.trim(), cognome: form.cognome.trim(),
      telefono: form.telefono.trim(), email: form.email.trim(),
      data_nascita: form.data_nascita || null, note: form.note.trim(),
      foto_url: newFotoUrl,
      in_blacklist: form.in_blacklist,
      motivo_blacklist: form.in_blacklist ? form.motivo_blacklist.trim() : '',
      updated_at: new Date().toISOString(),
    };
    if (isElectron() && fotoBase64) {
      payload.foto_base64 = fotoBase64;
      // Se l'upload e' fallito (offline), salva il base64 come pendente per ritentare al prossimo sync
      payload.foto_base64_pendente = fotoUploaded ? '' : fotoBase64;
    }
    if (isElectron() && !fotoFile && !fotoUrl) {
      payload.foto_base64 = '';
      payload.foto_base64_pendente = '';
    }
    await dbUpdate({ table: 'clienti', id: id as string, data: payload });

    setSaving(false);
    onSaved(id);
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

          {/* Foto profilo */}
          <div className="flex flex-col items-center gap-3 pb-2">
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-amber-100 overflow-hidden flex items-center justify-center border-2 border-amber-200">
                {(fotoPreview || fotoUrl) ? (
                  <img src={fotoPreview || fotoUrl} alt="Foto profilo" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl font-bold text-amber-600">
                    {(form.nome[0] ?? '') + (form.cognome[0] ?? '') || '?'}
                  </span>
                )}
              </div>
              {(fotoPreview || fotoUrl) && (
                <button
                  type="button"
                  onClick={removeFoto}
                  className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                >
                  <Trash2 size={10} className="text-white" />
                </button>
              )}
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFotoChange} />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { if (fileInputRef.current) { fileInputRef.current.setAttribute('capture', 'user'); fileInputRef.current.click(); } }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-200 text-xs font-semibold text-stone-600 hover:border-amber-300 hover:text-amber-700 hover:bg-amber-50 transition-colors"
              >
                <Camera size={12} /> Selfie
              </button>
              <button
                type="button"
                onClick={() => { if (fileInputRef.current) { fileInputRef.current.removeAttribute('capture'); fileInputRef.current.click(); } }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-200 text-xs font-semibold text-stone-600 hover:border-amber-300 hover:text-amber-700 hover:bg-amber-50 transition-colors"
              >
                <ImageIcon size={12} /> Galleria
              </button>
            </div>
          </div>

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

          {/* Blacklist */}
          <div className={`rounded-xl border p-4 transition-colors ${form.in_blacklist ? 'border-red-300 bg-red-50' : 'border-stone-200'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {form.in_blacklist ? (
                  <ShieldOff size={16} className="text-red-500" />
                ) : (
                  <ShieldCheck size={16} className="text-stone-400" />
                )}
                <span className={`text-sm font-semibold ${form.in_blacklist ? 'text-red-700' : 'text-stone-600'}`}>
                  Lista nera
                </span>
              </div>
              <button
                type="button"
                onClick={() => setField('in_blacklist', !form.in_blacklist)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${form.in_blacklist ? 'bg-red-500' : 'bg-stone-200'}`}
              >
                <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${form.in_blacklist ? 'translate-x-4' : 'translate-x-1'}`} />
              </button>
            </div>
            {form.in_blacklist && (
              <div className="mt-3">
                <label className="block text-xs font-semibold text-red-600 mb-1.5 uppercase tracking-wide">Motivo</label>
                <input
                  value={form.motivo_blacklist}
                  onChange={e => setField('motivo_blacklist', e.target.value)}
                  className="w-full border border-red-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 bg-white placeholder:text-red-300"
                  placeholder="Es: comportamento scorretto, crediti non pagati..."
                />
              </div>
            )}
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
            {uploadingFoto ? 'Caricamento foto...' : saving ? 'Salvataggio...' : 'Salva'}
          </button>
        </div>
      </div>
    </div>
  );
}
