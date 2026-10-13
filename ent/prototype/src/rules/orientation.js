// Terminale : accès à l'enseignement supérieur en France (décision de l'établissement).
//  - Parcoursup est OBLIGATOIRE pour tous les élèves de Terminale, malgaches comme français ;
//  - les élèves qui ne sont ni français ni d'un pays de l'UE / EEE / Suisse poursuivent ensuite
//    avec Campus France (Études en France) puis TLScontact (demande de visa).
//  - Pas de fiche Avenir remplie par l'établissement (candidats libres).

const EU_EEA_CH = ['FR', 'DE', 'AT', 'BE', 'BG', 'CY', 'HR', 'DK', 'ES', 'EE', 'FI', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT',
  'NL', 'PL', 'PT', 'CZ', 'RO', 'SK', 'SI', 'SE', 'IS', 'LI', 'NO', 'CH'];

export const PROCEDURES = {
  PARCOURSUP: { label: 'Parcoursup', tone: 'navy' },
  CAMPUS_FRANCE: { label: 'Campus France (Études en France)', tone: 'violet' },
  TLS: { label: 'TLScontact (visa)', tone: 'amber' },
};

/** Démarches d'un élève de Terminale, dans l'ordre. */
export function higherEdSteps(nationalities) {
  const needsVisa = ![].concat(nationalities).some((n) => EU_EEA_CH.includes(n));
  return needsVisa ? ['PARCOURSUP', 'CAMPUS_FRANCE', 'TLS'] : ['PARCOURSUP'];
}

/** Fenêtre d'export Campus France : après les résultats du Bac, jusqu'à la clôture début septembre. */
export const exportWindowOpen = (today, { opensOn, closesOn }) => today >= opensOn && today <= closesOn;

/** Liste des Terminales pour Campus France (CSV lisible par Excel). */
export function campusFranceCsv(rows) {
  const cell = (v) => { const t = v ?? ''; return /[;"\n]/.test(t) ? `"${String(t).replace(/"/g, '""')}"` : String(t); };
  const header = ['Nom', 'Prénom', 'Date de naissance', 'Nationalité', 'Classe', 'Résultat du Bac', 'Mention', 'Démarches', 'E-mail'];
  const lines = rows.map((r) => [r.lastName, r.firstName, r.birthDate.split('-').reverse().join('/'), r.nationalities.join(', '), r.cls, r.bac ?? '', r.mention ?? '',
    higherEdSteps(r.nationalities).map((k) => PROCEDURES[k].label).join(' + '), r.email]);
  return `﻿${[header, ...lines].map((l) => l.map(cell).join(';')).join('\r\n')}\r\n`;
}
