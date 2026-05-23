import { useEffect, useRef, useState } from 'react';
import { Lock, Eye, EyeOff, ShieldCheck, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Props {
  titolo?: string;
  descrizione?: string;
  chiavePassword?: string;
  onSuccess: () => void;
  onClose: () => void;
}

export default function PasswordGateModal({ titolo = 'Operazione protetta', descrizione = 'Inserisci la password per procedere.', chiavePassword = 'password_carte', onSuccess, onClose }: Props) {
  const [input, setInput] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 60);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    setLoading(true);
    setError('');

    const { data } = await supabase
      .from('impostazioni')
      .select('valore')
      .eq('chiave', chiavePassword)
      .maybeSingle();

    setLoading(false);
    const correct = data?.valore ?? '1234';

    if (input === correct) {
      onSuccess();
    } else {
      setError('Password non corretta');
      setInput('');
      inputRef.current?.focus();
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-stone-100 rounded-lg flex items-center justify-center">
              <Lock size={15} className="text-stone-500" />
            </div>
            <p className="font-bold text-stone-800 text-sm">{titolo}</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-stone-100 rounded-lg transition-colors">
            <X size={15} className="text-stone-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
          <p className="text-sm text-stone-500">{descrizione}</p>

          <div className="relative">
            <input
              ref={inputRef}
              type={show ? 'text' : 'password'}
              value={input}
              onChange={e => { setInput(e.target.value); setError(''); }}
              placeholder="Password"
              autoComplete="current-password"
              className={`w-full border rounded-xl px-4 py-2.5 pr-10 text-sm text-stone-800 focus:outline-none focus:ring-2 transition-colors ${
                error
                  ? 'border-red-300 bg-red-50 focus:ring-red-200'
                  : 'border-stone-200 focus:ring-amber-300 focus:border-amber-400'
              }`}
            />
            <button
              type="button"
              onClick={() => setShow(s => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 transition-colors"
            >
              {show ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>

          {error && (
            <p className="text-xs text-red-600 font-medium text-center">{error}</p>
          )}

          <div className="flex gap-3">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-stone-200 text-sm font-medium text-stone-600 hover:bg-stone-50 transition-colors">
              Annulla
            </button>
            <button type="submit" disabled={loading || !input.trim()}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white text-sm font-semibold transition-colors">
              <ShieldCheck size={14} />
              {loading ? 'Verifica...' : 'Conferma'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
