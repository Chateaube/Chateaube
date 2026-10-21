import React, { useMemo, useState } from 'react';
import TodoList from './TodoList.jsx';
import ActivityJournal from './ActivityJournal.jsx';
import { Badge, Button, Card, Icon, Progress, Stat } from './ui.jsx';
import { SITES, SITE_KPIS, CANDIDATE_FILES, YEAR_MILESTONES, TODAY } from '../data/demo.js';
import { ATTENDANCE } from '../data/schoollife.js';
import { upcomingColleSessions } from '../rules/discipline.js';
import { loadPassport } from './PassportTab.jsx';

const pct = (a, b) => (b ? (a / b) * 100 : 0);

import { notificationsFor } from '../notify.js';

export default function DirectionDashboard({ account, settings, go, site: headerSite = 'TMV' }) {
  const site = headerSite; // un seul sélecteur de site : celui de la barre du haut
  const decisionsToTake = notificationsFor('DIRECTION', { account }).todo;
  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-semibold text-navy-500">Année scolaire 2026-2027 · {site === 'TMV' ? 'Tamatave' : 'Tana'}</p>
        <h1 className="text-2xl font-semibold text-navy-900">Bonjour {account.name.replace(/ \(.*\)$/, '')}</h1>
        <p className="text-sm text-slate-600">{decisionsToTake.length ? `${decisionsToTake.length} décision${decisionsToTake.length > 1 ? 's' : ''} vous attend${decisionsToTake.length > 1 ? 'ent' : ''}.` : 'Aucune décision en attente.'}</p>
      </div>

      {/* Ma journée : les décisions à prendre (à gauche) et les tâches (à droite), côte à côte */}
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 xl:grid-cols-2">
      <Card title="Mes décisions" subtitle="Ce qui attend la Direction, du plus urgent au moins urgent">
        {decisionsToTake.length === 0 ? <p className="text-sm text-slate-600">Rien à décider pour l'instant ✓</p> : (
          <ul className="divide-y divide-slate-100">
            {decisionsToTake.map((d, k) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <span className="flex items-center gap-3 text-sm text-slate-800"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-navy-50 text-xs font-bold text-navy-700">{k + 1}</span>{d.text}</span>
                <span className="flex items-center gap-2"><Button onClick={() => go?.(d.to)}>{d.action}</Button></span>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <TodoList who="DIRECTION" title="Mes tâches" />
      </div>
      <ActivityJournal />

      <h2 className="pt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">L'école en un coup d'œil</h2>
      {/* Indicateurs (la caisse, les impayés et la trésorerie sont dans Caisse et comptabilité) */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Élèves inscrits" value={SITE_KPIS[site]?.students ?? SITE_KPIS.TMV.students} hint={SITES.find((s) => s.id === site)?.name ?? ''} />
        <Stat label="Absences aujourd'hui" value={ATTENDANCE.filter((a) => a.date === TODAY && a.kind === 'ABSENCE').length} hint="d'après l'appel" />
        <Stat label="Colles cette semaine" value={upcomingColleSessions(loadPassport().colles, TODAY).reduce((t, x) => t + x.students, 0)} hint="mercredi après-midi, samedi matin" />
        <Stat label="Dossiers d'examen complets" value={`${CANDIDATE_FILES.complete} sur ${CANDIDATE_FILES.total}`} hint="Dépôt avant le 30 octobre" />
      </div>

      <Card title="Examens & dossiers externes" subtitle="Académie de La Réunion · candidats libres">
        <div className="mb-4">
          <div className="mb-1 flex justify-between text-xs text-slate-600">
            <span>Dossiers DNB / Bac déposés</span>
            <span className="tabular-nums">{CANDIDATE_FILES.complete} complets · {CANDIDATE_FILES.incomplete} incomplets · {CANDIDATE_FILES.toBuild} à constituer</span>
          </div>
          <Progress value={pct(CANDIDATE_FILES.complete, CANDIDATE_FILES.total)} tone="amber" label="Dossiers d'examen complets" />
        </div>
        <ol className="relative space-y-3 border-l border-slate-200 pl-4">
          {YEAR_MILESTONES.map((m) => (
            <li key={m.title} className="relative">
              <span className={`absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full ring-2 ring-white ${m.state === 'now' ? 'bg-amber-500' : 'bg-slate-300'}`} />
              <p className="text-sm"><span className="font-semibold text-navy-900">{m.month}</span> — {m.title}{m.state === 'now' && <Badge tone="amber" className="ml-2">En cours</Badge>}</p>
              <p className="text-xs text-slate-500">{m.detail}</p>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
