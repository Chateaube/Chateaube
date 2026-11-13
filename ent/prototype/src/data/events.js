// Calendrier des événements de l'école (démonstration, Tamatave). Les vacances et les jours fériés
// viennent des Paramètres (calendrier scolaire). agenda : ECOLE (tous), EXAMENS (classes d'examen et
// professeurs), EQUIPE (personnel seulement).
import { liveArray, demoOr, storedArray, realData } from '../demoData.js';
import { readStored, writeStored } from '../persist.js';
const EXAM = ['3e', '1re STMG', '1re Générale', 'Terminale STMG', 'Terminale Générale'];
const DEMO_SCHOOL_EVENTS = [
  { id: 'e1', agenda: 'ECOLE', date: '2026-10-14', start: '16:00', end: '17:30', title: 'Réunion parents-professeurs — Terminales', place: 'Salle polyvalente', classes: ['Terminale STMG', 'Terminale Générale'] },
  { id: 'e2', agenda: 'EQUIPE', date: '2026-10-16', start: '15:30', end: '16:30', title: 'Conseil pédagogique', place: 'Salle des professeurs', classes: [] },
  { id: 'e3', agenda: 'EXAMENS', date: '2026-10-21', start: '07:30', end: '11:30', title: 'Bac blanc de français — épreuve écrite', place: 'Salles 10 à 12', classes: ['1re STMG', '1re Générale'] },
  { id: 'e4', agenda: 'ECOLE', date: '2026-10-22', start: '08:00', end: '12:00', title: 'Sortie au port de Tamatave', place: 'Port', classes: ['1re STMG'] },
  { id: 'e6', agenda: 'EQUIPE', date: '2026-11-07', start: '08:00', end: '12:00', title: 'Journée portes ouvertes (préparation et accueil)', place: 'Établissement', classes: [] },
  { id: 'e8', agenda: 'EQUIPE', date: '2026-11-27', allDay: true, title: 'Arrêt des notes du 1er trimestre', classes: [] },
  { id: 'e7', agenda: 'EQUIPE', date: '2026-12-10', start: '15:30', end: '18:00', title: 'Conseil de classe — 1re STMG', place: 'Salle des professeurs', classes: ['1re STMG'] },
  { id: 'e9', agenda: 'EXAMENS', date: '2027-01-12', allDay: true, end: '2027-01-14', title: 'Brevet blanc', classes: ['3e'] },
  { id: 'e10', agenda: 'EXAMENS', date: '2027-01-20', allDay: true, end: '2027-03-11', title: 'Parcoursup : saisie des vœux', classes: ['Terminale STMG', 'Terminale Générale'] },
  { id: 'e11', agenda: 'EXAMENS', date: '2027-02-08', allDay: true, end: '2027-02-12', title: 'Bac blanc — Terminales', classes: ['Terminale STMG', 'Terminale Générale'] },
  { id: 'e12', agenda: 'EQUIPE', date: '2027-03-05', allDay: true, title: 'Arrêt des notes du 2e trimestre', classes: [] },
  { id: 'e13', agenda: 'EXAMENS', date: '2027-06-01', allDay: true, title: 'Réunion d\'information examens (dates officielles à confirmer)', classes: EXAM },
];

export const SCHOOL_EVENTS = storedArray('ent-s-evenements', () => demoOr(DEMO_SCHOOL_EVENTS, [])); // vide dès que les vraies données sont importées

// Calendrier Parcoursup 2027 (dates annoncées pour la session 2027 ; à vérifier sur parcoursup.gouv.fr) :
// ajouté une fois à l'agenda de l'école pour les deux Terminales ; la Direction peut ensuite le modifier.
const TLE = ['Terminale STMG', 'Terminale Générale'];
export const PARCOURSUP_2027 = [
  { id: 'ps27-1', agenda: 'EXAMENS', date: '2026-12-17', allDay: true, title: 'Parcoursup : ouverture du site d\'information et de la carte des formations', classes: TLE },
  { id: 'ps27-2', agenda: 'EXAMENS', date: '2027-01-18', end: '2027-03-11', allDay: true, title: 'Parcoursup : inscription et saisie des vœux (jusqu\'au 11 mars, 23 h 59)', classes: TLE },
  { id: 'ps27-3', agenda: 'EXAMENS', date: '2027-04-01', allDay: true, title: 'Parcoursup : date limite pour compléter le dossier et confirmer les vœux', classes: TLE },
  { id: 'ps27-4', agenda: 'EXAMENS', date: '2027-06-01', allDay: true, title: 'Parcoursup : début de la phase d\'admission (premières réponses)', classes: TLE },
  { id: 'ps27-5', agenda: 'EXAMENS', date: '2027-06-10', end: '2027-09-09', allDay: true, title: 'Parcoursup : phase complémentaire', classes: TLE },
  { id: 'ps27-6', agenda: 'EXAMENS', date: '2027-07-10', allDay: true, title: 'Parcoursup : fin de la phase principale d\'admission', classes: TLE },
];
const SEEDED = 'ent-k-parcoursup-2027-ajoute';
/** Ajoute une fois le calendrier Parcoursup aux événements de l'école (vraies données, Direction). */
export function seedParcoursup() {
  if (!realData() || readStored(SEEDED)) return false;
  const own = readStored('ent-s-evenements') ?? [...SCHOOL_EVENTS];
  writeStored('ent-s-evenements', [...own, ...PARCOURSUP_2027.filter((e) => !own.some((o) => o.id === e.id))]);
  writeStored(SEEDED, true);
  return true;
}
