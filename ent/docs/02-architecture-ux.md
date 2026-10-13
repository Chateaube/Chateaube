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

## 2.2 Arborescence par profil

### Direction (Cheffe d'établissement **et** Directrice adjointe : menu et droits identiques)
```
Pilotage
├── Tableau de bord ............ alertes écolage, KPI par site, bandeau du mois, échéances examens
├── Élèves & mobilité
│   ├── Annuaire / fiches élèves (historique des sites)
│   ├── Inscriptions & réinscriptions
│   └── Campagnes de transfert (Tamatave → Tana, avril) + quitus financier
├── Finances
│   ├── Écolage : échéanciers, encaissements, état par classe
│   ├── Droits d'examen : encaissements, frais de dossier conservés, reversements aux centres
│   ├── Recouvrement : dossiers RELANCE / 48 h / MISE À PIED (validation)
│   └── Exports comptables (deux journaux distincts)
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
├── Comptes, rôles, liste blanche Google
├── Paramètres : années, trimestres, calendrier de relance, tarifs, dernier mois payable
└── Journal d'audit
```

### Professeur
```
Mon tableau de bord ............ cours du jour, saisies en retard, réservations à venir, annonces profs
Mes classes
├── Appel & retards (→ notification parent en 1 clic)
├── Cahier de textes / devoirs
└── Trombinoscope
Évaluations
├── Saisie des notes (grille notes + compétences, correction intelligente)
├── Appréciations (assistant IA + contrôleur de rédaction)
└── Parcours d'ouverture (appréciation seule, séances Numérique / Orientation / Art)
Réservations ................... vidéoprojecteurs, enceintes, TV, salles, informatique
Emploi du temps
Communication .................. annonces à mes classes, message à un parent
```

### Vie scolaire
```
Tableau de bord ................ absences et retards du jour par site, incidents ouverts
Assiduité ...................... saisie, justificatifs, statistiques
Discipline ..................... incidents, sanctions, suivi
Notifications parents .......... retard, discipline, document manquant (SMS / e-mail / push)
Examens ........................ complétude des dossiers candidats libres, pièces manquantes
Réservations ................... gestion du parc, arbitrage des conflits
Emplois du temps ............... pauses déjeuner par classe et par jour, salles
Annonces ....................... par classe, niveau ou site
```

### Comptabilité
```
Tableau de bord ................ encaissements du jour par caisse (Tana / Tamatave), deux catégories séparées
Écolage
├── Échéanciers par famille (mois facturables, verrou de mai pour 1re/Tle TMV)
├── Encaissements (espèces, virement, Mvola, Orange Money, Airtel Money) + reçus
└── Recouvrement : relances automatiques, avertissements 48 h, propositions de mise à pied → Direction
Droits d'examen
├── Encaissements (ventilation automatique : 40 000 Ar conservés / reste à reverser)
└── Reversements aux centres d'examen
États & exports ................ grand livre par catégorie, balance, export tableur
```

### Parent (application mobile / PWA)
```
Accueil ........................ fil d'actualités ciblé, alertes (retard, document manquant, échéance)
Mes enfants (sélecteur si fratrie)
├── Notes & compétences, bulletins (PDF)
├── Emploi du temps & devoirs
└── Absences / retards
Paiements ...................... échéancier écolage, droits d'examen, reçus, paiement mobile
Documents ...................... pièces demandées (dossier d'examen) : dépôt photo
Messages ....................... notifications reçues, contact vie scolaire
```

### Élève
```
Aujourd'hui .................... emploi du temps, devoirs, annonces de la classe
Mes notes & compétences
Mes bulletins
Examens ........................ convocation, centre (LF Tamatave / LF Tana), calendrier, pièces du dossier
Orientation .................... Parcours d'ouverture, Campus France (Terminale)
```

## 2.3 Écrans clés (prototypés dans `prototype/`)

1. **Tableau de bord Direction** : bandeau du mois (octobre suspendu) avec le calendrier des relances, KPI filtrables par
   site, pipeline des impayés en 3 étapes avec validation de la mise à pied, cartes des deux campus, comptabilité séparée
   (deux journaux visuellement distincts), panneau de mobilité inter-sites et frise des examens.
2. **Réservation de matériel** : sélection du site, filtres par type, frise horaire 7h–17h avec la récréation et la
   fermeture du mercredi après-midi, formulaire vérifié en direct (conflit, horaires) avec **alternatives cliquables** (autre
   appareil libre au même horaire ou autre créneau pour le même appareil).
3. **Appréciations** : liste d'élèves avec statut (à rédiger / erreurs / conforme / validée), éditeur avec aperçu annoté
   (passages fautifs soulignés), panneau du contrôleur (4 règles bloquantes + suggestions), assistant de proposition,
   décision au format inclusif générée automatiquement. Un onglet **Notes & compétences** montre la correction de saisie.

## 2.4 Parcours critiques

**Bascule d'avril (Direction)** : Élèves & mobilité → Campagnes → « Préparer » (liste des 1re/Tle de Tamatave, classes
d'accueil à Tana, soldes d'écolage) → « Exécuter » → l'élève apparaît à Tana dès la date d'effet ; ses notes et factures
restent visibles, sa fiche affiche « Tamatave (sept. → avr.) · Tana (avr. → juil.) ».

**Impayé (automate → Direction)** : mois actif → J+5 relance SMS/e-mail → J+7 avertissement « 48 h » → le dossier
apparaît en rouge « En attente de validation » → la Direction valide (notification de mise à pied) ou accorde un délai.

**Appréciation (Professeur)** : saisie ou « Proposer avec l'assistant » → le contrôleur souligne les problèmes →
« Corriger la forme » applique les corrections sûres (format inclusif) → « Valider » s'active à zéro erreur → publication
du bulletin par la Direction.
