import React, { useMemo, useState } from 'react';
import { Badge, Button, Card } from './ui.jsx';
import { CLASS_FEES } from '../data/accounting.js';
import { reductionAmount } from '../rules/billing.js';
import { formatAr } from '../rules/finance.js';

// Réductions sur les frais de scolarité : types et taux fixés par la Direction, puis accordés
// élève par élève avec un motif. Le Bureau les consulte et les voit appliquées à l'encaissement.

const inputCls = 'rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm';
const rate = (t) => (t.kind === 'PERCENT' ? `−${t.value} %` : `−${formatAr(t.value)}`);

export default function Reductions({ canEdit, actor, types, setTypes, accounts, setAccounts }) {
  const [draft, setDraft] = useState({ studentId: '', typeId: types[0]?.id ?? '', motif: '' });
  const [cls, setCls] = useState('');
  const [tried, setTried] = useState(false);
  const granted = accounts.filter((a) => a.reduction);
  const classes = useMemo(() => [...new Set(accounts.map((a) => a.cls))], [accounts]);
  const candidates = accounts.filter((a) => (!cls || a.cls === cls) && !a.reduction);
  const errors = [!draft.studentId && 'Élève', !draft.typeId && 'Type de réduction', draft.motif.trim().length < 5 && 'Motif (ex. frère de …, enfant de Mme …)'].filter(Boolean);
  const monthly = (a, t) => {
    const fee = CLASS_FEES.find((f) => f.cls === a.cls)?.ecolage ?? 0;
    return reductionAmount(fee, t);
  };
  const updateType = (id, patch) => setTypes(types.map((t) => (t.id === id ? { ...t, ...patch } : t)));

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_380px] xl:items-start">
      <div className="space-y-5">
        <Card title="Types de réduction" subtitle={canEdit ? 'Taux fixés par la Direction, appliqués aux frais de scolarité mensuels' : 'Consultation : seule la Direction fixe les taux'}>
          <ul className="divide-y divide-slate-100">
            {types.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
                <span className="min-w-0 flex-1 font-medium text-slate-800">{t.label}</span>
                {canEdit ? (
                  <span className="flex items-center gap-1">
                    <input type="number" min={0} max={t.kind === 'PERCENT' ? 100 : undefined} value={t.value} onChange={(e) => updateType(t.id, { value: Math.max(0, Number(e.target.value) || 0) })} className={`w-24 text-right ${inputCls}`} aria-label={`Taux ${t.label}`} />
                    <select value={t.kind} onChange={(e) => updateType(t.id, { kind: e.target.value })} className={inputCls} aria-label={`Unité ${t.label}`}><option value="PERCENT">%</option><option value="AMOUNT">Ar / mois</option></select>
                  </span>
                ) : <Badge tone="navy">{rate(t)}</Badge>}
                <span className="w-24 text-right text-xs text-slate-500">{granted.filter((a) => a.reduction.typeId === t.id).length} élève(s)</span>
              </li>
            ))}
          </ul>
          {canEdit && (
            <Button variant="secondary" className="mt-3 !py-1 text-xs" onClick={() => setTypes([...types, { id: `t${Date.now()}`, label: window.prompt('Nom de la réduction ?') || 'Nouvelle réduction', kind: 'PERCENT', value: 10 }])}>＋ Nouveau type</Button>
          )}
        </Card>

        <Card title={`Réductions accordées (${granted.length})`} subtitle="Montants par mois, sur la grille Classes & tarifs">
          {granted.length === 0 ? <p className="text-sm text-slate-500">Aucune réduction accordée.</p> : (
            <ul className="divide-y divide-slate-100">
              {granted.map((a) => {
                const t = types.find((x) => x.id === a.reduction.typeId);
                return (
                  <li key={a.id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
                    <span className="min-w-0 flex-1"><span className="font-medium">{a.name}</span> <span className="text-slate-500">· {a.cls}</span>
                      <span className="block text-xs text-slate-500">{a.reduction.motif} · accordée par {a.reduction.by} le {a.reduction.at}</span></span>
                    {t && <Badge tone="green">{t.label.split(' (')[0]} {rate(t)}</Badge>}
                    {t && <span className="text-xs tabular-nums text-slate-600">−{formatAr(monthly(a, t))} / mois</span>}
                    {canEdit && <Button variant="ghost" className="!px-2 !py-1 text-xs" onClick={() => window.confirm(`Retirer la réduction de ${a.name} ? Les reçus déjà émis ne changent pas.`) && setAccounts(accounts.map((x) => (x.id === a.id ? { ...x, reduction: null } : x)))}>Retirer</Button>}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      <Card title="Accorder une réduction" subtitle={canEdit ? 'Direction uniquement : la décision est datée et signée' : 'Réservé à la Direction'}>
        {canEdit ? (
          <div className="space-y-2 text-sm">
            <select value={cls} onChange={(e) => { setCls(e.target.value); setDraft({ ...draft, studentId: '' }); }} className={`w-full ${inputCls}`} aria-label="Classe">
              <option value="">Toutes les classes</option>{classes.map((c) => <option key={c}>{c}</option>)}
            </select>
            <select value={draft.studentId} onChange={(e) => setDraft({ ...draft, studentId: e.target.value })} className={`w-full ${inputCls}`} aria-label="Élève">
              <option value="">Élève…</option>{candidates.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.cls})</option>)}
            </select>
            <select value={draft.typeId} onChange={(e) => setDraft({ ...draft, typeId: e.target.value })} className={`w-full ${inputCls}`} aria-label="Type de réduction">
              {types.map((t) => <option key={t.id} value={t.id}>{t.label} ({rate(t)})</option>)}
            </select>
            <input value={draft.motif} onChange={(e) => setDraft({ ...draft, motif: e.target.value })} placeholder="Motif : frère de …, enfant de Mme …, redouble la Terminale" className={`w-full ${inputCls}`} aria-label="Motif" />
            {draft.studentId && draft.typeId && (
              <p className="text-xs text-slate-600">Soit −{formatAr(monthly(accounts.find((a) => a.id === draft.studentId), types.find((t) => t.id === draft.typeId)))} par mois de frais de scolarité.</p>
            )}
            {tried && errors.length > 0 && <p className="text-xs text-red-700">À compléter : {errors.join(', ')}.</p>}
            <Button className="w-full" onClick={() => {
              setTried(true);
              if (errors.length) return;
              setAccounts(accounts.map((a) => (a.id === draft.studentId ? { ...a, reduction: { typeId: draft.typeId, motif: draft.motif.trim(), by: actor, at: '13/10/2026' } } : a)));
              setDraft({ studentId: '', typeId: draft.typeId, motif: '' });
              setTried(false);
            }}>Accorder la réduction</Button>
            <p className="text-xs text-slate-500">Elle s'applique aux mois non encore payés, et figure sur le ticket : « Réduction fratrie −34 000 ».</p>
          </div>
        ) : <p className="text-sm text-slate-500">Le Bureau voit les réductions et les applique à l'encaissement, mais ne peut ni en accorder ni modifier les taux.</p>}
      </Card>
    </div>
  );
}
