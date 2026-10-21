// Enseignements 2026-2027 à Tamatave (liste fournie par l'établissement le 21 octobre 2026) : une ligne par
// professeur et par matière, écrite comme l'école l'écrit ; classes et matières sont lues avec les mêmes
// règles que l'emploi du temps (rules/timetableImport.js). L'enseignement scientifique (1re et Tle générales)
// est partagé : M. Canusis et Mme Félicité, un seul carnet de notes et une seule moyenne.
import { normalizeClass, normalizeSubject } from '../rules/timetableImport.js';

export const ASSIGNMENT_LINES = [
  ['Mme Mirana', 'Français', '6e - 5e - 4e - 3e'],
  ['Mme Nathalie', 'Français', '2nde - 1e STMG - 1e G'],
  ['M. Jugit', 'Anglais', '6e - 5e - 4e'],
  ['Mme Pasimiry', 'Anglais', '3e - 2nde - 1e STMG - Tle STMG - 1e G - Tle G'],
  ['Mme Henriette', 'Espagnol', '6e - 5e - 4e - 3e - 2nde - 1e STMG - Tle STMG - 1e G - Tle G'],
  ['M. Hery', 'Espagnol', '6e - 5e - 4e - 3e - 2nde - 1e STMG - Tle STMG - 1e G - Tle G'],
  ['Mme Felana', 'Histoire-Géographie', '4e - 3e - 2nde - 1e STMG - Tle STMG - 1e G - Tle G'],
  ['Mme Harris', 'Histoire-Géographie', '6e - 5e'],
  ['Mme Felana', 'EMC', '4e - 3e - 2nde - 1e STMG - Tle STMG - 1e G - Tle G'],
  ['Mme Harris', 'EMC', '6e - 5e'],
  ['M. Esmane', 'Mathématiques', '6e - 5e - 4e - 3e'],
  ['M. Hassanaly', 'Mathématiques', 'Tle STMG'],
  ['M. Hassanaly', 'Spé Mathématiques', '1e G - Tle G'],
  ['M. Canusis', 'Physique-Chimie', '3e - 2nde - 1e G - Tle G'],
  ['M. Canusis', 'Enseignement Scientifique', '1e G - Tle G'],
  ['Mme Miora', 'SVT', '6e - 5e - 4e - 3e - 2nde'],
  ['Mme Félicité', 'Enseignement Scientifique', '1e G - Tle G'],
  ['Mme Félicité', 'Spé SVT', '1e G - Tle G'],
  ['Mme Karele', 'SES', '2nde'],
  ['Mme Karele', 'Economie', '1e STMG - Tle STMG'],
  ['Mme Karele', 'Droit', '1e STMG - Tle STMG'],
  ['Mme Karele', 'Management', '1e STMG'],
  ['M. Steven', 'Technologie', '5e - 4e - 3e'],
  ['M. Steven', 'SNT', '2nde'],
  ['M. Steven', 'Maths', '1e STMG'],
  ['M. Fortuna', 'SGN', '1e STMG'],
  ['M. Fortuna', 'MSGN', 'Tle STMG'],
  ['Mme Elise', 'EPS', '6e - 5e - 3e - 1e STMG - 1e G'],
  ['Mme Doris', 'EPS', '4e - 2nde - Tle G - Tle STMG'],
  ['Mme Lanto', 'Mandarin', '6e - 5e - 4e'],
  ['M. Raymond', 'Philosophie', 'Tle G - Tle STMG'],
];

/** Une entrée par professeur et par matière : { name, subjects: [matière], classes: [...] }. */
export const ASSIGNMENTS = ASSIGNMENT_LINES.map(([name, subject, classes]) => ({
  name, subjects: [normalizeSubject(subject).subject], classes: classes.split(/\s*-\s*/).map((c) => normalizeClass(c) ?? c),
  ...(/enseignement scientifique/i.test(subject) ? { shared: true } : {}),
}));

/** Professeurs d'une matière dans une classe (deux pour un enseignement partagé, ex. enseignement scientifique). */
export const teachersOf = (subject, cls, list = ASSIGNMENTS) => list.filter((a) => a.subjects.includes(subject) && a.classes.includes(cls)).map((a) => a.name);
/** Toutes les matières et classes d'un professeur (plusieurs lignes possibles). */
export const teacherSummary = (name, list = ASSIGNMENTS) => list.filter((a) => a.name === name).map((a) => `${a.subjects.join(', ')} (${a.classes.join(', ')})`).join(' · ');
