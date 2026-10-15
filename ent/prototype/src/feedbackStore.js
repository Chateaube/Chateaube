// Avis du pilote (« Donner mon avis ») : prototype, gardés dans ce navigateur ; en production, en base.
const KEY = 'ent-avis-v1';
const DEMO = [
  { id: 'a1', at: '13/10/2026 18:42', profile: 'ELEVE', who: 'Élève de Terminale Générale', screen: 'Notes', type: 'IDEE', text: 'Ce serait bien de voir la moyenne de la classe à côté de chaque note.', status: 'NOUVEAU' },
  { id: 'a2', at: '14/10/2026 07:55', profile: 'PARENT', who: 'Parent d\'un élève de Terminale STMG', screen: 'Fiche signalétique', type: 'PROBLEME', text: 'Sur mon téléphone, la signature dépasse un peu du cadre.', status: 'EN_COURS', note: 'Cadre agrandi sur petit écran' },
  { id: 'a3', at: '14/10/2026 12:10', profile: 'ENSEIGNANT', who: 'Professeur', screen: 'Notes & appréciations', type: 'QUESTION', text: 'Peut-on corriger une note après validation du trimestre ?', status: 'TRAITE', note: 'Oui, sur demande à la Direction (déverrouillage tracé)' },
];
export function loadFeedback() {
  try { return JSON.parse(localStorage.getItem(KEY)) ?? DEMO; } catch { return DEMO; }
}
export function saveFeedback(list) {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* stockage indisponible */ }
}
