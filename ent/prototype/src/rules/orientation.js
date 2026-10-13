// Terminale : procédure d'accès à l'enseignement supérieur en France.
//  - Parcoursup : élèves de nationalité française, d'un pays de l'UE / EEE ou suisse ;
//  - Études en France (Campus France Madagascar) : autres nationalités (dont malgache),
//    l'établissement étant hors réseau AEFE.
// Règle à vérifier chaque année auprès de Campus France Madagascar.

const EU_EEA_CH = ['FR', 'DE', 'AT', 'BE', 'BG', 'CY', 'HR', 'DK', 'ES', 'EE', 'FI', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT',
  'NL', 'PL', 'PT', 'CZ', 'RO', 'SK', 'SI', 'SE', 'IS', 'LI', 'NO', 'CH'];

export const PROCEDURES = {
  PARCOURSUP: { label: 'Parcoursup', tone: 'navy' },
  CAMPUS_FRANCE: { label: 'Études en France (Campus France)', tone: 'violet' },
};

/** Procédure selon les nationalités de l'élève (une seule nationalité UE/EEE/CH suffit pour Parcoursup). */
export function higherEdProcedure(nationalities) {
  return [].concat(nationalities).some((n) => EU_EEA_CH.includes(n)) ? 'PARCOURSUP' : 'CAMPUS_FRANCE';
}

/** Fenêtre d'export Campus France : après les résultats du Bac, jusqu'à la clôture début septembre. */
export const exportWindowOpen = (today, { opensOn, closesOn }) => today >= opensOn && today <= closesOn;

/** Liste des Terminales pour Campus France (CSV lisible par Excel). */
export function campusFranceCsv(rows) {
  const cell = (v) => { const t = v ?? ''; return /[;"\n]/.test(t) ? `"${String(t).replace(/"/g, '""')}"` : String(t); };
  const header = ['Nom', 'Prénom', 'Date de naissance', 'Nationalité', 'Classe', 'Résultat du Bac', 'Mention', 'Procédure', 'E-mail'];
  const lines = rows.map((r) => [r.lastName, r.firstName, r.birthDate.split('-').reverse().join('/'), r.nationalities.join(', '), r.cls, r.bac ?? '', r.mention ?? '', PROCEDURES[higherEdProcedure(r.nationalities)].label, r.email]);
  return `﻿${[header, ...lines].map((l) => l.map(cell).join(';')).join('\r\n')}\r\n`;
}
