import { createClient } from '@supabase/supabase-js';

const REAL_PROJECT_ID = 'qfpeffzdszdanebmgafb';
const REAL_URL = `https://${REAL_PROJECT_ID}.supabase.co`;
const REAL_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmcGVmZnpkc3pkYW5lYm1nYWZiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0NjI4MDUsImV4cCI6MjA5NTAzODgwNX0.RQ77EhEJxVN02WQWUH9XiBUvRMysxgBVFQSi1UlqhKM';

// GUARDIANO: eventuali override in localStorage vengono accettati solo se puntano al progetto reale.
const LS_URL_KEY = 'sb_custom_url';
const LS_KEY_KEY = 'sb_custom_anon_key';

function guardUrl(stored: string | null): string {
  if (!stored || !stored.includes(REAL_PROJECT_ID)) {
    if (stored) console.error('GUARDIANO: URL Supabase non autorizzato ignorato:', stored);
    return REAL_URL;
  }
  return stored;
}

function guardKey(stored: string | null): string {
  if (!stored || !stored.includes(REAL_PROJECT_ID)) {
    if (stored) console.error('GUARDIANO: Anon key non autorizzata ignorata.');
    return REAL_ANON_KEY;
  }
  return stored;
}

const supabaseUrl = guardUrl(localStorage.getItem(LS_URL_KEY));
const supabaseAnonKey = guardKey(localStorage.getItem(LS_KEY_KEY));

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  global: {
    // Always use the current window.fetch so that the offlineFetch interceptor
    // (which patches window.fetch after module init) is correctly applied.
    fetch: (url: RequestInfo | URL, init?: RequestInit) => window.fetch(url, init),
  },
});

/** Returns today's date as YYYY-MM-DD using local timezone (not UTC). */
export function localDateStr(date: Date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export type StatoAppuntamento = 'confermato' | 'in_attesa' | 'completato' | 'cancellato' | 'in_forse';

export interface Cliente {
  id: string;
  nome: string;
  cognome: string;
  telefono: string;
  email: string;
  data_nascita: string | null;
  note: string;
  foto_url: string;
  in_blacklist: boolean;
  motivo_blacklist: string | null;
  created_at: string;
  updated_at: string;
}

export interface TrattamentoCatalogo {
  id: string;
  nome: string;
  descrizione: string;
  durata_minuti: number;
  prezzo: number;
  colore: string;
  attivo: boolean;
  tipo: 'servizio' | 'trattamento';
  inizio_posa: number | null;
  durata_posa: number | null;
  created_at: string;
}

export interface Appuntamento {
  id: string;
  cliente_id: string | null;
  parrucchiere_id: string | null;
  data_ora: string;
  durata_minuti: number;
  stato: StatoAppuntamento;
  note: string;
  prezzo_totale: number;
  created_at: string;
  updated_at: string;
  nuova_cliente?: boolean;
  clienti?: Cliente;
  parrucchieri?: Parrucchiere;
  appuntamento_trattamenti?: AppuntamentoTrattamento[];
}

export interface AppuntamentoTrattamento {
  id: string;
  appuntamento_id: string;
  trattamento_id: string | null;
  nome_trattamento: string;
  prezzo: number;
  created_at: string;
  trattamenti_catalogo?: TrattamentoCatalogo;
}

export interface SchedaColore {
  id: string;
  cliente_id: string;
  data_trattamento: string;
  formula_colore: string;
  ossidante: string;
  tempo_posa: number;
  note: string;
  colore_base: string;
  colore_target: string;
  tecnica: string;
  foto_prima_url: string;
  foto_dopo_url: string;
  created_at: string;
  updated_at: string;
}

export interface Parrucchiere {
  id: string;
  nome: string;
  colore: string;
  attivo: boolean;
  created_at: string;
}

export interface GiornoParrucchiere {
  id: string;
  data_specifica: string;
  parrucchiere_id: string;
  ordine: number;
  created_at: string;
  parrucchieri?: Parrucchiere;
}
