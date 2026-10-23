import React, { useState } from 'react';
import { Avatar, Button, Card } from './ui.jsx';
import { logActivity, ACTOR } from '../activityStore.js';
import GradebookModule from './GradebookModule.jsx';
import HomeworkModule from './HomeworkModule.jsx';
import { ASSIGNMENTS, teacherSummary } from '../data/staffAssignments.js';
import { loadImport } from '../importStore.js';
import { TEACHER } from '../data/people.js';

// Direction et Bureau : consultation des notes, appréciations et du cahier de textes de chaque
// enseignant.e. Lecture seule ; la Direction peut passer en modification (administratrice).
// Enseignements de l'année : liste importée par l'établissement, sinon la liste de référence
const assignments = () => {
  const imp = loadImport();
  return imp?.assignments?.length ? imp.assignments : ASSIGNMENTS;
};
export const TEACHERS = [...new Set([TEACHER.name, ...assignments().map((a) => a.name)])];
// un professeur peut avoir plusieurs lignes (une par matière) : on les réunit
const subjectsOf = (t) => teacherSummary(t, assignments());

export default function TeacherOversight({ view = 'grades', role, ...props }) {
  const [teacher, setTeacher] = useState(TEACHERS[0]);
  const [tab, setTab] = useState(view);
  const [edit, setEdit] = useState(false);
  const hasData = teacher === TEACHER.name;
  // modification : geste sensible, confirmé et noté dans le journal
  const toggleEdit = () => {
    if (edit) { setEdit(false); return; }
    if (!window.confirm(`Modifier les notes ou le cahier de textes de ${teacher} ? La modification est enregistrée dans le journal de l'école.`)) return;
    logActivity({ who: ACTOR.DIRECTION, role: 'DIRECTION', kind: 'PROF', text: `Modification autorisée : ${tab === 'homework' ? 'cahier de textes' : 'notes et appréciations'} de ${teacher}` });
    setEdit(true);
  };
  const Screen = tab === 'homework' ? HomeworkModule : GradebookModule;
  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold text-navy-500">Direction et secrétariat · consultation</p>
        <h1 className="text-2xl font-semibold text-navy-900">Suivi des professeurs</h1>
      </div>
      <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-white p-3 shadow-soft">
        <Avatar name={teacher} className="h-9 w-9 text-xs" />
        <label className="text-xs text-slate-600">Enseignant·e
          <select value={teacher} onChange={(e) => { setTeacher(e.target.value); setEdit(false); }} className="nav-control mt-0.5 block rounded-lg border border-slate-200 px-2 py-1 text-sm text-slate-900">
            {TEACHERS.map((t) => <option key={t}>{t}</option>)}
          </select>
        </label>
        <p className="min-w-0 flex-1 text-xs text-slate-600">{hasData ? TEACHER.subjects : subjectsOf(teacher)}</p>
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${edit ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>{edit ? 'Modification en cours' : 'Consultation'}</span>
        {role === 'DIRECTION' && hasData && <Button variant={edit ? 'secondary' : 'primary'} className="nav-control !py-1 text-xs" onClick={toggleEdit}>{edit ? 'Revenir en consultation' : 'Modifier…'}</Button>}
      </div>
      <div className="inline-flex rounded-lg bg-slate-100 p-1" role="group" aria-label="Rubrique">{[['grades', 'Notes et appréciations'], ['homework', 'Cahier de textes']].map(([k, l]) => (
        <button key={k} type="button" aria-pressed={tab === k} onClick={() => setTab(k)} className={`nav-control rounded-md px-3 py-1 text-sm font-medium ${tab === k ? 'bg-white text-navy-900 shadow-sm' : 'text-slate-600'}`}>{l}</button>
      ))}</div>
      {hasData ? (
        <div className={edit ? '' : 'consultation'}><Screen key={`${teacher}-${tab}`} {...props} role={role} /></div>
      ) : (
        <Card title={`${teacher} — ${tab === 'homework' ? 'cahier de textes' : 'notes et appréciations'}`}>
          <p className="text-sm text-slate-600">Le prototype ne contient des notes que pour {TEACHER.name}. Dans l'ENT, les classes, devoirs, notes, appréciations
            et séances de {teacher} ({subjectsOf(teacher) || 'matières à renseigner'}) s'affichent ici, en lecture seule.</p>
        </Card>
      )}
    </div>
  );
}
