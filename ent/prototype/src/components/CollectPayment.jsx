import React, { useMemo, useState } from 'react';
import { Badge, Button, Card, Icon } from './ui.jsx';
import { JOURNALS, CLASS_FEES, STUDENT_ACCOUNTS, BANKS, FAMILIES } from '../data/accounting.js';
import { studentDues, defaultSelection, validateInstrument, buildReceipts, PAYMENT_METHODS } from '../rules/billing.js';
import { formatAr } from '../rules/finance.js';
import ReceiptTicket from './ReceiptTicket.jsx';
import { printOnly } from '../print.js';
import { loadImport } from '../importStore.js';
import { seniority } from '../rules/documents.js';
import { CLASSES } from '../data/schoollife.js';
import { DEMO_SPECIALTIES } from '../data/manuals.js';
import { kitFor, kitTotals } from '../rules/manuals.js';
import { loadManuals } from '../manualsStore.js';
import { useOnline } from '../online.js';

/**
 * Tarifs d'un élève : grille de sa classe + lot de manuels (location des titres à rendre,
 * cahiers gardés), selon ses spécialités. Les prix des manuels se fixent dans « Manuels scolaires ».
 */
export function feesFor(account, manuals = loadManuals().manuals) {
  const row = CLASS_FEES.find((f) => f.cls === account.cls);
  if (!row) return null;
  const items = kitFor(account.cls, account.specialties ?? [], manuals);
  if (!items.length) return row;
  const t = kitTotals(items);
  return {
    ...row, location: t.rental, cahiers: t.sold,
    locationLabel: `Location des manuels (${t.rentalCount} × ${new Intl.NumberFormat('fr-FR').format(t.rentalCount ? t.rental / t.rentalCount : 0).replace(/ | /g, ' ')})`,
    cahiersLabel: `Cahiers d'activités (${t.soldCount})`,
  };
}

// Comptes de la caisse : comptes détaillés de la démo + les autres élèves des classes
// (réinscription, fascicule, location et septembre déjà réglés)
// Élèves importés : un compte par élève, sans paiement connu (les règlements ne sont pas importés)
const importedAccounts = () => {
  const imp = loadImport();
  const list = imp?.profiles ?? imp?.students;
  if (!list?.length) return null;
  return list.filter((s) => CLASS_FEES.some((f) => f.cls === s.cls)).map((s) => ({
    // nouvel élève : frais d'inscription et compte ouvert au mois d'arrivée ; ancien : réinscription
    id: s.id, name: `${s.lastName} ${s.firstName}`, cls: s.cls, family: `Famille ${s.lastName}`,
    isNew: seniority(s.enteredOn)?.isNew ?? false, specialties: s.specialties ?? [], enrolledOn: seniority(s.enteredOn)?.isNew && s.enteredOn > '2026-09-01' ? s.enteredOn : '2026-09-01', paid: [],
  }));
};
const DEMO_ACCOUNTS = [
  ...STUDENT_ACCOUNTS,
  ...Object.entries(CLASSES).flatMap(([cls, names]) => names
    .filter((n) => !STUDENT_ACCOUNTS.some((a) => a.name === n))
    .map((n, i) => ({
      id: `g-${cls}-${i}`, name: n, cls, family: `Famille ${n.split(' ')[0]}`, isNew: false, enrolledOn: '2026-09-01', specialties: DEMO_SPECIALTIES[n] ?? [],
      paid: ['REINSCRIPTION', 'FASCICULE', 'LOCATION', 'CAHIERS', 'ECO-09', ...(i % 2 ? ['ECO-10'] : [])],
    }))),
];
export const CASH_ACCOUNTS = importedAccounts() ?? DEMO_ACCOUNTS;
const CASH_CLASSES = CLASS_FEES.map((f) => f.cls).filter((c) => CASH_ACCOUNTS.some((a) => a.cls === c));

/** « −25 % scolarité, −50 % inscription » */
export const reductionText = (rates) => [rates.ECOLAGE && (rates.ECOLAGE === 100 ? 'frais de scolarité offerts' : `−${rates.ECOLAGE} % frais de scolarité`), rates.INSCRIPTION && `−${rates.INSCRIPTION} % inscription`].filter(Boolean).join(', ') + ' ; autres frais à 100 %';

// Qui apporte le paiement au bureau (imprimé sur le ticket)
export const BEARERS = [
  { id: 'PARENT', label: 'Parent' },
  { id: 'TUTEUR', label: 'Tuteur / tutrice' },
  { id: 'ELEVE', label: 'L\'élève' },
  { id: 'AUTRE', label: 'Autre personne (employé.e de maison, chauffeur…)' },
];

const payerOf = (student) => FAMILIES.find((f) => f.name === student.family)?.payer;

// Impression des seuls tickets, sur rouleau de 80 mm
const printTickets = () => printOnly('.ticket-print', 'size: 80mm 200mm; margin: 2mm;');

const TODAY = '2026-10-13';
const fmtDate = (iso) => iso.split('-').reverse().join('/');
const inputCls = 'rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm';
const STATUS_UI = {
  PAYE: { cls: 'border-emerald-200 bg-emerald-50 text-emerald-800', label: 'Payé' },
  ECHU: { cls: 'border-red-200 bg-white text-slate-800', label: 'Échu' },
  A_ECHOIR: { cls: 'border-slate-200 bg-white text-slate-700', label: 'À échoir' },
  EXONERE: { cls: 'border-sage-100 bg-sage-50 text-sage-700', label: 'Exonéré' },
};

function DueTile({ item, checked, onToggle }) {
  const ui = STATUS_UI[item.status];
  const paid = item.status === 'PAYE' || item.status === 'EXONERE';
  return (
    <label className={`flex cursor-pointer items-start gap-2 rounded-lg border p-2.5 text-sm transition
      ${paid ? `${ui.cls} cursor-default` : checked ? 'border-navy-500 bg-navy-50 ring-1 ring-navy-500' : ui.cls}`}>
      <input type="checkbox" className="mt-0.5" checked={paid || checked} disabled={paid} onChange={onToggle} />
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{item.short ?? item.label}</span>
        <span className="block text-xs text-slate-500">{item.discount ? <><s className="text-slate-400">{formatAr(item.base)}</s> </> : ''}{formatAr(item.amount)} · {item.status === 'EXONERE' ? 'exonéré' : paid ? 'payé' : `${ui.label.toLowerCase()} le ${fmtDate(item.due)}`}</span>
      </span>
      {item.status === 'ECHU' && !checked && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-red-500" title="Échu, non sélectionné" />}
    </label>
  );
}

export default function CollectPayment({ settings, articles = [], accounts: sharedAccounts, setAccounts: setSharedAccounts, reductionTypes = [], onCollected, cashier = 'Mme Hanta (bureau)', closed = false }) {
  const [localAccounts, setLocalAccounts] = useState(CASH_ACCOUNTS);
  const accounts = sharedAccounts ?? localAccounts;
  const online = useOnline();
  const setAccounts = setSharedAccounts ?? setLocalAccounts;
  const [cls, setCls] = useState('');
  const [bearer, setBearer] = useState({ role: 'PARENT', name: '' });
  const [query, setQuery] = useState('');
  const [studentId, setStudentId] = useState(CASH_ACCOUNTS.find((a) => a.id === 'e2')?.id ?? CASH_ACCOUNTS[0].id);
  const [selected, setSelected] = useState(null); // null = proposition par défaut
  const [instrument, setInstrument] = useState({ method: 'ESPECES', ref: '', bank: '' });
  const [receipts, setReceipts] = useState(null);
  const [receiptsAt, setReceiptsAt] = useState('');
  const [receiptsBearer, setReceiptsBearer] = useState('');
  const [counter, setCounter] = useState({ ECOLAGE: 412, FRAIS_ANNEXES: 208, DROITS_EXAMEN: 57 });

  const student = accounts.find((a) => a.id === studentId);
  // Réduction accordée par la Direction : type (taux) + motif, appliquée aux frais de scolarité
  const reductionOf = (a) => {
    const t = a.reduction && reductionTypes.find((x) => x.id === a.reduction.typeId);
    return t && (t.rates.ECOLAGE || t.rates.INSCRIPTION) ? { label: t.label, rates: t.rates } : null;
  };
  const manuals = useMemo(() => loadManuals().manuals, []);
  const fees = feesFor(student, manuals);
  // Articles et services vendus à l'élève : prix fixé au catalogue, réglés comme les autres échéances
  const items = useMemo(() => [
    ...studentDues({ ...student, reduction: reductionOf(student) }, fees, settings, TODAY),
    ...(student.extras ?? []).map((x) => ({ ...x, status: student.paid.includes(x.key) ? 'PAYE' : 'ECHU' })),
  ], [student, fees, settings, reductionTypes]);
  const [sale, setSale] = useState({ articleId: '', qty: 1 });
  const article = articles.find((a) => a.id === sale.articleId);
  const addArticle = () => {
    const key = `ART-${Date.now()}`;
    const extra = { key, label: `${article.label}${sale.qty > 1 ? ` × ${sale.qty}` : ''}`, amount: article.price * sale.qty, journal: article.journal, due: TODAY };
    setAccounts(accounts.map((a) => (a.id === studentId ? { ...a, extras: [...(a.extras ?? []), extra] } : a)));
    setSelected([...keys, key]);
    setSale({ articleId: '', qty: 1 });
  };
  const keys = selected ?? defaultSelection(items);
  const chosen = items.filter((i) => keys.includes(i.key) && !['PAYE', 'EXONERE'].includes(i.status));
  const total = chosen.reduce((s, i) => s + i.amount, 0);
  const errors = validateInstrument(instrument);
  const overdue = items.filter((i) => i.status === 'ECHU');

  const pick = (id) => { setStudentId(id); setSelected(null); setReceipts(null); setInstrument({ method: 'ESPECES', ref: '', bank: '' }); setBearer({ role: 'PARENT', name: '' }); };
  const toggle = (key) => setSelected(keys.includes(key) ? keys.filter((k) => k !== key) : [...keys, key]);
  const months = items.filter((i) => i.journal === 'ECOLAGE');
  const others = items.filter((i) => i.journal !== 'ECOLAGE' && !i.key.startsWith('ART-'));
  const extras = items.filter((i) => i.key.startsWith('ART-'));
  const unpaidMonths = months.filter((m) => !['PAYE', 'EXONERE'].includes(m.status));

  const collect = () => {
    const next = { ...counter };
    const r = buildReceipts(items, keys, instrument, (j) => ++next[j]);
    setCounter(next);
    setAccounts(accounts.map((a) => (a.id === studentId ? { ...a, paid: [...a.paid, ...chosen.map((c) => c.key)] } : a)));
    const time = new Date().toTimeString().slice(0, 5);
    const at = `${TODAY.split('-').reverse().join('/')} ${time}`;
    setReceipts(r);
    setReceiptsBearer(bearerLabel);
    setReceiptsAt(at);
    onCollected?.(r.map((x) => ({ ...x, date: TODAY, time, at, studentId, student: student.name, cls: student.cls, bearer: bearerLabel, cashier, status: 'VALIDE' })));
    setSelected([]);
  };

  const matches = accounts.filter((a) => (!cls || a.cls === cls) && `${a.name} ${a.family}`.toLowerCase().includes(query.toLowerCase()));
  const defaultPayer = payerOf(student) ?? '';
  const bearerName = bearer.role === 'ELEVE' ? student.name : (bearer.name || (bearer.role === 'PARENT' ? defaultPayer : '')).trim();
  const bearerLabel = bearerName ? `${bearerName} (${BEARERS.find((b) => b.id === bearer.role).label.split(' (')[0].toLowerCase()})` : '';

  return (
    <div className="grid gap-5 xl:grid-cols-[260px_1fr_340px] xl:items-start">
      <Card title="Élève">
        <label className="block text-xs font-medium text-slate-600">Classe
          <select value={cls} onChange={(e) => setCls(e.target.value)} className={`mt-1 w-full ${inputCls}`}>
            <option value="">Toutes les classes</option>
            {CASH_CLASSES.map((c) => <option key={c} value={c}>{c} ({accounts.filter((a) => a.cls === c).length})</option>)}
          </select>
        </label>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Nom de l'élève ou de la famille…" className={`mt-2 w-full ${inputCls}`} />
        <p className="mt-2 text-[11px] text-slate-500">{matches.length} élève{matches.length > 1 ? 's' : ''}</p>
        <ul className="-mx-2 mt-1 max-h-[420px] space-y-0.5 overflow-y-auto">
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
        {reductionOf(student) && (
          <p className="mb-3 rounded-lg bg-sage-50 px-3 py-2 text-xs text-sage-700">Réduction accordée par la Direction : <strong>{reductionOf(student).label}</strong> ({reductionText(reductionOf(student).rates)}) · {student.reduction.motif}</p>
        )}
        <div className="mb-3 flex flex-wrap gap-2">
          <Button variant="secondary" className="!py-1 text-xs" onClick={() => setSelected(defaultSelection(items))}>Proposition : tout l'échu</Button>
          <Button variant="secondary" className="!py-1 text-xs" onClick={() => setSelected(items.filter((i) => !['PAYE', 'EXONERE'].includes(i.status) && (i.journal !== 'ECOLAGE' || i.due <= '2026-12-31')).map((i) => i.key))}>Jusqu'à décembre (1er trimestre)</Button>
          <Button variant="secondary" className="!py-1 text-xs" onClick={() => setSelected(items.filter((i) => !['PAYE', 'EXONERE'].includes(i.status)).map((i) => i.key))}>Toute l'année</Button>
          <Button variant="ghost" className="!py-1 text-xs" onClick={() => setSelected([])}>Tout décocher</Button>
        </div>

        <p className="mb-1.5 text-xs font-semibold text-slate-500">Frais de scolarité — {months.length} mois ({unpaidMonths.length} restant{unpaidMonths.length > 1 ? 's' : ''})</p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {months.map((m) => <DueTile key={m.key} item={m} checked={keys.includes(m.key)} onToggle={() => toggle(m.key)} />)}
        </div>
        <p className="mb-1.5 mt-4 text-xs font-semibold text-slate-500">Frais annuels et examens</p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {others.map((m) => <DueTile key={m.key} item={m} checked={keys.includes(m.key)} onToggle={() => toggle(m.key)} />)}
        </div>
        {extras.length > 0 && (
          <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {extras.map((m) => <DueTile key={m.key} item={m} checked={keys.includes(m.key)} onToggle={() => toggle(m.key)} />)}
          </div>
        )}
        <p className="mb-1.5 mt-4 text-xs font-semibold text-slate-500">Articles et services (tarifs fixés par la Direction)</p>
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 p-2">
          <select value={sale.articleId} onChange={(e) => setSale({ ...sale, articleId: e.target.value })} aria-label="Article ou service" className={`min-w-0 flex-1 ${inputCls}`}>
            <option value="">Article ou service…</option>
            {articles.filter((a) => a.active && a.price > 0).map((a) => <option key={a.id} value={a.id}>{a.group} — {a.label} ({formatAr(a.price)} {a.unit})</option>)}
          </select>
          <label className="text-xs text-slate-600">Qté <input type="number" min={1} max={20} value={sale.qty} onChange={(e) => setSale({ ...sale, qty: Math.min(20, Math.max(1, Number(e.target.value) || 1)) })} className={`ml-1 w-16 ${inputCls}`} /></label>
          {article && <span className="text-sm font-semibold tabular-nums">{formatAr(article.price * sale.qty)}</span>}
          <Button variant="secondary" className="!py-1 text-xs" disabled={!article} onClick={addArticle}>Ajouter à l'encaissement</Button>
        </div>
        <p className="mt-2 text-xs text-slate-500">Chaque échéance, article ou service se règle en entier : pas de paiement partiel. Un ticket est toujours imprimé.</p>
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
          <fieldset className="mt-4 space-y-2">
            <legend className="text-xs font-medium text-slate-600">Paiement remis par</legend>
            <select value={bearer.role} onChange={(e) => setBearer({ role: e.target.value, name: '' })} className={`w-full ${inputCls}`}>
              {BEARERS.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
            </select>
            {bearer.role !== 'ELEVE' && (
              <input value={bearer.name} onChange={(e) => setBearer({ ...bearer, name: e.target.value })}
                placeholder={bearer.role === 'PARENT' && defaultPayer ? defaultPayer : 'Nom et prénom'} className={`w-full ${inputCls}`} />
            )}
            {!bearerName && <p className="text-xs text-red-700">Indiquer le nom de la personne qui remet le paiement.</p>}
          </fieldset>
          {closed && <p className="mt-3 rounded-lg bg-amber-50 p-2 text-xs text-amber-900">La caisse du jour est clôturée : les encaissements reprennent demain.</p>}
          {!online && <p className="mt-3 rounded-lg bg-red-50 p-2 text-xs text-red-800">Hors connexion : l'encaissement est désactivé pour éviter les doublons de reçus. Reconnectez-vous (clé 4G ou partage de connexion).</p>}
          <Button className="mt-4 w-full" disabled={!online || closed || !chosen.length || errors.length > 0 || !bearerName} onClick={collect}>
            Encaisser {total > 0 && formatAr(total)}
          </Button>
          <p className="mt-2 text-[11px] text-slate-500">Un reçu est édité par journal (frais de scolarité, frais annexes, droits d'examen).</p>
        </Card>

        {receipts && (
          <Card title={`Reçu${receipts.length > 1 ? 's' : ''} — format ticket de caisse`} subtitle="Imprimante thermique 80 mm · un ticket par journal"
            action={<Button variant="secondary" onClick={printTickets}>Imprimer</Button>}>
            <div className="ticket-print flex flex-col items-center gap-4 rounded-xl bg-slate-100 py-4">
              {receipts.map((r) => <ReceiptTicket key={r.number} receipt={r} student={student} payer={receiptsBearer} cashier={cashier} at={receiptsAt} />)}
            </div>
            <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500"><Icon name="bell" />Reçu envoyé au parent payeur par e-mail et dans l'application.</p>
          </Card>
        )}
      </div>
    </div>
  );
}
