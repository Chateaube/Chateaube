# Mise en ligne de l'ENT sur Supabase

Fichier à installer : `installation.sql` (généré par `build.sh` à partir de `../db/schema.sql`, `functions.sql`,
`seed.sql` et `10_supabase.sql`). Il ne contient **aucune donnée personnelle** : seulement la structure, les
règles d'accès et les données de référence (niveaux, matières, motifs…).

## 1. Créer le projet (Direction, 15 minutes)
1. supabase.com → créer un compte avec l'adresse de l'école → **New project**.
2. Nom `ent-chateaubriand`, région **Europe (Paris ou Frankfurt)**, mot de passe de base : à garder pour soi.
3. **Project Settings › API** : noter la *Project URL* et la clé *anon public* (à transmettre).
   Ne jamais transmettre la clé *service_role* ni le mot de passe de la base.

## 2. Installer la base (une seule fois, sur un projet neuf)
1. Ouvrir `installation.sql`, tout copier.
2. Supabase › **SQL Editor** › *New query* → coller → **Run**. Attendre « Success ».

## 3. Créer le premier compte Direction
1. Supabase › **Authentication › Users** › *Add user* › *Create new user* : e-mail et code de la Direction,
   cocher *Auto Confirm User*.
2. SQL Editor :
   ```sql
   select ent_first_direction('adresse@ecole.mg', 'direction', 'Prénom', 'NOM');
   ```
   (`direction` est l'identifiant de connexion.) Les autres comptes se créent ensuite depuis l'ENT.

## Règles d'accès (résumé)
- Professeur : ses services (devoirs, notes, bonus/malus, validation, appréciations) et l'appel de ses classes.
- Vie scolaire : toutes les absences, retards et punitions ; aucune note.
- Secrétariat : élèves, inscriptions, absences ; notes et bulletins en lecture.
- Direction : tout, y compris les comptes et les rôles.
- Personne non connectée : rien (sauf retrouver l'adresse de connexion à partir d'un identifiant).

Tests locaux : `fake_supabase.sql` puis `installation.sql` puis `test_supabase.sql` (voir l'en-tête de chaque fichier).

## 4. Mise à jour 1 — comptes du personnel (une seule fois)
1. SQL Editor › New query → coller le contenu de `20_comptes.sql` → Run.
2. **Edge Functions** › *Deploy a new function* › *Via Editor* : nom `comptes`, coller `functions/comptes/index.ts`
   (l'adresse technique de la fonction est réglée dans `VITE_FN_COMPTES` de `ent/prototype/.env.app` ; installée ici sous
   `dynamic-processor` : renommer la fonction dans Supabase ne change pas cette adresse),
   **Deploy**. (La fonction utilise la clé secrète du projet, qui reste sur le serveur de Supabase.)
3. **Authentication › Sign In / Providers** : désactiver « Allow new users to sign up » (seule la Direction crée les comptes).
4. **Authentication › URL Configuration** : *Site URL* = adresse de l'application
   (`https://chateaube.github.io/Chateaube/ent/app/`), pour les liens « code oublié ».

## Application
La version installable (`npm run build:app`, mode `app`, réglages dans `ent/prototype/.env.app`) demande la
connexion (identifiant + code) et n'affiche jamais d'exemples fictifs. La démonstration (claude.ai) reste
hors ligne, avec ses exemples. La Direction crée les comptes dans Réglages › Comptes du personnel.

## 6. Mise à jour 3 — carnets de notes en ligne (une seule fois)
1. SQL Editor › New query → coller le contenu de `30_carnets.sql` → Run. En bas : `ent_doc` et `ent_doc_history`.
2. Dans l'ENT (Direction) : **Pédagogie › Notes reçues › Envoyer les classes aux professeurs** (depuis l'ordinateur où
   le modèle Excel a été importé). À refaire après un nouvel import ou une fiche d'agent modifiée.
3. Les professeurs ouvrent **Notes et appréciations** : chaque saisie part sur le serveur (« ✓ Enregistré sur le
   serveur à … ») ; sans réseau, elle reste sur l'appareil et repart toute seule.
4. **Notes reçues** montre ce que chacun a saisi et exporte tout en Excel. L'historique (`ent_doc_history`) garde les
   versions précédentes de chaque carnet (une toutes les 10 minutes au plus), lisible par la Direction seule.

## 7. Mise à jour 4 — portail des élèves (une seule fois)
1. SQL Editor › New query → coller `40_eleves.sql` → Run (en bas : 9 règles).
2. Edge Functions › fonction des comptes › Code : remplacer par `functions/comptes/index.ts` (rôle ELEVE ajouté) → Deploy.
3. Dans l'ENT (Direction) : Élèves › Portail des élèves (comptes) → « Envoyer aux élèves » (emploi du temps, calendrier),
   puis choisir une classe → « Créer les comptes » → imprimer les fiches.
Les élèves voient : emploi du temps du jour, agenda, règlement et chartes, fiche d'orientation (2de, Terminale) et
calendrier Parcoursup. Les notes s'ouvrent le 17 décembre ; les autres rubriques sont « en cours de création ».
