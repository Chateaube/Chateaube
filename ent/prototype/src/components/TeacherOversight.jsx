import React, { useState } from 'react';
import { Avatar, Card } from './ui.jsx';
import GradebookModule from './GradebookModule.jsx';
import HomeworkModule from './HomeworkModule.jsx';
import { ASSIGNMENTS } from '../data/staffAssignments.js';
import { loadImport } from '../importStore.js';
import { TEACHER } from '../data/people.js';

// Direction et Bureau : consultation des notes, appréciations et du cahier de textes de chaque
// enseignant.e. Lecture seule ; la Direction peut passer en modification (administratrice).
// Enseignements de l'année : liste importée par l'établissement, sinon la liste de référence
const assignments = () => {
  const imp = loadImport();
  return imp?.assignments?.length ? imp.assignments : ASSIGNMENTS;
};
export const TEACHERS = [TEACHER.name, ...assignments().map((a) => a.name)];
const subjectsOf = (t) => {
  const a = assignments().find((x) => x.name === t);
  return a ? `${a.subjects.join(', ')} · ${a.classes.join(', ')}` : '';
};

export default function TeacherOversight({ view, role, ...props }) {
  const [teacher, setTeacher] = useState(TEACHERS[0]);
  const [edit, setEdit] = useState(false);
  const hasData = teacher === TEACHER.name;
  const Screen = view === 'homework' ? HomeworkModule : GradebookModule;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-white p-3 shadow-soft">
        <Avatar name={teacher} className="h-9 w-9 text-xs" />
        <label className="text-xs text-slate-600">Enseignant.e
          <select value={teacher} onChange={(e) => setTeacher(e.target.value)} className="mt-0.5 block rounded-lg border border-slate-200 px-2 py-1 text-sm text-slate-900">
            {TEACHERS.map((t) => <option key={t}>{t}</option>)}
          </select>
        </label>
        <p className="text-xs text-slate-500">{hasData ? TEACHER.subjects : subjectsOf(teacher)}</p>
        <span className="ml-auto rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">{edit ? 'Modification (Direction)' : 'Consultation'}</span>
        {role === 'DIRECTION' && hasData && (
          <label className="flex items-center gap-1.5 text-xs text-slate-600"><input type="checkbox" checked={edit} onChange={(e) => setEdit(e.target.checked)} />Autoriser la modification</label>
        )}
      </div>
      {hasData ? (
        <div className={edit ? '' : 'consultation'}><Screen key={teacher} {...props} role={role} /></div>
      ) : (
        <Card title={`${teacher} — ${view === 'homework' ? 'cahier de textes' : 'notes & appréciations'}`}>
          <p className="text-sm text-slate-600">Le prototype ne contient des notes que pour {TEACHER.name}. Dans l'ENT, les classes, devoirs, notes, appréciations
            et séances de {teacher} ({subjectsOf(teacher) || 'matières à renseigner'}) s'affichent ici, en lecture seule.</p>
        </Card>
      )}
    </div>
  );
}
