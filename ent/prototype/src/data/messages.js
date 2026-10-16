// Données de démonstration — messagerie (noms FICTIFS hors personnel).
import { CLASSES } from './schoollife.js';
import { CLASS_SUBJECTS } from './grades.js';
// Chaque profil voit ses conversations ; tout le monde peut joindre des photos.

const T = (date, time) => `${date}T${time}`;

export const THREADS = {
  PARENT: [
    { id: 't1', with: 'Vie scolaire — M. Be', about: 'Retard d\'Aina', unread: 1, messages: [
      { from: 'them', at: T('2026-10-05', '08:12'), text: 'Bonjour Madame, Aina est arrivée avec 10 minutes de retard ce matin.' },
      { from: 'me', at: T('2026-10-05', '12:40'), text: 'Bonjour, le taxi-be est tombé en panne. Je joins le ticket.', photo: 'ticket' },
      { from: 'them', at: T('2026-10-13', '07:55'), text: 'Merci, le retard est justifié.' },
    ] },
    { id: 't2', with: 'Mme Ranaivo — professeure principale (1re STMG)', about: 'Orientation', unread: 0, messages: [
      { from: 'me', at: T('2026-10-09', '18:20'), text: 'Bonjour, pourrions-nous parler de l\'orientation d\'Aina ?' },
      { from: 'them', at: T('2026-10-10', '09:05'), text: 'Bien sûr, jeudi 15h30 au bureau des professeurs vous convient-il ?' },
    ] },
    { id: 't3', with: 'Bureau — économat', about: 'Paiement d\'octobre', unread: 0, messages: [
      { from: 'them', at: T('2026-10-06', '10:00'), text: 'Les frais de scolarité d\'octobre sont attendus. Vous pouvez payer au bureau ou par virement.' },
    ] },
  ],
  ELEVE: [
    { id: 'e1', with: 'Mme Ranaivo — Management', about: 'Exposé', unread: 1, messages: [
      { from: 'them', at: T('2026-10-12', '16:10'), text: 'Aina, pense à envoyer le plan de ton exposé avant jeudi.' },
    ] },
    { id: 'e2', with: 'Vie scolaire — M. Be', about: 'Carnet', unread: 0, messages: [] },
  ],
  // Enseignant : ses élèves, leurs parents, ses classes entières, ses collègues
  TEACHER: [
    { id: 'p1', with: 'Aina RAKOTOARISOA (élève, 1re STMG)', about: 'Exposé', unread: 1, messages: [
      { from: 'me', at: T('2026-10-12', '16:10'), text: 'Aina, pense à envoyer le plan de ton exposé avant jeudi.' },
      { from: 'them', at: T('2026-10-12', '19:45'), text: 'Bonsoir Madame, voici le plan en photo.', photo: 'ticket' },
    ] },
    { id: 'p2', with: 'Mme Rakotoarisoa Hanta (mère d\'Aina, 1re STMG)', about: 'Orientation', unread: 0, messages: [
      { from: 'them', at: T('2026-10-09', '18:20'), text: 'Bonjour, pourrions-nous parler de l\'orientation d\'Aina ?' },
      { from: 'me', at: T('2026-10-10', '09:05'), text: 'Bien sûr, jeudi 15h30 au bureau des professeurs vous convient-il ?' },
    ] },
    { id: 'p3', with: '1re STMG — toute la classe (élèves)', about: 'Sortie du 22 octobre', unread: 0, broadcast: 8, messages: [
      { from: 'me', at: T('2026-10-11', '10:00'), text: 'Rappel : sortie au port le 22 octobre, rendez-vous à 7h45 devant l\'école.' },
    ] },
    { id: 'p4', with: 'M. Canusis (collègue, Physique-Chimie)', about: 'Salle informatique', unread: 0, messages: [
      { from: 'them', at: T('2026-10-12', '12:15'), text: 'Je te laisse la salle informatique jeudi à 13h30.' },
    ] },
  ],
  STAFF: [
    { id: 's1', with: 'Mme Rakotoarisoa Hanta (mère d\'Aina, 1re STMG)', about: 'Retard d\'Aina', unread: 1, messages: [
      { from: 'them', at: T('2026-10-05', '12:40'), text: 'Bonjour, le taxi-be est tombé en panne. Je joins le ticket.', photo: 'ticket' },
    ] },
    { id: 's2', with: 'M. Randria Feno (père de Mamy, Tle G)', about: 'Dossier Bac', unread: 0, messages: [
      { from: 'them', at: T('2026-10-08', '09:30'), text: 'Voici la photo de la pièce d\'identité demandée pour le dossier.', photo: 'id' },
      { from: 'me', at: T('2026-10-08', '11:00'), text: 'Bien reçu, merci. Le dossier est complet.' },
    ] },
    { id: 's3', with: 'Direction — Cheffe d\'établissement', about: 'Sortie pédagogique', unread: 0, messages: [
      { from: 'them', at: T('2026-10-11', '14:00'), text: 'Merci d\'envoyer les photos de la visite du port pour le site.' },
    ] },
  ],
};

// Destinataires possibles d'un nouveau message, par catégorie et selon le profil.
// Un message à toute une classe part à chacun ; les réponses reviennent en privé.
const teachersOf = (cls) => [...new Set(CLASS_SUBJECTS.filter((x) => x.label !== 'Vie de classe').map((x) => `${x.teacher} — ${x.label} (${cls})`))];
const studentsOf = (cls) => (CLASSES[cls] ?? []).map((n) => `${n} (élève, ${cls})`);
const parentsOf = (cls) => (CLASSES[cls] ?? []).map((n) => `Parents de ${n} (${cls})`);
const MY_CLASSES = ['1re STMG', 'Terminale STMG'];
const ALL_CLASSES = Object.keys(CLASSES);
const SERVICES_STAFF = ['Direction', 'Bureau — économat', 'Vie scolaire — M. Be', 'CDI'];
const COLLEAGUES = ['M. Canusis (Physique-Chimie)', 'M. Hassanaly (Mathématiques)', 'Mme Pasimiry (Anglais)', 'Mme Felana (Histoire-Géographie)', 'Mme Karele (Économie, Droit)'];

export const RECIPIENT_GROUPS = {
  PARENT: [
    ['Professeurs d\'Aina (1re STMG)', teachersOf('1re STMG')],
    ['Établissement', SERVICES_STAFF],
  ],
  ELEVE: [
    ['Mes professeurs', teachersOf('1re STMG')],
    ['Établissement', ['Vie scolaire — M. Be', 'CDI', 'Bureau — économat']],
  ],
  TEACHER: [
    ...MY_CLASSES.map((c) => [`${c} — élèves`, [`${c} — toute la classe (élèves)`, ...studentsOf(c)]]),
    ...MY_CLASSES.map((c) => [`${c} — parents`, [`${c} — tous les parents`, ...parentsOf(c)]]),
    ['Collègues', COLLEAGUES],
    ['Établissement', SERVICES_STAFF],
  ],
  STAFF: [
    ['Classes entières', ALL_CLASSES.flatMap((c) => [`${c} — toute la classe (élèves)`, `${c} — tous les parents`])],
    ...ALL_CLASSES.map((c) => [`${c} — élèves et parents`, [...studentsOf(c), ...parentsOf(c)]]),
    ['Professeurs', COLLEAGUES],
    ['Établissement', SERVICES_STAFF],
  ],
};
export const RECIPIENTS = Object.fromEntries(Object.entries(RECIPIENT_GROUPS).map(([k, g]) => [k, g.flatMap(([, list]) => list)]));
/** Nombre de destinataires d'un envoi à toute une classe. */
export const broadcastSize = (to) => {
  const m = to.match(/^(.+) — (toute la classe \(élèves\)|tous les parents)$/);
  return m ? (CLASSES[m[1]] ?? []).length : 0;
};
