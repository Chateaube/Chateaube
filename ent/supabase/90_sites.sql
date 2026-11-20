-- =============================================================================
--  ENT Chateaubriand — Mise à jour 9 : deux sites, Tamatave et Tana (à lancer une fois dans SQL Editor)
--  - La Direction (Mme Ratsimbazafy, Mme Lo) : les deux sites, comme aujourd'hui (rien ne change pour elle).
--  - Tous les autres comptes existants (secrétariat, vie scolaire, professeurs, élèves) : Tamatave seulement.
--  - Tana : l'Économe (compte « secrétariat » de Tana : caisse, dépenses, salaires, inscriptions) et le BVS
--    (compte « vie scolaire » de Tana). Ils ne voient QUE Tana ; Tamatave ne voit jamais Tana.
--  - Les données partagées de Tana sont rangées à part : « partage:TANA:… ».
-- =============================================================================

-- Les deux sites (déjà créés par installation.sql ; sans effet s'ils existent)
INSERT INTO site (code, name) VALUES ('TMV', 'Tamatave'), ('TANA', 'Tananarive') ON CONFLICT DO NOTHING;

-- Rôle sur un site donné (un rôle sans site = les deux sites : la Direction)
CREATE OR REPLACE FUNCTION ent_has_role_at(p_site text, VARIADIC roles role_code[]) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM user_role ur LEFT JOIN site s ON s.id = ur.site_id
                 WHERE ur.user_id = ent_me() AND ur.role = ANY (roles) AND (ur.site_id IS NULL OR s.code = p_site))
$$;
REVOKE ALL ON FUNCTION ent_has_role_at(text, role_code[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION ent_has_role_at(text, role_code[]) TO authenticated;

-- Toutes les règles déjà en place (élèves, notes, carnets, partage…) concernent Tamatave : un compte de Tana
-- n'y a donc aucun accès, sans rien réécrire.
CREATE OR REPLACE FUNCTION ent_has_role(VARIADIC roles role_code[]) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT ent_has_role_at('TMV', VARIADIC roles)
$$;

-- Sites de la personne connectée (l'application s'en sert pour le sélecteur et l'espace de travail)
CREATE OR REPLACE FUNCTION ent_my_sites() RETURNS text[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN EXISTS (SELECT 1 FROM user_role WHERE user_id = ent_me() AND site_id IS NULL) THEN ARRAY['TMV', 'TANA']
    ELSE coalesce((SELECT array_agg(DISTINCT s.code) FROM user_role ur JOIN site s ON s.id = ur.site_id WHERE ur.user_id = ent_me()), ARRAY[]::text[]) END
$$;
REVOKE ALL ON FUNCTION ent_my_sites() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION ent_my_sites() TO authenticated;

-- Les comptes existants hors Direction : Tamatave
UPDATE user_role SET site_id = (SELECT id FROM site WHERE code = 'TMV') WHERE site_id IS NULL AND role <> 'DIRECTION';

-- Un nouveau compte hors Direction est de Tamatave, sauf si la Direction le place à Tana
CREATE OR REPLACE FUNCTION ent_role_site_default() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.site_id IS NULL AND NEW.role <> 'DIRECTION' THEN NEW.site_id := (SELECT id FROM site WHERE code = 'TMV'); END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS user_role_site_default ON user_role;
CREATE TRIGGER user_role_site_default BEFORE INSERT OR UPDATE ON user_role FOR EACH ROW EXECUTE FUNCTION ent_role_site_default();

-- Données partagées de Tana : mêmes groupes qu'à Tamatave, réservés aux comptes de Tana et à la Direction
DROP POLICY IF EXISTS doc_tana_gestion ON ent_doc;
DROP POLICY IF EXISTS doc_tana_equipe ON ent_doc;
CREATE POLICY doc_tana_gestion ON ent_doc FOR ALL TO authenticated
  USING (kind = 'PARTAGE' AND key LIKE 'partage:TANA:gestion:%' AND ent_has_role_at('TANA', 'DIRECTION', 'BUREAU'))
  WITH CHECK (kind = 'PARTAGE' AND key LIKE 'partage:TANA:gestion:%' AND ent_has_role_at('TANA', 'DIRECTION', 'BUREAU'));
CREATE POLICY doc_tana_equipe ON ent_doc FOR ALL TO authenticated
  USING (kind = 'PARTAGE' AND key LIKE 'partage:TANA:%' AND key NOT LIKE 'partage:TANA:gestion:%' AND ent_has_role_at('TANA', 'DIRECTION', 'BUREAU', 'VIE_SCOLAIRE'))
  WITH CHECK (kind = 'PARTAGE' AND key LIKE 'partage:TANA:%' AND key NOT LIKE 'partage:TANA:gestion:%' AND ent_has_role_at('TANA', 'DIRECTION', 'BUREAU', 'VIE_SCOLAIRE'));

-- Vérification : 21 règles ; la Direction a les deux sites
SELECT count(*) AS regles FROM pg_policies WHERE tablename = 'ent_doc';
