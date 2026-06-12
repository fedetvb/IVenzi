import jsPDF from 'jspdf';
import QRCode from 'qrcode';

// CR80 standard card + 3mm bleed (mm)
const W = 85.60;
const H = 53.98;
const B = 3; // bleed
const TW = W + B * 2; // 91.60
const TH = H + B * 2; // 59.98

function fill(doc: jsPDF, r: number, g: number, b: number) {
  doc.setFillColor(r, g, b);
}
function strokeColor(doc: jsPDF, r: number, g: number, b: number) {
  doc.setDrawColor(r, g, b);
}
function tc(doc: jsPDF, r: number, g: number, b: number) {
  doc.setTextColor(r, g, b);
}

function drawBackground(doc: jsPDF) {
  // Dark brownish base
  fill(doc, 26, 20, 5);
  doc.rect(0, 0, TW, TH, 'F');

  // Radial golden glow (right-center)
  const cx = TW * 0.78;
  const cy = TH * 0.50;
  const maxR = 38;
  const steps = 28;
  for (let i = 0; i <= steps; i++) {
    const t = 1 - i / steps;
    const r = maxR * (1 - i / steps);
    const rr = Math.round(26 + (218 - 26) * t * 0.32);
    const rg = Math.round(20 + (165 - 20) * t * 0.32);
    const rb = Math.round(5 + (32 - 5) * t * 0.32);
    fill(doc, rr, rg, rb);
    doc.circle(cx, cy, r, 'F');
  }

  // Diagonal stripe pattern (subtle golden lines at ~45°)
  strokeColor(doc, 180, 140, 28);
  doc.setLineWidth(0.06);
  const step = 4.5;
  for (let offset = -(TH * 2); offset < TW + TH; offset += step) {
    doc.line(offset, 0, offset + TH * 1.5, TH);
  }
}

function drawChip(doc: jsPDF, x: number, y: number) {
  fill(doc, 184, 134, 11);
  doc.roundedRect(x, y, 11, 8.5, 1.2, 1.2, 'F');
  fill(doc, 218, 165, 32);
  doc.roundedRect(x + 1, y + 1, 9, 6.5, 0.8, 0.8, 'F');
  strokeColor(doc, 140, 100, 8);
  doc.setLineWidth(0.28);
  doc.line(x + 3.5, y + 1, x + 3.5, y + 7.5);
  doc.line(x + 7.5, y + 1, x + 7.5, y + 7.5);
  doc.line(x + 1, y + 4, x + 10, y + 4);
}

function drawCropMarks(doc: jsPDF) {
  strokeColor(doc, 180, 140, 28);
  doc.setLineWidth(0.15);
  doc.setLineDashPattern([], 0);
  const m = 1.8;
  const g = 0.5;
  doc.line(B - g - m, B, B - g, B);
  doc.line(B, B - g - m, B, B - g);
  doc.line(TW - B + g, B, TW - B + g + m, B);
  doc.line(TW - B, B - g - m, TW - B, B - g);
  doc.line(B - g - m, TH - B, B - g, TH - B);
  doc.line(B, TH - B + g, B, TH - B + g + m);
  doc.line(TW - B + g, TH - B, TW - B + g + m, TH - B);
  doc.line(TW - B, TH - B + g, TW - B, TH - B + g + m);
}

function drawFront(doc: jsPDF, saloneName: string) {
  // CARTA PREMIUM label
  tc(doc, 218, 165, 32);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text('C A R T A  P R E M I U M', B + 4, B + 9);

  // Chip
  drawChip(doc, TW - B - 15, B + 3);

  // Blank label area for NAME (50mm × 13mm, lower-left)
  strokeColor(doc, 120, 90, 16);
  doc.setLineWidth(0.12);
  doc.setLineDashPattern([0.7, 0.7], 0);
  const nx = B + 4;
  const ny = TH - B - 18;
  doc.rect(nx, ny, 50, 13, 'S');
  doc.setLineDashPattern([], 0);

  tc(doc, 95, 70, 14);
  doc.setFontSize(3.5);
  doc.setFont('helvetica', 'normal');
  doc.text('AREA ETICHETTA NOME', nx, ny + 14.5);

  // Salon name bottom-right (subtle)
  if (saloneName) {
    tc(doc, 95, 72, 15);
    doc.setFontSize(5);
    doc.text(saloneName.toUpperCase(), TW - B - 4, TH - B - 3.5, { align: 'right' });
  }

  drawCropMarks(doc);
}

async function drawBack(doc: jsPDF, bookingUrl: string, saloneName: string) {
  // Code label area (50mm × 13mm, left-center)
  const codeX = B + 4;
  const codeY = TH / 2 - 6.5;
  strokeColor(doc, 120, 90, 16);
  doc.setLineWidth(0.12);
  doc.setLineDashPattern([0.7, 0.7], 0);
  doc.rect(codeX, codeY, 50, 13, 'S');
  doc.setLineDashPattern([], 0);

  tc(doc, 95, 70, 14);
  doc.setFontSize(3.5);
  doc.setFont('helvetica', 'normal');
  doc.text('AREA ETICHETTA CODICE', codeX, codeY + 14.5);

  // QR Code (right side)
  const qrSize = 22;
  const qrX = TW - B - qrSize - 4;
  const qrY = TH / 2 - qrSize / 2;

  if (bookingUrl) {
    try {
      const qrCanvas = document.createElement('canvas');
      await QRCode.toCanvas(qrCanvas, bookingUrl, {
        width: 600,
        margin: 1,
        color: { dark: '#DAA520', light: '#1a1400' },
      });
      const qrDataUrl = qrCanvas.toDataURL('image/png');
      doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);
    } catch {
      // Placeholder if URL invalid
      fill(doc, 38, 28, 6);
      doc.rect(qrX, qrY, qrSize, qrSize, 'F');
      tc(doc, 130, 100, 20);
      doc.setFontSize(5);
      doc.text('QR CODE', qrX + qrSize / 2, qrY + qrSize / 2 + 1.5, { align: 'center' });
    }
  }

  // PRENOTA ONLINE label above QR
  tc(doc, 175, 135, 26);
  doc.setFontSize(5);
  doc.setFont('helvetica', 'bold');
  doc.text('PRENOTA ONLINE', qrX + qrSize / 2, qrY - 2, { align: 'center' });

  // CARTA PREMIUM watermark (bottom center, subtle)
  tc(doc, 70, 54, 10);
  doc.setFontSize(5.5);
  doc.text('C A R T A  P R E M I U M', TW / 2, TH - B - 3.5, { align: 'center' });

  if (saloneName) {
    tc(doc, 95, 72, 15);
    doc.setFontSize(4.5);
    doc.setFont('helvetica', 'normal');
    doc.text(saloneName.toUpperCase(), TW / 2, TH - B - 7.5, { align: 'center' });
  }

  drawCropMarks(doc);
}

export async function generateCartaPremiumStampaPdf(opts: {
  saloneName: string;
  bookingUrl: string;
}): Promise<Blob> {
  // Page size = TW x TH mm (CR80 + 3mm bleed all sides)
  const doc = new jsPDF({ unit: 'mm', format: [TW, TH] });

  // Page 1 – FRONTE
  drawBackground(doc);
  drawFront(doc, opts.saloneName);

  // Page 2 – RETRO
  doc.addPage([TW, TH]);
  drawBackground(doc);
  await drawBack(doc, opts.bookingUrl, opts.saloneName);

  return doc.output('blob');
}
