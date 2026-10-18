// Circuit de publication commun aux annonces et à « Vie de l'école ».
// Seule la Direction publie. Les autres rédigent (brouillon), envoient pour validation ; la Direction
// corrige si besoin puis publie, ou renvoie avec une remarque. Chaque étape est tracée (qui, quand, quoi).
//
//   BROUILLON ──envoyer──▶ EN_ATTENTE ──publier (± corrections)──▶ PUBLIEE ──retirer──▶ RETIREE
//        ▲                     │
//        └──── A_REVOIR ◀──renvoyer (remarque)
//
// Les destinataires ne voient jamais que des publications PUBLIEE.

export const STATUS = {
  BROUILLON: ['slate', 'brouillon'],
  EN_ATTENTE: ['amber', 'en attente de la Direction'],
  A_REVOIR: ['red', 'à revoir'],
  PUBLIEE: ['green', 'publiée'],
  RETIREE: ['slate', 'retirée'],
};

/** Qui peut rédiger quoi. Les enseignants n'ont aucun accès à la rédaction d'annonces. */
export const AUTHORS = {
  ANNONCE: ['DIRECTION', 'BUREAU', 'VIE_SCOLAIRE'],
  VIE_ECOLE: ['DIRECTION', 'BUREAU', 'VIE_SCOLAIRE', 'ENSEIGNANT', 'ELEVE'],
};
export const PUBLISHER = 'DIRECTION';
export const canWrite = (kind, role) => AUTHORS[kind].includes(role);
export const canPublish = (role) => role === PUBLISHER;
export const isPublic = (p) => (p.status ?? 'PUBLIEE') === 'PUBLIEE'; // anciennes données sans statut : publiées

/** Service affiché au public (jamais le nom d'un membre du personnel). */
export const SERVICE = { DIRECTION: 'Direction', BUREAU: 'Secrétariat', VIE_SCOLAIRE: 'Vie scolaire (CPE)', ENSEIGNANT: 'Équipe pédagogique', ELEVE: 'Élèves' };

const step = (p, actor, action, note) => ({ ...p, history: [...(p.history ?? []), { at: actor.at, by: actor.name, role: actor.role, action, ...(note ? { note } : {}) }] });

/** Création : publiée d'emblée si la Direction l'écrit et le demande ; sinon brouillon ou envoyée. */
export function create(kind, content, actor, { send = false } = {}) {
  if (!canWrite(kind, actor.role)) throw new Error(kind === 'ANNONCE' ? 'Les annonces sont rédigées par la Direction, le secrétariat ou la CPE.' : 'Vous ne pouvez pas proposer de publication.');
  const base = { ...content, kind, authorRole: actor.role, authorName: actor.name, service: SERVICE[actor.role], createdAt: actor.at, history: [] };
  const created = step(base, actor, 'CREEE');
  if (canPublish(actor.role) && send) return step({ ...created, status: 'PUBLIEE', publishedAt: actor.at, validatedBy: actor.name }, actor, 'PUBLIEE');
  return send ? step({ ...created, status: 'EN_ATTENTE' }, actor, 'ENVOYEE') : { ...created, status: 'BROUILLON' };
}

/** L'auteur modifie son brouillon ou une publication renvoyée ; il ne touche plus à ce qui est envoyé ou publié. */
export function edit(p, patch, actor) {
  if (actor.role === PUBLISHER) return step({ ...p, ...patch, editedByDirection: p.authorRole !== PUBLISHER || p.editedByDirection }, actor, 'CORRIGEE');
  if (p.authorName !== actor.name) throw new Error('Seul l\'auteur modifie sa proposition.');
  if (!['BROUILLON', 'A_REVOIR'].includes(p.status)) throw new Error('Déjà envoyée à la Direction : attendez sa réponse.');
  return { ...p, ...patch };
}

export function submit(p, actor) {
  if (p.authorName !== actor.name) throw new Error('Seul l\'auteur envoie sa proposition.');
  if (!['BROUILLON', 'A_REVOIR'].includes(p.status)) throw new Error('Déjà envoyée.');
  return step({ ...p, status: 'EN_ATTENTE', note: '' }, actor, 'ENVOYEE');
}

/** La Direction publie (avec ses éventuelles corrections). `checks` : contrôles obligatoires (droit à l'image…). */
export function approve(p, actor, { patch = null, checks = {} } = {}) {
  if (!canPublish(actor.role)) throw new Error('Seule la Direction publie.');
  if (p.status !== 'EN_ATTENTE') throw new Error('Rien à valider.');
  if (p.kind === 'VIE_ECOLE' && !checks.imageRights) throw new Error('Vérifier le droit à l\'image des élèves reconnaissables.');
  const corrected = patch && Object.keys(patch).some((k) => patch[k] !== p[k]);
  let out = p;
  if (corrected) out = step({ ...out, ...patch, editedByDirection: true }, actor, 'CORRIGEE');
  return step({ ...out, status: 'PUBLIEE', publishedAt: actor.at, validatedBy: actor.name, note: '' }, actor, 'PUBLIEE');
}

export function sendBack(p, actor, note) {
  if (!canPublish(actor.role)) throw new Error('Seule la Direction renvoie.');
  if (!note?.trim()) throw new Error('Expliquez ce qu\'il faut revoir.');
  return step({ ...p, status: 'A_REVOIR', note: note.trim() }, actor, 'RENVOYEE', note.trim());
}

export function withdraw(p, actor) {
  if (!canPublish(actor.role)) throw new Error('Seule la Direction retire une publication.');
  return step({ ...p, status: 'RETIREE' }, actor, 'RETIREE');
}

/**
 * Signature publique : le service qui a rédigé et la validation de la Direction.
 * « Direction » ; « Secrétariat · validée par la Direction » ; « Proposée par Aina (1re STMG) · publiée par la Direction ».
 */
export function signature(p) {
  const role = p.authorRole ?? (p.author === 'Direction' ? 'DIRECTION' : null);
  if (!role || role === PUBLISHER) return p.service ?? p.author ?? 'Direction';
  if (role === 'ELEVE' || role === 'ENSEIGNANT') return `Proposée par ${p.authorDisplay ?? SERVICE[role]} · publiée par la Direction`;
  return `${SERVICE[role]} · validée par la Direction`;
}

/** Trace complète pour l'équipe : « Rédigée par Mme Hanta (Secrétariat) le 12/10, corrigée et publiée par la Direction le 13/10. » */
export function trail(p) {
  const fr = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '');
  const created = (p.history ?? []).find((h) => h.action === 'CREEE');
  const parts = [`Rédigée par ${p.authorName ?? p.author} (${SERVICE[p.authorRole] ?? p.service ?? ''}) le ${fr(created?.at ?? p.createdAt ?? p.at)}`];
  if (p.editedByDirection) parts.push('corrigée par la Direction');
  if (p.status === 'PUBLIEE') parts.push(`publiée par ${p.validatedBy ?? 'la Direction'} le ${fr(p.publishedAt ?? p.at)}`);
  return `${parts.join(', ')}.`;
}

/** Ce que voit chacun dans l'écran de travail : la Direction tout ; un auteur ses propres textes + les publiés. */
export const workView = (list, actor) => list.filter((p) => actor.role === PUBLISHER || p.authorName === actor.name || isPublic(p));
