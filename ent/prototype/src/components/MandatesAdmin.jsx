import React, { useState } from 'react';
import { Card, Badge } from './ui.jsx';
import { CLASSES } from '../data/schoollife.js';
import { loadEngagements, saveEngagements } from '../engagementsStore.js';
import { classMandateErrors, MANDATES, NEVER } from '../rules/mandates.js';

// Délégués et BDE (Direction seule) : qui détient un mandat cette année. Les remarques des délégués pour le
// conseil sont lues par le secrétariat (Conseils de classe). Un mandat ajoute à l'élève quelques outils (écrire à sa classe, proposer un
// événement…), toujours validés par la Direction ; il ne lui ouvre ni les notes des autres ni les paramètres.

const CODES = [['DELEGUE', 'Délégué'], ['SUPPLEANT', 'Suppléant'], ['BDE', 'BDE'], ['BDE_PRESIDENT', 'Président BDE']];
const NEVER_LABEL = { NOTES_AUTRES_ELEVES: 'notes des autres élèves', APPRECIATIONS: 'appréciations', VIE_SCOLAIRE_AUTRES: 'vie scolaire des autres', FICHES_ELEVES: 'fiches élèves', CAISSE: 'caisse', PARAMETRES: 'paramètres', PUBLIER: 'publier sans la Direction', VALIDER: 'valider' };

export default function MandatesAdmin() {
  const [cls, setCls] = useState('1re STMG');
  const [eng, setEng] = useState(loadEngagements);
  const [err, setErr] = useState([]);
  const toggle = (student, code) => {
    const cur = eng[student] ?? [];
    const next = { ...eng, [student]: cur.includes(code) ? cur.filter((c) => c !== code) : [...cur, code] };
    // contrôles : par classe (délégués, suppléants) et sur tout le site (un seul président du BDE)
    const inClass = Object.fromEntries(CLASSES[cls].map((s) => [s, next[s] ?? []]));
    const presidents = Object.values(next).filter((ids) => ids.includes('BDE_PRESIDENT')).length;
    const e = [...classMandateErrors(inClass).filter((x) => !x.includes('président')), ...(presidents > 1 ? ['Un seul président du BDE pour le site.'] : [])];
    setErr(e); if (e.length) return;
    setEng(next); saveEngagements(next);
  };
  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-semibold text-navy-500">Tamatave · Direction</p>
        <h1 className="text-2xl font-semibold text-navy-900">Délégués et BDE</h1>
        <p className="text-sm text-slate-600">Les mandats de l'année, repris sur le bulletin. Ce que les élèves mandatés écrivent est relu par la CPE puis validé par la Direction.</p>
      </div>
      <div className="grid gap-5 xl:grid-cols-[1fr_340px] xl:items-start">
        <Card title="Mandats par classe" action={<select value={cls} onChange={(e) => { setCls(e.target.value); setErr([]); }} aria-label="Classe" className="rounded-md border border-slate-300 px-2 py-1.5 text-sm">{Object.keys(CLASSES).map((c) => <option key={c}>{c}</option>)}</select>}>
          {err.length > 0 && <p role="alert" className="mb-2 rounded-md bg-red-50 p-2 text-sm text-red-800">{err.join(' ')}</p>}
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-slate-500"><th className="py-1">Élève</th>{CODES.map(([, l]) => <th key={l} className="px-1 text-center">{l}</th>)}</tr></thead>
            <tbody>{CLASSES[cls].map((s) => (
              <tr key={s} className="border-t border-slate-100">
                <td className="py-1.5">{s}</td>
                {CODES.map(([code, l]) => <td key={code} className="text-center"><input type="checkbox" aria-label={`${l} — ${s}`} checked={(eng[s] ?? []).includes(code)} onChange={() => toggle(s, code)} /></td>)}
              </tr>
            ))}</tbody>
          </table>
          <p className="mt-2 text-xs text-slate-600">Au plus 2 délégués et 2 suppléants par classe ; un seul président du BDE. Le mandat prend fin avec l'année scolaire.</p>
        </Card>
        <div className="space-y-5">
          <Card title="Ce que permet un mandat">
            {Object.entries(MANDATES).map(([k, m]) => <p key={k} className="mb-2 text-sm"><strong>{m.label}</strong> : {k === 'DELEGUE' ? 'écrire aux élèves de sa classe, préparer le conseil (remarques au secrétariat).' : 'écrire aux élèves du site, proposer des événements et des photos.'}</p>)}
            <p className="text-sm text-slate-700"><Badge tone="red">Jamais</Badge> {NEVER.map((n) => NEVER_LABEL[n]).join(', ')}.</p>
          </Card>
        </div>
      </div>
    </div>
  );
}
