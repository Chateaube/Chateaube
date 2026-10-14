// Données de démonstration — messagerie (noms FICTIFS hors personnel).
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

// Destinataires possibles d'un nouveau message, selon le profil
export const RECIPIENTS = {
  PARENT: ['Vie scolaire — M. Be', 'Mme Ranaivo — professeure principale (1re STMG)', 'Bureau — économat', 'Direction'],
  ELEVE: ['Mme Ranaivo — Management', 'Vie scolaire — M. Be', 'CDI'],
  STAFF: ['Parents d\'un élève…', 'Toute une classe (parents)', 'Un.e collègue', 'Direction', 'Vie scolaire', 'Bureau'],
};
