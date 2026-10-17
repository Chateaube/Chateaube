// Emploi du temps hebdomadaire des professeurs (démonstration, Tamatave) : base du volume horaire.
// En production, il vient de l'import de l'emploi du temps (Excel / logiciel actuel).
const T = (id, teacherId, cls, subject, weekday, start, end) => ({ id, teacherId, cls, subject, weekday, start, end });
export const TIMETABLE = [
  T('t1', 'p1', '1re STMG', 'Management', 1, '07:00', '09:00'), T('t2', 'p1', 'Terminale STMG', 'Management', 1, '09:45', '11:45'),
  T('t3', 'p1', '1re STMG', 'Management', 2, '07:00', '09:00'), T('t4', 'p1', 'Terminale STMG', 'Management', 2, '10:00', '12:00'),
  T('t5', 'p1', '1re STMG', 'SGN', 2, '13:30', '15:30'), T('t6', 'p1', 'Terminale STMG', 'Droit', 4, '13:30', '15:30'),
  T('t7', 'p2', '1re STMG', 'Histoire-Géographie', 1, '13:30', '15:30'), T('t8', 'p2', 'Terminale Générale', 'Histoire-Géographie', 3, '07:00', '09:00'),
  T('t9', 'p2', 'Terminale STMG', 'Histoire-Géographie', 4, '07:00', '09:00'),
  T('t10', 'p4', '1re STMG', 'Anglais', 1, '09:45', '11:45'), T('t11', 'p4', 'Terminale Générale', 'Anglais', 2, '07:00', '09:00'),
  T('t12', 'p4', 'Terminale STMG', 'Anglais', 5, '07:00', '09:00'),
  T('t13', 'p5', '1re STMG', 'Mathématiques', 3, '09:45', '11:45'), T('t14', 'p5', 'Terminale Générale', 'Spécialité Mathématiques', 4, '09:45', '12:45'),
  T('t15', 'p5', 'Terminale STMG', 'Mathématiques', 5, '09:45', '11:45'),
  T('t16', 'p3', 'Terminale Générale', 'Spécialité Physique-Chimie', 2, '13:30', '16:30'), T('t17', 'p3', 'Terminale Générale', 'Spécialité SVT', 3, '13:30', '16:30'),
];

// Absences déclarées des professeurs, avec le travail laissé pour la séance surveillée
export const TEACHER_ABSENCES = [
  { id: 'a1', teacherId: 'p2', date: '2026-10-08', slotIds: ['t9'], reason: 'Rendez-vous médical', work: 'DEVOIR', workText: 'Exercices 3 à 6 p. 112 (la décolonisation), à rendre à la fin de l\'heure.', declaredBy: 'RASOLO Jean', declaredAt: '2026-10-07' },
  { id: 'a2', teacherId: 'p4', date: '2026-10-12', slotIds: ['t10'], reason: 'Absence imprévue', work: 'AUCUN', workText: '', declaredBy: 'Secrétariat', declaredAt: '2026-10-12' },
  { id: 'a3', teacherId: 'p5', date: '2026-10-14', slotIds: ['t13'], reason: 'Formation', work: 'ACTIVITE', workText: 'Fiche d\'activité « suites géométriques » (photo jointe au secrétariat).', declaredBy: 'TOJO Andry', declaredAt: '2026-10-13' },
];

// Pointage des retards des professeurs (minutes) et heures rattrapées
export const TEACHER_LATENESS = [
  { id: 'l1', teacherId: 'p4', date: '2026-09-21', minutes: 10, by: 'CPE' }, { id: 'l2', teacherId: 'p4', date: '2026-09-28', minutes: 15, by: 'CPE' },
  { id: 'l3', teacherId: 'p4', date: '2026-10-05', minutes: 20, by: 'CPE' }, { id: 'l4', teacherId: 'p4', date: '2026-10-12', minutes: 25, by: 'Secrétariat' },
  { id: 'l5', teacherId: 'p2', date: '2026-10-01', minutes: 5, by: 'CPE' }, { id: 'l6', teacherId: 'p2', date: '2026-10-08', minutes: 10, by: 'CPE' },
  { id: 'l7', teacherId: 'p5', date: '2026-09-16', minutes: 30, by: 'CPE' }, { id: 'l8', teacherId: 'p5', date: '2026-09-30', minutes: 35, by: 'CPE' },
];
export const TEACHER_MAKEUPS = [
  { id: 'm1', teacherId: 'p5', date: '2026-10-10', hours: 1, note: 'Heure rattrapée samedi matin avec la Terminale STMG' },
];
