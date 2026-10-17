// Trésorerie : toutes les entrées et sorties d'argent ramenées à un même modèle de transaction
// (recette ou dépense, catégorie, montant toujours positif, statut payé / en attente / annulé,
// date du mouvement, échéance, référence, pièce jointe). En base, c'est le grand livre (écritures
// en partie double) ; ce modèle sert au tableau de bord.

/**
 * Transactions à partir de la caisse (encaissements et sorties déjà faits), des dépenses
 * fournisseurs, des salaires et de ce que les familles doivent encore.
 */
const TRANSFERS = ['Dépôt en banque', 'Apport banque'];
export function toTransactions({ cash = [], expenses = [], payroll = [], dues = [] }) {
  return [
    // la caisse : les dépenses saisies comme dépenses fournisseurs n'y sont pas comptées deux fois, et les
    // dépôts en banque / apports de la banque ne sont que des transferts entre caisse et banque
    ...cash.filter((m) => !m.expenseId && !TRANSFERS.includes(m.nature)).map((m) => ({ id: `c-${m.id}`, type: m.dir === 'IN' ? 'RECETTE' : 'DEPENSE', category: m.dir === 'IN' ? 'Scolarité et frais' : m.nature, amount: m.amount, status: 'PAYE', date: m.date, due: null })),
    ...expenses.map((x) => ({ id: `x-${x.id}`, type: 'DEPENSE', category: x.category, amount: x.amount, status: x.status, date: x.date, due: x.due, ref: x.supplierId, attachment: x.photo ?? null })),
    ...payroll.map((p) => ({ id: `s-${p.staffId}`, type: 'DEPENSE', category: 'Salaires', amount: p.amount, status: p.paid ? 'PAYE' : 'EN_ATTENTE', date: p.paid ?? null, due: p.due, ref: p.staffId })),
    ...dues.map((d) => ({ id: `d-${d.id}`, type: 'RECETTE', category: 'Scolarité et frais', amount: d.amount, status: 'EN_ATTENTE', date: null, due: d.due, ref: d.id })),
  ];
}

const sum = (list) => list.reduce((s, t) => s + t.amount, 0);
/** Indicateurs : trésorerie nette, reste à recouvrer, dépenses engagées. */
export function treasuryKpis(tx, opening = 0) {
  const live = tx.filter((t) => t.status !== 'ANNULE');
  return {
    net: opening + sum(live.filter((t) => t.type === 'RECETTE' && t.status === 'PAYE')) - sum(live.filter((t) => t.type === 'DEPENSE' && t.status === 'PAYE')),
    toCollect: sum(live.filter((t) => t.type === 'RECETTE' && t.status === 'EN_ATTENTE')),
    committed: sum(live.filter((t) => t.type === 'DEPENSE' && t.status === 'EN_ATTENTE')),
  };
}

/** Entrées et sorties payées, mois par mois ('AAAA-MM'). */
export function monthlyFlows(tx, months) {
  return months.map((m) => {
    const inMonth = tx.filter((t) => t.status === 'PAYE' && t.date?.startsWith(m));
    return { month: m, in: sum(inMonth.filter((t) => t.type === 'RECETTE')), out: sum(inMonth.filter((t) => t.type === 'DEPENSE')) };
  });
}

/** Dépenses payées par catégorie sur une période. */
export function byCategory(tx, from, to) {
  const out = {};
  tx.filter((t) => t.type === 'DEPENSE' && t.status === 'PAYE' && t.date >= from && t.date <= to).forEach((t) => { out[t.category] = (out[t.category] ?? 0) + t.amount; });
  return Object.entries(out).sort((a, b) => b[1] - a[1]);
}

/** Contrôle d'une dépense saisie (photo de la facture conseillée, obligatoire au-delà d'un seuil). */
export function expenseErrors(x, { photoAbove = 100_000 } = {}) {
  const e = [];
  if (!x.label?.trim()) e.push('Libellé obligatoire.');
  if (!(x.amount > 0) || !Number.isInteger(x.amount)) e.push('Montant en Ariary, entier et positif.');
  if (!x.category) e.push('Catégorie obligatoire.');
  if (x.status === 'PAYE' && !x.date) e.push('Date de paiement obligatoire.');
  if (x.status === 'EN_ATTENTE' && !x.due) e.push('Échéance obligatoire pour une dépense à payer.');
  if (x.status === 'PAYE' && x.amount > photoAbove && !x.photo) e.push(`Photo de la facture obligatoire au-delà de ${photoAbove.toLocaleString('fr-FR')} Ar.`);
  return e;
}
