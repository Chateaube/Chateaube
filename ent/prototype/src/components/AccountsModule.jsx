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
import { loginFor } from '../rules/logins.js';
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
  const [loginEdit, setLoginEdit] = useState(null); // { id, value } : identifiant modifié à la main
  // filtre : l'équipe (sans les élèves), l'administration, les professeurs ou les élèves
  const [who, setWho] = useState('EQUIPE');
  const rolesOf = (u) => (u.user_role ?? []).map((r) => r.role);
  const WHO = { EQUIPE: ['Équipe', (u) => !rolesOf(u).every((r) => ['ELEVE', 'PARENT'].includes(r)) || !rolesOf(u).length],
    ADMIN: ['Administration', (u) => rolesOf(u).some((r) => ['DIRECTION', 'BUREAU', 'VIE_SCOLAIRE'].includes(r))],
    PROFS: ['Professeurs', (u) => rolesOf(u).includes('PROFESSEUR')],
    ELEVES: ['Élèves', (u) => rolesOf(u).includes('ELEVE')] };
  const shownList = (list ?? []).filter(WHO[who][1]);
  const [d, setD] = useState(null); // nouvel agent : fiche complète
  const [busy, setBusy] = useState(false); const [slip, setSlip] = useState(null);
  // fiche de chaque agent (contrat, identité, enseignements, taux) : sur l'appareil de la Direction
  const [fiches, setFiches] = usePersistent('ent-s-fiches-agents', {});
  const [edit, setEdit] = useState(null); // { id, value }
  const [docsFor, setDocsFor] = useState(null);
  const [bulk, setBulk] = useState(false);
  const [slips, setSlips] = useState(null); // nouveaux codes en série
  // codes en série : jamais les comptes de la Direction (on ne se retire pas son propre accès par erreur)
  const toRenew = (u) => u.must_change_code && u.is_active && !(u.user_role ?? []).some((r) => r.role === 'DIRECTION');
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
      {embedded ? <p className="text-sm text-slate-600">Identifiant : 2 premières lettres du nom + prénom (ex. am.fara), attribué automatiquement ; un code provisoire à remettre. L'e-mail (Gmail, Outlook…) sert seulement en cas de code oublié.</p> : <div>
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
      ) : !bulk && <div className="flex flex-wrap gap-2"><Button onClick={() => setD({ ...EMPTY_AGENT })}>＋ Nouvel agent</Button><Button variant="secondary" onClick={() => setBulk(true)}>Créer les comptes des professeurs (liste)</Button>
        {(list ?? []).some(toRenew) && <Button variant="secondary" disabled={busy} onClick={async () => {
          const todo = list.filter(toRenew);
          if (!(await askConfirm(`Donner un nouveau code provisoire aux ${todo.length} compte(s) qui ne se sont pas encore connectés ? Les anciens codes ne marcheront plus.`))) return;
          run(async () => { const out = []; for (const u of todo) { try { const r = await call({ action: 'reset', userId: u.id }); out.push({ ...r, name: `${u.first_name} ${u.last_name}` }); } catch (x) { out.push({ name: `${u.first_name} ${u.last_name}`, error: x.message }); } } setSlips(out); });
        }}>Nouveaux codes pour tous les « code provisoire »</Button>}</div>}
      {slips && (
        <Card title={`Fiches d'accès (${slips.filter((s) => !s.error).length})`} subtitle="À imprimer maintenant : les codes ne s'affichent qu'une fois">
          {slips.some((s) => s.error) && <ul className="mb-2 text-xs text-red-700">{slips.filter((s) => s.error).map((s) => <li key={s.name}>{s.name} : {s.error}</li>)}</ul>}
          <div className="series-slips grid gap-2 sm:grid-cols-2" style={{ fontFamily: 'Poppins, sans-serif' }}>
            {slips.filter((s) => !s.error).map((s) => (
              <div key={s.login} style={{ border: '1px dashed #000', padding: '10px', fontSize: '11px', breakInside: 'avoid', color: '#000' }}>
                <p style={{ fontWeight: 700 }}>ENT Chateaubriand — vos accès</p>
                <p style={{ marginTop: 4 }}>{s.name}</p>
                <p style={{ marginTop: 4 }}>Adresse : <strong>{window.location.href.split('#')[0]}</strong></p>
                <p>Identifiant : <strong style={{ fontFamily: 'monospace', fontSize: 14 }}>{s.login}</strong></p>
                <p>Code provisoire : <strong style={{ fontFamily: 'monospace', fontSize: 14 }}>{s.code}</strong></p>
                <p style={{ marginTop: 4, fontSize: 9.5 }}>À la première connexion, choisissez votre propre code (8 caractères, lettres et chiffres). Ne le communiquez à personne.</p>
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-2"><Button onClick={() => printOnly('.series-slips', 'size: A4 portrait; margin: 10mm;', 'Accès ENT')}>Imprimer toutes les fiches</Button><Button variant="secondary" onClick={() => setSlips(null)}>Terminé</Button></div>
        </Card>
      )}
      {bulk && !d && (
        <>
          <BulkTeachers existingLogins={(list ?? []).map((u) => u.login)} existingNames={(list ?? []).map((u) => `${u.last_name} ${u.first_name}`)} onDone={load}
            create={async (r) => {
              const res = await call({ action: 'create', first: r.first, last: r.last, usual: r.usual, role: 'PROFESSEUR', title: 'Professeur' });
              setFiches((prev) => ({ ...prev, [res.id]: { ...EMPTY_AGENT, civility: r.civility ?? 'Madame', first: r.first, usual: r.usual, last: r.last, role: 'PROFESSEUR', title: 'Professeur', services: r.services } }));
              return res;
            }} />
          <Button variant="ghost" onClick={() => setBulk(false)}>Fermer la création groupée</Button>
        </>
      )}
      <Card title={`Agents (${list ? shownList.length : '…'})`}
        action={list && <div role="group" aria-label="Filtrer" className="flex flex-wrap gap-1">{Object.entries(WHO).map(([k, [l, f]]) => (
          <button key={k} type="button" aria-pressed={who === k} onClick={() => setWho(k)} className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ${who === k ? 'bg-navy-500 text-white ring-navy-500' : 'bg-white text-slate-700 ring-slate-300'}`}>{l} ({list.filter(f).length})</button>
        ))}</div>}>
        {!list ? <p className="text-sm text-slate-500">Chargement…</p> : (
          <ul className="divide-y divide-slate-100">
            {shownList.length === 0 && <li className="py-2 text-sm text-slate-500">Personne dans cette catégorie.</li>}
            {shownList.map((u) => {
              const f = ficheOf(u); const gone = f.exit && f.exit < today();
              return (
                <li key={u.id} className={`py-2.5 text-sm ${u.is_active ? '' : 'opacity-60'}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900">{u.last_name} {u.first_name} <span className="font-mono text-xs font-normal text-slate-500">· {u.login}</span>
                        {!(u.user_role ?? []).some((r) => r.role === 'DIRECTION') && <button type="button" className="ml-2 text-xs font-normal text-navy-700 underline" onClick={() => setLoginEdit(loginEdit?.id === u.id ? null : { id: u.id, value: u.login ?? '' })}>Modifier l'identifiant</button>}</p>
                      {loginEdit?.id === u.id && (
                        <form className="mt-1 flex flex-wrap items-center gap-2" onSubmit={async (e) => {
                          e.preventDefault();
                          const want = loginEdit.value.trim().toLowerCase();
                          if (!/^[a-z0-9]+(\.[a-z0-9]+)*$/.test(want)) { setErr('Identifiant : lettres sans accent, chiffres et points seulement (ex. ki.christophe).'); return; }
                          if ((list ?? []).some((x) => x.id !== u.id && x.login === want)) { setErr(`L'identifiant « ${want} » est déjà pris.`); return; }
                          if (want === u.login) { setLoginEdit(null); return; }
                          if (!(await askConfirm(`Identifiant de ${u.first_name} ${u.last_name} : « ${u.login} » → « ${want} » ? Le code ne change pas ; prévenez la personne.`))) return;
                          setLoginEdit(null);
                          run(async () => { const { error } = await supabase.from('app_user').update({ login: want }).eq('id', u.id); if (error) throw new Error(/duplicate|unique/i.test(error.message) ? `L'identifiant « ${want} » est déjà pris.` : error.message); });
                        }}>
                          <input value={loginEdit.value} onChange={(e) => setLoginEdit({ ...loginEdit, value: e.target.value })} aria-label="Nouvel identifiant" autoCapitalize="none" className="rounded-md border border-slate-300 px-2 py-1 font-mono text-xs" />
                          <Button type="submit" className="!px-2 !py-1 text-xs" disabled={busy}>Enregistrer</Button>
                          <span className="text-[11px] text-slate-500">Même code ; la personne se connecte ensuite avec le nouvel identifiant.</span>
                        </form>
                      )}
                      {(() => {
                        // nom corrigé : l'identifiant peut suivre (la personne se connecte ensuite avec le nouveau, même code)
                        const want = loginFor(u.first_name, u.last_name, new Set((list ?? []).filter((x) => x.id !== u.id).map((x) => x.login)), f.usual);
                        // proposé seulement si l'identifiant ne correspond plus au nom de famille (nom / prénom inversés, nom corrigé)
                        const fold = (t) => String(t ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z]/g, '');
                        const head = String(u.login ?? '').split('.')[0];
                        if (!u.login?.includes('.') || (u.user_role ?? []).some((r) => r.role === 'DIRECTION') || want === u.login || fold(u.last_name).startsWith(head)) return null; // identifiants choisis (« adjointe ») et Direction : jamais touchés
                        return <button type="button" disabled={busy} className="mt-0.5 text-xs font-medium text-navy-700 underline" onClick={async () => {
                          if (!(await askConfirm(`Changer l'identifiant de ${u.first_name} ${u.last_name} : « ${u.login} » → « ${want} » ? Le code ne change pas ; prévenez la personne qu'elle se connecte désormais avec « ${want} ».`))) return;
                          run(async () => { const { error } = await supabase.from('app_user').update({ login: want }).eq('id', u.id); if (error) throw new Error(/duplicate|unique/i.test(error.message) ? `L'identifiant « ${want} » est déjà pris.` : error.message); });
                        }}>Identifiant d'après le nom : passer à « {want} »</button>;
                      })()}
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
                        <Button onClick={() => { const { email, ...rest } = edit.value; setFiches({ ...fiches, [u.id]: rest }); setEdit(null);
                          // nom ou prénom corrigé dans la fiche : le compte (listes, notes, bulletins) prend le même nom
                          const first = (rest.first ?? '').trim(); const last = (rest.last ?? '').trim();
                          if (first && last && (first !== u.first_name || last !== u.last_name)) run(async () => { const { error } = await supabase.from('app_user').update({ first_name: first, last_name: last }).eq('id', u.id); if (error) throw new Error(error.message); });
                        }}>Enregistrer la fiche</Button>
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
