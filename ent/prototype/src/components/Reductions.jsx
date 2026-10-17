import React, { useMemo, useState } from 'react';
import { Badge, Button, Card } from './ui.jsx';
import { CLASS_FEES } from '../data/accounting.js';
import { reductionAmount } from '../rules/billing.js';
import { reductionText } from './CollectPayment.jsx';
import { formatAr } from '../rules/finance.js';

// Réductions sur les frais de scolarité : types et taux fixés par la Direction, puis accordés
// élève par élève avec un motif. Le Bureau les consulte et les voit appliquées à l'encaissement.

const inputCls = 'rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm';
const defined = (t) => t.rates.ECOLAGE !== null || t.rates.INSCRIPTION !== null;
const rate = (t) => (defined(t) ? reductionText(t.rates) : 'taux à définir');

export default function Reductions({ canEdit, actor, types, setTypes, accounts, setAccounts }) {
  const [draft, setDraft] = useState({ studentId: '', typeId: types[0]?.id ?? '', motif: '' });
  const [cls, setCls] = useState('');
  const [tried, setTried] = useState(false);
  const granted = accounts.filter((a) => a.reduction);
  const classes = useMemo(() => [...new Set(accounts.map((a) => a.cls))], [accounts]);
  const candidates = accounts.filter((a) => (!cls || a.cls === cls) && !a.reduction);
  const errors = [!draft.studentId && 'Élève', !(types.find((t) => t.id === draft.typeId) && defined(types.find((t) => t.id === draft.typeId))) && 'Type de réduction (avec ses taux)', draft.motif.trim().length < 5 && 'Motif (ex. redouble la Terminale, fille d\'un ami de l\'établissement)'].filter(Boolean);
  const amounts = (a, t) => {
    const fee = CLASS_FEES.find((f) => f.cls === a.cls);
    if (!fee) return '';
    const eco = reductionAmount(fee.ecolage, t.rates.ECOLAGE);
    const ins = reductionAmount(a.isNew ? fee.inscription : fee.reinscription, t.rates.INSCRIPTION);
    return [eco && `−${formatAr(eco)} / mois`, ins && `−${formatAr(ins)} à l'${a.isNew ? 'inscription' : 'réinscription'}`].filter(Boolean).join(' · ');
  };
  const updateType = (id, patch) => setTypes(types.map((t) => (t.id === id ? { ...t, ...patch } : t)));

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_380px] xl:items-start">
      <div className="space-y-5">
        <Card title="Types de réduction" subtitle={canEdit ? 'Taux fixés par la Direction : frais de scolarité et inscription' : 'Consultation : seule la Direction fixe les taux'}>
          <div className="-mx-5 overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-y border-slate-100 bg-slate-50 text-left text-xs text-slate-500">
                  <th className="px-4 py-2 font-medium">Réduction</th><th className="px-2 text-right font-medium">Frais de scolarité</th>
                  <th className="px-2 text-right font-medium">Inscription / réinscription</th><th className="px-4 text-right font-medium">Élèves</th>
                </tr>
              </thead>
              <tbody>
                {types.map((t) => (
                  <tr key={t.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-2 font-medium text-slate-800">{t.label}{!defined(t) && <span className="ml-2"><Badge tone="amber">taux à définir</Badge></span>}</td>
                    {['ECOLAGE', 'INSCRIPTION'].map((k) => (
                      <td key={k} className="px-2 py-1.5 text-right">
                        {canEdit ? (
                          <span className="inline-flex items-center gap-1">−<input type="number" min={0} max={100} value={t.rates[k] ?? ''} placeholder="—"
                            onChange={(e) => updateType(t.id, { rates: { ...t.rates, [k]: e.target.value === '' ? null : Math.min(100, Math.max(0, Number(e.target.value))) } })}
                            className={`w-20 text-right ${inputCls}`} aria-label={`${t.label} — ${k === 'ECOLAGE' ? 'frais de scolarité' : 'inscription'}`} /> %</span>
                        ) : <span className="tabular-nums">{t.rates[k] ? `−${t.rates[k]} %` : '—'}</span>}
                      </td>
                    ))}
                    <td className="px-4 text-right text-xs text-slate-500">{granted.filter((a) => a.reduction.typeId === t.id).length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-slate-500">Tous les autres frais (fascicule, manuels, cahiers, articles, examens) restent à 100 %. Pas de réduction pour la fratrie.</p>
          {canEdit && (
            <Button variant="secondary" className="mt-3 !py-1 text-xs" onClick={() => setTypes([...types, { id: `t${Date.now()}`, label: window.prompt('Nom de la réduction ?') || 'Nouvelle réduction', rates: { ECOLAGE: null, INSCRIPTION: null } }])}>＋ Nouveau type</Button>
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
                    {t && <Badge tone="green">{t.label}</Badge>}
                    {t && <span className="text-xs tabular-nums text-slate-600">{amounts(a, t)}</span>}
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
              {types.map((t) => <option key={t.id} value={t.id} disabled={!defined(t)}>{t.label} ({rate(t)})</option>)}
            </select>
            <input value={draft.motif} onChange={(e) => setDraft({ ...draft, motif: e.target.value })} placeholder="Motif : redouble la Terminale, fils d'un ami de l'établissement…" className={`w-full ${inputCls}`} aria-label="Motif" />
            {draft.studentId && draft.typeId && (
              <p className="text-xs text-slate-600">Soit {amounts(accounts.find((a) => a.id === draft.studentId), types.find((t) => t.id === draft.typeId)) || 'aucun montant (taux à définir)'}.</p>
            )}
            {tried && errors.length > 0 && <p className="text-xs text-red-700">À compléter : {errors.join(', ')}.</p>}
            <Button className="w-full" onClick={() => {
              setTried(true);
              if (errors.length) return;
              setAccounts(accounts.map((a) => (a.id === draft.studentId ? { ...a, reduction: { typeId: draft.typeId, motif: draft.motif.trim(), by: actor, at: '13/10/2026' } } : a)));
              setDraft({ studentId: '', typeId: draft.typeId, motif: '' });
              setTried(false);
            }}>Accorder la réduction</Button>
            <p className="text-xs text-slate-500">Elle s'applique à ce qui n'est pas encore payé et figure sur le ticket : « Réduction redoublant en terminale −112 500 ».</p>
          </div>
        ) : <p className="text-sm text-slate-500">Le secrétariat voit les réductions et les applique à l'encaissement, mais ne peut ni en accorder ni modifier les taux.</p>}
      </Card>
    </div>
  );
}
