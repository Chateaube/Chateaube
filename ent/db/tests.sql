-- =============================================================================
--  Scénarios de vérification des règles métier (à lancer sur une base vierge
--  après schema.sql, functions.sql et seed.sql). Toute erreur interrompt le script.
--    psql -v ON_ERROR_STOP=1 -f schema.sql -f functions.sql -f seed.sql -f tests.sql
-- =============================================================================
\set QUIET on
BEGIN;

-- Jeu de données minimal ------------------------------------------------------
INSERT INTO app_user (id, email, first_name, last_name) VALUES
  ('00000000-0000-0000-0000-000000000001', 'cheffe@exemple.mg',   'Cheffe',   'Établissement'),
  ('00000000-0000-0000-0000-000000000002', 'adjointe@exemple.mg', 'Directrice', 'Adjointe'),
  ('00000000-0000-0000-0000-000000000003', 'prof@exemple.mg',     'Prof',     'Maths');

INSERT INTO user_role (user_id, role, site_id, title) VALUES
  ('00000000-0000-0000-0000-000000000001', 'DIRECTION', NULL, 'Cheffe d''établissement'),
  ('00000000-0000-0000-0000-000000000002', 'DIRECTION', NULL, 'Directrice adjointe'),
  ('00000000-0000-0000-0000-000000000003', 'PROFESSEUR', (SELECT id FROM site WHERE code = 'TMV'), NULL);

INSERT INTO school_class (id, year_id, site_id, level_code, track, name)
SELECT '10000000-0000-0000-0000-000000000001', y.id, s.id, 'TLE', 'STMG', 'Tle STMG'
FROM academic_year y, site s WHERE s.code = 'TMV';

INSERT INTO student (id, first_name, last_name, birth_date) VALUES
  ('20000000-0000-0000-0000-000000000001', 'Hery', 'RAKOTO', '2009-03-14');

INSERT INTO enrollment (id, student_id, year_id, class_id, enrolled_on)
SELECT '30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', y.id,
       '10000000-0000-0000-0000-000000000001', '2026-09-01'
FROM academic_year y;

INSERT INTO site_assignment (enrollment_id, site_id, valid_during, reason)
SELECT '30000000-0000-0000-0000-000000000001', id, daterange('2026-09-01', '2027-07-05'), 'INSCRIPTION'
FROM site WHERE code = 'TMV';

-- T1. Les deux comptes Direction ont exactement les mêmes permissions ---------
DO $$ BEGIN
  ASSERT (SELECT count(DISTINCT p) FROM (
            SELECT string_agg(rp.permission, ',' ORDER BY rp.permission) p
            FROM user_role ur JOIN role_permission rp ON rp.role = ur.role
            WHERE ur.role = 'DIRECTION' GROUP BY ur.user_id) x) = 1,
    'T1: droits Direction divergents';
END $$;

-- T2. Octobre est exclu du cycle de relance, les autres mois sont actifs ------
DO $$ DECLARE y uuid := (SELECT id FROM academic_year WHERE is_current); BEGIN
  ASSERT NOT is_dunning_month(y, '2026-10-15'), 'T2: octobre devrait être sauté';
  ASSERT is_dunning_month(y, '2026-11-15'),     'T2: novembre devrait être actif';
  ASSERT is_dunning_month(y, '2027-01-15'),     'T2: janvier actif (relance tous les mois sauf octobre)';
END $$;

-- T3. Frais de scolarité de juin non facturable pour une Tle de Tamatave (9 mois : sept.→mai)
INSERT INTO invoice (number, enrollment_id, category, period_month, due_on, amount_mga)
VALUES ('ECO-T3-MAI', '30000000-0000-0000-0000-000000000001', 'ECOLAGE', '2027-05-01', '2027-05-05', 450000);
DO $$ BEGIN
  BEGIN
    INSERT INTO invoice (number, enrollment_id, category, period_month, due_on, amount_mga)
    VALUES ('ECO-T3-JUIN', '30000000-0000-0000-0000-000000000001', 'ECOLAGE', '2027-06-01', '2027-06-05', 450000);
    RAISE EXCEPTION 'T3: la facture de juin aurait dû être refusée';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'T3:%' THEN RAISE; END IF;
  END;
END $$;

-- T4. Droits d'examen : 40 000 Ar conservés, le reste à reverser --------------
INSERT INTO fee_schedule (id, year_id, site_id, level_code, category, exam, label, amount_mga, retained_fee_mga)
SELECT '40000000-0000-0000-0000-000000000001', y.id, s.id, 'TLE', 'DROITS_EXAMEN', 'BAC',
       'Droits Bac candidat libre', 600000, 40000
FROM academic_year y, site s WHERE s.code = 'TMV';

INSERT INTO invoice (id, number, enrollment_id, category, fee_schedule_id, due_on, amount_mga)
VALUES ('50000000-0000-0000-0000-000000000001', 'EXA-T4', '30000000-0000-0000-0000-000000000001',
        'DROITS_EXAMEN', '40000000-0000-0000-0000-000000000001', '2026-10-31', 600000);

INSERT INTO payment (id, receipt_no, category, site_id, amount_mga, method, instrument_ref, bank_name, cheque_status, received_by)
SELECT '60000000-0000-0000-0000-000000000001', 'R-T4', 'DROITS_EXAMEN', id, 600000, 'CHEQUE', '4410275', 'BNI Madagascar', 'A_DEPOSER',
       '00000000-0000-0000-0000-000000000001'
FROM site WHERE code = 'TMV';

SELECT record_exam_fee_payment('60000000-0000-0000-0000-000000000001',
                               '50000000-0000-0000-0000-000000000001',
                               '00000000-0000-0000-0000-000000000001') \gset
SET CONSTRAINTS ALL IMMEDIATE;   -- force le contrôle d'équilibre maintenant
DO $$ BEGIN
  ASSERT (SELECT -solde_mga FROM v_balance_by_account WHERE code = 'EXA-FRAIS-DOS') = 40000,  'T4: frais de dossier';
  ASSERT (SELECT -solde_mga FROM v_balance_by_account WHERE code = 'EXA-A-REVERSER') = 560000, 'T4: à reverser';
  ASSERT NOT EXISTS (SELECT 1 FROM v_balance_by_account WHERE category = 'ECOLAGE'),            'T4: fuite vers frais de scolarité';
  ASSERT (SELECT status FROM invoice WHERE number = 'EXA-T4') = 'PAYEE',                        'T4: statut facture';
END $$;
SET CONSTRAINTS ALL DEFERRED;

-- T5. Étanchéité : impossible d'imputer un compte ECOLAGE dans une écriture d'examen
DO $$ DECLARE e uuid; BEGIN
  INSERT INTO ledger_entry (category, label, site_id, created_by)
  SELECT 'DROITS_EXAMEN', 'test', id, '00000000-0000-0000-0000-000000000001' FROM site WHERE code = 'TMV'
  RETURNING id INTO e;
  BEGIN
    INSERT INTO ledger_line (entry_id, account_code, debit_mga) VALUES (e, 'ECO-CAISSE', 1000);
    RAISE EXCEPTION 'T5: imputation croisée acceptée';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'T5:%' THEN RAISE; END IF;
  END;
  DELETE FROM ledger_entry WHERE id = e;
END $$;

-- T6. Transfert TMV → Tana : historique conservé, données intactes -----------
INSERT INTO transfer_campaign (id, year_id, from_site_id, to_site_id, level_codes, effective_on)
SELECT '70000000-0000-0000-0000-000000000001', y.id,
       (SELECT id FROM site WHERE code = 'TMV'), (SELECT id FROM site WHERE code = 'TANA'),
       '{1RE,TLE}', '2027-04-12'
FROM academic_year y;

CREATE TEMP TABLE t6 AS
SELECT * FROM execute_transfer_campaign('70000000-0000-0000-0000-000000000001',
                                        '00000000-0000-0000-0000-000000000002');
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM t6) = 1, 'T6: un élève transféré';
  ASSERT (SELECT outstanding_ecolage_mga FROM t6) = 450000, 'T6: solde frais de scolarité remonté';
  ASSERT (SELECT count(*) FROM site_assignment WHERE enrollment_id = '30000000-0000-0000-0000-000000000001') = 2,
    'T6: deux affectations historisées';
  ASSERT (SELECT s.code FROM site_assignment sa JOIN site s ON s.id = sa.site_id
          WHERE sa.valid_during @> date '2027-03-01') = 'TMV',  'T6: mars à Tamatave';
  ASSERT (SELECT s.code FROM site_assignment sa JOIN site s ON s.id = sa.site_id
          WHERE sa.valid_during @> date '2027-05-01') = 'TANA', 'T6: mai à Tana';
  ASSERT (SELECT count(*) FROM invoice WHERE enrollment_id = '30000000-0000-0000-0000-000000000001') = 2,
    'T6: factures toujours rattachées';
END $$;

-- T7. Réservations : chevauchement refusé, créneaux contigus acceptés ---------
INSERT INTO resource (id, site_id, type, label)
SELECT '80000000-0000-0000-0000-000000000001', id, 'VIDEOPROJECTEUR', 'Vidéoprojecteur #1' FROM site WHERE code = 'TMV';

INSERT INTO booking (resource_id, booked_by, period) VALUES
  ('80000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003',
   tstzrange('2026-10-14 10:00+03', '2026-10-14 11:00+03')),
  ('80000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003',
   tstzrange('2026-10-14 11:00+03', '2026-10-14 12:00+03'));
DO $$ BEGIN
  BEGIN
    INSERT INTO booking (resource_id, booked_by, period) VALUES
      ('80000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001',
       tstzrange('2026-10-14 10:30+03', '2026-10-14 11:30+03'));
    RAISE EXCEPTION 'T7: conflit non détecté';
  EXCEPTION WHEN exclusion_violation THEN NULL;
  END;
END $$;

-- T8. Une appréciation ne peut être VALIDÉE si le contrôleur a relevé des erreurs
INSERT INTO report_card (id, enrollment_id, period_id)
SELECT '90000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', id
FROM period WHERE rank = 1;
DO $$ BEGIN
  BEGIN
    INSERT INTO report_comment (report_card_id, subject_id, author_id, body, status, rule_check)
    SELECT '90000000-0000-0000-0000-000000000001', id, '00000000-0000-0000-0000-000000000003',
           'Tu es bavard.', 'VALIDE', '{"errors": 2}' FROM subject WHERE code = 'MATHS';
    RAISE EXCEPTION 'T8: appréciation non conforme validée';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    UPDATE report_card SET decision_text = 'Admis en classe de 1re'
    WHERE id = '90000000-0000-0000-0000-000000000001';
    RAISE EXCEPTION 'T8: formulation non inclusive acceptée';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END $$;

-- T9. Délais de relance en jours comptés (lun→ven, hors fériés et vacances) ----
-- (politique précédente épinglée : J+5 / J+10 / J+25 depuis l'échéance ; la politique
--  actuelle de Tamatave est vérifiée en T29)
UPDATE dunning_policy SET relance_after = 5, warning_after = 10, suspension_after = 25,
       count_from = 'ECHEANCE', last_month_relance_after = NULL, last_month_warning_after = NULL,
       last_month_suspension_after = NULL;
DO $$ DECLARE
  y uuid := (SELECT id FROM academic_year WHERE is_current);
  s uuid := (SELECT id FROM site WHERE code = 'TMV');
  r record;
BEGIN
  -- Échéance du 5 décembre : les vacances de Noël suspendent le décompte
  SELECT * INTO r FROM dunning_schedule(y, s, '2026-12-05');
  ASSERT r.relance_on    = '2026-12-11', 'T9: relance J+5 = ' || r.relance_on;
  ASSERT r.warning_on    = '2026-12-18', 'T9: avertissement J+10 = ' || r.warning_on;
  ASSERT r.suspension_on = '2027-01-22', 'T9: mise à pied J+25 = ' || r.suspension_on;
  -- Échéance du 5 septembre : octobre est gelé, le décompte reprend en novembre
  SELECT * INTO r FROM dunning_schedule(y, s, '2026-09-05');
  ASSERT r.relance_on    = '2026-09-11', 'T9: sept. relance = ' || r.relance_on;
  ASSERT r.suspension_on = '2026-11-10', 'T9: sept. mise à pied = ' || r.suspension_on;
  -- Échéance d'octobre : première relance en novembre
  SELECT * INTO r FROM dunning_schedule(y, s, '2026-10-05');
  ASSERT r.relance_on    = '2026-11-06', 'T9: oct. relance = ' || r.relance_on;
  ASSERT r.suspension_on = '2026-12-04', 'T9: oct. mise à pied = ' || r.suspension_on;
END $$;

-- T10. Paramètres modifiables sans recoder : délais comptés depuis l'étape précédente
UPDATE dunning_policy SET count_from = 'ETAPE_PRECEDENTE';
DO $$ DECLARE r record; BEGIN
  SELECT * INTO r FROM dunning_schedule((SELECT id FROM academic_year WHERE is_current),
                                        (SELECT id FROM site WHERE code = 'TMV'), '2026-12-05');
  ASSERT r.relance_on    = '2026-12-11', 'T10: relance = ' || r.relance_on;
  ASSERT r.warning_on    = '2027-01-08', 'T10: avertissement = ' || r.warning_on;
  ASSERT r.suspension_on = '2027-02-12', 'T10: mise à pied = ' || r.suspension_on;
END $$;
UPDATE dunning_policy SET count_from = 'ECHEANCE';

-- T11. Avancement d'un dossier : la mise à pied attend la validation Direction --
INSERT INTO dunning_case (id, enrollment_id, opened_month, due_on, overdue_mga)
VALUES ('a0000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001',
        '2026-12-01', '2026-12-05', 450000);
DO $$ DECLARE c uuid := 'a0000000-0000-0000-0000-000000000001'; BEGIN
  ASSERT advance_dunning_case(c, NULL, '2026-12-15') = 'RELANCE',       'T11: relance';
  ASSERT advance_dunning_case(c, NULL, '2026-12-21') = 'AVERTISSEMENT', 'T11: avertissement';
  ASSERT advance_dunning_case(c, NULL, '2027-01-22') = 'AVERTISSEMENT', 'T11: attend la Direction';
  ASSERT advance_dunning_case(c, '00000000-0000-0000-0000-000000000003', '2027-01-22') = 'AVERTISSEMENT',
    'T11: un professeur ne peut pas valider';
  ASSERT advance_dunning_case(c, '00000000-0000-0000-0000-000000000002', '2027-01-22') = 'MISE_A_PIED',
    'T11: validée par la Directrice adjointe';
  ASSERT (SELECT count(*) FROM dunning_event WHERE case_id = c) = 2, 'T11: transitions historisées';
END $$;

-- T12. Tarifs : prix de la classe prioritaire, sinon prix unique -------------
DO $$ BEGIN
  ASSERT fee_price_for('ECOLAGE', '30000000-0000-0000-0000-000000000001') = 450000, 'T12: frais de scolarité Tle';
  ASSERT fee_price_for('TEE_SHIRT', '30000000-0000-0000-0000-000000000001') = 35000, 'T12: tee-shirt prix unique';
END $$;
INSERT INTO invoice (id, number, enrollment_id, category, due_on, amount_mga)
VALUES ('b0000000-0000-0000-0000-000000000001', 'ANX-T12', '30000000-0000-0000-0000-000000000001',
        'FRAIS_ANNEXES', '2026-10-13', 70000);
INSERT INTO invoice_line (invoice_id, label, quantity, unit_price_mga)
VALUES ('b0000000-0000-0000-0000-000000000001', 'Tee-shirt scolaire', 2, 35000);
DO $$ BEGIN
  ASSERT (SELECT amount_mga FROM invoice_line WHERE invoice_id = 'b0000000-0000-0000-0000-000000000001') = 70000, 'T12: ligne 2 × 35 000';
  ASSERT (SELECT sum(debit_mga - credit_mga) FROM v_account_statement
          WHERE enrollment_id = '30000000-0000-0000-0000-000000000001' AND category = 'FRAIS_ANNEXES') = 70000,
    'T12: état de compte frais annexes';
  ASSERT (SELECT sum(debit_mga - credit_mga) FROM v_account_statement
          WHERE enrollment_id = '30000000-0000-0000-0000-000000000001' AND category = 'DROITS_EXAMEN') = 0,
    'T12: droits d''examen soldés, sans mélange avec les frais annexes';
END $$;

-- T13. Caisse : une sortie ne peut pas dépasser le solde de son journal ------
INSERT INTO cash_movement (site_id, direction, category, nature, label, amount_mga, method, agent_id)
SELECT id, 'ENTREE', 'ECOLAGE', 'Encaissement famille', 'Frais de scolarité octobre', 420000, 'ESPECES',
       '00000000-0000-0000-0000-000000000001' FROM site WHERE code = 'TMV';
INSERT INTO cash_movement (site_id, direction, category, nature, label, amount_mga, method, agent_id)
SELECT id, 'SORTIE', 'ECOLAGE', 'Dépense de fonctionnement', 'Papeterie', 85000, 'ESPECES',
       '00000000-0000-0000-0000-000000000001' FROM site WHERE code = 'TMV';
DO $$ BEGIN
  ASSERT (SELECT balance_mga FROM v_cash_balance WHERE category = 'ECOLAGE') = 335000, 'T13: solde caisse';
  BEGIN
    INSERT INTO cash_movement (site_id, direction, category, nature, label, amount_mga, method, agent_id)
    SELECT id, 'SORTIE', 'DROITS_EXAMEN', 'Reversement centre d''examen', 'Test', 1000, 'VIREMENT',
           '00000000-0000-0000-0000-000000000001' FROM site WHERE code = 'TMV';
    RAISE EXCEPTION 'T13: sortie sans solde acceptée';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'T13:%' THEN RAISE; END IF;
  END;
END $$;

-- T14. Agents : l'accès ENT suit les dates d'entrée et de sortie --------------
INSERT INTO staff_member (user_id, site_id, first_name, last_name, job_title, contract, entry_on, exit_on, exit_reason)
SELECT '00000000-0000-0000-0000-000000000003', id, 'Prof', 'Maths', 'Enseignant.e', 'CDD', '2024-09-02', '2027-07-04', 'Fin de contrat'
FROM site WHERE code = 'TMV';
DO $$ DECLARE u uuid := '00000000-0000-0000-0000-000000000003'; BEGIN
  ASSERT staff_access_active(u, '2026-10-13'),     'T14: en poste';
  ASSERT NOT staff_access_active(u, '2027-07-05'), 'T14: accès coupé après la sortie';
  ASSERT NOT staff_access_active(u, '2024-09-01'), 'T14: pas d''accès avant l''entrée';
  BEGIN
    UPDATE staff_member SET exit_on = '2024-01-01' WHERE user_id = u;
    RAISE EXCEPTION 'T14: sortie avant entrée acceptée';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END $$;

-- T15. Paiements : espèces, chèque ou virement ; n° et banque obligatoires hors espèces
DO $$ DECLARE s uuid := (SELECT id FROM site WHERE code = 'TMV'); a uuid := '00000000-0000-0000-0000-000000000001'; BEGIN
  INSERT INTO payment (receipt_no, category, site_id, amount_mga, method, received_by) VALUES ('R-T15a', 'ECOLAGE', s, 1000, 'ESPECES', a);
  INSERT INTO payment (receipt_no, category, site_id, amount_mga, method, instrument_ref, bank_name, received_by)
  VALUES ('R-T15b', 'ECOLAGE', s, 1000, 'VIREMENT', 'BRD-55120', 'BOA Madagascar', a);
  BEGIN
    INSERT INTO payment (receipt_no, category, site_id, amount_mga, method, cheque_status, received_by) VALUES ('R-T15c', 'ECOLAGE', s, 1000, 'CHEQUE', 'A_DEPOSER', a);
    RAISE EXCEPTION 'T15: chèque sans numéro accepté';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO payment (receipt_no, category, site_id, amount_mga, method, received_by) VALUES ('R-T15d', 'ECOLAGE', s, 1000, 'MVOLA', a);
    RAISE EXCEPTION 'T15: mobile money accepté';
  EXCEPTION WHEN invalid_text_representation THEN NULL;
  END;
END $$;

-- T16. Nouvel élève arrivé le 12 octobre : son compte commence en octobre ----
INSERT INTO student (id, first_name, last_name, birth_date) VALUES ('20000000-0000-0000-0000-000000000002', 'Fy', 'RASOAMANANA', '2012-05-02');
INSERT INTO enrollment (id, student_id, year_id, class_id, enrolled_on)
SELECT '30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', y.id, '10000000-0000-0000-0000-000000000001', '2026-10-12'
FROM academic_year y;
DO $$ BEGIN
  INSERT INTO invoice (number, enrollment_id, category, period_month, due_on, amount_mga)
  VALUES ('ECO-T16-OCT', '30000000-0000-0000-0000-000000000002', 'ECOLAGE', '2026-10-01', '2026-10-12', 450000);
  BEGIN
    INSERT INTO invoice (number, enrollment_id, category, period_month, due_on, amount_mga)
    VALUES ('ECO-T16-SEP', '30000000-0000-0000-0000-000000000002', 'ECOLAGE', '2026-09-01', '2026-09-05', 450000);
    RAISE EXCEPTION 'T16: septembre facturé à un élève arrivé en octobre';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'T16:%' THEN RAISE; END IF;
  END;
END $$;
UPDATE enrollment SET left_on = '2026-10-13' WHERE id = '30000000-0000-0000-0000-000000000002'; -- hors classe pour T17

-- T17. Notes : 4 évaluations minimum, cases remplies, moyenne pondérée, verrouillage
INSERT INTO teaching_assignment (id, class_id, subject_id, teacher_id)
SELECT 'c0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', id, '00000000-0000-0000-0000-000000000003'
FROM subject WHERE code = 'MANAGEMENT';
INSERT INTO evaluation (id, assignment_id, period_id, eval_type, title, held_on, scale_max, coefficient)
SELECT v.id::uuid, 'c0000000-0000-0000-0000-000000000001', p.id, v.t, v.title, '2026-10-01', v.scale, v.coef
FROM period p, (VALUES
  ('d0000000-0000-0000-0000-000000000001', 'DS', 'DS n°1', 20, 2),
  ('d0000000-0000-0000-0000-000000000002', 'INTERRO', 'Interro', 10, 1),
  ('d0000000-0000-0000-0000-000000000003', 'ORAL', 'Oral', 20, 1)) v(id, t, title, scale, coef)
WHERE p.rank = 1;
INSERT INTO grade (evaluation_id, enrollment_id, status, value, entered_by) VALUES
  ('d0000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'NOTE', 16, '00000000-0000-0000-0000-000000000003'),
  ('d0000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', 'NOTE', 9,  '00000000-0000-0000-0000-000000000003'),
  ('d0000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000001', 'NOTE', 17, '00000000-0000-0000-0000-000000000003');
DO $$ DECLARE a uuid := 'c0000000-0000-0000-0000-000000000001'; p uuid := (SELECT id FROM period WHERE rank = 1); BEGIN
  BEGIN
    PERFORM validate_term(a, p, '00000000-0000-0000-0000-000000000003');
    RAISE EXCEPTION 'T17: validé avec 3 évaluations';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'T17:%' THEN RAISE; END IF;
  END;
  INSERT INTO evaluation (id, assignment_id, period_id, eval_type, title, held_on)
  VALUES ('d0000000-0000-0000-0000-000000000004', a, p, 'EXPOSE', 'Exposé', '2026-10-08');
  BEGIN
    PERFORM validate_term(a, p, '00000000-0000-0000-0000-000000000003');
    RAISE EXCEPTION 'T17: validé avec une case vide';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'T17:%' THEN RAISE; END IF;
  END;
  INSERT INTO grade (evaluation_id, enrollment_id, status, entered_by)
  VALUES ('d0000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000001', 'ABSENT', '00000000-0000-0000-0000-000000000003');
  PERFORM validate_term(a, p, '00000000-0000-0000-0000-000000000003');
  -- (16 × 2 + 9/10 × 20 + 17) / 4 = 16,75 ; l'absence ne compte pas
  ASSERT subject_average('30000000-0000-0000-0000-000000000001', a, p) = 16.75, 'T17: moyenne pondérée';
  BEGIN
    UPDATE grade SET value = 20 WHERE evaluation_id = 'd0000000-0000-0000-0000-000000000001';
    RAISE EXCEPTION 'T17: note modifiée après validation';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'T17:%' THEN RAISE; END IF;
  END;
END $$;

-- T18. Moyenne générale : Musique (hors moyenne) n'est pas comptée ------------
INSERT INTO teaching_assignment (id, class_id, subject_id, teacher_id)
SELECT 'c0000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', id, '00000000-0000-0000-0000-000000000003'
FROM subject WHERE code = 'MUSIQUE';
INSERT INTO evaluation (id, assignment_id, period_id, title, held_on)
SELECT 'd0000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000002', id, 'Chant', '2026-10-02' FROM period WHERE rank = 1;
INSERT INTO grade (evaluation_id, enrollment_id, status, value, entered_by)
VALUES ('d0000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000001', 'NOTE', 20, '00000000-0000-0000-0000-000000000003');
DO $$ BEGIN
  ASSERT general_average('30000000-0000-0000-0000-000000000001', (SELECT id FROM period WHERE rank = 1)) = 16.75,
    'T18: musique exclue de la moyenne générale';
  ASSERT (SELECT count(*) FROM v_council_grid WHERE enrollment_id = '30000000-0000-0000-0000-000000000001') = 2, 'T18: deux matières dans la grille';
END $$;

-- T19. Portails : le Bureau voit la vie scolaire, pas l'inverse ; les profs ne voient pas la grille du conseil
DO $$ BEGIN
  ASSERT NOT EXISTS (SELECT permission FROM role_permission WHERE role = 'VIE_SCOLAIRE'
                     EXCEPT SELECT permission FROM role_permission WHERE role = 'BUREAU'), 'T19: Bureau ⊇ Vie scolaire';
  ASSERT NOT EXISTS (SELECT 1 FROM role_permission WHERE role = 'VIE_SCOLAIRE' AND permission IN ('finance.read', 'council.view')),
    'T19: la vie scolaire n''a pas accès au Bureau';
  ASSERT NOT EXISTS (SELECT 1 FROM role_permission WHERE role = 'PROFESSEUR' AND permission = 'council.view'), 'T19: prof sans grille';
  ASSERT EXISTS (SELECT 1 FROM role_permission WHERE role = 'BUREAU' AND permission = 'council.view'), 'T19: Bureau avec grille';
END $$;

-- T20. Compétences : base proposée par niveau, reprise ou complétée par l'enseignant
INSERT INTO school_class (id, year_id, site_id, level_code, track, name)
SELECT v.id::uuid, y.id, s.id, v.lvl, v.track::track_code, v.name
FROM academic_year y, site s, (VALUES
  ('10000000-0000-0000-0000-000000000002', '1RE', 'STMG', '1re STMG'),
  ('10000000-0000-0000-0000-000000000003', '1RE', 'GENERALE', '1re Générale')) v(id, lvl, track, name)
WHERE s.code = 'TMV';
INSERT INTO competency (subject_id, level_code, position, label)
SELECT id, 'TLE', v.pos, v.label FROM subject, (VALUES (1, 'Analyser une situation de gestion'), (2, 'Argumenter')) v(pos, label)
WHERE code = 'MANAGEMENT';
DO $$ DECLARE a uuid := 'c0000000-0000-0000-0000-000000000001'; BEGIN
  ASSERT adopt_base_competencies(a) = 2, 'T20: base reprise';
  ASSERT adopt_base_competencies(a) = 0, 'T20: pas de doublon';
  INSERT INTO competency (subject_id, class_id, author_id, position, label)
  SELECT subject_id, class_id, teacher_id, 3, 'Construire un raisonnement chiffré' FROM teaching_assignment WHERE id = a;
  INSERT INTO evaluation_competency (evaluation_id, competency_id, position)
  SELECT 'd0000000-0000-0000-0000-000000000001', id, 1 FROM competency WHERE label = 'Construire un raisonnement chiffré';
  BEGIN
    INSERT INTO evaluation_competency (evaluation_id, competency_id, position)
    SELECT 'd0000000-0000-0000-0000-000000000001', id, 2 FROM competency WHERE class_id IS NULL AND label = 'Argumenter';
    RAISE EXCEPTION 'T20: compétence de la base utilisée sans reprise';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'T20:%' THEN RAISE; END IF;
  END;
END $$;

-- T21. Téléphone confisqué : restitution sur les jours de classe -------------
DO $$ DECLARE r timestamptz; BEGIN
  INSERT INTO phone_confiscation (enrollment_id, reason, confiscated_at, confiscated_by, received_by, duration_code)
  VALUES ('30000000-0000-0000-0000-000000000001', 'Téléphone en cours', '2026-12-17 10:00+03',
          '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002', '5J')
  RETURNING return_due_at INTO r;
  ASSERT r = '2027-01-07 10:00+03', 'T21: 5 jours ouvrés après les vacances de Noël = ' || r;
  INSERT INTO phone_confiscation (enrollment_id, reason, confiscated_at, confiscated_by, received_by, duration_code)
  VALUES ('30000000-0000-0000-0000-000000000002', 'Téléphone dans la cour', '2026-10-13 15:00+03',
          '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', '24H')
  RETURNING return_due_at INTO r;
  ASSERT r = '2026-10-14 15:00+03', 'T21: 24 h = ' || r;
  BEGIN
    UPDATE phone_confiscation SET returned_at = now() WHERE duration_code = '24H';
    RAISE EXCEPTION 'T21: restitution sans signature acceptée';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END $$;

-- T22. Mesures : motif obligatoire, sanction réservée à la Direction ----------
DO $$ BEGIN
  INSERT INTO discipline_measure (enrollment_id, type_code, reason, decided_by)
  VALUES ('30000000-0000-0000-0000-000000000001', 'RETENUE', 'Travaux non rendus', '00000000-0000-0000-0000-000000000003');
  BEGIN
    INSERT INTO discipline_measure (enrollment_id, type_code, reason, decided_by)
    VALUES ('30000000-0000-0000-0000-000000000001', 'BLAME', 'Insolence', '00000000-0000-0000-0000-000000000003');
    RAISE EXCEPTION 'T22: blâme décidé par un professeur';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'T22:%' THEN RAISE; END IF;
  END;
  INSERT INTO discipline_measure (enrollment_id, type_code, reason, decided_by)
  VALUES ('30000000-0000-0000-0000-000000000001', 'BLAME', 'Insolence', '00000000-0000-0000-0000-000000000001');
  BEGIN
    INSERT INTO discipline_measure (enrollment_id, type_code, reason, decided_by)
    VALUES ('30000000-0000-0000-0000-000000000001', 'RETENUE', '  ', '00000000-0000-0000-0000-000000000003');
    RAISE EXCEPTION 'T22: mesure sans motif acceptée';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  ASSERT (SELECT count(*) FROM v_pending_parent_ack WHERE kind = 'MESURE') = 2, 'T22: deux mesures à confirmer par le parent';
END $$;

-- T23. Autorisations : réponse parmi les options ; cahier de textes cohérent --
INSERT INTO guardian (id, first_name, last_name) VALUES ('e0000000-0000-0000-0000-000000000001', 'Hanta', 'RAKOTO');
DO $$ BEGIN
  INSERT INTO authorization_answer (enrollment_id, type_code, answer, guardian_id)
  VALUES ('30000000-0000-0000-0000-000000000001', 'IMAGE', 'Je n''autorise pas', 'e0000000-0000-0000-0000-000000000001');
  BEGIN
    INSERT INTO authorization_answer (enrollment_id, type_code, answer, guardian_id)
    VALUES ('30000000-0000-0000-0000-000000000001', 'SORTIE', 'Peut-être', 'e0000000-0000-0000-0000-000000000001');
    RAISE EXCEPTION 'T23: réponse hors options acceptée';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'T23:%' THEN RAISE; END IF;
  END;
  INSERT INTO homework (assignment_id, session_on, done_in_class, todo, due_on)
  VALUES ('c0000000-0000-0000-0000-000000000001', '2026-10-13', 'Chapitre 3', 'Questions 1 à 3', '2026-10-15');
  BEGIN
    INSERT INTO homework (assignment_id, session_on, done_in_class, todo, due_on)
    VALUES ('c0000000-0000-0000-0000-000000000001', '2026-10-13', 'Chapitre 3', 'Exercice', '2026-10-12');
    RAISE EXCEPTION 'T23: devoir à rendre avant la séance accepté';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END $$;

-- T24. Téléphone : récidive → 48 h puis 5 jours ; restitution à un parent uniquement pour 5 jours -
DO $$ DECLARE d text; BEGIN
  -- l'élève a déjà une confiscation (T21) : la 2e passe d'office à 48 h…
  INSERT INTO phone_confiscation (enrollment_id, reason, confiscated_at, confiscated_by, received_by, duration_code)
  VALUES ('30000000-0000-0000-0000-000000000001', 'Deuxième fois', '2027-01-08 09:00+03',
          '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002', '24H')
  RETURNING duration_code INTO d;
  ASSERT d = '48H', 'T24: 2e fait non passé à 48 h';
  -- …et la 3e à 5 jours ouvrés
  INSERT INTO phone_confiscation (enrollment_id, reason, confiscated_at, confiscated_by, received_by, duration_code)
  VALUES ('30000000-0000-0000-0000-000000000001', 'Récidive', '2027-01-11 09:00+03',
          '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002', '24H')
  RETURNING duration_code INTO d;
  ASSERT d = '5J', 'T24: récidive non passée à 5 jours';
  BEGIN
    UPDATE phone_confiscation SET returned_at = now(), returned_by = '00000000-0000-0000-0000-000000000002',
           returned_to = 'Hery', returned_to_role = 'ELEVE'
    WHERE reason = 'Récidive';
    RAISE EXCEPTION 'T24: téléphone de 5 jours rendu à l''élève';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  UPDATE phone_confiscation SET returned_at = now(), returned_by = '00000000-0000-0000-0000-000000000002',
         returned_to = 'Mme Rakoto (mère)', returned_to_role = 'PARENT'
  WHERE reason = 'Récidive';
END $$;

-- T25. Appréciation générale : rédigée par la Direction uniquement -----------
DO $$ BEGIN
  BEGIN
    UPDATE report_card SET general_comment = 'Bon trimestre.', general_comment_by = '00000000-0000-0000-0000-000000000003'
    WHERE id = '90000000-0000-0000-0000-000000000001';
    RAISE EXCEPTION 'T25: appréciation générale écrite par un professeur';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'T25:%' THEN RAISE; END IF;
  END;
  UPDATE report_card SET general_comment = 'Trimestre sérieux. Les efforts sont à poursuivre.', general_comment_by = '00000000-0000-0000-0000-000000000002'
  WHERE id = '90000000-0000-0000-0000-000000000001';
END $$;

-- T26. Pas de SMS ; relance des accusés après 48 h ; stages 3e et 2de --------
DO $$ BEGIN
  ASSERT NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
                     WHERE t.typname = 'notif_channel' AND e.enumlabel = 'SMS'), 'T26: canal SMS présent';
  ASSERT (SELECT bool_and(reminder_due) FROM v_pending_parent_ack WHERE kind = 'MESURE') IS NOT NULL, 'T26: vue des relances';
  ASSERT (SELECT school_days FROM internship_type WHERE code = 'STAGE_3E') = 5, 'T26: stage de 3e = 1 semaine';
  ASSERT (SELECT school_days FROM internship_type WHERE code = 'STAGE_2DE') = 10, 'T26: stage de 2de = 2 semaines';
END $$;

-- T27. Devoir : publication aux élèves puis aux parents (+1 jour), « ramener sur 20 », remarques
INSERT INTO teaching_assignment (id, class_id, subject_id, teacher_id)
SELECT 'c0000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', id, '00000000-0000-0000-0000-000000000003'
FROM subject WHERE code = 'MATHS';
INSERT INTO evaluation (id, assignment_id, period_id, title, held_on, publish_on, scale_max, normalize_to_20, remarks_enabled)
SELECT v.id::uuid, 'c0000000-0000-0000-0000-000000000003', p.id, v.title, '2026-10-13', v.pub::date, v.scale, v.norm, v.rem
FROM period p, (VALUES
  ('d0000000-0000-0000-0000-000000000006', 'Interro /10 en points', '2026-10-14', 10, false, true),
  ('d0000000-0000-0000-0000-000000000007', 'DS /20', NULL, 20, true, false)) v(id, title, pub, scale, norm, rem)
WHERE p.rank = 1;
INSERT INTO grade (evaluation_id, enrollment_id, status, value, remark, entered_by) VALUES
  ('d0000000-0000-0000-0000-000000000006', '30000000-0000-0000-0000-000000000001', 'NOTE', 8, 'Bonne méthode', '00000000-0000-0000-0000-000000000003'),
  ('d0000000-0000-0000-0000-000000000007', '30000000-0000-0000-0000-000000000001', 'NOTE', 14, NULL, '00000000-0000-0000-0000-000000000003');
DO $$ DECLARE r record; BEGIN
  -- 8 points /10 + 14 /20 → 22/30 → 14,67/20
  ASSERT subject_average('30000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003',
                         (SELECT id FROM period WHERE rank = 1)) = 14.67, 'T27: points non ramenés sur 20';
  SELECT * INTO r FROM v_published_grades WHERE evaluation_id = 'd0000000-0000-0000-0000-000000000006';
  ASSERT r.students_from = '2026-10-14' AND r.parents_from = '2026-10-15', 'T27: parents un jour après les élèves';
  ASSERT r.remark = 'Bonne méthode', 'T27: remarque publiée';
  ASSERT (SELECT publish_on FROM evaluation WHERE id = 'd0000000-0000-0000-0000-000000000007') = '2026-10-13', 'T27: publication par défaut le jour du devoir';
  BEGIN
    UPDATE grade SET remark = 'Non' WHERE evaluation_id = 'd0000000-0000-0000-0000-000000000007';
    RAISE EXCEPTION 'T27: remarque acceptée sur un devoir sans remarques';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'T27:%' THEN RAISE; END IF;
  END;
END $$;

-- T28. Terminale : Parcoursup pour tous, puis Campus France et TLS si visa -----
UPDATE student SET nationalities = '{MG}' WHERE id = '20000000-0000-0000-0000-000000000001';
UPDATE student SET nationalities = '{MG,FR}' WHERE id = '20000000-0000-0000-0000-000000000002';
DO $$ BEGIN
  ASSERT higher_ed_steps('20000000-0000-0000-0000-000000000001') = '{PARCOURSUP,CAMPUS_FRANCE,TLS}', 'T28: malgache → Parcoursup + Campus France + TLS';
  ASSERT higher_ed_steps('20000000-0000-0000-0000-000000000002') = '{PARCOURSUP}', 'T28: double nationalité → Parcoursup seul';
END $$;

-- T29. Politique de Tamatave : 10 j, puis 15 j, puis 10 j après l'étape précédente ;
--      dernier mois du plan (mai pour la Terminale) : 5 / 5 / 5 --------------------
UPDATE dunning_policy SET relance_after = 10, warning_after = 15, suspension_after = 10,
       count_from = 'ETAPE_PRECEDENTE', last_month_relance_after = 5, last_month_warning_after = 5,
       last_month_suspension_after = 5;
DO $$ DECLARE
  y uuid := (SELECT id FROM academic_year WHERE is_current);
  s uuid := (SELECT id FROM site WHERE code = 'TMV');
  r record;
BEGIN
  SELECT * INTO r FROM dunning_schedule(y, s, '2026-11-05');
  ASSERT (r.relance_on, r.warning_on, r.suspension_on) = ('2026-11-19'::date, '2026-12-10'::date, '2027-01-07'::date),
    'T29: novembre = ' || r::text;
  ASSERT is_last_plan_month('30000000-0000-0000-0000-000000000001', '2027-05-01'), 'T29: mai = dernier mois en Terminale';
  ASSERT NOT is_last_plan_month('30000000-0000-0000-0000-000000000001', '2027-04-01'), 'T29: avril n''est pas le dernier mois';
  SELECT * INTO r FROM dunning_schedule(y, s, '2027-05-05', true);
  ASSERT (r.relance_on, r.warning_on, r.suspension_on) = ('2027-05-13'::date, '2027-05-21'::date, '2027-05-28'::date),
    'T29: dernier mois = ' || r::text;
END $$;

-- T30. Pré-inscription : une demande n'est « inscrite » qu'avec sa fiche élève --------
INSERT INTO pre_registration (id, site_id, child_name, requested_level, contact_name, contact_phone)
VALUES ('e0000000-0000-0000-0000-000000000001', (SELECT id FROM site WHERE code = 'TMV'),
        'RASOLOFO Nirina', '5e', 'M. Rasolofo Fidy', '+261 33 12 650 41');
DO $$ BEGIN
  BEGIN
    UPDATE pre_registration SET status = 'INSCRITE' WHERE id = 'e0000000-0000-0000-0000-000000000001';
    RAISE EXCEPTION 'T30: inscrite sans fiche élève';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  UPDATE pre_registration SET status = 'INSCRITE', student_id = '20000000-0000-0000-0000-000000000001'
   WHERE id = 'e0000000-0000-0000-0000-000000000001';
  BEGIN
    INSERT INTO pre_registration (site_id, child_name, requested_level, contact_name)
    VALUES ((SELECT id FROM site WHERE code = 'TMV'), 'X', '6e', 'Sans contact');
    RAISE EXCEPTION 'T30: demande sans téléphone ni e-mail acceptée';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END $$;

-- T31. Spécialités : 2 en Terminale générale, aucune en STMG ---------------------
INSERT INTO school_class (id, year_id, site_id, level_code, track, name)
SELECT '10000000-0000-0000-0000-0000000000a1', y.id, s.id, 'TLE', 'GENERALE', 'Tle Générale'
FROM academic_year y, site s WHERE s.code = 'TMV';
INSERT INTO student (id, first_name, last_name, birth_date) VALUES ('20000000-0000-0000-0000-0000000000a1', 'Volana', 'RAZAFY', '2008-12-28');
INSERT INTO enrollment (id, student_id, year_id, class_id, enrolled_on)
SELECT '30000000-0000-0000-0000-0000000000a1', '20000000-0000-0000-0000-0000000000a1', y.id,
       '10000000-0000-0000-0000-0000000000a1', '2026-09-01'
FROM academic_year y WHERE y.is_current;
DO $$ DECLARE e uuid := (SELECT id FROM enrollment WHERE class_id = '10000000-0000-0000-0000-0000000000a1'); BEGIN
  ASSERT EXISTS (SELECT 1 FROM v_specialty_incomplete WHERE enrollment_id = e), 'T31: choix incomplet signalé';
  INSERT INTO enrollment_specialty VALUES (e, 'MATHS'), (e, 'PC');
  ASSERT NOT EXISTS (SELECT 1 FROM v_specialty_incomplete WHERE enrollment_id = e), 'T31: 2 spécialités = complet';
  BEGIN
    INSERT INTO enrollment_specialty VALUES (e, 'SVT');
    RAISE EXCEPTION 'T31: troisième spécialité acceptée en Terminale';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'T31:%' THEN RAISE; END IF;
  END;
  BEGIN
    INSERT INTO enrollment_specialty VALUES ('30000000-0000-0000-0000-000000000001', 'MATHS');
    RAISE EXCEPTION 'T31: spécialité acceptée en STMG';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'T31:%' THEN RAISE; END IF;
  END;
END $$;

-- T32. Pas de paiement partiel : une facture se règle en entier -------------------
DO $$ DECLARE i uuid; p uuid; BEGIN
  INSERT INTO invoice (number, enrollment_id, category, due_on, amount_mga)
  VALUES ('ANX-T32', '30000000-0000-0000-0000-000000000001', 'FRAIS_ANNEXES', '2026-10-13', 35000) RETURNING id INTO i;
  INSERT INTO payment (receipt_no, category, site_id, amount_mga, method, received_by)
  SELECT 'R-T32', 'FRAIS_ANNEXES', id, 20000, 'ESPECES', '00000000-0000-0000-0000-000000000001' FROM site WHERE code = 'TMV' RETURNING id INTO p;
  BEGIN
    INSERT INTO payment_allocation VALUES (p, i, 20000);
    RAISE EXCEPTION 'T32: paiement partiel accepté';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'T32:%' THEN RAISE; END IF;
  END;
  INSERT INTO payment_allocation VALUES (p, i, 35000); -- règlement complet accepté
  ASSERT NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fee_item' AND column_name = 'free_amount'), 'T32: plus de montant libre';
END $$;

-- T33. Fiche signalétique signée en ligne avec la signature de référence du parent ---
DO $$ DECLARE g uuid := 'e0000000-0000-0000-0000-000000000001'; other uuid; sig uuid; sig2 uuid; f uuid; BEGIN
  INSERT INTO student_guardian (student_id, guardian_id, relationship)
  SELECT student_id, g, 'Mère' FROM enrollment WHERE id = '30000000-0000-0000-0000-000000000001' ON CONFLICT DO NOTHING;
  INSERT INTO guardian_signature (guardian_id, image_key) VALUES (g, 'sig/hanta.png') RETURNING id INTO sig;
  BEGIN
    INSERT INTO guardian_signature (guardian_id, image_key) VALUES (g, 'sig/hanta-2.png');
    RAISE EXCEPTION 'T33: deux signatures de référence actives';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  INSERT INTO student_record_form (enrollment_id, data, auth_image, auth_hospital, accepted_terms, signed_place)
  VALUES ('30000000-0000-0000-0000-000000000001', '{"allergies": "Aucune"}', true, true, true, 'Tamatave') RETURNING id INTO f;
  INSERT INTO student_record_signature (form_id, guardian_id, signature_id) VALUES (f, g, sig);
  -- un autre adulte, non responsable de l'élève, ne peut pas signer
  INSERT INTO guardian (first_name, last_name) VALUES ('Inconnu', 'TEST') RETURNING id INTO other;
  INSERT INTO guardian_signature (guardian_id, image_key) VALUES (other, 'sig/x.png') RETURNING id INTO sig2;
  BEGIN
    INSERT INTO student_record_signature (form_id, guardian_id, signature_id) VALUES (f, other, sig2);
    RAISE EXCEPTION 'T33: signature d''un non-responsable acceptée';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'T33:%' THEN RAISE; END IF;
  END;
  BEGIN
    INSERT INTO student_record_form (enrollment_id, data, auth_image, auth_hospital, accepted_terms, signed_place)
    VALUES ('30000000-0000-0000-0000-0000000000a1', '{}', false, false, false, 'Tamatave');
    RAISE EXCEPTION 'T33: fiche sans acceptation du règlement';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END $$;

-- T34. Annulation d'un reçu : motif obligatoire, décision par la Direction seule ------
DO $$ DECLARE p uuid := (SELECT id FROM payment WHERE receipt_no = 'R-T32'); BEGIN
  BEGIN
    INSERT INTO payment_cancellation (payment_id, reason, requested_by) VALUES (p, 'erreur', '00000000-0000-0000-0000-000000000003');
    RAISE EXCEPTION 'T34: motif trop court accepté';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  INSERT INTO payment_cancellation (payment_id, reason, requested_by) VALUES (p, 'Erreur d''élève : payé pour le frère', '00000000-0000-0000-0000-000000000003');
  BEGIN
    UPDATE payment_cancellation SET decided_by = '00000000-0000-0000-0000-000000000003', decided_at = now(), approved = true WHERE payment_id = p;
    RAISE EXCEPTION 'T34: décision prise hors Direction';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'T34:%' THEN RAISE; END IF;
  END;
  BEGIN
    UPDATE payment_cancellation SET decided_by = '00000000-0000-0000-0000-000000000002', decided_at = now(), approved = false WHERE payment_id = p;
    RAISE EXCEPTION 'T34: refus sans explication accepté';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  UPDATE payment_cancellation SET decided_by = '00000000-0000-0000-0000-000000000002', decided_at = now(), approved = true WHERE payment_id = p;
END $$;

-- T35. Réductions : accordées par la Direction seule, taux plafonné ------------------
INSERT INTO reduction_type VALUES ('REDOUBLANT_TLE', 'Redoublant en Terminale', 25, 50), ('PROCHE', 'Exonération famille et proches', 100, 0),
  ('PERSONNEL', 'Enfant du personnel', NULL, NULL);
DO $$ BEGIN
  BEGIN
    INSERT INTO reduction_type VALUES ('X', 'Trop', 120, 0);
    RAISE EXCEPTION 'T35: taux supérieur à 100 pour cent accepté';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO enrollment_reduction (enrollment_id, type_code, motif, granted_by)
    VALUES ('30000000-0000-0000-0000-0000000000a1', 'REDOUBLANT_TLE', 'Redouble la Terminale', '00000000-0000-0000-0000-000000000003');
    RAISE EXCEPTION 'T35: réduction accordée hors Direction';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'T35:%' THEN RAISE; END IF;
  END;
  BEGIN
    INSERT INTO enrollment_reduction (enrollment_id, type_code, motif, granted_by)
    VALUES ('30000000-0000-0000-0000-0000000000a1', 'PERSONNEL', 'Fils de Mme Soa', '00000000-0000-0000-0000-000000000001');
    RAISE EXCEPTION 'T35: réduction sans taux accordée';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'T35:%' THEN RAISE; END IF;
  END;
  INSERT INTO enrollment_reduction (enrollment_id, type_code, motif, granted_by)
  VALUES ('30000000-0000-0000-0000-0000000000a1', 'REDOUBLANT_TLE', 'Redouble la Terminale', '00000000-0000-0000-0000-000000000001');
END $$;

-- T36. Manuels et remise du bulletin : un manuel perdu non réglé bloque la remise ------
DO $$ DECLARE t uuid; e uuid := '30000000-0000-0000-0000-0000000000a1'; BEGIN
  INSERT INTO textbook (site_id, title, subject, level_codes, category, is_returnable, is_photocopy, binding, price_mga, replacement_price_mga)
  SELECT id, 'Philosophie Terminale', 'Philosophie', '{TLE}', 'MANUEL', true, false, 'DOS_CARRE', 25000, 66000 FROM site WHERE code = 'TMV' RETURNING id INTO t;
  -- manuel de spécialité SVT : l'élève suit Maths et PC (T31), donc refusé
  INSERT INTO textbook (id, site_id, title, subject, level_codes, category, is_returnable, specialty, is_photocopy, binding, price_mga, replacement_price_mga)
  SELECT 'a0000000-0000-0000-0000-000000000001', id, 'Spécialité SVT Terminale', 'SVT', '{TLE}', 'MANUEL', true, 'SVT', false, 'DOS_CARRE', 25000, 78000 FROM site WHERE code = 'TMV';
  BEGIN
    INSERT INTO textbook_loan (textbook_id, enrollment_id, state_out, issued_on, due_back) VALUES ('a0000000-0000-0000-0000-000000000001', e, 'NEUF', '2026-09-07', '2027-06-30');
    RAISE EXCEPTION 'T36: manuel de spécialité prêté à un élève qui ne la suit pas';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'T36:%' THEN RAISE; END IF;
  END;
  BEGIN
    INSERT INTO textbook (site_id, title, subject, level_codes, category, is_returnable, is_photocopy, binding, price_mga)
    SELECT id, 'Manuel sans prix de perte', 'Français', '{TLE}', 'MANUEL', true, false, 'DOS_CARRE', 25000 FROM site WHERE code = 'TMV';
    RAISE EXCEPTION 'T36: manuel à rendre sans prix de perte';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  INSERT INTO textbook_loan (textbook_id, enrollment_id, state_out, issued_on, due_back) VALUES (t, e, 'BON', '2026-09-07', '2027-06-30');
  BEGIN
    INSERT INTO textbook_loan (textbook_id, enrollment_id, state_out, issued_on, due_back) VALUES (t, e, 'NEUF', '2026-09-08', '2027-06-30');
    RAISE EXCEPTION 'T36: deux exemplaires du même manuel prêtés';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  UPDATE textbook_loan SET lost_on = '2026-10-08' WHERE enrollment_id = e;
  ASSERT EXISTS (SELECT 1 FROM v_bulletin_blocked WHERE enrollment_id = e AND reason = 'MANUEL_DU'), 'T36: manuel perdu non réglé = bulletin bloqué';
  BEGIN
    INSERT INTO bulletin_handover (enrollment_id, term, given_at, given_to, given_by) VALUES (e, 1, now(), 'Mme Razafy', '00000000-0000-0000-0000-000000000003');
    RAISE EXCEPTION 'T36: bulletin remis malgré le blocage';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'T36:%' THEN RAISE; END IF;
  END;
  BEGIN
    INSERT INTO bulletin_handover (enrollment_id, term, given_at, given_to, given_by, override_by, override_reason)
    VALUES (e, 1, now(), 'Mme Razafy', '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000003', 'Échéancier');
    RAISE EXCEPTION 'T36: blocage levé hors Direction';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'T36:%' THEN RAISE; END IF;
  END;
  INSERT INTO bulletin_handover (enrollment_id, term, given_at, given_to, given_by, override_by, override_reason)
  VALUES (e, 1, now(), 'Mme Razafy', '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Échéancier accordé');
END $$;

-- T37. Clôture de caisse : écart expliqué ; plus d'encaissement après clôture -----------
DO $$ DECLARE s uuid := (SELECT id FROM site WHERE code = 'TMV'); BEGIN
  BEGIN
    INSERT INTO cash_closing (site_id, day, expected_mga, counted_mga, counts, closed_by)
    VALUES (s, current_date, 535000, 530000, '{"20000": 26, "5000": 2}', '00000000-0000-0000-0000-000000000003');
    RAISE EXCEPTION 'T37: écart sans explication accepté';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  INSERT INTO cash_closing (site_id, day, expected_mga, counted_mga, counts, explanation, closed_by)
  VALUES (s, current_date, 535000, 530000, '{"20000": 26, "5000": 2}', 'Monnaie rendue en trop à un parent', '00000000-0000-0000-0000-000000000003');
  BEGIN
    INSERT INTO payment (receipt_no, category, site_id, amount_mga, method, received_by) VALUES ('R-T37', 'ECOLAGE', s, 1000, 'ESPECES', '00000000-0000-0000-0000-000000000003');
    RAISE EXCEPTION 'T37: encaissement après clôture accepté';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'T37:%' THEN RAISE; END IF;
  END;
  -- versements prévus tous les jours ouvrés : sans versement hier, le versement est signalé oublié
  INSERT INTO deposit_schedule (site_id, weekdays) VALUES (s, '{1,2,3,4,5}');
  IF extract(isodow FROM current_date) BETWEEN 2 AND 6 THEN
    ASSERT EXISTS (SELECT 1 FROM v_deposit_missed WHERE site_id = s), 'T37: versement oublié signalé';
  END IF;
  INSERT INTO bank_deposit (site_id, amount_mga, bank_name, slip_no, deposited_on, recorded_by)
  VALUES (s, 500000, 'BOA Madagascar', '5530', current_date, '00000000-0000-0000-0000-000000000003');
  ASSERT NOT EXISTS (SELECT 1 FROM v_deposit_missed WHERE site_id = s), 'T37: versement saisi';
  BEGIN
    INSERT INTO bank_deposit (site_id, amount_mga, bank_name, slip_no, deposited_on, recorded_by)
    VALUES (s, 500000, 'BOA Madagascar', '5530', current_date, '00000000-0000-0000-0000-000000000003');
    RAISE EXCEPTION 'T37: même bordereau enregistré deux fois';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
END $$;

-- T38. Salaires : payés par le secrétariat sans attendre la Direction, émargement pour les espèces ---
DO $$ DECLARE s uuid := (SELECT id FROM site WHERE code = 'TMV'); st uuid := (SELECT id FROM staff_member LIMIT 1); BEGIN
  INSERT INTO app_user (id, email, first_name, last_name) VALUES ('00000000-0000-0000-0000-000000000008', 'secretariat@exemple.mg', 'Secrétariat', 'TMV');
  INSERT INTO user_role (user_id, role, site_id) VALUES ('00000000-0000-0000-0000-000000000008', 'BUREAU', s);
  INSERT INTO payroll_month (site_id, month) VALUES (s, '2026-10-01');
  INSERT INTO hourly_rate (staff_id, effective_from, rate_mga) VALUES (st, '2024-09-01', 18000), (st, '2025-09-01', 20000), (st, '2026-09-01', 22000), (st, '2027-01-01', 24000);
  ASSERT rate_on(st, '2026-06-15') = 20000, 'T38: taux en vigueur en juin 2026';
  INSERT INTO payroll_line (site_id, month, staff_id, hours_done, hours_planned) VALUES (s, '2026-10-01', st, 74, 76);
  ASSERT (SELECT hourly_mga FROM payroll_line WHERE staff_id = st) = 22000, 'T38: taux d''octobre 2026 appliqué';
  ASSERT (SELECT net_mga FROM payroll_line WHERE staff_id = st) = 1628000, 'T38: 74 h × 22 000 Ar';
  ASSERT (SELECT method FROM payroll_line WHERE staff_id = st) = 'ESPECES', 'T38: espèces par défaut';
  ASSERT (SELECT contract FROM staff_member WHERE id = st) = 'VACATAIRE', 'T38: professeur vacataire automatiquement';
  BEGIN
    UPDATE payroll_line SET paid_at = now(), paid_by = '00000000-0000-0000-0000-000000000003', signature_key = 'sig/x.png' WHERE staff_id = st;
    RAISE EXCEPTION 'T38: salaire payé par un professeur';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'T38:%' THEN RAISE; END IF;
  END;
  BEGIN
    UPDATE payroll_month SET validated_by = '00000000-0000-0000-0000-000000000003', validated_at = now() WHERE site_id = s;
    RAISE EXCEPTION 'T38: état de paie validé hors Direction';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'T38:%' THEN RAISE; END IF;
  END;
  BEGIN
    UPDATE payroll_line SET paid_at = now(), paid_by = '00000000-0000-0000-0000-000000000008' WHERE staff_id = st;
    RAISE EXCEPTION 'T38: espèces sans émargement';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  -- payé par le secrétariat, sans validation préalable de la Direction
  UPDATE payroll_line SET paid_at = now(), paid_by = '00000000-0000-0000-0000-000000000008', signature_key = 'sig/x.png' WHERE staff_id = st;
END $$;

-- T39. Engagements : au plus 2 délégués par classe -----------------------------------
DO $$ DECLARE e2 uuid; e3 uuid; BEGIN
  INSERT INTO student (id, first_name, last_name, birth_date) VALUES ('20000000-0000-0000-0000-0000000000b2', 'Lova', 'RABE', '2009-01-01'), ('20000000-0000-0000-0000-0000000000b3', 'Tiana', 'RASOA', '2009-02-02');
  INSERT INTO enrollment (student_id, year_id, class_id, enrolled_on) SELECT '20000000-0000-0000-0000-0000000000b2', id, '10000000-0000-0000-0000-000000000001', '2026-09-01' FROM academic_year WHERE is_current RETURNING id INTO e2;
  INSERT INTO enrollment (student_id, year_id, class_id, enrolled_on) SELECT '20000000-0000-0000-0000-0000000000b3', id, '10000000-0000-0000-0000-000000000001', '2026-09-01' FROM academic_year WHERE is_current RETURNING id INTO e3;
  INSERT INTO student_engagement VALUES ('30000000-0000-0000-0000-000000000001', 'DELEGUE'), (e2, 'DELEGUE');
  BEGIN
    INSERT INTO student_engagement VALUES (e3, 'DELEGUE');
    RAISE EXCEPTION 'T39: troisième délégué accepté';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'T39:%' THEN RAISE; END IF;
  END;
  INSERT INTO student_engagement VALUES (e3, 'SUPPLEANT'), (e3, 'ASSR1'), (e3, 'NUMERIQUE');
END $$;

-- T40. Salle d'étude : un mois pour l'élève, prolongation avec le livre, professeur sans date limite ---
DO $$ DECLARE b uuid; l uuid; BEGIN
  INSERT INTO library_book (site_id, kind, title, author, editor, collection, year, isbn)
  SELECT id, 'ROMAN', 'L''Étranger', 'Albert Camus', 'Gallimard', 'Folio', 1972, '9782070360024' FROM site WHERE code = 'TMV' RETURNING id INTO b;
  INSERT INTO library_copy (code, book_id) VALUES ('ROM-0001', b), ('ROM-0002', b);
  BEGIN
    INSERT INTO library_copy (code, book_id) VALUES ('ROMAN-1', b);
    RAISE EXCEPTION 'T40: cote mal formée acceptée';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  INSERT INTO library_loan (copy_code, enrollment_id, out_on, due_on) VALUES ('ROM-0001', '30000000-0000-0000-0000-0000000000a1', current_date - 40, current_date - 10) RETURNING id INTO l;
  ASSERT EXISTS (SELECT 1 FROM v_bulletin_blocked WHERE enrollment_id = '30000000-0000-0000-0000-0000000000a1' AND reason = 'LIVRE'), 'T40: livre en retard = bulletin bloqué';
  BEGIN
    INSERT INTO library_loan (copy_code, staff_id, out_on, due_on) VALUES ('ROM-0001', (SELECT id FROM staff_member LIMIT 1), current_date, NULL);
    RAISE EXCEPTION 'T40: exemplaire prêté deux fois';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  BEGIN
    PERFORM renew_library_loan(l, false);
    RAISE EXCEPTION 'T40: prolongation sans le livre';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'T40:%' THEN RAISE; END IF;
  END;
  ASSERT renew_library_loan(l, true) = current_date + 30, 'T40: prolongé d''un mois';
  BEGIN
    INSERT INTO library_loan (copy_code, staff_id, out_on, due_on) VALUES ('ROM-0002', (SELECT id FROM staff_member LIMIT 1), current_date, current_date + 30);
    RAISE EXCEPTION 'T40: date limite imposée à un professeur';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  INSERT INTO library_loan (copy_code, staff_id, out_on) VALUES ('ROM-0002', (SELECT id FROM staff_member LIMIT 1), current_date);
END $$;

-- T41. Avis du pilote : message obligatoire ----------------------------------------------
DO $$ BEGIN
  INSERT INTO feedback (user_id, role, screen, kind, message) VALUES ('00000000-0000-0000-0000-000000000003', 'PROFESSEUR', 'Notes & appréciations', 'QUESTION', 'Peut-on corriger une note après validation ?');
  BEGIN
    INSERT INTO feedback (user_id, role, screen, kind, message) VALUES ('00000000-0000-0000-0000-000000000003', 'PROFESSEUR', 'Notes', 'IDEE', 'ok');
    RAISE EXCEPTION 'T41: avis vide accepté';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END $$;

-- T42. Un accès par parent ; demandes en ligne déposées par un responsable, traitées par le bureau ---
DO $$ DECLARE g1 uuid; g2 uuid; g3 uuid; u1 uuid; r uuid; BEGIN
  INSERT INTO guardian (first_name, last_name, phone_e164) VALUES ('Lalao', 'RAKOTO', '+261340000001') RETURNING id INTO g1;
  INSERT INTO guardian (first_name, last_name, phone_e164) VALUES ('Fidy', 'RAKOTO', '+261320000002') RETURNING id INTO g2;
  INSERT INTO guardian (first_name, last_name) VALUES ('Voisin', 'SANS LIEN') RETURNING id INTO g3;
  INSERT INTO student_guardian (student_id, guardian_id, relationship) VALUES
    ('20000000-0000-0000-0000-000000000001', g1, 'Mère'), ('20000000-0000-0000-0000-000000000001', g2, 'Père');
  -- parent sans e-mail : compte au téléphone ; un compte ne sert qu'à un seul parent
  INSERT INTO app_user (first_name, last_name, phone_e164, auth_provider) VALUES ('Lalao', 'RAKOTO', '+261340000001', 'PASSWORD') RETURNING id INTO u1;
  UPDATE guardian SET user_id = u1 WHERE id = g1;
  BEGIN
    UPDATE guardian SET user_id = u1 WHERE id = g2;
    RAISE EXCEPTION 'T42: deux parents sur un même accès';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO app_user (first_name, last_name) VALUES ('Sans', 'Identifiant');
    RAISE EXCEPTION 'T42: compte sans e-mail ni téléphone';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  INSERT INTO guardian_access_code (guardian_id, code_hash, issued_by) VALUES (g2, 'h1', '00000000-0000-0000-0000-000000000001');
  BEGIN
    INSERT INTO guardian_access_code (guardian_id, code_hash, issued_by) VALUES (g2, 'h2', '00000000-0000-0000-0000-000000000001');
    RAISE EXCEPTION 'T42: deux codes actifs pour un parent';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  -- réinscription en ligne par la mère, avec une pièce jointe
  INSERT INTO family_request (kind, student_id, submitted_by, payload) VALUES ('REINSCRIPTION', '20000000-0000-0000-0000-000000000001', g1, '{"decision":"REINSCRIT"}') RETURNING id INTO r;
  INSERT INTO family_document (request_id, document_code, file_key) VALUES (r, 'BULLETINS', 'docs/b.pdf');
  BEGIN
    INSERT INTO family_request (kind, student_id, submitted_by, payload) VALUES ('MISE_A_JOUR', '20000000-0000-0000-0000-000000000001', g3, '{}');
    RAISE EXCEPTION 'T42: demande d''une personne qui n''est pas responsable';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'T42:%' THEN RAISE; END IF;
  END;
  BEGIN
    UPDATE family_request SET status = 'VALIDEE', decided_by = '00000000-0000-0000-0000-000000000003' WHERE id = r;
    RAISE EXCEPTION 'T42: demande validée par un professeur';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'T42:%' THEN RAISE; END IF;
  END;
  BEGIN
    UPDATE family_request SET status = 'REFUSEE', decided_by = '00000000-0000-0000-0000-000000000001' WHERE id = r;
    RAISE EXCEPTION 'T42: refus sans motif';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  UPDATE family_request SET status = 'VALIDEE', decided_by = '00000000-0000-0000-0000-000000000001' WHERE id = r;
  ASSERT (SELECT decided_at IS NOT NULL FROM family_request WHERE id = r), 'T42: date de décision';
END $$;

-- T43. Signature d'un document : demandée par le bureau, signée par la Direction seule ---------
DO $$ DECLARE r uuid; sig uuid; BEGIN
  INSERT INTO app_user (id, email, first_name, last_name) VALUES ('00000000-0000-0000-0000-000000000009', 'bureau@exemple.mg', 'Bureau', 'TMV');
  INSERT INTO user_role (user_id, role, site_id) SELECT '00000000-0000-0000-0000-000000000009', 'BUREAU', id FROM site WHERE code = 'TMV';
  INSERT INTO official_signature (user_id, image_key) VALUES ('00000000-0000-0000-0000-000000000002', 'sig/adjointe.png') RETURNING id INTO sig;
  INSERT INTO signature_request (document_kind, student_id, requested_by, reason)
  VALUES ('CERTIFICAT_SCOLARITE', '20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000009', 'Dossier de visa') RETURNING id INTO r;
  BEGIN
    UPDATE signature_request SET status = 'SIGNEE', signed_by = '00000000-0000-0000-0000-000000000009', signature_id = sig WHERE id = r;
    RAISE EXCEPTION 'T43: signé par le bureau';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'T43:%' THEN RAISE; END IF;
  END;
  BEGIN
    UPDATE signature_request SET sent_to = 'famille@exemple.mg', sent_at = now() WHERE id = r;
    RAISE EXCEPTION 'T43: envoyé avant signature';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  UPDATE signature_request SET status = 'SIGNEE', signed_by = '00000000-0000-0000-0000-000000000002', signature_id = sig WHERE id = r;
  ASSERT (SELECT length(verification_code) = 9 AND signed_at IS NOT NULL FROM signature_request WHERE id = r), 'T43: code de vérification et date';
  UPDATE signature_request SET sent_to = 'famille@exemple.mg', sent_at = now() WHERE id = r;
END $$;

-- T44. Trésorerie : dépenses (photo de la facture au-delà de 100 000 Ar) et tableau de bord -------
DO $$ DECLARE s uuid := (SELECT id FROM site WHERE code = 'TMV'); f uuid; before_net bigint; before_committed bigint; BEGIN
  INSERT INTO expense_category VALUES ('LOYER', 'Loyer'), ('FOURNITURES', 'Fournitures');
  INSERT INTO supplier (site_id, name, category_code) VALUES (s, 'Bailleur', 'LOYER') RETURNING id INTO f;
  SELECT net_mga, committed_mga INTO before_net, before_committed FROM v_treasury WHERE site_id = s;
  BEGIN
    INSERT INTO expense (site_id, supplier_id, category_code, label, amount_mga, status, paid_on, method, created_by)
    VALUES (s, f, 'LOYER', 'Loyer d''octobre', 2500000, 'PAYE', '2026-10-05', 'VIREMENT', '00000000-0000-0000-0000-000000000008');
    RAISE EXCEPTION 'T44: grosse dépense sans photo de la facture';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  INSERT INTO expense (site_id, supplier_id, category_code, label, amount_mga, status, paid_on, method, attachment_key, created_by)
  VALUES (s, f, 'LOYER', 'Loyer d''octobre', 2500000, 'PAYE', '2026-10-05', 'VIREMENT', 'factures/loyer-10.jpg', '00000000-0000-0000-0000-000000000008');
  INSERT INTO expense (site_id, category_code, label, amount_mga, status, due_on, created_by)
  VALUES (s, 'FOURNITURES', 'Ramettes', 85000, 'EN_ATTENTE', '2026-10-20', '00000000-0000-0000-0000-000000000008');
  BEGIN
    INSERT INTO expense (site_id, category_code, label, amount_mga, status, created_by) VALUES (s, 'FOURNITURES', 'Encre', 30000, 'EN_ATTENTE', '00000000-0000-0000-0000-000000000008');
    RAISE EXCEPTION 'T44: dépense à payer sans échéance';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  ASSERT (SELECT net_mga FROM v_treasury WHERE site_id = s) = before_net - 2500000, 'T44: loyer payé déduit de la trésorerie';
  ASSERT (SELECT committed_mga FROM v_treasury WHERE site_id = s) = before_committed + 85000, 'T44: ramettes engagées';
END $$;

-- T45. Ajustements : matricule, avertissement téléphone, propriétaire, appréciation générale,
--      retrait des bulletins, pistes d'orientation, campagne de pré-inscription ----------------
DO $$ DECLARE e2 uuid; r uuid; p uuid; BEGIN
  UPDATE enrollment SET matricule = 'TSTMG-001' WHERE id = '30000000-0000-0000-0000-000000000001';
  BEGIN
    UPDATE enrollment SET matricule = 'TSTMG-001' WHERE id = '30000000-0000-0000-0000-0000000000a1';
    RAISE EXCEPTION 'T45: matricule attribué deux fois';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  BEGIN
    UPDATE enrollment SET matricule = 'tg 1' WHERE id = '30000000-0000-0000-0000-0000000000a1';
    RAISE EXCEPTION 'T45: matricule mal formé';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  -- avertissement : pas de durée, téléphone non gardé
  INSERT INTO phone_confiscation (enrollment_id, action, reason, confiscated_at, confiscated_by)
  VALUES ('30000000-0000-0000-0000-0000000000a1', 'AVERTISSEMENT', 'Téléphone sorti en classe', now(), '00000000-0000-0000-0000-000000000003');
  BEGIN
    INSERT INTO phone_confiscation (enrollment_id, action, reason, confiscated_at, confiscated_by, duration_code)
    VALUES ('30000000-0000-0000-0000-0000000000a1', 'AVERTISSEMENT', 'x', now(), '00000000-0000-0000-0000-000000000003', '24H');
    RAISE EXCEPTION 'T45: avertissement avec une durée';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  -- confiscation du téléphone d'un autre élève, 48 h
  INSERT INTO phone_confiscation (enrollment_id, owner_enrollment_id, reason, confiscated_at, confiscated_by, received_by, duration_code)
  VALUES ('30000000-0000-0000-0000-0000000000a1', '30000000-0000-0000-0000-000000000001', 'Téléphone d''un camarade', '2026-10-16 10:00+03',
          '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002', '48H') RETURNING id INTO p;
  ASSERT (SELECT (return_due_at AT TIME ZONE 'Indian/Antananarivo')::date FROM phone_confiscation WHERE id = p) = '2026-10-20', 'T45: 48 h = 2 jours de classe';
  -- l'avertissement est une punition : un professeur peut le donner
  INSERT INTO discipline_measure (enrollment_id, type_code, reason, decided_by, decided_on)
  VALUES ('30000000-0000-0000-0000-0000000000a1', 'AVERTISSEMENT', 'Bavardages répétés', '00000000-0000-0000-0000-000000000003', current_date);
  -- appréciation générale : tapée par le secrétariat, validée par la Direction
  SELECT id INTO r FROM report_card WHERE general_comment IS NOT NULL LIMIT 1;
  UPDATE report_card SET general_comment = 'Trimestre correct ; doit gagner en régularité.', general_comment_by = '00000000-0000-0000-0000-000000000008',
         general_comment_status = 'A_VALIDER', general_comment_validated_by = NULL WHERE id = r;
  BEGIN
    UPDATE report_card SET general_comment_status = 'VALIDE', general_comment_validated_by = '00000000-0000-0000-0000-000000000008' WHERE id = r;
    RAISE EXCEPTION 'T45: validée par le secrétariat';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'T45:%' THEN RAISE; END IF;
  END;
  UPDATE report_card SET general_comment_status = 'VALIDE', general_comment_validated_by = '00000000-0000-0000-0000-000000000001' WHERE id = r;
  UPDATE report_card SET general_comment = 'Trimestre correct ; doit gagner en régularité et en rigueur.', general_comment_by = '00000000-0000-0000-0000-000000000008' WHERE id = r;
  ASSERT (SELECT general_comment_status FROM report_card WHERE id = r) = 'A_VALIDER', 'T45: texte modifié = à revalider';
  -- retrait des bulletins, pistes, campagne
  INSERT INTO bulletin_release (period_id, class_id, available_from, pickup_days, set_by)
  SELECT id, '10000000-0000-0000-0000-000000000001', '2026-12-14', 14, '00000000-0000-0000-0000-000000000001' FROM period LIMIT 1;
  INSERT INTO orientation_track (enrollment_id, destination) VALUES ('30000000-0000-0000-0000-000000000001', 'FRANCE'), ('30000000-0000-0000-0000-000000000001', 'CANADA');
  BEGIN
    INSERT INTO orientation_track (enrollment_id, destination) VALUES ('30000000-0000-0000-0000-000000000001', 'CANADA');
    RAISE EXCEPTION 'T45: deux pistes Canada ouvertes';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  BEGIN
    UPDATE orientation_track SET closed_on = current_date WHERE destination = 'FRANCE';
    RAISE EXCEPTION 'T45: piste clôturée sans motif';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  UPDATE orientation_track SET closed_on = current_date, close_reason = 'Ne part pas en France' WHERE destination = 'FRANCE';
  INSERT INTO pre_registration_campaign SELECT id, '2027-2028', '2027-05-03', '2027-07-16' FROM site WHERE code = 'TMV';
  BEGIN
    INSERT INTO pre_registration_campaign SELECT id, '2028-2029', '2028-07-16', '2028-05-03' FROM site WHERE code = 'TMV';
    RAISE EXCEPTION 'T45: campagne qui ferme avant d''ouvrir';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END $$;

-- T46. Réservations de livres : une seule par personne et par livre, au plus 30 jours à l'avance -----
DO $$ DECLARE b uuid := (SELECT book_id FROM library_copy WHERE code = 'ROM-0001'); BEGIN
  INSERT INTO library_reservation (book_id, enrollment_id, wanted_on, status, hold_until) VALUES (b, '30000000-0000-0000-0000-000000000001', current_date + 2, 'A_RETIRER', current_date + 4);
  BEGIN
    INSERT INTO library_reservation (book_id, enrollment_id, wanted_on) VALUES (b, '30000000-0000-0000-0000-000000000001', current_date + 5);
    RAISE EXCEPTION 'T46: deux réservations du même livre';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO library_reservation (book_id, staff_id, wanted_on) VALUES (b, (SELECT id FROM staff_member LIMIT 1), current_date + 60);
    RAISE EXCEPTION 'T46: réservation à deux mois';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    UPDATE library_reservation SET status = 'REMISE' WHERE book_id = b;
    RAISE EXCEPTION 'T46: remise sans prêt';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  INSERT INTO library_reservation (book_id, staff_id, wanted_on) VALUES (b, (SELECT id FROM staff_member LIMIT 1), current_date);
END $$;

-- T47. Heures des professeurs et absences (travail laissé) ; ressources internes -------------------
DO $$ DECLARE sl uuid; r record; BEGIN
  INSERT INTO timetable_slot (assignment_id, weekday, starts_at, ends_at, valid_during)
  VALUES ('c0000000-0000-0000-0000-000000000001', 1, '07:00', '09:00', daterange('2026-09-01', '2027-07-05')) RETURNING id INTO sl;
  BEGIN
    INSERT INTO teacher_absence (slot_id, on_date, reason, work_kind, declared_by) VALUES (sl, '2026-10-13', 'Formation', 'AUCUN', '00000000-0000-0000-0000-000000000003');
    RAISE EXCEPTION 'T47: absence un jour sans cours';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'T47:%' THEN RAISE; END IF;
  END;
  BEGIN
    INSERT INTO teacher_absence (slot_id, on_date, reason, work_kind, declared_by) VALUES (sl, '2026-10-12', 'Formation', 'DEVOIR', '00000000-0000-0000-0000-000000000003');
    RAISE EXCEPTION 'T47: devoir sans consigne';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  INSERT INTO teacher_absence (slot_id, on_date, reason, work_kind, work_text, declared_by)
  VALUES (sl, '2026-10-12', 'Formation', 'DEVOIR', 'Exercices 1 à 4 p. 52', '00000000-0000-0000-0000-000000000003');
  SELECT * INTO r FROM teacher_hours('00000000-0000-0000-0000-000000000003', '2026-10-05', '2026-10-16');
  ASSERT r.planned = 4 AND r.absent = 2 AND r.done = 2, format('T47: heures %s / %s / %s', r.planned, r.absent, r.done);
  BEGIN
    INSERT INTO internal_resource (site_id, title, audiences, body, shared_by) SELECT id, 'Charte', '{PROFS}', 'Texte', '00000000-0000-0000-0000-000000000003' FROM site WHERE code = 'TMV';
    RAISE EXCEPTION 'T47: ressource partagée par un professeur';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'T47:%' THEN RAISE; END IF;
  END;
  INSERT INTO internal_resource (site_id, title, audiences, body, shared_by) SELECT id, 'Charte de l''enseignant', '{PROFS}', 'Ponctualité…', '00000000-0000-0000-0000-000000000001' FROM site WHERE code = 'TMV';
END $$;

-- T48. Dispense de travail, retards cumulés, jeux de société, ressource « lien » ---------------------
DO $$ DECLARE sl uuid; g uuid; u uuid; BEGIN
  SELECT slot_id INTO sl FROM teacher_absence LIMIT 1;
  BEGIN
    INSERT INTO teacher_absence (slot_id, on_date, reason, work_kind, declared_by, granted_by)
    VALUES (sl, '2026-10-19', 'Maladie', 'NON_REQUIS', '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000003');
    RAISE EXCEPTION 'T48: dispense accordée par un professeur';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'T48:%' THEN RAISE; END IF;
  END;
  INSERT INTO teacher_absence (slot_id, on_date, reason, work_kind, declared_by, granted_by)
  VALUES (sl, '2026-10-19', 'Maladie (cinquième jour)', 'NON_REQUIS', '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001');
  INSERT INTO teacher_lateness (teacher_id, on_date, minutes, recorded_by)
  SELECT '00000000-0000-0000-0000-000000000003', d, m, '00000000-0000-0000-0000-000000000008'
  FROM (VALUES ('2026-10-01'::date, 10), ('2026-10-05', 15), ('2026-10-08', 20), ('2026-10-12', 25)) v(d, m);
  ASSERT (SELECT hours_to_make_up FROM v_teacher_lateness WHERE teacher_id = '00000000-0000-0000-0000-000000000003') = 1, 'T48: 70 min = 1 h à rattraper';
  INSERT INTO teacher_makeup (teacher_id, on_date, recorded_by) VALUES ('00000000-0000-0000-0000-000000000003', '2026-10-17', '00000000-0000-0000-0000-000000000008');
  ASSERT (SELECT hours_to_make_up FROM v_teacher_lateness WHERE teacher_id = '00000000-0000-0000-0000-000000000003') = 0, 'T48: heure rattrapée';
  INSERT INTO board_game (site_id, name, pieces, copies) SELECT id, 'Échecs', '32 pièces', 1 FROM site WHERE code = 'TMV' RETURNING id INTO g;
  INSERT INTO board_game_use (game_id, players) VALUES (g, 'Hasina, Miora') RETURNING id INTO u;
  BEGIN
    INSERT INTO board_game_use (game_id, players) VALUES (g, 'Fy');
    RAISE EXCEPTION 'T48: jeu sorti deux fois';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'T48:%' THEN RAISE; END IF;
  END;
  BEGIN
    UPDATE board_game_use SET back_at = now(), complete = false WHERE id = u;
    RAISE EXCEPTION 'T48: incident sans description';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  UPDATE board_game_use SET back_at = now(), complete = false, incident = 'Il manque un pion' WHERE id = u;
  INSERT INTO internal_resource (site_id, title, audiences, url, shared_by) SELECT id, 'Programme officiel', '{PROFS}', 'https://eduscol.education.fr', '00000000-0000-0000-0000-000000000001' FROM site WHERE code = 'TMV';
END $$;

-- T49. Documents par public ; boîte à idées --------------------------------------------------------
DO $$ DECLARE parent uuid; sg uuid; BEGIN
  INSERT INTO internal_resource (site_id, title, audiences, body, shared_by)
  SELECT id, 'Règlement intérieur', '{ELEVES,PARENTS}', 'Horaires…', '00000000-0000-0000-0000-000000000001' FROM site WHERE code = 'TMV';
  BEGIN
    INSERT INTO internal_resource (site_id, title, audiences, body, shared_by) SELECT id, 'x', '{VOISINS}', 'x', '00000000-0000-0000-0000-000000000001' FROM site WHERE code = 'TMV';
    RAISE EXCEPTION 'T49: public inconnu';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  INSERT INTO app_user (email, first_name, last_name) VALUES ('parent.t49@exemple.mg', 'Parent', 'T49') RETURNING id INTO parent;
  INSERT INTO user_role (user_id, role, site_id) SELECT parent, 'PARENT', id FROM site WHERE code = 'TMV';
  ASSERT (SELECT count(*) FROM resources_for(parent) WHERE title = 'Règlement intérieur') = 1, 'T49: le parent voit le règlement';
  ASSERT NOT EXISTS (SELECT 1 FROM resources_for(parent) WHERE 'PROFS' = ANY (audiences) AND NOT 'PARENTS' = ANY (audiences)), 'T49: le parent ne voit pas les documents des professeurs';
  INSERT INTO staff_suggestion (site_id, category, body, author_id) SELECT id, 'METHODOLOGIE', 'Une fiche méthode commune pour la dissertation', '00000000-0000-0000-0000-000000000003' FROM site WHERE code = 'TMV' RETURNING id INTO sg;
  BEGIN
    UPDATE staff_suggestion SET status = 'RETENUE', answered_by = '00000000-0000-0000-0000-000000000003' WHERE id = sg;
    RAISE EXCEPTION 'T49: réponse d''un professeur';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'T49:%' THEN RAISE; END IF;
  END;
  BEGIN
    UPDATE staff_suggestion SET status = 'NON_RETENUE', answered_by = '00000000-0000-0000-0000-000000000001' WHERE id = sg;
    RAISE EXCEPTION 'T49: refus sans explication';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  UPDATE staff_suggestion SET status = 'RETENUE', answered_by = '00000000-0000-0000-0000-000000000001', answer = 'Au conseil pédagogique' WHERE id = sg;
END $$;

-- T50. Changements d'emploi du temps ; sortie anticipée d'un mineur ---------------------------------
DO $$ DECLARE sl uuid := (SELECT id FROM timetable_slot LIMIT 1); BEGIN
  BEGIN
    INSERT INTO timetable_change (kind, class_id, slot_id, on_date, decided_by) VALUES ('ANNULE', '10000000-0000-0000-0000-000000000001', sl, '2026-10-19', '00000000-0000-0000-0000-000000000003');
    RAISE EXCEPTION 'T50: cours annulé par un professeur';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'T50:%' THEN RAISE; END IF;
  END;
  BEGIN
    INSERT INTO timetable_change (kind, class_id, slot_id, on_date, decided_by) VALUES ('DEPLACE', '10000000-0000-0000-0000-000000000001', sl, '2026-10-19', '00000000-0000-0000-0000-000000000001');
    RAISE EXCEPTION 'T50: cours déplacé sans nouvelle date';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  INSERT INTO timetable_change (kind, class_id, slot_id, on_date, new_date, new_starts_at, new_ends_at, decided_by)
  VALUES ('DEPLACE', '10000000-0000-0000-0000-000000000001', sl, '2026-10-19', '2026-10-22', '13:30', '15:30', '00000000-0000-0000-0000-000000000008');
  -- Hery RAKOTO (né le 14/03/2009) est mineur en octobre 2026 : il ne part pas seul
  BEGIN
    INSERT INTO early_departure (enrollment_id, left_at, reason, parent_called_at, student_is_minor, recorded_by)
    VALUES ('30000000-0000-0000-0000-000000000001', '2026-10-13 10:20+03', 'Malaise', '2026-10-13 10:05+03', false, '00000000-0000-0000-0000-000000000008');
    RAISE EXCEPTION 'T50: mineur parti seul';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO early_departure (enrollment_id, left_at, reason, parent_called_at, student_is_minor, picked_up_by, relation, picked_up_is_guardian, recorded_by)
    VALUES ('30000000-0000-0000-0000-000000000001', '2026-10-13 10:20+03', 'Malaise', '2026-10-13 10:05+03', true, 'M. Rabe', 'oncle', false, '00000000-0000-0000-0000-000000000008');
    RAISE EXCEPTION 'T50: oncle sans confirmation du parent';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  INSERT INTO early_departure (enrollment_id, left_at, reason, parent_called_at, student_is_minor, picked_up_by, relation, picked_up_is_guardian, guardian_confirmed, recorded_by)
  VALUES ('30000000-0000-0000-0000-000000000001', '2026-10-13 10:20+03', 'Malaise', '2026-10-13 10:05+03', true, 'M. Rabe', 'oncle', false, true, '00000000-0000-0000-0000-000000000008');
END $$;

ROLLBACK;
\echo 'OK — tous les scénarios T1 à T50 passent'
