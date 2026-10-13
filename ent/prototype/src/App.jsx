import React, { useState } from 'react';
import { Icon, Avatar } from './components/ui.jsx';
import DirectionDashboard from './components/DirectionDashboard.jsx';
import BookingModule from './components/BookingModule.jsx';
import GradebookModule from './components/GradebookModule.jsx';
import CouncilGrid from './components/CouncilGrid.jsx';
import VieScolaireModule from './components/VieScolaireModule.jsx';
import BureauHome from './components/BureauHome.jsx';
import HomeworkModule from './components/HomeworkModule.jsx';
import FollowUpModule from './components/FollowUpModule.jsx';
import SettingsModule from './components/SettingsModule.jsx';
import AccountingModule from './components/AccountingModule.jsx';
import StaffModule from './components/StaffModule.jsx';
import TeacherPortal from './components/TeacherPortal.jsx';
import FamilyPortal from './components/FamilyPortal.jsx';
import { DEFAULT_SETTINGS } from './data/settings.js';
import { DIRECTION_ACCOUNTS } from './data/demo.js';

// Un portail par profil (cf. docs/02-architecture-ux.md, matrice des droits).
// Direction = administrateur (accès à tout). Bureau = administration / économat,
// avec accès à la Vie scolaire ; la Vie scolaire n'a pas accès au Bureau.
// Les entrées sans `screen` existent dans l'architecture mais pas dans ce prototype.
const VIE_SCOLAIRE = { id: 'vs', label: 'Vie scolaire', icon: 'users', screen: VieScolaireModule };
const COUNCIL = { id: 'council', label: 'Conseils de classe', icon: 'cap', screen: CouncilGrid };
const BOOKING = { id: 'booking', label: 'Réservations', icon: 'calendar', screen: BookingModule };
const FOLLOW_UP = { id: 'followup', label: 'Documents, stages & orientation', icon: 'pen', screen: FollowUpModule };

const PROFILES = {
  DIRECTION: {
    label: 'Direction',
    title: 'Administrateur — accès complet',
    home: 'dashboard',
    nav: [
      { group: 'Pilotage', items: [
        { id: 'dashboard', label: 'Tableau de bord', icon: 'home', screen: DirectionDashboard },
        { id: 'students', label: 'Élèves & mobilité', icon: 'users' },
        { id: 'accounting', label: 'Comptabilité', icon: 'wallet', screen: AccountingModule },
      ] },
      { group: 'Pédagogie', items: [
        COUNCIL,
        { id: 'timetable', label: 'Emplois du temps', icon: 'clock' },
        BOOKING,
        { id: 'exams', label: 'Examens & Campus France', icon: 'cap' },
      ] },
      { group: 'Vie scolaire & familles', items: [
        VIE_SCOLAIRE,
        FOLLOW_UP,
        { id: 'news', label: 'Annonces', icon: 'megaphone' },
      ] },
      { group: 'Administration', items: [
        { id: 'staff', label: 'Gestion des agents', icon: 'users', screen: StaffModule },
        { id: 'settings', label: 'Paramètres', icon: 'settings', screen: SettingsModule },
      ] },
    ],
  },
  BUREAU: {
    label: 'Bureau',
    title: 'Administration / économat',
    home: 'bureau',
    nav: [
      { group: 'Bureau', items: [
        { id: 'bureau', label: 'Accueil', icon: 'home', screen: BureauHome },
        { id: 'accounting', label: 'Encaissements & comptabilité', icon: 'wallet', screen: AccountingModule },
        { id: 'enrol', label: 'Inscriptions', icon: 'users' },
        COUNCIL,
      ] },
      { group: 'Accès partagé', items: [VIE_SCOLAIRE, FOLLOW_UP, BOOKING] },
    ],
  },
  VIE_SCOLAIRE: {
    label: 'Vie scol.',
    title: 'Vie scolaire',
    home: 'vs',
    nav: [{ group: 'Vie scolaire', items: [VIE_SCOLAIRE, FOLLOW_UP, BOOKING, { id: 'news', label: 'Annonces', icon: 'megaphone' }] }],
  },
  ENSEIGNANT: {
    label: 'Enseignant',
    title: 'Enseignant.e',
    home: 'teacher',
    nav: [
      { group: 'Ma journée', items: [
        { id: 'teacher', label: 'Mon tableau de bord', icon: 'home', screen: TeacherPortal },
        { id: 'grades', label: 'Notes & appréciations', icon: 'pen', screen: GradebookModule },
        { id: 'homework', label: 'Cahier de textes', icon: 'calendar', screen: HomeworkModule },
        { id: 'discipline', label: 'Punitions & téléphones', icon: 'alert', screen: VieScolaireModule },
        BOOKING,
      ] },
      { group: 'Communication', items: [{ id: 'notify', label: 'Message à un parent', icon: 'bell' }] },
    ],
  },
  PARENT: {
    label: 'Parent',
    title: 'Famille',
    home: 'parent',
    nav: [{ group: 'Famille', items: [{ id: 'parent', label: 'Portail parents', icon: 'users', screen: (p) => <FamilyPortal {...p} audience="PARENT" /> }] }],
  },
  ELEVE: {
    label: 'Élève',
    title: 'Élève',
    home: 'eleve',
    nav: [{ group: 'Élève', items: [{ id: 'eleve', label: 'Portail élèves', icon: 'cap', screen: (p) => <FamilyPortal {...p} audience="ELEVE" /> }] }],
  },
};

// Personne connectée, par profil (démonstration)
const PERSONAS = {
  BUREAU: { name: 'Mme Hanta', short: 'Mme Hanta', detail: 'Économat · Tamatave' },
  VIE_SCOLAIRE: { name: 'M. Be', short: 'M. Be', detail: 'Vie scolaire · Tamatave' },
  ENSEIGNANT: { name: 'Mme RANAIVO', short: 'Mme Ranaivo', detail: 'Management · SGN' },
  PARENT: { name: 'Mme RAKOTOARISOA', short: 'Mme Rakotoarisoa', detail: 'Maman d\'Aina et de Toky' },
  ELEVE: { name: 'Aina RAKOTOARISOA', short: 'Aina', detail: '1re STMG · Tamatave' },
};

const STORAGE_KEY = 'ent-chateaubriand-settings-v3'; // v3 : base de compétences issue des trimestres précédents

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved?.dunning && saved?.tuition && saved?.calendar) return { ...DEFAULT_SETTINGS, ...saved, grading: { ...DEFAULT_SETTINGS.grading, ...saved.grading }, competencies: saved.competencies ?? DEFAULT_SETTINGS.competencies };
  } catch { /* stockage indisponible : valeurs par défaut */ }
  return DEFAULT_SETTINGS;
}

export default function App() {
  const [settings, setSettingsState] = useState(loadSettings);
  const setSettings = (next) => {
    setSettingsState(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* navigation privée */ }
  };

  const [profile, setProfile] = useState('DIRECTION');
  const [screen, setScreen] = useState('dashboard');
  const [accountId, setAccountId] = useState('u1');
  const account = DIRECTION_ACCOUNTS.find((a) => a.id === accountId);
  const NAV = PROFILES[profile].nav;
  const Current = NAV.flatMap((g) => g.items).find((i) => i.id === screen).screen;
  const switchProfile = (p) => { setProfile(p); setScreen(PROFILES[p].home); };

  const persona = profile === 'DIRECTION' ? { name: account.name, detail: account.email } : PERSONAS[profile];

  return (
    <div className="min-h-screen lg:flex">
      <aside className="print:hidden border-b border-slate-200/70 bg-white/70 backdrop-blur lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-64 lg:shrink-0 lg:flex-col lg:overflow-y-auto lg:border-b-0 lg:border-r">
        <div className="flex items-center gap-3 px-5 pt-5 pb-4">
          <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-navy-900 font-display text-xl font-semibold text-white">
            C<span className="absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full border-2 border-white bg-coral-500" />
          </span>
          <div className="min-w-0">
            <p className="font-display text-lg leading-tight font-semibold text-navy-900">Chateaubriand</p>
            <p className="text-xs text-slate-500">Espace numérique · Tana & Tamatave</p>
          </div>
        </div>

        <div className="px-4 pb-4">
          <p className="mb-1.5 px-1 text-[11px] font-medium text-slate-400">Voir l'ENT en tant que</p>
          <div className="flex gap-1 overflow-x-auto rounded-2xl bg-slate-100 p-1 lg:grid lg:grid-cols-3" role="tablist" aria-label="Profil">
            {Object.entries(PROFILES).map(([k, p]) => (
              <button key={k} role="tab" aria-selected={profile === k} onClick={() => switchProfile(k)}
                className={`shrink-0 rounded-xl px-2 py-1.5 text-[11px] font-medium transition ${profile === k ? 'bg-white text-navy-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <nav aria-label="Navigation principale" className="flex gap-1 overflow-x-auto px-3 pb-3 lg:block lg:flex-1 lg:space-y-5 lg:overflow-visible">
          {NAV.map((g) => (
            <div key={g.group} className="contents lg:block">
              <p className="hidden px-3 pb-1.5 text-[11px] font-semibold text-slate-400 lg:block">{g.group}</p>
              {g.items.map((item) => {
                const active = item.id === screen;
                const enabled = Boolean(item.screen);
                return (
                  <button
                    key={item.id}
                    onClick={() => enabled && setScreen(item.id)}
                    disabled={!enabled}
                    title={enabled ? undefined : 'Prévu dans l\'architecture — hors périmètre du prototype'}
                    className={`group flex shrink-0 items-center gap-3 whitespace-nowrap rounded-xl px-3 py-2 text-sm transition lg:w-full
                      ${active ? 'bg-navy-50 font-semibold text-navy-900' : enabled ? 'text-slate-600 hover:bg-slate-100 hover:text-slate-900' : 'hidden text-slate-300 lg:flex'}`}
                  >
                    <Icon name={item.icon} className={`h-[18px] w-[18px] shrink-0 ${active ? 'text-navy-700' : enabled ? 'text-slate-400 group-hover:text-slate-600' : ''}`} />
                    <span className="truncate">{item.label}</span>
                    {active && <span className="ml-auto hidden h-1.5 w-1.5 rounded-full bg-coral-500 lg:block" />}
                    {!enabled && <span className="ml-auto text-[10px] font-normal">bientôt</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="hidden border-t border-slate-200/70 p-4 lg:block">
          <div className="flex items-center gap-3">
            <Avatar name={persona.name} className="h-9 w-9 text-xs" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-800">{persona.name}</p>
              <p className="truncate text-[11px] text-slate-500">{persona.detail}</p>
            </div>
          </div>
          {profile === 'DIRECTION' && (
            <label className="mt-3 block text-[11px] text-slate-500">
              Compte Direction (droits identiques)
              <select value={accountId} onChange={(e) => setAccountId(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-800">
                {DIRECTION_ACCOUNTS.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </label>
          )}
          <p className="mt-3 flex items-center gap-1.5 text-[11px] text-slate-400">
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white text-[9px] font-bold text-navy-900 ring-1 ring-slate-200">G</span>
            Connexion Google · prototype
          </p>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="print:hidden mx-auto flex w-full max-w-[1400px] items-center justify-between gap-3 px-4 pt-5 lg:px-10 lg:pt-7">
          <p className="text-sm text-slate-500">
            <span className="font-medium text-slate-700">Bonjour{persona.short ? ` ${persona.short}` : ''}</span>
            <span className="hidden sm:inline"> · mardi 13 octobre 2026 · {PROFILES[profile].title}</span>
          </p>
          <div className="flex items-center gap-2">
            <span className="hidden rounded-full bg-coral-50 px-2.5 py-1 text-[11px] font-medium text-coral-700 sm:inline">Prototype · données fictives</span>
            <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-500 shadow-soft" aria-label="Notifications" role="img">
              <Icon name="bell" className="h-[18px] w-[18px]" />
              <span className="absolute top-2 right-2.5 h-2 w-2 rounded-full border-2 border-white bg-coral-500" />
            </span>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1400px] px-4 py-5 lg:px-10 lg:py-6">
          <Current key={`${profile}-${screen}`} account={account} settings={settings} onChange={setSettings} onReset={() => setSettings(DEFAULT_SETTINGS)} go={setScreen} role={profile} />
        </main>
      </div>
    </div>
  );
}
