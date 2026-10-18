// Vie scolaire : punitions, sanctions et confiscations de téléphone.
// Distinction du droit scolaire français, adaptée à l'établissement :
//  - PUNITIONS scolaires : décidées par un enseignant, la CPE ou le secrétariat (dont l'avertissement) ;
//  - SANCTIONS disciplinaires : décidées par la Direction uniquement.
// Toute mesure porte un motif et peut être confirmée par le parent (« Je suis informé.e »).

import { addDays, isoWeekday } from './calendar.js';

export const MEASURES = [
  { id: 'AVERTISSEMENT', label: 'Avertissement', kind: 'PUNITION' },
  { id: 'OBSERVATION', label: 'Observation écrite', kind: 'PUNITION' },
  { id: 'DEVOIR_SUPP', label: 'Devoir supplémentaire', kind: 'PUNITION' },
  { id: 'RETENUE', label: 'Retenue', kind: 'PUNITION' },
  { id: 'EXCLUSION_COURS', label: 'Exclusion ponctuelle de cours', kind: 'PUNITION' },
  { id: 'TIG', label: 'Travail d\'intérêt général (TIG)', kind: 'PUNITION', authors: ['VIE_SCOLAIRE', 'BUREAU', 'DIRECTION'] },
  { id: 'BLAME', label: 'Blâme', kind: 'SANCTION' },
  { id: 'RESPONSABILISATION', label: 'Mesure de responsabilisation', kind: 'SANCTION' },
  { id: 'EXCLUSION_TEMP', label: 'Exclusion temporaire (8 jours max.)', kind: 'SANCTION' },
];

export const AUTHORS = { PROFESSEUR: 'Enseignant.e', VIE_SCOLAIRE: 'CPE', BUREAU: 'Secrétariat', DIRECTION: 'Direction' };

/** Une sanction ne peut être décidée que par la Direction ; un motif est toujours obligatoire. */
export function validateMeasure({ measureId, authorRole, reason, student }) {
  const m = MEASURES.find((x) => x.id === measureId);
  const errors = [];
  if (!student) errors.push('Choisir un élève.');
  if (!m) errors.push('Choisir une mesure.');
  if (!String(reason ?? '').trim()) errors.push('Le motif est obligatoire.');
  if (m?.kind === 'SANCTION' && authorRole !== 'DIRECTION') errors.push('Une sanction ne peut être décidée que par la Direction.');
  if (m?.authors && !m.authors.includes(authorRole)) errors.push(`${m.label} : décidé par la CPE, le secrétariat ou la Direction.`);
  return errors;
}

// Jours de classe : lundi → vendredi, hors jours fériés, vacances et fermetures
// (contrairement aux relances, octobre n'est pas gelé).
export function isSchoolDay(iso, settings) {
  if (isoWeekday(iso) > 5) return false;
  return !settings.calendar.some((e) => e.start <= iso && iso <= e.end);
}

export function addSchoolDays(iso, n, settings) {
  let d = iso;
  for (let count = 0, guard = 0; count < n; guard++) {
    if (guard > 400) throw new Error('Aucun jour de classe trouvé : vérifier le calendrier.');
    d = addDays(d, 1);
    if (isSchoolDay(d, settings)) count++;
  }
  return d;
}

export const PHONE_DURATIONS = [
  { id: '24H', label: '24 heures', schoolDays: 1 },
  { id: '48H', label: '48 heures', schoolDays: 2 },
  { id: '5J', label: '5 jours ouvrés', schoolDays: 5 },
];
// Téléphone : un simple avertissement (le téléphone n'est pas pris), ou une confiscation
export const PHONE_ACTIONS = { AVERTISSEMENT: 'Avertissement (téléphone non confisqué)', CONFISCATION: 'Confiscation' };

/**
 * Date et heure de restitution d'un téléphone confisqué le `at` ('AAAA-MM-JJTHH:MM').
 * 24 h → même heure le jour de classe suivant ; 5 jours ouvrés → même heure, 5 jours de classe plus tard.
 */
export function phoneReturnAt(at, durationId, settings) {
  const d = PHONE_DURATIONS.find((x) => x.id === durationId);
  const [day, time] = at.split('T');
  return `${addSchoolDays(day, d.schoolDays, settings)}T${time}`;
}

/**
 * Durée proposée selon les faits précédents de l'élève pris avec le téléphone (avertissements compris) :
 * 1re fois 24 h, 2e fois 48 h, ensuite 5 jours ouvrés. La personne qui confisque peut la changer.
 */
export function phoneDurationFor(student, phones) {
  const previous = phones.filter((p) => p.student === student).length;
  return { duration: previous === 0 ? '24H' : previous === 1 ? '48H' : '5J', previous };
}

/**
 * Restitution : le téléphone revient à son propriétaire (parfois un autre élève que celui qui l'avait) ;
 * pour une confiscation de 5 jours ouvrés, il n'est rendu qu'à un responsable légal du propriétaire.
 */
export function validateReturn({ duration, toRole, toName }) {
  const errors = [];
  if (!String(toName ?? '').trim()) errors.push('Indiquer à qui le téléphone est rendu.');
  if (duration === '5J' && toRole !== 'PARENT') errors.push('Confiscation de 5 jours : restitution à un responsable légal uniquement.');
  return errors;
}

/** Relance du parent si « Je suis informé.e » n'est pas coché après `hours` heures (e-mail + application, pas de SMS). */
export function ackReminderDue(notifiedAt, ackAt, now, hours = 48) {
  if (ackAt || !notifiedAt) return false;
  return (new Date(now) - new Date(notifiedAt)) / 3_600_000 >= hours;
}

/* ---------- Passeport de vie scolaire ----------
 * Règles de l'établissement : un oubli (matériel, devoir, carnet) = une heure de colle ;
 * trois retards = une colle d'une ou deux heures (au choix de la CPE). Chaque colle est suivie
 * jusqu'à ce qu'elle soit effectuée ; les TIG (travaux d'intérêt général) y figurent aussi. */
export const LATES_PER_COLLE = 3;
export const FORGET_KINDS = ['Matériel', 'Devoir non fait', 'Carnet de liaison', 'Tenue (EPS)', 'Autre'];
export const COLLE_STATUS = { A_FAIRE: 'À faire', FAITE: 'Effectuée', NON_FAITE: 'Non effectuée' };

/** Passeport d'un élève : retards, oublis, colles (dues, effectuées), TIG, et colles à donner. */
export function passport(student, { attendance = [], forgets = [], colles = [] }) {
  const lates = attendance.filter((a) => a.student === student && a.kind === 'RETARD').sort((a, b) => a.date.localeCompare(b.date));
  const mine = colles.filter((c) => c.student === student);
  const fromLates = mine.filter((c) => c.cause === 'RETARDS').length;
  const myForgets = forgets.filter((f) => f.student === student);
  const toGive = [];
  for (let k = fromLates; k < Math.floor(lates.length / LATES_PER_COLLE); k += 1) {
    const block = lates.slice(k * LATES_PER_COLLE, (k + 1) * LATES_PER_COLLE);
    toGive.push({ cause: 'RETARDS', hours: 1, choices: [1, 2], reason: `${LATES_PER_COLLE} retards (${block.map((a) => a.date.slice(8, 10) + '/' + a.date.slice(5, 7)).join(', ')})` });
  }
  myForgets.filter((f) => !mine.some((c) => c.forgetId === f.id)).forEach((f) => toGive.push({ cause: 'OUBLI', forgetId: f.id, hours: 1, choices: [1], reason: `Oubli : ${f.kind.toLowerCase()}${f.note ? ` (${f.note})` : ''} le ${f.date.slice(8, 10)}/${f.date.slice(5, 7)}` }));
  const hours = (list) => list.reduce((t, c) => t + (c.kind === 'TIG' ? 0 : c.hours), 0);
  return {
    lates: lates.length,
    latesInCycle: lates.length - fromLates * LATES_PER_COLLE - toGive.filter((g) => g.cause === 'RETARDS').length * LATES_PER_COLLE,
    forgets: myForgets.length,
    toGive,
    collesDue: hours(mine.filter((c) => c.kind !== 'TIG' && c.status !== 'FAITE')),
    collesDone: hours(mine.filter((c) => c.kind !== 'TIG' && c.status === 'FAITE')),
    tig: mine.filter((c) => c.kind === 'TIG').length,
    entries: mine.sort((a, b) => b.date.localeCompare(a.date)),
  };
}

export function colleErrors({ hours, when, kind }) {
  const e = [];
  if (kind !== 'TIG' && ![1, 2].includes(hours)) e.push('Une colle dure une ou deux heures.');
  if (!when) e.push('Indiquer quand elle a lieu.');
  return e;
}
