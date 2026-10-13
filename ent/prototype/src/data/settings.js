// Paramètres par défaut — site de Tamatave, année 2026-2027.
// Tout ce qui est ici est modifiable dans l'écran « Paramètres » (Direction),
// sans recoder. En production, ces valeurs vivent dans les tables
// dunning_policy, dunning_month, tuition_cutoff_rule et calendar_day_off.

export const DEFAULT_SETTINGS = {
  siteId: 'TMV',
  schoolYear: { start: '2026-09-01', end: '2027-07-04' },

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
    relanceAfter: 5,
    warningAfter: 10,
    suspensionAfter: 25,
    countFrom: 'ECHEANCE', // ou 'ETAPE_PRECEDENTE'
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
  },

  // Base de compétences PROPOSÉE aux enseignants, par matière et par niveau (commune aux classes
  // d'un même niveau). Chaque enseignant la reprend ou non et écrit ses propres compétences.
  competencies: {
    'Management|1re': ['Analyser une situation d\'organisation', 'Mobiliser les notions du programme', 'Argumenter une décision', 'Communiquer à l\'écrit et à l\'oral'],
    'Management|Terminale': ['Analyser une situation de gestion', 'Mobiliser les notions', 'Argumenter', 'Communiquer'],
    'Enseignement moral et civique|1re': ['Construire une culture civique', 'Argumenter et débattre', 'S\'engager dans un projet collectif'],
    'Mathématiques|5e': ['Chercher', 'Modéliser', 'Représenter', 'Raisonner', 'Calculer', 'Communiquer'],
  },

  // Calendrier : jours fériés (Madagascar) et vacances (exemple à remplacer)
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
    { id: 'v1', kind: 'VACANCES', label: 'Vacances de la Toussaint (exemple)', start: '2026-10-24', end: '2026-11-01' },
    { id: 'v2', kind: 'VACANCES', label: 'Vacances de Noël (exemple)', start: '2026-12-19', end: '2027-01-03' },
    { id: 'v3', kind: 'VACANCES', label: 'Vacances de février (exemple)', start: '2027-02-13', end: '2027-02-21' },
    { id: 'v4', kind: 'VACANCES', label: 'Vacances de printemps (exemple)', start: '2027-04-10', end: '2027-04-25' },
  ],
};
