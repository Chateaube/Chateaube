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
   (`https://chateaubriand.pro/ent/`), pour les liens « code oublié ».

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
1. SQL Editor › New query → coller `40_eleves.sql` → Run (en bas : 10 règles).
2. Edge Functions › fonction des comptes › Code : remplacer par `functions/comptes/index.ts` (rôle ELEVE ajouté) → Deploy.
3. Dans l'ENT (Direction) : Élèves › Portail des élèves (comptes) → « Envoyer aux élèves » (emploi du temps, calendrier),
   puis choisir une classe → « Créer les comptes » → imprimer les fiches.
Les élèves voient : emploi du temps du jour, agenda, règlement et chartes, fiche d'orientation (2de, Terminale) et
calendrier Parcoursup. Les notes s'ouvrent le 17 décembre ; les autres rubriques sont « en cours de création ».

## 8. Mise à jour 5 — conseils de classe en ligne (une seule fois)
1. SQL Editor › New query → coller `50_conseils.sql` → Run (en bas : 11 règles).
2. Dans l'ENT : **Pédagogie › Conseils de classe** (Direction) ou **Notes et conseils › Conseils de classe**
   (secrétariat). La grille se remplit avec les notes des carnets des professeurs (« Actualiser les notes »).
3. Décision et appréciation générale : le secrétariat les tape et les envoie, la Direction valide. Tout est sur le
   serveur (une fiche par élève) : chacune travaille depuis son poste. Les appréciations validées vont sur le bulletin ;
   la moyenne générale reste sur la grille, jamais sur le bulletin.

## 9. Mise à jour 6 — données partagées entre les bureaux (une seule fois)
1. SQL Editor › New query → coller `60_partage.sql` → Run (en bas : 13 règles).
2. Se connecter d'abord sur **l'ordinateur de la Direction qui contient l'import** : au premier démarrage, tout ce
   qu'il contient (élèves, caisse, paiements repris, vie scolaire, réglages…) part sur le serveur. Ensuite le
   secrétariat et la CPE se connectent : ils reçoivent les données, et chaque saisie est partagée en quelques secondes.
3. Accès : caisse, salaires, inscriptions, paiements → Direction et secrétariat ; élèves, vie scolaire, agenda,
   annonces, réglages → Direction, secrétariat et CPE. Rien pour les professeurs, les élèves et les parents.

## 10. Mise à jour 7 — classes en commun (une seule fois)
1. SQL Editor › New query → coller `70_classes_communes.sql` → Run (en bas : 16 règles).
2. Classe commune (même matière, deux professeurs) : chacun saisit ses devoirs et voit l'avancement commun
   (« 3 / 4 notes : vous 2, Hery 1 ») ; une seule moyenne sur tous les devoirs. Enseignement scientifique : 50/50.
   Une seule appréciation au bulletin : le premier qui l'écrit (ou le professeur choisi dans Notes reçues).

## 11. Mise à jour 8 — rubriques ouvertes aux professeurs (une seule fois)
1. SQL Editor › New query → coller `80_partage_professeurs.sql` → Run (en bas : 19 règles).
2. Les professeurs ont alors : Vie de classe et Fil de l'élève (leurs colles et observations ; jamais les soins),
   Examens blancs (saisie des notes de leurs matières), Grilles de notes, Vie de l'école (lecture).

## 12. Mise à jour 9 — ouverture de Tana (une seule fois)
1. SQL Editor › New query → coller `90_sites.sql` → Run (en bas : 21 règles).
2. Fonction des comptes : remplacer son code par `functions/comptes/index.ts` (Edge Functions › la fonction
   des comptes › Code → coller → Deploy). Elle range chaque nouveau compte sur son site.
3. Effet : la Direction (Mme Ratsimbazafy, Mme Lo) voit les deux sites, avec le sélecteur Tamatave / Tana en haut ;
   tous les autres comptes existants restent sur Tamatave et ne voient jamais Tana.
4. Sur Tana (sélecteur), Gestion des agents › « Nouvel agent à Tana » : Économe (caisse, dépenses, salaires,
   trésorerie, inscriptions) ou BVS (vie scolaire). Ces comptes ne voient que Tana.

## 13. Mise à jour 10 — sécurité de la connexion et numéros de reçus (une seule fois)
1. Fonction des comptes : remplacer son code par `functions/comptes/index.ts` → Deploy (« code oublié » passe par elle).
2. SQL Editor › New query → coller `100_connexion.sql` → Run (en bas : « ok »).
3. Effet : la page de connexion ne révèle plus l'e-mail d'un compte ; 5 codes faux en 15 minutes bloquent
   l'identifiant 15 minutes ; les numéros de reçus sont donnés par le serveur (jamais deux fois le même).

## 14. Mise à jour 11 — connexion : 3 essais (une seule fois)
1. SQL Editor › New query → coller `110_connexion_3_essais.sql` → Run (en bas : « ok »).
2. Effet : 3 codes faux en 15 minutes bloquent l'identifiant 15 minutes ; un compte sans code classique ne
   provoque plus « Connexion impossible ».

## 15. Mise à jour 12 — vie scolaire dans le portail des élèves (une seule fois)
1. SQL Editor › New query → coller `120_vie_scolaire_eleves.sql` → Run (en bas : 22 règles).
2. Effet : chaque élève voit sa vie scolaire (absences, retards, oublis, punitions, colles, objets) ; elle est
   mise à jour par les postes de la Direction, du secrétariat et de la vie scolaire, dans la minute.

## 16. Mise à jour 13 — droits des professeurs resserrés (une seule fois, après la 12)

Dans **SQL Editor**, collez tout le fichier `130_droits_professeurs.sql`, puis **Run**. Les deux dernières lignes doivent afficher **ok**.

Ce que cela change :
- la liste des comptes (noms, identifiants, adresses e-mail) n'est plus lisible que par la Direction ; chacun voit seulement son propre compte ;
- les professeurs lisent toujours la vie de classe (fiche de l'élève), mais n'écrivent plus que **leurs propres lignes** : leurs punitions, leurs oublis et colles, leurs objets confisqués, leur journal ; et les notes des examens blancs (pas les sessions ni leur publication). Ils ne peuvent plus rien supprimer ni modifier ce qu'un collègue ou la vie scolaire a saisi ;
- la Direction, le secrétariat et la vie scolaire gardent tous leurs droits. Aucune donnée n'est modifiée ni effacée.

Les lignes saisies par un professeur **avant** cette mise à jour ne portent pas sa signature : il ne pourra plus les corriger lui-même (la vie scolaire ou la Direction le peuvent).

