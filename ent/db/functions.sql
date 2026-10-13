-- =============================================================================
--  ENT Chateaubriand — Règles métier exécutées côté base
--  (à charger après schema.sql)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Calendrier de relance : le mois est-il actif pour le cycle d'écolage ?
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
CREATE FUNCTION dunning_schedule(p_year uuid, p_site uuid, p_due date)
RETURNS TABLE (relance_on date, warning_on date, suspension_on date) AS $$
DECLARE
  p dunning_policy%ROWTYPE;
BEGIN
  SELECT * INTO p FROM dunning_policy WHERE year_id = p_year AND site_id = p_site;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Aucune politique de relance pour ce site et cette année';
  END IF;
  relance_on := add_counted_days(p_year, p_site, p_due, p.relance_after);
  IF p.count_from = 'ECHEANCE' THEN
    warning_on    := add_counted_days(p_year, p_site, p_due, p.warning_after);
    suspension_on := add_counted_days(p_year, p_site, p_due, p.suspension_after);
  ELSE
    warning_on    := add_counted_days(p_year, p_site, relance_on, p.warning_after);
    suspension_on := add_counted_days(p_year, p_site, warning_on, p.suspension_after);
  END IF;
  RETURN NEXT;
END $$ LANGUAGE plpgsql STABLE;

-- -----------------------------------------------------------------------------
-- Échéancier d'écolage : seuls les mois du plan du niveau sont facturables
-- (Tamatave 1re/Tle : septembre → mai, soit 9 échéances).
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
$$ LANGUAGE sql STABLE;

CREATE FUNCTION invoice_cutoff_guard() RETURNS trigger AS $$
BEGIN
  IF NEW.category = 'ECOLAGE' AND NOT tuition_month_allowed(NEW.enrollment_id, NEW.period_month) THEN
    RAISE EXCEPTION 'Écolage de % non facturable : au-delà du dernier mois payable pour ce niveau', to_char(NEW.period_month, 'MM/YYYY');
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
-- d'écolage restant (quitus financier à suivre par la comptabilité).
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
  SELECT * INTO sch FROM dunning_schedule(e.year_id, v_site, d.due_on);

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
CROSS JOIN LATERAL dunning_schedule(e.year_id, c.site_id, dc.due_on) s
WHERE dc.stage = 'AVERTISSEMENT' AND dc.closed_at IS NULL
  AND p.suspension_requires_direction AND current_date >= s.suspension_on;
