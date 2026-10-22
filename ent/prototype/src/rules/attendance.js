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

/* Retard de plus de 10 minutes : l'élève est compté ABSENT pour l'heure commencée et entre à l'heure pleine
 * suivante du cours (cours de 7h à 9h, arrivé à 7h12 : absent de 7h à 8h, entre à 8h). Pour un cours d'une
 * heure, il rejoint le cours suivant. */
export const LATE_LIMIT = 10;
const hm = (n) => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
export function lateOutcome({ start, end }, minutes) {
  if (!(minutes > LATE_LIMIT)) return { kind: 'RETARD', minutes };
  const enter = min(start) + 60 * Math.ceil(minutes / 60);
  if (enter >= min(end)) return { kind: 'ABSENCE', from: start, to: end, nextCourse: true };
  return { kind: 'ABSENCE', from: start, to: hm(enter), enterAt: hm(enter), nextCourse: false };
}
export const isLateAbsent = (mark) => mark?.status === 'R' && mark.minutes > LATE_LIMIT;

/** Bilan : présents, absents, retards. marks = { élève: { status: 'A' | 'R', minutes } } (présent par défaut).
 *  Un retard de plus de 10 minutes compte comme une absence (pour l'heure commencée). */
export function tally(roster, marks = {}) {
  const absent = roster.filter((n) => marks[n]?.status === 'A' || isLateAbsent(marks[n]));
  const late = roster.filter((n) => marks[n]?.status === 'R' && !isLateAbsent(marks[n]));
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

/* ---------- Justification déposée par la famille ----------
 * Le parent justifie depuis son téléphone (motif, mot, photo du justificatif facultative) tant que le délai
 * de 24 h court. La demande déposée à temps « arrête le chronomètre » : elle attend la vie scolaire, qui
 * l'accepte (absence justifiée) ou la refuse avec une raison (non justifiée si le délai est passé). */
export const JUSTIFY_REASONS = ['Certificat médical', 'Maladie', 'Motif familial', 'Transport', 'Rendez-vous administratif', 'Autre'];

/** Erreurs d'une demande de la famille ; [] si elle peut partir. */
export function familyRequestErrors(a, req, now) {
  const e = [];
  if (a.justified) e.push('Déjà justifiée.');
  if (a.request && !a.request.refused) e.push('Une justification est déjà envoyée : la vie scolaire la regarde.');
  if (now >= justifyDeadline(a)) e.push('Le délai de 24 h est dépassé : l\'absence reste non justifiée. Vous pouvez écrire à la vie scolaire.');
  if (!JUSTIFY_REASONS.includes(req.reason)) e.push('Choisissez un motif.');
  if (req.reason === 'Autre' && !(req.note ?? '').trim()) e.push('Précisez le motif.');
  return e;
}

/** Statut vu de tous : une demande déposée à temps et pas encore traitée est EN_ATTENTE (jamais « non justifiée »). */
export function justificationState(a, now) {
  if (a.justified) return { status: 'JUSTIFIEE' };
  if (a.request && !a.request.refused && a.request.at < justifyDeadline(a)) return { status: 'EN_ATTENTE', request: a.request };
  return justification(a, now);
}

/** « il reste 6 h » / « il reste 40 min » : compte à rebours lisible. */
export function timeLeftLabel(a, now) {
  const ms = new Date(`${justifyDeadline(a)}:00Z`) - new Date(`${now}:00Z`);
  if (ms <= 0) return 'délai dépassé';
  const minutes = Math.floor(ms / 60000);
  return minutes < 60 ? `il reste ${minutes} min` : `il reste ${Math.floor(minutes / 60)} h`;
}
