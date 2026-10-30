import React, { useMemo, useState } from 'react';
import { Badge, Card } from './ui.jsx';
import { CLASSES, classOf, MEASURES_LOG } from '../data/schoollife.js';
import { loadAttendance } from '../attendanceStore.js';
import { loadObjects } from '../objectsStore.js';
import { loadVisits } from '../careStore.js';
import { loadPassport } from './PassportTab.jsx';
import { loadJournal } from '../activityStore.js';
import { justificationState } from '../rules/attendance.js';
import { MEASURES, objectOf } from '../rules/discipline.js';
import { formatDateFr } from '../rules/calendar.js';
import { findStudents } from '../rules/search.js';
import { takeIntent } from '../navIntent.js';
import { nowIso } from '../clock.js';

// Fil de l'élève : une seule chronologie partagée par l'équipe (absences, retards, punitions et sanctions,
// objets confisqués, colles, passages à l'infirmerie, actions notées dans le journal).
// Chacun ne voit que ce que son rôle permet : les soins (santé) et le journal interne ne sont pas montrés
// aux enseignants. Évite le « je ne savais pas » entre la vie scolaire, les professeurs et la Direction.

const NOW = nowIso('11:00');
const MEASURE = Object.fromEntries(MEASURES.map((m) => [m.id, m]));
const KIND = { ABSENCE: ['red', 'Absence'], RETARD: ['amber', 'Retard'], MESURE: ['violet', 'Punition / sanction'], OBJET: ['slate', 'Objet'], COLLE: ['amber', 'Colle'], SOIN: ['green', 'Soins'], JOURNAL: ['navy', 'Journal'] };
const fmt = (at) => `${formatDateFr(at.slice(0, 10)).replace(/ \d{4}$/, '')}${at.length > 10 ? ` · ${at.slice(11, 16).replace(':', 'h')}` : ''}`;

/** Événements d'un élève, du plus récent au plus ancien ; health=false retire les soins et le journal. */
export function studentEvents(name, { health = true } = {}) {
  const st = { JUSTIFIEE: 'justifiée', EN_ATTENTE: 'justification envoyée par la famille', A_JUSTIFIER: 'à justifier', NON_JUSTIFIEE: 'non justifiée' };
  const list = [
    ...loadAttendance().filter((a) => a.student === name).map((a) => ({ id: a.id, at: a.date, kind: a.kind, text: `${a.slot} · ${st[justificationState(a, NOW).status]}${a.reason ? ` (${a.reason})` : ''}`, by: a.by })),
    ...MEASURES_LOG.filter((m) => m.student === name).map((m) => ({ id: m.id, at: m.date, kind: 'MESURE', text: `${MEASURE[m.measure].label} — ${m.reason}`, by: m.author })),
    ...loadObjects().filter((p) => p.student === name).map((p) => ({ id: p.id, at: p.at, kind: 'OBJET', text: p.action === 'AVERTISSEMENT' ? `Avertissement : ${objectOf(p).toLowerCase()}` : `${objectOf(p)} confisqué — ${p.reason}${p.returned ? ' (rendu)' : ''}`, by: p.confiscatedBy })),
    ...loadPassport().colles.filter((c) => c.student === name).map((c) => ({ id: c.id, at: c.when ?? c.date, kind: 'COLLE', text: `${c.kind === 'TIG' ? 'TIG' : `Colle de ${c.hours} h`} — ${c.reason}`, by: c.by })),
    ...(health ? loadVisits().filter((v) => v.student === name).map((v) => ({ id: v.id, at: v.at, kind: 'SOIN', text: `${v.reason}${v.paracetamol ? ' · paracétamol donné' : ''}`, by: v.by })) : []),
    ...(health ? loadJournal().filter((j) => j.student === name && ['PARENTS', 'SORTIE', 'OUBLI'].includes(j.kind)).map((j) => ({ id: j.id, at: j.at, kind: 'JOURNAL', text: j.text, by: j.who })) : []),
  ];
  return list.sort((a, b) => b.at.localeCompare(a.at));
}

export default function StudentTimeline({ role, student: fixed, embedded = false }) {
  const health = role !== 'ENSEIGNANT';
  // ouvert depuis la recherche ou le journal : sur l'élève ; sinon sur la recherche (aucun élève choisi)
  const first = fixed ?? takeIntent('student-file')?.student;
  const [picked, setStudent] = useState(first ?? null);
  const student = fixed ?? picked;
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState('ALL');
  const matches = useMemo(() => findStudents(query), [query]);
  const events = student ? studentEvents(student, { health }).filter((e) => kind === 'ALL' || e.kind === kind) : [];
  const kinds = Object.keys(KIND).filter((k) => health || !['SOIN', 'JOURNAL'].includes(k));
  return (
    <div className="space-y-5">
      {!embedded && <div>
        <p className="text-sm font-semibold text-navy-500">Partagé par l'équipe · selon les droits de chacun</p>
        <h1 className="text-2xl font-semibold text-navy-900">Fil de l'élève</h1>
      </div>}
      <Card>
        {!fixed && <div className="flex flex-col gap-2">
          {student && <p className="text-base"><strong className="text-navy-900">{student}</strong> · {classOf(student)}</p>}
          <label className="relative w-full text-xs text-slate-600">Rechercher un élève (nom, prénom ou classe)
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ex. Fitia, 1re STMG" className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
            {matches.length > 0 && (
              <ul className="absolute z-20 mt-1 w-full rounded-lg bg-white shadow-lg ring-1 ring-slate-200">
                {matches.map((m) => <li key={m.name}><button type="button" onClick={() => { setStudent(m.name); setQuery(''); }} className="flex w-full justify-between px-3 py-2 text-left text-sm hover:bg-slate-50"><span>{m.name}</span><span className="text-xs text-slate-600">{m.cls}</span></button></li>)}
              </ul>
            )}
          </label>
        </div>}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {['ALL', ...kinds].map((k) => (
            <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)} className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ${kind === k ? 'bg-navy-500 text-white ring-navy-500' : 'bg-white text-slate-700 ring-slate-300'}`}>{k === 'ALL' ? 'Tout' : KIND[k][1]}</button>
          ))}
        </div>
      </Card>
      {!student ? <Card><p className="text-sm text-slate-600">Cherchez un élève par son nom, son prénom ou sa classe.</p></Card> : (
      <Card title={`${events.length} événement${events.length > 1 ? 's' : ''}`} subtitle={health ? undefined : 'Les passages aux soins et le journal interne ne sont pas montrés aux enseignants.'}>
        {events.length === 0 ? <p className="text-sm text-slate-600">Rien à signaler pour cet élève ✓</p> : (
          <ol className="relative space-y-3 border-l border-slate-200 pl-4">
            {events.map((e) => (
              <li key={`${e.kind}-${e.id}`} className="relative">
                <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-navy-500 ring-2 ring-white" />
                <p className="text-xs text-slate-600">{fmt(e.at)}{e.by ? ` · ${e.by}` : ''}</p>
                <p className="text-sm text-slate-900"><Badge tone={KIND[e.kind][0]} className="mr-1.5">{KIND[e.kind][1]}</Badge>{e.text}</p>
              </li>
            ))}
          </ol>
        )}
      </Card>
      )}
    </div>
  );
}
