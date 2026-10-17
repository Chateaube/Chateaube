# 2. Architecture UX/UI & arborescence des menus

## 2.1 Principes de conception

| Principe | Application concrète |
|---|---|
| **Le site est un filtre, pas un silo** | Sélecteur « Tous les sites / Tana / Tamatave » persistant en haut des écrans Direction et Comptabilité. Les profils mono-site (professeur de Tamatave) ne le voient pas. |
| **Le calendrier scolaire pilote l'interface** | Bandeaux contextuels selon la période : « Octobre : relances suspendues », « Avril : bascule 1re/Tle », « Juillet–août : export Campus France ». |
| **Prévenir plutôt que corriger** | Contrôles en direct : conflits de réservation, saisie des notes (« 1O » → 10), règles de rédaction des appréciations. Le bouton de validation reste désactivé tant qu'une règle bloquante n'est pas respectée. |
| **L'humain valide les décisions sensibles** | La mise à pied et la publication des bulletins demandent un clic d'un compte Direction ; l'IA ne propose que des brouillons. |
| **Sobriété réseau** | PWA installable, mise en cache hors ligne de la saisie (notes et appel), pages légères. La connexion peut être instable à Tamatave. |
| **Mobile d'abord pour les familles** | Parents et élèves consultent surtout sur smartphone : navigation par onglets en bas d'écran, notifications push ou SMS. |
| **Accessibilité** | Contrastes AA, libellés sur tous les champs, états jamais signalés par la couleur seule (icône + texte), navigation au clavier dans les grilles de saisie (Entrée accepte une suggestion). |

**Charte graphique** : couleurs franches de l'établissement, formes et typographie douces.

| Élément | Choix |
|---|---|
| Couleurs d'identité | bleu institutionnel `#003366` et `#005baa` (actions), repris du site vitrine et du logo (pilier, 1994) |
| Ambiances (au choix de chaque utilisateur) | **Océan** (dégradé bleu → turquoise), **Aurore** (dégradé indigo → violet → corail), **Classique** (bleu uni), **Élégant** (barre claire, titres Alice) |
| Menu | uniquement dans la **barre du haut** : rubriques déroulantes ; sur téléphone, un bouton menu |
| Sémantique constante | vert = conforme/payé, ambre = à surveiller, rouge = bloquant, violet = droits d'examen ou IA ; une barre de couleur sur chaque indicateur |
| Typographie | **Poppins** (titres, comme le logo), **Quicksand** (texte), **Alice** (titres des ambiances Aurore et Élégant) ; « Now » sera ajoutée dès réception du fichier de police |
| Formes | cartes arrondies (16 px) à ombre légère, boutons et étiquettes en pilule, champs arrondis |
| Repères humains | salutation personnalisée (« Bonjour Mme Ranaivo »), pastilles d'initiales colorées, une couleur stable par matière |
| Ton | phrases en minuscules plutôt que des libellés en capitales, vocabulaire de l'établissement |

## 2.2 Portails et matrice des droits

Cinq portails distincts. Chaque personne ne voit que le sien, et les droits sont portés par le rôle (jamais par la
personne).

**Qui tient quel rôle (effectif réduit).** Une personne peut cumuler plusieurs rôles (`user_role`), sur un site ou
les deux :

| Site | Direction | Bureau | Vie scolaire |
|---|---|---|---|
| Tamatave | la Cheffe d'établissement, la Directrice adjointe | le bureau « fait un peu de tout » : accueil, encaissement, inscriptions… | une personne de vie scolaire certaines années ; sinon le bureau reçoit aussi le rôle Vie scolaire |
| Tana | la même Cheffe d'établissement | l'économe | la vie scolaire |

Le Bureau a déjà accès à la vie scolaire ; ajouter ou retirer le rôle Vie scolaire à une personne ne change rien
d'autre. Tamatave n'a pas de CDI : les livres sont dans la salle d'étude / permanence (« Bibliothèque (salle d'étude) »).

| Fonction | Direction (administrateur) | Bureau (administration / économat) | Vie scolaire | Enseignant | Parent |
|---|:-:|:-:|:-:|:-:|:-:|
| Tableau de bord de pilotage, validation des mises à pied | ✔ | — | — | — | — |
| Paramètres (relances, calendrier, notation), gestion des agents | ✔ | — | — | — | — |
| Encaissements, reçus, caisse, tarifs | ✔ | ✔ | — | — | son compte |
| Liste des élèves (export Excel, trombinoscope) | ✔ | ✔ + codes d'accès des parents | ✔ | — | — |
| Documents à signer (certificat de scolarité) | signe ou refuse | demande, imprime et tamponne, ou envoie par e-mail | demande | — | — |
| Démarches en ligne (réinscription, mise à jour, pièces) | lecture | valide ou refuse | — | — | envoie |
| Inscriptions, dossiers administratifs, examens | ✔ | ✔ | dossiers d'examen | — | — |
| Grille du conseil de classe, décisions | ✔ | ✔ | — | — | — |
| Absences, retards, notifications aux parents | ✔ | ✔ | ✔ | appel de ses cours | ses enfants (« Je suis informé.e ») |
| Punitions (avec motif) / sanctions | ✔ / ✔ | ✔ / — | ✔ / — | ✔ / — | lecture + « Je suis informé.e » |
| Téléphones confisqués (garde, restitution) | ✔ | ✔ | ✔ | remise du téléphone | lecture |
| Documents, autorisations, pièces, stages, orientation | ✔ | ✔ | ✔ | — | signature et réponses |
| Cahier de textes | lecture | — | lecture | ses classes | ses enfants |
| Notes, compétences, appréciations | lecture | — | — | ses classes | ses enfants |
| Réservations de matériel | ✔ | ✔ | ✔ (gestion du parc) | ✔ | — |

Règle demandée : **le Bureau a accès à la Vie scolaire, l'inverse non.** En base, les permissions du Bureau
contiennent celles de la Vie scolaire (scénario T19), et les enseignants n'ont pas accès à la grille du conseil.

## 2.3 Arborescence par profil

### Direction : administrateur (Cheffe d'établissement **et** Directrice adjointe, menu et droits identiques)
```
Pilotage
├── Tableau de bord ............ alertes frais de scolarité, KPI par site, bandeau du mois, échéances examens
├── Inscriptions & fiches élèves
│   ├── Pré-inscriptions : demande reçue → dossier complet → entretien / test → acceptée → inscrite (+ liste d'attente, refus)
│   ├── Inscrire / réinscrire : fiche élève complète (identité, nationalités, scolarité, responsables, santé,
│   │   autorisations, pièces) → comptes de l'ENT créés (élève + responsables, connexion Google ou code d'activation)
│   └── Fiches élèves (historique des sites)
├── Mobilité Tamatave → Tana : campagnes de transfert (avril) + quitus financier
├── Comptabilité
│   ├── Classes & tarifs : inscription, réinscription, frais de scolarité/mois, fascicule, location (par classe)
│   ├── Articles & services : manuel perdu/endommagé, passeport de vie scolaire, natation, tee-shirt, autre
│   ├── Caisse : entrées / sorties du jour, par agent
│   ├── Droits d'examen : encaissements, frais de dossier conservés, reversements aux centres
│   └── Recouvrement : RELANCE → AVERTISSEMENT → MISE À PIED (validation)
Pédagogie
├── Notes & bulletins .......... suivi de saisie, conseils de classe, publication
├── Emplois du temps ........... grilles par classe, pauses déjeuner dynamiques
├── Réservations ............... calendrier d'occupation par site, arbitrage
└── Examens & Campus France
    ├── Candidats libres (octobre) : dossiers DNB / Bac, pièces, statut Académie
    ├── Logistique : DNB au LF de Tamatave, épreuves 1re/Tle au LF de Tana
    └── Campus France : export des Terminales (juillet → début septembre)
Communication
├── Annonces (ciblage : école / profs / parents-élèves / classe / niveau / site)
└── Notifications individuelles aux parents
Administration
├── Gestion des agents : registre du personnel, entrées / sorties, accès ENT
├── Comptes, rôles, liste blanche Google
├── Paramètres : échéancier (jour, mois par niveau), délais de relance, calendrier scolaire (fériés, vacances)
└── Journal d'audit
```

### Enseignant
```
Mon tableau de bord ............ cours du jour, appel, tâches (notes, appréciations), annonces profs
Mes classes
├── Appel & retards (→ notification parent en 1 clic)
├── Cahier de textes / devoirs
└── Trombinoscope
Notes & appréciations (par classe × matière, en 3 étapes)
├── 1. Compétences : mes compétences pour la classe (reprises de la base proposée par l'établissement et/ou
│   écrites par moi), avec le nombre de devoirs qui évaluent chacune
├── 2. Notes : « Nouveau devoir » = type, intitulé, devoir du / note publiée le (bouton « Aujourd'hui »), rappel
│   « publiée aux parents un jour après les élèves, soit le … », remarques par note, notation sur, coefficient,
│   « Ramener sur 20 », commentaire visible par les élèves, thème(s), compétences évaluées (mes compétences) ;
│   moyenne pondérée ; validation avec 4 notes minimum et toutes les cases remplies
└── 3. Appréciations : élève choisi dans une liste déroulante (‹ ›), moyennes T1 / T2 / T3, assistant + contrôleur,
    avis pour le conseil (élève exemplaire, bavard.e, avertissement travail / comportement…), non imprimés
Cahier de textes ............... fait en classe, travail à faire et date de remise
Punitions & téléphones ......... punition avec motif ; remise d'un téléphone confisqué à la vie scolaire
Parcours d'ouverture ........... appréciation seule (Numérique / Orientation / Art)
Réservations ................... vidéoprojecteurs, enceintes, TV, salles, informatique
Emploi du temps
Communication .................. annonces à mes classes, message à un parent
```

### Vie scolaire (onglets : Absences & retards · Punitions & sanctions · Téléphones confisqués)
```
Tableau de bord ................ absences et retards du jour par site, incidents ouverts
Assiduité ...................... saisie, justificatifs, statistiques
Discipline ..................... incidents, sanctions, suivi
Notifications parents .......... retard, discipline, document manquant (e-mail + application, pas de SMS)
Examens ........................ complétude des dossiers candidats libres, pièces manquantes
Réservations ................... gestion du parc, arbitrage des conflits
Emplois du temps ............... pauses déjeuner par classe et par jour, salles
Annonces ....................... par classe, niveau ou site
```

### Bureau : administration / économat (+ accès à la Vie scolaire)
```
Accueil ........................ encaissements du jour, chèques à déposer, échéances échues, dossiers à traiter
Encaissements & comptabilité
├── Encaisser : choisir l'élève → cocher les mois (échus proposés d'office, payés grisés) → espèces / chèque
│   (n° + banque) / virement (n° de bordereau + banque) → un reçu par journal
├── Classes & tarifs · Articles & services · Caisse (entrées / sorties)
├── Droits d'examen : ventilation automatique (40 000 Ar conservés / reste à reverser), reversements
└── Recouvrement : relances (10 j après l'échéance), avertissements (15 j après la relance), propositions de mise à pied (10 j après l'avertissement ; 5/5/5 le dernier mois) → Direction
Inscriptions & fiches élèves ... pré-inscriptions, inscription (fiche élève → comptes ENT), réinscriptions
Conseils de classe ............. grilles de notes, avis des enseignants, décisions
Vie scolaire (accès partagé) ... absences, retards, incidents
```

### Parent (application mobile / PWA) : 5 onglets en bas d'écran, sélecteur d'enfant en haut
```
Accueil ........................ alertes, emploi du temps du jour, prochains devoirs, actualités
Notes .......................... visibles dès la saisie ; par trimestre, par matière, ordre chronologique :
                                 « Note du 20 janvier 2027 », note de l'élève, moyenne de la classe sur ce devoir,
                                 plus haute, plus basse, coefficient. Pas de moyenne de matière ni de bulletin
Devoirs ........................ cahier de textes : travail à faire, fait en classe
Vie scolaire ................... absences, retards, punitions et sanctions (motif), téléphones confisqués,
                                 case « Je suis informé.e » sur chaque élément (pastille tant que ce n'est pas fait)
Plus
├── Documents & autorisations .. droit à l'image, autorisation de sortie, sorties pédagogiques (signature
│                                électronique), documents reçus (accusé de lecture), pièces demandées (dépôt)
├── Stages ..................... 3e : 1 semaine · 2de : 2 semaines ; entreprise, tuteur, convention à signer
├── Orientation ................ étapes de l'année, choix possibles, rendez-vous ; en Terminale : Parcoursup ou
│                                Parcoursup pour tous, puis Campus France et TLScontact (visa) si besoin
├── Paiements .................. solde par journal, historique, reçus (espèces, chèque, virement)
└── Messages
```

### Élève : presque identique au portail parent
Mêmes notes, devoirs (avec case « fait »), vie scolaire, documents, stages et orientation, **en lecture seule**. Pas de
paiements, pas de signature ni de « Je suis informé.e » (l'élève voit si ses parents ont confirmé).

## 2.4 Écrans clés (prototypés dans `prototype/`)

Le sélecteur **« Voir l'ENT en tant que »** (Direction, Bureau, Vie scolaire, Enseignant, Parent) permet de parcourir
chaque portail.

- **Comptabilité** : Encaisser (échéances, articles et services à prix fixe, toujours réglés en entier, ticket imprimé),
  Classes & tarifs et Articles & services (modifiables par la Direction seule, consultation pour le Bureau), États de
  compte (relevé de la famille en lecture seule, imprimable), Caisse : entrées / sorties.
- **Reçus & clôture** : journal des reçus du jour, duplicata, annulation avec motif validée par la Direction, clôture
  des espèces par comptage des billets, versements en banque avec bordereau, historique « qui a fait quoi ».
- **Réductions** : taux (frais de scolarité, inscription) fixés par la Direction, accordés élève par élève ; visibles
  sur le ticket, mois exonérés affichés comme tels.
- **Manuels scolaires** : lot de la classe (ce que reçoit et paie chaque élève, qui a quoi, distribution en un clic),
  stock et prix, prêts par titre, pertes à régler ; un manuel dû bloque le bulletin.
- **Versements en banque** : rappel le mercredi et le vendredi, versement oublié signalé ; pas de rappel pendant la
  semaine des salaires.
- **Salaires** : état de paie validé par la Direction, paiement par le Bureau avec émargement (espèces) ou référence
  (virement) ; espèces en caisse comparées aux salaires à payer.
- **Bibliothèque (salle d'étude / permanence)** : prêt et retour par cote ou recherche (titre, auteur, ISBN), prolongation avec le livre,
  retards et rappels, catalogue, étiquettes imprimables ; « Livres empruntés » dans le portail des familles.
- **Bulletins** : rubriques « Engagements » (délégué, suppléant…) et « Attestations de l'établissement » (ASSR 1 et 2,
  compétences numériques) imprimées à droite des absences.
- **Grilles de notes** : par classe, moyennes de toutes les matières ou détail des évaluations d'une matière (les
  enseignants : leurs matières) ; impression A4 paysage du seul tableau ; export Excel complet (repères de classe, rang,
  professeurs, légende). Même fiche imprimée au conseil de classe, avec absences, avis, décisions et appréciations.
- **Messagerie** : dans tous les sens (professeurs ↔ élèves, professeurs ↔ parents, collègues, établissement), envoi à
  toute une classe avec réponses en privé ; liste puis conversation sur téléphone, côte à côte sur ordinateur.
- **Menus** : Bureau (Caisse · Élèves · Notes & bulletins · Vie scolaire & messages) ; Vie scolaire (Au quotidien ·
  Ressources · Communication).
- **Pré-inscription** : fiche légère (enfant, établissement actuel, responsable, téléphone / WhatsApp, connu par, classe
  demandée), complétée à l'inscription.
- **Appel (enseignant)** : page dédiée, pensée pour le téléphone. Toutes les séances de la semaine, toutes classes
  confondues, par jour ou par classe ; la séance en cours est proposée d'office, les appels oubliés sont signalés.
  Présent par défaut, gros boutons Présent / Retard (5, 10, 15, 20 min et +) / Absent, compteurs, recherche ; parents
  prévenus ; hors connexion, l'appel est gardé sur le téléphone puis envoyé ; l'appel validé compte comme heure effectuée.
- **Donner mon avis** : bouton présent sur tous les écrans pendant le pilote (Terminales) ; « Avis du pilote » pour la
  Direction (statut, suite donnée).
- **Remise des bulletins** : en main propre, tamponnés ; bloquée en cas d'impayé ou de manuel dû (levée par la Direction).
- **Fiche signalétique** : le parent la remplit et la signe dans son compte (Plus → Fiche signalétique) ; le bureau la
  consulte, la valide et compare la signature de référence avec un document papier photographié.
- **Bulletins** : date de naissance, absences en demi-journées justifiées / non justifiées, retards ; 1 page (recto) ou
  2 pages (recto-verso), jamais plus, avec page blanche automatique pour l'impression recto-verso.
- **Gestion des agents** : registre du personnel, entrée et sortie, accès ENT automatique.
- **Paramètres** : échéancier, relances, calendrier scolaire, avec une simulation des dates.
- **Portail enseignant** : cours du jour, appel (parents prévenus par e-mail et dans l'application), tâches, annonces.
- **Portail parents** (format mobile) : alertes, emploi du temps, notes, absences, paiements et historique, messages.


1. **Tableau de bord Direction** : bandeau du mois (octobre suspendu) avec le calendrier des relances, KPI filtrables par
   site, pipeline des impayés en 3 étapes avec validation de la mise à pied, cartes des deux campus, comptabilité séparée
   (deux journaux visuellement distincts), panneau de mobilité inter-sites et frise des examens.
2. **Réservation de matériel** : liée à une séance de l'emploi du temps (date, heures, classe reprises) ou à une date et
   une heure au choix ; sélection du site, filtres par type, frise horaire 7h–17h avec la récréation et la
   fermeture du mercredi après-midi, formulaire vérifié en direct (conflit, horaires) avec **alternatives cliquables** (autre
   appareil libre au même horaire ou autre créneau pour le même appareil).
3. **Appréciations** : liste d'élèves avec statut (à rédiger / erreurs / conforme / validée), éditeur avec aperçu annoté
   (passages fautifs soulignés), panneau du contrôleur (4 règles bloquantes + suggestions), assistant de proposition,
   décision au format inclusif générée automatiquement. Un onglet **Notes & compétences** montre la correction de saisie.

## 2.5 Parcours critiques

**Bascule d'avril (Direction)** : Élèves & mobilité → Campagnes → « Préparer » (liste des 1re/Tle de Tamatave, classes
d'accueil à Tana, soldes de frais de scolarité) → « Exécuter » → l'élève apparaît à Tana dès la date d'effet ; ses notes et factures
restent visibles, sa fiche affiche « Tamatave (sept. → avr.) · Tana (avr. → juil.) ».

**Impayé (automate → Direction)** : échéance le 5 → 10 jours comptés : relance par e-mail et dans l'application → 15 jours : avertissement → 10 jours : le dossier apparaît
en rouge « Mise à pied à valider » → la Direction valide (notification) ou accorde un délai. Les jours sont comptés selon le
calendrier scolaire (hors fériés, vacances et octobre).

**Trimestre (Enseignant → Bureau / Direction)** : saisie des notes (au moins 4) → validation, qui verrouille les notes →
bilan des compétences → appréciation avec moyennes et avis pour le conseil → la grille du conseil se remplit
automatiquement → le conseil choisit les mentions et avertissements (propositions calculées) → bulletin publié par la
Direction.

**Encaissement (Bureau)** : rechercher l'élève → les échéances échues sont cochées d'office, celles déjà payées sont
grisées → ajuster (mois suivants, frais annuels) → chèque (n° + banque) ou virement (n° de bordereau + banque) ou
espèces → un reçu par journal, envoyé au parent.


## Familles en autonomie, liste des élèves, documents signés

- **Un accès par responsable** : deux parents = deux comptes, chacun son code personnel (8 caractères, imprimé sur
  un coupon depuis « Liste des élèves »), sa signature et ses accusés de lecture. Le même parent avec deux enfants
  garde un seul accès. Après le code : compte Google s'il a un e-mail, sinon téléphone et mot de passe.
- **Pré-inscription en ligne** (nouvelle famille, sans compte) : enfant, date de naissance, établissement actuel,
  classe demandée, responsable, téléphone / WhatsApp, e-mail facultatif, « connu par », pièces en photo. Elle arrive
  dans Inscriptions → Pré-inscriptions, marquée « en ligne ».
- **Réinscription et mise à jour par le parent** (Plus → Réinscription / Mettre à jour nos informations) : réinscrire
  ou annoncer un départ, photo d'identité, nationalité(s), téléphones et e-mails, santé, pièces (photo ou PDF).
  Le bureau voit les changements (avant → après) dans « Demandes des familles », valide (la fiche est mise à jour ; la
  classe de la rentrée est gardée à part, l'année en cours ne change pas) ou refuse avec un motif lu par le parent.
  La place est confirmée au paiement des frais de réinscription.
- **Photo d'identité** à l'inscription (appareil photo ou fichier, recadrée en 3 × 4) ; trombinoscope imprimable.
- **Nationalité(s)** : Malgache, Française, Chinoise, Autre.
- **Prénom d'usage** : choisi dans la fiche quand l'élève a plusieurs prénoms ; les grilles de notes n'affichent que
  ce prénom (initiale du nom en cas de doublon).
- **Liste des élèves** : par classe, recherche, export Excel complet (identité, scolarité, deux responsables, santé,
  autorisations, pièces manquantes), impression de la liste, trombinoscope, coupons de codes d'accès.
- **Documents à signer** : le bureau ou la vie scolaire demande (élève, signataire, papier ou e-mail) ; la Direction,
  même absente, est prévenue et signe depuis son téléphone avec sa signature enregistrée, ou refuse avec un motif ;
  le document revient au bureau : imprimé puis tamponné à la main, ou PDF avec le tampon numérique envoyé par
  e-mail. Chaque document signé porte un code de vérification. La signature est une image (signature simple) :
  elle prouve l'origine grâce au code, ce n'est pas une signature électronique qualifiée.
- **Grilles de notes imprimées** : uniquement les moyennes et la moyenne de la classe (plus de note la plus basse
  ou la plus haute, ni légende des professeurs, ni appréciations générales), prénom d'usage seul, rang affiché
  automatiquement au conseil du 3e trimestre, colonnes « Avis des enseignants » et « Décision » en petits caractères.
  Pas de professeur principal.

## Annonces

Direction, Bureau et Vie scolaire publient pour tout l'établissement ; un professeur, pour les parents et les élèves
de ses classes. Filtres : **pour qui** (parents, élèves, professeurs, personnel), **où** (Tamatave, Tana, les deux),
**quelle partie de l'école** (toute l'école, collège ou lycée, des niveaux, des classes). Le nombre de destinataires
s'affiche avant de publier. Texte et jusqu'à 6 photos, « J'ai lu » facultatif (suivi « lu par x / y »), épingler,
e-mail en plus de la notification, « Copier pour WhatsApp » pour les groupes existants. Pas de SMS. Les familles
voient les annonces sur l'accueil de leur portail. Base : `announcement` + `announcement_audience` (un cycle = ses niveaux).

## Retours du 17 octobre : noms, notes, familles, trésorerie

- **Noms des services** : *Secrétariat* (Tamatave : accueil, caisse, inscriptions ; *Économat* à Tana) et
  *CPE* pour la vie scolaire. Menus du secrétariat dans l'ordre Caisse, Vie scolaire, Notes, Élèves. Une seule
  apparence : Océan (dégradé bleu). La Direction a un sélecteur de site (Tana à venir).
- **CPE** : manuels, bibliothèque, cahiers de textes (lecture), liste des élèves en consultation seulement
  (ni impression ni export).
- **Inscriptions** : pièces exigées selon le cas (acte de naissance en français de moins de 3 mois pour un nouvel
  élève et pour la réinscription en 1re et en Terminale ; deux photos d'identité récentes aux normes
  internationales ; bulletins de l'année précédente pour un nouvel élève ; carnet de vaccination). Les originaux se
  déposent au secrétariat ; l'envoi en ligne sert d'aperçu. Plus de LV1 / LV2, de « peut récupérer l'élève » ni de
  certificat de radiation. Nationalité « Autre » à préciser. Campagne de pré-inscription en ligne ouverte entre deux
  dates fixées par la Direction. **Matricule** par année : code de classe + rang d'inscription (TG-001), jamais
  réattribué. **Codes des parents** : 8 chiffres, un par responsable.
- **Appréciations générales** : tapées par le secrétariat d'après les notes de la Directrice, envoyées à la
  Direction qui valide, corrige ou renvoie avec une remarque ; seules les validées vont sur le bulletin.
- **Grilles de notes** : export Excel (.xlsx) avec les couleurs de l'écran (rouge sous 10, en-têtes, colonnes
  figées) ; avant d'imprimer, choix des matières (et, au conseil, des absences et des avis) ; la décision n'est
  jamais imprimée. **Toutes les impressions** : marges réduites, pied de page avec le nom de l'école, le titre du
  document et « page / total ». Liste des élèves : colonnes à imprimer au choix (dont une colonne Signature).
- **Retrait des bulletins** : la Direction fixe « disponibles à partir du … » et un délai (2 semaines par défaut) ;
  annonce aux parents de la classe, rappel 3 jours avant la fin ; les familles à régulariser voient « en attente
  de régularisation » ; passé le délai, le bulletin est archivé au dossier et remis sur rendez-vous (pas de
  destruction : à inscrire au règlement intérieur, après avis d'un juriste).
- **Téléphones** : avertissement (téléphone non pris) ou confiscation de 24 h, 48 h ou 5 jours ouvrés (proposée
  selon les faits précédents) ; le propriétaire peut être un autre élève (rendu au propriétaire, les deux familles
  prévenues). **Avertissement** : punition que peuvent donner les professeurs, la CPE et le secrétariat.
- **Poursuite d'études** : une piste par pays ; la France (Parcoursup) n'est pas obligatoire mais conseillée en
  plan B ; une piste se clôture avec un motif.
- **Agendas** : cours, événements de l'école, devoirs, affichables ensemble ou séparément ; export iCalendar pour
  Google Agenda / Apple Agenda (lien d'abonnement avec le serveur).
- **Salaires** : préparés et payés par le secrétariat sans attendre la Direction (qui voit chaque paiement et peut
  marquer l'état « vu ») ; les taux horaires restent réservés à la Direction.
- **Trésorerie** : dépenses (catégorie, fournisseur, échéance, payée / à payer, photo de la facture obligatoire
  au-delà de 100 000 Ar ; une dépense en espèces sort de la caisse) et fournisseurs. Tableau de bord de la
  Direction : trésorerie nette, reste à recouvrer, dépenses engagées, entrées et sorties par mois, dépenses par
  catégorie. Les dépôts en banque ne sont pas des dépenses.

**Portail des familles selon la classe.** Le menu « Plus » dépend de l'enfant affiché : *Stages* en 3e et en 2de
(ou s'il reste un stage passé à consulter), *Orientation* de la 3e à la Terminale, *Réinscription* dans toutes les
classes sauf la Terminale. Ce qui ne concerne pas l'enfant reste visible, grisé et sans clic, avec « (ne concerne pas votre enfant) » ; le menu suit l'enfant choisi en haut de l'écran.

**Catalogue pour tous (bibliothèque et manuels).** Direction, secrétariat, CPE, professeurs, élèves et parents
consultent le même catalogue : une barre de recherche (titre, auteur, éditeur, matière, classe ; sans tenir compte
des accents) et des filtres (romans, annales, documentaires, référence, BD, manuels). Chaque livre affiche ses
exemplaires disponibles, ou la date de retour prévue s'ils sont tous empruntés ; chaque manuel, son stock (les
manuels se prennent avec le lot de la classe). **Élèves et professeurs réservent** un livre pour une date (au plus
30 jours à l'avance) : il est mis de côté au secrétariat jusqu'à 2 jours après, sinon la personne entre en liste
d'attente. Les **parents consultent seulement**. Le secrétariat voit les réservations à préparer, les remet (le
prêt est enregistré), remet en rayon celles non retirées et met de côté un livre rendu pour le premier en attente.

## Heures des professeurs, absences, ressources internes

- **Volume horaire** (Direction, secrétariat) : à partir de l'emploi du temps, pour le mois ou le trimestre :
  heures prévues (jours de classe seulement, hors fériés et vacances), prévues à ce jour, faites, absences (dont
  sans travail laissé), reste à faire ; détail par classe et matière. Le professeur voit ses propres heures. Les
  heures des vacataires dans Salaires sont proposées à partir de ce calcul (avec le serveur : les appels validés).
- **Absence d'un professeur** : déclarée par lui-même, la Direction, le secrétariat ou la CPE, séance par séance
  (d'après l'emploi du temps), avec un motif et le **travail laissé** : devoir ou activité (consignes ou document
  joint, photo ou PDF). « Rien laissé » reste possible mais est signalé à la Direction. La CPE voit les **séances à
  surveiller** avec le travail à distribuer. Les heures d'absence ne sont pas payées.
- **Annonces internes** : déjà possibles avec Annonces (destinataires Professeurs ou Personnel).
- **Ressources internes** : documents partagés par la Direction, le secrétariat ou la CPE avec les professeurs ou
  tout le personnel, jamais avec les familles. Consultation seulement : pas de bouton de téléchargement ni
  d'impression, clic droit et copie bloqués, écran masqué dès que la page perd le focus, filigrane au nom de la
  personne et à la date. Aucun site ne peut empêcher une photo de l'écran avec un autre téléphone : le filigrane
  permet de savoir d'où vient une fuite ; dans l'application Android, la capture d'écran est bloquée.

## Retours : menu des familles, livres, jeux, absences longues, retards, ressources

- **Portail des familles et des élèves** : plus de menu « Plus ». La barre du bas garde les écrans de tous les
  jours (Accueil, Notes, Devoirs, Vie scolaire, Messages) ; l'**accueil montre toutes les fonctions**, rangées en
  « Scolarité » et « Démarches », avec un badge rouge quand une action est attendue ; ce qui ne concerne pas
  l'enfant est grisé. Viennent ensuite « À faire et à savoir », les annonces et la journée.
- **Rappel avant le retour d'un livre** : 3 jours avant, à l'élève et à ses parents (accueil du portail), et liste
  « À rendre bientôt » pour le secrétariat.
- **Jeux de société** (salle d'étude) : le cahier papier passe en ligne : qui sort quel jeu (classe, prénoms),
  retour complet ou incident (pièce manquante, jeu abîmé, avec une note), incidents à régler, jeux les plus joués
  du mois. Les élèves voient les jeux libres ; les parents n'ont pas besoin de cette information.
- **Absences des professeurs** : pour une absence de plusieurs jours, la Direction peut **dispenser de travail**
  (« travail non requis ») à la déclaration ou après coup ; « rien laissé » reste signalé. À chaque absence, les
  **élèves et les parents de la classe sont prévenus** : le cours n'a pas lieu avec le professeur, mais les élèves
  viennent, en étude surveillée, avec le travail laissé s'il y en a un.
- **Retards des professeurs** : pointage (5, 10, 15 minutes…) par la CPE, le secrétariat ou la Direction ; à
  chaque heure cumulée, une heure est à rattraper ; l'heure rattrapée est enregistrée.
- **Ressources internes** : un document, un lien ou un texte (consigne, annonce). **Pas de filigrane** : écran
  noir dès que la page perd le focus, ni téléchargement, ni impression, ni copie. Blocage réel des captures :
  dans l'application installée (Android : capture = écran noir ; iPhone : la capture ne peut pas être interdite,
  mais l'enregistrement d'écran affiche un écran noir et l'application masque le contenu dès qu'elle passe en
  arrière-plan). Une photo prise avec un autre appareil reste possible : la protection juridique (clause de
  confidentialité et de non-concurrence dans le contrat des professeurs) complète la protection technique.

**Documents et ressources par public, boîte à idées.** Un même écran « Documents, ressources et idées » : chaque
document est destiné à un ou plusieurs publics (élèves, parents, professeurs, personnel). Les familles trouvent
« Règlement et chartes » sur l'accueil de leur portail (règlement intérieur / contrat de vie scolaire, charte
informatique et IA, usage des réseaux sociaux), lisibles librement. Les professeurs trouvent leur règlement, le
guide du cahier de textes, les procédures… en consultation seulement (écran noir en cas de capture). La **boîte à
idées** permet aux professeurs et au personnel de proposer une idée (école, ressources, méthodologie, vie
scolaire), avec ou sans leur nom ; la Direction répond : à l'étude, retenue, ou non retenue avec un mot
d'explication.
