import React, { useState } from 'react';
import { Badge, Button, Card, Stat } from './ui.jsx';
import { usePersistent } from '../persist.js';
import { EXPENSE_CATEGORIES } from '../data/treasury.js';
import { formatAr } from '../rules/finance.js';
import { askConfirm } from './Dialogs.jsx';
import { activeSite } from '../site.js';
import { today, monthLabel } from '../clock.js';

// Dépenses payées par l'autre site pour nous (ex. Tana paie une facture de Tamatave) : HORS COMPTES.
// Elles n'entrent ni dans la caisse, ni dans les dépenses, ni dans la trésorerie : c'est un aperçu, pour savoir ce
// que le site coûte vraiment et ce qui reste éventuellement à rembourser. Direction seulement ; corrigeable.
const KEY = 'ent-s-hors-comptes';
const inputCls = 'rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm';
const fr = (iso) => (iso ? iso.split('-').reverse().join('/') : '');
const OTHER = () => (activeSite() === 'TANA' ? 'Tamatave' : 'Tana');
export const offBooksLabel = () => (activeSite() === 'TANA' ? 'Payé pour Tamatave' : 'Payé par Tana');
const REFUND = { NON: ['Pas à rembourser', 'slate'], A_REMBOURSER: ['À rembourser', 'amber'], REMBOURSE: ['Remboursé', 'green'] };

export default function OffBooksTab({ actor }) {
  const [list, setList] = usePersistent(KEY, []);
  const blank = { date: today(), label: '', category: EXPENSE_CATEGORIES[0], amount: '', refund: 'NON', note: '' };
  const [d, setD] = useState(blank);
  const [editId, setEditId] = useState(null);
  const [month, setMonth] = useState('');
  const amount = Number(String(d.amount).replace(/\s/g, '')) || 0;
  const ok = d.date && d.label.trim() && amount > 0;
  const shown = (list ?? []).filter((x) => !month || x.date.startsWith(month)).sort((a, b) => b.date.localeCompare(a.date));
  const sum = (l) => l.reduce((t, x) => t + x.amount, 0);
  const byCat = Object.entries(shown.reduce((m, x) => ({ ...m, [x.category]: (m[x.category] ?? 0) + x.amount }), {})).sort((a, b) => b[1] - a[1]);
  const months = [...new Set((list ?? []).map((x) => x.date.slice(0, 7)))].sort().reverse();
  const save = () => {
    const item = { ...d, label: d.label.trim(), note: d.note.trim(), amount, by: actor, at: today() };
    setList(editId ? list.map((x) => (x.id === editId ? { ...x, ...item } : x)) : [{ ...item, id: `hc${Date.now()}` }, ...(list ?? [])]);
    setD(blank); setEditId(null);
  };
  return (
    <div className="space-y-5">
      <p className="rounded-2xl bg-navy-50 p-3 text-sm text-navy-900"><strong>Hors comptes :</strong> ces dépenses ont été payées par {OTHER()} pour nous. Elles n'entrent ni dans la caisse, ni dans les dépenses, ni dans la trésorerie ; elles servent à voir ce que l'école coûte vraiment et ce qui reste à rembourser.</p>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={month ? `Total ${monthLabel(month)}` : 'Total depuis le début'} value={formatAr(sum(shown))} hint={`${shown.length} dépense${shown.length > 1 ? 's' : ''}`} />
        <Stat label="À rembourser" value={formatAr(sum(shown.filter((x) => x.refund === 'A_REMBOURSER')))} tone="amber" />
        <Stat label="Déjà remboursé" value={formatAr(sum(shown.filter((x) => x.refund === 'REMBOURSE')))} tone="green" />
        <Stat label="Plus gros poste" value={byCat[0] ? byCat[0][0] : '—'} hint={byCat[0] ? formatAr(byCat[0][1]) : ''} />
      </div>
      <div className="grid gap-5 xl:grid-cols-[1fr_380px] xl:items-start">
        <Card title={`${offBooksLabel()} — dépenses hors comptes`}
          action={<select value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Mois" className={inputCls}><option value="">Tous les mois</option>{months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}</select>}>
          {!shown.length ? <p className="text-sm text-slate-600">Aucune dépense enregistrée{month ? ' ce mois-ci' : ''}.</p> : (
            <ul className="divide-y divide-slate-100">
              {shown.map((x) => (
                <li key={x.id} className="flex flex-wrap items-start justify-between gap-2 py-2 text-sm">
                  <span className="min-w-0"><span className="font-medium text-slate-900">{x.label}</span>
                    <span className="block text-xs text-slate-500">{fr(x.date)} · {x.category}{x.note ? ` · ${x.note}` : ''} · noté par {x.by}</span></span>
                  <span className="flex items-center gap-2">
                    <span className="font-semibold tabular-nums">{formatAr(x.amount)}</span>
                    <Badge tone={REFUND[x.refund][1]}>{REFUND[x.refund][0]}</Badge>
                    <button type="button" className="text-xs text-navy-700 underline" onClick={() => { setD({ ...x, amount: String(x.amount) }); setEditId(x.id); }}>Corriger</button>
                    <button type="button" className="text-xs text-red-700 underline" onClick={async () => { if (await askConfirm(`Retirer « ${x.label} » (${formatAr(x.amount)}) de la liste ?`)) setList(list.filter((y) => y.id !== x.id)); }}>Retirer</button>
                  </span>
                </li>
              ))}
            </ul>
          )}
          {byCat.length > 1 && (
            <div className="mt-4 border-t border-slate-100 pt-3">
              <p className="mb-1 text-xs font-semibold text-slate-600">Par catégorie</p>
              <ul className="space-y-0.5 text-sm">{byCat.map(([c, v]) => <li key={c} className="flex justify-between"><span>{c}</span><span className="tabular-nums">{formatAr(v)}</span></li>)}</ul>
            </div>
          )}
        </Card>
        <Card title={editId ? 'Corriger la dépense' : 'Ajouter une dépense'} subtitle={`Payée par ${OTHER()} pour nous`}>
          <div className="space-y-2 text-sm">
            <label className="block text-xs text-slate-600">Libellé<input value={d.label} onChange={(e) => setD({ ...d, label: e.target.value })} placeholder="ex. Facture Jirama de novembre" className={`mt-1 w-full ${inputCls}`} /></label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-xs text-slate-600">Date<input type="date" value={d.date} onChange={(e) => setD({ ...d, date: e.target.value })} className={`mt-1 w-full ${inputCls}`} /></label>
              <label className="block text-xs text-slate-600">Montant (Ar)<input inputMode="numeric" value={d.amount} onChange={(e) => setD({ ...d, amount: e.target.value.replace(/[^\d\s]/g, '') })} className={`mt-1 w-full ${inputCls}`} /></label>
            </div>
            <label className="block text-xs text-slate-600">Catégorie<select value={d.category} onChange={(e) => setD({ ...d, category: e.target.value })} className={`mt-1 w-full ${inputCls}`}>{EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></label>
            <label className="block text-xs text-slate-600">Remboursement<select value={d.refund} onChange={(e) => setD({ ...d, refund: e.target.value })} className={`mt-1 w-full ${inputCls}`}>{Object.entries(REFUND).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}</select></label>
            <label className="block text-xs text-slate-600">Précision (facultatif)<input value={d.note} onChange={(e) => setD({ ...d, note: e.target.value })} placeholder="ex. réf. facture, virement du…" className={`mt-1 w-full ${inputCls}`} /></label>
            <div className="flex gap-2"><Button className="flex-1" disabled={!ok} onClick={save}>{editId ? 'Enregistrer la correction' : 'Ajouter'}</Button>{editId && <Button variant="secondary" onClick={() => { setD(blank); setEditId(null); }}>Annuler</Button>}</div>
          </div>
        </Card>
      </div>
    </div>
  );
}
