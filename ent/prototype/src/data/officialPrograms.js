// Base officielle des programmes (collège et lycée, matières d'examen d'abord) : les grandes parties de chaque
// programme national en vigueur, niveau par niveau. Elle sert de point de départ à la programmation de l'année
// (le professeur répartit les parties par trimestre) et au suivi « fait / pas fait » depuis le cahier de textes.
//
// Statut de chaque programme :
//   EN_VIGUEUR  : programme stable, parties sûres ;
//   NOUVEAU     : nouveau programme (réforme), parties générales sûres, détail à compléter depuis le BO ;
//   A_COMPLETER : nouveau programme dont le texte n'a pas pu être lu : la Direction complète la liste.
// La Direction peut ajouter, renommer ou retirer des parties (enregistré à part, cette base n'est jamais modifiée).

const P = (status, ref, items, note = '') => ({ status, ref, items, note });

// Calendrier des nouveaux programmes (sources : Eduscol « Enseigner au cycle 3 / 4 / au lycée », BO ; vérifié le 28/11/2026,
// à revérifier : les pages Eduscol sont mises à jour régulièrement)
export const REFORMS = [
  { when: 'Rentrée 2025', what: 'Français et mathématiques : nouveaux programmes en 6e (cycle 3, BO n°16 du 17 avril 2025).' },
  { when: 'Rentrée 2026', what: 'Collège : français, mathématiques et langues vivantes, nouveaux programmes du cycle 4 en 5e (BO n°10 du 5 mars 2026) ; enseignement moral et civique (BO du 13 juin 2024) à tous les niveaux. Lycée : mathématiques et enseignement scientifique, nouveaux programmes en 2de et 1re (BO n°14 du 2 avril 2026) ; langues vivantes, nouveau programme en 2de (BO n°22 du 29 mai 2025). En 4e et en 3e, les programmes de 2020 restent en vigueur.' },
  { when: 'Rentrée 2027', what: 'Collège : cycle 4 en 4e (français, mathématiques, langues vivantes) ; histoire-géographie, nouveau programme en 6e. Lycée : langues vivantes en 1re ; mathématiques, nouveau programme en Terminale.' },
  { when: 'Rentrée 2028', what: 'Collège : cycle 4 en 3e (le DNB suivra ces nouveaux programmes). Lycée : langues vivantes en Terminale.' },
  { when: 'En attente', what: 'Collège, autres matières du cycle 4 (arts plastiques, éducation musicale, EPS, histoire-géographie, SVT, physique-chimie, technologie) : projets soumis à consultation jusqu\'au 19 juin 2026, pas encore publiés officiellement.' },
];

// Liens officiels (Eduscol) : programmes en vigueur et ressources, par niveau puis par matière
export const PROGRAM_LINKS = [
  { group: 'Collège', links: [
    ['6e (cycle 3) : toutes les matières, tableau des programmes en vigueur', 'https://eduscol.education.gouv.fr/4356/enseigner-au-cycle-3'],
    ['5e, 4e, 3e (cycle 4) : toutes les matières, tableau des programmes en vigueur', 'https://eduscol.education.gouv.fr/4362/enseigner-au-cycle-4'],
    ['Nouveaux programmes de français et de mathématiques du cycle 4 (BO n°10 du 5 mars 2026)', 'https://www.education.gouv.fr/bo/2026/Hebdo10/MENE2602912A'],
    ['Repères annuels de progression et attendus de fin d\'année (6e à 3e)', 'https://eduscol.education.gouv.fr/6910/reperes-annuels-de-progression-et-attendus-de-fin-d-annee-du-cp-la-troisieme'],
    ['Français, cycle 3', 'https://eduscol.education.gouv.fr/4800/ressources-d-accompagnement-du-programme-de-francais-au-cycle-3'],
    ['Français, cycle 4', 'https://eduscol.education.gouv.fr/5733/ressources-d-accompagnement-du-programme-de-francais-au-cycle-4'],
    ['Mathématiques, cycle 3', 'https://eduscol.education.gouv.fr/5712/ressources-d-accompagnement-du-programme-de-mathematiques-au-cycle-3'],
    ['Mathématiques, cycle 4', 'https://eduscol.education.gouv.fr/5736/ressources-d-accompagnement-du-programme-de-mathematiques-au-cycle-4'],
    ['Histoire-géographie, cycle 3', 'https://eduscol.education.gouv.fr/4791/ressources-d-accompagnement-du-programme-d-histoire-et-geographie-au-cycle-3'],
    ['SVT, cycle 4', 'https://eduscol.education.gouv.fr/5742/ressources-d-accompagnement-du-programme-de-sciences-de-la-vie-et-de-la-terre-au-cycle-4'],
    ['EPS, cycle 4', 'https://eduscol.education.gouv.fr/5724/ressources-d-accompagnement-du-programme-d-education-physique-et-sportive-au-cycle-4'],
    ['Langues vivantes, collège', 'https://eduscol.education.gouv.fr/4758/ressources-d-accompagnement-pour-les-langues-vivantes-etrangeres-et-regionales-au-college'],
    ['Enseignement moral et civique, collège', 'https://eduscol.education.gouv.fr/4752/ressources-d-accompagnement-pour-l-enseignement-moral-et-civique-au-college'],
  ] },
  { group: 'Lycée (2de, 1re, Terminale)', links: [
    ['Toutes les matières du lycée général et technologique', 'https://eduscol.education.gouv.fr/4368/enseigner-au-lycee-generaltechnologique'],
    ['Seconde générale et technologique', 'https://eduscol.education.gouv.fr/5466/seconde-generale-et-technologique'],
    ['Cycle terminal de la voie générale (1re, Terminale, spécialités)', 'https://eduscol.education.gouv.fr/5418/cycle-terminal-de-la-voie-generale'],
    ['Série STMG (management, sciences de gestion, droit et économie)', 'https://eduscol.education.gouv.fr/5862/programmes-et-ressources-en-serie-stmg'],
    ['Français', 'https://eduscol.education.gouv.fr/5793/programmes-et-ressources-en-francais-voie-gt'],
    ['Mathématiques', 'https://eduscol.education.gouv.fr/5817/programmes-et-ressources-en-mathematiques-voie-gt'],
    ['Histoire-géographie', 'https://eduscol.education.gouv.fr/5799/programmes-et-ressources-en-histoire-geographie-voie-gt'],
    ['Langues vivantes', 'https://eduscol.education.gouv.fr/5811/programmes-et-ressources-en-langues-vivantes-voie-gt'],
    ['Physique-chimie', 'https://eduscol.education.gouv.fr/5829/programmes-et-ressources-en-physique-chimie-voie-gt'],
    ['SVT', 'https://eduscol.education.gouv.fr/5835/programmes-et-ressources-en-sciences-de-la-vie-et-de-la-terre-voie-gt'],
    ['Enseignement scientifique', 'https://eduscol.education.gouv.fr/5790/programmes-et-ressources-en-enseignement-scientifique-voie-g'],
    ['Philosophie', 'https://eduscol.education.gouv.fr/5826/programmes-et-ressources-en-philosophie-voie-gt'],
    ['Sciences numériques et technologie (SNT)', 'https://eduscol.education.gouv.fr/5841/programmes-et-ressources-en-sciences-numeriques-et-technologie-voie-gt'],
    ['EPS', 'https://eduscol.education.gouv.fr/5784/programmes-et-ressources-en-education-physique-et-sportive-eps-voie-gt'],
    ['Enseignement moral et civique', 'https://eduscol.education.gouv.fr/5787/programmes-et-ressources-en-enseignement-moral-et-civique-voie-gt'],
    ['Droit et grands enjeux du monde contemporain', 'https://eduscol.education.gouv.fr/5781/programmes-et-ressources-en-droit-et-grands-enjeux-du-monde-contemporain-voie-gt'],
  ] },
];

/** Niveau d'une classe pour la base : « 1re Générale » → « 1re G », « Terminale STMG » → « Tle STMG ». */
export function programLevel(cls) {
  const c = String(cls ?? '');
  if (/^6/.test(c)) return '6e'; if (/^5/.test(c)) return '5e'; if (/^4/.test(c)) return '4e'; if (/^3/.test(c)) return '3e';
  if (/^2/.test(c)) return '2de';
  if (/^1/.test(c)) return /STMG/i.test(c) ? '1re STMG' : '1re G';
  if (/^T/i.test(c)) return /STMG/i.test(c) ? 'Tle STMG' : 'Tle G';
  return c;
}

const MATHS_C4_OLD = ['Nombres et calculs', 'Organisation et gestion de données, fonctions', 'Grandeurs et mesures', 'Espace et géométrie', 'Algorithmique et programmation'];
const LV_LYCEE_2DE = ['Vivre entre générations', 'Les univers professionnels, le monde du travail', 'Le village, le quartier, la ville', 'Représentation de soi et rapport à autrui',
  'Sports et société', 'La création et le rapport aux arts', 'Saisir le monde : informer et s\'informer', 'Le passé dans le présent'];
const LV_LYCEE_CT = ['Identités et échanges', 'Espace privé et espace public', 'Art et pouvoir', 'Citoyenneté et mondes virtuels', 'Fictions et réalités',
  'Innovations scientifiques et responsabilité', 'Diversité et inclusion', 'Territoire et mémoire'];
const LV_COLLEGE = ['L\'école et la société', 'Voyages et migrations', 'Rencontres avec d\'autres cultures', 'Langages'];
const SVT_C4 = ['La planète Terre, l\'environnement et l\'action humaine', 'Le vivant et son évolution', 'Le corps humain et la santé'];
const PC_C4 = ['Organisation et transformations de la matière', 'Mouvement et interactions', 'L\'énergie et ses conversions', 'Des signaux pour observer et communiquer'];
const TECHNO_C4 = ['Design, innovation et créativité', 'Les objets techniques, les services et les changements induits dans la société',
  'La modélisation et la simulation des objets et systèmes techniques', 'L\'informatique et la programmation'];

export const OFFICIAL_PROGRAMS = {
  /* ---------------- Français ---------------- */
  'Français|6e': P('A_COMPLETER', 'BO n°16 du 17 avril 2025 (cycle 3, nouveau programme)', ['Lecture et compréhension', 'Écriture', 'Oral', 'Étude de la langue : grammaire, orthographe, lexique', 'Culture littéraire et artistique'],
    'Nouveau programme organisé en domaines : intitulés exacts à reprendre du BO.'),
  'Français|5e': P('NOUVEAU', 'BO n°10 du 5 mars 2026 (cycle 4, nouveau programme, en 5e à la rentrée 2026)', ['Devenir héroïne/héros : destins romanesques (récit, fiction)', 'Voyager en poésie : « Du monde entier au cœur du monde »', 'Expérimenter et jouer au théâtre : la société sens dessus dessous', 'Imaginer, sentir, raisonner : des histoires pour plaire et instruire'],
    'Perspective annuelle : « Éprouver, expérimenter : la découverte de soi, d\'autrui et du monde ». Quatre œuvres intégrales, au moins trois lectures cursives, deux groupements de textes.'),
  'Français|4e': P('EN_VIGUEUR', 'Programme du cycle 4 (2015, BO du 30 juillet 2020) ; nouveau programme en 4e à la rentrée 2027', ['Dire l\'amour', 'Individu et société : confrontations de valeurs ?', 'La fiction pour interroger le réel', 'Informer, s\'informer, déformer ?', 'La ville, lieu de tous les possibles ?', 'Étude de la langue', 'Écriture', 'Oral']),
  'Français|3e': P('EN_VIGUEUR', 'Programme du cycle 4 (2015, BO du 30 juillet 2020) ; nouveau programme en 3e à la rentrée 2028', ['Se raconter, se représenter', 'Dénoncer les travers de la société', 'Visions poétiques du monde', 'Agir dans la cité : individu et pouvoir', 'Progrès et rêves scientifiques', 'Étude de la langue', 'Écriture', 'Oral', 'Préparation du DNB']),
  'Français|2de': P('EN_VIGUEUR', 'Programme de 2019 (BO spécial n°1 du 22 janvier 2019)', ['La poésie du Moyen Âge au XVIIIe siècle', 'La littérature d\'idées et la presse du XIXe au XXIe siècle', 'Le roman et le récit du XVIIIe au XXIe siècle', 'Le théâtre du XVIIe au XXIe siècle', 'Étude de la langue', 'Méthodes : commentaire, dissertation, contraction et essai']),
  'Français|1re G': P('EN_VIGUEUR', 'Programme de 2019 ; œuvres au programme national renouvelées par note de service', ['La poésie du XIXe au XXIe siècle', 'La littérature d\'idées du XVIe au XVIIIe siècle', 'Le roman et le récit du Moyen Âge au XXIe siècle', 'Le théâtre du XVIIe au XXIe siècle', 'Œuvres au programme et parcours associés', 'Préparation de l\'épreuve anticipée : écrit et oral']),
  'Français|1re STMG': P('EN_VIGUEUR', 'Programme de 2019 (voie technologique)', ['La poésie du XIXe au XXIe siècle', 'La littérature d\'idées du XVIe au XVIIIe siècle', 'Le roman et le récit du Moyen Âge au XXIe siècle', 'Le théâtre du XVIIe au XXIe siècle', 'Œuvres au programme et parcours associés', 'Préparation de l\'épreuve anticipée : contraction de texte et essai, commentaire, oral']),

  /* ---------------- Mathématiques ---------------- */
  'Mathématiques|6e': P('NOUVEAU', 'BO n°16 du 17 avril 2025 (cycle 3, nouveau programme en 6e depuis la rentrée 2025)', ['Nombres et calculs', 'Grandeurs et mesures', 'Espace et géométrie', 'Organisation et gestion de données', 'Probabilités (nouveau en 6e)', 'Initiation à la pensée algébrique (nouveau)'],
    'Attendus de fin d\'année de 6e détaillés sur Eduscol.'),
  'Mathématiques|5e': P('A_COMPLETER', 'Nouveau programme du cycle 4 (2026), en 5e à la rentrée 2026', [...MATHS_C4_OLD], 'Grandes parties du cycle 4 : à confirmer avec le nouveau texte.'),
  'Mathématiques|4e': P('EN_VIGUEUR', 'Programme du cycle 4 (BO du 30 juillet 2020) ; nouveau programme en 4e à la rentrée 2027', [...MATHS_C4_OLD]),
  'Mathématiques|3e': P('EN_VIGUEUR', 'Programme du cycle 4 (BO du 30 juillet 2020) ; nouveau programme en 3e à la rentrée 2028', [...MATHS_C4_OLD, 'Préparation du DNB']),
  'Mathématiques|2de': P('NOUVEAU', 'BO n°14 du 2 avril 2026 (nouveau programme de 2de, rentrée 2026)', ['Nombres et calculs', 'Géométrie', 'Fonctions', 'Statistiques et probabilités (dont croisement de deux variables, boîtes à moustaches)', 'Algorithmique et programmation', 'Vocabulaire ensembliste et logique', 'Automatismes'],
    'Parties principales sûres ; détail à reprendre du BO.'),
  'Mathématiques|1re G': P('NOUVEAU', 'BO n°14 du 2 avril 2026 (spécialité, rentrée 2026)', ['Algèbre : suites, second degré', 'Analyse : dérivation, fonction exponentielle, trigonométrie', 'Géométrie : calcul vectoriel, produit scalaire, géométrie repérée', 'Probabilités et statistiques : probabilités conditionnelles, variables aléatoires', 'Algorithmique et programmation', 'Préparation de l\'épreuve anticipée de mathématiques'],
    'Parties de 2019 : à confirmer avec le nouveau texte de 2026.'),
  'Mathématiques|1re STMG': P('NOUVEAU', 'Programme du tronc commun de la voie technologique (nouveau texte en 2026)', ['Automatismes', 'Analyse : suites, fonctions', 'Statistiques et probabilités', 'Préparation de l\'épreuve anticipée de mathématiques'], 'À confirmer avec le nouveau texte de 2026.'),
  'Mathématiques|Tle G': P('EN_VIGUEUR', 'Spécialité de Terminale (2019) ; nouveau programme à la rentrée 2027', ['Algèbre et géométrie : dénombrement, vecteurs, droites et plans de l\'espace, orthogonalité', 'Analyse : suites, limites, dérivation et convexité, continuité, logarithme, primitives, équations différentielles, calcul intégral', 'Probabilités : loi binomiale, sommes de variables aléatoires, loi des grands nombres', 'Algorithmique et programmation']),
  'Mathématiques|Tle STMG': P('EN_VIGUEUR', 'Tronc commun de Terminale technologique (2019) ; nouveau programme à la rentrée 2027', ['Automatismes', 'Analyse : suites, fonctions (dont exponentielles)', 'Statistiques et probabilités']),

  /* ---------------- Histoire-géographie ---------------- */
  'Histoire-géographie|6e': P('EN_VIGUEUR', 'Programme du cycle 3 (2015, 2020)', ['Histoire : La longue histoire de l\'humanité et des migrations', 'Histoire : Récits fondateurs, croyances et citoyenneté dans la Méditerranée antique au Ier millénaire av. J.-C.', 'Histoire : L\'empire romain dans le monde antique',
    'Géographie : Habiter une métropole', 'Géographie : Habiter un espace de faible densité', 'Géographie : Habiter les littoraux', 'Géographie : Le monde habité']),
  'Histoire-géographie|5e': P('EN_VIGUEUR', 'Programme du cycle 4 (2015, 2020)', ['Histoire : Chrétientés et islam (VIe-XIIIe siècles), des mondes en contact', 'Histoire : Société, Église et pouvoir politique dans l\'Occident féodal (XIe-XVe siècles)', 'Histoire : Transformations de l\'Europe et ouverture sur le monde aux XVIe et XVIIe siècles',
    'Géographie : La question démographique et l\'inégal développement', 'Géographie : Des ressources limitées, à gérer et à renouveler', 'Géographie : Prévenir les risques, s\'adapter au changement global']),
  'Histoire-géographie|4e': P('EN_VIGUEUR', 'Programme du cycle 4 (2015, 2020)', ['Histoire : Le XVIIIe siècle. Expansions, Lumières et révolutions', 'Histoire : L\'Europe et le monde au XIXe siècle', 'Histoire : Société, culture et politique dans la France du XIXe siècle',
    'Géographie : L\'urbanisation du monde', 'Géographie : Les mobilités humaines transnationales', 'Géographie : Des espaces transformés par la mondialisation']),
  'Histoire-géographie|3e': P('EN_VIGUEUR', 'Programme du cycle 4 (2015, 2020)', ['Histoire : L\'Europe, un théâtre majeur des guerres totales (1914-1945)', 'Histoire : Le monde depuis 1945', 'Histoire : Françaises et Français dans une République repensée',
    'Géographie : Dynamiques territoriales de la France contemporaine', 'Géographie : Pourquoi et comment aménager le territoire ?', 'Géographie : La France et l\'Union européenne', 'Préparation du DNB']),
  'Histoire-géographie|2de': P('EN_VIGUEUR', 'Programme de 2019', ['Histoire : Le monde méditerranéen : empreintes de l\'Antiquité et du Moyen Âge', 'Histoire : XVe-XVIe siècles : un nouveau rapport au monde, un temps de mutation intellectuelle', 'Histoire : L\'État à l\'époque moderne : France et Angleterre', 'Histoire : Dynamiques et ruptures dans les sociétés des XVIIe et XVIIIe siècles',
    'Géographie : Sociétés et environnements : des équilibres fragiles', 'Géographie : Territoires, populations et développement : quels défis ?', 'Géographie : Des mobilités généralisées', 'Géographie : L\'Afrique australe : un espace en profonde mutation']),
  'Histoire-géographie|1re G': P('EN_VIGUEUR', 'Programme de 2019', ['Histoire : L\'Europe face aux révolutions', 'Histoire : La France dans l\'Europe des nationalités : politique et société (1848-1871)', 'Histoire : La Troisième République avant 1914 : un régime politique, un empire colonial', 'Histoire : La Première Guerre mondiale : le « suicide de l\'Europe » et la fin des empires européens',
    'Géographie : La métropolisation : un processus mondial différencié', 'Géographie : Une diversification des espaces et des acteurs de la production', 'Géographie : Les espaces ruraux : une multifonctionnalité toujours plus marquée', 'Géographie : La Chine : des recompositions spatiales multiples']),
  'Histoire-géographie|Tle G': P('EN_VIGUEUR', 'Programme de 2019', ['Histoire : Fragilités des démocraties, totalitarismes et Seconde Guerre mondiale (1929-1945)', 'Histoire : La multiplication des acteurs internationaux dans un monde bipolaire (de 1945 au début des années 1970)', 'Histoire : Les remises en cause économiques, politiques et sociales des années 1970 à 1991', 'Histoire : Le monde, l\'Europe et la France depuis les années 1990, entre coopérations et conflits',
    'Géographie : Mers et océans : au cœur de la mondialisation', 'Géographie : Dynamiques territoriales, coopérations et tensions dans la mondialisation', 'Géographie : L\'Union européenne dans la mondialisation : des dynamiques complexes']),
  'Histoire-géographie|1re STMG': P('A_COMPLETER', 'Programme de 2019, voie technologique (programme allégé)', ['Histoire (à compléter)', 'Géographie (à compléter)']),
  'Histoire-géographie|Tle STMG': P('A_COMPLETER', 'Programme de 2019, voie technologique (programme allégé)', ['Histoire (à compléter)', 'Géographie (à compléter)']),

  /* ---------------- Sciences ---------------- */
  'Sciences et technologie|6e': P('EN_VIGUEUR', 'Programme du cycle 3', ['Matière, mouvement, énergie, information', 'Le vivant, sa diversité et les fonctions qui le caractérisent', 'Matériaux et objets techniques', 'La planète Terre. Les êtres vivants dans leur environnement']),
  ...Object.fromEntries(['5e', '4e', '3e'].flatMap((l) => [
    [`SVT|${l}`, P('EN_VIGUEUR', 'Programme du cycle 4 (2015, 2020)', l === '3e' ? [...SVT_C4, 'Préparation du DNB (sciences)'] : SVT_C4)],
    [`Physique-chimie|${l}`, P('EN_VIGUEUR', 'Programme du cycle 4 (2015, 2020)', l === '3e' ? [...PC_C4, 'Préparation du DNB (sciences)'] : PC_C4)],
    [`Technologie|${l}`, P('EN_VIGUEUR', 'Programme du cycle 4 (2015, 2020)', l === '3e' ? [...TECHNO_C4, 'Préparation du DNB (sciences)'] : TECHNO_C4)],
  ])),
  'Enseignement scientifique|1re G': P('NOUVEAU', 'Nouveau programme (BO n°14 du 2 avril 2026, rentrée 2026)', ['Une longue histoire de la matière', 'Le Soleil, notre source d\'énergie', 'La Terre, un astre singulier', 'Son et musique, porteurs d\'information', 'Partie mathématique intégrée'],
    'Thèmes de 2019 : à confirmer avec le nouveau texte.'),
  'Enseignement scientifique|Tle G': P('EN_VIGUEUR', 'Programme de 2019 (jusqu\'à la rentrée 2027)', ['Science, climat et société', 'Le futur des énergies', 'Une histoire du vivant']),

  /* ---------------- Philosophie ---------------- */
  'Philosophie|Tle G': P('EN_VIGUEUR', 'Programme de 2019 (17 notions, voie générale)', ['L\'art', 'Le bonheur', 'La conscience', 'Le devoir', 'L\'État', 'L\'inconscient', 'La justice', 'Le langage', 'La liberté', 'La nature', 'La raison', 'La religion', 'La science', 'La technique', 'Le temps', 'Le travail', 'La vérité', 'Méthodes : dissertation et explication de texte']),
  'Philosophie|Tle STMG': P('EN_VIGUEUR', 'Programme de 2019 (7 notions, voie technologique)', ['L\'art', 'La justice', 'La liberté', 'La nature', 'La religion', 'La technique', 'La vérité', 'Méthodes : dissertation et explication de texte']),

  /* ---------------- Langues vivantes (anglais, espagnol) ---------------- */
  ...Object.fromEntries(['Anglais', 'Espagnol'].flatMap((lv) => [
    [`${lv}|6e`, P('EN_VIGUEUR', 'Programme du cycle 3', ['La personne et la vie quotidienne', 'Des repères géographiques, historiques et culturels', 'L\'imaginaire'])],
    [`${lv}|5e`, P('A_COMPLETER', 'Nouveau programme du cycle 4 (2026), en 5e à la rentrée 2026', [...LV_COLLEGE], 'Thèmes de l\'ancien cycle 4 : à confirmer avec le nouveau texte.')],
    [`${lv}|4e`, P('EN_VIGUEUR', 'Programme du cycle 4 (2015, 2020)', LV_COLLEGE)],
    [`${lv}|3e`, P('EN_VIGUEUR', 'Programme du cycle 4 (2015, 2020)', LV_COLLEGE)],
    [`${lv}|2de`, P('EN_VIGUEUR', 'Programme de 2019 (8 axes culturels)', LV_LYCEE_2DE)],
    ...['1re G', '1re STMG', 'Tle G', 'Tle STMG'].map((l) => [`${lv}|${l}`, P('EN_VIGUEUR', 'Programme du cycle terminal de 2019 (8 axes culturels)', LV_LYCEE_CT)]),
  ])),

  /* ---------------- STMG : enseignements de spécialité ---------------- */
  'Management|1re STMG': P('A_COMPLETER', 'Programme de 2019 (spécialité « Management »)', ['Thèmes du programme (à compléter depuis le BO)']),
  'Sciences de gestion et numérique|1re STMG': P('A_COMPLETER', 'Programme de 2019 (spécialité « Sciences de gestion et numérique »)', ['Thèmes du programme (à compléter depuis le BO)', 'Étude de gestion (évaluée en fin de 1re)']),
  'Droit et économie|1re STMG': P('A_COMPLETER', 'Programme de 2019 (spécialité « Droit et économie »)', ['Droit : thèmes (à compléter)', 'Économie : thèmes (à compléter)']),
  'Droit et économie|Tle STMG': P('A_COMPLETER', 'Programme de 2019 (spécialité « Droit et économie »)', ['Droit : thèmes (à compléter)', 'Économie : thèmes (à compléter)']),
  'Management, sciences de gestion et numérique|Tle STMG': P('A_COMPLETER', 'Programme de 2019 (MSGN, enseignement spécifique : mercatique)', ['Tronc commun (à compléter)', 'Enseignement spécifique « Mercatique » (à compléter)', 'Préparation du grand oral']),
};

export const PROGRAM_STATUS = {
  EN_VIGUEUR: ['Programme en vigueur', 'green'],
  NOUVEAU: ['Nouveau programme', 'navy'],
  A_COMPLETER: ['À compléter depuis le BO', 'amber'],
};

// noms de matières de l'emploi du temps → matière de la base
const ALIASES = [[/msgn|management, sciences/i, 'Management, sciences de gestion et numérique'], [/^fran/i, 'Français'], [/^math/i, 'Mathématiques'], [/histoire/i, 'Histoire-géographie'], [/^anglais/i, 'Anglais'], [/^espagnol/i, 'Espagnol'],
  [/^svt|vie et de la terre/i, 'SVT'], [/physique/i, 'Physique-chimie'], [/^techno/i, 'Technologie'], [/sciences et techno/i, 'Sciences et technologie'], [/enseignement scientifique/i, 'Enseignement scientifique'],
  [/^philo/i, 'Philosophie'], [/^management$/i, 'Management'], [/sciences de gestion et num/i, 'Sciences de gestion et numérique'], [/droit|[ée]conomie/i, 'Droit et économie']];
export const programSubject = (subject) => ALIASES.find(([re]) => re.test(String(subject ?? '')))?.[1] ?? subject;
/** Programme officiel d'une matière pour une classe, ou null. */
export const officialProgram = (subject, cls) => OFFICIAL_PROGRAMS[`${programSubject(subject)}|${programLevel(cls)}`] ?? null;
