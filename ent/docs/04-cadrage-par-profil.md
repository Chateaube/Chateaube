# 4. Cadrage par profil — Tamatave d'abord

Avant de développer, on valide **un profil à la fois** avec les personnes concernées, en s'appuyant sur le prototype
(sélecteur « Voir l'ENT en tant que »). Chaque atelier dure environ une heure. Il suit le même déroulé :

1. **Parcourir** les écrans du profil dans le prototype.
2. **Répondre** aux questions ci-dessous : chaque réponse devient une règle ou un paramètre.
3. **Lister** ce qui manque et ce qui est inutile.
4. **Valider** la fiche. Le développement de ce profil ne commence qu'ensuite.

Ordre conseillé : Direction → Bureau (administration / économat) → Enseignants → Vie scolaire → Parents → Élèves. Les choix de
Direction et de Comptabilité conditionnent les autres profils (tarifs, relances, droits).

---

## A. Direction (Cheffe d'établissement, Directrice adjointe)
**Écrans à parcourir :** Tableau de bord, Paramètres, Gestion des agents, Comptabilité (lecture).

| # | Question | Réponse provisoire |
|---|---|---|
| A1 | Quels indicateurs voir chaque matin ? (effectifs, recouvrement, absences, dossiers d'examen…) | prototype actuel |
| A2 | La mise à pied est-elle toujours validée par la Direction, ou automatique après J+25 ? | validation Direction |
| A3 | Qui peut accorder un délai de paiement, et pour combien de temps ? | Direction seule |
| A4 | Les deux comptes Direction reçoivent-ils les mêmes alertes, ou faut-il répartir les rôles (finances / pédagogie) ? | mêmes alertes |
| A5 | Le calendrier officiel des vacances de Tamatave 2026-2027 | à fournir |
| A6 | Faut-il un journal des actions (qui a validé quoi, et quand) consultable à l'écran ? | oui |

## B. Bureau : administration / économat (caisse, inscriptions)
**Écrans à parcourir :** Comptabilité (Classes & tarifs, Articles & services, États de compte, Caisse).

| # | Question | Réponse provisoire |
|---|---|---|
| B1 | Grille réelle 2026-2027 : inscription, réinscription, écolage, fascicule, location, par classe et par filière | montants fictifs |
| B2 | Inscription, réinscription, fascicule, location, articles : journal « Frais annexes » séparé de l'écolage ? | oui |
| B3 | Liste définitive des articles et services (manuels, passeport de vie scolaire, natation, tee-shirt, autres) et leurs prix | à compléter |
| B4 | Remises : fratrie, enfant du personnel, bourse ? Comment les afficher sur l'état de compte ? | non traité |
| B5 | Modes de paiement acceptés et format du reçu (numérotation, mentions obligatoires) | **décidé** : espèces, chèque (n° + banque), virement (n° de bordereau + banque) ; pas de mobile money |
| B6 | Dépenses de caisse : quelles catégories ? quel plafond sans accord de la Direction ? | non traité |
| B7 | Reversement des droits d'examen : à quelle date, par quel moyen, et avec quelle pièce justificative ? | non traité |
| B8 | Exports nécessaires (Excel, logiciel comptable, banque) | non traité |

## C. Enseignants
**Écrans à parcourir :** portail Enseignant (tableau de bord, appel), Notes & appréciations, Réservations.

| # | Question | Réponse provisoire |
|---|---|---|
| C1 | L'appel se fait-il à chaque heure ou par demi-journée ? Qui prévient les parents : l'enseignant ou la vie scolaire ? | à chaque cours, SMS proposé |
| C2 | Barèmes utilisés (/20, /10, compétences 1-4) et coefficients par matière | /20 + 4 niveaux |
| C3 | Calendrier de saisie des notes et des appréciations avant chaque conseil de classe | non traité |
| C4 | Règles de rédaction des appréciations : liste complète des formules interdites | prototype actuel |
| C5 | Un enseignant peut-il écrire directement à un parent, ou seulement via la vie scolaire ? | non traité |
| C6 | Cahier de textes et devoirs : à inclure dès le premier lot ? | non traité |

## D. Vie scolaire
| # | Question | Réponse provisoire |
|---|---|---|
| D1 | Motifs d'absence et de retard, et pièces justificatives acceptées | non traité |
| D2 | Échelle des sanctions et circuit de validation | non traité |
| D3 | Suivi des dossiers candidats libres (pièces, échéances d'octobre) : qui, et sous quelle forme ? | prototype Direction |

## E. Parents
**Écrans à parcourir :** portail Parents (format mobile).

| # | Question | Réponse provisoire |
|---|---|---|
| E1 | Les parents ont-ils un smartphone et une adresse e-mail ? (sinon, SMS uniquement) | SMS par défaut |
| E2 | Que voir : notes au fil de l'eau, ou seulement les bulletins ? | notes + bulletins |
| E3 | Que voit le parent de ses paiements ? | **décidé** : solde, historique et reçus ; pas de paiement en ligne |
| E4 | Langue : français uniquement, ou aussi malgache pour les notifications ? | français |
| E5 | Plusieurs responsables par enfant (parents séparés) : qui reçoit les relances ? | le payeur désigné |

---

**Livrable de chaque atelier :** la fiche ci-dessus remplie. Les réponses sont reportées dans les paramètres (sans code) ou
dans le cahier des charges du lot de développement correspondant.

---

## Décisions du 13 octobre et nouvelles questions

**Décidé :**
- Encaissement : sélectionner l'élève, puis cocher les mois et frais à régler (les échéances échues sont proposées, les
  mois payés sont grisés).
- Le compte d'un nouvel élève commence au mois de son arrivée.
- Notes : type, barème et coefficient choisis par l'enseignant ; au moins 4 notes par trimestre pour valider.
- Compétences définies par classe et matière, avec une copie proposée entre classes du même niveau.
- Grille du conseil réservée à la Direction et au Bureau ; moyenne générale hors Arts plastiques, Musique et Vie de classe.
- Avis des enseignants pour le conseil, non imprimés sur le bulletin.
- Portails séparés : Direction (administrateur), Bureau (avec accès à la vie scolaire), Vie scolaire, Enseignant, Parent.
- Une seule plateforme pour Tana et Tamatave, données cloisonnées par site (voir `03-architecture-technique.md` §3.2).

| # | Question | Proposition |
|---|---|---|
| N1 | Chèque rejeté par la banque : que se passe-t-il (frais, relance immédiate, interdiction du chèque) ? | relance immédiate + paiement suivant en espèces ou virement |
| N2 | Paiement partiel d'un mois (ex. la moitié d'octobre) : autorisé ? | autorisé, le reste reste « échu » |
| N3 | Nouvel élève arrivé après le 15 : mois d'arrivée complet ou au prorata ? | mois complet |
| N4 | Nouvel élève en cours d'année : fascicule et location des manuels au plein tarif ? | plein tarif |
| N5 | Annulation d'un reçu : qui peut le faire ? | Direction uniquement, avec motif (contre-passation, jamais de suppression) |
| N6 | Clôture de caisse chaque soir (contrôle des espèces) et bordereau de remise des chèques en banque ? | oui |
| N7 | Minimum de 4 notes : aussi pour les matières à faible horaire (EPS, Arts, Musique) ? | oui, réglable par matière si besoin |
| N8 | Élève absent à plusieurs évaluations : devoir de rattrapage, ou signalement seulement ? | signalement au conseil (actuel) |
| N9 | Coefficients des matières dans la moyenne générale : tous à 1, ou selon la filière (spécialités STMG) ? | tous à 1 |
| N10 | Mentions du conseil : félicitations ≥ 16, compliments ≥ 14, encouragements selon l'avis des enseignants ? | oui (réglable) |
| N11 | Afficher le rang des élèves dans la grille ? sur le bulletin ? | grille seulement, désactivé par défaut |
| N12 | Collège : faut-il le socle commun officiel (8 composantes, 4 niveaux) en plus des compétences libres, pour le DNB ? | oui en 3e |
| N13 | Le professeur principal peut-il voir la grille de **sa** classe pour rédiger l'appréciation générale ? | lecture seule de sa classe |
| N14 | Qui rédige l'appréciation générale du bulletin : professeur principal ou Direction ? | professeur principal, validée par la Direction |
| N15 | Les parents voient-ils les notes au fil de l'eau, ou seulement après validation du trimestre ? | au fil de l'eau |
| N16 | Le Bureau gère-t-il aussi le registre des agents (contrats, entrées / sorties) ? | Direction seule pour l'instant |
| N17 | Combien de personnes au Bureau, et faut-il distinguer la caisse de l'économat (droits différents) ? | à préciser |

---

## Décisions du 13 octobre (2) et nouvelles questions

**Décidé :**
- Ordre de travail de l'enseignant : compétences, puis notes, puis appréciations. Pas d'évaluation compétence par
  compétence pour chaque élève.
- Élèves choisis dans une liste déroulante. Pour les incidents, on choisit d'abord la classe, qui filtre la liste des
  élèves.
- Punitions et sanctions toujours motivées, avec le nom de leur auteur ; le parent coche « Je suis informé.e ».
- Téléphones : confiscation de 24 h ou 5 jours ouvrés. On enregistre qui a confisqué, qui l'a reçu et signé, qui l'a
  rendu et à qui.
- Documents : droit à l'image, autorisation de sortie, documents reçus, pièces demandées, cahier de textes, stages,
  orientation.
- Parents : notes au fil du trimestre par matière (note, moyenne, plus haute, plus basse, coefficient), sans bulletin.
  Les élèves voient presque la même chose.
- Grille du conseil exportable (Excel) et imprimable, avec l'appréciation générale de chaque élève.

| # | Question | Proposition |
|---|---|---|
| P1 | Parents : afficher aussi la **moyenne provisoire** de chaque matière, ou seulement les notes ? | notes seulement (choix actuel) |
| P2 | Les notes sont-elles visibles par les parents dès la saisie, ou après un délai (ex. 48 h, le temps de rendre les copies) ? | après remise des copies (délai réglable) |
| P3 | Téléphone : qui peut le récupérer (élève lui-même, ou seulement un parent pour 5 jours) ? | parent obligatoire pour 5 jours |
| P4 | Récidive téléphone : passe-t-on automatiquement de 24 h à 5 jours ouvrés ? | proposition automatique à la 2e confiscation |
| P5 | Retenue : quels créneaux (mercredi après-midi ?) et qui surveille ? | mercredi 13h–15h, vie scolaire |
| P6 | « Je suis informé.e » : relance du parent s'il ne coche pas sous 48 h ? | oui, par SMS |
| P7 | Autorisations : faut-il les renouveler chaque année, et bloquer une sortie si la réponse manque ? | renouvellement annuel ; alerte à l'organisateur |
| P8 | Stages : quels niveaux (3e observation, 2de, 1re STMG) et quelles durées ? | 3e : 5 jours ; 1re STMG : 1 semaine |
| P9 | Orientation : les familles saisissent-elles leurs intentions dans l'ENT (fiche dialogue) ? | oui, au 2e trimestre |
| P10 | Appréciation générale du conseil : rédigée en séance par la Direction, ou préparée par le professeur principal ? | préparée par le PP, finalisée en séance |
