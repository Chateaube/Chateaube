import React, { useMemo, useState } from 'react';
import { Badge, Button, Card } from './ui.jsx';
import { AGENDAS, agendaItems, toIcs } from '../rules/agenda.js';
import { SCHOOL_EVENTS } from '../data/events.js';
import { TIMETABLE } from '../data/timetable.js';
import { plannedSessions } from '../rules/teachingHours.js';
import { DEFAULT_SETTINGS } from '../data/settings.js';
import { HOMEWORK } from '../data/homework.js';
import { saveFile } from '../download.js';
import { formatDateFr } from '../rules/calendar.js';
import { applyChanges } from '../rules/timetableChanges.js';
import { loadChanges } from './TimetableChanges.jsx';

// Agendas : cours, événements de l'école, devoirs — séparés, à afficher ensemble ou non, et à
// ajouter dans Google Agenda ou Apple Agenda (.ics ; avec le serveur, lien d'abonnement).

const CLASSES = ['1re STMG', 'Terminale STMG', 'Terminale Générale', '2de', '5e'];
const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);

export default function AgendaModule({ role, cls: fixedCls, settings }) {
  const staff = ['DIRECTION', 'BUREAU', 'VIE_SCOLAIRE', 'ENSEIGNANT'].includes(role);
  const canAdd = ['DIRECTION', 'BUREAU', 'VIE_SCOLAIRE'].includes(role);
  const [cls, setCls] = useState(fixedCls ?? '');
  const [shown, setShown] = useState(Object.keys(AGENDAS));
  const [events, setEvents] = useState(SCHOOL_EVENTS);
  const [draft, setDraft] = useState(null);
  // cours des prochaines semaines, d'après l'emploi du temps (jours de classe), puis les changements
  const courses = useMemo(() => plannedSessions(role === 'ENSEIGNANT' ? TIMETABLE.filter((x) => x.teacherId === 'p1') : TIMETABLE, '2026-10-12', '2026-11-06', settings ?? DEFAULT_SETTINGS)
    .map((x) => ({ id: `${x.slotId}-${x.date}`, date: x.date, start: x.start, end: x.end, cls: x.cls, subject: x.subject, room: '' })), [role, settings]);
  const items = useMemo(() => agendaItems({ sessions: applyChanges(courses, loadChanges()), events, homework: HOMEWORK, cls: cls || null, staff }), [cls, events, staff, courses]);
  const visible = items.filter((i) => shown.includes(i.agenda));
  const days = [...new Set(visible.map((i) => i.date))];
  const exportIcs = (agenda) => saveFile(`agenda-${agenda.toLowerCase()}${cls ? `-${cls.replace(/\s+/g, '-')}` : ''}.ics`,
    toIcs(items.filter((i) => i.agenda === agenda), `Chateaubriand — ${AGENDAS[agenda].label}${cls ? ` — ${cls}` : ''}`));

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-semibold text-navy-500">{fixedCls ? fixedCls : 'Tamatave'}</p>
        <h1 className="text-2xl font-semibold text-navy-900">Agendas</h1>
        <p className="text-sm text-slate-500">Trois agendas séparés : les cours, les événements de l'école et les devoirs. Affichez ceux qui vous intéressent, ou ajoutez-les à Google Agenda ou Apple Agenda.</p>
      </div>
      <Card>
        <div className="flex flex-wrap items-center gap-2">
          {!fixedCls && (
            <select value={cls} onChange={(e) => setCls(e.target.value)} aria-label="Classe" className="rounded-md border border-slate-300 px-2 py-1.5 text-sm">
              <option value="">Toutes les classes</option>{CLASSES.map((c) => <option key={c}>{c}</option>)}
            </select>
          )}
          {Object.entries(AGENDAS).map(([k, a]) => (
            <button key={k} type="button" aria-pressed={shown.includes(k)} onClick={() => setShown(shown.includes(k) ? shown.filter((x) => x !== k) : [...shown, k])}
              className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ${shown.includes(k) ? 'bg-navy-500 text-white ring-navy-500' : 'bg-white text-slate-600 ring-slate-300'}`}>{a.label}</button>
          ))}
          {canAdd && <Button variant="secondary" className="ml-auto" onClick={() => setDraft({ title: '', date: '2026-10-20', start: '16:00', end: '17:00', place: '', cls: '', staffOnly: false })}>＋ Événement</Button>}
        </div>
        {draft && (
          <div className="mt-3 grid gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-2 lg:grid-cols-3">
            <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Titre (ex. Réunion parents-professeurs)" className="rounded-md border border-slate-300 px-2 py-1.5 text-sm lg:col-span-2" />
            <input value={draft.place} onChange={(e) => setDraft({ ...draft, place: e.target.value })} placeholder="Lieu" className="rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
            <input type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} className="rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
            <span className="flex gap-2"><input type="time" value={draft.start} onChange={(e) => setDraft({ ...draft, start: e.target.value })} className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" /><input type="time" value={draft.end} onChange={(e) => setDraft({ ...draft, end: e.target.value })} className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" /></span>
            <select value={draft.cls} onChange={(e) => setDraft({ ...draft, cls: e.target.value })} className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"><option value="">Toute l'école</option>{CLASSES.map((c) => <option key={c}>{c}</option>)}</select>
            <label className="flex items-center gap-1.5 text-sm text-slate-600"><input type="checkbox" checked={draft.staffOnly} onChange={(e) => setDraft({ ...draft, staffOnly: e.target.checked })} />Personnel seulement</label>
            <span className="flex gap-2">
              <Button disabled={!draft.title.trim()} onClick={() => { setEvents([...events, { id: `n${Date.now()}`, ...draft, title: draft.title.trim(), classes: draft.cls ? [draft.cls] : [] }]); setDraft(null); }}>Ajouter</Button>
              <Button variant="secondary" onClick={() => setDraft(null)}>Annuler</Button>
            </span>
          </div>
        )}
      </Card>

      <div className="grid gap-5 xl:grid-cols-[1fr_320px] xl:items-start">
        <Card title="Prochains jours">
          {days.length === 0 && <p className="text-sm text-slate-500">Rien à afficher.</p>}
          <div className="space-y-4">
            {days.map((d) => (
              <div key={d}>
                <p className="mb-1 text-xs font-semibold text-slate-500">{cap(formatDateFr(d))}</p>
                <ul className="space-y-1.5">
                  {visible.filter((i) => i.date === d).map((i) => (
                    <li key={i.id} className="flex items-start gap-3 rounded-lg border border-slate-100 px-3 py-2 text-sm">
                      <span className="w-24 shrink-0 tabular-nums text-slate-600">{i.allDay ? 'journée' : `${i.start.replace(':', 'h')}–${(i.end ?? '').replace(':', 'h')}`}</span>
                      <span className={`min-w-0 flex-1 ${i.status === 'ANNULE' ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{i.title}{i.place && <span className="block text-xs text-slate-500">{i.place}</span>}</span>
                      <Badge tone={AGENDAS[i.agenda].tone}>{AGENDAS[i.agenda].label}</Badge>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Card>
        <Card title="Dans Google Agenda ou Apple Agenda" subtitle="Un fichier par agenda, à ouvrir sur le téléphone ou l'ordinateur">
          <div className="space-y-2">
            {Object.entries(AGENDAS).map(([k, a]) => <Button key={k} variant="secondary" className="w-full" onClick={() => exportIcs(k)}>Ajouter « {a.label} »</Button>)}
          </div>
          <p className="mt-3 text-xs text-slate-500">Avec le serveur, chaque agenda aura un lien d'abonnement : il se met à jour tout seul dans Google Agenda ou Apple Agenda quand un cours, un événement ou un devoir change.</p>
        </Card>
      </div>
    </div>
  );
}
