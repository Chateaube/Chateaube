-- =============================================================================
--  ENT Chateaubriand — Schéma PostgreSQL (>= 14)
--  Multi-sites (Tana / Tamatave), comptabilité séparée Écolage / Droits d'examen,
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
CREATE TYPE role_code         AS ENUM ('DIRECTION', 'PROFESSEUR', 'VIE_SCOLAIRE', 'COMPTABILITE', 'PARENT', 'ELEVE');
CREATE TYPE auth_provider     AS ENUM ('GOOGLE', 'MAGIC_LINK', 'PASSWORD');
CREATE TYPE assignment_reason AS ENUM ('INSCRIPTION', 'TRANSFERT_EXAMEN', 'DEMENAGEMENT', 'AUTRE');

CREATE TYPE fee_category      AS ENUM ('ECOLAGE', 'FRAIS_ANNEXES', 'DROITS_EXAMEN');
CREATE TYPE fee_item_kind     AS ENUM ('INSCRIPTION', 'REINSCRIPTION', 'ECOLAGE', 'FASCICULE', 'LOCATION', 'ARTICLE', 'SERVICE');
CREATE TYPE cash_direction    AS ENUM ('ENTREE', 'SORTIE');
CREATE TYPE contract_type     AS ENUM ('CDI', 'CDD', 'VACATAIRE', 'STAGIAIRE');
CREATE TYPE invoice_status    AS ENUM ('BROUILLON', 'EMISE', 'PARTIELLE', 'PAYEE', 'ANNULEE');
CREATE TYPE payment_method    AS ENUM ('ESPECES', 'VIREMENT', 'CHEQUE', 'MVOLA', 'ORANGE_MONEY', 'AIRTEL_MONEY');
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
CREATE TYPE notif_channel     AS ENUM ('SMS', 'EMAIL', 'PUSH');
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
  phone_e164    text,                          -- +261… pour SMS
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
  nationality   text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE guardian (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid UNIQUE REFERENCES app_user(id),
  first_name    text NOT NULL,
  last_name     text NOT NULL,
  email         citext,
  phone_e164    text,
  preferred_channel notif_channel NOT NULL DEFAULT 'SMS'
);

CREATE TABLE student_guardian (
  student_id    uuid REFERENCES student(id) ON DELETE CASCADE,
  guardian_id   uuid REFERENCES guardian(id) ON DELETE CASCADE,
  relationship  text NOT NULL,                 -- 'Mère', 'Père', 'Tuteur.rice'
  is_payer      boolean NOT NULL DEFAULT false,-- destinataire des factures/relances
  is_primary    boolean NOT NULL DEFAULT false,
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
-- 4. FINANCES — comptabilité séparée (Écolage ≠ Droits d'examen)
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
--   ECO-CAISSE     ECOLAGE        Trésorerie écolage               ACTIF
--   ECO-CLIENTS    ECOLAGE        Familles — écolage               ACTIF
--   ECO-PRODUIT    ECOLAGE        Produit écolage                  PRODUIT
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

-- Mois soumis aux relances d'écolage. Pendant un mois inactif, le décompte des
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
  relance_after   smallint NOT NULL DEFAULT 5  CHECK (relance_after > 0),
  warning_after   smallint NOT NULL DEFAULT 10 CHECK (warning_after > 0),
  suspension_after smallint NOT NULL DEFAULT 25 CHECK (suspension_after > 0),
  count_from      dunning_count_from NOT NULL DEFAULT 'ECHEANCE', -- délais depuis l'échéance ou depuis l'étape précédente
  counted_weekdays smallint[] NOT NULL DEFAULT '{1,2,3,4,5}',    -- 1 = lundi … 6 = samedi
  suspension_requires_direction boolean NOT NULL DEFAULT true,     -- mise à pied validée par la Direction
  channels        notif_channel[] NOT NULL DEFAULT '{SMS,EMAIL}',
  updated_by      uuid REFERENCES app_user(id),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (year_id, site_id),
  CHECK (counted_weekdays <@ '{1,2,3,4,5,6,7}' AND cardinality(counted_weekdays) > 0),
  CHECK (count_from = 'ETAPE_PRECEDENTE' OR (relance_after < warning_after AND warning_after < suspension_after))
);

-- Plan d'écolage par niveau : premier et dernier mois facturés.
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
-- Chaque article appartient à UN journal (catégorie) : écolage, frais annexes
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
  free_amount   boolean NOT NULL DEFAULT false,   -- « Autre » : montant saisi à la vente
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
  period_month  date,                          -- 1er jour du mois facturé (écolage)
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
  external_ref  text,                          -- réf. Mvola / virement
  received_at   timestamptz NOT NULL DEFAULT now(),
  received_by   uuid NOT NULL REFERENCES app_user(id)
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
CREATE TABLE competency (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id    uuid REFERENCES subject(id),   -- NULL = transversale (socle)
  code          text NOT NULL,                 -- 'D1.3', 'RAISONNER'
  label         text NOT NULL,
  UNIQUE (subject_id, code)
);

CREATE TABLE evaluation (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES teaching_assignment(id),
  period_id     uuid NOT NULL REFERENCES period(id),
  title         text NOT NULL,
  held_on       date NOT NULL,
  scale_max     numeric(5,2) NOT NULL DEFAULT 20,
  coefficient   numeric(4,2) NOT NULL DEFAULT 1,
  mode          grading_mode NOT NULL DEFAULT 'NUMERIQUE',
  published_at  timestamptz
);

-- Colonnes de la grille : compétences évaluées par cette évaluation.
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
  autocorrected boolean NOT NULL DEFAULT false,
  entered_by    uuid NOT NULL REFERENCES app_user(id),
  entered_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (evaluation_id, enrollment_id),
  CHECK ((status = 'NOTE') = (value IS NOT NULL)),
  CHECK (value IS NULL OR value >= 0)
);

-- Cellules de la matrice compétences (niveau de maîtrise 1 à 4).
CREATE TABLE competency_result (
  evaluation_id uuid,
  competency_id uuid,
  enrollment_id uuid REFERENCES enrollment(id),
  mastery       smallint NOT NULL CHECK (mastery BETWEEN 1 AND 4),
  PRIMARY KEY (evaluation_id, competency_id, enrollment_id),
  FOREIGN KEY (evaluation_id, competency_id) REFERENCES evaluation_competency ON DELETE CASCADE
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
  general_comment text,
  decision      class_decision,                -- 3e trimestre
  decision_level_code text REFERENCES level(code),
  decision_text text,                          -- « Admis.e en classe de 1re »
  published_at  timestamptz,
  UNIQUE (enrollment_id, period_id),
  CHECK (decision_text IS NULL OR decision_text ~ '^(Admis\.e|Retenu\.e|Réorienté\.e) ')
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
  recorded_by   uuid NOT NULL REFERENCES app_user(id)
);

CREATE TABLE announcement (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title         text NOT NULL,
  body_md       text NOT NULL,
  author_id     uuid NOT NULL REFERENCES app_user(id),
  publish_at    timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz,
  is_pinned     boolean NOT NULL DEFAULT false,
  push_channels notif_channel[] NOT NULL DEFAULT '{}'   -- relais SMS/Email/Push optionnel
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
  sent_by       uuid REFERENCES app_user(id),  -- NULL = automate (relance d'écolage)
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
