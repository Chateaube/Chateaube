// Horaires de travail de l'équipe : pas de réponse aux familles en dehors. Un message écrit le soir ou le
// week-end est lu à la reprise ; la famille le sait au moment d'écrire.
// Jours : 1 = lundi … 6 = samedi ; null = fermé. Vacances et jours fériés : fermé (settings.calendar).
import { isSchoolDay } from './discipline.js';
import { addDays, isoWeekday, formatDateFr } from './calendar.js';

export const DEFAULT_WORK_HOURS = { 1: ['07:00', '17:00'], 2: ['07:00', '17:00'], 3: ['07:00', '12:00'], 4: ['07:00', '17:00'], 5: ['07:00', '17:00'], 6: null };

const hoursOf = (settings) => settings?.workHours ?? DEFAULT_WORK_HOURS;
const open = (date, settings) => (isSchoolDay(date, settings) ? hoursOf(settings)[isoWeekday(date)] : null);

/** L'équipe est-elle au travail à cet instant ('AAAA-MM-JJTHH:MM') ? */
export function atWork(now, settings) {
  const h = open(now.slice(0, 10), settings);
  const t = now.slice(11, 16);
  return !!h && t >= h[0] && t < h[1];
}

/** Prochaine reprise ('AAAA-MM-JJTHH:MM') : maintenant si l'équipe travaille, sinon la prochaine ouverture. */
export function nextOpening(now, settings) {
  if (atWork(now, settings)) return now;
  const day = now.slice(0, 10); const t = now.slice(11, 16);
  const today = open(day, settings);
  if (today && t < today[0]) return `${day}T${today[0]}`;
  for (let d = addDays(day, 1), k = 0; k < 60; d = addDays(d, 1), k += 1) {
    const h = open(d, settings);
    if (h) return `${d}T${h[0]}`;
  }
  return null;
}

/** « lundi 19 octobre à 7h » */
export const openingLabel = (iso) => `${formatDateFr(iso.slice(0, 10)).replace(/ \d{4}$/, '')} à ${Number(iso.slice(11, 13))}h${iso.slice(14, 16) === '00' ? '' : iso.slice(14, 16)}`;
