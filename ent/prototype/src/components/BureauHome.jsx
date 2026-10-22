import React from 'react';
import TodoList from './TodoList.jsx';
import AbsentToggle from './AbsentToggle.jsx';
import ActivityJournal from './ActivityJournal.jsx';
import { Badge, Button, Card, Icon, Stat } from './ui.jsx';
import { CASH_MOVEMENTS } from '../data/accounting.js';
import { formatAr } from '../rules/finance.js';
import { notificationsFor } from '../notify.js';

// Accueil du Bureau (administration / économat) : la journée de caisse et les dossiers à traiter.
export default function BureauHome({ go }) {
  const entries = CASH_MOVEMENTS.filter((m) => m.dir === 'IN');
  const live = notificationsFor('BUREAU').todo.map((t) => ({ label: t.text, detail: '', action: t.action, to: t.to, tone: 'amber' }));
  const todo = [...live,
    { label: '12 familles avec des frais de scolarité d\'octobre impayés', detail: 'Relances en pause en octobre — reprise en novembre', action: 'Encaisser', to: 'accounting', tone: 'amber' },
    { label: 'Nouvel élève : RASOAMANANA Fy (4e)', detail: 'Arrivé le 12/10 — inscription et frais de scolarité d\'octobre à encaisser', action: 'Encaisser', to: 'accounting', tone: 'navy' },
    { label: '39 dossiers d\'examen incomplets', detail: 'Dépôt à l\'Académie avant le 30 octobre', action: 'Voir les dossiers', to: 'followup', tone: 'amber' },
    { label: 'Conseils de classe du 1er trimestre', detail: 'Grilles disponibles dès que les enseignants ont validé leurs notes', action: 'Voir les grilles', to: 'council', tone: 'navy' },
  ];
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-navy-500">Secrétariat de Tamatave</p>
          <h1 className="text-2xl font-semibold text-navy-900">Bonjour Mme Hanta</h1>
          <p className="text-sm text-slate-600">Voici ce qui vous attend aujourd'hui.</p>
        </div>
        <Button onClick={() => go('accounting')}><Icon name="wallet" />Nouvel encaissement</Button>
      </div>
      <AbsentToggle role="BUREAU" />
      <TodoList who="BUREAU" title="Tâches confiées par la Direction" />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card title={`À traiter aujourd'hui (${todo.length})`}>
          <ul className="space-y-3">
            {todo.map((t) => (
              <li key={t.label} className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-start gap-3">
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${{ amber: 'bg-amber-500', navy: 'bg-navy-500' }[t.tone]}`} />
                  <div><p className="text-sm font-medium text-slate-800">{t.label}</p><p className="text-xs text-slate-500">{t.detail}</p></div>
                </div>
                {t.action && <Button variant="secondary" onClick={() => go(t.to)}>{t.action}</Button>}
              </li>
            ))}
          </ul>
        </Card>
        <div className="space-y-5">
        <Card title="Caisse du jour" subtitle={`${formatAr(entries.reduce((s, m) => s + m.amount, 0))} · ${entries.length} reçus · 1 chèque à déposer`}>
          <ul className="space-y-2 text-sm">
            {entries.map((m) => (
              <li key={m.id} className="flex items-start justify-between gap-2">
                <div className="min-w-0"><p className="truncate text-slate-800">{m.label}</p><p className="text-xs text-slate-500">{m.time} · {m.method}</p></div>
                <span className="whitespace-nowrap font-medium tabular-nums text-emerald-700">{formatAr(m.amount)}</span>
              </li>
            ))}
          </ul>
        </Card>
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Absences du jour" value="2" hint="Vie scolaire" />
          <Stat label="Frais échus" value="12" hint="Octobre" />
        </div>
        </div>
      </div>
      <ActivityJournal />
    </div>
  );
}
