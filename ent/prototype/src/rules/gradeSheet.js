// Grilles de notes imprimables et exportables (Excel) : moyennes par matière pour une classe,
// ou détail des évaluations d'une matière. Mêmes données à l'écran, sur papier et dans Excel.
import { cellValue, studentAverage, classStats, generalAverage, round2 } from './grading.js';
import { csvCell } from './csv.js';

const fr = (n) => (n === null || n === undefined ? '' : String(round2(n)).replace('.', ','));

/** Rangs (ex aequo partagés), élèves sans moyenne non classés. */
export function ranks(values) {
  const sorted = values.filter((v) => v !== null && v !== undefined).sort((a, b) => b - a);
  return values.map((v) => (v === null || v === undefined ? null : sorted.indexOf(v) + 1));
}

/**
 * Grille des moyennes d'une classe.
 * subjects : [{ id, label, short, teacher, inAverage, coef }] ; rows : [{ name, avgs: { id: moyenne|null|undefined } }]
 * undefined = matière non suivie (spécialité), null = pas encore de note.
 */
export function averagesSheet({ subjects, rows }) {
  const out = rows.map((r) => {
    const general = generalAverage(subjects.filter((s) => r.avgs[s.id] !== undefined).map((s) => ({ ...s, avg: r.avgs[s.id] })));
    return { ...r, general };
  });
  const rk = ranks(out.map((r) => r.general));
  const stats = Object.fromEntries(subjects.map((s) => [s.id, classStats(out.map((r) => r.avgs[s.id]).filter((v) => v !== undefined))]));
  return { rows: out.map((r, i) => ({ ...r, rank: rk[i] })), stats, general: classStats(out.map((r) => r.general)) };
}

/** Grille détaillée d'une matière : chaque évaluation, la moyenne de l'élève, les repères de classe. */
export function detailSheet({ evaluations, students, grades }) {
  const evs = [...evaluations].sort((a, b) => a.date.localeCompare(b.date));
  const rows = students.map((name) => ({
    name,
    cells: evs.map((ev) => {
      const raw = String(grades[name]?.[ev.id] ?? '').trim();
      const c = cellValue(raw, ev.scale);
      return { raw, value: c.counted ? c.value : null, status: c.counted ? 'NOTE' : raw ? (c.pending ? 'A_CORRIGER' : c.status) : 'VIDE' };
    }),
    avg: studentAverage(evs, grades[name]),
  }));
  const evStats = evs.map((ev, i) => classStats(rows.map((r) => r.cells[i].value)));
  return { evaluations: evs, rows, evStats, avgStats: classStats(rows.map((r) => r.avg)) };
}

/** Texte d'une case de note : 14,5 / ABS / DISP / NN / à corriger / vide. */
const SHORT_STATUS = { ABSENT: 'ABS', DISPENSE: 'DISP', NON_NOTE: 'NN' };
export const cellText = (c) => (c.status === 'NOTE' ? fr(c.value) : c.status === 'VIDE' ? '' : c.status === 'A_CORRIGER' ? `${c.raw} (à corriger)` : SHORT_STATUS[c.status] ?? c.raw);

const cellOf = (v) => csvCell(typeof v === 'number' ? fr(v) : v);
export const csv = (lines) => `﻿${lines.map((l) => l.map(cellOf).join(';')).join('\r\n')}\r\n`;

/** Export Excel complet de la grille des moyennes (en-tête, élèves, repères de classe, légende). */
export function averagesCsv({ title, info = [], subjects, sheet, extra = [] }) {
  const head = ['Élève', ...subjects.map((s) => `${s.label}${s.inAverage === false ? ' (hors moyenne)' : ''}`), 'Moyenne générale', 'Rang', ...extra.map((e) => e.label)];
  const stat = (k, label) => [label, ...subjects.map((s) => sheet.stats[s.id][k]), sheet.general[k], '', ...extra.map(() => '')];
  return csv([
    [title], ...info.map((i) => [i]), [],
    head,
    ...sheet.rows.map((r) => [r.name, ...subjects.map((s) => (r.avgs[s.id] === undefined ? 'non suivie' : r.avgs[s.id])), r.general, r.rank ?? '', ...extra.map((e) => e.value(r))]),
    [],
    stat('avg', 'Moyenne de la classe'), stat('min', 'Note la plus basse'), stat('max', 'Note la plus haute'),
    [], ['Professeurs'], ...subjects.map((s) => [s.label, s.teacher ?? '']),
  ]);
}

/** Export Excel complet d'une matière : toutes les évaluations, barèmes, coefficients, repères. */
export function detailCsv({ title, info = [], sheet }) {
  const evs = sheet.evaluations;
  return csv([
    [title], ...info.map((i) => [i]), [],
    ['Élève', ...evs.map((ev) => `${ev.title} (${ev.date.split('-').reverse().join('/')}, /${ev.scale}, coef. ${ev.coef})`), 'Moyenne /20'],
    ...sheet.rows.map((r) => [r.name, ...r.cells.map(cellText), r.avg]),
    [],
    ['Moyenne de la classe', ...sheet.evStats.map((s) => s.avg), sheet.avgStats.avg],
    ['Note la plus basse', ...sheet.evStats.map((s) => s.min), sheet.avgStats.min],
    ['Note la plus haute', ...sheet.evStats.map((s) => s.max), sheet.avgStats.max],
    [], ['ABS : absent · DISP : dispensé · NN : non noté'],
  ]);
}

/** Conseil du 3e trimestre (passage) : le seul où le rang apparaît, sans rien cocher. */
export const isFinalTerm = (term) => term?.id === 'T3';

// --- Classeur Excel en couleurs (mêmes repères qu'à l'écran : rouge sous 10) ---
const num = (v) => (v === null || v === undefined ? null : round2(v));
const tone = (v, base = 'cell', red = 'red') => ({ v: num(v), s: v !== null && v !== undefined && v < 10 ? red : base });

/** Lignes de la feuille « Moyennes » : en-tête, élèves, repères de classe, professeurs. */
export function averagesRows({ title, info = [], subjects, sheet, extra = [] }) {
  const head = ['Élève', ...subjects.map((s) => `${s.short ?? s.label}${s.inAverage === false ? ' (hors moy.)' : ''}`), 'Moy. gén.', 'Rang', ...extra.map((e) => e.label)].map((v) => ({ v, s: 'head' }));
  const rows = sheet.rows.map((r) => [
    { v: r.name, s: 'name' },
    ...subjects.map((s) => (r.avgs[s.id] === undefined ? { v: 'non suivie', s: 'small' } : tone(r.avgs[s.id]))),
    tone(r.general, 'avg', 'avgRed'), { v: r.rank ?? null, s: 'cell' },
    ...extra.map((e) => ({ v: e.value(r), s: 'small' })),
  ]);
  const stat = (k, label) => [{ v: label, s: 'name' }, ...subjects.map((s) => tone(sheet.stats[s.id][k])), tone(sheet.general[k], 'avg', 'avgRed'), { v: null, s: 'cell' }, ...extra.map(() => ({ v: null, s: 'cell' }))];
  return {
    rows: [[{ v: title, s: 'title' }], ...info.map((i) => [{ v: i, s: 'muted' }]), [], head, ...rows, [],
      stat('avg', 'Moyenne de la classe'), stat('min', 'Note la plus basse'), stat('max', 'Note la plus haute'), [],
      [{ v: 'Professeurs', s: 'muted' }], ...subjects.map((s) => [{ v: `${s.short ?? s.label} : ${s.label}`, s: 'muted' }, { v: s.teacher ?? '', s: 'muted' }])],
    widths: [24, ...subjects.map(() => 7), 9, 6, ...extra.map((e) => (e.wide ? 36 : 12))],
    freeze: { row: info.length + 3, col: 1 },
  };
}

/** Lignes de la feuille « détail d'une matière ». */
export function detailRows({ title, info = [], sheet }) {
  const evs = sheet.evaluations;
  const head = ['Élève', ...evs.map((ev) => `${ev.title}\n${ev.date.split('-').reverse().join('/')} · /${ev.scale} · coef. ${ev.coef}`), 'Moyenne /20'].map((v) => ({ v, s: 'head' }));
  const rows = sheet.rows.map((r) => [
    { v: r.name, s: 'name' },
    ...r.cells.map((c, i) => (c.status === 'NOTE' ? { v: num(c.value), s: (c.value * 20) / evs[i].scale < 10 ? 'red' : 'cell' } : { v: cellText(c), s: 'small' })),
    tone(r.avg, 'avg', 'avgRed'),
  ]);
  return {
    rows: [[{ v: title, s: 'title' }], ...info.map((i) => [{ v: i, s: 'muted' }]), [], head, ...rows, [],
      [{ v: 'Moyenne de la classe', s: 'name' }, ...sheet.evStats.map((s) => ({ v: num(s.avg), s: 'cell' })), tone(sheet.avgStats.avg, 'avg', 'avgRed')],
      [], [{ v: 'ABS : absent · DISP : dispensé · NN : non noté', s: 'muted' }]],
    widths: [24, ...evs.map(() => 14), 11],
    freeze: { row: info.length + 3, col: 1 },
  };
}
