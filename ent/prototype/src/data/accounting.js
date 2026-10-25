// Données de démonstration — Comptabilité Tamatave (montants FICTIFS à remplacer).
import { liveArray, liveObject, demoOr } from '../demoData.js';

// Journaux comptables étanches
export const JOURNALS = {
  ECOLAGE: { label: 'Frais de scolarité', tone: 'navy' },
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
  { key: 'ecolage', label: 'Frais de scolarité / mois', hint: 'Mensuel, journal Frais de scolarité' },
  { key: 'fascicule', label: 'Fascicule', hint: 'Une fois par an' },
  { key: 'location', label: 'Location manuels', hint: 'Calculée : 25 000 Ar par manuel à rendre du lot de la classe', computed: true },
  { key: 'cahiers', label: 'Cahiers d\'activités', hint: 'Calculé : cahiers gardés par l\'élève, au prix fixé dans Manuels scolaires', computed: true },
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
];

// Familles et état de compte (débit = facturé, crédit = payé)
const DEMO_FAMILIES = [
  {
    id: 'fam1', name: 'Famille RAKOTOARISOA', payer: 'Mme Rakotoarisoa Hanta', phone: '+261 34 •• •• •12',
    children: [{ name: 'Aina', cls: '1re STMG' }, { name: 'Toky', cls: '5e' }],
    lines: [
      { date: '2026-08-25', label: 'Réinscription — Aina (1re STMG)', journal: 'FRAIS_ANNEXES', debit: 180_000 },
      { date: '2026-08-25', label: 'Réinscription — Toky (5e)', journal: 'FRAIS_ANNEXES', debit: 150_000 },
      { date: '2026-08-25', label: 'Paiement chèque n° 4410275 (BNI)', journal: 'FRAIS_ANNEXES', credit: 330_000 },
      { date: '2026-09-01', label: 'Fascicule + location manuels — Aina', journal: 'FRAIS_ANNEXES', debit: 190_000 },
      { date: '2026-09-01', label: 'Fascicule + location manuels — Toky', journal: 'FRAIS_ANNEXES', debit: 140_000 },
      { date: '2026-09-05', label: 'Frais de scolarité septembre — Aina', journal: 'ECOLAGE', debit: 420_000 },
      { date: '2026-09-05', label: 'Frais de scolarité septembre — Toky', journal: 'ECOLAGE', debit: 340_000 },
      { date: '2026-09-05', label: 'Paiement espèces — reçu TMV-0412', journal: 'ECOLAGE', credit: 760_000 },
      { date: '2026-09-10', label: 'Virement — fascicules et manuels', journal: 'FRAIS_ANNEXES', credit: 330_000 },
      { date: '2026-10-02', label: 'Droits Pré-Bac (EAF) — Aina', journal: 'DROITS_EXAMEN', debit: 450_000 },
      { date: '2026-10-05', label: 'Frais de scolarité octobre — Aina', journal: 'ECOLAGE', debit: 420_000 },
      { date: '2026-10-05', label: 'Frais de scolarité octobre — Toky', journal: 'ECOLAGE', debit: 340_000 },
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
      { date: '2026-09-05', label: 'Frais de scolarité septembre — Mamy', journal: 'ECOLAGE', debit: 450_000 },
      { date: '2026-10-02', label: 'Droits Bac — Mamy', journal: 'DROITS_EXAMEN', debit: 600_000 },
      { date: '2026-10-05', label: 'Frais de scolarité octobre — Mamy', journal: 'ECOLAGE', debit: 450_000 },
      { date: '2026-10-07', label: 'Paiement chèque n° 2290341 (BFV)', journal: 'DROITS_EXAMEN', credit: 600_000 },
    ],
  },
];

// Caisse de Tamatave : entrées / sorties du jour
export const CASH_NATURES = {
  IN: ['Encaissement famille', 'Apport banque', 'Autre entrée'],
  // les salaires ont leur propre rubrique (onglet Salaires, avec émargement) : pas de saisie libre ici
  OUT: ['Dépense de fonctionnement', 'Prélèvement Direction', 'Reversement centre d\'examen', 'Remboursement famille', 'Dépôt en banque', 'Autre sortie'],
};
const DEMO_CASH_MOVEMENTS = [
  { id: 'c1', date: '2026-10-13', time: '07:42', dir: 'IN', nature: 'Encaissement famille', journal: 'ECOLAGE', label: 'Frais de scolarité octobre — RAZAFY Kanto', method: 'Espèces', amount: 420_000, agent: 'Mme Soa', receipt: 'ECO-TMV-00410' },
  { id: 'c2', date: '2026-10-13', time: '08:15', dir: 'IN', nature: 'Encaissement famille', journal: 'DROITS_EXAMEN', label: 'Droits DNB — RAVELO Hasina', method: 'Chèque n° 3318820', amount: 350_000, agent: 'Mme Soa', receipt: 'EXA-TMV-00055' },
  { id: 'c3', date: '2026-10-13', time: '09:05', dir: 'IN', nature: 'Encaissement famille', journal: 'FRAIS_ANNEXES', label: 'Tee-shirt × 2 — RASOA Lova', method: 'Espèces', amount: 70_000, agent: 'Mme Soa', receipt: 'ANX-TMV-00207' },
  { id: 'c4', date: '2026-10-13', time: '10:30', dir: 'OUT', nature: 'Dépense de fonctionnement', journal: 'ECOLAGE', label: 'Ramettes de papier et encre imprimante', method: 'Espèces', amount: 85_000, agent: 'Mme Soa' },
  { id: 'c5', date: '2026-10-13', time: '11:10', dir: 'IN', nature: 'Encaissement famille', journal: 'DROITS_EXAMEN', label: 'Droits Bac — RANDRIA Mamy', method: 'Virement — bordereau 77104', amount: 600_000, agent: 'Mme Soa', receipt: 'EXA-TMV-00056' },
  { id: 'c6', date: '2026-10-13', time: '14:20', dir: 'OUT', nature: 'Dépôt en banque', journal: 'ECOLAGE', label: 'Dépôt BOA — bordereau 5521', method: 'Espèces', amount: 400_000, agent: 'Mme Soa', bank: 'BOA Madagascar', slip: '5521' },
];

// Reçus du jour (journal des reçus) : chaque reçu correspond à une entrée de caisse
const R = (number, journal, time, studentId, student, cls, lines, method, extra = {}) => ({
  number, journal, date: '2026-10-13', time, at: `13/10/2026 ${time}`, studentId, student, cls, lines,
  total: lines.reduce((t, l) => t + l.amount, 0), method, ref: null, bank: null, bearer: '', cashier: 'Mme Soa (bureau)', status: 'VALIDE', ...extra,
});
const DEMO_RECEIPTS_TODAY = [
  R('ECO-TMV-00410', 'ECOLAGE', '07:42', 'e5', 'RAZAFY Kanto', '1re STMG', [{ key: 'ECO-10', label: 'Frais de scolarité octobre 2026', amount: 420_000 }], 'ESPECES', { bearer: 'Mme Razafy Voahangy (parent)' }),
  R('EXA-TMV-00055', 'DROITS_EXAMEN', '08:15', null, 'RAVELO Hasina', '3e', [{ key: 'EXAMEN', label: 'Droits DNB', amount: 350_000 }], 'CHEQUE', { ref: '3318820', bank: 'BNI Madagascar', bearer: 'M. Ravelo Haja (parent)' }),
  R('ANX-TMV-00207', 'FRAIS_ANNEXES', '09:05', null, 'RASOA Lova', '6e', [{ key: 'ART-ts', label: 'Tee-shirt scolaire × 2', amount: 70_000 }], 'ESPECES', {
    bearer: 'Lova Rasoa (élève)', status: 'ANNULATION_DEMANDEE',
    cancel: { reason: 'Mauvaise taille : la famille a rendu les deux tee-shirts neufs, remboursement en espèces', requestedBy: 'Mme Soa (bureau)', requestedAt: '13/10/2026 15:02' },
  }),
  R('EXA-TMV-00056', 'DROITS_EXAMEN', '11:10', 'e3', 'RANDRIA Mamy', 'Terminale Générale', [{ key: 'EXAMEN', label: 'Droits Bac', amount: 600_000 }], 'VIREMENT', { ref: '77104', bank: 'BOA Madagascar', bearer: 'M. Randria Feno (parent)' }),
];
const DEMO_CASH_AUDIT = [
  { at: '13/10/2026 15:02', by: 'Mme Soa (bureau)', action: 'Demande d\'annulation', receipt: 'ANX-TMV-00207', detail: 'Mauvaise taille : la famille a rendu les deux tee-shirts neufs, remboursement en espèces' },
  { at: '12/10/2026 17:05', by: 'Mme Soa (bureau)', action: 'Clôture de caisse', receipt: '—', detail: 'Caisse juste : 2 950 000 Ar comptés' },
];

// Espèces en caisse (coffre du secrétariat) à l'ouverture du 13 octobre, et clôtures précédentes
// Versements : mercredi après-midi (pas de cours) et vendredi après les cours ; rappel au secrétariat
const DEMO_CASH_SAFE = { morning: 2_950_000, lastDeposit: '2026-10-09', depositDays: [3, 5], depositSlots: { 3: 'après-midi', 5: 'après les cours' }, maxAmount: 2_500_000 };
const DEMO_CASH_CLOSINGS = [
  { date: '2026-10-12', expected: 2_950_000, counted: 2_950_000, diff: 0, status: 'JUSTE', explanation: '', by: 'Mme Soa (bureau)', at: '12/10/2026 17:05' },
  { date: '2026-10-09', expected: 980_000, counted: 975_000, diff: -5_000, status: 'MANQUANT', explanation: 'Monnaie rendue en trop à un parent (erreur de rendu), signalé à la Direction', by: 'Mme Soa (bureau)', at: '09/10/2026 17:12' },
];

// Réductions accordées par la Direction : un taux sur les frais de scolarité mensuels et un sur
// l'inscription / réinscription ; tous les autres frais (fascicule, manuels, articles, examens) à 100 %.
// Pas de réduction pour la fratrie. null = taux à définir par la Direction.
export const REDUCTION_TYPES = [
  { id: 'REDOUBLANT_TLE', label: 'Redoublant en Terminale', rates: { ECOLAGE: 25, INSCRIPTION: 50 } },
  { id: 'PROCHE', label: 'Exonération famille et proches de l\'établissement', rates: { ECOLAGE: 100, INSCRIPTION: 0 } },
  { id: 'PERSONNEL', label: 'Enfant du personnel', rates: { ECOLAGE: null, INSCRIPTION: null } },
];

// Historique de caisse depuis la rentrée (démonstration) : encaissements des familles chaque jour
// de classe, dépôts en banque le vendredi, quelques dépenses ; droits d'examen à partir d'octobre.
export const CASH_YEAR_OPENING = { ECOLAGE: 150_000, FRAIS_ANNEXES: 20_000, DROITS_EXAMEN: 0 };
const NAMES = ['RAKOTO Fanja', 'RABE Lova', 'RANDRIA Tiana', 'RASOA Mialy', 'RAZAFY Hery', 'RAVELO Noro', 'RAHARISON Toky', 'RAJAONA Fy'];
const MONTHS_FR = { '09': 'septembre', 10: 'octobre' };
const DEMO_CASH_HISTORY = (() => {
  const out = [];
  let n = 0;
  for (let d = new Date(Date.UTC(2026, 8, 7)); d < new Date(Date.UTC(2026, 9, 13)); d.setUTCDate(d.getUTCDate() + 1)) {
    const wd = d.getUTCDay();
    if (wd === 0 || wd === 6) continue;
    const date = d.toISOString().slice(0, 10);
    const mm = date.slice(5, 7);
    const add = (m) => out.push({ id: `h${++n}`, date, agent: 'Mme Soa', ...m });
    const who = NAMES[n % NAMES.length];
    const payMethod = ['Espèces', `Chèque n° ${3318000 + n}`, 'Espèces', `Virement — bordereau ${77000 + n}`][n % 4];
    add({ time: '07:50', dir: 'IN', nature: 'Encaissement famille', journal: 'ECOLAGE', label: `Frais de scolarité ${MONTHS_FR[mm]} — ${who}`, method: payMethod, amount: [340_000, 380_000, 420_000][n % 3] });
    add({ time: '09:20', dir: 'IN', nature: 'Encaissement famille', journal: 'ECOLAGE', label: `Frais de scolarité ${MONTHS_FR[mm]} — ${NAMES[(n + 3) % NAMES.length]}`, method: 'Espèces', amount: 350_000 });
    if (mm === '09' && wd !== 3) add({ time: '10:40', dir: 'IN', nature: 'Encaissement famille', journal: 'FRAIS_ANNEXES', label: `Réinscription et fascicule — ${NAMES[(n + 5) % NAMES.length]}`, method: 'Espèces', amount: 220_000 });
    if (mm === '10' && wd !== 3) add({ time: '11:00', dir: 'IN', nature: 'Encaissement famille', journal: 'DROITS_EXAMEN', label: `Droits d'examen — ${NAMES[(n + 1) % NAMES.length]}`, method: n % 2 ? 'Espèces' : `Chèque n° ${3319000 + n}`, amount: 450_000 });
    if (wd === 2) add({ time: '13:30', dir: 'OUT', nature: 'Dépense de fonctionnement', journal: 'ECOLAGE', label: 'Fournitures de bureau', method: 'Espèces', amount: 45_000 });
    if (wd === 5) {
      add({ time: '15:30', dir: 'OUT', nature: 'Dépôt en banque', journal: 'ECOLAGE', label: 'Dépôt BOA — fin de semaine', method: 'Espèces', amount: 3_000_000 });
      if (mm === '09') add({ time: '15:40', dir: 'OUT', nature: 'Dépôt en banque', journal: 'FRAIS_ANNEXES', label: 'Dépôt BOA — frais annexes', method: 'Espèces', amount: 700_000 });
      if (mm === '10') add({ time: '15:45', dir: 'OUT', nature: 'Dépôt en banque', journal: 'DROITS_EXAMEN', label: 'Dépôt BOA — droits d\'examen', method: 'Espèces', amount: 900_000 });
    }
  }
  return out;
})();
// Solde d'ouverture du jour (13 octobre) = clôture de la veille
const opening = { ...CASH_YEAR_OPENING };
for (const m of DEMO_CASH_HISTORY) opening[m.journal] += m.dir === 'IN' ? m.amount : -m.amount;
export const CASH_OPENING = liveObject(() => demoOr(opening, CASH_YEAR_OPENING));
export const CASH_HISTORY = liveArray(() => demoOr(DEMO_CASH_HISTORY, []));

// Encaissement : comptes élèves (clés payées) — la grille et le plan donnent les montants
export const BANKS = ['BNI Madagascar', 'BOA Madagascar', 'BFV-SG', 'BMOI', 'Société Générale', 'AccèsBanque', 'Autre'];

const DEMO_STUDENT_ACCOUNTS = [
  { id: 'e1', name: 'RAKOTOARISOA Aina', cls: '1re STMG', family: 'Famille RAKOTOARISOA', isNew: false, enrolledOn: '2026-09-01',
    paid: ['REINSCRIPTION', 'FASCICULE', 'LOCATION', 'CAHIERS', 'ECO-09', 'EXAMEN'],
    exam: { label: 'Droits Pré-Bac (EAF)', amount: 450_000, due: '2026-10-31' } },
  { id: 'e2', name: 'RAKOTOARISOA Toky', cls: '5e', family: 'Famille RAKOTOARISOA', isNew: false, enrolledOn: '2026-09-01',
    paid: ['REINSCRIPTION', 'FASCICULE', 'LOCATION', 'CAHIERS', 'ECO-09'] },
  { id: 'e3', name: 'RANDRIA Mamy', cls: 'Terminale Générale', family: 'Famille RANDRIA', isNew: false, enrolledOn: '2026-09-01',
    paid: ['REINSCRIPTION', 'EXAMEN'], specialties: ['MATHS', 'PC'],
    reduction: { typeId: 'REDOUBLANT_TLE', motif: 'Redouble la Terminale (échec au Bac 2026)', by: 'Mme Sheena Lo (Direction)', at: '25/08/2026' }, exam: { label: 'Droits Bac', amount: 600_000, due: '2026-10-31' } },
  { id: 'e4', name: 'RASOAMANANA Fy', cls: '4e', family: 'Famille RASOAMANANA', isNew: true, enrolledOn: '2026-10-12', paid: [],
    reduction: { typeId: 'PROCHE', motif: 'Fille d\'un ami de l\'établissement', by: 'Mme Sheena Lo (Direction)', at: '12/10/2026' } },
  { id: 'e5', name: 'RAZAFY Kanto', cls: '1re STMG', family: 'Famille RAZAFY', isNew: false, enrolledOn: '2026-09-01',
    paid: ['REINSCRIPTION', 'FASCICULE', 'LOCATION', 'CAHIERS', 'ECO-09', 'ECO-10'],
    exam: { label: 'Droits Pré-Bac (EAF)', amount: 450_000, due: '2026-10-31' } },
];

// Taux horaires des professeurs avec leur date d'effet (historique des augmentations ; montants FICTIFS,
// remplacés par l'import du fichier de l'établissement). Le taux appliqué est celui en vigueur au mois payé.
export const HOURLY_RATES = [
  { staffId: 'p1', rate: 18_000, from: '2024-09-01' }, { staffId: 'p1', rate: 20_000, from: '2025-09-01' }, { staffId: 'p1', rate: 22_000, from: '2026-09-01' },
  { staffId: 'p2', rate: 18_000, from: '2024-09-01' }, { staffId: 'p2', rate: 20_000, from: '2026-01-01' },
  { staffId: 'p3', rate: 17_000, from: '2024-09-02' }, { staffId: 'p3', rate: 18_500, from: '2025-09-01' }, { staffId: 'p3', rate: 20_000, from: '2026-09-01' },
  { staffId: 'p4', rate: 18_000, from: '2024-09-01' }, { staffId: 'p4', rate: 20_000, from: '2025-09-01' },
  { staffId: 'p5', rate: 19_000, from: '2024-09-01' }, { staffId: 'p5', rate: 21_000, from: '2025-09-01' }, { staffId: 'p5', rate: 22_000, from: '2026-09-01' },
  { staffId: 'p6', rate: 20_000, from: '2025-10-01' },
  { staffId: 'p12', rate: 20_000, from: '2026-11-02' },
];

// État de paie mensuel : préparé et validé par la Direction, payé par le Bureau.
// Professeurs vacataires : heures de cours effectuées face aux élèves × taux en vigueur ; heures
// proposées d'après les appels, corrigées par la Direction ; rien pendant les vacances scolaires.
// Autres salariés : au mois. Espèces (le plus courant) : émargement du salarié au secrétariat.
export const PAYROLL = [
  { staffId: 'p1', byHour: true, hours: 74, plannedHours: 76, method: 'ESPECES' },
  { staffId: 'p2', byHour: true, hours: 80, plannedHours: 80, method: 'VIREMENT' },
  { staffId: 'p3', byHour: true, hours: 66, plannedHours: 68, method: 'ESPECES' },
  { staffId: 'p4', byHour: true, hours: 72, plannedHours: 72, method: 'ESPECES' },
  { staffId: 'p5', byHour: true, hours: 70, plannedHours: 72, method: 'ESPECES' },
  { staffId: 'p6', byHour: true, hours: 16, plannedHours: 16, method: 'ESPECES' },
  { staffId: 'p7', monthly: 950_000, method: 'ESPECES' },
  { staffId: 'p8', monthly: 750_000, method: 'ESPECES' },
  { staffId: 'p9', monthly: 480_000, method: 'ESPECES' },
  { staffId: 'p10', monthly: 450_000, method: 'ESPECES' },
];

export const FAMILIES = liveArray(() => demoOr(DEMO_FAMILIES, [])); // vide dès que les vraies données sont importées

export const CASH_MOVEMENTS = liveArray(() => demoOr(DEMO_CASH_MOVEMENTS, [])); // vide dès que les vraies données sont importées

export const RECEIPTS_TODAY = liveArray(() => demoOr(DEMO_RECEIPTS_TODAY, [])); // vide dès que les vraies données sont importées

export const CASH_CLOSINGS = liveArray(() => demoOr(DEMO_CASH_CLOSINGS, [])); // vide dès que les vraies données sont importées

export const CASH_AUDIT = liveArray(() => demoOr(DEMO_CASH_AUDIT, [])); // vide dès que les vraies données sont importées
export const CASH_SAFE = liveObject(() => demoOr(DEMO_CASH_SAFE, { ...DEMO_CASH_SAFE, morning: 0, lastDeposit: '2026-09-01' }));
export const STUDENT_ACCOUNTS = liveArray(() => demoOr(DEMO_STUDENT_ACCOUNTS, []));
