// Vie scolaire : punitions, sanctions et confiscations de téléphone.
// Distinction du droit scolaire français, adaptée à l'établissement :
//  - PUNITIONS scolaires : décidées par un enseignant ou la vie scolaire ;
//  - SANCTIONS disciplinaires : décidées par la Direction uniquement.
// Toute mesure porte un motif et peut être confirmée par le parent (« Je suis informé.e »).

import { addDays, isoWeekday } from './calendar.js';

export const MEASURES = [
  { id: 'OBSERVATION', label: 'Observation écrite', kind: 'PUNITION' },
  { id: 'DEVOIR_SUPP', label: 'Devoir supplémentaire', kind: 'PUNITION' },
  { id: 'RETENUE', label: 'Retenue', kind: 'PUNITION' },
  { id: 'EXCLUSION_COURS', label: 'Exclusion ponctuelle de cours', kind: 'PUNITION' },
  { id: 'AVERTISSEMENT', label: 'Avertissement', kind: 'SANCTION' },
  { id: 'BLAME', label: 'Blâme', kind: 'SANCTION' },
  { id: 'RESPONSABILISATION', label: 'Mesure de responsabilisation', kind: 'SANCTION' },
  { id: 'EXCLUSION_TEMP', label: 'Exclusion temporaire (8 jours max.)', kind: 'SANCTION' },
];

export const AUTHORS = { PROFESSEUR: 'Enseignant.e', VIE_SCOLAIRE: 'Vie scolaire', DIRECTION: 'Direction' };

/** Une sanction ne peut être décidée que par la Direction ; un motif est toujours obligatoire. */
export function validateMeasure({ measureId, authorRole, reason, student }) {
  const m = MEASURES.find((x) => x.id === measureId);
  const errors = [];
  if (!student) errors.push('Choisir un élève.');
  if (!m) errors.push('Choisir une mesure.');
  if (!String(reason ?? '').trim()) errors.push('Le motif est obligatoire.');
  if (m?.kind === 'SANCTION' && authorRole !== 'DIRECTION') errors.push('Une sanction ne peut être décidée que par la Direction.');
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
  { id: '5J', label: '5 jours ouvrés', schoolDays: 5 },
];

/**
 * Date et heure de restitution d'un téléphone confisqué le `at` ('AAAA-MM-JJTHH:MM').
 * 24 h → même heure le jour de classe suivant ; 5 jours ouvrés → même heure, 5 jours de classe plus tard.
 */
export function phoneReturnAt(at, durationId, settings) {
  const d = PHONE_DURATIONS.find((x) => x.id === durationId);
  const [day, time] = at.split('T');
  return `${addSchoolDays(day, d.schoolDays, settings)}T${time}`;
}
