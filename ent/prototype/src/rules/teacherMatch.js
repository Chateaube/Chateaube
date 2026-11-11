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
  const { last, first } = splitName(line);
  const names = [...new Set(list.map((a) => a.name))];
  for (const n of names) {
    const civ = /^mme/i.test(n) ? 'Madame' : 'Monsieur';
    const key = fold(n.replace(/^(m\.|mme|mlle)\s*/i, ''));
    const firstWords = first.split(/\s+/);
    const byFirst = firstWords.find((w) => fold(w) === key);
    if (byFirst || fold(last) === key) {
      const services = list.filter((a) => a.name === n).flatMap((a) => (a.subjects ?? []).map((s) => ({ subject: s, classes: a.classes ?? [], hours: '' })));
      return { teacher: n, civility: civ, last, first, usual: byFirst ?? firstWords[0], services };
    }
  }
  return { teacher: null, last, first, usual: first.split(/\s+/)[0] ?? '', services: [] };
}

