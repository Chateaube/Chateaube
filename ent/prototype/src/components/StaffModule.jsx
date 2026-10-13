import React, { useState } from 'react';
import { Badge, Button, Card, Stat } from './ui.jsx';
import { STAFF, POSTES, CONTRATS } from '../data/people.js';

const TODAY = '2026-10-13';
const fmtDate = (iso) => (iso ? iso.split('-').reverse().join('/') : '—');
const inputCls = 'rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm';
const ACCESS = { PROFESSEUR: 'Professeur', VIE_SCOLAIRE: 'Vie scolaire', BUREAU: 'Bureau', DIRECTION: 'Direction' };

/** Statut d'un agent à une date : l'accès à l'ENT suit automatiquement ses dates d'entrée et de sortie. */
export function staffStatus(a, today = TODAY) {
  if (a.entry > today) return { key: 'ARRIVEE', label: `Arrivée le ${fmtDate(a.entry)}`, tone: 'navy', active: false };
  if (a.exit && a.exit < today) return { key: 'SORTI', label: `Sorti.e le ${fmtDate(a.exit)}`, tone: 'slate', active: false };
  if (a.exit) return { key: 'FIN', label: `Fin prévue le ${fmtDate(a.exit)}`, tone: 'amber', active: true };
  return { key: 'ACTIF', label: 'En poste', tone: 'green', active: true };
}

const EMPTY = { name: '', poste: POSTES[0], detail: '', contrat: 'CDI', entry: TODAY, exit: '', email: '', access: '' };

export default function StaffModule() {
  const [staff, setStaff] = useState(STAFF);
  const [filter, setFilter] = useState('ACTIFS');
  const [draft, setDraft] = useState(EMPTY);
  const [exitFor, setExitFor] = useState(null); // { id, date, reason }

  const rows = staff
    .map((a) => ({ ...a, status: staffStatus(a) }))
    .filter((a) => filter === 'TOUS' || (filter === 'ACTIFS' ? a.status.key !== 'SORTI' : a.status.key === 'SORTI'))
    .sort((a, b) => a.name.localeCompare(b.name));
  const active = staff.filter((a) => staffStatus(a).active);

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-medium text-coral-700">Administration · Tamatave</p>
        <h1 className="text-2xl font-semibold text-navy-900">Gestion des agents</h1>
        <p className="text-sm text-slate-500">Registre du personnel : entrées, sorties et accès à l'ENT.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Agents en poste" value={active.length} />
        <Stat label="dont enseignant.e.s" value={active.filter((a) => a.poste.startsWith('Enseignant') || a.poste.startsWith('Intervenant')).length} />
        <Stat label="Arrivées prévues" value={staff.filter((a) => staffStatus(a).key === 'ARRIVEE').length} tone="green" />
        <Stat label="Sorties depuis la rentrée" value={staff.filter((a) => a.exit && a.exit >= '2026-07-01' && a.exit < TODAY).length} tone="amber" />
      </div>

      <Card
        title="Registre du personnel"
        action={
          <div className="inline-flex rounded-lg bg-slate-100 p-1">
            {[['ACTIFS', 'En poste'], ['SORTIS', 'Sortis'], ['TOUS', 'Tous']].map(([k, l]) => (
              <button key={k} onClick={() => setFilter(k)} className={`rounded-md px-2.5 py-1 text-xs font-medium ${filter === k ? 'bg-white text-navy-900 shadow-sm' : 'text-slate-600'}`}>{l}</button>
            ))}
          </div>
        }
      >
        <div className="-mx-5 overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-y border-slate-100 bg-slate-50 text-left text-xs text-slate-500">
                <th className="px-4 py-2 font-medium">Agent</th><th className="px-2 font-medium">Poste</th><th className="px-2 font-medium">Contrat</th>
                <th className="px-2 font-medium">Entrée</th><th className="px-2 font-medium">Sortie</th><th className="px-2 font-medium">Statut</th>
                <th className="px-2 font-medium">Accès ENT</th><th className="px-4 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <React.Fragment key={a.id}>
                  <tr className="border-b border-slate-100">
                    <td className="px-4 py-2"><p className="font-medium text-slate-900">{a.name}</p><p className="text-[11px] text-slate-500">{a.email ?? 'sans compte'}</p></td>
                    <td className="px-2"><p className="text-slate-800">{a.poste}</p><p className="text-[11px] text-slate-500">{a.detail}</p></td>
                    <td className="px-2 text-slate-600">{a.contrat}</td>
                    <td className="px-2 tabular-nums text-slate-600">{fmtDate(a.entry)}</td>
                    <td className="px-2 tabular-nums text-slate-600">{fmtDate(a.exit)}{a.exitReason && <p className="text-[11px] text-slate-500">{a.exitReason}</p>}</td>
                    <td className="px-2"><Badge tone={a.status.tone}>{a.status.label}</Badge></td>
                    <td className="px-2">
                      {a.access
                        ? (a.status.active ? <Badge tone="navy">Google · {ACCESS[a.access]}</Badge>
                          : a.status.key === 'ARRIVEE' ? <Badge>Ouvert le {fmtDate(a.entry)}</Badge> : <Badge>Désactivé</Badge>)
                        : <span className="text-xs text-slate-400">—</span>}
                    </td>
                    <td className="px-4 text-right">
                      {a.status.key !== 'SORTI' && (
                        <Button variant="ghost" onClick={() => setExitFor({ id: a.id, date: TODAY, reason: 'Fin de contrat' })}>Enregistrer une sortie</Button>
                      )}
                    </td>
                  </tr>
                  {exitFor?.id === a.id && (
                    <tr className="border-b border-slate-100 bg-amber-50/60">
                      <td colSpan={8} className="px-4 py-2">
                        <div className="flex flex-wrap items-end gap-2 text-sm">
                          <label className="text-xs text-slate-600">Date de sortie<input type="date" value={exitFor.date} onChange={(e) => setExitFor({ ...exitFor, date: e.target.value })} className={`ml-2 ${inputCls}`} /></label>
                          <label className="text-xs text-slate-600">Motif
                            <select value={exitFor.reason} onChange={(e) => setExitFor({ ...exitFor, reason: e.target.value })} className={`ml-2 ${inputCls}`}>
                              {['Fin de contrat', 'Démission', 'Mutation', 'Retraite', 'Licenciement', 'Autre'].map((r) => <option key={r}>{r}</option>)}
                            </select>
                          </label>
                          <Button onClick={() => { setStaff(staff.map((s) => (s.id === a.id ? { ...s, exit: exitFor.date, exitReason: exitFor.reason } : s))); setExitFor(null); }}>Confirmer</Button>
                          <Button variant="secondary" onClick={() => setExitFor(null)}>Annuler</Button>
                          <span className="text-xs text-amber-800">L'accès à l'ENT sera désactivé automatiquement après cette date.</span>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Enregistrer une entrée" subtitle="Nouvel agent : l'accès ENT s'ouvre à sa date d'entrée (connexion Google)">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs text-slate-600">Nom et prénom<input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className={`mt-1 w-full ${inputCls}`} /></label>
          <label className="text-xs text-slate-600">Poste
            <select value={draft.poste} onChange={(e) => setDraft({ ...draft, poste: e.target.value })} className={`mt-1 w-full ${inputCls}`}>{POSTES.map((p) => <option key={p}>{p}</option>)}</select>
          </label>
          <label className="text-xs text-slate-600">Matière / fonction<input value={draft.detail} onChange={(e) => setDraft({ ...draft, detail: e.target.value })} className={`mt-1 w-full ${inputCls}`} /></label>
          <label className="text-xs text-slate-600">Contrat
            <select value={draft.contrat} onChange={(e) => setDraft({ ...draft, contrat: e.target.value })} className={`mt-1 w-full ${inputCls}`}>{CONTRATS.map((c) => <option key={c}>{c}</option>)}</select>
          </label>
          <label className="text-xs text-slate-600">Date d'entrée<input type="date" value={draft.entry} onChange={(e) => setDraft({ ...draft, entry: e.target.value })} className={`mt-1 w-full ${inputCls}`} /></label>
          <label className="text-xs text-slate-600">Date de sortie prévue (CDD)<input type="date" value={draft.exit} onChange={(e) => setDraft({ ...draft, exit: e.target.value })} className={`mt-1 w-full ${inputCls}`} /></label>
          <label className="text-xs text-slate-600">Adresse Google (facultatif)<input type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} placeholder="prenom.nom@gmail.com" className={`mt-1 w-full ${inputCls}`} /></label>
          <label className="text-xs text-slate-600">Accès ENT
            <select value={draft.access} onChange={(e) => setDraft({ ...draft, access: e.target.value })} className={`mt-1 w-full ${inputCls}`}>
              <option value="">Aucun</option>{Object.entries(ACCESS).filter(([k]) => k !== 'DIRECTION').map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </label>
        </div>
        {draft.access && !draft.email && <p className="mt-2 text-sm text-amber-700">Une adresse Google est nécessaire pour ouvrir un accès à l'ENT.</p>}
        {draft.exit && draft.exit <= draft.entry && <p className="mt-2 text-sm text-red-700">La date de sortie doit suivre la date d'entrée.</p>}
        <Button className="mt-3"
          disabled={!draft.name.trim() || !draft.entry || (draft.access && !draft.email) || (draft.exit && draft.exit <= draft.entry)}
          onClick={() => { setStaff([...staff, { ...draft, id: `p${Date.now()}`, name: draft.name.trim(), exit: draft.exit || null, email: draft.email || null, access: draft.access || null }]); setDraft(EMPTY); setFilter('TOUS'); }}>
          Ajouter au registre
        </Button>
      </Card>
    </div>
  );
}
