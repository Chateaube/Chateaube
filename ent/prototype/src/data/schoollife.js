// Données de démonstration — vie scolaire de Tamatave (noms FICTIFS).
import { CLASS_LIST } from './people.js';

// Élèves par classe : le choix d'une classe filtre directement la liste des élèves
export const CLASSES = {
  '5e': ['RAKOTOARISOA Toky', 'RASOA Lova', 'RANDRIA Tiavina', 'RAVOAHANGY Mamitiana', 'RAZAFIMAHEFA Noro'],
  '4e': ['RASOAMANANA Fy', 'RAKOTONIRINA Hanitra', 'RAMANANA Toavina', 'RAZAKA Feno'],
  '3e': ['RAVELO Hasina', 'ANDRIAMIHAJA Miora', 'RABEARIVELO Tsilavina', 'RAHARIMANANA Lalaina'],
  '1re STMG': CLASS_LIST,
  'Terminale STMG': ['ANDRIANARIVO Tojo', 'RABEMANANJARA Lina', 'RAKOTONDRABE Fanilo', 'RAMANANTSOA Nathan', 'RANDRIANASOLO Ony', 'RAZANAMPARANY Sarobidy'],
  'Terminale Générale': ['RANDRIA Mamy', 'RAKOTOVAO Andry', 'RAZAFINDRATSIMA Volana'],
};
export const classOf = (student) => Object.keys(CLASSES).find((c) => CLASSES[c].includes(student));

export const STAFF_NAMES = ['M. Be (vie scolaire)', 'Mme Ranaivo', 'M. Rasolo', 'Mme Hery', 'M. Tojo', 'Direction — Cheffe d\'établissement', 'Direction — Directrice adjointe'];

// Absences et retards (issus de l'appel) ; parentAck = « Je suis informé.e »
export const ATTENDANCE = [
  { id: 'a1', date: '2026-10-13', student: 'RAJAONARIVELO Tsiry', kind: 'ABSENCE', slot: '07h00–09h00', by: 'Mme Ranaivo', justified: false, notified: true, parentAck: null },
  { id: 'a2', date: '2026-10-13', student: 'RAMAROSON Fitia', kind: 'RETARD', slot: '07h00 (+15 min)', by: 'Mme Ranaivo', justified: false, notified: false, parentAck: null },
  { id: 'a3', date: '2026-10-13', student: 'RAVELO Hasina', kind: 'ABSENCE', slot: 'Journée', by: 'M. Rasolo', justified: true, reason: 'Certificat médical', notified: true, parentAck: '2026-10-13T08:12' },
  { id: 'a4', date: '2026-10-13', student: 'RASOA Lova', kind: 'RETARD', slot: '09h45 (+5 min)', by: 'Mme Hery', justified: false, notified: false, parentAck: null },
  { id: 'a5', date: '2026-10-05', student: 'RAKOTOARISOA Aina', kind: 'RETARD', slot: '07h00 (+10 min)', by: 'M. Be', justified: true, reason: 'Transport', notified: true, parentAck: '2026-10-05T12:40' },
];

// Punitions (enseignant, vie scolaire) et sanctions (Direction), toujours avec motif
export const MEASURES_LOG = [
  { id: 'm1', date: '2026-10-08', student: 'RAJAONARIVELO Tsiry', measure: 'OBSERVATION', reason: 'Bavardages répétés malgré plusieurs rappels', author: 'Mme Hery', authorRole: 'PROFESSEUR', parentAck: '2026-10-08T19:05' },
  { id: 'm2', date: '2026-10-12', student: 'RANDRIAMAMPIANINA Hery', measure: 'RETENUE', reason: 'Travaux non rendus à trois reprises', author: 'M. Rasolo', authorRole: 'PROFESSEUR', when: 'Mercredi 14 octobre, 13h–15h', parentAck: null },
  { id: 'm3', date: '2026-10-12', student: 'RAKOTOARISOA Toky', measure: 'DEVOIR_SUPP', reason: 'Leçon non apprise', author: 'M. Tojo', authorRole: 'PROFESSEUR', parentAck: null },
  { id: 'm5', date: '2026-10-09', student: 'RAMAROSON Fitia', measure: 'DEVOIR_SUPP', reason: 'Exercices non faits deux fois de suite', author: 'Mme Ranaivo', authorRole: 'PROFESSEUR', parentAck: null },
  { id: 'm4', date: '2026-09-30', student: 'RANDRIAMAMPIANINA Hery', measure: 'AVERTISSEMENT', reason: 'Usage du téléphone en cours après une première confiscation', author: 'Cheffe d\'établissement', authorRole: 'DIRECTION', parentAck: '2026-10-01T07:30' },
];

// Téléphones confisqués : qui a confisqué, qui l'a reçu et signé, restitution
export const PHONES = [
  { id: 'p1', student: 'RANDRIAMAMPIANINA Hery', at: '2026-10-12T10:20', duration: '5J', confiscatedBy: 'M. Rasolo', receivedBy: 'M. Be (vie scolaire)', reason: 'Téléphone utilisé pendant le DS', returned: null },
  { id: 'p2', student: 'RAVOAHANGY Mamitiana', at: '2026-10-13T08:05', duration: '24H', confiscatedBy: 'Direction — Directrice adjointe', receivedBy: 'Direction — Directrice adjointe', reason: 'Téléphone sorti dans la cour', returned: null },
  { id: 'p3', student: 'RABEMANANJARA Lina', at: '2026-10-08T14:00', duration: '24H', confiscatedBy: 'Mme Ranaivo', receivedBy: 'M. Be (vie scolaire)', reason: 'Appel en classe', returned: { at: '2026-10-09T14:10', by: 'M. Be (vie scolaire)', to: 'Mme Rabemananjara (mère)' } },
];
