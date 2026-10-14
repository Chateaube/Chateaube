// Données de démonstration — notes, compétences et conseil de classe (FICTIVES).
import { CLASS_LIST } from './people.js';
import { COMPETENCY_HISTORY } from './competencyHistory.js';

export const TERM = { id: 'T1', label: '1er trimestre', council: 'jeudi 10 décembre 2026' };

const TLE_STMG = ['ANDRIANARIVO Tojo', 'RABEMANANJARA Lina', 'RAKOTONDRABE Fanilo', 'RAMANANTSOA Nathan', 'RANDRIANASOLO Ony', 'RAZANAMPARANY Sarobidy'];
const PREMIERE_G = ['ANDRIAMANANTENA Ravo', 'RABARY Tiavina', 'RAHERIMALALA Anja', 'RAKOTOMANGA Hasina', 'RALAMBO Mendrika', 'RATSIMBA Kevin', 'RAZAFINDRAKOTO Ny Aina'];

// Services de Mme RANAIVO : une ligne par couple classe × matière
export const SERVICES = [
  { id: 's1', cls: '1re STMG', subject: 'Management', students: CLASS_LIST },
  { id: 's2', cls: 'Terminale STMG', subject: 'Management', students: TLE_STMG },
  { id: 's3', cls: '1re STMG', subject: 'Enseignement moral et civique', students: CLASS_LIST },
  { id: 's4', cls: '1re Générale', subject: 'Enseignement moral et civique', students: PREMIERE_G },
];

export const EVALUATIONS = {
  // publishOn : date de publication aux élèves (parents : +1 jour) ; normalize : ramener sur 20
  s1: [
    { id: 'v1', type: 'DS', title: 'DS n°1 — L\'organisation', date: '2026-09-24', publishOn: '2026-09-28', scale: 20, coef: 2, normalize: true,
      themes: ['Les organisations', 'Finalités'], comment: 'Bon niveau d\'ensemble ; revoir la définition de la performance sociale.',
      competencies: ['Analyser une situation d\'organisation', 'Mobiliser les notions du programme'] },
    { id: 'v2', type: 'Interrogation', title: 'Interro — vocabulaire', date: '2026-10-01', publishOn: '2026-10-01', scale: 10, coef: 1, normalize: true, themes: ['Vocabulaire'] },
    { id: 'v3', type: 'Oral', title: 'Oral — étude de cas', date: '2026-10-06', publishOn: '2026-10-07', scale: 20, coef: 1, normalize: true, remarksEnabled: true,
      themes: ['Étude de cas'], competencies: ['Argumenter une décision', 'Communiquer à l\'écrit et à l\'oral'] },
    { id: 'v4', type: 'Exposé', title: 'Exposé en groupe', date: '2026-10-08', publishOn: '2026-10-13', scale: 20, coef: 1, normalize: true, themes: ['Coopératives'] },
  ],
  s2: [
    { id: 'w1', type: 'DS', title: 'DS n°1', date: '2026-09-29', scale: 20, coef: 2 },
    { id: 'w2', type: 'Oral', title: 'Oral', date: '2026-10-05', scale: 20, coef: 1 },
    { id: 'w3', type: 'Devoir maison', title: 'DM n°1', date: '2026-10-09', scale: 20, coef: 1 },
  ],
  s3: [
    { id: 'x1', type: 'Exposé', title: 'Exposé — laïcité', date: '2026-10-02', scale: 20, coef: 1 },
    { id: 'x2', type: 'Interrogation', title: 'Interro', date: '2026-10-09', scale: 20, coef: 1 },
  ],
  s4: [],
};

// Saisies brutes (certaines contiennent des erreurs de frappe à corriger : « 1O », « 12.5 »)
export const GRADES = {
  s1: {
    'ANDRIAMBOLOLONA Mialy': { v1: '14', v2: '7.5', v3: '15', v4: '16' },
    'RAHARISON Fanja': { v1: '11', v2: '6', v3: '1O', v4: '13' },
    'RAJAONARIVELO Tsiry': { v1: '9', v2: 'ABS', v3: '10', v4: '12' },
    'RAKOTOARISOA Aina': { v1: '16', v2: '9', v3: '17', v4: '16' },
    'RANDRIAMAMPIANINA Hery': { v1: '7.5', v2: '4', v3: '9', v4: '11' },
    'RAZAFY Kanto': { v1: '12', v2: '7', v3: '13', v4: '14' },
    'RAVELOJAONA Sitraka': { v1: '13', v2: '8', v3: '12', v4: '15' },
    'RAMAROSON Fitia': { v1: '10', v2: '5.5', v3: 'ABS', v4: '12' },
  },
  s2: Object.fromEntries(TLE_STMG.map((n, i) => [n, { w1: String(9 + i), w2: String(11 + (i % 3)), w3: String(12 + (i % 4)) }])),
  s3: Object.fromEntries(CLASS_LIST.map((n, i) => [n, { x1: String(11 + (i % 6)), x2: String(10 + (i % 5)) }])),
  s4: {},
};

// Remarques par note (évaluations où l'enseignant a activé les remarques), visibles par l'élève et ses parents
export const REMARKS = {
  s1: {
    'RAKOTOARISOA Aina': { v3: 'Argumentation claire et bien structurée.' },
    'RAHARISON Fanja': { v3: 'Bonne analyse ; parler plus fort et regarder l\'auditoire.' },
    'RANDRIAMAMPIANINA Hery': { v3: 'Oral trop court : s\'appuyer davantage sur le document.' },
  },
};

// Niveau d'une classe pour la BASE proposée : commun aux classes d'un même niveau au collège,
// distinct par série au lycée (« 1re STMG » → « 1re STMG », « 1re Générale » → « 1re G »).
export function levelOf(cls) {
  const [head, ...rest] = cls.split(' ');
  const serie = rest.join(' ');
  if (/^(6e|5e|4e|3e)$/.test(head)) return head;
  if (/^2/.test(head)) return '2de';
  const lvl = head.startsWith('1') ? '1re' : 'Tle';
  return `${lvl} ${/^g/i.test(serie) ? 'G' : serie}`;
}
export const historyFor = (service) => COMPETENCY_HISTORY[`${service.subject}|${levelOf(service.cls)}`] ?? [];
export const competenciesFor = (service, settings) => settings.competencies?.[`${service.subject}|${levelOf(service.cls)}`] ?? [];

// Compétences retenues par l'enseignant pour chaque classe × matière :
// reprises de la base proposée et/ou écrites par lui-même
export const TEACHER_COMPETENCIES = {
  s1: ['Analyser une situation d\'organisation', 'Mobiliser les notions du programme', 'Argumenter une décision', 'Communiquer à l\'écrit et à l\'oral'],
  s2: ['Analyser une situation de gestion', 'Argumenter', 'Construire un raisonnement chiffré'],
  s3: ['Construire une culture civique', 'Argumenter et débattre', 'Analyser un fait d\'actualité'],
  s4: [], // vide : la base de l'établissement est proposée
  s5: [],
};

// Avis pour le conseil (non imprimés sur le bulletin) — liste paramétrable
export const COUNCIL_FLAGS = [
  { id: 'EXEMPLAIRE', label: 'Élève exemplaire', tone: 'green' },
  { id: 'ENCOURAGEMENTS', label: 'Encouragements', tone: 'green' },
  { id: 'BAVARD', label: 'Élève bavard.e', tone: 'amber' },
  { id: 'MANQUE_TRAVAIL', label: 'Manque de travail personnel', tone: 'amber' },
  { id: 'AVERT_TRAVAIL', label: 'Avertissement travail', tone: 'red' },
  { id: 'AVERT_COMPORTEMENT', label: 'Avertissement comportement', tone: 'red' },
];

// --- Conseil de classe : 1re STMG -----------------------------------------------
// inAverage : faux pour Arts plastiques, Musique et Vie de classe (hors moyenne générale)
export const CLASS_SUBJECTS = [
  { id: 'FR', label: 'Français', teacher: 'M. Rabe', inAverage: true, coef: 1 },
  { id: 'MATHS', label: 'Mathématiques', teacher: 'M. Tojo', inAverage: true, coef: 1 },
  { id: 'HG', label: 'Histoire-Géographie', teacher: 'M. Rasolo', inAverage: true, coef: 1 },
  { id: 'LVA', label: 'Anglais', teacher: 'Mme Hery', inAverage: true, coef: 1 },
  { id: 'LVB', label: 'Espagnol', teacher: 'Mme Lova', inAverage: true, coef: 1 },
  { id: 'EPS', label: 'EPS', teacher: 'M. Rado', inAverage: true, coef: 1 },
  { id: 'EMC', label: 'EMC', teacher: 'Mme Ranaivo', inAverage: true, coef: 1, service: 's3' },
  { id: 'MGT', label: 'Management', teacher: 'Mme Ranaivo', inAverage: true, coef: 1, service: 's1' },
  { id: 'SGN', label: 'Sc. de gestion et numérique', teacher: 'M. Andry', inAverage: true, coef: 1 },
  { id: 'DROIT', label: 'Droit', teacher: 'Mme Holy', inAverage: true, coef: 1 },
  { id: 'ECO', label: 'Économie', teacher: 'Mme Karele', inAverage: true, coef: 1 },
  { id: 'AP', label: 'Arts plastiques', teacher: 'Mme Haja', inAverage: false, coef: 1 },
  { id: 'MUS', label: 'Musique', teacher: 'M. Faly', inAverage: false, coef: 1 },
  { id: 'VDC', label: 'Vie de classe', teacher: 'Mme Ranaivo', inAverage: false, coef: 1 },
];

// Niveau de base de chaque élève (sert à générer des moyennes réalistes et stables)
const BASE = {
  'ANDRIAMBOLOLONA Mialy': 13.5, 'RAHARISON Fanja': 11.2, 'RAJAONARIVELO Tsiry': 9.4, 'RAKOTOARISOA Aina': 15.6,
  'RANDRIAMAMPIANINA Hery': 8.6, 'RAZAFY Kanto': 12.3, 'RAVELOJAONA Sitraka': 13.1, 'RAMAROSON Fitia': 10.4,
};
let seed = 7;
const rand = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
export const OTHER_AVERAGES = Object.fromEntries(CLASS_LIST.map((n) => [n, Object.fromEntries(
  CLASS_SUBJECTS.filter((s) => !s.service).map((s) => [s.id, Math.round(Math.min(19.5, Math.max(4, BASE[n] + (rand() * 6 - 3) + (s.inAverage ? 0 : 2))) * 10) / 10]),
)]));

// Avis déjà posés par les enseignants des autres matières
export const OTHER_FLAGS = {
  'RAJAONARIVELO Tsiry': [{ subject: 'Anglais', flag: 'BAVARD' }, { subject: 'Espagnol', flag: 'BAVARD' }, { subject: 'Mathématiques', flag: 'MANQUE_TRAVAIL' }],
  'RAKOTOARISOA Aina': [{ subject: 'Français', flag: 'EXEMPLAIRE' }, { subject: 'Mathématiques', flag: 'EXEMPLAIRE' }],
  'RANDRIAMAMPIANINA Hery': [{ subject: 'Histoire-Géographie', flag: 'AVERT_TRAVAIL' }, { subject: 'Français', flag: 'MANQUE_TRAVAIL' }],
  'RAVELOJAONA Sitraka': [{ subject: 'EPS', flag: 'ENCOURAGEMENTS' }],
};

export const ABSENCES = {
  'RAJAONARIVELO Tsiry': { abs: 6, late: 4 }, 'RAMAROSON Fitia': { abs: 3, late: 0 }, 'RANDRIAMAMPIANINA Hery': { abs: 2, late: 5 },
};

// Parcours d'ouverture : évalué uniquement par une appréciation (pas de note)
SERVICES.push({ id: 's5', cls: '1re STMG', subject: 'Parcours d\'ouverture — Orientation', mode: 'APPRECIATION_SEULE', strand: 'ORIENTATION', students: CLASS_LIST });
EVALUATIONS.s5 = [];
GRADES.s5 = {};
