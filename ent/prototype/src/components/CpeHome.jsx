import React from 'react';
import { Button, Card, Icon } from './ui.jsx';
import TodoList from './TodoList.jsx';
import ActivityJournal from './ActivityJournal.jsx';
import { notificationsFor } from '../notify.js';

// Accueil de la CPE : d'abord les tâches confiées par la Direction, puis la journée (ce qui attend, du plus
// urgent au moins urgent), et les accès rapides. Même logique que les accueils Direction et secrétariat.
export default function CpeHome({ go, account }) {
  const notes = notificationsFor('VIE_SCOLAIRE', { account });
  const day = [...notes.urgent.map((n) => ({ ...n, urgent: true })), ...notes.todo];
  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-semibold text-navy-500">Vie scolaire · Tamatave</p>
        <h1 className="text-2xl font-semibold text-navy-900">Bonjour M. Be</h1>
        <p className="text-sm text-slate-600">{day.length ? `${day.length} chose${day.length > 1 ? 's' : ''} à traiter aujourd'hui.` : 'Rien d\'urgent aujourd\'hui.'}</p>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 xl:grid-cols-2">
        <TodoList who="VIE_SCOLAIRE" title="Mes tâches" />
        <Card title="Ma journée" subtitle="Ce qui attend la vie scolaire">
          {day.length === 0 ? <p className="text-sm text-slate-600">Tout est à jour ✓</p> : (
            <ul className="divide-y divide-slate-100">
              {day.map((n) => (
                <li key={n.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                  <span className={n.urgent ? 'font-semibold text-red-800' : 'text-slate-800'}>{n.urgent && '⚠ '}{n.text}</span>
                  {n.to && <Button variant={n.urgent ? 'primary' : 'secondary'} className="!py-1 text-xs" onClick={() => go?.(n.to)}>{n.action ?? 'Voir'}</Button>}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => go?.('vs')}><Icon name="users" />Absences, retards et punitions</Button>
        <Button variant="secondary" onClick={() => go?.('care')}><Icon name="care" />Soins et infirmerie</Button>
        <Button variant="secondary" onClick={() => go?.('tt-changes')}><Icon name="clock" />Annuler un cours aujourd'hui</Button>
        <Button variant="secondary" onClick={() => go?.('news')}><Icon name="megaphone" />Annonces</Button>
      </div>
      <ActivityJournal />
    </div>
  );
}
