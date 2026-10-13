// Données de démonstration — Comptabilité Tamatave (montants FICTIFS à remplacer).

// Journaux comptables étanches
export const JOURNALS = {
  ECOLAGE: { label: 'Écolage', tone: 'navy' },
  FRAIS_ANNEXES: { label: 'Frais annexes', tone: 'green' },
  DROITS_EXAMEN: { label: 'Droits d\'examen', tone: 'violet' },
};

// Grille « Classes & tarifs » (Tamatave, 2026-2027)
export const CLASS_FEES = [
  { cls: '6e', plan: 0, inscription: 250_000, reinscription: 150_000, ecolage: 330_000, fascicule: 60_000, location: 80_000 },
  { cls: '5e', plan: 0, inscription: 250_000, reinscription: 150_000, ecolage: 340_000, fascicule: 60_000, location: 80_000 },
  { cls: '4e', plan: 0, inscription: 250_000, reinscription: 150_000, ecolage: 350_000, fascicule: 65_000, location: 85_000 },
  { cls: '3e', plan: 0, inscription: 250_000, reinscription: 150_000, ecolage: 380_000, fascicule: 70_000, location: 90_000 },
  { cls: '2de', plan: 1, inscription: 300_000, reinscription: 180_000, ecolage: 400_000, fascicule: 75_000, location: 100_000 },
  { cls: '1re Générale', plan: 2, inscription: 300_000, reinscription: 180_000, ecolage: 420_000, fascicule: 80_000, location: 110_000 },
  { cls: '1re STMG', plan: 2, inscription: 300_000, reinscription: 180_000, ecolage: 420_000, fascicule: 80_000, location: 110_000 },
  { cls: 'Terminale Générale', plan: 3, inscription: 300_000, reinscription: 180_000, ecolage: 450_000, fascicule: 90_000, location: 120_000 },
  { cls: 'Terminale STMG', plan: 3, inscription: 300_000, reinscription: 180_000, ecolage: 450_000, fascicule: 90_000, location: 120_000 },
];

export const FEE_COLUMNS = [
  { key: 'inscription', label: 'Inscription', hint: 'Nouvel élève, une fois' },
  { key: 'reinscription', label: 'Réinscription', hint: 'Élève déjà inscrit, une fois par an' },
  { key: 'ecolage', label: 'Écolage / mois', hint: 'Mensuel, journal Écolage' },
  { key: 'fascicule', label: 'Fascicule', hint: 'Une fois par an' },
  { key: 'location', label: 'Location manuels', hint: 'Une fois par an' },
];

// Catalogue « Articles & services » (facturés à la demande)
export const ARTICLES = [
  { id: 'a1', group: 'Manuel scolaire', label: 'Manuel perdu ou endommagé', unit: 'par manuel', price: 45_000, journal: 'FRAIS_ANNEXES', active: true },
  { id: 'a2', group: 'Manuel scolaire', label: 'Autre (manuel complémentaire)', unit: 'par manuel', price: 35_000, journal: 'FRAIS_ANNEXES', active: true },
  { id: 'a3', group: 'Passeport de Vie Scolaire', label: 'Passeport de Vie Scolaire', unit: 'par élève', price: 15_000, journal: 'FRAIS_ANNEXES', active: true },
  { id: 'a4', group: 'Passeport de Vie Scolaire', label: 'Passeport perdu ou endommagé', unit: 'remplacement', price: 20_000, journal: 'FRAIS_ANNEXES', active: true },
  { id: 'a5', group: 'Séances de natation', label: 'Séance de natation', unit: 'par séance', price: 15_000, journal: 'FRAIS_ANNEXES', active: true },
  { id: 'a6', group: 'Séances de natation', label: 'Forfait natation trimestriel', unit: 'par trimestre', price: 120_000, journal: 'FRAIS_ANNEXES', active: true },
  { id: 'a7', group: 'Tee-shirt scolaire', label: 'Tee-shirt scolaire', unit: 'par unité', price: 35_000, journal: 'FRAIS_ANNEXES', active: true },
  { id: 'a8', group: 'Autre', label: 'Autre (montant libre)', unit: 'montant saisi', price: null, journal: 'FRAIS_ANNEXES', active: true },
];

// Familles et état de compte (débit = facturé, crédit = payé)
export const FAMILIES = [
  {
    id: 'fam1', name: 'Famille RAKOTOARISOA', payer: 'Mme Rakotoarisoa Hanta', phone: '+261 34 •• •• •12',
    children: [{ name: 'Aina', cls: '1re STMG' }, { name: 'Toky', cls: '5e' }],
    lines: [
      { date: '2026-08-25', label: 'Réinscription — Aina (1re STMG)', journal: 'FRAIS_ANNEXES', debit: 180_000 },
      { date: '2026-08-25', label: 'Réinscription — Toky (5e)', journal: 'FRAIS_ANNEXES', debit: 150_000 },
      { date: '2026-08-25', label: 'Paiement chèque n° 4410275 (BNI)', journal: 'FRAIS_ANNEXES', credit: 330_000 },
      { date: '2026-09-01', label: 'Fascicule + location manuels — Aina', journal: 'FRAIS_ANNEXES', debit: 190_000 },
      { date: '2026-09-01', label: 'Fascicule + location manuels — Toky', journal: 'FRAIS_ANNEXES', debit: 140_000 },
      { date: '2026-09-05', label: 'Écolage septembre — Aina', journal: 'ECOLAGE', debit: 420_000 },
      { date: '2026-09-05', label: 'Écolage septembre — Toky', journal: 'ECOLAGE', debit: 340_000 },
      { date: '2026-09-05', label: 'Paiement espèces — reçu TMV-0412', journal: 'ECOLAGE', credit: 760_000 },
      { date: '2026-09-10', label: 'Virement — fascicules et manuels', journal: 'FRAIS_ANNEXES', credit: 330_000 },
      { date: '2026-10-02', label: 'Droits Pré-Bac (EAF) — Aina', journal: 'DROITS_EXAMEN', debit: 450_000 },
      { date: '2026-10-05', label: 'Écolage octobre — Aina', journal: 'ECOLAGE', debit: 420_000 },
      { date: '2026-10-05', label: 'Écolage octobre — Toky', journal: 'ECOLAGE', debit: 340_000 },
      { date: '2026-10-08', label: 'Paiement virement — bordereau 88213 (BOA)', journal: 'DROITS_EXAMEN', credit: 450_000 },
      { date: '2026-10-09', label: 'Séances de natation × 2 — Toky', journal: 'FRAIS_ANNEXES', debit: 30_000 },
    ],
  },
  {
    id: 'fam2', name: 'Famille RANDRIA', payer: 'M. Randria Feno', phone: '+261 32 •• •• •48',
    children: [{ name: 'Mamy', cls: 'Terminale Générale' }],
    lines: [
      { date: '2026-08-28', label: 'Réinscription — Mamy (Tle G)', journal: 'FRAIS_ANNEXES', debit: 180_000 },
      { date: '2026-08-28', label: 'Paiement espèces — reçu TMV-0398', journal: 'FRAIS_ANNEXES', credit: 180_000 },
      { date: '2026-09-01', label: 'Fascicule + location manuels — Mamy', journal: 'FRAIS_ANNEXES', debit: 210_000 },
      { date: '2026-09-05', label: 'Écolage septembre — Mamy', journal: 'ECOLAGE', debit: 450_000 },
      { date: '2026-10-02', label: 'Droits Bac — Mamy', journal: 'DROITS_EXAMEN', debit: 600_000 },
      { date: '2026-10-05', label: 'Écolage octobre — Mamy', journal: 'ECOLAGE', debit: 450_000 },
      { date: '2026-10-07', label: 'Paiement chèque n° 2290341 (BFV)', journal: 'DROITS_EXAMEN', credit: 600_000 },
    ],
  },
];

// Caisse de Tamatave : entrées / sorties du jour
export const CASH_NATURES = {
  IN: ['Encaissement famille', 'Apport banque', 'Autre entrée'],
  OUT: ['Dépense de fonctionnement', 'Reversement centre d\'examen', 'Remboursement famille', 'Dépôt en banque', 'Autre sortie'],
};
export const CASH_MOVEMENTS = [
  { id: 'c1', time: '07:42', dir: 'IN', nature: 'Encaissement famille', journal: 'ECOLAGE', label: 'Écolage octobre — RAZAFY Kanto', method: 'Espèces', amount: 420_000, agent: 'Mme Soa' },
  { id: 'c2', time: '08:15', dir: 'IN', nature: 'Encaissement famille', journal: 'DROITS_EXAMEN', label: 'Droits DNB — RAVELO Hasina', method: 'Chèque n° 3318820', amount: 350_000, agent: 'Mme Soa' },
  { id: 'c3', time: '09:05', dir: 'IN', nature: 'Encaissement famille', journal: 'FRAIS_ANNEXES', label: 'Tee-shirt × 2 — RASOA Lova', method: 'Espèces', amount: 70_000, agent: 'Mme Soa' },
  { id: 'c4', time: '10:30', dir: 'OUT', nature: 'Dépense de fonctionnement', journal: 'ECOLAGE', label: 'Ramettes de papier et encre imprimante', method: 'Espèces', amount: 85_000, agent: 'Mme Soa' },
  { id: 'c5', time: '11:10', dir: 'IN', nature: 'Encaissement famille', journal: 'DROITS_EXAMEN', label: 'Droits Bac — RANDRIA Mamy', method: 'Virement — bordereau 77104', amount: 600_000, agent: 'Mme Soa' },
  { id: 'c6', time: '14:20', dir: 'OUT', nature: 'Dépôt en banque', journal: 'ECOLAGE', label: 'Dépôt BOA — bordereau 5521', method: 'Espèces', amount: 400_000, agent: 'Mme Soa' },
];
export const CASH_OPENING = { ECOLAGE: 250_000, FRAIS_ANNEXES: 40_000, DROITS_EXAMEN: 0 };

// Encaissement : comptes élèves (clés payées) — la grille et le plan donnent les montants
export const BANKS = ['BNI Madagascar', 'BOA Madagascar', 'BFV-SG', 'BMOI', 'Société Générale', 'AccèsBanque', 'Autre'];

export const STUDENT_ACCOUNTS = [
  { id: 'e1', name: 'RAKOTOARISOA Aina', cls: '1re STMG', family: 'Famille RAKOTOARISOA', isNew: false, enrolledOn: '2026-09-01',
    paid: ['REINSCRIPTION', 'FASCICULE', 'LOCATION', 'ECO-09', 'EXAMEN'],
    exam: { label: 'Droits Pré-Bac (EAF)', amount: 450_000, due: '2026-10-31' } },
  { id: 'e2', name: 'RAKOTOARISOA Toky', cls: '5e', family: 'Famille RAKOTOARISOA', isNew: false, enrolledOn: '2026-09-01',
    paid: ['REINSCRIPTION', 'FASCICULE', 'LOCATION', 'ECO-09'] },
  { id: 'e3', name: 'RANDRIA Mamy', cls: 'Terminale Générale', family: 'Famille RANDRIA', isNew: false, enrolledOn: '2026-09-01',
    paid: ['REINSCRIPTION', 'EXAMEN'], exam: { label: 'Droits Bac', amount: 600_000, due: '2026-10-31' } },
  { id: 'e4', name: 'RASOAMANANA Fy', cls: '4e', family: 'Famille RASOAMANANA', isNew: true, enrolledOn: '2026-10-12', paid: [] },
  { id: 'e5', name: 'RAZAFY Kanto', cls: '1re STMG', family: 'Famille RAZAFY', isNew: false, enrolledOn: '2026-09-01',
    paid: ['REINSCRIPTION', 'FASCICULE', 'LOCATION', 'ECO-09', 'ECO-10'],
    exam: { label: 'Droits Pré-Bac (EAF)', amount: 450_000, due: '2026-10-31' } },
];
