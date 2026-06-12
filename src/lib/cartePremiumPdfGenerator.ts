import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import html2canvas from 'html2canvas';

// CR80 + 3mm bleed (mm)
const TW_MM = 91.60;
const TH_MM = 59.98;
const B_MM = 3;

// Rendering at 300 DPI equivalent:
// In the browser div space, 1mm = TW_PX / TW_MM
const TW_PX = 1084;
const TH_PX = 709;
const MM = TW_PX / TW_MM; // px per mm ≈ 11.83

function mm(v: number) { return Math.round(v * MM); }

// ── Card background HTML ───────────────────────────────────────────────────
function backgroundHtml(): string {
  return `
    <!-- Base dark gradient -->
    <div style="position:absolute;inset:0;background:linear-gradient(130deg,#1a1200 0%,#1f1600 45%,#2d1e00 75%,#3c2700 100%);"></div>
    <!-- Radial golden glow (right-center) -->
    <div style="position:absolute;inset:0;background:radial-gradient(ellipse 65% 85% at 83% 48%,rgba(210,155,15,0.42) 0%,rgba(160,110,8,0.18) 42%,transparent 72%);"></div>
    <!-- Diagonal stripe pattern -->
    <div style="position:absolute;inset:0;background-image:repeating-linear-gradient(-50deg,transparent 0px,transparent 20px,rgba(205,162,22,0.13) 20px,rgba(205,162,22,0.13) 22px);"></div>
  `;
}

// ── Chip HTML ───────────────────────────────────────────────────────────────
function chipHtml(): string {
  const w = mm(11), h = mm(8.5), r = mm(1.4);
  const lw = Math.max(1, mm(0.28));
  return `
    <div style="width:${w}px;height:${h}px;background:linear-gradient(135deg,#e8c035 0%,#c89010 40%,#DAA520 65%,#b8860b 100%);border-radius:${r}px;box-shadow:0 ${mm(0.3)}px ${mm(1)}px rgba(0,0,0,0.65),inset 0 1px ${mm(0.5)}px rgba(255,255,255,0.22);position:relative;overflow:hidden;">
      <div style="position:absolute;top:47%;left:8%;right:8%;height:${lw}px;background:rgba(70,45,0,0.55);transform:translateY(-50%);"></div>
      <div style="position:absolute;top:10%;bottom:10%;left:31%;width:${lw}px;background:rgba(70,45,0,0.55);"></div>
      <div style="position:absolute;top:10%;bottom:10%;right:29%;width:${lw}px;background:rgba(70,45,0,0.55);"></div>
    </div>
  `;
}

// ── FRONT HTML ─────────────────────────────────────────────────────────────
function buildFrontHtml(saloneName: string): string {
  const padX = mm(B_MM + 4);   // bleed + 4mm inner margin
  const padY = mm(B_MM + 4);

  // "CARTA PREMIUM" label
  const titleFs = mm(6.8);
  const titleLetterSpacing = mm(0.55);

  // Name label zone: 50×13mm — left-aligned, at about 43% from top of total card
  // In original screenshot the name appears roughly 43–55% down
  const labelTop = mm(B_MM + 21);
  const labelLeft = mm(B_MM + 4);
  const labelW = mm(50);
  const labelH = mm(13);

  // Chip position
  const chipTop = mm(B_MM + 3);
  const chipRight = mm(B_MM + 3);

  // Salon name at bottom-right (very subtle)
  const bottomPad = mm(B_MM + 3);
  const smallFs = mm(3.8);

  return `
    <div style="width:${TW_PX}px;height:${TH_PX}px;position:relative;overflow:hidden;font-family:Arial,Helvetica,sans-serif;box-sizing:border-box;">
      ${backgroundHtml()}

      <!-- CARTA PREMIUM label -->
      <div style="position:absolute;top:${padY}px;left:${padX}px;font-size:${titleFs}px;font-weight:900;color:#DAA520;letter-spacing:${titleLetterSpacing}px;text-shadow:0 1px ${mm(0.4)}px rgba(0,0,0,0.55);white-space:nowrap;">CARTA PREMIUM</div>

      <!-- Chip (top-right) -->
      <div style="position:absolute;top:${chipTop}px;right:${chipRight}px;">
        ${chipHtml()}
      </div>

      <!-- Name label area: fully integrated with background — no border, no content -->
      <!-- 50mm × 13mm at (${labelLeft}px, ${labelTop}px) — leave blank for transparent sticker -->
      <div style="position:absolute;top:${labelTop}px;left:${labelLeft}px;width:${labelW}px;height:${labelH}px;"></div>

      ${saloneName ? `
      <!-- Salon name (bottom-right, very subtle gold) -->
      <div style="position:absolute;bottom:${bottomPad}px;right:${mm(B_MM + 3)}px;font-size:${smallFs}px;font-weight:600;color:rgba(180,130,18,0.42);letter-spacing:${mm(0.12)}px;text-transform:uppercase;">${saloneName.toUpperCase()}</div>
      ` : ''}
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

// ── BACK HTML — white, code area left, static QR right ───────────────────
async function buildBackHtml(_bookingUrl: string, _logoDataUrl?: string): Promise<string> {
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
  try {
    const resp = await fetch('/files_10187331-2026-06-12T22-27-21-679Z-image.png');
    const blob = await resp.blob();
    qrSrc = await new Promise<string>(res => {
      const r = new FileReader(); r.onload = () => res(r.result as string); r.readAsDataURL(blob);
    });
  } catch { /* blank */ }

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

// ── Rotate captured image 180° (back face for double-sided printing) ─────
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

// ── Capture helper ────────────────────────────────────────────────────────
async function captureHtml(html: string): Promise<string> {
  const wrapper = document.createElement('div');
  wrapper.style.cssText = `position:fixed;top:-9999px;left:-9999px;width:${TW_PX}px;height:${TH_PX}px;overflow:hidden;`;
  wrapper.innerHTML = html;
  document.body.appendChild(wrapper);
  try {
    const canvas = await html2canvas(wrapper, {
      width: TW_PX,
      height: TH_PX,
      scale: 1,
      useCORS: true,
      allowTaint: true,
      backgroundColor: null,
      logging: false,
    });
    return canvas.toDataURL('image/jpeg', 0.96);
  } finally {
    document.body.removeChild(wrapper);
  }
}

// ── Main export ───────────────────────────────────────────────────────────
export async function generateCartaPremiumStampaPdf(opts: {
  saloneName: string;
  bookingUrl: string;
  logoDataUrl?: string;
}): Promise<Blob> {
  const frontHtml = buildFrontHtml(opts.saloneName);
  const backHtml = await buildBackHtml(opts.bookingUrl, opts.logoDataUrl);

  const frontImg = await captureHtml(frontHtml);
  const backImgRaw = await captureHtml(backHtml);
  // Back rotated 180° for head-to-head double-sided printing
  const backImg = await rotateImage180(backImgRaw);

  // CR80 + bleed, landscape
  const doc = new jsPDF({ unit: 'mm', format: [TW_MM, TH_MM], orientation: 'landscape' });

  // Page 1: FRONTE
  doc.addImage(frontImg, 'JPEG', 0, 0, TW_MM, TH_MM);

  // Page 2: RETRO (rotated 180° for printing)
  doc.addPage([TW_MM, TH_MM], 'landscape');
  doc.addImage(backImg, 'JPEG', 0, 0, TW_MM, TH_MM);

  // PDF metadata
  doc.setProperties({
    title: 'Carta Premium – Stampa Tipografia',
    subject: `CR80 ${TW_MM}x${TH_MM}mm (bleed 3mm) – Fronte e Retro`,
    creator: opts.saloneName || 'Gestionale Salone',
  });

  return doc.output('blob');
}