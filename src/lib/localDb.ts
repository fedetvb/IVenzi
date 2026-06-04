/**
 * Database adapter unificato.
 *
 * - In Electron (window.electronAPI.db disponibile): usa SQLite locale via IPC.
 *   Ogni scrittura viene marcata _dirty=1 e sincronizzata verso Supabase quando online.
 * - In browser / web app: usa Supabase direttamente (comportamento invariato).
 *
 * L'API pubblica imita quella del Supabase JS client per minimizzare le modifiche
 * nelle pagine: ogni funzione ritorna { data, error, count }.
 */

import { supabase } from './supabase';

// ─── Tipi ─────────────────────────────────────────────────────────────────────

export interface DbFilter {
  col: string;
  op: 'eq' | 'neq' | 'gte' | 'lte' | '>' | '<' | 'in' | 'is_null' | 'not_null' | 'like' | '=' | '!=' | '>=' | '<=';
  val?: unknown;
}

export interface DbOrder {
  col: string;
  asc?: boolean;
}

export interface DbResult<T = unknown> {
  data: T | null;
  error: string | null;
  count?: number;
}

// ─── Rilevamento ambiente ─────────────────────────────────────────────────────

export function isElectron(): boolean {
  return typeof window !== 'undefined' && !!window.electronAPI?.db;
}

// ─── Helper: converti booleans SQLite (0/1) in boolean JS ────────────────────

function boolCols(row: Record<string, unknown>): Record<string, unknown> {
  const BOOL_FIELDS = new Set([
    'attivo', 'convalidata', 'manuale', 'nominativa', 'attiva', 'usa_e_getta',
    'ricorrente', 'is_default', '_dirty',
  ]);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    out[k] = BOOL_FIELDS.has(k) && (v === 0 || v === 1) ? v === 1 : v;
  }
  return out;
}

function normRows<T>(rows: unknown): T[] {
  if (!Array.isArray(rows)) return [];
  return rows.map(r => boolCols(r as Record<string, unknown>)) as T[];
}

// ─── SELECT ───────────────────────────────────────────────────────────────────

export async function dbSelect<T = Record<string, unknown>>(args: {
  table: string;
  columns?: string;
  filters?: DbFilter[];
  orderBy?: DbOrder[];
  limit?: number | null;
  countOnly?: boolean;
}): Promise<DbResult<T[]>> {
  if (isElectron()) {
    const res = await window.electronAPI!.db!.select(args);
    if (!res.ok) return { data: null, error: res.error ?? 'Errore DB' };
    if (args.countOnly) return { data: null, error: null, count: res.data as number };
    return { data: normRows<T>(res.data), error: null };
  }

  // Browser: Supabase
  try {
    let q = supabase.from(args.table).select(args.columns || '*');
    for (const f of (args.filters || [])) {
      if (f.op === 'is_null') { q = (q as ReturnType<typeof supabase.from>).is(f.col, null); }
      else if (f.op === 'not_null') { q = (q as ReturnType<typeof supabase.from>).not(f.col, 'is', null); }
      else if (f.op === 'in') { q = (q as ReturnType<typeof supabase.from>).in(f.col, f.val as unknown[]); }
      else if (f.op === 'eq' || f.op === '=') { q = (q as ReturnType<typeof supabase.from>).eq(f.col, f.val); }
      else if (f.op === 'neq' || f.op === '!=') { q = (q as ReturnType<typeof supabase.from>).neq(f.col, f.val); }
      else if (f.op === 'gte' || f.op === '>=') { q = (q as ReturnType<typeof supabase.from>).gte(f.col, f.val); }
      else if (f.op === 'lte' || f.op === '<=') { q = (q as ReturnType<typeof supabase.from>).lte(f.col, f.val); }
      else if (f.op === '>') { q = (q as ReturnType<typeof supabase.from>).gt(f.col, f.val); }
      else if (f.op === '<') { q = (q as ReturnType<typeof supabase.from>).lt(f.col, f.val); }
      else if (f.op === 'like') { q = (q as ReturnType<typeof supabase.from>).like(f.col, f.val as string); }
    }
    for (const o of (args.orderBy || [])) {
      q = (q as ReturnType<typeof supabase.from>).order(o.col, { ascending: o.asc !== false });
    }
    if (args.limit !== undefined && args.limit !== null) {
      q = (q as ReturnType<typeof supabase.from>).limit(args.limit);
    }
    const { data, error, count } = await q;
    return { data: (data as T[]) ?? null, error: error?.message ?? null, count: count ?? undefined };
  } catch (e) {
    return { data: null, error: String(e) };
  }
}

// ─── INSERT ───────────────────────────────────────────────────────────────────

export async function dbInsert<T = Record<string, unknown>>(args: {
  table: string;
  data: Record<string, unknown>;
  userId?: string;
  single?: boolean;
}): Promise<DbResult<T>> {
  if (isElectron()) {
    const res = await window.electronAPI!.db!.insert(args);
    if (!res.ok) return { data: null, error: res.error ?? 'Errore DB' };
    return { data: res.data ? boolCols(res.data as Record<string, unknown>) as T : null, error: null };
  }
  try {
    const { data, error } = await supabase.from(args.table).insert(args.data).select();
    if (error) return { data: null, error: error.message };
    const row = Array.isArray(data) ? data[0] : data;
    return { data: row as T ?? null, error: null };
  } catch (e) {
    return { data: null, error: String(e) };
  }
}

// ─── UPDATE ───────────────────────────────────────────────────────────────────

export async function dbUpdate<T = Record<string, unknown>>(args: {
  table: string;
  id: string;
  data: Record<string, unknown>;
}): Promise<DbResult<T>> {
  if (isElectron()) {
    const res = await window.electronAPI!.db!.update(args);
    if (!res.ok) return { data: null, error: res.error ?? 'Errore DB' };
    return { data: res.data ? boolCols(res.data as Record<string, unknown>) as T : null, error: null };
  }
  try {
    const { data, error } = await supabase.from(args.table).update(args.data).eq('id', args.id).select();
    if (error) return { data: null, error: error.message };
    const row = Array.isArray(data) ? data[0] : data;
    return { data: row as T ?? null, error: null };
  } catch (e) {
    return { data: null, error: String(e) };
  }
}

// ─── DELETE ───────────────────────────────────────────────────────────────────

export async function dbDelete(args: {
  table: string;
  filters: DbFilter[];
}): Promise<DbResult<null>> {
  if (isElectron()) {
    const res = await window.electronAPI!.db!.delete(args);
    if (!res.ok) return { data: null, error: res.error ?? 'Errore DB' };
    return { data: null, error: null };
  }
  try {
    let q = supabase.from(args.table).delete();
    for (const f of args.filters) {
      if (f.op === 'eq' || f.op === '=') q = (q as ReturnType<typeof supabase.from>).eq(f.col, f.val);
      else if (f.op === 'in') q = (q as ReturnType<typeof supabase.from>).in(f.col, f.val as unknown[]);
    }
    const { error } = await q;
    return { data: null, error: error?.message ?? null };
  } catch (e) {
    return { data: null, error: String(e) };
  }
}

// ─── UPSERT ───────────────────────────────────────────────────────────────────

export async function dbUpsert<T = Record<string, unknown>>(args: {
  table: string;
  data: Record<string, unknown>;
  onConflict?: string;
  userId?: string;
}): Promise<DbResult<T>> {
  if (isElectron()) {
    const res = await window.electronAPI!.db!.upsert(args);
    if (!res.ok) return { data: null, error: res.error ?? 'Errore DB' };
    return { data: res.data ? boolCols(res.data as Record<string, unknown>) as T : null, error: null };
  }
  try {
    const q = supabase.from(args.table).upsert(args.data, args.onConflict ? { onConflict: args.onConflict } : undefined);
    const { data, error } = await q.select();
    if (error) return { data: null, error: error.message };
    const row = Array.isArray(data) ? data[0] : data;
    return { data: row as T ?? null, error: null };
  } catch (e) {
    return { data: null, error: String(e) };
  }
}

// ─── UPSERT multiplo (array) ──────────────────────────────────────────────────

export async function dbUpsertMany<T = Record<string, unknown>>(args: {
  table: string;
  rows: Record<string, unknown>[];
  onConflict?: string;
  userId?: string;
}): Promise<DbResult<T[]>> {
  if (isElectron()) {
    const results: T[] = [];
    for (const row of args.rows) {
      const res = await window.electronAPI!.db!.upsert({ table: args.table, data: row, onConflict: args.onConflict, userId: args.userId });
      if (res.ok && res.data) results.push(boolCols(res.data as Record<string, unknown>) as T);
    }
    return { data: results, error: null };
  }
  try {
    const { data, error } = await supabase
      .from(args.table)
      .upsert(args.rows, args.onConflict ? { onConflict: args.onConflict } : undefined)
      .select();
    if (error) return { data: null, error: error.message };
    return { data: (data as T[]) ?? [], error: null };
  } catch (e) {
    return { data: null, error: String(e) };
  }
}

// ─── COUNT ────────────────────────────────────────────────────────────────────

export async function dbCount(args: {
  table: string;
  filters?: DbFilter[];
}): Promise<number> {
  if (isElectron()) {
    const res = await window.electronAPI!.db!.select({ ...args, countOnly: true });
    if (!res.ok) return 0;
    return typeof res.data === 'number' ? res.data : 0;
  }
  try {
    let q = supabase.from(args.table).select('*', { count: 'exact', head: true });
    for (const f of (args.filters || [])) {
      if (f.op === 'is_null') q = (q as ReturnType<typeof supabase.from>).is(f.col, null);
      else if (f.op === 'not_null') q = (q as ReturnType<typeof supabase.from>).not(f.col, 'is', null);
      else if (f.op === 'eq' || f.op === '=') q = (q as ReturnType<typeof supabase.from>).eq(f.col, f.val);
      else if (f.op === 'neq' || f.op === '!=') q = (q as ReturnType<typeof supabase.from>).neq(f.col, f.val);
      else if (f.op === 'gte' || f.op === '>=') q = (q as ReturnType<typeof supabase.from>).gte(f.col, f.val);
      else if (f.op === 'lte' || f.op === '<=') q = (q as ReturnType<typeof supabase.from>).lte(f.col, f.val);
      else if (f.op === '>') q = (q as ReturnType<typeof supabase.from>).gt(f.col, f.val);
      else if (f.op === '<') q = (q as ReturnType<typeof supabase.from>).lt(f.col, f.val);
    }
    const { count } = await q;
    return count ?? 0;
  } catch {
    return 0;
  }
}

// ─── IMPOSTAZIONE (helper specializzato per la tabella impostazioni) ───────────

export async function getImpostazione(chiave: string, userId?: string): Promise<string | null> {
  if (isElectron()) {
    const filters: DbFilter[] = [{ col: 'chiave', op: 'eq', val: chiave }];
    if (userId) filters.push({ col: 'user_id', op: 'eq', val: userId });
    const res = await dbSelect<{ valore: string }>({ table: 'impostazioni', columns: 'valore', filters });
    return res.data?.[0]?.valore ?? null;
  }
  const q = supabase.from('impostazioni').select('valore').eq('chiave', chiave);
  const { data } = await q.maybeSingle();
  return (data as { valore: string } | null)?.valore ?? null;
}

export async function setImpostazione(chiave: string, valore: string, userId: string): Promise<void> {
  if (isElectron()) {
    await dbUpsert({ table: 'impostazioni', data: { chiave, valore, user_id: userId }, onConflict: 'chiave,user_id', userId });
    return;
  }
  await supabase.from('impostazioni').upsert({ chiave, valore, user_id: userId }, { onConflict: 'chiave,user_id' });
}

// ─── RIPRISTINO BACKUP (supporta sia online che offline in Electron) ──────────

export async function restoreBackup(backupData: Record<string, unknown>): Promise<{ success: boolean; error?: string; results?: Record<string, unknown> }> {
  // In Electron: usa il DB locale direttamente (funziona anche offline)
  if (isElectron()) {
    const res = await window.electronAPI!.db!.importBackup(backupData);
    return res;
  }

  // Browser: usa la edge function Supabase (richiede internet)
  const { data: { session } } = await supabase.auth.getSession();
  const supabaseUrl = (supabase as unknown as { supabaseUrl: string }).supabaseUrl || '';
  const apiUrl = `${supabaseUrl}/functions/v1/backup-database`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'apikey': (supabase as unknown as { supabaseKey: string }).supabaseKey || '',
  };
  if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;

  const res = await fetch(apiUrl, { method: 'POST', headers, body: JSON.stringify(backupData) });
  return await res.json();
}

// ─── EXPORT BACKUP (preferisce dati locali in Electron) ──────────────────────

export async function exportBackup(): Promise<Record<string, unknown> | null> {
  if (isElectron()) {
    const res = await window.electronAPI!.db!.export();
    return res.ok ? res.data : null;
  }
  return null; // Il browser usa la edge function direttamente
}
