import React, { useEffect, useState } from 'react';
import { supabase, ONLINE } from '../online/client.js';

// Direction : prévient quand une mise à jour du serveur (fichier SQL du dossier supabase) n'est pas installée.
// Depuis la mise à jour 15, le serveur dit lui-même lesquelles sont installées (ent_installed) ; avant, on
// devine à partir de quelques fonctions. Aucune écriture.
const UPDATES = [
  ['10', '10_supabase.sql', 'base de l\'ENT'], ['20', '20_comptes.sql', 'comptes'], ['30', '30_carnets.sql', 'carnets de notes'],
  ['40', '40_eleves.sql', 'portail des élèves'], ['50', '50_conseils.sql', 'conseils de classe'], ['60', '60_partage.sql', 'partage de l\'équipe'],
  ['70', '70_classes_communes.sql', 'classes communes'], ['80', '80_partage_professeurs.sql', 'rubriques des professeurs'],
  ['90', '90_sites.sql', 'deux sites (Tamatave / Tana)'], ['100', '100_connexion.sql', 'connexion protégée et numéros de reçus'],
  ['110', '110_connexion_3_essais.sql', 'connexion : essais limités'], ['120', '120_vie_scolaire_eleves.sql', 'vie scolaire dans le portail des élèves'],
  ['130', '130_droits_professeurs.sql', 'droits des professeurs resserrés'], ['140', '140_connexion_progressive.sql', 'blocage progressif de la connexion'],
  ['150', '150_suivi_mises_a_jour.sql', 'suivi des mises à jour'],
];
const missing = (e) => e && /PGRST202|Could not find the function|does not exist|404/i.test(`${e.code} ${e.message}`);
// avant la mise à jour 15 : quelques fonctions témoins
const LEGACY = [['90', () => supabase.rpc('ent_my_sites')], ['100', () => supabase.rpc('ent_login_check', { p_login: '', p_code: '' })],
  ['130', () => supabase.rpc('ent_prof_lines_ok', { o: null, n: null, me: '' })], ['140', () => supabase.rpc('ent_locked_logins')]];

export async function serverStatus() {
  const { data, error } = await supabase.rpc('ent_installed');
  if (!error && Array.isArray(data) && data.length) return { known: true, todo: UPDATES.filter(([n]) => !data.includes(n)) };
  const absent = await Promise.all(LEGACY.map(async ([n, call]) => { const { error: e } = await call(); return missing(e) ? n : null; }));
  return { known: false, todo: UPDATES.filter(([n]) => n === '150' || absent.includes(n)) };
}

export default function ServerUpdates() {
  const [todo, setTodo] = useState([]);
  useEffect(() => { if (ONLINE) serverStatus().then((r) => setTodo(r.todo), () => {}); }, []);
  if (!todo.length) return null;
  return (
    <div role="status" className="rounded-2xl bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200">
      <strong>Mise à jour du serveur à installer</strong> (Supabase › SQL Editor, une à la fois, dans cet ordre) :
      <ol className="mt-1 list-decimal pl-5">{todo.map(([n, f, w]) => <li key={n}><span className="font-mono text-xs">{f}</span> — {w}</li>)}</ol>
      <p className="mt-1 text-xs">Fichiers du dossier « supabase » du projet ; mode d'emploi dans LISEZMOI.</p>
    </div>
  );
}
