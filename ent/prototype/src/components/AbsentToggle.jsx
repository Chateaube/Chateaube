import React, { useState } from 'react';
import { loadDelegations, setAbsent, LABELS, TO_LABELS, DELEGABLE } from '../delegationStore.js';
import { TODAY } from '../notify.js';

// « Je suis absente aujourd'hui » : mes alertes du jour vont aussi à ma remplaçante (CPE ↔ secrétariat).
export default function AbsentToggle({ role, onChange }) {
  const [all, setAll] = useState(loadDelegations);
  const mine = all[role]?.day === TODAY;
  const covered = Object.entries(all).find(([from, d]) => d.to === role && d.day === TODAY)?.[0];
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-white/80 px-4 py-2.5 text-sm shadow-soft">
      <label className="flex items-center gap-2 text-slate-800">
        <input type="checkbox" checked={mine} onChange={(e) => { setAll(setAbsent(role, TODAY, e.target.checked)); onChange?.(); }} className="h-5 w-5" />
        Absent·e aujourd'hui : mes alertes vont aussi {TO_LABELS[DELEGABLE[role]]}
      </label>
      {covered && <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-900">Vous remplacez {LABELS[covered]} aujourd'hui : ses alertes sont dans votre liste.</span>}
    </div>
  );
}
