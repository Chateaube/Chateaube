import React, { useState } from 'react';
import { Badge, Button, Card, Stat } from './ui.jsx';
import { CLASSES } from '../data/schoollife.js';
import { AUTHORIZATIONS, DOCUMENTS, REQUESTED, INTERNSHIPS } from '../data/family.js';

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
          <select value={cls} onChange={(e) => setCls(e.target.value)} className={inputCls}>{Object.keys(CLASSES).map((c) => <option key={c}>{c}</option>)}</select>
          <label className="flex items-center gap-1.5 text-sm text-slate-600"><input type="checkbox" checked={onlyIssues} onChange={(e) => setOnlyIssues(e.target.checked)} />Refus et sans réponse</label>
        </div>
      }
    >
      <div className="-mx-4 overflow-x-auto">
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

function StagesOrientation() {
  const stages = [
    { student: 'RAKOTOARISOA Aina', cls: '1re STMG', ...INTERNSHIPS.aina[0] },
    { student: 'RAZAFY Kanto', cls: '1re STMG', ...INTERNSHIPS.aina[0], company: 'BNI Madagascar — agence de Tamatave', signatures: { entreprise: false, etablissement: false, famille: false } },
    { student: 'RAVELO Hasina', cls: '3e', title: 'Stage d\'observation (3e)', company: 'Port de Toamasina — capitainerie', from: '2027-01-18', to: '2027-01-22', referent: 'M. Rasolo', signatures: { entreprise: true, etablissement: true, famille: true } },
  ];
  const signed = (s) => Object.values(s.signatures).filter(Boolean).length;
  return (
    <div className="space-y-5">
      <Card title="Stages" subtitle="Conventions : entreprise, établissement, responsable légal">
        <div className="-mx-4 overflow-x-auto">
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
      <Card title="Orientation" subtitle="Calendrier commun ; intentions et avis par classe">
        <ul className="space-y-2 text-sm">
          <li className="flex flex-wrap justify-between gap-2"><span><b>3e</b> — vœux d'orientation après la 3e (2de générale, lycée professionnel)</span><Badge tone="slate">Intentions au 2e trimestre</Badge></li>
          <li className="flex flex-wrap justify-between gap-2"><span><b>2de</b> — choix de la voie (générale / STMG) et des spécialités</span><Badge tone="slate">Intentions au 2e trimestre</Badge></li>
          <li className="flex flex-wrap justify-between gap-2"><span><b>1re STMG</b> — spécialité de Terminale (4 choix)</span><Badge tone="amber">Découverte en cours</Badge></li>
          <li className="flex flex-wrap justify-between gap-2"><span><b>Terminale</b> — Parcoursup et Campus France</span><Badge tone="navy">Ateliers à partir de novembre</Badge></li>
        </ul>
      </Card>
    </div>
  );
}

const TABS = [['auth', 'Autorisations'], ['docs', 'Documents envoyés'], ['pieces', 'Pièces demandées'], ['stages', 'Stages & orientation']];

export default function FollowUpModule() {
  const [tab, setTab] = useState('auth');
  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Familles · Tamatave</p>
        <h1 className="text-2xl font-semibold text-navy-900">Documents, stages & orientation</h1>
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
      {tab === 'auth' && <Authorizations />}
      {tab === 'docs' && <Documents />}
      {tab === 'pieces' && <Requested />}
      {tab === 'stages' && <StagesOrientation />}
    </div>
  );
}
