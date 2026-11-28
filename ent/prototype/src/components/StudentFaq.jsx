import React, { useState } from 'react';
import { Badge, Card } from './ui.jsx';
import { FAQ_TOPICS, STUDENT_FAQ } from '../data/studentFaq.js';

// Questions fréquentes des élèves (site d'essai) : la Direction relit les brouillons avant publication.
export default function StudentFaq({ role }) {
  const [topic, setTopic] = useState('');
  const [open, setOpen] = useState(null);
  const direction = role === 'DIRECTION';
  const list = STUDENT_FAQ.filter((x) => !topic || x.topic === topic);
  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-semibold text-navy-500">Aide</p>
        <h1 className="text-2xl font-semibold text-navy-900">Questions fréquentes</h1>
        <p className="text-sm text-slate-600">Les réponses aux questions que les élèves posent souvent. Ta question n'y est pas ? Pose-la à ton professeur principal ou à la vie scolaire.</p>
      </div>
      {direction && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Site d'essai : les réponses marquées « brouillon » sont à relire. Dites-moi ce qu'il faut corriger ; une fois validées, elles seront publiées pour les élèves.</p>}
      <div className="flex flex-wrap gap-2 text-sm">
        {['', ...FAQ_TOPICS].map((t) => (
          <button key={t || 'tout'} type="button" aria-pressed={topic === t} onClick={() => setTopic(t)}
            className={`rounded-full px-3 py-1 font-medium ${topic === t ? 'bg-navy-500 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200'}`}>{t || 'Tout'}</button>
        ))}
      </div>
      <Card>
        <ul className="divide-y divide-slate-100">
          {list.map((x) => (
            <li key={x.id} className="py-3">
              <button type="button" aria-expanded={open === x.id} onClick={() => setOpen(open === x.id ? null : x.id)} className="flex w-full items-start justify-between gap-3 text-left">
                <span className="font-medium text-navy-900">{x.q}</span>
                <span className="flex shrink-0 items-center gap-2 text-xs text-slate-500">{x.levels}{direction && x.draft && <Badge tone="amber">brouillon</Badge>}<span aria-hidden>{open === x.id ? '▴' : '▾'}</span></span>
              </button>
              {open === x.id && <p className="mt-2 text-sm leading-relaxed text-slate-700">{x.a}</p>}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
