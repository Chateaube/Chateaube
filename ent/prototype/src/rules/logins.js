// Identifiant de connexion, le même pour tous (personnel, élèves, parents) : les 2 premières lettres du nom de
// famille, un point, puis le premier prénom — « am.fara » pour Fara AMBOARA. En cas d'homonyme, on
// ajoute des lettres du nom (« amb.fara », « ambi.fara »…), puis un chiffre si le nom entier ne suffit pas.
// Pas d'adresse e-mail ni de compte Google : l'e-mail ne sert qu'en cas de code oublié.
const letters = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '');
const CIVILITY = /^(m|mme|mlle|mr|mrs|monsieur|madame|mademoiselle)\.?$/i;

/** Identifiant libre pour « prénom », « nom » ; `taken` : identifiants déjà attribués (Set). */
export function loginFor(first, last, taken = new Set(), usual = '') {
  // prénom d'usage en entier (« Ny Soa » → nysoa), sinon le premier prénom
  const f = letters(String(usual ?? '').trim()) || letters(String(first ?? '').trim().split(/\s+/)[0]) || 'x';
  const l = letters(last) || 'x';
  for (let n = Math.min(2, l.length); n <= l.length; n += 1) {
    const c = `${l.slice(0, n)}.${f}`;
    if (!taken.has(c)) return c;
  }
  for (let i = 2; ; i += 1) if (!taken.has(`${l}.${f}${i}`)) return `${l}.${f}${i}`;
}

/** Nom d'un responsable « Mme RAKOTO Voahangy » → { last: 'RAKOTO', first: 'Voahangy' } (ou ses champs séparés). */
export function splitGuardianName(g) {
  if (g.lastName || g.firstName) return { last: g.lastName ?? '', first: g.firstName ?? '' };
  const words = String(g.name ?? '').trim().split(/\s+/).filter((w) => !CIVILITY.test(w));
  return { last: words[0] ?? '', first: words.slice(1).join(' ') || words[0] || '' };
}

/** Messages de bienvenue par défaut, joints aux accès, selon le profil (modifiables par la Direction). */
export const WELCOMES = {
  PROFESSEUR: 'Bienvenue sur l\'ENT de l\'École Chateaubriand ! Vous y trouverez dès aujourd\'hui la saisie des notes ; les autres rubriques ouvriront petit à petit. Si quelque chose ne fonctionne pas ou vous pose question, n\'hésitez pas à nous le dire.',
  PERSONNEL: 'Bienvenue sur l\'ENT de l\'École Chateaubriand ! Vous y retrouverez les outils de votre poste ; les rubriques ouvriront petit à petit. Si quelque chose ne fonctionne pas ou vous pose question, n\'hésitez pas à nous le dire.',
  ELEVE: 'Bienvenue sur ton portail élève ! Tu y trouveras ton emploi du temps, l\'agenda de l\'école et ton orientation ; les autres rubriques ouvriront petit à petit. Si quelque chose ne fonctionne pas, parles-en à la Direction.',
  PARENT: 'Bienvenue sur le portail des familles de l\'École Chateaubriand ! Vous y suivrez la scolarité de votre enfant : notes, assiduité et documents de l\'école.',
};
export const DEFAULT_WELCOME = WELCOMES.PROFESSEUR;
/** Profil d'un compte pour le message : professeur, élève, parent, sinon personnel (Direction, secrétariat, CPE…). */
export const welcomeGroup = (roles = []) => (roles.includes('PROFESSEUR') ? 'PROFESSEUR' : roles.includes('ELEVE') ? 'ELEVE' : roles.includes('PARENT') ? 'PARENT' : 'PERSONNEL');
/** Message choisi pour ce profil : réglage de l'école (ancien format : un seul texte = professeurs), sinon par défaut. */
export function welcomeFor(stored, group) {
  if (typeof stored === 'string') return group === 'PROFESSEUR' ? stored : WELCOMES[group];
  return stored?.[group] || WELCOMES[group];
}
export const ACCESS_SUBJECT = 'ENT Chateaubriand — Première connexion';
/** Boîte de l'école : les accès partent de cette adresse (Gmail ouvert dans le navigateur, sur ce compte). */
export const SCHOOL_MAIL = 'chateaubetamatave@gmail.com';
/** Message des accès (e-mail ou WhatsApp) : bonjour + bienvenue + adresse, identifiant, code provisoire. */
export function accessMessage({ login, code, first }, url, welcome = DEFAULT_WELCOME) {
  const hello = first ? `Bonjour ${first},` : 'Bonjour,';
  return [hello, '', welcome.trim(), '', 'ENT Chateaubriand — vos accès', `Adresse : ${url}`, `Identifiant : ${login}`, `Code provisoire : ${code}`, '',
    'À la première connexion, choisissez votre propre code (8 caractères, lettres et chiffres). Ne le communiquez à personne.', '', 'Bien cordialement,', 'La Direction'].join('\n');
}
/** Lien « mailto: » (messagerie de l'ordinateur). */
export const accessMailto = (to, message) => `mailto:${encodeURIComponent(to ?? '')}?subject=${encodeURIComponent(ACCESS_SUBJECT)}&body=${encodeURIComponent(message)}`;
/** Gmail de l'école : nouvelle fenêtre de rédaction, déjà remplie, sur le compte de l'école (rien ne part sans Envoyer). */
export const accessGmail = (to, message) => `https://mail.google.com/mail/?authuser=${encodeURIComponent(SCHOOL_MAIL)}&view=cm&fs=1&to=${encodeURIComponent(to ?? '')}&su=${encodeURIComponent(ACCESS_SUBJECT)}&body=${encodeURIComponent(message)}`;
