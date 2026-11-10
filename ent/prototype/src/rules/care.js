// Passages au secrétariat pour un souci de santé (pas d'infirmerie à l'école).
// Seul médicament donné : le paracétamol (Doliprane), comme le prévoit le règlement intérieur,
// par le secrétariat qui garde la trousse de secours. Les parents sont prévenus de chaque passage.
export const CARE_REASONS = ['Mal de tête', 'Mal de ventre', 'Fièvre', 'Malaise', 'Blessure légère', 'Règles douloureuses', 'Autre'];
export const CARE_OUTCOMES = {
  CLASSE: 'Retour en classe',
  REPOS: 'Repos puis retour en classe',
  SORTIE: 'Sortie anticipée (parents venus le chercher)',
  URGENCE: 'Urgence : secours appelés',
};
export const MIN_HOURS_BETWEEN_DOSES = 6;
export const FREQUENT_VISITS = 3; // passages dans le même mois à partir desquels on le signale

const hoursBetween = (a, b) => Math.abs(new Date(b) - new Date(a)) / 36e5;
export const allergicToParacetamol = (allergies = '') => /parac[ée]tamol|doliprane|efferalgan|dafalgan/i.test(allergies);

/** Dernier Doliprane donné à l'école à cet élève moins de 6 heures avant `at`. */
export function recentDose(visits, student, at) {
  return visits.find((v) => v.student === student && v.paracetamol && v.at <= at && hoursBetween(v.at, at) < MIN_HOURS_BETWEEN_DOSES);
}

export function careErrors(v, { visits = [], allergies = '', stock = Infinity } = {}) {
  const e = [];
  if (!v.student) e.push('Choisir l\'élève.');
  if (!v.reason) e.push('Indiquer le motif.');
  if (v.reason === 'Autre' && !v.detail?.trim()) e.push('Préciser le motif.');
  if (!v.outcome) e.push('Indiquer la suite donnée.');
  if (v.paracetamol) {
    if (allergicToParacetamol(allergies)) e.push('Allergie au paracétamol déclarée sur la fiche : pas de Doliprane.');
    const prev = recentDose(visits, v.student, v.at);
    if (prev) e.push(`Doliprane déjà donné à ${prev.at.slice(11, 16).replace(':', 'h')} : attendre ${MIN_HOURS_BETWEEN_DOSES} heures entre deux prises.`);
    if (!v.dose?.trim()) e.push('Indiquer la dose donnée.');
    if (stock < 1) e.push('Plus de Doliprane en stock.');
  }
  return e;
}

/** Élèves passés au moins `min` fois dans le mois (AAAA-MM). */
export function frequentVisitors(visits, month, min = FREQUENT_VISITS) {
  const n = {};
  visits.filter((v) => v.at.startsWith(month)).forEach((v) => { n[v.student] = (n[v.student] ?? 0) + 1; });
  return Object.entries(n).filter(([, c]) => c >= min).map(([student, count]) => ({ student, count })).sort((a, b) => b.count - a.count);
}

/** Message envoyé aux parents dans l'application, pour qu'ils prennent des nouvelles le soir. */
export function parentNotice(v, firstName) {
  const h = v.at.slice(11, 16).replace(':', 'h');
  const what = v.reason === 'Autre' ? v.detail : v.reason.toLowerCase();
  if (!v.outcome) return `${firstName} a été envoyé·e au secrétariat à ${h} : ${what}. Il ou elle est pris·e en charge ; vous aurez des nouvelles ici.`;
  const med = v.paracetamol ? ` Un Doliprane lui a été donné (${v.dose}).` : ' Aucun médicament ne lui a été donné.';
  return `${firstName} est passé·e au secrétariat à ${h} : ${what}.${med} Suite : ${CARE_OUTCOMES[v.outcome].toLowerCase()}. Pensez à lui demander ce soir comment il ou elle se sent.`;
}
