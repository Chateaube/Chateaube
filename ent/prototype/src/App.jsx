import React, { useState } from 'react';
import { Icon } from './components/ui.jsx';
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

const STORAGE_KEY = 'ent-chateaubriand-settings-v2'; // v2 : canaux sans SMS, relance des accusés

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved?.dunning && saved?.tuition && saved?.calendar) return { ...DEFAULT_SETTINGS, ...saved, grading: { ...DEFAULT_SETTINGS.grading, ...saved.grading } };
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

  return (
    <div className="min-h-screen lg:flex">
      <aside className="print:hidden border-b border-navy-700 bg-navy-900 text-navy-100 lg:sticky lg:top-0 lg:h-screen lg:w-60 lg:shrink-0 lg:overflow-y-auto lg:border-b-0">
        <div className="flex items-center justify-between gap-2 px-4 py-4">
          <div>
            <p className="text-base font-semibold text-white">Chateaubriand</p>
            <p className="text-xs text-navy-200">ENT · Tana & Tamatave</p>
          </div>
          <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide">Prototype</span>
        </div>

        <div className="px-3 pb-3">
          <p className="mb-1 px-1 text-[11px] text-navy-200">Voir l'ENT en tant que</p>
          <div className="grid grid-cols-3 gap-1 rounded-lg bg-white/10 p-1 lg:grid-cols-3" role="tablist" aria-label="Profil">
            {Object.entries(PROFILES).map(([k, p]) => (
              <button key={k} role="tab" aria-selected={profile === k} onClick={() => switchProfile(k)}
                className={`rounded-md px-0.5 py-1 text-[11px] font-medium ${profile === k ? 'bg-white text-navy-900' : 'text-white hover:bg-white/10'}`}>
                {p.label}
              </button>
            ))}
          </div>
          <p className="mt-1.5 px-1 text-[11px] text-navy-200">{PROFILES[profile].title}</p>
        </div>

        <nav aria-label="Navigation principale" className="flex gap-1 overflow-x-auto px-2 pb-3 lg:block lg:space-y-4 lg:overflow-visible">
          {NAV.map((g) => (
            <div key={g.group} className="contents lg:block">
              <p className="hidden px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-navy-200/70 lg:block">{g.group}</p>
              {g.items.map((item) => {
                const active = item.id === screen;
                const enabled = Boolean(item.screen);
                return (
                  <button
                    key={item.id}
                    onClick={() => enabled && setScreen(item.id)}
                    disabled={!enabled}
                    title={enabled ? undefined : 'Prévu dans l\'architecture — hors périmètre du prototype'}
                    className={`flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-md px-2.5 py-1.5 text-sm lg:w-full
                      ${active ? 'bg-white text-navy-900' : enabled ? 'text-white hover:bg-white/10' : 'hidden text-navy-200/50 lg:flex'}`}
                  >
                    <Icon name={item.icon} className="h-4 w-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {profile === 'DIRECTION' && <div className="hidden border-t border-white/10 px-4 py-3 lg:block">
          <label className="block text-[11px] text-navy-200">
            Compte Direction (droits identiques)
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="mt-1 w-full rounded-md border-0 bg-white/10 px-2 py-1 text-sm text-white"
            >
              {DIRECTION_ACCOUNTS.map((a) => <option key={a.id} value={a.id} className="text-slate-900">{a.name}</option>)}
            </select>
          </label>
          <p className="mt-2 flex items-center gap-1.5 text-[11px] text-navy-200">
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white text-[9px] font-bold text-navy-900">G</span>
            Connexion Google · {account.email}
          </p>
        </div>}
      </aside>

      <main className="mx-auto w-full max-w-[1400px] px-4 py-6 lg:px-8">
        <Current key={`${profile}-${screen}`} account={account} settings={settings} onChange={setSettings} onReset={() => setSettings(DEFAULT_SETTINGS)} go={setScreen} role={profile} />
      </main>
    </div>
  );
}
