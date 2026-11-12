// « L'école aujourd'hui / cette semaine » : les chiffres de la période et leur évolution par rapport à la
// période précédente (jour de classe précédent, semaine précédente du lundi au vendredi). Tout vient des mêmes données que les écrans, pour des chiffres identiques partout.
const day = (x) => String(x ?? '').slice(0, 10);
const shift = (iso, n) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

const weekday = (iso) => new Date(`${iso}T12:00:00Z`).getUTCDay();
/** Bornes de la période [from, to] et de la précédente. `p` : 'DAY', 'WEEK' (lundi–vendredi) ou un nombre de jours. */
export function periodRange(today, p) {
  if (p === 'DAY') {
    const back = weekday(today) === 1 ? 3 : weekday(today) === 0 ? 2 : 1; // lundi → vendredi précédent
    const prev = shift(today, -back);
    return { from: today, to: today, prevFrom: prev, prevTo: prev };
  }
  if (p === 'WEEK') {
    const wd = weekday(today); const monday = shift(today, wd === 0 ? -6 : 1 - wd);
    return { from: monday, to: shift(monday, 4), prevFrom: shift(monday, -7), prevTo: shift(monday, -3) };
  }
  const days = p;
  const from = shift(today, -(days - 1));
  return { from, to: today, prevFrom: shift(from, -days), prevTo: shift(from, -1) };
}

/** Indicateurs : { id: { now, before } } pour chaque série (liste + fonction date). */
export function pulse(series, today, days) {
  const r = periodRange(today, days);
  const inR = (d, a, b) => d >= a && d <= b;
  return Object.fromEntries(Object.entries(series).map(([id, { list, date, keep = () => true }]) => {
    const rows = list.filter(keep);
    return [id, { now: rows.filter((x) => inR(day(date(x)), r.from, r.to)).length, before: rows.filter((x) => inR(day(date(x)), r.prevFrom, r.prevTo)).length }];
  }));
}

/** « +3 » / « −2 » / « = » par rapport à la période précédente. */
export const trend = ({ now, before }) => (now === before ? '=' : now > before ? `+${now - before}` : `−${before - now}`);

/** Ce qui vient : événements (datés ou sur plusieurs jours) des `days` prochains jours, triés. */
export function upcoming(events, today, days = 21) {
  const until = shift(today, days);
  return events.filter((e) => (e.end && e.end.length === 10 ? e.end : e.date) >= today && e.date <= until)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.start ?? '').localeCompare(b.start ?? ''));
}
