// Documents et ressources de l'école (démonstration) : chacun voit ceux de son public.
// for : ELEVES, PARENTS, PROFS, PERSONNEL. Textes d'exemple, à remplacer par les documents de l'école.
export const RESOURCES = [
  { id: 'd1', title: 'Règlement intérieur — contrat de vie scolaire', for: ['ELEVES', 'PARENTS'], by: 'Direction', at: '2026-09-01', kind: 'TEXT',
    text: 'Horaires et ponctualité : les élèves sont présents dix minutes avant le début des cours.\nAbsences : justifiées par écrit dans l\'ENT par un responsable légal.\nTéléphones : interdits dans l\'établissement, sauf en sortant après les cours ; avertissement, puis confiscation (24 h, 48 h ou 5 jours ouvrés).\nTenue et respect : …\nPunitions et sanctions : …\n(Texte d\'exemple : remplacer par le règlement de l\'établissement.)' },
  { id: 'd2', title: 'Charte d\'utilisation de l\'informatique et de l\'intelligence artificielle', for: ['ELEVES', 'PARENTS', 'PROFS'], by: 'Direction', at: '2026-09-01', kind: 'TEXT',
    text: 'Matériel et réseau de l\'école : usage scolaire, compte personnel, mot de passe à ne jamais partager.\nIntelligence artificielle : autorisée pour comprendre, s\'entraîner et réviser ; interdite pour faire un devoir noté à la place de l\'élève, sauf consigne du professeur. Toute aide de l\'IA est signalée.\nDonnées personnelles : ne jamais publier de photo ou d\'information sur un camarade ou un adulte sans son accord.\n(Texte d\'exemple.)' },
  { id: 'd3', title: 'Usage des réseaux sociaux', for: ['ELEVES', 'PARENTS'], by: 'CPE', at: '2026-09-07', kind: 'TEXT',
    text: 'Ce qui se passe à l\'école reste à l\'école : pas de photo ni de vidéo dans l\'établissement.\nLe harcèlement en ligne est sanctionné comme à l\'école.\nEn cas de problème : en parler à la vie scolaire, qui garde la confidentialité.\n(Texte d\'exemple.)' },
  { id: 'r1', title: 'Règlement intérieur des professeurs — charte de l\'enseignant', for: ['PROFS'], by: 'Direction', at: '2026-09-01', kind: 'TEXT',
    text: 'Ponctualité : être en classe à l\'heure, faire l\'appel dans les dix premières minutes. Une heure de retard cumulée est à rattraper.\nNotes : au moins quatre évaluations par trimestre, saisies dans l\'ENT avant le conseil.\nAbsence : prévenir la Direction au plus tôt et laisser un devoir ou une activité pour chaque séance.\nTéléphones : un avertissement d\'abord, puis confiscation remise à la vie scolaire.\nSupports de cours de l\'école : confidentiels, à ne pas diffuser hors de l\'établissement.' },
  { id: 'r4', title: 'Guide : remplir le cahier de textes', for: ['PROFS'], by: 'Direction', at: '2026-09-02', kind: 'TEXT',
    text: '1. Le jour même, après chaque séance : « Fait en classe » (notion, exercices corrigés, pages).\n2. « Travail à faire » : consigne précise, pages et numéros, pour quel jour.\n3. Un devoir à rendre se donne au moins deux jours à l\'avance.\n4. Joindre la fiche ou la photo du tableau si utile.\n5. Les élèves et les parents le voient tout de suite dans l\'application.' },
  { id: 'r2', title: 'Procédure : absence d\'un professeur', for: ['PROFS', 'PERSONNEL'], by: 'Direction', at: '2026-09-15', kind: 'TEXT',
    text: '1. Le professeur déclare son absence dans l\'ENT (Heures et absences) et laisse un travail.\n2. Les élèves et les parents de la classe sont prévenus : les élèves viennent, en étude surveillée.\n3. La CPE voit la séance à surveiller et distribue le travail.\n4. Les heures d\'absence ne sont pas payées ; une absence sans travail est signalée à la Direction, qui peut l\'accorder pour une absence de plusieurs jours.' },
  { id: 'r3', title: 'Calendrier des conseils de classe — 1er trimestre', for: ['PROFS'], by: 'Secrétariat', at: '2026-10-05', kind: 'TEXT',
    text: 'Lundi 7 décembre : 6e, 5e\nMardi 8 décembre : 4e, 3e\nMercredi 9 décembre : 2de\nJeudi 10 décembre : 1re STMG, 1re Générale\nVendredi 11 décembre : Terminales\nNotes et appréciations à saisir avant le vendredi 4 décembre.' },
];

// Boîte à idées de l'équipe (démonstration)
export const SUGGESTIONS = [
  { id: 's1', category: 'METHODOLOGIE', text: 'Proposer une fiche méthode commune pour la dissertation, de la 2de à la Terminale, pour que tous les professeurs utilisent les mêmes repères.', by: 'RASOLO Jean', anonymous: false, at: '2026-10-02', status: 'ETUDE', answer: 'À présenter au conseil pédagogique du 16 octobre.' },
  { id: 's2', category: 'RESSOURCES', text: 'Acheter deux rallonges et un deuxième vidéoprojecteur pour la salle 12, souvent réservée.', by: null, anonymous: true, at: '2026-10-08', status: 'NOUVELLE', answer: '' },
];
