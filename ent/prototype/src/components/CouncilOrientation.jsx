import React, { useState } from 'react';
import { Badge, Button, Card } from './ui.jsx';
import OrientationSheet, { loadSheets } from './OrientationSheet.jsx';
import { CLASSES } from '../data/schoollife.js';
import { currentStep, sheetKind, ranksLabel, PROVISIONAL } from '../rules/orientationSheet.js';

// Au conseil de classe (2de, Terminale) : les fiches d'orientation remplies en ligne, élève par élève.
// En séance, on lit les vœux de la famille et on saisit l'avis du conseil sans changer d'écran ;
// les familles le voient aussitôt dans leur portail. Chaque fiche reste imprimable pour le dossier.
const WHO = { PARENT: 'famille', ELEVE: 'élève', DIRECTION: 'conseil' };

function summary(kind, s) {
  if (kind === '2DE') {
    const req = s.t3Request ?? s.t2Request;
    const council = s.t3Council ?? s.t2Council;
    return [req ? `Vœux : ${ranksLabel(req.ranks)}` : 'Vœux : pas encore envoyés',
      council ? `Avis : ${(council.asked ?? []).map((t) => `${t === 'G' ? 'Générale' : 'STMG'} ${PROVISIONAL[council[t]] ?? (council[t] === 'OUI' ? 'oui' : council[t] === 'NON' ? 'non' : '—')}`).join(', ')}` : null].filter(Boolean).join(' · ');
  }
  const i = s.intentions;
  return i ? `${(i.countries ?? []).join(', ')} · ${(i.wishes ?? []).filter(Boolean)[0] ?? ''}` : 'Intentions : pas encore envoyées';
}

export default function CouncilOrientation({ cls, role }) {
  const kind = sheetKind(cls);
  const [open, setOpen] = useState(null);
  const [tick, setTick] = useState(0); void tick;
  const sheets = loadSheets();
  const students = CLASSES[cls] ?? CLASSES[cls.replace(/^2nde?$/, '2de')] ?? [];
  const canDecide = ['DIRECTION', 'BUREAU'].includes(role);
  const toDecide = students.filter((s) => currentStep(kind, sheets[s] ?? {})?.who === 'DIRECTION').length;
  return (
    <Card title={`Orientation — ${cls}`} subtitle={kind === '2DE' ? 'Fiches de dialogue : vœux des familles et avis du conseil, saisis en séance' : 'Fiches post-bac : intentions des élèves et avis du conseil, saisis en séance'}
      action={toDecide > 0 && <Badge tone="amber">{toDecide} avis à donner</Badge>}>
      {students.length === 0 ? <p className="text-sm text-slate-600">Aucun élève dans cette classe.</p> : (
        <ul className="divide-y divide-slate-100">
          {students.map((s) => {
            const sh = sheets[s] ?? {};
            const st = currentStep(kind, sh);
            return (
              <li key={s} className="py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="min-w-0"><span className="block text-sm font-medium text-slate-900">{s}</span><span className="block text-xs text-slate-600">{summary(kind, sh)}</span></span>
                  <span className="flex items-center gap-2">
                    <Badge tone={!st ? 'green' : st.who === 'DIRECTION' ? 'amber' : 'slate'}>{!st ? 'terminée' : `à faire : ${WHO[st.who]}`}</Badge>
                    <Button variant={st?.who === 'DIRECTION' ? 'primary' : 'secondary'} className="!py-1 text-xs" onClick={() => { setOpen(open === s ? null : s); setTick((n) => n + 1); }}>{open === s ? 'Fermer' : st?.who === 'DIRECTION' && canDecide ? 'Donner l\'avis' : 'Voir la fiche'}</Button>
                  </span>
                </div>
                {open === s && <div className="mt-2 rounded-xl bg-slate-50 p-3"><OrientationSheet student={s} cls={cls} role={canDecide ? 'DIRECTION' : 'CONSULT'} by="La cheffe d'établissement" /></div>}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
