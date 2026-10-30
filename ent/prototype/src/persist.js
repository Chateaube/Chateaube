// Enregistrement de toutes les saisies (prototype : dans ce navigateur ; en ligne : sur le serveur).
// usePersistent remplace useState pour les données : chaque modification est écrite tout de suite et
// retrouvée au retour sur l'écran ou après un rechargement. Si le navigateur refuse l'enregistrement
// (aperçu intégré, navigation privée, mémoire pleine), les données restent en mémoire pendant la visite.
//  - « ent-s-… » : saisies de l'année, effacées au premier import des vraies données ;
//  - « ent-k-… » : réglages de l'école (tarifs, articles, réductions), toujours gardés.
import { useCallback, useState } from 'react';

const memory = new Map(); // repli quand le stockage est refusé
const cache = new Map(); // clé → { raw, value } : pas de relecture JSON à chaque accès

export function readStored(key) {
  if (memory.has(key)) return memory.get(key);
  let raw = null;
  try { raw = localStorage.getItem(key); } catch { return undefined; }
  if (raw === null) return undefined;
  const c = cache.get(key);
  if (c && c.raw === raw) return c.value;
  try { const value = JSON.parse(raw); cache.set(key, { raw, value }); return value; } catch { return undefined; }
}

/** Écrit ; renvoie false si le navigateur refuse (la valeur reste alors en mémoire pour la visite). */
export function writeStored(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    memory.delete(key);
    return true;
  } catch { memory.set(key, value); return false; }
}

export function clearStored(prefix) {
  [...memory.keys()].filter((k) => k.startsWith(prefix)).forEach((k) => memory.delete(k));
  try { Object.keys(localStorage).filter((k) => k.startsWith(prefix)).forEach((k) => localStorage.removeItem(k)); } catch { /* stockage indisponible */ }
}

/** Comme useState, mais enregistré sous `key` à chaque modification. */
export function usePersistent(key, init) {
  const [value, setValue] = useState(() => {
    const stored = readStored(key);
    return stored !== undefined ? stored : (typeof init === 'function' ? init() : init);
  });
  const set = useCallback((next) => setValue((prev) => {
    const v = typeof next === 'function' ? next(prev) : next;
    writeStored(key, v);
    return v;
  }), [key]);
  return [value, set];
}
