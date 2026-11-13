// Changements d'emploi du temps, annoncés aux élèves et aux parents de la classe :
//  - cours annulé (décidé par la Direction : les élèves restent prévenus, rien d'autre ne change) ;
//  - cours déplacé ou reporté à une autre date / heure (temporaire) ;
//  - cours ajouté : EXCEPTIONNEL (motif obligatoire, une date ou chaque semaine jusqu'à une date)
//    ou DÉFINITIF (chaque semaine à partir d'une date : il entre dans l'emploi du temps) ;
//  - modification définitive de l'emploi du temps, à partir d'une date.
// L'absence d'un professeur, elle, n'est PAS annoncée aux familles : les élèves viennent, en étude surveillée.
export const CHANGE_TYPES = {
  ANNULE: 'Cours annulé',
  DEPLACE: 'Cours déplacé',
  AJOUT: 'Cours ajouté',
  DEFINITIF: 'Changement définitif d\'emploi du temps',
};
const hm = (t) => t.replace(':', 'h');
export const ADD_REASONS = ['Rattrapage', 'Cours supplémentaire', 'Préparation d\'examen', 'Soutien', 'Parcours d\'ouverture', 'Autre'];
const addDays = (iso, n) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
/** Dates d'un cours ajouté : une date, ou chaque semaine jusqu'à `until` (exceptionnel) / jusqu'à `end` (définitif). */
export function addedDates(c, end) {
  const last = c.addMode === 'DEFINITIF' ? end : (c.until || c.date);
  const out = [];
  for (let d = c.date; d && last && d <= last && out.length < 60; d = addDays(d, 7)) out.push(d);
  return out.length ? out : [c.date];
}

export function changeErrors(c) {
  const e = [];
  if (!CHANGE_TYPES[c.type]) e.push('Choisir le type de changement.');
  if (!c.cls || !c.subject) e.push('Choisir la classe et la matière.');
  if (!c.date) e.push('Choisir la date.');
  if (['ANNULE', 'DEPLACE', 'AJOUT', 'DEFINITIF'].includes(c.type) && (!c.start || !c.end || c.end <= c.start)) e.push('Indiquer l\'horaire (fin après le début).');
  if (c.type === 'AJOUT' && c.addMode !== 'DEFINITIF' && !(c.reason ?? '').trim()) e.push('Cours exceptionnel : indiquer le motif.');
  if (c.type === 'AJOUT' && c.addMode !== 'DEFINITIF' && c.until && c.until < c.date) e.push('La date de fin doit suivre la date du premier cours.');
  if (c.type === 'DEPLACE' && (!c.newDate || !c.newStart || !c.newEnd || c.newEnd <= c.newStart)) e.push('Indiquer la nouvelle date et le nouvel horaire.');
  if (c.type === 'DEFINITIF' && (!c.newStart || !c.newEnd || !c.newWeekday)) e.push('Indiquer le nouveau jour et le nouvel horaire.');
  return e;
}

const weekday = (iso) => new Date(`${iso}T12:00:00Z`).getUTCDay();
const DAYS = ['', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
/** Annonce aux élèves et aux parents de la classe. dateLabel(iso) → « mardi 20 octobre ». */
export function changeNotice(c, dateLabel) {
  const what = `${c.subject} (${c.cls})`;
  const room = c.room ? `, ${c.room}` : '';
  switch (c.type) {
    case 'ANNULE': return { title: `${what} : cours annulé le ${dateLabel(c.date)}`, text: `Le cours de ${c.subject} du ${dateLabel(c.date)} (${hm(c.start)}–${hm(c.end)}) est annulé.${c.note ? ` ${c.note}` : ''}` };
    case 'DEPLACE': return { title: `${what} : cours déplacé`, text: `Le cours de ${c.subject} du ${dateLabel(c.date)} (${hm(c.start)}–${hm(c.end)}) est déplacé au ${dateLabel(c.newDate)}, de ${hm(c.newStart)} à ${hm(c.newEnd)}${room}.${c.note ? ` ${c.note}` : ''}` };
    case 'AJOUT':
      if (c.addMode === 'DEFINITIF') return { title: `${what} : nouveau cours chaque ${DAYS[weekday(c.date)]} à partir du ${dateLabel(c.date)}`, text: `À partir du ${dateLabel(c.date)}, un cours de ${c.subject} a lieu chaque ${DAYS[weekday(c.date)]}, de ${hm(c.start)} à ${hm(c.end)}${room}.${c.note ? ` ${c.note}` : ''}` };
      if (c.until && c.until > c.date) return { title: `${what} : cours ajouté chaque ${DAYS[weekday(c.date)]} jusqu'au ${dateLabel(c.until)}`, text: `${c.reason ? `${c.reason} : u` : 'U'}n cours de ${c.subject} est ajouté chaque ${DAYS[weekday(c.date)]}, du ${dateLabel(c.date)} au ${dateLabel(c.until)}, de ${hm(c.start)} à ${hm(c.end)}${room}.${c.note ? ` ${c.note}` : ''}` };
      return { title: `${what} : cours ajouté le ${dateLabel(c.date)}`, text: `${c.reason ? `${c.reason} : u` : 'U'}n cours de ${c.subject} est ajouté le ${dateLabel(c.date)}, de ${hm(c.start)} à ${hm(c.end)}${room}.${c.note ? ` ${c.note}` : ''}` };
    default: return { title: `${what} : nouvel horaire à partir du ${dateLabel(c.date)}`, text: `À partir du ${dateLabel(c.date)}, le cours de ${c.subject} du ${DAYS[c.oldWeekday] ?? ''} ${hm(c.start)}–${hm(c.end)} a lieu le ${DAYS[c.newWeekday]} de ${hm(c.newStart)} à ${hm(c.newEnd)}${room}.${c.note ? ` ${c.note}` : ''}` };
  }
}

/** Séances de l'agenda après les changements temporaires (annulées marquées, déplacées et ajoutées). */
export function applyChanges(sessions, changes) {
  const out = sessions.map((s) => {
    const cancel = changes.find((c) => c.type === 'ANNULE' && c.cls === s.cls && c.subject === s.subject && c.date === s.date && c.start === s.start);
    const moved = changes.find((c) => c.type === 'DEPLACE' && c.cls === s.cls && c.subject === s.subject && c.date === s.date && c.start === s.start);
    if (cancel) return { ...s, status: 'ANNULE' };
    if (moved) return { ...s, date: moved.newDate, start: moved.newStart, end: moved.newEnd, room: moved.room || s.room, status: 'DEPLACE' };
    return s;
  });
  const end = sessions.reduce((m, s) => (s.date > m ? s.date : m), '');
  const added = changes.filter((c) => c.type === 'AJOUT').flatMap((c) => addedDates(c, end || c.date).map((date) => ({ id: `add-${c.id}-${date}`, date, start: c.start, end: c.end, cls: c.cls, subject: c.subject, room: c.room ?? '', ...(c.addMode === 'DEFINITIF' ? {} : { status: 'AJOUT' }) })));
  return [...out, ...added];
}
