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
    SELECT count(*) INTO n FROM phone_confiscation WHERE enrollment_id = NEW.enrollment_id;
    IF n >= 2 THEN NEW.duration_code := '5J';
    ELSIF n = 1 AND NEW.duration_code = '24H' THEN NEW.duration_code := '48H';
    END IF;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

-- s'exécute avant le calcul de la date de restitution (ordre alphabétique des triggers)
CREATE TRIGGER phone_a_recidive BEFORE INSERT ON phone_confiscation
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

-- Passeport : un TIG est donné par la CPE, le secrétariat ou la Direction (pas par un professeur).
CREATE FUNCTION detention_guard() RETURNS trigger AS $$
BEGIN
  IF NEW.kind = 'TIG' AND NOT EXISTS (SELECT 1 FROM user_role WHERE user_id = NEW.given_by AND role IN ('VIE_SCOLAIRE', 'BUREAU', 'DIRECTION')) THEN
    RAISE EXCEPTION 'Un TIG est donné par la CPE, le secrétariat ou la Direction';
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

-- Ambiance du jour : imposée, désactivée, ou la période la plus courte qui contient la date.
CREATE FUNCTION active_season(site uuid, d date) RETURNS text AS $$
  SELECT CASE coalesce((SELECT seasonal_mode FROM site_setting WHERE site_id = site), 'AUTO')
    WHEN 'OFF' THEN NULL
    WHEN 'AUTO' THEN (
      SELECT code FROM season
      WHERE CASE WHEN from_md <= to_md THEN to_char(d, 'MM-DD') BETWEEN from_md AND to_md
                 ELSE to_char(d, 'MM-DD') >= from_md OR to_char(d, 'MM-DD') <= to_md END
      ORDER BY CASE WHEN from_md <= to_md THEN to_date(to_md, 'MM-DD') - to_date(from_md, 'MM-DD')
                    ELSE 365 - (to_date(from_md, 'MM-DD') - to_date(to_md, 'MM-DD')) END
      LIMIT 1)
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
DECLARE actor uuid := coalesce(current_app_user(), NEW.author_id); director boolean := has_role(actor, 'DIRECTION'); action text; BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.author_mandate IS NOT NULL THEN
      -- élève mandaté : il faut le mandat en cours ; signature « Délégués de 1re STMG » ou « Bureau des élèves (BDE) »
      SELECT CASE m.kind WHEN 'DELEGUE' THEN 'Délégués de ' || m.class_name ELSE 'Bureau des élèves (BDE)' END INTO NEW.author_service
        FROM student_mandate(NEW.author_id) m WHERE m.kind = NEW.author_mandate;
      IF NEW.author_service IS NULL THEN RAISE EXCEPTION 'Mandat de délégué ou de BDE requis pour écrire une annonce'; END IF;
    ELSIF NOT (has_role(NEW.author_id, 'DIRECTION') OR has_role(NEW.author_id, 'BUREAU') OR has_role(NEW.author_id, 'VIE_SCOLAIRE')) THEN
      RAISE EXCEPTION 'Les annonces sont rédigées par la Direction, le secrétariat, la CPE, les délégués ou le BDE';
    ELSE
      NEW.author_service := CASE WHEN has_role(NEW.author_id, 'DIRECTION') THEN 'Direction' WHEN has_role(NEW.author_id, 'BUREAU') THEN 'Secrétariat' ELSE 'Vie scolaire (CPE)' END;
    END IF;
    IF NEW.status = 'PUBLIEE' AND NOT has_role(NEW.author_id, 'DIRECTION') THEN
      RAISE EXCEPTION 'Seule la Direction publie : envoyez l''annonce pour validation';
    END IF;
    IF NEW.status = 'PUBLIEE' THEN NEW.validated_by := NEW.author_id; NEW.validated_at := now(); END IF;
    IF NOT has_role(NEW.author_id, 'DIRECTION') THEN NEW.is_pinned := false; END IF; -- l'épinglage se demande
    INSERT INTO publication_event (entity, entity_id, action, by_user) VALUES ('ANNONCE', NEW.id, 'CREEE', NEW.author_id);
    IF NEW.status <> 'BROUILLON' THEN INSERT INTO publication_event (entity, entity_id, action, by_user) VALUES ('ANNONCE', NEW.id, CASE NEW.status WHEN 'PUBLIEE' THEN 'PUBLIEE' ELSE 'ENVOYEE' END, NEW.author_id); END IF;
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
    action := CASE NEW.status WHEN 'EN_ATTENTE' THEN 'ENVOYEE' WHEN 'A_REVOIR' THEN 'RENVOYEE' WHEN 'PUBLIEE' THEN 'PUBLIEE' WHEN 'RETIREE' THEN 'RETIREE' ELSE NULL END;
    IF NEW.status IN ('PUBLIEE', 'A_REVOIR', 'RETIREE') AND NOT director THEN
      RAISE EXCEPTION 'Seule la Direction publie, renvoie ou retire une annonce';
    END IF;
    IF NEW.status = 'EN_ATTENTE' AND (actor <> OLD.author_id OR OLD.status NOT IN ('BROUILLON', 'A_REVOIR')) THEN
      RAISE EXCEPTION 'Seul l''auteur envoie son brouillon';
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
    IF NEW.status = 'PUBLIEE' THEN NEW.status := 'EN_ATTENTE'; END IF;   -- jamais publié sans la Direction
    NEW.proposed_by_mandate := 'BDE';
    INSERT INTO publication_event (entity, entity_id, action, by_user) VALUES ('EVENEMENT', NEW.id, 'CREEE', NEW.created_by);
    IF NEW.status = 'EN_ATTENTE' THEN INSERT INTO publication_event (entity, entity_id, action, by_user) VALUES ('EVENEMENT', NEW.id, 'ENVOYEE', NEW.created_by); END IF;
    RETURN NEW;
  END IF;
  IF OLD.proposed_by_mandate IS NULL THEN RETURN NEW; END IF;
  IF NEW.status <> OLD.status THEN
    IF NEW.status IN ('PUBLIEE', 'A_REVOIR', 'RETIREE') AND NOT director THEN RAISE EXCEPTION 'Seule la Direction publie un événement proposé'; END IF;
    IF NEW.status = 'EN_ATTENTE' AND (actor <> OLD.created_by OR OLD.status NOT IN ('BROUILLON', 'A_REVOIR')) THEN RAISE EXCEPTION 'Seul l''auteur envoie sa proposition'; END IF;
    IF NEW.status = 'PUBLIEE' THEN NEW.validated_by := actor; NEW.review_note := NULL; END IF;
    act := CASE NEW.status WHEN 'EN_ATTENTE' THEN 'ENVOYEE' WHEN 'A_REVOIR' THEN 'RENVOYEE' WHEN 'PUBLIEE' THEN 'PUBLIEE' WHEN 'RETIREE' THEN 'RETIREE' END;
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
