import React, { useMemo, useState } from 'react';
import { Badge, Button, Card } from './ui.jsx';
import { TERM, SERVICES, EVALUATIONS, GRADES, CLASS_SUBJECTS, OTHER_AVERAGES } from '../data/grades.js';
import { CLASS_LIST } from '../data/people.js';
import { TLE_G_SUBJECTS, TLE_G_STUDENTS } from '../data/bulletins.js';
import { studentAverage, fmtAvg } from '../rules/grading.js';
import { averagesSheet, detailSheet, averagesRows, detailRows, cellText, isFinalTerm } from '../rules/gradeSheet.js';
import { buildXlsx } from '../xlsx.js';
import { shortNames } from '../rules/names.js';
import { loadProfiles } from '../profilesStore.js';
import { saveFile } from '../download.js';
import { printOnly } from '../print.js';

// Grilles de notes par classe, à imprimer (A4 paysage, uniquement le tableau) ou à exporter
// vers Excel (toutes les données : élèves, repères de classe, professeurs).

const EDITED = '13/10/2026';
export const SHORT = { FR: 'Fra', MATHS: 'Math', HG: 'H-G', LVA: 'Ang', LVB: 'Esp', EPS: 'EPS', EMC: 'EMC', MGT: 'Mgt', SGN: 'SGN', DROIT: 'Droit', ECO: 'Éco', VDC: 'VdC',
  PHILO: 'Philo', ANG: 'Ang', ESP: 'Esp', SPE_MATHS: 'Spé Math', SPE_PC: 'Spé PC', SPE_SVT: 'Spé SVT', ES: 'Ens. sci.' };
const tone = (v) => (v === null || v === undefined ? 'text-slate-400' : v < 10 ? 'text-red-700' : '');

/** Moyennes d'une classe : données communes à l'écran, au papier et à Excel. */
export function classAverages(cls, excluded = []) {
  if (cls === '1re STMG') {
    const subjects = CLASS_SUBJECTS.map((s) => ({ ...s, short: SHORT[s.id], inAverage: !excluded.includes(s.id) }));
    const rows = CLASS_LIST.map((name) => ({
      name, avgs: Object.fromEntries(CLASS_SUBJECTS.map((s) => [s.id, s.service ? studentAverage(EVALUATIONS[s.service], GRADES[s.service][name]) : OTHER_AVERAGES[name][s.id]])),
    }));
    return { subjects, rows };
  }
  if (cls === 'Terminale Générale') {
    const subjects = TLE_G_SUBJECTS.map((s) => ({ ...s, short: SHORT[s.id], inAverage: true, coef: 1 }));
    const rows = TLE_G_STUDENTS.map((st) => ({ name: st.name, avgs: Object.fromEntries(TLE_G_SUBJECTS.map((s) => [s.id, st.avgs[s.id]])) }));
    return { subjects, rows };
  }
  return null;
}

function SheetHeader({ title, cls }) {
  return (
    <div className="mb-2 flex items-end justify-between border-b-2 border-black pb-1">
      <div>
        <p className="text-[10px] font-bold uppercase">École Collège Lycée Chateaubriand — Tamatave</p>
        <p className="text-[14px] font-bold">{title}</p>
      </div>
      <p className="text-right text-[10px]">{cls} · {TERM.label}<br />Édité le {EDITED}</p>
    </div>
  );
}

/** Grille des moyennes, prête à imprimer. extra : colonnes supplémentaires (absences, décision…). */
export function AveragesSheet({ cls, subjects, sheet, showRank = true, extra = [], footer = null }) {
  const names = useMemo(() => shortNames(sheet.rows.map((r) => r.name), loadProfiles()), [sheet]);
  return (
    <div className="grade-sheet bg-white p-4 text-[10px] text-black" style={{ fontFamily: 'Poppins, sans-serif' }}>
      <SheetHeader title="Grille des moyennes" cls={cls} />
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="border border-black px-1.5 py-1 text-left">Élève</th>
            {subjects.map((s) => <th key={s.id} className={`border border-black px-1 py-1 text-center ${s.inAverage ? '' : 'italic text-slate-500'}`} title={s.label}>{s.short ?? s.label}</th>)}
            <th className="border border-black bg-slate-100 px-1 py-1 text-center">Moy. gén.</th>
            {showRank && <th className="border border-black px-1 py-1 text-center">Rang</th>}
            {extra.map((e) => <th key={e.label} className={`border border-black px-1 py-1 text-center ${e.small ? 'text-[8px]' : ''}`}>{e.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {sheet.rows.map((r) => (
            <tr key={r.name} style={{ breakInside: 'avoid' }}>
              <td className="whitespace-nowrap border border-black px-1.5 py-0.5 font-medium">{names.get(r.name)}</td>
              {subjects.map((s) => <td key={s.id} className={`border border-black px-1 text-center tabular-nums ${tone(r.avgs[s.id])}`}>{r.avgs[s.id] === undefined ? '·' : fmtAvg(r.avgs[s.id])}</td>)}
              <td className={`border border-black bg-slate-100 px-1 text-center font-bold tabular-nums ${tone(r.general)}`}>{fmtAvg(r.general)}</td>
              {showRank && <td className="border border-black px-1 text-center tabular-nums">{r.rank ?? '—'}</td>}
              {extra.map((e) => <td key={e.label} className={`border border-black px-1 ${e.small ? 'text-left text-[7.5px] leading-tight' : 'text-center'}`}>{e.value(r)}</td>)}
            </tr>
          ))}
        </tbody>
        <tfoot>
          {[['avg', 'Moyenne de la classe']].map(([k, label]) => (
            <tr key={k} className="font-semibold">
              <td className="border border-black bg-slate-50 px-1.5 py-0.5">{label}</td>
              {subjects.map((s) => <td key={s.id} className="border border-black bg-slate-50 px-1 text-center tabular-nums">{fmtAvg(sheet.stats[s.id][k])}</td>)}
              <td className="border border-black bg-slate-100 px-1 text-center tabular-nums">{fmtAvg(sheet.general[k])}</td>
              {showRank && <td className="border border-black bg-slate-50" />}
              {extra.map((e) => <td key={e.label} className="border border-black bg-slate-50" />)}
            </tr>
          ))}
        </tfoot>
      </table>
      {sheet.rows.some((r) => Object.values(r.avgs).includes(undefined)) && <p className="mt-1 text-[8.5px]">« · » : matière non suivie (spécialité)</p>}
      {footer}
    </div>
  );
}

/** Grille détaillée d'une matière, prête à imprimer. */
export function DetailSheet({ cls, service, sheet }) {
  const names = useMemo(() => shortNames(sheet.rows.map((r) => r.name), loadProfiles()), [sheet]);
  return (
    <div className="grade-sheet bg-white p-4 text-[10px] text-black" style={{ fontFamily: 'Poppins, sans-serif' }}>
      <SheetHeader title={`Grille de notes — ${service.subject}`} cls={cls} />
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="border border-black px-1.5 py-1 text-left">Élève</th>
            {sheet.evaluations.map((ev) => (
              <th key={ev.id} className="border border-black px-1 py-1 text-center font-semibold">
                {ev.title}<span className="block font-normal">{ev.date.slice(8)}/{ev.date.slice(5, 7)} · /{ev.scale} · coef. {ev.coef}</span>
              </th>
            ))}
            <th className="border border-black bg-slate-100 px-1 py-1 text-center">Moyenne /20</th>
          </tr>
        </thead>
        <tbody>
          {sheet.rows.map((r) => (
            <tr key={r.name} style={{ breakInside: 'avoid' }}>
              <td className="whitespace-nowrap border border-black px-1.5 py-0.5 font-medium">{names.get(r.name)}</td>
              {r.cells.map((c, i) => <td key={i} className={`border border-black px-1 text-center tabular-nums ${c.status === 'A_CORRIGER' ? 'text-amber-700' : tone(c.value)}`}>{cellText(c)}</td>)}
              <td className={`border border-black bg-slate-100 px-1 text-center font-bold tabular-nums ${tone(r.avg)}`}>{fmtAvg(r.avg)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          {[['avg', 'Moyenne de la classe']].map(([k, label]) => (
            <tr key={k} className="font-semibold">
              <td className="border border-black bg-slate-50 px-1.5 py-0.5">{label}</td>
              {sheet.evStats.map((s, i) => <td key={i} className="border border-black bg-slate-50 px-1 text-center tabular-nums">{fmtAvg(s[k])}</td>)}
              <td className="border border-black bg-slate-100 px-1 text-center tabular-nums">{fmtAvg(sheet.avgStats[k])}</td>
            </tr>
          ))}
        </tfoot>
      </table>
      <p className="mt-1.5 text-[8.5px]">ABS : absent · DISP : dispensé · NN : non noté · notes ramenées sur 20 et pondérées par les coefficients.</p>
    </div>
  );
}

const CLASSES = ['1re STMG', 'Terminale Générale', 'Terminale STMG', '1re Générale'];

export default function GradeSheets({ settings, role }) {
  // un enseignant ne voit que les grilles de ses propres matières (détail des évaluations)
  const isTeacher = role === 'ENSEIGNANT';
  const classes = isTeacher ? CLASSES.filter((c) => SERVICES.some((s) => s.cls === c && EVALUATIONS[s.id]?.length)) : CLASSES;
  const [cls, setCls] = useState(classes[0]);
  const averages = useMemo(() => (isTeacher ? null : classAverages(cls, settings.grading.excludedSubjects)), [cls, settings, isTeacher]);
  const services = SERVICES.filter((s) => s.cls === cls && s.mode !== 'APPRECIATION_SEULE' && EVALUATIONS[s.id]?.length);
  const views = [...(averages ? [['AVG', 'Moyennes de toutes les matières']] : []), ...services.map((s) => [s.id, `${s.subject} — détail des évaluations`])];
  const [view, setView] = useState('AVG');
  const current = views.some(([v]) => v === view) ? view : views[0]?.[0];
  const showRank = isFinalTerm(TERM); // le rang n'apparaît qu'au 3e trimestre (passage)
  const service = SERVICES.find((s) => s.id === current);
  const sheetAvg = averages && current === 'AVG' ? averagesSheet(averages) : null;
  const sheetDetail = service ? detailSheet({ evaluations: EVALUATIONS[service.id], students: service.students, grades: GRADES[service.id] }) : null;
  const slug = `${cls}-${current === 'AVG' ? 'moyennes' : service?.subject}`.replace(/\s+/g, '-');

  // matières retenues pour l'écran, l'impression et l'export (toutes par défaut)
  const [hidden, setHidden] = useState([]);
  const shownSubjects = averages ? averages.subjects.filter((s) => !hidden.includes(s.id)) : [];
  const docTitle = sheetAvg ? `Grille des moyennes — ${cls} — ${TERM.label}` : `Grille de notes — ${service?.subject} — ${cls} — ${TERM.label}`;
  const exportExcel = () => {
    const info = [`${cls} · ${TERM.label} · édité le ${EDITED}`];
    const sheet = sheetAvg
      ? { name: 'Moyennes', ...averagesRows({ title: `Grille des moyennes — ${cls}`, info, subjects: shownSubjects, sheet: sheetAvg }) }
      : { name: service.subject, ...detailRows({ title: `Grille de notes — ${service.subject} — ${cls}`, info, sheet: sheetDetail }) };
    saveFile(`grille-${slug}.xlsx`, buildXlsx([sheet]));
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-navy-500">{TERM.label} · {isTeacher ? 'mes matières' : 'toutes les classes'}</p>
          <h1 className="text-2xl font-semibold text-navy-900">Grilles de notes</h1>
          <p className="text-sm text-slate-500">Choisissez les matières, puis imprimez (seulement le tableau, A4 paysage, pied de page numéroté) ou exportez vers Excel avec les couleurs. Sur téléphone, faites glisser le tableau.</p>
        </div>
        <span className="flex flex-wrap gap-2">
          <Button variant="secondary" disabled={!current} onClick={exportExcel}>Exporter (Excel)</Button>
          <Button disabled={!current} onClick={() => printOnly('.grade-sheet-print', 'size: A4 landscape;', docTitle)}>Imprimer</Button>
        </span>
      </div>
      <Card>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs font-medium text-slate-600">Classe
            <select value={cls} onChange={(e) => { setCls(e.target.value); setView('AVG'); }} className="mt-1 block rounded-xl border border-slate-200 px-3 py-2 text-sm">{classes.map((c) => <option key={c}>{c}</option>)}</select>
          </label>
          <label className="text-xs font-medium text-slate-600">Grille
            <select value={current ?? ''} onChange={(e) => setView(e.target.value)} className="mt-1 block rounded-xl border border-slate-200 px-3 py-2 text-sm">
              {views.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          {!views.length && <Badge tone="amber">Pas encore de notes saisies pour cette classe</Badge>}
        </div>
        {sheetAvg && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-slate-600">
            <span className="font-semibold">Matières :</span>
            {averages.subjects.map((s) => (
              <button key={s.id} type="button" aria-pressed={!hidden.includes(s.id)} onClick={() => setHidden(hidden.includes(s.id) ? hidden.filter((x) => x !== s.id) : [...hidden, s.id])}
                className={`rounded-full px-2.5 py-0.5 font-medium ring-1 ${hidden.includes(s.id) ? 'bg-white ring-slate-300' : 'bg-navy-500 text-white ring-navy-500'}`}>{s.short ?? s.label}</button>
            ))}
          </div>
        )}
      </Card>
      {current && (
        <div className="overflow-x-auto rounded-2xl bg-slate-100 p-4">
          <div className="grade-sheet-print min-w-[900px] shadow-soft">
            {sheetAvg && <AveragesSheet cls={cls} subjects={shownSubjects} sheet={sheetAvg} showRank={showRank} />}
            {sheetDetail && <DetailSheet cls={cls} service={service} sheet={sheetDetail} />}
          </div>
        </div>
      )}
    </div>
  );
}
