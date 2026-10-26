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
import { FAMILIES, CASH_HISTORY, CASH_YEAR_OPENING } from '../data/accounting.js';
import { CASH_ACCOUNTS, duesStatus } from './CollectPayment.jsx';
import { realData } from '../demoData.js';
import { EXPENSES } from '../data/treasury.js';
import { loadMovements, counted } from '../cashStore.js';
import { accountStatement } from '../rules/accounting.js';
import { toTransactions, treasuryKpis, monthlyFlows } from '../rules/treasury.js';
import { formatAr } from '../rules/finance.js';

// Blocs des accueils Direction et Secrétariat, dans l'ordre voulu par la Direction :
// 1. l'école sur 7 ou 30 jours (chiffres cliquables) avec, à droite, ce qui est en cours ou à venir ;
// 2. « À faire » : décisions et tâches réunies ; 3. « Ce qui s'est passé » (ActivityJournal).

// « Mer. 14 oct. » : une ligne, pour que la liste reste courte
const compactDay = (iso) => { const d = new Date(`${iso}T12:00:00Z`); return `${['Dim.', 'Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.'][d.getUTCDay()]} ${d.getUTCDate()} ${['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'][d.getUTCMonth()]}`; };
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
    demandes: { label: 'Démarches des familles', list: loadRequests().requests, date: (r) => r.submittedAt ?? r.date ?? TODAY, to: ['eleves', { tab: 'online' }] },
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
export function UpcomingCard({ settings = DEFAULT_SETTINGS, go, max = 5 }) {
  const teacher = (id) => STAFF.find((x) => x.id === id)?.name ?? id;
  const events = [
    ...SCHOOL_EVENTS.map((e) => ({ ...e, tone: 'navy' })),
    ...closuresAsEvents(settings.calendar).map((e) => ({ ...e, tone: 'amber' })),
    ...upcomingColleSessions(loadPassport().colles, TODAY, 21).map((c) => ({ id: `colle-${c.day}`, date: c.day, start: c.from, title: `Colles : ${c.students} élève${c.students > 1 ? 's' : ''}`, tone: 'violet', to: 'vs' })),
    ...TEACHER_ABSENCES.map((a) => ({ id: `abs-${a.id}`, date: a.date, allDay: true, title: `Absence de ${teacher(a.teacherId)}`, tone: 'red', to: 'hours' })),
  ];
  const all = upcoming(events, TODAY, 21);
  const list = all.slice(0, max); // court : le reste est dans l'agenda
  return (
    <Card title="En cours et à venir" subtitle={all.length > max ? `${max} prochains sur ${all.length} (3 semaines)` : 'Les trois prochaines semaines'} action={<Button variant="secondary" className="!py-1 text-xs" onClick={() => go?.('agenda')}>Agenda ›</Button>}>
      {list.length === 0 ? <p className="text-sm text-slate-600">Rien de prévu.</p> : (
        <ul className="space-y-2">
          {list.map((e) => (
            <li key={e.id} className="flex gap-2 text-sm">
              <span className="w-[4.5rem] shrink-0 text-xs font-semibold text-slate-600">{e.date < TODAY ? 'En cours' : compactDay(e.date)}{!e.allDay && e.start ? <span className="block font-normal">{e.start.replace(':', 'h')}</span> : ''}</span>
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


/** Finances en un coup d'œil (Direction) : mêmes calculs que Caisse › Trésorerie, sans les salaires. */
export function FinanceCard({ go, settings }) {
  const real = realData() && settings;
  const tx = toTransactions({
    cash: [...CASH_HISTORY, ...counted(loadMovements())],
    expenses: EXPENSES,
    dues: real
      ? duesStatus(CASH_ACCOUNTS, settings, TODAY).map((x) => ({ id: x.account.id, amount: x.overdue, due: TODAY })).filter((d) => d.amount > 0)
      : FAMILIES.map((f) => ({ id: f.id, amount: accountStatement(f.lines).totals.balance, due: TODAY })).filter((d) => d.amount > 0),
  });
  const k = treasuryKpis(tx, realData() ? 0 : Object.values(CASH_YEAR_OPENING).reduce((a, b) => a + b, 0));
  const [m] = monthlyFlows(tx, [TODAY.slice(0, 7)]);
  const open = () => { setIntent('accounting', { tab: 'treasury' }); go?.('accounting'); };
  const tile = (label, value, tone) => (
    <button type="button" onClick={open} className="rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-navy-300 hover:shadow-sm">
      <span className="block text-xs font-medium text-slate-600">{label}</span>
      <span className={`mt-1 block font-display text-lg font-semibold tabular-nums ${tone}`}>{formatAr(value)}</span>
    </button>
  );
  return (
    <Card title="Finances" subtitle="Ce mois-ci et la trésorerie de l'année" action={<Button variant="secondary" className="!py-1 text-xs" onClick={open}>Trésorerie ›</Button>}>
      <div className="grid grid-cols-2 gap-2">
        {tile('Encaissé ce mois', m.in, 'text-emerald-700')}
        {tile('Dépensé ce mois', m.out, 'text-slate-900')}
        {tile('Trésorerie nette', k.net, k.net < 0 ? 'text-red-700' : 'text-navy-900')}
        {tile('Reste à recouvrer', k.toCollect, 'text-amber-700')}
      </div>
      <p className="mt-2 text-xs text-slate-600">Salaires du mois : dans Caisse › Salaires.</p>
    </Card>
  );
}
