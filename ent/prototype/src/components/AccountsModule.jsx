import React, { useEffect, useState } from 'react';
import { Badge, Button, Card } from './ui.jsx';
import { supabase, FN_COMPTES } from '../online/client.js';
import { printOnly } from '../print.js';
import { askConfirm } from './Dialogs.jsx';
import { usePersistent } from '../persist.js';
import AgentForm, { EMPTY_AGENT, serviceText } from './AgentForm.jsx';
import { StaffDocumentsButtons } from './StaffDocuments.jsx';
import BulkTeachers from './BulkTeachers.jsx';
import { schoolYearOf } from '../rules/documents.js';
import { today } from '../clock.js';

const fr = (iso) => (iso ? iso.split('-').reverse().join('/') : '');

// Comptes du personnel (Direction, version en ligne) : création avec un identifiant et un code provisoire à
// remettre en main propre (la personne choisit son propre code à la première connexion), nouveau code en cas
// d'oubli sans e-mail, désactivation d'un compte (départ). Les familles viendront avec le portail en ligne.
const ROLES = [['PROFESSEUR', 'Professeur'], ['VIE_SCOLAIRE', 'CPE / vie scolaire'], ['BUREAU', 'Secrétariat / économat'], ['DIRECTION', 'Direction']];
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

export default function AccountsModule({ embedded = false, settings }) {
  const [list, setList] = useState(null); const [err, setErr] = useState('');
  const [d, setD] = useState(null); // nouvel agent : fiche complète
  const [busy, setBusy] = useState(false); const [slip, setSlip] = useState(null);
  // fiche de chaque agent (contrat, identité, enseignements, taux) : sur l'appareil de la Direction
  const [fiches, setFiches] = usePersistent('ent-s-fiches-agents', {});
  const [edit, setEdit] = useState(null); // { id, value }
  const [docsFor, setDocsFor] = useState(null);
  const [bulk, setBulk] = useState(false);
  const load = async () => {
    const { data, error } = await supabase.from('app_user').select('id, first_name, last_name, login, email, is_active, last_login_at, must_change_code, user_role(role, title)').order('last_name');
    if (error) setErr('La liste des comptes n\'a pas pu être chargée.'); else setList(data);
  };
  useEffect(() => { load(); }, []);
  const run = async (fn) => { setBusy(true); setErr(''); try { await fn(); await load(); } catch (x) { setErr(x.message); } setBusy(false); };
  const ok = d && d.first.trim() && d.last.trim();
  const ficheOf = (u) => ({ ...EMPTY_AGENT, first: u.first_name, last: u.last_name, title: u.user_role?.[0]?.title ?? '', role: u.user_role?.[0]?.role ?? 'PROFESSEUR', ...(fiches[u.id] ?? {}) });
  const number = (u) => `${schoolYearOf(today())}/${String(list.findIndex((x) => x.id === u.id) + 1).padStart(3, '0')}`;
  const create = () => run(async () => {
    const r = await call({ action: 'create', first: d.first, last: d.last, usual: d.usual, role: d.role, title: d.title, email: d.email });
    const { email, ...rest } = d;
    setFiches({ ...fiches, [r.id]: rest });
    setSlip({ ...r, name: `${d.first.trim()} ${d.last.trim().toUpperCase()}` });
    setD(null);
  });
  return (
    <div className="space-y-5">
      {embedded ? <p className="text-sm text-slate-600">Identifiant : 2 premières lettres du nom + prénom (ex. am.fatema), attribué automatiquement ; un code provisoire à remettre. L'e-mail (Gmail, Outlook…) sert seulement en cas de code oublié.</p> : <div>
        <p className="text-sm font-semibold text-navy-500">Version en ligne</p>
        <h1 className="text-2xl font-semibold text-navy-900">Comptes du personnel</h1>
      </div>}
      {err && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">{err}</p>}
      {slip && <Slip slip={slip} onClose={() => setSlip(null)} />}
      {d ? (
        <Card title="Nouvel agent" subtitle="Tout en une fois : le compte est créé et la fiche enregistrée. Seuls le prénom, le nom et la fonction sont obligatoires.">
          <AgentForm value={d} onChange={setD} />
          <div className="mt-4 flex flex-wrap gap-2">
            <Button disabled={!ok || busy} onClick={create}>{busy ? 'Création…' : 'Créer le compte et enregistrer la fiche'}</Button>
            <Button variant="secondary" onClick={() => setD(null)}>Annuler</Button>
          </div>
        </Card>
      ) : !bulk && <div className="flex flex-wrap gap-2"><Button onClick={() => setD({ ...EMPTY_AGENT })}>＋ Nouvel agent</Button><Button variant="secondary" onClick={() => setBulk(true)}>Créer les comptes des professeurs (liste)</Button></div>}
      {bulk && !d && (
        <>
          <BulkTeachers existingLogins={(list ?? []).map((u) => u.login)} onDone={load}
            create={async (r) => {
              const res = await call({ action: 'create', first: r.first, last: r.last, usual: r.usual, role: 'PROFESSEUR', title: 'Professeur' });
              setFiches((prev) => ({ ...prev, [res.id]: { ...EMPTY_AGENT, civility: r.civility ?? 'Madame', first: r.first, usual: r.usual, last: r.last, role: 'PROFESSEUR', title: 'Professeur', services: r.services } }));
              return res;
            }} />
          <Button variant="ghost" onClick={() => setBulk(false)}>Fermer la création groupée</Button>
        </>
      )}
      <Card title={`Agents (${list?.length ?? '…'})`}>
        {!list ? <p className="text-sm text-slate-500">Chargement…</p> : (
          <ul className="divide-y divide-slate-100">
            {list.map((u) => {
              const f = ficheOf(u); const gone = f.exit && f.exit < today();
              return (
                <li key={u.id} className={`py-2.5 text-sm ${u.is_active ? '' : 'opacity-60'}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900">{u.last_name} {u.first_name} <span className="font-mono text-xs font-normal text-slate-500">· {u.login}</span></p>
                      <p className="text-xs text-slate-600">{(u.user_role ?? []).map((r) => r.title || LABEL[r.role] || r.role).join(', ')}{fiches[u.id]?.contract ? ` · ${fiches[u.id].contract}` : ''}{f.entry ? ` · entré·e le ${fr(f.entry)}` : ''}{f.exit ? (gone ? ` · sorti·e le ${fr(f.exit)}` : ` · fin prévue le ${fr(f.exit)}`) : ''}
                        {gone && u.is_active && <span className="ml-1 font-medium text-red-700">— compte encore actif : à désactiver</span>}</p>
                      {serviceText(f.services) && <p className="text-xs text-slate-500">{serviceText(f.services)}</p>}
                      <p className="text-xs text-slate-500">{/\.invalid$/.test(u.email) ? 'sans e-mail · ' : ''}{u.last_login_at ? `dernière connexion le ${new Date(u.last_login_at).toLocaleDateString('fr-FR')}` : 'jamais connecté·e'}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {u.must_change_code && u.is_active && <Badge tone="amber">code provisoire</Badge>}
                      {!u.is_active && <Badge tone="slate">désactivé</Badge>}
                      <Button variant="ghost" className="!py-1 text-xs" onClick={() => setEdit(edit?.id === u.id ? null : { id: u.id, value: f })}>{edit?.id === u.id ? 'Fermer la fiche' : 'Fiche'}</Button>
                      <Button variant="ghost" className="!py-1 text-xs" onClick={() => setDocsFor(docsFor === u.id ? null : u.id)}>Documents</Button>
                      <Button variant="secondary" className="!py-1 text-xs" disabled={busy || !u.is_active} onClick={() => run(async () => { const r = await call({ action: 'reset', userId: u.id }); setSlip({ ...r, name: `${u.first_name} ${u.last_name}` }); })}>Nouveau code</Button>
                      <Button variant="ghost" className="!py-1 text-xs" disabled={busy} onClick={async () => { if (u.is_active && !(await askConfirm(`Désactiver le compte de ${u.first_name} ${u.last_name} ? La personne ne pourra plus se connecter ; ses saisies restent.`))) return; run(() => call({ action: 'active', userId: u.id, active: !u.is_active })); }}>{u.is_active ? 'Désactiver' : 'Réactiver'}</Button>
                    </div>
                  </div>
                  {docsFor === u.id && <div className="mt-2 rounded-lg bg-slate-50 p-2"><StaffDocumentsButtons agent={f} headName={settings?.school?.headName} number={number(u)} /></div>}
                  {edit?.id === u.id && (
                    <div className="mt-2 rounded-xl bg-slate-50 p-3">
                      <AgentForm value={edit.value} onChange={(value) => setEdit({ ...edit, value })} withAccount={false} />
                      <p className="mt-2 text-xs text-slate-500">Le nom et la fonction dans l'ENT ne changent pas ici (compte de connexion) ; le reste de la fiche, oui.</p>
                      <div className="mt-3 flex gap-2">
                        <Button onClick={() => { const { email, ...rest } = edit.value; setFiches({ ...fiches, [u.id]: rest }); setEdit(null); }}>Enregistrer la fiche</Button>
                        <Button variant="secondary" onClick={() => setEdit(null)}>Annuler</Button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
