// Nom court d'un élève pour les écrans et documents internes (listes, grilles, vie scolaire, caisse…) :
// initiale du nom + prénom d'usage, « R. Aina ». Plus lisible et plus facile à reconnaître. Si deux élèves de
// l'école s'écriraient pareil, on ajoute la classe (« R. Fy (6e) ») ; encore pareil : le nom complet.
// Les documents officiels (reçus, factures, certificats, bulletins, relevés, contrats) gardent le nom complet.
import { currentStudents } from './importStore.js';

let cache = null; let sig = '';
const fullOf = (s) => `${s.lastName} ${s.firstName}`.trim();
const short = (s) => `${String(s.lastName ?? '').charAt(0)}. ${String(s.usualName ?? '').trim() || String(s.firstName ?? '').split(/\s+/)[0] || s.lastName}`;

function build() {
  const list = currentStudents() ?? [];
  const now = `${list.length}:${list.map((s) => `${fullOf(s)}|${s.usualName ?? ''}|${s.cls}`).join(';').length}`;
  if (cache && now === sig) return cache;
  const base = new Map(list.map((s) => [fullOf(s), short(s)]));
  const count = (vals) => vals.reduce((m, v) => m.set(v, (m.get(v) ?? 0) + 1), new Map());
  const c1 = count([...base.values()]);
  const withCls = new Map(list.map((s) => [fullOf(s), c1.get(short(s)) > 1 ? `${short(s)} (${s.cls})` : short(s)]));
  const c2 = count([...withCls.values()]);
  cache = new Map(list.map((s) => [fullOf(s), c2.get(withCls.get(fullOf(s))) > 1 ? fullOf(s) : withCls.get(fullOf(s))]));
  sig = now; return cache;
}

/** « RAKOTO Fy Test » → « R. Fy » (élève inconnu : initiale des mots en majuscules + premier prénom). */
export function studentLabel(full) {
  if (!full) return full ?? '';
  const known = build().get(String(full).trim());
  if (known) return known;
  const words = String(full).trim().split(/\s+/); const caps = [];
  while (words.length > 1 && words[0] === words[0].toUpperCase() && /[A-Z]/.test(words[0])) caps.push(words.shift());
  return caps.length && words.length ? `${caps[0].charAt(0)}. ${words[0]}` : String(full);
}
export const sn = studentLabel;
