import React, { useMemo, useState } from 'react';
import { Avatar, Button, Icon } from './ui.jsx';
import { loadProfiles, profileKey } from '../profilesStore.js';
import { loadAttendance, saveAttendance } from '../attendanceStore.js';
import { loadObjects, saveObjects } from '../objectsStore.js';
import { loadVisits, saveVisits } from '../careStore.js';
import { logActivity, ACTOR, DEMO_TODAY } from '../activityStore.js';
import { OBJECTS } from '../rules/discipline.js';
import { CARE_REASONS, CARE_OUTCOMES } from '../rules/care.js';
import { LATE_LIMIT } from '../rules/attendance.js';
import { findStudents } from '../rules/search.js';
import { realData } from '../demoData.js';

// Saisie express de la vie scolaire, debout, téléphone en main (au portail, dans la cour) :
// une action → l'élève (nom, prénom ou classe) → deux ou trois touches → c'est noté.
// Sur téléphone : barre fixée en bas de l'écran ; sur ordinateur : quatre gros boutons.
// Tout part dans les écrans habituels (absences et retards, objets confisqués, soins) et dans le journal.

const ACTIONS = [
  ['APPEL', 'Appel', 'check'], ['RESA', 'Réservation', 'calendar'],
  ['RETARD', 'Retard', 'clock'], ['ABSENCE', 'Absence', 'users'], ['OBJET', 'Confiscation', 'box'], ['SOIN', 'Soins', 'care'],
];
// raccourcis qui ouvrent un écran (au lieu d'une fiche de saisie)
const LINKS = { APPEL: 'appel', RESA: 'booking' };
const SLOTS = [['Matin', '07h00–12h00'], ['Après-midi', '13h00–17h00'], ['Journée', 'Journée']];
const MOTIFS = ['Utilisé en classe', 'Sonnerie en cours', 'Photo ou vidéo', 'Pendant un contrôle', 'Écouteurs en classe'];
const nowHm = () => new Date().toTimeString().slice(0, 5);
/** Minutes de retard : depuis le début de l'heure de cours (les cours commencent à l'heure pile). */
export const lateMinutes = (arrival) => { const [h, m] = arrival.split(':').map(Number); return h < 7 ? 0 : m; };

function Chips({ options, value, onChange, label }) {
  return (
    <div role="group" aria-label={label}>
      <p className="mb-1 text-xs font-semibold text-slate-600">{label}</p>
      <div className="flex flex-wrap gap-1.5">
      {options.map(([k, l]) => (
        <button key={k} type="button" aria-pressed={value === k} onClick={() => onChange(k)}
          className={`min-h-[40px] rounded-full px-3 text-sm font-medium ring-1 ${value === k ? 'bg-navy-500 text-white ring-navy-500' : 'bg-white text-slate-800 ring-slate-300'}`}>{l}</button>
      ))}
      </div>
    </div>
  );
}

function Sheet({ action, role, onClose, onSaved }) {
  const [query, setQuery] = useState('');
  const [student, setStudent] = useState(null);
  const [f, setF] = useState({ arrival: nowHm(), slot: 'Matin', object: 'Téléphone', reason: '', care: 'Mal de tête', outcome: 'CLASSE' });
  const [count, setCount] = useState(0); // saisies enregistrées en série
  const photoOf = useMemo(() => Object.fromEntries(loadProfiles().filter((p) => p.photo).map((p) => [profileKey(p), p.photo])), []);
  const minutes = lateMinutes(f.arrival);
  // la CPE prend en charge elle-même ou envoie au secrétariat (Doliprane) ; un professeur envoie toujours
  const [desk, setDesk] = useState(role === 'ENSEIGNANT');
  const sendsToDesk = role !== 'BUREAU' && desk;
  const matches = useMemo(() => findStudents(query), [query]);
  const who = ACTOR[role] ?? ACTOR.VIE_SCOLAIRE;
  const label = ACTIONS.find(([k]) => k === action)[1];
  const ready = student && (action !== 'OBJET' || f.reason.trim()) && (action !== 'RETARD' || minutes > 0);

  const save = (next = false) => {
    const t = nowHm(); const id = `${action.toLowerCase()}${Date.now()}`;
    let text = '';
    if (action === 'RETARD' || action === 'ABSENCE') {
      const slot = action === 'RETARD' ? `${f.arrival.replace(':', 'h')} (+${minutes} min)` : SLOTS.find(([k]) => k === f.slot)[1];
      saveAttendance([{ id, date: DEMO_TODAY, student: student.name, kind: action, slot, by: who, justified: false, notified: false, parentAck: null }, ...loadAttendance()]);
      text = action === 'RETARD' ? `Retard de ${minutes} min${minutes > LATE_LIMIT ? ' (compté absent pour l\'heure commencée)' : ''}` : `Absence (${f.slot.toLowerCase()})`;
    } else if (action === 'OBJET') {
      saveObjects([{ id, student: student.name, at: `${DEMO_TODAY}T${t}`, object: f.object, confiscatedBy: who, receivedBy: role === 'ENSEIGNANT' ? (realData() ? 'Vie scolaire' : 'M. Be (CPE)') : who, reason: f.reason.trim(), returned: null }, ...loadObjects()]);
      text = `${f.object} confisqué : ${f.reason.trim()} (durée à décider par la Direction ou le secrétariat)`;
    } else {
      // envoyé par la CPE : l'élève est « au secrétariat maintenant » jusqu'au « Retour en classe »
      saveVisits([{ id, at: `${DEMO_TODAY}T${t}`, student: student.name, reason: f.care, paracetamol: false, outcome: sendsToDesk ? null : f.outcome, by: who, ...(sendsToDesk ? { sentBy: who } : {}) }, ...loadVisits()]);
      text = sendsToDesk ? `Envoyé au secrétariat (soins) : ${f.care.toLowerCase()}` : `${role === 'VIE_SCOLAIRE' ? 'Pris en charge par la vie scolaire' : 'Soins au secrétariat'} : ${f.care.toLowerCase()} — ${CARE_OUTCOMES[f.outcome].toLowerCase()}`;
    }
    logActivity({ who, role, kind: { RETARD: 'ABSENCE', ABSENCE: 'ABSENCE', OBJET: 'OBJET', SOIN: 'SOIN' }[action], student: student.name, text });
    const msg = `${{ RETARD: 'Retard noté', ABSENCE: 'Absence notée', OBJET: 'Confiscation notée', SOIN: sendsToDesk ? 'Envoyé au secrétariat' : 'Soins notés' }[action]} pour ${student.name} (${student.cls}).${action === 'RETARD' || action === 'ABSENCE' ? ' Les parents seront prévenus avec les autres (Absences et retards).' : ''}`;
    if (next) { setCount(count + 1); setStudent(null); setQuery(''); setF({ ...f, arrival: nowHm(), reason: '' }); onSaved(msg, true); } else onSaved(msg);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 sm:items-center" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={`Saisie express : ${label}`} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-4 shadow-2xl sm:rounded-3xl">
        <div className="mb-3 flex items-center justify-between">
          <p className="font-display text-lg font-semibold text-navy-900">{action === 'SOIN' && sendsToDesk ? 'Envoyer au secrétariat (soins)' : label}{count > 0 && <span className="ml-2 text-xs font-normal text-emerald-700">{count} déjà noté{count > 1 ? 's' : ''}</span>}</p>
          <button type="button" onClick={onClose} aria-label="Fermer" className="rounded-full p-2 text-slate-500 hover:bg-slate-100"><Icon name="x" /></button>
        </div>
        {!student ? (
          <>
            <label className="block text-xs font-medium text-slate-600">Élève (nom, prénom ou classe)
              <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ex. Fitia, Rasoa, 1re STMG" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-base" />
            </label>
            <ul className="mt-2 divide-y divide-slate-100">
              {matches.map((s) => <li key={s.name}><button type="button" onClick={() => setStudent(s)} className="flex min-h-[44px] w-full items-center justify-between px-1 text-left text-sm"><span className="flex items-center gap-2 font-medium text-slate-900"><Avatar name={s.name} photo={photoOf[s.name]} className="h-8 w-8 text-[10px]" />{s.name}</span><span className="text-xs text-slate-600">{s.cls}</span></button></li>)}
              {query.trim() && !matches.length && <li className="py-2 text-sm text-slate-600">Aucun élève trouvé.</li>}
            </ul>
          </>
        ) : (
          <div className="space-y-3">
            <p className="flex items-center justify-between rounded-xl bg-navy-50 px-3 py-2 text-sm"><span className="flex items-center gap-2"><Avatar name={student.name} photo={photoOf[student.name]} className="h-12 w-12 text-xs" /><span><strong>{student.name}</strong> · {student.cls}</span></span><button type="button" onClick={() => setStudent(null)} className="text-xs font-medium text-navy-700">Changer</button></p>
            {action === 'RETARD' && <>
              <label className="flex items-center gap-3 text-sm text-slate-700">Arrivé·e à
                <input type="time" value={f.arrival} onChange={(e) => setF({ ...f, arrival: e.target.value })} className="rounded-xl border border-slate-300 px-3 py-2 text-base" />
                <strong className="text-navy-900">{minutes > 0 ? `${minutes} min de retard` : 'à l\'heure'}</strong>
              </label>
              {minutes > LATE_LIMIT && <p className="text-xs text-amber-800">Plus de {LATE_LIMIT} min : compté absent pour l'heure commencée, il entre à l'heure suivante.</p>}
            </>}
            {action === 'ABSENCE' && <Chips label="Créneau" value={f.slot} onChange={(slot) => setF({ ...f, slot })} options={SLOTS.map(([k]) => [k, k])} />}
            {action === 'OBJET' && <>
              <Chips label="1. Quel objet est confisqué ?" value={f.object} onChange={(object) => setF({ ...f, object })} options={OBJECTS.filter((o) => o !== 'Autre').map((o) => [o, o.replace(/ \(Puff\)/, '')])} />
              <Chips label="2. Pourquoi ? (motif)" value={f.reason} onChange={(reason) => setF({ ...f, reason })} options={MOTIFS.map((m) => [m, m])} />
              <input value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} placeholder="Ou un autre motif" aria-label="Motif" className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
            </>}
            {action === 'SOIN' && <>
              {role === 'VIE_SCOLAIRE' && <Chips label="Qui s'en occupe ?" value={desk ? 'DESK' : 'VS'} onChange={(v) => setDesk(v === 'DESK')} options={[['VS', 'La vie scolaire'], ['DESK', 'Envoyer au secrétariat (Doliprane)']]} />}
              <Chips label="Motif" value={f.care} onChange={(care) => setF({ ...f, care })} options={CARE_REASONS.map((r) => [r, r])} />
              {!sendsToDesk && <Chips label="Suite" value={f.outcome} onChange={(outcome) => setF({ ...f, outcome })} options={Object.entries(CARE_OUTCOMES).map(([k, l]) => [k, l.split(' (')[0].split(' :')[0]])} />}
              <p className="text-xs text-slate-600">{sendsToDesk ? 'Le secrétariat le voit aussitôt dans « Au secrétariat maintenant » et note le retour en classe.' : 'Un médicament (Doliprane…) : passez par l\'écran Soins, qui vérifie les allergies et la dernière prise.'}</p>
            </>}
            <div className="grid grid-cols-2 gap-2">
              <Button className="!py-3 text-base" disabled={!ready} onClick={() => save(false)}>Enregistrer</Button>
              <Button variant="secondary" className="!py-3 text-base" disabled={!ready} onClick={() => save(true)}>Enregistrer et suivant</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Quatre boutons (ordinateur) et barre fixée en bas (téléphone). */
// Enseignant : appel, réservation de matériel et confiscation en classe (l'objet est remis à la vie scolaire).
const ROLE_ACTIONS = { ENSEIGNANT: ['APPEL', 'RESA', 'OBJET'], BUREAU: ['SOIN', 'ABSENCE'], VIE_SCOLAIRE: ['RETARD', 'ABSENCE', 'OBJET', 'SOIN'] }; // secrétariat : soins et absences

export default function QuickEntry({ role = 'VIE_SCOLAIRE', go }) {
  const allowed = ACTIONS.filter(([k]) => !ROLE_ACTIONS[role] || ROLE_ACTIONS[role].includes(k));
  const [action, setAction] = useState(null);
  const [done, setDone] = useState('');
  const inline = role === 'ENSEIGNANT'; // l'enseignant a déjà sa barre en bas (Ma journée, Appel, Notes…)
  const buttons = (cls) => allowed.map(([k, l, icon]) => (
    <button key={k} type="button" data-quick={k} onClick={() => { if (LINKS[k]) { go?.(LINKS[k]); return; } setAction(k); setDone(''); }} className={cls}><Icon name={icon} className="h-5 w-5" />{l}</button>
  ));
  return (
    <>
      <section aria-label="Saisie express" className={`${inline ? '' : 'hidden sm:block'} rounded-2xl bg-white p-3 shadow-soft`}>
        <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-navy-700">Saisie express</p>
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${allowed.length}, minmax(0, 1fr))` }}>{buttons('flex min-h-[56px] items-center justify-center gap-2 rounded-xl bg-navy-50 text-sm font-semibold text-navy-900 hover:bg-navy-100')}</div>
      </section>
      {!inline && <nav aria-label="Saisie express" style={{ gridTemplateColumns: `repeat(${allowed.length}, minmax(0, 1fr))` }} className="fixed inset-x-0 bottom-0 z-40 grid border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] sm:hidden">
        {buttons('flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-[11px] font-semibold text-navy-900')}
      </nav>}
      {done && <p role="status" className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800"><Icon name="check" />{done}</p>}
      {action && <Sheet action={action} role={role} onClose={() => setAction(null)} onSaved={(m, keepOpen) => { setDone(m); if (!keepOpen) setAction(null); }} />}
    </>
  );
}
