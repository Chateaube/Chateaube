import React, { useMemo, useState } from 'react';
import { Badge, Button, Card, Icon, Stat } from './ui.jsx';
import {
  JOURNALS, CLASS_FEES, FEE_COLUMNS, ARTICLES, FAMILIES, CASH_MOVEMENTS, CASH_NATURES, CASH_OPENING,
} from '../data/accounting.js';
import { accountStatement, annualCost, cashBalance } from '../rules/accounting.js';
import { planMonths } from '../rules/calendar.js';
import { formatAr } from '../rules/finance.js';
import { PAYMENT_METHODS, validateInstrument } from '../rules/billing.js';
import { BANKS } from '../data/accounting.js';
import CollectPayment from './CollectPayment.jsx';

const TODAY = '2026-10-13';
const fmtDate = (iso) => iso.split('-').reverse().join('/');
const JournalBadge = ({ j }) => <Badge tone={JOURNALS[j].tone}>{JOURNALS[j].label}</Badge>;
const inputCls = 'rounded-md border border-slate-300 px-2 py-1.5 text-sm';

function AmountInput({ value, onChange, className = '' }) {
  return (
    <input
      inputMode="numeric"
      value={value === null ? '' : new Intl.NumberFormat('fr-FR').format(value).replace(/ | /g, ' ')}
      onChange={(e) => {
        const digits = e.target.value.replace(/\D/g, '');
        onChange(digits === '' ? null : Number(digits));
      }}
      className={`w-28 rounded-md border border-slate-300 px-2 py-1 text-right text-sm tabular-nums ${className}`}
    />
  );
}

/* ---------- Classes & tarifs ---------- */
function FeesTab({ fees, setFees, settings }) {
  const [newStudent, setNewStudent] = useState(false);
  const plans = settings.tuition.plans;
  const update = (i, key, v) => setFees(fees.map((r, k) => (k === i ? { ...r, [key]: v ?? 0 } : r)));
  return (
    <Card
      title="Classes & tarifs — Tamatave 2026-2027"
      subtitle="Montants modifiables directement ; ils alimentent la facturation et les états de compte"
      action={
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={newStudent} onChange={(e) => setNewStudent(e.target.checked)} />
          Coût annuel pour un nouvel élève
        </label>
      }
    >
      <div className="-mx-5 overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-y border-slate-100 bg-slate-50 text-left text-xs text-slate-500">
              <th className="px-4 py-2 font-medium">Classe</th>
              {FEE_COLUMNS.map((c) => <th key={c.key} className="px-2 py-2 text-right font-medium" title={c.hint}>{c.label} (Ar)</th>)}
              <th className="px-2 py-2 text-right font-medium">Mois</th>
              <th className="px-4 py-2 text-right font-medium">Coût annuel</th>
            </tr>
          </thead>
          <tbody>
            {fees.map((r, i) => (
              <tr key={r.cls} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-2 font-medium text-slate-800">{r.cls}</td>
                {FEE_COLUMNS.map((c) => (
                  <td key={c.key} className="px-2 py-1.5 text-right">
                    <AmountInput value={r[c.key]} onChange={(v) => update(i, c.key, v)} />
                  </td>
                ))}
                <td className="px-2 text-right tabular-nums text-slate-600">{planMonths(plans[r.plan]).length}</td>
                <td className="whitespace-nowrap px-4 text-right font-semibold tabular-nums text-navy-900">{formatAr(annualCost(r, plans, { newStudent }))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
        <span className="flex items-center gap-1.5"><JournalBadge j="ECOLAGE" /> écolage mensuel</span>
        <span className="flex items-center gap-1.5"><JournalBadge j="FRAIS_ANNEXES" /> inscription, réinscription, fascicule, location</span>
        <span>· Nombre de mois : réglé dans Paramètres (9 mois pour 1re et Terminale).</span>
      </div>
    </Card>
  );
}

/* ---------- Articles & services ---------- */
function ArticlesTab({ articles, setArticles }) {
  const [draft, setDraft] = useState({ group: '', label: '', unit: 'par unité', price: null });
  const update = (id, patch) => setArticles(articles.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  const groups = [...new Set(articles.map((a) => a.group))];
  return (
    <Card title="Articles & services" subtitle="Catalogue facturé à la demande, ajouté à l'état de compte de la famille">
      <div className="space-y-4">
        {groups.map((g) => (
          <div key={g}>
            <p className="mb-1 text-xs font-semibold text-slate-500">{g}</p>
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
              {articles.filter((a) => a.group === g).map((a) => (
                <li key={a.id} className={`flex flex-wrap items-center gap-3 px-3 py-2 text-sm ${a.active ? '' : 'opacity-50'}`}>
                  <span className="min-w-0 flex-1 font-medium text-slate-800">{a.label}</span>
                  <span className="text-xs text-slate-500">{a.unit}</span>
                  {a.price === null
                    ? <span className="w-28 text-right text-xs text-slate-500">saisi à la vente</span>
                    : <AmountInput value={a.price} onChange={(v) => update(a.id, { price: v ?? 0 })} />}
                  <JournalBadge j={a.journal} />
                  <label className="flex items-center gap-1 text-xs text-slate-600">
                    <input type="checkbox" checked={a.active} onChange={(e) => update(a.id, { active: e.target.checked })} />actif
                  </label>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="mt-4 grid gap-2 rounded-lg bg-slate-50 p-3 sm:grid-cols-[1fr_1fr_130px_auto_auto] sm:items-end">
        <label className="text-xs text-slate-600">Rubrique
          <input value={draft.group} onChange={(e) => setDraft({ ...draft, group: e.target.value })} placeholder="ex. Sortie pédagogique" className={`mt-1 w-full bg-white ${inputCls}`} />
        </label>
        <label className="text-xs text-slate-600">Article
          <input value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} placeholder="ex. Visite du port" className={`mt-1 w-full bg-white ${inputCls}`} />
        </label>
        <label className="text-xs text-slate-600">Unité
          <input value={draft.unit} onChange={(e) => setDraft({ ...draft, unit: e.target.value })} className={`mt-1 w-full bg-white ${inputCls}`} />
        </label>
        <label className="text-xs text-slate-600">Prix (Ar)
          <div className="mt-1"><AmountInput value={draft.price} onChange={(v) => setDraft({ ...draft, price: v })} className="bg-white py-1.5" /></div>
        </label>
        <Button disabled={!draft.group.trim() || !draft.label.trim()}
          onClick={() => { setArticles([...articles, { ...draft, id: `a${Date.now()}`, journal: 'FRAIS_ANNEXES', active: true }]); setDraft({ group: '', label: '', unit: 'par unité', price: null }); }}>
          Ajouter
        </Button>
      </div>
    </Card>
  );
}

/* ---------- États de compte ---------- */
function StatementTab({ families, setFamilies, articles }) {
  const [famId, setFamId] = useState(families[0].id);
  const [sale, setSale] = useState({ articleId: '', qty: 1, child: '', amount: null });
  const [pay, setPay] = useState({ journal: 'ECOLAGE', amount: null, method: 'ESPECES', ref: '', bank: '' });
  const payErrors = validateInstrument(pay);
  const fam = families.find((f) => f.id === famId);
  const { rows, byJournal, totals } = useMemo(() => accountStatement(fam.lines), [fam]);
  const addLine = (line) => setFamilies(families.map((f) => (f.id === famId ? { ...f, lines: [...f.lines, { date: TODAY, ...line }] } : f)));

  const article = articles.find((a) => a.id === sale.articleId);
  const unitPrice = article?.price ?? sale.amount;
  const canSell = article && unitPrice > 0 && sale.qty > 0 && sale.child;

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_340px] xl:items-start">
      <Card
        title={fam.name}
        subtitle={`Payeur : ${fam.payer} · ${fam.children.map((c) => `${c.name} (${c.cls})`).join(', ')}`}
        action={
          <div className="flex gap-2">
            <select value={famId} onChange={(e) => setFamId(e.target.value)} className={inputCls}>
              {families.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
            <Button variant="secondary" onClick={() => window.print()}>Imprimer</Button>
          </div>
        }
      >
        <div className="mb-4 grid gap-2 sm:grid-cols-3">
          {Object.entries(JOURNALS).map(([k, j]) => {
            const b = byJournal[k] ?? { billed: 0, paid: 0, balance: 0 };
            return (
              <div key={k} className="rounded-lg border border-slate-200 p-3">
                <JournalBadge j={k} />
                <p className={`mt-2 text-lg font-semibold tabular-nums ${b.balance > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                  {b.balance > 0 ? formatAr(b.balance) : 'À jour'}
                </p>
                <p className="text-[11px] text-slate-500">Facturé {formatAr(b.billed)} · payé {formatAr(b.paid)}</p>
              </div>
            );
          })}
        </div>
        <div className="-mx-5 overflow-x-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="border-y border-slate-100 bg-slate-50 text-left text-xs text-slate-500">
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-2 py-2 font-medium">Libellé</th>
                <th className="px-2 py-2 font-medium">Journal</th>
                <th className="px-2 py-2 text-right font-medium">Débit</th>
                <th className="px-2 py-2 text-right font-medium">Crédit</th>
                <th className="px-4 py-2 text-right font-medium">Solde du journal</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-2 tabular-nums text-slate-600">{fmtDate(r.date)}</td>
                  <td className="px-2 text-slate-800">{r.label}</td>
                  <td className="px-2"><JournalBadge j={r.journal} /></td>
                  <td className="whitespace-nowrap px-2 text-right tabular-nums">{r.debit ? formatAr(r.debit) : ''}</td>
                  <td className="whitespace-nowrap px-2 text-right tabular-nums text-emerald-700">{r.credit ? formatAr(r.credit) : ''}</td>
                  <td className="whitespace-nowrap px-4 text-right font-medium tabular-nums">{formatAr(r.journalBalance)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 font-semibold">
                <td className="px-4 py-2" colSpan={3}>Total</td>
                <td className="whitespace-nowrap px-2 text-right tabular-nums">{formatAr(totals.billed)}</td>
                <td className="whitespace-nowrap px-2 text-right tabular-nums text-emerald-700">{formatAr(totals.paid)}</td>
                <td className={`whitespace-nowrap px-4 text-right tabular-nums ${totals.balance > 0 ? 'text-red-700' : 'text-emerald-700'}`}>{formatAr(totals.balance)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      <div className="space-y-5">
        <Card title="Facturer un article">
          <div className="space-y-2 text-sm">
            <select value={sale.child} onChange={(e) => setSale({ ...sale, child: e.target.value })} className={`w-full ${inputCls}`}>
              <option value="">Élève…</option>
              {fam.children.map((c) => <option key={c.name} value={c.name}>{c.name} ({c.cls})</option>)}
            </select>
            <select value={sale.articleId} onChange={(e) => setSale({ ...sale, articleId: e.target.value, amount: null })} className={`w-full ${inputCls}`}>
              <option value="">Article…</option>
              {articles.filter((a) => a.active).map((a) => <option key={a.id} value={a.id}>{a.group} — {a.label}</option>)}
            </select>
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-600">Qté <input type="number" min={1} value={sale.qty} onChange={(e) => setSale({ ...sale, qty: Math.max(1, Number(e.target.value)) })} className={`ml-1 w-16 ${inputCls}`} /></label>
              {article && article.price === null && <AmountInput value={sale.amount} onChange={(v) => setSale({ ...sale, amount: v })} />}
              {canSell && <span className="ml-auto font-semibold tabular-nums">{formatAr(unitPrice * sale.qty)}</span>}
            </div>
            <Button className="w-full" disabled={!canSell} onClick={() => {
              addLine({ label: `${article.label}${sale.qty > 1 ? ` × ${sale.qty}` : ''} — ${sale.child}`, journal: article.journal, debit: unitPrice * sale.qty });
              setSale({ articleId: '', qty: 1, child: '', amount: null });
            }}>Ajouter à l'état de compte</Button>
          </div>
        </Card>
        <Card title="Enregistrer un paiement" subtitle="Le paiement n'éteint que les dettes du journal choisi">
          <div className="space-y-2 text-sm">
            <select value={pay.journal} onChange={(e) => setPay({ ...pay, journal: e.target.value })} className={`w-full ${inputCls}`}>
              {Object.entries(JOURNALS).map(([k, j]) => <option key={k} value={k}>{j.label} — reste {formatAr(Math.max(0, byJournal[k]?.balance ?? 0))}</option>)}
            </select>
            <div className="flex gap-2">
              <AmountInput value={pay.amount} onChange={(v) => setPay({ ...pay, amount: v })} className="flex-1 py-1.5" />
              <select value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value, ref: '', bank: '' })} className={`flex-1 ${inputCls}`}>
                {Object.entries(PAYMENT_METHODS).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
              </select>
            </div>
            {PAYMENT_METHODS[pay.method].needsRef && (
              <div className="flex gap-2">
                <input value={pay.ref} onChange={(e) => setPay({ ...pay, ref: e.target.value })} placeholder={PAYMENT_METHODS[pay.method].refLabel} className={`min-w-0 flex-1 ${inputCls}`} />
                <select value={pay.bank} onChange={(e) => setPay({ ...pay, bank: e.target.value })} className={`min-w-0 flex-1 ${inputCls}`}>
                  <option value="">Banque…</option>{BANKS.map((b) => <option key={b}>{b}</option>)}
                </select>
              </div>
            )}
            <Button className="w-full" disabled={!(pay.amount > 0) || payErrors.length > 0} onClick={() => {
              const m = PAYMENT_METHODS[pay.method];
              addLine({ label: `Paiement ${m.label.toLowerCase()}${m.needsRef ? ` n° ${pay.ref} (${pay.bank})` : ''}`, journal: pay.journal, credit: pay.amount });
              setPay({ ...pay, amount: null, ref: '', bank: '' });
            }}>Encaisser et éditer le reçu</Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ---------- Caisse : entrées / sorties ---------- */
function CashTab({ movements, setMovements }) {
  const [draft, setDraft] = useState({ dir: 'OUT', nature: CASH_NATURES.OUT[0], journal: 'ECOLAGE', label: '', method: 'Espèces', amount: null, agent: 'Mme Soa' });
  const balance = cashBalance(CASH_OPENING, movements);
  const sum = (dir) => movements.filter((m) => m.dir === dir).reduce((s, m) => s + m.amount, 0);
  const ok = draft.label.trim() && draft.amount > 0 && (draft.dir === 'IN' || (balance[draft.journal] ?? 0) >= draft.amount);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Entrées du jour" value={formatAr(sum('IN'))} tone="green" />
        <Stat label="Sorties du jour" value={formatAr(sum('OUT'))} tone="red" />
        {Object.entries(JOURNALS).slice(0, 2).map(([k, j]) => <Stat key={k} label={`Caisse ${j.label.toLowerCase()}`} value={formatAr(balance[k])} hint={`Ouverture ${formatAr(CASH_OPENING[k])}`} />)}
      </div>
      <Card title="Mouvements de caisse — mardi 13 octobre 2026" subtitle={`Caisse de Tamatave · caisse droits d'examen : ${formatAr(balance.DROITS_EXAMEN)} (à reverser aux centres)`}>
        <div className="-mx-5 overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-y border-slate-100 bg-slate-50 text-left text-xs text-slate-500">
                <th className="px-4 py-2 font-medium">Heure</th><th className="px-2 font-medium">Sens</th><th className="px-2 font-medium">Libellé</th>
                <th className="px-2 font-medium">Journal</th><th className="px-2 font-medium">Mode</th><th className="px-2 font-medium">Agent</th><th className="px-4 text-right font-medium">Montant</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((m) => (
                <tr key={m.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-2 tabular-nums text-slate-600">{m.time}</td>
                  <td className="px-2">{m.dir === 'IN' ? <Badge tone="green">Entrée</Badge> : <Badge tone="red">Sortie</Badge>}</td>
                  <td className="px-2"><p className="text-slate-800">{m.label}</p><p className="text-[11px] text-slate-500">{m.nature}</p></td>
                  <td className="px-2"><JournalBadge j={m.journal} /></td>
                  <td className="px-2 text-slate-600">{m.method}</td>
                  <td className="px-2 text-slate-600">{m.agent}</td>
                  <td className={`whitespace-nowrap px-4 text-right font-medium tabular-nums ${m.dir === 'IN' ? 'text-emerald-700' : 'text-red-700'}`}>{m.dir === 'IN' ? '+' : '−'} {formatAr(m.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 grid gap-2 rounded-lg bg-slate-50 p-3 sm:grid-cols-3 lg:grid-cols-[110px_1fr_1fr_1.5fr_130px_auto] lg:items-end">
          <label className="text-xs text-slate-600">Sens
            <select value={draft.dir} onChange={(e) => setDraft({ ...draft, dir: e.target.value, nature: CASH_NATURES[e.target.value][0] })} className={`mt-1 w-full bg-white ${inputCls}`}>
              <option value="IN">Entrée</option><option value="OUT">Sortie</option>
            </select>
          </label>
          <label className="text-xs text-slate-600">Nature
            <select value={draft.nature} onChange={(e) => setDraft({ ...draft, nature: e.target.value })} className={`mt-1 w-full bg-white ${inputCls}`}>
              {CASH_NATURES[draft.dir].map((n) => <option key={n}>{n}</option>)}
            </select>
          </label>
          <label className="text-xs text-slate-600">Journal
            <select value={draft.journal} onChange={(e) => setDraft({ ...draft, journal: e.target.value })} className={`mt-1 w-full bg-white ${inputCls}`}>
              {Object.entries(JOURNALS).map(([k, j]) => <option key={k} value={k}>{j.label}</option>)}
            </select>
          </label>
          <label className="text-xs text-slate-600">Libellé
            <input value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} placeholder="ex. Achat de craies" className={`mt-1 w-full bg-white ${inputCls}`} />
          </label>
          <label className="text-xs text-slate-600">Montant (Ar)
            <div className="mt-1"><AmountInput value={draft.amount} onChange={(v) => setDraft({ ...draft, amount: v })} className="w-full bg-white py-1.5" /></div>
          </label>
          <Button disabled={!ok} onClick={() => {
            setMovements([...movements, { ...draft, id: `c${Date.now()}`, time: new Date().toTimeString().slice(0, 5) }]);
            setDraft({ ...draft, label: '', amount: null });
          }}>Enregistrer</Button>
        </div>
        {draft.dir === 'OUT' && draft.amount > (balance[draft.journal] ?? 0) && (
          <p className="mt-2 text-sm text-red-700">Solde insuffisant dans la caisse « {JOURNALS[draft.journal].label} ».</p>
        )}
        <p className="mt-2 text-xs text-slate-500">Chaque mouvement est attribué à l'agent connecté et horodaté ; une sortie ne peut pas dépasser le solde de son journal.</p>
      </Card>
    </div>
  );
}

const TABS = [['collect', 'Encaisser'], ['fees', 'Classes & tarifs'], ['articles', 'Articles & services'], ['statements', 'États de compte'], ['cash', 'Caisse : entrées / sorties']];

export default function AccountingModule({ settings }) {
  const [tab, setTab] = useState('collect');
  const [fees, setFees] = useState(CLASS_FEES);
  const [articles, setArticles] = useState(ARTICLES);
  const [families, setFamilies] = useState(FAMILIES);
  const [movements, setMovements] = useState(CASH_MOVEMENTS);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-navy-500">Espace comptabilité · Tamatave</p>
          <h1 className="text-2xl font-semibold text-navy-900">Comptabilité</h1>
          <p className="text-sm text-slate-500">Trois journaux étanches : écolage, frais annexes, droits d'examen.</p>
        </div>
      </div>
      <div className="flex gap-1 overflow-x-auto rounded-lg bg-slate-100 p-1" role="tablist">
        {TABS.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
            className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ${tab === id ? 'bg-white text-navy-900 shadow-sm' : 'text-slate-600'}`}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'collect' && <CollectPayment settings={settings} />}
      {tab === 'fees' && <FeesTab fees={fees} setFees={setFees} settings={settings} />}
      {tab === 'articles' && <ArticlesTab articles={articles} setArticles={setArticles} />}
      {tab === 'statements' && <StatementTab families={families} setFamilies={setFamilies} articles={articles} />}
      {tab === 'cash' && <CashTab movements={movements} setMovements={setMovements} />}
    </div>
  );
}
