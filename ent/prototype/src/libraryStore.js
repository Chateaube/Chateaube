// Bibliothèque : livres, exemplaires et emprunts (prototype : gardés dans ce navigateur).
import { BOOKS, LIBRARY_LOANS } from './data/library.js';

const KEY = 'ent-cdi-v1';
export function loadLibrary() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY));
    if (d?.books && d?.loans) return d;
  } catch { /* stockage indisponible */ }
  return { books: BOOKS, loans: LIBRARY_LOANS };
}
export function saveLibrary(data) {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* stockage indisponible */ }
}
