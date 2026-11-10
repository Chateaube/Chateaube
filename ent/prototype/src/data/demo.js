// Données de démonstration — toutes fictives (noms, montants, effectifs).
import { today } from '../clock.js';
// Date de référence du prototype : 13 octobre 2026.

export const TODAY = today();

export const SITES = [
  { id: 'TANA', name: 'Tananarive', short: 'Tana', cycles: ['Préscolaire', 'Primaire', 'Collège', 'Lycée'] },
  { id: 'TMV', name: 'Tamatave', short: 'Tamatave', cycles: ['Collège', 'Lycée'] },
];

export const DIRECTION_ACCOUNTS = [
  { id: 'u1', name: 'Cheffe d\'établissement', initials: 'CE', email: 'direction@exemple.mg' },
  { id: 'u2', name: 'Directrice adjointe', initials: 'DA', email: 'adjointe@exemple.mg' },
];

// Indicateurs par site
export const SITE_KPIS = {
  TANA: {
    students: 412, byCycle: { Préscolaire: 68, Primaire: 156, Collège: 112, Lycée: 76 },
    tuitionDue: 148_320_000, tuitionPaid: 135_000_000, openCases: 9, absencesToday: 7,
  },
  TMV: {
    students: 186, byCycle: { Collège: 118, Lycée: 68 },
    tuitionDue: 66_960_000, tuitionPaid: 56_250_000, openCases: 6, absencesToday: 4,
  },
};

// Dossiers d'impayés : l'étape est CALCULÉE à partir de l'échéance et des paramètres
export const DUNNING_CASES = [
  { id: 'd2', student: 'RANDRIA Mamy', cls: 'Tle G', site: 'TMV', overdue: 900_000, due: '2026-09-05', guardian: 'M. Randria' },
  { id: 'd4', student: 'RAZAFY Kanto', cls: '1re STMG', site: 'TMV', overdue: 450_000, due: '2026-09-05', guardian: 'M. Razafy' },
  { id: 'd6', student: 'RAVELO Hasina', cls: '3e', site: 'TMV', overdue: 360_000, due: '2026-10-05', guardian: 'Mme Ravelo' },
  { id: 'd7', student: 'RASOA Lova', cls: '5e', site: 'TMV', overdue: 360_000, due: '2026-10-05', guardian: 'Mme Rasoa' },
  { id: 'd1', student: 'RAKOTOMALALA Tiana', cls: '4e B', site: 'TANA', overdue: 360_000, due: '2026-09-05', guardian: 'Mme Rakotomalala' },
  { id: 'd3', student: 'ANDRIANAIVO Soa', cls: 'CM1', site: 'TANA', overdue: 310_000, due: '2026-10-05', guardian: 'Mme Andrianaivo' },
];

// Droits d'examen — campagne d'octobre (montants fictifs)
export const EXAM_FEES = [
  { exam: 'DNB', site: 'TMV', level: '3e', unit: 350_000, candidates: 34, paid: 29, center: 'Lycée Français de Tamatave' },
  { exam: 'DNB', site: 'TANA', level: '3e', unit: 350_000, candidates: 27, paid: 25, center: 'Lycée Français de Tananarive' },
  { exam: 'Pré-Bac (EAF)', site: 'TMV', level: '1re', unit: 450_000, candidates: 31, paid: 24, center: 'Lycée Français de Tananarive' },
  { exam: 'Pré-Bac (EAF)', site: 'TANA', level: '1re', unit: 450_000, candidates: 38, paid: 35, center: 'Lycée Français de Tananarive' },
  { exam: 'Bac', site: 'TMV', level: 'Tle', unit: 600_000, candidates: 22, paid: 19, center: 'Lycée Français de Tananarive' },
  { exam: 'Bac', site: 'TANA', level: 'Tle', unit: 600_000, candidates: 36, paid: 33, center: 'Lycée Français de Tananarive' },
];

// candidats DNB et bac de Tamatave (3e, 1re, Terminale)
export const CANDIDATE_FILES = { total: 62, complete: 41, incomplete: 15, toBuild: 6, deadline: '2026-10-30' };

export const TRANSFER = {
  label: 'Transfert 1re & Terminale · Tamatave → Tana',
  effectiveOn: '2027-04-12',
  students: { '1re': 31, Terminale: 22 },
  clearance: { ok: 41, pending: 12 },
};

export const YEAR_MILESTONES = [
  { month: 'Oct.', title: 'Inscriptions candidats libres', detail: 'DNB / Bac — Académie de La Réunion', state: 'now' },
  { month: 'Avr.', title: 'Bascule 1re/Tle vers Tana', detail: 'Affectation géographique, historique conservé', state: 'next' },
  { month: 'Mai', title: 'Derniers frais de scolarité 1re/Tle TMV', detail: 'Quitus financier avant épreuves', state: 'next' },
  { month: 'Juin', title: 'DNB au LF de Tamatave', detail: 'Épreuves 1re/Tle au LF de Tana', state: 'next' },
  { month: 'Juil.–Août', title: 'Export Campus France', detail: 'Clôture début septembre', state: 'next' },
];

// --- Réservations ------------------------------------------------------------
export const RESOURCES = [
  { id: 'tmv-vp1', siteId: 'TMV', type: 'VIDEOPROJECTEUR', label: 'Vidéoprojecteur Epson #1' },
  { id: 'tmv-vp2', siteId: 'TMV', type: 'VIDEOPROJECTEUR', label: 'Vidéoprojecteur Epson #2' },
  { id: 'tmv-sp1', siteId: 'TMV', type: 'ENCEINTE', label: 'Enceinte JBL portable' },
  { id: 'tmv-tv1', siteId: 'TMV', type: 'TV', label: 'TV mobile 55"' },
  { id: 'tmv-lab', siteId: 'TMV', type: 'SALLE_SPECIALISEE', label: 'Laboratoire SVT/PC' },
  { id: 'tmv-pc', siteId: 'TMV', type: 'INFORMATIQUE', label: 'Valise 15 ordinateurs' },
  { id: 'tana-vp1', siteId: 'TANA', type: 'VIDEOPROJECTEUR', label: 'Vidéoprojecteur BenQ #1' },
  { id: 'tana-vp2', siteId: 'TANA', type: 'VIDEOPROJECTEUR', label: 'Vidéoprojecteur BenQ #2' },
  { id: 'tana-vp3', siteId: 'TANA', type: 'VIDEOPROJECTEUR', label: 'Vidéoprojecteur BenQ #3' },
  { id: 'tana-sp1', siteId: 'TANA', type: 'ENCEINTE', label: 'Enceinte Bose (salle polyvalente)' },
  { id: 'tana-sp2', siteId: 'TANA', type: 'ENCEINTE', label: 'Enceinte JBL portable' },
  { id: 'tana-tv1', siteId: 'TANA', type: 'TV', label: 'TV mobile 65"' },
  { id: 'tana-info', siteId: 'TANA', type: 'SALLE_SPECIALISEE', label: 'Salle informatique' },
];

export const RESOURCE_TYPES = [
  { id: 'ALL', label: 'Tout' },
  { id: 'VIDEOPROJECTEUR', label: 'Vidéoprojecteurs' },
  { id: 'ENCEINTE', label: 'Enceintes' },
  { id: 'TV', label: 'TV' },
  { id: 'SALLE_SPECIALISEE', label: 'Salles' },
  { id: 'INFORMATIQUE', label: 'Informatique' },
];

export const INITIAL_BOOKINGS = [
  { id: 'b1', resourceId: 'tmv-vp1', date: '2026-10-15', start: '07:30', end: '09:30', who: 'M. Rasolo', cls: '3e', purpose: 'Histoire — documentaire' },
  { id: 'b2', resourceId: 'tmv-vp1', date: '2026-10-15', start: '10:00', end: '12:00', who: 'Mme Ranaivo', cls: 'Tle STMG', purpose: 'Management — étude de cas' },
  { id: 'b3', resourceId: 'tmv-vp2', date: '2026-10-15', start: '13:00', end: '14:00', who: 'Mme Hery', cls: '5e', purpose: 'Anglais — vidéo' },
  { id: 'b4', resourceId: 'tmv-sp1', date: '2026-10-15', start: '14:00', end: '16:00', who: 'M. Faly', cls: '1re G', purpose: 'Parcours Art — atelier musique' },
  { id: 'b5', resourceId: 'tmv-lab', date: '2026-10-15', start: '08:00', end: '10:00', who: 'Mme Voahangy', cls: '2de', purpose: 'TP Physique' },
  { id: 'b6', resourceId: 'tmv-pc', date: '2026-10-15', start: '13:00', end: '15:00', who: 'M. Tojo', cls: '4e', purpose: 'Parcours Numérique' },
  { id: 'b7', resourceId: 'tana-vp1', date: '2026-10-15', start: '08:00', end: '10:00', who: 'Mme Lalao', cls: 'CM2', purpose: 'Sciences' },
  { id: 'b8', resourceId: 'tana-vp2', date: '2026-10-15', start: '13:30', end: '15:30', who: 'M. Rado', cls: 'Tle G', purpose: 'Philosophie' },
  { id: 'b9', resourceId: 'tana-sp1', date: '2026-10-15', start: '15:00', end: '17:00', who: 'Vie scolaire', cls: '—', purpose: 'Répétition spectacle' },
  { id: 'b10', resourceId: 'tmv-vp1', date: '2026-10-14', start: '08:00', end: '10:00', who: 'M. Rasolo', cls: '4e', purpose: 'Géographie' },
];

// Séances de l'enseignant connecté (emploi du temps, semaine du 12 octobre) : une réservation
// peut être liée à une séance (date, heures et classe repris automatiquement).
export const MY_SESSIONS = [
  { id: 'se1', date: '2026-10-12', start: '07:00', end: '09:00', cls: '1re STMG', subject: 'Management' },
  { id: 'se2', date: '2026-10-13', start: '09:45', end: '11:45', cls: 'Terminale STMG', subject: 'Management' },
  { id: 'se3', date: '2026-10-14', start: '08:00', end: '09:30', cls: '2de', subject: 'SES' },
  { id: 'se4', date: '2026-10-15', start: '10:30', end: '11:30', cls: '1re STMG', subject: 'Management' },
  { id: 'se5', date: '2026-10-15', start: '13:30', end: '15:30', cls: 'Terminale STMG', subject: 'Droit' },
  { id: 'se6', date: '2026-10-16', start: '07:00', end: '08:00', cls: '1re STMG', subject: 'Économie' },
];
