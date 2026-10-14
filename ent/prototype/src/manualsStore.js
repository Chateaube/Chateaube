// Manuels et prêts : partagés entre l'écran Manuels et la remise des bulletins
// (prototype : gardés dans ce navigateur ; en production, en base).
import { MANUALS, LOANS } from './data/manuals.js';

const KEY = 'ent-manuels-v1';
export function loadManuals() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY));
    if (d?.manuals && d?.loans) return d;
  } catch { /* stockage indisponible */ }
  return { manuals: MANUALS, loans: LOANS };
}
export function saveManuals(data) {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* stockage indisponible */ }
}
