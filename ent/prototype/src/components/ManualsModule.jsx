import React, { useEffect, useState } from 'react';
import { Badge, Button, Card, Stat } from './ui.jsx';
import { CLASSES } from '../data/schoollife.js';
import { ARTICLES } from '../data/accounting.js';
import { CONDITIONS, KINDS, BINDINGS, conditionLabel, lentCount, totalCopies, lend, giveBack, manualBlocks } from '../rules/manuals.js';
import { formatAr } from '../rules/finance.js';
import { loadManuals, saveManuals } from '../manualsStore.js';

// Manuels scolaires (Bureau et Direction) : stock par état (neuf, bon, usé, déchiré), originaux ou
// photocopies, dos carré ou reliure ; prêts aux élèves, retours, pertes à régler à la caisse.

const TODAY = '2026-10-13';
const YEAR_END = '2027-06-30';
const inputCls = 'rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm';
const fmt = (iso) => (iso ? iso.split('-').reverse().join('/') : '');
const TONE = { NEUF: 'green', BON: 'navy', USE: 'amber', DECHIRE: 'red', PERDU: 'red' };
const LOST_PRICE = ARTICLES.find((a) => a.id === 'a1')?.price ?? 0;
const TABS = [['stock', 'Stock'], ['loans', 'Prêts par classe'], ['due', 'À régler et non rendus']];

function StockTab({ manuals, setManuals, loans }) {
  const [draft, setDraft] = useState({ title: '', subject: '', level: '6e', kind: 'ORIGINAL', binding: 'DOS_CARRE', state: 'NEUF', qty: 1 });
  const [receive, setReceive] = useState({ op: 'IN', id: '', state: 'NEUF', qty: 1 });
  const [stockError, setStockError] = useState('');
  const moveStock = () => {
    const m = manuals.find((x) => x.id === receive.id);
    const from = receive.op === 'REPAIR' ? 'DECHIRE' : receive.state;
    if (receive.op !== 'IN' && (m.stock[from] ?? 0) < receive.qty) { setStockError(`Seulement ${m.stock[from] ?? 0} exemplaire(s) « ${conditionLabel(from)} » en réserve.`); return; }
    const stock = { ...m.stock };
    if (receive.op === 'IN') stock[receive.state] = (stock[receive.state] ?? 0) + receive.qty;
    if (receive.op === 'OUT') stock[from] -= receive.qty;
    if (receive.op === 'REPAIR') { stock.DECHIRE -= receive.qty; stock.USE = (stock.USE ?? 0) + receive.qty; }
    setManuals(manuals.map((x) => (x.id === m.id ? { ...m, stock } : x)));
    setStockError('');
    setReceive({ ...receive, qty: 1 });
  };
  const totals = manuals.reduce((t, m) => ({ stock: t.stock + Object.values(m.stock).reduce((a, b) => a + b, 0), lent: t.lent + lentCount(m, loans), torn: t.torn + m.stock.DECHIRE }), { stock: 0, lent: 0, torn: 0 });
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Titres" value={String(manuals.length)} />
        <Stat label="Exemplaires en réserve" value={String(totals.stock)} />
        <Stat label="Prêtés aux élèves" value={String(totals.lent)} />
        <Stat label="Déchirés à réparer" value={String(totals.torn)} tone={totals.torn ? 'amber' : undefined} />
      </div>
      <Card title="Catalogue et stock" subtitle="Exemplaires en réserve au bureau, par état ; les prêtés sont comptés à part">
        <div className="-mx-5 overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-y border-slate-100 bg-slate-50 text-left text-xs text-slate-500">
                <th className="px-4 py-2 font-medium">Manuel</th><th className="px-2 font-medium">Classe(s)</th><th className="px-2 font-medium">Type</th>
                {CONDITIONS.map((c) => <th key={c.id} className="px-2 text-right font-medium">{c.label}</th>)}
                <th className="px-2 text-right font-medium">Prêtés</th><th className="px-4 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {manuals.map((m) => (
                <tr key={m.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-2"><p className="font-medium text-slate-800">{m.title}</p><p className="text-xs text-slate-500">{m.subject}</p></td>
                  <td className="px-2 text-slate-600">{m.levels.join(', ')}</td>
                  <td className="px-2"><Badge tone={m.kind === 'ORIGINAL' ? 'navy' : 'slate'}>{KINDS[m.kind]}</Badge> <span className="text-xs text-slate-500">{BINDINGS[m.binding]}</span></td>
                  {CONDITIONS.map((c) => <td key={c.id} className={`px-2 text-right tabular-nums ${c.id === 'DECHIRE' && m.stock.DECHIRE ? 'text-red-700' : ''}`}>{m.stock[c.id] ?? 0}</td>)}
                  <td className="px-2 text-right tabular-nums">{lentCount(m, loans)}</td>
                  <td className="px-4 text-right font-semibold tabular-nums">{totalCopies(m, loans)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Mouvement de stock" subtitle="Entrée (achat, photocopies), réparation ou réforme d'exemplaires">
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <select value={receive.op} onChange={(e) => setReceive({ ...receive, op: e.target.value })} className={inputCls} aria-label="Opération">
              <option value="IN">Entrée en réserve</option><option value="REPAIR">Réparation (déchiré → usé)</option><option value="OUT">Réforme (sortie définitive)</option>
            </select>
            <select value={receive.id} onChange={(e) => setReceive({ ...receive, id: e.target.value })} className={inputCls} aria-label="Manuel reçu">
              <option value="">Manuel…</option>{manuals.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
            </select>
            {receive.op !== 'REPAIR' && (
              <select value={receive.state} onChange={(e) => setReceive({ ...receive, state: e.target.value })} className={inputCls} aria-label="État">
                {CONDITIONS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            )}
            <input type="number" min={1} value={receive.qty} onChange={(e) => setReceive({ ...receive, qty: Math.max(1, Number(e.target.value) || 1) })} className={inputCls} aria-label="Quantité" />
            {stockError && <p className="text-xs text-red-700 sm:col-span-2">{stockError}</p>}
            <Button className="sm:col-span-2" disabled={!receive.id} onClick={moveStock}>Enregistrer</Button>
          </div>
        </Card>
        <Card title="Nouveau manuel" subtitle="Original ou photocopie, dos carré ou reliure">
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Titre (ex. Histoire-Géographie 4e)" className={`sm:col-span-2 ${inputCls}`} aria-label="Titre" />
            <input value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} placeholder="Matière" className={inputCls} aria-label="Matière" />
            <select value={draft.level} onChange={(e) => setDraft({ ...draft, level: e.target.value })} className={inputCls} aria-label="Classe">
              {['6e', '5e', '4e', '3e', '2de', '1re Générale', '1re STMG', 'Terminale Générale', 'Terminale STMG'].map((c) => <option key={c}>{c}</option>)}
            </select>
            <select value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value })} className={inputCls} aria-label="Type">{Object.entries(KINDS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
            <select value={draft.binding} onChange={(e) => setDraft({ ...draft, binding: e.target.value })} className={inputCls} aria-label="Reliure">{Object.entries(BINDINGS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
            <select value={draft.state} onChange={(e) => setDraft({ ...draft, state: e.target.value })} className={inputCls} aria-label="État des exemplaires">{CONDITIONS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select>
            <input type="number" min={1} value={draft.qty} onChange={(e) => setDraft({ ...draft, qty: Math.max(1, Number(e.target.value) || 1) })} className={inputCls} aria-label="Nombre d'exemplaires" />
            <Button className="sm:col-span-2" disabled={!draft.title.trim()} onClick={() => {
              setManuals([...manuals, { id: `m${Date.now()}`, title: draft.title.trim(), subject: draft.subject.trim() || '—', levels: [draft.level], kind: draft.kind, binding: draft.binding, stock: { NEUF: 0, BON: 0, USE: 0, DECHIRE: 0, [draft.state]: draft.qty } }]);
              setDraft({ ...draft, title: '', subject: '', qty: 1 });
            }}>Ajouter au catalogue</Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

function LoansTab({ manuals, setManuals, loans, setLoans }) {
  const [cls, setCls] = useState('1re STMG');
  const forClass = manuals.filter((m) => m.levels.includes(cls));
  const [manualId, setManualId] = useState(forClass[0]?.id ?? '');
  const [state, setState] = useState('BON');
  const [returning, setReturning] = useState({});
  const [error, setError] = useState('');
  const manual = manuals.find((m) => m.id === manualId);
  const students = CLASSES[cls] ?? [];
  // état de sortie proposé : le meilleur état encore disponible en stock
  const firstAvailable = (m) => CONDITIONS.find((c) => c.id !== 'DECHIRE' && m?.stock[c.id] > 0)?.id ?? 'BON';
  useEffect(() => { setState(firstAvailable(manual)); }, [manualId]); // eslint-disable-line react-hooks/exhaustive-deps
  const loanOf = (s) => [...loans].reverse().find((l) => l.manualId === manualId && l.student === s);

  const doLend = (students) => {
    let m = manual;
    const added = [];
    for (const s of students) {
      const r = lend(m, [...loans, ...added], { student: s, cls, state, on: TODAY, dueBack: YEAR_END });
      if (r.error) { setError(r.error); break; }
      m = r.manual;
      added.push(r.loan);
    }
    if (added.length) { setManuals(manuals.map((x) => (x.id === m.id ? m : x))); setLoans([...loans, ...added]); }
  };
  const doReturn = (loan, st) => {
    const r = giveBack(manual, loan, { state: st, on: TODAY });
    setManuals(manuals.map((x) => (x.id === manual.id ? r.manual : x)));
    setLoans(loans.map((l) => (l.id === loan.id ? r.loan : l)));
  };
  const without = students.filter((s) => { const l = loanOf(s); return !l || l.returnedOn; });

  return (
    <Card title="Prêts par classe" subtitle="Sortie avec l'état de l'exemplaire, retour avec son nouvel état">
      <div className="mb-4 grid gap-2 text-sm sm:grid-cols-[180px_1fr_160px_auto] sm:items-end">
        <label className="text-xs text-slate-600">Classe
          <select value={cls} onChange={(e) => { setCls(e.target.value); setManualId(manuals.find((m) => m.levels.includes(e.target.value))?.id ?? ''); setError(''); }} className={`mt-1 w-full ${inputCls}`}>
            {Object.keys(CLASSES).map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
        <label className="text-xs text-slate-600">Manuel
          <select value={manualId} onChange={(e) => { setManualId(e.target.value); setError(''); }} className={`mt-1 w-full ${inputCls}`}>
            {forClass.length === 0 && <option value="">Aucun manuel pour cette classe</option>}
            {forClass.map((m) => <option key={m.id} value={m.id}>{m.title} ({KINDS[m.kind].toLowerCase()})</option>)}
          </select>
        </label>
        <label className="text-xs text-slate-600">État à la sortie
          <select value={state} onChange={(e) => setState(e.target.value)} className={`mt-1 w-full ${inputCls}`}>
            {CONDITIONS.filter((c) => c.id !== 'DECHIRE').map((c) => <option key={c.id} value={c.id}>{c.label} ({manual?.stock[c.id] ?? 0} en stock)</option>)}
          </select>
        </label>
        <Button disabled={!manual || without.length === 0} onClick={() => doLend(without)}>Prêter à ceux qui ne l'ont pas ({without.length})</Button>
      </div>
      {error && <p className="mb-3 rounded-lg bg-red-50 p-2 text-sm text-red-800">{error}</p>}
      {manual && (
        <ul className="divide-y divide-slate-100">
          {students.map((s) => {
            const l = loanOf(s);
            const out = l && !l.returnedOn && l.stateIn !== 'PERDU';
            return (
              <li key={s} className="flex flex-wrap items-center gap-3 py-2 text-sm">
                <span className="min-w-0 flex-1 font-medium text-slate-800">{s}</span>
                {!l && <Badge>Pas de manuel</Badge>}
                {out && <span className="text-xs text-slate-600">Prêté le {fmt(l.issuedOn)} · <Badge tone={TONE[l.stateOut]}>{conditionLabel(l.stateOut)}</Badge>{l.dueBack < YEAR_END ? <> · à rendre le {fmt(l.dueBack)}</> : ''}</span>}
                {l?.returnedOn && <span className="text-xs text-slate-600">Rendu le {fmt(l.returnedOn)} · <Badge tone={TONE[l.stateIn]}>{conditionLabel(l.stateIn)}</Badge>{l.charge ? ' · à régler' : ''}</span>}
                {l?.stateIn === 'PERDU' && <Badge tone="red">Perdu · {l.charge === 'A_REGLER' ? 'à régler' : 'réglé'}</Badge>}
                {(!l || l.returnedOn) && <Button variant="secondary" className="!px-2 !py-1 text-xs" onClick={() => doLend([s])}>Prêter</Button>}
                {out && (
                  <span className="flex items-center gap-1">
                    <select value={returning[s] ?? 'BON'} onChange={(e) => setReturning({ ...returning, [s]: e.target.value })} className="rounded-md border border-slate-300 px-1.5 py-1 text-xs" aria-label={`État au retour — ${s}`}>
                      {CONDITIONS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                      <option value="PERDU">Perdu</option>
                    </select>
                    <Button variant="secondary" className="!px-2 !py-1 text-xs" onClick={() => doReturn(l, returning[s] ?? 'BON')}>{(returning[s] ?? 'BON') === 'PERDU' ? 'Déclarer perdu' : 'Retour'}</Button>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-3 text-xs text-slate-500">Perdu, ou rendu déchiré alors qu'il ne l'était pas : le manuel est à régler à la caisse ({formatAr(LOST_PRICE)}, article « Manuel perdu ou endommagé »). Le bulletin n'est pas remis tant que ce n'est pas réglé.</p>
    </Card>
  );
}

function DueTab({ manuals, loans, setLoans }) {
  const students = [...new Set(loans.map((l) => l.student))];
  const blocked = students.map((s) => ({ s, cls: loans.find((l) => l.student === s).cls, reasons: manualBlocks(s, loans, manuals, TODAY) })).filter((x) => x.reasons.length);
  const [receipt, setReceipt] = useState({});
  return (
    <Card title="À régler et non rendus" subtitle="Ces élèves ne reçoivent pas leur bulletin tant que la situation n'est pas réglée">
      {blocked.length === 0 ? <p className="text-sm text-emerald-700">Aucun manuel dû.</p> : (
        <ul className="divide-y divide-slate-100">
          {blocked.map(({ s, cls, reasons }) => (
            <li key={s} className="py-2 text-sm">
              <p className="font-medium text-slate-800">{s} <span className="font-normal text-slate-500">· {cls}</span></p>
              {reasons.map((r) => <p key={r} className="text-xs text-red-700">{r}</p>)}
              {loans.filter((l) => l.student === s && l.charge === 'A_REGLER').map((l) => (
                <div key={l.id} className="mt-1 flex flex-wrap items-center gap-2">
                  <input value={receipt[l.id] ?? ''} onChange={(e) => setReceipt({ ...receipt, [l.id]: e.target.value })} placeholder="N° du reçu (ex. ANX-TMV-00210)" className="rounded-md border border-slate-300 px-2 py-1 text-xs" aria-label={`Reçu — ${s}`} />
                  <Button variant="secondary" className="!px-2 !py-1 text-xs" disabled={!/^ANX-/.test(receipt[l.id] ?? '')} onClick={() => setLoans(loans.map((x) => (x.id === l.id ? { ...x, charge: 'REGLE', chargeReceipt: receipt[l.id] } : x)))}>Marquer réglé</Button>
                </div>
              ))}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs text-slate-500">Le paiement se fait à la caisse comme un article (ticket « Manuel perdu ou endommagé ») ; on reporte ici le n° du reçu.</p>
    </Card>
  );
}

export default function ManualsModule() {
  const [tab, setTab] = useState('stock');
  const [data, setData] = useState(loadManuals);
  useEffect(() => saveManuals(data), [data]);
  const setManuals = (manuals) => setData((d) => ({ ...d, manuals }));
  const setLoans = (loans) => setData((d) => ({ ...d, loans }));
  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-semibold text-navy-500">Bureau et Direction · Tamatave</p>
        <h1 className="text-2xl font-semibold text-navy-900">Manuels scolaires</h1>
        <p className="text-sm text-slate-500">Stock par état, prêts aux élèves, retours et pertes. Un manuel dû bloque la remise du bulletin.</p>
      </div>
      <div className="flex gap-1 overflow-x-auto rounded-lg bg-slate-100 p-1" role="tablist">
        {TABS.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
            className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ${tab === id ? 'bg-white text-navy-900 shadow-sm' : 'text-slate-600'}`}>{label}</button>
        ))}
      </div>
      {tab === 'stock' && <StockTab manuals={data.manuals} setManuals={setManuals} loans={data.loans} />}
      {tab === 'loans' && <LoansTab manuals={data.manuals} setManuals={setManuals} loans={data.loans} setLoans={setLoans} />}
      {tab === 'due' && <DueTab manuals={data.manuals} loans={data.loans} setLoans={setLoans} />}
    </div>
  );
}
