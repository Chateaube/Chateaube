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
import { TermsGate } from './components/InternalResources.jsx';
import FamilyPortal from './components/FamilyPortal.jsx';
import InscriptionsModule from './components/InscriptionsModule.jsx';
import ManualsModule from './components/ManualsModule.jsx';
import LibraryModule from './components/LibraryModule.jsx';
import GradeSheets from './components/GradeSheets.jsx';
import AttendanceModule from './components/AttendanceModule.jsx';
import FeedbackModule, { FeedbackButton } from './components/Feedback.jsx';
import TeacherOversight from './components/TeacherOversight.jsx';
import Messenger from './components/Messenger.jsx';
import ImportModule from './components/ImportModule.jsx';
import BulletinsModule from './components/BulletinsModule.jsx';
import StudentList from './components/StudentList.jsx';
import AnnouncementsModule from './components/AnnouncementsModule.jsx';
import AgendaModule from './components/AgendaModule.jsx';
import BookCatalog from './components/BookCatalog.jsx';
import TeachingHours from './components/TeachingHours.jsx';
import MockExamsModule from './components/MockExamsModule.jsx';
import CareModule from './components/CareModule.jsx';
import InventoryModule from './components/InventoryModule.jsx';
import TimetableChanges from './components/TimetableChanges.jsx';
import InternalResources from './components/InternalResources.jsx';
import SignaturesModule from './components/SignaturesModule.jsx';
import { PublicPreregistration } from './components/FamilyRequests.jsx';
import SchoolLifeModule from './components/SchoolLifeModule.jsx';
import MandatesAdmin from './components/MandatesAdmin.jsx';
import { notificationsFor, countsByScreen, markSeen } from './notify.js';
import { useAmbiance } from './ambianceRuntime.js';
import AmbianceBand from './components/AmbianceNote.jsx';
import AmbianceEffects from './components/AmbianceEffects.jsx';
import { featureVisible } from './features.js';
import pillar from './assets/pilier.png';
import { useScreenGuard } from './screenGuard.js';
import { useOnline } from './online.js';

import { DEFAULT_SETTINGS } from './data/settings.js';
import { DIRECTION_ACCOUNTS } from './data/demo.js';

// Un portail par profil (cf. docs/02-architecture-ux.md, matrice des droits).
// Direction = administrateur (accès à tout). Bureau = administration / économat,
// avec accès à la Vie scolaire ; la Vie scolaire n'a pas accès au Bureau.
// Les entrées sans `screen` existent dans l'architecture mais pas dans ce prototype.
const VIE_SCOLAIRE = { id: 'vs', label: 'Absences, retards et punitions', icon: 'users', screen: VieScolaireModule };
const COUNCIL = { id: 'council', label: 'Conseils de classe', icon: 'cap', screen: CouncilGrid };
const BULLETINS = { id: 'bulletins', label: 'Bulletins', icon: 'pen', screen: BulletinsModule };
const BOOKING = { id: 'booking', label: 'Réservations de matériel', icon: 'calendar', screen: BookingModule, feature: 'reservations' };
const INSCRIPTIONS = { id: 'enrol', label: 'Inscriptions et fiches élèves', icon: 'users', screen: InscriptionsModule };
const OVERSIGHT = [
  { id: 'oversight-grades', label: 'Notes des professeurs', icon: 'pen', screen: (p) => <TeacherOversight {...p} view="grades" /> },
  { id: 'oversight-homework', label: 'Cahiers de textes', icon: 'calendar', screen: (p) => <TeacherOversight {...p} view="homework" /> },
];
const MESSAGES = { id: 'messages', label: 'Messages', icon: 'bell', screen: ({ role }) => (
  <div className="space-y-4">
    <div><p className="text-sm font-semibold text-navy-500">Professeurs, élèves, parents et personnel · texte et photos</p><h1 className="text-2xl font-semibold text-navy-900">Messages</h1></div>
    <Messenger audience={role === 'ENSEIGNANT' ? 'TEACHER' : 'STAFF'} />
  </div>
) };
const MANUALS = { id: 'manuals', label: 'Manuels scolaires', icon: 'cap', screen: ManualsModule };
const FEEDBACK = { id: 'feedback', label: 'Avis du pilote', icon: 'bell', screen: FeedbackModule };
const LIBRARY = { id: 'library', label: 'Bibliothèque (salle d\'étude)', icon: 'pen', screen: LibraryModule, feature: 'bibliotheque' };
const IMPORT = { id: 'import', label: 'Importer des données', icon: 'swap', screen: ImportModule };
const GRADE_SHEETS = { id: 'grade-sheets', label: 'Grilles de notes', icon: 'pen', screen: GradeSheets };
const BOOKS_FOR_TEACHER = { id: 'books', label: 'Bibliothèque et manuels', icon: 'cap', screen: () => <BookCatalog who="Mme Ranaivo" kind="PROF" /> };
const TT_CHANGES = { id: 'tt-changes', label: 'Changements d\'emploi du temps', icon: 'clock', screen: TimetableChanges };
const HOURS = { id: 'hours', label: 'Heures et absences des profs', icon: 'clock', screen: TeachingHours };
const RESOURCES = { id: 'resources', label: 'Documents, ressources et idées', icon: 'pen', screen: InternalResources };
const MOCK_EXAMS = { id: 'mock-exams', label: 'Examens blancs', icon: 'cap', screen: MockExamsModule, feature: 'examens-blancs' };
const CARE = { id: 'care', label: 'Soins et infirmerie', icon: 'care', screen: CareModule, feature: 'soins' };
const INVENTORY = { id: 'inventory', label: 'Inventaire du matériel', icon: 'box', screen: InventoryModule, feature: 'inventaire' };
const AGENDA = { id: 'agenda', label: 'Agendas', icon: 'calendar', screen: AgendaModule };
const NEWS = { id: 'news', label: 'Annonces', icon: 'megaphone', screen: AnnouncementsModule };
const SCHOOL_LIFE = { id: 'school-life', label: 'Vie de l\'école (photos)', icon: 'sparkles', screen: SchoolLifeModule, feature: 'vie-ecole' };
const STUDENT_LIST = { id: 'students-list', label: 'Liste des élèves', icon: 'users', screen: StudentList };
const SIGNATURES = { id: 'signatures', label: 'Documents à signer', icon: 'pen', screen: SignaturesModule };
const FOLLOW_UP = { id: 'followup', label: 'Documents, stages et orientation', icon: 'pen', screen: FollowUpModule };
const ACCOUNTING = { id: 'accounting', label: 'Caisse et comptabilité', icon: 'wallet', screen: AccountingModule };
const MANDATES = { id: 'mandates', label: 'Délégués et BDE', icon: 'users', screen: MandatesAdmin };
const ro = (item, label) => ({ ...item, ...(label ? { label } : {}), readOnly: true }); // consultation seulement

// Menu latéral par profil : mêmes noms et même place pour une fonction partagée entre rôles.
const PROFILES = {
  DIRECTION: {
    label: 'Direction',
    title: 'Administrateur — accès complet',
    home: 'dashboard',
    nav: [
      { group: 'Aujourd\'hui', items: [{ id: 'dashboard', label: 'Mes décisions', icon: 'home', screen: DirectionDashboard }, SIGNATURES, FEEDBACK] },
      { group: 'Élèves', items: [INSCRIPTIONS, STUDENT_LIST, { id: 'students', label: 'Mobilité Tamatave → Tana', icon: 'swap' }] },
      { group: 'Pédagogie', items: [COUNCIL, BULLETINS, MOCK_EXAMS, GRADE_SHEETS, ...OVERSIGHT, { id: 'timetable', label: 'Emplois du temps', icon: 'clock' }, { id: 'exams', label: 'Examens & Campus France', icon: 'cap' }] },
      { group: 'Vie scolaire', items: [VIE_SCOLAIRE, CARE, HOURS, TT_CHANGES, FOLLOW_UP, MANDATES] },
      { group: 'Finances', items: [ACCOUNTING] },
      { group: 'Communication', items: [MESSAGES, NEWS, SCHOOL_LIFE, AGENDA] },
      { group: 'Équipe et matériel', items: [{ id: 'staff', label: 'Gestion des agents', icon: 'users', screen: StaffModule }, RESOURCES, INVENTORY, MANUALS, LIBRARY, BOOKING] },
      { group: 'Réglages', items: [IMPORT, { id: 'settings', label: 'Paramètres', icon: 'settings', screen: SettingsModule }] },
    ],
  },
  BUREAU: {
    label: 'Secrétariat',
    title: 'Secrétariat',
    home: 'bureau',
    nav: [
      { group: 'Aujourd\'hui', items: [{ id: 'bureau', label: 'À traiter aujourd\'hui', icon: 'home', screen: BureauHome }] },
      { group: 'Caisse', items: [ACCOUNTING] },
      { group: 'Vie scolaire', items: [VIE_SCOLAIRE, CARE, HOURS, TT_CHANGES, FOLLOW_UP] },
      { group: 'Notes et bulletins', items: [COUNCIL, BULLETINS, MOCK_EXAMS, GRADE_SHEETS, ...OVERSIGHT] },
      { group: 'Élèves', items: [INSCRIPTIONS, STUDENT_LIST, SIGNATURES, IMPORT] },
      { group: 'Communication', items: [MESSAGES, NEWS, SCHOOL_LIFE, AGENDA, RESOURCES] },
      { group: 'Matériel et bibliothèque', items: [MANUALS, LIBRARY, BOOKING, INVENTORY] },
    ],
  },
  VIE_SCOLAIRE: {
    label: 'CPE',
    title: 'CPE — vie scolaire',
    home: 'vs',
    nav: [
      { group: 'Aujourd\'hui', items: [VIE_SCOLAIRE, CARE, HOURS, ro(TT_CHANGES)] },
      { group: 'Élèves', items: [ro(STUDENT_LIST), MANDATES] },
      { group: 'Communication', items: [MESSAGES, NEWS, SCHOOL_LIFE, ro(AGENDA), RESOURCES] },
      { group: 'Ressources', items: [ro(BOOKING), ro({ id: 'books-cpe', label: 'Bibliothèque et manuels', icon: 'cap', screen: () => <BookCatalog who="M. Be" kind="CPE" /> }), ro(OVERSIGHT[1])] },
    ],
  },
  ENSEIGNANT: {
    label: 'Enseignant',
    title: 'Enseignant.e',
    home: 'teacher',
    nav: [
      { group: 'Ma journée', items: [
        { id: 'teacher', label: 'Ma journée', icon: 'home', screen: TeacherPortal },
        { id: 'appel', label: 'Appel', icon: 'check', screen: AttendanceModule },
        { id: 'grades', label: 'Notes et appréciations', icon: 'pen', screen: GradebookModule },
        { id: 'homework', label: 'Cahier de textes', icon: 'calendar', screen: HomeworkModule },
        MOCK_EXAMS,
        { id: 'discipline', label: 'Vie de classe', icon: 'alert', screen: VieScolaireModule },
      ] },
      { group: 'Mon organisation', items: [{ ...HOURS, label: 'Mes heures et absences' }, AGENDA, BOOKING, GRADE_SHEETS] },
      { group: 'Communication', items: [MESSAGES, ro(NEWS), SCHOOL_LIFE] }, // annonces : lecture seule, aucune rédaction
      { group: 'Ressources', items: [BOOKS_FOR_TEACHER, RESOURCES] },
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
  // Nouvelle famille, sans compte : formulaire de pré-inscription en ligne (lien sur le site, Facebook…)
  VISITEUR: {
    label: 'Nouvelle famille',
    title: 'Pré-inscription en ligne',
    home: 'public-prereg',
    nav: [{ group: 'Site de l\'école', items: [{ id: 'public-prereg', label: 'Pré-inscription en ligne', icon: 'users', screen: PublicPreregistration }] }],
  },
};

// Personne connectée, par profil (démonstration)
const PERSONAS = {
  BUREAU: { name: 'Mme Hanta', short: 'Mme Hanta', detail: 'Secrétariat (accueil, caisse…) · Tamatave' },
  VIE_SCOLAIRE: { name: 'M. Be', short: 'M. Be', detail: 'CPE · Tamatave' },
  ENSEIGNANT: { name: 'Mme RANAIVO', short: 'Mme Ranaivo', detail: 'Management · SGN' },
  PARENT: { name: 'Mme RAKOTOARISOA', short: 'Mme Rakotoarisoa', detail: 'Maman d\'Aina et de Toky' },
  ELEVE: { name: 'Aina RAKOTOARISOA', short: 'Aina', detail: '1re STMG · Tamatave' },
  VISITEUR: { name: 'Visiteur', short: 'Visiteur', detail: 'Sans compte' },
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
  // rubriques masquées par la Direction (Paramètres → Rubriques affichées) : retirées du menu
  const NAV = PROFILES[profile].nav.map((g) => ({ ...g, items: g.items.filter((it) => featureVisible(settings, it.feature, profile)) })).filter((g) => g.items.length);
  const Current = (NAV.flatMap((g) => g.items).find((i) => i.id === screen) ?? NAV[0].items[0]).screen;
  const switchProfile = (p) => { setProfile(p); setScreen(PROFILES[p].home); };

  const persona = profile === 'DIRECTION' ? { name: account.name, detail: account.email } : PERSONAS[profile];

  // Ambiance retenue par l'établissement : Océan (dégradé bleu)
  const theme = 'ocean';
  useEffect(() => { document.documentElement.dataset.theme = theme; }, []);
  // Site affiché (Direction) : Tamatave pour l'instant ; Tana sera ajouté avec son secrétariat et sa vie scolaire
  const [site, setSite] = useState('TMV');

  // Protection d'écran : tous les profils sauf Direction et Bureau
  const [protection, setProtection] = useState(true);
  const protectedProfile = protection && !['DIRECTION', 'BUREAU'].includes(profile);
  const hidden = useScreenGuard(protectedProfile);
  const online = useOnline();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [collapsed, setCollapsed] = useState({});
  const [tick, setTick] = useState(0); // recalcul des notifications après « J'ai vu »
  const goTo = (id) => { setScreen(id); setMobileOpen(false); setBellOpen(false); setQuickOpen(false); setTick((t) => t + 1); };
  const staffProfile = !['PARENT', 'ELEVE', 'VISITEUR'].includes(profile);
  const notes = staffProfile ? notificationsFor(profile, { account }) : { urgent: [], todo: [], info: [] };
  const counts = countsByScreen(notes.todo);
  const bellCount = notes.urgent.length + notes.todo.length;
  const { ambiance, animations } = useAmbiance(settings); // classe de palette posée sur <html>
  const currentItem = NAV.flatMap((g) => g.items).find((i) => i.id === screen);
  const activeGroup = NAV.find((g) => g.items.some((i) => i.id === screen))?.group;
  const screenLabel = currentItem?.label ?? screen;
  void tick;

  const navItem = (item) => {
    const enabled = Boolean(item.screen);
    const active = item.id === screen;
    const n = counts[item.id];
    return (
      <button key={item.id} onClick={() => enabled && goTo(item.id)} disabled={!enabled} aria-current={active ? 'page' : undefined}
        title={enabled ? undefined : 'Prévu plus tard'}
        className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[13px] transition
          ${active ? 'bg-navy-50 font-semibold text-navy-900' : enabled ? 'text-slate-700 hover:bg-slate-100' : 'text-slate-400'}`}>
        <Icon name={item.icon} className={`h-4 w-4 shrink-0 ${active ? 'text-navy-500' : 'text-slate-400'}`} />
        <span className="min-w-0 flex-1 leading-tight">{item.label}</span>
        {item.readOnly && <span className="rounded bg-slate-100 px-1 text-[10px] font-normal text-slate-600">consultation</span>}
        {n > 0 && <span className="rounded-full bg-amber-500 px-1.5 text-[10px] font-semibold text-white">{n}</span>}
        {!enabled && <span className="text-[10px] font-normal">bientôt</span>}
      </button>
    );
  };
  const sidebar = (
    <div className="space-y-3">
      {NAV.map((g) => {
        const isOpen = !(collapsed[g.group] ?? false) || g.group === activeGroup;
        const n = g.items.reduce((t, it) => t + (counts[it.id] ?? 0), 0);
        return (
          <div key={g.group}>
            <button type="button" onClick={() => setCollapsed({ ...collapsed, [g.group]: isOpen })} aria-expanded={isOpen}
              className="flex w-full items-center justify-between px-2.5 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500 hover:text-navy-900">
              <span>{g.group}{!isOpen && n > 0 && <span className="ml-1.5 rounded-full bg-amber-500 px-1.5 text-[10px] text-white">{n}</span>}</span>
              <span className={`transition ${isOpen ? '' : '-rotate-90'}`}>▾</span>
            </button>
            {isOpen && <div className="space-y-0.5">{g.items.map(navItem)}</div>}
          </div>
        );
      })}
    </div>
  );
  const QUICK = profile === 'BUREAU' ? [['accounting', 'Encaisser'], ['vs', 'Noter une absence'], ['care', 'Enregistrer un passage (soins)'], ['enrol', 'Imprimer un certificat']] : [];

  return (
    <div className={`min-h-screen ${protectedProfile ? 'screen-guard' : ''}`} onClick={() => { setAccountOpen(false); setBellOpen(false); setQuickOpen(false); }}>
      {/* Bandeau du prototype : changer de profil, protection d'écran */}
      <div className="print:hidden bg-slate-900 px-4 py-1.5 text-[11px] text-slate-300 lg:px-8">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-x-4 gap-y-1.5">
          <span className="rounded-full bg-amber-400/90 px-2 py-0.5 font-semibold text-slate-900">Prototype · données fictives</span>
          <span className="flex min-w-0 flex-wrap items-center gap-1.5">Voir l'ENT en tant que
            <span className="flex max-w-[calc(100vw-2rem)] gap-0.5 overflow-x-auto rounded-full bg-white/10 p-0.5" role="tablist" aria-label="Profil">
              {Object.entries(PROFILES).map(([k, p]) => (
                <button key={k} role="tab" aria-selected={profile === k} onClick={() => switchProfile(k)}
                  className={`shrink-0 whitespace-nowrap rounded-full px-2.5 py-0.5 font-medium ${profile === k ? 'bg-white text-slate-900' : 'text-white hover:bg-white/10'}`}>{p.label}</button>
              ))}
            </span>
          </span>
          <label className="flex items-center gap-1.5"><input type="checkbox" checked={protection} onChange={(e) => setProtection(e.target.checked)} />Protection d'écran (sauf Direction et Secrétariat)</label>
        </div>
      </div>

      {/* Barre du haut : logo, site, action rapide, notifications, compte */}
      <header className="amb-topbar print:hidden sticky top-0 z-30 shadow-[0_8px_24px_-16px_rgb(0_51_102/0.6)]"
        style={{ background: 'var(--topbar)', color: 'var(--topbar-fg)' }}>
        <div className="mx-auto flex h-16 max-w-[1500px] items-center gap-3 px-4 lg:px-8">
          {staffProfile && (
            <button className="rounded-full p-2 hover:bg-white/10 lg:hidden" aria-label="Menu" aria-expanded={mobileOpen} onClick={(e) => { e.stopPropagation(); setMobileOpen(!mobileOpen); }}>
              <Icon name="menu" className="h-6 w-6" />
            </button>
          )}
          <button className="flex shrink-0 items-center gap-2.5" onClick={() => goTo(PROFILES[profile].home)} aria-label="Accueil">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white p-1 shadow-sm"><img src={pillar} alt="" className="h-full" /></span>
            <span className="hidden text-left leading-tight sm:block">
              <span className="block font-display text-[15px] font-semibold tracking-wide">CHATEAUBRIAND</span>
              <span className="block text-[11px]" style={{ color: 'var(--topbar-muted)' }}>{PROFILES[profile].title}</span>
            </span>
          </button>
          {staffProfile && (
            <select value={site} onChange={(e) => setSite(e.target.value)} aria-label="Site" onClick={(e) => e.stopPropagation()} disabled={profile !== 'DIRECTION'}
              className="ml-2 rounded-full border-0 bg-white/15 px-3 py-1 text-xs font-medium text-white disabled:opacity-100">
              <option value="TMV" className="text-slate-900">Tamatave</option>
              <option value="TNR" disabled className="text-slate-500">Tana (bientôt)</option>
            </select>
          )}

          <div className="ml-auto flex items-center gap-2">
            {QUICK.length > 0 && (
              <div className="relative" onClick={(e) => e.stopPropagation()}>
                <button onClick={() => { setQuickOpen(!quickOpen); setBellOpen(false); }} aria-expanded={quickOpen}
                  className="flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-sm font-semibold text-navy-900 shadow-sm hover:bg-navy-50">＋ Action rapide</button>
                {quickOpen && (
                  <div className="absolute right-0 top-full z-40 mt-2 w-64 rounded-2xl bg-white p-2 text-slate-800 shadow-2xl ring-1 ring-slate-200">
                    {QUICK.map(([id, label]) => <button key={id} onClick={() => goTo(id)} className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-100">{label}</button>)}
                  </div>
                )}
              </div>
            )}
            {staffProfile && (
              <div className="relative" onClick={(e) => e.stopPropagation()}>
                <button onClick={() => { setBellOpen(!bellOpen); setQuickOpen(false); }} aria-expanded={bellOpen} aria-label={`Notifications : ${notes.urgent.length} urgentes, ${notes.todo.length} à faire`}
                  className="relative flex h-9 w-9 items-center justify-center rounded-full bg-white/15 hover:bg-white/25">
                  <Icon name="bell" className="h-[18px] w-[18px]" />
                  {bellCount > 0 && <span className={`absolute -right-1 -top-1 rounded-full px-1.5 text-[10px] font-bold text-white ${notes.urgent.length ? 'bg-red-600' : 'bg-amber-500'}`}>{bellCount}</span>}
                </button>
                {bellOpen && (
                  <div className="absolute right-0 top-full z-40 mt-2 w-[22rem] rounded-2xl bg-white p-3 text-sm text-slate-800 shadow-2xl ring-1 ring-slate-200">
                    {[['URGENT', notes.urgent, 'text-red-700'], ['À FAIRE', notes.todo, 'text-amber-700'], ['INFORMATIONS', notes.info, 'text-navy-700']].map(([title, list, tone]) => list.length > 0 && (
                      <div key={title} className="mb-2">
                        <p className={`px-1 pb-1 text-[11px] font-bold tracking-wide ${tone}`}>{title}</p>
                        {list.map((n) => <button key={n.id} onClick={() => goTo(n.to)} className="block w-full rounded-lg px-2 py-1.5 text-left hover:bg-slate-100">{n.text}</button>)}
                      </div>
                    ))}
                    {!bellCount && !notes.info.length && <p className="p-2 text-slate-600">Rien de nouveau ✓</p>}
                  </div>
                )}
              </div>
            )}
            <div className="relative" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => { setAccountOpen(!accountOpen); setBellOpen(false); }} className="flex items-center gap-2 rounded-full py-1 pl-1 pr-3 hover:bg-white/10" aria-label="Mon compte">
                <Avatar name={persona.name} className="h-8 w-8 text-[11px] ring-2 ring-white/60" />
                <span className="hidden text-left text-xs leading-tight md:block"><span className="block font-semibold">{persona.short ?? persona.name}</span><span style={{ color: 'var(--topbar-muted)' }}>{persona.detail}</span></span>
              </button>
              {accountOpen && (
                <div className="absolute right-0 top-full z-40 mt-2 w-72 rounded-2xl bg-white p-4 text-sm text-slate-700 shadow-2xl ring-1 ring-slate-200">
                  <p className="font-semibold text-slate-900">{persona.name}</p>
                  <p className="text-xs text-slate-600">{persona.detail}</p>
                  {profile === 'DIRECTION' && (
                    <label className="mt-3 block text-xs text-slate-600">Compte Direction (droits identiques)
                      <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-2.5 py-1.5 text-sm">
                        {DIRECTION_ACCOUNTS.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </select>
                    </label>
                  )}
                  {profile !== 'VISITEUR' && <div className="mt-3 border-t border-slate-100 pt-2"><FeedbackButton variant="menu" profile={profile} who={persona.detail ?? persona.name} screen={screenLabel} /></div>}
                  <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-600"><span className="flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-navy-900 ring-1 ring-slate-200">G</span>Connexion Google · même compte sur ordinateur et téléphone</p>
                </div>
              )}
            </div>
          </div>
        </div>
        {mobileOpen && staffProfile && (
          <nav aria-label="Navigation principale (mobile)" className="max-h-[75vh] overflow-y-auto border-t border-white/10 bg-white px-3 py-3 text-slate-800 lg:hidden" onClick={(e) => e.stopPropagation()}>
            {sidebar}
          </nav>
        )}
      </header>
      {/* Ambiance du moment : bande + « Le saviez-vous ? » (le portail familles a la sienne), effet bref et discret */}
      {staffProfile && <AmbianceBand key={ambiance?.id ?? 'aucune'} ambiance={ambiance} />}
      <AmbianceEffects ambiance={ambiance} enabled={animations} />

      {!online && (
        <p role="status" className="bg-amber-100 px-4 py-1.5 text-center text-xs font-medium text-amber-900">
          Hors connexion : consultation et saisies courantes possibles, envoyées au retour du réseau. La caisse attend la connexion.
        </p>
      )}
      <div className="mx-auto flex w-full max-w-[1500px] gap-6 px-4 py-6 lg:px-8">
        {staffProfile && (
          <aside className="print:hidden sticky top-24 hidden max-h-[calc(100vh-7rem)] w-64 shrink-0 self-start overflow-y-auto rounded-2xl bg-white/80 p-3 shadow-soft lg:block">
            <nav aria-label="Navigation principale">{sidebar}</nav>
          </aside>
        )}
        <main className="min-w-0 flex-1">
          {notes.urgent.length > 0 && (
            <div role="alert" className="print:hidden mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
              <span className="font-bold">⚠ Urgent</span>
              <span className="min-w-0 flex-1">{notes.urgent.map((u) => u.text).join(' · ')}</span>
              <button onClick={() => goTo(notes.urgent[0].to)} className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white">Voir</button>
              <button onClick={() => { markSeen(notes.urgent.map((u) => u.id)); setTick((t) => t + 1); }} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-red-800 ring-1 ring-red-300">J'ai vu</button>
            </div>
          )}
          {currentItem?.readOnly && <p className="mb-3 inline-block rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">Consultation seulement</p>}
          {profile === 'ENSEIGNANT'
            ? <TermsGate viewer="ENSEIGNANT" account="mme-ranaivo"><Current key={`${profile}-${screen}`} account={account} settings={settings} onChange={setSettings} onReset={() => setSettings(DEFAULT_SETTINGS)} go={goTo} role={profile} site={site} /></TermsGate>
            : <Current key={`${profile}-${screen}`} account={account} settings={settings} onChange={setSettings} onReset={() => setSettings(DEFAULT_SETTINGS)} go={goTo} role={profile} site={site} ambiance={ambiance} />}
        </main>
      </div>
      {hidden && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black text-center text-sm text-slate-400" role="alert">
          Contenu masqué : les captures d'écran ne sont pas autorisées.<br />Revenez sur la page pour continuer.
        </div>
      )}
    </div>
  );
}
