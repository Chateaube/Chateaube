-- ENT Chateaubriand — installation complète pour Supabase (généré par build.sh, ne pas modifier à la main)
-- =============================================================================
--  ENT Chateaubriand — Schéma PostgreSQL (>= 14)
--  Multi-sites (Tana / Tamatave), comptabilité séparée Frais de scolarité / Droits d'examen,
--  mobilité inter-sites des élèves, réservation de matériel, notes & bulletins.
--
--  Conventions :
--   * Montants en Ariary (MGA), entiers BIGINT (pas de décimales).
--   * Clés primaires UUID ; horodatages en timestamptz (Indian/Antananarivo, UTC+3).
--   * Les données pédagogiques et financières sont rattachées à l'INSCRIPTION
--     (enrollment) et jamais au site : changer de site ne déplace aucune donnée.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS btree_gist;   -- contraintes d'exclusion (réservations)

-- -----------------------------------------------------------------------------
-- 0. Types énumérés
-- -----------------------------------------------------------------------------
CREATE TYPE cycle_code        AS ENUM ('PRESCOLAIRE', 'PRIMAIRE', 'COLLEGE', 'LYCEE');
CREATE TYPE track_code        AS ENUM ('GENERALE', 'STMG');
-- DIRECTION = administrateur (tout) ; BUREAU = administration / économat (+ accès vie scolaire)
CREATE TYPE role_code         AS ENUM ('DIRECTION', 'BUREAU', 'VIE_SCOLAIRE', 'PROFESSEUR', 'PARENT', 'ELEVE');
CREATE TYPE auth_provider     AS ENUM ('GOOGLE', 'MAGIC_LINK', 'PASSWORD');
CREATE TYPE assignment_reason AS ENUM ('INSCRIPTION', 'TRANSFERT_EXAMEN', 'DEMENAGEMENT', 'AUTRE');

CREATE TYPE fee_category      AS ENUM ('ECOLAGE', 'FRAIS_ANNEXES', 'DROITS_EXAMEN');
CREATE TYPE fee_item_kind     AS ENUM ('INSCRIPTION', 'REINSCRIPTION', 'ECOLAGE', 'FASCICULE', 'LOCATION', 'ARTICLE', 'SERVICE');
CREATE TYPE cash_direction    AS ENUM ('ENTREE', 'SORTIE');
CREATE TYPE contract_type     AS ENUM ('CDI', 'CDD', 'VACATAIRE', 'STAGIAIRE');
CREATE TYPE invoice_status    AS ENUM ('BROUILLON', 'EMISE', 'PARTIELLE', 'PAYEE', 'ANNULEE'); -- PARTIELLE : historique seulement (paiement partiel refusé)
-- Modes acceptés : espèces, chèque, virement (pas de mobile money)
CREATE TYPE payment_method    AS ENUM ('ESPECES', 'CHEQUE', 'VIREMENT');
CREATE TYPE dunning_stage     AS ENUM ('RELANCE', 'AVERTISSEMENT', 'MISE_A_PIED', 'REGULARISE', 'SUSPENDU');
CREATE TYPE day_off_kind      AS ENUM ('FERIE', 'VACANCES', 'FERMETURE');
CREATE TYPE dunning_count_from AS ENUM ('ECHEANCE', 'ETAPE_PRECEDENTE');

CREATE TYPE exam_code         AS ENUM ('DNB', 'PRE_BAC', 'BAC');
CREATE TYPE exam_file_status  AS ENUM ('A_CONSTITUER', 'INCOMPLET', 'COMPLET', 'DEPOSE', 'VALIDE_ACADEMIE', 'REJETE');

CREATE TYPE grading_mode      AS ENUM ('NUMERIQUE', 'COMPETENCES', 'APPRECIATION_SEULE');
CREATE TYPE grade_status      AS ENUM ('NOTE', 'ABSENT', 'DISPENSE', 'NON_NOTE');
CREATE TYPE opening_strand    AS ENUM ('NUMERIQUE', 'ORIENTATION', 'ART');
CREATE TYPE class_decision    AS ENUM ('ADMIS', 'RETENU', 'REORIENTE', 'EN_ATTENTE');
CREATE TYPE comment_status    AS ENUM ('BROUILLON', 'A_VALIDER', 'VALIDE');

CREATE TYPE resource_type     AS ENUM ('TV', 'VIDEOPROJECTEUR', 'ENCEINTE', 'SALLE_SPECIALISEE', 'INFORMATIQUE', 'AUTRE');
CREATE TYPE booking_status    AS ENUM ('CONFIRMEE', 'ANNULEE');

CREATE TYPE audience_role     AS ENUM ('TOUS', 'PROFESSEUR', 'PARENT', 'ELEVE', 'PERSONNEL');
-- Pas de SMS (aucun budget prévu) : e-mail et notification de l'application
CREATE TYPE notif_channel     AS ENUM ('EMAIL', 'PUSH', 'WHATSAPP'); -- pas de SMS (budget)
CREATE TYPE notif_reason      AS ENUM ('RETARD', 'ABSENCE', 'DISCIPLINE', 'DOCUMENT_MANQUANT', 'IMPAYE', 'AUTRE');
CREATE TYPE delivery_status   AS ENUM ('EN_ATTENTE', 'ENVOYE', 'DELIVRE', 'ECHEC');

-- -----------------------------------------------------------------------------
-- 1. Structure de l'établissement
-- -----------------------------------------------------------------------------
CREATE TABLE site (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text UNIQUE NOT NULL,            -- 'TANA', 'TMV'
  name        text NOT NULL,                   -- 'Tananarive', 'Tamatave'
  timezone    text NOT NULL DEFAULT 'Indian/Antananarivo'
);

-- Cycles proposés par site (Tamatave : COLLEGE + LYCEE ; Tana : les 4).
CREATE TABLE site_cycle (
  site_id     uuid REFERENCES site(id),
  cycle       cycle_code,
  PRIMARY KEY (site_id, cycle)
);

CREATE TABLE academic_year (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label       text UNIQUE NOT NULL,            -- '2026-2027'
  starts_on   date NOT NULL,
  ends_on     date NOT NULL,
  is_current  boolean NOT NULL DEFAULT false,
  CHECK (ends_on > starts_on)
);
CREATE UNIQUE INDEX one_current_year ON academic_year (is_current) WHERE is_current;

CREATE TABLE period (                           -- trimestres
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year_id     uuid NOT NULL REFERENCES academic_year(id),
  rank        smallint NOT NULL CHECK (rank BETWEEN 1 AND 3),
  starts_on   date NOT NULL,
  ends_on     date NOT NULL,
  UNIQUE (year_id, rank)
);

CREATE TABLE level (                            -- niveaux : PS..CM2, 6E..TLE
  code        text PRIMARY KEY,                -- '6E','5E','4E','3E','2NDE','1RE','TLE'
  cycle       cycle_code NOT NULL,
  rank        smallint UNIQUE NOT NULL,        -- ordre de progression
  label       text NOT NULL,                   -- '6e', '1re', 'Terminale'
  official_exam exam_code                      -- 3E → DNB ; TLE → BAC
);

CREATE TABLE school_class (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year_id     uuid NOT NULL REFERENCES academic_year(id),
  site_id     uuid NOT NULL REFERENCES site(id),
  level_code  text NOT NULL REFERENCES level(code),
  track       track_code,                      -- NULL avant la 1re
  name        text NOT NULL,                   -- '1re STMG A'
  head_teacher_id uuid,                        -- FK ajoutée après app_user
  UNIQUE (year_id, site_id, name)
);

-- -----------------------------------------------------------------------------
-- 2. Comptes, rôles & authentification
-- -----------------------------------------------------------------------------
CREATE TABLE app_user (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         citext UNIQUE NOT NULL,
  first_name    text NOT NULL,
  last_name     text NOT NULL,
  phone_e164    text,                          -- +261… (contact téléphonique, pas d'envoi de SMS)
  google_sub    text UNIQUE,                   -- identifiant OIDC Google (SSO)
  auth_provider auth_provider NOT NULL DEFAULT 'GOOGLE',
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz
);

ALTER TABLE school_class
  ADD CONSTRAINT school_class_head_teacher_fk FOREIGN KEY (head_teacher_id) REFERENCES app_user(id);

-- RBAC : les droits sont portés par le RÔLE ; la Direction peut ajouter, écran par écran, une exception
-- pour une personne (screen_access_user, en fin de fichier).
-- La Cheffe d'établissement et la Directrice adjointe ont donc par construction
-- exactement les mêmes droits (rôle DIRECTION, périmètre tous sites).
CREATE TABLE user_role (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  role        role_code NOT NULL,
  site_id     uuid REFERENCES site(id),        -- NULL = tous les sites
  title       text                             -- libellé affiché : 'Cheffe d''établissement'
);
CREATE UNIQUE INDEX user_role_per_site  ON user_role (user_id, role, site_id) WHERE site_id IS NOT NULL;
CREATE UNIQUE INDEX user_role_all_sites ON user_role (user_id, role) WHERE site_id IS NULL;

CREATE TABLE permission (
  code        text PRIMARY KEY,                -- 'finance.write', 'grades.publish'…
  description text NOT NULL
);

CREATE TABLE role_permission (
  role        role_code,
  permission  text REFERENCES permission(code),
  PRIMARY KEY (role, permission)
);

-- Liste blanche SSO : seuls les comptes Google pré-enregistrés peuvent se connecter
-- (les comptes @gmail.com personnels ne permettent pas un filtrage par domaine).
CREATE TABLE sso_allowlist (
  email       citext PRIMARY KEY,
  invited_by  uuid REFERENCES app_user(id),
  invited_at  timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 3. Élèves, familles, inscriptions & MOBILITÉ INTER-SITES
-- -----------------------------------------------------------------------------
CREATE TABLE student (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid UNIQUE REFERENCES app_user(id),  -- compte élève (optionnel)
  ine           text UNIQUE,                   -- n° d'identification (si attribué)
  first_name    text NOT NULL,
  last_name     text NOT NULL,
  birth_date    date NOT NULL,
  birth_place   text,
  nationalities text[] NOT NULL DEFAULT '{}',  -- codes ISO (ex. {MG,FR}) : détermine Parcoursup ou Campus France
  sex           char(1) CHECK (sex IN ('F', 'M')),
  previous_school text,                        -- établissement d'origine (première inscription)
  health_notes  text,                          -- allergies, traitement (visible Direction, Vie scolaire, Bureau)
  emergency_contact text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Pré-inscriptions : premier contact d'une famille, avant la fiche élève.
-- Une demande acceptée est convertie en inscription : la fiche élève est alors créée.
CREATE TYPE pre_registration_status AS ENUM ('DEMANDE', 'DOSSIER', 'ENTRETIEN', 'ACCEPTEE', 'INSCRITE', 'ATTENTE', 'REFUSEE');
CREATE TABLE pre_registration (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id       uuid NOT NULL REFERENCES site(id),
  child_name    text NOT NULL,
  birth_date    date,
  requested_level text NOT NULL,               -- classe demandée (ex. 6e, 1re STMG)
  previous_school text,
  contact_name  text NOT NULL,
  contact_phone text,
  contact_email citext,
  source        text,                          -- comment la famille a connu l'établissement
  status        pre_registration_status NOT NULL DEFAULT 'DEMANDE',
  interview_at  timestamptz,
  note          text,
  student_id    uuid REFERENCES student(id),   -- renseigné à la conversion en inscription
  received_on   date NOT NULL DEFAULT current_date,
  updated_by    uuid,
  CHECK (contact_phone IS NOT NULL OR contact_email IS NOT NULL),
  CHECK ((status = 'INSCRITE') = (student_id IS NOT NULL))
);

CREATE TABLE guardian (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid UNIQUE REFERENCES app_user(id),
  first_name    text NOT NULL,
  last_name     text NOT NULL,
  email         citext,
  phone_e164    text,
  preferred_channel notif_channel NOT NULL DEFAULT 'EMAIL'
);

CREATE TABLE student_guardian (
  student_id    uuid REFERENCES student(id) ON DELETE CASCADE,
  guardian_id   uuid REFERENCES guardian(id) ON DELETE CASCADE,
  relationship  text NOT NULL,                 -- 'Mère', 'Père', 'Tuteur.rice'
  is_payer      boolean NOT NULL DEFAULT false,-- destinataire des factures/relances
  is_primary    boolean NOT NULL DEFAULT false,
  can_pickup    boolean NOT NULL DEFAULT true, -- autorisé.e à récupérer l'élève (téléphone confisqué 5 jours, sorties)
  PRIMARY KEY (student_id, guardian_id)
);

-- Inscription annuelle : point d'ancrage de TOUTES les données (notes, factures,
-- bulletins, examens). La classe d'origine reste inchangée lors d'un transfert.
CREATE TABLE enrollment (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id    uuid NOT NULL REFERENCES student(id),
  year_id       uuid NOT NULL REFERENCES academic_year(id),
  class_id      uuid NOT NULL REFERENCES school_class(id),
  enrolled_on   date NOT NULL,
  left_on       date,
  UNIQUE (student_id, year_id)
);

-- Affectation GÉOGRAPHIQUE historisée (où l'élève est physiquement accueilli).
-- Exemple : élève de Tle de Tamatave → ligne 1 (TMV, sept→avril) puis
-- Spécialités suivies (voie générale) : 3 en Première, 2 en Terminale. Le bulletin ne garde
-- que les spécialités de l'élève ; la moyenne de classe d'une spécialité porte sur ses seuls élèves.
CREATE TYPE specialty_code AS ENUM ('MATHS', 'PC', 'SVT', 'SES', 'HGGSP', 'HLP', 'LLCER', 'NSI');
CREATE TABLE enrollment_specialty (
  enrollment_id uuid REFERENCES enrollment(id) ON DELETE CASCADE,
  specialty     specialty_code,
  PRIMARY KEY (enrollment_id, specialty)
);

-- ligne 2 (TANA, avril→fin d'année, reason = TRANSFERT_EXAMEN).
CREATE TABLE site_assignment (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES enrollment(id) ON DELETE CASCADE,
  site_id       uuid NOT NULL REFERENCES site(id),
  host_class_id uuid REFERENCES school_class(id),     -- classe d'accueil (emploi du temps), optionnelle
  valid_during  daterange NOT NULL,
  reason        assignment_reason NOT NULL,
  decided_by    uuid REFERENCES app_user(id),
  decided_at    timestamptz NOT NULL DEFAULT now(),
  -- jamais deux affectations simultanées pour une même inscription
  EXCLUDE USING gist (enrollment_id WITH =, valid_during WITH &&)
);

-- Campagne de transfert (ex. « Transfert 1re/Tle TMV → Tana, avril 2027 »)
CREATE TABLE transfer_campaign (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year_id       uuid NOT NULL REFERENCES academic_year(id),
  from_site_id  uuid NOT NULL REFERENCES site(id),
  to_site_id    uuid NOT NULL REFERENCES site(id),
  level_codes   text[] NOT NULL,               -- {'1RE','TLE'}
  effective_on  date NOT NULL,                 -- date de bascule
  requires_financial_clearance boolean NOT NULL DEFAULT true,
  executed_at   timestamptz,
  executed_by   uuid REFERENCES app_user(id),
  CHECK (from_site_id <> to_site_id)
);

-- Vue : site courant de chaque inscription (utilisée pour le filtrage par site).
CREATE VIEW v_current_site AS
SELECT e.id AS enrollment_id, e.student_id, e.class_id, sa.site_id, sa.host_class_id, sa.reason
FROM enrollment e
JOIN site_assignment sa ON sa.enrollment_id = e.id AND sa.valid_during @> current_date;

-- -----------------------------------------------------------------------------
-- 4. FINANCES — comptabilité séparée (Frais de scolarité ≠ Droits d'examen)
-- -----------------------------------------------------------------------------
-- Plan de comptes simplifié. Chaque compte appartient à UNE catégorie : aucun
-- flux ne peut traverser les catégories (contrôlé par trigger sur ledger_line).
CREATE TABLE ledger_account (
  code        text PRIMARY KEY,
  category    fee_category NOT NULL,
  label       text NOT NULL,
  nature      text NOT NULL CHECK (nature IN ('ACTIF', 'PASSIF', 'PRODUIT'))
);
-- Exemple (cf. seed.sql) :
--   ECO-CAISSE     ECOLAGE        Trésorerie frais de scolarité               ACTIF
--   ECO-CLIENTS    ECOLAGE        Familles — frais de scolarité               ACTIF
--   ECO-PRODUIT    ECOLAGE        Produit frais de scolarité                  PRODUIT
--   EXA-CAISSE     DROITS_EXAMEN  Trésorerie droits d'examen       ACTIF
--   EXA-CLIENTS    DROITS_EXAMEN  Familles — droits d'examen       ACTIF
--   EXA-A-REVERSER DROITS_EXAMEN  Dû aux centres d'examen          PASSIF
--   EXA-FRAIS-DOS  DROITS_EXAMEN  Frais de dossier conservés       PRODUIT

-- Grille tarifaire par année / site / niveau / catégorie
CREATE TABLE fee_schedule (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year_id       uuid NOT NULL REFERENCES academic_year(id),
  site_id       uuid NOT NULL REFERENCES site(id),
  level_code    text NOT NULL REFERENCES level(code),
  category      fee_category NOT NULL,
  exam          exam_code,                     -- requis si DROITS_EXAMEN
  label         text NOT NULL,
  amount_mga    bigint NOT NULL CHECK (amount_mga > 0),
  retained_fee_mga bigint NOT NULL DEFAULT 0,  -- part conservée par l'école (40 000 Ar)
  CHECK ((category = 'DROITS_EXAMEN') = (exam IS NOT NULL)),
  CHECK (retained_fee_mga BETWEEN 0 AND amount_mga),
  CHECK (category = 'DROITS_EXAMEN' OR retained_fee_mga = 0)
);

-- =====  PARAMÈTRES (modifiables par la Direction sans recoder)  =====

-- Calendrier scolaire : jours fériés, vacances et fermetures exceptionnelles.
-- site_id NULL = tous les sites (jours fériés nationaux).
CREATE TABLE calendar_day_off (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year_id       uuid NOT NULL REFERENCES academic_year(id),
  site_id       uuid REFERENCES site(id),
  kind          day_off_kind NOT NULL,
  label         text NOT NULL,                 -- 'Vacances de Noël', 'Fête de l''Indépendance'
  days          daterange NOT NULL,            -- bornes incluses : daterange(début, fin, '[]')
  CHECK (NOT isempty(days))
);
CREATE INDEX calendar_day_off_days_idx ON calendar_day_off USING gist (days);

-- Mois soumis aux relances de frais de scolarité. Pendant un mois inactif, le décompte des
-- délais est GELÉ (aucun jour ne compte). Seed : tous les mois actifs sauf octobre.
CREATE TABLE dunning_month (
  year_id       uuid REFERENCES academic_year(id),
  month         smallint CHECK (month BETWEEN 1 AND 12),
  is_active     boolean NOT NULL,
  skip_reason   text,                          -- 'Encaissement des droits d''examen'
  PRIMARY KEY (year_id, month),
  CHECK (is_active OR skip_reason IS NOT NULL)
);

-- Politique de recouvrement par année et par site.
-- Délais exprimés en JOURS COMPTÉS : jours de la semaine retenus (counted_weekdays),
-- hors jours fériés, vacances et mois gelés (calendar_day_off, dunning_month).
CREATE TABLE dunning_policy (
  year_id         uuid REFERENCES academic_year(id),
  site_id         uuid REFERENCES site(id),
  due_day         smallint NOT NULL DEFAULT 5 CHECK (due_day BETWEEN 1 AND 28), -- échéance le 5 du mois
  -- Tamatave : relance 10 jours après l'échéance, avertissement 15 jours après la relance,
  -- mise à pied 10 jours après l'avertissement (jours comptés)
  relance_after   smallint NOT NULL DEFAULT 10 CHECK (relance_after > 0),
  warning_after   smallint NOT NULL DEFAULT 15 CHECK (warning_after > 0),
  suspension_after smallint NOT NULL DEFAULT 10 CHECK (suspension_after > 0),
  count_from      dunning_count_from NOT NULL DEFAULT 'ETAPE_PRECEDENTE', -- délais depuis l'étape précédente ou depuis l'échéance
  -- Dernier mois du plan (juin, ou mai pour 1re/Tle) : délais raccourcis ; NULL = mêmes délais
  last_month_relance_after    smallint DEFAULT 5 CHECK (last_month_relance_after > 0),
  last_month_warning_after    smallint DEFAULT 5 CHECK (last_month_warning_after > 0),
  last_month_suspension_after smallint DEFAULT 5 CHECK (last_month_suspension_after > 0),
  counted_weekdays smallint[] NOT NULL DEFAULT '{1,2,3,4,5}',    -- 1 = lundi … 6 = samedi
  suspension_requires_direction boolean NOT NULL DEFAULT true,     -- mise à pied validée par la Direction
  channels        notif_channel[] NOT NULL DEFAULT '{EMAIL,PUSH}',
  updated_by      uuid REFERENCES app_user(id),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (year_id, site_id),
  CHECK (counted_weekdays <@ '{1,2,3,4,5,6,7}' AND cardinality(counted_weekdays) > 0),
  CHECK (count_from = 'ETAPE_PRECEDENTE' OR (relance_after < warning_after AND warning_after < suspension_after)),
  CHECK (count_from = 'ETAPE_PRECEDENTE' OR last_month_relance_after IS NULL
         OR (last_month_relance_after < last_month_warning_after AND last_month_warning_after < last_month_suspension_after))
);

-- Plan de frais de scolarité par niveau : premier et dernier mois facturés.
-- Seed Tamatave : 6e → 2de de septembre à juin (10 échéances) ;
-- 1re et Tle de septembre à mai (9 échéances, départ à Tana).
CREATE TABLE tuition_cutoff_rule (
  year_id       uuid REFERENCES academic_year(id),
  site_id       uuid REFERENCES site(id),
  level_code    text REFERENCES level(code),
  first_payable_month smallint NOT NULL DEFAULT 9 CHECK (first_payable_month BETWEEN 1 AND 12),
  last_payable_month smallint NOT NULL CHECK (last_payable_month BETWEEN 1 AND 12),
  PRIMARY KEY (year_id, site_id, level_code)
);

-- =====  CATALOGUE TARIFAIRE (« Classes & tarifs », « Articles & services »)  =====
-- Tarifs toujours fixés (pas de montant libre) ; modifiables par la Direction seule (admin.settings).
-- Chaque article appartient à UN journal (catégorie) : frais de scolarité, frais annexes
-- (inscription, réinscription, fascicule, location, articles) ou droits d'examen.
CREATE TABLE fee_item (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code          text UNIQUE NOT NULL,          -- 'INSCRIPTION', 'MANUEL_PERTE', 'NATATION_SEANCE'…
  kind          fee_item_kind NOT NULL,
  category      fee_category NOT NULL,
  rubric        text NOT NULL,                 -- 'Manuel scolaire', 'Passeport de Vie Scolaire'…
  label         text NOT NULL,                 -- 'Manuel perdu ou endommagé'
  unit          text NOT NULL DEFAULT 'par unité',
  priced_by_level boolean NOT NULL DEFAULT false, -- vrai : prix par classe (grille), faux : prix unique
  is_active     boolean NOT NULL DEFAULT true,
  CHECK (kind <> 'ECOLAGE' OR category = 'ECOLAGE'),
  CHECK (category <> 'DROITS_EXAMEN')             -- les droits d'examen passent par fee_schedule
);

-- Prix par année et par site ; level_code NULL = même prix pour toutes les classes.
CREATE TABLE fee_price (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year_id       uuid NOT NULL REFERENCES academic_year(id),
  site_id       uuid NOT NULL REFERENCES site(id),
  item_id       uuid NOT NULL REFERENCES fee_item(id),
  level_code    text REFERENCES level(code),
  track         track_code,                    -- 1re/Tle Générale ≠ STMG si besoin
  amount_mga    bigint NOT NULL CHECK (amount_mga >= 0),
  UNIQUE NULLS NOT DISTINCT (year_id, site_id, item_id, level_code, track)
);

-- Échéances (factures) générées pour une inscription.
CREATE TABLE invoice (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number        text UNIQUE NOT NULL,          -- 'ECO-2026-TMV-000123' / 'EXA-2026-…'
  enrollment_id uuid NOT NULL REFERENCES enrollment(id),
  category      fee_category NOT NULL,
  fee_schedule_id uuid REFERENCES fee_schedule(id),
  period_month  date,                          -- 1er jour du mois facturé (frais de scolarité)
  due_on        date NOT NULL,
  amount_mga    bigint NOT NULL CHECK (amount_mga > 0),
  paid_mga      bigint NOT NULL DEFAULT 0 CHECK (paid_mga >= 0),
  status        invoice_status NOT NULL DEFAULT 'EMISE',
  issued_at     timestamptz NOT NULL DEFAULT now(),
  CHECK (paid_mga <= amount_mga),
  CHECK ((category = 'ECOLAGE') = (period_month IS NOT NULL))
);
CREATE INDEX invoice_open_idx ON invoice (category, due_on) WHERE status IN ('EMISE', 'PARTIELLE');

-- Détail d'une facture : une ligne par article (ex. 2 tee-shirts, 3 séances de natation).
CREATE TABLE invoice_line (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  invoice_id    uuid NOT NULL REFERENCES invoice(id) ON DELETE CASCADE,
  item_id       uuid REFERENCES fee_item(id),
  label         text NOT NULL,
  quantity      integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price_mga bigint NOT NULL CHECK (unit_price_mga >= 0),
  amount_mga    bigint GENERATED ALWAYS AS (quantity * unit_price_mga) STORED
);

-- Encaissement : un paiement n'appartient qu'à UNE catégorie (caisses distinctes).
CREATE TABLE payment (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_no    text UNIQUE NOT NULL,
  category      fee_category NOT NULL,
  site_id       uuid NOT NULL REFERENCES site(id),   -- caisse d'encaissement
  payer_guardian_id uuid REFERENCES guardian(id),
  amount_mga    bigint NOT NULL CHECK (amount_mga > 0),
  method        payment_method NOT NULL,
  instrument_ref text,                         -- n° de chèque ou n° de bordereau / référence du virement
  bank_name     text,                          -- banque émettrice
  batch_id      uuid,                          -- un même chèque peut produire un reçu par journal
  cheque_status text CHECK (cheque_status IN ('A_DEPOSER', 'DEPOSE', 'ENCAISSE', 'REJETE')),
  received_at   timestamptz NOT NULL DEFAULT now(),
  received_by   uuid NOT NULL REFERENCES app_user(id),
  -- traçabilité obligatoire hors espèces
  CHECK ((method = 'ESPECES') = (instrument_ref IS NULL AND bank_name IS NULL)),
  CHECK (method <> 'CHEQUE' OR (instrument_ref ~ '^[0-9]{6,10}$' AND cheque_status IS NOT NULL)),
  CHECK (method = 'CHEQUE' OR cheque_status IS NULL)
);

CREATE TABLE payment_allocation (
  payment_id    uuid REFERENCES payment(id),
  invoice_id    uuid REFERENCES invoice(id),
  amount_mga    bigint NOT NULL CHECK (amount_mga > 0),
  PRIMARY KEY (payment_id, invoice_id)
);

-- Reversement des droits d'examen aux centres (Lycée Français, Académie…)
CREATE TABLE exam_fee_remittance (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_session_id uuid NOT NULL,               -- FK ajoutée section 6
  beneficiary   text NOT NULL,                 -- 'Lycée Français de Tananarive'
  amount_mga    bigint NOT NULL CHECK (amount_mga > 0),
  candidates    integer NOT NULL,
  paid_on       date NOT NULL,
  reference     text,
  recorded_by   uuid NOT NULL REFERENCES app_user(id)
);

-- Journal en partie double, une écriture = N lignes équilibrées, mono-catégorie.
CREATE TABLE ledger_entry (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category      fee_category NOT NULL,
  entry_date    date NOT NULL DEFAULT current_date,
  label         text NOT NULL,
  payment_id    uuid REFERENCES payment(id),
  invoice_id    uuid REFERENCES invoice(id),
  remittance_id uuid REFERENCES exam_fee_remittance(id),
  site_id       uuid NOT NULL REFERENCES site(id),
  created_by    uuid NOT NULL REFERENCES app_user(id),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ledger_line (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  entry_id      uuid NOT NULL REFERENCES ledger_entry(id),
  account_code  text NOT NULL REFERENCES ledger_account(code),
  debit_mga     bigint NOT NULL DEFAULT 0 CHECK (debit_mga >= 0),
  credit_mga    bigint NOT NULL DEFAULT 0 CHECK (credit_mga >= 0),
  CHECK ((debit_mga = 0) <> (credit_mga = 0))
);

-- Garde-fou : une ligne ne peut viser qu'un compte de la catégorie de l'écriture.
CREATE FUNCTION ledger_line_same_category() RETURNS trigger AS $$
BEGIN
  IF (SELECT category FROM ledger_account WHERE code = NEW.account_code)
     <> (SELECT category FROM ledger_entry WHERE id = NEW.entry_id) THEN
    RAISE EXCEPTION 'Comptabilité séparée : le compte % n''appartient pas à la catégorie de l''écriture', NEW.account_code;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER ledger_line_category_guard
  BEFORE INSERT OR UPDATE ON ledger_line
  FOR EACH ROW EXECUTE FUNCTION ledger_line_same_category();

-- Garde-fou : équilibre débit = crédit vérifié en fin de transaction.
CREATE FUNCTION ledger_entry_balanced() RETURNS trigger AS $$
DECLARE d bigint; c bigint;
BEGIN
  SELECT coalesce(sum(debit_mga), 0), coalesce(sum(credit_mga), 0) INTO d, c
  FROM ledger_line WHERE entry_id = NEW.entry_id;
  IF d <> c THEN
    RAISE EXCEPTION 'Écriture % déséquilibrée (débit % ≠ crédit %)', NEW.entry_id, d, c;
  END IF;
  RETURN NULL;
END $$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER ledger_balance_check
  AFTER INSERT OR UPDATE ON ledger_line
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION ledger_entry_balanced();

-- Dossier de recouvrement (workflow impayés) : une ligne par famille/inscription
-- et par cycle ; chaque transition est historisée dans dunning_event.
CREATE TABLE dunning_case (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES enrollment(id),
  opened_month  date NOT NULL,                 -- mois de l'échéance impayée
  due_on        date NOT NULL,                 -- date d'échéance (le 5 du mois) : point de départ des délais
  stage         dunning_stage NOT NULL DEFAULT 'RELANCE',
  overdue_mga   bigint NOT NULL CHECK (overdue_mga >= 0),
  suspension_validated_by uuid REFERENCES app_user(id), -- mise à pied = validation Direction
  closed_at     timestamptz,
  UNIQUE (enrollment_id, opened_month)
);

CREATE TABLE dunning_event (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  case_id       uuid NOT NULL REFERENCES dunning_case(id) ON DELETE CASCADE,
  from_stage    dunning_stage,
  to_stage      dunning_stage NOT NULL,
  occurred_at   timestamptz NOT NULL DEFAULT now(),
  actor_id      uuid REFERENCES app_user(id),  -- NULL = automate
  note          text
);

-- Caisse : toutes les entrées et sorties d'argent, attribuées à l'agent qui les saisit.
CREATE TABLE cash_movement (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id       uuid NOT NULL REFERENCES site(id),
  direction     cash_direction NOT NULL,
  category      fee_category NOT NULL,         -- journal mouvementé
  nature        text NOT NULL,                 -- 'Encaissement famille', 'Dépense de fonctionnement', 'Reversement centre d''examen'…
  label         text NOT NULL,
  amount_mga    bigint NOT NULL CHECK (amount_mga > 0),
  method        payment_method NOT NULL,
  payment_id    uuid REFERENCES payment(id),   -- entrée liée à un encaissement famille
  remittance_id uuid REFERENCES exam_fee_remittance(id),
  occurred_at   timestamptz NOT NULL DEFAULT now(),
  agent_id      uuid NOT NULL REFERENCES app_user(id),
  CHECK (direction = 'ENTREE' OR payment_id IS NULL)
);
CREATE INDEX cash_movement_day_idx ON cash_movement (site_id, occurred_at);

-- Vues de restitution — chaque catégorie a son propre état, jamais d'agrégat mixte.
CREATE VIEW v_balance_by_account AS
SELECT a.category, a.code, a.label, le.site_id,
       sum(l.debit_mga) AS debit_mga, sum(l.credit_mga) AS credit_mga,
       sum(l.debit_mga - l.credit_mga) AS solde_mga
FROM ledger_line l
JOIN ledger_entry le ON le.id = l.entry_id
JOIN ledger_account a ON a.code = l.account_code
GROUP BY a.category, a.code, a.label, le.site_id;

-- -----------------------------------------------------------------------------
-- 5. Temps, emploi du temps & RÉSERVATION DE MATÉRIEL
-- -----------------------------------------------------------------------------
-- Horaires d'ouverture par site et par jour (1 = lundi … 5 = vendredi).
-- Registre du personnel (« Gestion des agents ») : entrées et sorties.
-- L'accès à l'ENT d'un agent n'est valide qu'entre sa date d'entrée et sa date de sortie.
CREATE TABLE staff_member (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid UNIQUE REFERENCES app_user(id),  -- NULL : agent sans compte ENT
  site_id       uuid NOT NULL REFERENCES site(id),
  first_name    text NOT NULL,
  last_name     text NOT NULL,
  job_title     text NOT NULL,                 -- 'Enseignant.e', 'Agent d''entretien', 'Gardien.ne'…
  job_detail    text,                          -- matières, fonction
  contract      contract_type NOT NULL,
  entry_on      date NOT NULL,
  exit_on       date,
  exit_reason   text,
  phone_e164    text,
  CHECK (exit_on IS NULL OR exit_on > entry_on),
  CHECK (exit_reason IS NULL OR exit_on IS NOT NULL)
);

CREATE TABLE school_day (
  site_id       uuid REFERENCES site(id),
  weekday       smallint CHECK (weekday BETWEEN 1 AND 6),
  opens_at      time NOT NULL,                 -- 07:00
  closes_at     time NOT NULL,                 -- 17:00 ; mercredi 12:00
  PRIMARY KEY (site_id, weekday),
  CHECK (closes_at > opens_at)
);

-- Pauses : récréation commune (class_id NULL) ou déjeuner propre à une classe/jour.
CREATE TABLE break_slot (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id       uuid NOT NULL REFERENCES site(id),
  class_id      uuid REFERENCES school_class(id),  -- NULL = toute l'école (récré 9:30-9:45)
  weekday       smallint CHECK (weekday BETWEEN 1 AND 6),  -- NULL = tous les jours
  kind          text NOT NULL CHECK (kind IN ('RECREATION', 'DEJEUNER')),
  starts_at     time NOT NULL,
  ends_at       time NOT NULL,
  CHECK (ends_at > starts_at),
  CHECK (kind = 'RECREATION' OR class_id IS NOT NULL)   -- déjeuner toujours par classe
);

CREATE TABLE room (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id       uuid NOT NULL REFERENCES site(id),
  name          text NOT NULL,
  capacity      smallint,
  UNIQUE (site_id, name)
);

CREATE TABLE subject (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code          text UNIQUE NOT NULL,          -- 'MATHS', 'PARCOURS-NUM'
  label         text NOT NULL,
  grading_mode  grading_mode NOT NULL DEFAULT 'NUMERIQUE',
  opening_strand opening_strand,               -- renseigné pour le Parcours d'ouverture
  in_general_average boolean NOT NULL DEFAULT true, -- faux : Arts plastiques, Musique, Vie de classe
  general_coef  numeric(4,2) NOT NULL DEFAULT 1,  -- poids dans la moyenne générale
  CHECK (opening_strand IS NULL OR grading_mode = 'APPRECIATION_SEULE')
);

CREATE TABLE teaching_assignment (            -- qui enseigne quoi à qui
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id      uuid NOT NULL REFERENCES school_class(id),
  subject_id    uuid NOT NULL REFERENCES subject(id),
  teacher_id    uuid NOT NULL REFERENCES app_user(id),
  coefficient   numeric(4,2) NOT NULL DEFAULT 1,
  UNIQUE (class_id, subject_id, teacher_id)
);

CREATE TABLE timetable_slot (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES teaching_assignment(id),
  room_id       uuid REFERENCES room(id),
  weekday       smallint NOT NULL CHECK (weekday BETWEEN 1 AND 6),
  starts_at     time NOT NULL,
  ends_at       time NOT NULL,
  valid_during  daterange NOT NULL,
  CHECK (ends_at > starts_at)
);

-- Ressources réservables (matériel et salles spécialisées), rattachées à un site.
CREATE TABLE resource (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id       uuid NOT NULL REFERENCES site(id),
  type          resource_type NOT NULL,
  label         text NOT NULL,                 -- 'Vidéoprojecteur Epson #2'
  inventory_code text UNIQUE,
  room_id       uuid REFERENCES room(id),      -- pour une salle spécialisée
  is_bookable   boolean NOT NULL DEFAULT true,
  notes         text
);

CREATE TABLE booking (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id   uuid NOT NULL REFERENCES resource(id),
  booked_by     uuid NOT NULL REFERENCES app_user(id),
  class_id      uuid REFERENCES school_class(id),
  -- réservation liée à une séance de l'emploi du temps (NULL : date et heure au choix)
  timetable_slot_id uuid REFERENCES timetable_slot(id),
  period        tstzrange NOT NULL,
  purpose       text,
  status        booking_status NOT NULL DEFAULT 'CONFIRMEE',
  created_at    timestamptz NOT NULL DEFAULT now(),
  CHECK (NOT isempty(period)),
  -- Gestion des conflits garantie par la base : deux réservations confirmées
  -- d'une même ressource ne peuvent pas se chevaucher (bornes [) : 10h-11h et 11h-12h OK).
  EXCLUDE USING gist (resource_id WITH =, period WITH &&) WHERE (status = 'CONFIRMEE')
);
CREATE INDEX booking_period_idx ON booking USING gist (period);

-- -----------------------------------------------------------------------------
-- 6. Examens officiels & dossiers externes
-- -----------------------------------------------------------------------------
CREATE TABLE exam_center (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,                 -- 'Lycée Français de Tamatave'
  city          text NOT NULL
);

CREATE TABLE exam_session (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year_id       uuid NOT NULL REFERENCES academic_year(id),
  exam          exam_code NOT NULL,
  academy       text NOT NULL DEFAULT 'Académie de La Réunion',
  center_id     uuid REFERENCES exam_center(id),
  registration_opens_on  date,                 -- campagne d'octobre
  registration_closes_on date,
  first_paper_on date,
  results_on    date,
  UNIQUE (year_id, exam, center_id)
);

ALTER TABLE exam_fee_remittance
  ADD CONSTRAINT remittance_session_fk FOREIGN KEY (exam_session_id) REFERENCES exam_session(id);

CREATE TABLE exam_registration (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES enrollment(id),
  session_id    uuid NOT NULL REFERENCES exam_session(id),
  candidate_type text NOT NULL DEFAULT 'CANDIDAT_LIBRE',
  candidate_no  text,                          -- n° attribué par l'Académie
  file_status   exam_file_status NOT NULL DEFAULT 'A_CONSTITUER',
  filed_on      date,
  invoice_id    uuid REFERENCES invoice(id),   -- facture DROITS_EXAMEN
  specialities  text[],                        -- spécialités / options Bac
  result        text,                          -- 'ADMIS', 'ADMIS_MENTION_TB'…
  UNIQUE (enrollment_id, session_id)
);

CREATE TABLE exam_document_type (
  code          text PRIMARY KEY,              -- 'PIECE_IDENTITE', 'PHOTO', 'JDC'…
  label         text NOT NULL,
  required_for  exam_code[] NOT NULL
);

CREATE TABLE exam_document (
  registration_id uuid REFERENCES exam_registration(id) ON DELETE CASCADE,
  doc_type      text REFERENCES exam_document_type(code),
  storage_key   text,                          -- objet chiffré (S3 compatible)
  received_at   timestamptz,
  checked_by    uuid REFERENCES app_user(id),
  PRIMARY KEY (registration_id, doc_type)
);

-- Campus France : export des Terminales après les résultats (juillet-août, clôture début sept.)
CREATE TABLE campus_france_campaign (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year_id       uuid UNIQUE NOT NULL REFERENCES academic_year(id),
  opens_on      date NOT NULL,                 -- ex. 2027-07-05
  closes_on     date NOT NULL,                 -- ex. 2027-09-05
  CHECK (closes_on > opens_on)
);

CREATE TABLE campus_france_export (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id   uuid NOT NULL REFERENCES campus_france_campaign(id),
  generated_at  timestamptz NOT NULL DEFAULT now(),
  generated_by  uuid NOT NULL REFERENCES app_user(id),
  file_key      text NOT NULL,                 -- CSV/XLSX généré
  row_count     integer NOT NULL,
  sent_at       timestamptz,
  sent_to       text
);

CREATE TABLE campus_france_entry (
  export_id     uuid REFERENCES campus_france_export(id) ON DELETE CASCADE,
  registration_id uuid REFERENCES exam_registration(id),
  wishes        text,                          -- vœux / filières visées
  PRIMARY KEY (export_id, registration_id)
);

-- -----------------------------------------------------------------------------
-- 7. Évaluations, compétences, bulletins & appréciations
-- -----------------------------------------------------------------------------
-- Règles de notation par année et par site (modifiables dans Paramètres)
CREATE TABLE grading_policy (
  year_id       uuid REFERENCES academic_year(id),
  site_id       uuid REFERENCES site(id),
  min_evaluations smallint NOT NULL DEFAULT 4 CHECK (min_evaluations > 0), -- notes minimum par trimestre
  felicitations_from numeric(4,2) NOT NULL DEFAULT 16,
  compliments_from   numeric(4,2) NOT NULL DEFAULT 14,
  warning_from_subjects smallint NOT NULL DEFAULT 2, -- avertissement proposé si N matières le signalent
  show_rank     boolean NOT NULL DEFAULT false,
  parent_publish_delay_days smallint NOT NULL DEFAULT 1 CHECK (parent_publish_delay_days >= 0), -- Espace Parents
  PRIMARY KEY (year_id, site_id)
);

CREATE TABLE evaluation_type (                 -- DS, Interrogation, Oral, Exposé, Devoir maison, TP…
  code          text PRIMARY KEY,
  label         text NOT NULL,
  is_active     boolean NOT NULL DEFAULT true
);

-- Compétences :
--  - BASE proposée par l'établissement, par matière et par niveau (class_id NULL) ;
--  - compétences de l'ENSEIGNANT pour une classe : reprises de la base (based_on) ou écrites par lui.
CREATE TABLE competency (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id    uuid NOT NULL REFERENCES subject(id),
  level_code    text REFERENCES level(code),   -- base : niveau concerné
  class_id      uuid REFERENCES school_class(id), -- enseignant : classe concernée
  author_id     uuid REFERENCES app_user(id),
  based_on      uuid REFERENCES competency(id), -- reprise d'une compétence de la base
  position      smallint NOT NULL DEFAULT 1,
  label         text NOT NULL,
  CHECK ((class_id IS NULL) = (author_id IS NULL)),
  CHECK ((class_id IS NULL) = (level_code IS NOT NULL))
);
CREATE UNIQUE INDEX competency_base_uq ON competency (subject_id, level_code, label) WHERE class_id IS NULL;
CREATE UNIQUE INDEX competency_teacher_uq ON competency (subject_id, class_id, label) WHERE class_id IS NOT NULL;

CREATE TABLE evaluation (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES teaching_assignment(id),
  period_id     uuid NOT NULL REFERENCES period(id),
  eval_type     text NOT NULL DEFAULT 'DS' REFERENCES evaluation_type(code),
  title         text NOT NULL,
  held_on       date NOT NULL,
  publish_on    date,                          -- publication aux élèves (parents : + délai de l'Espace Parents)
  remarks_enabled boolean NOT NULL DEFAULT false, -- remarques par note, visibles par élèves et parents
  scale_max     numeric(5,2) NOT NULL DEFAULT 20 CHECK (scale_max > 0),
  normalize_to_20 boolean NOT NULL DEFAULT true, -- « Ramener sur 20 » ; sinon la note compte en points
  comment       text,                          -- commentaire visible par les élèves
  themes        text[] NOT NULL DEFAULT '{}',
  CHECK (publish_on IS NULL OR publish_on >= held_on),
  coefficient   numeric(4,2) NOT NULL DEFAULT 1,
  mode          grading_mode NOT NULL DEFAULT 'NUMERIQUE',
  published_at  timestamptz
);

-- Compétences visées par une évaluation (repère, sans note par compétence).
CREATE TABLE evaluation_competency (
  evaluation_id uuid REFERENCES evaluation(id) ON DELETE CASCADE,
  competency_id uuid REFERENCES competency(id),
  position      smallint NOT NULL,
  PRIMARY KEY (evaluation_id, competency_id)
);

-- Bonus / malus du professeur sur la moyenne de sa matière pour un trimestre (participation, travail,
-- comportement…) : par demi-point, au plus ± 2, motif obligatoire ; la moyenne ajustée reste entre 0 et 20.
CREATE TABLE grade_adjustment (
  assignment_id uuid NOT NULL REFERENCES teaching_assignment(id),
  period_id     uuid NOT NULL REFERENCES period(id),
  enrollment_id uuid NOT NULL REFERENCES enrollment(id),
  points        numeric(3,1) NOT NULL CHECK (points <> 0 AND abs(points) <= 2 AND points * 2 = trunc(points * 2)),
  reason        text NOT NULL CHECK (length(trim(reason)) > 0),
  entered_by    uuid NOT NULL REFERENCES app_user(id),
  entered_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (assignment_id, period_id, enrollment_id)
);

CREATE TABLE grade (
  evaluation_id uuid REFERENCES evaluation(id) ON DELETE CASCADE,
  enrollment_id uuid REFERENCES enrollment(id),
  status        grade_status NOT NULL DEFAULT 'NOTE',
  value         numeric(5,2),
  raw_input     text,                          -- saisie brute avant correction (« 1O »)
  remark        text,                          -- remarque sur la note (si activée sur le devoir)
  autocorrected boolean NOT NULL DEFAULT false,
  entered_by    uuid NOT NULL REFERENCES app_user(id),
  entered_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (evaluation_id, enrollment_id),
  CHECK ((status = 'NOTE') = (value IS NOT NULL)),
  CHECK (value IS NULL OR value >= 0)
);

-- Pas d'évaluation individuelle des compétences : le référentiel sert de repère et
-- chaque évaluation indique les compétences qu'elle vise (evaluation_competency) ;
-- l'appréciation globale du trimestre en tient lieu.

-- Validation des notes d'un service (classe × matière) pour un trimestre :
-- verrouille la saisie et alimente la grille du conseil (cf. validate_term()).
CREATE TABLE term_validation (
  assignment_id uuid REFERENCES teaching_assignment(id),
  period_id     uuid REFERENCES period(id),
  validated_at  timestamptz NOT NULL DEFAULT now(),
  validated_by  uuid NOT NULL REFERENCES app_user(id),
  PRIMARY KEY (assignment_id, period_id)
);

-- Parcours d'ouverture : suivi des séances (1 à 2 par mois et par volet).
CREATE TABLE opening_session (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES teaching_assignment(id),
  held_on       date NOT NULL,
  theme         text NOT NULL,
  notes         text
);

CREATE TABLE report_card (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES enrollment(id),
  period_id     uuid NOT NULL REFERENCES period(id),
  general_comment text,                        -- appréciation générale : rédigée par la Direction après le conseil
  general_comment_by uuid REFERENCES app_user(id),
  decision      class_decision,                -- 3e trimestre
  decision_level_code text REFERENCES level(code),
  decision_text text,                          -- « Admis.e en classe de 1re »
  council_mention text CHECK (council_mention IN ('FELICITATIONS', 'COMPLIMENTS', 'ENCOURAGEMENTS',
                  'AVERT_TRAVAIL', 'AVERT_COMPORTEMENT', 'AVERT_TRAVAIL_COMPORTEMENT')),
  published_at  timestamptz,
  UNIQUE (enrollment_id, period_id),
  CHECK (decision_text IS NULL OR decision_text ~ '^(Admis\.e|Retenu\.e|Réorienté\.e) ')
);

-- Avis des enseignants pour le conseil (non imprimés sur le bulletin) : élève exemplaire,
-- bavard.e, avertissement travail / comportement… Utiles si l'enseignant est absent du conseil.
CREATE TABLE council_flag_type (
  code          text PRIMARY KEY,
  label         text NOT NULL,
  tone          text NOT NULL CHECK (tone IN ('POSITIF', 'VIGILANCE', 'ALERTE'))
);

CREATE TABLE council_flag (
  report_card_id uuid REFERENCES report_card(id) ON DELETE CASCADE,
  subject_id    uuid REFERENCES subject(id),
  flag_code     text REFERENCES council_flag_type(code),
  author_id     uuid NOT NULL REFERENCES app_user(id),
  PRIMARY KEY (report_card_id, subject_id, flag_code)
);

CREATE TABLE council_note (                    -- remarque libre pour le conseil
  report_card_id uuid REFERENCES report_card(id) ON DELETE CASCADE,
  subject_id    uuid REFERENCES subject(id),
  author_id     uuid NOT NULL REFERENCES app_user(id),
  body          text NOT NULL,
  PRIMARY KEY (report_card_id, subject_id)
);

CREATE TABLE report_comment (
  report_card_id uuid REFERENCES report_card(id) ON DELETE CASCADE,
  subject_id    uuid REFERENCES subject(id),
  author_id     uuid NOT NULL REFERENCES app_user(id),
  body          text NOT NULL,
  status        comment_status NOT NULL DEFAULT 'BROUILLON',
  ai_assisted   boolean NOT NULL DEFAULT false,
  rule_check    jsonb NOT NULL DEFAULT '{}',   -- résultat du contrôleur de rédaction
  updated_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (report_card_id, subject_id),
  -- un commentaire ne peut être VALIDE que si le contrôleur n'a relevé aucune erreur
  CHECK (status <> 'VALIDE' OR coalesce((rule_check->>'errors')::int, 1) = 0)
);

-- -----------------------------------------------------------------------------
-- 8. Vie scolaire, communication & notifications
-- -----------------------------------------------------------------------------
CREATE TABLE attendance_event (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES enrollment(id),
  kind          notif_reason NOT NULL CHECK (kind IN ('RETARD', 'ABSENCE', 'DISCIPLINE')),
  occurred_at   timestamptz NOT NULL,
  minutes_late  smallint,
  justified     boolean NOT NULL DEFAULT false,
  comment       text,
  recorded_by   uuid NOT NULL REFERENCES app_user(id),
  parent_ack_at timestamptz,                   -- case « Je suis informé.e » cochée par le parent
  parent_ack_by uuid REFERENCES guardian(id),
  CHECK ((parent_ack_at IS NULL) = (parent_ack_by IS NULL))
);

-- Punitions (enseignant, vie scolaire) et sanctions (Direction), toujours motivées.
CREATE TYPE measure_kind AS ENUM ('PUNITION', 'SANCTION');
CREATE TABLE discipline_measure_type (
  code          text PRIMARY KEY,                -- 'RETENUE', 'BLAME'…
  label         text NOT NULL,
  kind          measure_kind NOT NULL
);

CREATE TABLE discipline_measure (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES enrollment(id),
  type_code     text NOT NULL REFERENCES discipline_measure_type(code),
  reason        text NOT NULL CHECK (length(trim(reason)) > 0),
  scheduled_for text,                            -- ex. date et heure de la retenue
  decided_on    date NOT NULL DEFAULT current_date,
  decided_by    uuid NOT NULL REFERENCES app_user(id),
  parent_ack_at timestamptz,
  parent_ack_by uuid REFERENCES guardian(id),
  CHECK ((parent_ack_at IS NULL) = (parent_ack_by IS NULL)),
  -- corrigée : le parent est prévenu à nouveau (son accusé de lecture est remis à zéro par l'application)
  edited_at     timestamptz,
  -- annulée : la mesure reste au dossier avec le motif, mais ne compte plus (passeport, conseil, bulletin)
  cancelled_at  timestamptz,
  cancelled_by  uuid REFERENCES app_user(id),
  cancel_reason text,
  CHECK ((cancelled_at IS NULL) = (cancelled_by IS NULL) AND (cancelled_at IS NULL) = (cancel_reason IS NULL)),
  CHECK (cancel_reason IS NULL OR length(trim(cancel_reason)) > 0)
);

-- Téléphones confisqués : 24 h ou 5 jours ouvrés ; qui a confisqué, qui l'a reçu et signé,
-- restitution (date calculée sur les jours de classe par trigger).
CREATE TABLE phone_confiscation (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES enrollment(id),
  reason        text NOT NULL,
  confiscated_at timestamptz NOT NULL,
  confiscated_by uuid NOT NULL REFERENCES app_user(id), -- enseignant.e ou Direction
  received_by   uuid NOT NULL REFERENCES app_user(id),  -- vie scolaire ou Direction : signe la prise en garde
  duration_code text NOT NULL CHECK (duration_code IN ('24H', '5J')), -- récidive : 5J imposé (trigger)
  return_due_at timestamptz,                     -- calculé
  returned_at   timestamptz,
  returned_by   uuid REFERENCES app_user(id),    -- signe la restitution
  returned_to   text,                            -- nom de la personne qui récupère le téléphone
  returned_to_role text CHECK (returned_to_role IN ('ELEVE', 'PARENT')),
  CHECK ((returned_at IS NULL) = (returned_by IS NULL) AND (returned_at IS NULL) = (returned_to IS NULL)
         AND (returned_at IS NULL) = (returned_to_role IS NULL)),
  -- 5 jours ouvrés : restitution à un responsable légal uniquement
  CHECK (duration_code <> '5J' OR returned_to_role IS DISTINCT FROM 'ELEVE')
);

-- Règles de vie scolaire paramétrables
CREATE TABLE school_life_policy (
  year_id       uuid REFERENCES academic_year(id),
  site_id       uuid REFERENCES site(id),
  ack_reminder_hours smallint NOT NULL DEFAULT 48, -- relance (e-mail + application) si « Je suis informé.e » non coché
  phone_recidive_5j boolean NOT NULL DEFAULT true,  -- 2e confiscation de l'année : 5 jours ouvrés
  PRIMARY KEY (year_id, site_id)
);

-- Autorisations signées par la famille : droit à l'image, autorisation de sortie…
CREATE TABLE authorization_type (
  code          text PRIMARY KEY,
  label         text NOT NULL,
  options       text[] NOT NULL CHECK (cardinality(options) >= 2)
);

CREATE TABLE authorization_answer (
  enrollment_id uuid REFERENCES enrollment(id),
  type_code     text REFERENCES authorization_type(code),
  answer        text NOT NULL,
  guardian_id   uuid NOT NULL REFERENCES guardian(id),
  signed_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (enrollment_id, type_code)
);

-- Documents publiés aux familles (circulaires, règlement…) avec accusé de lecture / signature
CREATE TABLE published_document (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id       uuid NOT NULL REFERENCES site(id),
  class_id      uuid REFERENCES school_class(id), -- NULL = tout le site
  title         text NOT NULL,
  file_key      text NOT NULL,
  requires_signature boolean NOT NULL DEFAULT false,
  published_by  uuid NOT NULL REFERENCES app_user(id),
  published_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE document_receipt (
  document_id   uuid REFERENCES published_document(id) ON DELETE CASCADE,
  guardian_id   uuid REFERENCES guardian(id),
  read_at       timestamptz NOT NULL DEFAULT now(),
  signed_at     timestamptz,
  PRIMARY KEY (document_id, guardian_id)
);

-- Pièces demandées à la famille (dossier d'examen, certificat médical…)
CREATE TABLE requested_document (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES enrollment(id),
  title         text NOT NULL,
  due_on        date NOT NULL,
  file_key      text,                            -- dépôt par la famille
  submitted_at  timestamptz,
  validated_by  uuid REFERENCES app_user(id),    -- vérification par le Bureau / la vie scolaire
  validated_at  timestamptz,
  CHECK (validated_at IS NULL OR submitted_at IS NOT NULL)
);

-- Cahier de textes : contenu de la séance et travail à faire
CREATE TABLE homework (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES teaching_assignment(id),
  session_on    date NOT NULL,
  done_in_class text NOT NULL,
  todo          text,
  due_on        date,
  CHECK ((todo IS NULL) = (due_on IS NULL)),
  CHECK (due_on IS NULL OR due_on > session_on)
);

-- Stages : 3e (observation, 1 semaine) et 2de (2 semaines) ; convention signée par
-- l'entreprise, l'établissement et le responsable légal
CREATE TABLE internship_type (
  code          text PRIMARY KEY,
  level_code    text NOT NULL REFERENCES level(code),
  label         text NOT NULL,
  school_days   smallint NOT NULL CHECK (school_days > 0)
);

CREATE TABLE internship (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES enrollment(id),
  type_code     text NOT NULL REFERENCES internship_type(code),
  title         text NOT NULL,
  company       text NOT NULL,
  tutor         text,
  referent_id   uuid REFERENCES app_user(id),
  starts_on     date NOT NULL,
  ends_on       date NOT NULL,
  signed_company_at timestamptz,
  signed_school_at  timestamptz,
  signed_family_at  timestamptz,
  report_due_on date,
  CHECK (ends_on >= starts_on)
);

-- Orientation : intentions de la famille et avis du conseil, par trimestre
CREATE TABLE orientation_wish (
  enrollment_id uuid REFERENCES enrollment(id),
  period_id     uuid REFERENCES period(id),
  author        text CHECK (author IN ('FAMILLE', 'CONSEIL')),
  rank          smallint CHECK (rank BETWEEN 1 AND 5),
  wish          text NOT NULL,
  PRIMARY KEY (enrollment_id, period_id, author, rank)
);

-- Circuit de publication (annonces, Vie de l'école) : seule la Direction publie.
--   BROUILLON → EN_ATTENTE → PUBLIEE → RETIREE ; EN_ATTENTE → A_REVOIR (remarque) → EN_ATTENTE
CREATE TYPE publication_status AS ENUM ('BROUILLON', 'A_RELIRE', 'EN_ATTENTE', 'A_REVOIR', 'PUBLIEE', 'RETIREE'); -- A_RELIRE : relecture CPE (élèves mandatés)

CREATE TABLE announcement (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title         text NOT NULL,
  body_md       text NOT NULL,
  author_id     uuid NOT NULL REFERENCES app_user(id),
  publish_at    timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz,
  is_pinned     boolean NOT NULL DEFAULT false,
  push_channels notif_channel[] NOT NULL DEFAULT '{}'   -- relais e-mail / application optionnel
);

-- Ciblage granulaire : chaque ligne est un filtre (ET entre colonnes non nulles) ;
-- un destinataire est visé s'il satisfait AU MOINS UNE ligne (OU entre lignes).
--   « Toute l'école »             → (TOUS, NULL, NULL, NULL)
--   « Professeurs »               → (PROFESSEUR, NULL, NULL, NULL)
--   « Parents de Tle à Tamatave » → (PARENT, TMV, TLE, NULL)
--   « 1re STMG A »                → (TOUS, NULL, NULL, <class_id>)
CREATE TABLE announcement_audience (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  announcement_id uuid NOT NULL REFERENCES announcement(id) ON DELETE CASCADE,
  role          audience_role NOT NULL DEFAULT 'TOUS',
  site_id       uuid REFERENCES site(id),
  level_code    text REFERENCES level(code),
  class_id      uuid REFERENCES school_class(id)
);

CREATE TABLE announcement_read (
  announcement_id uuid REFERENCES announcement(id) ON DELETE CASCADE,
  user_id       uuid REFERENCES app_user(id),
  read_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (announcement_id, user_id)
);

-- Notification directe et individuelle à un parent (retard, discipline, pièce manquante…)
CREATE TABLE direct_notification (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guardian_id   uuid NOT NULL REFERENCES guardian(id),
  student_id    uuid REFERENCES student(id),
  reason        notif_reason NOT NULL,
  subject       text NOT NULL,
  body          text NOT NULL,
  channels      notif_channel[] NOT NULL CHECK (cardinality(channels) > 0),
  sent_by       uuid REFERENCES app_user(id),  -- NULL = automate (relance de frais de scolarité)
  dunning_case_id uuid REFERENCES dunning_case(id),
  attendance_event_id uuid REFERENCES attendance_event(id),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE notification_delivery (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  notification_id uuid NOT NULL REFERENCES direct_notification(id) ON DELETE CASCADE,
  channel       notif_channel NOT NULL,
  status        delivery_status NOT NULL DEFAULT 'EN_ATTENTE',
  provider_ref  text,
  attempts      smallint NOT NULL DEFAULT 0,
  last_error    text,
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 9. Journal d'audit (toutes les actions sensibles : finances, notes, transferts)
-- -----------------------------------------------------------------------------
CREATE TABLE audit_log (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  occurred_at   timestamptz NOT NULL DEFAULT now(),
  actor_id      uuid REFERENCES app_user(id),
  action        text NOT NULL,                 -- 'TRANSFER.EXECUTE', 'GRADE.UPDATE'…
  entity        text NOT NULL,
  entity_id     text NOT NULL,
  before_data   jsonb,
  after_data    jsonb,
  ip            inet
);
CREATE INDEX audit_entity_idx ON audit_log (entity, entity_id);

-- =====  FICHE SIGNALÉTIQUE EN LIGNE ET SIGNATURES DES PARENTS  =====
-- Chaque compte parent dépose UNE signature de référence (au doigt, dans l'application).
-- Elle signe ses documents dans l'ENT et sert au bureau de point de comparaison
-- avec un mot ou une autorisation papier en cas de doute.
CREATE TABLE guardian_signature (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guardian_id   uuid NOT NULL REFERENCES guardian(id),
  image_key     text NOT NULL,                 -- fichier PNG dans le stockage chiffré
  deposited_at  timestamptz NOT NULL DEFAULT now(),
  replaced_at   timestamptz,                   -- changement : au bureau, après contrôle d'identité
  replaced_by   uuid REFERENCES app_user(id),
  CHECK ((replaced_at IS NULL) = (replaced_by IS NULL))
);
CREATE UNIQUE INDEX guardian_signature_reference ON guardian_signature (guardian_id) WHERE replaced_at IS NULL;

-- Fiche signalétique annuelle : remplie et signée par le parent, validée par le bureau.
CREATE TABLE student_record_form (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES enrollment(id),
  data          jsonb NOT NULL,                -- champs de la fiche (élève, fratrie, responsables, santé…)
  auth_image    boolean NOT NULL,
  auth_hospital boolean NOT NULL,
  accepted_terms boolean NOT NULL CHECK (accepted_terms), -- règlement et dispositions financières
  signed_place  text NOT NULL,
  signed_at     timestamptz NOT NULL DEFAULT now(),
  validated_by  uuid REFERENCES app_user(id),
  validated_at  timestamptz,
  UNIQUE (enrollment_id),
  CHECK ((validated_by IS NULL) = (validated_at IS NULL))
);

-- Signatures portées par une fiche : 1 ou 2 responsables, chacun depuis son propre compte.
CREATE TABLE student_record_signature (
  form_id       uuid REFERENCES student_record_form(id) ON DELETE CASCADE,
  guardian_id   uuid REFERENCES guardian(id),
  signature_id  uuid NOT NULL REFERENCES guardian_signature(id),
  signed_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (form_id, guardian_id)
);

-- =====  CONTRÔLE DE CAISSE  =====
-- Un reçu n'est jamais supprimé : son annulation est demandée avec un motif, puis validée
-- ou refusée par la Direction (qui, quand, pourquoi).
CREATE TABLE payment_cancellation (
  payment_id    uuid PRIMARY KEY REFERENCES payment(id),
  reason        text NOT NULL CHECK (length(trim(reason)) >= 10),
  requested_by  uuid NOT NULL REFERENCES app_user(id),
  requested_at  timestamptz NOT NULL DEFAULT now(),
  decided_by    uuid REFERENCES app_user(id),
  decided_at    timestamptz,
  approved      boolean,
  decision_note text,
  CHECK ((decided_by IS NULL) = (decided_at IS NULL) AND (decided_by IS NULL) = (approved IS NULL)),
  CHECK (approved IS DISTINCT FROM false OR length(trim(coalesce(decision_note, ''))) >= 5)
);

-- Clôture quotidienne des espèces : comptage par billet, écart expliqué. Après clôture,
-- plus aucun encaissement ce jour-là sur ce site.
CREATE TABLE cash_closing (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id       uuid NOT NULL REFERENCES site(id),
  day           date NOT NULL,
  expected_mga  bigint NOT NULL,
  counted_mga   bigint NOT NULL CHECK (counted_mga >= 0),
  counts        jsonb NOT NULL,                -- { "20000": 12, "5000": 3, … }
  explanation   text,
  closed_by     uuid NOT NULL REFERENCES app_user(id),
  closed_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (site_id, day),
  CHECK (counted_mga = expected_mga OR length(trim(coalesce(explanation, ''))) >= 10)
);

-- Versements des espèces sur le compte bancaire de l'école (bordereau obligatoire).
-- Jours de versement prévus (ex. mercredi après-midi et vendredi après les cours) : rappel au bureau,
-- alerte à la Direction si le versement n'est pas saisi.
CREATE TABLE deposit_schedule (
  site_id       uuid PRIMARY KEY REFERENCES site(id),
  weekdays      smallint[] NOT NULL CHECK (weekdays <@ ARRAY[1,2,3,4,5,6]::smallint[] AND cardinality(weekdays) > 0),
  cash_threshold_mga bigint NOT NULL DEFAULT 2500000
);

CREATE TABLE bank_deposit (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id       uuid NOT NULL REFERENCES site(id),
  amount_mga    bigint NOT NULL CHECK (amount_mga > 0),
  bank_name     text NOT NULL,
  slip_no       text NOT NULL CHECK (length(trim(slip_no)) > 0),
  deposited_on  date NOT NULL,
  recorded_by   uuid NOT NULL REFERENCES app_user(id),
  recorded_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bank_name, slip_no)
);

-- =====  RÉDUCTIONS  =====
-- Types et taux fixés par la Direction ; accordées élève par élève avec un motif.
CREATE TABLE reduction_type (
  code          text PRIMARY KEY,              -- 'REDOUBLANT_TLE', 'PROCHE', 'PERSONNEL' (pas de fratrie)
  label         text NOT NULL,
  -- taux en % : frais de scolarité mensuels et inscription / réinscription ; tout le reste à 100 %
  -- NULL = taux à définir (réduction non attribuable)
  rate_tuition  numeric CHECK (rate_tuition BETWEEN 0 AND 100),
  rate_enrollment numeric CHECK (rate_enrollment BETWEEN 0 AND 100)
);
CREATE TABLE enrollment_reduction (
  enrollment_id uuid PRIMARY KEY REFERENCES enrollment(id),
  type_code     text NOT NULL REFERENCES reduction_type(code),
  motif         text NOT NULL CHECK (length(trim(motif)) >= 5),
  granted_by    uuid NOT NULL REFERENCES app_user(id),
  granted_at    timestamptz NOT NULL DEFAULT now()
);

-- =====  MANUELS SCOLAIRES  =====
CREATE TYPE textbook_condition AS ENUM ('NEUF', 'BON', 'USE', 'DECHIRE');
CREATE TABLE textbook (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id       uuid NOT NULL REFERENCES site(id),
  title         text NOT NULL,
  subject       text NOT NULL,
  level_codes   text[] NOT NULL,
  category      text NOT NULL CHECK (category IN ('MANUEL', 'CAHIER')),
  is_returnable boolean NOT NULL,              -- à rendre (location) ou gardé par l'élève (vendu)
  specialty     specialty_code,                -- manuel de spécialité : seuls les élèves qui la suivent
  is_photocopy  boolean NOT NULL,              -- original ou photocopie
  binding       text NOT NULL CHECK (binding IN ('DOS_CARRE', 'RELIURE')),
  price_mga     bigint NOT NULL CHECK (price_mga > 0), -- location / an (à rendre) ou prix de vente (gardé)
  replacement_price_mga bigint,                -- à payer si perdu ou rendu abîmé
  CHECK (NOT is_returnable OR coalesce(replacement_price_mga, 0) > 0),
  CHECK (is_returnable OR replacement_price_mga IS NULL)
);
-- Exemplaires en réserve, par état
CREATE TABLE textbook_stock (
  textbook_id   uuid REFERENCES textbook(id),
  condition     textbook_condition,
  quantity      int NOT NULL CHECK (quantity >= 0),
  PRIMARY KEY (textbook_id, condition)
);
CREATE TABLE textbook_loan (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  textbook_id   uuid NOT NULL REFERENCES textbook(id),
  enrollment_id uuid NOT NULL REFERENCES enrollment(id),
  state_out     textbook_condition NOT NULL CHECK (state_out <> 'DECHIRE'),
  issued_on     date NOT NULL,
  due_back      date,                          -- NULL : cahier gardé par l'élève (rien à rendre)
  state_in      textbook_condition,            -- NULL : non rendu
  returned_on   date,
  lost_on       date,                          -- perdu
  charge_payment_id uuid REFERENCES payment(id), -- règlement « Manuel perdu ou endommagé »
  CHECK ((state_in IS NULL) = (returned_on IS NULL)),
  CHECK (NOT (lost_on IS NOT NULL AND returned_on IS NOT NULL))
);
-- Un seul exemplaire d'un même manuel en cours de prêt par élève
CREATE UNIQUE INDEX textbook_loan_open ON textbook_loan (textbook_id, enrollment_id) WHERE returned_on IS NULL AND lost_on IS NULL;

-- =====  REMISE DES BULLETINS EN MAIN PROPRE  =====
-- Les bulletins ne sont jamais publiés dans l'application : ils sont remis tamponnés.
CREATE TABLE bulletin_handover (
  enrollment_id uuid REFERENCES enrollment(id),
  term          smallint CHECK (term BETWEEN 1 AND 3),
  given_at      timestamptz,
  given_to      text,                          -- « l'élève », « Mme Rabe (mère) »…
  given_by      uuid REFERENCES app_user(id),
  override_by   uuid REFERENCES app_user(id),  -- Direction : remise malgré un blocage
  override_reason text,
  PRIMARY KEY (enrollment_id, term),
  CHECK ((given_at IS NULL) = (given_by IS NULL) AND (given_at IS NULL) = (given_to IS NULL)),
  CHECK ((override_by IS NULL) = (override_reason IS NULL))
);

-- =====  SALAIRES DU PERSONNEL  =====
-- Rubrique de sortie à part : état de paie mensuel validé par la Direction, payé par le Bureau.
-- En espèces : émargement (signature) du salarié et sortie de caisse « Salaires ».
-- Taux horaires des professeurs vacataires, avec leur date d'effet (historique des augmentations).
-- Fixés par la Direction ; confidentiels.
CREATE TABLE hourly_rate (
  staff_id      uuid REFERENCES staff_member(id),
  effective_from date,
  rate_mga      bigint NOT NULL CHECK (rate_mga > 0),
  set_by        uuid REFERENCES app_user(id),
  PRIMARY KEY (staff_id, effective_from)
);

CREATE TABLE payroll_month (
  site_id       uuid REFERENCES site(id),
  month         date CHECK (extract(day FROM month) = 1),
  validated_by  uuid REFERENCES app_user(id),   -- facultatif : « vu par la Direction » (ne bloque pas la paie)
  validated_at  timestamptz,
  PRIMARY KEY (site_id, month),
  CHECK ((validated_by IS NULL) = (validated_at IS NULL))
);
CREATE TABLE payroll_line (
  site_id       uuid,
  month         date,
  staff_id      uuid REFERENCES staff_member(id),
  -- professeurs : heures de cours effectuées face aux élèves × taux horaire ; autres : salaire mensuel
  hours_done    numeric CHECK (hours_done >= 0),
  hours_planned numeric CHECK (hours_planned >= 0), -- d'après l'emploi du temps
  hourly_mga    bigint CHECK (hourly_mga > 0),
  monthly_mga   bigint CHECK (monthly_mga > 0),
  net_mga       bigint GENERATED ALWAYS AS (coalesce(round(hours_done * hourly_mga)::bigint, monthly_mga)) STORED,
  method        payment_method NOT NULL DEFAULT 'ESPECES' CHECK (method IN ('ESPECES', 'VIREMENT')),
  paid_at       timestamptz,
  paid_by       uuid REFERENCES app_user(id),
  signature_key text,                          -- émargement (espèces)
  transfer_ref  text,                          -- référence du virement
  cash_movement_id uuid REFERENCES cash_movement(id),
  PRIMARY KEY (site_id, month, staff_id),
  FOREIGN KEY (site_id, month) REFERENCES payroll_month(site_id, month),
  CHECK ((hourly_mga IS NULL) = (hours_done IS NULL) AND (hourly_mga IS NULL) <> (monthly_mga IS NULL)),
  CHECK ((paid_at IS NULL) = (paid_by IS NULL)),
  CHECK (paid_at IS NULL OR method <> 'ESPECES' OR signature_key IS NOT NULL),
  CHECK (paid_at IS NULL OR method <> 'VIREMENT' OR transfer_ref IS NOT NULL)
);

-- =====  ENGAGEMENTS DE L'ÉLÈVE (bulletin, livret, Parcoursup)  =====
-- Élèves candidats libres, sans livret scolaire : le bulletin porte les engagements et les
-- attestations de l'établissement (internes, non officielles : ASSR 1 et 2, compétences numériques).
CREATE TYPE engagement_code AS ENUM ('DELEGUE', 'SUPPLEANT', 'ECO_DELEGUE', 'BDE', 'BDE_PRESIDENT', 'TUTEUR', 'SPORT', 'PSC1',
  'ASSR1', 'ASSR2', 'NUMERIQUE');
CREATE TABLE student_engagement (
  enrollment_id uuid REFERENCES enrollment(id),
  code          engagement_code,
  PRIMARY KEY (enrollment_id, code)
);

-- =====  BIBLIOTHÈQUE DE LA SALLE D'ÉTUDE / PERMANENCE (pas de CDI)  =====
CREATE TABLE library_book (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id       uuid NOT NULL REFERENCES site(id),
  kind          text NOT NULL CHECK (kind IN ('ROMAN', 'ANNALES', 'DOCUMENTAIRE', 'REFERENCE', 'BD')),
  title         text NOT NULL,
  author        text,
  editor        text NOT NULL,
  collection    text,
  year          smallint,
  isbn          text CHECK (isbn IS NULL OR isbn ~ '^[0-9]{9}[0-9X]$|^97[89][0-9]{10}$')
);
-- Un exemplaire = une étiquette (cote) : ROM-0012, ANN-0003…
CREATE TABLE library_copy (
  code          text PRIMARY KEY CHECK (code ~ '^(ROM|ANN|DOC|REF|BD)-[0-9]{4}$'),
  book_id       uuid NOT NULL REFERENCES library_book(id),
  condition     textbook_condition NOT NULL DEFAULT 'BON'
);
CREATE TABLE library_loan (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  copy_code     text NOT NULL REFERENCES library_copy(code),
  enrollment_id uuid REFERENCES enrollment(id),        -- élève
  staff_id      uuid REFERENCES staff_member(id),       -- professeur
  out_on        date NOT NULL,
  due_on        date,                                   -- élève : un mois ; professeur : NULL
  renewals      smallint NOT NULL DEFAULT 0,
  returned_on   date,
  CHECK ((enrollment_id IS NULL) <> (staff_id IS NULL)),
  CHECK (staff_id IS NULL OR due_on IS NULL),
  CHECK (enrollment_id IS NULL OR due_on IS NOT NULL)
);
CREATE UNIQUE INDEX library_loan_open ON library_loan (copy_code) WHERE returned_on IS NULL;

-- =====  AVIS DU PILOTE (« Donner mon avis »)  =====
CREATE TABLE feedback (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES app_user(id),
  role          role_code NOT NULL,
  screen        text NOT NULL,                 -- écran d'où l'avis est envoyé
  kind          text NOT NULL CHECK (kind IN ('PROBLEME', 'IDEE', 'QUESTION')),
  message       text NOT NULL CHECK (length(trim(message)) >= 5),
  photo_key     text,
  status        text NOT NULL DEFAULT 'NOUVEAU' CHECK (status IN ('NOUVEAU', 'EN_COURS', 'TRAITE')),
  follow_up     text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- =====  FAMILLES EN AUTONOMIE : ACCÈS, PHOTO, DEMANDES EN LIGNE  =====
-- Photo d'identité de l'élève (prise à l'inscription ou déposée par la famille)
ALTER TABLE student ADD COLUMN photo_key text;

-- Un accès par responsable légal : deux parents = deux comptes, chacun son code personnel,
-- sa signature et ses accusés de lecture (guardian.user_id est déjà unique). Un parent sans
-- e-mail se connecte avec son téléphone : le compte exige l'un ou l'autre.
ALTER TABLE app_user ALTER COLUMN email DROP NOT NULL;
ALTER TABLE app_user ADD CONSTRAINT app_user_identifier CHECK (email IS NOT NULL OR phone_e164 IS NOT NULL);
CREATE TABLE guardian_access_code (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guardian_id   uuid NOT NULL REFERENCES guardian(id) ON DELETE CASCADE,
  code_hash     text NOT NULL,                 -- jamais le code en clair
  issued_by     uuid NOT NULL REFERENCES app_user(id),
  issued_at     timestamptz NOT NULL DEFAULT now(),
  used_at       timestamptz,                   -- première connexion : le parent choisit son mot de passe
  revoked_at    timestamptz                    -- code perdu : le bureau en remet un nouveau
);
CREATE UNIQUE INDEX guardian_access_code_active ON guardian_access_code (guardian_id) WHERE used_at IS NULL AND revoked_at IS NULL;

-- Pré-inscription envoyée par une nouvelle famille depuis le formulaire public
ALTER TABLE pre_registration ADD COLUMN channel text NOT NULL DEFAULT 'BUREAU' CHECK (channel IN ('BUREAU', 'EN_LIGNE'));

-- Demandes d'une famille déjà inscrite : réinscription, mise à jour de ses informations,
-- dépôt d'une pièce. Le bureau valide (les données passent dans la fiche) ou refuse avec un motif.
CREATE TYPE family_request_kind AS ENUM ('REINSCRIPTION', 'MISE_A_JOUR', 'PIECE', 'RDV', 'DISPENSE_EPS'); -- RDV, dispense d'EPS : passeport de vie scolaire
CREATE TYPE family_request_status AS ENUM ('A_TRAITER', 'VALIDEE', 'REFUSEE');
CREATE TABLE family_request (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind          family_request_kind NOT NULL,
  student_id    uuid NOT NULL REFERENCES student(id),
  submitted_by  uuid NOT NULL REFERENCES guardian(id),
  payload       jsonb NOT NULL DEFAULT '{}',   -- données proposées (classe, téléphones, santé…)
  submitted_at  timestamptz NOT NULL DEFAULT now(),
  status        family_request_status NOT NULL DEFAULT 'A_TRAITER',
  decided_by    uuid REFERENCES app_user(id),
  decided_at    timestamptz,
  decision_note text,
  CHECK ((status = 'A_TRAITER') = (decided_by IS NULL)),
  CHECK (status <> 'REFUSEE' OR decision_note IS NOT NULL),
  CHECK (kind <> 'REINSCRIPTION' OR payload ->> 'decision' IN ('REINSCRIT', 'DEPART'))
);
-- Pièces déposées (photo ou PDF), rattachées à une demande ou à une pré-inscription en ligne
CREATE TABLE family_document (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id    uuid REFERENCES family_request(id) ON DELETE CASCADE,
  pre_registration_id uuid REFERENCES pre_registration(id) ON DELETE CASCADE,
  document_code text NOT NULL CHECK (document_code IN ('ACTE', 'PHOTOS', 'BULLETINS', 'RADIATION', 'VACCINS', 'AUTRE')),
  file_key      text NOT NULL,
  uploaded_at   timestamptz NOT NULL DEFAULT now(),
  checked_by    uuid REFERENCES app_user(id),
  CHECK ((request_id IS NULL) <> (pre_registration_id IS NULL))
);

-- =====  DOCUMENTS SIGNÉS PAR LA DIRECTION (certificat de scolarité…)  =====
-- Signature numérique de chaque membre de la Direction et tampon de l'établissement (images).
CREATE TABLE official_signature (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES app_user(id),
  image_key     text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  revoked_at    timestamptz
);
CREATE UNIQUE INDEX official_signature_active ON official_signature (user_id) WHERE revoked_at IS NULL;
CREATE TABLE school_stamp (
  site_id       uuid PRIMARY KEY REFERENCES site(id),
  image_key     text NOT NULL,
  updated_at    timestamptz NOT NULL DEFAULT now()
);
-- Le bureau ou la vie scolaire demande ; la Direction (même absente) signe depuis son téléphone ;
-- le document revient au bureau pour être imprimé et tamponné, ou envoyé par e-mail avec le
-- tampon numérique. Le code de vérification imprimé permet de contrôler l'authenticité.
CREATE TYPE signature_status AS ENUM ('DEMANDEE', 'SIGNEE', 'REFUSEE');
CREATE TABLE signature_request (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_kind text NOT NULL CHECK (document_kind IN ('CERTIFICAT_SCOLARITE', 'ATTESTATION', 'AUTRE')),
  student_id    uuid REFERENCES student(id),
  requested_by  uuid NOT NULL REFERENCES app_user(id),
  requested_at  timestamptz NOT NULL DEFAULT now(),
  reason        text,
  status        signature_status NOT NULL DEFAULT 'DEMANDEE',
  signed_by     uuid REFERENCES app_user(id),
  signature_id  uuid REFERENCES official_signature(id),
  signed_at     timestamptz,
  refusal_note  text,
  verification_code text UNIQUE,              -- XXXX-XXXX, imprimé sur le document
  printed_at    timestamptz,
  sent_to       citext,                        -- envoi par e-mail du PDF signé et tamponné
  sent_at       timestamptz,
  CHECK ((status = 'SIGNEE') = (signature_id IS NOT NULL)),
  CHECK (status <> 'REFUSEE' OR refusal_note IS NOT NULL),
  CHECK ((sent_at IS NULL AND printed_at IS NULL) OR status = 'SIGNEE')
);

-- =====  TRÉSORERIE : FOURNISSEURS ET DÉPENSES  =====
-- Catégories de dépenses : liste modifiable par la Direction (pas une liste figée).
CREATE TABLE expense_category (
  code          text PRIMARY KEY,
  label         text NOT NULL,
  is_active     boolean NOT NULL DEFAULT true
);
CREATE TABLE supplier (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id       uuid NOT NULL REFERENCES site(id),
  name          text NOT NULL,
  category_code text REFERENCES expense_category(code),
  contact       text,
  note          text,
  is_active     boolean NOT NULL DEFAULT true
);
CREATE TYPE expense_status AS ENUM ('PAYE', 'EN_ATTENTE', 'ANNULE');
-- Montant en Ariary entiers, toujours positif ; photo de la facture obligatoire au-delà de 100 000 Ar.
-- Une dépense payée en espèces est liée à sa sortie de caisse (comptée une seule fois).
CREATE TABLE expense (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id       uuid NOT NULL REFERENCES site(id),
  supplier_id   uuid REFERENCES supplier(id),
  category_code text NOT NULL REFERENCES expense_category(code),
  label         text NOT NULL,
  amount_mga    bigint NOT NULL CHECK (amount_mga > 0),
  status        expense_status NOT NULL DEFAULT 'EN_ATTENTE',
  paid_on       date,
  due_on        date,
  method        payment_method,
  reference     text,
  attachment_key text,                         -- photo ou PDF de la facture
  cash_movement_id uuid REFERENCES cash_movement(id),
  created_by    uuid NOT NULL REFERENCES app_user(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  CHECK (status <> 'PAYE' OR (paid_on IS NOT NULL AND method IS NOT NULL)),
  CHECK (status <> 'EN_ATTENTE' OR due_on IS NOT NULL),
  CHECK (status <> 'PAYE' OR amount_mga <= 100000 OR attachment_key IS NOT NULL)
);

-- =====  AJUSTEMENTS DE L'ÉTABLISSEMENT (pilote Tamatave)  =====
-- Matricule par année : code de la classe + numéro dans l'ordre des inscriptions définitives
-- (TG-001, TSTMG-002…) ; jamais réattribué, même si l'élève part.
ALTER TABLE enrollment ADD COLUMN matricule text CHECK (matricule ~ '^[0-9A-Z]+-[0-9]{3}$');
CREATE UNIQUE INDEX enrollment_matricule ON enrollment (year_id, matricule);
-- Nationalité « Autre » précisée ; prénom d'usage (élève qui a plusieurs prénoms)
ALTER TABLE student ADD COLUMN other_nationality text, ADD COLUMN usual_first_name text;

-- Téléphones : un avertissement (téléphone non pris) ou une confiscation de 24 h, 48 h ou 5 jours
-- ouvrés ; le propriétaire peut être un autre élève que celui pris avec le téléphone.
ALTER TABLE phone_confiscation ALTER COLUMN duration_code DROP NOT NULL;
ALTER TABLE phone_confiscation DROP CONSTRAINT phone_confiscation_duration_code_check;
ALTER TABLE phone_confiscation
  ADD COLUMN action text NOT NULL DEFAULT 'CONFISCATION' CHECK (action IN ('AVERTISSEMENT', 'CONFISCATION')),
  ADD COLUMN owner_enrollment_id uuid REFERENCES enrollment(id),
  ADD CONSTRAINT phone_duration_by_action CHECK ((action = 'CONFISCATION') = (duration_code IS NOT NULL)),
  ADD CONSTRAINT phone_duration_code CHECK (duration_code IN ('24H', '48H', '5J')),
  ADD CONSTRAINT phone_received_only_if_kept CHECK (action = 'CONFISCATION' OR returned_at IS NULL);
ALTER TABLE phone_confiscation ALTER COLUMN received_by DROP NOT NULL;
ALTER TABLE phone_confiscation ADD CONSTRAINT phone_received_by CHECK (action = 'AVERTISSEMENT' OR received_by IS NOT NULL);

-- Appréciation générale : tapée par le secrétariat ou la Direction, validée par la Direction seule
ALTER TABLE report_card
  ADD COLUMN general_comment_status comment_status NOT NULL DEFAULT 'BROUILLON',
  ADD COLUMN general_comment_validated_by uuid REFERENCES app_user(id),
  ADD CONSTRAINT general_comment_validated CHECK ((general_comment_status = 'VALIDE') = (general_comment_validated_by IS NOT NULL));

-- Retrait des bulletins : disponibles à partir d'une date, délai de retrait ; passé le délai,
-- le bulletin est archivé au dossier et remis sur rendez-vous (pas de destruction).
CREATE TABLE bulletin_release (
  period_id     uuid REFERENCES period(id),
  class_id      uuid REFERENCES school_class(id),
  available_from date NOT NULL,
  pickup_days   smallint NOT NULL DEFAULT 14 CHECK (pickup_days BETWEEN 1 AND 60),
  announced_at  timestamptz,
  set_by        uuid NOT NULL REFERENCES app_user(id),
  PRIMARY KEY (period_id, class_id)
);

-- Poursuite d'études : une piste par pays (la France en plan B conseillée), étapes cochées, clôture avec motif
CREATE TABLE orientation_track (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES enrollment(id),
  destination   text NOT NULL CHECK (destination IN ('FRANCE', 'CANADA', 'BELGIQUE', 'MAURICE', 'MADAGASCAR', 'AFRIQUE_SUD', 'AUTRE')),
  label         text,                          -- pays, si « Autre »
  steps_done    jsonb NOT NULL DEFAULT '{}',
  closed_on     date,
  close_reason  text,
  CHECK ((closed_on IS NULL) = (close_reason IS NULL)),
  CHECK (destination <> 'AUTRE' OR label IS NOT NULL)
);
CREATE UNIQUE INDEX orientation_track_open ON orientation_track (enrollment_id, destination) WHERE closed_on IS NULL AND destination <> 'AUTRE';

-- Agendas : événements de l'école (les cours viennent de l'emploi du temps, les devoirs du cahier de
-- textes) ; un lien d'abonnement personnel par agenda pour Google Agenda / Apple Agenda.
CREATE TABLE school_event (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id       uuid NOT NULL REFERENCES site(id),
  title         text NOT NULL,
  starts_at     timestamptz NOT NULL,
  ends_at       timestamptz NOT NULL,
  all_day       boolean NOT NULL DEFAULT false,
  place         text,
  class_id      uuid REFERENCES school_class(id),   -- NULL : toute l'école
  -- ECOLE : tous ; EXAMENS : classes d'examen (3e, 1re, Terminale) et personnel ; EQUIPE : personnel seulement
  calendar      text NOT NULL DEFAULT 'ECOLE' CHECK (calendar IN ('ECOLE', 'EXAMENS', 'EQUIPE')),
  created_by    uuid NOT NULL REFERENCES app_user(id),
  CHECK (ends_at >= starts_at)
);
CREATE TABLE calendar_feed (
  user_id       uuid REFERENCES app_user(id) ON DELETE CASCADE,
  agenda        text CHECK (agenda IN ('COURS', 'EVENEMENTS', 'DEVOIRS')),
  token         text UNIQUE NOT NULL,          -- lien secret, révocable
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, agenda)
);

-- Campagne de pré-inscription en ligne : ouverte entre deux dates fixées par la Direction (ex. en mai)
CREATE TABLE pre_registration_campaign (
  site_id       uuid REFERENCES site(id),
  school_year   text CHECK (school_year ~ '^[0-9]{4}-[0-9]{4}$'),
  opens_on      date NOT NULL,
  closes_on     date NOT NULL,
  PRIMARY KEY (site_id, school_year),
  CHECK (closes_on >= opens_on)
);

-- Réservations de livres (élèves et professeurs ; les parents consultent seulement le catalogue).
-- Mis de côté jusqu'à 2 jours après la date choisie ; sinon liste d'attente, dans l'ordre des demandes.
CREATE TABLE library_reservation (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id       uuid NOT NULL REFERENCES library_book(id),
  enrollment_id uuid REFERENCES enrollment(id),        -- élève
  staff_id      uuid REFERENCES staff_member(id),       -- professeur
  wanted_on     date NOT NULL,
  requested_at  timestamptz NOT NULL DEFAULT now(),
  status        text NOT NULL DEFAULT 'ATTENTE' CHECK (status IN ('ATTENTE', 'A_RETIRER', 'REMISE', 'ANNULEE', 'EXPIREE')),
  hold_until    date,
  loan_id       uuid REFERENCES library_loan(id),
  CHECK ((enrollment_id IS NULL) <> (staff_id IS NULL)),
  CHECK ((status = 'A_RETIRER') = (hold_until IS NOT NULL) OR status IN ('REMISE', 'EXPIREE', 'ANNULEE')),
  CHECK (status <> 'REMISE' OR loan_id IS NOT NULL),
  CHECK (wanted_on <= requested_at::date + 30)
);
CREATE UNIQUE INDEX library_reservation_one_per_person ON library_reservation (book_id, coalesce(enrollment_id, staff_id)) WHERE status IN ('ATTENTE', 'A_RETIRER');

-- =====  HEURES DES PROFESSEURS, ABSENCES, RESSOURCES INTERNES  =====
-- Absence d'un professeur, séance par séance (d'après l'emploi du temps) : il laisse un devoir ou une
-- activité, distribué par la vie scolaire qui surveille ; « rien laissé » est signalé à la Direction.
-- Les heures d'absence ne sont pas payées (vacataires).
CREATE TABLE teacher_absence (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id       uuid NOT NULL REFERENCES timetable_slot(id),
  on_date       date NOT NULL,
  reason        text NOT NULL CHECK (length(trim(reason)) > 0),
  work_kind     text NOT NULL CHECK (work_kind IN ('DEVOIR', 'ACTIVITE', 'AUCUN')),
  work_text     text,
  work_file_key text,
  declared_by   uuid NOT NULL REFERENCES app_user(id),
  declared_at   timestamptz NOT NULL DEFAULT now(),
  supervised_by uuid REFERENCES app_user(id),  -- vie scolaire
  UNIQUE (slot_id, on_date),
  CHECK (work_kind = 'AUCUN' OR work_text IS NOT NULL OR work_file_key IS NOT NULL)
);

-- Ressources internes : consultables par les professeurs ou par tout le personnel, jamais par les
-- familles ; pas de téléchargement (le serveur ne sert que des pages filigranées) ; chaque
-- consultation est tracée.
CREATE TABLE internal_resource (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id       uuid NOT NULL REFERENCES site(id),
  title         text NOT NULL,
  audience      text NOT NULL CHECK (audience IN ('PROFS', 'PERSONNEL')),
  file_key      text,
  body          text,
  shared_by     uuid NOT NULL REFERENCES app_user(id),
  shared_at     timestamptz NOT NULL DEFAULT now(),
  CHECK (file_key IS NOT NULL OR body IS NOT NULL)
);
CREATE TABLE internal_resource_view (
  resource_id   uuid REFERENCES internal_resource(id) ON DELETE CASCADE,
  viewer_id     uuid REFERENCES app_user(id),
  viewed_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (resource_id, viewer_id, viewed_at)
);

-- Absence de plusieurs jours : la Direction peut dispenser de laisser du travail (NON_REQUIS)
ALTER TABLE teacher_absence DROP CONSTRAINT teacher_absence_work_kind_check, DROP CONSTRAINT teacher_absence_check,
  ADD CONSTRAINT teacher_absence_work_given CHECK (work_kind NOT IN ('DEVOIR', 'ACTIVITE') OR work_text IS NOT NULL OR work_file_key IS NOT NULL);
ALTER TABLE teacher_absence ADD CONSTRAINT teacher_absence_work_kind_check CHECK (work_kind IN ('DEVOIR', 'ACTIVITE', 'NON_REQUIS', 'AUCUN')),
  ADD COLUMN granted_by uuid REFERENCES app_user(id),
  ADD CONSTRAINT teacher_absence_granted CHECK ((work_kind = 'NON_REQUIS') = (granted_by IS NOT NULL));
-- Une absence n'est pas annoncée aux familles : les élèves viennent, en étude surveillée.

-- Retards des professeurs (pointage) et heures rattrapées : une heure de retard cumulée = une heure à rattraper
CREATE TABLE teacher_lateness (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id    uuid NOT NULL REFERENCES app_user(id),
  on_date       date NOT NULL,
  minutes       smallint NOT NULL CHECK (minutes BETWEEN 1 AND 240),
  recorded_by   uuid NOT NULL REFERENCES app_user(id)
);
CREATE TABLE teacher_makeup (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id    uuid NOT NULL REFERENCES app_user(id),
  on_date       date NOT NULL,
  hours         numeric(3,1) NOT NULL DEFAULT 1 CHECK (hours > 0),
  note          text,
  recorded_by   uuid NOT NULL REFERENCES app_user(id)
);

-- Ressources internes : un document, un lien ou un texte
ALTER TABLE internal_resource ADD COLUMN url text CHECK (url IS NULL OR url ~ '^https?://'),
  DROP CONSTRAINT internal_resource_check,
  ADD CONSTRAINT internal_resource_content CHECK (file_key IS NOT NULL OR body IS NOT NULL OR url IS NOT NULL);

-- Jeux de société de la salle d'étude : le cahier des sorties en ligne
CREATE TABLE board_game (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id       uuid NOT NULL REFERENCES site(id),
  name          text NOT NULL,
  pieces        text,                          -- contenu de la boîte (pour vérifier au retour)
  copies        smallint NOT NULL DEFAULT 1 CHECK (copies > 0),
  condition     textbook_condition NOT NULL DEFAULT 'BON'
);
CREATE TABLE board_game_use (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id       uuid NOT NULL REFERENCES board_game(id),
  class_id      uuid REFERENCES school_class(id),
  players       text NOT NULL,
  out_at        timestamptz NOT NULL DEFAULT now(),
  back_at       timestamptz,
  complete      boolean,
  incident      text,                          -- pièce manquante, jeu abîmé
  resolved_at   timestamptz,
  CHECK ((back_at IS NULL) = (complete IS NULL)),
  CHECK (complete IS DISTINCT FROM false OR incident IS NOT NULL)
);

-- Documents par public : élèves, parents, professeurs, personnel (un ou plusieurs). Les documents des
-- familles (règlement intérieur, chartes) se lisent librement ; ceux de l'équipe restent protégés.
ALTER TABLE internal_resource DROP CONSTRAINT internal_resource_audience_check, ALTER COLUMN audience DROP NOT NULL;
ALTER TABLE internal_resource ADD COLUMN audiences text[] NOT NULL DEFAULT '{PROFS}'
  CHECK (audiences <> '{}' AND audiences <@ ARRAY['ELEVES', 'PARENTS', 'PROFS', 'PERSONNEL']);

-- Boîte à idées de l'équipe : suggestion (anonyme possible), réponse de la Direction
CREATE TABLE staff_suggestion (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id       uuid NOT NULL REFERENCES site(id),
  category      text NOT NULL CHECK (category IN ('ECOLE', 'RESSOURCES', 'METHODOLOGIE', 'VIE_SCOLAIRE', 'AUTRE')),
  body          text NOT NULL CHECK (length(trim(body)) >= 10),
  author_id     uuid REFERENCES app_user(id),   -- NULL : envoyée sans nom
  created_at    timestamptz NOT NULL DEFAULT now(),
  status        text NOT NULL DEFAULT 'NOUVELLE' CHECK (status IN ('NOUVELLE', 'ETUDE', 'RETENUE', 'NON_RETENUE')),
  answer        text,
  answered_by   uuid REFERENCES app_user(id),
  CHECK (status <> 'NON_RETENUE' OR length(trim(coalesce(answer, ''))) > 0),
  CHECK ((status = 'NOUVELLE') = (answered_by IS NULL))
);

-- Changements d'emploi du temps annoncés aux élèves, aux parents et aux professeurs de la classe :
-- cours annulé, déplacé, ajouté (temporaire), ou nouvel horaire définitif à partir d'une date.
CREATE TABLE timetable_change (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind          text NOT NULL CHECK (kind IN ('ANNULE', 'DEPLACE', 'AJOUT', 'DEFINITIF')),
  class_id      uuid NOT NULL REFERENCES school_class(id),
  slot_id       uuid REFERENCES timetable_slot(id),     -- cours concerné (sauf ajout)
  subject_id    uuid REFERENCES subject(id),            -- cours ajouté
  on_date       date NOT NULL,                          -- date du cours, ou début du changement définitif
  starts_at     time, ends_at time,                     -- cours ajouté
  new_date      date, new_starts_at time, new_ends_at time, new_weekday smallint CHECK (new_weekday BETWEEN 1 AND 6),
  room_id       uuid REFERENCES room(id),
  note          text,
  decided_by    uuid NOT NULL REFERENCES app_user(id),
  announced_at  timestamptz NOT NULL DEFAULT now(),
  CHECK (kind = 'AJOUT' OR slot_id IS NOT NULL),
  CHECK (kind <> 'AJOUT' OR (subject_id IS NOT NULL AND starts_at IS NOT NULL AND ends_at > starts_at)),
  CHECK (kind <> 'DEPLACE' OR (new_date IS NOT NULL AND new_ends_at > new_starts_at)),
  CHECK (kind <> 'DEFINITIF' OR (new_weekday IS NOT NULL AND new_ends_at > new_starts_at))
);

-- Sorties anticipées (malaise, rendez-vous) : les parents sont toujours appelés ; un élève mineur ne part
-- qu'avec un adulte (responsable légal, ou personne confirmée par lui), même avec son propre véhicule.
CREATE TABLE early_departure (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES enrollment(id),
  left_at       timestamptz NOT NULL,
  reason        text NOT NULL CHECK (length(trim(reason)) > 0),
  parent_called_at timestamptz NOT NULL,
  student_is_minor boolean NOT NULL,
  picked_up_by  text,
  relation      text,
  picked_up_is_guardian boolean,
  guardian_confirmed boolean NOT NULL DEFAULT false,
  recorded_by   uuid NOT NULL REFERENCES app_user(id),
  CHECK (NOT student_is_minor OR (picked_up_by IS NOT NULL AND relation IS NOT NULL)),
  CHECK (NOT student_is_minor OR picked_up_is_guardian OR guardian_confirmed)
);

-- Inventaire du matériel : mobilier, équipement (dont le matériel réservable), trousse de secours.
CREATE TABLE inventory_item (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id       uuid NOT NULL REFERENCES site(id),
  category      text NOT NULL CHECK (category IN ('MOBILIER', 'EQUIPEMENT', 'FOURNITURE', 'SECOURS')),
  name          text NOT NULL,
  place         text,
  qty           integer NOT NULL CHECK (qty >= 0),
  broken        integer NOT NULL DEFAULT 0,
  min_qty       integer CHECK (min_qty >= 0),          -- seuil : à recommander en dessous
  expires_on    date,                                  -- trousse de secours
  is_paracetamol boolean NOT NULL DEFAULT false,       -- le Doliprane : retiré du stock à chaque passage
  resource_id   uuid,                                  -- matériel réservable (booking_resource)
  CHECK (broken BETWEEN 0 AND qty),
  UNIQUE (site_id, name)
);
-- Mouvements : casse (décrite), réparation, mise au rebut, achat (facture), utilisation.
CREATE TABLE inventory_movement (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id       uuid NOT NULL REFERENCES inventory_item(id),
  kind          text NOT NULL CHECK (kind IN ('CASSE', 'REPARE', 'JETE', 'ACHAT', 'UTILISE')),
  n             integer NOT NULL CHECK (n > 0),
  note          text,
  supplier_id   uuid REFERENCES supplier(id),
  amount        integer CHECK (amount >= 0),
  invoice_file  text,                                  -- photo ou PDF de la facture
  by_user       uuid NOT NULL REFERENCES app_user(id),
  at            timestamptz NOT NULL DEFAULT now(),
  CHECK (kind <> 'CASSE' OR length(trim(coalesce(note, ''))) > 0)
);

-- Passages au secrétariat pour un souci de santé (pas d'infirmerie) ; seul médicament : le Doliprane.
CREATE TABLE care_visit (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES enrollment(id),
  at            timestamptz NOT NULL,
  reason        text NOT NULL CHECK (length(trim(reason)) > 0),
  paracetamol   boolean NOT NULL DEFAULT false,
  dose          text,
  outcome       text NOT NULL CHECK (outcome IN ('CLASSE', 'REPOS', 'SORTIE', 'URGENCE')),
  recorded_by   uuid NOT NULL REFERENCES app_user(id),
  parents_notified_at timestamptz,                     -- message aux parents dans l'application
  CHECK (NOT paracetamol OR dose IS NOT NULL)
);
-- Élèves passés 3 fois ou plus dans le même mois : à voir avec la famille.
CREATE VIEW v_frequent_care_visits AS
  SELECT enrollment_id, date_trunc('month', at)::date AS month, count(*) AS visits
  FROM care_visit GROUP BY 1, 2 HAVING count(*) >= 3;

-- Manuels comparés à l'effectif de l'année : exemplaires, en prêt, abîmés, perdus, à commander.
CREATE VIEW v_textbook_balance AS
WITH eff AS (
  SELECT t.id AS textbook_id, count(e.id) AS effectif
  FROM textbook t
  LEFT JOIN school_class c ON c.site_id = t.site_id AND c.level_code = ANY (t.level_codes)
    AND c.year_id = (SELECT id FROM academic_year WHERE is_current LIMIT 1)
  LEFT JOIN enrollment e ON e.class_id = c.id AND e.left_on IS NULL
    AND (t.specialty IS NULL OR EXISTS (SELECT 1 FROM enrollment_specialty s WHERE s.enrollment_id = e.id AND s.specialty = t.specialty))
  GROUP BY t.id
), stock AS (
  SELECT textbook_id, sum(quantity) FILTER (WHERE condition <> 'DECHIRE') AS good, coalesce(sum(quantity) FILTER (WHERE condition = 'DECHIRE'), 0) AS damaged
  FROM textbook_stock GROUP BY textbook_id
), loans AS (
  SELECT textbook_id,
    count(*) FILTER (WHERE due_back IS NOT NULL AND returned_on IS NULL AND lost_on IS NULL) AS lent,
    count(*) FILTER (WHERE due_back IS NULL) AS sold,
    count(*) FILTER (WHERE lost_on IS NOT NULL) AS lost
  FROM textbook_loan GROUP BY textbook_id
)
SELECT t.id AS textbook_id, t.site_id, t.title, eff.effectif,
  coalesce(stock.good, 0) AS good_in_stock, coalesce(stock.damaged, 0) AS damaged,
  coalesce(loans.lent, 0) AS lent, coalesce(loans.sold, 0) AS sold, coalesce(loans.lost, 0) AS lost,
  greatest(0, CASE WHEN t.is_returnable THEN eff.effectif - coalesce(stock.good, 0) - coalesce(loans.lent, 0)
                   ELSE eff.effectif - coalesce(loans.sold, 0) - coalesce(stock.good, 0) END) AS to_order
FROM textbook t JOIN eff ON eff.textbook_id = t.id
LEFT JOIN stock ON stock.textbook_id = t.id LEFT JOIN loans ON loans.textbook_id = t.id;

-- Examens blancs (3e, 1re, Terminale), candidats libres : pas de contrôle continu, toutes les épreuves
-- de l'examen, notées sur 20 avec leurs coefficients (session 2027 ; total du bac : 100 sur 1re + Tle).
CREATE TABLE mock_exam (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id      uuid NOT NULL REFERENCES school_class(id),
  kind          text NOT NULL CHECK (kind IN ('DNB', 'PREMIERE_G', 'PREMIERE_STMG', 'BAC_G', 'BAC_STMG')),
  title         text NOT NULL,
  held_on       date NOT NULL,
  created_by    uuid NOT NULL REFERENCES app_user(id)
);
-- Épreuve ; une épreuve « à sous-notes » (sciences du brevet) garde ses meilleures notes (best_of).
CREATE TABLE mock_exam_part (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mock_exam_id  uuid NOT NULL REFERENCES mock_exam(id) ON DELETE CASCADE,
  parent_id     uuid REFERENCES mock_exam_part(id) ON DELETE CASCADE,   -- sous-note (physique-chimie, SVT…)
  code          text NOT NULL,                          -- PHI, SPE1, GO, FR_E, SCI, PC…
  label         text NOT NULL,
  subject_id    uuid REFERENCES subject(id),            -- le professeur de la matière saisit l'épreuve
  coef          numeric(4,1) CHECK (coef > 0),
  best_of       smallint CHECK (best_of > 0),
  -- le professeur peut compter l'épreuve dans son carnet de notes (bulletin), avec son coefficient
  gradebook_evaluation_id uuid REFERENCES evaluation(id),
  UNIQUE (mock_exam_id, code),
  CHECK ((parent_id IS NULL) = (coef IS NOT NULL)),
  CHECK (parent_id IS NULL OR best_of IS NULL)
);
CREATE TABLE mock_exam_mark (
  part_id       uuid REFERENCES mock_exam_part(id) ON DELETE CASCADE,
  enrollment_id uuid REFERENCES enrollment(id),
  mark          numeric(4,2) CHECK (mark BETWEEN 0 AND 20),
  absent        boolean NOT NULL DEFAULT false,         -- absent : compté 0
  entered_by    uuid REFERENCES app_user(id),
  PRIMARY KEY (part_id, enrollment_id),
  CHECK (absent = (mark IS NULL))
);
-- Notes OFFICIELLES de 1re (épreuves anticipées et épreuves de fin de 1re) : base de la projection au bac.
CREATE TABLE official_exam_mark (
  student_id    uuid REFERENCES student(id),
  session_year  smallint NOT NULL,
  code          text NOT NULL CHECK (code IN ('FR_E', 'FR_O', 'MA_EA', 'SPE_AB', 'SGN', 'HG', 'EMC', 'ES', 'MA', 'LVA', 'LVB')),
  coef          numeric(4,1) NOT NULL CHECK (coef > 0),
  mark          numeric(4,2) NOT NULL CHECK (mark BETWEEN 0 AND 20),
  PRIMARY KEY (student_id, code)
);
-- Note de chaque épreuve : saisie directe, ou, une fois toutes les sous-notes saisies, moyenne des `best_of`
-- meilleures (absent = 0).
CREATE VIEW v_mock_exam_part_mark AS
WITH sub AS (
  SELECT c.parent_id, m.enrollment_id, coalesce(m.mark, 0) AS v,
         row_number() OVER (PARTITION BY c.parent_id, m.enrollment_id ORDER BY coalesce(m.mark, 0) DESC) AS rk,
         count(*) OVER (PARTITION BY c.parent_id, m.enrollment_id) AS entered,
         (SELECT count(*) FROM mock_exam_part k WHERE k.parent_id = c.parent_id) AS expected
  FROM mock_exam_part c JOIN mock_exam_mark m ON m.part_id = c.id WHERE c.parent_id IS NOT NULL
)
SELECT p.id AS part_id, m.enrollment_id, coalesce(m.mark, 0) AS mark
FROM mock_exam_part p JOIN mock_exam_mark m ON m.part_id = p.id WHERE p.parent_id IS NULL AND p.best_of IS NULL
UNION ALL
SELECT p.id, s.enrollment_id, round(avg(s.v), 2)
FROM mock_exam_part p JOIN sub s ON s.parent_id = p.id AND s.rk <= p.best_of AND s.entered = s.expected   -- toutes les sous-notes saisies
WHERE p.best_of IS NOT NULL GROUP BY p.id, s.enrollment_id, p.best_of HAVING count(*) = p.best_of;
-- Relevé : points, coefficients notés et total, moyenne, complet ou non.
CREATE VIEW v_mock_exam_result AS
SELECT x.id AS mock_exam_id, e.id AS enrollment_id,
  sum(pm.mark * p.coef) AS points,
  coalesce(sum(p.coef) FILTER (WHERE pm.part_id IS NOT NULL), 0) AS coef_marked,
  sum(p.coef) AS coef_total,
  round(sum(pm.mark * p.coef) / nullif(sum(p.coef) FILTER (WHERE pm.part_id IS NOT NULL), 0), 2) AS average,
  count(pm.part_id) = count(*) AS complete
FROM mock_exam x
JOIN mock_exam_part p ON p.mock_exam_id = x.id AND p.parent_id IS NULL
JOIN enrollment e ON e.class_id = x.class_id AND e.left_on IS NULL
LEFT JOIN v_mock_exam_part_mark pm ON pm.part_id = p.id AND pm.enrollment_id = e.id
GROUP BY x.id, e.id;

-- Passeport de vie scolaire : oublis (une heure de colle chacun), colles (1 ou 2 h, suivies jusqu'à ce
-- qu'elles soient effectuées) et TIG ; trois retards donnent une colle.
CREATE TABLE school_forget (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES enrollment(id),
  on_date       date NOT NULL,
  kind          text NOT NULL CHECK (kind IN ('MATERIEL', 'DEVOIR', 'CARNET', 'TENUE', 'AUTRE')),
  note          text,
  reported_by   uuid NOT NULL REFERENCES app_user(id)
);
CREATE TABLE detention (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES enrollment(id),
  kind          text NOT NULL CHECK (kind IN ('COLLE', 'TIG')),
  cause         text NOT NULL CHECK (cause IN ('OUBLI', 'RETARDS', 'AUTRE')),
  forget_id     uuid UNIQUE REFERENCES school_forget(id),        -- un oubli = une colle, pas plus
  hours         smallint CHECK (hours IN (1, 2)),
  scheduled_at  timestamptz NOT NULL,
  reason        text NOT NULL CHECK (length(trim(reason)) > 0),
  status        text NOT NULL DEFAULT 'A_FAIRE' CHECK (status IN ('A_FAIRE', 'FAITE', 'NON_FAITE')),
  given_by      uuid NOT NULL REFERENCES app_user(id),
  given_at      timestamptz NOT NULL DEFAULT now(),
  CHECK (kind = 'TIG' OR hours IS NOT NULL),
  CHECK ((cause = 'OUBLI') = (forget_id IS NOT NULL)),
  CHECK (cause <> 'OUBLI' OR hours = 1)
);
CREATE VIEW v_passport AS
SELECT e.id AS enrollment_id,
  (SELECT count(*) FROM attendance_event a WHERE a.enrollment_id = e.id AND a.kind = 'RETARD') AS lates,
  (SELECT count(*) FROM school_forget f WHERE f.enrollment_id = e.id) AS forgets,
  (SELECT count(*) FROM detention d WHERE d.enrollment_id = e.id AND d.cause = 'RETARDS') AS colles_for_lates,
  (SELECT coalesce(sum(hours), 0) FROM detention d WHERE d.enrollment_id = e.id AND d.kind = 'COLLE' AND d.status <> 'FAITE') AS hours_due,
  (SELECT coalesce(sum(hours), 0) FROM detention d WHERE d.enrollment_id = e.id AND d.kind = 'COLLE' AND d.status = 'FAITE') AS hours_done,
  (SELECT count(*) FROM detention d WHERE d.enrollment_id = e.id AND d.kind = 'TIG') AS tig
FROM enrollment e;

-- Conditions acceptées à la première connexion (règlement, chartes) : un document nouveau ou remplacé
-- est redemandé. internal_resource.must_accept marque les documents concernés.
ALTER TABLE internal_resource ADD COLUMN must_accept boolean NOT NULL DEFAULT false;
CREATE TABLE document_acceptance (
  user_id       uuid REFERENCES app_user(id) ON DELETE CASCADE,
  resource_id   uuid REFERENCES internal_resource(id) ON DELETE CASCADE,
  version_at    timestamptz NOT NULL,                   -- internal_resource.shared_at au moment de l'acceptation
  opened_at     timestamptz NOT NULL,                   -- le document a été ouvert avant d'être accepté
  accepted_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, resource_id, version_at),
  CHECK (opened_at <= accepted_at)
);

-- Notifications à trois niveaux : URGENT (élève malade, sortie… ; reste affiché jusqu'à « J'ai vu »),
-- A_FAIRE (décision, validation), INFO (annonce, publication). Le rouge est réservé à l'urgent.
ALTER TABLE direct_notification
  ADD COLUMN level text NOT NULL DEFAULT 'INFO' CHECK (level IN ('URGENT', 'A_FAIRE', 'INFO')),
  ADD COLUMN acknowledged_at timestamptz;

-- Réglages du site : ambiance saisonnière et liens vers les réseaux de l'école.
-- Ambiances (école laïque) : repères civiques, culturels, historiques, scolaires ou de saison, jamais religieux.
-- Une ambiance choisit une palette de la liste fermée (contrastes vérifiés côté interface) et peut porter une
-- note « Le saviez-vous ? ». Dates fixes (MM-JJ) ou, pour les fêtes à date variable (Nouvel An lunaire),
-- une ligne par année dans season_date.
CREATE TABLE season (
  code          text PRIMARY KEY,                     -- OCTOBRE_ROSE, NOUVEL_AN_LUNAIRE, PERSO_…
  label         text NOT NULL,
  category      text NOT NULL CHECK (category IN ('SCOLAIRE', 'CIVIQUE', 'CULTUREL', 'HISTORIQUE', 'SAISON')),
  from_md       char(5) CHECK (from_md ~ '^[01][0-9]-[0-3][0-9]$'),   -- MM-JJ ; NULL : dates dans season_date
  to_md         char(5) CHECK (to_md ~ '^[01][0-9]-[0-3][0-9]$'),
  palette       text NOT NULL CHECK (palette IN ('ciel', 'vert', 'rose', 'violet', 'or', 'rouge', 'ambre', 'sobre')),
  motif         text NOT NULL DEFAULT 'aucun' CHECK (motif IN ('confettis', 'petales', 'feuilles', 'etoiles', 'aucun')),
  symbol        text,                                 -- symbole décoratif (non lu par les lecteurs d'écran)
  greeting      text NOT NULL,
  note_title    text,
  note_body     text,
  added_by      uuid REFERENCES app_user(id),         -- NULL : ambiance prévue ; sinon ajoutée par la Direction
  CHECK ((from_md IS NULL) = (to_md IS NULL)),
  CHECK ((note_title IS NULL) = (note_body IS NULL)),
  CHECK (concat_ws(' ', label, greeting, note_title, note_body)
         !~* '(no[eë]l|halloween|toussaint|p[aâ]ques|ramadan|a[iï]d\M|hanouk|diwali|car[eê]me|nativit|saint|religi)')
);
CREATE TABLE season_date (
  code          text REFERENCES season(code) ON DELETE CASCADE,
  year          smallint,
  from_date     date NOT NULL,
  to_date       date NOT NULL CHECK (to_date >= from_date),
  PRIMARY KEY (code, year)
);
CREATE TABLE site_setting (
  site_id       uuid PRIMARY KEY REFERENCES site(id),
  seasonal_mode text NOT NULL DEFAULT 'AUTO',         -- AUTO, OFF ou le code d'une ambiance imposée
  facebook_url  text CHECK (facebook_url IS NULL OR facebook_url ~ '^https://'),
  instagram_url text CHECK (instagram_url IS NULL OR instagram_url ~ '^https://'),
  instagram_label text,
  CHECK (seasonal_mode IN ('AUTO', 'OFF') OR seasonal_mode IS NOT NULL)
);

-- Vie de l'école : albums de photos. Seule la Direction publie ; secrétariat, CPE, professeurs et élèves
-- proposent, la Direction valide après avoir vérifié le droit à l'image (même circuit que les annonces).
CREATE TABLE school_post (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id       uuid NOT NULL REFERENCES site(id),
  parent_id     uuid REFERENCES school_post(id),      -- photos ajoutées à un album existant
  title         text NOT NULL CHECK (length(trim(title)) > 0),
  body          text,
  class_id      uuid REFERENCES school_class(id),     -- classe de l'auteur (élève) : rappel du droit à l'image
  author_id     uuid NOT NULL REFERENCES app_user(id),
  status        publication_status NOT NULL DEFAULT 'EN_ATTENTE',
  image_rights_checked boolean NOT NULL DEFAULT false,
  moderated_by  uuid REFERENCES app_user(id),
  moderated_at  timestamptz,
  review_note   text,                                 -- remarque de la Direction quand elle renvoie
  created_at    timestamptz NOT NULL DEFAULT now(),
  CHECK (status <> 'A_REVOIR' OR length(trim(coalesce(review_note, ''))) > 0)
);
CREATE TABLE school_post_photo (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id       uuid NOT NULL REFERENCES school_post(id) ON DELETE CASCADE,
  file_key      text NOT NULL,
  position      smallint NOT NULL CHECK (position BETWEEN 1 AND 6),   -- 6 photos au plus
  UNIQUE (post_id, position)
);

-- Annonces : circuit de validation et traçabilité. Rédaction : Direction, secrétariat, CPE (jamais un
-- professeur) ; publication : Direction seule. Le public voit le service (« Secrétariat · validée par la
-- Direction ») ; l'historique garde qui a rédigé, corrigé, publié, retiré, et quand.
ALTER TABLE announcement
  ADD COLUMN status publication_status NOT NULL DEFAULT 'BROUILLON',
  ADD COLUMN author_service text,                     -- Direction, Secrétariat, Vie scolaire (CPE)
  ADD COLUMN pin_requested boolean NOT NULL DEFAULT false,
  ADD COLUMN validated_by uuid REFERENCES app_user(id),
  ADD COLUMN validated_at timestamptz,
  ADD COLUMN edited_by_direction boolean NOT NULL DEFAULT false,
  ADD COLUMN review_note text,
  ADD CONSTRAINT announcement_published_validated CHECK (status NOT IN ('PUBLIEE', 'RETIREE') OR (validated_by IS NOT NULL AND validated_at IS NOT NULL)),
  ADD CONSTRAINT announcement_review_note CHECK (status <> 'A_REVOIR' OR length(trim(coalesce(review_note, ''))) > 0);
CREATE TABLE publication_event (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  entity        text NOT NULL CHECK (entity IN ('ANNONCE', 'VIE_ECOLE', 'EVENEMENT')),
  entity_id     uuid NOT NULL,
  action        text NOT NULL CHECK (action IN ('CREEE', 'ENVOYEE', 'RELUE', 'CORRIGEE', 'RENVOYEE', 'PUBLIEE', 'RETIREE')),
  by_user       uuid REFERENCES app_user(id),
  at            timestamptz NOT NULL DEFAULT now(),
  note          text
);
-- Annulation d'un cours le jour même : seule annonce publiée sans la Direction (secrétariat, CPE) ; la Direction
-- la voit dans l'historique (publication_event, note « annulation du jour »).
ALTER TABLE announcement
  ADD COLUMN urgent text CHECK (urgent = 'ANNULATION_JOUR'),
  ADD COLUMN concerns_date date,
  ADD CONSTRAINT announcement_urgent_date CHECK (urgent IS NULL OR concerns_date IS NOT NULL);
-- Ce que reçoivent élèves, parents et professeurs : uniquement le publié, avec la signature de service.
CREATE VIEW v_public_announcement AS
SELECT a.id, a.title, a.body_md, a.publish_at, a.is_pinned,
  CASE WHEN a.author_service = 'Direction' THEN 'Direction'
       WHEN a.urgent = 'ANNULATION_JOUR' THEN a.author_service || ' · annulation du jour'
       ELSE a.author_service || ' · validée par la Direction' END AS signature
FROM announcement a WHERE a.status = 'PUBLIEE';

-- =====  MANDATS D'ÉLÈVES : DÉLÉGUÉS DE CLASSE ET BUREAU DES ÉLÈVES (BDE)  =====
-- Pas de rôle à part : l'élève garde son compte ELEVE ; ses engagements de l'année en cours (DELEGUE ou
-- SUPPLEANT → mandat DELEGUE sur sa classe ; BDE ou BDE_PRESIDENT → mandat BDE sur son site) lui ouvrent
-- quelques capacités, contrôlées par student_mandate() (functions.sql). Le mandat s'éteint avec l'inscription.
-- Ce qu'il écrit passe par la validation de la Direction ; il n'ouvre ni notes, ni fiches, ni paramètres.
ALTER TABLE announcement ADD COLUMN author_mandate text CHECK (author_mandate IN ('DELEGUE', 'BDE'));

-- Événements : ceux du personnel sont publiés d'emblée ; ceux proposés par le BDE attendent la Direction.
ALTER TABLE school_event
  ADD COLUMN status publication_status NOT NULL DEFAULT 'PUBLIEE',
  ADD COLUMN description text,
  ADD COLUMN proposed_by_mandate text CHECK (proposed_by_mandate = 'BDE'),
  ADD COLUMN validated_by uuid REFERENCES app_user(id),
  ADD COLUMN review_note text,
  ADD CONSTRAINT school_event_review_note CHECK (status <> 'A_REVOIR' OR length(trim(coalesce(review_note, ''))) > 0);

-- Remontées des délégués pour le conseil de classe : lues par le secrétariat (et la Direction), jamais publiées.
CREATE TABLE council_feedback (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id      uuid NOT NULL REFERENCES school_class(id),
  period_id     uuid NOT NULL REFERENCES period(id),
  author_id     uuid NOT NULL REFERENCES app_user(id),
  body          text NOT NULL CHECK (length(trim(body)) > 0),
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- Droits d'accès par écran, réglés par la Direction (écran « Droits d'accès »)
-- Trois niveaux : AUCUN (écran absent), LECTURE (consulter), ECRITURE (modifier).
-- Réglage par rôle, puis exception possible par personne (niveau d'accréditation).
-- La Direction garde tout ; ses écrans propres ne se délèguent pas.
-- -----------------------------------------------------------------------------
CREATE TYPE access_level AS ENUM ('AUCUN', 'LECTURE', 'ECRITURE');
CREATE TABLE screen_access_role (
  role          role_code NOT NULL CHECK (role IN ('BUREAU', 'VIE_SCOLAIRE', 'PROFESSEUR')),
  screen        text NOT NULL CHECK (screen NOT IN ('dashboard', 'settings', 'staff', 'access', 'mandates', 'feedback')),
  level         access_level NOT NULL,
  set_by        uuid REFERENCES app_user(id),
  set_at        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (role, screen)
);
CREATE TABLE screen_access_user (
  user_id       uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  screen        text NOT NULL CHECK (screen NOT IN ('dashboard', 'settings', 'staff', 'access', 'mandates', 'feedback')),
  level         access_level NOT NULL,
  set_by        uuid REFERENCES app_user(id),
  set_at        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, screen)
);

-- -----------------------------------------------------------------------------
-- Vie scolaire (octobre 2026) : délai de justification, carnet de liaison, objets confisqués,
-- journal de l'école
-- -----------------------------------------------------------------------------
-- Justification : 24 h au plus après le début de l'absence ; ensuite non justifiée (trigger).
ALTER TABLE attendance_event ADD COLUMN justified_at timestamptz;
-- Oublis : la colle n'est automatique que pour le carnet de liaison ; ailleurs, elle est demandée.
ALTER TABLE school_forget ADD COLUMN colle_requested boolean NOT NULL DEFAULT false;
ALTER TABLE school_forget ADD CONSTRAINT carnet_colle_auto CHECK (kind <> 'CARNET' OR NOT colle_requested);
-- Objets confisqués : pas seulement des téléphones ; remis à un service ou à une personne ;
-- durée décidée ensuite par la Direction ou le secrétariat (NULL : à décider).
ALTER TABLE phone_confiscation
  ADD COLUMN object_kind text NOT NULL DEFAULT 'TELEPHONE' CHECK (object_kind IN ('TELEPHONE', 'ECOUTEURS', 'MONTRE', 'CIGARETTE_ELECTRONIQUE', 'AUTRE')),
  ADD COLUMN object_note text,
  ADD COLUMN handed_to text,                                  -- 'Vie scolaire (CPE)', 'Secrétariat', 'Direction' ou un nom
  ADD COLUMN duration_decided_by uuid REFERENCES app_user(id),
  ADD CONSTRAINT object_other_named CHECK (object_kind <> 'AUTRE' OR length(trim(coalesce(object_note, ''))) > 0);
ALTER TABLE phone_confiscation DROP CONSTRAINT phone_duration_by_action;
ALTER TABLE phone_confiscation ADD CONSTRAINT phone_duration_by_action CHECK (action = 'CONFISCATION' OR duration_code IS NULL);
ALTER TABLE phone_confiscation ADD CONSTRAINT phone_returned_after_decision CHECK (returned_at IS NULL OR duration_code IS NOT NULL);

-- Journal de l'école : qui a fait quoi pour les élèves et les professeurs (jamais l'argent).
CREATE TABLE activity_log (
  id            bigserial PRIMARY KEY,
  site_id       uuid NOT NULL REFERENCES site(id),
  at            timestamptz NOT NULL DEFAULT now(),
  actor_id      uuid NOT NULL REFERENCES app_user(id),
  kind          text NOT NULL CHECK (kind IN ('APPEL', 'ABSENCE', 'JUSTIF', 'PARENTS', 'PUNITION', 'COLLE', 'OUBLI', 'OBJET', 'SOIN', 'SORTIE', 'PROF', 'SUIVI')),
  enrollment_id uuid REFERENCES enrollment(id),
  text          text NOT NULL CHECK (length(trim(text)) > 0)
);
CREATE INDEX activity_log_day ON activity_log (site_id, at DESC);

-- -----------------------------------------------------------------------------
-- Inscription : parcours antérieur ; bibliothèque : facturation des livres non rendus
-- -----------------------------------------------------------------------------
-- Système de l'école d'origine (pour lire ses bulletins) et brevet à l'entrée en 2de.
ALTER TABLE student
  ADD COLUMN previous_system text CHECK (previous_system IN ('FRANCAIS', 'EXPRESSION_FRANCAISE', 'MALGACHE', 'ANGLOPHONE', 'AUTRE')),
  ADD COLUMN dnb_status text CHECK (dnb_status IN ('OBTENU', 'NON_OBTENU', 'NON_PRESENTE'));
ALTER TABLE pre_registration
  ADD COLUMN previous_system text CHECK (previous_system IN ('FRANCAIS', 'EXPRESSION_FRANCAISE', 'MALGACHE', 'ANGLOPHONE', 'AUTRE')),
  ADD COLUMN dnb_status text CHECK (dnb_status IN ('OBTENU', 'NON_OBTENU', 'NON_PRESENTE')),
  ADD COLUMN repeating boolean NOT NULL DEFAULT false;
ALTER TABLE enrollment ADD COLUMN repeating boolean NOT NULL DEFAULT false; -- redouble la classe (relevés demandés en 1re et Terminale)
-- Annuaire des écoles d'origine, appris des fiches : proposé à la saisie avec le système le plus fréquent.
CREATE VIEW v_school_directory AS
SELECT min(previous_school) AS name, lower(trim(previous_school)) AS key, count(*) AS students,
  mode() WITHIN GROUP (ORDER BY previous_system) FILTER (WHERE previous_system IS NOT NULL) AS system
FROM student WHERE coalesce(trim(previous_school), '') <> '' GROUP BY lower(trim(previous_school));

-- Livre non rendu à la fin du prêt (30 jours) : facturé au prix du livre, réglé à la caisse (n° de reçu).
ALTER TABLE library_book ADD COLUMN price integer CHECK (price IS NULL OR price >= 0); -- en ariary
ALTER TABLE library_loan
  ADD COLUMN billed_receipt text CHECK (billed_receipt IS NULL OR billed_receipt LIKE 'ANX-%'),
  ADD COLUMN billed_on date,
  ADD CONSTRAINT library_bill_settled CHECK ((billed_receipt IS NULL) = (billed_on IS NULL));
CREATE VIEW v_library_to_bill AS
SELECT l.id AS loan_id, l.enrollment_id, l.copy_code, l.due_on, b.title, b.price
FROM library_loan l JOIN library_copy c ON c.code = l.copy_code JOIN library_book b ON b.id = c.book_id
WHERE l.enrollment_id IS NOT NULL AND l.returned_on IS NULL AND l.due_on < current_date AND l.billed_receipt IS NULL;

-- -----------------------------------------------------------------------------
-- Engagements propres à l'école, suivis individuels
-- -----------------------------------------------------------------------------
-- Catalogue des engagements et attestations : ceux du départ, plus ceux que crée la Direction ;
-- « active = false » : plus proposé, sans rien effacer des élèves qui l'ont.
CREATE TABLE engagement_type (
  code          text PRIMARY KEY,
  label         text NOT NULL CHECK (length(trim(label)) >= 3),
  kind          text NOT NULL CHECK (kind IN ('ENGAGEMENT', 'ATTESTATION')),
  builtin       boolean NOT NULL DEFAULT false,
  active        boolean NOT NULL DEFAULT true
);
INSERT INTO engagement_type (code, label, kind, builtin) VALUES
  ('DELEGUE', 'Délégué(e) de classe', 'ENGAGEMENT', true), ('SUPPLEANT', 'Délégué(e) suppléant(e)', 'ENGAGEMENT', true),
  ('ECO_DELEGUE', 'Éco-délégué(e)', 'ENGAGEMENT', true), ('BDE', 'Membre du Bureau des élèves (BDE)', 'ENGAGEMENT', true),
  ('BDE_PRESIDENT', 'Président(e) du Bureau des élèves (BDE)', 'ENGAGEMENT', true), ('TUTEUR', 'Tutorat d''un élève (aide aux devoirs)', 'ENGAGEMENT', true),
  ('SPORT', 'Membre de l''équipe sportive de l''établissement', 'ENGAGEMENT', true), ('PSC1', 'Formation aux premiers secours (PSC1)', 'ENGAGEMENT', true),
  ('ASSR1', 'Sécurité routière niveau 1 (programme ASSR 1)', 'ATTESTATION', true), ('ASSR2', 'Sécurité routière niveau 2 (programme ASSR 2)', 'ATTESTATION', true),
  ('NUMERIQUE', 'Compétences numériques (référentiel Pix / B2i)', 'ATTESTATION', true);
ALTER TABLE student_engagement ALTER COLUMN code TYPE text USING code::text;
ALTER TABLE student_engagement ADD CONSTRAINT student_engagement_type FOREIGN KEY (code) REFERENCES engagement_type(code);
DROP TYPE engagement_code;

-- Suivis individuels (Direction, CPE) : dossier lourd, demande des parents, contrat avec conditions.
-- Contact extérieur (club, financeur) : seulement avec l'accord écrit des parents.
CREATE TABLE student_followup (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES enrollment(id),
  kind          text NOT NULL CHECK (kind IN ('DOSSIER', 'PARENTS', 'CONTRAT', 'AUTRE')),
  referent_id   uuid NOT NULL REFERENCES app_user(id),
  since         date NOT NULL DEFAULT current_date,
  report_every  text NOT NULL DEFAULT 'SEMAINE' CHECK (report_every IN ('SEMAINE', 'MOIS', 'DEMANDE')),
  max_unjustified smallint, max_lates smallint, min_average numeric(4,2), max_measures smallint,
  contact_name  text, contact_role text, contact_phone text, contact_email citext,
  contact_parent_consent boolean NOT NULL DEFAULT false,
  closed_on     date,
  CHECK (contact_name IS NULL OR contact_parent_consent)
);
CREATE TABLE student_followup_note (
  id            bigserial PRIMARY KEY,
  followup_id   uuid NOT NULL REFERENCES student_followup(id) ON DELETE CASCADE,
  at            timestamptz NOT NULL DEFAULT now(),
  author_id     uuid NOT NULL REFERENCES app_user(id),
  text          text NOT NULL CHECK (length(trim(text)) > 0)
);

-- -----------------------------------------------------------------------------
-- Octobre 2026 (suite) : prélèvement de la Direction, manuels, semaines A/B, surveillance des colles
-- -----------------------------------------------------------------------------
-- Prélèvement de la Direction (Cheffe ou adjointe) : compté tout de suite si elle le saisit elle-même,
-- sinon en attente de sa confirmation (saisi par l'économe).
ALTER TABLE cash_movement
  ADD COLUMN withdrawn_by uuid REFERENCES app_user(id),
  ADD COLUMN status text NOT NULL DEFAULT 'VALIDE' CHECK (status IN ('VALIDE', 'A_VALIDER', 'REFUSE')),
  ADD COLUMN decided_at timestamptz,
  ADD CONSTRAINT withdrawal_has_person CHECK ((nature = 'Prélèvement Direction') = (withdrawn_by IS NOT NULL));
-- Manuels : la reliure et l'impression ne concernent que les photocopies ; programme 2019 à 2026.
ALTER TABLE textbook ALTER COLUMN binding DROP NOT NULL;
ALTER TABLE textbook
  ADD COLUMN print_mode text CHECK (print_mode IN ('NB', 'COULEUR')),
  ADD CONSTRAINT photocopy_format CHECK (is_photocopy = (binding IS NOT NULL AND print_mode IS NOT NULL));
-- Emploi du temps : semaine A ou B (NULL : toutes les semaines).
ALTER TABLE timetable_slot ADD COLUMN week_letter char(1) CHECK (week_letter IN ('A', 'B'));
-- Surveillance des colles : un créneau (date), la CPE ou le secrétariat.
CREATE TABLE detention_watch (
  site_id       uuid NOT NULL REFERENCES site(id),
  on_date       date NOT NULL CHECK (extract(isodow FROM on_date) IN (3, 6)),
  watcher_id    uuid NOT NULL REFERENCES app_user(id),
  PRIMARY KEY (site_id, on_date)
);

-- ------------------------------------------------------------------------------------------------
-- Parcours (octobre 2026) : justification par la famille, notifications sur le téléphone,
-- remplacements CPE ↔ secrétariat, favoris du menu.
-- ------------------------------------------------------------------------------------------------

-- Justification envoyée par le parent depuis son téléphone (motif, mot, photo du justificatif facultative).
-- Envoyée dans les 24 h : elle attend la vie scolaire, qui l'accepte (absence justifiée) ou la refuse avec une raison.
CREATE TABLE attendance_request (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_id uuid NOT NULL REFERENCES attendance_event(id) ON DELETE CASCADE,
  guardian_id   uuid NOT NULL REFERENCES guardian(id),
  -- motifs légitimes retenus par l'institution (service-public.fr) + Autre ; à partir de 3 jours d'absence
  -- d'affilée, la photo du justificatif est obligatoire (contrôlée par l'application avant l'envoi)
  reason        text NOT NULL CHECK (reason IN ('Maladie', 'Réunion de famille', 'Accident de transport', 'Déplacement avec la famille', 'Autre')),
  note          text,
  photo_key     text,                                   -- photo du justificatif (stockage de fichiers)
  sent_at       timestamptz NOT NULL DEFAULT now(),
  decided_at    timestamptz,
  decided_by    uuid REFERENCES app_user(id),
  accepted      boolean,
  refusal_reason text,
  CHECK (reason <> 'Autre' OR length(trim(coalesce(note, ''))) > 0),
  CHECK ((decided_at IS NULL) = (accepted IS NULL) AND (decided_at IS NULL) = (decided_by IS NULL)),
  CHECK (accepted IS DISTINCT FROM false OR length(trim(coalesce(refusal_reason, ''))) > 0)
);
-- une seule demande en attente par absence
CREATE UNIQUE INDEX attendance_request_pending ON attendance_request (attendance_id) WHERE decided_at IS NULL;

-- Notifications sur le téléphone (Web Push, sans SMS) et e-mail de secours.
CREATE TABLE push_subscription (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  endpoint      text NOT NULL UNIQUE,
  p256dh        text NOT NULL,
  auth          text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE TYPE notif_level AS ENUM ('URGENT', 'IMPORTANT', 'INFO');
CREATE TABLE notification_outbox (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  level         notif_level NOT NULL,
  kind          text NOT NULL,                          -- SOIN, ABSENCE, NOTE, MESURE, ANNONCE…
  child_id      uuid REFERENCES student(id),
  body          text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  sent_at       timestamptz,                            -- poussé sur le téléphone
  opened_at     timestamptz,
  emailed_at    timestamptz
);

-- Remplacement pour la journée : les alertes de la personne absente vont aussi à l'autre service.
CREATE TABLE staff_cover (
  site_id       uuid NOT NULL REFERENCES site(id),
  on_date       date NOT NULL,
  absent_role   text NOT NULL CHECK (absent_role IN ('VIE_SCOLAIRE', 'BUREAU')),
  covered_by    text NOT NULL CHECK (covered_by IN ('VIE_SCOLAIRE', 'BUREAU')),
  set_by        uuid NOT NULL REFERENCES app_user(id),
  PRIMARY KEY (site_id, on_date, absent_role),
  CHECK (absent_role <> covered_by)
);

-- Favoris du menu : 5 écrans au plus par personne.
CREATE TABLE user_favorite (
  user_id       uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  screen_id     text NOT NULL,
  position      smallint NOT NULL CHECK (position BETWEEN 1 AND 5),
  PRIMARY KEY (user_id, screen_id),
  UNIQUE (user_id, position)
);

-- Lot du 23 octobre 2026 ---------------------------------------------------------------------------
-- Élève envoyé au secrétariat par la CPE ou un professeur : le passage existe avant les soins
-- (« Au secrétariat maintenant ») ; la suite est notée par le secrétariat, puis le retour en classe.
ALTER TABLE care_visit ALTER COLUMN outcome DROP NOT NULL;
ALTER TABLE care_visit ADD COLUMN sent_by uuid REFERENCES app_user(id);
ALTER TABLE care_visit ADD COLUMN back_in_class_at timestamptz;
ALTER TABLE care_visit ADD CONSTRAINT care_visit_pending_ck CHECK (outcome IS NOT NULL OR sent_by IS NOT NULL);
CREATE VIEW v_care_here_now AS
  SELECT * FROM care_visit WHERE at::date = current_date AND back_in_class_at IS NULL AND (outcome IS NULL OR outcome = 'REPOS');

-- Réactions dans « Vie de l'école » : une par personne et par émoji
CREATE TABLE school_post_reaction (
  post_id       uuid NOT NULL REFERENCES school_post(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES app_user(id),
  emoji         text NOT NULL CHECK (emoji IN ('❤️', '👏', '😂', '😮', '🎉')),
  at            timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id, emoji)
);

-- Documents joints : annonces (pour les parents et/ou les élèves choisis) et cahier de textes
CREATE TABLE announcement_file (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id uuid NOT NULL REFERENCES announcement(id) ON DELETE CASCADE,
  file_key        text NOT NULL,
  name            text NOT NULL CHECK (length(trim(name)) > 0)
);
CREATE TABLE homework_file (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  homework_id   uuid NOT NULL REFERENCES homework(id) ON DELETE CASCADE,
  file_key      text NOT NULL,
  name          text NOT NULL CHECK (length(trim(name)) > 0)
);

-- Lot du 25 octobre 2026 : documents de l'école -------------------------------------------------------
-- Demande de rendez-vous : au moins un créneau proposé ; dispense d'EPS : une date de début
ALTER TABLE family_request ADD CONSTRAINT family_request_rdv_ck
  CHECK (kind <> 'RDV' OR jsonb_array_length(coalesce(payload->'slots', '[]'::jsonb)) > 0);
ALTER TABLE family_request ADD CONSTRAINT family_request_eps_ck
  CHECK (kind <> 'DISPENSE_EPS' OR payload ? 'from');

-- Fiches de dialogue d'orientation (2de : passage en 1re ; Terminale : post-bac), étape par étape,
-- chacune signée par le compte qui la remplit (représentant légal, élève, cheffe d'établissement)
CREATE TABLE orientation_sheet_step (
  enrollment_id uuid NOT NULL REFERENCES enrollment(id),
  step          text NOT NULL CHECK (step IN ('t2Request', 't2Council', 't2Ack', 't3Request', 't3Council', 'answer', 'intentions', 'parentSeen', 'council')),
  payload       jsonb NOT NULL DEFAULT '{}',
  signed_by     uuid NOT NULL REFERENCES app_user(id),
  signed_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (enrollment_id, step),
  CHECK (step NOT IN ('t2Request', 't3Request') OR jsonb_array_length(coalesce(payload->'ranks', '[]'::jsonb)) > 0)
);
-- =============================================================================
--  ENT Chateaubriand — Règles métier exécutées côté base
--  (à charger après schema.sql)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Calendrier de relance : le mois est-il actif pour le cycle de frais de scolarité ?
-- Seed : tous les mois actifs sauf octobre (« Encaissement des droits d'examen »).
-- -----------------------------------------------------------------------------
CREATE FUNCTION is_dunning_month(p_year uuid, p_day date) RETURNS boolean AS $$
  SELECT coalesce(
    (SELECT is_active FROM dunning_month
      WHERE year_id = p_year AND month = extract(month FROM p_day)::int),
    false)
$$ LANGUAGE sql STABLE;

-- -----------------------------------------------------------------------------
-- Jour compté pour les délais de relance ?
--   jour de semaine retenu par la politique (lun→ven par défaut)
--   ET hors jour férié / vacances / fermeture du site
--   ET dans un mois de relance actif (octobre gelé).
-- -----------------------------------------------------------------------------
CREATE FUNCTION is_counted_day(p_year uuid, p_site uuid, p_day date) RETURNS boolean AS $$
  SELECT extract(isodow FROM p_day)::smallint = ANY (p.counted_weekdays)
     AND is_dunning_month(p_year, p_day)
     AND NOT EXISTS (
       SELECT 1 FROM calendar_day_off o
        WHERE o.year_id = p_year
          AND (o.site_id IS NULL OR o.site_id = p_site)
          AND o.days @> p_day)
  FROM dunning_policy p
  WHERE p.year_id = p_year AND p.site_id = p_site
$$ LANGUAGE sql STABLE;

-- Date atteinte après p_n jours comptés à partir du lendemain de p_from.
CREATE FUNCTION add_counted_days(p_year uuid, p_site uuid, p_from date, p_n int) RETURNS date AS $$
DECLARE
  d date := p_from;
  n int := 0;
BEGIN
  WHILE n < p_n LOOP
    d := d + 1;
    IF d > p_from + 730 THEN
      RAISE EXCEPTION 'Calendrier sans jour compté après le % : vérifier la politique de relance', p_from;
    END IF;
    IF is_counted_day(p_year, p_site, d) THEN n := n + 1; END IF;
  END LOOP;
  RETURN d;
END $$ LANGUAGE plpgsql STABLE;

-- Dates de relance, d'avertissement et de mise à pied pour une échéance.
CREATE FUNCTION dunning_schedule(p_year uuid, p_site uuid, p_due date, p_last_month boolean DEFAULT false)
RETURNS TABLE (relance_on date, warning_on date, suspension_on date) AS $$
DECLARE
  p dunning_policy%ROWTYPE;
  v_rel smallint; v_warn smallint; v_susp smallint;
BEGIN
  SELECT * INTO p FROM dunning_policy WHERE year_id = p_year AND site_id = p_site;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Aucune politique de relance pour ce site et cette année';
  END IF;
  -- dernier mois du plan : délais raccourcis s'ils sont paramétrés
  IF p_last_month AND p.last_month_relance_after IS NOT NULL THEN
    v_rel := p.last_month_relance_after; v_warn := p.last_month_warning_after; v_susp := p.last_month_suspension_after;
  ELSE
    v_rel := p.relance_after; v_warn := p.warning_after; v_susp := p.suspension_after;
  END IF;
  relance_on := add_counted_days(p_year, p_site, p_due, v_rel);
  IF p.count_from = 'ECHEANCE' THEN
    warning_on    := add_counted_days(p_year, p_site, p_due, v_warn);
    suspension_on := add_counted_days(p_year, p_site, p_due, v_susp);
  ELSE
    warning_on    := add_counted_days(p_year, p_site, relance_on, v_warn);
    suspension_on := add_counted_days(p_year, p_site, warning_on, v_susp);
  END IF;
  RETURN NEXT;
END $$ LANGUAGE plpgsql STABLE;

-- -----------------------------------------------------------------------------
-- Échéancier de frais de scolarité : seuls les mois du plan du niveau sont facturables
-- (Tamatave 1re/Tle : septembre → mai, soit 9 échéances), à partir du mois d'inscription.
-- -----------------------------------------------------------------------------
CREATE FUNCTION tuition_month_allowed(p_enrollment uuid, p_month date) RETURNS boolean AS $$
  SELECT NOT EXISTS (
    SELECT 1
    FROM enrollment e
    JOIN school_class c ON c.id = e.class_id
    JOIN tuition_cutoff_rule r
      ON r.year_id = e.year_id AND r.site_id = c.site_id AND r.level_code = c.level_code
    WHERE e.id = p_enrollment
      -- on compare en « rang scolaire » : (mois + 3) % 12 donne sept = 0, oct = 1 … juin = 9, août = 11
      AND ((extract(month FROM p_month)::int + 3) % 12) NOT BETWEEN ((r.first_payable_month + 3) % 12)
                                                              AND ((r.last_payable_month + 3) % 12)
  )
  -- un élève arrivé en cours d'année : son compte commence au mois de son inscription
  AND NOT EXISTS (SELECT 1 FROM enrollment e
                   WHERE e.id = p_enrollment AND p_month < date_trunc('month', e.enrolled_on)::date)
$$ LANGUAGE sql STABLE;

CREATE FUNCTION invoice_cutoff_guard() RETURNS trigger AS $$
BEGIN
  IF NEW.category = 'ECOLAGE' AND NOT tuition_month_allowed(NEW.enrollment_id, NEW.period_month) THEN
    RAISE EXCEPTION 'Frais de scolarité de % non facturable : au-delà du dernier mois payable pour ce niveau', to_char(NEW.period_month, 'MM/YYYY');
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER invoice_cutoff BEFORE INSERT ON invoice
  FOR EACH ROW EXECUTE FUNCTION invoice_cutoff_guard();

-- -----------------------------------------------------------------------------
-- Encaissement de droits d'examen : ventilation automatique
--   Débit  EXA-CAISSE        montant total
--   Crédit EXA-FRAIS-DOS     40 000 Ar (frais de dossier conservés)
--   Crédit EXA-A-REVERSER    reste (dû au centre d'examen)
-- (simplification : on passe par la trésorerie sans compte client intermédiaire)
-- -----------------------------------------------------------------------------
CREATE FUNCTION record_exam_fee_payment(p_payment uuid, p_invoice uuid, p_actor uuid)
RETURNS uuid AS $$
DECLARE
  v_pay      payment%ROWTYPE;
  v_retained bigint;
  v_entry    uuid;
BEGIN
  SELECT * INTO v_pay FROM payment WHERE id = p_payment;
  IF v_pay.category <> 'DROITS_EXAMEN' THEN
    RAISE EXCEPTION 'Le paiement % n''est pas un encaissement de droits d''examen', v_pay.receipt_no;
  END IF;

  SELECT least(fs.retained_fee_mga, v_pay.amount_mga) INTO v_retained
  FROM invoice i JOIN fee_schedule fs ON fs.id = i.fee_schedule_id
  WHERE i.id = p_invoice;

  INSERT INTO payment_allocation (payment_id, invoice_id, amount_mga)
  VALUES (p_payment, p_invoice, v_pay.amount_mga);

  UPDATE invoice
     SET paid_mga = paid_mga + v_pay.amount_mga,
         status   = CASE WHEN paid_mga + v_pay.amount_mga >= amount_mga THEN 'PAYEE' ELSE 'PARTIELLE' END::invoice_status
   WHERE id = p_invoice;

  INSERT INTO ledger_entry (category, label, payment_id, invoice_id, site_id, created_by)
  VALUES ('DROITS_EXAMEN', 'Encaissement droits d''examen ' || v_pay.receipt_no,
          p_payment, p_invoice, v_pay.site_id, p_actor)
  RETURNING id INTO v_entry;

  INSERT INTO ledger_line (entry_id, account_code, debit_mga, credit_mga) VALUES
    (v_entry, 'EXA-CAISSE',     v_pay.amount_mga, 0),
    (v_entry, 'EXA-FRAIS-DOS',  0, v_retained);
  IF v_pay.amount_mga > v_retained THEN
    INSERT INTO ledger_line (entry_id, account_code, debit_mga, credit_mga)
    VALUES (v_entry, 'EXA-A-REVERSER', 0, v_pay.amount_mga - v_retained);
  END IF;
  RETURN v_entry;
END $$ LANGUAGE plpgsql;

-- -----------------------------------------------------------------------------
-- Transfert d'affectation (ex. 1re/Tle Tamatave → Tana en avril)
-- Ferme l'affectation courante la veille de la bascule et ouvre la nouvelle.
-- AUCUNE donnée n'est déplacée : notes, factures et bulletins restent rattachés
-- à l'inscription. Retourne la liste des élèves transférés et leur solde
-- de frais de scolarité restant (quitus financier à suivre par la comptabilité).
-- -----------------------------------------------------------------------------
CREATE FUNCTION execute_transfer_campaign(p_campaign uuid, p_actor uuid)
RETURNS TABLE (enrollment_id uuid, student text, outstanding_ecolage_mga bigint) AS $$
DECLARE
  c transfer_campaign%ROWTYPE;
BEGIN
  SELECT * INTO c FROM transfer_campaign WHERE id = p_campaign FOR UPDATE;
  IF c.executed_at IS NOT NULL THEN
    RAISE EXCEPTION 'Campagne déjà exécutée le %', c.executed_at;
  END IF;

  CREATE TEMP TABLE _moved ON COMMIT DROP AS
  SELECT sa.id AS assignment_id, sa.enrollment_id
  FROM site_assignment sa
  JOIN enrollment e   ON e.id = sa.enrollment_id
  JOIN school_class k ON k.id = e.class_id
  WHERE e.year_id = c.year_id
    AND sa.site_id = c.from_site_id
    AND k.level_code = ANY (c.level_codes)
    AND sa.valid_during @> c.effective_on
    AND e.left_on IS NULL;

  UPDATE site_assignment sa
     SET valid_during = daterange(lower(sa.valid_during), c.effective_on, '[)')
    FROM _moved m WHERE sa.id = m.assignment_id;

  INSERT INTO site_assignment (enrollment_id, site_id, valid_during, reason, decided_by)
  SELECT m.enrollment_id, c.to_site_id,
         daterange(c.effective_on, (SELECT ends_on + 1 FROM academic_year WHERE id = c.year_id), '[)'),
         'TRANSFERT_EXAMEN', p_actor
  FROM _moved m;

  UPDATE transfer_campaign SET executed_at = now(), executed_by = p_actor WHERE id = p_campaign;

  INSERT INTO audit_log (actor_id, action, entity, entity_id, after_data)
  VALUES (p_actor, 'TRANSFER.EXECUTE', 'transfer_campaign', p_campaign::text,
          jsonb_build_object('students', (SELECT count(*) FROM _moved)));

  RETURN QUERY
  SELECT m.enrollment_id, s.last_name || ' ' || s.first_name,
         coalesce((SELECT sum(i.amount_mga - i.paid_mga) FROM invoice i
                    WHERE i.enrollment_id = m.enrollment_id AND i.category = 'ECOLAGE'
                      AND i.status IN ('EMISE', 'PARTIELLE')), 0)::bigint
  FROM _moved m
  JOIN enrollment e ON e.id = m.enrollment_id
  JOIN student s ON s.id = e.student_id;
END $$ LANGUAGE plpgsql;

-- -----------------------------------------------------------------------------
-- Workflow d'impayés : avancement d'un dossier (appelé par le job quotidien).
--   échéance (le 5) ─ +5 jours comptés → RELANCE ─ +10 → AVERTISSEMENT ─ +25 → MISE_A_PIED*
--   (valeurs par défaut de dunning_policy, comptées depuis l'échéance ou l'étape précédente)
--   * si suspension_requires_direction, la mise à pied n'est notifiée qu'après
--     validation d'un compte Direction (p_actor) ; sinon le dossier attend.
-- Les jours fériés, vacances et mois gelés (octobre) ne comptent pas.
-- -----------------------------------------------------------------------------
-- L'échéance est-elle celle du dernier mois du plan de l'élève (juin, ou mai pour 1re/Tle) ?
CREATE FUNCTION is_last_plan_month(p_enrollment uuid, p_month date) RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM enrollment e
    JOIN school_class c ON c.id = e.class_id
    JOIN tuition_cutoff_rule r ON r.year_id = e.year_id AND r.site_id = c.site_id AND r.level_code = c.level_code
    WHERE e.id = p_enrollment AND r.last_payable_month = extract(month FROM p_month))
$$ LANGUAGE sql STABLE;

CREATE FUNCTION advance_dunning_case(p_case uuid, p_actor uuid DEFAULT NULL, p_today date DEFAULT current_date)
RETURNS dunning_stage AS $$
DECLARE
  d      dunning_case%ROWTYPE;
  e      enrollment%ROWTYPE;
  v_site uuid;
  pol    dunning_policy%ROWTYPE;
  sch    record;
  v_next dunning_stage;
BEGIN
  SELECT * INTO d FROM dunning_case WHERE id = p_case FOR UPDATE;
  IF d.closed_at IS NOT NULL OR d.stage IN ('MISE_A_PIED', 'REGULARISE', 'SUSPENDU') THEN
    RETURN d.stage;
  END IF;
  SELECT * INTO e FROM enrollment WHERE id = d.enrollment_id;
  SELECT c.site_id INTO v_site FROM school_class c WHERE c.id = e.class_id;
  SELECT * INTO pol FROM dunning_policy WHERE year_id = e.year_id AND site_id = v_site;
  SELECT * INTO sch FROM dunning_schedule(e.year_id, v_site, d.due_on, is_last_plan_month(e.id, d.opened_month));

  v_next := CASE
    WHEN p_today >= sch.suspension_on
         AND (NOT pol.suspension_requires_direction
              OR EXISTS (SELECT 1 FROM user_role WHERE user_id = p_actor AND role = 'DIRECTION'))
      THEN 'MISE_A_PIED'
    WHEN p_today >= sch.warning_on THEN 'AVERTISSEMENT'
    ELSE 'RELANCE'
  END::dunning_stage;

  IF v_next <> d.stage THEN
    UPDATE dunning_case
       SET stage = v_next,
           suspension_validated_by = CASE WHEN v_next = 'MISE_A_PIED' THEN p_actor ELSE suspension_validated_by END
     WHERE id = p_case;
    INSERT INTO dunning_event (case_id, from_stage, to_stage, actor_id)
    VALUES (p_case, d.stage, v_next, p_actor);
  END IF;
  RETURN v_next;
END $$ LANGUAGE plpgsql;

-- Dossiers dont la mise à pied est due et attend la validation de la Direction.
CREATE VIEW v_dunning_awaiting_validation AS
SELECT dc.*, s.suspension_on
FROM dunning_case dc
JOIN enrollment e   ON e.id = dc.enrollment_id
JOIN school_class c ON c.id = e.class_id
JOIN dunning_policy p ON p.year_id = e.year_id AND p.site_id = c.site_id
CROSS JOIN LATERAL dunning_schedule(e.year_id, c.site_id, dc.due_on, is_last_plan_month(e.id, dc.opened_month)) s
WHERE dc.stage = 'AVERTISSEMENT' AND dc.closed_at IS NULL
  AND p.suspension_requires_direction AND current_date >= s.suspension_on;

-- -----------------------------------------------------------------------------
-- Gestion des agents : un compte ENT n'est actif qu'entre la date d'entrée et
-- la date de sortie de l'agent (vérifié à chaque connexion).
-- -----------------------------------------------------------------------------
CREATE FUNCTION staff_access_active(p_user uuid, p_day date DEFAULT current_date) RETURNS boolean AS $$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM user_role WHERE user_id = p_user AND role IN ('PARENT', 'ELEVE')) THEN true
    ELSE EXISTS (SELECT 1 FROM staff_member s
                  WHERE s.user_id = p_user AND s.entry_on <= p_day
                    AND (s.exit_on IS NULL OR p_day <= s.exit_on))
  END
$$ LANGUAGE sql STABLE;

-- -----------------------------------------------------------------------------
-- Prix d'un article pour un élève : prix de sa classe s'il existe, sinon prix unique.
-- -----------------------------------------------------------------------------
CREATE FUNCTION fee_price_for(p_item text, p_enrollment uuid) RETURNS bigint AS $$
  SELECT fp.amount_mga
  FROM enrollment e
  JOIN school_class c ON c.id = e.class_id
  JOIN fee_item i     ON i.code = p_item
  JOIN fee_price fp   ON fp.item_id = i.id AND fp.year_id = e.year_id AND fp.site_id = c.site_id
  WHERE e.id = p_enrollment
    AND (fp.level_code = c.level_code OR fp.level_code IS NULL)
    AND (fp.track = c.track OR fp.track IS NULL)
  ORDER BY fp.level_code NULLS LAST, fp.track NULLS LAST
  LIMIT 1
$$ LANGUAGE sql STABLE;

-- Solde de caisse par site et par journal (entrées − sorties).
CREATE VIEW v_cash_balance AS
SELECT site_id, category,
       sum(CASE WHEN direction = 'ENTREE' THEN amount_mga ELSE -amount_mga END) AS balance_mga
FROM cash_movement
GROUP BY site_id, category;

-- Une sortie ne peut pas rendre négatif le solde de caisse de son journal.
CREATE FUNCTION cash_movement_guard() RETURNS trigger AS $$
BEGIN
  IF NEW.direction = 'SORTIE' AND coalesce((SELECT balance_mga FROM v_cash_balance
       WHERE site_id = NEW.site_id AND category = NEW.category), 0) < NEW.amount_mga THEN
    RAISE EXCEPTION 'Solde de caisse insuffisant dans le journal %', NEW.category;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER cash_movement_balance BEFORE INSERT ON cash_movement
  FOR EACH ROW EXECUTE FUNCTION cash_movement_guard();

-- État de compte d'une inscription : factures (débit) et paiements (crédit) par journal.
CREATE VIEW v_account_statement AS
SELECT i.enrollment_id, i.category, i.issued_at::date AS entry_date,
       coalesce((SELECT string_agg(label, ', ') FROM invoice_line WHERE invoice_id = i.id), i.number) AS label,
       i.amount_mga AS debit_mga, 0::bigint AS credit_mga
FROM invoice i WHERE i.status <> 'ANNULEE'
UNION ALL
SELECT i.enrollment_id, p.category, p.received_at::date, 'Paiement ' || p.receipt_no, 0, pa.amount_mga
FROM payment_allocation pa
JOIN payment p ON p.id = pa.payment_id
JOIN invoice i ON i.id = pa.invoice_id;


-- =============================================================================
--  NOTES, COMPÉTENCES ET CONSEIL DE CLASSE
-- =============================================================================

-- Moyenne /20 d'un élève dans un service (classe × matière) pour un trimestre, pondérée par les
-- coefficients ; ABS, DISP et NN exclus. « Ramener sur 20 » : la note compte sur 20 ; sinon elle
-- compte en points dans son barème (8/10 + 14/20 = 22/30 → 14,67/20).
CREATE FUNCTION subject_average(p_enrollment uuid, p_assignment uuid, p_period uuid) RETURNS numeric AS $$
  SELECT round(sum(CASE WHEN e.normalize_to_20 THEN g.value / e.scale_max * 20 ELSE g.value END * e.coefficient)
             / nullif(sum(CASE WHEN e.normalize_to_20 THEN 20 ELSE e.scale_max END * e.coefficient), 0) * 20, 2)
  FROM evaluation e
  JOIN grade g ON g.evaluation_id = e.id AND g.enrollment_id = p_enrollment AND g.status = 'NOTE'
  WHERE e.assignment_id = p_assignment AND e.period_id = p_period
$$ LANGUAGE sql STABLE;

-- Validation des notes du trimestre par l'enseignant :
--   au moins min_evaluations évaluations ET une case remplie (note, ABS, DISP ou NN)
--   pour chaque élève de la classe et chaque évaluation.
CREATE FUNCTION validate_term(p_assignment uuid, p_period uuid, p_actor uuid) RETURNS void AS $$
DECLARE
  v_class uuid; v_year uuid; v_site uuid; v_min int; v_evals int; v_empty int;
BEGIN
  SELECT ta.class_id, c.year_id, c.site_id INTO v_class, v_year, v_site
  FROM teaching_assignment ta JOIN school_class c ON c.id = ta.class_id WHERE ta.id = p_assignment;
  SELECT coalesce((SELECT min_evaluations FROM grading_policy WHERE year_id = v_year AND site_id = v_site), 4) INTO v_min;
  SELECT count(*) INTO v_evals FROM evaluation WHERE assignment_id = p_assignment AND period_id = p_period;
  IF v_evals < v_min THEN
    RAISE EXCEPTION 'Validation impossible : % évaluation(s) sur % minimum', v_evals, v_min;
  END IF;
  SELECT count(*) INTO v_empty
  FROM evaluation ev
  JOIN enrollment en ON en.class_id = v_class AND en.left_on IS NULL
  LEFT JOIN grade g ON g.evaluation_id = ev.id AND g.enrollment_id = en.id
  WHERE ev.assignment_id = p_assignment AND ev.period_id = p_period AND g.evaluation_id IS NULL;
  IF v_empty > 0 THEN
    RAISE EXCEPTION 'Validation impossible : % case(s) vide(s) (saisir une note ou ABS / DISP / NN)', v_empty;
  END IF;
  INSERT INTO term_validation (assignment_id, period_id, validated_by) VALUES (p_assignment, p_period, p_actor)
  ON CONFLICT (assignment_id, period_id) DO UPDATE SET validated_at = now(), validated_by = p_actor;
END $$ LANGUAGE plpgsql;

-- Une fois validées, les notes sont verrouillées (réouverture = suppression de la validation).
CREATE FUNCTION grade_lock_guard() RETURNS trigger AS $$
DECLARE r record;
BEGIN
  SELECT e.assignment_id, e.period_id INTO r FROM evaluation e WHERE e.id = coalesce(NEW.evaluation_id, OLD.evaluation_id);
  IF EXISTS (SELECT 1 FROM term_validation WHERE assignment_id = r.assignment_id AND period_id = r.period_id) THEN
    RAISE EXCEPTION 'Notes validées pour ce trimestre : rouvrir la saisie avant toute modification';
  END IF;
  RETURN coalesce(NEW, OLD);
END $$ LANGUAGE plpgsql;

CREATE TRIGGER grade_lock BEFORE INSERT OR UPDATE OR DELETE ON grade
  FOR EACH ROW EXECUTE FUNCTION grade_lock_guard();

-- Grille du conseil de classe : moyenne de chaque élève dans chaque matière.
CREATE VIEW v_council_grid AS
SELECT en.id AS enrollment_id, en.class_id, ev.period_id, ta.subject_id, s.label AS subject,
       s.in_general_average, s.general_coef,
       subject_average(en.id, ta.id, ev.period_id) AS average,
       EXISTS (SELECT 1 FROM term_validation tv WHERE tv.assignment_id = ta.id AND tv.period_id = ev.period_id) AS validated
FROM teaching_assignment ta
JOIN subject s ON s.id = ta.subject_id
JOIN enrollment en ON en.class_id = ta.class_id
JOIN (SELECT DISTINCT assignment_id, period_id FROM evaluation) ev ON ev.assignment_id = ta.id;

-- Moyenne générale : matières comptées uniquement (hors Arts plastiques, Musique, Vie de classe),
-- pondérées par general_coef.
CREATE FUNCTION general_average(p_enrollment uuid, p_period uuid) RETURNS numeric AS $$
  SELECT round(sum(average * general_coef) / nullif(sum(general_coef), 0), 2)
  FROM v_council_grid
  WHERE enrollment_id = p_enrollment AND period_id = p_period AND in_general_average AND average IS NOT NULL
$$ LANGUAGE sql STABLE;

-- Une évaluation ne vise que les compétences de l'enseignant pour SA classe et SA matière.
CREATE FUNCTION evaluation_competency_guard() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM evaluation e
    JOIN teaching_assignment ta ON ta.id = e.assignment_id
    JOIN competency k ON k.id = NEW.competency_id AND k.subject_id = ta.subject_id AND k.class_id = ta.class_id
    WHERE e.id = NEW.evaluation_id) THEN
    RAISE EXCEPTION 'Compétence hors de la liste de l''enseignant pour cette classe et cette matière';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

-- Reprend dans la liste de l'enseignant les compétences de la base qu'il n'a pas encore.
CREATE FUNCTION adopt_base_competencies(p_assignment uuid) RETURNS int AS $$
DECLARE n int;
BEGIN
  INSERT INTO competency (subject_id, class_id, author_id, based_on, position, label)
  SELECT b.subject_id, ta.class_id, ta.teacher_id, b.id, b.position, b.label
  FROM teaching_assignment ta
  JOIN school_class c ON c.id = ta.class_id
  JOIN competency b ON b.class_id IS NULL AND b.subject_id = ta.subject_id AND b.level_code = c.level_code
  WHERE ta.id = p_assignment
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER evaluation_competency_check BEFORE INSERT ON evaluation_competency
  FOR EACH ROW EXECUTE FUNCTION evaluation_competency_guard();

-- Date de publication par défaut = date du devoir ; remarque seulement si activée sur le devoir.
CREATE FUNCTION evaluation_defaults() RETURNS trigger AS $$
BEGIN
  NEW.publish_on := coalesce(NEW.publish_on, NEW.held_on);
  IF NOT NEW.normalize_to_20 AND NEW.scale_max = 20 THEN NEW.normalize_to_20 := true; END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER evaluation_defaults BEFORE INSERT OR UPDATE ON evaluation
  FOR EACH ROW EXECUTE FUNCTION evaluation_defaults();

CREATE FUNCTION grade_remark_guard() RETURNS trigger AS $$
BEGIN
  IF NEW.remark IS NOT NULL AND NOT (SELECT remarks_enabled FROM evaluation WHERE id = NEW.evaluation_id) THEN
    RAISE EXCEPTION 'Remarques non activées sur ce devoir';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER grade_remark BEFORE INSERT OR UPDATE ON grade
  FOR EACH ROW EXECUTE FUNCTION grade_remark_guard();

-- Notes publiées : élèves à publish_on, parents publish_on + délai de l'Espace Parents.
-- Pas de moyenne de matière côté familles : seule la moyenne de la classe sur le devoir.
CREATE VIEW v_published_grades AS
SELECT g.enrollment_id, e.id AS evaluation_id, e.title, e.held_on, e.eval_type, e.themes, e.comment,
       g.status, g.value, e.scale_max, e.coefficient, CASE WHEN e.remarks_enabled THEN g.remark END AS remark,
       (SELECT round(avg(x.value), 2) FROM grade x WHERE x.evaluation_id = e.id AND x.status = 'NOTE') AS class_average,
       (SELECT max(x.value) FROM grade x WHERE x.evaluation_id = e.id AND x.status = 'NOTE') AS class_max,
       (SELECT min(x.value) FROM grade x WHERE x.evaluation_id = e.id AND x.status = 'NOTE') AS class_min,
       e.publish_on AS students_from,
       e.publish_on + coalesce((SELECT gp.parent_publish_delay_days FROM grading_policy gp
                                 WHERE gp.year_id = c.year_id AND gp.site_id = c.site_id), 1) AS parents_from
FROM grade g
JOIN evaluation e ON e.id = g.evaluation_id
JOIN teaching_assignment ta ON ta.id = e.assignment_id
JOIN school_class c ON c.id = ta.class_id;

-- Terminale : Parcoursup OBLIGATOIRE pour tous ; puis Campus France et TLScontact (visa) pour les
-- élèves ni français ni d'un pays de l'UE / EEE / Suisse. Pas de fiche Avenir (candidats libres).
CREATE FUNCTION higher_ed_steps(p_student uuid) RETURNS text[] AS $$
  SELECT CASE WHEN nationalities && ARRAY['FR','DE','AT','BE','BG','CY','HR','DK','ES','EE','FI','GR','HU','IE','IT','LV','LT',
                                          'LU','MT','NL','PL','PT','CZ','RO','SK','SI','SE','IS','LI','NO','CH']
              THEN ARRAY['PARCOURSUP'] ELSE ARRAY['PARCOURSUP', 'CAMPUS_FRANCE', 'TLS'] END
  FROM student WHERE id = p_student
$$ LANGUAGE sql STABLE;

-- =============================================================================
--  VIE SCOLAIRE ET FAMILLES
-- =============================================================================

-- Jour de classe : jour d'ouverture du site (school_day) hors fériés, vacances et fermetures.
-- (Différent des relances : octobre n'est pas gelé ici.)
CREATE FUNCTION is_school_day(p_site uuid, p_day date) RETURNS boolean AS $$
  SELECT EXISTS (SELECT 1 FROM school_day WHERE site_id = p_site AND weekday = extract(isodow FROM p_day))
     AND NOT EXISTS (SELECT 1 FROM calendar_day_off o
                      WHERE (o.site_id IS NULL OR o.site_id = p_site) AND o.days @> p_day)
$$ LANGUAGE sql STABLE;

CREATE FUNCTION add_school_days(p_site uuid, p_from date, p_n int) RETURNS date AS $$
DECLARE d date := p_from; n int := 0;
BEGIN
  WHILE n < p_n LOOP
    d := d + 1;
    IF d > p_from + 400 THEN RAISE EXCEPTION 'Aucun jour de classe trouvé : vérifier le calendrier'; END IF;
    IF is_school_day(p_site, d) THEN n := n + 1; END IF;
  END LOOP;
  RETURN d;
END $$ LANGUAGE plpgsql STABLE;

-- Restitution d'un téléphone : 24 h → même heure le jour de classe suivant ;
-- 5 jours ouvrés → même heure, 5 jours de classe plus tard.
CREATE FUNCTION phone_return_due() RETURNS trigger AS $$
DECLARE v_site uuid; v_local timestamp;
BEGIN
  SELECT c.site_id INTO v_site FROM enrollment e JOIN school_class c ON c.id = e.class_id WHERE e.id = NEW.enrollment_id;
  v_local := NEW.confiscated_at AT TIME ZONE 'Indian/Antananarivo';
  IF NEW.duration_code IS NULL THEN RETURN NEW; END IF; -- avertissement : le téléphone n'est pas gardé
  NEW.return_due_at := (add_school_days(v_site, v_local::date, CASE NEW.duration_code WHEN '24H' THEN 1 WHEN '48H' THEN 2 ELSE 5 END)
                        + v_local::time) AT TIME ZONE 'Indian/Antananarivo';
  RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER phone_return BEFORE INSERT OR UPDATE OF confiscated_at, duration_code ON phone_confiscation
  FOR EACH ROW EXECUTE FUNCTION phone_return_due();

-- Une sanction disciplinaire ne peut être décidée que par la Direction.
CREATE FUNCTION discipline_measure_guard() RETURNS trigger AS $$
BEGIN
  IF (SELECT kind FROM discipline_measure_type WHERE code = NEW.type_code) = 'SANCTION'
     AND NOT EXISTS (SELECT 1 FROM user_role WHERE user_id = NEW.decided_by AND role = 'DIRECTION') THEN
    RAISE EXCEPTION 'Une sanction ne peut être décidée que par la Direction';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER discipline_measure_check BEFORE INSERT OR UPDATE ON discipline_measure
  FOR EACH ROW EXECUTE FUNCTION discipline_measure_guard();

-- La réponse à une autorisation doit être l'une des options proposées.
CREATE FUNCTION authorization_answer_guard() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM authorization_type WHERE code = NEW.type_code AND NEW.answer = ANY (options)) THEN
    RAISE EXCEPTION 'Réponse « % » non prévue pour cette autorisation', NEW.answer;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER authorization_answer_check BEFORE INSERT OR UPDATE ON authorization_answer
  FOR EACH ROW EXECUTE FUNCTION authorization_answer_guard();

-- Ce que le parent doit encore confirmer (« Je suis informé.e »)
CREATE VIEW v_pending_parent_ack AS
SELECT 'ABSENCE_RETARD' AS kind, a.id, a.enrollment_id, a.occurred_at AS at FROM attendance_event a WHERE a.parent_ack_at IS NULL
UNION ALL
SELECT 'MESURE', m.id, m.enrollment_id, m.decided_on::timestamptz FROM discipline_measure m WHERE m.parent_ack_at IS NULL;

-- Récidive (avertissements compris) : au moins 48 h au 2e fait, 5 jours ouvrés à partir du 3e.
CREATE FUNCTION phone_recidive() RETURNS trigger AS $$
DECLARE n int;
BEGIN
  IF NEW.action = 'AVERTISSEMENT' THEN RETURN NEW; END IF;
  IF coalesce((SELECT p.phone_recidive_5j FROM school_life_policy p
                 JOIN enrollment e ON e.year_id = p.year_id
                 JOIN school_class c ON c.id = e.class_id AND c.site_id = p.site_id
                WHERE e.id = NEW.enrollment_id), true) THEN
    IF NEW.duration_code IS NULL THEN RETURN NEW; END IF; -- durée pas encore décidée
    SELECT count(*) INTO n FROM phone_confiscation WHERE enrollment_id = NEW.enrollment_id AND id <> NEW.id AND confiscated_at < NEW.confiscated_at;
    IF n >= 2 THEN NEW.duration_code := '5J';
    ELSIF n = 1 AND NEW.duration_code = '24H' THEN NEW.duration_code := '48H';
    END IF;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

-- s'exécute avant le calcul de la date de restitution (ordre alphabétique des triggers)
CREATE TRIGGER phone_a_recidive BEFORE INSERT OR UPDATE OF duration_code ON phone_confiscation
  FOR EACH ROW EXECUTE FUNCTION phone_recidive();

-- L'appréciation générale du bulletin est rédigée par la Direction (après le conseil).
CREATE FUNCTION general_comment_guard() RETURNS trigger AS $$
BEGIN
  -- tapée par la Direction ou le secrétariat (d'après les notes de la Directrice)…
  IF NEW.general_comment IS DISTINCT FROM OLD.general_comment AND NEW.general_comment IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM user_role WHERE user_id = NEW.general_comment_by AND role IN ('DIRECTION', 'BUREAU')) THEN
    RAISE EXCEPTION 'L''appréciation générale est rédigée par la Direction ou le secrétariat';
  END IF;
  -- …un texte modifié repasse à valider ; seule la Direction valide
  IF NEW.general_comment IS DISTINCT FROM OLD.general_comment AND NEW.general_comment_status = 'VALIDE'
     AND NEW.general_comment_validated_by IS NOT DISTINCT FROM OLD.general_comment_validated_by THEN
    NEW.general_comment_status := 'A_VALIDER'; NEW.general_comment_validated_by := NULL;
  END IF;
  IF NEW.general_comment_status = 'VALIDE' AND NOT is_direction(NEW.general_comment_validated_by) THEN
    RAISE EXCEPTION 'Seule la Direction valide l''appréciation générale';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER report_card_general_comment BEFORE UPDATE ON report_card
  FOR EACH ROW EXECUTE FUNCTION general_comment_guard();

-- Accusés en attente, avec la relance due (e-mail + application, jamais de SMS)
CREATE OR REPLACE VIEW v_pending_parent_ack AS
SELECT x.*, now() - x.at >= make_interval(hours => coalesce(
         (SELECT p.ack_reminder_hours FROM school_life_policy p
            JOIN enrollment e ON e.year_id = p.year_id
            JOIN school_class c ON c.id = e.class_id AND c.site_id = p.site_id
           WHERE e.id = x.enrollment_id), 48)) AS reminder_due
FROM (
  SELECT 'ABSENCE_RETARD' AS kind, a.id, a.enrollment_id, a.occurred_at AS at FROM attendance_event a WHERE a.parent_ack_at IS NULL
  UNION ALL
  SELECT 'MESURE', m.id, m.enrollment_id, m.decided_on::timestamptz FROM discipline_measure m WHERE m.parent_ack_at IS NULL
) x;

-- -----------------------------------------------------------------------------
-- Spécialités : uniquement en voie générale, 3 en Première, 2 en Terminale
-- -----------------------------------------------------------------------------
CREATE FUNCTION specialty_count_for(p_enrollment uuid) RETURNS int AS $$
  SELECT CASE WHEN c.track = 'GENERALE' AND c.level_code = '1RE' THEN 3
              WHEN c.track = 'GENERALE' AND c.level_code = 'TLE' THEN 2
              ELSE 0 END
  FROM enrollment e JOIN school_class c ON c.id = e.class_id WHERE e.id = p_enrollment
$$ LANGUAGE sql STABLE;

CREATE FUNCTION enrollment_specialty_guard() RETURNS trigger AS $$
DECLARE v_max int := specialty_count_for(NEW.enrollment_id);
BEGIN
  IF v_max = 0 THEN
    RAISE EXCEPTION 'Pas de spécialité dans cette classe (voie générale, Première et Terminale uniquement)';
  END IF;
  IF (SELECT count(*) FROM enrollment_specialty WHERE enrollment_id = NEW.enrollment_id) >= v_max THEN
    RAISE EXCEPTION 'Déjà % spécialités pour cet élève', v_max;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER enrollment_specialty_guard BEFORE INSERT ON enrollment_specialty
  FOR EACH ROW EXECUTE FUNCTION enrollment_specialty_guard();

-- Élèves de voie générale dont le choix de spécialités est incomplet
CREATE VIEW v_specialty_incomplete AS
SELECT e.id AS enrollment_id, specialty_count_for(e.id) AS expected,
       (SELECT count(*) FROM enrollment_specialty es WHERE es.enrollment_id = e.id) AS chosen
FROM enrollment e
WHERE specialty_count_for(e.id) > 0
  AND (SELECT count(*) FROM enrollment_specialty es WHERE es.enrollment_id = e.id) < specialty_count_for(e.id);

-- -----------------------------------------------------------------------------
-- Pas de paiement partiel : chaque facture (mois de frais de scolarité, article,
-- service, droits d'examen) est réglée en entier, et chaque règlement donne un reçu.
-- -----------------------------------------------------------------------------
CREATE FUNCTION allocation_full_guard() RETURNS trigger AS $$
DECLARE v_rest bigint;
BEGIN
  SELECT amount_mga - paid_mga INTO v_rest FROM invoice WHERE id = NEW.invoice_id;
  IF NEW.amount_mga <> v_rest THEN
    RAISE EXCEPTION 'Paiement partiel refusé : la facture doit être réglée en entier (% Ar)', v_rest;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER allocation_full BEFORE INSERT ON payment_allocation
  FOR EACH ROW EXECUTE FUNCTION allocation_full_guard();

-- -----------------------------------------------------------------------------
-- Fiche signalétique : seul un responsable de l'élève signe, avec SA signature de référence.
-- -----------------------------------------------------------------------------
CREATE FUNCTION record_signature_guard() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM guardian_signature s
                  WHERE s.id = NEW.signature_id AND s.guardian_id = NEW.guardian_id AND s.replaced_at IS NULL) THEN
    RAISE EXCEPTION 'Signature refusée : ce n''est pas la signature de référence de ce responsable';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM student_record_form f
                   JOIN enrollment e ON e.id = f.enrollment_id
                   JOIN student_guardian sg ON sg.student_id = e.student_id AND sg.guardian_id = NEW.guardian_id
                  WHERE f.id = NEW.form_id) THEN
    RAISE EXCEPTION 'Signature refusée : ce compte n''est pas responsable de l''élève';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER record_signature_check BEFORE INSERT ON student_record_signature
  FOR EACH ROW EXECUTE FUNCTION record_signature_guard();

-- -----------------------------------------------------------------------------
-- Contrôle de caisse, réductions, manuels et remise des bulletins
-- -----------------------------------------------------------------------------
CREATE FUNCTION is_direction(p_user uuid) RETURNS boolean AS $$
  SELECT EXISTS (SELECT 1 FROM user_role WHERE user_id = p_user AND role = 'DIRECTION')
$$ LANGUAGE sql STABLE;

-- Seule la Direction décide d'une annulation de reçu, accorde une réduction ou lève un blocage.
CREATE FUNCTION direction_only_guard() RETURNS trigger AS $$
DECLARE v_user uuid := (to_jsonb(NEW) ->> CASE TG_TABLE_NAME
    WHEN 'payment_cancellation' THEN 'decided_by'
    WHEN 'enrollment_reduction' THEN 'granted_by'
    WHEN 'bulletin_handover' THEN 'override_by' END)::uuid;
BEGIN
  IF v_user IS NOT NULL AND NOT is_direction(v_user) THEN
    RAISE EXCEPTION 'Réservé à la Direction (%)', TG_TABLE_NAME;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER payment_cancellation_direction BEFORE INSERT OR UPDATE ON payment_cancellation FOR EACH ROW EXECUTE FUNCTION direction_only_guard();
CREATE TRIGGER enrollment_reduction_direction BEFORE INSERT OR UPDATE ON enrollment_reduction FOR EACH ROW EXECUTE FUNCTION direction_only_guard();
CREATE TRIGGER bulletin_handover_direction BEFORE INSERT OR UPDATE ON bulletin_handover FOR EACH ROW EXECUTE FUNCTION direction_only_guard();

-- Caisse clôturée : plus d'encaissement ce jour-là sur ce site.
CREATE FUNCTION payment_after_closing_guard() RETURNS trigger AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM cash_closing WHERE site_id = NEW.site_id AND day = NEW.received_at::date) THEN
    RAISE EXCEPTION 'La caisse du % est clôturée : encaissement impossible', to_char(NEW.received_at, 'DD/MM/YYYY');
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER payment_after_closing BEFORE INSERT ON payment FOR EACH ROW EXECUTE FUNCTION payment_after_closing_guard();

-- Ce qui bloque la remise d'un bulletin : frais échus non réglés, manuel dû (perdu non réglé
-- ou non rendu à la date prévue).
CREATE VIEW v_bulletin_blocked AS
SELECT e.id AS enrollment_id, 'FRAIS_IMPAYES' AS reason, count(*)::int AS items
FROM enrollment e JOIN invoice i ON i.enrollment_id = e.id
WHERE i.status IN ('EMISE', 'PARTIELLE') AND i.due_on < current_date
GROUP BY e.id
UNION ALL
SELECT l.enrollment_id, 'MANUEL_DU', count(*)::int
FROM textbook_loan l
WHERE (l.lost_on IS NOT NULL AND l.charge_payment_id IS NULL)
   OR (l.state_in = 'DECHIRE' AND l.state_out <> 'DECHIRE' AND l.charge_payment_id IS NULL)
   OR (l.returned_on IS NULL AND l.lost_on IS NULL AND l.due_back IS NOT NULL AND l.due_back < current_date)
GROUP BY l.enrollment_id;

CREATE FUNCTION bulletin_handover_guard() RETURNS trigger AS $$
BEGIN
  IF NEW.given_at IS NOT NULL AND NEW.override_by IS NULL
     AND EXISTS (SELECT 1 FROM v_bulletin_blocked WHERE enrollment_id = NEW.enrollment_id) THEN
    RAISE EXCEPTION 'Bulletin bloqué : frais impayés ou manuel dû (seule la Direction peut lever le blocage)';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER bulletin_handover_check BEFORE INSERT OR UPDATE ON bulletin_handover FOR EACH ROW EXECUTE FUNCTION bulletin_handover_guard();

-- Prêt d'un titre : à rendre → date de retour obligatoire ; gardé → pas de date ;
-- manuel de spécialité → seulement aux élèves qui suivent la spécialité.
CREATE FUNCTION textbook_loan_guard() RETURNS trigger AS $$
DECLARE t textbook%ROWTYPE;
BEGIN
  SELECT * INTO t FROM textbook WHERE id = NEW.textbook_id;
  IF t.is_returnable AND NEW.due_back IS NULL THEN RAISE EXCEPTION 'Titre à rendre : date de retour obligatoire'; END IF;
  IF NOT t.is_returnable AND NEW.due_back IS NOT NULL THEN RAISE EXCEPTION 'Cahier gardé par l''élève : pas de date de retour'; END IF;
  IF t.specialty IS NOT NULL AND NOT EXISTS (SELECT 1 FROM enrollment_specialty WHERE enrollment_id = NEW.enrollment_id AND specialty = t.specialty) THEN
    RAISE EXCEPTION 'Manuel de spécialité % : l''élève ne suit pas cette spécialité', t.specialty;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER textbook_loan_check BEFORE INSERT ON textbook_loan FOR EACH ROW EXECUTE FUNCTION textbook_loan_guard();

-- Réduction attribuable seulement si ses taux sont définis.
CREATE FUNCTION enrollment_reduction_rates_guard() RETURNS trigger AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM reduction_type WHERE code = NEW.type_code AND coalesce(rate_tuition, 0) = 0 AND coalesce(rate_enrollment, 0) = 0) THEN
    RAISE EXCEPTION 'Réduction % : taux à définir par la Direction avant de l''accorder', NEW.type_code;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER enrollment_reduction_rates BEFORE INSERT OR UPDATE ON enrollment_reduction FOR EACH ROW EXECUTE FUNCTION enrollment_reduction_rates_guard();

-- Versement oublié : dernier jour de versement prévu sans aucun versement depuis.
CREATE VIEW v_deposit_missed AS
SELECT ds.site_id, d.day AS missed_day
FROM deposit_schedule ds
CROSS JOIN LATERAL (
  SELECT max(g)::date AS day FROM generate_series(current_date - 7, current_date - 1, interval '1 day') g
  WHERE extract(isodow FROM g)::smallint = ANY (ds.weekdays)
) d
WHERE d.day IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM bank_deposit b WHERE b.site_id = ds.site_id AND b.deposited_on >= d.day);

-- -----------------------------------------------------------------------------
-- Salaires, engagements, bibliothèque
-- -----------------------------------------------------------------------------
-- Paiement d'un salaire seulement si l'état de paie du mois est validé par la Direction.
-- Salaires : le secrétariat prépare et paie sans attendre la Direction (qui voit tout et reçoit un
-- récapitulatif) ; seuls le secrétariat et la Direction paient. Les taux horaires restent à la Direction.
CREATE FUNCTION payroll_payment_guard() RETURNS trigger AS $$
BEGIN
  IF NEW.paid_at IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM user_role WHERE user_id = NEW.paid_by AND role IN ('BUREAU', 'DIRECTION')) THEN
    RAISE EXCEPTION 'Paiement des salaires réservé au secrétariat et à la Direction';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER payroll_payment_check BEFORE INSERT OR UPDATE ON payroll_line FOR EACH ROW EXECUTE FUNCTION payroll_payment_guard();

CREATE FUNCTION payroll_validation_guard() RETURNS trigger AS $$
BEGIN
  IF NEW.validated_by IS NOT NULL AND NOT is_direction(NEW.validated_by) THEN
    RAISE EXCEPTION 'Seule la Direction valide l''état de paie';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER payroll_validation_check BEFORE INSERT OR UPDATE ON payroll_month FOR EACH ROW EXECUTE FUNCTION payroll_validation_guard();

-- Au plus 2 délégués et 2 suppléants par classe.
CREATE FUNCTION engagement_guard() RETURNS trigger AS $$
BEGIN
  -- mandats (délégués, BDE) : attribués par la Direction seule
  IF NEW.code IN ('DELEGUE', 'SUPPLEANT', 'BDE', 'BDE_PRESIDENT') AND current_app_user() IS NOT NULL AND NOT has_role(current_app_user(), 'DIRECTION') THEN
    RAISE EXCEPTION 'Les mandats de délégué et de BDE sont attribués par la Direction';
  END IF;
  IF NEW.code IN ('DELEGUE', 'SUPPLEANT') AND (
       SELECT count(*) FROM student_engagement se JOIN enrollment e ON e.id = se.enrollment_id
        WHERE se.code = NEW.code AND e.class_id = (SELECT class_id FROM enrollment WHERE id = NEW.enrollment_id)) >= 2 THEN
    RAISE EXCEPTION 'Au plus 2 % par classe', lower(NEW.code::text);
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER engagement_check BEFORE INSERT ON student_engagement FOR EACH ROW EXECUTE FUNCTION engagement_guard();

-- Prolongation d'un emprunt d'élève : un mois à partir du jour où le livre est présenté.
CREATE FUNCTION renew_library_loan(p_loan uuid, p_presented boolean, p_today date DEFAULT current_date) RETURNS date AS $$
DECLARE v library_loan%ROWTYPE;
BEGIN
  SELECT * INTO v FROM library_loan WHERE id = p_loan;
  IF v.staff_id IS NOT NULL THEN RAISE EXCEPTION 'Les professeurs n''ont pas de date limite'; END IF;
  IF NOT p_presented THEN RAISE EXCEPTION 'Le livre doit être présenté au bureau pour être prolongé'; END IF;
  UPDATE library_loan SET due_on = p_today + 30, renewals = renewals + 1 WHERE id = p_loan;
  RETURN p_today + 30;
END $$ LANGUAGE plpgsql;

-- Livres de la salle d'étude en retard : bloquent la remise du bulletin (comme un manuel).
CREATE OR REPLACE VIEW v_bulletin_blocked AS
SELECT e.id AS enrollment_id, 'FRAIS_IMPAYES' AS reason, count(*)::int AS items
FROM enrollment e JOIN invoice i ON i.enrollment_id = e.id
WHERE i.status IN ('EMISE', 'PARTIELLE') AND i.due_on < current_date
GROUP BY e.id
UNION ALL
SELECT l.enrollment_id, 'MANUEL_DU', count(*)::int
FROM textbook_loan l
WHERE (l.lost_on IS NOT NULL AND l.charge_payment_id IS NULL)
   OR (l.state_in = 'DECHIRE' AND l.state_out <> 'DECHIRE' AND l.charge_payment_id IS NULL)
   OR (l.returned_on IS NULL AND l.lost_on IS NULL AND l.due_back IS NOT NULL AND l.due_back < current_date)
GROUP BY l.enrollment_id
UNION ALL
SELECT enrollment_id, 'LIVRE', count(*)::int
FROM library_loan
WHERE enrollment_id IS NOT NULL AND returned_on IS NULL AND due_on < current_date
GROUP BY enrollment_id;

-- Les professeurs sont automatiquement vacataires : payés à l'heure de cours effectuée,
-- rien pendant les vacances scolaires.
CREATE FUNCTION teacher_contract_default() RETURNS trigger AS $$
BEGIN
  IF NEW.job_title = 'Enseignant.e' THEN NEW.contract := 'VACATAIRE'; END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER teacher_contract BEFORE INSERT OR UPDATE ON staff_member FOR EACH ROW EXECUTE FUNCTION teacher_contract_default();

-- Taux horaire en vigueur à une date (dernière date d'effet passée).
CREATE FUNCTION rate_on(p_staff uuid, p_day date) RETURNS bigint AS $$
  SELECT rate_mga FROM hourly_rate WHERE staff_id = p_staff AND effective_from <= p_day ORDER BY effective_from DESC LIMIT 1
$$ LANGUAGE sql STABLE;

-- Ligne de paie d'un vacataire : le taux est celui en vigueur au mois payé.
CREATE FUNCTION payroll_rate_default() RETURNS trigger AS $$
BEGIN
  IF NEW.hours_done IS NOT NULL AND NEW.hourly_mga IS NULL THEN
    NEW.hourly_mga := rate_on(NEW.staff_id, NEW.month);
    IF NEW.hourly_mga IS NULL THEN RAISE EXCEPTION 'Aucun taux horaire en vigueur pour ce professeur au %', to_char(NEW.month, 'MM/YYYY'); END IF;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER payroll_rate BEFORE INSERT ON payroll_line FOR EACH ROW EXECUTE FUNCTION payroll_rate_default();

-- Demandes des familles : seul un responsable de l'élève peut en déposer une,
-- et seuls le Bureau ou la Direction la traitent.
CREATE FUNCTION family_request_guard() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM student_guardian WHERE student_id = NEW.student_id AND guardian_id = NEW.submitted_by) THEN
    RAISE EXCEPTION 'Seul un responsable légal de l''élève peut faire cette demande';
  END IF;
  IF NEW.decided_by IS NOT NULL AND NOT EXISTS (SELECT 1 FROM user_role WHERE user_id = NEW.decided_by AND role IN ('BUREAU', 'DIRECTION')) THEN
    RAISE EXCEPTION 'Demande traitée par le Bureau ou la Direction uniquement';
  END IF;
  IF NEW.decided_by IS NOT NULL AND NEW.decided_at IS NULL THEN NEW.decided_at := now(); END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER family_request_check BEFORE INSERT OR UPDATE ON family_request FOR EACH ROW EXECUTE FUNCTION family_request_guard();

-- Demande de signature : demandée par le Bureau, la Vie scolaire ou la Direction ; signée par
-- la Direction seule, avec sa propre signature ; code de vérification attribué à la signature.
CREATE FUNCTION signature_request_guard() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM user_role WHERE user_id = NEW.requested_by AND role IN ('BUREAU', 'VIE_SCOLAIRE', 'DIRECTION')) THEN
    RAISE EXCEPTION 'Demande réservée au Bureau, à la Vie scolaire ou à la Direction';
  END IF;
  IF NEW.status <> 'DEMANDEE' THEN
    IF NEW.signed_by IS NULL OR NOT is_direction(NEW.signed_by) THEN
      RAISE EXCEPTION 'Seule la Direction signe ou refuse un document';
    END IF;
    IF NEW.status = 'SIGNEE' AND NOT EXISTS (SELECT 1 FROM official_signature WHERE id = NEW.signature_id AND user_id = NEW.signed_by AND revoked_at IS NULL) THEN
      RAISE EXCEPTION 'La signature utilisée n''est pas celle du signataire';
    END IF;
    IF NEW.signed_at IS NULL THEN NEW.signed_at := now(); END IF;
    IF NEW.status = 'SIGNEE' AND NEW.verification_code IS NULL THEN
      NEW.verification_code := upper(substr(md5(NEW.id::text || clock_timestamp()::text), 1, 4) || '-' || substr(md5(random()::text), 1, 4));
    END IF;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER signature_request_check BEFORE INSERT OR UPDATE ON signature_request FOR EACH ROW EXECUTE FUNCTION signature_request_guard();

-- Tableau de bord de trésorerie, par site :
--   trésorerie nette = encaissements (hors reçus annulés) − dépenses payées − salaires payés
--   reste à recouvrer = factures émises non réglées ; dépenses engagées = dépenses à payer + salaires non payés
CREATE VIEW v_treasury AS
WITH paid_in AS (
  SELECT p.site_id, sum(p.amount_mga) AS mga FROM payment p
  WHERE NOT EXISTS (SELECT 1 FROM payment_cancellation c WHERE c.payment_id = p.id AND c.approved)
  GROUP BY p.site_id
), paid_out AS (
  SELECT site_id, sum(amount_mga) AS mga FROM expense WHERE status = 'PAYE' GROUP BY site_id
  UNION ALL
  SELECT site_id, sum(net_mga) FROM payroll_line WHERE paid_at IS NOT NULL GROUP BY site_id
), due AS (
  SELECT c.site_id, sum(s.debit_mga - s.credit_mga) AS mga
  FROM v_account_statement s JOIN enrollment e ON e.id = s.enrollment_id JOIN school_class c ON c.id = e.class_id
  GROUP BY c.site_id
), committed AS (
  SELECT site_id, sum(amount_mga) AS mga FROM expense WHERE status = 'EN_ATTENTE' GROUP BY site_id
  UNION ALL
  SELECT site_id, sum(net_mga) FROM payroll_line WHERE paid_at IS NULL GROUP BY site_id
)
SELECT s.id AS site_id,
       coalesce((SELECT mga FROM paid_in WHERE site_id = s.id), 0) - coalesce((SELECT sum(mga) FROM paid_out WHERE site_id = s.id), 0) AS net_mga,
       greatest(coalesce((SELECT mga FROM due WHERE site_id = s.id), 0), 0) AS to_collect_mga,
       coalesce((SELECT sum(mga) FROM committed WHERE site_id = s.id), 0) AS committed_mga
FROM site s;

-- La séance déclarée doit exister ce jour-là dans l'emploi du temps (bon jour de semaine, période valide).
CREATE FUNCTION teacher_absence_guard() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM timetable_slot s WHERE s.id = NEW.slot_id
                   AND s.weekday = extract(isodow FROM NEW.on_date) AND s.valid_during @> NEW.on_date) THEN
    RAISE EXCEPTION 'Pas de séance de ce professeur à cette date dans l''emploi du temps';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER teacher_absence_check BEFORE INSERT OR UPDATE ON teacher_absence FOR EACH ROW EXECUTE FUNCTION teacher_absence_guard();

-- Seuls la Direction, le secrétariat et la vie scolaire partagent une ressource interne.
CREATE FUNCTION internal_resource_guard() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM user_role WHERE user_id = NEW.shared_by AND role IN ('DIRECTION', 'BUREAU', 'VIE_SCOLAIRE')) THEN
    RAISE EXCEPTION 'Partage réservé à la Direction, au secrétariat et à la vie scolaire';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER internal_resource_check BEFORE INSERT OR UPDATE ON internal_resource FOR EACH ROW EXECUTE FUNCTION internal_resource_guard();

-- Heures d'un professeur sur une période : prévues (emploi du temps, jours de classe), d'absence, faites.
CREATE FUNCTION teacher_hours(p_teacher uuid, p_from date, p_to date)
RETURNS TABLE (planned numeric, absent numeric, done numeric) AS $$
  WITH sessions AS (
    SELECT s.id AS slot_id, d::date AS on_date, extract(epoch FROM s.ends_at - s.starts_at) / 3600 AS hours
    FROM timetable_slot s JOIN teaching_assignment a ON a.id = s.assignment_id
    JOIN school_class c ON c.id = a.class_id
    CROSS JOIN generate_series(p_from, p_to, interval '1 day') d
    WHERE a.teacher_id = p_teacher AND extract(isodow FROM d) = s.weekday AND s.valid_during @> d::date
      AND is_school_day(c.site_id, d::date)
  )
  SELECT coalesce(sum(hours), 0),
         coalesce(sum(hours) FILTER (WHERE EXISTS (SELECT 1 FROM teacher_absence t WHERE t.slot_id = sessions.slot_id AND t.on_date = sessions.on_date)), 0),
         coalesce(sum(hours) FILTER (WHERE NOT EXISTS (SELECT 1 FROM teacher_absence t WHERE t.slot_id = sessions.slot_id AND t.on_date = sessions.on_date)), 0)
  FROM sessions
$$ LANGUAGE sql STABLE;

-- Dispense de travail : par la Direction seulement.
CREATE FUNCTION teacher_absence_grant_guard() RETURNS trigger AS $$
BEGIN
  IF NEW.granted_by IS NOT NULL AND NOT is_direction(NEW.granted_by) THEN
    RAISE EXCEPTION 'Seule la Direction dispense de laisser un travail';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER teacher_absence_grant BEFORE INSERT OR UPDATE ON teacher_absence FOR EACH ROW EXECUTE FUNCTION teacher_absence_grant_guard();

-- Heures de retard à rattraper : une heure par tranche de 60 minutes cumulées, moins les heures rattrapées.
CREATE VIEW v_teacher_lateness AS
SELECT t.teacher_id, t.minutes_total, floor(t.minutes_total / 60.0)::int AS hours_owed,
       coalesce(m.hours, 0) AS hours_made_up,
       greatest(floor(t.minutes_total / 60.0) - coalesce(m.hours, 0), 0) AS hours_to_make_up
FROM (SELECT teacher_id, sum(minutes)::int AS minutes_total FROM teacher_lateness GROUP BY teacher_id) t
LEFT JOIN (SELECT teacher_id, sum(hours) AS hours FROM teacher_makeup GROUP BY teacher_id) m USING (teacher_id);

-- Un jeu ne sort pas si tous ses exemplaires sont déjà dehors.
CREATE FUNCTION board_game_use_guard() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' AND (SELECT count(*) FROM board_game_use WHERE game_id = NEW.game_id AND back_at IS NULL)
       >= (SELECT copies FROM board_game WHERE id = NEW.game_id) THEN
    RAISE EXCEPTION 'Tous les exemplaires de ce jeu sont sortis';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER board_game_use_check BEFORE INSERT ON board_game_use FOR EACH ROW EXECUTE FUNCTION board_game_use_guard();

-- Ce que voit une personne : ses publics (élève, parent, professeur, personnel) ; l'équipe de direction voit tout.
CREATE FUNCTION resources_for(p_user uuid) RETURNS SETOF internal_resource AS $$
  SELECT r.* FROM internal_resource r
  WHERE EXISTS (SELECT 1 FROM user_role u WHERE u.user_id = p_user AND (
          u.role IN ('DIRECTION', 'BUREAU', 'VIE_SCOLAIRE')
       OR (u.role = 'PROFESSEUR' AND 'PROFS' = ANY (r.audiences))
       OR (u.role = 'PARENT' AND 'PARENTS' = ANY (r.audiences))
       OR (u.role = 'ELEVE' AND 'ELEVES' = ANY (r.audiences))))
$$ LANGUAGE sql STABLE;

-- Seule la Direction répond à une suggestion.
CREATE FUNCTION staff_suggestion_guard() RETURNS trigger AS $$
BEGIN
  IF NEW.answered_by IS NOT NULL AND NOT is_direction(NEW.answered_by) THEN
    RAISE EXCEPTION 'Seule la Direction répond aux suggestions';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER staff_suggestion_check BEFORE INSERT OR UPDATE ON staff_suggestion FOR EACH ROW EXECUTE FUNCTION staff_suggestion_guard();

-- Changements d'emploi du temps : décidés par la Direction ou le secrétariat.
CREATE FUNCTION timetable_change_guard() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM user_role WHERE user_id = NEW.decided_by AND role IN ('DIRECTION', 'BUREAU')) THEN
    RAISE EXCEPTION 'Changement d''emploi du temps réservé à la Direction et au secrétariat';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER timetable_change_check BEFORE INSERT OR UPDATE ON timetable_change FOR EACH ROW EXECUTE FUNCTION timetable_change_guard();

-- Mineur ou majeur : calculé à partir de la date de naissance au moment de la sortie.
CREATE FUNCTION early_departure_minor() RETURNS trigger AS $$
BEGIN
  NEW.student_is_minor := (SELECT age(NEW.left_at::date, s.birth_date) < interval '18 years'
                           FROM enrollment e JOIN student s ON s.id = e.student_id WHERE e.id = NEW.enrollment_id);
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER early_departure_age BEFORE INSERT OR UPDATE ON early_departure FOR EACH ROW EXECUTE FUNCTION early_departure_minor();

-- Inventaire : chaque mouvement met à jour les quantités (jamais plus de casse que d'articles en état).
CREATE FUNCTION inventory_apply() RETURNS trigger AS $$
BEGIN
  UPDATE inventory_item SET
    broken = broken + CASE NEW.kind WHEN 'CASSE' THEN NEW.n WHEN 'REPARE' THEN -NEW.n WHEN 'JETE' THEN -NEW.n ELSE 0 END,
    qty    = qty    + CASE NEW.kind WHEN 'ACHAT' THEN NEW.n WHEN 'JETE' THEN -NEW.n WHEN 'UTILISE' THEN -NEW.n ELSE 0 END
  WHERE id = NEW.item_id;
  IF EXISTS (SELECT 1 FROM inventory_item WHERE id = NEW.item_id AND (broken < 0 OR broken > qty)) THEN
    RAISE EXCEPTION 'Quantité incorrecte pour cet article';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER inventory_movement_apply AFTER INSERT ON inventory_movement FOR EACH ROW EXECUTE FUNCTION inventory_apply();

-- Passage : le Doliprane est donné par le secrétariat seulement, jamais en cas d'allergie au paracétamol
-- déclarée, jamais deux fois en moins de 6 heures ; il est retiré du stock du site.
CREATE FUNCTION care_visit_guard() RETURNS trigger AS $$
DECLARE item uuid; BEGIN
  IF NEW.paracetamol THEN
    IF NOT EXISTS (SELECT 1 FROM user_role WHERE user_id = NEW.recorded_by AND role = 'BUREAU') THEN
      RAISE EXCEPTION 'Le Doliprane est donné par le secrétariat';
    END IF;
    IF EXISTS (SELECT 1 FROM enrollment e JOIN student s ON s.id = e.student_id
               WHERE e.id = NEW.enrollment_id AND s.health_notes ~* '(paracétamol|paracetamol|doliprane)') THEN
      RAISE EXCEPTION 'Allergie au paracétamol déclarée : pas de Doliprane';
    END IF;
    IF EXISTS (SELECT 1 FROM care_visit WHERE enrollment_id = NEW.enrollment_id AND paracetamol
               AND at > NEW.at - interval '6 hours' AND at <= NEW.at) THEN
      RAISE EXCEPTION 'Doliprane déjà donné il y a moins de 6 heures';
    END IF;
    SELECT i.id INTO item FROM inventory_item i JOIN enrollment e ON e.id = NEW.enrollment_id
      JOIN school_class c ON c.id = e.class_id
      WHERE i.is_paracetamol AND i.site_id = c.site_id AND i.qty - i.broken > 0 LIMIT 1;
    IF item IS NULL THEN RAISE EXCEPTION 'Plus de Doliprane en stock'; END IF;
    INSERT INTO inventory_movement (item_id, kind, n, note, by_user, at) VALUES (item, 'UTILISE', 1, 'passage', NEW.recorded_by, NEW.at);
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER care_visit_check BEFORE INSERT ON care_visit FOR EACH ROW EXECUTE FUNCTION care_visit_guard();

-- Un événement est-il visible ? (personnel, ou élève / parent d'un élève de la classe donnée)
CREATE FUNCTION event_visible(ev school_event, is_staff boolean, for_class uuid) RETURNS boolean AS $$
  SELECT ev.status = 'PUBLIEE' AND CASE ev.calendar
    WHEN 'EQUIPE' THEN is_staff
    WHEN 'EXAMENS' THEN is_staff OR (EXISTS (SELECT 1 FROM school_class c JOIN level l ON l.code = c.level_code
                                             WHERE c.id = for_class AND l.official_exam IS NOT NULL)
                                     AND (ev.class_id IS NULL OR ev.class_id = for_class))
    ELSE is_staff OR ev.class_id IS NULL OR ev.class_id = for_class
  END
$$ LANGUAGE sql STABLE;

-- Un examen blanc correspond au niveau de la classe : brevet en 3e, épreuves de 1re en 1re, bac en Terminale.
CREATE FUNCTION mock_exam_guard() RETURNS trigger AS $$
DECLARE lvl text := (SELECT level_code FROM school_class WHERE id = NEW.class_id); BEGIN
  IF (NEW.kind = 'DNB' AND lvl <> '3E') OR (NEW.kind LIKE 'PREMIERE%' AND lvl <> '1RE') OR (NEW.kind LIKE 'BAC%' AND lvl <> 'TLE') THEN
    RAISE EXCEPTION 'Examen blanc % impossible en %', NEW.kind, lvl;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER mock_exam_level BEFORE INSERT OR UPDATE ON mock_exam FOR EACH ROW EXECUTE FUNCTION mock_exam_guard();

-- Saisie : la Direction et le secrétariat saisissent tout ; un professeur, seulement l'épreuve de sa matière
-- dans une classe où il l'enseigne.
CREATE FUNCTION mock_exam_mark_guard() RETURNS trigger AS $$
BEGIN
  IF NEW.entered_by IS NULL OR EXISTS (SELECT 1 FROM user_role WHERE user_id = NEW.entered_by AND role IN ('DIRECTION', 'BUREAU')) THEN RETURN NEW; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM mock_exam_part p LEFT JOIN mock_exam_part par ON par.id = p.parent_id JOIN mock_exam x ON x.id = p.mock_exam_id
    JOIN teaching_assignment t ON t.class_id = x.class_id AND t.subject_id = coalesce(p.subject_id, par.subject_id) AND t.teacher_id = NEW.entered_by
    WHERE p.id = NEW.part_id) THEN
    RAISE EXCEPTION 'Un professeur saisit seulement l''épreuve de sa matière, dans ses classes';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER mock_exam_mark_check BEFORE INSERT OR UPDATE ON mock_exam_mark FOR EACH ROW EXECUTE FUNCTION mock_exam_mark_guard();

-- Le professeur compte son épreuve dans son carnet : une évaluation « Examen blanc » avec le coefficient
-- choisi, et les notes recopiées (absent : ABSENT). Renvoie l'évaluation créée.
CREATE FUNCTION count_mock_part_in_gradebook(part uuid, teacher uuid, coef numeric, term uuid) RETURNS uuid AS $$
DECLARE p record; ev uuid; asg uuid; BEGIN
  SELECT mp.*, x.class_id, x.title AS exam_title, x.held_on INTO p FROM mock_exam_part mp JOIN mock_exam x ON x.id = mp.mock_exam_id WHERE mp.id = part AND mp.parent_id IS NULL;
  SELECT id INTO asg FROM teaching_assignment WHERE class_id = p.class_id AND subject_id = p.subject_id AND teacher_id = teacher;
  IF asg IS NULL THEN RAISE EXCEPTION 'Épreuve d''une autre matière ou d''une autre classe'; END IF;
  INSERT INTO evaluation (assignment_id, period_id, eval_type, title, held_on, publish_on, coefficient)
  VALUES (asg, term, 'EXAMEN_BLANC', p.exam_title || ' — ' || p.label, p.held_on, p.held_on, coef) RETURNING id INTO ev;
  INSERT INTO grade (evaluation_id, enrollment_id, status, value, entered_by)
  SELECT ev, pm.enrollment_id, CASE WHEN m.absent THEN 'ABSENT'::grade_status ELSE 'NOTE'::grade_status END, CASE WHEN m.absent THEN NULL ELSE pm.mark END, teacher
  FROM v_mock_exam_part_mark pm LEFT JOIN mock_exam_mark m ON m.part_id = pm.part_id AND m.enrollment_id = pm.enrollment_id WHERE pm.part_id = part;
  UPDATE mock_exam_part SET gradebook_evaluation_id = ev WHERE id = part;
  RETURN ev;
END $$ LANGUAGE plpgsql;

-- Projection au bac (sur 100) : notes officielles de 1re (avec leurs coefficients) ; moyenne à obtenir
-- aux épreuves de Terminale pour une moyenne visée ; NULL si hors d'atteinte.
CREATE FUNCTION bac_needed(student uuid, target numeric) RETURNS numeric AS $$
  SELECT CASE WHEN v > 20 THEN NULL ELSE greatest(0, round(v, 2)) END FROM (
    SELECT (target * 100 - coalesce(sum(mark * coef), 0)) / (100 - coalesce(sum(coef), 0)) AS v
    FROM official_exam_mark WHERE student_id = student) q
$$ LANGUAGE sql STABLE;

-- Passeport : un TIG est décidé par la Direction seule.
-- Colle pour oubli : carnet de liaison selon la règle d'ancienneté ; autre oubli, seulement si elle a été demandée.
CREATE FUNCTION detention_guard() RETURNS trigger AS $$
DECLARE f school_forget;
BEGIN
  IF NEW.kind = 'TIG' AND NOT EXISTS (SELECT 1 FROM user_role WHERE user_id = NEW.given_by AND role = 'DIRECTION') THEN
    RAISE EXCEPTION 'Un TIG est décidé par la Direction';
  END IF;
  -- colle : le mercredi de 13h à 17h ou le samedi de 8h à 12h, et jamais en même temps qu'une autre colle de l'élève
  IF NEW.kind = 'COLLE' THEN
    IF NOT colle_slot_ok(NEW.scheduled_at, NEW.hours) THEN
      RAISE EXCEPTION 'Une colle a lieu le mercredi après-midi (13h–17h) ou le samedi matin (8h–12h)';
    END IF;
    IF EXISTS (SELECT 1 FROM detention d WHERE d.enrollment_id = NEW.enrollment_id AND d.id <> NEW.id AND d.kind = 'COLLE' AND d.status <> 'NON_FAITE'
               AND tstzrange(d.scheduled_at, d.scheduled_at + make_interval(hours => d.hours)) && tstzrange(NEW.scheduled_at, NEW.scheduled_at + make_interval(hours => NEW.hours))) THEN
      RAISE EXCEPTION 'L''élève a déjà une colle à ce moment : les colles se suivent';
    END IF;
  END IF;
  IF TG_OP = 'INSERT' AND NEW.cause = 'OUBLI' THEN
    SELECT * INTO f FROM school_forget WHERE id = NEW.forget_id;
    IF f.kind = 'CARNET' AND carnet_colles_due(NEW.enrollment_id) < 1 THEN
      RAISE EXCEPTION 'Pas encore de colle : nouvel élève, une heure au 2e oubli du carnet';
    ELSIF f.kind <> 'CARNET' AND NOT f.colle_requested THEN
      RAISE EXCEPTION 'Oubli sans colle demandée par le professeur ou la CPE';
    END IF;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER detention_check BEFORE INSERT OR UPDATE ON detention FOR EACH ROW EXECUTE FUNCTION detention_guard();

-- Colles dues pour retards : une par tranche de trois retards, moins celles déjà données.
CREATE FUNCTION colles_due_for_lates(enr uuid) RETURNS integer AS $$
  SELECT (lates / 3)::int - colles_for_lates::int FROM v_passport WHERE enrollment_id = enr
$$ LANGUAGE sql STABLE;

-- Vie de l'école : publiée d'emblée par la Direction ; sinon en attente. Seule la Direction valide (droit à
-- l'image vérifié) ou renvoie avec une remarque.
CREATE FUNCTION school_post_guard() RETURNS trigger AS $$
DECLARE director boolean := EXISTS (SELECT 1 FROM user_role WHERE user_id = NEW.author_id AND role = 'DIRECTION'); BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.status := CASE WHEN director THEN 'PUBLIEE'::publication_status ELSE 'EN_ATTENTE'::publication_status END;
    RETURN NEW;
  END IF;
  IF NEW.status <> OLD.status AND NEW.status IN ('PUBLIEE', 'A_REVOIR', 'RETIREE') THEN
    IF NEW.moderated_by IS NULL OR NOT EXISTS (SELECT 1 FROM user_role WHERE user_id = NEW.moderated_by AND role = 'DIRECTION') THEN
      RAISE EXCEPTION 'Seule la Direction publie ou renvoie une publication';
    END IF;
    IF NEW.status = 'PUBLIEE' AND NOT NEW.image_rights_checked THEN
      RAISE EXCEPTION 'Vérifier le droit à l''image avant de publier';
    END IF;
    NEW.moderated_at := now();
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER school_post_check BEFORE INSERT OR UPDATE ON school_post FOR EACH ROW EXECUTE FUNCTION school_post_guard();

-- Élèves d'une classe sans autorisation de droit à l'image (fiche signalétique de l'année).
CREATE FUNCTION students_without_image_rights(cls uuid) RETURNS TABLE (student_id uuid, name text) AS $$
  SELECT s.id, s.last_name || ' ' || s.first_name
  FROM enrollment e JOIN student s ON s.id = e.student_id LEFT JOIN student_record_form f ON f.enrollment_id = e.id
  WHERE e.class_id = cls AND e.left_on IS NULL AND NOT coalesce(f.auth_image, false)
$$ LANGUAGE sql STABLE;

-- Ambiance du jour : imposée, désactivée, ou la période qui contient la date — une ambiance ajoutée par la
-- Direction d'abord, puis la plus courte (Commémoration du 29 mars pendant l'automne).
CREATE FUNCTION active_season(site uuid, d date) RETURNS text AS $$
  WITH windows AS (
    SELECT code, added_by,
           CASE WHEN from_md <= to_md THEN to_char(d, 'MM-DD') BETWEEN from_md AND to_md
                ELSE to_char(d, 'MM-DD') >= from_md OR to_char(d, 'MM-DD') <= to_md END AS hit,
           CASE WHEN from_md <= to_md THEN to_date(to_md, 'MM-DD') - to_date(from_md, 'MM-DD')
                ELSE 365 - (to_date(from_md, 'MM-DD') - to_date(to_md, 'MM-DD')) END AS span
    FROM season WHERE from_md IS NOT NULL
    UNION ALL
    SELECT s.code, s.added_by, d BETWEEN sd.from_date AND sd.to_date, sd.to_date - sd.from_date
    FROM season s JOIN season_date sd ON sd.code = s.code AND sd.year = extract(year FROM d)
  )
  SELECT CASE coalesce((SELECT seasonal_mode FROM site_setting WHERE site_id = site), 'AUTO')
    WHEN 'OFF' THEN NULL
    WHEN 'AUTO' THEN (SELECT code FROM windows WHERE hit ORDER BY added_by IS NULL, span LIMIT 1)
    ELSE (SELECT seasonal_mode FROM site_setting WHERE site_id = site) END
$$ LANGUAGE sql STABLE;

-- Annonces : la personne connectée est lue dans la session (SET app.user_id = '…' à chaque requête,
-- posé par le serveur après l'authentification) ; un formulaire ne peut donc pas se faire passer pour la Direction.
CREATE FUNCTION current_app_user() RETURNS uuid AS $$
  SELECT nullif(current_setting('app.user_id', true), '')::uuid
$$ LANGUAGE sql STABLE;
CREATE FUNCTION has_role(u uuid, r role_code) RETURNS boolean AS $$
  SELECT EXISTS (SELECT 1 FROM user_role WHERE user_id = u AND role = r)
$$ LANGUAGE sql STABLE;

-- Mandats en cours d'un compte élève (inscription de l'année courante, non quittée).
CREATE FUNCTION student_mandate(u uuid) RETURNS TABLE (kind text, class_id uuid, class_name text, site_id uuid, president boolean) AS $$
  SELECT CASE WHEN g.code IN ('DELEGUE', 'SUPPLEANT') THEN 'DELEGUE' ELSE 'BDE' END, c.id, c.name, c.site_id, bool_or(g.code = 'BDE_PRESIDENT')
  FROM student s
  JOIN enrollment e ON e.student_id = s.id AND e.left_on IS NULL
  JOIN academic_year y ON y.id = e.year_id AND y.is_current
  JOIN school_class c ON c.id = e.class_id
  JOIN student_engagement g ON g.enrollment_id = e.id AND g.code IN ('DELEGUE', 'SUPPLEANT', 'BDE', 'BDE_PRESIDENT')
  WHERE s.user_id = u
  GROUP BY 1, c.id, c.name, c.site_id
$$ LANGUAGE sql STABLE;

CREATE FUNCTION announcement_guard() RETURNS trigger AS $$
DECLARE actor uuid := coalesce(current_app_user(), NEW.author_id); director boolean := has_role(actor, 'DIRECTION');
  cpe boolean := has_role(actor, 'VIE_SCOLAIRE'); action text; BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.author_mandate IS NOT NULL THEN
      -- élève mandaté : il faut le mandat en cours ; signature « Délégués de 1re STMG » ou « Bureau des élèves (BDE) »
      SELECT CASE m.kind WHEN 'DELEGUE' THEN 'Délégués de ' || m.class_name ELSE 'Bureau des élèves (BDE)' END INTO NEW.author_service
        FROM student_mandate(NEW.author_id) m WHERE m.kind = NEW.author_mandate;
      IF NEW.author_service IS NULL THEN RAISE EXCEPTION 'Mandat de délégué ou de BDE requis pour écrire une annonce'; END IF;
      IF NEW.status = 'EN_ATTENTE' THEN NEW.status := 'A_RELIRE'; END IF;   -- relecture de la CPE d'abord
    ELSIF NOT (has_role(NEW.author_id, 'DIRECTION') OR has_role(NEW.author_id, 'BUREAU') OR has_role(NEW.author_id, 'VIE_SCOLAIRE')) THEN
      RAISE EXCEPTION 'Les annonces sont rédigées par la Direction, le secrétariat, la CPE, les délégués ou le BDE';
    ELSE
      NEW.author_service := CASE WHEN has_role(NEW.author_id, 'DIRECTION') THEN 'Direction' WHEN has_role(NEW.author_id, 'BUREAU') THEN 'Secrétariat' ELSE 'Vie scolaire (CPE)' END;
    END IF;
    IF NEW.urgent IS NOT NULL AND (NEW.author_mandate IS NOT NULL OR NOT (has_role(NEW.author_id, 'BUREAU') OR has_role(NEW.author_id, 'VIE_SCOLAIRE') OR has_role(NEW.author_id, 'DIRECTION'))) THEN
      RAISE EXCEPTION 'L''annulation d''un cours le jour même est réservée au secrétariat et à la CPE';
    END IF;
    IF NEW.status = 'PUBLIEE' AND NOT has_role(NEW.author_id, 'DIRECTION') THEN
      -- seule exception : l'annulation d'un cours LE JOUR MÊME, par le secrétariat ou la CPE
      IF NEW.urgent = 'ANNULATION_JOUR' AND NEW.concerns_date = current_date AND NEW.author_mandate IS NULL THEN
        NEW.validated_by := NEW.author_id; NEW.validated_at := now();
      ELSE
        RAISE EXCEPTION 'Seule la Direction publie : envoyez l''annonce pour validation';
      END IF;
    ELSIF NEW.status = 'PUBLIEE' THEN NEW.validated_by := NEW.author_id; NEW.validated_at := now();
    END IF;
    IF NEW.status = 'A_RELIRE' AND NEW.author_mandate IS NULL THEN RAISE EXCEPTION 'La relecture de la CPE concerne les élèves mandatés'; END IF;
    IF NOT has_role(NEW.author_id, 'DIRECTION') THEN NEW.is_pinned := false; END IF; -- l'épinglage se demande
    INSERT INTO publication_event (entity, entity_id, action, by_user) VALUES ('ANNONCE', NEW.id, 'CREEE', NEW.author_id);
    IF NEW.status <> 'BROUILLON' THEN INSERT INTO publication_event (entity, entity_id, action, by_user, note) VALUES ('ANNONCE', NEW.id, CASE NEW.status WHEN 'PUBLIEE' THEN 'PUBLIEE' ELSE 'ENVOYEE' END, NEW.author_id, CASE WHEN NEW.urgent IS NOT NULL AND NEW.status = 'PUBLIEE' AND NOT has_role(NEW.author_id, 'DIRECTION') THEN 'annulation du jour, sans attendre la Direction' END); END IF;
    RETURN NEW;
  END IF;
  -- contenu : l'auteur modifie son brouillon ou une annonce à revoir ; la Direction corrige à tout moment
  IF (NEW.title, NEW.body_md) IS DISTINCT FROM (OLD.title, OLD.body_md) THEN
    IF director THEN
      IF NOT has_role(OLD.author_id, 'DIRECTION') THEN NEW.edited_by_direction := true; END IF;
      INSERT INTO publication_event (entity, entity_id, action, by_user) VALUES ('ANNONCE', NEW.id, 'CORRIGEE', actor);
    ELSIF actor <> OLD.author_id OR OLD.status NOT IN ('BROUILLON', 'A_REVOIR') THEN
      RAISE EXCEPTION 'Annonce envoyée à la Direction : elle ne se modifie plus';
    END IF;
  END IF;
  IF NEW.is_pinned AND NOT OLD.is_pinned AND NOT director THEN RAISE EXCEPTION 'Seule la Direction épingle une annonce'; END IF;
  IF NEW.status <> OLD.status THEN
    -- l'élève mandaté renvoie : retour à la relecture de la CPE
    IF NEW.status = 'EN_ATTENTE' AND OLD.author_mandate IS NOT NULL AND actor = OLD.author_id THEN NEW.status := 'A_RELIRE'; END IF;
    IF OLD.status = 'A_RELIRE' THEN
      -- relecture : la CPE transmet à la Direction ou renvoie à l'élève ; personne d'autre
      IF NOT cpe OR NEW.status NOT IN ('EN_ATTENTE', 'A_REVOIR') THEN RAISE EXCEPTION 'La CPE relit d''abord les annonces des élèves'; END IF;
      action := CASE NEW.status WHEN 'EN_ATTENTE' THEN 'RELUE' ELSE 'RENVOYEE' END;
    ELSE
      action := CASE NEW.status WHEN 'EN_ATTENTE' THEN 'ENVOYEE' WHEN 'A_RELIRE' THEN 'ENVOYEE' WHEN 'A_REVOIR' THEN 'RENVOYEE' WHEN 'PUBLIEE' THEN 'PUBLIEE' WHEN 'RETIREE' THEN 'RETIREE' ELSE NULL END;
      IF NEW.status IN ('PUBLIEE', 'A_REVOIR', 'RETIREE') AND NOT director THEN
        RAISE EXCEPTION 'Seule la Direction publie, renvoie ou retire une annonce';
      END IF;
      IF NEW.status = 'PUBLIEE' AND OLD.status <> 'EN_ATTENTE' AND OLD.author_mandate IS NOT NULL THEN
        RAISE EXCEPTION 'Annonce d''élève : relecture de la CPE d''abord';
      END IF;
      IF NEW.status IN ('EN_ATTENTE', 'A_RELIRE') AND (actor <> OLD.author_id OR OLD.status NOT IN ('BROUILLON', 'A_REVOIR')) THEN
        RAISE EXCEPTION 'Seul l''auteur envoie son brouillon';
      END IF;
    END IF;
    IF NEW.status = 'PUBLIEE' THEN NEW.validated_by := actor; NEW.validated_at := now(); NEW.review_note := NULL; END IF;
    IF action IS NOT NULL THEN INSERT INTO publication_event (entity, entity_id, action, by_user, note) VALUES ('ANNONCE', NEW.id, action, actor, NEW.review_note); END IF;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER announcement_check BEFORE INSERT OR UPDATE ON announcement FOR EACH ROW EXECUTE FUNCTION announcement_guard();

-- Destinataires d'une annonce d'élève mandaté : des élèves seulement ; un délégué, sa classe seulement ;
-- le BDE, son site (toute l'école, un niveau ou une classe du site). La Direction peut élargir en validant.
CREATE FUNCTION mandate_audience_guard() RETURNS trigger AS $$
DECLARE a announcement; m record; actor uuid := current_app_user(); BEGIN
  SELECT * INTO a FROM announcement WHERE id = NEW.announcement_id;
  IF a.author_mandate IS NULL OR has_role(actor, 'DIRECTION') THEN RETURN NEW; END IF;
  SELECT * INTO m FROM student_mandate(a.author_id) sm WHERE sm.kind = a.author_mandate;
  IF NEW.role <> 'ELEVE' THEN RAISE EXCEPTION 'Un mandat d''élève s''adresse aux élèves seulement'; END IF;
  IF a.author_mandate = 'DELEGUE' AND NEW.class_id IS DISTINCT FROM m.class_id THEN
    RAISE EXCEPTION 'Un délégué écrit seulement à sa classe (%)', m.class_name;
  END IF;
  IF a.author_mandate = 'BDE' AND (NEW.site_id IS DISTINCT FROM m.site_id
      OR (NEW.class_id IS NOT NULL AND (SELECT site_id FROM school_class WHERE id = NEW.class_id) <> m.site_id)) THEN
    RAISE EXCEPTION 'Le BDE écrit aux élèves de son site';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER mandate_audience_check BEFORE INSERT OR UPDATE ON announcement_audience FOR EACH ROW EXECUTE FUNCTION mandate_audience_guard();

-- Événements : le personnel (Direction, secrétariat) publie ; le BDE propose au calendrier de l'école de son
-- site, la Direction publie ou renvoie avec une remarque. Toute autre personne ne crée pas d'événement.
CREATE FUNCTION school_event_guard() RETURNS trigger AS $$
DECLARE actor uuid := coalesce(current_app_user(), NEW.created_by); director boolean := has_role(actor, 'DIRECTION'); m record; act text; BEGIN
  IF TG_OP = 'INSERT' THEN
    IF has_role(NEW.created_by, 'DIRECTION') OR has_role(NEW.created_by, 'BUREAU') THEN NEW.proposed_by_mandate := NULL; RETURN NEW; END IF;
    SELECT * INTO m FROM student_mandate(NEW.created_by) sm WHERE sm.kind = 'BDE';
    IF m.kind IS NULL THEN RAISE EXCEPTION 'Seuls la Direction, le secrétariat et le BDE (en proposition) créent un événement'; END IF;
    IF NEW.calendar <> 'ECOLE' OR NEW.class_id IS NOT NULL OR NEW.site_id <> m.site_id THEN
      RAISE EXCEPTION 'Le BDE propose au calendrier de l''école de son site';
    END IF;
    IF NEW.status IN ('PUBLIEE', 'EN_ATTENTE') THEN NEW.status := 'A_RELIRE'; END IF;   -- relu par la CPE, publié par la Direction
    NEW.proposed_by_mandate := 'BDE';
    INSERT INTO publication_event (entity, entity_id, action, by_user) VALUES ('EVENEMENT', NEW.id, 'CREEE', NEW.created_by);
    IF NEW.status = 'A_RELIRE' THEN INSERT INTO publication_event (entity, entity_id, action, by_user) VALUES ('EVENEMENT', NEW.id, 'ENVOYEE', NEW.created_by); END IF;
    RETURN NEW;
  END IF;
  IF OLD.proposed_by_mandate IS NULL THEN RETURN NEW; END IF;
  IF NEW.status <> OLD.status THEN
    IF OLD.status = 'A_RELIRE' THEN
      IF NOT has_role(actor, 'VIE_SCOLAIRE') OR NEW.status NOT IN ('EN_ATTENTE', 'A_REVOIR') THEN RAISE EXCEPTION 'La CPE relit d''abord les propositions du BDE'; END IF;
      act := CASE NEW.status WHEN 'EN_ATTENTE' THEN 'RELUE' ELSE 'RENVOYEE' END;
    ELSE
      IF NEW.status IN ('PUBLIEE', 'A_REVOIR', 'RETIREE') AND NOT director THEN RAISE EXCEPTION 'Seule la Direction publie un événement proposé'; END IF;
      IF NEW.status = 'PUBLIEE' AND OLD.status <> 'EN_ATTENTE' THEN RAISE EXCEPTION 'Relecture de la CPE d''abord'; END IF;
      IF NEW.status IN ('EN_ATTENTE', 'A_RELIRE') THEN
        IF actor <> OLD.created_by OR OLD.status NOT IN ('BROUILLON', 'A_REVOIR') THEN RAISE EXCEPTION 'Seul l''auteur envoie sa proposition'; END IF;
        NEW.status := 'A_RELIRE';
      END IF;
      act := CASE NEW.status WHEN 'A_RELIRE' THEN 'ENVOYEE' WHEN 'A_REVOIR' THEN 'RENVOYEE' WHEN 'PUBLIEE' THEN 'PUBLIEE' WHEN 'RETIREE' THEN 'RETIREE' END;
    END IF;
    IF NEW.status = 'PUBLIEE' THEN NEW.validated_by := actor; NEW.review_note := NULL; END IF;
    IF act IS NOT NULL THEN INSERT INTO publication_event (entity, entity_id, action, by_user, note) VALUES ('EVENEMENT', NEW.id, act, actor, NEW.review_note); END IF;
  ELSIF NOT director AND (actor <> OLD.created_by OR OLD.status NOT IN ('BROUILLON', 'A_REVOIR')) THEN
    RAISE EXCEPTION 'Proposition envoyée à la Direction : elle ne se modifie plus';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER school_event_check BEFORE INSERT OR UPDATE ON school_event FOR EACH ROW EXECUTE FUNCTION school_event_guard();

-- Remontées pour le conseil : seul un délégué de la classe les écrit.
CREATE FUNCTION council_feedback_guard() RETURNS trigger AS $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM student_mandate(NEW.author_id) m WHERE m.kind = 'DELEGUE' AND m.class_id = NEW.class_id) THEN
    RAISE EXCEPTION 'Seuls les délégués de la classe préparent le conseil';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER council_feedback_check BEFORE INSERT ON council_feedback FOR EACH ROW EXECUTE FUNCTION council_feedback_guard();

-- Droits d'accès par écran : seule la Direction les change ; la personne qui change est notée.
CREATE FUNCTION screen_access_guard() RETURNS trigger AS $$
BEGIN
  IF current_app_user() IS NOT NULL AND NOT has_role(current_app_user(), 'DIRECTION') THEN
    RAISE EXCEPTION 'Seule la Direction règle les droits d''accès';
  END IF;
  IF TG_OP <> 'DELETE' THEN NEW.set_by := current_app_user(); NEW.set_at := now(); RETURN NEW; END IF;
  RETURN OLD;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER screen_access_role_guard BEFORE INSERT OR UPDATE OR DELETE ON screen_access_role FOR EACH ROW EXECUTE FUNCTION screen_access_guard();
CREATE TRIGGER screen_access_user_guard BEFORE INSERT OR UPDATE OR DELETE ON screen_access_user FOR EACH ROW EXECUTE FUNCTION screen_access_guard();

-- Niveau d'une personne sur un écran : Direction → tout ; exception de la personne ; sinon le meilleur de ses rôles.
CREATE FUNCTION screen_level(u uuid, s text) RETURNS access_level AS $$
  SELECT CASE
    WHEN has_role(u, 'DIRECTION') THEN 'ECRITURE'::access_level
    WHEN s IN ('dashboard', 'settings', 'staff', 'access', 'mandates', 'feedback') THEN 'AUCUN'
    ELSE coalesce(
      (SELECT level FROM screen_access_user WHERE user_id = u AND screen = s),
      (SELECT max(r.level) FROM screen_access_role r JOIN user_role ur ON ur.role = r.role AND ur.user_id = u WHERE r.screen = s),
      'AUCUN')
  END
$$ LANGUAGE sql STABLE;

-- Nouvel élève : aucune inscription une année scolaire antérieure.
CREATE FUNCTION is_new_student(enr uuid) RETURNS boolean AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM enrollment e JOIN academic_year y ON y.id = e.year_id
    JOIN enrollment cur ON cur.id = enr JOIN academic_year cy ON cy.id = cur.year_id
    WHERE e.student_id = cur.student_id AND y.starts_on < cy.starts_on)
$$ LANGUAGE sql STABLE;
-- Carnet de liaison oublié : une heure de colle par oubli (ancien élève), par 2 oublis (nouvel élève).
CREATE FUNCTION carnet_colles_due(enr uuid) RETURNS integer AS $$
  SELECT (count(*) FILTER (WHERE f.kind = 'CARNET') / CASE WHEN is_new_student(enr) THEN 2 ELSE 1 END)::int
       - (SELECT count(*) FROM detention d JOIN school_forget g ON g.id = d.forget_id WHERE d.enrollment_id = enr AND g.kind = 'CARNET')::int
  FROM school_forget f WHERE f.enrollment_id = enr
$$ LANGUAGE sql STABLE;

-- Justification : posée au plus tard 24 h après le début de l'absence.
CREATE FUNCTION attendance_justify_guard() RETURNS trigger AS $$
BEGIN
  IF NEW.justified AND NOT coalesce(OLD.justified, false) THEN
    NEW.justified_at := coalesce(NEW.justified_at, now());
    IF NEW.justified_at > NEW.occurred_at + interval '24 hours' THEN
      RAISE EXCEPTION 'Délai de 24 h dépassé : l''absence reste non justifiée';
    END IF;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER attendance_justify BEFORE INSERT OR UPDATE OF justified ON attendance_event FOR EACH ROW EXECUTE FUNCTION attendance_justify_guard();
CREATE VIEW v_attendance_status AS
SELECT a.id, a.enrollment_id, a.kind, a.occurred_at, a.occurred_at + interval '24 hours' AS justify_until,
  CASE WHEN a.justified THEN 'JUSTIFIEE' WHEN now() >= a.occurred_at + interval '24 hours' THEN 'NON_JUSTIFIEE' ELSE 'A_JUSTIFIER' END AS status
FROM attendance_event a WHERE a.kind IN ('ABSENCE', 'RETARD');

-- Objets confisqués : la durée est décidée par la Direction ou le secrétariat.
CREATE FUNCTION object_duration_guard() RETURNS trigger AS $$
BEGIN
  IF NEW.duration_code IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.duration_code IS DISTINCT FROM NEW.duration_code) AND current_app_user() IS NOT NULL THEN
    IF NOT (has_role(current_app_user(), 'DIRECTION') OR has_role(current_app_user(), 'BUREAU')) THEN
      RAISE EXCEPTION 'La durée de confiscation est décidée par la Direction ou le secrétariat';
    END IF;
    NEW.duration_decided_by := current_app_user();
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
-- avant le calcul de la récidive et de la date de restitution (ordre alphabétique des triggers)
CREATE TRIGGER phone_0_duration BEFORE INSERT OR UPDATE OF duration_code ON phone_confiscation FOR EACH ROW EXECUTE FUNCTION object_duration_guard();

-- Créneaux de colle : mercredi 13h–17h, samedi 8h–12h (heure de Madagascar).
CREATE FUNCTION colle_slot_ok(at timestamptz, hours smallint) RETURNS boolean AS $$
  SELECT CASE extract(isodow FROM l)
    WHEN 3 THEN l::time >= '13:00' AND l::time + make_interval(hours => hours) <= '17:00'
    WHEN 6 THEN l::time >= '08:00' AND l::time + make_interval(hours => hours) <= '12:00'
    ELSE false END
  FROM (SELECT at AT TIME ZONE 'Indian/Antananarivo' AS l) x
$$ LANGUAGE sql IMMUTABLE;

-- Retard de plus de 10 minutes : compté absent pour l'heure commencée ; entre à l'heure pleine suivante.
CREATE FUNCTION late_entry(course_start time, course_end time, minutes integer) RETURNS time AS $$
  SELECT CASE WHEN minutes <= 10 THEN NULL
    ELSE least(course_start + make_interval(hours => ceil(minutes / 60.0)::int), course_end) END
$$ LANGUAGE sql IMMUTABLE;

-- Prélèvement de la Direction : saisi par la personne qui prélève → compté ; sinon à confirmer par elle.
CREATE FUNCTION cash_withdrawal_guard() RETURNS trigger AS $$
BEGIN
  IF NEW.nature <> 'Prélèvement Direction' THEN RETURN NEW; END IF;
  IF NOT has_role(NEW.withdrawn_by, 'DIRECTION') THEN RAISE EXCEPTION 'Seules la Cheffe d''établissement et l''adjointe font un prélèvement'; END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.status := CASE WHEN NEW.agent_id = NEW.withdrawn_by THEN 'VALIDE' ELSE 'A_VALIDER' END;
  ELSIF NEW.status IS DISTINCT FROM OLD.status AND current_app_user() IS DISTINCT FROM NEW.withdrawn_by THEN
    RAISE EXCEPTION 'Seule la personne qui a prélevé confirme le prélèvement';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER cash_withdrawal BEFORE INSERT OR UPDATE ON cash_movement FOR EACH ROW EXECUTE FUNCTION cash_withdrawal_guard();

-- Surveillance des colles : CPE ou secrétariat.
CREATE FUNCTION detention_watch_guard() RETURNS trigger AS $$
BEGIN
  IF NOT (has_role(NEW.watcher_id, 'VIE_SCOLAIRE') OR has_role(NEW.watcher_id, 'BUREAU')) THEN
    RAISE EXCEPTION 'Les colles sont surveillées par la CPE ou le secrétariat';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER detention_watch_check BEFORE INSERT OR UPDATE ON detention_watch FOR EACH ROW EXECUTE FUNCTION detention_watch_guard();

-- Justification déposée par la famille : avant la fin des 24 h, sinon refusée ; l'accepter justifie
-- l'absence même si la vie scolaire la traite après le délai (la famille était dans les temps).
CREATE FUNCTION attendance_request_guard() RETURNS trigger AS $$
DECLARE limit_at timestamptz;
BEGIN
  SELECT occurred_at + interval '24 hours' INTO limit_at FROM attendance_event WHERE id = NEW.attendance_id;
  IF TG_OP = 'INSERT' AND NEW.sent_at > limit_at THEN
    RAISE EXCEPTION 'Délai de 24 h dépassé : la justification ne peut plus être envoyée';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.accepted IS TRUE AND OLD.accepted IS NULL THEN
    UPDATE attendance_event SET justified = true, justified_at = NEW.sent_at, comment = coalesce(comment, NEW.reason) WHERE id = NEW.attendance_id;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER attendance_request_check BEFORE INSERT OR UPDATE ON attendance_request FOR EACH ROW EXECUTE FUNCTION attendance_request_guard();

-- Statut vu de tous : une demande envoyée à temps et pas encore traitée est EN_ATTENTE.
CREATE OR REPLACE VIEW v_attendance_status AS
SELECT a.id, a.enrollment_id, a.kind, a.occurred_at, a.occurred_at + interval '24 hours' AS justify_until,
  CASE WHEN a.justified THEN 'JUSTIFIEE'
       WHEN EXISTS (SELECT 1 FROM attendance_request r WHERE r.attendance_id = a.id AND r.decided_at IS NULL AND r.sent_at <= a.occurred_at + interval '24 hours') THEN 'EN_ATTENTE'
       WHEN now() >= a.occurred_at + interval '24 hours' THEN 'NON_JUSTIFIEE' ELSE 'A_JUSTIFIER' END AS status
FROM attendance_event a WHERE a.kind IN ('ABSENCE', 'RETARD');

-- Heures calmes (20h–7h à Madagascar) : seules les urgences partent.
CREATE FUNCTION push_allowed(level notif_level, at timestamptz) RETURNS boolean AS $$
  SELECT level = 'URGENT' OR (at AT TIME ZONE 'Indian/Antananarivo')::time BETWEEN '07:00' AND '19:59:59'
$$ LANGUAGE sql IMMUTABLE;

-- E-mail de secours : urgent ou important, poussé, pas ouvert depuis 2 h, pas encore envoyé par e-mail.
CREATE VIEW v_notification_email_due AS
SELECT n.* FROM notification_outbox n
WHERE n.level <> 'INFO' AND n.sent_at IS NOT NULL AND n.opened_at IS NULL AND n.emailed_at IS NULL
  AND now() - n.sent_at >= interval '2 hours';
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
INSERT INTO fee_item (code, kind, category, rubric, label, unit, priced_by_level) VALUES
  ('INSCRIPTION',     'INSCRIPTION',   'FRAIS_ANNEXES', 'Classes & tarifs',          'Inscription',                  'une fois', true),
  ('REINSCRIPTION',   'REINSCRIPTION', 'FRAIS_ANNEXES', 'Classes & tarifs',          'Réinscription',                'par an', true),
  ('ECOLAGE',         'ECOLAGE',       'ECOLAGE',       'Classes & tarifs',          'Frais de scolarité mensuel',              'par mois', true),
  ('FASCICULE',       'FASCICULE',     'FRAIS_ANNEXES', 'Classes & tarifs',          'Fascicule',                    'par an', true),
  ('LOCATION',        'LOCATION',      'FRAIS_ANNEXES', 'Classes & tarifs',          'Location des manuels',         'par an', true),
  ('MANUEL_PERTE',    'ARTICLE',       'FRAIS_ANNEXES', 'Manuel scolaire',           'Manuel perdu ou endommagé',    'par manuel', false),
  ('MANUEL_AUTRE',    'ARTICLE',       'FRAIS_ANNEXES', 'Manuel scolaire',           'Autre (manuel complémentaire)','par manuel', false),
  ('PASSEPORT',       'ARTICLE',       'FRAIS_ANNEXES', 'Passeport de Vie Scolaire', 'Passeport de Vie Scolaire',    'par élève', false),
  ('PASSEPORT_PERTE', 'ARTICLE',       'FRAIS_ANNEXES', 'Passeport de Vie Scolaire', 'Passeport perdu ou endommagé', 'remplacement', false),
  ('NATATION_SEANCE', 'SERVICE',       'FRAIS_ANNEXES', 'Séances de natation',       'Séance de natation',           'par séance', false),
  ('NATATION_FORFAIT','SERVICE',       'FRAIS_ANNEXES', 'Séances de natation',       'Forfait natation trimestriel', 'par trimestre', false),
  ('TEE_SHIRT',       'ARTICLE',       'FRAIS_ANNEXES', 'Tee-shirt scolaire',        'Tee-shirt scolaire',           'par unité', false);

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
  ('admin.settings',     'Paramétrer années, calendriers, grilles tarifaires, articles et services'),
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
  ('DM', 'Devoir maison'), ('TP', 'Travaux pratiques'), ('PROJET', 'Projet'), ('EXAMEN_BLANC', 'Examen blanc'), ('AUTRE', 'Autre');
INSERT INTO council_flag_type (code, label, tone) VALUES
  ('EXEMPLAIRE', 'Élève exemplaire', 'POSITIF'), ('ENCOURAGEMENTS', 'Encouragements', 'POSITIF'),
  ('BAVARD', 'Élève bavard.e', 'VIGILANCE'), ('MANQUE_TRAVAIL', 'Manque de travail personnel', 'VIGILANCE'),
  ('AVERT_TRAVAIL', 'Avertissement travail', 'ALERTE'), ('AVERT_COMPORTEMENT', 'Avertissement comportement', 'ALERTE');

-- Vie scolaire
INSERT INTO discipline_measure_type (code, label, kind) VALUES
  ('OBSERVATION', 'Observation écrite', 'PUNITION'), ('DEVOIR_SUPP', 'Devoir supplémentaire', 'PUNITION'),
  ('RETENUE', 'Retenue', 'PUNITION'), ('EXCLUSION_COURS', 'Exclusion ponctuelle de cours', 'PUNITION'),
  ('AVERTISSEMENT', 'Avertissement', 'PUNITION'), ('BLAME', 'Blâme', 'SANCTION'),
  ('RESPONSABILISATION', 'Mesure de responsabilisation', 'SANCTION'), ('EXCLUSION_TEMP', 'Exclusion temporaire (8 jours max.)', 'SANCTION');

INSERT INTO authorization_type (code, label, options) VALUES
  ('IMAGE', 'Droit à l''image', '{"J''autorise","Je n''autorise pas"}'),
  ('SORTIE', 'Autorisation de sortie', '{"Sortie après la dernière heure de cours de la demi-journée, y compris en cas d''absence d''un professeur","Sortie en fin de journée uniquement","Aucune sortie sans un responsable"}'),
  ('SORTIES_PEDA', 'Sorties pédagogiques', '{"J''autorise","Je n''autorise pas"}');

INSERT INTO school_life_policy (year_id, site_id) SELECT y.id, s.id FROM academic_year y, site s WHERE s.code = 'TMV';
INSERT INTO internship_type (code, level_code, label, school_days) VALUES
  ('STAGE_3E', '3E', 'Découverte de l''entreprise et des métiers', 5),
  ('STAGE_2DE', '2NDE', 'Observation d''un métier', 5),
  ('TERRAIN_1STMG', '1RE', 'Étude de gestion : entretien en organisation (1re STMG)', 1);

-- Ambiances (école laïque ; mêmes ambiances que l'interface, rules/ambiances.js ; notes complètes côté interface)
INSERT INTO season (code, label, category, from_md, to_md, palette, motif, symbol, greeting, note_title, note_body) VALUES
  ('RENTREE', 'Rentrée', 'SCOLAIRE', '09-01', '09-12', 'ciel', 'etoiles', '✏️', 'Bienvenue à toutes et à tous !', NULL, NULL),
  ('PRINTEMPS', 'Printemps', 'SAISON', '09-20', '09-30', 'vert', 'petales', '🌸', 'Les jours rallongent.', 'Pourquoi le printemps en septembre ?', 'Madagascar est dans l''hémisphère sud : l''équinoxe de septembre y marque le début du printemps.'),
  ('OCTOBRE_ROSE', 'Octobre rose', 'CIVIQUE', '10-01', '10-31', 'rose', 'petales', '🎀', 'Toute l''école se mobilise.', 'Octobre rose', 'Campagne de sensibilisation au dépistage du cancer du sein.'),
  ('ARMISTICE', 'Armistice du 11 novembre', 'HISTORIQUE', '11-04', '11-11', 'sobre', 'aucun', '🕊️', 'Journée de mémoire.', '11 novembre 1918', 'L''armistice met fin aux combats de la Première Guerre mondiale.'),
  ('DROITS_ENFANT', 'Droits de l''enfant', 'CIVIQUE', '11-14', '11-20', 'ciel', 'etoiles', '🧒', 'Journée internationale, le 20 novembre.', 'Convention internationale des droits de l''enfant', 'Adoptée par l''ONU le 20 novembre 1989.'),
  ('NOUVEL_AN', 'Nouvel An', 'CIVIQUE', '12-28', '01-06', 'or', 'confettis', '✨', 'Bonne année !', 'Nouvelle année civile', 'Le 1er janvier ouvre l''année du calendrier grégorien.'),
  ('NOUVEL_AN_LUNAIRE', 'Nouvel An lunaire', 'CULTUREL', NULL, NULL, 'rouge', 'confettis', '🏮', 'Bonne année lunaire !', 'Le Nouvel An lunaire', 'Sa date suit un calendrier luni-solaire et change chaque année.'),
  ('FEMMES', 'Droits des femmes', 'CIVIQUE', '03-01', '03-08', 'violet', 'petales', '💜', 'Journée internationale, le 8 mars.', 'Le 8 mars', 'Journée reconnue par l''ONU en 1977.'),
  ('FRANCOPHONIE', 'Francophonie', 'CULTUREL', '03-14', '03-20', 'ciel', 'etoiles', '📖', 'Journée internationale, le 20 mars.', 'La Francophonie', 'Madagascar est membre de l''Organisation internationale de la Francophonie.'),
  ('AUTOMNE', 'Automne', 'SAISON', '03-21', '04-04', 'ambre', 'feuilles', '🍂', 'Les jours raccourcissent.', 'L''équinoxe de mars', 'Dans l''hémisphère sud, elle marque le début de l''automne.'),
  ('MEMOIRE_1947', 'Commémoration du 29 mars 1947', 'HISTORIQUE', '03-25', '03-29', 'sobre', 'aucun', '🕊️', 'Journée de mémoire nationale.', 'Le 29 mars 1947', 'Début de l''insurrection malgache contre la colonisation.'),
  ('ENVIRONNEMENT', 'Journée de l''environnement', 'CIVIQUE', '05-30', '06-05', 'vert', 'feuilles', '🌱', 'Le 5 juin : chaque geste compte.', 'Agir pour l''environnement', 'Instituée par l''ONU en 1972.'),
  ('INDEPENDANCE', 'Fête de l''Indépendance', 'HISTORIQUE', '06-20', '06-26', 'vert', 'confettis', '🇲🇬', 'Bonne fête nationale !', '26 juin 1960', 'Proclamation de l''indépendance de Madagascar.'),
  ('VACANCES', 'Grandes vacances', 'SCOLAIRE', '06-27', '07-10', 'ciel', 'aucun', '☀️', 'Bon repos, à la rentrée !', NULL, NULL);
INSERT INTO season_date (code, year, from_date, to_date) VALUES
  ('NOUVEL_AN_LUNAIRE', 2026, '2026-02-14', '2026-02-21'), ('NOUVEL_AN_LUNAIRE', 2027, '2027-02-03', '2027-02-10'),
  ('NOUVEL_AN_LUNAIRE', 2028, '2028-01-23', '2028-01-30'), ('NOUVEL_AN_LUNAIRE', 2029, '2029-02-10', '2029-02-17'),
  ('NOUVEL_AN_LUNAIRE', 2030, '2030-01-31', '2030-02-07');
-- =============================================================================
--  ENT Chateaubriand — couche Supabase (à exécuter APRÈS schema.sql, functions.sql, seed.sql)
--  1. lien entre les comptes de connexion (auth.users) et les personnes de l'ENT (app_user) ;
--  2. connexion par identifiant (l'e-mail ne sert qu'en cas d'oubli du code) ;
--  3. règles d'accès (Row Level Security) : chacun ne voit que ce que son rôle permet.
--  Toutes les tables sont fermées par défaut ; chaque module branché ouvre les siennes ici.
-- =============================================================================

ALTER TABLE app_user
  ADD COLUMN IF NOT EXISTS auth_uid uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS login    citext UNIQUE,              -- identifiant de connexion : « prof.ranaivo »
  ADD COLUMN IF NOT EXISTS must_change_code boolean NOT NULL DEFAULT true;
ALTER TABLE app_user ALTER COLUMN auth_provider SET DEFAULT 'PASSWORD';

-- ---------------------------------------------------------------- qui est connecté ?
CREATE OR REPLACE FUNCTION ent_me() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM app_user WHERE auth_uid = auth.uid() AND is_active
$$;

CREATE OR REPLACE FUNCTION ent_has_role(VARIADIC roles role_code[]) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM user_role WHERE user_id = ent_me() AND role = ANY (roles))
$$;

CREATE OR REPLACE FUNCTION ent_is_staff() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT ent_has_role('DIRECTION', 'BUREAU', 'VIE_SCOLAIRE', 'PROFESSEUR')
$$;

-- le professeur connecté enseigne-t-il ce service / dans cette classe / à cet élève ?
CREATE OR REPLACE FUNCTION ent_teaches_assignment(a uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM teaching_assignment WHERE id = a AND teacher_id = ent_me())
$$;
CREATE OR REPLACE FUNCTION ent_teaches_class(c uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM teaching_assignment WHERE class_id = c AND teacher_id = ent_me())
$$;
CREATE OR REPLACE FUNCTION ent_teaches_enrollment(e uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM enrollment en JOIN teaching_assignment ta ON ta.class_id = en.class_id
                 WHERE en.id = e AND ta.teacher_id = ent_me())
$$;
CREATE OR REPLACE FUNCTION ent_assignment_of_evaluation(ev uuid) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT assignment_id FROM evaluation WHERE id = ev
$$;
CREATE OR REPLACE FUNCTION ent_enrollment_of_report(rc uuid) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT enrollment_id FROM report_card WHERE id = rc
$$;

-- ---------------------------------------------------------------- connexion par identifiant
-- L'écran de connexion demande « identifiant + code » ; il retrouve l'adresse de connexion à partir de
-- l'identifiant (seulement pour un compte actif). Une personne sans e-mail reçoit une adresse technique.
CREATE OR REPLACE FUNCTION ent_login_email(p_login text) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT u.email::text FROM app_user u WHERE u.login = p_login::citext AND u.is_active AND u.auth_uid IS NOT NULL
$$;
REVOKE ALL ON FUNCTION ent_login_email(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ent_login_email(text) TO anon, authenticated;

-- Premier compte Direction : à lancer UNE fois dans l'éditeur SQL de Supabase, après avoir créé
-- l'utilisateur dans Authentication › Users (même e-mail). Réservé à l'administrateur de la base.
CREATE OR REPLACE FUNCTION ent_first_direction(p_email text, p_login text, p_first text, p_last text, p_title text DEFAULT 'Cheffe d''établissement')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid; me uuid;
BEGIN
  SELECT id INTO uid FROM auth.users WHERE lower(email) = lower(p_email);
  IF uid IS NULL THEN RAISE EXCEPTION 'Créez d''abord l''utilisateur % dans Authentication › Users', p_email; END IF;
  INSERT INTO app_user (email, first_name, last_name, auth_provider, auth_uid, login, must_change_code)
  VALUES (p_email, p_first, p_last, 'PASSWORD', uid, p_login, false)
  ON CONFLICT (email) DO UPDATE SET auth_uid = excluded.auth_uid, login = excluded.login
  RETURNING id INTO me;
  INSERT INTO user_role (user_id, role, site_id, title) VALUES (me, 'DIRECTION', NULL, p_title) ON CONFLICT DO NOTHING;
  RETURN me;
END $$;
REVOKE ALL ON FUNCTION ent_first_direction(text, text, text, text, text) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------- droits d'accès aux tables
-- Projet créé avec « Automatically expose new tables » désactivé : aucune table n'est ouverte d'office.
-- Seules les personnes connectées (authenticated) reçoivent les droits ; les règles ci-dessous (RLS)
-- décident ensuite, ligne par ligne, de ce que chacune voit. Les visiteurs non connectés (anon) n'ont
-- accès à aucune table, seulement à la fonction de connexion par identifiant.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
GRANT EXECUTE ON FUNCTION ent_login_email(text) TO anon;
REVOKE ALL ON FUNCTION ent_first_direction(text, text, text, text, text) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------- toutes les tables fermées par défaut
DO $$ DECLARE t text; BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- ---------------------------------------------------------------- données de référence : lecture par le personnel
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['site', 'site_cycle', 'academic_year', 'period', 'level', 'subject', 'school_class',
                           'evaluation_type', 'council_flag_type', 'discipline_measure_type'] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('DROP POLICY IF EXISTS ref_read ON public.%I', t);
      EXECUTE format('CREATE POLICY ref_read ON public.%I FOR SELECT TO authenticated USING (ent_is_staff())', t);
      EXECUTE format('DROP POLICY IF EXISTS ref_write ON public.%I', t);
      EXECUTE format('CREATE POLICY ref_write ON public.%I FOR ALL TO authenticated USING (ent_has_role(''DIRECTION'')) WITH CHECK (ent_has_role(''DIRECTION''))', t);
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------- personnes et comptes
CREATE POLICY app_user_read ON app_user FOR SELECT TO authenticated USING (ent_is_staff() OR id = ent_me());
CREATE POLICY app_user_direction ON app_user FOR ALL TO authenticated USING (ent_has_role('DIRECTION')) WITH CHECK (ent_has_role('DIRECTION'));
CREATE POLICY user_role_read ON user_role FOR SELECT TO authenticated USING (user_id = ent_me() OR ent_is_staff());
CREATE POLICY user_role_direction ON user_role FOR ALL TO authenticated USING (ent_has_role('DIRECTION')) WITH CHECK (ent_has_role('DIRECTION'));

-- ---------------------------------------------------------------- élèves, inscriptions, responsables
CREATE POLICY student_read ON student FOR SELECT TO authenticated USING (ent_is_staff());
CREATE POLICY student_admin ON student FOR ALL TO authenticated USING (ent_has_role('DIRECTION', 'BUREAU')) WITH CHECK (ent_has_role('DIRECTION', 'BUREAU'));
CREATE POLICY enrollment_read ON enrollment FOR SELECT TO authenticated USING (ent_is_staff());
CREATE POLICY enrollment_admin ON enrollment FOR ALL TO authenticated USING (ent_has_role('DIRECTION', 'BUREAU')) WITH CHECK (ent_has_role('DIRECTION', 'BUREAU'));
CREATE POLICY guardian_read ON guardian FOR SELECT TO authenticated USING (ent_has_role('DIRECTION', 'BUREAU', 'VIE_SCOLAIRE'));
CREATE POLICY guardian_admin ON guardian FOR ALL TO authenticated USING (ent_has_role('DIRECTION', 'BUREAU')) WITH CHECK (ent_has_role('DIRECTION', 'BUREAU'));
CREATE POLICY student_guardian_read ON student_guardian FOR SELECT TO authenticated USING (ent_has_role('DIRECTION', 'BUREAU', 'VIE_SCOLAIRE'));
CREATE POLICY student_guardian_admin ON student_guardian FOR ALL TO authenticated USING (ent_has_role('DIRECTION', 'BUREAU')) WITH CHECK (ent_has_role('DIRECTION', 'BUREAU'));
CREATE POLICY teaching_read ON teaching_assignment FOR SELECT TO authenticated USING (ent_is_staff());
CREATE POLICY teaching_admin ON teaching_assignment FOR ALL TO authenticated USING (ent_has_role('DIRECTION')) WITH CHECK (ent_has_role('DIRECTION'));

-- ---------------------------------------------------------------- notes : le professeur sur ses services, la Direction partout,
-- le secrétariat en lecture (grilles, bulletins) ; la vie scolaire ne voit pas les notes.
CREATE POLICY evaluation_read ON evaluation FOR SELECT TO authenticated USING (ent_teaches_assignment(assignment_id) OR ent_has_role('DIRECTION', 'BUREAU'));
CREATE POLICY evaluation_write ON evaluation FOR ALL TO authenticated USING (ent_teaches_assignment(assignment_id) OR ent_has_role('DIRECTION')) WITH CHECK (ent_teaches_assignment(assignment_id) OR ent_has_role('DIRECTION'));
CREATE POLICY grade_read ON grade FOR SELECT TO authenticated USING (ent_teaches_assignment(ent_assignment_of_evaluation(evaluation_id)) OR ent_has_role('DIRECTION', 'BUREAU'));
CREATE POLICY grade_write ON grade FOR ALL TO authenticated
  USING (ent_teaches_assignment(ent_assignment_of_evaluation(evaluation_id)) OR ent_has_role('DIRECTION'))
  WITH CHECK ((ent_teaches_assignment(ent_assignment_of_evaluation(evaluation_id)) OR ent_has_role('DIRECTION')) AND entered_by = ent_me());
CREATE POLICY adjustment_read ON grade_adjustment FOR SELECT TO authenticated USING (ent_teaches_assignment(assignment_id) OR ent_has_role('DIRECTION', 'BUREAU'));
CREATE POLICY adjustment_write ON grade_adjustment FOR ALL TO authenticated USING (ent_teaches_assignment(assignment_id) OR ent_has_role('DIRECTION')) WITH CHECK ((ent_teaches_assignment(assignment_id) OR ent_has_role('DIRECTION')) AND entered_by = ent_me());
CREATE POLICY validation_read ON term_validation FOR SELECT TO authenticated USING (ent_teaches_assignment(assignment_id) OR ent_has_role('DIRECTION', 'BUREAU'));
CREATE POLICY validation_write ON term_validation FOR ALL TO authenticated USING (ent_teaches_assignment(assignment_id) OR ent_has_role('DIRECTION')) WITH CHECK ((ent_teaches_assignment(assignment_id) OR ent_has_role('DIRECTION')) AND validated_by = ent_me());

-- ---------------------------------------------------------------- conseil et bulletins
CREATE POLICY report_read ON report_card FOR SELECT TO authenticated USING (ent_has_role('DIRECTION', 'BUREAU') OR ent_teaches_enrollment(enrollment_id));
CREATE POLICY report_write ON report_card FOR ALL TO authenticated USING (ent_has_role('DIRECTION', 'BUREAU')) WITH CHECK (ent_has_role('DIRECTION', 'BUREAU'));
CREATE POLICY comment_read ON report_comment FOR SELECT TO authenticated USING (ent_has_role('DIRECTION', 'BUREAU') OR ent_teaches_enrollment(ent_enrollment_of_report(report_card_id)));
CREATE POLICY comment_write ON report_comment FOR ALL TO authenticated
  USING (author_id = ent_me() OR ent_has_role('DIRECTION'))
  WITH CHECK ((author_id = ent_me() AND ent_teaches_enrollment(ent_enrollment_of_report(report_card_id))) OR ent_has_role('DIRECTION'));
CREATE POLICY flag_read ON council_flag FOR SELECT TO authenticated USING (ent_has_role('DIRECTION', 'BUREAU') OR ent_teaches_enrollment(ent_enrollment_of_report(report_card_id)));
CREATE POLICY flag_write ON council_flag FOR ALL TO authenticated USING (author_id = ent_me() OR ent_has_role('DIRECTION')) WITH CHECK (author_id = ent_me() OR ent_has_role('DIRECTION'));
CREATE POLICY note_read ON council_note FOR SELECT TO authenticated USING (ent_has_role('DIRECTION', 'BUREAU') OR ent_teaches_enrollment(ent_enrollment_of_report(report_card_id)));
CREATE POLICY note_write ON council_note FOR ALL TO authenticated USING (author_id = ent_me() OR ent_has_role('DIRECTION')) WITH CHECK (author_id = ent_me() OR ent_has_role('DIRECTION'));

-- ---------------------------------------------------------------- absences, retards, punitions
-- tout le personnel note ; le professeur voit ses classes ; vie scolaire, secrétariat et Direction voient tout et justifient.
CREATE POLICY attendance_read ON attendance_event FOR SELECT TO authenticated USING (ent_has_role('DIRECTION', 'BUREAU', 'VIE_SCOLAIRE') OR ent_teaches_enrollment(enrollment_id));
CREATE POLICY attendance_insert ON attendance_event FOR INSERT TO authenticated WITH CHECK (recorded_by = ent_me() AND (ent_has_role('DIRECTION', 'BUREAU', 'VIE_SCOLAIRE') OR ent_teaches_enrollment(enrollment_id)));
CREATE POLICY attendance_update ON attendance_event FOR UPDATE TO authenticated USING (ent_has_role('DIRECTION', 'BUREAU', 'VIE_SCOLAIRE') OR recorded_by = ent_me());
CREATE POLICY attendance_delete ON attendance_event FOR DELETE TO authenticated USING (ent_has_role('DIRECTION', 'VIE_SCOLAIRE') OR recorded_by = ent_me());
CREATE POLICY measure_read ON discipline_measure FOR SELECT TO authenticated USING (ent_has_role('DIRECTION', 'BUREAU', 'VIE_SCOLAIRE') OR decided_by = ent_me() OR ent_teaches_enrollment(enrollment_id));
CREATE POLICY measure_insert ON discipline_measure FOR INSERT TO authenticated WITH CHECK (decided_by = ent_me() AND ent_is_staff());
CREATE POLICY measure_update ON discipline_measure FOR UPDATE TO authenticated USING (ent_has_role('DIRECTION', 'VIE_SCOLAIRE') OR decided_by = ent_me());
-- =============================================================================
--  Mise à jour 1 — comptes : changement de code à la première connexion, liste des comptes (Direction)
-- =============================================================================
-- La personne connectée a choisi son propre code : on ne lui demande plus d'en changer.
CREATE OR REPLACE FUNCTION ent_code_changed() RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE app_user SET must_change_code = false, last_login_at = now() WHERE id = ent_me()
$$;
REVOKE ALL ON FUNCTION ent_code_changed() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION ent_code_changed() TO authenticated;

-- Dernière connexion (affichée dans la liste des comptes)
CREATE OR REPLACE FUNCTION ent_seen() RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE app_user SET last_login_at = now() WHERE id = ent_me()
$$;
REVOKE ALL ON FUNCTION ent_seen() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION ent_seen() TO authenticated;
