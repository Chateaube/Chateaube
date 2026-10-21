// Suivis individuels (Direction, CPE) : un élève au dossier lourd, un suivi demandé par les parents, ou un
// contrat (par exemple un club qui finance un élève sportif à condition qu'il soit assidu et travaille bien).
// Pour chaque suivi : motif, référent, conditions chiffrées, contact extérieur éventuel (seulement avec
// l'accord écrit des parents), et un état calculé depuis le début du suivi : tout va bien, ou alerte.

export const FOLLOWUP_KINDS = {
  DOSSIER: 'Dossier lourd, antécédents',
  PARENTS: 'À la demande des parents',
  CONTRAT: 'Contrat (financement, sport, bourse…)',
  AUTRE: 'Autre',
};
// Conditions possibles : vide = pas de condition sur ce point
export const CONDITIONS = [
  { id: 'maxUnjustified', label: 'Absences non justifiées', unit: 'au plus', fact: 'unjustified' },
  { id: 'maxLates', label: 'Retards', unit: 'au plus', fact: 'lates' },
  { id: 'minAverage', label: 'Moyenne générale', unit: 'au moins', fact: 'average', min: true },
  { id: 'maxMeasures', label: 'Punitions et colles', unit: 'au plus', fact: 'measures' },
];

export function followUpErrors(f) {
  const e = [];
  if (!f.student) e.push('Choisir l\'élève.');
  if (!FOLLOWUP_KINDS[f.kind]) e.push('Choisir le motif du suivi.');
  if (!f.referent?.trim()) e.push('Indiquer le référent (CPE, Direction…).');
  if (f.contact?.name?.trim() && !f.contact.parentConsent) e.push('Contact extérieur : il faut l\'accord écrit des parents pour lui donner des nouvelles de l\'élève.');
  return e;
}

/**
 * État d'un suivi à partir des faits de la période ({ unjustified, lates, average, measures }) :
 * une ligne par condition fixée, ok ou non ; alerte dès qu'une condition n'est pas tenue.
 */
export function evaluateFollowUp(f, facts) {
  const checks = CONDITIONS.filter((c) => f.conditions?.[c.id] != null && f.conditions[c.id] !== '').map((c) => {
    const limit = Number(f.conditions[c.id]); const value = facts[c.fact];
    const ok = value == null ? null : c.min ? value >= limit : value <= limit;
    return { id: c.id, label: c.label, unit: c.unit, limit, value, ok };
  });
  const failed = checks.filter((x) => x.ok === false);
  return { checks, status: failed.length ? 'ALERTE' : 'OK', failed };
}

/** Message de point (aux parents, ou au contact extérieur autorisé) : faits de la période et conditions. */
export function followUpReport(f, facts, evaluation, period) {
  const fmt = (v) => (typeof v === 'number' ? String(v).replace('.', ',') : v ?? '—');
  const lines = [
    `Point de suivi — ${f.student} (${period})`,
    `Absences non justifiées : ${fmt(facts.unjustified)} · retards : ${fmt(facts.lates)} · punitions et colles : ${fmt(facts.measures)} · moyenne générale : ${fmt(facts.average)}`,
    ...evaluation.checks.map((c) => `${c.ok === false ? '✗' : '✓'} ${c.label} : ${fmt(c.value)} (${c.unit} ${fmt(c.limit)})`),
  ];
  return lines.join('\n');
}
