import { couponsUsed, ABSENCE_COUPONS } from '../rules/attendance.js';
import React, { useState } from 'react';
import { Button } from './ui.jsx';
import { DocumentInput } from './PhotoInput.jsx';
import { JUSTIFY_REASONS, REASON_HINTS, PROOF_FROM_DAYS, absenceStreak, familyRequestErrors, justificationState, timeLeftLabel } from '../rules/attendance.js';
import { loadAttendance, saveAttendance } from '../attendanceStore.js';
import { formatDateFr } from '../rules/calendar.js';

// Justifier une absence ou un retard depuis le téléphone, en deux gestes : un motif, puis « Envoyer ».
// Un mot et la photo du justificatif sont facultatifs. Le compte à rebours des 24 h reste visible ;
// la demande envoyée à temps attend la vie scolaire (elle ne devient jamais « non justifiée » en attendant).

const fmt = (dt) => `${formatDateFr(dt.slice(0, 10)).replace(/ \d{4}$/, '')} à ${dt.slice(11, 16).replace(':', 'h')}`;

/** État de la justification, vu par la famille, et le formulaire tant qu'il est possible. */
export function JustifyAbsence({ absence, now, by, onDone, open: startOpen = false }) {
  const [open, setOpen] = useState(startOpen);
  const [draft, setDraft] = useState({ reason: '', note: '', photo: null });
  const [errors, setErrors] = useState([]);
  const st = justificationState(absence, now);
  const streak = absenceStreak(loadAttendance(), absence);
  const proofNeeded = streak >= PROOF_FROM_DAYS;
  if (st.status === 'JUSTIFIEE') return <p className="mt-1 text-xs font-medium text-emerald-700">✓ Justifiée{absence.request?.acceptedAt ? ' (acceptée par la vie scolaire)' : ''}</p>;
  if (st.status === 'EN_ATTENTE') return <p className="mt-1 text-xs text-navy-800">Justification envoyée le {fmt(absence.request.at)} ({absence.request.reason.toLowerCase()}) — la vie scolaire la regarde.</p>;
  if (st.status === 'NON_JUSTIFIEE') return <p className="mt-1 text-xs text-red-800">{absence.request?.refused ? `Justification refusée : ${absence.request.refused.why}. ` : ''}Non justifiée (délai de 24 h dépassé le {fmt(st.deadline)}).</p>;
  const send = () => {
    const req = { reason: draft.reason, note: draft.note.trim(), photo: draft.photo?.dataUrl ?? null, at: now, by };
    const e = familyRequestErrors(absence, req, now, { streak });
    setErrors(e); if (e.length) return;
    const list = loadAttendance().map((a) => (a.id === absence.id ? { ...a, request: req } : a));
    saveAttendance(list); setOpen(false); onDone?.();
  };
  return (
    <div className="mt-2">
      {absence.request?.refused && <p className="mb-1 text-xs text-red-800">Première justification refusée : {absence.request.refused.why}. Vous pouvez en envoyer une autre.</p>}
      {!open ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button className="!py-1.5 text-xs" onClick={() => setOpen(true)}>Justifier</Button>
          <span className="text-xs font-medium text-amber-800">{timeLeftLabel(absence, now)} (jusqu'au {fmt(st.deadline)})</span>
        </div>
      ) : (
        <div className="space-y-2 rounded-xl bg-slate-50 p-3">
          <p className="text-xs font-semibold text-slate-800">Motif <span className="font-normal text-amber-800">· {timeLeftLabel(absence, now)}</span></p>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Motif">
            {JUSTIFY_REASONS.map((r) => (
              <button key={r} type="button" aria-pressed={draft.reason === r} onClick={() => setDraft({ ...draft, reason: r })}
                className={`min-h-[36px] rounded-full px-3 text-xs font-medium ring-1 ${draft.reason === r ? 'bg-navy-500 text-white ring-navy-500' : 'bg-white text-slate-700 ring-slate-300'}`}>{r}</button>
            ))}
          </div>
          {draft.reason && <p className="text-[11px] text-slate-600">{draft.reason} : {REASON_HINTS[draft.reason]}</p>}
          {proofNeeded && <p className="rounded-md bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-900">Absence de {streak} jours d'affilée : justificatif obligatoire (certificat médical pour une maladie).</p>}
          <label className="block text-xs text-slate-600">Un mot pour la vie scolaire {draft.reason === 'Autre' ? '' : '(facultatif)'}
            <textarea rows={2} value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm" />
          </label>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <DocumentInput label={draft.photo ? 'Changer la photo' : proofNeeded ? 'Photo du justificatif (obligatoire)' : 'Photo du justificatif (facultatif)'} onAdd={(d) => setDraft({ ...draft, photo: d })} />
            {draft.photo && <span className="text-emerald-700">✓ {draft.photo.name}</span>}
          </div>
          {errors.length > 0 && <p role="alert" className="text-xs text-red-700">{errors.join(' ')}</p>}
          <div className="flex gap-2"><Button className="!py-1.5 text-xs" onClick={send}>Envoyer</Button><Button variant="secondary" className="!py-1.5 text-xs" onClick={() => setOpen(false)}>Annuler</Button></div>
        </div>
      )}
    </div>
  );
}

/** Accueil des parents : les absences de l'enfant à justifier maintenant, avec le compte à rebours. */
/** Coupons d'absence du passeport : 12 par an. */
export function CouponsLine({ student }) {
  const used = couponsUsed(loadAttendance(), student);
  return <p className={`mt-1 text-xs ${used >= ABSENCE_COUPONS ? 'font-semibold text-red-800' : 'text-amber-900'}`}>Coupons d'absence utilisés : {used} / {ABSENCE_COUPONS}{used >= ABSENCE_COUPONS ? ' — quota atteint : la vie scolaire délivre un ticket exceptionnel, et le régime de sortie peut être révisé.' : ''}</p>;
}

export function AbsencesToJustify({ student, childName, now, by, onDone }) {
  const list = loadAttendance().filter((a) => a.student === student && a.notified !== false && justificationState(a, now).status === 'A_JUSTIFIER');
  if (!list.length) return null;
  return (
    <div role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
      <p className="font-bold">{list.length > 1 ? `${list.length} absences ou retards` : list[0].kind === 'ABSENCE' ? 'Absence' : 'Retard'} à justifier — {childName}</p>
      <CouponsLine student={student} />
      {list.map((a) => (
        <div key={a.id} className="mt-2 border-t border-amber-200 pt-2 first:border-0 first:pt-0">
          <p>{formatDateFr(a.date).replace(/ \d{4}$/, '')} · {a.slot}</p>
          <JustifyAbsence absence={a} now={now} by={by} onDone={onDone} />
        </div>
      ))}
    </div>
  );
}
