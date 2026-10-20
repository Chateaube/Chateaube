import React, { useState } from 'react';
import { Card } from './ui.jsx';
import CouncilGrid from './CouncilGrid.jsx';
import { TERM } from '../data/grades.js';

// Conseils de classe : une seule page, choix de la classe et du trimestre. L'impression de la grille (avec le
// choix des colonnes) est en bas de la grille du conseil : plus d'écran « Grilles de notes » à part.
// Démonstration : seules les notes de la 1re STMG au 1er trimestre sont saisies.
const CLASSES = ['6e', '5e', '4e', '3e', '2de', '1re STMG', '1re Générale', 'Terminale STMG', 'Terminale Générale'];
const TERMS = [['T1', '1er trimestre'], ['T2', '2e trimestre'], ['T3', '3e trimestre']];
const DEMO_CLASS = '1re STMG';

export default function CouncilScreen(props) {
  const [cls, setCls] = useState(DEMO_CLASS);
  const [term, setTerm] = useState(TERM.id);
  const field = 'rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm';
  const ready = cls === DEMO_CLASS && term === TERM.id;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs font-medium text-slate-600">Classe<select value={cls} onChange={(e) => setCls(e.target.value)} className={`mt-1 block ${field}`}>{CLASSES.map((c) => <option key={c}>{c}</option>)}</select></label>
        <label className="text-xs font-medium text-slate-600">Trimestre<select value={term} onChange={(e) => setTerm(e.target.value)} className={`mt-1 block ${field}`}>{TERMS.map(([t, l]) => <option key={t} value={t}>{l}{t === TERM.id ? ' (en cours)' : ''}</option>)}</select></label>
      </div>
      {ready ? <CouncilGrid {...props} /> : (
        <Card>
          <p className="text-sm text-slate-700">{term !== TERM.id
            ? `Le ${TERMS.find(([t]) => t === term)[1]} s'ouvre quand la Direction clôture le ${TERM.label}. Imprimer les bulletins ne clôture rien.`
            : `Pas encore de notes validées pour la ${cls} : la grille se remplit au fur et à mesure que les enseignants valident leurs notes.`}</p>
        </Card>
      )}
    </div>
  );
}
