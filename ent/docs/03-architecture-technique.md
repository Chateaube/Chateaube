# 3. Architecture technique

## 3.1 Vue d'ensemble

```
 Navigateur / PWA (React + Tailwind)        Parents & élèves (PWA mobile, SMS)
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
                                       envois SMS / e-mail / push    exports Campus France)
                                            │
                       Passerelles : SMS (agrégateur local) · e-mail transactionnel · Web Push
```

**Pile recommandée**

| Couche | Choix | Raison |
|---|---|---|
| Front | React 18 + Tailwind CSS, PWA | Écosystème standard ; composants partagés entre les profils ; mode hors ligne |
| API | Node.js + TypeScript (NestJS ou Fastify) | Même langage que le front : le moteur de règles (`prototype/src/rules/`) est partagé tel quel entre client et serveur |
| Base | PostgreSQL 16 | Contraintes d'exclusion (réservations, affectations), `daterange`, triggers comptables, `jsonb` |
| Tâches | pg-boss (file d'attente dans PostgreSQL) | Pas d'infrastructure supplémentaire |
| Hébergement | Une instance managée (VPS ou cloud) + sauvegardes quotidiennes chiffrées hors site | Taille de l'établissement (environ 600 élèves) : une seule application suffit, inutile de multiplier les services |

## 3.2 Authentification & autorisations

- **Personnel (Direction, professeurs, vie scolaire, comptabilité)** : *Se connecter avec Google* (OpenID Connect).
  À la première connexion, l'adresse doit figurer dans `sso_allowlist` ; le `sub` Google est alors lié au compte. Les
  adresses Gmail personnelles ne permettent pas de restreindre l'accès par domaine, d'où cette liste blanche. Si
  l'établissement adopte un jour Google Workspace, on ajoutera un contrôle du paramètre `hd` (domaine).
- **Parents / élèves** : lien magique par e-mail ou code par SMS (beaucoup n'ont pas de compte Google), session longue sur mobile.
- **RBAC** : `role_permission` × périmètre de site (`user_role.site_id`). Les deux comptes Direction ont le même rôle
  sans restriction de site, donc des droits strictement identiques. Aucune exception individuelle n'est possible.
- **Filtrage par site** côté API (et en option *Row-Level Security* PostgreSQL) via `v_current_site`.

## 3.3 Tâches planifiées

| Tâche | Fréquence | Règle |
|---|---|---|
| Génération des échéances d'écolage | mensuelle | refus au-delà du dernier mois payable (trigger `invoice_cutoff`) |
| Relances d'écolage | quotidienne, 8h | **ne s'exécute que si `is_dunning_month()`** : octobre ignoré ; ouverture des dossiers puis `advance_dunning_case()` |
| Expiration des avertissements 48 h | horaire | le dossier passe « en attente de validation Direction » |
| Rappel des pièces manquantes (candidats libres) | hebdomadaire en octobre | notification `DOCUMENT_MANQUANT` |
| Ouverture de la fenêtre Campus France | 1er juillet | bandeau Direction, export activé jusqu'à `closes_on` |

## 3.4 Assistant IA de rédaction

1. Le professeur clique sur « Proposer ». L'API (jamais le navigateur) envoie au LLM le **prompt système** de l'établissement
   (`SYSTEM_PROMPT` dans `prototype/src/rules/assistant.js`) et des **données minimales** : prénom, matière, moyenne,
   tendance, compétences, axe de progrès. Ni nom de famille, ni date de naissance, ni données financières.
2. La réponse passe par le **contrôleur déterministe** `checkAppreciation()` : au moins deux phrases complètes, pas de
   tutoiement, pas de formule décourageante, format « Admis.e / Retenu.e », pas de note chiffrée pour le Parcours d'ouverture.
3. En cas d'échec, la proposition est régénérée avec la liste des erreurs (2 essais au maximum), puis abandonnée.
4. Le texte arrive dans l'éditeur comme **brouillon** (`ai_assisted = true`). Le professeur relit et valide ; la base refuse
   le statut `VALIDE` si `rule_check.errors > 0`.

Le contrôleur est la vraie garantie : il s'applique aussi aux textes écrits entièrement à la main.

## 3.5 Notifications

- Canal préféré par responsable (`guardian.preferred_channel`). **SMS** par défaut pour les relances et les retards (bonne
  couverture à Madagascar), e-mail pour les documents, push pour les annonces.
- Chaque envoi est tracé par canal (`notification_delivery`) avec un nouvel essai automatique ; un échec SMS bascule sur l'e-mail.
- Les annonces ciblées sont calculées à l'envoi à partir de `announcement_audience` (OU entre lignes, ET dans une ligne).

## 3.6 Sécurité & conformité

- Chiffrement en transit (TLS) et au repos (sauvegardes, pièces d'identité des dossiers d'examen).
- Journal d'audit sur les actions sensibles ; conservation des données limitée et documentée (données de mineurs).
- Les données personnelles envoyées au fournisseur d'IA sont réduites au strict minimum, sans conservation chez le fournisseur.
- Sauvegardes quotidiennes avec test de restauration trimestriel.

## 3.7 Feuille de route proposée

| Lot | Contenu | Échéance indicative |
|---|---|---|
| 1 | Socle : comptes Google, sites, élèves, inscriptions, classes | rentrée + 2 mois |
| 2 | Finances : écolage, droits d'examen séparés, relances | avant la campagne d'octobre suivante |
| 3 | Notes, compétences, bulletins, assistant de rédaction | avant le 1er conseil de classe |
| 4 | Réservations, emplois du temps, annonces, notifications | T2 |
| 5 | Mobilité d'avril, examens, export Campus France | avant mars |
