import React, { useState } from 'react';
import TodoList from './TodoList.jsx';
import { Badge, Button, Card, Icon } from './ui.jsx';
import { TEACHER, CLASS_LIST } from '../data/people.js';

const h = (t) => t.replace(':', 'h');
const APPEL_UI = { FAIT: ['green', 'Appel fait'], A_FAIRE: ['amber', 'Appel à faire'], A_VENIR: ['slate', 'À venir'] };
const MARKS = [['P', 'Présent.e', 'bg-emerald-600'], ['R', 'Retard', 'bg-amber-500'], ['A', 'Absent.e', 'bg-red-600']];

/** Appel d'une séance ; retards et absences peuvent être notifiés aux parents en un clic. */
function Attendance({ slot, onDone }) {
  const [marks, setMarks] = useState(() => Object.fromEntries(CLASS_LIST.map((n) => [n, 'P'])));
  const [notify, setNotify] = useState(true);
  const flagged = Object.entries(marks).filter(([, m]) => m !== 'P');
  return (
    <Card title={`Appel — ${slot.cls}`} subtitle={`${slot.subject} · ${h(slot.start)}–${h(slot.end)} · ${slot.room}`}>
      <ul className="divide-y divide-slate-100">
        {CLASS_LIST.map((n) => (
          <li key={n} className="flex items-center justify-between gap-2 py-1.5">
            <span className="text-sm text-slate-800">{n}</span>
            <div className="flex gap-1" role="radiogroup" aria-label={n}>
              {MARKS.map(([k, label, on]) => (
                <button key={k} role="radio" aria-checked={marks[n] === k} title={label} onClick={() => setMarks({ ...marks, [n]: k })}
                  className={`h-8 w-8 rounded-md text-xs font-bold ${marks[n] === k ? `${on} text-white` : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                  {k}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>
      <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
        Prévenir les parents (e-mail + application, {flagged.length} élève{flagged.length > 1 ? 's' : ''})
      </label>
      <Button className="mt-3 w-full" onClick={() => onDone(flagged.length, notify)}>Valider l'appel</Button>
    </Card>
  );
}

export default function TeacherPortal({ go }) {
  const [slots, setSlots] = useState(TEACHER.today);
  const [open, setOpen] = useState(null);
  const [toast, setToast] = useState(null);
  const current = slots.find((s) => s.appel === 'A_FAIRE');

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-semibold text-navy-500">Ma journée</p>
        <h1 className="text-2xl font-semibold text-navy-900">Bonjour {TEACHER.name}</h1>
        <p className="text-sm text-slate-500">{TEACHER.subjects} · {TEACHER.site}</p>
      </div>

      {current && !open && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-navy-900 p-5 text-white shadow-soft">
          <div><p className="text-xs uppercase tracking-wide text-navy-200">Cours en cours</p><p className="font-display text-lg font-semibold">{current.cls} · {current.subject}</p><p className="text-sm text-navy-100">{h(current.start)}–{h(current.end)} · {current.room}</p></div>
          <button type="button" onClick={() => (go ? go('appel') : setOpen(current))} className="rounded-xl bg-white px-5 py-3 text-base font-semibold text-navy-900 shadow hover:bg-navy-50">Faire l'appel</button>
        </div>
      )}
      <TodoList who="ENSEIGNANT" title="Tâches confiées par la Direction" />
      {toast && <p role="status" className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800"><Icon name="check" />{toast}</p>}

      <div className="grid gap-5 xl:grid-cols-[1fr_380px] xl:items-start">
        <div className="min-w-0 space-y-5">
          <Card title="Mes cours aujourd'hui">
            <ol className="space-y-2">
              {slots.map((s) => (
                <li key={s.start} className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 p-3">
                  <div className="w-28 shrink-0 whitespace-nowrap text-sm font-semibold tabular-nums text-navy-900">{h(s.start)}–{h(s.end)}</div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-900">{s.cls} · {s.subject}</p>
                    <p className="text-xs text-slate-500">{s.room}{s.booking && ` · ${s.booking} réservé`}</p>
                  </div>
                  <Badge tone={APPEL_UI[s.appel][0]}>{APPEL_UI[s.appel][1]}</Badge>
                  {s.appel === 'A_FAIRE' && <Button variant="secondary" onClick={() => setOpen(s)}>Appel</Button>}
                </li>
              ))}
            </ol>
          </Card>
          <Card title="À faire">
            <ul className="space-y-2">
              {TEACHER.todo.map((t) => (
                <li key={t.label} className="flex items-start gap-3">
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${t.tone === 'amber' ? 'bg-amber-500' : 'bg-navy-500'}`} />
                  <div><p className="text-sm font-medium text-slate-800">{t.label}</p><p className="text-xs text-slate-500">{t.detail}</p></div>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => go('grades')}><Icon name="pen" />Notes & appréciations</Button>
              <Button variant="secondary" onClick={() => go('booking')}><Icon name="calendar" />Réserver du matériel</Button>
            </div>
          </Card>
        </div>
        <div className="space-y-5">
          {open && (
            <Attendance slot={open} onDone={(n, notified) => {
              setSlots(slots.map((s) => (s === open ? { ...s, appel: 'FAIT' } : s)));
              setToast(`Appel enregistré pour ${open.cls}${n ? ` · ${n} absence(s)/retard(s)${notified ? ', parents prévenus' : ''}` : ''}.`);
              setOpen(null);
            }} />
          )}
          <Card title="Annonces aux professeurs">
            <ul className="space-y-3">
              {TEACHER.news.map((n) => (
                <li key={n.title}><p className="text-xs text-slate-500">{n.date}</p><p className="text-sm font-medium text-slate-800">{n.title}</p><p className="text-sm text-slate-600">{n.body}</p></li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
