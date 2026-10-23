import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Badge, Button, Card, StudentSelect } from './ui.jsx';
import { BulletinSheet } from './Bulletin.jsx';
import { TERM, EVALUATIONS, GRADES, CLASS_SUBJECTS, OTHER_AVERAGES, ABSENCES, TEACHER_COMPETENCIES } from '../data/grades.js';
import { CLASS_LIST } from '../data/people.js';
import { TLE_G_SUBJECTS, TLE_G_STUDENTS } from '../data/bulletins.js';
import { COMPETENCY_HISTORY } from '../data/competencyHistory.js';
import { studentAverage, generalAverage, classStats } from '../rules/grading.js';
import { onBulletin } from '../rules/generalAppreciation.js';
import { subjectsOf, subjectClassAverage, classLine, specialtyErrors, SPECIALTIES, orderSubjects, moveSubject } from '../rules/bulletin.js';
import { loadImport, saveImport } from '../importStore.js';
import { demoAppreciation, accord } from '../rules/documents.js';
import { formatDateFr } from '../rules/calendar.js';
import { printOnly } from '../print.js';
import { loadTasks, saveTasks } from '../tasksStore.js';
import BulletinHandover from './BulletinHandover.jsx';
import { loadGA } from '../appreciationStore.js';
import { loadEngagements, loadCatalogue, loadValidation } from '../engagementsStore.js';
import { engagementLabels, attestationLabels } from '../rules/engagements.js';


// Bulletins du trimestre (Direction, Bureau) : une page A4 par élève, selon la matrice de l'établissement.
// Chaque bulletin ne contient que les matières de l'élève (spécialités en Terminale générale).

const longDate = (iso) => (iso ? formatDateFr(iso).replace(/^\S+ /, '') : '');
const COMP_KEY = { EMC: 'Enseignement moral et civique', 'Histoire-Géographie': 'Histoire-géographie', 'Sc. de gestion et numérique': 'Sciences de gestion et numérique' };
// Compétences du trimestre : celles de l'enseignant (ici, le dernier trimestre de la base), 4 lignes au plus
const compsFor = (key, level) => (COMPETENCY_HISTORY[`${key}|${level}`]?.[0]?.items ?? []).slice(0, 4);

// Dates de naissance fictives (démonstration 1re STMG)
const demoBirth = (i) => `2009-${String((i % 12) + 1).padStart(2, '0')}-${String(((i * 7) % 27) + 1).padStart(2, '0')}`;

// Mise en page du bulletin (Direction) : marges identiques des quatre côtés (1,3 cm par défaut) et, en bas
// de chaque page imprimée, « CE BULLETIN DOIT ÊTRE CONSERVÉ. AUCUN DUPLICATA NE SERA DÉLIVRÉ. »
const MM = 3.7795; // pixels CSS par millimètre
const marginOf = (settings) => settings.bulletin?.marginMm ?? 13;
const pageW = (m) => Math.round((210 - 2 * m) * MM);
const pageH = (m) => Math.round((297 - 2 * m) * MM);
export const bulletinPage = (m) => `size: A4 portrait; margin: ${m}mm;
  @bottom-center { content: "CE BULLETIN DOIT ÊTRE CONSERVÉ. AUCUN DUPLICATA NE SERA DÉLIVRÉ."; font-family: Poppins, sans-serif; font-size: 7pt; color: #475569; }`;

function buildPremiereSTMG(settings) {
  const excluded = settings.grading.excludedSubjects;
  const students = CLASS_LIST.map((name) => ({
    name,
    avgs: Object.fromEntries(CLASS_SUBJECTS.map((s) => [s.id, s.service ? studentAverage(EVALUATIONS[s.service], GRADES[s.service][name]) : OTHER_AVERAGES[name][s.id]])),
  }));
  const generals = students.map((st) => generalAverage(CLASS_SUBJECTS.map((s) => ({ ...s, inAverage: !excluded.includes(s.id), avg: st.avgs[s.id] }))));
  const ga = loadGA();
  return students.map((st, i) => ({
    term: '1er Trimestre', year: '2026/2027', student: st.name, birthLine: `Né(e) le ${longDate(demoBirth(i))}`, classLine: classLine('1re STMG'),
    rows: CLASS_SUBJECTS.filter((s) => s.id !== 'VDC').map((s) => ({
      label: s.label, teacher: s.teacher, avg: st.avgs[s.id], classAvg: subjectClassAverage(s.id, students),
      competencies: s.service ? (TEACHER_COMPETENCIES[s.service] ?? []).slice(0, 4) : compsFor(COMP_KEY[s.label] ?? s.label, '1re STMG'),
      appreciation: demoAppreciation(st.avgs[s.id]),
    })),
    general: generals[i], classGeneral: classStats(generals).avg, justified: ABSENCES[st.name]?.justified ?? 0, unjustified: ABSENCES[st.name]?.unjustified ?? 0, late: ABSENCES[st.name]?.late ?? 0,
    generalAppreciation: onBulletin(ga[st.name]), // seulement si validée par la Direction
  }));
}

function buildTerminaleG() {
  const generals = TLE_G_STUDENTS.map((st) => generalAverage(subjectsOf(st, TLE_G_SUBJECTS).map((s) => ({ ...s, inAverage: true, coef: 1, avg: st.avgs[s.id] }))));
  return TLE_G_STUDENTS.map((st, i) => ({
    term: '1er Trimestre', year: '2026/2027', student: st.name, sex: st.sex,
    birthLine: `${accord(st.sex, 'Né', 'Née')} le ${longDate(st.birthDate)}`,
    classLine: classLine('Terminale Générale', st.specialties),
    rows: subjectsOf(st, TLE_G_SUBJECTS).map((s) => ({
      label: s.label, teacher: s.teacher, avg: st.avgs[s.id], classAvg: subjectClassAverage(s.id, TLE_G_STUDENTS),
      competencies: compsFor(s.comp, 'Tle G'), appreciation: demoAppreciation(st.avgs[s.id]),
    })),
    general: generals[i], classGeneral: classStats(generals).avg, justified: st.justified, unjustified: st.unjustified, late: st.late,
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
    general: null, classGeneral: null, justified: 0, unjustified: 0, late: 0,
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

/** Mise en page (Direction) : marges et ordre des matières, communs à tous les bulletins. */
function LayoutPanel({ settings, onChange, labels }) {
  const b = settings.bulletin ?? {};
  const order = [...(b.subjectOrder ?? []).filter((l) => labels.includes(l)), ...labels.filter((l) => !(b.subjectOrder ?? []).includes(l))];
  const save = (patch) => onChange?.({ ...settings, bulletin: { ...b, ...patch } });
  const keepOthers = (next) => [...next, ...(b.subjectOrder ?? []).filter((l) => !labels.includes(l))];
  return (
    <details className="rounded-2xl bg-white p-4 shadow-soft">
      <summary className="cursor-pointer text-sm font-semibold text-navy-900">Mise en page du bulletin : marges et ordre des matières</summary>
      <div className="mt-3 grid gap-5 lg:grid-cols-[220px_1fr]">
        <label className="text-xs text-slate-600">Marges (haut, bas, gauche, droite)
          <span className="mt-1 flex items-center gap-2"><input inputMode="decimal" value={String((b.marginMm ?? 13) / 10).replace('.', ',')} onChange={(e) => { const v = Number(e.target.value.replace(',', '.')); if (v >= 0.5 && v <= 3) save({ marginMm: Math.round(v * 10) }); }} aria-label="Marges en centimètres" className="w-20 rounded-md border border-slate-300 px-2 py-1 text-sm" /> cm</span>
          <span className="mt-1 block text-[11px]">Les mêmes des quatre côtés. Le pied de page « CE BULLETIN DOIT ÊTRE CONSERVÉ… » s'imprime en bas de chaque page.</span>
        </label>
        <div>
          <p className="mb-1 text-xs text-slate-600">Ordre des matières (le même pour toutes les classes ; une matière absente d'une classe est simplement sautée)</p>
          <ol className="space-y-1">{order.map((l, i) => (
            <li key={l} className="flex items-center gap-2 rounded-md bg-slate-50 px-2 py-1 text-sm">
              <span className="w-6 text-right text-xs tabular-nums text-slate-500">{i + 1}.</span><span className="flex-1">{l}</span>
              <button type="button" disabled={i === 0} onClick={() => save({ subjectOrder: keepOthers(moveSubject(order, l, -1)) })} aria-label={`Monter ${l}`} className="h-7 w-7 rounded ring-1 ring-slate-300 disabled:opacity-40">↑</button>
              <button type="button" disabled={i === order.length - 1} onClick={() => save({ subjectOrder: keepOthers(moveSubject(order, l, 1)) })} aria-label={`Descendre ${l}`} className="h-7 w-7 rounded ring-1 ring-slate-300 disabled:opacity-40">↓</button>
            </li>
          ))}</ol>
        </div>
      </div>
    </details>
  );
}

export default function BulletinsModule({ settings, role, go, onChange }) {
  const [mode, setMode] = useState('print'); // impression ou remise en main propre
  const [readyAsked, setReadyAsked] = useState(false);
  const [CLASSES] = useState(classesNow);
  const [cls, setCls] = useState(CLASSES[0][0]);
  const [version, setVersion] = useState(0); // spécialités modifiées
  const [showGeneral, setShowGeneral] = useState(false);
  // appréciation générale : une seule saisie, au conseil de classe ; le bulletin reprend celle validée
  const [ga] = useState(loadGA);
  const generalOf = (name) => (ga[name]?.status === 'VALIDEE' ? ga[name].text ?? '' : '');
  const bulletins = useMemo(() => CLASSES.find(([c]) => c === cls)[1](settings).map((b) => ({ ...b, rows: orderSubjects(b.rows, settings.bulletin?.subjectOrder) })), [cls, settings, version]);
  const margin = marginOf(settings);
  const [student, setStudent] = useState(bulletins[0].student);
  const current = bulletins.find((x) => x.student === student) ?? bulletins[0];
  const [duplex, setDuplex] = useState(true);
  const [pages, setPages] = useState({}); // élève → nombre de pages imprimées (mesuré)
  const measureRef = useRef(null);
  // engagements et attestations : saisis et validés chaque trimestre dans « Engagements et attestations »
  const [engagements] = useState(loadEngagements);
  const [custom] = useState(loadCatalogue);
  const validated = loadValidation()[TERM.id];
  const enrich = (x) => ({ ...x, showGeneral, generalAppreciation: generalOf(x.student), engagements: engagementLabels(engagements[x.student], x.sex, custom), attestations: attestationLabels(engagements[x.student], custom) });
  // Mesure de chaque bulletin à la taille d'impression : 1 page (recto) ou 2 (recto-verso), jamais plus
  useLayoutEffect(() => {
    const el = measureRef.current;
    if (!el) return;
    const out = {};
    el.querySelectorAll('[data-student]').forEach((n) => {
      // mise en page fixe : on compte seulement les pages (jamais de police réduite)
      const normal = Math.ceil(n.querySelector('.bulletin').offsetHeight / pageH(margin));
      out[n.dataset.student] = { normal, printed: normal };
    });
    setPages(out);
  }, [bulletins, showGeneral, ga, margin]);
  const pagesOf = (name) => pages[name]?.printed ?? 1;
  const tooLong = bulletins.filter((x) => pagesOf(x.student) > 2);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-navy-500">{TERM.label} · Direction et secrétariat</p>
          <h1 className="text-2xl font-semibold text-navy-900">Bulletins</h1>
          <p className="text-sm text-slate-500">Une page A4 par élève, sur le modèle de l'établissement. Chaque bulletin ne garde que les matières de l'élève.</p>
        </div>
        {/* Impression : la Direction seule. Le secrétariat prépare et prévient la Direction (tâche). */}
        {role === 'DIRECTION' ? (
          <span className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => printOnly('.bulletin-one', bulletinPage(margin))}>Imprimer ce bulletin</Button>
            <Button onClick={() => printOnly('.bulletins-all', bulletinPage(margin))}>Imprimer toute la classe ({bulletins.length})</Button>
          </span>
        ) : (
          <span className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
            L'impression est faite par la Direction.
            <Button variant="secondary" disabled={readyAsked} onClick={() => { saveTasks([{ id: `t${Date.now()}`, title: `Imprimer les bulletins — ${cls} (${TERM.label})`, assignee: 'DIRECTION', priority: 'HAUTE', due: null, done: false, createdBy: role, createdAt: new Date().toISOString().slice(0, 16) }, ...loadTasks()]); setReadyAsked(true); }}>{readyAsked ? 'Direction prévenue ✓' : 'Prévenir la Direction : bulletins prêts'}</Button>
          </span>
        )}
      </div>
      <div className="flex gap-1 rounded-lg bg-slate-100 p-1" role="tablist">
        {[['print', 'Préparer et imprimer'], ['handover', 'Remise en main propre']].map(([id, label]) => (
          <button key={id} role="tab" aria-selected={mode === id} onClick={() => setMode(id)}
            className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ${mode === id ? 'bg-white text-navy-900 shadow-sm' : 'text-slate-600'}`}>{label}</button>
        ))}
      </div>
      {mode === 'handover' && (
        <>
          <label className="block w-60 text-xs font-medium text-slate-600">Classe
            <select value={cls} onChange={(e) => { setCls(e.target.value); setStudent(CLASSES.find(([c]) => c === e.target.value)[1](settings)[0].student); }} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">
              {CLASSES.map(([c]) => <option key={c}>{c}</option>)}
            </select>
          </label>
          <BulletinHandover cls={cls} students={bulletins.map((x) => x.student)} settings={settings} role={role} term="T1" />
        </>
      )}
      {mode === 'print' && (<>
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
        <div className={`mt-3 rounded-lg px-3 py-2 text-xs ${generalOf(current.student) ? 'bg-slate-50 text-slate-800' : 'bg-amber-50 text-amber-900'}`}>
          <strong>Appréciation générale (validée au conseil) :</strong> {generalOf(current.student) || 'pas encore validée au conseil de classe : le bulletin sortirait sans appréciation générale.'}
          {go && <button type="button" onClick={() => go('council')} className="ml-2 font-semibold underline">{generalOf(current.student) ? 'Corriger dans le conseil' : 'Ouvrir le conseil'}</button>}
        </div>
        {cls === IMPORTED && <p className="mt-2 text-xs text-slate-500">Élèves importés : moyennes et appréciations vides tant que les enseignants n'ont pas saisi leurs notes. La mise en page et les spécialités sont celles du vrai bulletin.</p>}
        <div className={`mt-3 rounded-lg px-3 py-2 text-xs ${validated ? 'bg-emerald-50 text-emerald-900' : 'bg-amber-50 text-amber-900'}`}>
          <strong>Engagements et attestations — {current.student} :</strong> {[...engagementLabels(engagements[current.student], current.sex, custom), ...attestationLabels(engagements[current.student], custom)].join(' · ') || 'aucun'}.
          {' '}{validated ? `Validés pour le ${TERM.label} le ${validated.at.split('-').reverse().join('/')}.` : `Pas encore validés pour le ${TERM.label} : à faire dans « Engagements et attestations ».`}
          {go && <button type="button" onClick={() => go('mandates')} className="ml-2 font-semibold underline">Ouvrir</button>}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-600">
          <span>Ce bulletin : <strong>{pagesOf(current.student) === 1 ? '1 page (recto)' : `${pagesOf(current.student)} pages (recto-verso)`}</strong></span>
          <label className="flex items-center gap-1.5"><input type="checkbox" checked={duplex} onChange={(e) => setDuplex(e.target.checked)} />Imprimante en recto-verso (une page blanche après les bulletins d'une page, pour que chaque élève commence sur une nouvelle feuille)</label>
          {tooLong.length > 0 && <Badge tone="red">{tooLong.length} bulletin{tooLong.length > 1 ? 's' : ''} encore trop long{tooLong.length > 1 ? 's' : ''} : raccourcir compétences ou appréciations</Badge>}
        </div>
        <p className="mt-2 text-xs text-slate-500">Appréciations des matières : celles validées par chaque enseignant (ici, textes de démonstration). Moyenne de classe d'une spécialité : calculée sur les seuls élèves qui la suivent.</p>
      </Card>
      {cls === IMPORTED && <SpecialtiesPanel onChange={() => setVersion((v) => v + 1)} />}
      {role === 'DIRECTION' && <LayoutPanel settings={settings} onChange={onChange} labels={[...new Set(bulletins.flatMap((b) => b.rows.map((r) => r.label)))]} />}
      <div className="overflow-x-auto rounded-2xl bg-slate-100 p-4"><div className="bulletin-one min-w-[760px]"><BulletinSheet b={enrich(current)} /></div></div>
      </>)}
      <div className="bulletins-all hidden">{bulletins.map((x) => (
        <React.Fragment key={x.student}>
          <BulletinSheet b={enrich(x)} />
          {duplex && pagesOf(x.student) === 1 && <div className="blank-page" aria-hidden="true" />}
        </React.Fragment>
      ))}</div>
      {/* mesure hors écran, à la largeur et à la police d'impression */}
      <div ref={measureRef} className="bulletin-measure pointer-events-none fixed -left-[5000px] top-0" style={{ width: pageW(margin) }} aria-hidden="true">
        {bulletins.map((x) => (
          <div key={x.student} data-student={x.student}>
            <BulletinSheet b={enrich(x)} />
          </div>
        ))}
      </div>
    </div>
  );
}
