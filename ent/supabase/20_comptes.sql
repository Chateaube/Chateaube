-- =============================================================================
--  Mise à jour 1 — comptes : changement de code à la première connexion, liste des comptes (Direction)
-- =============================================================================
-- La personne connectée a choisi son propre code : on ne lui demande plus d'en changer.
CREATE OR REPLACE FUNCTION ent_code_changed() RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE app_user SET must_change_code = false, last_login_at = now() WHERE id = ent_me()
$$;
REVOKE ALL ON FUNCTION ent_code_changed() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION ent_code_changed() TO authenticated;

-- Dernière connexion (affichée dans la liste des comptes)
CREATE OR REPLACE FUNCTION ent_seen() RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE app_user SET last_login_at = now() WHERE id = ent_me()
$$;
REVOKE ALL ON FUNCTION ent_seen() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION ent_seen() TO authenticated;
