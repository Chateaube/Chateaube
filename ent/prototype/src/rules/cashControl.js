// Contrôle de caisse : annulation des reçus (motif, validation par la Direction, historique),
// clôture quotidienne des espèces (comptage par billet, écart justifié) et versements en banque.

// Billets et pièces en ariary utilisés au comptage
export const DENOMINATIONS = [20_000, 10_000, 5_000, 2_000, 1_000, 500, 200, 100];

const isCash = (method) => /^esp/i.test(method ?? '');

/** Espèces attendues en caisse : fond du matin + entrées en espèces − sorties en espèces. */
export function expectedCash(opening, movements) {
  return movements.filter((m) => isCash(m.method)).reduce((s, m) => s + (m.dir === 'IN' ? m.amount : -m.amount), opening);
}

/** Total compté : { 20000: 12, 5000: 3, … } → montant. */
export const countTotal = (counts) => DENOMINATIONS.reduce((s, d) => s + d * (Number(counts[d]) || 0), 0);

/** Résultat de la clôture : écart (compté − attendu) ; un écart doit être expliqué. */
export function closingCheck(expected, counted, explanation = '') {
  const diff = counted - expected;
  const errors = [];
  if (diff !== 0 && explanation.trim().length < 10) errors.push('Écart de caisse : une explication est obligatoire (10 caractères au moins).');
  return { expected, counted, diff, status: diff === 0 ? 'JUSTE' : diff > 0 ? 'EXCEDENT' : 'MANQUANT', errors };
}

/** Demande d'annulation d'un reçu (Bureau ou Direction) : motif obligatoire. */
export function requestCancel(receipt, { by, reason, at }) {
  if (receipt.status !== 'VALIDE') return { error: 'Seul un reçu valide peut faire l\'objet d\'une demande d\'annulation.' };
  if (String(reason ?? '').trim().length < 10) return { error: 'Motif obligatoire (10 caractères au moins).' };
  return {
    receipt: { ...receipt, status: 'ANNULATION_DEMANDEE', cancel: { reason: reason.trim(), requestedBy: by, requestedAt: at } },
    log: { at, by, action: 'Demande d\'annulation', receipt: receipt.number, detail: reason.trim() },
  };
}

/** Décision de la Direction : seule la Direction valide ou refuse une annulation. */
export function decideCancel(receipt, { by, role, approve, comment = '', at }) {
  if (role !== 'DIRECTION') return { error: 'Seule la Direction peut valider ou refuser une annulation.' };
  if (receipt.status !== 'ANNULATION_DEMANDEE') return { error: 'Aucune demande d\'annulation en attente pour ce reçu.' };
  if (!approve && comment.trim().length < 5) return { error: 'Indiquer la raison du refus.' };
  return {
    receipt: { ...receipt, status: approve ? 'ANNULE' : 'VALIDE', cancel: { ...receipt.cancel, decidedBy: by, decidedAt: at, approved: approve, comment: comment.trim() } },
    log: { at, by, action: approve ? 'Annulation validée' : 'Annulation refusée', receipt: receipt.number, detail: comment.trim() || receipt.cancel.reason },
  };
}

/** Alerte de versement : trop d'espèces en caisse, ou dernier versement trop ancien. */
export function depositAlert(cashInSafe, lastDeposit, today, { maxAmount = 3_000_000, maxDays = 3 } = {}) {
  const days = Math.round((Date.parse(today) - Date.parse(lastDeposit)) / 86_400_000);
  const reasons = [];
  if (cashInSafe > maxAmount) reasons.push(`plus de ${new Intl.NumberFormat('fr-FR').format(maxAmount).replace(/ | /g, ' ')} Ar en espèces`);
  if (days > maxDays && cashInSafe > 0) reasons.push(`dernier versement il y a ${days} jours`);
  return { days, alert: reasons.length > 0, reasons };
}

/** Contrôle d'un versement en banque. */
export function validateDeposit({ amount, bank, slip }, cashInSafe) {
  const errors = [];
  if (!(amount > 0)) errors.push('Montant à verser.');
  if (amount > cashInSafe) errors.push('Le versement dépasse les espèces en caisse.');
  if (!String(bank ?? '').trim()) errors.push('Banque.');
  if (!String(slip ?? '').trim()) errors.push('N° du bordereau de versement.');
  return errors;
}

const DAY_NAMES = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const addDays = (iso, n) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const weekday = (iso) => new Date(`${iso}T12:00:00Z`).getUTCDay();

/**
 * Jours de versement fixés par l'établissement (ex. mercredi après-midi et vendredi après les cours).
 * Renvoie le prochain jour prévu, si c'est aujourd'hui (rappel), et le dernier jour prévu manqué.
 */
export function depositReminder(today, depositDates, days = [3, 5]) {
  const dueToday = days.includes(weekday(today)) && !depositDates.includes(today);
  let next = addDays(today, 1);
  while (!days.includes(weekday(next))) next = addDays(next, 1);
  let prev = addDays(today, -1);
  while (!days.includes(weekday(prev))) prev = addDays(prev, -1);
  const missed = depositDates.some((d) => d >= prev) ? null : prev;
  return { dueToday, next, nextDay: DAY_NAMES[weekday(next)], missed, missedDay: missed ? DAY_NAMES[weekday(missed)] : null };
}
