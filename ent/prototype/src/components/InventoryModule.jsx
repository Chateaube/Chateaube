import React, { useState } from 'react';
import { Badge, Button, Card, Icon, Stat } from './ui.jsx';
import { DocumentInput, DocumentThumb } from './PhotoInput.jsx';
import { loadInventory, saveInventory } from '../careStore.js';
import { CATEGORIES, inventoryAlerts, reportBroken, resolveBroken, addPurchase, usable } from '../rules/inventory.js';
import { buildXlsx } from '../xlsx.js';
import { saveFile } from '../download.js';
import { printOnly } from '../print.js';
import { loadManuals } from '../manualsStore.js';
import { manualBalance } from '../rules/manuals.js';
import { CLASSES } from '../data/schoollife.js';
import { DEMO_SPECIALTIES } from '../data/manuals.js';
import { loadImport } from '../importStore.js';

/** Élèves par classe avec leurs spécialités : import de l'année s'il existe, sinon la démonstration. */
function roster() {
  const imp = loadImport()?.students;
  if (imp?.length) return imp.map((s) => ({ cls: s.cls, specialties: s.specialties ?? [] }));
  return Object.entries(CLASSES).flatMap(([cls, list]) => list.map((n) => ({ cls, specialties: DEMO_SPECIALTIES[n] ?? [] })));
}
const effectifOf = (m, students) => {
  const inLevels = students.filter((s) => m.levels.includes(s.cls));
  if (!inLevels.length) return null; // classe absente de l'effectif connu
  return m.specialty ? inLevels.filter((s) => s.specialties.includes(m.specialty)).length : inLevels.length;
};

function ManualsBalance() {
  const [onlyMissing, setOnlyMissing] = useState(false);
  const { manuals, loans } = loadManuals();
  const students = roster();
  const rows = manuals.map((m) => manualBalance(m, loans, effectifOf(m, students)));
  const list = onlyMissing ? rows.filter((r) => r.missing > 0 || r.damaged > 0 || r.lost > 0) : rows;
  const exportXlsx = () => {
    const head = ['Titre', 'Niveaux', 'Effectif', 'Exemplaires', 'En prêt / vendus', 'En état au stock', 'Abîmés', 'Perdus', 'À commander'];
    const out = [[{ v: 'Manuels — bilan et commande', s: 'title' }], [], head.map((v) => ({ v, s: 'head' }))];
    rows.forEach((r) => out.push([r.title, r.levels.join(', '), r.effectif ?? '', r.total, r.returnable ? r.lent : r.sold, r.goodInStock, r.damaged, r.lost, { v: r.missing ?? '', s: r.missing > 0 ? 'red' : 'cell' }].map((v) => (typeof v === 'object' && v ? v : { v, s: 'cell' }))));
    saveFile('manuels-bilan.xlsx', buildXlsx([{ name: 'Manuels', rows: out, widths: [40, 26, 10, 12, 14, 14, 10, 10, 12], freeze: { row: 3, col: 1 } }]));
  };
  const toOrder = rows.reduce((s, r) => s + (r.missing ?? 0), 0);
  return (
    <Card title="Manuels" subtitle="Bilan comparé à l'effectif. Les prêts et les retours se font dans « Manuels scolaires »."
      action={<Button variant="secondary" onClick={exportXlsx}>Exporter (Excel)</Button>}>
      <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
        <span className="rounded-md bg-amber-50 px-2 py-1 text-amber-900">{toOrder} exemplaire{toOrder > 1 ? 's' : ''} à commander</span>
        <span className="text-slate-600">{rows.reduce((s, r) => s + r.damaged, 0)} abîmés au stock · {rows.reduce((s, r) => s + r.lost, 0)} perdus cette année</span>
        <label className="ml-auto flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" checked={onlyMissing} onChange={(e) => setOnlyMissing(e.target.checked)} />Seulement ce qui manque, abîmé ou perdu</label>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead><tr className="border-b border-slate-200 text-left text-xs text-slate-500"><th className="py-2 pr-2">Titre</th><th className="px-2">Niveaux</th><th className="px-2 text-right">Effectif</th><th className="px-2 text-right">Exemplaires</th><th className="px-2 text-right">En prêt</th><th className="px-2 text-right">En état au stock</th><th className="px-2 text-right">Abîmés</th><th className="px-2 text-right">Perdus</th><th className="px-2 text-right">À commander</th></tr></thead>
          <tbody>{list.map((r) => (
            <tr key={r.id} className="border-b border-slate-100">
              <td className="py-1.5 pr-2 text-slate-900">{r.title}{!r.returnable && <Badge className="ml-2">cahier gardé</Badge>}</td>
              <td className="px-2 text-xs text-slate-500">{r.levels.join(', ')}</td>
              <td className="px-2 text-right tabular-nums">{r.effectif ?? <span className="text-slate-400" title="Classe absente de l'effectif importé">—</span>}</td>
              <td className="px-2 text-right tabular-nums">{r.total}</td>
              <td className="px-2 text-right tabular-nums">{r.returnable ? r.lent : `${r.sold} vendus`}</td>
              <td className="px-2 text-right tabular-nums">{r.goodInStock}</td>
              <td className={`px-2 text-right tabular-nums ${r.damaged ? 'text-amber-700' : 'text-slate-400'}`}>{r.damaged}</td>
              <td className={`px-2 text-right tabular-nums ${r.lost ? 'text-red-700' : 'text-slate-400'}`}>{r.lost}</td>
              <td className={`px-2 text-right font-semibold tabular-nums ${r.missing ? 'text-red-700' : 'text-emerald-700'}`}>{r.missing ?? '—'}</td>
            </tr>))}</tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-slate-500">Effectif : élèves de l'année importés (sinon ceux de la démonstration) ; pour une spécialité, seuls les élèves qui la suivent. Un manuel abîmé ou perdu n'est plus compté comme disponible.</p>
    </Card>
  );
}

// Inventaire : mobilier (tables simples ou doubles, chaises, bureaux…), équipement (dont le matériel
// prêté aux professeurs, qui se réserve dans « Réservations ») et trousse de secours.
// Casse signalée, réparée ou jetée ; factures en photo ; ce qui est à recommander.

const inputCls = 'rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm';
const TODAY = '2026-10-13';
const BY = { DIRECTION: 'Direction', BUREAU: 'Mme Hanta', VIE_SCOLAIRE: 'M. Be' };

export default function InventoryModule({ role = 'BUREAU' }) {
  const manage = role !== 'VIE_SCOLAIRE'; // la CPE signale la casse ; achats et factures : secrétariat et Direction
  const [items, setItems] = useState(loadInventory);
  const [cat, setCat] = useState('Mobilier');
  const TABS = [...CATEGORIES, 'Manuels'];
  const [open, setOpen] = useState(null); // { id, mode: CASSE | ACHAT | REGLER }
  const [f, setF] = useState({});
  const [err, setErr] = useState('');
  const [newItem, setNewItem] = useState(null);
  const alerts = inventoryAlerts(items, TODAY);
  const update = (next) => { setItems(next); saveInventory(next); };
  const at = new Date().toISOString();

  const apply = (it) => {
    try {
      let n;
      if (open.mode === 'CASSE') n = reportBroken(it, Number(f.n), f.note, BY[role], at);
      if (open.mode === 'REGLER') n = resolveBroken(it, Number(f.n), f.how ?? 'REPARE', BY[role], at);
      if (open.mode === 'ACHAT') n = addPurchase(it, { n: Number(f.n), supplier: f.supplier, price: Number(f.price) || null, invoice: f.invoice, expires: f.expires }, BY[role], at);
      update(items.map((x) => (x.id === it.id ? n : x))); setOpen(null); setF({}); setErr('');
    } catch (e) { setErr(e.message); }
  };
  const addItem = () => {
    if (!newItem.name?.trim() || !(Number(newItem.qty) >= 0)) { setErr('Nom et quantité.'); return; }
    update([...items, { id: `i${Date.now()}`, cat, name: newItem.name.trim(), qty: Number(newItem.qty), broken: 0, place: newItem.place ?? '', min: newItem.min === '' || newItem.min == null ? null : Number(newItem.min), expires: newItem.expires || undefined }]);
    setNewItem(null); setErr('');
  };
  const exportXlsx = () => {
    const rows = [[{ v: 'Inventaire — Tamatave', s: 'title' }], [], ['Catégorie', 'Article', 'Lieu', 'Quantité', 'Cassés', 'En état', 'Seuil', 'Péremption'].map((v) => ({ v, s: 'head' }))];
    items.forEach((i) => rows.push([i.cat, i.name, i.place, i.qty, i.broken ?? 0, { v: usable(i), s: i.min != null && usable(i) <= i.min ? 'red' : 'cell' }, i.min ?? '', i.expires ? i.expires.split('-').reverse().join('/') : ''].map((v) => (typeof v === 'object' && v ? v : { v, s: 'cell' }))));
    saveFile('inventaire.xlsx', buildXlsx([{ name: 'Inventaire', rows, widths: [18, 34, 20, 10, 10, 10, 8, 12], freeze: { row: 3, col: 0 } }]));
  };
  const list = items.filter((i) => i.cat === cat);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-navy-500">Tamatave</p>
          <h1 className="text-2xl font-semibold text-navy-900">Inventaire du matériel</h1>
          <p className="text-sm text-slate-500">Mobilier, équipement, fournitures, trousse de secours et bilan des manuels : ce qui est cassé, les factures, ce qu'il faut recommander.</p>
        </div>
        <div className="flex gap-2"><Button variant="secondary" onClick={exportXlsx}>Exporter (Excel)</Button><Button variant="secondary" onClick={() => printOnly('.inventory-print', 'size: A4 portrait;', 'Inventaire')}>Imprimer</Button></div>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {CATEGORIES.filter((c) => c !== 'Trousse de secours').map((c) => <Stat key={c} label={c} value={items.filter((i) => i.cat === c).reduce((s, i) => s + i.qty, 0)} hint={`${items.filter((i) => i.cat === c).length} articles`} />)}
        <Stat label="Cassés" value={items.reduce((s, i) => s + (i.broken ?? 0), 0)} tone="amber" />
      </div>
      {alerts.length > 0 && (
        <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-semibold">À faire</p>
          {alerts.map((a) => <p key={`${a.id}${a.kind}`}>· {a.text}</p>)}
        </div>
      )}
      <div className="flex gap-1 overflow-x-auto rounded-lg bg-slate-100 p-1" role="tablist">
        {TABS.map((c) => <button key={c} type="button" role="tab" aria-selected={cat === c} onClick={() => { setCat(c); setOpen(null); }} className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ${cat === c ? 'bg-white text-navy-900 shadow-sm' : 'text-slate-600'}`}>{c}</button>)}
      </div>
      {cat === 'Manuels' ? <ManualsBalance /> : <Card title={cat} subtitle={cat === 'Équipement' ? 'Le matériel marqué « réservable » se réserve dans Réservations' : cat === 'Trousse de secours' ? 'Gardée au secrétariat ; chaque Doliprane donné est retiré du stock' : cat === 'Fournitures' ? 'Consommables : papier, marqueurs, encre, craies… à recommander sous le seuil' : 'Tables simples ou doubles, chaises, bureaux…'}
        action={manage && <Button variant="secondary" onClick={() => setNewItem({ name: '', qty: '', place: '', min: '' })}>Ajouter un article</Button>}>
        {newItem && (
          <div className="mb-3 grid gap-2 rounded-lg bg-slate-50 p-3 sm:grid-cols-5">
            <input placeholder="Article" value={newItem.name} onChange={(e) => setNewItem({ ...newItem, name: e.target.value })} className={`${inputCls} sm:col-span-2`} />
            <input placeholder="Quantité" inputMode="numeric" value={newItem.qty} onChange={(e) => setNewItem({ ...newItem, qty: e.target.value })} className={inputCls} />
            <input placeholder="Lieu" value={newItem.place} onChange={(e) => setNewItem({ ...newItem, place: e.target.value })} className={inputCls} />
            <input placeholder="Seuil (facultatif)" inputMode="numeric" value={newItem.min} onChange={(e) => setNewItem({ ...newItem, min: e.target.value })} className={inputCls} />
            {cat === 'Trousse de secours' && <label className="text-xs text-slate-600 sm:col-span-2">Péremption<input type="date" value={newItem.expires ?? ''} onChange={(e) => setNewItem({ ...newItem, expires: e.target.value })} className={`ml-2 ${inputCls}`} /></label>}
            <div className="flex gap-2 sm:col-span-5"><Button onClick={addItem}>Ajouter</Button><Button variant="secondary" onClick={() => setNewItem(null)}>Annuler</Button></div>
          </div>
        )}
        {err && <p className="mb-2 rounded-md bg-red-50 p-2 text-xs text-red-800">{err}</p>}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead><tr className="border-b border-slate-200 text-left text-xs text-slate-500"><th className="py-2 pr-2">Article</th><th className="px-2">Lieu</th><th className="px-2 text-right">Quantité</th><th className="px-2 text-right">Cassés</th><th className="px-2 text-right">En état</th><th className="px-2">Factures</th><th /></tr></thead>
            <tbody>
              {list.map((it) => (
                <React.Fragment key={it.id}>
                  <tr className="border-b border-slate-100 align-top">
                    <td className="py-2 pr-2 font-medium text-slate-900">{it.name}{it.bookable && <Badge className="ml-2">réservable</Badge>}{it.expires && <span className="block text-xs font-normal text-slate-500">périme le {it.expires.split('-').reverse().join('/')}</span>}</td>
                    <td className="px-2 text-slate-600">{it.place}</td>
                    <td className="px-2 text-right tabular-nums">{it.qty}</td>
                    <td className={`px-2 text-right tabular-nums ${it.broken ? 'text-red-700' : 'text-slate-400'}`}>{it.broken ?? 0}</td>
                    <td className={`px-2 text-right font-semibold tabular-nums ${it.min != null && usable(it) <= it.min ? 'text-amber-700' : ''}`}>{usable(it)}</td>
                    <td className="px-2"><div className="flex flex-wrap gap-1">{(it.invoices ?? []).filter((v) => v.invoice).map((v, i) => <DocumentThumb key={i} doc={v.invoice} title={`Facture ${v.supplier ?? ''}`} />)}{!(it.invoices ?? []).length && <span className="text-xs text-slate-400">—</span>}</div></td>
                    <td className="whitespace-nowrap py-2 pl-2 text-right">
                      <button type="button" onClick={() => { setOpen({ id: it.id, mode: 'CASSE' }); setF({ n: 1 }); setErr(''); }} className="text-xs font-medium text-red-700">Signaler une casse</button>
                      {manage && it.broken > 0 && <button type="button" onClick={() => { setOpen({ id: it.id, mode: 'REGLER' }); setF({ n: 1, how: 'REPARE' }); setErr(''); }} className="ml-3 text-xs font-medium text-navy-700">Réparé / jeté</button>}
                      {manage && <button type="button" onClick={() => { setOpen({ id: it.id, mode: 'ACHAT' }); setF({ n: 1 }); setErr(''); }} className="ml-3 text-xs font-medium text-navy-700">Achat</button>}
                    </td>
                  </tr>
                  {open?.id === it.id && (
                    <tr className="bg-slate-50"><td colSpan={7} className="p-3">
                      <div className="flex flex-wrap items-end gap-2 text-xs text-slate-600">
                        <label>Quantité<input inputMode="numeric" value={f.n ?? ''} onChange={(e) => setF({ ...f, n: e.target.value })} className={`ml-1 w-16 ${inputCls}`} /></label>
                        {open.mode === 'CASSE' && <label className="flex-1">Ce qui est cassé<input value={f.note ?? ''} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="ex. pied de table cassé, salle 1re" className={`ml-1 w-full min-w-[200px] ${inputCls}`} /></label>}
                        {open.mode === 'REGLER' && <select value={f.how} onChange={(e) => setF({ ...f, how: e.target.value })} className={inputCls}><option value="REPARE">Réparé</option><option value="JETE">Jeté (sort de l'inventaire)</option></select>}
                        {open.mode === 'ACHAT' && <>
                          <label>Fournisseur<input value={f.supplier ?? ''} onChange={(e) => setF({ ...f, supplier: e.target.value })} className={`ml-1 ${inputCls}`} /></label>
                          <label>Montant (Ar)<input inputMode="numeric" value={f.price ?? ''} onChange={(e) => setF({ ...f, price: e.target.value })} className={`ml-1 w-28 ${inputCls}`} /></label>
                          {it.cat === 'Trousse de secours' && <label>Péremption<input type="date" value={f.expires ?? ''} onChange={(e) => setF({ ...f, expires: e.target.value })} className={`ml-1 ${inputCls}`} /></label>}
                          {f.invoice ? <span className="flex items-center gap-1"><DocumentThumb doc={f.invoice} title="Facture" />facture jointe</span> : <DocumentInput label="Facture (photo ou PDF)" onAdd={(invoice) => setF({ ...f, invoice })} />}
                        </>}
                        <Button onClick={() => apply(it)}>Enregistrer</Button><Button variant="secondary" onClick={() => setOpen(null)}>Annuler</Button>
                      </div>
                      {open.mode === 'ACHAT' && <p className="mt-1 text-[11px] text-slate-500">La dépense elle-même s'enregistre dans Comptabilité → Dépenses & fournisseurs.</p>}
                    </td></tr>
                  )}
                  {(it.log ?? []).filter((l) => l.kind === 'CASSE').slice(-2).map((l, i) => <tr key={`l${i}`}><td colSpan={7} className="pb-1 pl-4 text-[11px] text-slate-500">Casse signalée par {l.by} : {l.n} · {l.note}</td></tr>)}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </Card>}
      <div className="inventory-print hidden print:block">
        <h1 className="mb-2 text-lg font-semibold">Inventaire du matériel — Tamatave</h1>
        <table className="w-full text-xs"><thead><tr className="border-b text-left"><th>Catégorie</th><th>Article</th><th>Lieu</th><th className="text-right">Qté</th><th className="text-right">Cassés</th><th className="text-right">En état</th></tr></thead>
          <tbody>{items.map((i) => <tr key={i.id} className="border-b"><td>{i.cat}</td><td>{i.name}</td><td>{i.place}</td><td className="text-right">{i.qty}</td><td className="text-right">{i.broken ?? 0}</td><td className="text-right">{usable(i)}</td></tr>)}</tbody></table>
      </div>
    </div>
  );
}
