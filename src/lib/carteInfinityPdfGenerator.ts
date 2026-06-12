import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import html2canvas from 'html2canvas';

// CR80 + 3mm bleed — CMYK output target (file generated as sRGB JPEG)
const TW_MM = 91.60;
const TH_MM = 59.98;
const B_MM = 3;
const TW_PX = 1084;
const TH_PX = 709;
const MM = TW_PX / TW_MM;

function mm(v: number) { return Math.round(v * MM); }

function backgroundHtml(): string {
  return `
    <div style="position:absolute;inset:0;background:linear-gradient(135deg,#ffffff 0%,#f2f2f2 30%,#fafafa 60%,#e9e9e9 100%);"></div>
    <div style="position:absolute;inset:0;background-image:repeating-linear-gradient(45deg,rgba(160,160,160,0.06) 0px,rgba(160,160,160,0.06) 1px,transparent 0px,transparent 28px);background-size:28px 28px;"></div>
    <div style="position:absolute;inset:0;background:radial-gradient(ellipse 60% 80% at 85% 50%,rgba(200,200,200,0.22) 0%,transparent 70%);"></div>
    <div style="position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,#c0c0c0,#e8e8e8,#f5f5f5,#e8e8e8,#c0c0c0);"></div>
    <div style="position:absolute;bottom:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,#c8c8c8,#e0e0e0,#c8c8c8,transparent);"></div>
  `;
}

function chipSvg(): string {
  const w = mm(14);
  const h = mm(10);
  return `
    <div style="width:${w}px;height:${h}px;background:linear-gradient(135deg,#b0b0b0 0%,#e8e8e8 40%,#c8c8c8 60%,#989898 100%);border-radius:${mm(1.2)}px;box-shadow:0 1px ${mm(0.8)}px rgba(0,0,0,0.22),inset 0 1px 1px rgba(255,255,255,0.55);position:relative;">
      <div style="position:absolute;top:15%;left:10%;right:10%;bottom:15%;border:${mm(0.25)}px solid rgba(140,140,140,0.38);border-radius:${mm(0.6)}px;background:linear-gradient(135deg,#d4d4d4 0%,#f0f0f0 50%,#b8b8b8 100%);"></div>
      <div style="position:absolute;top:50%;left:8%;right:8%;height:${mm(0.3)}px;background:rgba(140,140,140,0.35);transform:translateY(-50%);"></div>
      <div style="position:absolute;top:10%;bottom:10%;left:30%;width:${mm(0.3)}px;background:rgba(140,140,140,0.35);"></div>
      <div style="position:absolute;top:10%;bottom:10%;right:28%;width:${mm(0.3)}px;background:rgba(140,140,140,0.35);"></div>
    </div>
  `;
}

// ── FRONT ─────────────────────────────────────────────────────────────────
function buildFrontHtml(saloneName: string): string {
  const padX = mm(B_MM + 4);
  const padY = mm(B_MM + 4);

  const titleFs = mm(6.4);
  const titleSpacing = mm(0.45);

  // Name sticker area (50×13mm) – left, upper-middle band
  const nameAreaY = mm(B_MM + 16);
  const nameW = mm(50);
  const nameH = mm(13);
  const nameLabelFs = mm(3.4);

  // Discount % sticker area (50×13mm) – left, lower band
  const discountAreaY = mm(B_MM + 34);
  const discountW = mm(50);
  const discountH = mm(13);
  const discountLabelFs = mm(3.4);

  // "Non scade" badge — larger, bottom right
  const badgeFs = mm(6.2);
  const badgePx = mm(5);
  const badgePy = mm(3);
  const badgeR = mm(14);
  const badgeBottom = mm(B_MM + 3.5);
  const badgeRight = mm(B_MM + 4);

  const smallFs = mm(3.6);
  const bottomPad = mm(B_MM + 3);

  return `
    <div style="width:${TW_PX}px;height:${TH_PX}px;position:relative;overflow:hidden;font-family:Arial,Helvetica,sans-serif;box-sizing:border-box;">
      ${backgroundHtml()}

      <!-- CARTA SCONTO INFINITY title -->
      <div style="position:absolute;top:${padY}px;left:${padX}px;font-size:${titleFs}px;font-weight:800;color:#888888;letter-spacing:${titleSpacing}px;white-space:nowrap;">CARTA SCONTO INFINITY</div>

      <!-- Chip icon (top-right) -->
      <div style="position:absolute;top:${padY - mm(1)}px;right:${mm(B_MM + 3)}px;">
        ${chipSvg()}
      </div>

      <!-- Name sticker area: 50×13mm dashed border -->
      <div style="position:absolute;top:${nameAreaY}px;left:${padX}px;width:${nameW}px;height:${nameH}px;border:${mm(0.22)}px dashed rgba(160,160,160,0.5);border-radius:${mm(0.6)}px;"></div>
      <div style="position:absolute;top:${nameAreaY + nameH + mm(1.2)}px;left:${padX}px;font-size:${nameLabelFs}px;color:rgba(160,160,160,0.65);letter-spacing:${mm(0.04)}px;">NOME (50×13 mm)</div>

      <!-- Discount % sticker area: 50×13mm dashed border -->
      <div style="position:absolute;top:${discountAreaY}px;left:${padX}px;width:${discountW}px;height:${discountH}px;border:${mm(0.22)}px dashed rgba(160,160,160,0.5);border-radius:${mm(0.6)}px;"></div>
      <div style="position:absolute;top:${discountAreaY + discountH + mm(1.2)}px;left:${padX}px;font-size:${discountLabelFs}px;color:rgba(160,160,160,0.65);letter-spacing:${mm(0.04)}px;">SCONTO % (50×13 mm)</div>

      <!-- "Non scade" badge — large, bottom right -->
      <div style="position:absolute;bottom:${badgeBottom}px;right:${badgeRight}px;font-size:${badgeFs}px;font-weight:600;color:#555555;background:rgba(0,0,0,0.055);border:${mm(0.2)}px solid rgba(0,0,0,0.14);padding:${badgePy}px ${badgePx}px;border-radius:${badgeR}px;font-style:italic;white-space:nowrap;letter-spacing:${mm(0.06)}px;">Non scade</div>

      ${saloneName ? `<div style="position:absolute;bottom:${bottomPad}px;left:${padX}px;font-size:${smallFs}px;font-weight:600;color:rgba(140,140,140,0.4);letter-spacing:${mm(0.12)}px;text-transform:uppercase;">${saloneName.toUpperCase()}</div>` : ''}
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

// ── BACK — identical to CartaSconto back (code area left, QR right) ──────
async function buildBackHtml(bookingUrl: string, logoDataUrl?: string): Promise<string> {
  const labelW = mm(50);
  const labelH = mm(13);
  const labelLeft = mm(B_MM + 6);
  const labelTop = Math.round((TH_PX - labelH) / 2);
  const labelLabelFs = mm(3.5);

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
      <div style="position:absolute;top:${labelTop}px;left:${labelLeft}px;width:${labelW}px;height:${labelH}px;border:${mm(0.2)}px dashed #ccc;border-radius:${mm(0.5)}px;"></div>
      <div style="position:absolute;top:${labelTop + labelH + mm(1.5)}px;left:${labelLeft}px;font-size:${labelLabelFs}px;color:#bbb;letter-spacing:${mm(0.04)}px;">ETICHETTA CODICE (50×13 mm)</div>
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
export async function generateCartaInfinityPdfStampa(opts: {
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
    title: 'Carta Sconto Infinity – Stampa Tipografia',
    subject: `CR80 ${TW_MM}x${TH_MM}mm (bleed 3mm) – Fronte e Retro`,
    creator: opts.saloneName || 'Gestionale Salone',
  });

  return doc.output('blob');
}
