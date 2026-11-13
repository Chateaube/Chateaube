import React, { useEffect, useState } from 'react';
import { Badge, Button, Card } from './ui.jsx';
import { supabase } from '../online/client.js';
import { fetchDocs, fetchDoc } from '../online/docs.js';
import { buildRoster, servicesFor, setCurrentRoster } from '../online/roster.js';
import { loadRemoteCarnet } from '../gradebookStore.js';
import GradebookModule from './GradebookModule.jsx';
import { loadImport } from '../importStore.js';
import { readStored, writeStored } from '../persist.js';
import { matchTeacher, refineByTimetable } from '../rules/teacherMatch.js';
import { buildXlsx } from '../xlsx.js';
import { saveFile } from '../download.js';
import { askConfirm } from './Dialogs.jsx';

// Notes reçues (Direction, version en ligne) :
// 1. « Envoyer les classes aux professeurs » : élèves de l'import + matières et classes des fiches des agents ;
// 2. ce que chaque professeur a saisi, service par service (devoirs, notes, compétences du bulletin, validation) ;
// 3. export Excel de toutes les notes, à garder sur l'ordinateur (une copie chaque vendredi, par exemple).
const when = (iso) => (iso ? new Date(iso).toLocaleString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
const filled = (v) => v != null && String(v).trim() !== '';

/** Résumé d'un service dans un carnet. */
export function serviceSummary(carnet, service) {
  const evs = (carnet?.evaluations?.[service.id] ?? []).filter((e) => !e.fromMockExam);
  const grades = carnet?.grades?.[service.id] ?? {};
  const expected = evs.length * service.students.length;
  const got = service.students.reduce((n, st) => n + evs.filter((e) => filled(grades[st]?.[e.id])).length, 0);
  return { evaluations: evs.length, expected, got, competencies: (carnet?.myComps?.[service.id] ?? []).length, validated: Boolean(carnet?.validated?.[service.id]) };
}

/** Classeur : une feuille par professeur × service (élèves en lignes, devoirs en colonnes). */
export function notesWorkbook(rows) {
  const sheets = rows.flatMap(({ name, carnet, services }) => services.map((s) => {
    const evs = (carnet?.evaluations?.[s.id] ?? []).filter((e) => !e.fromMockExam);
    const g = carnet?.grades?.[s.id] ?? {};
    return {
      name: `${s.cls} ${s.subject}`.slice(0, 31),
      rows: [
        [`${s.cls} — ${s.subject} — ${name}`],
        ['Élève', ...evs.map((e) => `${e.title || e.type} (${e.date?.split('-').reverse().join('/') ?? ''}, /${e.scale}, coef ${e.coef})`)],
        ...s.students.map((st) => [st, ...evs.map((e) => { const v = String(g[st]?.[e.id] ?? '').trim(); return /^\d+([.,]\d+)?$/.test(v) ? Number(v.replace(',', '.')) : v; })]),
        [],
        ['Compétences du bulletin', (carnet?.myComps?.[s.id] ?? []).join(' · ')],
      ],
    };
  }));
  // noms de feuilles uniques (Excel refuse les doublons)
  const seen = {};
  sheets.forEach((sh) => { const base = sh.name.replace(/[\\/?*[\]:]/g, ' ').slice(0, 28); seen[base] = (seen[base] ?? 0) + 1; sh.name = seen[base] > 1 ? `${base} ${seen[base]}` : base; });
  return buildXlsx(sheets.length ? sheets : [{ name: 'Notes', rows: [['Aucune note reçue pour l\'instant.']] }]);
}

const SHARES_KEY = 'ent-k-matieres-partagees';
/** Matières partagées d'après la liste envoyée : [{ key, cls, subject, teachers: [{ id, name, hours }] }]. */
export function sharedSubjects(roster, fiches = {}) {
  const by = {};
  Object.entries(roster?.services ?? {}).forEach(([id, list]) => list.forEach((s) => s.classes.forEach((cls) => {
    const key = `${cls}|${s.subject}`;
    const hours = Number((fiches[id]?.services ?? []).find((x) => x.subject === s.subject && x.classes?.includes(cls))?.hours) || 0;
    (by[key] ??= { key, cls, subject: s.subject, teachers: [] }).teachers.push({ id, name: roster.names?.[id] ?? id, hours });
  })));
  return Object.values(by).filter((g) => g.teachers.length > 1);
}
/** Réglage d'un professeur dans une matière partagée : poids (heures de la fiche si connues, sinon 1), affiché. */
export function shareOf(shares, key, tid, groups = []) {
  const t = groups.find((g) => g.key === key)?.teachers.find((x) => x.id === tid);
  return { weight: t?.hours || 1, shown: true, ...(shares?.[key]?.[tid] ?? {}) };
}

export default function NotesReceived({ settings, go }) {
  const [actingFor, setActingFor] = useState(null); // { id, name } : la Direction saisit les notes de ce professeur
  const [data, setData] = useState(null); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState('');
  const load = async () => {
    setErr('');
    try {
      const [carnets, roster, users] = await Promise.all([
        fetchDocs('CARNET'), fetchDoc('roster'),
        supabase.from('app_user').select('id, first_name, last_name, is_active, user_role(role)').order('last_name').then(({ data: d, error }) => { if (error) throw new Error(error.message); return d; }),
      ]);
      setData({ carnets: Object.fromEntries(carnets.map((c) => [c.owner, c])), roster: roster?.value ?? null, users });
    } catch (e) { setErr(`Lecture impossible pour l'instant (${e.message}). Réessayez.`); }
  };
  useEffect(() => { load(); }, []);

  const [fiches, setFiches] = useState(() => readStored('ent-s-fiches-agents') ?? {});
  const teachers = (data?.users ?? []).filter((u) => u.is_active && ((u.user_role ?? []).some((r) => r.role === 'PROFESSEUR') || fiches[u.id]?.services?.length))
    .map((u) => ({ id: u.id, name: `${u.first_name} ${u.last_name}`.trim(), line: `${u.last_name} ${u.first_name}`.trim() }));
  const students = loadImport()?.students ?? [];

  const send = async (recompute = false) => {
    if (!students.length) { setErr('Aucun élève importé sur cet appareil : importez d\'abord le modèle Excel (Réglages › Import), depuis cet ordinateur.'); return; }
    // fiches sans enseignements : remplies depuis l'import (onglet 3 Personnel / emploi du temps), puis gardées sur la fiche
    const list = loadImport()?.assignments ?? [];
    const auto = {};
    if (recompute && !(await askConfirm('Recalculer les matières et classes de TOUTES les fiches depuis l\'import (onglet 3 + emploi du temps) ? Les corrections faites à la main sur les fiches seront remplacées.'))) return;
    const slots = loadImport()?.timetable ?? [];
    teachers.filter((t) => recompute || !fiches[t.id]?.services?.some((x) => x.subject && x.classes?.length)).forEach((t) => {
      const m = matchTeacher(t.line, list);
      if (m.services.length) auto[t.id] = { ...(fiches[t.id] ?? {}), services: refineByTimetable(m.services, m.teacher, slots) };
    });
    const merged = { ...fiches, ...auto };
    if (Object.keys(auto).length) { writeStored('ent-s-fiches-agents', merged); setFiches(merged); }
    const roster = buildRoster({ students, fiches: merged, teachers });
    if (!(await askConfirm(`Envoyer aux professeurs les ${roster.students.length} élèves et les classes de ${teachers.length} professeur(s) ?${roster.warnings.length ? ` Attention : ${roster.warnings.length} point(s) à vérifier (affichés ensuite).` : ''}`))) return;
    setBusy(true); setMsg(''); setErr('');
    const { error } = await supabase.from('ent_doc').upsert({ key: 'roster', kind: 'ROSTER', owner: null, value: roster });
    setBusy(false);
    if (error) { setErr(`Envoi impossible : ${error.message}. Avez-vous lancé le script 30_carnets.sql dans Supabase ?`); return; }
    setMsg(`Classes envoyées : les professeurs les verront à leur prochaine connexion (ou en rechargeant la page).${Object.keys(auto).length ? ` Enseignements remplis automatiquement depuis votre import pour ${Object.keys(auto).length} fiche(s) : vérifiez-les dans Gestion des agents.` : ''}`);
    load();
  };

  const roster = data?.roster;
  // matières partagées (même matière, même classe, deux professeurs) : poids et nom sur le bulletin
  const [shares, setShares] = useState(() => readStored(SHARES_KEY) ?? {});
  const sharedGroups = sharedSubjects(roster, fiches);
  const setShare = (key, tid, patch) => { const next = { ...shares, [key]: { ...(shares[key] ?? {}), [tid]: { ...shareOf(shares, key, tid, sharedGroups), ...patch } } }; writeStored(SHARES_KEY, next); setShares(next); };
  const rows = teachers.map((t) => ({ ...t, carnet: data?.carnets?.[t.id]?.value ?? null, at: data?.carnets?.[t.id]?.updated_at, services: servicesFor(roster, t.id) }));
  const exportAll = () => saveFile(`notes-recues-${new Date().toISOString().slice(0, 10)}.xlsx`, notesWorkbook(rows.filter((r) => r.carnet)));

  const actFor = async (r) => {
    setErr('');
    try { setCurrentRoster(roster); await loadRemoteCarnet(r.id); setActingFor({ id: r.id, name: r.name }); window.scrollTo(0, 0); }
    catch (e) { setErr(`Carnet de ${r.name} illisible pour l'instant (${e.message}). Réessayez.`); }
  };
  if (actingFor) return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
        <span>Vous saisissez les notes <strong>à la place de {actingFor.name}</strong> : tout est enregistré dans son carnet, sur le serveur.</span>
        <Button variant="secondary" className="!py-1 text-xs" onClick={() => { setActingFor(null); load(); }}>← Retour à Notes reçues</Button>
      </div>
      <GradebookModule key={actingFor.id} settings={settings} go={go} />
    </div>
  );

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-semibold text-navy-500">Pédagogie · en ligne</p>
        <h1 className="text-2xl font-semibold text-navy-900">Notes reçues</h1>
        <p className="text-sm text-slate-600">Ce que chaque professeur a saisi, en direct. Les notes sont sur le serveur dès leur saisie ; un historique garde les versions précédentes.</p>
      </div>
      {err && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{err}</p>}
      {msg && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{msg}</p>}

      <Card title="1. Classes envoyées aux professeurs" subtitle="Élèves de votre import + matières et classes de chaque professeur. Une fiche sans enseignements est remplie toute seule depuis l'onglet 3 Personnel de votre import. À refaire après un nouvel import ou une fiche modifiée.">
        <p className="text-sm text-slate-700">{roster ? <>Dernier envoi : <strong>{when(roster.sentAt)}</strong> · {roster.students.length} élèves</> : <strong className="text-amber-800">Pas encore envoyé : les professeurs ne voient aucune classe.</strong>}</p>
        {roster?.warnings?.length > 0 && <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-amber-800">{roster.warnings.map((w) => <li key={w}>{w}</li>)}</ul>}
        <Button className="mt-3" disabled={busy || !data} onClick={() => send(false)}>{busy ? 'Envoi…' : roster ? 'Renvoyer les classes' : 'Envoyer les classes aux professeurs'}</Button>
        <Button variant="secondary" className="ml-2 mt-3" disabled={busy || !data} onClick={() => send(true)}>Recalculer toutes les fiches depuis l'import</Button>
      </Card>

      {sharedGroups.length > 0 && (
        <Card title="Matières partagées entre deux professeurs" subtitle="Une seule ligne au bulletin. La moyenne tient compte du poids de chacun (par exemple le nombre d'heures) ; seuls les noms cochés figurent sur le bulletin.">
          <ul className="divide-y divide-slate-100 text-sm">
            {sharedGroups.map((g) => (
              <li key={g.key} className="py-2">
                <p className="font-medium text-slate-900">{g.cls} · {g.subject}</p>
                <div className="mt-1 flex flex-wrap gap-3">
                  {g.teachers.map((t) => { const v = shareOf(shares, g.key, t.id, sharedGroups); return (
                    <span key={t.id} className="flex items-center gap-2 rounded-lg bg-slate-50 px-2 py-1">
                      <span>{t.name}</span>
                      <label className="flex items-center gap-1 text-xs text-slate-600">poids<input inputMode="numeric" value={v.weight} onChange={(e) => setShare(g.key, t.id, { weight: Number(e.target.value.replace(/[^\d]/g, '')) || 0 })} className="w-10 rounded border border-slate-300 px-1 py-0.5 text-center text-sm" aria-label={`Poids de ${t.name}`} /></label>
                      <label className="flex items-center gap-1 text-xs text-slate-600"><input type="checkbox" checked={v.shown} onChange={(e) => setShare(g.key, t.id, { shown: e.target.checked })} />sur le bulletin</label>
                    </span>
                  ); })}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card title="2. Saisies des professeurs" subtitle="Notes saisies / notes attendues (élèves × devoirs)"
        action={<div className="flex gap-2"><Button variant="secondary" className="!py-1 text-xs" onClick={load}>Actualiser</Button><Button className="!py-1 text-xs" disabled={!rows.some((r) => r.carnet)} onClick={exportAll}>Exporter en Excel</Button></div>}>
        {!data ? <p className="text-sm text-slate-600">Chargement…</p> : rows.length === 0 ? <p className="text-sm text-slate-600">Aucun professeur avec un compte.</p> : (
          <div className="space-y-4">
            {rows.map((r) => (
              <div key={r.id} className="rounded-lg border border-slate-200 p-3">
                <p className="flex flex-wrap items-center justify-between gap-2 text-sm"><strong className="text-slate-900">{r.name}</strong>
                  <span className="flex items-center gap-2 text-xs text-slate-500">{r.carnet ? `dernière saisie : ${when(r.at)}` : 'pas encore commencé'}
                    {r.services.length > 0 && roster && <Button variant="secondary" className="!py-0.5 text-xs" onClick={() => actFor(r)}>Saisir à sa place</Button>}</span></p>
                {r.services.length === 0 ? <p className="mt-1 text-xs text-amber-800">Aucune classe : son nom n'a pas été trouvé dans l'onglet 3 Personnel de l'import. Ajoutez ses enseignements sur sa fiche (Gestion des agents) puis renvoyez les classes.</p> : (
                  <ul className="mt-2 divide-y divide-slate-100 text-sm">
                    {r.services.map((s) => {
                      const x = serviceSummary(r.carnet, s);
                      return (
                        <li key={s.id} className="flex flex-wrap items-center gap-2 py-1.5">
                          <span className="min-w-[12rem] flex-1 text-slate-800">{s.cls} · {s.subject} <span className="text-xs text-slate-500">({s.students.length} élèves)</span>{s.shared && <span className="ml-1"><Badge tone="violet">partagée avec {s.coTeachers.join(', ')} · 2 notes min.</Badge></span>}</span>
                          <span className="text-xs text-slate-600">{x.evaluations} devoir{x.evaluations > 1 ? 's' : ''} · {x.got}/{x.expected} notes</span>
                          <Badge tone={x.competencies ? 'emerald' : 'slate'}>{x.competencies ? 'compétences ✓' : 'compétences —'}</Badge>
                          {x.validated && <Badge tone="emerald">validé</Badge>}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
        <p className="mt-3 text-xs text-slate-500">Conseil : exportez chaque vendredi et gardez le fichier sur votre ordinateur. Vous n'aurez jamais à redemander les notes aux professeurs.</p>
      </Card>
    </div>
  );
}
