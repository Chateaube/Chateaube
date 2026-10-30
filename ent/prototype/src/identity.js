// Qui utilise cet appareil ? Avec les vraies données, chaque saisie est signée du nom de la personne choisie
// à la première ouverture (en attendant les vrais comptes en ligne). Avec les exemples : les personnes fictives.
import { realData } from './demoData.js';
import { readStored, writeStored } from './persist.js';

const KEY = 'ent-k-moi';
const DEMO = { DIRECTION: 'Mme Sheena Lo', BUREAU: 'Mme Hanta', VIE_SCOLAIRE: 'M. Be', ENSEIGNANT: 'Mme Ranaivo' };
const ROLE_LABEL = { DIRECTION: 'Direction', BUREAU: 'secrétariat', VIE_SCOLAIRE: 'CPE', ENSEIGNANT: 'professeur' };
export const ROLES = [['DIRECTION', 'Direction'], ['BUREAU', 'Secrétariat'], ['VIE_SCOLAIRE', 'CPE / vie scolaire'], ['ENSEIGNANT', 'Professeur']];

/** { role, name } de la personne de cet appareil (vraies données), ou null. */
export const loadMe = () => readStored(KEY) ?? null;
export const saveMe = (me) => writeStored(KEY, me);
export const forgetMe = () => { try { localStorage.removeItem(KEY); } catch { /* indisponible */ } };

/** Nom de la personne qui agit, pour le profil donné. */
export function me(role) {
  const m = realData() ? loadMe() : null;
  if (m?.name) return m.name;
  if (realData()) return { DIRECTION: 'Direction', BUREAU: 'Secrétariat', VIE_SCOLAIRE: 'Vie scolaire', ENSEIGNANT: 'Professeur' }[role] ?? '';
  return DEMO[role] ?? '';
}
/** « Mme Hanta (secrétariat) » */
export const meLabel = (role) => `${me(role)} (${ROLE_LABEL[role] ?? role})`;
