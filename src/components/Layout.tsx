import { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { useAuth } from '../lib/AuthContext';

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

export default function Layout({ currentPage, onNavigate, children, user }: LayoutProps) {
  // On desktop: collapsed = sidebar narrow. On mobile: collapsed = sidebar hidden (overlay).
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobile, setMobile] = useState(() => isMobile());
  const { signOut } = useAuth();
  const [installPrompt, setInstallPrompt] = useState<Event | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const onResize = () => setMobile(isMobile());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Close mobile drawer when navigating
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

  const handleInstall = async () => {
    if (!installPrompt) return;
    (installPrompt as BeforeInstallPromptEvent).prompt();
    const { outcome } = await (installPrompt as BeforeInstallPromptEvent).userChoice;
    if (outcome === 'accepted') setIsInstalled(true);
    setInstallPrompt(null);
  };

  const userInitials = user?.email ? user.email.slice(0, 2).toUpperCase() : '??';
  const userEmail = user?.email ?? '';

  const sidebarContent = (showLabels: boolean) => (
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
        {mobile && (
          <button onClick={() => setMobileOpen(false)} className="ml-auto p-1 text-stone-400 hover:text-white">
            <X size={18} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-4 space-y-1">
        {navItems.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => handleNavigate(id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm font-medium ${
              currentPage === id
                ? 'bg-black text-white'
                : 'text-stone-400 hover:bg-stone-800 hover:text-white'
            }`}
          >
            <Icon size={18} className="flex-shrink-0" />
            {showLabels && <span>{label}</span>}
          </button>
        ))}
      </nav>

      {/* User info + logout */}
      <div className="px-2 pb-3 border-t border-stone-700 pt-3 flex-shrink-0">
        {showLabels ? (
          <div className="flex items-center gap-2 px-2 py-2 rounded-lg">
            <div className="w-7 h-7 bg-amber-500 rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-bold">
              {userInitials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-stone-300 truncate">{userEmail}</p>
            </div>
            <button
              onClick={signOut}
              title="Esci"
              className="p-1 rounded-lg text-stone-400 hover:bg-stone-700 hover:text-red-400 transition-colors flex-shrink-0"
            >
              <LogOut size={14} />
            </button>
          </div>
        ) : (
          <button
            onClick={signOut}
            title="Esci"
            className="w-full flex items-center justify-center p-2 rounded-lg text-stone-400 hover:bg-stone-700 hover:text-red-400 transition-colors"
          >
            <LogOut size={16} />
          </button>
        )}
      </div>

      {/* Collapse button — desktop only */}
      {!mobile && (
        <div className="px-2 pb-4 flex-shrink-0">
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
          {sidebarContent(!collapsed)}
        </aside>
      )}

      {/* Mobile overlay sidebar */}
      {mobile && (
        <>
          {/* Backdrop */}
          {mobileOpen && (
            <div
              className="fixed inset-0 bg-black/50 z-40"
              onClick={() => setMobileOpen(false)}
            />
          )}
          {/* Drawer */}
          <aside
            className={`fixed top-0 left-0 h-full w-64 bg-stone-900 text-stone-100 flex flex-col z-50 transition-transform duration-300 min-h-0 ${
              mobileOpen ? 'translate-x-0' : '-translate-x-full'
            }`}
          >
            {sidebarContent(true)}
          </aside>
        </>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="bg-white border-b border-stone-200 px-4 sm:px-6 py-4 flex items-center justify-between flex-shrink-0">
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
            {!isInstalled && installPrompt && (
              <button
                onClick={handleInstall}
                className="flex items-center gap-2 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <Download size={15} />
                <span className="hidden sm:inline">Installa App</span>
              </button>
            )}
            <div className="w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
              {userInitials}
            </div>
            <span className="text-sm text-stone-600 font-medium hidden sm:block">{userEmail}</span>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
