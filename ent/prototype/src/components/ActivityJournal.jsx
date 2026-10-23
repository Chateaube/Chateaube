import React, { useState } from 'react';
import { Badge, Card } from './ui.jsx';
import { ACTIVITY_KINDS, journal, byService } from '../rules/activity.js';
import { loadJournal, DEMO_TODAY } from '../activityStore.js';
import { classOf } from '../data/schoollife.js';
import { formatDateFr } from '../rules/calendar.js';
import { setIntent } from '../navIntent.js';

// « Ce qui s'est passé » : qui a fait quoi aujourd'hui ou sur 7 jours, pour les élèves et les professeurs.
// Regroupé par service : Direction, CPE, secrétariat, puis tous les enseignants ensemble.
const TONE = { PUNITION: 'red', COLLE: 'amber', OBJET: 'amber', ABSENCE: 'navy', JUSTIF: 'green', PARENTS: 'green', SOIN: 'violet', SORTIE: 'violet', OUBLI: 'slate', APPEL: 'slate', PROF: 'navy' };
const summary = (kinds) => Object.entries(kinds).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${n} ${(ACTIVITY_KINDS[k] ?? k).toLowerCase()}`).join(' · ');

// Accès direct depuis chaque ligne : l'écran concerné, et le fil de l'élève
const KIND_TO = { ABSENCE: ['vs', { tab: 'attendance' }], JUSTIF: ['vs', { tab: 'attendance' }], PARENTS: ['vs', { tab: 'attendance' }], PUNITION: ['vs', { tab: 'measures' }], COLLE: ['vs', { tab: 'passport' }], OUBLI: ['vs', { tab: 'passport' }], OBJET: ['vs', { tab: 'phones' }], SOIN: ['care'], SORTIE: ['vs', { tab: 'leave' }], PROF: ['hours'], SUIVI: ['eleves', { tab: 'suivis' }] };

export default function ActivityJournal({ today = DEMO_TODAY, go }) {
  const [period, setPeriod] = useState('JOUR');
  const groups = byService(journal(loadJournal(), { today, period }));
  return (
    <Card title="Ce qui s'est passé" subtitle="Par service : qui a fait quoi pour les élèves et les professeurs (sans la caisse)"
      action={<div className="inline-flex rounded-lg bg-slate-100 p-1">{[['JOUR', 'Aujourd\'hui'], ['SEMAINE', '7 derniers jours']].map(([k, l]) => (
        <button key={k} type="button" aria-pressed={period === k} onClick={() => setPeriod(k)} className={`rounded-md px-2.5 py-1 text-xs font-medium ${period === k ? 'bg-white text-navy-900 shadow-sm' : 'text-slate-600'}`}>{l}</button>
      ))}</div>}>
      {!groups.length && <p className="text-sm text-slate-600">Rien d'enregistré {period === 'JOUR' ? 'aujourd\'hui' : 'cette semaine'}.</p>}
      <div className="space-y-2">
        {groups.map((g) => (
          <details key={g.role} open={g.role !== 'ENSEIGNANT' || groups.length === 1} className="rounded-xl border border-slate-200 bg-white">
            <summary className="cursor-pointer list-none px-3 py-2">
              <span className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-sm font-semibold text-navy-900">{g.label} <span className="font-normal text-slate-600">— {g.list.length} action{g.list.length > 1 ? 's' : ''}{g.role === 'ENSEIGNANT' ? ` · ${g.people.length} professeur${g.people.length > 1 ? 's' : ''}` : ''}</span></span>
                <span className="text-xs text-slate-600">{summary(g.kinds)}</span>
              </span>
            </summary>
            <div tabIndex={0} role="region" aria-label={`Journal — ${g.label}`} className="max-h-72 overflow-y-auto border-t border-slate-100 px-3">
              <ul className="divide-y divide-slate-100 text-sm">
                {g.list.map((e) => (
                  <li key={e.id} className="flex flex-wrap items-start gap-x-3 gap-y-0.5 py-1.5">
                    <span className="w-full shrink-0 tabular-nums text-xs text-slate-600 sm:w-24">{period === 'SEMAINE' ? `${formatDateFr(e.at.slice(0, 10)).split(' ').slice(0, 2).join(' ')} ` : ''}{e.at.slice(11, 16).replace(':', 'h')}</span>
                    <span className="min-w-0 flex-1">
                      <span className="text-slate-900">{e.text}</span>
                      {e.student && <span className="text-slate-600"> — {e.student}{classOf(e.student) ? ` (${classOf(e.student)})` : ''}</span>}
                      <span className="block text-xs text-slate-600">{e.who} <span className="ml-1 sm:hidden"><Badge tone={TONE[e.kind] ?? 'slate'}>{ACTIVITY_KINDS[e.kind] ?? e.kind}</Badge></span></span>
                    </span>
                    <span className="hidden sm:block"><Badge tone={TONE[e.kind] ?? 'slate'}>{ACTIVITY_KINDS[e.kind] ?? e.kind}</Badge></span>
                    {go && (
                      <span className="flex basis-full gap-1.5 sm:basis-auto">
                        {KIND_TO[e.kind] && <button type="button" onClick={() => { const [to, intent] = KIND_TO[e.kind]; if (intent) setIntent(to, intent); go(to); }} className="rounded-md px-2 py-0.5 text-xs font-medium text-navy-700 ring-1 ring-slate-200 hover:bg-navy-50">Ouvrir</button>}
                        {e.student && <button type="button" onClick={() => { setIntent('eleves', { student: e.student, view: 'fil' }); go('eleves'); }} className="rounded-md px-2 py-0.5 text-xs font-medium text-navy-700 ring-1 ring-slate-200 hover:bg-navy-50">Fil de l'élève</button>}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </details>
        ))}
      </div>
    </Card>
  );
}
