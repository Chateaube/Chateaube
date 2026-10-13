import React from 'react';
import { Badge, Button, Card, Icon, Stat } from './ui.jsx';
import { CASH_MOVEMENTS } from '../data/accounting.js';
import { formatAr } from '../rules/finance.js';

// Accueil du Bureau (administration / économat) : la journée de caisse et les dossiers à traiter.
export default function BureauHome({ go }) {
  const entries = CASH_MOVEMENTS.filter((m) => m.dir === 'IN');
  const todo = [
    { label: '12 familles avec un écolage d\'octobre échu', detail: 'Relances gelées en octobre : reprise automatique en novembre', action: 'Encaisser', to: 'accounting', tone: 'amber' },
    { label: 'Nouvel élève : RASOAMANANA Fy (4e)', detail: 'Arrivé le 12/10 — inscription et écolage d\'octobre à encaisser', action: 'Encaisser', to: 'accounting', tone: 'navy' },
    { label: '39 dossiers candidats libres incomplets', detail: 'Dépôt à l\'Académie avant le 30 octobre', action: null, tone: 'red' },
    { label: 'Conseils de classe du 1er trimestre', detail: 'Grilles disponibles dès que les enseignants ont validé leurs notes', action: 'Voir les grilles', to: 'council', tone: 'navy' },
  ];
  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-semibold text-navy-500">Bureau de Tamatave</p>
        <h1 className="text-2xl font-semibold text-navy-900">Administration & économat</h1>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Encaissé aujourd'hui" value={formatAr(entries.reduce((s, m) => s + m.amount, 0))} hint={`${entries.length} reçus`} tone="green" />
        <Stat label="Chèques à déposer" value="1" hint="n° 3318820 — 350 000 Ar" tone="amber" />
        <Stat label="Écolages échus" value="12" hint="Octobre" tone="red" />
        <Stat label="Absences du jour" value="2" hint="Vie scolaire" />
      </div>
      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <Card title="À traiter">
          <ul className="space-y-3">
            {todo.map((t) => (
              <li key={t.label} className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-start gap-3">
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${{ amber: 'bg-amber-500', navy: 'bg-navy-500', red: 'bg-red-500' }[t.tone]}`} />
                  <div><p className="text-sm font-medium text-slate-800">{t.label}</p><p className="text-xs text-slate-500">{t.detail}</p></div>
                </div>
                {t.action && <Button variant="secondary" onClick={() => go(t.to)}>{t.action}</Button>}
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Derniers encaissements">
          <ul className="space-y-2 text-sm">
            {entries.map((m) => (
              <li key={m.id} className="flex items-start justify-between gap-2">
                <div className="min-w-0"><p className="truncate text-slate-800">{m.label}</p><p className="text-xs text-slate-500">{m.time} · {m.method}</p></div>
                <span className="whitespace-nowrap font-medium tabular-nums text-emerald-700">{formatAr(m.amount)}</span>
              </li>
            ))}
          </ul>
          <Button className="mt-3 w-full" onClick={() => go('accounting')}><Icon name="wallet" />Nouvel encaissement</Button>
          <p className="mt-2 text-xs text-slate-500"><Badge>Accès</Badge> Le Bureau voit aussi la Vie scolaire (l'inverse n'est pas possible).</p>
        </Card>
      </div>
    </div>
  );
}
