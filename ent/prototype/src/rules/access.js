// Droits d'accès réglés par la Direction (écran « Droits d'accès ») : pour chaque écran partagé, et pour
// chaque profil du personnel, trois niveaux — Aucun accès, Consulter, Modifier. Une personne peut avoir
// une exception (plus ou moins que son profil) : c'est son niveau d'accréditation.
// Ordre de priorité : exception de la personne → réglage du profil → menu d'origine du profil.
// La Direction garde toujours tout ; ses écrans propres (paramètres, agents, droits…) ne se délèguent pas.

export const LEVELS = { AUCUN: 'Aucun accès', LECTURE: 'Consulter', ECRITURE: 'Modifier' };
export const LEVEL_ORDER = ['AUCUN', 'LECTURE', 'ECRITURE'];
export const STAFF_PROFILES = { BUREAU: 'Secrétariat', VIE_SCOLAIRE: 'CPE', ENSEIGNANT: 'Enseignant' };
/** Écrans réservés à la Direction : jamais délégués. */
export const DIRECTION_ONLY = ['dashboard', 'settings', 'staff', 'access', 'mandates', 'feedback'];

/** Niveau d'un écran dans le menu d'origine d'un profil. */
export function baseLevel(baseNav, id) {
  const item = baseNav.flatMap((g) => g.items).find((i) => i.id === id);
  if (!item) return 'AUCUN';
  return item.readOnly ? 'LECTURE' : 'ECRITURE';
}

/** Niveau effectif : exception de la personne, sinon réglage du profil, sinon menu d'origine. */
export function levelFor({ profile, person, id, baseNav, access }) {
  if (profile === 'DIRECTION') return 'ECRITURE';
  if (DIRECTION_ONLY.includes(id)) return 'AUCUN';
  return access?.people?.[person]?.[id] ?? access?.profiles?.[profile]?.[id] ?? baseLevel(baseNav, id);
}

/**
 * Menu d'un profil après réglage : les écrans partagés (catalogue) suivent leur niveau effectif ; les écrans
 * propres au profil (accueil, appel, carnet de notes…) ne changent pas ; les écrans accordés en plus vont
 * dans un groupe « Accès accordés ».
 */
export function applyAccess({ profile, person, baseNav, catalogue, access }) {
  if (profile === 'DIRECTION') return baseNav;
  const shared = new Set(catalogue.map((c) => c.id));
  const lv = (id) => levelFor({ profile, person, id, baseNav, access });
  const nav = baseNav.map((g) => ({
    ...g,
    items: g.items.flatMap((it) => {
      if (!shared.has(it.id)) return [it];
      const l = lv(it.id);
      return l === 'AUCUN' ? [] : [{ ...it, readOnly: l === 'LECTURE' }];
    }),
  }));
  const present = new Set(baseNav.flatMap((g) => g.items.map((i) => i.id)));
  const extra = catalogue.filter((c) => !present.has(c.id) && lv(c.id) !== 'AUCUN').map((c) => ({ ...c, readOnly: lv(c.id) === 'LECTURE' }));
  if (extra.length) nav.push({ group: 'Accès accordés', items: extra });
  return nav.filter((g) => g.items.length);
}

/** Change un niveau (profil ou personne). Pour une personne, null retire l'exception. */
export function setLevel(access, { profile, person, id, level }) {
  if (DIRECTION_ONLY.includes(id)) return access;
  const a = { profiles: { ...(access?.profiles ?? {}) }, people: { ...(access?.people ?? {}) } };
  if (person) {
    const p = { ...(a.people[person] ?? {}) };
    if (level == null) delete p[id]; else p[id] = level;
    if (Object.keys(p).length) a.people[person] = p; else delete a.people[person];
  } else {
    a.profiles[profile] = { ...(a.profiles[profile] ?? {}), [id]: level };
  }
  return a;
}

/** Nombre d'exceptions d'une personne. */
export const exceptionsOf = (access, person) => Object.keys(access?.people?.[person] ?? {}).length;
