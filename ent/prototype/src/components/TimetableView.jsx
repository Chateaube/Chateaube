import React, { useState } from 'react';
import { Badge, Button, Card } from './ui.jsx';
import { loadTimetable, importedTimetable } from '../timetableStore.js';
import { DAY_NAMES } from '../rules/timetableImport.js';
import { weekLetter } from '../rules/teachingHours.js';
import { STAFF } from '../data/people.js';
import { DEFAULT_SETTINGS } from '../data/settings.js';
import { printOnly } from '../print.js';

// Emplois du temps : par classe ou par professeur, en semaine A ou B (la semaine en cours est proposée).
// Source : l'emploi du temps importé (Importer et sauvegarder), sinon celui de la démonstration.

const field = 'rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm';
const h = (t) => t.replace(':', 'h');
const TODAY = '2026-10-13';
const teacherName = (id) => STAFF.find((x) => x.id === id)?.name ?? id;

export default function TimetableView({ settings = DEFAULT_SETTINGS }) {
  const slots = loadTimetable();
  const imported = !!importedTimetable();
  const classes = [...new Set(slots.map((s) => s.cls))].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
  const teachers = [...new Set(slots.map((s) => s.teacherId))].sort((a, b) => teacherName(a).localeCompare(teacherName(b)));
  const [mode, setMode] = useState('CLASSE');
  const [value, setValue] = useState(classes[0] ?? '');
  const [week, setWeek] = useState(weekLetter(TODAY, settings));
  const list = slots.filter((s) => (mode === 'CLASSE' ? s.cls === value : s.teacherId === value) && (!s.week || s.week === week));
  const days = [1, 2, 3, 4, 5, ...(slots.some((s) => s.weekday === 6) ? [6] : [])];
  const total = list.reduce((t, s) => t + (Number(s.end.slice(0, 2)) * 60 + Number(s.end.slice(3)) - Number(s.start.slice(0, 2)) * 60 - Number(s.start.slice(3))) / 60, 0);
  const title = `${mode === 'CLASSE' ? value : teacherName(value)} — semaine ${week}`;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-navy-500">Tamatave · {imported ? 'emploi du temps importé (gardé dans ce navigateur)' : 'emploi du temps de démonstration'}</p>
          <h1 className="text-2xl font-semibold text-navy-900">Emplois du temps</h1>
          <p className="text-sm text-slate-600">Semaine en cours : <strong>semaine {weekLetter(TODAY, settings)}</strong> (la semaine de la rentrée, lundi 7 septembre, est une semaine A ; les vacances ne comptent pas).</p>
        </div>
        <Button variant="secondary" onClick={() => printOnly('.edt-print', 'size: A4 landscape; margin: 10mm;', `Emploi du temps — ${title}`)}>Imprimer</Button>
      </div>
      <Card>
        <div className="flex flex-wrap items-end gap-3">
          <div className="inline-flex rounded-lg bg-slate-100 p-1">{[['CLASSE', 'Par classe'], ['PROF', 'Par professeur']].map(([k, l]) => (
            <button key={k} type="button" aria-pressed={mode === k} onClick={() => { setMode(k); setValue(k === 'CLASSE' ? classes[0] : teachers[0]); }} className={`rounded-md px-3 py-1 text-sm font-medium ${mode === k ? 'bg-white text-navy-900 shadow-sm' : 'text-slate-600'}`}>{l}</button>
          ))}</div>
          <label className="text-xs text-slate-600">{mode === 'CLASSE' ? 'Classe' : 'Professeur'}
            <select value={value} onChange={(e) => setValue(e.target.value)} className={`mt-1 block ${field}`}>{(mode === 'CLASSE' ? classes : teachers).map((v) => <option key={v} value={v}>{mode === 'CLASSE' ? v : teacherName(v)}</option>)}</select>
          </label>
          <div className="inline-flex rounded-lg bg-slate-100 p-1" role="group" aria-label="Semaine">{['A', 'B'].map((w) => (
            <button key={w} type="button" aria-pressed={week === w} onClick={() => setWeek(w)} className={`rounded-md px-3 py-1 text-sm font-medium ${week === w ? 'bg-white text-navy-900 shadow-sm' : 'text-slate-600'}`}>Semaine {w}</button>
          ))}</div>
          <span className="pb-1.5 text-sm text-slate-600">{String(Math.round(total * 100) / 100).replace('.', ',')} h de cours cette semaine</span>
        </div>
      </Card>
      <div className="edt-print">
        <p className="mb-2 hidden text-base font-semibold print:block">{title}</p>
        <div className="-mx-1 overflow-x-auto px-1" tabIndex={0} role="region" aria-label={`Emploi du temps — ${title}`}>
          <div className="grid min-w-[760px] gap-2" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
            {days.map((d) => (
              <div key={d} className="rounded-xl bg-white p-2 shadow-soft print:shadow-none print:ring-1 print:ring-slate-300">
                <p className="mb-2 text-center text-xs font-semibold uppercase tracking-wide text-navy-700">{DAY_NAMES[d]}</p>
                <ul className="space-y-1.5">
                  {list.filter((s) => s.weekday === d).sort((a, b) => a.start.localeCompare(b.start)).map((s) => (
                    <li key={s.id} className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs">
                      <p className="font-semibold tabular-nums text-slate-900">{h(s.start)}–{h(s.end)}{s.week && <Badge tone="violet" className="ml-1">sem. {s.week}</Badge>}</p>
                      <p className="text-slate-900">{s.subject}{s.part ? ` (${s.part})` : ''}</p>
                      <p className="text-slate-600">{mode === 'CLASSE' ? teacherName(s.teacherId) : s.cls}{s.room ? ` · ${s.room}` : ''}</p>
                    </li>
                  ))}
                  {!list.some((s) => s.weekday === d) && <li className="py-2 text-center text-xs text-slate-500">—</li>}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
const ORDER = ['6e', '5e', '4e', '3e', '2de', '1re Générale', '1re STMG', 'Terminale Générale', 'Terminale STMG'];
