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

-- RBAC : les droits sont portés par le RÔLE, jamais par la personne.
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
  CHECK ((parent_ack_at IS NULL) = (parent_ack_by IS NULL))
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
  validated_by  uuid REFERENCES app_user(id),
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
CREATE TYPE engagement_code AS ENUM ('DELEGUE', 'SUPPLEANT', 'ECO_DELEGUE', 'CVL', 'CVC', 'TUTEUR', 'SPORT', 'PSC1',
  'ASSR1', 'ASSR2', 'NUMERIQUE');
CREATE TABLE student_engagement (
  enrollment_id uuid REFERENCES enrollment(id),
  code          engagement_code,
  PRIMARY KEY (enrollment_id, code)
);

-- =====  BIBLIOTHÈQUE (CDI)  =====
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
