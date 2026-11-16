-- =============================================================================
--  ENT Chateaubriand — Mise à jour 7 : classes en commun (à lancer une fois dans SQL Editor)
--  « prise:<id du professeur> » : les classes en commun dont un professeur a commencé la saisie (notes, ou
--  appréciation de l'Enseignement scientifique). Chaque professeur écrit la sienne ; tout le personnel la lit,
--  pour que la classe soit masquée chez l'autre professeur. Aucune note ni appréciation n'y figure.
-- =============================================================================

ALTER TABLE ent_doc DROP CONSTRAINT IF EXISTS ent_doc_kind_check;
ALTER TABLE ent_doc ADD CONSTRAINT ent_doc_kind_check CHECK (kind IN ('ROSTER', 'CARNET', 'ECOLE', 'ELEVE', 'ORIENTATION', 'CONSEIL', 'PARTAGE', 'PRISE'));

DROP POLICY IF EXISTS doc_prise_read ON ent_doc;
DROP POLICY IF EXISTS doc_prise_insert ON ent_doc;
DROP POLICY IF EXISTS doc_prise_update ON ent_doc;
CREATE POLICY doc_prise_read ON ent_doc FOR SELECT TO authenticated USING (kind = 'PRISE' AND ent_is_staff());
CREATE POLICY doc_prise_insert ON ent_doc FOR INSERT TO authenticated
  WITH CHECK (kind = 'PRISE' AND owner = ent_me() AND key = 'prise:' || ent_me()::text);
CREATE POLICY doc_prise_update ON ent_doc FOR UPDATE TO authenticated
  USING (kind = 'PRISE' AND owner = ent_me())
  WITH CHECK (kind = 'PRISE' AND owner = ent_me() AND key = 'prise:' || ent_me()::text);

-- Vérification : doit afficher 16 règles
SELECT count(*) AS regles FROM pg_policies WHERE tablename = 'ent_doc';
