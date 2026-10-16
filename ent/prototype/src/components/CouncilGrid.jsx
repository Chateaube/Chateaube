import React, { useMemo, useState } from 'react';
import { saveFile } from '../download.js';
import { printOnly } from '../print.js';
import { AveragesSheet, classAverages } from './GradeSheets.jsx';
import { averagesSheet, averagesCsv } from '../rules/gradeSheet.js';
import { Badge, Button, Card, Icon, Stat, StudentSelect } from './ui.jsx';
import { RulePanel } from './gradeUi.jsx';
import { TERM, EVALUATIONS, GRADES, CLASS_SUBJECTS, OTHER_AVERAGES, OTHER_FLAGS, COUNCIL_FLAGS, ABSENCES } from '../data/grades.js';

import { CLASS_LIST } from '../data/people.js';
import { studentAverage, generalAverage, classStats, councilProposal, COUNCIL_DECISIONS, fmtAvg, councilCsv } from '../rules/grading.js';
import { decisionText, checkAppreciation, autoFix } from '../rules/appreciation.js';

// Grille du conseil de classe — réservée à la Direction et au Bureau (jamais visible des enseignants).

const FLAG = Object.fromEntries(COUNCIL_FLAGS.map((f) => [f.id, f]));
const DECISION = Object.fromEntries(COUNCIL_DECISIONS.map((d) => [d.id, d]));
const SHORT = { FR: 'Fra', MATHS: 'Math', HG: 'H-G', LVA: 'Ang', LVB: 'Esp', EPS: 'EPS', EMC: 'EMC', MGT: 'Mgt', SGN: 'SGN', DROIT: 'Droit', ECO: 'Éco', VDC: 'VdC' };
// Avancement des saisies par matière (démo)
const ENTRY_STATUS = { LVB: 'En cours (3 / 4 notes)', MUS: 'En cours (2 / 4 notes)' };
const tone = (v) => (v === null ? 'text-slate-400' : v < 10 ? 'text-red-700' : v >= 14 ? 'text-emerald-700' : 'text-slate-800');

export default function CouncilGrid({ settings, role, go }) {
  // l'appréciation générale est rédigée par la Directrice, après le conseil de classe
  const canWriteGeneral = role === 'DIRECTION';
  const [showRank, setShowRank] = useState(false);
  const [finalTerm, setFinalTerm] = useState(false);
  const [decisions, setDecisions] = useState({});
  const [passage, setPassage] = useState({});
  const [open, setOpen] = useState(null);
  const [appreciations, setAppreciations] = useState({});
  const [current, setCurrent] = useState(CLASS_LIST[0]);
  const excluded = settings.grading.excludedSubjects;

  const rows = useMemo(() => CLASS_LIST.map((name) => {
    const subjects = CLASS_SUBJECTS.map((s) => ({
      ...s,
      inAverage: !excluded.includes(s.id),
      avg: s.service ? studentAverage(EVALUATIONS[s.service], GRADES[s.service][name]) : OTHER_AVERAGES[name][s.id],
    }));
    const flags = [
      ...(OTHER_FLAGS[name] ?? []),
      ...(name === 'RAJAONARIVELO Tsiry' ? [{ subject: 'Management', flag: 'BAVARD' }] : []),
    ];
    const general = generalAverage(subjects);
    return { name, subjects, general, flags, abs: ABSENCES[name], proposal: councilProposal(general, flags.map((f) => f.flag)) };
  }), [excluded]);

  const ranked = [...rows].sort((a, b) => (b.general ?? 0) - (a.general ?? 0));
  const rankOf = (n) => ranked.findIndex((r) => r.name === n) + 1;
  const generalStats = classStats(rows.map((r) => r.general));
  const pendingSubjects = CLASS_SUBJECTS.filter((s) => ENTRY_STATUS[s.id]);
  const decided = rows.filter((r) => decisions[r.name] !== undefined).length;
  const appText = appreciations[current] ?? '';
  const appCheck = checkAppreciation(appText);
  const written = CLASS_LIST.filter((n) => checkAppreciation(appreciations[n] ?? '').ok).length;
  const flagText = (r) => r.flags.map((f) => `${f.subject} : ${FLAG[f.flag].label}`).join(' / ');

  // Grille imprimable et export Excel : mêmes données, complètes (repères de classe, rang, absences,
  // avis, décision, appréciation générale, professeurs)
  const avgData = classAverages('1re STMG', excluded);
  const sheet = averagesSheet(avgData);
  const extra = [
    { label: 'Abs. (½ j)', value: (r) => (ABSENCES[r.name] ? `${ABSENCES[r.name].justified ?? 0} J / ${ABSENCES[r.name].unjustified ?? 0} NJ` : '0') },
    { label: 'Retards', value: (r) => ABSENCES[r.name]?.late ?? 0 },
    { label: 'Avis des enseignants', value: (r) => flagText(rows.find((x) => x.name === r.name)) },
    { label: 'Décision', value: (r) => DECISION[decisions[r.name] ?? rows.find((x) => x.name === r.name).proposal]?.label.replace('—', '').trim() ?? '' },
  ];
  const exportCsv = () => {
    saveFile('conseil-1re-STMG-T1.csv', averagesCsv({
      title: `Conseil de classe — 1re STMG — ${TERM.label}`,
      info: [`Conseil le ${TERM.council} · professeure principale : Mme Ranaivo`, `Moyenne générale de la classe : ${fmtAvg(sheet.general.avg)}`],
      subjects: avgData.subjects, sheet,
      extra: [...extra, { label: 'Appréciation générale', value: (r) => appreciations[r.name] ?? '' }],
    }));
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-navy-500">Conseil de classe · Direction et Bureau uniquement</p>
          <h1 className="text-2xl font-semibold text-navy-900">1re STMG — {TERM.label}</h1>
          <p className="text-sm text-slate-500">Tamatave · conseil le {TERM.council} · professeure principale : Mme Ranaivo</p>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <label className="flex items-center gap-1.5 text-sm text-slate-600"><input type="checkbox" checked={finalTerm} onChange={(e) => setFinalTerm(e.target.checked)} />Conseil du 3e trimestre (passage)</label>
          <label className="flex items-center gap-1.5 text-sm text-slate-600"><input type="checkbox" checked={showRank} onChange={(e) => setShowRank(e.target.checked)} />Afficher le rang</label>
          <Button variant="secondary" onClick={exportCsv}>Exporter (Excel)</Button>
          <Button variant="secondary" onClick={() => printOnly('.council-print', 'size: A4 landscape; margin: 8mm;')}>Imprimer la grille</Button>
          <Button variant="secondary" onClick={() => go?.('bulletins')}>Bulletins</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 print:hidden">
        <Stat label="Moyenne générale de la classe" value={fmtAvg(generalStats.avg)} hint={`de ${fmtAvg(generalStats.min)} à ${fmtAvg(generalStats.max)}`} />
        <Stat label="Élèves sous 10 de moyenne" value={rows.filter((r) => r.general !== null && r.general < 10).length} tone="red" />
        <Stat label="Matières en attente de saisie" value={pendingSubjects.length} hint={pendingSubjects.map((s) => s.label).join(', ') || 'Toutes validées'} tone={pendingSubjects.length ? 'amber' : 'green'} />
        <Stat label="Décisions · appréciations générales" value={`${decided} · ${written} / ${rows.length}`} />
      </div>

      <Card title="Grille de notes" subtitle={`Moyennes /20 par matière · moyenne générale hors ${CLASS_SUBJECTS.filter((s) => excluded.includes(s.id)).map((s) => s.label).join(', ')}`}>
        <div className="-mx-5 overflow-x-auto print:overflow-visible">
          <table className="w-full min-w-[1320px] text-sm print:min-w-0 print:text-[9px]">
            <thead>
              <tr className="border-y border-slate-100 bg-slate-50 text-xs text-slate-500">
                <th className="sticky left-0 z-10 bg-slate-50 px-4 py-2 text-left font-medium">Élève</th>
                {CLASS_SUBJECTS.map((s) => (
                  <th key={s.id} className={`px-1.5 py-2 text-center font-medium ${excluded.includes(s.id) ? 'bg-slate-100 text-slate-400' : ''}`} title={`${s.label} — ${s.teacher}${ENTRY_STATUS[s.id] ? ` · ${ENTRY_STATUS[s.id]}` : ''}`}>
                    {SHORT[s.id]}{ENTRY_STATUS[s.id] && <span className="ml-0.5 text-amber-600">•</span>}
                    {excluded.includes(s.id) && <span className="block text-[10px] font-normal">hors moy.</span>}
                  </th>
                ))}
                <th className="px-2 py-2 text-center font-semibold text-navy-900">Moy. G.</th>
                {showRank && <th className="px-2 py-2 text-center font-medium">Rang</th>}
                <th className="px-2 py-2 text-left font-medium">Abs. / Ret.</th>
                <th className="px-2 py-2 text-left font-medium">Avis des enseignants</th>
                <th className="px-3 py-2 text-left font-medium">Décision du conseil</th>
                <th className="px-2 py-2 text-center font-medium">Appr. gén.</th>
                {finalTerm && <th className="px-3 py-2 text-left font-medium">Passage</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const decision = decisions[r.name] ?? r.proposal;
                const grouped = Object.entries(r.flags.reduce((acc, f) => ({ ...acc, [f.flag]: (acc[f.flag] ?? 0) + 1 }), {}));
                return (
                  <React.Fragment key={r.name}>
                    <tr className="border-b border-slate-100">
                      <td className="sticky left-0 z-10 bg-white px-4 py-2">
                        <button onClick={() => setOpen(open === r.name ? null : r.name)} className="text-left font-medium text-slate-900 hover:text-navy-500">{r.name}</button>
                      </td>
                      {r.subjects.map((s) => (
                        <td key={s.id} className={`px-1.5 text-center tabular-nums ${excluded.includes(s.id) ? 'bg-slate-50 text-slate-400' : tone(s.avg)}`}>{fmtAvg(s.avg)}</td>
                      ))}
                      <td className={`px-2 text-center font-semibold tabular-nums ${tone(r.general)}`}>{fmtAvg(r.general)}</td>
                      {showRank && <td className="px-2 text-center tabular-nums text-slate-600">{rankOf(r.name)}</td>}
                      <td className="px-2 text-xs tabular-nums text-slate-600">{r.abs ? `${r.abs.abs} / ${r.abs.late}` : '0 / 0'}</td>
                      <td className="px-2">
                        <div className="flex flex-wrap gap-1">
                          {grouped.map(([id, n]) => <Badge key={id} tone={FLAG[id].tone}>{FLAG[id].label}{n > 1 ? ` ×${n}` : ''}</Badge>)}
                        </div>
                      </td>
                      <td className="px-3 py-1.5">
                        <select value={decision} onChange={(e) => setDecisions({ ...decisions, [r.name]: e.target.value })}
                          className={`w-52 rounded-md border px-2 py-1 text-xs ${decisions[r.name] === undefined && r.proposal ? 'border-dashed border-navy-300 bg-navy-50' : 'border-slate-300'}`}>
                          {COUNCIL_DECISIONS.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
                        </select>
                        {decisions[r.name] === undefined && r.proposal && <p className="text-[10px] text-navy-500">Proposition — à confirmer</p>}
                      </td>
                      <td className="px-2 text-center">
                        <button onClick={() => setCurrent(r.name)} disabled={!canWriteGeneral} title={canWriteGeneral ? 'Rédiger l\'appréciation générale' : 'Rédigée par la Direction'}
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${checkAppreciation(appreciations[r.name] ?? '').ok ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                          {checkAppreciation(appreciations[r.name] ?? '').ok ? '✓' : 'À rédiger'}
                        </button>
                      </td>
                      {finalTerm && (
                        <td className="px-3 py-1.5">
                          <select value={passage[r.name] ?? 'ADMIS'} onChange={(e) => setPassage({ ...passage, [r.name]: e.target.value })} className="rounded-md border border-slate-300 px-2 py-1 text-xs">
                            <option value="ADMIS">{decisionText('ADMIS', 'Terminale')}</option>
                            <option value="RETENU">{decisionText('RETENU', '1re')}</option>
                          </select>
                        </td>
                      )}
                    </tr>
                    {open === r.name && (
                      <tr className="bg-slate-50">
                        <td colSpan={CLASS_SUBJECTS.length + 7} className="px-4 py-3 text-sm">
                          <p className="font-medium text-slate-800">Avis détaillés pour {r.name}</p>
                          {r.flags.length === 0 ? <p className="text-slate-500">Aucun avis particulier.</p> : (
                            <ul className="mt-1 space-y-0.5 text-slate-700">
                              {r.flags.map((f, i) => <li key={i}>· {f.subject} : {FLAG[f.flag].label}</li>)}
                            </ul>
                          )}
                          <p className="mt-2 text-xs text-slate-500">Les appréciations de chaque matière sont consultables dans le bulletin provisoire.</p>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
            <tfoot>
              {['avg', 'min', 'max'].map((k) => (
                <tr key={k} className="bg-slate-50 text-xs text-slate-600">
                  <td className="sticky left-0 z-10 bg-slate-50 px-4 py-1.5 font-medium">{{ avg: 'Moyenne de classe', min: 'Minimum', max: 'Maximum' }[k]}</td>
                  {CLASS_SUBJECTS.map((s, i) => <td key={s.id} className="px-1.5 text-center tabular-nums">{fmtAvg(classStats(rows.map((r) => r.subjects[i].avg))[k])}</td>)}
                  <td className="px-2 text-center font-semibold tabular-nums">{fmtAvg(generalStats[k])}</td>
                  <td colSpan={showRank ? 6 : 5} />
                  {finalTerm && <td />}
                </tr>
              ))}
            </tfoot>
          </table>
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500 print:hidden">
          <Icon name="alert" className="h-3.5 w-3.5 text-amber-600" />
          • = saisie en cours dans cette matière. Cliquer sur un nom affiche le détail des avis. Les matières hors moyenne se règlent dans Paramètres.
        </p>
      </Card>

      {/* Appréciation générale : rédigée par la Directrice après le conseil */}
      {!canWriteGeneral && (
        <Card title="Appréciations générales" subtitle="Rédigées par la Directrice après le conseil de classe" className="print:hidden">
          <p className="text-sm text-slate-600">{written} / {rows.length} rédigées. Elles apparaîtront ici et dans l'export dès leur rédaction.</p>
        </Card>
      )}
      {canWriteGeneral && <div className="grid gap-5 xl:grid-cols-[1fr_320px] xl:items-start print:hidden">
        <Card title="Appréciations générales" subtitle={`Rédigées par la Direction après le conseil · ${written} / ${rows.length} conformes`}>
          <StudentSelect students={CLASS_LIST} value={current} onChange={setCurrent}
            suffix={(n) => (checkAppreciation(appreciations[n] ?? '').ok ? '  ✓' : '')} />
          {(() => {
            const r = rows.find((x) => x.name === current);
            return (
              <p className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
                Moyenne générale {fmtAvg(r.general)} · {DECISION[decisions[r.name] ?? r.proposal]?.label} · {r.flags.length ? flagText(r) : 'aucun avis particulier'}
              </p>
            );
          })()}
          <textarea rows={4} value={appText} onChange={(e) => setAppreciations({ ...appreciations, [current]: e.target.value })}
            placeholder="Appréciation générale du conseil de classe…" className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <div className="mt-2 flex gap-2">
            <Button variant="secondary" disabled={!appText.trim() || autoFix(appText) === appText.trim()} onClick={() => setAppreciations({ ...appreciations, [current]: autoFix(appText) })}>Corriger la forme</Button>
            <Button className="ml-auto" disabled={!appCheck.ok || CLASS_LIST.indexOf(current) === CLASS_LIST.length - 1}
              onClick={() => setCurrent(CLASS_LIST[CLASS_LIST.indexOf(current) + 1])}>Élève suivant ›</Button>
          </div>
        </Card>
        <Card title="Contrôleur de rédaction"><RulePanel result={appCheck} /></Card>
      </div>}

      {/* Grille imprimée : uniquement les données (A4 paysage), décisions et appréciations générales */}
      <div className="council-print hidden">
        <AveragesSheet cls="1re STMG" subjects={avgData.subjects} sheet={sheet} showRank={showRank} extra={extra}
          footer={(
            <div className="mt-3" style={{ breakBefore: 'auto' }}>
              <p className="mb-1 text-[11px] font-bold">Appréciations générales</p>
              {rows.map((r) => <p key={r.name} className="mb-0.5 text-[9.5px]"><b>{r.name}</b> : {appreciations[r.name] || '—'}</p>)}
            </div>
          )} />
      </div>
    </div>
  );
}