// Reçu officiel au format A5 (PDF) : attestation durable du paiement, à imprimer ou à joindre à un e-mail
// (employeur des parents, mutuelle…). Même numéro que le ticket de caisse : ce n'est pas un nouveau paiement.
// Fabriqué dans le navigateur, sans serveur ni bibliothèque (rules/pdfLite.js) ; un reçu annulé porte « ANNULÉ ».
import { PdfLite } from './rules/pdfLite.js';
import { brand } from './siteBrand.js';
import { JOURNALS } from './data/accounting.js';
import { PAYMENT_METHODS } from './rules/billing.js';
import { amountInWords } from './rules/finance.js';
import { saveFile } from './download.js';
import { todayFr } from './clock.js';

const FMG_PER_ARIARY = 5;
const num = (n) => new Intl.NumberFormat('fr-FR').format(n).replace(/[  ]/g, ' ');
const NAVY = [0, 35, 110]; const GREY = [100, 100, 100];

// logo de l'en-tête en JPEG (fond blanc), pour l'insérer dans le PDF
async function logoJpeg(src) {
  const img = new Image();
  await new Promise((ok, ko) => { img.onload = ok; img.onerror = ko; img.src = src; });
  const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0);
  const b64 = c.toDataURL('image/jpeg', 0.92).split(',')[1];
  const bin = atob(b64); const bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return { bytes, w: c.width, h: c.height };
}

/** r : { number, journal, lines, total, method, ref, bank, status, student, cls, bearer, cashier, at } → octets du PDF */
export async function officialReceiptPdf(r, { year = '2026-2027', logo = true } = {}) {
  const b = brand();
  const pdf = new PdfLite(148, 210);
  const L = 14; const R = 134; const W = 148;
  let y = 12;
  try { if (!logo) throw new Error('sans logo'); const j = await logoJpeg(b.logo); y += pdf.jpeg(j.bytes, j.w, j.h, L, y, 96); }
  catch { pdf.text(L, y + 8, `École Collège Lycée Chateaubriand — ${b.city}`, { size: 13, bold: true, color: NAVY }); pdf.text(L, y + 14, `${b.address} · ${b.phone} · ${b.mail}`, { size: 8, color: GREY }); y += 18; }
  y += 4; pdf.line(L, y, R, y, { width: 0.4, color: [0, 51, 153] });
  y += 8; pdf.text(W / 2, y, 'REÇU OFFICIEL DE PAIEMENT', { size: 13, bold: true, align: 'center', color: NAVY });
  y += 6; pdf.text(W / 2, y, `N° ${r.number}  ·  ${JOURNALS[r.journal]?.label ?? ''}`, { size: 10.5, bold: true, align: 'center' });
  y += 3;
  const field = (label, value) => { y += 6; pdf.text(L, y, label, { size: 9.5, color: GREY }); pdf.text(L + 36, y, value, { size: 9.5, bold: true, maxWidth: R - L - 36 }); };
  field('Date du paiement', r.at ?? '');
  field('Élève', r.student ?? '');
  field('Classe', `${r.cls ?? ''} · année scolaire ${year}`);
  if (r.bearer) field('Remis par', r.bearer);

  y += 9; pdf.rect(L, y - 4.8, R - L, 7, { fill: [238, 242, 250] });
  pdf.text(L + 2, y, 'Désignation', { size: 9.5, bold: true }); pdf.text(R - 2, y, 'Montant (Ar)', { size: 9.5, bold: true, align: 'right' });
  (r.lines ?? []).forEach((l) => {
    y += 6; const h = pdf.text(L + 2, y, l.label, { size: 9.5, maxWidth: R - L - 40 }); pdf.text(R - 2, y, num(l.base ?? l.amount), { size: 9.5, align: 'right' });
    y += Math.max(0, h - 4);
    if (l.discount > 0) { y += 5; pdf.text(L + 6, y, `Réduction ${String(l.reductionLabel ?? '').split(' (')[0].toLowerCase()}`, { size: 9, color: GREY }); pdf.text(R - 2, y, `- ${num(l.discount)}`, { size: 9, align: 'right', color: GREY }); }
  });
  y += 3; pdf.line(L, y, R, y);
  y += 6; pdf.text(L + 2, y, 'TOTAL', { size: 11, bold: true }); pdf.text(R - 2, y, `${num(r.total)} Ar`, { size: 11, bold: true, align: 'right' });
  y += 5; pdf.text(R - 2, y, `Soit ${num(r.total * FMG_PER_ARIARY)} FMG`, { size: 8.5, align: 'right', color: GREY });
  y += 5; y += pdf.text(L + 2, y, `Arrêté à la somme de ${amountInWords(r.total)}.`, { size: 9, italic: true, maxWidth: R - L - 4 });

  const m = PAYMENT_METHODS[r.method];
  y += 7; y += pdf.text(L, y, `Règlement : ${m?.label ?? r.method ?? ''}${r.ref ? ` · ${String(m?.refLabel ?? 'Référence').replace(' / référence', '')} ${r.ref}` : ''}${r.bank ? ` · ${r.bank}` : ''}`, { size: 9.5, maxWidth: R - L });
  y += 2; pdf.text(L, y, `Encaissé par : ${r.cashier ?? ''}`, { size: 9.5 });

  y += 11; pdf.text(R, y, `Fait à ${b.town}, le ${todayFr()}`, { size: 9.5, align: 'right' });
  y += 4; pdf.rect(R - 58, y, 58, 26, { stroke: [150, 150, 150] });
  pdf.text(R - 29, y + 30, 'Cachet et signature de l\'établissement', { size: 8, align: 'center', color: [120, 120, 120] });

  if (r.status === 'ANNULE') pdf.text(W / 2 - 30, 130, 'ANNULÉ', { size: 48, bold: true, color: [200, 0, 0], angle: 30 });
  pdf.text(W / 2, 196, `${b.address} · ${b.phone} · ${b.mail}`, { size: 7.5, align: 'center', color: GREY });
  pdf.text(W / 2, 200, `Ce reçu reprend le ticket de caisse n° ${r.number} ; il n'atteste aucun autre paiement. Édité le ${todayFr()}.`, { size: 7.5, align: 'center', color: GREY, maxWidth: R - L });
  return pdf.output();
}

export async function downloadOfficialReceipt(r, opts) {
  return saveFile(`recu-${r.number}.pdf`, await officialReceiptPdf(r, opts));
}
