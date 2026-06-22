import type { SavePathType } from '../electron.d';

/**
 * Save a file either to the Electron-configured folder (if running as installed app)
 * or trigger a browser download (web/dev).
 * Returns the saved file path when in Electron, or null for browser download.
 */
export async function saveFile(
  type: SavePathType,
  filename: string,
  content: string | Blob | ArrayBuffer,
  encoding: 'utf8' | 'base64' = 'utf8',
): Promise<{ filePath?: string } | null> {
  const api = (window as any).electronAPI;

  if (api?.saveFileTo) {
    let strContent: string;
    let enc: 'utf8' | 'base64' = encoding;

    if (typeof content === 'string') {
      strContent = content;
    } else if (content instanceof Blob) {
      const buf = await content.arrayBuffer();
      strContent = arrayBufferToBase64(buf);
      enc = 'base64';
    } else {
      strContent = arrayBufferToBase64(content);
      enc = 'base64';
    }

    const result = await api.saveFileTo(type, filename, strContent, enc);
    if (result.ok) return { filePath: result.filePath };
    // Folder not configured or write failed: fall back to download dialog
    browserDownload(filename, content);
    return null;
  }

  // Browser fallback
  browserDownload(filename, content);
  return null;
}

export function browserDownload(filename: string, content: string | Blob | ArrayBuffer): void {
  let url: string;
  let needsRevoke = false;

  if (typeof content === 'string') {
    const blob = new Blob([content], { type: mimeFromFilename(filename) });
    url = URL.createObjectURL(blob);
    needsRevoke = true;
  } else if (content instanceof Blob) {
    url = URL.createObjectURL(content);
    needsRevoke = true;
  } else {
    const blob = new Blob([content]);
    url = URL.createObjectURL(blob);
    needsRevoke = true;
  }

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  if (needsRevoke) setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function mimeFromFilename(filename: string): string {
  if (filename.endsWith('.pdf')) return 'application/pdf';
  if (filename.endsWith('.json')) return 'application/json';
  if (filename.endsWith('.csv')) return 'text/csv';
  if (filename.endsWith('.html')) return 'text/html';
  return 'application/octet-stream';
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}
