import React, { useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card } from './ui.jsx';
import { supabase } from '../online/client.js';
import { fetchDocs, fetchDoc } from '../online/docs.js';
import { servicesFor, shortName, setCurrentRoster } from '../online/roster.js';
import { checkAppreciation, autoFix } from '../rules/appreciation.js';
import { buildXlsx } from '../xlsx.js';
import { readXlsx, sheetRows } from '../xlsxRead.js';
import { saveFile } from '../download.js';

// Relecture des appréciations (Direction) : toutes les appréciations d'une classe sur un seul écran, pour corriger
// sans ouvrir chaque élève. Les corrections sont gardées à part (document « corrections ») : le carnet du
// professeur n'est pas modifié, le bulletin prend la version corrigée. Aller-retour Excel possible.
const ORDER = ['6e', '5e', '4e', '3e', '2de', '1re STMG', '1re Générale', 'Terminale STMG', 'Terminale Générale'];
import { correctionKey, finalText } from '../rules/onlineBulletins.js';

export default function AppreciationsReview() {
  const [data, setData] = useState(null); const [err, setErr] = useState(''); const [msg, setMsg] = useState('');
  const [cls, setCls] = useState(''); const [subject, setSubject] = useState('');
  const [edits, setEdits] = useState({}); // clé → texte modifié (non enregistré)
  const [busy, setBusy] = useState(false); const [onlyIssues, setOnlyIssues] = useState(false);
  const load = async () => {
    setErr('');
    try {
      const [carnets, roster, corr] = await Promise.all([fetchDocs('CARNET'), fetchDoc('roster'), fetchDoc('corrections')]);
      setCurrentRoster(roster?.value ?? null);
      setData({ carnets: Object.fromEntries(carnets.map((c) => [c.owner, c.value])), roster: roster?.value ?? null, corrections: corr?.value ?? {} });
    } catch (e) { setErr(`Lecture impossible (${e.message}).`); }
  };
  useEffect(() => { load(); }, []);

  const classes = useMemo(() => [...new Set((data?.roster?.students ?? []).map((s) => s.cls))].sort((a, b) => ((ORDER.indexOf(a) + 1) || 99) - ((ORDER.indexOf(b) + 1) || 99)), [data]);
  const theClass = cls || classes[0] || '';
  const rows = useMemo(() => {
    if (!data?.roster) return [];
    return Object.keys(data.roster.services ?? {}).flatMap((tid) => servicesFor(data.roster, tid).filter((s) => s.cls === theClass).flatMap((s) => s.students.map((st) => {
      const original = data.carnets[tid]?.comments?.[`${s.id}:${st}`]?.text ?? '';
      const key = correctionKey(tid, s.id, st); const corr = data.corrections[key];
      return { key, tid, sid: s.id, student: st, subject: s.subject, teacher: data.roster.names?.[tid] ?? '', original, corr, stale: corr && (corr.original ?? '') !== original };
    }))).sort((a, b) => a.student.localeCompare(b.student, 'fr') || a.subject.localeCompare(b.subject, 'fr'));
  }, [data, theClass]);
  const subjects = [...new Set(rows.map((r) => r.subject))].sort();
  const valueOf = (r) => edits[r.key] ?? finalText(r.original, r.corr);
  const issuesOf = (r) => { const t = valueOf(r); return t.trim() ? checkAppreciation(t, { tutoiement: true }).errors.length : 0; };
  const shown = rows.filter((r) => (!subject || r.subject === subject) && (!onlyIssues || !valueOf(r).trim() || issuesOf(r) > 0 || r.stale));
  const changed = Object.keys(edits).length;

  const fixAll = () => {
    const next = { ...edits };
    shown.forEach((r) => { const v = valueOf(r); if (v.trim() && autoFix(v) !== v) next[r.key] = autoFix(v); });
    setEdits(next); setMsg(`${Object.keys(next).length - changed} appréciation(s) corrigée(s) automatiquement (espaces, majuscule, point final). Relisez puis enregistrez.`);
  };
  const save = async () => {
    setBusy(true); setErr(''); setMsg('');
    try {
      const latest = (await fetchDoc('corrections'))?.value ?? {};
      const byKey = Object.fromEntries(rows.map((r) => [r.key, r]));
      const next = { ...latest };
      Object.entries(edits).forEach(([k, text]) => { const r = byKey[k]; if (!r) return; if (text === r.original) delete next[k]; else next[k] = { text, original: r.original, at: new Date().toISOString() }; });
      const { error } = await supabase.from('ent_doc').upsert({ key: 'corrections', kind: 'ROSTER', owner: null, value: next });
      if (error) throw new Error(error.message);
      setEdits({}); setMsg('Corrections enregistrées : le bulletin prendra la version corrigée.'); load();
    } catch (e) { setErr(`Enregistrement impossible (${e.message}).`); }
    setBusy(false);
  };
  const exportXlsx = () => saveFile(`appreciations-${theClass.replace(/\s+/g, '-')}.xlsx`, buildXlsx([{ name: theClass.slice(0, 31) || 'Appréciations', widths: [28, 22, 22, 70, 30],
    rows: [['Élève', 'Matière', 'Professeur', 'Appréciation (à corriger ici)', 'Clé (ne pas modifier)'], ...shown.map((r) => [r.student, r.subject, r.teacher, valueOf(r), r.key])] }]));
  const importXlsx = async (file) => {
    try {
      const book = await readXlsx(await file.arrayBuffer());
      const list = sheetRows(Object.values(book)[0] ?? []);
      const byKey = Object.fromEntries(rows.map((r) => [r.key, r])); const next = { ...edits }; let n = 0;
      list.forEach((x) => { const k = x['Clé (ne pas modifier)']; const t = String(x['Appréciation (à corriger ici)'] ?? '').trim(); const r = byKey[k]; if (r && t && t !== valueOf(r)) { next[k] = t; n += 1; } });
      setEdits(next); setMsg(`${n} appréciation(s) reprise(s) du fichier. Relisez puis enregistrez.`);
    } catch (e) { setErr(`Fichier illisible (${e.message}).`); }
  };

  if (err && !data) return <Card title="Relecture des appréciations"><p className="text-sm text-red-800">{err}</p><Button className="mt-3" onClick={load}>Réessayer</Button></Card>;
  if (!data) return <Card title="Relecture des appréciations"><p className="text-sm text-slate-600">Chargement…</p></Card>;
  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-semibold text-navy-500">Pédagogie · en ligne</p>
        <h1 className="text-2xl font-semibold text-navy-900">Relecture des appréciations</h1>
        <p className="text-sm text-slate-600">Toute une classe sur un écran. Vos corrections sont gardées à part : le bulletin prend la version corrigée, le carnet du professeur n'est pas modifié.</p>
      </div>
      {err && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{err}</p>}
      {msg && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{msg}</p>}
      <Card>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs text-slate-600">Classe<select value={theClass} onChange={(e) => { setCls(e.target.value); setSubject(''); }} className="mt-1 block rounded-lg border border-slate-300 px-2 py-1.5 text-sm">{classes.map((c) => <option key={c}>{c}</option>)}</select></label>
          <label className="text-xs text-slate-600">Matière<select value={subject} onChange={(e) => setSubject(e.target.value)} className="mt-1 block rounded-lg border border-slate-300 px-2 py-1.5 text-sm"><option value="">Toutes</option>{subjects.map((s) => <option key={s}>{s}</option>)}</select></label>
          <label className="flex items-center gap-1.5 pb-2 text-xs text-slate-700"><input type="checkbox" checked={onlyIssues} onChange={(e) => setOnlyIssues(e.target.checked)} />Seulement à revoir</label>
          <span className="ml-auto flex flex-wrap gap-2">
            <Button variant="secondary" className="!py-1 text-xs" onClick={fixAll}>Ponctuation : tout corriger</Button>
            <Button variant="secondary" className="!py-1 text-xs" onClick={exportXlsx}>Exporter en Excel</Button>
            <label className="cursor-pointer rounded-xl px-3 py-1 text-xs font-medium text-navy-700 ring-1 ring-navy-200">Importer les corrections<input type="file" accept=".xlsx" className="hidden" onChange={(e) => e.target.files?.[0] && importXlsx(e.target.files[0])} /></label>
            <Button className="!py-1 text-xs" disabled={!changed || busy} onClick={save}>{busy ? 'Enregistrement…' : `Enregistrer${changed ? ` (${changed})` : ''}`}</Button>
          </span>
        </div>
      </Card>
      <Card title={`${theClass} — ${shown.length} appréciation(s)`}>
        {shown.length === 0 ? <p className="text-sm text-slate-600">Rien à afficher.</p> : (
          <ul className="divide-y divide-slate-100">{shown.map((r, i) => {
            const v = valueOf(r); const n = issuesOf(r); const first = i === 0 || shown[i - 1].student !== r.student;
            return (
              <li key={r.key} className="py-2">
                {first && <p className="mb-1 font-semibold text-navy-900" title={r.student}>{shortName(r.student)}</p>}
                <div className="grid gap-2 sm:grid-cols-[11rem_1fr]">
                  <p className="text-xs text-slate-600">{r.subject}<span className="block text-slate-400">{r.teacher}</span>
                    {!v.trim() ? <Badge tone="slate">vide</Badge> : n ? <Badge tone="amber">{n} point(s) à revoir</Badge> : r.corr && !r.stale ? <Badge tone="violet">corrigée</Badge> : null}
                    {r.stale && <Badge tone="amber">modifiée par le prof après votre correction</Badge>}</p>
                  <textarea rows={2} value={v} onChange={(e) => setEdits({ ...edits, [r.key]: e.target.value })} aria-label={`Appréciation — ${r.student} — ${r.subject}`}
                    className={`w-full resize-y rounded-lg border px-2 py-1.5 text-sm ${edits[r.key] !== undefined ? 'border-violet-300 bg-violet-50/40' : 'border-slate-200'}`} />
                </div>
              </li>
            );
          })}</ul>
        )}
      </Card>
    </div>
  );
}
