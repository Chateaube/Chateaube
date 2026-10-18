// Ambiances saisonnières : une touche de couleur et une guirlande discrète sous la barre du haut, sans
// changer la lisibilité de l'ENT. Actives automatiquement entre deux dates (jour/mois) ; quand deux
// périodes se chevauchent, la plus courte l'emporte (Halloween pendant Octobre rose).
export const SEASONS = [
  { id: 'RENTREE', label: 'Rentrée', from: '09-01', to: '09-15', accent: '#0ea5e9', garland: '🎒 ✏️ 📚', greeting: 'Bonne rentrée à toutes et à tous !' },
  { id: 'OCTOBRE_ROSE', label: 'Octobre rose', from: '10-01', to: '10-31', accent: '#ec4899', garland: '🎀 💗 🎀', greeting: 'Octobre rose : toute l\'école se mobilise.' },
  { id: 'HALLOWEEN', label: 'Halloween', from: '10-25', to: '10-31', accent: '#f97316', garland: '🎃 🦇 👻 🍬', greeting: 'Joyeux Halloween !' },
  { id: 'NOEL', label: 'Noël', from: '12-01', to: '01-06', accent: '#dc2626', garland: '🎄 ⭐ 🎁 ❄️', greeting: 'Joyeuses fêtes de fin d\'année !' },
  { id: 'NOUVEL_AN', label: 'Nouvel an', from: '01-01', to: '01-07', accent: '#a855f7', garland: '✨ 🎆 🥂', greeting: 'Bonne année !' },
  { id: 'FEMMES', label: 'Journée des droits des femmes', from: '03-01', to: '03-08', accent: '#8b5cf6', garland: '💜 🌸', greeting: '8 mars : journée internationale des droits des femmes.' },
  { id: 'INDEPENDANCE', label: 'Fête de l\'Indépendance', from: '06-20', to: '06-26', accent: '#16a34a', garland: '🇲🇬 🎉 🇲🇬', greeting: 'Bonne fête de l\'Indépendance !' },
  { id: 'VACANCES', label: 'Grandes vacances', from: '06-27', to: '07-10', accent: '#f59e0b', garland: '☀️ 🏖️ 🌴', greeting: 'Bonnes vacances !' },
];

const md = (iso) => iso.slice(5, 10);
const inRange = (d, { from, to }) => (from <= to ? d >= from && d <= to : d >= from || d <= to); // Noël : déc. → janv.
const length = ({ from, to }) => { const n = (x) => Number(x.slice(0, 2)) * 31 + Number(x.slice(3)); return from <= to ? n(to) - n(from) : 372 - n(from) + n(to); };

/** Ambiance du jour : `mode` AUTO (selon les dates), OFF, ou l'identifiant d'une ambiance imposée. */
export function activeSeason(today, { mode = 'AUTO' } = {}) {
  if (mode === 'OFF') return null;
  if (mode !== 'AUTO') return SEASONS.find((s) => s.id === mode) ?? null;
  return SEASONS.filter((s) => inRange(md(today), s)).sort((a, b) => length(a) - length(b))[0] ?? null;
}
