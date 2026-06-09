/** Normalizza un numero di telefono per le API WhatsApp (solo cifre, prefisso IT). */
export function normalizeWaPhone(tel: string): string {
  const cleaned = tel.replace(/\s+/g, '').replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+')) return cleaned.slice(1);
  if (cleaned.startsWith('00')) return cleaned.slice(2);
  return `39${cleaned}`;
}

function openNativeOrWeb(nativeUrl: string, _webUrl: string): void {
  if (typeof window !== 'undefined' && window.electronAPI?.openExternal) {
    window.electronAPI.openExternal(nativeUrl).catch(() => {
      window.electronAPI!.openExternal!(_webUrl).catch(() => {});
    });
    return;
  }
  window.location.href = nativeUrl;
}

export function apriWhatsApp(telefono: string, testo: string): void {
  const tel = normalizeWaPhone(telefono);
  const txt = encodeURIComponent(testo);
  openNativeOrWeb(
    `whatsapp://send?phone=${tel}&text=${txt}`,
    `https://wa.me/${tel}?text=${txt}`,
  );
}

export function apriWhatsAppSenzaNumero(testo: string): void {
  const txt = encodeURIComponent(testo);
  openNativeOrWeb(
    `whatsapp://send?text=${txt}`,
    `https://wa.me/?text=${txt}`,
  );
}
