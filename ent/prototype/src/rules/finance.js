// Règles financières : calendrier de relance, ventilation des droits d'examen,
// verrouillage de l'échéancier avant le départ à Tana.

// Mois actifs du cycle de relance d'écolage (octobre sauté : droits d'examen)
export const DUNNING_MONTHS = [9, 11, 12, 2, 4, 5, 6];
export const SKIPPED_MONTHS = { 10: 'Encaissement des droits d\'examen' };

export const EXAM_RETAINED_FEE = 40_000; // Ar conservés par élève (frais de dossier)

export const isDunningMonth = (date) => DUNNING_MONTHS.includes(new Date(date).getMonth() + 1);

/** Ventilation d'un encaissement de droits d'examen. */
export function splitExamFee(amount, retained = EXAM_RETAINED_FEE) {
  const kept = Math.min(retained, amount);
  return { retained: kept, toRemit: amount - kept };
}

/** Dernier mois d'écolage payable : mai pour les 1re/Tle de Tamatave. */
export function lastPayableMonth({ siteCode, levelCode }) {
  return siteCode === 'TMV' && ['1RE', 'TLE'].includes(levelCode) ? 5 : 6;
}

// Rang dans l'année scolaire : septembre = 0 … août = 11
const schoolRank = (month) => (month + 3) % 12;

/** Mois d'écolage facturables (septembre → dernier mois payable). */
export function billableMonths(ctx) {
  const last = schoolRank(lastPayableMonth(ctx));
  return [9, 10, 11, 12, 1, 2, 3, 4, 5, 6].filter((m) => schoolRank(m) <= last);
}

// Workflow d'impayés
export const DUNNING_STAGES = [
  { key: 'RELANCE', label: 'Relance automatique', delay: 'J+5 après échéance' },
  { key: 'AVERTISSEMENT_48H', label: 'Avertissement 48 h', delay: 'J+7 sans régularisation' },
  { key: 'MISE_A_PIED', label: 'Notification de mise à pied', delay: 'Après 48 h — validation Direction' },
];

export const formatAr = (n) => `${new Intl.NumberFormat('fr-FR').format(n).replace(/ | /g, ' ')} Ar`;
