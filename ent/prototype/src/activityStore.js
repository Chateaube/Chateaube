// Journal de l'école gardé dans le navigateur (démonstration ; avec le serveur, table activity_log).
import { ATTENDANCE, MEASURES_LOG, PHONES } from './data/schoollife.js';

const KEY = 'ent-journal-v1';
export const DEMO_TODAY = '2026-10-13';

// Lignes de démonstration tirées des données fictives de vie scolaire
const DEMO = [
  ...ATTENDANCE.map((a) => ({ id: `j-${a.id}`, at: `${a.date}T${(a.slot.match(/(\d{2})h(\d{2})/) ?? [0, '07', '00']).slice(1).join(':')}`, who: a.by.replace(/^M\. Be$/, 'M. Be (CPE)'), role: a.by === 'M. Be' ? 'VIE_SCOLAIRE' : 'ENSEIGNANT', kind: 'ABSENCE', student: a.student, text: `${a.kind === 'ABSENCE' ? 'Absence' : 'Retard'} notée à l'appel` })),
  ...MEASURES_LOG.map((m) => ({ id: `j-${m.id}`, at: `${m.date}T12:00`, who: m.author, role: m.authorRole === 'PROFESSEUR' ? 'ENSEIGNANT' : m.authorRole, kind: 'PUNITION', student: m.student, text: `${{ OBSERVATION: 'Observation écrite', RETENUE: 'Retenue', DEVOIR_SUPP: 'Devoir supplémentaire', AVERTISSEMENT: 'Avertissement' }[m.measure] ?? m.measure} : ${m.reason}` })),
  ...PHONES.map((p) => ({ id: `j-${p.id}`, at: p.at, who: p.confiscatedBy, role: p.confiscatedBy.startsWith('Direction') ? 'DIRECTION' : 'ENSEIGNANT', kind: 'OBJET', student: p.student, text: p.action === 'AVERTISSEMENT' ? `Avertissement (${p.object ?? 'téléphone'})` : `${p.object ?? 'Téléphone'} confisqué, remis à ${p.receivedBy ?? 'la vie scolaire'}` })),
  { id: 'j-d1', at: '2026-10-13T08:20', who: 'M. Be (CPE)', role: 'VIE_SCOLAIRE', kind: 'PARENTS', student: 'RAJAONARIVELO Tsiry', text: 'Parents prévenus de l\'absence (application et e-mail)' },
  { id: 'j-d2', at: '2026-10-13T09:40', who: 'Mme Hanta (secrétariat)', role: 'BUREAU', kind: 'JUSTIF', student: 'RAVELO Hasina', text: 'Absence justifiée : certificat médical' },
  { id: 'j-d3', at: '2026-10-13T10:15', who: 'M. Be (CPE)', role: 'VIE_SCOLAIRE', kind: 'SOIN', student: 'RAZAKA Feno', text: 'Passage à l\'infirmerie : maux de tête, retour en classe' },
  { id: 'j-d4', at: '2026-10-13T10:30', who: 'Mme Ranaivo', role: 'ENSEIGNANT', kind: 'OUBLI', student: 'RAJAONARIVELO Tsiry', text: 'Carnet de liaison oublié' },
  { id: 'j-d5', at: '2026-10-12T15:00', who: 'M. Be (CPE)', role: 'VIE_SCOLAIRE', kind: 'COLLE', student: 'RAMAROSON Fitia', text: 'Colle de 1 h donnée (3 retards), mercredi 13h' },
  { id: 'j-d6', at: '2026-10-12T07:45', who: 'Mme Hanta (secrétariat)', role: 'BUREAU', kind: 'PROF', text: 'Absence de M. Tojo notée (maths 5e) : cours annulé, familles prévenues' },
  { id: 'j-d7', at: '2026-10-09T16:10', who: 'Direction — Directrice adjointe', role: 'DIRECTION', kind: 'SORTIE', student: 'RASOA Lova', text: 'Sortie anticipée : récupérée par sa mère' },
];

export function loadJournal() {
  try { return [...(JSON.parse(localStorage.getItem(KEY)) ?? []), ...DEMO]; } catch { return DEMO; }
}

/** Ajoute une ligne au journal (date de démonstration, heure réelle). */
export function logActivity({ who, role, kind, text, student }) {
  const time = new Date().toTimeString().slice(0, 5);
  const entry = { id: `j${Date.now()}${Math.random().toString(36).slice(2, 6)}`, at: `${DEMO_TODAY}T${time}`, who, role, kind, text, student };
  try {
    const mine = JSON.parse(localStorage.getItem(KEY)) ?? [];
    localStorage.setItem(KEY, JSON.stringify([entry, ...mine].slice(0, 2000)));
  } catch { /* stockage indisponible */ }
  return entry;
}

/** Personne connectée, par profil (démonstration). */
export const ACTOR = { DIRECTION: 'Direction — Cheffe d\'établissement', BUREAU: 'Mme Hanta (secrétariat)', VIE_SCOLAIRE: 'M. Be (CPE)', ENSEIGNANT: 'Mme Ranaivo' };
