import React from 'react';
import { EXAMS, examResult, partMark, keptSubs, mention, decision } from '../rules/mockExam.js';

// Relevé d'un examen blanc tel que le voient l'élève et ses parents dans l'application (sans papier).
// En 1re : on rappelle que ces notes valent pour le bac et ne se rattrapent pas, et ce qui reste en Terminale.
const f2 = (v) => (v === 'ABS' ? 'Abs.' : v == null ? '—' : Number(v).toFixed(2).replace('.', ','));
const fr = (iso) => iso.split('-').reverse().join('/');
const nextOf = (kind) => Object.entries(EXAMS).find(([, e]) => e.first === kind)?.[0];

export default function ExamResultCard({ session, student }) {
  const exam = EXAMS[session.kind];
  const marks = session.marks[student] ?? {};
  const r = examResult(exam.parts, marks);
  const next = nextOf(session.kind);
  const firstCoef = exam.parts.reduce((t, p) => t + p.coef, 0);
  return (
    <section aria-label={`Relevé — ${session.title}`} className="rounded-2xl bg-white p-4 shadow-soft">
      <p className="text-xs text-slate-600">{exam.official} · examen blanc du {fr(session.date)}</p>
      <h2 className="font-display text-[15px] font-semibold text-slate-900">{session.title}</h2>
      <table className="mt-2 w-full text-sm">
        <thead><tr className="text-left text-xs text-slate-600"><th className="py-1 font-medium">Épreuve</th><th className="px-1 text-right font-medium">Coef.</th><th className="text-right font-medium">Note /20</th></tr></thead>
        <tbody>
          {exam.parts.map((p) => {
            const v = partMark(p, marks);
            const kept = p.subs ? keptSubs(p, marks) : [];
            return (
              <React.Fragment key={p.id}>
                <tr className="border-t border-slate-100"><td className="py-1.5 pr-2">{p.label}</td><td className="px-1 text-right tabular-nums text-slate-600">{String(p.coef).replace('.', ',')}</td>
                  <td className={`text-right font-semibold tabular-nums ${typeof v === 'number' && v < 10 ? 'text-red-700' : 'text-slate-900'}`}>{f2(v)}</td></tr>
                {p.subs && p.subs.map((x) => (
                  <tr key={x.id} className="text-xs text-slate-600"><td className="py-0.5 pl-4">{x.label}{kept.includes(x.id) ? ' — retenue' : ''}</td><td /><td className="text-right tabular-nums">{f2(marks[x.id])}</td></tr>
                ))}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm">
        <span>Moyenne : <strong className="text-base tabular-nums">{f2(r.average)}</strong> / 20</span>
        {/* en 1re, pas de « admis » : ce n'est qu'une partie du bac */}
        <span className="text-slate-700">{!r.complete ? 'Épreuve(s) manquante(s)' : next ? 'Épreuves de 1re du bac' : [decision(r.average, session.kind), mention(r.average)].filter(Boolean).join(' · ')}</span>
      </div>
      {next && (
        <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
          <p className="font-semibold">Vos notes de 1re comptent déjà pour le bac</p>
          <p className="mt-1">Au bac, les épreuves de 1re valent <strong>{firstCoef} coefficients sur 100</strong>. Ces notes sont définitives : elles ne se rattrapent pas en Terminale. C'est maintenant qu'elles se jouent.</p>
          <p className="mt-2 font-medium">Restera à passer en Terminale ({EXAMS[next].parts.reduce((t, p) => t + p.coef, 0)} coefficients) :</p>
          <p className="text-xs">{EXAMS[next].parts.map((p) => `${p.label} (${p.coef})`).join(' · ')}</p>
        </div>
      )}
      <p className="mt-2 text-[11px] text-slate-600">Examen blanc de l'établissement, dans les conditions de l'examen. Document interne, sans valeur officielle.</p>
    </section>
  );
}
