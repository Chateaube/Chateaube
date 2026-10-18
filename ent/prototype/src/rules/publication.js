// Circuit de publication commun aux annonces et à « Vie de l'école ».
// Seule la Direction publie. Les autres rédigent (brouillon), envoient pour validation ; la Direction
// corrige si besoin puis publie, ou renvoie avec une remarque. Chaque étape est tracée (qui, quand, quoi).
//
//   BROUILLON ──envoyer──▶ EN_ATTENTE ──publier (± corrections)──▶ PUBLIEE ──retirer──▶ RETIREE
//        ▲                     │
//        └──── A_REVOIR ◀──renvoyer (remarque)
//
// Élèves mandatés (délégués, BDE) : une relecture de la CPE avant la Direction.
//   BROUILLON ──envoyer──▶ A_RELIRE ──CPE : transmettre──▶ EN_ATTENTE ──Direction──▶ PUBLIEE
//                              └──CPE : renvoyer (remarque)──▶ A_REVOIR
// Exception : l'annulation d'un cours LE JOUR MÊME, par le secrétariat ou la CPE, part tout de suite
// (la Direction en est informée) — attendre la validation ferait venir les élèves pour rien.
//
// Les destinataires ne voient jamais que des publications PUBLIEE.

export const STATUS = {
  BROUILLON: ['slate', 'brouillon'],
  A_RELIRE: ['amber', 'en relecture par la CPE'],
  EN_ATTENTE: ['amber', 'en attente de la Direction'],
  A_REVOIR: ['red', 'à revoir'],
  PUBLIEE: ['green', 'publiée'],
  RETIREE: ['slate', 'retirée'],
};

/** Qui peut rédiger quoi. Les enseignants n'ont aucun accès à la rédaction d'annonces. */
// DELEGUE et BDE : élèves agissant au titre de leur mandat (rules/mandates.js).
export const AUTHORS = {
  ANNONCE: ['DIRECTION', 'BUREAU', 'VIE_SCOLAIRE', 'DELEGUE', 'BDE'],
  VIE_ECOLE: ['DIRECTION', 'BUREAU', 'VIE_SCOLAIRE', 'ENSEIGNANT', 'ELEVE', 'BDE'],
  EVENEMENT: ['DIRECTION', 'BUREAU', 'VIE_SCOLAIRE', 'BDE'],
};
export const PUBLISHER = 'DIRECTION';
export const STUDENT_AUTHORS = ['DELEGUE', 'BDE']; // relus par la CPE avant la Direction
export const REVIEWER = 'VIE_SCOLAIRE';
const firstStop = (role) => (STUDENT_AUTHORS.includes(role) ? 'A_RELIRE' : 'EN_ATTENTE');
/** Annulation d'un cours le jour même : seule publication directe hors Direction (secrétariat, CPE). */
export const SAME_DAY_AUTHORS = ['BUREAU', 'VIE_SCOLAIRE'];
export const isSameDayCancellation = (content, at) => content.urgent === 'ANNULATION_JOUR' && !!content.date && content.date === at?.slice(0, 10);
export const canWrite = (kind, role) => AUTHORS[kind].includes(role);
export const canPublish = (role) => role === PUBLISHER;
export const isPublic = (p) => (p.status ?? 'PUBLIEE') === 'PUBLIEE'; // anciennes données sans statut : publiées

/** Service affiché au public (jamais le nom d'un membre du personnel). */
export const SERVICE = { DIRECTION: 'Direction', BUREAU: 'Secrétariat', VIE_SCOLAIRE: 'Vie scolaire (CPE)', ENSEIGNANT: 'Équipe pédagogique', ELEVE: 'Élèves', DELEGUE: 'Délégués de classe', BDE: 'Bureau des élèves (BDE)' };

const step = (p, actor, action, note) => ({ ...p, history: [...(p.history ?? []), { at: actor.at, by: actor.name, role: actor.role, action, ...(note ? { note } : {}) }] });

/** Création : publiée d'emblée si la Direction l'écrit et le demande ; sinon brouillon ou envoyée. */
export function create(kind, content, actor, { send = false } = {}) {
  if (!canWrite(kind, actor.role)) throw new Error(kind === 'ANNONCE' ? 'Les annonces sont rédigées par la Direction, le secrétariat, la CPE, les délégués ou le BDE.' : 'Vous ne pouvez pas proposer de publication.');
  const base = { ...content, kind, authorRole: actor.role, authorName: actor.name, service: content.service ?? SERVICE[actor.role], createdAt: actor.at, history: [] };
  const created = step(base, actor, 'CREEE');
  if (canPublish(actor.role) && send) return step({ ...created, status: 'PUBLIEE', publishedAt: actor.at, validatedBy: actor.name }, actor, 'PUBLIEE');
  if (send && kind === 'ANNONCE' && SAME_DAY_AUTHORS.includes(actor.role) && isSameDayCancellation(content, actor.at)) {
    return step({ ...created, status: 'PUBLIEE', publishedAt: actor.at, validatedBy: null, direct: true }, actor, 'PUBLIEE', 'annulation du jour, sans attendre la Direction');
  }
  if (content.urgent && !canPublish(actor.role) && !SAME_DAY_AUTHORS.includes(actor.role)) throw new Error('L\'annulation d\'un cours le jour même est réservée au secrétariat et à la CPE.');
  return send ? step({ ...created, status: firstStop(actor.role) }, actor, 'ENVOYEE') : { ...created, status: 'BROUILLON' };
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
  return step({ ...p, status: firstStop(p.authorRole), note: '' }, actor, 'ENVOYEE');
}

/** Relecture de la CPE (propositions des élèves mandatés) : transmettre à la Direction ou renvoyer à l'élève. */
export function forward(p, actor) {
  if (actor.role !== REVIEWER) throw new Error('La relecture des propositions d\'élèves est faite par la CPE.');
  if (p.status !== 'A_RELIRE') throw new Error('Rien à relire.');
  return step({ ...p, status: 'EN_ATTENTE', reviewedBy: actor.name }, actor, 'RELUE');
}
export function cpeSendBack(p, actor, note) {
  if (actor.role !== REVIEWER) throw new Error('La relecture des propositions d\'élèves est faite par la CPE.');
  if (p.status !== 'A_RELIRE') throw new Error('Rien à relire.');
  if (!note?.trim()) throw new Error('Expliquez ce qu\'il faut revoir.');
  return step({ ...p, status: 'A_REVOIR', note: note.trim() }, actor, 'RENVOYEE', note.trim());
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
  if (p.direct) return `${p.service ?? SERVICE[role]} · annulation du jour`;
  if (role === 'ELEVE' || role === 'ENSEIGNANT') return `Proposée par ${p.authorDisplay ?? SERVICE[role]} · publiée par la Direction`;
  return `${p.service ?? SERVICE[role]} · validée par la Direction`;
}

/** Trace complète pour l'équipe : « Rédigée par Mme Hanta (Secrétariat) le 12/10, corrigée et publiée par la Direction le 13/10. » */
export function trail(p) {
  const fr = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '');
  const created = (p.history ?? []).find((h) => h.action === 'CREEE');
  const parts = [`Rédigée par ${p.authorName ?? p.author} (${p.service ?? SERVICE[p.authorRole] ?? ''}) le ${fr(created?.at ?? p.createdAt ?? p.at)}`];
  if (p.reviewedBy) parts.push(`relue par ${p.reviewedBy} (CPE)`);
  if (p.editedByDirection) parts.push('corrigée par la Direction');
  if (p.status === 'PUBLIEE') parts.push(p.direct ? `publiée directement le ${fr(p.publishedAt)} (annulation du jour)` : `publiée par ${p.validatedBy ?? 'la Direction'} le ${fr(p.publishedAt ?? p.at)}`);
  return `${parts.join(', ')}.`;
}

/** Ce que voit chacun dans l'écran de travail : la Direction tout ; un auteur ses propres textes + les publiés. */
export const workView = (list, actor) => list.filter((p) => actor.role === PUBLISHER || p.authorName === actor.name || isPublic(p));
