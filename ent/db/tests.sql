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

INSERT INTO payment (id, receipt_no, category, site_id, amount_mga, method, received_by)
SELECT '60000000-0000-0000-0000-000000000001', 'R-T4', 'DROITS_EXAMEN', id, 600000, 'MVOLA',
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

ROLLBACK;
\echo 'OK — tous les scénarios T1 à T11 passent'
