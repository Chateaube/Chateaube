// « Envoi des classes » : ce que la Direction publie pour les professeurs, à partir de son import (élèves) et
// des fiches des agents (matières × classes de chaque professeur). Seuls les noms des élèves, leur classe et
// leurs spécialités partent : aucune autre donnée personnelle.
import { fetchDoc } from './docs.js';
import { setRemoteImport } from '../importStore.js';

const fold = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** Données publiées : élèves (nom, prénom, classe, spécialités) et services par compte professeur. */
export function buildRoster({ students = [], fiches = {}, teachers = [] }) {
  const services = {}; const names = {}; const warnings = [];
  const classes = new Set(students.map((s) => s.cls));
  teachers.forEach((t) => {
    names[t.id] = t.name;
    const list = (fiches[t.id]?.services ?? []).filter((s) => s.subject && s.classes?.length).map((s) => ({ subject: s.subject, classes: [...s.classes] }));
    services[t.id] = list;
    if (!list.length) warnings.push(`${t.name} : aucune matière ni classe sur sa fiche`);
    list.forEach((s) => s.classes.filter((c) => !classes.has(c)).forEach((c) => warnings.push(`${t.name} : la classe « ${c} » n'a aucun élève dans l'import`)));
  });
  return {
    students: students.filter((s) => s.cls && s.lastName).map((s) => ({ cls: s.cls, lastName: s.lastName, firstName: s.firstName ?? '', specialties: s.specialties ?? [] })),
    services, names, warnings, sentAt: new Date().toISOString(),
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
    const spe = specialtyOf(s.subject, cls);
    const students = (byClass[cls] ?? []).filter((st) => !spe || !st.specialties?.length || st.specialties.includes(spe))
      .map((st) => `${st.lastName} ${st.firstName}`.trim()).sort((a, b) => a.localeCompare(b, 'fr'));
    return { id: `${cls}|${s.subject}`, cls, subject: s.subject, students };
  }));
}

let current = null;
export const currentRoster = () => current;

/** Au démarrage (personnel hors Direction) : charge la liste publiée et la rend disponible aux écrans. */
export async function loadRoster() {
  const doc = await fetchDoc('roster');
  current = doc?.value ?? null;
  if (current) setRemoteImport({ students: current.students, importedAt: current.sentAt });
  return current;
}
