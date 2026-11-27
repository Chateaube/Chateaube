import React, { useEffect, useState } from 'react';
import { Badge, Button, Card } from './ui.jsx';
import { supabase } from '../online/client.js';
import { fetchDocs, fetchDoc } from '../online/docs.js';
import { buildRoster, servicesFor, setCurrentRoster, isShareable, fetchRoster, ownerOf, writerOf } from '../online/roster.js';
import { loadRemoteCarnet } from '../gradebookStore.js';
import GradebookModule from './GradebookModule.jsx';
import AbsentAtTests from './AbsentAtTests.jsx';
import { loadImport, currentStudents } from '../importStore.js';
import { readStored, writeStored } from '../persist.js';
import { matchTeacher, refineByTimetable, timetableAssignments } from '../rules/teacherMatch.js';
import { sameSubject } from '../rules/timetableImport.js';
import { buildXlsx } from '../xlsx.js';
import { saveFile } from '../download.js';
import { askConfirm } from './Dialogs.jsx';
import { CASH_ACCOUNTS } from './CollectPayment.jsx';

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

/** Matières partagées d'après la liste envoyée : [{ key, cls, subject, teachers: [{ id, name, hours }] }]. */
/** Professeur sur le bulletin : civilité + prénom d'usage (« Mme Mirana »), d'après sa fiche. */
export function teacherLabel(fiche, u) {
  const civ = { Madame: 'Mme', Monsieur: 'M.', Mademoiselle: 'Mlle' }[fiche?.civility] ?? '';
  const first = (fiche?.usual || String(fiche?.first || u?.first_name || '').trim().split(/\s+/)[0] || '').trim();
  return `${civ} ${first}`.trim();
}
export function sharedSubjects(roster, fiches = {}) {
  const by = {};
  Object.entries(roster?.services ?? {}).forEach(([id, list]) => list.forEach((s) => s.classes.forEach((cls) => {
    const key = `${cls}|${s.subject}`;
    const hours = Number((fiches[id]?.services ?? []).find((x) => x.subject === s.subject && x.classes?.includes(cls))?.hours) || 0;
    (by[key] ??= { key, cls, subject: s.subject, teachers: [] }).teachers.push({ id, name: roster.names?.[id] ?? id, hours });
  })));
  // classe déjà confiée à un seul professeur (roster.owners) : plus de conflit
  return Object.values(by).filter((g) => g.teachers.length > 1 && !ownerOf(roster, g.key));
}

export default function NotesReceived({ settings, go }) {
  const [actingFor, setActingFor] = useState(null); // { id, name } : la Direction saisit les notes de ce professeur
  const [data, setData] = useState(null); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState('');
  const load = async () => {
    setErr('');
    try {
      const [carnets, roster, users] = await Promise.all([
        fetchDocs('CARNET'), fetchRoster(),
        supabase.from('app_user').select('id, first_name, last_name, is_active, user_role(role)').order('last_name').then(({ data: d, error }) => { if (error) throw new Error(error.message); return d; }),
      ]);
      setData({ carnets: Object.fromEntries(carnets.map((c) => [c.owner, c])), roster: roster?.value ?? null, users });
    } catch (e) { setErr(`Lecture impossible pour l'instant (${e.message}). Réessayez.`); }
  };
  useEffect(() => { load(); }, []);

  const [fiches, setFiches] = useState(() => readStored('ent-s-fiches-agents') ?? {});
  // le personnel seulement : jamais un compte élève ou parent (un élève prénommé comme un professeur n'est pas un professeur)
  const isStaff = (u) => (u.user_role ?? []).some((r) => !['ELEVE', 'PARENT'].includes(r.role));
  const staff = (data?.users ?? []).filter((u) => u.is_active && isStaff(u)).map((u) => ({ id: u.id, name: `${u.first_name} ${u.last_name}`.trim(), first: teacherLabel(fiches[u.id], u), line: `${u.last_name} ${u.first_name}`.trim(), prof: (u.user_role ?? []).some((r) => r.role === 'PROFESSEUR') }));
  const teachers = (data?.users ?? []).filter((u) => u.is_active && isStaff(u) && ((u.user_role ?? []).some((r) => r.role === 'PROFESSEUR') || fiches[u.id]?.services?.length))
    .map((u) => ({ id: u.id, name: `${u.first_name} ${u.last_name}`.trim(), line: `${u.last_name} ${u.first_name}`.trim() }));
  const students = currentStudents();

  const send = async (recompute = false) => {
    if (!students.length) { setErr('Aucun élève importé sur cet appareil : importez d\'abord le modèle Excel (Réglages › Import), depuis cet ordinateur.'); return; }
    // fiches sans enseignements : remplies depuis l'import (onglet 3 Personnel / emploi du temps), puis gardées sur la fiche
    const list = loadImport()?.assignments ?? [];
    const auto = {};
    if (recompute && !(await askConfirm('Recalculer les matières et classes de TOUTES les fiches depuis l\'import (onglet 3 + emploi du temps) ? Les corrections faites à la main sur les fiches seront remplacées.'))) return;
    const slots = loadImport()?.timetable ?? [];
    // tout le personnel (une personne de la Direction peut enseigner, ex. Arts plastiques) ; l'emploi du temps
    // complète l'onglet 3 (professeur ou classe oubliés)
    const sources = [...list, ...timetableAssignments(slots)];
    const matched = new Set(); const added = [];
    staff.forEach((t) => {
      const m = matchTeacher(t.line, sources);
      if (!m.teacher || !m.services.length) return;
      matched.add(m.teacher);
      const current = (fiches[t.id]?.services ?? []).filter((x) => x.subject && x.classes?.length);
      const same = (a, b) => sameSubject(a, b) || sameSubject(b, a);
      let next;
      if (recompute || !current.length) next = refineByTimetable(m.services, m.teacher, slots);
      else {
        // fiche déjà remplie : on ajoute seulement ce que l'emploi du temps montre en plus (jamais de retrait)
        next = current.map((x) => ({ ...x, classes: [...x.classes] }));
        slots.filter((sl) => sl.teacherId === m.teacher && !/parcours d.?ouverture|vie de classe/i.test(sl.subject)).forEach((sl) => {
          const ex = next.find((x) => same(x.subject, sl.subject));
          if (!ex) next.push({ subject: sl.subject, classes: [sl.cls], hours: '' }); else if (!ex.classes.includes(sl.cls)) ex.classes.push(sl.cls);
        });
      }
      const pairs = (list) => list.flatMap((x) => x.classes.map((c) => `${x.subject} ${c}`));
      const before = new Set(pairs(current)); const gained = pairs(next).filter((p) => !before.has(p));
      if (gained.length || recompute) { auto[t.id] = { ...(fiches[t.id] ?? {}), services: next }; if (gained.length) added.push(`${t.name} : ${gained.join(', ')}`); }
    });
    const unmatched = [...new Set(timetableAssignments(slots).map((a) => a.name))].filter((n) => !matched.has(n));
    const merged = { ...fiches, ...auto };
    if (Object.keys(auto).length) { writeStored('ent-s-fiches-agents', merged); setFiches(merged); }
    const sendTo = staff.filter((t) => t.prof || merged[t.id]?.services?.length);
    // les classes déjà confiées à un seul professeur restent confiées
    // élève arrivé en cours d'année (date d'entrée, sinon paiement de l'inscription) : le professeur se voit proposer
    // « NN » pour les devoirs faits avant son arrivée
    const arrivals = new Map([...CASH_ACCOUNTS].filter((a) => a.enrolledOn > '2026-09-01').map((a) => [a.id, a.enrolledOn]));
    const withArrival = students.map((st) => ({ ...st, arrivedOn: arrivals.get(st.id) ?? (st.enteredOn > '2026-09-05' ? st.enteredOn : '') }));
    const roster = { ...buildRoster({ students: withArrival, fiches: merged, teachers: sendTo }), owners: data?.roster?.owners ?? {}, writers: data?.roster?.writers ?? {} };
    if (!(await askConfirm(`Envoyer aux professeurs les ${roster.students.length} élèves et les classes de ${sendTo.length} professeur(s) ?${roster.warnings.length ? ` Attention : ${roster.warnings.length} point(s) à vérifier (affichés ensuite).` : ''}`))) return;
    setBusy(true); setMsg(''); setErr('');
    const { error } = await supabase.from('ent_doc').upsert({ key: 'roster', kind: 'ROSTER', owner: null, value: roster });
    setBusy(false);
    if (error) { setErr(`Envoi impossible : ${error.message}. Avez-vous lancé le script 30_carnets.sql dans Supabase ?`); return; }
    setMsg(`Classes envoyées : les professeurs les verront à leur prochaine connexion (ou en rechargeant la page).${added.length ? ` Ajouté depuis votre import : ${added.join(' ; ')}.` : ''}${unmatched.length ? ` Dans l'emploi du temps mais sans compte trouvé (créez le compte, puis renvoyez) : ${unmatched.join(', ')}.` : ''}`);
    load();
  };

  const roster = data?.roster;
  // même matière dans la même classe chez deux professeurs : Enseignement scientifique (normal), sinon à corriger
  const sharedGroups = sharedSubjects(roster, fiches);
  const conflicts = sharedGroups.filter((g) => !isShareable(g.subject));
  const sharedOk = sharedGroups; // ES et classes communes : qui écrit l'appréciation ?
  const rows = teachers.map((t) => ({ ...t, carnet: data?.carnets?.[t.id]?.value ?? null, at: data?.carnets?.[t.id]?.updated_at, services: servicesFor(roster, t.id) }));
  const exportAll = () => saveFile(`notes-recues-${new Date().toISOString().slice(0, 10)}.xlsx`, notesWorkbook(rows.filter((r) => r.carnet)));

  // matière partagée : un seul professeur écrit l'appréciation du bulletin
  const chooseWriter = async (g, t) => {
    if (!(await askConfirm(`${g.cls} · ${g.subject} : l'appréciation du bulletin sera écrite par ${t.name} seulement ? Les notes restent partagées (50/50).`))) return;
    setBusy(true); setErr('');
    const latest = (await fetchDoc('roster'))?.value ?? roster;
    const { error } = await supabase.from('ent_doc').upsert({ key: 'roster', kind: 'ROSTER', owner: null, value: { ...latest, writers: { ...(latest.writers ?? {}), [g.key]: t.id } } });
    setBusy(false);
    if (error) { setErr(`Enregistrement impossible : ${error.message}`); return; }
    setMsg(`${g.cls} · ${g.subject} : appréciation écrite par ${t.name}.`);
    load();
  };
  // confier la classe à un seul professeur (même matière chez deux professeurs)
  const entrust = async (g, t) => {
    const others = g.teachers.filter((x) => x.id !== t.id).map((x) => x.name).join(', ');
    if (!(await askConfirm(`${g.cls} · ${g.subject} : confier la saisie des notes à ${t.name} ? La classe disparaîtra chez ${others}, et seul ${t.name} sera sur le bulletin.`))) return;
    setBusy(true); setErr('');
    const latest = (await fetchDoc('roster'))?.value ?? roster;
    const { error } = await supabase.from('ent_doc').upsert({ key: 'roster', kind: 'ROSTER', owner: null, value: { ...latest, owners: { ...(latest.owners ?? {}), [g.key]: t.id } } });
    setBusy(false);
    if (error) { setErr(`Enregistrement impossible : ${error.message}`); return; }
    setMsg(`${g.cls} · ${g.subject} : confiée à ${t.name}.`);
    load();
  };
  const actFor = async (r) => {
    setErr('');
    try { setCurrentRoster(roster); await loadRemoteCarnet(r.id); setActingFor({ id: r.id, name: r.name }); window.scrollTo(0, 0); }
    catch (e) { setErr(`Carnet de ${r.name} illisible pour l'instant (${e.message}). Réessayez.`); }
  };
  if (actingFor) return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
        <span>Carnet de <strong>{actingFor.name}</strong> : consulter ne change rien. Une note que vous saisissez s'ajoute à son carnet, sans effacer ce qu'il saisit de son côté.</span>
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

      {conflicts.length > 0 && (
        <Card title="Classes communes (deux professeurs, même matière)" subtitle="Chacun saisit ses évaluations ; une seule moyenne sur toutes les évaluations, et le minimum se compte à deux. Vous pouvez aussi confier la classe à un seul professeur.">
          <ul className="space-y-2 text-sm text-amber-900">{conflicts.map((g) => (
            <li key={g.key} className="rounded-lg bg-amber-50 px-3 py-2">
              <p>⚠ <strong>{g.cls} · {g.subject}</strong> : {g.teachers.map((t) => t.name).join(' et ')}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <span className="text-xs">Confier à un seul professeur (facultatif) :</span>
                {g.teachers.map((t) => {
                                    const notes = (data?.carnets?.[t.id]?.value?.evaluations?.[g.key] ?? []).length;
                  return <Button key={t.id} variant="secondary" className="!px-2 !py-1 text-xs" disabled={busy} onClick={() => entrust(g, t)}>{t.name} seul·e{notes ? ` · ${notes} évaluation${notes > 1 ? 's' : ''}` : ''}</Button>;
                })}
              </div>
            </li>
          ))}</ul>
          <p className="mt-2 text-xs text-slate-600">La classe disparaît alors chez l'autre professeur et un seul nom va sur le bulletin. Sans choix, la classe reste commune aux deux.</p>
        </Card>
      )}

      {sharedOk.length > 0 && (
        <Card title="Classes à deux professeurs : qui écrit l'appréciation ?" subtitle="Une seule appréciation sur le bulletin : le premier qui l'écrit, ou le professeur choisi ici">
          <ul className="space-y-2 text-sm">{sharedOk.map((g) => {
            const w = writerOf(roster, g.key);
            return (
              <li key={g.key} className="rounded-lg bg-violet-50 px-3 py-2 text-violet-950">
                <p><strong>{g.cls} · {g.subject}</strong> : {g.teachers.map((t) => t.name).join(' et ')}{w ? <> — appréciation : <strong>{g.teachers.find((t) => t.id === w)?.name ?? '?'}</strong></> : <span className="text-amber-800"> — à choisir</span>}</p>
                <div className="mt-1.5 flex flex-wrap gap-2">{g.teachers.map((t) => {
                  const asked = Boolean(roster?.claims?.[t.id]?.[`app:${g.key}`]);
                  return <Button key={t.id} variant={w === t.id || asked ? undefined : 'secondary'} className="!px-2 !py-1 text-xs" disabled={busy || w === t.id} onClick={() => chooseWriter(g, t)}>{t.name}{w === t.id ? ' ✓' : asked ? ' (a commencé)' : ''}</Button>;
                })}</div>
              </li>
            );
          })}</ul>
        </Card>
      )}

      <Card title="2. Saisies des professeurs" subtitle="Notes saisies / notes attendues (élèves × évaluations)"
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
                          <span className="min-w-[12rem] flex-1 text-slate-800">{s.cls} · {s.subject} <span className="text-xs text-slate-500">({s.students.length} élèves)</span>{s.shared && <span className="ml-1"><Badge tone="violet">partagée avec {s.coTeachers.join(', ')} · 50/50 · 2 notes min.</Badge></span>}{s.conflict && <span className="ml-1"><Badge tone="amber">aussi chez {s.conflict.join(', ')} : à corriger</Badge></span>}</span>
                          <span className="text-xs text-slate-600">{x.evaluations} évaluation{x.evaluations > 1 ? 's' : ''} · {x.got}/{x.expected} notes</span>
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
      <AbsentAtTests embedded />
    </div>
  );
}
