import React, { useMemo, useState } from 'react';
import { Badge, Button, Card, Icon, Progress, Stat } from './ui.jsx';
import {
  SITES, SITE_KPIS, DUNNING_CASES, EXAM_FEES, CANDIDATE_FILES, TRANSFER, YEAR_MILESTONES, TODAY,
} from '../data/demo.js';
import { DUNNING_MONTHS, SKIPPED_MONTHS, DUNNING_STAGES, splitExamFee, formatAr } from '../rules/finance.js';

const SCHOOL_MONTHS = [
  [9, 'S'], [10, 'O'], [11, 'N'], [12, 'D'], [1, 'J'], [2, 'F'], [3, 'M'], [4, 'A'], [5, 'M'], [6, 'J'],
];
const STAGE_UI = {
  RELANCE: { tone: 'navy', label: 'Relance' },
  AVERTISSEMENT_48H: { tone: 'amber', label: 'Avertissement 48 h' },
  MISE_A_PIED: { tone: 'red', label: 'Mise à pied' },
  DELAI: { tone: 'violet', label: 'Délai accordé' },
};

const pct = (a, b) => (b ? (a / b) * 100 : 0);
const fmtPct = (v) => `${v.toFixed(1).replace('.', ',')} %`;

function SiteSwitch({ value, onChange }) {
  const options = [{ id: 'ALL', label: 'Tous les sites' }, ...SITES.map((s) => ({ id: s.id, label: s.short }))];
  return (
    <div className="inline-flex rounded-lg bg-slate-100 p-1" role="tablist" aria-label="Filtrer par site">
      {options.map((o) => (
        <button
          key={o.id}
          role="tab"
          aria-selected={value === o.id}
          onClick={() => onChange(o.id)}
          className={`rounded-md px-3 py-1 text-sm font-medium transition ${value === o.id ? 'bg-white text-navy-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function DunningCalendar() {
  const current = new Date(TODAY).getMonth() + 1;
  return (
    <div className="flex gap-1" aria-label="Mois actifs du cycle de relance">
      {SCHOOL_MONTHS.map(([m, l], i) => {
        const active = DUNNING_MONTHS.includes(m);
        const skipped = SKIPPED_MONTHS[m];
        return (
          <div
            key={i}
            title={skipped ?? (active ? 'Mois de relance actif' : 'Hors cycle de relance')}
            className={`flex h-7 w-7 items-center justify-center rounded-md text-xs font-semibold
              ${skipped ? 'hatched text-amber-800 ring-1 ring-amber-300' : active ? 'bg-navy-500 text-white' : 'bg-slate-100 text-slate-400'}
              ${m === current ? 'outline-2 outline-offset-1 outline-navy-900' : ''}`}
          >
            {l}
          </div>
        );
      })}
    </div>
  );
}

export default function DirectionDashboard({ account }) {
  const [site, setSite] = useState('ALL');
  const [cases, setCases] = useState(DUNNING_CASES);
  const [toast, setToast] = useState(null);

  const inSite = (s) => site === 'ALL' || s === site;
  const kpi = useMemo(() => {
    const ids = site === 'ALL' ? Object.keys(SITE_KPIS) : [site];
    return ids.reduce((acc, id) => {
      const k = SITE_KPIS[id];
      acc.students += k.students; acc.due += k.tuitionDue; acc.paid += k.tuitionPaid;
      return acc;
    }, { students: 0, due: 0, paid: 0 });
  }, [site]);

  const visibleCases = cases.filter((c) => inSite(c.site));
  const overdueTotal = visibleCases.reduce((s, c) => s + c.overdue, 0);

  const exams = EXAM_FEES.filter((e) => inSite(e.site)).map((e) => {
    const collected = e.unit * e.paid;
    return { ...e, collected, ...splitExamFee(collected, 40_000 * e.paid) };
  });
  const examTotals = exams.reduce((t, e) => ({
    collected: t.collected + e.collected, retained: t.retained + e.retained, toRemit: t.toRemit + e.toRemit,
    paid: t.paid + e.paid, candidates: t.candidates + e.candidates,
  }), { collected: 0, retained: 0, toRemit: 0, paid: 0, candidates: 0 });

  const act = (id, patch, message) => {
    setCases((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    setToast(message);
    setTimeout(() => setToast(null), 3500);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Mardi 13 octobre 2026 · Année 2026-2027</p>
          <h1 className="text-2xl font-semibold text-navy-900">Tableau de bord Direction</h1>
          <p className="text-sm text-slate-500">Connectée en tant que {account.name} · droits d'administration complets</p>
        </div>
        <SiteSwitch value={site} onChange={setSite} />
      </div>

      {/* Bandeau : octobre sauté */}
      <div className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-3">
          <Icon name="clock" className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
          <div>
            <p className="text-sm font-semibold text-amber-900">Octobre : cycle de relance d'écolage suspendu</p>
            <p className="text-sm text-amber-800">
              Mois d'encaissement des droits d'examen. Les dossiers ouverts en septembre sont gelés ;
              reprise automatique des relances le 2 novembre.
            </p>
          </div>
        </div>
        <DunningCalendar />
      </div>

      {/* Indicateurs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Élèves inscrits" value={kpi.students} hint={site === 'ALL' ? 'Tana + Tamatave' : SITES.find((s) => s.id === site).name} />
        <Stat
          label="Recouvrement écolage (cumul)"
          value={fmtPct(pct(kpi.paid, kpi.due))}
          hint={`${formatAr(kpi.paid)} / ${formatAr(kpi.due)}`}
          tone={pct(kpi.paid, kpi.due) >= 90 ? 'green' : 'amber'}
        />
        <Stat label="Impayés en recouvrement" value={formatAr(overdueTotal)} hint={`${visibleCases.length} dossiers ouverts`} tone="red" />
        <Stat
          label="Dossiers candidats libres"
          value={`${CANDIDATE_FILES.complete} / ${CANDIDATE_FILES.total}`}
          hint="Dépôt avant le 30 octobre"
          tone="amber"
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        {/* Alertes d'écolage */}
        <Card
          className="xl:col-span-2"
          title="Alertes d'écolage"
          subtitle="Relance automatique → Avertissement 48 h → Notification de mise à pied (validée par la Direction)"
        >
          <ol className="mb-4 grid grid-cols-3 gap-2">
            {DUNNING_STAGES.map((s, i) => {
              const n = visibleCases.filter((c) => c.stage === s.key).length;
              const tone = ['border-navy-200 bg-navy-50', 'border-amber-200 bg-amber-50', 'border-red-200 bg-red-50'][i];
              return (
                <li key={s.key} className={`rounded-lg border p-2.5 ${tone}`}>
                  <p className="text-xs font-medium text-slate-600">{i + 1}. {s.label}</p>
                  <p className="text-lg font-semibold tabular-nums text-slate-900">{n}</p>
                  <p className="text-[11px] text-slate-500">{s.delay}</p>
                </li>
              );
            })}
          </ol>

          <div className="-mx-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-y border-slate-100 bg-slate-50 text-left text-xs text-slate-500">
                  <th className="px-4 py-2 font-medium">Élève</th>
                  <th className="px-2 py-2 font-medium">Site</th>
                  <th className="px-2 py-2 text-right font-medium">Impayé</th>
                  <th className="px-2 py-2 font-medium">Étape</th>
                  <th className="px-4 py-2 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {visibleCases.map((c) => (
                  <tr key={c.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-slate-900">{c.student}</p>
                      <p className="text-xs text-slate-500">{c.cls} · {c.guardian}</p>
                    </td>
                    <td className="px-2"><Badge>{c.site === 'TMV' ? 'Tamatave' : 'Tana'}</Badge></td>
                    <td className="whitespace-nowrap px-2 text-right tabular-nums">{formatAr(c.overdue)}</td>
                    <td className="px-2">
                      <Badge tone={STAGE_UI[c.stage].tone}>{STAGE_UI[c.stage].label}</Badge>
                      {c.pendingValidation && <p className="mt-0.5 text-[11px] font-medium text-red-700">En attente de validation</p>}
                      {c.notified && <p className="mt-0.5 text-[11px] text-slate-500">Notifiée au parent</p>}
                    </td>
                    <td className="px-4 text-right">
                      {c.pendingValidation ? (
                        <div className="flex justify-end gap-1.5">
                          <Button variant="secondary" onClick={() => act(c.id, { stage: 'DELAI', pendingValidation: false }, `Délai de paiement accordé à ${c.guardian}.`)}>
                            Accorder un délai
                          </Button>
                          <Button variant="danger" onClick={() => act(c.id, { pendingValidation: false, notified: true }, `Mise à pied notifiée à ${c.guardian} (SMS + e-mail).`)}>
                            Valider
                          </Button>
                        </div>
                      ) : (
                        <Button variant="ghost" onClick={() => act(c.id, { notified: true }, `Message envoyé à ${c.guardian}.`)}>
                          <Icon name="bell" /> Notifier
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {toast && (
            <p role="status" className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              <Icon name="check" /> {toast}
            </p>
          )}
        </Card>

        {/* Sites */}
        <Card title="Gestion des deux sites" subtitle="Effectifs et recouvrement par campus">
          <div className="space-y-4">
            {SITES.map((s) => {
              const k = SITE_KPIS[s.id];
              const rate = pct(k.tuitionPaid, k.tuitionDue);
              const dim = site !== 'ALL' && site !== s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => setSite(site === s.id ? 'ALL' : s.id)}
                  className={`block w-full rounded-lg border p-3 text-left transition ${dim ? 'border-slate-100 opacity-50' : 'border-slate-200 hover:border-navy-200'}`}
                >
                  <div className="flex items-center justify-between">
                    <p className="flex items-center gap-1.5 font-semibold text-slate-900"><Icon name="pin" className="h-4 w-4 text-navy-500" />{s.name}</p>
                    <span className="text-sm tabular-nums text-slate-600">{k.students} élèves</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {Object.entries(k.byCycle).map(([c, n]) => <Badge key={c}>{c} {n}</Badge>)}
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                    <span>Écolage encaissé</span><span className="tabular-nums">{fmtPct(rate)}</span>
                  </div>
                  <Progress value={rate} tone={rate >= 90 ? 'green' : 'amber'} />
                  <p className="mt-2 text-xs text-slate-500">{k.openCases} dossiers d'impayés · {k.absencesToday} absences aujourd'hui</p>
                </button>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Comptabilité séparée */}
      <Card title="Comptabilité séparée" subtitle="Deux journaux étanches : aucun flux commun entre écolage et droits d'examen">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="rounded-lg border border-navy-100 bg-navy-50/50 p-3">
            <Badge tone="navy">Journal ÉCOLAGE</Badge>
            <dl className="mt-3 space-y-1.5 text-sm">
              <div className="flex justify-between"><dt className="text-slate-600">Attendu à date</dt><dd className="tabular-nums">{formatAr(kpi.due)}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-600">Encaissé</dt><dd className="tabular-nums font-medium text-emerald-700">{formatAr(kpi.paid)}</dd></div>
              <div className="flex justify-between border-t border-navy-100 pt-1.5"><dt className="text-slate-600">Reste à recouvrer</dt><dd className="tabular-nums font-semibold text-red-700">{formatAr(kpi.due - kpi.paid)}</dd></div>
            </dl>
            <p className="mt-3 text-xs text-slate-500">1re/Tle Tamatave : échéancier clos en mai (départ à Tana).</p>
          </div>

          <div className="min-w-0 rounded-lg border border-violet-200 bg-violet-50/40 p-3 lg:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Badge tone="violet">Journal DROITS D'EXAMEN</Badge>
              <span className="text-xs text-slate-500">{examTotals.paid} / {examTotals.candidates} candidats ont réglé</span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-md bg-white p-2"><p className="text-[11px] text-slate-500">Encaissé</p><p className="text-sm font-semibold tabular-nums">{formatAr(examTotals.collected)}</p></div>
              <div className="rounded-md bg-white p-2"><p className="text-[11px] text-slate-500">À reverser aux centres</p><p className="text-sm font-semibold tabular-nums text-violet-700">{formatAr(examTotals.toRemit)}</p></div>
              <div className="rounded-md bg-white p-2"><p className="text-[11px] text-slate-500">Frais de dossier conservés</p><p className="text-sm font-semibold tabular-nums text-emerald-700">{formatAr(examTotals.retained)}</p></div>
            </div>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[520px] text-xs">
                <thead><tr className="text-left text-slate-500"><th className="py-1 font-medium">Examen</th><th className="font-medium">Site</th><th className="font-medium">Centre</th><th className="text-right font-medium">Payés</th><th className="text-right font-medium">À reverser</th></tr></thead>
                <tbody>
                  {exams.map((e, i) => (
                    <tr key={i} className="border-t border-violet-100">
                      <td className="py-1.5 font-medium text-slate-800">{e.exam} <span className="font-normal text-slate-500">({e.level})</span></td>
                      <td>{e.site === 'TMV' ? 'Tamatave' : 'Tana'}</td>
                      <td className="text-slate-600">{e.center.replace('Lycée Français', 'LF')}</td>
                      <td className="text-right tabular-nums">{e.paid}/{e.candidates}</td>
                      <td className="text-right tabular-nums">{formatAr(e.toRemit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-slate-500">L'école conserve 40 000 Ar par élève ; le reste est un dû envers le centre d'examen, jamais un produit.</p>
          </div>
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Mobilité */}
        <Card
          title="Mobilité inter-sites"
          subtitle={TRANSFER.label}
          action={<Badge tone="navy">Bascule le 12/04/2027</Badge>}
        >
          <div className="flex items-center gap-3">
            <div className="flex-1 rounded-lg bg-slate-50 p-3 text-center">
              <p className="text-xs text-slate-500">Tamatave</p>
              <p className="text-lg font-semibold">{TRANSFER.students['1re'] + TRANSFER.students.Terminale}</p>
              <p className="text-xs text-slate-500">{TRANSFER.students['1re']} 1re · {TRANSFER.students.Terminale} Tle</p>
            </div>
            <Icon name="swap" className="h-6 w-6 shrink-0 text-navy-500" />
            <div className="flex-1 rounded-lg bg-navy-50 p-3 text-center">
              <p className="text-xs text-slate-500">Tana · épreuves au LF</p>
              <p className="text-lg font-semibold">avril → juin</p>
              <p className="text-xs text-slate-500">classes d'accueil à affecter</p>
            </div>
          </div>
          <ul className="mt-4 space-y-2 text-sm">
            <li className="flex gap-2"><Icon name="check" className="mt-0.5 h-4 w-4 text-emerald-600" />Notes, bulletins et factures restent attachés à l'inscription : aucune donnée déplacée.</li>
            <li className="flex gap-2"><Icon name="check" className="mt-0.5 h-4 w-4 text-emerald-600" />Affectation géographique historisée (Tamatave sept.→avril, Tana avril→juillet).</li>
            <li className="flex gap-2"><Icon name="alert" className="mt-0.5 h-4 w-4 text-amber-600" />Quitus financier : {TRANSFER.clearance.ok} élèves à jour, {TRANSFER.clearance.pending} à suivre (mai = dernier mois payable).</li>
          </ul>
          <Button variant="secondary" className="mt-4" disabled title="Disponible à partir de mars">Préparer la campagne de transfert</Button>
        </Card>

        {/* Calendrier */}
        <Card title="Examens & dossiers externes" subtitle="Académie de La Réunion · candidats libres">
          <div className="mb-4">
            <div className="mb-1 flex justify-between text-xs text-slate-600">
              <span>Dossiers DNB / Bac déposés</span>
              <span className="tabular-nums">{CANDIDATE_FILES.complete} complets · {CANDIDATE_FILES.incomplete} incomplets · {CANDIDATE_FILES.toBuild} à constituer</span>
            </div>
            <Progress value={pct(CANDIDATE_FILES.complete, CANDIDATE_FILES.total)} tone="amber" />
          </div>
          <ol className="relative space-y-3 border-l border-slate-200 pl-4">
            {YEAR_MILESTONES.map((m) => (
              <li key={m.title} className="relative">
                <span className={`absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full ring-2 ring-white ${m.state === 'now' ? 'bg-amber-500' : 'bg-slate-300'}`} />
                <p className="text-sm"><span className="font-semibold text-navy-900">{m.month}</span> — {m.title}{m.state === 'now' && <Badge tone="amber" className="ml-2">En cours</Badge>}</p>
                <p className="text-xs text-slate-500">{m.detail}</p>
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </div>
  );
}
