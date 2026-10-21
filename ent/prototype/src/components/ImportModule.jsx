import React, { useMemo, useRef, useState } from 'react';
import { csvCell } from '../rules/csv.js';
import { Badge, Button, Card, Stat } from './ui.jsx';
import { parseTable, analyzeStudents, parseAssignments } from '../rules/importer.js';
import { loadImport, saveImport, clearImport } from '../importStore.js';
import { hoursByClass } from '../rules/timetableImport.js';
import { saveFile } from '../download.js';
import { readXlsx } from '../xlsxRead.js';
import { bookToImport, withExtras, SHEET_NAMES } from '../rules/templateImport.js';
import { loadMockExams, saveMockExams } from '../mockExamStore.js';
import { saveInventory } from '../careStore.js';
import BackupCard from './BackupCard.jsx';

// Onglets du modèle pris en compte dès maintenant ; les autres seront repris par la version serveur
const USED = { '4 Emploi du temps': 'emploi du temps', '1 Élèves': 'fiches élèves', '2 Responsables': 'responsables des élèves', '3 Personnel': 'professeurs et enseignements', '6 Notes officielles 1re': 'projection au bac', '10 Inventaire': 'inventaire' };

/** Compte rendu de l'emploi du temps lu : cours, lignes à corriger, chevauchements, heures par classe. */
function TimetableReport({ t }) {
  const hours = hoursByClass(t.slots);
  const fmt = (h) => String(Math.round(h * 100) / 100).replace('.', ',');
  return (
    <div className="mt-3 rounded-xl border border-slate-200 p-3 text-sm">
      <p className="font-semibold text-navy-900">Emploi du temps : {t.slots.length} cours lus{t.slots.some((x) => x.week) ? ` (dont ${t.slots.filter((x) => x.week).length} en semaine A ou B)` : ''}</p>
      {t.errors.length > 0 && <div className="mt-1 rounded-md bg-red-50 p-2 text-xs text-red-800"><p className="font-semibold">{t.errors.length} ligne{t.errors.length > 1 ? 's' : ''} à corriger (non importée{t.errors.length > 1 ? 's' : ''})</p>{t.errors.slice(0, 12).map((e) => <p key={e}>· {e}</p>)}</div>}
      {t.warnings.length > 0 && <div className="mt-1 rounded-md bg-amber-50 p-2 text-xs text-amber-900"><p className="font-semibold">À vérifier : {t.warnings.length} chevauchement{t.warnings.length > 1 ? 's' : ''}</p>{t.warnings.slice(0, 12).map((w) => <p key={w}>· {w}</p>)}</div>}
      <p className="mt-2 text-xs text-slate-600">Heures par semaine : {Object.entries(hours).map(([c, h]) => `${c} ${fmt(h.A)} h${h.A !== h.B ? ` (B : ${fmt(h.B)} h)` : ''}`).join(' · ')}</p>
    </div>
  );
}

function TemplateZone({ onBook, extras }) {
  const file = useRef(null);
  const [err, setErr] = useState('');
  return (
    <Card title="Importer le modèle Excel" subtitle="Le classeur « modele-import-chateaubriand.xlsx » rempli (onglets 1 à 10), ou seulement le fichier de l'emploi du temps (onglet « EDT à importer »). Les lignes « Exemple » sont ignorées.">
      <input ref={file} type="file" accept=".xlsx" className="hidden" onChange={async (e) => {
        const f = e.target.files[0]; e.target.value = ''; if (!f) return;
        try { setErr(''); onBook(bookToImport(await readXlsx(await f.arrayBuffer()))); } catch (x) { setErr(x.message); }
      }} />
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => file.current.click()}>Choisir le fichier Excel (.xlsx)</Button>
        <a href="https://chateaube.github.io/Chateaube/ent/modeles/modele-import-chateaubriand.xlsx" target="_blank" rel="noreferrer" className="text-sm font-medium text-navy-500 underline">Télécharger le modèle vide</a>
      </div>
      {err && <p className="mt-2 text-sm text-red-700">{err}</p>}
      {extras && (
        <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200 text-sm">
          {SHEET_NAMES.map((n) => (
            <li key={n} className="flex items-center justify-between gap-2 px-3 py-1.5">
              <span>{n} <span className="text-slate-500">· {extras.counts[n] ?? 0} ligne{(extras.counts[n] ?? 0) > 1 ? 's' : ''}</span></span>
              {!extras.counts[n] ? <Badge>vide — ignoré</Badge> : USED[n] ? <Badge tone="green">{USED[n]}</Badge> : <Badge tone="slate">gardé pour la version en ligne</Badge>}
            </li>
          ))}
        </ul>
      )}
      {extras?.officialErrors?.length > 0 && <p className="mt-2 text-xs text-red-700">{extras.officialErrors.slice(0, 5).join(' ')}</p>}
      {extras?.timetable && <TimetableReport t={extras.timetable} />}
      {extras && <p className="mt-2 text-xs text-slate-500">Vérifiez ci-dessous les élèves et les professeurs, puis cliquez sur « Importer ».</p>}
    </Card>
  );
}

// Import des données existantes (Direction, Bureau) : UN seul fichier, le modèle Excel de l'école.
// Un onglet vide est ignoré (on peut n'importer que les élèves). Vérifier, puis importer.
// Les données restent dans CE navigateur : elles ne sont ni publiées ni partagées. Sauvegarde en bas de page.

const fmt = (iso) => (iso ? iso.split('-').reverse().join('/') : '—');
const ORDER = ['6e', '5e', '4e', '3e', '2de', '1re Générale', '1re STMG', 'Terminale Générale', 'Terminale STMG'];

const studentId = (x) => `${x.lastName} ${x.firstName} ${x.birthDate ?? ''}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
/** Fusion d'un réimport : les fiches du fichier remplacent les mêmes élèves, les autres sont gardées. */
export function mergeStudents(previous, incoming) {
  const byId = new Map(previous.map((x) => [studentId(x), x]));
  incoming.forEach((x) => byId.set(studentId(x), { ...byId.get(studentId(x)), ...x }));
  return [...byId.values()];
}

export default function ImportModule() {
  const [current, setCurrent] = useState(loadImport);
  const [studentsText, setStudentsText] = useState('');
  const [staffText, setStaffText] = useState('');
  const [filter, setFilter] = useState('issues');
  const [done, setDone] = useState(null);
  const [renumber, setRenumber] = useState(true);
  const [extras, setExtras] = useState(null);
  const onBook = (res) => { setExtras(res); if (res.studentsTsv) setStudentsText(res.studentsTsv); if (res.staffTsv) setStaffText(res.staffTsv); setDone(null); };

  const analysis = useMemo(() => (studentsText.trim() ? analyzeStudents(parseTable(studentsText).rows) : null), [studentsText]);
  const assignments = useMemo(() => (staffText.trim() ? parseAssignments(parseTable(staffText).rows) : null), [staffText]);
  const count = (lvl) => analysis?.students.filter((s) => s.issues.some((i) => i.level === lvl)).length ?? 0;
  const issueTypes = useMemo(() => {
    const m = {};
    analysis?.students.forEach((s) => s.issues.forEach((i) => { const k = i.text.replace(/« .* »/, '«…»').replace(/\(ligne \d+\)/, ''); m[k] = (m[k] ?? 0) + 1; }));
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [analysis]);
  const shown = analysis?.students.filter((s) => (filter === 'all' ? true : filter === 'errors' ? s.issues.some((i) => i.level === 'error')
    : s.issues.some((i) => !i.text.startsWith('Aucun responsable')))) ?? [];

  const doImport = () => {
    const data = {
      // Réimport : fusion, jamais d'effacement — un élève déjà importé (même nom, même date de naissance) est
      // mis à jour, un nouveau est ajouté, ceux qui ne figurent pas dans ce fichier sont gardés.
      students: analysis ? mergeStudents(current?.students ?? [], withExtras(analysis.students.map((s) => (renumber && s.student.suggestedNumber ? { ...s.student, number: s.student.suggestedNumber } : s.student)), extras ?? {})) : current?.students ?? [],
      assignments: assignments ?? current?.assignments ?? [],
      // emploi du temps : le nouveau remplace l'ancien en entier (c'est la semaine type de l'année)
      timetable: extras?.timetable?.slots.length ? extras.timetable.slots : current?.timetable ?? null,
    };
    saveImport(data);
    setCurrent(loadImport());
    let more = '';
    if (extras && Object.keys(extras.official).length) {
      // notes rangées sous le nom de l'élève tel qu'il apparaît dans l'ENT (« NOM Prénom »)
      const nameOf = Object.fromEntries(data.students.map((x) => [`${x.lastName} ${x.firstName}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase(), `${x.lastName} ${x.firstName}`]));
      const m = loadMockExams();
      saveMockExams({ ...m, official: { ...m.official, ...Object.fromEntries(Object.entries(extras.official).map(([k, v]) => [nameOf[k] ?? k, v])) } });
      more += ` Notes officielles de 1re : ${Object.keys(extras.official).length} élèves.`;
    }
    if (extras?.inventory.length) { saveInventory(extras.inventory); more += ` Inventaire : ${extras.inventory.length} articles.`; }
    if (extras?.timetable?.slots.length) more += ` Emploi du temps : ${extras.timetable.slots.length} cours.`;
    setDone(`${data.students.length} élèves et ${data.assignments.length} professeurs importés.${more} Ils apparaissent dans Inscriptions & fiches élèves, Encaisser et la consultation des professeurs.`);
  };
  const exportToComplete = () => {
    const cell = csvCell;
    const lines = [['N°', 'Classe', 'Nom', 'Prénom', 'À compléter ou corriger'],
      ...analysis.students.filter((s) => s.issues.length).map((s) => [s.student.number, s.student.cls, s.student.lastName, s.student.firstName, s.issues.map((i) => i.text).join(' · ')])];
    saveFile('eleves-a-completer.csv', `﻿${lines.map((l) => l.map((v) => cell(String(v ?? ''))).join(';')).join('\r\n')}\r\n`);
  };

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-semibold text-navy-500">Reprise des données existantes · année 2026-2027</p>
        <h1 className="text-2xl font-semibold text-navy-900">Importer et sauvegarder</h1>
        <p className="text-sm text-slate-600">Un seul fichier : le modèle Excel de l'école. Remplissez les onglets que vous avez ; un onglet vide est simplement ignoré. Réimporter plus tard un fichier complété ne double rien : les élèves déjà présents sont mis à jour, les nouveaux sont ajoutés, aucun n'est effacé.</p>
      </div>
      <p className="rounded-2xl bg-amber-50 p-3 text-sm text-amber-900">
        Confidentialité : les données importées restent <strong>dans ce navigateur</strong> (cet ordinateur ou ce téléphone).
        Elles ne sont pas publiées et les personnes avec qui vous partagez le lien ne les voient pas.
      </p>

      {current && (
        <Card title="Données actuellement importées" subtitle={`Le ${new Date(current.importedAt).toLocaleString('fr-FR')}`}
          action={<Button variant="secondary" className="!py-1 text-xs" onClick={() => { clearImport(); setCurrent(null); setDone(null); }}>Effacer et revenir aux données fictives</Button>}>
          <p className="text-sm text-slate-700">{current.students.length} élèves · {current.assignments.length} professeurs</p>
        </Card>
      )}
      {done && <p className="rounded-2xl bg-emerald-50 p-3 text-sm text-emerald-800">{done} Rechargez la page si un écran était déjà ouvert.</p>}
      <TemplateZone onBook={onBook} extras={extras} />

      {assignments && (
        <Card title={`Professeurs et enseignements (${assignments.length})`} subtitle="Lus dans l'onglet « 3 Personnel » du modèle">
          <ul className="max-h-56 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200 text-sm">
            {assignments.map((a) => <li key={a.name} className="px-3 py-1.5"><span className="font-medium">{a.name}</span> · {a.subjects.join(', ')}<span className="block text-xs text-slate-500">{a.classes.join(' · ')}</span></li>)}
          </ul>
        </Card>
      )}

      {analysis && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Élèves reconnus" value={analysis.students.length} hint={`${Object.keys(analysis.byClass).length} classes`} tone="green" />
            <Stat label="Lignes avec erreur" value={count('error')} hint="à corriger avant import" tone="red" />
            <Stat label="Lignes ignorées" value={analysis.ignored.length} hint={analysis.ignored.map((i) => i.number).join(', ') || 'aucune'} />
            <Stat label="Numéros sautés" value={analysis.gaps.length} hint={analysis.gaps.length ? `${analysis.gaps.join(', ')} — départs ou inscrits jamais venus` : 'aucun'} />
          </div>
          <Card title="Contrôle avant import" subtitle="Rien n'est bloquant sauf les erreurs ; les manques se complètent ensuite dans les fiches élèves"
            action={<Button variant="secondary" className="!py-1 text-xs" onClick={exportToComplete}>Exporter la liste à compléter (Excel)</Button>}>
            {analysis.students.some((s) => /^(1re|Terminale) Générale$/.test(s.student.cls) && !s.student.specialties?.length) && <p className="mb-3 rounded-lg bg-amber-50 p-2.5 text-xs text-amber-900">Spécialités : ajoutez une colonne « Spécialités » (ex. Maths, PC) pour les élèves de 1re et Terminale générales, ou choisissez-les après l'import dans Pédagogie → Bulletins.</p>}
            {!analysis.students.some((s) => s.student.enteredOn) && <p className="mb-3 rounded-lg bg-amber-50 p-2.5 text-xs text-amber-900">Ancienneté : ajoutez une colonne « Entrée » (année d'entrée, ex. 2024) ou « Ancienneté » (ex. 2 ans, nouveau) pour distinguer nouveaux et anciens élèves (inscription ou réinscription). Elle peut aussi se saisir ensuite dans chaque fiche.</p>}
            {analysis.nationalityIsExtra && <p className="mb-3 rounded-lg bg-navy-50 p-2.5 text-xs text-navy-900">Colonne « Nationalité (en +) » : chaque élève est malgache, la colonne indique une nationalité en plus (ex. malgache et française). Une case vide = malgache seulement.</p>}
            <div className="flex flex-wrap gap-2">
              {ORDER.filter((c) => analysis.byClass[c]).map((c) => <Badge key={c} tone="navy">{c} : {analysis.byClass[c]}</Badge>)}
              {Object.keys(analysis.byClass).filter((c) => !ORDER.includes(c)).map((c) => <Badge key={c} tone="red">Classe inconnue « {c} » : {analysis.byClass[c]}</Badge>)}
            </div>
            <ul className="mt-3 space-y-1 text-sm">
              {issueTypes.map(([t, n]) => <li key={t} className="flex justify-between gap-3 rounded-lg bg-slate-50 px-3 py-1.5"><span>{t}</span><span className="tabular-nums text-slate-500">{n}</span></li>)}
            </ul>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
              <span className="text-slate-500">Afficher :</span>
              {[['issues', 'à vérifier'], ['errors', 'erreurs seulement'], ['all', 'tous']].map(([k, l]) => (
                <button key={k} onClick={() => setFilter(k)} className={`rounded-full px-3 py-1 ${filter === k ? 'bg-navy-500 text-white' : 'bg-slate-100 text-slate-600'}`}>{l}</button>
              ))}
            </div>
            <div className="-mx-5 mt-3 max-h-[480px] overflow-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead className="sticky top-0 bg-white"><tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                  <th className="px-5 py-2">N°</th><th className="px-2">Élève</th><th className="px-2">Classe</th><th className="px-2">Né.e le</th>
                  <th className="px-2">Nationalité</th><th className="px-2">Contact</th><th className="px-5">À vérifier</th>
                </tr></thead>
                <tbody>
                  {shown.map(({ student: s, issues, line }) => (
                    <tr key={line} className="border-b border-slate-100 align-top">
                      <td className="px-5 py-2 text-xs tabular-nums text-slate-500">{s.number}</td>
                      <td className="px-2 py-2 font-medium">{s.lastName} {s.firstName}</td>
                      <td className="px-2 py-2">{s.cls}</td>
                      <td className="px-2 py-2 tabular-nums">{fmt(s.birthDate)}</td>
                      <td className="px-2 py-2">{s.nationalities.join(', ') || '—'}</td>
                      <td className="px-2 py-2 text-xs text-slate-600">{s.email}{s.phones.length ? <span className="block">{s.phones.join(' / ')}</span> : null}</td>
                      <td className="px-5 py-2 text-xs">
                        {issues.filter((i) => filter === 'all' || !i.text.startsWith('Aucun responsable')).map((i) => (
                          <span key={i.text} className={`block ${i.level === 'error' ? 'text-red-700' : 'text-amber-700'}`}>· {i.text}</span>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {!analysis && !assignments && !extras && <p className="text-sm text-slate-600">Choisissez le fichier Excel rempli : les élèves et les professeurs s'affichent ici pour vérification avant l'import.</p>}
      {(analysis || assignments || extras?.timetable?.slots.length > 0) && (
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={doImport}>
            Importer {[analysis && `${analysis.students.length} élèves`, assignments && `${assignments.length} professeurs`, extras?.timetable?.slots.length && `l'emploi du temps (${extras.timetable.slots.length} cours)`].filter(Boolean).join(', ')}
          </Button>
          {analysis?.students.some((x) => x.student.suggestedNumber) && (
            <label className="flex items-center gap-1.5 text-xs text-slate-700"><input type="checkbox" checked={renumber} onChange={(e) => setRenumber(e.target.checked)} />
              Attribuer les n° proposés aux doublons ({analysis.students.filter((x) => x.student.suggestedNumber).map((x) => `${x.student.lastName} → ${x.student.suggestedNumber}`).join(', ')})</label>
          )}
          {count('error') > 0 && <p className="text-xs text-red-700">{count('error')} ligne(s) avec erreur seront importées telles quelles : corrigez-les ensuite dans les fiches élèves.</p>}
        </div>
      )}

      <BackupCard />
    </div>
  );
}
