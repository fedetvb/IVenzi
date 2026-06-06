/**
 * Theme preferences stored per-device in localStorage.
 * The salon logo is stored in Supabase Storage (shared across devices)
 * with a base64 cache in localStorage for offline use.
 */

export interface ThemeSettings {
  sidebarBg: string;   // hex color
  accentColor: string; // hex color
  sidebarIcon: string; // lucide icon name
  logoUrl: string;     // Supabase Storage URL (empty = use icon)
}

const LS_THEME = 'salone_theme_v1';
const LS_LOGO_CACHE = 'salone_logo_b64';

export const THEME_DEFAULTS: ThemeSettings = {
  sidebarBg: '#1c1917',
  accentColor: '#f59e0b',
  sidebarIcon: 'Scissors',
  logoUrl: '',
};

export const SIDEBAR_PRESETS = [
  { label: 'Carbone', value: '#1c1917' },
  { label: 'Grafite', value: '#18181b' },
  { label: 'Ardesia', value: '#0f172a' },
  { label: 'Notte', value: '#111827' },
  { label: 'Muschio', value: '#14241a' },
  { label: 'Marina', value: '#0c1a2e' },
  { label: 'Prugna', value: '#1e0a2e' },
  { label: 'Mogano', value: '#1f1009' },
];

export const ACCENT_PRESETS = [
  { label: 'Ambra', value: '#f59e0b' },
  { label: 'Azzurro', value: '#3b82f6' },
  { label: 'Smeraldo', value: '#10b981' },
  { label: 'Corallo', value: '#f43f5e' },
  { label: 'Cielo', value: '#06b6d4' },
  { label: 'Arancio', value: '#f97316' },
  { label: 'Lavanda', value: '#8b5cf6' },
  { label: 'Lima', value: '#84cc16' },
];

export const ICON_PRESETS = [
  'Scissors', 'Star', 'Zap', 'Heart', 'Flame', 'Crown', 'Sparkles', 'Gem',
];

export function getTheme(): ThemeSettings {
  try {
    const raw = localStorage.getItem(LS_THEME);
    return raw ? { ...THEME_DEFAULTS, ...JSON.parse(raw) } : { ...THEME_DEFAULTS };
  } catch {
    return { ...THEME_DEFAULTS };
  }
}

export function saveTheme(patch: Partial<ThemeSettings>): ThemeSettings {
  const next = { ...getTheme(), ...patch };
  localStorage.setItem(LS_THEME, JSON.stringify(next));
  return next;
}

export function getLogoCacheB64(): string {
  return localStorage.getItem(LS_LOGO_CACHE) ?? '';
}

export function saveLogoCacheB64(b64: string) {
  if (b64) localStorage.setItem(LS_LOGO_CACHE, b64);
  else localStorage.removeItem(LS_LOGO_CACHE);
}

export function applyTheme(theme: ThemeSettings) {
  const root = document.documentElement;
  root.style.setProperty('--sidebar-bg', theme.sidebarBg);
  root.style.setProperty('--accent', theme.accentColor);
}

export function dispatchThemeChange() {
  window.dispatchEvent(new Event('themechange'));
}
