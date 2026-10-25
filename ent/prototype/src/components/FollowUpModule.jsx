import React, { useState } from 'react';
import { saveFile } from '../download.js';
import StageConvention from './StageConvention.jsx';
import OrientationSheet, { loadSheets } from './OrientationSheet.jsx';
import { currentStep, sheetKind } from '../rules/orientationSheet.js';
import { Badge, Button, Card, Stat } from './ui.jsx';
import { CLASSES } from '../data/schoollife.js';
import { AUTHORIZATIONS, DOCUMENTS, REQUESTED, STAGE_TYPES } from '../data/family.js';
import { TLE_STUDENTS, STEPS, EXPORT_WINDOW } from '../data/terminale.js';
import { higherEdSteps, PROCEDURES, exportWindowOpen, campusFranceCsv, DESTINATIONS, trackSteps, addTrack, closeTrack, trackProgress } from '../rules/orientation.js';

// Suivi côté établissement (Direction, Bureau, Vie scolaire) : autorisations, documents
// envoyés et accusés de lecture, pièces manquantes, stages, orientation.

const inputCls = 'rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm';
// Réponses de démonstration, stables d'un affichage à l'autre
const answerOf = (student, auth) => {
  const h = [...`${student}${auth.id}`].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 997, 7);
  if (h % 7 === 0) return null;          // pas encore de réponse
  return auth.options[h % 5 === 1 ? 1 : 0];
};

function Authorizations() {
  const [cls, setCls] = useState('1re STMG');
  const [onlyIssues, setOnlyIssues] = useState(false);
  const students = CLASSES[cls];
  const rows = students.map((s) => ({ s, answers: AUTHORIZATIONS.map((a) => answerOf(s, a)) }))
    .filter((r) => !onlyIssues || r.answers.some((x) => x === null || x.startsWith('Je n\'') || x.startsWith('Aucune')));
  return (
    <Card
      title="Autorisations des familles"
      subtitle="Avant une photo de classe ou une sortie : qui n'est pas autorisé, qui n'a pas répondu"
      action={
        <div className="flex flex-wrap items-center gap-2">
          <select value={cls} onChange={(e) => setCls(e.target.value)} aria-label="Classe" className={inputCls}>{Object.keys(CLASSES).map((c) => <option key={c}>{c}</option>)}</select>
          <label className="flex items-center gap-1.5 text-sm text-slate-600"><input type="checkbox" checked={onlyIssues} onChange={(e) => setOnlyIssues(e.target.checked)} />Refus et sans réponse</label>
        </div>
      }
    >
      <div className="-mx-5 overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead><tr className="border-y border-slate-100 bg-slate-50 text-left text-xs text-slate-500"><th className="px-4 py-2 font-medium">Élève</th>{AUTHORIZATIONS.map((a) => <th key={a.id} className="px-2 font-medium">{a.label}</th>)}</tr></thead>
          <tbody>
            {rows.map(({ s, answers }) => (
              <tr key={s} className="border-b border-slate-100">
                <td className="px-4 py-2 font-medium text-slate-800">{s}</td>
                {answers.map((x, i) => (
                  <td key={i} className="px-2 py-2">
                    {x === null ? <Badge tone="amber">Sans réponse</Badge> : x.startsWith('Je n\'') || x.startsWith('Aucune') ? <Badge tone="red">{x}</Badge> : <span className="text-xs text-slate-700">{x}</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Button variant="secondary" className="mt-3">Relancer les familles sans réponse</Button>
    </Card>
  );
}

function Documents() {
  const [docs, setDocs] = useState(DOCUMENTS.map((d, i) => ({ ...d, audience: i === 1 ? '6e – 5e' : 'Toute l\'école', readCount: [118, 61, 179, 172][i], total: [186, 64, 186, 186][i] })));
  const [draft, setDraft] = useState({ title: '', audience: 'Toute l\'école', signature: false });
  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_360px] xl:items-start">
      <Card title="Documents envoyés aux familles" subtitle="Accusés de lecture et signatures">
        <ul className="divide-y divide-slate-100">
          {docs.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <div><p className="font-medium text-slate-800">{d.title}</p><p className="text-xs text-slate-500">{d.date.split('-').reverse().join('/')} · {d.from} · {d.audience}{d.signed ? ' · signature demandée' : ''}</p></div>
              <div className="flex items-center gap-2">
                <span className="text-xs tabular-nums text-slate-600">{d.readCount} / {d.total} lus</span>
                {d.readCount < d.total && <Button variant="ghost" className="!py-1 text-xs">Relancer</Button>}
              </div>
            </li>
          ))}
        </ul>
      </Card>
      <Card title="Publier un document">
        <div className="space-y-2 text-sm">
          <label className="block text-xs text-slate-600">Titre<input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} className={`mt-1 w-full ${inputCls}`} /></label>
          <label className="block text-xs text-slate-600">Destinataires
            <select value={draft.audience} onChange={(e) => setDraft({ ...draft, audience: e.target.value })} className={`mt-1 w-full ${inputCls}`}>
              {['Toute l\'école', ...Object.keys(CLASSES)].map((a) => <option key={a}>{a}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.signature} onChange={(e) => setDraft({ ...draft, signature: e.target.checked })} />Signature électronique demandée</label>
          <Button variant="secondary" className="w-full">Joindre le fichier (PDF)</Button>
          <Button className="w-full" disabled={!draft.title.trim()} onClick={() => {
            const total = draft.audience === 'Toute l\'école' ? 186 : CLASSES[draft.audience].length;
            setDocs([{ id: `d${Date.now()}`, date: '2026-10-13', title: draft.title.trim(), from: 'Direction', audience: draft.audience, signed: draft.signature, readCount: 0, total }, ...docs]);
            setDraft({ title: '', audience: 'Toute l\'école', signature: false });
          }}>Publier et notifier</Button>
        </div>
      </Card>
    </div>
  );
}

function Requested() {
  const [items, setItems] = useState([
    ...REQUESTED.map((r) => ({ ...r, student: r.child === 'aina' ? 'RAKOTOARISOA Aina' : 'RAKOTOARISOA Toky' })),
    { id: 'r4', student: 'RANDRIA Mamy', title: 'Attestation de recensement — dossier Bac', due: '2026-10-30', received: false },
    { id: 'r5', student: 'RAZAFY Kanto', title: 'Photo d\'identité — dossier Pré-Bac', due: '2026-10-30', received: 'PENDING' },
  ]);
  return (
    <Card title="Pièces demandées aux familles" subtitle="Dossiers d'examen, certificats, justificatifs">
      <ul className="divide-y divide-slate-100">
        {items.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
            <div><p className="font-medium text-slate-800">{r.student}</p><p className="text-slate-600">{r.title} · avant le {r.due.split('-').reverse().join('/')}</p></div>
            {r.received === true ? <Badge tone="green">Reçu</Badge>
              : r.received === 'PENDING' ? <Button variant="secondary" className="!py-1 text-xs" onClick={() => setItems(items.map((x) => (x.id === r.id ? { ...x, received: true } : x)))}>Vérifier et valider</Button>
                : <Badge tone="amber">Manquant</Badge>}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function StagesOrientation({ settings }) {
  const stages = [
    { student: 'RAVELO Hasina', cls: '3e', title: STAGE_TYPES[0].label, company: 'Port de Toamasina — capitainerie', from: '2027-02-22', to: '2027-02-26', referent: 'M. Rasolo', signatures: { entreprise: true, etablissement: true, famille: true } },
    { student: 'ANDRIAMIHAJA Miora', cls: '3e', title: STAGE_TYPES[0].label, company: 'Clinique Saint-Joseph — accueil', from: '2027-02-22', to: '2027-02-26', referent: 'M. Rasolo', signatures: { entreprise: true, etablissement: false, famille: false } },
    { student: 'Élèves de 2de (24)', cls: '2de', title: STAGE_TYPES[1].label, company: 'Conventions à constituer', from: '2027-04-12', to: '2027-04-16', referent: 'Direction', signatures: { entreprise: false, etablissement: false, famille: false } },
  ];
  const signed = (s) => Object.values(s.signatures).filter(Boolean).length;
  return (
    <div className="space-y-5">
      <Card title="Stages" subtitle={`${STAGE_TYPES.map((t) => `${t.level} : ${t.duration}`).join(' · ')} — conventions signées par l'entreprise, l'établissement et le responsable légal`}>
        <div className="-mx-5 overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead><tr className="border-y border-slate-100 bg-slate-50 text-left text-xs text-slate-500"><th className="px-4 py-2 font-medium">Élève</th><th className="px-2 font-medium">Stage</th><th className="px-2 font-medium">Dates</th><th className="px-2 font-medium">Convention</th></tr></thead>
            <tbody>
              {stages.map((s) => (
                <tr key={s.student} className="border-b border-slate-100">
                  <td className="px-4 py-2"><p className="font-medium text-slate-800">{s.student}</p><p className="text-xs text-slate-500">{s.cls} · référent.e {s.referent}</p></td>
                  <td className="px-2"><p className="text-slate-800">{s.company}</p><p className="text-xs text-slate-500">{s.title}</p></td>
                  <td className="px-2 text-xs text-slate-600">{s.from.split('-').reverse().join('/')} → {s.to.split('-').reverse().join('/')}</td>
                  <td className="px-2"><Badge tone={signed(s) === 3 ? 'green' : 'amber'}>{signed(s)} / 3 signatures</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <StageConvention settings={settings} />
      <Card title="Orientation" subtitle="Calendrier commun ; intentions et avis par classe">
        <ul className="space-y-2 text-sm">
          <li className="flex flex-wrap justify-between gap-2"><span><b>3e</b> — vœux d'orientation après la 3e (2de générale, lycée professionnel)</span><Badge tone="slate">Intentions au 2e trimestre</Badge></li>
          <li className="flex flex-wrap justify-between gap-2"><span><b>2de</b> — choix de la voie (générale / STMG) et des spécialités</span><Badge tone="slate">Intentions au 2e trimestre</Badge></li>
          <li className="flex flex-wrap justify-between gap-2"><span><b>1re STMG</b> — passage en Terminale STMG ; la spécialité de l'école est la mercatique</span><Badge tone="slate">Pas de choix à faire</Badge></li>
          <li className="flex flex-wrap justify-between gap-2"><span><b>Terminale</b> — une piste par pays visé ; la France (Parcoursup) conseillée en plan B</span><Badge tone="navy">Voir l'onglet Terminale</Badge></li>
        </ul>
      </Card>
    </div>
  );
}

/** Fiches de dialogue d'orientation : 2de (passage en 1re) et Terminale (post-bac), élève par élève. */
function OrientationSheets({ role }) {
  const classes = Object.keys(CLASSES).filter((c) => sheetKind(c));
  const [cls, setCls] = useState(classes[0]);
  const [open, setOpen] = useState(null);
  const [as, setAs] = useState(['DIRECTION', 'BUREAU'].includes(role) ? role : 'CONSULT'); // aperçu : voir comme la famille ou l'élève
  const sheets = loadSheets();
  const kind = sheetKind(cls);
  const WHO = { PARENT: 'famille', ELEVE: 'élève', DIRECTION: 'Direction' };
  return (
    <Card title="Fiches d'orientation" subtitle="En ligne : les familles (et l'élève de Terminale) remplissent leurs parties depuis le portail ; la Direction donne l'avis du conseil. Chaque fiche s'imprime."
      action={<select value={cls} onChange={(e) => { setCls(e.target.value); setOpen(null); }} aria-label="Classe" className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm">{classes.map((c) => <option key={c}>{c}</option>)}</select>}>
      <ul className="divide-y divide-slate-100">
        {(CLASSES[cls] ?? []).map((s) => {
          const st = currentStep(kind, sheets[s] ?? {});
          return (
            <li key={s} className="py-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium text-slate-900">{s}</span>
                <span className="flex items-center gap-2">
                  <Badge tone={!st ? 'green' : st.who === 'DIRECTION' ? 'amber' : 'slate'}>{!st ? 'terminée' : `à faire : ${WHO[st.who]}`}</Badge>
                  <Button variant="secondary" className="!py-1 text-xs" onClick={() => setOpen(open === s ? null : s)}>{open === s ? 'Fermer' : 'Ouvrir'}</Button>
                </span>
              </div>
              {open === s && (
                <div className="mt-2 rounded-xl bg-slate-50 p-3">
                  <div className="mb-2 flex flex-wrap items-center gap-1 text-xs" role="group" aria-label="Voir la fiche comme">
                    <span className="text-slate-600">Voir comme :</span>
                    {[[role, 'moi'], ['PARENT', 'la famille'], ['ELEVE', 'l\'élève']].map(([r, l]) => <button key={l} type="button" aria-pressed={as === r} onClick={() => setAs(r)} className={`rounded-full px-2.5 py-1 ring-1 ${as === r ? 'bg-navy-500 text-white ring-navy-500' : 'bg-white ring-slate-300'}`}>{l}</button>)}
                  </div>
                  <OrientationSheet key={`${s}-${as}`} student={s} cls={cls} role={as} by={as === 'PARENT' ? 'Représentant légal' : as === 'ELEVE' ? s : 'La cheffe d\'établissement'} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function Terminale() {
  // pistes de chaque élève (France en plan B pour tous, autres pays au besoin)
  const [students, setStudents] = useState(() => TLE_STUDENTS.map((st, i) => ({
    ...st,
    tracks: [
      { id: 'FRANCE', dest: 'FRANCE', done: { account: st.parcoursup.account, confirmed: st.parcoursup.confirmed, campus: st.campus.file, tls: st.tls.appointment }, closed: null },
      ...(i === 7 ? [{ id: 'CANADA-1', dest: 'CANADA', label: '', done: { dossier: true }, closed: null }] : []),
    ],
  })));
  const [closing, setClosing] = useState(null); // { i, id, reason }
  const [adding, setAdding] = useState({});
  const open = exportWindowOpen('2026-10-13', EXPORT_WINDOW);
  const setTracks = (i, fn) => setStudents(students.map((x, j) => (j === i ? { ...x, tracks: fn(x.tracks) } : x)));
  const toggle = (i, id, k) => setTracks(i, (ts) => ts.map((t) => (t.id === id ? { ...t, done: { ...t.done, [k]: !t.done[k] } } : t)));
  const franceOpen = students.filter((s) => s.tracks.some((t) => t.dest === 'FRANCE' && !t.closed));
  const withVisa = franceOpen.filter((s) => higherEdSteps(s.nationalities).includes('TLS')).length;
  const exportCsv = () => saveFile('campus-france-terminales-TMV.csv', campusFranceCsv(franceOpen));
  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-3">
        {Object.entries(STEPS).map(([p, steps]) => (
          <Card key={p} title={PROCEDURES[p].label}
            subtitle={p === 'PARCOURSUP' ? `Conseillé à tous en plan B · ${franceOpen.length} élève${franceOpen.length > 1 ? 's' : ''} sur ${students.length} suivent la piste France` : `${withVisa} élève${withVisa > 1 ? 's' : ''} ayant besoin d'un visa`}>
            <ol className="relative space-y-2 border-l border-slate-200 pl-4">
              {steps.map(([when, label]) => (
                <li key={label} className="relative text-sm">
                  <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-slate-300 ring-2 ring-white" />
                  <span className="font-medium text-navy-700">{when}</span> — <span className="text-slate-700">{label}</span>
                </li>
              ))}
            </ol>
          </Card>
        ))}
      </div>
      <p className="text-[11px] text-slate-400">Dates indicatives : les calendriers officiels sont publiés chaque année.</p>
      <Card
        title="Suivi des Terminales : une piste par pays"
        subtitle="La France (Parcoursup) n'est pas obligatoire mais conseillée en plan B ; ajoutez une piste si l'élève vise un autre pays, clôturez-la avec un motif s'il ne la suit pas"
        action={
          <div className="text-right">
            <Button variant="secondary" disabled={!open} onClick={exportCsv}>Exporter la liste Campus France</Button>
            <p className="mt-1 text-[11px] text-slate-500">{open ? 'Fenêtre ouverte' : `Après les résultats du Bac : du ${EXPORT_WINDOW.opensOn.split('-').reverse().join('/')} au ${EXPORT_WINDOW.closesOn.split('-').reverse().join('/')}`}</p>
          </div>
        }
      >
        <ul className="divide-y divide-slate-100">
          {students.map((st, i) => (
            <li key={st.email} className="py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm"><span className="font-medium text-slate-900">{st.lastName} {st.firstName}</span> <span className="text-xs text-slate-500">· {st.cls} · {st.nationalities.join(' · ')}</span></p>
                <span className="flex items-center gap-1.5">
                  <select value={adding[i]?.dest ?? ''} onChange={(e) => setAdding({ ...adding, [i]: { dest: e.target.value, label: '' } })} className="rounded-md border border-slate-300 px-2 py-1 text-xs" aria-label={`Ajouter une piste — ${st.firstName}`}>
                    <option value="">＋ Ajouter une piste…</option>
                    {Object.entries(DESTINATIONS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                  </select>
                  {adding[i]?.dest === 'AUTRE' && <input value={adding[i].label} onChange={(e) => setAdding({ ...adding, [i]: { ...adding[i], label: e.target.value } })} placeholder="Pays" className="w-28 rounded-md border border-slate-300 px-2 py-1 text-xs" />}
                  {adding[i]?.dest && <Button className="!px-2 !py-0.5 text-xs" disabled={adding[i].dest === 'AUTRE' && !adding[i].label.trim()} onClick={() => { setTracks(i, (ts) => addTrack(ts, adding[i].dest, adding[i].label)); setAdding({ ...adding, [i]: null }); }}>Ajouter</Button>}
                </span>
              </div>
              <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {st.tracks.map((t) => {
                  const pr = trackProgress(t, st.nationalities);
                  return (
                    <div key={t.id} className={`rounded-xl border p-2.5 text-xs ${t.closed ? 'border-slate-200 bg-slate-50 text-slate-400' : 'border-slate-200'}`}>
                      <p className="flex items-center justify-between gap-2 text-sm font-medium text-slate-800">
                        <span>{t.dest === 'AUTRE' ? t.label : DESTINATIONS[t.dest]}{t.dest === 'FRANCE' && <span className="ml-1 text-[11px] font-normal text-slate-500">(plan B conseillé)</span>}</span>
                        {t.closed ? <Badge>clôturée</Badge> : <Badge tone={pr.done === pr.total ? 'green' : 'navy'}>{pr.done}/{pr.total}</Badge>}
                      </p>
                      {t.closed ? <p className="mt-1">Clôturée le {t.closed.on.split('-').reverse().join('/')} : {t.closed.reason}</p> : (
                        <>
                          <div className="mt-1.5 space-y-1">
                            {trackSteps(t.dest, st.nationalities).map(([k, l]) => <label key={k} className="flex items-center gap-1.5 text-slate-600"><input type="checkbox" checked={!!t.done[k]} onChange={() => toggle(i, t.id, k)} />{l}</label>)}
                          </div>
                          {closing?.i === i && closing.id === t.id ? (
                            <span className="mt-2 flex gap-1.5">
                              <input autoFocus value={closing.reason} onChange={(e) => setClosing({ ...closing, reason: e.target.value })} placeholder="Motif (ex. ne part pas en France)" className="min-w-0 flex-1 rounded-md border border-slate-300 px-2 py-1" />
                              <Button className="!px-2 !py-0.5 text-xs" disabled={!closing.reason.trim()} onClick={() => { setTracks(i, (ts) => ts.map((x) => (x.id === t.id ? closeTrack(x, closing.reason, new Date().toISOString().slice(0, 10)) : x))); setClosing(null); }}>Clôturer</Button>
                            </span>
                          ) : <button type="button" className="mt-2 text-[11px] font-medium text-slate-500 hover:text-red-700" onClick={() => setClosing({ i, id: t.id, reason: '' })}>Clôturer cette piste…</button>}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

// trois onglets : les papiers des familles, les stages et l'orientation, la Terminale
const TABS = [['auth', 'Autorisations et pièces'], ['stages', 'Stages et orientation'], ['fiches', 'Fiches d\'orientation (2de, Tle)'], ['tle', 'Terminale : poursuite d\'études']];

export default function FollowUpModule({ settings, role = 'DIRECTION' }) {
  const [tab, setTab] = useState('auth');
  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-semibold text-navy-500">Familles · Tamatave</p>
        <h1 className="text-2xl font-semibold text-navy-900">Autorisations, stages et orientation</h1>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Droit à l'image sans réponse" value="14" tone="amber" />
        <Stat label="Documents non lus (calendrier conseils)" value="68" hint="sur 186 familles" />
        <Stat label="Pièces manquantes" value="3" tone="red" />
        <Stat label="Conventions de stage à signer" value="2" tone="amber" />
      </div>
      <div className="flex gap-1 overflow-x-auto rounded-lg bg-slate-100 p-1" role="tablist">
        {TABS.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
            className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ${tab === id ? 'bg-white text-navy-900 shadow-sm' : 'text-slate-600'}`}>{label}</button>
        ))}
      </div>
      {tab === 'auth' && <><Authorizations /><Requested /><Documents /></>}
      {tab === 'stages' && <StagesOrientation settings={settings} />}
      {tab === 'fiches' && <OrientationSheets role={role} />}
      {tab === 'tle' && <Terminale />}
    </div>
  );
}
