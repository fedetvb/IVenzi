import { useState, useEffect, useRef } from 'react';
import type { User } from '@supabase/supabase-js';
import {
  Calendar,
  Users,
  LayoutDashboard,
  Scissors,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  BarChart2,
  MessageSquare,
  Settings,
  FileText,
  Wallet,
  CreditCard,
  ShoppingBag,
  Package,
  UserCog,
  TrendingDown,
  LogOut,
  Trash2,
  BookOpen,
  Download,
  Wifi,
  WifiOff,
  RefreshCw,
  Check,
} from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';
import { onOfflineStateChange, type SyncState } from '../lib/offlineFetch';

interface PingLogRow {
  eseguito_at: string;
  tipo: string;
}

type Page = 'dashboard' | 'agenda' | 'clienti' | 'servizi' | 'fiches' | 'finanze' | 'gestione_finanziaria' | 'statistiche' | 'comunicazioni' | 'impostazioni' | 'carte' | 'rivendita' | 'magazzino' | 'parrucchieri' | 'cestino' | 'guida';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface LayoutProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  children: React.ReactNode;
  user: User | null;
}

const navItems = [
  { id: 'dashboard' as Page, label: 'Dashboard', icon: LayoutDashboard },
  { id: 'agenda' as Page, label: 'Agenda', icon: Calendar },
  { id: 'clienti' as Page, label: 'Clienti', icon: Users },
  { id: 'servizi' as Page, label: 'Servizi e Prodotti', icon: Scissors },
  { id: 'parrucchieri' as Page, label: 'Parrucchieri', icon: UserCog },
  { id: 'fiches' as Page, label: 'Fiches', icon: FileText },
  { id: 'carte' as Page, label: 'Carte', icon: CreditCard },
  { id: 'rivendita' as Page, label: 'Rivendita', icon: ShoppingBag },
  { id: 'finanze' as Page, label: 'Finanze', icon: Wallet },
  { id: 'gestione_finanziaria' as Page, label: 'Entrate & Uscite', icon: TrendingDown },
  { id: 'statistiche' as Page, label: 'Statistiche', icon: BarChart2 },
  { id: 'comunicazioni' as Page, label: 'Comunicazioni', icon: MessageSquare },
  { id: 'magazzino' as Page, label: 'Magazzino', icon: Package },
  { id: 'impostazioni' as Page, label: 'Impostazioni', icon: Settings },
  { id: 'cestino' as Page, label: 'Cestino', icon: Trash2 },
  { id: 'guida' as Page, label: 'Guida', icon: BookOpen },
];

function isMobile() {
  return window.innerWidth < 768;
}

function NavTooltipButton({
  id,
  label,
  icon: Icon,
  active,
  collapsed,
  onClick,
}: {
  id: string;
  label: string;
  icon: React.ElementType;
  active: boolean;
  collapsed: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [tooltipY, setTooltipY] = useState(0);
  const ref = useRef<HTMLButtonElement>(null);

  function handleMouseEnter() {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setTooltipY(rect.top + rect.height / 2);
    }
    setHovered(true);
  }

  return (
    <div className="relative">
      <button
        ref={ref}
        key={id}
        onClick={onClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setHovered(false)}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm font-medium ${
          active
            ? 'bg-black text-white'
            : 'text-stone-400 hover:bg-stone-800 hover:text-white'
        }`}
      >
        <Icon size={18} className="flex-shrink-0" />
        {!collapsed && <span>{label}</span>}
      </button>

      {/* Tooltip — only when collapsed on desktop */}
      {collapsed && hovered && (
        <div
          className="fixed z-[200] pointer-events-none"
          style={{ top: tooltipY, transform: 'translateY(-50%)', left: 72 }}
        >
          <div className="bg-stone-800 text-white text-xs font-medium px-3 py-1.5 rounded-lg shadow-lg whitespace-nowrap border border-stone-700">
            {label}
          </div>
        </div>
      )}
    </div>
  );
}

function isTuesdayAfter10Italian() {
  const now = new Date();
  const itStr = now.toLocaleString('en-US', { timeZone: 'Europe/Rome', hour12: false, weekday: 'short', hour: 'numeric' });
  // itStr es: "Tue 10" or "Tue 14"
  const parts = itStr.split(' ');
  const weekday = parts[0];
  const hour = parseInt(parts[1], 10);
  return weekday === 'Tue' && hour >= 10;
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export default function Layout({ currentPage, onNavigate, children, user }: LayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobile, setMobile] = useState(() => isMobile());
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const { signOut } = useAuth();
  const [installPrompt, setInstallPrompt] = useState<Event | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const [pingBanner, setPingBanner] = useState<PingLogRow[] | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncState, setSyncState] = useState<SyncState>('idle');

  useEffect(() => {
    return onOfflineStateChange((online, pending, state) => {
      setIsOnline(online);
      setPendingCount(pending);
      setSyncState(state);
    });
  }, []);

  useEffect(() => {
    const onResize = () => setMobile(isMobile());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    if (userMenuOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [userMenuOpen]);

  function handleNavigate(page: Page) {
    onNavigate(page);
    if (mobile) setMobileOpen(false);
  }

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => setIsInstalled(true));
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  useEffect(() => {
    if (!isTuesdayAfter10Italian()) return;
    const dismissedKey = `keepalive_banner_dismissed_${todayKey()}`;
    if (localStorage.getItem(dismissedKey)) return;

    const since = new Date();
    since.setDate(since.getDate() - 7);
    supabase
      .from('keep_alive_ping_log')
      .select('eseguito_at, tipo')
      .gte('eseguito_at', since.toISOString())
      .order('eseguito_at', { ascending: false })
      .then(({ data }) => {
        if (data && data.length > 0) setPingBanner(data as PingLogRow[]);
      });
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    (installPrompt as BeforeInstallPromptEvent).prompt();
    const { outcome } = await (installPrompt as BeforeInstallPromptEvent).userChoice;
    if (outcome === 'accepted') setIsInstalled(true);
    setInstallPrompt(null);
  };

  const userInitials = user?.email ? user.email.slice(0, 2).toUpperCase() : '??';
  const userEmail = user?.email ?? '';

  const sidebarContent = (showLabels: boolean, isMobileDrawer = false) => (
    <>
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-stone-700 flex-shrink-0">
        <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center flex-shrink-0">
          <Scissors size={16} className="text-white" />
        </div>
        {showLabels && (
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm tracking-wide text-white">Salone</p>
            <p className="text-xs text-amber-400 font-medium">Gestionale</p>
          </div>
        )}
        {isMobileDrawer && (
          <button onClick={() => setMobileOpen(false)} className="ml-auto p-1 text-stone-400 hover:text-white">
            <X size={18} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-4 space-y-1">
        {navItems.map(({ id, label, icon: Icon }) => (
          <NavTooltipButton
            key={id}
            id={id}
            label={label}
            icon={Icon}
            active={currentPage === id}
            collapsed={!showLabels}
            onClick={() => handleNavigate(id)}
          />
        ))}
      </nav>

      {/* Collapse button — desktop only */}
      {!isMobileDrawer && (
        <div className="px-2 pb-4 flex-shrink-0 border-t border-stone-700 pt-3">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-stone-400 hover:bg-stone-800 hover:text-white transition-all text-sm"
          >
            {collapsed ? <ChevronRight size={16} /> : <><ChevronLeft size={16} /><span>Comprimi</span></>}
          </button>
        </div>
      )}
    </>
  );

  return (
    <div className="flex h-screen bg-stone-50 font-sans">

      {/* Desktop sidebar */}
      {!mobile && (
        <aside
          className={`hidden md:flex flex-col bg-stone-900 text-stone-100 transition-all duration-300 min-h-0 flex-shrink-0 ${
            collapsed ? 'w-16' : 'w-60'
          }`}
        >
          {sidebarContent(!collapsed, false)}
        </aside>
      )}

      {/* Mobile overlay sidebar */}
      {mobile && (
        <>
          {mobileOpen && (
            <div
              className="fixed inset-0 bg-black/50 z-40"
              onClick={() => setMobileOpen(false)}
            />
          )}
          <aside
            className={`fixed top-0 left-0 h-full w-64 bg-stone-900 text-stone-100 flex flex-col z-50 transition-transform duration-300 min-h-0 ${
              mobileOpen ? 'translate-x-0' : '-translate-x-full'
            }`}
          >
            {sidebarContent(true, true)}
          </aside>
        </>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="bg-white border-b border-stone-200 px-4 sm:px-6 py-2 md:py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => mobile ? setMobileOpen(true) : setCollapsed(!collapsed)}
              className="text-stone-500 hover:text-stone-800"
            >
              <Menu size={20} />
            </button>
            <h1 className="text-lg font-semibold text-stone-800">
              {navItems.find(n => n.id === currentPage)?.label}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            {/* Online/offline status dot */}
            <div
              title={isOnline ? (pendingCount > 0 ? `${pendingCount} modifiche offline in attesa` : 'Online') : 'Offline'}
              className={`w-2 h-2 rounded-full flex-shrink-0 ${isOnline ? (pendingCount > 0 ? 'bg-amber-400' : 'bg-emerald-400') : 'bg-red-400'}`}
            />

            {!isInstalled && installPrompt && (
              <button
                onClick={handleInstall}
                className="flex items-center gap-2 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <Download size={15} />
                <span className="hidden sm:inline">Installa App</span>
              </button>
            )}

            {/* User menu */}
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-stone-100 transition-colors"
              >
                <div className="w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                  {userInitials}
                </div>
                <span className="text-sm text-stone-600 font-medium hidden sm:block max-w-[140px] truncate">{userEmail}</span>
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-xl shadow-lg border border-stone-200 py-1 z-50">
                  <div className="px-4 py-2 border-b border-stone-100">
                    <p className="text-xs text-stone-400 truncate">{userEmail}</p>
                  </div>
                  <button
                    onClick={() => { setUserMenuOpen(false); signOut(); }}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <LogOut size={15} />
                    Esci
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Banner riepilogo ping settimanale — martedi >= 10:00 italiane */}
        {pingBanner && (
          <div className="bg-emerald-50 border-b border-emerald-200 px-4 sm:px-6 py-3 flex items-start gap-3 flex-shrink-0">
            <div className="w-7 h-7 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
              <Wifi size={14} className="text-emerald-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-emerald-800">
                Riepilogo settimanale keep-alive
              </p>
              <p className="text-xs text-emerald-600 mt-0.5">
                {pingBanner.length} ping eseguiti negli ultimi 7 giorni:&nbsp;
                {pingBanner.map((p, i) => (
                  <span key={i}>
                    <span className={`font-medium ${p.tipo === 'automatico' ? 'text-sky-700' : 'text-amber-700'}`}>
                      {new Date(p.eseguito_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      {' '}({p.tipo})
                    </span>
                    {i < pingBanner.length - 1 ? ', ' : ''}
                  </span>
                ))}
              </p>
            </div>
            <button
              onClick={() => {
                localStorage.setItem(`keepalive_banner_dismissed_${todayKey()}`, '1');
                setPingBanner(null);
              }}
              className="text-emerald-500 hover:text-emerald-700 flex-shrink-0 mt-0.5"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Offline banner */}
        {!isOnline && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 sm:px-6 py-2.5 flex items-center gap-3 flex-shrink-0">
            <div className="w-6 h-6 bg-amber-100 rounded-md flex items-center justify-center flex-shrink-0">
              <WifiOff size={13} className="text-amber-600" />
            </div>
            <p className="text-sm text-amber-800 font-medium flex-1">
              Modalita' offline — i dati mostrati sono quelli salvati localmente.
              {pendingCount > 0 && (
                <span className="ml-1 text-amber-700">
                  {pendingCount} {pendingCount === 1 ? 'modifica in attesa' : 'modifiche in attesa'} di sincronizzazione.
                </span>
              )}
            </p>
          </div>
        )}

        {/* Sync in progress banner */}
        {isOnline && syncState === 'syncing' && (
          <div className="bg-sky-50 border-b border-sky-200 px-4 sm:px-6 py-2 flex items-center gap-3 flex-shrink-0">
            <RefreshCw size={14} className="text-sky-600 animate-spin flex-shrink-0" />
            <p className="text-sm text-sky-700">Sincronizzazione modifiche offline in corso...</p>
          </div>
        )}

        {/* Sync error banner */}
        {isOnline && syncState === 'error' && pendingCount > 0 && (
          <div className="bg-red-50 border-b border-red-200 px-4 sm:px-6 py-2 flex items-center gap-3 flex-shrink-0">
            <WifiOff size={14} className="text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-700">
              Impossibile sincronizzare {pendingCount} {pendingCount === 1 ? 'modifica' : 'modifiche'}. Riprovera' automaticamente.
            </p>
          </div>
        )}

        {/* Content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
