import React, { useEffect, useMemo, useState } from 'react';
import { Button, Card } from './ui.jsx';
import { fetchDoc, fetchDocs } from '../online/docs.js';

// « Absents aux devoirs » (Direction et secrétariat, version en ligne) : tous les « ABS » saisis par les
// professeurs dans leurs carnets, pour organiser les rattrapages et vérifier les justificatifs.
// Rien n'est envoyé aux familles.
const isAbs = (v) => String(v ?? '').trim().toUpperCase() === 'ABS';
const ddmmyyyy = (iso) => (iso ? iso.split('-').reverse().join('/') : '—');

/** Lignes { date, student, cls, subject, title, teacher } à partir des carnets et des noms des professeurs. */
export function absencesAtTests(carnets = [], names = {}) {
  return carnets.flatMap((c) => Object.entries(c.value?.evaluations ?? {}).flatMap(([sid, evs]) => {
    const [cls, subject] = sid.split('|');
    const g = c.value?.grades?.[sid] ?? {};
    return (evs ?? []).filter((e) => !e.fromMockExam).flatMap((e) => Object.entries(g).filter(([, marks]) => isAbs(marks?.[e.id]))
      .map(([student]) => ({ key: `${c.owner}|${sid}|${e.id}|${student}`, date: e.date, student, cls: cls ?? '', subject: subject ?? '', title: e.title || e.type, teacher: names[c.owner] ?? '' })));
  })).sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '') || a.student.localeCompare(b.student, 'fr'));
}

export default function AbsentAtTests({ embedded = false }) {
  const [rows, setRows] = useState(null); const [err, setErr] = useState(''); const [cls, setCls] = useState('');
  const load = async () => {
    setErr('');
    try { const [carnets, roster] = await Promise.all([fetchDocs('CARNET'), fetchDoc('roster')]); setRows(absencesAtTests(carnets, roster?.value?.names ?? {})); }
    catch (e) { setErr(`Lecture impossible pour l'instant (${e.message}).`); }
  };
  useEffect(() => { load(); }, []);
  const classes = useMemo(() => [...new Set((rows ?? []).map((r) => r.cls))].sort(), [rows]);
  const shown = (rows ?? []).filter((r) => !cls || r.cls === cls);
  const card = (
    <Card title={`Absents aux devoirs${rows ? ` (${shown.length})` : ''}`} subtitle="Les « ABS » saisis par les professeurs : pour organiser les rattrapages et vérifier les justificatifs. Rien n'est envoyé aux familles."
      action={<div className="flex gap-2">
        <select value={cls} onChange={(e) => setCls(e.target.value)} aria-label="Classe" className="rounded-lg border border-slate-300 px-2 py-1 text-xs"><option value="">Toutes les classes</option>{classes.map((c) => <option key={c}>{c}</option>)}</select>
        <Button variant="secondary" className="!py-1 text-xs" onClick={load}>Actualiser</Button></div>}>
      {err && <p role="alert" className="text-sm text-red-800">{err}</p>}
      {!rows && !err ? <p className="text-sm text-slate-600">Chargement…</p> : shown.length === 0 ? <p className="text-sm text-slate-600">Aucune absence à un devoir.</p> : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead><tr className="border-b text-left text-xs text-slate-500"><th className="py-1.5">Date</th><th>Élève</th><th>Classe</th><th>Matière</th><th>Devoir</th><th>Professeur</th></tr></thead>
            <tbody>{shown.map((r) => (
              <tr key={r.key} className="border-b border-slate-100"><td className="py-1.5 tabular-nums">{ddmmyyyy(r.date)}</td><td className="font-medium">{r.student}</td><td>{r.cls}</td><td>{r.subject}</td><td>{r.title}</td><td className="text-slate-600">{r.teacher}</td></tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </Card>
  );
  if (embedded) return card;
  return (
    <div className="space-y-5">
      <div><p className="text-sm font-semibold text-navy-500">Notes · en ligne</p><h1 className="text-2xl font-semibold text-navy-900">Absents aux devoirs</h1></div>
      {card}
    </div>
  );
}
