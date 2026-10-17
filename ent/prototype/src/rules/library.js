// Bibliothèque de la salle d'étude / permanence : romans, annales (Annabrevet, Annabac), documentaires, ouvrages de référence.
// Élèves : un mois ; pour garder le livre un mois de plus, l'élève repasse au secrétariat avec le livre.
// Professeurs : pas de date limite. Chaque exemplaire porte une étiquette (cote) : ROM-0012…

export const LOAN_DAYS = 30;
export const BOOK_TYPES = {
  ROMAN: { label: 'Roman / œuvre', prefix: 'ROM' },
  ANNALES: { label: 'Annales (Annabrevet, Annabac…)', prefix: 'ANN' },
  DOCUMENTAIRE: { label: 'Documentaire', prefix: 'DOC' },
  REFERENCE: { label: 'Référence (dictionnaire, abaque…)', prefix: 'REF' },
  BD: { label: 'Bande dessinée', prefix: 'BD' },
};

const addDays = (iso, n) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/** Cote du prochain exemplaire : préfixe du type + numéro sur 4 chiffres. */
export function nextCode(type, books) {
  const prefix = BOOK_TYPES[type].prefix;
  const nums = books.flatMap((b) => b.copies.map((c) => c.code)).filter((c) => c.startsWith(`${prefix}-`)).map((c) => Number(c.split('-')[1]));
  return `${prefix}-${String(Math.max(0, ...nums) + 1).padStart(4, '0')}`;
}

/** Désignation normalisée : « Titre — Auteur — Éditeur (collection, année) ». */
export const designation = (b) => [b.title, b.author, b.editor && `${b.editor}${b.collection || b.year ? ` (${[b.collection, b.year].filter(Boolean).join(', ')})` : ''}`].filter(Boolean).join(' — ');

export const openLoan = (code, loans) => loans.find((l) => l.code === code && !l.returnedOn);

/** Emprunt : un élève a un mois, un professeur n'a pas de date limite. */
export function borrow(code, loans, { borrower, kind, cls, on }) {
  if (openLoan(code, loans)) return { error: `L'exemplaire ${code} est déjà emprunté.` };
  if (!borrower) return { error: 'Choisir l\'emprunteur.' };
  return { loan: { id: `b${Date.now()}${Math.round(Math.random() * 1e4)}`, code, borrower, kind, cls: cls ?? null, out: on, due: kind === 'PROF' ? null : addDays(on, LOAN_DAYS), renewals: 0 } };
}

/** Prolongation d'un mois : seulement si l'élève présente le livre au secrétariat. */
export function renew(loan, { on, presented }) {
  if (loan.kind === 'PROF') return { error: 'Les professeurs n\'ont pas de date limite.' };
  if (!presented) return { error: 'Le livre doit être présenté au secrétariat pour être prolongé.' };
  return { loan: { ...loan, due: addDays(on, LOAN_DAYS), renewals: loan.renewals + 1, lastSeen: on } };
}

export const giveBackBook = (loan, on, state) => ({ ...loan, returnedOn: on, stateIn: state });

/** Emprunts en retard (élèves). */
export const overdueLoans = (loans, today) => loans.filter((l) => !l.returnedOn && l.due && l.due < today);

// --- Catalogue pour tous et réservations ---
// Tout le monde consulte le catalogue (livres et manuels). Les élèves et les professeurs réservent un
// livre pour une date ; les parents consultent seulement. Un livre réservé est mis de côté au
// secrétariat jusqu'à 2 jours après la date choisie ; si tous les exemplaires sont pris, la réservation
// entre en liste d'attente.
export const RESERVATION_HOLD_DAYS = 2;
export const RESERVATION_MAX_AHEAD = 30;
export const canReserve = (role) => ['ELEVE', 'PROF'].includes(role);

const norm = (t = '') => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Exemplaires disponibles (ni empruntés ni mis de côté pour une réservation). */
export function availability(book, loans, reservations = []) {
  const out = book.copies.filter((c) => openLoan(c.code, loans));
  const held = reservations.filter((r) => r.bookId === book.id && r.status === 'A_RETIRER').length;
  const dues = out.map((c) => openLoan(c.code, loans).due).filter(Boolean).sort();
  return { total: book.copies.length, available: Math.max(0, book.copies.length - out.length - held), nextReturn: dues[0] ?? null };
}

/** Recherche dans les livres et les manuels (titre, auteur, éditeur, matière, classe). */
export function searchCatalog(query, books, manuals = [], { type = 'ALL' } = {}) {
  const q = norm(query.trim());
  const match = (...fields) => !q || q.split(/\s+/).every((w) => fields.some((f) => norm(String(f ?? '')).includes(w)));
  const bookItems = books.filter((b) => (type === 'ALL' || type === b.type) && match(b.title, b.author, b.editor, b.collection, BOOK_TYPES[b.type]?.label))
    .map((b) => ({ source: 'LIVRE', id: b.id, title: b.title, detail: designation(b).replace(`${b.title} — `, '').replace(b.title, ''), type: BOOK_TYPES[b.type]?.label, book: b }));
  const manualItems = (type === 'ALL' || type === 'MANUEL') ? manuals.filter((m) => match(m.title, m.subject, m.editor, ...(m.levels ?? []), 'manuel'))
    .map((m) => ({ source: 'MANUEL', id: m.id, title: m.title, detail: [m.subject, (m.levels ?? []).join(', '), m.editor].filter(Boolean).join(' · '), type: m.category === 'CAHIER' ? 'Cahier d\'activités' : 'Manuel scolaire', manual: m })) : [];
  return [...bookItems, ...manualItems].sort((a, b) => a.title.localeCompare(b.title));
}

/** Réserver un livre pour une date : mis de côté s'il en reste, sinon liste d'attente. */
export function reserve(book, { who, kind, cls, date }, { loans, reservations, today }) {
  if (!canReserve(kind)) return { error: 'Les parents consultent le catalogue ; la réservation se fait depuis le compte de l\'élève.' };
  if (!date || date < today) return { error: 'Choisir une date à partir d\'aujourd\'hui.' };
  if (date > addDays(today, RESERVATION_MAX_AHEAD)) return { error: `Réservation au plus ${RESERVATION_MAX_AHEAD} jours à l'avance.` };
  if (reservations.some((r) => r.bookId === book.id && r.who === who && ['A_RETIRER', 'ATTENTE'].includes(r.status))) return { error: 'Vous avez déjà réservé ce livre.' };
  const free = availability(book, loans, reservations).available > 0;
  const waiting = reservations.filter((r) => r.bookId === book.id && r.status === 'ATTENTE').length;
  return {
    reservation: {
      id: `rv${Date.now()}${Math.round(Math.random() * 1e4)}`, bookId: book.id, who, kind, cls: cls ?? null, date, madeOn: today,
      status: free ? 'A_RETIRER' : 'ATTENTE', holdUntil: free ? addDays(date, RESERVATION_HOLD_DAYS) : null, rank: free ? null : waiting + 1,
    },
  };
}

/** Réservations mises de côté dont le délai de retrait est passé : elles tombent. */
export const expiredReservations = (reservations, today) => reservations.filter((r) => r.status === 'A_RETIRER' && r.holdUntil < today);

// --- Rappel avant la date de retour (dans l'application, pas de SMS) ---
export const REMINDER_DAYS_BEFORE = 3;
/** Emprunts d'élèves à rendre dans les prochains jours (rappel automatique). */
export const dueSoonLoans = (loans, today, days = REMINDER_DAYS_BEFORE) => loans.filter((l) => !l.returnedOn && l.due && l.due >= today && l.due <= addDays(today, days));
export const daysLeft = (due, today) => Math.round((Date.parse(due) - Date.parse(today)) / 86_400_000);

// --- Jeux de société : le cahier des sorties, en ligne ---
/** Exemplaires d'un jeu sortis en ce moment. */
export const gamesOut = (gameId, log) => log.filter((e) => e.gameId === gameId && !e.back);
export function takeGame(game, log, { cls, who, at }) {
  if (!cls || !who?.trim()) return { error: 'Indiquer la classe et les élèves.' };
  if (gamesOut(game.id, log).length >= game.copies) return { error: `Tous les exemplaires de « ${game.name} » sont déjà sortis.` };
  return { entry: { id: `j${Date.now()}`, gameId: game.id, cls, who: who.trim(), out: at, back: null, complete: null } };
}
/** Retour : complet, ou incident (pièce manquante, jeu abîmé) avec une note obligatoire. */
export function returnGame(entry, { at, complete, note }) {
  if (!complete && !note?.trim()) return { error: 'Préciser ce qui manque ou ce qui est abîmé.' };
  return { entry: { ...entry, back: at, complete, note: complete ? undefined : note.trim() } };
}
/** Jeux les plus joués sur une période (nombre de sorties). */
export function gameStats(log, games, from, to) {
  const counts = Object.fromEntries(games.map((g) => [g.id, 0]));
  log.filter((e) => e.out.slice(0, 10) >= from && e.out.slice(0, 10) <= to).forEach((e) => { counts[e.gameId] = (counts[e.gameId] ?? 0) + 1; });
  return games.map((g) => ({ game: g, count: counts[g.id] })).sort((a, b) => b.count - a.count);
}
export const gameIncidents = (log) => log.filter((e) => e.complete === false && !e.resolved);
