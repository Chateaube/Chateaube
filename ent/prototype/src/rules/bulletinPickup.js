// Retrait des bulletins : la Direction fixe la date à partir de laquelle ils sont disponibles au
// secrétariat et le délai de retrait (ex. 2 semaines). Les familles sont prévenues ; un rappel part
// quelques jours avant la fin. Passé le délai, le bulletin n'est pas détruit : il est archivé au
// dossier et remis sur rendez-vous (règle à inscrire au règlement intérieur).
import { addDays } from './calendar.js';

export const REMINDER_DAYS = 3;

export const pickupUntil = (w) => (w?.from ? addDays(w.from, (w.days ?? 14) - 1) : null);

/** État d'un bulletin pour la remise : A_VENIR, A_RETIRER, RAPPEL, BLOQUE, REMIS, ARCHIVE. */
export function pickupStatus(today, w, { given = false, blocked = false } = {}) {
  if (given) return 'REMIS';
  if (blocked) return 'BLOQUE';
  if (!w?.from || today < w.from) return 'A_VENIR';
  const until = pickupUntil(w);
  if (today > until) return 'ARCHIVE';
  return addDays(today, REMINDER_DAYS) >= until ? 'RAPPEL' : 'A_RETIRER';
}

export const PICKUP_LABEL = {
  A_VENIR: ['slate', 'pas encore disponible'],
  A_RETIRER: ['navy', 'à retirer'],
  RAPPEL: ['amber', 'rappel envoyé'],
  BLOQUE: ['red', 'en attente de régularisation'],
  REMIS: ['green', 'remis'],
  ARCHIVE: ['slate', 'non retiré : archivé au dossier'],
};

const fr = (iso) => iso.split('-').reverse().join('/');
/** Message vu par la famille dans son portail. */
export function familyMessage(status, w, term) {
  const until = pickupUntil(w);
  switch (status) {
    case 'A_RETIRER':
    case 'RAPPEL': return `Le bulletin du ${term} est à retirer au secrétariat jusqu'au ${fr(until)}.`;
    case 'BLOQUE': return `Le bulletin du ${term} est en attente de régularisation : merci de passer au secrétariat.`;
    case 'ARCHIVE': return `Le bulletin du ${term} n'a pas été retiré : il est archivé au dossier, à demander au secrétariat sur rendez-vous.`;
    case 'REMIS': return null;
    default: return w?.from ? `Le bulletin du ${term} sera disponible au secrétariat à partir du ${fr(w.from)}.` : null;
  }
}
