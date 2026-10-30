import React, { useState } from 'react';
import { Button } from './ui.jsx';
import { ROLES, saveMe } from '../identity.js';
import { loadImport } from '../importStore.js';

// Première ouverture avec les vraies données : qui utilise cet appareil ? Le nom choisi signe chaque saisie
// (appel, notes, punitions, encaissements…) en attendant les comptes personnels de la version en ligne.
export default function WhoAmI() {
  const [role, setRole] = useState('');
  const [name, setName] = useState('');
  const teachers = (loadImport()?.assignments ?? []).map((a) => a.name).filter(Boolean).sort((a, b) => a.localeCompare(b, 'fr'));
  const ok = role && name.trim().length >= 3;
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <form className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-soft" onSubmit={(e) => { e.preventDefault(); if (!ok) return; saveMe({ role, name: name.trim() }); window.location.reload(); }}>
        <div>
          <h1 className="font-display text-xl font-semibold text-navy-900">Qui utilise cet appareil ?</h1>
          <p className="mt-1 text-sm text-slate-600">Vos saisies (appel, notes, punitions, encaissements…) seront signées de ce nom. Un seul utilisateur par appareil ; il se change dans le menu du compte.</p>
        </div>
        <fieldset>
          <legend className="text-sm font-medium text-slate-700">Votre fonction</legend>
          <div className="mt-1 grid grid-cols-2 gap-2">
            {ROLES.map(([k, l]) => (
              <button key={k} type="button" aria-pressed={role === k} onClick={() => setRole(k)}
                className={`min-h-[44px] rounded-xl px-3 text-sm font-medium ring-1 ${role === k ? 'bg-navy-500 text-white ring-navy-500' : 'bg-white text-slate-800 ring-slate-300'}`}>{l}</button>
            ))}
          </div>
        </fieldset>
        <label className="block text-sm font-medium text-slate-700">Nom et prénom (ex. Mme RASOA Hanta)
          <input value={name} onChange={(e) => setName(e.target.value)} list={role === 'ENSEIGNANT' ? 'ent-teachers' : undefined} autoComplete="name"
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-base" />
          {role === 'ENSEIGNANT' && <datalist id="ent-teachers">{teachers.map((t) => <option key={t} value={t} />)}</datalist>}
        </label>
        <Button type="submit" className="w-full" disabled={!ok}>Commencer</Button>
      </form>
    </div>
  );
}
