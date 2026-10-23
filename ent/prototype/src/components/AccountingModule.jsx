import React, { useMemo, useState } from 'react';
import { saveFile } from '../download.js';
import { Badge, Button, Card, Icon, Stat } from './ui.jsx';
import {
  JOURNALS, CLASS_FEES, FEE_COLUMNS, ARTICLES, CASH_MOVEMENTS, FAMILIES, CASH_NATURES, CASH_OPENING, CASH_HISTORY, CASH_YEAR_OPENING,
  RECEIPTS_TODAY, CASH_AUDIT, CASH_SAFE, CASH_CLOSINGS, REDUCTION_TYPES, PAYROLL, HOURLY_RATES,
} from '../data/accounting.js';
import CashControl, { methodText } from './CashControl.jsx';
import Reductions from './Reductions.jsx';
import Salaries, { cashSalariesPaid } from './Salaries.jsx';
import { accountStatement, annualCost, cashBalance, monthlyCashReport, cashMonthCsv } from '../rules/accounting.js';
import { printOnly } from '../print.js';
import { planMonths, monthName } from '../rules/calendar.js';
import { formatAr } from '../rules/finance.js';
import CollectPayment, { CASH_ACCOUNTS, feesFor } from './CollectPayment.jsx';
import { loadManuals } from '../manualsStore.js';
import { kitFor } from '../rules/manuals.js';
import { EXPENSES, SUPPLIERS } from '../data/treasury.js';
import { toTransactions } from '../rules/treasury.js';
import { payOf, rateOn } from '../rules/payroll.js';
import { ExpensesTab, TreasuryDashboard } from './Treasury.jsx';
import { featureVisible } from '../features.js';
import { DunningAlerts, SeparateJournals } from './FinancePanels.jsx';
import { loadMovements, saveMovements, counted, WITHDRAWERS, withdrawalStatus } from '../cashStore.js';
import { TIMETABLE } from '../data/timetable.js';
import { teacherHours } from '../rules/teachingHours.js';
import { loadTeacherAbsences } from '../absencesStore.js';
import { takeIntent } from '../navIntent.js';

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
      subtitle={canEdit ? 'Montants modifiables par la Direction uniquement ; ils alimentent l\'encaissement' : 'Consultation : seule la Direction peut modifier les classes et les tarifs'}
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
        <span>· Location des manuels et cahiers : calculés depuis le lot de chaque classe (Manuels scolaires).</span>
      </div>
      {/* l'échéancier, rapproché des tarifs (il se règle dans Paramètres › Frais et relances) */}
      <div className="mt-4 rounded-xl bg-slate-50 p-3">
        <p className="text-sm font-semibold text-navy-900">Échéancier des frais de scolarité</p>
        <ul className="mt-1.5 space-y-1 text-sm text-slate-700">
          {plans.map((p) => <li key={p.levels}><strong>{p.levels}</strong> : de {monthName(p.first)} à {monthName(p.last)} ({planMonths(p).length} mois), échéance le {settings.tuition.dueDay} du mois</li>)}
        </ul>
        <p className="mt-1.5 text-xs text-slate-600">{canEdit ? 'Pour le modifier : Paramètres › Frais et relances.' : 'Fixé par la Direction.'}</p>
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
                  <button type="button" aria-label={`Supprimer ${a.label}`} title="Supprimer l'article (les ventes déjà facturées restent dans le journal des reçus)"
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
          <Button variant="secondary" onClick={() => printOnly('.cash-report', 'size: A4 portrait;', 'Rapport de caisse')}>Imprimer</Button>
        </div>
      )}>
      <div className="cash-report">
        <div className="print-only mb-3 hidden">
          <p className="text-lg font-semibold">École Chateaubriand Tamatave — caisse de {label.toLowerCase()}</p>
          <p className="text-xs">Édité le 13/10/2026 par le secrétariat · {r.movements.length} mouvements</p>
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

function CashTab({ movements, setMovements, role, account }) {
  const agent = role === 'DIRECTION' ? account?.name ?? 'Direction' : 'Mme Soa';
  const [draft, setDraft] = useState({ dir: 'OUT', nature: MANUAL_NATURES.OUT[0], journal: 'ECOLAGE', label: '', method: 'Espèces', amount: null, agent, withdrawnBy: WITHDRAWERS[0] });
  const balance = cashBalance(CASH_OPENING, counted(movements));
  const sum = (dir) => counted(movements).filter((m) => m.dir === dir).reduce((s, m) => s + m.amount, 0);
  const isWithdrawal = draft.dir === 'OUT' && draft.nature === 'Prélèvement Direction';
  const ok = draft.label.trim() && draft.amount > 0 && (draft.dir === 'IN' || (balance[draft.journal] ?? 0) >= draft.amount);
  const decide = (m, status) => setMovements(movements.map((x) => (x.id === m.id ? { ...x, status, decidedAt: new Date().toISOString().slice(0, 16) } : x)));
  return (
    <div className="space-y-5">
      <p className="rounded-lg bg-navy-50 px-3 py-2 text-sm text-navy-900">Ici, seulement ce qui n'est ni un paiement de famille (onglet <strong>Encaisser</strong>, avec reçu) ni un achat (onglet <strong>Dépenses & fournisseurs</strong>, avec facture) : fond de caisse, retrait ou dépôt en banque, remboursement, reversement au centre d'examen. Le tableau reprend tous les mouvements du jour.</p>
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
                  <td className="px-2"><p className="text-slate-800">{m.label}</p><p className="text-[11px] text-slate-500">{m.nature}{m.withdrawnBy ? ` · ${m.withdrawnBy}` : ''}</p>
                    {m.status === 'A_VALIDER' && (role === 'DIRECTION' && account?.name === m.withdrawnBy
                      ? <span className="mt-1 flex gap-1"><Button className="!px-2 !py-0.5 text-xs" onClick={() => decide(m, 'VALIDE')}>Je confirme</Button><Button variant="secondary" className="!px-2 !py-0.5 text-xs" onClick={() => decide(m, 'REFUSE')}>Ce n'est pas moi</Button></span>
                      : <Badge tone="amber">À confirmer par {m.withdrawnBy} — pas encore compté</Badge>)}
                    {m.status === 'REFUSE' && <Badge tone="red">Refusé par {m.withdrawnBy} — non compté</Badge>}</td>
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
            <select value={draft.dir} onChange={(e) => setDraft({ ...draft, dir: e.target.value, nature: MANUAL_NATURES[e.target.value][0] })} className={`mt-1 w-full bg-white ${inputCls}`}>
              <option value="IN">Entrée</option><option value="OUT">Sortie</option>
            </select>
          </label>
          <label className="text-xs text-slate-600">Nature
            <select value={draft.nature} onChange={(e) => setDraft({ ...draft, nature: e.target.value })} className={`mt-1 w-full bg-white ${inputCls}`}>
              {MANUAL_NATURES[draft.dir].map((n) => <option key={n}>{n}</option>)}
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
          {isWithdrawal && (
            <label className="text-xs text-slate-600">Prélevé par
              <select value={draft.withdrawnBy} onChange={(e) => setDraft({ ...draft, withdrawnBy: e.target.value })} className={`mt-1 w-full bg-white ${inputCls}`}>{WITHDRAWERS.map((w) => <option key={w}>{w}</option>)}</select>
            </label>
          )}
          <Button disabled={!ok} onClick={() => {
            const { withdrawnBy, ...base } = draft;
            const extra = isWithdrawal ? { withdrawnBy, status: withdrawalStatus({ role, accountName: account?.name, who: withdrawnBy }) } : {};
            setMovements([...movements, { ...base, ...extra, agent, id: `c${Date.now()}`, date: '2026-10-13', time: new Date().toTimeString().slice(0, 5) }]);
            setDraft({ ...draft, label: '', amount: null });
          }}>Enregistrer</Button>
        </div>
        {draft.dir === 'OUT' && draft.amount > (balance[draft.journal] ?? 0) && (
          <p className="mt-2 text-sm text-red-700">Solde insuffisant dans la caisse « {JOURNALS[draft.journal].label} ».</p>
        )}
        {isWithdrawal && <p className="mt-2 text-xs text-navy-900">{withdrawalStatus({ role, accountName: account?.name, who: draft.withdrawnBy }) === 'VALIDE' ? 'Vous saisissez votre propre prélèvement : il est compté tout de suite.' : `${draft.withdrawnBy} recevra une demande de confirmation ; le prélèvement ne sera compté qu'après sa confirmation.`}</p>}
        <p className="mt-2 text-xs text-slate-500">Chaque mouvement est attribué à l'agent connecté et horodaté ; une sortie ne peut pas dépasser le solde de son journal.</p>
      </Card>
      <MonthlyCashExport movements={movements} />
    </div>
  );
}

// Onglets optionnels : affichage réglé par la Direction (features.js)
const TAB_FEATURE = { fees: 'caisse.tarifs', articles: 'caisse.articles', reductions: 'caisse.reductions' };
// Ordre : le quotidien d'abord ; le paramétrage de l'année (fixé une fois puis verrouillé) à la fin.
const DAILY_TABS = ['collect', 'receipts', 'dunning', 'expenses', 'cash'];
const SETUP_GROUP = ['salaries', 'treasury', 'fees', 'articles', 'reductions'];
const TABS = [['collect', 'Encaisser'], ['receipts', 'Reçus & clôture'], ['dunning', 'Impayés & relances'], ['expenses', 'Dépenses & fournisseurs'], ['cash', 'Autres mouvements d\'espèces'], ['salaries', 'Salaires'], ['treasury', 'Trésorerie', 'DIRECTION'], ['fees', 'Classes & tarifs'], ['articles', 'Articles & services'], ['reductions', 'Réductions']];
const SETUP_TABS = ['fees', 'articles', 'reductions'];
// Paramétrage verrouillé pour l'année (Direction) : plus de modification jusqu'à la fin de l'année scolaire.
const LOCK_KEY = 'ent-tarifs-verrou-v1';
const loadLock = () => { try { return JSON.parse(localStorage.getItem(LOCK_KEY)); } catch { return null; } };
const saveLock = (v) => { try { if (v) localStorage.setItem(LOCK_KEY, JSON.stringify(v)); else localStorage.removeItem(LOCK_KEY); } catch { /* stockage indisponible */ } };
// Saisie libre d'un mouvement : ni encaissement d'une famille (onglet Encaisser, avec reçu) ni dépense
// avec facture (onglet Dépenses & fournisseurs) ; seulement fond de caisse, banque, remboursement…
const MANUAL_NATURES = { IN: CASH_NATURES.IN.filter((n) => n !== 'Encaissement famille'), OUT: CASH_NATURES.OUT.filter((n) => n !== 'Dépense de fonctionnement') };

export default function AccountingModule({ settings, role, account }) {
  const [lock, setLock] = useState(loadLock);
  const canEdit = role === 'DIRECTION' && !lock; // classes, tarifs, articles et services : Direction uniquement, tant que ce n'est pas verrouillé
  const [tab, setTab] = useState(() => takeIntent('accounting')?.tab ?? 'collect');
  const [fees, setFees] = useState(CLASS_FEES);
  const [articles, setArticles] = useState(ARTICLES);
  const [movements, setMovementsState] = useState(loadMovements);
  const setMovements = (m) => setMovementsState((prev) => { const next = typeof m === 'function' ? m(prev) : m; saveMovements(next); return next; });
  const [accounts, setAccounts] = useState(CASH_ACCOUNTS);
  const [receipts, setReceipts] = useState(RECEIPTS_TODAY);
  const [audit, setAudit] = useState(CASH_AUDIT);
  const [closings, setClosings] = useState(CASH_CLOSINGS);
  const [reductionTypes, setReductionTypes] = useState(REDUCTION_TYPES);
  // heures des vacataires proposées d'après l'emploi du temps du mois, moins les absences déclarées
  const [payroll, setPayroll] = useState(() => PAYROLL.map((p) => {
    if (!p.byHour || !TIMETABLE.some((s) => s.teacherId === p.staffId)) return p;
    const hrs = teacherHours(p.staffId, TIMETABLE, loadTeacherAbsences(), { from: '2026-10-01', to: '2026-10-31', today: '2026-10-31', settings });
    return { ...p, hours: hrs.done, plannedHours: hrs.planned };
  }));
  const [rates, setRates] = useState(HOURLY_RATES);
  const [salaryPayments, setSalaryPayments] = useState([]);
  const [payrollValidated, setPayrollValidated] = useState(null);
  const [expenses, setExpenses] = useState(EXPENSES);
  const [suppliers, setSuppliers] = useState(SUPPLIERS);
  // dépense payée en espèces : sortie de caisse liée (comptée une seule fois en trésorerie)
  const cashOut = (x) => setMovements((prev) => [...prev, { id: `x-${x.id}`, expenseId: x.id, date: x.date, time: '12:00', dir: 'OUT', nature: 'Dépense de fonctionnement', journal: 'ECOLAGE', label: x.label, method: 'Espèces', amount: x.amount, agent: actor }]);
  // trésorerie : caisse, dépenses, salaires du mois, dus des familles
  const tx = useMemo(() => toTransactions({
    cash: [...CASH_HISTORY, ...counted(movements)],
    expenses,
    payroll: payroll.map((p) => ({ staffId: p.staffId, amount: payOf(p, rateOn(rates, p.staffId, '2026-10-01')), paid: salaryPayments.find((x) => x.staffId === p.staffId) ? TODAY : null, due: '2026-10-30' })),
    dues: FAMILIES.map((f) => ({ id: f.id, amount: accountStatement(f.lines).totals.balance, due: TODAY })).filter((d) => d.amount > 0),
  }), [movements, expenses, payroll, rates, salaryPayments]);
  const actor = canEdit ? 'Mme Sheena Lo (Direction)' : 'Mme Hanta (secrétariat)';
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
          <h1 className="text-2xl font-semibold text-navy-900">Caisse et comptabilité</h1>
          <p className="text-sm text-slate-500">Trois journaux étanches : frais de scolarité, frais annexes, droits d'examen.</p>
        </div>
      </div>
      {/* onglets en deux groupes : le quotidien du secrétariat, puis le suivi et le paramétrage de la Direction */}
      <div className="space-y-1.5" role="tablist" aria-label="Caisse et comptabilité">
        {[['Quotidien', DAILY_TABS], ['Direction et paramétrage', SETUP_GROUP]].map(([group, ids]) => {
          const list = TABS.filter(([id, , only]) => ids.includes(id) && (!only || only === role) && featureVisible(settings, TAB_FEATURE[id], role));
          if (!list.length) return null;
          return (
            <div key={group} className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1">
              <span className="px-2 text-[11px] font-semibold uppercase tracking-wide text-slate-600">{group}</span>
              {list.map(([id, label]) => (
                <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium ${tab === id ? 'bg-white text-navy-900 shadow-sm' : 'text-slate-600'}`}>
                  {label}{id === 'receipts' && pendingCancels > 0 && <span className="ml-1.5 rounded-full bg-amber-500 px-1.5 text-[10px] font-semibold text-white">{pendingCancels}</span>}
                </button>
              ))}
            </div>
          );
        })}
      </div>
      {tab === 'collect' && <CollectPayment settings={settings} articles={articles} accounts={accounts} setAccounts={setAccounts} reductionTypes={reductionTypes} onCollected={onCollected} cashier={actor} closed={closed} />}
      {tab === 'receipts' && <CashControl role={role} actor={actor} receipts={receipts} setReceipts={setReceipts} audit={audit} setAudit={setAudit} movements={movements} setMovements={setMovements} accounts={accounts} setAccounts={setAccounts} closings={closings} setClosings={setClosings} safe={CASH_SAFE} settings={settings} salariesPaid={cashSalariesPaid(payroll, salaryPayments)} />}
      {tab === 'salaries' && <Salaries role={role} actor={actor} settings={settings} payroll={payroll} setPayroll={setPayroll} rates={rates} setRates={setRates} payments={salaryPayments} setPayments={setSalaryPayments} validated={payrollValidated} setValidated={setPayrollValidated} movements={movements} setMovements={setMovements} setAudit={setAudit} safe={CASH_SAFE} />}
      {SETUP_TABS.includes(tab) && (
        <div className={`flex flex-wrap items-center gap-3 rounded-2xl px-4 py-2.5 text-sm ${lock ? 'bg-slate-100 text-slate-800' : 'bg-amber-50 text-amber-900'}`}>
          {lock ? <span>🔒 Paramétrage {lock.year} verrouillé le {lock.at.split('-').reverse().join('/')} par {lock.by} : il ne change plus jusqu'à la fin de l'année.</span>
            : <span>Paramétrage de l'année {settings?.year ?? '2026-2027'} : à fixer une fois, puis à verrouiller.</span>}
          {role === 'DIRECTION' && (lock
            ? <Button variant="secondary" className="ml-auto" onClick={() => { if (window.confirm('Déverrouiller les tarifs de l\'année ? Toute modification touche les familles déjà facturées.')) { setLock(null); saveLock(null); } }}>Déverrouiller</Button>
            : <Button className="ml-auto" onClick={() => { const v = { year: settings?.year ?? '2026-2027', at: new Date().toISOString().slice(0, 10), by: actor }; setLock(v); saveLock(v); }}>Verrouiller pour l'année</Button>)}
        </div>
      )}
      {tab === 'reductions' && <Reductions canEdit={canEdit} actor={actor} types={reductionTypes} setTypes={setReductionTypes} accounts={accounts} setAccounts={setAccounts} />}
      {tab === 'fees' && <FeesTab fees={fees} setFees={setFees} settings={settings} canEdit={canEdit} />}
      {tab === 'articles' && <ArticlesTab articles={articles} setArticles={setArticles} canEdit={canEdit} />}
      {tab === 'cash' && <CashTab movements={movements} setMovements={setMovements} role={role} account={account} />}
      {tab === 'expenses' && <ExpensesTab expenses={expenses} setExpenses={setExpenses} suppliers={suppliers} setSuppliers={setSuppliers} onCashOut={cashOut} today={TODAY} />}
      {tab === 'dunning' && <DunningAlerts settings={settings} />}
      {tab === 'treasury' && role === 'DIRECTION' && <div className="space-y-5"><TreasuryDashboard tx={tx} opening={Object.values(CASH_YEAR_OPENING).reduce((a, b) => a + b, 0)} months={['2026-09', '2026-10']} /><SeparateJournals /></div>}
    </div>
  );
}
