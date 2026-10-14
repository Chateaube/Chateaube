// Données importées (élèves, enseignements) : gardées UNIQUEMENT dans le navigateur de la personne
// qui les importe (localStorage). Elles ne sont ni publiées ni envoyées : chaque testeur importe
// son propre fichier, et « Effacer » les supprime.
const KEY = 'ent-import-v1';

export function loadImport() {
  try { return JSON.parse(localStorage.getItem(KEY)) ?? null; } catch { return null; }
}
export function saveImport(data) {
  try { localStorage.setItem(KEY, JSON.stringify({ ...data, importedAt: new Date().toISOString() })); return true; } catch { return false; }
}
export function clearImport() {
  try { localStorage.removeItem(KEY); } catch { /* stockage indisponible */ }
}
