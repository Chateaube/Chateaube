// Vie de l'école : la Direction, le secrétariat et la CPE publient directement ; les élèves et les
// professeurs proposent leurs photos, qui ne paraissent qu'après validation (Direction ou CPE).
// À la validation, on vérifie le droit à l'image des élèves reconnaissables (fiche signalétique).
export const PUBLISHERS = ['DIRECTION', 'BUREAU', 'VIE_SCOLAIRE'];
export const MODERATORS = ['DIRECTION', 'VIE_SCOLAIRE'];
export const MAX_PHOTOS = 6;

export function postErrors(p) {
  const e = [];
  if (!p.title?.trim()) e.push('Donner un titre.');
  if (!p.photos?.length) e.push('Ajouter au moins une photo.');
  if (p.photos?.length > MAX_PHOTOS) e.push(`${MAX_PHOTOS} photos au plus.`);
  return e;
}

/** Nouvelle publication : publiée tout de suite par l'équipe, sinon en attente de validation. */
export function newPost(p, { role, author, at }) {
  return { ...p, id: `p${Date.now()}`, date: at, author, authorRole: role, status: PUBLISHERS.includes(role) ? 'PUBLIE' : 'EN_ATTENTE' };
}

export function moderate(post, { role, by, approve, reason, imageRightsChecked }) {
  if (!MODERATORS.includes(role)) throw new Error('La validation revient à la Direction ou à la CPE.');
  if (approve && !imageRightsChecked) throw new Error('Vérifier le droit à l\'image des élèves reconnaissables.');
  if (!approve && !reason?.trim()) throw new Error('Expliquer le refus à l\'auteur.');
  return { ...post, status: approve ? 'PUBLIE' : 'REFUSE', moderatedBy: by, reason: approve ? '' : reason.trim() };
}

/** Ce que voit chacun : tout ce qui est publié ; l'auteur voit aussi ses propositions ; l'équipe, les attentes. */
export function visiblePosts(posts, { role, author }) {
  return posts.filter((p) => p.status === 'PUBLIE' || p.author === author || (MODERATORS.includes(role) && p.status === 'EN_ATTENTE'))
    .sort((a, b) => b.date.localeCompare(a.date));
}

/** Élèves d'une classe sans autorisation de droit à l'image (rappel au moment de valider). */
export const withoutImageRights = (profiles, cls) => profiles.filter((p) => p.cls === cls && !p.authorizations?.image).map((p) => `${p.lastName} ${p.firstName}`);
