// Date et heure de l'application. Avec les exemples : le mardi 13 octobre 2026 à 10 h 20 (les données de
// démonstration sont datées autour de ce jour). Avec les vraies données : la vraie date et l'heure de l'appareil.
import { realData } from './demoData.js';

export const DEMO_DATE = '2026-10-13';
const pad = (n) => String(n).padStart(2, '0');
const local = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const today = () => (realData() ? local(new Date()) : DEMO_DATE);
export const nowTime = (demo = '10:20') => (realData() ? new Date().toTimeString().slice(0, 5) : demo);
/** « AAAA-MM-JJTHH:MM » */
export const nowIso = (demoTime) => `${today()}T${nowTime(demoTime)}`;

export function addDays(iso, n) {
  const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10);
}
/** Lundi de la semaine du jour donné. */
export const weekStart = (iso) => { const wd = new Date(`${iso}T12:00:00Z`).getUTCDay(); return addDays(iso, wd === 0 ? -6 : 1 - wd); };
/** Prochain jour de la semaine donnée (1 = lundi … 5 = vendredi), aujourd'hui exclu. */
export const nextWeekday = (iso, wd) => { let d = addDays(iso, 1); while (new Date(`${d}T12:00:00Z`).getUTCDay() !== wd) d = addDays(d, 1); return d; };
