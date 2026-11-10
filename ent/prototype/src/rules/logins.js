// Identifiant de connexion, le même pour tous (personnel, élèves, parents) : les 2 premières lettres du nom de
// famille, un point, puis le premier prénom — « am.fatema » pour Fatema AMBININTSOA. En cas d'homonyme, on
// ajoute des lettres du nom (« amb.fatema », « ambi.fatema »…), puis un chiffre si le nom entier ne suffit pas.
// Pas d'adresse e-mail ni de compte Google : l'e-mail ne sert qu'en cas de code oublié.
const letters = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '');
const CIVILITY = /^(m|mme|mlle|mr|mrs|monsieur|madame|mademoiselle)\.?$/i;

/** Identifiant libre pour « prénom », « nom » ; `taken` : identifiants déjà attribués (Set). */
export function loginFor(first, last, taken = new Set()) {
  const f = letters(String(first ?? '').trim().split(/\s+/)[0]) || 'x';
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
