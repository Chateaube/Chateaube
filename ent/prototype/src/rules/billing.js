import { examOf } from '../data/accounting.js';
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
    ...(fees.fascicule > 0 ? [{ key: 'FASCICULE', label: 'Fascicule', amount: fees.fascicule, journal: 'FRAIS_ANNEXES', due: firstDue }] : []),
    // location : seulement si le lot de manuels de la classe est connu
    ...(fees.location > 0 ? [{ key: 'LOCATION', label: fees.locationLabel ?? 'Location des manuels', amount: fees.location, journal: 'FRAIS_ANNEXES', due: firstDue }] : []),
    // cahiers d'activité gardés par l'élève (vendus avec le lot de la classe)
    ...(fees.cahiers > 0 ? [{ key: 'CAHIERS', label: fees.cahiersLabel ?? 'Cahiers d\'activités', amount: fees.cahiers, journal: 'FRAIS_ANNEXES', due: firstDue }] : []),
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
  const exam = student.exam ?? examOf(student.cls, fees); // montant fixé dans « Classes & tarifs »
  if (exam) {
    items.push({ key: 'EXAMEN', label: exam.label, amount: exam.amount, journal: 'DROITS_EXAMEN', due: exam.due });
  }
  // Réduction accordée par la Direction : un taux pour les frais de scolarité mensuels et un pour
  // l'inscription (ou la réinscription) ; les autres frais restent dus à 100 %. Arrondi à 100 Ar.
  const rates = student.reduction?.rates;
  if (rates) {
    for (const it of items) {
      const pct = it.journal === 'ECOLAGE' ? rates.ECOLAGE : ['INSCRIPTION', 'REINSCRIPTION'].includes(it.key) ? rates.INSCRIPTION : 0;
      if (!pct) continue;
      const discount = reductionAmount(it.amount, pct);
      Object.assign(it, { base: it.amount, discount, amount: it.amount - discount, reductionLabel: student.reduction.label });
    }
  }
  return items.map((it) => {
    const paid = student.paid.includes(it.key);
    const status = it.amount === 0 && it.discount ? 'EXONERE' : paid ? 'PAYE' : it.due <= today ? 'ECHU' : 'A_ECHOIR';
    return { ...it, status };
  });
}

/** Montant d'une réduction en pourcentage (arrondi à 100 Ar), jamais plus que le tarif. */
export function reductionAmount(amount, pct) {
  return Math.max(0, Math.min(amount, Math.round((amount * (pct ?? 0)) / 100 / 100) * 100));
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

export const RECEIPT_PREFIX = { ECOLAGE: 'ECO', FRAIS_ANNEXES: 'ANX', DROITS_EXAMEN: 'EXA' };
/**
 * Dernier numéro émis dans chaque série (une série par journal : ECO, ANX, EXA), lu dans le journal des reçus
 * gardé (et partagé en ligne) : la numérotation est continue, sans trou ni doublon, et un reçu annulé garde
 * son numéro (il n'est jamais réattribué). floor : point de départ (démonstration).
 */
export function lastReceiptNumbers(receipts = [], floor = {}) {
  const out = Object.fromEntries(Object.keys(RECEIPT_PREFIX).map((j) => [j, floor[j] ?? 0]));
  const byPrefix = Object.fromEntries(Object.entries(RECEIPT_PREFIX).map(([j, p]) => [p, j]));
  receipts.forEach((r) => {
    const m = /^([A-Z]{3})-[A-Z]+-(\d+)$/.exec(String(r?.number ?? ''));
    if (m && byPrefix[m[1]]) out[byPrefix[m[1]]] = Math.max(out[byPrefix[m[1]]], Number(m[2]));
  });
  return out;
}

/** Un reçu par journal pour les échéances cochées. */
export function buildReceipts(items, selectedKeys, { method, ref, bank }, nextNumber) {
  const PREFIX = RECEIPT_PREFIX;
  const byJournal = {};
  for (const it of items) {
    if (!selectedKeys.includes(it.key) || it.status === 'PAYE' || it.status === 'EXONERE') continue;
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
