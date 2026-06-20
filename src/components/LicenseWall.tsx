import { useState, useEffect, useRef } from 'react';
import {
  Shield, Lock, Key, CheckCircle, AlertCircle, ChevronRight, Scissors,
  RefreshCw, Eye, EyeOff, Copy, LogIn, Wifi, WifiOff, Send,
} from 'lucide-react';
import {
  getLicenseState,
  verifyLocalOtp,
  verifyCloudOtp,
  getHardwareId,
  getCloudRequestId,
  isOwnerBuild,
  submitLicenseRequest,
  fetchPendingRequest,
  subscribeToLicenseApproval,
  type LicenseState,
} from '../lib/license';
import { isElectron } from '../lib/localDb';
import { supabase } from '../lib/supabase';

interface Props {
  onActivated: () => void;
}

type Step = 'wall1' | 'wall2';

// ─── Browser backdoor (owner build, non Electron) ─────────────────────────────

function OwnerBrowserBackdoor({ onActivated }: { onActivated: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  async function handleLogin() {
    if (!email.trim() || !password.trim()) return;
    setLoading(true);
    setError('');
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (authError) {
        setError('Credenziali non valide. Accesso negato.');
      } else {
        localStorage.setItem('license_local_activated', 'true');
        localStorage.setItem('license_cloud_activated', 'true');
        setSuccess(true);
        setTimeout(() => onActivated(), 1000);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-stone-950 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 opacity-[0.03] pointer-events-none"
        style={{ backgroundImage: `radial-gradient(circle at 1px 1px, #d4a96a 1px, transparent 0)`, backgroundSize: '40px 40px' }}
      />
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-amber-500/5 blur-[120px]" />
      </div>

      <div className="relative w-full max-w-sm">
        <div className="flex flex-col items-center mb-10">
          <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-amber-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-amber-500/20 mb-4">
            <Scissors size={28} className="text-stone-950" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Gestionale Salone</h1>
          <p className="text-stone-500 text-sm mt-1 tracking-widest uppercase">Accesso Team</p>
        </div>

        <div className="bg-stone-900 border border-stone-800 rounded-3xl overflow-hidden shadow-2xl">
          <div className="px-8 pt-8 pb-6 border-b border-stone-800">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-amber-500/15">
                <LogIn size={18} className="text-amber-400" />
              </div>
              <div>
                <h2 className="text-white font-semibold text-base">Accesso con credenziali</h2>
                <p className="text-stone-500 text-xs mt-0.5">Pannello riservato al team</p>
              </div>
            </div>
          </div>

          <div className="px-8 py-6 space-y-4">
            <div>
              <label className="block text-stone-400 text-xs font-medium uppercase tracking-widest mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setError(''); }}
                onKeyDown={e => { if (e.key === 'Enter') handleLogin(); }}
                placeholder="nome@email.com"
                className="w-full bg-stone-800 border border-stone-700 rounded-xl px-4 py-3 text-white text-sm placeholder-stone-600 focus:outline-none focus:border-amber-500/60 focus:ring-2 focus:ring-amber-500/10 transition-all"
                autoFocus
                autoComplete="email"
              />
            </div>
            <div>
              <label className="block text-stone-400 text-xs font-medium uppercase tracking-widest mb-2">Password</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(''); }}
                  onKeyDown={e => { if (e.key === 'Enter') handleLogin(); }}
                  placeholder="••••••••"
                  className="w-full bg-stone-800 border border-stone-700 rounded-xl px-4 py-3 pr-10 text-white text-sm placeholder-stone-600 focus:outline-none focus:border-amber-500/60 focus:ring-2 focus:ring-amber-500/10 transition-all"
                  autoComplete="current-password"
                />
                <button type="button" onClick={() => setShowPass(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-300 transition-colors">
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {error && <div className="flex items-center gap-2 text-red-400 text-sm"><AlertCircle size={14} /><span>{error}</span></div>}
            {success && <div className="flex items-center gap-2 text-emerald-400 text-sm"><CheckCircle size={14} /><span>Accesso effettuato!</span></div>}

            <button
              onClick={handleLogin}
              disabled={loading || !email.trim() || !password.trim() || success}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold text-sm transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: success ? 'linear-gradient(135deg, #10b981, #059669)' : 'linear-gradient(135deg, #f59e0b, #d97706)',
                color: '#0c0a09',
                boxShadow: success ? '0 4px 24px rgb(16 185 129 / 0.25)' : '0 4px 24px rgb(245 158 11 / 0.25)',
              }}
            >
              {loading ? <div className="w-4 h-4 border-2 border-stone-900/40 border-t-stone-900 rounded-full animate-spin" /> : success ? <><CheckCircle size={16} /> Accesso effettuato!</> : <><LogIn size={16} /> Accedi</>}
            </button>
          </div>

          <div className="px-8 py-4 bg-stone-950/40 border-t border-stone-800/60">
            <p className="text-stone-600 text-xs text-center">Accesso riservato al team autorizzato.</p>
          </div>
        </div>

        <p className="text-center text-stone-700 text-xs mt-6">&copy; {new Date().getFullYear()} Gestionale Salone</p>
      </div>
    </div>
  );
}

// ─── OTP salvati — cassaforte con maschera + occhio + copia ──────────────────

function SavedCodesDisplay({ state }: { state: LicenseState }) {
  const [showLocalOtp, setShowLocalOtp] = useState(false);
  const [showCloudOtp, setShowCloudOtp] = useState(false);
  const [copiedKey, setCopiedKey] = useState('');

  async function copyText(text: string, key: string) {
    try { await navigator.clipboard.writeText(text); setCopiedKey(key); setTimeout(() => setCopiedKey(''), 2000); } catch { /* ignore */ }
  }

  const rows: { label: string; value: string; key: string; secret: boolean; show: boolean; toggle: () => void }[] = [
    { label: 'Hardware ID', value: state.hardwareId, key: 'hwid', secret: false, show: true, toggle: () => {} },
    { label: 'Codice OTP Locale', value: state.localOtpCode, key: 'lotp', secret: true, show: showLocalOtp, toggle: () => setShowLocalOtp(v => !v) },
    { label: 'Cloud Request ID', value: state.cloudRequestId, key: 'crid', secret: false, show: true, toggle: () => {} },
    { label: 'Codice OTP Cloud', value: state.cloudOtpCode, key: 'cotp', secret: true, show: showCloudOtp, toggle: () => setShowCloudOtp(v => !v) },
  ];

  return (
    <div className="bg-stone-900 border border-stone-800 rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-stone-800">
        <p className="text-stone-400 text-xs font-medium uppercase tracking-widest">Codici di Attivazione Salvati</p>
        <p className="text-stone-600 text-xs mt-1">Conserva questi codici in un posto sicuro per ripristinare l'accesso.</p>
      </div>
      <div className="divide-y divide-stone-800/60">
        {rows.map(row => (
          <div key={row.key} className="flex items-center gap-3 px-5 py-3">
            <div className="flex-1 min-w-0">
              <p className="text-stone-500 text-xs mb-0.5">{row.label}</p>
              <code className="text-amber-300 font-mono text-sm tracking-widest">
                {row.value ? (row.secret && !row.show ? '••••-••••' : row.value) : '—'}
              </code>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {row.secret && row.value && (
                <button onClick={row.toggle} className="p-1.5 rounded-lg text-stone-500 hover:text-stone-300 hover:bg-stone-800 transition-colors">
                  {row.show ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
              )}
              {row.value && (
                <button
                  onClick={() => copyText(row.value, row.key)}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium transition-all duration-200"
                  style={{ background: copiedKey === row.key ? 'rgb(16 185 129 / 0.15)' : 'rgb(255 255 255 / 0.06)', color: copiedKey === row.key ? '#34d399' : '#a8a29e' }}
                >
                  {copiedKey === row.key ? 'Copiato!' : <Copy size={11} />}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Componente principale LicenseWall ───────────────────────────────────────

export default function LicenseWall({ onActivated }: Props) {
  // Owner build su browser → backdoor email/password
  if (isOwnerBuild() && !isElectron()) {
    return <OwnerBrowserBackdoor onActivated={onActivated} />;
  }

  const [licenseState, setLicenseState] = useState<LicenseState | null>(null);
  const [step, setStep] = useState<Step>('wall1');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [verifySuccess, setVerifySuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Realtime / online state
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [realtimeStatus, setRealtimeStatus] = useState<'idle' | 'waiting' | 'received'>('idle');
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline); };
  }, []);

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    let cancelled = false;

    async function init() {
      const state = await getLicenseState();
      if (cancelled) return;
      setLicenseState(state);
      if (state.localActivated && !state.cloudActivated) setStep('wall2');

      if (!isOnline || !state.hardwareId) return;

      // 1) Invia la richiesta al Supabase centrale
      await submitLicenseRequest(state.hardwareId, state.cloudRequestId);

      // 2) Controlla subito se la riga ha già gli OTP (app riaperta dopo approvazione)
      const existing = await fetchPendingRequest(state.hardwareId);
      if (existing && !cancelled) {
        const applied = await applyRemoteOtps(existing.otp_livello_1, existing.otp_livello_2, state);
        if (applied) return;
      }

      // 3) Iscriviti al canale Realtime
      setRealtimeStatus('waiting');
      const unsub = subscribeToLicenseApproval(state.hardwareId, async (otp1, otp2) => {
        if (cancelled) return;
        const freshState = await getLicenseState();
        await applyRemoteOtps(otp1, otp2, freshState);
      });
      unsubscribeRef.current = unsub;
    }

    init();
    return () => {
      cancelled = true;
      unsubscribeRef.current?.();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline]);

  async function applyRemoteOtps(
    otp1: string | null,
    otp2: string | null,
    state: LicenseState
  ): Promise<boolean> {
    let didAnything = false;

    if (otp1 && !state.localActivated) {
      const ok = await verifyLocalOtp(otp1);
      if (ok) {
        setOtp(otp1);
        setVerifySuccess(true);
        setRealtimeStatus('received');
        didAnything = true;
        await new Promise(r => setTimeout(r, 1200));
        setVerifySuccess(false);
        setOtp('');
        const newState = await getLicenseState();
        setLicenseState(newState);
        setStep('wall2');
        state = newState;
      }
    }

    if (otp2 && (state.localActivated || didAnything)) {
      const ok = await verifyCloudOtp(otp2);
      if (ok) {
        setOtp(otp2);
        setVerifySuccess(true);
        setRealtimeStatus('received');
        await new Promise(r => setTimeout(r, 1200));
        onActivated();
        return true;
      }
    }

    return didAnything;
  }

  async function handleVerify() {
    if (!otp.trim()) return;
    setLoading(true);
    setError('');
    try {
      if (step === 'wall1') {
        const ok = await verifyLocalOtp(otp);
        if (ok) {
          setVerifySuccess(true);
          setTimeout(async () => {
            setVerifySuccess(false);
            setOtp('');
            const state = await getLicenseState();
            setLicenseState(state);
            setStep('wall2');
          }, 1200);
        } else {
          setError('Codice non valido. Verifica il codice e riprova.');
        }
      } else {
        const ok = await verifyCloudOtp(otp);
        if (ok) {
          setVerifySuccess(true);
          setTimeout(() => onActivated(), 1200);
        } else {
          setError('Codice non valido. Verifica il codice e riprova.');
        }
      }
    } finally {
      setLoading(false);
    }
  }

  async function copyToClipboard(text: string) {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* ignore */ }
  }

  async function refreshIds() {
    const [hwId, crId] = await Promise.all([getHardwareId(), getCloudRequestId()]);
    setLicenseState(prev => prev ? { ...prev, hardwareId: hwId, cloudRequestId: crId } : prev);
  }

  if (!licenseState) {
    return (
      <div className="min-h-screen bg-stone-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const displayId = step === 'wall1' ? licenseState.hardwareId : licenseState.cloudRequestId;
  const bothActivated = licenseState.localActivated && licenseState.cloudActivated;

  return (
    <div className="min-h-screen bg-stone-950 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 opacity-[0.03] pointer-events-none"
        style={{ backgroundImage: `radial-gradient(circle at 1px 1px, #d4a96a 1px, transparent 0)`, backgroundSize: '40px 40px' }}
      />
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-amber-500/5 blur-[120px]" />
      </div>

      <div className="relative w-full max-w-md space-y-5">
        {/* Brand */}
        <div className="flex flex-col items-center mb-2">
          <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-amber-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-amber-500/20 mb-4">
            <Scissors size={28} className="text-stone-950" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Gestionale Salone</h1>
          <p className="text-stone-500 text-sm mt-1 tracking-widest uppercase">Sistema di Licenza</p>
        </div>

        {/* Stato connessione */}
        <div className={`flex items-center gap-2 justify-center text-xs font-medium ${isOnline ? 'text-emerald-400' : 'text-amber-400'}`}>
          {isOnline
            ? <><Wifi size={13} /> Online — attivazione automatica disponibile</>
            : <><WifiOff size={13} /> Offline — inserisci il codice manualmente</>
          }
        </div>

        {/* Stato Realtime */}
        {realtimeStatus === 'waiting' && (
          <div className="flex items-center gap-3 bg-sky-500/10 border border-sky-500/30 rounded-2xl px-5 py-3.5">
            <div className="w-2 h-2 rounded-full bg-sky-400 animate-pulse flex-shrink-0" />
            <div>
              <p className="text-sky-300 text-sm font-medium">In attesa di approvazione</p>
              <p className="text-sky-500/70 text-xs mt-0.5">
                La tua richiesta e' stata inviata. Appena il supporto approva,
                il software si sblocchera' automaticamente.
              </p>
            </div>
          </div>
        )}

        {realtimeStatus === 'received' && (
          <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl px-5 py-3.5">
            <CheckCircle size={16} className="text-emerald-400 flex-shrink-0" />
            <p className="text-emerald-300 text-sm font-medium">Codice ricevuto — sblocco in corso...</p>
          </div>
        )}

        {/* Banner offline */}
        {!isOnline && (
          <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl px-5 py-4">
            <WifiOff size={15} className="text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-amber-300 text-sm font-medium">Nessuna connessione Internet</p>
              <p className="text-amber-500/70 text-xs mt-0.5 leading-relaxed">
                Comunica il tuo ID al supporto tecnico e inserisci il codice
                di attivazione che ti verra' fornito.
              </p>
            </div>
          </div>
        )}

        {/* Steps progress */}
        <div className="flex items-center justify-center gap-3">
          <StepDot number={1} label="Attivazione Locale" active={step === 'wall1'} done={licenseState.localActivated} />
          <div className="w-12 h-px bg-stone-700" />
          <StepDot number={2} label="Attivazione Cloud" active={step === 'wall2'} done={licenseState.cloudActivated} />
        </div>

        {/* Card OTP */}
        {!bothActivated && (
          <div className="bg-stone-900 border border-stone-800 rounded-3xl overflow-hidden shadow-2xl">
            <div className="px-8 pt-8 pb-6 border-b border-stone-800">
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${step === 'wall1' ? 'bg-amber-500/15' : 'bg-sky-500/15'}`}>
                  {step === 'wall1' ? <Shield size={18} className="text-amber-400" /> : <Lock size={18} className="text-sky-400" />}
                </div>
                <div>
                  <h2 className="text-white font-semibold text-base">
                    {step === 'wall1' ? 'Attivazione Desktop' : 'Attivazione Cloud'}
                  </h2>
                  <p className="text-stone-500 text-xs mt-0.5">
                    {step === 'wall1' ? 'Parete 1 di 2 — Chiave Locale' : 'Parete 2 di 2 — Chiave Cloud'}
                  </p>
                </div>
              </div>
              <p className="text-stone-400 text-sm leading-relaxed">
                {isOnline
                  ? (realtimeStatus === 'waiting'
                    ? 'Richiesta inviata. Riceverai il codice automaticamente non appena il supporto lo approva.'
                    : step === 'wall1'
                    ? 'La tua richiesta di attivazione e\' stata inviata. Puoi anche inserire il codice manualmente se lo hai ricevuto.'
                    : 'Inserisci il codice di attivazione cloud ricevuto dal supporto.')
                  : step === 'wall1'
                  ? 'Comunica il tuo Hardware ID al supporto e inserisci il codice ricevuto.'
                  : 'Comunica il tuo Cloud Request ID al supporto e inserisci il codice ricevuto.'}
              </p>
            </div>

            {/* Device ID */}
            <div className="px-8 py-5 border-b border-stone-800">
              <p className="text-stone-500 text-xs font-medium uppercase tracking-widest mb-2">
                {step === 'wall1' ? 'Il tuo Hardware ID' : 'Il tuo Cloud Request ID'}
              </p>
              <div className="flex items-center gap-3 bg-stone-800/60 rounded-xl px-4 py-3">
                <code className="text-amber-300 font-mono text-sm tracking-[0.15em] flex-1 select-all break-all">
                  {displayId || '—'}
                </code>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={refreshIds} className="p-1.5 rounded-lg text-stone-500 hover:text-stone-300 hover:bg-stone-700 transition-colors" title="Aggiorna ID">
                    <RefreshCw size={13} />
                  </button>
                  <button
                    onClick={() => copyToClipboard(displayId)}
                    className="px-3 py-1 rounded-lg text-xs font-medium transition-all duration-200"
                    style={{ background: copied ? 'rgb(16 185 129 / 0.15)' : 'rgb(255 255 255 / 0.06)', color: copied ? '#34d399' : '#a8a29e' }}
                  >
                    {copied ? 'Copiato!' : 'Copia'}
                  </button>
                </div>
              </div>
              {isOnline && realtimeStatus === 'idle' && (
                <div className="flex items-center gap-1.5 mt-2">
                  <Send size={11} className="text-emerald-500" />
                  <p className="text-emerald-600 text-xs">ID inviato al supporto — in attesa di risposta.</p>
                </div>
              )}
            </div>

            {/* OTP input */}
            <div className="px-8 py-6">
              <label className="block text-stone-400 text-xs font-medium uppercase tracking-widest mb-2">
                Codice di Attivazione {realtimeStatus === 'waiting' ? '(auto-compilazione in corso...)' : ''}
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2"><Key size={15} className="text-stone-600" /></div>
                <input
                  type="text"
                  value={otp}
                  onChange={e => { setOtp(e.target.value.toUpperCase().replace(/[^A-F0-9\-]/g, '').slice(0, 9)); setError(''); }}
                  onKeyDown={e => { if (e.key === 'Enter') handleVerify(); }}
                  placeholder={realtimeStatus === 'waiting' ? '...' : 'XXXX-XXXX'}
                  maxLength={9}
                  className="w-full bg-stone-800 border border-stone-700 rounded-xl pl-10 pr-4 py-3.5 text-white font-mono text-base tracking-widest placeholder-stone-600 focus:outline-none focus:border-amber-500/60 focus:ring-2 focus:ring-amber-500/10 transition-all"
                  style={{ letterSpacing: '0.2em' }}
                  autoFocus
                  autoComplete="off"
                  spellCheck={false}
                  readOnly={realtimeStatus === 'waiting'}
                />
              </div>

              {error && <div className="mt-3 flex items-center gap-2 text-red-400 text-sm"><AlertCircle size={14} /><span>{error}</span></div>}
              {verifySuccess && <div className="mt-3 flex items-center gap-2 text-emerald-400 text-sm"><CheckCircle size={14} /><span>Attivazione completata!</span></div>}

              <button
                onClick={handleVerify}
                disabled={loading || !otp.trim() || verifySuccess || realtimeStatus === 'waiting'}
                className="mt-5 w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold text-sm transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  background: verifySuccess ? 'linear-gradient(135deg, #10b981, #059669)' : 'linear-gradient(135deg, #f59e0b, #d97706)',
                  color: '#0c0a09',
                  boxShadow: verifySuccess ? '0 4px 24px rgb(16 185 129 / 0.25)' : '0 4px 24px rgb(245 158 11 / 0.25)',
                }}
              >
                {loading
                  ? <div className="w-4 h-4 border-2 border-stone-900/40 border-t-stone-900 rounded-full animate-spin" />
                  : verifySuccess
                  ? <><CheckCircle size={16} /> Attivato!</>
                  : <><ChevronRight size={16} /> Attiva</>
                }
              </button>
            </div>

            <div className="px-8 py-4 bg-stone-950/40 border-t border-stone-800/60">
              <p className="text-stone-600 text-xs text-center">
                Per assistenza contatta il supporto tecnico.
                {step === 'wall2' && ' L\'attivazione cloud abilita la sincronizzazione dei dati.'}
              </p>
            </div>
          </div>
        )}

        {/* Cassaforte codici salvati */}
        {(licenseState.localOtpCode || licenseState.cloudOtpCode) && (
          <SavedCodesDisplay state={licenseState} />
        )}

        <p className="text-center text-stone-700 text-xs mt-2">
          &copy; {new Date().getFullYear()} Gestionale Salone — Tutti i diritti riservati
        </p>
      </div>
    </div>
  );
}

function StepDot({ number, label, active, done }: { number: number; label: string; active: boolean; done: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${done ? 'bg-emerald-500 text-white' : active ? 'bg-amber-500 text-stone-900' : 'bg-stone-800 text-stone-600'}`}>
        {done ? <CheckCircle size={14} /> : number}
      </div>
      <span className={`text-xs transition-colors ${active ? 'text-stone-300' : done ? 'text-emerald-400' : 'text-stone-600'}`}>{label}</span>
    </div>
  );
}
