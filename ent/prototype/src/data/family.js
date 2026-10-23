// Données de démonstration — portails parent et élève (Famille RAKOTOARISOA, FICTIVE).
import { SERVICES, EVALUATIONS, GRADES, REMARKS } from './grades.js';

// Notes des autres matières (les notes de Management et d'EMC viennent du carnet de notes de l'enseignante)
const ev = (id, subject, date, type, title, value, avg, max, min, coef = 1, scale = 20) => ({ id, subject, date, type, title, value, avg, max, min, coef, scale, status: value === null ? 'ABSENT' : 'NOTE' });
export const OTHER_NOTES = {
  aina: [
    ev('f1', 'Français', '2026-09-29', 'DS', 'Commentaire de texte', 13, 12.46, 16, 8),
    ev('f2', 'Français', '2026-10-09', 'Oral', 'Lecture expressive', 15, 13.1, 17, 9),
    ev('m1', 'Mathématiques', '2026-10-02', 'DS', 'DS n°1 — Statistiques', 14.5, 11.1, 17.5, 6, 2),
    ev('m2', 'Mathématiques', '2026-10-09', 'Interrogation', 'Suites', 8, 6.4, 10, 3, 1, 10),
    ev('a1', 'Anglais', '2026-09-25', 'Oral', 'Présentation', 15, 13.2, 18, 9),
    ev('h1', 'Histoire-Géographie', '2026-10-07', 'DS', 'La Révolution industrielle', 12, 11.4, 15, 7),
  ],
  toky: [
    ev('t1', 'Mathématiques', '2026-10-07', 'Interrogation', 'Fractions', 12, 11.8, 18, 5),
    ev('t2', 'SVT', '2026-10-01', 'TP', 'Observation au microscope', 15, 13, 17, 9),
    ev('t3', 'Français', '2026-10-05', 'DS', 'Dictée et questions', 9, 12.46, 16, 8),
  ],
};
// Services du carnet de notes à afficher pour chaque enfant
export const GRADEBOOK_SUBJECTS = { aina: ['s1', 's3'], toky: [] };
export { SERVICES, EVALUATIONS, GRADES, REMARKS };

// Autorisations à signer par la famille (une réponse par enfant)
export const AUTHORIZATIONS = [
  { id: 'IMAGE', label: 'Droit à l\'image', detail: 'Photos et vidéos des activités scolaires (site, réseaux de l\'établissement, journal).', options: ['J\'autorise', 'Je n\'autorise pas'] },
  { id: 'SORTIE', label: 'Autorisation de sortie', detail: 'Sortie de l\'établissement en l\'absence d\'un professeur ou en fin de cours.', options: ['Sortie libre aux heures sans cours', 'Sortie en fin de journée uniquement', 'Aucune sortie sans un responsable'] },
  { id: 'SORTIES_PEDA', label: 'Sorties pédagogiques', detail: 'Déplacements accompagnés dans Tamatave (piscine, visites, musées).', options: ['J\'autorise', 'Je n\'autorise pas'] },
];
export const AUTH_ANSWERS = {
  aina: { IMAGE: { answer: 'J\'autorise', at: '2026-09-02' }, SORTIE: { answer: 'Sortie en fin de journée uniquement', at: '2026-09-02' } },
  toky: { IMAGE: { answer: 'J\'autorise', at: '2026-09-02' } },
};

// Documents reçus de l'établissement (accusé de lecture)
export const DOCUMENTS = [
  { id: 'd1', date: '2026-10-12', title: 'Calendrier des conseils de classe du 1er trimestre', from: 'Direction', read: false },
  { id: 'd2', date: '2026-10-06', title: 'Circulaire : reprise des séances de natation (6e – 5e)', from: 'Vie scolaire', read: true },
  { id: 'd3', date: '2026-09-01', title: 'Règlement intérieur 2026-2027', from: 'Direction', read: true, signed: true },
  { id: 'd4', date: '2026-09-01', title: 'Calendrier scolaire 2026-2027', from: 'Direction', read: true },
];
// Pièces demandées à la famille
export const REQUESTED = [
  { id: 'r1', child: 'aina', title: 'Photo d\'identité — dossier Pré-Bac', due: '2026-10-30', received: false },
  { id: 'r2', child: 'aina', title: 'Copie du passeport — dossier Pré-Bac', due: '2026-10-30', received: true },
  { id: 'r3', child: 'toky', title: 'Certificat médical d\'aptitude à la natation', due: '2026-10-16', received: false },
];

// Stages : 3e (observation, 1 semaine) et 2de (2 semaines)
export const STAGE_TYPES = [
  { id: 'STAGE_3E', level: '3e', label: 'Stage d\'observation de 3e', duration: '1 semaine', schoolDays: 5 },
  { id: 'STAGE_2DE', level: '2de', label: 'Stage de seconde', duration: '2 semaines', schoolDays: 10 },
  { id: 'TERRAIN_1STMG', level: '1re STMG', label: 'Étude de terrain (étude de gestion)', duration: 'visites et entretiens en organisation', schoolDays: 2 },
];
export const INTERNSHIPS = {
  // Aina a fait son stage de seconde l'an dernier (historique conservé)
  aina: [{
    title: 'Stage de seconde (2025-2026)', company: 'Hôtel Le Neptune — service accueil', tutor: 'Mme Rasoarimalala, responsable de l\'accueil',
    from: '2026-06-08', to: '2026-06-19', referent: 'M. Rasolo', done: true,
    signatures: { entreprise: true, etablissement: true, famille: true }, report: 'Rapport de stage remis le 26 juin 2026.',
  }],
  toky: [],
};

// Orientation
export const ORIENTATION = {
  aina: {
    stage: '1re STMG → Terminale STMG mercatique',
    steps: [
      { when: 'Cette année', label: 'Passage en Terminale STMG : à l\'école, la spécialité est la mercatique (marketing) ; pas de choix à faire', state: 'now' },
      { when: '3e trimestre', label: 'Avis du conseil de classe sur le passage en Terminale', state: 'next' },
      { when: 'Terminale', label: 'Une piste par pays visé ; Parcoursup (France) conseillé en plan B, puis Campus France et visa pour un élève qui n\'est pas de nationalité française', state: 'next' },
    ],
    choices: [],
    meeting: 'Rendez-vous possible avec la Direction le jeudi de 15h30 à 17h.',
  },
  toky: {
    stage: '5e',
    steps: [{ when: 'Cette année', label: 'Pas d\'étape d\'orientation : découverte des métiers à partir de la 4e', state: 'now' }],
    choices: [],
    meeting: null,
  },
};
