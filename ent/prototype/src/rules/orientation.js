// Terminale : poursuite d'études. Chaque élève a une ou plusieurs PISTES (un pays chacune).
//  - la piste France (Parcoursup) n'est pas obligatoire, mais conseillée à tous en plan B, même à
//    ceux qui visent un autre pays ; elle se clôture avec un motif si l'élève ne la suit pas ;
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

// --- Pistes de poursuite d'études, par pays ---
export const DESTINATIONS = {
  FRANCE: 'France', CANADA: 'Canada', BELGIQUE: 'Belgique', MAURICE: 'Maurice', MADAGASCAR: 'Madagascar', AFRIQUE_SUD: 'Afrique du Sud', AUTRE: 'Autre pays',
};
const GENERIC_STEPS = [['dossier', 'Dossier préparé'], ['candidature', 'Candidature envoyée'], ['reponse', 'Réponse reçue'], ['visa', 'Visa / inscription définitive']];
/** Étapes d'une piste : France = Parcoursup, puis Campus France et visa si l'élève en a besoin. */
export function trackSteps(dest, nationalities = []) {
  if (dest !== 'FRANCE') return dest === 'MADAGASCAR' ? GENERIC_STEPS.slice(0, 3) : GENERIC_STEPS;
  const visa = higherEdSteps(nationalities).includes('TLS');
  return [['account', 'Compte Parcoursup créé'], ['confirmed', 'Vœux confirmés'], ...(visa ? [['campus', 'Dossier Campus France'], ['tls', 'Rendez-vous visa (TLS)']] : [])];
}
/** Pistes de départ : la France pour tous (plan B conseillé). */
export const defaultTracks = () => [{ id: 'FRANCE', dest: 'FRANCE', done: {}, closed: null }];
export function addTrack(tracks, dest, label = '') {
  if (dest !== 'AUTRE' && tracks.some((t) => t.dest === dest && !t.closed)) return tracks;
  return [...tracks, { id: `${dest}-${tracks.length}`, dest, label: dest === 'AUTRE' ? label.trim() : '', done: {}, closed: null }];
}
/** Clôturer une piste (ex. « ne part pas en France ») : motif obligatoire. */
export function closeTrack(track, reason, on) {
  if (!reason?.trim()) throw new Error('Motif obligatoire pour clôturer une piste.');
  return { ...track, closed: { reason: reason.trim(), on } };
}
export function trackProgress(track, nationalities) {
  const steps = trackSteps(track.dest, nationalities);
  return { done: steps.filter(([k]) => track.done[k]).length, total: steps.length };
}
