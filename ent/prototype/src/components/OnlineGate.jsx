import React, { useEffect, useState } from 'react';
import { supabase, signIn, forgotCode, loadAccount, setCode, signOut, codeErrors } from '../online/client.js';
import { saveMe, loadMe } from '../identity.js';
import { loadRoster } from '../online/roster.js';
import { loadRemoteCarnet } from '../gradebookStore.js';
import { flushAll } from '../online/docs.js';
import { loadStudentContext, loadSchoolForStaff } from '../online/school.js';

// Version en ligne : rien ne s'affiche sans connexion. Identifiant + code ; « code oublié » envoie un lien à
// l'adresse du compte ; à la première connexion (code provisoire remis par la Direction), on choisit son code.
const field = 'mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-base';

function Shell({ title, children }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-navy-900 to-navy-700 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-navy-500">ENT Chateaubriand</p>
        <h1 className="mb-4 font-display text-xl font-semibold text-navy-900">{title}</h1>
        {children}
      </div>
    </div>
  );
}

// arrivée depuis l'intranet du site de l'école : « ?espace=eleves » → titre de l'espace (une seule connexion derrière)
const ESPACES = { administration: 'Espace administration', professeurs: 'Espace professeurs', eleves: 'Espace élèves', parents: 'Espace parents' };
const espace = (() => { try { return new URLSearchParams(window.location.search).get('espace'); } catch { return null; } })();

function Login({ onDone }) {
  const [login, setLogin] = useState(''); const [code, setCodeValue] = useState('');
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false); const [forgot, setForgot] = useState(false); const [sent, setSent] = useState(false);
  if (forgot) return (
    <Shell title="Code oublié">
      {sent ? <p role="status" className="text-sm text-slate-700">Si cet identifiant a une adresse e-mail, un lien vient d'y être envoyé : ouvrez-le pour choisir un nouveau code. Sans adresse e-mail, demandez un nouveau code à la Direction.</p> : (
        <form onSubmit={async (e) => { e.preventDefault(); setBusy(true); await forgotCode(login).catch(() => {}); setBusy(false); setSent(true); }}>
          <label className="block text-sm font-medium text-slate-700">Identifiant<input value={login} onChange={(e) => setLogin(e.target.value)} autoComplete="username" autoCapitalize="none" className={field} /></label>
          <button disabled={!login.trim() || busy} className="mt-4 min-h-[44px] w-full rounded-xl bg-navy-500 font-semibold text-white disabled:bg-slate-300">Recevoir un lien</button>
        </form>
      )}
      <button type="button" onClick={() => { setForgot(false); setSent(false); }} className="mt-3 w-full text-sm text-navy-600 underline">Retour à la connexion</button>
    </Shell>
  );
  return (
    <Shell title={ESPACES[espace] ?? 'Connexion'}>
      {espace === 'parents' && <p className="mb-3 rounded-lg bg-amber-50 p-2 text-sm text-amber-900">Le portail des familles ouvre le 17 décembre : les identifiants sont remis avec les bulletins.</p>}
      <form onSubmit={async (e) => { e.preventDefault(); setBusy(true); setErr(''); try { await signIn(login, code); onDone(); } catch (x) { setErr(x.message); } setBusy(false); }}>
        <label className="block text-sm font-medium text-slate-700">Identifiant<input value={login} onChange={(e) => setLogin(e.target.value)} autoComplete="username" autoCapitalize="none" autoCorrect="off" className={field} /></label>
        <label className="mt-3 block text-sm font-medium text-slate-700">Code<input type="password" value={code} onChange={(e) => setCodeValue(e.target.value)} autoComplete="current-password" className={field} /></label>
        {err && <p role="alert" className="mt-2 text-sm text-red-700">{err}</p>}
        <button disabled={!login.trim() || !code || busy} className="mt-4 min-h-[44px] w-full rounded-xl bg-navy-500 font-semibold text-white disabled:bg-slate-300">{busy ? 'Connexion…' : 'Se connecter'}</button>
      </form>
      <button type="button" onClick={() => setForgot(true)} className="mt-3 w-full text-sm text-navy-600 underline">Code oublié ?</button>
      <a href="../../intranet.html" className="mt-2 block text-center text-xs text-slate-500 underline">← Site de l'école</a>
    </Shell>
  );
}

function NewCode({ first, onDone }) {
  const [a, setA] = useState(''); const [b, setB] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const errs = codeErrors(a, b);
  return (
    <Shell title={first ? 'Choisissez votre code' : 'Nouveau code'}>
      {first && <p className="mb-3 text-sm text-slate-600">Le code reçu de la Direction est provisoire. Choisissez le vôtre : il restera personnel.</p>}
      <form onSubmit={async (e) => { e.preventDefault(); if (errs.length) return; setBusy(true); setErr(''); try { await setCode(a); onDone(); } catch (x) { setErr(x.message); } setBusy(false); }}>
        <label className="block text-sm font-medium text-slate-700">Nouveau code<input type="password" value={a} onChange={(e) => setA(e.target.value)} autoComplete="new-password" className={field} /></label>
        <label className="mt-3 block text-sm font-medium text-slate-700">Encore une fois<input type="password" value={b} onChange={(e) => setB(e.target.value)} autoComplete="new-password" className={field} /></label>
        {a && errs.length > 0 && <p className="mt-2 text-xs text-slate-600">{errs.join(' ')}</p>}
        {err && <p role="alert" className="mt-2 text-sm text-red-700">{err}</p>}
        <button disabled={errs.length > 0 || busy} className="mt-4 min-h-[44px] w-full rounded-xl bg-navy-500 font-semibold text-white disabled:bg-slate-300">Enregistrer mon code</button>
      </form>
    </Shell>
  );
}

export default function OnlineGate({ children }) {
  const [state, setState] = useState({ step: 'loading' });
  const refresh = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setState({ step: 'login' }); return; }
    const acc = await loadAccount().catch((e) => ({ failed: true, message: e?.message }));
    if (acc?.failed) { setState({ step: 'failed', message: acc.message }); return; }
    if (!acc || acc.orphan) { setState({ step: 'orphan' }); return; }
    if (acc.mustChange) { setState({ step: 'first', acc }); return; }
    if (!acc.profile) { setState({ step: 'norole', acc }); return; }
    supabase.rpc('ent_seen').then(() => {}, () => {});
    // l'application signe les saisies de ce nom, avec ce profil (voir identity.js) ; si la personne de cet
    // appareil change, on recharge une fois pour que tous les écrans repartent de la bonne identité
    const prev = loadMe(); const next = { role: acc.profile, name: acc.name, login: acc.login, id: acc.id };
    saveMe(next);
    if ((prev?.id !== next.id || prev?.role !== next.role) && !sessionStorage.getItem('ent-me-reload')) {
      sessionStorage.setItem('ent-me-reload', '1'); window.location.reload(); return;
    }
    sessionStorage.removeItem('ent-me-reload');
    // personnel hors Direction : classes publiées par la Direction ; professeur : son carnet de notes.
    // Si le serveur ne répond pas, on n'ouvre pas (sinon un carnet vide pourrait remplacer le vrai).
    if (acc.profile === 'ELEVE') {
      try { await loadStudentContext(acc.id); } catch (e) { setState({ step: 'failed', message: e?.message, sync: true }); return; }
    } else if (acc.profile !== 'DIRECTION') {
      try {
        const roster = await loadRoster();
        await loadSchoolForStaff(roster?.students ?? []); // agenda : emploi du temps et événements publiés
        if (acc.profile === 'ENSEIGNANT') await loadRemoteCarnet(acc.id);
      } catch (e) { setState({ step: 'failed', message: e?.message, sync: true }); return; }
    }
    flushAll();
    setState({ step: 'in', acc });
  };
  useEffect(() => {
    refresh();
    const { data } = supabase.auth.onAuthStateChange((event) => { if (event === 'PASSWORD_RECOVERY') setState({ step: 'recovery' }); });
    return () => data.subscription.unsubscribe();
  }, []);
  if (state.step === 'loading') return <Shell title="Connexion…"><p className="text-sm text-slate-600">Un instant.</p></Shell>;
  if (state.step === 'login') return <Login onDone={refresh} />;
  if (state.step === 'first') return <NewCode first onDone={refresh} />;
  if (state.step === 'recovery') return <NewCode onDone={() => { window.location.hash = ''; refresh(); }} />;
  if (state.step === 'failed') return (
    <Shell title="Connexion à la base impossible">
      <p className="text-sm text-slate-700">{state.sync ? 'Vos classes et vos notes n\'ont pas pu être chargées (réseau lent ou coupé). Rien n\'est perdu : les notes déjà envoyées sont sur le serveur, celles en attente restent sur cet appareil.' : 'Votre compte n\'a pas pu être lu pour l\'instant (réseau lent ou service momentanément indisponible). Vos données ne sont pas touchées.'}</p>
      <button type="button" onClick={() => { setState({ step: 'loading' }); refresh(); }} className="mt-4 min-h-[44px] w-full rounded-xl bg-navy-500 font-semibold text-white">Réessayer</button>
      {state.message && <p className="mt-3 text-[11px] text-slate-400">Détail technique : {state.message}</p>}
    </Shell>
  );
  if (state.step === 'orphan' || state.step === 'norole') return (
    <Shell title="Compte incomplet">
      <p className="text-sm text-slate-700">Ce compte n'est pas encore relié à une fonction dans l'ENT. Demandez à la Direction de le compléter.</p>
      <button type="button" onClick={() => signOut().then(refresh)} className="mt-4 min-h-[44px] w-full rounded-xl bg-navy-500 font-semibold text-white">Se déconnecter</button>
    </Shell>
  );
  return children;
}
