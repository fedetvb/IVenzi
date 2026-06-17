import { supabase } from './supabase';

const EDGE_BASE = `${import.meta.env.VITE_SUPABASE_URL ?? 'https://qfpeffzdszdanebmgafb.supabase.co'}/functions/v1/web-push`;

export async function getVapidPublicKey(): Promise<string | null> {
  try {
    const res = await fetch(`${EDGE_BASE}/vapid-public-key`);
    const data = await res.json();
    return data.publicKey ?? null;
  } catch {
    return null;
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from(rawData, (c) => c.charCodeAt(0));
}

export async function subscribePush(): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;

  try {
    const vapidPublicKey = await getVapidPublicKey();
    if (!vapidPublicKey) return false;

    const reg = await navigator.serviceWorker.ready;
    const existing = await reg.pushManager.getSubscription();

    if (existing) {
      // Check if the VAPID key matches — if not, force a fresh subscription
      const existingKey = existing.options?.applicationServerKey;
      const expectedKey = urlBase64ToUint8Array(vapidPublicKey);
      let keyMatches = false;
      if (existingKey) {
        const existingBytes = new Uint8Array(existingKey as ArrayBuffer);
        keyMatches = existingBytes.length === expectedKey.length &&
          existingBytes.every((b, i) => b === expectedKey[i]);
      }

      if (keyMatches) {
        await savePushSubscription(existing);
        return true;
      }

      // Keys don't match — unsubscribe and re-subscribe
      await existing.unsubscribe();
    }

    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });

    await savePushSubscription(subscription);
    return true;
  } catch (e) {
    console.warn('[Push] Errore sottoscrizione:', e);
    return false;
  }
}

async function savePushSubscription(sub: PushSubscription): Promise<void> {
  const json = sub.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return;

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;

  await fetch(`${EDGE_BASE}/subscribe`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
    }),
  });
}

export async function unsubscribePush(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return;

    const json = sub.toJSON();
    const { data: { session } } = await supabase.auth.getSession();
    if (session && json.endpoint) {
      await fetch(`${EDGE_BASE}/subscribe`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ endpoint: json.endpoint }),
      });
    }
    await sub.unsubscribe();
  } catch (e) {
    console.warn('[Push] Errore unsubscribe:', e);
  }
}

export function isPushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export function getPushPermission(): NotificationPermission | 'unsupported' {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

export async function requestPushPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) return 'denied';
  const perm = await Notification.requestPermission();
  return perm;
}
