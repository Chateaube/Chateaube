import React, { useEffect, useState } from 'react';
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
import InscriptionsModule from './components/InscriptionsModule.jsx';
import TeacherOversight from './components/TeacherOversight.jsx';
import Messenger from './components/Messenger.jsx';
import ImportModule from './components/ImportModule.jsx';
import BulletinsModule from './components/BulletinsModule.jsx';
import pillar from './assets/pilier.png';
import { useScreenGuard } from './screenGuard.js';

const THEMES = [['ocean', 'Océan (dégradé bleu)'], ['aurore', 'Aurore (dégradé violet-corail)'], ['classique', 'Classique (bleu uni)'], ['elegant', 'Élégant (clair)']];
import { DEFAULT_SETTINGS } from './data/settings.js';
import { DIRECTION_ACCOUNTS } from './data/demo.js';

// Un portail par profil (cf. docs/02-architecture-ux.md, matrice des droits).
// Direction = administrateur (accès à tout). Bureau = administration / économat,
// avec accès à la Vie scolaire ; la Vie scolaire n'a pas accès au Bureau.
// Les entrées sans `screen` existent dans l'architecture mais pas dans ce prototype.
const VIE_SCOLAIRE = { id: 'vs', label: 'Vie scolaire', icon: 'users', screen: VieScolaireModule };
const COUNCIL = { id: 'council', label: 'Conseils de classe', icon: 'cap', screen: CouncilGrid };
const BULLETINS = { id: 'bulletins', label: 'Bulletins', icon: 'pen', screen: BulletinsModule };
const BOOKING = { id: 'booking', label: 'Réservations', icon: 'calendar', screen: BookingModule };
const INSCRIPTIONS = { id: 'enrol', label: 'Inscriptions & fiches élèves', icon: 'users', screen: InscriptionsModule };
const OVERSIGHT = [
  { id: 'oversight-grades', label: 'Notes & appréciations (profs)', icon: 'pen', screen: (p) => <TeacherOversight {...p} view="grades" /> },
  { id: 'oversight-homework', label: 'Cahier de textes (profs)', icon: 'calendar', screen: (p) => <TeacherOversight {...p} view="homework" /> },
];
const MESSAGES = { id: 'messages', label: 'Messages', icon: 'bell', screen: () => (
  <div className="space-y-4">
    <div><p className="text-sm font-semibold text-navy-500">Texte et photos · application et e-mail</p><h1 className="text-2xl font-semibold text-navy-900">Messages</h1></div>
    <Messenger audience="STAFF" />
  </div>
) };
const IMPORT = { id: 'import', label: 'Importer des données (Excel)', icon: 'swap', screen: ImportModule };
const FOLLOW_UP = { id: 'followup', label: 'Documents, stages & orientation', icon: 'pen', screen: FollowUpModule };

const PROFILES = {
  DIRECTION: {
    label: 'Direction',
    title: 'Administrateur — accès complet',
    home: 'dashboard',
    nav: [
      { group: 'Pilotage', items: [
        { id: 'dashboard', label: 'Tableau de bord', icon: 'home', screen: DirectionDashboard },
        INSCRIPTIONS,
        { id: 'students', label: 'Mobilité Tamatave → Tana', icon: 'swap' },
        { id: 'accounting', label: 'Comptabilité', icon: 'wallet', screen: AccountingModule },
      ] },
      { group: 'Pédagogie', items: [
        COUNCIL,
        BULLETINS,
        ...OVERSIGHT,
        { id: 'timetable', label: 'Emplois du temps', icon: 'clock' },
        BOOKING,
        { id: 'exams', label: 'Examens & Campus France', icon: 'cap' },
      ] },
      { group: 'Vie scolaire & familles', items: [
        VIE_SCOLAIRE,
        FOLLOW_UP,
        MESSAGES,
        { id: 'news', label: 'Annonces', icon: 'megaphone' },
      ] },
      { group: 'Administration', items: [
        { id: 'staff', label: 'Gestion des agents', icon: 'users', screen: StaffModule },
        IMPORT,
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
        INSCRIPTIONS,
        IMPORT,
        COUNCIL,
        BULLETINS,
        ...OVERSIGHT,
      ] },
      { group: 'Accès partagé', items: [MESSAGES, VIE_SCOLAIRE, FOLLOW_UP, BOOKING] },
    ],
  },
  VIE_SCOLAIRE: {
    label: 'Vie scol.',
    title: 'Vie scolaire',
    home: 'vs',
    nav: [{ group: 'Vie scolaire', items: [VIE_SCOLAIRE, MESSAGES, FOLLOW_UP, BOOKING, { id: 'news', label: 'Annonces', icon: 'megaphone' }] }],
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
      { group: 'Communication', items: [MESSAGES] },
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

  // Ambiance graphique (préférence de l'utilisateur, mémorisée dans le navigateur)
  const [theme, setThemeState] = useState(() => { try { return localStorage.getItem('ent-theme') || 'ocean'; } catch { return 'ocean'; } });
  const setTheme = (t) => { setThemeState(t); try { localStorage.setItem('ent-theme', t); } catch { /* navigation privée */ } };
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);

  // Protection d'écran : tous les profils sauf Direction et Bureau
  const [protection, setProtection] = useState(true);
  const protectedProfile = protection && !['DIRECTION', 'BUREAU'].includes(profile);
  const hidden = useScreenGuard(protectedProfile);

  const [openGroup, setOpenGroup] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const goTo = (id) => { setScreen(id); setOpenGroup(null); setMobileOpen(false); };
  const activeGroup = NAV.find((g) => g.items.some((i) => i.id === screen))?.group;
  const navItem = (item, onDark) => {
    const enabled = Boolean(item.screen);
    const active = item.id === screen;
    return (
      <button key={item.id} onClick={() => enabled && goTo(item.id)} disabled={!enabled}
        title={enabled ? undefined : 'Prévu dans l\'architecture — hors périmètre du prototype'}
        className={`flex w-full items-center gap-3 whitespace-nowrap rounded-xl px-3 py-2 text-left text-sm transition
          ${active ? 'bg-navy-50 font-semibold text-navy-900' : enabled ? 'text-slate-700 hover:bg-slate-100' : 'text-slate-300'} ${onDark ? '' : ''}`}>
        <Icon name={item.icon} className={`h-[18px] w-[18px] shrink-0 ${active ? 'text-navy-500' : 'text-slate-400'}`} />
        <span className="truncate">{item.label}</span>
        {!enabled && <span className="ml-auto text-[10px] font-normal">bientôt</span>}
      </button>
    );
  };

  return (
    <div className={`min-h-screen ${protectedProfile ? 'screen-guard' : ''}`} onClick={() => { setOpenGroup(null); setAccountOpen(false); }}>
      {/* Bandeau du prototype : changer de profil, d'ambiance, protection d'écran */}
      <div className="print:hidden bg-slate-900 px-4 py-1.5 text-[11px] text-slate-300 lg:px-8">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-4 gap-y-1.5">
          <span className="rounded-full bg-amber-400/90 px-2 py-0.5 font-semibold text-slate-900">Prototype · données fictives</span>
          <span className="flex min-w-0 flex-wrap items-center gap-1.5">Voir l'ENT en tant que
            <span className="flex max-w-[calc(100vw-2rem)] gap-0.5 overflow-x-auto rounded-full bg-white/10 p-0.5" role="tablist" aria-label="Profil">
              {Object.entries(PROFILES).map(([k, p]) => (
                <button key={k} role="tab" aria-selected={profile === k} onClick={() => switchProfile(k)}
                  className={`shrink-0 whitespace-nowrap rounded-full px-2.5 py-0.5 font-medium ${profile === k ? 'bg-white text-slate-900' : 'text-white hover:bg-white/10'}`}>{p.label}</button>
              ))}
            </span>
          </span>
          <label className="flex items-center gap-1.5">Ambiance
            <select value={theme} onChange={(e) => setTheme(e.target.value)} aria-label="Ambiance" className="rounded-full border-0 bg-white/10 px-2 py-0.5 text-white">
              {THEMES.map(([id, l]) => <option key={id} value={id} className="text-slate-900">{l}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-1.5"><input type="checkbox" checked={protection} onChange={(e) => setProtection(e.target.checked)} />Protection d'écran (sauf Direction et Bureau)</label>
        </div>
      </div>

      {/* Barre du haut : logo, menu, compte */}
      <header className="print:hidden sticky top-0 z-30 shadow-[0_8px_24px_-16px_rgb(0_51_102/0.6)]" style={{ background: 'var(--topbar)', color: 'var(--topbar-fg)' }}>
        <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-3 px-4 lg:px-8">
          <button className="flex shrink-0 items-center gap-2.5" onClick={() => goTo(PROFILES[profile].home)} aria-label="Accueil">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white p-1 shadow-sm"><img src={pillar} alt="" className="h-full" /></span>
            <span className="hidden text-left leading-tight sm:block">
              <span className="block font-display text-[15px] font-semibold tracking-wide">CHATEAUBRIAND</span>
              <span className="block text-[11px]" style={{ color: 'var(--topbar-muted)' }}>Tamatave · {PROFILES[profile].title}</span>
            </span>
          </button>

          <nav aria-label="Navigation principale" className="ml-4 hidden flex-1 items-center gap-1 lg:flex">
            {NAV.map((g) => {
              const single = g.items.length === 1;
              const active = g.group === activeGroup;
              return (
                <div key={g.group} className="relative" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => (single ? goTo(g.items[0].id) : setOpenGroup(openGroup === g.group ? null : g.group))}
                    aria-expanded={single ? undefined : openGroup === g.group}
                    className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium transition ${active ? 'bg-white/20 shadow-inner' : 'hover:bg-white/10'}`}
                    style={theme === 'elegant' ? { background: active ? '#eef4fb' : undefined } : undefined}>
                    {single ? g.items[0].label : g.group}
                    {!single && <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 opacity-70" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 8l5 5 5-5" /></svg>}
                  </button>
                  {openGroup === g.group && (
                    <div className="absolute left-0 top-full z-40 mt-2 w-72 rounded-2xl bg-white p-2 text-slate-800 shadow-2xl ring-1 ring-slate-200">
                      {g.items.map((item) => navItem(item))}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-white/15" aria-label="Notifications" role="img">
              <Icon name="bell" className="h-[18px] w-[18px]" />
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-orange-400" />
            </span>
            <div className="relative" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => setAccountOpen(!accountOpen)} className="flex items-center gap-2 rounded-full py-1 pl-1 pr-3 hover:bg-white/10">
                <Avatar name={persona.name} className="h-8 w-8 text-[11px] ring-2 ring-white/60" />
                <span className="hidden text-left text-xs leading-tight md:block"><span className="block font-semibold">{persona.short ?? persona.name}</span><span style={{ color: 'var(--topbar-muted)' }}>{persona.detail}</span></span>
              </button>
              {accountOpen && (
                <div className="absolute right-0 top-full z-40 mt-2 w-72 rounded-2xl bg-white p-4 text-sm text-slate-700 shadow-2xl ring-1 ring-slate-200">
                  <p className="font-semibold text-slate-900">{persona.name}</p>
                  <p className="text-xs text-slate-500">{persona.detail}</p>
                  {profile === 'DIRECTION' && (
                    <label className="mt-3 block text-xs text-slate-600">Compte Direction (droits identiques)
                      <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-2.5 py-1.5 text-sm">
                        {DIRECTION_ACCOUNTS.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </select>
                    </label>
                  )}
                  <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500"><span className="flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-navy-900 ring-1 ring-slate-200">G</span>Connexion Google · même compte sur ordinateur et téléphone</p>
                </div>
              )}
            </div>
            <button className="rounded-full p-2 hover:bg-white/10 lg:hidden" aria-label="Menu" aria-expanded={mobileOpen} onClick={(e) => { e.stopPropagation(); setMobileOpen(!mobileOpen); }}>
              <Icon name="menu" className="h-6 w-6" />
            </button>
          </div>
        </div>
        {mobileOpen && (
          <nav aria-label="Navigation principale (mobile)" className="max-h-[75vh] overflow-y-auto border-t border-white/10 bg-white px-4 py-3 text-slate-800 lg:hidden" onClick={(e) => e.stopPropagation()}>
            {NAV.map((g) => (
              <div key={g.group} className="mb-2">
                <p className="px-3 pb-1 text-[11px] font-semibold text-slate-400">{g.group}</p>
                {g.items.map((item) => navItem(item))}
              </div>
            ))}
          </nav>
        )}
      </header>

      <main className="mx-auto w-full max-w-[1400px] px-4 py-6 lg:px-8">
        <Current key={`${profile}-${screen}`} account={account} settings={settings} onChange={setSettings} onReset={() => setSettings(DEFAULT_SETTINGS)} go={setScreen} role={profile} />
      </main>

      {protectedProfile && <div aria-hidden="true" className="screen-watermark">{`${persona.name} · ${persona.detail} · `.repeat(60)}</div>}
      {hidden && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black text-center text-sm text-slate-400" role="alert">
          Contenu masqué : les captures d'écran ne sont pas autorisées.<br />Revenez sur la page pour continuer.
        </div>
      )}
    </div>
  );
}
