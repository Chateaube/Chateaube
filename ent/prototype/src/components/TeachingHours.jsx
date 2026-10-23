import React, { useMemo, useState } from 'react';
import { Badge, Button, Card, Stat } from './ui.jsx';
import { TIMETABLE } from '../data/timetable.js';
import { STAFF } from '../data/people.js';
import { WORK_KINDS, teacherHours, absenceErrors, sessionsToSupervise, slotHours, grantNoWork, latenessBalance } from '../rules/teachingHours.js';
import { loadTeacherAbsences, saveTeacherAbsences, loadLateness, saveLateness } from '../absencesStore.js';
import { DocumentInput, DocumentThumb } from './PhotoInput.jsx';
import { formatDateFr } from '../rules/calendar.js';

// Heures des professeurs et absences.
//  - Direction et secrétariat : volume horaire prévu par l'emploi du temps, fait, absences, reste à faire ;
//  - professeur : ses heures, et la déclaration d'une absence avec le travail laissé (obligatoire) ;
//  - CPE : les séances à surveiller, avec le travail à distribuer.

const TODAY = '2026-10-13';
const ME = 'p1'; // professeur connecté (démonstration : Mme Ranaivo)
const PERIODS = {
  OCT: ['Octobre 2026', '2026-10-01', '2026-10-31'],
  SEPT: ['Septembre 2026', '2026-09-01', '2026-09-30'],
  T1: ['1er trimestre', '2026-09-07', '2026-12-18'],
};
const inputCls = 'rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm';
const h = (n) => `${String(Math.round(n * 100) / 100).replace('.', ',')} h`;
const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const teachersInTimetable = [...new Set(TIMETABLE.map((s) => s.teacherId))].map((id) => STAFF.find((x) => x.id === id)).filter(Boolean);
const nameOf = (id) => STAFF.find((x) => x.id === id)?.name ?? id;
const WORK_TONE = { DEVOIR: 'green', ACTIVITE: 'green', NON_REQUIS: 'slate', AUCUN: 'red' };

function AbsenceForm({ teacherId: fixed, onSave, declaredBy, role }) {
  const [a, setA] = useState({ teacherId: fixed ?? '', date: TODAY, slotIds: [], reason: '', work: 'DEVOIR', workText: '', file: null });
  const [tried, setTried] = useState(false);
  const wd = new Date(`${a.date}T12:00:00Z`).getUTCDay() || 7;
  const slots = TIMETABLE.filter((s) => s.teacherId === a.teacherId && s.weekday === wd);
  const errors = absenceErrors({ ...a, declaredRole: role });
  return (
    <Card title="Déclarer une absence" subtitle="Le professeur laisse un devoir ou une activité pour chaque séance : la vie scolaire surveille et distribue le travail">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {!fixed && <label className="text-xs text-slate-600">Professeur<select value={a.teacherId} onChange={(e) => setA({ ...a, teacherId: e.target.value, slotIds: [] })} className={`mt-1 w-full ${inputCls}`}><option value="">Choisir…</option>{teachersInTimetable.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>}
        <label className="text-xs text-slate-600">Date<input type="date" value={a.date} onChange={(e) => setA({ ...a, date: e.target.value, slotIds: [] })} className={`mt-1 w-full ${inputCls}`} /></label>
        <label className="text-xs text-slate-600">Motif<input value={a.reason} onChange={(e) => setA({ ...a, reason: e.target.value })} placeholder="ex. rendez-vous médical" className={`mt-1 w-full ${inputCls}`} /></label>
      </div>
      <div className="mt-3">
        <p className="mb-1 text-xs font-semibold text-slate-500">Séances concernées (d'après l'emploi du temps)</p>
        {a.teacherId && !slots.length && <p className="text-sm text-slate-500">Pas de cours ce jour-là.</p>}
        <div className="flex flex-wrap gap-1.5">
          {slots.map((s) => {
            const on = a.slotIds.includes(s.id);
            return <button key={s.id} type="button" aria-pressed={on} onClick={() => setA({ ...a, slotIds: on ? a.slotIds.filter((x) => x !== s.id) : [...a.slotIds, s.id] })}
              className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ${on ? 'bg-navy-500 text-white ring-navy-500' : 'bg-white text-slate-600 ring-slate-300'}`}>{s.start.replace(':', 'h')}–{s.end.replace(':', 'h')} · {s.cls} · {s.subject}</button>;
          })}
        </div>
      </div>
      <div className="mt-3">
        <p className="mb-1 text-xs font-semibold text-slate-500">Travail laissé pour la séance</p>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(WORK_KINDS).filter(([k]) => k !== 'NON_REQUIS' || role === 'DIRECTION').map(([k, l]) => <button key={k} type="button" aria-pressed={a.work === k} onClick={() => setA({ ...a, work: k })}
            className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ${a.work === k ? (k === 'AUCUN' ? 'bg-red-600 text-white ring-red-600' : 'bg-navy-500 text-white ring-navy-500') : 'bg-white text-slate-600 ring-slate-300'}`}>{l}</button>)}
        </div>
        {a.work === 'NON_REQUIS' && <p className="mt-2 rounded-lg bg-slate-50 p-2 text-xs text-slate-700">Absence de plusieurs jours : la Direction dispense de laisser un travail pour ces séances. Les élèves viennent quand même, en étude surveillée.</p>}
        {a.work === 'AUCUN' && <p className="mt-2 rounded-lg bg-red-50 p-2 text-xs text-red-800">Laisser un travail est obligatoire : une absence sans travail est signalée à la Direction, qui peut l'accorder pour une absence de plusieurs jours.</p>}
        {['DEVOIR', 'ACTIVITE'].includes(a.work) && (
            <div className="mt-2 flex flex-wrap items-start gap-2">
              <textarea rows={2} value={a.workText} onChange={(e) => setA({ ...a, workText: e.target.value })} placeholder="Consignes : exercices, pages, durée, à rendre ou non…" className={`min-w-[240px] flex-1 ${inputCls}`} />
              {a.file ? <DocumentThumb doc={a.file} title="Document joint" /> : <DocumentInput label="Joindre (photo ou PDF)" onAdd={(file) => setA({ ...a, file })} />}
            </div>
          )}
        <p className="mt-2 text-xs text-slate-500">Les familles ne sont pas prévenues : les élèves viennent, en étude surveillée par la vie scolaire. Pour annuler ou déplacer un cours, utilisez « Changements d'emploi du temps » (les familles sont alors prévenues).</p>
      </div>
      {tried && errors.length > 0 && <ul className="mt-2 text-sm text-red-700">{errors.map((e) => <li key={e}>· {e}</li>)}</ul>}
      <Button className="mt-3" onClick={() => { setTried(true); if (!errors.length) { onSave({ ...a, id: `a${Date.now()}`, declaredBy, declaredRole: role, declaredAt: TODAY }); setA({ ...a, slotIds: [], reason: '', workText: '', file: null }); setTried(false); } }}>Enregistrer l'absence</Button>
    </Card>
  );
}

function AbsenceList({ absences, title, subtitle, role, onGrant }) {
  return (
    <Card title={title} subtitle={subtitle}>
      {absences.length === 0 && <p className="text-sm text-slate-500">Aucune.</p>}
      <ul className="divide-y divide-slate-100 text-sm">
        {absences.map((a) => {
          const slots = a.slotIds.map((id) => TIMETABLE.find((s) => s.id === id)).filter(Boolean);
          return (
            <li key={a.id} className="py-2.5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-slate-900">{nameOf(a.teacherId)} · {cap(formatDateFr(a.date))}</p>
                  <p className="text-xs text-slate-500">{slots.map((s) => `${s.start.replace(':', 'h')}–${s.end.replace(':', 'h')} ${s.cls} (${s.subject})`).join(' · ')} · {a.reason} · déclarée par {a.declaredBy}</p>
                  {a.workText && <p className="mt-1 text-slate-700">{a.workText}</p>}
                </div>
                <span className="flex flex-wrap items-center justify-end gap-2">{a.file && <DocumentThumb doc={a.file} title="Travail laissé" />}<Badge tone={WORK_TONE[a.work]}>{WORK_KINDS[a.work]}</Badge>
                  {a.work === 'AUCUN' && role === 'DIRECTION' && <Button variant="secondary" className="!px-2 !py-0.5 text-xs" onClick={() => onGrant(a)}>Accorder (absence longue)</Button>}</span>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

export default function TeachingHours({ role, settings }) {
  const isTeacher = role === 'ENSEIGNANT';
  const isCpe = role === 'VIE_SCOLAIRE';
  const [absences, setAbsences] = useState(loadTeacherAbsences);
  const [period, setPeriod] = useState('OCT');
  const [open, setOpen] = useState(null);
  const [, from, to] = PERIODS[period];
  const add = (a) => {
    const next = [a, ...absences]; setAbsences(next); saveTeacherAbsences(next);
  };
  const grant = (a) => { const r = grantNoWork(a, role); if (r.error) return; const next = absences.map((x) => (x.id === a.id ? r.absence : x)); setAbsences(next); saveTeacherAbsences(next); };
  const [declaring, setDeclaring] = useState(false);
  const [late, setLateState] = useState(loadLateness);
  const setLate = (d) => { setLateState(d); saveLateness(d); };
  const [pointage, setPointage] = useState({ teacherId: '', date: TODAY, minutes: 5 });
  const [makeup, setMakeup] = useState({ teacherId: '', date: TODAY, note: '' });
  const canPoint = ['DIRECTION', 'BUREAU', 'VIE_SCOLAIRE'].includes(role);
  const rows = useMemo(() => teachersInTimetable.filter((t) => !isTeacher || t.id === ME)
    .map((t) => ({ t, ...teacherHours(t.id, TIMETABLE, absences, { from, to, today: TODAY, settings }) })), [absences, from, to, isTeacher, settings]);
  const toSupervise = sessionsToSupervise(absences, TIMETABLE, TODAY);
  const declaredBy = isTeacher ? nameOf(ME) : { DIRECTION: 'Direction', BUREAU: 'Secrétariat', VIE_SCOLAIRE: 'CPE' }[role];

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-semibold text-navy-500">{isTeacher ? 'Mes heures' : 'Professeurs'} · Tamatave</p>
        <h1 className="text-2xl font-semibold text-navy-900">{role === 'ENSEIGNANT' ? 'Mes heures et absences' : 'Heures et absences des profs'}</h1>
        <p className="text-sm text-slate-500">{isCpe ? 'Séances à surveiller et travail laissé par le professeur.' : 'Volume horaire prévu par l\'emploi du temps (jours de classe, hors fériés et vacances), heures faites et absences.'}</p>
      </div>

      {(isCpe || !isTeacher) && (
        <Card title={`Séances à surveiller (${toSupervise.length})`} subtitle="Le travail laissé est à distribuer en début de séance">
          {toSupervise.length === 0 && <p className="text-sm text-slate-500">Aucune séance à surveiller.</p>}
          <ul className="divide-y divide-slate-100 text-sm">
            {toSupervise.map((x) => (
              <li key={`${x.id}-${x.slot?.id}`} className="flex flex-wrap items-start justify-between gap-2 py-2">
                <span className="min-w-0"><span className="font-medium">{cap(formatDateFr(x.date))} · {x.slot?.start.replace(':', 'h')}–{x.slot?.end.replace(':', 'h')} · {x.slot?.cls}</span>
                  <span className="block text-xs text-slate-500">{x.slot?.subject} · {nameOf(x.teacherId)} absent{x.workText ? ` · ${x.workText}` : ''}</span></span>
                <Badge tone={WORK_TONE[x.work]}>{WORK_KINDS[x.work]}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {!isCpe && (
        <Card title={isTeacher ? 'Mes heures' : 'Volume horaire par professeur'}
          action={<select value={period} onChange={(e) => setPeriod(e.target.value)} aria-label="Période" className={inputCls}>{Object.entries(PERIODS).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}</select>}>
          {isTeacher && rows[0] && (
            <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat label="Prévu sur la période" value={h(rows[0].planned)} />
              <Stat label="Fait à ce jour" value={h(rows[0].done)} tone="green" hint={`sur ${h(rows[0].plannedToDate)} prévues à ce jour`} />
              <Stat label="Absences" value={h(rows[0].absent)} tone={rows[0].absent ? 'amber' : undefined} />
              <Stat label="Reste à faire" value={h(rows[0].remaining)} />
            </div>
          )}
          <div className="-mx-5 overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead><tr className="border-y border-slate-100 bg-slate-50 text-left text-xs text-slate-500">
                <th className="px-4 py-2 font-medium">Professeur</th><th className="px-2 text-right font-medium">Prévu</th><th className="px-2 text-right font-medium">Prévu à ce jour</th>
                <th className="px-2 text-right font-medium">Fait</th><th className="px-2 text-right font-medium">Absences</th><th className="px-2 text-right font-medium">Reste à faire</th><th className="px-4 text-right font-medium">Retards cumulés</th>
              </tr></thead>
              <tbody>
                {rows.map((r) => (
                  <React.Fragment key={r.t.id}>
                    <tr className="border-b border-slate-100">
                      <td className="px-4 py-2"><button type="button" onClick={() => setOpen(open === r.t.id ? null : r.t.id)} className="text-left font-medium text-slate-900 hover:text-navy-500">{r.t.name}</button><span className="block text-xs text-slate-500">{r.t.detail}</span></td>
                      <td className="px-2 text-right tabular-nums">{h(r.planned)}</td>
                      <td className="px-2 text-right tabular-nums text-slate-600">{h(r.plannedToDate)}</td>
                      <td className="px-2 text-right tabular-nums font-semibold">{h(r.done)}</td>
                      <td className="px-2 text-right tabular-nums">{r.absent ? <span className="text-amber-700">{h(r.absent)}</span> : '—'}{r.absentNoWork > 0 && <span className="block text-[11px] text-red-700">dont {h(r.absentNoWork)} sans travail</span>}</td>
                      <td className="px-2 text-right tabular-nums">{h(r.remaining)}</td>
                      <td className="px-4 text-right tabular-nums">{(() => { const b = latenessBalance(r.t.id, late.lateness, late.makeups); return <>{b.minutes} min{b.toMakeUp > 0 ? <span className="block text-[11px] font-semibold text-red-700">{b.toMakeUp} h à rattraper</span> : <span className="block text-[11px] text-slate-500">encore {b.beforeNext} min avant 1 h</span>}</>; })()}</td>
                    </tr>
                    {open === r.t.id && (
                      <tr className="bg-slate-50"><td colSpan={7} className="px-4 py-2">
                        <ul className="grid gap-1 text-xs text-slate-700 sm:grid-cols-2">
                          {Object.entries(r.byClass).map(([k, v]) => <li key={k} className="flex justify-between gap-2"><span>{k}</span><span className="tabular-nums">{h(v.done)} faites / {h(v.planned)} prévues{v.absent ? ` · ${h(v.absent)} d'absence` : ''}</span></li>)}
                        </ul>
                      </td></tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
          {isTeacher
            ? <p className="mt-2 text-xs text-slate-600">« Fait » vient de vos appels validés. Par semaine : {h(TIMETABLE.filter((s) => s.teacherId === ME).reduce((x, s) => x + slotHours(s), 0))}.</p>
            : <p className="mt-2 text-xs text-slate-600">« Fait » vient des appels validés ; les heures faites servent à la paie des vacataires (Caisse › Salaires). Par semaine : {teachersInTimetable.map((t) => `${t.name.split(' ')[0]} ${h(TIMETABLE.filter((s) => s.teacherId === t.id).reduce((x, s) => x + slotHours(s), 0))}`).join(' · ')}.</p>}
        </Card>
      )}

      {canPoint && (
        <Card title="Retards des professeurs" subtitle="Pointage par la vie scolaire ou le secrétariat ; à partir d'une heure de retard cumulée (5, 10, 15 minutes…), l'heure est à rattraper">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="flex flex-wrap items-end gap-2">
              <label className="text-xs text-slate-600">Professeur<select value={pointage.teacherId} onChange={(e) => setPointage({ ...pointage, teacherId: e.target.value })} className={`mt-1 block ${inputCls}`}><option value="">Choisir…</option>{teachersInTimetable.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
              <label className="text-xs text-slate-600">Date<input type="date" value={pointage.date} onChange={(e) => setPointage({ ...pointage, date: e.target.value })} className={`mt-1 block ${inputCls}`} /></label>
              <label className="text-xs text-slate-600">Retard<select value={pointage.minutes} onChange={(e) => setPointage({ ...pointage, minutes: Number(e.target.value) })} className={`mt-1 block ${inputCls}`}>{[5, 10, 15, 20, 25, 30, 45, 60].map((m) => <option key={m} value={m}>{m} min</option>)}</select></label>
              <Button disabled={!pointage.teacherId} onClick={() => setLate({ ...late, lateness: [...late.lateness, { id: `l${Date.now()}`, ...pointage, by: declaredBy }] })}>Noter le retard</Button>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <label className="text-xs text-slate-600">Heure rattrapée par<select value={makeup.teacherId} onChange={(e) => setMakeup({ ...makeup, teacherId: e.target.value })} className={`mt-1 block ${inputCls}`}><option value="">Choisir…</option>{teachersInTimetable.filter((t) => latenessBalance(t.id, late.lateness, late.makeups).toMakeUp > 0).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
              <label className="text-xs text-slate-600">Le<input type="date" value={makeup.date} onChange={(e) => setMakeup({ ...makeup, date: e.target.value })} className={`mt-1 block ${inputCls}`} /></label>
              <Button variant="secondary" disabled={!makeup.teacherId} onClick={() => { setLate({ ...late, makeups: [...late.makeups, { id: `m${Date.now()}`, ...makeup, hours: 1 }] }); setMakeup({ ...makeup, teacherId: '' }); }}>Enregistrer 1 h rattrapée</Button>
            </div>
          </div>
        </Card>
      )}
      {isTeacher && (() => { const b = latenessBalance(ME, late.lateness, late.makeups); return <p className={`rounded-xl p-3 text-sm ${b.toMakeUp ? 'bg-red-50 text-red-800' : 'bg-slate-50 text-slate-700'}`}>Retards cumulés : {b.minutes} min{b.toMakeUp ? ` · ${b.toMakeUp} h à rattraper (à convenir avec la Direction)` : ` · une heure à rattraper à partir de 60 min`}.</p>; })()}
      {/* formulaire derrière un bouton : l'écran s'ouvre sur ce qui est déjà déclaré */}
      {declaring
        ? <AbsenceForm teacherId={isTeacher ? ME : undefined} onSave={(a) => { add(a); setDeclaring(false); }} declaredBy={declaredBy} role={role} />
        : <Button onClick={() => setDeclaring(true)}>＋ {isTeacher ? 'Déclarer une absence' : 'Déclarer l\'absence d\'un professeur'}</Button>}
      <AbsenceList absences={absences.filter((a) => !isTeacher || a.teacherId === ME)} title={isTeacher ? 'Mes absences' : 'Absences déclarées'} subtitle="Avec le travail laissé pour chaque séance" role={role} onGrant={grant} />
    </div>
  );
}
