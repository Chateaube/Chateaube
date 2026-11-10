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
