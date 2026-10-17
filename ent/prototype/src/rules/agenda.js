// Agendas distincts : les cours (emploi du temps) ; le calendrier de l'école, ouvert à tous (vacances,
// jours fériés, réunions, sorties) ; les classes d'examen (3e, 1re, Terminale : brevet et bac blancs,
// épreuves, Parcoursup) pour leurs élèves, leurs parents et les professeurs ; l'équipe (arrêts des notes,
// conseils de classe, portes ouvertes), réservé au personnel ; et les devoirs. Chacun s'exporte au format iCalendar (.ics),
// lisible par Google Agenda et Apple Agenda ; avec le serveur, c'est un lien d'abonnement qui se
// met à jour tout seul.

export const AGENDAS = {
  COURS: { label: 'Cours', tone: 'navy' },
  ECOLE: { label: 'Calendrier de l\'école', tone: 'amber', hint: 'vacances, jours fériés, réunions, sorties' },
  EXAMENS: { label: 'Classes d\'examen', tone: 'red', hint: '3e, 1re, Terminale' },
  EQUIPE: { label: 'Équipe', tone: 'green', hint: 'arrêts des notes, conseils, portes ouvertes ; personnel seulement' },
  DEVOIRS: { label: 'Devoirs', tone: 'violet' },
};

export const isExamClass = (cls) => /^(3e|1re|Terminale)/.test(cls ?? '');
export const agendaOf = (e) => e.agenda ?? (e.staffOnly ? 'EQUIPE' : 'ECOLE');

/** Agendas proposés : l'équipe pour le personnel ; les examens au personnel et aux classes d'examen. */
export function agendasFor({ staff, cls }) {
  return Object.keys(AGENDAS).filter((k) => (k !== 'EQUIPE' || staff) && (k !== 'EXAMENS' || staff || isExamClass(cls)));
}

/** Vacances, fermetures et jours fériés des paramètres, dans le calendrier de l'école. */
export const closuresAsEvents = (calendar = []) => calendar.map((c) => ({
  id: `cal-${c.id}`, agenda: 'ECOLE', date: c.start, end: c.end, allDay: true, classes: [],
  title: c.kind === 'FERIE' ? `Jour férié — ${c.label}` : c.label,
}));

/** Éléments d'agenda pour une classe (ou toutes) : { agenda, date, start?, end?, allDay?, title, place? } */
export function agendaItems({ sessions = [], events = [], homework = [], cls = null, staff = false }) {
  const forCls = (c) => !cls || c === cls;
  const allowed = agendasFor({ staff, cls });
  return [
    ...sessions.filter((s) => forCls(s.cls)).map((s) => ({ id: `c-${s.id}`, agenda: 'COURS', date: s.date, start: s.start, end: s.end, title: `${s.subject} — ${s.cls}${{ ANNULE: ' (annulé)', DEPLACE: ' (déplacé)', AJOUT: ' (cours ajouté)' }[s.status] ?? ''}`, place: s.room, status: s.status })),
    ...events.filter((e) => allowed.includes(agendaOf(e)) && (!cls || !e.classes.length || e.classes.includes(cls))).map((e) => ({ id: `e-${e.id}`, agenda: agendaOf(e), date: e.date, start: e.start, end: e.allDay ? e.end : e.end, allDay: !!e.allDay, title: e.title, place: e.place })),
    ...homework.filter((h) => h.due && h.todo && forCls(h.cls)).map((h) => ({ id: `d-${h.id}`, agenda: 'DEVOIRS', date: h.due, allDay: true, title: `${h.subject} (${h.cls}) : ${h.todo}` })),
  ].sort((a, b) => `${a.date}${a.start ?? '00:00'}`.localeCompare(`${b.date}${b.start ?? '00:00'}`));
}

const esc = (t) => String(t ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
const dt = (date, time) => `${date.replace(/-/g, '')}T${time.replace(':', '')}00`;
const nextDay = (iso) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); };

/** Fichier iCalendar (heure de Madagascar). */
export function toIcs(items, name) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Chateaubriand Tamatave//ENT//FR', 'CALSCALE:GREGORIAN', `X-WR-CALNAME:${esc(name)}`, 'X-WR-TIMEZONE:Indian/Antananarivo'];
  items.forEach((it) => {
    lines.push('BEGIN:VEVENT', `UID:${it.id}@chateaubriand-tamatave`, 'DTSTAMP:20261013T000000Z');
    if (it.allDay) lines.push(`DTSTART;VALUE=DATE:${it.date.replace(/-/g, '')}`, `DTEND;VALUE=DATE:${nextDay(it.end && it.end.length === 10 ? it.end : it.date).replace(/-/g, '')}`);
    else lines.push(`DTSTART;TZID=Indian/Antananarivo:${dt(it.date, it.start)}`, `DTEND;TZID=Indian/Antananarivo:${dt(it.date, it.end ?? it.start)}`);
    lines.push(`SUMMARY:${esc(it.title)}`);
    if (it.place) lines.push(`LOCATION:${esc(it.place)}`);
    lines.push('END:VEVENT');
  });
  lines.push('END:VCALENDAR');
  return `${lines.join('\r\n')}\r\n`;
}
