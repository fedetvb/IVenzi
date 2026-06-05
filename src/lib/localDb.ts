/**
 * Database adapter unificato.
 *
 * - In Electron: usa SQLite locale via IPC. Ogni scrittura viene inviata
 *   immediatamente a Supabase in background (fire-and-forget). Se offline,
 *   resta dirty e viene ripresa dal sync periodico.
 * - In browser: usa Supabase direttamente (comportamento invariato).
 */

import { supabase } from './supabase';
import { getTableCache } from './indexedDb';

// ─── Compressione immagini ─────────────────────────────────────────────────────

const IMG_MAX_PX = 800;
const IMG_QUALITY = 0.72;

/** Ridimensiona e comprime un'immagine. Restituisce un Blob JPEG <= ~80 KB. */
export async function compressImage(source: File | Blob | string): Promise<Blob> {
  const src = typeof source === 'string' ? source : URL.createObjectURL(source as Blob);
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = src;
  });
  if (typeof source !== 'string') URL.revokeObjectURL(src);

  let { naturalWidth: w, naturalHeight: h } = img;
  if (w > IMG_MAX_PX || h > IMG_MAX_PX) {
    if (w >= h) { h = Math.round((h / w) * IMG_MAX_PX); w = IMG_MAX_PX; }
    else { w = Math.round((w / h) * IMG_MAX_PX); h = IMG_MAX_PX; }
  }

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);

  return new Promise<Blob>((res, rej) =>
    canvas.toBlob(b => b ? res(b) : rej(new Error('canvas toBlob failed')), 'image/jpeg', IMG_QUALITY)
  );
}

// Importazione lazy per evitare dipendenza circolare (sync.ts importa localDb.ts)
let _pushRowNow: ((table: string, row: Record<string, unknown>, userId: string) => Promise<void>) | null = null;

export function registerPushRowNow(fn: typeof _pushRowNow) {
  _pushRowNow = fn;
}

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

let _electronDbReady: boolean = false;

export function setElectronDbReady(ready: boolean) {
  _electronDbReady = ready;
}

export function isElectron(): boolean {
  return typeof window !== 'undefined' && !!window.electronAPI?.db && _electronDbReady;
}

// ID utente corrente (settato da App.tsx dopo il login)
let _currentUserId: string | null = null;
export function setCurrentUserId(id: string | null) { _currentUserId = id; }
export function getCurrentUserId(): string | null { return _currentUserId; }

// ─── Helper: converti booleans SQLite (0/1) in boolean JS ────────────────────

const BOOL_FIELDS = new Set([
  'attivo', 'convalidata', 'manuale', 'nominativa', 'attiva', 'usa_e_getta',
  'ricorrente', 'is_default', '_dirty', 'in_blacklist',
]);

function boolCols(row: Record<string, unknown>): Record<string, unknown> {
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

// Trigger del push immediato senza bloccare il chiamante
function triggerPush(table: string, row: Record<string, unknown> | null) {
  if (!_pushRowNow || !row || !_currentUserId) return;
  _pushRowNow(table, row, _currentUserId).catch(() => {/* errore gestito dentro pushRowNow */});
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

  // Browser / Electron senza SQLite: se offline usa IndexedDB cache
  if (!navigator.onLine && _currentUserId) {
    try {
      const cached = await getTableCache(args.table, _currentUserId);
      if (cached !== null) {
        let rows = cached as Record<string, unknown>[];
        for (const f of (args.filters || [])) {
          rows = rows.filter(row => {
            if (f.op === 'is_null') return row[f.col] === null || row[f.col] === undefined;
            if (f.op === 'not_null') return row[f.col] !== null && row[f.col] !== undefined;
            if (f.op === 'eq' || f.op === '=') return row[f.col] == f.val;
            if (f.op === 'neq' || f.op === '!=') return row[f.col] != f.val;
            if (f.op === 'in') return Array.isArray(f.val) && f.val.includes(row[f.col]);
            if (f.op === 'gte' || f.op === '>=') return (row[f.col] as number) >= (f.val as number);
            if (f.op === 'lte' || f.op === '<=') return (row[f.col] as number) <= (f.val as number);
            if (f.op === '>') return (row[f.col] as number) > (f.val as number);
            if (f.op === '<') return (row[f.col] as number) < (f.val as number);
            if (f.op === 'like') return typeof row[f.col] === 'string' && (row[f.col] as string).toLowerCase().includes((f.val as string).replace(/%/g, '').toLowerCase());
            return true;
          });
        }
        if (args.orderBy?.length) {
          rows = [...rows].sort((a, b) => {
            for (const o of args.orderBy!) {
              const av = String(a[o.col] ?? '');
              const bv = String(b[o.col] ?? '');
              const cmp = av.localeCompare(bv);
              if (cmp !== 0) return o.asc !== false ? cmp : -cmp;
            }
            return 0;
          });
        }
        if (args.limit) rows = rows.slice(0, args.limit);
        return { data: rows as T[], error: null };
      }
    } catch { /* fallthrough */ }
  }

  // Supabase (online)
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = supabase.from(args.table).select(args.columns || '*');
    for (const f of (args.filters || [])) {
      if (f.op === 'is_null') { q = q.is(f.col, null); }
      else if (f.op === 'not_null') { q = q.not(f.col, 'is', null); }
      else if (f.op === 'in') { q = q.in(f.col, f.val as unknown[]); }
      else if (f.op === 'eq' || f.op === '=') { q = q.eq(f.col, f.val); }
      else if (f.op === 'neq' || f.op === '!=') { q = q.neq(f.col, f.val); }
      else if (f.op === 'gte' || f.op === '>=') { q = q.gte(f.col, f.val); }
      else if (f.op === 'lte' || f.op === '<=') { q = q.lte(f.col, f.val); }
      else if (f.op === '>') { q = q.gt(f.col, f.val); }
      else if (f.op === '<') { q = q.lt(f.col, f.val); }
      else if (f.op === 'like') { q = q.like(f.col, f.val as string); }
    }
    for (const o of (args.orderBy || [])) {
      q = q.order(o.col, { ascending: o.asc !== false });
    }
    if (args.limit !== undefined && args.limit !== null) {
      q = q.limit(args.limit);
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
}): Promise<DbResult<T>> {
  if (isElectron()) {
    const res = await window.electronAPI!.db!.insert(args);
    if (!res.ok) return { data: null, error: res.error ?? 'Errore DB' };
    const row = res.data ? boolCols(res.data as Record<string, unknown>) as T : null;
    if (res.data) triggerPush(args.table, res.data as Record<string, unknown>);
    return { data: row, error: null };
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
    const row = res.data ? boolCols(res.data as Record<string, unknown>) as T : null;
    if (res.data) triggerPush(args.table, res.data as Record<string, unknown>);
    return { data: row, error: null };
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = supabase.from(args.table).delete();
    for (const f of args.filters) {
      if (f.op === 'eq' || f.op === '=') q = q.eq(f.col, f.val);
      else if (f.op === 'in') q = q.in(f.col, f.val as unknown[]);
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
    const row = res.data ? boolCols(res.data as Record<string, unknown>) as T : null;
    if (res.data) triggerPush(args.table, res.data as Record<string, unknown>);
    return { data: row, error: null };
  }
  try {
    const { data, error } = await supabase
      .from(args.table)
      .upsert(args.data, args.onConflict ? { onConflict: args.onConflict } : undefined)
      .select();
    if (error) return { data: null, error: error.message };
    const row = Array.isArray(data) ? data[0] : data;
    return { data: row as T ?? null, error: null };
  } catch (e) {
    return { data: null, error: String(e) };
  }
}

// ─── UPSERT multiplo ──────────────────────────────────────────────────────────

export async function dbUpsertMany<T = Record<string, unknown>>(args: {
  table: string;
  rows: Record<string, unknown>[];
  onConflict?: string;
  userId?: string;
}): Promise<DbResult<T[]>> {
  if (isElectron()) {
    const results: T[] = [];
    for (const row of args.rows) {
      const res = await window.electronAPI!.db!.upsert({
        table: args.table, data: row, onConflict: args.onConflict, userId: args.userId,
      });
      if (res.ok && res.data) {
        const r = boolCols(res.data as Record<string, unknown>) as T;
        results.push(r);
        triggerPush(args.table, res.data as Record<string, unknown>);
      }
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

// ─── SELECT WITH RELATED (JOIN) ───────────────────────────────────────────────

export interface DbRelation {
  key: string;       // key in result object (e.g. "clienti")
  table: string;     // related table name
  fk: string;        // FK column in primary row (e.g. "cliente_id") — for many-to-one
  pk?: string;       // PK in related table (default "id")
  columns?: string;  // columns to fetch from related table (default "*")
  many?: boolean;    // true = one-to-many: FK is in related table pointing back
  manyFk?: string;   // FK column in related table (used when many=true, e.g. "appuntamento_id")
}

/**
 * Fetches the primary table and attaches related records.
 * Electron: two separate queries + JS merge (avoids raw SQL complexity).
 * Browser: builds Supabase nested select via supabaseSelect string.
 */
export async function dbSelectWithRelated<T = Record<string, unknown>>(args: {
  table: string;
  columns?: string;
  filters?: DbFilter[];
  orderBy?: DbOrder[];
  relations: DbRelation[];
  supabaseSelect: string; // used in browser/Supabase mode, e.g. "*, clienti(nome, cognome)"
}): Promise<DbResult<T[]>> {
  if (isElectron()) {
    // Step 1: fetch primary rows
    const primaryRes = await dbSelect<Record<string, unknown>>({
      table: args.table,
      columns: args.columns,
      filters: args.filters,
      orderBy: args.orderBy,
    });
    if (primaryRes.error || !primaryRes.data) return { data: null, error: primaryRes.error };
    const rows = primaryRes.data as Record<string, unknown>[];

    // Step 2: for each relation, fetch related rows and attach
    for (const rel of args.relations) {
      const pk = rel.pk ?? 'id';

      if (!rel.many) {
        // Many-to-one: FK in primary row
        const fkValues = [...new Set(rows.map(r => r[rel.fk]).filter(Boolean))] as unknown[];
        if (fkValues.length === 0) {
          for (const r of rows) r[rel.key] = null;
          continue;
        }
        const relRes = await dbSelect<Record<string, unknown>>({
          table: rel.table,
          columns: rel.columns,
          filters: [{ col: pk, op: 'in', val: fkValues }],
        });
        const relMap = new Map((relRes.data ?? []).map(r => [r[pk], r]));
        for (const r of rows) {
          r[rel.key] = relMap.get(r[rel.fk]) ?? null;
        }
      } else {
        // One-to-many: FK is in related table
        const manyFk = rel.manyFk ?? `${args.table.replace(/s$/, '')}_id`;
        const primaryIds = rows.map(r => r.id).filter(Boolean) as unknown[];
        if (primaryIds.length === 0) {
          for (const r of rows) r[rel.key] = [];
          continue;
        }
        const relRes = await dbSelect<Record<string, unknown>>({
          table: rel.table,
          columns: rel.columns,
          filters: [{ col: manyFk, op: 'in', val: primaryIds }],
        });
        const relMap = new Map<unknown, Record<string, unknown>[]>();
        for (const rel2 of (relRes.data ?? [])) {
          const parentId = rel2[manyFk];
          if (!relMap.has(parentId)) relMap.set(parentId, []);
          relMap.get(parentId)!.push(rel2);
        }
        for (const r of rows) {
          r[rel.key] = relMap.get(r.id) ?? [];
        }
      }
    }

    return { data: rows as T[], error: null };
  }

  // Browser: Supabase with nested select
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = supabase.from(args.table).select(args.supabaseSelect);
    for (const f of (args.filters || [])) {
      if (f.op === 'is_null') { q = q.is(f.col, null); }
      else if (f.op === 'not_null') { q = q.not(f.col, 'is', null); }
      else if (f.op === 'in') { q = q.in(f.col, f.val as unknown[]); }
      else if (f.op === 'eq' || f.op === '=') { q = q.eq(f.col, f.val); }
      else if (f.op === 'neq' || f.op === '!=') { q = q.neq(f.col, f.val); }
      else if (f.op === 'gte' || f.op === '>=') { q = q.gte(f.col, f.val); }
      else if (f.op === 'lte' || f.op === '<=') { q = q.lte(f.col, f.val); }
      else if (f.op === '>') { q = q.gt(f.col, f.val); }
      else if (f.op === '<') { q = q.lt(f.col, f.val); }
      else if (f.op === 'like') { q = q.like(f.col, f.val as string); }
    }
    for (const o of (args.orderBy || [])) {
      q = q.order(o.col, { ascending: o.asc !== false });
    }
    const { data, error } = await q;
    return { data: (data as T[]) ?? null, error: error?.message ?? null };
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = supabase.from(args.table).select('*', { count: 'exact', head: true });
    for (const f of (args.filters || [])) {
      if (f.op === 'is_null') q = q.is(f.col, null);
      else if (f.op === 'not_null') q = q.not(f.col, 'is', null);
      else if (f.op === 'eq' || f.op === '=') q = q.eq(f.col, f.val);
      else if (f.op === 'neq' || f.op === '!=') q = q.neq(f.col, f.val);
      else if (f.op === 'gte' || f.op === '>=') q = q.gte(f.col, f.val);
      else if (f.op === 'lte' || f.op === '<=') q = q.lte(f.col, f.val);
      else if (f.op === '>') q = q.gt(f.col, f.val);
      else if (f.op === '<') q = q.lt(f.col, f.val);
    }
    const { count } = await q;
    return count ?? 0;
  } catch {
    return 0;
  }
}

// ─── IMPOSTAZIONE ─────────────────────────────────────────────────────────────

export async function getImpostazione(chiave: string, userId?: string): Promise<string | null> {
  if (isElectron()) {
    const filters: DbFilter[] = [{ col: 'chiave', op: 'eq', val: chiave }];
    if (userId) filters.push({ col: 'user_id', op: 'eq', val: userId });
    const res = await dbSelect<{ valore: string }>({ table: 'impostazioni', columns: 'valore', filters });
    return res.data?.[0]?.valore ?? null;
  }
  const { data } = await supabase.from('impostazioni').select('valore').eq('chiave', chiave).maybeSingle();
  return (data as { valore: string } | null)?.valore ?? null;
}

export async function setImpostazione(chiave: string, valore: string, userId: string): Promise<void> {
  if (isElectron()) {
    await dbUpsert({ table: 'impostazioni', data: { chiave, valore, user_id: userId }, onConflict: 'chiave,user_id', userId });
    return;
  }
  await supabase.from('impostazioni').upsert({ chiave, valore, user_id: userId }, { onConflict: 'chiave,user_id' });
}

// ─── BACKUP ───────────────────────────────────────────────────────────────────

export async function restoreBackup(backupData: Record<string, unknown>): Promise<{ success: boolean; error?: string; results?: Record<string, unknown> }> {
  if (isElectron()) {
    const res = await window.electronAPI!.db!.importBackup(backupData);
    return res as { success: boolean; error?: string; results?: Record<string, unknown> };
  }
  const { data: { session } } = await supabase.auth.getSession();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const apiUrl = `${sb.supabaseUrl}/functions/v1/backup-database`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'apikey': sb.supabaseKey ?? '',
  };
  if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
  const res = await fetch(apiUrl, { method: 'POST', headers, body: JSON.stringify(backupData) });
  return await res.json();
}

export async function exportBackup(): Promise<Record<string, unknown> | null> {
  if (isElectron()) {
    const res = await window.electronAPI!.db!.export();
    return res.ok ? (res.data as Record<string, unknown>) : null;
  }
  return null;
}
