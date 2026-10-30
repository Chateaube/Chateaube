import { withMockExams } from '../termGrades.js';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { loadCarnet, saveCarnet } from '../gradebookStore.js';
import { demoOr } from '../demoData.js';
import { Badge, Button, Card, Icon, StudentSelect } from './ui.jsx';
import { Annotated, RulePanel, GradeCell } from './gradeUi.jsx';
import { takeIntent, setIntent } from '../navIntent.js';
import { THEME_SUGGESTIONS, themeOf, saveTheme } from '../termThemeStore.js';
import {
  TERM, SERVICES, EVALUATIONS, GRADES, REMARKS, competenciesFor, historyFor, levelOf, TEACHER_COMPETENCIES, COUNCIL_FLAGS, CLASS_SUBJECTS, OTHER_AVERAGES,
} from '../data/grades.js';
import { studentAverage, notesCount, termValidation, classStats, generalAverage, fmtAvg, parentPublishOn, competencyProposals } from '../rules/grading.js';
import { checkAppreciation, autoFix, rephrase } from '../rules/appreciation.js';

const inputCls = 'rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm';
const fmtDate = (iso) => iso.split('-').reverse().slice(0, 2).join('/');
const firstName = (full) => full.split(' ').slice(1).join(' ');

/* ---------------- Création d'un devoir ---------------- */
const TODAY = '2026-10-13';
const ddmm = (iso) => iso.split('-').reverse().slice(0, 2).join('/');

function DateField({ label, value, onChange }) {
  return (
    <label className="block text-xs text-slate-600">{label}
      <div className="mt-1 flex gap-1">
        <input type="date" value={value} onChange={(e) => onChange(e.target.value)} className={`min-w-0 flex-1 ${inputCls}`} />
        <Button variant="secondary" className="!px-2 text-xs" onClick={() => onChange(TODAY)}>Aujourd'hui</Button>
      </div>
    </label>
  );
}

function EvaluationForm({ draft, setDraft, settings, competencies, onCreate, onCancel }) {
  const set = (patch) => setDraft({ ...draft, ...patch });
  const delay = settings.grading.parentDelayDays;
  return (
    <div className="mb-4 space-y-3 rounded-lg border border-navy-200 bg-navy-50/60 p-4">
      <p className="text-sm font-semibold text-navy-900">Nouveau devoir</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs text-slate-600">Type
          <select value={draft.type} onChange={(e) => set({ type: e.target.value })} className={`mt-1 w-full ${inputCls}`}>
            {settings.grading.evaluationTypes.map((t) => <option key={t}>{t}</option>)}
          </select>
        </label>
        <label className="block text-xs text-slate-600">Intitulé
          <input value={draft.title} onChange={(e) => set({ title: e.target.value })} placeholder="ex. DS n°2 — Le marketing" className={`mt-1 w-full ${inputCls}`} />
        </label>
        <DateField label="Devoir du" value={draft.date} onChange={(v) => set({ date: v })} />
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
        Ramener sur 20 les notes du devoir lors du calcul de la moyenne
        {draft.scale === 20 && <span className="text-xs text-slate-400">(déjà sur 20)</span>}
      </label>
      <label className="block text-xs text-slate-600">Commentaire, visible par les élèves <span className="text-slate-500">(facultatif)</span>
        <textarea rows={2} value={draft.comment} onChange={(e) => set({ comment: e.target.value })} placeholder="Rédigez votre commentaire…" className={`mt-1 w-full ${inputCls}`} />
      </label>
      <label className="block text-xs text-slate-600">Thème(s) <span className="text-slate-500">(facultatif)</span>
        <input value={draft.themesText} onChange={(e) => set({ themesText: e.target.value })} placeholder="Séparez les thèmes par une virgule" className={`mt-1 w-full ${inputCls}`} />
      </label>
      <div>
        <p className="text-xs text-slate-600">Compétences évaluées <span className="text-slate-400">(vos compétences pour cette classe)</span></p>
        {competencies.length === 0 ? <p className="mt-1 text-xs text-slate-400">Aucune compétence : définissez-les à l'étape « 1. Compétences ».</p> : (
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
      <div className="flex gap-2">
        <Button disabled={!draft.title.trim() || !draft.date || !draft.publishOn || draft.publishOn < draft.date} onClick={onCreate}>Créer le devoir</Button>
        <Button variant="ghost" onClick={onCancel}>Annuler</Button>
        {draft.publishOn && draft.publishOn < draft.date && <span className="self-center text-xs text-red-700">La publication ne peut précéder le devoir.</span>}
      </div>
    </div>
  );
}

/* ---------------- 2. Notes ---------------- */
function NotesStep({ service, evaluations, setEvaluations, grades, setGrades, remarks, setRemarks, validated, setValidated, settings, competencies = [], go }) {
  const min = settings.grading.minEvaluations;
  const blank = {
    type: settings.grading.evaluationTypes[0], title: '', date: TODAY, publishOn: TODAY, remarksEnabled: false,
    scale: settings.grading.defaultScale, coef: settings.grading.defaultCoef, normalize: true, comment: '', themesText: '', competencies: [],
  };
  const [draft, setDraft] = useState(null);
  const check = termValidation(evaluations, service.students, grades, min);
  const avgs = service.students.map((s) => studentAverage(evaluations, grades[s]));
  const stats = classStats(avgs);
  const setCell = (s, ev, v) => { setGrades({ ...grades, [s]: { ...grades[s], [ev]: v } }); setValidated(false); };

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_300px] xl:items-start">
      <Card
        title={`Notes — ${service.cls} · ${service.subject}`}
        subtitle={`${TERM.label} · ${evaluations.length} devoir${evaluations.length > 1 ? 's' : ''} · moyennes sur 20, pondérées par les coefficients`}
        action={<span className="flex flex-wrap gap-2">
          {go && <Button variant="secondary" onClick={() => { setIntent('grade-sheets', { cls: service.cls, service: service.id }); go('grade-sheets'); }}>Imprimer / Excel</Button>}
          <Button variant="secondary" disabled={validated} onClick={() => setDraft(blank)}><span aria-hidden>＋</span> Nouveau devoir</Button>
        </span>}
      >
        {draft && (
          <EvaluationForm draft={draft} setDraft={setDraft} settings={settings} competencies={competencies} onCancel={() => setDraft(null)}
            onCreate={() => {
              const { themesText, ...ev } = draft;
              setEvaluations([...evaluations, { ...ev, id: `n${Date.now()}`, title: ev.title.trim(), comment: ev.comment.trim() || null,
                themes: themesText.split(',').map((t) => t.trim()).filter(Boolean), normalize: ev.scale === 20 ? true : ev.normalize }]);
              setDraft(null); setValidated(false);
            }} />
        )}
        {evaluations.length === 0 ? (
          <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">Aucune note pour ce trimestre. Ajoutez une première évaluation (DS, oral, exposé…).</p>
        ) : (
          <div className="-mx-5 overflow-x-auto">
            <table data-grid className="w-full text-sm" style={{ minWidth: 260 + evaluations.length * 130 }}>
              <thead>
                <tr className="border-y border-slate-100 bg-slate-50 text-left align-bottom text-xs text-slate-500">
                  <th className="sticky left-0 bg-slate-50 px-4 py-2 font-medium">Élève</th>
                  {evaluations.map((ev) => (
                    <th key={ev.id} className="px-2 py-2 font-medium">
                      <Badge tone="navy">{ev.type}</Badge>
                      {ev.competencies?.length > 0 && (
                        <span className="ml-1 text-[10px] font-normal text-slate-500" title={ev.competencies.join(' · ')}>
                          {ev.competencies.map((c) => `C${competencies.indexOf(c) + 1}`).join(' ')}
                        </span>
                      )}
                      <p className="mt-1 max-w-[120px] truncate text-slate-700" title={ev.title}>{ev.title}</p>
                      <p className="font-normal">{fmtDate(ev.date)} · /{ev.scale}{ev.normalize === false ? ' (points)' : ''} · coef. {String(ev.coef).replace('.', ',')}</p>
                      <p className="font-normal text-[10px] text-slate-400" title={`Élèves le ${ddmm(ev.publishOn ?? ev.date)}, parents le ${ddmm(parentPublishOn(ev, settings))}`}>
                        {(ev.publishOn ?? ev.date) <= TODAY ? 'Publiée' : `Publiée le ${ddmm(ev.publishOn)}`}{ev.comment ? ' · 💬' : ''}{ev.remarksEnabled ? ' · remarques' : ''}
                      </p>
                    </th>
                  ))}
                  <th className="px-3 py-2 text-right font-medium">Moyenne /20</th>
                </tr>
              </thead>
              <tbody>
                {service.students.map((s, i) => {
                  const n = notesCount(evaluations, grades[s]);
                  return (
                    <tr key={s} className="border-b border-slate-100 align-top">
                      <td className="sticky left-0 bg-white px-4 py-2.5 font-medium text-slate-800">
                        {s}
                        {n < min && <p className="text-[11px] font-normal text-amber-700">{n} note{n > 1 ? 's' : ''} retenue{n > 1 ? 's' : ''}</p>}
                      </td>
                      {evaluations.map((ev) => (
                        <td key={ev.id} className="px-2 py-2">
                          {validated ? <span className="tabular-nums">{grades[s]?.[ev.id] || '—'}</span>
                            : <GradeCell value={grades[s]?.[ev.id] ?? ''} max={ev.scale} onChange={(v) => setCell(s, ev.id, v)} />}
                          {ev.remarksEnabled && (
                            <input value={remarks[s]?.[ev.id] ?? ''} disabled={validated} aria-label={`Remarque — ${s}`}
                              onChange={(e) => setRemarks({ ...remarks, [s]: { ...remarks[s], [ev.id]: e.target.value } })}
                              placeholder="Remarque…" className="mt-1 w-28 rounded border border-slate-200 px-1.5 py-0.5 text-[11px]" />
                          )}
                        </td>
                      ))}
                      <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-navy-900">{fmtAvg(avgs[i])}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 text-xs text-slate-600">
                  <td className="sticky left-0 bg-slate-50 px-4 py-2 font-medium">Classe</td>
                  {evaluations.map((ev) => {
                    const st = classStats(service.students.map((s) => studentAverage([ev], grades[s])));
                    return <td key={ev.id} className="px-2 py-2 tabular-nums">moy. {fmtAvg(st.avg)}<br />{fmtAvg(st.min)} – {fmtAvg(st.max)}</td>;
                  })}
                  <td className="px-3 py-2 text-right font-semibold tabular-nums">{fmtAvg(stats.avg)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        <p className="mt-3 text-xs text-slate-500">Saisie contrôlée : « 1O » → 10, « 12.5 » → 12,5 (Entrée pour accepter). Codes : ABS, DISP, NN (non comptés).</p>
      </Card>

      <Card title="Validation du trimestre">
        <ul className="space-y-2 text-sm">
          <li className={`flex gap-2 ${check.missing ? 'text-red-800' : 'text-emerald-800'}`}>
            <Icon name={check.missing ? 'x' : 'check'} className="mt-0.5 h-4 w-4 shrink-0" />
            {evaluations.length} / {min} évaluations minimum{check.missing ? ` — il en manque ${check.missing}` : ''}
          </li>
          <li className={`flex gap-2 ${check.pending.length ? 'text-red-800' : 'text-emerald-800'}`}>
            <Icon name={check.pending.length ? 'x' : 'check'} className="mt-0.5 h-4 w-4 shrink-0" />
            {check.pending.length ? `${check.pending.length} saisie(s) à corriger` : 'Aucune saisie à corriger'}
          </li>
          <li className={`flex gap-2 ${check.empty.length ? 'text-red-800' : 'text-emerald-800'}`}>
            <Icon name={check.empty.length ? 'x' : 'check'} className="mt-0.5 h-4 w-4 shrink-0" />
            {check.empty.length ? `${check.empty.length} case(s) vide(s) : saisir une note ou ABS / DISP / NN` : 'Toutes les cases sont remplies'}
          </li>
          {check.below.length > 0 && (
            <li className="flex gap-2 text-amber-800">
              <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Moins de {min} notes retenues (absences, dispenses) : {check.below.map(firstName).join(', ')}. Signalé au conseil, non bloquant.</span>
            </li>
          )}
        </ul>
        {validated ? (
          <div className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
            <p className="flex items-center gap-1.5 font-medium"><Icon name="check" />Notes validées</p>
            <p className="text-xs">Transmises à la grille du conseil de classe.</p>
            <Button variant="ghost" className="mt-1 !px-0" onClick={() => setValidated(false)}>Rouvrir la saisie</Button>
          </div>
        ) : (
          <>
            <Button className="mt-4 w-full" disabled={!check.ok} onClick={() => setValidated(true)}>Valider les notes du trimestre</Button>
            {!check.ok && <p className="mt-1.5 text-xs text-red-800">Pas encore possible : {[check.missing && `il manque ${check.missing} évaluation${check.missing > 1 ? 's' : ''}`, check.pending.length && `${check.pending.length} saisie(s) à corriger`, check.empty.length && `${check.empty.length} case(s) vide(s)`].filter(Boolean).join(', ')}.</p>}
          </>
        )}
        <p className="mt-3 text-xs text-slate-600">Arrêt des notes du 1er trimestre : <strong>vendredi 27 novembre</strong> (même date pour toutes les classes).</p>
      </Card>
    </div>
  );
}

/* ---------------- 1. Compétences ---------------- */
// Base proposée par l'établissement (par matière et niveau) + compétences écrites par l'enseignant.
function CompetenciesStep({ service, settings, evaluations, mine, setMine }) {
  const base = competenciesFor(service, settings);
  const proposals = competencyProposals(base, mine);
  const [label, setLabel] = useState('');
  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_360px] xl:items-start">
      <Card title={`Mes compétences — ${service.cls} · ${service.subject}`} subtitle="Celles que vous évaluez dans vos devoirs ; modifiables à tout moment">
        {mine.length === 0 && <p className="mb-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">Aucune compétence pour l'instant : reprenez la base proposée ou écrivez les vôtres.</p>}
        <ol className="space-y-1.5">
          {mine.map((c, i) => {
            const n = evaluations.filter((ev) => ev.competencies?.includes(c)).length;
            return (
              <li key={i} className="flex items-center gap-2">
                <span className="w-6 text-right text-xs text-slate-400">C{i + 1}</span>
                <input value={c} onChange={(e) => setMine(mine.map((x, k) => (k === i ? e.target.value : x)))} className={`flex-1 ${inputCls}`} />
                <Badge tone={n ? 'green' : 'slate'}>{n ? `${n} devoir${n > 1 ? 's' : ''}` : 'non évaluée'}</Badge>
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
      <Card title="Base proposée par l'établissement" subtitle={`${service.subject} · ${levelOf(service.cls)} — compétences des trimestres précédents`}
        action={proposals.length > 1 && <Button variant="secondary" className="!py-1 text-xs" onClick={() => setMine([...mine, ...proposals])}>Tout reprendre</Button>}>
        {base.length === 0 ? <p className="text-sm text-slate-500">Pas de base proposée pour cette matière à ce niveau.</p>
          : proposals.length === 0 ? <p className="text-sm text-emerald-700">Toute la base est reprise dans vos compétences.</p> : (
            <div className="space-y-4">
              {groupProposals(proposals, historyFor(service)).map((g) => (
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
function groupProposals(proposals, history) {
  const left = new Set(proposals);
  const groups = history.map((set, i) => {
    const items = set.items.filter((c) => left.has(c));
    items.forEach((c) => left.delete(c));
    return { label: `Trimestre précédent ${history.length > 1 ? `n° ${i + 1} ` : ''}· ${set.teacher}`, items };
  }).filter((g) => g.items.length);
  if (left.size) groups.push({ label: 'Autres propositions', items: [...left] });
  return groups;
}

/** Parcours d'ouverture : thème du trimestre, choisi par le professeur (il peut changer chaque trimestre). */
function ThemePicker({ serviceId, fallback }) {
  const [theme, setTheme] = useState(() => themeOf(serviceId, TERM.id, fallback));
  const set = (t) => { setTheme(t); saveTheme(serviceId, TERM.id, t); };
  return (
    <div className="rounded-lg bg-violet-50 p-2 text-sm">
      <label className="block text-xs font-medium text-violet-900">Thème abordé ce trimestre ({TERM.label}) : il peut changer d'un trimestre à l'autre
        <input value={theme} onChange={(e) => set(e.target.value)} className="mt-1 w-full rounded-md border border-violet-200 bg-white px-2 py-1 text-sm" />
      </label>
      <div className="mt-1.5 flex flex-wrap gap-1">{THEME_SUGGESTIONS.map((t) => <button key={t} type="button" onClick={() => set(t)} className={`rounded-full px-2 py-0.5 text-xs ring-1 ${theme === t ? 'bg-violet-600 text-white ring-violet-600' : 'bg-white text-violet-900 ring-violet-200'}`}>{t}</button>)}</div>
    </div>
  );
}

/* ---------------- 3. Appréciations ---------------- */
function AppreciationsStep({ service, evaluations, grades, validated, settings, comments, setComments, flags, setFlags, go }) {
  const [student, setStudent] = useState(service.students[0]);

  const [aiNote, setAiNote] = useState(null);
  const appOnly = service.mode === 'APPRECIATION_SEULE';
  const key = `${service.id}:${student}`;
  const entry = comments[key] ?? { text: '', validated: false };
  const tutoiement = !!settings?.grading?.allowTutoiement;
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
          onChange={(s) => { setStudent(s); setAiNote(null); }}
          suffix={(s) => ({ valid: '  ✓ validée', ready: '  · conforme', error: '  ⚠ à corriger', empty: '' }[statusOf(s)])}
        />
      </Card>
      <Card title={student} subtitle={service.subject}
        action={go && <Button variant="secondary" className="!py-1 text-xs" onClick={() => { setIntent('messages', { to: `Parents de ${student} (${service.cls})` }); go('messages'); }}><Icon name="bell" />Écrire aux parents</Button>}>
        {appOnly ? (
          <div className="mb-3 space-y-2">
            <Badge tone="violet">Appréciation seule · sans note</Badge>
            <ThemePicker serviceId={service.id} fallback={service.subject.split(' — ')[1] ?? ''} />
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
        <textarea rows={6} value={entry.text} onChange={(e) => setText(e.target.value)} placeholder="Appréciation du trimestre (au moins deux phrases complètes, à la 3e personne)…"
          className={`w-full resize-y rounded-lg border px-3 py-2 text-sm leading-relaxed outline-none focus:ring-2 ${result.ok ? 'border-slate-300 focus:ring-navy-200' : 'border-red-300 focus:ring-red-200'}`} />
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
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${on ? { green: 'bg-emerald-600 text-white ring-emerald-600', amber: 'bg-amber-500 text-white ring-amber-500', red: 'bg-red-600 text-white ring-red-600' }[f.tone] : 'text-slate-600 ring-slate-300 hover:bg-slate-50'}`}>
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
        <RulePanel result={result} />
      </Card>
    </div>
  );
}

/* ---------------- Module ---------------- */
const STEPS = [['competences', '1. Compétences'], ['notes', '2. Notes'], ['appreciations', '3. Appréciations']];


export default function GradebookModule({ settings, go }) {
  const [serviceId, setServiceId] = useState(() => { const i = takeIntent('grades'); return SERVICES.find((x) => x.cls === i?.cls && x.subject === i?.subject)?.id ?? SERVICES.find((x) => x.cls === i?.cls)?.id ?? 's1'; });
  const [step, setStep] = useState('notes');
  // carnet enregistré (saisies précédentes) ; sinon exemples de démonstration, ou vide avec les vraies données
  const [saved] = useState(loadCarnet);
  const [mock] = useState(() => withMockExams(saved?.evaluations ?? demoOr(EVALUATIONS, {}), saved?.grades ?? demoOr(GRADES, {})));
  const [evaluations, setEvaluations] = useState(mock.ev);
  const [grades, setGrades] = useState(mock.gr);
  const [remarks, setRemarks] = useState(saved?.remarks ?? demoOr(REMARKS, {}));
  const [myComps, setMyComps] = useState(saved?.myComps ?? TEACHER_COMPETENCIES);
  const [validated, setValidated] = useState(saved?.validated ?? {});
  const [comments, setComments] = useState(saved?.comments ?? {});
  const [flags, setFlags] = useState(saved?.flags ?? demoOr({ 's1:RAJAONARIVELO Tsiry': { ids: ['BAVARD'], note: '' } }, {}));
  // chaque saisie est enregistrée tout de suite : on remplit les notes au fil du trimestre
  const [savedOk, setSavedOk] = useState(null);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    setSavedOk(saveCarnet({ evaluations, grades, remarks, myComps, validated, comments, flags }));
  }, [evaluations, grades, remarks, myComps, validated, comments, flags]);

  const service = SERVICES.find((s) => s.id === serviceId);
  const appOnly = service.mode === 'APPRECIATION_SEULE';
  const currentStep = appOnly ? 'appreciations' : step;
  const props = {
    service, settings,
    evaluations: evaluations[serviceId] ?? [], setEvaluations: (v) => setEvaluations({ ...evaluations, [serviceId]: v }),
    grades: grades[serviceId] ?? {}, setGrades: (v) => setGrades({ ...grades, [serviceId]: v }),
    validated: Boolean(validated[serviceId]), setValidated: (v) => setValidated({ ...validated, [serviceId]: v }),
    remarks: remarks[serviceId] ?? {}, setRemarks: (v) => setRemarks({ ...remarks, [serviceId]: v }),
  };
  const stepDone = {
    notes: Boolean(validated[serviceId]),
    competences: (myComps[serviceId]?.length ?? 0) > 0,
    appreciations: service.students.every((s) => comments[`${serviceId}:${s}`]?.validated),
  };

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-semibold text-navy-500">{TERM.label} · conseil de classe le {TERM.council}</p>
        <h1 className="text-2xl font-semibold text-navy-900">Notes et appréciations</h1>
        <p className={`text-xs ${savedOk === false ? 'font-medium text-red-700' : 'text-slate-500'}`} role="status">
          {savedOk === false ? 'Ce navigateur refuse l\'enregistrement : vos dernières saisies seront perdues au rechargement.'
            : savedOk ? '✓ Enregistré automatiquement — revenez ajouter vos notes quand vous voulez.'
            : 'Chaque note est enregistrée dès qu\'elle est saisie : remplissez au fil du trimestre, devoir après devoir.'}
        </p>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {SERVICES.map((s) => {
          const ok = validated[s.id];
          return (
            <button key={s.id} onClick={() => setServiceId(s.id)}
              className={`nav-control shrink-0 rounded-lg border px-3 py-2 text-left text-sm ${s.id === serviceId ? 'border-navy-500 bg-navy-50 ring-1 ring-navy-500' : 'border-slate-200 bg-white hover:border-navy-200'}`}>
              <span className="block font-medium text-slate-900">{s.cls}</span>
              <span className="block text-xs text-slate-500">{s.subject}{ok ? ' · notes validées' : ''}</span>
            </button>
          );
        })}
      </div>
      {!appOnly && (
        <div className="flex gap-1 rounded-lg bg-slate-100 p-1" role="tablist">
          {STEPS.map(([id, label]) => (
            <button key={id} role="tab" aria-selected={step === id} onClick={() => setStep(id)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium ${step === id ? 'bg-white text-navy-900 shadow-sm' : 'text-slate-600'}`}>
              {stepDone[id] && <Icon name="check" className="h-3.5 w-3.5 text-emerald-600" />}{label}
            </button>
          ))}
        </div>
      )}
      {currentStep === 'notes' && <NotesStep {...props} go={go} competencies={myComps[serviceId] ?? []} />}
      {currentStep === 'competences' && <CompetenciesStep service={service} settings={settings} evaluations={evaluations[serviceId] ?? []} mine={myComps[serviceId] ?? []} setMine={(v) => setMyComps({ ...myComps, [serviceId]: v })} />}
      {currentStep === 'appreciations' && <AppreciationsStep {...props} go={go} comments={comments} setComments={setComments} flags={flags} setFlags={setFlags} />}
    </div>
  );
}
