// Objets confisqués (téléphones, écouteurs…) et avertissements, partagés entre la saisie express,
// la vie scolaire, les alertes et le portail des familles (démonstration : gardés dans ce navigateur).
import { PHONES } from './data/schoollife.js';

const KEY = 'ent-objets-v1';
export function loadObjects() { try { return JSON.parse(localStorage.getItem(KEY)) ?? PHONES; } catch { return PHONES; } }
export function saveObjects(list) { try { localStorage.setItem(KEY, JSON.stringify(list)); return true; } catch { return false; } }
