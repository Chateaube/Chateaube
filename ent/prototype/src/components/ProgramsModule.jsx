import React, { useMemo, useState } from 'react';
import { Badge, Button, Card } from './ui.jsx';
import { usePersistent } from '../persist.js';
import { CLASSES } from '../data/schoollife.js';
import { loadImport } from '../importStore.js';
import { ReformsCard } from './NewPrograms.jsx';
import { OFFICIAL_PROGRAMS, PROGRAM_STATUS, officialProgram, programLevel, programSubject } from '../data/officialPrograms.js';
import { TERMS, TERM_LABEL, PLAN_STATUS, PROGRESS_STATE, partsFor, planKey, baseKey, progressOf, termOf } from '../rules/programPlan.js';
import { today } from '../clock.js';
import { me } from '../identity.js';

// Programmes et progression (Direction, en construction : masqué pour les professeurs).
// 1. Suivi : chaque classe, chaque matière : prévu à date, fait, en retard (par trimestre).
// 2. Programmation : les parties du programme réparties par trimestre, validées par la Direction.
// 3. Base officielle : les grandes parties des programmes nationaux, corrigeables par la Direction.
// Le « fait » se coche ici pour l'instant ; il viendra du cahier de textes quand il sera ouvert aux professeurs.
const KEY = 'ent-programmes-v1';
const EMPTY = { base: {}, plans: {}, done: {} };
const inputCls = 'rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm';
const TODAY = today();
const NOW_TERM = termOf(TODAY);
const ORDER = ['6e', '5e', '4e', '3e', '2de', '1re', 'Terminale'];
const classes = () => Object.keys(CLASSES).sort((a, b) => ORDER.findIndex((o) => a.startsWith(o)) - ORDER.findIndex((o) => b.startsWith(o)) || a.localeCompare(b, 'fr'));
/** Matières d'une classe : celles de son emploi du temps qui ont une base, sinon toutes celles de son niveau. */
function subjectsOf(cls) {
  const level = programLevel(cls);
  const fromBase = Object.keys(OFFICIAL_PROGRAMS).filter((k) => k.endsWith(`|${level}`)).map((k) => k.split('|')[0]);
  const fromTimetable = [...new Set((loadImport()?.timetable ?? []).filter((s) => s.cls === cls).map((s) => programSubject(s.subject)))].filter((s) => fromBase.includes(s));
  return fromTimetable.length ? fromTimetable : fromBase;
}

function Overview({ data, open }) {
  const rows = classes().map((cls) => ({ cls, subjects: subjectsOf(cls).map((s) => ({ s, p: progressOf(cls, s, data, TODAY) })) }));
  return (
    <Card title={`Avancement des programmes — ${TERM_LABEL[NOW_TERM]}`} subtitle="Prévu à date (trimestres passés et en cours), fait, en retard ; cliquez une case pour ouvrir la programmation">
      <div className="space-y-4">
        {rows.map(({ cls, subjects }) => (
          <div key={cls}>
            <p className="mb-1.5 text-sm font-semibold text-navy-900">{cls}</p>
            <div className="flex flex-wrap gap-2">
              {subjects.map(({ s, p }) => (
                <button key={s} type="button" onClick={() => open(cls, s)} className={`rounded-xl px-3 py-2 text-left text-xs ring-1 ${p.state === 'RETARD' ? 'bg-red-50 ring-red-200' : p.state === 'DANS_LES_TEMPS' ? 'bg-emerald-50 ring-emerald-200' : 'bg-white ring-slate-200'}`}>
                  <span className="block font-semibold text-slate-900">{s}</span>
                  <span className="text-slate-600">{p.state === 'SANS_PROGRAMMATION' ? 'pas de programmation' : `${p.doneDue}/${p.due} faits à date${p.late.length ? ` · ${p.late.length} en retard` : ''}`}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
        {!rows.length && <p className="text-sm text-slate-600">Aucune classe : importez d'abord la liste des élèves.</p>}
      </div>
    </Card>
  );
}

function PlanTab({ data, setData, cls, setCls, subject, setSubject }) {
  const subjects = subjectsOf(cls);
  const subj = subjects.includes(subject) ? subject : subjects[0];
  const key = planKey(cls, subj);
  const parts = partsFor(subj, cls, data);
  const plan = data.plans[key] ?? { terms: {}, status: 'BROUILLON' };
  const done = data.done[key] ?? {};
  const prog = progressOf(cls, subj, data, TODAY);
  const official = officialProgram(subj, cls);
  const setPlan = (patch) => setData({ ...data, plans: { ...data.plans, [key]: { ...plan, ...patch, status: patch.status ?? (plan.status === 'VALIDEE' ? 'A_VALIDER' : plan.status) } } });
  const setTerm = (p, t) => setPlan({ terms: { ...plan.terms, [p]: t || undefined } });
  const toggleDone = (p) => setData({ ...data, done: { ...data.done, [key]: { ...done, [p]: done[p] ? undefined : TODAY } } });
  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-center gap-2">
          <select value={cls} onChange={(e) => setCls(e.target.value)} aria-label="Classe" className={inputCls}>{classes().map((c) => <option key={c}>{c}</option>)}</select>
          <select value={subj} onChange={(e) => setSubject(e.target.value)} aria-label="Matière" className={inputCls}>{subjects.map((s) => <option key={s}>{s}</option>)}</select>
          {official && <Badge tone={PROGRAM_STATUS[official.status][1]}>{PROGRAM_STATUS[official.status][0]}</Badge>}
          <Badge tone={PLAN_STATUS[plan.status ?? 'BROUILLON'][1]}>{PLAN_STATUS[plan.status ?? 'BROUILLON'][0]}</Badge>
          <span className="ml-auto flex gap-2">
            {plan.status !== 'VALIDEE' && <Button className="!py-1 text-xs" disabled={!prog.planned} onClick={() => setPlan({ status: 'VALIDEE', by: me('DIRECTION'), at: TODAY })}>Valider la programmation</Button>}
          </span>
        </div>
        {official && <p className="mt-2 text-xs text-slate-500">{official.ref}{official.note ? ` — ${official.note}` : ''}</p>}
      </Card>
      <Card title={`Programmation — ${cls} · ${subj}`} subtitle={`${prog.planned}/${prog.parts} parties réparties · ${prog.doneCount} faites${prog.late.length ? ` · ${prog.late.length} en retard` : ''}`}>
        {parts.length === 0 ? <p className="text-sm text-slate-600">Pas de base pour cette matière à ce niveau : complétez-la dans l'onglet « Base officielle ».</p> : (
          <ul className="divide-y divide-slate-100">
            {parts.map((p) => {
              const late = prog.late.includes(p);
              return (
                <li key={p} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                  <span className={`min-w-0 flex-1 ${late ? 'font-medium text-red-800' : 'text-slate-800'}`}>{p}{late && <span className="block text-xs font-normal">prévu au {TERM_LABEL[plan.terms[p]]}, pas encore fait</span>}</span>
                  <select value={plan.terms[p] ?? ''} onChange={(e) => setTerm(p, e.target.value)} aria-label={`Trimestre — ${p}`} className={`${inputCls} !py-1 text-xs`}>
                    <option value="">Trimestre…</option>{TERMS.map((t) => <option key={t} value={t}>{TERM_LABEL[t]}</option>)}
                  </select>
                  <label className="flex items-center gap-1.5 text-xs text-slate-700"><input type="checkbox" checked={!!done[p]} onChange={() => toggleDone(p)} />{done[p] ? `fait (${done[p].split('-').reverse().join('/')})` : 'fait'}</label>
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-3 text-xs text-slate-500">Pour l'instant, « fait » se coche ici. Quand le cahier de textes sera ouvert aux professeurs, chaque séance cochée sur une partie la marquera faite.</p>
      </Card>
    </div>
  );
}

function BaseTab({ data, setData }) {
  const levels = ['6e', '5e', '4e', '3e', '2de', '1re G', '1re STMG', 'Tle G', 'Tle STMG'];
  const [level, setLevel] = useState('3e');
  const subjects = Object.keys(OFFICIAL_PROGRAMS).filter((k) => k.endsWith(`|${level}`)).map((k) => k.split('|')[0]);
  const [subject, setSubject] = useState('');
  const subj = subjects.includes(subject) ? subject : subjects[0];
  const official = OFFICIAL_PROGRAMS[`${subj}|${level}`];
  const k = `${subj}|${level}`;
  const current = data.base[k] ?? official?.items ?? [];
  const [text, setText] = useState(null);
  const editing = text !== null;
  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_360px] xl:items-start">
      <Card title="Base officielle des programmes" subtitle="Grandes parties des programmes nationaux, niveau par niveau ; la Direction peut les corriger ou les compléter"
        action={<span className="flex gap-2">
          <select value={level} onChange={(e) => { setLevel(e.target.value); setText(null); }} aria-label="Niveau" className={inputCls}>{levels.map((l) => <option key={l}>{l}</option>)}</select>
          <select value={subj} onChange={(e) => { setSubject(e.target.value); setText(null); }} aria-label="Matière" className={inputCls}>{subjects.map((s) => <option key={s}>{s}</option>)}</select>
        </span>}>
        {official && <p className="mb-3 flex flex-wrap items-center gap-2 text-xs text-slate-600"><Badge tone={PROGRAM_STATUS[official.status][1]}>{PROGRAM_STATUS[official.status][0]}</Badge>{official.ref}{official.note ? ` — ${official.note}` : ''}{data.base[k] ? ' · corrigée par la Direction' : ''}</p>}
        {editing ? (
          <>
            <textarea rows={Math.max(8, current.length + 2)} value={text} onChange={(e) => setText(e.target.value)} aria-label="Parties du programme, une par ligne" className={`w-full ${inputCls}`} />
            <p className="mt-1 text-xs text-slate-500">Une partie par ligne (vous pouvez coller la liste copiée depuis le BO).</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button onClick={() => { const items = text.split('\n').map((x) => x.trim()).filter(Boolean); setData({ ...data, base: { ...data.base, [k]: items } }); setText(null); }}>Enregistrer</Button>
              <Button variant="secondary" onClick={() => setText(null)}>Annuler</Button>
              {data.base[k] && <Button variant="ghost" onClick={() => { const b = { ...data.base }; delete b[k]; setData({ ...data, base: b }); setText(null); }}>Revenir à la base officielle</Button>}
            </div>
          </>
        ) : (
          <>
            <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-800">{current.map((x) => <li key={x}>{x}</li>)}</ol>
            <Button variant="secondary" className="mt-3" onClick={() => setText(current.join('\n'))}>Corriger ou compléter</Button>
          </>
        )}
      </Card>
      <ReformsCard />
    </div>
  );
}

const TABS = [['overview', 'Suivi des classes'], ['plan', 'Programmation'], ['base', 'Base officielle']];
export default function ProgramsModule() {
  const [data, setDataRaw] = usePersistent(KEY, EMPTY);
  const safe = useMemo(() => ({ ...EMPTY, ...(data ?? {}) }), [data]);
  const setData = (d) => setDataRaw(d);
  const [tab, setTab] = useState('overview');
  const [cls, setCls] = useState(() => classes()[0] ?? '');
  const [subject, setSubject] = useState('');
  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-semibold text-navy-500">Pédagogie · en construction (Direction seulement)</p>
        <h1 className="text-2xl font-semibold text-navy-900">Programmes et progression</h1>
        <p className="text-sm text-slate-600">Programmes officiels, programmation de l'année par trimestre et suivi de ce qui a été fait, classe par classe.</p>
      </div>
      <div className="flex gap-1 overflow-x-auto rounded-lg bg-slate-100 p-1" role="tablist">
        {TABS.map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ${tab === id ? 'bg-white text-navy-900 shadow-sm' : 'text-slate-600'}`}>{label}</button>)}
      </div>
      {tab === 'overview' && <Overview data={safe} open={(c, s) => { setCls(c); setSubject(s); setTab('plan'); }} />}
      {tab === 'plan' && cls && <PlanTab data={safe} setData={setData} cls={cls} setCls={setCls} subject={subject} setSubject={setSubject} />}
      {tab === 'base' && <BaseTab data={safe} setData={setData} />}
    </div>
  );
}
export { baseKey, PROGRESS_STATE };
