// Bibliothèque de la salle d'étude (Tamatave) : démonstration. Chaque exemplaire a sa cote (étiquette).
const copies = (prefix, from, n, state = 'BON') => Array.from({ length: n }, (_, i) => ({ code: `${prefix}-${String(from + i).padStart(4, '0')}`, state }));

export const BOOKS = [
  { id: 'k1', type: 'ROMAN', title: 'L\'Étranger', author: 'Albert Camus', editor: 'Gallimard', collection: 'Folio', year: 1972, isbn: '9782070360024', copies: copies('ROM', 1, 3) },
  { id: 'k2', type: 'ROMAN', title: 'Le Petit Prince', author: 'Antoine de Saint-Exupéry', editor: 'Gallimard', collection: 'Folio', year: 1999, isbn: '9782070612758', copies: copies('ROM', 4, 4) },
  { id: 'k3', type: 'ROMAN', title: 'Les Misérables (extraits)', author: 'Victor Hugo', editor: 'Hachette', collection: 'Bibliocollège', year: 2015, isbn: '', copies: copies('ROM', 8, 2) },
  { id: 'k4', type: 'ROMAN', title: 'Une si longue lettre', author: 'Mariama Bâ', editor: 'Le Serpent à plumes', collection: 'Motifs', year: 2001, isbn: '', copies: copies('ROM', 10, 2) },
  { id: 'k5', type: 'ANNALES', title: 'Annabrevet — Français', author: '', editor: 'Nathan', collection: 'Annabrevet', year: 2026, isbn: '', copies: copies('ANN', 1, 3, 'NEUF') },
  { id: 'k6', type: 'ANNALES', title: 'Annabrevet — Mathématiques', author: '', editor: 'Nathan', collection: 'Annabrevet', year: 2026, isbn: '', copies: copies('ANN', 4, 3, 'NEUF') },
  { id: 'k7', type: 'ANNALES', title: 'Annabac — Philosophie Terminale', author: '', editor: 'Hatier', collection: 'Annabac', year: 2026, isbn: '', copies: copies('ANN', 7, 2, 'NEUF') },
  { id: 'k8', type: 'REFERENCE', title: 'Dictionnaire de français', author: '', editor: 'Larousse', collection: '', year: 2024, isbn: '', copies: copies('REF', 1, 2) },
  { id: 'k9', type: 'REFERENCE', title: 'Abaques et tables de mathématiques', author: '', editor: 'Bordas', collection: '', year: 2010, isbn: '', copies: copies('REF', 3, 1, 'USE') },
  { id: 'k10', type: 'DOCUMENTAIRE', title: 'Madagascar, histoire et géographie', author: '', editor: 'Karthala', collection: '', year: 2018, isbn: '', copies: copies('DOC', 1, 1) },
];

export const LIBRARY_LOANS = [
  { id: 'b1', code: 'ROM-0001', borrower: 'RANDRIA Mamy', kind: 'ELEVE', cls: 'Terminale Générale', out: '2026-09-08', due: '2026-10-08', renewals: 0 },
  { id: 'b2', code: 'ANN-0007', borrower: 'RAKOTOVAO Andry', kind: 'ELEVE', cls: 'Terminale Générale', out: '2026-09-28', due: '2026-10-28', renewals: 0 },
  { id: 'b3', code: 'ROM-0004', borrower: 'RAKOTOARISOA Aina', kind: 'ELEVE', cls: '1re STMG', out: '2026-09-15', due: '2026-11-12', renewals: 1, lastSeen: '2026-10-13' },
  { id: 'b4', code: 'REF-0003', borrower: 'TOJO Andry', kind: 'PROF', cls: null, out: '2026-09-02', due: null, renewals: 0 },
  { id: 'b5', code: 'ROM-0010', borrower: 'RASOA Lova', kind: 'ELEVE', cls: '5e', out: '2026-09-01', due: '2026-10-01', renewals: 0 },
];
