// Fiches signalétiques remplies en ligne et signatures des parents (prototype : stockées dans ce
// navigateur ; en production, en base, avec l'horodatage et le compte qui a signé).
const KEY = 'ent-fiche-v1';

const load = () => {
  try { return JSON.parse(localStorage.getItem(KEY)) ?? { references: {}, fiches: {} }; } catch { return { references: {}, fiches: {} }; }
};
const save = (data) => { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* stockage indisponible */ } };

/** Signature de référence d'un compte parent (déposée une fois, comparée ensuite). */
export const referenceOf = (account) => load().references[account] ?? null;
export function setReference(account, dataUrl) {
  const d = load();
  d.references[account] = { dataUrl, at: new Date().toISOString() };
  save(d);
}

/** Fiche d'un élève (clé : « NOM Prénom »). */
export const ficheOf = (student) => load().fiches[student] ?? null;
export function saveFiche(student, fiche) {
  const d = load();
  d.fiches[student] = fiche;
  save(d);
}
