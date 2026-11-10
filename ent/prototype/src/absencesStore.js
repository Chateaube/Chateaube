// Absences des professeurs (démonstration : gardées dans ce navigateur ; en production, table teacher_absence).
import { TEACHER_ABSENCES, TEACHER_LATENESS, TEACHER_MAKEUPS } from './data/timetable.js';
import { demoOr } from './demoData.js';
const KEY = 'ent-absences-prof-v1';
export function loadTeacherAbsences() { try { return JSON.parse(localStorage.getItem(KEY)) ?? TEACHER_ABSENCES; } catch { return TEACHER_ABSENCES; } }
export function saveTeacherAbsences(list) { try { localStorage.setItem(KEY, JSON.stringify(list)); return true; } catch { return false; } }

// Retards des professeurs et heures rattrapées
const LKEY = 'ent-retards-prof-v1';
export function loadLateness() { try { return JSON.parse(localStorage.getItem(LKEY)) ?? demoOr({ lateness: TEACHER_LATENESS, makeups: TEACHER_MAKEUPS }, { lateness: [], makeups: [] }); } catch { return demoOr({ lateness: TEACHER_LATENESS, makeups: TEACHER_MAKEUPS }, { lateness: [], makeups: [] }); } }
export function saveLateness(d) { try { localStorage.setItem(LKEY, JSON.stringify(d)); } catch { /* stockage indisponible */ } }
