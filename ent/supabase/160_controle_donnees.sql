-- =============================================================================
--  ENT Chateaubriand — Mise à jour 16 : le serveur contrôle ce qui est enregistré (à lancer une fois, après 150)
--  Pour les rubriques partagées de l'équipe (caisse, élèves, vie scolaire, notes…), le serveur refuse :
--   - un changement de forme : une liste remplacée par autre chose (vide, texte…), ou l'inverse ;
--   - une perte massive : une liste d'au moins 20 lignes qui perdrait plus de la moitié de ses lignes d'un coup
--     (ex. une erreur d'appareil qui renverrait une liste vide) ;
--   - un dossier démesuré (plus de 8 Mo).
--  L'application reprend alors la version du serveur sur l'appareil et l'indique ; rien n'est perdu.
--  Ne modifie ni n'efface aucune donnée existante.
-- =============================================================================

CREATE OR REPLACE FUNCTION ent_doc_check() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE o int; n int;
BEGIN
  IF NEW.kind <> 'PARTAGE' THEN RETURN NEW; END IF;
  IF NEW.value IS NULL OR jsonb_typeof(NEW.value) NOT IN ('array', 'object') THEN
    RAISE EXCEPTION 'FORME_INVALIDE : liste ou fiche attendue pour %', NEW.key;
  END IF;
  IF pg_column_size(NEW.value) > 8 * 1024 * 1024 THEN
    RAISE EXCEPTION 'TROP_GROS : % dépasse 8 Mo', NEW.key;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.value IS NOT NULL THEN
    IF jsonb_typeof(OLD.value) <> jsonb_typeof(NEW.value) THEN
      RAISE EXCEPTION 'FORME_INVALIDE : % changerait de forme', NEW.key;
    END IF;
    IF jsonb_typeof(OLD.value) = 'array' THEN
      o := jsonb_array_length(OLD.value); n := jsonb_array_length(NEW.value);
      IF o >= 20 AND n * 2 < o THEN
        RAISE EXCEPTION 'PERTE_DONNEES : % passerait de % à % lignes', NEW.key, o, n;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS ent_doc_check ON ent_doc;
CREATE TRIGGER ent_doc_check BEFORE INSERT OR UPDATE ON ent_doc FOR EACH ROW EXECUTE FUNCTION ent_doc_check();

-- suivi des mises à jour (150) : 160 s'ajoute à la liste
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
    ('100', EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'ent_next_receipt')),
    ('110', EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'ent_login_check' AND prosrc LIKE '%v_hash%')),
    ('120', EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ent_doc' AND policyname = 'doc_eleve_staff_update')),
    ('130', EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'ent_prof_lines_ok')),
    ('140', to_regclass('public.ent_login_lock') IS NOT NULL),
    ('150', to_regprocedure('ent_installed()') IS NOT NULL),
    ('160', EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'ent_doc_check'))
  )
  SELECT array_agg(n ORDER BY n::int) FILTER (WHERE ok) FROM f
$$;
REVOKE ALL ON FUNCTION ent_installed_all() FROM PUBLIC;

-- Vérification : la liste des mises à jour installées doit finir par 160
SELECT ent_installed_all() AS installees;
