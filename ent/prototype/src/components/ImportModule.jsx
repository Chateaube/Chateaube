import React, { useMemo, useRef, useState } from 'react';
import { Badge, Button, Card, Stat } from './ui.jsx';
import { parseTable, analyzeStudents, parseAssignments } from '../rules/importer.js';
import { loadImport, saveImport, clearImport } from '../importStore.js';
import { saveFile } from '../download.js';

// Import des données existantes (Direction, Bureau) : coller le tableau Excel des élèves de
// l'année en cours et celui des enseignements, vérifier, puis importer.
// Les données restent dans CE navigateur : elles ne sont ni publiées ni partagées.

const fmt = (iso) => (iso ? iso.split('-').reverse().join('/') : '—');
const ORDER = ['6e', '5e', '4e', '3e', '2de', '1re Générale', '1re STMG', 'Terminale Générale', 'Terminale STMG'];

function PasteZone({ label, placeholder, value, onChange }) {
  const file = useRef(null);
  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium text-slate-600">{label}</p>
        <span className="flex gap-2">
          <input ref={file} type="file" accept=".csv,.tsv,.txt" className="hidden" onChange={async (e) => { const f = e.target.files[0]; if (f) onChange(await f.text()); e.target.value = ''; }} />
          <Button variant="secondary" className="!py-1 text-xs" onClick={() => file.current.click()}>Ouvrir un fichier CSV</Button>
          {value && <Button variant="ghost" className="!py-1 text-xs" onClick={() => onChange('')}>Vider</Button>}
        </span>
      </div>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={7} placeholder={placeholder}
        className="w-full rounded-xl border border-slate-200 bg-white p-3 font-mono text-xs" spellCheck={false} />
    </div>
  );
}

export default function ImportModule() {
  const [current, setCurrent] = useState(loadImport);
  const [studentsText, setStudentsText] = useState('');
  const [staffText, setStaffText] = useState('');
  const [filter, setFilter] = useState('issues');
  const [done, setDone] = useState(null);

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
      students: analysis ? analysis.students.map((s) => s.student) : current?.students ?? [],
      assignments: assignments ?? current?.assignments ?? [],
    };
    saveImport(data);
    setCurrent(loadImport());
    setDone(`${data.students.length} élèves et ${data.assignments.length} professeurs importés. Ils apparaissent dans Inscriptions & fiches élèves, Encaisser et la consultation des professeurs.`);
  };
  const exportToComplete = () => {
    const cell = (v) => (/[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const lines = [['N°', 'Classe', 'Nom', 'Prénom', 'À compléter ou corriger'],
      ...analysis.students.filter((s) => s.issues.length).map((s) => [s.student.number, s.student.cls, s.student.lastName, s.student.firstName, s.issues.map((i) => i.text).join(' · ')])];
    saveFile('eleves-a-completer.csv', `﻿${lines.map((l) => l.map((v) => cell(String(v ?? ''))).join(';')).join('\r\n')}\r\n`);
  };

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-semibold text-navy-500">Reprise des données existantes · année 2026-2027</p>
        <h1 className="text-2xl font-semibold text-navy-900">Importer des données</h1>
        <p className="text-sm text-slate-500">Copiez le tableau dans Excel (ligne de titres comprise) et collez-le ici, ou ouvrez un fichier CSV.</p>
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

      <div className="grid gap-5 xl:grid-cols-2">
        <Card title="1. Élèves de l'année en cours" subtitle="Colonnes reconnues : N°, Classe, Nom, Prénom, Née le, Lieu de naissance, Nationalité, Examen, Adresse @, Contact">
          <PasteZone label="Tableau des élèves" value={studentsText} onChange={setStudentsText}
            placeholder={'N°\tClasse\tNom\tPrénom\tNée le\tLieu de naissance\tNationalité\tExamen FR\tAdresse @\tContact\n3E-001\t3e\tRAKOTO\tFanja\t12/03/2012\tToamasina, Madagascar\tMalgache\tDNB\tfanja@gmail.com\t03 40 00 00 00'} />
        </Card>
        <Card title="2. Professeurs et enseignements" subtitle="Colonnes : Nom, Matière, Classe (classes séparées par « - »)">
          <PasteZone label="Tableau des enseignements" value={staffText} onChange={setStaffText} placeholder={'NOM\tMatière\tClasse\nMme Rabe\tFrançais\t6e - 5e - 4e'} />
          {assignments && (
            <ul className="mt-3 max-h-56 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200 text-sm">
              {assignments.map((a) => <li key={a.name} className="px-3 py-1.5"><span className="font-medium">{a.name}</span> · {a.subjects.join(', ')}<span className="block text-xs text-slate-500">{a.classes.join(' · ')}</span></li>)}
            </ul>
          )}
        </Card>
      </div>

      {analysis && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Élèves reconnus" value={analysis.students.length} hint={`${Object.keys(analysis.byClass).length} classes`} tone="green" />
            <Stat label="Lignes avec erreur" value={count('error')} hint="à corriger avant import" tone="red" />
            <Stat label="Lignes ignorées" value={analysis.ignored.length} hint={analysis.ignored.map((i) => i.number).join(', ') || 'aucune'} />
            <Stat label="Numéros sautés" value={analysis.gaps.length} hint={analysis.gaps.join(', ') || 'aucun'} tone="amber" />
          </div>
          <Card title="Contrôle avant import" subtitle="Rien n'est bloquant sauf les erreurs ; les manques se complètent ensuite dans les fiches élèves"
            action={<Button variant="secondary" className="!py-1 text-xs" onClick={exportToComplete}>Exporter la liste à compléter (Excel)</Button>}>
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

      {(analysis || assignments) && (
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={doImport}>
            Importer {analysis ? `${analysis.students.length} élèves` : ''}{analysis && assignments ? ' et ' : ''}{assignments ? `${assignments.length} professeurs` : ''}
          </Button>
          {count('error') > 0 && <p className="text-xs text-red-700">{count('error')} ligne(s) avec erreur seront importées telles quelles : corrigez-les ensuite dans les fiches élèves.</p>}
        </div>
      )}
    </div>
  );
}
