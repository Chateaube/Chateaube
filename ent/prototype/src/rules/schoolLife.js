// Vie de l'école : même circuit que les annonces (rules/publication.js). Seule la Direction publie ;
// secrétariat, CPE, professeurs et élèves proposent leurs photos, que la Direction valide après avoir
// vérifié le droit à l'image (ou renvoie avec une remarque visible par l'auteur).
import { create, approve, sendBack, isPublic, canPublish } from './publication.js';

export const MAX_PHOTOS = 6;
export { canPublish };

export function postErrors(p) {
  const e = [];
  if (!p.title?.trim()) e.push('Donner un titre.');
  if (!p.photos?.length) e.push('Ajouter au moins une photo.');
  if (p.photos?.length > MAX_PHOTOS) e.push(`${MAX_PHOTOS} photos au plus.`);
  return e;
}

/** Nouvelle publication : publiée tout de suite par la Direction, sinon envoyée pour validation. */
export function newPost(p, { role, author, at }) {
  return { ...create('VIE_ECOLE', { ...p, authorDisplay: author }, { role, name: author, at }, { send: true }), id: `p${Date.now()}`, date: at.slice(0, 10), author };
}

export function moderate(post, { role, by, approve: ok, reason, imageRightsChecked, at = new Date().toISOString().slice(0, 16) }) {
  const actor = { role, name: by, at };
  return ok ? approve(post, actor, { checks: { imageRights: imageRightsChecked } }) : sendBack(post, actor, reason);
}

/** Ce que voit chacun : le publié ; l'auteur, ses propositions ; la Direction, celles à valider. */
export function visiblePosts(posts, { role, author }) {
  return posts.filter((p) => isPublic(p) || p.author === author || (canPublish(role) && p.status === 'EN_ATTENTE'))
    .sort((a, b) => b.date.localeCompare(a.date));
}

/** Élèves d'une classe sans autorisation de droit à l'image (rappel au moment de valider). */
export const withoutImageRights = (profiles, cls) => profiles.filter((p) => p.cls === cls && !p.authorizations?.image).map((p) => `${p.lastName} ${p.firstName}`);
