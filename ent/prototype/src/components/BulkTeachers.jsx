import React, { useMemo, useState } from 'react';
import { Badge, Button, Card } from './ui.jsx';
import { ASSIGNMENTS } from '../data/staffAssignments.js';
import { loadImport } from '../importStore.js';
import { loginFor } from '../rules/logins.js';
import { printOnly } from '../print.js';
import { matchTeacher } from '../rules/teacherMatch.js';

// Création groupée des comptes professeurs : la Direction colle la liste « NOM Prénoms » ; chaque ligne est
// rapprochée du professeur de l'emploi du temps (« M. Fortuna » ↔ PIERRE Valentin Fortuna). Le prénom
// d'usage sert à l'identifiant, les matières et classes de l'emploi du temps remplissent la fiche.
const assignments = () => (loadImport()?.assignments?.length ? loadImport().assignments : ASSIGNMENTS);

export default function BulkTeachers({ existingLogins = [], create, onDone }) {
  const [text, setText] = useState('');
  const [skip, setSkip] = useState({});
  const [busy, setBusy] = useState(false); const [done, setDone] = useState(null); const [err, setErr] = useState('');
  const rows = useMemo(() => {
    const taken = new Set(existingLogins);
    return text.split('\n').map((l) => l.trim()).filter(Boolean).map((line, i) => {
      const m = matchTeacher(line, assignments());
      const login = loginFor(m.usual, m.last, taken); taken.add(login);
      return { i, line, ...m, login };
    });
  }, [text, existingLogins]);
  const chosen = rows.filter((r) => !skip[r.i] && r.last && r.first);
  const go = async () => {
    setBusy(true); setErr(''); const out = [];
    for (const r of chosen) {
      try { out.push({ ...(await create(r)), name: `${r.civility === 'Madame' ? 'Mme' : 'M.'} ${r.usual} ${r.last}`, teacher: r.teacher }); } catch (x) { out.push({ name: r.line, error: x.message }); }
    }
    setDone(out); setBusy(false); onDone?.();
  };
  const url = window.location.href.split('#')[0];
  if (done) return (
    <Card title={`Comptes créés (${done.filter((d) => !d.error).length})`} subtitle="Une fiche par professeur, à découper et remettre en main propre">
      {done.some((d) => d.error) && <ul className="mb-3 rounded-lg bg-red-50 p-2 text-xs text-red-800">{done.filter((d) => d.error).map((d) => <li key={d.name}>{d.name} : {d.error}</li>)}</ul>}
      <div className="bulk-slips grid gap-2 sm:grid-cols-2" style={{ fontFamily: 'Poppins, sans-serif' }}>
        {done.filter((d) => !d.error).map((s) => (
          <div key={s.login} style={{ border: '1px dashed #000', padding: '10px', fontSize: '11px', breakInside: 'avoid', color: '#000' }}>
            <p style={{ fontWeight: 700 }}>ENT Chateaubriand — vos accès</p>
            <p style={{ marginTop: 4 }}>{s.name}</p>
            <p style={{ marginTop: 4 }}>Adresse : <strong>{url}</strong></p>
            <p>Identifiant : <strong style={{ fontFamily: 'monospace', fontSize: 14 }}>{s.login}</strong></p>
            <p>Code provisoire : <strong style={{ fontFamily: 'monospace', fontSize: 14 }}>{s.code}</strong></p>
            <p style={{ marginTop: 4, fontSize: 9.5 }}>À la première connexion, choisissez votre propre code (8 caractères, lettres et chiffres). Ne le communiquez à personne.</p>
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <Button onClick={() => printOnly('.bulk-slips', 'size: A4 portrait; margin: 10mm;', 'Accès ENT — professeurs')}>Imprimer toutes les fiches</Button>
        <Button variant="secondary" onClick={() => { setDone(null); setText(''); }}>Terminé</Button>
      </div>
      <p className="mt-2 text-xs text-amber-700">Imprimez maintenant : les codes provisoires ne sont plus affichés ensuite (bouton « Nouveau code » si besoin).</p>
    </Card>
  );
  return (
    <Card title="Créer les comptes des professeurs (liste)" subtitle="Collez la liste « NOM Prénoms », une personne par ligne. Chacun est rapproché de l'emploi du temps : matières et classes sont reprises.">
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} placeholder={'PIERRE Valentin Fortuna\nHASSANALY Issac'} className="w-full rounded-lg border border-slate-300 p-2 font-mono text-sm" />
      {rows.length > 0 && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead><tr className="border-b text-left text-xs text-slate-500"><th className="py-1.5" /><th>Nom</th><th>Prénom(s)</th><th>Dans l'emploi du temps</th><th>Identifiant</th><th>Matières</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.i} className="border-b border-slate-100 align-top">
                  <td className="py-1.5 pr-2"><input type="checkbox" aria-label={`Créer ${r.line}`} checked={!skip[r.i]} onChange={() => setSkip({ ...skip, [r.i]: !skip[r.i] })} /></td>
                  <td className="pr-2 font-medium">{r.last}</td>
                  <td className="pr-2">{r.first}{r.usual !== r.first.split(/\s+/)[0] && <span className="block text-xs text-slate-500">d'usage : {r.usual}</span>}</td>
                  <td className="pr-2">{r.teacher ?? <Badge tone="amber">non trouvé</Badge>}</td>
                  <td className="pr-2 font-mono text-xs">{r.login}</td>
                  <td className="text-xs text-slate-600">{r.services.map((s) => `${s.subject} (${s.classes.join(', ')})`).join(' · ') || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-1 text-xs text-slate-500">« Non trouvé » : le compte est créé quand même, sans matières ; complétez sa fiche ensuite. Décochez une ligne pour ne pas la créer.</p>
        </div>
      )}
      {err && <p className="mt-2 text-sm text-red-700">{err}</p>}
      <Button className="mt-3" disabled={!chosen.length || busy} onClick={go}>{busy ? 'Création en cours…' : `Créer ${chosen.length} compte${chosen.length > 1 ? 's' : ''}`}</Button>
    </Card>
  );
}
