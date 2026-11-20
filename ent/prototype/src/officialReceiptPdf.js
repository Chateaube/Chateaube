// Reçu officiel (PDF, A4) : attestation durable du paiement, à imprimer ou à joindre à un e-mail (employeur des
// parents, mutuelle…). Mise en page d'une facture d'établissement : en-tête, références sur deux colonnes, payeur,
// tableau Frais / Période / Montant par élève (réductions en italique, sous-total), cadre du total, pied de page.
// Même numéro que le ticket de caisse : ce n'est pas un nouveau paiement. Fabriqué dans le navigateur, sans
// serveur ni bibliothèque (rules/pdfLite.js) ; un reçu annulé porte la mention « ANNULÉ ».
import { PdfLite, textWidth as textW } from './rules/pdfLite.js';
import { brand } from './siteBrand.js';
import { JOURNALS } from './data/accounting.js';
import { PAYMENT_METHODS } from './rules/billing.js';
import { amountInWords } from './rules/finance.js';
import { saveFile } from './download.js';
import { todayFr } from './clock.js';

const FMG_PER_ARIARY = 5;
const money = (n) => `${new Intl.NumberFormat('fr-FR').format(n).replace(/[  ]/g, ' ')},00`;
const BLUE = [47, 84, 150]; const GREY = [110, 110, 110]; const RULE = [70, 110, 180];

// logo de l'en-tête en JPEG (fond blanc), pour l'insérer dans le PDF
async function logoJpeg(src) {
  const img = new Image();
  await new Promise((ok, ko) => { img.onload = ok; img.onerror = ko; img.src = src; });
  const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0);
  const bin = atob(c.toDataURL('image/jpeg', 0.92).split(',')[1]);
  const bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return { bytes, w: c.width, h: c.height };
}

// période d'une ligne : le mois pour les frais de scolarité, l'année ou la session sinon
const periodOf = (l, journal, year) => l.short ?? (journal === 'DROITS_EXAMEN' ? `Session ${Number(year.slice(0, 4)) + 1}` : `Année ${year}`);
const designationOf = (l) => (l.short ? 'Frais de scolarité / School fees' : l.label);

/** r : { number, journal, lines, total, method, ref, bank, status, student, cls, bearer, cashier, at } → octets du PDF */
export async function officialReceiptPdf(r, { year = '2026-2027', logo = true } = {}) {
  const b = brand();
  const pdf = new PdfLite(210, 297);
  const L = 15; const R = 195;
  // en-tête : logo de l'école (nom, adresse, téléphone, e-mail) centré
  let y = 10;
  try { if (!logo) throw new Error('sans logo'); const j = await logoJpeg(b.logo); y += pdf.jpeg(j.bytes, j.w, j.h, 55, y, 100); }
  catch {
    pdf.text(105, y + 8, 'ÉCOLE COLLÈGE LYCÉE CHATEAUBRIAND', { size: 15, bold: true, align: 'center', color: BLUE });
    pdf.text(105, y + 14, b.address, { size: 10, align: 'center', color: BLUE }); pdf.text(105, y + 19, `Tél : ${b.phone} · ${b.mail}`, { size: 10, align: 'center', color: BLUE }); y += 22;
  }
  // titre
  y += 10; pdf.text(R, y, 'Reçu / Receipt', { size: 18, bold: true, align: 'right' });
  // références sur deux colonnes
  y += 13;
  const pair = (x, yy, label, value, align = 'left') => {
    if (align === 'left') { pdf.text(x, yy, label, { size: 11 }); pdf.text(x + (label.length > 0 ? textW(label, 11) + 1.5 : 0), yy, value, { size: 11, bold: true }); }
    else { const vw = textW(value, 11, true); pdf.text(x - vw - 1.5, yy, label, { size: 11, align: 'right' }); pdf.text(x, yy, value, { size: 11, bold: true, align: 'right' }); }
  };
  pair(L, y, 'Date du paiement / Payment date :', r.at ?? '');
  pair(R, y, 'Reçu n° / Receipt # :', r.number, 'right');
  y += 6;
  pair(L, y, 'Journal / Ledger :', JOURNALS[r.journal]?.label ?? '');
  pair(R, y, 'Année scolaire / School year :', year, 'right');

  // détails
  y += 13; pdf.text(L, y, 'Détails du paiement / Payment details', { size: 11.5, bold: true });
  y += 2.5; pdf.line(L, y, R, y, { width: 0.4, color: RULE });
  y += 8; pdf.text(L + 2, y, 'Payeur / Payer :', { size: 11, bold: true }); pdf.text(L + 2 + textW('Payeur / Payer :', 11, true) + 1.5, y, r.bearer || 'la famille', { size: 11, italic: true });
  y += 5.5; pdf.text(L + 2, y, `Pour l'élève / For the pupil : ${r.student ?? ''}`, { size: 11 });
  y += 5.5; pdf.text(L + 2, y, `Classe / Class : ${r.cls ?? ''}`, { size: 11 });

  // tableau
  const P = 140; // colonne « Période »
  y += 12; pdf.text(L, y, 'Frais', { size: 8.5, bold: true }); pdf.text(P, y, 'Période', { size: 8.5, bold: true }); pdf.text(R, y, 'Montant', { size: 8.5, bold: true, align: 'right' });
  y += 2.5; pdf.line(L, y, R, y, { width: 0.3 });
  y += 8; pdf.text(L, y, `${r.student ?? ''} (${r.cls ?? ''})`, { size: 8.5, bold: true });
  (r.lines ?? []).forEach((l) => {
    y += 6.5;
    const h = pdf.text(L, y, designationOf(l), { size: 8.5, maxWidth: P - L - 4 });
    pdf.text(P, y, periodOf(l, r.journal, year), { size: 8.5 }); pdf.text(R, y, money(l.base ?? l.amount), { size: 8.5, align: 'right' });
    y += Math.max(0, h - 3.6);
    if (l.discount > 0) { y += 5.5; pdf.text(L, y, `Réduction - ${String(l.reductionLabel ?? '').split(' (')[0]}`, { size: 8.5, italic: true }); pdf.text(R, y, `-${money(l.discount)}`, { size: 8.5, align: 'right' }); }
  });
  y += 7; pdf.text(P, y, 'Sous-total', { size: 8.5, bold: true }); pdf.text(R, y, money(r.total), { size: 8.5, bold: true, align: 'right' });
  y += 8; pdf.line(L, y, R, y, { width: 0.3 });
  y += 7; pdf.text(P, y, 'TOTAL : (MGA)', { size: 8.5, bold: true }); pdf.text(R, y, money(r.total), { size: 8.5, bold: true, align: 'right' });

  // cadre du total
  y += 5; const bx = 108; const bh = 25;
  pdf.rect(bx, y, R - bx, bh, { stroke: [0, 0, 0], width: 0.3 });
  const boxRow = (yy, label, value, bold = false) => { pdf.text(bx + 2, yy, label, { size: 11, bold }); pdf.text(R - 2, yy, value, { size: 11, bold, align: 'right' }); };
  boxRow(y + 6.5, 'Montant reçu / Paid : (MGA)', money(r.total));
  boxRow(y + 13, 'Soit en FMG :', money(r.total * FMG_PER_ARIARY));
  boxRow(y + 20.5, 'Reste dû / Amount due :', '0,00', true);

  // règlement et montant en lettres à gauche ; lieu, date, cachet à droite (même bande, tient sur la page)
  y += bh + 10;
  const m = PAYMENT_METHODS[r.method]; const LW = 100;
  let yl = y;
  yl += pdf.text(L, yl, `Arrêté à la somme de ${amountInWords(r.total)}.`, { size: 9.5, italic: true, maxWidth: LW });
  yl += 2; yl += pdf.text(L, yl, `Mode de paiement / Payment type : ${m?.label ?? r.method ?? ''}${r.ref ? ` · ${String(m?.refLabel ?? 'Référence').replace(' / référence', '')} ${r.ref}` : ''}${r.bank ? ` · ${r.bank}` : ''}`, { size: 9.5, maxWidth: LW });
  yl += 1; pdf.text(L, yl, `Encaissé par / Received by : ${r.cashier ?? ''}`, { size: 9.5, maxWidth: LW });
  const yc = Math.min(y, 236);
  pdf.text(R, yc, `Fait à ${b.town}, le ${todayFr()}`, { size: 9.5, align: 'right' });
  pdf.rect(R - 62, yc + 3, 62, 26, { stroke: [150, 150, 150] });
  pdf.text(R - 31, yc + 33, 'Cachet et signature de l\'établissement', { size: 8, align: 'center', color: GREY });

  if (r.status === 'ANNULE') pdf.text(50, 190, 'ANNULÉ', { size: 72, bold: true, color: [200, 0, 0], angle: 30 });

  // pied de page
  pdf.text(L, 280, `Ce reçu reprend le ticket de caisse n° ${r.number} ; il n'atteste aucun autre paiement.`, { size: 7.5, color: GREY });
  pdf.text(L + 3, 289, `École Collège Lycée Chateaubriand — ${b.city}`, { size: 7.5, bold: true, color: GREY });
  pdf.text(R - 3, 289, `Impression le ${todayFr()} - 1/1`, { size: 7.5, bold: true, color: GREY, align: 'right' });
  return pdf.output();
}

export async function downloadOfficialReceipt(r, opts) {
  return saveFile(`recu-${r.number}.pdf`, await officialReceiptPdf(r, opts));
}
