import React, { useMemo, useState } from 'react';
import { Badge, Button, Card, Icon } from './ui.jsx';
import { DUNNING_CASES, EXAM_FEES, SITE_KPIS, TODAY } from '../data/demo.js';
import { realData } from '../demoData.js';
import { CASH_ACCOUNTS, duesStatus } from './CollectPayment.jsx';
import { dunningStages, splitExamFee, formatAr } from '../rules/finance.js';
import { dunningSchedule, stageOn, formatDateFr, monthOf, monthName } from '../rules/calendar.js';
import { usePersistent } from '../persist.js';

// Finances (Caisse et comptabilité) : alertes de frais de scolarité (relances, avertissement, mise à pied)
// et les deux journaux séparés (frais de scolarité / droits d'examen). Retirés de l'accueil de la Direction.

const STAGE_UI = {
  DANS_LES_DELAIS: { tone: 'slate', label: 'Dans les délais' },
  RELANCE: { tone: 'navy', label: 'Relance' },
  AVERTISSEMENT: { tone: 'amber', label: 'Avertissement' },
  A_VALIDER: { tone: 'red', label: 'Mise à pied à valider' },
  MISE_A_PIED: { tone: 'red', label: 'Mise à pied notifiée' },
  DELAI: { tone: 'violet', label: 'Délai accordé' },
};
const shortDate = (iso) => formatDateFr(iso).replace(/ \d{4}$/, '');

/** Prochaine étape du recouvrement et sa date. */
function nextStep(stage, sch) {
  if (stage === 'DANS_LES_DELAIS') return `Relance le ${shortDate(sch.relance)}`;
  if (stage === 'RELANCE') return `Avertissement le ${shortDate(sch.warning)}`;
  if (stage === 'AVERTISSEMENT') return `Mise à pied le ${shortDate(sch.suspension)}`;
  return '—';
}

const pct = (a, b) => (b ? (a / b) * 100 : 0);
const fmtPct = (v) => `${v.toFixed(1).replace('.', ',')} %`;


/** Alertes de frais de scolarité : étapes calculées à partir des paramètres et d'une date de référence. */
export function DunningAlerts({ settings, site = 'TMV' }) {
  const [refDate, setRefDate] = useState(TODAY);
  const [decisions, setDecisions] = usePersistent('ent-s-relances-decisions', {});
  const [notified, setNotified] = usePersistent('ent-s-relances-envoyees', {});
  const [toast, setToast] = useState(null);
  // vraies données : les élèves dont des frais de scolarité sont en retard (comptes et paiements repris)
  const source = useMemo(() => (realData()
    ? duesStatus(CASH_ACCOUNTS, settings, TODAY, 'ECOLAGE').filter((x) => x.overdue > 0)
      .map((x) => ({ id: x.account.id, student: x.account.name, cls: x.account.cls, site: 'TMV', overdue: x.overdue, due: x.firstDue, guardian: x.account.family }))
    : DUNNING_CASES), [settings]);
  const cases = useMemo(() => source.map((c) => {
    const schedule = dunningSchedule(c.due, settings);
    const decision = { VALIDEE: 'MISE_A_PIED', DELAI: 'DELAI' }[decisions[c.id]];
    return { ...c, schedule, stage: decision ?? stageOn(refDate, schedule, settings) };
  }), [source, settings, refDate, decisions]);
  const stages = dunningStages(settings);
  const frozen = !settings.dunning.activeMonths.includes(monthOf(refDate));
  const visibleCases = cases.filter((c) => site === 'ALL' || c.site === site);
  const act = (id, decision, message) => {
    if (decision) setDecisions((d) => ({ ...d, [id]: decision }));
    else setNotified((n) => ({ ...n, [id]: true }));
    setToast(message);
    setTimeout(() => setToast(null), 3500);
  };
  return (
        <Card
                    title="Alertes de frais de scolarité"
          subtitle={frozen ? `Relances en pause en ${monthName(monthOf(refDate))} — reprise au premier jour de classe du mois suivant` : `Échéance le ${settings.tuition.dueDay} → relance → avertissement → mise à pied${settings.dunning.suspensionRequiresDirection ? ' (validée par la Direction)' : ''}`}
          action={
            <label className="flex items-center gap-2 text-xs text-slate-500">
              Date de référence
              <input type="date" value={refDate} onChange={(e) => e.target.value && setRefDate(e.target.value)}
                className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-800" />
            </label>
          }
        >
          <ol className="mb-4 grid grid-cols-3 gap-2">
            {stages.map((s, i) => {
              const keys = s.key === 'MISE_A_PIED' ? ['A_VALIDER', 'MISE_A_PIED'] : [s.key];
              const n = visibleCases.filter((c) => keys.includes(c.stage)).length;
              const tone = ['border-navy-200 bg-navy-50', 'border-amber-200 bg-amber-50', 'border-red-200 bg-red-50'][i];
              return (
                <li key={s.key} className={`rounded-xl border p-3 ${tone}`}>
                  <p className="text-xs font-medium text-slate-600">{i + 1}. {s.label}</p>
                  <p className="font-display text-2xl font-semibold tabular-nums text-slate-900">{n}</p>
                  <p className="text-[11px] text-slate-500">{s.delay}</p>
                </li>
              );
            })}
          </ol>

          <div className="-mx-5 overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-y border-slate-100 bg-slate-50 text-left text-xs text-slate-500">
                  <th className="px-4 py-2 font-medium">Élève</th>
                  <th className="px-2 py-2 font-medium">Site</th>
                  <th className="px-2 py-2 text-right font-medium">Impayé</th>
                  <th className="px-2 py-2 font-medium">Étape</th>
                  <th className="px-2 py-2 font-medium">Prochaine étape</th>
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
                      <p className="mt-0.5 text-[11px] text-slate-500">Échéance du {shortDate(c.due)}</p>
                      {notified[c.id] && <p className="text-[11px] text-slate-500">Message envoyé au parent</p>}
                    </td>
                    <td className="px-2 text-xs text-slate-600">{nextStep(c.stage, c.schedule)}</td>
                    <td className="px-4 text-right">
                      {c.stage === 'A_VALIDER' ? (
                        <div className="flex justify-end gap-1.5">
                          <Button variant="secondary" onClick={() => act(c.id, 'DELAI', `Délai de paiement accordé à ${c.guardian}.`)}>
                            Accorder un délai
                          </Button>
                          <Button variant="danger" onClick={() => act(c.id, 'VALIDEE', `Mise à pied notifiée à ${c.guardian}.`)}>
                            Valider
                          </Button>
                        </div>
                      ) : (
                        <Button variant="ghost" onClick={() => act(c.id, null, `Message envoyé à ${c.guardian}.`)}>
                          <Icon name="bell" /> Envoyer la relance
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

  );
}

/** Deux journaux séparés : frais de scolarité et droits d'examen (part reversée aux centres). */
export function SeparateJournals({ site = 'TMV', settings }) {
  const inSite = (s) => site === 'ALL' || s === site;
  const ids = site === 'ALL' ? Object.keys(SITE_KPIS) : [site];
  const real = realData() && settings;
  const kpi = real
    ? duesStatus(CASH_ACCOUNTS, settings, TODAY, 'ECOLAGE').reduce((acc, x) => ({ due: acc.due + x.due, paid: acc.paid + x.paid }), { due: 0, paid: 0 })
    : ids.reduce((acc, id) => { const k = SITE_KPIS[id]; acc.due += k.tuitionDue; acc.paid += k.tuitionPaid; return acc; }, { due: 0, paid: 0 });
  const exams = (realData() ? [] : EXAM_FEES).filter((e) => inSite(e.site)).map((e) => { const collected = e.unit * e.paid; return { ...e, collected, ...splitExamFee(collected, 40_000 * e.paid) }; });
  const examTotals = exams.reduce((t, e) => ({ collected: t.collected + e.collected, retained: t.retained + e.retained, toRemit: t.toRemit + e.toRemit, paid: t.paid + e.paid, candidates: t.candidates + e.candidates }), { collected: 0, retained: 0, toRemit: 0, paid: 0, candidates: 0 });
  return (
      <Card title="Comptabilité séparée" subtitle="Deux journaux étanches : aucun flux commun entre frais de scolarité et droits d'examen">
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

  );
}
