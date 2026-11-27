// Codes INE (identifiant national élève) des candidats aux examens : liste collée depuis le site des inscriptions
// (une ligne par candidat : INE, « 002 Version 01 », NOM, Prénoms, date de naissance, classe, état, série…).
// La mention de version est ignorée. Chaque INE est rattaché à l'élève dont la date de naissance est la même et
// dont le nom OU les prénoms correspondent (un nom de famille peut avoir changé d'une liste à l'autre).

const fold = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
const iso = (d) => { const m = String(d).match(/^(\d{2})\/(\d{2})\/(\d{4})$/); return m ? `${m[3]}-${m[2]}-${m[1]}` : ''; };

/** Lignes de la liste collée → [{ ine, lastName, firstName, birthDate }]. Tolère des lignes collées bout à bout. */
export function parseIneList(text) {
  const out = []; const seen = new Set();
  const re = /(\d{10,11}[A-Z]?)\s+(?:\d{3}\s+Version\s+\d+\s+)?([^\t\n]+?)\t+([^\t\n]+?)\t+(\d{2}\/\d{2}\/\d{4})/g;
  let m;
  while ((m = re.exec(String(text ?? ''))) !== null) {
    const ine = m[1].toUpperCase();
    if (seen.has(ine)) continue; // même candidat listé deux fois (deux versions)
    seen.add(ine);
    out.push({ ine, lastName: m[2].trim(), firstName: m[3].trim(), birthDate: iso(m[4]) });
  }
  return out;
}

/**
 * Rattache les INE aux fiches ({ id, lastName, firstName, birthDate }) : { matched: [{ id, ine, entry, dateMismatch? }], unknown: [entry] }.
 * dateMismatch : date de naissance de la fiche, différente de celle de la liste (à vérifier : l'examen prend celle de la liste).
 */
export function matchIne(entries, profiles) {
  const matched = []; const unknown = [];
  entries.forEach((e) => {
    const firsts = new Set(fold(e.firstName).split(' ').filter((w) => w.length > 1));
    const cands = profiles.filter((p) => p.birthDate === e.birthDate && (fold(p.lastName) === fold(e.lastName)
      || fold(p.firstName).split(' ').filter((w) => firsts.has(w)).length >= Math.min(2, firsts.size)));
    if (cands.length === 1) { matched.push({ id: cands[0].id, ine: e.ine, entry: e }); return; }
    // même nom et mêmes prénoms, mais date de naissance différente : rattaché, avec l'écart à vérifier
    const same = profiles.filter((p) => fold(`${p.lastName} ${p.firstName}`) === fold(`${e.lastName} ${e.firstName}`));
    if (!cands.length && same.length === 1) matched.push({ id: same[0].id, ine: e.ine, entry: e, dateMismatch: same[0].birthDate });
    else unknown.push(e);
  });
  return { matched, unknown };
}
