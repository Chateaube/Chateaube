import React, { useState } from 'react';
import { Badge, Button, Card, Icon, Stat } from './ui.jsx';
import { CLASSES, classOf, STAFF_NAMES, ATTENDANCE, MEASURES_LOG, PHONES } from '../data/schoollife.js';
import { isMinor, leaveErrors } from '../rules/earlyLeave.js';
import { loadProfiles } from '../profilesStore.js';
import { MEASURES, AUTHORS, validateMeasure, phoneReturnAt, PHONE_DURATIONS, PHONE_ACTIONS, phoneDurationFor, validateReturn, ackReminderDue, OBJECTS, objectOf, HANDED_TO, canDecideDuration, objectState, colleErrors, nextColleSlot } from '../rules/discipline.js';
import { justification, LATE_LIMIT } from '../rules/attendance.js';
// minutes de retard lues dans le créneau (« 07h00 (+15 min) ») : au-delà de 10, l'heure compte comme absence
const lateMinutes = (r) => Number(/\+(\d+) min/.exec(r.slot ?? '')?.[1] ?? 0);
import { logActivity, ACTOR } from '../activityStore.js';
import { formatDateFr } from '../rules/calendar.js';
import PassportTab, { loadPassport, savePassport } from './PassportTab.jsx';

// Vie scolaire : absences / retards, punitions et sanctions, objets confisqués.
// Accessible à la Vie scolaire, au Bureau et à la Direction.

const inputCls = 'rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm';
const REASONS = ['Certificat médical', 'Motif familial', 'Transport', 'Rendez-vous administratif', 'Autre'];
const MEASURE = Object.fromEntries(MEASURES.map((m) => [m.id, m]));
const fmtDT = (dt) => { const [d, t] = dt.split('T'); return `${formatDateFr(d).replace(/ \d{4}$/, '')} à ${t.replace(':', 'h')}`; };
const NOW = '2026-10-13T11:00';

/** Classe → élèves de la classe (évite de chercher dans une liste de toute l'école). */
export function ClassStudentPicker({ value, onChange }) {
  const [cls, setCls] = useState(value ? classOf(value) ?? '' : '');
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <label className="text-xs text-slate-600">Classe
        <select value={cls} onChange={(e) => { setCls(e.target.value); onChange(''); }} className={`mt-1 w-full ${inputCls}`}>
          <option value="">Choisir…</option>{Object.keys(CLASSES).map((c) => <option key={c}>{c}</option>)}
        </select>
      </label>
      <label className="text-xs text-slate-600">Élève
        <select value={value} disabled={!cls} onChange={(e) => onChange(e.target.value)} className={`mt-1 w-full ${inputCls} disabled:bg-slate-50`}>
          <option value="">{cls ? `Choisir parmi ${CLASSES[cls].length} élèves…` : 'Choisir d\'abord la classe'}</option>
          {(CLASSES[cls] ?? []).map((s) => <option key={s}>{s}</option>)}
        </select>
      </label>
    </div>
  );
}

const Ack = ({ at }) => (at
  ? <span className="inline-flex items-center gap-1 text-xs text-emerald-700"><Icon name="check" className="h-3.5 w-3.5" />Parent informé · {fmtDT(at)}</span>
  : <span className="text-xs text-amber-700">En attente de « J'ai pris connaissance »</span>);

/* ---------- Absences & retards ---------- */
function AttendanceTab({ rows, setRows, toast, role }) {
  const [filter, setFilter] = useState('ALL');
  const [justifying, setJustifying] = useState(null);
  const actor = ACTOR[role] ?? ACTOR.VIE_SCOLAIRE;
  const update = (ids, patch, msg, log) => {
    setRows(rows.map((r) => (ids.includes(r.id) ? { ...r, ...patch } : r))); toast(msg);
    if (log) rows.filter((r) => ids.includes(r.id)).forEach((r) => logActivity({ who: actor, role, kind: log.kind, student: r.student, text: log.text(r) }));
  };
  const st = (r) => justification(r, NOW);
  const notInformed = rows.filter((r) => !r.notified);
  const toJustify = rows.filter((r) => st(r).status === 'A_JUSTIFIER');
  const late = rows.filter((r) => st(r).status === 'NON_JUSTIFIEE');
  const FILTERS = [['ALL', 'Tout', rows.length], ['PARENTS', 'Parents non prévenus', notInformed.length], ['JUSTIFY', 'À justifier (24 h)', toJustify.length], ['LATE', 'Non justifiées', late.length]];
  const shown = filter === 'PARENTS' ? notInformed : filter === 'JUSTIFY' ? toJustify : filter === 'LATE' ? late : rows;
  const notifyLog = { kind: 'PARENTS', text: (r) => `Parents prévenus (${r.kind === 'ABSENCE' ? 'absence' : 'retard'})` };
  return (
    <Card title="Absences et retards" subtitle="Issus de l'appel des enseignants. Justification possible pendant 24 h après le début de l'absence ; ensuite, non justifiée automatiquement"
      action={notInformed.length > 0 && <Button onClick={() => update(notInformed.map((r) => r.id), { notified: true }, `${notInformed.length} famille${notInformed.length > 1 ? 's' : ''} prévenue${notInformed.length > 1 ? 's' : ''} (e-mail + application).`, notifyLog)}><Icon name="bell" />Prévenir les {notInformed.length} parent{notInformed.length > 1 ? 's' : ''}</Button>}>
      <div className="mb-3 flex flex-wrap gap-2">
        {FILTERS.map(([k, l, n]) => (
          <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)}
            className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ${filter === k ? 'bg-navy-500 text-white ring-navy-500' : 'bg-white text-slate-700 ring-slate-300'}`}>{l} <span className={`ml-1 rounded-full px-1.5 ${filter === k ? 'bg-white/20' : k !== 'ALL' && n ? 'bg-amber-100 text-amber-900' : 'bg-slate-100'}`}>{n}</span></button>
        ))}
      </div>
      <div className="-mx-5 overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead>
            <tr className="border-y border-slate-100 bg-slate-50 text-left text-xs text-slate-500">
              <th className="px-4 py-2 font-medium">Élève</th><th className="px-2 font-medium">Type</th><th className="px-2 font-medium">Date / créneau</th>
              <th className="px-2 font-medium">Justificatif</th><th className="px-2 font-medium">Parents</th><th className="px-4 text-right font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id} className="border-b border-slate-100">
                <td className="px-4 py-2"><p className="font-medium text-slate-900">{r.student}</p><p className="text-xs text-slate-500">{classOf(r.student)} · appel de {r.by}</p></td>
                <td className="px-2">{r.kind === 'ABSENCE' ? <Badge tone="navy">Absence</Badge> : lateMinutes(r) > LATE_LIMIT ? <span><Badge tone="navy">Absence (1 h)</Badge><span className="block text-[11px] text-slate-600">retard de {lateMinutes(r)} min</span></span> : <Badge tone="slate">Retard</Badge>}</td>
                <td className="px-2 text-slate-600">{formatDateFr(r.date).replace(/ \d{4}$/, '')}<br /><span className="text-xs">{r.slot}</span></td>
                <td className="px-2">
                  {r.justified ? <Badge tone="green">{r.reason ?? 'Justifié'}</Badge> : st(r).status === 'NON_JUSTIFIEE' ? (
                    <span><Badge tone="red">Non justifiée</Badge><span className="block text-[11px] text-slate-600">délai dépassé le {fmtDT(st(r).deadline)}</span></span>
                  ) : justifying === r.id ? (
                    <span className="flex flex-wrap gap-1">{REASONS.map((x) => <button key={x} type="button" onClick={() => { update([r.id], { justified: true, reason: x }, `${r.kind === 'ABSENCE' ? 'Absence' : 'Retard'} de ${r.student} justifié.`, { kind: 'JUSTIF', text: () => `${r.kind === 'ABSENCE' ? 'Absence' : 'Retard'} justifié : ${x.toLowerCase()}` }); setJustifying(null); }} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs hover:bg-navy-50">{x}</button>)}</span>
                  ) : <span><button type="button" onClick={() => setJustifying(r.id)} className="text-xs font-medium text-navy-700 underline decoration-dotted">Justifier</button><span className="block text-[11px] text-amber-800">encore {st(r).hoursLeft} h (jusqu'au {fmtDT(st(r).deadline)})</span></span>}
                </td>
                <td className="px-2">{r.notified ? <Ack at={r.parentAck} /> : <span className="text-xs font-medium text-amber-800">Pas encore prévenus</span>}</td>
                <td className="px-4 text-right">
                  {!r.notified && <Button variant="secondary" onClick={() => update([r.id], { notified: true }, `Parents de ${r.student} prévenus (e-mail + application).`, notifyLog)}><Icon name="bell" />Prévenir les parents</Button>}
                </td>
              </tr>
            ))}
            {!shown.length && <tr><td colSpan={6} className="px-4 py-4 text-sm text-slate-600">Rien à traiter ✓</td></tr>}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/* ---------- Punitions & sanctions ---------- */
function MeasuresTab({ log, setLog, role, toast }) {
  const authorRole = { DIRECTION: 'DIRECTION', ENSEIGNANT: 'PROFESSEUR', BUREAU: 'BUREAU' }[role] ?? 'VIE_SCOLAIRE';
  const authors = { DIRECTION: ['Cheffe d\'établissement', 'Directrice adjointe'], PROFESSEUR: ['Mme Ranaivo'], BUREAU: ['Mme Hanta (secrétariat)'], VIE_SCOLAIRE: ['M. Be (CPE)'] }[authorRole];
  const blank = { student: '', measureId: 'OBSERVATION', reason: '', when: '', author: authors[0] };
  const [draft, setDraft] = useState(blank);
  const colles = loadPassport().colles;
  const retenue = draft.measureId === 'RETENUE';
  const errors = [...validateMeasure({ ...draft, authorRole }), ...(retenue && draft.student ? colleErrors({ kind: 'COLLE', hours: draft.hours ?? 1, when: draft.when, student: draft.student, colles }) : [])];
  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_380px] xl:items-start">
      <Card title="Punitions et sanctions" subtitle="Chaque mesure a un motif ; le parent confirme en avoir pris connaissance">
        <ul className="divide-y divide-slate-100">
          {[...log].sort((a, b) => b.date.localeCompare(a.date)).map((m) => (
            <li key={m.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900">{m.student} <span className="font-normal text-slate-500">· {classOf(m.student)} · {formatDateFr(m.date).replace(/ \d{4}$/, '')}</span></p>
                <p className="text-sm text-slate-700"><span className="text-slate-500">Motif :</span> {m.reason}</p>
                {m.when && <p className="text-xs text-slate-500">À effectuer : {/^\d{4}-\d{2}-\d{2}T/.test(m.when) ? fmtDT(m.when) : m.when}</p>}
                <p className="text-xs text-slate-500">Décidée par {m.author} ({AUTHORS[m.authorRole]})</p>
              </div>
              <div className="text-right">
                <Badge tone={MEASURE[m.measure].kind === 'SANCTION' ? 'red' : 'amber'}>{MEASURE[m.measure].kind === 'SANCTION' ? 'Sanction' : 'Punition'} · {MEASURE[m.measure].label}</Badge>
                <p className="mt-1"><Ack at={m.parentAck} /></p>
                {ackReminderDue(`${m.date}T17:00`, m.parentAck, NOW) && <p className="text-[11px] text-slate-500">Relance envoyée par e-mail et dans l'application</p>}
              </div>
            </li>
          ))}
        </ul>
      </Card>
      <Card title="Nouvelle mesure" subtitle={authorRole === 'DIRECTION' ? 'Direction : punitions et sanctions' : 'Punitions ; les sanctions relèvent de la Direction'}>
        <div className="space-y-2 text-sm">
          <ClassStudentPicker value={draft.student} onChange={(student) => setDraft({ ...draft, student })} />
          <label className="block text-xs text-slate-600">Mesure
            <select value={draft.measureId} onChange={(e) => setDraft({ ...draft, measureId: e.target.value })} className={`mt-1 w-full ${inputCls}`}>
              {['PUNITION', 'SANCTION'].map((k) => (
                <optgroup key={k} label={k === 'PUNITION' ? 'Punitions et avertissement (enseignant, CPE, secrétariat, Direction)' : 'Sanctions (Direction)'}>
                  {MEASURES.filter((m) => m.kind === k).map((m) => <option key={m.id} value={m.id} disabled={(k === 'SANCTION' || m.authors) && authorRole !== 'DIRECTION'}>{m.label}{m.authors ? ' — Direction' : ''}</option>)}
                </optgroup>
              ))}
            </select>
          </label>
          <label className="block text-xs text-slate-600">Motif<textarea rows={2} value={draft.reason} onChange={(e) => setDraft({ ...draft, reason: e.target.value })} className={`mt-1 w-full ${inputCls}`} /></label>
          {draft.measureId === 'RETENUE' && (
            <div className="grid grid-cols-[1fr_90px] gap-2">
              <label className="block text-xs text-slate-600">Colle le (mercredi 13h–17h ou samedi 8h–12h)<input type="datetime-local" value={draft.when} onChange={(e) => setDraft({ ...draft, when: e.target.value })} className={`mt-1 w-full ${inputCls}`} /></label>
              <label className="block text-xs text-slate-600">Durée<select value={draft.hours ?? 1} onChange={(e) => setDraft({ ...draft, hours: Number(e.target.value) })} className={`mt-1 w-full ${inputCls}`}><option value={1}>1 h</option><option value={2}>2 h</option></select></label>
              {draft.student && <button type="button" onClick={() => setDraft({ ...draft, when: nextColleSlot(draft.student, colles, draft.hours ?? 1, '2026-10-13') ?? '' })} className="col-span-2 text-left text-xs font-medium text-navy-700 underline decoration-dotted">Prochain créneau libre pour cet élève</button>}
            </div>
          )}
          <label className="block text-xs text-slate-600">Décidée par
            <select value={draft.author} onChange={(e) => setDraft({ ...draft, author: e.target.value })} className={`mt-1 w-full ${inputCls}`}>
              {authors.map((n) => <option key={n}>{n}</option>)}
            </select>
          </label>
          {draft.reason && errors.map((e) => <p key={e} className="text-xs text-red-700">{e}</p>)}
          <Button className="w-full" disabled={errors.length > 0} onClick={() => {
            setLog([{ id: `m${Date.now()}`, date: '2026-10-13', student: draft.student, measure: draft.measureId, reason: draft.reason.trim(), when: draft.when || null, author: draft.author, authorRole, parentAck: null }, ...log]);
            logActivity({ who: draft.author, role, kind: 'PUNITION', student: draft.student, text: `${MEASURE[draft.measureId].label} : ${draft.reason.trim()}` });
            // une retenue est une colle : elle entre au passeport, à la suite des autres colles de l'élève
            if (retenue) { const pp = loadPassport(); savePassport({ ...pp, colles: [...pp.colles, { id: `c${Date.now()}`, student: draft.student, kind: 'COLLE', cause: 'AUTRE', hours: draft.hours ?? 1, date: '2026-10-13', when: draft.when, reason: draft.reason.trim(), status: 'A_FAIRE', by: draft.author }] }); }
            toast(`Mesure enregistrée ; le parent de ${draft.student} est notifié (e-mail + application).`);
            setDraft(blank);
          }}>Enregistrer et prévenir le parent</Button>
        </div>
      </Card>
    </div>
  );
}

/* ---------- Objets confisqués ----------
 * Téléphone, écouteurs sans fil, montre connectée, cigarette électronique… Le professeur (ou toute
 * l'équipe) enregistre l'objet et à qui il l'a remis ; la Direction ou le secrétariat décident ensuite
 * de la durée (proposition selon les faits précédents). */
const STATE_LABEL = { A_DECIDER: ['amber', 'Durée à décider'], EN_GARDE: ['navy', 'En garde'], A_RENDRE: ['green', 'Peut être rendu'], RENDU: ['slate', 'Rendu'] };
function PhonesTab({ phones, setPhones, settings, toast, role }) {
  const actor = ACTOR[role] ?? ACTOR.VIE_SCOLAIRE;
  const decider = canDecideDuration(role);
  const blank = { action: 'CONFISCATION', object: OBJECTS[0], objectNote: '', student: '', owner: '', otherOwner: false, at: NOW, duration: '', confiscatedBy: role === 'ENSEIGNANT' ? 'Mme Ranaivo' : actor, receivedBy: HANDED_TO[0], reason: '' };
  const [draft, setDraft] = useState(blank);
  const [returning, setReturning] = useState(null);
  const ok = draft.student && draft.at && draft.reason.trim() && (!draft.otherOwner || draft.owner) && (draft.object !== 'Autre' || draft.objectNote.trim());
  const isWarning = draft.action === 'AVERTISSEMENT';
  const recidive = draft.student ? phoneDurationFor(draft.student, phones) : { previous: 0 };
  const toDecide = phones.filter((p) => objectState(p, NOW, settings) === 'A_DECIDER');
  const decide = (p, duration) => {
    setPhones(phones.map((x) => (x.id === p.id ? { ...x, duration, durationBy: actor } : x)));
    logActivity({ who: actor, role, kind: 'OBJET', student: p.student, text: `Durée de confiscation décidée : ${PHONE_DURATIONS.find((d) => d.id === duration).label} (${objectOf(p).toLowerCase()})` });
    toast(`${objectOf(p)} de ${p.student} : ${PHONE_DURATIONS.find((d) => d.id === duration).label}. Les parents sont prévenus.`);
  };
  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_380px] xl:items-start">
      <div className="space-y-5">
        {toDecide.length > 0 && (
          <Card title={`Durée à décider (${toDecide.length})`} subtitle={decider ? 'Vous décidez de la durée ; une proposition est faite selon les faits précédents de l\'élève' : 'Décidée par la Direction ou le secrétariat'}>
            <ul className="divide-y divide-slate-100 text-sm">
              {toDecide.map((p) => {
                const prop = phoneDurationFor(p.student, phones.filter((x) => x.id !== p.id && x.at < p.at));
                return (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <span className="min-w-0"><span className="font-medium text-slate-900">{objectOf(p)} — {p.student}</span> <span className="text-slate-600">· {classOf(p.student)}</span>
                      <span className="block text-xs text-slate-600">{p.reason} · {fmtDT(p.at)} · par {p.confiscatedBy}, remis à {p.receivedBy}{prop.previous ? ` · ${prop.previous} fait${prop.previous > 1 ? 's' : ''} avant` : ' · premier fait'}</span></span>
                    {decider ? (
                      <span className="flex flex-wrap gap-1.5">{PHONE_DURATIONS.map((d) => <Button key={d.id} variant={d.id === prop.duration ? 'primary' : 'secondary'} className="!py-1 text-xs" onClick={() => decide(p, d.id)}>{d.label}{d.id === prop.duration ? ' (proposé)' : ''}</Button>)}</span>
                    ) : <Badge tone="amber">En attente de décision</Badge>}
                  </li>
                );
              })}
            </ul>
          </Card>
        )}
        <Card title="Objets confisqués et avertissements" subtitle="Restitution calculée sur les jours de classe (hors week-ends, fériés et vacances)">
          <ul className="divide-y divide-slate-100">
            {phones.filter((p) => objectState(p, NOW, settings) !== 'A_DECIDER').map((p) => {
              if (p.action === 'AVERTISSEMENT') {
                return (
                  <li key={p.id} className="py-3 text-sm">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div><p className="font-medium text-slate-900">{p.student} <span className="font-normal text-slate-500">· {classOf(p.student)}</span></p><p className="text-slate-700">{objectOf(p)} · {p.reason}</p><p className="text-xs text-slate-500">Le {fmtDT(p.at)} par {p.confiscatedBy}</p></div>
                      <Badge tone="amber">Avertissement</Badge>
                    </div>
                  </li>
                );
              }
              const state = objectState(p, NOW, settings);
              const due = phoneReturnAt(p.at, p.duration, settings);
              return (
                <li key={p.id} className="py-3 text-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-slate-900">{objectOf(p)} — {p.student} <span className="font-normal text-slate-500">· {classOf(p.student)}</span></p>
                      <p className="text-slate-700">{p.reason}</p>
                      {p.owner && p.owner !== p.student && <p className="text-xs text-amber-800">Appartient à {p.owner} ({classOf(p.owner)}) : rendu au propriétaire, les deux familles sont prévenues.</p>}
                      <p className="text-xs text-slate-500">Confisqué le {fmtDT(p.at)} par {p.confiscatedBy} · remis à {p.receivedBy}{p.durationBy ? ` · durée décidée par ${p.durationBy}` : ''}</p>
                    </div>
                    <div className="text-right">
                      <Badge tone={STATE_LABEL[state][0]}>{PHONE_DURATIONS.find((d) => d.id === p.duration).label}</Badge>
                      {p.returned
                        ? <p className="mt-1 text-xs text-emerald-700">Rendu le {fmtDT(p.returned.at)} à {p.returned.to}<br />par {p.returned.by}</p>
                        : <p className={`mt-1 text-xs ${state === 'A_RENDRE' ? 'font-medium text-emerald-700' : 'text-slate-600'}`}>{state === 'A_RENDRE' ? 'Peut être rendu' : 'Restitution'} : {fmtDT(due)}</p>}
                    </div>
                  </div>
                  {!p.returned && role !== 'ENSEIGNANT' && returning?.id !== p.id && <Button variant="ghost" className="mt-1 !px-0" onClick={() => setReturning({ id: p.id, to: '', toRole: 'PARENT', by: actor })}>Enregistrer la restitution</Button>}
                  {returning?.id === p.id && (
                    <div className="mt-2 grid gap-2 rounded-lg bg-slate-50 p-3 sm:grid-cols-[150px_1fr_1fr_auto] sm:items-end">
                      <label className="text-xs text-slate-600">Rendu à
                        <select value={returning.toRole} onChange={(e) => setReturning({ ...returning, toRole: e.target.value })} className={`mt-1 w-full ${inputCls}`}>
                          <option value="PARENT">Responsable légal</option>
                          <option value="ELEVE" disabled={p.duration === '5J'}>{p.owner && p.owner !== p.student ? 'L\'élève propriétaire' : 'L\'élève'}{p.duration === '5J' ? ' (non : 5 jours)' : ''}</option>
                        </select>
                      </label>
                      <label className="text-xs text-slate-600">Nom<input value={returning.to} onChange={(e) => setReturning({ ...returning, to: e.target.value })} placeholder={returning.toRole === 'PARENT' ? `Responsable de ${p.owner ?? p.student}` : p.owner ?? p.student} className={`mt-1 w-full ${inputCls}`} /></label>
                      <label className="text-xs text-slate-600">Rendu et signé par
                        <select value={returning.by} onChange={(e) => setReturning({ ...returning, by: e.target.value })} className={`mt-1 w-full ${inputCls}`}>{STAFF_NAMES.map((n) => <option key={n}>{n}</option>)}</select>
                      </label>
                      <Button disabled={validateReturn({ duration: p.duration, toRole: returning.toRole, toName: returning.to }).length > 0} onClick={() => {
                        setPhones(phones.map((x) => (x.id === p.id ? { ...x, returned: { at: NOW, by: returning.by, to: returning.to.trim() } } : x)));
                        logActivity({ who: returning.by, role, kind: 'OBJET', student: p.student, text: `${objectOf(p)} rendu à ${returning.to.trim()}` });
                        setReturning(null); toast(`${objectOf(p)} de ${p.student} restitué.`);
                      }}>Confirmer</Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      </div>
      <Card title="Nouveau : objet confisqué ou avertissement">
        <div className="space-y-2 text-sm">
          <div className="flex gap-1.5">
            {Object.keys(PHONE_ACTIONS).map((k) => <button key={k} type="button" aria-pressed={draft.action === k} onClick={() => setDraft({ ...draft, action: k })}
              className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ${draft.action === k ? 'bg-navy-500 text-white ring-navy-500' : 'bg-white text-slate-600 ring-slate-300'}`}>{k === 'AVERTISSEMENT' ? 'Avertissement' : 'Confiscation'}</button>)}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-slate-600">Objet
              <select value={draft.object} onChange={(e) => setDraft({ ...draft, object: e.target.value })} className={`mt-1 w-full ${inputCls}`}>{OBJECTS.map((o) => <option key={o}>{o}</option>)}</select>
            </label>
            {draft.object === 'Autre' && <label className="text-xs text-slate-600">Lequel ?<input value={draft.objectNote} onChange={(e) => setDraft({ ...draft, objectNote: e.target.value })} placeholder="ex. enceinte" className={`mt-1 w-full ${inputCls}`} /></label>}
          </div>
          <p className="text-xs font-semibold text-slate-500">Élève</p>
          <ClassStudentPicker value={draft.student} onChange={(student) => setDraft({ ...draft, student })} />
          {recidive.previous > 0 && <p className="rounded-md bg-amber-50 px-2 py-1.5 text-xs text-amber-900">Déjà {recidive.previous} fait{recidive.previous > 1 ? 's' : ''} cette année (avertissements compris).</p>}
          {!isWarning && <label className="flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" checked={draft.otherOwner} onChange={(e) => setDraft({ ...draft, otherOwner: e.target.checked, owner: '' })} />L'objet appartient à un autre élève</label>}
          {!isWarning && draft.otherOwner && (<><p className="text-xs font-semibold text-slate-500">Propriétaire</p><ClassStudentPicker value={draft.owner} onChange={(owner) => setDraft({ ...draft, owner })} /></>)}
          <label className="block text-xs text-slate-600">Motif<input value={draft.reason} onChange={(e) => setDraft({ ...draft, reason: e.target.value })} placeholder="ex. écouteurs portés pendant le cours" className={`mt-1 w-full ${inputCls}`} /></label>
          <label className="block text-xs text-slate-600">Le<input type="datetime-local" value={draft.at} onChange={(e) => setDraft({ ...draft, at: e.target.value })} className={`mt-1 w-full ${inputCls}`} /></label>
          <label className="block text-xs text-slate-600">{isWarning ? 'Donné par' : 'Confisqué par'}
            <select value={draft.confiscatedBy} onChange={(e) => setDraft({ ...draft, confiscatedBy: e.target.value })} className={`mt-1 w-full ${inputCls}`}>{[...new Set([draft.confiscatedBy, ...STAFF_NAMES])].map((n) => <option key={n}>{n}</option>)}</select>
          </label>
          {!isWarning && <label className="block text-xs text-slate-600">Remis à
            <select value={draft.receivedBy} onChange={(e) => setDraft({ ...draft, receivedBy: e.target.value })} className={`mt-1 w-full ${inputCls}`}>
              <optgroup label="Service">{HANDED_TO.map((n) => <option key={n}>{n}</option>)}</optgroup>
              <optgroup label="Personne">{STAFF_NAMES.map((n) => <option key={n}>{n}</option>)}</optgroup>
            </select>
          </label>}
          {!isWarning && (decider ? (
            <label className="block text-xs text-slate-600">Durée (vous pouvez la décider plus tard)
              <select value={draft.duration} onChange={(e) => setDraft({ ...draft, duration: e.target.value })} className={`mt-1 w-full ${inputCls}`}>
                <option value="">À décider</option>{PHONE_DURATIONS.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
              </select>
            </label>
          ) : <p className="rounded-md bg-navy-50 px-2 py-1.5 text-xs text-navy-900">La durée de confiscation est décidée par la Direction ou le secrétariat.</p>)}
          {draft.duration && !isWarning && <p className="rounded-md bg-navy-50 px-2 py-1.5 text-xs text-navy-900">Restitution prévue : {fmtDT(phoneReturnAt(draft.at, draft.duration, settings))}</p>}
          <Button className="w-full" disabled={!ok} onClick={() => {
            const { otherOwner, ...rest } = draft;
            const item = { ...rest, owner: otherOwner ? draft.owner : undefined, id: `p${Date.now()}`, reason: draft.reason.trim(), objectNote: draft.objectNote.trim(), duration: isWarning ? undefined : draft.duration || null, durationBy: draft.duration ? actor : undefined, receivedBy: isWarning ? undefined : draft.receivedBy, returned: null };
            setPhones([item, ...phones]);
            logActivity({ who: draft.confiscatedBy, role, kind: 'OBJET', student: draft.student, text: isWarning ? `Avertissement (${objectOf(item).toLowerCase()}) : ${item.reason}` : `${objectOf(item)} confisqué, remis à ${draft.receivedBy}` });
            toast(isWarning ? `Avertissement enregistré ; le parent de ${draft.student} est prévenu.` : `Confiscation enregistrée${draft.duration ? '' : ' ; la durée sera décidée par la Direction ou le secrétariat'}. ${otherOwner ? `Les parents de ${draft.student} et de ${draft.owner} sont prévenus` : `Le parent de ${draft.student} est prévenu`}.`);
            setDraft(blank);
          }}>Enregistrer</Button>
        </div>
      </Card>
    </div>
  );
}

const TABS = [['attendance', 'Absences & retards'], ['passport', 'Passeport de vie scolaire'], ['measures', 'Punitions & sanctions'], ['phones', 'Objets confisqués'], ['leave', 'Sorties anticipées']];

/* ---------- Sorties anticipées : un mineur ne part pas seul ---------- */
const LEAVE_KEY = 'ent-sorties-v1';
const loadLeaves = () => { try { return JSON.parse(localStorage.getItem(LEAVE_KEY)) ?? []; } catch { return []; } };
function EarlyLeaveTab({ toast }) {
  const [list, setList] = useState(loadLeaves);
  const blank = { student: '', reason: '', parentCalled: false, calledAt: NOW.slice(11), pickedUpBy: '', relation: '', pickedUpIsGuardian: true, guardianConfirmed: false, majorChecked: false, at: NOW };
  const [d, setD] = useState(blank);
  const [tried, setTried] = useState(false);
  const profile = d.student ? loadProfiles().find((p) => `${p.lastName} ${p.firstName}` === d.student) : null;
  const minor = d.majorChecked ? false : isMinor(profile?.birthDate, NOW.slice(0, 10));
  const errors = d.student ? leaveErrors({ ...d, minor }) : ['Choisir un élève.'];
  const save = () => {
    setTried(true);
    if (errors.length) return;
    const item = { ...d, id: `s${Date.now()}`, minor, leftAlone: !d.pickedUpBy.trim() };
    const next = [item, ...list]; setList(next);
    try { localStorage.setItem(LEAVE_KEY, JSON.stringify(next)); } catch { /* stockage indisponible */ }
    toast(`Sortie enregistrée ; les parents de ${d.student} sont prévenus dans l'application.`);
    setD(blank); setTried(false);
  };
  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_400px] xl:items-start">
      <Card title="Sorties anticipées" subtitle="Élève malade ou rendez-vous : les parents sont toujours appelés ; un élève mineur ne part qu'avec un adulte venu le chercher">
        {list.length === 0 && <p className="text-sm text-slate-500">Aucune sortie enregistrée.</p>}
        <ul className="divide-y divide-slate-100 text-sm">
          {list.map((x) => (
            <li key={x.id} className="flex flex-wrap items-start justify-between gap-2 py-2">
              <span className="min-w-0"><span className="font-medium text-slate-900">{x.student}</span> <span className="text-slate-500">· {classOf(x.student)}</span>
                <span className="block text-xs text-slate-500">{fmtDT(x.at)} · {x.reason} · parent appelé à {x.calledAt.replace(':', 'h')} · {x.leftAlone ? 'parti seul (majeur)' : `avec ${x.pickedUpBy} (${x.relation}${x.pickedUpIsGuardian ? '' : ', confirmé par le parent'})`}</span></span>
              <Badge tone={x.minor ? 'navy' : 'slate'}>{x.minor ? 'mineur' : 'majeur'}</Badge>
            </li>
          ))}
        </ul>
      </Card>
      <Card title="Enregistrer une sortie">
        <div className="space-y-2 text-sm">
          <ClassStudentPicker value={d.student} onChange={(student) => setD({ ...d, student })} />
          {d.student && <p className={`rounded-md px-2 py-1.5 text-xs ${minor ? 'bg-amber-50 text-amber-900' : 'bg-slate-50 text-slate-700'}`}>{minor ? 'Élève mineur : il reste à l\'école jusqu\'à ce qu\'un adulte vienne le chercher, même s\'il a son propre véhicule (moto…).' : 'Élève majeur : il peut partir seul, ses parents étant prévenus.'}</p>}
          {d.student && !profile?.birthDate && <label className="flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" checked={d.majorChecked} onChange={(e) => setD({ ...d, majorChecked: e.target.checked })} />Date de naissance absente de la fiche : élève majeur (vérifié)</label>}
          <label className="block text-xs text-slate-600">Motif<input value={d.reason} onChange={(e) => setD({ ...d, reason: e.target.value })} placeholder="ex. malaise, fièvre, rendez-vous médical" className={`mt-1 w-full ${inputCls}`} /></label>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" checked={d.parentCalled} onChange={(e) => setD({ ...d, parentCalled: e.target.checked })} />Parent appelé à</label>
            <input type="time" value={d.calledAt} onChange={(e) => setD({ ...d, calledAt: e.target.value })} aria-label="Heure de l'appel" className={inputCls} />
          </div>
          <label className="block text-xs text-slate-600">Récupéré par{!minor && ' (vide si l\'élève part seul)'}<input value={d.pickedUpBy} onChange={(e) => setD({ ...d, pickedUpBy: e.target.value })} placeholder="Nom de l'adulte" className={`mt-1 w-full ${inputCls}`} /></label>
          {d.pickedUpBy.trim() && (
            <>
              <label className="block text-xs text-slate-600">Lien avec l'élève<input value={d.relation} onChange={(e) => setD({ ...d, relation: e.target.value })} placeholder="ex. mère, oncle, chauffeur" className={`mt-1 w-full ${inputCls}`} /></label>
              <label className="flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" checked={d.pickedUpIsGuardian} onChange={(e) => setD({ ...d, pickedUpIsGuardian: e.target.checked })} />C'est un responsable légal</label>
              {!d.pickedUpIsGuardian && <label className="flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" checked={d.guardianConfirmed} onChange={(e) => setD({ ...d, guardianConfirmed: e.target.checked })} />Le parent a confirmé au téléphone que cette personne peut repartir avec l'élève</label>}
            </>
          )}
          {tried && errors.length > 0 && <ul className="rounded-md bg-red-50 p-2 text-xs text-red-800">{errors.map((e) => <li key={e}>· {e}</li>)}</ul>}
          <Button className="w-full" onClick={save}>Enregistrer la sortie</Button>
        </div>
      </Card>
    </div>
  );
}

export default function VieScolaireModule({ settings, role = 'VIE_SCOLAIRE' }) {
  // l'enseignant ne voit que ses outils : punitions et remise d'un téléphone confisqué
  const tabs = role === 'ENSEIGNANT' ? TABS.filter(([id]) => ['passport', 'measures', 'phones'].includes(id)) : TABS;
  const [tab, setTab] = useState(tabs[0][0]);
  const [rows, setRows] = useState(ATTENDANCE);
  const [log, setLog] = useState(MEASURES_LOG);
  const [phones, setPhones] = useState(PHONES);
  const [message, setMessage] = useState(null);
  const today = rows.filter((r) => r.date === '2026-10-13');

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-semibold text-navy-500">Tamatave</p>
        <h1 className="text-2xl font-semibold text-navy-900">{role === 'ENSEIGNANT' ? 'Vie de classe' : 'Absences, retards et punitions'}</h1>
      </div>
      {role !== 'ENSEIGNANT' && <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Absences aujourd'hui" value={today.filter((r) => r.kind === 'ABSENCE').length} />
        <Stat label="Retards aujourd'hui" value={today.filter((r) => r.kind === 'RETARD').length} />
        <Stat label="Parents pas encore informés" value={log.filter((m) => !m.parentAck).length} tone="amber" />
        <Stat label="Objets en garde" value={phones.filter((p) => p.action !== 'AVERTISSEMENT' && !p.returned).length} hint={phones.some((p) => objectState(p, NOW, settings) === 'A_DECIDER') ? `${phones.filter((p) => objectState(p, NOW, settings) === 'A_DECIDER').length} durée à décider` : undefined} />
      </div>}
      {message && <p role="status" className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800"><Icon name="check" />{message}</p>}
      <div className="flex gap-1 overflow-x-auto rounded-lg bg-slate-100 p-1" role="tablist">
        {tabs.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
            className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ${tab === id ? 'bg-white text-navy-900 shadow-sm' : 'text-slate-600'}`}>{label}</button>
        ))}
      </div>
      {tab === 'attendance' && <AttendanceTab rows={rows} setRows={setRows} toast={setMessage} role={role} />}
      {tab === 'measures' && <MeasuresTab log={log} setLog={setLog} role={role} toast={setMessage} />}
      {tab === 'leave' && <EarlyLeaveTab toast={setMessage} />}
      {tab === 'passport' && <PassportTab role={role} toast={setMessage} />}
      {tab === 'phones' && <PhonesTab phones={phones} setPhones={setPhones} settings={settings} toast={setMessage} role={role} />}
    </div>
  );
}
