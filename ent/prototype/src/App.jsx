import React, { useState } from 'react';
import { Icon } from './components/ui.jsx';
import DirectionDashboard from './components/DirectionDashboard.jsx';
import BookingModule from './components/BookingModule.jsx';
import AppreciationModule from './components/AppreciationModule.jsx';
import SettingsModule from './components/SettingsModule.jsx';
import { DEFAULT_SETTINGS } from './data/settings.js';
import { DIRECTION_ACCOUNTS } from './data/demo.js';

// Arborescence du profil Direction (cf. docs/02-architecture-ux.md).
// Les entrées sans `screen` existent dans l'architecture mais pas dans ce prototype.
const NAV = [
  { group: 'Pilotage', items: [
    { id: 'dashboard', label: 'Tableau de bord', icon: 'home', screen: DirectionDashboard },
    { id: 'students', label: 'Élèves & mobilité', icon: 'users' },
    { id: 'finance', label: 'Finances', icon: 'wallet' },
  ] },
  { group: 'Pédagogie', items: [
    { id: 'grades', label: 'Notes & bulletins', icon: 'pen', screen: AppreciationModule },
    { id: 'timetable', label: 'Emplois du temps', icon: 'clock' },
    { id: 'booking', label: 'Réservations', icon: 'calendar', screen: BookingModule },
    { id: 'exams', label: 'Examens & Campus France', icon: 'cap' },
  ] },
  { group: 'Communication', items: [
    { id: 'news', label: 'Annonces', icon: 'megaphone' },
    { id: 'notify', label: 'Notifications parents', icon: 'bell' },
  ] },
  { group: 'Administration', items: [
    { id: 'settings', label: 'Paramètres', icon: 'settings', screen: SettingsModule },
  ] },
];

const STORAGE_KEY = 'ent-chateaubriand-settings-v1';

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved?.dunning && saved?.tuition && saved?.calendar) return { ...DEFAULT_SETTINGS, ...saved };
  } catch { /* stockage indisponible : valeurs par défaut */ }
  return DEFAULT_SETTINGS;
}

export default function App() {
  const [settings, setSettingsState] = useState(loadSettings);
  const setSettings = (next) => {
    setSettingsState(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* navigation privée */ }
  };

  const [screen, setScreen] = useState('dashboard');
  const [accountId, setAccountId] = useState('u1');
  const account = DIRECTION_ACCOUNTS.find((a) => a.id === accountId);
  const Current = NAV.flatMap((g) => g.items).find((i) => i.id === screen).screen;

  return (
    <div className="min-h-screen lg:flex">
      <aside className="border-b border-navy-700 bg-navy-900 text-navy-100 lg:sticky lg:top-0 lg:h-screen lg:w-60 lg:shrink-0 lg:overflow-y-auto lg:border-b-0">
        <div className="flex items-center justify-between gap-2 px-4 py-4">
          <div>
            <p className="text-base font-semibold text-white">Chateaubriand</p>
            <p className="text-xs text-navy-200">ENT · Tana & Tamatave</p>
          </div>
          <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide">Prototype</span>
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
                    <Icon name={item.icon} />
                    {item.label}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="hidden border-t border-white/10 px-4 py-3 lg:block">
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
        </div>
      </aside>

      <main className="mx-auto w-full max-w-[1400px] px-4 py-6 lg:px-8">
        <Current account={account} settings={settings} onChange={setSettings} onReset={() => setSettings(DEFAULT_SETTINGS)} />
      </main>
    </div>
  );
}
