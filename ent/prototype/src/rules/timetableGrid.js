// Grille d'emploi du temps à la manière de l'outil de l'école : lignes de même hauteur aux repères
// habituels (7h, 7h30… récréation 9h30–9h45, puis 9h45, 10h15… déjeuner 12h–13h, 13h, 13h30…), une
// couleur par matière, les cours qui se chevauchent (groupes, semaines A et B) côte à côte.

const min = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
const hm = (n) => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;

export const RECESS = ['09:30', '09:45'];
export const LUNCH = ['12:00', '13:00'];
const BASE_MARKS = ['07:00', '07:30', '08:00', '08:30', '09:00', '09:30', '09:45', '10:15', '10:45', '11:15', '11:45', '12:00', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00'];

/** Repères de la grille : ceux de l'école, prolongés par demi-heures si un cours commence avant 7h ou finit après 17h. */
export function gridMarks(slots = []) {
  const marks = [...BASE_MARKS];
  const first = Math.min(...slots.map((s) => min(s.start)), min(marks[0]));
  const last = Math.max(...slots.map((s) => min(s.end)), min(marks.at(-1)));
  for (let t = min(marks[0]) - 30; t >= first - 29; t -= 30) marks.unshift(hm(t));
  for (let t = min(marks.at(-1)) + 30; t <= last + 29; t += 30) marks.push(hm(t));
  return marks;
}

/** Position d'une heure dans la grille, en nombre de lignes (fraction comprise) depuis le haut. */
export function rowPos(t, marks) {
  const x = min(t);
  if (x <= min(marks[0])) return 0;
  for (let i = 0; i < marks.length - 1; i += 1) {
    const a = min(marks[i]); const b = min(marks[i + 1]);
    if (x <= b) return i + (x - a) / (b - a);
  }
  return marks.length - 1;
}

/** Repère affiché en gras (heures pleines et 9h45, 10h45, 11h45, comme sur l'emploi du temps papier). */
export const strongMark = (t) => t.endsWith(':00') || ['09:45', '10:45', '11:45'].includes(t);
export const markLabel = (t) => `${Number(t.slice(0, 2))}h${t.slice(3) === '00' ? '' : t.slice(3)}`;

/** Cours d'une même colonne qui se chevauchent : chacun reçoit une voie et le nombre de voies de son groupe. */
export function layoutLanes(items) {
  const sorted = [...items].sort((a, b) => a.start.localeCompare(b.start) || b.end.localeCompare(a.end));
  const out = []; let cluster = []; let clusterEnd = '';
  const flush = () => { const n = Math.max(0, ...cluster.map((c) => c.lane + 1)); cluster.forEach((c) => out.push({ ...c, lanes: n })); cluster = []; };
  sorted.forEach((it) => {
    if (cluster.length && it.start >= clusterEnd) flush();
    const used = new Set(cluster.filter((c) => c.item.end > it.start).map((c) => c.lane));
    let lane = 0; while (used.has(lane)) lane += 1;
    cluster.push({ item: it, lane });
    clusterEnd = cluster.length === 1 ? it.end : (it.end > clusterEnd ? it.end : clusterEnd);
  });
  flush();
  return out.map(({ item, lane, lanes }) => ({ ...item, lane, lanes }));
}

const SHORT = {
  'Mathématiques': 'Maths', 'Physique-Chimie': 'P-C', 'Histoire-Géographie': 'HGE', 'Droit et économie': 'Eco-Droit',
  'Management, sciences de gestion et numérique': 'MSGN', 'Sciences de gestion et numérique': 'SGN', 'Sciences de la vie et de la Terre': 'SVT',
};
/** Libellé court, comme sur l'emploi du temps de l'école : Maths, P-C, HGE, Spé SVT, E.S. P-C… */
export function shortSubject(s) {
  if (s.subject === 'Enseignement scientifique') return s.part ? `E.S. ${s.part}` : 'E.S.';
  if (s.subject.startsWith('Spécialité ')) return `Spé ${shortSubject({ subject: s.subject.slice(11) })}`;
  return SHORT[s.subject] ?? s.subject;
}

// Couleurs douces par matière (les mêmes partout : écran, impression, portail des familles)
const COLORS = [
  [/^(fran|philo)/i, '#d4ddf0'], [/^(espagnol|mandarin)/i, '#fdf5c4'], [/^(p-c|physique|e\.s\. p)/i, '#d6f6f7'],
  [/^(hge|histoire|emc)/i, '#ece0d0'], [/^maths|^math/i, '#fbd2d2'], [/^anglais/i, '#fde0ee'], [/^(svt|e\.s\. svt|e\.s\.$)/i, '#daf5df'],
  [/^arts|^musique|^parcours/i, '#ead6f2'], [/^(ses|eco|économie|droit)/i, '#d5efd2'], [/^management/i, '#d9e6ff'], [/^(sgn|msgn)/i, '#f6d9ec'], [/^(techno|snt)/i, '#e6dbf5'],
  [/^eps/i, '#e6e6e6'],
];
export function subjectColor(s) {
  const label = shortSubject(s).replace(/^Spé /, '');
  return COLORS.find(([re]) => re.test(label))?.[1] ?? `hsl(${[...label].reduce((a, c) => a + c.charCodeAt(0), 0) % 360} 70% 90%)`;
}

/* ---------- La journée d'une classe : « Maintenant / Ensuite » (élèves et parents) ---------- */
import { weekLetter } from './teachingHours.js';
import { isoWeekday } from './calendar.js';
import { applyChanges } from './timetableChanges.js';

/** Cours d'une classe à une date (bonne semaine A ou B), avec les changements du jour (annulé, déplacé, ajouté). */
export function dayCourses(slots, cls, date, settings, changes = []) {
  const wd = isoWeekday(date);
  const letter = weekLetter(date, settings);
  const sessions = slots.filter((s) => s.cls === cls && s.weekday === wd && (!s.week || s.week === letter)).map((s) => ({ ...s, date }));
  return applyChanges(sessions, changes.filter((c) => c.cls === cls)).filter((s) => s.date === date).sort((a, b) => a.start.localeCompare(b.start));
}

/** Cours en cours et cours suivant à une heure donnée (les cours annulés ne comptent pas). */
export function nowNext(courses, time) {
  const live = courses.filter((c) => c.status !== 'ANNULE');
  return { now: live.find((c) => c.start <= time && time < c.end) ?? null, next: live.find((c) => c.start > time) ?? null };
}
