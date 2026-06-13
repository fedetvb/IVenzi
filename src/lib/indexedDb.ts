const DB_NAME = 'gestionale_offline';
const DB_VERSION = 3;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('query_cache')) {
        db.createObjectStore('query_cache', { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains('pending_mutations')) {
        db.createObjectStore('pending_mutations', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('table_cache')) {
        db.createObjectStore('table_cache', { keyPath: 'key' });
      }
      // Store per-riga: chiave composita `{table}:{userId}:{id}`
      // Permette lettura e scrittura O(1) per riga, confronto timestamp, e push selettivo.
      if (!db.objectStoreNames.contains('local_rows')) {
        const store = db.createObjectStore('local_rows', { keyPath: 'pk' });
        store.createIndex('by_table_user', ['table', 'userId'], { unique: false });
        store.createIndex('by_dirty', ['table', 'userId', 'dirty'], { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      dbPromise = null;
      reject(req.error);
    };
  });
  return dbPromise;
}

// ─── query_cache (cache HTTP per offlineFetch) ────────────────────────────────

export async function getCachedData(key: string): Promise<{ data: unknown; contentRange: string | null } | null> {
  try {
    const db = await openDb();
    return new Promise((resolve) => {
      const tx = db.transaction('query_cache', 'readonly');
      const req = tx.objectStore('query_cache').get(key);
      req.onsuccess = () => resolve(req.result ? { data: req.result.data, contentRange: req.result.contentRange ?? null } : null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function setCachedData(key: string, data: unknown, contentRange: string | null): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('query_cache', 'readwrite');
      tx.objectStore('query_cache').put({ key, data, contentRange, ts: Date.now() });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Non-critical
  }
}

// ─── pending_mutations (coda scritture offline per offlineFetch) ──────────────

export interface PendingMutation {
  id?: number;
  url: string;
  method: string;
  body: string | null;
  headers: Record<string, string>;
  ts: number;
}

export async function addPendingMutation(m: Omit<PendingMutation, 'id'>): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('pending_mutations', 'readwrite');
      tx.objectStore('pending_mutations').add(m);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch { /* Non-critical */ }
}

export async function getPendingMutations(): Promise<PendingMutation[]> {
  try {
    const db = await openDb();
    return new Promise((resolve) => {
      const tx = db.transaction('pending_mutations', 'readonly');
      const req = tx.objectStore('pending_mutations').getAll();
      req.onsuccess = () => resolve(req.result as PendingMutation[]);
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

export async function deletePendingMutation(id: number): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('pending_mutations', 'readwrite');
      tx.objectStore('pending_mutations').delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch { /* Non-critical */ }
}

export async function countPendingMutations(): Promise<number> {
  try {
    const db = await openDb();
    return new Promise((resolve) => {
      const tx = db.transaction('pending_mutations', 'readonly');
      const req = tx.objectStore('pending_mutations').count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(0);
    });
  } catch {
    return 0;
  }
}

// ─── table_cache (cache tabella intera, usata per letture bulk) ───────────────

export async function setTableCache(table: string, userId: string, rows: unknown[]): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('table_cache', 'readwrite');
      tx.objectStore('table_cache').put({ key: `${table}:${userId}`, rows, ts: Date.now() });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch { /* Non-critical */ }
}

export async function invalidateTableCache(table: string, userId: string): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('table_cache', 'readwrite');
      tx.objectStore('table_cache').delete(`${table}:${userId}`);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch { /* Non-critical */ }
}

export async function deleteTableCache(table: string, userId: string): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction('table_cache', 'readwrite');
      tx.objectStore('table_cache').delete(`${table}:${userId}`);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch { /* Non-critical */ }
}

export async function getTableCache(table: string, userId: string): Promise<unknown[] | null> {
  try {
    const db = await openDb();
    return new Promise((resolve) => {
      const tx = db.transaction('table_cache', 'readonly');
      const req = tx.objectStore('table_cache').get(`${table}:${userId}`);
      req.onsuccess = () => resolve(req.result ? (req.result.rows as unknown[]) : null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

// ─── local_rows (store per-riga — cuore del Local-First per browser) ──────────
//
// Schema di ogni entry:
//   pk: `{table}:{userId}:{rowId}`  — chiave primaria IDB
//   table, userId, id               — campi per gli indici
//   updated_at: ISO string          — usato per il confronto timestamp durante sync
//   dirty: 0 | 1                    — 1 = da inviare a Supabase, 0 = già sincronizzato
//   deleted: 0 | 1                  — soft-delete per propagare le cancellazioni
//   data: Record<string,unknown>    — i dati completi della riga

export interface LocalRow {
  pk: string;
  table: string;
  userId: string;
  id: string;
  updated_at: string;
  dirty: 0 | 1;
  deleted: 0 | 1;
  data: Record<string, unknown>;
}

function rowPk(table: string, userId: string, id: string): string {
  return `${table}:${userId}:${id}`;
}

/** Scrive o aggiorna una riga nel local_rows store e aggiorna table_cache. */
export async function localRowUpsert(
  table: string,
  userId: string,
  rowData: Record<string, unknown>,
  dirty: 0 | 1 = 1
): Promise<void> {
  const id = rowData.id as string;
  if (!id) return;
  const updated_at = (rowData.updated_at as string | undefined) ?? new Date().toISOString();
  const entry: LocalRow = {
    pk: rowPk(table, userId, id),
    table, userId, id, updated_at, dirty, deleted: 0,
    data: rowData,
  };
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(['local_rows', 'table_cache'], 'readwrite');
      tx.objectStore('local_rows').put(entry);

      // Aggiorna anche table_cache in modo atomico
      const cacheStore = tx.objectStore('table_cache');
      const cacheKey = `${table}:${userId}`;
      const cacheReq = cacheStore.get(cacheKey);
      cacheReq.onsuccess = () => {
        const current = cacheReq.result;
        const rows: Record<string, unknown>[] = current ? (current.rows as Record<string, unknown>[]) : [];
        const idx = rows.findIndex(r => r.id === id);
        if (idx >= 0) rows[idx] = rowData; else rows.push(rowData);
        cacheStore.put({ key: cacheKey, rows, ts: Date.now() });
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch { /* Non-critical */ }
}

/** Marca una riga come soft-deleted (dirty=1, deleted=1) e la rimuove da table_cache. */
export async function localRowDelete(table: string, userId: string, id: string): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(['local_rows', 'table_cache'], 'readwrite');

      const rowStore = tx.objectStore('local_rows');
      const pk = rowPk(table, userId, id);
      const getReq = rowStore.get(pk);
      getReq.onsuccess = () => {
        const existing: LocalRow = getReq.result ?? { pk, table, userId, id, updated_at: new Date().toISOString(), dirty: 1, deleted: 0, data: { id } };
        rowStore.put({ ...existing, dirty: 1, deleted: 1, updated_at: new Date().toISOString() });
      };

      const cacheStore = tx.objectStore('table_cache');
      const cacheKey = `${table}:${userId}`;
      const cacheReq = cacheStore.get(cacheKey);
      cacheReq.onsuccess = () => {
        if (!cacheReq.result) return;
        const rows = (cacheReq.result.rows as Record<string, unknown>[]).filter(r => r.id !== id);
        cacheStore.put({ key: cacheKey, rows, ts: Date.now() });
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch { /* Non-critical */ }
}

/** Legge tutte le righe dirty (da sincronizzare) per una tabella. */
export async function localRowGetDirty(table: string, userId: string): Promise<LocalRow[]> {
  try {
    const db = await openDb();
    return new Promise((resolve) => {
      const tx = db.transaction('local_rows', 'readonly');
      const req = tx.objectStore('local_rows').index('by_dirty').getAll([table, userId, 1]);
      req.onsuccess = () => resolve(req.result as LocalRow[]);
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

/** Legge tutte le righe per una tabella/utente (per il confronto durante sync). */
export async function localRowGetAll(table: string, userId: string): Promise<LocalRow[]> {
  try {
    const db = await openDb();
    return new Promise((resolve) => {
      const tx = db.transaction('local_rows', 'readonly');
      const req = tx.objectStore('local_rows').index('by_table_user').getAll([table, userId]);
      req.onsuccess = () => resolve(req.result as LocalRow[]);
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

/** Legge una singola riga. */
export async function localRowGet(table: string, userId: string, id: string): Promise<LocalRow | null> {
  try {
    const db = await openDb();
    return new Promise((resolve) => {
      const tx = db.transaction('local_rows', 'readonly');
      const req = tx.objectStore('local_rows').get(rowPk(table, userId, id));
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/** Marca una riga come sincronizzata (dirty=0). */
export async function localRowMarkSynced(table: string, userId: string, id: string): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('local_rows', 'readwrite');
      const store = tx.objectStore('local_rows');
      const pk = rowPk(table, userId, id);
      const req = store.get(pk);
      req.onsuccess = () => {
        if (req.result) store.put({ ...req.result, dirty: 0 });
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch { /* Non-critical */ }
}

/** Sovrascrive una riga con dati da Supabase (dirty=0, non-dirty = dati cloud più recenti). */
export async function localRowApplyRemote(
  table: string,
  userId: string,
  remoteData: Record<string, unknown>
): Promise<void> {
  const id = remoteData.id as string;
  if (!id) return;
  const updated_at = (remoteData.updated_at as string | undefined) ?? new Date().toISOString();
  const entry: LocalRow = {
    pk: rowPk(table, userId, id),
    table, userId, id, updated_at,
    dirty: 0, deleted: 0,
    data: remoteData,
  };
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(['local_rows', 'table_cache'], 'readwrite');
      tx.objectStore('local_rows').put(entry);

      const cacheStore = tx.objectStore('table_cache');
      const cacheKey = `${table}:${userId}`;
      const cacheReq = cacheStore.get(cacheKey);
      cacheReq.onsuccess = () => {
        const current = cacheReq.result;
        const rows: Record<string, unknown>[] = current ? (current.rows as Record<string, unknown>[]) : [];
        const idx = rows.findIndex(r => r.id === id);
        if (idx >= 0) rows[idx] = remoteData; else rows.push(remoteData);
        cacheStore.put({ key: cacheKey, rows, ts: Date.now() });
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch { /* Non-critical */ }
}

/** Carica in bulk righe remote nella table_cache (usato da prefetchToIndexedDb). */
export async function localRowBulkApplyRemote(
  table: string,
  userId: string,
  remoteRows: Record<string, unknown>[]
): Promise<void> {
  if (remoteRows.length === 0) return;
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(['local_rows', 'table_cache'], 'readwrite');
      const rowStore = tx.objectStore('local_rows');
      const cacheStore = tx.objectStore('table_cache');

      // Scrivi ogni riga nel local_rows store
      for (const remoteData of remoteRows) {
        const id = remoteData.id as string;
        if (!id) continue;
        const updated_at = (remoteData.updated_at as string | undefined) ?? new Date().toISOString();
        rowStore.put({
          pk: rowPk(table, userId, id),
          table, userId, id, updated_at,
          dirty: 0, deleted: 0,
          data: remoteData,
        } as LocalRow);
      }

      // Aggiorna table_cache in blocco
      cacheStore.put({ key: `${table}:${userId}`, rows: remoteRows, ts: Date.now() });

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch { /* Non-critical */ }
}

/** Elimina fisicamente tutte le righe di una tabella/utente dallo store. */
export async function localRowClearTable(table: string, userId: string): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('local_rows', 'readwrite');
      const store = tx.objectStore('local_rows');
      const req = store.index('by_table_user').getAll([table, userId]);
      req.onsuccess = () => {
        for (const entry of (req.result as LocalRow[])) {
          store.delete(entry.pk);
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch { /* Non-critical */ }
}
