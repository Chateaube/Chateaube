import React from 'react';
import { JOURNALS } from '../data/accounting.js';
import { PAYMENT_METHODS } from '../rules/billing.js';
import { amountInWords } from '../rules/finance.js';

// Reçu au format ticket de caisse (imprimante thermique 80 mm) : un ticket par journal.
const num = (n) => new Intl.NumberFormat('fr-FR').format(n).replace(/ | /g, ' ');

function Row({ left, right, bold }) {
  return (
    <div className={`flex justify-between gap-3 ${bold ? 'font-bold' : ''}`}>
      <span className="min-w-0">{left}</span>
      <span className="shrink-0 tabular-nums">{right}</span>
    </div>
  );
}
const Rule = () => <div className="my-1.5 border-t border-dashed border-slate-400" />;

export default function ReceiptTicket({ receipt, student, payer, cashier, at }) {
  const method = PAYMENT_METHODS[receipt.method];
  return (
    <div className="ticket w-[300px] bg-white px-4 py-5 font-mono text-[11.5px] leading-snug text-black shadow-soft">
      <div className="text-center">
        <p className="text-sm font-bold tracking-wide">ÉCOLE CHATEAUBRIAND</p>
        <p>Collège – Lycée · Tamatave</p>
        <p>Programme français · depuis 1994</p>
      </div>
      <Rule />
      <p className="text-center font-bold">REÇU N° {receipt.number}</p>
      <p className="text-center">{JOURNALS[receipt.journal].label}</p>
      <Rule />
      <Row left="Date" right={at} />
      <Row left="Élève" right={student.name} />
      <Row left="Classe" right={student.cls} />
      {payer && <Row left="Payeur" right={payer} />}
      <Rule />
      {receipt.lines.map((l) => <Row key={l.key} left={l.label} right={num(l.amount)} />)}
      <Rule />
      <div className="text-[13px]"><Row bold left="TOTAL (Ar)" right={num(receipt.total)} /></div>
      <p className="mt-1 italic">{amountInWords(receipt.total).replace(/^./, (c) => c.toUpperCase())}</p>
      <Rule />
      <Row left="Règlement" right={method.label} />
      {receipt.ref && <Row left={method.refLabel.replace(' / référence', '')} right={receipt.ref} />}
      {receipt.bank && <Row left="Banque" right={receipt.bank} />}
      <Row left="Caisse" right={cashier} />
      <Rule />
      <p className="text-center">Merci. Reçu à conserver.</p>
      <p className="text-center">Copie envoyée par e-mail et dans l'application.</p>
      <p className="mt-2 text-center tracking-[0.3em]">✂ - - - - - - - - - - -</p>
    </div>
  );
}
