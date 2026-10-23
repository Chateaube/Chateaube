import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from './ui.jsx';
import { searchAll } from '../rules/search.js';
import { setIntent } from '../navIntent.js';

// Recherche universelle (Ctrl+K ou la loupe) : un élève, un écran ou une action, en tapant quelques lettres.
// « certificat Rakoto », « encaisser », « Fitia » : on y va directement. Seuls les écrans auxquels la
// personne a accès sont proposés.
// Favoris : jusqu'à 5 écrans épinglés en tête du menu (gardés sur cet appareil).

const FAV_KEY = 'ent-favoris-v1';
export const MAX_FAVORITES = 5;
export const loadFavorites = (profile) => { try { return JSON.parse(localStorage.getItem(FAV_KEY))?.[profile] ?? []; } catch { return []; } };
export function toggleFavorite(profile, id) {
  let all = {}; try { all = JSON.parse(localStorage.getItem(FAV_KEY)) ?? {}; } catch { /* rien */ }
  const mine = all[profile] ?? [];
  const next = mine.includes(id) ? mine.filter((x) => x !== id) : [...mine, id].slice(-MAX_FAVORITES);
  try { localStorage.setItem(FAV_KEY, JSON.stringify({ ...all, [profile]: next })); } catch { /* stockage indisponible */ }
  return next;
}

export default function GlobalSearch({ nav, go }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const btn = useRef(null);
  const items = useMemo(() => nav.flatMap((g) => g.items.filter((i) => i.screen).map((i) => ({ ...i, group: g.group }))), [nav]);
  const results = searchAll(q, items);
  useEffect(() => {
    const onKey = (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen(true); } };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
  const close = (refocus = true) => { setOpen(false); setQ(''); setSel(0); if (refocus) btn.current?.focus(); };
  // après un choix, le focus va au contenu de l'écran ouvert (pas au bouton : « Entrée » le rouvrirait)
  const pick = (r) => { if (r.type === 'STUDENT') setIntent(r.id, { student: r.label, view: 'fil' }); close(false); go(r.id); setTimeout(() => document.getElementById('contenu')?.focus(), 0); };
  return (
    <>
      <button ref={btn} type="button" onClick={(e) => { e.stopPropagation(); setOpen(true); }} aria-label="Rechercher (Ctrl+K)"
        className="flex h-9 items-center gap-2 rounded-full bg-white/15 px-2.5 text-sm hover:bg-white/25">
        <Icon name="search" className="h-[18px] w-[18px]" /><span className="hidden xl:inline">Rechercher</span><kbd className="hidden rounded bg-white/20 px-1 text-[10px] xl:inline">Ctrl K</kbd>
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/40 p-4 pt-[12vh]" onClick={(e) => { e.stopPropagation(); close(); }}>
          <div role="dialog" aria-modal="true" aria-label="Recherche" onClick={(e) => e.stopPropagation()} className="w-full max-w-lg rounded-2xl bg-white p-3 text-slate-800 shadow-2xl">
            <input autoFocus value={q} placeholder="Un élève, un écran, une action (ex. certificat, Fitia, encaisser)" aria-label="Rechercher"
              onChange={(e) => { setQ(e.target.value); setSel(0); }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') close();
                if (e.key === 'ArrowDown') { e.preventDefault(); setSel((sel + 1) % Math.max(1, results.length)); }
                if (e.key === 'ArrowUp') { e.preventDefault(); setSel((sel - 1 + results.length) % Math.max(1, results.length)); }
                if (e.key === 'Enter' && results[sel]) pick(results[sel]);
              }}
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-base" />
            <ul className="mt-2 max-h-[50vh] overflow-y-auto" role="listbox" aria-label="Résultats">
              {results.map((r, k) => (
                <li key={`${r.type}${r.id}${r.label}`} role="option" aria-selected={k === sel}>
                  <button type="button" onClick={() => pick(r)} onMouseEnter={() => setSel(k)} className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm ${k === sel ? 'bg-navy-50' : ''}`}>
                    <span className="font-medium text-slate-900">{r.type === 'STUDENT' ? `Fil de ${r.label}` : r.label}</span>
                    <span className="text-xs text-slate-600">{r.type === 'STUDENT' ? `élève · ${r.hint}` : r.hint}</span>
                  </button>
                </li>
              ))}
              {q.trim().length >= 2 && !results.length && <li className="px-3 py-2 text-sm text-slate-600">Rien trouvé.</li>}
            </ul>
            <p className="mt-2 px-1 text-[11px] text-slate-600">↑ ↓ pour choisir · Entrée pour ouvrir · Échap pour fermer</p>
          </div>
        </div>
      )}
    </>
  );
}
