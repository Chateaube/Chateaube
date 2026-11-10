import React, { useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card } from './ui.jsx';
import { CASH_ACCOUNTS, feesFor } from './CollectPayment.jsx';
import { REDUCTION_TYPES } from '../data/accounting.js';
import { studentDues } from '../rules/billing.js';
import { manualBlocks } from '../rules/manuals.js';
import { formatAr } from '../rules/finance.js';
import { loadManuals } from '../manualsStore.js';
import { loadLibrary } from '../libraryStore.js';
import { toBill } from '../rules/library.js';
import { pickupStatus, pickupUntil, PICKUP_LABEL } from '../rules/bulletinPickup.js';
import { publishAnnouncement } from '../announcementsStore.js';
import { loadProfiles, profileKey } from '../profilesStore.js';
import { STUDENT_PROFILES } from '../data/enrollment.js';
import { today } from '../clock.js';
import { meLabel } from '../identity.js';

/** Responsables connus de l'élève (fiche) : on les choisit au lieu de taper le nom. */
const guardiansOf = (s) => ([...loadProfiles(), ...STUDENT_PROFILES].find((p) => profileKey(p) === s)?.guardians ?? []);
// Règlement : le bulletin du 1er trimestre est remis en mains propres aux responsables (réunion
// parents-professeurs) ; aux 2e et 3e trimestres, confié à l'élève (proposé d'abord) ou remis à un responsable.
const firstChoice = (s, term) => (term !== 'T1' ? 'ELEVE' : guardiansOf(s).length ? 'G0' : 'ELEVE');

// Fenêtre de retrait par trimestre et par classe (démonstration : gardée dans ce navigateur)
const WKEY = 'ent-bulletin-dispo-v1';
export const loadWindows = () => { try { return JSON.parse(localStorage.getItem(WKEY)) ?? {}; } catch { return {}; } };
const saveWindows = (d) => { try { localStorage.setItem(WKEY, JSON.stringify(d)); } catch { /* stockage indisponible */ } };
const fr = (iso) => (iso ? iso.split('-').reverse().join('/') : '');

// Remise des bulletins en main propre (avec le tampon) : jamais publiés dans l'application.
// Un bulletin n'est pas remis tant que des frais échus restent impayés ou qu'un manuel est dû ;
// seule la Direction peut lever le blocage, avec un motif.

const TODAY = today();
const KEY = 'ent-remise-v1';
const inputCls = 'rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm';
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) ?? {}; } catch { return {}; } };

/** Ce qui bloque la remise : frais échus non payés (tous journaux) et manuels dus. */
export function handoverBlocks(student, settings, manualsData) {
  const reasons = [];
  const acc = CASH_ACCOUNTS.find((a) => a.name === student);
  const fees = acc && feesFor(acc, manualsData.manuals);
  if (acc && fees) {
    const type = acc.reduction && REDUCTION_TYPES.find((t) => t.id === acc.reduction.typeId);
    const reduction = type ? { label: type.label, rates: type.rates } : null;
    const overdue = studentDues({ ...acc, reduction }, fees, settings, TODAY).filter((i) => i.status === 'ECHU');
    if (overdue.length) reasons.push(`Frais impayés : ${overdue.map((i) => i.short ?? i.label).join(', ')} (${formatAr(overdue.reduce((s, i) => s + i.amount, 0))})`);
  }
  // livres de la salle d'étude en retard : bloquent comme un manuel
  const late = toBill(loadLibrary().loans, TODAY).filter((l) => l.borrower === student);
  if (late.length) reasons.push(`Livre de la salle d'étude non rendu, facturé et non réglé : ${late.map((l) => l.code).join(', ')}`);
  return [...reasons, ...manualBlocks(student, manualsData.loans, manualsData.manuals, TODAY)];
}

export default function BulletinHandover({ cls, students, settings, role, term }) {
  const [records, setRecords] = useState(load);
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(records)); } catch { /* stockage indisponible */ } }, [records]);
  const manualsData = useMemo(loadManuals, []);
  const [form, setForm] = useState({});
  const isDirection = role === 'DIRECTION';
  const actor = meLabel(isDirection ? 'DIRECTION' : 'BUREAU');
  const key = (s) => `${term}|${cls}|${s}`;
  const rows = students.map((s) => ({ s, blocks: handoverBlocks(s, settings, manualsData), rec: records[key(s)] }));
  const given = rows.filter((r) => r.rec?.givenAt).length;
  const blocked = rows.filter((r) => r.blocks.length && !r.rec?.override && !r.rec?.givenAt).length;
  const set = (s, patch) => setForm({ ...form, [s]: { to: firstChoice(s, term), name: '', motif: '', ...form[s], ...patch } });
  const [windows, setWindows] = useState(loadWindows);
  const wKey = `${term}|${cls}`;
  const w = windows[wKey];
  const [draftW, setDraftW] = useState({ from: w?.from ?? new Date().toISOString().slice(0, 10), days: w?.days ?? 14 });
  const today = new Date().toISOString().slice(0, 10);
  const statusOf = (r) => pickupStatus(today, w, { given: !!r.rec?.givenAt, blocked: r.blocks.length > 0 && !r.rec?.override });
  const archived = rows.filter((r) => statusOf(r) === 'ARCHIVE');
  const termLabel = { T1: '1er trimestre', T2: '2e trimestre', T3: '3e trimestre' }[term] ?? term;
  const announce = (win) => publishAnnouncement({
    title: `Bulletins du ${termLabel} — ${cls}`, author: 'Direction', pinned: false, ack: true, photos: [], email: true,
    text: `Les bulletins du ${termLabel} sont à retirer au secrétariat, avec le tampon, du ${fr(win.from)} au ${fr(pickupUntil(win))}. Passé ce délai, le bulletin est archivé au dossier et remis sur rendez-vous. Si votre situation est à régulariser, merci de passer au secrétariat.`,
    audience: { roles: ['PARENT'], site: 'TMV', scope: 'CLASS', values: [cls] },
  });

  return (
    <>
    <Card title="Disponibilité des bulletins" subtitle={isDirection ? 'Fixez la date et le délai de retrait ; les familles sont prévenues dans l\'application' : 'Fixés par la Direction'} className="mb-4">
      {w && <p className="mb-2 text-sm text-slate-700">Disponibles du <strong>{fr(w.from)}</strong> au <strong>{fr(pickupUntil(w))}</strong> ({w.days} jours){w.announcedAt ? ` · familles prévenues le ${fr(w.announcedAt)}` : ''}.</p>}
      {isDirection && (
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs text-slate-600">À partir du<input type="date" value={draftW.from} onChange={(e) => setDraftW({ ...draftW, from: e.target.value })} className={`mt-1 block ${inputCls}`} /></label>
          <label className="text-xs text-slate-600">Délai de retrait<select value={draftW.days} onChange={(e) => setDraftW({ ...draftW, days: Number(e.target.value) })} className={`mt-1 block ${inputCls}`}>{[7, 14, 21, 30].map((d) => <option key={d} value={d}>{d} jours</option>)}</select></label>
          <Button onClick={() => { const win = { ...draftW, announcedAt: today }; announce(win); const next = { ...windows, [wKey]: win }; setWindows(next); saveWindows(next); }}>{w ? 'Modifier et prévenir les familles' : 'Rendre disponibles et prévenir les familles'}</Button>
        </div>
      )}
      <p className="mt-2 text-xs text-slate-500">Un rappel part {3} jours avant la fin. Les familles dont la situation est à régulariser voient « en attente de régularisation, voir le secrétariat ». Passé le délai, le bulletin n'est pas détruit : il est archivé au dossier et remis sur rendez-vous.</p>
      {archived.length > 0 && <p className="mt-2 text-sm text-slate-700">Non retirés, archivés au dossier : {archived.map((r) => r.s).join(', ')}.</p>}
    </Card>
    <Card title={term === 'T1' ? `Remise en mains propres — ${cls}` : `Remise des bulletins — ${cls}`} subtitle={term === 'T1' ? 'Bulletin du 1er trimestre : remis en mains propres aux responsables lors de la réunion parents-professeurs (règlement intérieur)' : '2e et 3e trimestres : confié à l\'élève (suivi dans le passeport) ou remis à un responsable, au choix'}
      action={<span className="flex gap-2"><Badge tone="green">{given} remis</Badge>{blocked > 0 && <Badge tone="red">{blocked} bloqué{blocked > 1 ? 's' : ''}</Badge>}</span>}>
      <ul className="divide-y divide-slate-100">
        {rows.map(({ s, blocks, rec }) => {
          const f = { to: firstChoice(s, term), name: '', motif: '', ...form[s] };
          const gs = guardiansOf(s);
          const givenTo = f.to === 'ELEVE' ? `l'élève (${s})` : f.to === 'AUTRE' ? f.name.trim() : `${gs[Number(f.to.slice(1))]?.name} (${gs[Number(f.to.slice(1))]?.relation?.toLowerCase() ?? 'responsable'})`;
          const canGive = !blocks.length || rec?.override;
          return (
            <li key={s} className="py-3 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-slate-800">{s} {w && <Badge tone={PICKUP_LABEL[statusOf({ s, blocks, rec })][0]}>{PICKUP_LABEL[statusOf({ s, blocks, rec })][1]}</Badge>}</p>
                  {!rec?.givenAt && blocks.map((b) => <p key={b} className="text-xs text-red-700">{b}</p>)}
                  {rec?.override && <p className="text-xs text-amber-700">Blocage levé par {rec.override.by} : {rec.override.motif}</p>}
                  {rec?.givenAt && <p className="text-xs text-emerald-700">Remis le {rec.givenAt} à {rec.givenTo} · par {rec.givenBy}</p>}
                </div>
                {rec?.givenAt ? <Badge tone="green">Remis</Badge> : canGive ? (
                  <span className="flex flex-wrap items-center gap-1">
                    <select value={f.to} onChange={(e) => set(s, { to: e.target.value })} className="rounded-md border border-slate-300 px-1.5 py-1 text-xs" aria-label={`Remis à — ${s}`}>
                      {gs.map((g, i) => <option key={g.name} value={`G${i}`}>à {g.name} ({g.relation?.toLowerCase() ?? 'responsable'}){g.pickup === false ? ' — non autorisé(e) à récupérer' : ''}</option>)}
                      <option value="ELEVE">à l'élève</option><option value="AUTRE">à une autre personne…</option>
                    </select>
                    {f.to === 'AUTRE' && <input value={f.name} onChange={(e) => set(s, { name: e.target.value })} placeholder="Nom et lien avec l'élève" className="w-44 rounded-md border border-slate-300 px-2 py-1 text-xs" aria-label={`Nom — ${s}`} />}
                    <Button className="!px-2 !py-1 text-xs" disabled={f.to === 'AUTRE' && !f.name.trim()} onClick={() => setRecords({ ...records, [key(s)]: { ...rec, givenAt: '13/10/2026', givenBy: actor, givenTo } })}>{f.to === 'ELEVE' ? 'Confié à l\'élève' : 'Remis en mains propres'}</Button>
                  </span>
                ) : isDirection ? (
                  <span className="flex flex-wrap items-center gap-1">
                    <input value={f.motif} onChange={(e) => set(s, { motif: e.target.value })} placeholder="Motif (ex. échéancier accordé)" className={`w-52 text-xs ${inputCls}`} aria-label={`Motif — ${s}`} />
                    <Button variant="secondary" className="!px-2 !py-1 text-xs" disabled={f.motif.trim().length < 5} onClick={() => setRecords({ ...records, [key(s)]: { override: { by: actor, motif: f.motif.trim(), at: '13/10/2026' } } })}>Lever le blocage</Button>
                  </span>
                ) : <Badge tone="red">Bloqué</Badge>}
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-xs text-slate-500">Dès que la famille règle à la caisse, ou rend le manuel, le blocage disparaît. Les parents voient les notes dans l'application, jamais le bulletin.</p>
    </Card>
    </>
  );
}
