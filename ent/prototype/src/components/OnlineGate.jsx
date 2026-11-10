import LoadingAnimation from './LoadingAnimation.jsx';
import React, { useEffect, useState } from 'react';
import { supabase, signIn, forgotCode, loadAccount, setCode, signOut, codeErrors } from '../online/client.js';
import { saveMe, loadMe } from '../identity.js';

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
    <Shell title="Connexion">
      <form onSubmit={async (e) => { e.preventDefault(); setBusy(true); setErr(''); try { await signIn(login, code); onDone(); } catch (x) { setErr(x.message); } setBusy(false); }}>
        <label className="block text-sm font-medium text-slate-700">Identifiant<input value={login} onChange={(e) => setLogin(e.target.value)} autoComplete="username" autoCapitalize="none" autoCorrect="off" className={field} /></label>
        <label className="mt-3 block text-sm font-medium text-slate-700">Code<input type="password" value={code} onChange={(e) => setCodeValue(e.target.value)} autoComplete="current-password" className={field} /></label>
        {err && <p role="alert" className="mt-2 text-sm text-red-700">{err}</p>}
        <button disabled={!login.trim() || !code || busy} className="mt-4 min-h-[44px] w-full rounded-xl bg-navy-500 font-semibold text-white disabled:bg-slate-300">{busy ? 'Connexion…' : 'Se connecter'}</button>
      </form>
      <button type="button" onClick={() => setForgot(true)} className="mt-3 w-full text-sm text-navy-600 underline">Code oublié ?</button>
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
  // l'animation reste au moins un instant à la première ouverture (une fois par session)
  const [shown, setShown] = useState(() => { try { return sessionStorage.getItem('ent-splash') === '1'; } catch { return true; } });
  useEffect(() => { if (shown) return undefined; const t = setTimeout(() => { setShown(true); try { sessionStorage.setItem('ent-splash', '1'); } catch { /* rien */ } }, 1600); return () => clearTimeout(t); }, [shown]);
  const refresh = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setState({ step: 'login' }); return; }
    const acc = await loadAccount().catch(() => null);
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
    setState({ step: 'in', acc });
  };
  useEffect(() => {
    refresh();
    const { data } = supabase.auth.onAuthStateChange((event) => { if (event === 'PASSWORD_RECOVERY') setState({ step: 'recovery' }); });
    return () => data.subscription.unsubscribe();
  }, []);
  if (state.step === 'loading' || !shown) return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-navy-900 to-navy-700 p-4 text-center" role="status">
      <div className="rounded-full bg-white/95 p-3 shadow-xl"><LoadingAnimation size={170} /></div>
      <p className="mt-5 font-display text-lg font-semibold text-white">ENT Chateaubriand</p>
      <p className="text-sm text-white/80">Chargement…</p>
    </div>
  );
  if (state.step === 'login') return <Login onDone={refresh} />;
  if (state.step === 'first') return <NewCode first onDone={refresh} />;
  if (state.step === 'recovery') return <NewCode onDone={() => { window.location.hash = ''; refresh(); }} />;
  if (state.step === 'orphan' || state.step === 'norole') return (
    <Shell title="Compte incomplet">
      <p className="text-sm text-slate-700">Ce compte n'est pas encore relié à une fonction dans l'ENT. Demandez à la Direction de le compléter.</p>
      <button type="button" onClick={() => signOut().then(refresh)} className="mt-4 min-h-[44px] w-full rounded-xl bg-navy-500 font-semibold text-white">Se déconnecter</button>
    </Shell>
  );
  return children;
}
