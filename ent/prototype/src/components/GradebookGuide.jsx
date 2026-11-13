import React from 'react';
import { Button } from './ui.jsx';

// Guide du carnet de notes : affiché à la première ouverture (puis par « Comment ça marche ? »).
// Fonctionnement de la rubrique et attentes de l'école, pour tous et surtout pour les nouveaux enseignants.
const LEVELS = [
  ['6e – 5e', 'Consignes courtes et guidées, méthode accompagnée pas à pas. On valorise l\'effort et les progrès ; les évaluations sont courtes et fréquentes.'],
  ['4e – 3e', 'Plus d\'autonomie : rédiger, justifier, argumenter. On prépare le DNB (épreuves écrites et oral).'],
  ['2de', 'Transition vers le lycée : méthode de travail, rigueur, régularité. L\'élève apprend à s\'organiser.'],
  ['1re – Terminale', 'Autonomie attendue : l\'élève s\'organise seul, approfondit, s\'entraîne aux épreuves du bac (écrits type bac, oraux, Grand oral en Terminale).'],
];

export default function GradebookGuide({ onClose }) {
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-900/40 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="guide-notes-titre">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl">
        <h2 id="guide-notes-titre" className="font-display text-xl font-semibold text-navy-900">Notes et appréciations : comment ça marche</h2>

        <h3 className="mt-4 text-sm font-semibold text-navy-900">1. Le fonctionnement</h3>
        <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm text-slate-700">
          <li><strong>Choisissez la classe</strong> en haut (une case par classe et par matière).</li>
          <li><strong>1. Notes</strong> : « ＋ Nouveau devoir » (type, intitulé, date, barème, coefficient), puis la note de chaque élève. ABS = absent, DISP = dispensé, NN = non noté : ils ne comptent pas dans la moyenne.</li>
          <li>Chaque note est <strong>enregistrée sur le serveur</strong> dès sa saisie : vous voyez « ✓ Enregistré sur le serveur à … ». Sans réseau, elle reste sur votre appareil et part toute seule ensuite.</li>
          <li><strong>2. Appréciations</strong> : une appréciation par élève, pour le bulletin.</li>
          <li><strong>3. Compétences du bulletin</strong> (obligatoire) : ce qui a été travaillé ce trimestre ; elles apparaissent dans la colonne « Compétences » du bulletin.</li>
          <li>Quand tout est prêt : <strong>« Valider les notes du trimestre »</strong>, avant l'arrêt des notes. Vous pouvez rouvrir si besoin.</li>
        </ol>
        <p className="mt-1 text-xs text-slate-500">Vos notes ne sont visibles que par vous, la Direction et le secrétariat, jusqu'à leur publication.</p>

        <h3 className="mt-4 text-sm font-semibold text-navy-900">2. Ce qu'attend l'école</h3>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-700">
          <li><strong>Au moins 4 notes par trimestre</strong> et par classe. <strong>2 notes</strong> en EMC, et pour chaque professeur d'une matière partagée à deux (Enseignement scientifique, MSGN, Espagnol) : une seule moyenne au bulletin, celle des deux professeurs.</li>
          <li><strong>Des évaluations variées</strong>, pas seulement des écrits : devoir surveillé, interrogation, devoir maison, exposé, oral, travaux pratiques ou compte rendu, projet, participation…</li>
          <li>Des notes <strong>régulières</strong>, réparties sur le trimestre (pas toutes à la fin), rendues et corrigées avec les élèves.</li>
          <li>Des <strong>appréciations</strong> en phrases complètes, précises et bienveillantes : ce qui va, ce qui reste à travailler, un conseil. On juge le travail, jamais la personne.</li>
        </ul>

        <h3 className="mt-4 text-sm font-semibold text-navy-900">3. Le niveau d'exigence selon la classe</h3>
        <dl className="mt-1 space-y-1.5 text-sm">
          {LEVELS.map(([k, v]) => <div key={k} className="rounded-lg bg-slate-50 px-3 py-2"><dt className="font-semibold text-slate-900">{k}</dt><dd className="text-slate-700">{v}</dd></div>)}
        </dl>

        <p className="mt-4 text-sm text-slate-700">Une question ? Adressez-vous à la Direction.</p>
        <Button className="mt-4 w-full" onClick={onClose}>J'ai compris</Button>
      </div>
    </div>
  );
}
