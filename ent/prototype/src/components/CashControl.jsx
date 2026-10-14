import React, { useState } from 'react';
import { Badge, Button, Card, Stat } from './ui.jsx';
import ReceiptTicket from './ReceiptTicket.jsx';
import { JOURNALS, BANKS } from '../data/accounting.js';
import { PAYMENT_METHODS } from '../rules/billing.js';
import { formatAr } from '../rules/finance.js';
import { DENOMINATIONS, expectedCash, countTotal, closingCheck, requestCancel, decideCancel, depositAlert, validateDeposit, depositReminder, salaryWindow } from '../rules/cashControl.js';
import { printOnly } from '../print.js';

// Reçus et clôture : journal des reçus du jour (duplicata, annulation avec motif validée par la
// Direction), clôture des espèces chaque soir (comptage, écart justifié) et versements en banque.
// Chaque action est horodatée et attribuée : on sait qui a fait quoi.

const TODAY = '2026-10-13';
const now = () => `13/10/2026 ${new Date().toTimeString().slice(0, 5)}`;
const inputCls = 'rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm';
const STATUS = {
  VALIDE: ['green', 'Valide'],
  ANNULATION_DEMANDEE: ['amber', 'Annulation demandée'],
  ANNULE: ['red', 'Annulé'],
};
export const methodText = (r) => {
  const m = PAYMENT_METHODS[r.method];
  if (r.method === 'ESPECES') return 'Espèces';
  return `${m.label}${r.ref ? ` n° ${r.ref}` : ''}${r.bank ? ` (${r.bank})` : ''}`;
};

function CancelForm({ onSubmit, onClose }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  return (
    <div className="mt-2 rounded-lg bg-amber-50 p-2">
      <label className="block text-xs text-amber-900">Motif de l'annulation (validé ensuite par la Direction)
        <textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} className={`mt-1 w-full ${inputCls}`} placeholder="Ex. erreur d'élève : payé pour le frère, reçu refait au bon nom" />
      </label>
      {error && <p className="text-xs text-red-700">{error}</p>}
      <div className="mt-1 flex gap-2">
        <Button className="!py-1 text-xs" onClick={() => { const e = onSubmit(reason); if (e) setError(e); }}>Envoyer la demande</Button>
        <Button variant="ghost" className="!py-1 text-xs" onClick={onClose}>Annuler</Button>
      </div>
    </div>
  );
}

function Decision({ receipt, onDecide }) {
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const decide = (approve) => { const e = onDecide(approve, comment); if (e) setError(e); };
  return (
    <div className="mt-2 rounded-lg bg-amber-50 p-2 text-xs">
      <p className="text-amber-900"><strong>Motif :</strong> {receipt.cancel.reason}</p>
      <p className="text-amber-800">Demandé par {receipt.cancel.requestedBy} le {receipt.cancel.requestedAt}</p>
      <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Commentaire (obligatoire en cas de refus)" className={`mt-1 w-full ${inputCls}`} />
      {error && <p className="text-red-700">{error}</p>}
      <div className="mt-1 flex gap-2">
        <Button className="!py-1 text-xs" onClick={() => decide(true)}>Valider l'annulation</Button>
        <Button variant="secondary" className="!py-1 text-xs" onClick={() => decide(false)}>Refuser</Button>
      </div>
    </div>
  );
}

export default function CashControl({ role, actor, receipts, setReceipts, audit, setAudit, movements, setMovements, accounts, setAccounts, closings, setClosings, safe, settings, salariesPaid = false }) {
  const isDirection = role === 'DIRECTION';
  const [cancelling, setCancelling] = useState(null);
  const [duplicate, setDuplicate] = useState(null);
  const [counts, setCounts] = useState({});
  const [explanation, setExplanation] = useState('');
  const [tried, setTried] = useState(false);
  const [deposit, setDeposit] = useState({ amount: null, bank: 'BOA Madagascar', slip: '' });
  const [depositTried, setDepositTried] = useState(false);

  const log = (entry) => setAudit((a) => [entry, ...a]);
  const cash = expectedCash(safe.morning, movements);
  const todayClosing = closings.find((c) => c.date === TODAY);
  const lastDeposit = [safe.lastDeposit, ...movements.filter((m) => m.nature === 'Dépôt en banque').map((m) => m.date)].sort().at(-1);
  const alert = depositAlert(cash, lastDeposit, TODAY, { maxAmount: safe.maxAmount, maxDays: 99 });
  const depositDates = [safe.lastDeposit, ...movements.filter((m) => m.nature === 'Dépôt en banque').map((m) => m.date)];
  // semaine des salaires (dernière semaine de cours du mois, jusqu'au paiement) : pas de rappel
  const win = salaryWindow(TODAY, settings?.calendar ?? [], { paid: salariesPaid });
  const reminder = depositReminder(TODAY, depositDates, safe.depositDays, win.inWindow);
  const slot = (iso) => safe.depositSlots[new Date(`${iso}T12:00:00Z`).getUTCDay()];
  const pending = receipts.filter((r) => r.status === 'ANNULATION_DEMANDEE');
  const valid = receipts.filter((r) => r.status !== 'ANNULE');

  const ask = (r, reason) => {
    const res = requestCancel(r, { by: actor, reason, at: now() });
    if (res.error) return res.error;
    setReceipts(receipts.map((x) => (x.number === r.number ? res.receipt : x)));
    log(res.log);
    setCancelling(null);
    return null;
  };
  const decide = (r, approve, comment) => {
    const res = decideCancel(r, { by: actor, role, approve, comment, at: now() });
    if (res.error) return res.error;
    setReceipts(receipts.map((x) => (x.number === r.number ? res.receipt : x)));
    log(res.log);
    if (approve) {
      // remboursement à la famille (même mode) et échéances de nouveau dues
      setMovements([...movements, {
        id: `x${Date.now()}`, date: TODAY, time: new Date().toTimeString().slice(0, 5), dir: 'OUT', nature: 'Remboursement famille', journal: r.journal,
        label: `Annulation du reçu ${r.number} — ${r.student}`, method: methodText(r), amount: r.total, agent: actor, receipt: r.number,
      }]);
      if (r.studentId) {
        const keys = r.lines.map((l) => l.key);
        setAccounts(accounts.map((a) => (a.id === r.studentId ? { ...a, paid: a.paid.filter((k) => !keys.includes(k)) } : a)));
      }
    }
    return null;
  };

  const counted = countTotal(counts);
  const check = closingCheck(cash, counted, explanation);
  const close = () => {
    setTried(true);
    if (check.errors.length || counted === 0) return;
    setClosings([{ date: TODAY, expected: cash, counted, diff: check.diff, status: check.status, explanation, by: actor, at: now() }, ...closings]);
    log({ at: now(), by: actor, action: 'Clôture de caisse', receipt: '—', detail: check.diff === 0 ? `Caisse juste : ${formatAr(counted)} comptés` : `Écart ${check.diff > 0 ? '+' : '−'}${formatAr(Math.abs(check.diff))} : ${explanation}` });
  };

  const depositErrors = validateDeposit(deposit, cash);
  const doDeposit = () => {
    setDepositTried(true);
    if (depositErrors.length) return;
    setMovements([...movements, {
      id: `d${Date.now()}`, date: TODAY, time: new Date().toTimeString().slice(0, 5), dir: 'OUT', nature: 'Dépôt en banque', journal: 'ECOLAGE',
      label: `Versement ${deposit.bank} — bordereau ${deposit.slip}`, method: 'Espèces', amount: deposit.amount, agent: actor, bank: deposit.bank, slip: deposit.slip,
    }]);
    log({ at: now(), by: actor, action: 'Versement en banque', receipt: '—', detail: `${formatAr(deposit.amount)} · ${deposit.bank} · bordereau ${deposit.slip}` });
    setDeposit({ amount: null, bank: deposit.bank, slip: '' });
    setDepositTried(false);
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Espèces en caisse" value={formatAr(cash)} hint={`Ouverture ${formatAr(safe.morning)}`} tone={alert.alert ? 'red' : undefined} />
        <Stat label="Reçus du jour" value={String(valid.length)} hint={formatAr(valid.reduce((s, r) => s + r.total, 0))} />
        <Stat label="Annulations à valider" value={String(pending.length)} tone={pending.length ? 'amber' : undefined} />
        <Stat label="Caisse du jour" value={todayClosing ? 'Clôturée' : 'Ouverte'} hint={todayClosing ? `par ${todayClosing.by}` : 'clôture en fin de journée'} />
      </div>

      {reminder.missed && (
        <p className="rounded-2xl bg-red-50 p-3 text-sm text-red-800"><strong>Versement oublié :</strong> aucun versement depuis le {reminder.missedDay} {reminder.missed.split('-').reverse().join('/')}. La Direction est prévenue.</p>
      )}
      {win.active ? (
        <p className="rounded-2xl bg-navy-50 p-3 text-sm text-navy-900"><strong>Semaine des salaires :</strong> pas de rappel de versement, les espèces restent au bureau pour payer le personnel. Les rappels reprennent après le paiement des salaires.</p>
      ) : reminder.dueToday ? (
        <p className="rounded-2xl bg-amber-50 p-3 text-sm text-amber-900"><strong>Jour de versement :</strong> aujourd'hui {slot(TODAY)}, verser les espèces ({formatAr(cash)}) et saisir le bordereau.</p>
      ) : (
        <p className="rounded-2xl bg-navy-50 p-3 text-sm text-navy-900">Prochain versement en banque : <strong>{reminder.nextDay} {reminder.next.split('-').reverse().join('/')} {slot(reminder.next)}</strong>. Un rappel est envoyé au bureau ce jour-là, et à la Direction si le versement n'est pas saisi. Pas de rappel pendant la semaine des salaires (à partir du lundi {win.start.split('-').reverse().join('/')}).</p>
      )}
      {alert.alert && (
        <p className="rounded-2xl bg-red-50 p-3 text-sm text-red-800"><strong>Beaucoup d'espèces au bureau :</strong> {alert.reasons.join(' et ')} (seuil fixé par la Direction : {formatAr(safe.maxAmount)}). Verser sans attendre le prochain jour prévu.</p>
      )}

      {isDirection && pending.length > 0 && (
        <Card title="Annulations à valider" subtitle="Seule la Direction valide ou refuse ; la décision est enregistrée dans l'historique">
          <ul className="space-y-3">
            {pending.map((r) => (
              <li key={r.number} className="rounded-xl border border-amber-200 p-3 text-sm">
                <p className="font-medium">{r.number} · {r.student} ({r.cls}) · {formatAr(r.total)} · {methodText(r)}</p>
                <Decision receipt={r} onDecide={(approve, comment) => decide(r, approve, comment)} />
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card title="Reçus du jour — mardi 13 octobre 2026" subtitle="Duplicata à la demande ; annulation uniquement avec un motif, validée par la Direction">
        <div className="-mx-5 overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-y border-slate-100 bg-slate-50 text-left text-xs text-slate-500">
                <th className="px-4 py-2 font-medium">Reçu</th><th className="px-2 font-medium">Heure</th><th className="px-2 font-medium">Élève</th>
                <th className="px-2 font-medium">Mode</th><th className="px-2 text-right font-medium">Montant</th><th className="px-2 font-medium">Statut</th><th className="px-4 font-medium" />
              </tr>
            </thead>
            <tbody>
              {receipts.map((r) => (
                <tr key={r.number} className="border-b border-slate-100 align-top last:border-0">
                  <td className="px-4 py-2"><p className="font-medium tabular-nums">{r.number}</p><Badge tone={JOURNALS[r.journal].tone}>{JOURNALS[r.journal].label}</Badge></td>
                  <td className="px-2 py-2 tabular-nums text-slate-600">{r.time}</td>
                  <td className="px-2 py-2"><p>{r.student}</p><p className="text-xs text-slate-500">{r.cls} · {r.lines.map((l) => l.label).join(', ')}</p></td>
                  <td className="px-2 py-2 text-slate-600">{methodText(r)}</td>
                  <td className={`whitespace-nowrap px-2 py-2 text-right tabular-nums ${r.status === 'ANNULE' ? 'text-slate-400 line-through' : 'font-medium'}`}>{formatAr(r.total)}</td>
                  <td className="px-2 py-2">
                    <Badge tone={STATUS[r.status][0]}>{STATUS[r.status][1]}</Badge>
                    {r.cancel?.decidedBy && <p className="mt-1 text-[11px] text-slate-500">{r.cancel.approved ? 'Validée' : 'Refusée'} par {r.cancel.decidedBy}</p>}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap justify-end gap-1">
                      <Button variant="secondary" className="!px-2 !py-1 text-xs" onClick={() => setDuplicate(r)}>Duplicata</Button>
                      {r.status === 'VALIDE' && !todayClosing && <Button variant="ghost" className="!px-2 !py-1 text-xs" onClick={() => setCancelling(r.number)}>Demander l'annulation</Button>}
                    </div>
                    {cancelling === r.number && <CancelForm onSubmit={(reason) => ask(r, reason)} onClose={() => setCancelling(null)} />}
                    {!isDirection && r.status === 'ANNULATION_DEMANDEE' && <p className="mt-1 text-right text-[11px] text-amber-700">En attente de la Direction</p>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-slate-500">Un reçu n'est jamais effacé : annulé, il reste dans le journal avec son motif, la personne qui l'a demandé et celle qui l'a validé. Le remboursement sort de la caisse et les échéances redeviennent dues.</p>
      </Card>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card title="Clôture de caisse du jour" subtitle="Comptage des espèces en fin de journée : tout écart doit être expliqué">
          {todayClosing ? (
            <div className="space-y-2 text-sm">
              <Badge tone={todayClosing.diff === 0 ? 'green' : 'red'}>{todayClosing.diff === 0 ? 'Caisse juste' : `Écart ${todayClosing.diff > 0 ? '+' : '−'}${formatAr(Math.abs(todayClosing.diff))}`}</Badge>
              <p>Attendu {formatAr(todayClosing.expected)} · compté {formatAr(todayClosing.counted)}</p>
              {todayClosing.explanation && <p className="text-slate-600">Explication : {todayClosing.explanation}</p>}
              <p className="text-xs text-slate-500">Clôturée par {todayClosing.by} le {todayClosing.at}. Plus aucun encaissement ni annulation sur cette journée.</p>
            </div>
          ) : (
            <>
              <p className="mb-2 text-sm text-slate-600">Espèces attendues : <strong>{formatAr(cash)}</strong> <span className="text-xs text-slate-500">(ouverture {formatAr(safe.morning)} + encaissements − sorties et versements en espèces)</span></p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {DENOMINATIONS.map((d) => (
                  <label key={d} className="text-xs text-slate-600">{new Intl.NumberFormat('fr-FR').format(d).replace(/ | /g, ' ')} Ar
                    <input type="number" min={0} inputMode="numeric" value={counts[d] ?? ''} onChange={(e) => setCounts({ ...counts, [d]: e.target.value })} className={`mt-1 w-full ${inputCls}`} aria-label={`Nombre de ${d} Ar`} />
                  </label>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2 border-t border-slate-100 pt-3 text-sm">
                <span>Compté : <strong className="tabular-nums">{formatAr(counted)}</strong></span>
                {counted > 0 && <Badge tone={check.diff === 0 ? 'green' : 'red'}>{check.diff === 0 ? 'Caisse juste' : `${check.diff > 0 ? 'Excédent' : 'Manquant'} ${formatAr(Math.abs(check.diff))}`}</Badge>}
              </div>
              {counted > 0 && check.diff !== 0 && (
                <label className="mt-2 block text-xs text-slate-600">Explication de l'écart (transmise à la Direction)
                  <textarea rows={2} value={explanation} onChange={(e) => setExplanation(e.target.value)} className={`mt-1 w-full ${inputCls}`} />
                </label>
              )}
              {tried && (counted === 0 ? <p className="mt-1 text-xs text-red-700">Saisir le comptage des billets.</p> : check.errors.map((e) => <p key={e} className="mt-1 text-xs text-red-700">{e}</p>))}
              <Button className="mt-3 w-full" onClick={close}>Clôturer la caisse du 13/10/2026</Button>
            </>
          )}
          <p className="mb-1 mt-4 text-xs font-semibold text-slate-500">Clôtures précédentes</p>
          <ul className="divide-y divide-slate-100 text-sm">
            {closings.filter((c) => c.date !== TODAY).map((c) => (
              <li key={c.date} className="flex flex-wrap justify-between gap-2 py-1.5">
                <span>{c.date.split('-').reverse().join('/')} · {c.by}</span>
                <span className={c.diff === 0 ? 'text-emerald-700' : 'text-red-700'}>{c.diff === 0 ? 'juste' : `${c.diff > 0 ? '+' : '−'}${formatAr(Math.abs(c.diff))}`}{c.explanation ? ` · ${c.explanation}` : ''}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Versement en banque" subtitle={`Le mercredi après-midi et le vendredi après les cours · dernier versement le ${lastDeposit.split('-').reverse().join('/')}`}>
          <div className="space-y-2 text-sm">
            <label className="block text-xs text-slate-600">Montant versé (espèces en caisse : {formatAr(cash)})
              <input inputMode="numeric" value={deposit.amount === null ? '' : deposit.amount} onChange={(e) => { const d = e.target.value.replace(/\D/g, ''); setDeposit({ ...deposit, amount: d === '' ? null : Number(d) }); }} className={`mt-1 w-full ${inputCls}`} />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-slate-600">Banque
                <select value={deposit.bank} onChange={(e) => setDeposit({ ...deposit, bank: e.target.value })} className={`mt-1 w-full ${inputCls}`}>{BANKS.map((b) => <option key={b}>{b}</option>)}</select>
              </label>
              <label className="text-xs text-slate-600">N° du bordereau
                <input value={deposit.slip} onChange={(e) => setDeposit({ ...deposit, slip: e.target.value })} className={`mt-1 w-full ${inputCls}`} />
              </label>
            </div>
            {depositTried && depositErrors.map((e) => <p key={e} className="text-xs text-red-700">{e}</p>)}
            <Button className="w-full" onClick={doDeposit}>Enregistrer le versement</Button>
            <p className="text-xs text-slate-500">Le bordereau de la banque est conservé avec la clôture du jour. La Direction voit chaque versement et les espèces restant au bureau.</p>
          </div>
          <p className="mb-1 mt-4 text-xs font-semibold text-slate-500">Versements</p>
          <ul className="divide-y divide-slate-100 text-sm">
            {movements.filter((m) => m.nature === 'Dépôt en banque').map((m) => (
              <li key={m.id} className="flex justify-between gap-2 py-1.5"><span>{m.date.split('-').reverse().join('/')} {m.time} · {m.bank ?? m.label} {m.slip ? `· n° ${m.slip}` : ''}</span><span className="tabular-nums">{formatAr(m.amount)}</span></li>
            ))}
          </ul>
        </Card>
      </div>

      <Card title="Historique : qui a fait quoi" subtitle="Toutes les actions sensibles de la caisse, horodatées et nominatives (non modifiable)">
        <ul className="divide-y divide-slate-100 text-sm">
          {audit.map((a, i) => (
            <li key={i} className="grid gap-1 py-2 sm:grid-cols-[140px_180px_1fr]">
              <span className="tabular-nums text-slate-500">{a.at}</span>
              <span className="font-medium">{a.action}{a.receipt !== '—' ? ` · ${a.receipt}` : ''}</span>
              <span className="text-slate-600">{a.by} — {a.detail}</span>
            </li>
          ))}
        </ul>
      </Card>

      {duplicate && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 p-4" role="dialog" aria-label="Duplicata" onClick={() => setDuplicate(null)}>
          <div className="mx-auto w-fit space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex gap-2">
              <Button onClick={() => { printOnly('.dup-print', 'size: 80mm 200mm; margin: 2mm;'); log({ at: now(), by: actor, action: 'Duplicata imprimé', receipt: duplicate.number, detail: duplicate.student }); }}>Imprimer le duplicata</Button>
              <Button variant="secondary" onClick={() => setDuplicate(null)}>Fermer</Button>
            </div>
            <div className="dup-print"><ReceiptTicket duplicate receipt={duplicate} student={{ name: duplicate.student, cls: duplicate.cls }} payer={duplicate.bearer} cashier={duplicate.cashier} at={duplicate.at} /></div>
          </div>
        </div>
      )}
    </div>
  );
}
