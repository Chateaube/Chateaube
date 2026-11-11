import React from 'react';
import { CONTRATS } from '../data/people.js';
import { allSubjects } from '../data/grades.js';
import { ASSIGNMENTS } from '../data/staffAssignments.js';
import { loadImport } from '../importStore.js';

// Fiche complète d'un agent, remplie en une fois à la création (et modifiable ensuite) :
// accès à l'ENT, identité, contrat, enseignements (plusieurs matières, plusieurs classes chacune).
// Seuls prénom, nom et fonction sont obligatoires ; la date d'entrée peut rester vide.
export const ROLES = [['PROFESSEUR', 'Professeur'], ['VIE_SCOLAIRE', 'CPE / vie scolaire'], ['BUREAU', 'Secrétariat / économat'], ['DIRECTION', 'Direction']];
export const CLASSES = ['6e', '5e', '4e', '3e', '2de', '1re Générale', '1re STMG', 'Terminale Générale', 'Terminale STMG'];
export const EMPTY_AGENT = {
  civility: 'Madame', first: '', usual: '', last: '', birthDate: '', birthPlace: '', role: 'PROFESSEUR', title: '', email: '', phone: '',
  contract: 'Vacataire', entry: '', exit: '', rate: '', address: '', idType: 'CIN', idNumber: '', idIssued: '', idPlace: '',
  services: [],
};
const field = 'mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm';
const label = 'text-xs font-medium text-slate-600';
const subjects = () => allSubjects(loadImport()?.assignments?.length ? loadImport().assignments : ASSIGNMENTS).filter((s) => s.id !== 'VDC').map((s) => s.label);

/** `withAccount` : champs du compte (fonction, e-mail) ; `withRate` : taux horaire (Direction seule). */
export default function AgentForm({ value: d, onChange, withAccount = true, withRate = true }) {
  const set = (patch) => onChange({ ...d, ...patch });
  const setService = (i, patch) => set({ services: d.services.map((s, k) => (k === i ? { ...s, ...patch } : s)) });
  const teaches = d.role === 'PROFESSEUR' || d.services.length > 0;
  return (
    <div className="space-y-4">
      <fieldset className="grid gap-3 sm:grid-cols-6">
        <legend className="mb-1 text-sm font-semibold text-navy-900">Identité et accès</legend>
        <label className={`${label} sm:col-span-1`}>Civilité<select value={d.civility} onChange={(e) => set({ civility: e.target.value })} className={field}><option>Madame</option><option>Monsieur</option></select></label>
        <label className={`${label} sm:col-span-2`}>Prénom(s) *<input value={d.first} onChange={(e) => set({ first: e.target.value })} className={field} /></label>
        <label className={`${label} sm:col-span-3`}>Nom *<input value={d.last} onChange={(e) => set({ last: e.target.value })} className={field} /></label>
        <label className={`${label} sm:col-span-3`}>Prénom d'usage (s'il n'est pas le premier : sert à l'identifiant)<input value={d.usual ?? ''} onChange={(e) => set({ usual: e.target.value })} className={field} /></label>
        {withAccount && <label className={`${label} sm:col-span-2`}>Fonction dans l'ENT *<select value={d.role} onChange={(e) => set({ role: e.target.value })} className={field}>{ROLES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>}
        <label className={`${label} ${withAccount ? 'sm:col-span-4' : 'sm:col-span-6'}`}>Intitulé du poste (ex. Professeur de mathématiques, Économe)<input value={d.title} onChange={(e) => set({ title: e.target.value })} className={field} /></label>
        <label className={`${label} sm:col-span-3`}>Téléphone<input value={d.phone} onChange={(e) => set({ phone: e.target.value })} className={field} /></label>
        {withAccount && <label className={`${label} sm:col-span-3`}>E-mail (facultatif, pour le code oublié)<input type="email" value={d.email} onChange={(e) => set({ email: e.target.value })} className={field} /></label>}
      </fieldset>

      <fieldset className="grid gap-3 sm:grid-cols-6">
        <legend className="mb-1 text-sm font-semibold text-navy-900">Contrat <span className="font-normal text-slate-500">(pour le contrat imprimé ; tout peut être complété plus tard)</span></legend>
        <label className={`${label} sm:col-span-2`}>Type<select value={d.contract} onChange={(e) => set({ contract: e.target.value })} className={field}>{CONTRATS.map((c) => <option key={c}>{c}</option>)}</select></label>
        <label className={`${label} sm:col-span-2`}>Date d'entrée<input type="date" value={d.entry} onChange={(e) => set({ entry: e.target.value })} className={field} /></label>
        <label className={`${label} sm:col-span-2`}>Date de sortie<input type="date" value={d.exit} onChange={(e) => set({ exit: e.target.value })} className={field} /></label>
        <label className={`${label} sm:col-span-2`}>Date de naissance<input type="date" value={d.birthDate ?? ''} onChange={(e) => set({ birthDate: e.target.value })} className={field} /></label>
        <label className={`${label} sm:col-span-4`}>Lieu de naissance<input value={d.birthPlace ?? ''} onChange={(e) => set({ birthPlace: e.target.value })} className={field} /></label>
        <label className={`${label} sm:col-span-6`}>Adresse<input value={d.address} onChange={(e) => set({ address: e.target.value })} className={field} /></label>
        <label className={`${label} sm:col-span-1`}>Pièce<select value={d.idType} onChange={(e) => set({ idType: e.target.value })} className={field}><option>CIN</option><option>Passeport</option><option>Carte de résident</option></select></label>
        <label className={`${label} sm:col-span-2`}>Numéro<input value={d.idNumber} onChange={(e) => set({ idNumber: e.target.value })} className={field} /></label>
        <label className={`${label} sm:col-span-1`}>Délivrée le<input type="date" value={d.idIssued} onChange={(e) => set({ idIssued: e.target.value })} className={field} /></label>
        <label className={`${label} sm:col-span-2`}>À<input value={d.idPlace} onChange={(e) => set({ idPlace: e.target.value })} className={field} /></label>
        {withRate && <label className={`${label} sm:col-span-2`}>Taux horaire (Ar) <span className="font-normal text-slate-400">· confidentiel</span><input inputMode="numeric" value={d.rate} onChange={(e) => set({ rate: e.target.value.replace(/[^\d]/g, '') })} className={field} /></label>}
      </fieldset>

      {teaches && (
        <fieldset>
          <legend className="mb-1 text-sm font-semibold text-navy-900">Enseignements <span className="font-normal text-slate-500">(une ligne par matière, plusieurs classes possibles)</span></legend>
          <div className="space-y-2">
            {d.services.map((s, i) => (
              <div key={i} className="rounded-lg bg-slate-50 p-2">
                <div className="flex flex-wrap items-end gap-2">
                  <label className={`${label} min-w-[12rem] flex-1`}>Matière<select value={s.subject} onChange={(e) => setService(i, { subject: e.target.value })} className={field}><option value="">—</option>{subjects().map((x) => <option key={x}>{x}</option>)}</select></label>
                  <label className={`${label} w-28`}>Heures / sem.<input inputMode="decimal" value={s.hours ?? ''} onChange={(e) => setService(i, { hours: e.target.value.replace(',', '.').replace(/[^\d.]/g, '') })} className={field} /></label>
                  <button type="button" onClick={() => set({ services: d.services.filter((_, k) => k !== i) })} className="mb-1 rounded-md px-2 py-1 text-xs text-red-700 ring-1 ring-red-200">Retirer</button>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label={`Classes — ${s.subject || 'matière'}`}>
                  {CLASSES.map((c) => {
                    const on = (s.classes ?? []).includes(c);
                    return <button key={c} type="button" aria-pressed={on} onClick={() => setService(i, { classes: on ? s.classes.filter((x) => x !== c) : [...(s.classes ?? []), c] })}
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${on ? 'bg-navy-500 text-white ring-navy-500' : 'bg-white text-slate-600 ring-slate-300'}`}>{c}</button>;
                  })}
                </div>
              </div>
            ))}
            <button type="button" onClick={() => set({ services: [...d.services, { subject: '', classes: [], hours: '' }] })} className="rounded-lg px-3 py-1.5 text-sm font-medium text-navy-600 ring-1 ring-navy-200">＋ Ajouter une matière</button>
          </div>
        </fieldset>
      )}
    </div>
  );
}

/** Résumé d'une fiche : « Vacataire · entré·e le … · Mathématiques (1re G, Tle G) ». */
export function serviceText(services = []) {
  return services.filter((s) => s.subject).map((s) => `${s.subject}${s.classes?.length ? ` (${s.classes.join(', ')})` : ''}`).join(' · ');
}
export const weeklyHours = (services = []) => services.reduce((n, s) => n + (Number(s.hours) || 0), 0);
