export const DEFAULT_WA_GP_SALONE = `Ciao {destinataria}! 😊 {donante} ha voluto dedicarti un invito speciale da Stefano e Federico del salone "{nome_salone}".

Questo è il tuo codice da comunicare al momento del pagamento: {codice}
Il Gift Pass include un bonus di €{valore} da spendere come vuoi nel salone.

Per fissare il tuo appuntamento telefona in salone al {telefono} oppure prenota online su {sito}. I ragazzi saranno davvero lieti di conoscerti!

Speriamo che tu ti conceda questo momento di totale relax!`;

export const DEFAULT_WA_GP_CLIENTE = `Ciao 😊 Stefano e Federico del salone "{nome_salone}" mi hanno dato la possibilità di dedicare un invito a una persona cara, e ho pensato a te!

Ti regalo il mio Gift Pass con un bonus di €{valore} da spendere come vuoi nel salone per il tuo primo appuntamento.

Questo è il codice da comunicare al momento del pagamento: {codice}

Per fissare il tuo appuntamento telefona in salone al {telefono} oppure prenota online su {sito}. I ragazzi saranno davvero lieti di conoscerti!

Spero che tu ti conceda questo momento di totale relax!`;

export const DEFAULT_WA_CS_DONA = `Ciao 😊 Stefano e Federico del salone "{nome_salone}" mi hanno dato la possibilità di dedicare un invito a una persona cara, e ho pensato a te!

Ti regalo la mia Carta Sconto del {sconto} per il tuo primo appuntamento.

Questo è il codice da comunicare al momento del pagamento: {codice}

Per fissare il tuo appuntamento telefona in salone al {telefono} oppure prenota online su {sito}. I ragazzi saranno davvero lieti di conoscerti!

Spero che tu ti conceda questo momento di totale relax.`;

export function applyWaTemplate(tpl: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (t, [k, v]) => t.replace(new RegExp(`\\{${k}\\}`, 'g'), v),
    tpl,
  );
}

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
