// Manuels et cahiers d'activité de Tamatave (démonstration ; prix de perte FICTIFS, à remplacer).
// - Manuels de base : à rendre, en location à 25 000 Ar l'un pour l'année.
// - Cahiers d'activité : soit à rendre (en location), soit gardés par l'élève (vendus, prix propre).
// - Désignation d'un manuel : matière, niveau, éditeur et année du programme (souvent sans titre propre).
// - Tous les élèves d'une classe reçoivent le même lot ; en 1re et Terminale générales, les
//   manuels de spécialité ne vont qu'aux élèves qui suivent la spécialité.
import { DEMO_CLASSES } from './schoollife.js';
import { TLE_G_STUDENTS } from './bulletins.js';

export const RENTAL_PRICE = 25_000;
const S = (n, b = 0, u = 0, d = 0) => ({ NEUF: n, BON: b, USE: u, DECHIRE: d });
const M = (id, title, subject, levels, o = {}) => ({
  id, title, subject, levels, category: 'MANUEL', returnable: true, kind: 'ORIGINAL', binding: 'DOS_CARRE',
  price: RENTAL_PRICE, replacementPrice: 60_000, stock: S(4, 6, 2), editor: '', programYear: null, ...o,
});
const C = (id, title, subject, levels, price, o = {}) => ({
  id, title, subject, levels, category: 'CAHIER', returnable: false, kind: 'ORIGINAL', binding: 'RELIURE',
  price, replacementPrice: null, stock: S(20), editor: '', programYear: null, ...o,
});
const COLLEGE = ['6e', '5e', '4e', '3e'];

export const MANUALS = [
  // Collège
  M('m10', 'Mathématiques 6e', 'Mathématiques', ['6e'], { replacementPrice: 55_000 }),
  M('m11', 'Mathématiques 5e', 'Mathématiques', ['5e'], { replacementPrice: 55_000 }),
  M('m12', 'Mathématiques 4e', 'Mathématiques', ['4e'], { replacementPrice: 58_000 }),
  M('m13', 'Mathématiques 3e', 'Mathématiques', ['3e'], { replacementPrice: 58_000 }),
  M('m14', 'Français 6e', 'Français', ['6e'], { replacementPrice: 52_000 }),
  M('m4', 'Français 5e', 'Français', ['5e'], { editor: 'Belin', programYear: 2016, replacementPrice: 52_000, stock: S(3, 4, 2, 1) }),
  M('m15', 'Français 4e', 'Français', ['4e'], { replacementPrice: 54_000 }),
  M('m16', 'Français 3e', 'Français', ['3e'], { replacementPrice: 54_000 }),
  M('m17', 'Histoire-Géographie 6e-5e', 'Histoire-Géographie', ['6e', '5e'], { replacementPrice: 62_000 }),
  M('m18', 'Histoire-Géographie 4e-3e', 'Histoire-Géographie', ['4e', '3e'], { replacementPrice: 62_000 }),
  M('m19', 'Sciences de la vie et de la Terre cycle 4', 'SVT', ['5e', '4e', '3e'], { replacementPrice: 65_000 }),
  M('m20', 'Physique-Chimie cycle 4', 'Physique-Chimie', ['5e', '4e', '3e'], { replacementPrice: 65_000 }),
  C('m5', 'Anglais — cahier d\'activités', 'Anglais', COLLEGE, 18_000),
  C('m21', 'Espagnol — cahier d\'activités', 'Espagnol', ['5e', '4e', '3e'], 15_000),
  C('m22', 'Mathématiques — cahier d\'exercices (à rendre)', 'Mathématiques', ['6e'], RENTAL_PRICE, { returnable: true, replacementPrice: 30_000, kind: 'PHOTOCOPIE', stock: S(10, 5) }),
  // Seconde
  M('m30', 'Mathématiques 2de', 'Mathématiques', ['2de'], { replacementPrice: 70_000 }),
  M('m31', 'Français 2de', 'Français', ['2de'], { replacementPrice: 60_000 }),
  M('m32', 'Histoire-Géographie 2de', 'Histoire-Géographie', ['2de'], { replacementPrice: 68_000 }),
  M('m33', 'Physique-Chimie 2de', 'Physique-Chimie', ['2de'], { replacementPrice: 70_000 }),
  M('m34', 'SVT 2de', 'SVT', ['2de'], { replacementPrice: 70_000 }),
  M('m35', 'SES 2de', 'SES', ['2de'], { replacementPrice: 62_000 }),
  C('m36', 'Anglais lycée — cahier d\'activités', 'Anglais', ['2de', '1re Générale', '1re STMG'], 20_000),
  // Première
  M('m40', 'Français 1re', 'Français', ['1re Générale', '1re STMG'], { replacementPrice: 62_000 }),
  M('m41', 'Histoire-Géographie 1re', 'Histoire-Géographie', ['1re Générale', '1re STMG'], { replacementPrice: 68_000 }),
  M('m42', 'Enseignement scientifique 1re', 'Enseignement scientifique', ['1re Générale'], { replacementPrice: 66_000 }),
  M('m43', 'Spécialité Mathématiques 1re', 'Mathématiques', ['1re Générale'], { specialty: 'MATHS', replacementPrice: 75_000 }),
  M('m44', 'Spécialité Physique-Chimie 1re', 'Physique-Chimie', ['1re Générale'], { specialty: 'PC', replacementPrice: 75_000 }),
  M('m45', 'Spécialité SVT 1re', 'SVT', ['1re Générale'], { specialty: 'SVT', replacementPrice: 75_000 }),
  M('m1', 'Management 1re STMG', 'Management', ['1re STMG'], { editor: 'Foucher', programYear: 2019, replacementPrice: 72_000, stock: S(2, 3, 1, 1) }),
  M('m2', 'Sciences de gestion et numérique 1re', 'SGN', ['1re STMG'], { kind: 'PHOTOCOPIE', binding: 'RELIURE', replacementPrice: 35_000, stock: S(6) }),
  M('m3', 'Mathématiques 1re STMG', 'Mathématiques', ['1re STMG'], { editor: 'Hachette', programYear: 2019, replacementPrice: 64_000, stock: S(0, 4, 2) }),
  M('m46', 'Droit 1re STMG', 'Droit', ['1re STMG'], { replacementPrice: 58_000 }),
  M('m47', 'Économie 1re STMG', 'Économie', ['1re STMG'], { replacementPrice: 58_000 }),
  // Terminale
  M('m6', 'Philosophie Terminale', 'Philosophie', ['Terminale Générale', 'Terminale STMG'], { editor: 'Nathan', programYear: 2020, replacementPrice: 66_000, stock: S(1, 5, 3) }),
  M('m50', 'Histoire-Géographie Terminale', 'Histoire-Géographie', ['Terminale Générale', 'Terminale STMG'], { replacementPrice: 68_000 }),
  M('m51', 'Enseignement scientifique Terminale', 'Enseignement scientifique', ['Terminale Générale'], { replacementPrice: 66_000 }),
  M('m52', 'Spécialité Mathématiques Terminale', 'Mathématiques', ['Terminale Générale'], { editor: 'Hachette', programYear: 2020, specialty: 'MATHS', replacementPrice: 78_000 }),
  M('m53', 'Spécialité Physique-Chimie Terminale', 'Physique-Chimie', ['Terminale Générale'], { editor: 'Bordas', programYear: 2020, specialty: 'PC', replacementPrice: 78_000 }),
  M('m54', 'Spécialité SVT Terminale', 'SVT', ['Terminale Générale'], { editor: 'Nathan', programYear: 2020, specialty: 'SVT', replacementPrice: 78_000 }),
  M('m55', 'Management Terminale STMG', 'Management', ['Terminale STMG'], { replacementPrice: 72_000 }),
  M('m56', 'Droit et Économie Terminale STMG', 'Droit', ['Terminale STMG'], { replacementPrice: 64_000 }),
  C('m57', 'Anglais Terminale — annales et activités', 'Anglais', ['Terminale Générale', 'Terminale STMG'], 22_000),
];

/** Spécialités des élèves de démonstration (Terminale générale). */
export const DEMO_SPECIALTIES = Object.fromEntries(TLE_G_STUDENTS.map((s) => [s.name, s.specialties]));

// Prêts de la rentrée (lot complet de la classe) : manuels rendus en fin d'année (30 juin)
const YEAR_END = '2027-06-30';
let n = 0;
const handOut = (cls) => DEMO_CLASSES[cls].flatMap((student) => MANUALS
  .filter((m) => m.levels.includes(cls) && (!m.specialty || (DEMO_SPECIALTIES[student] ?? []).includes(m.specialty)))
  .map((m) => ({ id: `l${++n}`, manualId: m.id, student, cls, stateOut: m.returnable ? 'BON' : 'NEUF', issuedOn: '2026-09-07', ...(m.returnable ? { dueBack: YEAR_END } : { sold: true }) })));
export const LOANS = [...handOut('1re STMG'), ...handOut('5e'), ...handOut('Terminale Générale')]
  .filter((l) => !(l.manualId === 'm2')) // SGN : photocopies arrivées en octobre, pas encore distribuées
  .map((l) => {
    // démonstration : un manuel perdu à régler, un prêt ponctuel non rendu
    if (l.manualId === 'm1' && l.student === 'RAJAONARIVELO Tsiry') return { ...l, stateIn: 'PERDU', returnedOn: null, declaredOn: '2026-10-08', charge: 'A_REGLER' };
    if (l.manualId === 'm3' && l.student === 'RAHARISON Fanja') return { ...l, dueBack: '2026-10-09', note: 'Prêt ponctuel pour le DS' };
    return l;
  });
