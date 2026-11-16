-- =============================================================================
--  ENT Chateaubriand — Mise à jour 6 : données partagées entre les bureaux (à lancer une fois dans SQL Editor)
--  « partage:gestion:… » : caisse, dépenses, salaires, inscriptions, paiements → Direction et secrétariat ;
--  « partage:equipe:… »  : élèves, vie scolaire, agenda, annonces, réglages… → Direction, secrétariat et vie scolaire.
--  Les professeurs, les élèves et les parents n'y ont pas accès. L'historique (ent_doc_history) garde les versions.
-- =============================================================================

ALTER TABLE ent_doc DROP CONSTRAINT IF EXISTS ent_doc_kind_check;
ALTER TABLE ent_doc ADD CONSTRAINT ent_doc_kind_check CHECK (kind IN ('ROSTER', 'CARNET', 'ECOLE', 'ELEVE', 'ORIENTATION', 'CONSEIL', 'PARTAGE'));

DROP POLICY IF EXISTS doc_partage_gestion ON ent_doc;
DROP POLICY IF EXISTS doc_partage_equipe ON ent_doc;
CREATE POLICY doc_partage_gestion ON ent_doc FOR ALL TO authenticated
  USING (kind = 'PARTAGE' AND key LIKE 'partage:gestion:%' AND ent_has_role('DIRECTION', 'BUREAU'))
  WITH CHECK (kind = 'PARTAGE' AND key LIKE 'partage:gestion:%' AND ent_has_role('DIRECTION', 'BUREAU'));
CREATE POLICY doc_partage_equipe ON ent_doc FOR ALL TO authenticated
  USING (kind = 'PARTAGE' AND key LIKE 'partage:equipe:%' AND ent_has_role('DIRECTION', 'BUREAU', 'VIE_SCOLAIRE'))
  WITH CHECK (kind = 'PARTAGE' AND key LIKE 'partage:equipe:%' AND ent_has_role('DIRECTION', 'BUREAU', 'VIE_SCOLAIRE'));

-- Vérification : doit afficher 13 règles
SELECT count(*) AS regles FROM pg_policies WHERE tablename = 'ent_doc';
