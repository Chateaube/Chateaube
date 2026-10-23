import React, { useEffect, useState } from 'react';
import { Button, Card } from './ui.jsx';
import { loadTimetable, importedTimetable } from '../timetableStore.js';
import { DAY_NAMES } from '../rules/timetableImport.js';
import { weekLetter } from '../rules/teachingHours.js';
import { gridMarks, rowPos, strongMark, markLabel, layoutLanes, shortSubject, subjectColor, RECESS, LUNCH } from '../rules/timetableGrid.js';
import { STAFF } from '../data/people.js';
import { DEFAULT_SETTINGS } from '../data/settings.js';
import { printOnly } from '../print.js';
import { loadChanges } from './TimetableChanges.jsx';
import { addDays, isoWeekday } from '../rules/calendar.js';

// téléphone : une liste par classe (ou par jour) plutôt qu'une grille de 10 colonnes
function useNarrow() {
  const q = '(max-width: 639px)';
  const [n, setN] = useState(() => typeof window !== 'undefined' && window.matchMedia?.(q).matches);
  useEffect(() => { const m = window.matchMedia?.(q); if (!m) return undefined; const f = () => setN(m.matches); m.addEventListener('change', f); return () => m.removeEventListener('change', f); }, []);
  return n;
}

/** Version téléphone : une carte par colonne (classe ou jour), les cours en liste. */
function Stacked({ columns, items, second }) {
  return (
    <div className="space-y-3">
      {columns.map((c) => {
        const list = items.filter((s) => s.col === c.key).sort((a, b) => a.start.localeCompare(b.start));
        return (
          <section key={c.key} className="rounded-xl bg-white p-3 shadow-soft">
            <h3 className="mb-1.5 text-sm font-semibold text-navy-900">{c.label}</h3>
            {list.length === 0 ? <p className="text-xs text-slate-500">Pas de cours</p> : (
              <ul className="space-y-1">
                {list.map((s) => (
                  <li key={s.id} className={`flex gap-2 rounded-lg px-2 py-1.5 text-sm ${s.status ? 'opacity-60' : ''}`} style={{ background: subjectColor(s) }}>
                    <span className="w-[86px] shrink-0 tabular-nums text-xs text-slate-800">{s.start.replace(':', 'h')}–{s.end.replace(':', 'h')}</span>
                    <span className="min-w-0 flex-1"><span className={`font-semibold ${s.status ? 'line-through' : ''}`}>{shortSubject(s)}</span> <span className="text-xs text-slate-700">· {second(s)}{s.room ? ` · ${s.room}` : ''}</span>
                      {s.week && <span className="ml-1 text-[10px] font-semibold">sem. {s.week}</span>}
                      {s.status && <span className="block text-[11px] font-semibold text-red-800">{s.status === 'ANNULE' ? 'annulé' : 'déplacé'} cette semaine</span>}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

// Emplois du temps, présentés comme ceux de l'outil de l'école :
//  - Par jour : toutes les classes côte à côte (6e → Tle G), une page A4 par jour ;
//  - Par classe ou par professeur : la semaine, du lundi au vendredi (samedi s'il y a cours).
// Une couleur par matière, récréation et déjeuner en bandes grises, mercredi après-midi sans cours,
// cours de semaine A ou B marqués (et côte à côte quand ils partagent le créneau).
// Source : l'emploi du temps importé (Importer et sauvegarder), sinon celui de la démonstration.

const field = 'rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm';
const h = (t) => t.replace(':', 'h');
const TODAY = '2026-10-13';
const ROW = 30; // hauteur d'une ligne (px) : la journée tient sur une page A4 paysage
const ORDER = ['6e', '5e', '4e', '3e', '2de', '1re STMG', '1re Générale', 'Terminale STMG', 'Terminale Générale'];
const SHORT_CLASS = { '1re Générale': '1E G', '1re STMG': '1E STMG', 'Terminale Générale': 'TLE G', 'Terminale STMG': 'TLE STMG', '2de': '2NDE' };
const classLabel = (c) => SHORT_CLASS[c] ?? c.toUpperCase();
const teacherName = (id) => STAFF.find((x) => x.id === id)?.name ?? id;
const isWednesday = (d) => d === 3;

/** Grille : colonnes (classes ou jours), cours placés aux repères de l'école. */
function Grid({ columns, items, second, wednesdayCols = [] }) {
  const allWed = columns.length > 0 && columns.every((c) => wednesdayCols.includes(c.key));
  const morningOnly = allWed && !items.some((s) => s.end > LUNCH[0]);
  const full = gridMarks(items);
  const marks = morningOnly ? [...full.slice(0, full.indexOf(LUNCH[0]) + 1), '12:30'] : full;
  const height = (marks.length - 1) * ROW;
  const y = (t) => rowPos(t, marks) * ROW;
  const band = (from, to, label, key) => (
    <div key={key} className="absolute inset-x-0 flex items-center justify-center bg-slate-200/70 text-[10px] italic text-slate-500" style={{ top: y(from), height: y(to) - y(from) }}>{label}</div>
  );
  return (
    <div className="overflow-hidden rounded-lg border border-slate-300 bg-white text-slate-900">
      <div className="grid" style={{ gridTemplateColumns: `52px repeat(${columns.length}, minmax(0, 1fr))` }}>
        <div className="border-b border-slate-300 bg-sky-100" />
        {columns.map((c) => <div key={c.key} className="border-b border-l border-slate-300 bg-sky-100 py-1.5 text-center text-[12px] font-semibold text-navy-900">{c.label}</div>)}
        <div className="relative bg-slate-50" style={{ height }}>
          {marks.slice(0, -1).map((t, i) => (
            <div key={t} className={`absolute inset-x-0 border-t border-slate-300 pl-1 ${strongMark(t) ? 'text-[12px] font-bold text-slate-900' : 'text-[10px] text-slate-500'}`} style={{ top: i * ROW, height: ROW }}>{markLabel(t)}</div>
          ))}
        </div>
        {columns.map((c) => {
          const wed = wednesdayCols.includes(c.key);
          const mine = layoutLanes(items.filter((s) => s.col === c.key));
          return (
            <div key={c.key} className="relative border-l border-slate-300" style={{ height }}>
              {marks.slice(0, -1).map((t, i) => <div key={t} className="absolute inset-x-0 border-t border-slate-200" style={{ top: i * ROW }} />)}
              {marks.includes(RECESS[1]) && band(RECESS[0], RECESS[1], 'Récréation', 'r')}
              {wed && !mine.some((s) => s.end > LUNCH[0])
                ? band(LUNCH[0], marks.at(-1), 'Pas cours le mercredi', 'w')
                : marks.includes(LUNCH[1]) && band(LUNCH[0], LUNCH[1], 'Déjeuner', 'l')}
              {mine.map((s) => (
                <div key={s.id} className="absolute overflow-hidden border border-white/80 px-0.5 text-center leading-tight"
                  style={{ top: y(s.start), height: y(s.end) - y(s.start), left: `${(100 / s.lanes) * s.lane}%`, width: `${100 / s.lanes}%`, background: subjectColor(s) }}>
                  <div className="flex h-full flex-col items-center justify-center">
                    <p className={`font-semibold ${s.status ? 'line-through' : ''} ${s.lanes > 1 ? 'text-[9.5px]' : 'text-[11px]'}`}>{shortSubject(s)}</p>
                    {s.status && <p className="text-[8.5px] font-bold uppercase text-red-800">{s.status === 'ANNULE' ? 'annulé' : 'déplacé'} cette semaine</p>}
                    <p className={s.lanes > 1 ? 'text-[8.5px]' : 'text-[10px]'}>{second(s)}</p>
                    <p className={`italic ${s.lanes > 1 ? 'text-[8px]' : 'text-[9.5px]'}`}>{s.start}-{s.end}</p>
                    {s.room && <p className="text-[9px]">{s.room}</p>}
                    {s.week && <p className="text-[8.5px] font-semibold"><span className="mr-0.5 inline-block h-2 w-0.5 bg-slate-800 align-middle" />Semaine {s.week}</p>}
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Une page : logo, titre, grille (impression A4 paysage, une page par jour/classe/professeur). */
function Page({ title, children }) {
  return (
    <section className="edt-page break-after-page">
      <h2 className="mb-2 border-b border-slate-200 pb-2 text-center text-xl font-bold text-slate-900">{title}</h2>
      {children}
    </section>
  );
}

export default function TimetableView({ settings = DEFAULT_SETTINGS }) {
  const all = loadTimetable();
  const imported = !!importedTimetable();
  const current = weekLetter(TODAY, settings);
  const classes = [...new Set(all.map((s) => s.cls))].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
  const teachers = [...new Set(all.map((s) => s.teacherId))].sort((a, b) => teacherName(a).localeCompare(teacherName(b)));
  const days = [1, 2, 3, 4, 5, ...(all.some((s) => s.weekday === 6) ? [6] : [])];
  const [mode, setMode] = useState('JOUR');
  const [day, setDay] = useState(2);
  const [cls, setCls] = useState(classes[0] ?? '');
  const [prof, setProf] = useState(teachers[0] ?? '');
  const [week, setWeek] = useState('AB');
  // cette semaine : cours annulés ou déplacés (Changements d'emploi du temps), barrés sur la grille
  const monday = addDays(TODAY, 1 - isoWeekday(TODAY));
  const changes = week === 'AB' || week === current ? loadChanges() : [];
  const changeOf = (s) => changes.find((c) => ['ANNULE', 'DEPLACE'].includes(c.type) && c.cls === s.cls && c.subject === s.subject && c.start === s.start && c.date === addDays(monday, s.weekday - 1));
  const slots = all.filter((s) => week === 'AB' || !s.week || s.week === week).map((s) => { const c = changeOf(s); return c ? { ...s, status: c.type, changeDate: c.date } : s; });
  const narrow = useNarrow();
  const weekText = week === 'AB' ? '' : ` — semaine ${week}`;

  const dayPage = (d, forPrint = false) => (
    <Page key={d} title={`Emploi du temps — ${DAY_NAMES[d]}${weekText}`}>
      {(narrow && !forPrint ? Stacked : Grid)({ columns: classes.map((c) => ({ key: c, label: classLabel(c) })), wednesdayCols: isWednesday(d) ? classes : [],
        items: slots.filter((s) => s.weekday === d).map((s) => ({ ...s, col: s.cls })), second: (s) => teacherName(s.teacherId) })}
    </Page>
  );
  const weekPage = (kind, value, forPrint = false) => {
    const mine = slots.filter((s) => (kind === 'CLASSE' ? s.cls === value : s.teacherId === value));
    return (
      <Page key={value} title={`Emploi du temps — ${kind === 'CLASSE' ? value : teacherName(value)}${weekText}`}>
        {(narrow && !forPrint ? Stacked : Grid)({ columns: days.map((d) => ({ key: d, label: narrow && !forPrint ? DAY_NAMES[d] : DAY_NAMES[d].toUpperCase() })), wednesdayCols: [3],
          items: mine.map((s) => ({ ...s, col: s.weekday })), second: (s) => (kind === 'CLASSE' ? teacherName(s.teacherId) : classLabel(s.cls)) })}
      </Page>
    );
  };
  const screen = mode === 'JOUR' ? dayPage(day) : weekPage(mode, mode === 'CLASSE' ? cls : prof);
  const everything = mode === 'JOUR' ? days.map((d) => dayPage(d, true)) : (mode === 'CLASSE' ? classes : teachers).map((v) => weekPage(mode, v, true));
  const print = (sel, what) => printOnly(sel, 'size: A4 landscape; margin: 8mm;', `Emploi du temps — ${what}`, { footer: false });
  const used = [...new Map(slots.map((s) => [shortSubject(s), s])).values()].sort((a, b) => shortSubject(a).localeCompare(shortSubject(b)));
  const pill = (on) => `rounded-md px-3 py-1 text-sm font-medium ${on ? 'bg-white text-navy-900 shadow-sm' : 'text-slate-600'}`;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-navy-500">Tamatave · {imported ? 'emploi du temps importé (gardé dans ce navigateur)' : 'emploi du temps de démonstration'}</p>
          <h1 className="text-2xl font-semibold text-navy-900">Emplois du temps</h1>
          <p className="text-sm text-slate-600">Cette semaine : <strong>semaine {current}</strong> (calendrier de l'école : la semaine de la rentrée est une semaine A, l'alternance continue pendant les vacances).</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => print('.edt-one', mode === 'JOUR' ? DAY_NAMES[day] : mode === 'CLASSE' ? cls : teacherName(prof))}>Imprimer cette page</Button>
          <Button variant="secondary" onClick={() => print('.edt-all', mode === 'JOUR' ? 'semaine' : mode === 'CLASSE' ? 'toutes les classes' : 'tous les professeurs')}>
            {mode === 'JOUR' ? 'Imprimer la semaine (1 page par jour)' : mode === 'CLASSE' ? 'Imprimer toutes les classes' : 'Imprimer tous les professeurs'}
          </Button>
        </div>
      </div>
      <Card>
        <div className="flex flex-wrap items-end gap-3">
          <div className="inline-flex rounded-lg bg-slate-100 p-1" role="group" aria-label="Présentation">{[['JOUR', 'Par jour'], ['CLASSE', 'Par classe'], ['PROF', 'Par professeur']].map(([k, l]) => (
            <button key={k} type="button" aria-pressed={mode === k} onClick={() => setMode(k)} className={pill(mode === k)}>{l}</button>
          ))}</div>
          {mode === 'JOUR' && <div className="inline-flex flex-wrap rounded-lg bg-slate-100 p-1" role="group" aria-label="Jour">{days.map((d) => (
            <button key={d} type="button" aria-pressed={day === d} onClick={() => setDay(d)} className={pill(day === d)}>{DAY_NAMES[d]}</button>
          ))}</div>}
          {mode === 'CLASSE' && <label className="text-xs text-slate-600">Classe<select value={cls} onChange={(e) => setCls(e.target.value)} className={`mt-1 block ${field}`}>{classes.map((v) => <option key={v}>{v}</option>)}</select></label>}
          {mode === 'PROF' && <label className="text-xs text-slate-600">Professeur<select value={prof} onChange={(e) => setProf(e.target.value)} className={`mt-1 block ${field}`}>{teachers.map((v) => <option key={v} value={v}>{teacherName(v)}</option>)}</select></label>}
          <div className="inline-flex rounded-lg bg-slate-100 p-1" role="group" aria-label="Semaine">{[['AB', 'Semaines A et B'], ['A', 'Semaine A'], ['B', 'Semaine B']].map(([k, l]) => (
            <button key={k} type="button" aria-pressed={week === k} onClick={() => setWeek(k)} className={pill(week === k)}>{l}{k === current ? ' (cette semaine)' : ''}</button>
          ))}</div>
        </div>
      </Card>
      <div className="-mx-1 overflow-x-auto px-1" tabIndex={0} role="region" aria-label="Emploi du temps">
        <div className={`edt-screen ${narrow ? '' : 'min-w-[900px]'}`}>{screen}</div>
      </div>
      <div className="flex flex-wrap gap-1.5 text-xs" aria-label="Couleurs des matières">
        {used.map((s) => <span key={shortSubject(s)} className="rounded px-2 py-0.5 text-slate-900" style={{ background: subjectColor(s) }}>{shortSubject(s)}</span>)}
      </div>
      {classes.includes('1re Générale') && (mode !== 'CLASSE' || cls === '1re Générale') && (
        <p className="text-xs text-slate-600">1re générale : la partie physique-chimie de l'enseignement scientifique (E.S. P-C) se fait pendant une heure de physique-chimie choisie par le professeur, qui peut changer d'une semaine à l'autre ; elle n'a donc pas de créneau fixe.</p>
      )}
      <div className="edt-all hidden" aria-hidden="true">{everything}</div>
      <div className="edt-one hidden" aria-hidden="true">{mode === 'JOUR' ? dayPage(day, true) : weekPage(mode, mode === 'CLASSE' ? cls : prof, true)}</div>
    </div>
  );
}
