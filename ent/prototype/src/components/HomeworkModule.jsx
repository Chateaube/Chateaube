import React, { useState } from 'react';
import { Badge, Button, Card } from './ui.jsx';
import { HOMEWORK } from '../data/homework.js';
import { SERVICES } from '../data/grades.js';
import { formatDateFr } from '../rules/calendar.js';

// Cahier de textes de l'enseignant : une entrée par séance (fait en classe + travail à faire).
const inputCls = 'rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm';
const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);

export default function HomeworkModule() {
  const services = SERVICES.filter((s) => s.mode !== 'APPRECIATION_SEULE');
  const [serviceId, setServiceId] = useState(services[0].id);
  const [entries, setEntries] = useState(HOMEWORK);
  const blank = { date: '2026-10-13', done: '', todo: '', due: '' };
  const [draft, setDraft] = useState(blank);
  const service = services.find((s) => s.id === serviceId);
  const mine = entries.filter((e) => e.cls === service.cls && e.subject === service.subject).sort((a, b) => b.date.localeCompare(a.date));
  const ok = draft.date && draft.done.trim() && (!draft.todo.trim() || (draft.due && draft.due > draft.date));

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Visible par les élèves et leurs parents</p>
        <h1 className="text-2xl font-semibold text-navy-900">Cahier de textes</h1>
      </div>
      <div className="grid gap-5 xl:grid-cols-[1fr_380px] xl:items-start">
        <Card
          title={`${service.cls} · ${service.subject}`}
          action={
            <select value={serviceId} onChange={(e) => setServiceId(e.target.value)} className={inputCls}>
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
                  {e.todo && (
                    <p className="mt-1 text-sm text-slate-800">
                      <Badge tone="amber">Pour le {formatDateFr(e.due).replace(/ \d{4}$/, '')}</Badge> <span className="ml-1">{e.todo}</span>
                    </p>
                  )}
                </li>
              ))}
            </ol>
          )}
        </Card>
        <Card title="Nouvelle séance">
          <div className="space-y-2 text-sm">
            <label className="block text-xs text-slate-600">Date de la séance<input type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} className={`mt-1 w-full ${inputCls}`} /></label>
            <label className="block text-xs text-slate-600">Fait en classe<textarea rows={3} value={draft.done} onChange={(e) => setDraft({ ...draft, done: e.target.value })} className={`mt-1 w-full ${inputCls}`} /></label>
            <label className="block text-xs text-slate-600">Travail à faire (facultatif)<textarea rows={2} value={draft.todo} onChange={(e) => setDraft({ ...draft, todo: e.target.value })} className={`mt-1 w-full ${inputCls}`} /></label>
            {draft.todo.trim() && (
              <label className="block text-xs text-slate-600">Pour le<input type="date" value={draft.due} onChange={(e) => setDraft({ ...draft, due: e.target.value })} className={`mt-1 w-full ${inputCls}`} /></label>
            )}
            {draft.todo.trim() && draft.due && draft.due <= draft.date && <p className="text-xs text-red-700">La date de remise doit suivre la séance.</p>}
            <Button className="w-full" disabled={!ok} onClick={() => {
              setEntries([{ id: `h${Date.now()}`, cls: service.cls, subject: service.subject, teacher: 'Mme Ranaivo', ...draft, todo: draft.todo.trim() || null, due: draft.todo.trim() ? draft.due : null }, ...entries]);
              setDraft(blank);
            }}>Publier</Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
