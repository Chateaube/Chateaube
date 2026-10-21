// Journal de l'école : qui a fait quoi, pour les élèves et les professeurs (jamais l'argent).
// Chaque action de vie scolaire laisse une ligne : { at 'AAAA-MM-JJTHH:MM', who, role, kind, text, student? }.
// La Direction, le secrétariat et la CPE le voient sur leur accueil : la journée ou la semaine, par personne.

export const ACTIVITY_KINDS = {
  APPEL: 'Appels', ABSENCE: 'Absences et retards', JUSTIF: 'Justificatifs', PARENTS: 'Parents prévenus',
  PUNITION: 'Punitions et sanctions', COLLE: 'Colles et TIG', OUBLI: 'Oublis', OBJET: 'Objets confisqués',
  SOIN: 'Soins', SORTIE: 'Sorties anticipées', PROF: 'Professeurs', SUIVI: 'Suivis individuels',
};

const day = (at) => at.slice(0, 10);
const minusDays = (iso, n) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };

/** Lignes de la période : 'JOUR' (aujourd'hui) ou 'SEMAINE' (7 derniers jours), éventuellement d'une personne. */
export function journal(entries, { today, period = 'JOUR', who = '' }) {
  const from = period === 'JOUR' ? today : minusDays(today, 6);
  return entries.filter((e) => day(e.at) >= from && day(e.at) <= today && (!who || e.who === who))
    .sort((a, b) => b.at.localeCompare(a.at));
}

/** Résumé par personne : nombre d'actions et détail par type, du plus actif au moins actif. */
export function byPerson(entries) {
  const map = new Map();
  entries.forEach((e) => {
    const p = map.get(e.who) ?? { who: e.who, role: e.role, total: 0, kinds: {} };
    p.total += 1; p.kinds[e.kind] = (p.kinds[e.kind] ?? 0) + 1;
    map.set(e.who, p);
  });
  return [...map.values()].sort((a, b) => b.total - a.total || a.who.localeCompare(b.who));
}

/** Lignes groupées par jour (le plus récent d'abord). */
export const byDay = (entries) => [...new Set(entries.map((e) => day(e.at)))].map((d) => [d, entries.filter((e) => day(e.at) === d)]);

// Services, dans l'ordre d'affichage : la Direction, la CPE, le secrétariat, puis tous les enseignants ensemble
// (pour eux, c'est surtout l'appel, les retards, les oublis et les punitions).
export const SERVICES = [['DIRECTION', 'Direction'], ['VIE_SCOLAIRE', 'CPE'], ['BUREAU', 'Secrétariat'], ['ENSEIGNANT', 'Enseignants']];

/** Lignes regroupées par service, avec le détail par type ; services sans action omis. */
export function byService(entries) {
  return SERVICES.map(([role, label]) => {
    const list = entries.filter((e) => (e.role === role) || (role === 'ENSEIGNANT' && !SERVICES.some(([r]) => r === e.role)));
    const kinds = list.reduce((m, e) => ({ ...m, [e.kind]: (m[e.kind] ?? 0) + 1 }), {});
    return { role, label, list, kinds, people: [...new Set(list.map((e) => e.who))] };
  }).filter((g) => g.list.length);
}
