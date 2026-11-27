-- =============================================================================
--  ENT Chateaubriand — Mise à jour 15 : suivi des mises à jour installées (à lancer une fois, après 140)
--  Le serveur sait dire lui-même quelles mises à jour (fichiers 10 à 150) sont installées : l'accueil de la
--  Direction indique alors exactement celles qui manquent, dans l'ordre. Lecture seule : ne modifie aucune donnée.
--  Chaque nouvelle mise à jour ajoutera sa ligne ici.
-- =============================================================================

-- liste brute (interne, non accessible depuis l'application)
CREATE OR REPLACE FUNCTION ent_installed_all() RETURNS text[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH f(n, ok) AS (VALUES
    ('10',  to_regprocedure('ent_me()') IS NOT NULL),
    ('20',  to_regprocedure('ent_code_changed()') IS NOT NULL),
    ('30',  to_regclass('public.ent_doc_history') IS NOT NULL),
    ('40',  EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ent_doc' AND policyname = 'doc_ecole_read')),
    ('50',  EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ent_doc' AND policyname = 'doc_conseil')),
    ('60',  EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ent_doc' AND policyname = 'doc_partage_gestion')),
    ('70',  EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ent_doc' AND policyname = 'doc_prise_read')),
    ('80',  EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ent_doc' AND policyname = 'doc_partage_ecole_read')),
    ('90',  to_regprocedure('ent_my_sites()') IS NOT NULL),
    ('100', to_regprocedure('ent_next_receipt(text)') IS NOT NULL OR EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'ent_next_receipt')),
    ('110', EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'ent_login_check' AND prosrc LIKE '%v_hash%')),
    ('120', EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ent_doc' AND policyname = 'doc_eleve_staff_update')),
    ('130', EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'ent_prof_lines_ok')),
    ('140', to_regclass('public.ent_login_lock') IS NOT NULL),
    ('150', true)
  )
  SELECT array_agg(n ORDER BY n::int) FILTER (WHERE ok) FROM f
$$;
REVOKE ALL ON FUNCTION ent_installed_all() FROM PUBLIC;

-- Direction seulement (les autres comptes reçoivent une liste vide)
CREATE OR REPLACE FUNCTION ent_installed() RETURNS text[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN ent_has_role('DIRECTION') THEN ent_installed_all() ELSE '{}'::text[] END
$$;
REVOKE ALL ON FUNCTION ent_installed() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ent_installed() TO authenticated;

-- Vérification : la liste des mises à jour installées (doit finir par 150 ; un numéro absent = fichier à lancer)
SELECT ent_installed_all() AS installees;
