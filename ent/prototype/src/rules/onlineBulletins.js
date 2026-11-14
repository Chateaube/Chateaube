// Bulletins à partir des carnets en ligne des professeurs (Direction) : pour une classe, chaque élève a les
// matières de ses professeurs (spécialités comprises), avec moyenne (bonus / malus des devoirs compris),
// moyenne de la classe, appréciation, compétences du bulletin. L'Enseignement scientifique, partagé entre deux
// professeurs, fait une seule ligne (moyenne 50/50). Moyenne générale : moyenne simple des matières.
import { studentAverage, generalAverage, classStats, BONUS_ENABLED } from './grading.js';
import { combineTeachers, classLine } from './bulletin.js';
import { servicesFor } from '../online/roster.js';
import { formatDateFr } from './calendar.js';
import { accord } from './documents.js';

const longDate = (iso) => (iso ? formatDateFr(iso).replace(/^\S+ /, '') : '');
const nameOf = (s) => `${s.lastName} ${s.firstName}`.trim();
const textOf = (c) => (c?.validated || c?.text ? (c.text ?? '').trim() : '');
/** Corrections de la Direction (relecture) : clé compte|service:élève. */
export const correctionKey = (tid, sid, student) => `${tid}|${sid}:${student}`;
/** Texte retenu pour le bulletin : la correction de la Direction si elle porte sur le texte actuel du professeur. */
export function finalText(original, correction) {
  if (correction && (correction.original ?? '') === (original ?? '')) return correction.text;
  return original ?? '';
}

/**
 * students : élèves de l'import ({ lastName, firstName, cls, birthDate, sex, specialties }) ;
 * roster : liste envoyée aux professeurs ; carnets : { compte: carnet } ; absences(nom) → { justified, unjustified, late }.
 */
export function buildClassBulletins({ cls, students = [], roster, carnets = {}, corrections = {}, absences = () => ({}), term = '1er Trimestre', year = '2026/2027' }) {
  const inClass = students.filter((s) => s.cls === cls).sort((a, b) => nameOf(a).localeCompare(nameOf(b), 'fr'));
  // matières de la classe : chaque professeur qui l'a dans ses services
  const bySubject = {};
  Object.keys(roster?.services ?? {}).forEach((tid) => servicesFor(roster, tid).filter((s) => s.cls === cls).forEach((s) => {
    (bySubject[s.subject] ??= []).push({ tid, teacher: roster.names?.[tid] ?? '', service: s, carnet: carnets[tid] ?? null });
  }));
  const subjects = Object.keys(bySubject);
  const rowFor = (subject, name) => {
    const parts = bySubject[subject].filter((p) => p.service.students.includes(name)).map((p) => {
      const c = p.carnet ?? {}; const sid = p.service.id;
      return { teacher: p.teacher, average: studentAverage(c.evaluations?.[sid] ?? [], c.grades?.[sid]?.[name], BONUS_ENABLED ? c.bonus?.[sid]?.[name] : undefined), appreciation: finalText(textOf(c.comments?.[`${sid}:${name}`]), corrections[correctionKey(p.tid, sid, name)]).trim(), competencies: c.myComps?.[sid] ?? [] };
    });
    if (!parts.length) return null; // matière que l'élève ne suit pas (spécialité)
    const x = combineTeachers(parts);
    return { label: subject, teacher: x.teachers.join(' / '), avg: x.average, appreciation: x.appreciation, competencies: x.competencies.slice(0, 6) };
  };
  const perStudent = inClass.map((st) => ({ st, rows: subjects.map((sub) => rowFor(sub, nameOf(st))).filter(Boolean) }));
  // moyennes de la classe par matière
  const classAvg = Object.fromEntries(subjects.map((sub) => [sub, classStats(perStudent.map((p) => p.rows.find((r) => r.label === sub)?.avg).filter((v) => v != null)).avg ?? null]));
  const generals = perStudent.map((p) => generalAverage(p.rows.map((r) => ({ inAverage: true, coef: 1, avg: r.avg }))));
  const classGeneral = classStats(generals.filter((g) => g != null)).avg ?? null;
  return perStudent.map(({ st, rows }, i) => ({
    term, year, student: nameOf(st), sex: st.sex,
    birthLine: st.birthDate ? `${accord(st.sex, 'Né', 'Née')} le ${longDate(st.birthDate)}` : '',
    classLine: classLine(cls, st.specialties ?? []),
    rows: rows.map((r) => ({ ...r, classAvg: classAvg[r.label] })),
    general: generals[i], classGeneral,
    ...absences(nameOf(st)),
  }));
}
