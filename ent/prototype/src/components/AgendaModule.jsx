import React, { useMemo, useState } from 'react';
import { Badge, Button, Card } from './ui.jsx';
import { AGENDAS, agendaItems, agendasFor, closuresAsEvents, isExamClass, toIcs } from '../rules/agenda.js';
import { SCHOOL_EVENTS } from '../data/events.js';
import { TIMETABLE } from '../data/timetable.js';
import { plannedSessions } from '../rules/teachingHours.js';
import { DEFAULT_SETTINGS } from '../data/settings.js';
import { HOMEWORK } from '../data/homework.js';
import { saveFile } from '../download.js';
import { formatDateFr } from '../rules/calendar.js';
import { applyChanges } from '../rules/timetableChanges.js';
import { loadChanges } from './TimetableChanges.jsx';
import { loadEventProposals, saveEventProposal } from '../studentInitiativesStore.js';
import { approve, sendBack, trail } from '../rules/publication.js';

// Événements proposés par le BDE : ils n'entrent au calendrier de l'école qu'une fois publiés par la Direction.
const publishedProposals = () => loadEventProposals().filter((e) => e.status === 'PUBLIEE').map((e) => ({ id: e.id, agenda: 'ECOLE', date: e.date, start: e.start, end: e.end, title: `${e.title} (BDE)`, place: e.place, classes: [] }));

function ProposalReview({ onChange }) {
  const [list, setList] = useState(() => loadEventProposals().filter((e) => e.status === 'EN_ATTENTE'));
  const [notes, setNotes] = useState({});
  const [err, setErr] = useState('');
  if (!list.length) return null;
  const actor = { role: 'DIRECTION', name: 'Direction', at: new Date().toISOString().slice(0, 16) };
  const run = (e, fn) => { try { saveEventProposal(fn(e)); setList(list.filter((x) => x.id !== e.id)); onChange(); } catch (x) { setErr(x.message); } };
  return (
    <Card title="Événements proposés par le BDE — à valider">
      {err && <p className="mb-2 text-sm text-red-700">{err}</p>}
      <ul className="space-y-2">{list.map((e) => (
        <li key={e.id} className="rounded-xl border border-amber-200 bg-amber-50/40 p-3 text-sm">
          <p className="font-semibold text-slate-900">{e.title}</p>
          <p className="text-slate-700">{e.date.split('-').reverse().join('/')} · {e.start.replace(':', 'h')}–{e.end.replace(':', 'h')}{e.place && ` · ${e.place}`}</p>
          {e.text && <p className="text-slate-600">{e.text}</p>}
          <p className="mt-1 text-xs text-slate-500">{trail(e)}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button onClick={() => run(e, (x) => approve(x, actor))}>Publier au calendrier</Button>
            <input value={notes[e.id] ?? ''} onChange={(ev) => setNotes({ ...notes, [e.id]: ev.target.value })} placeholder="Remarque pour le BDE" aria-label="Remarque pour le BDE" className="min-w-0 flex-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
            <Button variant="secondary" disabled={!(notes[e.id] ?? '').trim()} onClick={() => run(e, (x) => sendBack(x, actor, notes[e.id].trim()))}>Renvoyer</Button>
          </div>
        </li>
      ))}</ul>
    </Card>
  );
}

// Agendas : cours, calendrier de l'école, classes d'examen, équipe, devoirs — séparés, à afficher ensemble ou non, et à
// ajouter dans Google Agenda ou Apple Agenda (.ics ; avec le serveur, lien d'abonnement).

const CLASSES = ['5e', '4e', '3e', '2de', '1re STMG', '1re Générale', 'Terminale STMG', 'Terminale Générale'];
const START = '2026-10-12';
const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);

/** Version téléphone (parents, élèves) : une bande de dates, puis le programme du jour choisi. */
function DayAgenda({ visible, shown, setShown, available, today }) {
  const dates = [...new Set(visible.filter((i) => i.date >= today).map((i) => i.date))].slice(0, 30);
  const [day, setDay] = useState(dates[0]);
  const list = visible.filter((i) => i.date === day);
  const short = (iso) => formatDateFr(iso).split(' ');
  return (
    <div className="space-y-3">
      <h1 className="px-1 font-display text-lg font-semibold text-navy-900">Agenda</h1>
      <div className="flex flex-wrap gap-1.5">
        {available.map((k) => (
          <button key={k} type="button" aria-pressed={shown.includes(k)} onClick={() => setShown(shown.includes(k) ? shown.filter((x) => x !== k) : [...shown, k])}
            className={`rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ${shown.includes(k) ? 'bg-navy-500 text-white ring-navy-500' : 'bg-white text-slate-600 ring-slate-300'}`}>{AGENDAS[k].label}</button>
        ))}
      </div>
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Jours">
        {dates.map((d) => {
          const [wd, n, m] = short(d);
          return (
            <button key={d} type="button" role="tab" aria-selected={d === day} onClick={() => setDay(d)}
              className={`flex w-14 shrink-0 flex-col items-center rounded-xl py-1.5 text-[11px] ${d === day ? 'bg-navy-900 text-white' : 'bg-white text-slate-600 shadow-soft'}`}>
              <span>{wd.slice(0, 3)}.</span><span className="text-base font-semibold">{n}</span><span>{m.slice(0, 4)}</span>
            </button>
          );
        })}
      </div>
      <div className="rounded-2xl bg-white p-3 shadow-soft">
        <p className="mb-2 text-xs font-semibold text-slate-500">{day ? cap(formatDateFr(day)) : 'Rien de prévu'}</p>
        <ul className="space-y-1.5">
          {list.map((i) => (
            <li key={i.id} className="flex items-start gap-2 rounded-lg border border-slate-100 px-2.5 py-2 text-sm">
              <span className="w-[86px] shrink-0 whitespace-nowrap text-xs tabular-nums text-slate-600">{i.allDay ? 'journée' : `${i.start.replace(':', 'h')}–${(i.end ?? '').replace(':', 'h')}`}</span>
              <span className={`min-w-0 flex-1 ${i.status === 'ANNULE' ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{i.title}{i.place && <span className="block text-xs text-slate-500">{i.place}</span>}</span>
              <Badge tone={AGENDAS[i.agenda].tone}>{AGENDAS[i.agenda].label}</Badge>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default function AgendaModule({ role, cls: fixedCls, settings, compact = false, today = '2026-10-13' }) {
  const staff = ['DIRECTION', 'BUREAU', 'VIE_SCOLAIRE', 'ENSEIGNANT'].includes(role);
  const canAdd = ['DIRECTION', 'BUREAU'].includes(role); // la CPE consulte
  const [cls, setCls] = useState(fixedCls ?? '');
  const available = agendasFor({ staff, cls: cls || null });
  const [shown, setShown] = useState(Object.keys(AGENDAS));
  const [events, setEvents] = useState(() => [...SCHOOL_EVENTS, ...publishedProposals()]);
  const [draft, setDraft] = useState(null);
  // cours des prochaines semaines, d'après l'emploi du temps (jours de classe), puis les changements
  const courses = useMemo(() => plannedSessions(role === 'ENSEIGNANT' ? TIMETABLE.filter((x) => x.teacherId === 'p1') : TIMETABLE, '2026-10-12', '2026-11-06', settings ?? DEFAULT_SETTINGS)
    .map((x) => ({ id: `${x.slotId}-${x.date}`, date: x.date, start: x.start, end: x.end, cls: x.cls, subject: x.subject, room: '' })), [role, settings]);
  const closures = useMemo(() => closuresAsEvents((settings ?? DEFAULT_SETTINGS).calendar), [settings]);
  const items = useMemo(() => agendaItems({ sessions: applyChanges(courses, loadChanges()), events: [...closures, ...events], homework: HOMEWORK, cls: cls || null, staff })
    .filter((i) => (i.allDay && i.end?.length === 10 ? i.end : i.date) >= START), [cls, events, staff, courses, closures]);
  const visible = items.filter((i) => shown.includes(i.agenda) && available.includes(i.agenda));
  const days = [...new Set(visible.map((i) => i.date))];
  const exportIcs = (agenda) => saveFile(`agenda-${agenda.toLowerCase()}${cls ? `-${cls.replace(/\s+/g, '-')}` : ''}.ics`,
    toIcs(items.filter((i) => i.agenda === agenda), `Chateaubriand — ${AGENDAS[agenda].label}${cls ? ` — ${cls}` : ''}`));

  if (compact) return <DayAgenda visible={visible} shown={shown} setShown={setShown} available={available} today={today} />;
  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-semibold text-navy-500">{fixedCls ? fixedCls : 'Tamatave'}</p>
        <h1 className="text-2xl font-semibold text-navy-900">Agendas</h1>
        <p className="text-sm text-slate-500">Des agendas séparés : les cours, le calendrier de l'école (vacances, jours fériés, réunions){available.includes('EXAMENS') ? ', les classes d\'examen' : ''}{available.includes('EQUIPE') ? ', l\'équipe (arrêts des notes, conseils, portes ouvertes)' : ''} et les devoirs. Affichez ceux qui vous intéressent, ou ajoutez-les à Google Agenda ou Apple Agenda.</p>
      </div>
      <Card>
        <div className="flex flex-wrap items-center gap-2">
          {!fixedCls && (
            <select value={cls} onChange={(e) => setCls(e.target.value)} aria-label="Classe" className="rounded-md border border-slate-300 px-2 py-1.5 text-sm">
              <option value="">Toutes les classes</option>{CLASSES.map((c) => <option key={c}>{c}</option>)}
            </select>
          )}
          {available.map((k) => [k, AGENDAS[k]]).map(([k, a]) => (
            <button key={k} type="button" title={a.hint} aria-pressed={shown.includes(k)} onClick={() => setShown(shown.includes(k) ? shown.filter((x) => x !== k) : [...shown, k])}
              className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ${shown.includes(k) ? 'bg-navy-500 text-white ring-navy-500' : 'bg-white text-slate-600 ring-slate-300'}`}>{a.label}</button>
          ))}
          {canAdd && <Button variant="secondary" className="ml-auto" onClick={() => setDraft({ title: '', date: '2026-10-20', start: '16:00', end: '17:00', place: '', cls: '', agenda: 'ECOLE' })}>＋ Événement</Button>}
        </div>
        {draft && (
          <div className="mt-3 grid gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-2 lg:grid-cols-3">
            <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Titre (ex. Réunion parents-professeurs)" className="rounded-md border border-slate-300 px-2 py-1.5 text-sm lg:col-span-2" />
            <input value={draft.place} onChange={(e) => setDraft({ ...draft, place: e.target.value })} placeholder="Lieu" className="rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
            <input type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} className="rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
            <span className="flex gap-2"><input type="time" value={draft.start} onChange={(e) => setDraft({ ...draft, start: e.target.value })} className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" /><input type="time" value={draft.end} onChange={(e) => setDraft({ ...draft, end: e.target.value })} className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" /></span>
            <select value={draft.agenda} onChange={(e) => setDraft({ ...draft, agenda: e.target.value, cls: '' })} aria-label="Agenda" className="rounded-md border border-slate-300 px-2 py-1.5 text-sm">{['ECOLE', 'EXAMENS', 'EQUIPE'].map((k) => <option key={k} value={k}>{AGENDAS[k].label} ({AGENDAS[k].hint})</option>)}</select>
            <select value={draft.cls} onChange={(e) => setDraft({ ...draft, cls: e.target.value })} aria-label="Classe concernée" className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"><option value="">{draft.agenda === 'EXAMENS' ? 'Toutes les classes d\'examen' : draft.agenda === 'EQUIPE' ? 'Tout le personnel' : 'Toute l\'école'}</option>{CLASSES.filter((c) => draft.agenda !== 'EXAMENS' || isExamClass(c)).map((c) => <option key={c}>{c}</option>)}</select>
            <span className="flex gap-2">
              <Button disabled={!draft.title.trim()} onClick={() => { setEvents([...events, { id: `n${Date.now()}`, ...draft, title: draft.title.trim(), classes: draft.cls ? [draft.cls] : draft.agenda === 'EXAMENS' ? CLASSES.filter(isExamClass) : [] }]); setDraft(null); }}>Ajouter</Button>
              <Button variant="secondary" onClick={() => setDraft(null)}>Annuler</Button>
            </span>
          </div>
        )}
      </Card>

      {role === 'DIRECTION' && <ProposalReview onChange={() => setEvents([...SCHOOL_EVENTS, ...publishedProposals()])} />}
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
            {available.map((k) => [k, AGENDAS[k]]).map(([k, a]) => <Button key={k} variant="secondary" className="w-full" onClick={() => exportIcs(k)}>Ajouter « {a.label} »</Button>)}
          </div>
          <p className="mt-3 text-xs text-slate-500">Avec le serveur, chaque agenda aura un lien d'abonnement : il se met à jour tout seul dans Google Agenda ou Apple Agenda quand un cours, un événement ou un devoir change.</p>
        </Card>
      </div>
    </div>
  );
}
