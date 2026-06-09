/** Normalizza un numero di telefono per le API WhatsApp (solo cifre, prefisso IT). */
export function normalizeWaPhone(tel: string): string {
  const cleaned = tel.replace(/\s+/g, '').replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+')) return cleaned.slice(1);
  if (cleaned.startsWith('00')) return cleaned.slice(2);
  return `39${cleaned}`;
}

/**
 * Apre WhatsApp cercando prima l'app nativa (desktop/mobile).
 * Se l'app non è installata, dopo 1500ms apre il fallback web (wa.me).
 */
export function apriWhatsApp(telefono: string, testo: string): void {
  const tel = normalizeWaPhone(telefono);
  const txt = encodeURIComponent(testo);
  const start = Date.now();
  window.location.href = `whatsapp://send?phone=${tel}&text=${txt}`;
  setTimeout(() => {
    if (Date.now() - start < 2500) {
      window.open(`https://wa.me/${tel}?text=${txt}`, '_blank');
    }
  }, 1500);
}

/** Versione senza numero: apre WhatsApp senza destinatario specificato. */
export function apriWhatsAppSenzaNumero(testo: string): void {
  const txt = encodeURIComponent(testo);
  const start = Date.now();
  window.location.href = `whatsapp://send?text=${txt}`;
  setTimeout(() => {
    if (Date.now() - start < 2500) {
      window.open(`https://wa.me/?text=${txt}`, '_blank');
    }
  }, 1500);
}
