import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Service role client (bypasses RLS — for reading sistema_config and push_subscriptions)
const sbAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// ── VAPID key helpers ─────────────────────────────────────────────────────────

function base64UrlEncode(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function base64UrlDecode(str: string): Uint8Array {
  const padded = str + "==".slice(0, (4 - (str.length % 4)) % 4);
  const b64 = padded.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function generateVAPIDKeys(): Promise<{ publicKey: string; privateKey: string }> {
  const keyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveKey", "deriveBits"],
  );

  // Public key: raw format = uncompressed point (65 bytes) — this IS the VAPID public key
  const rawPublic = await crypto.subtle.exportKey("raw", keyPair.publicKey);

  // Private key: PKCS8 wraps the raw 32-byte private key — we need to extract it
  const pkcs8 = await crypto.subtle.exportKey("pkcs8", keyPair.privateKey);
  // PKCS8 for P-256: the raw private key starts at byte 36 (7 + 1 + 1 + 1 + ... ASN.1)
  // More robust: use jwk format
  const jwk = await crypto.subtle.exportKey("jwk", keyPair.privateKey);
  // d is the private key scalar as base64url
  const privateKey = jwk.d!;

  return {
    publicKey: base64UrlEncode(rawPublic),
    privateKey,
  };
}

async function getOrCreateVAPIDKeys(): Promise<{ publicKey: string; privateKey: string }> {
  const { data: pubRow } = await sbAdmin
    .from("sistema_config")
    .select("valore")
    .eq("chiave", "vapid_public_key")
    .maybeSingle();

  const { data: privRow } = await sbAdmin
    .from("sistema_config")
    .select("valore")
    .eq("chiave", "vapid_private_key")
    .maybeSingle();

  if (pubRow?.valore && privRow?.valore) {
    return { publicKey: pubRow.valore, privateKey: privRow.valore };
  }

  // Generate new keys
  const keys = await generateVAPIDKeys();

  await sbAdmin.from("sistema_config").upsert([
    { chiave: "vapid_public_key", valore: keys.publicKey },
    { chiave: "vapid_private_key", valore: keys.privateKey },
  ], { onConflict: "chiave" });

  return keys;
}

// ── VAPID JWT builder ─────────────────────────────────────────────────────────

async function buildVAPIDJWT(
  audience: string,
  privateKeyB64: string,
): Promise<string> {
  const header = { typ: "JWT", alg: "ES256" };
  const payload = {
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: "mailto:salone@gestionale.app",
  };

  const enc = (obj: unknown) =>
    base64UrlEncode(new TextEncoder().encode(JSON.stringify(obj)));
  const signingInput = `${enc(header)}.${enc(payload)}`;

  // Import private key from raw d value
  const dBytes = base64UrlDecode(privateKeyB64);
  // We need to import as PKCS8 or JWK — JWK is easiest
  const jwk = {
    kty: "EC",
    crv: "P-256",
    d: privateKeyB64,
    // We also need x and y — derive from the private key or fetch them
    // Actually, for signing we only need d, but WebCrypto JWK requires x and y too.
    // Let's retrieve from stored public key.
  };

  return buildVAPIDJWTFromJWK(signingInput, dBytes);
}

async function buildVAPIDJWTFromJWK(
  signingInput: string,
  _dBytes: Uint8Array,
): Promise<string> {
  // We need the full JWK — retrieve public key bytes and extract x,y from the stored public key
  const { data: pubRow } = await sbAdmin
    .from("sistema_config")
    .select("valore")
    .eq("chiave", "vapid_public_key")
    .maybeSingle();

  const pubBytes = base64UrlDecode(pubRow!.valore);
  // Uncompressed point: 0x04 || x (32) || y (32)
  const x = base64UrlEncode(pubBytes.slice(1, 33));
  const y = base64UrlEncode(pubBytes.slice(33, 65));

  const { data: privRow } = await sbAdmin
    .from("sistema_config")
    .select("valore")
    .eq("chiave", "vapid_private_key")
    .maybeSingle();

  const jwk = { kty: "EC", crv: "P-256", d: privRow!.valore, x, y };
  const key = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );

  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: { name: "SHA-256" } },
    key,
    new TextEncoder().encode(signingInput),
  );

  return `${signingInput}.${base64UrlEncode(sig)}`;
}

// ── Web Push sender ───────────────────────────────────────────────────────────

async function sendPushNotification(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: string,
  vapidKeys: { publicKey: string; privateKey: string },
): Promise<void> {
  const url = new URL(subscription.endpoint);
  const audience = `${url.protocol}//${url.host}`;

  const jwt = await buildVAPIDJWT(audience, vapidKeys.privateKey);

  // Encrypt the payload using ECDH + AES-GCM (Web Push encryption - RFC 8291)
  const encrypted = await encryptPayload(
    payload,
    subscription.p256dh,
    subscription.auth,
  );

  const res = await fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      "Authorization": `vapid t=${jwt},k=${vapidKeys.publicKey}`,
      "Content-Type": "application/octet-stream",
      "Content-Encoding": "aes128gcm",
      "TTL": "86400",
    },
    body: encrypted,
  });

  if (!res.ok && res.status !== 201) {
    const text = await res.text().catch(() => "");
    throw new Error(`Push failed ${res.status}: ${text}`);
  }
}

// ── Web Push payload encryption (RFC 8291 / aes128gcm) ───────────────────────

async function encryptPayload(
  plaintext: string,
  clientPublicKeyB64: string,
  authSecretB64: string,
): Promise<Uint8Array> {
  const clientPublicKey = base64UrlDecode(clientPublicKeyB64);
  const authSecret = base64UrlDecode(authSecretB64);
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // Generate server ephemeral EC key pair
  const serverKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveKey", "deriveBits"],
  );
  const serverPublicKeyRaw = new Uint8Array(
    await crypto.subtle.exportKey("raw", serverKeyPair.publicKey),
  );

  // Import client public key
  const clientKey = await crypto.subtle.importKey(
    "raw",
    clientPublicKey,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );

  // ECDH shared secret
  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "ECDH", public: clientKey },
      serverKeyPair.privateKey,
      256,
    ),
  );

  // HKDF to derive content encryption key and nonce
  const encoder = new TextEncoder();

  // PRK = HKDF-Extract(auth_secret, ecdh_secret)
  const prk = await hkdfExtract(authSecret, sharedSecret);

  // IKM = HKDF-Expand(PRK, "WebPush: info" || 0x00 || client_pub || server_pub, 32)
  const keyInfo = concatBytes(
    encoder.encode("WebPush: info\x00"),
    clientPublicKey,
    serverPublicKeyRaw,
  );
  const ikm = await hkdfExpand(prk, keyInfo, 32);

  // Content encryption key: HKDF(ikm, salt, "Content-Encoding: aes128gcm\x00\x01", 16)
  const cekInfo = encoder.encode("Content-Encoding: aes128gcm\x00\x01");
  const prkSalt = await hkdfExtract(salt, ikm);
  const cek = await hkdfExpand(prkSalt, cekInfo, 16);

  // Nonce: HKDF(ikm, salt, "Content-Encoding: nonce\x00\x01", 12)
  const nonceInfo = encoder.encode("Content-Encoding: nonce\x00\x01");
  const nonce = await hkdfExpand(prkSalt, nonceInfo, 12);

  // Import CEK for AES-GCM
  const aesKey = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);

  // Encrypt: plaintext + padding delimiter (0x02) — no padding needed
  const plaintextBytes = encoder.encode(plaintext);
  const paddedPlaintext = new Uint8Array(plaintextBytes.length + 1);
  paddedPlaintext.set(plaintextBytes);
  paddedPlaintext[plaintextBytes.length] = 0x02; // padding delimiter

  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aesKey, paddedPlaintext),
  );

  // Build aes128gcm content: salt (16) + record_size (4) + key_len (1) + server_pub (65) + ciphertext
  const recordSize = ciphertext.length + 16 + 1;
  const header = new Uint8Array(21 + serverPublicKeyRaw.length);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, recordSize + paddedPlaintext.length + 16, false);
  header[20] = serverPublicKeyRaw.length;
  header.set(serverPublicKeyRaw, 21);

  // Proper aes128gcm header: salt(16) + rs(4, big-endian) + idlen(1) + server_pub(65) + ciphertext
  const rs = 4096; // record size
  const out = new Uint8Array(16 + 4 + 1 + serverPublicKeyRaw.length + ciphertext.length);
  out.set(salt, 0);
  new DataView(out.buffer).setUint32(16, rs, false);
  out[20] = serverPublicKeyRaw.length;
  out.set(serverPublicKeyRaw, 21);
  out.set(ciphertext, 21 + serverPublicKeyRaw.length);

  return out;
}

// RFC 5869 HKDF-Extract: PRK = HMAC-SHA256(salt, ikm)
async function hkdfExtract(salt: Uint8Array, ikm: Uint8Array): Promise<Uint8Array> {
  const effectiveSalt = salt.length > 0 ? salt : new Uint8Array(32); // zero-filled if no salt
  const hmacKey = await crypto.subtle.importKey(
    "raw",
    effectiveSalt,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const prk = await crypto.subtle.sign("HMAC", hmacKey, ikm);
  return new Uint8Array(prk);
}

// RFC 5869 HKDF-Expand: OKM = T(1) || T(2) || ...
// T(i) = HMAC-SHA256(PRK, T(i-1) || info || i)
async function hkdfExpand(prk: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const hmacKey = await crypto.subtle.importKey(
    "raw",
    prk,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const result = new Uint8Array(length);
  let prev = new Uint8Array(0);
  let offset = 0;
  for (let i = 1; offset < length; i++) {
    const input = new Uint8Array(prev.length + info.length + 1);
    input.set(prev, 0);
    input.set(info, prev.length);
    input[prev.length + info.length] = i;
    prev = new Uint8Array(await crypto.subtle.sign("HMAC", hmacKey, input));
    const toCopy = Math.min(prev.length, length - offset);
    result.set(prev.subarray(0, toCopy), offset);
    offset += toCopy;
  }
  return result;
}

function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) { out.set(a, offset); offset += a.length; }
  return out;
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/web-push/, "");

  // GET /vapid-public-key — returns the VAPID public key for this project
  if (req.method === "GET" && path === "/vapid-public-key") {
    const keys = await getOrCreateVAPIDKeys();
    return json({ publicKey: keys.publicKey });
  }

  // POST /subscribe — save a push subscription (authenticated user)
  if (req.method === "POST" && path === "/subscribe") {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const sbUser = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await sbUser.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json();
    const { endpoint, p256dh, auth } = body;
    if (!endpoint || !p256dh || !auth) return json({ error: "Dati mancanti" }, 400);

    await sbAdmin.from("push_subscriptions").upsert({
      user_id: user.id,
      endpoint,
      p256dh,
      auth,
    }, { onConflict: "user_id,endpoint" });

    return json({ success: true });
  }

  // DELETE /subscribe — remove a push subscription
  if (req.method === "DELETE" && path === "/subscribe") {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const sbUser = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await sbUser.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json();
    await sbAdmin.from("push_subscriptions").delete()
      .eq("user_id", user.id)
      .eq("endpoint", body.endpoint);

    return json({ success: true });
  }

  // POST /notify — send push notification to all subscriptions for a user (server-side only)
  if (req.method === "POST" && path === "/notify") {
    const authHeader = req.headers.get("Authorization");
    // Must be called with service role key
    if (!authHeader?.includes(SERVICE_ROLE_KEY)) {
      return json({ error: "Forbidden" }, 403);
    }

    const body = await req.json();
    const { user_id, title, message, data: notifData } = body;
    if (!user_id) return json({ error: "user_id richiesto" }, 400);

    const { data: subs } = await sbAdmin
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("user_id", user_id);

    if (!subs || subs.length === 0) return json({ sent: 0 });

    const vapidKeys = await getOrCreateVAPIDKeys();
    const payload = JSON.stringify({
      title: title ?? "Nuova richiesta",
      body: message ?? "Una cliente ha richiesto un appuntamento",
      data: notifData ?? {},
    });

    const results = await Promise.allSettled(
      subs.map((sub) =>
        sendPushNotification(
          { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
          payload,
          vapidKeys,
        )
      ),
    );

    // Remove subscriptions that returned 410 Gone (expired/unsubscribed)
    const gone: string[] = [];
    results.forEach((r, i) => {
      if (r.status === "rejected" && String(r.reason).includes("410")) {
        gone.push(subs[i].endpoint);
      }
    });
    if (gone.length > 0) {
      for (const ep of gone) {
        await sbAdmin.from("push_subscriptions").delete()
          .eq("user_id", user_id).eq("endpoint", ep);
      }
    }

    const sent = results.filter((r) => r.status === "fulfilled").length;
    return json({ sent });
  }

  return json({ error: "Not found" }, 404);
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
