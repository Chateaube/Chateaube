// Absences des professeurs (démonstration : gardées dans ce navigateur ; en production, table teacher_absence).
import { TEACHER_ABSENCES } from './data/timetable.js';
const KEY = 'ent-absences-prof-v1';
export function loadTeacherAbsences() { try { return JSON.parse(localStorage.getItem(KEY)) ?? TEACHER_ABSENCES; } catch { return TEACHER_ABSENCES; } }
export function saveTeacherAbsences(list) { try { localStorage.setItem(KEY, JSON.stringify(list)); return true; } catch { return false; } }
