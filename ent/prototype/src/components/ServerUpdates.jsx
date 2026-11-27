import React, { useEffect, useState } from 'react';
import { supabase, ONLINE } from '../online/client.js';

// Direction : prévient quand une mise à jour du serveur (fichier SQL du dossier supabase) n'a pas été installée.
// On interroge seulement des fonctions sans effet (aucune écriture), une fois par ouverture de l'accueil.
const missing = (e) => e && /PGRST202|Could not find the function|does not exist|404/i.test(`${e.code} ${e.message}`);
const CHECKS = [
  ['90_sites.sql', 'deux sites (Tamatave / Tana)', () => supabase.rpc('ent_my_sites')],
  ['100_connexion.sql', 'connexion protégée et numéros de reçus', () => supabase.rpc('ent_login_check', { p_login: '', p_code: '' })],
  ['130_droits_professeurs.sql', 'droits des professeurs resserrés', () => supabase.rpc('ent_prof_lines_ok', { o: null, n: null, me: '' })],
  ['140_connexion_progressive.sql', 'blocage progressif de la connexion', () => supabase.rpc('ent_locked_logins')],
];

export default function ServerUpdates() {
  const [todo, setTodo] = useState([]);
  useEffect(() => {
    if (!ONLINE) return;
    Promise.all(CHECKS.map(async ([file, what, call]) => { const { error } = await call(); return missing(error) ? [file, what] : null; }))
      .then((r) => setTodo(r.filter(Boolean)), () => {});
  }, []);
  if (!todo.length) return null;
  return (
    <p role="status" className="rounded-2xl bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200">
      <strong>Mise à jour du serveur à installer</strong> (Supabase › SQL Editor, dans cet ordre) : {todo.map(([f, w]) => `${f} (${w})`).join(', ')}. Voir LISEZMOI (dossier supabase).
    </p>
  );
}
