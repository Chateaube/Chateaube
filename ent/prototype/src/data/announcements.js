// Annonces : effectifs par site (démonstration, chiffres FICTIFS) et quelques annonces publiées.
export const SITES = { TMV: 'Tamatave', TNR: 'Tana' };

export const POPULATION = {
  TMV: {
    classes: { '6e': 24, '5e': 22, '4e': 21, '3e': 23, '2de': 20, '1re Générale': 9, '1re STMG': 8, 'Terminale Générale': 8, 'Terminale STMG': 6 },
    teachers: { all: 14, byClass: { '1re STMG': 9, 'Terminale STMG': 9, 'Terminale Générale': 10 } },
    staff: 4,
  },
  TNR: {
    classes: { '6e': 28, '5e': 26, '4e': 25, '3e': 27, '2de': 24, '1re Générale': 14, '1re STMG': 10, 'Terminale Générale': 12, 'Terminale STMG': 9 },
    teachers: { all: 16, byClass: {} },
    staff: 3,
  },
};

export const ANNOUNCEMENTS = [
  {
    id: 'n1', title: 'Journée portes ouvertes — samedi 7 novembre', at: '2026-10-12T09:00',
    text: 'Venez découvrir l\'établissement avec vos proches : visite des salles, rencontre avec les professeurs, inscriptions pour 2027-2028. De 8h à 12h.',
    author: 'Direction', audience: { roles: ['PARENT', 'ELEVE', 'PROFESSEUR', 'PERSONNEL'], site: 'TMV', scope: 'ALL', values: [] },
    pinned: true, ack: false, photos: [], reads: 214,
  },
  {
    id: 'n2', title: 'Sortie au port de Tamatave — autorisation', at: '2026-10-09T15:30',
    text: 'Les élèves de 1re STMG visiteront le port le jeudi 22 octobre. Merci de remplir l\'autorisation dans Documents avant le 19 octobre.',
    author: 'Vie scolaire', audience: { roles: ['PARENT'], site: 'TMV', scope: 'CLASS', values: ['1re STMG'] },
    pinned: false, ack: true, photos: [], reads: 4,
  },
  {
    id: 'n3', title: 'Conseils de classe du 1er trimestre', at: '2026-10-05T10:00',
    text: 'Les conseils de classe auront lieu du 7 au 11 décembre. Saisie des notes et appréciations avant le 4 décembre.',
    author: 'Direction', audience: { roles: ['PROFESSEUR'], site: 'ALL', scope: 'ALL', values: [] },
    pinned: false, ack: true, photos: [], reads: 22,
  },
];
