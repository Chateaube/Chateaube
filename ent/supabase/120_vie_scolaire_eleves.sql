-- =============================================================================
--  ENT Chateaubriand — Mise à jour 12 : vie scolaire dans le portail des élèves (à lancer une fois)
--  La fiche de chaque élève (« eleve:<id> », lue par lui seul et le personnel) porte aussi sa vie scolaire :
--  absences, retards, oublis, punitions, colles, objets confisqués. Le secrétariat et la vie scolaire de
--  Tamatave peuvent la mettre à jour (avant : la Direction seule), pour qu'elle suive même sans la Direction.
-- =============================================================================
DROP POLICY IF EXISTS doc_eleve_staff_update ON ent_doc;
CREATE POLICY doc_eleve_staff_update ON ent_doc FOR UPDATE TO authenticated
  USING (kind = 'ELEVE' AND ent_has_role('BUREAU', 'VIE_SCOLAIRE'))
  WITH CHECK (kind = 'ELEVE' AND ent_has_role('BUREAU', 'VIE_SCOLAIRE'));

-- Vérification : 22 règles
SELECT count(*) AS regles FROM pg_policies WHERE tablename = 'ent_doc';
