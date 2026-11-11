// Mode en ligne : la version installable est reliée au projet Supabase de l'école (voir .env.app).
// Le prototype de démonstration (claude.ai) n'a pas ces réglages et reste hors ligne, avec ses exemples.
import { createClient } from '@supabase/supabase-js';

const ENV = import.meta.env ?? {}; // absent hors de Vite (tests sous Node)
const URL = ENV.VITE_SUPABASE_URL;
const KEY = ENV.VITE_SUPABASE_KEY;
export const ONLINE = Boolean(URL && KEY);
// nom de la fonction serveur des comptes dans Supabase (« comptes » par défaut)
export const FN_COMPTES = ENV.VITE_FN_COMPTES || 'comptes';
export const supabase = ONLINE ? createClient(URL, KEY, { auth: { persistSession: true, storageKey: 'ent-auth', detectSessionInUrl: true } }) : null;

// rôle de la base → profil de l'application
const PROFILE_OF = { DIRECTION: 'DIRECTION', BUREAU: 'BUREAU', VIE_SCOLAIRE: 'VIE_SCOLAIRE', PROFESSEUR: 'ENSEIGNANT', PARENT: 'PARENT', ELEVE: 'ELEVE' };
const RANK = ['DIRECTION', 'BUREAU', 'VIE_SCOLAIRE', 'PROFESSEUR', 'PARENT', 'ELEVE'];

/** Connexion par identifiant + code ; message unique en cas d'échec (on ne dit pas lequel des deux est faux). */
export async function signIn(login, code) {
  const fail = new Error('Identifiant ou code incorrect.');
  const { data: email, error } = await supabase.rpc('ent_login_email', { p_login: login.trim().toLowerCase() });
  if (error) throw new Error('Connexion impossible pour le moment. Vérifiez internet et réessayez.');
  if (!email) throw fail;
  const res = await supabase.auth.signInWithPassword({ email, password: code });
  if (res.error) throw fail;
}

/** « Code oublié » : lien envoyé à l'adresse du compte (même réponse si l'identifiant est inconnu). */
export async function forgotCode(login) {
  const { data: email } = await supabase.rpc('ent_login_email', { p_login: login.trim().toLowerCase() });
  if (email && !/\.invalid$/.test(email)) await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.href.split('#')[0] });
}

/** La personne connectée : identité, rôle principal, code à changer ? */
export async function loadAccount() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase.from('app_user').select('id, first_name, last_name, login, must_change_code, user_role(role, title)').eq('auth_uid', user.id).maybeSingle();
  if (error) return { failed: true, message: error.message }; // base injoignable ou refus : ce n'est pas un compte incomplet
  if (!data) return { orphan: true, email: user.email };
  const roles = (data.user_role ?? []).map((r) => r.role).sort((a, b) => RANK.indexOf(a) - RANK.indexOf(b));
  return {
    id: data.id, login: data.login, name: `${data.first_name} ${data.last_name}`.trim(), mustChange: data.must_change_code,
    role: roles[0] ?? null, profile: PROFILE_OF[roles[0]] ?? null, title: data.user_role?.find((r) => r.role === roles[0])?.title ?? null,
  };
}

/** Nouveau code (première connexion ou lien « code oublié »). */
export async function setCode(code) {
  const { error } = await supabase.auth.updateUser({ password: code });
  if (error) throw new Error(/weak|short|least/i.test(error.message) ? 'Code trop simple : au moins 8 caractères, avec des lettres et des chiffres.' : 'Le code n\'a pas pu être changé. Réessayez.');
  await supabase.rpc('ent_code_changed');
}

export const signOut = () => supabase.auth.signOut();

/** Règle du code : 8 caractères au moins, lettres et chiffres. */
export const codeErrors = (code, again) => [
  ...(code.length < 8 ? ['Au moins 8 caractères.'] : []),
  ...(!/[A-Za-z]/.test(code) || !/\d/.test(code) ? ['Des lettres et des chiffres.'] : []),
  ...(again !== undefined && code !== again ? ['Les deux saisies ne sont pas identiques.'] : []),
];
