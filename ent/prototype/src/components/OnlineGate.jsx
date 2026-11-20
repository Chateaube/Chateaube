import React, { useEffect, useState } from 'react';
import { supabase, signIn, forgotCode, loadAccount, setCode, signOut, codeErrors } from '../online/client.js';
import { saveMe, loadMe } from '../identity.js';
import { loadRoster } from '../online/roster.js';
import { startShared, GROUPS_OF } from '../online/shared.js';
import { preferLocalImport } from '../importStore.js';
import { loadRemoteCarnet } from '../gradebookStore.js';
import { flushAll } from '../online/docs.js';
import { loadStudentContext, loadSchoolForStaff } from '../online/school.js';
import { startNews } from '../online/schoolNews.js';
import { setAllowedSites, activeSite, wipeDevice } from '../site.js';

// Version en ligne : rien ne s'affiche sans connexion. Identifiant + code ; « code oublié » envoie un lien à
// l'adresse du compte ; à la première connexion (code provisoire remis par la Direction), on choisit son code.
const field = 'mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-base';

// Écran d'accueil de l'ENT (chateaubriand.pro) : à gauche l'école et les quatre espaces, à droite la connexion.
// Un seul écran, sans défilement sur ordinateur ; sur téléphone, la connexion vient en premier.
const SPACES = [
  ['Administration', '', '#ffcf2e', 'M4 10 12 5l8 5zM6 11v7M10 11v7M14 11v7M18 11v7M4 20h16'],
  ['Professeurs', '', '#f25c5c', 'M4 5h16v11H4zM8 9h8M8 12h5M10 20h4'],
  ['Élèves', 'Emploi du temps, agenda, vie scolaire, orientation', '#6cb8f0', 'M2 9l10-5 10 5-10 5zM6 11v5c0 1.5 3 3 6 3s6-1.5 6-3v-5'],
  ['Parents', 'Notes, assiduité, documents · ouverture le 17 décembre', '#a99cf2', 'M8 7a3 3 0 1 0 0 .1M17 9a2.5 2.5 0 1 0 0 .1M2 20c0-3.3 2.7-6 6-6s6 2.7 6 6M14 20c0-2.5 1.5-4.5 3.5-4.5S21 17.5 21 20'],
];
function Shell({ title, children }) {
  return (
    <div className="grid min-h-screen bg-white lg:h-screen lg:grid-cols-[1.15fr_1fr]">
      <section className="order-2 flex flex-col justify-between gap-6 bg-[#eeebfb] px-6 py-8 lg:order-1 lg:px-14 lg:py-10" aria-label="L'école">
        <div className="flex items-center gap-3">
          <img src="icon-192.png" alt="" className="h-10 w-10 rounded-xl" />
          <div><p className="font-display text-xl font-bold leading-none text-[#2b1a8f]">Chateaubriand</p><p className="text-xs font-semibold text-[#6d5fc7]">École · Collège · Lycée — Tamatave</p></div>
        </div>
        <div>
          <h2 className="font-display text-3xl font-bold leading-tight text-[#2b1a8f] lg:text-5xl">Accédez à votre espace</h2>
          <p className="mt-3 max-w-md text-[#6d5fc7]">Un seul identifiant et un seul code, remis par l'école : chacun arrive dans son espace.</p>
          <ul className="mt-6 grid max-w-xl grid-cols-2 gap-3">
            {SPACES.map(([t, d, bg, icon]) => (
              <li key={t} className="rounded-xl border-t-4 bg-white p-3 text-[#2b1a8f] shadow-sm lg:p-4" style={{ borderColor: bg }}>
                <span className="flex h-10 w-10 items-center justify-center rounded-full" style={{ background: bg }}>
                  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={icon} /></svg>
                </span>
                <p className="mt-2 font-display text-base font-bold lg:text-lg">{t}</p>
                {d && <p className="text-xs leading-snug text-[#6d5fc7]">{d}</p>}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-[#6d5fc7]">27 Rue Nationale, Toamasina · <a href="tel:+261345122778" className="underline">+261 34 51 227 78</a> · chateaubetamatave@gmail.com</p>
      </section>
      <section className="order-1 flex items-center justify-center px-4 py-10 lg:order-2" aria-label="Connexion">
        <div className="w-full max-w-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#6d5fc7]">ENT Chateaubriand</p>
          <h1 className="mb-5 font-display text-2xl font-bold text-[#2b1a8f]">{title}</h1>
          {children}
        </div>
      </section>
    </div>
  );
}

// arrivée depuis l'intranet du site de l'école : « ?espace=eleves » → titre de l'espace (une seule connexion derrière)
const ESPACES = { administration: 'Espace administration', professeurs: 'Espace professeurs', eleves: 'Espace élèves', parents: 'Espace parents' }; // anciens liens
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
      <p className="mt-2 text-center text-xs text-slate-500">Identifiant ou code perdu ? Adressez-vous à la Direction.</p>
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
      {/* pas son compte (essai d'un code, appareil prêté) : revenir à la connexion sans rien changer */}
      <button type="button" onClick={() => signOut().finally(() => { try { window.location.hash = ''; } catch { /* rien */ } window.location.reload(); })} className="mt-3 w-full text-sm text-navy-600 underline">Annuler et revenir à la connexion</button>
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
    if (setAllowedSites(acc.sites)) return; // appareil sur un site interdit : il repart sur le bon site
    supabase.rpc('ent_seen').then(() => {}, () => {});
    // l'application signe les saisies de ce nom, avec ce profil (voir identity.js) ; si la personne de cet
    // appareil change, on recharge une fois pour que tous les écrans repartent de la bonne identité
    const prev = loadMe(); const next = { role: acc.profile, name: acc.name, login: acc.login, id: acc.id, title: acc.title ?? '' };
    saveMe(next);
    if ((prev?.id !== next.id || prev?.role !== next.role) && !sessionStorage.getItem('ent-me-reload')) {
      sessionStorage.setItem('ent-me-reload', '1'); window.location.reload(); return;
    }
    sessionStorage.removeItem('ent-me-reload');
    // personnel hors Direction : classes publiées par la Direction ; professeur : son carnet de notes.
    // Si le serveur ne répond pas, on n'ouvre pas (sinon un carnet vide pourrait remplacer le vrai).
    if (acc.profile === 'ELEVE') {
      try { await loadStudentContext(acc.id); } catch (e) { setState({ step: 'failed', message: e?.message, sync: true }); return; }
    } else if (acc.profile !== 'DIRECTION' && activeSite() === 'TMV') {
      try {
        const roster = await loadRoster();
        await loadSchoolForStaff(roster?.students ?? []); // agenda : emploi du temps et événements publiés
        if (acc.profile === 'ENSEIGNANT') await loadRemoteCarnet(acc.id);
      } catch (e) { setState({ step: 'failed', message: e?.message, sync: true }); return; }
    }
    // Direction, secrétariat, vie scolaire : données partagées (caisse, élèves, vie scolaire…) reçues avant l'ouverture.
    // Sans réseau, on ouvre quand même avec ce que l'appareil contient : tout repartira au retour du réseau.
    if (GROUPS_OF[acc.profile]) { try { await startShared(acc.profile); } catch { /* hors ligne : données de l'appareil */ } preferLocalImport(); }
    if (acc.profile === 'DIRECTION' && activeSite() === 'TMV') startNews(); // vie de l'école et annonces publiées → portail des élèves
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
      <button type="button" onClick={() => signOut().finally(() => { wipeDevice(); refresh(); })} className="mt-4 min-h-[44px] w-full rounded-xl bg-navy-500 font-semibold text-white">Se déconnecter</button>
    </Shell>
  );
  return children;
}
