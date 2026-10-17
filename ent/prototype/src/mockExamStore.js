// Examens blancs : sessions et notes, notes officielles des épreuves anticipées, contrôle continu
// (prototype : gardés dans ce navigateur ; en production, en base).
import { MOCK_SESSIONS, OFFICIAL_EAF, CC_AVERAGES } from './data/mockExams.js';

const KEY = 'ent-examens-blancs-v1';
export function loadMockExams() {
  try { const d = JSON.parse(localStorage.getItem(KEY)); if (d?.sessions) return d; } catch { /* stockage indisponible */ }
  return { sessions: MOCK_SESSIONS, eaf: OFFICIAL_EAF, cc: CC_AVERAGES };
}
export function saveMockExams(d) { try { localStorage.setItem(KEY, JSON.stringify(d)); return true; } catch { return false; } }
