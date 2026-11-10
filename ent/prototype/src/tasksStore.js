// Tâches de l'équipe (rules/tasks.js) : gardées dans ce navigateur pour le prototype.
import { demoOr } from './demoData.js';
const KEY = 'ent-taches-v1';
const DEMO = [
  { id: 't1', title: 'Relire les appréciations générales de la 1re STMG', assignee: 'DIRECTION', priority: 'HAUTE', due: '2026-10-20', done: false, createdBy: 'DIRECTION', createdAt: '2026-10-19T08:00' },
  { id: 't2', title: 'Relancer les 3 familles sans fiche signalétique signée', assignee: 'BUREAU', priority: 'NORMALE', due: '2026-10-23', done: false, createdBy: 'DIRECTION', createdAt: '2026-10-19T08:05' },
  { id: 't3', title: 'Préparer la salle pour la réunion parents-professeurs', assignee: 'VIE_SCOLAIRE', priority: 'BASSE', due: null, done: false, createdBy: 'DIRECTION', createdAt: '2026-10-19T08:10' },
];
export const loadTasks = () => { try { return JSON.parse(localStorage.getItem(KEY)) ?? demoOr(DEMO, []); } catch { return demoOr(DEMO, []); } };
export const saveTasks = (l) => { try { localStorage.setItem(KEY, JSON.stringify(l)); } catch { /* stockage indisponible */ } };
