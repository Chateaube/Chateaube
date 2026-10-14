// Données de démonstration — Terminale Générale (noms d'élèves FICTIFS), 1er trimestre.
// Professeurs : liste officielle des enseignements. Chaque élève suit 2 spécialités sur 3.

export const TLE_G_SUBJECTS = [
  { id: 'PHILO', label: 'Philosophie', teacher: 'M. Raymond', comp: 'Philosophie' },
  { id: 'ANG', label: 'Anglais', teacher: 'Mme Pasimiry', comp: 'Anglais' },
  { id: 'ESP', label: 'Espagnol', teacher: 'Mme Henriette', comp: 'Espagnol' },
  { id: 'SPE_MATHS', label: 'Spécialité Mathématiques', teacher: 'M. Hassanaly', comp: 'Spécialité Mathématiques', specialty: 'MATHS' },
  { id: 'SPE_PC', label: 'Spécialité Physique-Chimie', teacher: 'M. Canusis', comp: 'Spécialité Physique-chimie', specialty: 'PC' },
  { id: 'SPE_SVT', label: 'Spécialité Sciences de la vie et de la Terre', teacher: 'Mme Félicité', comp: 'Spécialité SVT', specialty: 'SVT' },
  { id: 'ES', label: 'Enseignement scientifique', teacher: 'Mme Félicité', comp: 'Enseignement scientifique' },
  { id: 'HG', label: 'Histoire - Géographie', teacher: 'Mme Felana', comp: 'Histoire-géographie' },
  { id: 'EMC', label: 'Éducation morale et civique', teacher: 'Mme Felana', comp: 'Enseignement moral et civique' },
  { id: 'EPS', label: 'Éducation physique et sportive', teacher: 'Mme Doris', comp: 'EPS' },
];

const base = [
  ['RANDRIA', 'Mamy', 'M', '2008-09-21', ['MATHS', 'PC'], 14.2, 2, 1],
  ['RAKOTOVAO', 'Andry', 'M', '2009-02-11', ['MATHS', 'SVT'], 11.6, 4, 3],
  ['RAZAFINDRATSIMA', 'Volana', 'F', '2008-12-28', ['PC', 'SVT'], 13.1, 0, 0],
  ['ANDRIAMASY', 'Lova', 'F', '2009-05-03', ['MATHS', 'PC'], 9.4, 6, 2],
  ['RAHARIJAONA', 'Tsiry', 'M', '2008-07-17', ['SVT', 'MATHS'], 12.4, 1, 4],
  ['RABEMANANTSOA', 'Fitia', 'F', '2009-01-30', ['PC', 'SVT'], 15.3, 0, 1],
];
let seed = 11;
const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
export const TLE_G_STUDENTS = base.map(([lastName, firstName, sex, birthDate, specialties, level, abs, late]) => ({
  name: `${lastName} ${firstName}`, lastName, firstName, sex, birthDate, specialties, abs, late,
  justified: Math.ceil(abs / 2), unjustified: abs - Math.ceil(abs / 2),
  avgs: Object.fromEntries(TLE_G_SUBJECTS.filter((s) => !s.specialty || specialties.includes(s.specialty))
    .map((s) => [s.id, Math.round(Math.min(19.5, Math.max(5, level + rnd() * 5 - 2.5)) * 100) / 100])),
}));
