// Remplacement : quand la CPE est absente, ses alertes vont aussi au secrétariat (et inversement),
// pour la journée choisie. Rien ne se perd pendant une absence.
import { readStored, writeStored } from './persist.js';
import { today } from './clock.js';

const KEY = 'ent-remplacements-v1';
// Alertes partagées (durable) : à partir d'une date, le secrétariat reçoit aussi les alertes de la CPE.
// Le compte de la CPE reste ouvert et ses accès ne changent pas : seuls les accès (Droits d'accès) distinguent
// les deux postes. Réglé par la Direction ; gardé d'une année sur l'autre (« ent-k- »).
const HANDOVER_KEY = 'ent-k-reprise-vie-scolaire';
export const loadHandover = () => readStored(HANDOVER_KEY) ?? null; // { since: 'AAAA-MM-JJ' } ou null
export const saveHandover = (h) => writeStored(HANDOVER_KEY, h);
/** Le secrétariat reçoit-il aussi les alertes de la CPE ce jour-là ? */
export const cpeHandedOver = (day = today(), h = loadHandover()) => Boolean(h?.since && h.since <= day);
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
export const coveringFor = (role, day, all = loadDelegations(), h = loadHandover()) => {
  const out = Object.entries(all).filter(([, d]) => d.to === role && d.day === day).map(([from]) => from);
  if (role === 'BUREAU' && cpeHandedOver(day, h) && !out.includes('VIE_SCOLAIRE')) out.push('VIE_SCOLAIRE');
  return out;
};
