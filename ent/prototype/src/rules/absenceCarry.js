// Reprise des absences et retards d'avant l'ENT (1er trimestre tenu sur papier) : des totaux par élève,
// en demi-journées, qui s'ajoutent à ce qui est saisi ensuite dans l'ENT pour le bulletin.
import { readStored } from '../persist.js';

export const CARRY_KEY = 'ent-s-reprise-absences';
/** { until: 'AAAA-MM-JJ', students: { 'NOM Prénom': { justified, unjustified, late } } } */
export const loadCarry = () => readStored(CARRY_KEY) ?? { until: '', students: {} };
const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
/** Totaux du bulletin : reprise + absences comptées dans l'ENT (objet { justified, unjustified, late }). */
export function absenceTotals(name, counted = {}, carry = loadCarry()) {
  const c = carry.students?.[name] ?? {};
  return { justified: n(c.justified) + n(counted.justified), unjustified: n(c.unjustified) + n(counted.unjustified), late: n(c.late) + n(counted.late) };
}
