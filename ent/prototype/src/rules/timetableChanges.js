// Changements d'emploi du temps, annoncés aux élèves et aux parents de la classe :
//  - cours annulé (décidé par la Direction : les élèves restent prévenus, rien d'autre ne change) ;
//  - cours déplacé ou reporté à une autre date / heure (temporaire) ;
//  - cours ajouté (temporaire : rattrapage, cours supplémentaire) ;
//  - modification définitive de l'emploi du temps, à partir d'une date.
// L'absence d'un professeur, elle, n'est PAS annoncée aux familles : les élèves viennent, en étude surveillée.
export const CHANGE_TYPES = {
  ANNULE: 'Cours annulé',
  DEPLACE: 'Cours déplacé',
  AJOUT: 'Cours ajouté',
  DEFINITIF: 'Changement définitif d\'emploi du temps',
};
const hm = (t) => t.replace(':', 'h');

export function changeErrors(c) {
  const e = [];
  if (!CHANGE_TYPES[c.type]) e.push('Choisir le type de changement.');
  if (!c.cls || !c.subject) e.push('Choisir la classe et la matière.');
  if (!c.date) e.push('Choisir la date.');
  if (['ANNULE', 'DEPLACE', 'AJOUT', 'DEFINITIF'].includes(c.type) && (!c.start || !c.end || c.end <= c.start)) e.push('Indiquer l\'horaire (fin après le début).');
  if (c.type === 'DEPLACE' && (!c.newDate || !c.newStart || !c.newEnd || c.newEnd <= c.newStart)) e.push('Indiquer la nouvelle date et le nouvel horaire.');
  if (c.type === 'DEFINITIF' && (!c.newStart || !c.newEnd || !c.newWeekday)) e.push('Indiquer le nouveau jour et le nouvel horaire.');
  return e;
}

const DAYS = ['', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
/** Annonce aux élèves et aux parents de la classe. dateLabel(iso) → « mardi 20 octobre ». */
export function changeNotice(c, dateLabel) {
  const what = `${c.subject} (${c.cls})`;
  const room = c.room ? `, ${c.room}` : '';
  switch (c.type) {
    case 'ANNULE': return { title: `${what} : cours annulé le ${dateLabel(c.date)}`, text: `Le cours de ${c.subject} du ${dateLabel(c.date)} (${hm(c.start)}–${hm(c.end)}) est annulé.${c.note ? ` ${c.note}` : ''}` };
    case 'DEPLACE': return { title: `${what} : cours déplacé`, text: `Le cours de ${c.subject} du ${dateLabel(c.date)} (${hm(c.start)}–${hm(c.end)}) est déplacé au ${dateLabel(c.newDate)}, de ${hm(c.newStart)} à ${hm(c.newEnd)}${room}.${c.note ? ` ${c.note}` : ''}` };
    case 'AJOUT': return { title: `${what} : cours ajouté le ${dateLabel(c.date)}`, text: `Un cours de ${c.subject} est ajouté le ${dateLabel(c.date)}, de ${hm(c.start)} à ${hm(c.end)}${room}.${c.note ? ` ${c.note}` : ''}` };
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
  const added = changes.filter((c) => c.type === 'AJOUT').map((c) => ({ id: `add-${c.id}`, date: c.date, start: c.start, end: c.end, cls: c.cls, subject: c.subject, room: c.room ?? '', status: 'AJOUT' }));
  return [...out, ...added];
}
