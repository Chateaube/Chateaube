-- =============================================================================
--  ENT Chateaubriand — Mise à jour 5 : conseils de classe en ligne (à lancer une fois dans SQL Editor, après 40_eleves.sql)
--  « conseil:<classe>|<élève> » : décision du conseil et appréciation générale de chaque élève.
--  Tapées par la Direction ou par le secrétariat, validées par la Direction. Lues et écrites par la
--  Direction et le secrétariat SEULEMENT (ni les professeurs, ni la vie scolaire, ni les élèves, ni les parents).
-- =============================================================================

ALTER TABLE ent_doc DROP CONSTRAINT IF EXISTS ent_doc_kind_check;
ALTER TABLE ent_doc ADD CONSTRAINT ent_doc_kind_check CHECK (kind IN ('ROSTER', 'CARNET', 'ECOLE', 'ELEVE', 'ORIENTATION', 'CONSEIL'));

DROP POLICY IF EXISTS doc_conseil ON ent_doc;
CREATE POLICY doc_conseil ON ent_doc FOR ALL TO authenticated
  USING (kind = 'CONSEIL' AND ent_has_role('DIRECTION', 'BUREAU'))
  WITH CHECK (kind = 'CONSEIL' AND key LIKE 'conseil:%' AND ent_has_role('DIRECTION', 'BUREAU'));

-- Vérification : doit afficher 11 règles
SELECT count(*) AS regles FROM pg_policies WHERE tablename = 'ent_doc';
