import React, { useState } from 'react';
import { Badge, Button, Card, Icon, Stat } from './ui.jsx';

// Vie scolaire : absences et retards issus de l'appel, justificatifs, notifications, incidents.
const INITIAL = [
  { id: 1, student: 'RAJAONARIVELO Tsiry', cls: '1re STMG', kind: 'ABSENCE', slot: '07h00–09h00', teacher: 'Mme Ranaivo', justified: false, notified: true },
  { id: 2, student: 'RAMAROSON Fitia', cls: '1re STMG', kind: 'RETARD', slot: '07h00 (+15 min)', teacher: 'Mme Ranaivo', justified: false, notified: false },
  { id: 3, student: 'RAVELO Hasina', cls: '3e', kind: 'ABSENCE', slot: 'Journée', teacher: 'M. Rasolo', justified: true, notified: true, reason: 'Certificat médical' },
  { id: 4, student: 'RASOA Lova', cls: '5e', kind: 'RETARD', slot: '09h45 (+5 min)', teacher: 'Mme Hery', justified: false, notified: false },
];
const INCIDENTS = [
  { id: 1, date: '12/10', student: 'RANDRIAMAMPIANINA Hery', cls: '1re STMG', fact: 'Téléphone utilisé en cours', measure: 'Confiscation jusqu\'à 17h', by: 'M. Be' },
  { id: 2, date: '08/10', student: 'RAJAONARIVELO Tsiry', cls: '1re STMG', fact: 'Bavardages répétés', measure: 'Observation écrite', by: 'Mme Hery' },
];
const REASONS = ['Certificat médical', 'Motif familial', 'Transport', 'Rendez-vous administratif', 'Autre'];

export default function VieScolaireModule() {
  const [rows, setRows] = useState(INITIAL);
  const [incidents, setIncidents] = useState(INCIDENTS);
  const [draft, setDraft] = useState({ student: '', fact: '', measure: 'Observation écrite' });
  const [toast, setToast] = useState(null);
  const update = (id, patch, msg) => { setRows(rows.map((r) => (r.id === id ? { ...r, ...patch } : r))); if (msg) setToast(msg); };

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Mardi 13 octobre 2026 · Tamatave</p>
        <h1 className="text-2xl font-semibold text-navy-900">Vie scolaire</h1>
        <p className="text-sm text-slate-500">Absences, retards et incidents. Les appels faits par les enseignants arrivent ici en temps réel.</p>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Absences aujourd'hui" value={rows.filter((r) => r.kind === 'ABSENCE').length} tone="red" />
        <Stat label="Retards aujourd'hui" value={rows.filter((r) => r.kind === 'RETARD').length} tone="amber" />
        <Stat label="À justifier" value={rows.filter((r) => !r.justified).length} />
        <Stat label="Appels manquants" value="1" hint="Tle STMG, 10h00 — Mme Ranaivo" tone="amber" />
      </div>
      {toast && <p role="status" className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800"><Icon name="check" />{toast}</p>}

      <Card title="Absences et retards du jour">
        <div className="-mx-4 overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-y border-slate-100 bg-slate-50 text-left text-xs text-slate-500">
                <th className="px-4 py-2 font-medium">Élève</th><th className="px-2 font-medium">Type</th><th className="px-2 font-medium">Créneau</th>
                <th className="px-2 font-medium">Justificatif</th><th className="px-2 font-medium">Parent</th><th className="px-4 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-slate-100">
                  <td className="px-4 py-2"><p className="font-medium text-slate-900">{r.student}</p><p className="text-xs text-slate-500">{r.cls} · appel de {r.teacher}</p></td>
                  <td className="px-2">{r.kind === 'ABSENCE' ? <Badge tone="red">Absence</Badge> : <Badge tone="amber">Retard</Badge>}</td>
                  <td className="px-2 text-slate-600">{r.slot}</td>
                  <td className="px-2">
                    {r.justified ? <Badge tone="green">{r.reason ?? 'Justifié'}</Badge> : (
                      <select defaultValue="" onChange={(e) => e.target.value && update(r.id, { justified: true, reason: e.target.value }, `${r.kind === 'ABSENCE' ? 'Absence' : 'Retard'} de ${r.student} justifié.`)}
                        className="rounded-md border border-slate-300 px-2 py-1 text-xs">
                        <option value="">À justifier…</option>{REASONS.map((x) => <option key={x}>{x}</option>)}
                      </select>
                    )}
                  </td>
                  <td className="px-2 text-xs">{r.notified ? <span className="text-emerald-700">Prévenu (SMS)</span> : <span className="text-slate-500">Non prévenu</span>}</td>
                  <td className="px-4 text-right">
                    {!r.notified && <Button variant="ghost" onClick={() => update(r.id, { notified: true }, `SMS envoyé au parent de ${r.student}.`)}><Icon name="bell" />Prévenir</Button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Incidents et mesures">
        <ul className="divide-y divide-slate-100">
          {incidents.map((i) => (
            <li key={i.id} className="flex flex-wrap items-start justify-between gap-2 py-2 text-sm">
              <div><p className="font-medium text-slate-900">{i.student} <span className="font-normal text-slate-500">· {i.cls} · {i.date}</span></p><p className="text-slate-700">{i.fact}</p></div>
              <div className="text-right"><Badge tone="amber">{i.measure}</Badge><p className="mt-0.5 text-xs text-slate-500">signalé par {i.by}</p></div>
            </li>
          ))}
        </ul>
        <div className="mt-3 grid gap-2 rounded-lg bg-slate-50 p-3 sm:grid-cols-[1fr_1.5fr_1fr_auto] sm:items-end">
          <label className="text-xs text-slate-600">Élève<input value={draft.student} onChange={(e) => setDraft({ ...draft, student: e.target.value })} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm" /></label>
          <label className="text-xs text-slate-600">Faits<input value={draft.fact} onChange={(e) => setDraft({ ...draft, fact: e.target.value })} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm" /></label>
          <label className="text-xs text-slate-600">Mesure
            <select value={draft.measure} onChange={(e) => setDraft({ ...draft, measure: e.target.value })} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm">
              {['Observation écrite', 'Retenue', 'Confiscation jusqu\'à 17h', 'Convocation des parents', 'Exclusion de cours (Direction)'].map((m) => <option key={m}>{m}</option>)}
            </select>
          </label>
          <Button disabled={!draft.student.trim() || !draft.fact.trim()} onClick={() => { setIncidents([{ ...draft, id: Date.now(), date: '13/10', cls: '—', by: 'Vie scolaire' }, ...incidents]); setDraft({ student: '', fact: '', measure: 'Observation écrite' }); }}>Enregistrer</Button>
        </div>
      </Card>
    </div>
  );
}
