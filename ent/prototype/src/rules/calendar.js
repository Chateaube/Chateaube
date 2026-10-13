// Calendrier scolaire et délais de relance en « jours comptés ».
// Même algorithme que les fonctions SQL is_counted_day / add_counted_days /
// dunning_schedule : l'interface affiche exactement ce que la base appliquera.
// Dates manipulées sous forme de chaînes 'AAAA-MM-JJ' (calcul en UTC, sans
// risque de décalage de fuseau).

const parse = (iso) => new Date(`${iso}T00:00:00Z`);
const toIso = (d) => d.toISOString().slice(0, 10);

export const addDays = (iso, n) => {
  const d = parse(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return toIso(d);
};
export const isoWeekday = (iso) => parse(iso).getUTCDay() || 7; // 1 = lundi … 7 = dimanche
export const monthOf = (iso) => Number(iso.slice(5, 7));

const WEEKDAY_NAMES = ['', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const MONTH_NAMES = ['', 'janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

export const formatDateFr = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return `${WEEKDAY_NAMES[isoWeekday(iso)]} ${d === 1 ? "1er" : d} ${MONTH_NAMES[m]} ${y}`;
};
export const monthName = (m) => MONTH_NAMES[m];

/**
 * Le jour compte-t-il dans les délais de relance ?
 * @returns {{counted: boolean, reason?: string, kind?: 'WEEKEND'|'GEL'|'FERIE'|'VACANCES'|'FERMETURE'}}
 */
export function dayStatus(iso, settings) {
  const { dunning, calendar } = settings;
  // en cas de chevauchement (férié pendant les vacances), les vacances priment pour l'affichage
  const offs = calendar.filter((e) => e.start <= iso && iso <= e.end);
  const off = offs.find((e) => e.kind !== 'FERIE') ?? offs[0];
  if (off) return { counted: false, reason: off.label, kind: off.kind };
  if (!dunning.activeMonths.includes(monthOf(iso))) {
    return { counted: false, reason: `Mois de ${MONTH_NAMES[monthOf(iso)]} sans relance (décompte gelé)`, kind: 'GEL' };
  }
  if (!dunning.countedWeekdays.includes(isoWeekday(iso))) {
    return { counted: false, reason: 'Jour non compté (week-end)', kind: 'WEEKEND' };
  }
  return { counted: true };
}

/** Date atteinte après n jours comptés, à partir du lendemain de `from`. */
export function addCountedDays(from, n, settings) {
  let d = from;
  let count = 0;
  for (let guard = 0; count < n; guard++) {
    if (guard > 730) throw new Error('Aucun jour compté sur deux ans : vérifier les paramètres de relance.');
    d = addDays(d, 1);
    if (dayStatus(d, settings).counted) count++;
  }
  return d;
}

/** Date d'échéance d'un mois (le 5 par défaut). */
export function dueDateOf(year, month, settings) {
  return `${year}-${String(month).padStart(2, '0')}-${String(settings.tuition.dueDay).padStart(2, '0')}`;
}

/** Dates de relance, d'avertissement et de mise à pied pour une échéance. */
export function dunningSchedule(due, settings) {
  const { relanceAfter, warningAfter, suspensionAfter, countFrom } = settings.dunning;
  const relance = addCountedDays(due, relanceAfter, settings);
  if (countFrom === 'ETAPE_PRECEDENTE') {
    const warning = addCountedDays(relance, warningAfter, settings);
    return { due, relance, warning, suspension: addCountedDays(warning, suspensionAfter, settings) };
  }
  return {
    due,
    relance,
    warning: addCountedDays(due, warningAfter, settings),
    suspension: addCountedDays(due, suspensionAfter, settings),
  };
}

/** Étape du dossier à une date donnée (avant validation éventuelle de la Direction). */
export function stageOn(date, schedule, settings) {
  if (date >= schedule.suspension) {
    return settings.dunning.suspensionRequiresDirection ? 'A_VALIDER' : 'MISE_A_PIED';
  }
  if (date >= schedule.warning) return 'AVERTISSEMENT';
  if (date >= schedule.relance) return 'RELANCE';
  return 'DANS_LES_DELAIS';
}

/** Périodes non comptées traversées entre deux dates (pour expliquer un délai). */
export function pausesBetween(from, to, settings) {
  const out = [];
  for (let d = addDays(from, 1); d <= to; d = addDays(d, 1)) {
    const s = dayStatus(d, settings);
    if (s.counted || s.kind === 'WEEKEND') continue;
    const last = out.at(-1);
    if (last && last.reason === s.reason && addDays(last.end, 1) === d) last.end = d;
    else if (last && last.reason === s.reason && d <= addDays(last.end, 3)) last.end = d; // ignore les week-ends intercalés
    else out.push({ reason: s.reason, kind: s.kind, start: d, end: d });
  }
  return out;
}

/** Mois facturés d'un plan (rang scolaire : septembre = 0 … août = 11). */
export function planMonths({ first, last }) {
  const rank = (m) => (m + 3) % 12;
  return [9, 10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8].filter((m) => rank(m) >= rank(first) && rank(m) <= rank(last));
}

/** Date de Pâques (algorithme de Meeus) — pour générer les fériés mobiles. */
export function easterSunday(year) {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Jours fériés de Madagascar pour l'année scolaire commençant en septembre `startYear`. */
export function madagascarHolidays(startYear) {
  const y2 = startYear + 1;
  const easter = easterSunday(y2);
  const list = [
    [`${startYear}-11-01`, 'Toussaint'],
    [`${startYear}-12-25`, 'Noël'],
    [`${y2}-01-01`, 'Jour de l\'an'],
    [`${y2}-03-08`, 'Journée internationale des droits des femmes'],
    [`${y2}-03-29`, 'Commémoration des martyrs de 1947'],
    [addDays(easter, 1), 'Lundi de Pâques'],
    [`${y2}-05-01`, 'Fête du Travail'],
    [addDays(easter, 39), 'Ascension'],
    [addDays(easter, 50), 'Lundi de Pentecôte'],
    [`${y2}-06-26`, 'Fête de l\'Indépendance'],
    [`${y2}-08-15`, 'Assomption'],
  ];
  // fusionne les fériés tombant le même jour (ex. 29 mars 2027 = martyrs + Pâques)
  const byDate = new Map();
  for (const [date, label] of list) byDate.set(date, byDate.has(date) ? `${byDate.get(date)} / ${label}` : label);
  return [...byDate].sort().map(([date, label]) => ({ kind: 'FERIE', label, start: date, end: date }));
}
