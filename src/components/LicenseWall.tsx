import { useState, useEffect } from 'react';
import { Shield, Lock, Key, CheckCircle, AlertCircle, ChevronRight, Scissors, RefreshCw } from 'lucide-react';
import {
  getLicenseState,
  verifyLocalOtp,
  verifyCloudOtp,
  getHardwareId,
  getCloudRequestId,
  type LicenseState,
} from '../lib/license';

interface Props {
  onActivated: () => void;
}

type Step = 'wall1' | 'wall2';

export default function LicenseWall({ onActivated }: Props) {
  const [licenseState, setLicenseState] = useState<LicenseState | null>(null);
  const [step, setStep] = useState<Step>('wall1');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    getLicenseState().then(state => {
      setLicenseState(state);
      if (state.localActivated && !state.cloudActivated) {
        setStep('wall2');
      }
    });
  }, []);

  async function handleVerify() {
    if (!otp.trim()) return;
    setLoading(true);
    setError('');
    try {
      if (step === 'wall1') {
        const ok = await verifyLocalOtp(otp);
        if (ok) {
          setSuccess(true);
          setTimeout(async () => {
            setSuccess(false);
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
          setSuccess(true);
          setTimeout(() => {
            onActivated();
          }, 1200);
        } else {
          setError('Codice non valido. Verifica il codice e riprova.');
        }
      }
    } finally {
      setLoading(false);
    }
  }

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
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

  return (
    <div className="min-h-screen bg-stone-950 flex items-center justify-center p-4">
      {/* Texture overlay */}
      <div
        className="fixed inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, #d4a96a 1px, transparent 0)`,
          backgroundSize: '40px 40px',
        }}
      />

      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-amber-500/5 blur-[120px]" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Header brand */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-amber-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-amber-500/20 mb-4">
            <Scissors size={28} className="text-stone-950" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Gestionale Salone</h1>
          <p className="text-stone-500 text-sm mt-1 tracking-widest uppercase">Sistema di Licenza</p>
        </div>

        {/* Progress steps */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <StepDot
            number={1}
            label="Attivazione Locale"
            active={step === 'wall1'}
            done={licenseState.localActivated}
          />
          <div className="w-12 h-px bg-stone-700" />
          <StepDot
            number={2}
            label="Attivazione Cloud"
            active={step === 'wall2'}
            done={licenseState.cloudActivated}
          />
        </div>

        {/* Card */}
        <div className="bg-stone-900 border border-stone-800 rounded-3xl overflow-hidden shadow-2xl">
          {/* Card header */}
          <div className="px-8 pt-8 pb-6 border-b border-stone-800">
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${step === 'wall1' ? 'bg-amber-500/15' : 'bg-sky-500/15'}`}>
                {step === 'wall1'
                  ? <Shield size={18} className="text-amber-400" />
                  : <Lock size={18} className="text-sky-400" />
                }
              </div>
              <div>
                <h2 className="text-white font-semibold text-base">
                  {step === 'wall1' ? 'Attivazione Desktop' : 'Attivazione Cloud'}
                </h2>
                <p className="text-stone-500 text-xs mt-0.5">
                  {step === 'wall1'
                    ? 'Parete 1 di 2 — Chiave Locale'
                    : 'Parete 2 di 2 — Chiave Cloud'}
                </p>
              </div>
            </div>

            <p className="text-stone-400 text-sm leading-relaxed">
              {step === 'wall1'
                ? 'Per attivare il software su questo dispositivo, comunica il tuo Hardware ID al supporto e inserisci il codice di attivazione ricevuto.'
                : 'Per abilitare la sincronizzazione cloud, comunica il tuo Cloud Request ID al supporto e inserisci il codice di attivazione ricevuto.'}
            </p>
          </div>

          {/* Device ID display */}
          <div className="px-8 py-5 border-b border-stone-800">
            <p className="text-stone-500 text-xs font-medium uppercase tracking-widest mb-2">
              {step === 'wall1' ? 'Il tuo Hardware ID' : 'Il tuo Cloud Request ID'}
            </p>
            <div className="flex items-center gap-3 bg-stone-800/60 rounded-xl px-4 py-3">
              <code className="text-amber-300 font-mono text-sm tracking-[0.15em] flex-1 select-all">
                {displayId || '—'}
              </code>
              <div className="flex items-center gap-1">
                <button
                  onClick={refreshIds}
                  className="p-1.5 rounded-lg text-stone-500 hover:text-stone-300 hover:bg-stone-700 transition-colors"
                  title="Aggiorna ID"
                >
                  <RefreshCw size={13} />
                </button>
                <button
                  onClick={() => copyToClipboard(displayId)}
                  className="px-3 py-1 rounded-lg text-xs font-medium transition-all duration-200"
                  style={{
                    background: copied ? 'rgb(16 185 129 / 0.15)' : 'rgb(255 255 255 / 0.06)',
                    color: copied ? '#34d399' : '#a8a29e',
                  }}
                >
                  {copied ? 'Copiato!' : 'Copia'}
                </button>
              </div>
            </div>
            <p className="text-stone-600 text-xs mt-2">
              Invia questo codice al supporto per ricevere la chiave di attivazione.
            </p>
          </div>

          {/* OTP input */}
          <div className="px-8 py-6">
            <label className="block text-stone-400 text-xs font-medium uppercase tracking-widest mb-2">
              Codice di Attivazione
            </label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2">
                <Key size={15} className="text-stone-600" />
              </div>
              <input
                type="text"
                value={otp}
                onChange={e => {
                  setOtp(e.target.value.toUpperCase().replace(/[^A-F0-9\-]/g, '').slice(0, 9));
                  setError('');
                }}
                onKeyDown={e => { if (e.key === 'Enter') handleVerify(); }}
                placeholder="XXXX-XXXX"
                maxLength={9}
                className="w-full bg-stone-800 border border-stone-700 rounded-xl pl-10 pr-4 py-3.5 text-white font-mono text-base tracking-widest placeholder-stone-600 focus:outline-none focus:border-amber-500/60 focus:ring-2 focus:ring-amber-500/10 transition-all"
                style={{ letterSpacing: '0.2em' }}
                autoFocus
                autoComplete="off"
                spellCheck={false}
              />
            </div>

            {/* Error */}
            {error && (
              <div className="mt-3 flex items-center gap-2 text-red-400 text-sm">
                <AlertCircle size={14} />
                <span>{error}</span>
              </div>
            )}

            {/* Success */}
            {success && (
              <div className="mt-3 flex items-center gap-2 text-emerald-400 text-sm">
                <CheckCircle size={14} />
                <span>Attivazione completata con successo!</span>
              </div>
            )}

            {/* CTA */}
            <button
              onClick={handleVerify}
              disabled={loading || !otp.trim() || success}
              className="mt-5 w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold text-sm transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: success
                  ? 'linear-gradient(135deg, #10b981, #059669)'
                  : 'linear-gradient(135deg, #f59e0b, #d97706)',
                color: '#0c0a09',
                boxShadow: success ? '0 4px 24px rgb(16 185 129 / 0.25)' : '0 4px 24px rgb(245 158 11 / 0.25)',
              }}
            >
              {loading
                ? <div className="w-4 h-4 border-2 border-stone-900/40 border-t-stone-900 rounded-full animate-spin" />
                : success
                ? <><CheckCircle size={16} /> Attivato!</>
                : <><ChevronRight size={16} /> Attiva</>
              }
            </button>
          </div>

          {/* Footer note */}
          <div className="px-8 py-4 bg-stone-950/40 border-t border-stone-800/60">
            <p className="text-stone-600 text-xs text-center">
              Per assistenza contatta il supporto tecnico.
              {step === 'wall2' && ' L\'attivazione cloud è necessaria per la sincronizzazione dei dati.'}
            </p>
          </div>
        </div>

        {/* Version */}
        <p className="text-center text-stone-700 text-xs mt-6">
          &copy; {new Date().getFullYear()} Gestionale Salone — Tutti i diritti riservati
        </p>
      </div>
    </div>
  );
}

function StepDot({ number, label, active, done }: { number: number; label: string; active: boolean; done: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
          done
            ? 'bg-emerald-500 text-white'
            : active
            ? 'bg-amber-500 text-stone-900'
            : 'bg-stone-800 text-stone-600'
        }`}
      >
        {done ? <CheckCircle size={14} /> : number}
      </div>
      <span className={`text-xs transition-colors ${active ? 'text-stone-300' : done ? 'text-emerald-400' : 'text-stone-600'}`}>
        {label}
      </span>
    </div>
  );
}
