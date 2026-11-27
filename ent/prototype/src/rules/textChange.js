// Corrections de la Direction : distinguer une vraie modification (sens, mots changés) d'une simple correction de
// forme (ponctuation, majuscules, accents, espaces, faute de frappe). Seules les vraies modifications sont
// signalées au professeur dans « Modifications du bulletin ».

const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ').trim();

/** Distance d'édition (insertion, suppression, remplacement, inversion de deux lettres voisines). */
export function editDistance(a, b) {
  const m = a.length; const n = b.length;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 1; j <= n; j += 1) d[0][j] = j;
  for (let i = 1; i <= m; i += 1) {
    for (let j = 1; j <= n; j += 1) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[m][n];
}
// faute de frappe : un ou deux caractères d'écart (selon la longueur du mot)
const typo = (a, b) => editDistance(a, b) <= (Math.max(a.length, b.length) <= 4 ? 1 : 2);

/** true si le texte a vraiment changé (pas seulement la ponctuation, les accents ou des fautes de frappe). */
export function isRealChange(before, after) {
  const a = norm(before); const b = norm(after);
  if (a === b) return false;
  const wa = a.split(' ').filter(Boolean); const wb = b.split(' ').filter(Boolean);
  // mots collés ou décollés (« peut-être » / « peutetre », « parce que » / « parceque »)
  if (wa.join('') === wb.join('')) return false;
  if (wa.length !== wb.length) return true;
  return wa.some((w, i) => w !== wb[i] && !typo(w, wb[i]));
}
