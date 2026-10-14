# 3. Architecture technique

## 3.1 Vue d'ensemble

```
 Navigateur / PWA (React + Tailwind)        Parents & élèves (PWA mobile)
            │  HTTPS (JSON)                              │
            ▼                                            ▼
 ┌──────────────────────────── API applicative (Node.js / TypeScript) ───────────────────────────┐
 │ Auth (Google OIDC + liste blanche ; lien magique pour les familles)  · RBAC par rôle et par site │
 │ Modules : Élèves & mobilité · Finances · Relances · Notes & bulletins · Réservations · Examens  │
 │           Annonces · Notifications · Assistant de rédaction (LLM + contrôleur)                │
 └──────────────┬───────────────────────────┬──────────────────────────┬──────────────────────────┘
                │                           │                          │
        PostgreSQL (données,          File de tâches (pg-boss)      Stockage objet chiffré
        règles critiques en base)     relances quotidiennes,        (pièces d'examen, bulletins PDF,
                                       envois e-mail / application   exports Campus France)
                                            │
                       Passerelles : e-mail transactionnel · notifications de l'application (Web Push) — pas de SMS
```

**Pile recommandée**

| Couche | Choix | Raison |
|---|---|---|
| Front | React 18 + Tailwind CSS, PWA | Écosystème standard ; composants partagés entre les profils ; mode hors ligne |
| API | Node.js + TypeScript (NestJS ou Fastify) | Même langage que le front : le moteur de règles (`prototype/src/rules/`) est partagé tel quel entre client et serveur |
| Base | PostgreSQL 16 | Contraintes d'exclusion (réservations, affectations), `daterange`, triggers comptables, `jsonb` |
| Tâches | pg-boss (file d'attente dans PostgreSQL) | Pas d'infrastructure supplémentaire |
| Hébergement | Une instance managée (VPS ou cloud) + sauvegardes quotidiennes chiffrées hors site | Taille de l'établissement (environ 600 élèves) : une seule application suffit, inutile de multiplier les services |

## 3.2 Tana et Tamatave : une plateforme, deux espaces cloisonnés

**Question posée :** faut-il séparer les deux sites dès la conception, pour que chacun ait ses propres archives ?

**Recommandation : une seule application et une seule base, mais un cloisonnement strict par site.** Ce n'est pas deux
applications.

| Option | Avantages | Inconvénients |
|---|---|---|
| Deux applications séparées | Isolation totale | Le transfert d'avril des 1re/Tle devient une **ressaisie** (notes, factures, historique perdus ou recopiés) ; deux mises à jour, deux sauvegardes, deux comptes pour la Direction ; pas de vision consolidée |
| **Une application, données cloisonnées par site (recommandé)** | Transfert d'avril sans perte (T6) ; la Direction voit les deux sites ; une seule maintenance ; chaque site garde **ses** paramètres (tarifs, calendrier, relances) | Exige un filtrage rigoureux par site, ce que le modèle prévoit déjà |

Concrètement :
- **Chaque donnée porte son site** (classe, caisse, ressource, paramètres, agents). Un utilisateur du Bureau ou de la
  Vie scolaire de Tamatave ne voit que Tamatave. Seule la Direction voit les deux sites.
- **Cloisonnement en base** avec la *Row-Level Security* de PostgreSQL : même en cas de bug applicatif, une requête de
  Tamatave ne peut pas lire Tana.
- **Archives par site et par année** : à la clôture d'une année, chaque site produit son archive (bulletins PDF,
  grand livre, états de compte, registre des agents), en lecture seule et exportable.
- **Numérotation propre à chaque site** des reçus (`ECO-TMV-00413`, `ECO-TANA-…`) et des caisses.
- **Démarrage par Tamatave** : Tana existe dans le modèle mais reste désactivé tant que ses paramètres ne sont pas saisis.

## 3.3 Authentification & autorisations

- **Personnel (Direction, professeurs, vie scolaire, comptabilité)** : *Se connecter avec Google* (OpenID Connect).
  À la première connexion, l'adresse doit figurer dans `sso_allowlist` ; le `sub` Google est alors lié au compte. Les
  adresses Gmail personnelles ne permettent pas de restreindre l'accès par domaine, d'où cette liste blanche. Si
  l'établissement adopte un jour Google Workspace, on ajoutera un contrôle du paramètre `hd` (domaine).
- **Parents / élèves** : lien magique par e-mail (beaucoup n'ont pas de compte Google), session longue sur mobile.
- **RBAC** : `role_permission` × périmètre de site (`user_role.site_id`). Rôles : Direction (administrateur, tous
  sites), Bureau (administration / économat + vie scolaire), Vie scolaire, Enseignant, Parent, Élève. Les deux comptes
  Direction ont le même rôle, donc des droits strictement identiques. Aucune exception individuelle n'est possible.
- **Filtrage par site** côté API (et en option *Row-Level Security* PostgreSQL) via `v_current_site`.

## 3.4 Tâches planifiées

| Tâche | Fréquence | Règle |
|---|---|---|
| Génération des échéances de frais de scolarité | mensuelle | refus au-delà du dernier mois payable (trigger `invoice_cutoff`) |
| Relances de frais de scolarité | quotidienne, 8h | `advance_dunning_case()` sur chaque dossier : dates calculées par `dunning_schedule()` (jours comptés selon le calendrier scolaire, octobre gelé) ; délais comptés depuis l'étape précédente (10 / 15 / 10 jours, 5 / 5 / 5 le dernier mois du plan) |
| Mises à pied dues | quotidienne | délai de mise à pied atteint → le dossier passe « à valider » (`v_dunning_awaiting_validation`) ; notification envoyée seulement après validation Direction |
| Clôture mensuelle de la caisse | dernier jour du mois, 18h | export Excel (CSV) et PDF de la caisse du mois : soldes d'ouverture et de clôture par journal, totaux par mode de paiement et par jour, détail des mouvements ; archivé et non modifiable |
| Fermeture des accès des agents sortis | quotidienne | `staff_access_active()` faux après la date de sortie → session révoquée |
| Rappel des pièces manquantes (candidats libres) | hebdomadaire en octobre | notification `DOCUMENT_MANQUANT` |
| Ouverture de la fenêtre Campus France | 1er juillet | bandeau Direction, export activé jusqu'à `closes_on` |

## 3.5 Assistant IA de rédaction

1. Le professeur clique sur « Proposer ». L'API (jamais le navigateur) envoie au LLM le **prompt système** de l'établissement
   (`SYSTEM_PROMPT` dans `prototype/src/rules/assistant.js`) et des **données minimales** : prénom, matière, moyenne,
   tendance, compétences, axe de progrès. Ni nom de famille, ni date de naissance, ni données financières.
2. La réponse passe par le **contrôleur déterministe** `checkAppreciation()` : au moins deux phrases complètes, pas de
   tutoiement, pas de formule décourageante, format « Admis.e / Retenu.e », pas de note chiffrée pour le Parcours d'ouverture.
3. En cas d'échec, la proposition est régénérée avec la liste des erreurs (2 essais au maximum), puis abandonnée.
4. Le texte arrive dans l'éditeur comme **brouillon** (`ai_assisted = true`). Le professeur relit et valide ; la base refuse
   le statut `VALIDE` si `rule_check.errors > 0`.

Le contrôleur est la vraie garantie : il s'applique aussi aux textes écrits entièrement à la main.

## 3.6 Notifications

- **Pas de SMS** : aucun budget n'est prévu pour ce poste. Les envois passent par **e-mail** et par les
  **notifications de l'application** (Web Push sur la PWA installée). Le canal SMS est absent du modèle (`notif_channel`).
- Chaque envoi est tracé par canal (`notification_delivery`), avec un nouvel essai automatique ; si une notification de
  l'application échoue, l'e-mail prend le relais.
- **Relance des accusés de lecture** : si la case « Je suis informé.e » n'est pas cochée au bout de 48 h
  (`school_life_policy.ack_reminder_hours`), une relance part par e-mail et dans l'application (`v_pending_parent_ack`).
- Les annonces ciblées sont calculées à l'envoi à partir de `announcement_audience` (OU entre lignes, ET dans une ligne).

## 3.7 Sécurité & conformité

- Chiffrement en transit (TLS) et au repos (sauvegardes, pièces d'identité des dossiers d'examen).
- Journal d'audit sur les actions sensibles ; conservation des données limitée et documentée (données de mineurs).
- Les données personnelles envoyées au fournisseur d'IA sont réduites au strict minimum, sans conservation chez le fournisseur.
- Sauvegardes quotidiennes avec test de restauration trimestriel.

## 3.8 Feuille de route proposée

| Lot | Contenu | Échéance indicative |
|---|---|---|
| 1 | Socle : comptes Google, sites, élèves, inscriptions, classes | rentrée + 2 mois |
| 2 | Finances : frais de scolarité, droits d'examen séparés, relances | avant la campagne d'octobre suivante |
| 3 | Notes, compétences, bulletins, assistant de rédaction | avant le 1er conseil de classe |
| 4 | Réservations, emplois du temps, annonces, notifications | T2 |
| 5 | Mobilité d'avril, examens, export Campus France | avant mars |
