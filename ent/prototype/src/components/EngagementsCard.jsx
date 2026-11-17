import React from 'react';

// Engagements de l'élève (délégué, BDE, équipe sportive…) et attestations de l'école, sur son portail et sur celui
// de ses responsables ; ce sont les mêmes que sur le bulletin. Rien n'apparaît s'il n'en a pas.
export default function EngagementsCard({ engagements = [], attestations = [], isParent = false, name = '' }) {
  if (!engagements.length && !attestations.length) return null;
  return (
    <section className="rounded-2xl bg-white p-4 shadow-soft">
      <h2 className="mb-2 font-display text-base font-semibold text-navy-900">{isParent ? `Engagements de ${name}` : 'Mes engagements'}</h2>
      <ul className="flex flex-wrap gap-1.5">
        {engagements.map((l) => <li key={l} className="rounded-xl bg-navy-50 px-3 py-1 text-sm text-navy-900 ring-1 ring-navy-200">{l}</li>)}
        {attestations.map((l) => <li key={l} className="rounded-xl bg-emerald-50 px-3 py-1 text-sm text-emerald-900 ring-1 ring-emerald-200">✓ {l}</li>)}
      </ul>
      <p className="mt-2 text-xs text-slate-500">{isParent ? 'Ils figurent aussi sur son bulletin.' : 'Ils figurent aussi sur ton bulletin. Merci pour ton implication !'}</p>
    </section>
  );
}
