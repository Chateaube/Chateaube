import React, { useEffect, useState } from 'react';
import { Badge, Button, Card } from './ui.jsx';
import { supabase, FN_COMPTES } from '../online/client.js';
import { printOnly } from '../print.js';
import { askConfirm } from './Dialogs.jsx';

// Comptes du personnel (Direction, version en ligne) : création avec un identifiant et un code provisoire à
// remettre en main propre (la personne choisit son propre code à la première connexion), nouveau code en cas
// d'oubli sans e-mail, désactivation d'un compte (départ). Les familles viendront avec le portail en ligne.
const ROLES = [['PROFESSEUR', 'Professeur'], ['VIE_SCOLAIRE', 'CPE / vie scolaire'], ['BUREAU', 'Secrétariat'], ['DIRECTION', 'Direction']];
const LABEL = Object.fromEntries(ROLES);
const field = 'mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm';
const call = async (body) => {
  const { data, error } = await supabase.functions.invoke(FN_COMPTES, { body });
  if (error) { let msg = 'Le serveur ne répond pas. Vérifiez que la fonction des comptes est installée dans Supabase.'; try { msg = (await error.context.json()).error ?? msg; } catch { /* réponse illisible */ } throw new Error(msg); }
  return data;
};

function Slip({ slip, onClose }) {
  const url = window.location.href.split('#')[0];
  return (
    <Card title="Fiche à remettre en main propre" subtitle="Le code est provisoire : la personne choisit le sien à la première connexion">
      <div className="account-slip rounded-xl border-2 border-dashed border-slate-300 p-4 text-sm">
        <p className="font-semibold text-navy-900">ENT Chateaubriand — vos accès</p>
        <p className="mt-2">{slip.name}</p>
        <p className="mt-2">Adresse : <strong>{url}</strong></p>
        <p>Identifiant : <strong className="font-mono text-base">{slip.login}</strong></p>
        <p>Code provisoire : <strong className="font-mono text-base">{slip.code}</strong></p>
        <p className="mt-2 text-xs text-slate-600">À la première connexion, choisissez votre propre code (8 caractères, lettres et chiffres). Ne le communiquez à personne.</p>
      </div>
      <div className="mt-3 flex gap-2">
        <Button onClick={() => printOnly('.account-slip', 'size: A5 landscape; margin: 12mm;', `Accès ENT — ${slip.name}`)}>Imprimer</Button>
        <Button variant="secondary" onClick={onClose}>Fermer</Button>
      </div>
    </Card>
  );
}

export default function AccountsModule({ embedded = false }) {
  const [list, setList] = useState(null); const [err, setErr] = useState('');
  const [d, setD] = useState({ first: '', last: '', role: 'PROFESSEUR', email: '' });
  const [busy, setBusy] = useState(false); const [slip, setSlip] = useState(null);
  const load = async () => {
    const { data, error } = await supabase.from('app_user').select('id, first_name, last_name, login, email, is_active, last_login_at, must_change_code, user_role(role, title)').order('last_name');
    if (error) setErr('La liste des comptes n\'a pas pu être chargée.'); else setList(data);
  };
  useEffect(() => { load(); }, []);
  const run = async (fn) => { setBusy(true); setErr(''); try { await fn(); await load(); } catch (x) { setErr(x.message); } setBusy(false); };
  const ok = d.first.trim() && d.last.trim();
  return (
    <div className="space-y-5">
      {embedded ? <p className="text-sm text-slate-600">Chaque personne reçoit un identifiant et un code provisoire. L'e-mail sert seulement en cas de code oublié.</p> : <div>
        <p className="text-sm font-semibold text-navy-500">Version en ligne</p>
        <h1 className="text-2xl font-semibold text-navy-900">Comptes du personnel</h1>
        <p className="text-sm text-slate-600">Chaque personne reçoit un identifiant et un code provisoire. L'e-mail sert seulement en cas de code oublié.</p>
      </div>}
      {err && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">{err}</p>}
      {slip && <Slip slip={slip} onClose={() => setSlip(null)} />}
      <Card title="Nouveau compte">
        <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); if (!ok) return; run(async () => { const r = await call({ action: 'create', ...d }); setSlip({ ...r, name: `${d.first.trim()} ${d.last.trim().toUpperCase()}` }); setD({ first: '', last: '', role: d.role, email: '' }); }); }}>
          <label className="text-xs font-medium text-slate-600">Prénom<input value={d.first} onChange={(e) => setD({ ...d, first: e.target.value })} className={field} /></label>
          <label className="text-xs font-medium text-slate-600">Nom<input value={d.last} onChange={(e) => setD({ ...d, last: e.target.value })} className={field} /></label>
          <label className="text-xs font-medium text-slate-600">Fonction<select value={d.role} onChange={(e) => setD({ ...d, role: e.target.value })} className={field}>{ROLES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          <label className="text-xs font-medium text-slate-600">E-mail (facultatif, pour le code oublié)<input type="email" value={d.email} onChange={(e) => setD({ ...d, email: e.target.value })} className={field} /></label>
          <div className="sm:col-span-2"><Button type="submit" disabled={!ok || busy}>{busy ? 'Création…' : 'Créer le compte'}</Button></div>
        </form>
      </Card>
      <Card title={`Comptes (${list?.length ?? '…'})`}>
        {!list ? <p className="text-sm text-slate-500">Chargement…</p> : (
          <ul className="divide-y divide-slate-100">
            {list.map((u) => (
              <li key={u.id} className={`flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm ${u.is_active ? '' : 'opacity-60'}`}>
                <div className="min-w-0">
                  <p className="font-medium text-slate-900">{u.last_name} {u.first_name} <span className="font-mono text-xs font-normal text-slate-500">· {u.login}</span></p>
                  <p className="text-xs text-slate-600">{(u.user_role ?? []).map((r) => r.title || LABEL[r.role] || r.role).join(', ')}{/\.invalid$/.test(u.email) ? ' · sans e-mail' : ''} · {u.last_login_at ? `dernière connexion le ${new Date(u.last_login_at).toLocaleDateString('fr-FR')}` : 'jamais connecté·e'}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {u.must_change_code && u.is_active && <Badge tone="amber">code provisoire</Badge>}
                  {!u.is_active && <Badge tone="slate">désactivé</Badge>}
                  <Button variant="secondary" className="!py-1 text-xs" disabled={busy || !u.is_active} onClick={() => run(async () => { const r = await call({ action: 'reset', userId: u.id }); setSlip({ ...r, name: `${u.first_name} ${u.last_name}` }); })}>Nouveau code</Button>
                  <Button variant="ghost" className="!py-1 text-xs" disabled={busy} onClick={async () => { if (u.is_active && !(await askConfirm(`Désactiver le compte de ${u.first_name} ${u.last_name} ? La personne ne pourra plus se connecter ; ses saisies restent.`))) return; run(() => call({ action: 'active', userId: u.id, active: !u.is_active })); }}>{u.is_active ? 'Désactiver' : 'Réactiver'}</Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
