// Paramètres par défaut — site de Tamatave, année 2026-2027.
// Tout ce qui est ici est modifiable dans l'écran « Paramètres » (Direction),
// sans recoder. En production, ces valeurs vivent dans les tables
// dunning_policy, dunning_month, tuition_cutoff_rule et calendar_day_off.

import { COMPETENCY_HISTORY } from './competencyHistory.js';
import { mergeCompetencySets } from '../rules/grading.js';

export const DEFAULT_SETTINGS = {
  siteId: 'TMV',
  // Ambiance saisonnière (Octobre rose, Halloween, Noël…) : automatique selon les dates, désactivée, ou imposée
  ambiance: { mode: 'AUTO', animations: true, notes: {}, custom: [] }, // ambiances saisonnières (rules/ambiances.js)
  // Réseaux de l'école : liens affichés aux familles (laisser vide pour ne rien afficher)
  social: { facebook: '', instagram: '', instagramLabel: 'Association des élèves' },
  schoolYear: { start: '2026-09-01', end: '2027-07-04' },
  // Horaires de travail de l'équipe (pas de réponse aux familles en dehors) ; 3 = mercredi, 6 = samedi (fermé)
  // Établissement : ce qui figure sur les documents imprimés (conventions de stage, fiches d'orientation)
  school: {
    address: '27 Rue Nationale, 501 Toamasina, Madagascar',
    headName: '', // nom de la cheffe d'établissement, à saisir dans Paramètres › Établissement
    stageReferent: { civility: 'Mademoiselle', name: 'Sheena LO', role: 'Adjointe à la Direction', phone: '+261 34 51 227 78', mail: 'chateaubetamatave@gmail.com' },
    // semaines de stage de l'année (vides : à écrire à la main sur la convention)
    stageDates: { STAGE_3E: { from: '', to: '' }, STAGE_2DE: { from: '', to: '' }, TERRAIN_1STMG: { from: '', to: '' } },
  },
  workHours: { 1: ['07:00', '17:00'], 2: ['07:00', '17:00'], 3: ['07:00', '12:00'], 4: ['07:00', '17:00'], 5: ['07:00', '17:00'], 6: null },

  tuition: {
    dueDay: 5, // échéance le 5 de chaque mois
    plans: [
      { levels: '6e – 5e – 4e – 3e', first: 9, last: 6 },
      { levels: '2de', first: 9, last: 6 },
      { levels: '1re', first: 9, last: 5 }, // 9 mois : départ à Tana
      { levels: 'Terminale', first: 9, last: 5 },
    ],
  },

  dunning: {
    // Délais comptés depuis l'étape précédente : relance 10 jours après l'échéance,
    // avertissement 15 jours après la relance, mise à pied 10 jours après l'avertissement
    relanceAfter: 10,
    warningAfter: 15,
    suspensionAfter: 10,
    countFrom: 'ETAPE_PRECEDENTE', // ou 'ECHEANCE'
    // Dernier mois du plan (juin, ou mai pour 1re/Tle) : délais raccourcis
    lastMonth: { enabled: true, relanceAfter: 5, warningAfter: 5, suspensionAfter: 5 },
    countedWeekdays: [1, 2, 3, 4, 5], // 1 = lundi … 6 = samedi
    activeMonths: [9, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8], // octobre gelé
    suspensionRequiresDirection: true,
    channels: ['EMAIL', 'PUSH'], // pas de SMS : aucun budget prévu
    ackReminderHours: 48, // relance si « Je suis informé.e » n'est pas coché
  },

  grading: {
    minEvaluations: 4, // notes minimum par trimestre pour valider
    defaultScale: 20,
    defaultCoef: 1,
    evaluationTypes: ['DS', 'Interrogation', 'Oral', 'Exposé', 'Devoir maison', 'TP', 'Projet', 'Autre'],
    excludedSubjects: ['AP', 'MUS', 'VDC'], // Arts plastiques, Musique, Vie de classe : hors moyenne générale
    parentDelayDays: 1, // Espace Parents : note publiée aux parents 1 jour après les élèves
    allowTutoiement: false, // appréciations : tutoiement refusé par défaut (document officiel lu par la famille) ; la Direction peut l'autoriser
  },

  // Base de compétences PROPOSÉE aux enseignants, par matière et par niveau (série au lycée :
  // 1re G ≠ 1re STMG). Par défaut : les compétences écrites par les enseignants de Tamatave lors
  // des trois derniers trimestres (data/competencyHistory.js). Chaque enseignant la reprend ou non
  // et écrit ses propres compétences ; la Direction peut la modifier dans les Paramètres.
  competencies: {
    ...Object.fromEntries(Object.entries(COMPETENCY_HISTORY).map(([k, sets]) => [k, mergeCompetencySets(sets)])),
    'Management|Tle STMG': ['Analyser une situation de gestion', 'Mobiliser les notions', 'Argumenter', 'Communiquer'],
  },

  // Calendrier : jours fériés (Madagascar) et vacances (calendrier scolaire 2026-2027 de l'école)
  calendar: [
    { id: 'f1', kind: 'FERIE', label: 'Toussaint', start: '2026-11-01', end: '2026-11-01' },
    { id: 'f2', kind: 'FERIE', label: 'Noël', start: '2026-12-25', end: '2026-12-25' },
    { id: 'f3', kind: 'FERIE', label: 'Jour de l\'an', start: '2027-01-01', end: '2027-01-01' },
    { id: 'f4', kind: 'FERIE', label: 'Journée internationale des droits des femmes', start: '2027-03-08', end: '2027-03-08' },
    { id: 'f5', kind: 'FERIE', label: 'Martyrs de 1947 / Lundi de Pâques', start: '2027-03-29', end: '2027-03-29' },
    { id: 'f6', kind: 'FERIE', label: 'Fête du Travail', start: '2027-05-01', end: '2027-05-01' },
    { id: 'f7', kind: 'FERIE', label: 'Ascension', start: '2027-05-06', end: '2027-05-06' },
    { id: 'f8', kind: 'FERIE', label: 'Lundi de Pentecôte', start: '2027-05-17', end: '2027-05-17' },
    { id: 'f9', kind: 'FERIE', label: 'Fête de l\'Indépendance', start: '2027-06-26', end: '2027-06-26' },
    { id: 'v1', kind: 'VACANCES', label: 'Vacances de printemps', start: '2026-10-19', end: '2026-10-31' },
    { id: 'v2', kind: 'VACANCES', label: 'Vacances de fin d\'année', start: '2026-12-21', end: '2027-01-02' },
    { id: 'v3', kind: 'VACANCES', label: 'Vacances saison des pluies', start: '2027-02-15', end: '2027-02-27' },
    { id: 'v4', kind: 'VACANCES', label: 'Vacances automne tropical', start: '2027-04-12', end: '2027-04-24' },
  ],
};
