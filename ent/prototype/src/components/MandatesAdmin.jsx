import React, { useState } from 'react';
import { Badge, Button, Card } from './ui.jsx';
import { CLASSES } from '../data/schoollife.js';
import { TERM } from '../data/grades.js';
import { loadEngagements, saveEngagements, loadValidation, saveValidation } from '../engagementsStore.js';
import { ENGAGEMENTS, ATTESTATIONS, engagementErrors } from '../rules/engagements.js';
import { classMandateErrors, MANDATES } from '../rules/mandates.js';

// Engagements et attestations (Direction) : délégués, BDE, éco-délégués, tutorat… et attestations de
// l'établissement. Saisis ici une seule fois, validés à chaque fin de trimestre, puis repris tels quels
// sur les bulletins. Les mandats (délégué, BDE) ouvrent en plus quelques outils à l'élève (rules/mandates.js).

const ALL = [...ENGAGEMENTS, ...ATTESTATIONS];
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

export default function MandatesAdmin({ account }) {
  const [cls, setCls] = useState('1re STMG');
  const [eng, setEng] = useState(loadEngagements);
  const [valid, setValid] = useState(loadValidation);
  const [open, setOpen] = useState(null); // élève dont on modifie les engagements
  const [err, setErr] = useState([]);
  const locked = !!valid[TERM.id];
  const toggle = (student, code) => {
    const cur = eng[student] ?? [];
    const next = { ...eng, [student]: cur.includes(code) ? cur.filter((c) => c !== code) : [...cur, code] };
    const inClass = Object.fromEntries(CLASSES[cls].map((s) => [s, next[s] ?? []]));
    const presidents = Object.values(next).filter((ids) => ids.includes('BDE_PRESIDENT')).length;
    const e = [...classMandateErrors(inClass).filter((x) => !x.includes('président')), ...engagementErrors(inClass).filter((x) => !x.includes('délégué')), ...(presidents > 1 ? ['Un seul président du BDE pour le site.'] : [])];
    setErr([...new Set(e)]); if (e.length) return;
    setEng(next); saveEngagements(next);
  };
  const validate = () => { const v = { ...valid, [TERM.id]: { at: today(), by: account?.name ?? 'Direction' } }; setValid(v); saveValidation(v); };
  const reopen = () => { const v = { ...valid }; delete v[TERM.id]; setValid(v); saveValidation(v); };
  const label = (id) => ALL.find((e) => e.id === id)?.neutral ?? id;

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-semibold text-navy-500">Tamatave · {TERM.label}</p>
        <h1 className="text-2xl font-semibold text-navy-900">Engagements et attestations</h1>
        <p className="text-sm text-slate-600">Saisis ici, validés à chaque fin de trimestre, repris tels quels sur les bulletins.</p>
      </div>

      <div className={`flex flex-wrap items-center gap-3 rounded-2xl px-4 py-3 text-sm ${locked ? 'bg-emerald-50 text-emerald-900' : 'bg-amber-50 text-amber-900'}`}>
        {locked ? <span>Validés pour le {TERM.label} le {valid[TERM.id].at.split('-').reverse().join('/')} ({valid[TERM.id].by}). Les bulletins les reprennent.</span>
          : <span>À valider avant l'impression des bulletins du {TERM.label}.</span>}
        {locked ? <Button variant="secondary" className="ml-auto" onClick={reopen}>Rouvrir pour corriger</Button>
          : <Button className="ml-auto" onClick={validate}>Valider pour le {TERM.label}</Button>}
      </div>

      <Card title="Par classe" action={<select value={cls} onChange={(e) => { setCls(e.target.value); setErr([]); setOpen(null); }} aria-label="Classe" className="rounded-md border border-slate-300 px-2 py-1.5 text-sm">{Object.keys(CLASSES).map((c) => <option key={c}>{c}</option>)}</select>}>
        {err.length > 0 && <p role="alert" className="mb-2 rounded-md bg-red-50 p-2 text-sm text-red-800">{err.join(' ')}</p>}
        <ul className="divide-y divide-slate-100">
          {CLASSES[cls].map((s) => {
            const ids = eng[s] ?? [];
            return (
              <li key={s} className="py-2">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="min-w-[12rem] font-medium text-slate-900">{s}</span>
                  <span className="flex flex-1 flex-wrap gap-1">{ids.length ? ids.map((id) => <Badge key={id} tone={ATTESTATIONS.some((a) => a.id === id) ? 'violet' : 'navy'}>{label(id)}</Badge>) : <span className="text-xs text-slate-600">aucun</span>}</span>
                  {!locked && <Button variant="secondary" className="!py-1 text-xs" aria-expanded={open === s} onClick={() => setOpen(open === s ? null : s)}>{open === s ? 'Fermer' : 'Modifier'}</Button>}
                </div>
                {open === s && !locked && (
                  <div className="mt-2 space-y-2 rounded-lg bg-slate-50 p-2">
                    {[['Engagements', ENGAGEMENTS], ['Attestations de l\'établissement (internes)', ATTESTATIONS]].map(([title, list]) => (
                      <div key={title}>
                        <p className="text-xs font-medium text-slate-600">{title}</p>
                        <div className="mt-1 flex flex-wrap gap-1.5">{list.map((e) => (
                          <button key={e.id} type="button" aria-pressed={ids.includes(e.id)} onClick={() => toggle(s, e.id)}
                            className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ${ids.includes(e.id) ? 'bg-navy-500 text-white ring-navy-500' : 'bg-white text-slate-700 ring-slate-300'}`}>{e.neutral}</button>
                        ))}</div>
                      </div>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-xs text-slate-600">Au plus 2 délégués et 2 suppléants par classe ; un seul président du BDE pour le site.</p>
      </Card>

      <Card title="Ce que donnent les mandats">
        {Object.entries(MANDATES).map(([k, m]) => <p key={k} className="mb-1 text-sm"><strong>{m.label}</strong> : {k === 'DELEGUE' ? 'écrire aux élèves de sa classe, préparer le conseil (remarques au secrétariat).' : 'membres et président(e) : écrire aux élèves du site, proposer des événements. La présidence est un titre sur le bulletin, sans droit de plus.'}</p>)}
        <p className="text-sm text-slate-700">Toujours relu par la CPE puis validé par la Direction ; jamais d'accès aux notes des autres ni aux paramètres.</p>
      </Card>
    </div>
  );
}
