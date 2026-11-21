-- =============================================================================
--  ENT Chateaubriand — Mise à jour 11 : connexion, correctif (à lancer une fois, après 100_connexion.sql)
--  - 3 codes faux en 15 minutes bloquent l'identifiant pendant 15 minutes (au lieu de 5) ;
--  - la vérification ne plante plus sur un compte sans code classique (ancien compte, lien e-mail) :
--    avant, l'erreur donnait « Connexion impossible » et l'essai raté n'était pas compté.
-- =============================================================================

CREATE OR REPLACE FUNCTION ent_login_check(p_login text, p_code text) RETURNS text
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE l text := lower(trim(coalesce(p_login, ''))); v_mail text; v_hash text; ok boolean := false;
BEGIN
  IF l = '' OR coalesce(p_code, '') = '' THEN RETURN NULL; END IF;
  IF (SELECT count(*) FROM ent_login_fail WHERE login = l AND at > now() - interval '15 minutes') >= 3 THEN
    RAISE EXCEPTION 'TROP_ESSAIS';
  END IF;
  -- le compte d'abord (identifiant exact, actif), puis le code, seulement si un code classique existe
  SELECT u.email::text, a.encrypted_password INTO v_mail, v_hash
    FROM app_user u JOIN auth.users a ON a.id = u.auth_uid
   WHERE lower(u.login::text) = l AND u.is_active
   LIMIT 1;
  IF v_hash LIKE '$2%' THEN ok := (extensions.crypt(p_code, v_hash) = v_hash); END IF;
  IF NOT ok THEN
    INSERT INTO ent_login_fail (login) VALUES (l);
    DELETE FROM ent_login_fail WHERE at < now() - interval '1 day';
    -- 3e essai raté : on le dit tout de suite
    IF (SELECT count(*) FROM ent_login_fail WHERE login = l AND at > now() - interval '15 minutes') >= 3 THEN
      RETURN 'TROP_ESSAIS';
    END IF;
    RETURN NULL;
  END IF;
  DELETE FROM ent_login_fail WHERE login = l;
  RETURN v_mail;
END $$;
REVOKE ALL ON FUNCTION ent_login_check(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ent_login_check(text, text) TO anon, authenticated;

-- Vérification : doit afficher « ok » (un identifiant inexistant est simplement refusé, sans erreur)
SELECT CASE WHEN ent_login_check('verification-installation', 'x') IS NULL THEN 'ok' ELSE 'à revoir' END AS connexion;
DELETE FROM ent_login_fail WHERE login = 'verification-installation';
