import React, { useMemo, useState } from 'react';
import { Badge, Button, Card, Icon } from './ui.jsx';
import { CLASS_INFO, SUBJECTS, STUDENTS, COMPETENCIES } from '../data/demo.js';
import { checkAppreciation, autoFix, decisionText } from '../rules/appreciation.js';
import { normalizeGrade } from '../rules/gradeInput.js';
import { generateDraft } from '../rules/assistant.js';

const TREND_UI = { hausse: ['↗', 'text-emerald-700', 'En hausse'], stable: ['→', 'text-slate-600', 'Stable'], baisse: ['↘', 'text-amber-700', 'En baisse'] };
const MASTERY = [
  null,
  { label: 'Insuffisante', cls: 'bg-red-100 text-red-800' },
  { label: 'Fragile', cls: 'bg-amber-100 text-amber-800' },
  { label: 'Satisfaisante', cls: 'bg-emerald-100 text-emerald-800' },
  { label: 'Très bonne', cls: 'bg-emerald-600 text-white' },
];

/** Surligne dans le texte les passages signalés par le contrôleur. */
function Annotated({ text, issues }) {
  const spans = issues
    .filter((i) => i.excerpt && Number.isInteger(i.index))
    .sort((a, b) => a.index - b.index)
    .reduce((acc, i) => (acc.length && i.index < acc.at(-1).end ? acc : [...acc, { ...i, end: i.index + i.excerpt.length }]), []);
  if (!spans.length) return <span>{text}</span>;
  const out = [];
  let cursor = 0;
  spans.forEach((s, k) => {
    out.push(<span key={`t${k}`}>{text.slice(cursor, s.index)}</span>);
    out.push(<mark key={`m${k}`} title={s.message} className="rounded bg-red-100 px-0.5 text-red-900 underline decoration-red-500 decoration-wavy underline-offset-2">{text.slice(s.index, s.end)}</mark>);
    cursor = s.end;
  });
  out.push(<span key="end">{text.slice(cursor)}</span>);
  return out;
}

function RulePanel({ result }) {
  return (
    <div className="space-y-3">
      <ul className="space-y-1.5">
        {result.checks.map((c) => (
          <li key={c.rule} className={`flex items-center gap-2 text-sm ${c.ok ? 'text-emerald-800' : 'text-red-800'}`}>
            <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${c.ok ? 'bg-emerald-100' : 'bg-red-100'}`}>
              <Icon name={c.ok ? 'check' : 'x'} className="h-3 w-3" />
            </span>
            {c.label}
          </li>
        ))}
      </ul>
      <div className="grid grid-cols-2 gap-2 text-center">
        <div className="rounded-lg bg-slate-50 p-2">
          <p className="text-[11px] text-slate-500">Phrases complètes</p>
          <p className={`font-semibold tabular-nums ${result.stats.complete >= 2 ? 'text-emerald-700' : 'text-red-700'}`}>{result.stats.complete} / 2 min.</p>
        </div>
        <div className="rounded-lg bg-slate-50 p-2">
          <p className="text-[11px] text-slate-500">Longueur</p>
          <p className={`font-semibold tabular-nums ${result.stats.length > 450 ? 'text-amber-700' : 'text-slate-800'}`}>{result.stats.length} / 450</p>
        </div>
      </div>
      {result.errors.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-red-700">À corriger ({result.errors.length})</p>
          <ul className="space-y-1.5">
            {result.errors.map((e, i) => <li key={i} className="rounded-md bg-red-50 px-2.5 py-1.5 text-xs text-red-900">{e.message}</li>)}
          </ul>
        </div>
      )}
      {result.warnings.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-700">Suggestions ({result.warnings.length})</p>
          <ul className="space-y-1.5">
            {result.warnings.map((w, i) => <li key={i} className="rounded-md bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900">{w.message}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

function AppreciationsTab() {
  const [subjectId, setSubjectId] = useState('MATHS');
  const [studentId, setStudentId] = useState('s3');
  const [texts, setTexts] = useState(() => Object.fromEntries(STUDENTS.map((s) => [`MATHS:${s.id}`, s.draft])));
  const [validated, setValidated] = useState({});
  const [seed, setSeed] = useState(0);
  const [decision, setDecision] = useState('ADMIS');
  const [aiNote, setAiNote] = useState(null);

  const subject = SUBJECTS.find((s) => s.id === subjectId);
  const student = STUDENTS.find((s) => s.id === studentId);
  const key = `${subjectId}:${studentId}`;
  const text = texts[key] ?? '';
  const ctx = { mode: subject.mode };
  const result = useMemo(() => checkAppreciation(text, ctx), [text, subject.mode]);

  const setText = (value) => {
    setTexts((t) => ({ ...t, [key]: value }));
    setValidated((v) => ({ ...v, [key]: false }));
    setAiNote(null);
  };

  const propose = () => {
    const draft = generateDraft({ ...student, subject: subject.label, mode: subject.mode, strand: subject.strand, seed });
    setSeed((s) => s + 1);
    setText(draft);
    setAiNote('Proposition générée et vérifiée par le contrôleur. À relire et ajuster avant validation.');
  };

  const statusOf = (sid) => {
    const k = `${subjectId}:${sid}`;
    if (validated[k]) return 'valid';
    const t = texts[k] ?? '';
    if (!t.trim()) return 'empty';
    return checkAppreciation(t, ctx).ok ? 'ready' : 'error';
  };
  const done = STUDENTS.filter((s) => statusOf(s.id) === 'valid').length;
  const [arrow, arrowCls, trendLabel] = TREND_UI[student.trend];

  return (
    <div className="grid gap-5 xl:grid-cols-[230px_1fr_320px]">
      {/* Liste des élèves */}
      <Card title={CLASS_INFO.name} subtitle={`${CLASS_INFO.site} · ${CLASS_INFO.period}`}>
        <label className="mb-3 block">
          <span className="text-xs font-medium text-slate-600">Matière</span>
          <select className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm" value={subjectId} onChange={(e) => { setSubjectId(e.target.value); setAiNote(null); }}>
            {SUBJECTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </label>
        <p className="mb-2 text-xs text-slate-500">{done} / {STUDENTS.length} validées</p>
        <ul className="-mx-2 space-y-0.5">
          {STUDENTS.map((s) => {
            const st = statusOf(s.id);
            return (
              <li key={s.id}>
                <button onClick={() => { setStudentId(s.id); setAiNote(null); }}
                  className={`flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm ${s.id === studentId ? 'bg-navy-50 font-medium text-navy-900' : 'hover:bg-slate-50'}`}>
                  <span className="truncate">{s.lastName} {s.firstName}</span>
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${{ valid: 'bg-emerald-500', ready: 'bg-navy-200', error: 'bg-red-500', empty: 'bg-slate-200' }[st]}`}
                    title={{ valid: 'Validée', ready: 'Conforme, à valider', error: 'Erreurs à corriger', empty: 'À rédiger' }[st]} />
                </button>
              </li>
            );
          })}
        </ul>
      </Card>

      {/* Éditeur */}
      <Card
        title={`${student.firstName} ${student.lastName}`}
        subtitle={subject.label}
        action={subject.mode === 'APPRECIATION_SEULE'
          ? <Badge tone="violet">Appréciation seule · sans note</Badge>
          : <div className="flex items-center gap-2"><Badge tone="navy">Moy. {String(student.average).replace('.', ',')} / 20</Badge><span className={`text-sm font-medium ${arrowCls}`}>{arrow} {trendLabel}</span></div>}
      >
        {subject.mode !== 'APPRECIATION_SEULE' && (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {COMPETENCIES.map((c, i) => (
              <span key={c} className={`rounded-md px-2 py-0.5 text-xs ${MASTERY[student.mastery[i]].cls}`}>{c} : {MASTERY[student.mastery[i]].label}</span>
            ))}
          </div>
        )}
        <label className="block">
          <span className="sr-only">Appréciation</span>
          <textarea
            rows={6}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Rédiger l'appréciation (au moins deux phrases complètes, à la 3e personne)…"
            className={`w-full resize-y rounded-lg border px-3 py-2 text-sm leading-relaxed outline-none focus:ring-2 ${result.ok ? 'border-slate-300 focus:ring-navy-200' : 'border-red-300 focus:ring-red-200'}`}
          />
        </label>
        {text.trim() && (result.errors.length > 0 || result.warnings.length > 0) && (
          <div className="mt-2 rounded-lg bg-slate-50 p-3 text-sm leading-relaxed text-slate-700">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Aperçu annoté</p>
            <Annotated text={text} issues={[...result.errors, ...result.warnings]} />
          </div>
        )}
        {aiNote && <p className="mt-2 flex items-center gap-1.5 text-xs text-violet-700"><Icon name="sparkles" />{aiNote}</p>}

        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="secondary" onClick={propose}><Icon name="sparkles" className="h-4 w-4 text-violet-600" />Proposer avec l'assistant</Button>
          <Button variant="secondary" disabled={autoFix(text) === text.trim() || !text.trim()} onClick={() => setText(autoFix(text))}>Corriger la forme</Button>
          <Button
            className="ml-auto"
            disabled={!result.ok || validated[key]}
            onClick={() => setValidated((v) => ({ ...v, [key]: true }))}
          >
            <Icon name="check" />{validated[key] ? 'Validée' : 'Valider l\'appréciation'}
          </Button>
        </div>

        {/* Décision du conseil de classe */}
        <div className="mt-5 rounded-lg border border-slate-200 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Avis du conseil de classe (3e trimestre)</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <select className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm" value={decision} onChange={(e) => setDecision(e.target.value)}>
              <option value="ADMIS">Passage</option>
              <option value="RETENU">Maintien</option>
            </select>
            <span className="text-slate-400">→</span>
            <span className="rounded-md bg-navy-50 px-2.5 py-1 text-sm font-medium text-navy-900">
              {decisionText(decision, decision === 'ADMIS' ? CLASS_INFO.nextLevel : '1re')}
            </span>
          </div>
          <p className="mt-1.5 text-xs text-slate-500">Formulation inclusive officielle générée automatiquement — non modifiable à la main.</p>
        </div>
      </Card>

      {/* Contrôleur */}
      <Card title="Contrôleur de rédaction" subtitle="Règles de l'établissement, vérifiées à chaque frappe">
        <RulePanel result={result} />
      </Card>
    </div>
  );
}

function GradeCell({ value, onChange, max }) {
  const r = normalizeGrade(value, { max });
  const border = { empty: 'border-slate-300', valid: 'border-slate-300', suggest: 'border-amber-400 bg-amber-50', error: 'border-red-400 bg-red-50' }[r.state];
  const accept = () => r.suggestion && onChange(r.suggestion);
  return (
    <div className="relative w-28">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => r.state === 'valid' && r.status === 'NOTE' && onChange(r.display)}
        onKeyDown={(e) => { if (e.key === 'Enter') accept(); }}
        aria-invalid={r.state === 'error'}
        aria-label="Note"
        className={`w-16 rounded-md border px-2 py-1 text-center text-sm tabular-nums outline-none focus:ring-2 focus:ring-navy-200 ${border}`}
      />
      {r.state === 'suggest' && (
        <button onClick={accept} className="mt-1 block rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-900 hover:bg-amber-200" title={r.messages.map((m) => m.text).join(' ')}>
          → {r.suggestion} ? <kbd className="ml-0.5 font-sans opacity-70">⏎</kbd>
        </button>
      )}
      {r.state === 'error' && <p className="mt-1 text-[11px] leading-tight text-red-700">{r.messages[0].text}</p>}
      {r.state === 'valid' && r.messages[0]?.level === 'info' && r.status !== 'NOTE' && <p className="mt-1 text-[11px] text-slate-500">{r.messages[0].text}</p>}
      {r.state === 'valid' && r.status === 'NOTE' && r.display !== value.trim() && <p className="mt-1 text-[11px] text-navy-700">→ {r.display}</p>}
    </div>
  );
}

function GradesTab() {
  const [rows, setRows] = useState(() => STUDENTS.map((s) => ({ id: s.id, name: `${s.lastName} ${s.firstName}`, grades: [...s.grades], mastery: [...s.mastery] })));
  const update = (i, j, v) => setRows((rs) => rs.map((r, k) => (k === i ? { ...r, grades: r.grades.map((g, l) => (l === j ? v : g)) } : r)));
  const updateMastery = (i, j, v) => setRows((rs) => rs.map((r, k) => (k === i ? { ...r, mastery: r.mastery.map((m, l) => (l === j ? v : m)) } : r)));
  const issues = rows.flatMap((r) => r.grades).map((g) => normalizeGrade(g).state).filter((s) => s === 'suggest' || s === 'error').length;

  return (
    <Card
      title="DS n°2 — Fonctions et suites"
      subtitle={`${CLASS_INFO.name} · Mathématiques · notes /20 et grille de compétences`}
      action={issues ? <Badge tone="amber">{issues} saisie{issues > 1 ? 's' : ''} à vérifier</Badge> : <Badge tone="green">Saisie conforme</Badge>}
    >
      <p className="mb-3 text-sm text-slate-600">
        Essayez « 1O », « o », « 12.5 » ou « 125 » : la saisie est analysée en direct et une correction est proposée
        (Entrée pour l'accepter). Codes acceptés : ABS, DISP, NN.
      </p>
      <div className="-mx-4 overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-y border-slate-100 bg-slate-50 text-left text-xs text-slate-500">
              <th className="px-4 py-2 font-medium">Élève</th>
              <th className="px-2 py-2 font-medium">Interro (/20)</th>
              <th className="px-2 py-2 font-medium">DS n°1 (/20)</th>
              <th className="px-2 py-2 font-medium">DS n°2 (/20)</th>
              {COMPETENCIES.map((c) => <th key={c} className="px-2 py-2 font-medium">{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id} className="border-b border-slate-100 align-top">
                <td className="px-4 py-2.5 font-medium text-slate-800">{r.name}</td>
                {[0, 1, 2].map((j) => (
                  <td key={j} className="px-2 py-2">
                    <GradeCell value={r.grades[j] ?? ''} onChange={(v) => update(i, j, v)} max={20} />
                  </td>
                ))}
                {COMPETENCIES.map((c, j) => (
                  <td key={c} className="px-2 py-2">
                    <select
                      aria-label={`${c} — ${r.name}`}
                      value={r.mastery[j]}
                      onChange={(e) => updateMastery(i, j, Number(e.target.value))}
                      className={`rounded-md border-0 px-1.5 py-1 text-xs font-medium ${MASTERY[r.mastery[j]].cls}`}
                    >
                      {[1, 2, 3, 4].map((m) => <option key={m} value={m}>{m} · {MASTERY[m].label}</option>)}
                    </select>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export default function AppreciationModule() {
  const [tab, setTab] = useState('appreciations');
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Notes & bulletins</p>
          <h1 className="text-2xl font-semibold text-navy-900">Saisie des appréciations</h1>
          <p className="text-sm text-slate-500">Assistant de rédaction encadré par les règles de l'établissement.</p>
        </div>
        <div className="inline-flex rounded-lg bg-slate-100 p-1" role="tablist">
          {[['appreciations', 'Appréciations'], ['notes', 'Notes & compétences']].map(([id, label]) => (
            <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
              className={`rounded-md px-3 py-1 text-sm font-medium ${tab === id ? 'bg-white text-navy-900 shadow-sm' : 'text-slate-600'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>
      {tab === 'appreciations' ? <AppreciationsTab /> : <GradesTab />}
    </div>
  );
}
