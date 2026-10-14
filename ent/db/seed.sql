-- =============================================================================
--  ENT Chateaubriand — Données de référence (à charger après functions.sql)
-- =============================================================================

INSERT INTO site (code, name) VALUES ('TANA', 'Tananarive'), ('TMV', 'Tamatave');

INSERT INTO site_cycle
SELECT s.id, c::cycle_code FROM site s,
  unnest(CASE s.code WHEN 'TANA' THEN ARRAY['PRESCOLAIRE','PRIMAIRE','COLLEGE','LYCEE']
                     ELSE ARRAY['COLLEGE','LYCEE'] END) AS c;

INSERT INTO level (code, cycle, rank, label, official_exam) VALUES
  ('PS',   'PRESCOLAIRE',  1, 'Petite section',   NULL),
  ('MS',   'PRESCOLAIRE',  2, 'Moyenne section',  NULL),
  ('GS',   'PRESCOLAIRE',  3, 'Grande section',   NULL),
  ('CP',   'PRIMAIRE',     4, 'CP',               NULL),
  ('CE1',  'PRIMAIRE',     5, 'CE1',              NULL),
  ('CE2',  'PRIMAIRE',     6, 'CE2',              NULL),
  ('CM1',  'PRIMAIRE',     7, 'CM1',              NULL),
  ('CM2',  'PRIMAIRE',     8, 'CM2',              NULL),
  ('6E',   'COLLEGE',      9, '6e',               NULL),
  ('5E',   'COLLEGE',     10, '5e',               NULL),
  ('4E',   'COLLEGE',     11, '4e',               NULL),
  ('3E',   'COLLEGE',     12, '3e',               'DNB'),
  ('2NDE', 'LYCEE',       13, '2de',              NULL),
  ('1RE',  'LYCEE',       14, '1re',              'PRE_BAC'),
  ('TLE',  'LYCEE',       15, 'Terminale',        'BAC');

INSERT INTO academic_year (label, starts_on, ends_on, is_current)
VALUES ('2026-2027', '2026-09-01', '2027-07-04', true);

INSERT INTO period (year_id, rank, starts_on, ends_on)
SELECT id, r, s::date, e::date FROM academic_year,
  (VALUES (1, '2026-09-01', '2026-12-18'), (2, '2027-01-04', '2027-03-26'), (3, '2027-03-29', '2027-07-04')) v(r, s, e);

-- Mois de relance : tous actifs sauf octobre (mois gelé : droits d'examen)
INSERT INTO dunning_month (year_id, month, is_active, skip_reason)
SELECT y.id, m, m <> 10, CASE WHEN m = 10 THEN 'Encaissement des droits d''examen' END
FROM academic_year y, generate_series(1, 12) m;

-- Politique de recouvrement — Tamatave (Tana : à paramétrer ultérieurement)
-- Échéance le 5 ; relance 10 jours après l'échéance, avertissement 15 jours après la relance,
-- mise à pied 10 jours après l'avertissement ; dernier mois du plan : 5 / 5 / 5 (jours comptés du
-- lundi au vendredi, hors fériés et vacances) ; mise à pied validée par la Direction.
INSERT INTO dunning_policy (year_id, site_id)
SELECT y.id, s.id FROM academic_year y, site s WHERE s.code = 'TMV';

-- Plan de frais de scolarité Tamatave : 6e → 2de sept.→juin (10 mois) ; 1re et Tle sept.→mai (9 mois)
INSERT INTO tuition_cutoff_rule (year_id, site_id, level_code, first_payable_month, last_payable_month)
SELECT y.id, s.id, l.code, 9, CASE WHEN l.code IN ('1RE', 'TLE') THEN 5 ELSE 6 END
FROM academic_year y, site s, level l
WHERE s.code = 'TMV' AND l.cycle IN ('COLLEGE', 'LYCEE');

-- Jours fériés de Madagascar 2026-2027 (tous sites) — liste à vérifier chaque année
INSERT INTO calendar_day_off (year_id, site_id, kind, label, days)
SELECT y.id, NULL, 'FERIE', v.label, daterange(v.d::date, v.d::date, '[]')
FROM academic_year y, (VALUES
  ('2026-11-01', 'Toussaint'),
  ('2026-12-25', 'Noël'),
  ('2027-01-01', 'Jour de l''an'),
  ('2027-03-08', 'Journée internationale des droits des femmes'),
  ('2027-03-29', 'Commémoration des martyrs de 1947 / Lundi de Pâques'),
  ('2027-05-01', 'Fête du Travail'),
  ('2027-05-06', 'Ascension'),
  ('2027-05-17', 'Lundi de Pentecôte'),
  ('2027-06-26', 'Fête de l''Indépendance'),
  ('2027-08-15', 'Assomption')) v(d, label);

-- Vacances scolaires Tamatave — EXEMPLE, à remplacer par le calendrier officiel de l'établissement
INSERT INTO calendar_day_off (year_id, site_id, kind, label, days)
SELECT y.id, s.id, 'VACANCES', v.label, daterange(v.a::date, v.b::date, '[]')
FROM academic_year y, site s, (VALUES
  ('2026-10-24', '2026-11-01', 'Vacances de la Toussaint (exemple)'),
  ('2026-12-19', '2027-01-03', 'Vacances de Noël (exemple)'),
  ('2027-02-13', '2027-02-21', 'Vacances de février (exemple)'),
  ('2027-04-10', '2027-04-25', 'Vacances de printemps (exemple)')) v(a, b, label)
WHERE s.code = 'TMV';

-- Plan de comptes : deux catégories étanches
INSERT INTO ledger_account (code, category, label, nature) VALUES
  ('ECO-CAISSE',     'ECOLAGE',       'Trésorerie frais de scolarité',              'ACTIF'),
  ('ECO-CLIENTS',    'ECOLAGE',       'Familles — frais de scolarité à recevoir',   'ACTIF'),
  ('ECO-PRODUIT',    'ECOLAGE',       'Produit frais de scolarité',                 'PRODUIT'),
  ('EXA-CAISSE',     'DROITS_EXAMEN', 'Trésorerie droits d''examen',      'ACTIF'),
  ('EXA-A-REVERSER', 'DROITS_EXAMEN', 'Droits dus aux centres d''examen', 'PASSIF'),
  ('EXA-FRAIS-DOS',  'DROITS_EXAMEN', 'Frais de dossier conservés',      'PRODUIT'),
  ('ANX-CAISSE',     'FRAIS_ANNEXES', 'Trésorerie frais annexes',        'ACTIF'),
  ('ANX-CLIENTS',    'FRAIS_ANNEXES', 'Familles — frais annexes',        'ACTIF'),
  ('ANX-PRODUIT',    'FRAIS_ANNEXES', 'Produit frais annexes',           'PRODUIT');

-- Catalogue tarifaire (« Classes & tarifs » et « Articles & services »)
INSERT INTO fee_item (code, kind, category, rubric, label, unit, priced_by_level, free_amount) VALUES
  ('INSCRIPTION',     'INSCRIPTION',   'FRAIS_ANNEXES', 'Classes & tarifs',          'Inscription',                  'une fois',      true,  false),
  ('REINSCRIPTION',   'REINSCRIPTION', 'FRAIS_ANNEXES', 'Classes & tarifs',          'Réinscription',                'par an',        true,  false),
  ('ECOLAGE',         'ECOLAGE',       'ECOLAGE',       'Classes & tarifs',          'Frais de scolarité mensuel',              'par mois',      true,  false),
  ('FASCICULE',       'FASCICULE',     'FRAIS_ANNEXES', 'Classes & tarifs',          'Fascicule',                    'par an',        true,  false),
  ('LOCATION',        'LOCATION',      'FRAIS_ANNEXES', 'Classes & tarifs',          'Location des manuels',         'par an',        true,  false),
  ('MANUEL_PERTE',    'ARTICLE',       'FRAIS_ANNEXES', 'Manuel scolaire',           'Manuel perdu ou endommagé',    'par manuel',    false, false),
  ('MANUEL_AUTRE',    'ARTICLE',       'FRAIS_ANNEXES', 'Manuel scolaire',           'Autre (manuel complémentaire)','par manuel',    false, false),
  ('PASSEPORT',       'ARTICLE',       'FRAIS_ANNEXES', 'Passeport de Vie Scolaire', 'Passeport de Vie Scolaire',    'par élève',     false, false),
  ('PASSEPORT_PERTE', 'ARTICLE',       'FRAIS_ANNEXES', 'Passeport de Vie Scolaire', 'Passeport perdu ou endommagé', 'remplacement',  false, false),
  ('NATATION_SEANCE', 'SERVICE',       'FRAIS_ANNEXES', 'Séances de natation',       'Séance de natation',           'par séance',    false, false),
  ('NATATION_FORFAIT','SERVICE',       'FRAIS_ANNEXES', 'Séances de natation',       'Forfait natation trimestriel', 'par trimestre', false, false),
  ('TEE_SHIRT',       'ARTICLE',       'FRAIS_ANNEXES', 'Tee-shirt scolaire',        'Tee-shirt scolaire',           'par unité',     false, false),
  ('AUTRE',           'ARTICLE',       'FRAIS_ANNEXES', 'Autre',                     'Autre (montant libre)',        'montant saisi', false, true);

-- Prix Tamatave 2026-2027 (montants FICTIFS, à remplacer) — articles à prix unique
INSERT INTO fee_price (year_id, site_id, item_id, amount_mga)
SELECT y.id, s.id, i.id, v.amount
FROM academic_year y, site s, fee_item i, (VALUES
  ('MANUEL_PERTE', 45000), ('MANUEL_AUTRE', 35000), ('PASSEPORT', 15000), ('PASSEPORT_PERTE', 20000),
  ('NATATION_SEANCE', 15000), ('NATATION_FORFAIT', 120000), ('TEE_SHIRT', 35000)) v(code, amount)
WHERE s.code = 'TMV' AND i.code = v.code;

-- Grille par classe (extrait : 6e et Terminale)
INSERT INTO fee_price (year_id, site_id, item_id, level_code, amount_mga)
SELECT y.id, s.id, i.id, v.lvl, v.amount
FROM academic_year y, site s, fee_item i, (VALUES
  ('6E', 'INSCRIPTION', 250000), ('6E', 'REINSCRIPTION', 150000), ('6E', 'ECOLAGE', 330000), ('6E', 'FASCICULE', 60000), ('6E', 'LOCATION', 80000),
  ('TLE', 'INSCRIPTION', 300000), ('TLE', 'REINSCRIPTION', 180000), ('TLE', 'ECOLAGE', 450000), ('TLE', 'FASCICULE', 90000), ('TLE', 'LOCATION', 120000)
) v(lvl, code, amount)
WHERE s.code = 'TMV' AND i.code = v.code;

-- Horaires : 7h-17h, mercredi 7h-12h ; récréation commune 9h30-9h45
INSERT INTO school_day (site_id, weekday, opens_at, closes_at)
SELECT s.id, d, '07:00', CASE WHEN d = 3 THEN '12:00'::time ELSE '17:00'::time END
FROM site s, generate_series(1, 5) d;

INSERT INTO break_slot (site_id, class_id, weekday, kind, starts_at, ends_at)
SELECT id, NULL, NULL, 'RECREATION', '09:30', '09:45' FROM site;

INSERT INTO exam_center (name, city) VALUES
  ('Lycée Français de Tamatave', 'Toamasina'),
  ('Lycée Français de Tananarive', 'Antananarivo');

-- Parcours d'ouverture : 3 volets évalués uniquement par appréciation
INSERT INTO subject (code, label, grading_mode, opening_strand) VALUES
  ('PARCOURS-NUM', 'Parcours d''ouverture — Numérique',   'APPRECIATION_SEULE', 'NUMERIQUE'),
  ('PARCOURS-ORI', 'Parcours d''ouverture — Orientation', 'APPRECIATION_SEULE', 'ORIENTATION'),
  ('PARCOURS-ART', 'Parcours d''ouverture — Art',         'APPRECIATION_SEULE', 'ART');

INSERT INTO subject (code, label, in_general_average) VALUES
  ('ARTS-PLA', 'Arts plastiques', false), ('MUSIQUE', 'Musique', false), ('VIE-CLASSE', 'Vie de classe', false);

INSERT INTO subject (code, label) VALUES
  ('FRANCAIS', 'Français'), ('MATHS', 'Mathématiques'), ('HG', 'Histoire-Géographie'),
  ('ANGLAIS', 'Anglais'), ('SVT', 'SVT'), ('PC', 'Physique-Chimie'),
  ('MANAGEMENT', 'Management'), ('SGN', 'Sciences de gestion et numérique'), ('PHILO', 'Philosophie');

INSERT INTO exam_document_type (code, label, required_for) VALUES
  ('PIECE_IDENTITE', 'Pièce d''identité / passeport', '{DNB,BAC,PRE_BAC}'),
  ('PHOTO',          'Photo d''identité',              '{DNB,BAC,PRE_BAC}'),
  ('ACTE_NAISSANCE', 'Acte de naissance',             '{DNB,BAC,PRE_BAC}'),
  ('JDC',            'Attestation JDC / recensement (si nationalité française)', '{BAC,PRE_BAC}'),
  ('FICHE_INSCRIPTION', 'Fiche d''inscription signée (Académie de La Réunion)', '{DNB,BAC,PRE_BAC}');

-- Permissions — le rôle DIRECTION reçoit TOUT : les deux comptes Direction sont identiques.
INSERT INTO permission (code, description) VALUES
  ('admin.users',        'Gérer les comptes, rôles et la liste blanche SSO'),
  ('admin.settings',     'Paramétrer années, calendriers, grilles tarifaires'),
  ('sites.transfer',     'Exécuter une campagne de transfert inter-sites'),
  ('finance.read',       'Consulter la comptabilité'),
  ('finance.write',      'Encaisser, facturer, reverser'),
  ('dunning.suspend',    'Valider une mise à pied pour impayé'),
  ('grades.write',       'Saisir des notes et appréciations (ses classes)'),
  ('grades.publish',     'Publier les bulletins'),
  ('attendance.write',   'Saisir absences, retards, incidents'),
  ('exams.manage',       'Gérer inscriptions candidats libres et Campus France'),
  ('announce.all',       'Publier une annonce vers n''importe quelle audience'),
  ('announce.class',     'Publier une annonce vers ses classes'),
  ('notify.parent',      'Notifier individuellement un parent'),
  ('booking.write',      'Réserver du matériel'),
  ('booking.manage',     'Gérer le parc de matériel et arbitrer les conflits'),
  ('council.view',       'Consulter et éditer la grille du conseil de classe'),
  ('students.enrol',     'Inscrire un élève, gérer son dossier administratif');

INSERT INTO role_permission SELECT 'DIRECTION', code FROM permission;
INSERT INTO role_permission (role, permission) VALUES
  ('PROFESSEUR',   'grades.write'), ('PROFESSEUR', 'attendance.write'), ('PROFESSEUR', 'announce.class'),
  ('PROFESSEUR',   'notify.parent'), ('PROFESSEUR', 'booking.write'),
  ('VIE_SCOLAIRE', 'attendance.write'), ('VIE_SCOLAIRE', 'notify.parent'), ('VIE_SCOLAIRE', 'announce.class'),
  ('VIE_SCOLAIRE', 'booking.write'), ('VIE_SCOLAIRE', 'booking.manage'), ('VIE_SCOLAIRE', 'exams.manage'),
  ('BUREAU', 'finance.read'), ('BUREAU', 'finance.write'), ('BUREAU', 'notify.parent'),
  ('BUREAU', 'booking.write'), ('BUREAU', 'council.view'), ('BUREAU', 'students.enrol'),
  -- le Bureau a aussi accès à la vie scolaire (l'inverse n'est pas vrai)
  ('BUREAU', 'attendance.write'), ('BUREAU', 'announce.class'), ('BUREAU', 'exams.manage'), ('BUREAU', 'booking.manage');

-- Notation
INSERT INTO grading_policy (year_id, site_id) SELECT y.id, s.id FROM academic_year y, site s WHERE s.code = 'TMV';
INSERT INTO evaluation_type (code, label) VALUES
  ('DS', 'Devoir surveillé'), ('INTERRO', 'Interrogation'), ('ORAL', 'Oral'), ('EXPOSE', 'Exposé'),
  ('DM', 'Devoir maison'), ('TP', 'Travaux pratiques'), ('PROJET', 'Projet'), ('AUTRE', 'Autre');
INSERT INTO council_flag_type (code, label, tone) VALUES
  ('EXEMPLAIRE', 'Élève exemplaire', 'POSITIF'), ('ENCOURAGEMENTS', 'Encouragements', 'POSITIF'),
  ('BAVARD', 'Élève bavard.e', 'VIGILANCE'), ('MANQUE_TRAVAIL', 'Manque de travail personnel', 'VIGILANCE'),
  ('AVERT_TRAVAIL', 'Avertissement travail', 'ALERTE'), ('AVERT_COMPORTEMENT', 'Avertissement comportement', 'ALERTE');

-- Vie scolaire
INSERT INTO discipline_measure_type (code, label, kind) VALUES
  ('OBSERVATION', 'Observation écrite', 'PUNITION'), ('DEVOIR_SUPP', 'Devoir supplémentaire', 'PUNITION'),
  ('RETENUE', 'Retenue', 'PUNITION'), ('EXCLUSION_COURS', 'Exclusion ponctuelle de cours', 'PUNITION'),
  ('AVERTISSEMENT', 'Avertissement', 'SANCTION'), ('BLAME', 'Blâme', 'SANCTION'),
  ('RESPONSABILISATION', 'Mesure de responsabilisation', 'SANCTION'), ('EXCLUSION_TEMP', 'Exclusion temporaire (8 jours max.)', 'SANCTION');

INSERT INTO authorization_type (code, label, options) VALUES
  ('IMAGE', 'Droit à l''image', '{"J''autorise","Je n''autorise pas"}'),
  ('SORTIE', 'Autorisation de sortie', '{"Sortie libre aux heures sans cours","Sortie en fin de journée uniquement","Aucune sortie sans un responsable"}'),
  ('SORTIES_PEDA', 'Sorties pédagogiques', '{"J''autorise","Je n''autorise pas"}');

INSERT INTO school_life_policy (year_id, site_id) SELECT y.id, s.id FROM academic_year y, site s WHERE s.code = 'TMV';
INSERT INTO internship_type (code, level_code, label, school_days) VALUES
  ('STAGE_3E', '3E', 'Stage d''observation de 3e', 5),
  ('STAGE_2DE', '2NDE', 'Stage de seconde', 10);
