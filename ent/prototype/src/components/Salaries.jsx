import React, { useState } from 'react';
import { Badge, Button, Card, Stat } from './ui.jsx';
import SignaturePad from './SignaturePad.jsx';
import { STAFF } from '../data/people.js';
import { BANKS } from '../data/accounting.js';
import { rateOn, rateHistory, payOf } from '../rules/payroll.js';
import { formatAr } from '../rules/finance.js';
import { expectedCash, salaryWindow } from '../rules/cashControl.js';
import { staffStatus } from './StaffModule.jsx';
import { today } from '../clock.js';

// Salaires du personnel : rubrique de sortie à part. Les professeurs sont payés à l'heure de cours
// effectuée face aux élèves (heures proposées d'après les appels, corrigées par la Direction). La Direction prépare et valide l'état de paie
// du mois ; le Bureau paie. En espèces, le salarié émarge (signe) au moment du paiement et la sortie
// de caisse est créée ; par virement, on note la référence. Tout est tracé dans l'historique.

const TODAY = today();
const MONTH = '2026-10';
const MONTH_START = '2026-10-01';
const now = () => `13/10/2026 ${new Date().toTimeString().slice(0, 5)}`;
const inputCls = 'rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm';
const fmt = (iso) => iso.split('-').reverse().join('/');

export const cashSalariesPaid = (payroll, payments) => payroll.filter((p) => p.method === 'ESPECES').every((p) => payments.some((x) => x.staffId === p.staffId && x.month === MONTH));

export default function Salaries({ role, actor, settings, payroll, setPayroll, rates, setRates, payments, setPayments, validated, setValidated, movements, setMovements, setAudit, safe }) {
  const isDirection = role === 'DIRECTION';
  // le secrétariat prépare et paie sans attendre la Direction ; seuls les taux horaires restent à la Direction
  const canPrepare = isDirection || role === 'BUREAU';
  const [paying, setPaying] = useState(null);
  const [signature, setSignature] = useState(null);
  const [ref, setRef] = useState({ ref: '', bank: 'BOA Madagascar' });
  const staffOf = (id) => STAFF.find((s) => s.id === id);
  const rows = payroll.filter((p) => staffStatus(staffOf(p.staffId), TODAY).active).map((p) => {
    const hourly = p.byHour ? rateOn(rates, p.staffId, MONTH_START) : null;
    return { ...p, hourly, amount: payOf(p, hourly) };
  });
  const [newRate, setNewRate] = useState({ staffId: '', rate: '', from: '2027-01-01' });
  const teachers = STAFF.filter((x) => x.poste === 'Enseignant.e' || rates.some((r) => r.staffId === x.id));
  const edit = (id, patch) => setPayroll(payroll.map((x) => (x.staffId === id ? { ...x, ...patch } : x)));
  const num = (v) => Number(String(v).replace(/\D/g, '')) || 0;
  const paidOf = (id) => payments.find((x) => x.staffId === id && x.month === MONTH);
  const total = rows.reduce((s, p) => s + p.amount, 0);
  const cashRows = rows.filter((p) => p.method === 'ESPECES');
  const cashTotal = cashRows.reduce((s, p) => s + p.amount, 0);
  const cashLeft = cashRows.filter((p) => !paidOf(p.staffId)).reduce((s, p) => s + p.amount, 0);
  const cash = expectedCash(safe.morning, movements);
  const win = salaryWindow(TODAY, settings.calendar, { paid: cashSalariesPaid(rows, payments) });
  const log = (e) => setAudit((a) => [e, ...a]);

  const pay = (p) => {
    const s = staffOf(p.staffId);
    if (p.method === 'ESPECES') {
      setMovements([...movements, { id: `s${Date.now()}`, date: TODAY, time: new Date().toTimeString().slice(0, 5), dir: 'OUT', nature: 'Salaires', journal: 'ECOLAGE', label: `Salaire d'octobre — ${s.name}`, method: 'Espèces', amount: p.amount, agent: actor }]);
    }
    setPayments([...payments, { staffId: p.staffId, month: MONTH, amount: p.amount, method: p.method, signature: p.method === 'ESPECES' ? signature : null, ref: p.method === 'VIREMENT' ? `${ref.bank} n° ${ref.ref}` : null, by: actor, at: now() }]);
    log({ at: now(), by: actor, action: 'Salaire payé', receipt: '—', detail: `${s.name} · ${formatAr(p.amount)} · ${p.method === 'ESPECES' ? 'espèces, émargé' : `virement ${ref.ref}`}` });
    setPaying(null); setSignature(null); setRef({ ...ref, ref: '' });
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Masse salariale d'octobre" value={formatAr(total)} hint={`${rows.length} salariés`} />
        <Stat label="Dont en espèces" value={formatAr(cashTotal)} hint={`${cashRows.length} salariés`} />
        <Stat label="Espèces restant à payer" value={formatAr(cashLeft)} tone={cashLeft > cash ? 'red' : undefined} />
        <Stat label="Espèces en caisse" value={formatAr(cash)} tone={cashLeft > cash ? 'red' : 'green'} hint={cashLeft > cash ? `manque ${formatAr(cashLeft - cash)}` : 'suffisant pour les salaires'} />
      </div>

      <p className="rounded-2xl bg-navy-50 p-3 text-sm text-navy-900">
        <strong>Semaine des salaires :</strong> du lundi {fmt(win.start)} (dernière semaine de cours d'octobre, les vacances commençant après le {fmt(win.lastSchoolDay)}) jusqu'au paiement des salaires.
        Pendant cette période, pas de rappel de versement : les espèces restent au secrétariat. Les rappels reprennent dès que les salaires en espèces sont payés.
      </p>

      <Card title="État de paie — octobre 2026" subtitle={`Préparé et payé par le secrétariat ; la Direction voit chaque paiement et reçoit le récapitulatif${validated ? ` · vu par ${validated.by} le ${validated.at}` : ''}`}
        action={<span className="flex items-center gap-2"><Badge tone={rows.every((p) => paidOf(p.staffId)) ? 'green' : 'amber'}>{rows.filter((p) => paidOf(p.staffId)).length} / {rows.length} payés</Badge>{isDirection && !validated && <Button variant="secondary" onClick={() => { setValidated({ by: actor, at: now() }); log({ at: now(), by: actor, action: 'État de paie vu par la Direction', receipt: '—', detail: `Octobre 2026 · ${formatAr(total)}` }); }}>Marquer comme vu</Button>}</span>}>
        <div className="-mx-5 overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-y border-slate-100 bg-slate-50 text-left text-xs text-slate-500">
                <th className="px-4 py-2 font-medium">Salarié</th><th className="px-2 font-medium">Poste / contrat</th><th className="px-2 text-right font-medium">Heures face aux élèves × taux / net</th>
                <th className="px-2 font-medium">Mode</th><th className="px-4 font-medium">Paiement</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const s = staffOf(p.staffId);
                const done = paidOf(p.staffId);
                return (
                  <tr key={p.staffId} className="border-b border-slate-100 align-top last:border-0">
                    <td className="px-4 py-2 font-medium text-slate-800">{s.name}{p.note && <span className="block text-xs font-normal text-slate-500">{p.note}</span>}</td>
                    <td className="px-2 py-2 text-slate-600">{s.poste}<span className="block text-xs text-slate-500">{s.contrat}</span></td>
                    <td className="px-2 py-2 text-right">
                      {p.hourly ? (
                        <div className="text-xs text-slate-600">
                          {canPrepare && !done ? (
                            <span className="inline-flex items-center gap-1">
                              <input inputMode="numeric" value={p.hours} aria-label={`Heures — ${s.name}`} onChange={(e) => edit(p.staffId, { hours: num(e.target.value) })} className="w-14 rounded-md border border-slate-300 px-1.5 py-1 text-right tabular-nums" /> h ×
                              <span className="tabular-nums">{formatAr(p.hourly ?? 0)}</span>
                            </span>
                          ) : <span className="tabular-nums">{p.hours} h × {formatAr(p.hourly)}</span>}
                          <span className={`block ${p.hours < p.plannedHours ? 'text-amber-700' : ''}`}>prévues à l'emploi du temps : {p.plannedHours} h{p.hours < p.plannedHours ? ` (${p.plannedHours - p.hours} h non faites)` : ''}</span>
                        </div>
                      ) : canPrepare && !done ? (
                        <input inputMode="numeric" value={p.monthly} aria-label={`Salaire mensuel — ${s.name}`} onChange={(e) => edit(p.staffId, { monthly: num(e.target.value) })} className="w-28 rounded-md border border-slate-300 px-2 py-1 text-right tabular-nums" />
                      ) : <span className="text-xs text-slate-500">mensuel</span>}
                      <span className="block font-semibold tabular-nums">{formatAr(p.amount)}</span>
                    </td>
                    <td className="px-2 py-2">
                      {canPrepare && !done
                        ? <select value={p.method} aria-label={`Mode — ${s.name}`} onChange={(e) => edit(p.staffId, { method: e.target.value })} className="rounded-md border border-slate-300 px-1.5 py-1 text-xs"><option value="ESPECES">Espèces</option><option value="VIREMENT">Virement</option></select>
                        : <Badge tone={p.method === 'ESPECES' ? 'amber' : 'navy'}>{p.method === 'ESPECES' ? 'Espèces' : 'Virement'}</Badge>}
                    </td>
                    <td className="px-4 py-2">
                      {done ? (
                        <span className="flex items-center gap-2 text-xs text-emerald-700">Payé le {done.at}{done.signature && <img src={done.signature} alt={`Émargement de ${s.name}`} className="h-8 rounded border border-slate-200 bg-white" />}{done.ref && ` · ${done.ref}`}</span>
                      ) : paying === p.staffId ? (
                        <div className="space-y-2">
                          {p.method === 'ESPECES' ? (
                            <>
                              <p className="text-xs text-slate-600">Émargement : {s.name} signe pour {formatAr(p.amount)} reçus en espèces.</p>
                              <SignaturePad onChange={setSignature} height={90} label="Signature du salarié" />
                            </>
                          ) : (
                            <div className="flex gap-2">
                              <select value={ref.bank} onChange={(e) => setRef({ ...ref, bank: e.target.value })} className={inputCls} aria-label="Banque">{BANKS.map((b) => <option key={b}>{b}</option>)}</select>
                              <input value={ref.ref} onChange={(e) => setRef({ ...ref, ref: e.target.value })} placeholder="Référence du virement" className={inputCls} aria-label="Référence du virement" />
                            </div>
                          )}
                          <div className="flex gap-2">
                            <Button className="!py-1 text-xs" disabled={p.method === 'ESPECES' ? !signature || p.amount > cash : !ref.ref.trim()} onClick={() => pay(p)}>Confirmer le paiement</Button>
                            <Button variant="ghost" className="!py-1 text-xs" onClick={() => { setPaying(null); setSignature(null); }}>Annuler</Button>
                          </div>
                          {p.method === 'ESPECES' && p.amount > cash && <p className="text-xs text-red-700">Espèces insuffisantes en caisse.</p>}
                        </div>
                      ) : <Button variant="secondary" className="!px-2 !py-1 text-xs" onClick={() => { setPaying(p.staffId); setSignature(null); }}>Payer</Button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-slate-500">Professeurs vacataires : payés uniquement pour les heures de cours faites, rien pendant les vacances scolaires. Taux horaire : celui en vigueur au mois payé (voir l'historique ci-dessous).</p>
        <p className="mt-1 text-xs text-slate-500">Chaque salaire payé en espèces crée une sortie « Salaires » dans la caisse, avec l'émargement du salarié. Les heures des professeurs sont proposées d'après l'emploi du temps du mois moins les absences déclarées (avec le serveur : les appels validés), et corrigées si besoin avant le paiement.</p>
      </Card>

      <Card title="Taux horaires des professeurs" subtitle={isDirection ? 'Historique des augmentations ; un nouveau taux s\'applique à partir de sa date d\'effet' : 'Consultation : seule la Direction fixe les taux'}>
        <div className="-mx-5 overflow-x-auto">
          <table className="w-full min-w-[620px] text-sm">
            <thead>
              <tr className="border-y border-slate-100 bg-slate-50 text-left text-xs text-slate-500">
                <th className="px-4 py-2 font-medium">Professeur</th><th className="px-2 text-right font-medium">Taux en octobre</th><th className="px-4 font-medium">Historique (date d'effet · taux · augmentation)</th>
              </tr>
            </thead>
            <tbody>
              {teachers.map((t) => (
                <tr key={t.id} className="border-b border-slate-100 align-top last:border-0">
                  <td className="px-4 py-2 font-medium text-slate-800">{t.name}<span className="block text-xs font-normal text-slate-500">{t.detail}</span></td>
                  <td className="px-2 py-2 text-right font-semibold tabular-nums">{rateOn(rates, t.id, MONTH_START) ? `${formatAr(rateOn(rates, t.id, MONTH_START))} / h` : '—'}</td>
                  <td className="px-4 py-2">
                    <ul className="space-y-0.5 text-xs text-slate-600">
                      {rateHistory(rates, t.id).map((r) => (
                        <li key={r.from} className={r.from > MONTH_START ? 'text-navy-700' : ''}>{fmt(r.from)} · {formatAr(r.rate)} / h{r.increase !== null ? ` · +${String(r.increase).replace('.', ',')} %` : ' · taux initial'}{r.from > MONTH_START ? ' (à venir)' : ''}</li>
                      ))}
                    </ul>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {isDirection && (
          <div className="mt-4 grid gap-2 rounded-lg bg-slate-50 p-3 text-sm sm:grid-cols-[1fr_140px_160px_auto] sm:items-end">
            <label className="text-xs text-slate-600">Professeur
              <select value={newRate.staffId} onChange={(e) => setNewRate({ ...newRate, staffId: e.target.value })} className={`mt-1 w-full ${inputCls}`}><option value="">Choisir…</option>{teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
            </label>
            <label className="text-xs text-slate-600">Nouveau taux (Ar / h)
              <input inputMode="numeric" value={newRate.rate} onChange={(e) => setNewRate({ ...newRate, rate: e.target.value.replace(/\D/g, '') })} className={`mt-1 w-full ${inputCls}`} />
            </label>
            <label className="text-xs text-slate-600">À partir du
              <input type="date" value={newRate.from} onChange={(e) => setNewRate({ ...newRate, from: e.target.value })} className={`mt-1 w-full ${inputCls}`} />
            </label>
            <Button disabled={!newRate.staffId || !(Number(newRate.rate) > 0) || !newRate.from || rates.some((r) => r.staffId === newRate.staffId && r.from === newRate.from)} onClick={() => {
              setRates([...rates, { staffId: newRate.staffId, rate: Number(newRate.rate), from: newRate.from }]);
              log({ at: now(), by: actor, action: 'Taux horaire modifié', receipt: '—', detail: `${staffOf(newRate.staffId).name} · ${formatAr(Number(newRate.rate))} / h à partir du ${fmt(newRate.from)}` });
              setNewRate({ ...newRate, staffId: '', rate: '' });
            }}>Enregistrer</Button>
          </div>
        )}
        <p className="mt-2 text-xs text-slate-500">Les taux réels seront importés depuis le fichier de l'établissement (professeur, taux, date d'effet) ; ils restent confidentiels.</p>
      </Card>
    </div>
  );
}
