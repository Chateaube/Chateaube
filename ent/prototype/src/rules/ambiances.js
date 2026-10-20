// Ambiances saisonnières et événementielles de l'ENT — école laïque : uniquement des repères civiques,
// culturels, historiques, liés à la vie scolaire ou aux saisons (hémisphère sud : printemps en septembre,
// automne en mars). Aucune fête religieuse.
//
// Une ambiance choisit une PALETTE (liste fermée, définie dans styles/ambiances.css et dont les contrastes sont
// vérifiés par les tests), un MOTIF d'animation discret et une NOTE contextuelle (« Le saviez-vous ? »).
// La couleur ne porte jamais d'information : elle décore ; le texte reste lisible dans toutes les palettes.

export const CATEGORIES = { SCOLAIRE: 'Vie scolaire', CIVIQUE: 'Civique', CULTUREL: 'Culturel', HISTORIQUE: 'Histoire', SAISON: 'Saison' };

/** Palettes validées (classe `ambiance--<id>` sur <html>). */
export const PALETTES = {
  ciel: 'Bleu ciel', vert: 'Vert', rose: 'Rose', violet: 'Violet', or: 'Or', rouge: 'Rouge', ambre: 'Ambre (automne)', sobre: 'Sobre (commémoration)',
};

/** Motifs d'animation (AmbianceEffects) ; `aucun` pour les commémorations. */
export const MOTIFS = { confettis: 'Confettis', petales: 'Pétales', feuilles: 'Feuilles', etoiles: 'Étoiles', aucun: 'Aucune animation' };

// Nouvel An lunaire : date variable (calendrier luni-solaire). À compléter chaque année ; sans date connue,
// l'ambiance ne s'active pas.
export const LUNAR_NEW_YEAR = {
  2026: ['2026-02-17', 'du Cheval'], 2027: ['2027-02-06', 'de la Chèvre'], 2028: ['2028-01-26', 'du Singe'], 2029: ['2029-02-13', 'du Coq'], 2030: ['2030-02-03', 'du Chien'],
};

export const AMBIANCES = [
  { id: 'RENTREE', label: 'Rentrée', category: 'SCOLAIRE', from: '09-01', to: '09-12', palette: 'ciel', motif: 'etoiles', symbol: '✏️',
    greeting: 'Bienvenue à toutes et à tous !',
    note: { title: 'Une nouvelle année commence', text: 'Emplois du temps, agendas et manuels sont dans l\'ENT. En cas de question, le secrétariat et la vie scolaire sont là pour vous aider.' } },
  { id: 'PRINTEMPS', label: 'Printemps', category: 'SAISON', from: '09-20', to: '09-30', palette: 'vert', motif: 'petales', symbol: '🌸',
    greeting: 'Les jours rallongent.',
    note: { title: 'Pourquoi le printemps en septembre ?', text: 'Madagascar est dans l\'hémisphère sud : l\'équinoxe de septembre (22 ou 23) y marque le début du printemps, quand c\'est l\'automne en France. À Antananarivo, c\'est la saison des jacarandas en fleurs.' } },
  { id: 'OCTOBRE_ROSE', label: 'Octobre rose', category: 'CIVIQUE', from: '10-01', to: '10-31', palette: 'rose', motif: 'petales', symbol: '🎀',
    greeting: 'Toute l\'école se mobilise.',
    note: { title: 'Octobre rose', text: 'Chaque année en octobre, une campagne mondiale sensibilise au dépistage du cancer du sein. Le ruban rose en est le symbole.' } },
  { id: 'ARMISTICE', label: 'Armistice du 11 novembre', category: 'HISTORIQUE', from: '11-04', to: '11-11', palette: 'sobre', motif: 'aucun', symbol: '🕊️',
    greeting: 'Journée de mémoire.',
    note: { title: '11 novembre 1918', text: 'L\'armistice met fin aux combats de la Première Guerre mondiale. Des milliers de soldats venus de Madagascar ont servi pendant ce conflit. Thème étudié en histoire au collège et au lycée.' } },
  { id: 'DROITS_ENFANT', label: 'Droits de l\'enfant', category: 'CIVIQUE', from: '11-14', to: '11-20', palette: 'ciel', motif: 'etoiles', symbol: '🧒',
    greeting: 'Journée internationale, le 20 novembre.',
    note: { title: 'Convention internationale des droits de l\'enfant', text: 'Adoptée par l\'ONU le 20 novembre 1989, elle reconnaît notamment à chaque enfant le droit à l\'éducation, à la santé et à la protection. Madagascar l\'a ratifiée en 1991.' } },
  { id: 'NOUVEL_AN', label: 'Nouvel An', category: 'CIVIQUE', from: '12-28', to: '01-06', palette: 'or', motif: 'confettis', symbol: '✨',
    greeting: 'Bonne année !',
    note: { title: 'Nouvelle année civile', text: 'Le 1er janvier ouvre l\'année du calendrier grégorien, utilisé pour la vie civile dans la plupart des pays du monde.' } },
  { id: 'NOUVEL_AN_LUNAIRE', label: 'Nouvel An lunaire', category: 'CULTUREL', lunar: true, palette: 'rouge', motif: 'confettis', symbol: '🏮',
    greeting: 'Bonne année lunaire !',
    note: { title: 'Le Nouvel An lunaire', text: 'Fêté en Chine, au Vietnam (Têt), en Corée et dans de nombreuses communautés, dont celle de Madagascar. Sa date suit un calendrier luni-solaire et change chaque année, entre fin janvier et mi-février.' } },
  { id: 'FEMMES', label: 'Droits des femmes', category: 'CIVIQUE', from: '03-01', to: '03-08', palette: 'violet', motif: 'petales', symbol: '💜',
    greeting: 'Journée internationale, le 8 mars.',
    note: { title: 'Le 8 mars', text: 'Journée reconnue par l\'ONU en 1977 pour faire le point sur l\'égalité entre les femmes et les hommes. À Madagascar, le 8 mars est un jour férié pour les femmes.' } },
  { id: 'FRANCOPHONIE', label: 'Francophonie', category: 'CULTUREL', from: '03-14', to: '03-20', palette: 'ciel', motif: 'etoiles', symbol: '📖',
    greeting: 'Journée internationale, le 20 mars.',
    note: { title: 'La Francophonie', text: 'Le 20 mars rappelle la création, en 1970 à Niamey, de l\'organisation devenue l\'Organisation internationale de la Francophonie, dont Madagascar est membre. L\'occasion de jouer avec la langue française.' } },
  { id: 'AUTOMNE', label: 'Automne', category: 'SAISON', from: '03-21', to: '04-04', palette: 'ambre', motif: 'feuilles', symbol: '🍂',
    greeting: 'Les jours raccourcissent.',
    note: { title: 'L\'équinoxe de mars', text: 'Dans l\'hémisphère sud, l\'équinoxe de mars (20 ou 21) marque le début de l\'automne : les jours raccourcissent jusqu\'en juin.' } },
  { id: 'MEMOIRE_1947', label: 'Commémoration du 29 mars 1947', category: 'HISTORIQUE', from: '03-25', to: '03-29', palette: 'sobre', motif: 'aucun', symbol: '🕊️',
    greeting: 'Journée de mémoire nationale.',
    note: { title: 'Le 29 mars 1947', text: 'Début de l\'insurrection malgache contre la colonisation, durement réprimée. Le 29 mars est une journée de commémoration nationale à Madagascar ; cette période est étudiée en histoire.' } },
  { id: 'ENVIRONNEMENT', label: 'Journée de l\'environnement', category: 'CIVIQUE', from: '05-30', to: '06-05', palette: 'vert', motif: 'feuilles', symbol: '🌱',
    greeting: 'Le 5 juin : chaque geste compte.',
    note: { title: 'Agir pour l\'environnement', text: 'Instituée par l\'ONU en 1972. Les éco-délégués de chaque classe proposent des gestes simples : tri, économies d\'eau et d\'énergie.' } },
  { id: 'INDEPENDANCE', label: 'Fête de l\'Indépendance', category: 'HISTORIQUE', from: '06-20', to: '06-26', palette: 'vert', motif: 'confettis', symbol: '🇲🇬',
    greeting: 'Bonne fête nationale !',
    note: { title: '26 juin 1960', text: 'Proclamation de l\'indépendance de Madagascar. Le 26 juin est la fête nationale.' } },
  { id: 'VACANCES', label: 'Grandes vacances', category: 'SCOLAIRE', from: '06-27', to: '07-10', palette: 'ciel', motif: 'aucun', symbol: '☀️',
    greeting: 'Bon repos, à la rentrée !', note: null },
];

// Mots qui n'ont pas leur place dans une école laïque (vérifié par les tests, et refusé pour une ambiance ajoutée).
export const NOT_SECULAR = /no[eë]l|halloween|toussaint|p[aâ]ques|ramadan|a[iï]d\b|hanouk|diwali|carême|careme|nativit|saint|religi/i;

const md = (iso) => iso.slice(5, 10);
const n = (x) => Number(x.slice(0, 2)) * 31 + Number(x.slice(3, 5));
const inRange = (d, { from, to }) => (from <= to ? d >= from && d <= to : d >= from || d <= to); // décembre → janvier
const span = ({ from, to }) => (from <= to ? n(to) - n(from) : 372 - n(from) + n(to));
const shift = (iso, days) => new Date(Date.parse(`${iso}T12:00:00Z`) + days * 864e5).toISOString().slice(0, 10);

/** Fenêtre de l'année de `today` pour une ambiance (le Nouvel An lunaire : 3 jours avant, 4 après). */
function windowFor(a, today) {
  if (!a.lunar) return a;
  const entry = LUNAR_NEW_YEAR[Number(today.slice(0, 4))];
  if (!entry) return null;
  return { from: md(shift(entry[0], -3)), to: md(shift(entry[0], 4)), animal: entry[1] };
}

/** Erreurs d'une ambiance ajoutée par la Direction (thème étudié en classe, journée de l'école…). */
export function ambianceErrors(a) {
  const e = [];
  if (!a.label?.trim()) e.push('Donner un nom.');
  if (!/^\d{2}-\d{2}$/.test(a.from ?? '') || !/^\d{2}-\d{2}$/.test(a.to ?? '')) e.push('Indiquer les dates de début et de fin.');
  if (!PALETTES[a.palette]) e.push('Choisir une palette de la liste.');
  if (!MOTIFS[a.motif]) e.push('Choisir une animation de la liste.');
  if (NOT_SECULAR.test(`${a.label} ${a.greeting ?? ''} ${a.note?.title ?? ''} ${a.note?.text ?? ''}`)) e.push('École laïque : pas de thème religieux.');
  return e;
}

/** Catalogue complet : ambiances prévues, notes corrigées par la Direction, ambiances ajoutées. */
export function catalog(config = {}) {
  const custom = (config.custom ?? []).filter((a) => !ambianceErrors(a).length).map((a) => ({ category: 'SCOLAIRE', symbol: '⭐', ...a, custom: true }));
  return [...AMBIANCES, ...custom].map((a) => (config.notes?.[a.id] ? { ...a, note: config.notes[a.id] } : a));
}

/**
 * Ambiance du jour. `config.mode` : AUTO (selon les dates), OFF, ou l'identifiant d'une ambiance imposée.
 * Plusieurs périodes en même temps : une ambiance ajoutée par la Direction l'emporte, puis la plus courte.
 */
export function activeAmbiance(today, config = {}) {
  const mode = config.mode ?? 'AUTO';
  if (mode === 'OFF') return null;
  const all = catalog(config);
  const forced = mode !== 'AUTO' && all.find((a) => a.id === mode);
  if (forced) return withLunar(forced, today);
  const d = md(today);
  const hits = all.map((a) => ({ a, w: windowFor(a, today) })).filter(({ w }) => w && inRange(d, w))
    .sort((x, y) => (y.a.custom ? 1 : 0) - (x.a.custom ? 1 : 0) || span(x.w) - span(y.w));
  return hits[0] ? withLunar(hits[0].a, today) : null;
}

function withLunar(a, today) {
  if (!a.lunar) return a;
  const animal = LUNAR_NEW_YEAR[Number(today.slice(0, 4))]?.[1];
  return animal ? { ...a, greeting: `Bonne année ${animal} !` } : a;
}

/** Dates lisibles d'une ambiance pour l'année de `today` (Paramètres). */
export function datesLabel(a, today) {
  const w = windowFor(a, today);
  if (!w) return 'date à renseigner';
  const fr = (x) => x.split('-').reverse().join('/');
  return `du ${fr(w.from)} au ${fr(w.to)}`;
}

/** Réglages : nouvelle forme `settings.ambiance`, ou ancienne `settings.seasonal`. */
export const ambianceConfig = (settings) => settings?.ambiance ?? { mode: settings?.seasonal?.mode ?? 'AUTO', animations: true, notes: {}, custom: [] };
