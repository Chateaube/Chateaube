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
  if ((d.mode ?? 'MOIS') === 'MOIS') {
    const last = d.lastMonth?.enabled ? ' (dernier mois : délais courts)' : '';
    return [
      { key: 'RAPPEL', label: 'Rappel', delay: `2 semaines après l'échéance${last}` },
      { key: 'RELANCE', label: 'Relance', delay: `le mois de l'échéance fini${last}` },
      { key: 'AVERTISSEMENT', label: 'Avertissement', delay: `1 mois et demi après l'échéance${last}` },
      { key: 'MISE_A_PIED', label: 'Notification de mise à pied', delay: `2 mois après l'échéance${last}${d.suspensionRequiresDirection ? ' — validation Direction' : ''}` },
    ];
  }
  const ref = d.countFrom === 'ECHEANCE' ? 'après l\'échéance' : 'après l\'étape précédente';
  const unit = (n) => `${n} jour${n > 1 ? 's' : ''} compté${n > 1 ? 's' : ''}`;
  const last = (k) => (d.lastMonth?.enabled ? ` (dernier mois : ${d.lastMonth[k]})` : '');
  return [
    { key: 'RELANCE', label: 'Relance automatique', delay: `${unit(d.relanceAfter)} ${ref}${last('relanceAfter')}` },
    { key: 'AVERTISSEMENT', label: 'Avertissement', delay: `${unit(d.warningAfter)} ${ref}${last('warningAfter')}` },
    {
      key: 'MISE_A_PIED', label: 'Notification de mise à pied',
      delay: `${unit(d.suspensionAfter)} ${ref}${last('suspensionAfter')}${d.suspensionRequiresDirection ? ' — validation Direction' : ''}`,
    },
  ];
}

export const formatAr = (n) => `${new Intl.NumberFormat('fr-FR').format(n).replace(/\u202f|\u00a0/g, ' ')} Ar`;

// Montant en toutes lettres (reçus) : « trois cent soixante mille ariary »
const UNITS = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize'];
const TENS = { 2: 'vingt', 3: 'trente', 4: 'quarante', 5: 'cinquante', 6: 'soixante' };
function below100(n) {
  if (n <= 16) return UNITS[n];
  if (n < 20) return `dix-${UNITS[n - 10]}`;
  const t = Math.floor(n / 10);
  const u = n % 10;
  if (t === 7 || t === 9) {
    const base = t === 7 ? 'soixante' : 'quatre-vingt';
    return `${base}${t === 7 && u === 1 ? ' et ' : '-'}${below100(10 + u)}`;
  }
  if (t === 8) return u ? `quatre-vingt-${UNITS[u]}` : 'quatre-vingts';
  return u === 0 ? TENS[t] : u === 1 ? `${TENS[t]} et un` : `${TENS[t]}-${UNITS[u]}`;
}
function below1000(n) {
  const h = Math.floor(n / 100);
  const r = n % 100;
  const head = h === 0 ? '' : h === 1 ? 'cent' : `${UNITS[h]} cent${r === 0 ? 's' : ''}`;
  return [head, r ? below100(r) : ''].filter(Boolean).join(' ');
}
export function amountInWords(n) {
  n = Math.round(n);
  if (n === 0) return 'zéro ariary';
  const parts = [];
  const millions = Math.floor(n / 1_000_000);
  const thousands = Math.floor((n % 1_000_000) / 1000);
  const rest = n % 1000;
  if (millions) parts.push(`${millions === 1 ? 'un' : below1000(millions)} million${millions > 1 ? 's' : ''}`);
  if (thousands) parts.push(thousands === 1 ? 'mille' : `${below1000(thousands).replace(/cents$/, 'cent')} mille`);
  if (rest) parts.push(below1000(rest));
  return `${parts.join(' ')} ariary`;
}

/** Texte de la relance (lettre ou message à copier) : montant, mois dus, et l'étape (relance, avertissement). */
export function relanceText(c, stage, settings) {
  const fmt = (n) => new Intl.NumberFormat('fr-FR').format(n).replace(/[\u202f\u00a0]/g, ' ');
  const months = c.months?.length ? ` (${c.months.join(', ')})` : '';
  const lines = [
    'Madame, Monsieur,',
    `Sauf erreur de notre part, les frais de scolarité de ${c.student} (${c.cls})${months} restent dus, pour un montant de ${fmt(c.overdue)} Ar.`,
    'Nous vous remercions de bien vouloir régulariser cette situation au secrétariat dans les meilleurs délais.',
  ];
  if (stage === 'AVERTISSEMENT' || stage === 'A_VALIDER') lines.push('Sans règlement de votre part, nous serons contraints de suspendre l\'accueil de votre enfant, conformément au règlement financier de l\'établissement.');
  lines.push('Si le paiement a déjà été effectué, merci de ne pas tenir compte de ce courrier.', 'Nous restons à votre disposition pour en parler.', 'Cordialement,', 'La Direction');
  return lines.join('\n');
}
