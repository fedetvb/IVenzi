/**
 * Sistema di licenza a doppio OTP.
 *
 * - BUILD_MODE=owner  → nessuna parete, tutto sbloccato
 * - BUILD_MODE=user   → WALL 1 (attivazione locale) + WALL 2 (attivazione cloud)
 *
 * Tutti i dati di attivazione sono persistiti in localStorage,
 * crittograficamente vincolati all'hardware ID del dispositivo.
 */

// Costanti salt (identiche a quelle in electron/main.js)
const MASTER_SALT = 'MioBrandEsclusivoPass2026';
const CLOUD_SALT = 'CloudActivationSalt2026';

const LS_LOCAL_ACTIVATED = 'license_local_activated';
const LS_CLOUD_ACTIVATED = 'license_cloud_activated';
const LS_HARDWARE_ID = 'license_hardware_id';
const LS_CLOUD_REQUEST_ID = 'license_cloud_request_id';
const LS_LOCAL_OTP_CODE = 'license_local_otp_code';
const LS_CLOUD_OTP_CODE = 'license_cloud_otp_code';

// ─── Build mode ───────────────────────────────────────────────────────────────

export type BuildMode = 'owner' | 'user';

export function getBuildMode(): BuildMode {
  return (import.meta.env.VITE_BUILD_MODE as BuildMode) || 'owner';
}

export function isOwnerBuild(): boolean {
  return getBuildMode() === 'owner';
}

// ─── SHA-256 browser-native ───────────────────────────────────────────────────

async function sha256Hex(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

// ─── Generazione OTP ─────────────────────────────────────────────────────────

export async function generateLocalOtp(hardwareId: string): Promise<string> {
  const hash = await sha256Hex(hardwareId + MASTER_SALT);
  return hash.substring(0, 4) + '-' + hash.substring(4, 8);
}

export async function generateCloudOtp(cloudRequestId: string): Promise<string> {
  const hash = await sha256Hex(cloudRequestId + CLOUD_SALT);
  return hash.substring(0, 4) + '-' + hash.substring(4, 8);
}

// ─── Hardware/Cloud ID (da Electron IPC o generato in browser) ────────────────

export async function getHardwareId(): Promise<string> {
  // Cache in localStorage per evitare IPC ripetuti
  const cached = localStorage.getItem(LS_HARDWARE_ID);
  if (cached) return cached;

  if (window.electronAPI && 'license' in window.electronAPI) {
    const api = window.electronAPI as unknown as { license: { getHardwareId: () => Promise<{ hardwareId: string }> } };
    try {
      const { hardwareId } = await api.license.getHardwareId();
      localStorage.setItem(LS_HARDWARE_ID, hardwareId);
      return hardwareId;
    } catch { /* fallback */ }
  }

  // Fallback browser: genera un fingerprint deterministico da user agent + screen
  const raw = navigator.userAgent + screen.width + screen.height + navigator.language;
  const hash = await sha256Hex(raw);
  const id = hash.substring(0, 16);
  localStorage.setItem(LS_HARDWARE_ID, id);
  return id;
}

export async function getCloudRequestId(): Promise<string> {
  const cached = localStorage.getItem(LS_CLOUD_REQUEST_ID);
  if (cached) return cached;

  if (window.electronAPI && 'license' in window.electronAPI) {
    const api = window.electronAPI as unknown as { license: { getCloudRequestId: () => Promise<{ cloudRequestId: string }> } };
    try {
      const { cloudRequestId } = await api.license.getCloudRequestId();
      localStorage.setItem(LS_CLOUD_REQUEST_ID, cloudRequestId);
      return cloudRequestId;
    } catch { /* fallback */ }
  }

  // Fallback: variante dell'hardware ID
  const hwId = await getHardwareId();
  const hash = await sha256Hex(hwId + 'CLOUD');
  const id = hash.substring(0, 16);
  localStorage.setItem(LS_CLOUD_REQUEST_ID, id);
  return id;
}

// ─── Stato attivazione ────────────────────────────────────────────────────────

export interface LicenseState {
  localActivated: boolean;
  cloudActivated: boolean;
  hardwareId: string;
  cloudRequestId: string;
  localOtpCode: string;
  cloudOtpCode: string;
}

export async function getLicenseState(): Promise<LicenseState> {
  if (isOwnerBuild()) {
    return {
      localActivated: true,
      cloudActivated: true,
      hardwareId: '',
      cloudRequestId: '',
      localOtpCode: '',
      cloudOtpCode: '',
    };
  }

  const [hardwareId, cloudRequestId] = await Promise.all([getHardwareId(), getCloudRequestId()]);

  return {
    localActivated: localStorage.getItem(LS_LOCAL_ACTIVATED) === 'true',
    cloudActivated: localStorage.getItem(LS_CLOUD_ACTIVATED) === 'true',
    hardwareId,
    cloudRequestId,
    localOtpCode: localStorage.getItem(LS_LOCAL_OTP_CODE) ?? '',
    cloudOtpCode: localStorage.getItem(LS_CLOUD_OTP_CODE) ?? '',
  };
}

// ─── Verifica e attivazione ───────────────────────────────────────────────────

export async function verifyLocalOtp(inputOtp: string): Promise<boolean> {
  const hardwareId = await getHardwareId();
  const expected = await generateLocalOtp(hardwareId);
  // Confronto case-insensitive, normalizza trattino
  const normalize = (s: string) => s.toUpperCase().replace(/[^A-F0-9]/g, '');
  const match = normalize(inputOtp) === normalize(expected);
  if (match) {
    localStorage.setItem(LS_LOCAL_ACTIVATED, 'true');
    localStorage.setItem(LS_LOCAL_OTP_CODE, inputOtp.toUpperCase());
  }
  return match;
}

export async function verifyCloudOtp(inputOtp: string): Promise<boolean> {
  const cloudRequestId = await getCloudRequestId();
  const expected = await generateCloudOtp(cloudRequestId);
  const normalize = (s: string) => s.toUpperCase().replace(/[^A-F0-9]/g, '');
  const match = normalize(inputOtp) === normalize(expected);
  if (match) {
    localStorage.setItem(LS_CLOUD_ACTIVATED, 'true');
    localStorage.setItem(LS_CLOUD_OTP_CODE, inputOtp.toUpperCase());
  }
  return match;
}

export function resetLicense(): void {
  localStorage.removeItem(LS_LOCAL_ACTIVATED);
  localStorage.removeItem(LS_CLOUD_ACTIVATED);
  localStorage.removeItem(LS_HARDWARE_ID);
  localStorage.removeItem(LS_CLOUD_REQUEST_ID);
  localStorage.removeItem(LS_LOCAL_OTP_CODE);
  localStorage.removeItem(LS_CLOUD_OTP_CODE);
}
