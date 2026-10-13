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

-- Calendrier de relance d'écolage
INSERT INTO dunning_month (year_id, month, is_active, skip_reason)
SELECT y.id, m, m IN (9, 11, 12, 2, 4, 5, 6),
       CASE WHEN m = 10 THEN 'Encaissement des droits d''examen'
            WHEN m NOT IN (9, 11, 12, 2, 4, 5, 6) THEN 'Hors cycle de relance' END
FROM academic_year y, generate_series(1, 12) m;

-- Mai = dernier mois d'écolage payable pour les 1re et Tle de Tamatave (départ à Tana)
INSERT INTO tuition_cutoff_rule (year_id, site_id, level_code, last_payable_month)
SELECT y.id, s.id, l, 5 FROM academic_year y, site s, unnest(ARRAY['1RE', 'TLE']) l
WHERE s.code = 'TMV';

-- Plan de comptes : deux catégories étanches
INSERT INTO ledger_account (code, category, label, nature) VALUES
  ('ECO-CAISSE',     'ECOLAGE',       'Trésorerie écolage',              'ACTIF'),
  ('ECO-CLIENTS',    'ECOLAGE',       'Familles — écolage à recevoir',   'ACTIF'),
  ('ECO-PRODUIT',    'ECOLAGE',       'Produit écolage',                 'PRODUIT'),
  ('EXA-CAISSE',     'DROITS_EXAMEN', 'Trésorerie droits d''examen',      'ACTIF'),
  ('EXA-A-REVERSER', 'DROITS_EXAMEN', 'Droits dus aux centres d''examen', 'PASSIF'),
  ('EXA-FRAIS-DOS',  'DROITS_EXAMEN', 'Frais de dossier conservés',      'PRODUIT');

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
  ('booking.manage',     'Gérer le parc de matériel et arbitrer les conflits');

INSERT INTO role_permission SELECT 'DIRECTION', code FROM permission;
INSERT INTO role_permission (role, permission) VALUES
  ('PROFESSEUR',   'grades.write'), ('PROFESSEUR', 'attendance.write'), ('PROFESSEUR', 'announce.class'),
  ('PROFESSEUR',   'notify.parent'), ('PROFESSEUR', 'booking.write'),
  ('VIE_SCOLAIRE', 'attendance.write'), ('VIE_SCOLAIRE', 'notify.parent'), ('VIE_SCOLAIRE', 'announce.class'),
  ('VIE_SCOLAIRE', 'booking.write'), ('VIE_SCOLAIRE', 'booking.manage'), ('VIE_SCOLAIRE', 'exams.manage'),
  ('COMPTABILITE', 'finance.read'), ('COMPTABILITE', 'finance.write'), ('COMPTABILITE', 'notify.parent'),
  ('COMPTABILITE', 'booking.write');
