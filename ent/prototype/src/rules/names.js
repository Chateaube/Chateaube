// Prénom d'usage : un élève qui a plusieurs prénoms est appelé par l'un d'eux (choisi dans la fiche).
// Les grilles de notes n'affichent que ce prénom ; deux élèves du même prénom sont distingués
// par l'initiale du nom.

/** Prénoms séparés (« Ny Aina » reste un seul prénom s'il est écrit avec un tiret : « Ny-Aina »). */
export const firstNames = (firstName = '') => firstName.split(/\s+/).filter(Boolean);

/** Prénom d'usage d'une fiche : celui choisi, sinon le premier. */
export const usualFirstName = (p) => p?.usualName?.trim() || firstNames(p?.firstName)[0] || '';

/** « NOM Prénom(s) » → { last, first } : le nom est la partie en capitales. */
export function splitFullName(full = '') {
  const words = full.trim().split(/\s+/);
  const isUpper = (w) => w === w.toUpperCase() && /[A-Z]/.test(w);
  const i = words.findIndex((w) => !isUpper(w));
  if (i <= 0) return { last: words[0] ?? '', first: words.slice(1).join(' ') };
  return { last: words.slice(0, i).join(' '), first: words.slice(i).join(' ') };
}

/**
 * Noms courts pour une liste d'élèves (« NOM Prénom(s) ») : prénom d'usage de la fiche quand elle
 * existe, sinon premier prénom ; initiale du nom ajoutée en cas de doublon. Renvoie une Map nom → court.
 */
export function shortNames(fullNames, profiles = []) {
  const byKey = new Map(profiles.map((p) => [`${p.lastName} ${p.firstName}`, p]));
  const base = fullNames.map((n) => {
    const p = byKey.get(n);
    const { last, first } = splitFullName(n);
    return { n, first: p ? usualFirstName(p) : firstNames(first)[0] ?? n, last };
  });
  const count = base.reduce((m, b) => m.set(b.first.toLowerCase(), (m.get(b.first.toLowerCase()) ?? 0) + 1), new Map());
  return new Map(base.map((b) => [b.n, count.get(b.first.toLowerCase()) > 1 ? `${b.first} ${b.last.charAt(0)}.` : b.first]));
}
