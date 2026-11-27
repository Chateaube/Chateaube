-- =============================================================================
--  ENT Chateaubriand — Mise à jour 14 : blocage progressif de la connexion (à lancer une fois, après 130)
--  Codes faux sur un même identifiant (comptés sur la dernière heure) :
--    3 → bloqué 1 minute ; 4 → bloqué 5 minutes ;
--    5 → BLOQUÉ jusqu'à ce que la Direction donne un nouveau code (bouton « Nouveau code » des comptes) ;
--        comptes de la Direction : 15 minutes seulement (sinon personne ne pourrait les débloquer).
--  Un bon code efface le compteur. Ne modifie ni n'efface aucune donnée de l'école.
-- =============================================================================

CREATE TABLE IF NOT EXISTS ent_login_lock (login text PRIMARY KEY, at timestamptz NOT NULL DEFAULT now());
ALTER TABLE ent_login_lock ENABLE ROW LEVEL SECURITY; -- aucune règle : lu seulement par les fonctions ci-dessous

-- minutes de blocage qui restent (0 : libre ; -1 : bloqué jusqu'au nouveau code de la Direction)
CREATE OR REPLACE FUNCTION ent_login_wait(l text) RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN EXISTS (SELECT 1 FROM ent_login_lock WHERE login = l) THEN -1 ELSE (
    WITH f AS (SELECT count(*) AS n, max(at) AS last FROM ent_login_fail WHERE login = l AND at > now() - interval '1 hour')
    SELECT CASE WHEN n < 3 THEN 0 ELSE greatest(0, ceil(extract(epoch FROM
      (last + CASE WHEN n >= 5 THEN interval '15 minutes' WHEN n = 4 THEN interval '5 minutes' ELSE interval '1 minute' END) - now()) / 60))::integer END FROM f) END
$$;
REVOKE ALL ON FUNCTION ent_login_wait(text) FROM PUBLIC;

CREATE OR REPLACE FUNCTION ent_login_check(p_login text, p_code text) RETURNS text
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE l text := lower(trim(coalesce(p_login, ''))); v_mail text; v_hash text; v_id uuid; ok boolean := false; w integer;
BEGIN
  IF l = '' OR coalesce(p_code, '') = '' THEN RETURN NULL; END IF;
  w := ent_login_wait(l);
  IF w = -1 THEN RAISE EXCEPTION 'BLOQUE'; END IF;
  IF w > 0 THEN RAISE EXCEPTION 'TROP_ESSAIS %', w; END IF;
  -- le compte d'abord (identifiant exact, actif), puis le code, seulement si un code classique existe
  SELECT u.email::text, a.encrypted_password, u.id INTO v_mail, v_hash, v_id
    FROM app_user u JOIN auth.users a ON a.id = u.auth_uid
   WHERE lower(u.login::text) = l AND u.is_active
   LIMIT 1;
  IF v_hash LIKE '$2%' THEN ok := (extensions.crypt(p_code, v_hash) = v_hash); END IF;
  IF NOT ok THEN
    INSERT INTO ent_login_fail (login) VALUES (l);
    DELETE FROM ent_login_fail WHERE at < now() - interval '1 day';
    -- 5e code faux : bloqué jusqu'au nouveau code (identifiant qui existe, hors Direction)
    IF v_mail IS NOT NULL AND NOT EXISTS (SELECT 1 FROM user_role WHERE user_id = v_id AND role = 'DIRECTION')
       AND (SELECT count(*) FROM ent_login_fail WHERE login = l AND at > now() - interval '1 hour') >= 5 THEN
      INSERT INTO ent_login_lock (login) VALUES (l) ON CONFLICT DO NOTHING;
      RETURN 'BLOQUE';
    END IF;
    w := ent_login_wait(l);
    IF w > 0 THEN RETURN 'TROP_ESSAIS ' || w; END IF; -- on le dit tout de suite
    RETURN NULL;
  END IF;
  DELETE FROM ent_login_fail WHERE login = l;
  RETURN v_mail;
END $$;
REVOKE ALL ON FUNCTION ent_login_check(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ent_login_check(text, text) TO anon, authenticated;

-- nouveau code donné par la Direction (le compte doit changer son code) : l'identifiant est débloqué
CREATE OR REPLACE FUNCTION ent_login_unlock() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.must_change_code THEN
    DELETE FROM ent_login_lock WHERE login = lower(NEW.login::text);
    DELETE FROM ent_login_fail WHERE login = lower(NEW.login::text);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS ent_login_unlock ON app_user;
CREATE TRIGGER ent_login_unlock AFTER UPDATE OF must_change_code ON app_user FOR EACH ROW EXECUTE FUNCTION ent_login_unlock();

-- Direction : identifiants bloqués (pour l'écran des comptes)
CREATE OR REPLACE FUNCTION ent_locked_logins() RETURNS text[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN ent_has_role('DIRECTION') THEN coalesce(array_agg(login), '{}') ELSE '{}' END FROM ent_login_lock
$$;
REVOKE ALL ON FUNCTION ent_locked_logins() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ent_locked_logins() TO authenticated;

-- Vérification : doit afficher « ok »
SELECT CASE WHEN ent_login_check('verification-installation', 'x') IS NULL AND ent_login_wait('verification-installation') = 0 THEN 'ok' ELSE 'à revoir' END AS connexion;
DELETE FROM ent_login_fail WHERE login = 'verification-installation';
