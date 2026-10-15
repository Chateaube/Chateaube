// Paie : taux horaire en vigueur à une date (historique des augmentations) et salaire du mois.

/** Taux en vigueur à la date (dernier taux dont la date d'effet est passée), ou null. */
export function rateOn(rates, staffId, date) {
  const r = rates.filter((x) => x.staffId === staffId && x.from <= date).sort((a, b) => b.from.localeCompare(a.from))[0];
  return r ? r.rate : null;
}

/** Historique d'un professeur, du plus récent au plus ancien, avec l'augmentation en %. */
export function rateHistory(rates, staffId) {
  const list = rates.filter((x) => x.staffId === staffId).sort((a, b) => a.from.localeCompare(b.from));
  return list.map((r, i) => ({ ...r, increase: i ? Math.round(((r.rate - list[i - 1].rate) / list[i - 1].rate) * 1000) / 10 : null })).reverse();
}

/** Salaire du mois : heures faites × taux (vacataires), sinon salaire mensuel. */
export const payOf = (line, rate) => (line.byHour ? (rate ?? 0) * (line.hours ?? 0) : line.monthly ?? 0);
