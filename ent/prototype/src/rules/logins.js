// Identifiant de connexion, le même pour tous (personnel, élèves, parents) : les 2 premières lettres du nom de
// famille, un point, puis le premier prénom — « am.fatema » pour Fatema AMBININTSOA. En cas d'homonyme, on
// ajoute des lettres du nom (« amb.fatema », « ambi.fatema »…), puis un chiffre si le nom entier ne suffit pas.
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

/** Message de bienvenue par défaut, joint aux accès (modifiable par la Direction). */
export const DEFAULT_WELCOME = 'Bienvenue sur l\'ENT de l\'École Chateaubriand ! Vous y trouverez dès aujourd\'hui la saisie des notes ; les autres rubriques ouvriront petit à petit. Si quelque chose ne fonctionne pas ou vous pose question, n\'hésitez pas à nous le dire.';
/** Message des accès (e-mail ou WhatsApp) : bonjour + bienvenue + adresse, identifiant, code provisoire. */
export function accessMessage({ name, login, code, first }, url, welcome = DEFAULT_WELCOME) {
  const hello = first ? `Bonjour ${first},` : 'Bonjour,';
  return [hello, '', welcome.trim(), '', 'ENT Chateaubriand — vos accès', `Adresse : ${url}`, `Identifiant : ${login}`, `Code provisoire : ${code}`, '',
    'À la première connexion, choisissez votre propre code (8 caractères, lettres et chiffres). Ne le communiquez à personne.', '', 'Bien cordialement,', 'La Direction'].join('\n');
}
/** Lien « mailto: » : ouvre la messagerie avec l'e-mail déjà rédigé (rien ne part sans cliquer sur Envoyer). */
export const accessMailto = (to, message) => `mailto:${encodeURIComponent(to ?? '')}?subject=${encodeURIComponent('Vos accès à l\'ENT Chateaubriand')}&body=${encodeURIComponent(message)}`;
