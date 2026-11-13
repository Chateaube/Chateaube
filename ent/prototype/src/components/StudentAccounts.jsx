import React, { useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card } from './ui.jsx';
import { supabase, FN_COMPTES } from '../online/client.js';
import { fetchDoc } from '../online/docs.js';
import { buildSchool } from '../online/school.js';
import { loadImport } from '../importStore.js';
import { readStored } from '../persist.js';
import { SCHOOL_EVENTS, seedParcoursup } from '../data/events.js';
import { loadChanges } from './TimetableChanges.jsx';
import { printOnly } from '../print.js';
import { askConfirm } from './Dialogs.jsx';

// Portail des élèves (Direction, version en ligne) :
// 1. envoyer aux élèves l'emploi du temps, les changements de cours et le calendrier (vacances, événements) ;
// 2. créer les comptes des élèves d'une classe, avec les fiches d'accès à imprimer.
// Les notes ne sont pas ouvertes aux élèves (17 décembre).
const call = async (body) => {
  const { data, error } = await supabase.functions.invoke(FN_COMPTES, { body });
  if (error) { let msg = 'Le serveur ne répond pas. Vérifiez que la fonction des comptes est à jour dans Supabase.'; try { msg = (await error.context.json()).error ?? msg; } catch { /* illisible */ } throw new Error(msg); }
  return data;
};
const fold = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
const when = (iso) => (iso ? new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
const ORDER = ['6e', '5e', '4e', '3e', '2de', '1re STMG', '1re Générale', 'Terminale STMG', 'Terminale Générale'];

export default function StudentAccounts({ settings }) {
  const students = loadImport()?.students ?? [];
  const classes = useMemo(() => [...new Set(students.map((s) => s.cls).filter(Boolean))].sort((a, b) => ((ORDER.indexOf(a) + 1) || 99) - ((ORDER.indexOf(b) + 1) || 99)), [students.length]);
  const [cls, setCls] = useState(() => classes.find((c) => /^Terminale/.test(c)) ?? classes[0] ?? '');
  const [accounts, setAccounts] = useState(null); const [school, setSchool] = useState(null);
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState(''); const [err, setErr] = useState(''); const [slips, setSlips] = useState(null);
  const load = async () => {
    try {
      const [{ data, error }, ecole] = await Promise.all([supabase.from('app_user').select('id, first_name, last_name, login, is_active, must_change_code, user_role(role)').order('last_name'), fetchDoc('ecole')]);
      if (error) throw new Error(error.message);
      setAccounts((data ?? []).filter((u) => (u.user_role ?? []).some((r) => r.role === 'ELEVE'))); setSchool(ecole?.value ?? null);
    } catch (e) { setErr(`Lecture impossible (${e.message}). Avez-vous lancé le script 40_eleves.sql ?`); }
  };
  useEffect(() => { load(); }, []);

  const accountOf = (s) => (accounts ?? []).find((u) => fold(`${u.last_name} ${u.first_name}`) === fold(`${s.lastName} ${s.firstName}`));
  const list = students.filter((s) => s.cls === cls).sort((a, b) => `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, 'fr'));
  const missing = list.filter((s) => !accountOf(s));
  const profile = (s) => ({ lastName: s.lastName, firstName: s.firstName, cls: s.cls, specialties: s.specialties ?? [] });
  const writeProfile = (id, s) => supabase.from('ent_doc').upsert({ key: `eleve:${id}`, kind: 'ELEVE', owner: id, value: profile(s) });

  const sendSchool = async () => {
    const timetable = loadImport()?.timetable ?? [];
    if (!timetable.length && !(await askConfirm('Aucun emploi du temps importé sur cet ordinateur. Envoyer quand même le calendrier seul ?'))) return;
    setBusy(true); setErr(''); setMsg('');
    seedParcoursup();
    const value = buildSchool({ timetable, changes: loadChanges(), calendar: settings?.calendar ?? null, events: readStored('ent-s-evenements') ?? [...SCHOOL_EVENTS] });
    const { error } = await supabase.from('ent_doc').upsert({ key: 'ecole', kind: 'ECOLE', owner: null, value });
    setBusy(false);
    if (error) { setErr(`Envoi impossible : ${error.message}. Avez-vous lancé le script 40_eleves.sql ?`); return; }
    setMsg('Emploi du temps et calendrier envoyés : les élèves les voient à leur prochaine connexion.'); load();
  };

  const create = async () => {
    if (!(await askConfirm(`Créer ${missing.length} compte(s) élève en ${cls} ? Chaque élève recevra un identifiant et un code provisoire à imprimer.`))) return;
    setBusy(true); setErr(''); setMsg(''); const out = [];
    for (const s of missing) {
      try {
        const r = await call({ action: 'create', first: s.firstName, last: s.lastName, role: 'ELEVE', title: s.cls });
        const { error } = await writeProfile(r.id, s); if (error) throw new Error(error.message);
        out.push({ ...r, name: `${s.lastName} ${s.firstName}`, cls: s.cls });
      } catch (e) { out.push({ name: `${s.lastName} ${s.firstName}`, error: e.message }); }
    }
    setBusy(false); setSlips(out); load();
  };
  const reset = async (s, u) => {
    setBusy(true); setErr('');
    try { const r = await call({ action: 'reset', userId: u.id }); await writeProfile(u.id, s); setSlips([{ ...r, name: `${s.lastName} ${s.firstName}`, cls: s.cls }]); }
    catch (e) { setErr(e.message); }
    setBusy(false);
  };
  const url = window.location.href.split('#')[0];

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-semibold text-navy-500">Élèves · en ligne</p>
        <h1 className="text-2xl font-semibold text-navy-900">Portail des élèves</h1>
        <p className="text-sm text-slate-600">Les élèves voient leur emploi du temps, l'agenda de l'école, les documents de l'école et leur fiche d'orientation. Les notes s'ouvriront le 17 décembre ; les autres rubriques sont affichées « en cours de création ».</p>
      </div>
      {err && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{err}</p>}
      {msg && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{msg}</p>}

      <Card title="1. Emploi du temps et calendrier" subtitle="Depuis l'ordinateur où le modèle Excel est importé. À refaire après un changement d'emploi du temps, de cours ou d'événement.">
        <p className="text-sm text-slate-700">{school ? <>Dernier envoi : <strong>{when(school.sentAt)}</strong> · {school.timetable?.length ?? 0} cours · {school.events?.length ?? 0} événements</> : <strong className="text-amber-800">Pas encore envoyé.</strong>}</p>
        <p className="mt-1 text-xs text-slate-500">Pour le calendrier Parcoursup : ajoutez les dates dans Agendas (événement « Examens », classes de Terminale), puis renvoyez.</p>
        <Button className="mt-3" disabled={busy} onClick={sendSchool}>{school ? 'Renvoyer' : 'Envoyer aux élèves'}</Button>
      </Card>

      {slips ? (
        <Card title={`Fiches d'accès (${slips.filter((s) => !s.error).length})`} subtitle="À découper et remettre en main propre">
          {slips.some((s) => s.error) && <ul className="mb-3 rounded-lg bg-red-50 p-2 text-xs text-red-800">{slips.filter((s) => s.error).map((s) => <li key={s.name}>{s.name} : {s.error}</li>)}</ul>}
          <div className="student-slips grid gap-2 sm:grid-cols-2" style={{ fontFamily: 'Poppins, sans-serif' }}>
            {slips.filter((s) => !s.error).map((s) => (
              <div key={s.login} style={{ border: '1px dashed #000', padding: '10px', fontSize: '11px', breakInside: 'avoid', color: '#000' }}>
                <p style={{ fontWeight: 700 }}>ENT Chateaubriand — portail élève</p>
                <p style={{ marginTop: 4 }}>{s.name} · {s.cls}</p>
                <p style={{ marginTop: 4 }}>Adresse : <strong>{url}</strong></p>
                <p>Identifiant : <strong style={{ fontFamily: 'monospace', fontSize: 14 }}>{s.login}</strong></p>
                <p>Code provisoire : <strong style={{ fontFamily: 'monospace', fontSize: 14 }}>{s.code}</strong></p>
                <p style={{ marginTop: 4, fontSize: 9.5 }}>À la première connexion, choisis ton propre code (8 caractères, lettres et chiffres). Ne le donne à personne.</p>
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <Button onClick={() => printOnly('.student-slips', 'size: A4 portrait; margin: 10mm;', 'Accès ENT — élèves')}>Imprimer les fiches</Button>
            <Button variant="secondary" onClick={() => setSlips(null)}>Terminé</Button>
          </div>
          <p className="mt-2 text-xs text-amber-700">Imprimez maintenant : les codes provisoires ne sont plus affichés ensuite.</p>
        </Card>
      ) : (
        <Card title="2. Comptes des élèves" subtitle="Identifiant : 2 lettres du nom + prénom (ex. ra.tsiry). Un code provisoire par élève, à remettre en main propre."
          action={<select value={cls} onChange={(e) => setCls(e.target.value)} aria-label="Classe" className="rounded-lg border border-slate-300 px-2 py-1 text-sm">{classes.map((c) => <option key={c}>{c}</option>)}</select>}>
          {!students.length ? <p className="text-sm text-slate-600">Aucun élève importé sur cet ordinateur : importez d'abord le modèle Excel.</p> : !accounts ? <p className="text-sm text-slate-600">Chargement…</p> : (
            <>
              <ul className="divide-y divide-slate-100 text-sm">
                {list.map((s) => { const u = accountOf(s); return (
                  <li key={`${s.lastName}-${s.firstName}`} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                    <span className="font-medium text-slate-900">{s.lastName} {s.firstName}</span>
                    {u ? <span className="flex items-center gap-2"><span className="font-mono text-xs">{u.login}</span>{u.must_change_code ? <Badge tone="amber">code provisoire</Badge> : <Badge tone="green">connecté·e</Badge>}
                      <Button variant="secondary" className="!py-0.5 text-xs" disabled={busy} onClick={() => reset(s, u)}>Nouveau code</Button></span>
                      : <Badge tone="slate">pas de compte</Badge>}
                  </li>
                ); })}
              </ul>
              <Button className="mt-3" disabled={busy || !missing.length} onClick={create}>{busy ? 'Création…' : missing.length ? `Créer ${missing.length} compte${missing.length > 1 ? 's' : ''} (${cls})` : 'Tous les élèves de la classe ont un compte'}</Button>
            </>
          )}
        </Card>
      )}
    </div>
  );
}
