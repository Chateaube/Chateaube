# Audit technique avant mise en production — 18 octobre 2026

Périmètre : prototype React (`ent/prototype`), application installable (`ent/app`, GitHub Pages), schéma
PostgreSQL (`ent/db`). Trois piliers : performances et technique, sécurité et rôles, accessibilité (RGAA 4.1 /
WCAG 2.2 AA).

## Ce qui a été lancé

| Vérification | Outil | Résultat |
|---|---|---|
| Tests des règles métier | `npm test` (node:test) | 105 / 105 |
| Scénarios base de données | PostgreSQL 16, `tests.sql` | T1 à T58 OK |
| Parcours de tous les écrans | Playwright (7 profils) | 91 écrans, 0 erreur JS |
| Accessibilité automatique | axe-core 4.10.2, WCAG 2.0/2.1/2.2 A-AA + bonnes pratiques | 95 écrans, 11 règles en échec |
| Clavier | Playwright (ordre de tabulation, Échap) | voir § 3 |
| Responsive | Playwright, 375 px, tous les écrans du personnel | 31 écrans débordent |
| Poids | build Vite non inliné | JS 1,1 Mo (320 Ko gzip), CSS 57 Ko, polices 86 Ko, images 92 Ko |
| Chargement réseau lent | Chrome, 4G lente (1,6 Mb/s, 150 ms) et 3G, CPU ×4 | LCP 8,2 s (4G lente) / 16 s (3G), sans compression |
| Dépendances | `npm audit` | 0 vulnérabilité connue |

Les tests automatiques couvrent environ 30 à 40 % des critères RGAA : un contrôle manuel (lecteur d'écran NVDA /
TalkBack, zoom 200 %) reste nécessaire avant la production.

---

## 1. Performances et technique

**Constats**

- **Un seul fichier de 1,4 Mo** (JS + CSS + polices + images en base64), par choix : le prototype marche hors
  ligne et sans serveur. Revers : tout le code de tous les profils est téléchargé et analysé, même pour un parent
  sur téléphone. JS 1,1 Mo minifié (320 Ko gzip) en un bloc ; Vite le signale (> 500 Ko).
- **Chargement mesuré** (téléphone simulé, CPU ×4) : premier affichage utile (LCP) à **8,2 s en 4G lente** et
  **16 s en 3G** sans compression. GitHub Pages compresse en gzip (≈ 520 Ko transférés) : de l'ordre de 3 s en
  4G lente, encore lent en 3G.
- **Images** : `logo-tamatave.png` 57 Ko, `logo-chateaubriand.png` 21 Ko en PNG ; en WebP/AVIF ou SVG, 5 à 10 fois
  moins. Les photos déposées sont déjà réduites (1 400 px, JPEG 75 %) et les PDF limités à 1,5 Mo.
- **Polices** : 4 graisses de Poppins + Quicksand variable + Alice (26 Ko). Alice ne sert plus depuis que seul le
  thème Océan est proposé.
- **Données de démonstration dans le code** : `competencyHistory.js` (115 Ko), `accounting.js`, etc. sont dans le
  bundle ; en production, elles viendront de l'API.
- **Stockage** : 33 clés `localStorage` (ent-*-vN). Limite d'environ 5 Mo par site : les photos en base64
  (annonces, pièces, Vie de l'école) la remplissent vite (« Le navigateur manque de place » est déjà prévu).
- **CSS** : Tailwind v4, 57 Ko, propre (variables de thème, ambiances en `--amb-*`). Structure HTML générée par
  React : `<main>`, `<header>`, `<nav>` présents, `lang="fr"`.
- **Responsive** : à 375 px, **31 écrans débordent horizontalement**. Tout le profil Secrétariat déborde (435 px :
  la barre du haut, avec « Action rapide », est trop large). Examens blancs (456 px) et Grilles de notes (449 px)
  débordent pour tous les profils. Le portail familles (conçu mobile) ne déborde pas.
- **PWA** : service worker « réseau d'abord » correct ; icônes déclarées `any maskable` ensemble (à séparer) ;
  aucune invitation à recharger lors d'une nouvelle version.

## 2. Sécurité et gestion des rôles

> Rappel : le prototype publié est une **démonstration**. Le choix du profil (bandeau du haut) est libre et
> TOUT le contrôle d'accès de l'interface est côté navigateur ; il ne protège rien. La vraie étanchéité doit
> venir du serveur et de la base.

**Ce qui est déjà solide (base de données)**
- Les règles métier sensibles sont des **déclencheurs PostgreSQL** testés (T1 à T58) : pas d'annonce par un
  professeur, publication par la Direction seule, relecture CPE des élèves mandatés, annulation du jour,
  validation des notes, caisse, paie, mandats attribués par la Direction…
- L'acteur est lu dans la session (`current_app_user()` ← `app.user_id`), pas dans les données envoyées.

**Failles et risques**

| # | Gravité | Constat | Où |
|---|---|---|---|
| S1 | **Critique (pilote)** | **Données réelles dans le navigateur, en clair et sans limite de durée** : import Excel (`ent-import-v1`, `ent-profiles-v1`), fiches signalétiques avec santé (`ent-fiche-v1`), passages au secrétariat (`ent-passages-v1`), signatures (`ent-signatures-v1`). Sur un ordinateur partagé, la personne suivante peut tout lire (outils de développement). | `*Store.js` |
| S2 | **Critique (pilote)** | **N'importe qui peut prendre n'importe quel profil** (Direction comprise) sur la page publique, et donc voir les données réelles importées dans ce navigateur. | `App.jsx`, bandeau « Voir l'ENT en tant que » |
| S3 | **Critique (prod)** | **Lecture non cloisonnée en base** : aucune `ROW LEVEL SECURITY`, aucun `GRANT`/`REVOKE`. Les déclencheurs protègent les écritures, pas les lectures (notes, santé, vie scolaire). | `db/schema.sql` |
| S4 | **Critique (prod)** | **Codes de première connexion prévisibles** : `accessCode()` est un hachage de l'e-mail ou du téléphone. Le commentaire le dit (démonstration), mais le code ne doit pas partir tel quel. | `rules/enrollment.js:81` |
| S5 | Élevé | `app.user_id` doit être posé **par le serveur** à partir d'une session vérifiée (Google OIDC), par transaction (`SET LOCAL`), jamais à partir d'un paramètre du client ; aucun accès SQL direct pour les comptes applicatifs. | architecture |
| S6 | Moyen | **Injection de formules dans les exports CSV** : un texte libre (appréciation, motif, nom) qui commence par `=`, `+`, `-`, `@` est interprété par Excel. | `rules/gradeSheet.js:48`, `rules/accounting.js:73`, `ImportModule.jsx:112` |
| S7 | Moyen | `window.open()` + `document.write()` avec l'URL du document **non échappée** : une fenêtre du même domaine reçoit du HTML construit à la main. Ouvrir plutôt un `blob:` URL. | `PhotoInput.jsx:45` |
| S8 | Moyen | **Aucune Content-Security-Policy** ni en-têtes de sécurité (GitHub Pages ne permet pas d'en ajouter) : pas de défense en profondeur contre l'injection de script, ni contre l'affichage dans un cadre (clickjacking). | `index.html`, hébergement |
| S9 | Faible | La « protection d'écran » (écran noir à la perte du focus) ne protège rien contre une photo ou un outil tiers ; elle gêne les lecteurs d'écran et loupes. | `screenGuard.js` |
| S10 | Info | Liens externes en `rel="noreferrer"` (donc `noopener`) : correct. Pas de `dangerouslySetInnerHTML` ; React échappe le texte. `npm audit` : 0 vulnérabilité. | |

**Formulaires** : validation côté client propre (messages d'erreur, contrôles métier), mais toute règle doit
être **refaite côté serveur** (taille des fichiers, types MIME réels, longueurs, listes fermées). Pas
d'`autocomplete` sur les champs d'identité (nom, e-mail, téléphone, adresse) : utile pour l'accessibilité (WCAG
1.3.5) et pour éviter les erreurs de saisie.

## 3. Accessibilité (RGAA 4.1 / WCAG 2.2 AA)

**Résultats axe-core (95 écrans)**

| Règle | Impact | Éléments | Écrans | Critère |
|---|---|---|---|---|
| `select-name` : liste déroulante sans étiquette | critique | 16 | 9 | RGAA 11.1 / WCAG 4.1.2 |
| `label` : champ sans étiquette (Paramètres → compétences) | critique | 14 | 1 | RGAA 11.1 / 4.1.2 |
| `aria-progressbar-name` : barre de progression sans nom | sérieux | 3 | 1 | 1.1.1 |
| `color-contrast` : contraste insuffisant (cartes en `opacity-50`, « Tana · plus tard », `opacity-70`) | sérieux | 14 | 6 | RGAA 3.2 / 1.4.3 |
| `scrollable-region-focusable` : zone défilante inatteignable au clavier | sérieux | 6 | 6 | 2.1.1 |
| `target-size` : cible < 24 × 24 px (en-têtes de groupes du menu, puces) | sérieux | 534 | 84 | 2.5.8 (WCAG 2.2) |
| `heading-order` : on saute de h1 à h3 (titres des cartes) | modéré | 64 | 64 | RGAA 9.1 |
| `region` : contenu hors repère (bandeau du prototype, bande d'ambiance) | modéré | 179 | 95 | RGAA 12.6 |
| `page-has-heading-one` : portail familles sans h1 | modéré | 9 | 9 | RGAA 9.1 |
| `landmark-complementary-is-top-level` : `<aside>` imbriqué (encart d'ambiance) | modéré | 2 | 2 | |
| `empty-table-header` : `<th>` vide (Inventaire) | mineur | 2 | 2 | RGAA 5.6 |

**Contrôles manuels (clavier, structure)**

- **Pas de lien d'évitement** (« Aller au contenu ») : il faut 14 tabulations avant le menu (RGAA 12.7).
- **Focus visible faible** : contour par défaut du navigateur (1 px), peu visible sur la barre bleu foncé ; pas
  de style `:focus-visible` global (RGAA 10.7).
- **Menus déroulants** (cloche, compte, action rapide) : ni `role`, ni fermeture par **Échap**, ni retour du
  focus sur le bouton (RGAA 7.1, 12.8).
- **Fenêtre « Donner mon avis »** : `role="dialog"` sans `aria-modal` ni piège du focus (RGAA 7.1).
- **Titre de page fixe** (« ENT Chateaubriand — Prototype ») quel que soit l'écran (RGAA 8.6 / WCAG 2.4.2).
- **Messages d'état** : 18 zones `role="status"`/`alert` existent ; à généraliser aux confirmations
  d'enregistrement (RGAA 7.5 / 4.1.3).
- **Onglets du bandeau de démonstration** : `role="tab"` sans `tabpanel` (n'existera plus en production).
- **Déjà bien** : `lang="fr"`, `<main>` unique, `aria-pressed` sur les puces de filtre, `aria-expanded` sur les
  groupes du menu, `aria-hidden` sur les icônes et symboles, animations coupées par `prefers-reduced-motion`,
  ambiances aux contrastes vérifiés par les tests (AAA), textes en clair plutôt qu'en couleur seule.

---

## Checklist par priorité

### P0 — à corriger sur le prototype, avant d'y mettre des données réelles (pilote)

- [ ] **S1/S2** — Ne plus garder de données réelles en clair : effacement à la fermeture (ou `sessionStorage`),
      bouton « Effacer les données de cet ordinateur », et **désactiver le changeur de profil** dès qu'un import
      réel est présent (sinon : pilote uniquement avec données fictives, comme aujourd'hui).
- [ ] **S6** — Neutraliser les formules dans tous les exports CSV/Excel (préfixer `'` devant `= + - @` et
      tabulation).
- [ ] **S7** — Ouvrir les pièces jointes via `URL.createObjectURL(blob)` au lieu de `document.write`.
- [ ] **A11y bloquants** — étiqueter les 16 listes et 14 champs (`aria-label` ou `<label>`), nommer les barres
      de progression, corriger les 14 contrastes (pas d'`opacity` sur du texte), rendre les zones défilantes
      focusables (`tabIndex=0` + nom).
- [ ] **Clavier** — lien d'évitement, style `:focus-visible` global (contour 3 px contrasté), Échap + retour du
      focus sur les menus déroulants, `aria-modal` + piège du focus sur la fenêtre d'avis.
- [ ] **Responsive** — barre du haut du secrétariat à 375 px ; tableaux des Examens blancs et Grilles de notes
      dans un conteneur défilant.

### P1 — avant la mise en production (serveur, base, hébergement)

- [ ] **S3** — Activer la **Row Level Security** sur les tables sensibles (notes, appréciations, vie scolaire,
      santé, fiches, caisse, paie) avec des politiques par rôle et par lien (parent ↔ enfant, prof ↔ classe) ;
      `REVOKE ALL` par défaut, `GRANT` minimal à un rôle applicatif ; aucun compte ne possède les tables.
- [ ] **S5** — Session serveur après Google OIDC (cookie `HttpOnly; Secure; SameSite=Lax`), `SET LOCAL
      app.user_id` par transaction, protection CSRF, limitation des tentatives de connexion.
- [ ] **S4** — Codes de première connexion aléatoires (CSPRNG), stockés hachés, usage unique, expiration.
- [ ] **S8** — Hébergement avec en-têtes : CSP stricte (sans `unsafe-inline` une fois le fichier unique
      abandonné), `frame-ancestors 'none'`, HSTS, `X-Content-Type-Options`, `Referrer-Policy`.
- [ ] Validation serveur de tous les formulaires et des fichiers (type réel, taille, réencodage des images) ;
      stockage des fichiers hors base, URL signées à durée courte.
- [ ] Journal d'accès aux données sensibles (santé, notes) et sauvegardes chiffrées ; registre RGPD /
      loi malgache n° 2014-038 sur les données personnelles (mineurs).
- [ ] **Performances** — découper le bundle par profil (`React.lazy`) : un parent ne charge que le portail
      familles ; données de démonstration retirées ; logos en WebP/SVG ; police Alice retirée ; compression
      Brotli ; objectif LCP < 2,5 s en 4G lente.
- [ ] **A11y** — hiérarchie des titres (h2 pour les cartes), `<h1>` dans le portail familles, titre de page par
      écran, cibles ≥ 24 px (44 px sur mobile), `autocomplete` sur les champs d'identité, contenu dans des
      repères. Audit manuel RGAA complet (lecteur d'écran, zoom 200 %, mode contraste élevé) et déclaration
      d'accessibilité.

### P2 — confort, peut attendre

- [ ] Remplacer la « protection d'écran » par une mention de confidentialité (S9) ; garder `FLAG_SECURE` dans
      l'application Android.
- [ ] PWA : icônes `any` et `maskable` séparées, invitation « nouvelle version disponible ».
- [ ] Stockage local des brouillons dans IndexedDB plutôt que `localStorage` (photos).
- [ ] Tests d'accessibilité automatiques dans l'intégration continue (axe + Playwright) pour éviter les régressions.
