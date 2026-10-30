import React from 'react';
import { Badge, Button, Card, Icon } from './ui.jsx';
import { TEACHER } from '../data/people.js';
import { WEEK_SESSIONS, NOW } from '../data/attendance.js';
import { sessionState } from '../rules/attendance.js';
import { loadRecords } from './AttendanceModule.jsx';
import { setIntent } from '../navIntent.js';
import QuickEntry from './QuickEntry.jsx';

// « Ma journée » de l'enseignant : le cours en cours (appel), ce qu'il reste à faire, puis les cours du jour.
// L'appel se fait sur un seul écran (Appel), ouvert directement sur la bonne séance.
const h = (t) => t.replace(':', 'h');
const STATE_UI = { FAIT: ['green', 'Appel fait'], EN_COURS: ['red', 'Appel à faire'], OUBLIE: ['red', 'Appel oublié'], A_VENIR: ['slate', 'À venir'] };

export default function TeacherPortal({ go }) {
  const records = loadRecords();
  const stateOf = (s) => sessionState(s, NOW, records[s.id]);
  const today = WEEK_SESSIONS.filter((s) => s.date === NOW.date);
  const current = today.find((s) => stateOf(s) === 'EN_COURS');
  const forgotten = WEEK_SESSIONS.filter((s) => stateOf(s) === 'OUBLIE');
  const booking = (s) => TEACHER.today.find((x) => x.start === s.start && x.cls === s.cls)?.booking;
  const call = (s) => { setIntent('appel', { session: s.id }); go('appel'); };

  return (
    <div className="space-y-5 pb-16 sm:pb-0">
      <div>
        <p className="text-sm font-semibold text-navy-500">Ma journée</p>
        <h1 className="text-2xl font-semibold text-navy-900">Bonjour {TEACHER.name}</h1>
        <p className="text-sm text-slate-600">{TEACHER.subjects}</p>
      </div>

      {current && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-navy-900 p-5 text-white shadow-soft">
          <div><p className="text-xs uppercase tracking-wide text-navy-200">Cours en cours</p><p className="font-display text-lg font-semibold">{current.cls} · {current.subject}</p><p className="text-sm text-navy-100">{h(current.start)}–{h(current.end)} · {current.room}</p></div>
          <button type="button" onClick={() => call(current)} className="min-h-[44px] rounded-xl bg-white px-5 py-3 text-base font-semibold text-navy-900 shadow hover:bg-navy-50">Faire l'appel</button>
        </div>
      )}
      {forgotten.map((s) => (
        <div key={s.id} className="flex flex-col gap-2 rounded-2xl border-2 border-red-200 bg-red-50 p-3 text-sm text-red-900 sm:flex-row sm:items-center sm:justify-between">
          <span><strong>Appel oublié</strong> · {s.cls} · {s.subject}, {s.date === NOW.date ? 'aujourd\'hui' : `le ${s.date.slice(8, 10)}/${s.date.slice(5, 7)}`} {h(s.start)}–{h(s.end)}</span>
          <Button className="!py-1.5 text-sm" onClick={() => call(s)}>Faire maintenant</Button>
        </div>
      ))}

      <Card title="À faire">
        <ul className="space-y-2">
          {TEACHER.todo.map((t) => (
            <li key={t.label} className="flex items-start gap-3">
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${t.tone === 'amber' ? 'bg-amber-500' : 'bg-navy-500'}`} />
              <div><p className="text-sm font-medium text-slate-800">{t.label}</p><p className="text-xs text-slate-600">{t.detail}</p></div>
            </li>
          ))}
        </ul>
      </Card>

      <QuickEntry role="ENSEIGNANT" go={go} />

      <div className="grid gap-5 xl:grid-cols-[1fr_380px] xl:items-start">
        <Card title="Mes cours aujourd'hui">
          <ol className="space-y-2">
            {today.map((s) => {
              const st = stateOf(s);
              return (
                <li key={s.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 p-3">
                  <div className="w-28 shrink-0 whitespace-nowrap text-sm font-semibold tabular-nums text-navy-900">{h(s.start)}–{h(s.end)}</div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-900">{s.cls} · {s.subject}</p>
                    <p className="text-xs text-slate-600">{s.room}{booking(s) && ` · ${booking(s)} réservé`}</p>
                  </div>
                  <Badge tone={STATE_UI[st][0]}>{STATE_UI[st][1]}</Badge>
                  {/* tout part du cours : appel, cahier de textes, notes de la classe */}
                  <span className="flex w-full flex-wrap gap-1.5 sm:w-auto">
                    {st !== 'A_VENIR' && <Button variant={st === 'FAIT' ? 'secondary' : 'primary'} className="!py-1 text-xs" onClick={() => call(s)}><Icon name="check" />{st === 'FAIT' ? 'Corriger l\'appel' : 'Appel'}</Button>}
                    <Button variant="secondary" className="!py-1 text-xs" onClick={() => { setIntent('homework', { cls: s.cls, subject: s.subject }); go('homework'); }}><Icon name="calendar" />Cahier de textes</Button>
                    <Button variant="secondary" className="!py-1 text-xs" onClick={() => { setIntent('grades', { cls: s.cls, subject: s.subject }); go('grades'); }}><Icon name="pen" />Notes</Button>
                  </span>
                </li>
              );
            })}
          </ol>
        </Card>
        <Card title="Annonces aux professeurs">
          <ul className="space-y-3">
            {TEACHER.news.map((n) => (
              <li key={n.title}><p className="text-xs text-slate-600">{n.date}</p><p className="text-sm font-medium text-slate-800">{n.title}</p><p className="text-sm text-slate-600">{n.body}</p></li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
