import React from 'react';
import { Card } from './ui.jsx';
import { REFORMS, PROGRAM_LINKS } from '../data/officialPrograms.js';
import { STUDY_POINTS } from '../data/officialCompetencies.js';

// Pour les professeurs : sans les références des textes officiels (la Direction garde les sources et les liens)
const noSource = (t) => String(t).replace(/\s*\((?:[^()]*\bBO\b[^()]*)\)/g, '').replace(/\s*;?\s*\bBO\b[^;.)]*/g, '');

// Nouveaux programmes : le calendrier des réformes et les liens officiels (Eduscol), pour la Direction et les professeurs.
export function ReformsCard({ direction = true }) {
  return (
    <Card title="Calendrier des nouveaux programmes" subtitle={direction ? 'À vérifier au Bulletin officiel avant de figer une programmation : les pages officielles changent souvent.' : 'Les changements de programme, année par année.'}>
      <ul className="space-y-3 text-sm">{REFORMS.map((r) => <li key={r.when}><span className="font-semibold text-navy-900">{r.when}</span><span className="block text-slate-700">{direction ? r.what : noSource(r.what)}</span></li>)}</ul>
    </Card>
  );
}

/** Points des programmes à étudier de près (lus dans les programmes déposés par la Direction). */
export function StudyPointsCard({ subject = '', direction = true }) {
  // une matière choisie (Programmation) : ses points d'abord, et ceux pour toute l'équipe
  const norm = (x) => String(x ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const mine = direction ? STUDY_POINTS : STUDY_POINTS.filter((p) => /professeurs/i.test(p.who));
  const list = subject ? mine.filter((p) => norm(p.subject).includes(norm(subject).split(' ')[0]) || /evars|direction/i.test(norm(p.subject))) : mine;
  if (!list.length) return null;
  return (
    <Card title="À étudier de près" subtitle={direction ? 'Ce que les programmes changent ou exigent cette année : à lire par les professeurs concernés et par la Direction.' : 'Ce qui change ou est demandé cette année dans votre matière.'}>
      <ul className="space-y-4 text-sm">
        {list.map((p) => (
          <li key={p.subject + p.title} className="border-l-4 border-amber-300 pl-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">{p.subject} · {p.levels}{direction ? ` · pour : ${p.who}` : ''}</p>
            <p className="font-semibold text-navy-900">{direction ? p.title : noSource(p.title)}</p>
            <p className="text-slate-700">{direction ? p.text : noSource(p.text)}</p>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export default function NewPrograms({ role }) {
  const direction = role === 'DIRECTION';
  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-semibold text-navy-500">Programmes</p>
        <h1 className="text-2xl font-semibold text-navy-900">Nouveaux programmes</h1>
        <p className="text-sm text-slate-600">Quels programmes s'appliquent cette année, et où les lire.</p>
      </div>
      <StudyPointsCard direction={direction} />
      <ReformsCard direction={direction} />
      {direction && PROGRAM_LINKS.map((g) => (
        <Card key={g.group} title={g.group}>
          <ul className="space-y-1.5 text-sm">
            {g.links.map(([label, url]) => <li key={url}><a href={url} target="_blank" rel="noopener noreferrer" className="font-medium text-navy-700 underline">{label}</a></li>)}
          </ul>
        </Card>
      ))}
    </div>
  );
}
