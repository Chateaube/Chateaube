import React from 'react';
import ActivityJournal from './ActivityJournal.jsx';
import AbsentToggle from './AbsentToggle.jsx';
import QuickEntry from './QuickEntry.jsx';
import { Badge, Button, Card, Icon } from './ui.jsx';
import { PulseCard, UpcomingCard, TodoCard, InfoCard } from './HomeBlocks.jsx';
import { RECEIPTS_TODAY, JOURNALS, CASH_CLOSINGS, CASH_SAFE } from '../data/accounting.js';
import { formatAr } from '../rules/finance.js';
import { depositReminder } from '../rules/cashControl.js';
import { pendingSignatures } from '../signatureStore.js';
import { loadRequests } from '../requestsStore.js';
import { TODAY } from '../notify.js';

// Accueil du secrétariat, sur le modèle de celui de la Direction, avec le guichet du jour :
// 1. l'école sur 7 / 30 jours et ce qui vient ; 2. le guichet (caisse du jour par journal, clôture, chèques,
// certificats) ; 3. « À faire » (urgences, guichet, démarches, tâches) ; « À savoir » ; 4. ce qui s'est passé.
export default function BureauHome({ go, settings }) {
  const receipts = RECEIPTS_TODAY.filter((r) => r.date === TODAY && r.status !== 'ANNULE');
  const byJournal = Object.keys(JOURNALS).map((j) => [j, receipts.filter((r) => r.journal === j).reduce((t, r) => t + r.total, 0)]);
  const total = byJournal.reduce((t, [, v]) => t + v, 0);
  const cheques = receipts.filter((r) => r.method === 'CHEQUE');
  const closed = CASH_CLOSINGS.some((c) => c.date === TODAY);
  const deposit = depositReminder(TODAY, [CASH_SAFE.lastDeposit], CASH_SAFE.depositDays);
  const certificates = pendingSignatures().length;
  const familyRequests = loadRequests().requests.filter((r) => r.status === 'A_TRAITER').length;
  const extra = [
    ...(!closed ? [{ id: 'closing', to: 'accounting', intent: { tab: 'receipts' }, text: `Clôture de caisse ce soir (${receipts.length} reçu${receipts.length > 1 ? 's' : ''} aujourd'hui)`, action: 'Clôturer' }] : []),
    ...(cheques.length ? [{ id: 'cheques', to: 'accounting', intent: { tab: 'receipts' }, text: `${cheques.length} chèque${cheques.length > 1 ? 's' : ''} à déposer à la banque${deposit.dueToday ? ' (versement prévu aujourd\'hui)' : ''}`, action: 'Voir' }] : []),
  ];
  return (
    <div className="space-y-5 pb-16 sm:pb-0">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-navy-500">Secrétariat de Tamatave</p>
          <h1 className="text-2xl font-semibold text-navy-900">Bonjour Mme Hanta</h1>
        </div>
        <Button onClick={() => go('accounting')}><Icon name="wallet" />Nouvel encaissement</Button>
      </div>
      <QuickEntry role="BUREAU" />
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-5">
          <PulseCard go={go} only={['soins', 'demandes', 'absences', 'justifs', 'objets', 'retards']} />
          <Card title="Guichet du jour" subtitle={`${formatAr(total)} encaissés · ${receipts.length} reçu${receipts.length > 1 ? 's' : ''}`}
            action={<Button variant="secondary" className="!py-1 text-xs" onClick={() => go('accounting')}>Caisse ›</Button>}>
            <div className="grid gap-2 sm:grid-cols-3">
              {byJournal.map(([j, v]) => (
                <div key={j} className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-600">{JOURNALS[j].label}</p><p className="font-display text-lg font-semibold tabular-nums text-navy-900">{formatAr(v)}</p></div>
              ))}
            </div>
            <ul className="mt-3 space-y-1 text-sm">
              <li className="flex flex-wrap items-center gap-2">{closed ? <Badge tone="green">Caisse clôturée</Badge> : <Badge tone="amber">Clôture à faire ce soir</Badge>}</li>
              <li>Chèques à déposer : <strong>{cheques.length}</strong>{deposit.dueToday ? ' · versement en banque prévu aujourd\'hui' : ''}</li>
              <li>Certificats en attente de signature de la Direction : <strong>{certificates}</strong></li>
              <li>Démarches en ligne des familles à traiter : <strong>{familyRequests}</strong> {familyRequests > 0 && <button type="button" onClick={() => go('enrol')} className="ml-1 text-xs font-medium text-navy-700 underline">Traiter</button>}</li>
            </ul>
          </Card>
        </div>
        <UpcomingCard settings={settings} go={go} />
      </div>
      <TodoCard role="BUREAU" go={go} extra={extra} />
      <InfoCard items={[
        'Relances des frais de scolarité en pause en octobre, reprise en novembre.',
        'Conseils de classe : les grilles sont disponibles dès que les enseignants ont validé leurs notes.',
      ]} />
      <ActivityJournal go={go} />
      <AbsentToggle role="BUREAU" />
    </div>
  );
}
