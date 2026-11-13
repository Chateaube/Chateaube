// Fonction « comptes » (Supabase Edge Function) : la Direction crée les comptes du personnel, remet un
// code provisoire, désactive ou réactive un compte. Elle tourne sur le serveur de Supabase avec la clé
// secrète (jamais dans l'application) et vérifie à chaque appel que la personne connectée est la Direction.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const ROLES = ['DIRECTION', 'BUREAU', 'VIE_SCOLAIRE', 'PROFESSEUR', 'ELEVE']; // ELEVE : comptes du portail élève (créés par la Direction)
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
const fold = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
// code provisoire lisible : sans 0/O, 1/l/I
const newCode = () => { const a = 'abcdefghjkmnpqrstuvwxyz23456789'; const r = crypto.getRandomValues(new Uint32Array(8)); let c = ''; r.forEach((n) => { c += a[n % a.length]; }); return /\d/.test(c) && /[a-z]/.test(c) ? c : newCode(); };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
    // qui appelle ?
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer /, '');
    const { data: { user } } = await admin.auth.getUser(token);
    if (!user) return reply({ error: 'Connexion requise.' }, 401);
    const { data: me } = await admin.from('app_user').select('id, user_role(role)').eq('auth_uid', user.id).eq('is_active', true).maybeSingle();
    if (!me?.user_role?.some((r: { role: string }) => r.role === 'DIRECTION')) return reply({ error: 'Réservé à la Direction.' }, 403);

    const body = await req.json();
    if (body.action === 'create') {
      const first = String(body.first ?? '').trim(); const last = String(body.last ?? '').trim().toUpperCase();
      const role = String(body.role ?? ''); const email = String(body.email ?? '').trim().toLowerCase();
      if (!first || !last || !ROLES.includes(role)) return reply({ error: 'Prénom, nom et fonction obligatoires.' }, 400);
      if (email && !/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(email)) return reply({ error: 'Adresse e-mail invalide.' }, 400);
      // identifiant (le même pour tous, voir rules/logins.js) : 2 premières lettres du nom, un point, le premier
      // prénom — « am.fatema » ; homonyme : une lettre du nom de plus (« amb.fatema »…), puis un chiffre
      // prénom d'usage (ex. « Fortuna ») s'il est donné, sinon le premier prénom
      const f = fold(String(body.usual ?? '').trim().split(/\s+/)[0] || first.split(/\s+/)[0]) || 'x'; const l = fold(last) || 'x';
      const { data: taken } = await admin.from('app_user').select('login').like('login', `%.${f}%`);
      const used = new Set((taken ?? []).map((t: { login: string }) => t.login));
      let login = '';
      for (let n = Math.min(2, l.length); n <= l.length && !login; n++) if (!used.has(`${l.slice(0, n)}.${f}`)) login = `${l.slice(0, n)}.${f}`;
      for (let i = 2; !login; i++) if (!used.has(`${l}.${f}${i}`)) login = `${l}.${f}${i}`;
      const code = newCode();
      const authEmail = email || `${login}@sans-email.ent-chateaubriand.invalid`;
      const created = await admin.auth.admin.createUser({ email: authEmail, password: code, email_confirm: true });
      if (created.error) return reply({ error: /already|registered|exists/i.test(created.error.message) ? 'Cette adresse e-mail a déjà un compte.' : 'Création impossible pour le moment.' }, 400);
      const { data: person, error } = await admin.from('app_user').insert({ email: authEmail, first_name: first, last_name: last, auth_provider: 'PASSWORD', auth_uid: created.data.user.id, login, must_change_code: true }).select('id').single();
      if (error) { await admin.auth.admin.deleteUser(created.data.user.id); return reply({ error: 'Création impossible : cette personne existe peut-être déjà.' }, 400); }
      await admin.from('user_role').insert({ user_id: person.id, role, title: body.title || null });
      return reply({ id: person.id, login, code });
    }
    if (body.action === 'reset' || body.action === 'active') {
      const { data: target } = await admin.from('app_user').select('id, auth_uid, login').eq('id', body.userId).maybeSingle();
      if (!target?.auth_uid) return reply({ error: 'Compte introuvable.' }, 404);
      if (body.action === 'reset') {
        const code = newCode();
        const r = await admin.auth.admin.updateUserById(target.auth_uid, { password: code });
        if (r.error) return reply({ error: 'Le code n\'a pas pu être remis.' }, 400);
        await admin.from('app_user').update({ must_change_code: true }).eq('id', target.id);
        return reply({ login: target.login, code });
      }
      if (target.id === me.id && !body.active) return reply({ error: 'Vous ne pouvez pas désactiver votre propre compte.' }, 400);
      await admin.auth.admin.updateUserById(target.auth_uid, { ban_duration: body.active ? 'none' : '876000h' });
      await admin.from('app_user').update({ is_active: Boolean(body.active) }).eq('id', target.id);
      return reply({ ok: true });
    }
    return reply({ error: 'Action inconnue.' }, 400);
  } catch (_e) {
    return reply({ error: 'Erreur du serveur. Réessayez.' }, 500);
  }
});
