import React from 'react';
import { Card } from './ui.jsx';
import { REFORMS, PROGRAM_LINKS } from '../data/officialPrograms.js';

// Nouveaux programmes : le calendrier des réformes et les liens officiels (Eduscol), pour la Direction et les professeurs.
export function ReformsCard() {
  return (
    <Card title="Calendrier des nouveaux programmes" subtitle="À vérifier au Bulletin officiel avant de figer une programmation : les pages officielles changent souvent.">
      <ul className="space-y-3 text-sm">{REFORMS.map((r) => <li key={r.when}><span className="font-semibold text-navy-900">{r.when}</span><span className="block text-slate-700">{r.what}</span></li>)}</ul>
    </Card>
  );
}

export default function NewPrograms() {
  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-semibold text-navy-500">Programmes officiels</p>
        <h1 className="text-2xl font-semibold text-navy-900">Nouveaux programmes</h1>
        <p className="text-sm text-slate-600">Quels programmes s'appliquent cette année, et où les lire.</p>
      </div>
      <ReformsCard />
      {PROGRAM_LINKS.map((g) => (
        <Card key={g.group} title={g.group}>
          <ul className="space-y-1.5 text-sm">
            {g.links.map(([label, url]) => <li key={url}><a href={url} target="_blank" rel="noopener noreferrer" className="font-medium text-navy-700 underline">{label}</a></li>)}
          </ul>
        </Card>
      ))}
    </div>
  );
}
