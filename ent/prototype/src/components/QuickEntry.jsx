import React, { useMemo, useState } from 'react';
import { Button, Icon } from './ui.jsx';
import { loadAttendance, saveAttendance } from '../attendanceStore.js';
import { loadObjects, saveObjects } from '../objectsStore.js';
import { loadVisits, saveVisits } from '../careStore.js';
import { logActivity, ACTOR, DEMO_TODAY } from '../activityStore.js';
import { OBJECTS } from '../rules/discipline.js';
import { CARE_REASONS, CARE_OUTCOMES } from '../rules/care.js';
import { LATE_LIMIT } from '../rules/attendance.js';
import { findStudents } from '../rules/search.js';

// Saisie express de la vie scolaire, debout, téléphone en main (au portail, dans la cour) :
// une action → l'élève (nom, prénom ou classe) → deux ou trois touches → c'est noté.
// Sur téléphone : barre fixée en bas de l'écran ; sur ordinateur : quatre gros boutons.
// Tout part dans les écrans habituels (absences et retards, objets confisqués, soins) et dans le journal.

const ACTIONS = [
  ['RETARD', 'Retard', 'clock'], ['ABSENCE', 'Absence', 'users'], ['OBJET', 'Confiscation', 'box'], ['SOIN', 'Infirmerie', 'care'],
];
const SLOTS = [['Matin', '07h00–12h00'], ['Après-midi', '13h00–17h00'], ['Journée', 'Journée']];
const nowHm = () => new Date().toTimeString().slice(0, 5);

function Chips({ options, value, onChange, label }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label={label}>
      {options.map(([k, l]) => (
        <button key={k} type="button" aria-pressed={value === k} onClick={() => onChange(k)}
          className={`min-h-[40px] rounded-full px-3 text-sm font-medium ring-1 ${value === k ? 'bg-navy-500 text-white ring-navy-500' : 'bg-white text-slate-800 ring-slate-300'}`}>{l}</button>
      ))}
    </div>
  );
}

function Sheet({ action, role, onClose, onSaved }) {
  const [query, setQuery] = useState('');
  const [student, setStudent] = useState(null);
  const [f, setF] = useState({ minutes: 5, slot: 'Matin', object: 'Téléphone', reason: '', care: 'Mal de tête', outcome: 'CLASSE' });
  const matches = useMemo(() => findStudents(query), [query]);
  const who = ACTOR[role] ?? ACTOR.VIE_SCOLAIRE;
  const label = ACTIONS.find(([k]) => k === action)[1];
  const ready = student && (action !== 'OBJET' || f.reason.trim());

  const save = () => {
    const t = nowHm(); const id = `${action.toLowerCase()}${Date.now()}`;
    let text = '';
    if (action === 'RETARD' || action === 'ABSENCE') {
      const slot = action === 'RETARD' ? `${t.replace(':', 'h')} (+${f.minutes} min)` : SLOTS.find(([k]) => k === f.slot)[1];
      saveAttendance([{ id, date: DEMO_TODAY, student: student.name, kind: action, slot, by: who, justified: false, notified: false, parentAck: null }, ...loadAttendance()]);
      text = action === 'RETARD' ? `Retard de ${f.minutes} min${f.minutes > LATE_LIMIT ? ' (compté absent pour l\'heure commencée)' : ''}` : `Absence (${f.slot.toLowerCase()})`;
    } else if (action === 'OBJET') {
      saveObjects([{ id, student: student.name, at: `${DEMO_TODAY}T${t}`, object: f.object, confiscatedBy: who, receivedBy: who, reason: f.reason.trim(), returned: null }, ...loadObjects()]);
      text = `${f.object} confisqué : ${f.reason.trim()} (durée à décider par la Direction ou le secrétariat)`;
    } else {
      saveVisits([{ id, at: `${DEMO_TODAY}T${t}`, student: student.name, reason: f.care, paracetamol: false, outcome: f.outcome, by: who }, ...loadVisits()]);
      text = `Passage à l'infirmerie : ${f.care.toLowerCase()} — ${CARE_OUTCOMES[f.outcome].toLowerCase()}`;
    }
    logActivity({ who, role, kind: { RETARD: 'ABSENCE', ABSENCE: 'ABSENCE', OBJET: 'OBJET', SOIN: 'SOIN' }[action], student: student.name, text });
    onSaved(`${label} noté${action === 'ABSENCE' ? 'e' : ''} pour ${student.name} (${student.cls}).${action === 'RETARD' || action === 'ABSENCE' ? ' Les parents seront prévenus avec les autres (Absences et retards).' : ''}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 sm:items-center" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={`Saisie express : ${label}`} onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-4 shadow-2xl sm:rounded-3xl">
        <div className="mb-3 flex items-center justify-between">
          <p className="font-display text-lg font-semibold text-navy-900">{label}</p>
          <button type="button" onClick={onClose} aria-label="Fermer" className="rounded-full p-2 text-slate-500 hover:bg-slate-100"><Icon name="x" /></button>
        </div>
        {!student ? (
          <>
            <label className="block text-xs font-medium text-slate-600">Élève (nom, prénom ou classe)
              <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ex. Fitia, Rasoa, 1re STMG" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-base" />
            </label>
            <ul className="mt-2 divide-y divide-slate-100">
              {matches.map((s) => <li key={s.name}><button type="button" onClick={() => setStudent(s)} className="flex min-h-[44px] w-full items-center justify-between px-1 text-left text-sm"><span className="font-medium text-slate-900">{s.name}</span><span className="text-xs text-slate-600">{s.cls}</span></button></li>)}
              {query.trim() && !matches.length && <li className="py-2 text-sm text-slate-600">Aucun élève trouvé.</li>}
            </ul>
          </>
        ) : (
          <div className="space-y-3">
            <p className="flex items-center justify-between rounded-xl bg-navy-50 px-3 py-2 text-sm"><span><strong>{student.name}</strong> · {student.cls}</span><button type="button" onClick={() => setStudent(null)} className="text-xs font-medium text-navy-700">Changer</button></p>
            {action === 'RETARD' && <>
              <Chips label="Minutes de retard" value={f.minutes} onChange={(minutes) => setF({ ...f, minutes })} options={[5, 10, 15, 20, 30].map((m) => [m, `${m} min`])} />
              {f.minutes > LATE_LIMIT && <p className="text-xs text-amber-800">Plus de {LATE_LIMIT} min : compté absent pour l'heure commencée, il entre à l'heure suivante.</p>}
            </>}
            {action === 'ABSENCE' && <Chips label="Créneau" value={f.slot} onChange={(slot) => setF({ ...f, slot })} options={SLOTS.map(([k]) => [k, k])} />}
            {action === 'OBJET' && <>
              <Chips label="Objet" value={f.object} onChange={(object) => setF({ ...f, object })} options={OBJECTS.filter((o) => o !== 'Autre').map((o) => [o, o.replace(/ \(Puff\)/, '')])} />
              <input value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} placeholder="Motif (ex. sorti en classe)" aria-label="Motif" className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
            </>}
            {action === 'SOIN' && <>
              <Chips label="Motif" value={f.care} onChange={(care) => setF({ ...f, care })} options={CARE_REASONS.map((r) => [r, r])} />
              <Chips label="Suite" value={f.outcome} onChange={(outcome) => setF({ ...f, outcome })} options={Object.entries(CARE_OUTCOMES).map(([k, l]) => [k, l.split(' (')[0].split(' :')[0]])} />
              <p className="text-xs text-slate-600">Un médicament (Doliprane…) : passez par l'écran Soins et infirmerie, qui vérifie les allergies et la dernière prise.</p>
            </>}
            <Button className="w-full !py-3 text-base" disabled={!ready} onClick={save}>Enregistrer</Button>
          </div>
        )}
      </div>
    </div>
  );
}

/** Quatre boutons (ordinateur) et barre fixée en bas (téléphone). */
export default function QuickEntry({ role = 'VIE_SCOLAIRE' }) {
  const [action, setAction] = useState(null);
  const [done, setDone] = useState('');
  const buttons = (cls) => ACTIONS.map(([k, l, icon]) => (
    <button key={k} type="button" data-quick={k} onClick={() => { setAction(k); setDone(''); }} className={cls}><Icon name={icon} className="h-5 w-5" />{l}</button>
  ));
  return (
    <>
      <section aria-label="Saisie express" className="hidden rounded-2xl bg-white p-3 shadow-soft sm:block">
        <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-navy-700">Saisie express</p>
        <div className="grid grid-cols-4 gap-2">{buttons('flex min-h-[56px] items-center justify-center gap-2 rounded-xl bg-navy-50 text-sm font-semibold text-navy-900 hover:bg-navy-100')}</div>
      </section>
      <nav aria-label="Saisie express" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] sm:hidden">
        {buttons('flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-[11px] font-semibold text-navy-900')}
      </nav>
      {done && <p role="status" className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800"><Icon name="check" />{done}</p>}
      {action && <Sheet action={action} role={role} onClose={() => setAction(null)} onSaved={(m) => { setDone(m); setAction(null); }} />}
    </>
  );
}
