// Remplacement : quand la CPE est absente, ses alertes vont aussi au secrétariat (et inversement),
// pour la journée choisie. Rien ne se perd pendant une absence.
import { readStored, writeStored } from './persist.js';
import { today } from './clock.js';

const KEY = 'ent-remplacements-v1';
// Reprise durable (départ de la CPE) : à partir d'une date, le secrétariat assure la vie scolaire.
// Réglée par la Direction (Droits d'accès) ; gardée d'une année sur l'autre (« ent-k- »).
const HANDOVER_KEY = 'ent-k-reprise-vie-scolaire';
export const loadHandover = () => readStored(HANDOVER_KEY) ?? null; // { since: 'AAAA-MM-JJ' } ou null
export const saveHandover = (h) => writeStored(HANDOVER_KEY, h);
/** Le secrétariat assure-t-il la vie scolaire ce jour-là ? */
export const cpeHandedOver = (day = today(), h = loadHandover()) => Boolean(h?.since && h.since <= day);
/** Rôle qui fait le travail de la CPE ce jour-là (relectures, alertes). */
export const reviewsAsCpe = (role, day) => role === 'VIE_SCOLAIRE' || (role === 'BUREAU' && cpeHandedOver(day));
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
