// Cellule CSV pour Excel (séparateur « ; »). Un texte qui commence par = + - @ (ou tabulation, retour chariot)
// serait exécuté comme une FORMULE à l'ouverture dans Excel (injection de formule) : on le préfixe d'une
// apostrophe, qu'Excel n'affiche pas. Les nombres (même négatifs : -5 000) restent des nombres.
const FORMULA = /^[=+\-@\t\r]/;
const NUMBER = /^[-+]?\d[\d\s\u00a0.,]*$/;

export function csvCell(v) {
  let t = v === null || v === undefined ? '' : String(v);
  if (FORMULA.test(t) && !NUMBER.test(t)) t = `'${t}`;
  return /[;"\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}
