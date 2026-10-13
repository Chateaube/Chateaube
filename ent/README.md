# ENT Chateaubriand — Conception de la plateforme de gestion scolaire

Dossier de conception d'un ENT sur mesure pour l'École Chateaubriand (Tananarive & Tamatave) : programme français,
candidats libres rattachés à l'Académie de La Réunion, mobilité des 1re/Tle vers Tana en avril, comptabilité séparée
entre écolage et droits d'examen.

## Contenu

| Livrable | Fichier |
|---|---|
| 1. Modèle de données (entités, diagramme, règles, hypothèses à valider) | [`docs/01-modele-de-donnees.md`](docs/01-modele-de-donnees.md) |
| Schéma PostgreSQL exécutable | [`db/schema.sql`](db/schema.sql) · [`db/functions.sql`](db/functions.sql) · [`db/seed.sql`](db/seed.sql) |
| Scénarios de vérification (20 règles métier) | [`db/tests.sql`](db/tests.sql) |
| 2. Architecture UX/UI et arborescence par profil | [`docs/02-architecture-ux.md`](docs/02-architecture-ux.md) |
| Architecture technique (SSO, tâches planifiées, IA, sécurité) | [`docs/03-architecture-technique.md`](docs/03-architecture-technique.md) |
| Cadrage par profil (questions à valider avant de développer) | [`docs/04-cadrage-par-profil.md`](docs/04-cadrage-par-profil.md) |
| 3. Prototype React + Tailwind (Direction, Bureau, Vie scolaire, Enseignant, Parent) | [`prototype/`](prototype/) — version compilée : [`prototype/dist/index.html`](prototype/dist/index.html) |
| Moteur de règles (notes, appréciations, réservations, calendrier et relances, comptabilité) | [`prototype/src/rules/`](prototype/src/rules/) + [tests](prototype/tests/rules.test.js) |

## Voir le prototype

Ouvrir `prototype/dist/index.html` dans un navigateur : un seul fichier, sans serveur ni connexion. Les données sont fictives
et la date de référence est fixée au 13 octobre 2026 (relances d'écolage suspendues, campagne des candidats libres en cours).

Le sélecteur **« Voir l'ENT en tant que »** (en haut du menu) bascule entre les cinq portails.

**Direction (administrateur)** : tableau de bord (changer la *date de référence* au 10/11/2026 pour voir des mises à
pied à valider), comptabilité, conseils de classe, vie scolaire, réservations, gestion des agents, paramètres
(échéancier, relances, calendrier, notation).

**Bureau (administration / économat)** : accueil du jour ; **Encaisser** : choisir l'élève (ex. *RASOAMANANA Fy*,
arrivé le 12/10), cocher les mois, payer par chèque ou virement (n° et banque obligatoires), un reçu par journal ;
grille du **conseil de classe** (mentions proposées, moyenne générale hors arts, musique et vie de classe) ; accès à la
vie scolaire.

**Vie scolaire** : absences et retards du jour, justificatifs, SMS aux parents, incidents.

**Enseignant** : tableau de bord et appel ; **Notes & appréciations** en 3 étapes :
1. **Notes** : « 1O » de Fanja à corriger, « + Ajouter une note » en Terminale STMG pour atteindre 4 notes.
2. **Compétences** : en 1re Générale · EMC, essayer « Copier et adapter ».
3. **Appréciations** : moyennes, assistant, avis pour le conseil.

**Parent** : application mobile avec alertes, notes, paiements (espèces, chèque, virement) et messages.

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
