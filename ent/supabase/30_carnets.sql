-- =============================================================================
--  ENT Chateaubriand — Mise à jour 3 : carnets de notes en ligne (à lancer une fois dans SQL Editor)
--  1. « Envoi des classes » : la Direction publie la liste des élèves par classe et les services de chaque
--     professeur (matières × classes, repris des fiches des agents) ; le personnel la lit.
--  2. Carnet de chaque professeur : devoirs, notes, appréciations, compétences du bulletin. Le professeur lit
--     et écrit le sien ; la Direction et le secrétariat les lisent tous ; la vie scolaire ne voit pas les notes.
--  3. Historique : à chaque enregistrement, l'ancienne version est gardée (au plus une toutes les 10 minutes
--     par carnet), lisible par la Direction seule. Rien ne se perd, même en cas d'erreur de saisie.
-- =============================================================================

CREATE TABLE IF NOT EXISTS ent_doc (
  key        text PRIMARY KEY,                 -- 'roster' ou 'carnet:<id du professeur>'
  kind       text NOT NULL CHECK (kind IN ('ROSTER', 'CARNET')),
  owner      uuid REFERENCES app_user(id) ON DELETE SET NULL,
  value      jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
CREATE TABLE IF NOT EXISTS ent_doc_history (
  id       bigserial PRIMARY KEY,
  key      text NOT NULL,
  value    jsonb NOT NULL,
  saved_at timestamptz NOT NULL,
  saved_by uuid
);
CREATE INDEX IF NOT EXISTS ent_doc_history_key ON ent_doc_history (key, saved_at DESC);

ALTER TABLE ent_doc ENABLE ROW LEVEL SECURITY;
ALTER TABLE ent_doc_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ent_doc, ent_doc_history FROM anon;
GRANT SELECT, INSERT, UPDATE ON ent_doc TO authenticated;
GRANT SELECT ON ent_doc_history TO authenticated;
GRANT ALL ON ent_doc, ent_doc_history TO service_role;
GRANT USAGE, SELECT ON SEQUENCE ent_doc_history_id_seq TO service_role;

-- l'auteur et l'heure sont posés par le serveur (pas par l'appareil)
CREATE OR REPLACE FUNCTION ent_doc_stamp() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.updated_at := now(); NEW.updated_by := ent_me();
  IF TG_OP = 'UPDATE' AND OLD.value IS DISTINCT FROM NEW.value AND NOT EXISTS (
       SELECT 1 FROM ent_doc_history h WHERE h.key = OLD.key AND h.saved_at > now() - interval '10 minutes') THEN
    INSERT INTO ent_doc_history (key, value, saved_at, saved_by) VALUES (OLD.key, OLD.value, OLD.updated_at, OLD.updated_by);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS ent_doc_stamp ON ent_doc;
CREATE TRIGGER ent_doc_stamp BEFORE INSERT OR UPDATE ON ent_doc FOR EACH ROW EXECUTE FUNCTION ent_doc_stamp();

DROP POLICY IF EXISTS doc_roster_read ON ent_doc;
DROP POLICY IF EXISTS doc_carnet_read ON ent_doc;
DROP POLICY IF EXISTS doc_direction ON ent_doc;
DROP POLICY IF EXISTS doc_carnet_insert ON ent_doc;
DROP POLICY IF EXISTS doc_carnet_update ON ent_doc;
DROP POLICY IF EXISTS doc_history_read ON ent_doc_history;
CREATE POLICY doc_roster_read ON ent_doc FOR SELECT TO authenticated USING (kind = 'ROSTER' AND ent_is_staff());
CREATE POLICY doc_carnet_read ON ent_doc FOR SELECT TO authenticated USING (kind = 'CARNET' AND (owner = ent_me() OR ent_has_role('DIRECTION', 'BUREAU')));
CREATE POLICY doc_direction ON ent_doc FOR ALL TO authenticated USING (ent_has_role('DIRECTION')) WITH CHECK (ent_has_role('DIRECTION'));
CREATE POLICY doc_carnet_insert ON ent_doc FOR INSERT TO authenticated
  WITH CHECK (kind = 'CARNET' AND owner = ent_me() AND key = 'carnet:' || ent_me()::text);
CREATE POLICY doc_carnet_update ON ent_doc FOR UPDATE TO authenticated
  USING (kind = 'CARNET' AND owner = ent_me())
  WITH CHECK (kind = 'CARNET' AND owner = ent_me() AND key = 'carnet:' || ent_me()::text);
CREATE POLICY doc_history_read ON ent_doc_history FOR SELECT TO authenticated USING (ent_has_role('DIRECTION'));

-- Vérification : doit afficher « ent_doc » et « ent_doc_history »
SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'ent_doc%';
