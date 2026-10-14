# ENT Chateaubriand — Conception de la plateforme de gestion scolaire

Dossier de conception d'un ENT sur mesure pour l'École Chateaubriand (Tananarive & Tamatave) : programme français,
candidats libres rattachés à l'Académie de La Réunion, mobilité des 1re/Tle vers Tana en avril, comptabilité séparée
entre frais de scolarité et droits d'examen.

## Contenu

| Livrable | Fichier |
|---|---|
| 1. Modèle de données (entités, diagramme, règles, hypothèses à valider) | [`docs/01-modele-de-donnees.md`](docs/01-modele-de-donnees.md) |
| Schéma PostgreSQL exécutable | [`db/schema.sql`](db/schema.sql) · [`db/functions.sql`](db/functions.sql) · [`db/seed.sql`](db/seed.sql) |
| Scénarios de vérification (30 règles métier) | [`db/tests.sql`](db/tests.sql) |
| 2. Architecture UX/UI et arborescence par profil | [`docs/02-architecture-ux.md`](docs/02-architecture-ux.md) |
| Architecture technique (SSO, tâches planifiées, IA, sécurité) | [`docs/03-architecture-technique.md`](docs/03-architecture-technique.md) |
| Cadrage par profil (questions à valider avant de développer) | [`docs/04-cadrage-par-profil.md`](docs/04-cadrage-par-profil.md) |
| 3. Prototype React + Tailwind (Direction, Bureau, Vie scolaire, Enseignant, Parent, Élève) | [`prototype/`](prototype/) — version compilée : [`prototype/dist/index.html`](prototype/dist/index.html) |
| Moteur de règles (notes, appréciations, réservations, calendrier et relances, comptabilité) | [`prototype/src/rules/`](prototype/src/rules/) + [tests](prototype/tests/rules.test.js) |

## Voir le prototype

Ouvrir `prototype/dist/index.html` dans un navigateur : un seul fichier, sans serveur ni connexion. Les données sont fictives
et la date de référence est fixée au 13 octobre 2026 (relances de frais de scolarité suspendues, campagne des candidats libres en cours).

Le bandeau noir du prototype, tout en haut, permet de **voir l'ENT en tant que** l'un des six profils, de choisir
l'**ambiance** (Océan, Aurore, Classique, Élégant) et d'activer la **protection d'écran**. Le menu est dans la barre du haut.
La charte visuelle (bleu de l'établissement, polices Poppins, Quicksand et Alice) est décrite dans
[`docs/02-architecture-ux.md`](docs/02-architecture-ux.md#21-principes-de-conception).

**Direction (administrateur)** : tableau de bord (changer la *date de référence* au 10/11/2026 pour voir des mises à
pied à valider), comptabilité, conseils de classe, **vie scolaire** (absences, punitions et sanctions, téléphones),
**documents, stages & orientation**, réservations, gestion des agents, paramètres.

**Importer des données (Excel)** (Direction, Bureau) : coller le tableau des élèves de l'année et celui des
enseignements ; contrôle ligne par ligne (classes, dates, nationalités, téléphones, numéros sautés, doublons) puis import.
Les données importées restent dans le navigateur de la personne qui importe : elles ne sont ni publiées ni partagées.

**Documents** : certificat de scolarité depuis la fiche élève (ancienneté : nouvel élève ou ancien depuis n ans) ;
bulletins du trimestre depuis le conseil de classe (aperçu, un bulletin ou toute la classe, une page A4 par élève).

**Bureau (administration / économat)** : accueil ; **Inscriptions** (pré-inscriptions, fiche élève à chaque inscription ou
réinscription, comptes de l'ENT créés depuis la fiche) ; **Encaisser** (choisir l'élève, ex. *RASOAMANANA Fy* arrivé le 12/10,
cocher les mois, chèque ou virement avec n° et banque, un reçu par journal) ; **conseils de classe** (exporter vers Excel,
imprimer ; l'appréciation générale est rédigée par la Direction) ; accès à la vie scolaire et au suivi des familles.

**Vie scolaire** : absences et retards ; punitions avec motif (choisir la classe, puis l'élève) ; téléphones
confisqués (24 h ou 5 jours ouvrés, prise en garde et restitution signées) ; documents, stages et orientation.

**Enseignant** : tableau de bord et appel ; **Notes & appréciations** en 3 étapes (1. Compétences — la base proposée reprend les compétences réelles des trois derniers trimestres, par matière, niveau et enseignant, cf. [`competencyHistory.js`](prototype/src/data/competencyHistory.js) —, 2. Notes avec
« Nouveau devoir » (publication, remarques, ramener sur 20, thèmes, compétences) et « 1O » à corriger, 3. Appréciations avec l'élève choisi dans une liste déroulante) ; cahier de textes ; punitions.

**Parent** : Accueil, **Notes** (par matière, ordre chronologique, moyenne, plus haute et plus basse de la classe),
Devoirs, **Vie scolaire** (case « Je suis informé.e »), et dans « Plus » : documents et autorisations, stages,
orientation, paiements, messages.

**Élève** : le portail parent en lecture seule, sans les paiements.

## Développement

```bash
cd prototype
npm install
npm run dev     # serveur de développement
npm test        # tests du moteur de règles (node:test)
npm run build   # régénère dist/index.html

# Base de données (PostgreSQL ≥ 14, base vide)
psql -v ON_ERROR_STOP=1 -d ent -f db/schema.sql -f db/functions.sql -f db/seed.sql -f db/tests.sql
```
