import React, { useState } from 'react';
import { Badge, Button, Card } from './ui.jsx';
import ScreenTabs from './ScreenTabs.jsx';
import { CLASSES } from '../data/schoollife.js';
import { TERM } from '../data/grades.js';
import { loadEngagements, saveEngagements, loadValidation, saveValidation, loadCatalogue, saveCatalogue } from '../engagementsStore.js';
import { catalogue, addToCatalogue, setForStudents, engagementErrors } from '../rules/engagements.js';
import { classMandateErrors, MANDATES } from '../rules/mandates.js';
import { askConfirm } from './Dialogs.jsx';

// Engagements et attestations (Direction) : délégués, BDE, éco-délégués, parrainage, ASSR…
// - Par engagement : on coche d'un coup tous les élèves concernés (30 élèves, une seule liste) ;
// - Liste : la Direction crée ses propres engagements et attestations, ou cesse d'en proposer.
// Tout peut changer en cours d'année : chaque fin de trimestre, la Direction valide l'état du moment,
// qui part tel quel sur les bulletins de ce trimestre.

const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const field = 'rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm';

/** Contrôles de la classe après changement : 2 délégués et 2 suppléants au plus ; un seul président du BDE. */
function checkErrors(next, cls) {
  const inClass = Object.fromEntries(CLASSES[cls].map((s) => [s, next[s] ?? []]));
  const presidents = Object.values(next).filter((ids) => ids.includes('BDE_PRESIDENT')).length;
  return [...new Set([...classMandateErrors(inClass).filter((x) => !x.includes('président')), ...engagementErrors(inClass).filter((x) => !x.includes('délégué')), ...(presidents > 1 ? ['Un seul président du BDE pour le site.'] : [])])];
}

export default function MandatesAdmin({ account }) {
  const [cls, setCls] = useState('1re STMG');
  const [eng, setEng] = useState(loadEngagements);
  const [custom, setCustom] = useState(loadCatalogue);
  const [valid, setValid] = useState(loadValidation);
  const [tab, setTab] = useState('bulk');
  const [err, setErr] = useState([]);
  const locked = !!valid[TERM.id];
  const cat = catalogue(custom);
  const offered = cat.filter((e) => !e.hidden);
  const apply = (next) => { const e = checkErrors(next, cls); setErr(e); if (e.length) return false; setEng(next); saveEngagements(next); return true; };
  const validate = () => { const v = { ...valid, [TERM.id]: { at: today(), by: account?.name ?? 'Direction' } }; setValid(v); saveValidation(v); };
  const reopen = () => { const v = { ...valid }; delete v[TERM.id]; setValid(v); saveValidation(v); };
  const classPicker = <select value={cls} onChange={(e) => { setCls(e.target.value); setErr([]); }} aria-label="Classe" className={field}>{Object.keys(CLASSES).map((c) => <option key={c}>{c}</option>)}</select>;
  const errors = err.length > 0 && <p role="alert" className="mb-2 rounded-md bg-red-50 p-2 text-sm text-red-800">{err.join(' ')}</p>;

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-semibold text-navy-500">Tamatave · {TERM.label}</p>
        <h1 className="text-2xl font-semibold text-navy-900">Engagements et attestations</h1>
        <p className="text-sm text-slate-600">Modifiables toute l'année ; validés à chaque fin de trimestre, puis repris tels quels sur les bulletins de ce trimestre.</p>
      </div>

      <div className={`flex flex-wrap items-center gap-3 rounded-2xl px-4 py-3 text-sm ${locked ? 'bg-emerald-50 text-emerald-900' : 'bg-amber-50 text-amber-900'}`}>
        {locked ? <span>Validés pour le {TERM.label} le {valid[TERM.id].at.split('-').reverse().join('/')} ({valid[TERM.id].by}). Les bulletins les reprennent. Pour un changement en cours d'année, rouvrez, modifiez, puis validez à nouveau.</span>
          : <span>À valider avant l'impression des bulletins du {TERM.label}.</span>}
        {locked ? <Button variant="secondary" className="ml-auto" onClick={reopen}>Rouvrir pour modifier</Button>
          : <Button className="ml-auto" onClick={validate}>Valider pour le {TERM.label}</Button>}
      </div>

      <ScreenTabs label="Engagements" value={tab} onChange={setTab} tabs={[
        ['bulk', 'Par engagement (plusieurs élèves)', <Bulk key="bulk" {...{ cls, classPicker, eng, offered, locked, apply, errors }} />],
        ['list', 'Liste des engagements et attestations', <CatalogueTab key="list" {...{ custom, setCustom, cat, eng }} />],
      ]} />

      <Card title="Ce que donnent les mandats">
        {Object.entries(MANDATES).map(([k, m]) => <p key={k} className="mb-1 text-sm"><strong>{m.label}</strong> : {k === 'DELEGUE' ? 'écrire aux élèves de sa classe, préparer le conseil (remarques au secrétariat).' : 'membres et président(e) : écrire aux élèves du site, proposer des événements. La présidence est un titre sur le bulletin, sans droit de plus.'}</p>)}
        <p className="text-sm text-slate-700">Toujours relu par la CPE puis validé par la Direction ; jamais d'accès aux notes des autres ni aux paramètres.</p>
      </Card>
    </div>
  );
}

/** Par engagement : un engagement, la liste de la classe, on coche tous les élèves concernés. */
function Bulk({ cls, classPicker, eng, offered, locked, apply, errors }) {
  const [code, setCode] = useState(offered[0]?.id ?? '');
  const [msg, setMsg] = useState('');
  const students = CLASSES[cls] ?? [];
  const has = (s) => (eng[s] ?? []).includes(code);
  const set = (list, on) => { if (apply(setForStudents(eng, code, list, on))) setMsg(''); };
  const n = students.filter(has).length;
  return (
    <Card title="Par engagement" subtitle="Choisissez l'engagement ou l'attestation, puis cochez d'un coup tous les élèves de la classe concernés"
      action={<span className="flex min-w-0 max-w-full flex-wrap gap-2">{classPicker}
        <select value={code} onChange={(e) => setCode(e.target.value)} aria-label="Engagement ou attestation" className={`w-full min-w-0 max-w-full sm:w-auto ${field}`}>
          <optgroup label="Engagements">{offered.filter((e) => e.kind === 'ENGAGEMENT').map((e) => <option key={e.id} value={e.id}>{e.neutral}</option>)}</optgroup>
          <optgroup label="Attestations de l'établissement">{offered.filter((e) => e.kind === 'ATTESTATION').map((e) => <option key={e.id} value={e.id}>{e.neutral}</option>)}</optgroup>
        </select></span>}>
      {errors}
      {msg && <p role="status" className="mb-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">✓ {msg}</p>}
      <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-slate-700">{n} élève{n > 1 ? 's' : ''} sur {students.length}</span>
        {!locked && <><Button variant="secondary" className="!py-1 text-xs" onClick={() => set(students, true)}>Tout cocher</Button><Button variant="secondary" className="!py-1 text-xs" onClick={() => set(students, false)}>Tout décocher</Button></>}
      </div>
      <ul className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
        {students.map((s) => (
          <li key={s}><label className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm ${has(s) ? 'bg-navy-50 text-navy-900' : 'text-slate-800'}`}>
            <input type="checkbox" checked={has(s)} disabled={locked} onChange={(e) => set([s], e.target.checked)} className="h-6 w-6 shrink-0" />{s}</label></li>
        ))}
      </ul>
      {locked && <p className="mt-2 text-xs text-slate-600">Trimestre validé : rouvrez pour modifier.</p>}
    </Card>
  );
}

/** Liste : créer ses engagements et attestations, ou ne plus proposer ceux qui ne servent plus. */
function CatalogueTab({ custom, setCustom, cat, eng }) {
  const [draft, setDraft] = useState({ label: '', kind: 'ENGAGEMENT' });
  const [err, setErr] = useState('');
  const save = (c) => { setCustom(c); saveCatalogue(c); };
  const used = (id) => Object.values(eng).filter((ids) => ids.includes(id)).length;
  const toggleHidden = (e) => {
    if (e.custom) save(custom.map((c) => (c.id === e.id ? { ...c, hidden: !c.hidden } : c)));
    else save(custom.some((c) => c.id === e.id) ? custom.map((c) => (c.id === e.id ? { ...c, hidden: !c.hidden } : c)) : [...custom, { id: e.id, builtin: true, hidden: true }]);
  };
  const remove = async (e) => { if ((await askConfirm(`Supprimer « ${e.neutral} » ?`))) save(custom.filter((c) => c.id !== e.id)); };
  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_360px] xl:items-start">
      <Card title="Engagements et attestations proposés" subtitle="« Ne plus proposer » le retire des listes sans rien effacer : les élèves qui l'ont déjà le gardent sur leurs bulletins">
        {[['ENGAGEMENT', 'Engagements'], ['ATTESTATION', 'Attestations de l\'établissement (internes)']].map(([k, title]) => (
          <div key={k} className="mb-3">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-navy-700">{title}</p>
            <ul className="divide-y divide-slate-100 text-sm">
              {cat.filter((e) => e.kind === k).map((e) => (
                <li key={e.id} className="flex flex-wrap items-center gap-2 py-1.5">
                  <span className={`min-w-0 flex-1 ${e.hidden ? 'text-slate-500 line-through' : 'text-slate-900'}`}>{e.neutral}{e.custom && <Badge className="ml-2">ajouté par l'école</Badge>}</span>
                  <span className="text-xs text-slate-600">{used(e.id)} élève{used(e.id) > 1 ? 's' : ''}</span>
                  <button type="button" onClick={() => toggleHidden(e)} className="text-xs font-medium text-navy-700">{e.hidden ? 'Proposer à nouveau' : 'Ne plus proposer'}</button>
                  {e.custom && !used(e.id) && <button type="button" onClick={() => remove(e)} className="text-xs font-medium text-red-700">Supprimer</button>}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </Card>
      <Card title="Ajouter">
        <div className="space-y-2 text-sm">
          <label className="block text-xs text-slate-600">Libellé (tel qu'il sera imprimé sur le bulletin)<input value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} placeholder="ex. Parrain / marraine d'un nouvel élève" className={`mt-1 w-full ${field}`} /></label>
          <div className="flex gap-1.5">{[['ENGAGEMENT', 'Engagement'], ['ATTESTATION', 'Attestation']].map(([k, l]) => (
            <button key={k} type="button" aria-pressed={draft.kind === k} onClick={() => setDraft({ ...draft, kind: k })} className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ${draft.kind === k ? 'bg-navy-500 text-white ring-navy-500' : 'bg-white text-slate-700 ring-slate-300'}`}>{l}</button>
          ))}</div>
          {err && <p className="text-xs text-red-700">{err}</p>}
          <Button className="w-full" onClick={() => { const r = addToCatalogue(custom, draft); if (r.error) { setErr(r.error); return; } setErr(''); save(r.custom); setDraft({ ...draft, label: '' }); }}>Ajouter</Button>
          <p className="text-xs text-slate-600">Engagement : un rôle de l'élève (délégué, club, parrainage…). Attestation : une formation interne validée (sécurité routière, secourisme, numérique…).</p>
        </div>
      </Card>
    </div>
  );
}
