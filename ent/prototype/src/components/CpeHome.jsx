import React from 'react';
import { Badge, Button, Card, Icon } from './ui.jsx';
import TodoList from './TodoList.jsx';
import AbsentToggle from './AbsentToggle.jsx';
import ActivityJournal from './ActivityJournal.jsx';
import { ColleSessionsCard } from './PassportTab.jsx';
import { notificationsFor, TODAY } from '../notify.js';
import QuickEntry from './QuickEntry.jsx';
import { loadObjects } from '../objectsStore.js';
import { loadTeacherAbsences } from '../absencesStore.js';
import { sessionsToSupervise } from '../rules/teachingHours.js';
import { TIMETABLE } from '../data/timetable.js';
import { STAFF } from '../data/people.js';
import { setIntent } from '../navIntent.js';
import { me } from '../identity.js';

// Accueil de la CPE : d'abord ce qui attend (du plus urgent au moins urgent), puis la journée concrète
// (séances à surveiller, colles, objets en garde), puis les tâches confiées et le journal.
export default function CpeHome({ go, account }) {
  const notes = notificationsFor('VIE_SCOLAIRE', { account });
  const day = [...notes.urgent.map((n) => ({ ...n, urgent: true })), ...notes.todo.filter((n) => n.id !== 'tasks')];
  const toSupervise = sessionsToSupervise(loadTeacherAbsences(), TIMETABLE, TODAY).filter((x) => x.date === TODAY);
  const objects = loadObjects().filter((p) => p.action !== 'AVERTISSEMENT' && !p.returned);
  const teacher = (id) => STAFF.find((s) => s.id === id)?.name ?? id;
  const open = (to, intent) => { if (intent) setIntent(to, intent); go?.(to); };
  return (
    <div className="space-y-5 pb-16 sm:pb-0">
      <div>
        <p className="text-sm font-semibold text-navy-500">Vie scolaire · Tamatave</p>
        <h1 className="text-2xl font-semibold text-navy-900">Bonjour {me('VIE_SCOLAIRE')}</h1>
        <p className="text-sm text-slate-600">{day.length ? `${day.length} chose${day.length > 1 ? 's' : ''} à traiter aujourd'hui.` : 'Rien d\'urgent aujourd\'hui.'}</p>
      </div>
      <QuickEntry role="VIE_SCOLAIRE" />
      <Card title={`À traiter (${day.length})`} subtitle="Du plus urgent au moins urgent">
        {day.length === 0 ? <p className="text-sm text-slate-600">Tout est à jour ✓</p> : (
          <ul className="divide-y divide-slate-100">
            {day.map((n) => (
              <li key={n.id} className="flex flex-col gap-1.5 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between">
                <span className={n.urgent ? 'font-semibold text-red-800' : 'text-slate-800'}>{n.urgent && '⚠ '}{n.text}</span>
                {n.to && <Button variant={n.urgent ? 'primary' : 'secondary'} className="!py-1 text-xs sm:shrink-0" onClick={() => open(n.to, n.intent)}>{n.action ?? 'Voir'}</Button>}
              </li>
            ))}
          </ul>
        )}
      </Card>
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 xl:grid-cols-2">
        <Card title={`Ma journée : séances à surveiller (${toSupervise.length})`} subtitle="Professeurs absents : les élèves viennent, en étude surveillée"
          action={<Button variant="secondary" className="!py-1 text-xs" onClick={() => go?.('hours')}>Tout voir</Button>}>
          {toSupervise.length === 0 ? <p className="text-sm text-slate-600">Aucune séance à surveiller aujourd'hui.</p> : (
            <ul className="divide-y divide-slate-100 text-sm">
              {toSupervise.map((x) => (
                <li key={`${x.id}-${x.slot?.id}`} className="py-2"><span className="font-medium">{x.slot?.start.replace(':', 'h')}–{x.slot?.end.replace(':', 'h')} · {x.slot?.cls}</span>
                  <span className="block text-xs text-slate-600">{x.slot?.subject} · {teacher(x.teacherId)} absent{x.workText ? ` · travail : ${x.workText}` : ''}</span></li>
              ))}
            </ul>
          )}
        </Card>
        <Card title={`Objets en garde (${objects.length})`} subtitle="À rendre à la date prévue"
          action={<Button variant="secondary" className="!py-1 text-xs" onClick={() => go?.('cpe-objets')}>Ouvrir</Button>}>
          {objects.length === 0 ? <p className="text-sm text-slate-600">Aucun objet en garde.</p> : (
            <ul className="divide-y divide-slate-100 text-sm">
              {objects.slice(0, 5).map((p) => <li key={p.id} className="flex items-center justify-between gap-2 py-2"><span><strong>{p.student}</strong> · {p.object}</span><Badge tone="slate">{p.at.slice(8, 10)}/{p.at.slice(5, 7)}</Badge></li>)}
              {objects.length > 5 && <li className="py-2 text-xs text-slate-600">et {objects.length - 5} autre{objects.length > 6 ? 's' : ''}…</li>}
            </ul>
          )}
        </Card>
      </div>
      <ColleSessionsCard role="VIE_SCOLAIRE" />
      <TodoList who="VIE_SCOLAIRE" title="Mes tâches" />
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => go?.('vs')}><Icon name="users" />Absences, retards et punitions</Button>
        <Button variant="secondary" onClick={() => go?.('care')}><Icon name="care" />Soins (secrétariat)</Button>
        <Button variant="secondary" onClick={() => go?.('tt-changes')}><Icon name="clock" />Annuler un cours aujourd'hui</Button>
      </div>
      <ActivityJournal go={go} />
      <AbsentToggle role="VIE_SCOLAIRE" />
    </div>
  );
}
