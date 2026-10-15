// Appel : état d'une séance selon l'heure, et bilan des présences.

const min = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
export const OPEN_BEFORE = 10; // l'appel s'ouvre 10 minutes avant le début du cours

/**
 * État d'une séance : FAIT, EN_COURS (appel à faire maintenant), OUBLIE (séance passée sans appel),
 * A_VENIR (plus tard ou un autre jour).
 */
export function sessionState(s, now, record) {
  if (record) return 'FAIT';
  if (s.date < now.date || (s.date === now.date && min(now.time) > min(s.end))) return 'OUBLIE';
  if (s.date === now.date && min(now.time) >= min(s.start) - OPEN_BEFORE) return 'EN_COURS';
  return 'A_VENIR';
}

/** Bilan : présents, absents, retards. marks = { élève: { status: 'A' | 'R', minutes } } (présent par défaut). */
export function tally(roster, marks = {}) {
  const absent = roster.filter((n) => marks[n]?.status === 'A');
  const late = roster.filter((n) => marks[n]?.status === 'R');
  return { present: roster.length - absent.length - late.length, absent, late };
}

/** Prochaine séance à faire en priorité : celle en cours, sinon la première oubliée. */
export const nextToDo = (sessions, now, records) =>
  sessions.find((s) => sessionState(s, now, records[s.id]) === 'EN_COURS') ?? sessions.find((s) => sessionState(s, now, records[s.id]) === 'OUBLIE');
