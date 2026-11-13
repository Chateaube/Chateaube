import React from 'react';
import { Button } from './ui.jsx';

// Guide du carnet de notes : affiché à la première ouverture (puis par « Comment ça marche ? »).
// Écrit simplement : le fonctionnement en trois étapes, puis ce qu'attend l'école.
const Step = ({ n, title, children }) => (
  <div className="flex gap-3">
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-navy-500 text-sm font-semibold text-white">{n}</span>
    <div><p className="font-semibold text-slate-900">{title}</p><p className="text-slate-700">{children}</p></div>
  </div>
);

export default function GradebookGuide({ onClose }) {
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-900/40 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="guide-notes-titre">
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-t-2xl bg-white p-6 text-[15px] leading-relaxed shadow-xl sm:rounded-2xl">
        <h2 id="guide-notes-titre" className="font-display text-xl font-semibold text-navy-900">Bienvenue dans vos notes</h2>
        <p className="mt-1 text-slate-600">Choisissez d'abord la classe en haut de l'écran. Ensuite, trois étapes :</p>

        <div className="mt-4 space-y-4">
          <Step n="1" title="Notes">Créez un devoir avec « ＋ Nouveau devoir », puis entrez la note de chaque élève. Pour un élève absent, écrivez ABS.</Step>
          <Step n="2" title="Appréciations">Écrivez une appréciation pour chaque élève. Elle figurera sur le bulletin.</Step>
          <Step n="3" title="Compétences du bulletin">Indiquez ce qui a été travaillé pendant le trimestre.</Step>
        </div>

        <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-emerald-900">Tout est enregistré automatiquement. Quand vous voyez « ✓ Enregistré sur le serveur », c'est bon. Quand tout est fini, cliquez sur « Valider les notes du trimestre ».</p>

        <h3 className="mt-6 font-display text-lg font-semibold text-navy-900">Ce qu'attend l'école</h3>
        <p className="mt-1 text-slate-700">Au moins <strong>4 notes par trimestre</strong>, données régulièrement. Variez les évaluations : devoir surveillé, interrogation, devoir maison, exposé, oral, travail pratique, projet.</p>
        <p className="mt-2 text-slate-700">L'exigence dépend de la classe. En 6e et en 5e, on guide l'élève pas à pas. En 4e et en 3e, il gagne en autonomie et prépare le brevet. En 2de, il apprend à s'organiser. En 1re et en Terminale, il travaille seul et s'entraîne aux épreuves du bac.</p>
        <p className="mt-2 text-slate-700">Les appréciations sont précises et bienveillantes : ce qui va, ce qui reste à travailler, un conseil.</p>

        <p className="mt-4 text-sm text-slate-500">Une question ? Adressez-vous à la Direction. Ce guide se rouvre avec « Comment ça marche ? ».</p>
        <Button className="mt-4 w-full" onClick={onClose}>J'ai compris</Button>
      </div>
    </div>
  );
}
