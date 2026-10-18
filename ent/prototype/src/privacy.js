// Données réelles dans le navigateur (pilote) : un import Excel met des données d'élèves (mineurs) dans ce
// navigateur. Pour qu'elles n'y restent pas sur un ordinateur partagé :
//  - elles expirent seules après REAL_DATA_TTL_HOURS (effacées au chargement suivant) ;
//  - « Effacer les données de cet ordinateur » les supprime à tout moment ;
//  - tant qu'elles sont là, on ne change plus de profil (sinon « Direction » serait à un clic).
import { loadImport } from './importStore.js';

export const REAL_DATA_TTL_HOURS = 12;
// Réglages de l'établissement et préférences d'affichage : rien de personnel, gardés.
const KEEP = ['ent-chateaubriand-settings-v3', 'ent-ambiance-prefs-v1'];

export const hasRealData = () => { try { return localStorage.getItem('ent-import-v1') !== null; } catch { return false; } };
export const isExpired = (importedAt, now = Date.now()) => !!importedAt && now - Date.parse(importedAt) > REAL_DATA_TTL_HOURS * 3600e3;

/** Efface tout ce que l'ENT a gardé dans ce navigateur (sauf réglages). Renvoie le nombre de clés effacées. */
export function wipeLocalData(storage = localStorage) {
  const keys = [];
  for (let i = 0; i < storage.length; i += 1) { const k = storage.key(i); if (k?.startsWith('ent-') && !KEEP.includes(k)) keys.push(k); }
  keys.forEach((k) => storage.removeItem(k));
  try { sessionStorage.clear(); } catch { /* indisponible */ }
  return keys.length;
}

/** Au chargement : efface les données réelles expirées. */
export function purgeExpired(now = Date.now()) {
  try {
    const imp = loadImport();
    if (imp && isExpired(imp.importedAt, now)) { wipeLocalData(); return true; }
  } catch { /* stockage indisponible */ }
  return false;
}
