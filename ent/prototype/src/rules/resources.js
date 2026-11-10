// Documents et ressources de l'école, par public : élèves, parents, professeurs, personnel.
//  - documents de référence pour les familles (règlement intérieur / contrat de vie scolaire, charte
//    informatique et IA, usage des réseaux sociaux) : consultables librement ;
//  - ressources internes de l'équipe (règlement des professeurs, guide du cahier de textes, supports de
//    formation…) : consultation seulement, écran noir en cas de capture, ni téléchargement ni impression.
export const AUDIENCES = { ELEVES: 'Élèves', PARENTS: 'Parents', PROFS: 'Professeurs', PERSONNEL: 'Personnel (secrétariat, CPE)' };
const STAFF_ONLY = ['PROFS', 'PERSONNEL'];

/** Publics d'une ressource (les anciennes fiches n'avaient qu'un champ « audience »). */
export const forOf = (r) => r.for ?? (r.audience === 'PROFS' ? ['PROFS'] : ['PROFS', 'PERSONNEL']);
/** Réservée à l'équipe : protégée (consultation seulement). */
export const isProtected = (r) => forOf(r).every((a) => STAFF_ONLY.includes(a));

/** Ce que voit une personne : élève, parent, professeur ; la Direction, le secrétariat et la CPE voient tout. */
export function visibleFor(list, viewer) {
  if (['DIRECTION', 'BUREAU', 'VIE_SCOLAIRE'].includes(viewer)) return list;
  const key = { ELEVE: 'ELEVES', PARENT: 'PARENTS', ENSEIGNANT: 'PROFS' }[viewer];
  return list.filter((r) => forOf(r).includes(key));
}

// Boîte à idées de l'équipe : une suggestion sur l'école, les ressources, la méthodologie…
export const SUGGESTION_CATEGORIES = { ECOLE: 'L\'école', RESSOURCES: 'Ressources et matériel', METHODOLOGIE: 'Méthodologie, pédagogie', VIE_SCOLAIRE: 'Vie scolaire', AUTRE: 'Autre' };
export const SUGGESTION_STATUS = { NOUVELLE: ['navy', 'nouvelle'], ETUDE: ['amber', 'à l\'étude'], RETENUE: ['green', 'retenue'], NON_RETENUE: ['slate', 'non retenue'] };
export function suggestionErrors(s) {
  const e = [];
  if (!SUGGESTION_CATEGORIES[s.category]) e.push('Choisir un thème.');
  if ((s.text ?? '').trim().length < 10) e.push('Décrire la suggestion (10 caractères au moins).');
  return e;
}
/** Réponse de la Direction : un statut, et un mot obligatoire si la suggestion n'est pas retenue. */
export function answerSuggestion(s, { role, status, answer }) {
  if (role !== 'DIRECTION') return { error: 'Seule la Direction répond aux suggestions.' };
  if (status === 'NON_RETENUE' && !answer?.trim()) return { error: 'Expliquer en un mot pourquoi elle n\'est pas retenue.' };
  return { suggestion: { ...s, status, answer: answer?.trim() ?? '' } };
}
