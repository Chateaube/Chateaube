// Examens blancs de démonstration (élèves et notes FICTIFS).
import { CLASSES } from './schoollife.js';
import { DEMO_SPECIALTIES } from './manuals.js';

const fill = (cls, rows) => Object.fromEntries(CLASSES[cls].map((n, i) => [n, rows[i % rows.length]]));
export const MOCK_SESSIONS = [
  { id: 'x1', kind: 'BAC_STMG', cls: 'Terminale STMG', title: 'Bac blanc n°1', date: '2026-10-05',
    marks: fill('Terminale STMG', [
      { PHI: 11, MSGN: 13.5, DE: 12, GO: 14 }, { PHI: 8, MSGN: 9.5, DE: 10, GO: 11 }, { PHI: 14, MSGN: 16, DE: 15.5, GO: 15 },
      { PHI: 6.5, MSGN: 8, DE: 7, GO: 'ABS' }, { PHI: 12, MSGN: 11, DE: 13, GO: 12.5 }, { PHI: 9, MSGN: 12.5, DE: 11.5, GO: 10 }]) },
  { id: 'x2', kind: 'BAC_G', cls: 'Terminale Générale', title: 'Bac blanc n°1', date: '2026-10-06',
    marks: fill('Terminale Générale', [{ PHI: 12, SPE1: 14, SPE2: 13, GO: 15 }, { PHI: 9.5, SPE1: 10, SPE2: 11.5, GO: 12 }, { PHI: 15, SPE1: 17, SPE2: 16.5, GO: 16 }]) },
  { id: 'x3', kind: 'DNB', cls: '3e', title: 'Brevet blanc n°1', date: '2026-10-08',
    marks: fill('3e', [{ FR: 13, MA: 11, HG: 14, SC: 12, OR: 15 }, { FR: 9, MA: 8.5, HG: 10, SC: 9, OR: 12 }, { FR: 16, MA: 17, HG: 15, SC: 16, OR: 17 }, { FR: 11, MA: 12.5, HG: 9, SC: 11 }]) },
  { id: 'x4', kind: 'EAF', cls: '1re STMG', title: 'Bac blanc de français', date: '2026-10-21', marks: {} },
];

// Notes OFFICIELLES des épreuves anticipées de français, passées en 1re (juin 2026)
export const OFFICIAL_EAF = {
  ...fill('Terminale STMG', [{ FR_E: 10, FR_O: 13 }, { FR_E: 8, FR_O: 11 }, { FR_E: 14, FR_O: 16 }, { FR_E: 7, FR_O: 9 }, { FR_E: 11, FR_O: 12 }, { FR_E: 9, FR_O: 14 }]),
  ...fill('Terminale Générale', [{ FR_E: 12, FR_O: 14 }, { FR_E: 9, FR_O: 12 }, { FR_E: 15, FR_O: 17 }]),
};
// Contrôle continu : moyenne des bulletins de 1re et de Terminale à ce jour
export const CC_AVERAGES = {
  ...fill('Terminale STMG', [12.4, 9.8, 15.1, 8.2, 12.9, 11.3]),
  ...fill('Terminale Générale', [13.2, 10.6, 16.4]),
};
export const SPECIALTY_LABELS = { MATHS: 'Mathématiques', PC: 'Physique-chimie', SVT: 'SVT', SES: 'SES', HGGSP: 'HGGSP', HLP: 'HLP', LLCER: 'LLCER', NSI: 'NSI' };
export const specialtiesOf = (student) => (DEMO_SPECIALTIES[student] ?? []).map((s) => SPECIALTY_LABELS[s] ?? s);
