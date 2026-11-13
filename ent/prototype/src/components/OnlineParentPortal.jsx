import React, { useState } from 'react';
import { FamilyDocuments, TermsGate } from './InternalResources.jsx';
import { loadMe } from '../identity.js';

// Portail des parents, version en ligne : il ouvre le 17 décembre (comptes des responsables créés avec les
// bulletins). D'ici là, un compte parent ne voit qu'un accueil et les documents de l'école — jamais de données
// d'exemple.
export default function OnlineParentPortal() {
  const [docs, setDocs] = useState(false);
  const me = loadMe();
  return (
    <div className="mx-auto w-full max-w-md space-y-3 p-4">
      <header className="px-1 pt-2">
        <p className="text-xs font-medium text-slate-500">Chateaubriand · Tamatave</p>
        <h1 className="font-display text-2xl font-semibold text-navy-900">Bonjour{me?.name ? ` ${me.name}` : ''}</h1>
      </header>
      <TermsGate phone viewer="PARENT" account={me?.id ?? 'parent'}>
        <section className="rounded-2xl bg-white p-4 shadow-soft">
          <h2 className="font-display text-base font-semibold text-navy-900">Le portail des familles ouvre le 17 décembre</h2>
          <p className="mt-1 text-sm text-slate-700">Vous y retrouverez les notes et le bulletin de votre enfant, son emploi du temps, l'agenda de l'école et les documents à signer.</p>
        </section>
        <button type="button" onClick={() => setDocs(!docs)} className="flex min-h-[52px] w-full items-center justify-between rounded-2xl bg-white px-4 text-left text-[15px] text-slate-900 shadow-soft">
          Règlement et chartes <span aria-hidden="true" className="text-slate-400">{docs ? '˅' : '›'}</span>
        </button>
        {docs && <FamilyDocuments audience="PARENT" />}
      </TermsGate>
    </div>
  );
}
