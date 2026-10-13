// Comptabilité : état de compte d'une famille et totaux par journal.
// Règle d'étanchéité : un paiement n'éteint que des dettes de SON journal
// (un versement d'écolage ne peut pas solder des droits d'examen).

import { planMonths } from './calendar.js';

/** Lignes triées avec, pour chaque ligne, le solde progressif de SON journal ; soldes séparés par journal. */
export function accountStatement(lines) {
  const sorted = [...lines].sort((a, b) => a.date.localeCompare(b.date));
  const byJournal = {};
  const rows = sorted.map((l) => {
    const debit = l.debit ?? 0;
    const credit = l.credit ?? 0;
    const j = (byJournal[l.journal] ??= { billed: 0, paid: 0, balance: 0 });
    j.billed += debit;
    j.paid += credit;
    j.balance += debit - credit;
    return { ...l, debit, credit, journalBalance: j.balance };
  });
  const totals = Object.values(byJournal).reduce(
    (t, j) => ({ billed: t.billed + j.billed, paid: t.paid + j.paid, balance: t.balance + j.balance }),
    { billed: 0, paid: 0, balance: 0 },
  );
  return { rows, byJournal, totals };
}

/** Coût annuel d'une classe : (ré)inscription + écolage × nombre de mois du plan + fascicule + location. */
export function annualCost(row, plans, { newStudent = false } = {}) {
  const months = planMonths(plans[row.plan]).length;
  return (newStudent ? row.inscription : row.reinscription) + row.ecolage * months + row.fascicule + row.location;
}

/** Solde de caisse par journal après les mouvements du jour. */
export function cashBalance(opening, movements) {
  const out = { ...opening };
  for (const m of movements) out[m.journal] = (out[m.journal] ?? 0) + (m.dir === 'IN' ? m.amount : -m.amount);
  return out;
}
