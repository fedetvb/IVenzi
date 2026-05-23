import { useEffect, useRef, useState } from 'react';
import { Lock, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Props {
  children: React.ReactNode;
  isActive: boolean;
  chiave: string;          // es. 'password_statistiche' | 'password_finanze'
  sezione: string;         // es. 'statistiche' | 'finanze'
  sessionKey: string;      // chiave sessionStorage
}

export default function StatisticheGate({ children, isActive, chiave, sezione, sessionKey }: Props) {
  const [unlocked, setUnlocked] = useState(false);
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [show, setShow] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isActive) setUnlocked(false);
  }, [isActive]);

  useEffect(() => {
    if (!unlocked) setTimeout(() => inputRef.current?.focus(), 50);
  }, [unlocked]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    setLoading(true);
    setError('');

    const { data } = await supabase
      .from('impostazioni')
      .select('valore')
      .eq('chiave', chiave)
      .maybeSingle();

    setLoading(false);

    const correct = data?.valore ?? '1234';
    if (input === correct) {
      setUnlocked(true);
    } else {
      setError('Password non corretta');
      setInput('');
      inputRef.current?.focus();
    }
  }

  if (unlocked) return <>{children}</>;

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-stone-100 flex items-center justify-center">
            <Lock size={28} className="text-stone-500" />
          </div>
        </div>

        <h2 className="text-xl font-bold text-stone-800 text-center mb-1">Area protetta</h2>
        <p className="text-sm text-stone-500 text-center mb-8">
          Inserisci la password per accedere alle {sezione}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <input
              ref={inputRef}
              type={show ? 'text' : 'password'}
              value={input}
              onChange={e => { setInput(e.target.value); setError(''); }}
              placeholder="Password"
              autoComplete="current-password"
              className={`w-full border rounded-xl px-4 py-3 pr-10 text-sm text-stone-800 focus:outline-none focus:ring-2 transition-colors ${
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
              {show ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>

          {error && (
            <p className="text-xs text-red-600 font-medium text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors shadow-sm"
          >
            <ShieldCheck size={15} />
            {loading ? 'Verifica...' : 'Accedi'}
          </button>
        </form>
      </div>
    </div>
  );
}
