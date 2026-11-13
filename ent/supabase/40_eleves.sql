-- =============================================================================
--  ENT Chateaubriand — Mise à jour 4 : portail des élèves (à lancer une fois dans SQL Editor, après 30_carnets.sql)
--  1. « ecole » : emploi du temps, calendrier (vacances, événements), calendrier Parcoursup — lu par tout compte connecté ;
--  2. « eleve:<id> » : la classe et le nom de l'élève, posés par la Direction — lus par l'élève et le personnel ;
--  3. « orientation:<id> » : la fiche d'orientation que l'élève remplit — l'élève et la Direction / le secrétariat.
--  Les notes des élèves ne sont PAS ouvertes ici (prévu pour le 17 décembre).
-- =============================================================================

ALTER TABLE ent_doc DROP CONSTRAINT IF EXISTS ent_doc_kind_check;
ALTER TABLE ent_doc ADD CONSTRAINT ent_doc_kind_check CHECK (kind IN ('ROSTER', 'CARNET', 'ECOLE', 'ELEVE', 'ORIENTATION'));

DROP POLICY IF EXISTS doc_ecole_read ON ent_doc;
DROP POLICY IF EXISTS doc_eleve_read ON ent_doc;
DROP POLICY IF EXISTS doc_orientation_read ON ent_doc;
DROP POLICY IF EXISTS doc_orientation_insert ON ent_doc;
DROP POLICY IF EXISTS doc_orientation_update ON ent_doc;
CREATE POLICY doc_ecole_read ON ent_doc FOR SELECT TO authenticated USING (kind = 'ECOLE' AND ent_me() IS NOT NULL);
CREATE POLICY doc_eleve_read ON ent_doc FOR SELECT TO authenticated USING (kind = 'ELEVE' AND (owner = ent_me() OR ent_is_staff()));
CREATE POLICY doc_orientation_read ON ent_doc FOR SELECT TO authenticated
  USING (kind = 'ORIENTATION' AND (owner = ent_me() OR ent_has_role('DIRECTION', 'BUREAU')));
CREATE POLICY doc_orientation_insert ON ent_doc FOR INSERT TO authenticated
  WITH CHECK (kind = 'ORIENTATION' AND owner = ent_me() AND key = 'orientation:' || ent_me()::text);
CREATE POLICY doc_orientation_update ON ent_doc FOR UPDATE TO authenticated
  USING (kind = 'ORIENTATION' AND owner = ent_me())
  WITH CHECK (kind = 'ORIENTATION' AND owner = ent_me() AND key = 'orientation:' || ent_me()::text);

-- Vérification : doit afficher 9 règles (ROSTER, CARNET, ECOLE, ELEVE, ORIENTATION…)
SELECT count(*) AS regles FROM pg_policies WHERE tablename = 'ent_doc';
