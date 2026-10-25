import React, { useState } from 'react';
import { Badge, Button, Card, Icon, Stat } from './ui.jsx';
import { ClassStudentPicker } from './VieScolaireModule.jsx';
import { classOf } from '../data/schoollife.js';
import { loadProfiles, profileKey } from '../profilesStore.js';
import { ficheOf } from '../ficheStore.js';
import { loadVisits, saveVisits, loadInventory, saveInventory } from '../careStore.js';
import { CARE_REASONS, CARE_OUTCOMES, careErrors, frequentVisitors, parentNotice, allergicToParacetamol, FREQUENT_VISITS } from '../rules/care.js';
import { consume, usable } from '../rules/inventory.js';
import { formatDateFr } from '../rules/calendar.js';

// Soins : registre des passages au secrétariat (mal de tête, blessure…). Pas d'infirmerie :
// le seul médicament donné est le Doliprane, par le secrétariat, comme le dit le règlement intérieur.
// Chaque passage est signalé aux parents dans l'application ; un élève qui passe souvent est signalé.

const inputCls = 'rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm';
const NOW = '2026-10-13T11:00';
const fmtDT = (dt) => `${formatDateFr(dt.slice(0, 10)).replace(/ \d{4}$/, '')} à ${dt.slice(11, 16).replace(':', 'h')}`;

/** Allergies connues : fiche signalétique signée, sinon fiche élève. */
export function allergiesOf(student) {
  const f = ficheOf(student);
  if (f?.allergies) return f.allergies;
  return loadProfiles().find((p) => profileKey(p) === student)?.health?.allergies ?? '';
}
const firstNameOf = (student) => loadProfiles().find((p) => profileKey(p) === student)?.firstName ?? student.split(' ').slice(1).join(' ');

export default function CareModule({ role = 'BUREAU' }) {
  // l'élève souffrant est accueilli par la vie scolaire ou par le secrétariat (les deux) ; le Doliprane,
  // rangé dans la trousse du secrétariat, n'est donné que par le secrétariat ou la Direction
  const canGive = ['BUREAU', 'DIRECTION', 'VIE_SCOLAIRE'].includes(role);
  const canMedicate = ['BUREAU', 'DIRECTION'].includes(role);
  const [visits, setVisits] = useState(loadVisits);
  const [inv, setInv] = useState(loadInventory);
  const blank = { student: '', reason: '', detail: '', paracetamol: false, dose: '1 comprimé 500 mg', outcome: '', at: NOW, products: {} };
  const who = role === 'DIRECTION' ? 'Direction' : role === 'VIE_SCOLAIRE' ? 'M. Be (CPE)' : 'Mme Hanta';
  const kit = inv.filter((i) => i.cat === 'Trousse de secours' && !i.paracetamol);
  const [d, setD] = useState(blank);
  const [pending, setPending] = useState(null); // élève envoyé par la CPE, dont on complète le passage
  const today = NOW.slice(0, 10);
  const here = visits.filter((v) => v.at.startsWith(today) && (!v.outcome || v.outcome === 'REPOS'));
  const backToClass = (v) => { const next = visits.map((x) => (x.id === v.id ? { ...x, outcome: 'CLASSE', backAt: new Date().toTimeString().slice(0, 5) } : x)); setVisits(next); saveVisits(next); setMsg(`${v.student} est reparti·e en classe.`); };
  const [tried, setTried] = useState(false);
  const [msg, setMsg] = useState('');
  const doli = inv.find((i) => i.paracetamol);
  const allergies = d.student ? allergiesOf(d.student) : '';
  const errors = careErrors(d, { visits, allergies, stock: doli ? usable(doli) : 0 });
  const month = NOW.slice(0, 7);
  const frequent = frequentVisitors(visits, month);

  const save = () => {
    setTried(true);
    if (errors.length) return;
    const used = Object.entries(d.products ?? {}).filter(([, n]) => n > 0);
    for (const [id, n] of used) { const it = inv.find((i) => i.id === id); if (n > usable(it)) { setMsg(`Plus assez de « ${it.name} » dans la trousse (${usable(it)} restant).`); return; } }
    const v = { ...d, id: `c${Date.now()}`, by: who, products: used.map(([id, n]) => ({ name: inv.find((i) => i.id === id).name, n })), notice: parentNotice(d, firstNameOf(d.student)) };
    const next = [v, ...visits.filter((x) => x.id !== pending)]; setVisits(next); saveVisits(next); setPending(null);
    const note = `${d.student} (${d.reason === 'Autre' ? d.detail : d.reason.toLowerCase()})`;
    const nextInv = inv.map((i) => {
      if (d.paracetamol && doli && i.id === doli.id) return consume(i, 1, who, d.at, note);
      const n = d.products?.[i.id]; return n > 0 ? consume(i, n, who, d.at, note) : i;
    });
    setInv(nextInv); saveInventory(nextInv);
    setMsg(`Passage enregistré ; les parents de ${d.student} sont prévenus dans l'application.`);
    setD(blank); setTried(false);
  };

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-semibold text-navy-500">Tamatave</p>
        <h1 className="text-2xl font-semibold text-navy-900">Soins (secrétariat)</h1>
        <p className="text-sm text-slate-600">Élèves souffrants, accueillis par la vie scolaire ou le secrétariat. Pas d'infirmerie : seul le Doliprane est donné, par le secrétariat.</p>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Passages ce mois-ci" value={visits.filter((v) => v.at.startsWith(month)).length} />
        <Stat label="Doliprane donnés ce mois-ci" value={visits.filter((v) => v.at.startsWith(month) && v.paracetamol).length} />
        <Stat label="Doliprane en stock" value={doli ? usable(doli) : 0} tone={doli && usable(doli) <= doli.min ? 'amber' : 'slate'} hint={doli ? `seuil ${doli.min}` : ''} />
        <Stat label={`Élèves passés ${FREQUENT_VISITS} fois ou plus`} value={frequent.length} tone={frequent.length ? 'amber' : 'slate'} />
      </div>
      {here.length > 0 && (
        <section aria-label="Au secrétariat maintenant" className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-3">
          <p className="mb-2 text-sm font-semibold text-amber-900">Au secrétariat maintenant ({here.length})</p>
          <ul className="space-y-2">
            {here.map((v) => (
              <li key={v.id} className="flex flex-col gap-2 rounded-xl bg-white p-2.5 text-sm sm:flex-row sm:items-center sm:justify-between">
                <span><strong>{v.student}</strong> · depuis {v.at.slice(11, 16).replace(':', 'h')} · {v.reason}{v.sentBy ? ` · envoyé·e par ${v.sentBy}` : ''}{v.outcome === 'REPOS' ? ' · au repos' : ''}</span>
                <span className="flex gap-2">
                  {!v.outcome && canGive && <Button variant="secondary" className="!py-1 text-xs" onClick={() => { setPending(v.id); setD({ ...blank, student: v.student, reason: CARE_REASONS.includes(v.reason) ? v.reason : 'Autre', at: v.at }); }}>Noter les soins</Button>}
                  <Button className="!py-1 text-xs" onClick={() => backToClass(v)}>Retour en classe</Button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {msg && <p role="status" className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800"><Icon name="check" />{msg}</p>}
      {frequent.length > 0 && (
        <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-semibold">Passages fréquents ce mois-ci</p>
          {frequent.map((f) => <p key={f.student}>{f.student} ({classOf(f.student) ?? '—'}) : {f.count} passages — à voir avec la famille.</p>)}
        </div>
      )}
      <div className="grid gap-5 xl:grid-cols-[1fr_400px] xl:items-start">
        <Card title="Registre des passages" subtitle="Chaque passage est signalé aux parents, pour qu'ils prennent des nouvelles le soir">
          <ul className="divide-y divide-slate-100 text-sm">
            {visits.map((v) => (
              <li key={v.id} className="flex flex-wrap items-start justify-between gap-2 py-2">
                <span className="min-w-0"><span className="font-medium text-slate-900">{v.student}</span> <span className="text-slate-500">· {classOf(v.student) ?? ''}</span>
                  <span className="block text-xs text-slate-500">{fmtDT(v.at)} · {v.reason === 'Autre' ? v.detail : v.reason}{v.detail && v.reason !== 'Autre' ? ` (${v.detail})` : ''} · {CARE_OUTCOMES[v.outcome] ?? 'en cours'} · {v.by}</span></span>
                <span className="flex flex-wrap justify-end gap-1">{v.paracetamol ? <Badge tone="navy">Doliprane · {v.dose}</Badge> : <Badge>sans médicament</Badge>}{(v.products ?? []).map((x) => <Badge key={x.name} tone="slate">{x.n} × {x.name}</Badge>)}</span>
              </li>
            ))}
          </ul>
        </Card>
        {canGive ? (
          <Card title="Enregistrer un passage">
            <div className="space-y-2 text-sm">
              <ClassStudentPicker value={d.student} onChange={(student) => setD({ ...d, student, paracetamol: false })} />
              {d.student && <p className={`rounded-md px-2 py-1.5 text-xs ${allergies && !/^aucune$/i.test(allergies.trim()) ? 'bg-amber-50 text-amber-900' : 'bg-slate-50 text-slate-600'}`}>Allergies (fiche signalétique) : {allergies || 'non renseignées'}</p>}
              <label className="block text-xs text-slate-600">Motif
                <select value={d.reason} onChange={(e) => setD({ ...d, reason: e.target.value })} className={`mt-1 w-full ${inputCls}`}><option value="">Choisir…</option>{CARE_REASONS.map((r) => <option key={r}>{r}</option>)}</select>
              </label>
              <label className="block text-xs text-slate-600">{d.reason === 'Autre' ? 'Préciser' : 'Précision (facultatif)'}<input value={d.detail} onChange={(e) => setD({ ...d, detail: e.target.value })} className={`mt-1 w-full ${inputCls}`} /></label>
              <label className="flex items-center gap-2 text-xs text-slate-700"><input type="checkbox" checked={d.paracetamol} disabled={!canMedicate || allergicToParacetamol(allergies)} onChange={(e) => setD({ ...d, paracetamol: e.target.checked })} />Doliprane donné</label>
              {kit.length > 0 && (
                <fieldset className="rounded-md bg-slate-50 p-2 text-xs text-slate-700">
                  <legend className="px-1 font-medium">Utilisé dans la trousse (déduit du stock)</legend>
                  <div className="grid grid-cols-2 gap-1">{kit.map((i) => (
                    <label key={i.id} className="flex items-center gap-1.5"><input type="number" min={0} max={usable(i)} value={d.products?.[i.id] ?? 0} onChange={(e) => setD({ ...d, products: { ...d.products, [i.id]: Math.max(0, Number(e.target.value) || 0) } })} aria-label={`${i.name} utilisé`} className="w-12 rounded border border-slate-300 px-1 py-0.5 text-right" />{i.name} <span className="text-slate-500">({usable(i)})</span></label>
                  ))}</div>
                </fieldset>
              )}
              {d.paracetamol && <label className="block text-xs text-slate-600">Dose<input value={d.dose} onChange={(e) => setD({ ...d, dose: e.target.value })} className={`mt-1 w-full ${inputCls}`} /></label>}
              <label className="block text-xs text-slate-600">Suite
                <select value={d.outcome} onChange={(e) => setD({ ...d, outcome: e.target.value })} className={`mt-1 w-full ${inputCls}`}><option value="">Choisir…</option>{Object.entries(CARE_OUTCOMES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
              </label>
              {d.outcome === 'SORTIE' && <p className="text-[11px] text-slate-500">Enregistrez aussi la sortie dans Vie scolaire → Sorties anticipées (un mineur ne part qu'avec un adulte).</p>}
              {d.student && d.reason && d.outcome && <p className="rounded-md bg-navy-50 p-2 text-xs text-navy-900">Message aux parents : {parentNotice(d, firstNameOf(d.student))}</p>}
              {tried && errors.length > 0 && <ul className="rounded-md bg-red-50 p-2 text-xs text-red-800">{errors.map((e) => <li key={e}>· {e}</li>)}</ul>}
              <Button className="w-full" onClick={save}>Enregistrer et prévenir les parents</Button>
            </div>
          </Card>
        ) : <Card title="Enregistrer un passage"><p className="text-sm text-slate-500">C'est le secrétariat qui garde la trousse de secours et le Doliprane, et qui enregistre les passages. Ce qui a été utilisé se voit dans Inventaire → Trousse de secours.</p></Card>}
      </div>
    </div>
  );
}
