// Rémunération d'un agent : à l'heure (taux horaire), fixe au mois, ou fixe au mois calculé au prorata
// (jours depuis la date d'entrée le premier mois, ou semaines de travail effectif).
export const PAY_MODES = [['HORAIRE', 'À l\'heure (taux horaire)'], ['FIXE', 'Salaire fixe mensuel'], ['PRORATA', 'Salaire mensuel au prorata']];
export const PRORATA_BASES = [['ENTREE', 'selon la date d\'entrée (jours du mois)'], ['SEMAINES', 'selon les semaines de travail']];

const daysIn = (y, m) => new Date(y, m, 0).getDate();
/**
 * Montant du mois (AAAA-MM) pour un agent : { payMode, rate, monthly, prorataBase, entry, exit } ;
 * hours : heures effectuées (mode horaire) ; weeks / weeksInMonth : semaines travaillées (prorata semaines).
 */
export function monthPay(a, month, { hours = 0, weeks = null, weeksInMonth = 4 } = {}) {
  const amount = Number(a.monthly) || 0;
  if ((a.payMode ?? 'HORAIRE') === 'HORAIRE') return Math.round((Number(a.rate) || 0) * hours);
  if (a.payMode === 'FIXE') return amount;
  if (a.prorataBase === 'SEMAINES') return weeks == null ? amount : Math.round(amount * Math.min(1, weeks / weeksInMonth));
  const [y, m] = month.split('-').map(Number); const total = daysIn(y, m);
  const first = a.entry?.startsWith(month) ? Number(a.entry.slice(8, 10)) : 1;
  const last = a.exit?.startsWith(month) ? Number(a.exit.slice(8, 10)) : total;
  if ((a.entry && a.entry > `${month}-${String(total).padStart(2, '0')}`) || (a.exit && a.exit < `${month}-01`)) return 0;
  return Math.round(amount * Math.max(0, last - first + 1) / total);
}
