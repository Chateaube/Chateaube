import React from 'react';
import { Icon } from './ui.jsx';
import { normalizeGrade } from '../rules/gradeInput.js';

// Composants partagés : saisie de note avec correction, contrôleur de rédaction.

export const MASTERY = [
  null,
  { label: 'Insuffisante', cls: 'bg-red-100 text-red-800' },
  { label: 'Fragile', cls: 'bg-amber-100 text-amber-800' },
  { label: 'Satisfaisante', cls: 'bg-emerald-100 text-emerald-800' },
  { label: 'Très bonne', cls: 'bg-emerald-600 text-white' },
];

/** Surligne dans le texte les passages signalés par le contrôleur. */
export function Annotated({ text, issues }) {
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

export function RulePanel({ result }) {
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

export function GradeCell({ value, onChange, max }) {
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

