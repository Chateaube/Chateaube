// Appréciation générale du conseil de classe : le secrétariat peut la taper d'après les notes de la
// Directrice, puis la Direction valide, corrige ou renvoie avec une remarque. Seule une appréciation
// validée par la Direction va sur le bulletin.
export const GA_STATUS = {
  BROUILLON: ['slate', 'brouillon'],
  A_VALIDER: ['amber', 'à valider'],
  A_REVOIR: ['red', 'à revoir'],
  VALIDEE: ['green', 'validée'],
};

/**
 * Modifier le texte. Toute modification d'un texte validé le repasse en brouillon (à revalider) ;
 * la Direction qui corrige un texte « à valider » le laisse à valider jusqu'à son clic sur Valider.
 */
export function saveText(entry, text, role) {
  if (!['DIRECTION', 'BUREAU'].includes(role)) throw new Error('Réservé à la Direction et au secrétariat.');
  const keep = role === 'DIRECTION' && entry?.status === 'A_VALIDER';
  return { ...entry, text, status: keep ? 'A_VALIDER' : 'BROUILLON', note: entry?.note ?? '' };
}
/**
 * Décision du conseil (encouragements, avertissement…) : saisie avec l'appréciation générale, validée avec
 * elle par la Direction ; même règle qu'un changement de texte.
 */
export function saveDecision(entry, decision, role) {
  if (!['DIRECTION', 'BUREAU'].includes(role)) throw new Error('Réservé à la Direction et au secrétariat.');
  const keep = role === 'DIRECTION' && entry?.status === 'A_VALIDER';
  return { ...entry, decision, status: keep ? 'A_VALIDER' : 'BROUILLON', note: entry?.note ?? '' };
}
/** Le secrétariat envoie à la Direction. */
export function submit(entry, role) {
  if (role !== 'BUREAU') throw new Error('Envoi réservé au secrétariat.');
  if (!entry?.text?.trim()) throw new Error('Appréciation vide.');
  return { ...entry, status: 'A_VALIDER' };
}
/** La Direction valide (éventuellement après correction). */
export function validate(entry, role, text = entry?.text) {
  if (role !== 'DIRECTION') throw new Error('Seule la Direction valide.');
  if (!text?.trim()) throw new Error('Appréciation vide.');
  return { ...entry, text, status: 'VALIDEE', note: '' };
}
/** La Direction renvoie au secrétariat avec une remarque. */
export function sendBack(entry, role, note) {
  if (role !== 'DIRECTION') throw new Error('Seule la Direction renvoie.');
  if (!note?.trim()) throw new Error('Remarque obligatoire.');
  return { ...entry, status: 'A_REVOIR', note };
}
export const onBulletin = (entry) => (entry?.status === 'VALIDEE' ? entry.text : '');
