// Encaissement : ce que doit un élève, mois par mois, d'après la grille tarifaire.
// Le caissier sélectionne l'élève, coche les échéances à régler (les échéances
// échues sont proposées d'office), choisit le mode de paiement et édite un reçu
// PAR JOURNAL (frais de scolarité, frais annexes, droits d'examen restent séparés).

import { planMonths, dueDateOf, monthName } from './calendar.js';

export const PAYMENT_METHODS = {
  ESPECES: { label: 'Espèces', needsRef: false },
  CHEQUE: { label: 'Chèque', needsRef: true, refLabel: 'N° de chèque' },
  VIREMENT: { label: 'Virement', needsRef: true, refLabel: 'N° de bordereau / référence' },
};

const schoolRank = (m) => (m + 3) % 12; // septembre = 0 … août = 11
const yearOfMonth = (m, settings) => Number((m >= 9 ? settings.schoolYear.start : settings.schoolYear.end).slice(0, 4));

/**
 * Échéances d'un élève.
 * @param student {{isNew: boolean, enrolledOn: string, paid: string[], exam?: {label: string, amount: number}}}
 * @param fees    ligne de la grille « Classes & tarifs »
 * Le compte d'un élève arrivé en cours d'année commence au mois de son inscription.
 */
export function studentDues(student, fees, settings, today) {
  const plan = settings.tuition.plans[fees.plan];
  const startRank = Math.max(schoolRank(Number(student.enrolledOn.slice(5, 7))), schoolRank(plan.first));
  const firstDue = student.enrolledOn > settings.schoolYear.start ? student.enrolledOn : settings.schoolYear.start;

  const items = [
    student.isNew
      ? { key: 'INSCRIPTION', label: 'Inscription', amount: fees.inscription, journal: 'FRAIS_ANNEXES', due: firstDue }
      : { key: 'REINSCRIPTION', label: 'Réinscription', amount: fees.reinscription, journal: 'FRAIS_ANNEXES', due: firstDue },
    { key: 'FASCICULE', label: 'Fascicule', amount: fees.fascicule, journal: 'FRAIS_ANNEXES', due: firstDue },
    { key: 'LOCATION', label: 'Location des manuels', amount: fees.location, journal: 'FRAIS_ANNEXES', due: firstDue },
    ...planMonths(plan)
      .filter((m) => schoolRank(m) >= startRank)
      .map((m) => ({
        key: `ECO-${String(m).padStart(2, '0')}`,
        label: `Frais de scolarité ${monthName(m)} ${yearOfMonth(m, settings)}`,
        short: `${monthName(m).charAt(0).toUpperCase()}${monthName(m).slice(1)} ${yearOfMonth(m, settings)}`,
        amount: fees.ecolage,
        journal: 'ECOLAGE',
        // arrivée après le 5 : le premier mois est dû à la date d'inscription
        due: [dueDateOf(yearOfMonth(m, settings), m, settings), firstDue].sort().at(-1),
        month: m,
      })),
  ];
  if (student.exam) {
    items.push({ key: 'EXAMEN', label: student.exam.label, amount: student.exam.amount, journal: 'DROITS_EXAMEN', due: student.exam.due });
  }
  // Réduction accordée par la Direction (fratrie, proche, enfant du personnel, redoublant…) :
  // elle s'applique aux frais de scolarité mensuels, montant arrondi à 100 Ar
  const r = student.reduction;
  if (r) {
    for (const it of items) {
      if (it.journal !== 'ECOLAGE') continue;
      const discount = reductionAmount(it.amount, r);
      Object.assign(it, { base: it.amount, discount, amount: it.amount - discount, reductionLabel: r.label });
    }
  }
  return items.map((it) => {
    const paid = student.paid.includes(it.key);
    const status = paid ? 'PAYE' : it.due <= today ? 'ECHU' : 'A_ECHOIR';
    return { ...it, status };
  });
}

/** Montant d'une réduction : pourcentage (arrondi à 100 Ar) ou montant fixe, jamais plus que le tarif. */
export function reductionAmount(amount, { kind, value }) {
  const d = kind === 'PERCENT' ? Math.round((amount * value) / 100 / 100) * 100 : value;
  return Math.max(0, Math.min(amount, d));
}

/** Proposition par défaut : tout ce qui est échu et non payé. */
export const defaultSelection = (items) => items.filter((i) => i.status === 'ECHU').map((i) => i.key);

/** Contrôle du moyen de paiement : n° de chèque / bordereau et banque obligatoires hors espèces. */
export function validateInstrument({ method, ref, bank }) {
  const m = PAYMENT_METHODS[method];
  if (!m) return ['Mode de paiement non accepté (espèces, chèque ou virement uniquement).'];
  const errors = [];
  if (m.needsRef && !String(ref ?? '').trim()) errors.push(`${m.refLabel} obligatoire.`);
  if (m.needsRef && !String(bank ?? '').trim()) errors.push('Banque obligatoire.');
  if (method === 'CHEQUE' && ref && !/^\d{6,10}$/.test(String(ref).trim())) errors.push('Le n° de chèque comporte 6 à 10 chiffres.');
  return errors;
}

/** Un reçu par journal pour les échéances cochées. */
export function buildReceipts(items, selectedKeys, { method, ref, bank }, nextNumber) {
  const PREFIX = { ECOLAGE: 'ECO', FRAIS_ANNEXES: 'ANX', DROITS_EXAMEN: 'EXA' };
  const byJournal = {};
  for (const it of items) {
    if (!selectedKeys.includes(it.key) || it.status === 'PAYE') continue;
    (byJournal[it.journal] ??= []).push(it);
  }
  return Object.entries(byJournal).map(([journal, lines]) => ({
    number: `${PREFIX[journal]}-TMV-${String(nextNumber(journal)).padStart(5, '0')}`,
    journal,
    lines,
    total: lines.reduce((s, l) => s + l.amount, 0),
    method, ref: ref || null, bank: bank || null,
  }));
}
