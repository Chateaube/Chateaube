import React, { useMemo, useState } from 'react';
import { Badge, Button, Card, Icon } from './ui.jsx';
import { JOURNALS, CLASS_FEES, STUDENT_ACCOUNTS, BANKS } from '../data/accounting.js';
import { studentDues, defaultSelection, validateInstrument, buildReceipts, PAYMENT_METHODS } from '../rules/billing.js';
import { formatAr } from '../rules/finance.js';

const TODAY = '2026-10-13';
const fmtDate = (iso) => iso.split('-').reverse().join('/');
const inputCls = 'rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm';
const STATUS_UI = {
  PAYE: { cls: 'border-emerald-200 bg-emerald-50 text-emerald-800', label: 'Payé' },
  ECHU: { cls: 'border-red-200 bg-white text-slate-800', label: 'Échu' },
  A_ECHOIR: { cls: 'border-slate-200 bg-white text-slate-700', label: 'À échoir' },
};

function DueTile({ item, checked, onToggle }) {
  const ui = STATUS_UI[item.status];
  const paid = item.status === 'PAYE';
  return (
    <label className={`flex cursor-pointer items-start gap-2 rounded-lg border p-2.5 text-sm transition
      ${paid ? `${ui.cls} cursor-default` : checked ? 'border-navy-500 bg-navy-50 ring-1 ring-navy-500' : ui.cls}`}>
      <input type="checkbox" className="mt-0.5" checked={paid || checked} disabled={paid} onChange={onToggle} />
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{item.short ?? item.label}</span>
        <span className="block text-xs text-slate-500">{formatAr(item.amount)} · {paid ? 'payé' : `${ui.label.toLowerCase()} le ${fmtDate(item.due)}`}</span>
      </span>
      {item.status === 'ECHU' && !checked && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-red-500" title="Échu, non sélectionné" />}
    </label>
  );
}

export default function CollectPayment({ settings }) {
  const [accounts, setAccounts] = useState(STUDENT_ACCOUNTS);
  const [query, setQuery] = useState('');
  const [studentId, setStudentId] = useState('e2');
  const [selected, setSelected] = useState(null); // null = proposition par défaut
  const [instrument, setInstrument] = useState({ method: 'ESPECES', ref: '', bank: '' });
  const [receipts, setReceipts] = useState(null);
  const [counter, setCounter] = useState({ ECOLAGE: 412, FRAIS_ANNEXES: 208, DROITS_EXAMEN: 57 });

  const student = accounts.find((a) => a.id === studentId);
  const fees = CLASS_FEES.find((r) => r.cls === student.cls);
  const items = useMemo(() => studentDues(student, fees, settings, TODAY), [student, fees, settings]);
  const keys = selected ?? defaultSelection(items);
  const chosen = items.filter((i) => keys.includes(i.key) && i.status !== 'PAYE');
  const total = chosen.reduce((s, i) => s + i.amount, 0);
  const errors = validateInstrument(instrument);
  const overdue = items.filter((i) => i.status === 'ECHU');

  const pick = (id) => { setStudentId(id); setSelected(null); setReceipts(null); setInstrument({ method: 'ESPECES', ref: '', bank: '' }); };
  const toggle = (key) => setSelected(keys.includes(key) ? keys.filter((k) => k !== key) : [...keys, key]);
  const months = items.filter((i) => i.journal === 'ECOLAGE');
  const others = items.filter((i) => i.journal !== 'ECOLAGE');
  const unpaidMonths = months.filter((m) => m.status !== 'PAYE');

  const collect = () => {
    const next = { ...counter };
    const r = buildReceipts(items, keys, instrument, (j) => ++next[j]);
    setCounter(next);
    setAccounts(accounts.map((a) => (a.id === studentId ? { ...a, paid: [...a.paid, ...chosen.map((c) => c.key)] } : a)));
    setReceipts(r);
    setSelected([]);
  };

  const matches = accounts.filter((a) => `${a.name} ${a.cls} ${a.family}`.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="grid gap-5 xl:grid-cols-[260px_1fr_340px] xl:items-start">
      <Card title="Élève">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher un nom, une classe…" className={`w-full ${inputCls}`} />
        <ul className="-mx-2 mt-2 space-y-0.5">
          {matches.map((a) => (
            <li key={a.id}>
              <button onClick={() => pick(a.id)} className={`w-full rounded-md px-2 py-1.5 text-left text-sm ${a.id === studentId ? 'bg-navy-50 font-medium text-navy-900' : 'hover:bg-slate-50'}`}>
                {a.name}
                <span className="block text-xs font-normal text-slate-500">{a.cls}{a.isNew ? ` · arrivé.e le ${fmtDate(a.enrolledOn)}` : ''}</span>
              </button>
            </li>
          ))}
        </ul>
      </Card>

      <Card
        title={student.name}
        subtitle={`${student.cls} · ${student.family}${student.isNew ? ` · nouvel élève : compte ouvert au ${fmtDate(student.enrolledOn)}` : ''}`}
        action={overdue.length > 0 ? <Badge tone="red">{overdue.length} échéance{overdue.length > 1 ? 's' : ''} échue{overdue.length > 1 ? 's' : ''}</Badge> : <Badge tone="green">À jour</Badge>}
      >
        <div className="mb-3 flex flex-wrap gap-2">
          <Button variant="secondary" className="!py-1 text-xs" onClick={() => setSelected(defaultSelection(items))}>Proposition : tout l'échu</Button>
          <Button variant="secondary" className="!py-1 text-xs" onClick={() => setSelected(items.filter((i) => i.status !== 'PAYE' && (i.journal !== 'ECOLAGE' || i.due <= '2026-12-31')).map((i) => i.key))}>Jusqu'à décembre (1er trimestre)</Button>
          <Button variant="secondary" className="!py-1 text-xs" onClick={() => setSelected(items.filter((i) => i.status !== 'PAYE').map((i) => i.key))}>Toute l'année</Button>
          <Button variant="ghost" className="!py-1 text-xs" onClick={() => setSelected([])}>Tout décocher</Button>
        </div>

        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Écolage — {months.length} mois ({unpaidMonths.length} restant{unpaidMonths.length > 1 ? 's' : ''})</p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {months.map((m) => <DueTile key={m.key} item={m} checked={keys.includes(m.key)} onToggle={() => toggle(m.key)} />)}
        </div>
        <p className="mb-1.5 mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Frais annuels et examens</p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {others.map((m) => <DueTile key={m.key} item={m} checked={keys.includes(m.key)} onToggle={() => toggle(m.key)} />)}
        </div>
        <p className="mt-3 text-xs text-slate-500">Les articles (tee-shirt, natation, manuel perdu…) se facturent depuis l'onglet États de compte puis apparaissent ici.</p>
      </Card>

      <div className="space-y-5">
        <Card title="Règlement">
          {chosen.length === 0 ? <p className="text-sm text-slate-500">Cochez les échéances à régler.</p> : (
            <ul className="space-y-1 text-sm">
              {Object.keys(JOURNALS).map((j) => {
                const lines = chosen.filter((c) => c.journal === j);
                if (!lines.length) return null;
                return (
                  <li key={j} className="rounded-md bg-slate-50 p-2">
                    <div className="flex items-center justify-between"><Badge tone={JOURNALS[j].tone}>{JOURNALS[j].label}</Badge><span className="font-medium tabular-nums">{formatAr(lines.reduce((s, l) => s + l.amount, 0))}</span></div>
                    <p className="mt-1 text-xs text-slate-500">{lines.map((l) => l.label).join(' · ')}</p>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="mt-3 flex items-baseline justify-between border-t border-slate-100 pt-3">
            <span className="text-sm text-slate-600">Total</span>
            <span className="text-xl font-semibold tabular-nums text-navy-900">{formatAr(total)}</span>
          </div>

          <fieldset className="mt-4">
            <legend className="text-xs font-medium text-slate-600">Mode de paiement</legend>
            <div className="mt-1.5 grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1">
              {Object.entries(PAYMENT_METHODS).map(([k, m]) => (
                <button key={k} type="button" aria-pressed={instrument.method === k} onClick={() => setInstrument({ method: k, ref: '', bank: '' })}
                  className={`rounded-md py-1.5 text-sm font-medium ${instrument.method === k ? 'bg-white text-navy-900 shadow-sm' : 'text-slate-600'}`}>{m.label}</button>
              ))}
            </div>
          </fieldset>
          {PAYMENT_METHODS[instrument.method].needsRef && (
            <div className="mt-3 space-y-2">
              <label className="block text-xs text-slate-600">{PAYMENT_METHODS[instrument.method].refLabel}
                <input value={instrument.ref} onChange={(e) => setInstrument({ ...instrument, ref: e.target.value })}
                  inputMode={instrument.method === 'CHEQUE' ? 'numeric' : 'text'} className={`mt-1 w-full ${inputCls}`} />
              </label>
              <label className="block text-xs text-slate-600">Banque
                <select value={instrument.bank} onChange={(e) => setInstrument({ ...instrument, bank: e.target.value })} className={`mt-1 w-full ${inputCls}`}>
                  <option value="">Choisir…</option>{BANKS.map((b) => <option key={b}>{b}</option>)}
                </select>
              </label>
              {instrument.ref && errors.map((e) => <p key={e} className="text-xs text-red-700">{e}</p>)}
            </div>
          )}
          <Button className="mt-4 w-full" disabled={!chosen.length || errors.length > 0} onClick={collect}>
            Encaisser {total > 0 && formatAr(total)}
          </Button>
          <p className="mt-2 text-[11px] text-slate-500">Un reçu est édité par journal (écolage, frais annexes, droits d'examen).</p>
        </Card>

        {receipts && (
          <Card title="Reçus édités" action={<Button variant="secondary" onClick={() => window.print()}>Imprimer</Button>}>
            <ul className="space-y-2">
              {receipts.map((r) => (
                <li key={r.number} className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm">
                  <div className="flex items-center justify-between"><span className="font-semibold text-emerald-900">{r.number}</span><span className="font-semibold tabular-nums">{formatAr(r.total)}</span></div>
                  <p className="text-xs text-emerald-800">{JOURNALS[r.journal].label} · {PAYMENT_METHODS[r.method].label}{r.ref ? ` n° ${r.ref} · ${r.bank}` : ''}</p>
                  <p className="mt-1 text-xs text-slate-600">{r.lines.map((l) => l.label).join(' · ')}</p>
                </li>
              ))}
            </ul>
            <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500"><Icon name="bell" />Reçu envoyé au parent payeur par e-mail et dans l'application.</p>
          </Card>
        )}
      </div>
    </div>
  );
}
