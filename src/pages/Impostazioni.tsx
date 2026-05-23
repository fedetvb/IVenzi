import { useState, useEffect, useRef } from 'react';
import { Settings, Lock, Eye, EyeOff, Check, AlertCircle, ChevronRight, ArrowLeft, KeyRound, Bell, MessageCircle, MapPin, Tag, Plus, Trash2, Star, CreditCard as Edit3, X, Send, MessageSquare, ChevronDown, QrCode, Printer, ExternalLink, Download, DatabaseBackup, UploadCloud, AlertTriangle, Cloud, RefreshCw, Clock, CalendarDays, FolderOpen, UserCog, Mail } from 'lucide-react';
import { supabase, localDateStr } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import StatisticheGate from '../components/StatisticheGate';

type SubPage = null | 'password' | 'promemoria' | 'messaggio_avviso' | 'template_carta' | 'template_comunicazioni' | 'qrcode' | 'backup' | 'connessione' | 'account';

export default function Impostazioni({ onTestReminder }: { onTestReminder?: () => void }) {
  const [sub, setSub] = useState<SubPage>(null);
  const [msgOpen, setMsgOpen] = useState(false);

  if (sub === 'account') return (
    <StatisticheGate isActive={sub === 'account'} chiave="password_account" sezione="account e credenziali" sessionKey="account_unlocked">
      <PaginaAccount onBack={() => setSub(null)} />
    </StatisticheGate>
  );
  if (sub === 'password') return <PaginaPassword onBack={() => setSub(null)} />;
  if (sub === 'promemoria') return <PaginaPromemoria onBack={() => setSub(null)} onTestReminder={onTestReminder} />;
  if (sub === 'messaggio_avviso') return <PaginaMessaggioAvviso onBack={() => setSub(null)} />;
  if (sub === 'template_carta') return <PaginaTemplateCarta onBack={() => setSub(null)} />;
  if (sub === 'template_comunicazioni') return <PaginaTemplateComunicazioni onBack={() => setSub(null)} />;
  if (sub === 'qrcode') return <PaginaQRCode onBack={() => setSub(null)} />;
  if (sub === 'backup') return <PaginaBackup onBack={() => setSub(null)} />;
  if (sub === 'connessione') return <PaginaConnessione onBack={() => setSub(null)} />;

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-stone-800">Impostazioni</h2>
        <p className="text-sm text-stone-500 mt-1">Gestisci le impostazioni del gestionale</p>
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden divide-y divide-stone-100">
        {/* Account */}
        <button
          onClick={() => setSub('account')}
          className="w-full flex items-center gap-4 px-6 py-4 hover:bg-stone-50 transition-colors group"
        >
          <div className="w-10 h-10 rounded-xl bg-stone-100 group-hover:bg-blue-100 flex items-center justify-center flex-shrink-0 transition-colors">
            <UserCog size={18} className="text-stone-500 group-hover:text-blue-600 transition-colors" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-semibold text-stone-800">Account e Credenziali</p>
            <p className="text-xs text-stone-400 mt-0.5">Modifica email e password di accesso al gestionale</p>
          </div>
          <ChevronRight size={16} className="text-stone-400 group-hover:text-stone-600 transition-colors" />
        </button>

        {/* Password */}
        <button
          onClick={() => setSub('password')}
          className="w-full flex items-center gap-4 px-6 py-4 hover:bg-stone-50 transition-colors group"
        >
          <div className="w-10 h-10 rounded-xl bg-stone-100 group-hover:bg-amber-100 flex items-center justify-center flex-shrink-0 transition-colors">
            <KeyRound size={18} className="text-stone-500 group-hover:text-amber-600 transition-colors" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-semibold text-stone-800">Password</p>
            <p className="text-xs text-stone-400 mt-0.5">Gestisci le password di accesso alle sezioni protette</p>
          </div>
          <ChevronRight size={16} className="text-stone-400 group-hover:text-stone-600 transition-colors" />
        </button>

        {/* Promemoria */}
        <button
          onClick={() => setSub('promemoria')}
          className="w-full flex items-center gap-4 px-6 py-4 hover:bg-stone-50 transition-colors group"
        >
          <div className="w-10 h-10 rounded-xl bg-stone-100 group-hover:bg-amber-100 flex items-center justify-center flex-shrink-0 transition-colors">
            <Bell size={18} className="text-stone-500 group-hover:text-amber-600 transition-colors" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-semibold text-stone-800">Promemoria Convalida Fiches</p>
            <p className="text-xs text-stone-400 mt-0.5">Configura giorni e orario per il promemoria di convalida giornaliero</p>
          </div>
          <ChevronRight size={16} className="text-stone-400 group-hover:text-stone-600 transition-colors" />
        </button>

        {/* Gruppo Messaggi e Comunicazioni */}
        <div>
          <button
            onClick={() => setMsgOpen(o => !o)}
            className="w-full flex items-center gap-4 px-6 py-4 hover:bg-stone-50 transition-colors group"
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${msgOpen ? 'bg-emerald-100' : 'bg-stone-100 group-hover:bg-emerald-100'}`}>
              <MessageSquare size={18} className={`transition-colors ${msgOpen ? 'text-emerald-600' : 'text-stone-500 group-hover:text-emerald-600'}`} />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-semibold text-stone-800">Messaggi e Comunicazioni</p>
              <p className="text-xs text-stone-400 mt-0.5">Avvisi appuntamento, template carta sconto e messaggi comunicazioni</p>
            </div>
            <ChevronDown size={16} className={`text-stone-400 transition-transform duration-200 ${msgOpen ? 'rotate-180' : ''}`} />
          </button>

          {msgOpen && (
            <div className="border-t border-stone-100 divide-y divide-stone-50 bg-stone-50/60">
              <button
                onClick={() => setSub('messaggio_avviso')}
                className="w-full flex items-center gap-4 pl-10 pr-6 py-3.5 hover:bg-stone-100/60 transition-colors group"
              >
                <div className="w-8 h-8 rounded-lg bg-white border border-stone-200 group-hover:border-emerald-300 flex items-center justify-center flex-shrink-0 transition-colors">
                  <MessageCircle size={15} className="text-stone-400 group-hover:text-emerald-600 transition-colors" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium text-stone-700">Messaggio Avviso Appuntamento</p>
                  <p className="text-xs text-stone-400 mt-0.5">Personalizza il testo WhatsApp per il promemoria appuntamento</p>
                </div>
                <ChevronRight size={14} className="text-stone-300 group-hover:text-stone-500 transition-colors" />
              </button>

              <button
                onClick={() => setSub('template_carta')}
                className="w-full flex items-center gap-4 pl-10 pr-6 py-3.5 hover:bg-stone-100/60 transition-colors group"
              >
                <div className="w-8 h-8 rounded-lg bg-white border border-stone-200 group-hover:border-rose-300 flex items-center justify-center flex-shrink-0 transition-colors">
                  <Tag size={15} className="text-stone-400 group-hover:text-rose-500 transition-colors" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium text-stone-700">Template Messaggi Carta Sconto</p>
                  <p className="text-xs text-stone-400 mt-0.5">Modelli per carte sconto (Natale, compleanno, regalo...)</p>
                </div>
                <ChevronRight size={14} className="text-stone-300 group-hover:text-stone-500 transition-colors" />
              </button>

              <button
                onClick={() => setSub('template_comunicazioni')}
                className="w-full flex items-center gap-4 pl-10 pr-6 py-3.5 hover:bg-stone-100/60 transition-colors group"
              >
                <div className="w-8 h-8 rounded-lg bg-white border border-stone-200 group-hover:border-sky-300 flex items-center justify-center flex-shrink-0 transition-colors">
                  <Send size={15} className="text-stone-400 group-hover:text-sky-500 transition-colors" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium text-stone-700">Template Messaggi Comunicazioni</p>
                  <p className="text-xs text-stone-400 mt-0.5">Messaggi predefiniti per comunicazioni (compleanno, feste, promo...)</p>
                </div>
                <ChevronRight size={14} className="text-stone-300 group-hover:text-stone-500 transition-colors" />
              </button>
            </div>
          )}
        </div>

        {/* QR Code registrazione */}
        <button
          onClick={() => setSub('qrcode')}
          className="w-full flex items-center gap-4 px-6 py-4 hover:bg-stone-50 transition-colors group"
        >
          <div className="w-10 h-10 rounded-xl bg-stone-100 group-hover:bg-amber-100 flex items-center justify-center flex-shrink-0 transition-colors">
            <QrCode size={18} className="text-stone-500 group-hover:text-amber-600 transition-colors" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-semibold text-stone-800">QR Code Registrazione Clienti</p>
            <p className="text-xs text-stone-400 mt-0.5">Stampa il QR code da esporre in salone per le nuove clienti</p>
          </div>
          <ChevronRight size={16} className="text-stone-400 group-hover:text-stone-600 transition-colors" />
        </button>

        {/* Backup e Ripristino */}
        <button
          onClick={() => setSub('backup')}
          className="w-full flex items-center gap-4 px-6 py-4 hover:bg-stone-50 transition-colors group"
        >
          <div className="w-10 h-10 rounded-xl bg-stone-100 group-hover:bg-teal-100 flex items-center justify-center flex-shrink-0 transition-colors">
            <DatabaseBackup size={18} className="text-stone-500 group-hover:text-teal-600 transition-colors" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-semibold text-stone-800">Backup e Ripristino</p>
            <p className="text-xs text-stone-400 mt-0.5">Esporta tutti i dati in un file o ripristina da un backup precedente</p>
          </div>
          <ChevronRight size={16} className="text-stone-400 group-hover:text-stone-600 transition-colors" />
        </button>

        {/* Connessione Cloud */}
        <button
          onClick={() => setSub('connessione')}
          className="w-full flex items-center gap-4 px-6 py-4 hover:bg-stone-50 transition-colors group"
        >
          <div className="w-10 h-10 rounded-xl bg-stone-100 group-hover:bg-blue-100 flex items-center justify-center flex-shrink-0 transition-colors">
            <Cloud size={18} className="text-stone-500 group-hover:text-blue-600 transition-colors" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-semibold text-stone-800">Connessione Cloud</p>
            <p className="text-xs text-stone-400 mt-0.5">Modifica le chiavi API per connettere il gestionale al database</p>
          </div>
          <ChevronRight size={16} className="text-stone-400 group-hover:text-stone-600 transition-colors" />
        </button>
      </div>
    </div>
  );
}

// ─── Backup automatico: chiavi localStorage ───────────────────────────────────
const AB_ENABLED_KEY = 'auto_backup_enabled';
const AB_TIME_KEY = 'auto_backup_time';     // "HH:MM"
const AB_DAYS_KEY = 'auto_backup_days';     // "0,1,2,3,4,5,6" (0=dom)
const AB_LAST_KEY = 'auto_backup_last';     // "YYYY-MM-DD"

const GIORNI_SETTIMANA = [
  { label: 'Dom', value: 0 },
  { label: 'Lun', value: 1 },
  { label: 'Mar', value: 2 },
  { label: 'Mer', value: 3 },
  { label: 'Gio', value: 4 },
  { label: 'Ven', value: 5 },
  { label: 'Sab', value: 6 },
];

async function runAutoBackupIfDue(): Promise<boolean> {
  if (localStorage.getItem(AB_ENABLED_KEY) !== '1') return false;
  const timeStr = localStorage.getItem(AB_TIME_KEY) ?? '02:00';
  const daysStr = localStorage.getItem(AB_DAYS_KEY) ?? '1,2,3,4,5';
  const lastStr = localStorage.getItem(AB_LAST_KEY) ?? '';

  const now = new Date();
  const todayStr = localDateStr(now);
  if (lastStr === todayStr) return false; // già fatto oggi

  const allowedDays = daysStr.split(',').map(Number);
  if (!allowedDays.includes(now.getDay())) return false;

  const [hh, mm] = timeStr.split(':').map(Number);
  const scheduled = new Date(now);
  scheduled.setHours(hh, mm, 0, 0);
  if (now < scheduled) return false; // orario non ancora raggiunto

  try {
    const sbUrl = localStorage.getItem('sb_custom_url') || import.meta.env.VITE_SUPABASE_URL;
    const sbKey = localStorage.getItem('sb_custom_anon_key') || import.meta.env.VITE_SUPABASE_ANON_KEY;
    const apiUrl = `${sbUrl}/functions/v1/backup-database`;
    const res = await fetch(apiUrl, {
      headers: { Authorization: `Bearer ${sbKey}`, 'Content-Type': 'application/json' },
    });
    if (!res.ok) return false;
    const data = await res.json();
    const jsonStr = JSON.stringify(data, null, 2);
    const filename = `backup-salone-${todayStr}.json`;

    if ('showSaveFilePicker' in window) {
      try {
        const handle = await (window as Window & { showSaveFilePicker: (o: object) => Promise<FileSystemFileHandle> }).showSaveFilePicker({
          suggestedName: filename,
          types: [{ description: 'Backup JSON', accept: { 'application/json': ['.json'] } }],
        });
        const w = await handle.createWritable();
        await w.write(jsonStr);
        await w.close();
      } catch (e) {
        if ((e as { name?: string }).name === 'AbortError') return false;
        throw e;
      }
    } else {
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
    }
    localStorage.setItem(AB_LAST_KEY, todayStr);
    return true;
  } catch {
    return false;
  }
}

/**
 * Avvia il watcher per il backup automatico.
 *
 * In Electron: il processo main gestisce lo scheduling e invia l'evento
 * 'trigger-auto-backup' al renderer quando è il momento. Il renderer
 * si occupa solo di scaricare i dati e salvarli tramite il dialogo nativo.
 *
 * In browser: controlla ogni minuto se è l'orario giusto.
 */
export function startAutoBackupWatcher() {
  if (window.electronAPI) {
    // Electron: ascolta l'evento dal processo main
    window.electronAPI.onTriggerAutoBackup(async ({ todayStr }) => {
      const sbUrl = import.meta.env.VITE_SUPABASE_URL;
      const sbKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      try {
        const res = await fetch(`${sbUrl}/functions/v1/backup-database`, {
          headers: { Authorization: `Bearer ${sbKey}`, 'Content-Type': 'application/json' },
        });
        if (!res.ok) return;
        const data = await res.json();
        const jsonStr = JSON.stringify(data, null, 2);
        const filename = `backup-salone-${todayStr}.json`;
        // Prova prima il salvataggio silenzioso nella cartella configurata
        const result = await window.electronAPI!.saveBackupAuto(filename, jsonStr);
        if (result.ok) {
          await window.electronAPI!.markBackupDone(todayStr);
        } else if (result.reason === 'no-folder') {
          // Nessuna cartella configurata: apri "Salva come" come fallback
          const manual = await window.electronAPI!.saveBackupFile(filename, jsonStr);
          if (manual.ok) await window.electronAPI!.markBackupDone(todayStr);
        }
      } catch { /* silenzioso */ }
    });
  } else {
    // Browser: polling ogni minuto
    runAutoBackupIfDue();
    setInterval(runAutoBackupIfDue, 60_000);
  }
}

// ─── Pagina Backup e Ripristino ───────────────────────────────────────────────

function PaginaBackup({ onBack }: { onBack: () => void }) {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [feedback, setFeedback] = useState<{ tipo: 'ok' | 'err' | 'warn'; msg: string } | null>(null);
  const [confirmRestore, setConfirmRestore] = useState<File | null>(null);
  const [restorePreview, setRestorePreview] = useState<Record<string, number> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isElectron = !!window.electronAPI;

  // Backup automatico
  const [abEnabled, setAbEnabled] = useState(() => localStorage.getItem(AB_ENABLED_KEY) === '1');
  const [abTime, setAbTime] = useState(() => localStorage.getItem(AB_TIME_KEY) ?? '08:00');
  const [abDays, setAbDays] = useState<number[]>(() => {
    const s = localStorage.getItem(AB_DAYS_KEY);
    return s ? s.split(',').map(Number) : [1, 2, 3, 4, 5];
  });
  const [abFolder, setAbFolder] = useState('');
  const [abSaved, setAbSaved] = useState(false);
  const [abLast, setAbLast] = useState(() => localStorage.getItem(AB_LAST_KEY) ?? '');

  // Se in Electron, carica la config dal processo principale
  useEffect(() => {
    if (!window.electronAPI) return;
    window.electronAPI.getBackupConfig().then(cfg => {
      setAbEnabled(cfg.enabled);
      setAbTime(cfg.time);
      setAbDays(cfg.days);
      setAbLast(cfg.last);
      setAbFolder(cfg.folder ?? '');
    });
  }, []);

  async function pickFolder() {
    if (!window.electronAPI) return;
    const result = await window.electronAPI.pickBackupFolder();
    if (result.ok && result.folder) setAbFolder(result.folder);
  }

  function toggleDay(d: number) {
    setAbDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort());
  }

  async function saveAutoBackup() {
    if (window.electronAPI) {
      await window.electronAPI.setBackupConfig({ enabled: abEnabled, time: abTime, days: abDays, last: abLast, folder: abFolder });
    } else {
      localStorage.setItem(AB_ENABLED_KEY, abEnabled ? '1' : '0');
      localStorage.setItem(AB_TIME_KEY, abTime);
      localStorage.setItem(AB_DAYS_KEY, abDays.join(','));
    }
    setAbSaved(true);
    setTimeout(() => setAbSaved(false), 2000);
  }

  const apiUrl = `${localStorage.getItem('sb_custom_url') || import.meta.env.VITE_SUPABASE_URL}/functions/v1/backup-database`;
  const headers = {
    'Authorization': `Bearer ${localStorage.getItem('sb_custom_anon_key') || import.meta.env.VITE_SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
  };

  async function handleExport() {
    setExporting(true);
    setFeedback(null);
    try {
      const res = await fetch(apiUrl, { headers });
      if (!res.ok) throw new Error('Errore durante l\'esportazione');
      const data = await res.json();
      const jsonStr = JSON.stringify(data, null, 2);
      const suggestedName = `backup-salone-${localDateStr()}.json`;

      // Electron: usa dialog nativo del sistema operativo
      if (window.electronAPI) {
        const result = await window.electronAPI.saveBackupFile(suggestedName, jsonStr);
        if (result.ok) {
          setFeedback({ tipo: 'ok', msg: `Backup salvato in: ${result.filePath}` });
        } else if (result.reason !== 'canceled') {
          setFeedback({ tipo: 'err', msg: `Errore: ${result.reason}` });
        }
        return;
      }

      // Browser: File System Access API se disponibile
      if ('showSaveFilePicker' in window) {
        try {
          const handle = await (window as Window & { showSaveFilePicker: (opts: object) => Promise<FileSystemFileHandle> }).showSaveFilePicker({
            suggestedName,
            types: [{ description: 'File di backup JSON', accept: { 'application/json': ['.json'] } }],
          });
          const writable = await handle.createWritable();
          await writable.write(jsonStr);
          await writable.close();
          setFeedback({ tipo: 'ok', msg: 'Backup salvato con successo.' });
          return;
        } catch (pickerErr) {
          if ((pickerErr as { name?: string }).name === 'AbortError') return;
        }
      }

      // Fallback: download diretto
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = suggestedName;
      a.click();
      URL.revokeObjectURL(url);
      setFeedback({ tipo: 'ok', msg: 'Backup esportato con successo.' });
    } catch (e) {
      setFeedback({ tipo: 'err', msg: String(e) });
    } finally {
      setExporting(false);
    }
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setFeedback(null);

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed?.data || !parsed?.tables) throw new Error('File non valido');

      const preview: Record<string, number> = {};
      for (const table of parsed.tables) {
        preview[table] = (parsed.data[table] ?? []).length;
      }
      setRestorePreview(preview);
      setConfirmRestore(file);
    } catch {
      setFeedback({ tipo: 'err', msg: 'File non valido. Assicurati di selezionare un file di backup generato da questo programma.' });
    }
  }

  async function handleRestore() {
    if (!confirmRestore) return;
    setImporting(true);
    setFeedback(null);
    setConfirmRestore(null);
    setRestorePreview(null);

    try {
      const text = await confirmRestore.text();
      const parsed = JSON.parse(text);

      const res = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(parsed),
      });
      const result = await res.json();

      if (result.success) {
        setFeedback({ tipo: 'ok', msg: 'Ripristino completato. Tutti i dati sono stati ripristinati dal backup.' });
      } else {
        const errors = Object.entries(result.results ?? {})
          .filter(([, v]) => !(v as { ok: boolean }).ok)
          .map(([k]) => k)
          .join(', ');
        setFeedback({ tipo: 'warn', msg: `Ripristino parziale. Errori nelle tabelle: ${errors}` });
      }
    } catch (e) {
      setFeedback({ tipo: 'err', msg: `Errore durante il ripristino: ${String(e)}` });
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 hover:bg-stone-100 rounded-xl transition-colors text-stone-500 hover:text-stone-800">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-stone-800">Backup e Ripristino</h2>
          <p className="text-sm text-stone-500 mt-0.5">Esporta o ripristina tutti i dati del gestionale</p>
        </div>
      </div>

      {feedback && (
        <div className={`flex items-start gap-3 px-4 py-3.5 rounded-xl text-sm border ${
          feedback.tipo === 'ok'
            ? 'bg-green-50 text-green-800 border-green-200'
            : feedback.tipo === 'warn'
            ? 'bg-amber-50 text-amber-800 border-amber-200'
            : 'bg-red-50 text-red-800 border-red-200'
        }`}>
          {feedback.tipo === 'ok' && <Check size={16} className="flex-shrink-0 mt-0.5" />}
          {feedback.tipo === 'warn' && <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />}
          {feedback.tipo === 'err' && <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />}
          <p>{feedback.msg}</p>
        </div>
      )}

      {/* Sezione Esporta */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-stone-100 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-teal-50 flex items-center justify-center flex-shrink-0">
            <Download size={16} className="text-teal-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-stone-800">Esporta backup</h3>
            <p className="text-xs text-stone-500">Scarica un file JSON con tutti i dati del gestionale</p>
          </div>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="bg-stone-50 rounded-xl p-4 space-y-2">
            <p className="text-xs font-semibold text-stone-700">Il backup include:</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              {['Clienti', 'Appuntamenti', 'Fiches e voci', 'Incassi', 'Carte sconto', 'Carte premium', 'Ricariche', 'Rivendita prodotti', 'Schede colore', 'Parrucchieri', 'Catalogo servizi', 'Impostazioni', 'Template messaggi', 'Assenze parrucchieri', 'Magazzino', 'Tutte le tabelle future'].map(item => (
                <div key={item} className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-teal-500 flex-shrink-0" />
                  <span className="text-xs text-stone-600">{item}</span>
                </div>
              ))}
            </div>
          </div>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center justify-center gap-2 w-full py-3 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-semibold text-sm rounded-xl transition-colors shadow-sm"
          >
            <Download size={15} />
            {exporting ? 'Esportazione in corso...' : 'Scarica backup completo'}
          </button>
        </div>
      </div>

      {/* Sezione Ripristina */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-stone-100 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
            <UploadCloud size={16} className="text-amber-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-stone-800">Ripristina da backup</h3>
            <p className="text-xs text-stone-500">Carica un file di backup per ripristinare i dati</p>
          </div>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle size={15} className="text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-700 leading-relaxed">
              <strong>Attenzione:</strong> il ripristino sovrascrive tutti i dati attuali con quelli del backup. Questa operazione non è reversibile. Esegui prima un backup dei dati attuali se necessario.
            </p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileSelect}
            className="hidden"
          />

          {!confirmRestore ? (
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              className="flex items-center justify-center gap-2 w-full py-3 border-2 border-dashed border-stone-300 hover:border-amber-400 hover:bg-amber-50 disabled:opacity-50 text-stone-600 hover:text-amber-700 font-semibold text-sm rounded-xl transition-colors"
            >
              <UploadCloud size={15} />
              {importing ? 'Ripristino in corso...' : 'Seleziona file di backup (.json)'}
            </button>
          ) : (
            <div className="space-y-4">
              <div className="bg-stone-50 rounded-xl p-4 border border-stone-200">
                <p className="text-xs font-bold text-stone-700 mb-3">Dati nel file selezionato:</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 max-h-48 overflow-y-auto">
                  {restorePreview && Object.entries(restorePreview).map(([table, count]) => (
                    <div key={table} className="flex items-center justify-between gap-2">
                      <span className="text-xs text-stone-600 truncate">{table}</span>
                      <span className="text-xs font-bold text-stone-800 flex-shrink-0">{count} righe</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => { setConfirmRestore(null); setRestorePreview(null); }}
                  className="flex-1 py-3 border border-stone-200 rounded-xl text-sm font-semibold text-stone-600 hover:bg-stone-50 transition-colors"
                >
                  Annulla
                </button>
                <button
                  onClick={handleRestore}
                  disabled={importing}
                  className="flex-1 py-3 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold text-sm rounded-xl transition-colors shadow-sm flex items-center justify-center gap-2"
                >
                  <UploadCloud size={14} />
                  {importing ? 'Ripristino...' : 'Conferma ripristino'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sezione Backup Automatico */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-stone-100 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
            <Clock size={16} className="text-blue-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-stone-800">Backup automatico</h3>
            <p className="text-xs text-stone-500">
              {isElectron
                ? 'Schedulato dal sistema operativo — funziona anche con il programma minimizzato'
                : 'Il backup scatta mentre il programma è aperto nel browser'}
            </p>
          </div>
          {isElectron && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700 flex-shrink-0">
              App desktop
            </span>
          )}
          {/* Toggle */}
          <button
            onClick={() => setAbEnabled(v => !v)}
            className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${abEnabled ? 'bg-blue-500' : 'bg-stone-200'}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${abEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
          </button>
        </div>

        <div className={`transition-all duration-200 ${abEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
          <div className="px-6 py-5 space-y-5">

            {/* Orario */}
            <div>
              <label className="block text-sm font-semibold text-stone-700 mb-2 flex items-center gap-2">
                <Clock size={14} className="text-stone-400" />
                Orario del backup
              </label>
              <input
                type="time"
                value={abTime}
                onChange={e => setAbTime(e.target.value)}
                className="px-4 py-2.5 border border-stone-200 rounded-xl bg-stone-50 text-stone-800 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent text-sm font-mono transition"
              />
              <p className="text-xs text-stone-400 mt-1.5">
                {isElectron
                  ? 'Il backup scatta esattamente a quest\'orario — anche con il programma minimizzato'
                  : 'Il backup scatta all\'orario impostato se il browser è aperto, oppure al primo avvio dopo quell\'ora'}
              </p>
            </div>

            {/* Cartella destinazione (solo Electron) */}
            {isElectron && (
              <div>
                <label className="block text-sm font-semibold text-stone-700 mb-2 flex items-center gap-2">
                  <FolderOpen size={14} className="text-stone-400" />
                  Cartella di destinazione
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 px-3 py-2.5 border border-stone-200 rounded-xl bg-stone-50 text-sm text-stone-600 font-mono truncate min-w-0">
                    {abFolder || <span className="text-stone-400 italic font-sans">Nessuna cartella selezionata</span>}
                  </div>
                  <button
                    onClick={pickFolder}
                    className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2.5 border border-stone-300 rounded-xl text-sm font-semibold text-stone-700 hover:bg-stone-100 transition-colors"
                  >
                    <FolderOpen size={14} />
                    Scegli
                  </button>
                  {abFolder && (
                    <button
                      onClick={() => window.electronAPI?.showFolder(abFolder)}
                      title="Apri cartella"
                      className="flex-shrink-0 p-2.5 border border-stone-200 rounded-xl text-stone-500 hover:bg-stone-100 transition-colors"
                    >
                      <ExternalLink size={14} />
                    </button>
                  )}
                </div>
                <p className="text-xs text-stone-400 mt-1.5">
                  {abFolder
                    ? 'I backup automatici verranno salvati qui senza chiedere conferma'
                    : 'Senza cartella configurata verrà chiesto dove salvare ad ogni backup'}
                </p>
              </div>
            )}

            {/* Giorni */}
            <div>
              <label className="block text-sm font-semibold text-stone-700 mb-2 flex items-center gap-2">
                <CalendarDays size={14} className="text-stone-400" />
                Giorni della settimana
              </label>
              <div className="flex gap-2 flex-wrap">
                {GIORNI_SETTIMANA.map(({ label, value }) => (
                  <button
                    key={value}
                    onClick={() => toggleDay(value)}
                    className={`w-11 h-11 rounded-xl text-xs font-bold transition-all ${
                      abDays.includes(value)
                        ? 'bg-blue-500 text-white shadow-sm'
                        : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Ultimo backup */}
            {abLast && (
              <div className="flex items-center gap-2 text-xs text-stone-500">
                <Check size={13} className="text-green-500 flex-shrink-0" />
                Ultimo backup automatico: <span className="font-semibold text-stone-700">{abLast}</span>
              </div>
            )}

            {/* Salva */}
            <button
              onClick={saveAutoBackup}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-500 hover:bg-blue-600 text-white font-semibold text-sm rounded-xl transition-colors shadow-sm"
            >
              {abSaved ? <Check size={14} /> : <Settings size={14} />}
              {abSaved ? 'Salvato!' : 'Salva impostazioni'}
            </button>
          </div>
        </div>

        {!abEnabled && (
          <div className="px-6 py-4 text-xs text-stone-400">
            Attiva il backup automatico per configurare orario e giorni.
          </div>
        )}
      </div>

      <div className="bg-teal-50 border border-teal-200 rounded-xl p-4">
        <p className="text-xs font-bold text-teal-800 mb-1">Consiglio</p>
        <p className="text-xs text-teal-700 leading-relaxed">
          Esegui un backup regolare (settimanale o mensile) e conserva i file in un posto sicuro come Google Drive o una chiavetta USB. Il backup include automaticamente qualsiasi nuova tabella aggiunta in futuro.
        </p>
      </div>
    </div>
  );
}

// ─── Pagina QR Code ───────────────────────────────────────────────────────────

function PaginaQRCode({ onBack }: { onBack: () => void }) {
  const printRef = useRef<HTMLDivElement>(null);
  const [registrazioneUrl, setRegistrazioneUrl] = useState('https://silver-kitsune-3a0339.netlify.app/');
  const [editingUrl, setEditingUrl] = useState(false);
  const [urlDraft, setUrlDraft] = useState('');
  const [savingUrl, setSavingUrl] = useState(false);

  useEffect(() => {
    supabase.from('impostazioni').select('valore').eq('chiave', 'registrazione_url').maybeSingle().then(({ data }) => {
      if (data?.valore) setRegistrazioneUrl(data.valore);
    });
  }, []);

  async function handleSaveUrl() {
    const trimmed = urlDraft.trim();
    if (!trimmed) return;
    setSavingUrl(true);
    await supabase.from('impostazioni').upsert({ chiave: 'registrazione_url', valore: trimmed }, { onConflict: 'chiave' });
    setRegistrazioneUrl(trimmed);
    setEditingUrl(false);
    setSavingUrl(false);
  }

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=10&data=${encodeURIComponent(registrazioneUrl)}`;

  async function handleDownloadHtml() {
    const SU = import.meta.env.VITE_SUPABASE_URL as string;
    const SK = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
    const html = `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Scheda Cliente</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:linear-gradient(135deg,#fafaf9 0%,#fffbeb 100%);min-height:100vh;color:#1c1917}
.header{background:white;border-bottom:1.5px solid #e7e5e4;padding:20px 24px;text-align:center;position:sticky;top:0;z-index:10}
.hi{display:inline-flex;align-items:center;gap:10px;margin-bottom:4px}
.logo{width:36px;height:36px;background:#f59e0b;border-radius:10px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(245,158,11,.3)}
.header h1{font-size:18px;font-weight:700;color:#1c1917}
.header p{font-size:13px;color:#78716c}
.container{max-width:460px;margin:0 auto;padding:28px 20px 48px}
.fg{margin-bottom:18px}
label{display:block;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#57534e;margin-bottom:6px}
.req{color:#f87171}
.iw{position:relative}
input,textarea{width:100%;padding:13px 16px;background:white;border:1.5px solid #e7e5e4;border-radius:14px;font-size:14px;color:#1c1917;outline:none;transition:border-color .15s,box-shadow .15s;-webkit-appearance:none;font-family:inherit}
input:focus,textarea:focus{border-color:#f59e0b;box-shadow:0 0 0 3px rgba(245,158,11,.15)}
input::placeholder,textarea::placeholder{color:#c4bfbb}
textarea{resize:none;line-height:1.5}
.privacy{font-size:12px;color:#a8a29e;line-height:1.7;margin-bottom:22px;padding:12px 14px;background:#fafaf9;border-radius:10px;border:1px solid #f0ece8}
.btn{width:100%;padding:16px;background:#f59e0b;color:white;font-size:15px;font-weight:700;border:none;border-radius:14px;cursor:pointer;transition:background .15s,box-shadow .15s;box-shadow:0 4px 14px rgba(245,158,11,.35)}
.btn:hover{background:#e89000}
.btn:disabled{opacity:.55;cursor:not-allowed;box-shadow:none}
.eb{display:flex;align-items:center;gap:10px;background:#fef2f2;border:1.5px solid #fecaca;border-radius:12px;padding:12px 16px;margin-bottom:16px;font-size:13px;color:#dc2626}
.divider{height:1px;background:#f0ece8;margin:8px 0 22px}
.st{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.1em;color:#a8a29e;margin-bottom:14px;margin-top:6px}
.ss{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:80vh;text-align:center;padding:40px 24px}
.si{width:88px;height:88px;background:#dcfce7;border-radius:50%;display:flex;align-items:center;justify-content:center;margin-bottom:24px}
.ss h2{font-size:28px;font-weight:800;color:#1c1917;margin-bottom:12px}
.ss p{font-size:15px;color:#78716c;line-height:1.7;max-width:290px}
</style>
</head>
<body>
<div class="header">
  <div class="hi"><div class="logo"></div><h1>Scheda Cliente</h1></div>
  <p>Compila il modulo per registrarti</p>
</div>
<div id="app">
  <div class="container">
    <form id="f" novalidate>
      <p class="st">Dati personali</p>
      <div class="fg"><label>Nome <span class="req">*</span></label><input type="text" id="nome" placeholder="Il tuo nome" autocomplete="given-name"/></div>
      <div class="fg"><label>Cognome <span class="req">*</span></label><input type="text" id="cognome" placeholder="Il tuo cognome" autocomplete="family-name"/></div>
      <div class="fg"><label>Data di nascita</label><input type="date" id="dn" autocomplete="bday"/></div>
      <div class="divider"></div>
      <p class="st">Contatti</p>
      <div class="fg"><label>Telefono</label><input type="tel" id="telefono" placeholder="+39 333 000 0000" autocomplete="tel"/></div>
      <div class="fg"><label>Email</label><input type="email" id="email" placeholder="nome@esempio.it" autocomplete="email"/></div>
      <div class="divider"></div>
      <p class="st">Note aggiuntive</p>
      <div class="fg"><label>Allergie / Preferenze</label><textarea id="note" rows="3" placeholder="Allergie, preferenze, informazioni utili..."></textarea></div>
      <div id="err" class="eb" style="display:none"><span id="em"></span></div>
      <p class="privacy">I tuoi dati saranno utilizzati esclusivamente per la gestione della scheda cliente nel salone e non saranno ceduti a terzi.</p>
      <button type="submit" class="btn" id="btn">Invia la mia scheda</button>
    </form>
  </div>
</div>
<script>
var SU="${SU}",SK="${SK}";
document.getElementById("f").onsubmit=async function(e){
  e.preventDefault();
  var n=document.getElementById("nome").value.trim();
  var c=document.getElementById("cognome").value.trim();
  var t=document.getElementById("telefono").value.trim();
  var em=document.getElementById("email").value.trim();
  var d=document.getElementById("dn").value||null;
  var no=document.getElementById("note").value.trim();
  var ed=document.getElementById("err");
  var emsg=document.getElementById("em");
  var btn=document.getElementById("btn");
  if(!n||!c){emsg.textContent="Nome e cognome sono obbligatori.";ed.style.display="flex";return;}
  ed.style.display="none";btn.disabled=true;btn.textContent="Invio in corso...";
  try{
    var r=await fetch(SU+"/rest/v1/schede_clienti_da_confermare",{method:"POST",headers:{"Content-Type":"application/json","apikey":SK,"Authorization":"Bearer "+SK,"Prefer":"return=minimal"},body:JSON.stringify({nome:n,cognome:c,telefono:t||null,email:em||null,data_nascita:d,note:no||null,stato:"in_attesa"})});
    if(!r.ok)throw 1;
    document.getElementById("app").innerHTML='<div class="ss"><div class="si"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div><h2>Grazie!</h2><p>I tuoi dati sono stati inviati correttamente. Il nostro staff creer\u00e0 la tua scheda al pi\u00f9 presto.</p></div>';
  }catch(x){btn.disabled=false;btn.textContent="Invia la mia scheda";emsg.textContent="Si \u00e8 verificato un errore. Riprova.";ed.style.display="flex";}
};
</script>
</body>
</html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const filename = 'registrazione-cliente.html';
    if ('showSaveFilePicker' in window) {
      try {
        const handle = await (window as Window & { showSaveFilePicker: (opts: object) => Promise<FileSystemFileHandle> }).showSaveFilePicker({
          suggestedName: filename,
          types: [{ description: 'Pagina HTML', accept: { 'text/html': ['.html'] } }],
        });
        const writable = await handle.createWritable();
        await writable.write(html);
        await writable.close();
        return;
      } catch (e) {
        if ((e as { name?: string }).name === 'AbortError') return;
      }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handlePrint() {
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8" />
        <title>QR Code Registrazione Clienti</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Georgia, serif; background: white; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 40px; }
          .card { border: 2px solid #d6d3d1; border-radius: 24px; padding: 48px 40px; text-align: center; max-width: 400px; width: 100%; }
          h1 { font-size: 22px; font-weight: bold; color: #1c1917; margin-bottom: 6px; }
          .subtitle { font-size: 14px; color: #78716c; margin-bottom: 32px; line-height: 1.5; }
          .qr { width: 220px; height: 220px; margin: 0 auto 24px; border: 1px solid #e7e5e4; border-radius: 16px; padding: 12px; }
          .steps { text-align: left; background: #fafaf9; border-radius: 12px; padding: 20px; margin-bottom: 24px; }
          .step { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 12px; }
          .step:last-child { margin-bottom: 0; }
          .step-num { width: 24px; height: 24px; background: #f59e0b; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; flex-shrink: 0; line-height: 24px; text-align: center; }
          .step-text { font-size: 13px; color: #44403c; line-height: 1.4; padding-top: 3px; }
          .footer { font-size: 11px; color: #a8a29e; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>Benvenuta!</h1>
          <p class="subtitle">Scansiona il codice QR con il tuo smartphone per compilare la tua scheda cliente</p>
          <img class="qr" src="${qrUrl}" alt="QR Code" />
          <div class="steps">
            <div class="step"><div class="step-num">1</div><div class="step-text">Apri la fotocamera del tuo smartphone</div></div>
            <div class="step"><div class="step-num">2</div><div class="step-text">Inquadra il codice QR</div></div>
            <div class="step"><div class="step-num">3</div><div class="step-text">Compila il modulo con i tuoi dati</div></div>
            <div class="step"><div class="step-num">4</div><div class="step-text">Invia — lo staff creerà la tua scheda!</div></div>
          </div>
          <p class="footer">I tuoi dati saranno trattati nel rispetto della privacy</p>
        </div>
      </body>
      </html>
    `);
    win.document.close();
    win.onload = () => { win.print(); };
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 hover:bg-stone-100 rounded-xl transition-colors text-stone-500 hover:text-stone-800">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-stone-800">QR Code Registrazione</h2>
          <p className="text-sm text-stone-500 mt-0.5">Stampa e mostra questo cartello alle nuove clienti</p>
        </div>
      </div>

      {/* Info URL pubblico */}
      <div className="bg-green-50 border border-green-200 rounded-2xl p-5">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
            <Check size={15} className="text-green-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-green-900 mb-0.5">Pagina pubblica attiva</p>
            <p className="text-xs text-green-700 leading-relaxed">
              La pagina di registrazione funziona da qualsiasi smartphone. Basta scansionare il QR code.
            </p>
          </div>
        </div>
      </div>

      {/* Anteprima QR */}
      <div ref={printRef} className="bg-white rounded-2xl border border-stone-200 p-10 text-center shadow-sm">
        <div className="w-12 h-12 bg-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <QrCode size={22} className="text-white" />
        </div>
        <h3 className="text-xl font-bold text-stone-800 mb-2">Benvenuta!</h3>
        <p className="text-sm text-stone-500 mb-8 leading-relaxed max-w-xs mx-auto">
          Scansiona il codice QR con il tuo smartphone per compilare la tua scheda cliente
        </p>

        <div className="inline-block p-3 bg-white border border-stone-200 rounded-2xl shadow-sm mb-8">
          <img
            src={qrUrl}
            alt="QR Code registrazione clienti"
            className="w-52 h-52 block"
          />
        </div>

        <div className="bg-stone-50 rounded-xl p-5 text-left space-y-3 max-w-xs mx-auto mb-6">
          {['Apri la fotocamera del tuo smartphone', 'Inquadra il codice QR', 'Compila il modulo con i tuoi dati', 'Invia — lo staff creerà la tua scheda!'].map((step, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="w-6 h-6 bg-amber-500 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                {i + 1}
              </div>
              <p className="text-sm text-stone-600 leading-snug">{step}</p>
            </div>
          ))}
        </div>

        <p className="text-xs text-stone-400">I tuoi dati saranno trattati nel rispetto della privacy</p>
      </div>

      {/* Link diretto */}
      <div className="bg-stone-50 rounded-xl border border-stone-200 px-5 py-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1">Link diretto</p>
            {editingUrl ? (
              <input
                autoFocus
                value={urlDraft}
                onChange={e => setUrlDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSaveUrl(); if (e.key === 'Escape') setEditingUrl(false); }}
                className="w-full border border-amber-400 rounded-lg px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white"
                placeholder="https://tuosito.netlify.app/"
              />
            ) : (
              <p className="text-sm text-stone-700 font-mono truncate">{registrazioneUrl}</p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {editingUrl ? (
              <>
                <button
                  onClick={() => setEditingUrl(false)}
                  className="px-3 py-1.5 text-xs font-medium text-stone-500 border border-stone-200 rounded-lg hover:bg-stone-100 transition-colors"
                >
                  Annulla
                </button>
                <button
                  onClick={handleSaveUrl}
                  disabled={savingUrl}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  <Check size={12} />
                  {savingUrl ? 'Salvo…' : 'Salva'}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => { setUrlDraft(registrazioneUrl); setEditingUrl(true); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-stone-200 rounded-lg text-xs font-semibold text-stone-600 hover:border-amber-300 hover:text-amber-700 transition-colors"
                >
                  <MapPin size={12} />
                  Cambia
                </button>
                <a
                  href={registrazioneUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-stone-200 rounded-lg text-xs font-semibold text-stone-600 hover:border-amber-300 hover:text-amber-700 transition-colors"
                >
                  <ExternalLink size={12} />
                  Apri
                </a>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Bottoni azione */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={handlePrint}
          className="flex items-center justify-center gap-2 py-3.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm rounded-xl transition-colors shadow-sm"
        >
          <Printer size={16} />
          Stampa cartello
        </button>
        <button
          onClick={handleDownloadHtml}
          className="flex items-center justify-center gap-2 py-3.5 bg-stone-800 hover:bg-stone-900 text-white font-bold text-sm rounded-xl transition-colors shadow-sm"
        >
          <Download size={16} />
          Scarica HTML
        </button>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-2">
        <p className="text-xs font-bold text-blue-800">Come usare il file HTML</p>
        <p className="text-xs text-blue-700 leading-relaxed">
          Scarica il file e caricalo su qualsiasi servizio di hosting statico. Ad esempio vai su <strong>netlify.com/drop</strong> e trascinalo nella pagina per ottenere subito un link pubblico.
        </p>
        <p className="text-xs text-blue-700 leading-relaxed">
          Una volta ottenuto il link, usa il pulsante <strong>Cambia</strong> qui sopra per aggiornare l'indirizzo — il QR code si aggiornerà automaticamente.
        </p>
      </div>
    </div>
  );
}

// ─── Pagina Password ──────────────────────────────────────────────────────────

const PASSWORD_VOCI = [
  { chiave: 'password_account', titolo: 'Account e Credenziali', descrizione: "Accesso alla sezione account (cambia email/password di Supabase)", feedbackMsg: "Password aggiornata. Sarà richiesta al prossimo accesso all'account.", onSaved: () => sessionStorage.removeItem('account_unlocked') },
  { chiave: 'password_statistiche', titolo: 'Statistiche', descrizione: "Accesso alla sezione statistiche", feedbackMsg: "Password aggiornata. Sarà richiesta al prossimo accesso alle statistiche.", onSaved: () => sessionStorage.removeItem('stat_unlocked') },
  { chiave: 'password_finanze', titolo: 'Finanze', descrizione: "Accesso alla sezione finanze", feedbackMsg: "Password aggiornata. Sarà richiesta al prossimo accesso alle finanze.", onSaved: () => sessionStorage.removeItem('fin_unlocked') },
  { chiave: 'password_entrate_uscite', titolo: 'Entrate & Uscite', descrizione: "Accesso alla sezione entrate e uscite", feedbackMsg: "Password aggiornata. Sarà richiesta al prossimo accesso alle entrate e uscite.", onSaved: () => sessionStorage.removeItem('entrate_uscite_unlocked') },
  { chiave: 'password_carte', titolo: 'Carte', descrizione: "Creazione e ricarica carte sconto e premium", feedbackMsg: "Password aggiornata. Sarà richiesta alla prossima operazione sulle carte.", onSaved: () => {} },
  { chiave: 'password_grafico_servizi', titolo: 'Grafico Servizi', descrizione: "Visualizzazione grafico servizi nella scheda cliente", feedbackMsg: "Password aggiornata. Sarà richiesta al prossimo accesso al grafico servizi.", onSaved: () => {} },
  { chiave: 'password_incasso', titolo: 'Incasso Convalidato', descrizione: "Visualizzazione cifra incasso convalidato nella pagina fiches", feedbackMsg: "Password aggiornata. Sarà richiesta alla prossima visualizzazione dell'incasso.", onSaved: () => sessionStorage.removeItem('incasso_unlocked') },
  { chiave: 'password_elimina_clienti', titolo: 'Elimina Cliente / Scheda', descrizione: "Eliminazione definitiva di un cliente o scheda da confermare", feedbackMsg: "Password aggiornata. Sarà richiesta alla prossima eliminazione.", onSaved: () => {} },
  { chiave: 'password_elimina_parrucchieri', titolo: 'Elimina Parrucchiere', descrizione: "Eliminazione definitiva di un parrucchiere", feedbackMsg: "Password aggiornata. Sarà richiesta alla prossima eliminazione.", onSaved: () => {} },
];

// ─── PaginaAccount ────────────────────────────────────────────────────────────

function PaginaAccount({ onBack }: { onBack: () => void }) {
  const { user } = useAuth();

  // email change
  const [newEmail, setNewEmail] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailMsg, setEmailMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // password change
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdMsg, setPwdMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // password reset via email
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMsg, setResetMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  async function handleEmailChange(e: React.FormEvent) {
    e.preventDefault();
    if (!newEmail.trim()) return;
    setEmailLoading(true);
    setEmailMsg(null);
    const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
    if (error) {
      setEmailMsg({ type: 'err', text: 'Errore: ' + error.message });
    } else {
      setEmailMsg({ type: 'ok', text: 'Controlla la tua nuova email per confermare il cambio indirizzo.' });
      setNewEmail('');
    }
    setEmailLoading(false);
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    setPwdMsg(null);
    if (newPassword.length < 6) {
      setPwdMsg({ type: 'err', text: 'La nuova password deve avere almeno 6 caratteri.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwdMsg({ type: 'err', text: 'Le due password non coincidono.' });
      return;
    }
    setPwdLoading(true);
    // Re-authenticate first to verify current password
    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email: user?.email ?? '',
      password: currentPassword,
    });
    if (signInErr) {
      setPwdMsg({ type: 'err', text: 'Password attuale non corretta.' });
      setPwdLoading(false);
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      setPwdMsg({ type: 'err', text: 'Errore: ' + error.message });
    } else {
      setPwdMsg({ type: 'ok', text: 'Password aggiornata con successo.' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }
    setPwdLoading(false);
  }

  async function handleResetPassword() {
    setResetLoading(true);
    setResetMsg(null);
    const isElectron = typeof window !== 'undefined' && !!window.electronAPI;
    const redirectTo = isElectron
      ? 'gestionale-salone://reset-password'
      : `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/reset-password`;
    const { error } = await supabase.auth.resetPasswordForEmail(user?.email ?? '', { redirectTo });
    if (error) {
      setResetMsg({ type: 'err', text: 'Errore: ' + error.message });
    } else {
      setResetMsg({ type: 'ok', text: `Email di recupero inviata a ${user?.email}. Controlla la tua casella di posta.` });
    }
    setResetLoading(false);
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <button
          onClick={onBack}
          className="p-2 hover:bg-stone-100 rounded-xl transition-colors text-stone-500 hover:text-stone-800"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-stone-800">Account e Credenziali</h2>
          <p className="text-sm text-stone-500 mt-0.5">Modifica email e password di accesso</p>
        </div>
      </div>

      {/* Current account info */}
      <div className="bg-blue-50 border border-blue-100 rounded-2xl px-5 py-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
          <span className="text-white font-bold text-sm">{(user?.email ?? 'U')[0].toUpperCase()}</span>
        </div>
        <div>
          <p className="text-xs text-blue-600 font-medium">Account attivo</p>
          <p className="text-sm font-semibold text-stone-800 mt-0.5">{user?.email}</p>
        </div>
      </div>

      {/* Change email */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-stone-100">
          <div className="flex items-center gap-2">
            <Mail size={16} className="text-stone-500" />
            <h3 className="text-sm font-semibold text-stone-800">Cambia Email</h3>
          </div>
          <p className="text-xs text-stone-400 mt-0.5 ml-6">Riceverai un link di conferma al nuovo indirizzo</p>
        </div>
        <form onSubmit={handleEmailChange} className="px-5 py-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1.5">Nuova email</label>
            <div className="relative">
              <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="email"
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
                required
                placeholder="nuovaemail@esempio.com"
                className="w-full pl-8 pr-4 py-2.5 border border-stone-200 rounded-xl bg-stone-50 text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent text-sm transition"
              />
            </div>
          </div>

          {emailMsg && (
            <div className={`flex items-start gap-2 rounded-xl px-3 py-2.5 ${emailMsg.type === 'ok' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
              {emailMsg.type === 'ok' ? <Check size={14} className="text-green-600 flex-shrink-0 mt-0.5" /> : <AlertCircle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />}
              <p className={`text-xs ${emailMsg.type === 'ok' ? 'text-green-700' : 'text-red-700'}`}>{emailMsg.text}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={emailLoading || !newEmail.trim()}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl transition-colors disabled:opacity-50 text-sm"
          >
            {emailLoading ? 'Invio in corso...' : 'Aggiorna Email'}
          </button>
        </form>
      </div>

      {/* Change password */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-stone-100">
          <div className="flex items-center gap-2">
            <Lock size={16} className="text-stone-500" />
            <h3 className="text-sm font-semibold text-stone-800">Cambia Password</h3>
          </div>
          <p className="text-xs text-stone-400 mt-0.5 ml-6">Inserisci la password attuale per confermare</p>
        </div>
        <form onSubmit={handlePasswordChange} className="px-5 py-4 space-y-3">
          {/* Current password */}
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1.5">Password attuale</label>
            <div className="relative">
              <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type={showCurrent ? 'text' : 'password'}
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full pl-8 pr-9 py-2.5 border border-stone-200 rounded-xl bg-stone-50 text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent text-sm transition"
              />
              <button type="button" onClick={() => setShowCurrent(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600">
                {showCurrent ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          {/* New password */}
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1.5">Nuova password</label>
            <div className="relative">
              <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                required
                minLength={6}
                placeholder="Minimo 6 caratteri"
                className="w-full pl-8 pr-9 py-2.5 border border-stone-200 rounded-xl bg-stone-50 text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent text-sm transition"
              />
              <button type="button" onClick={() => setShowNew(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600">
                {showNew ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          {/* Confirm password */}
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1.5">Conferma nuova password</label>
            <div className="relative">
              <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                placeholder="Ripeti la nuova password"
                className="w-full pl-8 pr-9 py-2.5 border border-stone-200 rounded-xl bg-stone-50 text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent text-sm transition"
              />
              <button type="button" onClick={() => setShowConfirm(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600">
                {showConfirm ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          {pwdMsg && (
            <div className={`flex items-start gap-2 rounded-xl px-3 py-2.5 ${pwdMsg.type === 'ok' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
              {pwdMsg.type === 'ok' ? <Check size={14} className="text-green-600 flex-shrink-0 mt-0.5" /> : <AlertCircle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />}
              <p className={`text-xs ${pwdMsg.type === 'ok' ? 'text-green-700' : 'text-red-700'}`}>{pwdMsg.text}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={pwdLoading || !currentPassword || !newPassword || !confirmPassword}
            className="w-full bg-amber-500 hover:bg-amber-600 text-white font-semibold py-2.5 rounded-xl transition-colors disabled:opacity-50 text-sm"
          >
            {pwdLoading ? 'Aggiornamento...' : 'Aggiorna Password'}
          </button>
        </form>
      </div>

      {/* Reset password via email */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-stone-100">
          <div className="flex items-center gap-2">
            <Mail size={16} className="text-stone-500" />
            <h3 className="text-sm font-semibold text-stone-800">Recupero Password via Email</h3>
          </div>
          <p className="text-xs text-stone-400 mt-0.5 ml-6">Ricevi un link per reimpostare la password senza conoscere quella attuale</p>
        </div>
        <div className="px-5 py-4 space-y-3">
          {resetMsg && (
            <div className={`flex items-start gap-2 rounded-xl px-3 py-2.5 ${resetMsg.type === 'ok' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
              {resetMsg.type === 'ok' ? <Check size={14} className="text-green-600 flex-shrink-0 mt-0.5" /> : <AlertCircle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />}
              <p className={`text-xs ${resetMsg.type === 'ok' ? 'text-green-700' : 'text-red-700'}`}>{resetMsg.text}</p>
            </div>
          )}
          <button
            onClick={handleResetPassword}
            disabled={resetLoading}
            className="w-full border border-stone-200 hover:border-stone-300 bg-stone-50 hover:bg-stone-100 text-stone-700 font-semibold py-2.5 rounded-xl transition-colors disabled:opacity-50 text-sm"
          >
            {resetLoading ? 'Invio in corso...' : `Invia email di recupero a ${user?.email}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── PaginaPassword ───────────────────────────────────────────────────────────

function PaginaPassword({ onBack }: { onBack: () => void }) {
  const [aperta, setAperta] = useState<string | null>(null);

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <button
          onClick={onBack}
          className="p-2 hover:bg-stone-100 rounded-xl transition-colors text-stone-500 hover:text-stone-800"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-stone-800">Password</h2>
          <p className="text-sm text-stone-500 mt-0.5">Clicca su una voce per modificarne la password</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden divide-y divide-stone-100">
        {PASSWORD_VOCI.map(v => (
          <PasswordRow
            key={v.chiave}
            chiave={v.chiave}
            titolo={v.titolo}
            descrizione={v.descrizione}
            feedbackMsg={v.feedbackMsg}
            onSaved={v.onSaved}
            aperta={aperta === v.chiave}
            onToggle={() => setAperta(s => s === v.chiave ? null : v.chiave)}
          />
        ))}
      </div>
    </div>
  );
}

// ─── PaginaPromemoria ─────────────────────────────────────────────────────────

function PaginaPromemoria({ onBack, onTestReminder }: { onBack: () => void; onTestReminder?: () => void }) {
  const [giorni, setGiorni] = useState<number[]>([1, 2, 3, 4, 5, 6]);
  const [orario, setOrario] = useState('20:00');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ tipo: 'ok' | 'err'; msg: string } | null>(null);

  useEffect(() => {
    Promise.all([
      supabase.from('impostazioni').select('valore').eq('chiave', 'promemoria_convalida_giorni').maybeSingle(),
      supabase.from('impostazioni').select('valore').eq('chiave', 'promemoria_convalida_orario').maybeSingle(),
    ]).then(([g, o]) => {
      if (g.data?.valore) {
        try { setGiorni(JSON.parse(g.data.valore)); } catch { /* keep default */ }
      }
      if (o.data?.valore) setOrario(o.data.valore);
      setLoading(false);
    });
  }, []);

  function toggleGiorno(v: number) {
    setGiorni(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]);
    setFeedback(null);
  }

  async function handleSalva(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    setSaving(true);
    const [r1, r2] = await Promise.all([
      supabase.from('impostazioni').upsert({ chiave: 'promemoria_convalida_giorni', valore: JSON.stringify(giorni) }),
      supabase.from('impostazioni').upsert({ chiave: 'promemoria_convalida_orario', valore: orario }),
    ]);
    setSaving(false);
    if (r1.error || r2.error) {
      setFeedback({ tipo: 'err', msg: 'Errore durante il salvataggio' });
    } else {
      setFeedback({ tipo: 'ok', msg: 'Impostazioni salvate. Il promemoria apparirà all\'orario selezionato.' });
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-7 h-7 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 hover:bg-stone-100 rounded-xl transition-colors text-stone-500 hover:text-stone-800">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-stone-800">Promemoria Convalida Fiches</h2>
          <p className="text-sm text-stone-500 mt-0.5">Configura quando ricevere il promemoria di convalida giornaliero</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-stone-100 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-stone-100 flex items-center justify-center flex-shrink-0">
            <Bell size={16} className="text-stone-500" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-stone-800">Configurazione promemoria</h3>
            <p className="text-xs text-stone-500">Un avviso apparirà al momento selezionato per ricordarti di convalidare le fiches</p>
          </div>
        </div>

        <form onSubmit={handleSalva} className="px-6 py-5 space-y-6">
          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-3 uppercase tracking-wide">
              Giorni della settimana
            </label>
            <div className="flex gap-2 flex-wrap">
              {GIORNI_SETTIMANA.map(({ label, value }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => toggleGiorno(value)}
                  className={`w-12 h-12 rounded-xl text-sm font-semibold transition-all border-2 ${
                    giorni.includes(value)
                      ? 'bg-amber-500 border-amber-500 text-white shadow-sm'
                      : 'bg-white border-stone-200 text-stone-500 hover:border-amber-300 hover:text-amber-600'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {giorni.length === 0 && (
              <p className="text-xs text-amber-600 mt-2">Seleziona almeno un giorno per attivare il promemoria</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wide">
              Orario
            </label>
            <input
              type="time"
              value={orario}
              onChange={e => { setOrario(e.target.value); setFeedback(null); }}
              className="border border-stone-200 rounded-xl px-4 py-2.5 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-400 transition-colors"
            />
          </div>

          {feedback && (
            <div className={`flex items-start gap-2 px-4 py-3 rounded-xl text-sm ${
              feedback.tipo === 'ok'
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              {feedback.tipo === 'ok'
                ? <Check size={15} className="flex-shrink-0 mt-0.5" />
                : <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
              }
              {feedback.msg}
            </div>
          )}

          <div className="flex items-center justify-between pt-1 gap-3">
            {onTestReminder && (
              <button
                type="button"
                onClick={onTestReminder}
                className="flex items-center gap-2 px-4 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 text-sm font-semibold rounded-xl transition-colors"
              >
                <Bell size={14} />
                Testa avviso adesso
              </button>
            )}
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors shadow-sm ml-auto"
            >
              <Check size={14} />
              {saving ? 'Salvataggio...' : 'Salva impostazioni'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── PaginaTemplateCarta ──────────────────────────────────────────────────────

interface TemplateMsg {
  id: string;
  nome: string;
  testo: string;
  is_default: boolean;
  ordine: number;
}

const VARIABILI_HELP = '{nome} · {codice} · {sconto} · {da}';

function PaginaTemplateCarta({ onBack }: { onBack: () => void }) {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<TemplateMsg[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNome, setEditNome] = useState('');
  const [editTesto, setEditTesto] = useState('');
  const [saving, setSaving] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [newNome, setNewNome] = useState('');
  const [newTesto, setNewTesto] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('template_messaggi_carta_sconto')
      .select('id, nome, testo, is_default, ordine')
      .order('ordine');
    setTemplates((data || []) as TemplateMsg[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function startEdit(t: TemplateMsg) {
    setEditingId(t.id);
    setEditNome(t.nome);
    setEditTesto(t.testo);
    setShowNew(false);
  }

  async function saveEdit() {
    if (!editingId) return;
    setSaving(true);
    await supabase.from('template_messaggi_carta_sconto')
      .update({ nome: editNome, testo: editTesto })
      .eq('id', editingId);
    setSaving(false);
    setEditingId(null);
    setFeedback('Template salvato.');
    setTimeout(() => setFeedback(null), 2500);
    load();
  }

  async function setDefault(id: string) {
    await supabase.from('template_messaggi_carta_sconto').update({ is_default: false }).neq('id', id);
    await supabase.from('template_messaggi_carta_sconto').update({ is_default: true }).eq('id', id);
    setFeedback('Template predefinito aggiornato.');
    setTimeout(() => setFeedback(null), 2500);
    load();
  }

  async function deleteTemplate(id: string) {
    if (!confirm('Eliminare questo template?')) return;
    await supabase.from('template_messaggi_carta_sconto').delete().eq('id', id);
    load();
  }

  async function createNew() {
    if (!newNome.trim() || !newTesto.trim()) return;
    setSaving(true);
    const maxOrdine = templates.reduce((m, t) => Math.max(m, t.ordine), 0);
    await supabase.from('template_messaggi_carta_sconto').insert({
      nome: newNome.trim(),
      testo: newTesto.trim(),
      is_default: false,
      ordine: maxOrdine + 1,
      user_id: user?.id,
    });
    setSaving(false);
    setShowNew(false);
    setNewNome('');
    setNewTesto('');
    setFeedback('Nuovo template creato.');
    setTimeout(() => setFeedback(null), 2500);
    load();
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-7 h-7 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 hover:bg-stone-100 rounded-xl transition-colors text-stone-500 hover:text-stone-800">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-stone-800">Template Messaggi Carta Sconto</h2>
          <p className="text-sm text-stone-500 mt-0.5">Gestisci i modelli di messaggio per le varie occasioni</p>
        </div>
      </div>

      <div className="bg-stone-50 border border-stone-200 rounded-xl px-4 py-3">
        <p className="text-xs text-stone-600 font-semibold mb-1">Variabili disponibili</p>
        <p className="text-xs text-stone-500 font-mono">{VARIABILI_HELP}</p>
        <p className="text-xs text-stone-400 mt-1">{'{da}'} viene usato nei template "regalo da parte di" — un campo apposito appare al momento dell'invio.</p>
      </div>

      {feedback && (
        <div className="flex items-center gap-2 px-4 py-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700">
          <Check size={14} />
          {feedback}
        </div>
      )}

      {/* Lista template */}
      <div className="space-y-3">
        {templates.map(t => (
          <div key={t.id} className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
            {editingId === t.id ? (
              <div className="p-5 space-y-3">
                <input
                  value={editNome}
                  onChange={e => setEditNome(e.target.value)}
                  className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm font-semibold focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-200"
                  placeholder="Nome occasione"
                />
                <textarea
                  value={editTesto}
                  onChange={e => setEditTesto(e.target.value)}
                  rows={8}
                  className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-xs text-stone-700 leading-relaxed font-mono focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-200 resize-none"
                />
                <div className="flex gap-2">
                  <button onClick={() => setEditingId(null)} className="flex-1 py-2 border border-stone-200 rounded-xl text-sm text-stone-600 hover:bg-stone-50 transition-colors">
                    Annulla
                  </button>
                  <button onClick={saveEdit} disabled={saving} className="flex-1 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50">
                    {saving ? 'Salvataggio...' : 'Salva'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="px-5 py-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-stone-800">{t.nome}</p>
                    {t.is_default && (
                      <span className="flex items-center gap-1 text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                        <Star size={8} />
                        Predefinito
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {!t.is_default && (
                      <button
                        onClick={() => setDefault(t.id)}
                        title="Imposta come predefinito"
                        className="p-1.5 rounded-lg hover:bg-amber-50 text-stone-400 hover:text-amber-600 transition-colors"
                      >
                        <Star size={14} />
                      </button>
                    )}
                    <button
                      onClick={() => startEdit(t)}
                      className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-400 hover:text-stone-600 transition-colors"
                    >
                      <Edit3 size={14} />
                    </button>
                    {templates.length > 1 && (
                      <button
                        onClick={() => deleteTemplate(t.id)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-stone-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-xs text-stone-400 whitespace-pre-wrap leading-relaxed font-mono line-clamp-3">{t.testo}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Nuovo template */}
      {showNew ? (
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5 space-y-3">
          <p className="text-sm font-bold text-stone-800">Nuovo template</p>
          <input
            value={newNome}
            onChange={e => setNewNome(e.target.value)}
            className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-200"
            placeholder="Nome occasione (es. Pasqua, Inaugurazione...)"
          />
          <textarea
            value={newTesto}
            onChange={e => setNewTesto(e.target.value)}
            rows={8}
            className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-xs text-stone-700 leading-relaxed font-mono focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-200 resize-none"
            placeholder={`Ciao {nome},\n...`}
          />
          <div className="flex gap-2">
            <button onClick={() => { setShowNew(false); setNewNome(''); setNewTesto(''); }}
              className="flex-1 py-2 border border-stone-200 rounded-xl text-sm text-stone-600 hover:bg-stone-50 transition-colors flex items-center justify-center gap-1.5">
              <X size={13} />
              Annulla
            </button>
            <button onClick={createNew} disabled={saving || !newNome.trim() || !newTesto.trim()}
              className="flex-1 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-1.5">
              <Check size={13} />
              {saving ? 'Creazione...' : 'Crea template'}
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => { setShowNew(true); setEditingId(null); }}
          className="w-full py-3 border-2 border-dashed border-stone-200 rounded-2xl text-sm font-medium text-stone-500 hover:border-amber-400 hover:text-amber-600 hover:bg-amber-50 transition-colors flex items-center justify-center gap-2"
        >
          <Plus size={15} />
          Aggiungi nuovo template
        </button>
      )}
    </div>
  );
}

// ─── PaginaMessaggioAvviso ────────────────────────────────────────────────────

const DEFAULT_MESSAGGIO = `Ciao {nome} ti ricordiamo l'appuntamento di domani {data} alle ore {ora} presso il nostro salone in via Palermo 15 Roma, ti aspettiamo!\n\nI Venzi.`;
const DEFAULT_INDIRIZZO = 'via Palermo 15, Roma';

function buildMapUrl(indirizzo: string) {
  return `https://maps.google.com/?q=${encodeURIComponent(indirizzo)}`;
}

function applyTemplate(template: string, vars: { nome: string; data: string; ora: string }) {
  return template
    .replace(/\{nome\}/g, vars.nome)
    .replace(/\{data\}/g, vars.data)
    .replace(/\{ora\}/g, vars.ora);
}

function PaginaMessaggioAvviso({ onBack }: { onBack: () => void }) {
  const [messaggio, setMessaggio] = useState('');
  const [indirizzo, setIndirizzo] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ tipo: 'ok' | 'err'; msg: string } | null>(null);

  useEffect(() => {
    Promise.all([
      supabase.from('impostazioni').select('valore').eq('chiave', 'messaggio_avviso_appuntamento').maybeSingle(),
      supabase.from('impostazioni').select('valore').eq('chiave', 'avviso_appuntamento_indirizzo').maybeSingle(),
    ]).then(([m, i]) => {
      setMessaggio(m.data?.valore ?? DEFAULT_MESSAGGIO);
      setIndirizzo(i.data?.valore ?? DEFAULT_INDIRIZZO);
      setLoading(false);
    });
  }, []);

  async function handleSalva(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    if (!messaggio.trim()) {
      setFeedback({ tipo: 'err', msg: 'Il messaggio non può essere vuoto' });
      return;
    }
    setSaving(true);
    const [r1, r2] = await Promise.all([
      supabase.from('impostazioni').upsert({ chiave: 'messaggio_avviso_appuntamento', valore: messaggio }),
      supabase.from('impostazioni').upsert({ chiave: 'avviso_appuntamento_indirizzo', valore: indirizzo }),
    ]);
    setSaving(false);
    if (r1.error || r2.error) {
      setFeedback({ tipo: 'err', msg: 'Errore durante il salvataggio' });
    } else {
      setFeedback({ tipo: 'ok', msg: 'Messaggio salvato. Sarà usato al prossimo invio avviso.' });
    }
  }

  const anteprima = applyTemplate(messaggio, {
    nome: 'Maria',
    data: 'martedì 21 maggio',
    ora: '10:30',
  });
  const mapUrl = indirizzo.trim() ? buildMapUrl(indirizzo) : null;

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-7 h-7 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 hover:bg-stone-100 rounded-xl transition-colors text-stone-500 hover:text-stone-800">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-stone-800">Messaggio Avviso Appuntamento</h2>
          <p className="text-sm text-stone-500 mt-0.5">Testo WhatsApp inviato ai clienti per il promemoria appuntamento</p>
        </div>
      </div>

      <form onSubmit={handleSalva} className="space-y-5">
        {/* Messaggio */}
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-stone-100 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
              <MessageCircle size={16} className="text-emerald-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-stone-800">Testo del messaggio</h3>
              <p className="text-xs text-stone-500">Usa <code className="bg-stone-100 px-1 rounded text-stone-700">{'{nome}'}</code>, <code className="bg-stone-100 px-1 rounded text-stone-700">{'{data}'}</code>, <code className="bg-stone-100 px-1 rounded text-stone-700">{'{ora}'}</code> come variabili</p>
            </div>
          </div>
          <div className="px-6 py-5">
            <textarea
              value={messaggio}
              onChange={e => { setMessaggio(e.target.value); setFeedback(null); }}
              rows={6}
              className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400 transition-colors resize-none font-mono leading-relaxed"
              placeholder="Testo del messaggio..."
            />
          </div>
        </div>

        {/* Indirizzo */}
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-stone-100 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
              <MapPin size={16} className="text-emerald-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-stone-800">Indirizzo del salone</h3>
              <p className="text-xs text-stone-500">Allegato automaticamente come link Google Maps al messaggio</p>
            </div>
          </div>
          <div className="px-6 py-5 space-y-3">
            <input
              type="text"
              value={indirizzo}
              onChange={e => { setIndirizzo(e.target.value); setFeedback(null); }}
              placeholder="es. via Palermo 15, Roma"
              className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400 transition-colors"
            />
            {mapUrl && (
              <a
                href={mapUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-emerald-600 hover:text-emerald-800 underline transition-colors"
              >
                <MapPin size={11} />
                Vedi su Google Maps
              </a>
            )}
          </div>
        </div>

        {/* Anteprima */}
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-stone-100">
            <h3 className="text-sm font-semibold text-stone-800">Anteprima messaggio</h3>
            <p className="text-xs text-stone-500 mt-0.5">Esempio con cliente "Maria", domani martedì 21 maggio alle 10:30</p>
          </div>
          <div className="px-6 py-5">
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-4 space-y-2">
              <p className="text-sm text-stone-800 whitespace-pre-wrap leading-relaxed">{anteprima}</p>
              {mapUrl && (
                <p className="text-xs text-emerald-600 flex items-center gap-1.5 pt-1 border-t border-emerald-200">
                  <MapPin size={11} />
                  {mapUrl}
                </p>
              )}
            </div>
          </div>
        </div>

        {feedback && (
          <div className={`flex items-start gap-2 px-4 py-3 rounded-xl text-sm ${
            feedback.tipo === 'ok'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            {feedback.tipo === 'ok'
              ? <Check size={15} className="flex-shrink-0 mt-0.5" />
              : <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
            }
            {feedback.msg}
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
          >
            <Check size={14} />
            {saving ? 'Salvataggio...' : 'Salva messaggio'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── PaginaTemplateComunicazioni ──────────────────────────────────────────────

interface TemplateCom {
  id: string;
  nome: string;
  testo: string;
  is_default: boolean;
  ordine: number;
}

function PaginaTemplateComunicazioni({ onBack }: { onBack: () => void }) {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<TemplateCom[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNome, setEditNome] = useState('');
  const [editTesto, setEditTesto] = useState('');
  const [saving, setSaving] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [newNome, setNewNome] = useState('');
  const [newTesto, setNewTesto] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('template_messaggi_comunicazioni')
      .select('id, nome, testo, is_default, ordine')
      .order('ordine');
    setTemplates((data || []) as TemplateCom[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function startEdit(t: TemplateCom) {
    setEditingId(t.id);
    setEditNome(t.nome);
    setEditTesto(t.testo);
    setShowNew(false);
  }

  async function saveEdit() {
    if (!editingId) return;
    setSaving(true);
    await supabase.from('template_messaggi_comunicazioni')
      .update({ nome: editNome, testo: editTesto })
      .eq('id', editingId);
    setSaving(false);
    setEditingId(null);
    setFeedback('Template salvato.');
    setTimeout(() => setFeedback(null), 2500);
    load();
  }

  async function setDefault(id: string) {
    await supabase.from('template_messaggi_comunicazioni').update({ is_default: false }).neq('id', id);
    await supabase.from('template_messaggi_comunicazioni').update({ is_default: true }).eq('id', id);
    setFeedback('Template predefinito aggiornato.');
    setTimeout(() => setFeedback(null), 2500);
    load();
  }

  async function deleteTemplate(id: string) {
    if (!confirm('Eliminare questo template?')) return;
    await supabase.from('template_messaggi_comunicazioni').delete().eq('id', id);
    load();
  }

  async function createNew() {
    if (!newNome.trim() || !newTesto.trim()) return;
    setSaving(true);
    const maxOrdine = templates.reduce((m, t) => Math.max(m, t.ordine), 0);
    await supabase.from('template_messaggi_comunicazioni').insert({
      nome: newNome.trim(),
      testo: newTesto.trim(),
      is_default: false,
      ordine: maxOrdine + 1,
      user_id: user?.id,
    });
    setSaving(false);
    setShowNew(false);
    setNewNome('');
    setNewTesto('');
    setFeedback('Nuovo template creato.');
    setTimeout(() => setFeedback(null), 2500);
    load();
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-7 h-7 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 hover:bg-stone-100 rounded-xl transition-colors text-stone-500 hover:text-stone-800">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-stone-800">Template Messaggi Comunicazioni</h2>
          <p className="text-sm text-stone-500 mt-0.5">Gestisci i messaggi predefiniti per compleanno, feste e promozioni</p>
        </div>
      </div>

      <div className="bg-stone-50 border border-stone-200 rounded-xl px-4 py-3">
        <p className="text-xs text-stone-500">Questi messaggi sono disponibili come scorciatoia nella sezione Comunicazioni per compilare rapidamente il testo da inviare alle clienti.</p>
      </div>

      {feedback && (
        <div className="flex items-center gap-2 px-4 py-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700">
          <Check size={14} />
          {feedback}
        </div>
      )}

      {/* Lista template */}
      <div className="space-y-3">
        {templates.map(t => (
          <div key={t.id} className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
            {editingId === t.id ? (
              <div className="p-5 space-y-3">
                <input
                  value={editNome}
                  onChange={e => setEditNome(e.target.value)}
                  className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm font-semibold focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-200"
                  placeholder="Nome occasione"
                />
                <textarea
                  value={editTesto}
                  onChange={e => setEditTesto(e.target.value)}
                  rows={8}
                  className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-xs text-stone-700 leading-relaxed font-mono focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-200 resize-none"
                />
                <div className="flex gap-2">
                  <button onClick={() => setEditingId(null)} className="flex-1 py-2 border border-stone-200 rounded-xl text-sm text-stone-600 hover:bg-stone-50 transition-colors">
                    Annulla
                  </button>
                  <button onClick={saveEdit} disabled={saving} className="flex-1 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50">
                    {saving ? 'Salvataggio...' : 'Salva'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="px-5 py-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-stone-800">{t.nome}</p>
                    {t.is_default && (
                      <span className="flex items-center gap-1 text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                        <Star size={8} />
                        Predefinito
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {!t.is_default && (
                      <button
                        onClick={() => setDefault(t.id)}
                        title="Imposta come predefinito"
                        className="p-1.5 rounded-lg hover:bg-amber-50 text-stone-400 hover:text-amber-600 transition-colors"
                      >
                        <Star size={14} />
                      </button>
                    )}
                    <button
                      onClick={() => startEdit(t)}
                      className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-400 hover:text-stone-600 transition-colors"
                    >
                      <Edit3 size={14} />
                    </button>
                    {templates.length > 1 && (
                      <button
                        onClick={() => deleteTemplate(t.id)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-stone-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-xs text-stone-400 whitespace-pre-wrap leading-relaxed font-mono line-clamp-3">{t.testo}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Nuovo template */}
      {showNew ? (
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5 space-y-3">
          <p className="text-sm font-bold text-stone-800">Nuovo template</p>
          <input
            value={newNome}
            onChange={e => setNewNome(e.target.value)}
            className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-200"
            placeholder="Nome occasione (es. Ferragosto, Inaugurazione...)"
          />
          <textarea
            value={newTesto}
            onChange={e => setNewTesto(e.target.value)}
            rows={8}
            className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-xs text-stone-700 leading-relaxed font-mono focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-200 resize-none"
            placeholder={`Caro/a {nome},\n...`}
          />
          <div className="flex gap-2">
            <button
              onClick={() => { setShowNew(false); setNewNome(''); setNewTesto(''); }}
              className="flex-1 py-2 border border-stone-200 rounded-xl text-sm text-stone-600 hover:bg-stone-50 transition-colors flex items-center justify-center gap-1.5"
            >
              <X size={13} />
              Annulla
            </button>
            <button
              onClick={createNew}
              disabled={saving || !newNome.trim() || !newTesto.trim()}
              className="flex-1 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-1.5"
            >
              <Check size={13} />
              {saving ? 'Creazione...' : 'Crea template'}
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => { setShowNew(true); setEditingId(null); }}
          className="w-full py-3 border-2 border-dashed border-stone-200 rounded-2xl text-sm font-medium text-stone-500 hover:border-amber-400 hover:text-amber-600 hover:bg-amber-50 transition-colors flex items-center justify-center gap-2"
        >
          <Plus size={15} />
          Aggiungi nuovo template
        </button>
      )}
    </div>
  );
}

// ─── PasswordRow (accordion) ──────────────────────────────────────────────────

interface PasswordRowProps {
  chiave: string;
  titolo: string;
  descrizione: string;
  feedbackMsg: string;
  onSaved: () => void;
  aperta: boolean;
  onToggle: () => void;
}

function PasswordRow({ chiave, titolo, descrizione, feedbackMsg, onSaved, aperta, onToggle }: PasswordRowProps) {
  const [nuovaPassword, setNuovaPassword] = useState('');
  const [confermaPassword, setConfermaPassword] = useState('');
  const [showNuova, setShowNuova] = useState(false);
  const [showConferma, setShowConferma] = useState(false);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ tipo: 'ok' | 'err'; msg: string } | null>(null);

  function handleToggle() {
    setNuovaPassword('');
    setConfermaPassword('');
    setFeedback(null);
    setShowNuova(false);
    setShowConferma(false);
    onToggle();
  }

  async function handleSalva(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    if (!nuovaPassword.trim()) { setFeedback({ tipo: 'err', msg: 'La nuova password non può essere vuota' }); return; }
    if (nuovaPassword !== confermaPassword) { setFeedback({ tipo: 'err', msg: 'Le password non coincidono' }); return; }
    setLoading(true);
    const { error } = await supabase.from('impostazioni').upsert({ chiave, valore: nuovaPassword });
    setLoading(false);
    if (error) {
      setFeedback({ tipo: 'err', msg: 'Errore durante il salvataggio' });
    } else {
      onSaved();
      setFeedback({ tipo: 'ok', msg: feedbackMsg });
      setNuovaPassword('');
      setConfermaPassword('');
    }
  }

  return (
    <div>
      <button
        onClick={handleToggle}
        className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-stone-50 transition-colors text-left group"
      >
        <div className="w-8 h-8 rounded-lg bg-stone-100 group-hover:bg-amber-50 flex items-center justify-center flex-shrink-0 transition-colors">
          <Lock size={14} className="text-stone-400 group-hover:text-amber-500 transition-colors" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-stone-800">{titolo}</p>
          <p className="text-xs text-stone-400 truncate">{descrizione}</p>
        </div>
        <ChevronDown size={15} className={`text-stone-400 flex-shrink-0 transition-transform duration-200 ${aperta ? 'rotate-180' : ''}`} />
      </button>

      {aperta && (
        <form onSubmit={handleSalva} className="px-5 pb-5 pt-1 space-y-3 border-t border-stone-100 bg-stone-50/60">
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div>
              <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1.5">Nuova password</label>
              <div className="relative">
                <input
                  type={showNuova ? 'text' : 'password'}
                  value={nuovaPassword}
                  onChange={e => { setNuovaPassword(e.target.value); setFeedback(null); }}
                  placeholder="Nuova password"
                  autoFocus
                  className="w-full border border-stone-200 rounded-lg px-3 py-2 pr-9 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-400 transition-colors bg-white"
                />
                <button type="button" onClick={() => setShowNuova(s => !s)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600">
                  {showNuova ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1.5">Conferma</label>
              <div className="relative">
                <input
                  type={showConferma ? 'text' : 'password'}
                  value={confermaPassword}
                  onChange={e => { setConfermaPassword(e.target.value); setFeedback(null); }}
                  placeholder="Ripeti password"
                  className={`w-full border rounded-lg px-3 py-2 pr-9 text-sm text-stone-800 focus:outline-none focus:ring-2 transition-colors bg-white ${confermaPassword && nuovaPassword !== confermaPassword ? 'border-red-300 focus:ring-red-200' : 'border-stone-200 focus:ring-amber-300 focus:border-amber-400'}`}
                />
                <button type="button" onClick={() => setShowConferma(s => !s)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600">
                  {showConferma ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
              </div>
              {confermaPassword && nuovaPassword !== confermaPassword && (
                <p className="text-xs text-red-500 mt-1">Non coincidono</p>
              )}
            </div>
          </div>

          {feedback && (
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium ${feedback.tipo === 'ok' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
              {feedback.tipo === 'ok' ? <Check size={13} /> : <AlertCircle size={13} />}
              {feedback.msg}
            </div>
          )}

          <div className="flex gap-2 justify-end pt-1">
            <button type="button" onClick={handleToggle} className="px-3 py-1.5 text-xs font-medium text-stone-500 border border-stone-200 rounded-lg hover:bg-stone-100 transition-colors">
              Annulla
            </button>
            <button
              type="submit"
              disabled={loading || !nuovaPassword || !confermaPassword}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white text-xs font-semibold rounded-lg transition-colors"
            >
              <Check size={12} />
              {loading ? 'Salvataggio...' : 'Salva'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}


// ─── Pagina Connessione Cloud ─────────────────────────────────────────────────

const LS_URL_KEY = 'sb_custom_url';
const LS_KEY_KEY = 'sb_custom_anon_key';

function PaginaConnessione({ onBack }: { onBack: () => void }) {
  const defaultUrl = import.meta.env.VITE_SUPABASE_URL ?? '';
  const defaultKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

  const [url, setUrl] = useState(() => localStorage.getItem(LS_URL_KEY) ?? defaultUrl);
  const [anonKey, setAnonKey] = useState(() => localStorage.getItem(LS_KEY_KEY) ?? defaultKey);
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const activeUrl = localStorage.getItem(LS_URL_KEY) ?? defaultUrl;
  const activeKey = localStorage.getItem(LS_KEY_KEY) ?? defaultKey;
  const hasLocalOverride = !!localStorage.getItem(LS_URL_KEY) || !!localStorage.getItem(LS_KEY_KEY);

  // Whether the current form values differ from what's actually active
  const isDirty = url.trim() !== activeUrl || anonKey.trim() !== activeKey;
  const isCustom = url.trim() !== defaultUrl || anonKey.trim() !== defaultKey;

  function handleSave() {
    const newUrl = url.trim();
    const newKey = anonKey.trim();
    if (!newUrl || !newKey) return;
    localStorage.setItem(LS_URL_KEY, newUrl);
    localStorage.setItem(LS_KEY_KEY, newKey);
    setSaving(true);
    // Reload so the Supabase client is recreated with the new credentials
    setTimeout(() => window.location.reload(), 800);
  }

  function handleReset() {
    localStorage.removeItem(LS_URL_KEY);
    localStorage.removeItem(LS_KEY_KEY);
    setUrl(defaultUrl);
    setAnonKey(defaultKey);
    setTestResult(null);
    // Reload so the Supabase client reverts to default credentials
    setTimeout(() => window.location.reload(), 400);
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const testUrl = (url.trim() || defaultUrl).replace(/\/$/, '');
      const testKey = anonKey.trim() || defaultKey;
      const res = await fetch(`${testUrl}/rest/v1/`, {
        headers: { apikey: testKey, Authorization: `Bearer ${testKey}` },
      });
      // Supabase REST root returns 200 with valid key, 401 with invalid
      if (res.status === 200 || res.status === 400) {
        setTestResult({ ok: true, msg: 'Connessione riuscita. Le chiavi sono valide.' });
      } else if (res.status === 401) {
        setTestResult({ ok: false, msg: 'Chiave API non valida (401). Controlla la anon key.' });
      } else {
        setTestResult({ ok: false, msg: `Errore ${res.status}: URL errato o servizio non raggiungibile.` });
      }
    } catch {
      setTestResult({ ok: false, msg: "Impossibile raggiungere il server. Controlla l'URL." });
    }
    setTesting(false);
  }

  const maskedKey = anonKey.length > 12
    ? anonKey.slice(0, 6) + '••••••••••••••••••••' + anonKey.slice(-4)
    : anonKey;

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 hover:bg-stone-100 rounded-xl transition-colors text-stone-500 hover:text-stone-800">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-stone-800">Connessione Cloud</h2>
          <p className="text-sm text-stone-500 mt-0.5">Chiavi API per la connessione al database Supabase</p>
        </div>
      </div>

      {/* Stato connessione attiva */}
      <div className={`rounded-2xl p-4 border flex items-start gap-3 ${hasLocalOverride ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}`}>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${hasLocalOverride ? 'bg-amber-100' : 'bg-green-100'}`}>
          <Cloud size={15} className={hasLocalOverride ? 'text-amber-600' : 'text-green-600'} />
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-bold ${hasLocalOverride ? 'text-amber-900' : 'text-green-900'}`}>
            {hasLocalOverride ? 'Configurazione personalizzata attiva' : 'Configurazione predefinita in uso'}
          </p>
          <p className={`text-xs mt-0.5 leading-relaxed ${hasLocalOverride ? 'text-amber-700' : 'text-green-700'}`}>
            URL attivo: <span className="font-mono break-all">{activeUrl}</span>
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6 space-y-5">

        {/* URL */}
        <div>
          <label className="block text-sm font-semibold text-stone-700 mb-1.5">
            URL del progetto Supabase
          </label>
          <input
            type="text"
            value={url}
            onChange={e => { setUrl(e.target.value); setTestResult(null); }}
            placeholder="https://xxxxxxxxxxxx.supabase.co"
            className="w-full px-4 py-3 border border-stone-200 rounded-xl bg-stone-50 text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent text-sm font-mono transition"
          />
          <p className="text-xs text-stone-400 mt-1.5">supabase.com → il tuo progetto → Settings → API → Project URL</p>
        </div>

        {/* Anon key */}
        <div>
          <label className="block text-sm font-semibold text-stone-700 mb-1.5">
            Chiave API pubblica (anon key)
          </label>
          <div className="relative">
            {showKey ? (
              <textarea
                value={anonKey}
                onChange={e => { setAnonKey(e.target.value); setTestResult(null); }}
                rows={3}
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                className="w-full px-4 py-3 pr-10 border border-stone-200 rounded-xl bg-stone-50 text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent text-xs font-mono transition resize-none"
              />
            ) : (
              <div className="w-full px-4 py-3 pr-10 border border-stone-200 rounded-xl bg-stone-50 text-stone-500 text-sm font-mono">
                <span className="truncate block">{maskedKey || '—'}</span>
              </div>
            )}
            <button
              type="button"
              onClick={() => setShowKey(v => !v)}
              className="absolute right-3 top-3 text-stone-400 hover:text-stone-600 transition-colors"
            >
              {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <p className="text-xs text-stone-400 mt-1.5">supabase.com → il tuo progetto → Settings → API → anon public</p>
        </div>

        {/* Risultato test */}
        {testResult && (
          <div className={`flex items-start gap-2 rounded-xl px-4 py-3 border ${testResult.ok ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
            {testResult.ok
              ? <Check size={15} className="text-green-600 flex-shrink-0 mt-0.5" />
              : <AlertCircle size={15} className="text-red-500 flex-shrink-0 mt-0.5" />}
            <p className={`text-sm ${testResult.ok ? 'text-green-700' : 'text-red-700'}`}>{testResult.msg}</p>
          </div>
        )}

        {/* Azioni */}
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button
            onClick={handleTest}
            disabled={testing || saving}
            className="flex items-center gap-2 px-4 py-2.5 border border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-700 font-semibold text-sm rounded-xl transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={testing ? 'animate-spin' : ''} />
            {testing ? 'Test in corso...' : 'Testa connessione'}
          </button>

          <button
            onClick={handleSave}
            disabled={saving || !isDirty || !url.trim() || !anonKey.trim()}
            className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-semibold text-sm rounded-xl transition-colors shadow-sm"
          >
            {saving ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
            {saving ? 'Applicando...' : 'Salva e riavvia'}
          </button>

          {hasLocalOverride && (
            <button
              onClick={handleReset}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2.5 border border-red-200 bg-red-50 hover:bg-red-100 text-red-600 font-semibold text-sm rounded-xl transition-colors disabled:opacity-50"
            >
              <X size={14} />
              Ripristina predefinite
            </button>
          )}
        </div>

        {isDirty && !saving && (
          <p className="text-xs text-amber-600 font-medium">
            Hai modifiche non salvate. Clicca "Salva e riavvia" per applicarle.
          </p>
        )}
      </div>

      {/* Avviso */}
      <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 space-y-2">
        <p className="text-xs font-bold text-stone-700">Come cambiare account Supabase</p>
        <ol className="space-y-1.5 list-decimal list-inside">
          <li className="text-xs text-stone-500 leading-relaxed">Accedi a <strong>supabase.com</strong> e seleziona (o crea) il nuovo progetto</li>
          <li className="text-xs text-stone-500 leading-relaxed">Vai su <strong>Settings → API</strong> e copia il <em>Project URL</em> e la chiave <em>anon public</em></li>
          <li className="text-xs text-stone-500 leading-relaxed">Incollali nei campi qui sopra, usa <strong>Testa connessione</strong> per verificare</li>
          <li className="text-xs text-stone-500 leading-relaxed">Clicca <strong>Salva e riavvia</strong> — il programma si ricarica e si connette al nuovo database</li>
        </ol>
        <p className="text-xs text-stone-400 pt-1">Le chiavi vengono salvate solo su questo dispositivo e non vengono mai inviate a terzi.</p>
      </div>
    </div>
  );
}
