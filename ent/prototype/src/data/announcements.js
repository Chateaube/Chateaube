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
    author: 'Direction', authorRole: 'DIRECTION', authorName: 'Cheffe d\'établissement', status: 'PUBLIEE', publishedAt: '2026-10-12T09:00',
    audience: { roles: ['PARENT', 'ELEVE', 'PROFESSEUR', 'PERSONNEL'], site: 'TMV', scope: 'ALL', values: [] },
    pinned: true, ack: false, photos: [], reads: 214,
  },
  {
    id: 'n2', title: 'Sortie au port de Tamatave — autorisation', at: '2026-10-09T15:30',
    text: 'Les élèves de 1re STMG visiteront le port le jeudi 22 octobre. Merci de remplir l\'autorisation dans Documents avant le 19 octobre.',
    author: 'Vie scolaire', authorRole: 'VIE_SCOLAIRE', authorName: 'M. Be', status: 'PUBLIEE', validatedBy: 'Cheffe d\'établissement', publishedAt: '2026-10-09T15:30',
    history: [{ at: '2026-10-09T11:10', by: 'M. Be', role: 'VIE_SCOLAIRE', action: 'CREEE' }, { at: '2026-10-09T11:12', by: 'M. Be', role: 'VIE_SCOLAIRE', action: 'ENVOYEE' }, { at: '2026-10-09T15:30', by: 'Cheffe d\'établissement', role: 'DIRECTION', action: 'PUBLIEE' }],
    audience: { roles: ['PARENT'], site: 'TMV', scope: 'CLASS', values: ['1re STMG'] },
    pinned: false, ack: true, photos: [], reads: 4,
  },
  {
    id: 'n3', title: 'Conseils de classe du 1er trimestre', at: '2026-10-05T10:00',
    text: 'Les conseils de classe auront lieu du 7 au 11 décembre. Saisie des notes et appréciations avant le 4 décembre.',
    author: 'Direction', authorRole: 'DIRECTION', authorName: 'Cheffe d\'établissement', status: 'PUBLIEE', publishedAt: '2026-10-05T10:00',
    audience: { roles: ['PROFESSEUR'], site: 'ALL', scope: 'ALL', values: [] },
    pinned: false, ack: true, photos: [], reads: 22,
  },
  {
    id: 'n4', title: 'Photos de classe le mardi 3 novembre', at: '2026-10-12T16:40',
    text: 'Le photographe passera le mardi 3 novembre au matin. Tenue correcte demandée ; le bon de commande sera distribué en classe.',
    author: 'Secrétariat', authorRole: 'BUREAU', authorName: 'Mme Hanta', status: 'EN_ATTENTE',
    history: [{ at: '2026-10-12T16:35', by: 'Mme Hanta', role: 'BUREAU', action: 'CREEE' }, { at: '2026-10-12T16:40', by: 'Mme Hanta', role: 'BUREAU', action: 'ENVOYEE' }],
    audience: { roles: ['PARENT', 'ELEVE'], site: 'TMV', scope: 'ALL', values: [] },
    pinned: false, ack: false, photos: [], reads: 0,
  },
  {
    id: 'n5', title: 'Sortie au port : rendez-vous à 7h45', at: '2026-10-15T18:10',
    text: 'Pour la sortie de jeudi, rendez-vous devant le portail à 7h45. Pensez à votre casquette et à une bouteille d\'eau.',
    author: 'Délégués de 1re STMG', service: 'Délégués de 1re STMG', authorRole: 'DELEGUE', authorName: 'RAKOTOARISOA Aina', status: 'EN_ATTENTE',
    history: [{ at: '2026-10-15T18:05', by: 'RAKOTOARISOA Aina', role: 'DELEGUE', action: 'CREEE' }, { at: '2026-10-15T18:10', by: 'RAKOTOARISOA Aina', role: 'DELEGUE', action: 'ENVOYEE' }],
    audience: { roles: ['ELEVE'], site: 'TMV', scope: 'CLASS', values: ['1re STMG'] },
    pinned: false, ack: false, photos: [], reads: 0,
  },
];
