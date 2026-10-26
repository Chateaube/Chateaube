// Examens blancs de démonstration (élèves et notes FICTIFS).
import { CLASSES, DEMO_CLASSES } from './schoollife.js';
import { DEMO_SPECIALTIES } from './manuals.js';
import { EXAMS } from '../rules/mockExam.js';

// Notes vraisemblables : niveau de l'élève + écart propre à chaque épreuve, arrondies au demi-point
const ids = (kind) => EXAMS[kind].parts.flatMap((p) => (p.subs ? p.subs.map((s) => s.id) : [p.id]));
const marks = (kind, levels) => (student, i) => Object.fromEntries(ids(kind).map((id, k) => {
  const v = levels[i % levels.length] + (((k * 7 + i * 3) % 9) - 4) * 0.75;
  return [id, Math.max(2, Math.min(19.5, Math.round(v * 2) / 2))];
}));
const fill = (cls, fn) => Object.fromEntries(DEMO_CLASSES[cls].map((n, i) => [n, fn(n, i)]));

export const MOCK_SESSIONS = [
  { id: 'x1', kind: 'BAC_STMG', cls: 'Terminale STMG', title: 'Bac blanc n°1', date: '2026-10-05', counts: {}, marks: fill('Terminale STMG', marks('BAC_STMG', [12.5, 9.5, 15, 7.5, 12, 11])) },
  { id: 'x2', kind: 'BAC_G', cls: 'Terminale Générale', title: 'Bac blanc n°1', date: '2026-10-06', counts: {}, marks: fill('Terminale Générale', marks('BAC_G', [13, 10, 16])) },
  { id: 'x3', kind: 'DNB', cls: '3e', title: 'Brevet blanc n°1', date: '2026-10-08', counts: {}, marks: fill('3e', marks('DNB', [13, 9, 16, 11])) },
  { id: 'x4', kind: 'PREMIERE_STMG', cls: '1re STMG', title: 'Épreuves de 1re blanches n°1', date: '2026-10-09', counts: {}, marks: fill('1re STMG', marks('PREMIERE_STMG', [11, 13.5, 9, 14, 10.5])), published: { at: '2026-10-12', by: 'Direction' } },
];
MOCK_SESSIONS[0].marks['RAMANANTSOA Nathan'].GO = 'ABS';

// Notes OFFICIELLES de 1re des Terminales (session de juin 2026) : épreuves anticipées et épreuves de fin de 1re
export const OFFICIAL_FIRST = {
  ...fill('Terminale STMG', marks('PREMIERE_STMG', [11.5, 9, 14.5, 8, 12, 10.5])),
  ...fill('Terminale Générale', marks('PREMIERE_G', [12.5, 9.5, 15.5])),
};
export const SPECIALTY_LABELS = { MATHS: 'Mathématiques', PC: 'Physique-chimie', SVT: 'SVT', SES: 'SES', HGGSP: 'HGGSP', HLP: 'HLP', LLCER: 'LLCER', NSI: 'NSI' };
export const specialtiesOf = (student) => (DEMO_SPECIALTIES[student] ?? []).map((s) => SPECIALTY_LABELS[s] ?? s);
