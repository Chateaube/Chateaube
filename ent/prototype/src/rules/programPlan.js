// Programmation de l'année et suivi « fait / pas fait » (par trimestre).
// data : { base: { 'Matière|niveau': [parties…] } (corrections de la Direction),
//          plans: { 'classe|matière': { terms: { partie: 'T1'|'T2'|'T3' }, status, by, at } },
//          done:  { 'classe|matière': { partie: 'AAAA-MM-JJ' } } }
import { officialProgram, programSubject, programLevel } from '../data/officialPrograms.js';

export const TERMS = ['T1', 'T2', 'T3'];
export const TERM_LABEL = { T1: '1er trimestre', T2: '2e trimestre', T3: '3e trimestre' };
export const PLAN_STATUS = { BROUILLON: ['Brouillon', 'slate'], A_VALIDER: ['À valider', 'amber'], VALIDEE: ['Validée par la Direction', 'green'] };

/** Trimestre d'une date : septembre-décembre, janvier-mars, avril-juillet. */
export function termOf(iso) {
  const m = Number(String(iso).slice(5, 7));
  return m >= 8 ? 'T1' : m <= 3 ? 'T2' : 'T3';
}
export const planKey = (cls, subject) => `${cls}|${programSubject(subject)}`;
export const baseKey = (subject, cls) => `${programSubject(subject)}|${programLevel(cls)}`;

/** Parties du programme d'une matière pour une classe : la base officielle, ou la version corrigée par la Direction. */
export function partsFor(subject, cls, data = {}) {
  return data.base?.[baseKey(subject, cls)] ?? officialProgram(subject, cls)?.items ?? [];
}

/**
 * Avancement d'une classe dans une matière, au jour `today` :
 * prévu à date (parties des trimestres passés et du trimestre en cours), fait, en retard (trimestre passé non fait).
 */
export function progressOf(cls, subject, data = {}, today) {
  const parts = partsFor(subject, cls, data);
  const plan = data.plans?.[planKey(cls, subject)]?.terms ?? {};
  const done = data.done?.[planKey(cls, subject)] ?? {};
  const now = TERMS.indexOf(termOf(today));
  const rank = (p) => TERMS.indexOf(plan[p]);
  const planned = parts.filter((p) => plan[p]);
  const due = planned.filter((p) => rank(p) <= now);
  const late = planned.filter((p) => rank(p) < now && !done[p]);
  const current = planned.filter((p) => rank(p) === now);
  return {
    parts: parts.length, planned: planned.length, unplanned: parts.length - planned.length,
    due: due.length, doneCount: parts.filter((p) => done[p]).length, doneDue: due.filter((p) => done[p]).length,
    late, current, currentDone: current.filter((p) => done[p]).length,
    state: !planned.length ? 'SANS_PROGRAMMATION' : late.length ? 'RETARD' : 'DANS_LES_TEMPS',
  };
}
export const PROGRESS_STATE = { SANS_PROGRAMMATION: ['Pas de programmation', 'slate'], RETARD: ['En retard', 'red'], DANS_LES_TEMPS: ['Dans les temps', 'green'] };
