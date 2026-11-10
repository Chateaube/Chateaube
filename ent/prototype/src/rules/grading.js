// Notes, moyennes et validation du trimestre.
// Chaque évaluation a un type (DS, oral, exposé…), un barème (20 par défaut) et un
// coefficient (1 par défaut) choisis par l'enseignant. La moyenne d'un élève est
// ramenée sur 20 et pondérée par les coefficients ; ABS, DISP et NN ne comptent pas.

import { normalizeGrade, formatFr } from './gradeInput.js';
import { addDays } from './calendar.js';

export const round2 = (n) => Math.round(n * 100) / 100;
export const fmtAvg = (n) => (n === null || n === undefined ? '—' : formatFr(round2(n)));

/** Lecture d'une case : valeur retenue ou statut (une saisie à confirmer n'est pas retenue). */
export function cellValue(raw, scale) {
  const r = normalizeGrade(raw, { max: scale });
  if (r.state === 'valid' && r.status === 'NOTE') return { value: r.value, counted: true };
  return { value: null, counted: false, pending: r.state === 'suggest' || r.state === 'error', status: r.status };
}

/**
 * Moyenne /20 d'un élève dans une matière, pondérée par les coefficients.
 * « Ramener sur 20 » (par défaut) : la note compte sur 20 (8/10 → 16/20).
 * Sinon elle compte en points dans son barème : 8/10 et 14/20 font 22/30, soit 14,67/20.
 */
export function studentAverage(evaluations, studentGrades = {}) {
  let points = 0;
  let max = 0;
  for (const ev of evaluations) {
    const c = cellValue(studentGrades[ev.id] ?? '', ev.scale);
    if (!c.counted) continue;
    const normalize = ev.normalize !== false;
    points += (normalize ? (c.value / ev.scale) * 20 : c.value) * ev.coef;
    max += (normalize ? 20 : ev.scale) * ev.coef;
  }
  return max ? round2((points / max) * 20) : null;
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

/** Fusionne les compétences de plusieurs trimestres (sans doublon, comparaison sans casse), dans l'ordre. */
export function mergeCompetencySets(sets) {
  const seen = new Set();
  const out = [];
  for (const set of sets) for (const c of set.items) {
    const k = c.trim().toLowerCase();
    if (!seen.has(k)) { seen.add(k); out.push(c.trim()); }
  }
  return out;
}

/** Compétences de la base proposée que l'enseignant n'a pas encore reprises (comparaison sans casse). */
export function competencyProposals(base, mine) {
  const have = new Set(mine.map((c) => c.trim().toLowerCase()));
  return base.filter((c) => !have.has(c.trim().toLowerCase()));
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

/**
 * Export de la grille du conseil au format CSV lisible par Excel (séparateur « ; »,
 * virgule décimale, BOM UTF-8 pour les accents).
 */
export function councilCsv({ className, term, subjects, rows }) {
  const cell = (v) => {
    const t = v === null || v === undefined ? '' : typeof v === 'number' ? formatFr(round2(v)) : String(v);
    return /[;"\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const header = ['Élève', ...subjects.map((s) => `${s.label}${s.inAverage ? '' : ' (hors moy.)'}`), 'Moyenne générale', 'Absences', 'Retards', 'Avis des enseignants', 'Décision du conseil', 'Appréciation générale'];
  const lines = [
    [`Conseil de classe — ${className} — ${term}`],
    header,
    ...rows.map((r) => [r.name, ...r.subjects.map((s) => s.avg), r.general, r.abs ?? 0, r.late ?? 0, r.flags, r.decision, r.appreciation]),
  ];
  return `﻿${lines.map((l) => l.map(cell).join(';')).join('\r\n')}\r\n`;
}

// --- Portails parent et élève : notes au fil du trimestre (pas de bulletin) ---------
export const fmt2 = (n) => (n === null || n === undefined ? '—' : n.toFixed(2).replace('.', ','));

/** Statistiques de la classe sur une évaluation (dans son barème). */
export function evaluationStats(ev, students, grades) {
  const v = students.map((s) => cellValue(grades[s]?.[ev.id] ?? '', ev.scale)).filter((c) => c.counted).map((c) => c.value);
  if (!v.length) return { avg: null, max: null, min: null };
  return { avg: round2(v.reduce((a, b) => a + b, 0) / v.length), max: Math.max(...v), min: Math.min(...v) };
}

/** Notes d'un élève dans une matière, dans l'ordre chronologique, avec les repères de la classe. */
export function studentNoteList(evaluations, students, grades, student, remarks = {}) {
  return [...evaluations]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((ev) => {
      const c = cellValue(grades[student]?.[ev.id] ?? '', ev.scale);
      const remark = ev.remarksEnabled ? remarks[student]?.[ev.id] ?? null : null;
      return { ...ev, value: c.value, status: c.counted ? 'NOTE' : c.status ?? 'NON_SAISIE', remark, ...evaluationStats(ev, students, grades) };
    });
}

// --- Publication des notes ------------------------------------------------------
// Les élèves voient la note à la date de publication choisie par l'enseignant ; les parents
// la voient `parentDelayDays` jours plus tard (paramétrage de l'Espace Parents, 1 jour par défaut).
export const parentPublishOn = (ev, settings) => addDays(ev.publishOn ?? ev.date, settings.grading.parentDelayDays ?? 1);

export function isPublished(ev, audience, today, settings) {
  const from = audience === 'PARENT' ? parentPublishOn(ev, settings) : ev.publishOn ?? ev.date;
  return from <= today;
}

/**
 * Bonus / malus du professeur sur la moyenne de sa matière (participation, travail, comportement…) :
 * en points, par demi-point, au plus ± max, motif obligatoire. Moyenne ajustée gardée entre 0 et 20.
 */
export function adjustedAverage(avg, adj) {
  if (avg == null || !adj?.points) return avg;
  return round2(Math.min(20, Math.max(0, avg + adj.points)));
}
export function adjustmentErrors(adj, max = 2) {
  if (!adj || !adj.points) return [];
  const e = [];
  if (Math.abs(adj.points) > max) e.push(`Au plus ${String(max).replace('.', ',')} point${max > 1 ? 's' : ''} de bonus ou de malus.`);
  if (Math.round(adj.points * 2) !== adj.points * 2) e.push('Par demi-point : 0,5 ; 1 ; 1,5…');
  if (!String(adj.reason ?? '').trim()) e.push('Indiquer le motif (participation, travail personnel, comportement…).');
  return e;
}
