const DB_NAME = 'gestionale_offline';
const DB_VERSION = 2;

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
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      dbPromise = null;
      reject(req.error);
    };
  });
  return dbPromise;
}

export async function getCachedData(key: string): Promise<{ data: unknown; contentRange: string | null } | null> {
  try {
    const db = await openDb();
    return new Promise((resolve) => {
      const tx = db.transaction('query_cache', 'readonly');
      const store = tx.objectStore('query_cache');
      const req = store.get(key);
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
    // Non-critical: ignore cache write errors
  }
}

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
  } catch {
    // Non-critical
  }
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
  } catch {
    // Non-critical
  }
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

// ─── Cache tabelle per offline (chiavi stabili, indipendenti dal token) ────────

export async function setTableCache(table: string, userId: string, rows: unknown[]): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('table_cache', 'readwrite');
      tx.objectStore('table_cache').put({ key: `${table}:${userId}`, rows, ts: Date.now() });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Non-critical
  }
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
  } catch {
    // Non-critical
  }
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
  } catch { /* non-critical */ }
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
