// Texte agrandi (parents, grands-parents, petite vue) : tout l'ENT passe à 112,5 %, réglé par appareil.
const KEY = 'ent-texte-grand-v1';
export const loadLargeText = () => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } };
export function applyLargeText(on) {
  document.documentElement.style.fontSize = on ? '112.5%' : '';
  try { if (on) localStorage.setItem(KEY, '1'); else localStorage.removeItem(KEY); } catch { /* stockage indisponible */ }
}
