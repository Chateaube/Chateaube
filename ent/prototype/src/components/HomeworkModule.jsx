import React, { useState } from 'react';
import { Badge, Button, Card } from './ui.jsx';
import { HOMEWORK } from '../data/homework.js';
import { SERVICES } from '../data/grades.js';
import { formatDateFr } from '../rules/calendar.js';
import { takeIntent } from '../navIntent.js';
import { useDraft } from '../draftStore.js';
import { TIMETABLE } from '../data/timetable.js';
import { DocumentInput, DocumentThumb } from './PhotoInput.jsx';
import { usePersistent } from '../persist.js';

// Cahier de textes de l'enseignant : une entrée par séance (fait en classe + travail à faire).
const inputCls = 'rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm';
const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const TODAY = '2026-10-13';
const shift = (iso, n) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const weekday = (iso) => new Date(`${iso}T12:00:00Z`).getUTCDay();
const short = (iso) => cap(formatDateFr(iso).replace(/ \d{4}$/, ''));
/** Séances de la classe dans cette matière (emploi du temps), dans une fenêtre de jours autour d'une date. */
export function sessionDates(cls, subject, from, days) {
  const slots = TIMETABLE.filter((s) => s.cls === cls && s.subject === subject);
  const out = [];
  for (let k = 0; Math.abs(k) <= Math.abs(days); k += Math.sign(days) || 1) {
    const d = shift(from, k);
    slots.filter((s) => s.weekday === weekday(d)).forEach((s) => out.push({ date: d, start: s.start }));
    if (k === days) break;
  }
  return out;
}

export default function HomeworkModule() {
  const services = SERVICES.filter((s) => s.mode !== 'APPRECIATION_SEULE');
  const [serviceId, setServiceId] = useState(() => { const i = takeIntent('homework'); return services.find((x) => x.cls === i?.cls && x.subject === i?.subject)?.id ?? services.find((x) => x.cls === i?.cls)?.id ?? services[0].id; });
  const [entries, setEntries] = usePersistent('ent-s-devoirs', () => [...HOMEWORK]);
  const blank = { date: TODAY, done: '', todo: '', due: '', files: [] };
  const [draft, setDraft, clearDraft, restored] = useDraft('cahier-de-textes', blank);
  const service = services.find((s) => s.id === serviceId);
  const mine = entries.filter((e) => e.cls === service.cls && e.subject === service.subject).sort((a, b) => b.date.localeCompare(a.date));
  const past = sessionDates(service.cls, service.subject, TODAY, -7).slice(0, 4); // séances récentes, la plus proche d'abord
  const next = draft.date ? sessionDates(service.cls, service.subject, shift(draft.date, 1), 21).slice(0, 3) : []; // « pour le » : prochains cours
  const ok = draft.date && draft.done.trim() && (!draft.todo.trim() || (draft.due && draft.due > draft.date));

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-semibold text-navy-500">Visible par les élèves et leurs parents</p>
        <h1 className="text-2xl font-semibold text-navy-900">Cahier de textes</h1>
      </div>
      <div className="grid gap-5 xl:grid-cols-[1fr_380px] xl:items-start">
        <Card
          title={`${service.cls} · ${service.subject}`}
          action={
            <select value={serviceId} onChange={(e) => setServiceId(e.target.value)} aria-label="Classe et matière" className={inputCls}>
              {services.map((s) => <option key={s.id} value={s.id}>{s.cls} · {s.subject}</option>)}
            </select>
          }
        >
          {mine.length === 0 ? <p className="text-sm text-slate-500">Aucune séance renseignée.</p> : (
            <ol className="space-y-3">
              {mine.map((e) => (
                <li key={e.id} className="rounded-lg border border-slate-200 p-3">
                  <p className="text-xs font-medium text-navy-700">{cap(formatDateFr(e.date))}</p>
                  <p className="mt-1 text-sm text-slate-800"><span className="font-medium">Fait en classe :</span> {e.done}</p>
                  {e.files?.length > 0 && <div className="mt-1.5 flex flex-wrap gap-1">{e.files.map((f, i) => <DocumentThumb key={i} doc={f} title={f.name ?? 'Pièce jointe'} />)}</div>}
                  {e.todo && (
                    <p className="mt-1 text-sm text-slate-800">
                      <Badge tone="amber">Pour le {formatDateFr(e.due).replace(/ \d{4}$/, '')}</Badge> <span className="ml-1">{e.todo}</span>
                    </p>
                  )}
                  <p className="mt-1.5 flex gap-3 text-xs">
                    <button type="button" className="text-navy-600 underline" onClick={() => { setDraft({ ...blank, ...e, todo: e.todo ?? '', due: e.due ?? '', files: e.files ?? [] }); window.scrollTo?.({ top: 0, behavior: 'smooth' }); }}>Modifier</button>
                    <button type="button" className="text-red-700 underline" onClick={() => window.confirm('Supprimer cette séance du cahier de textes ?') && setEntries(entries.filter((x) => x.id !== e.id))}>Supprimer</button>
                  </p>
                </li>
              ))}
            </ol>
          )}
        </Card>
        <Card title="Nouvelle séance" className="consult-hide">
          <div className="space-y-2 text-sm">
            {past.length > 0 && (
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Séance">
                {past.map((s) => <button key={s.date + s.start} type="button" aria-pressed={draft.date === s.date} onClick={() => setDraft({ ...draft, date: s.date })} className={`rounded-full px-3 py-1.5 text-xs font-medium ring-1 ${draft.date === s.date ? 'bg-navy-500 text-white ring-navy-500' : 'bg-white text-slate-800 ring-slate-300'}`}>{short(s.date)} {s.start.replace(':', 'h')}</button>)}
              </div>
            )}
            <label className="block text-xs text-slate-600">Date de la séance<input type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} className={`mt-1 w-full ${inputCls}`} /></label>
            {restored && <p className="rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-900">Brouillon retrouvé : il a été gardé sur cet appareil.</p>}
            <label className="block text-xs text-slate-600">Fait en classe<textarea rows={3} value={draft.done} onChange={(e) => setDraft({ ...draft, done: e.target.value })} className={`mt-1 w-full ${inputCls}`} /></label>
            <label className="block text-xs text-slate-600">Travail à faire (facultatif)<textarea rows={2} value={draft.todo} onChange={(e) => setDraft({ ...draft, todo: e.target.value })} className={`mt-1 w-full ${inputCls}`} /></label>
            {draft.todo.trim() && (
              <div>
                <p className="text-xs text-slate-600">Pour le (prochains cours de la classe)</p>
                <div className="mt-1 flex flex-wrap gap-1.5" role="group" aria-label="Pour le">
                  {next.map((s) => <button key={s.date + s.start} type="button" aria-pressed={draft.due === s.date} onClick={() => setDraft({ ...draft, due: s.date })} className={`rounded-full px-3 py-1.5 text-xs font-medium ring-1 ${draft.due === s.date ? 'bg-navy-500 text-white ring-navy-500' : 'bg-white text-slate-800 ring-slate-300'}`}>{short(s.date)}</button>)}
                </div>
                <label className="mt-1.5 block text-xs text-slate-600">ou une autre date<input type="date" value={draft.due} onChange={(e) => setDraft({ ...draft, due: e.target.value })} className={`mt-1 w-full ${inputCls}`} /></label>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              {(draft.files ?? []).map((f, i) => <span key={i} className="flex items-center gap-1"><DocumentThumb doc={f} title={f.name ?? 'Pièce jointe'} /><button type="button" aria-label="Retirer la pièce jointe" onClick={() => setDraft({ ...draft, files: draft.files.filter((_, k) => k !== i) })} className="text-xs text-red-700">✕</button></span>)}
              <DocumentInput label="＋ Pièce jointe (photo, PDF)" onAdd={(doc) => setDraft({ ...draft, files: [...(draft.files ?? []), doc] })} />
            </div>
            {draft.todo.trim() && draft.due && draft.due <= draft.date && <p className="text-xs text-red-700">La date de remise doit suivre la séance.</p>}
            <Button className="w-full" disabled={!ok} onClick={() => {
              const entry = { cls: service.cls, subject: service.subject, teacher: 'Mme Ranaivo', ...draft, todo: draft.todo.trim() || null, due: draft.todo.trim() ? draft.due : null };
              // séance modifiée (même id) ou nouvelle séance
              setEntries(draft.id ? entries.map((x) => (x.id === draft.id ? entry : x)) : [{ ...entry, id: `h${Date.now()}` }, ...entries]);
              clearDraft();
            }}>{draft.id ? 'Enregistrer les modifications' : 'Publier'}</Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
