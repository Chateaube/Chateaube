// Enseignements 2026-2027 à Tamatave (liste fournie par l'établissement) : professeur, matières, classes.
export const ASSIGNMENTS = [
  { name: 'Mme Mirana', subjects: ['Français'], classes: ['6e', '5e', '4e', '3e'] },
  { name: 'Mme Nathalie', subjects: ['Français'], classes: ['2de', '1re STMG', '1re Générale'] },
  { name: 'M. Jugit', subjects: ['Anglais'], classes: ['6e', '5e', '4e'] },
  { name: 'Mme Pasimiry', subjects: ['Anglais'], classes: ['3e', '2de', '1re STMG', 'Terminale STMG', '1re Générale', 'Terminale Générale'] },
  { name: 'Mme Henriette', subjects: ['Espagnol'], classes: ['6e', '5e', '4e', '3e', '2de', '1re STMG', 'Terminale STMG', '1re Générale', 'Terminale Générale'] },
  { name: 'M. Hery', subjects: ['Espagnol'], classes: ['6e', '5e', '4e', '3e', '2de', '1re STMG', 'Terminale STMG', '1re Générale', 'Terminale Générale'] },
  { name: 'Mme Felana', subjects: ['Histoire-Géographie'], classes: ['4e', '3e', '2de', '1re STMG', 'Terminale STMG', '1re Générale', 'Terminale Générale'] },
  { name: 'Mme Harris', subjects: ['Histoire-Géographie'], classes: ['6e', '5e'] },
  { name: 'M. Esmane RJ', subjects: ['Mathématiques'], classes: ['6e', '5e', '4e', '3e'] },
  { name: 'M. Hassanaly', subjects: ['Spécialité Mathématiques'], classes: ['1re Générale', 'Terminale Générale', 'Terminale STMG'] },
  { name: 'M. Canusis', subjects: ['Physique-Chimie'], classes: ['3e', '2de', '1re Générale', 'Terminale Générale'] },
  { name: 'Mme Miora', subjects: ['SVT'], classes: ['6e', '5e', '4e', '3e', '2de'] },
  { name: 'Mme Félicité', subjects: ['Spécialité SVT'], classes: ['1re Générale', 'Terminale Générale'] },
  { name: 'Mme Karele', subjects: ['SES', 'Économie', 'Droit', 'Management'], classes: ['2de', '1re STMG', 'Terminale STMG'] },
  { name: 'M. Steven', subjects: ['SNT', 'Technologie', 'Mathématiques'], classes: ['5e', '4e', '3e', '2de', '1re STMG'] },
  { name: 'M. Fortuna', subjects: ['SGN', 'MSGN'], classes: ['1re STMG', 'Terminale STMG'] },
  { name: 'Mme Elise', subjects: ['EPS'], classes: ['6e', '5e', '3e', '1re STMG', '1re Générale'] },
  { name: 'Mme Doris', subjects: ['EPS'], classes: ['4e', '2de', 'Terminale Générale', 'Terminale STMG'] },
  { name: 'Mme Lanto', subjects: ['Mandarin'], classes: ['6e', '5e', '4e'] },
  { name: 'M. Raymond', subjects: ['Philosophie'], classes: ['Terminale Générale', 'Terminale STMG'] },
  // Enseignement scientifique (1re et Terminale générales) : un seul enseignement, assuré en alternance par
  // deux professeurs de sciences ; un seul carnet de notes, que les deux remplissent, et une seule moyenne.
  { name: 'M. Canusis', subjects: ['Enseignement scientifique'], classes: ['1re Générale', 'Terminale Générale'], shared: true },
  { name: 'Mme Félicité', subjects: ['Enseignement scientifique'], classes: ['1re Générale', 'Terminale Générale'], shared: true },
];

/** Professeurs d'une matière dans une classe (deux pour un enseignement partagé, ex. enseignement scientifique). */
export const teachersOf = (subject, cls, list = ASSIGNMENTS) => list.filter((a) => a.subjects.includes(subject) && a.classes.includes(cls)).map((a) => a.name);
