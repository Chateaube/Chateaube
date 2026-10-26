// Données de démonstration — vie scolaire de Tamatave (noms FICTIFS).
import { CLASS_LIST } from './people.js';
import { loadImport } from '../importStore.js';
import { liveArray, demoOr } from '../demoData.js';

// Élèves par classe : le choix d'une classe filtre directement la liste des élèves.
// Démonstration ci-dessous ; dès qu'un fichier est importé, ce sont les vraies classes (« NOM Prénom »).
export const DEMO_CLASSES = {
  '5e': ['RAKOTOARISOA Toky', 'RASOA Lova', 'RANDRIA Tiavina', 'RAVOAHANGY Mamitiana', 'RAZAFIMAHEFA Noro'],
  '4e': ['RASOAMANANA Fy', 'RAKOTONIRINA Hanitra', 'RAMANANA Toavina', 'RAZAKA Feno'],
  '3e': ['RAVELO Hasina', 'ANDRIAMIHAJA Miora', 'RABEARIVELO Tsilavina', 'RAHARIMANANA Lalaina'],
  '2de': ['RAKOTOMALALA Fanja', 'RASOLOFO Ny Aina', 'ANDRIANTSOA Mahery', 'RAZAFINDRAKOTO Tahiry'], // fictifs
  '1re STMG': CLASS_LIST,
  'Terminale STMG': ['ANDRIANARIVO Tojo', 'RABEMANANJARA Lina', 'RAKOTONDRABE Fanilo', 'RAMANANTSOA Nathan', 'RANDRIANASOLO Ony', 'RAZANAMPARANY Sarobidy'],
  'Terminale Générale': ['RANDRIA Mamy', 'RAKOTOVAO Andry', 'RAZAFINDRATSIMA Volana'],
};
const ORDER = ['6e', '5e', '4e', '3e', '2de', '1re STMG', '1re Générale', 'Terminale STMG', 'Terminale Générale'];
let cache = { key: null, value: DEMO_CLASSES };
function current() {
  const imp = loadImport();
  const key = imp?.students?.length ? `${imp.importedAt}|${imp.students.length}` : null;
  if (key === cache.key) return cache.value;
  const byClass = {};
  (imp?.students ?? []).filter((s) => s.cls && s.lastName).forEach((s) => (byClass[s.cls] ??= []).push(`${s.lastName} ${s.firstName}`.trim()));
  const sorted = Object.fromEntries(Object.keys(byClass).sort((a, b) => ((ORDER.indexOf(a) + 1) || 99) - ((ORDER.indexOf(b) + 1) || 99)).map((c) => [c, byClass[c].sort((a, b) => a.localeCompare(b, 'fr'))]));
  cache = { key, value: key ? sorted : DEMO_CLASSES };
  return cache.value;
}
// lu à chaque utilisation : un import (même gardé seulement en mémoire) est pris en compte sans recharger
export const CLASSES = new Proxy({}, {
  get: (_, k) => current()[k],
  has: (_, k) => k in current(),
  ownKeys: () => Reflect.ownKeys(current()),
  getOwnPropertyDescriptor: (_, k) => (k in current() ? { value: current()[k], enumerable: true, configurable: true, writable: false } : undefined),
});
// Nouveaux élèves (entrés cette année) : règle du carnet de liaison plus souple (2 oublis = 1 h de colle)
export const NEW_STUDENTS = ['RAJAONARIVELO Tsiry', 'RAZAKA Feno', 'RAZANAMPARANY Sarobidy', 'RANDRIA Tiavina'];
export const classOf = (student) => Object.keys(CLASSES).find((c) => CLASSES[c].includes(student));

export const STAFF_NAMES = ['M. Be (CPE)', 'Mme Hanta (secrétariat)', 'Mme Ranaivo', 'M. Rasolo', 'Mme Hery', 'M. Tojo', 'Direction — Cheffe d\'établissement', 'Direction — Directrice adjointe'];

// Absences et retards (issus de l'appel) ; parentAck = « Je suis informé.e »
const DEMO_ATTENDANCE = [
  { id: 'a1', date: '2026-10-13', student: 'RAJAONARIVELO Tsiry', kind: 'ABSENCE', slot: '07h00–09h00', by: 'Mme Ranaivo', justified: false, notified: true, parentAck: null },
  { id: 'a2', date: '2026-10-13', student: 'RAMAROSON Fitia', kind: 'RETARD', slot: '07h00 (+15 min)', by: 'Mme Ranaivo', justified: false, notified: false, parentAck: null },
  { id: 'a3', date: '2026-10-13', student: 'RAVELO Hasina', kind: 'ABSENCE', slot: 'Journée', by: 'M. Rasolo', justified: true, reason: 'Certificat médical', notified: true, parentAck: '2026-10-13T08:12' },
  { id: 'a4', date: '2026-10-13', student: 'RASOA Lova', kind: 'RETARD', slot: '09h45 (+5 min)', by: 'Mme Hery', justified: false, notified: false, parentAck: null },
  { id: 'a6', date: '2026-10-06', student: 'RAMAROSON Fitia', kind: 'RETARD', slot: '07h00 (+10 min)', by: 'Mme Ranaivo', justified: false, notified: true, parentAck: '2026-10-06T18:20' },
  { id: 'a7', date: '2026-10-09', student: 'RAMAROSON Fitia', kind: 'RETARD', slot: '07h00 (+5 min)', by: 'M. Rasolo', justified: false, notified: true, parentAck: '2026-10-09T19:02' },
  { id: 'a8', date: '2026-10-13', student: 'RAKOTOARISOA Toky', kind: 'ABSENCE', slot: '13h00–15h00', by: 'M. Tojo', justified: false, notified: true, parentAck: null },
  { id: 'a9', date: '2026-10-13', student: 'RANDRIAMAMPIANINA Hery', kind: 'ABSENCE', slot: '07h00–09h00', by: 'M. Rasolo', justified: false, notified: true, parentAck: '2026-10-13T09:40', request: { reason: 'Certificat médical', note: 'Rendez-vous chez le médecin, certificat en photo.', photo: null, at: '2026-10-13T09:42', by: 'Parent de RANDRIAMAMPIANINA Hery' } },
  { id: 'a5', date: '2026-10-05', student: 'RAKOTOARISOA Aina', kind: 'RETARD', slot: '07h00 (+10 min)', by: 'M. Be', justified: true, reason: 'Transport', notified: true, parentAck: '2026-10-05T12:40' },
];

// Punitions (enseignant, vie scolaire) et sanctions (Direction), toujours avec motif
const DEMO_MEASURES_LOG = [
  { id: 'm1', date: '2026-10-08', student: 'RAJAONARIVELO Tsiry', measure: 'OBSERVATION', reason: 'Bavardages répétés malgré plusieurs rappels', author: 'Mme Hery', authorRole: 'PROFESSEUR', parentAck: '2026-10-08T19:05' },
  { id: 'm2', date: '2026-10-12', student: 'RANDRIAMAMPIANINA Hery', measure: 'RETENUE', reason: 'Travaux non rendus à trois reprises', author: 'M. Rasolo', authorRole: 'PROFESSEUR', when: 'Mercredi 14 octobre, 13h–15h', parentAck: null },
  { id: 'm3', date: '2026-10-12', student: 'RAKOTOARISOA Toky', measure: 'DEVOIR_SUPP', reason: 'Leçon non apprise', author: 'M. Tojo', authorRole: 'PROFESSEUR', parentAck: null },
  { id: 'm5', date: '2026-10-09', student: 'RAMAROSON Fitia', measure: 'DEVOIR_SUPP', reason: 'Exercices non faits deux fois de suite', author: 'Mme Ranaivo', authorRole: 'PROFESSEUR', parentAck: null },
  { id: 'm4', date: '2026-09-30', student: 'RANDRIAMAMPIANINA Hery', measure: 'AVERTISSEMENT', reason: 'Usage du téléphone en cours après une première confiscation', author: 'Cheffe d\'établissement', authorRole: 'DIRECTION', parentAck: '2026-10-01T07:30' },
];

// Objets confisqués (téléphone, écouteurs, montre connectée…) : qui a confisqué, à qui l'objet a été remis,
// durée décidée par la Direction ou le secrétariat (null : à décider), restitution
// owner : propriétaire du téléphone quand ce n'est pas l'élève pris avec ; action AVERTISSEMENT : téléphone non pris
const DEMO_PHONES = [
  { id: 'p0', action: 'AVERTISSEMENT', student: 'RAKOTOARISOA Toky', at: '2026-10-09T11:00', confiscatedBy: 'Mme Ranaivo', reason: 'Téléphone sorti en classe (premier avertissement)', returned: null },
  { id: 'p1', student: 'RANDRIAMAMPIANINA Hery', at: '2026-10-12T10:20', duration: '5J', confiscatedBy: 'M. Rasolo', receivedBy: 'M. Be (CPE)', reason: 'Téléphone utilisé pendant le DS', returned: null },
  { id: 'p2', student: 'RAVOAHANGY Mamitiana', owner: 'RASOA Lova', at: '2026-10-13T08:05', duration: '24H', confiscatedBy: 'Direction — Directrice adjointe', receivedBy: 'Direction — Directrice adjointe', reason: 'Téléphone sorti dans la cour', returned: null },
  { id: 'p4', student: 'RAZANAMPARANY Sarobidy', object: 'Écouteurs sans fil', at: '2026-10-13T09:10', duration: null, confiscatedBy: 'M. Rasolo', receivedBy: 'Vie scolaire (CPE)', reason: 'Écouteurs portés pendant le cours', returned: null },
  { id: 'p5', student: 'RAKOTONIRINA Hanitra', object: 'Montre connectée', at: '2026-10-12T14:30', duration: '24H', durationBy: 'Mme Hanta (secrétariat)', confiscatedBy: 'Mme Hery', receivedBy: 'Secrétariat', reason: 'Messages consultés pendant l\'évaluation', returned: null },
  { id: 'p3', student: 'RABEMANANJARA Lina', at: '2026-10-08T14:00', duration: '24H', confiscatedBy: 'Mme Ranaivo', receivedBy: 'M. Be (CPE)', reason: 'Appel en classe', returned: { at: '2026-10-09T14:10', by: 'M. Be (CPE)', to: 'Mme Rabemananjara (mère)' } },
];

export const ATTENDANCE = liveArray(() => demoOr(DEMO_ATTENDANCE, [])); // vide dès que les vraies données sont importées

export const MEASURES_LOG = liveArray(() => demoOr(DEMO_MEASURES_LOG, [])); // vide dès que les vraies données sont importées

export const PHONES = liveArray(() => demoOr(DEMO_PHONES, [])); // vide dès que les vraies données sont importées
