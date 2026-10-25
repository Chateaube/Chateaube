// Trésorerie : fournisseurs et dépenses (démonstration, montants FICTIFS).
import { liveArray, demoOr } from '../demoData.js';
export const EXPENSE_CATEGORIES = ['Loyer', 'Électricité et eau', 'Internet et téléphone', 'Fournitures', 'Entretien et réparations', 'Abonnements logiciels', 'Frais d\'examen', 'Transport', 'Autre'];

export const SUPPLIERS = [
  { id: 's1', name: 'Bailleur des locaux', category: 'Loyer', contact: '+261 34 •• •• •10', note: 'Loyer payé avant le 5 du mois' },
  { id: 's2', name: 'JIRAMA', category: 'Électricité et eau', contact: 'Agence de Tamatave', note: '' },
  { id: 's3', name: 'Fournisseur d\'accès internet', category: 'Internet et téléphone', contact: 'Service clients', note: 'Fibre, abonnement mensuel' },
  { id: 's4', name: 'Librairie-papeterie du centre', category: 'Fournitures', contact: '+261 32 •• •• •44', note: 'Ramettes, encre, craies' },
  { id: 's5', name: 'Zoom', category: 'Abonnements logiciels', contact: 'En ligne', note: 'Réunions à distance avec Tana' },
];

const DEMO_EXPENSES = [
  { id: 'x1', supplierId: 's1', category: 'Loyer', label: 'Loyer de septembre', amount: 2_500_000, date: '2026-09-04', due: '2026-09-05', status: 'PAYE', method: 'VIREMENT', ref: 'VIR-0904' },
  { id: 'x2', supplierId: 's2', category: 'Électricité et eau', label: 'Facture d\'août', amount: 640_000, date: '2026-09-18', due: '2026-09-20', status: 'PAYE', method: 'ESPECES', ref: '' },
  { id: 'x3', supplierId: 's1', category: 'Loyer', label: 'Loyer d\'octobre', amount: 2_500_000, date: '2026-10-05', due: '2026-10-05', status: 'PAYE', method: 'VIREMENT', ref: 'VIR-1005' },
  { id: 'x4', supplierId: 's3', category: 'Internet et téléphone', label: 'Abonnement d\'octobre', amount: 290_000, date: '2026-10-08', due: '2026-10-10', status: 'PAYE', method: 'VIREMENT', ref: 'VIR-1008' },
  { id: 'x5', supplierId: 's2', category: 'Électricité et eau', label: 'Facture de septembre', amount: 710_000, date: null, due: '2026-10-20', status: 'EN_ATTENTE', method: 'ESPECES', ref: '' },
  { id: 'x6', supplierId: 's5', category: 'Abonnements logiciels', label: 'Zoom — novembre', amount: 75_000, date: null, due: '2026-11-01', status: 'EN_ATTENTE', method: 'VIREMENT', ref: '' },
];

export const EXPENSES = liveArray(() => demoOr(DEMO_EXPENSES, [])); // vide dès que les vraies données sont importées
