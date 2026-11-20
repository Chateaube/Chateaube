-- =============================================================================
--  ENT Chateaubriand — Mise à jour 10 : connexion sans exposer les adresses e-mail (à lancer une fois)
--  Avant : la page de connexion donnait l'e-mail d'un compte à quiconque tapait son identifiant.
--  Maintenant : l'e-mail n'est renvoyé que si le code est juste, et 5 essais ratés en 15 minutes
--  bloquent cet identifiant pendant 15 minutes. « Code oublié » passe par la fonction des comptes.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS ent_login_fail (
  login text NOT NULL,
  at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ent_login_fail_login_at ON ent_login_fail (login, at);
ALTER TABLE ent_login_fail ENABLE ROW LEVEL SECURITY; -- aucune règle : personne ne la lit depuis l'application

CREATE OR REPLACE FUNCTION ent_login_check(p_login text, p_code text) RETURNS text
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE l text := lower(trim(coalesce(p_login, ''))); mail text;
BEGIN
  IF l = '' OR coalesce(p_code, '') = '' THEN RETURN NULL; END IF;
  -- trop d'essais récents : on ne vérifie même pas
  IF (SELECT count(*) FROM ent_login_fail WHERE login = l AND at > now() - interval '15 minutes') >= 5 THEN
    RAISE EXCEPTION 'TROP_ESSAIS';
  END IF;
  SELECT u.email::text INTO mail FROM app_user u JOIN auth.users a ON a.id = u.auth_uid
   WHERE u.login = l::citext AND u.is_active AND a.encrypted_password = crypt(p_code, a.encrypted_password);
  IF mail IS NULL THEN
    INSERT INTO ent_login_fail (login) VALUES (l);
    DELETE FROM ent_login_fail WHERE at < now() - interval '1 day';
  ELSE
    DELETE FROM ent_login_fail WHERE login = l;
  END IF;
  RETURN mail;
END $$;
REVOKE ALL ON FUNCTION ent_login_check(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ent_login_check(text, text) TO anon, authenticated;

-- L'ancienne fonction (identifiant → e-mail, sans code) n'est plus accessible depuis l'application
REVOKE ALL ON FUNCTION ent_login_email(text) FROM PUBLIC, anon, authenticated;

-- =============================================================================
--  Numéros de reçus attribués par le serveur : deux postes qui encaissent en même temps n'obtiennent jamais
--  le même numéro. Une série par journal et par site (ECO-TMV, ANX-TMV, EXA-TMV, ECO-TNR…).
-- =============================================================================
CREATE TABLE IF NOT EXISTS ent_counter (
  series text PRIMARY KEY,
  n      integer NOT NULL DEFAULT 0
);
ALTER TABLE ent_counter ENABLE ROW LEVEL SECURITY; -- lu et écrit seulement par la fonction ci-dessous

-- p_floor : dernier numéro connu sur le poste (reçus déjà émis avant cette mise à jour) : jamais en dessous
CREATE OR REPLACE FUNCTION ent_next_receipt(p_series text, p_floor integer DEFAULT 0) RETURNS integer
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE site text; v_next integer;
BEGIN
  IF p_series !~ '^(ECO|ANX|EXA)-(TMV|TNR)$' THEN RAISE EXCEPTION 'SERIE_INCONNUE'; END IF;
  site := CASE WHEN p_series LIKE '%-TNR' THEN 'TANA' ELSE 'TMV' END;
  IF NOT ent_has_role_at(site, 'DIRECTION', 'BUREAU') THEN RAISE EXCEPTION 'REFUSE'; END IF;
  INSERT INTO ent_counter (series, n) VALUES (p_series, greatest(coalesce(p_floor, 0), 0) + 1)
  ON CONFLICT (series) DO UPDATE SET n = greatest(ent_counter.n, coalesce(p_floor, 0)) + 1
  RETURNING n INTO v_next;
  RETURN v_next;
END $$;
REVOKE ALL ON FUNCTION ent_next_receipt(text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION ent_next_receipt(text, integer) TO authenticated;

-- Vérification : doit afficher « ok »
SELECT CASE WHEN has_function_privilege('anon', 'ent_login_email(text)', 'EXECUTE') THEN 'à revoir' ELSE 'ok' END AS connexion;
