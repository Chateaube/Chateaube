import React from 'react';

// Écran d'une fonction visible mais pas encore ouverte (ex. appel en ligne avant la bascule).
export default function ComingSoon({ title, text }) {
  return (
    <div className="mx-auto max-w-xl py-10 text-center">
      <span className="inline-block rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">Fonction en cours de création</span>
      <h1 className="mt-3 text-2xl font-semibold text-navy-900">{title}</h1>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">{text}</p>
    </div>
  );
}
