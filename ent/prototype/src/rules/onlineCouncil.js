// Grille du conseil de classe à partir des carnets en ligne des professeurs (Direction et secrétariat) :
// moyennes par matière (ES : une seule colonne, 50/50), moyenne générale (grille seulement, jamais sur le
// bulletin), avis des enseignants, état des saisies (nombre de notes, validation) et proposition de décision.
import { studentAverage, generalAverage, classStats, councilProposal, minEvaluationsFor } from './grading.js';
import { combineTeachers, orderSubjects } from './bulletin.js';
import { servicesFor } from '../online/roster.js';

const nameOf = (s) => `${s.lastName} ${s.firstName}`.trim();
/** Clé du document du conseil d'un élève (décision + appréciation générale). */
export const councilKey = (cls, student) => `conseil:${cls}|${student}`;

/** Classes de la liste envoyée aux professeurs, dans l'ordre de l'école. */
const ORDER = ['6e', '5e', '4e', '3e', '2de', '1re STMG', '1re Générale', 'Terminale STMG', 'Terminale Générale'];
export const rosterClasses = (roster) => [...new Set((roster?.students ?? []).map((s) => s.cls).filter(Boolean))]
  .sort((a, b) => ((ORDER.indexOf(a) + 1) || 99) - ((ORDER.indexOf(b) + 1) || 99) || a.localeCompare(b, 'fr'));

/**
 * roster : liste envoyée aux professeurs ; carnets : { compte: carnet } ; defaultMin : minimum de notes (Paramètres).
 * Retourne { students, subjects, rows, entries, classAvg, generalStats }.
 */
export function buildCouncil({ cls, roster, carnets = {}, defaultMin = 4, subjectOrder } = {}) {
  const students = (roster?.students ?? []).filter((s) => s.cls === cls).map(nameOf).sort((a, b) => a.localeCompare(b, 'fr'));
  const bySubject = {};
  Object.keys(roster?.services ?? {}).forEach((tid) => servicesFor(roster, tid).filter((s) => s.cls === cls).forEach((s) => {
    (bySubject[s.subject] ??= []).push({ tid, teacher: roster.names?.[tid] ?? '', service: s, carnet: carnets[tid] ?? null });
  }));
  const subjects = orderSubjects(Object.keys(bySubject).map((label) => ({ label })), subjectOrder).map((x) => x.label);
  // état des saisies : un par professeur et par matière
  const entries = subjects.flatMap((sub) => bySubject[sub].map(({ teacher, service, carnet }) => {
    const n = (carnet?.evaluations?.[service.id] ?? []).length;
    const min = minEvaluationsFor(service, defaultMin);
    return { subject: sub, teacher, count: n, min, validated: Boolean(carnet?.validated?.[service.id]), opened: Boolean(carnet) };
  }));
  const rows = students.map((name) => {
    const avgs = {}; const flags = [];
    subjects.forEach((sub) => {
      const parts = bySubject[sub].filter((p) => p.service.students.includes(name));
      if (!parts.length) { avgs[sub] = undefined; return; } // spécialité que l'élève ne suit pas
      avgs[sub] = combineTeachers(parts.map((p) => {
        const sid = p.service.id; const c = p.carnet ?? {};
        const f = c.flags?.[`${sid}:${name}`];
        (f?.ids ?? []).forEach((id) => flags.push({ subject: sub, teacher: p.teacher, flag: id }));
        if (f?.note?.trim()) flags.push({ subject: sub, teacher: p.teacher, note: f.note.trim() });
        return { teacher: p.teacher, average: studentAverage(c.evaluations?.[sid] ?? [], c.grades?.[sid]?.[name]) };
      })).average;
    });
    const general = generalAverage(subjects.map((sub) => ({ inAverage: true, coef: 1, avg: avgs[sub] })));
    return { name, avgs, general, flags, proposal: councilProposal(general, flags.filter((f) => f.flag).map((f) => f.flag)) };
  });
  const classAvg = Object.fromEntries(subjects.map((sub) => [sub, classStats(rows.map((r) => r.avgs[sub]).filter((v) => v != null))]));
  const generalStats = classStats(rows.map((r) => r.general).filter((v) => v != null));
  return { students, subjects, rows, entries, classAvg, generalStats };
}

/** Abréviation d'une matière pour l'en-tête de la grille. */
export function shortLabel(label) {
  const l = String(label ?? '');
  const known = [[/^fran/i, 'Fra'], [/^math/i, 'Math'], [/histoire/i, 'H-G'], [/anglais/i, 'Ang'], [/espagnol/i, 'Esp'], [/^eps$|physique et sportive/i, 'EPS'],
    [/^emc$|moral et civique/i, 'EMC'], [/physique/i, 'PC'], [/svt|vie et de la terre/i, 'SVT'], [/enseignement scientifique/i, 'ES'], [/philo/i, 'Philo'],
    [/arts? plastiques?/i, 'Arts'], [/musique/i, 'Mus'], [/^mgt|management/i, 'Mgt'], [/msgn/i, 'MSGN'], [/sgn|sciences de gestion/i, 'SGN'], [/droit/i, 'Droit'],
    [/[ée]conomie/i, 'Éco'], [/mercatique/i, 'Merc'], [/ses\b|sciences [ée]conomiques/i, 'SES'], [/techno/i, 'Techno'], [/vie de classe/i, 'VdC']];
  return known.find(([re]) => re.test(l))?.[1] ?? l.slice(0, 6);
}
