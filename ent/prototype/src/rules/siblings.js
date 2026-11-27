// Fratries : liens posés à la main entre élèves de l'école (jamais déduits du nom de famille : deux élèves
// du même nom ne sont pas forcément frères et sœurs). Données : [{ id, members: [idÉlève, …] }].

/** Identifiants des frères et sœurs liés à cet élève (sans lui-même). */
export const siblingIdsOf = (groups, id) => ((groups ?? []).find((g) => g.members.includes(id))?.members ?? []).filter((x) => x !== id);

/** Lie deux élèves : leurs fratries se rejoignent. */
export function linkSiblings(groups, a, b) {
  if (!a || !b || a === b) return groups ?? [];
  const list = groups ?? [];
  const ga = list.find((g) => g.members.includes(a)); const gb = list.find((g) => g.members.includes(b));
  if (ga && ga === gb) return list;
  const members = [...new Set([...(ga?.members ?? [a]), ...(gb?.members ?? [b])])];
  const id = ga?.id ?? gb?.id ?? `fr${a}`;
  return [...list.filter((g) => g !== ga && g !== gb), { id, members }];
}

/** Retire un élève de sa fratrie (une fratrie d'un seul élève disparaît). */
export function unlinkSibling(groups, id) {
  return (groups ?? []).map((g) => (g.members.includes(id) ? { ...g, members: g.members.filter((x) => x !== id) } : g)).filter((g) => g.members.length > 1);
}
