// Inventaire de démonstration — Tamatave (quantités fictives).
import { RESOURCES } from './demo.js';

const ROOM = { 'tmv-lab': 'Laboratoire', 'tmv-pc': 'Secrétariat' };
export const INVENTORY = [
  { id: 'i1', cat: 'Mobilier', name: 'Table élève simple', qty: 120, broken: 3, place: 'Salles de classe', min: 5 },
  { id: 'i2', cat: 'Mobilier', name: 'Table élève double', qty: 40, broken: 1, place: 'Salles de classe', min: 2 },
  { id: 'i3', cat: 'Mobilier', name: 'Chaise élève', qty: 200, broken: 6, place: 'Salles de classe', min: 10 },
  { id: 'i4', cat: 'Mobilier', name: 'Bureau professeur', qty: 14, broken: 0, place: 'Salles de classe', min: 1 },
  { id: 'i5', cat: 'Mobilier', name: 'Chaise professeur', qty: 14, broken: 1, place: 'Salles de classe', min: 1 },
  { id: 'i6', cat: 'Mobilier', name: 'Armoire', qty: 10, broken: 0, place: 'Salles et secrétariat' },
  { id: 'i7', cat: 'Mobilier', name: 'Tableau blanc', qty: 14, broken: 0, place: 'Salles de classe' },
  { id: 'i8', cat: 'Équipement', name: 'Ventilateur', qty: 28, broken: 2, place: 'Salles de classe', min: 2 },
  { id: 'i9', cat: 'Équipement', name: 'Imprimante', qty: 2, broken: 0, place: 'Secrétariat' },
  ...RESOURCES.filter((r) => r.siteId === 'TMV' && r.type !== 'SALLE_SPECIALISEE').map((r) => ({ id: r.id, cat: 'Équipement', name: r.label, qty: 1, broken: 0, place: ROOM[r.id] ?? 'Secrétariat', bookable: true })),
  { id: 'o1', cat: 'Fournitures', name: 'Ramettes de papier A4', qty: 18, broken: 0, place: 'Secrétariat', min: 10 },
  { id: 'o2', cat: 'Fournitures', name: 'Marqueurs pour tableau blanc', qty: 25, broken: 0, place: 'Secrétariat', min: 30 },
  { id: 'o3', cat: 'Fournitures', name: 'Cartouches d\'encre imprimante', qty: 2, broken: 0, place: 'Secrétariat', min: 2 },
  { id: 'o4', cat: 'Fournitures', name: 'Craies (boîtes)', qty: 6, broken: 0, place: 'Secrétariat', min: 3 },
  { id: 'o5', cat: 'Fournitures', name: 'Copies doubles (paquets)', qty: 12, broken: 0, place: 'Secrétariat', min: 5 },
  { id: 'f1', cat: 'Trousse de secours', name: 'Doliprane 500 mg (comprimés)', qty: 14, broken: 0, place: 'Secrétariat', min: 10, expires: '2027-06-30', paracetamol: true },
  { id: 'f2', cat: 'Trousse de secours', name: 'Compresses stériles', qty: 30, broken: 0, place: 'Secrétariat', min: 10, expires: '2028-01-31' },
  { id: 'f3', cat: 'Trousse de secours', name: 'Pansements', qty: 40, broken: 0, place: 'Secrétariat', min: 15 },
  { id: 'f4', cat: 'Trousse de secours', name: 'Désinfectant (chlorhexidine)', qty: 1, broken: 0, place: 'Secrétariat', min: 1, expires: '2026-11-05' },
  { id: 'f5', cat: 'Trousse de secours', name: 'Bande de contention', qty: 4, broken: 0, place: 'Secrétariat', min: 2 },
  { id: 'f6', cat: 'Trousse de secours', name: 'Gants jetables (paires)', qty: 20, broken: 0, place: 'Secrétariat', min: 10 },
  { id: 'f7', cat: 'Trousse de secours', name: 'Poche de froid', qty: 2, broken: 0, place: 'Secrétariat', min: 1 },
];

// Passages de démonstration (élèves fictifs)
export const CARE_VISITS = [
  { id: 'c1', at: '2026-10-02T10:15', student: 'RASOA Lova', reason: 'Mal de tête', paracetamol: true, dose: '1 comprimé 500 mg', outcome: 'REPOS', by: 'Mme Hanta' },
  { id: 'c2', at: '2026-10-07T13:40', student: 'RASOA Lova', reason: 'Mal de tête', paracetamol: false, outcome: 'CLASSE', by: 'Mme Hanta' },
  { id: 'c3', at: '2026-10-09T09:50', student: 'RAMAROSON Fitia', reason: 'Blessure légère', detail: 'genou écorché en récréation', paracetamol: false, outcome: 'CLASSE', by: 'Mme Hanta' },
  { id: 'c5', at: '2026-10-12T14:20', student: 'RAKOTOARISOA Aina', reason: 'Mal de tête', paracetamol: true, dose: '1 comprimé 500 mg', outcome: 'REPOS', by: 'Mme Hanta' },
  { id: 'c4', at: '2026-10-12T11:05', student: 'RASOA Lova', reason: 'Mal de ventre', paracetamol: false, outcome: 'REPOS', by: 'Mme Hanta' },
];
