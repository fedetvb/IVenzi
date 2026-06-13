import { useState, useEffect, useRef, useCallback } from 'react';
import { Settings, Lock, Eye, EyeOff, Check, AlertCircle, ChevronRight, ArrowLeft, KeyRound, Bell, BellOff, MessageCircle, MapPin, Tag, Plus, Trash2, Star, CreditCard as Edit3, X, Send, MessageSquare, ChevronDown, QrCode, ExternalLink, Download, DatabaseBackup, UploadCloud, AlertTriangle, Cloud, RefreshCw, Clock, CalendarDays, FolderOpen, UserCog, Mail, Activity, Wifi, Scissors, Droplets, Wind, Sparkles, Palette, ImagePlus, RotateCcw, Globe, Copy, CalendarClock, Volume2, Volume1, VolumeX, Play, Gift, HelpCircle, Megaphone, Smartphone, Share2, Link, Search } from 'lucide-react';
import { SFONDO_META, COMPLEANNO_DEFAULT_TESTO } from '../components/AnnuncioModal';
import { BENVENUTO_DEFAULT, type BenvenutoConfig } from '../components/BenvenutoModal';
import { DEFAULT_WA_GP_SALONE, DEFAULT_WA_GP_CLIENTE, DEFAULT_WA_CS_DONA } from '../lib/waUtils';
import { CombIcon, RazorIcon, NailsIcon, WomanFaceIcon } from '../lib/salonIcons';
import { getTheme, saveTheme, getLogoCacheB64, saveLogoCacheB64, dispatchThemeChange, SIDEBAR_PRESETS, ACCENT_PRESETS, ICON_PRESETS, THEME_DEFAULTS } from '../lib/theme';
import { supabase, localDateStr } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { restoreBackup, exportBackup, isElectron as isElectronEnv, dbSelect, dbInsert, dbUpdate, dbDelete, getImpostazione, setImpostazione, compressImage } from '../lib/localDb';
import { saveFile, browserDownload } from '../lib/fileSaver';
import { fetchFichesForDate, generateFichesPdf, generateFichesXls } from '../lib/fichesPdfGenerator';
import { generateCartaPremiumStampaPdf } from '../lib/cartePremiumPdfGenerator';
import { generateCartaScontoPdfStampa } from '../lib/carteScontoPdfGenerator';
import { generateCartaInfinityPdfStampa } from '../lib/carteInfinityPdfGenerator';
import StatisticheGate from '../components/StatisticheGate';

type SubPage = null | 'password' | 'promemoria' | 'messaggio_avviso' | 'template_carta' | 'template_comunicazioni' | 'qrcode' | 'backup' | 'connessione' | 'account' | 'keepalive' | 'cartelle' | 'tema' | 'prenotazioni_online' | 'notifiche_push' | 'messaggi_clienti' | 'dati_azienda' | 'avvisi_banner' | 'canali_social' | 'orari_salone' | 'scarica_documenti' | 'wa_carte' | 'benvenuto';

export default function Impostazioni({ onTestReminder, onTestInForse, onTestPromApp, onTestCompleanno }: { onTestReminder?: () => void; onTestInForse?: () => void; onTestPromApp?: () => void; onTestCompleanno?: () => void }) {
  const { user } = useAuth();
  const [sub, setSub] = useState<SubPage>(null);
  const [msgOpen, setMsgOpen] = useState(false);
  const [whatsappDisabilitato, setWhatsappDisabilitato] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

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
  if (sub === 'avvisi_banner') return <PaginaAvvisiBanner onBack={() => setSub(null)} onTestReminder={onTestReminder} onTestInForse={onTestInForse} onTestPromApp={onTestPromApp} onTestCompleanno={onTestCompleanno} />;
  if (sub === 'promemoria') return <PaginaPromemoria onBack={() => setSub(null)} onTestReminder={onTestReminder} />;
  if (sub === 'messaggio_avviso') return <PaginaMessaggioAvviso onBack={() => setSub(null)} />;
  if (sub === 'template_carta') return <PaginaTemplateCarta onBack={() => setSub(null)} />;
  if (sub === 'template_comunicazioni') return <PaginaTemplateComunicazioni onBack={() => setSub(null)} />;
  if (sub === 'qrcode') return <PaginaQRCode onBack={() => setSub(null)} />;
  if (sub === 'backup') return <PaginaBackup onBack={() => setSub(null)} />;
  if (sub === 'connessione') return <PaginaConnessione onBack={() => setSub(null)} />;
  if (sub === 'cartelle') return <PaginaCartelleSalvataggio onBack={() => setSub(null)} />;
  if (sub === 'keepalive') return <PaginaKeepAlive onBack={() => setSub(null)} />;
  if (sub === 'notifiche_push') return <PaginaNotifichePush onBack={() => setSub(null)} />;
  if (sub === 'prenotazioni_online') return <PaginaPrenotazioniOnline onBack={() => setSub(null)} />;
  if (sub === 'messaggi_clienti') return <PaginaMessaggiClienti onBack={() => setSub(null)} userId={user?.id} />;
  if (sub === 'dati_azienda') return <PaginaDatiAzienda onBack={() => setSub(null)} />;
  if (sub === 'canali_social') return <PaginaCanaleSocial onBack={() => setSub(null)} />;
  if (sub === 'orari_salone') return <PaginaOrariSalone onBack={() => setSub(null)} />;
  if (sub === 'wa_carte') return <PaginaWACarte onBack={() => setSub(null)} />;
  if (sub === 'benvenuto') return <PaginaBenvenuto onBack={() => setSub(null)} />;
  if (sub === 'scarica_documenti') return (
    <StatisticheGate isActive={sub === 'scarica_documenti'} chiave="password_documenti" sezione="scarica file e documenti" sessionKey="documenti_unlocked">
      <PaginaScaricaDocumenti onBack={() => setSub(null)} />
    </StatisticheGate>
  );

  const sq = searchQuery.trim().toLowerCase();
  function show(...texts: string[]) {
    if (!sq) return true;
    return texts.some(t => t.toLowerCase().includes(sq));
  }
  const msgGroupVisible = show(
    'Messaggi e Comunicazioni', 'Avvisi appuntamento, template carta sconto e messaggi comunicazioni',
    'Messaggio Avviso Appuntamento', 'Personalizza il testo WhatsApp per il promemoria appuntamento',
    'Messaggi WhatsApp automatici', 'Pulsante avviso clienti',
    'Template Messaggi Carta Sconto', 'Modelli per carte sconto',
    'Template Messaggi Comunicazioni', 'Messaggi predefiniti per comunicazioni',
    'Messaggi WA Carte da Donare', 'Gift Pass Carta Sconto donazione mappa posizione',
  );
  const anyVisible = show('Benvenuto Nuove Clienti', 'Modifica il testo del messaggio di benvenuto per le nuove clienti') ||
    show('Account e Credenziali', 'Modifica email e password') ||
    show('Avvisi e Banner', 'Orari e attivazione di tutti gli avvisi') ||
    show('Backup e Ripristino', 'Esporta tutti i dati') ||
    show('Canali Social', 'Instagram Facebook TikTok YouTube') ||
    show('Cartelle di salvataggio', 'Configura le cartelle di destinazione') ||
    show('Connessione Cloud', 'Modifica le chiavi API') ||
    show('Dati Azienda', 'Ragione sociale indirizzo P.IVA telefono') ||
    show('Keep-alive automatico', 'ping automatico database Supabase') ||
    show('Messaggi clienti', 'Password eliminazione messaggi') ||
    msgGroupVisible ||
    show('Notifiche Push', 'Ricevi notifiche sul telefono') ||
    show('Orari Salone', 'Giorni di apertura e orari di lavoro') ||
    show('Password', 'Gestisci le password di accesso') ||
    show('Prenotazioni Online', 'Attiva disattiva pagina pubblica prenotazione') ||
    show('Promemoria Convalida Fiches', 'Configura giorni e orario promemoria') ||
    show('QR Code Registrazione Clienti', 'Stampa il QR code nuove clienti') ||
    show('Tema e Personalizzazione', 'Colori sidebar icona logo') ||
    show('Scarica File e Documenti', 'Esporta e scarica file PDF CSV backup dal gestionale');

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-stone-800">Impostazioni</h2>
        <p className="text-xs text-stone-400 mt-1 tracking-wide uppercase font-medium">In ordine alfabetico</p>
      </div>

      {/* Barra di ricerca */}
      <div className="relative">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Cerca nelle impostazioni..."
          className="w-full pl-10 pr-10 py-3 bg-white border border-stone-200 rounded-2xl text-sm text-stone-700 placeholder-stone-300 focus:outline-none focus:ring-2 focus:ring-stone-200 focus:border-stone-300 transition-colors shadow-sm"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg hover:bg-stone-100 transition-colors text-stone-400"
          >
            <X size={14} />
          </button>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden divide-y divide-stone-100">
      {!anyVisible && (
        <div className="px-6 py-10 text-center text-stone-400">
          <Search size={24} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">Nessun risultato per "<span className="font-medium text-stone-500">{searchQuery}</span>"</p>
        </div>
      )}
        {/* Account e Credenziali */}
        <button
          onClick={() => setSub('account')}
          style={show('Account e Credenziali', 'Modifica email e password di accesso al gestionale') ? {} : {display:'none'}}
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

        {/* Benvenuto Nuove Clienti */}
        <button
          onClick={() => setSub('benvenuto')}
          style={show('Benvenuto Nuove Clienti', 'Modifica il testo del messaggio di benvenuto per le nuove clienti') ? {} : {display:'none'}}
          className="w-full flex items-center gap-4 px-6 py-4 hover:bg-stone-50 transition-colors group"
        >
          <div className="w-10 h-10 rounded-xl bg-stone-100 group-hover:bg-rose-100 flex items-center justify-center flex-shrink-0 transition-colors">
            <Sparkles size={18} className="text-stone-500 group-hover:text-rose-500 transition-colors" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-semibold text-stone-800">Benvenuto Nuove Clienti</p>
            <p className="text-xs text-stone-400 mt-0.5">Modifica il testo del messaggio di benvenuto per le nuove clienti</p>
          </div>
          <ChevronRight size={16} className="text-stone-400 group-hover:text-stone-600 transition-colors" />
        </button>

        {/* Avvisi e Banner */}
        <button
          onClick={() => setSub('avvisi_banner')}
          style={show('Avvisi e Banner', 'Orari e attivazione di tutti gli avvisi, banner e notifiche del gestionale') ? {} : {display:'none'}}
          className="w-full flex items-center gap-4 px-6 py-4 hover:bg-stone-50 transition-colors group"
        >
          <div className="w-10 h-10 rounded-xl bg-stone-100 group-hover:bg-teal-100 flex items-center justify-center flex-shrink-0 transition-colors">
            <Megaphone size={18} className="text-stone-500 group-hover:text-teal-600 transition-colors" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-semibold text-stone-800">Avvisi e Banner</p>
            <p className="text-xs text-stone-400 mt-0.5">Orari e attivazione di tutti gli avvisi, banner e notifiche del gestionale</p>
          </div>
          <ChevronRight size={16} className="text-stone-400 group-hover:text-stone-600 transition-colors" />
        </button>

        {/* Backup e Ripristino */}
        <button
          onClick={() => setSub('backup')}
          style={show('Backup e Ripristino', 'Esporta tutti i dati in un file o ripristina da un backup precedente') ? {} : {display:'none'}}
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

        {/* Canali Social */}
        <button
          onClick={() => setSub('canali_social')}
          style={show('Canali Social', 'Instagram, Facebook, TikTok, YouTube e altri canali del salone') ? {} : {display:'none'}}
          className="w-full flex items-center gap-4 px-6 py-4 hover:bg-stone-50 transition-colors group"
        >
          <div className="w-10 h-10 rounded-xl bg-stone-100 group-hover:bg-pink-100 flex items-center justify-center flex-shrink-0 transition-colors">
            <Share2 size={18} className="text-stone-500 group-hover:text-pink-500 transition-colors" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-semibold text-stone-800">Canali Social</p>
            <p className="text-xs text-stone-400 mt-0.5">Instagram, Facebook, TikTok, YouTube e altri canali del salone</p>
          </div>
          <ChevronRight size={16} className="text-stone-400 group-hover:text-stone-600 transition-colors" />
        </button>

        {/* Cartelle di salvataggio */}
        <button
          onClick={() => setSub('cartelle')}
          style={show('Cartelle di salvataggio', 'Configura le cartelle di destinazione per file scaricabili e salvataggio automatico') ? {} : {display:'none'}}
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

        {/* Connessione Cloud */}
        <button
          onClick={() => setSub('connessione')}
          style={show('Connessione Cloud', 'Modifica le chiavi API per connettere il gestionale al database') ? {} : {display:'none'}}
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

        {/* Dati Azienda */}
        <button
          onClick={() => setSub('dati_azienda')}
          style={show('Dati Azienda', 'Ragione sociale, indirizzo, P.IVA, telefono, Google Maps e sito web') ? {} : {display:'none'}}
          className="w-full flex items-center gap-4 px-6 py-4 hover:bg-stone-50 transition-colors group"
        >
          <div className="w-10 h-10 rounded-xl bg-stone-100 group-hover:bg-teal-100 flex items-center justify-center flex-shrink-0 transition-colors">
            <MapPin size={18} className="text-stone-500 group-hover:text-teal-600 transition-colors" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-semibold text-stone-800">Dati Azienda</p>
            <p className="text-xs text-stone-400 mt-0.5">Ragione sociale, indirizzo, P.IVA, telefono, Google Maps e sito web</p>
          </div>
          <ChevronRight size={16} className="text-stone-400 group-hover:text-stone-600 transition-colors" />
        </button>

        {/* Keep-alive automatico */}
        <button
          onClick={() => setSub('keepalive')}
          style={show('Keep-alive automatico', 'Stato del ping automatico che mantiene attivo il database Supabase') ? {} : {display:'none'}}
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

        {/* Messaggi clienti */}
        <button
          onClick={() => setSub('messaggi_clienti')}
          style={show('Messaggi clienti', 'Password eliminazione messaggi e cancellazione globale dello schedario') ? {} : {display:'none'}}
          className="w-full flex items-center gap-4 px-6 py-4 hover:bg-stone-50 transition-colors group"
        >
          <div className="w-10 h-10 rounded-xl bg-stone-100 group-hover:bg-sky-100 flex items-center justify-center flex-shrink-0 transition-colors">
            <MessageCircle size={18} className="text-stone-500 group-hover:text-sky-600 transition-colors" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-semibold text-stone-800">Messaggi clienti del gestionale</p>
            <p className="text-xs text-stone-400 mt-0.5">Password eliminazione messaggi e cancellazione globale dello schedario</p>
          </div>
          <ChevronRight size={16} className="text-stone-400 group-hover:text-stone-600 transition-colors" />
        </button>

        {/* Messaggi e Comunicazioni */}
        {msgGroupVisible && (
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
            <ChevronDown size={16} className={`text-stone-400 transition-transform duration-200 ${msgOpen || sq ? 'rotate-180' : ''}`} />
          </button>

          {(msgOpen || !!sq) && (
            <div className="border-t border-stone-100 divide-y divide-stone-50 bg-stone-50/60">
              {/* Messaggio Avviso Appuntamento */}
              <button
                onClick={() => setSub('messaggio_avviso')}
                style={show('Messaggio Avviso Appuntamento', 'Personalizza il testo WhatsApp per il promemoria appuntamento') ? {} : {display:'none'}}
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

              {/* Messaggi WhatsApp automatici */}
              <div
                style={show('Messaggi WhatsApp automatici', 'Pulsante avviso clienti') ? {} : {display:'none'}}
                className="w-full flex items-center gap-4 pl-10 pr-6 py-3.5"
              >
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

              {/* Template Messaggi Carta Sconto */}
              <button
                onClick={() => setSub('template_carta')}
                style={show('Template Messaggi Carta Sconto', 'Modelli per carte sconto Natale compleanno regalo') ? {} : {display:'none'}}
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

              {/* Template Messaggi Comunicazioni */}
              <button
                onClick={() => setSub('template_comunicazioni')}
                style={show('Template Messaggi Comunicazioni', 'Messaggi predefiniti per comunicazioni compleanno feste promo') ? {} : {display:'none'}}
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

              {/* Messaggi WA Carte da Donare */}
              <button
                onClick={() => setSub('wa_carte')}
                style={show('Messaggi WA Carte da Donare', 'Gift Pass Carta Sconto donazione mappa posizione') ? {} : {display:'none'}}
                className="w-full flex items-center gap-4 pl-10 pr-6 py-3.5 hover:bg-stone-100/60 transition-colors group"
              >
                <div className="w-8 h-8 rounded-lg bg-white border border-stone-200 group-hover:border-emerald-300 flex items-center justify-center flex-shrink-0 transition-colors">
                  <Gift size={15} className="text-stone-400 group-hover:text-emerald-600 transition-colors" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium text-stone-700">Messaggi WA Carte da Donare</p>
                  <p className="text-xs text-stone-400 mt-0.5">Testi WhatsApp per Gift Pass e Carta Sconto monouso, con toggle mappa</p>
                </div>
                <ChevronRight size={14} className="text-stone-300 group-hover:text-stone-500 transition-colors" />
              </button>
            </div>
          )}
        </div>
        )}

        {/* Notifiche Push */}
        <button
          onClick={() => setSub('notifiche_push')}
          style={show('Notifiche Push', 'Ricevi notifiche sul telefono quando arriva una prenotazione online') ? {} : {display:'none'}}
          className="w-full flex items-center gap-4 px-6 py-4 hover:bg-stone-50 transition-colors group"
        >
          <div className="w-10 h-10 rounded-xl bg-stone-100 group-hover:bg-blue-100 flex items-center justify-center flex-shrink-0 transition-colors">
            <Bell size={18} className="text-stone-500 group-hover:text-blue-600 transition-colors" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-semibold text-stone-800">Notifiche Push</p>
            <p className="text-xs text-stone-400 mt-0.5">Ricevi notifiche sul telefono quando arriva una prenotazione online</p>
          </div>
          <ChevronRight size={16} className="text-stone-400 group-hover:text-stone-600 transition-colors" />
        </button>

        {/* Orari Salone */}
        <button
          onClick={() => setSub('orari_salone')}
          style={show('Orari Salone', 'Giorni di apertura e orari di lavoro del salone') ? {} : {display:'none'}}
          className="w-full flex items-center gap-4 px-6 py-4 hover:bg-stone-50 transition-colors group"
        >
          <div className="w-10 h-10 rounded-xl bg-stone-100 group-hover:bg-amber-100 flex items-center justify-center flex-shrink-0 transition-colors">
            <Clock size={18} className="text-stone-500 group-hover:text-amber-600 transition-colors" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-semibold text-stone-800">Orari Salone</p>
            <p className="text-xs text-stone-400 mt-0.5">Giorni di apertura e orari di lavoro del salone</p>
          </div>
          <ChevronRight size={16} className="text-stone-400 group-hover:text-stone-600 transition-colors" />
        </button>

        {/* Password */}
        <button
          onClick={() => setSub('password')}
          style={show('Password', 'Gestisci le password di accesso alle sezioni protette') ? {} : {display:'none'}}
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

        {/* Prenotazioni Online */}
        <button
          onClick={() => setSub('prenotazioni_online')}
          style={show('Prenotazioni Online', 'Attiva disattiva la pagina pubblica di prenotazione e personalizza i messaggi') ? {} : {display:'none'}}
          className="w-full flex items-center gap-4 px-6 py-4 hover:bg-stone-50 transition-colors group"
        >
          <div className="w-10 h-10 rounded-xl bg-stone-100 group-hover:bg-emerald-100 flex items-center justify-center flex-shrink-0 transition-colors">
            <CalendarClock size={18} className="text-stone-500 group-hover:text-emerald-600 transition-colors" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-semibold text-stone-800">Prenotazioni Online</p>
            <p className="text-xs text-stone-400 mt-0.5">Attiva/disattiva la pagina pubblica di prenotazione e personalizza i messaggi</p>
          </div>
          <ChevronRight size={16} className="text-stone-400 group-hover:text-stone-600 transition-colors" />
        </button>

        {/* Promemoria Convalida Fiches */}
        <button
          onClick={() => setSub('promemoria')}
          style={show('Promemoria Convalida Fiches', 'Configura giorni e orario per il promemoria di convalida giornaliero') ? {} : {display:'none'}}
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

        {/* QR Code Registrazione Clienti */}
        <button
          onClick={() => setSub('qrcode')}
          style={show('QR Code Registrazione Clienti', 'Stampa il QR code da esporre in salone per le nuove clienti') ? {} : {display:'none'}}
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

        {/* Scarica File e Documenti */}
        <button
          onClick={() => setSub('scarica_documenti')}
          style={show('Scarica File e Documenti', 'Esporta e scarica file PDF CSV backup dal gestionale') ? {} : {display:'none'}}
          className="w-full flex items-center gap-4 px-6 py-4 hover:bg-stone-50 transition-colors group"
        >
          <div className="w-10 h-10 rounded-xl bg-stone-100 group-hover:bg-teal-100 flex items-center justify-center flex-shrink-0 transition-colors">
            <Download size={18} className="text-stone-500 group-hover:text-teal-600 transition-colors" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-semibold text-stone-800">Scarica File e Documenti</p>
            <p className="text-xs text-stone-400 mt-0.5">Esporta e scarica PDF, CSV e backup da tutte le sezioni del gestionale</p>
          </div>
          <ChevronRight size={16} className="text-stone-400 group-hover:text-stone-600 transition-colors" />
        </button>

        {/* Tema e Personalizzazione */}
        <button
          onClick={() => setSub('tema')}
          style={show('Tema e Personalizzazione', 'Colori sidebar, icona e logo del salone per questo dispositivo') ? {} : {display:'none'}}
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
      </div>
    </div>
  );
}

// ─── Dati Azienda ─────────────────────────────────────────────────────────────

function PaginaDatiAzienda({ onBack }: { onBack: () => void }) {
  const { user } = useAuth();
  const campi = [
    { key: 'azienda_nome', label: 'Nome Salone / Ragione Sociale', placeholder: 'Es. I Venzi di Rossi S.r.l.' },
    { key: 'azienda_intestazione', label: 'Intestazione Fatture', placeholder: 'Es. I Venzi di Mario Rossi' },
    { key: 'azienda_indirizzo', label: 'Indirizzo', placeholder: 'Es. Via Roma 1, 00100 Roma RM' },
    { key: 'azienda_piva', label: 'Partita IVA', placeholder: 'Es. IT01234567890' },
    { key: 'azienda_cf', label: 'Codice Fiscale', placeholder: 'Es. RSSMRA80A01H501U' },
    { key: 'azienda_telefono', label: 'Telefono', placeholder: 'Es. +39 06 1234567' },
    { key: 'azienda_email', label: 'Email', placeholder: 'Es. info@ivenzi.it' },
    { key: 'azienda_pec', label: 'PEC', placeholder: 'Es. ivenzi@pec.it' },
    { key: 'azienda_iban', label: 'IBAN', placeholder: 'Es. IT60X0542811101000000123456' },
    { key: 'azienda_google_maps', label: 'Link Google Maps', placeholder: 'https://maps.google.com/...' },
    { key: 'azienda_sito_prenotazioni', label: 'Link Sito Prenotazioni Online', placeholder: 'https://...' },
    { key: 'azienda_note', label: 'Note aggiuntive', placeholder: 'Eventuali altre informazioni...' },
  ];

  const [valori, setValori] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!user) return;
    Promise.all(campi.map(c => getImpostazione(c.key))).then(results => {
      const map: Record<string, string> = {};
      campi.forEach((c, i) => { map[c.key] = results[i] ?? ''; });
      setValori(map);
      setLoading(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function handleSave() {
    if (!user) return;
    setSaving(true);
    await Promise.all(campi.map(c => setImpostazione(c.key, valori[c.key] ?? '', user.id)));
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  if (loading) return (
    <div className="p-6 max-w-2xl mx-auto flex items-center justify-center min-h-48">
      <div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <button onClick={onBack} className="p-2 rounded-xl hover:bg-stone-100 transition-colors">
          <ArrowLeft size={18} className="text-stone-500" />
        </button>
        <div>
          <h2 className="text-xl font-bold text-stone-800">Dati Azienda</h2>
          <p className="text-sm text-stone-400">Ragione sociale, recapiti e riferimenti del salone</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6 space-y-4">
        {campi.map(c => (
          <div key={c.key}>
            <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1.5">{c.label}</label>
            <input
              type="text"
              value={valori[c.key] ?? ''}
              onChange={e => setValori(v => ({ ...v, [c.key]: e.target.value }))}
              placeholder={c.placeholder}
              className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-teal-400 transition-colors"
            />
          </div>
        ))}

        {saved && (
          <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 rounded-xl px-4 py-2.5">
            <Check size={14} /> Dati salvati con successo
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-3 bg-teal-500 text-white font-semibold rounded-xl hover:bg-teal-600 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Check size={15} /> Salva dati azienda</>}
        </button>
      </div>
    </div>
  );
}

// ─── Prenotazioni Online ──────────────────────────────────────────────────────

// ─── Canali Social ────────────────────────────────────────────────────────────

function SocialIconInstagram() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="white">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
    </svg>
  );
}
function SocialIconFacebook() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="white">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
  );
}
function SocialIconTikTok() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="white">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.27 8.27 0 004.83 1.55V6.79a4.85 4.85 0 01-1.06-.1z"/>
    </svg>
  );
}
function SocialIconYouTube() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="white">
      <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
    </svg>
  );
}
function SocialIconWhatsApp() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="white">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  );
}
function SocialIconX() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="white">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.26 5.632zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
    </svg>
  );
}
function SocialIconThreads() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="white">
      <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.964-.065-1.19.408-2.285 1.33-3.082.88-.76 2.119-1.207 3.583-1.291a13.853 13.853 0 0 1 3.02.142c-.126-.742-.375-1.332-.75-1.757-.513-.586-1.308-.883-2.359-.89h-.029c-.844 0-1.992.232-2.721 1.32L7.734 7.847c.98-1.454 2.568-2.256 4.478-2.256h.044c3.194.02 5.097 1.975 5.287 5.388.108.005.216.01.321.016 1.49.09 2.759.55 3.75 1.35 1.143.914 1.788 2.22 1.868 3.743.143 2.714-.822 5.196-2.713 6.98C19.033 23.29 16.507 24 12.186 24z"/>
    </svg>
  );
}
function SocialIconGoogle() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="white">
      <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"/>
    </svg>
  );
}
function SocialIconTripAdvisor() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="white">
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 4.5c2.073 0 3.973.756 5.433 2H6.567C8.027 5.256 9.927 4.5 12 4.5zm-7.5 7.5c0-1.48.43-2.86 1.17-4.02l1.83 1.83C7.18 10.5 7 11.23 7 12c0 .77.18 1.5.5 2.19l-1.83 1.83C4.93 14.86 4.5 13.48 4.5 12zM12 19.5c-2.073 0-3.973-.756-5.433-2h10.866c-1.46 1.244-3.36 2-5.433 2zm7.5-7.5c0 1.48-.43 2.86-1.17 4.02l-1.83-1.83c.32-.69.5-1.42.5-2.19 0-.77-.18-1.5-.5-2.19l1.83-1.83c.74 1.16 1.17 2.54 1.17 4.02zm-5.25 0c0 1.243-1.007 2.25-2.25 2.25S9.75 13.243 9.75 12 10.757 9.75 12 9.75 14.25 10.757 14.25 12z"/>
    </svg>
  );
}
function SocialIconLink() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/>
      <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
    </svg>
  );
}

const SOCIAL_CANALI: Array<{
  key: string;
  label: string;
  placeholder: string;
  color: string;
  Icon: () => JSX.Element;
}> = [
  {
    key: 'social_instagram',
    label: 'Instagram',
    placeholder: 'https://instagram.com/iltuosalone',
    color: 'from-pink-500 via-red-500 to-orange-400',
    Icon: SocialIconInstagram,
  },
  {
    key: 'social_facebook',
    label: 'Facebook',
    placeholder: 'https://facebook.com/iltuosalone',
    color: 'from-blue-700 to-blue-500',
    Icon: SocialIconFacebook,
  },
  {
    key: 'social_tiktok',
    label: 'TikTok',
    placeholder: 'https://tiktok.com/@iltuosalone',
    color: 'from-stone-900 to-stone-700',
    Icon: SocialIconTikTok,
  },
  {
    key: 'social_youtube',
    label: 'YouTube',
    placeholder: 'https://youtube.com/@iltuosalone',
    color: 'from-red-600 to-red-500',
    Icon: SocialIconYouTube,
  },
  {
    key: 'social_whatsapp',
    label: 'WhatsApp Business',
    placeholder: 'https://wa.me/393331234567',
    color: 'from-green-500 to-emerald-500',
    Icon: SocialIconWhatsApp,
  },
  {
    key: 'social_x',
    label: 'X (Twitter)',
    placeholder: 'https://x.com/iltuosalone',
    color: 'from-stone-800 to-stone-700',
    Icon: SocialIconX,
  },
  {
    key: 'social_threads',
    label: 'Threads',
    placeholder: 'https://threads.net/@iltuosalone',
    color: 'from-stone-900 to-stone-800',
    Icon: SocialIconThreads,
  },
  {
    key: 'social_google_business',
    label: 'Google Business',
    placeholder: 'https://g.page/iltuosalone',
    color: 'from-blue-500 to-sky-500',
    Icon: SocialIconGoogle,
  },
  {
    key: 'social_tripadvisor',
    label: 'TripAdvisor',
    placeholder: 'https://tripadvisor.it/...',
    color: 'from-emerald-600 to-green-500',
    Icon: SocialIconTripAdvisor,
  },
  {
    key: 'social_altro',
    label: 'Altro link',
    placeholder: 'https://...',
    color: 'from-stone-500 to-stone-400',
    Icon: SocialIconLink,
  },
];

// ─── Orari Salone ────────────────────────────────────────────────────────────

const GIORNI = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'] as const;

interface GiornoOrario {
  aperto: boolean;
  apertura: string;
  chiusura: string;
  pausa_inizio: string;
  pausa_fine: string;
  pausa_attiva: boolean;
}

const GIORNO_DEFAULT: GiornoOrario = { aperto: true, apertura: '09:00', chiusura: '19:00', pausa_inizio: '13:00', pausa_fine: '14:00', pausa_attiva: false };
const DOMENICA_DEFAULT: GiornoOrario = { aperto: false, apertura: '09:00', chiusura: '13:00', pausa_inizio: '13:00', pausa_fine: '14:00', pausa_attiva: false };

function PaginaOrariSalone({ onBack }: { onBack: () => void }) {
  const { user } = useAuth();
  const [orari, setOrari] = useState<GiornoOrario[]>(() =>
    GIORNI.map((_, i) => i === 6 ? { ...DOMENICA_DEFAULT } : { ...GIORNO_DEFAULT })
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [nota, setNota] = useState('');
  const [ferieInizio, setFerieInizio] = useState('');
  const [ferieFine, setFerieFine] = useState('');

  useEffect(() => {
    if (!user) return;
    Promise.all([
      getImpostazione('orari_salone_json'),
      getImpostazione('orari_salone_nota'),
      getImpostazione('ferie_inizio'),
      getImpostazione('ferie_fine'),
    ]).then(([jsonStr, notaVal, fi, ff]) => {
      if (jsonStr) {
        try { setOrari(JSON.parse(jsonStr)); } catch {}
      }
      setNota(notaVal ?? '');
      setFerieInizio(fi ?? '');
      setFerieFine(ff ?? '');
      setLoading(false);
    });
  }, [user]);

  function updateGiorno(i: number, patch: Partial<GiornoOrario>) {
    setOrari(prev => prev.map((g, idx) => idx === i ? { ...g, ...patch } : g));
  }

  async function handleSave() {
    setSaving(true);
    await Promise.all([
      setImpostazione('orari_salone_json', JSON.stringify(orari), user?.id),
      setImpostazione('orari_salone_nota', nota, user?.id),
      setImpostazione('ferie_inizio', ferieInizio, user?.id),
      setImpostazione('ferie_fine', ferieFine, user?.id),
    ]);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-7 h-7 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 hover:bg-stone-100 rounded-xl transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h2 className="text-xl font-bold text-stone-800">Orari Salone</h2>
          <p className="text-sm text-stone-400 mt-0.5">Giorni di apertura e orari di lavoro</p>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-3.5 flex items-start gap-3">
        <Clock size={15} className="text-amber-600 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-amber-700 leading-relaxed">
          Questi orari sono <span className="font-semibold">informativi</span> e non influenzano le prenotazioni online. Servono come riferimento per il salone e per i clienti.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden divide-y divide-stone-100">
        {GIORNI.map((giorno, i) => {
          const g = orari[i];
          return (
            <div key={giorno} className="px-5 py-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-stone-800">{giorno}</p>
                <button
                  onClick={() => updateGiorno(i, { aperto: !g.aperto })}
                  className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${g.aperto ? 'bg-amber-500' : 'bg-stone-200'}`}
                >
                  <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${g.aperto ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>

              {g.aperto && (
                <div className="space-y-2.5 pl-0.5">
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-stone-500 w-20 flex-shrink-0">Apertura</span>
                    <input
                      type="time"
                      value={g.apertura}
                      onChange={e => updateGiorno(i, { apertura: e.target.value })}
                      className="text-sm border border-stone-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-400 text-stone-700"
                    />
                    <span className="text-xs text-stone-400">→</span>
                    <input
                      type="time"
                      value={g.chiusura}
                      onChange={e => updateGiorno(i, { chiusura: e.target.value })}
                      className="text-sm border border-stone-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-400 text-stone-700"
                    />
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-xs text-stone-500 w-20 flex-shrink-0">Pausa pranzo</span>
                    <button
                      onClick={() => updateGiorno(i, { pausa_attiva: !g.pausa_attiva })}
                      className={`w-9 h-5 rounded-full transition-colors relative flex-shrink-0 ${g.pausa_attiva ? 'bg-amber-400' : 'bg-stone-200'}`}
                    >
                      <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${g.pausa_attiva ? 'translate-x-4' : 'translate-x-0.5'}`} />
                    </button>
                    {g.pausa_attiva && (
                      <>
                        <input
                          type="time"
                          value={g.pausa_inizio}
                          onChange={e => updateGiorno(i, { pausa_inizio: e.target.value })}
                          className="text-sm border border-stone-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-400 text-stone-700"
                        />
                        <span className="text-xs text-stone-400">→</span>
                        <input
                          type="time"
                          value={g.pausa_fine}
                          onChange={e => updateGiorno(i, { pausa_fine: e.target.value })}
                          className="text-sm border border-stone-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-400 text-stone-700"
                        />
                      </>
                    )}
                  </div>
                </div>
              )}

              {!g.aperto && (
                <p className="text-xs text-stone-400 pl-0.5 italic">Chiuso</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Periodo ferie */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5 space-y-4">
        <div>
          <p className="text-sm font-semibold text-stone-800">Periodo di ferie</p>
          <p className="text-xs text-stone-400 mt-0.5">
            Durante questo periodo l'annuncio "Ferie" verrà mostrato ad ogni accesso delle clienti al portale.
          </p>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-stone-500">Inizio ferie</label>
            <input
              type="date"
              value={ferieInizio}
              onChange={e => setFerieInizio(e.target.value)}
              className="text-sm border border-stone-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-400 text-stone-700"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-stone-500">Fine ferie</label>
            <input
              type="date"
              value={ferieFine}
              onChange={e => setFerieFine(e.target.value)}
              className="text-sm border border-stone-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-400 text-stone-700"
            />
          </div>
          {ferieInizio && ferieFine && (
            <button
              onClick={() => { setFerieInizio(''); setFerieFine(''); }}
              className="text-xs text-rose-500 hover:text-rose-600 font-medium mt-4"
            >
              Cancella date
            </button>
          )}
        </div>
        {ferieInizio && ferieFine && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
            L'annuncio di ferie comparira' dal <strong>{new Date(ferieInizio + 'T12:00:00').toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' })}</strong> al <strong>{new Date(ferieFine + 'T12:00:00').toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' })}</strong>.
          </p>
        )}
      </div>

      <div>
        <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">Nota informativa</label>
        <textarea
          value={nota}
          onChange={e => setNota(e.target.value)}
          rows={3}
          placeholder="Es: Chiusi durante le festività nazionali. Su appuntamento anche il lunedì mattina."
          className="w-full text-sm border border-stone-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-400 text-stone-700 placeholder-stone-300 resize-none transition-colors"
        />
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-semibold text-sm shadow-sm transition-all"
      >
        {saved ? <Check size={16} /> : <Clock size={16} />}
        {saving ? 'Salvataggio...' : saved ? 'Salvato!' : 'Salva orari'}
      </button>
    </div>
  );
}

function PaginaCanaleSocial({ onBack }: { onBack: () => void }) {
  const { user } = useAuth();
  const [valori, setValori] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!user) return;
    Promise.all(SOCIAL_CANALI.map(c => getImpostazione(c.key))).then(results => {
      const map: Record<string, string> = {};
      SOCIAL_CANALI.forEach((c, i) => { map[c.key] = results[i] ?? ''; });
      setValori(map);
      setLoading(false);
    });
  }, [user]);

  async function handleSave() {
    setSaving(true);
    await Promise.all(
      SOCIAL_CANALI.map(c => setImpostazione(c.key, valori[c.key] ?? '', user?.id))
    );
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  const compilati = SOCIAL_CANALI.filter(c => (valori[c.key] ?? '').trim()).length;

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-7 h-7 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 hover:bg-stone-100 rounded-xl transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h2 className="text-xl font-bold text-stone-800">Canali Social</h2>
          <p className="text-sm text-stone-400 mt-0.5">
            Link ai profili e alle pagine del salone
            {compilati > 0 && <span className="ml-1.5 text-pink-500 font-semibold">· {compilati} configurati</span>}
          </p>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 flex items-start gap-3">
        <Link size={15} className="text-amber-600 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-amber-700 leading-relaxed">
          Inserisci i link completi (con <span className="font-mono bg-amber-100 px-1 rounded">https://</span>). I campi lasciati vuoti non verranno salvati. Questi link possono essere usati in futuro per comunicazioni o per il portale prenotazioni.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden divide-y divide-stone-100">
        {SOCIAL_CANALI.map(canale => (
          <div key={canale.key} className="px-5 py-4 flex items-center gap-4">
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${canale.color} flex items-center justify-center flex-shrink-0`}>
              <canale.Icon />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-stone-600 mb-1">{canale.label}</p>
              <input
                type="url"
                value={valori[canale.key] ?? ''}
                onChange={e => setValori(prev => ({ ...prev, [canale.key]: e.target.value }))}
                placeholder={canale.placeholder}
                className="w-full text-sm border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-200 focus:border-pink-400 text-stone-700 placeholder-stone-300 transition-colors"
              />
            </div>
            {(valori[canale.key] ?? '').trim() && (
              <a
                href={valori[canale.key]}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 text-stone-400 hover:text-pink-500 transition-colors flex-shrink-0"
                title="Apri link"
              >
                <ExternalLink size={15} />
              </a>
            )}
          </div>
        ))}
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-gradient-to-r from-pink-500 to-orange-400 hover:from-pink-600 hover:to-orange-500 disabled:opacity-50 text-white font-semibold text-sm shadow-sm transition-all"
      >
        {saved ? <Check size={16} /> : <Share2 size={16} />}
        {saving ? 'Salvataggio...' : saved ? 'Salvato!' : 'Salva canali social'}
      </button>
    </div>
  );
}

// ─── Prenotazioni Online ──────────────────────────────────────────────────────

function PaginaPrenotazioniOnline({ onBack }: { onBack: () => void }) {
  const { user } = useAuth();
  const [localPage, setLocalPage] = useState<null | 'annuncio'>(null);
  const [attiva, setAttiva] = useState(true);
  const [portaleNascosto, setPortaleNascosto] = useState(false);
  const [nomePwa, setNomePwa] = useState('');
  const [msgConferma, setMsgConferma] = useState('Ciao {nome}! La tua prenotazione per {servizio} il {data} alle {ora} è confermata. Ti aspettiamo!');
  const [msgRifiuto, setMsgRifiuto] = useState('Ciao {nome}, purtroppo non possiamo confermare la prenotazione richiesta. Ti chiediamo di contattarci per trovare un orario alternativo.');
  const [indirizzo, setIndirizzo] = useState('');
  const [suonoRichiesta, setSuonoRichiesta] = useState<'ping' | 'squillo'>('ping');
  const [volumeNotifiche, setVolumeNotifiche] = useState(70);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [downloadingQr, setDownloadingQr] = useState(false);
  const [qrLogoUrl, setQrLogoUrl] = useState<string | null>(null);
  const [qrLogoUploading, setQrLogoUploading] = useState(false);
  const [qrPreviewDataUrl, setQrPreviewDataUrl] = useState<string | null>(null);
  const qrLogoInputRef = useRef<HTMLInputElement>(null);

  const bookingUrl = user
    ? `${window.location.origin}${window.location.pathname}?prenota=1&uid=${user.id}`
    : '';

  useEffect(() => {
    if (!user) return;
    Promise.all([
      getImpostazione('prenotazioni_online_attive'),
      getImpostazione('portale_nascosto'),
      getImpostazione('msg_conferma_appuntamento_online'),
      getImpostazione('msg_rifiuto_appuntamento_online'),
      getImpostazione('qr_prenotazioni_logo_url'),
      getImpostazione('indirizzo_salone'),
      getImpostazione('suono_richiesta_appuntamento'),
      getImpostazione('volume_notifiche'),
      getImpostazione('nome_pwa_prenotazione'),
    ]).then(([a, pn, mc, mr, logo, ind, suono, vol, nomePwaVal]) => {
      if (a !== null) setAttiva(a !== 'false');
      if (pn !== null) setPortaleNascosto(pn === 'true');
      if (mc) setMsgConferma(mc);
      if (mr) setMsgRifiuto(mr);
      if (logo) setQrLogoUrl(logo);
      if (ind) setIndirizzo(ind);
      if (suono === 'squillo') setSuonoRichiesta('squillo');
      if (vol !== null) setVolumeNotifiche(Math.max(0, Math.min(100, parseInt(vol) || 70)));
      if (nomePwaVal) setNomePwa(nomePwaVal);
      setLoading(false);
    });
  }, [user]);

  // Regenerate QR preview whenever URL or logo changes
  useEffect(() => {
    if (!bookingUrl) return;
    const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=10&ecc=H&data=${encodeURIComponent(bookingUrl)}`;
    buildQrWithLogo(qrApiUrl, qrLogoUrl).then(setQrPreviewDataUrl).catch(() => {});
  }, [bookingUrl, qrLogoUrl]);

  async function handleQrLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setQrLogoUploading(true);
    try {
      const compressed = await compressImage(file, 400);
      const path = `logo/${user.id}/qr-prenotazioni-logo.jpg`;
      await supabase.storage.from('foto-clienti').upload(path, compressed, { upsert: true, contentType: 'image/jpeg' });
      const { data: urlData } = supabase.storage.from('foto-clienti').getPublicUrl(path);
      const publicUrl = urlData.publicUrl + '?t=' + Date.now();
      setQrLogoUrl(publicUrl);
      await setImpostazione('qr_prenotazioni_logo_url', publicUrl, user.id);
    } finally {
      setQrLogoUploading(false);
      if (qrLogoInputRef.current) qrLogoInputRef.current.value = '';
    }
  }

  async function handleRemoveQrLogo() {
    if (!user) return;
    setQrLogoUrl(null);
    await setImpostazione('qr_prenotazioni_logo_url', '', user.id);
  }

  function previewSuono() {
    if (volumeNotifiche === 0) return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      const v = volumeNotifiche / 100;
      if (suonoRichiesta === 'ping') {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.connect(g); g.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.15);
        g.gain.setValueAtTime(0.35 * v, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.5);
      } else {
        const vol = 0.52 * v;
        const burst = (start: number, dur: number) => {
          [480, 620].forEach(freq => {
            const o = ctx.createOscillator();
            const g2 = ctx.createGain();
            o.connect(g2); g2.connect(ctx.destination);
            o.type = 'triangle';
            o.frequency.setValueAtTime(freq, ctx.currentTime + start);
            g2.gain.setValueAtTime(0, ctx.currentTime + start);
            g2.gain.linearRampToValueAtTime(vol, ctx.currentTime + start + 0.025);
            g2.gain.setValueAtTime(vol, ctx.currentTime + start + dur - 0.04);
            g2.gain.linearRampToValueAtTime(0, ctx.currentTime + start + dur);
            o.start(ctx.currentTime + start);
            o.stop(ctx.currentTime + start + dur);
          });
        };
        burst(0.00, 0.18); burst(0.20, 0.18);
        burst(0.60, 0.18); burst(0.80, 0.18);
      }
    } catch (_) {}
  }

  async function handleSave() {
    setSaving(true);
    await Promise.all([
      setImpostazione('prenotazioni_online_attive', attiva ? 'true' : 'false', user?.id),
      setImpostazione('portale_nascosto', portaleNascosto ? 'true' : 'false', user?.id),
      setImpostazione('msg_conferma_appuntamento_online', msgConferma, user?.id),
      setImpostazione('msg_rifiuto_appuntamento_online', msgRifiuto, user?.id),
      setImpostazione('indirizzo_salone', indirizzo, user?.id),
      setImpostazione('suono_richiesta_appuntamento', suonoRichiesta, user?.id),
      setImpostazione('volume_notifiche', String(volumeNotifiche), user?.id),
      setImpostazione('nome_pwa_prenotazione', nomePwa.trim(), user?.id),
    ]);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function copyLink() {
    navigator.clipboard.writeText(bookingUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  async function downloadQr() {
    if (!bookingUrl || downloadingQr) return;
    setDownloadingQr(true);
    try {
      const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=800x800&margin=20&ecc=H&data=${encodeURIComponent(bookingUrl)}`;
      const dataUrl = await buildQrWithLogo(qrApiUrl, qrLogoUrl);
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = 'qr-prenotazioni.png';
      a.click();
    } finally {
      setDownloadingQr(false);
    }
  }

  if (localPage === 'annuncio') return <PaginaAnnuncio onBack={() => setLocalPage(null)} userId={user?.id} />;

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-7 h-7 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 hover:bg-stone-100 rounded-xl transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h2 className="text-xl font-bold text-stone-800">Prenotazioni Online</h2>
          <p className="text-sm text-stone-400 mt-0.5">Gestisci la pagina pubblica di prenotazione</p>
        </div>
      </div>

      {/* Annuncio ai clienti */}
      <button
        onClick={() => setLocalPage('annuncio')}
        className="w-full flex items-center gap-4 bg-gradient-to-r from-violet-50 to-fuchsia-50 border border-violet-200 rounded-2xl p-5 hover:from-violet-100 hover:to-fuchsia-100 hover:border-violet-300 transition-all text-left group shadow-sm"
      >
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
          <Megaphone size={20} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-stone-800">Annuncio ai clienti</p>
          <p className="text-xs text-stone-400 mt-0.5">Mostra un messaggio al primo accesso — ferie, auguri, comunicazioni</p>
        </div>
        <ChevronRight size={18} className="text-stone-300 group-hover:text-violet-500 transition-colors flex-shrink-0" />
      </button>

      {/* Toggle attiva/disattiva */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-stone-800">Prenotazioni online</p>
            <p className="text-xs text-stone-400 mt-0.5">
              {attiva ? 'Le clienti possono richiedere appuntamenti online' : 'Il pulsante "Richiedi un appuntamento" risulta sospeso'}
            </p>
          </div>
          <button
            onClick={() => setAttiva(v => !v)}
            className={`w-12 h-6 rounded-full transition-colors relative flex-shrink-0 ${attiva ? 'bg-emerald-500' : 'bg-stone-200'}`}
          >
            <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${attiva ? 'translate-x-6' : 'translate-x-0.5'}`} />
          </button>
        </div>

        {/* Link e QR */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Link pagina prenotazioni</p>
          <div className="flex items-center gap-2 bg-stone-50 border border-stone-200 rounded-xl px-4 py-2.5">
            <Globe size={14} className="text-stone-400 flex-shrink-0" />
            <p className="flex-1 text-sm text-stone-600 truncate font-mono text-xs">{bookingUrl}</p>
            <button
              onClick={copyLink}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex-shrink-0 ${copied ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-200 hover:bg-stone-300 text-stone-700'}`}
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? 'Copiato!' : 'Copia'}
            </button>
          </div>
          {/* QR preview + download */}
          {bookingUrl && (
            <div className="space-y-3 pt-1">
              <div className="flex items-center gap-4">
                <div className="w-24 h-24 rounded-xl border border-stone-200 bg-white p-1 flex-shrink-0 flex items-center justify-center overflow-hidden">
                  {qrPreviewDataUrl
                    ? <img src={qrPreviewDataUrl} alt="QR prenotazioni" className="w-full h-full object-contain" />
                    : <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                  }
                </div>
                <div className="flex-1 space-y-2">
                  <p className="text-xs text-stone-500">Scansiona per aprire la pagina di prenotazione, oppure scarica il QR da condividere o stampare.</p>
                  <button
                    onClick={downloadQr}
                    disabled={downloadingQr}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-xl text-xs font-semibold transition-colors"
                  >
                    <Download size={13} />
                    {downloadingQr ? 'Scaricando…' : 'Scarica QR Code'}
                  </button>
                </div>
              </div>

              {/* Logo per QR */}
              <div className="pt-1">
                <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">Logo al centro del QR</p>
                <div className="flex items-center gap-3">
                  {qrLogoUrl ? (
                    <>
                      <img src={qrLogoUrl} alt="Logo QR" className="w-12 h-12 rounded-lg border border-stone-200 object-contain bg-white p-1 flex-shrink-0" />
                      <div className="flex gap-2">
                        <button
                          onClick={() => qrLogoInputRef.current?.click()}
                          disabled={qrLogoUploading}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                        >
                          <ImagePlus size={13} />
                          Cambia
                        </button>
                        <button
                          onClick={handleRemoveQrLogo}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs font-semibold transition-colors"
                        >
                          <X size={13} />
                          Rimuovi
                        </button>
                      </div>
                    </>
                  ) : (
                    <button
                      onClick={() => qrLogoInputRef.current?.click()}
                      disabled={qrLogoUploading}
                      className="flex items-center gap-2 px-4 py-2.5 border-2 border-dashed border-stone-300 hover:border-emerald-400 hover:bg-emerald-50 rounded-xl text-xs font-semibold text-stone-500 hover:text-emerald-700 transition-colors disabled:opacity-50"
                    >
                      {qrLogoUploading ? <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" /> : <ImagePlus size={14} />}
                      {qrLogoUploading ? 'Caricamento…' : 'Aggiungi logo al QR'}
                    </button>
                  )}
                  <input ref={qrLogoInputRef} type="file" accept="image/*" className="hidden" onChange={handleQrLogoUpload} />
                </div>
                <p className="text-xs text-stone-400 mt-1.5">Il logo compare al centro del QR. Usa un'immagine quadrata con sfondo bianco o trasparente.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Nascondi portale pubblico */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6">
        <div className="flex items-center justify-between">
          <div className="flex-1 pr-4">
            <p className="font-semibold text-stone-800">Nascondi portale pubblico</p>
            <p className="text-xs text-stone-400 mt-0.5">
              {portaleNascosto
                ? 'Il portale mostra un messaggio di scuse e rassicura le clienti sui loro dati'
                : 'Il portale è accessibile normalmente'}
            </p>
          </div>
          <button
            onClick={() => setPortaleNascosto(v => !v)}
            className={`w-12 h-6 rounded-full transition-colors relative flex-shrink-0 ${portaleNascosto ? 'bg-red-400' : 'bg-stone-200'}`}
          >
            <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${portaleNascosto ? 'translate-x-6' : 'translate-x-0.5'}`} />
          </button>
        </div>
        {portaleNascosto && (
          <div className="mt-4 bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-xs text-red-700 leading-relaxed">
            Le clienti vedranno: <em>"Portale temporaneamente non disponibile — non preoccuparti, le tue carte e promozioni sono al sicuro e registrate nel nostro sistema."</em>
          </div>
        )}
      </div>

      {/* Indirizzo salone */}
      {/* Nome app PWA */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6 space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Smartphone size={16} className="text-violet-500" />
          </div>
          <div>
            <p className="font-semibold text-stone-800">Nome app per le clienti</p>
            <p className="text-xs text-stone-400 mt-0.5">
              Testo che appare sotto l'icona quando la cliente installa il portale come app sul telefono (PWA).
              Se lasciato vuoto si usa "Prenota Online".
            </p>
          </div>
        </div>
        <input
          type="text"
          value={nomePwa}
          onChange={e => setNomePwa(e.target.value)}
          placeholder="Es. I Venzi · Prenota"
          maxLength={30}
          className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-violet-400 text-stone-700"
        />
        <p className="text-xs text-stone-400">
          Consiglio: usa un nome breve (max 12–15 caratteri) perché i telefoni troncano i nomi lunghi sotto l'icona. Es. <span className="font-semibold">I Venzi · Prenota</span>
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6 space-y-3">
        <div>
          <p className="font-semibold text-stone-800">Posizione salone</p>
          <p className="text-xs text-stone-400 mt-0.5">Usata come variabile <code className="bg-stone-100 px-1 rounded">{'{posizione}'}</code> nei messaggi automatici</p>
        </div>
        <input
          type="text"
          value={indirizzo}
          onChange={e => setIndirizzo(e.target.value)}
          placeholder="Es: Via Roma 10, Milano — oppure link Google Maps"
          className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 text-stone-700"
        />
      </div>

      {/* Message templates */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6 space-y-5">
        <p className="font-semibold text-stone-800">Messaggi WhatsApp automatici</p>
        <p className="text-xs text-stone-400">
          Variabili disponibili: <code className="bg-stone-100 px-1 rounded">{'{nome}'}</code>{' '}
          <code className="bg-stone-100 px-1 rounded">{'{cognome}'}</code>{' '}
          <code className="bg-stone-100 px-1 rounded">{'{servizio}'}</code>{' '}
          <code className="bg-stone-100 px-1 rounded">{'{data}'}</code>{' '}
          <code className="bg-stone-100 px-1 rounded">{'{ora}'}</code>{' '}
          <code className="bg-stone-100 px-1 rounded">{'{posizione}'}</code>
        </p>

        <div>
          <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">
            Messaggio di CONFERMA
          </label>
          <textarea
            value={msgConferma}
            onChange={e => setMsgConferma(e.target.value)}
            rows={4}
            className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none text-stone-700"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">
            Messaggio di RIFIUTO
          </label>
          <textarea
            value={msgRifiuto}
            onChange={e => setMsgRifiuto(e.target.value)}
            rows={4}
            className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none text-stone-700"
          />
        </div>
      </div>

      {/* Suono notifica richiesta appuntamento */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-semibold text-stone-800 flex items-center gap-2">
              <Bell size={16} className="text-amber-500" />
              Suono notifica richiesta appuntamento
            </p>
            <p className="text-xs text-stone-400 mt-1">Come vuoi essere avvisato quando arriva una nuova richiesta?</p>
          </div>
          <button
            onClick={previewSuono}
            disabled={volumeNotifiche === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-100 hover:bg-stone-200 disabled:opacity-40 text-stone-600 rounded-lg text-xs font-medium transition-colors flex-shrink-0"
          >
            <Play size={11} />
            Ascolta
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setSuonoRichiesta('ping')}
            className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all text-left ${suonoRichiesta === 'ping' ? 'border-emerald-500 bg-emerald-50' : 'border-stone-200 bg-stone-50 hover:border-stone-300'}`}
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${suonoRichiesta === 'ping' ? 'bg-emerald-100' : 'bg-stone-100'}`}>
              <Bell size={18} className={suonoRichiesta === 'ping' ? 'text-emerald-600' : 'text-stone-500'} />
            </div>
            <div>
              <p className={`text-sm font-semibold ${suonoRichiesta === 'ping' ? 'text-emerald-800' : 'text-stone-700'}`}>Ping singolo</p>
              <p className="text-xs text-stone-400 mt-0.5">Un solo suono all'arrivo della richiesta</p>
            </div>
            {suonoRichiesta === 'ping' && <Check size={14} className="text-emerald-600" />}
          </button>
          <button
            onClick={() => setSuonoRichiesta('squillo')}
            className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all text-left ${suonoRichiesta === 'squillo' ? 'border-amber-500 bg-amber-50' : 'border-stone-200 bg-stone-50 hover:border-stone-300'}`}
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${suonoRichiesta === 'squillo' ? 'bg-amber-100' : 'bg-stone-100'}`}>
              <Activity size={18} className={suonoRichiesta === 'squillo' ? 'text-amber-600' : 'text-stone-500'} />
            </div>
            <div>
              <p className={`text-sm font-semibold ${suonoRichiesta === 'squillo' ? 'text-amber-800' : 'text-stone-700'}`}>Suona fino a risposta</p>
              <p className="text-xs text-stone-400 mt-0.5">Squilla finché non apri o chiudi il banner</p>
            </div>
            {suonoRichiesta === 'squillo' && <Check size={14} className="text-amber-600" />}
          </button>
        </div>

        {/* Volume */}
        <div className="border-t border-stone-100 pt-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-stone-700 flex items-center gap-2">
              {volumeNotifiche === 0 ? <VolumeX size={15} className="text-stone-400" /> : volumeNotifiche < 50 ? <Volume1 size={15} className="text-stone-500" /> : <Volume2 size={15} className="text-stone-600" />}
              Volume notifiche
            </p>
            <span className="text-xs font-semibold text-stone-500 w-8 text-right">{volumeNotifiche}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={volumeNotifiche}
            onChange={e => setVolumeNotifiche(Number(e.target.value))}
            className="w-full h-2 rounded-full appearance-none cursor-pointer accent-amber-500"
          />
          <div className="flex justify-between text-[10px] text-stone-300 font-medium">
            <span>Silenzioso</span>
            <span>Alto</span>
          </div>
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className={`w-full py-3.5 rounded-2xl font-semibold text-sm transition-colors flex items-center justify-center gap-2 ${saved ? 'bg-emerald-500 text-white' : 'bg-stone-800 hover:bg-stone-900 text-white'} disabled:opacity-60`}
      >
        {saving ? (
          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : saved ? (
          <><Check size={16} /> Salvato!</>
        ) : (
          'Salva impostazioni'
        )}
      </button>
    </div>
  );
}

// ─── Annuncio ai Clienti ──────────────────────────────────────────────────────

const SFONDO_ORDER = ['ferie', 'natale', 'capodanno', 'estate', 'pasqua', 'san_valentino', 'autunno', 'halloween', 'primavera', 'generico'] as const;

const SFONDO_GRADIENTS: Record<string, string> = {
  ferie:         'linear-gradient(135deg, #0099cc, #33ccaa, #ffd166)',
  natale:        'linear-gradient(135deg, #0d3b1e, #4a0000)',
  capodanno:     'linear-gradient(135deg, #050d1f, #1a0a3d)',
  estate:        'linear-gradient(135deg, #ff4500, #ffd700)',
  pasqua:        'linear-gradient(135deg, #fce7f3, #d1fae5)',
  san_valentino: 'linear-gradient(135deg, #7b0028, #f06292)',
  autunno:       'linear-gradient(135deg, #7c2d12, #c2410c)',
  halloween:     'linear-gradient(135deg, #0d0d0d, #3d1a00)',
  primavera:     'linear-gradient(135deg, #bae6fd, #fbcfe8, #bbf7d0)',
  generico:      'linear-gradient(135deg, #1c1917, #3d3835)',
};

function PaginaAnnuncio({ onBack, userId }: { onBack: () => void; userId?: string }) {
  const [attivo, setAttivo] = useState(false);
  const [sfondo, setSfondo] = useState('generico');
  const [testo, setTesto] = useState(SFONDO_META['generico']?.defaultTesto ?? '');
  const [compleannoTesto, setCompleannoTesto] = useState(COMPLEANNO_DEFAULT_TESTO);
  const [annuncioId, setAnnuncioId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);
  const [tab, setTab] = useState<'annuncio' | 'compleanno' | 'benvenuto'>('annuncio');
  const [benvenutoAttivo, setBenvenutoAttivo] = useState(true);
  const [benvenutoSaving, setBenvenutoSaving] = useState(false);
  const [benvenutoSaved, setBenvenutoSaved] = useState(false);

  useEffect(() => {
    if (!userId) return;
    Promise.all([
      getImpostazione('annuncio_attivo'),
      getImpostazione('annuncio_sfondo'),
      getImpostazione('annuncio_testo'),
      getImpostazione('annuncio_id'),
      getImpostazione('annuncio_compleanno_testo'),
      getImpostazione('benvenuto_attivo'),
    ]).then(([a, s, t, id, ct, ba]) => {
      if (a !== null) setAttivo(a === 'true');
      if (s) setSfondo(s);
      if (t) setTesto(t);
      if (id) setAnnuncioId(id);
      if (ct) setCompleannoTesto(ct);
      if (ba !== null) setBenvenutoAttivo(ba !== 'false');
      setLoading(false);
    });
  }, [userId]);

  async function handleSave() {
    setSaving(true);
    await Promise.all([
      setImpostazione('annuncio_attivo', attivo ? 'true' : 'false', userId),
      setImpostazione('annuncio_sfondo', sfondo, userId),
      setImpostazione('annuncio_testo', testo, userId),
      setImpostazione('annuncio_compleanno_testo', compleannoTesto, userId),
    ]);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  async function handlePubblica() {
    setPublishing(true);
    const newId = String(Date.now());
    setAnnuncioId(newId);
    await Promise.all([
      setImpostazione('annuncio_attivo', 'true', userId),
      setImpostazione('annuncio_sfondo', sfondo, userId),
      setImpostazione('annuncio_testo', testo, userId),
      setImpostazione('annuncio_id', newId, userId),
      setImpostazione('annuncio_compleanno_testo', compleannoTesto, userId),
    ]);
    setAttivo(true);
    setPublishing(false);
    setPublished(true);
    setTimeout(() => setPublished(false), 3000);
  }

  function applyPreset() {
    const preset = SFONDO_META[sfondo]?.defaultTesto;
    if (preset) setTesto(preset);
  }

  async function handleSaveBenvenuto(val: boolean) {
    setBenvenutoAttivo(val);
    setBenvenutoSaving(true);
    await setImpostazione('benvenuto_attivo', val ? 'true' : 'false', userId);
    setBenvenutoSaving(false);
    setBenvenutoSaved(true);
    setTimeout(() => setBenvenutoSaved(false), 2500);
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-7 h-7 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 hover:bg-stone-100 rounded-xl transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h2 className="text-xl font-bold text-stone-800">Annuncio ai Clienti</h2>
          <p className="text-sm text-stone-400 mt-0.5">Messaggio di benvenuto al primo accesso</p>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex bg-stone-100 rounded-2xl p-1 gap-1">
        <button
          onClick={() => setTab('annuncio')}
          className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${tab === 'annuncio' ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-400 hover:text-stone-600'}`}
        >
          Annuncio
        </button>
        <button
          onClick={() => setTab('compleanno')}
          className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${tab === 'compleanno' ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-400 hover:text-stone-600'}`}
        >
          🎂 Compleanno
        </button>
        <button
          onClick={() => setTab('benvenuto')}
          className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${tab === 'benvenuto' ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-400 hover:text-stone-600'}`}
        >
          ✨ Benvenuto
        </button>
      </div>

      {tab === 'annuncio' && (
        <>
          {/* Toggle attivo */}
          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5 flex items-center justify-between">
            <div>
              <p className="font-semibold text-stone-800">Annuncio attivo</p>
              <p className="text-xs text-stone-400 mt-0.5">
                {attivo ? 'Le clienti vedranno questo annuncio al primo accesso' : 'Annuncio disattivato — nessuno lo vedrà'}
              </p>
            </div>
            <button
              onClick={() => setAttivo(v => !v)}
              className={`w-12 h-6 rounded-full transition-colors relative flex-shrink-0 ${attivo ? 'bg-violet-500' : 'bg-stone-200'}`}
            >
              <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${attivo ? 'translate-x-6' : 'translate-x-0.5'}`} />
            </button>
          </div>

          {/* Selezione sfondo */}
          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5 space-y-4">
            <p className="text-sm font-semibold text-stone-700">Sfondo</p>
            <div className="grid grid-cols-5 gap-2">
              {SFONDO_ORDER.map(key => {
                const meta = SFONDO_META[key];
                const selected = sfondo === key;
                return (
                  <button
                    key={key}
                    onClick={() => {
                      setSfondo(key);
                      const preset = SFONDO_META[key]?.defaultTesto;
                      if (preset) setTesto(preset);
                    }}
                    className={`relative flex flex-col items-center gap-1.5 p-2 rounded-xl border-2 transition-all ${
                      selected ? 'border-violet-500 scale-105 shadow-md' : 'border-stone-200 hover:border-stone-300'
                    }`}
                  >
                    <div
                      className="w-full rounded-lg aspect-square"
                      style={{ background: SFONDO_GRADIENTS[key] }}
                    >
                      <span className="flex items-center justify-center w-full h-full text-xl">
                        {meta?.emoji}
                      </span>
                    </div>
                    <p className={`text-[9px] font-semibold leading-tight text-center ${selected ? 'text-violet-700' : 'text-stone-500'}`}>
                      {meta?.label}
                    </p>
                    {selected && (
                      <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-violet-500 flex items-center justify-center">
                        <Check size={9} className="text-white" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Testo annuncio */}
          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-stone-700">Testo annuncio</p>
              <button
                onClick={applyPreset}
                className="text-xs text-violet-600 hover:text-violet-700 font-medium flex items-center gap-1 transition-colors"
              >
                <RotateCcw size={11} />
                Testo predefinito
              </button>
            </div>
            <p className="text-xs text-stone-400">Puoi usare <span className="font-mono bg-stone-100 px-1 rounded">{'{nome}'}</span> per inserire il nome della cliente.</p>
            <textarea
              value={testo}
              onChange={e => setTesto(e.target.value)}
              rows={6}
              className="w-full text-sm border border-stone-200 rounded-xl px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-400 text-stone-700 placeholder-stone-300 transition-colors"
              placeholder="Scrivi qui il tuo messaggio..."
            />
          </div>

          {/* Info ultimo annuncio pubblicato */}
          {annuncioId && (
            <div className="bg-violet-50 border border-violet-200 rounded-2xl px-5 py-4 flex items-start gap-3">
              <Megaphone size={15} className="text-violet-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-violet-700 leading-relaxed">
                Ultimo annuncio pubblicato il{' '}
                <span className="font-semibold">
                  {new Date(parseInt(annuncioId)).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
                . Le clienti che lo hanno già chiuso non lo rivedrannno — usa "Pubblica annuncio" per generarne uno nuovo visibile a tutte.
              </p>
            </div>
          )}

          {/* Azioni */}
          <div className="flex gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className={`flex-1 py-3.5 rounded-2xl font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
                saved ? 'bg-emerald-500 text-white' : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
              } disabled:opacity-50`}
            >
              {saved ? <><Check size={15} /> Salvato!</> : saving ? <div className="w-4 h-4 border-2 border-stone-400 border-t-transparent rounded-full animate-spin" /> : 'Salva bozza'}
            </button>
            <button
              onClick={handlePubblica}
              disabled={publishing || !testo.trim()}
              className={`flex-1 py-3.5 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-sm ${
                published ? 'bg-emerald-500 text-white' : 'bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600 text-white'
              } disabled:opacity-50`}
            >
              {published ? (
                <><Check size={15} /> Pubblicato!</>
              ) : publishing ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <><Megaphone size={15} /> Pubblica annuncio</>
              )}
            </button>
          </div>
        </>
      )}

      {tab === 'compleanno' && (
        <>
          {/* Info compleanno */}
          <div className="bg-gradient-to-r from-amber-50 to-pink-50 border border-amber-200 rounded-2xl px-5 py-4 space-y-2">
            <p className="text-sm font-semibold text-amber-800 flex items-center gap-2">
              🎂 Annuncio automatico di compleanno
            </p>
            <p className="text-xs text-amber-700 leading-relaxed">
              Se la data di nascita della cliente è registrata nel gestionale, nel giorno del suo compleanno vedrà automaticamente questo messaggio speciale — indipendentemente dall'annuncio normale.
            </p>
          </div>

          {/* Preview sfondo compleanno */}
          <div className="rounded-2xl overflow-hidden h-16 flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #92400e, #c026d3, #4f46e5)' }}>
            <p className="text-white font-bold text-sm tracking-wide">✨ Sfondo compleanno (automatico) ✨</p>
          </div>

          {/* Testo compleanno */}
          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5 space-y-3">
            <p className="text-sm font-semibold text-stone-700">Testo di auguri</p>
            <p className="text-xs text-stone-400">
              Usa <span className="font-mono bg-stone-100 px-1 rounded">{'{nome}'}</span> per inserire il nome. Il titolo "Tanti auguri, [Nome]!" è sempre automatico.
            </p>
            <textarea
              value={compleannoTesto}
              onChange={e => setCompleannoTesto(e.target.value)}
              rows={6}
              className="w-full text-sm border border-stone-200 rounded-xl px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-pink-200 focus:border-pink-400 text-stone-700 placeholder-stone-300 transition-colors"
            />
            <button
              onClick={() => setCompleannoTesto(COMPLEANNO_DEFAULT_TESTO)}
              className="text-xs text-pink-600 hover:text-pink-700 font-medium flex items-center gap-1 transition-colors"
            >
              <RotateCcw size={11} />
              Ripristina testo predefinito
            </button>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className={`w-full py-3.5 rounded-2xl font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
              saved ? 'bg-emerald-500 text-white' : 'bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white'
            } disabled:opacity-50`}
          >
            {saved ? <><Check size={15} /> Salvato!</> : saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Check size={15} /> Salva testo auguri</>}
          </button>
        </>
      )}

      {tab === 'benvenuto' && (
        <>
          {/* Info box */}
          <div className="bg-gradient-to-r from-rose-50 to-pink-50 border border-rose-200 rounded-2xl px-5 py-4 space-y-2">
            <p className="text-sm font-semibold text-rose-800 flex items-center gap-2">
              ✨ Messaggio di benvenuto automatico
            </p>
            <p className="text-xs text-rose-700 leading-relaxed">
              Quando una nuova cliente invia la sua scheda di registrazione, al primo accesso al portale vedrà un messaggio di benvenuto che presenta tutti i vantaggi della sua area personale. Il messaggio appare <strong>una sola volta</strong> e si chiude con il pulsante "Scopri il tuo spazio".
            </p>
          </div>

          {/* Anteprima sfondo */}
          <div className="rounded-2xl overflow-hidden h-16 flex items-center justify-center"
            style={{ background: 'linear-gradient(160deg, #f8a5c2 0%, #f4c2c2 40%, #c8e6c9 100%)' }}>
            <p className="text-white font-bold text-sm tracking-wide drop-shadow">✨ Sfondo benvenuto (cipria · automatico) ✨</p>
          </div>

          {/* Toggle attivo */}
          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5 flex items-center justify-between">
            <div>
              <p className="font-semibold text-stone-800">Messaggio di benvenuto attivo</p>
              <p className="text-xs text-stone-400 mt-0.5">
                {benvenutoAttivo
                  ? 'Le nuove clienti vedranno il messaggio al primo accesso'
                  : 'Messaggio disattivato — le nuove clienti non lo vedranno'}
              </p>
            </div>
            <button
              onClick={() => handleSaveBenvenuto(!benvenutoAttivo)}
              disabled={benvenutoSaving}
              className={`w-12 h-6 rounded-full transition-colors relative flex-shrink-0 ${benvenutoAttivo ? 'bg-rose-400' : 'bg-stone-200'}`}
            >
              <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${benvenutoAttivo ? 'translate-x-6' : 'translate-x-0.5'}`} />
            </button>
          </div>

          {benvenutoSaved && (
            <div className="flex items-center gap-2 text-sm text-emerald-600 font-medium px-1">
              <Check size={15} /> Impostazione salvata
            </div>
          )}

          {/* Contenuto del messaggio (sola lettura) */}
          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5 space-y-3">
            <p className="text-sm font-semibold text-stone-700">Testo del messaggio</p>
            <p className="text-xs text-stone-400">Anteprima del testo mostrato alla cliente. Per modificarlo vai in <strong className="text-stone-500">Impostazioni → Benvenuto Nuove Clienti</strong>.</p>
            <div className="bg-stone-50 rounded-xl px-4 py-3 text-xs text-stone-600 leading-relaxed space-y-2 border border-stone-100">
              <p className="font-semibold text-stone-800">✨ Finalmente sei qui, [Nome Cliente]!</p>
              <p>La tua scheda è confermata e le porte del tuo nuovo angolo di bellezza digitale si sono appena aperte. Non è il solito sito e non è la solita app: questo è il tuo <strong>pass d'accesso esclusivo</strong> al futuro del nostro salone.</p>
              <p>Abbiamo digitalizzato le tue coccole. Ecco cosa troverai nella tua <strong>Area Personale</strong>:</p>
              <ul className="space-y-1 pl-2">
                <li><strong>Niente attese al telefono</strong>: Invii la tua richiesta di prenotazione in un attimo, quando vuoi tu, e aspetti solo il nostro messaggio di conferma.</li>
                <li><strong>Tutto sotto controllo</strong>: Vedi all'istante i tuoi appuntamenti passati e quelli futuri per pianificare i tuoi look.</li>
                <li><strong>Il tuo diario di bellezza</strong>: Vuoi ricordare che colore o trattamento hai fatto l'ultima volta, quando e con chi? È tutto scritto qui.</li>
                <li><strong>Il tuo borsellino</strong>: Monitori in tempo reale il saldo delle tue carte, abbonamenti e promozioni.</li>
                <li><strong>Filo diretto con noi</strong>: Puoi inviarci foto di ispirazione o messaggi per richieste speciali prima ancora di sederti in poltrona.</li>
              </ul>
              <p>Curiosa di vedere come abbiamo rivoluzionato il tuo modo di prenderti cura di te? Il tuo nuovo portale è pronto.</p>
            </div>
          </div>
        </>
      )}
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

  // Sync logo from Supabase on mount (cross-device support)
  useEffect(() => {
    if (!user) return;
    if (getLogoCacheB64()) return;
    (async () => {
      const { data } = await supabase.from('impostazioni')
        .select('valore')
        .eq('chiave', 'logo_salone_url')
        .eq('user_id', user.id)
        .maybeSingle();
      if (!data?.valore) return;
      const url = data.valore;
      saveTheme({ logoUrl: url });
      fetch(url)
        .then(r => r.blob())
        .then(blob => new Promise<string>((res, rej) => {
          const reader = new FileReader();
          reader.onload = () => res(reader.result as string);
          reader.onerror = rej;
          reader.readAsDataURL(blob);
        }))
        .then(b64 => { saveLogoCacheB64(b64); setLogoPreview(b64); })
        .catch(() => setLogoPreview(url));
    })();
  }, [user]);

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
        const logoUrl = urlData.publicUrl + '?v=' + Date.now();
        apply({ logoUrl });
        // Persist URL in impostazioni for cross-device sync (with version param to bust cache)
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

// ─── Backup automatico ────────────────────────────────────────────────────────
const BACKUP_TABLES = [
  'parrucchieri', 'clienti', 'trattamenti_catalogo', 'voci_extra_catalogo',
  'impostazioni', 'appuntamenti', 'appuntamento_trattamenti', 'schede_colore',
  'giorni_parrucchieri', 'fiches', 'fiche_voci', 'incassi_giornalieri',
  'carte_sconto', 'utilizzi_carta_sconto', 'carte_premium', 'ricariche_carta_premium',
  'utilizzi_carta_premium', 'rivendita_prodotti', 'template_messaggi_carta_sconto',
  'template_messaggi_comunicazioni', 'schede_clienti_da_confermare',
  'magazzino_categorie', 'magazzino_prodotti', 'magazzino_schede_salvate', 'assenze_parrucchieri',
];

async function exportDataForAutoBackup(todayStr: string): Promise<string | null> {
  // 1. Prova SQLite locale (funziona offline in Electron)
  if (window.electronAPI?.db) {
    const localRes = await window.electronAPI.db.export();
    if (localRes?.ok && localRes?.data) {
      return JSON.stringify(localRes.data, null, 2);
    }
  }
  // 2. Fallback: Supabase JS client (richiede internet, no problemi CORS in Electron)
  try {
    const backup: Record<string, unknown[]> = {};
    for (const table of BACKUP_TABLES) {
      const { data } = await supabase.from(table).select('*');
      backup[table] = data ?? [];
    }
    return JSON.stringify(
      { version: 1, created_at: `${todayStr}T00:00:00.000Z`, tables: BACKUP_TABLES, data: backup },
      null, 2
    );
  } catch {
    return null;
  }
}

const AB_ENABLED_KEY = 'auto_backup_enabled';
const AB_TIME_KEY = 'auto_backup_time';     // "HH:MM"
const AB_DAYS_KEY = 'auto_backup_days';     // "0,1,2,3,4,5,6" (0=dom)
const AB_LAST_KEY = 'auto_backup_last';     // "YYYY-MM-DD"

const FS_ENABLED_KEY = 'fiches_sched_enabled';
const FS_TIME_KEY    = 'fiches_sched_time';   // "HH:MM"
const FS_DAYS_KEY    = 'fiches_sched_days';   // "1,2,3,4,5"
const FS_LAST_KEY    = 'fiches_sched_last';   // "YYYY-MM-DD"
const FS_XLS_KEY     = 'fiches_sched_xls';    // "1" = also save XLS

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
  if (lastStr === todayStr) return false;

  const [hh, mm] = timeStr.split(':').map(Number);
  const timePassed = now.getHours() > hh || (now.getHours() === hh && now.getMinutes() >= mm);
  if (!timePassed) return false;

  const allowedDays = daysStr.split(',').map(Number);

  // Catch-up: if last < yesterday, backup yesterday first (only last missing day)
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = localDateStr(yesterday);

  let targetDate: string;
  if (lastStr < yesterdayStr) {
    targetDate = yesterdayStr;
  } else {
    if (!allowedDays.includes(now.getDay())) return false;
    targetDate = todayStr;
  }

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
    const italDate = targetDate.split('-').reverse().join('-');
    const filename = `backup-salone-${italDate}.json`;

    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);

    localStorage.setItem(AB_LAST_KEY, targetDate);
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
    window.electronAPI.onTriggerAutoBackup(async ({ todayStr }) => {
      try {
        const jsonStr = await exportDataForAutoBackup(todayStr);
        if (!jsonStr) return;
        const italDate = todayStr.split('-').reverse().join('-');
        const filename = `backup-salone-${italDate}.json`;
        const result = await window.electronAPI!.saveBackupAuto(filename, jsonStr);
        if (result.ok) {
          await window.electronAPI!.markBackupDone(todayStr);
        } else if (result.reason === 'no-folder') {
          const manual = await window.electronAPI!.saveBackupFile(filename, jsonStr);
          if (manual.ok) await window.electronAPI!.markBackupDone(todayStr);
        }
      } catch { /* silenzioso */ }
    });
  } else {
    runAutoBackupIfDue();
    setInterval(runAutoBackupIfDue, 60_000);
  }
}

function isMobileDevice(): boolean {
  return navigator.maxTouchPoints > 1 && window.innerWidth < 1024;
}

function toLocalDateStrSimple(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getMissingFichesDates(lastStr: string, now: Date, hh: number, mm: number): string[] {
  const todayStr = toLocalDateStrSimple(now);
  const todayTimePassed = now.getHours() > hh || (now.getHours() === hh && now.getMinutes() >= mm);
  const dates: string[] = [];

  let cursor: Date;
  if (lastStr) {
    cursor = new Date(lastStr + 'T12:00:00');
    cursor.setDate(cursor.getDate() + 1);
  } else {
    cursor = new Date(todayStr + 'T12:00:00');
  }

  while (true) {
    const dateStr = toLocalDateStrSimple(cursor);
    if (dateStr > todayStr) break;
    if (dateStr === todayStr) {
      if (todayTimePassed) dates.push(dateStr);
      break;
    }
    dates.push(dateStr);
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

async function saveFicheFileAuto(type: string, filename: string, content: Blob | string): Promise<void> {
  const api = (window as any).electronAPI;
  if (api?.saveFileTo) {
    if (content instanceof Blob) {
      const buf = await content.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
      const result = await api.saveFileTo(type, filename, btoa(binary), 'base64');
      if (!result.ok) browserDownload(filename, content);
    } else {
      const result = await api.saveFileTo(type, filename, content, 'utf8');
      if (!result.ok) browserDownload(filename, content);
    }
  } else {
    browserDownload(filename, content);
  }
}

async function runAutoFichesForDate(dateStr: string, saveXls: boolean): Promise<void> {
  const italDate = dateStr.split('-').reverse().join('-');
  const { tutte, dichiarate, nonDichiarate } = await fetchFichesForDate(dateStr);

  const groups: Array<{ rows: typeof tutte; slug: string; pdfType: string; xlsType: string; title: string }> = [
    { rows: tutte,         slug: 'tutte',          pdfType: 'fiches_tutte',          xlsType: 'fiches_xls_tutte',          title: 'Fiches \u2014 Tutte' },
    { rows: dichiarate,    slug: 'dichiarate',      pdfType: 'fiches_dichiarate',     xlsType: 'fiches_xls_dichiarate',     title: 'Fiches \u2014 Dichiarate' },
    { rows: nonDichiarate, slug: 'non-dichiarate',  pdfType: 'fiches_non_dichiarate', xlsType: 'fiches_xls_non_dichiarate', title: 'Fiches \u2014 Non dichiarate' },
  ];

  for (const g of groups) {
    if (g.rows.length === 0) continue;
    const pdf = generateFichesPdf(g.rows, italDate, g.title);
    await saveFicheFileAuto(g.pdfType, `fiches-${g.slug}-${italDate}.pdf`, pdf);
    if (saveXls) {
      const xls = generateFichesXls(g.rows, italDate, g.title);
      await saveFicheFileAuto(g.xlsType, `fiches-${g.slug}-${italDate}.xls`, xls);
    }
  }
}

async function runAutoFichesIfDue(): Promise<void> {
  if (isMobileDevice()) return;
  if (localStorage.getItem(FS_ENABLED_KEY) !== '1') return;
  const timeStr = localStorage.getItem(FS_TIME_KEY) ?? '20:00';
  const daysStr = localStorage.getItem(FS_DAYS_KEY) ?? '1,2,3,4,5';
  const lastStr = localStorage.getItem(FS_LAST_KEY) ?? '';
  const [hh, mm] = timeStr.split(':').map(Number);
  const now = new Date();
  const allowedDays = daysStr.split(',').map(Number);

  const dates = getMissingFichesDates(lastStr, now, hh, mm);
  // For today, also check allowed days
  const filteredDates = dates.filter(d => {
    const todayStr = toLocalDateStrSimple(now);
    if (d < todayStr) return true; // past dates always included
    return allowedDays.includes(new Date(d + 'T12:00:00').getDay());
  });

  if (filteredDates.length === 0) return;
  const saveXls = localStorage.getItem(FS_XLS_KEY) === '1';
  for (const dateStr of filteredDates) {
    await runAutoFichesForDate(dateStr, saveXls);
  }
  const latestDate = filteredDates[filteredDates.length - 1];
  localStorage.setItem(FS_LAST_KEY, latestDate);
}

export function startAutoFichesWatcher() {
  if (isMobileDevice()) return;

  if (window.electronAPI) {
    window.electronAPI.onTriggerAutoFiches(async ({ dates, latestDate }) => {
      try {
        const saveXls = localStorage.getItem(FS_XLS_KEY) === '1';
        for (const dateStr of dates) {
          await runAutoFichesForDate(dateStr, saveXls);
        }
        await window.electronAPI!.markFichesDone(latestDate);
      } catch { /* silenzioso */ }
    });
  } else {
    runAutoFichesIfDue();
    setInterval(runAutoFichesIfDue, 60_000);
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

  async function exportFromSupabaseClient(): Promise<Record<string, unknown>> {
    const backup: Record<string, unknown[]> = {};
    for (const table of BACKUP_TABLES) {
      const { data } = await supabase.from(table).select('*');
      backup[table] = data ?? [];
    }
    return { version: 1, created_at: new Date().toISOString(), tables: BACKUP_TABLES, data: backup };
  }

  async function handleExport() {
    setExporting(true);
    setFeedback(null);
    const inElectron = !!window.electronAPI;
    try {
      let data: Record<string, unknown> | null = null;

      if (inElectron) {
        // Electron: prova prima il DB locale SQLite (funziona offline)
        const localRes = await window.electronAPI!.db!.export();
        if (localRes?.ok && localRes?.data) {
          data = localRes.data as Record<string, unknown>;
        } else {
          // SQLite non disponibile: legge da Supabase (richiede connessione)
          data = await exportFromSupabaseClient();
        }
      } else {
        // Web: usa edge function con service_role
        const res = await fetch(cloudApiUrl, { headers: cloudHeaders });
        if (!res.ok) throw new Error('Errore durante l\'esportazione');
        data = await res.json();
      }

      const jsonStr = JSON.stringify(data, null, 2);
      const suggestedName = `backup-salone-${localDateStr()}.json`;

      const result = await saveFile('backup', suggestedName, jsonStr);
      if (result?.filePath) {
        setFeedback({ tipo: 'ok', msg: `Backup salvato in: ${result.filePath}` });
      } else if (inElectron) {
        // In Electron senza cartella configurata: dialogo nativo di salvataggio
        const api = (window as any).electronAPI;
        const saved = await api.saveBackupFile(suggestedName, jsonStr);
        if (saved?.ok && saved?.filePath) {
          setFeedback({ tipo: 'ok', msg: `Backup salvato in: ${saved.filePath}` });
        } else if (saved?.ok === false && !saved?.filePath) {
          // Utente ha annullato il dialogo
          setFeedback(null);
        } else {
          setFeedback({ tipo: 'err', msg: 'Salvataggio annullato o non riuscito.' });
        }
      } else {
        // Web: fallback download browser
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

const BELLA_FRASE = 'Ogni capello racconta una storia.\nScriviamola insieme!';

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
  const { user } = useAuth();
  const [registrazioneUrl, setRegistrazioneUrl] = useState('https://silver-kitsune-3a0339-3a0339.netlify.app/?registrazione=1');
  const [editingUrl, setEditingUrl] = useState(false);
  const [urlDraft, setUrlDraft] = useState('');
  const [savingUrl, setSavingUrl] = useState(false);
  const [layout, setLayout] = useState<QrLayout>('con_frase');
  const [formato, setFormato] = useState<QrFormato>('a4');
  const [generando, setGenerando] = useState(false);
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(QR_LOGO_DEFAULT);
  const [qrComposite, setQrComposite] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [regPageLogo, setRegPageLogo] = useState<string | null>(null);
  const [regLogoUploading, setRegLogoUploading] = useState(false);
  const regLogoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      const val = await getImpostazione('registrazione_url');
      if (val) setRegistrazioneUrl(val);
      const saved = localStorage.getItem(QR_LOGO_KEY);
      setLogoDataUrl(saved || QR_LOGO_DEFAULT);
      const { data } = await supabase.from('impostazioni').select('valore').eq('chiave', 'logo_salone_url').maybeSingle();
      if (data?.valore) setRegPageLogo(data.valore);
    })();
  }, []);

  async function handleSaveUrl() {
    const trimmed = urlDraft.trim();
    if (!trimmed) return;
    setSavingUrl(true);
    const { data: { user: u } } = await supabase.auth.getUser();
    await setImpostazione('registrazione_url', trimmed, u?.id);
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

  async function handleRegLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    e.target.value = '';
    setRegLogoUploading(true);
    try {
      const blob = await compressImage(file);
      const path = `logo/${user.id}/salone-logo.jpg`;
      const { error } = await supabase.storage.from('foto-clienti').upload(path, blob, { upsert: true, contentType: 'image/jpeg' });
      if (!error) {
        const { data: urlData } = supabase.storage.from('foto-clienti').getPublicUrl(path);
        const logoUrl = urlData.publicUrl + '?v=' + Date.now();
        await supabase.from('impostazioni').upsert(
          { chiave: 'logo_salone_url', valore: logoUrl, user_id: user.id },
          { onConflict: 'chiave,user_id' }
        );
        setRegPageLogo(logoUrl);
      }
    } finally {
      setRegLogoUploading(false);
    }
  }

  async function handleRegLogoRemove() {
    if (!user) return;
    await supabase.from('impostazioni').upsert(
      { chiave: 'logo_salone_url', valore: '', user_id: user.id },
      { onConflict: 'chiave,user_id' }
    );
    setRegPageLogo(null);
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
        // icona quadratino QR
        const bSize = Math.min(w * 0.12, 15);
        _drawQrBadge(doc, cx - bSize / 2, y, bSize);
        y += bSize + 5;

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
        // icona quadratino QR
        const bSize2 = Math.min(w * 0.10, 13);
        _drawQrBadge(doc, cx - bSize2 / 2, y, bSize2);
        y += bSize2 + 5;

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

  function _drawQrBadge(doc: InstanceType<typeof import('jspdf').jsPDF>, x: number, y: number, size: number) {
    const r = size * 0.22;
    // sfondo verde arrotondato
    doc.setFillColor(37, 77, 26);
    doc.roundedRect(x, y, size, size, r, r, 'F');

    const p = size * 0.15; // padding interno
    const inner = size - p * 2;
    const sq = inner * 0.36; // dimensione angolini
    const dot = sq * 0.55;  // quadratino interno angolino
    const sw = size * 0.05; // spessore bordo angolino

    doc.setDrawColor(255, 255, 255);
    doc.setFillColor(255, 255, 255);
    doc.setLineWidth(sw);

    // tre angolini (top-left, top-right, bottom-left)
    const corners = [
      [x + p, y + p],
      [x + p + inner - sq, y + p],
      [x + p, y + p + inner - sq],
    ] as [number, number][];

    const cr = sq * 0.22;
    for (const [cx2, cy2] of corners) {
      doc.roundedRect(cx2, cy2, sq, sq, cr, cr, 'S');
      const dotX = cx2 + (sq - dot) / 2;
      const dotY = cy2 + (sq - dot) / 2;
      doc.roundedRect(dotX, dotY, dot, dot, cr * 0.5, cr * 0.5, 'F');
    }

    // pattern centrale (griglia 3x3 di puntini piccoli)
    const gridStart = x + p + sq + size * 0.04;
    const gridEnd = x + p + inner - sq - size * 0.04;
    const gridTop = y + p + sq + size * 0.04;
    const gridBot = y + p + inner - sq - size * 0.04;
    const cell = Math.min((gridEnd - gridStart) / 2, (gridBot - gridTop) / 2);
    const dotSm = cell * 0.55;
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        if (row === 2 && col === 2) continue;
        const dx = gridStart + col * cell + (cell - dotSm) / 2;
        const dy = gridTop + row * cell + (cell - dotSm) / 2;
        doc.rect(dx, dy, dotSm, dotSm, 'F');
      }
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

      {/* Logo pagina registrazione */}
      <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-sm">
        <p className="text-sm font-bold text-stone-800 mb-1">Logo pagina registrazione</p>
        <p className="text-xs text-stone-400 mb-4">Questa icona compare nell'intestazione della pagina che le clienti vedono quando compilano il modulo di registrazione.</p>
        <input ref={regLogoInputRef} type="file" accept="image/*" className="hidden" onChange={handleRegLogoUpload} />
        {regPageLogo ? (
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl border border-stone-200 overflow-hidden flex-shrink-0 bg-stone-50">
              <img src={regPageLogo} alt="Logo registrazione" className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-stone-700 mb-2">Logo attivo</p>
              <div className="flex gap-2">
                <button
                  onClick={() => regLogoInputRef.current?.click()}
                  disabled={regLogoUploading}
                  className="px-3 py-1.5 text-xs font-semibold border border-stone-200 rounded-lg text-stone-600 hover:border-amber-300 hover:text-amber-700 transition-colors disabled:opacity-40"
                >
                  {regLogoUploading ? 'Caricamento...' : 'Cambia'}
                </button>
                <button
                  onClick={handleRegLogoRemove}
                  className="px-3 py-1.5 text-xs font-semibold border border-stone-200 rounded-lg text-stone-500 hover:bg-stone-50 transition-colors"
                >
                  Rimuovi
                </button>
              </div>
            </div>
          </div>
        ) : (
          <button
            onClick={() => regLogoInputRef.current?.click()}
            disabled={regLogoUploading}
            className="w-full flex flex-col items-center justify-center gap-2 py-6 border-2 border-dashed border-stone-200 rounded-xl hover:border-amber-300 hover:bg-amber-50 transition-all group disabled:opacity-40"
          >
            <div className="w-10 h-10 rounded-xl bg-stone-100 group-hover:bg-amber-100 flex items-center justify-center transition-colors">
              <ImagePlus size={18} className="text-stone-400 group-hover:text-amber-600 transition-colors" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-stone-600 group-hover:text-amber-700 transition-colors">
                {regLogoUploading ? 'Caricamento...' : 'Carica logo'}
              </p>
              <p className="text-xs text-stone-400">PNG, JPG — verrà mostrato sulla pagina di registrazione clienti</p>
            </div>
          </button>
        )}
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
  { chiave: 'password_messaggi_clienti', titolo: 'Elimina Messaggi Clienti', descrizione: "Eliminazione di messaggi singoli o di tutti i messaggi nella scheda cliente", feedbackMsg: "Password aggiornata. Sarà richiesta alla prossima eliminazione di messaggi.", onSaved: () => {} },
  { chiave: 'password_documenti', titolo: 'Scarica File e Documenti', descrizione: "Accesso alla sezione per esportare e scaricare PDF, CSV e backup da tutte le sezioni", feedbackMsg: "Password aggiornata. Sarà richiesta al prossimo accesso alla sezione documenti.", onSaved: () => sessionStorage.removeItem('documenti_unlocked') },
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

// ─── Carta Premium – anteprima visiva ────────────────────────────────────────

function CartaPremiumPreview() {
  const [side, setSide] = useState<'fronte' | 'retro'>('fronte');
  const a0: React.CSSProperties = { position: 'absolute', inset: 0 };
  return (
    <div style={{ padding: '16px 20px', background: '#eeebe4', borderBottom: '1px solid #e2dfd8', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      {/* Aspect ratio CR80 = 85.60 / 53.98, max 320 px wide */}
      <div style={{ width: '100%', maxWidth: 320, position: 'relative', aspectRatio: '85.60 / 53.98', borderRadius: 9, overflow: 'hidden', boxShadow: '0 8px 28px rgba(0,0,0,0.30),0 2px 6px rgba(0,0,0,0.15)' }}>
        {side === 'fronte' ? (
          <>
            <div style={{ ...a0, background: 'linear-gradient(130deg,#1a1200 0%,#1f1600 45%,#2d1e00 75%,#3c2700 100%)' }} />
            <div style={{ ...a0, background: 'radial-gradient(ellipse 65% 85% at 83% 48%,rgba(210,155,15,0.42) 0%,rgba(160,110,8,0.18) 42%,transparent 72%)' }} />
            <div style={{ ...a0, backgroundImage: 'repeating-linear-gradient(-50deg,transparent 0,transparent 6px,rgba(205,162,22,0.13) 6px,rgba(205,162,22,0.13) 7px)' }} />
            <div style={{ position:'absolute', top:'7%', left:'4.5%', fontSize:'clamp(5px,2.2vw,9px)', fontWeight:900, color:'#DAA520', letterSpacing:'0.3em', whiteSpace:'nowrap', textShadow:'0 1px 2px rgba(0,0,0,0.5)', fontFamily:'Arial,sans-serif' }}>CARTA PREMIUM</div>
            <div style={{ position:'absolute', top:'8%', right:'4%', width:'10%', aspectRatio:'1.3/1', background:'linear-gradient(135deg,#e8c035 0%,#c89010 40%,#DAA520 65%,#b8860b 100%)', borderRadius:3, boxShadow:'0 1px 4px rgba(0,0,0,0.5)', overflow:'hidden' }}>
              <div style={{ position:'absolute', top:'48%', left:'8%', right:'8%', height:1, background:'rgba(70,45,0,0.5)', transform:'translateY(-50%)' }} />
              <div style={{ position:'absolute', top:'10%', bottom:'10%', left:'31%', width:1, background:'rgba(70,45,0,0.5)' }} />
              <div style={{ position:'absolute', top:'10%', bottom:'10%', right:'29%', width:1, background:'rgba(70,45,0,0.5)' }} />
            </div>
            <div style={{ position:'absolute', top:'42%', left:'4.5%', width:'58%', height:'22%', border:'0.5px dashed rgba(180,140,20,0.4)', borderRadius:2 }} />
            <div style={{ position:'absolute', top:'67%', left:'4.5%', fontSize:'clamp(4px,1.5vw,6px)', color:'rgba(150,110,20,0.55)', fontWeight:600, fontFamily:'Arial,sans-serif', letterSpacing:'0.04em' }}>AREA NOME (50 × 13 mm)</div>
          </>
        ) : (
          <>
            <div style={{ ...a0, background:'#ffffff' }} />
            <div style={{ position:'absolute', top:'8%', left:0, right:0, textAlign:'center', fontSize:'clamp(4px,1.7vw,7px)', fontWeight:700, color:'#555', fontFamily:'Arial,sans-serif', letterSpacing:'0.12em' }}>PRENOTA ONLINE</div>
            <img src="/files_10187331-2026-06-12T21-52-00-862Z-image.png" style={{ position:'absolute', top:'18%', left:'50%', transform:'translateX(-50%)', width:'58%', aspectRatio:'1/1', objectFit:'contain' }} />
          </>
        )}
      </div>
      <div style={{ display:'flex', gap:6 }}>
        {(['fronte','retro'] as const).map(s => (
          <button key={s} onClick={() => setSide(s)} style={{ padding:'3px 14px', fontSize:10, fontWeight: side===s ? 700 : 400, color: side===s ? '#b8860b' : '#8a7a60', background: side===s ? 'rgba(218,165,32,0.12)' : 'transparent', border: side===s ? '1px solid rgba(218,165,32,0.4)' : '1px solid transparent', borderRadius:20, cursor:'pointer', transition:'all 0.15s', textTransform:'uppercase', fontFamily:'inherit' }}>{s}</button>
        ))}
      </div>
    </div>
  );
}

// ─── Carta Sconto – anteprima visiva ─────────────────────────────────────────

function CartaScontoPreview() {
  const [side, setSide] = useState<'fronte' | 'retro'>('fronte');
  const a0: React.CSSProperties = { position: 'absolute', inset: 0 };
  const bg = 'linear-gradient(135deg,#0a6b62 0%,#0d8a80 45%,#0fb3a4 80%,#16c9b8 100%)';
  const glow = 'radial-gradient(circle at 82% 50%,rgba(255,255,255,0.22) 0%,rgba(255,255,255,0.06) 42%,transparent 65%)';
  return (
    <div style={{ padding: '16px 20px', background: '#e0f2f0', borderBottom: '1px solid #d0ebe8', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <div style={{ width: '100%', maxWidth: 320, position: 'relative', aspectRatio: '85.60 / 53.98', borderRadius: 9, overflow: 'hidden', boxShadow: '0 8px 28px rgba(0,0,0,0.22),0 2px 6px rgba(0,0,0,0.12)' }}>
        {side === 'fronte' ? (
          <>
            <div style={{ ...a0, background: bg }} />
            <div style={{ ...a0, background: glow }} />
            {/* CARTA SCONTO */}
            <div style={{ position:'absolute', top:'7%', left:'4.5%', fontSize:'clamp(5px,2.2%,9px)', fontWeight:900, color:'rgba(255,255,255,0.96)', letterSpacing:'0.3em', whiteSpace:'nowrap', fontFamily:'Arial,sans-serif' }}>CARTA SCONTO</div>
            {/* Gift icon */}
            <div style={{ position:'absolute', top:'7%', right:'4%', width:'10%', aspectRatio:'1/1', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width:'100%', height:'100%' }}>
                <polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/>
                <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>
              </svg>
            </div>
            {/* MONOUSO badge (large) */}
            <div style={{ position:'absolute', top:'63%', left:'4.5%', fontSize:'clamp(5px,2%,8px)', fontWeight:700, color:'rgba(255,255,255,0.96)', background:'rgba(255,255,255,0.18)', padding:'1.5% 2.5%', borderRadius:'4px', border:'0.5px solid rgba(255,255,255,0.35)', whiteSpace:'nowrap', fontFamily:'Arial,sans-serif', letterSpacing:'0.08em' }}>MONOUSO</div>
            {/* Sconto % label area */}
            <div style={{ position:'absolute', top:'63%', left:'36%', width:'38%', height:'22%', border:'0.5px dashed rgba(255,255,255,0.4)', borderRadius:2 }} />
            <div style={{ position:'absolute', top:'87%', left:'36%', fontSize:'clamp(3px,1.4%,6px)', color:'rgba(255,255,255,0.55)', fontFamily:'Arial,sans-serif' }}>AREA SCONTO % (50×13 mm)</div>
          </>
        ) : (
          <>
            <div style={{ ...a0, background:'#ffffff' }} />
            <div style={{ position:'absolute', top:'42%', left:'5%', width:'43%', height:'20%', border:'0.5px dashed #ccc', borderRadius:2 }} />
            <div style={{ position:'absolute', top:'64%', left:'5%', fontSize:'clamp(3px,1.4vw,6px)', color:'#bbb', fontFamily:'Arial,sans-serif' }}>ETICHETTA CODICE (50×13 mm)</div>
            <div style={{ position:'absolute', top:'10%', right:'4%', width:'30%', textAlign:'center', fontSize:'clamp(3px,1.5vw,6px)', fontWeight:700, color:'#555', fontFamily:'Arial,sans-serif', letterSpacing:'0.1em' }}>PRENOTA ONLINE</div>
            <img src="/files_10187331-2026-06-12T21-52-00-862Z-image.png" style={{ position:'absolute', top:'18%', right:'4%', width:'30%', aspectRatio:'1/1', objectFit:'contain' }} />
          </>
        )}
      </div>
      <div style={{ display:'flex', gap:6 }}>
        {(['fronte','retro'] as const).map(s => (
          <button key={s} onClick={() => setSide(s)} style={{ padding:'3px 14px', fontSize:10, fontWeight: side===s ? 700:400, color: side===s ? '#0a6b62':'#4a7a72', background: side===s ? 'rgba(10,107,98,0.10)':'transparent', border: side===s ? '1px solid rgba(10,107,98,0.4)':'1px solid transparent', borderRadius:20, cursor:'pointer', transition:'all 0.15s', textTransform:'uppercase', fontFamily:'inherit' }}>{s}</button>
        ))}
      </div>
    </div>
  );
}

// ─── Carta Sconto Infinity – anteprima visiva ────────────────────────────────

function CartaInfinityPreview() {
  const [side, setSide] = useState<'fronte' | 'retro'>('fronte');
  const a0: React.CSSProperties = { position: 'absolute', inset: 0 };
  return (
    <div style={{ padding: '16px 20px', background: '#f0eeeb', borderBottom: '1px solid #e2dfd8', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <div style={{ width: '100%', maxWidth: 320, position: 'relative', aspectRatio: '85.60 / 53.98', borderRadius: 9, overflow: 'hidden', boxShadow: '0 8px 28px rgba(0,0,0,0.18),0 2px 6px rgba(0,0,0,0.10)', border: '1px solid rgba(180,180,180,0.35)' }}>
        {side === 'fronte' ? (
          <>
            {/* Background bianco/grigio chiaro */}
            <div style={{ ...a0, background: 'linear-gradient(135deg,#ffffff 0%,#f2f2f2 30%,#fafafa 60%,#e9e9e9 100%)' }} />
            {/* Texture diagonale */}
            <div style={{ ...a0, backgroundImage: 'repeating-linear-gradient(45deg,rgba(160,160,160,0.06) 0px,rgba(160,160,160,0.06) 1px,transparent 0px,transparent 28px)', backgroundSize: '28px 28px' }} />
            {/* Alone in alto a destra */}
            <div style={{ position:'absolute', top:'-10%', right:'-8%', width:'55%', height:'90%', borderRadius:'50%', background:'radial-gradient(circle,rgba(200,200,200,0.25) 0%,transparent 70%)' }} />
            {/* Striscia argento top */}
            <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:'linear-gradient(90deg,#c0c0c0,#e8e8e8,#f5f5f5,#e8e8e8,#c0c0c0)' }} />

            {/* CARTA SCONTO INFINITY */}
            <div style={{ position:'absolute', top:'7%', left:'4.5%', fontSize:'clamp(4px,2vw,8px)', fontWeight:800, color:'#888888', letterSpacing:'0.25em', whiteSpace:'nowrap', fontFamily:'Arial,sans-serif' }}>CARTA SCONTO INFINITY</div>

            {/* Chip argento top-right */}
            <div style={{ position:'absolute', top:'7%', right:'4%', width:'11%', aspectRatio:'1.3/1', background:'linear-gradient(135deg,#b0b0b0 0%,#e8e8e8 40%,#c8c8c8 60%,#989898 100%)', borderRadius:3, boxShadow:'0 1px 4px rgba(0,0,0,0.22)', overflow:'hidden' }}>
              <div style={{ position:'absolute', top:'15%', left:'10%', right:'10%', bottom:'15%', border:'0.5px solid rgba(140,140,140,0.38)', borderRadius:2, background:'linear-gradient(135deg,#d4d4d4 0%,#f0f0f0 50%,#b8b8b8 100%)' }} />
              <div style={{ position:'absolute', top:'50%', left:'8%', right:'8%', height:1, background:'rgba(140,140,140,0.35)', transform:'translateY(-50%)' }} />
              <div style={{ position:'absolute', top:'10%', bottom:'10%', left:'30%', width:1, background:'rgba(140,140,140,0.35)' }} />
              <div style={{ position:'absolute', top:'10%', bottom:'10%', right:'28%', width:1, background:'rgba(140,140,140,0.35)' }} />
            </div>

            {/* Area nome: 50×13mm dashed */}
            <div style={{ position:'absolute', top:'30%', left:'4.5%', width:'58%', height:'22%', border:'0.5px dashed rgba(160,160,160,0.5)', borderRadius:2 }} />
            <div style={{ position:'absolute', top:'54%', left:'4.5%', fontSize:'clamp(3px,1.3vw,5.5px)', color:'rgba(160,160,160,0.65)', fontFamily:'Arial,sans-serif' }}>NOME (50 × 13 mm)</div>

            {/* Area sconto %: 50×13mm dashed */}
            <div style={{ position:'absolute', top:'68%', left:'4.5%', width:'58%', height:'22%', border:'0.5px dashed rgba(160,160,160,0.5)', borderRadius:2 }} />
            <div style={{ position:'absolute', top:'92%', left:'4.5%', fontSize:'clamp(3px,1.3vw,5.5px)', color:'rgba(160,160,160,0.65)', fontFamily:'Arial,sans-serif' }}>SCONTO % (50 × 13 mm)</div>

            {/* Non scade badge – grande */}
            <div style={{ position:'absolute', bottom:'7%', right:'4%', fontSize:'clamp(5px,2vw,8px)', fontWeight:600, color:'#555555', background:'rgba(0,0,0,0.055)', border:'0.5px solid rgba(0,0,0,0.14)', padding:'1.5% 3%', borderRadius:20, fontStyle:'italic', whiteSpace:'nowrap', fontFamily:'Arial,sans-serif' }}>Non scade</div>

            {/* Striscia argento bottom */}
            <div style={{ position:'absolute', bottom:0, left:0, right:0, height:1, background:'linear-gradient(90deg,transparent,#c8c8c8,#e0e0e0,#c8c8c8,transparent)' }} />
          </>
        ) : (
          <>
            <div style={{ ...a0, background:'#ffffff' }} />
            <div style={{ position:'absolute', top:'42%', left:'5%', width:'43%', height:'20%', border:'0.5px dashed #ccc', borderRadius:2 }} />
            <div style={{ position:'absolute', top:'64%', left:'5%', fontSize:'clamp(3px,1.4vw,6px)', color:'#bbb', fontFamily:'Arial,sans-serif' }}>ETICHETTA CODICE (50×13 mm)</div>
            <div style={{ position:'absolute', top:'10%', right:'4%', width:'30%', textAlign:'center', fontSize:'clamp(3px,1.5vw,6px)', fontWeight:700, color:'#555', fontFamily:'Arial,sans-serif', letterSpacing:'0.1em' }}>PRENOTA ONLINE</div>
            <img src="/files_10187331-2026-06-12T21-52-00-862Z-image.png" style={{ position:'absolute', top:'18%', right:'4%', width:'30%', aspectRatio:'1/1', objectFit:'contain' }} />
          </>
        )}
      </div>
      <div style={{ display:'flex', gap:6 }}>
        {(['fronte','retro'] as const).map(s => (
          <button key={s} onClick={() => setSide(s)} style={{ padding:'3px 14px', fontSize:10, fontWeight: side===s ? 700:400, color: side===s ? '#555555':'#888888', background: side===s ? 'rgba(0,0,0,0.06)':'transparent', border: side===s ? '1px solid rgba(0,0,0,0.18)':'1px solid transparent', borderRadius:20, cursor:'pointer', transition:'all 0.15s', textTransform:'uppercase', fontFamily:'inherit' }}>{s}</button>
        ))}
      </div>
    </div>
  );
}

// ─── Pagina Scarica File e Documenti ─────────────────────────────────────────

function PaginaScaricaDocumenti({ onBack }: { onBack: () => void }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ key: string; msg: string; ok: boolean } | null>(null);
  const [ficheData, setFicheData] = useState(localDateStr());

  function oggi() {
    return new Date().toLocaleDateString('it-IT').replace(/\//g, '-');
  }

  function showFeedback(key: string, msg: string, ok = true) {
    setFeedback({ key, msg, ok });
    setTimeout(() => setFeedback(f => f?.key === key ? null : f), 3500);
  }

  async function scaricaCSV(
    filename: string,
    header: string[],
    rows: string[][],
    tipo: Parameters<typeof saveFile>[0],
    key: string,
  ) {
    const csv = [header, ...rows]
      .map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';'))
      .join('\r\n');
    await saveFile(tipo, filename, '\uFEFF' + csv);
    showFeedback(key, `File scaricato: ${filename}`);
  }

  // ── Clienti CSV ───────────────────────────────────────────────────────────
  async function scaricaClientiCsv() {
    if (!user) return;
    setLoading('clienti_csv');
    const { data } = await supabase.from('clienti')
      .select('*').eq('user_id', user.id).is('deleted_at', null)
      .order('cognome', { ascending: true });
    const rows = (data ?? []).map((c: Record<string, unknown>) => [
      String(c.cognome ?? ''), String(c.nome ?? ''), String(c.telefono ?? ''),
      String(c.email ?? ''),
      c.data_nascita ? new Date(c.data_nascita as string).toLocaleDateString('it-IT') : '',
      (String(c.note ?? '')).replace(/\n/g, ' '),
    ]);
    await scaricaCSV(`clienti-${oggi()}.csv`,
      ['Cognome', 'Nome', 'Telefono', 'Email', 'Data nascita', 'Note'],
      rows, 'clienti', 'clienti_csv');
    setLoading(null);
  }

  // ── Carte Premium CSV ─────────────────────────────────────────────────────
  async function scaricaCartePremiumCsv() {
    if (!user) return;
    setLoading('carte_premium_csv');
    const { data } = await supabase.from('carte_premium')
      .select('*, clienti(nome, cognome, telefono)')
      .eq('user_id', user.id).is('deleted_at', null)
      .order('created_at', { ascending: false });
    const rows = (data ?? []).map((cp: Record<string, unknown>) => {
      const cl = cp.clienti as Record<string, string> | null;
      return [
        cl ? `${cl.cognome ?? ''} ${cl.nome ?? ''}`.trim() : '',
        cl?.telefono ?? '',
        String(cp.codice ?? ''),
        (cp.attiva as boolean) ? 'Attiva' : 'Disattiva',
        `€${Number(cp.saldo ?? 0).toFixed(2).replace('.', ',')}`,
        (String(cp.note ?? '')).replace(/\n/g, ' '),
        cp.created_at ? new Date(cp.created_at as string).toLocaleDateString('it-IT') : '',
      ];
    });
    await scaricaCSV(`carte-premium-${oggi()}.csv`,
      ['Cliente', 'Telefono', 'Codice', 'Stato', 'Saldo', 'Note', 'Data creazione'],
      rows, 'clienti', 'carte_premium_csv');
    setLoading(null);
  }

  // ── Carte Sconto CSV ──────────────────────────────────────────────────────
  async function scaricaCarteScontoCsv() {
    if (!user) return;
    setLoading('carte_sconto_csv');
    const { data } = await supabase.from('carte_sconto')
      .select('*, clienti(nome, cognome, telefono)')
      .eq('user_id', user.id).is('deleted_at', null)
      .order('created_at', { ascending: false });
    const rows = (data ?? []).map((cs: Record<string, unknown>) => {
      const cl = cs.clienti as Record<string, string> | null;
      return [
        cl ? `${cl.cognome ?? ''} ${cl.nome ?? ''}`.trim() : '(Generica)',
        cl?.telefono ?? '',
        String(cs.codice ?? ''),
        String(cs.descrizione ?? ''),
        cs.tipo_sconto === 'percentuale' ? `${cs.valore_sconto}%` : `€${Number(cs.valore_sconto).toFixed(2).replace('.', ',')}`,
        (cs.attiva as boolean) ? 'Attiva' : 'Disattiva',
        (cs.nominativa as boolean) ? 'Si' : 'No',
        (cs.usa_e_getta as boolean) ? 'Si' : 'No',
        cs.created_at ? new Date(cs.created_at as string).toLocaleDateString('it-IT') : '',
      ];
    });
    await scaricaCSV(`carte-sconto-${oggi()}.csv`,
      ['Cliente', 'Telefono', 'Codice', 'Descrizione', 'Sconto', 'Stato', 'Nominativa', 'Monouso', 'Data creazione'],
      rows, 'clienti', 'carte_sconto_csv');
    setLoading(null);
  }

  // ── Backup JSON ───────────────────────────────────────────────────────────
  async function scaricaBackup() {
    setLoading('backup');
    try {
      const cloudApiUrl = `${localStorage.getItem('sb_custom_url') || import.meta.env.VITE_SUPABASE_URL}/functions/v1/backup-database`;
      const cloudHeaders = {
        'Authorization': `Bearer ${localStorage.getItem('sb_custom_anon_key') || import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      };
      const res = await fetch(cloudApiUrl, { headers: cloudHeaders });
      if (!res.ok) throw new Error('Errore esportazione');
      const data = await res.json();
      const filename = `backup-salone-${localDateStr()}.json`;
      await saveFile('backup', filename, JSON.stringify(data, null, 2));
      showFeedback('backup', `Backup scaricato: ${filename}`);
    } catch {
      showFeedback('backup', 'Errore durante il backup. Riprova.', false);
    }
    setLoading(null);
  }

  // ── Magazzino CSV ─────────────────────────────────────────────────────────
  async function scaricaMagazzinoCsv() {
    if (!user) return;
    setLoading('magazzino_csv');
    const { data } = await supabase.from('magazzino_prodotti')
      .select('*').eq('user_id', user.id)
      .order('nome', { ascending: true });
    const rows = (data ?? []).map((p: Record<string, unknown>) => [
      String(p.nome ?? ''),
      String(p.categoria ?? ''),
      String(p.marca ?? ''),
      String(p.quantita ?? '0'),
      String(p.quantita_minima ?? '0'),
      p.prezzo_acquisto != null ? `€${Number(p.prezzo_acquisto).toFixed(2).replace('.', ',')}` : '',
      p.prezzo_vendita != null ? `€${Number(p.prezzo_vendita).toFixed(2).replace('.', ',')}` : '',
      (String(p.note ?? '')).replace(/\n/g, ' '),
    ]);
    await scaricaCSV(`magazzino-${oggi()}.csv`,
      ['Nome', 'Categoria', 'Marca', 'Quantità', 'Quantità minima', 'Prezzo acquisto', 'Prezzo vendita', 'Note'],
      rows, 'magazzino', 'magazzino_csv');
    setLoading(null);
  }

  // ── Schede Colore CSV ─────────────────────────────────────────────────────
  async function scaricaSchedeColoreCsv() {
    if (!user) return;
    setLoading('schede_colore_csv');
    const [{ data: schede }, { data: clientiData }] = await Promise.all([
      supabase.from('schede_colore').select('*').eq('user_id', user.id).is('deleted_at', null).order('data_trattamento', { ascending: false }),
      supabase.from('clienti').select('id, nome, cognome, telefono').eq('user_id', user.id).is('deleted_at', null),
    ]);
    const mapC = Object.fromEntries((clientiData ?? []).map((c: Record<string, string>) => [c.id, c]));
    const rows = (schede ?? []).map((s: Record<string, unknown>) => {
      const c = mapC[s.cliente_id as string] as Record<string, string> | undefined;
      return [
        c ? `${c.cognome ?? ''} ${c.nome ?? ''}`.trim() : '',
        c?.telefono ?? '',
        s.data_trattamento ? new Date(s.data_trattamento as string).toLocaleDateString('it-IT') : '',
        String(s.tecnica ?? ''),
        String(s.colore_base ?? ''),
        String(s.colore_target ?? ''),
        String(s.formula_colore ?? ''),
        String(s.ossidante ?? ''),
        s.tempo_posa ? String(s.tempo_posa) : '',
        (String(s.note ?? '')).replace(/\n/g, ' '),
      ];
    });
    await scaricaCSV(`schede-colore-${oggi()}.csv`,
      ['Cliente', 'Telefono', 'Data trattamento', 'Tecnica', 'Colore base', 'Colore target', 'Formula', 'Ossidante', 'Posa (min)', 'Note'],
      rows, 'clienti', 'schede_colore_csv');
    setLoading(null);
  }

  // ── Appuntamenti CSV ──────────────────────────────────────────────────────
  async function scaricaAppuntamentiCsv() {
    if (!user) return;
    setLoading('appuntamenti_csv');
    const { data } = await supabase.from('appuntamenti')
      .select('*, clienti(nome, cognome, telefono), parrucchieri(nome)')
      .eq('user_id', user.id).is('deleted_at', null)
      .order('data_ora', { ascending: false });
    const rows = (data ?? []).map((a: Record<string, unknown>) => {
      const cl = a.clienti as Record<string, string> | null;
      const par = a.parrucchieri as Record<string, string> | null;
      return [
        a.data_ora ? new Date(a.data_ora as string).toLocaleDateString('it-IT') : '',
        a.data_ora ? new Date(a.data_ora as string).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : '',
        cl ? `${cl.cognome ?? ''} ${cl.nome ?? ''}`.trim() : '',
        cl?.telefono ?? '',
        par?.nome ?? '',
        (String(a.servizi ?? '')).replace(/\n/g, ' '),
        String(a.stato ?? ''),
        (String(a.note ?? '')).replace(/\n/g, ' '),
      ];
    });
    await scaricaCSV(`appuntamenti-${oggi()}.csv`,
      ['Data', 'Ora', 'Cliente', 'Telefono', 'Parrucchiere', 'Servizi', 'Stato', 'Note'],
      rows, 'fiches', 'appuntamenti_csv');
    setLoading(null);
  }

  // ── Stampa Carta Premium ─────────────────────────────────────────────────
  async function scaricaCartaPremiumPdf() {
    setLoading('carta_premium_pdf');
    try {
      const [nomeVal, urlVal] = await Promise.all([
        getImpostazione('azienda_nome'),
        getImpostazione('azienda_sito_prenotazioni'),
      ]);
      const logoDataUrl = getLogoCacheB64() || undefined;
      const blob = await generateCartaPremiumStampaPdf({
        saloneName: nomeVal ?? '',
        bookingUrl: urlVal ?? '',
        logoDataUrl,
      });
      await saveFile('fiches', 'carta-premium-stampa.pdf', blob);
      showFeedback('carta_premium_pdf', 'PDF scaricato: carta-premium-stampa.pdf');
    } catch {
      showFeedback('carta_premium_pdf', 'Errore durante la generazione del PDF.', false);
    }
    setLoading(null);
  }

  // ── Stampa Carta Sconto ──────────────────────────────────────────────────
  async function scaricaCartaScontoPdf() {
    setLoading('carta_sconto_pdf');
    try {
      const [nomeVal, urlVal] = await Promise.all([
        getImpostazione('azienda_nome'),
        getImpostazione('azienda_sito_prenotazioni'),
      ]);
      const logoDataUrl = getLogoCacheB64() || undefined;
      const blob = await generateCartaScontoPdfStampa({
        saloneName: nomeVal ?? '',
        bookingUrl: urlVal ?? '',
        logoDataUrl,
      });
      await saveFile('fiches', 'carta-sconto-stampa.pdf', blob);
      showFeedback('carta_sconto_pdf', 'PDF scaricato: carta-sconto-stampa.pdf');
    } catch {
      showFeedback('carta_sconto_pdf', 'Errore durante la generazione del PDF.', false);
    }
    setLoading(null);
  }

  // ── Stampa Carta Infinity ────────────────────────────────────────────────
  async function scaricaCartaInfinityPdf() {
    setLoading('carta_infinity_pdf');
    try {
      const [nomeVal, urlVal] = await Promise.all([
        getImpostazione('azienda_nome'),
        getImpostazione('azienda_sito_prenotazioni'),
      ]);
      const logoDataUrl = getLogoCacheB64() || undefined;
      const blob = await generateCartaInfinityPdfStampa({
        saloneName: nomeVal ?? '',
        bookingUrl: urlVal ?? '',
        logoDataUrl,
      });
      await saveFile('fiches', 'carta-infinity-stampa.pdf', blob);
      showFeedback('carta_infinity_pdf', 'PDF scaricato: carta-infinity-stampa.pdf');
    } catch {
      showFeedback('carta_infinity_pdf', 'Errore durante la generazione del PDF.', false);
    }
    setLoading(null);
  }

  // ── Fiches PDF ────────────────────────────────────────────────────────────
  async function scaricaFichePdf() {
    setLoading('fiches_pdf');
    try {
      const { tutte } = await fetchFichesForDate(ficheData);
      const dateLabel = new Date(ficheData).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' });
      const blob = await generateFichesPdf(tutte, dateLabel, `Fiches – ${dateLabel}`);
      const filename = `fiches_${ficheData}.pdf`;
      await saveFile('fiches', filename, blob);
      showFeedback('fiches_pdf', `PDF scaricato: ${filename}`);
    } catch {
      showFeedback('fiches_pdf', 'Errore durante la generazione del PDF.', false);
    }
    setLoading(null);
  }

  async function scaricaFicheXls() {
    setLoading('fiches_xls');
    try {
      const { tutte } = await fetchFichesForDate(ficheData);
      const dateLabel = new Date(ficheData).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' });
      const csv = generateFichesXls(tutte, dateLabel, `Fiches – ${dateLabel}`);
      const filename = `fiches_${ficheData}.csv`;
      await saveFile('fiches', filename, '\uFEFF' + csv);
      showFeedback('fiches_xls', `CSV scaricato: ${filename}`);
    } catch {
      showFeedback('fiches_xls', 'Errore durante la generazione del CSV.', false);
    }
    setLoading(null);
  }

  type DownloadCategory = {
    key: string;
    titolo: string;
    descrizione: string;
    icon: JSX.Element;
    color: string;
    hoverColor: string;
    voci: {
      key: string;
      label: string;
      fn: () => Promise<void>;
    }[];
  };

  const categorie: DownloadCategory[] = [
    {
      key: 'clienti',
      titolo: 'Clienti',
      descrizione: 'Anagrafiche clienti, schede colore, carte',
      icon: <UserCog size={18} />,
      color: 'bg-amber-100',
      hoverColor: 'text-amber-600',
      voci: [
        { key: 'clienti_csv', label: 'Elenco clienti (CSV)', fn: scaricaClientiCsv },
        { key: 'schede_colore_csv', label: 'Schede colore (CSV)', fn: scaricaSchedeColoreCsv },
        { key: 'carte_premium_csv', label: 'Carte Premium (CSV)', fn: scaricaCartePremiumCsv },
        { key: 'carte_sconto_csv', label: 'Carte Sconto (CSV)', fn: scaricaCarteScontoCsv },
      ],
    },
    {
      key: 'stampa_carte',
      titolo: 'Stampa Carte',
      descrizione: 'Template PDF fronte/retro formato CR80 (85,6×54 mm + bleed 3mm) per tipografia PVC',
      icon: <Download size={18} />,
      color: 'bg-amber-100',
      hoverColor: 'text-amber-600',
      voci: [
        { key: 'carta_premium_pdf', label: 'Carta Premium – Fronte + Retro (PDF)', fn: scaricaCartaPremiumPdf },
        { key: 'carta_sconto_pdf', label: 'Carta Sconto – Fronte + Retro (PDF)', fn: scaricaCartaScontoPdf },
        { key: 'carta_infinity_pdf', label: 'Carta Sconto Infinity – Fronte + Retro (PDF)', fn: scaricaCartaInfinityPdf },
      ],
    },
    {
      key: 'fiches',
      titolo: 'Fiches',
      descrizione: 'Fiches giornaliere in PDF o CSV per la data selezionata',
      icon: <DatabaseBackup size={18} />,
      color: 'bg-rose-100',
      hoverColor: 'text-rose-600',
      voci: [
        { key: 'fiches_pdf', label: 'Fiches del giorno (PDF)', fn: scaricaFichePdf },
        { key: 'fiches_xls', label: 'Fiches del giorno (CSV)', fn: scaricaFicheXls },
      ],
    },
    {
      key: 'agenda',
      titolo: 'Agenda',
      descrizione: 'Elenco appuntamenti',
      icon: <CalendarDays size={18} />,
      color: 'bg-emerald-100',
      hoverColor: 'text-emerald-600',
      voci: [
        { key: 'appuntamenti_csv', label: 'Appuntamenti (CSV)', fn: scaricaAppuntamentiCsv },
      ],
    },
    {
      key: 'magazzino',
      titolo: 'Magazzino',
      descrizione: 'Prodotti e scorte',
      icon: <FolderOpen size={18} />,
      color: 'bg-sky-100',
      hoverColor: 'text-sky-600',
      voci: [
        { key: 'magazzino_csv', label: 'Prodotti magazzino (CSV)', fn: scaricaMagazzinoCsv },
      ],
    },
    {
      key: 'backup',
      titolo: 'Backup',
      descrizione: 'Esporta tutti i dati del gestionale',
      icon: <DatabaseBackup size={18} />,
      color: 'bg-stone-100',
      hoverColor: 'text-stone-600',
      voci: [
        { key: 'backup', label: 'Backup completo (JSON)', fn: scaricaBackup },
      ],
    },
  ];

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <button onClick={onBack} className="p-2 rounded-xl hover:bg-stone-100 transition-colors">
          <ArrowLeft size={18} className="text-stone-600" />
        </button>
        <div>
          <h2 className="font-bold text-stone-800 text-lg">Scarica File e Documenti</h2>
          <p className="text-xs text-stone-400">Esporta e scarica file da tutte le sezioni del gestionale</p>
        </div>
      </div>

      {categorie.map(cat => (
        <div key={cat.key} className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-stone-100">
            <div className={`w-9 h-9 rounded-xl ${cat.color} flex items-center justify-center flex-shrink-0`}>
              <span className={cat.hoverColor}>{cat.icon}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-stone-800 text-sm">{cat.titolo}</p>
              <p className="text-xs text-stone-400">{cat.descrizione}</p>
            </div>
            {cat.key === 'fiches' && (
              <input
                type="date"
                value={ficheData}
                onChange={e => setFicheData(e.target.value)}
                className="text-xs border border-stone-200 rounded-lg px-2 py-1.5 text-stone-700 focus:outline-none focus:ring-1 focus:ring-rose-300 bg-white"
              />
            )}
          </div>
          {cat.key === 'stampa_carte' && (
            <>
              <CartaPremiumPreview />
              <CartaScontoPreview />
              <CartaInfinityPreview />
            </>
          )}
          <div className="divide-y divide-stone-50">
            {cat.voci.map(voce => {
              const isLoading = loading === voce.key;
              const fb = feedback?.key === voce.key;
              return (
                <button
                  key={voce.key}
                  onClick={async () => { if (!loading) await voce.fn(); }}
                  disabled={!!loading}
                  className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-stone-50 transition-colors group disabled:opacity-60"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-stone-100 group-hover:bg-teal-100 flex items-center justify-center flex-shrink-0 transition-colors">
                      {isLoading
                        ? <RefreshCw size={13} className="text-teal-500 animate-spin" />
                        : fb && feedback?.ok
                        ? <Check size={13} className="text-emerald-500" />
                        : <Download size={13} className="text-stone-400 group-hover:text-teal-600 transition-colors" />
                      }
                    </div>
                    <div className="text-left min-w-0">
                      <p className="text-sm font-medium text-stone-700 group-hover:text-stone-900 transition-colors">{voce.label}</p>
                      {fb && (
                        <p className={`text-xs mt-0.5 ${feedback?.ok ? 'text-emerald-600' : 'text-red-500'}`}>{feedback?.msg}</p>
                      )}
                    </div>
                  </div>
                  {!isLoading && !fb && (
                    <span className="text-xs text-stone-300 group-hover:text-stone-400 transition-colors flex-shrink-0">
                      {voce.label.includes('CSV') ? 'CSV' : voce.label.includes('JSON') ? 'JSON' : 'PDF'}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
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

// ─── PaginaAvvisiBanner ───────────────────────────────────────────────────────

function PaginaAvvisiBanner({ onBack, onTestReminder, onTestInForse, onTestPromApp, onTestCompleanno }: { onBack: () => void; onTestReminder?: () => void; onTestInForse?: () => void; onTestPromApp?: () => void; onTestCompleanno?: () => void }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ tipo: 'ok' | 'err'; msg: string } | null>(null);

  // Promemoria convalida fiches
  const [ficheGiorni, setFicheGiorni] = useState<number[]>([1, 2, 3, 4, 5, 6]);
  const [ficheOrario, setFicheOrario] = useState('20:00');

  // Avviso in forse
  const [inForseAttivo, setInForseAttivo] = useState(true);
  const [inForseOrario, setInForseOrario] = useState('18:00');

  // Banner promemoria invio messaggi appuntamento (mattina)
  const [promAppAttivo, setPromAppAttivo] = useState(true);
  const [promAppDa, setPromAppDa] = useState('07:00');
  const [promAppA, setPromAppA] = useState('11:00');

  // Avviso appuntamenti WhatsApp
  const [avvisoAppAttivo, setAvvisoAppAttivo] = useState(true);
  const [avvisoAppOrario, setAvvisoAppOrario] = useState('17:00');

  // Banner compleanni
  const [compleannoAttivo, setCompleannoAttivo] = useState(true);
  const [compleannoOrario, setCompleannoOrario] = useState('09:00');

  useEffect(() => {
    (async () => {
      const [g, fo, infa, inoo, paa, pad, paa2, wa, wao, ca, co] = await Promise.all([
        getImpostazione('promemoria_convalida_giorni'),
        getImpostazione('promemoria_convalida_orario'),
        getImpostazione('banner_in_forse_attivo'),
        getImpostazione('orario_avviso_in_forse'),
        getImpostazione('banner_promemoria_app_attivo'),
        getImpostazione('banner_promemoria_app_da'),
        getImpostazione('banner_promemoria_app_a'),
        getImpostazione('whatsapp_avviso_disabilitato'),
        getImpostazione('avviso_appuntamenti_orario'),
        getImpostazione('banner_compleanno_attivo'),
        getImpostazione('banner_compleanno_orario'),
      ]);
      if (g) { try { setFicheGiorni(JSON.parse(g)); } catch { /* keep default */ } }
      if (fo) setFicheOrario(fo);
      setInForseAttivo(infa !== 'false');
      if (inoo) setInForseOrario(inoo);
      setPromAppAttivo(paa !== 'false');
      if (pad) setPromAppDa(pad);
      if (paa2) setPromAppA(paa2);
      setAvvisoAppAttivo(wa !== 'true');
      if (wao) setAvvisoAppOrario(wao);
      setCompleannoAttivo(ca !== 'false');
      if (co) setCompleannoOrario(co);
      setLoading(false);
    })();
  }, []);

  function toggleFicheGiorno(v: number) {
    setFicheGiorni(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]);
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
        setImpostazione('promemoria_convalida_giorni', JSON.stringify(ficheGiorni), uid),
        setImpostazione('promemoria_convalida_orario', ficheOrario, uid),
        setImpostazione('banner_in_forse_attivo', String(inForseAttivo), uid),
        setImpostazione('orario_avviso_in_forse', inForseOrario, uid),
        setImpostazione('banner_promemoria_app_attivo', String(promAppAttivo), uid),
        setImpostazione('banner_promemoria_app_da', promAppDa, uid),
        setImpostazione('banner_promemoria_app_a', promAppA, uid),
        setImpostazione('whatsapp_avviso_disabilitato', String(!avvisoAppAttivo), uid),
        setImpostazione('avviso_appuntamenti_orario', avvisoAppOrario, uid),
        setImpostazione('banner_compleanno_attivo', String(compleannoAttivo), uid),
        setImpostazione('banner_compleanno_orario', compleannoOrario, uid),
      ]);
      setSaving(false);
      setFeedback({ tipo: 'ok', msg: 'Impostazioni avvisi salvate.' });
    } catch {
      setSaving(false);
      setFeedback({ tipo: 'err', msg: 'Errore durante il salvataggio.' });
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-7 h-7 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 hover:bg-stone-100 rounded-xl transition-colors text-stone-500 hover:text-stone-800">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-stone-800">Avvisi e Banner</h2>
          <p className="text-sm text-stone-500 mt-0.5">Gestisci tutti gli orari e le notifiche del gestionale</p>
        </div>
      </div>

      <form onSubmit={handleSalva} className="space-y-5">

        {/* Promemoria Convalida Fiches */}
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-stone-100 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
              <Bell size={16} className="text-amber-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-stone-800">Promemoria Convalida Fiches</h3>
              <p className="text-xs text-stone-500">Avviso in-app per ricordarti di convalidare le fiches giornaliere</p>
            </div>
          </div>
          <div className="px-6 py-5 space-y-5">
            <div>
              <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-3">Giorni attivi</label>
              <div className="flex gap-2 flex-wrap">
                {GIORNI_SETTIMANA.map(({ label, value }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => toggleFicheGiorno(value)}
                    className={`w-12 h-12 rounded-xl text-sm font-semibold transition-all border-2 ${
                      ficheGiorni.includes(value)
                        ? 'bg-amber-500 border-amber-500 text-white shadow-sm'
                        : 'bg-white border-stone-200 text-stone-500 hover:border-amber-300 hover:text-amber-600'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {ficheGiorni.length === 0 && (
                <p className="text-xs text-amber-600 mt-2">Nessun giorno selezionato — promemoria disattivato</p>
              )}
            </div>
            <div className="flex items-center gap-4">
              <div>
                <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1.5">Orario</label>
                <input
                  type="time"
                  value={ficheOrario}
                  onChange={e => { setFicheOrario(e.target.value); setFeedback(null); }}
                  className="border border-stone-200 rounded-xl px-4 py-2.5 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-400 transition-colors"
                />
              </div>
              {onTestReminder && (
                <div className="mt-5">
                  <button
                    type="button"
                    onClick={onTestReminder}
                    className="flex items-center gap-2 px-4 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 text-sm font-semibold rounded-xl transition-colors"
                  >
                    <Bell size={14} />
                    Testa avviso
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Avviso appuntamenti in forse */}
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
          <div className={`px-6 py-4 flex items-center gap-3 ${inForseAttivo ? 'border-b border-stone-100' : ''}`}>
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${inForseAttivo ? 'bg-amber-50' : 'bg-stone-100'}`}>
              <HelpCircle size={16} className={inForseAttivo ? 'text-amber-600' : 'text-stone-400'} />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-stone-800">Avviso Appuntamenti "In Forse"</h3>
              <p className="text-xs text-stone-500">Banner in agenda quando ci sono appuntamenti incerti tra 2 giorni</p>
            </div>
            <button
              type="button"
              onClick={() => { setInForseAttivo(v => !v); setFeedback(null); }}
              className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${inForseAttivo ? 'bg-amber-500' : 'bg-stone-200'}`}
            >
              <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${inForseAttivo ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </div>
          {inForseAttivo && (
            <div className="px-6 py-5">
              <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1.5">Orario di controllo</label>
              <div className="flex items-center gap-4">
                <input
                  type="time"
                  value={inForseOrario}
                  onChange={e => { setInForseOrario(e.target.value); setFeedback(null); }}
                  className="border border-stone-200 rounded-xl px-4 py-2.5 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-400 transition-colors"
                />
                {onTestInForse && (
                  <button
                    type="button"
                    onClick={onTestInForse}
                    className="flex items-center gap-2 px-4 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 text-sm font-semibold rounded-xl transition-colors"
                  >
                    <Bell size={14} />
                    Testa avviso
                  </button>
                )}
              </div>
              <p className="text-xs text-stone-400 mt-2">Il banner compare nell'agenda una volta al giorno a quest'ora</p>
            </div>
          )}
        </div>

        {/* Banner promemoria invio messaggi appuntamento */}
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
          <div className={`px-6 py-4 flex items-center gap-3 ${promAppAttivo ? 'border-b border-stone-100' : ''}`}>
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${promAppAttivo ? 'bg-sky-50' : 'bg-stone-100'}`}>
              <MessageSquare size={16} className={promAppAttivo ? 'text-sky-600' : 'text-stone-400'} />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-stone-800">Banner "Hai inviato i promemoria?"</h3>
              <p className="text-xs text-stone-500">Promemoria mattutino per inviare i messaggi appuntamento alle clienti</p>
            </div>
            <button
              type="button"
              onClick={() => { setPromAppAttivo(v => !v); setFeedback(null); }}
              className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${promAppAttivo ? 'bg-sky-500' : 'bg-stone-200'}`}
            >
              <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${promAppAttivo ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </div>
          {promAppAttivo && (
            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1.5">Orario di comparsa</label>
                  <input
                    type="time"
                    value={promAppDa}
                    onChange={e => { setPromAppDa(e.target.value); setFeedback(null); }}
                    className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-400 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1.5">Orario di scomparsa</label>
                  <input
                    type="time"
                    value={promAppA}
                    onChange={e => { setPromAppA(e.target.value); setFeedback(null); }}
                    className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-400 transition-colors"
                  />
                </div>
              </div>
              <p className="text-xs text-stone-400">Il banner compare all'apertura dell'app solo nell'intervallo di orario impostato</p>
              {onTestPromApp && (
                <button
                  type="button"
                  onClick={onTestPromApp}
                  className="flex items-center gap-2 px-4 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 text-sm font-semibold rounded-xl transition-colors"
                >
                  <Bell size={14} />
                  Testa avviso
                </button>
              )}
            </div>
          )}
        </div>

        {/* Avviso appuntamenti WhatsApp */}
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
          <div className={`px-6 py-4 flex items-center gap-3 ${avvisoAppAttivo ? 'border-b border-stone-100' : ''}`}>
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${avvisoAppAttivo ? 'bg-emerald-50' : 'bg-stone-100'}`}>
              <MessageCircle size={16} className={avvisoAppAttivo ? 'text-emerald-600' : 'text-stone-400'} />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-stone-800">Avviso Appuntamenti Clienti</h3>
              <p className="text-xs text-stone-500">Bottone WhatsApp in agenda per inviare il promemoria appuntamento di domani</p>
            </div>
            <button
              type="button"
              onClick={() => { setAvvisoAppAttivo(v => !v); setFeedback(null); }}
              className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${avvisoAppAttivo ? 'bg-emerald-500' : 'bg-stone-200'}`}
            >
              <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${avvisoAppAttivo ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </div>
          {avvisoAppAttivo && (
            <div className="px-6 py-5">
              <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1.5">Orario di comparsa</label>
              <input
                type="time"
                value={avvisoAppOrario}
                onChange={e => { setAvvisoAppOrario(e.target.value); setFeedback(null); }}
                className="border border-stone-200 rounded-xl px-4 py-2.5 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400 transition-colors"
              />
              <p className="text-xs text-stone-400 mt-2">Il bottone compare nell'agenda a partire da quest'ora</p>
            </div>
          )}
        </div>

        {/* Banner compleanni */}
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
          <div className={`px-6 py-4 flex items-center gap-3 ${compleannoAttivo ? 'border-b border-stone-100' : ''}`}>
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${compleannoAttivo ? 'bg-rose-50' : 'bg-stone-100'}`}>
              <Gift size={16} className={compleannoAttivo ? 'text-rose-500' : 'text-stone-400'} />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-stone-800">Banner Compleanni</h3>
              <p className="text-xs text-stone-500">Banner in agenda quando una cliente compie gli anni oggi</p>
            </div>
            <button
              type="button"
              onClick={() => { setCompleannoAttivo(v => !v); setFeedback(null); }}
              className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${compleannoAttivo ? 'bg-rose-500' : 'bg-stone-200'}`}
            >
              <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${compleannoAttivo ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </div>
          {compleannoAttivo && (
            <div className="px-6 py-5">
              <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1.5">Orario di comparsa</label>
              <div className="flex items-center gap-4">
                <input
                  type="time"
                  value={compleannoOrario}
                  onChange={e => { setCompleannoOrario(e.target.value); setFeedback(null); }}
                  className="border border-stone-200 rounded-xl px-4 py-2.5 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-rose-300 focus:border-rose-400 transition-colors"
                />
                {onTestCompleanno && (
                  <button
                    type="button"
                    onClick={onTestCompleanno}
                    className="flex items-center gap-2 px-4 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 text-sm font-semibold rounded-xl transition-colors"
                  >
                    <Bell size={14} />
                    Testa avviso
                  </button>
                )}
              </div>
              <p className="text-xs text-stone-400 mt-2">Il banner compare nell'agenda a partire da quest'ora</p>
            </div>
          )}
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

        <button
          type="submit"
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-teal-600 hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-2xl transition-colors shadow-sm"
        >
          <Check size={15} />
          {saving ? 'Salvataggio...' : 'Salva tutte le impostazioni'}
        </button>
      </form>
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
  const [orarioInForse, setOrarioInForse] = useState('18:00');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ tipo: 'ok' | 'err'; msg: string } | null>(null);

  useEffect(() => {
    (async () => {
      const m = await getImpostazione('messaggio_avviso_appuntamento');
      const i = await getImpostazione('avviso_appuntamento_indirizzo');
      const o = await getImpostazione('orario_avviso_in_forse');
      setMessaggio(m ?? DEFAULT_MESSAGGIO);
      setIndirizzo(i ?? DEFAULT_INDIRIZZO);
      setOrarioInForse(o ?? '18:00');
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
        setImpostazione('orario_avviso_in_forse', orarioInForse, uid),
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

        {/* Orario avviso in forse */}
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-stone-100 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
              <Bell size={16} className="text-amber-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-stone-800">Orario avviso appuntamenti in forse</h3>
              <p className="text-xs text-stone-500">A quest'ora comparirà il banner per gli appuntamenti "in forse" di dopodomani</p>
            </div>
          </div>
          <div className="px-6 py-5">
            <input
              type="time"
              value={orarioInForse}
              onChange={e => { setOrarioInForse(e.target.value); setFeedback(null); }}
              className="border border-stone-200 rounded-xl px-4 py-2.5 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-400 transition-colors"
            />
            <p className="text-xs text-stone-400 mt-2">Il banner apparirà nell'agenda solo se ci sono appuntamenti in forse entro 2 giorni</p>
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

// ── Notifiche Push ────────────────────────────────────────────────────────────

import { isPushSupported, getPushPermission, requestPushPermission, subscribePush, unsubscribePush } from '../lib/webPush';

function PaginaNotifichePush({ onBack }: { onBack: () => void }) {
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('unsupported');
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const refresh = useCallback(async () => {
    if (!isPushSupported()) { setPermission('unsupported'); return; }
    const perm = getPushPermission();
    setPermission(perm);
    if (perm === 'granted') {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        setSubscribed(!!sub);
      } catch { setSubscribed(false); }
    } else {
      setSubscribed(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  async function handleEnable() {
    setLoading(true);
    setMsg(null);
    try {
      const perm = await requestPushPermission();
      setPermission(perm);
      if (perm === 'granted') {
        const ok = await subscribePush();
        setSubscribed(ok);
        setMsg(ok ? { type: 'ok', text: 'Notifiche attivate! Riceverai un avviso ad ogni nuova prenotazione.' } : { type: 'err', text: 'Iscrizione fallita. Riprova.' });
      } else {
        setMsg({ type: 'err', text: 'Permesso negato. Abilitalo nelle impostazioni del browser/sistema.' });
      }
    } catch (e) {
      setMsg({ type: 'err', text: 'Errore durante l\'attivazione.' });
    } finally {
      setLoading(false);
    }
  }

  async function handleDisable() {
    setLoading(true);
    setMsg(null);
    try {
      await unsubscribePush();
      setSubscribed(false);
      setMsg({ type: 'ok', text: 'Notifiche disattivate.' });
    } catch {
      setMsg({ type: 'err', text: 'Errore durante la disattivazione.' });
    } finally {
      setLoading(false);
    }
  }

  const statusColor = permission === 'granted' && subscribed ? 'bg-emerald-100 text-emerald-700' :
    permission === 'denied' ? 'bg-red-100 text-red-700' : 'bg-stone-100 text-stone-600';
  const statusLabel = permission === 'unsupported' ? 'Non supportato' :
    permission === 'denied' ? 'Bloccato dal browser' :
    permission === 'granted' && subscribed ? 'Attivo' :
    permission === 'granted' && !subscribed ? 'Permesso concesso, non iscritto' : 'Non attivato';

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 hover:bg-stone-100 rounded-xl transition-colors">
          <ArrowLeft size={20} className="text-stone-600" />
        </button>
        <div>
          <h2 className="text-lg font-bold text-stone-900">Notifiche Push</h2>
          <p className="text-xs text-stone-400">Avvisi in tempo reale per nuove prenotazioni</p>
        </div>
      </div>

      {/* Stato */}
      <div className="bg-white rounded-2xl border border-stone-200 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-stone-700">Stato notifiche</p>
          <span className={`text-xs font-semibold px-3 py-1 rounded-full ${statusColor}`}>{statusLabel}</span>
        </div>

        {msg && (
          <div className={`flex items-start gap-2 p-3 rounded-xl text-sm ${msg.type === 'ok' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'}`}>
            {msg.type === 'ok' ? <Check size={15} className="mt-0.5 flex-shrink-0" /> : <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />}
            <span>{msg.text}</span>
          </div>
        )}

        {permission === 'unsupported' ? (
          <p className="text-sm text-stone-500">Il tuo browser non supporta le notifiche push. Usa Chrome su Android o Safari su iOS 16.4+ con l'app installata come PWA.</p>
        ) : permission === 'denied' ? (
          <div className="space-y-2">
            <p className="text-sm text-stone-600">Il browser ha bloccato le notifiche. Per riattivarle:</p>
            <ol className="text-xs text-stone-500 list-decimal list-inside space-y-1">
              <li><strong>Android Chrome</strong>: Impostazioni → Sito → Notifiche → Consenti</li>
              <li><strong>iOS Safari</strong>: Impostazioni iPhone → App → Safari → Avanzate → Sito → Consenti</li>
            </ol>
            <p className="text-xs text-stone-400">Dopo aver abilitato nel browser, torna qui e premi "Attiva".</p>
            <button
              onClick={handleEnable}
              disabled={loading}
              className="w-full mt-2 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Attivazione...' : 'Riprova ad attivare'}
            </button>
          </div>
        ) : subscribed ? (
          <div className="space-y-3">
            <p className="text-sm text-stone-600">Riceverai una notifica push ogni volta che una cliente invia una richiesta di prenotazione online.</p>
            <button
              onClick={handleDisable}
              disabled={loading}
              className="w-full py-2.5 bg-stone-100 text-stone-700 text-sm font-semibold rounded-xl hover:bg-stone-200 transition-colors disabled:opacity-50"
            >
              {loading ? 'Disattivazione...' : 'Disattiva notifiche'}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-stone-600">Attiva le notifiche push per ricevere un avviso immediato sul telefono ogni volta che una cliente prenota online, anche quando il gestionale è chiuso.</p>
            <button
              onClick={handleEnable}
              disabled={loading}
              className="w-full py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Attivazione...' : 'Attiva notifiche'}
            </button>
          </div>
        )}
      </div>

      {/* Info PWA */}
      {permission !== 'unsupported' && (
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 space-y-1">
          <p className="text-xs font-semibold text-blue-800">Consiglio per iPhone</p>
          <p className="text-xs text-blue-700">Su iOS le notifiche push funzionano solo se il gestionale è installato come app: apri il sito in Safari, premi il pulsante di condivisione e scegli "Aggiungi a schermata Home".</p>
        </div>
      )}
    </div>
  );
}

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

const CARTELLE_GENERALI: Array<{ key: string; label: string; desc: string }> = [
  { key: 'backup',        label: 'Backup',                         desc: 'File JSON backup del database' },
  { key: 'clienti',       label: 'Clienti',                        desc: 'CSV e PDF esportazione clienti' },
  { key: 'magazzino',     label: 'Magazzino',                      desc: 'CSV, PDF e HTML inventario magazzino' },
  { key: 'rivendita',     label: 'Rivendita',                      desc: 'PDF e CSV (Excel) rivendita e trattamenti' },
  { key: 'statistiche',   label: 'Statistiche',                    desc: 'PDF report statistiche e schede' },
  { key: 'qrcode',        label: 'QR Code',                        desc: 'PDF QR code registrazione clienti' },
  { key: 'comunicazioni', label: 'Comunicazioni',                   desc: 'HTML guida e materiali comunicazione' },
];

const CARTELLE_FICHES: Array<{ key: string; label: string; desc: string }> = [
  { key: 'fiches',               label: 'PDF — Salvataggio manuale',      desc: 'PDF fiches stampate manualmente' },
  { key: 'fiches_nero',          label: 'PDF — Manuale (non dichiarate)',  desc: 'PDF fiches manuali in contanti non dichiarati' },
  { key: 'fiches_tutte',         label: 'PDF — Tutte',                    desc: 'PDF automatico con tutte le fiches del giorno' },
  { key: 'fiches_dichiarate',    label: 'PDF — Dichiarate',               desc: 'PDF automatico con le fiches dichiarate (bancomat/contanti verdi)' },
  { key: 'fiches_non_dichiarate',label: 'PDF — Non dichiarate',           desc: 'PDF automatico con le fiches in contanti non dichiarati' },
  { key: 'fiches_xls_tutte',         label: 'Excel — Tutte',              desc: 'File Excel con tutte le fiches del giorno (formato italiano)' },
  { key: 'fiches_xls_dichiarate',    label: 'Excel — Dichiarate',         desc: 'File Excel con le fiches dichiarate (formato italiano)' },
  { key: 'fiches_xls_non_dichiarate',label: 'Excel — Non dichiarate',     desc: 'File Excel con le fiches non dichiarate (formato italiano)' },
];

function PathRow({ label, desc, path, onPick, onOpen, onClear, disabled }: {
  label: string; desc: string; path: string;
  onPick: () => void; onOpen: () => void; onClear: () => void; disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-4 px-6 py-4">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-stone-800">{label}</p>
        <p className="text-xs text-stone-400 mt-0.5">{desc}</p>
        {path
          ? <p className="text-xs text-emerald-600 font-mono mt-1 truncate" title={path}>{path}</p>
          : <p className="text-xs text-stone-300 italic mt-1">Nessuna cartella — userà "Salva come"</p>
        }
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {path && <button onClick={onOpen} title="Apri cartella" className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-400 hover:text-stone-600 transition-colors"><FolderOpen size={14} /></button>}
        <button onClick={onPick} disabled={disabled} className="px-3 py-1.5 text-xs font-semibold bg-stone-100 hover:bg-amber-100 text-stone-600 hover:text-amber-700 rounded-lg transition-colors disabled:opacity-40">Scegli</button>
        {path && <button onClick={onClear} title="Rimuovi" className="p-1.5 rounded-lg hover:bg-red-50 text-stone-300 hover:text-red-500 transition-colors"><X size={13} /></button>}
      </div>
    </div>
  );
}

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${on ? 'bg-amber-500' : 'bg-stone-200'}`}>
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${on ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  );
}

function PaginaCartelleSalvataggio({ onBack }: { onBack: () => void }) {
  const isElectronApp = !!(window as any).electronAPI;
  const [paths, setPaths] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [fichesOpen, setFichesOpen] = useState(false);

  // Fiches scheduler
  const [fsEnabled, setFsEnabled] = useState(false);
  const [fsTime, setFsTime]   = useState('20:00');
  const [fsDays, setFsDays]   = useState<number[]>([1, 2, 3, 4, 5]);
  const [fsXls,  setFsXls]    = useState(false);
  const [fsLast, setFsLast]   = useState('');

  useEffect(() => {
    (async () => {
      if (isElectronApp) {
        const [p, s] = await Promise.all([
          (window as any).electronAPI.getFilePaths(),
          (window as any).electronAPI.getFichesSched(),
        ]);
        setPaths(p || {});
        if (s) { setFsEnabled(s.enabled); setFsTime(s.time); setFsDays(s.days ?? [1, 2, 3, 4, 5]); setFsLast(s.last ?? ''); }
      } else {
        setFsEnabled(localStorage.getItem(FS_ENABLED_KEY) === '1');
        setFsTime(localStorage.getItem(FS_TIME_KEY) ?? '20:00');
        const dr = localStorage.getItem(FS_DAYS_KEY);
        setFsDays(dr ? dr.split(',').map(Number) : [1, 2, 3, 4, 5]);
        setFsLast(localStorage.getItem(FS_LAST_KEY) ?? '');
      }
      setFsXls(localStorage.getItem(FS_XLS_KEY) === '1');
      setLoading(false);
    })();
  }, [isElectronApp]);

  async function pickFolder(key: string, label: string) {
    if (!isElectronApp) return;
    const res = await (window as any).electronAPI.pickFolder(`Scegli cartella per: ${label}`);
    if (res.ok && res.folder) {
      const np = { ...paths, [key]: res.folder };
      setPaths(np);
      await (window as any).electronAPI.setFilePaths(np);
      showFlash('Cartella aggiornata');
    }
  }

  async function clearFolder(key: string) {
    if (!isElectronApp) return;
    const np = { ...paths, [key]: '' };
    setPaths(np);
    await (window as any).electronAPI.setFilePaths(np);
  }

  function toggleDay(d: number) {
    setFsDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort());
  }

  async function saveSched() {
    setSaving(true);
    if (isElectronApp) {
      await (window as any).electronAPI.setFichesSched({ enabled: fsEnabled, time: fsTime, days: fsDays, last: '' });
    } else {
      localStorage.setItem(FS_ENABLED_KEY, fsEnabled ? '1' : '0');
      localStorage.setItem(FS_TIME_KEY, fsTime);
      localStorage.setItem(FS_DAYS_KEY, fsDays.join(','));
    }
    localStorage.setItem(FS_XLS_KEY, fsXls ? '1' : '0');
    setSaving(false);
    showFlash('Impostazioni salvate');
  }

  function showFlash(msg: string) { setFlash(msg); setTimeout(() => setFlash(null), 3000); }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      {/* Header */}
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
          <p className="text-sm text-amber-700">Nella versione web le cartelle non sono selezionabili. I file vengono scaricati tramite il browser. Puoi comunque configurare l'orario di salvataggio automatico.</p>
        </div>
      )}

      {!loading && (
        <>
          {/* Cartelle generali */}
          {isElectronApp && (
            <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-stone-100">
                <h3 className="font-semibold text-stone-800 text-sm">Cartelle generali</h3>
                <p className="text-xs text-stone-400 mt-0.5">Cartella di destinazione per ogni tipo di file.</p>
              </div>
              <div className="divide-y divide-stone-100">
                {CARTELLE_GENERALI.map(c => (
                  <PathRow key={c.key} label={c.label} desc={c.desc} path={paths[c.key] ?? ''}
                    onPick={() => pickFolder(c.key, c.label)}
                    onOpen={() => (window as any).electronAPI.showFolder(paths[c.key])}
                    onClear={() => clearFolder(c.key)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Cartelle fiches — accordion */}
          {isElectronApp && (
            <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
              <button
                onClick={() => setFichesOpen(v => !v)}
                className="w-full flex items-center justify-between px-6 py-4 hover:bg-stone-50 transition-colors"
              >
                <div className="text-left">
                  <h3 className="font-semibold text-stone-800 text-sm">Fiches</h3>
                  <p className="text-xs text-stone-400 mt-0.5">Cartelle PDF ed Excel per fiches (manuale e automatico)</p>
                </div>
                <ChevronDown size={16} className={`text-stone-400 transition-transform ${fichesOpen ? 'rotate-180' : ''}`} />
              </button>
              {fichesOpen && (
                <div className="divide-y divide-stone-100 border-t border-stone-100">
                  {CARTELLE_FICHES.map(c => (
                    <PathRow key={c.key} label={c.label} desc={c.desc} path={paths[c.key] ?? ''}
                      onPick={() => pickFolder(c.key, c.label)}
                      onOpen={() => (window as any).electronAPI.showFolder(paths[c.key])}
                      onClear={() => clearFolder(c.key)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Salvataggio automatico fiches — stile backup */}
          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-stone-100">
              <h3 className="font-semibold text-stone-800 text-sm">Salvataggio automatico fiches</h3>
              <p className="text-xs text-stone-400 mt-0.5">Genera PDF (ed Excel) con le fiches del giorno all'orario impostato. Recupera automaticamente i giorni mancanti alla riapertura.</p>
            </div>
            <div className="px-6 py-5 space-y-5">

              {/* Toggle abilitato */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
                    <CalendarDays size={16} className="text-amber-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-stone-800">Salvataggio automatico fiches</p>
                    <p className="text-xs text-stone-400 mt-0.5">{isElectronApp ? "L'app deve essere aperta o nel tray" : 'La pagina deve essere aperta nel browser'}</p>
                  </div>
                </div>
                <Toggle on={fsEnabled} onToggle={() => setFsEnabled(v => !v)} />
              </div>

              {/* Toggle Excel */}
              <div className="flex items-center justify-between gap-4 py-3 border-t border-stone-100">
                <div>
                  <p className="text-sm font-semibold text-stone-800">Includi file Excel</p>
                  <p className="text-xs text-stone-400 mt-0.5">Oltre al PDF genera anche il file Excel (.xls) in formato italiano</p>
                </div>
                <Toggle on={fsXls} onToggle={() => setFsXls(v => !v)} />
              </div>

              {/* Orario */}
              <div className="border-t border-stone-100 pt-4">
                <div className="flex items-center gap-2 mb-3">
                  <Clock size={14} className="text-stone-400" />
                  <span className="text-sm font-semibold text-stone-700">Orario del salvataggio</span>
                </div>
                <input
                  type="time"
                  value={fsTime}
                  onChange={e => setFsTime(e.target.value)}
                  className="border border-stone-200 rounded-lg px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-300 w-36"
                />
                <p className="text-xs text-stone-400 mt-2">Il salvataggio avviene all'orario impostato se il programma è aperto, oppure al primo avvio dopo quell'ora.</p>
              </div>

              {/* Giorni della settimana */}
              <div className="border-t border-stone-100 pt-4">
                <div className="flex items-center gap-2 mb-3">
                  <CalendarDays size={14} className="text-stone-400" />
                  <span className="text-sm font-semibold text-stone-700">Giorni della settimana</span>
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  {GIORNI_SETTIMANA.map(g => (
                    <button key={g.value} onClick={() => toggleDay(g.value)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${fsDays.includes(g.value) ? 'bg-amber-500 text-white' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'}`}>
                      {g.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Ultimo salvataggio */}
              {fsLast && (
                <p className="text-xs text-emerald-600 flex items-center gap-1.5 border-t border-stone-100 pt-3">
                  <Check size={13} /> Ultimo salvataggio automatico: {fsLast}
                </p>
              )}

              {/* Salva */}
              <button onClick={saveSched} disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-semibold text-sm rounded-xl transition-colors">
                {saving ? <RefreshCw size={14} className="animate-spin" /> : <Settings size={14} />}
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

// ─── PaginaMessaggiClienti ─────────────────────────────────────────────────────

function PaginaMessaggiClienti({ onBack, userId }: { onBack: () => void; userId: string | undefined }) {
  const [pwd, setPwd] = useState('');
  const [pwdNew, setPwdNew] = useState('');
  const [pwdConfirm, setPwdConfirm] = useState('');
  const [pwdError, setPwdError] = useState('');
  const [pwdFlash, setPwdFlash] = useState('');
  const [showPwdVis, setShowPwdVis] = useState(false);

  const [deleteAllPwd, setDeleteAllPwd] = useState('');
  const [deleteAllError, setDeleteAllError] = useState('');
  const [deleteAllFlash, setDeleteAllFlash] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    getImpostazione('password_messaggi_clienti').then(v => {
      if (v) setPwd(v);
    });
  }, []);

  async function savePwd() {
    if (!pwdNew.trim()) { setPwdError('Inserisci una nuova password'); return; }
    if (pwdNew !== pwdConfirm) { setPwdError('Le password non coincidono'); return; }
    await setImpostazione('password_messaggi_clienti', pwdNew.trim(), userId);
    setPwd(pwdNew.trim());
    setPwdNew('');
    setPwdConfirm('');
    setPwdError('');
    setPwdFlash('Password aggiornata');
    setTimeout(() => setPwdFlash(''), 3000);
  }

  async function deleteAll() {
    const correct = pwd || '1234';
    if (deleteAllPwd !== correct) { setDeleteAllError('Password non corretta'); return; }
    setDeleting(true);
    try {
      await supabase.from('messaggi_clienti').delete().eq('user_id', userId ?? '');
      setDeleteAllFlash('Tutti i messaggi sono stati eliminati');
      setDeleteAllPwd('');
      setDeleteAllError('');
      setTimeout(() => setDeleteAllFlash(''), 4000);
    } catch {
      setDeleteAllError('Errore durante l\'eliminazione');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <button onClick={onBack} className="p-2 rounded-xl hover:bg-stone-100 transition-colors">
          <ArrowLeft size={18} className="text-stone-500" />
        </button>
        <div>
          <h2 className="text-xl font-bold text-stone-800">Messaggi Clienti</h2>
          <p className="text-sm text-stone-400">Gestione password e cancellazione globale</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6 space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-9 h-9 bg-sky-100 rounded-xl flex items-center justify-center">
            <Lock size={16} className="text-sky-600" />
          </div>
          <div>
            <p className="font-semibold text-stone-800">Password eliminazione messaggi</p>
            <p className="text-xs text-stone-400">Gestione password e cancellazione globale</p>
          </div>
        </div>

        {pwdError && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-2">{pwdError}</p>}
        {pwdFlash && <p className="text-sm text-emerald-600 bg-emerald-50 rounded-xl px-4 py-2 flex items-center gap-1.5"><Check size={14} />{pwdFlash}</p>}

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1.5">Nuova password</label>
            <div className="relative">
              <input
                type={showPwdVis ? 'text' : 'password'}
                value={pwdNew}
                onChange={e => setPwdNew(e.target.value)}
                placeholder="Nuova password..."
                className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-sky-400 pr-10"
              />
              <button onClick={() => setShowPwdVis(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400">
                {showPwdVis ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1.5">Conferma nuova password</label>
            <input
              type={showPwdVis ? 'text' : 'password'}
              value={pwdConfirm}
              onChange={e => setPwdConfirm(e.target.value)}
              placeholder="Ripeti la password..."
              className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-sky-400"
            />
          </div>
          <button
            onClick={savePwd}
            className="w-full py-3 bg-sky-500 text-white font-semibold rounded-xl hover:bg-sky-600 transition-colors flex items-center justify-center gap-2"
          >
            <Check size={15} /> Salva nuova password
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-red-200 shadow-sm p-6 space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-9 h-9 bg-red-100 rounded-xl flex items-center justify-center">
            <Trash2 size={16} className="text-red-500" />
          </div>
          <div>
            <p className="font-semibold text-stone-800">Elimina tutti i messaggi</p>
            <p className="text-xs text-stone-400">Cancella lo schedario messaggi e foto di tutte le clienti</p>
          </div>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <p className="text-sm text-red-700">Questa operazione è irreversibile. Tutti i messaggi e le foto inviate dalle clienti saranno eliminati definitivamente.</p>
        </div>

        {deleteAllError && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-2">{deleteAllError}</p>}
        {deleteAllFlash && <p className="text-sm text-emerald-600 bg-emerald-50 rounded-xl px-4 py-2 flex items-center gap-1.5"><Check size={14} />{deleteAllFlash}</p>}

        <div>
          <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1.5">Inserisci la password per confermare</label>
          <input
            type="password"
            value={deleteAllPwd}
            onChange={e => setDeleteAllPwd(e.target.value)}
            placeholder="Password..."
            className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-red-400"
          />
        </div>
        <button
          onClick={deleteAll}
          disabled={deleting}
          className="w-full py-3 bg-red-500 text-white font-semibold rounded-xl hover:bg-red-600 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {deleting ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Trash2 size={15} /> Elimina tutti i messaggi</>}
        </button>
      </div>
    </div>
  );
}

// ─── Pagina Messaggi WA Carte da Donare ──────────────────────────────────────

function PaginaWACarte({ onBack }: { onBack: () => void }) {
  const { user } = useAuth();
  type WaTab = 'gp_salone' | 'gp_cliente' | 'cs_dona';

  const [tab, setTab] = useState<WaTab>('gp_salone');
  const [tplGpSalone, setTplGpSalone] = useState('');
  const [tplGpCliente, setTplGpCliente] = useState('');
  const [tplCsDona, setTplCsDona] = useState('');
  const [includiMappa, setIncludiMappa] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    Promise.all([
      getImpostazione('wa_template_gp_salone'),
      getImpostazione('wa_template_gp_cliente'),
      getImpostazione('wa_template_cs_dona'),
      getImpostazione('wa_includi_mappa'),
    ]).then(([gs, gc, cs, im]) => {
      setTplGpSalone(gs ?? DEFAULT_WA_GP_SALONE);
      setTplGpCliente(gc ?? DEFAULT_WA_GP_CLIENTE);
      setTplCsDona(cs ?? DEFAULT_WA_CS_DONA);
      setIncludiMappa(im === 'true');
    });
  }, []);

  async function save() {
    setSaving(true);
    await Promise.all([
      setImpostazione('wa_template_gp_salone', tplGpSalone, user?.id),
      setImpostazione('wa_template_gp_cliente', tplGpCliente, user?.id),
      setImpostazione('wa_template_cs_dona', tplCsDona, user?.id),
      setImpostazione('wa_includi_mappa', includiMappa ? 'true' : 'false', user?.id),
    ]);
    setSaving(false);
    setFeedback('Salvato!');
    setTimeout(() => setFeedback(''), 2500);
  }

  const TABS: { key: WaTab; label: string; hint: string; placeholders: string[] }[] = [
    {
      key: 'gp_salone',
      label: 'Gift Pass · Dal salone',
      hint: 'Inviato dal gestionale alla destinataria del regalo',
      placeholders: ['{nome_salone}', '{codice}', '{telefono}', '{sito}', '{valore}', '{destinataria}', '{donante}'],
    },
    {
      key: 'gp_cliente',
      label: 'Gift Pass · Dalla cliente',
      hint: "Messaggio che la donatrice invia da sola all'amica",
      placeholders: ['{nome_salone}', '{codice}', '{telefono}', '{sito}', '{valore}'],
    },
    {
      key: 'cs_dona',
      label: 'Carta Sconto · Donazione',
      hint: 'Messaggio per donare la carta sconto monouso',
      placeholders: ['{nome_salone}', '{codice}', '{telefono}', '{sito}', '{sconto}'],
    },
  ];

  const currentTab = TABS.find(t => t.key === tab)!;
  const currentText = tab === 'gp_salone' ? tplGpSalone : tab === 'gp_cliente' ? tplGpCliente : tplCsDona;
  const setCurrentText = tab === 'gp_salone' ? setTplGpSalone : tab === 'gp_cliente' ? setTplGpCliente : setTplCsDona;
  const defaultText = tab === 'gp_salone' ? DEFAULT_WA_GP_SALONE : tab === 'gp_cliente' ? DEFAULT_WA_GP_CLIENTE : DEFAULT_WA_CS_DONA;

  function insertPlaceholder(p: string) {
    const ta = document.getElementById('wa-tpl-textarea') as HTMLTextAreaElement | null;
    if (!ta) { setCurrentText(prev => prev + p); return; }
    const start = ta.selectionStart ?? currentText.length;
    const end = ta.selectionEnd ?? currentText.length;
    const next = currentText.slice(0, start) + p + currentText.slice(end);
    setCurrentText(next);
    setTimeout(() => { ta.focus(); ta.setSelectionRange(start + p.length, start + p.length); }, 0);
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 hover:bg-stone-100 rounded-xl transition-colors">
          <ArrowLeft size={18} className="text-stone-600" />
        </button>
        <div>
          <h2 className="text-lg font-bold text-stone-800">Messaggi WA Carte da Donare</h2>
          <p className="text-xs text-stone-400">Personalizza i testi WhatsApp per i regali</p>
        </div>
      </div>

      {/* Toggle includi mappa */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
            <MapPin size={16} className="text-emerald-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-stone-800">Includi link mappa in fondo</p>
            <p className="text-xs text-stone-400 mt-0.5">Aggiunge il link Google Maps (Dati Azienda) alla fine del messaggio</p>
          </div>
        </div>
        <button
          onClick={() => setIncludiMappa(v => !v)}
          className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${includiMappa ? 'bg-emerald-500' : 'bg-stone-200'}`}
        >
          <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${includiMappa ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </button>
      </div>

      {/* Editor template */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="flex border-b border-stone-100">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 py-3 text-xs font-semibold transition-colors ${
                tab === t.key
                  ? 'text-emerald-700 border-b-2 border-emerald-500 bg-emerald-50/60'
                  : 'text-stone-500 hover:text-stone-700 hover:bg-stone-50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-5 space-y-4">
          <p className="text-xs text-stone-400 italic">{currentTab.hint}</p>

          <div>
            <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">Segnaposti — clicca per inserire nel testo</p>
            <div className="flex flex-wrap gap-1.5">
              {currentTab.placeholders.map(p => (
                <button
                  key={p}
                  onClick={() => insertPlaceholder(p)}
                  className="px-2.5 py-1 bg-stone-100 hover:bg-emerald-100 text-stone-600 hover:text-emerald-700 rounded-lg text-xs font-mono transition-colors border border-transparent hover:border-emerald-200"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <textarea
            id="wa-tpl-textarea"
            value={currentText}
            onChange={e => setCurrentText(e.target.value)}
            rows={14}
            className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm text-stone-700 leading-relaxed focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 resize-none font-mono transition-colors"
            placeholder="Scrivi il messaggio..."
          />

          <button
            onClick={() => setCurrentText(defaultText)}
            className="text-xs text-stone-400 hover:text-stone-600 flex items-center gap-1.5 transition-colors"
          >
            <RotateCcw size={11} />
            Ripristina testo predefinito per questa scheda
          </button>
        </div>
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-2xl transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
      >
        {saving
          ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          : <Check size={16} />}
        {feedback || 'Salva tutte le modifiche'}
      </button>
    </div>
  );
}

// ─── Benvenuto Nuove Clienti ──────────────────────────────────────────────────

function PaginaBenvenuto({ onBack }: { onBack: () => void }) {
  const { user } = useAuth();
  const [cfg, setCfg] = useState<BenvenutoConfig>(BENVENUTO_DEFAULT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!user) return;
    getImpostazione('benvenuto_config_json').then(val => {
      if (val) {
        try { setCfg(JSON.parse(val)); } catch {}
      }
      setLoading(false);
    });
  }, [user]);

  function updateVantaggio(i: number, field: 'label' | 'testo', value: string) {
    setCfg(prev => {
      const v = [...prev.vantaggi];
      v[i] = { ...v[i], [field]: value };
      return { ...prev, vantaggi: v };
    });
  }

  async function handleSave() {
    setSaving(true);
    await setImpostazione('benvenuto_config_json', JSON.stringify(cfg), user?.id);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-7 h-7 border-2 border-rose-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 hover:bg-stone-100 rounded-xl transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h2 className="text-xl font-bold text-stone-800">Benvenuto Nuove Clienti</h2>
          <p className="text-sm text-stone-400 mt-0.5">Personalizza il messaggio mostrato alla prima visita</p>
        </div>
      </div>

      <div className="bg-rose-50 border border-rose-200 rounded-2xl px-5 py-3.5 flex items-start gap-3">
        <Sparkles size={15} className="text-rose-500 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-rose-700 leading-relaxed">
          Il titolo <strong>"✨ Finalmente sei qui, [Nome]!"</strong> è fisso. Nei testi intro puoi usare <code className="bg-rose-100 px-1 rounded text-rose-800">&lt;strong&gt;parola&lt;/strong&gt;</code> per il grassetto.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5 space-y-3">
        <p className="text-sm font-semibold text-stone-800">Primo paragrafo</p>
        <textarea
          value={cfg.intro1}
          onChange={e => setCfg(p => ({ ...p, intro1: e.target.value }))}
          rows={3}
          className="w-full text-sm border border-stone-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-400 text-stone-700 placeholder-stone-300 resize-none transition-colors"
        />
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5 space-y-3">
        <p className="text-sm font-semibold text-stone-800">Secondo paragrafo</p>
        <textarea
          value={cfg.intro2}
          onChange={e => setCfg(p => ({ ...p, intro2: e.target.value }))}
          rows={2}
          className="w-full text-sm border border-stone-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-400 text-stone-700 placeholder-stone-300 resize-none transition-colors"
        />
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5 space-y-4">
        <p className="text-sm font-semibold text-stone-800">Le 5 voci dei vantaggi</p>
        {cfg.vantaggi.slice(0, 5).map((v, i) => (
          <div key={i} className="space-y-2 pb-4 border-b border-stone-100 last:border-0 last:pb-0">
            <p className="text-xs font-medium text-stone-500 uppercase tracking-wide">Voce {i + 1}</p>
            <input
              type="text"
              value={v.label}
              onChange={e => updateVantaggio(i, 'label', e.target.value)}
              placeholder="Titolo in grassetto"
              className="w-full text-sm border border-stone-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-400 text-stone-700 placeholder-stone-300 transition-colors"
            />
            <textarea
              value={v.testo}
              onChange={e => updateVantaggio(i, 'testo', e.target.value)}
              rows={2}
              placeholder="Descrizione"
              className="w-full text-sm border border-stone-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-400 text-stone-700 placeholder-stone-300 resize-none transition-colors"
            />
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5 space-y-3">
        <p className="text-sm font-semibold text-stone-800">Frase di chiusura</p>
        <textarea
          value={cfg.chiusura}
          onChange={e => setCfg(p => ({ ...p, chiusura: e.target.value }))}
          rows={2}
          className="w-full text-sm border border-stone-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-400 text-stone-700 placeholder-stone-300 resize-none transition-colors"
        />
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5 space-y-3">
        <p className="text-sm font-semibold text-stone-800">Testo del pulsante</p>
        <input
          type="text"
          value={cfg.cta}
          onChange={e => setCfg(p => ({ ...p, cta: e.target.value }))}
          className="w-full text-sm border border-stone-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-400 text-stone-700 placeholder-stone-300 transition-colors"
        />
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => setCfg(BENVENUTO_DEFAULT)}
          className="flex items-center gap-2 px-4 py-3 rounded-2xl border border-stone-200 text-stone-500 hover:bg-stone-50 text-sm font-medium transition-colors"
        >
          <RotateCcw size={14} />
          Ripristina originale
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white font-semibold text-sm shadow-sm transition-all"
        >
          {saved ? <Check size={16} /> : <Sparkles size={16} />}
          {saving ? 'Salvataggio...' : saved ? 'Salvato!' : 'Salva messaggio'}
        </button>
      </div>
    </div>
  );
}
