import React, { useMemo, useRef, useState } from 'react';
import { Badge, Button, Card, Stat } from './ui.jsx';
import { EXPENSE_CATEGORIES } from '../data/treasury.js';
import { treasuryKpis, monthlyFlows, byCategory, expenseErrors } from '../rules/treasury.js';
import { formatAr } from '../rules/finance.js';
import { imageToDataUrl } from '../image.js';

// Dépenses et fournisseurs (secrétariat et Direction) ; tableau de bord de trésorerie (Direction).
// Une facture se prend en photo depuis le téléphone ; une dépense payée en espèces sort de la caisse.

const inputCls = 'rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm';
const fmt = (iso) => (iso ? iso.split('-').reverse().join('/') : '—');
const STATUS = { PAYE: ['green', 'payée'], EN_ATTENTE: ['amber', 'à payer'], ANNULE: ['slate', 'annulée'] };
const MONTH_LABEL = { '09': 'sept.', 10: 'oct.', 11: 'nov.', 12: 'déc.' };
// paire validée (palette de référence) : bleu = entrées, orange = sorties
const IN_COLOR = '#2a78d6';
const OUT_COLOR = '#eb6834';

export function ExpensesTab({ expenses, setExpenses, suppliers, setSuppliers, onCashOut, today }) {
  const blank = { label: '', supplierId: '', category: EXPENSE_CATEGORIES[0], amount: '', status: 'PAYE', date: today, due: '', method: 'ESPECES', ref: '', photo: null };
  const [d, setD] = useState(null);
  const [tried, setTried] = useState(false);
  const [sup, setSup] = useState(null);
  const [filter, setFilter] = useState('ALL');
  const fileRef = useRef(null);
  const x = d && { ...d, amount: Number(String(d.amount).replace(/\s/g, '')) };
  const errors = x ? expenseErrors(x) : [];
  const list = expenses.filter((e) => filter === 'ALL' || e.status === filter).sort((a, b) => (b.date ?? b.due).localeCompare(a.date ?? a.due));
  const supplierName = (id) => suppliers.find((s) => s.id === id)?.name ?? '—';
  const save = () => {
    setTried(true);
    if (errors.length) return;
    const id = `x${Date.now()}`;
    setExpenses([{ ...x, id, date: x.status === 'PAYE' ? x.date : null, due: x.due || x.date }, ...expenses]);
    if (x.status === 'PAYE' && x.method === 'ESPECES') onCashOut({ ...x, id });
    setD(null); setTried(false);
  };
  const pay = (e) => {
    setExpenses(expenses.map((y) => (y.id === e.id ? { ...y, status: 'PAYE', date: today } : y)));
    if (e.method === 'ESPECES') onCashOut({ ...e, date: today });
  };
  return (
    <div className="space-y-5">
      <Card title="Dépenses" subtitle="Factures fournisseurs, achats, abonnements ; prenez la facture en photo depuis le téléphone"
        action={<Button onClick={() => { setD(blank); setTried(false); }}>＋ Dépense</Button>}>
        {d && (
          <div className="mb-4 space-y-3 rounded-xl bg-slate-50 p-3">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <label className="text-xs text-slate-600 lg:col-span-2">Libellé<input value={d.label} onChange={(e) => setD({ ...d, label: e.target.value })} placeholder="ex. Ramettes de papier" className={`mt-1 w-full ${inputCls}`} /></label>
              <label className="text-xs text-slate-600">Montant (Ar)<input inputMode="numeric" value={d.amount} onChange={(e) => setD({ ...d, amount: e.target.value })} className={`mt-1 w-full ${inputCls}`} /></label>
              <label className="text-xs text-slate-600">Catégorie<select value={d.category} onChange={(e) => setD({ ...d, category: e.target.value })} className={`mt-1 w-full ${inputCls}`}>{EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></label>
              <label className="text-xs text-slate-600">Fournisseur<select value={d.supplierId} onChange={(e) => setD({ ...d, supplierId: e.target.value })} className={`mt-1 w-full ${inputCls}`}><option value="">—</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
              <label className="text-xs text-slate-600">État<select value={d.status} onChange={(e) => setD({ ...d, status: e.target.value })} className={`mt-1 w-full ${inputCls}`}><option value="PAYE">Payée</option><option value="EN_ATTENTE">À payer</option></select></label>
              {d.status === 'PAYE'
                ? <label className="text-xs text-slate-600">Payée le<input type="date" value={d.date} onChange={(e) => setD({ ...d, date: e.target.value })} className={`mt-1 w-full ${inputCls}`} /></label>
                : <label className="text-xs text-slate-600">Échéance<input type="date" value={d.due} onChange={(e) => setD({ ...d, due: e.target.value })} className={`mt-1 w-full ${inputCls}`} /></label>}
              <label className="text-xs text-slate-600">Mode<select value={d.method} onChange={(e) => setD({ ...d, method: e.target.value })} className={`mt-1 w-full ${inputCls}`}><option value="ESPECES">Espèces (sort de la caisse)</option><option value="VIREMENT">Virement</option><option value="CHEQUE">Chèque</option></select></label>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" onClick={() => fileRef.current.click()} className="flex h-16 w-14 items-center justify-center overflow-hidden rounded-lg border border-dashed border-slate-300 bg-white text-center text-[10px] text-slate-500">
                {d.photo ? <img src={d.photo} alt="Facture" className="h-full w-full object-cover" /> : <>Photo de la facture</>}
              </button>
              <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" aria-label="Photo de la facture" onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) setD({ ...d, photo: await imageToDataUrl(f, 1400, 0.7) }); }} />
              <p className="text-xs text-slate-500">Photo obligatoire au-delà de 100 000 Ar.</p>
              <span className="ml-auto flex gap-2"><Button onClick={save}>Enregistrer</Button><Button variant="secondary" onClick={() => setD(null)}>Annuler</Button></span>
            </div>
            {tried && errors.length > 0 && <ul className="text-sm text-red-700">{errors.map((e) => <li key={e}>· {e}</li>)}</ul>}
          </div>
        )}
        <div className="mb-2 flex gap-1.5 text-xs">
          {[['ALL', 'Toutes'], ['EN_ATTENTE', 'À payer'], ['PAYE', 'Payées']].map(([k, l]) => <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)} className={`rounded-full px-2.5 py-0.5 font-medium ring-1 ${filter === k ? 'bg-navy-500 text-white ring-navy-500' : 'bg-white ring-slate-300'}`}>{l}</button>)}
        </div>
        <div className="-mx-5 overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead><tr className="border-y border-slate-100 bg-slate-50 text-left text-xs text-slate-500">
              <th className="px-4 py-2 font-medium">Dépense</th><th className="px-2 font-medium">Fournisseur</th><th className="px-2 font-medium">Catégorie</th><th className="px-2 text-right font-medium">Montant</th><th className="px-2 font-medium">Date / échéance</th><th className="px-4 font-medium">État</th>
            </tr></thead>
            <tbody>
              {list.map((e) => (
                <tr key={e.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-2 text-slate-800">{e.label}{e.photo && <img src={e.photo} alt="Facture" className="ml-2 inline h-6 w-5 rounded object-cover" />}</td>
                  <td className="px-2 text-slate-600">{supplierName(e.supplierId)}</td>
                  <td className="px-2 text-slate-600">{e.category}</td>
                  <td className="px-2 text-right tabular-nums">{formatAr(e.amount)}</td>
                  <td className="px-2 tabular-nums text-slate-600">{e.status === 'PAYE' ? fmt(e.date) : `avant le ${fmt(e.due)}`}</td>
                  <td className="px-4"><span className="flex items-center gap-2"><Badge tone={STATUS[e.status][0]}>{STATUS[e.status][1]}</Badge>{e.status === 'EN_ATTENTE' && <Button variant="secondary" className="!px-2 !py-0.5 text-xs" onClick={() => pay(e)}>Payer</Button>}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Card title="Fournisseurs" action={<Button variant="secondary" onClick={() => setSup({ name: '', category: EXPENSE_CATEGORIES[0], contact: '', note: '' })}>＋ Fournisseur</Button>}>
        {sup && (
          <div className="mb-3 grid gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-2 lg:grid-cols-5">
            <input value={sup.name} onChange={(e) => setSup({ ...sup, name: e.target.value })} placeholder="Nom" className={inputCls} />
            <select value={sup.category} onChange={(e) => setSup({ ...sup, category: e.target.value })} className={inputCls}>{EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
            <input value={sup.contact} onChange={(e) => setSup({ ...sup, contact: e.target.value })} placeholder="Contact" className={inputCls} />
            <input value={sup.note} onChange={(e) => setSup({ ...sup, note: e.target.value })} placeholder="Note" className={inputCls} />
            <span className="flex gap-2"><Button disabled={!sup.name.trim()} onClick={() => { setSuppliers([...suppliers, { ...sup, id: `s${Date.now()}` }]); setSup(null); }}>Ajouter</Button><Button variant="secondary" onClick={() => setSup(null)}>Annuler</Button></span>
          </div>
        )}
        <ul className="divide-y divide-slate-100 text-sm">
          {suppliers.map((s) => {
            const owed = expenses.filter((e) => e.supplierId === s.id && e.status === 'EN_ATTENTE').reduce((t, e) => t + e.amount, 0);
            return <li key={s.id} className="flex flex-wrap justify-between gap-2 py-2"><span><span className="font-medium text-slate-800">{s.name}</span> <span className="text-xs text-slate-500">· {s.category} · {s.contact}{s.note ? ` · ${s.note}` : ''}</span></span>{owed > 0 ? <Badge tone="amber">à payer : {formatAr(owed)}</Badge> : <Badge tone="green">à jour</Badge>}</li>;
          })}
        </ul>
      </Card>
    </div>
  );
}

/** Graphique entrées / sorties par mois (un seul axe, deux séries, légende, valeurs au survol). */
function FlowsChart({ data }) {
  const W = 640; const H = 220; const pad = { l: 8, r: 8, t: 12, b: 26 };
  const max = Math.max(1, ...data.flatMap((m) => [m.in, m.out]));
  const gw = (W - pad.l - pad.r) / data.length; const bw = Math.min(34, gw / 3);
  const y = (v) => pad.t + (H - pad.t - pad.b) * (1 - v / max);
  const bar = (x, v, color, label) => {
    const top = y(v); const h = H - pad.b - top;
    return <path d={`M${x},${H - pad.b} V${top + 4} Q${x},${top} ${x + 4},${top} H${x + bw - 4} Q${x + bw},${top} ${x + bw},${top + 4} V${H - pad.b} Z`} fill={color}><title>{label}</title></path>;
  };
  return (
    <figure className="max-w-[640px]">
      <div className="mb-1 flex gap-4 text-xs text-slate-600">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: IN_COLOR }} />Entrées</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: OUT_COLOR }} />Sorties</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Entrées et sorties par mois">
        <line x1={pad.l} x2={W - pad.r} y1={H - pad.b} y2={H - pad.b} stroke="#cbd5e1" />
        {data.map((m, i) => {
          const cx = pad.l + gw * i + gw / 2;
          return (
            <g key={m.month}>
              {bar(cx - bw - 1, m.in, IN_COLOR, `${MONTH_LABEL[m.month.slice(5)] ?? m.month} — entrées : ${formatAr(m.in)}`)}
              {bar(cx + 1, m.out, OUT_COLOR, `${MONTH_LABEL[m.month.slice(5)] ?? m.month} — sorties : ${formatAr(m.out)}`)}
              <text x={cx} y={H - 8} textAnchor="middle" fontSize="11" fill="#475569">{MONTH_LABEL[m.month.slice(5)] ?? m.month}</text>
            </g>
          );
        })}
      </svg>
      <table className="mt-2 w-full text-xs text-slate-600">
        <thead><tr><th className="text-left font-medium">Mois</th><th className="text-right font-medium">Entrées</th><th className="text-right font-medium">Sorties</th><th className="text-right font-medium">Solde du mois</th></tr></thead>
        <tbody>{data.map((m) => <tr key={m.month}><td>{MONTH_LABEL[m.month.slice(5)] ?? m.month}</td><td className="text-right tabular-nums">{formatAr(m.in)}</td><td className="text-right tabular-nums">{formatAr(m.out)}</td><td className="text-right tabular-nums">{formatAr(m.in - m.out)}</td></tr>)}</tbody>
      </table>
    </figure>
  );
}

export function TreasuryDashboard({ tx, opening, months }) {
  const k = useMemo(() => treasuryKpis(tx, opening), [tx, opening]);
  const flows = useMemo(() => monthlyFlows(tx, months), [tx, months]);
  const cats = byCategory(tx, `${months[months.length - 1]}-01`, `${months[months.length - 1]}-31`);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label="Trésorerie nette" value={formatAr(k.net)} hint="Ce qui est encaissé moins ce qui est payé (caisse et banque)" tone={k.net < 0 ? 'red' : 'green'} />
        <Stat label="Reste à recouvrer" value={formatAr(k.toCollect)} hint="Ce que les familles doivent encore" tone="amber" />
        <Stat label="Dépenses engagées" value={formatAr(k.committed)} hint="Salaires du mois et factures non payés" />
      </div>
      <div className="grid gap-5 xl:grid-cols-[1fr_340px] xl:items-start">
        <Card title="Entrées et sorties par mois" subtitle="Montants payés, toutes caisses confondues"><FlowsChart data={flows} /></Card>
        <Card title="Dépenses du mois par catégorie">
          <ul className="space-y-1.5 text-sm">{cats.map(([c, v]) => <li key={c} className="flex justify-between gap-2"><span className="text-slate-700">{c}</span><span className="tabular-nums">{formatAr(v)}</span></li>)}</ul>
          {!cats.length && <p className="text-sm text-slate-500">Aucune dépense payée ce mois-ci.</p>}
        </Card>
      </div>
    </div>
  );
}
