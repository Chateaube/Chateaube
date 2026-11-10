// Remplacement : quand la CPE est absente, ses alertes vont aussi au secrétariat (et inversement),
// pour la journée choisie. Rien ne se perd pendant une absence.
const KEY = 'ent-remplacements-v1';
export const DELEGABLE = { VIE_SCOLAIRE: 'BUREAU', BUREAU: 'VIE_SCOLAIRE' };
export const LABELS = { VIE_SCOLAIRE: 'la CPE', BUREAU: 'le secrétariat' };
export const TO_LABELS = { VIE_SCOLAIRE: 'à la CPE', BUREAU: 'au secrétariat' };
export const loadDelegations = () => { try { return JSON.parse(localStorage.getItem(KEY)) ?? {}; } catch { return {}; } };
export function setAbsent(role, day, on) {
  const all = loadDelegations();
  if (on) all[role] = { to: DELEGABLE[role], day }; else delete all[role];
  try { localStorage.setItem(KEY, JSON.stringify(all)); } catch { /* stockage indisponible */ }
  return all;
}
/** Rôles dont `role` reçoit aussi les alertes ce jour-là. */
export const coveringFor = (role, day, all = loadDelegations()) => Object.entries(all).filter(([, d]) => d.to === role && d.day === day).map(([from]) => from);
