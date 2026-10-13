// Notes, moyennes et validation du trimestre.
// Chaque évaluation a un type (DS, oral, exposé…), un barème (20 par défaut) et un
// coefficient (1 par défaut) choisis par l'enseignant. La moyenne d'un élève est
// ramenée sur 20 et pondérée par les coefficients ; ABS, DISP et NN ne comptent pas.

import { normalizeGrade, formatFr } from './gradeInput.js';

export const round2 = (n) => Math.round(n * 100) / 100;
export const fmtAvg = (n) => (n === null || n === undefined ? '—' : formatFr(round2(n)));

/** Lecture d'une case : valeur retenue ou statut (une saisie à confirmer n'est pas retenue). */
export function cellValue(raw, scale) {
  const r = normalizeGrade(raw, { max: scale });
  if (r.state === 'valid' && r.status === 'NOTE') return { value: r.value, counted: true };
  return { value: null, counted: false, pending: r.state === 'suggest' || r.state === 'error', status: r.status };
}

/** Moyenne /20 pondérée d'un élève dans une matière. */
export function studentAverage(evaluations, studentGrades = {}) {
  let sum = 0;
  let coefs = 0;
  for (const ev of evaluations) {
    const c = cellValue(studentGrades[ev.id] ?? '', ev.scale);
    if (!c.counted) continue;
    sum += (c.value / ev.scale) * 20 * ev.coef;
    coefs += ev.coef;
  }
  return coefs ? round2(sum / coefs) : null;
}

/** Nombre de notes effectivement retenues pour un élève. */
export const notesCount = (evaluations, studentGrades = {}) =>
  evaluations.filter((ev) => cellValue(studentGrades[ev.id] ?? '', ev.scale).counted).length;

/**
 * Le trimestre ne peut être validé qu'avec au moins `min` évaluations, toutes les
 * cases remplies (note, ABS, DISP ou NN) et aucune saisie en attente de correction.
 * Les élèves ayant moins de `min` notes retenues (ABS, DISP…) sont signalés au conseil.
 */
export function termValidation(evaluations, students, grades, min) {
  const pending = [];
  const empty = [];
  for (const s of students) {
    for (const ev of evaluations) {
      const raw = grades[s]?.[ev.id] ?? '';
      if (!String(raw).trim()) empty.push({ student: s, evaluation: ev.title });
      else if (cellValue(raw, ev.scale).pending) pending.push({ student: s, evaluation: ev.title });
    }
  }
  const missing = Math.max(0, min - evaluations.length);
  const below = missing || empty.length ? [] : students.filter((s) => notesCount(evaluations, grades[s]) < min);
  return { ok: missing === 0 && pending.length === 0 && empty.length === 0, missing, pending, empty, below };
}

/** Statistiques de classe sur une liste de moyennes. */
export function classStats(values) {
  const v = values.filter((x) => x !== null && x !== undefined);
  if (!v.length) return { avg: null, min: null, max: null };
  return { avg: round2(v.reduce((a, b) => a + b, 0) / v.length), min: Math.min(...v), max: Math.max(...v) };
}

/** Moyenne générale : matières incluses uniquement, pondérées par leur coefficient. */
export function generalAverage(subjectAverages) {
  let sum = 0;
  let coefs = 0;
  for (const s of subjectAverages) {
    if (!s.inAverage || s.avg === null || s.avg === undefined) continue;
    sum += s.avg * (s.coef ?? 1);
    coefs += s.coef ?? 1;
  }
  return coefs ? round2(sum / coefs) : null;
}

/** Suggestion de copie : même matière, même niveau, autre classe (ex. 1re Générale ↔ 1re STMG). */
export function copySuggestions(service, services, competencies) {
  const level = service.cls.split(' ')[0];
  return services.filter((o) => o.id !== service.id && o.subject === service.subject
    && o.cls.split(' ')[0] === level && (competencies[o.id]?.length ?? 0) > 0);
}

// Mentions et avertissements du conseil de classe (le conseil décide ; ceci n'est qu'une proposition)
export const COUNCIL_DECISIONS = [
  { id: '', label: '—' },
  { id: 'FELICITATIONS', label: 'Félicitations', tone: 'green' },
  { id: 'COMPLIMENTS', label: 'Compliments', tone: 'green' },
  { id: 'ENCOURAGEMENTS', label: 'Encouragements', tone: 'green' },
  { id: 'AVERT_TRAVAIL', label: 'Avertissement travail', tone: 'red' },
  { id: 'AVERT_COMPORTEMENT', label: 'Avertissement comportement', tone: 'red' },
  { id: 'AVERT_TRAVAIL_COMPORTEMENT', label: 'Avertissement travail et comportement', tone: 'red' },
];

/**
 * Proposition à partir de la moyenne générale et des avis des enseignants.
 * Un avertissement est proposé dès que `warnFrom` matières le signalent.
 */
export function councilProposal(avg, flagIds, { felicitations = 16, compliments = 14, warnFrom = 2 } = {}) {
  const count = (id) => flagIds.filter((f) => f === id).length;
  const work = count('AVERT_TRAVAIL') + count('MANQUE_TRAVAIL') >= warnFrom;
  const behaviour = count('AVERT_COMPORTEMENT') + count('BAVARD') >= warnFrom;
  if (work && behaviour) return 'AVERT_TRAVAIL_COMPORTEMENT';
  if (work) return 'AVERT_TRAVAIL';
  if (behaviour) return 'AVERT_COMPORTEMENT';
  if (avg === null) return '';
  if (avg >= felicitations) return 'FELICITATIONS';
  if (avg >= compliments) return 'COMPLIMENTS';
  if (count('ENCOURAGEMENTS') > 0 || count('EXEMPLAIRE') > 0) return 'ENCOURAGEMENTS';
  return '';
}
