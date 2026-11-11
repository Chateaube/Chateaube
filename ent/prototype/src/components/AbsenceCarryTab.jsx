import React, { useMemo, useState } from 'react';
import { Card } from './ui.jsx';
import { usePersistent } from '../persist.js';
import { loadProfiles } from '../profilesStore.js';
import { CARRY_KEY } from '../rules/absenceCarry.js';

// Reprise du 1er trimestre : pour chaque élève, les totaux relevés sur papier avant l'ENT
// (demi-journées justifiées / non justifiées, retards). Ils s'ajoutent à l'ENT sur le bulletin.
const ORDER = ['6e', '5e', '4e', '3e', '2de', '1re Générale', '1re STMG', 'Terminale Générale', 'Terminale STMG'];
const COLS = [['justified', 'Absences justifiées (1/2 j)'], ['unjustified', 'Absences non justifiées (1/2 j)'], ['late', 'Retards']];

export default function AbsenceCarryTab({ readOnly = false }) {
  const [carry, setCarry] = usePersistent(CARRY_KEY, { until: '', students: {} });
  const profiles = useMemo(() => loadProfiles(), []);
  const classes = ORDER.filter((c) => profiles.some((p) => p.cls === c));
  const [cls, setCls] = useState(classes[0] ?? '');
  const list = profiles.filter((p) => p.cls === cls).sort((a, b) => `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, 'fr'));
  const set = (name, k, v) => setCarry((prev) => ({ ...prev, students: { ...prev.students, [name]: { ...(prev.students?.[name] ?? {}), [k]: v === '' ? '' : Math.max(0, Math.round(Number(v) || 0)) } } }));
  const filled = (c) => profiles.filter((p) => p.cls === c && Object.values(carry.students?.[`${p.lastName} ${p.firstName}`] ?? {}).some((v) => v !== '' && v != null)).length;
  if (!profiles.length) return <Card title="Reprise du 1er trimestre"><p className="text-sm text-slate-600">La liste des élèves n'est pas encore chargée (Importer et sauvegarder).</p></Card>;
  return (
    <Card title="Reprise du 1er trimestre" subtitle="Les absences et retards relevés sur papier avant l'ENT : ils s'ajoutent automatiquement à ceux saisis ensuite, pour le bulletin.">
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <label className="text-xs text-slate-600">Classe
          <select value={cls} onChange={(e) => setCls(e.target.value)} className="mt-1 block rounded-lg border border-slate-300 px-2 py-1.5 text-sm">
            {classes.map((c) => <option key={c} value={c}>{c} ({filled(c)}/{profiles.filter((p) => p.cls === c).length} remplis)</option>)}
          </select>
        </label>
        <label className="text-xs text-slate-600">Relevé arrêté au
          <input type="date" disabled={readOnly} value={carry.until ?? ''} onChange={(e) => setCarry((prev) => ({ ...prev, until: e.target.value }))} className="mt-1 block rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
        </label>
        <p className="text-xs text-slate-500">Une case vide compte 0. Enregistré dès la saisie.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead><tr className="border-b text-left text-xs text-slate-500"><th className="py-2 pr-2">Élève</th>{COLS.map(([k, l]) => <th key={k} className="px-2 text-center">{l}</th>)}</tr></thead>
          <tbody>
            {list.map((p) => {
              const name = `${p.lastName} ${p.firstName}`;
              return (
                <tr key={p.id ?? name} className="border-b border-slate-100">
                  <td className="py-1.5 pr-2 font-medium text-slate-800">{name}</td>
                  {COLS.map(([k, l]) => (
                    <td key={k} className="px-2 text-center">
                      <input inputMode="numeric" disabled={readOnly} aria-label={`${l} — ${name}`} value={carry.students?.[name]?.[k] ?? ''} onChange={(e) => set(name, k, e.target.value)}
                        className="w-16 rounded-md border border-slate-300 px-2 py-1 text-center tabular-nums" />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
