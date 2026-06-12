import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import html2canvas from 'html2canvas';

// CR80 + 3mm bleed
const TW_MM = 91.60;
const TH_MM = 59.98;
const B_MM = 3;
const TW_PX = 1084;
const TH_PX = 709;
const MM = TW_PX / TW_MM;

function mm(v: number) { return Math.round(v * MM); }

function backgroundHtml(): string {
  return `
    <div style="position:absolute;inset:0;background:linear-gradient(135deg,#0a6b62 0%,#0d8a80 45%,#0fb3a4 80%,#16c9b8 100%);"></div>
    <div style="position:absolute;inset:0;background:radial-gradient(circle at 82% 50%,rgba(255,255,255,0.22) 0%,rgba(255,255,255,0.06) 42%,transparent 65%);"></div>
  `;
}

function giftIconSvg(sz: number): string {
  return `<svg width="${sz}" height="${sz}" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><polyline points="20 12 20 22 4 22 4 12"></polyline><rect x="2" y="7" width="20" height="5"></rect><line x1="12" y1="22" x2="12" y2="7"></line><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"></path><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"></path></svg>`;
}

// ── FRONT ─────────────────────────────────────────────────────────────────
function buildFrontHtml(saloneName: string): string {
  const padX = mm(B_MM + 4);
  const padY = mm(B_MM + 4);

  const titleFs = mm(6.8);
  const titleSpacing = mm(0.55);
  const iconSz = mm(11);

  // MONOUSO badge (large, readable)
  const badgeFs = mm(5.8);
  const badgePx = mm(4);
  const badgePy = mm(2.8);
  const badgeR = mm(3.2);
  // Estimate badge width in px: ~7 chars * badgeFs * 0.58 + 2*badgePx
  const estBadgeW = Math.round(7 * badgeFs * 0.58) + 2 * badgePx;

  // Row Y: place label+badge row at ~63% of card height from top of canvas
  const rowY = mm(B_MM + 31);

  // 50×13mm discount label area — same row, to the right of badge
  const labelW = mm(50);
  const labelH = mm(13);
  const labelLeft = padX + estBadgeW + mm(4);

  const bottomPad = mm(B_MM + 3);
  const smallFs = mm(3.8);

  return `
    <div style="width:${TW_PX}px;height:${TH_PX}px;position:relative;overflow:hidden;font-family:Arial,Helvetica,sans-serif;box-sizing:border-box;">
      ${backgroundHtml()}

      <!-- CARTA SCONTO label -->
      <div style="position:absolute;top:${padY}px;left:${padX}px;font-size:${titleFs}px;font-weight:900;color:rgba(255,255,255,0.96);letter-spacing:${titleSpacing}px;text-shadow:0 1px ${mm(0.4)}px rgba(0,0,0,0.18);white-space:nowrap;">CARTA SCONTO</div>

      <!-- Gift icon (top-right) -->
      <div style="position:absolute;top:${padY - mm(0.5)}px;right:${mm(B_MM+3)}px;width:${iconSz}px;height:${iconSz}px;display:flex;align-items:center;justify-content:center;">
        ${giftIconSvg(iconSz)}
      </div>

      <!-- MONOUSO badge — large, readable -->
      <div style="position:absolute;top:${rowY}px;left:${padX}px;font-size:${badgeFs}px;font-weight:700;color:rgba(255,255,255,0.97);background:rgba(255,255,255,0.18);padding:${badgePy}px ${badgePx}px;border-radius:${badgeR}px;border:${mm(0.15)}px solid rgba(255,255,255,0.35);white-space:nowrap;letter-spacing:${mm(0.12)}px;">MONOUSO</div>

      <!-- Sconto % label area: 50×13mm — background-integrated (transparent sticker) -->
      <div style="position:absolute;top:${rowY}px;left:${labelLeft}px;width:${labelW}px;height:${labelH}px;"></div>

      ${saloneName ? `<div style="position:absolute;bottom:${bottomPad}px;right:${mm(B_MM+3)}px;font-size:${smallFs}px;font-weight:600;color:rgba(255,255,255,0.35);letter-spacing:${mm(0.12)}px;text-transform:uppercase;">${saloneName.toUpperCase()}</div>` : ''}
    </div>
  `;
}

// ── QR code with logo overlay (error correction H) ───────────────────────
async function generateQrWithLogo(url: string, logoDataUrl?: string): Promise<string> {
  const qrCanvas = document.createElement('canvas');
  await QRCode.toCanvas(qrCanvas, url || 'https://ivenzi.it', {
    width: 800, margin: 3, errorCorrectionLevel: 'H',
    color: { dark: '#111111', light: '#ffffff' },
  });
  if (!logoDataUrl) return qrCanvas.toDataURL('image/png');
  const ctx = qrCanvas.getContext('2d')!;
  const sz = qrCanvas.width;
  const logoSz = Math.round(sz * 0.21);
  const cx = Math.round((sz - logoSz) / 2);
  const cy = Math.round((sz - logoSz) / 2);
  const pad = Math.round(logoSz * 0.16);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(cx - pad, cy - pad, logoSz + 2 * pad, logoSz + 2 * pad);
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => { ctx.drawImage(img, cx, cy, logoSz, logoSz); resolve(qrCanvas.toDataURL('image/png')); };
    img.onerror = () => resolve(qrCanvas.toDataURL('image/png'));
    img.src = logoDataUrl;
  });
}

// ── BACK — white, code area left, large QR with logo right ───────────────
async function buildBackHtml(bookingUrl: string, logoDataUrl?: string): Promise<string> {
  // Code label area: left side, vertically centered
  const labelW = mm(50);
  const labelH = mm(13);
  const labelLeft = mm(B_MM + 6);
  const labelTop = Math.round((TH_PX - labelH) / 2);
  const labelLabelFs = mm(3.5);

  // QR: right side, vertically centered (25mm)
  const qrMM = 25;
  const qrSz = mm(qrMM);
  const qrLeft = TW_PX - mm(B_MM + 4) - qrSz;
  const qrTop = Math.round((TH_PX - qrSz) / 2);
  const labelFs = mm(4.5);

  let qrSrc = '';
  try { qrSrc = await generateQrWithLogo(bookingUrl, logoDataUrl); } catch { /* blank */ }

  const qrImg = qrSrc
    ? `<img src="${qrSrc}" style="position:absolute;top:${qrTop}px;left:${qrLeft}px;width:${qrSz}px;height:${qrSz}px;" />`
    : `<div style="position:absolute;top:${qrTop}px;left:${qrLeft}px;width:${qrSz}px;height:${qrSz}px;border:${mm(0.3)}px solid #ccc;"></div>`;

  return `
    <div style="width:${TW_PX}px;height:${TH_PX}px;position:relative;overflow:hidden;background:#ffffff;box-sizing:border-box;font-family:Arial,Helvetica,sans-serif;">
      <!-- Code label area: 50×13mm (etichetta codice, testo nero su trasparente) -->
      <div style="position:absolute;top:${labelTop}px;left:${labelLeft}px;width:${labelW}px;height:${labelH}px;border:${mm(0.2)}px dashed #ccc;border-radius:${mm(0.5)}px;"></div>
      <div style="position:absolute;top:${labelTop + labelH + mm(1.5)}px;left:${labelLeft}px;font-size:${labelLabelFs}px;color:#bbb;letter-spacing:${mm(0.04)}px;">ETICHETTA CODICE (50×13 mm)</div>
      <!-- PRENOTA ONLINE label above QR -->
      <div style="position:absolute;top:${qrTop - mm(7)}px;left:${qrLeft}px;width:${qrSz}px;text-align:center;font-size:${labelFs}px;font-weight:700;color:#555;letter-spacing:${mm(0.1)}px;">PRENOTA ONLINE</div>
      ${qrImg}
    </div>`;
}

// ── Helpers ───────────────────────────────────────────────────────────────
function rotateImage180(dataUrl: string): Promise<string> {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d')!;
      ctx.translate(img.width, img.height);
      ctx.rotate(Math.PI);
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/jpeg', 0.96));
    };
    img.src = dataUrl;
  });
}

async function captureHtml(html: string): Promise<string> {
  const wrapper = document.createElement('div');
  wrapper.style.cssText = `position:fixed;top:-9999px;left:-9999px;width:${TW_PX}px;height:${TH_PX}px;overflow:hidden;`;
  wrapper.innerHTML = html;
  document.body.appendChild(wrapper);
  try {
    const canvas = await html2canvas(wrapper, {
      width: TW_PX, height: TH_PX, scale: 1,
      useCORS: true, allowTaint: true, backgroundColor: null, logging: false,
    });
    return canvas.toDataURL('image/jpeg', 0.96);
  } finally {
    document.body.removeChild(wrapper);
  }
}

// ── Export ────────────────────────────────────────────────────────────────
export async function generateCartaScontoPdfStampa(opts: {
  saloneName: string;
  bookingUrl: string;
  logoDataUrl?: string;
}): Promise<Blob> {
  const frontHtml = buildFrontHtml(opts.saloneName);
  const backHtml = await buildBackHtml(opts.bookingUrl, opts.logoDataUrl);

  const frontImg = await captureHtml(frontHtml);
  const backImgRaw = await captureHtml(backHtml);
  const backImg = await rotateImage180(backImgRaw);

  const doc = new jsPDF({ unit: 'mm', format: [TW_MM, TH_MM], orientation: 'landscape' });
  doc.addImage(frontImg, 'JPEG', 0, 0, TW_MM, TH_MM);
  doc.addPage([TW_MM, TH_MM], 'landscape');
  doc.addImage(backImg, 'JPEG', 0, 0, TW_MM, TH_MM);
  doc.setProperties({
    title: 'Carta Sconto – Stampa Tipografia',
    subject: `CR80 ${TW_MM}x${TH_MM}mm (bleed 3mm) – Fronte e Retro`,
    creator: opts.saloneName || 'Gestionale Salone',
  });

  return doc.output('blob');
}
