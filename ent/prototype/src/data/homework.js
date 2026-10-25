// Cahier de textes (démo) : contenu des séances et travail à faire.
// Saisi par l'enseignant, visible par les élèves et leurs parents.
import { liveArray, demoOr } from '../demoData.js';

const DEMO_HOMEWORK = [
  { id: 'h1', cls: '1re STMG', subject: 'Management', teacher: 'Mme Ranaivo', date: '2026-10-13', done: 'Chapitre 3 : les finalités de l\'organisation. Étude du cas « Coopérative de vanille de Sambava ».', todo: 'Lire le document 4 et répondre aux questions 1 à 3.', due: '2026-10-15' },
  { id: 'h2', cls: '1re STMG', subject: 'Mathématiques', teacher: 'M. Tojo', date: '2026-10-12', done: 'Suites arithmétiques : définition et terme général.', todo: 'Exercices 12, 14 et 15 p. 48.', due: '2026-10-14' },
  { id: 'h3', cls: '1re STMG', subject: 'Français', teacher: 'M. Rabe', date: '2026-10-12', done: 'Le roman au XIXe siècle : lecture analytique.', todo: 'Préparer l\'oral sur l\'extrait 2 (5 minutes).', due: '2026-10-19' },
  { id: 'h4', cls: '1re STMG', subject: 'Anglais', teacher: 'Mme Hery', date: '2026-10-09', done: 'Unit 2 — Business English vocabulary.', todo: 'Apprendre la liste de vocabulaire (contrôle).', due: '2026-10-16' },
  { id: 'h5', cls: '5e', subject: 'Mathématiques', teacher: 'M. Tojo', date: '2026-10-13', done: 'Les fractions : comparaison.', todo: 'Fiche d\'exercices n°4.', due: '2026-10-15' },
  { id: 'h6', cls: '5e', subject: 'Histoire-Géographie', teacher: 'M. Rasolo', date: '2026-10-12', done: 'L\'Empire byzantin.', todo: 'Apprendre la leçon et la carte p. 34.', due: '2026-10-16' },
  { id: 'h7', cls: 'Terminale STMG', subject: 'Management', teacher: 'Mme Ranaivo', date: '2026-10-12', done: 'La stratégie des organisations.', todo: null, due: null },
];

export const HOMEWORK = liveArray(() => demoOr(DEMO_HOMEWORK, [])); // vide dès que les vraies données sont importées
