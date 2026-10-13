# 4. Cadrage par profil — Tamatave d'abord

Avant de développer, on valide **un profil à la fois** avec les personnes concernées, en s'appuyant sur le prototype
(sélecteur « Voir l'ENT en tant que »). Chaque atelier dure environ une heure. Il suit le même déroulé :

1. **Parcourir** les écrans du profil dans le prototype.
2. **Répondre** aux questions ci-dessous : chaque réponse devient une règle ou un paramètre.
3. **Lister** ce qui manque et ce qui est inutile.
4. **Valider** la fiche. Le développement de ce profil ne commence qu'ensuite.

Ordre conseillé : Direction → Administration/Comptabilité → Enseignants → Vie scolaire → Parents → Élèves. Les choix de
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

## B. Administration & Comptabilité (secrétaire-comptable, caisse)
**Écrans à parcourir :** Comptabilité (Classes & tarifs, Articles & services, États de compte, Caisse).

| # | Question | Réponse provisoire |
|---|---|---|
| B1 | Grille réelle 2026-2027 : inscription, réinscription, écolage, fascicule, location, par classe et par filière | montants fictifs |
| B2 | Inscription, réinscription, fascicule, location, articles : journal « Frais annexes » séparé de l'écolage ? | oui |
| B3 | Liste définitive des articles et services (manuels, passeport de vie scolaire, natation, tee-shirt, autres) et leurs prix | à compléter |
| B4 | Remises : fratrie, enfant du personnel, bourse ? Comment les afficher sur l'état de compte ? | non traité |
| B5 | Modes de paiement acceptés et format du reçu (numérotation, mentions obligatoires) | espèces, mobile money, virement, chèque |
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
| E3 | Paiement en ligne par mobile money dès le départ, ou seulement l'affichage du solde ? | affichage + reçu |
| E4 | Langue : français uniquement, ou aussi malgache pour les notifications ? | français |
| E5 | Plusieurs responsables par enfant (parents séparés) : qui reçoit les relances ? | le payeur désigné |

---

**Livrable de chaque atelier :** la fiche ci-dessus remplie. Les réponses sont reportées dans les paramètres (sans code) ou
dans le cahier des charges du lot de développement correspondant.
