import React, { useMemo, useState } from 'react';
import { Badge, Button, Card, StudentSelect } from './ui.jsx';
import { BulletinSheet } from './Bulletin.jsx';
import { TERM, EVALUATIONS, GRADES, CLASS_SUBJECTS, OTHER_AVERAGES, ABSENCES, TEACHER_COMPETENCIES } from '../data/grades.js';
import { CLASS_LIST } from '../data/people.js';
import { TLE_G_SUBJECTS, TLE_G_STUDENTS } from '../data/bulletins.js';
import { COMPETENCY_HISTORY } from '../data/competencyHistory.js';
import { studentAverage, generalAverage, classStats } from '../rules/grading.js';
import { subjectsOf, subjectClassAverage, classLine, specialtyErrors, SPECIALTIES } from '../rules/bulletin.js';
import { loadImport, saveImport } from '../importStore.js';
import { demoAppreciation, accord } from '../rules/documents.js';
import { formatDateFr } from '../rules/calendar.js';
import { printOnly } from '../print.js';

// Bulletins du trimestre (Direction, Bureau) : une page A4 par élève, selon la matrice de l'établissement.
// Chaque bulletin ne contient que les matières de l'élève (spécialités en Terminale générale).

const longDate = (iso) => (iso ? formatDateFr(iso).replace(/^\S+ /, '') : '');
const COMP_KEY = { EMC: 'Enseignement moral et civique', 'Histoire-Géographie': 'Histoire-géographie', 'Sc. de gestion et numérique': 'Sciences de gestion et numérique' };
// Compétences du trimestre : celles de l'enseignant (ici, le dernier trimestre de la base), 4 lignes au plus
const compsFor = (key, level) => (COMPETENCY_HISTORY[`${key}|${level}`]?.[0]?.items ?? []).slice(0, 4);

function buildPremiereSTMG(settings) {
  const excluded = settings.grading.excludedSubjects;
  const students = CLASS_LIST.map((name) => ({
    name,
    avgs: Object.fromEntries(CLASS_SUBJECTS.map((s) => [s.id, s.service ? studentAverage(EVALUATIONS[s.service], GRADES[s.service][name]) : OTHER_AVERAGES[name][s.id]])),
  }));
  const generals = students.map((st) => generalAverage(CLASS_SUBJECTS.map((s) => ({ ...s, inAverage: !excluded.includes(s.id), avg: st.avgs[s.id] }))));
  return students.map((st, i) => ({
    term: '1er Trimestre', year: '2026/2027', student: st.name, birthLine: '', classLine: classLine('1re STMG'),
    rows: CLASS_SUBJECTS.filter((s) => s.id !== 'VDC').map((s) => ({
      label: s.label, teacher: s.teacher, avg: st.avgs[s.id], classAvg: subjectClassAverage(s.id, students),
      competencies: s.service ? (TEACHER_COMPETENCIES[s.service] ?? []).slice(0, 4) : compsFor(COMP_KEY[s.label] ?? s.label, '1re STMG'),
      appreciation: demoAppreciation(st.avgs[s.id]),
    })),
    general: generals[i], classGeneral: classStats(generals).avg, abs: ABSENCES[st.name]?.abs ?? 0, late: ABSENCES[st.name]?.late ?? 0,
  }));
}

function buildTerminaleG() {
  const generals = TLE_G_STUDENTS.map((st) => generalAverage(subjectsOf(st, TLE_G_SUBJECTS).map((s) => ({ ...s, inAverage: true, coef: 1, avg: st.avgs[s.id] }))));
  return TLE_G_STUDENTS.map((st, i) => ({
    term: '1er Trimestre', year: '2026/2027', student: st.name,
    birthLine: `${accord(st.sex, 'Né', 'Née')} le ${longDate(st.birthDate)}`,
    classLine: classLine('Terminale Générale', st.specialties),
    rows: subjectsOf(st, TLE_G_SUBJECTS).map((s) => ({
      label: s.label, teacher: s.teacher, avg: st.avgs[s.id], classAvg: subjectClassAverage(s.id, TLE_G_STUDENTS),
      competencies: compsFor(s.comp, 'Tle G'), appreciation: demoAppreciation(st.avgs[s.id]),
    })),
    general: generals[i], classGeneral: classStats(generals).avg, abs: st.abs, late: st.late,
  }));
}

// Élèves importés (année en cours, gardés dans ce navigateur) : fiches complétées si elles existent
const IMPORTED = 'Tle Générale (vos élèves)';
const importedTleG = () => {
  const imp = loadImport();
  return (imp?.profiles?.length ? imp.profiles : imp?.students ?? []).filter((s) => s.cls === 'Terminale Générale');
};
// Les notes viennent des carnets des enseignants : pas encore saisies pour les élèves importés
function buildImported() {
  return importedTleG().map((st) => ({
    term: '1er Trimestre', year: '2026/2027', student: `${st.lastName} ${st.firstName}`,
    birthLine: st.birthDate ? `${accord(st.sex, 'Né', 'Née')} le ${longDate(st.birthDate)}` : '',
    classLine: classLine('Terminale Générale', st.specialties ?? []),
    rows: subjectsOf(st, TLE_G_SUBJECTS).map((s) => ({ label: s.label, teacher: s.teacher, avg: null, classAvg: null, competencies: compsFor(s.comp, 'Tle G'), appreciation: '' })),
    general: null, classGeneral: null, abs: 0, late: 0,
  }));
}

/** Choix des spécialités des élèves importés (2 sur 3 en Terminale générale), enregistré dans ce navigateur. */
function SpecialtiesPanel({ onChange }) {
  const [list, setList] = useState(importedTleG);
  const persist = (next) => {
    setList(next);
    const imp = loadImport();
    const byId = Object.fromEntries(next.map((s) => [s.id, s.specialties]));
    const patch = (arr) => arr?.map((s) => (s.id in byId ? { ...s, specialties: byId[s.id] } : s));
    saveImport({ ...imp, students: patch(imp.students), ...(imp.profiles ? { profiles: patch(imp.profiles) } : {}) });
    onChange();
  };
  const toggle = (id, code) => persist(list.map((s) => {
    if (s.id !== id) return s;
    const cur = s.specialties ?? [];
    return { ...s, specialties: cur.includes(code) ? cur.filter((c) => c !== code) : [...cur, code] };
  }));
  const fillDefault = () => persist(list.map((s) => (s.specialties?.length ? s : { ...s, specialties: ['MATHS', 'SVT'] })));
  const incomplete = list.filter((s) => specialtyErrors('Terminale Générale', s.specialties ?? []).length).length;
  return (
    <Card title="Spécialités des élèves" subtitle="2 spécialités sur 3 par élève : seules celles-ci apparaissent sur son bulletin">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <Button variant="secondary" className="!py-1 text-xs" onClick={fillDefault}>Mathématiques + SVT pour les élèves sans choix</Button>
        {incomplete ? <Badge tone="amber">{incomplete} élève{incomplete > 1 ? 's' : ''} à compléter</Badge> : <Badge tone="green">Tous les choix sont complets</Badge>}
      </div>
      <ul className="divide-y divide-slate-100">
        {list.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
            <span>{s.lastName} {s.firstName}</span>
            <span className="flex gap-1.5">
              {Object.entries(SPECIALTIES).map(([code, label]) => {
                const on = (s.specialties ?? []).includes(code);
                return <button key={code} type="button" aria-pressed={on} title={label} onClick={() => toggle(s.id, code)}
                  className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ${on ? 'bg-navy-500 text-white ring-navy-500' : 'bg-white text-slate-600 ring-slate-300'}`}>{code === 'MATHS' ? 'Maths' : code}</button>;
              })}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

const DEMO_CLASSES = [['1re STMG', buildPremiereSTMG], ['Terminale Générale', buildTerminaleG]];
const classesNow = () => (importedTleG().length ? [[IMPORTED, buildImported], ...DEMO_CLASSES] : DEMO_CLASSES);

export default function BulletinsModule({ settings }) {
  const [CLASSES] = useState(classesNow);
  const [cls, setCls] = useState(CLASSES[0][0]);
  const [version, setVersion] = useState(0); // spécialités modifiées
  const [showGeneral, setShowGeneral] = useState(false);
  const [general, setGeneral] = useState({});
  const bulletins = useMemo(() => CLASSES.find(([c]) => c === cls)[1](settings), [cls, settings, version]);
  const [student, setStudent] = useState(bulletins[0].student);
  const current = bulletins.find((x) => x.student === student) ?? bulletins[0];
  const enrich = (x) => ({ ...x, showGeneral, generalAppreciation: general[`${cls}:${x.student}`] ?? '' });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-navy-500">{TERM.label} · Direction et Bureau</p>
          <h1 className="text-2xl font-semibold text-navy-900">Bulletins</h1>
          <p className="text-sm text-slate-500">Une page A4 par élève, sur le modèle de l'établissement. Chaque bulletin ne garde que les matières de l'élève.</p>
        </div>
        <span className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => printOnly('.bulletin-one', 'size: A4 portrait; margin: 8mm;')}>Imprimer ce bulletin</Button>
          <Button onClick={() => printOnly('.bulletins-all', 'size: A4 portrait; margin: 8mm;')}>Imprimer toute la classe ({bulletins.length})</Button>
        </span>
      </div>
      <Card>
        <div className="grid gap-4 lg:grid-cols-[240px_1fr_auto] lg:items-end">
          <label className="text-xs font-medium text-slate-600">Classe
            <select value={cls} onChange={(e) => { setCls(e.target.value); setStudent(CLASSES.find(([c]) => c === e.target.value)[1](settings)[0].student); }} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">
              {CLASSES.map(([c]) => <option key={c}>{c}</option>)}
            </select>
          </label>
          <StudentSelect students={bulletins.map((x) => x.student)} value={current.student} onChange={setStudent} />
          <label className="flex items-center gap-1.5 pb-2 text-xs text-slate-600"><input type="checkbox" checked={showGeneral} onChange={(e) => setShowGeneral(e.target.checked)} />Afficher la moyenne générale</label>
        </div>
        <label className="mt-3 block text-xs font-medium text-slate-600">Appréciation générale (Cheffe d'établissement, après le conseil)
          <textarea rows={2} value={general[`${cls}:${current.student}`] ?? ''} onChange={(e) => setGeneral({ ...general, [`${cls}:${current.student}`]: e.target.value })}
            className="mt-1 w-full rounded-xl border border-slate-200 p-2 text-sm" placeholder="Ex. Très bonne progression globale sur l'année. Investissement sérieux et résultats solides." />
        </label>
        {cls === IMPORTED && <p className="mt-2 text-xs text-slate-500">Élèves importés : moyennes et appréciations vides tant que les enseignants n'ont pas saisi leurs notes. La mise en page et les spécialités sont celles du vrai bulletin.</p>}
        <p className="mt-2 text-xs text-slate-500">Appréciations des matières : celles validées par chaque enseignant (ici, textes de démonstration). Moyenne de classe d'une spécialité : calculée sur les seuls élèves qui la suivent.</p>
      </Card>
      {cls === IMPORTED && <SpecialtiesPanel onChange={() => setVersion((v) => v + 1)} />}
      <div className="overflow-x-auto rounded-2xl bg-slate-100 p-4"><div className="bulletin-one min-w-[760px]"><BulletinSheet b={enrich(current)} /></div></div>
      <div className="bulletins-all hidden">{bulletins.map((x) => <BulletinSheet key={x.student} b={enrich(x)} />)}</div>
    </div>
  );
}
