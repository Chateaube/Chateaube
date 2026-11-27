-- =============================================================================
--  ENT Chateaubriand — Mise à jour 13 : droits des professeurs resserrés (à lancer une fois, après 120)
--  1. La liste des comptes (noms, identifiants, adresses e-mail) n'est plus lisible par les professeurs, ni par
--     le secrétariat ni par la vie scolaire : chacun ne lit que son propre compte ; la Direction lit tout.
--  2. Rubriques « classe » (punitions, colles, passeport, objets, absences, examens blancs) : les professeurs
--     les LISENT toujours (fiche de l'élève), mais n'y écrivent plus que :
--       - leurs propres lignes dans les punitions, les objets confisqués, le passeport (oublis, colles) et leur
--         journal : ils ajoutent et corrigent LEURS lignes (signées de leur compte), sans pouvoir modifier ni
--         retirer celles des autres ;
--       - les notes des examens blancs : les notes seulement, pas les sessions ni leur publication.
--     Ils ne peuvent plus rien supprimer ni écrire les absences. La Direction, le secrétariat et la vie scolaire
--     gardent tous leurs droits.
--  Ne modifie ni n'efface aucune donnée.
-- =============================================================================

-- 1. Comptes
DROP POLICY IF EXISTS app_user_read ON app_user;
CREATE POLICY app_user_read ON app_user FOR SELECT TO authenticated USING (id = ent_me());
DROP POLICY IF EXISTS user_role_read ON user_role;
CREATE POLICY user_role_read ON user_role FOR SELECT TO authenticated USING (user_id = ent_me());
-- (la Direction garde la lecture et l'écriture par app_user_direction et user_role_direction)

-- 2. Rubriques « classe »
DROP POLICY IF EXISTS doc_partage_classe ON ent_doc;
DROP POLICY IF EXISTS doc_partage_classe_prof_read ON ent_doc;
DROP POLICY IF EXISTS doc_partage_classe_prof_insert ON ent_doc;
DROP POLICY IF EXISTS doc_partage_classe_prof_update ON ent_doc;
CREATE POLICY doc_partage_classe ON ent_doc FOR ALL TO authenticated
  USING (kind = 'PARTAGE' AND key LIKE 'partage:classe:%' AND ent_has_role('DIRECTION', 'BUREAU', 'VIE_SCOLAIRE'))
  WITH CHECK (kind = 'PARTAGE' AND key LIKE 'partage:classe:%' AND ent_has_role('DIRECTION', 'BUREAU', 'VIE_SCOLAIRE'));
CREATE POLICY doc_partage_classe_prof_read ON ent_doc FOR SELECT TO authenticated
  USING (kind = 'PARTAGE' AND key LIKE 'partage:classe:%' AND ent_has_role('PROFESSEUR'));
-- (le contenu de ce qu'un professeur écrit est vérifié ligne par ligne par ent_doc_prof_check, plus bas)
CREATE POLICY doc_partage_classe_prof_insert ON ent_doc FOR INSERT TO authenticated
  WITH CHECK (kind = 'PARTAGE' AND key IN ('partage:classe:ent-s-sanctions', 'partage:classe:ent-objets-v1', 'partage:classe:ent-passeport-v3', 'partage:classe:ent-journal-profs-v1') AND ent_has_role('PROFESSEUR'));
CREATE POLICY doc_partage_classe_prof_update ON ent_doc FOR UPDATE TO authenticated
  USING (kind = 'PARTAGE' AND key IN ('partage:classe:ent-s-sanctions', 'partage:classe:ent-objets-v1', 'partage:classe:ent-passeport-v3', 'partage:classe:ent-journal-profs-v1', 'partage:classe:ent-examens-blancs-v3') AND ent_has_role('PROFESSEUR'))
  WITH CHECK (kind = 'PARTAGE' AND key IN ('partage:classe:ent-s-sanctions', 'partage:classe:ent-objets-v1', 'partage:classe:ent-passeport-v3', 'partage:classe:ent-journal-profs-v1', 'partage:classe:ent-examens-blancs-v3') AND ent_has_role('PROFESSEUR'));

-- une liste où le professeur « me » n'a touché qu'à ses lignes : celles des autres sont toutes là, à l'identique,
-- et chaque ligne nouvelle ou changée est signée de son compte (uid)
CREATE OR REPLACE FUNCTION ent_prof_lines_ok(o jsonb, n jsonb, me text) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN n IS NULL THEN o IS NULL OR o = '[]'::jsonb WHEN jsonb_typeof(n) <> 'array' THEN false ELSE
    NOT EXISTS (SELECT x FROM jsonb_array_elements(CASE WHEN jsonb_typeof(o) = 'array' THEN o ELSE '[]'::jsonb END) x WHERE x->>'uid' IS DISTINCT FROM me
                EXCEPT SELECT y FROM jsonb_array_elements(n) y)
    AND NOT EXISTS (SELECT 1 FROM (SELECT y FROM jsonb_array_elements(n) y
                                   EXCEPT SELECT x FROM jsonb_array_elements(CASE WHEN jsonb_typeof(o) = 'array' THEN o ELSE '[]'::jsonb END) x) d(z)
                    WHERE z->>'uid' IS DISTINCT FROM me) END
$$;

-- (sans effet, appelée par l'accueil de la Direction pour savoir si cette mise à jour est installée)
GRANT EXECUTE ON FUNCTION ent_prof_lines_ok(jsonb, jsonb, text) TO authenticated;

-- examens blancs sans les notes : ce qu'un professeur ne peut pas changer (sessions, publication, notes de 1re…)
CREATE OR REPLACE FUNCTION ent_blanc_cadre(v jsonb) RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT (coalesce(v, '{}'::jsonb) - 'sessions') || jsonb_build_object('sessions', coalesce((
    SELECT jsonb_agg(s - 'marks' - 'counts' ORDER BY s->>'id')
      FROM jsonb_array_elements(CASE WHEN jsonb_typeof(v->'sessions') = 'array' THEN v->'sessions' ELSE '[]'::jsonb END) s), '[]'::jsonb))
$$;

-- contrôle du contenu écrit par un professeur (la Direction, le secrétariat et la vie scolaire ne sont pas concernés)
CREATE OR REPLACE FUNCTION ent_doc_prof_check() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me text; o jsonb;
BEGIN
  IF NEW.kind <> 'PARTAGE' OR NEW.key NOT LIKE 'partage:classe:%' THEN RETURN NEW; END IF;
  IF NOT ent_has_role('PROFESSEUR') OR ent_has_role('DIRECTION', 'BUREAU', 'VIE_SCOLAIRE') THEN RETURN NEW; END IF;
  me := ent_me()::text;
  o := CASE WHEN TG_OP = 'UPDATE' THEN OLD.value END;
  IF NEW.key IN ('partage:classe:ent-s-sanctions', 'partage:classe:ent-objets-v1', 'partage:classe:ent-journal-profs-v1') THEN
    IF NOT ent_prof_lines_ok(o, NEW.value, me) THEN RAISE EXCEPTION 'PROF_INTERDIT : seules vos propres lignes se modifient'; END IF;
    RETURN NEW;
  END IF;
  IF NEW.key = 'partage:classe:ent-passeport-v3' THEN
    IF jsonb_typeof(NEW.value) <> 'object'
       OR (NEW.value - 'forgets' - 'colles') IS DISTINCT FROM (coalesce(o, '{}'::jsonb) - 'forgets' - 'colles')
       OR NOT ent_prof_lines_ok(o->'forgets', NEW.value->'forgets', me)
       OR NOT ent_prof_lines_ok(o->'colles', NEW.value->'colles', me) THEN
      RAISE EXCEPTION 'PROF_INTERDIT : seuls vos propres oublis et colles se modifient';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.key = 'partage:classe:ent-examens-blancs-v3' THEN
    IF TG_OP <> 'UPDATE' OR ent_blanc_cadre(NEW.value) IS DISTINCT FROM ent_blanc_cadre(OLD.value) THEN
      RAISE EXCEPTION 'PROF_INTERDIT : seules les notes des examens blancs se saisissent ici';
    END IF;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'PROF_INTERDIT';
END $$;
DROP TRIGGER IF EXISTS ent_doc_prof_check ON ent_doc;
CREATE TRIGGER ent_doc_prof_check BEFORE INSERT OR UPDATE ON ent_doc FOR EACH ROW EXECUTE FUNCTION ent_doc_prof_check();

-- Vérification : doit afficher « ok » sur les deux lignes
SELECT CASE WHEN count(*) = 4 THEN 'ok' ELSE 'à revoir' END AS regles_classe FROM pg_policies
 WHERE tablename = 'ent_doc' AND policyname LIKE 'doc_partage_classe%';
SELECT CASE WHEN qual NOT LIKE '%ent_is_staff%' THEN 'ok' ELSE 'à revoir' END AS comptes FROM pg_policies
 WHERE tablename = 'app_user' AND policyname = 'app_user_read';
