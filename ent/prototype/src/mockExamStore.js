// Examens blancs : sessions et notes, notes officielles de 1re des Terminales
// (prototype : gardés dans ce navigateur ; en production, en base).
import { MOCK_SESSIONS, OFFICIAL_FIRST } from './data/mockExams.js';

const KEY = 'ent-examens-blancs-v3'; // v3 : HG et EMC séparés, relevés publiés aux familles
export function loadMockExams() {
  try { const d = JSON.parse(localStorage.getItem(KEY)); if (d?.sessions) return d; } catch { /* stockage indisponible */ }
  return { sessions: MOCK_SESSIONS, official: OFFICIAL_FIRST };
}
export function saveMockExams(d) { try { localStorage.setItem(KEY, JSON.stringify(d)); return true; } catch { return false; } }
