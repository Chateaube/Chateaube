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

**Charte graphique** : bleu institutionnel `#003366` / `#005baa` (repris du site vitrine), sémantique constante
(vert = conforme/payé, ambre = à surveiller, rouge = bloquant, violet = flux « droits d'examen » ou IA).

## 2.2 Portails et matrice des droits

Cinq portails distincts. Chaque personne ne voit que le sien, et les droits sont portés par le rôle (jamais par la
personne).

| Fonction | Direction (administrateur) | Bureau (administration / économat) | Vie scolaire | Enseignant | Parent |
|---|:-:|:-:|:-:|:-:|:-:|
| Tableau de bord de pilotage, validation des mises à pied | ✔ | — | — | — | — |
| Paramètres (relances, calendrier, notation), gestion des agents | ✔ | — | — | — | — |
| Encaissements, états de compte, caisse, tarifs | ✔ | ✔ | — | — | son compte |
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
├── Tableau de bord ............ alertes écolage, KPI par site, bandeau du mois, échéances examens
├── Élèves & mobilité
│   ├── Annuaire / fiches élèves (historique des sites)
│   ├── Inscriptions & réinscriptions
│   └── Campagnes de transfert (Tamatave → Tana, avril) + quitus financier
├── Comptabilité
│   ├── Classes & tarifs : inscription, réinscription, écolage/mois, fascicule, location (par classe)
│   ├── Articles & services : manuel perdu/endommagé, passeport de vie scolaire, natation, tee-shirt, autre
│   ├── États de compte : par famille, soldes séparés écolage / frais annexes / droits d'examen
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
├── Classes & tarifs · Articles & services · États de compte · Caisse (entrées / sorties)
├── Droits d'examen : ventilation automatique (40 000 Ar conservés / reste à reverser), reversements
└── Recouvrement : relances (J+5), avertissements (J+10), propositions de mise à pied (J+25) → Direction
Inscriptions ................... nouvel élève (compte ouvert au mois d'arrivée), réinscriptions
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

- **Comptabilité** : Classes & tarifs (grille éditable, coût annuel calculé), Articles & services, États de compte
  (facturer un article, encaisser un paiement), Caisse : entrées / sorties.
- **Gestion des agents** : registre du personnel, entrée et sortie, accès ENT automatique.
- **Paramètres** : échéancier, relances, calendrier scolaire, avec une simulation des dates.
- **Portail enseignant** : cours du jour, appel (parents prévenus par e-mail et dans l'application), tâches, annonces.
- **Portail parents** (format mobile) : alertes, emploi du temps, notes, absences, paiements et historique, messages.


1. **Tableau de bord Direction** : bandeau du mois (octobre suspendu) avec le calendrier des relances, KPI filtrables par
   site, pipeline des impayés en 3 étapes avec validation de la mise à pied, cartes des deux campus, comptabilité séparée
   (deux journaux visuellement distincts), panneau de mobilité inter-sites et frise des examens.
2. **Réservation de matériel** : sélection du site, filtres par type, frise horaire 7h–17h avec la récréation et la
   fermeture du mercredi après-midi, formulaire vérifié en direct (conflit, horaires) avec **alternatives cliquables** (autre
   appareil libre au même horaire ou autre créneau pour le même appareil).
3. **Appréciations** : liste d'élèves avec statut (à rédiger / erreurs / conforme / validée), éditeur avec aperçu annoté
   (passages fautifs soulignés), panneau du contrôleur (4 règles bloquantes + suggestions), assistant de proposition,
   décision au format inclusif générée automatiquement. Un onglet **Notes & compétences** montre la correction de saisie.

## 2.5 Parcours critiques

**Bascule d'avril (Direction)** : Élèves & mobilité → Campagnes → « Préparer » (liste des 1re/Tle de Tamatave, classes
d'accueil à Tana, soldes d'écolage) → « Exécuter » → l'élève apparaît à Tana dès la date d'effet ; ses notes et factures
restent visibles, sa fiche affiche « Tamatave (sept. → avr.) · Tana (avr. → juil.) ».

**Impayé (automate → Direction)** : échéance le 5 → J+5 relance par e-mail et dans l'application → J+10 avertissement → J+25 le dossier apparaît
en rouge « Mise à pied à valider » → la Direction valide (notification) ou accorde un délai. Les jours sont comptés selon le
calendrier scolaire (hors fériés, vacances et octobre).

**Trimestre (Enseignant → Bureau / Direction)** : saisie des notes (au moins 4) → validation, qui verrouille les notes →
bilan des compétences → appréciation avec moyennes et avis pour le conseil → la grille du conseil se remplit
automatiquement → le conseil choisit les mentions et avertissements (propositions calculées) → bulletin publié par la
Direction.

**Encaissement (Bureau)** : rechercher l'élève → les échéances échues sont cochées d'office, celles déjà payées sont
grisées → ajuster (mois suivants, frais annuels) → chèque (n° + banque) ou virement (n° de bordereau + banque) ou
espèces → un reçu par journal, envoyé au parent.
