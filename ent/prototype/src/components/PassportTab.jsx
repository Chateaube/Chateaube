import React, { useState } from 'react';
import { Badge, Button, Card } from './ui.jsx';
import { ClassStudentPicker } from './VieScolaireModule.jsx';
import { ATTENDANCE, NEW_STUDENTS } from '../data/schoollife.js';
import { passport, colleErrors, FORGET_KINDS, COLLE_STATUS, LATES_PER_COLLE, CARNET, carnetPerColle, nextColleSlot, upcomingColleSessions } from '../rules/discipline.js';
import { colleSlotsLabel } from '../rules/discipline.js';
import { formatDateFr } from '../rules/calendar.js';
import { WATCHERS, loadWatch, saveWatch } from '../colleWatchStore.js';
import { loadProfiles } from '../profilesStore.js';
import { seniority } from '../rules/documents.js';
import { logActivity } from '../activityStore.js';

// Passeport de vie scolaire : oublis, retards, colles et TIG d'un élève.
// Carnet de liaison oublié = 1 h de colle (nouvel élève : au 2e oubli) ; autres oublis : colle si le
// professeur ou la CPE la demande ; trois retards = une colle d'une ou deux heures ; TIG : Direction.

/** Nouvel élève (entré cette année) : fiche importée si elle existe, sinon données de démonstration. */
export function isNewStudent(name) {
  const p = loadProfiles().find((x) => `${x.lastName} ${x.firstName}` === name);
  const s = p?.enteredOn ? seniority(p.enteredOn) : null;
  return s ? s.isNew : NEW_STUDENTS.includes(name);
}

const KEY = 'ent-passeport-v3'; // v2 : carnet de liaison selon l'ancienneté, colle demandée pour les autres oublis
const DEMO = {
  forgets: [
    { id: 'o1', student: 'RAJAONARIVELO Tsiry', date: '2026-10-07', kind: 'Matériel', note: 'calculatrice', by: 'M. Rasolo' },
    { id: 'o2', student: 'RAJAONARIVELO Tsiry', date: '2026-10-12', kind: 'Devoir non fait', note: 'DM de management', by: 'Mme Ranaivo', colle: true },
    { id: 'o3', student: 'RAJAONARIVELO Tsiry', date: '2026-10-13', kind: 'Carnet de liaison', note: '', by: 'Mme Ranaivo' },
    { id: 'o4', student: 'RAMAROSON Fitia', date: '2026-10-12', kind: 'Carnet de liaison', note: '', by: 'M. Rasolo' },
  ],
  colles: [
    { id: 'c1', student: 'RAJAONARIVELO Tsiry', kind: 'COLLE', cause: 'OUBLI', forgetId: 'o1', hours: 1, date: '2026-10-07', when: '2026-10-14T13:00', reason: 'Oubli : matériel (calculatrice) le 07/10', status: 'FAITE', by: 'M. Be (CPE)' },
    { id: 'c3', student: 'RAKOTONIRINA Hanitra', kind: 'COLLE', cause: 'AUTRE', hours: 1, date: '2026-10-12', when: '2026-10-14T13:00', reason: 'Bavardages répétés (Mme Hery)', status: 'A_FAIRE', by: 'Mme Hery' },
    { id: 'c4', student: 'RAKOTONIRINA Hanitra', kind: 'COLLE', cause: 'AUTRE', hours: 1, date: '2026-10-13', when: '2026-10-14T14:00', reason: 'Montre connectée pendant l\'évaluation (CPE)', status: 'A_FAIRE', by: 'M. Be (CPE)' },
    { id: 'c5', student: 'RAZAKA Feno', kind: 'COLLE', cause: 'AUTRE', hours: 2, date: '2026-10-12', when: '2026-10-21T13:00', reason: 'Travail non rendu (M. Tojo)', status: 'A_FAIRE', by: 'M. Tojo' },
    { id: 'c2', student: 'RASOA Lova', kind: 'TIG', cause: 'AUTRE', hours: 1, date: '2026-10-09', when: '2026-10-16T12:00', reason: 'Dégradation d\'une table : ponçage et nettoyage', status: 'A_FAIRE', by: 'M. Be (CPE)' },
  ],
};
export const loadPassport = () => { try { return JSON.parse(localStorage.getItem(KEY)) ?? DEMO; } catch { return DEMO; } };
export const savePassport = (d) => { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* stockage indisponible */ } };
const save = savePassport;
const inputCls = 'rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm';
const fmt = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}${iso.length > 10 ? ` à ${iso.slice(11, 16).replace(':', 'h')}` : ''}`;
const TODAY = '2026-10-13';

export default function PassportTab({ role, toast }) {
  const isTeacher = role === 'ENSEIGNANT';
  const by = { DIRECTION: 'Direction', BUREAU: 'Mme Hanta (secrétariat)', VIE_SCOLAIRE: 'M. Be (CPE)', ENSEIGNANT: 'Mme Ranaivo' }[role] ?? 'M. Be (CPE)';
  const [data, setData] = useState(loadPassport);
  const [student, setStudent] = useState('RAMAROSON Fitia');
  const [forget, setForget] = useState({ kind: FORGET_KINDS[0], note: '', colle: false });
  const [giving, setGiving] = useState(null); // proposition en cours : { …, when }
  const [tig, setTig] = useState(null);
  const [err, setErr] = useState([]);
  const update = (d) => { setData(d); save(d); };
  const isNew = student ? isNewStudent(student) : false;
  const p = student ? passport(student, { attendance: ATTENDANCE, ...data }, { isNew }) : null;

  const addForget = () => {
    const carnet = forget.kind === CARNET;
    const f = { id: `o${Date.now()}`, student, date: TODAY, kind: forget.kind, note: forget.note.trim(), by, colle: !carnet && forget.colle };
    const next = { ...data, forgets: [...data.forgets, f] };
    update(next);
    setForget({ kind: FORGET_KINDS[0], note: '', colle: false });
    logActivity({ who: by, role, kind: 'OUBLI', student, text: `${forget.kind === 'Devoir non fait' ? 'Devoir non fait' : `${forget.kind} oublié${forget.kind === 'Tenue (EPS)' ? 'e' : ''}`}${f.note ? ` (${f.note})` : ''}${f.colle ? ' — colle demandée' : ''}` });
    const due = passport(student, { attendance: ATTENDANCE, ...next }, { isNew }).toGive.some((g) => g.forgetId === f.id);
    toast(`Oubli noté pour ${student}. ${due ? (isTeacher ? 'Une heure de colle est due ; la CPE en fixe la date.' : 'Une heure de colle est à donner.') : carnet ? `Pas encore de colle : nouvel élève, colle au ${carnetPerColle(true)}e oubli du carnet.` : 'Pas de colle demandée.'}`);
  };
  const give = (entry) => {
    const e = colleErrors({ ...entry, student, colles: data.colles });
    setErr(e); if (e.length) return;
    update({ ...data, colles: [...data.colles, { id: `c${Date.now()}`, student, date: TODAY, status: 'A_FAIRE', by, ...entry }] });
    logActivity({ who: by, role, kind: 'COLLE', student, text: `${entry.kind === 'TIG' ? 'TIG' : `Colle de ${entry.hours} h`} : ${entry.reason}` });
    setGiving(null); setTig(null);
    toast(`${entry.kind === 'TIG' ? 'TIG' : `Colle de ${entry.hours} h`} pour ${student} ; les parents sont prévenus dans l'application.`);
  };
  const setStatus = (id, status) => update({ ...data, colles: data.colles.map((c) => (c.id === id ? { ...c, status } : c)) });

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_400px] xl:items-start">
      <Card title="Passeport de vie scolaire" subtitle={`Carnet de liaison oublié = 1 h de colle (nouvel élève : 2 oublis) · autres oublis : colle si demandée · ${LATES_PER_COLLE} retards = une colle de 1 ou 2 h`}>
        <ClassStudentPicker value={student} onChange={setStudent} />
        {p && (
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
              <div className="rounded-lg bg-slate-50 p-2"><p className="text-xl font-semibold text-navy-900">{p.lates}</p><p className="text-xs text-slate-500">retards · {p.latesInCycle}/{LATES_PER_COLLE} avant la prochaine colle</p></div>
              <div className="rounded-lg bg-slate-50 p-2"><p className="text-xl font-semibold text-navy-900">{p.forgets}</p><p className="text-xs text-slate-500">oublis · dont {p.carnets} carnet{p.carnets > 1 ? 's' : ''}{isNew ? ' (nouvel élève)' : ''}</p></div>
              <div className="rounded-lg bg-amber-50 p-2"><p className="text-xl font-semibold text-amber-800">{p.collesDue} h</p><p className="text-xs text-amber-800">de colle à faire</p></div>
              <div className="rounded-lg bg-emerald-50 p-2"><p className="text-xl font-semibold text-emerald-800">{p.collesDone} h</p><p className="text-xs text-emerald-800">effectuées{p.tig ? ` · ${p.tig} TIG` : ''}</p></div>
            </div>
            {!isTeacher && p.toGive.length > 0 && (
              <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                <p className="mb-1 font-semibold">Colles à donner <span className="font-normal">· {colleSlotsLabel()} ; proposées à la suite des autres colles de l'élève</span></p>
                {p.toGive.map((g, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-2 py-1">
                    <span className="flex-1">{g.reason}</span>
                    {giving?.i === i ? (
                      <>
                        {g.choices.length > 1 && <select value={giving.hours} onChange={(e) => setGiving({ ...giving, hours: Number(e.target.value) })} aria-label="Durée" className={inputCls}>{g.choices.map((h) => <option key={h} value={h}>{h} h</option>)}</select>}
                        <input type="datetime-local" value={giving.when} onChange={(e) => setGiving({ ...giving, when: e.target.value })} aria-label="Date de la colle" className={inputCls} />
                        <Button className="!py-1 text-xs" onClick={() => give({ kind: 'COLLE', cause: g.cause, forgetId: g.forgetId, reason: g.reason, hours: giving.hours, when: giving.when })}>Donner</Button>
                      </>
                    ) : <Button variant="secondary" className="!py-1 text-xs" onClick={() => { setGiving({ i, hours: g.hours, when: nextColleSlot(student, data.colles, g.hours, TODAY) ?? '' }); setErr([]); }}>Donner la colle</Button>}
                  </div>
                ))}
              </div>
            )}
            {err.length > 0 && <ul className="rounded-md bg-red-50 p-2 text-xs text-red-800">{err.map((e) => <li key={e}>· {e}</li>)}</ul>}
            <ul className="divide-y divide-slate-100 text-sm">
              {p.entries.map((c) => (
                <li key={c.id} className="flex flex-wrap items-start justify-between gap-2 py-2">
                  <span className="min-w-0"><span className="font-medium text-slate-900">{c.kind === 'TIG' ? 'TIG' : `Colle de ${c.hours} h`}</span> <span className="text-slate-500">· {fmt(c.when)}</span>
                    <span className="block text-xs text-slate-500">{c.reason} · donnée par {c.by}</span></span>
                  {isTeacher ? <Badge tone={c.status === 'FAITE' ? 'green' : c.status === 'NON_FAITE' ? 'red' : 'amber'}>{COLLE_STATUS[c.status]}</Badge> : (
                    <select value={c.status} onChange={(e) => setStatus(c.id, e.target.value)} aria-label={`Statut — ${c.reason}`} className={`${inputCls} !py-1 text-xs`}>
                      {Object.entries(COLLE_STATUS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                    </select>
                  )}
                </li>
              ))}
              {p.entries.length === 0 && <li className="py-2 text-sm text-slate-500">Aucune colle ni TIG.</li>}
            </ul>
          </div>
        )}
      </Card>
      <div className="space-y-5">
        <Card title="Noter un oubli" subtitle={forget.kind === CARNET ? (student && isNew ? 'Nouvel élève : 1 h de colle au 2e oubli du carnet' : 'Carnet de liaison : 1 h de colle') : 'La colle n\'est pas automatique : à vous de la demander'}>
          <div className="space-y-2 text-sm">
            <select value={forget.kind} onChange={(e) => setForget({ ...forget, kind: e.target.value })} aria-label="Oubli" className={`w-full ${inputCls}`}>{FORGET_KINDS.map((k) => <option key={k}>{k}</option>)}</select>
            <input value={forget.note} onChange={(e) => setForget({ ...forget, note: e.target.value })} placeholder="Précision (ex. calculatrice, DM n°2)" aria-label="Précision" className={`w-full ${inputCls}`} />
            {forget.kind !== CARNET && <label className="flex items-center gap-2 text-xs text-slate-700"><input type="checkbox" checked={forget.colle} onChange={(e) => setForget({ ...forget, colle: e.target.checked })} />Demander une heure de colle</label>}
            <Button className="w-full" disabled={!student} onClick={addForget}>Noter l'oubli de {student ? student.split(' ').slice(1).join(' ') : '…'}</Button>
          </div>
        </Card>
        {role === 'DIRECTION' && (
          <Card title="Travail d'intérêt général (TIG)" subtitle="Décidé par la Direction">
            {tig ? (
              <div className="space-y-2 text-sm">
                <input value={tig.reason} onChange={(e) => setTig({ ...tig, reason: e.target.value })} placeholder="Motif et travail demandé" className={`w-full ${inputCls}`} />
                <input type="datetime-local" value={tig.when} onChange={(e) => setTig({ ...tig, when: e.target.value })} aria-label="Date du TIG" className={`w-full ${inputCls}`} />
                <div className="flex gap-2"><Button disabled={!tig.reason.trim()} onClick={() => give({ kind: 'TIG', cause: 'AUTRE', hours: 1, reason: tig.reason.trim(), when: tig.when })}>Enregistrer</Button><Button variant="secondary" onClick={() => setTig(null)}>Annuler</Button></div>
              </div>
            ) : <Button variant="secondary" className="w-full" disabled={!student} onClick={() => setTig({ reason: '', when: '2026-10-16T12:00' })}>Donner un TIG</Button>}
          </Card>
        )}
      </div>
    </div>
  );
}

/** Colles des 15 prochains jours, par créneau : qui surveille (CPE ou secrétariat, qui alternent ou choisissent). */
export function ColleSessionsCard({ role }) {
  const [watch, setWatch] = useState(loadWatch);
  const colles = loadPassport().colles;
  const sessions = upcomingColleSessions(colles, TODAY, 15);
  const canPick = ['VIE_SCOLAIRE', 'BUREAU', 'DIRECTION'].includes(role);
  if (!sessions.length) return null;
  return (
    <Card title="Colles à surveiller" subtitle={`${colleSlotsLabel().replace(/^./, (c) => c.toUpperCase())} : la CPE ou le secrétariat surveille, à tour de rôle ou au choix`}>
      <ul className="divide-y divide-slate-100 text-sm">
        {sessions.map((x) => (
          <li key={x.day} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <span><span className="font-medium text-slate-900">{formatDateFr(x.day).replace(/ \d{4}$/, '')}, {x.from.replace(':', 'h')}–{x.to.replace(':', 'h')}</span>
              <span className="block text-xs text-slate-600">{colles.filter((c) => c.kind !== 'TIG' && c.status === 'A_FAIRE' && c.when?.startsWith(x.day)).map((c) => `${c.student} ${c.when.slice(11, 16).replace(':', 'h')} (${c.hours} h)`).join(' · ')}</span></span>
            {canPick && !watch[x.day] && WATCHERS[role] ? (
              <Button className="!py-1 text-xs" onClick={() => { const w = { ...watch, [x.day]: role }; setWatch(w); saveWatch(w); }}>Je surveille</Button>
            ) : canPick ? (
              <select value={watch[x.day] ?? ''} onChange={(e) => { const w = { ...watch, [x.day]: e.target.value || undefined }; setWatch(w); saveWatch(w); }} aria-label={`Surveillance — ${x.day}`}
                className={`${inputCls} ${watch[x.day] ? '' : 'border-amber-400 bg-amber-50'}`}>
                <option value="">Qui surveille ?</option>{Object.entries(WATCHERS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            ) : <Badge tone={watch[x.day] ? 'navy' : 'amber'}>{watch[x.day] ? WATCHERS[watch[x.day]] : 'à désigner'}</Badge>}
          </li>
        ))}
      </ul>
    </Card>
  );
}
