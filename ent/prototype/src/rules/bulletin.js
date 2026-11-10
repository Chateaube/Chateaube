// Bulletins : les lignes dépendent de l'élève (spécialités de Terminale ou de Première générale),
// les cases s'adaptent à la longueur des appréciations : plus de formules ni de lignes décalées.
import { classStats } from './grading.js';

export const SPECIALTIES = {
  MATHS: 'Mathématiques',
  PC: 'Physique-Chimie',
  SVT: 'Sciences de la vie et de la Terre',
};
// Nombre de spécialités suivies : 3 en Première générale, 2 en Terminale générale
export const SPECIALTY_COUNT = { '1re Générale': 3, 'Terminale Générale': 2 };

/** Matières d'un élève : tronc commun + ses spécialités seulement. */
export const subjectsOf = (student, classSubjects) =>
  classSubjects.filter((s) => !s.specialty || (student.specialties ?? []).includes(s.specialty));

/** Contrôle du choix de spécialités selon la classe. */
export function specialtyErrors(cls, specialties = []) {
  const n = SPECIALTY_COUNT[cls];
  if (!n) return [];
  return specialties.length === n ? [] : [`${cls} : ${n} spécialités à choisir (${specialties.length} choisie${specialties.length > 1 ? 's' : ''}).`];
}

/** Moyenne de la classe dans une matière : seulement les élèves qui la suivent. */
export const subjectClassAverage = (subjectId, students) =>
  classStats(students.filter((st) => st.avgs[subjectId] !== undefined).map((st) => st.avgs[subjectId])).avg;

/** « Classe de Tle Générale - Spécialités Mathématiques et Physique-Chimie » */
export function classLine(cls, specialties = []) {
  const short = cls.replace('Terminale', 'Tle').replace('1re', '1re');
  if (!specialties.length) return `Classe de ${short}`;
  const names = specialties.map((k) => (k === 'SVT' ? 'SVT' : SPECIALTIES[k]));
  return `Classe de ${short} - Spécialités ${names.slice(0, -1).join(', ')}${names.length > 1 ? ' et ' : ''}${names[names.length - 1]}`;
}

/** Colonne « Spécialités » d'un import : « Maths, PC », « Maths / SVT », « Mathématiques et Physique-Chimie ». */
export function parseSpecialties(raw) {
  const t = String(raw ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const found = [];
  for (const part of t.split(/[,;\/+]| et /).map((s) => s.trim()).filter(Boolean)) {
    const code = /^(spe\s*)?math/.test(part) ? 'MATHS' : /^(spe\s*)?(pc|physique)/.test(part) ? 'PC' : /^(spe\s*)?(svt|sciences de la vie)/.test(part) ? 'SVT' : null;
    if (code && !found.includes(code)) found.push(code);
  }
  return found;
}

const subjKey = (l) => String(l ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
/**
 * Ordre des matières du bulletin, fixé par la Direction (Paramètres du bulletin) : liste de libellés.
 * Les matières absentes de la liste gardent leur ordre d'origine, après celles qui y sont.
 */
export function orderSubjects(rows, order = []) {
  if (!order?.length) return rows;
  const rank = new Map(order.map((l, i) => [subjKey(l), i]));
  return rows.map((r, i) => ({ r, i, k: rank.get(subjKey(r.label)) ?? order.length + i }))
    .sort((a, b) => a.k - b.k).map((x) => x.r);
}
/** Déplace une matière d'un cran (−1 : vers le haut, +1 : vers le bas) dans l'ordre. */
export function moveSubject(order, label, dir) {
  const i = order.indexOf(label); const j = i + dir;
  if (i < 0 || j < 0 || j >= order.length) return order;
  const next = [...order]; [next[i], next[j]] = [next[j], next[i]];
  return next;
}
