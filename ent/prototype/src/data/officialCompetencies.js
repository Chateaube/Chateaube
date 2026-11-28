// Compétences officielles du collège, tirées des programmes déposés par la Direction (dossier « Programme Collège »,
// lu le 28/11/2026) : les « compétences travaillées » de chaque programme, par matière et par niveau.
// Elles sont proposées aux professeurs dans l'onglet « Compétences du bulletin », à côté de celles de l'an dernier.
const C3 = ['6e'];
const C4 = ['5e', '4e', '3e'];
const ALL = [...C3, ...C4];
const LV = ['Écouter et comprendre', 'Lire et comprendre', 'Parler en continu', 'Écrire', 'Réagir et dialoguer', 'Découvrir les aspects culturels de la langue'];
const SCIENCES_C4 = ['Pratiquer des démarches scientifiques', 'Concevoir, créer, réaliser', 'S\'approprier des outils et des méthodes', 'Pratiquer des langages',
  'Mobiliser des outils numériques', 'Adopter un comportement éthique et responsable', 'Se situer dans l\'espace et dans le temps'];
const HG = ['Se repérer dans le temps : construire des repères historiques', 'Se repérer dans l\'espace : construire des repères géographiques',
  'Raisonner, justifier une démarche et les choix effectués', 'S\'informer dans le monde du numérique', 'Analyser et comprendre un document',
  'Pratiquer différents langages en histoire et en géographie', 'Coopérer et mutualiser'];

const ENTRIES = [
  // [matière, niveaux, compétences, source]
  ['Mathématiques', ALL, ['Chercher', 'Modéliser', 'Représenter', 'Raisonner', 'Calculer', 'Communiquer'], 'Programmes de mathématiques des cycles 3 (2025) et 4 (2026)'],
  ['Français', C3, ['Lire avec fluidité et comprendre', 'Écrire à la main de manière fluide et rédiger des textes', 'Comprendre et s\'exprimer à l\'oral',
    'Étudier la langue : grammaire, orthographe, lexique', 'Acquérir une culture littéraire et artistique'], 'Programme de français du cycle 3 (2025)'],
  ['Français', C4, ['Comprendre et s\'exprimer à l\'oral', 'Lire, comprendre, interpréter et apprécier', 'Écrire', 'Comprendre le fonctionnement de la langue',
    'Acquérir des éléments de culture littéraire et artistique'], 'Programme de français du cycle 4 (2026 en 5e ; 2020 en 4e et 3e)'],
  ['Anglais', ALL, LV, 'Programme d\'anglais pour les classes de collège'],
  ['Espagnol', ALL, LV, 'Programme d\'espagnol pour les classes de collège'],
  ['Mandarin', ALL, LV, 'Programme de chinois pour les classes de collège'],
  ['Histoire-géographie', ALL, HG, 'Programmes d\'histoire et géographie des cycles 3 et 4 (2020)'],
  ['Enseignement moral et civique', ALL, ['Écouter, observer, réfléchir et exercer son esprit critique', 'Exprimer ce que l\'on ressent et faire preuve d\'empathie',
    'Apprendre de manière autonome', 'S\'impliquer dans un projet collectif et coopérer', 'Participer à un débat pour résoudre un conflit ou prendre une décision'],
    'Programme d\'enseignement moral et civique (2024)'],
  ['SVT', C3, ['Pratiquer des démarches scientifiques et technologiques', 'Concevoir, créer, réaliser', 'S\'approprier des outils et des méthodes', 'Pratiquer des langages',
    'Mobiliser des outils numériques', 'Adopter un comportement éthique et responsable', 'Se situer dans l\'espace et dans le temps'], 'Programme de sciences et technologie du cycle 3 (2023)'],
  ['SVT', C4, SCIENCES_C4, 'Programme du cycle 4 (2020)'],
  ['Physique-chimie', C4, SCIENCES_C4, 'Programme du cycle 4 (2020)'],
  ['Technologie', C4, ['Décrire les liens entre usages et évolutions technologiques des objets et systèmes techniques', 'Décrire les interactions entre un objet technique, son environnement et ses utilisateurs',
    'Décrire l\'organisation interne d\'un objet technique et ses échanges (énergie, données)', 'Identifier un dysfonctionnement d\'un objet technique et y remédier',
    'Imaginer, concevoir et réaliser une solution en réponse à un besoin', 'Valider une solution technique par une simulation ou un protocole de test'], 'Programme de technologie du cycle 4 (BO n°9 du 29 février 2024)'],
  ['Arts plastiques', C3, ['Expérimenter, produire, créer', 'Mettre en œuvre un projet artistique', 'Se repérer dans les domaines liés aux arts plastiques, être sensible aux questions de l\'art'], 'Programme du cycle 3 (2023)'],
  ['Arts plastiques', C4, ['Expérimenter, produire, créer', 'Mettre en œuvre un projet', 'Se repérer dans les domaines liés aux arts plastiques, être sensible aux questions de l\'art'], 'Programme du cycle 4 (2020)'],
  ['Éducation musicale', C3, ['Chanter et interpréter', 'Écouter, comparer et commenter', 'Explorer, imaginer et créer', 'Échanger, partager et argumenter'], 'Programme du cycle 3 (2023)'],
  ['Éducation musicale', C4, ['Réaliser des projets musicaux d\'interprétation ou de création', 'Écouter, comparer, construire une culture musicale commune', 'Explorer, imaginer, créer et produire',
    'Échanger, partager, argumenter et débattre'], 'Programme du cycle 4 (2020)'],
  ['EPS', C3, ['Développer sa motricité et construire un langage du corps', 'S\'approprier, seul ou à plusieurs, les méthodes et outils pour apprendre', 'Partager des règles, assumer des rôles et des responsabilités',
    'Apprendre à entretenir sa santé par une activité physique régulière', 'S\'approprier une culture physique sportive et artistique'], 'Programme du cycle 3 (2023)'],
  ['EPS', C4, ['Développer sa motricité et apprendre à s\'exprimer avec son corps', 'S\'approprier, seul ou à plusieurs, les méthodes et outils pour apprendre', 'Partager des règles, assumer des rôles et des responsabilités',
    'Apprendre à entretenir sa santé par une activité physique régulière, raisonnée et raisonnable'], 'Programme du cycle 4 (2020)'],
];

export const OFFICIAL_COMPETENCIES = Object.fromEntries(ENTRIES.flatMap(([subject, levels, items, source]) => levels.map((l) => [`${subject}|${l}`, { items, source }])));
export const officialCompetencies = (subject, level) => OFFICIAL_COMPETENCIES[`${subject}|${level}`]?.items ?? [];

// Points des programmes à étudier de près (professeurs de la matière et / ou Direction)
export const STUDY_POINTS = [
  { subject: 'Mathématiques', levels: '5e', who: 'Professeurs et Direction', title: 'Nouveau programme en 5e cette année (BO du 5 mars 2026)',
    text: 'Programme écrit année par année ; chaque chapitre commence par une rubrique « Automatismes » à faire travailler très régulièrement (automatismes quotidiens). Le calcul mental, réfléchi et posé redevient un objectif majeur : la calculatrice ne doit pas s\'y substituer. Place nouvelle de la démonstration (raisonnement par l\'absurde, contre-exemple) et de la « pensée informatique » (algorithmique). En 4e et 3e, l\'ancien programme reste en vigueur jusqu\'en 2027 et 2028 : prévoir la transition dans la progression.' },
  { subject: 'Mathématiques', levels: '6e', who: 'Professeurs', title: 'Au moins 10 problèmes par semaine, pas de calculatrice au quotidien',
    text: 'Le programme de 6e (2025) demande de traiter au moins 10 problèmes par semaine (dont des problèmes courts proposés à l\'oral) et de ne pas utiliser la calculatrice au quotidien, pour solidifier le calcul mental et posé.' },
  { subject: 'Français', levels: '6e', who: 'Professeurs', title: 'Lecture et écriture quotidiennes',
    text: 'Lecture à voix haute et lecture silencieuse chaque jour ; écriture très régulière, si possible quotidienne (copie, dictée, gammes d\'écriture, écrits courts). Trois œuvres étudiées en classe et au moins trois œuvres en lecture cursive dans l\'année.' },
  { subject: 'Français', levels: '5e', who: 'Professeurs et Direction', title: 'Nouveau programme en 5e cette année : quatre entrées et des lectures imposées en nombre',
    text: 'Perspective de l\'année : « Éprouver, expérimenter : la découverte de soi, d\'autrui et du monde ». Quatre entrées : Devenir héroïne/héros (récit) ; Voyager en poésie ; Expérimenter et jouer au théâtre ; Imaginer, sentir, raisonner (histoires pour plaire et instruire). Dans l\'année : quatre œuvres intégrales de genres et d\'époques différents, au moins trois lectures cursives et deux groupements de textes. Écrire plusieurs fois par semaine ; oral de quelques minutes. Commander les œuvres à temps (CDI, familles).' },
  { subject: 'Français', levels: '4e, 3e', who: 'Professeurs et Direction', title: 'À anticiper : nouvelles entrées en 4e (2027) et en 3e (2028)',
    text: '4e : « Rêver, délibérer, développer son jugement » (la fiction aux limites de notre monde ; habiter la terre en poète ; conflits de valeurs sur scène ; les Lumières en héritage). 3e : « S\'affirmer, s\'émanciper : l\'engagement humaniste » (le récit à l\'épreuve du réel ; l\'amour en poésie ; la scène et la Cité ; écrivains et journalistes). Oral jusqu\'à cinq minutes en 3e. Prévoir les achats de livres.' },
  { subject: 'Anglais, Espagnol, Mandarin', levels: '5e', who: 'Professeurs et Direction', title: 'Nouveaux programmes de langues, classe par classe',
    text: 'Les programmes sont écrits classe par classe, avec des outils linguistiques (grammaire, lexique, phonologie) et un niveau visé du Cadre européen (A1+, A2, A2+). Nouveaux en 5e cette année, en 4e en 2027, en 3e en 2028. Mandarin : l\'apprentissage des caractères suit une progression (nombre de caractères par semaine, seuil de référence, attendus de fin d\'année) à fixer dans la programmation.' },
  { subject: 'Technologie', levels: '5e, 4e, 3e', who: 'Professeurs et Direction', title: 'Programme de 2024 : fabriquer, réparer, programmer',
    text: 'Trois thèmes : usages et évolutions des objets techniques ; fonctionnement interne (énergie, informations) et réparation ; projet de conception. Place renforcée de la pensée informatique et des compétences manuelles (fabriquer, dépanner). Le programme prévoit un atelier de fabrication : vérifier le matériel disponible.' },
  { subject: 'Enseignement moral et civique', levels: '6e à 3e', who: 'Professeurs et Direction', title: 'Nouveau programme (2024) à tous les niveaux cette année',
    text: 'Construire une culture de la démocratie : esprit civique, engagement, règles communes. Partir de situations réelles ; débats et projets collectifs. Thèmes liés au numérique par niveau (vie privée en ligne en 6e, discours de haine en 5e, liberté d\'expression en 4e, rôle des médias en 3e). L\'éducation à la citoyenneté dépasse l\'heure d\'EMC (heures de vie de classe, projets).' },
  { subject: 'Vie affective et relationnelle (ÉVARS)', levels: '6e à 3e', who: 'Direction', title: 'Au moins trois séances obligatoires par an et par niveau',
    text: 'Le programme d\'éducation à la vie affective et relationnelle, et à la sexualité impose au moins trois séances annuelles spécifiques par niveau, en plus des liens avec les autres matières (le français et les SVT y renvoient). À planifier : dates, intervenants, information des familles.' },
  { subject: 'SVT, Physique-chimie, Histoire-géographie', levels: '5e, 4e, 3e', who: 'Direction', title: 'À compléter : programmes non lus en entier',
    text: 'Le fichier du programme du cycle 4 (2020) déposé sur le Drive est trop long pour être lu en entier : les parties SVT, physique-chimie et mathématiques (ancienne version) n\'ont pas été lues. Les compétences de ces matières reprennent la liste officielle du cycle 4. Déposer, si possible, un PDF par matière.' },
];
