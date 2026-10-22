// Brouillons : un texte ou un formulaire en cours est gardé sur l'appareil à chaque frappe ; fermé par
// erreur ou coupé par le réseau, il revient tel quel. Quitter la page avec un brouillon demande confirmation.
import { useEffect, useState } from 'react';

const KEY = 'ent-brouillons-v1';
const readAll = () => { try { return JSON.parse(localStorage.getItem(KEY)) ?? {}; } catch { return {}; } };
const writeAll = (all) => { try { localStorage.setItem(KEY, JSON.stringify(all)); } catch { /* stockage indisponible */ } };
const isEmpty = (v, initial) => JSON.stringify(v) === JSON.stringify(initial) || v === '' || v == null;

/** [valeur, changer, effacer (après envoi), restauré ?] */
export function useDraft(key, initial) {
  const [restored] = useState(() => readAll()[key] !== undefined);
  const [value, setValue] = useState(() => readAll()[key] ?? initial);
  useEffect(() => {
    const all = readAll();
    if (isEmpty(value, initial)) delete all[key]; else all[key] = value;
    writeAll(all);
    if (isEmpty(value, initial)) return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [key, JSON.stringify(value)]); // eslint-disable-line react-hooks/exhaustive-deps
  const clear = () => { const all = readAll(); delete all[key]; writeAll(all); setValue(initial); };
  return [value, setValue, clear, restored && !isEmpty(value, initial)];
}
