// Ancienneté de l'élève et documents officiels (certificat de scolarité, bulletin).

/** Année scolaire d'une date : septembre 2026 → 2026 (année 2026-2027). */
export const schoolYearOf = (iso) => {
  const [y, m] = iso.split('-').map(Number);
  return m >= 9 ? y : y - 1;
};
export const schoolYearLabel = (iso) => `${schoolYearOf(iso)}-${schoolYearOf(iso) + 1}`;

/**
 * Ancienneté à une date : nouvel élève (entré cette année scolaire) ou ancien élève avec le nombre
 * d'années déjà passées dans l'établissement (entré en septembre 2024 → ancien, 2 ans).
 */
export function seniority(enteredOn, today = '2026-10-13') {
  if (!enteredOn) return null;
  const years = schoolYearOf(today) - schoolYearOf(enteredOn);
  if (years < 0) return null;
  return {
    isNew: years === 0,
    years,
    label: years === 0 ? 'Nouvel élève' : `Ancien élève · ${years} an${years > 1 ? 's' : ''} dans l'établissement`,
  };
}

/**
 * Colonne « Entrée » ou « Ancienneté » d'un import : « 2024 », « 01/09/2023 », « 2 ans », « nouveau ».
 * Renvoie la date d'entrée (AAAA-MM-JJ) ou null si illisible.
 */
export function parseEntry(raw, today = '2026-10-13') {
  const t = String(raw ?? '').trim().toLowerCase();
  if (!t) return null;
  const current = schoolYearOf(today);
  if (/^(nouveau|nouvelle|nouvel)( élève)?$|^n$/.test(t)) return `${current}-09-01`;
  let m = t.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  m = t.match(/^(\d{4})(?:\s*[-/]\s*\d{4})?$/);
  if (m) return `${m[1]}-09-01`;
  m = t.match(/^(\d{1,2})\s*ans?$/);
  if (m) return `${current - Number(m[1])}-09-01`;
  return null;
}

/** « né », « née » ou « né(e) » selon le sexe renseigné. */
export const accord = (sex, masc, fem) => (sex === 'F' ? fem : sex === 'M' ? masc : `${masc}(${fem.slice(masc.length) || 'e'})`);

/** N° de certificat : CS-2026-0042. */
export const certificateNumber = (seq, today = '2026-10-13') => `CS-${schoolYearOf(today)}-${String(seq).padStart(4, '0')}`;

/**
 * Appréciation de démonstration pour le bulletin (matières sans appréciation saisie dans le prototype).
 * Toujours au moins deux phrases, à la troisième personne, sans formule décourageante.
 */
export function demoAppreciation(avg) {
  if (avg === null || avg === undefined) return 'Évaluations en cours. L\'appréciation sera rédigée après les dernières notes.';
  if (avg >= 16) return 'Excellent trimestre, travail rigoureux et régulier. Félicitations, il faut poursuivre ainsi.';
  if (avg >= 14) return 'Très bon trimestre, la participation est active. Les efforts doivent être maintenus.';
  if (avg >= 12) return 'Bon trimestre dans l\'ensemble. Un travail plus approfondi permettra de progresser encore.';
  if (avg >= 10) return 'Trimestre correct, les bases sont acquises. Il faut gagner en régularité dans le travail personnel.';
  return 'Des difficultés ce trimestre, mais des progrès sont possibles. Un travail régulier et des questions en classe aideront à remonter.';
}
