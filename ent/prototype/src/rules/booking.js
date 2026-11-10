// Réservation d'équipements : contrôle des horaires d'ouverture et des conflits.
// En production, la base garantit l'absence de chevauchement (contrainte EXCLUDE
// sur booking.period) ; ces fonctions servent au retour immédiat dans l'interface
// et aux suggestions d'alternatives.

export const toMin = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
export const toHHMM = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

// 1 = lundi … 5 = vendredi
export const SCHOOL_HOURS = {
  1: ['07:00', '17:00'], 2: ['07:00', '17:00'], 3: ['07:00', '12:00'], 4: ['07:00', '17:00'], 5: ['07:00', '17:00'],
};
export const RECESS = ['09:30', '09:45'];

export const weekdayOf = (isoDate) => {
  const d = new Date(`${isoDate}T12:00:00`).getDay(); // 0 = dimanche
  return d === 0 ? 7 : d;
};

const fmtH = (hhmm) => `${Number(hhmm.slice(0, 2))}h${hhmm.slice(3) === '00' ? '' : hhmm.slice(3)}`;

const overlaps = (a, b) => toMin(a.start) < toMin(b.end) && toMin(b.start) < toMin(a.end);

/** Vérifie qu'un créneau est cohérent et dans les horaires de l'établissement. */
export function validateSlot({ date, start, end }) {
  const errors = [];
  const notes = [];
  if (!date || !start || !end) return { ok: false, errors: ['Date et horaires requis.'], notes };
  if (toMin(end) <= toMin(start)) errors.push('L\'heure de fin doit être postérieure à l\'heure de début.');
  const hours = SCHOOL_HOURS[weekdayOf(date)];
  if (!hours) {
    errors.push('L\'établissement est fermé ce jour-là.');
  } else if (toMin(start) < toMin(hours[0]) || toMin(end) > toMin(hours[1])) {
    errors.push(`Hors horaires d'ouverture (${fmtH(hours[0])}–${fmtH(hours[1])}${weekdayOf(date) === 3 ? ', mercredi' : ''}).`);
  }
  if (overlaps({ start, end }, { start: RECESS[0], end: RECESS[1] })) {
    notes.push('Le créneau inclut la récréation (9h30–9h45).');
  }
  return { ok: errors.length === 0, errors, notes };
}

/** Réservations confirmées qui chevauchent la demande sur la même ressource. */
export function findConflicts(bookings, req) {
  return bookings.filter(
    (b) => b.status !== 'ANNULEE' && b.resourceId === req.resourceId && b.date === req.date && overlaps(b, req),
  );
}

/**
 * Alternatives quand une ressource est prise :
 *  - mêmes horaires, autre ressource du même type sur le même site ;
 *  - même ressource, prochain créneau libre de même durée dans la journée.
 */
export function suggestAlternatives(resources, bookings, req) {
  const target = resources.find((r) => r.id === req.resourceId);
  if (!target) return { sameTime: [], sameResource: [] };

  const sameTime = resources.filter(
    (r) => r.id !== target.id && r.type === target.type && r.siteId === target.siteId &&
      findConflicts(bookings, { ...req, resourceId: r.id }).length === 0,
  );

  const hours = SCHOOL_HOURS[weekdayOf(req.date)];
  const duration = toMin(req.end) - toMin(req.start);
  const sameResource = [];
  if (hours) {
    for (let t = toMin(hours[0]); t + duration <= toMin(hours[1]) && sameResource.length < 3; t += 15) {
      const slot = { ...req, start: toHHMM(t), end: toHHMM(t + duration) };
      if (t !== toMin(req.start) && findConflicts(bookings, slot).length === 0) {
        sameResource.push({ start: slot.start, end: slot.end });
        t += duration - 15; // créneaux suivants non chevauchants
      }
    }
  }
  return { sameTime, sameResource };
}
