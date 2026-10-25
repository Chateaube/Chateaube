// Fiches d'orientation de l'école, en ligne (d'après les modèles papier) :
//  - 2de : fiche de dialogue pour l'orientation à l'issue de la seconde (intentions au 2e trimestre, avis
//    provisoire du conseil, choix définitif au 3e trimestre, proposition du conseil, réponse de la famille) ;
//  - Terminale : fiche de dialogue post-bac avant le 1er conseil de classe (intentions, avis du conseil).
// Fonctions pures : qui doit agir maintenant, et ce qui manque.

export const TRACKS_2DE = { G: '1re Générale – S (Mathématiques, Physique-Chimie, SVT)', STMG: '1re Technologique – STMG (SGN, Management, Économie-Droit)' };
export const PROVISIONAL = { FAVORABLE: 'Favorable', DEFAVORABLE: 'Défavorable', RESERVE: 'Réservé' };

/** Étapes de la fiche de 2de, dans l'ordre ; la première qui n'est pas faite est l'étape en cours. */
export const STEPS_2DE = [
  ['t2Request', 'PARENT', '2e trimestre — demande des représentants légaux'],
  ['t2Council', 'DIRECTION', '2e trimestre — avis provisoire du conseil de classe'],
  ['t2Ack', 'PARENT', 'Retour des représentants légaux sur l\'avis provisoire'],
  ['t3Request', 'PARENT', '3e trimestre — choix définitif des représentants légaux'],
  ['t3Council', 'DIRECTION', '3e trimestre — proposition du conseil de classe'],
  ['answer', 'PARENT', 'Réponse des représentants légaux'],
];
export const STEPS_TLE = [
  ['intentions', 'ELEVE', '1er trimestre — intentions d\'orientation de l\'élève'],
  ['parentSeen', 'PARENT', 'Le représentant légal prend connaissance du projet'],
  ['council', 'DIRECTION', '1er trimestre — avis du conseil de classe'],
];

export const sheetKind = (cls) => (cls === '2de' || /^2n?de/i.test(cls ?? '') ? '2DE' : /^Terminale/.test(cls ?? '') ? 'TLE' : null);

/** Étape en cours (ou null quand la fiche est terminée). */
export function currentStep(kind, sheet = {}) {
  const steps = kind === '2DE' ? STEPS_2DE : STEPS_TLE;
  const s = steps.find(([k]) => !sheet[k]);
  return s ? { key: s[0], who: s[1], label: s[2] } : null;
}

/** Ce qui manque avant d'enregistrer une étape. */
export function stepErrors(key, value = {}) {
  const e = [];
  if (key === 't2Request' || key === 't3Request') {
    if (!value.ranks?.length) e.push('Choisir au moins une voie, par ordre de préférence.');
  }
  if (key === 't2Council') {
    (value.asked ?? []).forEach((t) => { if (!value[t]) e.push(`Avis à donner pour ${t === 'G' ? 'la 1re Générale' : 'la 1re STMG'}.`); });
  }
  if (key === 't3Council') {
    (value.asked ?? []).forEach((t) => { if (!['OUI', 'NON'].includes(value[t])) e.push(`Oui ou non pour ${t === 'G' ? 'la 1re Générale' : 'la 1re STMG'}.`); });
  }
  if (key === 'answer' && value.accept === false && !String(value.contact ?? '').trim()) e.push('Indiquer comment vous joindre pour l\'entretien.');
  if (key === 'intentions') {
    if (!value.countries?.length) e.push('Choisir au moins un pays (ou « Autre »).');
    if (!(value.wishes ?? []).some((w) => String(w).trim())) e.push('Écrire au moins un vœu prioritaire.');
  }
  if (key === 'council' && !String(value.text ?? '').trim()) e.push('Écrire l\'avis du conseil.');
  return e;
}

/** Résumé pour les listes : « 1. STMG, 2. Générale ». */
export const ranksLabel = (ranks = []) => ranks.map((t, i) => `${i + 1}. ${t === 'G' ? 'Générale' : 'STMG'}`).join(', ');
