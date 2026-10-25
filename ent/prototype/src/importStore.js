// Données importées (élèves, enseignements) : gardées UNIQUEMENT dans le navigateur de la personne
// qui les importe (localStorage). Elles ne sont ni publiées ni envoyées : chaque testeur importe
// son propre fichier, et « Effacer » les supprime.
const KEY = 'ent-import-v1';
// Si le navigateur refuse l'enregistrement (aperçu intégré, navigation privée, place insuffisante), les données
// restent en mémoire le temps de la visite : l'essai fonctionne, mais tout disparaît en rechargeant la page.
let memory = null;
export let importStorage = 'LOCAL'; // 'LOCAL' : gardé dans le navigateur ; 'MEMORY' : seulement jusqu'au rechargement

export function loadImport() {
  if (memory) return memory;
  try { return JSON.parse(localStorage.getItem(KEY)) ?? null; } catch { return null; }
}
/** Enregistre ; renvoie 'LOCAL' ou 'MEMORY' (jamais d'échec silencieux). */
export function saveImport(data) {
  const value = { ...data, importedAt: data.importedAt ?? new Date().toISOString() }; // l'heure du 1er import fixe l'expiration
  try {
    localStorage.setItem(KEY, JSON.stringify(value));
    if (localStorage.getItem(KEY) === null) throw new Error('stockage refusé');
    memory = null; importStorage = 'LOCAL'; return 'LOCAL';
  } catch { memory = value; importStorage = 'MEMORY'; return 'MEMORY'; }
}
export function clearImport() {
  memory = null;
  try { localStorage.removeItem(KEY); } catch { /* stockage indisponible */ }
}
