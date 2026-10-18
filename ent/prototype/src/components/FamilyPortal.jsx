import React, { useMemo, useState } from 'react';
import { Badge, Button, Icon } from './ui.jsx';
import Messenger, { unreadCount } from './Messenger.jsx';
import { PARENT } from '../data/people.js';
import { FAMILIES, JOURNALS } from '../data/accounting.js';
import { ATTENDANCE, MEASURES_LOG, PHONES } from '../data/schoollife.js';
import { HOMEWORK } from '../data/homework.js';
import {
  OTHER_NOTES, GRADEBOOK_SUBJECTS, SERVICES, EVALUATIONS, GRADES, REMARKS, AUTHORIZATIONS, AUTH_ANSWERS, DOCUMENTS, REQUESTED, INTERNSHIPS, ORIENTATION,
} from '../data/family.js';
import { accountStatement } from '../rules/accounting.js';
import { formatAr } from '../rules/finance.js';
import { studentNoteList, fmt2, isPublished, parentPublishOn } from '../rules/grading.js';
import { MEASURES, PHONE_DURATIONS, phoneReturnAt } from '../rules/discipline.js';
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
import SchoolLifeModule, { SocialLinks } from './SchoolLifeModule.jsx';
import { loadPassport } from './PassportTab.jsx';
import { passport, COLLE_STATUS } from '../rules/discipline.js';
import { parentNotice } from '../rules/care.js';

// Portail famille : PARENT (toutes les actions) ou ELEVE (presque la même chose, en lecture,
// sans paiements, sans accusés de lecture ni signatures).

const TODAY = '2026-10-13';
const NOW = '2026-10-13T18:30';
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
        <div className="flex gap-1.5 overflow-x-auto">{last.photos.slice(0, 3).map((src, i) => <img key={i} src={src} alt="" className="h-20 w-28 shrink-0 rounded-lg object-cover" />)}</div></>}
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

function Home({ child, isParent, openFiche, openReenrol, settings, onSeen, openSchoolLife }) {
  const due = HOMEWORK.filter((h) => h.cls === child.cls && h.due && h.due > TODAY).sort((a, b) => a.due.localeCompare(b.due)).slice(0, 2);
  return (
    <>
      {isParent && <UrgentBanner child={child} onSeen={onSeen} />}
      <Announcements isParent={isParent} />
      <SchoolLifePreview open={openSchoolLife} social={settings?.social} />
      {isParent && PARENT.alerts.map((a) => (
        <div key={a.title} className={`rounded-2xl p-4 ${a.tone === 'red' ? 'bg-red-50' : 'bg-amber-50'}`}>
          <p className={`text-sm font-semibold ${a.tone === 'red' ? 'text-red-900' : 'text-amber-900'}`}>{a.title}</p>
          <p className={`text-sm ${a.tone === 'red' ? 'text-red-800' : 'text-amber-800'}`}>{a.body}</p>
        </div>
      ))}
      {isParent && !ficheOf(fullName(child))?.signedAt && (
        <div className="rounded-2xl bg-navy-50 p-4">
          <p className="text-sm font-semibold text-navy-900">Fiche signalétique {FICHE_YEAR} — {child.name}</p>
          <p className="text-sm text-navy-800">À vérifier, compléter et signer en ligne. Elle est déjà pré-remplie.</p>
          <Button className="mt-2 !py-1 text-xs" onClick={openFiche}>Remplir et signer</Button>
        </div>
      )}
      {isParent && <BulletinPickup child={child} settings={settings} />}
      <BookDueSoon child={child} />
      {isParent && profileOf(child) && nextClass(child.cls) && (
        <div className="rounded-2xl bg-emerald-50 p-4">
          <p className="text-sm font-semibold text-emerald-900">Réinscriptions 2027-2028 ouvertes</p>
          <p className="text-sm text-emerald-800">{nextClass(profileOf(child).cls) ? `Réinscrivez ${child.name} en ${nextClass(profileOf(child).cls)} depuis votre téléphone, avec les pièces en photo.` : `Dites-nous si ${child.name} poursuit ailleurs l'an prochain.`}</p>
          <Button className="mt-2 !py-1 text-xs" onClick={openReenrol}>Réinscrire {child.name} pour 2027-2028</Button>
        </div>
      )}
      <Section title={`Aujourd'hui — ${child.name}`}>
        <ul className="space-y-1.5">
          {child.timetable.map(([t, s]) => <li key={t} className="flex gap-3 text-sm"><span className="w-12 font-medium tabular-nums text-navy-900">{t.replace(':', 'h')}</span><span className="text-slate-700">{s}</span></li>)}
        </ul>
      </Section>
      {due.length > 0 && (
        <Section title="Prochains devoirs">
          {due.map((h) => <p key={h.id} className="text-sm text-slate-700"><span className="font-medium">{shortDate(h.due)} · {h.subject} :</span> {h.todo}</p>)}
        </Section>
      )}
    </>
  );
}

/* ---------- Notes : par matière, chronologiques, sans bulletin ---------- */
function NoteCard({ n }) {
  const scale = n.scale === 20 ? '' : ` / ${n.scale}`;
  return (
    <li className="rounded-lg border border-slate-200 p-3">
      <p className="text-sm font-medium text-slate-800">Note du {longDate(n.date)}</p>
      <p className="text-xs text-slate-500">{n.type} · {n.title}{n.themes?.length ? ` · ${n.themes.join(', ')}` : ''}</p>
      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
        <dt className="text-slate-500">Note élève :</dt>
        <dd className="text-right font-semibold tabular-nums text-navy-900">{n.status === 'NOTE' ? `${fmt2(n.value)}${scale}` : n.status === 'ABSENT' ? 'Absent.e' : n.status === 'DISPENSE' ? 'Dispensé.e' : 'Non noté.e'}</dd>
        <dt className="text-slate-500">Moyenne classe :</dt><dd className="text-right tabular-nums">{fmt2(n.avg)}{scale}</dd>
        <dt className="text-slate-500">Note la plus haute :</dt><dd className="text-right tabular-nums">{fmt2(n.max)}{scale}</dd>
        <dt className="text-slate-500">Note la plus basse :</dt><dd className="text-right tabular-nums">{fmt2(n.min)}{scale}</dd>
        <dt className="text-slate-500">Coefficient :</dt><dd className="text-right tabular-nums">{String(n.coef).replace('.', ',')}</dd>
      </dl>
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
  return (
    <>
      <div className="grid grid-cols-3 gap-1 rounded-full bg-white p-1 shadow-soft">
        {['T1', 'T2', 'T3'].map((t) => (
          <button key={t} onClick={() => setTerm(t)} className={`rounded-md py-1.5 text-sm font-medium ${term === t ? 'bg-navy-500 text-white' : 'text-slate-600'}`}>{t.replace('T', '')}{t === 'T1' ? 'er' : 'e'} trimestre</button>
        ))}
      </div>
      {term !== 'T1' ? <Section><p className="text-sm text-slate-500">Aucune note pour ce trimestre pour l'instant.</p></Section> : bySubject.map(([subject, notes]) => (
        <Section key={subject}>
          <button onClick={() => setOpen(open === subject ? null : subject)} className="flex w-full items-center justify-between text-left">
            <span className="flex items-center gap-2.5 text-sm font-semibold text-slate-900"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: subjectColor(subject) }} />{subject}</span>
            <span className="text-xs text-slate-500">{notes.length} note{notes.length > 1 ? 's' : ''} {open === subject ? '▴' : '▾'}</span>
          </button>
          {open === subject && <ul className="mt-3 space-y-2">{notes.map((n) => <NoteCard key={n.id} n={n} />)}</ul>}
        </Section>
      ))}
    </>
  );
}

/* ---------- Devoirs (cahier de textes) ---------- */
function Homework({ child, isParent }) {
  const [done, setDone] = useState({});
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

/* ---------- Vie scolaire : absences, retards, punitions, sanctions, téléphones ---------- */
function SchoolLife({ child, isParent, acks, setAcks, settings }) {
  const name = fullName(child);
  const pp = passport(name, { attendance: ATTENDANCE, ...loadPassport() });
  const items = [
    ...ATTENDANCE.filter((a) => a.student === name).map((a) => ({ key: a.id, date: a.date, tone: a.kind === 'ABSENCE' ? 'red' : 'amber', title: a.kind === 'ABSENCE' ? 'Absence' : 'Retard', body: `${a.slot}${a.justified ? ` · justifié : ${a.reason}` : ' · à justifier'}`, ack: a.parentAck })),
    ...MEASURES_LOG.filter((m) => m.student === name).map((m) => ({ key: m.id, date: m.date, tone: MEASURE[m.measure].kind === 'SANCTION' ? 'red' : 'amber', title: `${MEASURE[m.measure].kind === 'SANCTION' ? 'Sanction' : 'Punition'} : ${MEASURE[m.measure].label}`, body: `Motif : ${m.reason}${m.when ? ` · ${m.when}` : ''} · décidée par ${m.author}`, ack: m.parentAck })),
    ...pp.entries.map((c) => ({ key: c.id, date: c.date, tone: c.kind === 'TIG' ? 'red' : 'amber', title: c.kind === 'TIG' ? 'Travail d\'intérêt général (TIG)' : `Colle de ${c.hours} h`, body: `${c.reason} · le ${c.when.slice(8, 10)}/${c.when.slice(5, 7)} à ${c.when.slice(11, 16).replace(':', 'h')} · ${COLLE_STATUS[c.status].toLowerCase()}`, ack: null })),
    ...PHONES.filter((p) => p.student === name || p.owner === name).map((p) => (p.action === 'AVERTISSEMENT'
      ? { key: p.id, date: p.at.slice(0, 10), tone: 'amber', title: 'Avertissement : téléphone', body: `${p.reason} · donné par ${p.confiscatedBy}`, ack: null }
      : { key: p.id, date: p.at.slice(0, 10), tone: 'slate', title: `Téléphone confisqué (${PHONE_DURATIONS.find((d) => d.id === p.duration).label})`, body: `${p.owner === name && p.student !== name ? `Téléphone de ${child.name}, pris avec ${p.student}. ` : ''}${p.reason} · restitution ${shortDate(phoneReturnAt(p.at, p.duration, settings).slice(0, 10)).toLowerCase()}`, ack: null })),
  ].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <Section title={`Vie scolaire — ${child.name}`}>
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
                {isParent ? (
                  <label className={`mt-2 flex items-center gap-2 text-sm ${ack ? 'text-emerald-700' : 'text-slate-800'}`}>
                    <input type="checkbox" checked={!!ack} disabled={!!ack} onChange={() => setAcks({ ...acks, [it.key]: NOW })} />
                    J'ai pris connaissance{ack && ` · ${shortDate(ack.slice(0, 10)).toLowerCase()}`}
                  </label>
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
function Documents({ child, isParent }) {
  const [answers, setAnswers] = useState(AUTH_ANSWERS);
  const [docs, setDocs] = useState(DOCUMENTS);
  const [requested, setRequested] = useState(REQUESTED);
  const mine = answers[child.id] ?? {};
  return (
    <>
      <Section title={`Autorisations — ${child.name}`}>
        <ul className="space-y-3">
          {AUTHORIZATIONS.map((a) => (
            <li key={a.id}>
              <p className="text-sm font-medium text-slate-800">{a.label}</p>
              <p className="text-xs text-slate-500">{a.detail}</p>
              {isParent ? (
                <select value={mine[a.id]?.answer ?? ''} onChange={(e) => setAnswers({ ...answers, [child.id]: { ...mine, [a.id]: { answer: e.target.value, at: TODAY } } })}
                  className={`mt-1 w-full rounded-md border px-2 py-1.5 text-sm ${mine[a.id] ? 'border-slate-300' : 'border-amber-400 bg-amber-50'}`}>
                  <option value="" disabled>Réponse attendue…</option>{a.options.map((o) => <option key={o}>{o}</option>)}
                </select>
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
  const [list, setList] = useState(INTERNSHIPS[child.id]);
  const info = <p className="text-xs text-slate-500">Stages obligatoires : 3e, stage d'observation d'une semaine ; 2de, stage de deux semaines.</p>;
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
  const o = ORIENTATION[child.id];
  const [asked, setAsked] = useState(false);
  return (
    <>
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
function Payments() {
  const fam = FAMILIES.find((f) => f.id === PARENT.familyId);
  const { rows, byJournal, totals } = useMemo(() => accountStatement(fam.lines), [fam]);
  const [info, setInfo] = useState(false);
  return (
    <>
      <Section>
        <p className="text-xs text-slate-500">Reste à payer (famille)</p>
        <p className={`text-2xl font-semibold tabular-nums ${totals.balance > 0 ? 'text-red-700' : 'text-emerald-700'}`}>{formatAr(totals.balance)}</p>
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

/* ---------- Livres empruntés (salle d'étude) ---------- */
function LibraryLoans({ child }) {
  const { books, loans } = loadLibrary();
  const mine = loans.filter((l) => l.borrower === fullName(child) && !l.returnedOn);
  const bookOf = (code) => books.find((b) => b.copies.some((c) => c.code === code));
  return (
    <Section title="Livres empruntés">
      {mine.length === 0 ? <p className="text-sm text-slate-500">Aucun livre emprunté.</p> : (
        <ul className="space-y-2">
          {mine.map((l) => (
            <li key={l.id} className="rounded-xl border border-slate-200 p-3 text-sm">
              <p className="font-medium text-slate-800">{designation(bookOf(l.code))}</p>
              <p className={`text-xs ${l.due < TODAY ? 'text-red-700' : daysLeft(l.due, TODAY) <= 3 ? 'font-medium text-amber-700' : 'text-slate-500'}`}>{l.code} · à rendre le {l.due.split('-').reverse().join('/')}{l.due < TODAY ? ' (en retard)' : daysLeft(l.due, TODAY) <= 3 ? ` (dans ${daysLeft(l.due, TODAY)} jour${daysLeft(l.due, TODAY) > 1 ? 's' : ''})` : ''}</p>
            </li>
          ))}
        </ul>
      )}
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
// Barre du bas : Accueil, Vie scolaire, Notes, Agenda (cours, devoirs, événements) et Autres.
// « Autres » range tout le reste par thème, en rubriques qui se déroulent et se replient ;
// ce qui ne concerne pas l'enfant reste grisé.
const TABS = [['home', 'Accueil', 'home'], ['life', 'Vie scol.', 'users'], ['notes', 'Notes', 'pen'], ['agenda', 'Agenda', 'calendar'], ['more', 'Autres', 'menu']];
const SECTIONS = [
  ['Échanges', [['messages', 'Messages', 'bell'], ['schoollife', 'Vie de l\'école', 'sparkles'], ['schooldocs', 'Règlement et chartes', 'pen']]],
  ['Scolarité', [['library', 'Bibliothèque', 'cap'], ['stages', 'Stages', 'cap'], ['orientation', 'Orientation', 'cap']]],
  ['Démarches', [['documents', 'Documents et autorisations', 'pen'], ['payments', 'Paiements', 'wallet', 'PARENT'], ['fiche', 'Fiche signalétique', 'pen', 'PARENT'], ['reenrol', 'Réinscription', 'calendar', 'PARENT'], ['update', 'Mettre à jour nos informations', 'users', 'PARENT'], ['signature', 'Ma signature', 'pen', 'PARENT']]],
];

function Others({ audience, menu, badges, open }) {
  const isParent = audience === 'PARENT';
  return SECTIONS.map(([title, items]) => {
    const list = items.filter((m) => !m[3] || m[3] === audience);
    if (!list.length) return null;
    const count = list.reduce((t, [id]) => t + (menu[id] === false ? 0 : badges[id] ?? 0), 0);
    return (
      <details key={title} open className="group rounded-2xl bg-white/70 p-2 shadow-soft">
        <summary className="flex cursor-pointer list-none items-center justify-between px-2 py-1.5 text-sm font-semibold text-slate-800">
          <span>{title}{count > 0 && <span className="ml-2 rounded-full bg-amber-500 px-1.5 text-[10px] font-semibold text-white">{count}</span>}</span>
          <span className="text-slate-400 transition group-open:rotate-180">▾</span>
        </summary>
        <div className="mt-1 grid grid-cols-3 gap-2">
          {list.map(([id, label, icon]) => {
            const off = menu[id] === false;
            return (
              <button key={id} type="button" disabled={off} onClick={() => open(id)}
                className={`relative flex min-h-[78px] flex-col items-center justify-center gap-1 rounded-2xl p-2 text-center text-[12px] font-medium leading-tight ${off ? 'cursor-default bg-slate-100 text-slate-400' : 'bg-white text-slate-800 shadow-soft'}`}>
                <Icon name={icon} className={`h-5 w-5 ${off ? 'text-slate-300' : 'text-navy-500'}`} />
                <span>{label}{off && <span className="block text-[10px] font-normal">(ne concerne pas {isParent ? 'votre enfant' : 'ta classe'})</span>}</span>
                {!off && badges[id] > 0 && <span className="absolute right-1.5 top-1.5 rounded-full bg-amber-500 px-1.5 text-[10px] font-semibold text-white">{badges[id]}</span>}
              </button>
            );
          })}
        </div>
      </details>
    );
  });
}

export default function FamilyPortal({ settings, audience = 'PARENT', season }) {
  const isParent = audience === 'PARENT';
  const [screen, setScreen] = useState('home');
  const [childId, setChildId] = useState(PARENT.children[0].id);
  const [acks, setAcks] = useState({});
  const [tick, setTick] = useState(0); void tick;
  // pastille par enfant : alertes urgentes non vues + mesures à confirmer
  const childCount = (c) => careAlerts(c).length + [...ATTENDANCE, ...MEASURES_LOG].filter((x) => x.student === fullName(c) && !x.parentAck && !acks[x.id] && (x.notified ?? true)).length;
  const child = PARENT.children.find((c) => c.id === (isParent ? childId : 'aina'));
  const pendingAcks = isParent ? [...ATTENDANCE, ...MEASURES_LOG].filter((x) => PARENT.children.some((c) => fullName(c) === x.student) && !x.parentAck && !acks[x.id] && (x.notified ?? true)).length : 0;
  // menu « Plus » selon la classe de l'enfant affiché ; un écran qui ne le concerne pas est refermé
  const menu = menuFor(child, { hasInternships: (INTERNSHIPS[child.id] ?? []).length > 0 });
  // un écran qui ne concerne pas l'enfant choisi revient à l'accueil
  const view = menu[screen] === false ? 'home' : screen;
  const unread = view === 'messages' ? 0 : unreadCount(audience);
  const go = (t) => setScreen(t);
  const badges = { life: pendingAcks, messages: unread, fiche: isParent && !ficheOf(fullName(child))?.signedAt ? 1 : 0 };
  const moreBadge = unread + badges.fiche;
  const isTab = TABS.some(([id]) => id === view);

  return (
    <div className="mx-auto w-full max-w-[420px]">
      <p className="mb-2 text-center text-xs text-slate-500">Aperçu du portail {isParent ? 'parents' : 'élèves'} (application mobile)</p>
      <div className="flex h-[780px] max-h-[calc(100vh-6rem)] flex-col overflow-hidden rounded-[36px] border-[10px] border-slate-800 bg-paper shadow-2xl">
        <header className="rounded-b-[28px] px-5 pb-4 pt-5 text-white" style={{ background: `linear-gradient(135deg, #003366, #00427f 55%, ${season?.accent ?? '#005baa'})` }}>
          {season && <p className="mb-1 truncate text-center text-xs tracking-[0.4em]" aria-hidden="true">{season.garland}</p>}
          <p className="text-xs text-navy-200">Chateaubriand · Tamatave{season ? ` · ${season.label}` : ''}</p>
          <p className="mt-0.5 font-display text-xl font-semibold">{isParent ? `Bonjour ${PARENT.name}` : `Bonjour ${child.name} · ${child.cls}`}</p>
          {isParent && !['payments', 'messages'].includes(view) && (
            <div className="mt-3 flex gap-2">
              {PARENT.children.map((c) => (
                <button key={c.id} onClick={() => setChildId(c.id)} className={`relative rounded-full px-3.5 py-1.5 text-sm font-medium transition ${c.id === childId ? 'bg-white text-navy-900' : 'bg-white/10 text-white hover:bg-white/20'}`}>
                  {c.name} · {c.cls}
                  {childCount(c) > 0 && <span className={`absolute -right-1 -top-1 rounded-full px-1.5 text-[10px] font-bold text-white ${careAlerts(c).length ? 'bg-red-600' : 'bg-amber-500'}`} aria-label={`${childCount(c)} à voir`}>{childCount(c)}</span>}
                </button>
              ))}
            </div>
          )}
        </header>
        <div role="region" aria-label="Contenu du portail" className="flex-1 space-y-3 overflow-y-auto p-4">
          <TermsGate phone viewer={audience} account={isParent ? ACCOUNT.id : 'aina'}>
          {!isTab && <button onClick={() => go('more')} className="text-sm font-medium text-navy-500">‹ Autres</button>}
          {view === 'home' && <Home child={child} isParent={isParent} settings={settings} openFiche={() => go('fiche')} openReenrol={() => go('reenrol')} onSeen={() => setTick((t) => t + 1)} openSchoolLife={() => go('schoollife')} />}
          {view === 'more' && <Others audience={audience} menu={menu} badges={badges} open={go} />}
          {view === 'schoollife' && <SchoolLifeModule compact role={audience} settings={settings} cls={child.cls} author={isParent ? 'Parent' : `${child.name} (${child.cls})`} />}
          {view === 'schooldocs' && <FamilyDocuments audience={audience} />}
          {view === 'agenda' && <AgendaModule key={child.id} compact role={audience} cls={child.cls} settings={settings} today={TODAY} />}
          {view === 'reenrol' && (profileOf(child) ? <FamilyRequestForm key={`r-${child.id}`} profile={profileOf(child)} kind="REINSCRIPTION" guardianName={ACCOUNT.name} /> : <Section><p className="text-sm text-slate-500">Fiche introuvable.</p></Section>)}
          {view === 'update' && (profileOf(child) ? <FamilyRequestForm key={`u-${child.id}`} profile={profileOf(child)} kind="MISE_A_JOUR" guardianName={ACCOUNT.name} /> : <Section><p className="text-sm text-slate-500">Fiche introuvable.</p></Section>)}
          {view === 'fiche' && <FicheForm key={child.id} studentKey={fullName(child)} profile={profileOf(child)} account={ACCOUNT.id} accountName={ACCOUNT.name} />}
          {view === 'signature' && <MySignature />}
          {view === 'library' && (<>
            <LibraryLoans child={child} />
            <BookCatalog key={child.id} compact who={fullName(child)} kind={isParent ? 'PARENT' : 'ELEVE'} cls={child.cls} />
            {isParent && <p className="text-center text-xs text-slate-500">La réservation se fait depuis le compte de l'élève.</p>}
            {!isParent && <GamesAvailable />}
          </>)}
          {view === 'notes' && <Notes child={child} audience={audience} settings={settings} />}
          {view === 'homework' && <Homework child={child} isParent={isParent} />}
          {view === 'life' && <SchoolLife child={child} isParent={isParent} acks={acks} setAcks={setAcks} settings={settings} />}
          {view === 'documents' && <Documents child={child} isParent={isParent} />}
          {view === 'stages' && <Internships key={child.id} child={child} isParent={isParent} />}
          {view === 'orientation' && <Orientation key={child.id} child={child} isParent={isParent} />}
          {view === 'payments' && <Payments />}
          {view === 'messages' && <div className="-m-4 h-full bg-white p-3"><Messenger audience={audience} compact /></div>}
          </TermsGate>
        </div>
        <nav className="grid grid-cols-5 border-t border-slate-100 bg-white px-1 pb-1" aria-label="Navigation du portail">
          {TABS.map(([id, label, icon]) => (
            <button key={id} onClick={() => go(id)} aria-current={view === id ? 'page' : undefined}
              className={`relative flex flex-col items-center gap-0.5 py-2 text-[11px] ${view === id ? 'font-semibold text-navy-900' : 'text-slate-400'}`}>
              <Icon name={icon} className="h-5 w-5" />{label}
              {id === 'life' && pendingAcks > 0 && <span className="absolute right-3 top-1 rounded-full bg-amber-500 px-1.5 text-[10px] font-semibold text-white">{pendingAcks}</span>}
              {id === 'more' && moreBadge > 0 && <span className="absolute right-3 top-1 rounded-full bg-amber-500 px-1.5 text-[10px] font-semibold text-white">{moreBadge}</span>}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}
