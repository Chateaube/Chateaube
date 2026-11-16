// Manuels et prêts : partagés entre l'écran Manuels et la remise des bulletins
// (prototype : gardés dans ce navigateur ; en production, en base).
import { MANUALS, LOANS } from './data/manuals.js';
import { demoOr, realData } from './demoData.js';

const KEY = 'ent-manuels-v2'; // v2 : prix, cahiers à rendre ou vendus, spécialités
// titres d'exemple (m1…m999) : écartés avec les vraies données, ainsi que leurs remises ; les titres créés par
// l'école ont un identifiant long (m + horodatage)
const isDemo = (id) => /^m\d{1,3}$/.test(id);
export function loadManuals() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY));
    if (d?.manuals && d?.loans) return realData() ? { ...d, manuals: d.manuals.filter((m) => !isDemo(m.id)), loans: d.loans.filter((l) => !isDemo(l.manualId)) } : d;
  } catch { /* stockage indisponible */ }
  return realData() ? { manuals: [], loans: [] } : { manuals: MANUALS, loans: demoOr(LOANS, []) };
}
/** La liste des manuels de l'école a-t-elle été saisie (ou importée, onglet 8) ? Sinon, les prix d'exemple ne sont pas facturés. */
export function manualsDefined() { return loadManuals().manuals.length > 0; }
export function saveManuals(data) {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* stockage indisponible */ }
}
