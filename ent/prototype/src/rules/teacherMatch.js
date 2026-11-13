import { sameSubject } from './timetableImport.js';
// Rapprochement d'une liste « NOM Prénoms » avec les professeurs de l'emploi du temps (création groupée des comptes).
const fold = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '');

/** « PIERRE Valentin Fortuna » → { last: 'PIERRE', first: 'Valentin Fortuna' } (nom en majuscules en tête). */
export function splitName(line) {
  const words = String(line).trim().split(/\s+/).filter(Boolean);
  const caps = []; while (words.length > 1 && words[0] === words[0].toUpperCase() && /[A-Z]/.test(words[0])) caps.push(words.shift());
  return caps.length ? { last: caps.join(' '), first: words.join(' ') } : { last: words.pop() ?? '', first: words.join(' ') };
}

/** Rapproche une ligne d'un professeur de l'emploi du temps ; renvoie le prénom d'usage et les services. */
export function matchTeacher(line, list) {
  // « (Mme Lanto) » en fin de ligne : nom de l'emploi du temps donné explicitement
  const hint = /\(([^)]+)\)\s*$/.exec(line)?.[1]?.trim();
  const { last, first } = splitName(String(line).replace(/\([^)]*\)\s*$/, ''));
  if (hint) {
    const n = [...new Set(list.map((a) => a.name))].find((x) => fold(x) === fold(hint) || fold(x.replace(/^(m\.|mme|mlle)\s*/i, '')) === fold(hint.replace(/^(m\.|mme|mlle)\s*/i, '')));
    if (n) {
      const usual = n.replace(/^(m\.|mme|mlle)\s*/i, '');
      const services = list.filter((a) => a.name === n).flatMap((a) => (a.subjects ?? []).map((s) => ({ subject: s, classes: a.classes ?? [], hours: '' })));
      return { teacher: n, civility: /^mme/i.test(n) ? 'Madame' : 'Monsieur', last, first, usual, services };
    }
  }
  const names = [...new Set(list.map((a) => a.name))];
  for (const n of names) {
    const civ = /^mme/i.test(n) ? 'Madame' : 'Monsieur';
    const key = fold(n.replace(/^(m\.|mme|mlle)\s*/i, ''));
    const firstWords = first.split(/\s+/);
    const byFirst = firstWords.find((w) => fold(w) === key) ?? (key.length >= 4 ? firstWords.find((w) => fold(w).startsWith(key)) && key.replace(/^./, (c) => c.toUpperCase()) && n.replace(/^(m\.|mme|mlle)\s*/i, '') : undefined);
    if (byFirst || fold(last) === key) {
      const services = list.filter((a) => a.name === n).flatMap((a) => (a.subjects ?? []).map((s) => ({ subject: s, classes: a.classes ?? [], hours: '' })));
      return { teacher: n, civility: civ, last, first, usual: byFirst ?? firstWords[0], services };
    }
  }
  return { teacher: null, last, first, usual: first.split(/\s+/)[0] ?? '', services: [] };
}


/**
 * Classes de chaque matière : celles de l'emploi du temps quand la matière y figure pour ce professeur
 * (évite « SGN en Terminale » quand la ligne de l'onglet 3 regroupe 1re et Terminale) ; sinon (matière faite
 * pendant les heures d'une autre, comme la Mercatique pendant le MSGN) toutes les classes de la ligne.
 */
export function refineByTimetable(services, teacher, slots = []) {
  const mine = slots.filter((s) => s.teacherId === teacher);
  return services.map((sv) => {
    const inEdt = [...new Set(mine.filter((s) => sameSubject(s.subject, sv.subject)).map((s) => s.cls))];
    return inEdt.length ? { ...sv, classes: sv.classes.filter((c) => inEdt.includes(c)).length ? sv.classes.filter((c) => inEdt.includes(c)) : inEdt } : sv;
  });
}
