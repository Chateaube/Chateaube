# 1. Modèle de données

> Référence exécutable : [`db/schema.sql`](../db/schema.sql) (structure), [`db/functions.sql`](../db/functions.sql) (règles métier),
> [`db/seed.sql`](../db/seed.sql) (référentiels) et [`db/tests.sql`](../db/tests.sql) (8 scénarios de vérification).
> SGBD cible : **PostgreSQL ≥ 14** (contraintes d'exclusion, `daterange`/`tstzrange`, `jsonb`).

## 1.1 Principe directeur : tout s'accroche à l'inscription

La difficulté centrale de l'établissement est la **mobilité en cours d'année** (1re/Tle de Tamatave → Tana en avril).
Le modèle sépare donc trois notions que les logiciels du marché confondent souvent :

| Notion | Table | Change en avril ? |
|---|---|---|
| **Qui** est l'élève | `student` | non |
| **Inscription** annuelle (classe d'origine, année) | `enrollment` | **non** |
| **Lieu** où l'élève est physiquement accueilli | `site_assignment` (historisée par `daterange`) | **oui** : une nouvelle ligne |

Notes, compétences, bulletins, factures, paiements, dossiers d'examen et relances référencent tous `enrollment_id`.
Le transfert (`execute_transfer_campaign`) **ferme** l'affectation Tamatave la veille de la bascule et **ouvre** une affectation
Tana (`reason = TRANSFERT_EXAMEN`). Aucune ligne pédagogique ou financière n'est déplacée ni copiée ; une contrainte
`EXCLUDE` interdit deux affectations simultanées. La vue `v_current_site` donne le site du jour et sert au filtrage par site.

## 1.2 Diagramme entité-relation (simplifié)

```mermaid
erDiagram
  SITE ||--o{ SCHOOL_CLASS : accueille
  ACADEMIC_YEAR ||--o{ SCHOOL_CLASS : "organise"
  LEVEL ||--o{ SCHOOL_CLASS : "niveau"
  STUDENT ||--o{ ENROLLMENT : "s'inscrit"
  SCHOOL_CLASS ||--o{ ENROLLMENT : "classe d'origine"
  ENROLLMENT ||--|{ SITE_ASSIGNMENT : "historique géographique"
  SITE ||--o{ SITE_ASSIGNMENT : ""
  TRANSFER_CAMPAIGN }o--|| SITE : "de / vers"
  STUDENT }o--o{ GUARDIAN : STUDENT_GUARDIAN

  ENROLLMENT ||--o{ INVOICE : "échéances"
  FEE_SCHEDULE ||--o{ INVOICE : tarif
  PAYMENT ||--o{ PAYMENT_ALLOCATION : ""
  INVOICE ||--o{ PAYMENT_ALLOCATION : ""
  LEDGER_ENTRY ||--|{ LEDGER_LINE : "partie double"
  LEDGER_ACCOUNT ||--o{ LEDGER_LINE : ""
  ENROLLMENT ||--o{ DUNNING_CASE : "recouvrement"
  DUNNING_CASE ||--o{ DUNNING_EVENT : transitions

  ENROLLMENT ||--o{ EXAM_REGISTRATION : "candidat libre"
  EXAM_SESSION ||--o{ EXAM_REGISTRATION : ""
  EXAM_REGISTRATION ||--o{ EXAM_DOCUMENT : "pièces"
  EXAM_SESSION ||--o{ EXAM_FEE_REMITTANCE : "reversements"
  CAMPUS_FRANCE_EXPORT ||--o{ CAMPUS_FRANCE_ENTRY : ""

  SITE ||--o{ RESOURCE : "matériel"
  RESOURCE ||--o{ BOOKING : "réservations"
  APP_USER ||--o{ BOOKING : ""

  TEACHING_ASSIGNMENT ||--o{ EVALUATION : ""
  EVALUATION ||--o{ EVALUATION_COMPETENCY : "colonnes"
  EVALUATION ||--o{ GRADE : ""
  ENROLLMENT ||--o{ GRADE : ""
  ENROLLMENT ||--o{ REPORT_CARD : bulletins
  REPORT_CARD ||--o{ REPORT_COMMENT : "appréciations"

  ANNOUNCEMENT ||--|{ ANNOUNCEMENT_AUDIENCE : ciblage
  GUARDIAN ||--o{ DIRECT_NOTIFICATION : ""
  DIRECT_NOTIFICATION ||--o{ NOTIFICATION_DELIVERY : "e-mail / application"
```

## 1.3 Domaines et entités

### Structure & multi-sites
- **`site`** (TANA, TMV) et **`site_cycle`** : Tamatave n'ouvre que Collège + Lycée, Tana les quatre cycles.
- **`academic_year`**, **`period`** (trimestres), **`level`** (PS → Tle, avec l'examen officiel associé : 3e → DNB, Tle → Bac).
- **`school_class`** : rattachée à un site, un niveau et une filière (`GENERALE` / `STMG`, à partir de la 1re).

### Inscriptions et fiches élèves
- **`pre_registration`** : premier contact d'une famille (enfant, classe demandée, responsable, source), suivi par statut
  `DEMANDE → DOSSIER → ENTRETIEN → ACCEPTEE → INSCRITE` (ou `ATTENTE`, `REFUSEE`). Une demande n'est `INSCRITE` qu'avec sa
  fiche élève (`student_id`), contrainte vérifiée en T30.
- Chaque inscription ou réinscription crée ou met à jour la **fiche élève** (`student` : identité, nationalités, sexe,
  établissement d'origine, santé, contact d'urgence), ses **responsables** (`guardian`, `student_guardian` : lien, payeur,
  autorisé à récupérer l'élève) et l'**inscription** de l'année (`enrollment`). Les comptes de l'ENT (`app_user`) sont créés
  depuis la fiche : élève, et chaque responsable avec son adresse Google (ou un code d'activation remis au bureau).

- **Ancienneté** : nouvel élève ou ancien élève « depuis n ans », calculée à partir de la première inscription dans
  l'établissement (`min(enrollment.enrolled_on)` ; date d'entrée saisie à l'import pour l'historique antérieur à l'ENT).
  Elle détermine les frais d'inscription (nouvel élève) ou de réinscription (ancien élève).
- **Documents officiels**, sur les modèles de l'établissement : certificat de scolarité (demi-page A4, 1 ou 2 exemplaires)
  et bulletins trimestriels (matières et professeurs, compétences, moyennes élève et classe, appréciations, absences,
  appréciation générale). Les lignes d'un bulletin sont celles de l'élève : **spécialités** (`enrollment_specialty` :
  3 en Première générale, 2 en Terminale générale), la moyenne de classe d'une spécialité ne portant que sur ses élèves.
  Arts plastiques et Musique : collège uniquement.

### Comptes, rôles, SSO
- **`app_user`** : `google_sub` stocke l'identifiant OIDC Google. **`sso_allowlist`** : les comptes Gmail personnels ne
  permettent pas de filtrer par domaine, on n'autorise donc que les adresses invitées.
- **`user_role`** (+ `site_id` NULL = tous sites) et **`role_permission`** : les droits portent sur le **rôle**, jamais sur la
  personne. La Cheffe d'établissement et la Directrice adjointe ont toutes deux le rôle `DIRECTION` sans restriction de site :
  leurs droits sont identiques par construction (scénario T1). Seul le libellé (`title`) les distingue.

### Finances : comptabilité séparée
| Élément | Rôle |
|---|---|
| `fee_category` | `ECOLAGE` ou `DROITS_EXAMEN`, porté par chaque tarif, facture, paiement et écriture |
| `ledger_account` | plan de comptes où **chaque compte appartient à une seule catégorie** |
| `ledger_entry` / `ledger_line` | journal en partie double ; un trigger refuse toute ligne visant un compte d'une autre catégorie (T5), un trigger différé vérifie l'équilibre débit = crédit |
| `fee_schedule.retained_fee_mga` | part conservée par l'école sur les droits d'examen (**40 000 Ar**) |
| `exam_fee_remittance` | reversements aux centres d'examen (solde le compte `EXA-A-REVERSER`) |

Écriture générée par `record_exam_fee_payment` pour un droit de Bac de 600 000 Ar (T4) :

| Compte | Débit | Crédit |
|---|---:|---:|
| `EXA-CAISSE` (trésorerie droits d'examen) | 600 000 | |
| `EXA-FRAIS-DOS` (produit : frais de dossier) | | 40 000 |
| `EXA-A-REVERSER` (dette envers le centre) | | 560 000 |

Les 560 000 Ar ne sont **jamais** comptés en produit : c'est une dette, soldée lors du reversement.

### Échéancier & relances (paramétrables sans recoder, écran *Paramètres*)
Règles validées par la Direction pour **Tamatave** (Tana sera paramétré plus tard) :

| Paramètre | Valeur | Table |
|---|---|---|
| Échéance mensuelle | le **5** du mois | `dunning_policy.due_day` |
| Premier mois | **septembre** | `tuition_cutoff_rule.first_payable_month` |
| Relance automatique | **10** jours comptés après l'échéance | `relance_after` |
| Avertissement | **15** jours comptés après la relance | `warning_after` |
| Mise à pied | **10** jours comptés après l'avertissement, **validée par la Direction** | `suspension_after`, `suspension_requires_direction` |
| Dernier mois du plan (juin ; mai pour 1re/Tle) | **5 / 5 / 5** jours | `last_month_*_after` |
| Point de départ des délais | l'étape précédente (ou, au choix, l'échéance) | `count_from` |
| Jours comptés | lundi → vendredi, hors jours fériés, vacances et fermetures | `counted_weekdays`, `calendar_day_off` |
| Mois de relance | tous, sauf **octobre** (gelé : droits d'examen) | `dunning_month` |
| Plan de frais de scolarité | 6e → 2de : septembre → juin (10 mois) ; **1re et Tle : septembre → mai (9 mois)** | `tuition_cutoff_rule` |
| Canaux | e-mail + notification de l'application, WhatsApp en option (**pas de SMS**, faute de budget) | `channels` |

- **`calendar_day_off`** : jours fériés de Madagascar (tous sites) et vacances/fermetures (par site). L'écran *Paramètres*
  peut générer automatiquement les fériés, y compris les fêtes mobiles (Pâques, Ascension, Pentecôte).
- **`dunning_schedule()`** calcule les trois dates d'une échéance. Exemple pour l'échéance du **5 décembre 2026** : relance
  le 11/12, avertissement le 18/12, mise à pied le **22/01/2027** (les vacances de Noël ne comptent pas, T9). Une échéance de
  septembre traverse octobre gelé : mise à pied le 10/11 (T9).
- **`dunning_case`** / **`dunning_event`** : `RELANCE → AVERTISSEMENT → MISE_A_PIED`, chaque transition est historisée. La
  mise à pied attend la validation explicite d'un compte Direction (`v_dunning_awaiting_validation`, T11).
- Un trigger refuse toute facture de frais de scolarité hors du plan du niveau, par exemple juin pour une Terminale de Tamatave (T3).

### Catalogue tarifaire, états de compte et caisse
- **Trois journaux étanches** (`fee_category`) : `ECOLAGE`, `FRAIS_ANNEXES` (inscription, réinscription, fascicule,
  location des manuels, articles et services) et `DROITS_EXAMEN`.
- **`fee_item`** : catalogue (« Classes & tarifs » et « Articles & services »). Exemples : manuel perdu ou endommagé,
  Passeport de Vie Scolaire et son remplacement, séance ou forfait de natation, tee-shirt scolaire. **Aucun montant libre** : chaque article ou service a un prix fixé,
  modifiable par la Direction seule (permission `admin.settings`).
- **`fee_price`** : prix par année × site, **par classe** (grille) ou unique (`level_code` NULL). `fee_price_for()` choisit
  le prix de la classe s'il existe (T12).
- **`invoice_line`** : détail des factures (quantité × prix unitaire).
- **`v_account_statement`** : état de compte par inscription, séparé par journal. Un paiement n'éteint que les dettes de son
  journal.
- **`payment`** : trois modes seulement, **espèces, chèque, virement** (pas de mobile money). Hors espèces, le
  **n° de chèque** (6 à 10 chiffres) ou le **n° de bordereau / référence du virement** et la **banque** sont obligatoires.
  Un chèque a un statut (à déposer, déposé, encaissé, rejeté) et un `batch_id` relie les reçus émis pour un même chèque
  (un reçu par journal) (T15).
- **Pas de paiement partiel** : `payment_allocation` refuse tout montant différent du reste dû de la facture. Chaque
  échéance, article ou service est réglé en entier, avec un reçu (ticket) (T32).
- **Compte d'un élève arrivé en cours d'année** : la facturation des frais de scolarité commence au mois de son inscription. Un
  élève arrivé le 12 octobre ne paie pas septembre ; ses frais de scolarité d'octobre sont dus à sa date d'arrivée (T16).
- **`cash_movement`** : caisse du site, avec les **entrées** (encaissements, apports) et les **sorties** (dépenses,
  reversements aux centres d'examen, dépôts en banque). Chaque mouvement est attribué à l'agent qui le saisit. Une sortie ne
  peut pas dépasser le solde de son journal (T13).

### Notes, compétences et conseil de classe
- **`evaluation`** (création d'un devoir) : type, intitulé, **devoir du** (`held_on`), **note publiée le** (`publish_on`,
  par défaut le jour du devoir), barème (`scale_max`), coefficient, **« Ramener sur 20 »** (`normalize_to_20`, sinon la
  note compte en points), **remarques par note** activables (`remarks_enabled`, `grade.remark`), **commentaire** visible
  par les élèves, **thèmes**, **compétences évaluées** (`evaluation_competency`). Les parents voient la note
  `grading_policy.parent_publish_delay_days` jour(s) après les élèves (1 par défaut) : vue `v_published_grades` (T27).
- **`subject_average()`** : moyenne /20 pondérée, sans ABS, DISP ni NN (T17).
- **`validate_term()`** : au moins **4 évaluations** (`grading_policy.min_evaluations`) et toutes les cases remplies,
  puis les notes sont **verrouillées** (trigger `grade_lock`) (T17).
- **`competency`** : une **base proposée** par l'établissement, par matière et par niveau (`class_id` NULL), et les
  **compétences de l'enseignant** pour chaque classe. L'enseignant reprend la base en tout ou partie
  (`adopt_base_competencies()`, `based_on`) et écrit les siennes. Un devoir ne vise que les compétences de l'enseignant
  pour sa classe et sa matière (T20). Pas d'évaluation compétence par compétence : l'appréciation globale en tient lieu.
- **`subject.in_general_average`** : Arts plastiques, Musique et Vie de classe sont hors moyenne générale ;
  `general_average()` et la vue `v_council_grid` alimentent la grille du conseil (T18).
- **`report_card.general_comment`** : appréciation générale, **rédigée par la Directrice après le conseil** ; la base
  refuse tout autre auteur (T25).
- **`council_flag`** / **`council_note`** : avis des enseignants pour le conseil (élève exemplaire, bavard.e,
  avertissement travail / comportement…), jamais imprimés sur le bulletin. `report_card.council_mention` enregistre la
  décision (félicitations, compliments, encouragements, avertissements).
- **Rôles** : `DIRECTION` (administrateur), `BUREAU` (administration / économat, avec les droits de la vie scolaire),
  `VIE_SCOLAIRE`, `PROFESSEUR`, `PARENT`, `ELEVE`. Seuls la Direction et le Bureau ont `council.view` (T19).

### Vie scolaire et familles
- **`attendance_event.parent_ack_*`** et **`discipline_measure.parent_ack_*`** : case **« Je suis informé.e »** cochée par
  le parent ; la vue `v_pending_parent_ack` liste ce qui reste à confirmer.
- **`discipline_measure`** : **punitions** (enseignant, vie scolaire : observation, devoir supplémentaire, retenue,
  exclusion ponctuelle de cours) et **sanctions** (Direction uniquement : avertissement, blâme, mesure de
  responsabilisation, exclusion temporaire). Le **motif** est obligatoire (T22).
- **`phone_confiscation`** : 24 h ou 5 jours ouvrés ; **à la 2e confiscation de l'année, 5 jours ouvrés imposés**
  (trigger `phone_a_recidive`) ; un téléphone confisqué 5 jours n'est **rendu qu'à un responsable légal** (T24). On enregistre **qui a confisqué** (enseignant ou Direction),
  **qui l'a reçu et signé**, puis **qui l'a rendu, à qui, et quand**. La date de restitution est calculée sur les jours de
  classe (`add_school_days`, hors week-ends, fériés et vacances), par exemple le 7 janvier pour une confiscation le
  17 décembre (T21).
- **`authorization_type` / `authorization_answer`** : droit à l'image, autorisation de sortie, sorties pédagogiques ;
  une réponse par élève parmi les options prévues, avec la date de signature électronique (T23).
- **`published_document` / `document_receipt`** : documents envoyés aux familles avec accusé de lecture et signature
  éventuelle. **`requested_document`** : pièces demandées (dépôt par la famille, vérification par l'établissement).
- **`homework`** : cahier de textes (séance, travail à faire, date de remise postérieure à la séance) (T23).
- **`student.nationalities`** et **`higher_ed_steps()`** : en Terminale, **Parcoursup obligatoire pour tous** ; puis
  **Campus France** et **TLScontact** (visa) pour les élèves ni français ni d'un pays de l'UE / EEE / Suisse. Pas de
  fiche Avenir (candidats libres) (T28).
- **`internship_type` / `internship`** : stage d'observation de 3e (**1 semaine**) et stage de seconde (**2 semaines**),
  avec les trois signatures de la convention (T26). **`orientation_wish`** : intentions de la
  famille et avis du conseil, par trimestre.

### Gestion des agents
- **`staff_member`** : registre du personnel (enseignants, intervenants, surveillants, secrétariat, entretien, gardiennage)
  avec contrat, **date d'entrée** et **date de sortie** (et son motif).
- **`staff_access_active()`** : l'accès ENT (connexion Google) n'est valide qu'entre ces deux dates. Un agent sorti perd
  automatiquement son accès (T14).

### Temps & réservations
- **`school_day`** : 7h–17h, mercredi 7h–12h, par site. **`break_slot`** : récréation commune (`class_id` NULL, 9h30–9h45) et
  pauses déjeuner **par classe et par jour** (dynamiques).
- **`resource`** (TV, vidéoprojecteur, enceinte, salle spécialisée, informatique), rattachée à un site.
- **`booking`** : `period tstzrange` + contrainte
  `EXCLUDE USING gist (resource_id WITH =, period WITH &&) WHERE status = 'CONFIRMEE'`. La base rend tout chevauchement
  **impossible**, y compris en cas de requêtes concurrentes ; des créneaux contigus (10h–11h puis 11h–12h) restent acceptés (T7).

### Évaluations & bulletins
- **`evaluation`** + **`evaluation_competency`** (colonnes de la grille) + **`competency_result`** (niveau de maîtrise 1–4).
- **`grade.raw_input` / `autocorrected`** : la saisie brute (« 1O ») est conservée pour l'audit à côté de la valeur retenue.
- **`subject.grading_mode = APPRECIATION_SEULE`** + `opening_strand` (NUMERIQUE / ORIENTATION / ART) : le **Parcours
  d'ouverture**, sans note. `opening_session` trace les 1 à 2 séances mensuelles.
- **`report_comment.rule_check`** (jsonb) : résultat du contrôleur de rédaction. Une contrainte `CHECK` empêche le statut
  `VALIDE` tant qu'il reste des erreurs (T8). `report_card.decision_text` doit commencer par `Admis.e`, `Retenu.e` ou `Réorienté.e`.

### Examens & dossiers externes
- **`exam_session`** (DNB, Pré-Bac, Bac × centre × année, Académie de La Réunion), **`exam_registration`** (candidat libre,
  statut du dossier, facture de droits), **`exam_document`** (pièces justificatives par type).
- **`campus_france_campaign`** (fenêtre juillet → début septembre), **`campus_france_export`** / **`campus_france_entry`** :
  traçabilité de chaque fichier envoyé.

### Communication
- **`announcement_audience`** : chaque ligne est un filtre (rôle × site × niveau × classe, colonnes NULL = sans restriction).
  ET entre colonnes d'une ligne, OU entre lignes. Exemples : `(TOUS)` = toute l'école ; `(PROFESSEUR)` ;
  `(PARENT, TMV, TLE)` = parents de Terminale à Tamatave ; `(TOUS, classe=1re STMG A)`.
- **`direct_notification`** : notification individuelle d'un parent pour un motif (`RETARD`, `DISCIPLINE`,
  `DOCUMENT_MANQUANT`, `IMPAYE`…), avec un suivi d'envoi **par canal** (`notification_delivery`).

### Transverse
- **`audit_log`** : toute action sensible (transfert, modification de note, encaissement, validation de mise à pied).
- Montants en **Ariary entiers** (`bigint`), horodatages `timestamptz` (fuseau `Indian/Antananarivo`).

## 1.4 Décisions prises et points ouverts

**Décidé :** relances tous les mois sauf octobre, échéance le 5, premier mois septembre, délais 10 / 15 / 10 jours comptés depuis l'étape
précédente (5 / 5 / 5 le dernier mois) selon le calendrier scolaire, 9 mois de frais de scolarité pour les 1re et Tle de Tamatave, priorité au site de Tamatave, tous les réglages modifiables sans
recoder.

**À confirmer :**
1. « Jours ouvrables » : le prototype compte du lundi au vendredi (l'établissement est fermé le samedi). Le samedi peut être
   ajouté dans *Paramètres*.
2. Les délais se comptent depuis l'étape précédente (décidé) : relance 10 jours après l'échéance, avertissement 15 jours
   après la relance, mise à pied 10 jours après l'avertissement ; 5 / 5 / 5 le dernier mois.
3. Les vacances saisies sont des exemples : il faut le calendrier officiel de l'établissement.
4. Le transfert vers Tana n'est pas bloqué par un impayé ; les soldes sont listés pour suivi.
5. Inscription, réinscription, fascicule, location et articles sont regroupés dans un journal « Frais annexes » distinct des
   frais de scolarité : à valider avec la comptabilité.

### Fiche signalétique en ligne et signatures
- **`guardian_signature`** : signature de référence de chaque compte parent, déposée au doigt dans l'application. Une
  seule active par responsable ; un changement se fait au bureau après contrôle d'identité.
- **`student_record_form`** : fiche signalétique annuelle (élève, fratrie, responsables, santé, autorisations), remplie et
  signée en ligne ; l'acceptation du règlement et des dispositions financières est obligatoire. Le bureau la valide.
- **`student_record_signature`** : 1 ou 2 responsables signent, chacun depuis son compte et avec sa signature de
  référence ; un adulte qui n'est pas responsable de l'élève ne peut pas signer (T33).
- **Réservations** : `booking.timetable_slot_id` lie une réservation à une séance de l'emploi du temps (NULL : date et
  heure au choix).

### Contrôle de caisse, réductions, manuels et remise des bulletins
- **`payment_cancellation`** : un reçu n'est jamais supprimé. L'annulation est demandée avec un motif (10 caractères au
  moins), puis validée ou refusée par la Direction seule ; un refus doit être expliqué (T34).
- **`cash_closing`** : clôture quotidienne des espèces par site (comptage par billet). Un écart doit être expliqué ; après
  la clôture, aucun encaissement n'est accepté ce jour-là (T37).
- **`bank_deposit`** : versements des espèces sur le compte de l'école, bordereau obligatoire et unique (T37).
- **`reduction_type`**, **`enrollment_reduction`** : réductions fixées et accordées par la Direction seule, avec un
  motif. Deux taux : frais de scolarité et inscription / réinscription ; tout le reste à 100 %. Redoublant en Terminale :
  −25 % et −50 % ; famille et proches de l'établissement : frais de scolarité offerts. Pas de fratrie. Une réduction
  dont les taux ne sont pas définis ne peut pas être accordée (T35).
- **`deposit_schedule`** et **`v_deposit_missed`** : jours de versement (mercredi après-midi, vendredi après les cours),
  rappel au bureau et alerte à la Direction si un versement prévu manque (T37).
- **`textbook`**, **`textbook_stock`**, **`textbook_loan`** : manuels et cahiers d'activités (original ou photocopie,
  dos carré ou reliure). À rendre : location (25 000 Ar par manuel de base) et prix propre en cas de perte ; gardés par
  l'élève : prix de vente. Lot identique pour la classe, manuels de spécialité aux seuls élèves concernés. Stock par
  état, prêts avec état à la sortie et au retour, pertes à régler (T36). La location et les cahiers sont facturés avec
  les frais annuels.
- **`bulletin_handover`** et **`v_bulletin_blocked`** : les bulletins sont remis en main propre, jamais publiés. Frais
  échus impayés ou manuel dû bloquent la remise ; seule la Direction lève le blocage, avec un motif (T36).

### Salaires, engagements et bibliothèque
- **`payroll_month`**, **`payroll_line`** : état de paie mensuel, validé par la Direction seule ; payé par le Bureau.
  Professeurs automatiquement vacataires : payés à l'heure de cours effectuée face aux élèves, rien pendant les
  vacances (heures × taux en vigueur au mois payé, heures prévues à l'emploi du temps en regard) ; autres salariés au
  mois. Espèces par défaut (le plus courant). **`hourly_rate`** : taux horaires avec date d'effet (historique des
  augmentations), `rate_on()` donne le taux d'un mois (T38).
  En espèces, émargement obligatoire du salarié et sortie de caisse « Salaires » ; par virement, référence obligatoire
  (T38). Pendant la « semaine des salaires » (dernière semaine de cours du mois, jusqu'au paiement), pas de rappel de
  versement en banque.
- **`student_engagement`** : engagements imprimés sur le bulletin (délégué, suppléant, éco-délégué, membre ou président(e) du Bureau des élèves (BDE), tuteur,
  équipe sportive, PSC1) et attestations internes de l'établissement (sécurité routière niveaux 1 et 2 sur le modèle
  ASSR, compétences numériques sur le modèle Pix / B2i). Les élèves étant candidats libres, sans livret scolaire, le
  bulletin est le seul document qui les montre. Au plus 2 délégués et 2 suppléants par classe (T39).
- **`feedback`** : avis du pilote envoyés depuis « Donner mon avis » (écran, profil, problème / idée / question), suivis
  par la Direction (T41).
- **`library_book`**, **`library_copy`**, **`library_loan`** : bibliothèque de la salle d'étude (pas de CDI). Désignation titre — auteur — éditeur (collection,
  année), ISBN ; une cote par exemplaire (ROM-0012…). Élèves : un mois, prolongé d'un mois si le livre est présenté ;
  professeurs : sans date limite. Un livre en retard bloque la remise du bulletin (T40).


### Familles en autonomie et documents signés

- **`student.photo_key`** : photo d'identité.
- **`guardian_access_code`** : code personnel de première connexion, un par responsable (chiffré, un seul actif).
  `guardian.user_id` est unique : deux parents ne partagent jamais un accès. `app_user` exige un e-mail **ou** un
  téléphone (parent sans e-mail).
- **`pre_registration.channel`** : `BUREAU` ou `EN_LIGNE` (formulaire public).
- **`family_request`** (`REINSCRIPTION`, `MISE_A_JOUR`, `PIECE`) et **`family_document`** : déposées par un
  responsable de l'élève uniquement ; traitées par le Bureau ou la Direction ; refus avec motif obligatoire.
- **`official_signature`**, **`school_stamp`**, **`signature_request`** : demande par le Bureau, la Vie scolaire ou
  la Direction ; signature par la Direction seule, avec sa propre signature ; code de vérification attribué à la
  signature ; impression ou envoi par e-mail seulement après signature.
- Vue **`v_bulletin_blocked`** : le motif des livres de la salle d'étude s'appelle désormais `LIVRE`.

### Retours du 17 octobre

- **`enrollment.matricule`** (unique par année, format `TG-001`) ; **`student.other_nationality`**,
  **`student.usual_first_name`**.
- **`phone_confiscation`** : `action` (`AVERTISSEMENT` sans durée ni garde, ou `CONFISCATION`), durée `24H` / `48H` /
  `5J` (récidive : au moins 48 h au 2e fait, 5 jours ensuite), `owner_enrollment_id` (propriétaire).
  `AVERTISSEMENT` devient une punition (professeur, CPE, secrétariat).
- **`report_card`** : appréciation générale écrite par la Direction ou le secrétariat, `general_comment_status`
  validé par la Direction seule ; un texte modifié repasse « à valider ».
- **`bulletin_release`** (disponibilité et délai de retrait), **`orientation_track`** (pistes par pays, clôture avec
  motif), **`school_event`** et **`calendar_feed`** (agendas et liens d'abonnement), **`pre_registration_campaign`**.
- **Salaires** : plus de validation préalable ; seuls le secrétariat et la Direction paient
  (`payroll_month.validated_by` = « vu par la Direction », facultatif).
- **Trésorerie** : **`expense_category`** (liste modifiable), **`supplier`**, **`expense`** (Ariary entiers, photo
  obligatoire au-delà de 100 000 Ar, échéance obligatoire si à payer), vue **`v_treasury`** par site (trésorerie
  nette, reste à recouvrer, dépenses engagées). Le grand livre en partie double reste la référence comptable.
- Scénarios **T44** (trésorerie) et **T45** (ajustements).
- **`library_reservation`** : réservation d'un livre par un élève ou un professeur (une seule active par personne
  et par livre, au plus 30 jours à l'avance, `A_RETIRER` avec date limite de retrait, `REMISE` liée au prêt).
  Scénario **T46**.
- **`teacher_absence`** (séance de l'emploi du temps à une date, motif, travail laissé `DEVOIR` / `ACTIVITE` /
  `AUCUN`, consignes ou document obligatoires sauf `AUCUN`), fonction **`teacher_hours`** (heures prévues,
  d'absence, faites sur une période, jours de classe seulement), **`internal_resource`** (professeurs ou tout le
  personnel, partagée par la Direction, le secrétariat ou la CPE) et **`internal_resource_view`** (chaque
  consultation tracée). Scénario **T47**.
- **`teacher_absence`** : `NON_REQUIS` (dispense de travail accordée par la Direction, `granted_by`)
  (pas d'annonce aux familles) ; **`teacher_lateness`** et **`teacher_makeup`**, vue **`v_teacher_lateness`** (heures à
  rattraper par tranche de 60 minutes) ; **`internal_resource.url`** (lien) ; **`board_game`** et
  **`board_game_use`** (sorties, retour complet ou incident décrit, un exemplaire à la fois). Scénario **T48**.
- **`internal_resource.audiences`** (élèves, parents, professeurs, personnel), fonction **`resources_for`** ;
  **`staff_suggestion`** (boîte à idées, anonyme possible, réponse de la Direction seule). Scénario **T49**.
- **`timetable_change`** (`ANNULE` / `DEPLACE` / `AJOUT` / `DEFINITIF`, classe, séance ou matière ajoutée,
  date, nouvel horaire, décidé par la Direction ou le secrétariat, annoncé à la classe) ; **`early_departure`**
  (sortie anticipée : motif, appel aux parents obligatoire, mineur calculé depuis la date de naissance ; un mineur
  part avec un adulte nommé, responsable légal ou confirmé par lui). Scénario **T50**.
- **`care_visit`** (passage au secrétariat : motif, Doliprane et dose, suite, parents prévenus ; Doliprane
  donné par le secrétariat seul, refusé si allergie au paracétamol dans `student.health_notes` ou dose de moins
  de 6 heures, retiré du stock), vue **`v_frequent_care_visits`** (3 passages ou plus dans le mois) ;
  **`inventory_item`** (mobilier, équipement, trousse de secours ; quantité, cassés, seuil, péremption) et
  **`inventory_movement`** (casse décrite, réparation, rebut, achat avec facture, utilisation), quantités mises à
  jour par déclencheur. Scénario **T51**.
