import React, { useMemo, useState } from 'react';
import { Badge, Button, Icon } from './ui.jsx';
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

// Portail famille : PARENT (toutes les actions) ou ELEVE (presque la même chose, en lecture,
// sans paiements, sans accusés de lecture ni signatures).

const TODAY = '2026-10-13';
const NOW = '2026-10-13T18:30';
const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const longDate = (iso) => formatDateFr(iso).replace(/^\S+ /, '');           // « 20 janvier 2027 »
const shortDate = (iso) => cap(formatDateFr(iso).replace(/ \d{4}$/, ''));    // « Mardi 13 octobre »
const MEASURE = Object.fromEntries(MEASURES.map((m) => [m.id, m]));
const fullName = (child) => `RAKOTOARISOA ${child.name}`;

function Section({ title, children, action }) {
  return (
    <section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      {(title || action) && <div className="mb-2 flex items-center justify-between gap-2">{title && <h2 className="text-sm font-semibold text-slate-900">{title}</h2>}{action}</div>}
      {children}
    </section>
  );
}

/* ---------- Accueil ---------- */
function Home({ child, isParent }) {
  const due = HOMEWORK.filter((h) => h.cls === child.cls && h.due && h.due > TODAY).sort((a, b) => a.due.localeCompare(b.due)).slice(0, 2);
  return (
    <>
      {isParent && PARENT.alerts.map((a) => (
        <div key={a.title} className={`rounded-xl p-3 ring-1 ${a.tone === 'red' ? 'bg-red-50 ring-red-200' : 'bg-amber-50 ring-amber-200'}`}>
          <p className={`text-sm font-semibold ${a.tone === 'red' ? 'text-red-900' : 'text-amber-900'}`}>{a.title}</p>
          <p className={`text-sm ${a.tone === 'red' ? 'text-red-800' : 'text-amber-800'}`}>{a.body}</p>
        </div>
      ))}
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
      <Section title="Actualités">
        <ul className="space-y-3">
          {PARENT.news.map((n) => <li key={n.title}><p className="text-xs text-slate-500">{n.date}</p><p className="text-sm font-medium text-slate-800">{n.title}</p><p className="text-sm text-slate-600">{n.body}</p></li>)}
        </ul>
      </Section>
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
      <div className="grid grid-cols-3 gap-1 rounded-lg bg-white p-1 ring-1 ring-slate-200">
        {['T1', 'T2', 'T3'].map((t) => (
          <button key={t} onClick={() => setTerm(t)} className={`rounded-md py-1.5 text-sm font-medium ${term === t ? 'bg-navy-500 text-white' : 'text-slate-600'}`}>{t.replace('T', '')}{t === 'T1' ? 'er' : 'e'} trimestre</button>
        ))}
      </div>
      <p className="px-1 text-xs text-slate-500">
        {audience === 'PARENT'
          ? `Chaque note est visible ${settings.grading.parentDelayDays} jour${settings.grading.parentDelayDays > 1 ? 's' : ''} après sa publication aux élèves, avec la moyenne de la classe sur le devoir.`
          : 'Chaque note est visible à sa date de publication, avec la moyenne de la classe sur le devoir.'}
        {' '}Pas de moyenne par matière : le bulletin est remis après le conseil de classe.
      </p>
      {term !== 'T1' ? <Section><p className="text-sm text-slate-500">Aucune note pour ce trimestre pour l'instant.</p></Section> : bySubject.map(([subject, notes]) => (
        <Section key={subject}>
          <button onClick={() => setOpen(open === subject ? null : subject)} className="flex w-full items-center justify-between text-left">
            <span className="text-sm font-semibold uppercase tracking-wide text-slate-900">{subject}</span>
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
  const items = [
    ...ATTENDANCE.filter((a) => a.student === name).map((a) => ({ key: a.id, date: a.date, tone: a.kind === 'ABSENCE' ? 'red' : 'amber', title: a.kind === 'ABSENCE' ? 'Absence' : 'Retard', body: `${a.slot}${a.justified ? ` · justifié : ${a.reason}` : ' · à justifier'}`, ack: a.parentAck })),
    ...MEASURES_LOG.filter((m) => m.student === name).map((m) => ({ key: m.id, date: m.date, tone: MEASURE[m.measure].kind === 'SANCTION' ? 'red' : 'amber', title: `${MEASURE[m.measure].kind === 'SANCTION' ? 'Sanction' : 'Punition'} : ${MEASURE[m.measure].label}`, body: `Motif : ${m.reason}${m.when ? ` · ${m.when}` : ''} · décidée par ${m.author}`, ack: m.parentAck })),
    ...PHONES.filter((p) => p.student === name).map((p) => ({ key: p.id, date: p.at.slice(0, 10), tone: 'slate', title: `Téléphone confisqué (${PHONE_DURATIONS.find((d) => d.id === p.duration).label})`, body: `${p.reason} · restitution ${shortDate(phoneReturnAt(p.at, p.duration, settings).slice(0, 10)).toLowerCase()}`, ack: null })),
  ].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <Section title={`Vie scolaire — ${child.name}`}>
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
                    Je suis informé.e{ack && ` · ${shortDate(ack.slice(0, 10)).toLowerCase()}`}
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
                : isParent ? <Button variant="secondary" className="!px-2 !py-1 text-xs" onClick={() => setRequested(requested.map((x) => (x.id === r.id ? { ...x, received: 'PENDING' } : x)))}>Déposer une photo</Button>
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
      <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Convention de stage</p>
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
          {isParent && (asked ? <p className="mt-2 text-sm text-emerald-700">Demande envoyée à la professeure principale.</p>
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
        {info && <p className="mt-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">Au bureau : espèces ou chèque à l'ordre de l'École Chateaubriand. Par virement : RIB fourni par le bureau, nom de l'élève en référence, bordereau à conserver. Le reçu apparaît ici dès l'enregistrement.</p>}
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

function Messages({ isParent }) {
  const [sent, setSent] = useState(false);
  const [text, setText] = useState('');
  return (
    <>
      <Section title="Messages reçus">
        <ul className="space-y-3 text-sm">
          <li><p className="text-xs text-slate-500">05/10 · Notification · Vie scolaire</p><p className="text-slate-700">Aina est arrivée en retard (10 min) ce matin.</p></li>
          <li><p className="text-xs text-slate-500">09/10 · E-mail · Vie scolaire</p><p className="text-slate-700">Dossier Pré-Bac d'Aina : merci de déposer une photo d'identité avant le 30 octobre.</p></li>
        </ul>
      </Section>
      {isParent && (
        <Section title="Écrire à la vie scolaire">
          {sent ? <p className="text-sm text-emerald-700">Message envoyé. Réponse sous 48 h ouvrées.</p> : (
            <>
              <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="Motif d'absence, question…" className="w-full rounded-lg border border-slate-300 p-2 text-sm" />
              <Button className="mt-2 w-full" disabled={!text.trim()} onClick={() => setSent(true)}>Envoyer</Button>
            </>
          )}
        </Section>
      )}
    </>
  );
}

/* ---------- Coquille ---------- */
const TABS = [['home', 'Accueil', 'home'], ['notes', 'Notes', 'pen'], ['homework', 'Devoirs', 'calendar'], ['life', 'Vie scol.', 'users'], ['more', 'Plus', 'settings']];
const MORE = [
  ['documents', 'Documents & autorisations', 'pen'], ['stages', 'Stages', 'cap'], ['orientation', 'Orientation', 'cap'],
  ['payments', 'Paiements', 'wallet', 'PARENT'], ['messages', 'Messages', 'bell'],
];

export default function FamilyPortal({ settings, audience = 'PARENT' }) {
  const isParent = audience === 'PARENT';
  const [tab, setTab] = useState('home');
  const [sub, setSub] = useState(null);
  const [childId, setChildId] = useState(PARENT.children[0].id);
  const [acks, setAcks] = useState({});
  const child = PARENT.children.find((c) => c.id === (isParent ? childId : 'aina'));
  const pendingAcks = isParent ? [...ATTENDANCE, ...MEASURES_LOG].filter((x) => PARENT.children.some((c) => fullName(c) === x.student) && !x.parentAck && !acks[x.id] && (x.notified ?? true)).length : 0;
  const view = tab === 'more' ? sub : tab;
  const go = (t) => { setTab(t); setSub(null); };

  return (
    <div className="mx-auto w-full max-w-[420px]">
      <p className="mb-2 text-center text-xs text-slate-500">Aperçu du portail {isParent ? 'parents' : 'élèves'} (application mobile)</p>
      <div className="flex h-[780px] max-h-[calc(100vh-6rem)] flex-col overflow-hidden rounded-[28px] border-8 border-slate-900 bg-slate-100 shadow-xl">
        <header className="bg-navy-900 px-4 pb-3 pt-4 text-white">
          <p className="text-xs text-navy-200">Chateaubriand · Tamatave</p>
          <p className="text-base font-semibold">{isParent ? `Bonjour ${PARENT.name}` : `Bonjour ${child.name} · ${child.cls}`}</p>
          {isParent && !['payments', 'messages'].includes(view) && (
            <div className="mt-3 flex gap-2">
              {PARENT.children.map((c) => (
                <button key={c.id} onClick={() => setChildId(c.id)} className={`rounded-full px-3 py-1 text-sm ${c.id === childId ? 'bg-white text-navy-900' : 'bg-white/10 text-white'}`}>{c.name} · {c.cls}</button>
              ))}
            </div>
          )}
        </header>
        <div role="region" aria-label="Contenu du portail" className="flex-1 space-y-3 overflow-y-auto p-3">
          {tab === 'more' && sub && <button onClick={() => setSub(null)} className="text-sm font-medium text-navy-500">‹ Plus</button>}
          {view === 'home' && <Home child={child} isParent={isParent} />}
          {view === 'notes' && <Notes child={child} audience={audience} settings={settings} />}
          {view === 'homework' && <Homework child={child} isParent={isParent} />}
          {view === 'life' && <SchoolLife child={child} isParent={isParent} acks={acks} setAcks={setAcks} settings={settings} />}
          {view === 'documents' && <Documents child={child} isParent={isParent} />}
          {view === 'stages' && <Internships key={child.id} child={child} isParent={isParent} />}
          {view === 'orientation' && <Orientation key={child.id} child={child} isParent={isParent} />}
          {view === 'payments' && <Payments />}
          {view === 'messages' && <Messages isParent={isParent} />}
          {tab === 'more' && !sub && (
            <div className="grid grid-cols-2 gap-2">
              {MORE.filter((m) => !m[3] || m[3] === audience).map(([id, label, icon]) => (
                <button key={id} onClick={() => setSub(id)} className="flex flex-col items-start gap-2 rounded-xl bg-white p-4 text-left text-sm font-medium text-slate-800 shadow-sm ring-1 ring-slate-200">
                  <Icon name={icon} className="h-5 w-5 text-navy-500" />{label}
                </button>
              ))}
            </div>
          )}
        </div>
        <nav className="grid grid-cols-5 border-t border-slate-200 bg-white" aria-label="Navigation du portail">
          {TABS.map(([id, label, icon]) => (
            <button key={id} onClick={() => go(id)} aria-current={tab === id ? 'page' : undefined}
              className={`relative flex flex-col items-center gap-0.5 py-2 text-[11px] ${tab === id ? 'text-navy-500' : 'text-slate-500'}`}>
              <Icon name={icon} className="h-5 w-5" />{label}
              {id === 'life' && pendingAcks > 0 && <span className="absolute right-3 top-1 rounded-full bg-red-600 px-1.5 text-[10px] font-semibold text-white">{pendingAcks}</span>}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}
