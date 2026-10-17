// Manuels scolaires : stock par état, prêts aux élèves, retours, pertes et dégradations.
// Un manuel perdu ou rendu déchiré se règle à la caisse (article « Manuel perdu ou endommagé »).
// Tant qu'un manuel reste dû (perdu non réglé, ou non rendu à la date prévue), le bulletin
// n'est pas remis.

export const CONDITIONS = [
  { id: 'NEUF', label: 'Neuf' },
  { id: 'BON', label: 'Bon état' },
  { id: 'USE', label: 'Usé' },
  { id: 'DECHIRE', label: 'Déchiré / abîmé' },
];
export const KINDS = { ORIGINAL: 'Original', PHOTOCOPIE: 'Photocopie' };
export const BINDINGS = { DOS_CARRE: 'Dos carré', RELIURE: 'Reliure' };
export const CATEGORIES = { MANUEL: 'Manuel', CAHIER: 'Cahier d\'activités' };
export const conditionLabel = (id) => (id === 'PERDU' ? 'Perdu' : CONDITIONS.find((c) => c.id === id)?.label ?? id);

export const inStock = (m) => Object.values(m.stock).reduce((s, n) => s + n, 0);
export const lentCount = (m, loans) => loans.filter((l) => l.manualId === m.id && !l.sold && !l.returnedOn && l.stateIn !== 'PERDU').length;

/** Un élève reçoit ce titre ? (les manuels de spécialité vont aux seuls élèves qui la suivent) */
export const eligible = (manual, specialties = []) => !manual.specialty || specialties.includes(manual.specialty);

/** Lot d'un élève selon sa classe et ses spécialités : manuels et cahiers. */
export const kitFor = (cls, specialties, manuals) => manuals.filter((m) => m.levels.includes(cls) && eligible(m, specialties));

/** Ce que paie la famille pour le lot : location (titres à rendre) et cahiers gardés (vendus). */
export function kitTotals(items) {
  const rental = items.filter((m) => m.returnable);
  const sold = items.filter((m) => !m.returnable);
  return {
    rental: rental.reduce((s, m) => s + m.price, 0), rentalCount: rental.length,
    sold: sold.reduce((s, m) => s + m.price, 0), soldCount: sold.length,
  };
}
export const totalCopies = (m, loans) => inStock(m) + lentCount(m, loans);

/** Prêt d'un exemplaire dans un état donné : il doit y en avoir en stock ; un déchiré ne se prête pas. */
export function lend(manual, loans, { student, cls, state, on, dueBack }) {
  if (state === 'DECHIRE') return { error: 'Un exemplaire déchiré ne se prête pas : à réparer ou à réformer.' };
  if (!(manual.stock[state] > 0)) return { error: `Plus d'exemplaire « ${conditionLabel(state)} » en stock.` };
  if (loans.some((l) => l.manualId === manual.id && l.student === student && (l.sold || (!l.returnedOn && l.stateIn !== 'PERDU')))) return { error: `${student} a déjà « ${manual.title} ».` };
  return {
    manual: { ...manual, stock: { ...manual.stock, [state]: manual.stock[state] - 1 } },
    // cahier gardé par l'élève : remis une fois pour toutes, rien à rendre
    loan: { id: `l${Date.now()}${Math.round(Math.random() * 1e4)}`, manualId: manual.id, student, cls, stateOut: state, issuedOn: on, ...(manual.returnable !== false ? { dueBack } : { sold: true }) },
  };
}

/** Retour : l'exemplaire revient en stock dans son nouvel état ; « PERDU » le sort du stock. */
export function giveBack(manual, loan, { state, on }) {
  const charge = needsCharge(loan.stateOut, state);
  return {
    manual: state === 'PERDU' ? manual : { ...manual, stock: { ...manual.stock, [state]: (manual.stock[state] ?? 0) + 1 } },
    loan: { ...loan, stateIn: state, returnedOn: state === 'PERDU' ? null : on, declaredOn: on, charge: charge ? 'A_REGLER' : null },
  };
}

/** À facturer : manuel perdu, ou rendu déchiré alors qu'il n'était pas déchiré au départ. */
export const needsCharge = (stateOut, stateIn) => stateIn === 'PERDU' || (stateIn === 'DECHIRE' && stateOut !== 'DECHIRE');

/** Ce qui bloque la remise du bulletin, côté manuels. */
export function manualBlocks(student, loans, manuals, today) {
  return loans.filter((l) => l.student === student && !l.sold).flatMap((l) => {
    const title = manuals.find((m) => m.id === l.manualId)?.title ?? 'Manuel';
    if (l.charge === 'A_REGLER') return [`${title} : ${l.stateIn === 'PERDU' ? 'perdu' : 'rendu abîmé'}, à régler à la caisse`];
    if (!l.returnedOn && l.stateIn !== 'PERDU' && l.dueBack && l.dueBack < today) return [`${title} : non rendu (attendu le ${l.dueBack.split('-').reverse().join('/')})`];
    return [];
  });
}

/**
 * Bilan d'un titre pour l'inventaire : exemplaires, en prêt, en état, abîmés, perdus, et ce qui manque
 * pour l'effectif concerné (élèves des niveaux du titre ; spécialité : élèves qui la suivent).
 * Manuel à rendre : il faut un exemplaire en état par élève. Cahier gardé : un par élève qui ne l'a pas encore.
 */
export function manualBalance(m, loans, effectif) {
  const mine = loans.filter((l) => l.manualId === m.id);
  const lent = lentCount(m, loans);
  const damaged = m.stock.DECHIRE ?? 0;
  const goodInStock = inStock(m) - damaged;
  const lost = mine.filter((l) => l.stateIn === 'PERDU').length;
  const sold = mine.filter((l) => l.sold).length;
  const usableCopies = m.returnable ? goodInStock + lent : goodInStock;
  const needed = effectif == null ? null : m.returnable ? effectif : Math.max(0, effectif - sold);
  return { id: m.id, title: m.title, levels: m.levels, returnable: m.returnable, effectif, total: inStock(m) + lent, lent, goodInStock, damaged, lost, sold,
    missing: needed == null ? null : Math.max(0, needed - usableCopies) };
}
