import { getCachedData, setCachedData, addPendingMutation, getPendingMutations, deletePendingMutation, countPendingMutations } from './indexedDb';
import { supabase } from './supabase';

// Expose pending count for UI
export type SyncState = 'idle' | 'syncing' | 'error';

type Listener = (online: boolean, pending: number, state: SyncState) => void;
const listeners: Listener[] = [];

let _online = navigator.onLine;
let _pending = 0;
let _syncState: SyncState = 'idle';
let syncTimer: ReturnType<typeof setTimeout> | null = null;

export function onOfflineStateChange(fn: Listener) {
  listeners.push(fn);
  fn(_online, _pending, _syncState);
  return () => {
    const i = listeners.indexOf(fn);
    if (i !== -1) listeners.splice(i, 1);
  };
}

function notify() {
  listeners.forEach((fn) => fn(_online, _pending, _syncState));
}

async function refreshPendingCount() {
  _pending = await countPendingMutations();
  notify();
}

const originalFetch = window.fetch.bind(window);

function isSupabaseRest(url: string): boolean {
  return url.includes('/rest/v1/') && !url.includes('/auth/v1/') && !url.includes('/functions/v1/');
}

function headersToObject(headers: HeadersInit | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!headers) return out;
  const h = headers instanceof Headers ? headers : new Headers(headers as Record<string, string>);
  h.forEach((v, k) => {
    // Don't store auth headers – we re-inject them at sync time
    if (k.toLowerCase() !== 'authorization') out[k] = v;
  });
  return out;
}

async function getCurrentAuthHeader(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ? `Bearer ${session.access_token}` : '';
}

async function syncPending() {
  if (!_online) return;
  const pending = await getPendingMutations();
  if (pending.length === 0) return;

  _syncState = 'syncing';
  notify();

  let failed = false;
  for (const m of pending) {
    try {
      const authHeader = await getCurrentAuthHeader();
      const headers: Record<string, string> = { ...m.headers };
      if (authHeader) headers['Authorization'] = authHeader;

      const res = await originalFetch(m.url, {
        method: m.method,
        headers,
        body: m.body ?? undefined,
      });

      if (res.ok || res.status === 404 || res.status === 409) {
        // Success or conflict/not-found: remove from queue regardless
        await deletePendingMutation(m.id!);
      } else {
        failed = true;
        break;
      }
    } catch {
      failed = true;
      break;
    }
  }

  _syncState = failed ? 'error' : 'idle';
  await refreshPendingCount();
}

function scheduleSync(delay = 2000) {
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => syncPending(), delay);
}

window.addEventListener('online', () => {
  _online = true;
  notify();
  scheduleSync(1000);
});

window.addEventListener('offline', () => {
  _online = false;
  notify();
});

export function initOfflineFetch() {
  // Set initial state
  refreshPendingCount();

  window.fetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
        ? input.href
        : (input as Request).url;

    if (!isSupabaseRest(url)) {
      return originalFetch(input, init);
    }

    const method = (init?.method || (input instanceof Request ? (input as Request).method : 'GET')).toUpperCase();
    const isRead = method === 'GET' || method === 'HEAD';
    const cacheKey = `${method}:${url}`;

    if (!navigator.onLine) {
      if (isRead) {
        const cached = await getCachedData(cacheKey);
        const body = JSON.stringify(cached?.data ?? []);
        const contentRange = cached?.contentRange ?? '0-0/0';
        return new Response(body, {
          status: 200,
          headers: new Headers({
            'Content-Type': 'application/json',
            'Content-Range': contentRange,
          }),
        });
      } else {
        // Queue the mutation
        let rawBody: string | null = null;
        if (init?.body) {
          rawBody = typeof init.body === 'string' ? init.body : JSON.stringify(init.body);
        }

        await addPendingMutation({
          url,
          method,
          body: rawBody,
          headers: headersToObject(init?.headers),
          ts: Date.now(),
        });

        await refreshPendingCount();

        // Return optimistic success so the UI doesn't break
        const fakeData = rawBody ? (() => { try { return JSON.parse(rawBody!); } catch { return null; } })() : null;
        const fakeArray = Array.isArray(fakeData) ? fakeData : fakeData ? [fakeData] : [];
        return new Response(JSON.stringify(fakeArray), {
          status: method === 'POST' ? 201 : 200,
          headers: new Headers({ 'Content-Type': 'application/json' }),
        });
      }
    }

    // Online: execute normally
    try {
      const response = await originalFetch(input, init);

      if (isRead && response.ok) {
        try {
          const cloned = response.clone();
          const data = await cloned.json();
          const cr = response.headers.get('Content-Range');
          await setCachedData(cacheKey, data, cr);
        } catch {
          // Cache write failure is non-critical
        }
      }

      return response;
    } catch (err) {
      // Network failure — try cache for reads
      if (isRead) {
        const cached = await getCachedData(cacheKey);
        if (cached !== null) {
          return new Response(JSON.stringify(cached.data), {
            status: 200,
            headers: new Headers({
              'Content-Type': 'application/json',
              'Content-Range': cached.contentRange ?? '0-0/0',
            }),
          });
        }
      }
      throw err;
    }
  };

  // Attempt sync on startup in case there are queued mutations from a previous session
  if (navigator.onLine) scheduleSync(3000);
}
