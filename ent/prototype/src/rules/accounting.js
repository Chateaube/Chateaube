// Comptabilité : état de compte d'une famille et totaux par journal.
// Règle d'étanchéité : un paiement n'éteint que des dettes de SON journal
// (un versement de frais de scolarité ne peut pas solder des droits d'examen).

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

/** Coût annuel d'une classe : (ré)inscription + frais de scolarité × nombre de mois du plan + fascicule + location + cahiers. */
export function annualCost(row, plans, { newStudent = false } = {}) {
  const months = planMonths(plans[row.plan]).length;
  return (newStudent ? row.inscription : row.reinscription) + row.ecolage * months + row.fascicule + row.location + (row.cahiers ?? 0);
}

/** Solde de caisse par journal après les mouvements du jour. */
export function cashBalance(opening, movements) {
  const out = { ...opening };
  for (const m of movements) out[m.journal] = (out[m.journal] ?? 0) + (m.dir === 'IN' ? m.amount : -m.amount);
  return out;
}

// --- Export mensuel de la caisse ------------------------------------------------
// Chaque mois, le bureau exporte la caisse (Excel / impression) pour le suivi et l'archivage.

/** Mode de paiement d'un mouvement (« Chèque n° 3318820 » → Chèque). */
export const methodOf = (m) => (/^ch[eè]que/i.test(m.method) ? 'Chèque' : /^virement/i.test(m.method) ? 'Virement' : 'Espèces');

/**
 * Synthèse d'un mois de caisse : solde d'ouverture et de clôture par journal, entrées et sorties
 * par journal, par mode de paiement et par jour. `history` = tous les mouvements datés (date ISO).
 */
export function monthlyCashReport(openingOfYear, history, month /* 'AAAA-MM' */, journals) {
  const before = history.filter((m) => m.date < `${month}-01`);
  const inMonth = history.filter((m) => m.date.startsWith(month)).sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
  const opening = cashBalance(openingOfYear, before);
  const closing = cashBalance(opening, inMonth);
  const zero = () => ({ in: 0, out: 0 });
  const byJournal = Object.fromEntries(journals.map((j) => [j, zero()]));
  const byMethod = { Espèces: zero(), Chèque: zero(), Virement: zero() };
  const byDay = {};
  for (const m of inMonth) {
    const k = m.dir === 'IN' ? 'in' : 'out';
    byJournal[m.journal][k] += m.amount;
    byMethod[methodOf(m)][k] += m.amount;
    (byDay[m.date] ??= zero())[k] += m.amount;
  }
  const totals = Object.values(byJournal).reduce((t, v) => ({ in: t.in + v.in, out: t.out + v.out }), zero());
  return { month, opening, closing, byJournal, byMethod, byDay, totals, movements: inMonth };
}

/** Export Excel (CSV ; séparateur « ; », compatible Excel en français). */
export function cashMonthCsv(report, { site, journalLabels }) {
  const cell = (v) => {
    const t = v === null || v === undefined ? '' : String(v);
    return /[;"\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const fr = (iso) => iso.split('-').reverse().join('/');
  const lines = [
    [`Caisse ${site} — ${report.month.split('-').reverse().join('/')}`],
    [],
    ['Journal', 'Solde d\'ouverture', 'Entrées', 'Sorties', 'Solde de clôture'],
    ...Object.keys(report.byJournal).map((j) => [journalLabels[j], report.opening[j] ?? 0, report.byJournal[j].in, report.byJournal[j].out, report.closing[j] ?? 0]),
    ['Total', '', report.totals.in, report.totals.out, ''],
    [],
    ['Mode de paiement', 'Entrées', 'Sorties'],
    ...Object.entries(report.byMethod).map(([k, v]) => [k, v.in, v.out]),
    [],
    ['Date', 'Heure', 'Sens', 'Nature', 'Libellé', 'Journal', 'Mode', 'Agent', 'Entrée', 'Sortie'],
    ...report.movements.map((m) => [fr(m.date), m.time, m.dir === 'IN' ? 'Entrée' : 'Sortie', m.nature, m.label, journalLabels[m.journal], m.method, m.agent,
      m.dir === 'IN' ? m.amount : '', m.dir === 'OUT' ? m.amount : '']),
  ];
  return `﻿${lines.map((l) => l.map(cell).join(';')).join('\r\n')}\r\n`;
}
