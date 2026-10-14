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
