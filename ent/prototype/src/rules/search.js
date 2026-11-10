// Recherche d'élèves (saisie express, fil de l'élève) et recherche universelle (Ctrl+K) : sans accents,
// sans majuscules, sur le nom, le prénom ou la classe ; seuls les écrans accessibles sont proposés.
import { CLASSES } from '../data/schoollife.js';

// Relu à chaque recherche : les élèves importés remplacent ceux de la démonstration
const allStudents = () => Object.entries(CLASSES).flatMap(([cls, list]) => list.map((name) => ({ name, cls })));
const fold = (t) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/** Élèves dont le nom, le prénom ou la classe contient la recherche (6 au plus). */
export function findStudents(query, list = allStudents()) {
  const q = fold(query.trim());
  if (!q) return [];
  return list.filter((s) => fold(`${s.name} ${s.cls}`).includes(q) || fold(s.name).split(' ').some((w) => w.startsWith(q))).slice(0, 6);
}

// Actions courantes (recherche universelle) : mots tapés → écran
const ACTIONS = [
  [['certificat', 'scolarite'], 'eleves', 'Certificat de scolarité (ouvrir l\'élève)'],
  [['encaisser', 'paiement', 'recu', 'caisse'], 'accounting', 'Encaisser / caisse'],
  [['retard', 'absence', 'justif'], 'vs', 'Absences et retards'],
  [['colle', 'punition', 'sanction', 'carnet'], 'vs', 'Punitions, colles et passeport'],
  [['telephone', 'confisq', 'ecouteur'], 'vs', 'Objets confisqués'],
  [['infirmerie', 'soin', 'doliprane', 'malade'], 'care', 'Soins (secrétariat)'],
  [['inscri', 'reinscri', 'dossier', 'eleve'], 'eleves', 'Élèves : inscriptions et dossiers'],
  [['bulletin'], 'bulletins', 'Bulletins'],
  [['conseil'], 'council', 'Conseils de classe'],
  [['emploi du temps', 'edt', 'horaire'], 'timetable', 'Emplois du temps'],
  [['annulation', 'annuler un cours', 'deplacer'], 'tt-changes', 'Changer un cours'],
  [['annonce', 'informer'], 'news', 'Annonces'],
  [['message', 'ecrire'], 'messages', 'Messages'],
  [['droit', 'acces', 'mot de passe'], 'access', 'Droits d\'accès'],
  [['import', 'sauvegard', 'excel'], 'import', 'Importer et sauvegarder'],
  [['livre', 'biblio', 'manuel'], 'library', 'Bibliothèque'],
  [['note', 'appreciation'], 'grades', 'Notes et appréciations'],
  [['appel'], 'appel', 'Faire l\'appel'],
];

/** Résultats d'une recherche : écrans, actions et élèves accessibles. */
export function searchAll(query, items, students = findStudents) {
  const q = fold(query.trim());
  if (q.length < 2) return [];
  const has = (id) => items.some((i) => i.id === id);
  const words = q.split(/\s+/);
  const screens = items.filter((i) => words.every((w) => fold(`${i.label} ${i.group ?? ''}`).includes(w))).slice(0, 5).map((i) => ({ type: 'SCREEN', id: i.id, label: i.label, hint: i.group }));
  const actions = ACTIONS.filter(([keys, to]) => has(to) && keys.some((k) => words.some((w) => w.length >= 3 && (k.startsWith(w) || w.startsWith(k))))).map(([, to, label]) => ({ type: 'ACTION', id: to, label, hint: 'Action' }));
  const studentScreen = has('eleves') ? 'eleves' : 'student-file';
  const pupils = has(studentScreen) ? words.flatMap((w) => (w.length >= 2 ? students(w) : [])).filter((s, k, a) => a.findIndex((x) => x.name === s.name) === k).slice(0, 5).map((s) => ({ type: 'STUDENT', id: studentScreen, label: s.name, hint: s.cls })) : [];
  const seen = new Set();
  return [...actions, ...pupils, ...screens].filter((r) => { const k = `${r.type}|${r.id}|${r.label}`; if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 10);
}

