// Absences et retards des élèves, partagés entre l'appel, la vie scolaire et le portail des familles
// (démonstration : gardés dans ce navigateur ; en production, table attendance + attendance_request).
import { ATTENDANCE } from './data/schoollife.js';

const KEY = 'ent-absences-eleves-v1';
export function loadAttendance() { try { return JSON.parse(localStorage.getItem(KEY)) ?? ATTENDANCE; } catch { return ATTENDANCE; } }
export function saveAttendance(list) { try { localStorage.setItem(KEY, JSON.stringify(list)); return true; } catch { return false; } }
