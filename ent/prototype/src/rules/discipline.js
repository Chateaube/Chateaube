// Vie scolaire : punitions, sanctions et objets confisqués (téléphone, écouteurs, montre connectée…).
// Distinction du droit scolaire français, adaptée à l'établissement :
//  - PUNITIONS scolaires : décidées par un enseignant, la CPE, le secrétariat ou la Direction (dont l'avertissement) ;
//  - SANCTIONS disciplinaires, et le TIG : décidés par la Direction uniquement.
// Toute mesure porte un motif et peut être confirmée par le parent (« Je suis informé.e »).

import { addDays, isoWeekday } from './calendar.js';

export const MEASURES = [
  { id: 'AVERTISSEMENT', label: 'Avertissement', kind: 'PUNITION' },
  { id: 'OBSERVATION', label: 'Observation écrite', kind: 'PUNITION' },
  { id: 'DEVOIR_SUPP', label: 'Devoir supplémentaire', kind: 'PUNITION' },
  { id: 'RETENUE', label: 'Retenue', kind: 'PUNITION' },
  { id: 'EXCLUSION_COURS', label: 'Exclusion ponctuelle de cours', kind: 'PUNITION' },
  { id: 'TIG', label: 'Travail d\'intérêt général (TIG)', kind: 'PUNITION', authors: ['DIRECTION'] },
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
  if (m?.authors && !m.authors.includes(authorRole)) errors.push(`${m.label} : décidé par la Direction.`);
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
// Objet : un simple avertissement (l'objet n'est pas pris), ou une confiscation
export const PHONE_ACTIONS = { AVERTISSEMENT: 'Avertissement (objet non confisqué)', CONFISCATION: 'Confiscation' };
// Ce n'est pas toujours un téléphone : écouteurs sans fil, montre connectée, cigarette électronique…
export const OBJECTS = ['Téléphone', 'Écouteurs sans fil', 'Montre connectée', 'Cigarette électronique (Puff)', 'Autre'];
export const objectOf = (p) => (p.object === 'Autre' && p.objectNote ? p.objectNote : p.object ?? 'Téléphone');
// L'objet est remis à la vie scolaire, au secrétariat ou à la Direction (ou à une personne nommée) ;
// la durée de confiscation est décidée ensuite par la Direction ou le secrétariat.
export const HANDED_TO = ['Vie scolaire (CPE)', 'Secrétariat', 'Direction'];
export const DURATION_DECIDERS = ['DIRECTION', 'BUREAU'];
export const canDecideDuration = (role) => DURATION_DECIDERS.includes(role);

/** État d'un objet confisqué : A_DECIDER (durée à fixer), EN_GARDE, A_RENDRE (date passée), RENDU. */
export function objectState(p, now, settings) {
  if (p.action === 'AVERTISSEMENT') return 'AVERTISSEMENT';
  if (p.returned) return 'RENDU';
  if (!p.duration) return 'A_DECIDER';
  return phoneReturnAt(p.at, p.duration, settings) <= now ? 'A_RENDRE' : 'EN_GARDE';
}

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
 * Règles de l'établissement :
 *  - carnet de liaison oublié : 1 h de colle pour un ancien élève ; pour un nouvel élève (entré cette année),
 *    1 h de colle au 2e oubli (puis au 4e, au 6e…) ;
 *  - autres oublis (matériel, devoir, tenue d'EPS…) : notés ; la colle n'est pas automatique, c'est le
 *    professeur ou la CPE qui la demande (case « demander une heure de colle ») ;
 *  - trois retards = une colle d'une ou deux heures (au choix de la CPE).
 * Chaque colle est suivie jusqu'à ce qu'elle soit effectuée ; les TIG (Direction seulement) y figurent aussi. */
export const LATES_PER_COLLE = 3;
export const CARNET = 'Carnet de liaison';
export const FORGET_KINDS = [CARNET, 'Matériel', 'Devoir non fait', 'Tenue (EPS)', 'Autre'];
export const COLLE_STATUS = { A_FAIRE: 'À faire', FAITE: 'Effectuée', NON_FAITE: 'Non effectuée' };
/** Oublis du carnet par heure de colle : 2 pour un nouvel élève, 1 pour un ancien. */
export const carnetPerColle = (isNew) => (isNew ? 2 : 1);
const ddmm = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/** Passeport d'un élève : retards, oublis, colles (dues, effectuées), TIG, et colles à donner. */
export function passport(student, { attendance = [], forgets = [], colles = [] }, { isNew = false } = {}) {
  const lates = attendance.filter((a) => a.student === student && a.kind === 'RETARD').sort((a, b) => a.date.localeCompare(b.date));
  const mine = colles.filter((c) => c.student === student);
  const fromLates = mine.filter((c) => c.cause === 'RETARDS').length;
  const myForgets = forgets.filter((f) => f.student === student).sort((a, b) => a.date.localeCompare(b.date));
  const given = (f) => mine.some((c) => c.forgetId === f.id);
  const toGive = [];
  for (let k = fromLates; k < Math.floor(lates.length / LATES_PER_COLLE); k += 1) {
    const block = lates.slice(k * LATES_PER_COLLE, (k + 1) * LATES_PER_COLLE);
    toGive.push({ cause: 'RETARDS', hours: 1, choices: [1, 2], reason: `${LATES_PER_COLLE} retards (${block.map((a) => ddmm(a.date)).join(', ')})` });
  }
  // carnet de liaison : une colle par tranche d'oublis (1 ou 2 selon l'ancienneté), rattachée au dernier oubli de la tranche
  const per = carnetPerColle(isNew);
  const carnets = myForgets.filter((f) => f.kind === CARNET);
  for (let k = 0; k + per <= carnets.length; k += per) {
    const block = carnets.slice(k, k + per);
    const last = block[block.length - 1];
    if (!block.some(given)) toGive.push({ cause: 'OUBLI', forgetId: last.id, hours: 1, choices: [1], reason: `Carnet de liaison oublié ${per > 1 ? `${per} fois (${block.map((f) => ddmm(f.date)).join(', ')}) — nouvel élève` : `le ${ddmm(last.date)}`}` });
  }
  // autres oublis : seulement si le professeur ou la CPE a demandé une heure de colle
  myForgets.filter((f) => f.kind !== CARNET && f.colle && !given(f)).forEach((f) => toGive.push({ cause: 'OUBLI', forgetId: f.id, hours: 1, choices: [1], reason: `Oubli : ${f.kind.toLowerCase()}${f.note ? ` (${f.note})` : ''} le ${ddmm(f.date)} — colle demandée par ${f.by}` }));
  const hours = (list) => list.reduce((t, c) => t + (c.kind === 'TIG' ? 0 : c.hours), 0);
  return {
    lates: lates.length,
    latesInCycle: lates.length - fromLates * LATES_PER_COLLE - toGive.filter((g) => g.cause === 'RETARDS').length * LATES_PER_COLLE,
    forgets: myForgets.length,
    carnets: carnets.length,
    carnetsBeforeColle: per - (carnets.length % per),
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
