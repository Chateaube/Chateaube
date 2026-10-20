import React, { useState } from 'react';
import { Badge, Card } from './ui.jsx';
import { ACTIVITY_KINDS, journal, byPerson, byDay } from '../rules/activity.js';
import { loadJournal, DEMO_TODAY } from '../activityStore.js';
import { classOf } from '../data/schoollife.js';
import { formatDateFr } from '../rules/calendar.js';

// « Ce qui s'est passé » : qui a fait quoi aujourd'hui ou cette semaine, pour les élèves et les professeurs.
// Accueils de la Direction, du secrétariat et de la CPE : chacun voit le travail des autres.
const ROLE = { DIRECTION: 'Direction', BUREAU: 'Secrétariat', VIE_SCOLAIRE: 'CPE', ENSEIGNANT: 'Professeur' };
const TONE = { PUNITION: 'red', COLLE: 'amber', OBJET: 'amber', ABSENCE: 'navy', JUSTIF: 'green', PARENTS: 'green', SOIN: 'violet', SORTIE: 'violet', OUBLI: 'slate', APPEL: 'slate', PROF: 'navy' };

export default function ActivityJournal({ today = DEMO_TODAY }) {
  const [period, setPeriod] = useState('JOUR');
  const [who, setWho] = useState('');
  const [kind, setKind] = useState('');
  const all = journal(loadJournal(), { today, period });
  const people = byPerson(all);
  const rows = all.filter((e) => (!who || e.who === who) && (!kind || e.kind === kind));
  const field = 'rounded-md border border-slate-300 bg-white px-2 py-1 text-sm';
  return (
    <Card title="Ce qui s'est passé" subtitle="Qui a fait quoi pour les élèves et les professeurs (sans la caisse)"
      action={<div className="inline-flex rounded-lg bg-slate-100 p-1">{[['JOUR', 'Aujourd\'hui'], ['SEMAINE', '7 derniers jours']].map(([k, l]) => (
        <button key={k} type="button" aria-pressed={period === k} onClick={() => setPeriod(k)} className={`rounded-md px-2.5 py-1 text-xs font-medium ${period === k ? 'bg-white text-navy-900 shadow-sm' : 'text-slate-600'}`}>{l}</button>
      ))}</div>}>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {people.map((p) => (
          <button key={p.who} type="button" aria-pressed={who === p.who} onClick={() => setWho(who === p.who ? '' : p.who)}
            title={Object.entries(p.kinds).map(([k, n]) => `${ACTIVITY_KINDS[k]} : ${n}`).join(' · ')}
            className={`rounded-full px-2.5 py-1 text-xs ring-1 ${who === p.who ? 'bg-navy-500 text-white ring-navy-500' : 'bg-white text-slate-700 ring-slate-300'}`}>
            {p.who} <span className="font-semibold">{p.total}</span>
          </button>
        ))}
        {!people.length && <p className="text-sm text-slate-600">Rien d'enregistré {period === 'JOUR' ? 'aujourd\'hui' : 'cette semaine'}.</p>}
      </div>
      {all.length > 0 && (
        <label className="mb-2 block text-xs text-slate-600">Type
          <select value={kind} onChange={(e) => setKind(e.target.value)} className={`ml-2 ${field}`}>
            <option value="">Tout</option>
            {Object.entries(ACTIVITY_KINDS).filter(([k]) => all.some((e) => e.kind === k)).map(([k, l]) => <option key={k} value={k}>{l} ({all.filter((e) => e.kind === k).length})</option>)}
          </select>
        </label>
      )}
      <div tabIndex={0} role="region" aria-label="Journal de la période" className="max-h-[28rem] space-y-3 overflow-y-auto pr-1">
        {byDay(rows).map(([d, list]) => (
          <div key={d}>
            {period === 'SEMAINE' && <p className="mb-1 text-xs font-semibold text-slate-600">{formatDateFr(d)}</p>}
            <ul className="divide-y divide-slate-100 text-sm">
              {list.map((e) => (
                <li key={e.id} className="flex flex-wrap items-start gap-x-3 gap-y-0.5 py-1.5">
                  <span className="w-11 shrink-0 tabular-nums text-xs text-slate-600">{e.at.slice(11, 16).replace(':', 'h')}</span>
                  <span className="min-w-0 flex-1">
                    <span className="text-slate-900">{e.text}</span>
                    {e.student && <span className="text-slate-600"> — {e.student}{classOf(e.student) ? ` (${classOf(e.student)})` : ''}</span>}
                    <span className="block text-xs text-slate-600">{e.who} · {ROLE[e.role] ?? ''}</span>
                  </span>
                  <Badge tone={TONE[e.kind] ?? 'slate'}>{ACTIVITY_KINDS[e.kind]}</Badge>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Card>
  );
}
