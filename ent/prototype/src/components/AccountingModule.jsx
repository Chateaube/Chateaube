import React, { useMemo, useState } from 'react';
import { saveFile } from '../download.js';
import { Badge, Button, Card, Icon, Stat } from './ui.jsx';
import {
  JOURNALS, CLASS_FEES, FEE_COLUMNS, ARTICLES, FAMILIES, CASH_MOVEMENTS, CASH_NATURES, CASH_OPENING, CASH_HISTORY, CASH_YEAR_OPENING,
  RECEIPTS_TODAY, CASH_AUDIT, CASH_SAFE, CASH_CLOSINGS, REDUCTION_TYPES,
} from '../data/accounting.js';
import CashControl, { methodText } from './CashControl.jsx';
import Reductions from './Reductions.jsx';
import { accountStatement, annualCost, cashBalance, monthlyCashReport, cashMonthCsv } from '../rules/accounting.js';
import { printOnly } from '../print.js';
import { planMonths } from '../rules/calendar.js';
import { formatAr } from '../rules/finance.js';
import CollectPayment, { CASH_ACCOUNTS, feesFor } from './CollectPayment.jsx';
import { loadManuals } from '../manualsStore.js';
import { kitFor } from '../rules/manuals.js';

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
function FeesTab({ fees, setFees, settings, canEdit }) {
  const manuals = useMemo(() => loadManuals().manuals, []);
  const [newStudent, setNewStudent] = useState(false);
  const plans = settings.tuition.plans;
  const update = (i, key, v) => setFees(fees.map((r, k) => (k === i ? { ...r, [key]: v ?? 0 } : r)));
  return (
    <Card
      title="Classes & tarifs — Tamatave 2026-2027"
      subtitle={canEdit ? 'Montants modifiables par la Direction uniquement ; ils alimentent l\'encaissement et les états de compte' : 'Consultation : seule la Direction peut modifier les classes et les tarifs'}
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
            {fees.map((raw, i) => {
              // location et cahiers : calculés depuis le lot de manuels de la classe (hors spécialités)
              const r = { ...raw, ...(feesFor({ cls: raw.cls, specialties: [] }, manuals) ?? {}), ecolage: raw.ecolage, inscription: raw.inscription, reinscription: raw.reinscription, fascicule: raw.fascicule };
              const spe = kitFor(raw.cls, ['MATHS', 'PC', 'SVT'], manuals).filter((m) => m.specialty);
              return (
              <tr key={r.cls} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-2 font-medium text-slate-800">{r.cls}</td>
                {FEE_COLUMNS.map((c) => (
                  <td key={c.key} className="px-2 py-1.5 text-right">
                    {c.computed ? <span className="tabular-nums text-slate-600" title={c.hint}>{formatAr(r[c.key] ?? 0)}{c.key === 'location' && spe.length > 0 && <span className="block text-[11px] text-slate-500">+ {formatAr(spe[0].price)} par spécialité</span>}</span>
                      : canEdit ? <AmountInput value={r[c.key]} onChange={(v) => update(i, c.key, v)} /> : <span className="tabular-nums">{formatAr(r[c.key])}</span>}
                  </td>
                ))}
                <td className="px-2 text-right tabular-nums text-slate-600">{planMonths(plans[r.plan]).length}</td>
                <td className="whitespace-nowrap px-4 text-right font-semibold tabular-nums text-navy-900">{formatAr(annualCost(r, plans, { newStudent }))}</td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
        <span className="flex items-center gap-1.5"><JournalBadge j="ECOLAGE" /> frais de scolarité mensuels</span>
        <span className="flex items-center gap-1.5"><JournalBadge j="FRAIS_ANNEXES" /> inscription, réinscription, fascicule, location</span>
        <span>· Nombre de mois : réglé dans Paramètres (9 mois pour 1re et Terminale).</span>
        <span>· Location des manuels et cahiers : calculés depuis le lot de chaque classe (Manuels scolaires).</span>
      </div>
    </Card>
  );
}

/* ---------- Articles & services ---------- */
function ArticlesTab({ articles, setArticles, canEdit }) {
  const [draft, setDraft] = useState({ group: '', label: '', unit: 'par unité', price: null });
  const update = (id, patch) => setArticles(articles.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  const groups = [...new Set(articles.map((a) => a.group))];
  return (
    <Card title="Articles & services" subtitle={`Tarifs fixes, vendus depuis « Encaisser » avec un ticket${canEdit ? ' · modifiables par la Direction uniquement' : ' · consultation : seule la Direction peut les modifier'}`}>
      <div className="space-y-4">
        {groups.map((g) => (
          <div key={g}>
            <p className="mb-1 text-xs font-semibold text-slate-500">{g}</p>
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
              {articles.filter((a) => a.group === g).map((a) => (
                <li key={a.id} className={`flex flex-wrap items-center gap-3 px-3 py-2 text-sm ${a.active ? '' : 'opacity-50'}`}>
                  <span className="min-w-0 flex-1 font-medium text-slate-800">{a.label}</span>
                  <span className="text-xs text-slate-500">{a.unit}</span>
                  {canEdit ? <AmountInput value={a.price} onChange={(v) => update(a.id, { price: v ?? 0 })} /> : <span className="w-28 text-right tabular-nums">{formatAr(a.price)}</span>}
                  <JournalBadge j={a.journal} />
                  {canEdit && <><label className="flex items-center gap-1 text-xs text-slate-600">
                    <input type="checkbox" checked={a.active} onChange={(e) => update(a.id, { active: e.target.checked })} />actif
                  </label>
                  <button type="button" aria-label={`Supprimer ${a.label}`} title="Supprimer l'article (les ventes déjà facturées restent sur les états de compte)"
                    onClick={() => window.confirm(`Supprimer « ${a.label} » du catalogue ?\nLes ventes déjà facturées restent sur les états de compte.`) && setArticles(articles.filter((x) => x.id !== a.id))}
                    className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"><Icon name="x" /></button></>}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      {canEdit && (
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
        <Button disabled={!draft.group.trim() || !draft.label.trim() || !(draft.price > 0)}
          onClick={() => { setArticles([...articles, { ...draft, id: `a${Date.now()}`, journal: 'FRAIS_ANNEXES', active: true }]); setDraft({ group: '', label: '', unit: 'par unité', price: null }); }}>
          Ajouter
        </Button>
      </div>
      )}
    </Card>
  );
}

/* ---------- États de compte ---------- */
function StatementTab({ families }) {
  const [famId, setFamId] = useState(families[0].id);
  const fam = families.find((f) => f.id === famId);
  const { rows, byJournal, totals } = useMemo(() => accountStatement(fam.lines), [fam]);
  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_340px] xl:items-start">
      <div className="statement-print">
      <Card
        title={fam.name}
        subtitle={`Payeur : ${fam.payer} · ${fam.children.map((c) => `${c.name} (${c.cls})`).join(', ')}`}
        action={
          <div className="flex gap-2">
            <select value={famId} onChange={(e) => setFamId(e.target.value)} className={inputCls}>
              {families.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
            <Button variant="secondary" onClick={() => printOnly('.statement-print', 'size: A4 portrait; margin: 12mm;')}>Imprimer</Button>
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
      </div>
      <Card title="À quoi sert l'état de compte ?">
        <ul className="list-disc space-y-1.5 pl-4 text-sm text-slate-600">
          <li>C'est le <strong>relevé de la famille</strong>, tous enfants confondus : ce qui a été facturé, ce qui a été payé et ce qui reste dû, journal par journal.</li>
          <li>Il répond aux questions des parents (« qu'avons-nous déjà payé ? ») : on l'imprime ou on l'envoie, la famille le voit aussi dans son compte.</li>
          <li>Il sert de preuve en cas de désaccord, avant une relance, un avertissement ou une mise à pied.</li>
          <li>En fin d'année, il permet de solder les comptes : familles à jour, impayés à reporter.</li>
        </ul>
        <p className="mt-3 rounded-lg bg-slate-50 p-2.5 text-xs text-slate-600">On n'y saisit rien : les paiements se font dans « Encaisser », en entier et avec un ticket. Les lignes de l'état de compte en découlent automatiquement.</p>
      </Card>
    </div>
  );
}

/* ---------- Caisse : entrées / sorties ---------- */
/* ---------- Export mensuel de la caisse ---------- */
const MONTH_OPTIONS = [['2026-09', 'Septembre 2026'], ['2026-10', 'Octobre 2026 (en cours)']];

function MonthlyCashExport({ movements }) {
  const [month, setMonth] = useState('2026-10');
  const history = useMemo(() => [...CASH_HISTORY, ...movements], [movements]);
  const r = useMemo(() => monthlyCashReport(CASH_YEAR_OPENING, history, month, Object.keys(JOURNALS)), [history, month]);
  const label = MONTH_OPTIONS.find(([m]) => m === month)[1].replace(' (en cours)', '');
  const download = () => {
    const csv = cashMonthCsv(r, { site: 'Tamatave', journalLabels: Object.fromEntries(Object.entries(JOURNALS).map(([k, j]) => [k, j.label])) });
    saveFile(`caisse-tamatave-${month}.csv`, csv);
  };
  const days = Object.entries(r.byDay);
  return (
    <Card title="Export mensuel de la caisse" subtitle="Pour le suivi et l'archivage : un exemplaire par mois (Excel et papier)"
      action={(
        <div className="flex flex-wrap items-center gap-2">
          <select value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Mois" className={inputCls}>
            {MONTH_OPTIONS.map(([m, l]) => <option key={m} value={m}>{l}</option>)}
          </select>
          <Button variant="secondary" onClick={download}>Exporter vers Excel</Button>
          <Button variant="secondary" onClick={() => printOnly('.cash-report', 'size: A4 portrait; margin: 12mm;')}>Imprimer</Button>
        </div>
      )}>
      <div className="cash-report">
        <div className="print-only mb-3 hidden">
          <p className="text-lg font-semibold">École Chateaubriand Tamatave — caisse de {label.toLowerCase()}</p>
          <p className="text-xs">Édité le 13/10/2026 par le bureau · {r.movements.length} mouvements</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                <th className="py-2 pr-2 font-medium">Journal</th><th className="px-2 text-right font-medium">Ouverture</th>
                <th className="px-2 text-right font-medium">Entrées</th><th className="px-2 text-right font-medium">Sorties</th><th className="pl-2 text-right font-medium">Clôture</th>
              </tr>
            </thead>
            <tbody>
              {Object.keys(r.byJournal).map((j) => (
                <tr key={j} className="border-b border-slate-100">
                  <td className="py-2 pr-2"><JournalBadge j={j} /></td>
                  <td className="px-2 text-right tabular-nums">{formatAr(r.opening[j] ?? 0)}</td>
                  <td className="px-2 text-right tabular-nums text-emerald-700">+ {formatAr(r.byJournal[j].in)}</td>
                  <td className="px-2 text-right tabular-nums text-red-700">− {formatAr(r.byJournal[j].out)}</td>
                  <td className="pl-2 text-right font-semibold tabular-nums">{formatAr(r.closing[j] ?? 0)}</td>
                </tr>
              ))}
              <tr className="font-semibold">
                <td className="py-2 pr-2">Total</td><td />
                <td className="px-2 text-right tabular-nums text-emerald-700">+ {formatAr(r.totals.in)}</td>
                <td className="px-2 text-right tabular-nums text-red-700">− {formatAr(r.totals.out)}</td><td />
              </tr>
            </tbody>
          </table>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <p className="mb-1 text-xs font-semibold text-slate-500">Par mode de paiement</p>
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 text-sm">
              {Object.entries(r.byMethod).map(([k, v]) => (
                <li key={k} className="flex justify-between px-3 py-1.5"><span>{k}</span>
                  <span className="tabular-nums">+ {formatAr(v.in)}{v.out ? ` · − ${formatAr(v.out)}` : ''}</span></li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold text-slate-500">Par jour ({days.length} jours de caisse)</p>
            <ul className="max-h-48 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200 text-sm print:max-h-none">
              {days.map(([d, v]) => (
                <li key={d} className="flex justify-between px-3 py-1.5"><span>{d.split('-').reverse().join('/')}</span>
                  <span className="tabular-nums"><span className="text-emerald-700">+ {formatAr(v.in)}</span> · <span className="text-red-700">− {formatAr(v.out)}</span></span></li>
              ))}
            </ul>
          </div>
        </div>
        <p className="mt-3 text-xs text-slate-500">L'export Excel contient aussi le détail de chaque mouvement (date, heure, libellé, mode, agent). En production, le mois est clôturé le dernier jour : l'export est archivé automatiquement et ne peut plus être modifié.</p>
      </div>
    </Card>
  );
}

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
            setMovements([...movements, { ...draft, id: `c${Date.now()}`, date: '2026-10-13', time: new Date().toTimeString().slice(0, 5) }]);
            setDraft({ ...draft, label: '', amount: null });
          }}>Enregistrer</Button>
        </div>
        {draft.dir === 'OUT' && draft.amount > (balance[draft.journal] ?? 0) && (
          <p className="mt-2 text-sm text-red-700">Solde insuffisant dans la caisse « {JOURNALS[draft.journal].label} ».</p>
        )}
        <p className="mt-2 text-xs text-slate-500">Chaque mouvement est attribué à l'agent connecté et horodaté ; une sortie ne peut pas dépasser le solde de son journal.</p>
      </Card>
      <MonthlyCashExport movements={movements} />
    </div>
  );
}

const TABS = [['collect', 'Encaisser'], ['receipts', 'Reçus & clôture'], ['fees', 'Classes & tarifs'], ['articles', 'Articles & services'], ['reductions', 'Réductions'], ['statements', 'États de compte'], ['cash', 'Caisse : entrées / sorties']];

export default function AccountingModule({ settings, role }) {
  const canEdit = role === 'DIRECTION'; // classes, tarifs, articles et services : Direction uniquement
  const [tab, setTab] = useState('collect');
  const [fees, setFees] = useState(CLASS_FEES);
  const [articles, setArticles] = useState(ARTICLES);
  const [families] = useState(FAMILIES);
  const [movements, setMovements] = useState(CASH_MOVEMENTS);
  const [accounts, setAccounts] = useState(CASH_ACCOUNTS);
  const [receipts, setReceipts] = useState(RECEIPTS_TODAY);
  const [audit, setAudit] = useState(CASH_AUDIT);
  const [closings, setClosings] = useState(CASH_CLOSINGS);
  const [reductionTypes, setReductionTypes] = useState(REDUCTION_TYPES);
  const actor = canEdit ? 'Mme Sheena Lo (Direction)' : 'Mme Hanta (bureau)';
  const closed = closings.some((c) => c.date === '2026-10-13');
  const pendingCancels = receipts.filter((r) => r.status === 'ANNULATION_DEMANDEE').length;
  // Chaque reçu émis à l'encaissement entre dans le journal des reçus et dans la caisse
  const onCollected = (rs) => {
    setReceipts((prev) => [...prev, ...rs]);
    setMovements((prev) => [...prev, ...rs.map((r) => ({
      id: `r-${r.number}`, date: r.date, time: r.time, dir: 'IN', nature: 'Encaissement famille', journal: r.journal,
      label: `${r.lines.map((l) => l.label).join(', ')} — ${r.student}`, method: methodText(r), amount: r.total, agent: r.cashier, receipt: r.number,
    }))]);
  };
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-navy-500">Espace comptabilité · Tamatave</p>
          <h1 className="text-2xl font-semibold text-navy-900">Comptabilité</h1>
          <p className="text-sm text-slate-500">Trois journaux étanches : frais de scolarité, frais annexes, droits d'examen.</p>
        </div>
      </div>
      <div className="flex gap-1 overflow-x-auto rounded-lg bg-slate-100 p-1" role="tablist">
        {TABS.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
            className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ${tab === id ? 'bg-white text-navy-900 shadow-sm' : 'text-slate-600'}`}>
            {label}{id === 'receipts' && pendingCancels > 0 && <span className="ml-1.5 rounded-full bg-amber-500 px-1.5 text-[10px] font-semibold text-white">{pendingCancels}</span>}
          </button>
        ))}
      </div>
      {tab === 'collect' && <CollectPayment settings={settings} articles={articles} accounts={accounts} setAccounts={setAccounts} reductionTypes={reductionTypes} onCollected={onCollected} cashier={actor} closed={closed} />}
      {tab === 'receipts' && <CashControl role={role} actor={actor} receipts={receipts} setReceipts={setReceipts} audit={audit} setAudit={setAudit} movements={movements} setMovements={setMovements} accounts={accounts} setAccounts={setAccounts} closings={closings} setClosings={setClosings} safe={CASH_SAFE} />}
      {tab === 'reductions' && <Reductions canEdit={canEdit} actor={actor} types={reductionTypes} setTypes={setReductionTypes} accounts={accounts} setAccounts={setAccounts} />}
      {tab === 'fees' && <FeesTab fees={fees} setFees={setFees} settings={settings} canEdit={canEdit} />}
      {tab === 'articles' && <ArticlesTab articles={articles} setArticles={setArticles} canEdit={canEdit} />}
      {tab === 'statements' && <StatementTab families={families} />}
      {tab === 'cash' && <CashTab movements={movements} setMovements={setMovements} />}
    </div>
  );
}
