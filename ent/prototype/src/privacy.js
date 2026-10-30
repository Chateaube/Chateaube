// Données réelles dans le navigateur (pilote) : un import Excel met des données d'élèves (mineurs) dans ce
// navigateur, et chaque saisie y est enregistrée. Pour qu'elles n'y restent pas sur un appareil abandonné :
//  - elles sont effacées après REAL_DATA_IDLE_DAYS jours SANS UTILISATION (chaque ouverture repousse l'échéance :
//    les notes saisies le lundi sont toujours là le mardi) ;
//  - « Effacer les données de cet ordinateur » les supprime à tout moment ;
//  - tant qu'elles sont là, on ne change plus de profil (sinon « Direction » serait à un clic).
import { loadImport } from './importStore.js';

export const REAL_DATA_IDLE_DAYS = 30;
const LAST_USE = 'ent-derniere-utilisation';
// Réglages de l'établissement, préférences d'affichage, tarifs et articles (« ent-k-… ») : rien de personnel, gardés.
const KEEP = ['ent-chateaubriand-settings-v3', 'ent-ambiance-prefs-v1'];
const kept = (k) => KEEP.includes(k) || (k.startsWith('ent-k-') && k !== 'ent-k-moi');

export const hasRealData = () => { try { return localStorage.getItem('ent-import-v1') !== null; } catch { return false; } };
/** Vrai si la dernière utilisation date de plus de REAL_DATA_IDLE_DAYS jours. */
export const isExpired = (lastUse, now = Date.now()) => !!lastUse && now - Date.parse(lastUse) > REAL_DATA_IDLE_DAYS * 86_400e3;

/** Efface tout ce que l'ENT a gardé dans ce navigateur (sauf réglages et tarifs). Renvoie le nombre de clés effacées. */
export function wipeLocalData(storage = localStorage) {
  const keys = [];
  for (let i = 0; i < storage.length; i += 1) { const k = storage.key(i); if (k?.startsWith('ent-') && !kept(k)) keys.push(k); }
  keys.forEach((k) => storage.removeItem(k));
  try { sessionStorage.clear(); } catch { /* indisponible */ }
  return keys.length;
}

/** Au chargement : efface les données réelles laissées sans utilisation, puis note l'utilisation d'aujourd'hui. */
export function purgeExpired(now = Date.now()) {
  let purged = false;
  try {
    const imp = loadImport();
    const last = localStorage.getItem(LAST_USE) ?? imp?.importedAt;
    if (imp && isExpired(last, now)) { wipeLocalData(); purged = true; }
    localStorage.setItem(LAST_USE, new Date(now).toISOString());
  } catch { /* stockage indisponible */ }
  return purged;
}
