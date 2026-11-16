// « Envoi des classes » : ce que la Direction publie pour les professeurs, à partir de son import (élèves) et
// des fiches des agents (matières × classes de chaque professeur). Seuls les noms des élèves, leur classe et
// leurs spécialités partent : aucune autre donnée personnelle.
import { fetchDoc, fetchDocs, saveDoc } from './docs.js';
import { setRemoteImport, currentStudents } from '../importStore.js';

const fold = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** Données publiées : élèves (nom, prénom, classe, spécialités) et services par compte professeur. */
export function buildRoster({ students = [], fiches = {}, teachers = [] }) {
  const services = {}; const names = {}; const firsts = {}; const warnings = [];
  const classes = new Set(students.map((s) => s.cls));
  teachers.forEach((t) => {
    names[t.id] = t.name;
    if (t.first) firsts[t.id] = t.first; // prénom (bulletin)
    const list = (fiches[t.id]?.services ?? []).filter((s) => s.subject && s.classes?.length).map((s) => ({ subject: s.subject, classes: [...s.classes] }));
    services[t.id] = list;
    if (!list.length) warnings.push(`${t.name} : aucune matière ni classe sur sa fiche`);
    list.forEach((s) => s.classes.filter((c) => !classes.has(c)).forEach((c) => warnings.push(`${t.name} : la classe « ${c} » n'a aucun élève dans l'import`)));
  });
  return {
    students: students.filter((s) => s.cls && s.lastName).map((s) => ({ cls: s.cls, lastName: s.lastName, firstName: s.firstName ?? '', usualName: s.usualName ?? '', specialties: s.specialties ?? [] })),
    services, names, firsts, warnings, sentAt: new Date().toISOString(),
  };
}

// Spécialité de la voie générale : seuls les élèves qui l'ont choisie (ceux sans choix connu restent dans la liste)
const SPECIALTY = [[/math/, 'MATHS'], [/physique/, 'PC'], [/svt|vie et de la terre/, 'SVT']];
export function specialtyOf(subject, cls) {
  const f = fold(subject);
  if (!/generale/.test(fold(cls)) || !/specialite|^spe\b/.test(f)) return null;
  return SPECIALTY.find(([re]) => re.test(f))?.[1] ?? null;
}

/** Services d'un professeur (classe × matière) avec leurs élèves. */
export function servicesFor(roster, accountId) {
  const byClass = {};
  (roster?.students ?? []).forEach((s) => (byClass[s.cls] ??= []).push(s));
  return (roster?.services?.[accountId] ?? []).flatMap((s) => s.classes.map((cls) => {
    // classe confiée à un seul professeur par la Direction (même matière chez deux professeurs) : masquée chez l'autre
    const owner = ownerOf(roster, `${cls}|${s.subject}`);
    if (owner && owner !== accountId) return null;
    const spe = specialtyOf(s.subject, cls);
    const students = (byClass[cls] ?? []).filter((st) => !spe || !st.specialties?.length || st.specialties.includes(spe))
      .map((st) => `${st.lastName} ${st.firstName}`.trim()).sort((a, b) => a.localeCompare(b, 'fr'));
    // matière partagée (ES, MSGN, Espagnol…) : un autre professeur a la même matière dans la même classe
    const others = Object.entries(roster?.services ?? {}).filter(([id, list]) => id !== accountId && list.some((o) => o.subject === s.subject && o.classes.includes(cls))).map(([id]) => roster?.names?.[id] ?? '');
    // seul l'Enseignement scientifique se partage (50/50, 2 notes chacun) ; ailleurs, deux professeurs = à corriger
    // matière partagée (ES) : un seul professeur écrit l'appréciation (roster.writers), l'autre n'en écrit pas
    const writer = writerOf(roster, `${cls}|${s.subject}`);
    const extra = !others.length || owner === accountId ? {} : isShareable(s.subject)
      ? { shared: true, coTeachers: others, minEvaluations: SHARED_MIN, ...(writer ? { writer, noAppreciation: writer !== accountId, writerName: roster?.names?.[writer] ?? '' } : {}) }
      : { conflict: others };
    return { id: `${cls}|${s.subject}`, cls, subject: s.subject, students, ...extra };
  })).filter(Boolean);
}

/**
 * Classes en commun : la Direction peut choisir (roster.owners / roster.writers) ; sinon le premier professeur qui a
 * commencé (fiche « prise:<id> », roster.claims) — notes pour une classe en commun, appréciation pour l'ES.
 */
const firstClaim = (roster, key, kind) => Object.entries(roster?.claims ?? {})
  .filter(([, v]) => v?.[key]?.kind === kind).sort(([, a], [, b]) => String(a[key].at).localeCompare(String(b[key].at)))[0]?.[0] ?? null;
export const ownerOf = (roster, key) => roster?.owners?.[key] ?? firstClaim(roster, key, 'NOTES');
export const writerOf = (roster, key) => roster?.writers?.[key] ?? firstClaim(roster, key, 'APP');
/** Classes que ce professeur avait et qu'un collègue a prises (notes) : pour le prévenir. */
export function takenFrom(roster, accountId) {
  return (roster?.services?.[accountId] ?? []).flatMap((s) => s.classes.map((cls) => ({ cls, subject: s.subject, by: ownerOf(roster, `${cls}|${s.subject}`) })))
    .filter((x) => x.by && x.by !== accountId).map((x) => ({ ...x, byName: roster?.names?.[x.by] ?? '' }));
}
/** Le professeur commence la saisie d'une classe en commun : sa fiche « prise » est mise à jour (premier arrivé). */
export function claimClass(accountId, key, kind) {
  if (!current || !accountId) return;
  const mine = current.claims?.[accountId] ?? {};
  if (mine[key]) return;
  const next = { ...mine, [key]: { kind, at: new Date().toISOString() } };
  current = { ...current, claims: { ...(current.claims ?? {}), [accountId]: next } };
  saveDoc(`prise:${accountId}`, 'PRISE', accountId, next, { delay: 0 });
}
/** La liste envoyée aux professeurs, avec les fiches « prise » de chacun (classes en commun). */
export async function fetchRoster() {
  const [doc, claims] = await Promise.all([fetchDoc('roster'), fetchDocs('PRISE').catch(() => [])]);
  return doc ? { ...doc, value: { ...doc.value, claims: Object.fromEntries(claims.map((c) => [c.owner, c.value])) } } : null;
}

/** Matière partagée entre deux professeurs : une seule ligne au bulletin, 2 notes minimum pour chacun. */
export const SHARED_MIN = 2;
/** Matières qui peuvent avoir deux professeurs dans une classe : l'Enseignement scientifique seulement. */
export const isShareable = (subject) => /enseignement scientifique/i.test(String(subject ?? '').normalize('NFD').replace(/[̀-ͯ]/g, ''));

let current = null;
let nameMap = null;
/**
 * Nom court d'un élève dans les écrans de saisie : initiale du nom + prénom d'usage (« R. Tsiry »), pour gagner
 * de la place. Le nom complet reste la clé des notes et apparaît au survol.
 */
export function shortName(full) {
  if (!nameMap) { nameMap = new Map(); (current?.students ?? currentStudents()).forEach((s) => nameMap.set(`${s.lastName} ${s.firstName}`.trim(), s)); }
  const s = nameMap.get(full);
  if (s) return `${s.lastName.charAt(0)}. ${s.usualName?.trim() || (s.firstName ?? '').split(/\s+/)[0] || s.lastName}`;
  const words = String(full ?? '').split(/\s+/); const caps = []; while (words.length > 1 && words[0] === words[0].toUpperCase()) caps.push(words.shift());
  return caps.length && words.length ? `${caps[0].charAt(0)}. ${words[0]}` : full;
}
export const currentRoster = () => current;
/** Direction : utilise la liste envoyée sans remplacer son propre import (saisie à la place d'un professeur). */
export const setCurrentRoster = (r) => { current = r; nameMap = null; };

/** Au démarrage (personnel hors Direction) : charge la liste publiée et la rend disponible aux écrans. */
export async function loadRoster() {
  const doc = await fetchRoster();
  current = doc?.value ?? null; nameMap = null;
  if (current) setRemoteImport({ students: current.students, importedAt: current.sentAt });
  return current;
}
