// Règles financières : ventilation des droits d'examen, étapes du recouvrement.
// Les délais et mois de relance sont des PARAMÈTRES (cf. data/settings.js) ;
// le calcul des dates est dans calendar.js.

export const EXAM_RETAINED_FEE = 40_000; // Ar conservés par élève (frais de dossier)

/** Ventilation d'un encaissement de droits d'examen. */
export function splitExamFee(amount, retained = EXAM_RETAINED_FEE) {
  const kept = Math.min(retained, amount);
  return { retained: kept, toRemit: amount - kept };
}

/** Étapes du recouvrement, libellées à partir des paramètres. */
export function dunningStages(settings) {
  const d = settings.dunning;
  const ref = d.countFrom === 'ECHEANCE' ? 'après l\'échéance' : 'après l\'étape précédente';
  const unit = (n) => `${n} jour${n > 1 ? 's' : ''} compté${n > 1 ? 's' : ''}`;
  return [
    { key: 'RELANCE', label: 'Relance automatique', delay: `${unit(d.relanceAfter)} ${ref}` },
    { key: 'AVERTISSEMENT', label: 'Avertissement', delay: `${unit(d.warningAfter)} ${ref}` },
    {
      key: 'MISE_A_PIED', label: 'Notification de mise à pied',
      delay: `${unit(d.suspensionAfter)} ${ref}${d.suspensionRequiresDirection ? ' — validation Direction' : ''}`,
    },
  ];
}

export const formatAr = (n) => `${new Intl.NumberFormat('fr-FR').format(n).replace(/\u202f|\u00a0/g, ' ')} Ar`;
