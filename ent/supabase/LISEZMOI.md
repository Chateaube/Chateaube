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
2. **Edge Functions** › *Deploy a new function* › *Via Editor* : nom `comptes`, coller `functions/comptes/index.ts`,
   **Deploy**. (La fonction utilise la clé secrète du projet, qui reste sur le serveur de Supabase.)
3. **Authentication › Sign In / Providers** : désactiver « Allow new users to sign up » (seule la Direction crée les comptes).
4. **Authentication › URL Configuration** : *Site URL* = adresse de l'application
   (`https://chateaube.github.io/Chateaube/ent/app/`), pour les liens « code oublié ».

## Application
La version installable (`npm run build:app`, mode `app`, réglages dans `ent/prototype/.env.app`) demande la
connexion (identifiant + code) et n'affiche jamais d'exemples fictifs. La démonstration (claude.ai) reste
hors ligne, avec ses exemples. La Direction crée les comptes dans Réglages › Comptes du personnel.
