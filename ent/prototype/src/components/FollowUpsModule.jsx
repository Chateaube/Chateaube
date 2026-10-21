import React, { useState } from 'react';
import { Badge, Button, Card } from './ui.jsx';
import { ClassStudentPicker } from './VieScolaireModule.jsx';
import { loadPassport } from './PassportTab.jsx';
import { ATTENDANCE, MEASURES_LOG, classOf, STAFF_NAMES } from '../data/schoollife.js';
import { ABSENCES, OTHER_AVERAGES } from '../data/grades.js';
import { justification } from '../rules/attendance.js';
import { FOLLOWUP_KINDS, CONDITIONS, followUpErrors, evaluateFollowUp, followUpReport } from '../rules/followup.js';
import { loadFollowUps, saveFollowUps } from '../followupsStore.js';
import { logActivity, ACTOR } from '../activityStore.js';

// Suivis individuels (Direction et CPE seulement) : élèves au dossier lourd, suivi demandé par les parents,
// contrat avec conditions (financement d'un club sportif…). L'état se calcule tout seul : absences non
// justifiées, retards, punitions et colles, moyenne générale, comparés aux conditions fixées.

const NOW = '2026-10-13T11:00';
const field = 'rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm';
const fr = (iso) => iso.split('-').reverse().join('/');
const EVERY = { SEMAINE: 'chaque semaine', MOIS: 'chaque mois', DEMANDE: 'à la demande' };

/** Faits de l'élève : bilan du trimestre s'il existe, sinon les saisies de vie scolaire. */
function factsOf(student) {
  const a = ABSENCES[student];
  const mine = ATTENDANCE.filter((x) => x.student === student);
  const avgs = Object.values(OTHER_AVERAGES[student] ?? {});
  return {
    unjustified: a ? a.unjustified : mine.filter((x) => x.kind === 'ABSENCE' && justification(x, NOW).status === 'NON_JUSTIFIEE').length,
    lates: a ? a.late : mine.filter((x) => x.kind === 'RETARD').length,
    measures: MEASURES_LOG.filter((m) => m.student === student).length + loadPassport().colles.filter((c) => c.student === student).length,
    average: avgs.length ? Math.round((avgs.reduce((t, v) => t + v, 0) / avgs.length) * 10) / 10 : null,
  };
}

export default function FollowUpsModule({ role }) {
  const actor = ACTOR[role] ?? ACTOR.VIE_SCOLAIRE;
  const [list, setList] = useState(loadFollowUps);
  const [draft, setDraft] = useState(null);
  const [tried, setTried] = useState(false);
  const [note, setNote] = useState({});
  const [msg, setMsg] = useState('');
  const save = (l) => { setList(l); saveFollowUps(l); };
  const open = list.filter((f) => !f.closed);
  const rows = open.map((f) => ({ f, facts: factsOf(f.student) })).map((x) => ({ ...x, ev: evaluateFollowUp(x.f, x.facts) }))
    .sort((a, b) => (a.ev.status === b.ev.status ? a.f.student.localeCompare(b.f.student) : a.ev.status === 'ALERTE' ? -1 : 1));
  const addNote = (f, text) => save(list.map((x) => (x.id === f.id ? { ...x, notes: [...x.notes, { at: NOW.slice(0, 10), by: actor, text }] } : x)));
  const sendPoint = (f, facts, ev) => {
    addNote(f, 'Point envoyé aux parents (application et e-mail).');
    logActivity({ who: actor, role, kind: 'SUIVI', student: f.student, text: `Point de suivi envoyé aux parents (${ev.status === 'ALERTE' ? 'conditions non tenues' : 'tout va bien'})` });
    setMsg(`Point envoyé aux parents de ${f.student} :\n${followUpReport(f, facts, ev, `au ${fr(NOW.slice(0, 10))}`)}`);
  };
  const errors = draft ? followUpErrors(draft) : [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-navy-500">Direction et CPE · confidentiel</p>
          <h1 className="text-2xl font-semibold text-navy-900">Suivis individuels</h1>
          <p className="text-sm text-slate-600">Dossiers lourds, suivis demandés par les parents, contrats avec conditions. Les professeurs et les familles ne voient pas cette page.</p>
        </div>
        <Button onClick={() => { setDraft({ student: '', kind: 'DOSSIER', referent: actor, since: NOW.slice(0, 10), every: 'SEMAINE', conditions: {}, contact: { name: '', role: '', phone: '', email: '', parentConsent: false }, firstNote: '' }); setTried(false); }}>＋ Nouveau suivi</Button>
      </div>
      {msg && <pre role="status" className="whitespace-pre-wrap rounded-lg bg-emerald-50 p-3 font-sans text-sm text-emerald-900">{msg}</pre>}

      {draft && (
        <Card title="Nouveau suivi">
          <div className="grid gap-3 text-sm lg:grid-cols-2">
            <div className="space-y-2">
              <ClassStudentPicker value={draft.student} onChange={(student) => setDraft({ ...draft, student })} />
              <label className="block text-xs text-slate-600">Motif<select value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value })} className={`mt-1 w-full ${field}`}>{Object.entries(FOLLOWUP_KINDS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-xs text-slate-600">Référent<select value={draft.referent} onChange={(e) => setDraft({ ...draft, referent: e.target.value })} className={`mt-1 w-full ${field}`}>{[...new Set([actor, ...STAFF_NAMES.filter((n) => n.includes('CPE') || n.startsWith('Direction'))])].map((n) => <option key={n}>{n}</option>)}</select></label>
                <label className="block text-xs text-slate-600">Point aux parents<select value={draft.every} onChange={(e) => setDraft({ ...draft, every: e.target.value })} className={`mt-1 w-full ${field}`}>{Object.entries(EVERY).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
              </div>
              <label className="block text-xs text-slate-600">Ce qu'il faut savoir (interne)<textarea rows={2} value={draft.firstNote} onChange={(e) => setDraft({ ...draft, firstNote: e.target.value })} className={`mt-1 w-full ${field}`} /></label>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-700">Conditions (laisser vide si aucune)</p>
              <div className="grid grid-cols-2 gap-2">{CONDITIONS.map((c) => (
                <label key={c.id} className="block text-xs text-slate-600">{c.label} — {c.unit}<input inputMode="decimal" value={draft.conditions[c.id] ?? ''} onChange={(e) => setDraft({ ...draft, conditions: { ...draft.conditions, [c.id]: e.target.value.replace(',', '.') } })} className={`mt-1 w-full ${field}`} /></label>
              ))}</div>
              <p className="pt-1 text-xs font-semibold text-slate-700">Contact extérieur (facultatif : club, association, financeur)</p>
              <div className="grid grid-cols-2 gap-2">
                {[['name', 'Nom'], ['role', 'Rôle (ex. président du club)'], ['phone', 'Téléphone'], ['email', 'E-mail']].map(([k, l]) => (
                  <label key={k} className="block text-xs text-slate-600">{l}<input value={draft.contact[k]} onChange={(e) => setDraft({ ...draft, contact: { ...draft.contact, [k]: e.target.value } })} className={`mt-1 w-full ${field}`} /></label>
                ))}
              </div>
              {draft.contact.name.trim() && <label className="flex items-start gap-2 text-xs text-slate-700"><input type="checkbox" className="mt-0.5" checked={draft.contact.parentConsent} onChange={(e) => setDraft({ ...draft, contact: { ...draft.contact, parentConsent: e.target.checked } })} />Les parents ont donné leur accord écrit pour que l'école donne des nouvelles de l'élève à cette personne</label>}
            </div>
          </div>
          {tried && errors.length > 0 && <ul className="mt-3 rounded-md bg-red-50 p-2 text-xs text-red-800">{errors.map((e) => <li key={e}>· {e}</li>)}</ul>}
          <div className="mt-3 flex gap-2">
            <Button onClick={() => {
              setTried(true); if (errors.length) return;
              const { firstNote, ...rest } = draft;
              const f = { ...rest, id: `s${Date.now()}`, contact: draft.contact.name.trim() ? draft.contact : null, notes: firstNote.trim() ? [{ at: NOW.slice(0, 10), by: actor, text: firstNote.trim() }] : [], closed: null };
              save([f, ...list]); logActivity({ who: actor, role, kind: 'SUIVI', student: f.student, text: `Suivi individuel ouvert : ${FOLLOWUP_KINDS[f.kind].toLowerCase()}` });
              setDraft(null);
            }}>Ouvrir le suivi</Button>
            <Button variant="secondary" onClick={() => setDraft(null)}>Annuler</Button>
          </div>
        </Card>
      )}

      {rows.length === 0 && !draft && <Card><p className="text-sm text-slate-600">Aucun suivi en cours.</p></Card>}
      {rows.map(({ f, facts, ev }) => (
        <Card key={f.id} title={`${f.student} — ${classOf(f.student) ?? ''}`}
          subtitle={`${FOLLOWUP_KINDS[f.kind]} · référent : ${f.referent} · depuis le ${fr(f.since)} · point aux parents ${EVERY[f.every]}`}
          action={<Badge tone={ev.status === 'ALERTE' ? 'red' : 'green'}>{ev.status === 'ALERTE' ? `Alerte : ${ev.failed.length} condition${ev.failed.length > 1 ? 's' : ''} non tenue${ev.failed.length > 1 ? 's' : ''}` : 'Tout va bien'}</Badge>}>
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <p className="mb-1 text-xs font-semibold text-slate-700">Aujourd'hui</p>
              <ul className="space-y-1 text-sm">
                {ev.checks.length === 0 && <li className="text-slate-600">Pas de condition fixée : suivi simple.</li>}
                {ev.checks.map((c) => (
                  <li key={c.id} className={`flex justify-between gap-2 rounded-md px-2 py-1 ${c.ok === false ? 'bg-red-50 text-red-900' : 'bg-emerald-50 text-emerald-900'}`}>
                    <span>{c.ok === false ? '✗' : '✓'} {c.label}</span><span className="tabular-nums">{c.value ?? '—'} <span className="text-xs">({c.unit} {c.limit})</span></span>
                  </li>
                ))}
                <li className="text-xs text-slate-600">Moyenne {facts.average ?? '—'} · absences non justifiées {facts.unjustified} · retards {facts.lates} · punitions et colles {facts.measures}</li>
              </ul>
              {f.contact && (
                <p className="mt-2 text-xs text-slate-700">Contact : <strong>{f.contact.name}</strong>, {f.contact.role}{f.contact.phone ? ` · ${f.contact.phone}` : ''}
                  {f.contact.parentConsent ? (f.contact.email && <a className="ml-2 font-medium text-navy-700 underline" href={`mailto:${f.contact.email}?subject=${encodeURIComponent(`Suivi de ${f.student}`)}&body=${encodeURIComponent(followUpReport(f, facts, ev, `au ${fr(NOW.slice(0, 10))}`))}`}>Écrire (e-mail prérempli)</a>)
                    : <span className="ml-2 text-red-700">accord des parents manquant : ne rien transmettre</span>}</p>
              )}
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold text-slate-700">Notes du suivi</p>
              <ul className="max-h-40 space-y-1 overflow-y-auto text-sm" tabIndex={0} aria-label={`Notes — ${f.student}`}>
                {f.notes.map((n, i) => <li key={i}><span className="text-xs text-slate-600">{fr(n.at)} · {n.by} :</span> {n.text}</li>)}
              </ul>
              <div className="mt-2 flex gap-2">
                <input value={note[f.id] ?? ''} onChange={(e) => setNote({ ...note, [f.id]: e.target.value })} placeholder="Ajouter une note (entretien, appel…)" aria-label={`Note — ${f.student}`} className={`min-w-0 flex-1 ${field}`} />
                <Button variant="secondary" disabled={!(note[f.id] ?? '').trim()} onClick={() => { addNote(f, note[f.id].trim()); setNote({ ...note, [f.id]: '' }); }}>Noter</Button>
              </div>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
            <Button onClick={() => sendPoint(f, facts, ev)}>Envoyer le point aux parents</Button>
            <Button variant="secondary" onClick={() => { if (window.confirm(`Clore le suivi de ${f.student} ?`)) { save(list.map((x) => (x.id === f.id ? { ...x, closed: { at: NOW.slice(0, 10), by: actor } } : x))); } }}>Clore le suivi</Button>
          </div>
        </Card>
      ))}
    </div>
  );
}

/** Nombre de suivis en alerte (notifications de la Direction et de la CPE). */
export const followUpAlerts = () => loadFollowUps().filter((f) => !f.closed && evaluateFollowUp(f, factsOf(f.student)).status === 'ALERTE');
