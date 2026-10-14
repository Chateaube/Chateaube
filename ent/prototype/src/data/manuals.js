// Manuels scolaires de Tamatave (démonstration) : stock en réserve par état, prêts de l'année.
import { CLASSES } from './schoollife.js';

export const MANUALS = [
  { id: 'm1', title: 'Management 1re STMG', subject: 'Management', levels: ['1re STMG'], kind: 'ORIGINAL', binding: 'DOS_CARRE', stock: { NEUF: 2, BON: 3, USE: 1, DECHIRE: 1 } },
  { id: 'm2', title: 'Sciences de gestion et numérique 1re', subject: 'SGN', levels: ['1re STMG'], kind: 'PHOTOCOPIE', binding: 'RELIURE', stock: { NEUF: 6, BON: 0, USE: 0, DECHIRE: 0 } },
  { id: 'm3', title: 'Mathématiques 1re STMG', subject: 'Mathématiques', levels: ['1re STMG'], kind: 'ORIGINAL', binding: 'DOS_CARRE', stock: { NEUF: 0, BON: 4, USE: 2, DECHIRE: 0 } },
  { id: 'm4', title: 'Français 5e', subject: 'Français', levels: ['5e'], kind: 'ORIGINAL', binding: 'DOS_CARRE', stock: { NEUF: 3, BON: 4, USE: 2, DECHIRE: 1 } },
  { id: 'm5', title: 'Anglais 5e — cahier d\'activités', subject: 'Anglais', levels: ['5e'], kind: 'PHOTOCOPIE', binding: 'RELIURE', stock: { NEUF: 10, BON: 0, USE: 0, DECHIRE: 0 } },
  { id: 'm6', title: 'Philosophie Terminale', subject: 'Philosophie', levels: ['Terminale Générale', 'Terminale STMG'], kind: 'ORIGINAL', binding: 'DOS_CARRE', stock: { NEUF: 1, BON: 5, USE: 3, DECHIRE: 0 } },
];

// Prêts de la rentrée : manuels rendus en fin d'année (30 juin)
const YEAR_END = '2027-06-30';
let n = 0;
const lendAll = (manualId, cls, state) => CLASSES[cls].map((student) => ({ id: `l${++n}`, manualId, student, cls, stateOut: state, issuedOn: '2026-09-07', dueBack: YEAR_END }));
export const LOANS = [
  ...lendAll('m1', '1re STMG', 'BON'),
  ...lendAll('m3', '1re STMG', 'BON'),
  ...lendAll('m4', '5e', 'NEUF'),
  ...lendAll('m6', 'Terminale Générale', 'BON'),
].map((l) => {
  // démonstration : un manuel perdu à régler, un prêt ponctuel non rendu
  if (l.manualId === 'm1' && l.student === 'RAJAONARIVELO Tsiry') return { ...l, stateIn: 'PERDU', returnedOn: null, declaredOn: '2026-10-08', charge: 'A_REGLER' };
  if (l.manualId === 'm3' && l.student === 'RAHARISON Fanja') return { ...l, dueBack: '2026-10-09', note: 'Prêt ponctuel pour le DS' };
  return l;
});
