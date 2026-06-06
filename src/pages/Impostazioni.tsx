import { useState, useEffect, useRef } from 'react';
import { Settings, Lock, Eye, EyeOff, Check, AlertCircle, ChevronRight, ArrowLeft, KeyRound, Bell, MessageCircle, MapPin, Tag, Plus, Trash2, Star, CreditCard as Edit3, X, Send, MessageSquare, ChevronDown, QrCode, ExternalLink, Download, DatabaseBackup, UploadCloud, AlertTriangle, Cloud, RefreshCw, Clock, CalendarDays, FolderOpen, UserCog, Mail, Activity, Wifi, Scissors, Droplets, Wind, Sparkles, ImagePlus, RotateCcw } from 'lucide-react';
import { CombIcon, RazorIcon, NailsIcon, WomanFaceIcon } from '../lib/salonIcons';
import { getTheme, saveTheme, getLogoCacheB64, saveLogoCacheB64, dispatchThemeChange, SIDEBAR_PRESETS, ACCENT_PRESETS, ICON_PRESETS, THEME_DEFAULTS } from '../lib/theme';
import { supabase, localDateStr } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { restoreBackup, exportBackup, isElectron as isElectronEnv, dbSelect, dbInsert, dbUpdate, dbDelete, getImpostazione, setImpostazione, compressImage } from '../lib/localDb';
import { saveFile, browserDownload } from '../lib/fileSaver';
import StatisticheGate from '../components/StatisticheGate';

type SubPage = null | 'password' | 'promemoria' | 'messaggio_avviso' | 'template_carta' | 'template_comunicazioni' | 'qrcode' | 'backup' | 'connessione' | 'account' | 'keepalive' | 'cartelle' | 'tema';

export default function Impostazioni({ onTestReminder }: { onTestReminder?: () => void }) {
  const { user } = useAuth();
  const [sub, setSub] = useState<SubPage>(null);
  const [msgOpen, setMsgOpen] = useState(false);
  const [whatsappDisabilitato, setWhatsappDisabilitato] = useState(false);

  useEffect(() => {
    getImpostazione('whatsapp_avviso_disabilitato').then(v => {
      setWhatsappDisabilitato(v === 'true');
    });
  }, []);

  async function toggleWhatsapp(val: boolean) {
    setWhatsappDisabilitato(val);
    await setImpostazione('whatsapp_avviso_disabilitato', val ? 'true' : 'false', user?.id);
  }

  if (sub === 'tema') return <PaginaTema onBack={() => setSub(null)} />;
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
  if (sub === 'cartelle') return <PaginaCartelleSalvataggio onBack={() => setSub(null)} />;
  if (sub === 'keepalive') return <PaginaKeepAlive onBack={() => setSub(null)} />;

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

        {/* Tema e Personalizzazione */}
        <button
          onClick={() => setSub('tema')}
          className="w-full flex items-center gap-4 px-6 py-4 hover:bg-stone-50 transition-colors group"
        >
          <div className="w-10 h-10 rounded-xl bg-stone-100 group-hover:bg-violet-100 flex items-center justify-center flex-shrink-0 transition-colors">
            <Palette size={18} className="text-stone-500 group-hover:text-violet-600 transition-colors" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-semibold text-stone-800">Tema e Personalizzazione</p>
            <p className="text-xs text-stone-400 mt-0.5">Colori sidebar, icona e logo del salone (per questo dispositivo)</p>
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
              {/* Toggle WhatsApp avvisi */}
              <div className="w-full flex items-center gap-4 pl-10 pr-6 py-3.5">
                <div className={`w-8 h-8 rounded-lg border flex items-center justify-center flex-shrink-0 transition-colors ${whatsappDisabilitato ? 'bg-white border-stone-200' : 'bg-white border-emerald-200'}`}>
                  <MessageCircle size={15} className={whatsappDisabilitato ? 'text-stone-300' : 'text-emerald-500'} />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium text-stone-700">Messaggi WhatsApp automatici</p>
                  <p className="text-xs text-stone-400 mt-0.5">
                    {whatsappDisabilitato ? 'Pulsante avviso clienti nascosto nell\'agenda' : 'Pulsante avviso clienti visibile nell\'agenda'}
                  </p>
                </div>
                <button
                  onClick={() => toggleWhatsapp(!whatsappDisabilitato)}
                  className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${whatsappDisabilitato ? 'bg-stone-200' : 'bg-emerald-500'}`}
                >
                  <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${whatsappDisabilitato ? 'translate-x-0.5' : 'translate-x-5'}`} />
                </button>
              </div>

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

        {/* Keep-alive automatico */}
        <button
          onClick={() => setSub('keepalive')}
          className="w-full flex items-center gap-4 px-6 py-4 hover:bg-stone-50 transition-colors group"
        >
          <div className="w-10 h-10 rounded-xl bg-stone-100 group-hover:bg-emerald-100 flex items-center justify-center flex-shrink-0 transition-colors">
            <Activity size={18} className="text-stone-500 group-hover:text-emerald-600 transition-colors" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-semibold text-stone-800">Keep-alive automatico</p>
            <p className="text-xs text-stone-400 mt-0.5">Stato del ping automatico che mantiene attivo il database Supabase</p>
          </div>
          <ChevronRight size={16} className="text-stone-400 group-hover:text-stone-600 transition-colors" />
        </button>

        {/* Cartelle di salvataggio */}
        <button
          onClick={() => setSub('cartelle')}
          className="w-full flex items-center gap-4 px-6 py-4 hover:bg-stone-50 transition-colors group"
        >
          <div className="w-10 h-10 rounded-xl bg-stone-100 group-hover:bg-amber-100 flex items-center justify-center flex-shrink-0 transition-colors">
            <FolderOpen size={18} className="text-stone-500 group-hover:text-amber-600 transition-colors" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-semibold text-stone-800">Cartelle di salvataggio</p>
            <p className="text-xs text-stone-400 mt-0.5">Configura le cartelle di destinazione per file scaricabili e salvataggio automatico</p>
          </div>
          <ChevronRight size={16} className="text-stone-400 group-hover:text-stone-600 transition-colors" />
        </button>
      </div>
    </div>
  );
}

// ─── Tema e Personalizzazione ─────────────────────────────────────────────────

const ICON_COMPONENTS: Record<string, React.ElementType> = {
  Scissors,
  Comb: CombIcon,
  Razor: RazorIcon,
  Nails: NailsIcon,
  WomanFace: WomanFaceIcon,
  Droplets,
  Wind,
  Sparkles,
};

function PaginaTema({ onBack }: { onBack: () => void }) {
  const { user } = useAuth();
  const [theme, setThemeState] = useState(getTheme);
  const [logoPreview, setLogoPreview] = useState<string>(() => getLogoCacheB64());
  const [uploading, setUploading] = useState(false);
  const [saved, setSaved] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function apply(patch: Parameters<typeof saveTheme>[0]) {
    const next = saveTheme(patch);
    setThemeState(next);

    // Apply CSS vars immediately for live preview
    document.documentElement.style.setProperty('--sidebar-bg', next.sidebarBg);
    document.documentElement.style.setProperty('--accent', next.accentColor);
    dispatchThemeChange();
  }

  async function handleLogoUpload(file: File) {
    if (!user) return;
    setUploading(true);
    try {
      const blob = await compressImage(file);

      // Cache base64 immediately for offline use
      const b64 = await new Promise<string>((res, rej) => {
        const reader = new FileReader();
        reader.onload = () => res(reader.result as string);
        reader.onerror = rej;
        reader.readAsDataURL(blob);
      });
      saveLogoCacheB64(b64);
      setLogoPreview(b64);

      // Upload to Supabase Storage
      const path = `logo/${user.id}/salone-logo.jpg`;
      const { error } = await supabase.storage
        .from('foto-clienti')
        .upload(path, blob, { upsert: true, contentType: 'image/jpeg' });

      if (!error) {
        const { data: urlData } = supabase.storage.from('foto-clienti').getPublicUrl(path);
        const logoUrl = urlData.publicUrl;
        apply({ logoUrl });
        // Persist URL in impostazioni for cross-device sync
        await supabase.from('impostazioni').upsert(
          { chiave: 'logo_salone_url', valore: logoUrl, user_id: user.id },
          { onConflict: 'chiave,user_id' }
        );
      }

      dispatchThemeChange();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // silently ignore
    } finally {
      setUploading(false);
    }
  }

  async function removeLogo() {
    saveLogoCacheB64('');
    setLogoPreview('');
    apply({ logoUrl: '' });
    if (user) {
      await supabase.from('impostazioni').upsert(
        { chiave: 'logo_salone_url', valore: '', user_id: user.id },
        { onConflict: 'chiave,user_id' }
      );
    }
  }

  function resetAll() {
    saveLogoCacheB64('');
    setLogoPreview('');
    const next = saveTheme(THEME_DEFAULTS);
    setThemeState(next);
    document.documentElement.style.setProperty('--sidebar-bg', next.sidebarBg);
    document.documentElement.style.setProperty('--accent', next.accentColor);
    dispatchThemeChange();
  }

  const SidebarIconComp = ICON_COMPONENTS[theme.sidebarIcon] ?? Scissors;

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-lg hover:bg-stone-100 text-stone-500 hover:text-stone-800 transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h2 className="text-xl font-bold text-stone-800">Tema e Personalizzazione</h2>
          <p className="text-xs text-stone-400 mt-0.5">Preferenze salvate su questo dispositivo</p>
        </div>
      </div>

      {/* Live preview */}
      <div className="rounded-2xl border border-stone-200 overflow-hidden shadow-sm">
        <div className="text-xs font-semibold text-stone-400 uppercase tracking-wide px-4 pt-4 pb-2">Anteprima</div>
        <div className="flex items-stretch" style={{ minHeight: 72 }}>
          <div
            className="flex items-center gap-3 px-4 py-4 flex-shrink-0"
            style={{ backgroundColor: theme.sidebarBg, width: 192 }}
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden"
              style={{ backgroundColor: theme.accentColor }}
            >
              <SidebarIconComp size={16} className="text-white" />
            </div>
            <div>
              <p className="font-bold text-sm text-white">Salone</p>
              <p className="text-xs font-medium" style={{ color: theme.accentColor }}>Gestionale</p>
            </div>
          </div>
          <div className="flex-1 bg-white flex items-center px-4 gap-3">
            <div
              className="px-3 py-1.5 rounded-lg text-white text-xs font-semibold"
              style={{ backgroundColor: theme.accentColor }}
            >
              Voce attiva
            </div>
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold overflow-hidden"
              style={{ backgroundColor: logoPreview ? 'transparent' : theme.accentColor }}>
              {logoPreview ? <img src={logoPreview} alt="" className="w-full h-full object-cover" /> : 'FE'}
            </div>
          </div>
        </div>
      </div>

      {/* Colore sidebar */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5 space-y-3">
        <p className="text-sm font-semibold text-stone-800">Colore sidebar</p>
        <div className="grid grid-cols-4 gap-2">
          {SIDEBAR_PRESETS.map(p => (
            <button
              key={p.value}
              onClick={() => apply({ sidebarBg: p.value })}
              className="flex flex-col items-center gap-1.5 p-2 rounded-xl border-2 transition-all"
              style={{
                borderColor: theme.sidebarBg === p.value ? theme.accentColor : 'transparent',
                backgroundColor: theme.sidebarBg === p.value ? '#fafaf9' : 'transparent',
              }}
            >
              <div className="w-8 h-8 rounded-lg" style={{ backgroundColor: p.value }} />
              <span className="text-[10px] text-stone-500 font-medium">{p.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Colore accento */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5 space-y-3">
        <p className="text-sm font-semibold text-stone-800">Colore accento</p>
        <div className="grid grid-cols-4 gap-2">
          {ACCENT_PRESETS.map(p => (
            <button
              key={p.value}
              onClick={() => apply({ accentColor: p.value })}
              className="flex flex-col items-center gap-1.5 p-2 rounded-xl border-2 transition-all"
              style={{
                borderColor: theme.accentColor === p.value ? p.value : 'transparent',
                backgroundColor: theme.accentColor === p.value ? '#fafaf9' : 'transparent',
              }}
            >
              <div className="w-8 h-8 rounded-lg" style={{ backgroundColor: p.value }} />
              <span className="text-[10px] text-stone-500 font-medium">{p.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Icona sidebar */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5 space-y-3">
        <p className="text-sm font-semibold text-stone-800">Icona sidebar</p>
        <p className="text-xs text-stone-400">Usata quando non e' impostato un logo</p>
        <div className="flex flex-wrap gap-2">
          {ICON_PRESETS.map(iconName => {
            const Ic = ICON_COMPONENTS[iconName] ?? Scissors;
            const active = theme.sidebarIcon === iconName;
            return (
              <button
                key={iconName}
                onClick={() => apply({ sidebarIcon: iconName })}
                className="w-11 h-11 rounded-xl flex items-center justify-center border-2 transition-all"
                style={{
                  backgroundColor: active ? theme.accentColor : '#f5f5f4',
                  borderColor: active ? theme.accentColor : 'transparent',
                  color: active ? 'white' : '#78716c',
                }}
              >
                <Ic size={18} />
              </button>
            );
          })}
        </div>
      </div>

      {/* Logo salone */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5 space-y-4">
        <div>
          <p className="text-sm font-semibold text-stone-800">Logo salone</p>
          <p className="text-xs text-stone-400 mt-0.5">Condiviso su tutti i dispositivi dello stesso account. Salvato offline automaticamente.</p>
        </div>

        {logoPreview ? (
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl overflow-hidden border border-stone-200 flex-shrink-0">
              <img src={logoPreview} alt="Logo salone" className="w-full h-full object-cover" />
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => fileRef.current?.click()}
                className="text-sm text-stone-600 hover:text-stone-900 font-medium flex items-center gap-1.5 transition-colors"
              >
                <ImagePlus size={15} />
                Cambia immagine
              </button>
              <button
                onClick={removeLogo}
                className="text-sm text-red-500 hover:text-red-700 font-medium flex items-center gap-1.5 transition-colors"
              >
                <X size={15} />
                Rimuovi logo
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="w-full flex flex-col items-center gap-3 py-8 rounded-xl border-2 border-dashed border-stone-200 hover:border-stone-300 transition-colors text-stone-400 hover:text-stone-600"
          >
            {uploading ? (
              <RefreshCw size={24} className="animate-spin" />
            ) : (
              <ImagePlus size={24} />
            )}
            <span className="text-sm font-medium">
              {uploading ? 'Caricamento...' : 'Carica logo'}
            </span>
            <span className="text-xs">PNG, JPG — max 5 MB</span>
          </button>
        )}

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={e => {
            const f = e.target.files?.[0];
            if (f) handleLogoUpload(f);
            e.target.value = '';
          }}
        />

        {saved && (
          <div className="flex items-center gap-2 text-emerald-600 text-sm font-medium">
            <Check size={15} />
            Logo salvato e sincronizzato
          </div>
        )}
      </div>

      {/* Reset */}
      <div className="flex justify-end">
        <button
          onClick={resetAll}
          className="flex items-center gap-2 text-sm text-stone-400 hover:text-stone-700 transition-colors font-medium"
        >
          <RotateCcw size={14} />
          Ripristina impostazioni predefinite
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

    // Backup automatico: usa sempre il download silenzioso (a.click) perché
    // showSaveFilePicker richiede un gesto utente e viene bloccato da setInterval.
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);

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

  const isElectronApp = !!window.electronAPI;

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

  const cloudApiUrl = `${localStorage.getItem('sb_custom_url') || import.meta.env.VITE_SUPABASE_URL}/functions/v1/backup-database`;
  const cloudHeaders = {
    'Authorization': `Bearer ${localStorage.getItem('sb_custom_anon_key') || import.meta.env.VITE_SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
  };

  async function handleExport() {
    setExporting(true);
    setFeedback(null);
    try {
      let data: Record<string, unknown> | null = null;

      // In Electron: usa DB locale (funziona anche offline)
      if (isElectronEnv()) {
        data = await exportBackup();
        if (!data) throw new Error('Esportazione locale non riuscita');
      } else {
        const res = await fetch(cloudApiUrl, { headers: cloudHeaders });
        if (!res.ok) throw new Error('Errore durante l\'esportazione');
        data = await res.json();
      }

      const jsonStr = JSON.stringify(data, null, 2);
      const suggestedName = `backup-salone-${localDateStr()}.json`;

      const result = await saveFile('backup', suggestedName, jsonStr);
      if (result?.filePath) {
        setFeedback({ tipo: 'ok', msg: `Backup salvato in: ${result.filePath}` });
      } else {
        // Nessuna cartella configurata o web: fallback al download del browser
        browserDownload(suggestedName, jsonStr);
        setFeedback({ tipo: 'ok', msg: 'Backup scaricato con successo.' });
      }
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

      // Supporta sia il formato legacy {data, tables} che il formato diretto {clienti:[...], ...}
      const backupData = parsed?.data ?? parsed;

      const result = await restoreBackup(backupData);

      if (result.success) {
        setFeedback({ tipo: 'ok', msg: 'Ripristino completato. Tutti i dati sono stati ripristinati dal backup.' });
      } else {
        const errors = Object.entries(result.results ?? {})
          .filter(([, v]) => !(v as { ok: boolean }).ok)
          .map(([k]) => k)
          .join(', ');
        if (errors) {
          setFeedback({ tipo: 'warn', msg: `Ripristino parziale. Errori nelle tabelle: ${errors}` });
        } else {
          setFeedback({ tipo: 'err', msg: `Errore: ${result.error ?? 'Sconosciuto'}` });
        }
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
              {isElectronApp
                ? 'Schedulato dal sistema operativo — funziona anche con il programma minimizzato'
                : 'Il backup scatta mentre il programma è aperto nel browser'}
            </p>
          </div>
          {isElectronApp && (
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
                {isElectronApp
                  ? 'Il backup scatta esattamente a quest\'orario — anche con il programma minimizzato'
                  : 'Il backup scatta all\'orario impostato se il browser è aperto, oppure al primo avvio dopo quell\'ora'}
              </p>
            </div>

            {/* Cartella destinazione (solo Electron) */}
            {isElectronApp && (
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

type QrLayout = 'con_frase' | 'solo_punti' | 'solo_qr';
type QrFormato = 'a4' | 'a5' | 'a6' | 'cartolina';

const BELLA_FRASE = 'Ogni capello racconta una storia.\nLasciaci essere parte della tua.';

const FORMATO_LABELS: Record<QrFormato, string> = {
  a4: 'A4 (210×297 mm)',
  a5: 'A5 (148×210 mm)',
  a6: 'A6 (105×148 mm)',
  cartolina: 'Cartolina (100×150 mm)',
};

const FORMATO_MM: Record<QrFormato, [number, number]> = {
  a4: [210, 297],
  a5: [148, 210],
  a6: [105, 148],
  cartolina: [100, 150],
};

const QR_LOGO_KEY = 'qr_logo_data_url';
const QR_LOGO_DEFAULT = '/Screenshot_2026-06-05_115030.png';

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function buildQrWithLogo(qrImgUrl: string, logo: string | null): Promise<string> {
  const qrImg = await loadImage(qrImgUrl);
  const size = qrImg.naturalWidth || 400;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);
  ctx.drawImage(qrImg, 0, 0);

  if (logo) {
    const logoImg = await loadImage(logo);
    const logoSize = size * 0.22;
    const lx = (size - logoSize) / 2;
    const ly = (size - logoSize) / 2;
    const pad = logoSize * 0.14;
    const bx = lx - pad, by = ly - pad, bw = logoSize + pad * 2, bh = logoSize + pad * 2;
    const r = bw * 0.18;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(bx + r, by);
    ctx.lineTo(bx + bw - r, by);
    ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + r);
    ctx.lineTo(bx + bw, by + bh - r);
    ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - r, by + bh);
    ctx.lineTo(bx + r, by + bh);
    ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - r);
    ctx.lineTo(bx, by + r);
    ctx.quadraticCurveTo(bx, by, bx + r, by);
    ctx.closePath();
    ctx.fill();
    ctx.drawImage(logoImg, lx, ly, logoSize, logoSize);
  }

  return canvas.toDataURL('image/png');
}

function PaginaQRCode({ onBack }: { onBack: () => void }) {
  const [registrazioneUrl, setRegistrazioneUrl] = useState('https://silver-kitsune-3a0339.netlify.app/');
  const [editingUrl, setEditingUrl] = useState(false);
  const [urlDraft, setUrlDraft] = useState('');
  const [savingUrl, setSavingUrl] = useState(false);
  const [layout, setLayout] = useState<QrLayout>('con_frase');
  const [formato, setFormato] = useState<QrFormato>('a4');
  const [generando, setGenerando] = useState(false);
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(QR_LOGO_DEFAULT);
  const [qrComposite, setQrComposite] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      const val = await getImpostazione('registrazione_url');
      if (val) setRegistrazioneUrl(val);
      const saved = localStorage.getItem(QR_LOGO_KEY);
      setLogoDataUrl(saved || QR_LOGO_DEFAULT);
    })();
  }, []);

  async function handleSaveUrl() {
    const trimmed = urlDraft.trim();
    if (!trimmed) return;
    setSavingUrl(true);
    const { data: { user } } = await supabase.auth.getUser();
    await setImpostazione('registrazione_url', trimmed, user?.id);
    setRegistrazioneUrl(trimmed);
    setEditingUrl(false);
    setSavingUrl(false);
  }

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&margin=10&ecc=H&data=${encodeURIComponent(registrazioneUrl)}`;

  useEffect(() => {
    setQrComposite(null);
    buildQrWithLogo(qrUrl, logoDataUrl).then(setQrComposite).catch(() => setQrComposite(qrUrl));
  }, [qrUrl, logoDataUrl]);

  function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const result = ev.target?.result as string;
      setLogoDataUrl(result);
      localStorage.setItem(QR_LOGO_KEY, result);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  function handleRemoveLogo() {
    setLogoDataUrl(QR_LOGO_DEFAULT);
    localStorage.removeItem(QR_LOGO_KEY);
  }

  async function handleDownloadPdf() {
    setGenerando(true);
    try {
      const [w, h] = FORMATO_MM[formato];
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ orientation: h > w ? 'portrait' : 'landscape', unit: 'mm', format: [w, h] });

      const cx = w / 2;
      const margin = w * 0.08;

      // sfondo bianco
      doc.setFillColor(255, 255, 255);
      doc.rect(0, 0, w, h, 'F');

      // carica QR (con logo sovrapposto se presente)
      const qrSize = Math.min(w * 0.52, h * 0.40);
      const qrImg = await buildQrWithLogo(qrUrl, logoDataUrl);

      let y = margin;

      if (layout === 'con_frase') {
        // icona cerchio dorato
        const r = Math.min(w * 0.055, 7);
        doc.setFillColor(37, 77, 26);
        doc.circle(cx, y + r, r, 'F');
        y += r * 2 + 9;

        // titolo
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(Math.max(14, w * 0.07));
        doc.setTextColor(28, 25, 23);
        doc.text('Benvenuta/o!', cx, y, { align: 'center' });
        y += Math.max(6, w * 0.04);

        // bella frase
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(Math.max(8, w * 0.038));
        doc.setTextColor(120, 113, 108);
        const fraseLines = doc.splitTextToSize(BELLA_FRASE.replace('\n', ' '), w - margin * 2);
        doc.text(fraseLines, cx, y, { align: 'center' });
        y += fraseLines.length * Math.max(5, w * 0.03) + Math.max(3, w * 0.02);

        // sottotitolo
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(Math.max(7, w * 0.033));
        doc.setTextColor(120, 113, 108);
        const sub = doc.splitTextToSize('Scansiona il codice QR con il tuo smartphone per compilare la tua scheda cliente', w - margin * 2);
        doc.text(sub, cx, y, { align: 'center' });
        y += sub.length * Math.max(4, w * 0.025) + Math.max(3, w * 0.02);

        // QR
        const qrX = cx - qrSize / 2;
        doc.setDrawColor(231, 229, 228);
        doc.setLineWidth(0.3);
        doc.roundedRect(qrX - 2, y - 2, qrSize + 4, qrSize + 4, 3, 3, 'S');
        doc.addImage(qrImg, 'PNG', qrX, y, qrSize, qrSize);
        y += qrSize + Math.max(4, w * 0.025);

        // 4 passi
        y = _drawSteps(doc, y, w, h, margin, cx);

        // privacy
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(Math.max(6, w * 0.028));
        doc.setTextColor(168, 162, 158);
        doc.text('I tuoi dati saranno trattati nel rispetto della privacy', cx, h - margin * 0.6, { align: 'center' });

      } else if (layout === 'solo_punti') {
        // solo QR + 4 punti (no bella frase, no titolo)
        // piccolo logo
        const r = Math.min(w * 0.045, 6);
        doc.setFillColor(37, 77, 26);
        doc.circle(cx, y + r, r, 'F');
        y += r * 2 + 9;

        // titolo compatto
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(Math.max(12, w * 0.06));
        doc.setTextColor(28, 25, 23);
        doc.text('Benvenuta/o!', cx, y, { align: 'center' });
        y += Math.max(5, w * 0.035);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(Math.max(7, w * 0.032));
        doc.setTextColor(120, 113, 108);
        const sub2 = doc.splitTextToSize('Scansiona il codice QR per compilare la tua scheda cliente', w - margin * 2);
        doc.text(sub2, cx, y, { align: 'center' });
        y += sub2.length * Math.max(4, w * 0.025) + Math.max(3, w * 0.02);

        // QR
        const qrX2 = cx - qrSize / 2;
        doc.setDrawColor(231, 229, 228);
        doc.setLineWidth(0.3);
        doc.roundedRect(qrX2 - 2, y - 2, qrSize + 4, qrSize + 4, 3, 3, 'S');
        doc.addImage(qrImg, 'PNG', qrX2, y, qrSize, qrSize);
        y += qrSize + Math.max(4, w * 0.025);

        y = _drawSteps(doc, y, w, h, margin, cx);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(Math.max(6, w * 0.028));
        doc.setTextColor(168, 162, 158);
        doc.text('I tuoi dati saranno trattati nel rispetto della privacy', cx, h - margin * 0.6, { align: 'center' });

      } else {
        // solo QR code centrato verticalmente
        const qrSizeLg = Math.min(w * 0.65, h * 0.55);
        const qrYLg = h / 2 - qrSizeLg / 2 - h * 0.03;
        doc.setDrawColor(231, 229, 228);
        doc.setLineWidth(0.4);
        doc.roundedRect(cx - qrSizeLg / 2 - 3, qrYLg - 3, qrSizeLg + 6, qrSizeLg + 6, 4, 4, 'S');
        doc.addImage(qrImg, 'PNG', cx - qrSizeLg / 2, qrYLg, qrSizeLg, qrSizeLg);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(Math.max(10, w * 0.055));
        doc.setTextColor(28, 25, 23);
        doc.text('Scansiona per registrarti', cx, qrYLg - margin * 0.5, { align: 'center' });

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(Math.max(6, w * 0.028));
        doc.setTextColor(168, 162, 158);
        doc.text('I tuoi dati saranno trattati nel rispetto della privacy', cx, h - margin * 0.6, { align: 'center' });
      }

      const formatoLabel = formato.toUpperCase();
      await saveFile('qrcode', `qr-registrazione-${formatoLabel}.pdf`, doc.output('blob'));
    } finally {
      setGenerando(false);
    }
  }

  function _drawSteps(doc: InstanceType<typeof import('jspdf').jsPDF>, y: number, w: number, h: number, margin: number, cx: number): number {
    const steps = [
      'Apri la fotocamera del tuo smartphone',
      'Inquadra il codice QR',
      'Compila il modulo con i tuoi dati',
      'Invia — lo staff creerà la tua scheda!',
    ];
    const boxPad = Math.max(3, w * 0.04);
    const stepH = Math.max(6, w * 0.05);
    const totalH = steps.length * stepH + boxPad * 2;
    const bx = margin;
    const bw = w - margin * 2;

    // sfondo box
    doc.setFillColor(250, 250, 249);
    doc.setDrawColor(231, 229, 228);
    doc.setLineWidth(0.2);
    doc.roundedRect(bx, y, bw, totalH, 3, 3, 'FD');

    let sy = y + boxPad + stepH * 0.35;
    const dotR = Math.max(2, w * 0.022);
    const fontSize = Math.max(6.5, w * 0.032);

    const stepRgb: [number, number, number][] = [
      [140, 195, 118],
      [90, 152, 68],
      [55, 110, 38],
      [37, 77, 26],
    ];
    steps.forEach((step, i) => {
      const dotX = bx + boxPad + dotR;
      const dotY = sy - dotR * 0.2;

      doc.setFillColor(...stepRgb[i]);
      doc.circle(dotX, dotY, dotR, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(fontSize);
      doc.setTextColor(255, 255, 255);
      doc.text(String(i + 1), dotX, dotY + dotR * 0.38, { align: 'center' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(fontSize);
      doc.setTextColor(68, 64, 60);
      doc.text(step, dotX + dotR + 2, sy, { maxWidth: bw - boxPad * 2 - dotR * 2 - 2 });

      sy += stepH;
    });

    return y + totalH + Math.max(4, w * 0.025);
  }

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
    const filename = 'registrazione-cliente.html';
    await saveFile('comunicazioni', filename, html);
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
      <div className="bg-white rounded-2xl border border-stone-200 p-10 text-center shadow-sm">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{background:'#254d1a'}}>
          <QrCode size={22} className="text-white" />
        </div>
        <h3 className="text-xl font-bold text-stone-800 mb-2">Benvenuta/o!</h3>
        <p className="text-sm text-stone-500 mb-8 leading-relaxed max-w-xs mx-auto">
          Scansiona il codice QR con il tuo smartphone per compilare la tua scheda cliente
        </p>

        <div className="inline-block p-3 bg-white border border-stone-200 rounded-2xl shadow-sm mb-8 relative">
          {qrComposite ? (
            <img src={qrComposite} alt="QR Code registrazione clienti" className="w-52 h-52 block" />
          ) : (
            <div className="w-52 h-52 flex items-center justify-center bg-stone-50 rounded-xl">
              <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{borderColor:'#254d1a',borderTopColor:'transparent'}} />
            </div>
          )}
        </div>

        <div className="bg-stone-50 rounded-xl p-5 text-left space-y-3 max-w-xs mx-auto mb-6">
          {(['Apri la fotocamera del tuo smartphone', 'Inquadra il codice QR', 'Compila il modulo con i tuoi dati', 'Invia — lo staff creerà la tua scheda!'] as const).map((step, i) => {
            const stepColors = ['#8cc376', '#5a9844', '#376e26', '#254d1a'];
            return (
              <div key={i} className="flex items-center gap-3">
                <div className="w-7 h-7 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 leading-none" style={{background: stepColors[i]}}>
                  {i + 1}
                </div>
                <p className="text-sm text-stone-600 leading-snug">{step}</p>
              </div>
            );
          })}
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
                className="w-full rounded-lg px-3 py-1.5 text-sm font-mono focus:outline-none bg-white" style={{border:'1px solid #254d1a',boxShadow:'0 0 0 0px transparent'}} onFocus={e=>{e.currentTarget.style.boxShadow='0 0 0 2px rgba(37,77,26,.25)'}} onBlur={e=>{e.currentTarget.style.boxShadow='none'}}
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

      {/* Logo QR */}
      <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-sm">
        <p className="text-sm font-bold text-stone-800 mb-1">Logo nel QR Code</p>
        <p className="text-xs text-stone-400 mb-4">Il logo del salone compare al centro del codice QR. Puoi caricarne uno personalizzato.</p>
        <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
        {logoDataUrl ? (
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl border border-stone-200 overflow-hidden flex-shrink-0 bg-stone-50">
              <img src={logoDataUrl} alt="Logo" className="w-full h-full object-contain" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-stone-700 mb-2">Logo caricato</p>
              <div className="flex gap-2">
                <button
                  onClick={() => logoInputRef.current?.click()}
                  className="px-3 py-1.5 text-xs font-semibold border border-stone-200 rounded-lg text-stone-600 hover:border-amber-300 hover:text-amber-700 transition-colors"
                >
                  Cambia
                </button>
                <button
                  onClick={handleRemoveLogo}
                  className="px-3 py-1.5 text-xs font-semibold border border-stone-200 rounded-lg text-stone-500 hover:bg-stone-50 transition-colors"
                >
                  Predefinito
                </button>
              </div>
            </div>
          </div>
        ) : (
          <button
            onClick={() => logoInputRef.current?.click()}
            className="w-full flex flex-col items-center justify-center gap-2 py-6 border-2 border-dashed border-stone-200 rounded-xl hover:border-amber-300 hover:bg-amber-50 transition-all group"
          >
            <div className="w-10 h-10 rounded-xl bg-stone-100 group-hover:bg-amber-100 flex items-center justify-center transition-colors">
              <Download size={18} className="text-stone-400 group-hover:text-amber-600 transition-colors" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-stone-600 group-hover:text-amber-700 transition-colors">Carica logo</p>
              <p className="text-xs text-stone-400">PNG, JPG, SVG — comparirà al centro del QR</p>
            </div>
          </button>
        )}
      </div>

      {/* Opzioni stampa PDF */}
      <div className="bg-white rounded-2xl border border-stone-200 p-5 space-y-5 shadow-sm">
        <p className="text-sm font-bold text-stone-800">Opzioni PDF</p>

        {/* Scelta layout */}
        <div>
          <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">Contenuto</p>
          <div className="grid grid-cols-1 gap-2">
            {([
              ['con_frase', 'Con frase ad effetto', 'Logo · Frase ispirazionale · QR · 4 passi · Privacy'],
              ['solo_punti', 'QR code e istruzioni', 'Logo · QR code · 4 passi · Privacy'],
              ['solo_qr', 'Solo QR code', 'QR code · Privacy'],
            ] as [QrLayout, string, string][]).map(([val, label, desc]) => (
              <button
                key={val}
                onClick={() => setLayout(val)}
                className={`flex items-start gap-3 px-4 py-3 rounded-xl border text-left transition-all ${
                  layout === val
                    ? 'border-amber-400 bg-amber-50'
                    : 'border-stone-200 hover:border-stone-300 hover:bg-stone-50'
                }`}
              >
                <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 mt-0.5 transition-all ${
                  layout === val ? 'border-amber-500 bg-amber-500' : 'border-stone-300'
                }`}>
                  {layout === val && <div className="w-2 h-2 bg-white rounded-full m-auto mt-0.5" />}
                </div>
                <div>
                  <p className="text-sm font-semibold text-stone-800">{label}</p>
                  <p className="text-xs text-stone-400 mt-0.5">{desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Scelta formato */}
        <div>
          <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">Formato</p>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(FORMATO_LABELS) as QrFormato[]).map(f => (
              <button
                key={f}
                onClick={() => setFormato(f)}
                className={`px-3 py-2.5 rounded-xl border text-sm font-medium transition-all text-left ${
                  formato === f
                    ? 'border-amber-400 bg-amber-50 text-amber-800'
                    : 'border-stone-200 text-stone-600 hover:border-stone-300 hover:bg-stone-50'
                }`}
              >
                {FORMATO_LABELS[f]}
              </button>
            ))}
          </div>
        </div>

        {/* Bottone download */}
        <button
          onClick={handleDownloadPdf}
          disabled={generando}
          className="w-full flex items-center justify-center gap-2 py-3.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white font-bold text-sm rounded-xl transition-colors shadow-sm"
        >
          <Download size={16} />
          {generando ? 'Generazione in corso…' : `Scarica PDF (${formato.toUpperCase()})`}
        </button>
      </div>

      {/* Scarica HTML */}
      <div className="grid grid-cols-1 gap-3">
        <button
          onClick={handleDownloadHtml}
          className="flex items-center justify-center gap-2 py-3 bg-stone-800 hover:bg-stone-900 text-white font-bold text-sm rounded-xl transition-colors shadow-sm"
        >
          <Download size={16} />
          Scarica pagina HTML (form registrazione clienti)
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
  { chiave: 'password_carte', titolo: 'Carte', descrizione: "Creazione, ricarica e cancellazione carte sconto e premium", feedbackMsg: "Password aggiornata. Sarà richiesta alla prossima operazione sulle carte.", onSaved: () => {} },
  { chiave: 'password_grafico_servizi', titolo: 'Grafico Servizi', descrizione: "Visualizzazione grafico servizi nella scheda cliente", feedbackMsg: "Password aggiornata. Sarà richiesta al prossimo accesso al grafico servizi.", onSaved: () => {} },
  { chiave: 'password_incasso', titolo: 'Incasso Convalidato', descrizione: "Visualizzazione cifra incasso convalidato nella pagina fiches", feedbackMsg: "Password aggiornata. Sarà richiesta alla prossima visualizzazione dell'incasso.", onSaved: () => sessionStorage.removeItem('incasso_unlocked') },
  { chiave: 'password_elimina_clienti', titolo: 'Elimina Cliente / Scheda', descrizione: "Eliminazione definitiva di un cliente o scheda da confermare", feedbackMsg: "Password aggiornata. Sarà richiesta alla prossima eliminazione.", onSaved: () => {} },
  { chiave: 'password_elimina_parrucchieri', titolo: 'Elimina Parrucchiere', descrizione: "Eliminazione definitiva di un parrucchiere", feedbackMsg: "Password aggiornata. Sarà richiesta alla prossima eliminazione.", onSaved: () => {} },
  { chiave: 'password_chat_stats', titolo: 'Chat — Incassi, Servizi, Parrucchieri', descrizione: "Accesso alle statistiche di incassi, servizi e parrucchieri nella chat assistente", feedbackMsg: "Password aggiornata. Sarà richiesta al prossimo accesso alle statistiche nella chat.", onSaved: () => sessionStorage.removeItem('chat_stats_unlocked') },
  { chiave: 'password_stampa_fiches', titolo: 'Stampa Fiches', descrizione: "Accesso alla stampa/esportazione PDF delle fiches giornaliere", feedbackMsg: "Password aggiornata. Sarà richiesta alla prossima stampa delle fiches.", onSaved: () => {} },
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

  // password reset via OTP
  const [resetStep, setResetStep] = useState<'idle' | 'sent' | 'done'>('idle');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMsg, setResetMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [otpNewPwd, setOtpNewPwd] = useState('');
  const [otpConfirmPwd, setOtpConfirmPwd] = useState('');
  const [showOtpPwd, setShowOtpPwd] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpMsg, setOtpMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

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

  async function handleSendOtp() {
    setResetLoading(true);
    setResetMsg(null);
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-otp-reset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ email: user?.email }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setResetMsg({ type: 'err', text: data.error ?? 'Errore invio email.' });
      } else {
        setResetStep('sent');
        setResetMsg({ type: 'ok', text: `Codice inviato a ${user?.email}. Controlla la casella di posta.` });
      }
    } catch {
      setResetMsg({ type: 'err', text: 'Errore di rete.' });
    }
    setResetLoading(false);
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setOtpMsg(null);
    if (otpCode.length !== 6) {
      setOtpMsg({ type: 'err', text: 'Il codice deve essere di 6 cifre.' });
      return;
    }
    if (otpNewPwd.length < 6) {
      setOtpMsg({ type: 'err', text: 'La password deve avere almeno 6 caratteri.' });
      return;
    }
    if (otpNewPwd !== otpConfirmPwd) {
      setOtpMsg({ type: 'err', text: 'Le due password non coincidono.' });
      return;
    }
    setOtpLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-otp-reset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ email: user?.email, code: otpCode, newPassword: otpNewPwd }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setOtpMsg({ type: 'err', text: data.error ?? 'Codice non valido o scaduto.' });
      } else {
        setResetStep('done');
      }
    } catch {
      setOtpMsg({ type: 'err', text: 'Errore di rete.' });
    }
    setOtpLoading(false);
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

      {/* Reset password via OTP */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-stone-100">
          <div className="flex items-center gap-2">
            <KeyRound size={16} className="text-stone-500" />
            <h3 className="text-sm font-semibold text-stone-800">Recupero Password via Email</h3>
          </div>
          <p className="text-xs text-stone-400 mt-0.5 ml-6">Ricevi un codice OTP via email per reimpostare la password senza conoscere quella attuale</p>
        </div>

        {resetStep === 'idle' && (
          <div className="px-5 py-4 space-y-3">
            {resetMsg && (
              <div className={`flex items-start gap-2 rounded-xl px-3 py-2.5 ${resetMsg.type === 'ok' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                {resetMsg.type === 'ok' ? <Check size={14} className="text-green-600 flex-shrink-0 mt-0.5" /> : <AlertCircle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />}
                <p className={`text-xs ${resetMsg.type === 'ok' ? 'text-green-700' : 'text-red-700'}`}>{resetMsg.text}</p>
              </div>
            )}
            <button
              onClick={handleSendOtp}
              disabled={resetLoading}
              className="w-full border border-stone-200 hover:border-stone-300 bg-stone-50 hover:bg-stone-100 text-stone-700 font-semibold py-2.5 rounded-xl transition-colors disabled:opacity-50 text-sm"
            >
              {resetLoading ? 'Invio in corso...' : `Invia codice OTP a ${user?.email}`}
            </button>
          </div>
        )}

        {resetStep === 'sent' && (
          <form onSubmit={handleVerifyOtp} className="px-5 py-4 space-y-3">
            {resetMsg && (
              <div className="flex items-start gap-2 rounded-xl px-3 py-2.5 bg-green-50 border border-green-200">
                <Check size={14} className="text-green-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-green-700">{resetMsg.text}</p>
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1.5">Codice OTP (6 cifre)</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={otpCode}
                onChange={e => setOtpCode(e.target.value.replace(/\D/g, ''))}
                placeholder="Es. 482910"
                className="w-full px-4 py-2.5 border border-stone-200 rounded-xl bg-stone-50 text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent text-sm font-mono tracking-widest transition text-center"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1.5">Nuova password</label>
              <div className="relative">
                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                <input
                  type={showOtpPwd ? 'text' : 'password'}
                  value={otpNewPwd}
                  onChange={e => setOtpNewPwd(e.target.value)}
                  placeholder="Minimo 6 caratteri"
                  className="w-full pl-8 pr-10 py-2.5 border border-stone-200 rounded-xl bg-stone-50 text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent text-sm transition"
                />
                <button type="button" onClick={() => setShowOtpPwd(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600">
                  {showOtpPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1.5">Conferma nuova password</label>
              <div className="relative">
                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                <input
                  type={showOtpPwd ? 'text' : 'password'}
                  value={otpConfirmPwd}
                  onChange={e => setOtpConfirmPwd(e.target.value)}
                  placeholder="Ripeti la password"
                  className="w-full pl-8 pr-4 py-2.5 border border-stone-200 rounded-xl bg-stone-50 text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent text-sm transition"
                />
              </div>
            </div>
            {otpMsg && (
              <div className={`flex items-start gap-2 rounded-xl px-3 py-2.5 ${otpMsg.type === 'ok' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                {otpMsg.type === 'ok' ? <Check size={14} className="text-green-600 flex-shrink-0 mt-0.5" /> : <AlertCircle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />}
                <p className={`text-xs ${otpMsg.type === 'ok' ? 'text-green-700' : 'text-red-700'}`}>{otpMsg.text}</p>
              </div>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setResetStep('idle'); setResetMsg(null); setOtpCode(''); setOtpNewPwd(''); setOtpConfirmPwd(''); setOtpMsg(null); }}
                className="flex-1 border border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-600 font-semibold py-2.5 rounded-xl transition-colors text-sm"
              >
                Annulla
              </button>
              <button
                type="submit"
                disabled={otpLoading || otpCode.length !== 6 || !otpNewPwd || !otpConfirmPwd}
                className="flex-2 flex-1 bg-amber-500 hover:bg-amber-600 text-white font-semibold py-2.5 rounded-xl transition-colors disabled:opacity-50 text-sm"
              >
                {otpLoading ? 'Verifica...' : 'Imposta nuova password'}
              </button>
            </div>
            <button
              type="button"
              onClick={handleSendOtp}
              disabled={resetLoading}
              className="w-full text-xs text-stone-400 hover:text-stone-600 transition-colors py-1"
            >
              {resetLoading ? 'Invio...' : 'Non hai ricevuto il codice? Invia di nuovo'}
            </button>
          </form>
        )}

        {resetStep === 'done' && (
          <div className="px-5 py-6 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto">
              <Check size={22} className="text-green-600" />
            </div>
            <p className="text-sm font-semibold text-stone-800">Password aggiornata con successo!</p>
            <p className="text-xs text-stone-400">Usa la nuova password al prossimo accesso.</p>
            <button
              onClick={() => { setResetStep('idle'); setOtpCode(''); setOtpNewPwd(''); setOtpConfirmPwd(''); setResetMsg(null); setOtpMsg(null); }}
              className="text-xs text-amber-600 hover:text-amber-700 font-medium transition-colors"
            >
              Chiudi
            </button>
          </div>
        )}
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
    (async () => {
      const g = await getImpostazione('promemoria_convalida_giorni');
      const o = await getImpostazione('promemoria_convalida_orario');
      if (g) {
        try { setGiorni(JSON.parse(g)); } catch { /* keep default */ }
      }
      if (o) setOrario(o);
      setLoading(false);
    })();
  }, []);

  function toggleGiorno(v: number) {
    setGiorni(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]);
    setFeedback(null);
  }

  async function handleSalva(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const uid = user?.id;
    try {
      await Promise.all([
        setImpostazione('promemoria_convalida_giorni', JSON.stringify(giorni), uid),
        setImpostazione('promemoria_convalida_orario', orario, uid),
      ]);
      setSaving(false);
      setFeedback({ tipo: 'ok', msg: 'Impostazioni salvate. Il promemoria apparirà all\'orario selezionato.' });
    } catch (err) {
      setSaving(false);
      setFeedback({ tipo: 'err', msg: 'Errore durante il salvataggio' });
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
    (async () => {
      const m = await getImpostazione('messaggio_avviso_appuntamento');
      const i = await getImpostazione('avviso_appuntamento_indirizzo');
      setMessaggio(m ?? DEFAULT_MESSAGGIO);
      setIndirizzo(i ?? DEFAULT_INDIRIZZO);
      setLoading(false);
    })();
  }, []);

  async function handleSalva(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    if (!messaggio.trim()) {
      setFeedback({ tipo: 'err', msg: 'Il messaggio non può essere vuoto' });
      return;
    }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const uid = user?.id;
    try {
      await Promise.all([
        setImpostazione('messaggio_avviso_appuntamento', messaggio, uid),
        setImpostazione('avviso_appuntamento_indirizzo', indirizzo, uid),
      ]);
      setSaving(false);
      setFeedback({ tipo: 'ok', msg: 'Messaggio salvato. Sarà usato al prossimo invio avviso.' });
    } catch (err) {
      setSaving(false);
      setFeedback({ tipo: 'err', msg: 'Errore durante il salvataggio' });
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
  const { user } = useAuth();

  // step: 'verify' → inserisci vecchia password | 'change' → nuova password | 'otp-send' | 'otp-verify' | 'done'
  const [step, setStep] = useState<'verify' | 'change' | 'otp-send' | 'otp-verify' | 'done'>('verify');

  // vecchia password
  const [vecchiaPassword, setVecchiaPassword] = useState('');
  const [showVecchia, setShowVecchia] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyErr, setVerifyErr] = useState('');

  // nuova password
  const [nuovaPassword, setNuovaPassword] = useState('');
  const [confermaPassword, setConfermaPassword] = useState('');
  const [showNuova, setShowNuova] = useState(false);
  const [showConferma, setShowConferma] = useState(false);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ tipo: 'ok' | 'err'; msg: string } | null>(null);

  // OTP
  const [otpCode, setOtpCode] = useState('');
  const [otpNuova, setOtpNuova] = useState('');
  const [otpConferma, setOtpConferma] = useState('');
  const [showOtpPwd, setShowOtpPwd] = useState(false);
  const [otpSendLoading, setOtpSendLoading] = useState(false);
  const [otpSendMsg, setOtpSendMsg] = useState<{ tipo: 'ok' | 'err'; msg: string } | null>(null);
  const [otpVerifyLoading, setOtpVerifyLoading] = useState(false);
  const [otpVerifyMsg, setOtpVerifyMsg] = useState<{ tipo: 'ok' | 'err'; msg: string } | null>(null);

  function resetAll() {
    setStep('verify');
    setVecchiaPassword(''); setShowVecchia(false); setVerifyErr(''); setVerifyLoading(false);
    setNuovaPassword(''); setConfermaPassword(''); setShowNuova(false); setShowConferma(false);
    setLoading(false); setFeedback(null);
    setOtpCode(''); setOtpNuova(''); setOtpConferma(''); setShowOtpPwd(false);
    setOtpSendLoading(false); setOtpSendMsg(null);
    setOtpVerifyLoading(false); setOtpVerifyMsg(null);
  }

  function handleToggle() {
    resetAll();
    onToggle();
  }

  async function handleVerifica(e: React.FormEvent) {
    e.preventDefault();
    setVerifyErr('');
    setVerifyLoading(true);
    const { data } = await supabase
      .from('impostazioni')
      .select('valore')
      .eq('chiave', chiave)
      .maybeSingle();
    const stored = data?.valore ?? '1234';
    setVerifyLoading(false);
    if (vecchiaPassword === stored) {
      setStep('change');
    } else {
      setVerifyErr('Password non corretta.');
    }
  }

  async function handleSalva(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    if (!nuovaPassword.trim()) { setFeedback({ tipo: 'err', msg: 'La nuova password non può essere vuota' }); return; }
    if (nuovaPassword !== confermaPassword) { setFeedback({ tipo: 'err', msg: 'Le password non coincidono' }); return; }
    setLoading(true);
    try {
      await setImpostazione(chiave, nuovaPassword, user?.id);
      setLoading(false);
      onSaved();
      setStep('done');
    } catch (error) {
      setLoading(false);
      setFeedback({ tipo: 'err', msg: 'Errore durante il salvataggio' });
    }
  }

  async function handleSendOtp() {
    setOtpSendLoading(true);
    setOtpSendMsg(null);
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-otp-reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
        body: JSON.stringify({ email: user?.email }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setOtpSendMsg({ tipo: 'err', msg: data.error ?? 'Errore invio email.' });
      } else {
        setStep('otp-verify');
        setOtpSendMsg({ tipo: 'ok', msg: `Codice inviato a ${user?.email}. Controlla la casella.` });
      }
    } catch {
      setOtpSendMsg({ tipo: 'err', msg: 'Errore di rete.' });
    }
    setOtpSendLoading(false);
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setOtpVerifyMsg(null);
    if (otpCode.length !== 6) { setOtpVerifyMsg({ tipo: 'err', msg: 'Il codice deve essere di 6 cifre.' }); return; }
    if (!otpNuova.trim()) { setOtpVerifyMsg({ tipo: 'err', msg: 'Inserisci la nuova password.' }); return; }
    if (otpNuova !== otpConferma) { setOtpVerifyMsg({ tipo: 'err', msg: 'Le password non coincidono.' }); return; }
    setOtpVerifyLoading(true);
    // verifica OTP tramite edge function
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-otp-reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
        body: JSON.stringify({ email: user?.email, code: otpCode, newPassword: otpNuova }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setOtpVerifyMsg({ tipo: 'err', msg: data.error ?? 'Codice non valido o scaduto.' });
        setOtpVerifyLoading(false);
        return;
      }
    } catch {
      setOtpVerifyMsg({ tipo: 'err', msg: 'Errore di rete.' });
      setOtpVerifyLoading(false);
      return;
    }
    // OTP valido: salva nuova password di sezione
    try {
      await setImpostazione(chiave, otpNuova, user?.id);
      setOtpVerifyLoading(false);
      onSaved();
      setStep('done');
    } catch (error) {
      setOtpVerifyLoading(false);
      setOtpVerifyMsg({ tipo: 'err', msg: 'Errore durante il salvataggio.' });
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
        <div className="border-t border-stone-100 bg-stone-50/60">

          {/* Step: verifica vecchia password */}
          {step === 'verify' && (
            <form onSubmit={handleVerifica} className="px-5 pb-5 pt-3 space-y-3">
              <p className="text-xs text-stone-500">Inserisci la password attuale per procedere.</p>
              <div>
                <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1.5">Password attuale</label>
                <div className="relative">
                  <input
                    type={showVecchia ? 'text' : 'password'}
                    value={vecchiaPassword}
                    onChange={e => { setVecchiaPassword(e.target.value); setVerifyErr(''); }}
                    placeholder="Password attuale"
                    autoFocus
                    className={`w-full border rounded-lg px-3 py-2 pr-9 text-sm text-stone-800 focus:outline-none focus:ring-2 transition-colors bg-white ${verifyErr ? 'border-red-300 focus:ring-red-200' : 'border-stone-200 focus:ring-amber-300 focus:border-amber-400'}`}
                  />
                  <button type="button" onClick={() => setShowVecchia(s => !s)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600">
                    {showVecchia ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                </div>
                {verifyErr && <p className="text-xs text-red-500 mt-1">{verifyErr}</p>}
              </div>
              <div className="flex items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => { setStep('otp-send'); setVerifyErr(''); }}
                  className="text-xs text-amber-600 hover:text-amber-700 transition-colors underline underline-offset-2"
                >
                  Non ricordi la password? Recupera via email
                </button>
                <div className="flex gap-2">
                  <button type="button" onClick={handleToggle} className="px-3 py-1.5 text-xs font-medium text-stone-500 border border-stone-200 rounded-lg hover:bg-stone-100 transition-colors">
                    Annulla
                  </button>
                  <button
                    type="submit"
                    disabled={verifyLoading || !vecchiaPassword}
                    className="flex items-center gap-1.5 px-4 py-1.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white text-xs font-semibold rounded-lg transition-colors"
                  >
                    {verifyLoading ? 'Verifica...' : 'Continua'}
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Step: nuova password */}
          {step === 'change' && (
            <form onSubmit={handleSalva} className="px-5 pb-5 pt-3 space-y-3">
              <div className="grid grid-cols-2 gap-3">
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
                <button type="button" onClick={() => setStep('verify')} className="px-3 py-1.5 text-xs font-medium text-stone-500 border border-stone-200 rounded-lg hover:bg-stone-100 transition-colors">
                  Indietro
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

          {/* Step: invia OTP */}
          {step === 'otp-send' && (
            <div className="px-5 pb-5 pt-3 space-y-3">
              <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5">
                <KeyRound size={13} className="text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800">Riceverai un codice OTP all'indirizzo <span className="font-semibold">{user?.email}</span>. Inseriscilo per impostare una nuova password.</p>
              </div>
              {otpSendMsg && (
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium ${otpSendMsg.tipo === 'ok' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                  {otpSendMsg.tipo === 'ok' ? <Check size={13} /> : <AlertCircle size={13} />}
                  {otpSendMsg.msg}
                </div>
              )}
              <div className="flex gap-2 justify-end pt-1">
                <button type="button" onClick={() => { setStep('verify'); setOtpSendMsg(null); }} className="px-3 py-1.5 text-xs font-medium text-stone-500 border border-stone-200 rounded-lg hover:bg-stone-100 transition-colors">
                  Annulla
                </button>
                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={otpSendLoading}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white text-xs font-semibold rounded-lg transition-colors"
                >
                  {otpSendLoading ? 'Invio...' : 'Invia codice OTP'}
                </button>
              </div>
            </div>
          )}

          {/* Step: verifica OTP + nuova password */}
          {step === 'otp-verify' && (
            <form onSubmit={handleVerifyOtp} className="px-5 pb-5 pt-3 space-y-3">
              {otpSendMsg && otpSendMsg.tipo === 'ok' && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <Check size={13} />{otpSendMsg.msg}
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1.5">Codice OTP (6 cifre)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={otpCode}
                  onChange={e => { setOtpCode(e.target.value.replace(/\D/g, '')); setOtpVerifyMsg(null); }}
                  placeholder="Es. 482910"
                  autoFocus
                  className="w-full px-4 py-2 border border-stone-200 rounded-lg bg-white text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-300 text-sm font-mono tracking-widest text-center transition"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1.5">Nuova password</label>
                  <div className="relative">
                    <input
                      type={showOtpPwd ? 'text' : 'password'}
                      value={otpNuova}
                      onChange={e => { setOtpNuova(e.target.value); setOtpVerifyMsg(null); }}
                      placeholder="Nuova password"
                      className="w-full border border-stone-200 rounded-lg px-3 py-2 pr-9 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-400 transition-colors bg-white"
                    />
                    <button type="button" onClick={() => setShowOtpPwd(s => !s)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600">
                      {showOtpPwd ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1.5">Conferma</label>
                  <div className="relative">
                    <input
                      type={showOtpPwd ? 'text' : 'password'}
                      value={otpConferma}
                      onChange={e => { setOtpConferma(e.target.value); setOtpVerifyMsg(null); }}
                      placeholder="Ripeti password"
                      className={`w-full border rounded-lg px-3 py-2 pr-4 text-sm text-stone-800 focus:outline-none focus:ring-2 transition-colors bg-white ${otpConferma && otpNuova !== otpConferma ? 'border-red-300 focus:ring-red-200' : 'border-stone-200 focus:ring-amber-300 focus:border-amber-400'}`}
                    />
                  </div>
                  {otpConferma && otpNuova !== otpConferma && (
                    <p className="text-xs text-red-500 mt-1">Non coincidono</p>
                  )}
                </div>
              </div>
              {otpVerifyMsg && (
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium ${otpVerifyMsg.tipo === 'ok' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                  {otpVerifyMsg.tipo === 'ok' ? <Check size={13} /> : <AlertCircle size={13} />}
                  {otpVerifyMsg.msg}
                </div>
              )}
              <div className="flex items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={otpSendLoading}
                  className="text-xs text-stone-400 hover:text-stone-600 transition-colors"
                >
                  {otpSendLoading ? 'Invio...' : 'Non hai ricevuto il codice? Invia di nuovo'}
                </button>
                <div className="flex gap-2">
                  <button type="button" onClick={() => { setStep('otp-send'); setOtpVerifyMsg(null); setOtpCode(''); setOtpNuova(''); setOtpConferma(''); }} className="px-3 py-1.5 text-xs font-medium text-stone-500 border border-stone-200 rounded-lg hover:bg-stone-100 transition-colors">
                    Indietro
                  </button>
                  <button
                    type="submit"
                    disabled={otpVerifyLoading || otpCode.length !== 6 || !otpNuova || !otpConferma}
                    className="flex items-center gap-1.5 px-4 py-1.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white text-xs font-semibold rounded-lg transition-colors"
                  >
                    <Check size={12} />
                    {otpVerifyLoading ? 'Verifica...' : 'Salva'}
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Step: completato */}
          {step === 'done' && (
            <div className="px-5 py-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                  <Check size={12} className="text-emerald-600" />
                </div>
                <p className="text-xs font-medium text-emerald-700">{feedbackMsg}</p>
              </div>
              <button type="button" onClick={handleToggle} className="text-xs text-stone-400 hover:text-stone-600 transition-colors">
                Chiudi
              </button>
            </div>
          )}

        </div>
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

// ─── Pagina Keep-alive ────────────────────────────────────────────────────────

const KEEPALIVE_INTERVAL_DAYS = 2;

const LS_NOTIF_ENABLED = 'keepalive_notif_enabled';
const LS_NOTIF_DAYS = 'keepalive_notif_days';

function PaginaKeepAlive({ onBack }: { onBack: () => void }) {
  const [lastPing, setLastPing] = useState<string | null>(null);
  const [lastPingTipo, setLastPingTipo] = useState<'automatico' | 'manuale' | null>(null);
  const [pinging, setPinging] = useState(false);
  const [pingOk, setPingOk] = useState<boolean | null>(null);
  const [pingError, setPingError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notifEnabled, setNotifEnabled] = useState(() => localStorage.getItem(LS_NOTIF_ENABLED) !== 'false');
  const [notifDays, setNotifDays] = useState<number>(() => {
    const v = parseInt(localStorage.getItem(LS_NOTIF_DAYS) ?? '7', 10);
    return isNaN(v) || v < 1 ? 7 : v;
  });

  function saveNotifEnabled(val: boolean) {
    setNotifEnabled(val);
    localStorage.setItem(LS_NOTIF_ENABLED, val ? 'true' : 'false');
  }

  function saveNotifDays(val: number) {
    setNotifDays(val);
    localStorage.setItem(LS_NOTIF_DAYS, String(val));
  }

  useEffect(() => {
    async function load() {
      const pingVal = await getImpostazione('keep_alive_last_ping');
      const tipoVal = await getImpostazione('keep_alive_last_ping_tipo');
      setLastPing(pingVal ?? null);
      setLastPingTipo((tipoVal as 'automatico' | 'manuale') ?? null);
      setLoading(false);
    }
    load();
  }, []);

  async function eseguiPing() {
    setPinging(true);
    setPingOk(null);
    setPingError(null);
    try {
      const sbUrl = localStorage.getItem('sb_custom_url') || import.meta.env.VITE_SUPABASE_URL;
      const sbKey = localStorage.getItem('sb_custom_anon_key') || import.meta.env.VITE_SUPABASE_ANON_KEY;
      const res = await fetch(`${sbUrl}/functions/v1/keep-alive?force=true`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${sbKey}`, apikey: sbKey },
      });
      const json = await res.json();
      if (json.ok) {
        setLastPing(json.ts);
        setLastPingTipo('manuale');
        setPingOk(true);
      } else {
        setPingError(json.error ?? 'risposta non valida');
      }
    } catch {
      setPingError('Impossibile raggiungere il server. Controlla la connessione.');
    }
    setPinging(false);
  }

  function formatTs(ts: string) {
    try {
      return new Date(ts).toLocaleString('it-IT', {
        day: '2-digit', month: 'long', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
    } catch {
      return ts;
    }
  }

  function giorniAlProssimoPing(ts: string | null) {
    if (!ts) return null;
    const last = new Date(ts).getTime();
    const now = Date.now();
    const elapsed = (now - last) / (1000 * 60 * 60 * 24);
    const remaining = Math.max(0, KEEPALIVE_INTERVAL_DAYS - elapsed);
    return Math.round(remaining);
  }

  const giorniRimanenti = giorniAlProssimoPing(lastPing);

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 hover:bg-stone-100 rounded-xl transition-colors text-stone-500 hover:text-stone-800">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-stone-800">Keep-alive automatico</h2>
          <p className="text-sm text-stone-500 mt-0.5">Mantiene il database Supabase sempre attivo</p>
        </div>
      </div>

      {/* Stato */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 flex items-start gap-4">
        <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
          <Activity size={18} className="text-emerald-600" />
        </div>
        <div className="flex-1 space-y-1">
          <p className="text-sm font-bold text-emerald-900">Sistema attivo</p>
          <p className="text-xs text-emerald-700 leading-relaxed">
            Un ping automatico visita Supabase ogni {KEEPALIVE_INTERVAL_DAYS} giorni, impedendo la pausa del progetto
            (che scatterebbe dopo 7 giorni di inattivit&agrave;).
          </p>
        </div>
      </div>

      {/* Ultimo ping */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5 space-y-4">
        <h3 className="text-sm font-bold text-stone-700">Ultimo ping a Supabase</h3>

        {loading ? (
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-stone-400">Caricamento...</span>
          </div>
        ) : lastPing ? (
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 bg-stone-50 rounded-xl">
              <Clock size={16} className="text-stone-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-stone-800">{formatTs(lastPing)}</p>
                  {lastPingTipo && (
                    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      lastPingTipo === 'automatico'
                        ? 'bg-sky-100 text-sky-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}>
                      {lastPingTipo === 'automatico' ? (
                        <><RefreshCw size={9} /> automatico</>
                      ) : (
                        <><Wifi size={9} /> manuale</>
                      )}
                    </span>
                  )}
                </div>
                <p className="text-xs text-stone-400 mt-0.5">
                  {giorniRimanenti !== null && giorniRimanenti > 0
                    ? `Prossimo ping automatico tra circa ${giorniRimanenti} giorn${giorniRimanenti === 1 ? 'o' : 'i'}`
                    : 'Il prossimo ping automatico scatter\u00e0 presto'}
                </p>
              </div>
            </div>

            {/* Barra progresso */}
            {giorniRimanenti !== null && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-stone-400">
                  <span>Intervallo ping ({KEEPALIVE_INTERVAL_DAYS} giorni)</span>
                  <span>{Math.min(KEEPALIVE_INTERVAL_DAYS, KEEPALIVE_INTERVAL_DAYS - (giorniRimanenti ?? KEEPALIVE_INTERVAL_DAYS))} / {KEEPALIVE_INTERVAL_DAYS} giorni trascorsi</span>
                </div>
                <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-400 rounded-full transition-all"
                    style={{ width: `${Math.min(100, ((KEEPALIVE_INTERVAL_DAYS - (giorniRimanenti ?? KEEPALIVE_INTERVAL_DAYS)) / KEEPALIVE_INTERVAL_DAYS) * 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
            <AlertTriangle size={15} className="text-amber-500 flex-shrink-0" />
            <p className="text-xs text-amber-700">Nessun ping registrato ancora. Esegui il primo ping manuale qui sotto.</p>
          </div>
        )}

        {pingError && (
          <div className="flex items-start gap-2 rounded-xl px-4 py-3 border bg-red-50 border-red-200">
            <AlertCircle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{pingError}</p>
          </div>
        )}

        <button
          onClick={eseguiPing}
          disabled={pinging}
          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-semibold text-sm rounded-xl transition-colors"
        >
          {pingOk && !pinging
            ? <><Check size={15} /> Ping eseguito</>
            : <><Wifi size={15} className={pinging ? 'animate-pulse' : ''} />{pinging ? 'Ping in corso...' : 'Esegui ping manuale ora'}</>
          }
        </button>
      </div>

      {/* Impostazioni avviso riepilogo ping */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5 space-y-4">
        <div>
          <h3 className="text-sm font-bold text-stone-700">Avviso riepilogo ping</h3>
          <p className="text-xs text-stone-400 mt-0.5">
            Mostra un banner silenzioso con l'elenco dei ping eseguiti nel periodo
          </p>
        </div>

        {/* Toggle attiva/disattiva */}
        <div className="flex items-center justify-between py-1">
          <div>
            <p className="text-sm font-medium text-stone-700">Avviso attivo</p>
            <p className="text-xs text-stone-400 mt-0.5">Se disattivato, nessun banner verrà mostrato</p>
          </div>
          <button
            onClick={() => saveNotifEnabled(!notifEnabled)}
            className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${notifEnabled ? 'bg-emerald-500' : 'bg-stone-300'}`}
          >
            <span
              className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${notifEnabled ? 'translate-x-5' : 'translate-x-0.5'}`}
            />
          </button>
        </div>

        {/* Frequenza */}
        {notifEnabled && (
          <div className="space-y-2 pt-1 border-t border-stone-100">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-stone-700">Frequenza avviso</p>
              <span className="text-sm font-bold text-emerald-700">ogni {notifDays} {notifDays === 1 ? 'giorno' : 'giorni'}</span>
            </div>
            <input
              type="range"
              min={1}
              max={14}
              step={1}
              value={notifDays}
              onChange={e => saveNotifDays(Number(e.target.value))}
              className="w-full accent-emerald-500"
            />
            <div className="flex justify-between text-[10px] text-stone-400">
              <span>1 giorno</span>
              <span>7 giorni</span>
              <span>14 giorni</span>
            </div>
            <p className="text-xs text-stone-400">
              Il banner compare al massimo una volta ogni {notifDays} {notifDays === 1 ? 'giorno' : 'giorni'},
              mostrando i ping eseguiti in quel periodo.
            </p>
          </div>
        )}
      </div>

      {/* Info tecnica */}
      <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 space-y-2">
        <p className="text-xs font-bold text-stone-700">Come funziona</p>
        <ul className="space-y-1.5">
          <li className="text-xs text-stone-500 leading-relaxed">
            &bull; Il cron job del database chiama automaticamente la funzione ogni {KEEPALIVE_INTERVAL_DAYS} giorni alle 09:00 UTC
          </li>
          <li className="text-xs text-stone-500 leading-relaxed">
            &bull; Ogni ping registra il timestamp e se &egrave; stato <span className="font-medium text-sky-600">automatico</span> o <span className="font-medium text-amber-600">manuale</span>
          </li>
          <li className="text-xs text-stone-500 leading-relaxed">
            &bull; Supabase mette in pausa i progetti dopo 7 giorni senza attivit&agrave; — il ping ogni {KEEPALIVE_INTERVAL_DAYS} giorni previene questo con ampio margine
          </li>
          <li className="text-xs text-stone-500 leading-relaxed">
            &bull; Puoi eseguire un ping manuale in qualsiasi momento con il pulsante qui sopra
          </li>
        </ul>
      </div>
    </div>
  );
}

// ─── Cartelle di salvataggio ──────────────────────────────────────────────────

const SAVE_PATH_LABELS: Record<string, { label: string; desc: string }> = {
  backup:        { label: 'Backup',         desc: 'File JSON backup del database' },
  fiches:        { label: 'Fiches',         desc: 'PDF fiches giornaliere (auto e manuale)' },
  clienti:       { label: 'Clienti',        desc: 'CSV e PDF esportazione clienti' },
  magazzino:     { label: 'Magazzino',      desc: 'CSV, PDF e HTML inventario magazzino' },
  rivendita:     { label: 'Rivendita',      desc: 'PDF report vendite prodotti' },
  statistiche:   { label: 'Statistiche',    desc: 'PDF report statistiche e schede' },
  qrcode:        { label: 'QR Code',        desc: 'PDF QR code registrazione clienti' },
  comunicazioni: { label: 'Comunicazioni',  desc: 'HTML guida e materiali comunicazione' },
  fiches_nero: { label: 'Fiches (contanti non registrati)', desc: 'Cartella separata per PDF fiches pagate in contanti non dichiarati' },
};

function PaginaCartelleSalvataggio({ onBack }: { onBack: () => void }) {
  const isElectronApp = !!(window as any).electronAPI;
  const [paths, setPaths] = useState<Record<string, string>>({});
  const [fichesSched, setFichesSched] = useState({ enabled: false, time: '08:00' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (isElectronApp) {
        const [p, s] = await Promise.all([
          (window as any).electronAPI.getFilePaths(),
          (window as any).electronAPI.getFichesSched(),
        ]);
        setPaths(p || {});
        if (s) setFichesSched({ enabled: s.enabled, time: s.time });
      }
      setLoading(false);
    })();
  }, [isElectronApp]);

  async function pickFolder(type: string) {
    if (!isElectronApp) return;
    const label = SAVE_PATH_LABELS[type]?.label ?? type;
    const res = await (window as any).electronAPI.pickFolder(`Scegli cartella per: ${label}`);
    if (res.ok && res.folder) {
      const newPaths = { ...paths, [type]: res.folder };
      setPaths(newPaths);
      await (window as any).electronAPI.setFilePaths(newPaths);
      showFlash('Cartella aggiornata');
    }
  }

  async function saveFichesSched() {
    if (!isElectronApp) return;
    setSaving(true);
    await (window as any).electronAPI.setFichesSched({ ...fichesSched, last: '' });
    setSaving(false);
    showFlash('Impostazioni salvate');
  }

  function showFlash(msg: string) {
    setFlash(msg);
    setTimeout(() => setFlash(null), 3000);
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-xl hover:bg-stone-100 transition-colors text-stone-500 hover:text-stone-700">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h2 className="text-xl font-bold text-stone-800">Cartelle di salvataggio</h2>
          <p className="text-sm text-stone-500 mt-0.5">Percorsi dove vengono salvati i file scaricabili</p>
        </div>
      </div>

      {!isElectronApp && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-700">Nella versione web le cartelle non sono selezionabili — i file vengono scaricati direttamente dal browser. Nell'app installata (Electron) potrai configurare le cartelle di destinazione.</p>
        </div>
      )}

      {!loading && (
        <>
          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-stone-100">
              <h3 className="font-semibold text-stone-800 text-sm">Cartelle per tipo di file</h3>
              <p className="text-xs text-stone-400 mt-0.5">Clicca "Scegli" per selezionare la cartella di destinazione. Se non configurata, viene usato il download standard del browser.</p>
            </div>
            <div className="divide-y divide-stone-100">
              {Object.entries(SAVE_PATH_LABELS).map(([type, info]) => (
                <div key={type} className="flex items-center gap-4 px-6 py-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-stone-800">{info.label}</p>
                    <p className="text-xs text-stone-400 mt-0.5">{info.desc}</p>
                    {paths[type] ? (
                      <p className="text-xs text-emerald-600 font-mono mt-1 truncate" title={paths[type]}>{paths[type]}</p>
                    ) : (
                      <p className="text-xs text-stone-300 italic mt-1">Download standard — nessuna cartella configurata</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {paths[type] && (
                      <button onClick={() => (window as any).electronAPI.showFolder(paths[type])} title="Apri cartella" className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-400 hover:text-stone-600 transition-colors">
                        <FolderOpen size={14} />
                      </button>
                    )}
                    <button onClick={() => pickFolder(type)} className="px-3 py-1.5 text-xs font-semibold bg-stone-100 hover:bg-amber-100 text-stone-600 hover:text-amber-700 rounded-lg transition-colors">
                      Scegli
                    </button>
                    {paths[type] && (
                      <button onClick={async () => { const np = { ...paths, [type]: '' }; setPaths(np); await (window as any).electronAPI.setFilePaths(np); }} title="Rimuovi" className="p-1.5 rounded-lg hover:bg-red-50 text-stone-300 hover:text-red-500 transition-colors">
                        <X size={13} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-stone-100">
              <h3 className="font-semibold text-stone-800 text-sm">Salvataggio automatico fiches</h3>
              <p className="text-xs text-stone-400 mt-0.5">Ogni giorno all'orario impostato salva automaticamente un PDF con le fiches del giorno precedente nella cartella Fiches</p>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-stone-800">Attivo</p>
                  <p className="text-xs text-stone-400 mt-0.5">L'app deve essere aperta o minimizzata nel tray di sistema</p>
                </div>
                <button onClick={() => setFichesSched(s => ({ ...s, enabled: !s.enabled }))} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${fichesSched.enabled ? 'bg-amber-500' : 'bg-stone-200'}`}>
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${fichesSched.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <label className="text-xs font-semibold text-stone-600 block mb-1.5">Orario salvataggio</label>
                  <input type="time" value={fichesSched.time} onChange={e => setFichesSched(s => ({ ...s, time: e.target.value }))} className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-300" />
                </div>
                <div className="flex-1 pt-5">
                  <p className="text-xs text-stone-400">Il PDF viene generato ogni mattina a quest'ora con le fiches del giorno precedente.</p>
                </div>
              </div>
              {!paths.fiches && fichesSched.enabled && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center gap-2 text-xs text-amber-700">
                  <AlertTriangle size={13} className="flex-shrink-0" />
                  Configura prima la cartella "Fiches" qui sopra affinché il salvataggio automatico funzioni.
                </div>
              )}
              {fichesSched.enabled && paths.fiches && !paths.fiches_nero && (
                <div className="bg-stone-50 border border-stone-200 rounded-lg p-3 flex items-center gap-2 text-xs text-stone-600">
                  <AlertTriangle size={13} className="flex-shrink-0 text-stone-400" />
                  Opzionale: configura "Fiches (contanti non registrati)" per salvare separatamente le fiches in contanti non dichiarati.
                </div>
              )}
              <button onClick={saveFichesSched} disabled={saving} className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-semibold text-sm rounded-xl transition-colors">
                {saving ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
                {saving ? 'Salvataggio...' : 'Salva impostazioni'}
              </button>
              {flash && <p className="text-sm text-emerald-600 font-medium flex items-center gap-1.5"><Check size={14} /> {flash}</p>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
