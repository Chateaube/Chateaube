// Appel : séances de la semaine de l'enseignante connectée (Mme Ranaivo, démonstration).
// Maintenant (démonstration) : mardi 13 octobre 2026, 10 h 20.
import { CLASSES } from './schoollife.js';
import { today, nowTime } from '../clock.js';

export const NOW = { date: today(), time: nowTime() };

export const ROSTERS = CLASSES; // classes de démonstration ou classes importées

const S = (id, date, start, end, cls, subject, room, done = null) => ({ id, date, start, end, cls, subject, room, done });
export const WEEK_SESSIONS = [
  S('w1', '2026-10-12', '07:00', '09:00', '1re STMG', 'Management', 'Salle 12', { at: '07:06', marks: { 'RAMAROSON Fitia': { status: 'R', minutes: 10 } } }),
  S('w2', '2026-10-12', '09:45', '11:45', 'Terminale STMG', 'Management', 'Salle 12', { at: '09:50', marks: {} }),
  S('w3', '2026-10-12', '15:30', '17:00', '2de', 'SES', 'Salle 8'), // appel oublié
  S('w4', '2026-10-13', '07:00', '09:00', '1re STMG', 'Management', 'Salle 12', { at: '07:04', marks: { 'RAJAONARIVELO Tsiry': { status: 'A' }, 'RAMAROSON Fitia': { status: 'R', minutes: 15 } } }),
  S('w5', '2026-10-13', '10:00', '12:00', 'Terminale STMG', 'Management', 'Salle 12'),
  S('w6', '2026-10-13', '13:30', '15:30', '1re STMG', 'SGN', 'Salle informatique'),
  S('w7', '2026-10-14', '08:00', '09:30', '2de', 'SES', 'Salle 8'),
  S('w8', '2026-10-15', '10:30', '11:30', '1re STMG', 'Management', 'Salle 12'),
  S('w9', '2026-10-15', '13:30', '15:30', 'Terminale STMG', 'Droit', 'Salle 12'),
  S('w10', '2026-10-16', '07:00', '08:00', '1re STMG', 'Économie', 'Salle 12'),
];
