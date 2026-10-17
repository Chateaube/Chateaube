import React, { useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card, Stat } from './ui.jsx';
import { CLASSES } from '../data/schoollife.js';
import { DEMO_SPECIALTIES, RENTAL_PRICE } from '../data/manuals.js';
import { SPECIALTIES } from '../rules/bulletin.js';
import {
  CONDITIONS, KINDS, BINDINGS, CATEGORIES, conditionLabel, lentCount, totalCopies, lend, giveBack, manualBlocks, eligible, kitFor, kitTotals,
} from '../rules/manuals.js';
import { formatAr } from '../rules/finance.js';
import { loadManuals, saveManuals } from '../manualsStore.js';
import { loadImport } from '../importStore.js';

// Manuels scolaires (Bureau et Direction) :
// - manuels de base à rendre, en location (25 000 Ar l'un pour l'année) ;
// - cahiers d'activités à rendre (location) ou gardés par l'élève (vendus, prix propre) ;
// - un lot identique pour toute la classe, sauf les manuels de spécialité (1re et Terminale générales) ;
// - stock par état, prêts, retours, pertes à régler au prix fixé pour chaque manuel.
// Les prix sont fixés par la Direction ; le Bureau gère le stock et la distribution.

const TODAY = '2026-10-13';
const YEAR_END = '2027-06-30';
const inputCls = 'rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm';
const fmt = (iso) => (iso ? iso.split('-').reverse().join('/') : '');
const TONE = { NEUF: 'green', BON: 'navy', USE: 'amber', DECHIRE: 'red', PERDU: 'red' };
const ALL_CLASSES = ['6e', '5e', '4e', '3e', '2de', '1re Générale', '1re STMG', 'Terminale Générale', 'Terminale STMG'];
const TABS = [['kit', 'Lot de la classe'], ['stock', 'Stock et prix'], ['loans', 'Prêts par titre'], ['due', 'À régler et non rendus']];

// Spécialités : élèves importés (fiche) sinon démonstration
const importedSpecialties = () => Object.fromEntries((loadImport()?.students ?? []).map((s) => [`${s.lastName} ${s.firstName}`, s.specialties ?? []]));
const kindLabel = (m) => (m.returnable ? (m.category === 'CAHIER' ? 'Cahier à rendre' : 'Manuel à rendre') : 'Cahier gardé (vendu)');
/** « Foucher · programme 2019 » */
export const editionLabel = (m) => [m.editor, m.programYear && `programme ${m.programYear}`].filter(Boolean).join(' · ');
const priceLabel = (m) => (m.returnable ? `${formatAr(m.price)} / an` : formatAr(m.price));

function Price({ value, onChange, canEdit, label }) {
  if (!canEdit) return <span className="tabular-nums">{value === null ? '—' : formatAr(value)}</span>;
  return (
    <input inputMode="numeric" value={value ?? ''} aria-label={label} placeholder="—"
      onChange={(e) => { const d = e.target.value.replace(/\D/g, ''); onChange(d === '' ? null : Number(d)); }}
      className="w-24 rounded-md border border-slate-300 px-2 py-1 text-right text-sm tabular-nums" />
  );
}

/* ---------- Lot de la classe : ce que reçoit et paie chaque élève, qui a quoi ---------- */
function KitTab({ manuals, setManuals, loans, setLoans, specialtiesOf }) {
  const [cls, setCls] = useState('1re STMG');
  const [error, setError] = useState('');
  const items = manuals.filter((m) => m.levels.includes(cls));
  const students = CLASSES[cls] ?? [];
  const base = kitTotals(items.filter((m) => !m.specialty));
  const spe = items.filter((m) => m.specialty);
  const has = (student, m) => loans.find((l) => l.manualId === m.id && l.student === student && (l.sold || !l.returnedOn));

  const distribute = () => {
    let ms = manuals;
    const added = [];
    const errors = [];
    for (const student of students) {
      for (const m0 of items) {
        if (!eligible(m0, specialtiesOf(student)) || has(student, m0) || added.some((l) => l.manualId === m0.id && l.student === student)) continue;
        const m = ms.find((x) => x.id === m0.id);
        const state = CONDITIONS.find((c) => c.id !== 'DECHIRE' && m.stock[c.id] > 0)?.id;
        if (!state) { errors.push(m.title); continue; }
        const r = lend(m, [...loans, ...added], { student, cls, state, on: TODAY, dueBack: YEAR_END });
        if (r.error) { errors.push(r.error); continue; }
        ms = ms.map((x) => (x.id === m.id ? r.manual : x));
        added.push(r.loan);
      }
    }
    setManuals(ms);
    setLoans([...loans, ...added]);
    setError(errors.length ? `Stock insuffisant : ${[...new Set(errors)].join(', ')}. À compléter dans « Stock et prix ».` : '');
  };

  return (
    <div className="space-y-5">
      <Card title="Lot de la classe" subtitle="Tous les élèves d'une classe reçoivent le même lot ; en 1re et Terminale générales, s'ajoutent les manuels de leurs spécialités"
        action={(
          <select value={cls} onChange={(e) => { setCls(e.target.value); setError(''); }} className={inputCls} aria-label="Classe">
            {ALL_CLASSES.map((c) => <option key={c}>{c}</option>)}
          </select>
        )}>
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label="Location par élève" value={formatAr(base.rental)} hint={`${base.rentalCount} titre${base.rentalCount > 1 ? 's' : ''} à rendre × ${formatAr(RENTAL_PRICE)}`} />
          <Stat label="Cahiers gardés par élève" value={formatAr(base.sold)} hint={`${base.soldCount} cahier${base.soldCount > 1 ? 's' : ''} vendu${base.soldCount > 1 ? 's' : ''}`} />
          <Stat label="Spécialités" value={spe.length ? `+ ${formatAr(spe[0].price)}` : '—'} hint={spe.length ? 'par spécialité suivie (location)' : 'pas de spécialité dans cette classe'} />
        </div>
        <ul className="mt-4 divide-y divide-slate-100">
          {items.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
              <span className="min-w-0 flex-1 font-medium text-slate-800">{m.title}{editionLabel(m) && <span className="block text-xs font-normal text-slate-500">{editionLabel(m)}</span>}</span>
              {m.specialty && <Badge tone="violet">Spécialité {SPECIALTIES[m.specialty]}</Badge>}
              <Badge tone={m.returnable ? 'navy' : 'green'}>{kindLabel(m)}</Badge>
              <span className="w-28 text-right tabular-nums text-slate-600">{priceLabel(m)}</span>
            </li>
          ))}
          {items.length === 0 && <li className="py-2 text-sm text-slate-500">Aucun titre pour cette classe : ajoutez-les dans « Stock et prix ».</li>}
        </ul>
        <p className="mt-2 text-xs text-slate-500">Ces montants sont facturés à la caisse avec les frais annuels (location des manuels et cahiers d'activités) ; ils apparaissent dans Classes & tarifs.</p>
      </Card>

      {students.length > 0 && items.length > 0 && (
        <Card title={`Qui a quoi — ${cls}`} subtitle="✓ remis · – non remis · ✕ perdu · gris : non concerné (spécialité)"
          action={<Button onClick={distribute}>Distribuer le lot à toute la classe</Button>}>
          {error && <p className="mb-3 rounded-lg bg-red-50 p-2 text-sm text-red-800">{error}</p>}
          <div className="-mx-5 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-y border-slate-100 bg-slate-50 text-slate-500">
                  <th className="sticky left-0 bg-slate-50 px-4 py-2 text-left font-medium">Élève</th>
                  {items.map((m) => <th key={m.id} className="px-1.5 py-2 font-medium" title={m.title}><span className="block max-w-[80px] truncate">{m.subject}</span>{!m.returnable && <span className="block text-[10px] font-normal">cahier</span>}</th>)}
                </tr>
              </thead>
              <tbody>
                {students.map((s) => (
                  <tr key={s} className="border-b border-slate-100 last:border-0">
                    <td className="sticky left-0 bg-white px-4 py-1.5 text-sm text-slate-800">{s}{specialtiesOf(s).length > 0 && <span className="block text-[11px] text-slate-500">{specialtiesOf(s).join(' + ')}</span>}</td>
                    {items.map((m) => {
                      if (!eligible(m, specialtiesOf(s))) return <td key={m.id} className="bg-slate-50 text-center text-slate-300">·</td>;
                      const l = loans.find((x) => x.manualId === m.id && x.student === s && (x.sold || !x.returnedOn));
                      return <td key={m.id} className={`text-center text-sm ${!l ? 'text-slate-400' : l.stateIn === 'PERDU' ? 'text-red-600' : 'text-emerald-600'}`} title={l ? `${l.sold ? 'Remis' : 'Prêté'} le ${fmt(l.issuedOn)} (${conditionLabel(l.stateOut)})` : 'Non remis'}>{!l ? '–' : l.stateIn === 'PERDU' ? '✕' : '✓'}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

/* ---------- Stock et prix ---------- */
function StockTab({ manuals, setManuals, loans, canEdit }) {
  const [cls, setCls] = useState('');
  const [draft, setDraft] = useState({ title: '', subject: '', level: '6e', category: 'MANUEL', returnable: true, kind: 'ORIGINAL', binding: 'DOS_CARRE', price: RENTAL_PRICE, replacementPrice: null, specialty: '', editor: '', programYear: '', state: 'NEUF', qty: 1 });
  const [move, setMove] = useState({ op: 'IN', id: '', state: 'NEUF', qty: 1 });
  const [stockError, setStockError] = useState('');
  const shown = manuals.filter((m) => !cls || m.levels.includes(cls));
  const update = (id, patch) => setManuals(manuals.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  const totals = manuals.reduce((t, m) => ({ stock: t.stock + Object.values(m.stock).reduce((a, b) => a + b, 0), lent: t.lent + lentCount(m, loans), torn: t.torn + m.stock.DECHIRE }), { stock: 0, lent: 0, torn: 0 });
  const moveStock = () => {
    const m = manuals.find((x) => x.id === move.id);
    const from = move.op === 'REPAIR' ? 'DECHIRE' : move.state;
    if (move.op !== 'IN' && (m.stock[from] ?? 0) < move.qty) { setStockError(`Seulement ${m.stock[from] ?? 0} exemplaire(s) « ${conditionLabel(from)} » en réserve.`); return; }
    const stock = { ...m.stock };
    if (move.op === 'IN') stock[move.state] = (stock[move.state] ?? 0) + move.qty;
    if (move.op === 'OUT') stock[from] -= move.qty;
    if (move.op === 'REPAIR') { stock.DECHIRE -= move.qty; stock.USE = (stock.USE ?? 0) + move.qty; }
    update(m.id, { stock });
    setStockError('');
    setMove({ ...move, qty: 1 });
  };
  const setCategory = (category, returnable) => setDraft({ ...draft, category, returnable, price: returnable ? RENTAL_PRICE : null, replacementPrice: null });
  const draftOk = draft.title.trim() && draft.price > 0 && (!draft.returnable || draft.replacementPrice > 0);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Titres" value={String(manuals.length)} />
        <Stat label="Exemplaires en réserve" value={String(totals.stock)} />
        <Stat label="Prêtés aux élèves" value={String(totals.lent)} />
        <Stat label="Déchirés à réparer" value={String(totals.torn)} tone={totals.torn ? 'amber' : undefined} />
      </div>
      <Card title="Titres, prix et stock" subtitle={canEdit ? 'Prix modifiables par la Direction : location (titres à rendre), vente (cahiers gardés), prix en cas de perte' : 'Consultation des prix : seule la Direction les modifie'}
        action={(
          <select value={cls} onChange={(e) => setCls(e.target.value)} className={inputCls} aria-label="Filtrer par classe">
            <option value="">Toutes les classes</option>{ALL_CLASSES.map((c) => <option key={c}>{c}</option>)}
          </select>
        )}>
        <div className="-mx-5 overflow-x-auto">
          <table className="w-full min-w-[1040px] text-sm">
            <thead>
              <tr className="border-y border-slate-100 bg-slate-50 text-left text-xs text-slate-500">
                <th className="px-4 py-2 font-medium">Titre</th><th className="px-2 font-medium">Type</th>
                <th className="px-2 text-right font-medium">Prix</th><th className="px-2 text-right font-medium">Si perdu / abîmé</th>
                {CONDITIONS.map((c) => <th key={c.id} className="px-2 text-right font-medium">{c.label}</th>)}
                <th className="px-2 text-right font-medium">Prêtés</th><th className="px-4 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((m) => (
                <tr key={m.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-2"><p className="font-medium text-slate-800">{m.title}</p><p className="text-xs text-slate-500">{m.levels.join(', ')}{m.specialty ? ` · spécialité ${SPECIALTIES[m.specialty]}` : ''}{editionLabel(m) ? ` · ${editionLabel(m)}` : ''}</p></td>
                  <td className="px-2"><Badge tone={m.returnable ? 'navy' : 'green'}>{kindLabel(m)}</Badge><p className="mt-0.5 text-[11px] text-slate-500">{KINDS[m.kind]} · {BINDINGS[m.binding]}</p></td>
                  <td className="px-2 text-right"><Price canEdit={canEdit} value={m.price} onChange={(v) => update(m.id, { price: v ?? 0 })} label={`Prix — ${m.title}`} />{m.returnable && <span className="block text-[10px] text-slate-500">location / an</span>}</td>
                  <td className="px-2 text-right">{m.returnable ? <Price canEdit={canEdit} value={m.replacementPrice} onChange={(v) => update(m.id, { replacementPrice: v })} label={`Prix si perdu — ${m.title}`} /> : <span className="text-xs text-slate-400">gardé</span>}</td>
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
            <select value={move.op} onChange={(e) => setMove({ ...move, op: e.target.value })} className={inputCls} aria-label="Opération">
              <option value="IN">Entrée en réserve</option><option value="REPAIR">Réparation (déchiré → usé)</option><option value="OUT">Réforme (sortie définitive)</option>
            </select>
            <select value={move.id} onChange={(e) => setMove({ ...move, id: e.target.value })} className={inputCls} aria-label="Titre">
              <option value="">Titre…</option>{manuals.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
            </select>
            {move.op !== 'REPAIR' && (
              <select value={move.state} onChange={(e) => setMove({ ...move, state: e.target.value })} className={inputCls} aria-label="État">
                {CONDITIONS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            )}
            <input type="number" min={1} value={move.qty} onChange={(e) => setMove({ ...move, qty: Math.max(1, Number(e.target.value) || 1) })} className={inputCls} aria-label="Quantité" />
            {stockError && <p className="text-xs text-red-700 sm:col-span-2">{stockError}</p>}
            <Button className="sm:col-span-2" disabled={!move.id} onClick={moveStock}>Enregistrer</Button>
          </div>
        </Card>
        <Card title="Nouveau titre" subtitle={canEdit ? 'Manuel ou cahier, à rendre ou gardé, avec ses prix' : 'Réservé à la Direction (prix)'}>
          {canEdit ? (
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <div className="flex flex-wrap gap-1.5 sm:col-span-2">
                {[['MANUEL', true, 'Manuel à rendre'], ['CAHIER', true, 'Cahier à rendre'], ['CAHIER', false, 'Cahier gardé (vendu)']].map(([c, r, l]) => (
                  <button key={l} type="button" aria-pressed={draft.category === c && draft.returnable === r} onClick={() => setCategory(c, r)}
                    className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ${draft.category === c && draft.returnable === r ? 'bg-navy-500 text-white ring-navy-500' : 'bg-white text-slate-600 ring-slate-300'}`}>{l}</button>
                ))}
              </div>
              <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Désignation (ex. Histoire-Géographie 4e)" className={`sm:col-span-2 ${inputCls}`} aria-label="Titre du nouveau titre" />
              <input value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} placeholder="Matière" className={inputCls} aria-label="Matière" />
              <input value={draft.editor} onChange={(e) => setDraft({ ...draft, editor: e.target.value })} placeholder="Éditeur (ex. Hachette)" className={inputCls} aria-label="Éditeur" />
              <input value={draft.programYear} onChange={(e) => setDraft({ ...draft, programYear: e.target.value.replace(/\D/g, '').slice(0, 4) })} placeholder="Année du programme (ex. 2019)" className={inputCls} aria-label="Année du programme" />
              <select value={draft.level} onChange={(e) => setDraft({ ...draft, level: e.target.value, specialty: '' })} className={inputCls} aria-label="Classe">{ALL_CLASSES.map((c) => <option key={c}>{c}</option>)}</select>
              {/Générale/.test(draft.level) && /^(1re|Terminale)/.test(draft.level) && (
                <select value={draft.specialty} onChange={(e) => setDraft({ ...draft, specialty: e.target.value })} className={`sm:col-span-2 ${inputCls}`} aria-label="Spécialité">
                  <option value="">Pour toute la classe</option>{Object.entries(SPECIALTIES).map(([k, l]) => <option key={k} value={k}>Spécialité {l} seulement</option>)}
                </select>
              )}
              <select value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value })} className={inputCls} aria-label="Original ou photocopie">{Object.entries(KINDS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
              <select value={draft.binding} onChange={(e) => setDraft({ ...draft, binding: e.target.value })} className={inputCls} aria-label="Reliure">{Object.entries(BINDINGS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
              <label className="text-xs text-slate-600">{draft.returnable ? 'Location / an (Ar)' : 'Prix de vente (Ar)'}<div className="mt-1"><Price canEdit value={draft.price} onChange={(v) => setDraft({ ...draft, price: v })} label="Prix" /></div></label>
              {draft.returnable && <label className="text-xs text-slate-600">Prix si perdu ou abîmé (Ar)<div className="mt-1"><Price canEdit value={draft.replacementPrice} onChange={(v) => setDraft({ ...draft, replacementPrice: v })} label="Prix si perdu" /></div></label>}
              <select value={draft.state} onChange={(e) => setDraft({ ...draft, state: e.target.value })} className={inputCls} aria-label="État des exemplaires">{CONDITIONS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select>
              <input type="number" min={1} value={draft.qty} onChange={(e) => setDraft({ ...draft, qty: Math.max(1, Number(e.target.value) || 1) })} className={inputCls} aria-label="Nombre d'exemplaires" />
              <Button className="sm:col-span-2" disabled={!draftOk} onClick={() => {
                setManuals([...manuals, {
                  id: `m${Date.now()}`, title: draft.title.trim(), subject: draft.subject.trim() || '—', levels: [draft.level], category: draft.category, returnable: draft.returnable,
                  kind: draft.kind, binding: draft.binding, price: draft.price, editor: draft.editor.trim(), programYear: Number(draft.programYear) || null, replacementPrice: draft.returnable ? draft.replacementPrice : null,
                  ...(draft.specialty ? { specialty: draft.specialty } : {}), stock: { NEUF: 0, BON: 0, USE: 0, DECHIRE: 0, [draft.state]: draft.qty },
                }]);
                setDraft({ ...draft, title: '', subject: '', qty: 1 });
              }}>Ajouter</Button>
            </div>
          ) : <p className="text-sm text-slate-500">Le secrétariat enregistre les entrées, réparations et réformes ; la Direction crée les titres et fixe les prix.</p>}
        </Card>
      </div>
    </div>
  );
}

/* ---------- Prêts par titre : sortie, retour, perte ---------- */
function LoansTab({ manuals, setManuals, loans, setLoans, specialtiesOf }) {
  const [cls, setCls] = useState('1re STMG');
  const forClass = manuals.filter((m) => m.levels.includes(cls));
  const [manualId, setManualId] = useState(forClass[0]?.id ?? '');
  const [state, setState] = useState('BON');
  const [returning, setReturning] = useState({});
  const [error, setError] = useState('');
  const manual = manuals.find((m) => m.id === manualId);
  const students = (CLASSES[cls] ?? []).filter((s) => manual && eligible(manual, specialtiesOf(s)));
  const firstAvailable = (m) => CONDITIONS.find((c) => c.id !== 'DECHIRE' && m?.stock[c.id] > 0)?.id ?? 'BON';
  useEffect(() => { setState(firstAvailable(manual)); }, [manualId]); // eslint-disable-line react-hooks/exhaustive-deps
  const loanOf = (s) => [...loans].reverse().find((l) => l.manualId === manualId && l.student === s);

  const doLend = (list) => {
    let m = manual;
    const added = [];
    for (const s of list) {
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
  const without = students.filter((s) => { const l = loanOf(s); return !l || (!l.sold && l.returnedOn); });

  return (
    <Card title="Prêts par titre" subtitle="Sortie avec l'état de l'exemplaire, retour avec son nouvel état ; un cahier gardé est simplement remis">
      <div className="mb-4 grid gap-2 text-sm sm:grid-cols-[180px_1fr_160px_auto] sm:items-end">
        <label className="text-xs text-slate-600">Classe
          <select value={cls} onChange={(e) => { setCls(e.target.value); setManualId(manuals.find((m) => m.levels.includes(e.target.value))?.id ?? ''); setError(''); }} className={`mt-1 w-full ${inputCls}`}>
            {Object.keys(CLASSES).map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
        <label className="text-xs text-slate-600">Titre
          <select value={manualId} onChange={(e) => { setManualId(e.target.value); setError(''); }} className={`mt-1 w-full ${inputCls}`}>
            {forClass.length === 0 && <option value="">Aucun titre pour cette classe</option>}
            {forClass.map((m) => <option key={m.id} value={m.id}>{m.title} ({kindLabel(m).toLowerCase()})</option>)}
          </select>
        </label>
        <label className="text-xs text-slate-600">État à la sortie
          <select value={state} onChange={(e) => setState(e.target.value)} className={`mt-1 w-full ${inputCls}`}>
            {CONDITIONS.filter((c) => c.id !== 'DECHIRE').map((c) => <option key={c.id} value={c.id}>{c.label} ({manual?.stock[c.id] ?? 0} en stock)</option>)}
          </select>
        </label>
        <Button disabled={!manual || without.length === 0} onClick={() => doLend(without)}>{manual?.returnable ? 'Prêter' : 'Remettre'} à ceux qui ne l'ont pas ({without.length})</Button>
      </div>
      {manual?.specialty && <p className="mb-3 text-xs text-slate-500">Spécialité {SPECIALTIES[manual.specialty]} : seuls les élèves qui la suivent sont listés.</p>}
      {error && <p className="mb-3 rounded-lg bg-red-50 p-2 text-sm text-red-800">{error}</p>}
      {manual && (
        <ul className="divide-y divide-slate-100">
          {students.map((s) => {
            const l = loanOf(s);
            const out = l && !l.sold && !l.returnedOn && l.stateIn !== 'PERDU';
            return (
              <li key={s} className="flex flex-wrap items-center gap-3 py-2 text-sm">
                <span className="min-w-0 flex-1 font-medium text-slate-800">{s}</span>
                {!l && <Badge>Pas encore remis</Badge>}
                {l?.sold && <span className="text-xs text-slate-600">Remis le {fmt(l.issuedOn)} · gardé par l'élève</span>}
                {out && <span className="text-xs text-slate-600">Prêté le {fmt(l.issuedOn)} · <Badge tone={TONE[l.stateOut]}>{conditionLabel(l.stateOut)}</Badge>{l.dueBack < YEAR_END ? <> · à rendre le {fmt(l.dueBack)}</> : ''}</span>}
                {l?.returnedOn && <span className="text-xs text-slate-600">Rendu le {fmt(l.returnedOn)} · <Badge tone={TONE[l.stateIn]}>{conditionLabel(l.stateIn)}</Badge>{l.charge ? ' · à régler' : ''}</span>}
                {l?.stateIn === 'PERDU' && <Badge tone="red">Perdu · {l.charge === 'A_REGLER' ? 'à régler' : 'réglé'}</Badge>}
                {(!l || (!l.sold && l.returnedOn)) && <Button variant="secondary" className="!px-2 !py-1 text-xs" onClick={() => doLend([s])}>{manual.returnable ? 'Prêter' : 'Remettre'}</Button>}
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
      {manual?.returnable && <p className="mt-3 text-xs text-slate-500">Perdu, ou rendu déchiré alors qu'il ne l'était pas : à régler à la caisse au prix fixé pour ce titre ({formatAr(manual.replacementPrice ?? 0)}). Le bulletin n'est pas remis tant que ce n'est pas réglé.</p>}
    </Card>
  );
}

/* ---------- À régler et non rendus ---------- */
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
              {loans.filter((l) => l.student === s && l.charge === 'A_REGLER').map((l) => {
                const m = manuals.find((x) => x.id === l.manualId);
                return (
                  <div key={l.id} className="mt-1 flex flex-wrap items-center gap-2">
                    <span className="text-xs text-slate-600">{m?.title} : {formatAr(m?.replacementPrice ?? 0)}</span>
                    <input value={receipt[l.id] ?? ''} onChange={(e) => setReceipt({ ...receipt, [l.id]: e.target.value })} placeholder="N° du reçu (ex. ANX-TMV-00210)" className="rounded-md border border-slate-300 px-2 py-1 text-xs" aria-label={`Reçu — ${s}`} />
                    <Button variant="secondary" className="!px-2 !py-1 text-xs" disabled={!/^ANX-/.test(receipt[l.id] ?? '')} onClick={() => setLoans(loans.map((x) => (x.id === l.id ? { ...x, charge: 'REGLE', chargeReceipt: receipt[l.id] } : x)))}>Marquer réglé</Button>
                  </div>
                );
              })}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs text-slate-500">Le paiement se fait à la caisse comme un article (ticket « Manuel perdu ou endommagé », au prix du titre) ; on reporte ici le n° du reçu.</p>
    </Card>
  );
}

export default function ManualsModule({ role }) {
  const canEdit = role === 'DIRECTION';
  const [tab, setTab] = useState('kit');
  const [data, setData] = useState(loadManuals);
  useEffect(() => saveManuals(data), [data]);
  const setManuals = (manuals) => setData((d) => ({ ...d, manuals }));
  const setLoans = (loans) => setData((d) => ({ ...d, loans }));
  const imported = useMemo(importedSpecialties, []);
  const specialtiesOf = (student) => imported[student] ?? DEMO_SPECIALTIES[student] ?? [];
  const props = { manuals: data.manuals, setManuals, loans: data.loans, setLoans, specialtiesOf, canEdit };
  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-semibold text-navy-500">Secrétariat et Direction · Tamatave</p>
        <h1 className="text-2xl font-semibold text-navy-900">Manuels scolaires</h1>
        <p className="text-sm text-slate-500">Manuels de base en location ({formatAr(RENTAL_PRICE)} l'un), cahiers d'activités à rendre ou gardés. Un manuel dû bloque la remise du bulletin.</p>
      </div>
      <div className="flex gap-1 overflow-x-auto rounded-lg bg-slate-100 p-1" role="tablist">
        {TABS.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
            className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ${tab === id ? 'bg-white text-navy-900 shadow-sm' : 'text-slate-600'}`}>{label}</button>
        ))}
      </div>
      {tab === 'kit' && <KitTab {...props} />}
      {tab === 'stock' && <StockTab {...props} />}
      {tab === 'loans' && <LoansTab {...props} />}
      {tab === 'due' && <DueTab {...props} />}
    </div>
  );
}
