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

-- T3. Écolage de juin non facturable pour une Tle de Tamatave (9 mois : sept.→mai)
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
  ASSERT NOT EXISTS (SELECT 1 FROM v_balance_by_account WHERE category = 'ECOLAGE'),            'T4: fuite vers écolage';
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
  ASSERT (SELECT outstanding_ecolage_mga FROM t6) = 450000, 'T6: solde écolage remonté';
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
  ASSERT fee_price_for('ECOLAGE', '30000000-0000-0000-0000-000000000001') = 450000, 'T12: écolage Tle';
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
SELECT id, 'ENTREE', 'ECOLAGE', 'Encaissement famille', 'Écolage octobre', 420000, 'ESPECES',
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

-- T20. Compétences : copie 1re STMG → 1re Générale (même niveau) seulement ---
INSERT INTO school_class (id, year_id, site_id, level_code, track, name)
SELECT v.id::uuid, y.id, s.id, v.lvl, v.track::track_code, v.name
FROM academic_year y, site s, (VALUES
  ('10000000-0000-0000-0000-000000000002', '1RE', 'STMG', '1re STMG'),
  ('10000000-0000-0000-0000-000000000003', '1RE', 'GENERALE', '1re Générale')) v(id, lvl, track, name)
WHERE s.code = 'TMV';
INSERT INTO competency (class_id, subject_id, position, label)
SELECT '10000000-0000-0000-0000-000000000002', id, v.pos, v.label
FROM subject, (VALUES (1, 'Comprendre un enjeu de société'), (2, 'Construire un argumentaire')) v(pos, label)
WHERE code = 'FRANCAIS';
DO $$ DECLARE f uuid := (SELECT id FROM subject WHERE code = 'FRANCAIS'); BEGIN
  ASSERT copy_competencies('10000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000003', f) = 2, 'T20: copie';
  ASSERT copy_competencies('10000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000003', f) = 0, 'T20: pas de doublon';
  BEGIN
    PERFORM copy_competencies('10000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', f);
    RAISE EXCEPTION 'T20: copie vers un autre niveau acceptée';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'T20:%' THEN RAISE; END IF;
  END;
END $$;

ROLLBACK;
\echo 'OK — tous les scénarios T1 à T20 passent'
