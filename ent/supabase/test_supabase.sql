-- Tests de la couche Supabase (sur une base locale qui imite Supabase : schéma auth, rôles anon et authenticated)
\set ON_ERROR_STOP 1
BEGIN;
-- personnes : Direction, deux professeurs, CPE
INSERT INTO auth.users (id, email) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'direction@ecole.mg'), ('a0000000-0000-0000-0000-000000000002', 'prof1@ecole.mg'),
  ('a0000000-0000-0000-0000-000000000003', 'prof2@ecole.mg'), ('a0000000-0000-0000-0000-000000000004', 'cpe@ecole.mg');
SELECT ent_first_direction('direction@ecole.mg', 'direction', 'Test', 'DIRECTION') IS NOT NULL AS direction_creee;
INSERT INTO app_user (id, email, first_name, last_name, auth_uid, login) VALUES
  ('b0000000-0000-0000-0000-000000000002', 'prof1@ecole.mg', 'Un', 'PROF', 'a0000000-0000-0000-0000-000000000002', 'prof.un'),
  ('b0000000-0000-0000-0000-000000000003', 'prof2@ecole.mg', 'Deux', 'PROF', 'a0000000-0000-0000-0000-000000000003', 'prof.deux'),
  ('b0000000-0000-0000-0000-000000000004', 'cpe@ecole.mg', 'La', 'CPE', 'a0000000-0000-0000-0000-000000000004', 'cpe');
INSERT INTO user_role (user_id, role) VALUES ('b0000000-0000-0000-0000-000000000002', 'PROFESSEUR'), ('b0000000-0000-0000-0000-000000000003', 'PROFESSEUR'), ('b0000000-0000-0000-0000-000000000004', 'VIE_SCOLAIRE');
INSERT INTO school_class (id, year_id, site_id, level_code, track, name)
SELECT v.id::uuid, y.id, s.id, v.lvl, v.tr::track_code, v.n FROM academic_year y, site s,
  (VALUES ('c0000000-0000-0000-0000-000000000001', '6E', NULL, '6e'), ('c0000000-0000-0000-0000-000000000002', '5E', NULL, '5e')) v(id, lvl, tr, n)
WHERE s.code = 'TMV';
INSERT INTO student (id, first_name, last_name, birth_date) VALUES ('d0000000-0000-0000-0000-000000000001', 'Élève', 'SIXIEME', '2015-01-01'), ('d0000000-0000-0000-0000-000000000002', 'Élève', 'CINQUIEME', '2014-01-01');
INSERT INTO enrollment (id, student_id, year_id, class_id, enrolled_on) SELECT v.e::uuid, v.s::uuid, y.id, v.c::uuid, '2026-09-01' FROM academic_year y,
  (VALUES ('e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001'),
          ('e0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000002')) v(e, s, c);
INSERT INTO teaching_assignment (id, class_id, subject_id, teacher_id) SELECT v.a::uuid, v.c::uuid, sub.id, v.t::uuid FROM (SELECT id FROM subject LIMIT 1) sub,
  (VALUES ('f0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002'),
          ('f0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000003')) v(a, c, t);
INSERT INTO evaluation (id, assignment_id, period_id, title, held_on) SELECT v.id::uuid, v.a::uuid, p.id, v.t, '2026-10-05' FROM period p,
  (VALUES ('99000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'DS 6e'), ('99000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000002', 'DS 5e')) v(id, a, t) WHERE p.rank = 1;

-- connexion par identifiant (rôle anonyme)
SET LOCAL ROLE anon;
DO $$ BEGIN ASSERT ent_login_email('prof.un') = 'prof1@ecole.mg', 'identifiant → e-mail'; ASSERT ent_login_email('inconnu') IS NULL; END $$;
DO $$ BEGIN ASSERT (SELECT count(*) FROM student) = 0, 'anonyme : aucun élève visible'; END $$;
RESET ROLE;

-- professeur 1 : ne voit que ses devoirs, peut noter dans sa classe, pas dans celle du collègue
SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000002';
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM evaluation) = 1, 'prof 1 : ses devoirs seulement';
  ASSERT (SELECT count(*) FROM student) = 2, 'le personnel voit la liste des élèves';
  INSERT INTO grade (evaluation_id, enrollment_id, status, value, entered_by) VALUES ('99000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'NOTE', 14, 'b0000000-0000-0000-0000-000000000002');
  BEGIN
    INSERT INTO grade (evaluation_id, enrollment_id, status, value, entered_by) VALUES ('99000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000002', 'NOTE', 3, 'b0000000-0000-0000-0000-000000000002');
    RAISE EXCEPTION 'prof 1 a noté dans la classe du collègue';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  INSERT INTO attendance_event (enrollment_id, kind, occurred_at, recorded_by) VALUES ('e0000000-0000-0000-0000-000000000001', 'ABSENCE', now(), 'b0000000-0000-0000-0000-000000000002');
  BEGIN
    INSERT INTO attendance_event (enrollment_id, kind, occurred_at, recorded_by) VALUES ('e0000000-0000-0000-0000-000000000002', 'ABSENCE', now(), 'b0000000-0000-0000-0000-000000000002');
    RAISE EXCEPTION 'prof 1 a fait l''appel d''une classe qui n''est pas la sienne';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    UPDATE user_role SET role = 'DIRECTION' WHERE user_id = 'b0000000-0000-0000-0000-000000000002';
    ASSERT NOT ent_has_role('DIRECTION'), 'un prof ne peut pas se donner le rôle Direction';
  END;
END $$;
RESET ROLE;

-- CPE : voit toutes les absences, aucune note
SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000004';
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM attendance_event) = 1, 'CPE : toutes les absences';
  ASSERT (SELECT count(*) FROM grade) = 0 AND (SELECT count(*) FROM evaluation) = 0, 'CPE : pas de notes';
  UPDATE attendance_event SET justified = true;
  ASSERT (SELECT bool_and(justified) FROM attendance_event), 'CPE : justifie';
END $$;
RESET ROLE;

-- professeur 2 : ne voit ni la note ni l'absence de la 6e
SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000003';
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM grade) = 0, 'prof 2 : pas les notes du collègue';
  ASSERT (SELECT count(*) FROM attendance_event) = 0, 'prof 2 : pas les absences d''une autre classe';
END $$;
RESET ROLE;

-- Direction : voit et modifie tout
SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000001';
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM evaluation) = 2 AND (SELECT count(*) FROM grade) = 1, 'Direction : tout';
  INSERT INTO app_user (email, first_name, last_name, login) VALUES ('nouveau@ecole.mg', 'Nouveau', 'PROF', 'prof.nouveau');
END $$;
RESET ROLE;
ROLLBACK;
\echo 'OK — couche Supabase : connexion par identifiant et règles d''accès vérifiées'
