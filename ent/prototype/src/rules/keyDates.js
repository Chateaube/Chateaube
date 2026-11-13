// Dates clés (Parcoursup, Campus France…) : rappels à la Direction et aux élèves concernés, quelques jours avant
// et pendant toute la période (ex. saisie des vœux du 18 janvier au 11 mars).
import { formatDateFr } from './calendar.js';

const KEY = /parcoursup|campus france/i;
const days = (a, b) => Math.round((new Date(`${b}T12:00:00Z`) - new Date(`${a}T12:00:00Z`)) / 864e5);

/** events : événements de l'école ; cls : classe de l'élève (rien = toutes, pour la Direction). */
export function keyDateAlerts(events = [], today, { cls = null, before = 7 } = {}) {
  return events.filter((e) => KEY.test(e.title ?? '') && (!cls || !e.classes?.length || e.classes.includes(cls)))
    .map((e) => {
      const end = e.end && e.end.length === 10 ? e.end : e.date;
      if (e.date <= today && today <= end) return { id: e.id, date: e.date, ongoing: true, text: `${e.title}${end !== e.date ? ` — en cours jusqu'au ${formatDateFr(end).replace(/^\S+ /, '')}` : ' — aujourd\'hui'}` };
      const n = days(today, e.date);
      if (n > 0 && n <= before) return { id: e.id, date: e.date, ongoing: false, text: `${e.title} — ${formatDateFr(e.date)} (${n === 1 ? 'demain' : `dans ${n} jours`})` };
      return null;
    }).filter(Boolean).sort((a, b) => a.date.localeCompare(b.date));
}
