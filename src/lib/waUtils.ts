/** Normalizza un numero di telefono per le API WhatsApp (solo cifre, prefisso IT). */
export function normalizeWaPhone(tel: string): string {
  const cleaned = tel.replace(/\s+/g, '').replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+')) return cleaned.slice(1);
  if (cleaned.startsWith('00')) return cleaned.slice(2);
  return `39${cleaned}`;
}

function openNativeOrWeb(nativeUrl: string, webUrl: string): void {
  // Su Electron usiamo shell.openExternal per non navigare la finestra
  if (typeof window !== 'undefined' && window.electronAPI?.openExternal) {
    window.electronAPI.openExternal(nativeUrl).catch(() => {
      window.electronAPI!.openExternal!(webUrl).catch(() => {});
    });
    return;
  }
  // Browser: tenta il protocollo nativo, poi fallback web dopo 1.5 s
  const start = Date.now();
  window.location.href = nativeUrl;
  setTimeout(() => {
    if (Date.now() - start < 2500) {
      window.open(webUrl, '_blank');
    }
  }, 1500);
}

/**
 * Apre WhatsApp cercando prima l'app nativa (desktop/mobile).
 * Se l'app non è installata, dopo 1500ms apre il fallback web (wa.me).
 */
export function apriWhatsApp(telefono: string, testo: string): void {
  const tel = normalizeWaPhone(telefono);
  const txt = encodeURIComponent(testo);
  openNativeOrWeb(
    `whatsapp://send?phone=${tel}&text=${txt}`,
    `https://wa.me/${tel}?text=${txt}`,
  );
}

/** Versione senza numero: apre WhatsApp senza destinatario specificato. */
export function apriWhatsAppSenzaNumero(testo: string): void {
  const txt = encodeURIComponent(testo);
  openNativeOrWeb(
    `whatsapp://send?text=${txt}`,
    `https://wa.me/?text=${txt}`,
  );
}
