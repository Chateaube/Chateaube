// Manuels et prêts : partagés entre l'écran Manuels et la remise des bulletins
// (prototype : gardés dans ce navigateur ; en production, en base).
import { MANUALS, LOANS } from './data/manuals.js';
import { demoOr } from './demoData.js';

const KEY = 'ent-manuels-v2'; // v2 : prix, cahiers à rendre ou vendus, spécialités
export function loadManuals() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY));
    if (d?.manuals && d?.loans) return d;
  } catch { /* stockage indisponible */ }
  return { manuals: MANUALS, loans: demoOr(LOANS, []) }; // les titres et les prix restent, les prêts fictifs non
}
/** La liste des manuels de l'école a-t-elle été saisie (ou importée, onglet 8) ? Sinon, les prix d'exemple ne sont pas facturés. */
export function manualsDefined() { try { return Boolean(JSON.parse(localStorage.getItem(KEY))?.manuals?.length); } catch { return false; } }
export function saveManuals(data) {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* stockage indisponible */ }
}
