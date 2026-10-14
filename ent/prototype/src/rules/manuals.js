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
export const conditionLabel = (id) => (id === 'PERDU' ? 'Perdu' : CONDITIONS.find((c) => c.id === id)?.label ?? id);

const inStock = (m) => Object.values(m.stock).reduce((s, n) => s + n, 0);
export const lentCount = (m, loans) => loans.filter((l) => l.manualId === m.id && !l.returnedOn && l.stateIn !== 'PERDU').length;
export const totalCopies = (m, loans) => inStock(m) + lentCount(m, loans);

/** Prêt d'un exemplaire dans un état donné : il doit y en avoir en stock ; un déchiré ne se prête pas. */
export function lend(manual, loans, { student, cls, state, on, dueBack }) {
  if (state === 'DECHIRE') return { error: 'Un exemplaire déchiré ne se prête pas : à réparer ou à réformer.' };
  if (!(manual.stock[state] > 0)) return { error: `Plus d'exemplaire « ${conditionLabel(state)} » en stock.` };
  if (loans.some((l) => l.manualId === manual.id && l.student === student && !l.returnedOn && l.stateIn !== 'PERDU')) return { error: `${student} a déjà ce manuel.` };
  return {
    manual: { ...manual, stock: { ...manual.stock, [state]: manual.stock[state] - 1 } },
    loan: { id: `l${Date.now()}${Math.round(Math.random() * 1e4)}`, manualId: manual.id, student, cls, stateOut: state, issuedOn: on, dueBack },
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
  return loans.filter((l) => l.student === student).flatMap((l) => {
    const title = manuals.find((m) => m.id === l.manualId)?.title ?? 'Manuel';
    if (l.charge === 'A_REGLER') return [`${title} : ${l.stateIn === 'PERDU' ? 'perdu' : 'rendu abîmé'}, à régler à la caisse`];
    if (!l.returnedOn && l.stateIn !== 'PERDU' && l.dueBack && l.dueBack < today) return [`${title} : non rendu (attendu le ${l.dueBack.split('-').reverse().join('/')})`];
    return [];
  });
}
