import { withMockExams } from '../termGrades.js';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { loadCarnet, saveCarnet, carnetKey, remoteCarnetId } from '../gradebookStore.js';
import { ONLINE } from '../online/client.js';
import GradebookGuide from './GradebookGuide.jsx';
import { readStored, writeStored } from '../persist.js';
import { onSync, syncState } from '../online/docs.js';
import { currentRoster, servicesFor, shortName, nameParts, claimClass, takenFrom } from '../online/roster.js';
import { demoOr } from '../demoData.js';
import { Badge, Button, Card, Icon, StudentSelect } from './ui.jsx';
import { Annotated, RulePanel, GradeCell } from './gradeUi.jsx';
import { takeIntent, setIntent } from '../navIntent.js';
import { THEME_SUGGESTIONS, themeOf, saveTheme } from '../termThemeStore.js';
import {
  TERM, SERVICES, EVALUATIONS, GRADES, REMARKS, competenciesFor, historyFor, levelOf, TEACHER_COMPETENCIES, COUNCIL_FLAGS, CLASS_SUBJECTS, OTHER_AVERAGES,
} from '../data/grades.js';
import { NOTICE_GENERAL, NOTICE_EPS, minimumNoticeDue } from '../data/minimumNotice.js';
import { BONUS_ENABLED, isEps, minEvaluationsFor, studentAverage, notesCount, termValidation, classStats, generalAverage, fmtAvg, parentPublishOn, competencyProposals, bonusErrors } from '../rules/grading.js';
import { checkAppreciation, autoFix, rephrase } from '../rules/appreciation.js';
import { today } from '../clock.js';
import { askConfirm } from './Dialogs.jsx';
import { officialCompetencies } from '../data/officialCompetencies.js';
import { NOUVEAU } from '../essai.js';
import { TERMS, termById, termOfDate, termClosed } from '../rules/terms.js';

const inputCls = 'rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm';
const fmtDate = (iso) => iso.split('-').reverse().slice(0, 2).join('/');
const firstName = (full) => shortName(full).replace(/^\S+\.\s/, ''); // prénom d'usage
// nom complet dans la saisie (évite les erreurs entre homonymes) : NOM en capitales, puis tous les prénoms
function StudentName({ full }) {
  const { last, first } = nameParts(full);
  return <span className="leading-tight"><span className="uppercase">{last}</span> <span className="font-normal">{first}</span></span>;
}

/* ---------------- Création d'un devoir ---------------- */
const TODAY = today();
const ddmm = (iso) => iso.split('-').reverse().slice(0, 2).join('/');

function DateField({ label, value, onChange, min, max }) {
  return (
    <label className="block text-xs text-slate-600">{label}
      <div className="mt-1 flex gap-1">
        <input type="date" value={value} min={min} max={max} onChange={(e) => onChange(e.target.value)} className={`min-w-0 flex-1 ${inputCls}`} />
        <Button variant="secondary" className="!px-2 text-xs" onClick={() => onChange(TODAY)}>Aujourd'hui</Button>
      </div>
    </label>
  );
}

function EvaluationForm({ draft, setDraft, settings, competencies, onCreate, onCancel, range, onDelete }) {
  const outside = Boolean(range && draft.date && (draft.date < range.start || draft.date > range.stop));
  const set = (patch) => setDraft({ ...draft, ...patch });
  const delay = settings.grading.parentDelayDays;
  return (
    <div className="mb-4 space-y-3 rounded-lg border border-navy-200 bg-navy-50/60 p-4">
      <p className="text-sm font-semibold text-navy-900">Nouvelle évaluation</p>
      {NOUVEAU ? (<>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block text-xs text-slate-600">Type
            <select value={draft.type} onChange={(e) => set({ type: e.target.value })} className={`mt-1 w-full ${inputCls}`}>
              {settings.grading.evaluationTypes.map((t) => <option key={t}>{t}</option>)}
            </select>
          </label>
          <label className="block text-xs text-slate-600">Intitulé
            <input value={draft.title} onChange={(e) => set({ title: e.target.value })} placeholder="ex. DS n°2 — Le marketing" className={`mt-1 w-full ${inputCls}`} />
          </label>
          <DateField label="Date de l'évaluation" min={range?.start} max={range?.stop} value={draft.date} onChange={(v) => set({ date: v, publishOn: draft.publishOn && draft.publishOn > v ? draft.publishOn : v })} />
        </div>
        {outside && <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">Cette date n'est pas dans le {range.label} (du {fmtDate(range.start)} au {fmtDate(range.stop)}). Pour un devoir d'un autre trimestre, choisissez ce trimestre en haut de la page.</p>}
        <div className="grid grid-cols-2 gap-3 sm:max-w-sm">
          <label className="block text-xs text-slate-600">Notation sur
            <input type="number" min={1} max={100} value={draft.scale} onChange={(e) => set({ scale: Math.max(1, Number(e.target.value)) })} className={`mt-1 w-full ${inputCls}`} />
          </label>
          <label className="block text-xs text-slate-600">Coefficient
            <input type="number" min={0.5} max={10} step={0.5} value={draft.coef} onChange={(e) => set({ coef: Math.max(0.5, Number(e.target.value)) })} className={`mt-1 w-full ${inputCls}`} />
          </label>
        </div>
        <details className="rounded-lg bg-white/70 px-3 py-2">
          <summary className="cursor-pointer text-sm font-medium text-navy-700">Plus d'options (publication, remarques, commentaire, thèmes, compétences)</summary>
          <div className="mt-3 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <DateField label="Note publiée le" value={draft.publishOn} onChange={(v) => set({ publishOn: v })} />
            </div>
      {draft.publishOn && (
        <p className="rounded-md bg-white px-3 py-2 text-xs text-slate-600">
          Conformément au paramétrage de l'Espace Parents, la note sera publiée aux parents {delay} jour{delay > 1 ? 's' : ''} après
          la publication aux élèves, soit le <span className="font-semibold">{ddmm(parentPublishOn(draft, settings))}</span>.
        </p>
      )}
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={draft.remarksEnabled} onChange={(e) => set({ remarksEnabled: e.target.checked })} />
        Activer la saisie des remarques sur les notes (publiées aux parents et aux élèves)
      </label>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={draft.normalize} disabled={draft.scale === 20} onChange={(e) => set({ normalize: e.target.checked })} />
        Ramener sur 20 les notes de l'évaluation lors du calcul de la moyenne
        {draft.scale === 20 && <span className="text-xs text-slate-400">(déjà sur 20)</span>}
      </label>
      <label className="block text-xs text-slate-600">Commentaire, visible par les élèves <span className="text-slate-500">(facultatif)</span>
        <textarea spellCheck lang="fr" rows={2} value={draft.comment} onChange={(e) => set({ comment: e.target.value })} placeholder="Rédigez votre commentaire…" className={`mt-1 w-full ${inputCls}`} />
      </label>
      <label className="block text-xs text-slate-600">Thème(s) <span className="text-slate-500">(facultatif)</span>
        <input value={draft.themesText} onChange={(e) => set({ themesText: e.target.value })} placeholder="Séparez les thèmes par une virgule" className={`mt-1 w-full ${inputCls}`} />
      </label>
      <div>
        <p className="text-xs text-slate-600">Compétences évaluées dans cette évaluation <span className="text-slate-400">(facultatif)</span></p>
        {competencies.length === 0 ? <p className="mt-1 text-xs text-slate-400">Facultatif. Les compétences de la classe se renseignent dans l'onglet « Compétences du bulletin ».</p> : (
          <div className="mt-1 space-y-1">
            {competencies.map((c) => (
              <label key={c} className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={draft.competencies.includes(c)}
                  onChange={() => set({ competencies: draft.competencies.includes(c) ? draft.competencies.filter((x) => x !== c) : [...draft.competencies, c] })} />
                {c}
              </label>
            ))}
          </div>
        )}
      </div>
          </div>
        </details>
      </>) : (<>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs text-slate-600">Type
          <select value={draft.type} onChange={(e) => set({ type: e.target.value })} className={`mt-1 w-full ${inputCls}`}>
            {settings.grading.evaluationTypes.map((t) => <option key={t}>{t}</option>)}
          </select>
        </label>
        <label className="block text-xs text-slate-600">Intitulé
          <input value={draft.title} onChange={(e) => set({ title: e.target.value })} placeholder="ex. DS n°2 — Le marketing" className={`mt-1 w-full ${inputCls}`} />
        </label>
        <DateField label="Évaluation du" value={draft.date} onChange={(v) => set({ date: v })} />
        <DateField label="Note publiée le" value={draft.publishOn} onChange={(v) => set({ publishOn: v })} />
      </div>
      {draft.publishOn && (
        <p className="rounded-md bg-white px-3 py-2 text-xs text-slate-600">
          Conformément au paramétrage de l'Espace Parents, la note sera publiée aux parents {delay} jour{delay > 1 ? 's' : ''} après
          la publication aux élèves, soit le <span className="font-semibold">{ddmm(parentPublishOn(draft, settings))}</span>.
        </p>
      )}
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={draft.remarksEnabled} onChange={(e) => set({ remarksEnabled: e.target.checked })} />
        Activer la saisie des remarques sur les notes (publiées aux parents et aux élèves)
      </label>
      <div className="grid grid-cols-2 gap-3 sm:max-w-sm">
        <label className="block text-xs text-slate-600">Notation sur
          <input type="number" min={1} max={100} value={draft.scale} onChange={(e) => set({ scale: Math.max(1, Number(e.target.value)) })} className={`mt-1 w-full ${inputCls}`} />
        </label>
        <label className="block text-xs text-slate-600">Coefficient
          <input type="number" min={0.5} max={10} step={0.5} value={draft.coef} onChange={(e) => set({ coef: Math.max(0.5, Number(e.target.value)) })} className={`mt-1 w-full ${inputCls}`} />
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={draft.normalize} disabled={draft.scale === 20} onChange={(e) => set({ normalize: e.target.checked })} />
        Ramener sur 20 les notes de l'évaluation lors du calcul de la moyenne
        {draft.scale === 20 && <span className="text-xs text-slate-400">(déjà sur 20)</span>}
      </label>
      <label className="block text-xs text-slate-600">Commentaire, visible par les élèves <span className="text-slate-500">(facultatif)</span>
        <textarea spellCheck lang="fr" rows={2} value={draft.comment} onChange={(e) => set({ comment: e.target.value })} placeholder="Rédigez votre commentaire…" className={`mt-1 w-full ${inputCls}`} />
      </label>
      <label className="block text-xs text-slate-600">Thème(s) <span className="text-slate-500">(facultatif)</span>
        <input value={draft.themesText} onChange={(e) => set({ themesText: e.target.value })} placeholder="Séparez les thèmes par une virgule" className={`mt-1 w-full ${inputCls}`} />
      </label>
      <div>
        <p className="text-xs text-slate-600">Compétences évaluées dans cette évaluation <span className="text-slate-400">(facultatif)</span></p>
        {competencies.length === 0 ? <p className="mt-1 text-xs text-slate-400">Facultatif. Les compétences de la classe se renseignent dans l'onglet « Compétences du bulletin ».</p> : (
          <div className="mt-1 space-y-1">
            {competencies.map((c) => (
              <label key={c} className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={draft.competencies.includes(c)}
                  onChange={() => set({ competencies: draft.competencies.includes(c) ? draft.competencies.filter((x) => x !== c) : [...draft.competencies, c] })} />
                {c}
              </label>
            ))}
          </div>
        )}
      </div>
      </>)}
      <div className="flex gap-2">
        <Button disabled={!draft.title.trim() || !draft.date || !draft.publishOn || draft.publishOn < draft.date || outside} onClick={onCreate}>{draft.id ? 'Enregistrer les modifications' : 'Créer l\'évaluation'}</Button>
        <Button variant="ghost" onClick={onCancel}>Annuler</Button>
        {onDelete && <Button variant="ghost" className="ml-auto text-red-700" onClick={onDelete}>Supprimer ce devoir</Button>}
        {draft.publishOn && draft.publishOn < draft.date && <span className="self-center text-xs text-red-700">La publication ne peut précéder l'évaluation.</span>}
      </div>
    </div>
  );
}

/* ---------------- 2. Notes ---------------- */
/** Bonus / malus d'un élève sur UN devoir : petit bouton « ± » sous la note ; motif obligatoire. */
function BonusControl({ b, steps, readOnly, open, onOpen, onChange, label }) {
  const fmt = (v) => `${v > 0 ? '+' : ''}${String(v).replace('.', ',')}`;
  if (readOnly) return b?.points ? <p className="mt-0.5 text-[11px] text-slate-600" title={b.reason}>{fmt(b.points)} ({b.reason})</p> : null;
  return (
    <div className="mt-0.5">
      <button type="button" onClick={onOpen} aria-expanded={open} aria-label={`Bonus ou malus — ${label}`}
        className={`rounded px-1.5 py-0.5 text-[11px] ring-1 ${b?.points > 0 ? 'bg-emerald-50 text-emerald-800 ring-emerald-300' : b?.points < 0 ? 'bg-red-50 text-red-800 ring-red-300' : 'text-slate-500 ring-slate-200'}`}>
        {b?.points ? fmt(b.points) : '±'}</button>
      {open && (
        <div className="mt-1 w-36 space-y-1">
          <select value={b?.points ?? 0} onChange={(e) => onChange({ points: Number(e.target.value) })} aria-label={`Points — ${label}`} className="w-full rounded border border-slate-300 px-1 py-0.5 text-xs">
            {steps.map((v) => <option key={v} value={v}>{v === 0 ? 'Aucun' : fmt(v)}</option>)}
          </select>
          {Boolean(b?.points) && <input value={b?.reason ?? ''} onChange={(e) => onChange({ reason: e.target.value })} placeholder="Motif" aria-label={`Motif — ${label}`}
            className={`w-full rounded border px-1.5 py-0.5 text-[11px] ${(b?.reason ?? '').trim() ? 'border-slate-200' : 'border-red-300 bg-red-50'}`} />}
        </div>
      )}
    </div>
  );
}

function NotesStep({ service, evaluations, setEvaluations, grades, setGrades, remarks, setRemarks, bonus = {}, setBonus, validated, setValidated, settings, competencies = [], go, termDef = TERM, app = null }) {
  // app (site d'essai, « Tableau unique ») : appréciation et état sur la même ligne que les notes, comme le classeur Excel
  const min = minEvaluationsFor(service, settings.grading.minEvaluations); // EMC et matière partagée : 2
  const day = NOUVEAU && termDef.start ? (TODAY < termDef.start ? termDef.start : TODAY > termDef.stop ? termDef.stop : TODAY) : TODAY; // date proposée : dans le trimestre choisi
  const blank = {
    type: settings.grading.evaluationTypes[0], title: '', date: day, publishOn: TODAY < day ? day : TODAY, remarksEnabled: false,
    scale: settings.grading.defaultScale, coef: settings.grading.defaultCoef, normalize: true, comment: '', themesText: '', competencies: [],
  };
  const [draft, setDraft] = useState(null);
  // classe commune : le minimum se compte sur les devoirs des deux professeurs
  const other = service.common ? (service.otherCount ?? 0) : 0;
  const check = termValidation(evaluations, service.students, grades, Math.max(0, min - other));
  // DISP hors EPS : à remplacer par ABS ou NN avant de valider
  const dispOutsideEps = isEps(service) ? 0 : service.students.reduce((n, st) => n + evaluations.filter((ev) => /^\s*disp\s*$/i.test(grades[st]?.[ev.id] ?? '')).length, 0);
  const maxAdj = settings.grading.maxAdjustment ?? 2;
  const steps = Array.from({ length: maxAdj * 4 + 1 }, (_, i) => (i - maxAdj * 2) / 2); // -2 … +2 par demi-point
  const avgs = service.students.map((s) => studentAverage(evaluations, grades[s], BONUS_ENABLED ? bonus[s] : undefined));
  const adjErrors = BONUS_ENABLED ? service.students.flatMap((s) => [...new Set(bonusErrors(bonus[s], maxAdj))].map((e) => `${s} : ${e}`)) : [];
  const setAdj = (s, ev, v) => { setBonus({ ...bonus, [s]: { ...bonus[s], [ev]: { ...bonus[s]?.[ev], ...v } } }); setValidated(false); };
  const [openBonus, setOpenBonus] = useState(null); // « élève|devoir » dont le bonus / malus est ouvert
  const stats = classStats(avgs);
  const setCell = (s, ev, v) => { setGrades({ ...grades, [s]: { ...grades[s], [ev]: v } }); setValidated(false); };
  const removeEv = async (ev) => {
    const filled = service.students.filter((s) => grades[s]?.[ev.id]).length;
    if (!(await askConfirm(`Supprimer « ${ev.title} »${filled ? ` et ses ${filled} note${filled > 1 ? 's' : ''}` : ''} ?`))) return false;
    setEvaluations(evaluations.filter((x) => x.id !== ev.id));
    setGrades(Object.fromEntries(Object.entries(grades).map(([s, g]) => { const { [ev.id]: _, ...rest } = g ?? {}; return [s, rest]; })));
    setValidated(false); return true;
  };
  const editEv = (ev) => setDraft({ ...blank, ...ev, comment: ev.comment ?? '', themesText: (ev.themes ?? []).join(', '), competencies: ev.competencies ?? [] });
  // site d'essai : comme dans Pronote, le devoir le plus récent en premier (à côté des noms)
  const cols = NOUVEAU ? [...evaluations].sort((a, b) => String(b.date).localeCompare(String(a.date))) : evaluations;

  return (
    <div className={`grid gap-5 xl:items-start ${app ? '' : 'xl:grid-cols-[1fr_300px]'}`}>
      <Card
        title={`Notes — ${service.cls} · ${service.subject}`}
        subtitle={`${termDef.label} · ${evaluations.length} évaluation${evaluations.length > 1 ? 's' : ''} · moyennes sur 20, pondérées par les coefficients`}
        action={<span className="flex flex-wrap gap-2">
          {go && <Button variant="secondary" onClick={() => { setIntent('grade-sheets', { cls: service.cls, service: service.id }); go('grade-sheets'); }}>Imprimer / Excel</Button>}
          <Button variant="secondary" disabled={validated} onClick={() => setDraft(blank)}><span aria-hidden>＋</span> Nouvelle évaluation</Button>
        </span>}
      >
        {(NOUVEAU ? minimumNoticeDue({ count: evaluations.length + other, min, validated, date: TODAY, from: termDef.noticeFrom, stop: termDef.closeAt?.slice(0, 10) })
          : minimumNoticeDue({ count: evaluations.length + other, min, validated, date: TODAY, stop: TERM.stop })) && <MinimumNotice eps={isEps(service)} min={min} />}
        {draft && (
          <EvaluationForm draft={draft} setDraft={setDraft} settings={settings} competencies={competencies} onCancel={() => setDraft(null)} range={NOUVEAU && termDef.start ? termDef : null}
            onDelete={NOUVEAU && draft.id ? async () => { const ev = evaluations.find((x) => x.id === draft.id); if (ev && await removeEv(ev)) setDraft(null); } : null}
            onCreate={() => {
              const { themesText, ...ev } = draft;
              const clean = { ...ev, title: ev.title.trim(), comment: (ev.comment ?? '').trim() || null,
                themes: themesText.split(',').map((t) => t.trim()).filter(Boolean), normalize: ev.scale === 20 ? true : ev.normalize };
              // modification d'un devoir existant (les notes déjà saisies sont gardées) ou nouveau devoir
              setEvaluations(ev.id ? evaluations.map((x) => (x.id === ev.id ? clean : x)) : [...evaluations, { ...clean, id: `n${Date.now()}` }]);
              setDraft(null); setValidated(false);
            }} />
        )}
        {app && (() => {
          const ready = service.students.filter((s) => { const c = app.comments[app.keyOf(s)]; return c?.text?.trim() && !c.validated && app.check(c.text).ok; });
          const done = service.students.filter((s) => app.comments[app.keyOf(s)]?.validated).length;
          return (
            <p className="mb-3 flex flex-wrap items-center gap-2 text-xs text-slate-600">
              Appréciations : {done} / {service.students.length} validée{done > 1 ? 's' : ''} (2 phrases complètes au moins, 450 caractères au plus).
              {ready.length > 0 && <Button variant="secondary" className="!py-1 text-xs" onClick={() => app.setComments({ ...app.comments, ...Object.fromEntries(ready.map((s) => [app.keyOf(s), { ...app.comments[app.keyOf(s)], validated: true }])) })}>{ready.length > 1 ? `Valider les ${ready.length} conformes` : 'Valider celle qui est conforme'}</Button>}
            </p>
          );
        })()}
        {evaluations.length === 0 && !app ? (
          <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">Aucune note pour ce trimestre. Ajoutez une première évaluation (DS, oral, exposé…).</p>
        ) : (
          <div className="-mx-5 overflow-x-auto">
            <table data-grid className={`${!NOUVEAU || app ? 'w-full' : 'w-auto'} text-sm`} style={{ minWidth: NOUVEAU ? 370 + evaluations.length * 96 + (app ? 400 : 0) : 260 + evaluations.length * 130 }}>
              <thead>
                <tr className="border-y border-slate-100 bg-slate-50 text-left align-bottom text-xs text-slate-500">
                  <th className="sticky left-0 z-20 bg-slate-50 px-3 py-2 font-medium shadow-[2px_0_0_#e2e8f0]" style={NOUVEAU ? { width: 230 } : undefined}>{NOUVEAU ? `${service.students.length} élèves` : 'Élève'}</th>
                  {NOUVEAU && <th className="bg-slate-100 px-2 py-2 text-right font-medium" style={{ width: 64 }}>Moy.</th>}
                  {NOUVEAU && <th className="bg-slate-100 px-2 py-2 text-center font-medium" style={{ width: 56 }} title="Notes comptées / devoirs">Notes</th>}
                  {cols.map((ev) => NOUVEAU ? (
                    <th key={ev.id} className="border-l border-slate-200 px-1 py-2 text-center font-normal" style={{ width: 112, maxWidth: 112 }}>
                      <button type="button" disabled={validated || ev.fromMockExam} onClick={() => editEv(ev)} title={`${ev.title}${ev.fromMockExam ? '' : ' — cliquer pour modifier ou supprimer'}`}
                        className="w-full rounded px-1 py-0.5 hover:bg-white disabled:hover:bg-transparent">
                        <span className="block text-slate-600">{fmtDate(ev.date)}</span>
                        <span className="mx-auto mt-1 block w-fit rounded bg-navy-50 px-2 text-navy-700">{ev.type}</span>
                        <span className="mt-1 line-clamp-2 whitespace-normal break-words text-[11px] leading-tight text-slate-700">{ev.title}</span>
                        <span className="block text-[10px] text-slate-500">coef. {String(ev.coef).replace('.', ',')}{ev.scale !== 20 ? ` · /${ev.scale}` : ''}{(ev.publishOn ?? ev.date) > TODAY ? ` · publiée le ${ddmm(ev.publishOn)}` : ''}</span>
                      </button>
                    </th>
                  ) : (
                    <th key={ev.id} className="px-2 py-2 font-medium">
                      <Badge tone="navy">{ev.type}</Badge>
                      {ev.competencies?.length > 0 && (
                        <span className="ml-1 text-[10px] font-normal text-slate-500" title={ev.competencies.join(' · ')}>
                          {ev.competencies.map((c) => `C${competencies.indexOf(c) + 1}`).join(' ')}
                        </span>
                      )}
                      <p className="mt-1 max-w-[120px] truncate text-slate-700" title={ev.title}>{ev.title}</p>
                      {!validated && !ev.fromMockExam && (
                        <span className="mt-0.5 flex gap-2 text-[11px] font-normal">
                          <button type="button" className="text-navy-600 underline" onClick={() => setDraft({ ...blank, ...ev, comment: ev.comment ?? '', themesText: (ev.themes ?? []).join(', '), competencies: ev.competencies ?? [] })}>Modifier</button>
                          <button type="button" className="text-red-700 underline" onClick={() => removeEv(ev)}>Supprimer</button>
                        </span>
                      )}
                      <p className="font-normal">{fmtDate(ev.date)} · /{ev.scale}{ev.normalize === false ? ' (points)' : ''} · coef. {String(ev.coef).replace('.', ',')}</p>
                      <p className="font-normal text-[10px] text-slate-400" title={`Élèves le ${ddmm(ev.publishOn ?? ev.date)}, parents le ${ddmm(parentPublishOn(ev, settings))}`}>
                        {(ev.publishOn ?? ev.date) <= TODAY ? 'Publiée' : `Publiée le ${ddmm(ev.publishOn)}`}{ev.comment ? ' · 💬' : ''}{ev.remarksEnabled ? ' · remarques' : ''}
                      </p>
                    </th>
                  ))}
                  {!NOUVEAU && <th className="px-3 py-2 text-right font-medium">Moyenne /20</th>}
                  {app && <th className="px-2 py-2 font-medium">Appréciation du bulletin</th>}
                  {app && <th className="px-3 py-2 font-medium">État</th>}
                </tr>
              </thead>
              <tbody>
                {service.students.map((s, i) => {
                  const n = notesCount(evaluations, grades[s]);
                  return (
                    <tr key={s} className="border-b border-slate-100 align-top">
                      <td className="sticky left-0 z-20 bg-white px-3 py-2.5 font-medium text-slate-800 shadow-[2px_0_0_#e2e8f0]" title={s}>
                        <StudentName full={s} />
                        {!NOUVEAU && n < min && <p className="text-[11px] font-normal text-amber-700">{n} note{n > 1 ? 's' : ''} retenue{n > 1 ? 's' : ''}</p>}
                      </td>
                      {NOUVEAU && <td className="bg-slate-50 px-2 py-2.5 text-right font-semibold tabular-nums text-navy-900">{fmtAvg(avgs[i])}</td>}
                      {NOUVEAU && <td className={`bg-slate-50 px-2 py-2.5 text-center tabular-nums ${n < min ? 'text-amber-700' : 'text-slate-600'}`} title={n < min ? `Minimum : ${min} notes` : undefined}>{n}/{evaluations.length}</td>}
                      {cols.map((ev) => (
                        <td key={ev.id} className={NOUVEAU ? 'border-l border-slate-100 px-1 py-2' : 'px-2 py-2'} style={NOUVEAU ? { width: 112, maxWidth: 112 } : undefined}>
                          {validated ? <span className="tabular-nums">{grades[s]?.[ev.id] || '—'}</span>
                            : <GradeCell value={grades[s]?.[ev.id] ?? ''} max={ev.scale} allowDisp={isEps(service)} onChange={(v) => setCell(s, ev.id, v)} />}
                          {NOUVEAU && !validated && !grades[s]?.[ev.id] && arrivalOf(s) > ev.date && (
                            <button type="button" onClick={() => setCell(s, ev.id, 'NN')} title={`Inscrit le ${fmtDate(arrivalOf(s))}, après ce devoir : NN (non noté), sauf s'il l'a rattrapé`}
                              className="mt-1 block rounded bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-800 ring-1 ring-amber-200">NN ? (inscrit le {fmtDate(arrivalOf(s))})</button>
                          )}
                          {BONUS_ENABLED && <BonusControl b={bonus[s]?.[ev.id]} steps={steps} readOnly={validated} open={openBonus === `${s}|${ev.id}`} label={`${s} — ${ev.title || ev.type}`}
                            onOpen={() => setOpenBonus(openBonus === `${s}|${ev.id}` ? null : `${s}|${ev.id}`)} onChange={(v) => setAdj(s, ev.id, v)} />}
                          {ev.remarksEnabled && (
                            <input value={remarks[s]?.[ev.id] ?? ''} disabled={validated} aria-label={`Remarque — ${s}`}
                              onChange={(e) => setRemarks({ ...remarks, [s]: { ...remarks[s], [ev.id]: e.target.value } })}
                              placeholder="Remarque…" className="mt-1 w-28 rounded border border-slate-200 px-1.5 py-0.5 text-[11px]" />
                          )}
                        </td>
                      ))}
                      {!NOUVEAU && <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-navy-900">{fmtAvg(avgs[i])}</td>}
                      {app && (() => {
                        const c = app.comments[app.keyOf(s)] ?? { text: '', validated: false };
                        const r = c.text.trim() ? app.check(c.text) : null;
                        return (<>
                          <td className="px-2 py-2">
                            <textarea spellCheck lang="fr" rows={2} value={c.text} aria-label={`Appréciation — ${s}`}
                              onChange={(e) => app.setComments({ ...app.comments, [app.keyOf(s)]: { text: e.target.value, validated: false } })}
                              className="w-full min-w-[300px] resize-y rounded-lg border border-slate-300 px-2 py-1.5 text-sm leading-snug focus:outline-none focus:ring-2 focus:ring-navy-200" />
                            {r && !r.ok && <p className="mt-0.5 text-[11px] text-amber-800">À revoir : {r.errors[0]?.message}</p>}
                          </td>
                          <td className="px-3 py-2" style={{ width: 90 }}>
                            {c.validated ? <Badge tone="green">validée</Badge>
                              : r?.ok ? <Button variant="secondary" className="!px-2 !py-0.5 text-xs" onClick={() => app.setComments({ ...app.comments, [app.keyOf(s)]: { ...c, validated: true } })}>Valider</Button>
                              : <span className="text-xs text-slate-400">{c.text.trim() ? 'à revoir' : 'à écrire'}</span>}
                          </td>
                        </>);
                      })()}
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 text-xs text-slate-600">
                  <td className="sticky left-0 z-20 bg-slate-50 px-3 py-2 font-medium shadow-[2px_0_0_#e2e8f0]">Classe</td>
                  {NOUVEAU && <td className="bg-slate-100 px-2 py-2 text-right font-semibold tabular-nums">{fmtAvg(stats.avg)}</td>}
                  {NOUVEAU && <td className="bg-slate-100" />}
                  {cols.map((ev) => {
                    const st = classStats(service.students.map((s) => studentAverage([ev], grades[s], BONUS_ENABLED ? bonus[s] : undefined)));
                    return <td key={ev.id} className="px-2 py-2 tabular-nums">moy. {fmtAvg(st.avg)}<br />{fmtAvg(st.min)} – {fmtAvg(st.max)}</td>;
                  })}
                  {!NOUVEAU && <td className="px-3 py-2 text-right font-semibold tabular-nums">{fmtAvg(stats.avg)}</td>}
                  {app && <td colSpan={2} />}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        <p className="mt-3 text-xs text-slate-500">Saisie contrôlée : « 1O » → 10, « 12.5 » → 12,5 (Entrée pour accepter). Codes (non comptés dans la moyenne) : ABS = absent, DISP = dispensé (EPS seulement), NN = non noté (par exemple un élève inscrit tardivement, après la date du devoir ; il pourra le rattraper).</p>
      </Card>

      <Card title="Avant de valider le trimestre">
        {evaluations.length === 0 && !validated ? (
          <p className="text-sm text-slate-600">Quand les notes du trimestre seront saisies, vous les validerez ici. Minimum : {min} évaluations{other ? ` (avec celles de ${service.coTeachers.join(', ')})` : ''}.</p>
        ) : (<>
        {(() => {
          // étapes à faire en gris (pas en rouge) ; seul ce qui est à corriger est signalé en orange
          const Item = ({ done, warn, children }) => (
            <li className={`flex gap-2 ${done ? 'text-emerald-800' : warn ? 'text-amber-800' : 'text-slate-600'}`}>
              {done ? <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0" /> : <span aria-hidden className="mt-0.5 inline-block h-4 w-4 shrink-0 text-center leading-4">{warn ? '!' : '○'}</span>}<span>{children}</span>
            </li>
          );
          return (
            <ul className="space-y-2 text-sm">
              <Item done={!check.missing}>{evaluations.length + other} / {min} évaluations{other ? ` (dont ${other} chez ${service.coTeachers.join(', ')})` : ''}</Item>
              {check.pending.length > 0 && <Item warn>{check.pending.length} saisie(s) à corriger</Item>}
              <Item done={!check.empty.length}>{check.empty.length ? `${check.empty.length} case(s) encore vide(s)` : 'Toutes les cases sont remplies'}</Item>
              <Item done={competencies.length > 0}>{competencies.length ? `${competencies.length} compétence(s) pour le bulletin` : 'Compétences du bulletin (onglet « Compétences du bulletin »)'}</Item>
              {dispOutsideEps > 0 && <Item warn>{dispOutsideEps} « DISP » à remplacer par ABS ou NN (la dispense n'existe qu'en EPS)</Item>}
              {adjErrors.length > 0 && <Item warn>Bonus / malus : {adjErrors.join(' ')}</Item>}
              {check.below.length > 0 && <Item warn>Moins de {min} notes retenues : {check.below.map(firstName).join(', ')}. Signalé au conseil, non bloquant.</Item>}
            </ul>
          );
        })()}
        </>)}
        {validated ? (
          <div className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
            <p className="flex items-center gap-1.5 font-medium"><Icon name="check" />Notes validées</p>
            <p className="text-xs">Transmises à la grille du conseil de classe.</p>
            <Button variant="ghost" className="mt-1 !px-0" onClick={() => setValidated(false)}>Rouvrir la saisie</Button>
          </div>
        ) : evaluations.length > 0 && (
          <>
            <Button className="mt-4 w-full" disabled={!check.ok || adjErrors.length > 0 || !competencies.length || dispOutsideEps > 0} onClick={() => setValidated(true)}>Valider les notes du trimestre</Button>
          </>
        )}
        <p className="mt-3 text-xs text-slate-600">Arrêt des notes du {termDef.label} : <strong>{termDef.stopText ?? 'vendredi 27 novembre'}</strong> (même date pour toutes les classes).</p>
      </Card>
    </div>
  );
}

/* ---------------- 1. Compétences ---------------- */
// Base proposée par l'établissement (par matière et niveau) + compétences écrites par l'enseignant.
function CompetenciesStep({ service, settings, evaluations, mine, setMine, siblings = [], siblingComps = [], linked = true, setLinked }) {
  const base = competenciesFor(service, settings);
  const proposals = competencyProposals(base, mine);
  const [label, setLabel] = useState('');
  const names = siblings.map((x) => x.cls).join(', ');
  const other = siblingComps.find((x) => x.comps.length && x.comps.join('|') !== mine.join('|'));
  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_360px] xl:items-start">
      {siblings.length > 0 && (
        <div className="space-y-2 rounded-xl bg-navy-50 p-3 text-sm text-navy-900 xl:col-span-2">
          <label className="flex items-center gap-2"><input type="checkbox" checked={linked} onChange={(e) => setLinked?.(e.target.checked)} className="h-4 w-4" />
            Mêmes compétences en {names} : ce que vous écrivez ici s'y applique aussi.</label>
          {other && <Button variant="secondary" className="!py-1 text-xs" onClick={() => setMine([...new Set([...mine, ...other.comps])])}>Reprendre les {other.comps.length} compétence{other.comps.length > 1 ? 's' : ''} de {other.cls}</Button>}
        </div>
      )}
      <Card title={`Mes compétences — ${service.cls} · ${service.subject}`} subtitle="Ce qui a été travaillé ce trimestre, repris dans la colonne « Compétences » du bulletin (le détail reste dans le cahier de textes)">
        {mine.length === 0 && <p className="mb-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">Aucune compétence pour l'instant : reprenez les compétences de l'an dernier (à droite) ou écrivez les vôtres.</p>}
        <ol className="space-y-1.5">
          {mine.map((c, i) => {
            const n = evaluations.filter((ev) => ev.competencies?.includes(c)).length;
            return (
              <li key={i} className="flex items-center gap-2">
                <span className="w-6 text-right text-xs text-slate-400">C{i + 1}</span>
                <input value={c} onChange={(e) => setMine(mine.map((x, k) => (k === i ? e.target.value : x)))} className={`flex-1 ${inputCls}`} />
                <Badge tone={n ? 'green' : 'slate'}>{n ? `${n} évaluation${n > 1 ? 's' : ''}` : 'non évaluée'}</Badge>
                <button aria-label={`Retirer ${c}`} onClick={() => setMine(mine.filter((_, k) => k !== i))} className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"><Icon name="x" /></button>
              </li>
            );
          })}
        </ol>
        <div className="mt-3 flex gap-2">
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Écrire une compétence…" className={`flex-1 ${inputCls}`} />
          <Button variant="secondary" disabled={!label.trim()} onClick={() => { setMine([...mine, label.trim()]); setLabel(''); }}>Ajouter</Button>
        </div>
        <p className="mt-3 text-xs text-slate-500">Pas de bilan individuel par compétence : l'appréciation globale en tient lieu.</p>
      </Card>
      <Card title="Compétences proposées" subtitle={`${service.subject} · ${levelOf(service.cls)} — base de l'établissement et bulletins 2025-2026 ; cliquez « + » pour en reprendre une`}
        action={proposals.length > 1 && <Button variant="secondary" className="!py-1 text-xs" onClick={() => setMine([...mine, ...proposals])}>Tout reprendre</Button>}>
        {base.length === 0 ? <p className="text-sm text-slate-500">Pas de compétences de l'an dernier pour cette matière à ce niveau (matière nouvelle ou bulletin non transmis).</p>
          : proposals.length === 0 ? <p className="text-sm text-emerald-700">Toutes les compétences de l'an dernier sont reprises dans les vôtres.</p> : (
            <div className="space-y-4">
              {groupProposals(proposals, historyFor(service), officialCompetencies(service.subject, levelOf(service.cls))).map((g) => (
                <div key={g.label}>
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-slate-500">{g.label}</p>
                    {g.items.length > 1 && <button className="text-xs font-medium text-navy-700 hover:underline" onClick={() => setMine([...mine, ...g.items])}>Reprendre ce trimestre</button>}
                  </div>
                  <ul className="space-y-1">
                    {g.items.map((c) => (
                      <li key={c} className="flex items-start justify-between gap-2 rounded-lg px-2 py-1 text-sm hover:bg-slate-50">
                        <span className="text-slate-700">{c}</span>
                        <Button variant="ghost" className="shrink-0 !px-2 !py-0.5 text-xs" aria-label={`Reprendre : ${c}`} onClick={() => setMine([...mine, c])}>＋</Button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
      </Card>
    </div>
  );
}

// Regroupe les propositions par trimestre d'origine (avec l'enseignant qui les a écrites) ;
// celles ajoutées par la Direction vont dans « Autres propositions ».
function groupProposals(proposals, history, official = []) {
  const left = new Set(proposals);
  const groups = history.map((set, i) => {
    const items = set.items.filter((c) => left.has(c));
    items.forEach((c) => left.delete(c));
    return { label: `${history.length === 3 ? ['1er', '2e', '3e'][i] : `Bulletin n° ${i + 1} —`} trimestre 2025-2026${demoOr(` · ${set.teacher}`, '')}`.replace('— trimestre', '—'), items };
  }).filter((g) => g.items.length);
  const off = official.filter((c) => left.has(c)); off.forEach((c) => left.delete(c));
  if (off.length) groups.unshift({ label: 'Base de l\'établissement', items: off });
  if (left.size) groups.push({ label: 'Autres propositions', items: [...left] });
  return groups;
}

/** Parcours d'ouverture : thème du trimestre, choisi par le professeur (il peut changer chaque trimestre). */
function ThemePicker({ serviceId, fallback, termDef = TERM }) {
  const [theme, setTheme] = useState(() => themeOf(serviceId, termDef.id, fallback));
  const set = (t) => { setTheme(t); saveTheme(serviceId, termDef.id, t); };
  return (
    <div className="rounded-lg bg-violet-50 p-2 text-sm">
      <label className="block text-xs font-medium text-violet-900">Thème abordé ce trimestre ({termDef.label}) : il peut changer d'un trimestre à l'autre
        <input value={theme} onChange={(e) => set(e.target.value)} className="mt-1 w-full rounded-md border border-violet-200 bg-white px-2 py-1 text-sm" />
      </label>
      <div className="mt-1.5 flex flex-wrap gap-1">{THEME_SUGGESTIONS.map((t) => <button key={t} type="button" onClick={() => set(t)} className={`rounded-full px-2 py-0.5 text-xs ring-1 ${theme === t ? 'bg-violet-600 text-white ring-violet-600' : 'bg-white text-violet-900 ring-violet-200'}`}>{t}</button>)}</div>
    </div>
  );
}

function MinimumNotice({ eps, min = 4 }) {
  const base = eps ? NOTICE_EPS : NOTICE_GENERAL;
  const n = eps ? base : { ...base, intro: base.intro.replace('minimum réglementaire de 4 notes', `minimum de ${min} notes`) };
  return (
    <details open className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
      <summary className="cursor-pointer font-semibold">Message de l'administration : {eps ? '3 notes minimum en EPS' : `${min} notes minimum`}</summary>
      <div className="mt-2 space-y-2 leading-relaxed">
        <p>Chères collègues, chers collègues,</p>
        {n.intro.split('\n').map((p) => <p key={p}>{p}</p>)}
        <ul className="list-disc space-y-1 pl-5">{n.points.map(([t, d]) => <li key={t}><strong>{t}</strong> : {d}</li>)}</ul>
        {n.outro.map((p) => <p key={p}>{p}</p>)}
        <p>{n.closing}<br />L'Administration</p>
      </div>
    </details>
  );
}

/* ---------------- 3. Appréciations ---------------- */
function AppreciationsStep({ service, evaluations, grades, validated, settings, comments, setComments, flags, setFlags, go, termDef = TERM }) {
  const [student, setStudent] = useState(service.students[0]);

  const [aiNote, setAiNote] = useState(null);
  const appOnly = service.mode === 'APPRECIATION_SEULE';
  const key = `${service.id}:${student}`;
  const entry = comments[key] ?? { text: '', validated: false };
  const tutoiement = settings?.grading?.allowTutoiement !== false; // tutoiement accepté (choix de l'école)
  const result = useMemo(() => checkAppreciation(entry.text, { mode: service.mode, tutoiement }), [entry.text, service.mode, tutoiement]);
  const setText = (text) => { setComments({ ...comments, [key]: { text, validated: false } }); setAiNote(null); };

  const avg = studentAverage(evaluations, grades[student]);
  const classAvg = classStats(service.students.map((s) => studentAverage(evaluations, grades[s]))).avg;
  const subjectCode = CLASS_SUBJECTS.find((c) => c.service === service.id)?.id;
  const general = OTHER_AVERAGES[student] && generalAverage(CLASS_SUBJECTS.map((c) => ({
    ...c,
    inAverage: !settings.grading.excludedSubjects.includes(c.id),
    avg: c.id === subjectCode ? avg : c.service ? studentAverage(EVALUATIONS[c.service], GRADES[c.service][student]) : OTHER_AVERAGES[student][c.id],
  })));
  const myFlags = flags[key] ?? { ids: [], note: '' };
  const toggleFlag = (id) => setFlags({ ...flags, [key]: { ...myFlags, ids: myFlags.ids.includes(id) ? myFlags.ids.filter((x) => x !== id) : [...myFlags.ids, id] } });
  const statusOf = (s) => {
    const c = comments[`${service.id}:${s}`];
    if (c?.validated) return 'valid';
    if (!c?.text?.trim()) return 'empty';
    return checkAppreciation(c.text, { mode: service.mode, tutoiement }).ok ? 'ready' : 'error';
  };
  const blocked = !appOnly && !validated;

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_320px] xl:items-start">
      <div className="min-w-0 space-y-5">
      <Card>
        <StudentSelect
          label={`${service.cls} — ${service.students.filter((s) => statusOf(s) === 'valid').length} / ${service.students.length} appréciations validées`}
          students={service.students}
          value={student}
          format={shortName}
          onChange={(s) => { setStudent(s); setAiNote(null); }}
          suffix={(s) => ({ valid: '  ✓ validée', ready: '  · conforme', error: '  ⚠ à corriger', empty: '' }[statusOf(s)])}
        />
      </Card>
      <Card title={<StudentName full={student} />} subtitle={service.subject}
        action={go && <Button variant="secondary" className="!py-1 text-xs" onClick={() => { setIntent('messages', { to: `Parents de ${student} (${service.cls})` }); go('messages'); }}><Icon name="bell" />Écrire aux parents</Button>}>
        {appOnly ? (
          <div className="mb-3 space-y-2">
            <Badge tone="violet">Appréciation seule · sans note</Badge>
            <ThemePicker key={termDef.id} serviceId={service.id} termDef={termDef} fallback={service.subject.split(' — ')[1] ?? ''} />
          </div>
        ) : (
          <div className="mb-3 grid gap-2 sm:grid-cols-2">
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Moyenne en {service.subject}</p>
              <div className="mt-1 flex items-baseline gap-3 tabular-nums">
                <span className="text-xl font-semibold text-navy-900">{fmtAvg(avg)}</span>
                <span className="text-xs text-slate-500">classe {fmtAvg(classAvg)}</span>
              </div>
              <p className="mt-1 text-xs text-slate-500 tabular-nums">T1 {fmtAvg(avg)} · T2 — · T3 —</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Moyenne générale</p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-slate-800">{fmtAvg(general)}</p>
              <p className="mt-1 text-xs text-slate-500 tabular-nums">T1 {fmtAvg(general)} · T2 — · T3 — <span className="text-slate-400">(hors arts, musique, vie de classe)</span></p>
            </div>
          </div>
        )}
        {blocked && (
          <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">Les notes du trimestre ne sont pas encore validées : vous pouvez rédiger, la validation de l'appréciation sera possible ensuite.</p>
        )}
        <textarea spellCheck lang="fr" rows={6} value={entry.text} onChange={(e) => setText(e.target.value)} placeholder="Appréciation du trimestre (au moins deux phrases complètes, à la 3e personne)…"
          className={`w-full resize-y rounded-lg border px-3 py-2 text-sm leading-relaxed outline-none focus:ring-2 ${result.ok || (NOUVEAU && !entry.text.trim()) ? 'border-slate-300 focus:ring-navy-200' : 'border-red-300 focus:ring-red-200'}`} />
        {entry.text.trim() && (result.errors.length > 0 || result.warnings.length > 0) && (
          <div className="mt-2 rounded-lg bg-slate-50 p-3 text-sm leading-relaxed text-slate-700">
            <p className="mb-1 text-[11px] font-semibold text-slate-500">Aperçu annoté</p>
            <Annotated text={entry.text} issues={[...result.errors, ...result.warnings]} />
          </div>
        )}
        {aiNote && <p className="mt-2 flex items-center gap-1.5 text-xs text-violet-700"><Icon name="sparkles" />{aiNote}</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          {/* l'enseignant écrit ; l'outil ne fait que reformuler son texte (jamais de texte inventé) */}
          <Button variant="secondary" disabled={!entry.text.trim() || rephrase(entry.text, firstName(student)) === entry.text.trim()} onClick={() => { setText(rephrase(entry.text, firstName(student))); setAiNote('Texte reformulé (3e personne, impératifs, ponctuation). Relisez avant de valider.'); }}>
            <Icon name="sparkles" className="h-4 w-4 text-violet-600" />Reformuler mon texte</Button>
          <Button variant="secondary" title="Espaces en trop, majuscule au début, point final" disabled={!entry.text.trim() || autoFix(entry.text) === entry.text.trim()} onClick={() => setText(autoFix(entry.text))}>Corriger la ponctuation</Button>
          <Button className="ml-auto" disabled={!result.ok || entry.validated || blocked}
            onClick={() => setComments({ ...comments, [key]: { ...entry, validated: true } })}>
            <Icon name="check" />{entry.validated ? 'Validée' : 'Valider l\'appréciation'}
          </Button>
        </div>
        {!entry.validated && !blocked && !result.ok && <p className="mt-1.5 text-right text-xs text-red-800">Pas encore possible : {entry.text.trim() ? 'corrigez ce qui est souligné en rouge ci-dessus' : 'écrivez d\'abord l\'appréciation'}.</p>}

        <div className="mt-5 rounded-lg border border-dashed border-slate-300 p-3">
          <p className="text-xs font-semibold text-slate-500">Pour le conseil de classe — non imprimé sur le bulletin</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {COUNCIL_FLAGS.map((f) => {
              const on = myFlags.ids.includes(f.id);
              return (
                <button key={f.id} type="button" aria-pressed={on} onClick={() => toggleFlag(f.id)}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${on ? { green: 'bg-emerald-600 text-white ring-emerald-600', amber: 'bg-amber-400 text-slate-900 ring-amber-500', red: 'bg-red-600 text-white ring-red-600' }[f.tone] : 'text-slate-600 ring-slate-300 hover:bg-slate-50'}`}>
                  {f.label}
                </button>
              );
            })}
          </div>
          <textarea rows={2} value={myFlags.note} onChange={(e) => setFlags({ ...flags, [key]: { ...myFlags, note: e.target.value } })}
            placeholder="Remarque pour le conseil (utile si vous êtes absent.e ce jour-là)…" className="mt-2 w-full rounded-md border border-slate-300 p-2 text-sm" />
        </div>
      </Card>

      </div>
      <Card title="Contrôleur de rédaction" subtitle="Règles de l'établissement, vérifiées à chaque frappe" className="xl:sticky xl:top-6">
        {NOUVEAU && !entry.text.trim() ? <p className="text-sm text-slate-600">Commencez à écrire : les règles de rédaction (2 phrases au moins, 450 caractères au plus, pas de formule décourageante) se vérifient ici au fil de la frappe.</p> : <RulePanel result={result} />}
      </Card>
    </div>
  );
}

/* ---------------- Vue « tableau unique » (site d'essai) : appréciations de toute la classe ---------------- */

/* ---------------- Module ---------------- */
function AppreciationsTable({ service, evaluations, grades, settings, comments, setComments }) {
  const tutoiement = settings?.grading?.allowTutoiement !== false;
  const keyOf = (s) => `${service.id}:${s}`;
  const check = (t) => checkAppreciation(t, { mode: service.mode, tutoiement });
  const ready = service.students.filter((s) => { const c = comments[keyOf(s)]; return c?.text?.trim() && !c.validated && check(c.text).ok; });
  const done = service.students.filter((s) => comments[keyOf(s)]?.validated).length;
  return (
    <Card title={`Appréciations — ${done} / ${service.students.length} validée${done > 1 ? 's' : ''}`}
      subtitle="Au moins 2 phrases complètes, 450 caractères au plus. « Valider » quand le texte est prêt ; les remarques pour le conseil se notent dans « Élève par élève »."
      action={ready.length > 0 && <Button variant="secondary" className="!py-1 text-xs" onClick={() => setComments({ ...comments, ...Object.fromEntries(ready.map((s) => [keyOf(s), { ...comments[keyOf(s)], validated: true }])) })}>Valider les {ready.length} conformes</Button>}>
      <div className="-mx-5 overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead><tr className="border-b border-slate-200 text-left text-xs text-slate-500"><th className="px-4 py-2">Élève</th><th className="px-2 py-2 text-center" title="Notes comptées / devoirs">Notes</th><th className="px-2 py-2 text-right">Moy.</th><th className="px-2 py-2">Appréciation</th><th className="px-4 py-2">État</th></tr></thead>
          <tbody>
            {service.students.map((s) => {
              const c = comments[keyOf(s)] ?? { text: '', validated: false };
              const r = c.text.trim() ? check(c.text) : null;
              const avg = studentAverage(evaluations, grades[s]);
              return (
                <tr key={s} className="border-b border-slate-100 align-top">
                  <td className="px-4 py-2 font-medium text-slate-800" style={{ width: 230 }} title={s}><StudentName full={s} /></td>
                  <td className="px-2 py-2 text-center tabular-nums text-slate-600">{notesCount(evaluations, grades[s])}/{evaluations.length}</td>
                  <td className="px-2 py-2 text-right font-semibold tabular-nums text-navy-900">{fmtAvg(avg)}</td>
                  <td className="px-2 py-2">
                    <textarea spellCheck lang="fr" rows={2} value={c.text} aria-label={`Appréciation — ${s}`}
                      onChange={(e) => setComments({ ...comments, [keyOf(s)]: { text: e.target.value, validated: false } })}
                      className="w-full min-w-[260px] resize-y rounded-lg border border-slate-300 px-2 py-1.5 text-sm leading-snug focus:outline-none focus:ring-2 focus:ring-navy-200" />
                    {r && !r.ok && <p className="mt-0.5 text-[11px] text-amber-800">À revoir : {r.errors[0]?.message}</p>}
                  </td>
                  <td className="px-4 py-2">
                    {c.validated ? <Badge tone="green">validée</Badge>
                      : r?.ok ? <Button variant="secondary" className="!px-2 !py-0.5 text-xs" onClick={() => setComments({ ...comments, [keyOf(s)]: { ...c, validated: true } })}>Valider</Button>
                      : <span className="text-xs text-slate-400">{c.text.trim() ? 'à revoir' : 'à écrire'}</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

const STEPS = [['notes', '1. Notes'], ['appreciations', '2. Appréciations'], ['competences', '3. Compétences du bulletin']]; // obligatoires pour le bulletin ; par devoir, facultatives


// En ligne : les services du professeur connecté, publiés par la Direction (classes × matières de sa fiche)
const myServices = () => (ONLINE ? servicesFor(currentRoster(), remoteCarnetId()) : SERVICES);
// date d'arrivée d'un élève arrivé en cours d'année (liste envoyée par la Direction), sinon ''
const arrivalOf = (name) => (currentRoster()?.students ?? []).find((x) => `${x.lastName} ${x.firstName}`.trim() === name)?.arrivedOn ?? '';
const hm = (d) => `${String(d.getHours()).padStart(2, '0')} h ${String(d.getMinutes()).padStart(2, '0')}`;

/** État de l'envoi au serveur, toujours visible : le professeur sait que ses notes sont arrivées. */
function SyncLine() {
  const key = carnetKey(remoteCarnetId());
  const [st, setSt] = useState(() => syncState(key));
  useEffect(() => onSync((k, s) => { if (k === key) setSt({ ...s }); }), [key]);
  if (!st) return <p className="text-xs text-slate-500" role="status">Chaque note est envoyée au serveur dès qu'elle est saisie.</p>;
  if (st.status === 'saved') return <p className="text-xs font-medium text-emerald-700" role="status">✓ Enregistré sur le serveur à {hm(st.at)}</p>;
  if (st.status === 'pending') return <p className="text-xs text-slate-600" role="status">Envoi en cours…</p>;
  return <p className="text-xs font-medium text-amber-800" role="status">Pas de connexion : vos notes sont gardées sur cet appareil et partiront automatiquement (ne videz pas le navigateur).</p>;
}

export default function GradebookModule({ settings, go, role }) {
  const SERVICES = useMemo(myServices, []);
  const [guide, setGuide] = useState(() => role === 'ENSEIGNANT' && !readStored('ent-k-guide-notes-vu')); // première ouverture (professeurs)
  const closeGuide = () => { writeStored('ent-k-guide-notes-vu', true); setGuide(false); };
  const [serviceId, setServiceId] = useState(() => { const i = takeIntent('grades'); return SERVICES.find((x) => x.cls === i?.cls && x.subject === i?.subject)?.id ?? SERVICES.find((x) => x.cls === i?.cls)?.id ?? SERVICES[0]?.id; });
  const [step, setStep] = useState('notes');
  // site d'essai : tout sur une page (« Tableau unique », comme le classeur Excel) ou élève par élève (étapes)
  const [appView, setAppViewState] = useState(() => readStored('ent-k-vue-appreciations') ?? 'classe');
  const setAppView = (v) => { writeStored('ent-k-vue-appreciations', v); setAppViewState(v); };
  // carnet enregistré (saisies précédentes) ; sinon exemples de démonstration, ou vide avec les vraies données
  const [saved] = useState(loadCarnet);
  const [mock] = useState(() => withMockExams(saved?.evaluations ?? demoOr(EVALUATIONS, {}), saved?.grades ?? demoOr(GRADES, {})));
  const [evaluations, setEvaluations] = useState(mock.ev);
  const [grades, setGrades] = useState(mock.gr);
  const [remarks, setRemarks] = useState(saved?.remarks ?? demoOr(REMARKS, {}));
  const [myComps, setMyComps] = useState(saved?.myComps ?? demoOr(TEACHER_COMPETENCIES, {}));
  const [validated, setValidated] = useState(saved?.validated ?? {});
  const [comments, setComments] = useState(saved?.comments ?? {});
  const [adjust] = useState(saved?.adjust ?? {}); // ancien bonus sur la moyenne (n'est plus utilisé, gardé tel quel)
  const [unlinked, setUnlinked] = useState(saved?.unlinked ?? {}); // compétences propres à une classe (sinon partagées 1re STMG / 1re G…)
  const [bonus, setBonus] = useState(saved?.bonus ?? {}); // bonus / malus par devoir : service → élève → devoir
  const [flags, setFlags] = useState(saved?.flags ?? demoOr({ 's1:RAJAONARIVELO Tsiry': { ids: ['BAVARD'], note: '' } }, {}));
  // trimestres suivants : appréciations, compétences, validations et remarques du conseil dans byTerm (le 1er reste à la racine)
  const [byTerm, setByTerm] = useState(saved?.byTerm ?? {});
  // saisie fermée (professeurs) : après la date de fermeture, sauf si la Direction a rouvert (liste des classes, reopen)
  const lockedFor = (id) => NOUVEAU && role === 'ENSEIGNANT' && termClosed(id, new Date(), currentRoster()?.reopen, remoteCarnetId());
  // trimestre affiché : le 1er tant que sa saisie est ouverte (le conseil approche), sinon celui du jour
  const [term, setTerm] = useState(() => (!NOUVEAU ? TERMS[0].id : lockedFor(TERMS[0].id) || TODAY > TERMS[0].closeAt.slice(0, 10) ? termOfDate(TODAY) : TERMS[0].id));
  const termDef = NOUVEAU ? termById(term) : TERM;
  const locked = lockedFor(term);
  const inTerm = (e) => !NOUVEAU || termOfDate(e.date) === term;
  const ofTerm = (field, root, setRoot) => (!NOUVEAU || term === TERMS[0].id ? [root, setRoot]
    : [byTerm[term]?.[field] ?? {}, (v) => setByTerm((b) => ({ ...b, [term]: { ...(b[term] ?? {}), [field]: v } }))]);
  const [tComments, setTComments] = ofTerm('comments', comments, setComments);
  const [tComps, setTComps] = ofTerm('myComps', myComps, setMyComps);
  const [tValidated, setTValidated] = ofTerm('validated', validated, setValidated);
  const [tFlags, setTFlags] = ofTerm('flags', flags, setFlags);
  // chaque saisie est enregistrée tout de suite : on remplit les notes au fil du trimestre
  const [savedOk, setSavedOk] = useState(null);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    setSavedOk(saveCarnet({ ...(loadCarnet() ?? {}), evaluations, grades, remarks, myComps, validated, comments, flags, adjust, bonus, unlinked, byTerm }));
    // classes à deux professeurs : nombre de devoirs (classe commune) et premier qui écrit l'appréciation, lus par l'autre
    if (ONLINE) SERVICES.forEach((sv) => {
      if (sv.common) claimClass(remoteCarnetId(), sv.id, 'COUNT', (evaluations[sv.id] ?? []).filter(inTerm).length);
      if ((sv.shared || sv.common) && !sv.writer && sv.students.some((st) => (tComments[`${sv.id}:${st}`]?.text ?? '').trim())) claimClass(remoteCarnetId(), sv.id, 'APP');
    });
  }, [evaluations, grades, remarks, myComps, validated, comments, flags, adjust, bonus, unlinked, byTerm]);

  const service = SERVICES.find((s) => s.id === serviceId);
  const taken = ONLINE ? takenFrom(currentRoster(), remoteCarnetId()) : [];
  if (!service) return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold text-navy-900">Notes et appréciations</h1>
      <Card><p className="text-sm text-slate-700">Aucune classe ne vous est encore attribuée. La Direction doit compléter votre fiche (matières et classes) puis envoyer les classes en ligne. Prévenez-la.</p></Card>
    </div>
  );
  const appOnly = service.mode === 'APPRECIATION_SEULE';
  // même matière, même année (Tle STMG et Tle Générale, 1re STMG et 1re Générale) : mêmes compétences
  const yearOf = (cls) => levelOf(cls).split(' ')[0];
  const siblings = SERVICES.filter((x) => x.id !== service.id && x.subject === service.subject && yearOf(x.cls) === yearOf(service.cls));
  // matière partagée dont l'appréciation est écrite par l'autre professeur : pas d'étape « Appréciations »
  const noApp = Boolean(service.noAppreciation);
  const currentStep = appOnly ? 'appreciations' : noApp && step === 'appreciations' ? 'notes' : step;
  const props = {
    service, settings,
    termDef,
    evaluations: (evaluations[serviceId] ?? []).filter(inTerm),
    setEvaluations: (v) => setEvaluations({ ...evaluations, [serviceId]: [...(evaluations[serviceId] ?? []).filter((e) => !inTerm(e)), ...v] }),
    grades: grades[serviceId] ?? {}, setGrades: (v) => setGrades({ ...grades, [serviceId]: v }),
    validated: Boolean(tValidated[serviceId]), setValidated: (v) => setTValidated({ ...tValidated, [serviceId]: v }),
    remarks: remarks[serviceId] ?? {}, setRemarks: (v) => setRemarks({ ...remarks, [serviceId]: v }),
    bonus: bonus[serviceId] ?? {}, setBonus: (v) => setBonus({ ...bonus, [serviceId]: v }),
  };
  const stepDone = {
    notes: Boolean(tValidated[serviceId]),
    competences: (tComps[serviceId]?.length ?? 0) > 0,
    appreciations: noApp || service.students.every((s) => tComments[`${serviceId}:${s}`]?.validated),
  };

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-semibold text-navy-500">{termDef.label}{termDef.council ? ` · conseil de classe le ${termDef.council}` : ''}</p>
        <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold text-navy-900">Notes et appréciations
          <button type="button" onClick={() => setGuide(true)} className="rounded-full px-2.5 py-1 font-sans text-xs font-medium text-navy-700 ring-1 ring-navy-200">Comment ça marche ?</button></h1>
        {guide && <GradebookGuide onClose={closeGuide} />}
        {ONLINE ? <SyncLine /> : <p className={`text-xs ${savedOk === false ? 'font-medium text-red-700' : 'text-slate-500'}`} role="status">
          {savedOk === false ? 'Ce navigateur refuse l\'enregistrement : vos dernières saisies seront perdues au rechargement.'
            : savedOk ? '✓ Enregistré automatiquement — revenez ajouter vos notes quand vous voulez.'
            : 'Chaque note est enregistrée dès qu\'elle est saisie : remplissez au fil du trimestre, évaluation après évaluation.'}
        </p>}
      </div>
      {NOUVEAU && (
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs font-medium text-slate-600">Classe et matière
            <select value={serviceId} onChange={(e) => setServiceId(e.target.value)} className={`mt-1 block min-w-[260px] ${inputCls}`}>
              {SERVICES.map((s) => <option key={s.id} value={s.id}>{s.cls} — {s.subject}{tValidated[s.id] ? ' (validées)' : ''}</option>)}
            </select>
          </label>
          <label className="text-xs font-medium text-slate-600">Période
            <select value={term} onChange={(e) => setTerm(e.target.value)} className={`mt-1 block ${inputCls}`}>
              {TERMS.filter((t) => t.start <= TODAY).map((t) => <option key={t.id} value={t.id}>{t.label}{lockedFor(t.id) ? ' (fermé)' : ''}</option>)}
            </select>
          </label>
        </div>
      )}
      {!NOUVEAU && <div className="flex gap-2 overflow-x-auto pb-1">
        {SERVICES.map((s) => {
          const ok = tValidated[s.id];
          return (
            <button key={s.id} onClick={() => setServiceId(s.id)}
              className={`nav-control shrink-0 rounded-lg border px-3 py-2 text-left text-sm ${s.id === serviceId ? 'border-navy-500 bg-navy-50 ring-1 ring-navy-500' : 'border-slate-200 bg-white hover:border-navy-200'}`}>
              <span className="block font-medium text-slate-900">{s.cls}</span>
              <span className="block text-xs text-slate-500">{s.subject}{ok ? ' · notes validées' : ''}</span>
            </button>
          );
        })}
      </div>}
      {NOUVEAU && (
        <div className="space-y-2">
          {locked ? <p role="status" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Saisie du {termDef.label} fermée depuis le {termDef.closeText} : vous pouvez consulter, plus modifier. Pour une correction, demandez à la Direction de rouvrir votre saisie.</p>
            : termDef.closeAt && TODAY <= termDef.closeAt.slice(0, 10) ? <p className="rounded-xl bg-navy-50 p-3 text-sm text-navy-900">Arrêt des notes : <strong>{termDef.stopText}</strong> (un devoir daté après compte pour le trimestre suivant) · saisie ouverte jusqu'au <strong>{termDef.closeText}</strong>.</p>
            : null}
        </div>
      )}
      {NOUVEAU && !appOnly && (<>
        {/* site d'essai : trois onglets — les notes au fil de l'année, l'appréciation du bulletin, les compétences du bulletin */}
        <div className="flex flex-wrap gap-1 border-b border-slate-200" role="tablist">
          {[['notes', 'Notes'], ...(noApp ? [] : [['appreciations', 'Appréciations du bulletin']]), ['competences', 'Compétences du bulletin']].map(([id, l]) => (
            <button key={id} type="button" role="tab" aria-selected={currentStep === id} onClick={() => setStep(id)}
              className={`-mb-px flex items-center gap-1.5 border-b-2 px-4 py-2 text-sm font-medium ${currentStep === id ? 'border-navy-500 text-navy-900' : 'border-transparent text-slate-600 hover:text-navy-700'}`}>
              {stepDone[id] && <Icon name="check" className="h-3.5 w-3.5 text-emerald-600" />}{l}
            </button>
          ))}
        </div>
          {currentStep === 'appreciations' && <div className="flex flex-wrap items-center gap-2 text-sm">
            {[['classe', 'Toute la classe'], ['eleve', 'Élève par élève (avec les remarques pour le conseil)']].map(([id, l]) => (
              <button key={id} type="button" aria-pressed={appView === id} onClick={() => setAppView(id)}
                className={`rounded-full px-3 py-1 font-medium ${appView === id ? 'bg-navy-500 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200'}`}>{l}</button>
            ))}
          </div>}
      </>)}
      <fieldset disabled={locked} className="min-w-0 space-y-5">
      {taken.length > 0 && (
        <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          {taken.map((x) => <p key={`${x.cls}|${x.subject}`}>ℹ {x.cls} · {x.subject} : <strong>{x.byName}</strong> a commencé la saisie des notes. Cette classe ne figure plus dans votre carnet (un seul professeur par classe).</p>)}
        </div>
      )}
      {service.shared && (
        <div className="rounded-xl bg-violet-50 p-3 text-sm text-violet-900">
          {service.writer
            ? <p>{service.noAppreciation ? <>Matière partagée avec {service.coTeachers.join(', ')} : l'appréciation du bulletin est écrite par <strong>{service.writerName}</strong>. Vous saisissez vos notes (2 minimum) et les compétences.</> : <>Matière partagée avec {service.coTeachers.join(', ')} : <strong>c'est vous qui écrivez l'appréciation</strong> du bulletin, pour les deux parties.</>}</p>
            : <p>Matière partagée avec <strong>{service.coTeachers.join(', ')}</strong> : moyenne 50/50 et une seule appréciation sur le bulletin. Le premier qui écrit une appréciation l'écrit pour les deux.</p>}
        </div>
      )}
      {service.common && (() => {
        const mine = (evaluations[serviceId] ?? []).filter(inTerm).length; const total = mine + (service.otherCount ?? 0);
        const need = minEvaluationsFor(service, settings.grading.minEvaluations); const left = Math.max(0, need - total);
        return (
          <div className="rounded-xl bg-violet-50 p-3 text-sm text-violet-900">
            <p><strong>Classe commune avec {service.coTeachers.join(', ')}</strong> : chacun saisit ses évaluations ; une seule moyenne sur le bulletin, calculée sur toutes les évaluations.</p>
            <p className="mt-1 font-medium">{total} / {need} notes : vous {mine}, {service.coTeachers.join(', ')} {service.otherCount ?? 0}{left ? ` — il manque encore ${left} note${left > 1 ? 's' : ''}` : ' — minimum atteint ✓'}</p>
            <p className="mt-1 text-xs">{service.writer ? (service.noAppreciation ? `Appréciation du bulletin : écrite par ${service.writerName}.` : 'Appréciation du bulletin : c\'est vous qui l\'écrivez, pour les deux.') : 'Une seule appréciation sur le bulletin : le premier qui l\'écrit l\'écrit pour les deux.'}</p>
          </div>
        );
      })()}
      {NOUVEAU && !appOnly && (<>
        {currentStep === 'notes' && <NotesStep {...props} go={go} competencies={tComps[serviceId] ?? []} />}
        {currentStep === 'appreciations' && (<>
          {appView === 'classe' ? <AppreciationsTable {...props} comments={tComments} setComments={setTComments} />
            : <AppreciationsStep {...props} go={go} comments={tComments} setComments={setTComments} flags={tFlags} setFlags={setTFlags} />}
        </>)}
        {currentStep === 'competences' && <CompetenciesStep service={service} settings={settings} evaluations={props.evaluations} mine={tComps[serviceId] ?? []}
          siblings={siblings} siblingComps={siblings.map((x) => ({ ...x, comps: tComps[x.id] ?? [] }))} linked={!unlinked[serviceId]}
          setLinked={(on) => setUnlinked({ ...unlinked, [serviceId]: !on })}
          setMine={(v) => setTComps({ ...tComps, [serviceId]: v, ...(unlinked[serviceId] ? {} : Object.fromEntries(siblings.map((x) => [x.id, v]))) })} />}
      </>)}
      {!appOnly && !NOUVEAU && (
        <div className="flex gap-1 rounded-lg bg-slate-100 p-1" role="tablist">
          {STEPS.filter(([id]) => !(noApp && id === 'appreciations')).map(([id, label]) => (
            <button key={id} role="tab" aria-selected={step === id} onClick={() => setStep(id)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium ${step === id ? 'bg-white text-navy-900 shadow-sm' : 'text-slate-600'}`}>
              {stepDone[id] && <Icon name="check" className="h-3.5 w-3.5 text-emerald-600" />}{label}
            </button>
          ))}
        </div>
      )}
      {!(NOUVEAU && !appOnly) && currentStep === 'notes' && <NotesStep {...props} go={go} competencies={tComps[serviceId] ?? []} />}
      {!(NOUVEAU && !appOnly) && currentStep === 'competences' && <CompetenciesStep service={service} settings={settings} evaluations={props.evaluations} mine={tComps[serviceId] ?? []}
        siblings={siblings} siblingComps={siblings.map((x) => ({ ...x, comps: tComps[x.id] ?? [] }))} linked={!unlinked[serviceId]}
        setLinked={(on) => setUnlinked({ ...unlinked, [serviceId]: !on })}
        setMine={(v) => setTComps({ ...tComps, [serviceId]: v, ...(unlinked[serviceId] ? {} : Object.fromEntries(siblings.map((x) => [x.id, v]))) })} />}
      {!(NOUVEAU && !appOnly) && currentStep === 'appreciations' && <AppreciationsStep {...props} go={go} comments={tComments} setComments={setTComments} flags={tFlags} setFlags={setTFlags} />}
      </fieldset>
    </div>
  );
}
