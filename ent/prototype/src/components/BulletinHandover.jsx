import React, { useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card } from './ui.jsx';
import { CASH_ACCOUNTS, feesFor } from './CollectPayment.jsx';
import { REDUCTION_TYPES } from '../data/accounting.js';
import { studentDues } from '../rules/billing.js';
import { manualBlocks } from '../rules/manuals.js';
import { formatAr } from '../rules/finance.js';
import { loadManuals } from '../manualsStore.js';

// Remise des bulletins en main propre (avec le tampon) : jamais publiés dans l'application.
// Un bulletin n'est pas remis tant que des frais échus restent impayés ou qu'un manuel est dû ;
// seule la Direction peut lever le blocage, avec un motif.

const TODAY = '2026-10-13';
const KEY = 'ent-remise-v1';
const inputCls = 'rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm';
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) ?? {}; } catch { return {}; } };

/** Ce qui bloque la remise : frais échus non payés (tous journaux) et manuels dus. */
export function handoverBlocks(student, settings, manualsData) {
  const reasons = [];
  const acc = CASH_ACCOUNTS.find((a) => a.name === student);
  const fees = acc && feesFor(acc, manualsData.manuals);
  if (acc && fees) {
    const type = acc.reduction && REDUCTION_TYPES.find((t) => t.id === acc.reduction.typeId);
    const reduction = type ? { label: type.label, rates: type.rates } : null;
    const overdue = studentDues({ ...acc, reduction }, fees, settings, TODAY).filter((i) => i.status === 'ECHU');
    if (overdue.length) reasons.push(`Frais impayés : ${overdue.map((i) => i.short ?? i.label).join(', ')} (${formatAr(overdue.reduce((s, i) => s + i.amount, 0))})`);
  }
  return [...reasons, ...manualBlocks(student, manualsData.loans, manualsData.manuals, TODAY)];
}

export default function BulletinHandover({ cls, students, settings, role, term }) {
  const [records, setRecords] = useState(load);
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(records)); } catch { /* stockage indisponible */ } }, [records]);
  const manualsData = useMemo(loadManuals, []);
  const [form, setForm] = useState({});
  const isDirection = role === 'DIRECTION';
  const actor = isDirection ? 'Mme Sheena Lo (Direction)' : 'Mme Hanta (bureau)';
  const key = (s) => `${term}|${cls}|${s}`;
  const rows = students.map((s) => ({ s, blocks: handoverBlocks(s, settings, manualsData), rec: records[key(s)] }));
  const given = rows.filter((r) => r.rec?.givenAt).length;
  const blocked = rows.filter((r) => r.blocks.length && !r.rec?.override && !r.rec?.givenAt).length;
  const set = (s, patch) => setForm({ ...form, [s]: { to: 'PARENT', name: '', motif: '', ...form[s], ...patch } });

  return (
    <Card title={`Remise en main propre — ${cls}`} subtitle="Bulletin tamponné, remis au parent ou à l'élève ; il n'est jamais publié dans l'application"
      action={<span className="flex gap-2"><Badge tone="green">{given} remis</Badge>{blocked > 0 && <Badge tone="red">{blocked} bloqué{blocked > 1 ? 's' : ''}</Badge>}</span>}>
      <ul className="divide-y divide-slate-100">
        {rows.map(({ s, blocks, rec }) => {
          const f = form[s] ?? { to: 'PARENT', name: '', motif: '' };
          const canGive = !blocks.length || rec?.override;
          return (
            <li key={s} className="py-3 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-slate-800">{s}</p>
                  {!rec?.givenAt && blocks.map((b) => <p key={b} className="text-xs text-red-700">{b}</p>)}
                  {rec?.override && <p className="text-xs text-amber-700">Blocage levé par {rec.override.by} : {rec.override.motif}</p>}
                  {rec?.givenAt && <p className="text-xs text-emerald-700">Remis le {rec.givenAt} à {rec.givenTo} · par {rec.givenBy}</p>}
                </div>
                {rec?.givenAt ? <Badge tone="green">Remis</Badge> : canGive ? (
                  <span className="flex flex-wrap items-center gap-1">
                    <select value={f.to} onChange={(e) => set(s, { to: e.target.value })} className="rounded-md border border-slate-300 px-1.5 py-1 text-xs" aria-label={`Remis à — ${s}`}>
                      <option value="PARENT">au parent</option><option value="ELEVE">à l'élève</option><option value="AUTRE">à une autre personne</option>
                    </select>
                    {f.to !== 'ELEVE' && <input value={f.name} onChange={(e) => set(s, { name: e.target.value })} placeholder="Nom" className="w-36 rounded-md border border-slate-300 px-2 py-1 text-xs" aria-label={`Nom — ${s}`} />}
                    <Button className="!px-2 !py-1 text-xs" disabled={f.to !== 'ELEVE' && !f.name.trim()} onClick={() => setRecords({ ...records, [key(s)]: { ...rec, givenAt: '13/10/2026', givenBy: actor, givenTo: f.to === 'ELEVE' ? `l'élève (${s})` : f.name.trim() } })}>Remis en main propre</Button>
                  </span>
                ) : isDirection ? (
                  <span className="flex flex-wrap items-center gap-1">
                    <input value={f.motif} onChange={(e) => set(s, { motif: e.target.value })} placeholder="Motif (ex. échéancier accordé)" className={`w-52 text-xs ${inputCls}`} aria-label={`Motif — ${s}`} />
                    <Button variant="secondary" className="!px-2 !py-1 text-xs" disabled={f.motif.trim().length < 5} onClick={() => setRecords({ ...records, [key(s)]: { override: { by: actor, motif: f.motif.trim(), at: '13/10/2026' } } })}>Lever le blocage</Button>
                  </span>
                ) : <Badge tone="red">Bloqué</Badge>}
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-xs text-slate-500">Dès que la famille règle à la caisse, ou rend le manuel, le blocage disparaît. Les parents voient les notes dans l'application, jamais le bulletin.</p>
    </Card>
  );
}
