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

/* ---------- Justification d'une absence ou d'un retard ----------
 * Règle de l'établissement : 24 heures au plus après le début de l'absence (heure du créneau ; 7h00 pour
 * une journée entière). Passé ce délai, l'absence est NON JUSTIFIÉE automatiquement, même si la famille
 * apporte un motif ensuite. */
export const JUSTIFY_HOURS = 24;
const plusHours = (local, h) => new Date(new Date(`${local}:00Z`).getTime() + h * 3_600_000).toISOString().slice(0, 16);

/** Début de l'absence ('AAAA-MM-JJTHH:MM') : première heure lue dans le créneau (« 07h00–09h00 »), sinon 7h00. */
export function absenceStart(a) {
  const m = /(\d{1,2})\s*h\s*(\d{2})?/.exec(a.slot ?? '');
  return `${a.date}T${m ? `${m[1].padStart(2, '0')}:${m[2] ?? '00'}` : '07:00'}`;
}
export const justifyDeadline = (a) => plusHours(absenceStart(a), JUSTIFY_HOURS);

/** JUSTIFIEE, A_JUSTIFIER (avec les heures restantes) ou NON_JUSTIFIEE (délai dépassé). */
export function justification(a, now) {
  if (a.justified) return { status: 'JUSTIFIEE' };
  const deadline = justifyDeadline(a);
  if (now >= deadline) return { status: 'NON_JUSTIFIEE', deadline };
  const left = Math.ceil((new Date(`${deadline}:00Z`) - new Date(`${now}:00Z`)) / 3_600_000);
  return { status: 'A_JUSTIFIER', deadline, hoursLeft: left };
}
