import OrientationSheet, { loadSheets } from './OrientationSheet.jsx';
import { currentStep, sheetKind } from '../rules/orientationSheet.js';
import FamilyContact from './FamilyContact.jsx';
import Embedded from './Embedded.jsx';
import React, { useMemo, useState } from 'react';
import ExamResultCard from './ExamResultCard.jsx';
import { loadMockExams } from '../mockExamStore.js';
import { FAMILY_SECTIONS } from '../rules/navigation.js';
import { AmbianceHomeCard } from './AmbianceNote.jsx';
import StudentMandates from './StudentMandates.jsx';
import { mandatesOf } from '../rules/mandates.js';
import { loadEngagements } from '../engagementsStore.js';
import { Badge, Button, Icon } from './ui.jsx';
import Messenger, { unreadCount } from './Messenger.jsx';
import { PARENT, STAFF } from '../data/people.js';
import { FAMILIES, JOURNALS } from '../data/accounting.js';
import { MEASURES_LOG } from '../data/schoollife.js';
import { loadObjects } from '../objectsStore.js';
import { HOMEWORK } from '../data/homework.js';
import {
  OTHER_NOTES, GRADEBOOK_SUBJECTS, SERVICES, EVALUATIONS, GRADES, REMARKS, AUTHORIZATIONS, AUTH_ANSWERS, DOCUMENTS, REQUESTED, INTERNSHIPS, ORIENTATION,
} from '../data/family.js';
import { accountStatement } from '../rules/accounting.js';
import { formatAr } from '../rules/finance.js';
import { studentNoteList, fmt2, isPublished, parentPublishOn } from '../rules/grading.js';
import { MEASURES, PHONE_DURATIONS, phoneReturnAt, objectOf } from '../rules/discipline.js';
import { justificationState as justification } from '../rules/attendance.js';
import { loadAttendance } from '../attendanceStore.js';
import { loadTimetable } from '../timetableStore.js';
import { loadChanges } from './TimetableChanges.jsx';
import { dayCourses, nowNext, shortSubject, subjectColor as courseColor } from '../rules/timetableGrid.js';
import { weekLetter } from '../rules/teachingHours.js';
import { DEFAULT_SETTINGS } from '../data/settings.js';
import { JustifyAbsence, AbsencesToJustify } from './JustifyAbsence.jsx';
import PhoneAlerts from './PhoneAlerts.jsx';
import { justificationState } from '../rules/attendance.js';
import { formatDateFr } from '../rules/calendar.js';
import { STUDENT_PROFILES } from '../data/enrollment.js';
import { loadProfiles } from '../profilesStore.js';
import { FamilyRequestForm, sendDocument } from './FamilyRequests.jsx';
import { DocumentInput } from './PhotoInput.jsx';
import { AnnouncementCard } from './AnnouncementsModule.jsx';
import AgendaModule from './AgendaModule.jsx';
import { FamilyDocuments, TermsGate } from './InternalResources.jsx';
import BookCatalog from './BookCatalog.jsx';
import { loadAnnouncements } from '../announcementsStore.js';
import { receives } from '../rules/announcements.js';
import { loadWindows, handoverBlocks } from './BulletinHandover.jsx';
import { pickupStatus, familyMessage } from '../rules/bulletinPickup.js';
import { loadManuals } from '../manualsStore.js';
import { nextClass } from '../rules/enrollment.js';
import { menuFor } from '../rules/familyMenu.js';
import { FicheForm, FICHE_YEAR } from './FicheSignaletique.jsx';
import SignaturePad from './SignaturePad.jsx';
import { ficheOf, referenceOf, setReference } from '../ficheStore.js';
import { loadLibrary } from '../libraryStore.js';
import { designation, dueSoonLoans, daysLeft, gamesOut } from '../rules/library.js';
import { GAMES, GAME_LOG } from '../data/games.js';
import { loadVisits } from '../careStore.js';
import { loadSeen, markSeen } from '../notify.js';
import { loadPosts } from '../schoolLifeStore.js';
import { usePersistent, readStored, writeStored } from '../persist.js';
import { demoOr } from '../demoData.js';
import SchoolLifeModule, { SocialLinks } from './SchoolLifeModule.jsx';
import { loadPassport, isNewStudent } from './PassportTab.jsx';
import { passport, COLLE_STATUS } from '../rules/discipline.js';
import { parentNotice } from '../rules/care.js';
import { nowIso, today } from '../clock.js';

// Portail famille : PARENT (toutes les actions) ou ELEVE (presque la même chose, en lecture,
// sans paiements, sans accusés de lecture ni signatures).

const TODAY = today();
const MONTHS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const NOW = nowIso('18:30');
const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const longDate = (iso) => formatDateFr(iso).replace(/^\S+ /, '');           // « 20 janvier 2027 »
const shortDate = (iso) => cap(formatDateFr(iso).replace(/ \d{4}$/, ''));    // « Mardi 13 octobre »
// Une couleur douce et stable par matière : repère visuel d'un écran à l'autre
const SUBJECT_COLORS = ['#f97316', '#10b981', '#005baa', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899'];
const subjectColor = (name) => SUBJECT_COLORS[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % SUBJECT_COLORS.length];
const MEASURE = Object.fromEntries(MEASURES.map((m) => [m.id, m]));
const fullName = (child) => `RAKOTOARISOA ${child.name}`;
// Compte parent connecté (démonstration) : sa signature de référence y est rattachée
const ACCOUNT = { id: 'hanta.rakotoarisoa@gmail.com', name: 'Mme Rakotoarisoa Hanta' };
const profileOf = (child) => [...loadProfiles(), ...STUDENT_PROFILES].find((p) => p.lastName === 'RAKOTOARISOA' && p.firstName === child.name);

function Section({ title, children, action }) {
  return (
    <section className="rounded-2xl bg-white p-4 shadow-soft">
      {(title || action) && <div className="mb-2 flex items-center justify-between gap-2">{title && <h2 className="font-display text-[15px] font-semibold text-slate-900">{title}</h2>}{action}</div>}
      {children}
    </section>
  );
}

/* ---------- Accueil ---------- */
function Announcements({ isParent }) {
  // annonces reçues : celles qui visent les parents (ou les élèves) d'au moins un des enfants
  const me = isParent ? { role: 'PARENT', site: 'TMV', classes: PARENT.children.map((c) => c.cls) } : { role: 'ELEVE', site: 'TMV', classes: ['1re STMG'] };
  const list = loadAnnouncements().list.filter((a) => receives(a, me)).sort((a, b) => (b.pinned - a.pinned) || b.at.localeCompare(a.at)).slice(0, 2);
  if (!list.length) return null;
  return <>{list.map((a) => <AnnouncementCard key={a.id} a={a} who={isParent ? ACCOUNT.id : 'aina'} compact />)}</>;
}

function BookDueSoon({ child }) {
  // rappel automatique quelques jours avant la date de retour
  const soon = dueSoonLoans(loadLibrary().loans, TODAY).filter((l) => l.borrower === fullName(child));
  if (!soon.length) return null;
  return <div className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900"><p className="font-semibold">Livre à rendre bientôt — {child.name}</p>{soon.map((l) => <p key={l.id}>{l.code} : à rendre le {l.due.split('-').reverse().join('/')} au secrétariat (ou repasser avec le livre pour le garder un mois de plus).</p>)}</div>;
}

/** Alertes du téléphone pour tous les enfants : infirmerie (urgent), absences à justifier et mesures (important). */
const phoneItems = () => PARENT.children.flatMap((c) => [
  ...careAlerts(c).map((v) => ({ id: `care-${v.id}`, level: 'URGENT', kind: 'SOIN', child: c.name, text: `${c.name} est passé·e au secrétariat (${v.reason.toLowerCase()})` })),
  ...loadAttendance().filter((a) => a.student === fullName(c) && a.notified !== false && justificationState(a, NOW).status === 'A_JUSTIFIER')
    .map((a) => ({ id: `abs-${a.id}`, level: 'IMPORTANT', kind: 'ABSENCE', child: c.name, text: `${a.kind === 'ABSENCE' ? 'Absence' : 'Retard'} de ${c.name} à justifier sous 24 h` })),
  ...MEASURES_LOG.filter((m) => m.student === fullName(c) && !m.parentAck).map((m) => ({ id: `mes-${m.id}`, level: 'IMPORTANT', kind: 'MESURE', child: c.name, text: `${c.name} : ${MEASURE[m.measure].label.toLowerCase()} à lire` })),
]);

/** Urgent : passage au secrétariat (malaise, Doliprane…) d'hier ou d'aujourd'hui, jusqu'à « J'ai vu ». */
const careAlerts = (child) => {
  const since = new Date(new Date(`${TODAY}T12:00:00`) - 864e5).toISOString().slice(0, 10);
  const seen = loadSeen();
  return loadVisits().filter((v) => v.student === fullName(child) && v.at.slice(0, 10) >= since && v.at.slice(0, 10) <= TODAY && !seen[`fam-care-${v.id}`]);
};
function UrgentBanner({ child, onSeen }) {
  const list = careAlerts(child);
  if (!list.length) return null;
  return (
    <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
      <p className="font-bold">⚠ {child.name} — passage au secrétariat</p>
      {list.map((v) => <p key={v.id} className="mt-1">{v.at.slice(8, 10)}/{v.at.slice(5, 7)} · {v.notice ?? parentNotice(v, child.name)}</p>)}
      <button type="button" onClick={() => { markSeen(list.map((v) => `fam-care-${v.id}`)); onSeen(); }} className="mt-2 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white">J'ai vu</button>
    </div>
  );
}

function SchoolLifePreview({ open, social }) {
  const last = loadPosts().filter((p) => p.status === 'PUBLIEE').sort((a, b) => b.date.localeCompare(a.date))[0];
  if (!last && !social?.facebook && !social?.instagram) return null;
  return (
    <Section title="Vie de l'école" action={<button type="button" onClick={open} className="text-xs font-medium text-navy-500">Tout voir ›</button>}>
      {last && <><p className="mb-1.5 text-sm font-medium text-slate-800">{last.title}</p>
        <div className="flex gap-1.5 overflow-x-auto" tabIndex={0} role="region" aria-label="Photos du dernier album">{last.photos.slice(0, 3).map((src, i) => <img key={i} src={src} alt="" className="h-20 w-28 shrink-0 rounded-lg object-cover" />)}</div></>}
      <SocialLinks social={social} />
    </Section>
  );
}

function GamesAvailable() {
  const d = loadLibrary();
  const games = d.games ?? GAMES; const log = d.gameLog ?? GAME_LOG;
  return (
    <Section title="Jeux de société (salle d'étude)">
      <ul className="space-y-1 text-sm">{games.map((g) => { const free = g.copies - gamesOut(g.id, log).length; return <li key={g.id} className="flex justify-between gap-2"><span>{g.name}</span><span className={free ? 'text-emerald-700' : 'text-slate-400'}>{free ? 'libre' : 'sorti'}</span></li>; })}</ul>
      <p className="mt-2 text-xs text-slate-500">À demander à la vie scolaire pendant les pauses. Range le jeu complet.</p>
    </Section>
  );
}

function BulletinPickup({ child, settings }) {
  // bulletin du trimestre : à retirer au secrétariat, ou en attente de régularisation
  const w = loadWindows()[`T1|${child.cls}`];
  if (!w) return null;
  const today = new Date().toISOString().slice(0, 10);
  const blocked = handoverBlocks(fullName(child), settings, loadManuals()).length > 0;
  const given = !!(() => { try { return JSON.parse(localStorage.getItem('ent-remise-v1'))?.[`T1|${child.cls}|${fullName(child)}`]?.givenAt; } catch { return false; } })();
  const status = pickupStatus(today, w, { given, blocked });
  const msg = familyMessage(status, w, '1er trimestre');
  if (!msg) return null;
  return <div className={`rounded-2xl p-4 text-sm ${status === 'BLOQUE' ? 'bg-red-50 text-red-900' : 'bg-navy-50 text-navy-900'}`}><p className="font-semibold">Bulletin — {child.name}</p><p>{msg}</p></div>;
}

function Home({ child, isParent, openFiche, openReenrol, settings, onSeen, openSchoolLife, ambiance, go, pending = 0, others = [], pickChild }) {
  const due = HOMEWORK.filter((h) => h.cls === child.cls && h.due && h.due > TODAY).sort((a, b) => a.due.localeCompare(b.due)).slice(0, isParent ? 2 : 5);
  const [done, setDone] = useDone();
  const alerts = PARENT.alerts.filter((a) => !a.child || a.child === child.id); // les alertes de l'enfant choisi (et celles de la famille)
  // « À faire » : tout ce qui attend une action des parents pour cet enfant, chacun avec son bouton
  const todo = isParent ? [
    ...alerts.map((a) => ({ id: a.title, text: a.title, detail: a.body, tone: a.tone, to: a.to, action: a.action })),
    ...(sheetKind(child.cls) && currentStep(sheetKind(child.cls), loadSheets()[fullName(child)] ?? {})?.who === 'PARENT' ? [{ id: 'orient', text: 'Fiche d\'orientation : votre réponse est attendue', detail: currentStep(sheetKind(child.cls), loadSheets()[fullName(child)] ?? {}).label, tone: 'navy', to: 'orientation', action: 'Ouvrir la fiche' }] : []),
    ...(authPending(child).length ? [{ id: 'auth', text: `${authPending(child).length} autorisation${authPending(child).length > 1 ? 's' : ''} à donner`, detail: authPending(child).map((a) => a.label).join(' · '), tone: 'amber', to: 'documents', action: 'Répondre' }] : []),
    ...(pending ? [{ id: 'acks', text: `${pending} information${pending > 1 ? 's' : ''} de vie scolaire à confirmer`, tone: 'amber', to: 'life', action: 'Voir' }] : []),
    ...(!ficheOf(fullName(child))?.signedAt ? [{ id: 'fiche', text: `Fiche signalétique ${FICHE_YEAR} à signer`, detail: 'Déjà pré-remplie : vérifier, compléter, signer.', tone: 'navy', to: 'fiche', action: 'Remplir et signer' }] : []),
  ] : [];
  return (
    <>
      {isParent && <UrgentBanner child={child} onSeen={onSeen} />}
      {isParent && others.map((o) => (
        <button key={o.id} type="button" onClick={() => pickChild(o.id)} className="flex w-full items-center justify-between rounded-2xl bg-amber-50 px-4 py-2 text-left text-sm text-amber-900">
          <span><strong>{o.name}</strong> : {o.count} point{o.count > 1 ? 's' : ''} à voir</span><span aria-hidden="true">›</span>
        </button>
      ))}
      {isParent && <AbsencesToJustify student={fullName(child)} childName={child.name} now={NOW} by={ACCOUNT.name} onDone={onSeen} />}
      {todo.length > 0 && (
        <Section title={`À faire pour ${child.name} (${todo.length})`}>
          <ul className="space-y-2">
            {todo.map((x) => (
              <li key={x.id} className={`rounded-xl p-3 ${x.tone === 'red' ? 'bg-red-50' : x.tone === 'amber' ? 'bg-amber-50' : 'bg-navy-50'}`}>
                <p className={`text-sm font-semibold ${x.tone === 'red' ? 'text-red-900' : x.tone === 'amber' ? 'text-amber-900' : 'text-navy-900'}`}>{x.text}</p>
                {x.detail && <p className="text-sm text-slate-700">{x.detail}</p>}
                {x.to && <Button className="mt-2 text-sm" onClick={() => go(x.to)}>{x.action}</Button>}
              </li>
            ))}
          </ul>
        </Section>
      )}
      <NowNextCard child={child} isParent={isParent} settings={settings} />
      {due.length > 0 && (
        <Section title={isParent ? 'Prochains devoirs' : 'Devoirs à faire'} action={<button type="button" onClick={() => go('homework')} className="text-xs font-medium text-navy-700">Tout voir ›</button>}>
          <ul className="space-y-1.5">
            {due.map((h) => (
              <li key={h.id} className="flex items-start gap-2 text-sm text-slate-700">
                {!isParent && <input type="checkbox" className="mt-1 h-5 w-5" checked={!!done[h.id]} onChange={() => setDone({ ...done, [h.id]: !done[h.id] })} aria-label={`Fait : ${h.subject}`} />}
                <span className={done[h.id] ? 'text-slate-400 line-through' : ''}><span className="font-medium">{shortDate(h.due)} · {h.subject} :</span> {h.todo}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}
      <Announcements isParent={isParent} />
      {isParent && <BulletinPickup child={child} settings={settings} />}
      <BookDueSoon child={child} />
      {isParent && profileOf(child) && nextClass(child.cls) && (
        <div className="rounded-2xl bg-emerald-50 p-4">
          <p className="text-sm font-semibold text-emerald-900">Réinscriptions 2027-2028 ouvertes</p>
          <p className="text-sm text-emerald-800">{nextClass(profileOf(child).cls) ? `Réinscrivez ${child.name} en ${nextClass(profileOf(child).cls)} depuis votre téléphone, avec les pièces en photo.` : `Dites-nous si ${child.name} poursuit ailleurs l'an prochain.`}</p>
          <Button className="mt-2 text-sm" onClick={openReenrol}>Réinscrire {child.name} pour 2027-2028</Button>
        </div>
      )}
      <SchoolLifePreview open={openSchoolLife} social={settings?.social} />
      <AmbianceHomeCard key={ambiance?.id} ambiance={ambiance} />
      {isParent && <PhoneAlerts items={phoneItems()} nowHm={NOW.slice(11, 16)} />}
    </>
  );
}

/* ---------- Maintenant / Ensuite : la journée de la classe, depuis l'emploi du temps (semaines A/B) ---------- */
// Heure de démonstration : 10h20 (en vrai, l'heure du téléphone). Les changements du jour sont en rouge.
const DEMO_TIME = '10:20';
function NowNextCard({ child, isParent, settings }) {
  const courses = dayCourses(loadTimetable(), child.cls, TODAY, settings ?? DEFAULT_SETTINGS, loadChanges());
  if (!courses.length) {
    return (
      <Section title={`Aujourd'hui — ${child.name}`}>
        <ul className="space-y-1.5">{child.timetable.map(([t, s]) => <li key={t} className="flex gap-3 text-sm"><span className="w-12 font-medium tabular-nums text-navy-900">{t.replace(':', 'h')}</span><span className="text-slate-700">{s}</span></li>)}</ul>
      </Section>
    );
  }
  const { now, next } = nowNext(courses, DEMO_TIME);
  const who = (c) => STAFF.find((x) => x.id === c.teacherId)?.name ?? c.teacherId;
  const box = (label, c, strong) => (
    <div className="flex-1 rounded-xl p-3" style={{ background: c ? courseColor(c) : '#f1f5f9' }}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-700">{label}</p>
      {c ? <><p className={`${strong ? 'text-base' : 'text-sm'} font-semibold text-slate-900`}>{shortSubject(c)}</p>
        <p className="text-xs text-slate-700">{c.start.replace(':', 'h')}–{c.end.replace(':', 'h')} · {who(c)}{c.room ? ` · ${c.room}` : ''}</p>
        {c.status === 'DEPLACE' && <p className="text-xs font-semibold text-red-700">Cours déplacé</p>}</>
        : <p className="text-sm text-slate-600">{label === 'Maintenant' ? 'Pas de cours' : 'Plus de cours aujourd\'hui'}</p>}
    </div>
  );
  return (
    <Section title={`${isParent ? `Journée de ${child.name}` : 'Ma journée'} — semaine ${weekLetter(TODAY, settings ?? DEFAULT_SETTINGS)}`}>
      <div className="mb-3 flex gap-2">{box('Maintenant', now, true)}{box('Ensuite', next)}</div>
      <ul className="space-y-1">
        {courses.map((c) => (
          <li key={c.id} className={`flex items-center gap-2 text-sm ${c.status === 'ANNULE' ? 'text-red-700' : c.end <= DEMO_TIME ? 'text-slate-400' : 'text-slate-800'}`}>
            <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: courseColor(c) }} aria-hidden="true" />
            <span className="w-24 shrink-0 tabular-nums">{c.start.replace(':', 'h')}–{c.end.replace(':', 'h')}</span>
            <span className={c.status === 'ANNULE' ? 'line-through' : ''}>{shortSubject(c)}</span>
            {c.status === 'ANNULE' && <span className="text-xs font-semibold">annulé</span>}
            {c.status === 'AJOUT' && <span className="text-xs font-semibold text-red-700">ajouté</span>}
            {c.status === 'DEPLACE' && <span className="text-xs font-semibold text-red-700">déplacé</span>}
          </li>
        ))}
      </ul>
    </Section>
  );
}

/* ---------- Notes : par matière, chronologiques, sans bulletin ---------- */
// nouvelle note : publiée depuis moins de 3 jours
const isNew = (n) => n.date >= new Date(Date.parse(`${TODAY}T12:00:00Z`) - 3 * 864e5).toISOString().slice(0, 10);
/** Moyenne indicative de la matière (sur 20, coefficients compris) ; la moyenne officielle est celle du bulletin. */
function subjectAvg(notes) {
  const ok = notes.filter((n) => n.status === 'NOTE' && n.value != null);
  const w = ok.reduce((s, n) => s + (n.coef ?? 1), 0);
  return w ? ok.reduce((s, n) => s + (n.value / (n.scale ?? 20)) * 20 * (n.coef ?? 1), 0) / w : null;
}

function NoteCard({ n }) {
  const scale = n.scale === 20 ? '' : ` / ${n.scale}`;
  return (
    <li className="rounded-lg border border-slate-200 p-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="min-w-0 text-sm font-medium text-slate-800">{n.title}{isNew(n) && <> <Badge tone="navy">nouveau</Badge></>}</p>
        <p className="shrink-0 font-semibold tabular-nums text-navy-900">{n.status === 'NOTE' ? `${fmt2(n.value)}${scale || ' / 20'}` : n.status === 'ABSENT' ? 'Absent.e' : n.status === 'DISPENSE' ? 'Dispensé.e' : 'Non noté.e'}</p>
      </div>
      <p className="text-xs text-slate-600">{shortDate(n.date)} · {n.type} · classe {fmt2(n.avg)}{scale}</p>
      <details className="mt-1 text-sm">
        <summary className="cursor-pointer text-xs font-medium text-navy-700">Détails</summary>
        <dl className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1">
          <dt className="text-slate-600">Note la plus haute :</dt><dd className="text-right tabular-nums">{fmt2(n.max)}{scale}</dd>
          <dt className="text-slate-600">Note la plus basse :</dt><dd className="text-right tabular-nums">{fmt2(n.min)}{scale}</dd>
          <dt className="text-slate-600">Coefficient :</dt><dd className="text-right tabular-nums">{String(n.coef).replace('.', ',')}</dd>
          {n.themes?.length > 0 && <><dt className="text-slate-600">Thèmes :</dt><dd className="text-right">{n.themes.join(', ')}</dd></>}
        </dl>
      </details>
      {n.remark && <p className="mt-2 rounded-md bg-navy-50 px-2 py-1.5 text-xs text-navy-900"><span className="font-medium">Remarque :</span> {n.remark}</p>}
      {n.comment && <p className="mt-2 text-xs text-slate-600"><span className="font-medium">Commentaire du professeur :</span> {n.comment}</p>}
    </li>
  );
}

function Notes({ child, audience, settings }) {
  const [term, setTerm] = useState('T1');
  const [open, setOpen] = useState(null);
  const bySubject = useMemo(() => {
    const out = {};
    for (const id of GRADEBOOK_SUBJECTS[child.id]) {
      const svc = SERVICES.find((s) => s.id === id);
      // visibles dès la saisie ; une case vide ou une saisie à confirmer (« 1O ») n'apparaît pas
      // publiée aux élèves à la date choisie par l'enseignant, aux parents un jour plus tard
      out[svc.subject] = studentNoteList(EVALUATIONS[id], svc.students, GRADES[id], fullName(child), REMARKS[id])
        .filter((n) => n.status !== 'NON_SAISIE' && isPublished(n, audience, TODAY, settings));
    }
    for (const n of OTHER_NOTES[child.id]) if (isPublished(n, audience, TODAY, settings)) (out[n.subject] ??= []).push(n);
    for (const k of Object.keys(out)) out[k].sort((a, b) => a.date.localeCompare(b.date));
    return Object.entries(out).sort(([a], [b]) => a.localeCompare(b));
  }, [child, audience, settings]);
  // examens blancs publiés par la Direction : le relevé de l'élève, sans papier
  const exams = loadMockExams().sessions.filter((x) => x.published && x.marks[fullName(child)]).sort((a, b) => b.date.localeCompare(a.date));
  return (
    <>
      {exams.length > 0 && (
        <details className="rounded-2xl bg-white/70 p-2 shadow-soft">
          <summary className="cursor-pointer px-2 py-1.5 text-sm font-semibold text-slate-800">Examens blancs ({exams.length}) — voir les relevés</summary>
          <div className="mt-2 space-y-3">{exams.map((x) => <ExamResultCard key={x.id} session={x} student={fullName(child)} official={loadMockExams().official?.[fullName(child)]} />)}</div>
        </details>
      )}
      <div className="grid grid-cols-3 gap-1 rounded-full bg-white p-1 shadow-soft">
        {['T1', 'T2', 'T3'].map((t) => (
          <button key={t} onClick={() => setTerm(t)} className={`rounded-md py-1.5 text-sm font-medium ${term === t ? 'bg-navy-500 text-white' : 'text-slate-600'}`}>{t.replace('T', '')}{t === 'T1' ? 'er' : 'e'} trimestre</button>
        ))}
      </div>
      {term !== 'T1' ? <Section><p className="text-sm text-slate-500">Aucune note pour ce trimestre pour l'instant.</p></Section> : bySubject.map(([subject, notes]) => (
        <Section key={subject}>
          <button onClick={() => setOpen(open === subject ? null : subject)} className="flex w-full items-center justify-between text-left">
            <span className="flex items-center gap-2.5 text-sm font-semibold text-slate-900"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: subjectColor(subject) }} />{subject}</span>
            <span className="flex items-center gap-2 text-xs text-slate-600">
              {notes.some(isNew) && <Badge tone="navy">nouveau</Badge>}
              {subjectAvg(notes) != null && <strong className="text-sm tabular-nums text-navy-900">{fmt2(subjectAvg(notes))}</strong>}
              {notes.length} note{notes.length > 1 ? 's' : ''} {open === subject ? '▴' : '▾'}
            </span>
          </button>
          {open === subject && <ul className="mt-3 space-y-2">{notes.map((n) => <NoteCard key={n.id} n={n} />)}</ul>}
        </Section>
      ))}
    </>
  );
}

/* ---------- Devoirs (cahier de textes) ---------- */
const DONE_KEY = 'ent-devoirs-faits-v1';
const loadDone = () => { try { return JSON.parse(localStorage.getItem(DONE_KEY)) ?? {}; } catch { return {}; } };
function useDone() {
  const [done, set] = useState(loadDone);
  return [done, (v) => { set(v); try { localStorage.setItem(DONE_KEY, JSON.stringify(v)); } catch { /* stockage indisponible */ } }];
}

function Homework({ child, isParent }) {
  const [done, setDone] = useDone();
  const entries = HOMEWORK.filter((h) => h.cls === child.cls);
  const todo = entries.filter((h) => h.due && h.due > TODAY).sort((a, b) => a.due.localeCompare(b.due));
  return (
    <>
      <Section title="Travail à faire">
        {todo.length === 0 ? <p className="text-sm text-slate-500">Rien à faire pour le moment.</p> : (
          <ul className="space-y-2">
            {todo.map((h) => (
              <li key={h.id} className="flex items-start gap-2 text-sm">
                {!isParent && <input type="checkbox" className="mt-1" checked={!!done[h.id]} onChange={() => setDone({ ...done, [h.id]: !done[h.id] })} aria-label="Fait" />}
                <div className={done[h.id] ? 'text-slate-400 line-through' : ''}>
                  <p className="font-medium text-slate-800">Pour {shortDate(h.due).toLowerCase()} · {h.subject}</p>
                  <p className="text-slate-700">{h.todo}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>
      <Section title="Fait en classe">
        <ul className="space-y-2">
          {[...entries].sort((a, b) => b.date.localeCompare(a.date)).map((h) => (
            <li key={h.id} className="text-sm"><p className="text-xs text-slate-500">{shortDate(h.date)} · {h.subject} · {h.teacher}</p><p className="text-slate-700">{h.done}</p></li>
          ))}
        </ul>
      </Section>
    </>
  );
}

/* ---------- Onglet École : la vie de l'école d'abord, puis le suivi de l'enfant ---------- */
function SchoolTab({ child, isParent, acks, setAcks, settings, audience, pending }) {
  return (
    <>
      {pending > 0 && (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-200">{pending} information{pending > 1 ? 's' : ''} de vie scolaire à lire ci-dessous.</p>
      )}
      {/* le suivi de l'enfant d'abord, puis les photos et nouvelles de l'école */}
      <div id="suivi" className="scroll-mt-2"><SchoolLife child={child} isParent={isParent} acks={acks} setAcks={setAcks} settings={settings} /></div>
      <SchoolLifeModule compact role={audience} settings={settings} cls={child.cls} author={isParent ? 'Parent' : `${child.name} (${child.cls})`} />
    </>
  );
}

/* ---------- Vie scolaire : absences, retards, punitions, sanctions, objets confisqués ---------- */
function SchoolLife({ child, isParent, acks, setAcks, settings }) {
  const name = fullName(child);
  const [attendance, setAttendance] = useState(loadAttendance);
  const pp = passport(name, { attendance, ...loadPassport() }, { isNew: isNewStudent(name) });
  const items = [
    ...attendance.filter((a) => a.student === name).map((a) => ({ key: a.id, date: a.date, tone: a.kind === 'ABSENCE' ? 'red' : 'amber', title: a.kind === 'ABSENCE' ? 'Absence' : 'Retard', body: `${a.slot}${a.justified ? ` · justifié : ${a.reason}` : ''}`, absence: a, ack: a.parentAck })),
    ...MEASURES_LOG.filter((m) => m.student === name).map((m) => ({ key: m.id, date: m.date, tone: MEASURE[m.measure].kind === 'SANCTION' ? 'red' : 'amber', title: `${MEASURE[m.measure].kind === 'SANCTION' ? 'Sanction' : 'Punition'} : ${MEASURE[m.measure].label}`, body: `Motif : ${m.reason}${m.when ? ` · ${m.when}` : ''} · décidée par ${m.author}`, ack: m.parentAck })),
    ...pp.entries.map((c) => ({ key: c.id, date: c.date, tone: c.kind === 'TIG' ? 'red' : 'amber', title: c.kind === 'TIG' ? 'Travail d\'intérêt général (TIG)' : `Colle de ${c.hours} h`, body: `${c.reason} · le ${c.when.slice(8, 10)}/${c.when.slice(5, 7)} à ${c.when.slice(11, 16).replace(':', 'h')} · ${COLLE_STATUS[c.status].toLowerCase()}`, ack: null })),
    ...loadObjects().filter((p) => p.student === name || p.owner === name).map((p) => (p.action === 'AVERTISSEMENT'
      ? { key: p.id, date: p.at.slice(0, 10), tone: 'amber', title: `Avertissement : ${objectOf(p).toLowerCase()}`, body: `${p.reason} · donné par ${p.confiscatedBy}`, ack: null }
      : { key: p.id, date: p.at.slice(0, 10), tone: 'slate', title: `${objectOf(p)} confisqué${p.duration ? ` (${PHONE_DURATIONS.find((d) => d.id === p.duration).label})` : ''}`, body: `${p.owner === name && p.student !== name ? `Objet de ${child.name}, pris avec ${p.student}. ` : ''}${p.reason} · ${p.duration ? `restitution ${shortDate(phoneReturnAt(p.at, p.duration, settings).slice(0, 10)).toLowerCase()}` : 'durée décidée par la Direction, vous serez prévenus'}`, ack: null })),
  ].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <Section title={`Suivi de ${child.name} (vie scolaire)`}>
      <div className="mb-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-slate-50 p-2"><p className="text-lg font-semibold text-navy-900">{pp.lates}</p><p className="text-[11px] text-slate-500">retard{pp.lates > 1 ? 's' : ''}</p></div>
        <div className="rounded-xl bg-slate-50 p-2"><p className="text-lg font-semibold text-navy-900">{pp.forgets}</p><p className="text-[11px] text-slate-500">oubli{pp.forgets > 1 ? 's' : ''}</p></div>
        <div className="rounded-xl bg-amber-50 p-2"><p className="text-lg font-semibold text-amber-800">{pp.collesDue} h</p><p className="text-[11px] text-amber-800">de colle à faire</p></div>
      </div>
      {items.length === 0 ? <p className="text-sm text-slate-500">Aucune absence, aucun retard ni aucune mesure ce trimestre.</p> : (
        <ul className="space-y-3">
          {items.map((it) => {
            const ack = acks[it.key] ?? it.ack;
            return (
              <li key={it.key} className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-slate-800">{it.title}</p>
                  <Badge tone={it.tone}>{shortDate(it.date)}</Badge>
                </div>
                <p className="text-sm text-slate-600">{it.body}</p>
                {it.absence && !it.absence.justified && (isParent
                  ? <JustifyAbsence absence={it.absence} now={NOW} by={ACCOUNT.name} onDone={() => setAttendance(loadAttendance())} />
                  : <p className="mt-1 text-xs text-slate-600">{{ EN_ATTENTE: 'Justification envoyée par tes parents.', NON_JUSTIFIEE: 'Non justifiée.', A_JUSTIFIER: 'Tes parents peuvent la justifier.' }[justification(it.absence, NOW).status]}</p>)}
                {isParent ? (
                  ack ? <p className="mt-2 text-sm text-emerald-700">✓ Lu · {shortDate(ack.slice(0, 10)).toLowerCase()}</p>
                    : <Button className="mt-2 text-sm" onClick={() => setAcks({ ...acks, [it.key]: NOW })}>J'ai lu</Button>
                ) : ack && <p className="mt-1 text-xs text-emerald-700">Vu par tes parents</p>}
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}

/* ---------- Documents ---------- */
// réponses gardées le temps de la visite (l'accueil sait ce qui reste à donner)
let authAnswers = readStored('ent-s-autorisations') ?? demoOr(AUTH_ANSWERS, {});
const authPending = (child) => AUTHORIZATIONS.filter((a) => !authAnswers[child.id]?.[a.id]);

function Documents({ child, isParent }) {
  const [answers, setAnswersState] = useState(authAnswers);
  const setAnswers = (v) => { authAnswers = v; setAnswersState(v); writeStored('ent-s-autorisations', v); };
  const [docs, setDocs] = usePersistent('ent-s-documents-recus', () => demoOr(DOCUMENTS, []));
  const [requested, setRequested] = usePersistent('ent-s-pieces-demandees', () => demoOr(REQUESTED, []));
  const mine = answers[child.id] ?? {};
  return (
    <>
      <Section title={`Autorisations — ${child.name}`}>
        <ul className="space-y-3">
          {/* les autorisations en attente d'abord ; une réponse = un bouton */}
          {[...AUTHORIZATIONS].sort((x, y) => Number(Boolean(mine[x.id])) - Number(Boolean(mine[y.id]))).map((a) => (
            <li key={a.id} className={mine[a.id] ? '' : 'rounded-xl bg-amber-50 p-2.5'}>
              <p className="text-sm font-medium text-slate-800">{a.label}{!mine[a.id] && <> <Badge tone="amber">réponse attendue</Badge></>}</p>
              <p className="text-xs text-slate-600">{a.detail}</p>
              {isParent ? (
                <div className="mt-1.5 flex flex-wrap gap-1.5" role="group" aria-label={a.label}>
                  {a.options.map((o) => (
                    <button key={o} type="button" aria-pressed={mine[a.id]?.answer === o} onClick={() => setAnswers({ ...answers, [child.id]: { ...mine, [a.id]: { answer: o, at: TODAY } } })}
                      className={`min-h-[44px] rounded-xl px-4 text-sm font-medium ring-1 ${mine[a.id]?.answer === o ? 'bg-navy-500 text-white ring-navy-500' : 'bg-white text-slate-800 ring-slate-300'}`}>{o}</button>
                  ))}
                </div>
              ) : <p className="mt-1 text-sm text-slate-700">{mine[a.id]?.answer ?? 'En attente de la réponse de tes parents'}</p>}
              {mine[a.id] && <p className="mt-0.5 text-[11px] text-slate-500">Signé électroniquement le {longDate(mine[a.id].at)}</p>}
            </li>
          ))}
        </ul>
      </Section>
      <Section title="Documents reçus">
        <ul className="space-y-2">
          {docs.map((d) => (
            <li key={d.id} className="flex items-start justify-between gap-2 text-sm">
              <div><p className={`text-slate-800 ${d.read ? '' : 'font-semibold'}`}>{d.title}</p><p className="text-xs text-slate-500">{shortDate(d.date)} · {d.from}</p></div>
              {d.read ? <span className="text-xs text-emerald-700">Lu</span>
                : isParent ? <button onClick={() => setDocs(docs.map((x) => (x.id === d.id ? { ...x, read: true } : x)))} className="whitespace-nowrap text-xs font-medium text-navy-500">Marquer comme lu</button>
                  : <Badge tone="navy">Nouveau</Badge>}
            </li>
          ))}
        </ul>
      </Section>
      <Section title="Pièces demandées">
        <ul className="space-y-2">
          {requested.filter((r) => r.child === child.id).map((r) => (
            <li key={r.id} className="flex items-start justify-between gap-2 text-sm">
              <div><p className="text-slate-800">{r.title}</p><p className="text-xs text-slate-500">avant le {longDate(r.due)}</p></div>
              {r.received ? <Badge tone="green">{r.received === 'PENDING' ? 'Transmis, à vérifier' : 'Reçu'}</Badge>
                : isParent ? <DocumentInput label="Déposer (photo ou PDF)" onAdd={(file) => { if (profileOf(child)) sendDocument(profileOf(child), ACCOUNT.name, r.title, file); setRequested(requested.map((x) => (x.id === r.id ? { ...x, received: 'PENDING' } : x))); }} />
                  : <Badge tone="amber">Manquant</Badge>}
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}

/* ---------- Stages ---------- */
function Internships({ child, isParent }) {
  const [list, setList] = usePersistent(`ent-s-stages-${child.id}`, () => demoOr(INTERNSHIPS[child.id] ?? [], []));
  const info = <p className="text-xs text-slate-500">Stages obligatoires de 5 jours : en 3e (février), découverte de l'entreprise et des métiers ; en 2de (avril), observation d'un métier.</p>;
  if (!list.length) return <Section title="Stages"><p className="mb-1 text-sm text-slate-500">Aucun stage pour {child.name}.</p>{info}</Section>;
  return list.map((s, i) => (
    <Section key={s.title} title={s.title} action={s.done && <Badge tone="green">Terminé</Badge>}>
      <dl className="space-y-1 text-sm">
        <div><dt className="inline text-slate-500">Entreprise : </dt><dd className="inline text-slate-800">{s.company}</dd></div>
        <div><dt className="inline text-slate-500">Dates : </dt><dd className="inline text-slate-800">du {longDate(s.from)} au {longDate(s.to)}</dd></div>
        <div><dt className="inline text-slate-500">Tuteur : </dt><dd className="inline text-slate-800">{s.tutor}</dd></div>
        <div><dt className="inline text-slate-500">Référente : </dt><dd className="inline text-slate-800">{s.referent}</dd></div>
      </dl>
      <p className="mt-3 text-xs font-semibold text-slate-500">Convention de stage</p>
      <ul className="mt-1 space-y-1 text-sm">
        {[['entreprise', 'Entreprise'], ['etablissement', 'Établissement'], ['famille', 'Responsable légal']].map(([k, l]) => (
          <li key={k} className={s.signatures[k] ? 'text-emerald-700' : 'text-amber-700'}>{s.signatures[k] ? '✓' : '○'} {l} {s.signatures[k] ? 'a signé' : ': signature attendue'}</li>
        ))}
      </ul>
      {i === 0 && <div className="mt-3">{info}</div>}
      {isParent && !s.signatures.famille && <Button className="mt-3 w-full" onClick={() => setList(list.map((x, k) => (k === i ? { ...x, signatures: { ...x.signatures, famille: true } } : x)))}>Lire et signer la convention</Button>}
      <p className="mt-2 text-xs text-slate-500">{s.report}</p>
    </Section>
  ));
}

/* ---------- Orientation ---------- */
function Orientation({ child, isParent }) {
  const o = ORIENTATION[child.id] ?? { stage: child.cls, steps: [], choices: [] };
  const [asked, setAsked] = useState(false);
  return (
    <>
      {sheetKind(child.cls) && <Section><OrientationSheet student={fullName(child)} cls={child.cls} role={isParent ? 'PARENT' : 'ELEVE'} by={isParent ? ACCOUNT.name : fullName(child)} /></Section>}
      <Section title={`Orientation — ${o.stage}`}>
        <ol className="relative space-y-3 border-l border-slate-200 pl-4">
          {o.steps.map((s) => (
            <li key={s.label} className="relative">
              <span className={`absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full ring-2 ring-white ${s.state === 'now' ? 'bg-amber-500' : 'bg-slate-300'}`} />
              <p className="text-xs font-medium text-navy-700">{s.when}</p><p className="text-sm text-slate-700">{s.label}</p>
            </li>
          ))}
        </ol>
      </Section>
      {o.choices.length > 0 && (
        <Section title="Spécialités possibles">
          <ul className="space-y-1 text-sm text-slate-700">{o.choices.map((c) => <li key={c}>· {c}</li>)}</ul>
          <p className="mt-2 text-xs text-slate-500">Les intentions de la famille se saisissent ici au 2e trimestre.</p>
        </Section>
      )}
      {o.meeting && (
        <Section title="Rendez-vous">
          <p className="text-sm text-slate-700">{o.meeting}</p>
          {isParent && (asked ? <p className="mt-2 text-sm text-emerald-700">Demande envoyée à la Direction.</p>
            : <Button variant="secondary" className="mt-2 w-full" onClick={() => setAsked(true)}>Demander un rendez-vous</Button>)}
        </Section>
      )}
    </>
  );
}

/* ---------- Paiements & messages (parent) ---------- */
function Payments({ settings }) {
  const fam = FAMILIES.find((f) => f.id === PARENT.familyId);
  const { rows, byJournal, totals } = useMemo(() => accountStatement(fam.lines), [fam]);
  const [info, setInfo] = useState(true); // « Comment payer ? » ouvert d'emblée
  const dueDay = settings?.tuition?.dueDay ?? 5;
  const [y, m] = TODAY.split('-').map(Number);
  const nextDue = Number(TODAY.slice(8, 10)) <= dueDay ? `${dueDay} ${MONTHS_FR[m - 1]}` : `${dueDay} ${MONTHS_FR[m % 12]}${m === 12 ? ` ${y + 1}` : ''}`;
  return (
    <>
      <Section>
        <p className="text-xs text-slate-600">Reste à payer (famille)</p>
        <p className={`text-2xl font-semibold tabular-nums ${totals.balance > 0 ? 'text-red-700' : 'text-emerald-700'}`}>{formatAr(totals.balance)}</p>
        <p className="mt-1 text-sm text-slate-700">Prochaine échéance des frais de scolarité : <strong>le {nextDue}</strong></p>
        <div className="mt-3 space-y-1.5">
          {Object.entries(JOURNALS).map(([k, j]) => (
            <div key={k} className="flex items-center justify-between text-sm"><Badge tone={j.tone}>{j.label}</Badge><span className="tabular-nums">{(byJournal[k]?.balance ?? 0) > 0 ? formatAr(byJournal[k].balance) : 'À jour'}</span></div>
          ))}
        </div>
        <Button variant="secondary" className="mt-4 w-full" onClick={() => setInfo(!info)}>Comment payer ?</Button>
        {info && <p className="mt-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">Au secrétariat : espèces ou chèque à l'ordre de l'École Chateaubriand. Par virement : RIB fourni par le secrétariat, nom de l'élève en référence, bordereau à conserver. Le reçu apparaît ici dès l'enregistrement.</p>}
      </Section>
      <Section title="Historique">
        <ul className="divide-y divide-slate-100">
          {[...rows].reverse().map((r, i) => (
            <li key={i} className="flex items-center justify-between gap-2 py-2">
              <div className="min-w-0"><p className="truncate text-sm text-slate-800">{r.label}</p><p className="text-xs text-slate-500">{r.date.split('-').reverse().slice(0, 2).join('/')} · {JOURNALS[r.journal].label}</p></div>
              <span className={`whitespace-nowrap text-sm font-medium tabular-nums ${r.credit ? 'text-emerald-700' : 'text-slate-800'}`}>{r.credit ? `− ${formatAr(r.credit)}` : formatAr(r.debit)}</span>
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}

/* ---------- Livres empruntés (salle d'étude) ----------
 * Parents : seulement l'historique de leur enfant (à rendre, rendus) ; le catalogue reste côté élève. */
function LibraryLoans({ child, isParent }) {
  const { books, loans } = loadLibrary();
  const all = loans.filter((l) => l.borrower === fullName(child));
  const mine = all.filter((l) => !l.returnedOn);
  const back = all.filter((l) => l.returnedOn).sort((a, b) => b.returnedOn.localeCompare(a.returnedOn));
  const bookOf = (code) => books.find((b) => b.copies.some((c) => c.code === code));
  return (
    <Section title={isParent ? `Bibliothèque — ${child.name}` : 'Livres empruntés'}>
      {isParent && <p className="mb-2 text-xs font-semibold text-slate-600">À rendre</p>}
      {mine.length === 0 ? <p className="text-sm text-slate-500">Aucun livre à rendre.</p> : (
        <ul className="space-y-2">
          {mine.map((l) => (
            <li key={l.id} className="rounded-xl border border-slate-200 p-3 text-sm">
              <p className="font-medium text-slate-800">{designation(bookOf(l.code))}</p>
              <p className={`text-xs ${l.due < TODAY ? 'text-red-700' : daysLeft(l.due, TODAY) <= 3 ? 'font-medium text-amber-700' : 'text-slate-500'}`}>{l.code} · à rendre le {l.due.split('-').reverse().join('/')}{l.due < TODAY ? ` (non rendu : facturé${bookOf(l.code)?.price ? ` ${formatAr(bookOf(l.code).price)}` : ''})` : daysLeft(l.due, TODAY) <= 3 ? ` (dans ${daysLeft(l.due, TODAY)} jour${daysLeft(l.due, TODAY) > 1 ? 's' : ''})` : ''}</p>
            </li>
          ))}
        </ul>
      )}
      {isParent && (<>
        <p className="mb-2 mt-3 text-xs font-semibold text-slate-600">Déjà rendus</p>
        {back.length === 0 ? <p className="text-sm text-slate-500">Aucun pour l'instant.</p> : (
          <ul className="space-y-1 text-sm">{back.map((l) => <li key={l.id} className="flex justify-between gap-2"><span className="text-slate-800">{designation(bookOf(l.code))}</span><span className="shrink-0 text-xs text-slate-500">rendu le {l.returnedOn.split('-').reverse().join('/')}</span></li>)}</ul>
        )}
      </>)}
      <p className="mt-2 text-xs text-slate-500">Un mois de prêt. Pour le garder un mois de plus, repasser au secrétariat avec le livre.</p>
    </Section>
  );
}

/* ---------- Ma signature (signature de référence du compte) ---------- */
function MySignature() {
  const [ref, setRef] = useState(() => referenceOf(ACCOUNT.id));
  const [draft, setDraft] = useState(null);
  return (
    <Section title="Ma signature">
      <p className="mb-2 text-sm text-slate-600">Votre signature de référence. Elle signe vos documents dans l'ENT, et le secrétariat la compare en cas de doute avec un mot ou une autorisation papier.</p>
      {ref ? (
        <>
          <img src={ref.dataUrl} alt="Ma signature de référence" className="h-24 w-full rounded-xl border border-slate-200 bg-white object-contain" />
          <p className="mt-1 text-xs text-slate-500">Déposée le {ref.at.slice(0, 10).split('-').reverse().join('/')}. Pour la changer, adressez-vous au secrétariat (contrôle d'identité).</p>
        </>
      ) : (
        <>
          <SignaturePad onChange={setDraft} label="Signez ici avec le doigt" />
          <Button className="mt-2 w-full" disabled={!draft} onClick={() => { setReference(ACCOUNT.id, draft); setRef(referenceOf(ACCOUNT.id)); }}>Enregistrer ma signature</Button>
        </>
      )}
    </Section>
  );
}

/* ---------- Coquille ---------- */
// Barre du bas : Accueil, École (la vie de l'école puis le suivi de l'enfant), Notes, Agenda et Autres.
// « Autres » range tout le reste par thème, en rubriques qui se déroulent et se replient ;
// ce qui ne concerne pas l'enfant reste grisé.
const TABS = [['home', 'Accueil', 'home'], ['life', 'École', 'sparkles'], ['notes', 'Notes', 'pen'], ['agenda', 'Agenda', 'calendar'], ['more', 'Autres', 'menu']];
const SECTIONS = FAMILY_SECTIONS;

// Élève délégué ou membre du BDE : une rubrique de plus, seulement pour lui (cf. rules/mandates.js)
const mandateSection = (mandates) => {
  const items = [];
  if (mandates.some((m) => m.kind === 'DELEGUE')) items.push(['mandate-class', 'Écrire à ma classe', 'megaphone'], ['mandate-council', 'Préparer le conseil', 'cap']);
  if (mandates.some((m) => m.kind === 'BDE')) items.push(['mandate-bde', 'BDE : annonces et événements', 'sparkles']);
  return items.length ? [['Mon engagement', items]] : [];
};

function Others({ audience, menu, badges, open, mandates = [] }) {
  const isParent = audience === 'PARENT';
  return [...mandateSection(mandates), ...SECTIONS].map(([title, items]) => {
    const list = items.filter((m) => !m[3] || m[3] === audience);
    if (!list.length) return null;
    const count = list.reduce((t, [id]) => t + (menu[id] === false ? 0 : badges[id] ?? 0), 0);
    return (
      <details key={title} open className="group rounded-2xl bg-white/70 p-2 shadow-soft">
        <summary className="flex cursor-pointer list-none items-center justify-between px-2 py-1.5 text-sm font-semibold text-slate-800">
          <span>{title}{count > 0 && <span className="ml-2 rounded-full bg-amber-400 px-1.5 text-[10px] font-semibold text-slate-900">{count}</span>}</span>
          <span className="text-slate-400 transition group-open:rotate-180">▾</span>
        </summary>
        <div className="mt-1 grid grid-cols-3 gap-2">
          {list.map(([id, label, icon]) => {
            const off = menu[id] === false;
            return (
              <button key={id} type="button" data-nav={`autres-${id}`} disabled={off} onClick={() => open(id)}
                className={`relative flex min-h-[78px] flex-col items-center justify-center gap-1 rounded-2xl p-2 text-center text-[12px] font-medium leading-tight ${off ? 'cursor-default bg-slate-100 text-slate-400' : 'bg-white text-slate-800 shadow-soft'}`}>
                <Icon name={icon} className={`h-5 w-5 ${off ? 'text-slate-300' : 'text-navy-500'}`} />
                <span>{label}{off && <span className="block text-[10px] font-normal">(ne concerne pas {isParent ? 'votre enfant' : 'ta classe'})</span>}</span>
                {!off && badges[id] > 0 && <span className="absolute right-1.5 top-1.5 rounded-full bg-amber-400 px-1.5 text-[10px] font-semibold text-slate-900">{badges[id]}</span>}
              </button>
            );
          })}
        </div>
      </details>
    );
  });
}

export default function FamilyPortal({ settings, audience = 'PARENT', ambiance }) {
  const isParent = audience === 'PARENT';
  const [screen, setScreen] = useState('home');
  const [childId, setChildId] = useState(PARENT.children[0].id);
  const [acks, setAcks] = usePersistent('ent-s-vus-familles', {});
  const [tick, setTick] = useState(0); void tick;
  // pastille par enfant : alertes urgentes non vues + mesures à confirmer
  const childCount = (c) => careAlerts(c).length + [...loadAttendance(), ...MEASURES_LOG].filter((x) => x.student === fullName(c) && !x.parentAck && !acks[x.id] && (x.notified ?? true)).length;
  const child = PARENT.children.find((c) => c.id === (isParent ? childId : 'aina'));
  const pendingAcks = isParent ? [...loadAttendance(), ...MEASURES_LOG].filter((x) => PARENT.children.some((c) => fullName(c) === x.student) && !x.parentAck && !acks[x.id] && (x.notified ?? true)).length : 0;
  // menu « Plus » selon la classe de l'enfant affiché ; un écran qui ne le concerne pas est refermé
  const menu = menuFor(child, { hasInternships: (INTERNSHIPS[child.id] ?? []).length > 0 });
  // un écran qui ne concerne pas l'enfant choisi revient à l'accueil
  const view = menu[screen] === false ? 'home' : screen;
  const unread = view === 'messages' ? 0 : unreadCount(audience);
  const go = (t) => setScreen(t);
  const badges = { life: pendingAcks, messages: unread, fiche: isParent && !ficheOf(fullName(child))?.signedAt ? 1 : 0 };
  const moreBadge = unread + badges.fiche;
  const isTab = TABS.some(([id]) => id === view);
  // mandats de l'élève connecté (jamais côté parent) : délégué de sa classe, BDE de son site
  const student = { mandates: isParent ? [] : mandatesOf(loadEngagements()[fullName(child)] ?? [], { cls: child.cls, site: 'TMV' }) };

  return (
    <div className="mx-auto w-full max-w-[420px]">
      <p className="mb-2 text-center text-xs text-slate-500">Aperçu du portail {isParent ? 'parents' : 'élèves'} (application mobile)</p>
      <div className="flex h-[780px] max-h-[calc(100vh-6rem)] flex-col overflow-hidden rounded-[36px] border-[10px] border-slate-800 bg-paper shadow-2xl">
        <header className="rounded-b-[28px] px-5 pb-4 pt-5 text-white" style={{ background: 'linear-gradient(135deg, #003366, #00427f 55%, var(--amb-topbar-end))' }}>
          <p className="text-xs text-white">Chateaubriand · Tamatave{ambiance ? <> · <span aria-hidden="true">{ambiance.symbol} </span>{ambiance.label}</> : ''}</p>
          <h1 className="mt-0.5 font-display text-xl font-semibold text-white">{isParent ? `Bonjour ${PARENT.name}` : `Bonjour ${child.name} · ${child.cls}`}</h1>
          {isParent && !['payments', 'messages'].includes(view) && (
            <div className="mt-3 flex gap-2">
              {PARENT.children.map((c) => (
                <button key={c.id} onClick={() => setChildId(c.id)} className={`relative rounded-full px-3.5 py-1.5 text-sm font-medium transition ${c.id === childId ? 'bg-white text-navy-900' : 'bg-white/10 text-white hover:bg-white/20'}`}>
                  {c.name} · {c.cls}
                  {childCount(c) > 0 && <span className={`absolute -right-1 -top-1 rounded-full px-1.5 text-[10px] font-bold ${careAlerts(c).length ? 'bg-red-600 text-white' : 'bg-amber-400 text-slate-900'}`} aria-label={`${childCount(c)} à voir`}>{childCount(c)}</span>}
                </button>
              ))}
            </div>
          )}
        </header>
        <div role="region" aria-label="Contenu du portail" className="flex-1 space-y-3 overflow-y-auto p-4"><Embedded className="space-y-3">
          <TermsGate phone viewer={audience} account={isParent ? ACCOUNT.id : 'aina'}>
          {!isTab && <button onClick={() => go('more')} className="text-sm font-medium text-navy-500">‹ Autres</button>}
          {view === 'home' && <Home child={child} isParent={isParent} settings={settings} openFiche={() => go('fiche')} openReenrol={() => go('reenrol')} onSeen={() => setTick((t) => t + 1)} openSchoolLife={() => go('life')} ambiance={ambiance}
            go={go} pending={[...loadAttendance(), ...MEASURES_LOG].filter((x) => x.student === fullName(child) && !x.parentAck && !acks[x.id] && (x.notified ?? true)).length}
            others={PARENT.children.filter((c) => c.id !== child.id && childCount(c) > 0).map((c) => ({ id: c.id, name: c.name, count: childCount(c) }))} pickChild={setChildId} />}
          {view === 'more' && <Others audience={audience} menu={menu} badges={badges} open={go} mandates={student.mandates} />}
          {view.startsWith('mandate-') && <StudentMandates student={student} me={fullName(child)} view={view} />}
          {['schoollife', 'life'].includes(view) && <SchoolTab key={child.id} child={child} isParent={isParent} acks={acks} setAcks={setAcks} settings={settings} audience={audience} pending={pendingAcks} />}
          {view === 'schooldocs' && <FamilyDocuments audience={audience} />}
          {view === 'agenda' && <AgendaModule key={child.id} compact role={audience} cls={child.cls} settings={settings} today={TODAY} />}
          {view === 'reenrol' && (profileOf(child) ? <FamilyRequestForm key={`r-${child.id}`} profile={profileOf(child)} kind="REINSCRIPTION" guardianName={ACCOUNT.name} /> : <Section><p className="text-sm text-slate-500">Fiche introuvable.</p></Section>)}
          {view === 'update' && (profileOf(child) ? <FamilyRequestForm key={`u-${child.id}`} profile={profileOf(child)} kind="MISE_A_JOUR" guardianName={ACCOUNT.name} /> : <Section><p className="text-sm text-slate-500">Fiche introuvable.</p></Section>)}
          {view === 'fiche' && <FicheForm key={child.id} studentKey={fullName(child)} profile={profileOf(child)} account={ACCOUNT.id} accountName={ACCOUNT.name} onUpdate={() => go('update')} />}
          {view === 'signature' && <MySignature />}
          {view === 'contact' && <FamilyContact key={child.id} profile={profileOf(child)} studentKey={fullName(child)} guardianName={ACCOUNT.name} isParent={isParent} go={go} />}
          {view === 'library' && (<>
            <LibraryLoans child={child} isParent={isParent} />
            {!isParent && <BookCatalog key={child.id} compact who={fullName(child)} kind="ELEVE" cls={child.cls} />}
            {!isParent && <GamesAvailable />}
          </>)}
          {view === 'notes' && <Notes child={child} audience={audience} settings={settings} />}
          {view === 'homework' && <Homework child={child} isParent={isParent} />}
          {view === 'documents' && <Documents child={child} isParent={isParent} />}
          {view === 'stages' && <Internships key={child.id} child={child} isParent={isParent} />}
          {view === 'orientation' && <Orientation key={child.id} child={child} isParent={isParent} />}
          {view === 'payments' && <Payments settings={settings} />}
          {view === 'messages' && <div className="-m-4 h-full bg-white p-3"><Messenger audience={audience} compact /></div>}
          </TermsGate>
        </Embedded></div>
        <nav className="grid grid-cols-5 border-t border-slate-100 bg-white px-1 pb-1" aria-label="Navigation du portail">
          {TABS.map(([id, label, icon]) => (
            <button key={id} data-nav={`tab-${id}`} onClick={() => go(id)} aria-current={view === id ? 'page' : undefined}
              className={`relative flex flex-col items-center gap-0.5 py-2 text-[11px] ${view === id ? 'font-semibold text-navy-900' : 'text-slate-400'}`}>
              <Icon name={icon} className="h-5 w-5" />{label}
              {id === 'life' && pendingAcks > 0 && <span className="absolute right-3 top-1 rounded-full bg-amber-400 px-1.5 text-[10px] font-semibold text-slate-900">{pendingAcks}</span>}
              {id === 'more' && moreBadge > 0 && <span className="absolute right-3 top-1 rounded-full bg-amber-400 px-1.5 text-[10px] font-semibold text-slate-900">{moreBadge}</span>}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}
