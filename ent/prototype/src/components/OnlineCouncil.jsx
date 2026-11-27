import { fetchRoster, shortName } from '../online/roster.js';
import React, { useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card, Stat, StudentSelect } from './ui.jsx';
import { RulePanel } from './gradeUi.jsx';
import { fetchDoc, fetchDocs, saveDoc, onSync } from '../online/docs.js';
import { buildCouncil, councilKey, rosterClasses, shortLabel } from '../rules/onlineCouncil.js';
import { COUNCIL_DECISIONS, fmtAvg } from '../rules/grading.js';
import { COUNCIL_FLAGS, TERM } from '../data/grades.js';
import { GA_STATUS, saveText, saveDecision, submit, validate, sendBack } from '../rules/generalAppreciation.js';
import { checkAppreciation, autoFix } from '../rules/appreciation.js';
import { buildXlsx } from '../xlsx.js';
import { saveFile } from '../download.js';
import { printOnly } from '../print.js';
import { sheetKind } from '../rules/orientationSheet.js';
import CouncilOrientation from './CouncilOrientation.jsx';
import { setSheetOwner } from './OrientationSheet.jsx';
import { studentLabel as sn } from '../studentNames.js';
import { termCarnets } from '../termView.js';

// Conseils de classe en ligne (Direction et secrétariat) : la grille se remplit toute seule avec les notes que
// les professeurs saisissent dans leur carnet. La décision et l'appréciation générale de chaque élève sont
// enregistrées sur le serveur (une fiche par élève) : le secrétariat les tape, la Direction les valide, depuis
// leur propre poste. La moyenne générale reste sur la grille : elle ne va jamais sur le bulletin.
const FLAG = Object.fromEntries(COUNCIL_FLAGS.map((f) => [f.id, f]));
const DECISION = Object.fromEntries(COUNCIL_DECISIONS.map((d) => [d.id, d]));
const tone = (v) => (v == null ? 'text-slate-400' : v < 10 ? 'text-red-700' : v >= 14 ? 'text-emerald-700' : 'text-slate-800');
const flagLine = (f) => `${f.subject} : ${f.flag ? FLAG[f.flag]?.label ?? f.flag : f.note}`;

export default function OnlineCouncil({ settings, role, go }) {
  const isDirection = role === 'DIRECTION';
  const [data, setData] = useState(null); const [err, setErr] = useState('');
  const [cls, setCls] = useState(null);
  const [current, setCurrent] = useState(null);
  const [open, setOpen] = useState(null);
  const [gaNote, setGaNote] = useState(''); const [gaError, setGaError] = useState('');
  const [sync, setSync] = useState(null);
  const load = () => {
    setErr('');
    Promise.all([fetchDocs('CARNET').then(termCarnets), fetchRoster(), fetchDocs('CONSEIL'), fetchDocs('ORIENTATION').catch(() => [])]).then(([carnets, roster, conseil, orientation]) => {
      // fiches d'orientation remplies par les élèves (2de, Terminale) : reprises pour la séance
      orientation.forEach((d) => d.value?.student && setSheetOwner(d.value.student, d.owner, d.value.sheet));
      const r = roster?.value ?? null;
      setData({ carnets: Object.fromEntries(carnets.map((c) => [c.owner, c.value])), roster: r, ga: Object.fromEntries(conseil.map((d) => [d.key, d.value])), at: new Date() });
      setCls((c) => c ?? rosterClasses(r)[0] ?? null);
    }, (e) => setErr(e.message));
  };
  useEffect(load, []);
  useEffect(() => onSync((key, s) => { if (key.startsWith('conseil:')) setSync(s); }), []);

  const council = useMemo(() => (data && cls ? buildCouncil({ cls, roster: data.roster, carnets: data.carnets, defaultMin: settings?.grading?.minEvaluations ?? 4, subjectOrder: settings?.bulletin?.subjectOrder }) : null), [data, cls, settings]);
  if (err) return <Card title="Conseils de classe"><p className="text-sm text-red-800">Les notes n'ont pas pu être lues ({err}). Vérifiez la connexion.</p><Button className="mt-3" onClick={load}>Réessayer</Button></Card>;
  if (!data) return <Card title="Conseils de classe"><p className="text-sm text-slate-600">Chargement des notes des professeurs…</p></Card>;
  if (!data.roster || !cls) return <Card title="Conseils de classe"><p className="text-sm text-slate-700">Les classes n'ont pas encore été envoyées aux professeurs (Direction : Notes reçues › Envoyer les classes).</p></Card>;

  const { rows, subjects, entries, classAvg, generalStats } = council;
  // grille imprimée : initiale du nom + prénom d'usage (« R. Aina ») ; deux élèves qui s'écriraient pareil
  // gardent leur nom complet pour ne pas les confondre
  const shortLabels = rows.map((r) => shortName(r.name));
  const printName = (n) => { const i = rows.findIndex((r) => r.name === n); return shortLabels.filter((x) => x === shortLabels[i]).length > 1 ? n : shortLabels[i] ?? n; };
  const name = current && rows.some((r) => r.name === current) ? current : rows[0]?.name;
  const gaOf = (n) => data.ga[councilKey(cls, n)] ?? {};
  const setGa = (n, entry) => {
    const key = councilKey(cls, n);
    setData((d) => ({ ...d, ga: { ...d.ga, [key]: entry } }));
    saveDoc(key, 'CONSEIL', null, { ...entry, cls, student: n });
  };
  const act = (fn) => { try { setGaError(''); fn(); } catch (e) { setGaError(e.message); } };
  const decisionOf = (r) => gaOf(r.name).decision ?? r.proposal;
  const pending = entries.filter((e) => !e.validated);
  const written = rows.filter((r) => gaOf(r.name).status === 'VALIDEE').length;
  const toValidate = rows.filter((r) => gaOf(r.name).status === 'A_VALIDER').map((r) => r.name);
  const row = rows.find((r) => r.name === name);
  const entry = name ? gaOf(name) : {};
  const appText = entry.text ?? '';
  const appCheck = checkAppreciation(appText, { decision: true, tutoiement: settings?.grading?.allowTutoiement !== false });

  const exportXlsx = () => saveFile(`conseil-${cls.replace(/\s+/g, '-')}-${TERM.id}.xlsx`, buildXlsx([{ name: `Conseil ${cls}`, rows: [
    [`Conseil de classe — ${cls} — ${TERM.label}`],
    ['Élève', ...subjects, 'Moy. G.', 'Avis des enseignants', 'Décision', 'Appréciation générale'],
    ...rows.map((r) => [r.name, ...subjects.map((s) => (r.avgs[s] == null ? '' : r.avgs[s])), r.general ?? '', r.flags.map(flagLine).join(' / '),
      DECISION[decisionOf(r)]?.label.replace('—', '').trim() ?? '', gaOf(r.name).status === 'VALIDEE' ? gaOf(r.name).text : '']),
    ['Moyenne de classe', ...subjects.map((s) => classAvg[s].avg ?? ''), generalStats.avg ?? ''],
  ] }]));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-navy-500">Conseil de classe · Direction et secrétariat uniquement</p>
          <h1 className="text-2xl font-semibold text-navy-900">Conseils de classe</h1>
          <p className="text-sm text-slate-600">{TERM.label} · notes lues à {data.at.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            {sync && <span className={sync.status === 'saved' ? ' text-emerald-700' : ' text-amber-700'}> · {sync.status === 'saved' ? '✓ avis enregistrés sur le serveur' : 'enregistrement en attente…'}</span>}</p>
        </div>
        <div className="flex flex-wrap items-end gap-2 print:hidden">
          <label className="text-xs font-medium text-slate-600">Classe
            <select value={cls} onChange={(e) => { setCls(e.target.value); setCurrent(null); setOpen(null); }} className="mt-1 block rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm">
              {rosterClasses(data.roster).map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
          <Button variant="secondary" onClick={load}>Actualiser les notes</Button>
          <Button variant="secondary" onClick={exportXlsx}>Exporter (Excel)</Button>
          <Button variant="secondary" onClick={() => printOnly('.council-print', 'size: A4 landscape;', `Grille du conseil de classe — ${cls} — ${TERM.label}`)}>Imprimer la grille</Button>
          {isDirection && <Button variant="secondary" onClick={() => go?.('bulletins')}>Bulletins</Button>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 print:hidden">
        <Stat label="Moyenne générale de la classe" value={fmtAvg(generalStats.avg)} hint={generalStats.avg == null ? '' : `de ${fmtAvg(generalStats.min)} à ${fmtAvg(generalStats.max)}`} />
        <Stat label="Élèves sous 10 de moyenne" value={rows.filter((r) => r.general != null && r.general < 10).length} tone="red" />
        <Stat label="Saisies pas encore validées" value={`${pending.length} / ${entries.length}`} tone={pending.length ? 'amber' : 'green'} />
        <Stat label="Appréciations générales validées" value={`${written} / ${rows.length}`} />
      </div>

      <Card title="Saisies des professeurs" subtitle="Nombre de notes et validation, par matière">
        {entries.length === 0 ? <p className="text-sm text-slate-600">Aucun professeur n'a cette classe dans sa fiche.</p> : (
          <ul className="flex flex-wrap gap-2 text-xs">
            {entries.map((e) => (
              <li key={`${e.subject}|${e.teacher}`} className={`rounded-lg px-2.5 py-1.5 ring-1 ${e.validated ? 'bg-emerald-50 text-emerald-900 ring-emerald-200' : e.count < e.min ? 'bg-amber-50 text-amber-900 ring-amber-200' : 'bg-white text-slate-700 ring-slate-200'}`}>
                <strong>{e.subject}</strong> · {e.teacher} · {e.count} note{e.count > 1 ? 's' : ''}{e.count < e.min ? ` (min. ${e.min})` : ''} · {e.validated ? 'validé' : e.opened ? 'en cours' : 'carnet pas encore ouvert'}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title={`Grille de notes — ${cls}`} subtitle="Moyennes /20 par matière · la moyenne générale reste sur la grille (jamais sur le bulletin)">
        <div className="-mx-5 overflow-x-auto" tabIndex={0} role="region" aria-label="Grille de notes du conseil">
          <table data-grid className="w-full text-sm">
            <thead>
              <tr className="border-y border-slate-100 bg-slate-50 text-xs text-slate-500">
                <th className="sticky left-0 z-10 bg-slate-50 px-4 py-2 text-left font-medium">Élève</th>
                {subjects.map((s) => <th key={s} className="px-1.5 py-2 text-center font-medium" title={s}>{shortLabel(s)}</th>)}
                <th className="px-2 py-2 text-center font-semibold text-navy-900">Moy. G.</th>
                <th className="px-2 py-2 text-left font-medium">Avis des enseignants</th>
                <th className="px-3 py-2 text-left font-medium">Décision</th>
                <th className="px-2 py-2 text-center font-medium">Appr. gén.</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const g = gaOf(r.name);
                const grouped = Object.entries(r.flags.filter((f) => f.flag).reduce((acc, f) => ({ ...acc, [f.flag]: (acc[f.flag] ?? 0) + 1 }), {}));
                return (
                  <React.Fragment key={r.name}>
                    <tr className="border-b border-slate-100">
                      <td className="sticky left-0 z-10 bg-white px-4 py-2"><button type="button" onClick={() => setOpen(open === r.name ? null : r.name)} className="text-left font-medium text-slate-900 hover:text-navy-500">{sn(r.name)}</button></td>
                      {subjects.map((s) => <td key={s} className={`px-1.5 text-center tabular-nums ${r.avgs[s] === undefined ? 'bg-slate-50 text-slate-300' : tone(r.avgs[s])}`}>{r.avgs[s] === undefined ? '·' : fmtAvg(r.avgs[s])}</td>)}
                      <td className={`px-2 text-center font-semibold tabular-nums ${tone(r.general)}`}>{fmtAvg(r.general)}</td>
                      <td className="px-2"><div className="flex flex-wrap gap-1">
                        {grouped.map(([id, n]) => <Badge key={id} tone={FLAG[id]?.tone}>{FLAG[id]?.label ?? id}{n > 1 ? ` ×${n}` : ''}</Badge>)}
                        {r.flags.some((f) => f.note) && <Badge>remarque</Badge>}
                      </div></td>
                      <td className="px-3 py-1.5 text-xs">
                        <span className={g.decision === undefined ? 'text-slate-600' : 'font-medium text-slate-900'}>{DECISION[decisionOf(r)]?.label ?? '—'}</span>
                        {g.decision === undefined && r.proposal && <span className="block text-[10px] text-navy-500">proposition</span>}
                      </td>
                      <td className="px-2 text-center"><button type="button" onClick={() => setCurrent(r.name)} title="Rédiger l'appréciation générale">
                        {g.status ? <Badge tone={GA_STATUS[g.status][0]}>{GA_STATUS[g.status][1]}</Badge> : <Badge>à rédiger</Badge>}
                      </button></td>
                    </tr>
                    {open === r.name && (
                      <tr className="bg-slate-50"><td colSpan={subjects.length + 5} className="px-4 py-3 text-sm">
                        <p className="font-medium text-slate-800">Avis des enseignants pour {r.name}</p>
                        {r.flags.length === 0 ? <p className="text-slate-500">Aucun avis particulier.</p>
                          : <ul className="mt-1 space-y-0.5 text-slate-700">{r.flags.map((f, i) => <li key={i}>· {flagLine(f)} ({f.teacher})</li>)}</ul>}
                      </td></tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
            <tfoot>
              {['avg', 'min', 'max'].map((k) => (
                <tr key={k} className="bg-slate-50 text-xs text-slate-600">
                  <td className="sticky left-0 z-10 bg-slate-50 px-4 py-1.5 font-medium">{{ avg: 'Moyenne de classe', min: 'Minimum', max: 'Maximum' }[k]}</td>
                  {subjects.map((s) => <td key={s} className="px-1.5 text-center tabular-nums">{fmtAvg(classAvg[s][k])}</td>)}
                  <td className="px-2 text-center font-semibold tabular-nums">{fmtAvg(generalStats[k])}</td>
                  <td colSpan={3} />
                </tr>
              ))}
            </tfoot>
          </table>
        </div>
        <p className="mt-3 text-xs text-slate-500">Les moyennes changent dès qu'un professeur saisit une note : « Actualiser les notes » relit les carnets. « · » = matière que l'élève ne suit pas. Cliquer sur un nom affiche les avis détaillés.</p>
      </Card>

      {row && (
        <div className="grid gap-5 xl:grid-cols-[1fr_320px] xl:items-start print:hidden">
          <Card title="Avis du conseil : décision et appréciation générale"
            subtitle={isDirection ? `Tapées par vous ou par le secrétariat · ${written} / ${rows.length} validées${toValidate.length ? ` · ${toValidate.length} à valider` : ''}` : 'Tapez d\'après les notes de la Direction, puis envoyez-les-lui pour validation'}>
            {isDirection && toValidate.length > 0 && (
              <p className="mb-3 flex flex-wrap items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">À valider : {toValidate.map((n) => <button key={n} type="button" onClick={() => setCurrent(n)} className="font-medium underline">{n}</button>)}</p>
            )}
            <StudentSelect students={rows.map((r) => r.name)} value={name} onChange={setCurrent} suffix={(n) => (gaOf(n).status ? `  · ${GA_STATUS[gaOf(n).status][1]}` : '')} />
            <p className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
              Moyenne générale {fmtAvg(row.general)} · {DECISION[decisionOf(row)]?.label} · {row.flags.length ? row.flags.map(flagLine).join(' / ') : 'aucun avis particulier'}
            </p>
            <label className="mt-3 block text-xs font-medium text-slate-600">Décision du conseil
              <select value={decisionOf(row) ?? ''} onChange={(e) => act(() => setGa(name, saveDecision(entry, e.target.value, role)))} className="mt-1 block w-72 max-w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm">
                {COUNCIL_DECISIONS.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
              </select>
            </label>
            {entry.status && <p className="mt-2 text-xs">État : <Badge tone={GA_STATUS[entry.status][0]}>{GA_STATUS[entry.status][1]}</Badge>{entry.note && <span className="ml-2 text-red-700">Remarque de la Direction : {entry.note}</span>}</p>}
            <textarea spellCheck lang="fr" rows={4} value={appText} onChange={(e) => act(() => setGa(name, saveText(entry, e.target.value, role)))}
              aria-label="Appréciation générale du conseil de classe" placeholder="Appréciation générale du conseil de classe…" className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            {gaError && <p className="mt-1 text-sm text-red-700">{gaError}</p>}
            <div className="mt-2 flex flex-wrap gap-2">
              <Button variant="secondary" disabled={!appText.trim() || autoFix(appText) === appText.trim()} onClick={() => act(() => setGa(name, saveText(entry, autoFix(appText), role)))}>Corriger la forme</Button>
              {!isDirection && <Button disabled={!appText.trim() || entry.status === 'A_VALIDER'} onClick={() => act(() => setGa(name, submit(entry, 'BUREAU')))}>{entry.status === 'A_VALIDER' ? 'Envoyée à la Direction' : 'Envoyer à la Direction'}</Button>}
              {isDirection && <Button disabled={!appText.trim() || entry.status === 'VALIDEE'} onClick={() => act(() => setGa(name, validate(entry, 'DIRECTION', appText)))}>{entry.status === 'VALIDEE' ? 'Validée' : 'Valider'}</Button>}
              {isDirection && entry.status === 'A_VALIDER' && (
                <span className="flex flex-wrap gap-2">
                  <input value={gaNote} onChange={(e) => setGaNote(e.target.value)} placeholder="Remarque pour le secrétariat" className="rounded-md border border-slate-300 px-2 py-1 text-sm" />
                  <Button variant="secondary" onClick={() => act(() => { setGa(name, sendBack(entry, 'DIRECTION', gaNote)); setGaNote(''); })}>Renvoyer</Button>
                </span>
              )}
              <Button variant="ghost" className="ml-auto" disabled={rows.findIndex((r) => r.name === name) === rows.length - 1}
                onClick={() => setCurrent(rows[rows.findIndex((r) => r.name === name) + 1].name)}>Élève suivant ›</Button>
            </div>
            <p className="mt-2 text-xs text-slate-500">Enregistré sur le serveur à chaque frappe. Seules les appréciations validées par la Direction vont sur le bulletin.</p>
          </Card>
          <Card title="Contrôleur de rédaction"><RulePanel result={appCheck} /></Card>
        </div>
      )}

      {sheetKind(cls) && <CouncilOrientation cls={cls} role={role} />}

      <div className="council-print hidden">
        <h2 style={{ fontWeight: 700, marginBottom: 6 }}>Conseil de classe — {cls} — {TERM.label}</h2>
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 9 }}>
          <thead><tr>{['Élève', ...subjects.map(shortLabel), 'Moy. G.', 'Avis des enseignants'].map((h) => <th key={h} style={{ border: '1px solid #000', padding: 2 }}>{h}</th>)}</tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name}>
                <td style={{ border: '1px solid #000', padding: 2 }}>{printName(r.name)}</td>
                {subjects.map((s) => <td key={s} style={{ border: '1px solid #000', padding: 2, textAlign: 'center' }}>{r.avgs[s] === undefined ? '' : fmtAvg(r.avgs[s])}</td>)}
                <td style={{ border: '1px solid #000', padding: 2, textAlign: 'center', fontWeight: 700 }}>{fmtAvg(r.general)}</td>
                <td style={{ border: '1px solid #000', padding: 2 }}>{r.flags.map(flagLine).join(' / ')}</td>
              </tr>
            ))}
            <tr><td style={{ border: '1px solid #000', padding: 2, fontWeight: 700 }}>Moyenne de classe</td>
              {subjects.map((s) => <td key={s} style={{ border: '1px solid #000', padding: 2, textAlign: 'center' }}>{fmtAvg(classAvg[s].avg)}</td>)}
              <td style={{ border: '1px solid #000', padding: 2, textAlign: 'center', fontWeight: 700 }}>{fmtAvg(generalStats.avg)}</td><td style={{ border: '1px solid #000' }} /></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
