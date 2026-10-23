import React, { useMemo, useState } from 'react';
import { loadCouncilFeedback } from '../studentInitiativesStore.js';
import { saveFile } from '../download.js';
import { printOnly } from '../print.js';
import { AveragesSheet, classAverages } from './GradeSheets.jsx';
import { averagesSheet, averagesRows, isFinalTerm } from '../rules/gradeSheet.js';
import { buildXlsx } from '../xlsx.js';
import { GA_STATUS, saveText, saveDecision, submit, validate, sendBack } from '../rules/generalAppreciation.js';

import { loadGA, saveGA } from '../appreciationStore.js';
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

/** Ce que les délégués de la classe ont préparé pour le conseil (lu par le secrétariat, qui tient le conseil). */
function DelegatesFeedback({ cls }) {
  const list = loadCouncilFeedback().filter((f) => f.cls === cls);
  return (
    <section aria-labelledby="remontees-titre" className="rounded-2xl bg-white p-4 shadow-soft print:hidden">
      <h2 id="remontees-titre" className="font-display text-base font-semibold text-slate-900">Remarques des délégués ({list.length})</h2>
      {list.length === 0 ? <p className="text-sm text-slate-600">Les délégués n'ont rien envoyé pour ce conseil.</p>
        : <ul className="mt-2 space-y-2 text-sm">{list.map((f) => <li key={f.id} className="rounded-lg bg-slate-50 p-2"><span className="block text-xs text-slate-600">{f.by} · {f.at.slice(8, 10)}/{f.at.slice(5, 7)}</span>{f.text}</li>)}</ul>}
    </section>
  );
}

export default function CouncilGrid({ settings, role, go }) {
  // appréciation générale : tapée par la Direction, ou par le secrétariat puis validée par la Direction
  const canWriteGeneral = role === 'DIRECTION' || role === 'BUREAU';
  const isDirection = role === 'DIRECTION';
  // conseil du 3e trimestre (passage) : décidé par le trimestre ; la case ne sert qu'à la démonstration
  const [finalTerm] = useState(isFinalTerm(TERM)); // 3e trimestre : passage et rang
  const showRank = finalTerm; // le rang n'apparaît qu'au 3e trimestre, sans rien cocher
  const [passage, setPassage] = useState({});
  const [open, setOpen] = useState(null);
  const [ga, setGaState] = useState(loadGA);
  const setGa = (next) => { setGaState(next); saveGA(next); };
  const appreciations = Object.fromEntries(Object.entries(ga).map(([k, e]) => [k, e.text ?? '']));
  // décision du conseil : saisie avec l'appréciation générale (secrétariat), validée avec elle par la Direction
  const decisions = Object.fromEntries(Object.entries(ga).filter(([, e]) => e.decision).map(([k, e]) => [k, e.decision]));
  const [gaNote, setGaNote] = useState('');
  const [gaError, setGaError] = useState('');
  const act = (fn) => { try { setGaError(''); fn(); } catch (e) { setGaError(e.message); } };
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
  const written = CLASS_LIST.filter((n) => ga[n]?.status === 'VALIDEE').length;
  const toValidate = CLASS_LIST.filter((n) => ga[n]?.status === 'A_VALIDER');
  const flagText = (r) => r.flags.map((f) => `${f.subject} : ${FLAG[f.flag].label}`).join(' / ');

  // Grille imprimable et export Excel : mêmes données, complètes (repères de classe, rang, absences,
  // avis, décision, appréciation générale, professeurs)
  const avgData = classAverages('1re STMG', excluded);
  const sheet = averagesSheet(avgData);
  const extra = [
    { label: 'Abs. (½ j)', value: (r) => (ABSENCES[r.name] ? `${ABSENCES[r.name].justified ?? 0} J / ${ABSENCES[r.name].unjustified ?? 0} NJ` : '0') },
    { label: 'Retards', value: (r) => ABSENCES[r.name]?.late ?? 0 },
    { label: 'Avis des enseignants', small: true, wide: true, value: (r) => flagText(rows.find((x) => x.name === r.name)) },
  ];
  const decisionCol = { label: 'Décision', wide: true, value: (r) => DECISION[decisions[r.name] ?? rows.find((x) => x.name === r.name).proposal]?.label.replace('—', '').trim() ?? '' };
  // choix avant impression : matières, absences, avis (la décision n'est jamais imprimée : prise pendant le conseil)
  const [hiddenSubjects, setHiddenSubjects] = useState([]);
  const [printAbs, setPrintAbs] = useState(true);
  const [printAvis, setPrintAvis] = useState(true);
  const printSubjects = avgData.subjects.filter((x) => !hiddenSubjects.includes(x.id));
  const printExtra = extra.filter((e) => (e.label === 'Avis des enseignants' ? printAvis : printAbs));
  const exportCsv = () => {
    saveFile('conseil-1re-STMG-T1.xlsx', buildXlsx([{ name: 'Conseil 1re STMG', ...averagesRows({
      title: `Conseil de classe — 1re STMG — ${TERM.label}`,
      info: [`Conseil le ${TERM.council}`, `Moyenne générale de la classe : ${fmtAvg(sheet.general.avg)}`],
      subjects: avgData.subjects, sheet,
      extra: [...extra, decisionCol, { label: 'Appréciation générale', wide: true, value: (r) => (ga[r.name]?.status === 'VALIDEE' ? ga[r.name].text : '') }],
    }) }]));
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-navy-500">Conseil de classe · Direction et secrétariat uniquement</p>
          <h1 className="text-2xl font-semibold text-navy-900">Conseils de classe</h1>
          <p className="text-sm text-slate-600">1re STMG · {TERM.label} · conseil le {TERM.council}</p>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          
          <Button variant="secondary" onClick={exportCsv}>Exporter (Excel)</Button>
          <Button variant="secondary" onClick={() => printOnly('.council-print', 'size: A4 landscape;', `Grille du conseil de classe — 1re STMG — ${TERM.label}`)}>Imprimer la grille</Button>
          <Button variant="secondary" onClick={() => go?.('bulletins')}>Bulletins</Button>
        </div>
      </div>
      <DelegatesFeedback cls="1re STMG" />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 print:hidden">
        <Stat label="Moyenne générale de la classe" value={fmtAvg(generalStats.avg)} hint={`de ${fmtAvg(generalStats.min)} à ${fmtAvg(generalStats.max)}`} />
        <Stat label="Élèves sous 10 de moyenne" value={rows.filter((r) => r.general !== null && r.general < 10).length} tone="red" />
        <Stat label="Matières en attente de saisie" value={pendingSubjects.length} hint={pendingSubjects.map((s) => s.label).join(', ') || 'Toutes validées'} tone={pendingSubjects.length ? 'amber' : 'green'} />
        <Stat label="Décisions · appréciations générales" value={`${decided} · ${written} / ${rows.length}`} />
      </div>

      <Card title="Grille de notes" subtitle={`Moyennes /20 par matière · moyenne générale hors ${CLASS_SUBJECTS.filter((s) => excluded.includes(s.id)).map((s) => s.label).join(', ')}`}>
        <p className="mb-1 text-xs text-slate-600 sm:hidden">Faites glisser le tableau vers la gauche pour voir les autres matières, la moyenne générale et la décision.</p>
        <div className="-mx-5 overflow-x-auto print:overflow-visible" tabIndex={0} role="region" aria-label="Grille de notes du conseil">
          <table data-grid className="w-full min-w-[1150px] text-sm print:min-w-0 print:text-[9px]">
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
                <th className="px-3 py-2 text-left font-medium">Décision</th>
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
                      <td className="px-3 py-1.5 text-xs">
                        <span className={decisions[r.name] === undefined ? 'text-slate-600' : 'font-medium text-slate-900'}>{DECISION[decision]?.label ?? '—'}</span>
                        {decisions[r.name] === undefined && r.proposal && <span className="block text-[10px] text-navy-500">proposition — à saisir avec l'appréciation</span>}
                      </td>
                      <td className="px-2 text-center">
                        <button onClick={() => setCurrent(r.name)} disabled={!canWriteGeneral} title={canWriteGeneral ? 'Rédiger l\'appréciation générale' : 'Rédigée par la Direction'}>
                          {ga[r.name]?.status ? <Badge tone={GA_STATUS[ga[r.name].status][0]}>{GA_STATUS[ga[r.name].status][1]}</Badge> : <Badge>à rédiger</Badge>}
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

      {/* Appréciation générale : tapée par la Direction, ou par le secrétariat puis validée par la Direction */}
      {!canWriteGeneral && (
        <Card title="Appréciations générales" subtitle="Rédigées après le conseil de classe" className="print:hidden">
          <p className="text-sm text-slate-600">{written} / {rows.length} validées par la Direction.</p>
        </Card>
      )}
      {canWriteGeneral && <div className="grid gap-5 xl:grid-cols-[1fr_320px] xl:items-start print:hidden">
        <Card title="Avis du conseil : décision et appréciation générale"
          subtitle={isDirection ? `Tapées par vous ou par le secrétariat · ${written} / ${rows.length} validées${toValidate.length ? ` · ${toValidate.length} à valider` : ''}` : 'Tapez d\'après les notes de la Directrice, puis envoyez-les-lui pour validation'}>
          {isDirection && toValidate.length > 0 && (
            <p className="mb-3 flex flex-wrap items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">À valider : {toValidate.map((n) => <button key={n} onClick={() => setCurrent(n)} className="font-medium underline">{n.split(' ').slice(1).join(' ')}</button>)}</p>
          )}
          <StudentSelect students={CLASS_LIST} value={current} onChange={setCurrent}
            suffix={(n) => (ga[n]?.status ? `  · ${GA_STATUS[ga[n].status][1]}` : '')} />
          {(() => {
            const r = rows.find((x) => x.name === current);
            return (
              <p className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
                Moyenne générale {fmtAvg(r.general)} · {DECISION[decisions[r.name] ?? r.proposal]?.label} · {r.flags.length ? flagText(r) : 'aucun avis particulier'}
              </p>
            );
          })()}
          <label className="mt-3 block text-xs font-medium text-slate-600">Décision du conseil
            <select value={decisions[current] ?? rows.find((x) => x.name === current)?.proposal ?? ''} onChange={(e) => act(() => setGa({ ...ga, [current]: saveDecision(ga[current], e.target.value, role) }))}
              className="mt-1 block w-72 rounded-md border border-slate-300 px-2 py-1.5 text-sm">
              {COUNCIL_DECISIONS.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
            </select>
          </label>
          {ga[current]?.status && <p className="mt-2 text-xs">État : <Badge tone={GA_STATUS[ga[current].status][0]}>{GA_STATUS[ga[current].status][1]}</Badge>{ga[current].note && <span className="ml-2 text-red-700">Remarque de la Direction : {ga[current].note}</span>}</p>}
          <textarea rows={4} value={appText} onChange={(e) => setGa({ ...ga, [current]: saveText(ga[current], e.target.value, role) })}
            placeholder="Appréciation générale du conseil de classe…" className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          {gaError && <p className="mt-1 text-sm text-red-700">{gaError}</p>}
          <div className="mt-2 flex flex-wrap gap-2">
            <Button variant="secondary" disabled={!appText.trim() || autoFix(appText) === appText.trim()} onClick={() => setGa({ ...ga, [current]: saveText(ga[current], autoFix(appText), role) })}>Corriger la forme</Button>
            {!isDirection && <Button disabled={!appText.trim() || ga[current]?.status === 'A_VALIDER'} onClick={() => act(() => setGa({ ...ga, [current]: submit(ga[current], 'BUREAU') }))}>{ga[current]?.status === 'A_VALIDER' ? 'Envoyée à la Direction' : 'Envoyer à la Direction'}</Button>}
            {isDirection && <Button disabled={!appText.trim() || ga[current]?.status === 'VALIDEE'} onClick={() => act(() => setGa({ ...ga, [current]: validate(ga[current], 'DIRECTION', appText) }))}>{ga[current]?.status === 'VALIDEE' ? 'Validée' : 'Valider'}</Button>}
            {isDirection && ga[current]?.status === 'A_VALIDER' && (
              <span className="flex gap-2">
                <input value={gaNote} onChange={(e) => setGaNote(e.target.value)} placeholder="Remarque pour le secrétariat" className="rounded-md border border-slate-300 px-2 py-1 text-sm" />
                <Button variant="secondary" onClick={() => act(() => { setGa({ ...ga, [current]: sendBack(ga[current], 'DIRECTION', gaNote) }); setGaNote(''); })}>Renvoyer</Button>
              </span>
            )}
            <Button variant="ghost" className="ml-auto" disabled={CLASS_LIST.indexOf(current) === CLASS_LIST.length - 1}
              onClick={() => setCurrent(CLASS_LIST[CLASS_LIST.indexOf(current) + 1])}>Élève suivant ›</Button>
          </div>
          <p className="mt-2 text-xs text-slate-500">Seules les appréciations validées par la Direction vont sur le bulletin.</p>
        </Card>
        <Card title="Contrôleur de rédaction"><RulePanel result={appCheck} /></Card>
      </div>}

      <Card title="Avant d'imprimer la grille" className="print:hidden">
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-600">
          <span className="font-semibold">Matières :</span>
          {avgData.subjects.map((x) => (
            <button key={x.id} type="button" aria-pressed={!hiddenSubjects.includes(x.id)} onClick={() => setHiddenSubjects(hiddenSubjects.includes(x.id) ? hiddenSubjects.filter((y) => y !== x.id) : [...hiddenSubjects, x.id])}
              className={`min-h-6 rounded-full px-2.5 py-1 font-medium ring-1 ${hiddenSubjects.includes(x.id) ? 'bg-white ring-slate-300' : 'bg-navy-500 text-white ring-navy-500'}`}>{x.short ?? x.label}</button>
          ))}
          <label className="ml-2 flex items-center gap-1.5"><input type="checkbox" className="h-6 w-6" checked={printAbs} onChange={(e) => setPrintAbs(e.target.checked)} />Absences et retards</label>
          <label className="flex items-center gap-1.5"><input type="checkbox" className="h-6 w-6" checked={printAvis} onChange={(e) => setPrintAvis(e.target.checked)} />Avis des enseignants</label>
        </div>
        <p className="mt-1 text-xs text-slate-500">La décision n'est pas imprimée : elle se prend pendant le conseil. Le rang apparaît seul au 3e trimestre.</p>
      </Card>

      {/* Grille imprimée : uniquement les données (A4 paysage) : moyennes, absences, avis */}
      <div className="council-print hidden">
        <AveragesSheet cls="1re STMG" subjects={printSubjects} sheet={sheet} showRank={showRank} extra={printExtra} />
      </div>
    </div>
  );
}