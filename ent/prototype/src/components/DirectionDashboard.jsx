import React from 'react';
import ActivityJournal from './ActivityJournal.jsx';
import { PulseCard, UpcomingCard, TodoCard } from './HomeBlocks.jsx';
import { notificationsFor } from '../notify.js';

// Accueil de la Direction, dans l'ordre demandé :
// 1. l'école sur 7 ou 30 jours (chiffres cliquables) et, à droite, ce qui est en cours ou à venir ;
// 2. « À faire » : décisions et tâches réunies ; 3. « Ce qui s'est passé », par service, avec accès direct.
// (Les finances sont dans Caisse et comptabilité ; les jalons de l'année ne sont plus sur l'accueil.)
export default function DirectionDashboard({ account, settings, go, site = 'TMV' }) {
  const n = notificationsFor('DIRECTION', { account });
  const count = n.urgent.length + n.todo.filter((x) => x.id !== 'tasks').length;
  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-semibold text-navy-500">Année scolaire 2026-2027 · {site === 'TMV' ? 'Tamatave' : 'Tana'}</p>
        <h1 className="text-2xl font-semibold text-navy-900">Bonjour {account.name.replace(/ \(.*\)$/, '')}</h1>
        <p className="text-sm text-slate-600">{count ? `${count} point${count > 1 ? 's' : ''} à traiter.` : 'Rien d\'urgent.'}</p>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <PulseCard go={go} />
        <UpcomingCard settings={settings} go={go} />
      </div>
      <TodoCard role="DIRECTION" account={account} go={go} />
      <ActivityJournal go={go} />
    </div>
  );
}
