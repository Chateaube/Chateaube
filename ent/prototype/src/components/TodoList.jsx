import React, { useState } from 'react';
import { Badge, Button, Card } from './ui.jsx';
import { ASSIGNEES, PRIORITIES, assigneeLabel, isOverdue, isDueToday, sortTasks, taskErrors, tasksFor } from '../rules/tasks.js';
import { loadTasks, saveTasks } from '../tasksStore.js';

// Tâches du jour : la Direction en crée pour elle ou les confie à un membre du personnel (priorité,
// échéance facultative) ; chaque personne coche ses tâches sur son accueil.
const localToday = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const fr = (iso) => iso.split('-').reverse().join('/');
const field = 'rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm';
const BLANK = { title: '', assignee: 'DIRECTION', priority: 'NORMALE', due: '' };

export default function TodoList({ who = 'DIRECTION', title = 'Mes tâches' }) {
  const today = localToday();
  const canAssign = who === 'DIRECTION';
  const [all, setAll] = useState(loadTasks);
  const [d, setD] = useState(BLANK);
  const [err, setErr] = useState([]);
  const [showDone, setShowDone] = useState(false);
  const save = (l) => { setAll(l); saveTasks(l); };
  const mine = sortTasks(tasksFor(all, who), today);
  const open = mine.filter((t) => !t.done);
  const shown = showDone ? mine : open;
  const add = () => {
    const t = { ...d, title: d.title.trim(), due: d.due || null, assignee: canAssign ? d.assignee : who };
    const e = taskErrors(t); setErr(e); if (e.length) return;
    save([{ ...t, id: `t${Date.now()}`, done: false, createdBy: who, createdAt: new Date().toISOString().slice(0, 16) }, ...all]);
    setD({ ...BLANK, assignee: d.assignee });
  };
  const toggle = (id) => save(all.map((t) => (t.id === id ? { ...t, done: !t.done, doneAt: t.done ? null : today } : t)));
  const remove = (id) => save(all.filter((t) => t.id !== id));

  return (
    <Card title={`${title} (${open.length})`} subtitle={canAssign ? 'Vos tâches et celles que vous confiez à l\'équipe' : 'Les tâches que la Direction vous a confiées'}>
      <div className="flex flex-wrap items-end gap-2">
        <input value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && add()} aria-label="Nouvelle tâche" placeholder="Nouvelle tâche…" className={`min-w-[12rem] flex-1 ${field}`} />
        {canAssign && <select value={d.assignee} onChange={(e) => setD({ ...d, assignee: e.target.value })} aria-label="Confier à" className={field}>{ASSIGNEES.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}</select>}
        <select value={d.priority} onChange={(e) => setD({ ...d, priority: e.target.value })} aria-label="Priorité" className={field}>{Object.entries(PRIORITIES).map(([k, [, l]]) => <option key={k} value={k}>{l}</option>)}</select>
        <label className="text-xs text-slate-600">Échéance (facultatif)<input type="date" value={d.due} onChange={(e) => setD({ ...d, due: e.target.value })} className={`mt-0.5 block ${field}`} /></label>
        <Button onClick={add}>Ajouter</Button>
      </div>
      {err.length > 0 && <p role="alert" className="mt-2 text-sm text-red-700">{err.join(' ')}</p>}
      <ul className="mt-3 divide-y divide-slate-100">
        {shown.length === 0 && <li className="py-2 text-sm text-slate-600">Rien à faire ✓</li>}
        {shown.map((t) => (
          <li key={t.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
            <input type="checkbox" checked={t.done} onChange={() => toggle(t.id)} aria-label={`Fait : ${t.title}`} className="h-5 w-5" />
            <span className={`min-w-0 flex-1 ${t.done ? 'text-slate-500 line-through' : 'text-slate-900'}`}>{t.title}
              <span className="block text-xs text-slate-600">{canAssign && t.assignee !== 'DIRECTION' ? `Confiée à ${assigneeLabel(t.assignee)}` : canAssign ? 'Pour moi' : 'Confiée par la Direction'}{t.due ? ` · pour le ${fr(t.due)}` : ''}{t.done && t.doneAt ? ` · faite le ${fr(t.doneAt)}` : ''}</span></span>
            {/* sur téléphone, les étiquettes passent sous le texte */}
            <span className="flex basis-full flex-wrap items-center gap-2 pl-7 sm:basis-auto sm:pl-0">
              {isOverdue(t, today) && <Badge tone="red">en retard</Badge>}
              {isDueToday(t, today) && <Badge tone="amber">aujourd'hui</Badge>}
              {!t.done && <Badge tone={PRIORITIES[t.priority][0]}>{PRIORITIES[t.priority][1]}</Badge>}
              {(canAssign || t.createdBy === who) && <button type="button" onClick={() => remove(t.id)} className="text-xs text-slate-600 underline hover:text-red-700">Supprimer</button>}
            </span>
          </li>
        ))}
      </ul>
      {mine.length > open.length && <button type="button" onClick={() => setShowDone(!showDone)} className="mt-2 text-xs font-medium text-navy-700 underline">{showDone ? 'Masquer les tâches faites' : `Voir les tâches faites (${mine.length - open.length})`}</button>}
    </Card>
  );
}
