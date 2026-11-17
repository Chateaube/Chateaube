-- =============================================================================
--  ENT Chateaubriand — Mise à jour 8 : rubriques ouvertes aux professeurs (à lancer une fois dans SQL Editor)
--  « partage:classe:… » : vie de classe (punitions, colles, passeport, objets confisqués, absences) et examens
--    blancs → Direction, secrétariat, vie scolaire ET professeurs (lecture et écriture). Jamais les soins ni la santé.
--  « partage:ecole:… »  : vie de l'école, annonces, ressources → lus par tout le personnel (professeurs compris),
--    écrits par la Direction, le secrétariat et la vie scolaire.
-- =============================================================================

DROP POLICY IF EXISTS doc_partage_classe ON ent_doc;
DROP POLICY IF EXISTS doc_partage_ecole_read ON ent_doc;
DROP POLICY IF EXISTS doc_partage_ecole_write ON ent_doc;
CREATE POLICY doc_partage_classe ON ent_doc FOR ALL TO authenticated
  USING (kind = 'PARTAGE' AND key LIKE 'partage:classe:%' AND ent_has_role('DIRECTION', 'BUREAU', 'VIE_SCOLAIRE', 'PROFESSEUR'))
  WITH CHECK (kind = 'PARTAGE' AND key LIKE 'partage:classe:%' AND ent_has_role('DIRECTION', 'BUREAU', 'VIE_SCOLAIRE', 'PROFESSEUR'));
CREATE POLICY doc_partage_ecole_read ON ent_doc FOR SELECT TO authenticated
  USING (kind = 'PARTAGE' AND key LIKE 'partage:ecole:%' AND ent_is_staff());
CREATE POLICY doc_partage_ecole_write ON ent_doc FOR ALL TO authenticated
  USING (kind = 'PARTAGE' AND key LIKE 'partage:ecole:%' AND ent_has_role('DIRECTION', 'BUREAU', 'VIE_SCOLAIRE'))
  WITH CHECK (kind = 'PARTAGE' AND key LIKE 'partage:ecole:%' AND ent_has_role('DIRECTION', 'BUREAU', 'VIE_SCOLAIRE'));

-- Vérification : doit afficher 19 règles
SELECT count(*) AS regles FROM pg_policies WHERE tablename = 'ent_doc';
