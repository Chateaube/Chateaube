import React, { useState } from 'react';
import { Badge, Button, Card } from './ui.jsx';
import TodoList from './TodoList.jsx';
import { loadAttendance } from '../attendanceStore.js';
import { loadObjects } from '../objectsStore.js';
import { loadVisits } from '../careStore.js';
import { loadRequests } from '../requestsStore.js';
import { loadPassport } from './PassportTab.jsx';
import { MEASURES_LOG } from '../data/schoollife.js';
import { SCHOOL_EVENTS } from '../data/events.js';
import { TEACHER_ABSENCES } from '../data/timetable.js';
import { STAFF } from '../data/people.js';
import { DEFAULT_SETTINGS } from '../data/settings.js';
import { closuresAsEvents } from '../rules/agenda.js';
import { upcomingColleSessions } from '../rules/discipline.js';
import { pulse, trend, upcoming } from '../rules/schoolPulse.js';
import { formatDateFr } from '../rules/calendar.js';
import { notificationsFor, TODAY } from '../notify.js';
import { setIntent } from '../navIntent.js';

// Blocs des accueils Direction et Secrétariat, dans l'ordre voulu par la Direction :
// 1. l'école sur 7 ou 30 jours (chiffres cliquables) avec, à droite, ce qui est en cours ou à venir ;
// 2. « À faire » : décisions et tâches réunies ; 3. « Ce qui s'est passé » (ActivityJournal).

const shortDay = (iso) => { const t = formatDateFr(iso).replace(/ \d{4}$/, ''); return t.charAt(0).toUpperCase() + t.slice(1); };

/** Indicateurs de vie scolaire (mêmes calculs que les écrans qu'ils ouvrent). */
function series() {
  const att = loadAttendance();
  return {
    absences: { label: 'Absences', list: att, date: (a) => a.date, keep: (a) => a.kind === 'ABSENCE', to: ['vs', { tab: 'attendance', filter: 'ALL' }] },
    retards: { label: 'Retards', list: att, date: (a) => a.date, keep: (a) => a.kind === 'RETARD', to: ['vs', { tab: 'attendance', filter: 'ALL' }] },
    justifs: { label: 'Justifications des familles', list: att.filter((a) => a.request), date: (a) => a.request.at, to: ['vs', { tab: 'attendance', filter: 'REQUESTS' }] },
    mesures: { label: 'Punitions et sanctions', list: MEASURES_LOG, date: (m) => m.date, to: ['vs', { tab: 'measures' }] },
    colles: { label: 'Colles données', list: loadPassport().colles, date: (c) => c.date, to: ['vs', { tab: 'passport' }] },
    objets: { label: 'Objets confisqués', list: loadObjects(), date: (p) => p.at, keep: (p) => p.action !== 'AVERTISSEMENT', to: ['vs', { tab: 'phones' }] },
    soins: { label: 'Passages aux soins', list: loadVisits(), date: (v) => v.at, to: ['care'] },
    demandes: { label: 'Démarches des familles', list: loadRequests().requests, date: (r) => r.submittedAt ?? r.date ?? TODAY, to: ['enrol'] },
  };
}

/** « L'école sur 7 / 30 jours » : chaque chiffre ouvre sa liste ; à côté, l'évolution. */
export function PulseCard({ go, only }) {
  const [days, setDays] = useState(7);
  const s = series();
  const ids = (only ?? Object.keys(s)).filter((k) => s[k]);
  const p = pulse(Object.fromEntries(ids.map((k) => [k, s[k]])), TODAY, days);
  const open = ([screen, intent]) => { if (intent) setIntent(screen, intent); go?.(screen); };
  return (
    <Card title={`L'école sur ${days} jours`} subtitle="Chaque chiffre ouvre la liste qui l'explique · entre parenthèses, l'écart avec la période précédente"
      action={<div className="inline-flex rounded-lg bg-slate-100 p-1">{[7, 30].map((d) => (
        <button key={d} type="button" aria-pressed={days === d} onClick={() => setDays(d)} className={`rounded-md px-2.5 py-1 text-xs font-medium ${days === d ? 'bg-white text-navy-900 shadow-sm' : 'text-slate-600'}`}>{d} jours</button>
      ))}</div>}>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {ids.map((k) => (
          <button key={k} type="button" onClick={() => open(s[k].to)} className="rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-navy-300 hover:shadow-sm">
            <span className="block text-xs font-medium text-slate-600">{s[k].label}</span>
            <span className="mt-1 flex items-baseline gap-1.5"><span className="font-display text-2xl font-semibold tabular-nums text-navy-900">{p[k].now}</span><span className="text-xs text-slate-600">({trend(p[k])})</span></span>
          </button>
        ))}
      </div>
    </Card>
  );
}

/** En cours et à venir (3 semaines) : événements de l'école, vacances, colles, absences de professeurs. */
export function UpcomingCard({ settings = DEFAULT_SETTINGS, go }) {
  const teacher = (id) => STAFF.find((x) => x.id === id)?.name ?? id;
  const events = [
    ...SCHOOL_EVENTS.map((e) => ({ ...e, tone: 'navy' })),
    ...closuresAsEvents(settings.calendar).map((e) => ({ ...e, tone: 'amber' })),
    ...upcomingColleSessions(loadPassport().colles, TODAY, 21).map((c) => ({ id: `colle-${c.day}`, date: c.day, start: c.from, title: `Colles : ${c.students} élève${c.students > 1 ? 's' : ''}`, tone: 'violet', to: 'vs' })),
    ...TEACHER_ABSENCES.map((a) => ({ id: `abs-${a.id}`, date: a.date, allDay: true, title: `Absence de ${teacher(a.teacherId)}`, tone: 'red', to: 'hours' })),
  ];
  const list = upcoming(events, TODAY, 21).slice(0, 9);
  return (
    <Card title="En cours et à venir" subtitle="Les trois prochaines semaines" action={<Button variant="secondary" className="!py-1 text-xs" onClick={() => go?.('agenda')}>Agenda ›</Button>}>
      {list.length === 0 ? <p className="text-sm text-slate-600">Rien de prévu.</p> : (
        <ul className="space-y-2">
          {list.map((e) => (
            <li key={e.id} className="flex gap-3 text-sm">
              <span className="w-24 shrink-0 text-xs font-semibold text-slate-600">{e.date < TODAY ? 'En cours' : shortDay(e.date)}{!e.allDay && e.start ? <span className="block font-normal">{e.start.replace(':', 'h')}</span> : ''}</span>
              <span className="min-w-0 flex-1 text-slate-900">{e.title}{e.place && <span className="block text-xs text-slate-600">{e.place}</span>}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** « À faire » : les urgences, les décisions et les tâches réunies, chacune avec son bouton. */
export function TodoCard({ role, account, go, extra = [] }) {
  const n = notificationsFor(role, { account });
  const items = [...n.urgent.map((x) => ({ ...x, urgent: true })), ...extra, ...n.todo.filter((x) => x.id !== 'tasks')]; // les tâches sont listées juste en dessous
  return (
    <Card title={`À faire (${items.length})`} subtitle="Décisions, demandes et tâches, du plus urgent au moins urgent">
      {items.length > 0 && (
        <ul className="mb-3 divide-y divide-slate-100">
          {items.map((d) => (
            <li key={d.id} className="flex flex-col gap-1.5 py-2.5 sm:flex-row sm:items-center sm:justify-between">
              <span className={`text-sm ${d.urgent ? 'font-semibold text-red-800' : 'text-slate-800'}`}>{d.urgent && '⚠ '}{d.text}</span>
              {d.to && <Button variant={d.urgent ? 'primary' : 'secondary'} className="!py-1 text-xs sm:shrink-0" onClick={() => { if (d.intent) setIntent(d.to, d.intent); go?.(d.to); }}>{d.action ?? 'Voir'}</Button>}
            </li>
          ))}
        </ul>
      )}
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-600">Tâches</p>
      <TodoList who={role} bare />
    </Card>
  );
}

/** Bloc « À savoir » : informations sans action (pas de bouton). */
export function InfoCard({ items }) {
  if (!items.length) return null;
  return (
    <Card title="À savoir">
      <ul className="space-y-1.5 text-sm text-slate-700">{items.map((t) => <li key={t} className="flex gap-2"><Badge tone="slate">info</Badge><span>{t}</span></li>)}</ul>
    </Card>
  );
}

