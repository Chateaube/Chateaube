import React, { useState } from 'react';
import { loadDelegations, setAbsent, LABELS, DELEGABLE } from '../delegationStore.js';
import { TODAY } from '../notify.js';

// Remplacement pour la journée : c'est la personne présente qui coche « Je remplace la CPE (ou le
// secrétariat) aujourd'hui » ; elle reçoit alors aussi les alertes du service absent. La Direction ne déclare rien.
export default function AbsentToggle({ role, onChange }) {
  const [all, setAll] = useState(loadDelegations);
  const other = DELEGABLE[role];
  const on = all[other]?.day === TODAY && all[other]?.to === role;
  return (
    <label className="flex items-center gap-2 rounded-2xl bg-white/80 px-4 py-2.5 text-sm text-slate-800 shadow-soft">
      <input type="checkbox" checked={on} onChange={(e) => { setAll(setAbsent(other, TODAY, e.target.checked)); onChange?.(); }} className="h-5 w-5" />
      Je remplace {LABELS[other]} aujourd'hui : ses alertes s'ajoutent aux miennes
    </label>
  );
}
