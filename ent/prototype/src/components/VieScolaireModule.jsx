import React, { useState } from 'react';
import { Badge, Button, Card, Icon, Stat } from './ui.jsx';
import { CLASSES, classOf, STAFF_NAMES, ATTENDANCE, MEASURES_LOG, PHONES } from '../data/schoollife.js';
import { MEASURES, AUTHORS, validateMeasure, phoneReturnAt, PHONE_DURATIONS, phoneDurationFor, validateReturn, ackReminderDue } from '../rules/discipline.js';
import { formatDateFr } from '../rules/calendar.js';

// Vie scolaire : absences / retards, punitions et sanctions, téléphones confisqués.
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
  : <span className="text-xs text-amber-700">En attente de « Je suis informé.e »</span>);

/* ---------- Absences & retards ---------- */
function AttendanceTab({ rows, setRows, toast }) {
  const update = (id, patch, msg) => { setRows(rows.map((r) => (r.id === id ? { ...r, ...patch } : r))); toast(msg); };
  return (
    <Card title="Absences et retards" subtitle="Issus de l'appel des enseignants en temps réel">
      <div className="-mx-4 overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-y border-slate-100 bg-slate-50 text-left text-xs text-slate-500">
              <th className="px-4 py-2 font-medium">Élève</th><th className="px-2 font-medium">Type</th><th className="px-2 font-medium">Date / créneau</th>
              <th className="px-2 font-medium">Justificatif</th><th className="px-2 font-medium">Parent</th><th className="px-4 text-right font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-slate-100">
                <td className="px-4 py-2"><p className="font-medium text-slate-900">{r.student}</p><p className="text-xs text-slate-500">{classOf(r.student)} · appel de {r.by}</p></td>
                <td className="px-2">{r.kind === 'ABSENCE' ? <Badge tone="red">Absence</Badge> : <Badge tone="amber">Retard</Badge>}</td>
                <td className="px-2 text-slate-600">{formatDateFr(r.date).replace(/ \d{4}$/, '')}<br /><span className="text-xs">{r.slot}</span></td>
                <td className="px-2">
                  {r.justified ? <Badge tone="green">{r.reason ?? 'Justifié'}</Badge> : (
                    <select defaultValue="" onChange={(e) => e.target.value && update(r.id, { justified: true, reason: e.target.value }, `${r.kind === 'ABSENCE' ? 'Absence' : 'Retard'} de ${r.student} justifié.`)}
                      className="rounded-md border border-slate-300 px-2 py-1 text-xs">
                      <option value="">À justifier…</option>{REASONS.map((x) => <option key={x}>{x}</option>)}
                    </select>
                  )}
                </td>
                <td className="px-2">{r.notified ? <Ack at={r.parentAck} /> : <span className="text-xs text-slate-500">Non prévenu</span>}</td>
                <td className="px-4 text-right">
                  {!r.notified && <Button variant="ghost" onClick={() => update(r.id, { notified: true }, `Parent de ${r.student} prévenu (e-mail + application).`)}><Icon name="bell" />Prévenir</Button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/* ---------- Punitions & sanctions ---------- */
function MeasuresTab({ log, setLog, role, toast }) {
  const authorRole = { DIRECTION: 'DIRECTION', ENSEIGNANT: 'PROFESSEUR' }[role] ?? 'VIE_SCOLAIRE';
  const authors = { DIRECTION: ['Cheffe d\'établissement', 'Directrice adjointe'], PROFESSEUR: ['Mme Ranaivo'] }[authorRole] ?? STAFF_NAMES.filter((n) => !n.startsWith('Direction'));
  const blank = { student: '', measureId: 'OBSERVATION', reason: '', when: '', author: authors[0] };
  const [draft, setDraft] = useState(blank);
  const errors = validateMeasure({ ...draft, authorRole });
  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_380px] xl:items-start">
      <Card title="Punitions et sanctions" subtitle="Chaque mesure a un motif ; le parent confirme en avoir pris connaissance">
        <ul className="divide-y divide-slate-100">
          {[...log].sort((a, b) => b.date.localeCompare(a.date)).map((m) => (
            <li key={m.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900">{m.student} <span className="font-normal text-slate-500">· {classOf(m.student)} · {formatDateFr(m.date).replace(/ \d{4}$/, '')}</span></p>
                <p className="text-sm text-slate-700"><span className="text-slate-500">Motif :</span> {m.reason}</p>
                {m.when && <p className="text-xs text-slate-500">À effectuer : {m.when}</p>}
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
                <optgroup key={k} label={k === 'PUNITION' ? 'Punitions (enseignant, vie scolaire)' : 'Sanctions (Direction)'}>
                  {MEASURES.filter((m) => m.kind === k).map((m) => <option key={m.id} value={m.id} disabled={k === 'SANCTION' && authorRole !== 'DIRECTION'}>{m.label}</option>)}
                </optgroup>
              ))}
            </select>
          </label>
          <label className="block text-xs text-slate-600">Motif<textarea rows={2} value={draft.reason} onChange={(e) => setDraft({ ...draft, reason: e.target.value })} className={`mt-1 w-full ${inputCls}`} /></label>
          {draft.measureId === 'RETENUE' && (
            <label className="block text-xs text-slate-600">Date et heure de la retenue<input value={draft.when} onChange={(e) => setDraft({ ...draft, when: e.target.value })} placeholder="ex. mercredi 21 octobre, 13h–15h" className={`mt-1 w-full ${inputCls}`} /></label>
          )}
          <label className="block text-xs text-slate-600">Décidée par
            <select value={draft.author} onChange={(e) => setDraft({ ...draft, author: e.target.value })} className={`mt-1 w-full ${inputCls}`}>
              {authors.map((n) => <option key={n}>{n}</option>)}
            </select>
          </label>
          {draft.reason && errors.map((e) => <p key={e} className="text-xs text-red-700">{e}</p>)}
          <Button className="w-full" disabled={errors.length > 0} onClick={() => {
            setLog([{ id: `m${Date.now()}`, date: '2026-10-13', student: draft.student, measure: draft.measureId, reason: draft.reason.trim(), when: draft.when || null, author: draft.author, authorRole, parentAck: null }, ...log]);
            toast(`Mesure enregistrée ; le parent de ${draft.student} est notifié (e-mail + application).`);
            setDraft(blank);
          }}>Enregistrer et prévenir le parent</Button>
        </div>
      </Card>
    </div>
  );
}

/* ---------- Téléphones ---------- */
function PhonesTab({ phones, setPhones, settings, toast }) {
  const blank = { student: '', at: NOW, duration: '24H', confiscatedBy: STAFF_NAMES[1], receivedBy: STAFF_NAMES[0], reason: '' };
  const [draft, setDraft] = useState(blank);
  const [returning, setReturning] = useState(null);
  const ok = draft.student && draft.at && draft.reason.trim();
  const recidive = draft.student ? phoneDurationFor(draft.student, phones) : { previous: 0 };
  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_380px] xl:items-start">
      <Card title="Téléphones confisqués" subtitle="Restitution calculée sur les jours de classe (hors week-ends, fériés et vacances)">
        <ul className="divide-y divide-slate-100">
          {phones.map((p) => {
            const due = phoneReturnAt(p.at, p.duration, settings);
            const ready = !p.returned && due <= NOW;
            return (
              <li key={p.id} className="py-3 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-slate-900">{p.student} <span className="font-normal text-slate-500">· {classOf(p.student)}</span></p>
                    <p className="text-slate-700">{p.reason}</p>
                    <p className="text-xs text-slate-500">Confisqué le {fmtDT(p.at)} par {p.confiscatedBy} · reçu et signé par {p.receivedBy}</p>
                  </div>
                  <div className="text-right">
                    <Badge tone="navy">{PHONE_DURATIONS.find((d) => d.id === p.duration).label}</Badge>
                    {p.returned
                      ? <p className="mt-1 text-xs text-emerald-700">Rendu le {fmtDT(p.returned.at)} à {p.returned.to}<br />par {p.returned.by}</p>
                      : <p className={`mt-1 text-xs ${ready ? 'font-medium text-emerald-700' : 'text-slate-600'}`}>{ready ? 'Peut être rendu' : 'Restitution'} : {fmtDT(due)}</p>}
                  </div>
                </div>
                {!p.returned && returning?.id !== p.id && <Button variant="ghost" className="mt-1 !px-0" onClick={() => setReturning({ id: p.id, to: '', toRole: 'PARENT', by: STAFF_NAMES[0] })}>Enregistrer la restitution</Button>}
                {returning?.id === p.id && (
                  <div className="mt-2 grid gap-2 rounded-lg bg-slate-50 p-3 sm:grid-cols-[150px_1fr_1fr_auto] sm:items-end">
                    <label className="text-xs text-slate-600">Rendu à
                      <select value={returning.toRole} onChange={(e) => setReturning({ ...returning, toRole: e.target.value })} className={`mt-1 w-full ${inputCls}`}>
                        <option value="PARENT">Responsable légal</option>
                        <option value="ELEVE" disabled={p.duration === '5J'}>L'élève{p.duration === '5J' ? ' (non : 5 jours)' : ''}</option>
                      </select>
                    </label>
                    <label className="text-xs text-slate-600">Nom<input value={returning.to} onChange={(e) => setReturning({ ...returning, to: e.target.value })} placeholder={returning.toRole === 'PARENT' ? 'ex. M. Randriamampianina (père)' : p.student} className={`mt-1 w-full ${inputCls}`} /></label>
                    <label className="text-xs text-slate-600">Rendu et signé par
                      <select value={returning.by} onChange={(e) => setReturning({ ...returning, by: e.target.value })} className={`mt-1 w-full ${inputCls}`}>{STAFF_NAMES.map((n) => <option key={n}>{n}</option>)}</select>
                    </label>
                    <Button disabled={validateReturn({ duration: p.duration, toRole: returning.toRole, toName: returning.to }).length > 0} onClick={() => {
                      setPhones(phones.map((x) => (x.id === p.id ? { ...x, returned: { at: NOW, by: returning.by, to: returning.to.trim() } } : x)));
                      setReturning(null); toast(`Téléphone de ${p.student} restitué.`);
                    }}>Confirmer</Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </Card>
      <Card title="Nouvelle confiscation">
        <div className="space-y-2 text-sm">
          <ClassStudentPicker value={draft.student} onChange={(student) => setDraft({ ...draft, student, duration: student ? phoneDurationFor(student, phones).duration : '24H' })} />
          {recidive.previous > 0 && (
            <p className="rounded-md bg-amber-50 px-2 py-1.5 text-xs text-amber-900">Récidive ({recidive.previous} confiscation{recidive.previous > 1 ? 's' : ''} cette année) : 5 jours ouvrés appliqués automatiquement, restitution à un responsable légal uniquement.</p>
          )}
          <label className="block text-xs text-slate-600">Motif<input value={draft.reason} onChange={(e) => setDraft({ ...draft, reason: e.target.value })} placeholder="ex. Téléphone utilisé en cours" className={`mt-1 w-full ${inputCls}`} /></label>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-slate-600">Confisqué le<input type="datetime-local" value={draft.at} onChange={(e) => setDraft({ ...draft, at: e.target.value })} className={`mt-1 w-full ${inputCls}`} /></label>
            <label className="text-xs text-slate-600">Durée
              <select value={draft.duration} disabled={recidive.previous > 0} onChange={(e) => setDraft({ ...draft, duration: e.target.value })} className={`mt-1 w-full ${inputCls} disabled:bg-slate-50`}>
                {PHONE_DURATIONS.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
              </select>
            </label>
          </div>
          <label className="block text-xs text-slate-600">Confisqué par
            <select value={draft.confiscatedBy} onChange={(e) => setDraft({ ...draft, confiscatedBy: e.target.value })} className={`mt-1 w-full ${inputCls}`}>{STAFF_NAMES.map((n) => <option key={n}>{n}</option>)}</select>
          </label>
          <label className="block text-xs text-slate-600">Reçu et signé par (garde du téléphone)
            <select value={draft.receivedBy} onChange={(e) => setDraft({ ...draft, receivedBy: e.target.value })} className={`mt-1 w-full ${inputCls}`}>{STAFF_NAMES.filter((n) => n.startsWith('Direction') || n.includes('vie scolaire')).map((n) => <option key={n}>{n}</option>)}</select>
          </label>
          {draft.at && <p className="rounded-md bg-navy-50 px-2 py-1.5 text-xs text-navy-900">Restitution prévue : {fmtDT(phoneReturnAt(draft.at, draft.duration, settings))}</p>}
          <Button className="w-full" disabled={!ok} onClick={() => {
            setPhones([{ ...draft, id: `p${Date.now()}`, reason: draft.reason.trim(), returned: null }, ...phones]);
            toast(`Confiscation enregistrée ; le parent de ${draft.student} est prévenu.`);
            setDraft(blank);
          }}>Enregistrer</Button>
        </div>
      </Card>
    </div>
  );
}

const TABS = [['attendance', 'Absences & retards'], ['measures', 'Punitions & sanctions'], ['phones', 'Téléphones confisqués']];

export default function VieScolaireModule({ settings, role = 'VIE_SCOLAIRE' }) {
  // l'enseignant ne voit que ses outils : punitions et remise d'un téléphone confisqué
  const tabs = role === 'ENSEIGNANT' ? TABS.slice(1) : TABS;
  const [tab, setTab] = useState(tabs[0][0]);
  const [rows, setRows] = useState(ATTENDANCE);
  const [log, setLog] = useState(MEASURES_LOG);
  const [phones, setPhones] = useState(PHONES);
  const [message, setMessage] = useState(null);
  const today = rows.filter((r) => r.date === '2026-10-13');

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Mardi 13 octobre 2026 · Tamatave</p>
        <h1 className="text-2xl font-semibold text-navy-900">{role === 'ENSEIGNANT' ? 'Punitions & téléphones' : 'Vie scolaire'}</h1>
      </div>
      {role !== 'ENSEIGNANT' && <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Absences aujourd'hui" value={today.filter((r) => r.kind === 'ABSENCE').length} tone="red" />
        <Stat label="Retards aujourd'hui" value={today.filter((r) => r.kind === 'RETARD').length} tone="amber" />
        <Stat label="Mesures non lues par le parent" value={log.filter((m) => !m.parentAck).length} tone="amber" />
        <Stat label="Téléphones en garde" value={phones.filter((p) => !p.returned).length} />
      </div>}
      {message && <p role="status" className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800"><Icon name="check" />{message}</p>}
      <div className="flex gap-1 overflow-x-auto rounded-lg bg-slate-100 p-1" role="tablist">
        {tabs.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
            className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ${tab === id ? 'bg-white text-navy-900 shadow-sm' : 'text-slate-600'}`}>{label}</button>
        ))}
      </div>
      {tab === 'attendance' && <AttendanceTab rows={rows} setRows={setRows} toast={setMessage} />}
      {tab === 'measures' && <MeasuresTab log={log} setLog={setLog} role={role} toast={setMessage} />}
      {tab === 'phones' && <PhonesTab phones={phones} setPhones={setPhones} settings={settings} toast={setMessage} />}
    </div>
  );
}
