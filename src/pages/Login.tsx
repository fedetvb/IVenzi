import { useState } from 'react';
import { Scissors, Mail, Lock, Eye, EyeOff, AlertCircle, KeyRound, CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

type Mode = 'login' | 'register' | 'reset-email' | 'reset-otp' | 'reset-newpwd';

export default function Login() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');

  function resetState() {
    setError('');
    setSuccessMsg('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    resetState();

    if (mode === 'login') {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) setError(translateError(err.message));
    } else if (mode === 'register') {
      const { error: err } = await supabase.auth.signUp({ email, password });
      if (err) setError(translateError(err.message));
      else setSuccessMsg('Account creato! Controlla la tua email per confermare la registrazione.');
    } else if (mode === 'reset-email') {
      await handleSendOtp();
    } else if (mode === 'reset-otp') {
      await handleVerifyOtp();
    } else if (mode === 'reset-newpwd') {
      await handleSetNewPassword();
    }

    setLoading(false);
  }

  async function handleSendOtp() {
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-otp-reset`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ email: resetEmail }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || 'Errore durante l\'invio del codice.');
    } else {
      setMode('reset-otp');
      setSuccessMsg('Codice inviato! Controlla la tua email.');
    }
  }

  async function handleVerifyOtp() {
    if (otpCode.length !== 6) {
      setError('Inserisci un codice di 6 cifre.');
      setLoading(false);
      return;
    }
    setMode('reset-newpwd');
    setSuccessMsg('');
  }

  async function handleSetNewPassword() {
    if (newPassword.length < 6) {
      setError('La password deve avere almeno 6 caratteri.');
      setLoading(false);
      return;
    }
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-otp-reset`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ email: resetEmail, code: otpCode, newPassword }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || 'Errore durante il reset della password.');
      if (data.error?.includes('scaduto') || data.error?.includes('valido')) {
        setMode('reset-otp');
        setOtpCode('');
      }
    } else {
      setSuccessMsg('Password aggiornata con successo! Ora puoi accedere.');
      setMode('login');
      setEmail(resetEmail);
      setResetEmail('');
      setOtpCode('');
      setNewPassword('');
    }
  }

  async function handleGoogleLogin() {
    setLoading(true);
    resetState();
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (err) {
      setError(translateError(err.message));
      setLoading(false);
    }
  }

  function translateError(msg: string): string {
    if (msg.includes('Invalid login credentials')) return 'Email o password non corretti.';
    if (msg.includes('Email not confirmed')) return 'Conferma la tua email prima di accedere.';
    if (msg.includes('User already registered')) return 'Esiste già un account con questa email.';
    if (msg.includes('Password should be at least')) return 'La password deve essere di almeno 6 caratteri.';
    if (msg.includes('rate limit')) return 'Troppi tentativi. Riprova tra qualche minuto.';
    return msg;
  }

  return (
    <div className="min-h-screen bg-stone-50 flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-stone-900 flex-col items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-stone-800 to-stone-950" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-amber-500/5 rounded-full translate-y-1/2 -translate-x-1/2" />
        <div className="relative z-10 text-center">
          <div className="w-20 h-20 bg-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-2xl">
            <Scissors size={36} className="text-white" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-4 tracking-tight">Salone Gestionale</h1>
          <p className="text-stone-400 text-lg leading-relaxed max-w-sm mx-auto">
            Gestisci appuntamenti, clienti, fiches e molto altro da qualsiasi dispositivo.
          </p>
          <div className="mt-12 grid grid-cols-3 gap-6 text-center">
            {[
              { label: 'Clienti', desc: 'Schede complete' },
              { label: 'Agenda', desc: 'Appuntamenti' },
              { label: 'Fiches', desc: 'Incassi rapidi' },
            ].map(item => (
              <div key={item.label} className="bg-stone-800/60 rounded-xl px-4 py-5">
                <p className="text-amber-400 font-bold text-sm">{item.label}</p>
                <p className="text-stone-500 text-xs mt-1">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-10">
            <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center">
              <Scissors size={18} className="text-white" />
            </div>
            <div>
              <p className="font-bold text-stone-800">Salone Gestionale</p>
              <p className="text-xs text-stone-500">Il tuo gestionale professionale</p>
            </div>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-stone-800">
              {mode === 'login' && 'Accedi al tuo account'}
              {mode === 'register' && 'Crea un account'}
              {mode === 'reset-email' && 'Password dimenticata'}
              {mode === 'reset-otp' && 'Inserisci il codice'}
              {mode === 'reset-newpwd' && 'Nuova password'}
            </h2>
            <p className="text-stone-500 text-sm mt-1">
              {mode === 'login' && 'Inserisci le tue credenziali per continuare'}
              {mode === 'register' && 'Crea il tuo account per iniziare'}
              {mode === 'reset-email' && 'Riceverai un codice di 6 cifre via email'}
              {mode === 'reset-otp' && `Codice inviato a ${resetEmail}`}
              {mode === 'reset-newpwd' && 'Scegli la tua nuova password'}
            </p>
          </div>

          {/* Step indicator per reset */}
          {(mode === 'reset-email' || mode === 'reset-otp' || mode === 'reset-newpwd') && (
            <div className="flex items-center gap-2 mb-6">
              {(['reset-email', 'reset-otp', 'reset-newpwd'] as const).map((step, i) => (
                <div key={step} className="flex items-center gap-2 flex-1">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-colors ${
                    mode === step
                      ? 'bg-amber-500 text-white'
                      : (['reset-email', 'reset-otp', 'reset-newpwd'].indexOf(mode) > i)
                        ? 'bg-green-500 text-white'
                        : 'bg-stone-200 text-stone-400'
                  }`}>
                    {(['reset-email', 'reset-otp', 'reset-newpwd'].indexOf(mode) > i)
                      ? <CheckCircle2 size={14} />
                      : i + 1}
                  </div>
                  {i < 2 && <div className={`flex-1 h-px transition-colors ${
                    ['reset-email', 'reset-otp', 'reset-newpwd'].indexOf(mode) > i ? 'bg-green-400' : 'bg-stone-200'
                  }`} />}
                </div>
              ))}
            </div>
          )}

          {/* Google OAuth */}
          {(mode === 'login' || mode === 'register') && (
            <>
              <button
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-stone-200 rounded-xl bg-white hover:bg-stone-50 transition-colors text-stone-700 font-medium text-sm shadow-sm disabled:opacity-50"
              >
                <svg width="18" height="18" viewBox="0 0 18 18">
                  <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z"/>
                  <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2.04a4.8 4.8 0 0 1-7.18-2.53H1.83v2.07A8 8 0 0 0 8.98 17z"/>
                  <path fill="#FBBC05" d="M4.5 10.49a4.8 4.8 0 0 1 0-3.07V5.35H1.83a8 8 0 0 0 0 7.21l2.67-2.07z"/>
                  <path fill="#EA4335" d="M8.98 3.58c1.32 0 2.5.45 3.44 1.35l2.54-2.54A8 8 0 0 0 1.83 5.35L4.5 7.42a4.77 4.77 0 0 1 4.48-3.84z"/>
                </svg>
                Continua con Google
              </button>

              <div className="flex items-center gap-3 my-6">
                <div className="flex-1 h-px bg-stone-200" />
                <span className="text-xs text-stone-400 font-medium">oppure</span>
                <div className="flex-1 h-px bg-stone-200" />
              </div>
            </>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Step 1: email per reset */}
            {mode === 'reset-email' && (
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5">Email account</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                  <input
                    type="email"
                    value={resetEmail}
                    onChange={e => setResetEmail(e.target.value)}
                    required
                    autoFocus
                    placeholder="tuaemail@esempio.com"
                    className="w-full pl-9 pr-4 py-3 border border-stone-200 rounded-xl bg-white text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent text-sm transition"
                  />
                </div>
              </div>
            )}

            {/* Step 2: inserimento OTP */}
            {mode === 'reset-otp' && (
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5">Codice OTP (6 cifre)</label>
                <div className="relative">
                  <KeyRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                  <input
                    type="text"
                    value={otpCode}
                    onChange={e => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    required
                    autoFocus
                    placeholder="123456"
                    maxLength={6}
                    inputMode="numeric"
                    className="w-full pl-9 pr-4 py-3 border border-stone-200 rounded-xl bg-white text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent text-sm transition tracking-widest font-mono"
                  />
                </div>
                <button
                  type="button"
                  onClick={async () => { resetState(); setLoading(true); await handleSendOtp(); setLoading(false); }}
                  disabled={loading}
                  className="mt-2 text-xs text-stone-400 hover:text-amber-600 transition-colors"
                >
                  Non hai ricevuto il codice? Reinvia
                </button>
              </div>
            )}

            {/* Step 3: nuova password */}
            {mode === 'reset-newpwd' && (
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5">Nuova password</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    required
                    autoFocus
                    placeholder="••••••••"
                    minLength={6}
                    className="w-full pl-9 pr-10 py-3 border border-stone-200 rounded-xl bg-white text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent text-sm transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                  >
                    {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            )}

            {/* Login / Register fields */}
            {(mode === 'login' || mode === 'register') && (
              <>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1.5">Email</label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                      placeholder="tuaemail@esempio.com"
                      className="w-full pl-9 pr-4 py-3 border border-stone-200 rounded-xl bg-white text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent text-sm transition"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1.5">Password</label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      placeholder="••••••••"
                      minLength={6}
                      className="w-full pl-9 pr-10 py-3 border border-stone-200 rounded-xl bg-white text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent text-sm transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              </>
            )}

            {error && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                <AlertCircle size={15} className="text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {successMsg && (
              <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                <p className="text-sm text-green-700">{successMsg}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-amber-500 hover:bg-amber-600 text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-60 text-sm shadow-sm"
            >
              {loading
                ? 'Attendere...'
                : mode === 'login'
                ? 'Accedi'
                : mode === 'register'
                ? 'Crea account'
                : mode === 'reset-email'
                ? 'Invia codice via email'
                : mode === 'reset-otp'
                ? 'Verifica codice'
                : 'Salva nuova password'}
            </button>
          </form>

          {/* Footer links */}
          <div className="mt-6 text-center space-y-2">
            {mode === 'login' && (
              <>
                <button
                  onClick={() => { setMode('reset-email'); setResetEmail(email); resetState(); }}
                  className="text-xs text-stone-500 hover:text-amber-600 transition-colors"
                >
                  Password dimenticata?
                </button>
                <p className="text-sm text-stone-500">
                  Non hai un account?{' '}
                  <button
                    onClick={() => { setMode('register'); resetState(); }}
                    className="text-amber-600 font-medium hover:text-amber-700"
                  >
                    Registrati
                  </button>
                </p>
              </>
            )}
            {mode === 'register' && (
              <p className="text-sm text-stone-500">
                Hai gia un account?{' '}
                <button
                  onClick={() => { setMode('login'); resetState(); }}
                  className="text-amber-600 font-medium hover:text-amber-700"
                >
                  Accedi
                </button>
              </p>
            )}
            {(mode === 'reset-email' || mode === 'reset-otp' || mode === 'reset-newpwd') && (
              <button
                onClick={() => { setMode('login'); setResetEmail(''); setOtpCode(''); setNewPassword(''); resetState(); }}
                className="text-sm text-stone-500 hover:text-amber-600 transition-colors"
              >
                Torna al login
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
