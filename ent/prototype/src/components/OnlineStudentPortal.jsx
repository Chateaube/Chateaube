import React, { useState } from 'react';
import { Icon } from './ui.jsx';
import AgendaModule from './AgendaModule.jsx';
import OrientationSheet from './OrientationSheet.jsx';
import { FamilyDocuments, TermsGate } from './InternalResources.jsx';
import { currentStudent, currentSchool } from '../online/school.js';
import { loadTimetable } from '../timetableStore.js';
import { loadChanges } from './TimetableChanges.jsx';
import { dayCourses, nowNext, shortSubject, subjectColor as courseColor } from '../rules/timetableGrid.js';
import { sheetKind } from '../rules/orientationSheet.js';
import { STEPS } from '../data/terminale.js';
import { formatDateFr } from '../rules/calendar.js';
import { today, nowTime } from '../clock.js';
import { DEFAULT_SETTINGS } from '../data/settings.js';

// Portail des élèves, version en ligne (test avant l'ouverture du 17 décembre) : emploi du temps du jour,
// agenda, documents de l'école, orientation (fiche + calendrier Parcoursup). Les autres rubriques sont visibles
// avec « en cours de création » ; les notes s'ouvrent le 17 décembre. Aucune donnée fictive.
const TABS = [['home', 'Accueil', 'home'], ['school', 'École', 'sparkles'], ['notes', 'Notes', 'pen'], ['agenda', 'Agenda', 'calendar'], ['more', 'Autres', 'menu']];
const MORE = [
  ['orientation', 'Orientation et Parcoursup', 'compass', true],
  ['schooldocs', 'Règlement et chartes', 'check', true],
  ['messages', 'Messages', 'bell', false],
  ['documents', 'Documents et autorisations', 'doc', false],
  ['library', 'Bibliothèque', 'book', false],
  ['stages', 'Stages', 'cap', false],
];
const ORIENT = /parcoursup|campus france|orientation|salon|post-?bac|voeux|vœux/i;

const Box = ({ title, children }) => (
  <section className="rounded-2xl bg-white p-4 shadow-soft">
    {title && <h2 className="mb-2 font-display text-base font-semibold text-navy-900">{title}</h2>}
    {children}
  </section>
);
const Soon = ({ title }) => (
  <Box title={title}>
    <p className="text-sm text-slate-600">Cette rubrique est <strong>en cours de création</strong>. Elle arrivera prochainement.</p>
  </Box>
);

function Today({ me, settings }) {
  const date = today(); const time = nowTime();
  const courses = dayCourses(loadTimetable(), me.cls, date, settings, loadChanges());
  const { now, next } = nowNext(courses, time);
  const card = (label, c) => (
    <div className="flex-1 rounded-xl p-3" style={{ background: c ? courseColor(c) : '#f1f5f9' }}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-700">{label}</p>
      {c ? <><p className="text-sm font-semibold text-slate-900">{shortSubject(c)}</p><p className="text-xs text-slate-700">{c.start.replace(':', 'h')}–{c.end.replace(':', 'h')}{c.room ? ` · ${c.room}` : ''}</p>
        {c.status === 'DEPLACE' && <p className="text-xs font-semibold text-red-700">Cours déplacé</p>}</>
        : <p className="text-sm text-slate-600">{label === 'Maintenant' ? 'Pas de cours' : 'Plus de cours aujourd\'hui'}</p>}
    </div>
  );
  return (
    <Box title={`Aujourd'hui — ${formatDateFr(date)}`}>
      {courses.length === 0 ? <p className="text-sm text-slate-600">Pas de cours aujourd'hui.</p> : (
        <>
          <div className="flex gap-2">{card('Maintenant', now)}{card('Ensuite', next)}</div>
          <ul className="mt-3 space-y-1">
            {courses.map((c) => (
              <li key={c.id} className={`flex items-center gap-2 text-sm ${c.status === 'ANNULE' ? 'text-red-700 line-through' : c.end <= time ? 'text-slate-400' : 'text-slate-800'}`}>
                <span className="w-24 shrink-0 tabular-nums">{c.start.replace(':', 'h')}–{c.end.replace(':', 'h')}</span><span>{shortSubject(c)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Box>
  );
}

function Orientation({ me, school }) {
  const dated = (school?.events ?? []).filter((e) => ORIENT.test(e.title) && (!e.classes?.length || e.classes.includes(me.cls)))
    .sort((a, b) => a.date.localeCompare(b.date));
  const isTle = /^Terminale/.test(me.cls);
  return (
    <>
      {sheetKind(me.cls) && <Box><OrientationSheet student={`${me.lastName} ${me.firstName}`.trim()} cls={me.cls} role="ELEVE" by={`${me.lastName} ${me.firstName}`.trim()} /></Box>}
      {isTle && (
        <Box title="Calendrier Parcoursup">
          {dated.length > 0 && (
            <ul className="mb-3 space-y-2">{dated.map((e) => (
              <li key={e.id} className="rounded-lg bg-navy-50 px-3 py-2 text-sm"><p className="font-semibold text-navy-900">{formatDateFr(e.date)}{e.end && e.end.length === 10 && e.end !== e.date ? ` → ${formatDateFr(e.end)}` : ''}</p><p className="text-slate-700">{e.title}</p></li>
            ))}</ul>
          )}
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Les grandes étapes</p>
          <ol className="space-y-1.5 text-sm text-slate-700">{STEPS.PARCOURSUP.map(([when, what]) => <li key={when}><strong>{when}</strong> : {what}</li>)}</ol>
          <p className="mt-3 text-xs text-slate-500">Les dates officielles sont publiées chaque année sur parcoursup.fr. L'école ajoute ici ses propres rendez-vous.</p>
        </Box>
      )}
      {!sheetKind(me.cls) && !isTle && <Soon title="Orientation" />}
    </>
  );
}

export default function OnlineStudentPortal({ settings }) {
  const me = currentStudent(); const school = currentSchool();
  const [view, setView] = useState('home');
  const st = { ...(settings ?? DEFAULT_SETTINGS), ...(school?.calendar ? { calendar: school.calendar } : {}) };
  if (!me) return (
    <div className="mx-auto max-w-md p-4"><Box title="Compte pas encore relié à une classe"><p className="text-sm text-slate-700">Ton compte existe, mais ta classe n'est pas encore indiquée. Préviens la Direction.</p></Box></div>
  );
  const go = (v) => { setView(v); window.scrollTo(0, 0); };
  const isTab = TABS.some(([id]) => id === view);
  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md flex-col">
      <header className="mt-2 rounded-[28px] px-5 pb-4 pt-5 text-white" style={{ background: 'linear-gradient(135deg, #003366, #00427f 55%, #0b6aa8)' }}>
        <p className="text-xs text-white">Chateaubriand · Tamatave</p>
        <h1 className="on-dark mt-0.5 font-display text-xl font-semibold text-white">Bonjour {me.firstName} · {me.cls}</h1>
      </header>
      <main className="flex-1 space-y-3 p-4 pb-24">
        <TermsGate phone viewer="ELEVE" account={me.id}>
          {!isTab && <button type="button" onClick={() => go('more')} className="text-sm font-medium text-navy-600">‹ Autres</button>}
          {view === 'home' && (<>
            <Today me={me} settings={st} />
            {(sheetKind(me.cls) || /^Terminale/.test(me.cls)) && (
              <button type="button" onClick={() => go('orientation')} className="flex w-full items-center justify-between rounded-2xl bg-amber-50 p-4 text-left shadow-soft">
                <span><span className="block font-semibold text-amber-900">Orientation{/^Terminale/.test(me.cls) ? ' et Parcoursup' : ''}</span><span className="text-sm text-amber-800">Ta fiche d'orientation et le calendrier</span></span><span aria-hidden="true">›</span>
              </button>
            )}
            <Box title="Mes notes"><p className="text-sm text-slate-600">Tes notes et tes moyennes seront visibles ici à partir du <strong>17 décembre</strong>.</p></Box>
          </>)}
          {view === 'school' && <Soon title="Vie de l'école, annonces et vie scolaire" />}
          {view === 'notes' && <Box title="Mes notes"><p className="text-sm text-slate-600">Tes notes et tes moyennes seront visibles ici à partir du <strong>17 décembre</strong>.</p></Box>}
          {view === 'agenda' && <AgendaModule compact role="ELEVE" cls={me.cls} settings={st} today={today()} />}
          {view === 'more' && (
            <Box>
              <ul className="divide-y divide-slate-100">{MORE.map(([id, label, icon, ready]) => (
                <li key={id}><button type="button" onClick={() => go(id)} className="flex min-h-[48px] w-full items-center justify-between gap-2 text-left text-sm">
                  <span className="flex items-center gap-2 text-slate-900"><Icon name={icon} />{label}</span>
                  {!ready && <span className="text-xs text-slate-500">en cours de création</span>}
                </button></li>
              ))}</ul>
            </Box>
          )}
          {view === 'orientation' && <Orientation me={me} school={school} />}
          {view === 'schooldocs' && <FamilyDocuments audience="ELEVE" />}
          {MORE.some(([id, , , ready]) => id === view && !ready) && <Soon title={MORE.find(([id]) => id === view)[1]} />}
        </TermsGate>
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto flex max-w-md justify-around border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)]" aria-label="Portail élève">
        {TABS.map(([id, label, icon]) => (
          <button key={id} type="button" onClick={() => go(id)} aria-current={view === id ? 'page' : undefined}
            className={`flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${view === id ? 'text-navy-700' : 'text-slate-500'}`}><Icon name={icon} />{label}</button>
        ))}
      </nav>
    </div>
  );
}
