# ENT Chateaubriand — Conception de la plateforme de gestion scolaire

Dossier de conception d'un ENT sur mesure pour l'École Chateaubriand (Tananarive & Tamatave) : programme français,
candidats libres rattachés à l'Académie de La Réunion, mobilité des 1re/Tle vers Tana en avril, comptabilité séparée
entre écolage et droits d'examen.

## Contenu

| Livrable | Fichier |
|---|---|
| 1. Modèle de données (entités, diagramme, règles, hypothèses à valider) | [`docs/01-modele-de-donnees.md`](docs/01-modele-de-donnees.md) |
| Schéma PostgreSQL exécutable | [`db/schema.sql`](db/schema.sql) · [`db/functions.sql`](db/functions.sql) · [`db/seed.sql`](db/seed.sql) |
| Scénarios de vérification (8 règles métier) | [`db/tests.sql`](db/tests.sql) |
| 2. Architecture UX/UI et arborescence par profil | [`docs/02-architecture-ux.md`](docs/02-architecture-ux.md) |
| Architecture technique (SSO, tâches planifiées, IA, sécurité) | [`docs/03-architecture-technique.md`](docs/03-architecture-technique.md) |
| 3. Prototype React + Tailwind (3 écrans) | [`prototype/`](prototype/) — version compilée : [`prototype/dist/index.html`](prototype/dist/index.html) |
| Moteur de règles (notes, appréciations, réservations, finances) | [`prototype/src/rules/`](prototype/src/rules/) + [tests](prototype/tests/rules.test.js) |

## Voir le prototype

Ouvrir `prototype/dist/index.html` dans un navigateur : un seul fichier, sans serveur ni connexion. Les données sont fictives
et la date de référence est fixée au 13 octobre 2026 (relances d'écolage suspendues, campagne des candidats libres en cours).

- **Tableau de bord** : filtrer par site, valider une mise à pied ou accorder un délai, comparer les deux journaux comptables.
- **Réservations** : le formulaire est pré-rempli sur un créneau déjà pris pour montrer le conflit et les alternatives.
  On peut aussi cliquer sur la frise pour choisir un créneau, ou essayer mercredi après 12h.
- **Notes & bulletins** : l'élève Hery a une appréciation non conforme (formule décourageante, « Admis » non inclusif).
  Essayer « Proposer avec l'assistant », puis l'onglet *Notes & compétences* (« 1O », « o », « 125 », « 12.5 »).

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
