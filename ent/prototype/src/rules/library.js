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
