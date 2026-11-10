// Parcours d'ouverture : le thème abordé change d'un trimestre à l'autre (orientation, IA, numérique, art…).
// Le professeur l'indique pour sa classe et le trimestre ; le bulletin l'affiche à côté de la matière.
const KEY = 'ent-themes-parcours-v1';
export const THEME_SUGGESTIONS = ['Orientation', 'Intelligence artificielle', 'Numérique', 'Art et culture', 'Citoyenneté', 'Santé et bien-être'];
export const loadThemes = () => { try { return JSON.parse(localStorage.getItem(KEY)) ?? {}; } catch { return {}; } };
export const themeOf = (serviceId, termId, fallback = '') => loadThemes()[`${serviceId}|${termId}`] ?? fallback;
export function saveTheme(serviceId, termId, theme) {
  const all = loadThemes(); all[`${serviceId}|${termId}`] = theme;
  try { localStorage.setItem(KEY, JSON.stringify(all)); } catch { /* stockage indisponible */ }
}
