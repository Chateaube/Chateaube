import { useEffect, useState } from 'react';
import { activeAmbiance, ambianceConfig, PALETTES } from './rules/ambiances.js';

// Application de l'ambiance dans la page : une seule classe `ambiance--<palette>` sur <html> (les variables CSS
// font le reste), recalculée au passage de minuit. Préférences du visiteur gardées dans ce navigateur.

const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const PREFS = 'ent-ambiance-prefs-v1';
export const loadAmbiancePrefs = () => { try { return JSON.parse(localStorage.getItem(PREFS)) ?? {}; } catch { return {}; } };
export const saveAmbiancePrefs = (p) => { try { localStorage.setItem(PREFS, JSON.stringify(p)); } catch { /* stockage indisponible */ } };

/** Pose la classe de palette sur <html> (et retire la précédente). */
export function applyPalette(palette, root = document.documentElement) {
  Object.keys(PALETTES).forEach((p) => root.classList.remove(`ambiance--${p}`));
  if (palette) root.classList.add(`ambiance--${palette}`);
  if (palette) root.dataset.ambiance = palette; else delete root.dataset.ambiance;
}

/** Ambiance du jour, appliquée à la page tant que le composant est monté. */
export function useAmbiance(settings) {
  const [day, setDay] = useState(today);
  const config = ambianceConfig(settings);
  const ambiance = activeAmbiance(day, config);
  useEffect(() => {
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5) - now;
    const t = setTimeout(() => setDay(today()), midnight);
    return () => clearTimeout(t);
  }, [day]);
  useEffect(() => { applyPalette(ambiance?.palette); return () => applyPalette(null); }, [ambiance?.palette]);
  return { ambiance, animations: config.animations !== false };
}

/** Le visiteur a-t-il demandé moins d'animations (réglage du système) ? Suit les changements en direct. */
export function useReducedMotion() {
  const media = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null);
  const [reduced, setReduced] = useState(() => !!media()?.matches);
  useEffect(() => {
    const q = media();
    if (!q) return undefined;
    const on = (e) => setReduced(e.matches);
    q.addEventListener?.('change', on);
    return () => q.removeEventListener?.('change', on);
  }, []);
  return reduced;
}
