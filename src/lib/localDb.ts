/**
 * Database adapter unificato.
 *
 * - In Electron: usa SQLite locale via IPC. Ogni scrittura viene inviata
 *   immediatamente a Supabase in background (fire-and-forget). Se offline,
 *   resta dirty e viene ripresa dal sync periodico.
 * - In browser: scrive prima in IndexedDB (local_rows, dirty=1) poi su Supabase.
 *   Se offline, resta dirty e viene inviata da syncBrowserToSupabase al ritorno online.
 */

import { supabase } from './supabase';
import { getTableCache, setTableCache, deleteTableCache, addPendingMutation } from './indexedDb';

// Import lazy per evitare dipendenza circolare (sync.ts importa localDb.ts)
let _browserLocalWrite: ((table: string, userId: string, row: Record<string, unknown>) => Promise<void>) | null = null;
let _browserLocalDelete: ((table: string, userId: string, id: string) => Promise<void>) | null = null;

export function registerBrowserLocalOps(
  write: typeof _browserLocalWrite,
  del: typeof _browserLocalDelete
) {
  _browserLocalWrite = write;
  _browserLocalDelete = del;
}

/** Timestamp ISO corrente — injettato su ogni scrittura browser per garantire updated_at. */
function nowIso(): string { return new Date().toISOString(); }

// ─── Helpers per aggiornamento cache offline ──────────────────────────────────

async function cacheInsert(table: string, userId: string, row: Record<string, unknown>) {
  const rows = (await getTableCache(table, userId)) as Record<string, unknown>[] ?? [];
  await setTableCache(table, userId, [...rows, row]);
}

async function cacheUpdate(table: string, userId: string, id: string, patch: Record<string, unknown>) {
  const rows = (await getTableCache(table, userId)) as Record<string, unknown>[] ?? [];
  await setTableCache(table, userId, rows.map(r => r.id === id ? { ...r, ...patch } : r));
}

async function cacheRemoveById(table: string, userId: string, id: string) {
  const rows = (await getTableCache(table, userId)) as Record<string, unknown>[] ?? [];
  await setTableCache(table, userId, rows.filter(r => r.id !== id));
}

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
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);

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

/** Azzera il cache IndexedDB di una tabella per il corrente utente, forzando un reload da Supabase. */
export async function invalidateTableCache(table: string): Promise<void> {
  if (_currentUserId) await deleteTableCache(table, _currentUserId);
}

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

// ─── Filtro/ordinamento su cache IndexedDB ────────────────────────────────────

function applyFiltersToCache<T>(
  cached: unknown[],
  args: { filters?: DbFilter[]; orderBy?: DbOrder[]; limit?: number | null }
): T[] {
  let rows = cached as Record<string, unknown>[];
  for (const f of (args.filters || [])) {
    rows = rows.filter(row => {
      if (f.op === 'is_null') return row[f.col] === null || row[f.col] === undefined;
      if (f.op === 'not_null') return row[f.col] !== null && row[f.col] !== undefined;
      if (f.op === 'eq' || f.op === '=') return row[f.col] == f.val;
      if (f.op === 'neq' || f.op === '!=') return row[f.col] != f.val;
      if (f.op === 'in') return Array.isArray(f.val) && f.val.includes(row[f.col]);
      if (f.op === 'gte' || f.op === '>=') return String(row[f.col] ?? '') >= String(f.val ?? '');
      if (f.op === 'lte' || f.op === '<=') return String(row[f.col] ?? '') <= String(f.val ?? '');
      if (f.op === '>') return String(row[f.col] ?? '') > String(f.val ?? '');
      if (f.op === '<') return String(row[f.col] ?? '') < String(f.val ?? '');
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
  return rows as T[];
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

  // LOCAL-FIRST: legge sempre da IndexedDB se la cache esiste.
  // Questo garantisce funzionamento offline a vita dopo il primo uso online.
  // Skip cache when query uses join notation (columns with "!" or nested relations):
  // cached rows are flat and don't contain nested join data.
  const hasJoin = args.columns ? /[!(]/.test(args.columns) : false;
  if (_currentUserId && !hasJoin) {
    try {
      const cached = await getTableCache(args.table, _currentUserId);
      if (cached !== null) {
        const rows = applyFiltersToCache<T>(cached, args);
        if (args.countOnly) return { data: null, error: null, count: rows.length };
        return { data: rows, error: null };
      }
    } catch { /* cache miss: fallthrough a Supabase */ }
  }

  // FALLBACK: Supabase (solo se cache vuota — es. primo avvio)
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
  // LOCAL-FIRST browser: scrive prima in IndexedDB (dirty=1), poi tenta Supabase.
  const localId = (args.data.id as string | undefined) || crypto.randomUUID();
  const ts = nowIso();
  const localRow = { id: localId, created_at: ts, updated_at: ts, ...args.data };
  // Scrivi nel local_rows store con dirty=1 per alimentare il sync timestamp-based
  if (_currentUserId && _browserLocalWrite) {
    await _browserLocalWrite(args.table, _currentUserId, localRow);
  } else if (_currentUserId) {
    await cacheInsert(args.table, _currentUserId, localRow);
  }

  try {
    const { data, error } = await supabase.from(args.table).insert({ ...localRow }).select();
    if (error) {
      console.error(`[dbInsert] ${args.table}:`, error.message, error.details, error.hint, args.data);
      // Return the local row so the UI stays responsive, but expose the error
      return { data: localRow as T, error: error.message };
    }
    const row = Array.isArray(data) ? data[0] : data;
    // Marca come sincronizzata nel local_rows store
    if (row && _currentUserId && _browserLocalWrite) {
      await _browserLocalWrite(args.table, _currentUserId, { ...localRow, ...(row as Record<string, unknown>) });
    }
    return { data: (row ?? localRow) as T, error: null };
  } catch (e) {
    console.error(`[dbInsert] ${args.table} catch:`, e);
    return { data: localRow as T, error: String(e) };
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
  // LOCAL-FIRST browser: aggiorna IndexedDB (dirty=1) poi tenta Supabase.
  const ts = nowIso();
  const patchWithTs = { ...args.data, updated_at: args.data.updated_at ?? ts };
  if (_currentUserId && _browserLocalWrite) {
    // Recupera la riga esistente dalla cache per costruire il record completo
    const cached = (await getTableCache(args.table, _currentUserId)) as Record<string, unknown>[] ?? [];
    const existing = cached.find(r => r.id === args.id) ?? { id: args.id };
    await _browserLocalWrite(args.table, _currentUserId, { ...existing, ...patchWithTs });
  } else if (_currentUserId) {
    await cacheUpdate(args.table, _currentUserId, args.id, patchWithTs);
  }

  try {
    const { data, error } = await supabase.from(args.table).update(patchWithTs).eq('id', args.id).select();
    if (error) {
      console.error(`[dbUpdate] ${args.table} id=${args.id}:`, error.message, args.data);
      return { data: { id: args.id, ...patchWithTs } as T, error: null };
    }
    const row = Array.isArray(data) ? data[0] : data;
    return { data: (row ?? { id: args.id, ...patchWithTs }) as T, error: null };
  } catch {
    return { data: { id: args.id, ...patchWithTs } as T, error: null };
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
    // Se online, propaga subito il delete a Supabase (best-effort; il pending_deletes garantisce il fallback)
    if (navigator.onLine) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let q: any = supabase.from(args.table).delete();
        for (const f of args.filters) {
          if (f.op === 'eq' || f.op === '=') q = q.eq(f.col, f.val);
          else if (f.op === 'in') q = q.in(f.col, f.val as unknown[]);
        }
        await q;
      } catch { /* handled by pending_deletes sync */ }
    }
    return { data: null, error: null };
  }
  // LOCAL-FIRST browser: soft-delete in local_rows (dirty=1, deleted=1) poi tenta Supabase.
  if (_currentUserId) {
    const idFilter = args.filters.find(f => f.col === 'id' && (f.op === 'eq' || f.op === '='));
    if (idFilter && _browserLocalDelete) {
      await _browserLocalDelete(args.table, _currentUserId, idFilter.val as string);
    } else if (idFilter) {
      await cacheRemoveById(args.table, _currentUserId, idFilter.val as string);
    } else {
      try {
        const cached = await getTableCache(args.table, _currentUserId);
        if (cached !== null) {
          const toRemove = applyFiltersToCache<Record<string, unknown>>(cached, { filters: args.filters });
          for (const r of toRemove) {
            if (_browserLocalDelete) await _browserLocalDelete(args.table, _currentUserId, r.id as string);
          }
        }
      } catch { /* non-critical */ }
    }
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
  } catch {
    return { data: null, error: null };
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
  // LOCAL-FIRST browser: scrive in local_rows (dirty=1) poi tenta Supabase.
  const localId = (args.data.id as string | undefined) || crypto.randomUUID();
  const ts = nowIso();
  const localRow = { id: localId, updated_at: ts, ...args.data };
  if (_currentUserId && _browserLocalWrite) {
    await _browserLocalWrite(args.table, _currentUserId, localRow);
  } else if (_currentUserId) {
    if (args.data.id) {
      await cacheUpdate(args.table, _currentUserId, args.data.id as string, localRow);
    } else {
      await cacheInsert(args.table, _currentUserId, localRow);
    }
  }
  try {
    const { data, error } = await supabase
      .from(args.table)
      .upsert({ ...localRow }, args.onConflict ? { onConflict: args.onConflict } : undefined)
      .select();
    if (error) return { data: localRow as T, error: null };
    const row = Array.isArray(data) ? data[0] : data;
    return { data: (row ?? localRow) as T, error: null };
  } catch {
    return { data: localRow as T, error: null };
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
  // LOCAL-FIRST browser: scrive ogni riga in local_rows (dirty=1) poi invia a Supabase.
  const ts = nowIso();
  const localRows = args.rows.map(row => ({
    id: (row.id as string | undefined) ?? crypto.randomUUID(),
    updated_at: ts,
    ...row,
  }));
  if (_currentUserId && _browserLocalWrite) {
    for (const row of localRows) {
      await _browserLocalWrite(args.table, _currentUserId, row);
    }
  } else if (_currentUserId) {
    for (const row of localRows) {
      if (row.id) await cacheUpdate(args.table, _currentUserId, row.id as string, row);
      else await cacheInsert(args.table, _currentUserId, row);
    }
  }
  try {
    const { data, error } = await supabase
      .from(args.table)
      .upsert(localRows, args.onConflict ? { onConflict: args.onConflict } : undefined)
      .select();
    if (error) return { data: localRows as T[], error: null };
    return { data: (data as T[]) ?? localRows as T[], error: null };
  } catch {
    return { data: localRows as T[], error: null };
  }
}

// ─── RPC (stored procedures) ─────────────────────────────────────────────────

/**
 * Chiama una funzione Postgres via supabase.rpc().
 * La chiamata passa per /rest/v1/rpc/ quindi viene intercettata da offlineFetch
 * e accodata se il dispositivo e' offline — il delta viene applicato atomicamente
 * al ripristino della connessione.
 */
export async function dbRpc(fn: string, params: Record<string, unknown>): Promise<{ error: Error | null }> {
  if (isElectron()) {
    // aggiorna_stock_catalogo: aggiorna anche il SQLite locale prima di chiamare Supabase
    if (fn === 'aggiorna_stock_catalogo') {
      const id = params.p_id as string;
      const stockDelta = (params.p_stock_delta as number) ?? 0;
      const vendutaDelta = (params.p_venduta_delta as number) ?? 0;
      const cur = await dbSelect<{ id: string; quantita_stock: number; quantita_venduta: number }>({
        table: 'prodotti_rivendita_catalogo',
        filters: [{ col: 'id', op: 'eq', val: id }],
        limit: 1,
      });
      if (cur.data && cur.data.length > 0) {
        const row = cur.data[0];
        await dbUpdate({
          table: 'prodotti_rivendita_catalogo',
          id,
          data: {
            quantita_stock: Math.max(0, (row.quantita_stock ?? 0) + stockDelta),
            quantita_venduta: Math.max(0, (row.quantita_venduta ?? 0) + vendutaDelta),
          },
        });
      }
    }
    try {
      const { error } = await supabase.rpc(fn, params);
      return { error: error as Error | null };
    } catch {
      return { error: null };
    }
  }
  // Web: aggiorna la cache IndexedDB per aggiorna_stock_catalogo (stesso pattern di Electron)
  if (fn === 'aggiorna_stock_catalogo') {
    const id = params.p_id as string;
    const stockDelta = (params.p_stock_delta as number) ?? 0;
    const vendutaDelta = (params.p_venduta_delta as number) ?? 0;
    const cur = await dbSelect<{ id: string; quantita_stock: number; quantita_venduta: number }>({
      table: 'prodotti_rivendita_catalogo',
      filters: [{ col: 'id', op: 'eq', val: id }],
      limit: 1,
    });
    if (cur.data && cur.data.length > 0 && _currentUserId) {
      const row = cur.data[0];
      await cacheUpdate('prodotti_rivendita_catalogo', _currentUserId, id, {
        quantita_stock: Math.max(0, (row.quantita_stock ?? 0) + stockDelta),
        quantita_venduta: Math.max(0, (row.quantita_venduta ?? 0) + vendutaDelta),
      });
    }
  }
  try {
    const { error } = await supabase.rpc(fn, params);
    return { error: error as Error | null };
  } catch {
    return { error: null };
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

  // Browser: usa IndexedDB cache se disponibile (popola offline e migliora performance)
  if (_currentUserId) {
    try {
      const cached = await getTableCache(args.table, _currentUserId);
      if (cached !== null) {
        const rows = applyFiltersToCache<Record<string, unknown>>(cached, args);

        for (const rel of args.relations) {
          const pk = rel.pk ?? 'id';
          if (!rel.many) {
            const fkValues = [...new Set(rows.map(r => r[rel.fk]).filter(Boolean))] as unknown[];
            if (fkValues.length === 0) { for (const r of rows) r[rel.key] = null; continue; }
            const relCached = ((await getTableCache(rel.table, _currentUserId)) ?? []) as Record<string, unknown>[];
            const relMap = new Map(relCached.map(r => [r[pk], r]));
            for (const r of rows) r[rel.key] = relMap.get(r[rel.fk]) ?? null;
          } else {
            const manyFk = rel.manyFk ?? `${args.table.replace(/s$/, '')}_id`;
            const primaryIds = rows.map(r => r.id).filter(Boolean) as unknown[];
            if (primaryIds.length === 0) { for (const r of rows) r[rel.key] = []; continue; }
            const relCached = ((await getTableCache(rel.table, _currentUserId)) ?? []) as Record<string, unknown>[];
            const relMap = new Map<unknown, Record<string, unknown>[]>();
            for (const rel2 of relCached) {
              const parentId = rel2[manyFk];
              if (!relMap.has(parentId)) relMap.set(parentId, []);
              relMap.get(parentId)!.push(rel2);
            }
            for (const r of rows) r[rel.key] = relMap.get(r.id) ?? [];
          }
        }

        return { data: rows as T[], error: null };
      }
    } catch { /* cache miss: fallthrough a Supabase */ }
  }

  // Fallback: Supabase (solo se cache vuota — es. primo avvio)
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
  const { data } = await supabase
    .from('impostazioni')
    .select('valore')
    .eq('chiave', chiave)
    .order('updated_at', { ascending: false })
    .limit(1);
  return (data as { valore: string }[] | null)?.[0]?.valore ?? null;
}

export async function setImpostazione(chiave: string, valore: string, userId: string): Promise<void> {
  if (isElectron()) {
    await dbUpsert({ table: 'impostazioni', data: { chiave, valore, user_id: userId }, onConflict: 'chiave,user_id', userId });
    return;
  }
  await supabase
    .from('impostazioni')
    .upsert(
      { chiave, valore, user_id: userId, updated_at: new Date().toISOString() },
      { onConflict: 'chiave,user_id' },
    );
}

// ─── BACKUP ───────────────────────────────────────────────────────────────────

const BACKUP_TABLES = [
  'clienti','parrucchieri','trattamenti_catalogo','appuntamenti','appuntamento_trattamenti',
  'schede_colore','fiches','fiche_voci','incassi_giornalieri','carte_sconto','utilizzi_carta_sconto',
  'carte_premium','ricariche_carta_premium','utilizzi_carta_premium','prodotti_rivendita_catalogo',
  'rivendita_prodotti','trattamenti_eseguiti','impostazioni','template_messaggi',
  'assenze_parrucchieri','magazzino_prodotti','magazzino_schede_salvate',
  'spese','schede_clienti_da_confermare','giorni_parrucchieri','voci_extra_catalogo',
];

async function restoreToIndexedDb(backupData: Record<string, unknown>): Promise<{ success: boolean; results: Record<string, unknown> }> {
  if (!_currentUserId) return { success: false, results: { error: 'Utente non autenticato' } };
  const results: Record<string, unknown> = {};
  for (const table of BACKUP_TABLES) {
    const rows = backupData[table] ?? backupData[`${table}_voci`];
    if (!Array.isArray(rows) || rows.length === 0) continue;
    try {
      await setTableCache(table, _currentUserId, rows);
      results[table] = { ok: true, count: rows.length };
    } catch (e) {
      results[table] = { ok: false, error: String(e) };
    }
  }
  return { success: true, results };
}

export async function restoreBackup(backupData: Record<string, unknown>): Promise<{ success: boolean; error?: string; results?: Record<string, unknown> }> {
  if (isElectron()) {
    const res = await window.electronAPI!.db!.importBackup(backupData);
    return res as { success: boolean; error?: string; results?: Record<string, unknown> };
  }

  // Offline: salva in IndexedDB e accoda un upsert REST per tabella (no edge function)
  if (!navigator.onLine) {
    const res = await restoreToIndexedDb(backupData);
    if (res.success) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sb = supabase as any;
        const sbUrl: string = sb.supabaseUrl ?? '';
        const sbKey: string = sb.supabaseKey ?? '';
        for (const table of BACKUP_TABLES) {
          const records = (backupData[table] as Record<string, unknown>[]) ?? [];
          if (records.length === 0) continue;
          await addPendingMutation({
            url: `${sbUrl}/rest/v1/${table}`,
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': sbKey,
              'Prefer': 'resolution=merge-duplicates,return=minimal',
            },
            body: JSON.stringify(records),
            ts: Date.now(),
          });
        }
      } catch { /* non critico: il ripristino locale e' avvenuto */ }
    }
    return res;
  }

  // Online: upsert diretto per tabella via client Supabase standard (no edge function, no CORS)
  try {
    const results: Record<string, unknown> = {};
    for (const table of BACKUP_TABLES) {
      const records = (backupData[table] as Record<string, unknown>[]) ?? [];
      if (records.length === 0) continue;
      try {
        const { error } = await supabase.from(table).upsert(records, { onConflict: 'id' });
        results[table] = error ? { ok: false, error: error.message } : { ok: true, count: records.length };
      } catch (e) {
        results[table] = { ok: false, error: String(e) };
      }
    }
    restoreToIndexedDb(backupData).catch(() => {/* best effort */});
    return { success: true, results };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

export async function exportBackup(): Promise<Record<string, unknown> | null> {
  if (isElectron()) {
    const res = await window.electronAPI!.db!.export();
    return res.ok ? (res.data as Record<string, unknown>) : null;
  }
  return null;
}
