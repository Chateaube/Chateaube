// Volume horaire des professeurs, à partir de l'emploi du temps : heures prévues sur une période
// (jours de classe seulement, hors fériés et vacances), heures faites, heures d'absence (avec ou sans
// travail laissé), reste à faire. Les vacataires sont payés sur les heures faites.
// Absence d'un professeur : il doit laisser un travail (devoir ou activité) pour la séance, surveillée
// par la vie scolaire ; une absence sans travail laissé est signalée à la Direction.
import { isSchoolDay } from './discipline.js';
import { addDays, isoWeekday } from './calendar.js';

export const WORK_KINDS = { DEVOIR: 'Devoir laissé', ACTIVITE: 'Activité laissée', AUCUN: 'Rien laissé' };
const minutes = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
export const slotHours = (s) => (minutes(s.end) - minutes(s.start)) / 60;

/** Séances prévues entre deux dates (jours de classe). */
export function plannedSessions(slots, from, to, settings) {
  const out = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    if (!isSchoolDay(d, settings)) continue;
    const wd = isoWeekday(d);
    slots.filter((s) => s.weekday === wd).forEach((s) => out.push({ date: d, slotId: s.id, teacherId: s.teacherId, cls: s.cls, subject: s.subject, hours: slotHours(s) }));
  }
  return out;
}

/** Bilan d'un professeur sur la période, à la date du jour. */
export function teacherHours(teacherId, slots, absences, { from, to, today, settings }) {
  const sessions = plannedSessions(slots.filter((s) => s.teacherId === teacherId), from, to, settings);
  const absent = new Set(absences.filter((a) => a.teacherId === teacherId).flatMap((a) => a.slotIds.map((id) => `${a.date}|${id}`)));
  const noWork = new Set(absences.filter((a) => a.teacherId === teacherId && a.work === 'AUCUN').flatMap((a) => a.slotIds.map((id) => `${a.date}|${id}`)));
  const sum = (list) => Math.round(list.reduce((t, s) => t + s.hours, 0) * 100) / 100;
  const past = sessions.filter((s) => s.date <= today);
  const isAbsent = (s) => absent.has(`${s.date}|${s.slotId}`);
  const byClass = {};
  sessions.forEach((s) => {
    const k = `${s.cls} — ${s.subject}`;
    byClass[k] ??= { planned: 0, done: 0, absent: 0 };
    byClass[k].planned += s.hours;
    if (s.date <= today) byClass[k][isAbsent(s) ? 'absent' : 'done'] += s.hours;
  });
  return {
    planned: sum(sessions),
    plannedToDate: sum(past),
    done: sum(past.filter((s) => !isAbsent(s))),
    absent: sum(sessions.filter(isAbsent)),
    absentNoWork: sum(sessions.filter((s) => noWork.has(`${s.date}|${s.slotId}`))),
    remaining: sum(sessions.filter((s) => s.date > today && !isAbsent(s))),
    byClass,
  };
}

/** Contrôle d'une déclaration d'absence. */
export function absenceErrors(a) {
  const e = [];
  if (!a.teacherId) e.push('Choisir le professeur.');
  if (!a.date) e.push('Choisir la date.');
  if (!a.slotIds?.length) e.push('Choisir au moins une séance.');
  if (!a.reason?.trim()) e.push('Indiquer le motif de l\'absence.');
  if (!WORK_KINDS[a.work]) e.push('Indiquer le travail laissé.');
  if (a.work !== 'AUCUN' && !a.workText?.trim() && !a.file) e.push('Décrire le devoir ou l\'activité, ou joindre le document.');
  return e;
}

/** Séances à surveiller par la vie scolaire, à partir d'une date. */
export function sessionsToSupervise(absences, slots, today) {
  return absences.filter((a) => a.date >= today).flatMap((a) => a.slotIds.map((id) => ({ ...a, slot: slots.find((s) => s.id === id) })))
    .sort((x, y) => `${x.date}${x.slot?.start}`.localeCompare(`${y.date}${y.slot?.start}`));
}
