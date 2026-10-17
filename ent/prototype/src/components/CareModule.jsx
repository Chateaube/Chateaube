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
  const canGive = role === 'BUREAU';
  const [visits, setVisits] = useState(loadVisits);
  const [inv, setInv] = useState(loadInventory);
  const blank = { student: '', reason: '', detail: '', paracetamol: false, dose: '1 comprimé 500 mg', outcome: '', at: NOW };
  const [d, setD] = useState(blank);
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
    const v = { ...d, id: `c${Date.now()}`, by: 'Mme Hanta', notice: parentNotice(d, firstNameOf(d.student)) };
    const next = [v, ...visits]; setVisits(next); saveVisits(next);
    if (d.paracetamol && doli) { const nextInv = inv.map((i) => (i.id === doli.id ? consume(i, 1, 'Mme Hanta', d.at, d.student) : i)); setInv(nextInv); saveInventory(nextInv); }
    setMsg(`Passage enregistré ; les parents de ${d.student} sont prévenus dans l'application.`);
    setD(blank); setTried(false);
  };

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-semibold text-navy-500">Tamatave</p>
        <h1 className="text-2xl font-semibold text-navy-900">Soins</h1>
        <p className="text-sm text-slate-500">Passages au secrétariat. Pas d'infirmerie : seul le Doliprane est donné, par le secrétariat (règlement intérieur).</p>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Passages ce mois-ci" value={visits.filter((v) => v.at.startsWith(month)).length} />
        <Stat label="Doliprane donnés ce mois-ci" value={visits.filter((v) => v.at.startsWith(month) && v.paracetamol).length} />
        <Stat label="Doliprane en stock" value={doli ? usable(doli) : 0} tone={doli && usable(doli) <= doli.min ? 'amber' : 'slate'} hint={doli ? `seuil ${doli.min}` : ''} />
        <Stat label={`Élèves passés ${FREQUENT_VISITS} fois ou plus`} value={frequent.length} tone={frequent.length ? 'amber' : 'slate'} />
      </div>
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
                  <span className="block text-xs text-slate-500">{fmtDT(v.at)} · {v.reason === 'Autre' ? v.detail : v.reason}{v.detail && v.reason !== 'Autre' ? ` (${v.detail})` : ''} · {CARE_OUTCOMES[v.outcome]} · {v.by}</span></span>
                {v.paracetamol ? <Badge tone="navy">Doliprane · {v.dose}</Badge> : <Badge>sans médicament</Badge>}
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
              <label className="flex items-center gap-2 text-xs text-slate-700"><input type="checkbox" checked={d.paracetamol} disabled={allergicToParacetamol(allergies)} onChange={(e) => setD({ ...d, paracetamol: e.target.checked })} />Doliprane donné</label>
              {d.paracetamol && <label className="block text-xs text-slate-600">Dose<input value={d.dose} onChange={(e) => setD({ ...d, dose: e.target.value })} className={`mt-1 w-full ${inputCls}`} /></label>}
              <label className="block text-xs text-slate-600">Suite
                <select value={d.outcome} onChange={(e) => setD({ ...d, outcome: e.target.value })} className={`mt-1 w-full ${inputCls}`}><option value="">Choisir…</option>{Object.entries(CARE_OUTCOMES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
              </label>
              {d.outcome === 'SORTIE' && <p className="text-[11px] text-slate-500">Enregistrez aussi la sortie dans Vie scolaire → Sorties anticipées (un mineur ne part qu'avec un adulte).</p>}
              {d.student && d.reason && d.outcome && <p className="rounded-md bg-navy-50 p-2 text-xs text-navy-900">Message aux parents : {parentNotice(d, firstNameOf(d.student))}</p>}
              {tried && errors.length > 0 && <ul className="rounded-md bg-red-50 p-2 text-xs text-red-800">{errors.map((e) => <li key={e}>· {e}</li>)}</ul>}
              <Button className="w-full" onClick={save}>Enregistrer le passage</Button>
            </div>
          </Card>
        ) : <Card title="Enregistrer un passage"><p className="text-sm text-slate-500">C'est le secrétariat qui garde la trousse de secours et le Doliprane, et qui enregistre les passages.</p></Card>}
      </div>
    </div>
  );
}
