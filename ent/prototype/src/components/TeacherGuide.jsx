import React, { useState } from 'react';
import { Button, Card } from './ui.jsx';
import { printOnly } from '../print.js';

// Mode d'emploi des professeurs : notes, appréciations et compétences pour les bulletins, pas à pas.
// Pour ceux qui travaillaient sur le fichier Excel : ce qui change, puis chaque étape avec une image de l'écran
// (maquette dessinée, sans donnée réelle) et les questions fréquentes. Imprimable pour la salle des professeurs.

const Shot = ({ children }) => (
  <div className="my-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 shadow-inner" aria-hidden="true">{children}</div>
);
const Btn = ({ children, primary }) => <span className={`inline-block rounded-lg px-2.5 py-1 font-semibold ${primary ? 'bg-navy-500 text-white' : 'bg-white text-navy-700 ring-1 ring-slate-300'}`}>{children}</span>;
const Cell = ({ children, warn }) => <span className={`inline-block w-12 rounded border px-1 py-0.5 text-center ${warn ? 'border-amber-400 bg-amber-50' : 'border-slate-300 bg-white'}`}>{children}</span>;
const Step = ({ n, title, children }) => (
  <section id={`etape-${n}`} className="scroll-mt-20 rounded-2xl bg-white p-5 shadow-soft" style={{ breakInside: 'avoid' }}>
    <h2 className="flex items-center gap-3 font-display text-lg font-semibold text-navy-900">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-navy-500 text-sm text-white">{n}</span>{title}
    </h2>
    <div className="mt-3 space-y-2 text-[15px] leading-relaxed text-slate-700">{children}</div>
  </section>
);
const Tip = ({ children, tone = 'navy' }) => <p className={`rounded-xl p-3 text-sm ${tone === 'amber' ? 'bg-amber-50 text-amber-900' : tone === 'green' ? 'bg-emerald-50 text-emerald-900' : 'bg-navy-50 text-navy-900'}`}>{children}</p>;

const SUMMARY = [
  ['0', 'Ce qui change par rapport au fichier Excel'], ['1', 'Se connecter'], ['2', 'Ouvrir ses notes et choisir la classe'], ['3', 'Créer une évaluation'],
  ['4', 'Saisir les notes'], ['5', 'Écrire les appréciations'], ['6', 'Les compétences du bulletin'], ['7', 'Valider le trimestre'], ['8', 'Questions fréquentes'],
];
const FAQ = [
  ['J\'ai perdu mon code.', 'Sur la page de connexion, « Code oublié » (si votre compte a une adresse e-mail), sinon demandez un nouveau code à la Direction.'],
  ['Je ne vois pas une de mes classes.', 'Les classes sont envoyées par la Direction. Prévenez-la : elle corrige et vous les recevez à la connexion suivante.'],
  ['Un élève était absent à l\'évaluation.', 'Écrivez ABS : la note ne compte pas dans sa moyenne, et la vie scolaire voit l\'absence (« Absents aux évaluations »).'],
  ['Je me suis trompé de note.', 'Cliquez sur la case et corrigez : c\'est enregistré aussitôt. Si le trimestre est déjà validé, cliquez d\'abord sur « Rouvrir la saisie ».'],
  ['La case devient orange.', 'L\'ENT a un doute (par exemple la lettre « o » à la place du chiffre 0, ou une note au-dessus du barème). Lisez la suggestion et acceptez-la avec Entrée, ou corrigez.'],
  ['Je partage la classe avec un collègue (classe commune).', 'Chacun saisit ses évaluations ; une seule moyenne est calculée sur toutes les évaluations des deux. L\'appréciation est écrite par le premier qui l\'écrit ; l\'autre la voit.'],
  ['Je n\'ai pas internet.', 'Continuez : tout reste sur votre appareil et part sur le serveur dès le retour du réseau. Attendez « ✓ Enregistré sur le serveur » avant de vous déconnecter.'],
  ['Téléphone ou ordinateur ?', 'Les deux, avec le même identifiant et le même code. L\'ordinateur est plus confortable pour les appréciations.'],
  ['Où envoyer mon fichier Excel ?', 'Nulle part : il n\'y a plus de fichier à envoyer. Ce que vous saisissez dans l\'ENT est déjà chez la Direction et sert directement au conseil de classe et aux bulletins.'],
];

export default function TeacherGuide() {
  const [open, setOpen] = useState(null);
  return (
    <div className="teacher-guide-print mx-auto max-w-3xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-navy-500">Professeurs · aide</p>
          <h1 className="text-2xl font-semibold text-navy-900">Mode d'emploi : notes, appréciations et compétences</h1>
          <p className="text-sm text-slate-600">Tout ce qu'il faut pour remplir les bulletins du trimestre dans l'ENT, rubrique par rubrique.</p>
        </div>
        <Button variant="secondary" className="print:hidden" onClick={() => printOnly('.teacher-guide-print', 'size: A4 portrait; margin: 12mm;', 'Mode d\'emploi des professeurs')}>Imprimer le mode d'emploi</Button>
      </div>

      <Card title="Sommaire" className="print:hidden">
        <ol className="grid gap-1 text-sm sm:grid-cols-2">
          {SUMMARY.map(([n, t]) => <li key={n}><a href={`#etape-${n}`} className="text-navy-700 hover:underline">{n === '0' ? '' : `${n}. `}{t}</a></li>)}
        </ol>
      </Card>

      <Step n="0" title="Ce qui change par rapport au fichier Excel">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead><tr className="text-left text-xs text-slate-500"><th className="py-1 pr-3">Avant (fichier Excel)</th><th className="py-1">Maintenant (ENT)</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {[['Un fichier par classe, à remplir en une semaine sur les ordinateurs de l\'école', 'Tout se saisit dans l\'ENT, même depuis chez soi'],
                ['Vous saisissiez vos notes dans le fichier Excel', 'La Direction et les élèves voient vos notes en direct (les élèves à partir de la date de publication que vous choisissez)'],
                ['Le fichier pouvait se perdre ou être écrasé', 'Chaque saisie est enregistrée tout de suite sur le serveur de l\'école'],
                ['Moyennes calculées par vous pour chaque élève', 'Moyennes calculées par l\'ENT (coefficients, barèmes, absences)'],
                ['Appréciations relues par l\'administration', 'Un contrôleur vérifie l\'appréciation pendant que vous l\'écrivez'],
                ['Ordinateur seulement', 'Ordinateur ou téléphone, avec le même compte']].map(([a, b]) => <tr key={a}><td className="py-1.5 pr-3 text-slate-500">{a}</td><td className="py-1.5 font-medium text-slate-800">{b}</td></tr>)}
            </tbody>
          </table>
        </div>
        <Tip tone="green">Le principe : pour chaque classe, les <strong>notes</strong>, les <strong>appréciations</strong> et les <strong>compétences</strong>, dans l'ordre que vous voulez. L'appréciation s'écrit quand les notes sont complètes : vous voyez alors la moyenne de l'élève. Pour finir : <strong>« Valider les notes du trimestre »</strong>.</Tip>
      </Step>

      <Step n="1" title="Se connecter">
        <p>Ouvrez <strong>chateaubriand.pro/ent</strong>, choisissez l'espace <strong>Professeurs</strong>, puis entrez votre <strong>identifiant</strong> (ex. ra.mirana) et votre <strong>code</strong>. À la première connexion, vous choisissez votre propre code (8 caractères au moins, avec des lettres et des chiffres).</p>
        <Tip tone="amber">Après 3 codes faux, l'identifiant est bloqué 1 minute ; après 4, 5 minutes ; au 5e, il reste bloqué jusqu'à ce que la Direction vous donne un nouveau code. Code oublié : demandez-en un nouveau à la Direction.</Tip>
      </Step>

      <Step n="2" title="Ouvrir ses notes et choisir la classe">
        <p>Dans le menu : <strong>Évaluations › Notes et appréciations</strong>. En haut de l'écran, choisissez la <strong>classe et la matière</strong>. Notes, appréciations et compétences se remplissent dans l'ordre que vous voulez.</p>
        <Shot><span className="mr-2 rounded border border-slate-300 bg-white px-2 py-1">3e · Mathématiques ▾</span> <Btn primary>Notes</Btn> <Btn>Appréciations du bulletin</Btn> <Btn>Compétences du bulletin</Btn></Shot>
        <p>Le bouton <strong>« Comment ça marche ? »</strong> rouvre un résumé à tout moment.</p>
      </Step>

      <Step n="3" title="Créer une évaluation">
        <p>Onglet <strong>Notes</strong>, bouton <strong>« ＋ Nouvelle évaluation »</strong>. Remplissez :</p>
        <ul className="list-disc space-y-1 pl-5">
          <li><strong>Type</strong> (devoir surveillé, interrogation, devoir maison, oral…) et <strong>intitulé</strong> (ex. « DS n°2 — Les fractions ») ;</li>
          <li><strong>Évaluation du</strong> : la date où les élèves l'ont faite ; <strong>Note publiée le</strong> : à partir de quand les élèves la voient (les parents quelques jours après) ;</li>
          <li><strong>Notation sur</strong> (20 par défaut, ou 10, 40…) et <strong>coefficient</strong> ;</li>
          <li>« Ramener sur 20 » : coché, une note sur 10 compte comme sur 20 (8/10 → 16/20) ;</li>
          <li>facultatif : un commentaire pour les élèves, les thèmes, les compétences évaluées.</li>
        </ul>
        <Shot><p className="mb-1 font-semibold text-navy-900">Nouvelle évaluation</p>Type <span className="rounded border border-slate-300 bg-white px-1.5">Devoir surveillé ▾</span> · Intitulé <span className="rounded border border-slate-300 bg-white px-1.5">DS n°2 — Les fractions</span> · Sur <Cell>20</Cell> · Coef. <Cell>2</Cell><p className="mt-2"><Btn primary>Créer l'évaluation</Btn></p></Shot>
        <Tip>Une évaluation déjà créée se modifie (date, coefficient…) sans perdre les notes saisies.</Tip>
      </Step>

      <Step n="4" title="Saisir les notes">
        <p>Une colonne par évaluation, une ligne par élève. Tapez la note, puis <strong>Entrée</strong> (ou la flèche ↓) pour passer à l'élève suivant, comme dans Excel ; <strong>Tab</strong> passe à l'évaluation suivante du même élève. Virgule ou point : les deux marchent (12,5 ou 12.5).</p>
        <Shot>R. Aina <Cell>14</Cell> · E. Éléa <Cell>ABS</Cell> · M. Lova <Cell>DISP</Cell> · R. Fy <Cell warn>1o</Cell> <span className="text-amber-800">→ « 10 » ? (Entrée pour accepter)</span></Shot>
        <ul className="list-disc space-y-1 pl-5">
          <li><strong>ABS</strong> : absent — ne compte pas dans la moyenne ; la vie scolaire voit l'absence ;</li>
          <li><strong>DISP</strong> (EPS seulement) : dispensé — ne compte pas ;</li>
          <li><strong>NN</strong> : non noté (par exemple un élève inscrit tardivement, après la date du devoir) — ne compte pas.</li>
        </ul>
        <Tip tone="amber">Il faut au moins <strong>4 évaluations par trimestre</strong> (3 en EPS). Le compteur l'affiche : « 3 / 4 évaluations minimum ».</Tip>
        <Tip tone="green">Pas de bouton « Enregistrer » : chaque note est enregistrée aussitôt. Le message <strong>« ✓ Enregistré sur le serveur à 10:42 »</strong> le confirme.</Tip>
      </Step>

      <Step n="5" title="Écrire les appréciations">
        <p>Onglet <strong>Appréciations du bulletin</strong> : une appréciation par élève, qui figurera sur son bulletin. Sa moyenne et ses notes sont affichées à côté pour vous aider.</p>
        <p>Le <strong>contrôleur de rédaction</strong>, à droite, vérifie pendant que vous écrivez (longueur, majuscule, ponctuation, mots à éviter) et propose des corrections.</p>
        <Shot><p className="font-medium">E. Éléa — 13,40</p><p className="mt-1 rounded border border-slate-300 bg-white p-1.5">Trimestre sérieux. Les méthodes sont acquises ; il faut maintenant gagner en rigueur dans la rédaction des solutions. Continuez ainsi.</p></Shot>
        <Tip>Une bonne appréciation : <strong>ce qui va</strong>, <strong>ce qui reste à travailler</strong>, <strong>un conseil</strong>. Précise et bienveillante, adressée à l'élève ou à sa famille.</Tip>
        <p className="text-sm text-slate-600">Classe commune ou enseignement partagé : une seule appréciation par élève ; si votre collègue l'a déjà écrite, vous la voyez sans avoir à la refaire.</p>
      </Step>

      <Step n="6" title="Les compétences du bulletin">
        <p>Onglet <strong>Compétences du bulletin</strong> : ce qui a été travaillé pendant le trimestre (une ligne par compétence). Elles apparaissent dans la colonne « Compétences » du bulletin.</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Reprenez les <strong>compétences de l'an dernier</strong>, tirées des bulletins 2025-2026 (bouton ＋ ou « Tout reprendre »), ou écrivez les vôtres ;</li>
          <li>vous avez deux classes du même niveau ? Cochez « Mêmes compétences en … » pour ne les écrire qu'une fois.</li>
        </ul>
        <Shot><p className="font-medium">Mes compétences — 3e · Mathématiques</p><p className="mt-1">C1 <span className="rounded border border-slate-300 bg-white px-1.5">Résoudre une équation du premier degré</span></p><p className="mt-1">C2 <span className="rounded border border-slate-300 bg-white px-1.5">Utiliser le théorème de Thalès</span></p></Shot>
      </Step>

      <Step n="7" title="Valider le trimestre">
        <p>Quand les notes, les appréciations et les compétences sont prêtes, cliquez sur <strong>« Valider les notes du trimestre »</strong>. Vos notes partent alors dans la grille du conseil de classe.</p>
        <Shot><Btn primary>Valider les notes du trimestre</Btn> <span className="ml-2 text-red-800">Pas encore possible : il manque 1 évaluation</span></Shot>
        <p>Le bouton reste grisé tant qu'il manque quelque chose : le message rouge dit quoi. Après validation, une erreur se corrige avec <strong>« Rouvrir la saisie »</strong>, puis on valide à nouveau.</p>
        <Tip tone="amber">Respectez la date d'<strong>arrêt des notes</strong> indiquée en bas de l'écran : la Direction prépare ensuite le conseil de classe.</Tip>
      </Step>

      <section id="etape-8" className="scroll-mt-20 rounded-2xl bg-white p-5 shadow-soft">
        <h2 className="font-display text-lg font-semibold text-navy-900">Questions fréquentes</h2>
        <ul className="mt-3 divide-y divide-slate-100">
          {FAQ.map(([q, a], i) => (
            <li key={q} className="py-2">
              <button type="button" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)} className="flex w-full items-center justify-between gap-3 text-left text-[15px] font-medium text-slate-900 print:hidden">{q}<span aria-hidden="true" className="text-slate-400">{open === i ? '−' : '+'}</span></button>
              <p className="hidden font-medium text-slate-900 print:block">{q}</p>
              <p className={`mt-1 text-sm text-slate-700 ${open === i ? '' : 'hidden print:block'}`}>{a}</p>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-slate-500">Une autre question ? Menu du compte › « Signaler un problème ou une idée », ou adressez-vous à la Direction.</p>
      </section>
    </div>
  );
}
